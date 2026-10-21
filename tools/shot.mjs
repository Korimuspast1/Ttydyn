// Реальные скриншоты игры без браузера: @napi-rs/canvas (Skia) + заглушка DOM.
// Запуск: node tools/shot.mjs  → PNG в /tmp/shots
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import fs from 'node:fs';
import { createCanvas } from '@napi-rs/canvas';

const noop = () => {};
const OUT = '/tmp/shots';
fs.mkdirSync(OUT, { recursive: true });

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
      toggle: (c, f) => {
        if (f === undefined) (classes.has(c) ? classes.delete(c) : classes.add(c));
        else (f ? classes.add(c) : classes.delete(c));
      },
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
  getElementById(id) {
    if (!els.has(id)) els.set(id, makeEl());
    return els.get(id);
  },
  createElement(tag) {
    return tag === 'canvas' ? makeCanvas(1, 1) : makeEl();
  },
  addEventListener: noop,
  body: makeEl(),
};

let rafQueue = [];
const win = {
  innerWidth: VW,
  innerHeight: VH,
  devicePixelRatio: 1,
  addEventListener(type, fn) {
    if (!listeners.has(type)) listeners.set(type, []);
    listeners.get(type).push(fn);
  },
  removeEventListener: noop,
  matchMedia: () => ({ matches: false, addEventListener: noop }),
  AudioContext: null,
  requestAnimationFrame: (cb) => {
    rafQueue.push(cb);
    return rafQueue.length;
  },
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

function fire(type, ev = {}) {
  for (const fn of listeners.get(type) || []) fn({ preventDefault: noop, repeat: false, code: '', ...ev });
}

function shot(name) {
  const file = `${OUT}/${name}.png`;
  fs.writeFileSync(file, gameCanvas.toBuffer('image/png'));
  console.log('saved', file);
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

await import(pathToFileURL(resolve('src/main.js')).href);
await wait(500);

const api = window.__TOSKA__;

function goTo(x, y, zoom = null, framesN = 24) {
  api.player.mode = 'walk';
  api.player.x = x;
  api.player.y = y;
  api.player.vx = 0;
  api.player.vy = 0;
  if (zoom) api.cam.zoom = zoom;
  api.cam.x = x;
  api.cam.y = y - 30;
  frames(framesN);
}

// стартовый вид (титульный фон)
frames(2);
shot('00-world-start');

fire('keydown', { code: 'KeyW' });
frames(30);
shot('01-start');

// старт с зонтом и фонариком
fire('keydown', { code: 'KeyQ' });
frames(10);
shot('02-umbrella');
fire('keydown', { code: 'KeyF' });
frames(10);
shot('03-flashlight');
fire('keydown', { code: 'KeyQ' });
fire('keydown', { code: 'KeyF' });

// качели
goTo(760, 830);
shot('04-playground');

// парковка
goTo(1750, 1000);
shot('05-parking');

// коробка
goTo(430, 760);
shot('06-hockey');

// магазин
goTo(2360, 1400);
frames(6);
shot('07-shop');

// двор у дома A
goTo(700, 380, 1.0, 30);
shot('08-house');

// остановка и дорога
goTo(800, 1290, 1.0);
shot('09-street');

// гаражи
goTo(2650, 1180, 1.0);
shot('10-garages');

// общий вид
goTo(1200, 900, 0.62, 20);
shot('11-wide');

// без ночного затемнения — проверить геометрию земли
window.__TOSKA_NIGHT__ = 0;
goTo(1200, 900, 0.62, 20);
shot('11b-wide-day');
goTo(700, 620, 1.4, 16);
shot('11c-house-close-day');
window.__TOSKA_NIGHT__ = null;

// ночь / фонари крупно
goTo(400, 700, 1.6, 20);
shot('12-lamp');

process.exit(0);
