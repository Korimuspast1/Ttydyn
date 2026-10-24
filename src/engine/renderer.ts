import { EntityManager, ROLE_APC, ROLE_TANK } from './entities';
import {
  drawCampfireHD,
  drawDragonHD,
  drawVillagerHD,
  drawWavingFlag,
  drawWindmillSails,
  KINGDOM_PALETTES,
  ModelAtlas,
} from './models';
import { hash2D } from './noise';
import {
  PARTICLE_ACID,
  PARTICLE_DUST,
  PARTICLE_EMBER,
  PARTICLE_FIRE,
  PARTICLE_LAVA,
  PARTICLE_LEAF,
  PARTICLE_SAND,
  PARTICLE_SEED,
  PARTICLE_SMOKE,
  PARTICLE_SNOW,
  PARTICLE_SOIL,
  PARTICLE_SPLASH,
  PARTICLE_STEAM,
  PARTICLE_STONE,
  PARTICLE_TNT,
  PARTICLE_WATER,
  PARTICLE_WOOD_CHIP,
  PhysicsEngine,
} from './physics';
import { BUILDING_MAX_HP, CursorInspection, ToolId, WORLD_H, WORLD_SIZE, WORLD_W } from './types';
import { WorldState } from './world';

function packColor(r: number, g: number, b: number, a = 255): number {
  return (a << 24) | (b << 16) | (g << 8) | r;
}

const ITEM_WHEAT = 0;
const ITEM_TNT = 1;
const ITEM_BUILDING = 2;
const ITEM_VILLAGER = 3;
const ITEM_GOLD = 4;

// Precomputed 1024-entry Sine LUT & static 320x200 tile hash LUT — ZERO per-pixel trig or hash calls!
const SIN_LUT_BITS = 10;
const SIN_LUT_SIZE = 1 << SIN_LUT_BITS;
const SIN_LUT_MASK = SIN_LUT_SIZE - 1;
const RAD_TO_LUT = SIN_LUT_SIZE / (Math.PI * 2);
const SIN_LUT = new Float32Array(SIN_LUT_SIZE);
for (let i = 0; i < SIN_LUT_SIZE; i++) {
  SIN_LUT[i] = Math.sin((i / SIN_LUT_SIZE) * Math.PI * 2);
}
const HASH_GRID = new Uint8Array(WORLD_SIZE);
for (let y = 0; y < WORLD_H; y++) {
  for (let x = 0; x < WORLD_W; x++) {
    HASH_GRID[y * WORLD_W + x] = hash2D(x, y) & 255;
  }
}

export class WorldRenderer {
  private mainCtx: CanvasRenderingContext2D | null;
  private offscreenCanvas: HTMLCanvasElement;
  private offscreenCtx: CanvasRenderingContext2D;
  public imageData: ImageData;
  private buf32: Uint32Array;
  private shadowMask = new Uint8Array(WORLD_SIZE);
  private settlementKingdomLut = new Int8Array(64);
  public lowPowerFx = false;

  // Detailed High-DPI Models for Houses, Windmills, Towers, Castles, Knights, Dragons, Gold & Wheat!
  private models: ModelAtlas;

  // Pre-allocated Y-sort arrays for up to 8,192 detailed models (zero GC!)
  private sortY = new Float32Array(8192);
  private sortKind = new Uint8Array(8192);
  private sortIndex = new Int32Array(8192);
  private sortOrder = new Int32Array(8192);

  // Camera state (in world tiles 320x200)
  public camX = WORLD_W * 0.5;
  public camY = WORLD_H * 0.5;
  public zoom = 3.2;
  public dpr = 1;

  constructor(
    public canvas: HTMLCanvasElement,
    private world: WorldState,
    private physics: PhysicsEngine,
    private entities: EntityManager,
  ) {
    this.mainCtx = this.canvas.getContext('2d', { alpha: false });
    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCanvas.width = WORLD_W;
    this.offscreenCanvas.height = WORLD_H;
    const octx = this.offscreenCanvas.getContext('2d');
    if (!octx) throw new Error('2D context unavailable');
    this.offscreenCtx = octx;
    this.imageData = this.offscreenCtx.createImageData(WORLD_W, WORLD_H);
    this.buf32 = new Uint32Array(this.imageData.data.buffer);
    this.models = new ModelAtlas();
  }

  public get logicalWidth(): number {
    return this.canvas.width / this.dpr;
  }

  public get logicalHeight(): number {
    return this.canvas.height / this.dpr;
  }

  public fitCameraToViewport(): void {
    const w = this.logicalWidth;
    const h = this.logicalHeight;
    const isPortraitPhone = w < 600 && h > w;
    const isShortLandscape = h < 500;
    const padBottom = isShortLandscape ? 88 : isPortraitPhone ? 148 : 104;
    const padTop = isShortLandscape ? 32 : 38;
    const availW = Math.max(200, w - (isPortraitPhone ? 12 : 24));
    const availH = Math.max(160, h - padBottom - padTop);
    const fitAll = Math.min(availW / WORLD_W, availH / WORLD_H) * 1.06;
    // On narrow portrait phone screens, start slightly zoomed in so islands & crisp pixel villagers are immediately legible!
    this.zoom = isPortraitPhone ? Math.max(2.35, fitAll * 1.95) : Math.max(1.5, fitAll);
    this.camX = WORLD_W * 0.5;
    this.camY = WORLD_H * 0.5 + (padBottom - padTop) / (2 * this.zoom);
    this.clampCamera();
  }

  public focusOnSettlement(indexOffset = 0): void {
    const active = this.entities.settlements.filter((s) => s.active);
    if (active.length === 0) return;
    active.sort((a, b) => b.buildings - a.buildings);
    const target = active[indexOffset % active.length];
    this.zoom = 13.5;
    this.camX = target.centerX + 0.5;
    this.camY = target.centerY + 1.5;
    this.clampCamera();
  }

  public clampCamera(): void {
    const minZoom = Math.max(
      1.2,
      Math.min(this.logicalWidth / WORLD_W, this.logicalHeight / WORLD_H) * 0.8,
    );
    this.zoom = Math.max(minZoom, Math.min(28, this.zoom));
    this.camX = Math.max(-16, Math.min(WORLD_W + 16, this.camX));
    this.camY = Math.max(-16, Math.min(WORLD_H + 28, this.camY));
  }

  public screenToWorld(clientX: number, clientY: number): { gx: number; gy: number } {
    const cx = this.logicalWidth * 0.5;
    const cy = this.logicalHeight * 0.5;
    return {
      gx: (clientX - cx) / this.zoom + this.camX,
      gy: (clientY - cy) / this.zoom + this.camY,
    };
  }

  // ==========================================================================
  // PASS 1: CLASSIC CRISP 320x200 WORLDBOX PIXEL TERRAIN, WATER, TREES & FX
  // ==========================================================================
  private setPixelSafe(gx: number, gy: number, color: number): void {
    if (gx >= 0 && gx < WORLD_W && gy >= 0 && gy < WORLD_H) {
      this.buf32[gy * WORLD_W + gx] = color;
    }
  }

