/**
 * main.js — Entry point: game loop, rendering, camera, GUI wiring.
 * Fixed-timestep simulation (Sim.tick) is decoupled from rAF rendering.
 * Rendering draws each particle as crisp pixels on a 640x360 buffer,
 * CSS-scaled with nearest-neighbour (strict pixel art, no AA).
 */
import { MATERIALS, matColor } from "./materials.js";
import { PROJECTILES, TARGETS, EXPERIMENTS, findByName, LIBRARY_COUNTS } from "./library.js";
import { Sim, SPACING } from "./physics.js";
import { Editor } from "./editor.js";

const $=id=>document.getElementById(id);
const cv=$("game"), ctx=cv.getContext("2d");
const sim=new Sim();
let projSel=PROJECTILES[0], targSel=TARGETS.find(t=>t.name==="Plate · RHA Steel ×8")||TARGETS[0];
let customProj=null, customTarg=null;
let paused=false, fired=false, projIds=null, targetBackX=0, targetDepthPx=0;
let cam={x:0,y:0,z:1}, frames=0, fps=60, lastT=performance.now(), acc=0;
const VELOCITY_SCALE=0.30; // m/s -> world px/s (tuned so penalty contacts can arrest soft projectiles)
const MM_PER_PX=4;         // display scale: 1 world px ≈ 4 mm at plate scale

/* ---------------- scene ---------------- */
function resetScene(){
  sim.clear(); fired=false; projIds=null;
  const g=targSel.grid;
  const cy=334-g.h*SPACING/2;
  sim.spawnGrid(g, 452, cy, 0,0,false);
  targetDepthPx=g.w*SPACING; targetBackX=452+g.w*SPACING/2;
  updateOutcome("READY — press FIRE");
}
function fire(){
  if(projIds) for(const id of projIds) if(id>=0) sim.alive[id]=0;
  const pg=(customProj||projSel.grid), tg=targSel.grid;
  const v=+$("velSlider").value*VELOCITY_SCALE, a=+$("angSlider").value*Math.PI/180;
  const cy=334-tg.h*SPACING/2;
  // ballistic aim compensation: arc the shot onto the target centre at this range
  const vx=Math.cos(a)*v, tFlight=Math.max(.1,(sim.targetFrontX-78)/Math.max(60,vx));
  const vy=-Math.sin(a)*v - .5*sim.gravity*tFlight;
  projIds=sim.spawnGrid(pg, 78, cy, vx, vy, true);
  fired=true; paused=false; $("pauseBtn").textContent="⏸ PAUSE";
  updateOutcome("IN FLIGHT…");
}
function updateOutcome(t){ $("statOutcome").textContent=t; }
function evaluateOutcome(){
  if(!fired) return;
  const s=sim.stats();
  const penMM=Math.round(s.maxPenPx*MM_PER_PX);
  if(s.maxPenPx>targetDepthPx && s.projAlive>0) updateOutcome(`⛏ PERFORATION — rod exited the back face (pen ${penMM} mm, ${s.detonations} detonation${s.detonations===1?"":"s"})`);
  else if(s.detonations>0) updateOutcome(`💥 DETONATION ×${s.detonations} — ${s.maxPenPx>targetDepthPx*.6?"deep penetration + blast damage":"blast / cook-off, plate not perforated"} (pen ${penMM} mm)`);
  else if(s.maxPenPx>targetDepthPx*.75) updateOutcome(`◐ NEAR-PERFORATION — bulge / spall at back face (pen ${penMM} mm)`);
  else if(s.maxPenPx>4) updateOutcome(`◔ PARTIAL PENETRATION — ${penMM} mm, projectile arrested/eroded`);
  else if(sim.time>1) updateOutcome("■ STOPPED — no significant penetration");
}

