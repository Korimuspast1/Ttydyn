// Ttydyn Engine v1 - Core 3D Engine (ECS + Physics + Survival)
// Личный движок: без внешних библиотек, чистый WebGL2 + AABB физика
import { Vec3 } from './math';
import { PhysicsWorld3D, Body } from './physics3d';
import { Renderer3D } from './renderer3d';
import { World3D } from './world3d';

export interface Zombie { body: Body; hp:number; state:'wander'|'chase'; target:Vec3; timer:number; }

function hexToVec(hex:string){
  if(hex.startsWith('#')){ const r=parseInt(hex.slice(1,3),16)/255, g=parseInt(hex.slice(3,5),16)/255, b=parseInt(hex.slice(5,7),16)/255; return new Vec3(r,g,b) }
  return new Vec3(0.5,0.5,0.5)
}

export class TtydynEngine {
  renderer: Renderer3D;
  physics: PhysicsWorld3D;
  world3d: World3D;
  player: Body;
  zombies: Zombie[]=[];
  buildings: Body[]=[];
  props: Body[]=[];
  bullets: {pos:Vec3, vel:Vec3, life:number}[]=[];
  time=0; dayTime=0.3;
  kills=0; hp=100; stamina=100; hunger=0; thirst=0; infected=0; bleeding=0;
  keys: Record<string,boolean>={};
  mouseDown=false; yaw=0; pitch=-0.12; pointerLocked=false;
  onHud: ((s:string)=>void)|null=null;
  onStats: ((o:any)=>void)|null=null;

  constructor(canvas:HTMLCanvasElement){
    this.renderer=new Renderer3D(canvas);
    this.physics=new PhysicsWorld3D();
    this.world3d=new World3D(Math.floor(Math.random()*999999));
    this.physics.setHeightFn((x,z)=>this.world3d.heightAt(x,z));

    // player capsule -> box 0.9x1.8x0.9
    this.player=new Body(new Vec3(0,6,0), new Vec3(0.45,0.9,0.45), 1,false);
    this.player.type='player'; this.player.friction=0.92; this.physics.addBody(this.player);

    // buildings as static AABBs
    for(const b of this.world3d.buildings){
      const cx=b.pos.x + b.size.x*0.5, cz=b.pos.z + b.size.z*0.5;
      const cy=b.pos.y + b.size.y*0.5 + 0.6;
      const center=new Vec3(cx, cy, cz);
      const body=new Body(center, new Vec3(b.size.x*0.5, b.size.y*0.5, b.size.z*0.5), 0, true);
      body.type='building'; body.color='#6e5a46';
      this.physics.addBody(body); this.buildings.push(body);
      // loot crate inside
      const cratePos=new Vec3(b.pos.x + b.size.x*0.3, b.pos.y+0.5, b.pos.z + b.size.z*0.3);
      const crate=new Body(cratePos, new Vec3(0.4,0.4,0.4),0,true); crate.type='loot'; crate.color='#8a6a2a'; this.physics.addBody(crate); this.props.push(crate);
    }
    // trees
    for(const t of this.world3d.trees){
      const h=this.world3d.heightAt(t.x,t.z);
      const trunk=new Body(new Vec3(t.x, h+1.2, t.z), new Vec3(0.25,1.2,0.25),0,true); trunk.type='tree'; trunk.color='#3e2a14'; this.physics.addBody(trunk); this.props.push(trunk);
      const leaves=new Body(new Vec3(t.x, h+2.6, t.z), new Vec3(1.0,0.9,1.0),0,true); leaves.type='leaves'; leaves.color='#1e4d1e'; this.physics.addBody(leaves); this.props.push(leaves);
    }
    // zombies 45 pcs
    for(let i=0;i<48;i++){
      const x=(Math.random()-0.5)*260, z=(Math.random()-0.5)*260;
      if(Math.hypot(x,z)<20) { i--; continue; }
      const h=this.world3d.heightAt(x,z);
      const b=new Body(new Vec3(x,h+0.9,z), new Vec3(0.42,0.9,0.42),0.9,false); b.type='zombie'; b.color='#5a6a3a'; b.friction=0.72;
      this.physics.addBody(b);
      this.zombies.push({body:b, hp:32+Math.random()*20, state:'wander', target:new Vec3(x+ (Math.random()-0.5)*18,0,z+(Math.random()-0.5)*18), timer: 2+Math.random()*3 });
    }
    this.setupInput(canvas);
  }

