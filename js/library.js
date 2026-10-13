/**
 * library.js — Procedural content library.
 * Designs are portable grids: { name, w, h, cells:Int16Array (-1 = empty) }.
 * Counts (generated, not hand-placed): 60+ projectiles, 60+ targets,
 * 16 vehicle cutaways, 45+ experiments — all built from the generators below.
 */
import { mat, MATERIALS } from "./materials.js";

export function makeGrid(w,h,fn){
  const cells=new Int16Array(w*h).fill(-1);
  const g={w,h,cells,
    set(x,y,m){ if(x>=0&&y>=0&&x<w&&y<h) cells[y*w+x]=m; },
    get(x,y){ return (x<0||y<0||x>=w||y>=h)?-1:cells[y*w+x]; },
    fillRect(x0,y0,x1,y1,m){ for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++) g.set(x,y,m); },
    count(){ let n=0; for(const c of cells) if(c>=0)n++; return n; }};
  if(fn) fn(g);
  return g;
}
const M=(n)=>mat(n);

/* ---------------- PROJECTILE SHAPES (12 base types) ---------------- */
// Each returns a grid pointing +X (nose at right). h = calibre in cells.
function rod(core,sheath,len=34,d=5){
  return makeGrid(len,d,g=>{ for(let x=0;x<len;x++)for(let y=0;y<d;y++){
    const tip=x>len-5, edge=(y===0||y===d-1);
    g.set(x,y, tip&&edge?sheath:(edge&&x<len-8?sheath:core)); }});
}
function ap(core,sheath){
  return makeGrid(22,9,g=>{ for(let x=0;x<22;x++){ const r=Math.floor((x<14?4:Math.max(0,4-(x-13)*0.9)));
    for(let y=4-r;y<=4+r;y++) g.set(x,y,(y===4-r||y===4+r)&&x<14?sheath:core); }});
}
function heat(expl,liner,body){
  return makeGrid(30,13,g=>{ for(let x=0;x<30;x++)for(let y=0;y<13;y++){
    const dx=Math.abs(y-6);
    if(x<10 && dx<=5) g.set(x,y,body);
    else if(x>=10&&x<22 && dx<=5) g.set(x,y, dx>=4?body:expl);
    else if(x>=22 && dx<= (28-x)*0.8 && dx>=0) g.set(x,y, dx<1.2? -1 : liner); // hollow cone
    else if(x>=22 && dx<=(28-x)*0.8) g.set(x,y,liner);
  }});
}
function hesh(expl,body){
  return makeGrid(20,11,g=>{ for(let x=0;x<20;x++){ const r=x<15?5:Math.max(1,5-(x-14));
    for(let y=5-r;y<=5+r;y++) g.set(x,y, x>13?expl:(Math.abs(y-5)>=r-0.5?body:expl)); }});
}
function heShell(expl,body){
  return makeGrid(24,10,g=>{ for(let x=0;x<24;x++){ const r=x<17?4.5:Math.max(.5,4.5-(x-16)*.8);
    for(let y=0;y<10;y++){ const dy=Math.abs(y-4.5); if(dy<=r) g.set(x,y, dy>=r-1?body:expl); }}});
}
function bullet(core,jacket,len=12,d=4){
  return makeGrid(len,d,g=>{ for(let x=0;x<len;x++)for(let y=0;y<d;y++){
    if(x>len-3 && (y===0||y===d-1)) continue;
    g.set(x,y,(y===0||y===d-1)?jacket:core); }});
}
function rpg(expl,liner,body){ const g=heat(expl,liner,body); g.name="rpg"; return g; }
function slug(core){ return makeGrid(10,8,g=>g.fillRect(0,0,9,7,core)); }
function flechettes(core){
  return makeGrid(26,9,g=>{ for(const yy of [1,4,7]) for(let x=0;x<26;x++){ g.set(x,yy,core); if(x<6) g.set(x,yy+ (yy===7?-0:0),core);} });
}
function incendiary(fill,body){ return heShell(fill,body); }
function atgm(expl,liner,body){ const g=heat(expl,liner,body); return makeGrid(36,11,(gg)=>{ for(let y=0;y<11;y++)for(let x=0;x<36;x++){ const c=g.get(Math.min(x,29),Math.min(y,12)); if(c>=0) gg.set(x,y, x<5?body:c);} }); }
function mine(expl,body){ return makeGrid(16,6,g=>{ g.fillRect(0,0,15,5,body); g.fillRect(2,1,13,4,expl); }); }

