'use strict';
/* ============================================================
   SoftBody Drive 2D — машина из точек и балок (как BeamNG):
   кузов мнётся, балки пластично гнутся и рвутся, колёса отлетают.
   Физика: Verlet-интеграция + итерационные связи (beams).
   ============================================================ */
const cvs = document.getElementById('game');
const ctx = cvs.getContext('2d');
let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  cvs.width = W * DPR; cvs.height = H * DPR;
}
window.addEventListener('resize', resize); resize();

/* ---------------- ввод ---------------- */
const keys = new Set(), touch = new Set();
const KEYMAP = {
  KeyW: 'gas', ArrowUp: 'gas', KeyS: 'brake', ArrowDown: 'brake',
  KeyA: 'tiltL', ArrowLeft: 'tiltL', KeyD: 'tiltR', ArrowRight: 'tiltR',
  ShiftLeft: 'nitro', ShiftRight: 'nitro', Space: 'hand'
};
window.addEventListener('keydown', e => {
  if (KEYMAP[e.code]) { keys.add(KEYMAP[e.code]); e.preventDefault(); }
  if (e.code === 'KeyR') resetCar();
  if (e.code === 'KeyP') togglePause();
  if (e.code === 'KeyM') toggleSound();
  initAudio();
});
window.addEventListener('keyup', e => { if (KEYMAP[e.code]) keys.delete(KEYMAP[e.code]); });
document.querySelectorAll('.tbtn').forEach(b => {
  const k = b.dataset.k;
  const on = e => { e.preventDefault(); touch.add(k); initAudio(); hideBanner(); };
  const off = e => { e.preventDefault(); touch.delete(k); };
  b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off);
  b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off);
});
const input = n => keys.has(n) || touch.has(n);
let started = false;
function hideBanner() {
  if (!started) { started = true; document.getElementById('banner').style.opacity = '0'; }
}

/* ---------------- местность ---------------- */
function groundY(x) {
  if (x < 500) { // ровный старт
    const t = Math.min(1, Math.max(0, (x - 200) / 300));
    const s = t * t * (3 - 2 * t);
    return 320 * (1 - s) + hills(x) * s;
  }
  return hills(x);
}
function hills(x) {
  return 320
    + Math.sin(x * 0.0016) * 70
    + Math.sin(x * 0.0043 + 1.7) * 38
    + Math.sin(x * 0.0007 + 4.2) * 95
    + Math.sin(x * 0.011 + 0.5) * 9;
}
function groundNormal(x) {
  const s = (groundY(x + 6) - groundY(x - 6)) / 12;
  const l = Math.hypot(1, s);
  return { tx: 1 / l, ty: s / l, nx: s / l, ny: -1 / l }; // n смотрит вверх
}
// детерминированный генератор для чанков объектов
function rng(seed) {
  let a = seed * 2654435761 >>> 0;
  return () => { a ^= a << 13; a ^= a >>> 17; a ^= a << 5; a >>>= 0; return a / 4294967296; };
}

/* ---------------- частицы и балки ---------------- */
let particles = [], carBeams = [], effects = [];
function makeParticle(x, y, r, m) {
  const p = { x, y, px: x, py: y, r, m: m || 1, invM: 1 / (m || 1), touching: false, tx: 1, ty: 0, scrape: 0 };
  particles.push(p); return p;
}
function makeBeam(list, a, b, type, stiff, breakStrain) {
  const rest = Math.hypot(a.x - b.x, a.y - b.y);
  const beam = { a, b, rest, rest0: rest, type, stiff, breakStrain, broken: false };
  list.push(beam); return beam;
}
function solveBeam(bm) {
  if (bm.broken) return;
  const dx = bm.b.x - bm.a.x, dy = bm.b.y - bm.a.y;
  const d = Math.hypot(dx, dy) || 0.0001;
  const strain = (d - bm.rest) / bm.rest;
  // разрыв
  if (bm.breakStrain && (strain > bm.breakStrain || strain < -bm.breakStrain * 0.75)) {
    bm.broken = true;
    if (bm.type === 'struct') onBeamBreak(bm);
    return;
  }
  // пластичность: металл "запоминает" сильную деформацию — кузов остаётся мятым!
  if (bm.type === 'struct' && Math.abs(strain) > 0.10) {
    bm.rest += (d - bm.rest) * 0.025;
    bm.rest = Math.max(bm.rest0 * 0.45, Math.min(bm.rest0 * 1.7, bm.rest));
  }
  const diff = (d - bm.rest) / d * bm.stiff;
  const w = bm.a.invM + bm.b.invM; if (!w) return;
  const fa = bm.a.invM / w, fb = bm.b.invM / w;
  bm.a.x += dx * diff * fa * 2 * 0.5; bm.a.y += dy * diff * fa * 2 * 0.5;
  bm.b.x -= dx * diff * fb * 2 * 0.5; bm.b.y -= dy * diff * fb * 2 * 0.5;
}

