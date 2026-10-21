// Ttydyn Engine v1 - 3D Physics (AABB, RigidBody, World)
import { Vec3 } from './math';

export interface AABB { min: Vec3; max: Vec3; }

export function aabbOverlap(a:AABB,b:AABB){
  return a.min.x <= b.max.x && a.max.x >= b.min.x &&
         a.min.y <= b.max.y && a.max.y >= b.min.y &&
         a.min.z <= b.max.z && a.max.z >= b.min.z;
}

export class Body {
  pos: Vec3;
  vel: Vec3 = new Vec3();
  acc: Vec3 = new Vec3();
  size: Vec3; // half extents
  mass: number;
  invMass: number;
  restitution=0.1;
  friction=0.8;
  grounded=false;
  isStatic: boolean;
  id: number;
  type:string='box';
  color:string='#888';
  static _nextId=1;
  constructor(pos:Vec3, size:Vec3, mass=1, isStatic=false){
    this.pos=pos.clone(); this.size=size.clone(); this.mass=mass; this.invMass=isStatic||mass===0?0:1/mass; this.isStatic=isStatic; this.id=Body._nextId++;
  }
  get aabb():AABB{
    return { min: new Vec3(this.pos.x-this.size.x, this.pos.y-this.size.y, this.pos.z-this.size.z),
             max: new Vec3(this.pos.x+this.size.x, this.pos.y+this.size.y, this.pos.z+this.size.z) };
  }
  applyImpulse(imp:Vec3){
    if(this.invMass===0) return;
    this.vel.add(new Vec3(imp.x*this.invMass, imp.y*this.invMass, imp.z*this.invMass));
  }
}

export class PhysicsWorld3D {
  gravity = new Vec3(0,-14,0);
  bodies: Body[] = [];
  // heightmap terrain for floor collisions
  heightFn: ((x:number,z:number)=>number) | null = null;
  addBody(b:Body){ this.bodies.push(b); return b }
  removeBody(b:Body){ this.bodies=this.bodies.filter(x=>x.id!==b.id)}
  clear(){ this.bodies=[]}
  setHeightFn(fn:(x:number,z:number)=>number){ this.heightFn=fn }