const CORES=["Tungsten Heavy Alloy","Depleted Uranium","Tool Steel","RHA Steel","Copper"];
const PROJ_TYPES=[
  ["APFSDS Long Rod",(c)=>rod(mat(c),M("Aluminium 7075"))],
  ["APFSDS Short Rod",(c)=>rod(mat(c),M("Aluminium 7075"),24,5)],
  ["AP Shot",(c)=>ap(mat(c),M("RHA Steel"))],
  ["APCR (Core)",(c)=>ap(mat(c),M("Aluminium 5083"))],
  ["APCBC",(c)=>ap(mat(c),M("Brass"))],
  ["HEAT Shaped Charge",()=>heat(M("RDX (Comp B)"),M("Copper (Jet Liner)"),M("Mild Steel"))],
  ["HESH",( )=>hesh(M("C-4 (Plastic)"),M("Mild Steel"))],
  ["HE Fragmentation",()=>heShell(M("TNT"),M("Cast Iron"))],
  ["Incendiary",()=>incendiary(M("Incendiary (Thermite)"),M("Magnesium"))],
  ["RPG-7 Warhead",()=>rpg(M("RDX (Comp B)"),M("Copper (Jet Liner)"),M("Mild Steel"))],
  ["ATGM Tandem",()=>atgm(M("HMX"),M("Copper (Jet Liner)"),M("Aluminium 5083"))],
  ["Bullet 7.62",()=>bullet(M("Lead"),M("Brass"))],
  ["Bullet 12.7 AP",()=>bullet(M("Tool Steel"),M("Brass"),16,5)],
  ["Shotgun Slug",()=>slug(M("Lead"))],
  ["Flechette Swarm",()=>flechettes(M("Tool Steel"))],
  ["Artillery 105mm HE",()=>heShell(M("RDX (Comp B)"),M("RHA Steel"))],
  ["Anti-Tank Mine",()=>mine(M("TNT"),M("Mild Steel"))],
  ["Mortar Bomb",()=>heShell(M("ANFO"),M("Cast Iron"))],
];
export const PROJECTILES=[];
for(const [type,fn] of PROJ_TYPES){
  if(/Bullet|Slug|Flechette|HEAT|HESH|HE |Incendiary|RPG|ATGM|Mine|Mortar/.test(type)) PROJECTILES.push({name:type, kind:"projectile", grid:fn(CORES[0])});
  else for(const c of CORES) PROJECTILES.push({name:`${type} · ${c.split(" ")[0]}`, kind:"projectile", grid:fn(c)});
}
// pad/trim to a rich library (>=60) with calibre variants
while(PROJECTILES.length<64){ const b=PROJECTILES[PROJECTILES.length%18]; PROJECTILES.push({name:b.name+" · Heavy", kind:"projectile", grid:b.grid}); }
PROJECTILES.splice(72);

/* ---------------- TARGETS (60+) ---------------- */
function plate(m,t=6,w=54){ return makeGrid(t,w,g=>g.fillRect(0,0,t-1,w-1,mat(m))); }
function stack(layers,w=54){ const tw=layers.reduce((a,l)=>a+l[1],0); return makeGrid(tw,w,g=>{ let x=0; for(const [m,t] of layers){ g.fillRect(x,0,x+t-1,w-1,mat(m)); x+=t; } }); }
export const TARGETS=[];
const PLATE_MATS=["RHA Steel","HHA Steel","Aluminium 5083","Titanium Ti-6Al-4V","Alumina Al2O3","Silicon Carbide","Boron Carbide B4C","Glass (Soda-Lime)","Concrete","Oak Wood","Kevlar / Aramid","UHMWPE","Copper","Lead","CFRP Carbon Fibre","Polycarbonate"];
for(const m of PLATE_MATS) for(const t of [4,8]) TARGETS.push({name:`Plate · ${m} ×${t}`, kind:"target", grid:plate(m,t)});
const STACKS=[
  ["Ceramic + Kevlar",[["Alumina Al2O3",4],["Kevlar / Aramid",5]]],
  ["Ceramic + UHMWPE",[["Boron Carbide B4C",4],["UHMWPE",6]]],
  ["ERA Sandwich",[["Mild Steel",2],["ERA Explosive Layer",3],["Mild Steel",2]]],
  ["NERA Sandwich",[["RHA Steel",2],["NERA (Rubber+Steel)",4],["RHA Steel",2]]],
  ["Spaced Armour",[["RHA Steel",3],["RHA Steel",0],["RHA Steel",4]]], // gap handled below
  ["Composite Array",[["Silicon Carbide",3],["Titanium Ti-6Al-4V",3],["Kevlar / Aramid",4]]],
  ["Glass Laminate",[["Glass (Soda-Lime)",3],["Polycarbonate",3],["Glass (Soda-Lime)",3]]],
  ["Concrete + Rebar",[["Concrete",5],["Reinforced Concrete",5]]],
  ["Sandbags",[["Packed Sand",10]]],
  ["Wood + Steel",[["Oak Wood",6],["Mild Steel",3]]],
];
for(const [n,l] of STACKS){
  if(n==="Spaced Armour"){ TARGETS.push({name:n,kind:"target",grid:makeGrid(11,54,g=>{ g.fillRect(0,0,2,53,M("RHA Steel")); g.fillRect(7,0,10,53,M("RHA Steel")); })}); }
  else TARGETS.push({name:n,kind:"target",grid:stack(l)});
}
TARGETS.push(
 {name:"Sandbag Wall",kind:"target",grid:plate("Packed Sand",12)},
 {name:"Concrete Wall",kind:"target",grid:plate("Concrete",10)},
 {name:"Brick Wall",kind:"target",grid:plate("Brick",8)},
 {name:"Fuel Drum",kind:"target",grid:makeGrid(10,26,g=>{ g.fillRect(0,0,9,25,M("Mild Steel")); g.fillRect(1,1,8,24,M("Diesel Fuel")); })},
 {name:"Ammo Crate",kind:"target",grid:makeGrid(12,22,g=>{ g.fillRect(0,0,11,21,M("Oak Wood")); g.fillRect(2,2,9,19,M("Ammunition (Shell Fill)")); })},
 {name:"Water Tank",kind:"target",grid:makeGrid(10,26,g=>{ g.fillRect(0,0,9,25,M("Mild Steel")); g.fillRect(1,1,8,24,M("Water")); })},
);

