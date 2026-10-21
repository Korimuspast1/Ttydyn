// Бенчмарк: считает операции canvas за кадр (независимо от бэкенда).
// Запуск: node tools/bench.mjs
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { createCanvas } from '@napi-rs/canvas';

const noop = () => {};
const VW = 1440;
const VH = 900;

function makeCanvas(w = VW, h = VH) {
  const c = createCanvas(w, h);
  c.style = {};
  c.addEventListener = noop;
  c.removeEventListener = noop;
  c.setPointerCapture = noop;
  c.getBoundingClientRect = () => ({ left: 0, top: 0, width: c.width, height: c.height });
  c.querySelector = () => makeEl();
  return c;
}

function makeEl() {
  const classes = new Set();
  return {
    style: {},
    textContent: '',
    innerHTML: '',
    classList: {
      add: (...c) => c.forEach((x) => classes.add(x)),
      remove: (...c) => c.forEach((x) => classes.delete(x)),
      toggle: (c, f) => { if (f === undefined) (classes.has(c) ? classes.delete(c) : classes.add(c)); else if (f) classes.add(c); },
      contains: (c) => classes.has(c),
    },
    addEventListener: noop,
    removeEventListener: noop,
    remove: noop,
    setAttribute: noop,
    appendChild: noop,
    querySelector: () => makeEl(),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 120, height: 120 }),
  };
}

const listeners = new Map();
const els = new Map();
const gameCanvas = makeCanvas();
els.set('game', gameCanvas);

const documentStub = {
  getElementById(id) { if (!els.has(id)) els.set(id, makeEl()); return els.get(id); },
  createElement(tag) { return tag === 'canvas' ? makeCanvas(1, 1) : makeEl(); },
  addEventListener: noop,
  body: makeEl(),
};

let rafQueue = [];
const win = {
  innerWidth: VW,
  innerHeight: VH,
  devicePixelRatio: 1,
  addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(fn); },
  removeEventListener: noop,
  matchMedia: () => ({ matches: false, addEventListener: noop }),
  AudioContext: null,
  requestAnimationFrame: (cb) => { rafQueue.push(cb); return rafQueue.length; },
  setTimeout,
  clearTimeout,
};

globalThis.window = win;
globalThis.document = documentStub;
globalThis.matchMedia = win.matchMedia;
globalThis.requestAnimationFrame = win.requestAnimationFrame;
globalThis.cancelAnimationFrame = noop;

let now = 1000;
function frames(n = 1, dt = 16.7) {
  for (let i = 0; i < n; i++) {
    const q = rafQueue;
    rafQueue = [];
    if (!q.length) return;
    now += dt;
    for (const cb of q) cb(now);
  }
}

await import(pathToFileURL(resolve('src/main.js')).href);
await new Promise((r) => setTimeout(r, 500));

const api = window.__TOSKA__;

// ── счётчики ──
const ctx = gameCanvas.getContext('2d');
const counters = {};
const COUNTED = ['fill', 'stroke', 'beginPath', 'arc', 'ellipse', 'moveTo', 'lineTo',
  'quadraticCurveTo', 'bezierCurveTo', 'createRadialGradient', 'createLinearGradient',
  'drawImage', 'fillRect', 'strokeRect', 'fillText', 'save', 'restore', 'clip', 'translate', 'scale', 'rotate'];
const originals = {};
for (const m of COUNTED) {
  const fn = ctx[m];
  if (typeof fn !== 'function') continue;
  originals[m] = fn;
  counters[m] = 0;
  ctx[m] = function (...a) { counters[m]++; return fn.apply(ctx, a); };
}
// createPattern не нужен

const t0 = Date.now();
const MEASURE_FRAMES = 60;

function measure(label, x, y, zoom) {
  api.player.mode = 'walk';
  api.player.x = x; api.player.y = y;
  api.player.vx = 0; api.player.vy = 0;
  api.cam.x = x; api.cam.y = y - 30;
  api.cam.zoom = zoom;
  frames(6); // прогреть (в т.ч. кэши)
  for (const m of COUNTED) if (counters[m] !== undefined) counters[m] = 0;
  const started = Date.now();
  frames(MEASURE_FRAMES);
  const ms = (Date.now() - started) / MEASURE_FRAMES;
  const total = Object.values(counters).reduce((a, b) => a + b, 0);
  const important = ['fill', 'stroke', 'createRadialGradient', 'createLinearGradient', 'drawImage', 'ellipse', 'arc'];
  const detail = important.filter((m) => counters[m] !== undefined).map((m) => `${m}=${counters[m]}`).join(' ');
  console.log(`${label.padEnd(18)} ${ms.toFixed(1)} мс/кадр  ops=${total}  ${detail}`);
}

measure('широкий двор', 1200, 900, 0.62);
measure('площадка', 760, 830, 1.0);
measure('у дома A', 700, 380, 1.0);
measure('парковка', 1750, 1000, 1.0);
measure('гаражи', 2650, 1180, 1.0);
measure('дорога/остановка', 800, 1290, 1.0);

console.log(`итого бенчмарка: ${((Date.now() - t0) / 1000).toFixed(1)} с`);
