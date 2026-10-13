/** Headless smoke test: library counts + a real penetration run. Run: node tests/smoke.mjs */
import { MATERIALS, CATEGORIES } from "../js/materials.js";
import { PROJECTILES, TARGETS, VEHICLES, EXPERIMENTS } from "../js/library.js";
import { Sim, SPACING } from "../js/physics.js";

let fail=0; const ok=(c,m)=>{ console.log((c?"✓":"✗ FAIL")+" "+m); if(!c)fail++; };
ok(MATERIALS.length>=80, `${MATERIALS.length} materials (>=80)`);
ok(PROJECTILES.length>=60, `${PROJECTILES.length} projectiles (>=60)`);
ok(TARGETS.length>=60, `${TARGETS.length} targets incl. vehicles (>=60)`);
ok(VEHICLES.length>=15, `${VEHICLES.length} vehicle cutaways (>=15)`);
ok(EXPERIMENTS.length>=45, `${EXPERIMENTS.length} experiments (>=45)`);
ok(MATERIALS.every(m=>m.density>0&&m.melt<m.boil&&m.breakStrain>0), "material property sanity");
ok(PROJECTILES.every(p=>p.grid.count()>3), "every projectile has particles");
ok(new Set(CATEGORIES).size>=7, `material categories: ${CATEGORIES.join(", ")}`);

// Integration: fire a tungsten rod at an RHA plate and at glass — outcomes must differ.
function shoot(projName, targName, ms){
  const p=PROJECTILES.find(x=>x.name===projName), t=TARGETS.find(x=>x.name===targName);
  const sim=new Sim(); const cy=334-t.grid.h*SPACING/2;
  sim.spawnGrid(t.grid,452,cy,0,0,false);
  for(let i=0;i<90;i++) sim.tick(1); // settle
  const vx=ms*0.30; sim.spawnGrid(p.grid,78,cy,vx,-0.5*300*((440-78)/vx),true); // ballistic aim compensation
  for(let i=0;i<240;i++) sim.tick(1);
  return sim.stats();
}
const vsSteel=shoot("APFSDS Long Rod · Tungsten","Plate · RHA Steel ×8",1500);
const vsGlass=shoot("APFSDS Long Rod · Tungsten","Plate · Glass (Soda-Lime) ×4",1500);
console.log("vs RHA:", vsSteel, "\nvs Glass:", vsGlass);
ok(vsGlass.maxPenPx>20, `rod smashes through glass (pen ${vsGlass.maxPenPx.toFixed(0)}px)`);
ok(vsSteel.brokenBonds>10, `steel impact breaks bonds / deforms (broken ${vsSteel.brokenBonds})`);

// Detonation: HE shell into ammo crate should cook off.
const boom=(()=>{ const p=PROJECTILES.find(x=>x.name==="HE Fragmentation"), t=TARGETS.find(x=>x.name==="Ammo Crate");
  const sim=new Sim(); const cy=334-t.grid.h*SPACING/2; sim.spawnGrid(t.grid,452,cy,0,0,false);
  for(let i=0;i<60;i++)sim.tick(1); sim.spawnGrid(p.grid,78,cy,650*0.30,-0.5*300*((440-78)/(650*0.30)),true);
  for(let i=0;i<300;i++)sim.tick(1); return sim.stats(); })();
console.log("HE vs ammo crate:", boom);
ok(boom.detonations>0, `ammo crate detonates (×${boom.detonations})`);
process.exit(fail?1:0);