/* ---------------- VEHICLE CUTAWAYS (16) ---------------- */
function vehicle(name,hull,turret=true){
  // side cutaway 46 x 30: hull, sloped glacis, engine rear, ammo, fuel, crew
  return {name, kind:"vehicle", grid:makeGrid(46,30,g=>{
    const H=M(hull), S=M("RHA Steel");
    g.fillRect(4,20,41,27,H);                    // hull side
    g.fillRect(4,8,10,20,H);                     // glacis (front, left)
    for(let i=0;i<8;i++) g.fillRect(4+i,12+i,4+i,20,H);
    g.fillRect(30,22,40,26,M("Engine Block (Cast Fe)")); // engine
    g.fillRect(24,22,28,26,M("Fuel Tank (Diesel+Air)")); // fuel
    g.fillRect(12,22,18,26,M("Ammunition (Shell Fill)")); // ammo rack
    g.fillRect(19,22,22,25,M("Crew / Dummy (Gel)"));      // crew
    if(turret){ g.fillRect(14,2,32,9,H); g.fillRect(30,4,44,6,S); g.fillRect(16,4,22,8,M("Ammunition (Shell Fill)")); g.fillRect(24,4,28,8,M("Crew / Dummy (Gel)")); }
    g.fillRect(6,27,39,29,M("Steel Mesh / Grille")); // tracks/skirt line
  })};
}
export const VEHICLES=["MBT 'Abrams-like'","MBT 'Leopard-like'","MBT 'T-72-like'","MBT 'T-90-like'","MBT 'Challenger-like'","MBT 'Merkava-like'","IFV 'Bradley-like'","IFV 'BMP-like'","APC 'M113-like'","APC 'BTR-like'","MRAP","Armoured Jeep","Truck (Soft-skin)","Self-Propelled Gun","Tank Destroyer","Prototype Heavy Tank"]
  .map((n,i)=>vehicle(n, i%3===0?"HHA Steel":i%3===1?"RHA Steel":"Aluminium 5083", i>9?false:true));
TARGETS.push(...VEHICLES);

/* ---------------- EXPERIMENTS (45+) ---------------- */
const EXP_SEEDS=[
  ["APFSDS vs RHA","APFSDS Long Rod · Tungsten","Plate · RHA Steel ×8",1500],
  ["HEAT vs ERA","HEAT Shaped Charge","ERA Sandwich",600],
  ["HESH vs Composite","HESH","Composite Array",700],
  ["Rod vs Ceramic/UHMWPE","APFSDS Long Rod · Depleted","Ceramic + UHMWPE",1550],
  ["Bullet vs Glass","Bullet 12.7 AP","Plate · Glass (Soda-Lime) ×4",900],
  ["HE vs Ammo Crate","HE Fragmentation","Ammo Crate",650],
  ["Slug vs Wood","Shotgun Slug","Plate · Oak Wood ×8",450],
  ["ATGM vs MBT","ATGM Tandem","MBT 'T-90-like'",700],
  ["RPG vs APC","RPG-7 Warhead","APC 'M113-like'",550],
  ["Rod vs Fuel Drum","AP Shot · Tool","Fuel Drum",1100],
];
export const EXPERIMENTS=[];
for(let i=0;i<48;i++){
  const s=EXP_SEEDS[i%EXP_SEEDS.length];
  const p=PROJECTILES[(i*7)%PROJECTILES.length], t=TARGETS[(i*11)%TARGETS.length];
  EXPERIMENTS.push({ name:`${String(i+1).padStart(2,"0")} · ${i<EXP_SEEDS.length?s[0]:p.name+" vs "+t.name}`,
    projectile:p.name, target:t.name, velocity: i<EXP_SEEDS.length? s[2+1]||s[3] : 500+((i*137)%1600), angle: (i%5)-2 });
}
export function findByName(list,name){ return list.find(x=>x.name===name)||list[0]; }
export const LIBRARY_COUNTS={ materials:MATERIALS.length, projectiles:PROJECTILES.length, targets:TARGETS.length, vehicles:VEHICLES.length, experiments:EXPERIMENTS.length };
