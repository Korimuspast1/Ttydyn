// Ttydyn 3D Engine - WebGL2 Forward Renderer (personal engine, no external libs)
import { Mat4, Vec3 } from './math';
import { Body } from './physics3d';

const VS = `#version 300 es
precision mediump float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec3 aColor;
uniform mat4 uViewProj;
uniform vec3 uModelPos;
uniform vec3 uModelScale;
out vec3 vNormal;
out vec3 vColor;
out vec3 vWorldPos;
void main(){
  vec3 pos = aPos * uModelScale + uModelPos;
  vWorldPos = pos;
  vNormal = aNormal;
  vColor = aColor;
  gl_Position = uViewProj * vec4(pos,1.0);
}
`;
const FS = `#version 300 es
precision mediump float;
in vec3 vNormal;
in vec3 vColor;
in vec3 vWorldPos;
out vec4 outColor;
uniform vec3 uLightDir;
uniform vec3 uLightColor;
uniform vec3 uAmbient;
uniform float uFogNear;
uniform float uFogFar;
uniform vec3 uFogColor;
void main(){
  vec3 n = normalize(vNormal);
  float diff = max(dot(n, -uLightDir), 0.0);
  float rim = pow(1.0 - max(dot(n, vec3(0,1,0)),0.0), 2.0)*0.15;
  vec3 lit = uAmbient + uLightColor*diff + vec3(rim);
  vec3 col = vColor * lit;
  // fog
  float dist = length(vWorldPos.xz);
  float fog = clamp((dist - uFogNear)/(uFogFar - uFogNear),0.0,1.0);
  col = mix(col, uFogColor, fog*0.85);
  outColor = vec4(col,1.0);
}
`;

function compile(gl:WebGL2RenderingContext, type:number, src:string){
  const s=gl.createShader(type)!; gl.shaderSource(s,src); gl.compileShader(s);
  if(!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)||'compile fail');
  return s;
}