/* ---------------- rendering ---------------- */
function particleColor(i){
  const mode=$("overlaySel").value, id=sim.mat[i], t=sim.temp[i];
  if(mode==="temp"){ const k=Math.min(1,t/1600); return [255*k|0, 90*k|0, 30*(1-k)|0]; }
  if(mode==="damage"){ const d=Math.min(1,sim.dmg[i]); return [60+d*195|0, 60*(1-d)|0, 60*(1-d)|0]; }
  if(mode==="velocity"){ const v=Math.min(1,Math.hypot(sim.vx[i],sim.vy[i])/1400); return [40+v*215|0, 120*(1-v)|0, 255*(1-v)|0]; }
  let c=matColor(id,t,sim.state[i]);
  if(sim.debris[i]) c=[c[0]*.75|0,c[1]*.75|0,c[2]*.75|0];
  return c;
}
function render(){
  ctx.setTransform(1,0,0,1,0,0);
  const grd=ctx.createLinearGradient(0,0,0,360); grd.addColorStop(0,"#11151f"); grd.addColorStop(1,"#1a1d24");
  ctx.fillStyle=grd; ctx.fillRect(0,0,640,360);
  ctx.setTransform(cam.z,0,0,cam.z, cam.x, cam.y);
  // backdrop grid + range markers
  ctx.strokeStyle="rgba(255,255,255,.05)"; ctx.lineWidth=1/cam.z;
  for(let x=0;x<=640;x+=32){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,336); ctx.stroke(); }
  ctx.fillStyle="#262a20"; ctx.fillRect(-200,336,1100,24);
  ctx.fillStyle="#3a4030"; for(let x=-200;x<900;x+=16) ctx.fillRect(x,336,8,3);
  ctx.strokeStyle="#ffd23f66"; ctx.beginPath(); ctx.moveTo(78,40); ctx.lineTo(78,330); ctx.stroke(); // muzzle line
  // ghost of staged projectile
  if(!fired){ const pg=(customProj||projSel.grid), tg=targSel.grid, cy=334-tg.h*SPACING/2;
    ctx.globalAlpha=.45;
    for(let y=0;y<pg.h;y++)for(let x=0;x<pg.w;x++){ const m=pg.cells[y*pg.w+x]; if(m<0)continue;
      ctx.fillStyle=`rgb(${MATERIALS[m].color.join(",")})`;
      ctx.fillRect(78-pg.w*SPACING/2+x*SPACING, cy-pg.h*SPACING/2+y*SPACING, SPACING-0.4, SPACING-0.4); }
    ctx.globalAlpha=1; }
  const mode=$("overlaySel").value, s=Math.max(1.6,SPACING-0.35);
  if(mode==="bonds"){ ctx.strokeStyle="rgba(140,180,255,.35)"; ctx.lineWidth=.6; ctx.beginPath();
    for(let b=0;b<sim.nb;b++){ if(!sim.balive[b])continue; const a=sim.ba[b],c=sim.bb[b];
      ctx.moveTo(sim.px[a],sim.py[a]); ctx.lineTo(sim.px[c],sim.py[c]); } ctx.stroke(); }
  for(let i=0;i<sim.n;i++){ if(!sim.alive[i])continue;
    const c=particleColor(i); ctx.fillStyle=`rgb(${c[0]},${c[1]},${c[2]})`;
    const sz=sim.state[i]===2? s*1.7 : s;
    ctx.fillRect(sim.px[i]-sz/2, sim.py[i]-sz/2, sz, sz);
    if(sim.temp[i]>700){ ctx.fillStyle="rgba(255,170,40,.35)"; ctx.fillRect(sim.px[i]-sz, sim.py[i]-sz, sz*2, sz*2); } }
  ctx.setTransform(1,0,0,1,0,0);
}
function loop(now){
  requestAnimationFrame(loop);
  const dtMs=now-lastT; lastT=now; fps=fps*.95+(1000/Math.max(1,dtMs))*.05;
  sim.gravity=$("gravityChk").checked?300:0;
  if(!paused){ const speed=+$("speedSel").value; acc+=speed;
    while(acc>=1){ sim.tick(1); acc-=1; } }
  if($("followChk").checked && projIds){ let sx=0,sy=0,n=0;
    for(const id of projIds) if(id>=0&&sim.alive[id]){ sx+=sim.px[id]; sy+=sim.py[id]; n++; }
    if(n){ cam.x=320-(sx/n)*cam.z; cam.y=190-(sy/n)*cam.z; } }
  render(); evaluateOutcome();
  if(frames%12===0){ const s=sim.stats();
    $("statFps").textContent=`FPS ${fps|0} · tick 60Hz · substeps adaptive`;
    $("statParts").textContent=`particles ${s.alive}/${s.particles}`;
    $("statBonds").textContent=`bonds broken ${s.brokenBonds} · detonations ${s.detonations}`;
    $("statPen").textContent=`penetration ${Math.round(s.maxPenPx*MM_PER_PX)} mm`;
    $("footStats").textContent=`${s.alive} live particles · ${sim.nb} bonds · sim t=${sim.time.toFixed(2)}s`; }
  frames++;
}

