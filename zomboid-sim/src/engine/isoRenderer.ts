import { PixBuf, ZomboidSpriteAtlas } from './models';
import {
  PART_BLOOD,
  PART_FIRE,
  PART_FLARE,
  PART_GLASS,
  PART_SHELL,
  PART_SMOKE,
  PART_SPARK,
  PART_SPLINTER,
  ZomboidSimulation,
} from './sim';
import {
  FLOOR_ASPHALT,
  FLOOR_CARPET,
  FLOOR_CONCRETE,
  FLOOR_DIRT,
  FLOOR_GRASS,
  FLOOR_GRAVEL,
  FLOOR_ROAD_LINE,
  FLOOR_SIDEWALK,
  FLOOR_TILE_WHITE,
  FLOOR_WATER,
  FLOOR_WOOD,
  ISO_HALF_H,
  ISO_HALF_W,
  ISO_WALL_H,
  isZombieRole,
  MOODLE_BITTEN,
  MOODLE_BLEEDING,
  MOODLE_PANIC,
  PROP_NONE,
  PROP_STREETLIGHT,
  RADAR_SPAN,
  RoofMode,
  STRUCT_DOOR_CLOSED,
  STRUCT_DOOR_OPEN,
  STRUCT_FENCE_CHAIN,
  STRUCT_FENCE_WOOD,
  STRUCT_NONE,
  STRUCT_RUBBLE,
  STRUCT_SANDBAG,
  STRUCT_WALL_BRICK,
  STRUCT_WALL_CONCRETE,
  STRUCT_WALL_STORE,
  STRUCT_WALL_WOOD,
  STRUCT_WINDOW_BROKEN,
  STRUCT_WINDOW_INTACT,
} from './types';
import { CityWorld } from './world';

function bakeDiamondTile(
  baseHex: string,
  altHex: string,
  pattern: 'noise' | 'grid' | 'planks' | 'stripe_x' | 'stripe_y',
): HTMLCanvasElement {
  const b = new PixBuf(32, 16);
  for (let y = 0; y < 16; y++) {
    const dy = Math.abs(y - 7.5);
    const halfSpan = Math.round((1 - dy / 8.0) * 16);
    const xStart = Math.max(0, 16 - halfSpan);
    const xEnd = Math.min(31, 16 + halfSpan - 1);
    for (let x = xStart; x <= xEnd; x++) {
      let useAlt = false;
      if (pattern === 'grid') {
        useAlt = ((x + y) % 8 === 0) || ((x - y + 32) % 8 === 0);
      } else if (pattern === 'planks') {
        useAlt = y % 4 === 0 || (x + y * 3) % 13 === 0;
      } else if (pattern === 'stripe_x') {
        const dLine = Math.abs(x - 15.5 - (y - 7.5) * 2.0);
        useAlt = dLine <= 1.6 && x >= 9 && x <= 22;
      } else if (pattern === 'stripe_y') {
        const dLine = Math.abs(x - 15.5 + (y - 7.5) * 2.0);
        useAlt = dLine <= 1.6 && x >= 9 && x <= 22;
      } else {
        useAlt = ((x * 37 + y * 91) & 15) < 4;
      }
      b.px(x, y, useAlt ? altHex : baseHex);
    }
  }
  return b.toCanvas();
}

const VIEW_STRIDE = 256;

export class IsoCityRenderer {
  private ctx: CanvasRenderingContext2D;
  private atlas = new ZomboidSpriteAtlas();
  private floorTiles: Record<number, HTMLCanvasElement[]> = {};

  private lightCanvas: HTMLCanvasElement;
  private lightCtx: CanvasRenderingContext2D;

  // Local viewport tile bucket (256x256 sliding window -> works across -∞ .. +∞ with zero GC!)
  private localBucketHead = new Int32Array(VIEW_STRIDE * VIEW_STRIDE);
  private entityIdx = new Int32Array(2048);
  private entityNext = new Int32Array(2048);

  // Unbounded Open-World Camera Coordinates (-∞ .. +∞)
  public camX = 17;
  public camY = 16;
  public zoom = 1.38;
  public dpr = 1;
  public roofMode: RoofMode = 'auto';

  private cutBuildingSet = new Set<number>();