/* ---------------- машина ---------------- */
const CAR_DEF = [ // [x, y] — контур кузова, y вниз
  [-62, 0], [-62, -22], [-38, -24], [-34, -42], [8, -44], [26, -24],
  [58, -14], [62, 2], [34, 10], [0, 12], [-34, 10], [-18, -11], [18, -12]
];
let car = null, structTotal = 0, camShake = 0, maxDist = 0, msgTimer = 0;
try { maxDist = +localStorage.getItem('sbd_best') || 0; } catch (e) {}

function buildCar(spawnX) {
  particles = particles.filter(p => !car || (!car.nodes.includes(p) && !car.wheels.some(w => w.p === p)));
  const gy = groundY(spawnX), cx = spawnX, cy = gy - 58;
  const nodes = CAR_DEF.map(([x, y]) => makeParticle(cx + x, cy + y, 6, 1));
  carBeams = [];
  const B = (i, j, t, s, br) => makeBeam(carBeams, nodes[i], nodes[j], t || 'struct', s === undefined ? 0.42 : s, br === undefined ? 0.62 : br);
  // контур
  for (let i = 0; i < 11; i++) B(i, (i + 1) % 11);
  // внутренняя решётка (жёсткость + деформируемость)
  B(1, 10); B(1, 9); B(2, 10); B(2, 9); B(2, 5); B(5, 9); B(5, 8); B(6, 8); B(6, 9);
  B(3, 5); B(4, 2); B(3, 11); B(4, 12);
  B(11, 0); B(11, 1); B(11, 2); B(11, 10); B(11, 9); B(11, 12);
  B(12, 5); B(12, 6); B(12, 7); B(12, 8); B(12, 9);
  structTotal = carBeams.length;
  // колёса на пружинных балках подвески — рвутся при жёстких ударах!
  const mkWheel = (lx, attach) => {
    const p = makeParticle(cx + lx, cy + 16, 19, 1.4);
    p.isWheel = true;
    const w = { p, angle: 0, omega: 0, touching: false, beams: [], lostMsgShown: false };
    attach.forEach(i => w.beams.push(makeBeam(carBeams, p, nodes[i], 'susp', 0.16, 1.35)));
    return w;
  };
  const wheels = [mkWheel(-40, [10, 0, 2, 11]), mkWheel(40, [8, 7, 5, 12])];
  car = { nodes, wheels, center: { x: cx, y: cy }, vx: 0, vy: 0, damageShown: 0 };
  cam.x = cx; cam.y = cy;
}
function carCenter() {
  let x = 0, y = 0; car.nodes.forEach(p => { x += p.x; y += p.y; });
  return { x: x / car.nodes.length, y: y / car.nodes.length };
}
function brokenStruct() { return carBeams.filter(b => b.type === 'struct' && b.broken).length; }
function damagePct() {
  if (!structTotal) return 0;
  let def = 0, n = 0;
  carBeams.forEach(b => { if (b.type === 'struct' && !b.broken) { def += Math.min(0.6, Math.abs(b.rest - b.rest0) / b.rest0); n++; } });
  return Math.min(100, Math.round(brokenStruct() / structTotal * 115 + (n ? def / n * 55 : 0)));
}
function wheelsAttached() {
  return car.wheels.filter(w => w.beams.some(b => !b.broken)).length;
}
function resetCar() {
  const x = car ? Math.max(0, carCenter().x) : 0;
  // вычистить обломки ящиков рядом, чтобы не застрять
  buildCar(x); showMsg('🔧 Машина как новенькая!');
}
function showMsg(t) { document.getElementById('msg').textContent = t; msgTimer = 260; }
function onBeamBreak(bm) {
  const c = carCenter();
  for (let i = 0; i < 5; i++) spawnEffect(bm.a.x, bm.a.y, 'spark');
  playCrash(0.25); camShake = Math.max(camShake, 3);
  if (car && wheelsAttached() < 2 && !car.wheels.some(w => w.lostMsgShown && false)) { /* handled in loop */ }
  if (c) msgTimer = msgTimer; // noop
}

