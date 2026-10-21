// ─────────────────────────────────────────────────────────────
//  ТОСКА — атмосфера: дождь, свет, туман, зерно
// ─────────────────────────────────────────────────────────────

// ── дождь (экранные координаты) ──────────────────────────────
// Капли описываются один раз (без тригонометрии в кадре), дальше только позиция.
let rainTable = null;
let rainKey = '';

function buildRainTable(w, h, intensity) {
  const drops = Math.floor(220 * intensity);
  const arr = new Array(drops);
  for (let i = 0; i < drops; i++) {
    const seed = i * 12.9898;
    const depth = 0.45 + (((Math.sin(seed) * 43758.5453) % 1) + 1) % 1 * 0.55;
    const speed = 620 + depth * 780;
    const len = 10 + depth * 22;
    arr[i] = {
      sx: (((Math.sin(seed * 1.7) * 10000) % 1) + 1) % 1,
      sy: (((Math.sin(seed * 2.3) * 10000) % 1) + 1) % 1,
      speed,
      len,
      style: `rgba(196,214,226,${0.05 + depth * 0.13})`,
      lw: 0.7 + depth * 0.9,
    };
  }
  rainTable = arr;
  rainKey = `${w}x${h}x${intensity}`;
}

export function drawRain(ctx, w, h, time, intensity = 1, wind = 0.28) {
  const key = `${w}x${h}x${intensity}`;
  if (!rainTable || rainKey !== key) buildRainTable(w, h, intensity);
  const TW = w + 200;
  const TH = h + 140;
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < rainTable.length; i++) {
    const d = rainTable[i];
    const x = d.sx * TW - 100 + ((time * wind * d.speed * 0.4) % TW);
    const y = ((d.sy * h + time * d.speed) % TH) - 70;
    ctx.strokeStyle = d.style;
    ctx.lineWidth = d.lw;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + wind * d.len, y + d.len);
    ctx.stroke();
  }
  ctx.restore();
}

// ── круги на лужах/асфальте ───────────────────────────────────
let splashTable = null;

function buildSplashTable() {
  const arr = new Array(70);
  for (let i = 0; i < 70; i++) {
    arr[i] = {
      hx: (((Math.sin(i * 91.7) * 10000) % 1) + 1) % 1,
      hy: (((Math.sin(i * 47.3) * 10000) % 1) + 1) % 1,
    };
  }
  splashTable = arr;
}