  setupInput(canvas:HTMLCanvasElement){
    window.addEventListener('keydown', e=>{
      const k=e.key.toLowerCase();
      this.keys[k]=true;
      if(k===' '){ e.preventDefault(); if(this.player.grounded){ this.player.vel.y=6.8; this.stamina=Math.max(0,this.stamina-9); } }
      if(k==='e'){ this.tryInteract(); }
      if(k==='f'){ this.tryPlaceBarricade(); }
      if(k==='r' && this.hp<=0){ this.respawn(); }
    });
    window.addEventListener('keyup', e=> this.keys[e.key.toLowerCase()]=false);
    canvas.addEventListener('click', ()=>{ if(!this.pointerLocked) canvas.requestPointerLock(); });
    canvas.addEventListener('mousedown', e=>{
      if(e.button===0){ this.mouseDown=true; this.shoot(); if(!this.pointerLocked) canvas.requestPointerLock(); }
    });
    window.addEventListener('mouseup', e=>{ if(e.button===0) this.mouseDown=false });
    window.addEventListener('mousemove', e=>{
      if(document.pointerLockElement===canvas){
        this.yaw += e.movementX * 0.0021;
        this.pitch = Math.max(-1.18, Math.min(1.12, this.pitch - e.movementY*0.0021));
        this.pointerLocked=true;
      }
    });
    document.addEventListener('pointerlockchange', ()=>{ this.pointerLocked=document.pointerLockElement===canvas });
    // touch fallback
    let lastTouchX=0;
    canvas.addEventListener('touchstart', e=>{ lastTouchX=e.touches[0].clientX; });
    canvas.addEventListener('touchmove', e=>{
      const dx=e.touches[0].clientX-lastTouchX; this.yaw+=dx*0.004; lastTouchX=e.touches[0].clientX;
    });
  }

