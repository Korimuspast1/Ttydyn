/**
 * materials.js — Material library (84 materials).
 * Every particle references one material. All emergent behaviour
 * (penetration, shatter, melt, detonation) derives from these numbers.
 *
 * Fields:
 *  name, cat, color [r,g,b], density kg/m3, strength MPa (tensile),
 *  hardness (relative 0..1), meltC, boilC, heatCap J/kgK (scaled),
 *  cond (thermal conductivity, relative), brittle 0=ductile..1=brittle,
 *  detEnergy MJ/kg (0 = inert), detVelocity (relative shock speed),
 *  igniteC (auto-ignition / cook-off temperature)
 */
// [name, cat, color, density, strength, hardness, melt, boil, brittle, detEnergy, igniteC]
const RAW = [
// ---- Metals ----
["RHA Steel","Metals",[122,128,138],7850,900,.72,1510,2900,.25,0,900],
["HHA Steel","Metals",[96,104,118],7850,1250,.85,1510,2900,.35,0,900],
["Mild Steel","Metals",[140,144,148],7850,400,.45,1490,2900,.15,0,900],
["Stainless Steel","Metals",[168,174,180],8000,620,.6,1430,2900,.2,0,900],
["Cast Iron","Metals",[88,88,92],7200,300,.6,1200,2700,.7,0,900],
["Tool Steel","Metals",[110,100,120],7800,1400,.9,1480,2900,.4,0,900],
["Aluminium 5083","Metals",[178,184,190],2660,300,.35,640,2470,.2,0,600],
["Aluminium 7075","Metals",[158,168,178],2810,570,.5,635,2470,.25,0,600],
["Titanium Ti-6Al-4V","Metals",[150,146,138],4430,950,.65,1660,3300,.25,0,900],
["Copper","Metals",[196,110,62],8960,220,.35,1085,2570,.08,0,900],
["Tungsten Heavy Alloy","Metals",[104,102,110],17600,1050,.8,3420,5550,.45,0,1200],
["Depleted Uranium","Metals",[92,96,84],19100,900,.7,1132,4130,.3,0,700],
["Brass","Metals",[198,164,80],8500,340,.4,930,2600,.15,0,900],
["Lead","Metals",[128,124,140],11340,18,.12,327,1750,.05,0,600],
["Nickel Alloy","Metals",[150,150,142],8900,820,.62,1450,2900,.25,0,900],
["Magnesium","Metals",[186,190,186],1740,230,.3,650,1090,.3,0,620],
["Zinc","Metals",[150,164,170],7140,120,.3,420,907,.35,0,600],
["Tin","Metals",[190,192,190],7310,15,.1,232,2600,.05,0,500],
["Gold","Metals",[232,190,60],19300,120,.25,1064,2856,.05,0,900],
["Silver","Metals",[210,212,214],10490,170,.3,962,2162,.08,0,900],
// ---- Ceramics & glass ----
["Alumina Al2O3","Ceramics",[226,222,210],3900,380,.92,2070,3000,.95,0,1200],
["Silicon Carbide","Ceramics",[70,76,72],3210,450,.96,2730,3200,.97,0,1200],
["Boron Carbide B4C","Ceramics",[52,54,58],2520,500,.98,2450,3300,.98,0,1200],
["Tungsten Carbide","Ceramics",[84,84,90],15600,650,.95,2870,3400,.9,0,1200],
["Glass (Soda-Lime)","Ceramics",[168,216,224],2500,45,.7,1400,2600,1,0,800],
["Borosilicate Glass","Ceramics",[186,226,230],2230,60,.72,1650,2700,.98,0,800],
["Porcelain","Ceramics",[232,228,218],2400,90,.8,1670,2900,.95,0,1000],
["Granite","Ceramics",[128,120,116],2700,120,.75,1260,2800,.9,0,1000],
["Marble","Ceramics",[214,208,200],2710,80,.65,1500,2800,.9,0,1000],
["Diamond (Synthetic)","Ceramics",[220,240,248],3510,1200,1,3550,3900,.85,0,1200],
// ---- Polymers & composites ----
["Rubber","Polymers",[38,36,38],1100,18,.08,180,420,.05,0,220],
["Kevlar / Aramid","Polymers",[206,178,84],1440,900,.4,500,700,.35,0,420],
["UHMWPE","Polymers",[224,226,220],970,700,.3,145,500,.25,0,320],
["Nylon 6","Polymers",[216,206,178],1140,80,.25,220,520,.3,0,360],
["Polycarbonate","Polymers",[196,216,228],1200,65,.3,155,520,.35,0,380],
["Acrylic PMMA","Polymers",[204,226,236],1180,70,.5,160,500,.8,0,320],
["PVC","Polymers",[176,180,168],1380,50,.3,180,450,.5,0,300],
["CFRP Carbon Fibre","Polymers",[44,46,52],1600,1200,.6,380,700,.7,0,380],
["GFRP Fibreglass","Polymers",[188,200,176],1850,800,.5,320,650,.75,0,340],
["Foam (Polymer)","Polymers",[236,230,200],120,3,.03,120,380,.4,0,240],
["Aerogel","Polymers",[214,232,238],160,2,.05,1200,2000,.9,0,600],
["Gelatin (Simulant)","Polymers",[232,178,150],1050,2,.02,35,220,.1,0,180],
// ---- Explosives & energetics ----
["TNT","Explosives",[214,178,74],1650,40,.2,81,300,.6,4.2,240],
["RDX (Comp B)","Explosives",[226,210,160],1820,50,.25,204,400,.65,5.4,230],
["HMX","Explosives",[232,222,196],1900,55,.25,280,420,.65,5.7,250],
["C-4 (Plastic)","Explosives",[222,216,196],1600,30,.12,240,400,.3,5.6,240],
["PETN","Explosives",[236,228,210],1770,45,.25,141,380,.7,5.8,225],
["ANFO","Explosives",[206,196,168],900,15,.08,170,350,.5,3.7,260],
["Black Powder","Explosives",[52,48,46],1700,20,.1,300,500,.6,3.0,300],
["Smokeless Propellant","Explosives",[120,96,60],1600,25,.1,190,380,.4,4.6,190],
["ERA Explosive Layer","Explosives",[188,120,70],1700,45,.2,200,400,.6,5.2,235],
["Incendiary (Thermite)","Explosives",[226,120,50],3900,60,.3,660,2500,.6,3.9,700],
["Fuel-Air Mix","Explosives",[240,210,120],800,1,.01,60,300,.1,8.0,180],
// ---- Fluids ----
["Water","Fluids",[52,110,196],1000,1,.01,0,100,.1,0,400],
["Diesel Fuel","Fluids",[196,150,60],840,1,.01,-40,360,.1,0,210],
["Petrol / Gasoline","Fluids",[226,178,80],740,1,.01,-43,280,.1,0,280],
["Hydraulic Oil","Fluids",[150,110,50],870,1,.01,-20,380,.1,0,260],
["Molten Steel","Fluids",[255,150,40],7000,5,.05,1550,2900,.1,0,1200],
["Fuel Tank (Diesel+Air)","Fluids",[170,130,55],800,5,.05,60,340,.2,2.0,230],
// ---- Earth, organics, construction ----
["Concrete","Construction",[168,166,158],2400,45,.6,1450,2600,.92,0,900],
["Reinforced Concrete","Construction",[146,146,142],2500,90,.65,1450,2600,.85,0,900],
["Brick","Construction",[178,92,66],1800,30,.6,1000,2400,.95,0,900],
["Sandstone","Construction",[206,178,128],2300,50,.6,1300,2700,.9,0,900],
["Soil / Earth","Construction",[122,92,60],1600,8,.08,900,2000,.5,0,600],
["Packed Sand","Construction",[218,192,128],1700,6,.06,1000,2200,.55,0,600],
["Dry Sand (Loose)","Construction",[232,208,148],1500,2,.03,1000,2200,.6,0,600],
["Oak Wood","Construction",[150,106,58],720,90,.3,300,600,.45,0,260],
["Pine Wood","Construction",[196,152,92],510,70,.25,300,600,.5,0,260],
["Plywood","Construction",[206,168,108],600,60,.25,300,600,.55,0,260],
["Flesh (Tissue)","Organics",[206,120,110],1050,3,.03,45,220,.2,0,180],
["Bone","Organics",[232,224,196],1900,130,.55,300,800,.8,0,400],
["Ice","Organics",[196,228,244],917,3,.4,0,100,.85,0,300],
["Snow (Packed)","Organics",[240,244,248],400,1,.02,0,100,.5,0,300],
["Charcoal / Carbon","Organics",[40,38,36],450,15,.3,700,3600,.7,0,500],
// ---- Special / armour systems ----
["NERA (Rubber+Steel)","Specials",[90,90,96],2200,260,.4,400,900,.4,0,500],
["Steel Mesh / Grille","Specials",[150,154,158],3200,300,.5,1500,2900,.5,0,900],
["Graphite","Specials",[60,60,64],2260,30,.35,3600,3900,.75,0,1000],
["Copper (Jet Liner)","Specials",[210,120,66],8960,240,.35,1085,2570,.06,0,900],
["Shaped-Charge Jet (Cu)","Specials",[255,170,80],8960,300,.3,1085,2570,.02,0,900],
["Ceramic-Metal Composite","Specials",[160,158,150],3400,600,.85,1600,2900,.8,0,1100],
["Spall Liner (Kevlar)","Specials",[190,170,90],1300,700,.35,450,650,.3,0,400],
["Engine Block (Cast Fe)","Specials",[80,80,86],7200,320,.6,1200,2700,.65,0,900],
["Ammunition (Shell Fill)","Explosives",[200,160,70],1750,45,.2,190,400,.6,5.5,215],
["Crew / Dummy (Gel)","Organics",[226,160,140],1040,2,.02,40,220,.15,0,180],
];
export const MATERIALS = RAW.map((r,i)=>({
  id:i, name:r[0], cat:r[1],
  color:r[2], density:r[3], strength:r[4], hardness:r[5],
  melt:r[6], boil:r[7], brittle:r[8], detEnergy:r[9], ignite:r[10],
  // derived simulation parameters (tuned for stable, readable behaviour)
  heatCap: 380 + (r[3]%500),
  cond: r[1]==="Metals"? .9 : r[1]==="Ceramics"? .35 : r[1]==="Fluids"? .5 : .18,
  breakStrain: 0.95 - r[8]*0.68,          // brittle shatters early, ductile stretches
  yieldStrain: (0.95 - r[8]*0.68)*0.55,
  stiffness: 0.25 + r[5]*1.15,            // bond spring strength
  massScale: Math.max(.12, r[3]/7850),
}));
export const MAT_INDEX = Object.fromEntries(MATERIALS.map(m=>[m.name,m.id]));
export function mat(name){ const id=MAT_INDEX[name]; if(id===undefined) throw new Error("Unknown material "+name); return id; }
export function matColor(id,temp=20,state=0){
  const m=MATERIALS[id]; let [r,g,b]=m.color;
  if(state===2){ r=Math.min(255,r+70); g=Math.min(255,g+50); b=Math.min(255,b+20); }
  if(temp>m.melt*0.55){ const t=Math.min(1,(temp-m.melt*0.55)/700); r=Math.min(255,r+t*90); g=g*(1-t*.45); b=b*(1-t*.75); }
  if(temp>650){ const t=Math.min(1,(temp-650)/900); r=255; g=Math.floor(120+120*(1-t)); b=Math.floor(40*(1-t)); }
  return [r|0,g|0,b|0];
}
export const CATEGORIES=[...new Set(MATERIALS.map(m=>m.cat))];