/* ---------------- library UI ---------------- */
function fillList(el, items, sel, onPick){
  el.innerHTML="";
  for(const it of items){ const b=document.createElement("button"); b.textContent=it.name;
    if(it===sel) b.className="sel";
    b.onclick=()=>{ onPick(it); }; el.appendChild(b); }
}
function matSummary(grid){
  const counts=new Map(); for(const c of grid.cells) if(c>=0) counts.set(c,(counts.get(c)||0)+1);
  return [...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,4).map(([id,n])=>`${MATERIALS[id].name} ×${n}`).join(", ");
}
function refreshLists(){
  const pq=$("projSearch").value.toLowerCase(), tq=$("targSearch").value.toLowerCase(), f=$("targetFilter").value;
  fillList($("projList"), PROJECTILES.filter(p=>p.name.toLowerCase().includes(pq)), projSel, it=>{ projSel=it; customProj=null; refreshLists(); resetScene(); });
  fillList($("targList"), TARGETS.filter(t=>(f==="all"||t.kind===f)&&t.name.toLowerCase().includes(tq)), targSel, it=>{ targSel=it; customTarg=null; refreshLists(); resetScene(); });
  $("projInfo").textContent=`${projSel.name}\n${projSel.grid.w}×${projSel.grid.h} cells · ${projSel.grid.count()} particles\n${matSummary(projSel.grid)}`;
  $("targInfo").textContent=`${targSel.name}\n${targSel.grid.w}×${targSel.grid.h} cells · ${targSel.grid.count()} particles\n${matSummary(targSel.grid)}`;
  refreshDesigns();
}
function refreshDesigns(){
  const saved=JSON.parse(localStorage.getItem("ttydyn-designs")||"[]");
  const el=$("designList"); el.innerHTML=saved.length?"":"<div class='info'>No saved designs yet — draw one in the Editor.</div>";
  for(const d of saved){ const b=document.createElement("button"); b.textContent="✎ "+d.name;
    b.onclick=()=>{ editor.importJSON(JSON.stringify(d)); showEditor(); }; el.appendChild(b); }
}

/* ---------------- experiments ---------------- */
function loadExperiment(exp){
  projSel=findByName(PROJECTILES, exp.projectile); targSel=findByName(TARGETS, exp.target);
  customProj=customTarg=null;
  $("velSlider").value=exp.velocity; $("angSlider").value=exp.angle||0; syncSliders();
  refreshLists(); resetScene();
}