  tryInteract(){
    for(const p of this.props){ if(p.type==='loot'){ const d=Math.hypot(p.pos.x-this.player.pos.x, p.pos.z-this.player.pos.z); if(d<3.2){ this.hunger=Math.max(0,this.hunger-22); this.thirst=Math.max(0,this.thirst-14); this.stamina=Math.min(100,this.stamina+14); this.log('📦 Loot: +food +water +stamina'); p.color='#3a3a3a'; setTimeout(()=>{ this.physics.removeBody(p); this.props=this.props.filter(x=>x!==p)},180); break; } } }
  }
  tryPlaceBarricade(){
    const f=this.forward();
    const pos=new Vec3(this.player.pos.x + f.x*2.4, this.world3d.heightAt(this.player.pos.x+f.x*2.4, this.player.pos.z+f.z*2.4)+0.7, this.player.pos.z + f.z*2.4);
    const b=new Body(pos, new Vec3(0.7,0.6,0.95),0,true); b.type='barricade'; b.color='#6a4a1a'; this.physics.addBody(b); this.props.push(b); this.log('🪵 Barricade placed (F)');
  }
  shoot(){
    const f=this.forward();
    const origin=new Vec3(this.player.pos.x, this.player.pos.y+0.38, this.player.pos.z);
    const dir=f.clone();
    const hit=this.physics.raycast(origin, dir, 140);
    this.bullets.push({pos: origin.clone(), vel: new Vec3(dir.x*92, dir.y*92, dir.z*92), life:0.16});
    this.stamina=Math.max(0,this.stamina-5.5);
    this.pitch+=0.018; // recoil
    if(hit && hit.body.type==='zombie'){
      const z=this.zombies.find(z=>z.body.id===hit.body.id);
      if(z){ z.hp-= 24 + Math.random()*12; z.body.applyImpulse(new Vec3(dir.x*7,1.6, dir.z*7)); this.log('💥 Hit zombie! HP '+Math.floor(z.hp)); if(z.hp<=0){ this.physics.removeBody(z.body); this.zombies=this.zombies.filter(x=>x!==z); this.kills++; this.log('☠️ Killed! Total:'+this.kills); } }
    } else if(hit){ hit.body.applyImpulse(new Vec3(dir.x*5,2.2, dir.z*5)); }
    this.attractZombies(this.player.pos, 30);
  }
  attractZombies(pos:Vec3, rad:number){
    for(const z of this.zombies){ const d=Math.hypot(z.body.pos.x-pos.x, z.body.pos.z-pos.z); if(d<rad){ z.state='chase'; z.target=pos.clone(); z.timer=2.8 } }
  }
  forward(){
    return new Vec3(Math.sin(this.yaw)*Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw)*Math.cos(this.pitch)).normalize();
  }
  right(){
    const f=this.forward(); return new Vec3(f.z,0,-f.x).normalize();
  }
  log(s:string){ if(this.onHud) this.onHud(s); console.log('[Ttydyn3D]',s)}
  respawn(){
    this.hp=100; this.hunger=0; this.thirst=0; this.infected=0; this.bleeding=0; this.player.pos.set(0,7,0); this.player.vel.set(0,0,0); this.log('♻️ Respawn same world - zombies remain');
  }

  update(dt:number){
    this.time+=dt; this.dayTime=(this.time*0.014)%1;
    const hour=this.dayTime*24;
    // survival decay
    this.hunger=Math.min(100,this.hunger+0.19*dt); this.thirst=Math.min(100,this.thirst+0.27*dt);
    if(this.hunger>80) this.hp-=0.42*dt; if(this.thirst>85) this.hp-=0.72*dt;
    if(this.infected>0){ this.infected+=0.55*dt; this.hp-=0.55*dt; }
    if(this.bleeding>0){ this.hp-=0.62*dt; this.bleeding+=0.42*dt; }
    if(this.hp<=0){ this.hp=0; }
    if(this.onStats) this.onStats({hp:this.hp, stamina:this.stamina, hunger:this.hunger, thirst:this.thirst, infected:this.infected, bleeding:this.bleeding, kills:this.kills, hour, dayTime:this.dayTime, zombies:this.zombies.length});

    // FPS movement
    const f=this.forward(), r=this.right();
    const f2=new Vec3(f.x,0,f.z).normalize(), r2=new Vec3(r.x,0,r.z).normalize();
    let mx=0,mz=0;
    if(this.keys['w']||this.keys['arrowup']) { mx+=f2.x; mz+=f2.z; }
    if(this.keys['s']||this.keys['arrowdown']) { mx-=f2.x; mz-=f2.z; }
    if(this.keys['a']||this.keys['arrowleft']) { mx-=r2.x; mz-=r2.z; }
    if(this.keys['d']||this.keys['arrowright']) { mx+=r2.x; mz+=r2.z; }
    const len=Math.hypot(mx,mz)||1; if(mx||mz){ mx/=len; mz/=len; }
    const isRun=this.keys['shift'];
    const isSneak=this.keys[' ']||this.keys['control'];
    let speed = isSneak? 2.0 : isRun ? 5.6 : 3.4;
    if(this.stamina<9) speed*=0.58;
    if(isRun && (mx||mz)){ this.stamina=Math.max(0,this.stamina-9.2*dt); if(Math.random()<0.09) this.attractZombies(this.player.pos, 11); }
    else { this.stamina=Math.min(100,this.stamina+7.2*dt); }
    const accel= isRun? 24 : 15;
    this.player.vel.x += (mx*speed - this.player.vel.x)*Math.min(1, accel*dt);
    this.player.vel.z += (mz*speed - this.player.vel.z)*Math.min(1, accel*dt);

    // bullets
    for(const b of this.bullets){ b.pos.add(new Vec3(b.vel.x*dt,b.vel.y*dt,b.vel.z*dt)); b.vel.y-=9.2*dt; b.life-=dt; }
    this.bullets=this.bullets.filter(b=>b.life>0);

    // zombies AI
    for(const z of this.zombies){
      const dx=this.player.pos.x - z.body.pos.x, dz=this.player.pos.z - z.body.pos.z, dist=Math.hypot(dx,dz);
      const canSee = dist<16 && !this.isOccluded(z.body.pos, this.player.pos);
      const canHear = dist < (isRun?18:8);
      if(canSee || (canHear && (isRun||Math.random()<0.015))){ z.state='chase'; z.target=this.player.pos.clone(); z.timer=1.4; }
      if(z.state==='chase'){
        const dir=new Vec3(dx,0,dz).normalize(); dir.scale(1.9*dt*3.3);
        z.body.vel.x += dir.x*6.2*dt*12; z.body.vel.z += dir.z*6.2*dt*12;
        z.body.vel.x*=0.91; z.body.vel.z*=0.91;
        if(dist<1.45){
          if(Math.random()<0.62*dt*2.2){ this.hp-=7+Math.random()*7; this.bleeding=Math.min(100,this.bleeding+9); this.log('🩸 Bite! HP '+Math.floor(this.hp)+' Bleed '+Math.floor(this.bleeding)); if(Math.random()<0.2){ this.infected=Math.min(100,this.infected+15); this.log('🤢 INFECTED! Slow death...'); } z.body.applyImpulse(new Vec3(-dir.x*2.2,2.1,-dir.z*2.2)); }
        }
        z.timer-=dt; if(z.timer<=0) z.state='wander';
      } else {
        z.timer-=dt;
        if(z.timer<=0){ const ang=Math.random()*Math.PI*2, d=8+Math.random()*12; z.target.set(z.body.pos.x+Math.cos(ang)*d, 0, z.body.pos.z+Math.sin(ang)*d); z.timer=3+Math.random()*4; }
        const dx2=z.target.x - z.body.pos.x, dz2=z.target.z - z.body.pos.z, d2=Math.hypot(dx2,dz2);
        if(d2>1){ const dir=new Vec3(dx2,0,dz2).normalize(); z.body.vel.x+=dir.x*4.2*dt*6; z.body.vel.z+=dir.z*4.2*dt*6; }
      }
    }

    // physics substeps
    const sub=3; for(let i=0;i<sub;i++) this.physics.step(dt/sub);

    // camera (first-person)
    this.renderer.camPos.set(this.player.pos.x, this.player.pos.y+1.62, this.player.pos.z);
    this.renderer.yaw=this.yaw; this.renderer.pitch=this.pitch;
    this.renderer.dayTime=this.dayTime;
  }

  isOccluded(a:Vec3,b:Vec3){
    const dir=Vec3.sub(b,a).normalize(); const dist=Math.hypot(b.x-a.x,b.z-a.z);
    const steps=Math.floor(dist*2);
    for(let s=1;s<steps;s++){ const t=s/steps, x=a.x+(b.x-a.x)*t, z=a.z+(b.z-a.z)*t;
      for(const bd of this.buildings){ if(Math.abs(bd.pos.x - x) < bd.size.x && Math.abs(bd.pos.z - z) < bd.size.z) return true; }
    } return false;
  }

  render(){
    this.renderer.beginFrame();
    const cam=this.player.pos;
    // chunked ground tiles 2m
    for(let x=Math.floor(cam.x/2)*2-46; x<Math.floor(cam.x/2)*2+46; x+=2){
      for(let z=Math.floor(cam.z/2)*2-46; z<Math.floor(cam.z/2)*2+46; z+=2){
        if(Math.hypot(x-cam.x, z-cam.z)>66) continue;
        const h=this.world3d.heightAt(x,z);
        const isRoad = this.isRoad(x,z);
        const col = isRoad ? new Vec3(0.16,0.16,0.16) : new Vec3(0.20,0.40,0.14);
        if(isRoad) this.renderer.drawBox(new Vec3(x,h-0.45,z), new Vec3(1,0.45,1), col);
        else this.renderer.drawBox(new Vec3(x,h-0.5,z), new Vec3(1,0.5,1), col);
      }
    }
    for(const b of this.buildings) this.renderer.drawBox(b.pos, b.size, new Vec3(0.43,0.36,0.29));
    for(const p of this.props){
      const col = hexToVec(p.color);
      this.renderer.drawBox(p.pos, p.size, col);
    }
    for(const z of this.zombies){
      const col = z.hp<14? new Vec3(0.68,0.18,0.18): hexToVec(z.body.color);
      this.renderer.drawBox(z.body.pos, z.body.size, col);
      this.renderer.drawBox(new Vec3(z.body.pos.x, z.body.pos.y+0.88, z.body.pos.z), new Vec3(0.28,0.28,0.28), new Vec3(0.56,0.54,0.44));
    }
    for(const bl of this.bullets) this.renderer.drawBox(bl.pos, new Vec3(0.07,0.07,0.19), new Vec3(1,0.92,0.26));
    const f=this.forward(); const weaponPos=new Vec3(this.player.pos.x + f.x*0.85, this.player.pos.y+0.38 + f.y*0.85, this.player.pos.z + f.z*0.85);
    this.renderer.drawBox(weaponPos, new Vec3(0.075,0.075,0.44), new Vec3(0.14,0.14,0.14));
  }
  isRoad(x:number,z:number){
    const s=this.world3d.size, block=40, roadW=6;
    const gx = ((x+s)%(block+roadW)+ (block+roadW))%(block+roadW);
    const gz = ((z+s)%(block+roadW)+ (block+roadW))%(block+roadW);
    return gx<roadW || gz<roadW;
  }
}