/* ---------------- объекты: ящики и бочки ---------------- */
const SEG = 900, objects = new Map(); // seg -> {parts, beams, kind}
function ensureObjects(camX) {
  const c = Math.floor(camX / SEG);
  for (let s = c - 2; s <= c + 5; s++) {
    if (!objects.has(s)) spawnSegment(s);
  }
  for (const [s, o] of objects) {
    if (s < c - 4 || s > c + 8) { // удалить далёкие
      o.parts.forEach(p => { const i = particles.indexOf(p); if (i >= 0) particles.splice(i, 1); });
      objects.delete(s);
    }
  }
}
function spawnSegment(s) {
  const obj = { parts: [], beams: [], kind: 'empty' };
  objects.set(s, obj);
  if (s < 1) return; // у старта чисто
  const r = rng(s + 777);
  if (r() < 0.30) return;
  const bx = s * SEG + 280 + r() * 380, gy = groundY(bx);
  if (r() < 0.22) { // бочка
    const p = makeParticle(bx, gy - 16, 16, 0.8); p.isBarrel = true;
    obj.parts.push(p); obj.kind = 'barrel'; return;
  }
  const n = 1 + Math.floor(r() * 3), size = 36;
  for (let i = 0; i < n; i++) { // стопка ящиков
    const y = gy - size / 2 - (i === 2 ? size : 0);
    const x = bx + (i === 2 ? 4 : (i === 1 ? size + 3 : 0));
    const cs = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => {
      const p = makeParticle(x + a * size / 2, y + b * size / 2, 6, 0.7); obj.parts.push(p); return p;
    });
    const bl = [];
    bl.push(makeBeam(bl, cs[0], cs[1], 'crate', 0.6, 0.85)); bl.push(makeBeam(bl, cs[1], cs[2], 'crate', 0.6, 0.85));
    bl.push(makeBeam(bl, cs[2], cs[3], 'crate', 0.6, 0.85)); bl.push(makeBeam(bl, cs[3], cs[0], 'crate', 0.6, 0.85));
    bl.push(makeBeam(bl, cs[0], cs[2], 'crate', 0.6, 0.85)); bl.push(makeBeam(bl, cs[1], cs[3], 'crate', 0.6, 0.85));
    obj.beams.push(...bl); obj.kind = 'crate'; obj['crate' + i] = cs;
    obj.crates = obj.crates || []; obj.crates.push(cs);
  }
}

/* ---------------- эффекты ---------------- */
function spawnEffect(x, y, type, tx, ty) {
  if (effects.length > 260) return;
  const a = Math.random() * Math.PI * 2, sp = Math.random() * 2.4;
  const conf = {
    dust:  { c: 'rgba(196,164,120,', life: 34, sz: 3 + Math.random() * 4 },
    spark: { c: 'rgba(255,190,60,',  life: 20, sz: 2.2 },
    smoke: { c: 'rgba(70,70,70,',    life: 46, sz: 4 + Math.random() * 4 },
    flame: { c: 'rgba(255,120,30,',  life: 16, sz: 4 + Math.random() * 3 }
  }[type];
  effects.push({ x, y, vx: Math.cos(a) * sp + (tx || 0), vy: Math.sin(a) * sp - (type === 'smoke' || type === 'flame' ? 1 : 0) + (ty || 0), ...conf, t: 0, type });
}

