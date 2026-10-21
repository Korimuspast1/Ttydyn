// ─────────────────────────────────────────────────────────────
//  ТОСКА — персонаж (пальто, шапка, шарф, зонт)
// ─────────────────────────────────────────────────────────────
import { isBlocked } from './world.js';

export const PAL = {
  coat: '#3d4854',
  coatDark: '#2d353f',
  coatLight: '#4a5765',
  jeans: '#2f353c',
  jeansDark: '#252a30',
  boot: '#1b1f23',
  skin: '#c3a086',
  skinDark: '#a5846c',
  beanie: '#2b3139',
  beanieLight: '#39414b',
  scarf: '#7a3d3d',
  scarfDark: '#5f2e2e',
  umbrella: '#232a33',
  umbrellaLight: '#2f3944',
};

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.speed = 0;
    this.facing = 'down';
    this.walkPhase = 0;
    this.mode = 'walk';
    this.umbrella = false;
    this.flashlight = false;
    this.seat = null;
    this.bobT = Math.random() * 10;
    this.breathT = 0;
    this.stepT = 0;
    this.stepCount = 0;
  }

  get moving() {
    return this.speed > 6 && this.mode === 'walk';
  }

  update(dt, input, opts = {}) {
    this.bobT += dt;
    if (this.mode !== 'walk') {
      this.speed *= 0.8;
      this.walkPhase += dt * (this.mode === 'swing' ? 2 : 0.4);
      return;
    }

    let dx = input.x;
    let dy = input.y;
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }

    const running = !!opts.run;
    const maxSpeed = running ? 152 : 86;
    const accel = running ? 620 : 480;

    // плавное ускорение
    this.vx += (dx * maxSpeed - this.vx) * Math.min(1, accel * dt / maxSpeed);
    this.vy += (dy * maxSpeed - this.vy) * Math.min(1, accel * dt / maxSpeed);

    let vx = this.vx;
    let vy = this.vy;
    this.speed = Math.hypot(vx, vy);
    if (this.speed < 2.5) {
      this.vx = 0;
      this.vy = 0;
      this.speed = 0;
    }

    if (this.speed > 0.5) {
      if (Math.abs(vx) > Math.abs(vy) * 1.15) this.facing = vx > 0 ? 'right' : 'left';
      else this.facing = vy > 0 ? 'down' : 'up';
    }

    // движение с подшагами и скольжением по стенам
    const stepDist = Math.max(Math.abs(vx), Math.abs(vy)) * dt;
    const steps = Math.max(1, Math.ceil(stepDist / 6));
    const sx = (vx * dt) / steps;
    const sy = (vy * dt) / steps;
    const R = 9;

    for (let i = 0; i < steps; i++) {
      let nx = this.x + sx;
      let ny = this.y + sy;
      if (!isBlocked(nx, ny, R)) {
        this.x = nx;
        this.y = ny;
      } else if (!isBlocked(nx, this.y, R)) {
        this.x = nx;
        this.vy *= 0.4;
      } else if (!isBlocked(this.x, ny, R)) {
        this.y = ny;
        this.vx *= 0.4;
      } else {
        this.vx = 0;
        this.vy = 0;
        this.speed = 0;
        break;
      }
    }

    // анимация шага
    this.walkPhase += (this.speed / 34) * dt * 6;
    const newSteps = Math.floor(this.walkPhase / Math.PI);
    if (newSteps > this.stepCount) {
      this.stepCount = newSteps;
      if (opts.onStep) opts.onStep(this.speed > 110);
    }
    if (this.walkPhase > 1000) this.walkPhase %= Math.PI * 2;

    // дыхание на холоде
    this.breathT += dt;
    if (this.breathT > 3.4) {
      this.breathT = 0;
      if (opts.onBreath) opts.onBreath();
    }
  }

  // ── рисование ──────────────────────────────────────────────
  draw(ctx, time, night = 0.6) {
    const x = this.x;
    const y = this.y;
    const sitting = this.mode === 'sit';
    const swinging = this.mode === 'swing';
    const walking = this.moving;
    const phase = this.walkPhase;
    const swingLeg = walking ? Math.sin(phase) : 0;
    const swingArm = walking ? Math.sin(phase + Math.PI) : 0;
    const bob = walking ? Math.abs(Math.sin(phase)) * 1.3 : Math.sin(this.bobT * 1.6) * 0.5;
    const p = PAL;

    // тень
    ctx.fillStyle = 'rgba(6,8,10,.42)';
    ctx.beginPath();
    ctx.ellipse(x + 2, y + 1, 13, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(x, y);
    if (sitting) ctx.translate(0, 6);

    const fy = -bob;

    // ── ноги ──
    if (sitting) {
      ctx.fillStyle = p.jeans;
      ctx.fillRect(-9, -14, 8, 10);
      ctx.fillRect(1, -14, 8, 10);
      ctx.fillStyle = p.jeansDark;
      ctx.fillRect(-9, -6, 8, 3);
      ctx.fillRect(1, -6, 8, 3);
      ctx.fillStyle = p.boot;
      ctx.fillRect(-10, -4, 9, 4);
      ctx.fillRect(1, -4, 9, 4);
    } else if (swinging) {
      ctx.fillStyle = p.jeans;
      ctx.fillRect(-8, -14, 7, 12);
      ctx.fillRect(1, -14, 7, 12);
      ctx.fillStyle = p.boot;
      ctx.fillRect(-9, -3, 9, 4);
      ctx.fillRect(1, -3, 9, 4);
    } else {
      const l1 = swingLeg * 4.5;
      const l2 = -swingLeg * 4.5;
      ctx.fillStyle = p.jeans;
      ctx.fillRect(-8, -14 + Math.max(0, l1) * 0.4, 7, 11 - Math.abs(l1) * 0.26);
      ctx.fillRect(1, -14 + Math.max(0, l2) * 0.4, 7, 11 - Math.abs(l2) * 0.26);
      ctx.fillStyle = p.jeansDark;
      ctx.fillRect(-8, -6, 7, 2.5);
      ctx.fillRect(1, -6, 7, 2.5);
      ctx.fillStyle = p.boot;
      ctx.fillRect(-9 + l1 * 0.3, -3 + Math.min(0, l1), 9, 4);
      ctx.fillRect(1 + l2 * 0.3, -3 + Math.min(0, l2), 9, 4);
    }

    // ── пальто ──
    const cg = ctx.createLinearGradient(-12, -38, 12, -12);
    cg.addColorStop(0, p.coatDark);
    cg.addColorStop(0.45, p.coat);
    cg.addColorStop(1, p.coatLight);
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.moveTo(-10, fy - 14);
    ctx.quadraticCurveTo(-13, fy - 30, -8, fy - 36);
    ctx.lineTo(8, fy - 36);
    ctx.quadraticCurveTo(13, fy - 30, 10, fy - 14);
    ctx.quadraticCurveTo(4, fy - 11, 0, fy - 13);
    ctx.quadraticCurveTo(-4, fy - 11, -10, fy - 14);
    ctx.closePath();
    ctx.fill();

    // полы пальто
    ctx.fillStyle = 'rgba(18,22,26,.35)';
    ctx.beginPath();
    ctx.moveTo(-10, fy - 16);
    ctx.lineTo(0, fy - 13);
    ctx.lineTo(10, fy - 16);
    ctx.lineTo(9, fy - 10);
    ctx.lineTo(-9, fy - 10);
    ctx.closePath();
    ctx.fill();

    // воротник и шарф
    ctx.fillStyle = p.scarfDark;
    ctx.fillRect(-8, fy - 38, 16, 5);
    ctx.fillStyle = p.scarf;
    ctx.fillRect(-7, fy - 37, 14, 3.2);
    // свисающий конец шарфа
    const wind = Math.sin(time * 2.2) * 1.6;
    ctx.fillStyle = p.scarf;
    ctx.beginPath();
    ctx.moveTo(4, fy - 35);
    ctx.quadraticCurveTo(9 + wind, fy - 29, 7 + wind, fy - 22);
    ctx.lineTo(3, fy - 24);
    ctx.quadraticCurveTo(5, fy - 30, 2, fy - 34);
    ctx.closePath();
    ctx.fill();

    // ── руки ──
    const armSwing = walking ? swingArm * 4 : 0;
    if (this.facing === 'left' || this.facing === 'right') {
      const d = this.facing === 'right' ? 1 : -1;
      ctx.fillStyle = p.coatDark;
      ctx.fillRect(d * 6 - 2, fy - 33 + armSwing * d * 0.4, 5, 17);
      ctx.fillStyle = p.skinDark;
      ctx.fillRect(d * 6 + 0.5 - 2 * d, fy - 18 + armSwing * d * 0.4, 3.5, 4);
    } else {
      ctx.fillStyle = p.coatDark;
      ctx.fillRect(-13, fy - 33 + armSwing * 0.5, 4.5, 17);
      ctx.fillRect(8.5, fy - 33 - armSwing * 0.5, 4.5, 17);
    }

    // ── голова ──
    const hx = this.facing === 'left' ? -1.5 : this.facing === 'right' ? 1.5 : 0;
    ctx.fillStyle = p.skin;
    ctx.beginPath();
    ctx.arc(hx, fy - 45, 7, 0, Math.PI * 2);
    ctx.fill();
    // тень на лице
    ctx.fillStyle = 'rgba(90,66,50,.25)';
    ctx.beginPath();
    ctx.arc(hx + 2, fy - 43, 6, 0, Math.PI * 2);
    ctx.fill();

    // шапка
    const bg = ctx.createLinearGradient(0, fy - 56, 0, fy - 44);
    bg.addColorStop(0, p.beanieLight);
    bg.addColorStop(1, p.beanie);
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(hx, fy - 47, 7.4, Math.PI * 1.02, Math.PI * 1.98);
    ctx.fill();
    ctx.fillRect(hx - 7.4, fy - 49, 14.8, 4);
    ctx.fillStyle = 'rgba(20,24,28,.3)';
    ctx.fillRect(hx - 7.4, fy - 47.5, 14.8, 1.2);

    // лицо (только когда видно)
    if (this.facing !== 'up') {
      const ex = this.facing === 'left' ? -3 : this.facing === 'right' ? 3 : 0;
      ctx.fillStyle = 'rgba(38,32,30,.85)';
      if (this.facing === 'down') {
        ctx.fillRect(hx - 3.4 + ex, fy - 45.5, 1.6, 1.8);
        ctx.fillRect(hx + 1.8 + ex, fy - 45.5, 1.6, 1.8);
        // нос
        ctx.fillStyle = 'rgba(150,110,88,.55)';
        ctx.fillRect(hx - 0.8, fy - 43.6, 1.6, 2.2);
        // щёки от холода
        ctx.fillStyle = 'rgba(160,92,84,.22)';
        ctx.beginPath();
        ctx.arc(hx - 4.4, fy - 43, 1.8, 0, Math.PI * 2);
        ctx.arc(hx + 4.4, fy - 43, 1.8, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(hx + ex - 0.5, fy - 45.5, 1.5, 1.8);
        ctx.fillRect(hx + ex + 2.6, fy - 45.5, 1.5, 1.8);
      }
    }

    // ── зонт ──
    if (this.umbrella) {
      const tilt = walking ? Math.sin(phase * 0.5) * 2 : Math.sin(time * 0.9) * 0.8;
      const ux = hx + 3 + tilt;
      const uy = fy - 74;
      // ручка
      ctx.strokeStyle = '#3a3a38';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(hx + 5, fy - 30);
      ctx.lineTo(hx + 4, uy + 8);
      ctx.stroke();
      // купол
      const ug = ctx.createLinearGradient(ux, uy - 12, ux, uy + 8);
      ug.addColorStop(0, p.umbrellaLight);
      ug.addColorStop(1, p.umbrella);
      ctx.fillStyle = ug;
      ctx.beginPath();
      ctx.moveTo(ux - 25, uy + 4);
      ctx.quadraticCurveTo(ux - 20, uy - 13, ux, uy - 14);
      ctx.quadraticCurveTo(ux + 20, uy - 13, ux + 25, uy + 4);
      ctx.quadraticCurveTo(ux + 12, uy + 1, ux, uy + 5);
      ctx.quadraticCurveTo(ux - 12, uy + 1, ux - 25, uy + 4);
      ctx.closePath();
      ctx.fill();
      // рёбра
      ctx.strokeStyle = 'rgba(12,16,20,.5)';
      ctx.lineWidth = 1;
      for (const f of [-0.55, -0.2, 0.2, 0.55]) {
        ctx.beginPath();
        ctx.moveTo(ux, uy - 13);
        ctx.quadraticCurveTo(ux + 25 * f, uy - 6, ux + 25 * f, uy + 4);
        ctx.stroke();
      }
      // капли
      for (let i = 0; i < 3; i++) {
        const d = (time * 26 + i * 17) % 18;
        ctx.fillStyle = `rgba(190,210,222,${0.35 - d * 0.015})`;
        ctx.fillRect(ux - 24 + i * 20, uy + 5 + d, 1, 2.4);
      }
    }

    ctx.restore();
  }
}