/* ---------------- editor ---------------- */
const editor=new Editor($("editorCanvas"), g=>{
  $("editorStat").textContent=`${g.name} — ${g.w}×${g.h} · ${g.count()} filled cells · material: ${MATERIALS[editor.mat].name}`;
});
function buildPalette(){
  const q=$("matSearch").value.toLowerCase(); const el=$("palette"); el.innerHTML="";
  MATERIALS.forEach((m,i)=>{ if(q && !m.name.toLowerCase().includes(q)) return;
    const b=document.createElement("button"); b.style.background=`rgb(${m.color.join(",")})`; b.title=`${m.name} (${m.cat})`;
    if(i===editor.mat) b.className="sel";
    b.onclick=()=>{ editor.mat=i; buildPalette(); showMatInfo(i); }; el.appendChild(b); });
}
function showMatInfo(i){
  const m=MATERIALS[i];
  const txt=`${m.name} [${m.cat}]\ndensity ${m.density} kg/m³ · strength ${m.strength} MPa · hardness ${m.hardness}\nmelt ${m.melt}°C · boil ${m.boil}°C · ${m.brittle>.7?"brittle (shatters)":m.brittle>.35?"semi-ductile":"ductile (deforms)"}${m.detEnergy?`\n⚠ ENERGETIC: ${m.detEnergy} MJ/kg, ignites ~${m.ignite}°C`:""}`;
  $("matInfo").textContent=txt; $("paletteInfo").textContent=txt;
}
function showEditor(){ $("simView").hidden=true; $("editorView").hidden=false; $("tabEditor").classList.add("active"); $("tabSim").classList.remove("active"); editor.render(); }
function showSim(){ $("editorView").hidden=true; $("simView").hidden=false; $("tabSim").classList.add("active"); $("tabEditor").classList.remove("active"); }

/* ---------------- wiring ---------------- */
function syncSliders(){ $("velVal").textContent=`${$("velSlider").value} m/s`; $("angVal").textContent=`${$("angSlider").value}°`; }
$("velSlider").oninput=syncSliders; $("angSlider").oninput=syncSliders;
$("fireBtn").onclick=fire;
$("resetBtn").onclick=()=>{ customProj=null; resetScene(); };
$("pauseBtn").onclick=()=>{ paused=!paused; $("pauseBtn").textContent=paused?"▶ PLAY":"⏸ PAUSE"; };
$("camBtn").onclick=()=>{ cam={x:0,y:0,z:1}; $("followChk").checked=false; };
$("shotBtn").onclick=()=>{ const a=document.createElement("a"); a.download="ttydyn-impact.png"; a.href=cv.toDataURL("image/png"); a.click(); };
$("projSearch").oninput=refreshLists; $("targSearch").oninput=refreshLists; $("targetFilter").onchange=refreshLists;
$("matSearch").oninput=buildPalette;
$("tabEditor").onclick=showEditor; $("tabSim").onclick=showSim;
const expSel=$("experimentSel");
EXPERIMENTS.forEach((e,i)=>{ const o=document.createElement("option"); o.value=i; o.textContent=e.name; expSel.appendChild(o); });
$("loadExp").onclick=()=>loadExperiment(EXPERIMENTS[+expSel.value]);
document.querySelectorAll(".tool").forEach(b=>b.onclick=()=>{ editor.tool=b.dataset.tool; document.querySelectorAll(".tool").forEach(x=>x.classList.toggle("active",x===b)); });
$("mirrorX").onchange=e=>{ editor.mirrorX=e.target.checked; editor.render(); };
$("mirrorY").onchange=e=>{ editor.mirrorY=e.target.checked; editor.render(); };
$("newDesign").onclick=()=>editor.newDesign(40,24);
$("clearDesign").onclick=()=>editor.clear();
$("undoBtn").onclick=()=>editor.undo(); $("redoBtn").onclick=()=>editor.redo();
$("outlineBtn").onclick=()=>editor.outline(editor.mat);
$("swapBtn").onclick=()=>{ const from=editor.grid.cells.find(c=>c>=0); if(from!==undefined) editor.swap(from, editor.mat); };
$("designName").oninput=e=>{ editor.grid.name=e.target.value; };
$("saveDesign").onclick=()=>{ const saved=JSON.parse(localStorage.getItem("ttydyn-designs")||"[]");
  const d=JSON.parse(editor.exportJSON()); d.name=$("designName").value||d.name;
  saved.push(d); localStorage.setItem("ttydyn-designs", JSON.stringify(saved)); refreshDesigns(); alert(`Saved "${d.name}" (${d.w}×${d.h})`); };
