// ─────────────────────────────────────────────────────────────
//  ТОСКА — главный модуль
// ─────────────────────────────────────────────────────────────
import {
  W, H, STREET, buildings, garages, backdrop, trees, lamps, benches, dumpsters,
  trafo, playground, swing, slide, carousel, sandbox, mushroom, hockey, busStop, puddles,
  pigeons, npcs, interactables, cars, cat, ball, isBlocked, rng,
} from './world.js';
import {
  buildGround, drawBuilding, drawGarages, drawBackdrop, drawTree, drawCar,
  drawLamp, drawBench, drawDumpster, drawTrafo, drawHockey, drawMushroom,
  drawSandbox, drawCarousel, drawSlide, drawSwing, drawBusStop, drawPigeon,
  drawCat, drawGrandma, drawMan, drawBall, rr, hash01,
  bakeSprite, drawTreeBody, drawTreeLeaves,
} from './render.js';
import {
  drawRain, drawSplashes, drawLighting, drawFlashlight, drawFog, drawVignette,
  colorGrade, drawLensDrops, buildLightLayer,
} from './fx.js';
import { Player } from './player.js';
import { Soundscape } from './audio.js';

// ── DOM ──────────────────────────────────────────────────────
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
const titleEl = document.getElementById('title');
const loadingEl = document.getElementById('loading');
const hudEl = document.getElementById('hud');
const clockTimeEl = document.getElementById('clock-time');
const clockWxEl = document.getElementById('clock-wx');
const promptEl = document.getElementById('prompt');
const thoughtEl = document.getElementById('thought');
const keysHintEl = document.getElementById('keys-hint');
const muteBadgeEl = document.getElementById('mute-badge');
const touchEl = document.getElementById('touch');
const stickEl = document.getElementById('stick');
const knobEl = document.getElementById('stick-knob');
const btnE = document.getElementById('btn-e');
const btnQ = document.getElementById('btn-q');

// ── состояние ────────────────────────────────────────────────
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

const state = {
  started: false,
  time: 0,
  clock: 19 * 60 + 47,
  weather: 'дождь',
  night: 0.5,
  wind: 0.3,
  dialog: { lines: [], i: 0, t: 0, active: false, speaker: '' },
  seen: new Set(),
  idle: 0,
  swingSeat: 0,
  swingActive: false,
  catFollowing: false,
  carouselSpin: 0,
  carouselVel: 0,
  pigeonsScared: 0,
  thoughtSeed: 3,
};

const player = new Player(690, 430);

const cam = {
  x: player.x,
  y: player.y - 20,
  zoom: 1.3,
  baseZoom: 1.3,
};

const sound = new Soundscape();
let ground = null;
let backdropSprite = null;
const buildingSprites = new Map();

// частицы
const particles = [];
const smokePuffs = [];
const passingCars = [];
const streetSeen = { at: 0 };

let vw = 0;
let vh = 0;
let dpr = 1;
let last = performance.now();
let lastPrompt = '';
let hintTimer = 0;
let rainAmount = 1;

// ── ввод ─────────────────────────────────────────────────────
const keys = new Set();
const input = { x: 0, y: 0, run: false };

function updateInput() {
  let x = 0;
  let y = 0;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
  if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;

  // джойстик
  if (touchVec.active) {
    x = touchVec.x;
    y = touchVec.y;
  }
  input.x = x;
  input.y = y;
  input.run = keys.has('ShiftLeft') || keys.has('ShiftRight') || touchVec.run;
}

window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();

  if (!state.started) {
    startGame();
    keys.add(e.code);
    updateInput();
    return;
  }
  if (e.repeat) return;
  keys.add(e.code);
  updateInput();

  if (e.code === 'KeyE') interactOrAdvance();
  if (e.code === 'KeyQ') toggleUmbrella();
  if (e.code === 'KeyF') toggleFlashlight();
  if (e.code === 'KeyM') toggleMute();
  if (e.code === 'Escape') closeDialog();
});

window.addEventListener('keyup', (e) => {
  keys.delete(e.code);
  updateInput();
});

window.addEventListener('blur', () => {
  keys.clear();
  updateInput();
});

titleEl.addEventListener('pointerdown', () => startGame());

// ── тач-джойстик ─────────────────────────────────────────────
const touchVec = { active: false, x: 0, y: 0, run: false, id: null };

if (isTouch) {
  const R = 46;
  stickEl.addEventListener('pointerdown', (e) => {
    touchVec.active = true;
    touchVec.id = e.pointerId;
    stickEl.setPointerCapture(e.pointerId);
    moveStick(e);
  });
  stickEl.addEventListener('pointermove', (e) => {
    if (touchVec.id === e.pointerId) moveStick(e);
  });
  const endStick = (e) => {
    if (touchVec.id !== e.pointerId) return;
    touchVec.active = false;
    touchVec.id = null;
    touchVec.x = 0;
    touchVec.y = 0;
    knobEl.style.transform = 'translate(0px, 0px)';
    updateInput();
  };
  stickEl.addEventListener('pointerup', endStick);
  stickEl.addEventListener('pointercancel', endStick);

  function moveStick(e) {
    const r = stickEl.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > R) {
      dx = (dx / len) * R;
      dy = (dy / len) * R;
    }
    knobEl.style.transform = `translate(${dx}px, ${dy}px)`;
    touchVec.x = dx / R;
    touchVec.y = dy / R;
    touchVec.run = len > R * 0.94;
    updateInput();
  }

  btnE.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (!state.started) startGame();
    else interactOrAdvance();
  });
  btnQ.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    toggleUmbrella();
  });
}

