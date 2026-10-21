// Ttydyn 3D Engine - Procedural World (heightmap, city blocks, buildings, loot)
import { Vec3 } from './math';

function mulberry32(seed:number){
  return function(){ let t=seed+=0x6D2B79F5; t=Math.imul(t ^ t>>>15, t|1); t^=t+Math.imul(t ^ t>>>7, 61|t); return ((t ^ t>>>14)>>>0)/4294967296 }
}
function smoothstep(t:number){ return t*t*(3-2*t) }
function lerp(a:number,b:number,t:number){ return a+(b-a)*t }

export class World3D {
  seed: number;
  rnd: ()=>number;
  size=400; // world half extent
  buildings: {pos:Vec3,size:Vec3,h:number}[]=[];
  trees: Vec3[]=[];
  lootPoints: Vec3[]=[];
  heightCacheM: Map<string,number>=new Map();
  constructor(seed=Math.floor(Math.random()*999999)){
    this.seed=seed; this.rnd=mulberry32(seed);
    this.generate();
  }
  private hash2(ix:number, iz:number){
    // fast hash
    let h = Math.sin(ix*127.1 + iz*311.7 + this.seed*0.01)*43758.5453; return h - Math.floor(h);
  }
  noise2(x:number,z:number){
    const xi=Math.floor(x), zi=Math.floor(z);
    const xf=x-xi, zf=z-zi;
    const h00=this.hash2(xi,zi), h10=this.hash2(xi+1,zi), h01=this.hash2(xi,zi+1), h11=this.hash2(xi+1,zi+1);
    const u=smoothstep(xf), v=smoothstep(zf);
    return lerp(lerp(h00,h10,u), lerp(h01,h11,u), v);
  }
  fbm(x:number,z:number){
    let v=0, amp=1, freq=0.012, max=0;
    for(let i=0;i<4;i++){ v+=this.noise2(x*freq*80, z*freq*80)*amp; max+=amp; amp*=0.5; freq*=2.0 }
    return v/max;
  }
  heightAt(x:number,z:number){
    const key=`${Math.round(x)}|${Math.round(z)}`;
    if(this.heightCacheM.has(key)) return this.heightCacheM.get(key)!;
    // terrain + city flattening
    let h = this.fbm(x,z)*6 -2;
    // roads grid flatten
    const block=40, roadW=6;
    const gx = ((x+this.size)%(block+roadW)+ (block+roadW))%(block+roadW);
    const gz = ((z+this.size)%(block+roadW)+ (block+roadW))%(block+roadW);
    const isRoad = gx < roadW || gz < roadW;
    if(isRoad) h = Math.min(h, 0.2); // flatten roads
    // add small city block bumps
    h += Math.sin(x*0.02)*0.3 + Math.cos(z*0.02)*0.3;
    this.heightCacheM.set(key,h);
    return h;
  }
  generate(){
    this.buildings=[]; this.trees=[]; this.lootPoints=[];
    const block=46, roadW=6;
    // city blocks
    for(let bx=-this.size+20; bx<this.size-20; bx+=block+roadW){
      for(let bz=-this.size+20; bz<this.size-20; bz+=block+roadW){
        if(this.rnd()<0.18){ // park
          for(let i=0;i<6;i++) this.trees.push(new Vec3(bx+5+this.rnd()*30, 0, bz+5+this.rnd()*30));
          continue;
        }
        const count= 1+ Math.floor(this.rnd()*3);
        for(let c=0;c<count;c++){
          let attempts=0;
          while(attempts++<8){
            const w= 6+ this.rnd()*8, d=6+ this.rnd()*8, h=3+ this.rnd()*4;
            const x= bx+4+ this.rnd()*(block-12-w), z= bz+4+ this.rnd()*(block-12-d);
            const pos=new Vec3(x, this.heightAt(x,z), z);
            // avoid overlap
            let ok=true;
            for(let b of this.buildings) if(Math.abs(b.pos.x - x) < (b.size.x + w) && Math.abs(b.pos.z - z) < (b.size.z + d)) ok=false;
            if(!ok) continue;
            this.buildings.push({pos, size:new Vec3(w, h, d), h});
            // loot points inside
            this.lootPoints.push(new Vec3(x+w*0.3, 0, z+d*0.3));
            break;
          }
        }
      }
    }
    for(let i=0;i<180;i++){
      const x=(this.rnd()-0.5)*this.size*1.8, z=(this.rnd()-0.5)*this.size*1.8;
      if(Math.abs(x)<30 && Math.abs(z)<30) continue;
      this.trees.push(new Vec3(x,0,z));
    }
  }
}