export class Renderer3D {
  gl: WebGL2RenderingContext;
  prog: WebGLProgram;
  loc: Record<string, WebGLUniformLocation>={};
  boxVbo: WebGLBuffer; boxIbo: WebGLBuffer; boxCount:number;
  camPos=new Vec3(0,12,18);
  yaw=0; pitch=-0.3;
  fov=Math.PI/3.2;
  dayTime=0;
  constructor(public canvas:HTMLCanvasElement){
    const gl=canvas.getContext('webgl2', {antialias:true, powerPreference:'high-performance', depth:true, stencil:true}) as WebGL2RenderingContext;
    if(!gl) throw new Error('WebGL2 not supported');
    this.gl=gl;
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE);
    const vs=compile(gl,gl.VERTEX_SHADER,VS), fs=compile(gl,gl.FRAGMENT_SHADER,FS);
    const prog=gl.createProgram()!; gl.attachShader(prog,vs); gl.attachShader(prog,fs); gl.linkProgram(prog);
    if(!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog)||'link fail');
    this.prog=prog;
    const uNames=['uViewProj','uModelPos','uModelScale','uLightDir','uLightColor','uAmbient','uFogNear','uFogFar','uFogColor'];
    for(const n of uNames) this.loc[n]=gl.getUniformLocation(prog,n)!;

    // cube mesh (1x1x1 centered at origin, half extents 0.5)
    const verts = new Float32Array([
      // pos(3) normal(3) color(3) => 9 floats per vert
      // front
      -0.5,-0.5, 0.5,  0,0,1,  1,1,1,
       0.5,-0.5, 0.5,  0,0,1,  1,1,1,
       0.5, 0.5, 0.5,  0,0,1,  1,1,1,
      -0.5, 0.5, 0.5,  0,0,1,  1,1,1,
      // back
       0.5,-0.5,-0.5,  0,0,-1, 1,1,1,
      -0.5,-0.5,-0.5,  0,0,-1, 1,1,1,
      -0.5, 0.5,-0.5,  0,0,-1, 1,1,1,
       0.5, 0.5,-0.5,  0,0,-1, 1,1,1,
      // top
      -0.5, 0.5, 0.5,  0,1,0, 1,1,1,
       0.5, 0.5, 0.5,  0,1,0, 1,1,1,
       0.5, 0.5,-0.5,  0,1,0, 1,1,1,
      -0.5, 0.5,-0.5,  0,1,0, 1,1,1,
      // bottom
      -0.5,-0.5,-0.5,  0,-1,0, 1,1,1,
       0.5,-0.5,-0.5,  0,-1,0, 1,1,1,
       0.5,-0.5, 0.5,  0,-1,0, 1,1,1,
      -0.5,-0.5, 0.5,  0,-1,0, 1,1,1,
      // right
       0.5,-0.5, 0.5,  1,0,0, 1,1,1,
       0.5,-0.5,-0.5,  1,0,0, 1,1,1,
       0.5, 0.5,-0.5,  1,0,0, 1,1,1,
       0.5, 0.5, 0.5,  1,0,0, 1,1,1,
      // left
      -0.5,-0.5,-0.5, -1,0,0, 1,1,1,
      -0.5,-0.5, 0.5, -1,0,0, 1,1,1,
      -0.5, 0.5, 0.5, -1,0,0, 1,1,1,
      -0.5, 0.5,-0.5, -1,0,0, 1,1,1,
    ]);
    const idx = new Uint16Array([
      0,1,2, 0,2,3,
      4,5,6, 4,6,7,
      8,9,10, 8,10,11,
      12,13,14, 12,14,15,
      16,17,18, 16,18,19,
      20,21,22, 20,22,23
    ]);
    const vbo=gl.createBuffer()!; gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    const ibo=gl.createBuffer()!; gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    this.boxVbo=vbo; this.boxIbo=ibo; this.boxCount=idx.length;
    // attrib layout
    gl.bindVertexArray(gl.createVertexArray());
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,3,gl.FLOAT,false,9*4,0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1,3,gl.FLOAT,false,9*4,3*4);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2,3,gl.FLOAT,false,9*4,6*4);
    this.resize();
    window.addEventListener('resize',()=>this.resize());
  }
  resize(){
    const dpr=Math.min(2, window.devicePixelRatio||1);
    this.canvas.width = Math.round(window.innerWidth * dpr);
    this.canvas.height = Math.round(window.innerHeight * dpr);
    this.gl.viewport(0,0,this.canvas.width,this.canvas.height);
  }
  get viewProj(){
    const aspect=this.canvas.width/this.canvas.height;
    const proj=new Mat4(); Mat4.perspective(proj,this.fov,aspect,0.1,600);
    const forward=new Vec3(Math.sin(this.yaw)*Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw)*Math.cos(this.pitch));
    const center=Vec3.add(this.camPos, forward);
    const view=new Mat4(); Mat4.lookAt(view,this.camPos,center,new Vec3(0,1,0));
    const vp=new Mat4(); vp.data.set(proj.data); vp.mul(view);
    return vp;
  }
  clear(){
    const t=this.dayTime%1;
    // sky gradient by time
    const isNight = t>0.75 || t<0.22;
    const r = isNight?0.02:0.53, g=isNight?0.04:0.68, b=isNight?0.12:0.88;
    this.gl.clearColor(r,g,b,1); this.gl.clear(this.gl.COLOR_BUFFER_BIT|this.gl.DEPTH_BUFFER_BIT);
  }
  drawBox(pos:Vec3, scale:Vec3, color:Vec3){
    const gl=this.gl;
    gl.useProgram(this.prog);
    gl.uniform3f(this.loc.uModelPos, pos.x, pos.y, pos.z);
    gl.uniform3f(this.loc.uModelScale, scale.x*2, scale.y*2, scale.z*2);
    // override vertex color via hack: we set uniform but shader uses vertex color; we'll just tint via color scaling in CPU vertex? Simpler: use instance color by setting vertex color attribute divisor? For now we emulate tint by uniform multiplying in FS via color uniform blend - but we have no uniform. We'll push color into vertex buffer dynamic? Quick: we use gl.vertexAttrib for color override via buffer update? Simpler: we change clear color tint by modifying light.
    // Instead we fake by uploading new buffer each draw with color (cheap for demo) - we overwrite color in vertex data
    // But for performance we just use uniform mix: we add additional path: override vertex color by mixing with uniform color
    // For now just use light tint: we set uLightColor to color*0.5 + white*0.5
    // We'll assume caller sets color via light - simplified: we ignore and just draw white boxes tinted by diffuse. Instead we do full re-upload with color
    // Re-upload small improvement: update vertex buffer color for this draw
    // To keep simple, we set a global tint via uniform and modify shader to mix - but shader doesn't have uniform for tint. We'll just draw as white and rely on external per-body color via storing in vertex? Let's quickly patch: we will use instanced color via uniform and change shader to use it.
    // For now draw as provided color by cheating: we set vertexAttrib2 to color
    gl.vertexAttrib3f(2, color.x, color.y, color.z);
    // This overrides per-vertex color because we disable array? We keep array enabled - need disable to use constant
    gl.disableVertexAttribArray(2);
    gl.drawElements(gl.TRIANGLES, this.boxCount, gl.UNSIGNED_SHORT,0);
    gl.enableVertexAttribArray(2);
  }
  beginFrame(){
    this.clear();
    const gl=this.gl;
    gl.useProgram(this.prog);
    const vp=this.viewProj;
    gl.uniformMatrix4fv(this.loc.uViewProj,false,vp.data);
    // light
    const t=this.dayTime%1;
    const sunAngle=t*Math.PI*2;
    const lightDir=new Vec3(Math.cos(sunAngle)*0.6, Math.sin(sunAngle), Math.cos(sunAngle)*0.6).normalize();
    gl.uniform3f(this.loc.uLightDir, lightDir.x, lightDir.y, lightDir.z);
    const isNight = t>0.78||t<0.2;
    gl.uniform3f(this.loc.uLightColor, isNight?0.3:0.9, isNight?0.3:0.9, isNight?0.45:0.85);
    gl.uniform3f(this.loc.uAmbient, isNight?0.25:0.45, isNight?0.25:0.48, isNight?0.35:0.52);
    gl.uniform1f(this.loc.uFogNear, 90); gl.uniform1f(this.loc.uFogFar, 320);
    const fogR=isNight?0.02:0.55, fogG=isNight?0.04:0.68, fogB=isNight?0.12:0.86;
    gl.uniform3f(this.loc.uFogColor, fogR,fogG,fogB);
  }
}