/* ---------------- звук (WebAudio) ---------------- */
let AC = null, engOsc = null, engOsc2 = null, engGain = null, soundOn = true;
function initAudio() {
  if (AC || !soundOn) return;
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    engGain = AC.createGain(); engGain.gain.value = 0.0;
    const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
    engOsc = AC.createOscillator(); engOsc.type = 'sawtooth';
    engOsc2 = AC.createOscillator(); engOsc2.type = 'square';
    const g2 = AC.createGain(); g2.gain.value = 0.4;
    engOsc.connect(f); engOsc2.connect(g2); g2.connect(f); f.connect(engGain); engGain.connect(AC.destination);
    engOsc.start(); engOsc2.start();
  } catch (e) { AC = null; }
}
function playCrash(vol) {
  if (!AC || !soundOn) return;
  const len = AC.sampleRate * 0.18, buf = AC.createBuffer(1, len, AC.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = AC.createBufferSource(); src.buffer = buf;
  const g = AC.createGain(); g.gain.value = Math.min(0.5, vol);
  const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700;
  src.connect(f); f.connect(g); g.connect(AC.destination); src.start();
}
let crashCooldown = 0;
function toggleSound() {
  soundOn = !soundOn;
  document.getElementById('btnSound').textContent = soundOn ? '🔊' : '🔇';
  if (!soundOn && engGain) engGain.gain.value = 0;
  if (soundOn) initAudio();
}

/* ---------------- физика ---------------- */
const cam = { x: 0, y: 0, zoom: 1 };
let paused = false, wheelWasAttached = 2;
function togglePause() { paused = !paused; document.getElementById('paused').classList.toggle('on', paused); }
document.getElementById('btnPause').onclick = togglePause;
document.getElementById('btnReset').onclick = () => { initAudio(); resetCar(); };
document.getElementById('btnSound').onclick = toggleSound;

function stepPhysics() {
  const gas = input('gas'), brake = input('brake'), nitro = input('nitro');
  if (gas || brake) hideBanner();
  const c = carCenter();
  const airborne = car.wheels.every(w => !w.touching);

  // --- наклон в воздухе (и чуть-чуть на земле) ---
  const tilt = (input('tiltR') ? 1 : 0) - (input('tiltL') ? 1 : 0);
  if (tilt && (airborne || true)) {
    car.nodes.forEach(p => {
      const rx = p.x - c.x, ry = p.y - c.y, l = Math.hypot(rx, ry) || 1;
      const s = tilt * (airborne ? 0.055 : 0.012) * l / 40;
      p.px -= (-ry / l) * s * 40 * 0.06; p.py -= (rx / l) * s * 40 * 0.06;
    });
  }

  // --- интеграция Verlet ---
  for (const p of particles) {
    let vx = (p.x - p.px) * 0.998, vy = (p.y - p.py) * 0.998;
    const sp = Math.hypot(vx, vy); if (sp > 46) { vx *= 46 / sp; vy *= 46 / sp; }
    p.px = p.x; p.py = p.y;
    p.x += vx; p.y += vy + 0.5; // гравитация
    p.touching = false;
  }

  // --- мотор колёс (через подвеску тянет весь кузов) ---
  car.wheels.forEach(w => {
    const p = w.p, attached = w.beams.some(b => !b.broken);
    if (w.touching && attached) {
      let drive = 0;
      if (gas) drive = nitro ? 1.9 : 1.15;
      if (brake) drive = car.vx > 0.6 ? -0.9 : -0.62; // сначала тормоз, потом задний ход
      if (drive) {
        const pow = drive * 0.52;
        p.px -= p.tx * pow; p.py -= p.ty * pow; // скорость += вдоль поверхности
        w.omega += drive * 0.045;
        if (Math.random() < 0.55) spawnEffect(p.x - p.tx * 14, p.y + 13, 'dust', -p.tx * 1.4, -0.6);
        if (nitro && gas) spawnEffect(car.nodes[0].x, car.nodes[0].y, 'flame', -2.6, 0.4);
      }
      if (input('hand')) { p.px = p.x - (p.x - p.px) * 0.86; w.omega *= 0.8; }
      // качение: вращение следует за скоростью по поверхности, со скольжением от мотора
      const vt = (p.x - p.px) * p.tx + (p.y - p.py) * p.ty;
      w.omega += ((vt / p.r) - w.omega) * 0.25;
    } else {
      if (gas && attached) w.omega = Math.min(w.omega + 0.02, 1.2); // газ в воздухе крутит колёса
      else w.omega *= 0.995;
    }
    w.angle += w.omega;
  });

  // --- связи + коллизии (несколько итераций) ---
  for (let it = 0; it < 6; it++) {
    carBeams.forEach(solveBeam);
    objects.forEach(o => o.beams.forEach(solveBeam));
    particles.forEach(collideTerrain);
    collidePairs();
  }
  car.wheels.forEach(w => { w.touching = w.p.touching; });

  // скорость центра для HUD / мотора
  const c2 = carCenter();
  car.vx = c2.x - (car._lx === undefined ? c2.x : car._lx); car.vy = c2.y - (car._ly === undefined ? c2.y : car._ly);
  car._lx = c2.x; car._ly = c2.y; car.center = c2;
  if (Math.abs(car.vx) * 4.32 > 25 && car.wheels.some(w => w.touching) && Math.random() < 0.3) {
    const w = car.wheels[0].p; spawnEffect(w.x, w.y + 16, 'dust', -car.vx * 0.12, -0.5);
  }
  // дым из-под капота при сильном уроне
  if (damagePct() > 55 && Math.random() < 0.10) spawnEffect(car.nodes[5].x, car.nodes[5].y, 'smoke');
  if (crashCooldown > 0) crashCooldown--;

  // сообщения о потерянных колёсах
  const att = wheelsAttached();
  if (att < wheelWasAttached) showMsg(att === 1 ? '😱 Колесо отлетело! Но ехать ещё можно…' : '💥 Оба колеса потеряны! Жми R — ремонт');
  wheelWasAttached = att;
  const dmg = damagePct();
  if (dmg > 75 && car.damageShown <= 75) { showMsg('🔥 Машина едва жива! R — ремонт'); }
  if (dmg > 40 && car.damageShown <= 40) { showMsg('⚠️ Кузов сильно помят!'); }
  car.damageShown = dmg;
}

function collideTerrain(p) {
  const gy = groundY(p.x);
  if (p.y + p.r > gy) {
    const n = groundNormal(p.x);
    p.y = gy - p.r;
    // скорость -> разложить на нормальную/касательную
    let vx = p.x - p.px, vy = p.y - p.py;
    const vn = vx * n.nx + vy * n.ny;
    let txv = vx - vn * n.nx, tyv = vy - vn * n.ny;
    const isStruct = car && car.nodes.includes(p);
    if (vn < 0) {
      if (isStruct && vn < -11 && crashCooldown <= 0) { // жёсткий удар кузовом
        playCrash(Math.min(0.5, -vn * 0.03)); camShake = Math.max(camShake, Math.min(9, -vn * 0.55));
        for (let i = 0; i < 7; i++) spawnEffect(p.x, p.y, 'spark'); crashCooldown = 14;
        if (vn < -19) showMsg('💥 Жёсткий удар!');
      } else if (isStruct && vn < -7) {
        for (let i = 0; i < 3; i++) spawnEffect(p.x, p.y, 'spark');
      }
      const bounce = p.isWheel || p.isBarrel ? 0.08 : 0.0;
      vx = txv - vn * bounce * n.nx; vy = tyv - vn * bounce * n.ny;
    }
    // трение
    const mu = p.isWheel ? 0.985 : 0.82;
    vx = (vx - txv) + txv * mu; vy = (vy - tyv) + tyv * mu;
    p.px = p.x - vx; p.py = p.y - vy;
    p.touching = true; p.tx = n.tx; p.ty = n.ty;
    if (isStruct && Math.hypot(txv, tyv) > 7 && Math.random() < 0.25) spawnEffect(p.x, p.y + 4, 'dust');
  }
}
function collidePairs() {
  // машина <-> объекты и объекты <-> объекты (частиц немного — честный перебор)
  const objs = [...objects.values()];
  const carParts = [...car.nodes, ...car.wheels.map(w => w.p)];
  const push = (a, b) => {
    const dx = b.x - a.x, dy = b.y - a.y, min = a.r + b.r, d2 = dx * dx + dy * dy;
    if (d2 > min * min || d2 === 0) return;
    const d = Math.sqrt(d2), diff = (min - d) / d, w = a.invM + b.invM;
    a.x -= dx * diff * (a.invM / w); a.y -= dy * diff * (a.invM / w);
    b.x += dx * diff * (b.invM / w); b.y += dy * diff * (b.invM / w);
  };
  objs.forEach(o => o.parts.forEach(op => carParts.forEach(cp => push(cp, op))));
  for (let i = 0; i < objs.length; i++) for (let j = i + 1; j < objs.length; j++)
    objs[i].parts.forEach(a => objs[j].parts.forEach(b => push(a, b)));
}

/* ---------------- отрисовка ---------------- */
function draw() {
  const c = car.center;
  const speed = Math.abs(car.vx);
  const baseZoom = Math.min(1.12, Math.max(0.6, W / 1150));
  const targetZoom = baseZoom * Math.max(0.74, 1 - speed * 0.006);
  cam.zoom += (targetZoom - cam.zoom) * 0.04;
  cam.x += (c.x - cam.x) * 0.08;
  cam.y += ((c.y - 10) - cam.y) * 0.06;
  if (camShake > 0.2) camShake *= 0.88; else camShake = 0;
  const shX = (Math.random() - 0.5) * camShake, shY = (Math.random() - 0.5) * camShake;

  // небо
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#4aa3e8'); sky.addColorStop(0.55, '#8ec9f2'); sky.addColorStop(1, '#d8f0ff');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  // солнце и облака
  ctx.fillStyle = '#fff3a0'; ctx.beginPath(); ctx.arc(W - 120, 84, 36, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,243,160,.35)'; ctx.beginPath(); ctx.arc(W - 120, 84, 56, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.9)';
  for (let i = 0; i < 7; i++) {
    const cxp = ((i * 340 - cam.x * 0.12) % (W + 260) + W + 260) % (W + 260) - 130, cyp = 46 + (i * 53) % 130;
    [[0, 0, 30], [26, 4, 22], [-27, 5, 20], [4, -11, 20]].forEach(([a, b, r]) => { ctx.beginPath(); ctx.arc(cxp + a, cyp + b, r, 0, 7); ctx.fill(); });
  }
  // далёкие горы (параллакс)
  mountainLayer(0.22, H * 0.70, 90, '#7fb2dd', 0.9);
  mountainLayer(0.45, H * 0.78, 60, '#5d9c6e', 2.1);

  ctx.save();
  ctx.translate(W / 2, H * 0.56); ctx.scale(cam.zoom, cam.zoom); ctx.translate(-cam.x + shX, -cam.y + shY);

  drawTerrain();
  drawObjects();
  drawCar();

  // эффекты
  for (const e of effects) {
    const a = Math.max(0, 1 - e.t / e.life);
    ctx.fillStyle = e.c + (a * 0.75) + ')';
    ctx.beginPath(); ctx.arc(e.x, e.y, e.sz * (e.type === 'smoke' ? (1 + e.t / 18) : 1), 0, 7); ctx.fill();
  }
  ctx.restore();
}
function mountainLayer(par, base, amp, color, seed) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(-20, H);
  for (let sx = -20; sx <= W + 20; sx += 26) {
    const wx = sx + cam.x * par;
    ctx.lineTo(sx, base - (Math.sin(wx * 0.004 + seed) * 0.5 + Math.sin(wx * 0.0013 + seed * 2) * 0.5 + 0.6) * amp);
  }
  ctx.lineTo(W + 20, H); ctx.closePath(); ctx.fill();
}
function drawTerrain() {
  const x0 = cam.x - W / 2 / cam.zoom - 80, x1 = cam.x + W / 2 / cam.zoom + 80;
  const bottom = cam.y + H / cam.zoom;
  ctx.beginPath(); ctx.moveTo(x0, groundY(x0));
  for (let x = x0; x <= x1; x += 10) ctx.lineTo(x, groundY(x));
  ctx.lineTo(x1, bottom); ctx.lineTo(x0, bottom); ctx.closePath();
  ctx.fillStyle = '#6e4a2c'; ctx.fill();
  // трава сверху
  ctx.beginPath();
  for (let x = x0; x <= x1; x += 10) { const y = groundY(x); x === x0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
  ctx.strokeStyle = '#3f9e4d'; ctx.lineWidth = 13; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.beginPath();
  for (let x = x0; x <= x1; x += 10) { const y = groundY(x); x === x0 ? ctx.moveTo(x, y - 5) : ctx.lineTo(x, y - 5); }
  ctx.strokeStyle = '#55c267'; ctx.lineWidth = 5; ctx.stroke();
  // разметка дистанции каждые 50 м (2500 px)
  ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.font = 'bold 17px sans-serif'; ctx.textAlign = 'center';
  for (let m = 0; m * 2500 < x1; m++) {
    const x = m * 2500; if (x < x0 || m === 0) continue;
    ctx.fillRect(x - 2, groundY(x) - 44, 4, 44);
    ctx.fillText(m * 50 + ' м', x, groundY(x) - 54);
  }
}
function drawObjects() {
  objects.forEach(o => {
    if (o.kind === 'barrel' && o.parts[0]) {
      const p = o.parts[0];
      ctx.fillStyle = '#d35400'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
      ctx.fillStyle = '#e67e22'; ctx.fillRect(p.x - p.r, p.y - 4, p.r * 2, 8);
      ctx.strokeStyle = '#a04000'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(p.x, p.y, p.r - 1, 0, 7); ctx.stroke();
    }
    (o.crates || []).forEach(cs => {
      ctx.beginPath(); cs.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath();
      ctx.fillStyle = '#c98d4b'; ctx.fill(); ctx.strokeStyle = '#8b5a24'; ctx.lineWidth = 3; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cs[0].x, cs[0].y); ctx.lineTo(cs[2].x, cs[2].y);
      ctx.moveTo(cs[1].x, cs[1].y); ctx.lineTo(cs[3].x, cs[3].y); ctx.stroke();
    });
  });
}
function drawCar() {
  const n = car.nodes;
  // колёса (за кузовом)
  car.wheels.forEach(w => {
    const p = w.p, attached = w.beams.some(b => !b.broken);
    // тросы подвески
    ctx.strokeStyle = 'rgba(30,30,30,.65)'; ctx.lineWidth = 3;
    w.beams.forEach(b => { if (!b.broken) { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(b.b.x, b.b.y); ctx.stroke(); } });
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(w.angle);
    ctx.fillStyle = '#1d1d22'; ctx.beginPath(); ctx.arc(0, 0, p.r, 0, 7); ctx.fill();
    ctx.fillStyle = '#3b3b44'; ctx.beginPath(); ctx.arc(0, 0, p.r - 4, 0, 7); ctx.fill();
    ctx.fillStyle = '#c9ccd4'; ctx.beginPath(); ctx.arc(0, 0, 7.5, 0, 7); ctx.fill();
    ctx.strokeStyle = '#9ea3ad'; ctx.lineWidth = 3.4;
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * (p.r - 5), Math.sin(a) * (p.r - 5)); ctx.stroke(); }
    ctx.restore();
    if (!attached) { ctx.fillStyle = '#fff'; ctx.font = '15px sans-serif'; ctx.fillText('💨', p.x - 8, p.y - p.r - 6); }
  });
  // кузов по контуру узлов — мнётся вместе с физикой!
  const poly = idxs => { ctx.beginPath(); idxs.forEach((i, k) => k ? ctx.lineTo(n[i].x, n[i].y) : ctx.moveTo(n[i].x, n[i].y)); ctx.closePath(); };
  poly([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const dmg = damagePct();
  ctx.fillStyle = dmg > 70 ? '#a93226' : dmg > 40 ? '#ca4a1d' : '#e84118'; ctx.fill();
  ctx.strokeStyle = 'rgba(90,15,5,.55)'; ctx.lineWidth = 2.5; ctx.stroke();
  // стёкла кабины
  poly([2, 3, 4, 5]); ctx.fillStyle = 'rgba(165,220,245,.92)'; ctx.fill();
  ctx.strokeStyle = 'rgba(40,60,80,.6)'; ctx.lineWidth = 2; ctx.stroke();
  // стойка между стёклами
  const mx = (n[3].x + n[4].x) / 2, my = (n[3].y + n[4].y) / 2, mx2 = (n[2].x + n[5].x) / 2, my2 = (n[2].y + n[5].y) / 2;
  ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx2, my2); ctx.strokeStyle = dmg > 70 ? '#a93226' : '#e84118'; ctx.lineWidth = 5; ctx.stroke();
  // дверь и ручка
  ctx.beginPath(); ctx.moveTo(n[11].x, n[11].y); ctx.lineTo(n[12].x, n[12].y); ctx.lineTo(n[9].x, n[9].y);
  ctx.strokeStyle = 'rgba(0,0,0,.28)'; ctx.lineWidth = 2; ctx.stroke();
  // фары
  ctx.fillStyle = '#ffe66d'; ctx.beginPath(); ctx.arc((n[6].x + n[7].x) / 2, (n[6].y + n[7].y) / 2, 4.6, 0, 7); ctx.fill();
  ctx.fillStyle = '#ff2e2e'; ctx.beginPath(); ctx.arc((n[0].x + n[1].x) / 2, (n[0].y + n[1].y) / 2, 4.2, 0, 7); ctx.fill();
  // трещины при уроне
  if (dmg > 35) {
    ctx.strokeStyle = 'rgba(20,20,20,.5)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(n[5].x, n[5].y); ctx.lineTo(n[12].x + 6, n[12].y + 4); ctx.lineTo(n[6].x - 9, n[6].y + 3); ctx.stroke();
  }
  if (dmg > 65) {
    ctx.beginPath(); ctx.moveTo(n[2].x, n[2].y); ctx.lineTo(n[11].x - 5, n[11].y); ctx.lineTo(n[1].x + 8, n[1].y + 5); ctx.stroke();
  }
}