  step(dt:number){
    // integrate
    for(const b of this.bodies){
      if(b.isStatic) continue;
      b.vel.add(new Vec3(this.gravity.x*dt, this.gravity.y*dt, this.gravity.z*dt));
      // damping
      b.vel.scale(0.995);
      b.pos.add(new Vec3(b.vel.x*dt, b.vel.y*dt, b.vel.z*dt));
      b.grounded=false;
    }
    // terrain floor collisions
    if(this.heightFn){
      for(const b of this.bodies){
        if(b.isStatic) continue;
        const h=this.heightFn(b.pos.x, b.pos.z);
        const bottom=b.pos.y - b.size.y;
        if(bottom < h){
          b.pos.y = h + b.size.y;
          if(b.vel.y<0) b.vel.y*= -b.restitution;
          if(Math.abs(b.vel.y)<0.5) b.vel.y=0;
          b.vel.x*= (1 - b.friction*dt*6);
          b.vel.z*= (1 - b.friction*dt*6);
          b.grounded=true;
        }
      }
    }
    // AABB collisions - naive O(n^2) with spatial hash
    for(let i=0;i<this.bodies.length;i++){
      for(let j=i+1;j<this.bodies.length;j++){
        const a=this.bodies[i], b=this.bodies[j];
        if(a.isStatic && b.isStatic) continue;
        if(!aabbOverlap(a.aabb,b.aabb)) continue;
        this.resolve(a,b);
      }
    }
  }
  private resolve(a:Body,b:Body){
    const dx = b.pos.x - a.pos.x, dy= b.pos.y - a.pos.y, dz= b.pos.z - a.pos.z;
    const overlapX = (a.size.x + b.size.x) - Math.abs(dx);
    const overlapY = (a.size.y + b.size.y) - Math.abs(dy);
    const overlapZ = (a.size.z + b.size.z) - Math.abs(dz);
    if(overlapX<0||overlapY<0||overlapZ<0) return;
    // smallest penetration
    let axis: 'x'|'y'|'z'='x', pen=overlapX;
    if(overlapY < pen){ pen=overlapY; axis='y';}
    if(overlapZ < pen){ pen=overlapZ; axis='z';}
    const totalInv = a.invMass + b.invMass;
    if(totalInv===0) return;
    const sign = axis==='x'? Math.sign(dx)||1 : axis==='y'? Math.sign(dy)||1 : Math.sign(dz)||1;
    const sep = pen + 0.001;
    if(axis==='x'){
      const move = new Vec3(sep*sign,0,0);
      if(!a.isStatic) a.pos.sub(new Vec3(move.x * (a.invMass/totalInv),0,0));
      if(!b.isStatic) b.pos.add(new Vec3(move.x * (b.invMass/totalInv),0,0));
      const rel = b.vel.x - a.vel.x;
      if(Math.abs(rel)>0.01){ const imp= -rel*(1+Math.min(a.restitution,b.restitution)); const j=imp/totalInv; if(!a.isStatic) a.vel.x -= j*a.invMass; if(!b.isStatic) b.vel.x += j*b.invMass; }
    } else if(axis==='y'){
      const move = new Vec3(0,sep*sign,0);
      if(!a.isStatic) a.pos.sub(new Vec3(0, move.y*(a.invMass/totalInv),0));
      if(!b.isStatic) b.pos.add(new Vec3(0, move.y*(b.invMass/totalInv),0));
      if(sign>0){ // b above a
        if(b.vel.y<0) b.grounded=true;
      } else { if(a.vel.y<0) a.grounded=true; }
      const rel = b.vel.y - a.vel.y;
      const imp= -rel*0.6; const j=imp/totalInv; if(!a.isStatic) a.vel.y -= j*a.invMass; if(!b.isStatic) b.vel.y += j*b.invMass;
    } else {
      const move = new Vec3(0,0,sep*sign);
      if(!a.isStatic) a.pos.sub(new Vec3(0,0, move.z*(a.invMass/totalInv)));
      if(!b.isStatic) b.pos.add(new Vec3(0,0, move.z*(b.invMass/totalInv)));
      const rel = b.vel.z - a.vel.z;
      if(Math.abs(rel)>0.01){ const imp= -rel*(1+Math.min(a.restitution,b.restitution)); const j=imp/totalInv; if(!a.isStatic) a.vel.z -= j*a.invMass; if(!b.isStatic) b.vel.z += j*b.invMass; }
    }
  }

  raycast(origin:Vec3, dir:Vec3, maxDist=200){
    // brute against AABBs
    let closest: {body:Body, dist:number, point:Vec3}|null=null;
    const invDir = new Vec3(1/(dir.x||1e-6), 1/(dir.y||1e-6), 1/(dir.z||1e-6));
    for(const b of this.bodies){
      const aabb=b.aabb;
      let tmin=(aabb.min.x-origin.x)*invDir.x, tmax=(aabb.max.x-origin.x)*invDir.x;
      if(tmin>tmax) [tmin,tmax]=[tmax,tmin];
      let tymin=(aabb.min.y-origin.y)*invDir.y, tymax=(aabb.max.y-origin.y)*invDir.y;
      if(tymin>tymax) [tymin,tymax]=[tymax,tymin];
      if(tmin>tymax||tymin>tmax) continue;
      tmin=Math.max(tmin,tymin); tmax=Math.min(tmax,tymax);
      let tzmin=(aabb.min.z-origin.z)*invDir.z, tzmax=(aabb.max.z-origin.z)*invDir.z;
      if(tzmin>tzmax) [tzmin,tzmax]=[tzmax,tzmin];
      if(tmin>tzmax||tzmin>tmax) continue;
      tmin=Math.max(tmin,tzmin); tmax=Math.min(tmax,tzmax);
      if(tmin<0||tmin>maxDist) continue;
      if(!closest || tmin<closest.dist){
        closest={body:b, dist:tmin, point:new Vec3(origin.x+dir.x*tmin, origin.y+dir.y*tmin, origin.z+dir.z*tmin)}
      }
    }
    return closest;
  }
}