$("exportDesign").onclick=()=>{ const blob=new Blob([editor.exportJSON()],{type:"application/json"}); const a=document.createElement("a");
  a.href=URL.createObjectURL(blob); a.download=($("designName").value||"design")+".json"; a.click(); };
$("importDesign").onclick=()=>$("importFile").click();
$("importFile").onchange=e=>{ const f=e.target.files[0]; if(!f)return; f.text().then(t=>{ try{ editor.importJSON(t); }catch(err){ alert("Invalid design file: "+err.message); } }); };
$("useAsProj").onclick=()=>{ customProj=editor.grid; projSel={name:"Custom: "+editor.grid.name, grid:editor.grid}; showSim(); resetScene(); };
$("useAsTarg").onclick=()=>{ customTarg=editor.grid; targSel={name:"Custom: "+editor.grid.name, grid:editor.grid, kind:"target"}; showSim(); resetScene(); };
// camera: wheel zoom (stepped, pixel-crisp) + pan
cv.addEventListener("wheel",e=>{ e.preventDefault(); cam.z=Math.min(4,Math.max(1, cam.z+(e.deltaY<0?.5:-.5))); },{passive:false});
let panning=null;
cv.addEventListener("pointerdown",e=>{ if(e.button===2||e.shiftKey) panning={x:e.clientX,y:e.clientY}; });
window.addEventListener("pointermove",e=>{ if(panning){ cam.x+=e.clientX-panning.x; cam.y+=e.clientY-panning.y; panning={x:e.clientX,y:e.clientY}; }
  // material inspection tooltip
  const r=cv.getBoundingClientRect();
  const wx=((e.clientX-r.left)/r.width*640-cam.x)/cam.z, wy=((e.clientY-r.top)/r.height*360-cam.y)/cam.z;
  let best=-1,bd=1e9; for(let i=0;i<sim.n;i++){ if(!sim.alive[i])continue; const d=(sim.px[i]-wx)**2+(sim.py[i]-wy)**2; if(d<bd){bd=d;best=i;} }
  const tip=$("tooltip");
  if(best>=0&&bd<64){ const m=MATERIALS[sim.mat[best]];
    tip.style.display="block"; tip.style.left=e.clientX+14+"px"; tip.style.top=e.clientY+10+"px";
    tip.textContent=`${m.name} · ${Math.round(sim.temp[best])}°C · dmg ${(sim.dmg[best]*100)|0}% · ${["solid","liquid","gas"][sim.state[best]]}`;
    showMatInfo(sim.mat[best]);
  } else tip.style.display="none";
});
window.addEventListener("pointerup",()=>panning=null);
cv.addEventListener("contextmenu",e=>e.preventDefault());
window.addEventListener("keydown",e=>{
  if(e.target.tagName==="INPUT"||e.target.tagName==="SELECT") return;
  if(e.code==="Space"){ e.preventDefault(); fire(); }
  if(e.key==="p"||e.key==="P") $("pauseBtn").click();
  if(e.key==="r"||e.key==="R") resetScene();
  const step=18;
  if(e.key==="a"||e.key==="ArrowLeft")cam.x+=step; if(e.key==="d"||e.key==="ArrowRight")cam.x-=step;
  if(e.key==="w"||e.key==="ArrowUp")cam.y+=step; if(e.key==="s"||e.key==="ArrowDown")cam.y-=step;
});

/* ---------------- boot ---------------- */
$("libCounts").textContent=`${LIBRARY_COUNTS.materials} materials · ${PROJECTILES.length} projectiles · ${TARGETS.length} targets · ${LIBRARY_COUNTS.vehicles} vehicles · ${EXPERIMENTS.length} experiments`;
syncSliders(); buildPalette(); showMatInfo(0); refreshLists(); resetScene();
requestAnimationFrame(loop);
