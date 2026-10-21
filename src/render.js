// ─────────────────────────────────────────────────────────────
//  ТОСКА — отрисовка мира
// ─────────────────────────────────────────────────────────────
import {
  W, H, STREET, WALK_N, WALK_S, buildings, garages, backdrop, paths, parkings,
  trees, lamps, benches, dumpsters, dumpsterPad, trafo, playground, swing, slide,
  carousel, sandbox, mushroom, hockey, busStop, crosswalk, puddles, manholes,
  pigeons, rng,
} from './world.js';

// ── мелкие хелперы ────────────────────────────────────────────
export function hash01(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export function rr(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return `rgb(${r},${g},${b})`;
}

function ellipse(ctx, x, y, rx, ry, color, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

// ── ЗЕМЛЯ ─────────────────────────────────────────────────────
export function buildGround() {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const r = rng(20240117);

  // база — мокрая земля/трава поздней осенью
  g.fillStyle = '#3a3c33';
  g.fillRect(0, 0, W, H);

  // крупные пятна грунта и травы
  const soil = ['#44462f', '#3b3d2c', '#4b4430', '#34362a', '#454430', '#4e4835', '#3f4230'];
  for (let i = 0; i < 300; i++) {
    const x = r() * W, y = r() * H;
    const rad = 60 + r() * 220;
    ellipse(g, x, y, rad, rad * (0.35 + r() * 0.5), soil[(r() * soil.length) | 0], 0.22 + r() * 0.2);
  }

  // фактура
  for (let i = 0; i < 26000; i++) {
    const x = r() * W, y = r() * H;
    g.globalAlpha = 0.04 + r() * 0.07;
    g.fillStyle = r() > 0.62 ? '#6a6952' : '#1f211c';
    g.fillRect(x, y, 1 + r() * 2.4, 1 + r() * 2.4);
  }
  g.globalAlpha = 1;

  // ── асфальт: площадки ──
  const asphalt = (x, y, w, h, rad = 14, col = '#424340') => {
    g.save();
    rr(g, x, y, w, h, rad);
    g.fillStyle = col;
    g.fill();
    g.clip();
    for (let i = 0; i < 2600; i++) {
      const px = x + r() * w, py = y + r() * h;
      g.globalAlpha = 0.04 + r() * 0.07;
      g.fillStyle = r() > 0.62 ? '#565852' : '#2b2c2a';
      g.fillRect(px, py, 1 + r() * 3, 1 + r() * 2);
    }
    g.globalAlpha = 1;
    g.restore();
  };

  asphalt(playground.x - 26, playground.y - 26, playground.w + 52, playground.d + 52, 26, '#44453f');
  for (const p of parkings) asphalt(p.x - 14, p.y - 14, p.w + 28, p.d + 28, 10, '#414240');
  asphalt(hockey.x, hockey.y, hockey.w, hockey.d, 4, '#4c4d48');
  asphalt(dumpsterPad.x, dumpsterPad.y, dumpsterPad.w, dumpsterPad.h, 6, '#44453f');
  asphalt(trafo.x - 26, trafo.y - 10, trafo.w + 52, trafo.d + 44, 6, '#42433f');
  asphalt(busStop.x - 16, busStop.y - 8, busStop.w + 32, busStop.d + 20, 6, '#47483f');

  // отмостка вдоль домов
  for (const b of buildings) {
    const y = b.y + b.d;
    g.fillStyle = '#55564f';
    g.globalAlpha = 0.75;
    g.fillRect(b.x - 6, y - 4, b.w + 12, 22);
    g.globalAlpha = 1;
  }

  // ── дворовые проходы ──
  for (const p of paths) {
    g.lineCap = 'round';
    g.lineJoin = 'round';
    const strokePath = () => {
      g.beginPath();
      p.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.stroke();
    };

    // размытый край, где асфальт врастает в грунт
    g.strokeStyle = '#3b3c32';
    g.lineWidth = p.w + 18;
    g.globalAlpha = 0.85;
    strokePath();
    g.globalAlpha = 1;

    // обочина (утоптанная земля)
    g.strokeStyle = '#414239';
    g.lineWidth = p.w + 8;
    strokePath();

    // сам асфальт
    g.strokeStyle = '#3f4039';
    g.lineWidth = p.w;
    strokePath();

    // следы и вытертая середина
    g.strokeStyle = 'rgba(30,32,29,.20)';
    g.lineWidth = p.w * 0.4;
    strokePath();
    g.strokeStyle = 'rgba(120,128,126,.07)';
    g.lineWidth = p.w * 0.16;
    strokePath();

    // гравий и мокрые пятна вдоль дорожки
    {
      const pr = rng((p.pts[0][0] * 13 + p.pts[0][1] * 7) | 0);
      for (let i = 0; i < p.pts.length - 1; i++) {
        const [ax, ay] = p.pts[i];
        const [bx, by] = p.pts[i + 1];
        const segLen = Math.hypot(bx - ax, by - ay);
        const n = Math.floor(segLen * (p.w / 8));
        for (let k = 0; k < n; k++) {
          const tt = pr();
          const cx = ax + (bx - ax) * tt + (pr() - 0.5) * p.w;
          const cy = ay + (by - ay) * tt + (pr() - 0.5) * p.w;
          const v = pr();
          g.globalAlpha = 0.06 + pr() * 0.12;
          g.fillStyle = v > 0.72 ? '#6c6f66' : v > 0.4 ? '#2f322d' : '#54574f';
          g.fillRect(cx, cy, 1 + pr() * 2.6, 1 + pr() * 2.2);
        }
      }
      // мокрые блики
      for (let k = 0; k < 10; k++) {
        const tt = pr();
        const i0 = Math.min(p.pts.length - 2, Math.floor(tt * (p.pts.length - 1)));
        const [ax, ay] = p.pts[i0];
        const [bx, by] = p.pts[i0 + 1];
        const cx = ax + (bx - ax) * pr() + (pr() - 0.5) * p.w * 0.6;
        const cy = ay + (by - ay) * pr() + (pr() - 0.5) * p.w * 0.6;
        g.globalAlpha = 0.06 + pr() * 0.08;
        g.fillStyle = '#9aa8b4';
        g.beginPath();
        g.ellipse(cx, cy, 4 + pr() * 14, 2 + pr() * 6, pr() * 3, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
    }

    // трещины вдоль
    g.strokeStyle = 'rgba(26,28,26,.35)';
    g.lineWidth = 1;
    const rr2 = rng((p.pts[0][0] * 7 + p.pts[0][1]) | 0);
    for (let k = 0; k < 6; k++) {
      const t0 = rr2();
      const i0 = Math.min(p.pts.length - 2, Math.floor(t0 * (p.pts.length - 1)));
      const [ax, ay] = p.pts[i0];
      const [bx, by] = p.pts[i0 + 1];
      const tt = rr2();
      const cx = ax + (bx - ax) * tt + (rr2() - 0.5) * p.w * 0.7;
      const cy = ay + (by - ay) * tt + (rr2() - 0.5) * p.w * 0.7;
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx + (rr2() - 0.5) * 16, cy + 6 + rr2() * 12);
      g.lineTo(cx + (rr2() - 0.5) * 24, cy + 16 + rr2() * 16);
      g.stroke();
    }
  }

  // ── тротуары ──
  const sidewalk = (y0, y1) => {
    g.fillStyle = '#4c4d48';
    g.fillRect(0, y0, W, y1 - y0);
    g.strokeStyle = 'rgba(28,30,28,.28)';
    g.lineWidth = 1.1;
    for (let x = 0; x < W; x += 64) {
      g.beginPath();
      g.moveTo(x, y0);
      g.lineTo(x, y1);
      g.stroke();
    }
    for (let y = y0 + 27; y < y1; y += 27) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(W, y);
      g.stroke();
    }
    // мокрые разводы
    for (let i = 0; i < 90; i++) {
      g.globalAlpha = 0.05 + r() * 0.07;
      g.fillStyle = r() > 0.5 ? '#6c757e' : '#33352f';
      g.beginPath();
      g.ellipse(r() * W, y0 + r() * (y1 - y0), 10 + r() * 40, 3 + r() * 8, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    // бордюр
    g.fillStyle = '#66675f';
    g.fillRect(0, y0 - 4, W, 5);
    g.fillStyle = '#31322e';
    g.fillRect(0, y1 - 4, W, 5);
  };
  sidewalk(WALK_N.y0, WALK_N.y1);
  sidewalk(WALK_S.y0, WALK_S.y1);

  // ── дорога ──
  g.fillStyle = '#2f3032';
  g.fillRect(0, STREET.y0, W, STREET.y1 - STREET.y0);
  // колеи и разводы
  for (let i = 0; i < 220; i++) {
    const x = r() * W, y = STREET.y0 + r() * (STREET.y1 - STREET.y0);
    g.globalAlpha = 0.05 + r() * 0.08;
    g.fillStyle = r() > 0.5 ? '#232426' : '#3d3e40';
    g.fillRect(x, y, 20 + r() * 120, 1 + r() * 3);
  }
  g.globalAlpha = 1;
  // разметка
  g.strokeStyle = 'rgba(196,190,154,.34)';
  g.lineWidth = 4;
  g.setLineDash([46, 44]);
  g.beginPath();
  g.moveTo(0, 1524);
  g.lineTo(W, 1524);
  g.stroke();
  g.setLineDash([]);
  g.strokeStyle = 'rgba(210,205,180,.16)';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(0, STREET.y0 + 12);
  g.lineTo(W, STREET.y0 + 12);
  g.moveTo(0, STREET.y1 - 12);
  g.lineTo(W, STREET.y1 - 12);
  g.stroke();
  // зебра
  g.fillStyle = 'rgba(214,210,190,.3)';
  for (let x = crosswalk.x; x < crosswalk.x + crosswalk.w; x += 26) {
    g.fillRect(x, STREET.y0 + 10, 15, STREET.y1 - STREET.y0 - 20);
  }

  // ── разметка парковок ──
  for (const p of parkings) {
    g.strokeStyle = 'rgba(226,222,202,.2)';
    g.lineWidth = 2.4;
    const slotW = 78;
    const cols = Math.max(1, Math.floor((p.w - 24) / slotW));
    const startX = p.x + (p.w - cols * slotW) / 2;
    for (let c = 0; c <= cols; c++) {
      const x = startX + c * slotW;
      if (c === 0 || c === cols) {
        g.beginPath();
        g.moveTo(x, p.y + 10);
        g.lineTo(x, p.y + p.d - 10);
        g.stroke();
      }
      if (c < cols) {
        g.beginPath();
        g.moveTo(x, p.y + 10);
        g.lineTo(x, p.y + 10);
        g.stroke();
      }
    }
    if (p.rows > 1) {
      g.beginPath();
      g.moveTo(p.x + 10, p.y + p.d / 2);
      g.lineTo(p.x + p.w - 10, p.y + p.d / 2);
      g.stroke();
    }
  }

  // ── пятна масла ──
  for (const p of parkings) {
    for (let i = 0; i < 22; i++) {
      const x = p.x + r() * p.w, y = p.y + r() * p.d;
      g.globalAlpha = 0.1 + r() * 0.16;
      g.fillStyle = '#22262a';
      g.beginPath();
      g.ellipse(x, y, 8 + r() * 22, 4 + r() * 9, r() * 3, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.globalAlpha = 1;

  // ── трещины ──
  g.strokeStyle = 'rgba(24,26,24,.45)';
  for (let i = 0; i < 160; i++) {
    let x = r() * W, y = r() * H;
    g.lineWidth = 0.6 + r() * 1.1;
    g.beginPath();
    g.moveTo(x, y);
    const steps = 3 + (r() * 5) | 0;
    for (let s = 0; s < steps; s++) {
      x += (r() - 0.5) * 40;
      y += (r() - 0.4) * 30;
      g.lineTo(x, y);
    }
    g.stroke();
  }

  // ── трава ──
  for (let i = 0; i < 2600; i++) {
    const x = r() * W, y = r() * H;
    if (y > 1360) continue;
    const h = 3 + r() * 8;
    g.globalAlpha = 0.12 + r() * 0.22;
    g.strokeStyle = r() > 0.4 ? '#575b3c' : '#6b6a48';
    g.lineWidth = 0.9;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (r() - 0.5) * 4, y - h);
    g.stroke();
  }
  g.globalAlpha = 1;

  // ── листья ──
  const leafCols = ['#7a5a23', '#8f6626', '#5f4a20', '#93702c', '#4c4526', '#6d5522'];
  for (const t of trees) {
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI * 2, d = r() * 70;
      const x = t.x + Math.cos(a) * d, y = t.y + Math.sin(a) * d * 0.7;
      g.globalAlpha = 0.35 + r() * 0.4;
      g.fillStyle = leafCols[(r() * leafCols.length) | 0];
      g.fillRect(x, y, 1.6 + r() * 2.4, 1 + r() * 1.8);
    }
  }
  for (let i = 0; i < 900; i++) {
    g.globalAlpha = 0.18 + r() * 0.25;
    g.fillStyle = leafCols[(r() * leafCols.length) | 0];
    g.fillRect(r() * W, r() * H, 1.5 + r() * 2, 1 + r() * 1.4);
  }
  g.globalAlpha = 1;

  // ── лужи ──
  for (const p of puddles) {
    g.save();
    g.globalAlpha = p.a;
    const grd = g.createLinearGradient(p.x, p.y - p.ry, p.x, p.y + p.ry);
    grd.addColorStop(0, '#6e7a86');
    grd.addColorStop(0.45, '#434c57');
    grd.addColorStop(1, '#20262d');
    g.fillStyle = grd;
    g.beginPath();
    g.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, Math.PI * 2);
    g.fill();
    // отражение окна/фонаря
    g.globalAlpha = p.a * 0.5;
    g.fillStyle = '#d8a86e';
    g.fillRect(p.x - p.rx * 0.18, p.y - p.ry * 0.5, p.rx * 0.13, p.ry * 0.8);
    g.globalAlpha = p.a * 0.35;
    g.fillStyle = '#aebcc8';
    g.fillRect(p.x + p.rx * 0.2, p.y - p.ry * 0.4, p.rx * 0.1, p.ry * 0.6);
    g.restore();
  }

  // ── люки ──
  for (const m of manholes) {
    g.fillStyle = '#35383a';
    g.beginPath();
    g.arc(m.x, m.y, m.r, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#575b5c';
    g.lineWidth = 1.6;
    g.stroke();
    g.strokeStyle = 'rgba(30,32,33,.7)';
    g.lineWidth = 1;
    for (let i = -2; i <= 2; i++) {
      g.beginPath();
      g.moveTo(m.x - m.r * 0.7, m.y + i * 4);
      g.lineTo(m.x + m.r * 0.7, m.y + i * 4);
      g.stroke();
    }
  }

  // ── разметка коробки ──
  g.save();
  g.beginPath();
  g.rect(hockey.x, hockey.y, hockey.w, hockey.d);
  g.clip();
  g.strokeStyle = 'rgba(196,110,86,.22)';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(hockey.x + hockey.w / 2, hockey.y);
  g.lineTo(hockey.x + hockey.w / 2, hockey.y + hockey.d);
  g.stroke();
  g.beginPath();
  g.arc(hockey.x + hockey.w / 2, hockey.y + hockey.d / 2, 52, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = 'rgba(220,216,196,.18)';
  g.lineWidth = 3;
  g.beginPath();
  g.arc(hockey.x + 46, hockey.y + hockey.d / 2, 34, -Math.PI / 2, Math.PI / 2);
  g.stroke();
  g.beginPath();
  g.arc(hockey.x + hockey.w - 46, hockey.y + hockey.d / 2, 34, Math.PI / 2, Math.PI * 1.5);
  g.stroke();
  g.restore();

  // ── тёплые пятна света из окон на мокром асфальте ──
  {
    const lr = rng(31337);
    for (const b of buildings) {
      if (b.shop) {
        const grd = g.createLinearGradient(0, b.baseY, 0, b.baseY + 120);
        grd.addColorStop(0, 'rgba(246,196,132,.13)');
        grd.addColorStop(1, 'rgba(246,196,132,0)');
        g.fillStyle = grd;
        g.fillRect(b.x + 6, b.baseY - 2, b.w - 12, 118);
        continue;
      }
      for (let i = 0; i < 26; i++) {
        const px = b.x + 24 + lr() * (b.w - 48);
        const py = b.baseY + 8 + lr() * 70;
        const wgt = 26 + lr() * 34;
        const hgt = 12 + lr() * 26;
        const cold = lr() > 0.82;
        const grd = g.createRadialGradient(px, py, 0, px, py, wgt);
        grd.addColorStop(0, cold ? 'rgba(150,190,215,.09)' : 'rgba(246,193,126,.12)');
        grd.addColorStop(1, 'rgba(246,193,126,0)');
        g.save();
        g.translate(px, py);
        g.scale(1, hgt / wgt);
        g.fillStyle = grd;
        g.beginPath();
        g.arc(0, 0, wgt, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
    }
  }

  // ── дальний город за крышами ──
  {
    const fr = rng(8181);
    g.save();
    // дымка у горизонта
    const sky = g.createLinearGradient(0, 0, 0, 190);
    sky.addColorStop(0, '#252c36');
    sky.addColorStop(0.55, '#1e242c');
    sky.addColorStop(1, 'rgba(24,29,36,0)');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, 190);

    // силуэты домов
    let fx = -60;
    while (fx < W + 60) {
      const bw = 110 + fr() * 220;
      const bh = 26 + fr() * 62;
      const top = 150 - bh;
      g.fillStyle = '#2b323c';
      g.fillRect(fx, top, bw, bh + 30);
      g.fillStyle = '#333b46';
      g.fillRect(fx, top, bw, 3);
      // окна
      for (let wy = top + 10; wy < 148; wy += 9) {
        for (let wx = fx + 7; wx < fx + bw - 7; wx += 10) {
          const v = hash01(wx * 0.37 + wy * 0.53);
          if (v < 0.11) {
            g.fillStyle = v < 0.018 ? 'rgba(226,176,112,.30)' : 'rgba(108,136,158,.07)';
            g.fillRect(wx, wy, 3.4, 3.4);
          }
        }
      }
      // антенны
      g.strokeStyle = 'rgba(22,26,32,.6)';
      g.lineWidth = 1;
      for (let k = 0; k < 2; k++) {
        const ax = fx + 20 + fr() * (bw - 40);
        g.beginPath();
        g.moveTo(ax, top);
        g.lineTo(ax, top - 12 - fr() * 12);
        g.stroke();
      }
      fx += bw + 10 + fr() * 30;
    }

    // дальние деревья
    for (let i = 0; i < 90; i++) {
      const tx = fr() * W;
      const th = 22 + fr() * 40;
      g.fillStyle = `rgba(34,38,34,${0.5 + fr() * 0.35})`;
      g.beginPath();
      g.ellipse(tx, 150 - th * 0.55, th * 0.42, th * 0.55, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(24,26,24,.6)';
      g.lineWidth = 1.4;
      g.beginPath();
      g.moveTo(tx, 152);
      g.lineTo(tx, 150 - th * 0.4);
      g.stroke();
    }

    // туман поверх
    const fgr = g.createLinearGradient(0, 60, 0, 190);
    fgr.addColorStop(0, 'rgba(58,68,80,.55)');
    fgr.addColorStop(1, 'rgba(58,68,80,0)');
    g.fillStyle = fgr;
    g.fillRect(0, 40, W, 160);
    g.restore();
  }

  // ── тени домов ──
  g.save();
  g.filter = 'blur(22px)';
  g.fillStyle = 'rgba(8,10,12,.55)';
  for (const b of buildings) {
    g.fillRect(b.x + 10, b.y + b.d - 8, b.w, b.d + 18);
  }
  g.fillRect(garages.x + 8, garages.y + garages.d - 6, garages.w, garages.d + 14);
  g.fillRect(trafo.x + 5, trafo.y + trafo.d - 4, trafo.w, trafo.d + 10);
  g.restore();

  // тени деревьев и предметов (мягкие)
  g.save();
  g.filter = 'blur(7px)';
  for (const t of trees) {
    g.fillStyle = 'rgba(10,12,12,.32)';
    g.beginPath();
    g.ellipse(t.x + 16, t.y + 6, 34 * t.s, 15 * t.s, 0, 0, Math.PI * 2);
    g.fill();
  }
  for (const b of benches) {
    g.fillStyle = 'rgba(10,12,12,.3)';
    g.fillRect(b.x - 32, b.y + 4, 64, 10);
  }
  g.restore();

  return c;
}

// ── ДОМ ───────────────────────────────────────────────────────
export function drawBuilding(ctx, b, time) {
  const P = b.palette;
  const { x, w, d, h, floors } = b;
  const topY = b.topY;
  const baseY = b.baseY;
  const roofY = b.roofY;

  // ── крыша ──
  const roofGrd = ctx.createLinearGradient(0, roofY, 0, topY);
  roofGrd.addColorStop(0, shade(P.roof, -16));
  roofGrd.addColorStop(0.55, P.roof);
  roofGrd.addColorStop(1, shade(P.roof, 10));
  ctx.fillStyle = roofGrd;
  ctx.fillRect(x, roofY, w, d + 2);

  // тёмные потёки и заплатки кровли
  {
    const sr = rng(b.seed + 47);
    for (let i = 0; i < Math.floor(w / 26); i++) {
      const px = x + sr() * w;
      const py = roofY + sr() * d;
      const ww = 14 + sr() * 60;
      const hh = 3 + sr() * (d * 0.5);
      ctx.globalAlpha = 0.08 + sr() * 0.16;
      ctx.fillStyle = sr() > 0.45 ? '#1d201e' : '#5c5f58';
      ctx.fillRect(px, py, ww, hh);
    }
    ctx.globalAlpha = 1;
  }

  // швы кровли
  ctx.strokeStyle = 'rgba(20,22,24,.22)';
  ctx.lineWidth = 1;
  for (let sx = x + 28; sx < x + w; sx += 42) {
    ctx.beginPath();
    ctx.moveTo(sx, roofY + 2);
    ctx.lineTo(sx, topY);
    ctx.stroke();
  }
  // гравий / потёки
  {
    const rg = rng(b.seed + 91);
    for (let i = 0; i < Math.floor(w * d * 0.004); i++) {
      const px = x + rg() * w;
      const py = roofY + rg() * d;
      ctx.globalAlpha = 0.05 + rg() * 0.12;
      ctx.fillStyle = rg() > 0.5 ? '#2c2e2a' : '#8b8c84';
      ctx.fillRect(px, py, 1 + rg() * 3, 1 + rg() * 2);
    }
    ctx.globalAlpha = 1;
  }
  // парапет
  ctx.fillStyle = shade(P.roof, 34);
  ctx.fillRect(x, topY - 7, w, 8);
  ctx.fillStyle = 'rgba(190,192,182,.14)';
  ctx.fillRect(x, topY - 7, w, 1.6);
  ctx.fillStyle = 'rgba(15,17,19,.55)';
  ctx.fillRect(x, topY - 1.5, w, 2.5);

  // вентиляция, антенны, тарелки
  const rr2 = rng(b.seed + 7);
  for (let i = 0; i < Math.floor(w / 190) + 2; i++) {
    const vx = x + 60 + rr2() * (w - 120);
    const vy = roofY + 14 + rr2() * (d - 30);
    ctx.fillStyle = shade(P.roof, 22);
    ctx.fillRect(vx - 7, vy - 5, 14, 10);
    ctx.fillStyle = 'rgba(12,14,16,.5)';
    ctx.fillRect(vx - 7, vy + 3, 14, 2);
  }
  for (let i = 0; i < Math.floor(w / 150); i++) {
    const ax = x + 90 + rr2() * (w - 180);
    const ay = roofY + 12 + rr2() * (d - 24);
    ctx.strokeStyle = 'rgba(18,20,22,.75)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(ax, ay + 12);
    ctx.lineTo(ax, ay - 24);
    ctx.stroke();
    // «петля» антенны
    ctx.lineWidth = 1.1;
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      ctx.moveTo(ax - 13 + k * 1.5, ay - 24 + k * 5);
      ctx.lineTo(ax + 13 - k * 1.5, ay - 28 + k * 5);
      ctx.stroke();
    }
  }

  // ── фасад ──
  const wallGrd = ctx.createLinearGradient(0, topY, 0, baseY);
  wallGrd.addColorStop(0, shade(P.wall2, -10));
  wallGrd.addColorStop(0.35, P.wall);
  wallGrd.addColorStop(0.86, P.wall2);
  wallGrd.addColorStop(1, shade(P.wall2, -22));
  ctx.fillStyle = wallGrd;
  ctx.fillRect(x, topY, w, h);

  const floorH = h / floors;
  const cols = Math.max(2, Math.round(w / 56));
  const cw = w / cols;

  // панельные швы
  ctx.strokeStyle = 'rgba(30,32,32,.22)';
  ctx.lineWidth = 1;
  for (let f = 1; f < floors; f++) {
    const fy = baseY - f * floorH;
    ctx.beginPath();
    ctx.moveTo(x, fy);
    ctx.lineTo(x + w, fy);
    ctx.stroke();
  }
  if (!b.shop && floors >= 5) {
    for (let c = 1; c < cols; c++) {
      ctx.strokeStyle = 'rgba(30,32,32,.13)';
      ctx.beginPath();
      ctx.moveTo(x + c * cw, topY + 4);
      ctx.lineTo(x + c * cw, baseY - 6);
      ctx.stroke();
    }
  }

  // окна
  const litRatio = 0.34;
  const winW = Math.min(24, cw * 0.46);
  const winH = Math.min(floorH * 0.54, 17);

  for (let f = 0; f < floors; f++) {
    const fy = baseY - (f + 1) * floorH;
    for (let c = 0; c < cols; c++) {
      const cx = x + c * cw + cw / 2;
      const wx = cx - winW / 2;
      const wy = fy + floorH * 0.2;

      // на первом этаже окна только между подъездами
      if (f === 0) {
        if (b.shop) continue;
        let nearDoor = false;
        for (let i = 0; i < b.entrances; i++) {
          const ex = x + (i + 0.5) * (w / b.entrances);
          if (Math.abs(cx - ex) < 42) nearDoor = true;
        }
        if (nearDoor) continue;
      }

      const rv = hash01(b.seed + f * 37.3 + c * 11.7);
      const lit = rv < litRatio + (f === 0 ? 0.04 : 0);
      const cold = rv > 0.32 && rv < 0.365;

      // рама
      ctx.fillStyle = 'rgba(24,27,30,.9)';
      ctx.fillRect(wx - 1.5, wy - 1.5, winW + 3, winH + 3);

      if (lit) {
        const warm = cold ? ['#93b4c6', '#b9d2df'] : ['#e8b271', '#f6d39b'];
        const wg = ctx.createLinearGradient(0, wy, 0, wy + winH);
        wg.addColorStop(0, warm[1]);
        wg.addColorStop(1, warm[0]);
        ctx.fillStyle = wg;
        ctx.fillRect(wx, wy, winW, winH);

        // силуэт / занавеска / телевизор
        const kind = hash01(b.seed * 3 + f * 7 + c * 5);
        if (kind < 0.18) {
          ctx.fillStyle = 'rgba(60,40,26,.55)';
          ctx.fillRect(wx + winW * 0.15, wy + winH * 0.28, winW * 0.3, winH * 0.8);
        } else if (kind < 0.4) {
          ctx.fillStyle = 'rgba(226,214,190,.5)';
          ctx.fillRect(wx, wy, winW * 0.32, winH);
        } else if (kind < 0.52) {
          const fl = 0.35 + 0.35 * Math.abs(Math.sin(time * (3 + kind * 9) + c));
          ctx.fillStyle = `rgba(120,170,210,${fl})`;
          ctx.fillRect(wx + 2, wy + 2, winW - 4, winH - 4);
        }
        // переплёт
        ctx.fillStyle = 'rgba(40,36,30,.5)';
        ctx.fillRect(wx + winW / 2 - 0.7, wy, 1.4, winH);
        // свет на откосах
        ctx.fillStyle = cold ? 'rgba(150,190,210,.07)' : 'rgba(240,185,120,.1)';
        ctx.fillRect(wx - 4, wy - 4, winW + 8, winH + 8);
        // подоконник
        ctx.fillStyle = 'rgba(214,208,192,.16)';
        ctx.fillRect(wx - 3, wy + winH + 1.5, winW + 6, 1.8);
      } else {
        const gg = ctx.createLinearGradient(0, wy, 0, wy + winH);
        gg.addColorStop(0, '#5b636b');
        gg.addColorStop(0.5, '#333b44');
        gg.addColorStop(1, '#252b33');
        ctx.fillStyle = gg;
        ctx.fillRect(wx, wy, winW, winH);
        // отражение неба
        ctx.fillStyle = 'rgba(150,168,180,.14)';
        ctx.fillRect(wx + 1, wy + 1, winW - 2, winH * 0.3);
        ctx.fillStyle = 'rgba(40,36,30,.6)';
        ctx.fillRect(wx + winW / 2 - 0.7, wy, 1.4, winH);
        ctx.fillStyle = 'rgba(214,208,192,.1)';
        ctx.fillRect(wx - 3, wy + winH + 1.5, winW + 6, 1.6);
      }
    }
  }

  // балконы
  if (!b.shop && floors >= 5) {
    for (let c = 2; c < cols; c += 4) {
      const cx = x + c * cw + cw / 2;
      const bw = cw * 0.78;
      for (let f = 0; f < floors; f++) {
        const fy = baseY - (f + 1) * floorH;
        const rv = hash01(b.seed + c * 4.1 + f * 3.7);
        if (rv < 0.35) continue;
        const glazed = rv > 0.62;
        ctx.fillStyle = glazed ? 'rgba(90,110,120,.5)' : 'rgba(48,50,52,.48)';
        ctx.fillRect(cx - bw / 2, fy + 2, bw, floorH * 0.92);
        ctx.strokeStyle = 'rgba(28,30,32,.55)';
        ctx.lineWidth = 1;
        ctx.strokeRect(cx - bw / 2, fy + 2, bw, floorH * 0.92);
        if (glazed) {
          ctx.fillStyle = 'rgba(170,195,210,.12)';
          ctx.fillRect(cx - bw / 2 + 1, fy + 4, bw - 2, floorH * 0.5);
        }
        // перила
        ctx.strokeStyle = 'rgba(26,28,30,.5)';
        for (let k = 1; k < 4; k++) {
          ctx.beginPath();
          ctx.moveTo(cx - bw / 2 + (bw / 4) * k, fy + 2);
          ctx.lineTo(cx - bw / 2 + (bw / 4) * k, fy + 2 + floorH * 0.9);
          ctx.stroke();
        }
        // бельё
        if (rv > 0.55 && rv < 0.6) {
          ctx.fillStyle = 'rgba(210,200,190,.45)';
          ctx.fillRect(cx - bw * 0.3, fy + 5, bw * 0.18, floorH * 0.3);
          ctx.fillStyle = 'rgba(160,120,120,.4)';
          ctx.fillRect(cx + bw * 0.05, fy + 6, bw * 0.2, floorH * 0.26);
        }
      }
    }
  }

  // водосточные трубы
  ctx.fillStyle = shade(P.wall2, -34);
  for (let i = 0; i <= 2; i++) {
    const px = x + 10 + i * ((w - 24) / 2);
    ctx.fillRect(px, topY + 2, 5, h - 4);
    ctx.fillStyle = shade(P.wall2, -18);
    ctx.fillRect(px, topY + 2, 2, h - 4);
    ctx.fillStyle = shade(P.wall2, -34);
  }

  // цоколь
  ctx.fillStyle = shade(P.wall2, -40);
  ctx.fillRect(x, baseY - 10, w, 10);
  ctx.fillStyle = 'rgba(20,22,22,.35)';
  ctx.fillRect(x, baseY - 3, w, 3);

  // подъезды
  if (!b.shop) {
    const doorW = 32;
    for (let i = 0; i < b.entrances; i++) {
      const ex = x + (i + 0.5) * (w / b.entrances);
      const doorH = Math.min(floorH * 0.82, 30);
      const dy = baseY - 8 - doorH;

      // козырёк
      ctx.fillStyle = 'rgba(32,34,36,.65)';
      ctx.fillRect(ex - doorW / 2 - 5, dy - 7, doorW + 10, 5);

      // проём
      ctx.fillStyle = '#20252a';
      ctx.fillRect(ex - doorW / 2, dy, doorW, doorH);
      // дверь
      const dg = ctx.createLinearGradient(0, dy, 0, dy + doorH);
      dg.addColorStop(0, '#4a4238');
      dg.addColorStop(1, '#332e28');
      ctx.fillStyle = dg;
      ctx.fillRect(ex - doorW / 2 + 3, dy + 3, doorW - 6, doorH - 3);
      ctx.fillStyle = 'rgba(20,22,24,.5)';
      ctx.fillRect(ex - doorW / 2 + 5, dy + 6, doorW - 10, 3);
      // ручка
      ctx.fillStyle = '#a99a7a';
      ctx.fillRect(ex + doorW / 2 - 7, dy + doorH * 0.5, 2, 5);

      // лампа над дверью
      ctx.fillStyle = '#f0c98a';
      ctx.fillRect(ex - 3, dy - 10, 6, 3);
      ctx.fillStyle = 'rgba(240,190,120,.16)';
      ctx.beginPath();
      ctx.moveTo(ex - 3, dy - 8);
      ctx.lineTo(ex + 3, dy - 8);
      ctx.lineTo(ex + 16, baseY - 4);
      ctx.lineTo(ex - 16, baseY - 4);
      ctx.closePath();
      ctx.fill();

      // номер дома
      ctx.fillStyle = 'rgba(226,222,208,.82)';
      ctx.fillRect(ex + doorW / 2 + 7, dy - 4, 20, 12);
      ctx.fillStyle = '#2a2c2b';
      ctx.font = 'bold 9px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(String(10 + i * 2), ex + doorW / 2 + 17, dy + 5);

      // ступеньки
      ctx.fillStyle = '#6b6c66';
      ctx.fillRect(ex - doorW / 2 - 6, baseY - 8, doorW + 12, 4);
    }
  }

  // кондиционеры
  for (let i = 0; i < Math.floor(w / 210); i++) {
    const ax = x + 120 + hash01(b.seed + i * 9.1) * (w - 240);
    const ay = topY + 32 + hash01(b.seed + i * 13.7) * (h - 80);
    ctx.fillStyle = '#b9b7ac';
    ctx.fillRect(ax, ay, 17, 11);
    ctx.fillStyle = 'rgba(40,42,42,.55)';
    ctx.fillRect(ax + 2, ay + 2, 13, 4);
    ctx.strokeStyle = 'rgba(30,32,32,.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(ax, ay, 17, 11);
  }

  // магазин
  if (b.shop) {
    const glassY = topY + 30;
    const glassH = baseY - glassY - 16;
    const gg = ctx.createLinearGradient(0, glassY, 0, glassY + glassH);
    gg.addColorStop(0, '#f2cf95');
    gg.addColorStop(0.55, '#d9a96c');
    gg.addColorStop(1, '#a67c4e');
    ctx.fillStyle = gg;
    ctx.fillRect(x + 14, glassY, w - 28, glassH);
    // полки / силуэты
    ctx.fillStyle = 'rgba(80,52,30,.45)';
    for (let i = 0; i < 5; i++) ctx.fillRect(x + 26 + i * ((w - 60) / 5), glassY + glassH * 0.35, 42, 3);
    ctx.fillStyle = 'rgba(50,34,22,.55)';
    ctx.fillRect(x + w * 0.62, glassY + glassH * 0.42, 26, glassH * 0.58);
    // дверь
    ctx.fillStyle = 'rgba(30,26,22,.8)';
    ctx.fillRect(x + w * 0.78, glassY + 6, 42, glassH - 6);
    ctx.fillStyle = 'rgba(240,210,160,.5)';
    ctx.fillRect(x + w * 0.78 + 4, glassY + 12, 34, glassH - 20);
    // переплёт
    ctx.fillStyle = 'rgba(40,36,32,.55)';
    for (let i = 1; i < 5; i++) ctx.fillRect(x + 14 + (w - 28) * (i / 5) - 1, glassY, 2.4, glassH);
    // вывеска
    const flick = 0.72 + 0.28 * Math.abs(Math.sin(time * 7.3) * Math.sin(time * 1.7));
    ctx.fillStyle = 'rgba(24,22,20,.9)';
    ctx.fillRect(x + 6, topY + 4, w - 12, 22);
    ctx.globalAlpha = flick;
    ctx.fillStyle = '#f0b965';
    ctx.font = 'bold 15px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('ПРОДУКТЫ 24', x + w / 2, topY + 20);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(240,185,101,.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 6, topY + 4, w - 12, 22);
  }

  // лёгкая тень по краям
  ctx.fillStyle = 'rgba(10,12,14,.16)';
  ctx.fillRect(x, topY, 3, h);
  ctx.fillRect(x + w - 3, topY, 3, h);
}

// ── ГАРАЖИ ────────────────────────────────────────────────────
export function drawGarages(ctx, garage, time) {
  const { x, y, w, d, h, count } = garage;
  const topY = garage.topY;
  const baseY = garage.baseY;
  const roofY = garage.roofY;

  ctx.fillStyle = '#4c4d4a';
  ctx.fillRect(x, roofY, w, d + 2);
  ctx.fillStyle = 'rgba(30,32,33,.4)';
  for (let sx = x + 12; sx < x + w; sx += 18) ctx.fillRect(sx, roofY, 2, d);

  ctx.fillStyle = '#6c6a60';
  ctx.fillRect(x, topY, w, h);
  const grd = ctx.createLinearGradient(0, topY, 0, baseY);
  grd.addColorStop(0, 'rgba(30,32,30,.35)');
  grd.addColorStop(1, 'rgba(20,22,20,.1)');
  ctx.fillStyle = grd;
  ctx.fillRect(x, topY, w, h);

  const gw = w / count;
  for (let i = 0; i < count; i++) {
    const gx = x + i * gw;
    const rv = hash01(garage.seed + i * 5.3);
    // ворота
    const dg = ctx.createLinearGradient(0, topY + 8, 0, baseY - 4);
    const base = rv > 0.6 ? '#5f665f' : rv > 0.3 ? '#6b6459' : '#77664e';
    dg.addColorStop(0, shade(base, 12));
    dg.addColorStop(1, shade(base, -26));
    ctx.fillStyle = dg;
    ctx.fillRect(gx + 6, topY + 8, gw - 12, h - 12);

    // рёбра
    ctx.strokeStyle = 'rgba(26,28,26,.3)';
    ctx.lineWidth = 1;
    for (let k = 0; k < h - 18; k += 5) {
      ctx.beginPath();
      ctx.moveTo(gx + 7, topY + 12 + k);
      ctx.lineTo(gx + gw - 7, topY + 12 + k);
      ctx.stroke();
    }
    // ржавчина
    ctx.fillStyle = 'rgba(120,76,44,.25)';
    ctx.fillRect(gx + 8 + rv * 20, baseY - 22, 6, 16);
    ctx.fillRect(gx + gw - 24, topY + 20, 4, 12);

    // замок
    ctx.fillStyle = '#2a2c2a';
    ctx.fillRect(gx + gw / 2 - 3, baseY - 22, 6, 8);

    // номер
    ctx.fillStyle = 'rgba(232,228,214,.75)';
    ctx.fillRect(gx + gw / 2 - 8, topY + 11, 16, 10);
    ctx.fillStyle = '#33342f';
    ctx.font = 'bold 8px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(String(i + 1), gx + gw / 2, topY + 19);

    // граффити
    if (rv > 0.45) {
      ctx.strokeStyle = `rgba(${180 + rv * 50},${90 + rv * 90},${60 + rv * 40},.28)`;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(gx + 12, baseY - 30);
      ctx.bezierCurveTo(gx + 22, baseY - 44, gx + 34, baseY - 20, gx + 44, baseY - 34);
      ctx.stroke();
    }
  }

  // цоколь
  ctx.fillStyle = 'rgba(24,26,24,.45)';
  ctx.fillRect(x, baseY - 6, w, 6);
}

// ── ДАЛЬНИЕ ДОМА ─────────────────────────────────────────────
export function drawBackdrop(ctx, time) {
  const r = rng(backdrop.seed);
  const y = backdrop.y;
  // полоса домов
  let x = -40;
  ctx.save();
  while (x < W + 40) {
    const bw = 180 + r() * 220;
    const bh = 70 + r() * 70;
    const top = y + backdrop.h - bh;
    const g = ctx.createLinearGradient(0, top, 0, y + backdrop.h);
    g.addColorStop(0, '#3a4250');
    g.addColorStop(1, '#2b323c');
    ctx.fillStyle = g;
    ctx.fillRect(x, top, bw, bh);
    // крыша
    ctx.fillStyle = '#2c333d';
    ctx.fillRect(x, top - 6, bw, 7);
    // окна
    for (let wy = top + 10; wy < y + backdrop.h - 8; wy += 14) {
      for (let wx = x + 10; wx < x + bw - 8; wx += 18) {
        const v = hash01(wx * 0.31 + wy * 0.71);
        if (v < 0.22) {
          ctx.fillStyle = v < 0.035 ? 'rgba(240,190,120,.55)' : 'rgba(130,160,180,.16)';
          ctx.fillRect(wx, wy, 8, 8);
        }
      }
    }
    x += bw + 14 + r() * 40;
  }
  // дымка
  const fg = ctx.createLinearGradient(0, y - 30, 0, y + backdrop.h);
  fg.addColorStop(0, 'rgba(78,88,102,.15)');
  fg.addColorStop(0.7, 'rgba(78,88,102,.35)');
  fg.addColorStop(1, 'rgba(30,36,44,.6)');
  ctx.fillStyle = fg;
  ctx.fillRect(0, y - 30, W, backdrop.h + 40);
  ctx.restore();
}

// ── ЗАПЕКАНИЕ СПРАЙТОВ ────────────────────────────────────────
// Статичные объекты рисуются один раз в offscreen-canvas, дальше только
// drawImage. Границы задаются с запасом, лишнее отрезается по альфе.
export function bakeSprite(w, h, x, y, draw) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  const g = c.getContext('2d');
  g.translate(-x, -y);
  draw(g);

  let bx = 0, by = 0, bw = c.width, bh = c.height;
  try {
    const data = g.getImageData(0, 0, c.width, c.height).data;
    let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
    for (let yy = 0; yy < c.height; yy++) {
      const row = yy * c.width;
      for (let xx = 0; xx < c.width; xx++) {
        if (data[(row + xx) * 4 + 3] > 2) {
          if (xx < x0) x0 = xx;
          if (xx > x1) x1 = xx;
          if (yy < y0) y0 = yy;
          if (yy > y1) y1 = yy;
        }
      }
    }
    if (x1 >= x0) {
      bx = x0; by = y0;
      bw = x1 - x0 + 1;
      bh = y1 - y0 + 1;
    }
  } catch (e) {
    // getImageData недоступен — оставляем как есть
  }

  const out = document.createElement('canvas');
  out.width = bw;
  out.height = bh;
  out.getContext('2d').drawImage(c, bx, by, bw, bh, 0, 0, bw, bh);
  return { canvas: out, x: x + bx, y: y + by };
}

// ── ДЕРЕВЬЯ ───────────────────────────────────────────────────
// геометрия дерева — общая для тела и падающих листьев
function treeGeom(t) {
  const isBirch = t.kind === 'birch';
  const s = t.s;
  const trunkH = (isBirch ? 120 : 134) * s;
  const crownR = (isBirch ? 62 : 52) * s;
  return {
    s, isBirch,
    x: t.x, y: t.y, seed: t.seed,
    trunkH,
    trunkW: (isBirch ? 9 : 12) * s,
    crownY: -trunkH * 0.86,
    crownR,
    bare: 0.15 + hash01(t.seed * 7.7) * 0.5,
  };
}

// статичная часть дерева (ствол, ветви, листва). Запекается в спрайт.
export function drawTreeBody(ctx, t) {
  const sway = 0;
  const { s, isBirch, x, y, seed, trunkH, trunkW, crownY, crownR, bare } = treeGeom(t);
  // мягкая тень на земле
  ctx.fillStyle = 'rgba(8,11,10,.14)';
  ctx.beginPath();
  ctx.ellipse(x + 12, y + 2, 26 * s, 9 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(x, y);

  // ── ветви ──
  const branchN = isBirch ? 6 : 7;
  for (let i = 0; i < branchN; i++) {
    const h1 = hash01(seed * 31 + i * 3.1);
    const h2 = hash01(seed * 17 + i * 5.3);
    const side = i % 2 === 0 ? 1 : -1;
    const from = trunkH * (0.42 + h1 * 0.42);
    const len = (20 + h2 * 28) * s;
    const ex = side * len * (0.7 + h1 * 0.6) + sway;
    const ey = -from - len * (0.5 + h2 * 0.55);
    ctx.strokeStyle = isBirch ? 'rgba(74,72,64,.85)' : 'rgba(40,38,34,.9)';
    ctx.lineCap = 'round';
    ctx.lineWidth = (2.8 - i * 0.2) * s;
    ctx.beginPath();
    ctx.moveTo(0, -from);
    ctx.quadraticCurveTo(ex * 0.45, -from - len * 0.35, ex, ey);
    ctx.stroke();

    // веточки
    for (let k = 0; k < 3; k++) {
      const kk = hash01(seed * 41 + i * 7 + k * 2.3);
      ctx.lineWidth = 1.1 * s;
      ctx.beginPath();
      ctx.moveTo(ex * (0.55 + kk * 0.15), -from - len * (0.5 + kk * 0.2));
      ctx.lineTo(ex * (0.9 + kk * 0.5) + side * 10 * s, ey - (8 + kk * 16) * s);
      ctx.stroke();
    }
  }

  // ── ствол ──
  const tg = ctx.createLinearGradient(-trunkW, 0, trunkW, 0);
  if (isBirch) {
    tg.addColorStop(0, '#5e5c52');
    tg.addColorStop(0.35, '#c9c4b4');
    tg.addColorStop(0.7, '#a9a496');
    tg.addColorStop(1, '#5b594f');
  } else {
    tg.addColorStop(0, '#2f2e29');
    tg.addColorStop(0.4, '#4d4a41');
    tg.addColorStop(1, '#2b2a25');
  }
  ctx.fillStyle = tg;
  ctx.beginPath();
  ctx.moveTo(-trunkW, 1);
  ctx.quadraticCurveTo(-trunkW * 0.62, -trunkH * 0.55, -trunkW * 0.36 + sway * 0.6, -trunkH);
  ctx.lineTo(trunkW * 0.36 + sway * 0.6, -trunkH);
  ctx.quadraticCurveTo(trunkW * 0.62, -trunkH * 0.55, trunkW, 1);
  ctx.closePath();
  ctx.fill();

  // кора
  if (isBirch) {
    ctx.fillStyle = 'rgba(40,38,34,.7)';
    for (let i = 0; i < 11; i++) {
      const ly = -trunkH * (0.08 + hash01(seed * 7 + i) * 0.86);
      const ww = (2 + hash01(seed * 13 + i) * 7) * s;
      const off = (hash01(seed * 19 + i) - 0.5) * trunkW * 1.1;
      ctx.fillRect(off + sway * 0.3, ly, ww, 1.9 * s);
    }
    // основание темнее
    ctx.fillStyle = 'rgba(46,44,38,.55)';
    ctx.fillRect(-trunkW * 0.9, -6 * s, trunkW * 1.8, 7 * s);
  } else {
    ctx.strokeStyle = 'rgba(24,22,20,.5)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const off = (hash01(seed * 23 + i) - 0.5) * trunkW * 1.2;
      ctx.beginPath();
      ctx.moveTo(off, -2);
      ctx.lineTo(off * 0.7, -trunkH * (0.5 + hash01(seed * 29 + i) * 0.4));
      ctx.stroke();
    }
  }

  // ── листва ──
  const cols = ['#8a6f2c', '#9b7a2e', '#6f5a25', '#a58638', '#5c5127', '#7d6329'];
  const leafN = Math.floor((1 - bare) * 150 * s + 24);
  // тёмная масса кроны
  ctx.fillStyle = 'rgba(44,44,32,.18)';
  for (let i = 0; i < 3; i++) {
    const a = hash01(seed * 53 + i);
    ctx.beginPath();
    ctx.ellipse(
      (a - 0.5) * crownR * 0.8 + sway,
      crownY + (hash01(seed * 61 + i) - 0.4) * crownR * 0.6,
      crownR * (0.6 + a * 0.3),
      crownR * (0.42 + a * 0.2),
      0, 0, Math.PI * 2,
    );
    ctx.fill();
  }
  // кластеры листвы
  const clusters = [];
  for (let c = 0; c < 5; c++) {
    const ca = hash01(seed * 21 + c * 4.7) * Math.PI * 2;
    const cr = hash01(seed * 29 + c * 6.1);
    clusters.push({
      x: Math.cos(ca) * cr * crownR * 0.82,
      y: crownY + Math.sin(ca) * cr * crownR * 0.5 - hash01(seed * 37 + c) * 14 * s,
      r: crownR * (0.34 + hash01(seed * 43 + c) * 0.32),
      w: 0.6 + hash01(seed * 51 + c) * 1.6,
    });
  }
  const clusterWeight = clusters.reduce((a, c) => a + c.w, 0);

  for (let i = 0; i < leafN; i++) {
    const a = hash01(seed * 71 + i * 1.7);
    const b = hash01(seed * 83 + i * 2.9);
    // выбор кластера по весу
    let pick = a * clusterWeight;
    let cl = clusters[0];
    for (const c of clusters) {
      if (pick <= c.w) { cl = c; break; }
      pick -= c.w;
    }
    // гаусс-подобное распределение внутри кластера
    const ang = b * Math.PI * 2;
    const rad = Math.pow(hash01(seed * 89 + i * 3.7), 0.65) * cl.r;
    const lx = cl.x + Math.cos(ang) * rad + sway * (0.7 + (cl.y - crownY) / crownR * 0.3);
    const ly = cl.y + Math.sin(ang) * rad * 0.7;
    ctx.globalAlpha = 0.55 + hash01(seed * 97 + i) * 0.4;
    ctx.fillStyle = cols[(hash01(seed * 31 + i * 3.3) * cols.length) | 0];
    ctx.beginPath();
    ctx.ellipse(lx, ly, (2 + b * 3.2) * s, (1.3 + b * 1.9) * s, ang, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

}

// пара падающих листьев — единственная живая часть дерева в кадре
export function drawTreeLeaves(ctx, t, time) {
  const { s, seed, trunkH, crownY, crownR } = treeGeom(t);
  const sway = Math.sin(time * 0.9 + seed * 12) * 2.2;
  const cols = ['#8a6f2c', '#9b7a2e', '#6f5a25', '#a58638', '#5c5127', '#7d6329'];
  for (let i = 0; i < 2; i++) {
    const ph = (time * 0.22 + hash01(seed * 11 + i)) % 1;
    const fxx = (hash01(seed * 13 + i) - 0.5) * crownR * 1.4 + sway + Math.sin(time * 1.7 + i) * 9;
    const fyy = crownY + ph * (trunkH + 8);
    ctx.globalAlpha = 1 - ph;
    ctx.fillStyle = cols[i % cols.length];
    ctx.beginPath();
    ctx.ellipse(fxx, fyy, 2.2 * s, 1.4 * s, time * 2 + i, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function drawTree(ctx, t, time) {
  drawTreeBody(ctx, t);
  drawTreeLeaves(ctx, t, time);
}

// ── МАШИНА ────────────────────────────────────────────────────
export function drawCar(ctx, c, time) {
  const cx = c.x + c.w / 2;
  const cy = c.y + c.h / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(c.rot || 0);

  const w = c.w, h = c.h;

  // тень
  ctx.fillStyle = 'rgba(6,8,10,.42)';
  ctx.beginPath();
  ctx.ellipse(3, h * 0.06, w * 0.56, h * 0.48, 0, 0, Math.PI * 2);
  ctx.fill();

  // кузов
  const bg = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  bg.addColorStop(0, shade(c.color, -26));
  bg.addColorStop(0.28, shade(c.color, 12));
  bg.addColorStop(0.62, c.color);
  bg.addColorStop(1, shade(c.color, -34));
  ctx.fillStyle = bg;
  rr(ctx, -w / 2, -h / 2, w, h, 11);
  ctx.fill();

  // крыша
  ctx.fillStyle = shade(c.color, -8);
  rr(ctx, -w / 2 + 3, -h * 0.24, w - 6, h * 0.48, 8);
  ctx.fill();

  // стёкла
  const glass = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  glass.addColorStop(0, 'rgba(118,144,158,.75)');
  glass.addColorStop(0.5, 'rgba(38,48,56,.9)');
  glass.addColorStop(1, 'rgba(96,120,134,.6)');
  ctx.fillStyle = glass;
  rr(ctx, -w / 2 + 5, -h * 0.4, w - 10, h * 0.17, 4);
  ctx.fill();
  rr(ctx, -w / 2 + 5, h * 0.23, w - 10, h * 0.16, 4);
  ctx.fill();
  // блик
  ctx.fillStyle = 'rgba(200,220,230,.14)';
  ctx.fillRect(-w * 0.3, -h * 0.38, w * 0.22, h * 0.13);

  // колёса
  ctx.fillStyle = '#191b1e';
  for (const wy of [-h * 0.32, h * 0.24]) {
    ctx.fillRect(-w / 2 - 1.5, wy, 4.5, 15);
    ctx.fillRect(w / 2 - 3, wy, 4.5, 15);
  }

  // фары
  ctx.fillStyle = 'rgba(232,226,206,.8)';
  ctx.fillRect(-w * 0.34, -h / 2 + 1.5, 9, 3);
  ctx.fillRect(w * 0.16, -h / 2 + 1.5, 9, 3);
  ctx.fillStyle = 'rgba(178,64,52,.85)';
  ctx.fillRect(-w * 0.34, h / 2 - 4, 9, 3);
  ctx.fillRect(w * 0.16, h / 2 - 4, 9, 3);

  // номер
  ctx.fillStyle = 'rgba(226,222,206,.7)';
  ctx.fillRect(-8, h / 2 - 8, 16, 4);

  // мокрый блик
  ctx.fillStyle = 'rgba(210,226,236,.1)';
  ctx.fillRect(-w / 2 + 2, -h * 0.1, 2.5, h * 0.3);

  // чехол
  if (c.cover) {
    ctx.fillStyle = 'rgba(96,100,98,.85)';
    rr(ctx, -w / 2 - 1, -h / 2 - 1, w + 2, h + 2, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(60,64,62,.7)';
    ctx.lineWidth = 1;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(-w / 2, i * h * 0.16);
      ctx.lineTo(w / 2, i * h * 0.16 - 3);
      ctx.stroke();
    }
  }

  // открытый капот
  if (c.hoodOpen) {
    ctx.fillStyle = '#2b2d2b';
    ctx.fillRect(-w / 2 + 5, -h / 2 + 6, w - 10, h * 0.22);
    ctx.fillStyle = '#474a44';
    ctx.fillRect(-w / 2 + 8, -h / 2 + 10, w - 16, h * 0.12);
    const cg = ctx.createLinearGradient(0, -h / 2 - 26, 0, -h / 2 + 4);
    cg.addColorStop(0, shade(c.color, 16));
    cg.addColorStop(1, shade(c.color, -18));
    ctx.fillStyle = cg;
    rr(ctx, -w / 2, -h / 2 - 24, w, 28, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(30,32,30,.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.restore();
}

// ── ФОНАРЬ ────────────────────────────────────────────────────
export function drawLamp(ctx, l, on) {
  const x = l.x, y = l.y;
  // мокрый отблеск внизу
  if (on) {
    const rg = ctx.createLinearGradient(x, y + 2, x + 6, y + 150);
    rg.addColorStop(0, 'rgba(246,196,132,.16)');
    rg.addColorStop(1, 'rgba(246,196,132,0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.moveTo(x - 4, y);
    ctx.lineTo(x + 5, y);
    ctx.lineTo(x + 26, y + 150);
    ctx.lineTo(x - 20, y + 150);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(8,10,12,.35)';
  ctx.beginPath();
  ctx.ellipse(x + 5, y + 2, 12, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // цоколь
  ctx.fillStyle = '#4a4d4e';
  ctx.fillRect(x - 6, y - 8, 12, 9);
  // столб
  const g = ctx.createLinearGradient(x - 3, 0, x + 3, 0);
  g.addColorStop(0, '#55595a');
  g.addColorStop(0.5, '#767a78');
  g.addColorStop(1, '#3f4344');
  ctx.fillStyle = g;
  ctx.fillRect(x - 2.6, y - 78, 5.2, 70);

  // изгиб
  ctx.strokeStyle = '#6c7070';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x, y - 78);
  ctx.quadraticCurveTo(x + 2, y - 92, x + 16, y - 92);
  ctx.stroke();

  // плафон
  ctx.fillStyle = on ? '#f4d7a4' : '#5f6466';
  ctx.beginPath();
  ctx.ellipse(x + 18, y - 92, 9, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = on ? 'rgba(255,214,150,.9)' : 'rgba(120,124,126,.4)';
  ctx.beginPath();
  ctx.ellipse(x + 18, y - 90, 6, 3, 0, 0, Math.PI * 2);
  ctx.fill();
}

// ── ЛАВОЧКА ───────────────────────────────────────────────────
export function drawBench(ctx, b) {
  const { x, y, dir } = b;
  ctx.save();
  ctx.translate(x, y);
  // ножки
  ctx.fillStyle = '#3c3e3c';
  ctx.fillRect(-26, -2, 4, 12);
  ctx.fillRect(22, -2, 4, 12);
  // сиденье
  const g = ctx.createLinearGradient(0, -10, 0, 4);
  g.addColorStop(0, '#6f6148');
  g.addColorStop(0.6, '#5a4f3b');
  g.addColorStop(1, '#40392c');
  ctx.fillStyle = g;
  ctx.fillRect(-32, -6, 64, 10);
  ctx.strokeStyle = 'rgba(30,28,24,.5)';
  ctx.lineWidth = 1;
  for (let i = -24; i < 32; i += 14) {
    ctx.beginPath();
    ctx.moveTo(i, -6);
    ctx.lineTo(i, 4);
    ctx.stroke();
  }
  // спинка
  ctx.fillStyle = '#655a44';
  ctx.fillRect(-32, dir === 0 ? -22 : -6, 64, 4);
  if (dir === 0) {
    ctx.fillStyle = 'rgba(30,28,24,.35)';
    ctx.fillRect(-32, -18, 64, 2);
    ctx.fillStyle = '#4a4132';
    ctx.fillRect(-30, -22, 3, 18);
    ctx.fillRect(27, -22, 3, 18);
  }
  // облупившаяся краска
  ctx.fillStyle = 'rgba(180,170,150,.12)';
  ctx.fillRect(-20, -5, 12, 2);
  ctx.restore();
}

// ── МУСОРКА ───────────────────────────────────────────────────
export function drawDumpster(ctx, d) {
  const { x, y, color } = d;
  ctx.fillStyle = 'rgba(8,10,10,.4)';
  ctx.beginPath();
  ctx.ellipse(x + 6, y + 22, 22, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(x, y);
  const g = ctx.createLinearGradient(-18, 0, 18, 0);
  g.addColorStop(0, shade(color, -24));
  g.addColorStop(0.4, shade(color, 10));
  g.addColorStop(1, shade(color, -32));
  ctx.fillStyle = g;
  rr(ctx, -18, -20, 36, 42, 4);
  ctx.fill();
  // крышка
  ctx.fillStyle = shade(color, 18);
  rr(ctx, -19, -24, 38, 8, 3);
  ctx.fill();
  // рёбра
  ctx.strokeStyle = 'rgba(20,24,20,.35)';
  ctx.lineWidth = 1;
  for (let i = -12; i <= 12; i += 8) {
    ctx.beginPath();
    ctx.moveTo(i, -16);
    ctx.lineTo(i, 18);
    ctx.stroke();
  }
  // надпись
  ctx.fillStyle = 'rgba(230,226,210,.5)';
  ctx.font = 'bold 8px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('ТБО', 0, 4);
  // ржавчина
  ctx.fillStyle = 'rgba(128,80,44,.3)';
  ctx.fillRect(-14, 12, 8, 6);
  ctx.restore();

  // пакеты
  ctx.fillStyle = 'rgba(28,30,30,.75)';
  ctx.beginPath();
  ctx.ellipse(x + 25, y + 18, 8, 6, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(56,58,54,.7)';
  ctx.beginPath();
  ctx.ellipse(x - 25, y + 20, 6, 5, -0.2, 0, Math.PI * 2);
  ctx.fill();
}

// ── ТРАНСФОРМАТОРНАЯ БУДКА ───────────────────────────────────
export function drawTrafo(ctx, time) {
  const { x, y, w, d, h } = trafo;
  const baseY = y + d;
  const topY = baseY - h;

  ctx.fillStyle = 'rgba(8,10,10,.4)';
  ctx.fillRect(x + 6, y + d - 4, w, 12);

  ctx.fillStyle = '#5d6360';
  ctx.fillRect(x, topY, w, h);
  const g = ctx.createLinearGradient(0, topY, 0, baseY);
  g.addColorStop(0, 'rgba(180,190,186,.18)');
  g.addColorStop(1, 'rgba(20,26,24,.35)');
  ctx.fillStyle = g;
  ctx.fillRect(x, topY, w, h);

  // крышка с толщиной
  ctx.fillStyle = '#3e4441';
  ctx.fillRect(x - 5, topY - 13, w + 10, 7);
  ctx.fillStyle = '#525855';
  ctx.fillRect(x - 5, topY - 7, w + 10, 8);
  ctx.fillStyle = 'rgba(206,210,200,.14)';
  ctx.fillRect(x - 5, topY - 7, w + 10, 1.6);
  ctx.fillStyle = 'rgba(18,22,20,.45)';
  ctx.fillRect(x, topY - 1, w, 2);

  // вентиляция
  ctx.strokeStyle = 'rgba(28,32,30,.5)';
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    ctx.moveTo(x + 12, topY + 18 + i * 6);
    ctx.lineTo(x + w - 12, topY + 18 + i * 6);
    ctx.stroke();
  }

  // граффити
  ctx.strokeStyle = 'rgba(196,92,64,.5)';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(x + 12, baseY - 26);
  ctx.quadraticCurveTo(x + 26, baseY - 46, x + 38, baseY - 24);
  ctx.quadraticCurveTo(x + 50, baseY - 44, x + 66, baseY - 22);
  ctx.stroke();
  ctx.fillStyle = 'rgba(230,226,210,.4)';
  ctx.font = 'bold 7px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('НЕ ВЛЕЗАЙ', x + w / 2, baseY - 8);

  // знак
  ctx.fillStyle = 'rgba(226,204,90,.65)';
  ctx.beginPath();
  ctx.moveTo(x + w - 20, topY + 12);
  ctx.lineTo(x + w - 8, topY + 32);
  ctx.lineTo(x + w - 32, topY + 32);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#2a2a24';
  ctx.font = 'bold 10px ui-monospace, monospace';
  ctx.fillText('!', x + w - 20, topY + 29);

  // гудящая тень
  ctx.globalAlpha = 0.06 + 0.03 * Math.sin(time * 6);
  ctx.fillStyle = '#cfe6ff';
  ctx.fillRect(x, topY, w, h);
  ctx.globalAlpha = 1;
}

// ── ХОККЕЙНАЯ КОРОБКА ────────────────────────────────────────
export function drawHockey(ctx, time) {
  const { x, y, w, d, wall } = hockey;
  // борта
  ctx.fillStyle = '#8a8b80';
  ctx.strokeStyle = 'rgba(40,44,42,.5)';
  ctx.lineWidth = 1;
  const walls = [
    [x, y, w, wall],
    [x, y + d - wall, w, wall],
    [x, y, wall, d],
    [x + w - wall, y, wall, d],
  ];
  for (const [wx, wy, ww, wh] of walls) {
    const wg = ctx.createLinearGradient(0, wy, 0, wy + wh);
    wg.addColorStop(0, '#6e7066');
    wg.addColorStop(0.5, '#5c5e56');
    wg.addColorStop(1, '#4a4c46');
    ctx.fillStyle = wg;
    ctx.fillRect(wx, wy, ww, wh);
    ctx.fillStyle = 'rgba(224,222,206,.14)';
    ctx.fillRect(wx, wy, ww, 1.6);
    ctx.strokeStyle = 'rgba(28,32,30,.45)';
    ctx.strokeRect(wx, wy, ww, wh);
    // ржавчина
    ctx.fillStyle = 'rgba(126,80,44,.22)';
    for (let i = 0; i < 4; i++) {
      const px = wx + (hash01(wx + i * 7.3) * ww);
      const py = wy + (hash01(wy + i * 11.1) * wh);
      ctx.fillRect(px, py, 5, 4);
    }
  }

  // сетка на воротах
  const goals = [
    { gx: x + 8, gy: y + d / 2, dir: 1 },
    { gx: x + w - 8, gy: y + d / 2, dir: -1 },
  ];
  for (const g of goals) {
    ctx.save();
    ctx.translate(g.gx, g.gy);
    ctx.strokeStyle = 'rgba(212,210,198,.5)';
    ctx.lineWidth = 1.6;
    ctx.strokeRect(-g.dir * 22, -22, g.dir * 22, 44);
    ctx.strokeStyle = 'rgba(200,198,188,.22)';
    ctx.lineWidth = 0.8;
    for (let i = 0; i <= 22; i += 4) {
      ctx.beginPath();
      ctx.moveTo(-g.dir * 22 + g.dir * i, -22);
      ctx.lineTo(-g.dir * 22 + g.dir * i, 22);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-g.dir * 22, -22 + i * 2);
      ctx.lineTo(0, -22 + i * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // забытая клюшка
  ctx.save();
  ctx.translate(x + 40, y + d - 34);
  ctx.rotate(-0.5);
  ctx.fillStyle = 'rgba(160,120,70,.85)';
  ctx.fillRect(-2, -26, 4, 40);
  ctx.fillStyle = 'rgba(40,40,36,.8)';
  ctx.fillRect(-3, 12, 6, 14);
  ctx.restore();
}

// ── ДЕТСКАЯ ПЛОЩАДКА ─────────────────────────────────────────
export function drawMushroom(ctx) {
  ctx.fillStyle = 'rgba(8,10,10,.28)';
  ctx.beginPath();
  ctx.ellipse(mushroom.x + 6, mushroom.y + 4, 24, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#6f6c62';
  ctx.fillRect(mushroom.x - 3, mushroom.y - 34, 6, 34);
  const mg = ctx.createLinearGradient(0, mushroom.y - 58, 0, mushroom.y - 30);
  mg.addColorStop(0, '#a4694f');
  mg.addColorStop(1, '#7d4c39');
  ctx.fillStyle = mg;
  ctx.beginPath();
  ctx.ellipse(mushroom.x, mushroom.y - 40, 30, 17, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = 'rgba(226,220,204,.35)';
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.arc(mushroom.x + i * 15, mushroom.y - 44, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawSandbox(ctx) {
  const sb = sandbox;
  ctx.fillStyle = 'rgba(30,24,16,.4)';
  ctx.fillRect(sb.x - 3, sb.y - 3, sb.w + 6, sb.d + 6);
  ctx.fillStyle = '#766a51';
  ctx.fillRect(sb.x, sb.y, sb.w, sb.d);
  ctx.fillStyle = 'rgba(92,84,64,.6)';
  ctx.fillRect(sb.x + 6, sb.y + 6, sb.w - 12, sb.d - 12);
  ctx.fillStyle = '#5b4e39';
  ctx.fillRect(sb.x, sb.y, sb.w, 6);
  ctx.fillRect(sb.x, sb.y + sb.d - 6, sb.w, 6);
  ctx.fillRect(sb.x, sb.y, 6, sb.d);
  ctx.fillRect(sb.x + sb.w - 6, sb.y, 6, sb.d);
  // совок и стаканчик
  ctx.fillStyle = 'rgba(196,90,72,.85)';
  ctx.fillRect(sb.x + sb.w * 0.62, sb.y + sb.d * 0.5, 10, 4);
  ctx.fillStyle = 'rgba(96,132,150,.8)';
  ctx.fillRect(sb.x + sb.w * 0.28, sb.y + sb.d * 0.62, 6, 7);
}

export function drawCarousel(ctx) {
  const car = carousel;
  ctx.fillStyle = 'rgba(8,10,10,.3)';
  ctx.beginPath();
  ctx.ellipse(car.x + 5, car.y + 6, car.r, car.r * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  const cg = ctx.createRadialGradient(car.x - 8, car.y - 8, 4, car.x, car.y, car.r);
  cg.addColorStop(0, '#77786f');
  cg.addColorStop(1, '#55574f');
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.ellipse(car.x, car.y, car.r, car.r * 0.62, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(30,32,30,.45)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    ctx.fillStyle = '#8a8a7e';
    ctx.beginPath();
    ctx.arc(car.x + Math.cos(a) * car.r * 0.55, car.y + Math.sin(a) * car.r * 0.35, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#5c5e56';
  ctx.beginPath();
  ctx.arc(car.x, car.y, 6, 0, Math.PI * 2);
  ctx.fill();
}

export function drawSlide(ctx) {
  const sl = slide;
  ctx.fillStyle = 'rgba(8,10,10,.34)';
  ctx.beginPath();
  ctx.ellipse(sl.x + sl.w / 2 + 4, sl.y + sl.d - 8, sl.w * 0.62, sl.d * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();

  // площадка наверху
  ctx.fillStyle = '#5f625c';
  ctx.fillRect(sl.x + sl.w - 30, sl.y + 2, 26, sl.d - 8);
  // лестница
  ctx.strokeStyle = '#7d827a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(sl.x + sl.w - 30, sl.y + 6);
  ctx.lineTo(sl.x + sl.w - 4, sl.y + 6);
  ctx.moveTo(sl.x + sl.w - 30, sl.y + sl.d - 10);
  ctx.lineTo(sl.x + sl.w - 4, sl.y + sl.d - 10);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(190,196,186,.35)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(sl.x + sl.w - 28, sl.y + 12 + i * 9);
    ctx.lineTo(sl.x + sl.w - 6, sl.y + 12 + i * 9);
    ctx.stroke();
  }

  // скат
  const sg = ctx.createLinearGradient(sl.x, sl.y, sl.x + sl.w, sl.y + sl.d);
  sg.addColorStop(0, '#6f736c');
  sg.addColorStop(0.45, '#5a5e58');
  sg.addColorStop(1, '#454842');
  ctx.fillStyle = sg;
  ctx.beginPath();
  ctx.moveTo(sl.x + sl.w - 28, sl.y + 3);
  ctx.lineTo(sl.x + sl.w - 28, sl.y + sl.d - 8);
  ctx.lineTo(sl.x + 8, sl.y + sl.d - 16);
  ctx.lineTo(sl.x + 16, sl.y + 14);
  ctx.closePath();
  ctx.fill();

  // бортики ската
  ctx.strokeStyle = '#7f847c';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(sl.x + 16, sl.y + 14);
  ctx.lineTo(sl.x + 8, sl.y + sl.d - 16);
  ctx.moveTo(sl.x + sl.w - 28, sl.y + 3);
  ctx.lineTo(sl.x + sl.w - 28, sl.y + sl.d - 8);
  ctx.stroke();
  // мокрый блик
  ctx.strokeStyle = 'rgba(220,230,232,.16)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(sl.x + 30, sl.y + 20);
  ctx.lineTo(sl.x + 20, sl.y + sl.d - 20);
  ctx.stroke();
  // лужица у подножия
  ctx.fillStyle = 'rgba(120,140,150,.13)';
  ctx.beginPath();
  ctx.ellipse(sl.x + 14, sl.y + sl.d - 6, 20, 7, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function drawSwing(ctx, swingState, time) {
  const sw = swing;
  ctx.lineCap = 'round';

  // тень рамы
  ctx.fillStyle = 'rgba(8,10,10,.25)';
  ctx.beginPath();
  ctx.ellipse(sw.x + sw.w / 2, sw.y + 12, sw.w * 0.6, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  // стойки (А-образные)
  ctx.strokeStyle = '#63655f';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(sw.x - 4, sw.y + 16);
  ctx.lineTo(sw.x + 8, sw.y - 46);
  ctx.moveTo(sw.x + 22, sw.y + 18);
  ctx.lineTo(sw.x + 8, sw.y - 46);
  ctx.moveTo(sw.x + sw.w + 4, sw.y + 16);
  ctx.lineTo(sw.x + sw.w - 8, sw.y - 46);
  ctx.moveTo(sw.x + sw.w - 22, sw.y + 18);
  ctx.lineTo(sw.x + sw.w - 8, sw.y - 46);
  ctx.stroke();
  // перекладина
  ctx.beginPath();
  ctx.moveTo(sw.x + 8, sw.y - 46);
  ctx.lineTo(sw.x + sw.w - 8, sw.y - 46);
  ctx.stroke();

  // сиденья
  for (let i = 0; i < 2; i++) {
    const phase = time * 1.4 + i * 1.7;
    const amp = swingState && swingState.seat === i && swingState.active ? 1 : 0.12;
    const ang = Math.sin(phase) * 0.5 * amp;
    const px = sw.x + 18 + i * (sw.w - 36);
    const py = sw.y - 46;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(ang);
    ctx.strokeStyle = 'rgba(150,148,138,.7)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-7, 0);
    ctx.lineTo(-7, 40);
    ctx.moveTo(7, 0);
    ctx.lineTo(7, 40);
    ctx.stroke();
    ctx.fillStyle = '#5c5140';
    ctx.fillRect(-11, 38, 22, 5);
    ctx.fillStyle = 'rgba(180,170,150,.2)';
    ctx.fillRect(-11, 38, 22, 1.5);
    ctx.restore();
  }
}

// ── ОСТАНОВКА ────────────────────────────────────────────────
export function drawBusStop(ctx, time) {
  const { x, y, w, d } = busStop;

  // тень
  ctx.fillStyle = 'rgba(6,8,10,.4)';
  ctx.fillRect(x + 6, y + d - 6, w + 4, 18);

  // задняя стенка — стекло с отражением
  const gg = ctx.createLinearGradient(0, y, 0, y + d);
  gg.addColorStop(0, 'rgba(118,140,152,.26)');
  gg.addColorStop(0.55, 'rgba(78,96,108,.20)');
  gg.addColorStop(1, 'rgba(52,62,70,.3)');
  ctx.fillStyle = gg;
  ctx.fillRect(x + 4, y + 2, w - 8, d - 4);

  // отражения в стекле
  ctx.fillStyle = 'rgba(180,200,212,.07)';
  ctx.beginPath();
  ctx.moveTo(x + 20, y + 4);
  ctx.lineTo(x + 70, y + 4);
  ctx.lineTo(x + 30, y + d - 4);
  ctx.lineTo(x + 4, y + d - 4);
  ctx.closePath();
  ctx.fill();

  // рама
  ctx.strokeStyle = '#3b4247';
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 3, y + 1, w - 6, d - 2);
  // стойки
  ctx.fillStyle = '#464d52';
  for (const px of [x + 3, x + w / 2 - 1.5, x + w - 6]) ctx.fillRect(px, y + 1, 4, d - 2);

  // лавка внутри
  ctx.fillStyle = '#544a3a';
  ctx.fillRect(x + 22, y + d - 18, w - 44, 6);
  ctx.fillRect(x + 30, y + d - 12, 4, 9);
  ctx.fillRect(x + w - 34, y + d - 12, 4, 9);

  // крыша с толщиной
  const rg = ctx.createLinearGradient(0, y - 20, 0, y + 2);
  rg.addColorStop(0, '#4b5155');
  rg.addColorStop(0.65, '#32383c');
  rg.addColorStop(1, '#23282b');
  ctx.fillStyle = rg;
  ctx.fillRect(x - 8, y - 19, w + 16, 21);
  ctx.fillStyle = 'rgba(206,220,228,.16)';
  ctx.fillRect(x - 8, y - 19, w + 16, 2);
  ctx.fillStyle = 'rgba(10,12,14,.45)';
  ctx.fillRect(x - 8, y + 1, w + 16, 2.5);
  // кромка-водосток
  ctx.fillStyle = '#2c3235';
  ctx.fillRect(x - 8, y - 2, w + 16, 3);

  // опора и табличка
  ctx.fillStyle = '#3a4145';
  ctx.fillRect(x + w / 2 - 2.5, y - 46, 5, 28);
  ctx.fillStyle = '#22282b';
  ctx.fillRect(x + w / 2 - 40, y - 62, 80, 18);
  ctx.strokeStyle = 'rgba(214,222,226,.3)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + w / 2 - 40, y - 62, 80, 18);
  ctx.fillStyle = 'rgba(236,228,208,.85)';
  ctx.font = 'bold 10px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('АВТОБУС', x + w / 2, y - 49);

  // расписание
  ctx.fillStyle = 'rgba(226,222,204,.42)';
  ctx.fillRect(x + 14, y + 12, 22, 26);
  ctx.fillStyle = 'rgba(36,40,40,.55)';
  for (let i = 0; i < 4; i++) ctx.fillRect(x + 17, y + 16 + i * 5, 16, 1.4);
}

// ── ГОЛУБИ ───────────────────────────────────────────────────
export function drawPigeon(ctx, p, time) {
  const bob = Math.sin(time * 4 + p.x * 0.3) > 0.85 ? Math.sin(time * 26) * 1.4 : 0;
  ctx.save();
  ctx.translate(p.x, p.y - p.fly);
  ctx.fillStyle = 'rgba(8,10,10,.3)';
  ctx.beginPath();
  ctx.ellipse(0, 3 + p.fly * 0.4, 5, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createLinearGradient(0, -6, 0, 4);
  g.addColorStop(0, '#7d8490');
  g.addColorStop(1, '#4a5058');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, bob, 5.4, 3.6, 0, 0, Math.PI * 2);
  ctx.fill();
  // голова
  ctx.fillStyle = '#5d6570';
  ctx.beginPath();
  ctx.arc(4.2, bob - 3, 2.3, 0, Math.PI * 2);
  ctx.fill();
  // клюв
  ctx.fillStyle = '#a09070';
  ctx.fillRect(6, bob - 3.4, 2, 1);
  // хвост
  ctx.fillStyle = '#666e78';
  ctx.beginPath();
  ctx.moveTo(-4, bob);
  ctx.lineTo(-9, bob + 1.6);
  ctx.lineTo(-4, bob + 2.4);
  ctx.closePath();
  ctx.fill();
  if (p.fly > 0) {
    const flap = Math.sin(time * 22) * 5;
    ctx.fillStyle = 'rgba(120,130,142,.9)';
    ctx.beginPath();
    ctx.ellipse(-1, bob - 3, 5, 2, flap * 0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(1, bob + 2, 5, 2, -flap * 0.06, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ── КОТ ───────────────────────────────────────────────────────
export function drawCat(ctx, c, time, night) {
  ctx.save();
  ctx.translate(c.x, c.y);
  const bob = Math.sin(time * 1.6) * 0.8;
  ctx.fillStyle = 'rgba(8,10,10,.3)';
  ctx.beginPath();
  ctx.ellipse(0, 4, 12, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#3b3a37';
  ctx.beginPath();
  ctx.ellipse(0, bob - 2, 11, 7.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // хвост
  ctx.strokeStyle = '#3b3a37';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-10, bob - 2);
  ctx.quadraticCurveTo(-18, bob - 6 + Math.sin(time * 2) * 3, -16, bob - 14);
  ctx.stroke();
  // голова
  ctx.beginPath();
  ctx.arc(9, bob - 7, 5.6, 0, Math.PI * 2);
  ctx.fill();
  // уши
  ctx.beginPath();
  ctx.moveTo(5, bob - 11);
  ctx.lineTo(5.5, bob - 16);
  ctx.lineTo(8.5, bob - 12);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(10, bob - 12);
  ctx.lineTo(12, bob - 16.5);
  ctx.lineTo(13.5, bob - 11);
  ctx.closePath();
  ctx.fill();
  // глаза
  ctx.fillStyle = `rgba(220,210,140,${0.55 + night * 0.45})`;
  ctx.fillRect(9, bob - 8, 1.6, 1.6);
  ctx.fillRect(12, bob - 8, 1.6, 1.6);
  ctx.restore();
}

// ── БАБУШКА ──────────────────────────────────────────────────
export function drawGrandma(ctx, x, y, time) {
  const bob = Math.sin(time * 1.1) * 0.7;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(8,10,10,.35)';
  ctx.beginPath();
  ctx.ellipse(0, 2, 14, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // пальто
  const cg = ctx.createLinearGradient(0, -30, 0, 0);
  cg.addColorStop(0, '#4e4a44');
  cg.addColorStop(1, '#35322d');
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.moveTo(-11, 0);
  ctx.quadraticCurveTo(-14, -20, -8, -28);
  ctx.lineTo(8, -28);
  ctx.quadraticCurveTo(14, -20, 11, 0);
  ctx.closePath();
  ctx.fill();
  // ноги
  ctx.fillStyle = '#2b2b2c';
  ctx.fillRect(-8, -2, 6, 5);
  ctx.fillRect(2, -2, 6, 5);
  // голова
  ctx.fillStyle = '#c2a189';
  ctx.beginPath();
  ctx.arc(0, -34 + bob, 6.4, 0, Math.PI * 2);
  ctx.fill();
  // платок
  ctx.fillStyle = '#6c4a4a';
  ctx.beginPath();
  ctx.arc(0, -36 + bob, 7.4, Math.PI * 0.9, Math.PI * 2.1);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-7, -34 + bob);
  ctx.quadraticCurveTo(0, -22 + bob, 7, -34 + bob);
  ctx.quadraticCurveTo(0, -30 + bob, -7, -34 + bob);
  ctx.fill();
  // руки
  ctx.fillStyle = '#3c3833';
  ctx.fillRect(-10, -20, 4, 14);
  ctx.fillRect(6, -20, 4, 14);
  // сумка
  ctx.fillStyle = '#4a3f31';
  ctx.beginPath();
  ctx.ellipse(13, -1, 7, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#3a3126';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(11, -6);
  ctx.quadraticCurveTo(13, -16, 8, -20);
  ctx.stroke();
  ctx.restore();
}

// ── МУЖИК ────────────────────────────────────────────────────
export function drawMan(ctx, x, y, time, smokePuffs) {
  const bob = Math.sin(time * 0.9) * 0.8;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(8,10,10,.35)';
  ctx.beginPath();
  ctx.ellipse(0, 2, 12, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // штаны
  ctx.fillStyle = '#33383c';
  ctx.fillRect(-8, -14, 7, 15);
  ctx.fillRect(1, -14, 7, 15);
  ctx.fillStyle = '#20252a';
  ctx.fillRect(-9, -2, 8, 4);
  ctx.fillRect(1, -2, 8, 4);
  // куртка
  const jg = ctx.createLinearGradient(0, -38, 0, -10);
  jg.addColorStop(0, '#4a5057');
  jg.addColorStop(1, '#33383d');
  ctx.fillStyle = jg;
  rr(ctx, -11, -38, 22, 26, 4);
  ctx.fill();
  // воротник
  ctx.fillStyle = '#555c63';
  ctx.fillRect(-7, -39, 14, 5);
  // голова
  ctx.fillStyle = '#b8917a';
  ctx.beginPath();
  ctx.arc(0, -45 + bob, 6.4, 0, Math.PI * 2);
  ctx.fill();
  // кепка
  ctx.fillStyle = '#2e3338';
  ctx.beginPath();
  ctx.arc(0, -48 + bob, 7, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(2, -49 + bob, 8, 2.6);
  // руки
  ctx.fillStyle = '#3e444a';
  ctx.fillRect(-13, -34, 4, 18);
  ctx.fillRect(9, -34, 4, 15);
  // сигарета
  ctx.fillStyle = '#e8c9a0';
  ctx.fillRect(12, -22, 6, 1.6);
  ctx.fillStyle = 'rgba(255,140,70,.9)';
  ctx.fillRect(17.4, -22.2, 1.6, 2);
  // дым
  for (const p of smokePuffs) {
    ctx.globalAlpha = Math.max(0, 1 - p.life / 2.4) * 0.35;
    ctx.fillStyle = '#cfd6d8';
    ctx.beginPath();
    ctx.arc(18 + p.x, -24 + p.y, 3 + p.life * 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// ── МЯЧ ───────────────────────────────────────────────────────
export function drawBall(ctx, b, time) {
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.fillStyle = 'rgba(8,10,10,.3)';
  ctx.beginPath();
  ctx.ellipse(2, 5, b.r * 0.9, b.r * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createRadialGradient(-3, -3, 1, 0, 0, b.r);
  g.addColorStop(0, '#b4ae9c');
  g.addColorStop(1, '#6f6a5e');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, b.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(40,40,38,.65)';
  ctx.beginPath();
  ctx.arc(b.r * 0.3, b.r * 0.1, b.r * 0.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-b.r * 0.5, -b.r * 0.35, b.r * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