/* ---------------- HUD ---------------- */
const el = id => document.getElementById(id);
function updateHUD() {
  el('speedVal').textContent = Math.round(Math.abs(car.vx) * 8.6); // шаг физики = 1/120 с, 50 px = 1 м
  const health = 100 - damagePct();
  el('dmgBar').style.width = health + '%';
  el('dmgVal').textContent = health + '%';
  const d = Math.max(0, Math.floor(car.center.x / 50));
  if (d > maxDist) { maxDist = d; try { localStorage.setItem('sbd_best', maxDist); } catch (e) {} }
  el('dist').textContent = d; el('best').textContent = maxDist;
  el('wheelState').textContent = '🛞 колёса: ' + wheelsAttached() + '/2';
  if (msgTimer > 0) { msgTimer--; if (msgTimer === 0) el('msg').textContent = ''; }
  if (AC && engGain && soundOn) {
    const rpm = Math.abs(car.vx) * 0.55 + (input('gas') ? 0.55 : 0) + 0.3;
    engOsc.frequency.value = 42 + rpm * 46; engOsc2.frequency.value = 21 + rpm * 23;
    engGain.gain.value = 0.028 + Math.min(0.03, rpm * 0.012);
  }
}

/* ---------------- цикл ---------------- */
buildCar(0);
ensureObjects(0);
let last = performance.now(), acc = 0, hudT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = now - last; last = now;
  if (dt > 120) dt = 120;
  if (!paused) {
    acc += dt;
    while (acc >= 1000 / 60) { stepPhysics(); stepPhysics(); acc -= 1000 / 60; } // 2 подшага => 120 Гц
    effects.forEach(e => { e.t++; e.x += e.vx; e.y += e.vy; e.vy += e.type === 'dust' ? 0.01 : -0.005; });
    effects = effects.filter(e => e.t < e.life);
    ensureObjects(car.center.x);
  }
  draw();
  if (now - hudT > 90) { updateHUD(); hudT = now; }
}
requestAnimationFrame(frame);