  private renderPixelWorldBuffer(time: number): void {
    const W = WORLD_W;
    const H = WORLD_H;
    const out = this.buf32;
    const {
      soil,
      sand,
      stone,
      water,
      wetness,
      grass,
      flora,
      foam,
      glass,
      ash,
      ice,
      snowCover,
      lava,
      acid,
      oil,
      gunpowder,
      plague,
      fire,
      road,
      territory,
    } = this.world;

    const showBorders = this.world.settings.showBorders;
    const kLut = this.settlementKingdomLut;
    if (showBorders) {
      kLut.fill(-1);
      const palsLen = KINGDOM_PALETTES.length;
      for (let sIdx = 0; sIdx < this.entities.settlements.length; sIdx++) {
        const s = this.entities.settlements[sIdx];
        if (s.active && s.id > 0 && s.id < 64) {
          kLut[s.id] = s.kingdom % palsLen;
        }
      }
    }

    const waveT1 = -time * 2.8 * RAD_TO_LUT;
    const waveT2 = (time * 2.0 + Math.PI * 0.5) * RAD_TO_LUT;
    const sheenT = time * 2.2 * RAD_TO_LUT;
    const lavaT = time * 5.5 * RAD_TO_LUT;
    const timeInt5 = (time * 5) | 0;
    const timeInt6 = (time * 6) | 0;
    const timeInt9 = (time * 9) | 0;
    const timeInt18 = (time * 18) | 0;

    // 1. Cast pixel cliff & mountain shadows across diagonals
    this.shadowMask.fill(0);
    for (let d = 0; d < W + H; d++) {
      let x = d < W ? d : 0;
      let y = d < W ? 0 : d - W;
      let maxElev = -999;
      while (x < W && y < H) {
        const i = y * W + x;
        const elev = soil[i] + stone[i] + sand[i] + glass[i];
        if (elev < maxElev - 0.12) {
          this.shadowMask[i] = 1;
        } else {
          maxElev = elev;
        }
        maxElev -= 0.42;
        x++;
        y++;
      }
    }

    // 2. Per-tile pixel art terrain, water waves, foam, hazards & pixel borders
    for (let y = 0; y < H; y++) {
      const row = y * W;
      const ym1 = y > 0 ? (y - 1) * W : row;
      const yp1 = y < H - 1 ? (y + 1) * W : row;
      const wy1 = y * 0.24 * RAD_TO_LUT + waveT1;
      const wy2 = -y * 0.33 * RAD_TO_LUT + waveT2;

      for (let x = 0; x < W; x++) {
        const i = row + x;
        const hSoil = soil[i];
        const hStone = stone[i];
        const hSand = sand[i];
        const hGlass = glass[i];
        const solidH = hSoil + hStone + hSand + hGlass;
        const wDepth = water[i];

        const hHash = HASH_GRID[i];
        const grain = ((hHash & 15) - 7.5) * 1.65;

        const xm1 = x > 0 ? x - 1 : x;
        const xp1 = x < W - 1 ? x + 1 : x;
        const hL = soil[row + xm1] + stone[row + xm1] + sand[row + xm1] + glass[row + xm1];
        const hR = soil[row + xp1] + stone[row + xp1] + sand[row + xp1] + glass[row + xp1];
        const hU = soil[ym1 + x] + stone[ym1 + x] + sand[ym1 + x] + glass[ym1 + x];
        const hD = soil[yp1 + x] + stone[yp1 + x] + sand[yp1 + x] + glass[yp1 + x];
        const slope = (hL - hR) * 0.65 + (hU - hD) * 0.65;
        let shade = 1.0 + Math.max(-0.26, Math.min(0.28, slope * 0.22));
        if (this.shadowMask[i]) shade *= 0.78;

        let r: number;
        let g: number;
        let b: number;

        if (hGlass > 0.06) {
          r = 186 + grain * 1.3;
          g = 242 + grain;
          b = 248 + grain * 0.6;
        } else if (hSand > 0.08) {
          const wet = Math.min(1, wetness[i]);
          r = 242 - wet * 46 + grain * 1.5;
          g = 212 - wet * 44 + grain * 1.3;
          b = 144 - wet * 36 + grain * 1.1;
        } else if (hStone > 0.14) {
          const snow = Math.min(1, Math.max(0, (solidH - 9.2) * 0.45));
          const base = 132 + Math.min(34, solidH * 2.4) + grain * 1.7;
          r = base * (1 - snow) + 244 * snow;
          g = (base + 5) * (1 - snow) + 248 * snow;
          b = (base + 14) * (1 - snow) + 255 * snow;
        } else if (grass[i] > 0.22) {
          const lush = Math.min(1, grass[i]);
          const alt = ((hHash >> 4) & 7) * 2.1;
          r = 122 * (1 - lush) + (74 + alt) * lush;
          g = 88 * (1 - lush) + (168 + alt * 1.1) * lush;
          b = 58 * (1 - lush) + (62 + alt * 0.5) * lush;
        } else {
          r = 126 + grain * 1.4;
          g = 90 + grain * 1.1;
          b = 60 + grain * 0.8;
        }

        if (flora[i] === 6) {
          const furrow = (y & 1) === 0 ? 10 : -8;
          r = 132 + furrow + grain;
          g = 92 + furrow * 0.7 + grain * 0.7;
          b = 52 + furrow * 0.4;
        }

        if (road[i] > 0.25) {
          const rw = Math.min(0.88, road[i]);
          r = r * (1 - rw) + (194 + grain) * rw;
          g = g * (1 - rw) + (158 + grain * 0.8) * rw;
          b = b * (1 - rw) + (110 + grain * 0.6) * rw;
        }

        if (ash[i] > 0.04) {
          const aw = Math.min(0.9, ash[i]);
          r = r * (1 - aw) + (56 + grain) * aw;
          g = g * (1 - aw) + (54 + grain) * aw;
          b = b * (1 - aw) + (58 + grain) * aw;
        }
        if (snowCover[i] > 0.04) {
          const sw = Math.min(1, snowCover[i] * 1.7);
          r = r * (1 - sw) + (242 + grain * 0.6) * sw;
          g = g * (1 - sw) + (248 + grain * 0.5) * sw;
          b = b * (1 - sw) + 255 * sw;
        }
        if (gunpowder[i] > 0.03) {
          const gw = Math.min(0.95, gunpowder[i] * 1.8);
          const speck = (hHash & 3) === 0 ? 22 : 0;
          r = r * (1 - gw) + (46 + speck) * gw;
          g = g * (1 - gw) + (48 + speck) * gw;
          b = b * (1 - gw) + (54 + speck) * gw;
        }

        r *= shade;
        g *= shade;
        b *= shade;

        // Crisp WorldBox Pixel Water, Waves & Pixel Seafoam via fast LUT!
        if (wDepth > 0.025) {
          const wave =
            SIN_LUT[((x * 0.34 * RAD_TO_LUT + wy1) | 0) & SIN_LUT_MASK] * 0.5 +
            SIN_LUT[((x * 0.19 * RAD_TO_LUT + wy2) | 0) & SIN_LUT_MASK] * 0.5;

          let wr: number, wg: number, wb: number, wAlpha: number;
          if (wDepth < 0.45) {
            wr = 58 + wave * 10;
            wg = 196 + wave * 12;
            wb = 228 + wave * 10;
            wAlpha = 0.52;
          } else if (wDepth < 1.55) {
            wr = 32 + wave * 8;
            wg = 148 + wave * 10;
            wb = 208 + wave * 10;
            wAlpha = 0.78;
          } else if (wDepth < 3.0) {
            wr = 20 + wave * 6;
            wg = 104 + wave * 8;
            wb = 176 + wave * 8;
            wAlpha = 0.92;
          } else {
            wr = 13 + wave * 5;
            wg = 68 + wave * 7;
            wb = 136 + wave * 8;
            wAlpha = 0.97;
          }

          r = r * (1 - wAlpha) + wr * wAlpha;
          g = g * (1 - wAlpha) + wg * wAlpha;
          b = b * (1 - wAlpha) + wb * wAlpha;

          const shoreBand = wDepth < 0.24 && wave > -0.15 ? 0.85 : 0;
          const sparkle = wave > 0.86 && ((hHash + timeInt5) & 15) === 0 ? 0.75 : 0;
          const fAmt = Math.min(0.95, Math.max(foam[i] * 0.85, shoreBand, sparkle));
          if (fAmt > 0.12) {
            r += (248 - r) * fAmt;
            g += (252 - g) * fAmt;
            b += (255 - b) * fAmt;
          }
        }

        if (oil[i] > 0.02) {
          const oa = Math.min(0.92, oil[i] * 2.4);
          const sheen = SIN_LUT[(((x * 0.6 + y * 0.5) * RAD_TO_LUT + sheenT) | 0) & SIN_LUT_MASK] > 0.55 ? 26 : 0;
          r += (22 + sheen - r) * oa;
          g += (20 + sheen * 0.6 - g) * oa;
          b += (32 + sheen * 1.4 - b) * oa;
        }

        if (ice[i] > 0.03) {
          const ia = Math.min(0.92, ice[i] * 2.2);
          r += (198 - r) * ia;
          g += (242 - g) * ia;
          b += (255 - b) * ia;
        }
        if (acid[i] > 0.02) {
          const aa = Math.min(0.94, acid[i] * 2.6);
          const bubble = ((hHash + timeInt9) & 7) === 0 ? 42 : 0;
          r += (98 + bubble - r) * aa;
          g += (246 - g) * aa;
          b += (52 - b) * aa;
        }
        if (plague[i] > 0.03 && ((hHash + timeInt6) & 3) !== 0) {
          const pa = Math.min(0.65, plague[i] * 0.85);
          r += (178 - r) * pa;
          g += (52 - g) * pa;
          b += (216 - b) * pa;
        }
        if (lava[i] > 0.02) {
          const pulse = SIN_LUT[(((x + y) * 0.5 * RAD_TO_LUT + lavaT) | 0) & SIN_LUT_MASK] * 22;
          r = 255;
          g = Math.min(242, 96 + lava[i] * 85 + pulse);
          b = Math.max(12, 24 + pulse * 0.5);
        }
        if (fire[i] > 0.04) {
          const flick = ((hHash * 13 + timeInt18) & 3) * 28;
          r = 255;
          g = Math.min(245, 130 + flick);
          b = 28;
        }

        // Crisp WorldBox Pixel Kingdom Borders via O(1) Kingdom LUT!
        if (showBorders) {
          const sid = territory[i];
          if (sid > 0 && sid < 64) {
            const kIdx = kLut[sid];
            if (kIdx >= 0) {
              const [kr, kg, kb] = KINGDOM_PALETTES[kIdx].rgb;
              const isEdge =
                x === 0 ||
                x === W - 1 ||
                y === 0 ||
                y === H - 1 ||
                territory[row + x - 1] !== sid ||
                territory[row + x + 1] !== sid ||
                territory[ym1 + x] !== sid ||
                territory[yp1 + x] !== sid;

              if (isEdge) {
                r = r * 0.16 + kr * 0.84;
                g = g * 0.16 + kg * 0.84;
                b = b * 0.16 + kb * 0.84;
              } else {
                const isInnerRim =
                  (x > 1 && territory[row + x - 2] !== sid) ||
                  (x < W - 2 && territory[row + x + 2] !== sid) ||
                  (y > 1 && territory[(y - 2) * W + x] !== sid) ||
                  (y < H - 2 && territory[(y + 2) * W + x] !== sid);

                const alpha = isInnerRim ? 0.34 : 0.12;
                r = r * (1 - alpha) + kr * alpha;
                g = g * (1 - alpha) + kg * alpha;
                b = b * (1 - alpha) + kb * alpha;
              }
            }
          }
        }

        const cr = r < 0 ? 0 : r > 255 ? 255 : r | 0;
        const cg = g < 0 ? 0 : g > 255 ? 255 : g | 0;
        const cb = b < 0 ? 0 : b > 255 ? 255 : b | 0;
        out[i] = packColor(cr, cg, cb, 255);
      }
    }

    // 3. Crisp Pixel Stumps, Pixel Meadow Flowers & Shaking Pixel Forest Trees!
    const cTrunk = packColor(96, 58, 30);
    const cStumpTop = packColor(224, 184, 126);
    const cShadow = packColor(28, 56, 28);
    const cDarkLeaf = packColor(26, 94, 38);
    const cMidLeaf = packColor(48, 146, 56);
    const cLightLeaf = packColor(96, 198, 72);
    const cPineDark = packColor(20, 78, 48);
    const cPineMid = packColor(36, 122, 70);
    const cPineLight = packColor(68, 166, 98);

    for (let y = 1; y < H - 1; y++) {
      const row = y * W;
      for (let x = 1; x < W - 1; x++) {
        const i = row + x;
        const f = flora[i];
        if (f === 0 || f === 6) continue;

        if (f === 4) {
          const flowerCol =
            (hash2D(x, y) & 3) === 0
              ? packColor(255, 232, 92)
              : (hash2D(x, y) & 1) === 0
                ? packColor(255, 126, 158)
                : packColor(255, 255, 255);
          this.setPixelSafe(x, y, flowerCol);
        } else if (f === 5) {
          this.setPixelSafe(x, y, cTrunk);
          this.setPixelSafe(x + 1, y, cTrunk);
          this.setPixelSafe(x, y - 1, cStumpTop);
        } else {
          const shake = this.world.treeShake[i];
          const sx = shake > 0.02 ? x + Math.round(Math.sin(shake * 34.0) * 1.2) : x;

          this.setPixelSafe(x + 1, y, cShadow);
          this.setPixelSafe(sx, y, cTrunk);

          if (f === 2) {
            this.setPixelSafe(sx - 1, y - 1, cPineDark);
            this.setPixelSafe(sx, y - 1, cPineMid);
            this.setPixelSafe(sx + 1, y - 1, cPineDark);
            this.setPixelSafe(sx, y - 2, cPineMid);
            this.setPixelSafe(sx - 1, y - 2, cPineLight);
            this.setPixelSafe(sx, y - 3, cPineLight);
          } else {
            this.setPixelSafe(sx - 1, y - 1, cDarkLeaf);
            this.setPixelSafe(sx, y - 1, cMidLeaf);
            this.setPixelSafe(sx + 1, y - 1, cDarkLeaf);
            this.setPixelSafe(sx - 1, y - 2, cMidLeaf);
            this.setPixelSafe(sx, y - 2, cLightLeaf);
            this.setPixelSafe(sx + 1, y - 2, cMidLeaf);
            this.setPixelSafe(sx, y - 3, cLightLeaf);
            if (f === 3 && (hash2D(x, y) & 3) === 0) {
              this.setPixelSafe(sx + 1, y - 2, packColor(228, 52, 56));
            }
          }
        }
      }
    }

    // 4. Crisp 3D Pixel Particles
    const pCount = this.physics.count;
    const { pX, pY, pZ, pType, pLife } = this.physics;
    for (let p = 0; p < pCount; p++) {
      const gx = pX[p] | 0;
      const gy = pY[p] | 0;
      if (gx < 0 || gx >= W || gy < 0 || gy >= H) continue;
      const surf = this.world.surfaceHeight(gy * W + gx);
      const screenY = Math.round(gy - Math.max(0, pZ[p] - surf) * 0.45);
      const t = pType[p];

      let col = packColor(246, 214, 130);
      if (t === PARTICLE_WATER || t === PARTICLE_SPLASH) {
        col = t === PARTICLE_SPLASH ? packColor(238, 252, 255) : packColor(74, 198, 255);
      } else if (t === PARTICLE_STONE) col = packColor(154, 164, 178);
      else if (t === PARTICLE_SOIL) col = packColor(138, 94, 60);
      else if (t === PARTICLE_LAVA || t === PARTICLE_FIRE || t === PARTICLE_EMBER) {
        col = pLife[p] > 0.5 ? packColor(255, 232, 92) : packColor(255, 92, 28);
      } else if (t === PARTICLE_SMOKE) col = packColor(78, 76, 82);
      else if (t === PARTICLE_STEAM || t === PARTICLE_SNOW) col = packColor(245, 250, 255);
      else if (t === PARTICLE_SEED || t === PARTICLE_LEAF) col = packColor(88, 214, 82);
      else if (t === PARTICLE_WOOD_CHIP) col = packColor(226, 178, 114);
      else if (t === PARTICLE_ACID) col = packColor(124, 255, 62);
      else if (t === PARTICLE_TNT) col = packColor(236, 56, 52);
      else if (t === PARTICLE_DUST) col = packColor(214, 196, 164);

      this.setPixelSafe(gx, screenY, col);
    }

    // 5. Crisp Pixel Flaming Meteors in Flight
    for (let m = 0; m < this.entities.meteorCount; m++) {
      const gx = this.entities.mx[m] | 0;
      const gy = this.entities.my[m] | 0;
      if (gx >= 0 && gx < W && gy >= 0 && gy < H) {
        const surf = this.world.surfaceHeight(gy * W + gx);
        const myScreen = Math.round(gy - Math.max(0, this.entities.mz[m] - surf) * 0.45);
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            if (dx * dx + dy * dy <= 5) {
              const core = dx * dx + dy * dy <= 1;
              this.setPixelSafe(
                gx + dx,
                myScreen + dy,
                core ? packColor(255, 246, 164) : packColor(238, 92, 28),
              );
            }
          }
        }
      }
    }

    this.offscreenCtx.putImageData(this.imageData, 0, 0);
  }

  // ==========================================================================
  // PASS 2: HYBRID COMPOSITE — CRISP PIXEL WORLD + DETAILED MODELS ON TOP!
  // ==========================================================================
  public render(
    time: number,
    cursorGx: number,
    cursorGy: number,
    cursorVisible: boolean,
    activeTool: ToolId,
    brushRadius: number,
  ): void {
    const ctx = this.mainCtx || this.canvas.getContext('2d');
    if (!ctx) return;

    const viewW = this.logicalWidth;
    const viewH = this.logicalHeight;
    const zoom = this.zoom;

    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    // 1. Deep WorldBox Pixel Ocean Backdrop
    ctx.fillStyle = '#0d448a';
    ctx.fillRect(0, 0, viewW, viewH);

    const shakeMag = this.entities.screenShake;
    const shakeX = shakeMag > 0.05 ? Math.sin(time * 67.3) * shakeMag * 1.4 : 0;
    const shakeY = shakeMag > 0.05 ? Math.cos(time * 53.9) * shakeMag * 1.4 : 0;

    const ox = Math.round(viewW * 0.5 - this.camX * zoom + shakeX);
    const oy = Math.round(viewH * 0.5 - this.camY * zoom + shakeY);

    // 2. Draw 320x200 Pixel World + ALL Pixel-Art Buildings, Units & Creatures WITH RAZOR-SHARP PIXELS!
    this.renderPixelWorldBuffer(time);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.offscreenCanvas, ox, oy, WORLD_W * zoom, WORLD_H * zoom);

    const minTileX = Math.max(0, Math.floor((0 - ox) / zoom) - 4);
    const maxTileX = Math.min(WORLD_W - 1, Math.ceil((viewW - ox) / zoom) + 4);
    const minTileY = Math.max(0, Math.floor((0 - oy) / zoom) - 4);
    const maxTileY = Math.min(WORLD_H - 1, Math.ceil((viewH - oy) / zoom) + 8);

    let count = 0;
    const maxItems = this.sortY.length;
    const { flora, buildings, tnt, goldOre } = this.world;

    for (let y = minTileY; y <= maxTileY; y++) {
      const row = y * WORLD_W;
      for (let x = minTileX; x <= maxTileX; x++) {
        const idx = row + x;

        if (goldOre[idx] > 0.25 && count < maxItems) {
          this.sortY[count] = y + 0.42;
          this.sortKind[count] = ITEM_GOLD;
          this.sortIndex[count] = idx;
          this.sortOrder[count] = count;
          count++;
        }

        if (flora[idx] === 6 && count < maxItems) {
          this.sortY[count] = y + 0.5;
          this.sortKind[count] = ITEM_WHEAT;
          this.sortIndex[count] = idx;
          this.sortOrder[count] = count;
          count++;
        }

        if (buildings[idx] !== 0 && count < maxItems) {
          this.sortY[count] = y + 0.65;
          this.sortKind[count] = ITEM_BUILDING;
          this.sortIndex[count] = idx;
          this.sortOrder[count] = count;
          count++;
        }

        if (tnt[idx] > 0.04 && count < maxItems) {
          this.sortY[count] = y + 0.55;
          this.sortKind[count] = ITEM_TNT;
          this.sortIndex[count] = idx;
          this.sortOrder[count] = count;
          count++;
        }
      }
    }

    for (let h = 0; h < this.entities.humanCount && count < maxItems; h++) {
      const vx = this.entities.hx[h];
      const vy = this.entities.hy[h];
      if (vx >= minTileX && vx <= maxTileX && vy >= minTileY && vy <= maxTileY) {
        this.sortY[count] = vy;
        this.sortKind[count] = ITEM_VILLAGER;
        this.sortIndex[count] = h;
        this.sortOrder[count] = count;
        count++;
      }
    }

    const order = this.sortOrder.subarray(0, count);
    const syArr = this.sortY;
    order.sort((a, b) => syArr[a] - syArr[b]);

    const modelScale = Math.max(zoom, 2.2);

    for (let n = 0; n < count; n++) {
      const slot = order[n];
      const kind = this.sortKind[slot];
      const id = this.sortIndex[slot];

      if (kind === ITEM_GOLD) {
        const gx = id % WORLD_W;
        const gy = (id / WORLD_W) | 0;
        const spr = this.models.goldSprite;
        const w = modelScale * 1.85;
        const h = w * (spr.height / spr.width);
        const sx = ox + (gx + 0.5) * zoom;
        const sy = oy + (gy + 0.68) * zoom;
        ctx.drawImage(spr, sx - w * 0.5, sy - h * 0.78, w, h);
      } else if (kind === ITEM_WHEAT) {
        const gx = id % WORLD_W;
        const gy = (id / WORLD_W) | 0;
        const sway = Math.sin(time * 3.1 + gx * 0.55 + gy * 0.4) * zoom * 0.14;
        const drawW = modelScale * 1.55;
        const drawH = drawW * (this.models.wheatSprite.height / this.models.wheatSprite.width);
        const sx = ox + (gx + 0.5) * zoom + sway;
        const sy = oy + (gy + 0.72) * zoom;
        ctx.drawImage(this.models.wheatSprite, sx - drawW * 0.5, sy - drawH * 0.84, drawW, drawH);
      } else if (kind === ITEM_BUILDING) {
        const gx = id % WORLD_W;
        const gy = (id / WORLD_W) | 0;
        const bType = buildings[id];
        const kIdx = this.world.buildingKingdom[id] % KINGDOM_PALETTES.length;
        const pal = KINGDOM_PALETTES[kIdx];
        const sx = ox + (gx + 0.5) * zoom;
        const sy = oy + (gy + 0.82) * zoom;

        // Попиксельное разрушение: спрайт буквально рассыпается на пиксели по мере урона!
        const maxBhp = BUILDING_MAX_HP[bType] ?? 150;
        const bhpRatio = maxBhp > 0 ? Math.max(0, Math.min(1, this.world.buildingHp[id] / maxBhp)) : 1;
        const dmgStage = bType === 6 ? 0 : bhpRatio > 0.68 ? 0 : bhpRatio > 0.34 ? 1 : 2;

        if (bType === 1) {
          drawCampfireHD(ctx, sx, sy, Math.max(3.5, modelScale * 0.95), time, id);
        } else if (bType === 2) {
          const spr = this.models.getDamagedBuilding(2, kIdx, dmgStage);
          const w = modelScale * 4.35;
          const h = w * (spr.height / spr.width);
          ctx.drawImage(spr, sx - w * 0.5, sy - h * 0.85, w, h);

          const chimX = Math.round(sx + w * 0.22);
          const chimY = Math.round(sy - h * 0.78);
          for (let p = 0; p < 2; p++) {
            const cycle = (time * 0.55 + p * 0.5 + (id % 7) * 0.13) % 1;
            const puffSz = Math.max(2, Math.round(w * (0.07 + cycle * 0.08)));
            ctx.fillStyle = `rgba(248, 250, 255, ${(0.55 * (1 - cycle)).toFixed(2)})`;
            ctx.fillRect(
              Math.round(chimX + cycle * w * 0.12),
              Math.round(chimY - cycle * h * 0.28),
              puffSz,
              puffSz,
            );
          }
        } else if (bType === 4) {
          const spr = this.models.getDamagedBuilding(4, kIdx, dmgStage);
          const w = Math.round(modelScale * 5.0);
          const h = Math.round(w * (spr.height / spr.width));
          ctx.drawImage(spr, Math.round(sx - w * 0.5), Math.round(sy - h * 0.85), w, h);

          const hubX = sx + w * (10 / 44);
          const hubY = sy - h * (20 / 38);
          drawWindmillSails(ctx, hubX, hubY, w * 0.24, time * 1.35 + (id % 11));
        } else if (bType === 5) {
          const spr = this.models.getDamagedBuilding(5, kIdx, dmgStage);
          const w = modelScale * 3.85;
          const h = w * (spr.height / spr.width);
          ctx.drawImage(spr, sx - w * 0.5, sy - h * 0.87, w, h);

          drawWavingFlag(ctx, sx, sy - h * 0.89, w * 0.34, h * 0.11, pal, time, id * 0.7);
        } else if (bType === 3) {
          const spr = this.models.getDamagedBuilding(3, kIdx, dmgStage);
          const w = modelScale * 6.35;
          const h = w * (spr.height / spr.width);
          ctx.drawImage(spr, sx - w * 0.5, sy - h * 0.855, w, h);

          drawWavingFlag(ctx, sx, sy - h * 0.875, w * 0.22, h * 0.11, pal, time, id * 0.5);
          drawWavingFlag(
            ctx,
            sx - w * (56 / 216),
            sy - h * 0.71,
            w * 0.15,
            h * 0.08,
            pal,
            time,
            id * 0.5 + 1.2,
          );
          drawWavingFlag(
            ctx,
            sx + w * (56 / 216),
            sy - h * 0.71,
            w * 0.15,
            h * 0.08,
            pal,
            time,
            id * 0.5 + 2.4,
          );
        } else if (bType === 6) {
          // SMOLDERING PIXEL DEVASTATION RUINS (РАЗРУХА) LEFT BY ZOMBIES OR FIRE!
          const spr = this.models.ruinSprite;
          const w = Math.round(modelScale * 4.2);
          const h = Math.round(w * (spr.height / spr.width));
          ctx.drawImage(spr, Math.round(sx - w * 0.5), Math.round(sy - h * 0.82), w, h);

          const cycle = (time * 0.36 + (id % 9) * 0.11) % 1;
          const sz = Math.max(2, Math.round(w * (0.08 + cycle * 0.08)));
          ctx.fillStyle = `rgba(92, 86, 84, ${(0.42 * (1 - cycle)).toFixed(2)})`;
          ctx.fillRect(
            Math.round(sx + Math.sin(time * 1.4 + id) * w * 0.08),
            Math.round(sy - h * (0.5 + cycle * 0.38)),
            sz,
            sz,
          );
        } else if (bType === 7) {
          // ЖЕЛЕЗОБЕТОННЫЙ БУНКЕР
          const spr = this.models.getDamagedBuilding(7, kIdx, dmgStage);
          const w = modelScale * 6.55;
          const h = w * (spr.height / spr.width);
          ctx.drawImage(spr, sx - w * 0.5, sy - h * 0.855, w, h);

          drawWavingFlag(ctx, sx, sy - h * 0.9, w * 0.24, h * 0.12, pal, time, id * 0.45);
        } else if (bType === 9) {
          // РЛС — РАДИОЛОКАЦИОННАЯ СТАНЦИЯ
          const spr = this.models.getDamagedBuilding(9, kIdx, dmgStage);
          const w = modelScale * 3.6;
          const h = w * (spr.height / spr.width);
          ctx.drawImage(spr, sx - w * 0.5, sy - h * 0.86, w, h);
          // Вращающаяся «мигалка» радара
          const blip = Math.sin(time * 3.4 + id) > 0 ? '#00e676' : '#004d40';
          ctx.fillStyle = blip;
          const bp = Math.max(1, Math.round(w * 0.07));
          ctx.fillRect(Math.round(sx - bp * 0.5), Math.round(sy - h * 0.98), bp, bp);
        } else if (bType === 10) {
          // ШАХТА БАЛЛИСТИЧЕСКОЙ РАКЕТЫ
          const spr = this.models.getDamagedBuilding(10, kIdx, dmgStage);
          const w = modelScale * 2.6;
          const h = w * (spr.height / spr.width);
          ctx.drawImage(spr, sx - w * 0.5, sy - h * 0.88, w, h);
        } else if (bType === 8) {
          // ПРОТИВОТАНКОВЫЕ ЕЖИ / ЗАГРАЖДЕНИЯ
          const spr = this.models.wallSprite;
          const w = modelScale * 2.15;
          const h = w * (spr.height / spr.width);
          ctx.drawImage(spr, sx - w * 0.5, sy - h * 0.82, w, h);
        }
      } else if (kind === ITEM_TNT) {
        const gx = id % WORLD_W;
        const gy = (id / WORLD_W) | 0;
        const spr = this.models.tntSprite;
        const w = modelScale * 1.9;
        const h = w * (spr.height / spr.width);
        const sx = ox + (gx + 0.5) * zoom;
        const sy = oy + (gy + 0.7) * zoom;
        ctx.drawImage(spr, sx - w * 0.5, sy - h * 0.8, w, h);

        if (this.world.fuse[id] > 0) {
          const sparkR = w * (0.22 + Math.sin(time * 40 + id) * 0.08);
          ctx.fillStyle = '#fff37a';
          ctx.beginPath();
          ctx.arc(sx, sy - h * 0.72, sparkR, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (kind === ITEM_VILLAGER) {
        const vx = this.entities.hx[id];
        const vy = this.entities.hy[id];
        const vz = this.entities.hz[id];
        const gIdx =
          Math.max(0, Math.min(WORLD_H - 1, vy | 0)) * WORLD_W +
          Math.max(0, Math.min(WORLD_W - 1, vx | 0));
        const surf = this.world.surfaceHeight(gIdx);
        const inWater = this.world.water[gIdx] > 0.14;
        const airLift = Math.max(0, vz - surf) * zoom * 0.45;

        const groundSx = ox + vx * zoom;
        const groundSy = oy + vy * zoom;
        const vScale = Math.max(4.2, modelScale * 0.98);
        const maxHp = this.entities.hMaxHp[id];
        const hpR = maxHp > 0 ? this.entities.hHp[id] / maxHp : 1;
        const selectedUnit =
          this.entities.hUid[id] === this.entities.selectedUnitUid && this.entities.selectedUnitUid > 0;
        const roleNow = this.entities.hRole[id];

        // ТАНКИ и БТР — отдельные пиксельные спрайты техники!
        if (roleNow === ROLE_TANK || roleNow === ROLE_APC) {
          const stepFrame = Math.sin(this.entities.hWalkPhase[id]) >= 0 ? 0 : 1;
          const flip = this.entities.hFacing[id] < 0;
          const spr =
            roleNow === ROLE_TANK
              ? (flip ? this.models.tankSpritesFlip : this.models.tankSprites)[stepFrame]
              : (flip ? this.models.apcSpritesFlip : this.models.apcSprites)[stepFrame];
          const dw = Math.max(14, Math.round(vScale * (roleNow === ROLE_TANK ? 3.4 : 3.0)));
          const dh = Math.max(8, Math.round(dw * (spr.height / spr.width)));
          const sy2 = groundSy - airLift;
          const kIdx = this.entities.hKingdom[id] % KINGDOM_PALETTES.length;
          const pal = KINGDOM_PALETTES[kIdx];

          ctx.fillStyle = 'rgba(8, 12, 18, 0.38)';
          ctx.fillRect(Math.round(groundSx - dw * 0.5), Math.round(groundSy - dh * 0.12), dw, Math.max(2, dh * 0.18));
          ctx.drawImage(spr, Math.round(groundSx - dw * 0.5), Math.round(sy2 - dh * 0.82), dw, dh);

          // Опознавательный флажок / тактический знак
          ctx.fillStyle = pal.main;
          ctx.fillRect(Math.round(groundSx + dw * 0.18), Math.round(sy2 - dh * 1.05), Math.max(2, dw * 0.14), Math.max(2, dh * 0.16));

          if (selectedUnit) {
            ctx.strokeStyle = '#ffe066';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(Math.round(groundSx - dw * 0.55), Math.round(sy2 - dh * 0.88), dw * 1.1, dh * 0.95);
          }
          if (hpR < 0.99) {
            const bw = Math.max(12, Math.round(vScale * 1.6));
            const bx = Math.round(groundSx - bw * 0.5);
            const by = Math.round(sy2 - dh - 5);
            ctx.fillStyle = '#14181f';
            ctx.fillRect(bx - 1, by - 1, bw + 2, 5);
            ctx.fillStyle = hpR > 0.5 ? '#51cf66' : hpR > 0.25 ? '#ffd43b' : '#ff5252';
            ctx.fillRect(bx, by, Math.max(1, Math.round(bw * hpR)), 3);
          }
          continue;
        }

        drawVillagerHD(
          ctx,
          groundSx,
          groundSy - airLift,
          groundSy,
          vScale,
          this.entities.hKingdom[id],
          this.entities.hState[id],
          this.entities.hWood[id],
          this.entities.hChopProgress[id],
          this.entities.hFacing[id],
          this.entities.hWalkPhase[id],
          this.entities.hVariant[id],
          this.entities.hRole[id],
          inWater,
          maxHp > 0 ? this.entities.hHp[id] / maxHp : 1,
          this.entities.hBlessed[id] !== 0,
          this.entities.hInfected[id] > 0,
          this.entities.getUnitSizeMult(id),
          this.entities.isUnitDrowning(id),
          selectedUnit,
        );
      }
    }

    // 3B. Flying War & Watchtower Arrows
    if (this.entities.arrowCount > 0) {
      for (let a = 0; a < this.entities.arrowCount; a++) {
        const ax = this.entities.ax[a];
        const ay = this.entities.ay[a];
        const az = this.entities.az[a];
        const gIdx =
          Math.max(0, Math.min(WORLD_H - 1, ay | 0)) * WORLD_W +
          Math.max(0, Math.min(WORLD_W - 1, ax | 0));
        const surf = this.world.surfaceHeight(gIdx);
        const lift = Math.max(0, az - surf) * zoom * 0.55;
        const sx = ox + ax * zoom;
        const sy = oy + ay * zoom - lift;
        const ang = Math.atan2(
          this.entities.avy[a] - this.entities.avz[a] * 0.4,
          this.entities.avx[a],
        );
        const len = Math.max(6, modelScale * 1.5);

        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(ang);
        ctx.strokeStyle = '#d9a45b';
        ctx.lineWidth = Math.max(1.4, modelScale * 0.22);
        ctx.beginPath();
        ctx.moveTo(-len * 0.5, 0);
        ctx.lineTo(len * 0.5, 0);
        ctx.stroke();

        ctx.fillStyle = '#e8f1fa';
        ctx.beginPath();
        ctx.moveTo(len * 0.62, 0);
        ctx.lineTo(len * 0.28, -len * 0.16);
        ctx.lineTo(len * 0.28, len * 0.16);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    // 3C. Ударные вертолёты Ка-52 (бывшие драконы)!
    for (let d = 0; d < this.entities.dragonCount; d++) {
      const groundSx = ox + this.entities.dx[d] * zoom;
      const groundSy = oy + this.entities.dy[d] * zoom;
      const hpR = this.entities.dHp[d] / Math.max(1, this.entities.dMaxHp[d]);
      const alt = Math.max(14, modelScale * 3.4);
      const flySy = groundSy - alt;
      const facing = this.entities.dvx[d] >= 0 ? 1 : -1;

      // Тень на земле
      ctx.fillStyle = 'rgba(8, 12, 18, 0.26)';
      const shW = Math.round(modelScale * 2.2);
      ctx.fillRect(Math.round(groundSx - shW * 0.5), Math.round(groundSy - shW * 0.14), shW, Math.max(2, Math.round(shW * 0.28)));

      const frame = Math.floor(time * 12) % 3;
      const spr = this.models.helicopterSprites[frame] || this.models.dragonSprites[0];
      const drawW = Math.max(18, Math.round(modelScale * 3.6));
      const drawH = Math.round(drawW * (spr.height / spr.width));

      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.translate(Math.round(groundSx), Math.round(flySy));
      ctx.scale(facing >= 0 ? 1 : -1, 1);
      ctx.drawImage(spr, Math.round(-drawW * 0.5), Math.round(-drawH * 0.5), drawW, drawH);
      ctx.restore();

      // НУРСы по наземным целям
      if (Math.random() < 0.3) {
        ctx.fillStyle = '#ff922b';
        const rp = Math.max(1, Math.round(modelScale * 0.12));
        for (let s = 0; s < 3; s++) {
          ctx.fillRect(
            Math.round(groundSx + facing * (drawW * 0.5 + s * rp * 3)),
            Math.round(flySy + drawH * 0.3 + s * rp),
            rp * 2,
            rp,
          );
        }
      }

      if (hpR < 0.99) {
        const bw = Math.round(modelScale * 2.2);
        const bx = Math.round(groundSx - bw * 0.5);
        const by = Math.round(flySy - drawH * 0.7);
        ctx.fillStyle = '#12151c';
        ctx.fillRect(bx - 1, by - 1, bw + 2, 6);
        ctx.fillStyle = '#ff5252';
        ctx.fillRect(bx, by, Math.max(2, Math.round(bw * hpR)), 4);
      }
    }

    // 3C-2. FPV-камикадзе и барражирующие «Ланцеты»!
    for (let dr = 0; dr < this.entities.droneCount; dr++) {
      const gx = this.entities.drx[dr];
      const gy = this.entities.dry[dr];
      const z = this.entities.drz[dr];
      const gIdx =
        Math.max(0, Math.min(WORLD_H - 1, gy | 0)) * WORLD_W +
        Math.max(0, Math.min(WORLD_W - 1, gx | 0));
      const surf = this.world.surfaceHeight(gIdx);
      const lift = Math.max(0, z - surf) * zoom * 0.55;
      const sx = ox + gx * zoom;
      const sy = oy + gy * zoom - lift;
      const phase = (Math.floor(time * 30) + dr) & 1;
      const spr = this.models.fpvDroneSprites[phase];
      const dw = Math.max(10, Math.round(modelScale * 1.5));
      const dh = Math.max(6, Math.round(dw * (spr.height / spr.width)));

      ctx.drawImage(spr, Math.round(sx - dw * 0.5), Math.round(sy - dh * 0.5), dw, dh);

      // Пунктирная линия наведения до цели (как на реальном FPV)
      const tx = ox + this.entities.drTargetX[dr] * zoom;
      const ty = oy + this.entities.drTargetY[dr] * zoom;
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 61, 0, 0.35)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.restore();

      // Прицельная рамка на цели
      ctx.strokeStyle = 'rgba(255, 61, 0, 0.55)';
      ctx.lineWidth = 1.5;
      const cs = Math.max(5, zoom * 1.2);
      ctx.strokeRect(Math.round(tx - cs * 0.5), Math.round(ty - cs * 0.5), cs, cs);
    }

    // 3C-3. Баллистические и крылатые ракеты в полёте!
    for (let m = 0; m < this.entities.missileCount; m++) {
      const mx = this.entities.msx[m];
      const my = this.entities.msy[m];
      const mz = this.entities.msz[m];
      const gIdx =
        Math.max(0, Math.min(WORLD_H - 1, my | 0)) * WORLD_W +
        Math.max(0, Math.min(WORLD_W - 1, mx | 0));
      const surf = this.world.surfaceHeight(gIdx);
      const lift = Math.max(0, mz - surf) * zoom * 0.5;
      const sx = ox + mx * zoom;
      const sy = oy + my * zoom - lift;
      const kind = this.entities.msKind[m];

      // Шлейф дыма
      ctx.fillStyle = 'rgba(160, 160, 164, 0.5)';
      const tp = Math.max(1, Math.round(modelScale * 0.16));
      for (let s = 1; s <= 5; s++) {
        ctx.fillRect(
          Math.round(sx - this.entities.msvx[m] * zoom * 0.02 * s) - tp,
          Math.round(sy + this.entities.msvz[m] * zoom * 0.02 * s),
          tp * 2,
          tp,
        );
      }

      if (kind === 1) {
        // Крылатая ракета «Калибр» — летит низко, рисуется развёрнутым спрайтом
        const spr = this.models.cruiseSprite;
        const dw = Math.max(14, Math.round(modelScale * 2.1));
        const dh = Math.max(5, Math.round(dw * (spr.height / spr.width)));
        const dir = this.entities.msvx[m] >= 0 ? 1 : -1;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.translate(Math.round(sx), Math.round(sy));
        ctx.scale(dir, 1);
        ctx.drawImage(spr, Math.round(-dw * 0.5), Math.round(-dh * 0.5), dw, dh);
        ctx.restore();
      } else {
        // Баллистика / ФАБ / артиллерия — вертикальный корпус с огненным соплом
        const bw = Math.max(3, Math.round(modelScale * 0.34));
        const bh = Math.max(7, Math.round(modelScale * 1.05));
        ctx.fillStyle = '#e0e0e0';
        ctx.fillRect(Math.round(sx - bw * 0.5), Math.round(sy - bh * 0.5), bw, bh);
        ctx.fillStyle = '#ff3d00';
        ctx.fillRect(Math.round(sx - bw * 0.5), Math.round(sy - bh * 0.5), bw, Math.max(1, Math.round(bh * 0.28)));
        ctx.fillStyle = '#fff3bf';
        const fp = Math.max(2, Math.round(bw * 1.8));
        ctx.fillRect(Math.round(sx - fp * 0.5), Math.round(sy + bh * 0.45), fp, Math.max(2, Math.round(bh * 0.35)));
      }
    }

    // 3D. Sky Lightning Bolts!
    for (const bolt of this.entities.lightningBolts) {
      const sx = ox + bolt.x * zoom;
      const sy = oy + bolt.y * zoom;
      const alpha = Math.min(1, bolt.life / 0.28);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#9be8ff';
      ctx.lineWidth = 7;
      ctx.beginPath();
      let cx = sx + ((bolt.seed % 19) - 9) * 3;
      let cy = Math.max(0, sy - 420);
      ctx.moveTo(cx, cy);
      const segs = 9;
      for (let s = 1; s <= segs; s++) {
        const t = s / segs;
        const jit = s < segs ? Math.sin(bolt.seed * 3.1 + s * 7.7) * 18 : 0;
        ctx.lineTo(sx + jit, cy + (sy - cy) * t);
      }
      ctx.stroke();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.6;
      ctx.stroke();

      ctx.fillStyle = 'rgba(190, 245, 255, 0.55)';
      ctx.beginPath();
      ctx.arc(sx, sy, 22 * alpha, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 3E. Atomic Tsar Bomba Mushroom Clouds!
    for (const cloud of this.entities.nukeClouds) {
      const sx = ox + cloud.x * zoom;
      const sy = oy + cloud.y * zoom;
      const p = cloud.age / cloud.maxAge;
      const alpha = p < 0.7 ? 0.94 : 0.94 * (1 - (p - 0.7) / 0.3);
      const R = Math.max(28, zoom * (12 + p * 22));
      const stemH = R * (0.65 + p * 1.05);

      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);

      // Expanding ground shockwave ring
      ctx.strokeStyle = `rgba(255, 236, 175, ${(1 - p) * 0.85})`;
      ctx.lineWidth = Math.max(3, R * 0.12);
      ctx.beginPath();
      ctx.ellipse(sx, sy, R * (0.8 + p * 1.5), R * (0.45 + p * 0.85), 0, 0, Math.PI * 2);
      ctx.stroke();

      // Glowing mushroom stem
      const stemGrad = ctx.createLinearGradient(sx, sy, sx, sy - stemH);
      stemGrad.addColorStop(0, '#5a4338');
      stemGrad.addColorStop(0.55, '#e86a24');
      stemGrad.addColorStop(1, '#ffcf5c');
      ctx.fillStyle = stemGrad;
      ctx.fillRect(sx - R * 0.22, sy - stemH, R * 0.44, stemH);

      // Billowing mushroom cap
      const capGrad = ctx.createRadialGradient(
        sx,
        sy - stemH - R * 0.1,
        R * 0.12,
        sx,
        sy - stemH,
        R * 0.85,
      );
      capGrad.addColorStop(0, '#fff7b2');
      capGrad.addColorStop(0.45, '#ff7b29');
      capGrad.addColorStop(0.85, '#593d35');
      capGrad.addColorStop(1, 'rgba(40,30,28,0)');
      ctx.fillStyle = capGrad;
      ctx.beginPath();
      ctx.ellipse(sx, sy - stemH, R * 0.88, R * 0.56, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 4. Pixel-Art Drifting WorldBox Clouds + Live Pixel Weather (Rain / Storm / Snow)!
    if (this.world.settings.cloudsEnabled) {
      this.drawPixelClouds(ctx, ox, oy, zoom, time);
    }
    this.drawPixelWeatherOverlay(ctx, viewW, viewH, time);

    // 5. Crisp WorldBox Pixel Plaques for Settlements (with live ⚔️ War indicator!)
    if (this.world.settings.showBorders) {
      this.drawPixelSettlementPlaques(ctx, ox, oy, zoom);
    }

    // 6. Crisp WorldBox Pixel Brush Reticle
    if (cursorVisible) {
      this.drawBrushReticle(ctx, ox, oy, zoom, cursorGx, cursorGy, brushRadius, activeTool);
    }

    ctx.restore();
  }

  private drawPixelWeatherOverlay(
    ctx: CanvasRenderingContext2D,
    viewW: number,
    viewH: number,
    time: number,
  ): void {
    const w = this.world.weather;
    if (w === 'clear') return;

    if (w === 'rain' || w === 'storm') {
      const isStorm = w === 'storm';
      ctx.fillStyle = isStorm ? 'rgba(14, 28, 52, 0.24)' : 'rgba(18, 40, 74, 0.13)';
      ctx.fillRect(0, 0, viewW, viewH);

      const drops = this.lowPowerFx ? (isStorm ? 95 : 56) : isStorm ? 210 : 120;
      const spd = isStorm ? 920 : 680;
      for (let i = 0; i < drops; i++) {
        const seedX = (i * 7919) % 10000;
        const seedY = (i * 6151) % 10000;
        const px = Math.round(((seedX / 10000) * (viewW + 220) - time * 190 + 100000) % (viewW + 220)) - 110;
        const py = Math.round(((seedY / 10000) * (viewH + 120) + time * spd) % (viewH + 120)) - 60;
        // Diagonal crisp pixel rain streak
        ctx.fillStyle = isStorm ? 'rgba(185, 232, 255, 0.85)' : 'rgba(162, 218, 255, 0.72)';
        for (let s = 0; s < 4; s++) {
          ctx.fillRect(px - s * 2, py + s * 3, 2, 3);
        }
        // Occasional crisp pixel splash on ground
        if (i % 5 === 0) {
          const spX = Math.round(((seedY * 3) % Math.max(1, viewW)));
          const spY = Math.round(((seedX * 7) % Math.max(1, viewH)));
          const blink = Math.floor(time * 12 + i) % 4;
          if (blink === 0) {
            ctx.fillStyle = 'rgba(224, 247, 255, 0.78)';
            ctx.fillRect(spX - 3, spY, 2, 2);
            ctx.fillRect(spX + 3, spY, 2, 2);
          }
        }
      }
    } else if (w === 'snow') {
      ctx.fillStyle = 'rgba(218, 238, 255, 0.09)';
      ctx.fillRect(0, 0, viewW, viewH);

      const flakes = this.lowPowerFx ? 64 : 135;
      for (let i = 0; i < flakes; i++) {
        const seedX = (i * 7331) % 10000;
        const seedY = (i * 4993) % 10000;
        const sway = Math.sin(time * 1.9 + i * 0.7) * 26;
        const px = Math.round((((seedX / 10000) * viewW + sway) + viewW) % Math.max(1, viewW));
        const py = Math.round(((seedY / 10000) * viewH + time * (75 + (i % 3) * 24)) % Math.max(1, viewH));
        const sz = i % 3 === 0 ? 4 : 3;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillRect(px, py, sz, sz);
      }
    }
  }

  private drawPixelClouds(
    ctx: CanvasRenderingContext2D,
    ox: number,
    oy: number,
    zoom: number,
    time: number,
  ): void {
    const clouds = [
      { bx: 44, by: 34, w: 18, h: 7 },
      { bx: 158, by: 26, w: 22, h: 8 },
      { bx: 262, by: 66, w: 19, h: 7 },
      { bx: 94, by: 148, w: 21, h: 8 },
      { bx: 226, by: 164, w: 17, h: 6 },
    ];

    for (const c of clouds) {
      const gx = Math.floor(((c.bx + time * 1.8) % (WORLD_W + 60)) - 30);
      const gy = c.by;
      const sx = ox + gx * zoom;
      const sy = oy + gy * zoom;
      const w = c.w * zoom;
      const h = c.h * zoom;

      ctx.fillStyle = 'rgba(8, 18, 30, 0.13)';
      ctx.fillRect(sx + zoom * 3, sy + zoom * 6, w, h * 0.7);
      ctx.fillRect(sx + zoom * 6, sy + zoom * 4.5, w * 0.55, h * 0.35);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.32)';
      ctx.fillRect(sx, sy + h * 0.35, w, h * 0.65);
      ctx.fillRect(sx + w * 0.18, sy, w * 0.62, h * 0.45);
    }
  }

  private drawPixelSettlementPlaques(
    ctx: CanvasRenderingContext2D,
    ox: number,
    oy: number,
    zoom: number,
  ): void {
    ctx.save();
    ctx.font = '700 13px "Pixelify Sans", monospace';
    ctx.textBaseline = 'middle';

    for (const s of this.entities.settlements) {
      if (!s.active) continue;
      const pal = KINGDOM_PALETTES[s.kingdom % KINGDOM_PALETTES.length];
      const cx = Math.round(ox + (s.centerX + 0.5) * zoom);
      const cy = Math.round(oy + (s.centerY - 3.6) * zoom - 12);

      let atWar = false;
      for (let k = 0; k < 6; k++) {
        if (k !== s.kingdom && this.entities.isKingdomsAtWar(s.kingdom, k)) {
          atWar = true;
          break;
        }
      }

      const label = `${s.name}  [${s.population}]`;
      const warExtra = atWar ? 14 : 0;
      const textW = Math.ceil(ctx.measureText(label).width);
      const boxW = textW + 24 + warExtra;
      const boxH = 20;
      const bx = Math.round(cx - boxW * 0.5);
      const by = Math.round(cy - boxH * 0.5);

      ctx.fillStyle = atWar ? '#ff3b30' : '#1b130f';
      ctx.fillRect(bx - 2, by - 2, boxW + 4, boxH + 4);
      ctx.fillStyle = pal.main;
      ctx.fillRect(bx - 1, by - 1, boxW + 2, boxH + 2);
      ctx.fillStyle = '#291d16';
      ctx.fillRect(bx, by, boxW, boxH);

      ctx.fillStyle = pal.light;
      ctx.fillRect(bx + 6, cy - 4, 8, 8);

      if (atWar) {
        // Crisp crossed silver blades icon when kingdom is at war!
        const sx = bx + 22;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sx - 4, cy + 4);
        ctx.lineTo(sx + 4, cy - 4);
        ctx.moveTo(sx - 4, cy - 4);
        ctx.lineTo(sx + 4, cy + 4);
        ctx.stroke();
      }

      ctx.fillStyle = atWar ? '#ffd6d2' : '#fff5e0';
      ctx.fillText(label, bx + 18 + warExtra, cy + 0.5);
    }

    ctx.restore();
  }

  private drawBrushReticle(
    ctx: CanvasRenderingContext2D,
    ox: number,
    oy: number,
    zoom: number,
    cursorGx: number,
    cursorGy: number,
    brushRadius: number,
    activeTool: ToolId,
  ): void {
    const sx = ox + cursorGx * zoom;
    const sy = oy + cursorGy * zoom;
    const rPx = Math.max(4, brushRadius * zoom);

    let toolCategory = 'artillery';
    if (activeTool === 'trench' || activeTool === 'berm' || activeTool === 'fortify' || activeTool === 'smoke') {
      toolCategory = 'engineer';
    } else if (
      activeTool === 'bunker' || activeTool === 'barracks' || activeTool === 'depot' ||
      activeTool === 'hq' || activeTool === 'pvo' || activeTool === 'radar' ||
      activeTool === 'wall' || activeTool === 'mine'
    ) {
      toolCategory = 'defense';
    } else if (
      activeTool === 'infantry' || activeTool === 'specops' || activeTool === 'sniper' ||
      activeTool === 'tank' || activeTool === 'apc' || activeTool === 'supply'
    ) {
      toolCategory = 'infantry';
    } else if (
      activeTool === 'fpv_drone' || activeTool === 'lancet' ||
      activeTool === 'helicopter' || activeTool === 'fighter'
    ) {
      toolCategory = 'drones';
    } else if (activeTool === 'inspect' || activeTool === 'recon' || activeTool === 'war' || activeTool === 'alliance') {
      toolCategory = 'air';
    }

    const ringColor =
      toolCategory === 'air'
        ? '#ff3d00'
        : toolCategory === 'engineer'
          ? '#a1887f'
          : toolCategory === 'defense'
            ? '#4fc3f7'
            : toolCategory === 'infantry'
              ? '#7cb342'
              : toolCategory === 'drones'
                ? '#ff1744'
                : '#ffe066';

    ctx.save();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(sx, sy, rPx, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = ringColor;
    ctx.lineWidth = 1.8;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.arc(sx, sy, rPx, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Classic Crisp Pixel-Art WorldBox Geological Cutaway Cross-Section!
  public renderGeoSlice(
    geoCanvas: HTMLCanvasElement,
    gx: number,
    gy: number,
    inBounds = true,
  ): void {
    const ctx = geoCanvas.getContext('2d');
    if (!ctx) return;

    const W = geoCanvas.width;
    const H = geoCanvas.height;
    ctx.imageSmoothingEnabled = false;

    ctx.fillStyle = '#141e2e';
    ctx.fillRect(0, 0, W, H);

    const cx = Math.max(0, Math.min(WORLD_W - 1, Math.floor(inBounds ? gx : WORLD_W * 0.5)));
    const cy = Math.max(0, Math.min(WORLD_H - 1, Math.floor(inBounds ? gy : WORLD_H * 0.5)));

    const halfSpan = 8;
    const cols = halfSpan * 2 + 1;
    const colW = Math.floor(W / cols);
    const scaleY = 4.0;
    const seaY = H - Math.round(this.world.settings.seaLevel * scaleY) - 6;

    ctx.fillStyle = 'rgba(100, 216, 255, 0.22)';
    ctx.fillRect(0, seaY, W, 1);

    for (let s = -halfSpan; s <= halfSpan; s++) {
      const sx = Math.max(0, Math.min(WORLD_W - 1, cx + s));
      const idx = cy * WORLD_W + sx;
      const px = (s + halfSpan) * colW;

      const hSoil = this.world.soil[idx];
      const hStone = this.world.stone[idx];
      const hSand = this.world.sand[idx];
      const hGlass = this.world.glass[idx];
      const hTnt = this.world.tnt[idx];
      const hWater = this.world.water[idx];
      const hIce = this.world.ice[idx];
      const hLava = this.world.lava[idx];

      let curBottom = H - 6;

      const soilPx = Math.max(1, Math.round(hSoil * scaleY));
      ctx.fillStyle =
        this.world.grass[idx] > 0.4 && hWater < 0.05 && hSand < 0.1 && hStone < 0.1
          ? '#5aa846'
          : '#73543a';
      ctx.fillRect(px, curBottom - soilPx, colW, soilPx);
      if (soilPx > 3) {
        ctx.fillStyle = '#5c412c';
        ctx.fillRect(px, curBottom - soilPx + 3, colW, soilPx - 3);
      }
      curBottom -= soilPx;

      if (hStone > 0.03) {
        const stonePx = Math.max(1, Math.round(hStone * scaleY));
        ctx.fillStyle = this.world.goldOre[idx] > 0.25 ? '#f5c542' : '#8b95a5';
        ctx.fillRect(px, curBottom - stonePx, colW, stonePx);
        curBottom -= stonePx;
      }

      if (hSand > 0.03) {
        const sandPx = Math.max(1, Math.round(hSand * scaleY));
        ctx.fillStyle = this.world.wetness[idx] > 0.4 ? '#c49d59' : '#f0cf7b';
        ctx.fillRect(px, curBottom - sandPx, colW, sandPx);
        curBottom -= sandPx;
      }

      if (hGlass > 0.03) {
        const glassPx = Math.max(1, Math.round(hGlass * scaleY));
        ctx.fillStyle = '#aef7fc';
        ctx.fillRect(px, curBottom - glassPx, colW, glassPx);
        curBottom -= glassPx;
      }

      if (hTnt > 0.03) {
        const tntPx = Math.max(2, Math.round(hTnt * scaleY));
        ctx.fillStyle = '#e53935';
        ctx.fillRect(px, curBottom - tntPx, colW, tntPx);
        curBottom -= tntPx;
      }

      if (hWater > 0.03) {
        const waterPx = Math.max(1, Math.round(hWater * scaleY));
        ctx.fillStyle = 'rgba(54, 174, 224, 0.82)';
        ctx.fillRect(px, curBottom - waterPx, colW, waterPx);
        curBottom -= waterPx;
      }

      if (hIce > 0.03) {
        const icePx = Math.max(2, Math.round(hIce * scaleY));
        ctx.fillStyle = '#bdf2ff';
        ctx.fillRect(px, curBottom - icePx, colW, icePx);
        curBottom -= icePx;
      }

      if (hLava > 0.03) {
        const lavaPx = Math.max(2, Math.round(hLava * scaleY));
        ctx.fillStyle = '#ff6d1f';
        ctx.fillRect(px, curBottom - lavaPx, colW, lavaPx);
        ctx.fillStyle = '#ffe566';
        ctx.fillRect(px, curBottom - lavaPx, colW, 1);
      }

      if (s === 0) {
        ctx.fillStyle = 'rgba(255, 224, 115, 0.20)';
        ctx.fillRect(px, 0, colW, H);
      }
    }

    ctx.fillStyle = '#332924';
    ctx.fillRect(0, H - 6, W, 6);
  }

  public moveCameraTo(gx: number, gy: number): void {
    this.camX = gx;
    this.camY = gy;
    this.clampCamera();
  }

  public renderMinimap(targetCanvas: HTMLCanvasElement): void {
    const ctx = targetCanvas.getContext('2d');
    if (!ctx) return;
    const W = targetCanvas.width;
    const H = targetCanvas.height;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.offscreenCanvas, 0, 0, W, H);

    const sx = W / WORLD_W;
    const sy = H / WORLD_H;

    // Settlement capital dots
    for (const s of this.entities.settlements) {
      if (s.population <= 0 && s.buildings <= 0) continue;
      const pal = KINGDOM_PALETTES[s.kingdom % KINGDOM_PALETTES.length];
      const px = Math.round(s.centerX * sx);
      const py = Math.round(s.centerY * sy);
      ctx.fillStyle = '#130e0b';
      ctx.fillRect(px - 2, py - 2, 5, 5);
      ctx.fillStyle = pal.light;
      ctx.fillRect(px - 1, py - 1, 3, 3);
    }

    // Dragon radar blips
    ctx.fillStyle = '#ff4d4f';
    for (let d = 0; d < this.entities.dragonCount; d++) {
      ctx.fillRect(Math.round(this.entities.dx[d] * sx) - 1, Math.round(this.entities.dy[d] * sy) - 1, 3, 3);
    }

    // Current viewport rectangle
    const halfW = this.logicalWidth * 0.5 / this.zoom;
    const halfH = this.logicalHeight * 0.5 / this.zoom;
    const vx = Math.max(0, Math.round((this.camX - halfW) * sx));
    const vy = Math.max(0, Math.round((this.camY - halfH) * sy));
    const vw = Math.min(W - vx, Math.max(4, Math.round(halfW * 2 * sx)));
    const vh = Math.min(H - vy, Math.max(4, Math.round(halfH * 2 * sy)));

    ctx.strokeStyle = '#130e0b';
    ctx.lineWidth = 2;
    ctx.strokeRect(vx, vy, vw, vh);
    ctx.strokeStyle = '#ffe066';
    ctx.lineWidth = 1;
    ctx.strokeRect(vx + 0.5, vy + 0.5, Math.max(1, vw - 1), Math.max(1, vh - 1));
  }
}
