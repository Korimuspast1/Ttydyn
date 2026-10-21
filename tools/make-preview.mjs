// Собирает preview-картинки для README из свежих скриншотов
import { createCanvas, loadImage } from '@napi-rs/canvas';
import fs from 'node:fs';

fs.mkdirSync('docs', { recursive: true });

const jobs = [
  ['/tmp/shots/02-umbrella.png', 'docs/preview-dvor.jpg', 1200],
  ['/tmp/shots/04-playground.png', 'docs/preview-ploshchadka.jpg', 1000],
  ['/tmp/shots/10-garages.png', 'docs/preview-magazin.jpg', 1000],
];

for (const [src, dst, width] of jobs) {
  if (!fs.existsSync(src)) continue;
  const img = await loadImage(src);
  const h = Math.round((img.height / img.width) * width);
  const c = createCanvas(width, h);
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0, width, h);
  fs.writeFileSync(dst, c.toBuffer('image/jpeg', 82));
  console.log(dst, fs.statSync(dst).size);
}