// ── инициализация ────────────────────────────────────────────
// ── адаптивное качество ──────────────────────────────────────
// Игра сама смотрит на своё время кадра и, если машина слабая, снижает
// разрешение и отключает самые дорогие эффекты. И наоборот — возвращает,
// когда становится легче.
const quality = { level: 0, avg: 16.7, cd: 4, auto: true };

function targetDpr() {
  const base = window.devicePixelRatio || 1;
  if (quality.level === 0) return Math.min(base, 1.5);
  if (quality.level === 1) return Math.min(base, 1);
  return 0.75;
}

function applyQuality() {
  resize();
}

function adaptQuality(dt) {
  if (!quality.auto) return;
  quality.avg += (dt * 1000 - quality.avg) * 0.03;
  quality.cd -= dt;
  if (quality.cd > 0) return;
  if (quality.avg > 34 && quality.level < 2) {
    quality.level++;
    applyQuality();
    quality.cd = 4;
  } else if (quality.avg < 14 && quality.level > 0) {
    quality.level--;
    applyQuality();
    quality.cd = 8;
  }
}

function resize() {
  dpr = targetDpr();
  vw = window.innerWidth;
  vh = window.innerHeight;
  canvas.width = Math.floor(vw * dpr);
  canvas.height = Math.floor(vh * dpr);
  canvas.style.width = `${vw}px`;
  canvas.style.height = `${vh}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;

  cam.baseZoom = isTouch
    ? Math.max(0.72, Math.min(1.55, vh / 820))
    : Math.max(0.82, Math.min(1.85, Math.min(vw / 1120, vh / 730)));
  cam.zoom = cam.baseZoom;
  clampCamera();
}

window.addEventListener('resize', resize);

function initWorld() {
  ground = buildGround();

  // дальний план — один раз
  {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = 190;
    const g = c.getContext('2d');
    g.translate(0, -1640);
    drawBackdrop(g, 0);
    backdropSprite = { canvas: c, x: 0, y: 1640 };
  }
  for (const b of buildings) {
    if (b.shop) continue;
    const c = document.createElement('canvas');
    const top = b.roofY;
    const height = b.baseY - b.roofY;
    c.width = b.w + 40;
    c.height = height + 20;
    const g = c.getContext('2d');
    g.translate(-b.x + 20, -top + 10);
    drawBuilding(g, b, 0);
    buildingSprites.set(b.id, { canvas: c, x: b.x - 20, y: top - 10 });
  }
  buildSprites();
  buildStaticLights();
}

// ── спрайты: всё статичное рисуется один раз ──────────────────
const sprites = {
  trees: new Map(),
  lamps: new Map(),
  benches: new Map(),
  dumpsters: new Map(),
  cars: new Map(),
  trafo: null, hockey: null, busStop: null, garages: null,
  slide: null, sandbox: null, mushroom: null, carousel: null,
};
let lightLayer = null;

function buildSprites() {
  for (const t of trees) {
    const r = 115 * t.s;
    const h = 196 * t.s;
    sprites.trees.set(t, bakeSprite(r * 2, h + 18, t.x - r, t.y - h, (g) => drawTreeBody(g, t)));
  }
  for (const l of lamps) {
    sprites.lamps.set(l, bakeSprite(60, 264, l.x - 28, l.y - 106, (g) => drawLamp(g, l, true)));
  }
  for (const b of benches) {
    sprites.benches.set(b, bakeSprite(92, 78, b.x - 46, b.y - 56, (g) => drawBench(g, b)));
  }
  for (const d of dumpsters) {
    sprites.dumpsters.set(d, bakeSprite(48, 88, d.x - 22, d.y - 56, (g) => drawDumpster(g, d)));
  }
  for (const c of cars) {
    sprites.cars.set(c, bakeSprite(c.w + 40, c.h + 46, c.x - 20, c.y - 20, (g) => drawCar(g, c, 0)));
  }
  sprites.trafo = bakeSprite(trafo.w + 32, trafo.d + 92, trafo.x - 16, trafo.y - 40, (g) => drawTrafo(g, 0));
  sprites.hockey = bakeSprite(hockey.w + 32, hockey.d + 32, hockey.x - 16, hockey.y - 16, (g) => drawHockey(g, 0));
  sprites.busStop = bakeSprite(busStop.w + 32, busStop.d + 116, busStop.x - 16, busStop.y - 100, (g) => drawBusStop(g, 0));
  sprites.garages = bakeSprite(garages.w + 56, garages.baseY + garages.d + 44 - (garages.topY - 44), garages.x - 28, garages.topY - 44, (g) => drawGarages(g, garages, 0));
  sprites.slide = bakeSprite(slide.w + 40, slide.d + 40, slide.x - 20, slide.y - 20, (g) => drawSlide(g));
  sprites.sandbox = bakeSprite(sandbox.w + 28, sandbox.d + 28, sandbox.x - 14, sandbox.y - 14, (g) => drawSandbox(g));
  sprites.mushroom = bakeSprite(136, 126, mushroom.x - 68, mushroom.y - 74, (g) => drawMushroom(g));
  const cr = carousel.r + 16;
  sprites.carousel = bakeSprite(cr * 2, cr * 2, carousel.x - cr, carousel.y - cr, (g) => drawCarousel(g));
}

// ── статичный свет запекается в один слой ─────────────────────
function buildStaticLights() {
  const lights = [];
  // фонари двора — все одного размера и яркости, ровный ряд
  for (const l of lamps) {
    lights.push({ x: l.x + 18, y: l.y - 92, r: 200, color: [255, 196, 128], a: 0.5 });
  }
  // общий свет от окон дома — заполняет двор
  for (const b of buildings) {
    if (b.shop) continue;
    const n = Math.max(2, Math.round(b.w / 420));
    for (let i = 0; i < n; i++) {
      const lx = b.x + (i + 0.5) * (b.w / n);
      lights.push({ x: lx, y: b.baseY + 150, r: 380, color: [214, 178, 128], a: 0.072 });
    }
  }
  // окна магазина
  lights.push({ x: 2366, y: 1268, r: 240, color: [255, 206, 148], a: 0.4 });
  // свет из подъездов
  for (const b of buildings) {
    if (b.shop) continue;
    for (let i = 0; i < b.entrances; i++) {
      const ex = b.x + (i + 0.5) * (b.w / b.entrances);
      lights.push({ x: ex, y: b.baseY - 18, r: 82, color: [255, 208, 158], a: 0.3 });
    }
  }
  // остановка
  lights.push({ x: busStop.x + busStop.w / 2, y: busStop.y - 8, r: 140, color: [226, 236, 244], a: 0.24 });
  // холодный свет неба — чтобы совсем чёрных провалов не было
  for (let i = 0; i < 6; i++) {
    lights.push({
      x: (i + 0.5) * (W / 6),
      y: 520 + (i % 2) * 420,
      r: 620,
      color: [104, 128, 156],
      a: 0.05,
    });
  }
  lightLayer = buildLightLayer(lights, W, H);
}

// ── камера ───────────────────────────────────────────────────
function clampCamera() {
  const halfW = vw / 2 / cam.zoom;
  const halfH = vh / 2 / cam.zoom;
  if (halfW * 2 >= W) cam.x = W / 2;
  else cam.x = Math.max(halfW, Math.min(W - halfW, cam.x));
  if (halfH * 2 >= H) cam.y = H / 2;
  else cam.y = Math.max(halfH - 8, Math.min(H - halfH, cam.y));
}

function updateCamera(dt) {
  const lookX = player.facing === 'left' ? -22 : player.facing === 'right' ? 22 : 0;
  const lookY = player.facing === 'up' ? -14 : player.facing === 'down' ? 12 : 0;
  const tx = player.x + lookX;
  const ty = player.y - 26 + lookY;
  const k = 1 - Math.pow(0.0016, dt);
  cam.x += (tx - cam.x) * k;
  cam.y += (ty - cam.y) * k;
  clampCamera();
}

// ── мысли / диалог ───────────────────────────────────────────
function say(lines, speaker = '') {
  if (typeof lines === 'string') lines = [lines];
  if (!lines.length) return;
  state.dialog.lines = lines.slice();
  state.dialog.i = 0;
  state.dialog.speaker = speaker;
  state.dialog.active = true;
  state.dialog.t = 0;
  showLine();
  sound.blip(speaker ? 330 : 420, 0.16, 'sine', 0.035);
}

function showLine() {
  const d = state.dialog;
  if (!d.active) {
    thoughtEl.classList.remove('show');
    return;
  }
  const line = d.lines[d.i] || '';
  thoughtEl.innerHTML = (d.speaker ? `<span class="spk">${d.speaker}</span>` : '') + line;
  thoughtEl.classList.add('show');
  const dur = Math.max(4.2, Math.min(9, 2.6 + line.length * 0.045));
  d.t = dur;
}

function advanceDialog() {
  const d = state.dialog;
  if (!d.active) return;
  d.i++;
  if (d.i >= d.lines.length) {
    closeDialog();
    return;
  }
  showLine();
  sound.blip(400, 0.12, 'sine', 0.03);
}

function closeDialog() {
  state.dialog.active = false;
  thoughtEl.classList.remove('show');
}

// ── взаимодействия ───────────────────────────────────────────
let nearest = null;

function findNearest() {
  let best = null;
  let bestD = Infinity;
  for (const it of interactables) {
    const d = Math.hypot(it.x - player.x, it.y - (player.y - 16));
    if (d < it.r && d < bestD) {
      bestD = d;
      best = it;
    }
  }
  return best;
}

function interactOrAdvance() {
  if (!state.started) {
    startGame();
    return;
  }
  if (player.mode !== 'walk') {
    standUp();
    return;
  }
  if (state.dialog.active) {
    advanceDialog();
    return;
  }
  if (!nearest) return;
  doInteract(nearest);
}

function doInteract(it) {
  state.idle = 0;

  if (it.kind === 'npc') {
    const npc = npcs.find((n) => n.id === it.npc);
    if (!npc) return;
    say(npc.lines, npc.name);
    if (npc.id === 'grandma') sound.blip(300, 0.3, 'triangle', 0.03);
    else sound.blip(190, 0.28, 'sawtooth', 0.022);
    return;
  }

  switch (it.kind) {
    case 'bench': {
      const bx = it.bx ?? it.x;
      const by = it.by ?? it.y;
      sitAt(bx, by + 3, 'sit');
      say(it.lines);
      sound.blip(360, 0.2, 'sine', 0.03);
      break;
    }
    case 'swing': {
      sitAt(swing.x + swing.w / 2 + 10, swing.y + 4, 'swing');
      state.swingActive = true;
      say(it.lines);
      sound.creak();
      for (let i = 0; i < 4; i++) setTimeout(() => sound.creak(), 500 + i * 700);
      break;
    }
    case 'carousel': {
      state.carouselVel += 5.5;
      say(it.lines);
      sound.blip(240, 0.5, 'triangle', 0.03);
      break;
    }
    case 'sandbox':
    case 'dumpster':
    case 'graffiti':
    case 'hockey':
    case 'bus':
    case 'crosswalk':
    case 'shop':
    case 'door':
    case 'lamp':
    case 'puddle':
    case 'car':
      if (it.kind === 'door') sound.door();
      if (it.kind === 'shop') sound.blip(520, 0.3, 'sine', 0.03);
      say(it.lines);
      break;
    case 'radio':
      sound.radio();
      say(it.lines);
      break;
    case 'cat':
      sound.purr();
      state.catFollowing = true;
      say(it.lines);
      break;
    case 'pigeons':
      if (state.pigeonsScared <= 0) {
        state.pigeonsScared = 3.2;
        sound.wings();
        for (const p of pigeons) {
          p.fly = 0;
          p.flyV = 40 + Math.random() * 90;
        }
      }
      say(it.lines);
      break;
    case 'ball': {
      const dx = player.x - ball.x;
      const dy = player.y - ball.y;
      const l = Math.hypot(dx, dy) || 1;
      ball.vx = (-dx / l) * 210;
      ball.vy = (-dy / l) * 210;
      sound.step(true);
      setTimeout(() => sound.step(true), 260);
      say(it.lines);
      break;
    }
    default:
      if (it.lines && it.lines.length) say(it.lines);
  }
}

function sitAt(x, y, mode) {
  if (player.mode === 'walk') {
    player.prevX = player.x;
    player.prevY = player.y;
  }
  player.x = x;
  player.y = y;
  player.mode = mode;
  player.vx = 0;
  player.vy = 0;
  player.speed = 0;
  if (mode === 'swing') state.swingSeat = (state.swingSeat + 1) % 2;
}

function standUp() {
  player.mode = 'walk';
  state.swingActive = false;
  if (player.prevX != null) {
    // отойти чуть вниз, чтобы не застрять
    let tx = player.prevX;
    let ty = player.prevY;
    if (isBlocked(tx, ty, 9)) ty += 26;
    player.x = tx;
    player.y = ty;
  }
  sound.step(false);
}

function toggleUmbrella() {
  player.umbrella = !player.umbrella;
  sound.blip(player.umbrella ? 520 : 300, 0.12, 'sine', 0.03);
  if (player.umbrella) sayQ('Зонт раскрылся с сухим щелчком. Под ним стало на два градуса теплее.');
}

function toggleFlashlight() {
  player.flashlight = !player.flashlight;
  sound.blip(player.flashlight ? 700 : 380, 0.08, 'square', 0.02);
  if (player.flashlight) sayQ('Фонарик выхватил из темноты мокрый асфальт и чужие окна.');
}

function sayQ(text) {
  if (state.dialog.active) return;
  thoughtEl.innerHTML = text;
  thoughtEl.classList.add('show');
  clearTimeout(sayQ._t);
  sayQ._t = setTimeout(() => {
    if (!state.dialog.active) thoughtEl.classList.remove('show');
  }, 5200);
}

function toggleMute() {
  const m = sound.toggleMute();
  muteBadgeEl.classList.toggle('hidden', !m);
}

// ── старт ────────────────────────────────────────────────────
function startGame() {
  if (state.started) return;
  state.started = true;
  sound.resume();
  sound.init();
  titleEl.classList.add('gone');
  hudEl.classList.remove('hidden');
  if (isTouch) touchEl.classList.remove('hidden');
  setTimeout(() => titleEl.remove(), 1400);
  hintTimer = 14;

  setTimeout(() => {
    say([
      '19:47. Дождь. Двор как двор — таких тысячи, и все они похожи на этот.',
      'Ты вышел просто так. Без цели. Просто выйти — тоже цель.',
      'Иди. Куда-нибудь. Всё равно куда.',
    ]);
  }, 600);
}

// ── случайные мысли ─────────────────────────────────────────
const idleThoughts = [
  'Где-то наверху играет телевизор. Слов не разобрать, только интонацию.',
  'Пахнет мокрым бетоном и чуть-чуть — мандаринами из чьего-то окна.',
  'Все окна тёплые, и только твоё — тёмное. Ты ещё не решил, вернёшься ли.',
  'Дождь идёт ровно, без настроения. Как будто ему тоже всё равно.',
  'В детстве этот двор казался огромным. Сейчас — просто двор.',
  'Кто-то включил воду. Трубы в доме отвечают протяжным вздохом.',
  'Пахнет бензином и мокрой листвой. Так пахнет ноябрь.',
  'Ты помнишь этот двор летом: пыль, тополиный пух, чужие голоса.',
  'На асфальте — следы от шин. Интересно, кто сюда вообще заезжает.',
  'Хочется позвонить кому-нибудь. Но ты не знаешь, что сказать.',
  'Чужие окна светятся ровно, как будто внутри всё в порядке.',
  'Слышно, как батарея щёлкает. Значит, зима уже близко.',
  'Лампочка над подъездом моргает. Ей тоже тяжело.',
  'Всё это когда-нибудь снесут и построят другое. А пока — двор.',
  'Ты не спешишь. Впервые за долгое время — не спешишь.',
  'Если стоять долго, начинаешь слышать, как шумит район.',
];

// ── зоны с «первым разом» ────────────────────────────────────
const zones = [
  { id: 'play', x: playground.x, y: playground.y, w: playground.w, h: playground.d, text: 'Площадка новая, а качели всё равно старые. Всё лучшее здесь — старое.' },
  { id: 'hockey', x: hockey.x, y: hockey.y, w: hockey.w, h: hockey.d, text: 'Внутри коробки звук другой. Дождь стучит по бортам, как по трибунам.' },
  { id: 'park', x: 1600, y: 630, w: 430, h: 360, text: 'Машины стоят тесно, как на фотографии из девяностых. Половина — не ездит.' },
  { id: 'street', x: 0, y: 1370, w: W, h: 300, text: 'Дорога. Редко кто проезжает, но каждый раз звук — как событие.' },
  { id: 'garage', x: 2460, y: 900, w: 560, h: 240, text: 'Гаражи. Здесь всё ещё пахнет бензином и старым «Спартаком».' },
  { id: 'shop', x: 2100, y: 1180, w: 520, h: 200, text: 'Окно магазина светится на весь двор. Единственное место, где ещё «жизнь».' },
];

// ── машины по дороге ─────────────────────────────────────────
let nextCarAt = 6;

function spawnPassingCar() {
  const dir = Math.random() > 0.5 ? 1 : -1;
  const y = dir > 0 ? STREET.y1 - 32 : STREET.y0 + 32;
  const x = dir > 0 ? -120 : W + 120;
  const colors = ['#3d4650', '#5a4a42', '#4a4f46', '#6a6a62', '#2f3a44'];
  passingCars.push({
    x, y, dir,
    speed: 300 + Math.random() * 190,
    color: colors[(Math.random() * colors.length) | 0],
    w: 44, h: 104,
  });
  sound.carPass(dir, 3);
}

// ── обновление ───────────────────────────────────────────────
function update(dt, now) {
  state.time += dt;
  state.clock += dt / 11; // 1 игровая минута ≈ 11 секунд
  state.night = 0.4 + Math.min(0.16, (state.time / 900) * 0.16);
  if (window.__TOSKA_NIGHT__ != null) state.night = window.__TOSKA_NIGHT__;

  // дождь чуть усиливается и стихает
  rainAmount = 0.85 + Math.sin(state.time * 0.07) * 0.25;

  if (state.started) {
    player.update(dt, input, {
      run: input.run,
      onStep: (run) => sound.step(run),
      onBreath: () => {
        particles.push({ x: player.x + (player.facing === 'left' ? -6 : 5), y: player.y - 44, vx: 2, vy: -9, life: 1.5, max: 1.5, type: 'breath' });
      },
    });
    state.idle += dt;

    // камера
    updateCamera(dt);

    // ближайший объект
    nearest = player.mode === 'walk' ? findNearest() : null;
    updatePrompt();

    // диалог
    const d = state.dialog;
    if (d.active) {
      d.t -= dt;
      if (d.t <= 0) advanceDialog();
    }

    // зоны
    for (const z of zones) {
      if (player.x > z.x && player.x < z.x + z.w && player.y > z.y && player.y < z.y + z.h) {
        if (!state.seen.has(z.id)) {
          state.seen.add(z.id);
          if (!state.dialog.active) say([z.text]);
        }
      }
    }

    // случайные мысли
    if (state.idle > 34 && !state.dialog.active && player.mode === 'walk') {
      state.idle = 0;
      const t = idleThoughts[(hash01(state.thoughtSeed++) * idleThoughts.length) | 0];
      say([t]);
    }

    // машина на дороге
    nextCarAt -= dt;
    if (nextCarAt <= 0) {
      spawnPassingCar();
      nextCarAt = 16 + Math.random() * 26;
    }

    // далёкий гудок
    if (Math.random() < dt * 0.02) sound.distantHorn();
  }

  // мысль закрывается, если игрок пошёл
  if (state.dialog.active && player.moving && state.dialog.t > 2.2 && state.dialog.t < 99) {
    if (state.dialog.lines.length === 1) state.dialog.t = Math.min(state.dialog.t, 1.2);
  }

  // город
  for (let i = passingCars.length - 1; i >= 0; i--) {
    const c = passingCars[i];
    c.x += c.dir * c.speed * dt;
    if (c.x < -260 || c.x > W + 260) passingCars.splice(i, 1);
  }

  // проезжающие машины не пропускают сквозь себя — мягко отодвигают игрока
  if (player.mode === 'walk') {
    for (const c of passingCars) {
      const dx = Math.abs(player.x - c.x);
      const dy = Math.abs(player.y - c.y);
      if (dx < c.w / 2 + 12 && dy < c.h / 2 + 10) {
        const side = player.y < c.y ? -1 : 1;
        const ny = c.y + side * (c.h / 2 + 12);
        if (!isBlocked(player.x, ny, 10)) player.y = ny;
        else player.y = c.y - side * (c.h / 2 + 12);
      }
    }
  }

  // качели
  if (player.mode === 'swing') {
    state.swingActive = true;
  } else {
    state.swingActive = false;
  }

  // карусель
  state.carouselSpin += state.carouselVel * dt;
  state.carouselVel *= Math.pow(0.28, dt);

  // голуби
  if (state.pigeonsScared > 0) {
    state.pigeonsScared -= dt;
    for (const p of pigeons) {
      p.fly = Math.min(150, (p.fly || 0) + (p.flyV || 80) * dt);
      p.flyV = (p.flyV || 80) * Math.pow(0.7, dt);
    }
  } else {
    for (const p of pigeons) {
      if (p.fly > 0) p.fly = Math.max(0, p.fly - 40 * dt);
    }
  }

  // кот следует
  if (state.catFollowing) {
    const dx = player.x - cat.x;
    const dy = player.y - cat.y;
    const d2 = Math.hypot(dx, dy);
    if (d2 > 56) {
      cat.x += (dx / d2) * 46 * dt;
      cat.y += (dy / d2) * 46 * dt;
      if (!isBlocked(cat.x, cat.y, 6)) {
        // ок
      } else {
        cat.x -= (dx / d2) * 46 * dt;
        cat.y -= (dy / d2) * 46 * dt;
      }
    }
  }

  // мяч
  if (ball.vx || ball.vy) {
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    ball.vx *= Math.pow(0.18, dt);
    ball.vy *= Math.pow(0.18, dt);
    if (isBlocked(ball.x, ball.y, 5)) {
      ball.x -= ball.vx * dt;
      ball.y -= ball.vy * dt;
      ball.vx *= -0.6;
      ball.vy *= -0.6;
    }
    if (Math.hypot(ball.vx, ball.vy) < 4) {
      ball.vx = 0;
      ball.vy = 0;
    }
  }

  // частицы
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.type === 'breath') {
      p.vy -= 3 * dt;
      p.vx += 2 * dt;
    }
    if (p.type === 'steam') {
      p.vy -= 4 * dt;
      p.vx += Math.sin(p.life * 3) * 3 * dt;
    }
    if (p.life <= 0) particles.splice(i, 1);
  }

  // пар из люка
  if (Math.random() < dt * 4) {
    particles.push({
      x: 1330 + (Math.random() - 0.5) * 10,
      y: 940,
      vx: (Math.random() - 0.5) * 6,
      vy: -10 - Math.random() * 8,
      life: 2.6 + Math.random() * 1.6,
      max: 4.2,
      type: 'steam',
      r: 6 + Math.random() * 6,
    });
  }

  // дым Серёги
  if (Math.random() < dt * 0.7) {
    smokePuffs.push({ x: 0, y: 0, life: 2.4 });
  }
  for (let i = smokePuffs.length - 1; i >= 0; i--) {
    const s = smokePuffs[i];
    s.life += dt;
    s.x += dt * 9;
    s.y -= dt * 12;
    if (s.life > 2.4) smokePuffs.splice(i, 1);
  }

  // часы
  const mins = Math.floor(state.clock) % 1440;
  const hh = String(Math.floor(mins / 60)).padStart(2, '0');
  const mm = String(mins % 60).padStart(2, '0');
  clockTimeEl.textContent = `${hh}:${mm}`;

  // подсказка внизу гаснет
  if (hintTimer > 0) {
    hintTimer -= dt;
    if (hintTimer <= 0) keysHintEl.classList.add('fade');
  }
}

function updatePrompt() {
  let text = '';
  if (player.mode === 'sit' || player.mode === 'swing') {
    text = '<b>E</b>встать';
  } else if (state.dialog.active) {
    text = '<b>E</b>дальше';
  } else if (nearest) {
    text = `<b>E</b>${nearest.label}`;
  }
  if (text !== lastPrompt) {
    lastPrompt = text;
    if (text) {
      promptEl.innerHTML = text;
      promptEl.classList.add('show');
    } else {
      promptEl.classList.remove('show');
    }
  }
}

// ── отрисовка ────────────────────────────────────────────────
function render(now) {
  const t = state.time;
  const zoom = cam.zoom;
  const viewW = vw / zoom;
  const viewH = vh / zoom;
  const x0 = cam.x - viewW / 2;
  const y0 = cam.y - viewH / 2;
  const x1 = x0 + viewW;
  const y1 = y0 + viewH;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#0a0d12';
  ctx.fillRect(0, 0, vw, vh);

  // ── мир ──
  ctx.save();
  ctx.translate(vw / 2, vh / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-cam.x, -cam.y);

  // земля (только видимая часть)
  const sx = Math.max(0, Math.floor(x0));
  const sy = Math.max(0, Math.floor(y0));
  const sw = Math.min(W - sx, Math.ceil(viewW) + 4);
  const sh = Math.min(H - sy, Math.ceil(viewH) + 4);
  if (sw > 0 && sh > 0 && ground) {
    ctx.drawImage(ground, sx, sy, sw, sh, sx, sy, sw, sh);
  }

  // дальний план за дорогой (запечён)
  if (backdropSprite) ctx.drawImage(backdropSprite.canvas, backdropSprite.x, backdropSprite.y);

  // ── сортировка объектов по глубине ──
  const items = [];

  const inView = (x, y, pad = 220) => x > x0 - pad && x < x1 + pad && y > y0 - pad && y < y1 + pad;

  for (const b of buildings) {
    if (!inView(b.x + b.w / 2, b.baseY, b.w / 2 + 300)) continue;
    if (b.shop) {
      items.push({ y: b.baseY, draw: () => drawBuilding(ctx, b, t) });
    } else {
      const spr = buildingSprites.get(b.id);
      if (spr) items.push({ y: b.baseY, draw: () => ctx.drawImage(spr.canvas, spr.x, spr.y) });
    }
  }

  if (inView(garages.x + garages.w / 2, garages.baseY, garages.w / 2 + 200)) {
    items.push({ y: garages.baseY, draw: () => { if (sprites.garages) ctx.drawImage(sprites.garages.canvas, sprites.garages.x, sprites.garages.y); } });
  }

  for (const tr of trees) {
    if (!inView(tr.x, tr.y)) continue;
    const spr = sprites.trees.get(tr);
    items.push({ y: tr.y, draw: () => {
      if (spr) ctx.drawImage(spr.canvas, spr.x, spr.y);
      drawTreeLeaves(ctx, tr, t);
    } });
  }

  for (const l of lamps) {
    if (!inView(l.x, l.y)) continue;
    const spr = sprites.lamps.get(l);
    items.push({ y: l.y, draw: () => { if (spr) ctx.drawImage(spr.canvas, spr.x, spr.y); } });
  }

  for (const b of benches) {
    if (!inView(b.x, b.y, 120)) continue;
    const spr = sprites.benches.get(b);
    items.push({ y: b.y, draw: () => { if (spr) ctx.drawImage(spr.canvas, spr.x, spr.y); } });
  }

  for (const dd of dumpsters) {
    if (!inView(dd.x, dd.y, 120)) continue;
    const spr = sprites.dumpsters.get(dd);
    items.push({ y: dd.y, draw: () => { if (spr) ctx.drawImage(spr.canvas, spr.x, spr.y); } });
  }

  if (inView(trafo.x + trafo.w / 2, trafo.y + trafo.d, 200)) {
    items.push({ y: trafo.y + trafo.d, draw: () => { if (sprites.trafo) ctx.drawImage(sprites.trafo.canvas, sprites.trafo.x, sprites.trafo.y); } });
  }

  if (inView(hockey.x + hockey.w / 2, hockey.y + hockey.d / 2, hockey.w)) {
    items.push({ y: hockey.y - 40, draw: () => { if (sprites.hockey) ctx.drawImage(sprites.hockey.canvas, sprites.hockey.x, sprites.hockey.y); } });
  }

  if (inView(busStop.x + busStop.w / 2, busStop.y + busStop.d, 220)) {
    items.push({ y: busStop.y + busStop.d, draw: () => { if (sprites.busStop) ctx.drawImage(sprites.busStop.canvas, sprites.busStop.x, sprites.busStop.y); } });
  }

  if (inView(playground.x + playground.w / 2, playground.y + playground.d / 2, 420)) {
    items.push({ y: mushroom.y, draw: () => { if (sprites.mushroom) ctx.drawImage(sprites.mushroom.canvas, sprites.mushroom.x, sprites.mushroom.y); } });
    items.push({ y: sandbox.y + sandbox.d, draw: () => { if (sprites.sandbox) ctx.drawImage(sprites.sandbox.canvas, sprites.sandbox.x, sprites.sandbox.y); } });
    items.push({ y: slide.y + slide.d, draw: () => { if (sprites.slide) ctx.drawImage(sprites.slide.canvas, sprites.slide.x, sprites.slide.y); } });
    items.push({ y: swing.y + 18, draw: () => drawSwing(ctx, { seat: state.swingSeat, active: state.swingActive }, t) });
    items.push({
      y: carousel.y + 12,
      draw: () => {
        if (sprites.carousel) ctx.drawImage(sprites.carousel.canvas, sprites.carousel.x, sprites.carousel.y);
        ctx.save();
        ctx.translate(carousel.x, carousel.y);
        ctx.rotate(state.carouselSpin);
        ctx.strokeStyle = 'rgba(240,236,220,.22)';
        ctx.lineWidth = 1.4;
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * 8, Math.sin(a) * 5);
          ctx.lineTo(Math.cos(a) * 34, Math.sin(a) * 19);
          ctx.stroke();
        }
        ctx.restore();
      },
    });
  }

  // машины во дворе
  for (const c of cars) {
    if (!inView(c.x + c.w / 2, c.y + c.h / 2, 160)) continue;
    const spr = sprites.cars.get(c);
    items.push({ y: c.y + c.h, draw: () => { if (spr) ctx.drawImage(spr.canvas, spr.x, spr.y); } });
  }

  // голуби
  for (const p of pigeons) {
    if (!inView(p.x, p.y, 140)) continue;
    items.push({ y: p.y, draw: () => drawPigeon(ctx, p, t) });
  }

  // кот
  if (inView(cat.x, cat.y, 120)) {
    items.push({ y: cat.y, draw: () => drawCat(ctx, cat, t, state.night - 0.2) });
  }

  // мяч
  if (inView(ball.x, ball.y, 100)) {
    items.push({ y: ball.y, draw: () => drawBall(ctx, ball, t) });
  }

  // NPC
  for (const n of npcs) {
    if (!inView(n.x, n.y, 120)) continue;
    if (n.id === 'grandma') {
      items.push({ y: n.y, draw: () => drawGrandma(ctx, n.x, n.y, t) });
    } else {
      items.push({ y: n.y, draw: () => drawMan(ctx, n.x, n.y, t, smokePuffs) });
    }
  }

  // проезжающие машины
  for (const c of passingCars) {
    items.push({ y: c.y + 60, draw: () => drawStreetCar(ctx, c) });
  }

  // игрок
  items.push({ y: player.y, draw: () => player.draw(ctx, t, state.night) });

  items.sort((a, b) => a.y - b.y);
  for (const it of items) it.draw();

  // отражения персонажа в лужах — лёгкий штрих
  for (const p of puddles) {
    if (!inView(p.x, p.y, 120)) continue;
    const dx = Math.abs(player.x - p.x);
    const dy = Math.abs(player.y - p.y);
    if (dx < p.rx && dy < p.ry * 2.2) {
      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = '#9fb3c4';
      ctx.beginPath();
      ctx.ellipse(p.x + (player.x - p.x) * 0.4, p.y + 2, 7, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // частицы (пар, дыхание)
  for (const p of particles) {
    const k = Math.max(0, p.life / p.max);
    if (p.type === 'breath') {
      ctx.globalAlpha = k * 0.16;
      ctx.fillStyle = '#dfe7e8';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2 + (1 - k) * 5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.globalAlpha = k * 0.1;
      ctx.fillStyle = '#c8d2d4';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r + (1 - k) * 22, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  // круги от дождя
  drawSplashes(ctx, cam, vw, vh, t, quality.level === 0 ? 70 : quality.level === 1 ? 40 : 0);

  ctx.restore();

  // ── свет ──
  // всё статичное (фонари, окна, подъезды, небо) уже запечено в lightLayer,
  // в кадре рисуются только фары проезжающих машин
  const dynamicLights = [];
  for (const c of passingCars) {
    dynamicLights.push({ x: c.x + c.dir * 46, y: c.y, r: 190, color: [255, 244, 214], a: 0.36 });
  }

  const playerLight = player.flashlight;
  drawLighting(ctx, cam, vw, vh, lightLayer, state.night, dynamicLights);
  if (playerLight) drawFlashlight(ctx, cam, vw, vh, player, t);

  // дождь поверх мира, но под туманом
  drawRain(ctx, vw, vh, t, rainAmount * (quality.level === 0 ? 1 : quality.level === 1 ? 0.6 : 0.35), 0.3);
  if (quality.level < 2) drawFog(ctx, vw, vh, t);
  if (quality.level < 1) drawLensDrops(ctx, vw, vh, t);
  colorGrade(ctx, vw, vh, state.night);
  drawVignette(ctx, vw, vh);
}

function drawStreetCar(ctx, c) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(c.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
  // тень
  ctx.fillStyle = 'rgba(0,0,0,.4)';
  ctx.fillRect(-c.w / 2 + 4, -c.h / 2 + 6, c.w, c.h);
  const g = ctx.createLinearGradient(-c.w / 2, 0, c.w / 2, 0);
  g.addColorStop(0, '#20262c');
  g.addColorStop(0.5, c.color);
  g.addColorStop(1, '#161a1f');
  ctx.fillStyle = g;
  rr(ctx, -c.w / 2, -c.h / 2, c.w, c.h, 9);
  ctx.fill();
  ctx.fillStyle = 'rgba(40,52,60,.9)';
  rr(ctx, -c.w / 2 + 5, -c.h * 0.34, c.w - 10, c.h * 0.2, 4);
  ctx.fill();
  rr(ctx, -c.w / 2 + 5, c.h * 0.18, c.w - 10, c.h * 0.16, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(232,226,206,.85)';
  ctx.fillRect(-c.w * 0.34, -c.h / 2 + 1, 8, 3);
  ctx.fillRect(c.w * 0.16, -c.h / 2 + 1, 8, 3);
  ctx.fillStyle = 'rgba(190,60,50,.9)';
  ctx.fillRect(-c.w * 0.34, c.h / 2 - 4, 8, 3);
  ctx.fillRect(c.w * 0.16, c.h / 2 - 4, 8, 3);
  // блик
  ctx.fillStyle = 'rgba(200,220,235,.08)';
  ctx.fillRect(-c.w / 2 + 3, -c.h * 0.1, 2, c.h * 0.4);
  ctx.restore();
}

// ── цикл ─────────────────────────────────────────────────────
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt, now);
  render(now);
  adaptQuality(dt);
  requestAnimationFrame(frame);
}

// ── запуск ───────────────────────────────────────────────────
// ── зерно: плитка шума для CSS-слоя (генерится один раз) ─────
function initGrain() {
  const el = document.getElementById('grain');
  if (!el) return;
  const size = 128;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = (Math.random() * 255) | 0;
    d[i] = v;
    d[i + 1] = v;
    d[i + 2] = v;
    d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  let url;
  try {
    url = c.toDataURL ? c.toDataURL('image/png') : `data:image/png;base64,${c.toBuffer('image/png').toString('base64')}`;
  } catch (e) {
    return; // окружение без экспорта картинок (например, headless-тесты) — просто без зерна
  }
  el.style.backgroundImage = `url(${url})`;
}

function boot() {
  resize();
  initGrain();
  ctx.fillStyle = '#0a0d12';
  ctx.fillRect(0, 0, vw, vh);

  loadingEl.querySelector('span').textContent = 'двор просыпается…';

  // даём браузеру отрисовать загрузку
  setTimeout(() => {
    initWorld();
    loadingEl.classList.add('done');
    setTimeout(() => loadingEl.remove(), 900);
    requestAnimationFrame((t) => {
      last = t;
      frame(t);
    });
  }, 60);
}

// отладочный доступ (удобно и для тестов)
window.__TOSKA__ = { player, state, cam, sound, interactables, zones, quality };

// клик по мышке тоже стартует
canvas.addEventListener('pointerdown', () => {
  if (!state.started) startGame();
});

boot();
