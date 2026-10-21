// Прогон игры в Node с заглушкой canvas/DOM.
// Ловит ошибки времени выполнения (не визуальные).
// Запуск: node tools/smoke.mjs
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const noop = () => {};
const gradient = () => ({ addColorStop: noop });

let canvasCount = 0;

function makeCtx(canvas) {
  const c = {
    canvas,
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    font: '10px sans-serif',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    filter: 'none',
    imageSmoothingEnabled: true,
    shadowBlur: 0,
    shadowColor: '',
    createLinearGradient: gradient,
    createRadialGradient: gradient,
    createPattern: () => null,
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    putImageData: noop,
    measureText: () => ({ width: 10 }),
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
  };
  const methods = [
    'save', 'restore', 'scale', 'rotate', 'translate', 'transform', 'setTransform',
    'clearRect', 'fillRect', 'strokeRect', 'beginPath', 'closePath', 'moveTo', 'lineTo',
    'bezierCurveTo', 'quadraticCurveTo', 'arc', 'arcTo', 'ellipse', 'rect', 'roundRect',
    'fill', 'stroke', 'clip', 'fillText', 'strokeText', 'setLineDash', 'getLineDash',
    'drawImage', 'drawFocusIfNeeded',
  ];
  for (const m of methods) c[m] = noop;
  return c;
}

function makeCanvas() {
  canvasCount++;
  const canvas = {
    tagName: 'CANVAS',
    width: 300,
    height: 150,
    style: {},
    _ctx: null,
    getContext() {
      if (!this._ctx) this._ctx = makeCtx(this);
      return this._ctx;
    },
    addEventListener: noop,
    removeEventListener: noop,
    setPointerCapture: noop,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 300, height: 150 }),
  };
  return canvas;
}

function makeEl(tag = 'div') {
  const classes = new Set();
  const e = {
    tagName: tag.toUpperCase(),
    style: {},
    textContent: '',
    innerHTML: '',
    classList: {
      add: (...c) => c.forEach((x) => classes.add(x)),
      remove: (...c) => c.forEach((x) => classes.delete(x)),
      toggle: (c, f) => {
        if (f === undefined) classes.has(c) ? classes.delete(c) : classes.add(c);
        else f ? classes.add(c) : classes.delete(c);
      },
      contains: (c) => classes.has(c),
    },
    addEventListener: noop,
    removeEventListener: noop,
    remove: noop,
    setAttribute: noop,
    appendChild: noop,
    querySelector: () => makeEl('span'),
    setPointerCapture: noop,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 120, height: 120 }),
  };
  return e;
}

// ── глобальные заглушки ──
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
    return tag === 'canvas' ? makeCanvas() : makeEl(tag);
  },
  addEventListener: noop,
  body: makeEl('body'),
};

const windowStub = {
  innerWidth: 1440,
  innerHeight: 900,
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

let rafQueue = [];

globalThis.window = windowStub;
globalThis.document = documentStub;
globalThis.matchMedia = windowStub.matchMedia;
globalThis.requestAnimationFrame = windowStub.requestAnimationFrame;
globalThis.cancelAnimationFrame = noop;


const errors = [];
process.on('uncaughtException', (e) => {
  errors.push(e);
  console.error('UNCAUGHT:', e);
});

function fire(type, ev = {}) {
  for (const fn of listeners.get(type) || []) {
    try {
      fn({ preventDefault: noop, repeat: false, code: '', ...ev });
    } catch (e) {
      errors.push(e);
      console.error(`ERROR in ${type} handler (${ev.code || ''}):`, e);
    }
  }
}

let now = 1000;
function frames(n = 1, dt = 16.7) {
  for (let i = 0; i < n; i++) {
    const q = rafQueue;
    rafQueue = [];
    if (!q.length) return i;
    now += dt;
    for (const cb of q) {
      try {
        cb(now);
      } catch (e) {
        errors.push(e);
        console.error('ERROR in frame:', e);
        return i;
      }
    }
  }
  return n;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  await import(pathToFileURL(resolve('src/main.js')).href);
  await wait(300);
  console.log('canvas objects created:', canvasCount);

  frames(3);
  console.log('title frames ok');

  fire('keydown', { code: 'KeyW' }); // старт
  frames(5);

  const api = window.__TOSKA__;
  if (!api) throw new Error('debug api missing');
  console.log('player at', api.player.x.toFixed(1), api.player.y.toFixed(1));

  // пройтись во все стороны
  const dirs = ['KeyD', 'KeyS', 'KeyA', 'KeyW', 'KeyD', 'KeyS'];
  for (const code of dirs) {
    fire('keydown', { code });
    frames(40);
    fire('keyup', { code });
  }
  console.log('moved to', api.player.x.toFixed(1), api.player.y.toFixed(1));

  // все взаимодействия
  for (const it of api.interactables) {
    api.player.mode = 'walk';
    api.player.x = it.x;
    api.player.y = it.y + 6;
    frames(2);
    fire('keydown', { code: 'KeyE' });
    frames(20);
    fire('keydown', { code: 'KeyE' }); // дальше / встать
    frames(12);
    fire('keydown', { code: 'KeyE' });
    frames(12);
    // встать, если сидит
    api.player.mode = 'walk';
    console.log('  ok:', it.id);
  }

  // зонт/фонарик/звук
  fire('keydown', { code: 'KeyQ' });
  fire('keydown', { code: 'KeyF' });
  frames(20);
  fire('keydown', { code: 'KeyM' });
  fire('keydown', { code: 'KeyM' });
  fire('keydown', { code: 'KeyF' });
  frames(40);

  // долгий прогон: камера, дождь, машины
  fire('keydown', { code: 'KeyD' });
  fire('keydown', { code: 'ShiftLeft' });
  frames(600);
  fire('keyup', { code: 'KeyD' });
  frames(300);

  console.log('final:', api.player.x.toFixed(1), api.player.y.toFixed(1), 'clock:', documentStub.getElementById('clock-time').textContent);

  if (errors.length) {
    console.error(`\n${errors.length} ERROR(S)`);
    process.exit(1);
  }
  console.log('\nSMOKE OK');
  process.exit(0);
})();
