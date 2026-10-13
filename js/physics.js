/**
 * physics.js — Particle simulation core (Structure-of-Arrays).
 *
 * Model summary:
 *  - Every object is particles on a lattice, joined to neighbours by
 *    spring-damper bonds. Bonds stretch, yield (ductile plasticity),
 *    soften with heat, and break past a material strain limit -> fracture,
 *    spalling, plugging and petaling all emerge from this one rule.
 *  - Non-bonded particles interact via penalty contact + friction.
 *  - Friction / plastic work -> heat. Heat conducts along bonds, softens
 *    material, melts (bonds dissolve) and vaporises particles.
 *  - Explosives detonate on heat/shock: they flash to hot gas and deliver
 *    a radial impulse; neighbours cook off -> chain reactions.
 *  - Fixed 60 Hz tick with velocity-adaptive sub-stepping (CCD-lite):
 *    a 2000 m/s rod never moves more than ~0.4 lattice spacings per sub-step,
 *    so it cannot tunnel through a plate.
 */
import { MATERIALS } from "./materials.js";

export const SPACING = 3;            // lattice spacing, world px
const MAXP = 24000, MAXB = 90000;

export class Sim {
  constructor(){
    this.n=0;
    this.px=new Float32Array(MAXP); this.py=new Float32Array(MAXP);
    this.vx=new Float32Array(MAXP); this.vy=new Float32Array(MAXP);
    this.fx=new Float32Array(MAXP); this.fy=new Float32Array(MAXP);
    this.mass=new Float32Array(MAXP); this.temp=new Float32Array(MAXP);
    this.dmg=new Float32Array(MAXP); this.age=new Float32Array(MAXP);
    this.mat=new Uint16Array(MAXP); this.state=new Uint8Array(MAXP); // 0 solid 1 liquid 2 gas
    this.alive=new Uint8Array(MAXP); this.debris=new Uint8Array(MAXP);
    this.anchored=new Uint8Array(MAXP); // targets stand until locally disturbed (bond break / shock / melt)
    this.fuse=new Int16Array(MAXP); this.isProj=new Uint8Array(MAXP);
    this.shock=new Float32Array(MAXP);
    this.nb=0;
    this.ba=new Int32Array(MAXB); this.bb=new Int32Array(MAXB);
    this.brest=new Float32Array(MAXB); this.bk=new Float32Array(MAXB);
    this.bbreak=new Float32Array(MAXB); this.balive=new Uint8Array(MAXB);
    this.bondSet=new Set(); this.gravity=300; this.time=0; this.detonations=0; this.brokenBonds=0;
    this.maxPen=0; this.targetFrontX=Infinity; this.hash=new Map();
  }
  clear(){ this.n=0; this.nb=0; this.bondSet.clear(); this.time=0; this.detonations=0; this.brokenBonds=0; this.maxPen=0; this.targetFrontX=Infinity; }
  addParticle(x,y,matId,vx,vy,isProj){
    if(this.n>=MAXP) return -1; const i=this.n++;
    this.px[i]=x; this.py[i]=y; this.vx[i]=vx; this.vy[i]=vy;
    this.fx[i]=0; this.fy[i]=0; this.mat[i]=matId; this.state[i]=0;
    this.temp[i]=20; this.dmg[i]=0; this.age[i]=0; this.alive[i]=1;
    this.debris[i]=0; this.fuse[i]=-1; this.isProj[i]=isProj?1:0; this.shock[i]=0;
    this.anchored[i]=isProj?0:1;
    this.mass[i]=Math.max(.15, MATERIALS[matId].massScale);
    return i;
  }
  addBond(a,b){
    if(a<0||b<0||this.nb>=MAXB) return;
    const dx=this.px[b]-this.px[a], dy=this.py[b]-this.py[a];
    const ma=MATERIALS[this.mat[a]], mb=MATERIALS[this.mat[b]];
    const i=this.nb++;
    this.ba[i]=a; this.bb[i]=b; this.brest[i]=Math.hypot(dx,dy)||SPACING;
    this.bk[i]=(ma.stiffness+mb.stiffness)/2;
    this.bbreak[i]=(ma.breakStrain+mb.breakStrain)/2;
    this.balive[i]=1; this.bondSet.add(a*100000+b); this.bondSet.add(b*100000+a);
  }
  /** Spawn a design grid. origin = centre position. Returns particle ids. */
  spawnGrid(grid, cx, cy, vx=0, vy=0, isProj=false){
    const ids=new Int32Array(grid.w*grid.h).fill(-1);
    const ox=cx-grid.w*SPACING/2, oy=cy-grid.h*SPACING/2;
    for(let y=0;y<grid.h;y++)for(let x=0;x<grid.w;x++){
      const m=grid.cells[y*grid.w+x]; if(m<0) continue;
      ids[y*grid.w+x]=this.addParticle(ox+x*SPACING, oy+y*SPACING, m, vx, vy, isProj);
    }
    for(let y=0;y<grid.h;y++)for(let x=0;x<grid.w;x++){
      const a=ids[y*grid.w+x]; if(a<0) continue;
      if(x+1<grid.w) this.addBond(a, ids[y*grid.w+x+1]);
      if(y+1<grid.h) this.addBond(a, ids[(y+1)*grid.w+x]);
      if(x+1<grid.w&&y+1<grid.h) this.addBond(a, ids[(y+1)*grid.w+x+1]);
      if(x+1<grid.w&&y-1>=0) this.addBond(a, ids[(y-1)*grid.w+x+1]);
    }
    if(!isProj) this.targetFrontX=Math.min(this.targetFrontX, ox);
    return ids;
  }
  buildHash(){
    this.hash.clear();
    const cs=SPACING;
    for(let i=0;i<this.n;i++){ if(!this.alive[i]) continue;
      const k=((this.px[i]/cs)|0)*100000+((this.py[i]/cs)|0);
      let a=this.hash.get(k); if(!a){ a=[]; this.hash.set(k,a); } a.push(i);
    }
  }
  /** One fixed tick (1/60 s), internally sub-stepped. */
  tick(timescale=1){
    const dt=(1/60)*timescale;
    let maxV=0; for(let i=0;i<this.n;i++) if(this.alive[i]){ const v=Math.abs(this.vx[i])+Math.abs(this.vy[i]); if(v>maxV)maxV=v; }
    const sub=Math.max(1, Math.min(28, Math.ceil(maxV*dt/(SPACING*0.38)))); this.subSteps=sub;
    const sdt=dt/sub;
    for(let s=0;s<sub;s++) this.substep(sdt);
    this.thermal(dt); this.updateStates(dt);
    this.time+=dt;
  }
  substep(dt){
    const {px,py,vx,vy,fx,fy}=this;
    fx.fill(0,0,this.n); fy.fill(0,0,this.n);
    // --- bonds: spring-damper with plasticity + heat softening ---
    for(let b=0;b<this.nb;b++){
      if(!this.balive[b]) continue;
      const a=this.ba[b], c=this.bb[b];
      if(!this.alive[a]||!this.alive[c]||this.debris[a]&&this.debris[c]) { /* keep */ }
      if(this.state[a]===2||this.state[c]===2){ this.balive[b]=0; continue; }
      let dx=px[c]-px[a], dy=py[c]-py[a];
      let len=Math.hypot(dx,dy)||1e-4; dx/=len; dy/=len;
      const rest=this.brest[b], strain=(len-rest)/rest;
      const ma=MATERIALS[this.mat[a]];
      const soften=1-Math.min(.75, Math.max(this.temp[a],this.temp[c])/Math.max(200,ma.melt)*.7);
      const breakLim=this.bbreak[b]*soften*(1-Math.max(this.dmg[a],this.dmg[c])*.55);
      if(Math.abs(strain)>breakLim){ this.balive[b]=0; this.brokenBonds++;
        this.dmg[a]=Math.min(1.2,this.dmg[a]+.25); this.dmg[c]=Math.min(1.2,this.dmg[c]+.25);
        this.anchored[a]=0; this.anchored[c]=0; continue; }
      // ductile plasticity: rest length creeps toward current length
      const yieldLim=breakLim*.55;
      if(Math.abs(strain)>yieldLim && ma.brittle<.6){
        this.brest[b]+= (len-rest)*.06*(1-ma.brittle);
        this.temp[a]+=Math.abs(strain)*22; this.temp[c]+=Math.abs(strain)*22; // plastic work -> heat
      }
      const f=this.bk[b]*strain*160*soften;
      const rvx=vx[c]-vx[a], rvy=vy[c]-vy[a];
      const damp=(rvx*dx+rvy*dy)*.55;
      const F=(f+damp);
      fx[a]+=dx*F; fy[a]+=dy*F; fx[c]-=dx*F; fy[c]-=dy*F;
      if(this.temp[a]>ma.melt||this.temp[c]>ma.melt){ if(Math.random()<.3) this.balive[b]=0; } // molten bonds dissolve
    }
    // --- contacts via spatial hash ---
    this.buildHash(); const cs=SPACING, minD=SPACING*1.18;
    for(let i=0;i<this.n;i++){ if(!this.alive[i]) continue;
      const cx=(px[i]/cs)|0, cy=(py[i]/cs)|0;
      for(let gx=cx-1;gx<=cx+1;gx++)for(let gy=cy-1;gy<=cy+1;gy++){
        const cell=this.hash.get(gx*100000+gy); if(!cell) continue;
        for(const j of cell){ if(j<=i||!this.alive[j]) continue;
          if(this.bondSet.has(i*100000+j)) continue; // bonded pairs are handled by bond springs
          let dx=px[j]-px[i], dy=py[j]-py[i]; const d2=dx*dx+dy*dy;
          const md=this.state[i]===2||this.state[j]===2? minD*1.5:minD;
          if(d2>md*md||d2===0) continue;
          const d=Math.sqrt(d2), nx=dx/d, ny=dy/d, overlap=md-d;
          const gas=this.state[i]===2||this.state[j]===2;
          const kc=(gas?26:95) * ((this.anchored[i]||this.anchored[j])?2.6:1);
          const F=overlap*kc;
          fx[i]-=nx*F; fy[i]-=ny*F; fx[j]+=nx*F; fy[j]+=ny*F;
          // friction + impact heating / damage / shock
          const rvx=vx[j]-vx[i], rvy=vy[j]-vy[i];
          const vn=rvx*nx+rvy*ny, tx=-ny, ty=nx, vt=rvx*tx+rvy*ty;
          const fr=(this.state[i]===1||this.state[j]===1)?.25:.6;
          fx[i]+=tx*vt*fr*4; fy[i]+=ty*vt*fr*4; fx[j]-=tx*vt*fr*4; fy[j]-=ty*vt*fr*4;
          // continuum penetration resistance: moving through material costs
          // drag proportional to that material's strength (cavity expansion)
          if(this.isProj[i]!==this.isProj[j]){
            const p=this.isProj[i]?i:j, o=this.isProj[i]?j:i;
            const resist=MATERIALS[this.mat[o]].strength*.006*(0.4+MATERIALS[this.mat[o]].hardness);
            fx[p]-=vx[p]*resist; fy[p]-=vy[p]*resist*.5;
          }
          const impact=Math.abs(vn);
          if(impact>60){ // a face yields when impact exceeds its material strength threshold
            if(impact>60+MATERIALS[this.mat[i]].strength*.38) this.anchored[i]=0;
            if(impact>60+MATERIALS[this.mat[j]].strength*.38) this.anchored[j]=0; }
          if(impact>60){ const heat=impact*.09/(this.subSteps||1); this.temp[i]+=heat; this.temp[j]+=heat;
            if(impact>260){ // harder counter-face damages the softer particle far more
              const hi=MATERIALS[this.mat[i]].hardness+.08, hj=MATERIALS[this.mat[j]].hardness+.08;
              this.dmg[i]=Math.min(1.2,this.dmg[i]+impact*.00045/(this.subSteps||1)*(hj/hi));
              this.dmg[j]=Math.min(1.2,this.dmg[j]+impact*.00045/(this.subSteps||1)*(hi/hj));
              this.shock[i]=Math.max(this.shock[i],impact); this.shock[j]=Math.max(this.shock[j],impact); } }
        }
      }
    }
    // --- integrate (semi-implicit Euler) ---
    for(let i=0;i<this.n;i++){ if(!this.alive[i]) continue;
      if(this.anchored[i] && this.state[i]===0){ vx[i]=0; vy[i]=0; continue; }
      const m=this.mass[i];
      vx[i]+= (fx[i]/m)*dt; vy[i]+= (fy[i]/m + this.gravity*(this.state[i]===2?-.06:1))*dt;
      const drag=this.state[i]===2? .6 : this.state[i]===1? .12 : .015;
      vx[i]*=(1-drag*dt*8); vy[i]*=(1-drag*dt*8);
      const sp=Math.hypot(vx[i],vy[i]), MAXV=2600;
      if(sp>MAXV){ vx[i]*=MAXV/sp; vy[i]*=MAXV/sp; }
      px[i]+=vx[i]*dt; py[i]+=vy[i]*dt;
      // floor / bounds (world 640x360, floor y=336)
      if(py[i]>334){ py[i]=334; vy[i]*=-.18; vx[i]*=.82; if(Math.abs(vy[i])<8)vy[i]=0; }
      if(py[i]<2){ py[i]=2; vy[i]*=-.2; }
      if(px[i]<-80||px[i]>760||py[i]>420) this.alive[i]=0;
      if(this.isProj[i]&&this.targetFrontX<Infinity) this.maxPen=Math.max(this.maxPen, px[i]-this.targetFrontX);
    }
  }
  thermal(dt){
    // conduction along bonds (cheap, runs once per tick)
    for(let b=0;b<this.nb;b++){ if(!this.balive[b]) continue;
      const a=this.ba[b], c=this.bb[b]; if(!this.alive[a]||!this.alive[c]) continue;
      const k=MATERIALS[this.mat[a]].cond*.12;
      const d=(this.temp[c]-this.temp[a])*k;
      this.temp[a]+=d; this.temp[c]-=d;
    }
    for(let i=0;i<this.n;i++){ if(!this.alive[i]) continue;
      this.temp[i]+= (20-this.temp[i])*.004; // ambient cooling / radiation
      if(this.temp[i]<20)this.temp[i]=20;
    }
  }
  updateStates(dt){
    for(let i=0;i<this.n;i++){ if(!this.alive[i]) continue;
      const m=MATERIALS[this.mat[i]]; this.age[i]+=dt;
      // damage -> debris (bonds stop holding it as structure via dmg softening; full break:)
      if(this.dmg[i]>=1 && !this.debris[i]) this.debris[i]=1;
      if(this.dmg[i]>.45) this.anchored[i]=0;
      // phase changes
      if(this.state[i]===0 && this.temp[i]>=m.melt){ this.state[i]=1; this.anchored[i]=0; }
      if(this.state[i]===1 && this.temp[i]<m.melt*.8) this.state[i]=0;
      if(this.temp[i]>=m.boil && m.cat!=="Explosives") this.state[i]=2;
      if(this.state[i]===2){ this.temp[i]-=900*dt; if(this.temp[i]<160||this.age[i]>9) this.alive[i]=0; }
      // detonation triggers: heat, cook-off, or hard shock
      if(m.detEnergy>0 && this.fuse[i]<0 && this.state[i]!==2){
        if(this.temp[i]>m.ignite || this.shock[i]>430) this.fuse[i]=1+(Math.random()*3|0);
      }
      this.shock[i]*=.55;
      if(this.fuse[i]>0){ this.fuse[i]--; if(this.fuse[i]===0) this.detonate(i); }
    }
  }
  detonate(i){
    const m=MATERIALS[this.mat[i]]; if(this.state[i]===2) return;
    this.state[i]=2; this.temp[i]=2400+Math.random()*600; this.age[i]=0; this.detonations++;
    const R=SPACING*5.2, E=m.detEnergy*46;
    this.buildHash();
    for(let j=0;j<this.n;j++){ if(j===i||!this.alive[j]) continue;
      const dx=this.px[j]-this.px[i], dy=this.py[j]-this.py[i]; const d2=dx*dx+dy*dy;
      if(d2>R*R) continue; const d=Math.sqrt(d2)||1, fall=1-d/R;
      const imp=E*fall/Math.max(.3,this.mass[j]);
      this.vx[j]+=dx/d*imp; this.vy[j]+=dy/d*imp - imp*.12;
      this.temp[j]+=700*fall; this.shock[j]=Math.max(this.shock[j], 500*fall);
      const mj=MATERIALS[this.mat[j]];
      this.anchored[j]=0;
      if(mj.detEnergy>0 && this.fuse[j]<0 && fall>.25) this.fuse[j]=1+(Math.random()*4|0); // chain reaction
    }
    this.vx[i]+= (Math.random()-.5)*60; this.vy[i]-=80;
  }
  stats(){
    let projAlive=0, targAlive=0, hot=0;
    for(let i=0;i<this.n;i++){ if(!this.alive[i])continue; if(this.isProj[i])projAlive++; else targAlive++; if(this.temp[i]>600)hot++; }
    return { particles:this.n, alive:projAlive+targAlive, projAlive, targAlive, bonds:this.nb, brokenBonds:this.brokenBonds, detonations:this.detonations, hot, maxPenPx:this.maxPen };
  }
}
