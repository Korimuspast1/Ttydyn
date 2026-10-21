import { PixBuf } from '../engine/models';
import { SimToolId } from '../engine/types';

export function createZomboidPixelIcon(id: SimToolId | 'tab_all' | 'tab_zombies' | 'tab_survivors' | 'tab_build' | 'tab_events', displayPx = 24): HTMLCanvasElement {
  const b = new PixBuf(16, 16);

  switch (id) {
    case 'tab_all':
      b.rect(2, 2, 5, 5, '#ffd466');
      b.rect(9, 2, 5, 5, '#7cb518');
      b.rect(2, 9, 5, 5, '#4cc9f0');
      b.rect(9, 9, 5, 5, '#e63946');
      break;

    case 'inspect':
      b.rect(4, 3, 6, 6, '#90e0ef');
      b.rect(5, 4, 4, 4, '#caf0f8');
      b.px(6, 5, '#ffffff');
      b.rect(9, 9, 2, 2, '#bc6c25');
      b.rect(11, 11, 3, 3, '#ffd466');
      break;

    case 'expand_base':
    case 'tab_build':
      // Golden Hammer + Brick House Wing!
      b.rect(2, 8, 9, 6, '#bc6c25');
      b.rect(1, 6, 11, 2, '#7f5539');
      b.rect(5, 10, 3, 4, '#3d2c1d');
      b.rect(10, 2, 5, 3, '#adb5bd');
      b.rect(12, 5, 2, 6, '#ffd466');
      break;

    case 'barricade':
      b.rect(2, 3, 12, 2, '#d4a373');
      b.rect(2, 7, 12, 2, '#bc6c25');
      b.rect(2, 11, 12, 2, '#d4a373');
      b.px(4, 4, '#adb5bd');
      b.px(11, 4, '#adb5bd');
      b.px(4, 12, '#adb5bd');
      b.px(11, 12, '#adb5bd');
      break;

    case 'spawn_car':
      b.rect(2, 7, 12, 5, '#4895ef');
      b.rect(4, 4, 8, 3, '#90e0ef');
      b.rect(3, 12, 3, 2, '#212529');
      b.rect(10, 12, 3, 2, '#212529');
      b.px(13, 8, '#ffd466');
      break;

    case 'airdrop':
      b.rect(4, 2, 8, 4, '#f8f9fa');
      b.px(5, 6, '#adb5bd');
      b.px(10, 6, '#adb5bd');
      b.rect(4, 8, 8, 6, '#588157');
      b.rect(4, 10, 8, 2, '#ffd466');
      break;

    case 'spawn_shambler':
    case 'tab_zombies':
      b.rect(5, 3, 6, 6, '#7cb518');
      b.px(6, 5, '#e63946');
      b.px(9, 5, '#e63946');
      b.rect(6, 8, 4, 1, '#9d0208');
      b.rect(4, 9, 8, 5, '#495057');
      break;

    case 'spawn_sprinter':
      b.rect(6, 2, 5, 5, '#80ed99');
      b.px(7, 4, '#ff002b');
      b.px(9, 4, '#ff002b');
      b.rect(5, 7, 6, 4, '#d90429');
      b.rect(2, 5, 3, 1, '#ffd466');
      b.rect(1, 8, 3, 1, '#ffd466');
      b.rect(4, 11, 3, 3, '#343a40');
      b.rect(9, 10, 4, 3, '#343a40');
      break;

    case 'spawn_armored_zed':
      b.rect(4, 2, 8, 3, '#4a5749');
      b.rect(5, 5, 6, 4, '#7cb518');
      b.px(6, 6, '#ff2a54');
      b.px(9, 6, '#ff2a54');
      b.rect(3, 9, 10, 5, '#343a40');
      b.rect(5, 10, 6, 3, '#6b705c');
      break;

    case 'horde_wave':
      b.rect(2, 4, 4, 4, '#7cb518');
      b.rect(10, 4, 4, 4, '#7cb518');
      b.rect(6, 3, 4, 5, '#9ef01a');
      b.px(7, 5, '#e63946');
      b.px(8, 5, '#e63946');
      b.rect(2, 9, 12, 5, '#3a5a40');
      break;

    case 'virus_cloud':
      b.rect(5, 5, 6, 6, '#80ed99');
      b.rect(7, 2, 2, 12, '#38b000');
      b.rect(2, 7, 12, 2, '#38b000');
      b.px(4, 4, '#ccff33');
      b.px(11, 4, '#ccff33');
      b.px(4, 11, '#ccff33');
      b.px(11, 11, '#ccff33');
      break;

    case 'spawn_survivors':
    case 'tab_survivors':
      b.rect(5, 2, 6, 2, '#5c3d28');
      b.rect(5, 4, 6, 5, '#f2cc8f');
      b.px(6, 6, '#1d3557');
      b.px(9, 6, '#1d3557');
      b.rect(4, 9, 8, 5, '#e07a5f');
      break;

    case 'spawn_police':
      b.rect(4, 2, 8, 2, '#1d3557');
      b.rect(6, 3, 3, 1, '#ffd466');
      b.rect(5, 4, 6, 5, '#f2cc8f');
      b.rect(4, 9, 8, 5, '#2b4570');
      b.px(9, 10, '#ffd466');
      break;

    case 'spawn_soldiers':
      b.rect(4, 2, 8, 3, '#4f5d4e');
      b.rect(5, 5, 6, 4, '#e9c46a');
      b.rect(4, 9, 8, 5, '#3f4a36');
      b.rect(8, 10, 6, 2, '#212529');
      break;

    case 'spawn_medics':
      b.rect(3, 3, 10, 10, '#f8f9fa');
      b.rect(7, 5, 2, 6, '#e63946');
      b.rect(5, 7, 6, 2, '#e63946');
      break;

    case 'spawn_raiders':
      b.rect(5, 2, 6, 5, '#ced4da');
      b.rect(5, 6, 6, 3, '#d90429');
      b.px(6, 4, '#111111');
      b.px(9, 4, '#111111');
      b.rect(4, 9, 8, 5, '#212529');
      break;

    case 'helicopter':
    case 'tab_events':
      b.rect(1, 3, 14, 1, '#dee2e6');
      b.rect(7, 4, 2, 2, '#adb5bd');
      b.rect(4, 6, 8, 5, '#495057');
      b.rect(8, 7, 3, 3, '#90e0ef');
      b.rect(2, 8, 3, 2, '#ffd466');
      b.rect(5, 12, 6, 1, '#adb5bd');
      break;

    case 'sound_lure':
      b.rect(4, 6, 6, 7, '#e63946');
      b.rect(5, 5, 4, 1, '#ff9f1c');
      b.px(6, 7, '#ffffff');
      b.rect(2, 3, 2, 1, '#ffd466');
      b.rect(12, 3, 2, 1, '#ffd466');
      b.rect(7, 2, 2, 2, '#ffd466');
      break;

    case 'molotov':
      b.rect(7, 2, 2, 3, '#ffbe0b');
      b.px(8, 1, '#fb5607');
      b.rect(6, 5, 4, 3, '#adb5bd');
      b.rect(5, 8, 6, 6, '#bc6c25');
      b.rect(6, 10, 4, 3, '#ff5400');
      break;

    case 'propane_bomb':
      b.rect(6, 2, 4, 2, '#adb5bd');
      b.rect(4, 4, 8, 9, '#d90429');
      b.rect(5, 7, 6, 2, '#ffd466');
      b.px(6, 5, '#ffffff');
      break;
  }

  b.outline1px('#130e0b');
  const cv = b.toCanvas();
  cv.className = 'pixel-icon';
  cv.style.width = `${displayPx}px`;
  cv.style.height = `${displayPx}px`;
  return cv;
}