  constructor(
    private canvas: HTMLCanvasElement,
    public world: CityWorld,
    public sim: ZomboidSimulation,
  ) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.lightCanvas = document.createElement('canvas');
    this.lightCtx = this.lightCanvas.getContext('2d')!;
    this.bakeFloorAtlas();
  }

  public get logicalW(): number {
    return this.canvas.width / this.dpr;
  }

  public get logicalH(): number {
    return this.canvas.height / this.dpr;
  }

  private bakeFloorAtlas(): void {
    this.floorTiles[FLOOR_GRASS] = [
      bakeDiamondTile('#46563b', '#3e4d34', 'noise'),
      bakeDiamondTile('#4c5c40', '#415036', 'noise'),
    ];
    this.floorTiles[FLOOR_DIRT] = [
      bakeDiamondTile('#5d503f', '#514536', 'noise'),
      bakeDiamondTile('#655745', '#55493a', 'noise'),
    ];
    this.floorTiles[FLOOR_ASPHALT] = [
      bakeDiamondTile('#34373c', '#2d3035', 'noise'),
      bakeDiamondTile('#383b40', '#303338', 'noise'),
    ];
    this.floorTiles[FLOOR_ROAD_LINE] = [
      bakeDiamondTile('#34373c', '#c9a23b', 'stripe_x'),
      bakeDiamondTile('#34373c', '#c9a23b', 'stripe_y'),
    ];
    this.floorTiles[FLOOR_SIDEWALK] = [
      bakeDiamondTile('#686c70', '#5a5e62', 'grid'),
      bakeDiamondTile('#6d7175', '#5d6165', 'grid'),
    ];
    this.floorTiles[FLOOR_WOOD] = [
      bakeDiamondTile('#6e5036', '#593f2a', 'planks'),
      bakeDiamondTile('#75563b', '#5e432d', 'planks'),
    ];
    this.floorTiles[FLOOR_TILE_WHITE] = [
      bakeDiamondTile('#9aa3a8', '#7d868c', 'grid'),
      bakeDiamondTile('#8f999e', '#768086', 'grid'),
    ];
    this.floorTiles[FLOOR_CONCRETE] = [
      bakeDiamondTile('#53575b', '#494d50', 'noise'),
      bakeDiamondTile('#585c60', '#4d5155', 'noise'),
    ];
    this.floorTiles[FLOOR_WATER] = [
      bakeDiamondTile('#23495d', '#2d5c73', 'noise'),
      bakeDiamondTile('#264f63', '#1e3f50', 'noise'),
    ];
    this.floorTiles[FLOOR_GRAVEL] = [
      bakeDiamondTile('#4a4b4d', '#595a5c', 'noise'),
      bakeDiamondTile('#464749', '#555658', 'noise'),
    ];
    this.floorTiles[FLOOR_CARPET] = [
      bakeDiamondTile('#4d5866', '#434d59', 'noise'),
      bakeDiamondTile('#5e4949', '#523e3e', 'noise'),
    ];
  }

  public worldToScreen(wx: number, wy: number, wz = 0): { sx: number; sy: number } {
    const hw = ISO_HALF_W * this.zoom;
    const hh = ISO_HALF_H * this.zoom;
    const dx = wx - this.camX;
    const dy = wy - this.camY;
    return {
      sx: this.logicalW * 0.5 + (dx - dy) * hw,
      sy: this.logicalH * 0.5 + (dx + dy) * hh - wz * ISO_WALL_H * this.zoom,
    };
  }

  public screenToWorld(sx: number, sy: number): { wx: number; wy: number } {
    const hw = ISO_HALF_W * this.zoom;
    const hh = ISO_HALF_H * this.zoom;
    const px = sx - this.logicalW * 0.5;
    const py = sy - this.logicalH * 0.5;
    const a = px / hw;
    const b = py / hh;
    return {
      wx: this.camX + (a + b) * 0.5,
      wy: this.camY + (b - a) * 0.5,
    };
  }

  public clampCamera(): void {
    // NO WORLD BOUNDARIES! Infinite open world in ALL directions — only clamp zoom scale!
    this.zoom = Math.max(0.45, Math.min(3.2, this.zoom));
  }

  public focusSquad1PoliceStation(): void {
    const hq = this.world.buildings[this.world.policeStationId];
    if (hq) {
      this.camX = hq.x0 + hq.w * 0.5;
      this.camY = hq.y0 + hq.h * 0.5;
    } else {
      this.camX = 17;
      this.camY = 16;
    }
    this.zoom = 1.38;
  }

  public render(timeSec: number, cursorWx: number, cursorWy: number, activeTool: string): void {
    // Seamlessly generate infinite chunks around camera on the fly!
    this.world.ensureAreaLoaded(this.camX, this.camY, 2);

    const ctx = this.ctx;
    const lw = this.logicalW;
    const lh = this.logicalH;
    const z = this.zoom;
    const hw = ISO_HALF_W * z;
    const hh = ISO_HALF_H * z;
    const wallPx = ISO_WALL_H * z;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#121614';
    ctx.fillRect(0, 0, lw, lh);

    // 1. Determine Cutaway X-Ray Buildings
    this.cutBuildingSet.clear();
    const hoverGx = Math.floor(cursorWx);
    const hoverGy = Math.floor(cursorWy);
    const hoverBldg = this.world.getBuildingId(hoverGx, hoverGy);

    let selectedUnitBldg = -1;
    if (this.sim.selectedUid > 0) {
      for (let i = 0; i < this.sim.count; i++) {
        if (this.sim.uUid[i] === this.sim.selectedUid) {
          selectedUnitBldg = this.world.getBuildingId(Math.floor(this.sim.ux[i]), Math.floor(this.sim.uy[i]));
          break;
        }
      }
    }

    for (let b = 0; b < this.world.buildings.length; b++) {
      const info = this.world.buildings[b];
      if (this.roofMode === 'cut_all') {
        this.cutBuildingSet.add(b);
      } else if (this.roofMode === 'auto') {
        if (
          b === this.world.policeStationId ||
          b === hoverBldg ||
          b === selectedUnitBldg ||
          info.survivorsInside > 0 ||
          info.zombiesInside > 0
        ) {
          this.cutBuildingSet.add(b);
        }
      }
    }

    // 2. Compute Tight Isometric Frustum Bounds around Unbounded Camera
    const corners = [
      this.screenToWorld(-64, -96),
      this.screenToWorld(lw + 64, -96),
      this.screenToWorld(-64, lh + 110),
      this.screenToWorld(lw + 64, lh + 110),
    ];
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const c of corners) {
      if (c.wx < minX) minX = c.wx;
      if (c.wx > maxX) maxX = c.wx;
      if (c.wy < minY) minY = c.wy;
      if (c.wy > maxY) maxY = c.wy;
    }
    const x0 = Math.floor(minX) - 2;
    const x1 = Math.min(x0 + VIEW_STRIDE - 2, Math.ceil(maxX) + 2);
    const y0 = Math.floor(minY) - 2;
    const y1 = Math.min(y0 + VIEW_STRIDE - 2, Math.ceil(maxY) + 2);

    // 3. Bucket visible Vehicles & Units into local viewport tiles [gx - x0, gy - y0]
    this.localBucketHead.fill(-1);
    let itemCursor = 0;

    for (let vIdx = 0; vIdx < this.world.vehicles.length && itemCursor < 2030; vIdx++) {
      const v = this.world.vehicles[vIdx];
      const gx = Math.floor(v.x);
      const gy = Math.floor(v.y);
      if (gx < x0 || gx > x1 || gy < y0 || gy > y1) continue;
      const cell = (gy - y0) * VIEW_STRIDE + (gx - x0);
      this.entityIdx[itemCursor] = -(vIdx + 1);
      this.entityNext[itemCursor] = this.localBucketHead[cell];
      this.localBucketHead[cell] = itemCursor++;
    }

    for (let u = 0; u < this.sim.count && itemCursor < 2046; u++) {
      if (this.sim.uHp[u] <= 0) continue;
      const gx = Math.floor(this.sim.ux[u]);
      const gy = Math.floor(this.sim.uy[u]);
      if (gx < x0 || gx > x1 || gy < y0 || gy > y1) continue;
      const bId = this.world.getBuildingId(gx, gy);
      if (bId >= 0 && this.roofMode === 'solid' && !this.cutBuildingSet.has(bId)) continue;

      const cell = (gy - y0) * VIEW_STRIDE + (gx - x0);
      this.entityIdx[itemCursor] = u;
      this.entityNext[itemCursor] = this.localBucketHead[cell];
      this.localBucketHead[cell] = itemCursor++;
    }

    const tileW = Math.ceil(hw * 2);
    const tileH = Math.ceil(hh * 2);
    const centerScreenX = lw * 0.5;
    const centerScreenY = lh * 0.5;

    // ══ PASS A: ISOMETRIC GROUND TILES, SCORCH MARKS & PERSISTENT BLOOD POOLS ══
    for (let gy = y0; gy <= y1; gy++) {
      for (let gx = x0; gx <= x1; gx++) {
        const dx = gx - this.camX;
        const dy = gy - this.camY;
        const sx = centerScreenX + (dx - dy) * hw;
        const sy = centerScreenY + (dx + dy) * hh;
        if (sx < -tileW || sx > lw + tileW || sy < -tileH || sy > lh + tileH) continue;

        const flr = this.world.getFloor(gx, gy);
        const variants = this.floorTiles[flr] || this.floorTiles[FLOOR_GRASS];
        let varIdx = this.world.getVariation(gx, gy) & 1;
        if (flr === FLOOR_ROAD_LINE) {
          const alongX = this.world.getFloor(gx + 1, gy) === FLOOR_ROAD_LINE || this.world.getFloor(gx - 1, gy) === FLOOR_ROAD_LINE;
          varIdx = alongX ? 0 : 1;
        }
        ctx.drawImage(variants[varIdx], Math.round(sx - hw), Math.round(sy), tileW + 1, tileH + 1);

        const scorch = this.world.getScorch(gx, gy);
        if (scorch > 0.08) {
          ctx.fillStyle = `rgba(18, 17, 16, ${Math.min(0.68, scorch * 0.7)})`;
          ctx.fillRect(Math.round(sx - hw * 0.45), Math.round(sy + hh * 0.55), Math.max(2, Math.round(hw * 0.9)), Math.max(2, Math.round(hh * 0.85)));
        }

        const blood = this.world.getBlood(gx, gy);
        if (blood > 0.05) {
          ctx.fillStyle = blood > 0.5 ? '#6e0d16' : '#8a1520';
          const bw = Math.max(2, Math.round(hw * 0.65 * Math.min(1, blood + 0.35)));
          const bh = Math.max(2, Math.round(hh * 0.65 * Math.min(1, blood + 0.35)));
          ctx.fillRect(Math.round(sx - bw * 0.5), Math.round(sy + hh - bh * 0.5), bw, bh);
        }
      }
    }

    // ══ PASS B: BACK-TO-FRONT 2.5D WALLS, WINDOWS, DOORS, FURNITURE, DESTRUCTIBLE CARS & UNITS ══
    for (let sum = x0 + y0; sum <= x1 + y1; sum++) {
      const gxStart = Math.max(x0, sum - y1);
      const gxEnd = Math.min(x1, sum - y0);

      for (let gx = gxStart; gx <= gxEnd; gx++) {
        const gy = sum - gx;
        const dx = gx - this.camX;
        const dy = gy - this.camY;
        const sx = centerScreenX + (dx - dy) * hw;
        const sy = centerScreenY + (dx + dy) * hh;
        if (sx < -hw * 3 || sx > lw + hw * 3 || sy < -wallPx * 2 || sy > lh + wallPx * 2.5) continue;

        const bId = this.world.getBuildingId(gx, gy);
        const bCut = bId >= 0 ? this.cutBuildingSet.has(bId) : true;
        const st = this.world.getStruct(gx, gy);

        // 1. Structure Column (Back walls stay tall; Front/Inner walls drop to stub in Cutaway X-Ray!)
        if (st !== STRUCT_NONE) {
          let isFrontCutWall = false;
          if (bId >= 0 && bCut) {
            // Check whether tile [gx-1, gy] or [gx, gy-1] belongs to the same building -> front/interior wall!
            const backLeftInside = this.world.getBuildingId(gx - 1, gy) === bId;
            const backTopInside = this.world.getBuildingId(gx, gy - 1) === bId;
            if (backLeftInside || backTopInside) {
              isFrontCutWall = true;
            }
          }
          this.drawIsoStructure(ctx, sx, sy, hw, hh, wallPx, st, this.world.getBarricade(gx, gy), isFrontCutWall);
        }

        // 2. Furniture, Loot Containers, Trees & Streetlights
        const propId = this.world.getProp(gx, gy);
        if (propId !== PROP_NONE && (bId < 0 || bCut)) {
          const pSpr = this.atlas.getPropSprite(propId);
          const scale = z * (propId <= 2 ? 1.18 : 0.92);
          const dw = Math.max(8, Math.round(pSpr.width * scale));
          const dh = Math.max(8, Math.round(pSpr.height * scale));
          ctx.drawImage(pSpr, Math.round(sx - dw * 0.5), Math.round(sy + hh * 1.35 - dh), dw, dh);

          if (this.world.getLoot(gx, gy) > 0 && propId > 2 && z > 0.95) {
            ctx.fillStyle = propId === 11 ? '#8ac926' : 'rgba(233, 196, 106, 0.78)';
            ctx.fillRect(Math.round(sx - 2), Math.round(sy + hh * 1.35 - dh - 4), 4, 2);
          }
        }

        // 3. Vehicles & Characters in this tile
        let node = this.localBucketHead[(gy - y0) * VIEW_STRIDE + (gx - x0)];
        while (node >= 0) {
          const ref = this.entityIdx[node];
          if (ref < 0) {
            const v = this.world.vehicles[-ref - 1];
            const shakeX = v.hitFlash > 0 ? Math.sin(timeSec * 55) * 2.5 * z : 0;
            const vs = this.worldToScreen(v.x, v.y, 0);
            const cSpr = this.atlas.getCarSprite(v.kind, v.color, v.axis, v.exploded);
            const dw = Math.max(16, Math.round(cSpr.width * z * 1.05));
            const dh = Math.max(12, Math.round(cSpr.height * z * 1.05));
            ctx.drawImage(cSpr, Math.round(vs.sx - dw * 0.5 + shakeX), Math.round(vs.sy + hh * 0.5 - dh * 0.72), dw, dh);

            // Car Durability Bar when zombies / bullets damage the car!
            if (!v.exploded && v.hp < v.maxHp) {
              const bw = Math.max(16, Math.round(24 * z));
              const bx = Math.round(vs.sx - bw * 0.5);
              const by = Math.round(vs.sy - dh * 0.68);
              ctx.fillStyle = '#111315';
              ctx.fillRect(bx - 1, by - 1, bw + 2, 4);
              ctx.fillStyle = v.hp < v.maxHp * 0.35 ? '#e63946' : '#f4a261';
              ctx.fillRect(bx, by, Math.max(1, Math.round(bw * (v.hp / v.maxHp))), 2);
            }

            // Flashing Car Alarm / Police Strobe
            if (!v.exploded && (v.alarmTimer > 0 || v.sirenOn)) {
              const flashRed = Math.floor(timeSec * 7) % 2 === 0;
              ctx.fillStyle = flashRed ? '#ff2a54' : '#3a86ff';
              ctx.fillRect(Math.round(vs.sx - 4 * z), Math.round(vs.sy - dh * 0.55), Math.max(3, Math.round(8 * z)), Math.max(2, Math.round(3 * z)));
            }
          } else {
            this.drawIsoUnit(ctx, ref, z, timeSec);
          }
          node = this.entityNext[node];
        }
      }
    }

    // ══ PASS C: MULTI-WING BUILDING ROOFS (Closed Mode) & SAFEHOUSE / ГРУППА №1 PLAQUES ══
    for (let b = 0; b < this.world.buildings.length; b++) {
      const info = this.world.buildings[b];
      const mid = this.worldToScreen(info.x0 + info.w * 0.5, info.y0 + info.h * 0.5, 1.25);
      if (mid.sx < -220 || mid.sx > lw + 220 || mid.sy < -220 || mid.sy > lh + 220) continue;

      if (!this.cutBuildingSet.has(b)) {
        for (const rm of info.rooms) {
          const topC = this.worldToScreen(rm.x0, rm.y0, 1);
          const rightC = this.worldToScreen(rm.x0 + rm.w, rm.y0, 1);
          const botC = this.worldToScreen(rm.x0 + rm.w, rm.y0 + rm.h, 1);
          const leftC = this.worldToScreen(rm.x0, rm.y0 + rm.h, 1);
          ctx.fillStyle = rm.roofColor;
          ctx.strokeStyle = '#14171a';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(topC.sx, topC.sy);
          ctx.lineTo(rightC.sx, rightC.sy);
          ctx.lineTo(botC.sx, botC.sy);
          ctx.lineTo(leftC.sx, leftC.sy);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      }

      if (z >= 0.70 && (info.isSafehouse || info.kind !== 'house')) {
        const isGroup1 = info.safehouseSquad === 1;
        const prefix = isGroup1 ? '★ ГРУППА №1 • ' : info.isSafehouse ? '[БАЗА] ' : '';
        const annexInfo = info.expansions > 0 ? ` [+${info.expansions} комн.]` : '';
        const woodInfo = info.isSafehouse ? ` • Брёвна ${info.woodStock}/22` : '';
        const tag = `${prefix}${info.name} (${info.survivorsInside})${annexInfo}${woodInfo}`;

        ctx.font = '700 11px "Pixelify Sans", monospace';
        const tw = ctx.measureText(tag).width + 12;
        const rx = Math.round(mid.sx - tw * 0.5);
        const ry = Math.round(mid.sy - 10);
        ctx.fillStyle = isGroup1 ? 'rgba(20, 34, 52, 0.92)' : info.isSafehouse ? 'rgba(20, 36, 26, 0.90)' : 'rgba(18, 20, 22, 0.84)';
        ctx.fillRect(rx, ry, Math.round(tw), 16);
        ctx.strokeStyle = isGroup1 ? '#ffd466' : info.isSafehouse ? '#8ac926' : '#6c757d';
        ctx.lineWidth = isGroup1 ? 1.5 : 1;
        ctx.strokeRect(rx + 0.5, ry + 0.5, Math.round(tw) - 1, 15);
        ctx.fillStyle = info.zombiesInside > 0 ? '#ff6b6b' : isGroup1 ? '#fff0a8' : '#f1faee';
        ctx.fillText(tag, rx + 6, ry + 12);
      }
    }

    // ══ PASS D: VISIBLE TRACER BULLETS, 3D PARTICLES & META-SOUND WAVES ══
    ctx.strokeStyle = '#fff3b0';
    ctx.lineWidth = Math.max(1.6, 2.0 * z);
    for (let b = 0; b < this.sim.bulletCount; b++) {
      const p0 = this.worldToScreen(this.sim.bx[b], this.sim.by[b], 0.48);
      const p1 = this.worldToScreen(
        this.sim.bx[b] - this.sim.bvx[b] * 0.045,
        this.sim.by[b] - this.sim.bvy[b] * 0.045,
        0.48,
      );
      ctx.beginPath();
      ctx.moveTo(p0.sx, p0.sy);
      ctx.lineTo(p1.sx, p1.sy);
      ctx.stroke();
    }

    for (let p = 0; p < this.sim.partCount; p++) {
      const ps = this.worldToScreen(this.sim.px[p], this.sim.py[p], this.sim.pz[p] * 0.45);
      if (ps.sx < -20 || ps.sx > lw + 20 || ps.sy < -20 || ps.sy > lh + 20) continue;
      const kind = this.sim.pKind[p];
      const alpha = Math.max(0.15, this.sim.pLife[p] / Math.max(0.01, this.sim.pMaxLife[p]));
      if (kind === PART_BLOOD) {
        ctx.fillStyle = '#c1121f';
        ctx.fillRect(Math.round(ps.sx), Math.round(ps.sy), Math.max(2, Math.round(3 * z)), Math.max(2, Math.round(3 * z)));
      } else if (kind === PART_GLASS) {
        ctx.fillStyle = '#caf0f8';
        ctx.fillRect(Math.round(ps.sx), Math.round(ps.sy), Math.max(2, Math.round(2.5 * z)), Math.max(2, Math.round(2.5 * z)));
      } else if (kind === PART_SHELL) {
        ctx.fillStyle = '#ffd166';
        ctx.fillRect(Math.round(ps.sx), Math.round(ps.sy), Math.max(2, Math.round(2 * z)), Math.max(1, Math.round(1.5 * z)));
      } else if (kind === PART_SPLINTER) {
        ctx.fillStyle = '#bc6c25';
        ctx.fillRect(Math.round(ps.sx), Math.round(ps.sy), Math.max(2, Math.round(3 * z)), Math.max(2, Math.round(2 * z)));
      } else if (kind === PART_FIRE || kind === PART_SPARK) {
        ctx.fillStyle = alpha > 0.55 ? '#ffbe0b' : '#fb5607';
        const s = Math.max(2, Math.round((kind === PART_FIRE ? 5 : 3) * z));
        ctx.fillRect(Math.round(ps.sx - s * 0.5), Math.round(ps.sy - s * 0.5), s, s);
      } else if (kind === PART_FLARE) {
        ctx.fillStyle = `rgba(128, 237, 153, ${alpha * 0.55})`;
        const s = Math.max(4, Math.round(7 * z));
        ctx.fillRect(Math.round(ps.sx - s * 0.5), Math.round(ps.sy - s * 0.5), s, s);
      } else if (kind === PART_SMOKE) {
        ctx.fillStyle = `rgba(38, 42, 46, ${alpha * 0.48})`;
        const s = Math.max(4, Math.round(8 * z * (1.4 - alpha * 0.5)));
        ctx.fillRect(Math.round(ps.sx - s * 0.5), Math.round(ps.sy - s * 0.5), s, s);
      }
    }

    if (this.sim.showSoundWaves) {
      for (const ring of this.sim.soundRings) {
        const t = ring.age / ring.duration;
        const curR = ring.maxRadius * t;
        const c = this.worldToScreen(ring.x, ring.y, 0.1);
        ctx.save();
        ctx.globalAlpha = (1 - t) * 0.55;
        ctx.strokeStyle = ring.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(c.sx, c.sy, curR * hw * 1.05, curR * hh * 1.05, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    if (this.sim.heliActive) {
      const hs = this.worldToScreen(this.sim.heliX, this.sim.heliY, 2.2);
      ctx.save();
      ctx.strokeStyle = 'rgba(240, 244, 248, 0.78)';
      ctx.lineWidth = 3;
      const rot = timeSec * 18;
      const rLen = 36 * z;
      ctx.beginPath();
      ctx.moveTo(hs.sx - Math.cos(rot) * rLen, hs.sy - Math.sin(rot) * rLen * 0.5);
      ctx.lineTo(hs.sx + Math.cos(rot) * rLen, hs.sy + Math.sin(rot) * rLen * 0.5);
      ctx.moveTo(hs.sx - Math.cos(rot + 1.57) * rLen, hs.sy - Math.sin(rot + 1.57) * rLen * 0.5);
      ctx.lineTo(hs.sx + Math.cos(rot + 1.57) * rLen, hs.sy + Math.sin(rot + 1.57) * rLen * 0.5);
      ctx.stroke();
      ctx.restore();
    }

    // ══ PASS E: WEATHER & NIGHT LIGHTMAP ══
    if (this.sim.weather === 'rain' || this.sim.weather === 'storm') {
      ctx.strokeStyle = 'rgba(168, 208, 230, 0.34)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let r = 0; r < 140; r++) {
        const rx = ((r * 97 + timeSec * 480) % (lw + 120)) - 60;
        const ry = ((r * 173 + timeSec * 920) % (lh + 120)) - 60;
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 8, ry + 20);
      }
      ctx.stroke();
    } else if (this.sim.weather === 'fog') {
      ctx.fillStyle = 'rgba(168, 178, 172, 0.24)';
      ctx.fillRect(0, 0, lw, lh);
    }

    const dark = Math.max(0, this.sim.darknessLevel - this.sim.lightningFlash);
    if (dark > 0.04) {
      this.renderNightLightmap(lw, lh, dark, timeSec, x0, x1, y0, y1);
    }

    // WorldBox Brush Isometric Cursor Highlight
    const cs = this.worldToScreen(hoverGx + 0.5, hoverGy + 0.5, 0.05);
    ctx.strokeStyle = activeTool.includes('zombie') || activeTool.includes('horde') ? '#80ed99' : '#ffd466';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(cs.sx, cs.sy - hh);
    ctx.lineTo(cs.sx + hw, cs.sy);
    ctx.lineTo(cs.sx, cs.sy + hh);
    ctx.lineTo(cs.sx - hw, cs.sy);
    ctx.closePath();
    ctx.stroke();
  }

  private drawIsoStructure(
    ctx: CanvasRenderingContext2D,
    sx: number,
    sy: number,
    hw: number,
    hh: number,
    wallPx: number,
    st: number,
    barricadePlanks: number,
    cutStub: boolean,
  ): void {
    if (st === STRUCT_RUBBLE) {
      ctx.fillStyle = '#494744';
      ctx.fillRect(Math.round(sx - hw * 0.55), Math.round(sy + hh * 0.5), Math.max(3, Math.round(hw * 1.1)), Math.max(3, Math.round(hh * 0.9)));
      return;
    }

    const isLow = st === STRUCT_FENCE_WOOD || st === STRUCT_FENCE_CHAIN || st === STRUCT_SANDBAG;
    const h = isLow ? wallPx * 0.42 : cutStub ? wallPx * 0.28 : wallPx;

    let topCol = '#6c584c';
    let leftCol = '#7f5539';
    let rightCol = '#5c3d28';

    if (st === STRUCT_WALL_BRICK) {
      topCol = '#6b443b';
      leftCol = '#844b3e';
      rightCol = '#5e342b';
    } else if (st === STRUCT_WALL_WOOD || st === STRUCT_FENCE_WOOD) {
      topCol = '#8c6d4f';
      leftCol = '#7a5c3e';
      rightCol = '#59412b';
    } else if (st === STRUCT_WALL_CONCRETE || st === STRUCT_WALL_STORE) {
      topCol = '#7d8287';
      leftCol = '#6c7175';
      rightCol = '#4f5357';
    } else if (st === STRUCT_SANDBAG) {
      topCol = '#b59f72';
      leftCol = '#9c865b';
      rightCol = '#786643';
    } else if (st === STRUCT_FENCE_CHAIN) {
      ctx.strokeStyle = '#9aa0a6';
      ctx.lineWidth = 1;
      ctx.strokeRect(Math.round(sx - hw * 0.5), Math.round(sy - h), Math.round(hw), Math.round(h + hh));
      return;
    } else if (st === STRUCT_DOOR_OPEN) {
      ctx.fillStyle = '#6c462b';
      ctx.fillRect(Math.round(sx - hw * 0.15), Math.round(sy - h), Math.max(3, Math.round(hw * 0.3)), Math.round(h + hh * 0.8));
      return;
    } else if (st === STRUCT_DOOR_CLOSED) {
      topCol = '#7c4d2b';
      leftCol = '#6e4324';
      rightCol = '#4f2f19';
    }

    ctx.fillStyle = leftCol;
    ctx.beginPath();
    ctx.moveTo(sx - hw, sy + hh);
    ctx.lineTo(sx, sy + hh * 2);
    ctx.lineTo(sx, sy + hh * 2 - h);
    ctx.lineTo(sx - hw, sy + hh - h);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = rightCol;
    ctx.beginPath();
    ctx.moveTo(sx, sy + hh * 2);
    ctx.lineTo(sx + hw, sy + hh);
    ctx.lineTo(sx + hw, sy + hh - h);
    ctx.lineTo(sx, sy + hh * 2 - h);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = topCol;
    ctx.beginPath();
    ctx.moveTo(sx, sy - h);
    ctx.lineTo(sx + hw, sy + hh - h);
    ctx.lineTo(sx, sy + hh * 2 - h);
    ctx.lineTo(sx - hw, sy + hh - h);
    ctx.closePath();
    ctx.fill();

    if (st === STRUCT_WINDOW_INTACT || st === STRUCT_WINDOW_BROKEN) {
      const winH = Math.max(3, h * 0.48);
      ctx.fillStyle = st === STRUCT_WINDOW_INTACT ? 'rgba(137, 194, 217, 0.72)' : 'rgba(18, 22, 26, 0.85)';
      ctx.fillRect(Math.round(sx - hw * 0.45), Math.round(sy + hh - h * 0.68), Math.max(4, Math.round(hw * 0.9)), Math.round(winH));
    }

    if (barricadePlanks > 0) {
      ctx.fillStyle = '#c9965b';
      const count = Math.min(4, barricadePlanks);
      for (let p = 0; p < count; p++) {
        const py = sy + hh - h * 0.78 + p * (h * 0.17);
        ctx.fillRect(Math.round(sx - hw * 0.55), Math.round(py), Math.max(5, Math.round(hw * 1.1)), Math.max(2, Math.round(h * 0.1)));
      }
    }
  }

  private drawIsoUnit(ctx: CanvasRenderingContext2D, i: number, z: number, timeSec: number): void {
    const ux = this.sim.ux[i];
    const uy = this.sim.uy[i];
    const pos = this.worldToScreen(ux, uy, 0);
    const role = this.sim.uRole[i];
    const zed = isZombieRole(role);

    const screenVx = Math.cos(this.sim.uAngle[i]) - Math.sin(this.sim.uAngle[i]);
    const flip = screenVx < 0;
    const stepFrame = Math.sin(this.sim.uWalkPhase[i]) >= 0 ? 0 : 1;
    const sick = !zed && this.sim.uInfection[i] > 0.05;

    const spr = this.atlas.getUnitSprite(role, this.sim.uVariant[i], this.sim.uWeapon[i], stepFrame, sick, flip);
    const scale = z * 0.98;
    const dw = Math.max(10, Math.round(spr.width * scale));
    const dh = Math.max(10, Math.round(spr.height * scale));

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.36)';
    ctx.fillRect(Math.round(pos.sx - dw * 0.28), Math.round(pos.sy + 2 * z), Math.max(4, Math.round(dw * 0.56)), Math.max(2, Math.round(4 * z)));

    // Squad #1 Blue-Gold Ring on ground under members of Группа №1!
    if (!zed && this.sim.uSquad[i] === 1) {
      ctx.strokeStyle = 'rgba(76, 201, 240, 0.72)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(Math.round(pos.sx - dw * 0.34), Math.round(pos.sy), Math.max(6, Math.round(dw * 0.68)), Math.max(3, Math.round(5 * z)));
    }

    const isSel = this.sim.uUid[i] === this.sim.selectedUid && this.sim.selectedUid > 0;
    if (isSel) {
      ctx.strokeStyle = '#ffd466';
      ctx.lineWidth = 2;
      ctx.strokeRect(Math.round(pos.sx - dw * 0.5) - 2, Math.round(pos.sy - dh) - 3, dw + 4, dh + 6);
    }

    ctx.drawImage(spr, Math.round(pos.sx - dw * 0.5), Math.round(pos.sy - dh + 4 * z), dw, dh);

    // Health bar
    const hpRatio = this.sim.uHp[i] / Math.max(1, this.sim.uMaxHp[i]);
    if (hpRatio < 0.98 || isSel) {
      const bw = Math.max(12, Math.round(18 * z));
      const bx = Math.round(pos.sx - bw * 0.5);
      const by = Math.round(pos.sy - dh - 3 * z);
      ctx.fillStyle = '#111315';
      ctx.fillRect(bx - 1, by - 1, bw + 2, 4);
      ctx.fillStyle = zed ? '#e63946' : '#52b788';
      ctx.fillRect(bx, by, Math.max(1, Math.round(bw * hpRatio)), 2);
    }

    // Crisp ASCII/Vector Overhead Status Tag (No Tofu Boxes!)
    if (!zed && z >= 0.85) {
      const m = this.sim.uMoodles[i];
      let badge = '';
      let bCol = '#ffd466';
      if (m & MOODLE_BITTEN) {
        badge = '☣';
        bCol = '#a7c957';
      } else if (m & MOODLE_BLEEDING) {
        badge = '♥!';
        bCol = '#ff4d6d';
      } else if (this.sim.uTask[i] === 6 || this.sim.uTask[i] === 7) {
        badge = this.sim.uWood[i] > 0 ? `[+${this.sim.uWood[i]}]` : '[ЛОМ]';
        bCol = '#ffd466';
      } else if (this.sim.uTask[i] === 2) {
        badge = '[ДОСКИ]';
        bCol = '#e9c46a';
      } else if ((m & MOODLE_PANIC) && Math.floor(timeSec * 3) % 2 === 0) {
        badge = '!';
        bCol = '#ff9f1c';
      }

      if (badge) {
        ctx.font = `700 ${Math.max(9, Math.round(9.5 * z))}px "Pixelify Sans", monospace`;
        ctx.fillStyle = bCol;
        ctx.fillText(badge, Math.round(pos.sx - 8 * z), Math.round(pos.sy - dh - 5 * z));
      }
    }
  }

  private renderNightLightmap(
    lw: number,
    lh: number,
    darkness: number,
    timeSec: number,
    x0: number,
    x1: number,
    y0: number,
    y1: number,
  ): void {
    const scale = 0.25;
    const w = Math.max(64, Math.round(lw * scale));
    const h = Math.max(64, Math.round(lh * scale));
    if (this.lightCanvas.width !== w || this.lightCanvas.height !== h) {
      this.lightCanvas.width = w;
      this.lightCanvas.height = h;
    }

    const lctx = this.lightCtx;
    const amb = Math.round(255 * (1 - darkness));
    lctx.globalCompositeOperation = 'source-over';
    lctx.fillStyle = `rgb(${amb}, ${Math.min(255, amb + 10)}, ${Math.min(255, amb + 24)})`;
    lctx.fillRect(0, 0, w, h);

    lctx.globalCompositeOperation = 'lighter';
    const addGlow = (sx: number, sy: number, rPx: number, color: string) => {
      const x = sx * scale;
      const y = sy * scale;
      const r = Math.max(6, rPx * scale);
      if (x < -r || x > w + r || y < -r || y > h + r) return;
      const g = lctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      lctx.fillStyle = g;
      lctx.fillRect(x - r, y - r, r * 2, r * 2);
    };

    for (let gy = y0; gy <= y1; gy++) {
      for (let gx = x0; gx <= x1; gx++) {
        if (this.world.getProp(gx, gy) === PROP_STREETLIGHT) {
          const p = this.worldToScreen(gx + 0.5, gy + 0.5, 0.2);
          addGlow(p.sx, p.sy, 115 * this.zoom, 'rgba(255, 214, 130, 0.62)');
        }
        if (this.world.getFire(gx, gy) > 0.25 && ((gx + gy) & 1) === 0) {
          const p = this.worldToScreen(gx + 0.5, gy + 0.5, 0.3);
          addGlow(p.sx, p.sy, 95 * this.zoom, 'rgba(255, 115, 30, 0.72)');
        }
      }
    }

    for (let i = 0; i < this.sim.count; i++) {
      if (isZombieRole(this.sim.uRole[i]) || this.sim.uHp[i] <= 0) continue;
      const ang = this.sim.uAngle[i];
      const p = this.worldToScreen(this.sim.ux[i] + Math.cos(ang) * 2.5, this.sim.uy[i] + Math.sin(ang) * 2.5, 0.2);
      addGlow(p.sx, p.sy, 95 * this.zoom, 'rgba(235, 245, 255, 0.52)');
    }

    for (const v of this.world.vehicles) {
      if (v.exploded) continue;
      if (v.headlightsOn || v.sirenOn || v.alarmTimer > 0) {
        const p = this.worldToScreen(v.x, v.y, 0.2);
        const col = v.sirenOn
          ? Math.floor(timeSec * 7) % 2 === 0
            ? 'rgba(255, 45, 85, 0.72)'
            : 'rgba(58, 134, 255, 0.72)'
          : 'rgba(255, 238, 175, 0.58)';
        addGlow(p.sx, p.sy, 130 * this.zoom, col);
      }
    }

    if (this.sim.heliActive) {
      const hp = this.worldToScreen(this.sim.heliX, this.sim.heliY, 0);
      addGlow(hp.sx, hp.sy, 240 * this.zoom, 'rgba(255, 252, 220, 0.85)');
    }

    this.ctx.save();
    this.ctx.globalCompositeOperation = 'multiply';
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.drawImage(this.lightCanvas, 0, 0, lw, lh);
    this.ctx.restore();
  }

  /**
   * Dynamic Infinite Open-World Radar Scan around current Camera `(camX, camY)`!
   */
  public renderMinimap(target: HTMLCanvasElement): void {
    const ctx = target.getContext('2d');
    if (!ctx) return;
    const W = target.width;
    const H = target.height;
    ctx.fillStyle = '#212b1f';
    ctx.fillRect(0, 0, W, H);

    const half = RADAR_SPAN * 0.5;
    const startWx = this.camX - half;
    const startWy = this.camY - half;
    const scale = W / RADAR_SPAN;

    // Sample terrain every 2 world tiles for ultra-fast infinite radar
    for (let dy = 0; dy < RADAR_SPAN; dy += 2) {
      const gy = Math.floor(startWy + dy);
      for (let dx = 0; dx < RADAR_SPAN; dx += 2) {
        const gx = Math.floor(startWx + dx);
        const flr = this.world.getFloor(gx, gy);
        if (flr === FLOOR_ASPHALT || flr === FLOOR_ROAD_LINE || flr === FLOOR_SIDEWALK) {
          ctx.fillStyle = '#4c5259';
          ctx.fillRect(Math.round(dx * scale), Math.round(dy * scale), 2, 2);
        } else if (flr === FLOOR_WATER) {
          ctx.fillStyle = '#2b5f7a';
          ctx.fillRect(Math.round(dx * scale), Math.round(dy * scale), 2, 2);
        }
      }
    }

    // Buildings in radar range
    for (const b of this.world.buildings) {
      const bx = (b.x0 - startWx) * scale;
      const by = (b.y0 - startWy) * scale;
      const bw = Math.max(3, b.w * scale);
      const bh = Math.max(3, b.h * scale);
      if (bx + bw < 0 || bx > W || by + bh < 0 || by > H) continue;
      ctx.fillStyle = b.safehouseSquad === 1 ? '#4cc9f0' : b.isSafehouse ? '#52b788' : '#8c6d53';
      ctx.fillRect(Math.round(bx), Math.round(by), Math.round(bw), Math.round(bh));
    }

    // Units radar dots
    for (let i = 0; i < this.sim.count; i++) {
      const px = (this.sim.ux[i] - startWx) * scale;
      const py = (this.sim.uy[i] - startWy) * scale;
      if (px < 0 || px >= W || py < 0 || py >= H) continue;
      ctx.fillStyle = isZombieRole(this.sim.uRole[i])
        ? '#ff4d4f'
        : this.sim.uSquad[i] === 1
          ? '#4cc9f0'
          : '#ffd466';
      ctx.fillRect(Math.round(px), Math.round(py), 2, 2);
    }

    // Center camera box
    ctx.strokeStyle = '#ffd466';
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(W * 0.5 - 8), Math.round(H * 0.5 - 6), 16, 12);
  }
}
