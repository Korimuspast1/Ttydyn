// Аудит коллизий: проверяет, что сквозь объекты не пройти и до всех дойти можно.
// Запуск: node tools/collide.mjs
import { interactables, isBlocked, paths, rects, circles } from '../src/world.js';

let fail = 0;

// 1. до каждого интерактивного объекта можно подойти
for (const iv of interactables) {
  const R = (iv.r || 48) - 2;
  let ok = false;
  for (let a = 0; a < 64 && !ok; a++) {
    const ang = (a / 64) * Math.PI * 2;
    for (const d of [R, R * 0.75, R * 0.5, 24, 14]) {
      if (!isBlocked(iv.x + Math.cos(ang) * d, iv.y + Math.sin(ang) * d, 10)) { ok = true; break; }
    }
  }
  if (!ok) { console.log('НЕДОСТИЖИМ:', iv.id, `@${iv.x},${iv.y}`); fail++; }
}

// 2. по тропинкам можно пройти
for (let i = 0; i < paths.length; i++) {
  const p = paths[i];
  const steps = Math.max(2, Math.round(Math.hypot(p.x2 - p.x1, p.y2 - p.y1) / 20));
  for (let j = 0; j <= steps; j++) {
    const t = j / steps;
    if (isBlocked(p.x1 + (p.x2 - p.x1) * t, p.y1 + (p.y2 - p.y1) * t, 10)) {
      console.log('ТРОПИНКА ЗАБЛОКИРОВАНА: p' + i); fail++; break;
    }
  }
}

// 3. центр каждого объекта-препятствия блокирует проход
for (const o of rects) {
  if (isBlocked(o.x + o.w / 2, o.y + o.h / 2, 10)) continue;
  console.log('ПРОХОД СКВОЗЬ ПРЕПЯТСТВИЕ:', o.tag, `@${o.x + o.w / 2},${o.y + o.h / 2}`); fail++;
}
for (const o of circles) {
  if (isBlocked(o.x, o.y, 10)) continue;
  console.log('ПРОХОД СКВОЗЬ ПРЕПЯТСТВИЕ: circle', `@${o.x},${o.y}`); fail++;
}

// 4. игрок не должен застрять при старте
if (isBlocked(600, 900, 10)) { console.log('СТАРТОВАЯ ТОЧКА ЗАБЛОКИРОВАНА'); fail++; }

console.log(fail ? `ПРОВАЛОВ: ${fail}` : 'КОЛЛИЗИИ OK');
process.exit(fail ? 1 : 0);
