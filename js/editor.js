/**
 * editor.js — Pixel-by-pixel design editor.
 * Draw projectiles/targets cell-by-cell from any of the 84 materials.
 * Tools: pencil, eraser, fill, line, rectangle. Mirror X/Y, outline,
 * material swap, undo/redo, import/export (portable JSON design files).
 */
import { MATERIALS } from "./materials.js";
import { makeGrid } from "./library.js";

export class Editor {
  constructor(canvas, onChange){
    this.cv=canvas; this.ctx=canvas.getContext("2d");
    this.onChange=onChange||(()=>{});
    this.newDesign(40,24);
    this.tool="pencil"; this.mat=0; this.mirrorX=false; this.mirrorY=false;
    this.undoStack=[]; this.redoStack=[]; this.drawing=false; this.start=null;
    canvas.addEventListener("pointerdown",e=>{ this.pushUndo(); this.drawing=true; this.start=this.cell(e); this.apply(e); canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener("pointermove",e=>{ if(this.drawing) this.apply(e); });
    canvas.addEventListener("pointerup",e=>{ if(this.drawing && (this.tool==="line"||this.tool==="rect")) this.finishShape(e); this.drawing=false; this.start=null; this.render(); this.onChange(this.grid); });
  }
  newDesign(w=40,h=24){ this.grid=makeGrid(w,h); this.grid.name="Custom Design"; this.undoStack=[]; this.redoStack=[]; this.render(); this.onChange(this.grid); }
  loadDesign(grid){ this.grid=grid; this.undoStack=[]; this.render(); this.onChange(this.grid); }
  pushUndo(){ this.undoStack.push(Int16Array.from(this.grid.cells)); if(this.undoStack.length>60)this.undoStack.shift(); this.redoStack=[]; }
  undo(){ if(!this.undoStack.length)return; this.redoStack.push(Int16Array.from(this.grid.cells)); this.grid.cells.set(this.undoStack.pop()); this.render(); this.onChange(this.grid); }
  redo(){ if(!this.redoStack.length)return; this.undoStack.push(Int16Array.from(this.grid.cells)); this.grid.cells.set(this.redoStack.pop()); this.render(); this.onChange(this.grid); }
  cell(e){ const r=this.cv.getBoundingClientRect(); const cs=this.cv.width/this.grid.w;
    return { x:Math.floor((e.clientX-r.left)/r.width*this.grid.w), y:Math.floor((e.clientY-r.top)/r.height*this.grid.h), cs }; }
  cellsFor(x,y){ const pts=[[x,y]]; if(this.mirrorX)pts.push([this.grid.w-1-x,y]); if(this.mirrorY)pts.push([x,this.grid.h-1-y]); if(this.mirrorX&&this.mirrorY)pts.push([this.grid.w-1-x,this.grid.h-1-y]); return pts; }
  paint(x,y){ for(const [a,b] of this.cellsFor(x,y)) this.grid.set(a,b, this.tool==="eraser"?-1:this.mat); }
  apply(e){
    const {x,y}=this.cell(e); if(x<0||y<0||x>=this.grid.w||y>=this.grid.h) return;
    if(this.tool==="pencil"||this.tool==="eraser") this.paint(x,y);
    else if(this.tool==="fill"){ const target=this.grid.get(x,y); if(target!==this.mat) this.flood(x,y,target,this.mat); }
    this.render();
  }
  finishShape(e){
    const {x,y}=this.cell(e), s=this.start; if(!s) return;
    if(this.tool==="line"){ const n=Math.max(Math.abs(x-s.x),Math.abs(y-s.y),1); for(let i=0;i<=n;i++) this.paint(Math.round(s.x+(x-s.x)*i/n), Math.round(s.y+(y-s.y)*i/n)); }
    if(this.tool==="rect"){ for(let yy=Math.min(y,s.y);yy<=Math.max(y,s.y);yy++)for(let xx=Math.min(x,s.x);xx<=Math.max(x,s.x);xx++) this.paint(xx,yy); }
  }
  flood(x,y,target,repl){ const st=[[x,y]]; while(st.length){ const [a,b]=st.pop(); if(this.grid.get(a,b)!==target)continue; this.grid.set(a,b,repl); st.push([a+1,b],[a-1,b],[a,b+1],[a,b-1]); } }
  outline(m){ this.pushUndo(); const src=Int16Array.from(this.grid.cells);
    for(let y=0;y<this.grid.h;y++)for(let x=0;x<this.grid.w;x++){ if(src[y*this.grid.w+x]>=0) continue;
      const near=[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>{ const xx=x+dx,yy=y+dy; return xx>=0&&yy>=0&&xx<this.grid.w&&yy<this.grid.h&&src[yy*this.grid.w+xx]>=0; });
      if(near) this.grid.set(x,y,m); } this.render(); this.onChange(this.grid); }
  swap(from,to){ this.pushUndo(); for(let i=0;i<this.grid.cells.length;i++) if(this.grid.cells[i]===from)this.grid.cells[i]=to; this.render(); this.onChange(this.grid); }
  clear(){ this.pushUndo(); this.grid.cells.fill(-1); this.render(); this.onChange(this.grid); }
  exportJSON(){ return JSON.stringify({app:"ttydyn-design",name:this.grid.name,w:this.grid.w,h:this.grid.h,cells:Array.from(this.grid.cells)}); }
  importJSON(txt){ const d=JSON.parse(txt); const g=makeGrid(d.w,d.h); g.cells.set(d.cells); g.name=d.name||"Imported Design"; this.loadDesign(g); return g; }
  render(){
    const {ctx,cv,grid}=this; if(!ctx) return;
    const cw=cv.width/grid.w, ch=cv.height/grid.h;
    ctx.fillStyle="#14161c"; ctx.fillRect(0,0,cv.width,cv.height);
    for(let y=0;y<grid.h;y++)for(let x=0;x<grid.w;x++){ const m=grid.get(x,y);
      ctx.fillStyle= m<0 ? ((x+y)%2? "#191c24":"#1d2029") : `rgb(${MATERIALS[m].color.join(",")})`;
      ctx.fillRect(x*cw,y*ch,cw,ch); }
    ctx.strokeStyle="rgba(255,255,255,.07)";
    for(let x=0;x<=grid.w;x++){ ctx.beginPath(); ctx.moveTo(x*cw,0); ctx.lineTo(x*cw,cv.height); ctx.stroke(); }
    for(let y=0;y<=grid.h;y++){ ctx.beginPath(); ctx.moveTo(0,y*ch); ctx.lineTo(cv.width,y*ch); ctx.stroke(); }
    if(this.mirrorY){ ctx.strokeStyle="#ffd23f"; ctx.beginPath(); ctx.moveTo(0,cv.height/2); ctx.lineTo(cv.width,cv.height/2); ctx.stroke(); }
    if(this.mirrorX){ ctx.strokeStyle="#ffd23f"; ctx.beginPath(); ctx.moveTo(cv.width/2,0); ctx.lineTo(cv.width/2,cv.height); ctx.stroke(); }
  }
}