export function drawSplashes(ctx, cam, vw, vh, time, limit = 70) {
  const pad = 80;
  const x0 = cam.x - vw / 2 / cam.zoom - pad;
  const x1 = cam.x + vw / 2 / cam.zoom + pad;
  const y0 = cam.y - vh / 2 / cam.zoom - pad;
  const y1 = cam.y + vh / 2 / cam.zoom + pad;
  ctx.save();
  if (!splashTable) buildSplashTable();
  const n = Math.min(splashTable.length, limit);
  for (let i = 0; i < n; i++) {
    const { hx, hy } = splashTable[i];
    const period = 0.7 + hx * 0.9;
    const t = ((time + hy * period) % period) / period;
    const x = x0 + hx * (x1 - x0);
    const y = y0 + hy * (y1 - y0);
    const r = 1.5 + t * (5 + hy * 6);
    ctx.strokeStyle = `rgba(190,210,222,${(1 - t) * 0.16})`;
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.42, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

// ── освещение ────────────────────────────────────────────────
// lights: [{x, y, r, color:[r,g,b], a}] в мировых координатах.
// Статичные огни запекаются в один слой (buildLightLayer) — это убирает
// десятки градиентов из каждого кадра. Динамичные (фары машин) рисуются на ходу.
const LIGHT_SCALE = 0.34; // свет мягкий — можно мельче, это экономит пиксели на блте

// один источник света: halo + ядро того же цветового семейства
function paintLight(ctx, x, y, r, color, a) {
  const cr = color[0], cg = color[1], cb = color[2];
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${cr},${cg},${cb},${a})`);
  g.addColorStop(0.35, `rgba(${cr},${cg},${cb},${a * 0.52})`);
  g.addColorStop(0.72, `rgba(${cr},${cg},${cb},${a * 0.16})`);
  g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  // ядро — чуть теплее/ярче источника, но того же цвета:
  // раньше было белое, из-за чего фонари выглядели белыми пятнами среди оранжевого
  const hr = Math.min(255, cr + 40), hg = Math.min(255, cg + 36), hb = Math.min(255, cb + 24);
  const g2 = ctx.createRadialGradient(x, y, 0, x, y, r * 0.2);
  g2.addColorStop(0, `rgba(${hr},${hg},${hb},${Math.min(0.5, a * 1.4)})`);
  g2.addColorStop(1, `rgba(${hr},${hg},${hb},0)`);
  ctx.fillStyle = g2;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.2, 0, Math.PI * 2);
  ctx.fill();
}

// запекание всех статичных огней мира в один слой (половина разрешения)
export function buildLightLayer(lights, worldW, worldH) {
  const w = Math.max(1, Math.round(worldW * LIGHT_SCALE));
  const h = Math.max(1, Math.round(worldH * LIGHT_SCALE));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.globalCompositeOperation = 'lighter';
  for (const L of lights) {
    paintLight(g, L.x * LIGHT_SCALE, L.y * LIGHT_SCALE, L.r * LIGHT_SCALE, L.color, L.a);
  }
  return c;
}

export function drawLighting(ctx, cam, vw, vh, layer, darkness, dynamicLights = []) {
  // ночь
  ctx.save();
  ctx.fillStyle = `rgba(10,15,26,${darkness})`;
  ctx.fillRect(0, 0, vw, vh);

  ctx.globalCompositeOperation = 'lighter';
  if (layer) {
    const z = cam.zoom;
    let sx = (cam.x - vw / 2 / z) * LIGHT_SCALE;
    let sy = (cam.y - vh / 2 / z) * LIGHT_SCALE;
    let sw = (vw / z) * LIGHT_SCALE;
    let sh = (vh / z) * LIGHT_SCALE;
    if (sx < 0) { sw += sx; sx = 0; }
    if (sy < 0) { sh += sy; sy = 0; }
    if (sx + sw > layer.width) sw = layer.width - sx;
    if (sy + sh > layer.height) sh = layer.height - sy;
    if (sw > 0 && sh > 0) {
      const dx = (sx / LIGHT_SCALE - cam.x) * z + vw / 2;
      const dy = (sy / LIGHT_SCALE - cam.y) * z + vh / 2;
      ctx.drawImage(layer, sx, sy, sw, sh, dx, dy, sw / LIGHT_SCALE, sh / LIGHT_SCALE);
    }
  }
  for (const L of dynamicLights) {
    const sx = (L.x - cam.x) * cam.zoom + vw / 2;
    const sy = (L.y - cam.y) * cam.zoom + vh / 2;
    const R = L.r * cam.zoom;
    if (sx < -R || sy < -R || sx > vw + R || sy > vh + R) continue;
    paintLight(ctx, sx, sy, R, L.color, L.a);
  }
  ctx.restore();
}

// ── конус фонарика ───────────────────────────────────────────
export function drawFlashlight(ctx, cam, vw, vh, player, time) {
  const sx = (player.x - cam.x) * cam.zoom + vw / 2;
  const sy = (player.y - 26 - cam.y) * cam.zoom + vh / 2;
  let a = 0;
  if (player.facing === 'down') a = Math.PI / 2;
  else if (player.facing === 'up') a = -Math.PI / 2;
  else if (player.facing === 'left') a = Math.PI;
  const len = 300 * cam.zoom;
  const spread = 0.34;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.translate(sx, sy);
  ctx.rotate(a);
  const g = ctx.createLinearGradient(0, 0, len, 0);
  g.addColorStop(0, 'rgba(255,246,220,.20)');
  g.addColorStop(0.45, 'rgba(255,240,205,.11)');
  g.addColorStop(1, 'rgba(255,235,190,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(len, -Math.tan(spread) * len);
  ctx.lineTo(len, Math.tan(spread) * len);
  ctx.closePath();
  ctx.fill();
  // пятачок
  const g2 = ctx.createRadialGradient(len * 0.8, 0, 0, len * 0.8, 0, 80 * cam.zoom);
  g2.addColorStop(0, 'rgba(255,240,205,.10)');
  g2.addColorStop(1, 'rgba(255,240,205,0)');
  ctx.fillStyle = g2;
  ctx.beginPath();
  ctx.arc(len * 0.8, 0, 80 * cam.zoom, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ── туман ────────────────────────────────────────────────────
// Пятна тумана запекаются в один широкий спрайт и просто едут по экрану —
// четыре радиальных градиента больше не создаются в каждом кадре.
let fogSprite = null;
let fogKey = '';

const FOG_SCALE = 0.5; // туман мылим — половина разрешения незаметна

function buildFogSprite(w, h) {
  const PW = Math.ceil((w + 1200) * FOG_SCALE);
  const c = document.createElement('canvas');
  c.width = PW;
  c.height = Math.max(1, Math.ceil(h * FOG_SCALE));
  const g = c.getContext('2d');
  for (let i = 0; i < 4; i++) {
    const px = i * (PW / 4) + 120;
    const py = h * (0.35 + i * 0.14);
    const r = 420 + i * 160;
    const grd = g.createRadialGradient(px, py, 0, px, py, r);
    grd.addColorStop(0, `rgba(126,140,156,${0.024 - i * 0.0035})`);
    grd.addColorStop(1, 'rgba(126,140,156,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(px, py, r, 0, Math.PI * 2);
    g.fill();
  }
  fogSprite = c;
  fogKey = `${w}x${h}`;
}

export function drawFog(ctx, w, h, time) {
  const key = `${w}x${h}`;
  if (!fogSprite || fogKey !== key) buildFogSprite(w, h);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const span = fogSprite.width - w * FOG_SCALE;
  const off = span > 0 ? (time * 9) % span : 0;
  ctx.drawImage(fogSprite, 0, 0, fogSprite.width, fogSprite.height, -off, Math.sin(time * 0.14) * 18, fogSprite.width / FOG_SCALE, fogSprite.height / FOG_SCALE);
  ctx.restore();
}

// ── виньетка ─────────────────────────────────────────────────
// Градиент создаётся один раз на каждый размер экрана.
let vigGrad = null;
let vigKey = '';

export function drawVignette(ctx, w, h) {
  const key = `${w}x${h}`;
  if (!vigGrad || vigKey !== key) {
    vigGrad = ctx.createRadialGradient(w / 2, h * 0.46, Math.min(w, h) * 0.3, w / 2, h * 0.5, Math.max(w, h) * 0.78);
    vigGrad.addColorStop(0, 'rgba(4,6,9,0)');
    vigGrad.addColorStop(0.62, 'rgba(4,6,9,.18)');
    vigGrad.addColorStop(1, 'rgba(4,6,9,.64)');
    vigKey = key;
  }
  ctx.fillStyle = vigGrad;
  ctx.fillRect(0, 0, w, h);
}

// ── зерно ────────────────────────────────────────────────────
// Одна большая плитка шума на весь экран: один drawImage вместо десятков.
let grainBig = null;
let grainKey = '';

function buildGrainBig(w, h) {
  const pad = 512;
  const c = document.createElement('canvas');
  c.width = Math.ceil(w + pad);
  c.height = Math.ceil(h + pad);
  const g = c.getContext('2d');
  const img = g.createImageData(c.width, c.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = (Math.random() * 255) | 0;
    d[i] = v;
    d[i + 1] = v;
    d[i + 2] = v;
    d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  grainBig = c;
  grainKey = `${w}x${h}`;
}

export function drawGrain(ctx, w, h, amount = 0.045) {
  const key = `${w}x${h}`;
  if (!grainBig || grainKey !== key) buildGrainBig(w, h);
  const ox = -(Math.random() * 512) | 0;
  const oy = -(Math.random() * 512) | 0;
  ctx.save();
  ctx.globalAlpha = amount;
  ctx.globalCompositeOperation = 'overlay';
  ctx.drawImage(grainBig, ox, oy);
  ctx.restore();
}

// ── лёгкий «мокрый» цветокор ─────────────────────────────────
export function colorGrade(ctx, w, h, night) {
  ctx.save();
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, `rgba(36,52,74,${0.1 + night * 0.06})`);
  g.addColorStop(0.55, 'rgba(20,26,34,0)');
  g.addColorStop(1, `rgba(12,10,8,${0.16 + night * 0.1})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

// ── дождь на «стекле» камеры ────────────────────────────────
export function drawLensDrops(ctx, w, h, time) {
  ctx.save();
  for (let i = 0; i < 9; i++) {
    const hx = ((Math.sin(i * 33.1) * 10000) % 1 + 1) % 1;
    const hy = ((Math.sin(i * 71.9) * 10000) % 1 + 1) % 1;
    const x = hx * w;
    const speed = 5 + hy * 16;
    const y = ((hy * h + time * speed) % (h + 120)) - 60;
    const r = 2 + hy * 4;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(220,235,245,.10)');
    g.addColorStop(0.7, 'rgba(190,210,225,.055)');
    g.addColorStop(1, 'rgba(180,200,220,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
