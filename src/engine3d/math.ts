// Ttydyn 3D Engine - Math core (Vec3, Mat4, Quat)
export class Vec3 {
  constructor(public x=0, public y=0, public z=0){}
  clone(){ return new Vec3(this.x,this.y,this.z)}
  set(x:number,y:number,z:number){ this.x=x; this.y=y; this.z=z; return this}
  add(v:Vec3){ this.x+=v.x; this.y+=v.y; this.z+=v.z; return this}
  sub(v:Vec3){ this.x-=v.x; this.y-=v.y; this.z-=v.z; return this}
  scale(s:number){ this.x*=s; this.y*=s; this.z*=s; return this}
  dot(v:Vec3){ return this.x*v.x+this.y*v.y+this.z*v.z }
  cross(v:Vec3){ return new Vec3(this.y*v.z-this.z*v.y, this.z*v.x-this.x*v.z, this.x*v.y-this.y*v.x) }
  length(){ return Math.hypot(this.x,this.y,this.z)}
  normalize(){ const l=this.length()||1; this.x/=l; this.y/=l; this.z/=l; return this}
  static add(a:Vec3,b:Vec3){ return new Vec3(a.x+b.x,a.y+b.y,a.z+b.z)}
  static sub(a:Vec3,b:Vec3){ return new Vec3(a.x-b.x,a.y-b.y,a.z-b.z)}
  static lerp(a:Vec3,b:Vec3,t:number){ return new Vec3(a.x+(b.x-a.x)*t, a.y+(b.y-a.y)*t, a.z+(b.z-a.z)*t)}
}
export class Mat4 {
  data: Float32Array;
  constructor(){ this.data=new Float32Array(16); this.identity()}
  identity(){
    const d=this.data; d[0]=1; d[1]=0; d[2]=0; d[3]=0;
    d[4]=0; d[5]=1; d[6]=0; d[7]=0;
    d[8]=0; d[9]=0; d[10]=1; d[11]=0;
    d[12]=0; d[13]=0; d[14]=0; d[15]=1; return this
  }
  static perspective(out:Mat4,fov:number,aspects:number,near:number,far:number){
    const f=1/Math.tan(fov/2), d=out.data; d[0]=f/aspects; d[1]=0; d[2]=0; d[3]=0; d[4]=0; d[5]=f; d[6]=0; d[7]=0; d[8]=0; d[9]=0; d[10]=(far+near)/(near-far); d[11]=-1; d[12]=0; d[13]=0; d[14]=2*far*near/(near-far); d[15]=0; return out
  }
  static lookAt(out:Mat4, eye:Vec3, center:Vec3, up:Vec3){
    const f=Vec3.sub(center,eye).normalize(), s=f.cross(up).normalize(), u=s.cross(f);
    const d=out.data;
    d[0]=s.x; d[1]=u.x; d[2]=-f.x; d[3]=0;
    d[4]=s.y; d[5]=u.y; d[6]=-f.y; d[7]=0;
    d[8]=s.z; d[9]=u.z; d[10]=-f.z; d[11]=0;
    d[12]=-s.dot(eye); d[13]=-u.dot(eye); d[14]=f.dot(eye); d[15]=1; return out
  }
  mul(b:Mat4){
    const a=this.data, bd=b.data, r=new Float32Array(16);
    for(let i=0;i<4;i++) for(let j=0;j<4;j++){
      r[j*4+i]=a[0*4+i]*bd[j*4+0]+a[1*4+i]*bd[j*4+1]+a[2*4+i]*bd[j*4+2]+a[3*4+i]*bd[j*4+3]
    }
    this.data=r; return this
  }
}
