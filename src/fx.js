// ─────────────────────────────────────────────────────────────
//  ТОСКА — атмосфера: дождь, свет, туман, зерно
// ─────────────────────────────────────────────────────────────

let grainCanvas = null;

function makeGrain() {
  const c = document.createElement('canvas');
  c.width = 160;
  c.height = 160;
  const g = c.getContext('2d');
  const img = g.createImageData(160, 160);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

// ── дождь (экранные координаты) ──────────────────────────────
export function drawRain(ctx, w, h, time, intensity = 1, wind = 0.28) {
  const drops = Math.floor(220 * intensity);
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < drops; i++) {
    const seed = i * 12.9898;
    const depth = 0.45 + ((Math.sin(seed) * 43758.5453) % 1 + 1) % 1 * 0.55;
    const speed = 620 + depth * 780;
    const sx = ((Math.sin(seed * 1.7) * 10000) % 1 + 1) % 1;
    const sy = ((Math.sin(seed * 2.3) * 10000) % 1 + 1) % 1;
    const x = sx * (w + 200) - 100 + (time * wind * speed * 0.4) % (w + 200);
    const y = ((sy * h + time * speed) % (h + 140)) - 70;
    const len = 10 + depth * 22;
    ctx.strokeStyle = `rgba(196,214,226,${0.05 + depth * 0.13})`;
    ctx.lineWidth = 0.7 + depth * 0.9;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + wind * len, y + len);
    ctx.stroke();
  }
  ctx.restore();
}

// ── круги на лужах/асфальте ───────────────────────────────────
export function drawSplashes(ctx, cam, vw, vh, time) {
  const pad = 80;
  const x0 = cam.x - vw / 2 / cam.zoom - pad;
  const x1 = cam.x + vw / 2 / cam.zoom + pad;
  const y0 = cam.y - vh / 2 / cam.zoom - pad;
  const y1 = cam.y + vh / 2 / cam.zoom + pad;
  ctx.save();
  for (let i = 0; i < 70; i++) {
    const hx = ((Math.sin(i * 91.7) * 10000) % 1 + 1) % 1;
    const hy = ((Math.sin(i * 47.3) * 10000) % 1 + 1) % 1;
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
// lights: [{x, y, r, color:[r,g,b], a}], проекция через cam
export function drawLighting(ctx, cam, vw, vh, lights, darkness, time) {
  // ночь
  ctx.save();
  ctx.fillStyle = `rgba(10,15,26,${darkness})`;
  ctx.fillRect(0, 0, vw, vh);

  ctx.globalCompositeOperation = 'lighter';
  for (const L of lights) {
    const sx = (L.x - cam.x) * cam.zoom + vw / 2;
    const sy = (L.y - cam.y) * cam.zoom + vh / 2;
    const R = L.r * cam.zoom;
    if (sx < -R || sy < -R || sx > vw + R || sy > vh + R) continue;

    const flick = L.flicker ? 0.88 + 0.12 * Math.sin(time * 9.1 + L.x) * Math.sin(time * 3.3) : 1;
    const a = L.a * flick;
    const [cr, cg, cb] = L.color;

    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, R);
    g.addColorStop(0, `rgba(${cr},${cg},${cb},${a})`);
    g.addColorStop(0.35, `rgba(${cr},${cg},${cb},${a * 0.52})`);
    g.addColorStop(0.72, `rgba(${cr},${cg},${cb},${a * 0.16})`);
    g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(sx, sy, R, 0, Math.PI * 2);
    ctx.fill();

    // ядро
    const g2 = ctx.createRadialGradient(sx, sy, 0, sx, sy, R * 0.2);
    g2.addColorStop(0, `rgba(255,230,190,${Math.min(0.5, a * 1.4)})`);
    g2.addColorStop(1, 'rgba(255,220,170,0)');
    ctx.fillStyle = g2;
    ctx.beginPath();
    ctx.arc(sx, sy, R * 0.2, 0, Math.PI * 2);
    ctx.fill();
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
export function drawFog(ctx, w, h, time) {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 4; i++) {
    const px = ((time * (8 + i * 5) + i * 900) % (w + 1200)) - 600;
    const py = h * (0.35 + i * 0.14) + Math.sin(time * 0.14 + i) * 40;
    const r = 420 + i * 160;
    const g = ctx.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, `rgba(126,140,156,${0.024 - i * 0.0035})`);
    g.addColorStop(1, 'rgba(126,140,156,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ── виньетка ─────────────────────────────────────────────────
export function drawVignette(ctx, w, h) {
  const g = ctx.createRadialGradient(w / 2, h * 0.46, Math.min(w, h) * 0.3, w / 2, h * 0.5, Math.max(w, h) * 0.78);
  g.addColorStop(0, 'rgba(4,6,9,0)');
  g.addColorStop(0.62, 'rgba(4,6,9,.18)');
  g.addColorStop(1, 'rgba(4,6,9,.64)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

// ── зерно ────────────────────────────────────────────────────
export function drawGrain(ctx, w, h, amount = 0.045) {
  if (!grainCanvas) grainCanvas = makeGrain();
  const size = 160;
  const ox = (Math.random() * size) | 0;
  const oy = (Math.random() * size) | 0;
  ctx.save();
  ctx.globalAlpha = amount;
  ctx.globalCompositeOperation = 'overlay';
  for (let y = -oy; y < h; y += size) {
    for (let x = -ox; x < w; x += size) {
      ctx.drawImage(grainCanvas, x, y);
    }
  }
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
