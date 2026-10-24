export interface KingdomPalette {
  name: string;
  main: string;
  dark: string;
  light: string;
  rgb: [number, number, number];
}

export const KINGDOM_PALETTES: readonly KingdomPalette[] = [
  { name: 'Рубин', main: '#e53945', dark: '#8f1923', light: '#ff7d87', rgb: [229, 57, 69] },
  { name: 'Сапфир', main: '#2d7ff9', dark: '#17469a', light: '#7db8ff', rgb: [45, 127, 249] },
  { name: 'Золото', main: '#f0b400', dark: '#996a00', light: '#ffe169', rgb: [240, 180, 0] },
  { name: 'Изумруд', main: '#24b463', dark: '#126837', light: '#6ee89e', rgb: [36, 180, 99] },
  { name: 'Пурпур', main: '#9b51e0', dark: '#56228f', light: '#d09eff', rgb: [155, 81, 224] },
  { name: 'Бирюза', main: '#10b7cc', dark: '#086775', light: '#6ff0ff', rgb: [16, 183, 204] },
];

const SKIN_TONES = ['#ffdbba', '#f3c196', '#d89b6c', '#9e6740'];
const HAIR_COLORS = ['#3b2416', '#dca338', '#8c371e', '#221d24'];

function hexToRgba(hex: string): [number, number, number, number] {
  const h = hex.startsWith('#') ? hex.slice(1) : hex;
  if (h.length === 6) {
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
      255,
    ];
  }
  return [255, 255, 255, 255];
}

/**
 * Pure integer-grid 16-bit Pixel Art buffer!
 * Every pixel has crisp alpha (0 or 255) — ZERO anti-aliasing blur at any zoom!
 */
class PixBuf {
  public readonly w: number;
  public readonly h: number;
  private readonly data: Uint8ClampedArray;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.data = new Uint8ClampedArray(w * h * 4);
  }

  public px(x: number, y: number, hex: string): void {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix < 0 || ix >= this.w || iy < 0 || iy >= this.h) return;
    const [r, g, b, a] = hexToRgba(hex);
    const o = (iy * this.w + ix) * 4;
    this.data[o] = r;
    this.data[o + 1] = g;
    this.data[o + 2] = b;
    this.data[o + 3] = a;
  }

  public rect(x: number, y: number, w: number, h: number, hex: string): void {
    const x0 = Math.round(x);
    const y0 = Math.round(y);
    const x1 = x0 + Math.round(w);
    const y1 = y0 + Math.round(h);
    const [r, g, b, a] = hexToRgba(hex);
    for (let py = y0; py < y1; py++) {
      if (py < 0 || py >= this.h) continue;
      for (let px = x0; px < x1; px++) {
        if (px < 0 || px >= this.w) continue;
        const o = (py * this.w + px) * 4;
        this.data[o] = r;
        this.data[o + 1] = g;
        this.data[o + 2] = b;
        this.data[o + 3] = a;
      }
    }
  }

  public hline(x0: number, x1: number, y: number, hex: string): void {
    const a = Math.min(Math.round(x0), Math.round(x1));
    const b = Math.max(Math.round(x0), Math.round(x1));
    this.rect(a, y, b - a + 1, 1, hex);
  }

  public line(x0: number, y0: number, x1: number, y1: number, hex: string): void {
    let ix0 = Math.round(x0);
    let iy0 = Math.round(y0);
    const ix1 = Math.round(x1);
    const iy1 = Math.round(y1);
    const dx = Math.abs(ix1 - ix0);
    const dy = Math.abs(iy1 - iy0);
    const sx = ix0 < ix1 ? 1 : -1;
    const sy = iy0 < iy1 ? 1 : -1;
    let err = dx - dy;
    for (;;) {
      this.px(ix0, iy0, hex);
      if (ix0 === ix1 && iy0 === iy1) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        ix0 += sx;
      }
      if (e2 < dx) {
        err += dx;
        iy0 += sy;
      }
    }
  }

  public ellipse(cx: number, cy: number, rx: number, ry: number, hex: string): void {
    const x0 = Math.floor(cx - rx - 1);
    const x1 = Math.ceil(cx + rx + 1);
    const y0 = Math.floor(cy - ry - 1);
    const y1 = Math.ceil(cy + ry + 1);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1.0) {
          this.px(x, y, hex);
        }
      }
    }
  }

  public tri(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    hex: string,
  ): void {
    const minX = Math.floor(Math.min(x0, x1, x2));
    const maxX = Math.ceil(Math.max(x0, x1, x2));
    const minY = Math.floor(Math.min(y0, y1, y2));
    const maxY = Math.ceil(Math.max(y0, y1, y2));
    const edge = (ax: number, ay: number, bx: number, by: number, px: number, py: number) =>
      (px - ax) * (by - ay) - (py - ay) * (bx - ax);
    const area = edge(x0, y0, x1, y1, x2, y2);
    if (Math.abs(area) < 0.001) return;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.01;
        const py = y + 0.01;
        const w0 = edge(x1, y1, x2, y2, px, py);
        const w1 = edge(x2, y2, x0, y0, px, py);
        const w2 = edge(x0, y0, x1, y1, px, py);
        if ((area > 0 && w0 >= 0 && w1 >= 0 && w2 >= 0) || (area < 0 && w0 <= 0 && w1 <= 0 && w2 <= 0)) {
          this.px(x, y, hex);
        }
      }
    }
  }

  /** Wraps every solid pixel region in a crisp 1-pixel outer outline! */
  public outline1px(hex = '#16121f'): void {
    const copy = new Uint8ClampedArray(this.data);
    const [r, g, b, a] = hexToRgba(hex);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const o = (y * this.w + x) * 4;
        if (copy[o + 3] > 0) continue;
        const hasN =
          (x > 0 && copy[o - 4 + 3] > 0) ||
          (x < this.w - 1 && copy[o + 4 + 3] > 0) ||
          (y > 0 && copy[o - this.w * 4 + 3] > 0) ||
          (y < this.h - 1 && copy[o + this.w * 4 + 3] > 0);
        if (hasN) {
          this.data[o] = r;
          this.data[o + 1] = g;
          this.data[o + 2] = b;
          this.data[o + 3] = a;
        }
      }
    }
  }

  public toCanvas(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = this.w;
    c.height = this.h;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.putImageData(new ImageData(new Uint8ClampedArray(this.data), this.w, this.h), 0, 0);
    return c;
  }
}

// ============================================================================
// CRISP 16-BIT PIXEL ART BUILDING & PROP BAKERS
// ============================================================================

function bakeWheatPixel(): HTMLCanvasElement {
  const b = new PixBuf(14, 16);
  // Stalks
  for (const sx of [3, 5, 7, 9, 10]) {
    b.rect(sx, 7, 1, 8, '#c6922c');
  }
  // Plump golden grain heads
  for (const [gx, gy] of [
    [2, 3],
    [5, 2],
    [7, 1],
    [9, 3],
    [11, 4],
  ]) {
    b.rect(gx, gy, 2, 5, '#f6ca44');
    b.px(gx, gy, '#fff08a');
    b.px(gx + 1, gy + 4, '#d19924');
  }
  b.outline1px('#2a1d0d');
  return b.toCanvas();
}

function bakeGoldPixel(): HTMLCanvasElement {
  const b = new PixBuf(16, 14);
  b.ellipse(8, 9, 5.5, 3.2, '#7d8797');
  b.ellipse(7, 8, 4.2, 2.4, '#9ba6b8');
  // Sparkling gold nuggets embedded in rock!
  b.rect(5, 5, 3, 3, '#ffd43b');
  b.rect(9, 7, 3, 3, '#fcc419');
  b.rect(4, 8, 2, 2, '#fab005');
  b.px(6, 5, '#fff9db');
  b.px(10, 7, '#fff9db');
  b.outline1px('#1a1622');
  return b.toCanvas();
}

function bakeTntPixel(): HTMLCanvasElement {
  const b = new PixBuf(16, 16);
  // 3 red dynamite sticks bundled with white label band
  b.rect(3, 5, 10, 9, '#e03131');
  b.rect(4, 5, 2, 9, '#ff6b6b');
  b.rect(10, 5, 2, 9, '#b02020');
  // White TNT stripe
  b.rect(3, 8, 10, 3, '#f8f9fa');
  b.px(5, 9, '#181818');
  b.px(8, 9, '#181818');
  b.px(11, 9, '#181818');
  // Fuse cord on top
  b.px(8, 3, '#d8c29d');
  b.px(9, 2, '#ffd43b');
  b.outline1px('#181218');
  return b.toCanvas();
}

function bakeCottagePixel(pal: KingdomPalette): HTMLCanvasElement {
  const b = new PixBuf(34, 32);
  // Olive drab military barracks
  b.rect(5, 15, 24, 13, '#6b7a3a');
  b.rect(22, 15, 7, 13, '#4b5320');
  b.rect(4, 26, 26, 3, '#3a3d2e');
  // Reinforced windows with bars
  b.rect(8, 18, 4, 4, '#2b2b2b');
  b.rect(9, 19, 2, 2, '#a0a8b0');
  b.rect(18, 18, 4, 4, '#2b2b2b');
  b.rect(19, 19, 2, 2, '#a0a8b0');
  // Steel door
  b.rect(12, 20, 6, 8, '#4a4a4a');
  b.rect(13, 21, 4, 6, '#6a6a6a');
  b.px(16, 24, '#ffd43b');
  // Flat camo roof with kingdom stripe
  b.rect(3, 12, 28, 4, pal.main);
  b.rect(3, 12, 28, 1, pal.light);
  b.rect(3, 15, 28, 1, pal.dark);
  // Antenna
  b.rect(25, 4, 1, 8, '#2b2b2b');
  b.px(25, 3, '#ff3d00');
  b.outline1px('#18131d');
  return b.toCanvas();
}

function bakeFarmPixel(pal: KingdomPalette): HTMLCanvasElement {
  const b = new PixBuf(44, 38);
  // Depot / Fuel storage + containers
  b.rect(4, 22, 20, 12, '#5a5a5a');
  b.rect(4, 22, 20, 2, '#7a7a7a');
  b.rect(7, 24, 5, 6, '#4a4a4a');
  b.rect(14, 24, 5, 6, '#4a4a4a');
  // Camo roof
  b.tri(2, 22, 13, 12, 24, 22, pal.main);
  b.line(3, 21, 13, 12, pal.light);
  // Fuel tanks on right
  b.ellipse(32, 28, 5, 5, '#3a3a3a');
  b.ellipse(32, 27, 4, 4, '#ff8f00');
  b.px(32, 25, '#ffd54f');
  b.rect(28, 32, 8, 3, '#2b2b2b');
  // Crates
  b.rect(30, 18, 6, 5, '#8d6e63');
  b.rect(31, 19, 4, 1, '#a1887f');
  b.rect(36, 20, 5, 5, '#6d4c41');
  b.outline1px('#18131d');
  return b.toCanvas();
}

function bakeTowerPixel(pal: KingdomPalette): HTMLCanvasElement {
  const b = new PixBuf(28, 42);
  // PVO SAM tower - concrete with radar
  b.rect(8, 14, 12, 25, '#78909c');
  b.rect(16, 14, 4, 25, '#546e7a');
  b.rect(7, 36, 14, 3, '#37474f');
  // Radar dish on top
  b.ellipse(14, 8, 9, 4, '#b0bec5');
  b.ellipse(14, 7, 7, 3, '#eceff1');
  b.px(14, 4, '#00bcd4');
  // SAM missiles vertical
  b.rect(10, 10, 2, 7, '#e0e0e0');
  b.px(11, 9, '#ff3d00');
  b.rect(16, 10, 2, 7, '#e0e0e0');
  b.px(17, 9, '#ff3d00');
  // Door
  b.rect(12, 32, 4, 7, '#263238');
  b.outline1px('#18131d');
  return b.toCanvas();
}

function bakeCastlePixel(pal: KingdomPalette): HTMLCanvasElement {
  const b = new PixBuf(52, 46);
  // HQ Command Center - modern concrete HQ with comms
  b.rect(12, 18, 28, 24, '#78909c');
  b.rect(32, 18, 8, 24, '#546e7a');
  b.rect(10, 40, 32, 3, '#37474f');
  // Flat roof with kingdom color stripe
  b.rect(10, 14, 32, 5, pal.main);
  b.rect(10, 14, 32, 1, pal.light);
  b.rect(10, 18, 32, 1, pal.dark);
  // Antennas and satellite dish
  b.rect(16, 6, 1, 8, '#263238'); b.px(16, 5, '#ff3d00');
  b.rect(26, 7, 1, 7, '#263238'); b.px(26, 6, '#00bcd4');
  b.ellipse(34, 10, 5, 4, '#eceff1'); b.ellipse(34, 9, 3, 2, '#90a4ae');
  // Gate
  b.rect(22, 30, 8, 12, '#263238');
  b.rect(24, 33, 4, 5, '#4a5a3a');
  // Windows
  b.rect(16, 22, 4, 4, '#2b2b2b'); b.rect(17, 23, 2, 2, '#81d4fa');
  b.rect(31, 22, 4, 4, '#2b2b2b'); b.rect(32, 23, 2, 2, '#81d4fa');
  b.outline1px('#18131d');
  return b.toCanvas();
}

function bakeSurvivorBasePixel(pal: KingdomPalette): HTMLCanvasElement {
  const b = new PixBuf(50, 44);
  // Concrete bunker with sandbags and camo net
  b.rect(10, 16, 30, 22, '#78909c');
  b.rect(30, 16, 10, 22, '#546e7a');
  for (let y = 18; y < 36; y += 4) { b.hline(10, 39, y, '#455a64'); }
  // Earth-covered roof
  b.rect(8, 12, 34, 5, '#5a6d3a');
  b.rect(8, 12, 34, 1, '#7a8a5a');
  b.rect(8, 16, 34, 1, '#3d4a2e');
  // Embrasures
  for (const wx of [15, 21, 27, 33]) { b.rect(wx, 20, 3, 3, '#1a1a1a'); b.px(wx+1,21,'#ff3d00'); }
  // Steel door
  b.rect(20, 26, 8, 12, '#37474f'); b.rect(21, 28, 6, 2, '#607d8b');
  // Sandbags
  b.rect(6, 36, 10, 4, '#8d7a5a'); b.rect(34, 36, 10, 4, '#8d7a5a');
  b.outline1px('#18131d');
  return b.toCanvas();
}

function bakeRuinsPixel(): HTMLCanvasElement {
  const b = new PixBuf(34, 24);
  // Ash scorched footprint
  b.ellipse(17, 18, 13, 4.2, '#3a3537');
  // Jagged broken stone wall remnants
  b.tri(6, 19, 8, 10, 14, 19, '#6c757d');
  b.tri(13, 19, 18, 8, 23, 19, '#495057');
  b.tri(20, 19, 26, 11, 29, 19, '#868e96');
  // Collapsed charred roof timbers + glowing embers!
  b.line(8, 17, 24, 11, '#2b1e19');
  b.line(9, 18, 25, 12, '#3d2920');
  b.line(11, 12, 26, 18, '#241814');
  b.px(15, 16, '#ff6b35');
  b.px(19, 15, '#ffd43b');
  b.px(8, 20, '#868e96');
  b.px(25, 20, '#868e96');
  b.outline1px('#161218');
  return b.toCanvas();
}

function bakeWallPixel(): HTMLCanvasElement {
  const b = new PixBuf(18, 18);
  for (const lx of [2, 6, 10, 14]) {
    b.rect(lx, 6, 3, 10, '#9e6234');
    b.px(lx, 7, '#bd7c46');
    b.tri(lx, 6, lx + 1, 2, lx + 3, 6, '#ebd0a7');
  }
  // Horizontal lashing crossbars
  b.rect(2, 9, 15, 2, '#693d1d');
  b.rect(2, 13, 15, 2, '#693d1d');
  b.outline1px('#181218');
  return b.toCanvas();
}


function bakeRadarPixel(pal: KingdomPalette): HTMLCanvasElement {
  const b = new PixBuf(32, 36);
  // Base concrete
  b.rect(10, 28, 12, 6, '#78909c');
  b.rect(8, 32, 16, 3, '#37474f');
  // Tower mast
  b.rect(15, 12, 2, 16, '#546e7a');
  b.rect(14, 10, 4, 3, '#607d8b');
  // Rotating dish
  b.ellipse(16, 8, 10, 3, '#eceff1');
  b.ellipse(16, 7, 8, 2, '#b0bec5');
  b.px(16, 5, '#00e676');
  // Side panels
  b.rect(8, 16, 5, 6, '#4a5a3a');
  b.rect(19, 16, 5, 6, '#4a5a3a');
  b.outline1px('#18131d');
  return b.toCanvas();
}

function bakeSiloPixel(pal: KingdomPalette): HTMLCanvasElement {
  const b = new PixBuf(28, 42);
  // Underground silo doors open
  b.rect(6, 30, 16, 8, '#37474f');
  b.rect(6, 28, 16, 3, '#78909c');
  // Missile inside
  b.rect(13, 10, 3, 18, '#e0e0e0');
  b.tri(13, 10, 14, 4, 16, 10, '#ff3d00');
  b.px(14, 14, '#ff3d00');
  b.rect(12, 24, 5, 2, '#ff3d00');
  // Doors
  b.rect(4, 26, 4, 10, '#546e7a');
  b.rect(20, 26, 4, 10, '#546e7a');
  b.px(5, 27, pal.main); b.px(21,27,pal.main);
  b.outline1px('#18131d');
  return b.toCanvas();
}

function bakeTankPixel(step: number): HTMLCanvasElement {
  const b = new PixBuf(28, 18);
  const s = step===0?0:1;
  // Tracks
  b.rect(3, 12, 22, 4, '#212121');
  b.rect(4+s, 13, 20, 2, '#424242');
  // Hull
  b.rect(5, 8, 18, 5, '#4b5320');
  b.rect(18, 8, 5, 5, '#3a3d2e');
  // Turret
  b.ellipse(10, 7, 5, 3, '#5a6d3a');
  b.rect(9, 6, 4, 2, '#6b7a3a');
  // Cannon
  b.rect(14, 6, 10, 2, '#212121');
  b.px(23,6,'#000000');
  // Wheels
  for(let x of [6,10,14,18]) b.ellipse(x,14,2,2,'#1a1a1a');
  b.outline1px('#0a0a0a');
  return b.toCanvas();
}

function bakeApcPixel(step: number): HTMLCanvasElement {
  const b = new PixBuf(26, 16);
  const s = step===0?0:1;
  b.rect(3, 10, 20, 4, '#212121');
  b.rect(5, 6, 16, 5, '#607d8b');
  b.rect(16, 6, 6, 5, '#455a64');
  // Turret MG
  b.rect(10, 4, 3, 2, '#37474f');
  b.rect(12, 3, 6, 1, '#212121');
  // Wheels
  for(let x of [7,12,17]) b.ellipse(x,13,2,2,'#1a1a1a');
  if(s) b.px(8,8,'#ffffff');
  b.outline1px('#0a0a0a');
  return b.toCanvas();
}

function bakeFpvDronePixel(phase: number): HTMLCanvasElement {
  const b = new PixBuf(22, 14);
  // Body X quad
  b.rect(9, 6, 4, 3, '#212121');
  b.rect(10, 5, 2, 5, '#424242');
  // Arms
  b.line(9,6, 2,2, '#616161'); b.line(13,6, 20,2, '#616161');
  b.line(9,8, 2,12, '#616161'); b.line(13,8, 20,12, '#616161');
  // Props spinning blur
  const propC = phase===0 ? '#e0e0e0' : '#90caf9';
  b.ellipse(2,2,3,1.5, propC); b.ellipse(20,2,3,1.5, propC);
  b.ellipse(2,12,3,1.5, propC); b.ellipse(20,12,3,1.5, propC);
  // Camera / payload
  b.px(11,7,'#ff3d00');
  b.outline1px('#000000');
  return b.toCanvas();
}

function bakeHelicopterPixelFrame(flap: number): HTMLCanvasElement {
  const b = new PixBuf(42, 22);
  // Fuselage
  b.rect(12, 8, 18, 6, '#4b5320');
  b.tri(28, 8, 38, 10, 28, 14, '#4b5320');
  b.rect(8, 9, 6, 4, '#81a1b0');
  b.px(9,10,'#b3e5fc');
  // Rotor blur
  if(flap===0){
    b.rect(4, 6, 34, 1, '#b0bec5');
    b.rect(6, 5, 30, 1, '#eceff1');
  } else {
    b.rect(6, 6, 30, 1, '#78909c');
  }
  // Tail rotor
  b.rect(36, 8, 1, 5, '#212121');
  // Skids
  b.rect(14,14,10,1,'#212121'); b.rect(12,15,2,2,'#212121'); b.rect(22,15,2,2,'#212121');
  // Weapons pylons
  b.rect(14,11,6,2,'#37474f'); b.rect(22,11,4,2,'#37474f');
  b.outline1px('#0a0a0a');
  return b.toCanvas();
}

function bakeCruiseMissilePixel(): HTMLCanvasElement {
  const b = new PixBuf(28, 10);
  b.rect(6, 4, 14, 3, '#e0e0e0');
  b.tri(20,4, 26,5, 20,7, '#e0e0e0');
  b.tri(6,4, 2,5, 6,7, '#ff3d00');
  b.rect(10,2,4,2,'#b0bec5'); b.rect(10,7,4,2,'#b0bec5');
  b.px(12,5,'#ff3d00');
  b.outline1px('#000000');
  return b.toCanvas();
}


function bakeDragonPixelFrame(flap: number): HTMLCanvasElement {
  // 68x50 true 16-bit RPG Boss Fire Dragon sprite (facing right)!
  const b = new PixBuf(68, 50);

  // Back wing (darker crimson membrane)
  if (flap === 0) {
    b.tri(24, 24, 16, 4, 38, 12, '#9e1c24');
    b.line(25, 23, 16, 4, '#f1e3c6');
  } else if (flap === 1) {
    b.tri(24, 24, 12, 13, 38, 17, '#9e1c24');
  } else {
    b.tri(24, 24, 15, 34, 37, 29, '#9e1c24');
  }

  // Long spiked tail curving left
  b.tri(5, 26, 25, 25, 25, 33, '#c92a2a');
  b.tri(12, 27, 25, 29, 25, 34, '#e03131');
  for (const sx of [9, 14, 19]) {
    b.tri(sx, 26, sx + 2, 22, sx + 4, 26, '#fff3bf');
  }

  // Muscular crimson dragon body + golden belly plates
  b.ellipse(33, 29, 12, 6.5, '#d92929');
  b.ellipse(34, 32, 10, 3.5, '#f6c945');
  for (let gx = 26; gx <= 41; gx += 3) {
    b.rect(gx, 31, 1, 4, '#d99b16');
  }

  // Rear & front clawed legs
  b.rect(25, 34, 4, 6, '#b82020');
  b.rect(27, 39, 4, 2, '#fff3bf');
  b.rect(38, 34, 4, 6, '#b82020');
  b.rect(40, 39, 4, 2, '#fff3bf');

  // Arched neck + horned dragon head with toothed open jaws!
  b.tri(39, 28, 46, 15, 48, 25, '#e03131');
  b.rect(45, 14, 13, 6, '#e03131');
  b.rect(46, 21, 11, 3, '#c92a2a');
  // Ivory swept-back horns
  b.line(46, 14, 40, 9, '#fff9db');
  b.line(47, 14, 41, 10, '#f3d9a4');
  // Glowing golden dragon eye + white fangs!
  b.rect(51, 16, 3, 2, '#ffec99');
  b.px(52, 16, '#d9480f');
  b.px(50, 20, '#ffffff');
  b.px(54, 20, '#ffffff');
  b.px(57, 20, '#ffffff');

  // Foreground main scalloped bat wing!
  if (flap === 0) {
    // High soaring upstroke!
    b.tri(27, 25, 22, 4, 43, 14, '#ff4d3d');
    b.tri(27, 25, 11, 10, 23, 5, '#e6352b');
    b.line(27, 25, 22, 4, '#fff3bf');
    b.line(27, 25, 12, 10, '#fff3bf');
    b.line(27, 25, 42, 14, '#fff3bf');
    b.rect(21, 3, 2, 2, '#ffffff');
  } else if (flap === 1) {
    // Wide glide!
    b.tri(27, 25, 10, 15, 41, 18, '#ff4d3d');
    b.tri(27, 25, 8, 23, 14, 15, '#e6352b');
    b.line(27, 25, 10, 15, '#fff3bf');
    b.line(27, 25, 41, 18, '#fff3bf');
  } else {
    // Powerful downstroke!
    b.tri(28, 24, 14, 38, 39, 34, '#ff4d3d');
    b.tri(28, 24, 24, 43, 39, 34, '#e6352b');
    b.line(28, 24, 14, 38, '#fff3bf');
    b.line(28, 24, 24, 43, '#fff3bf');
  }

  b.outline1px('#191118');
  return b.toCanvas();
}

// ============================================================================
// CRISP PIXEL-ART CREATURE SPRITE SHEETS (SHEEP, WOLF, ZOMBIE, SKELETON, HUMANS)
// ============================================================================

function bakeSheepPixel(step: number): HTMLCanvasElement {
  // 22x17 pure 16-bit fluffy sheep: ZERO black lines inside white fleece!
  const b = new PixBuf(22, 17);
  const legOff = step === 0 ? 0 : 1;
  // 4 cute dark hooves underneath
  b.rect(6 + legOff, 13, 2, 3, '#2d2424');
  b.rect(10 - legOff, 13, 2, 3, '#2d2424');
  b.rect(13 + legOff, 13, 2, 3, '#2d2424');
  b.rect(16 - legOff, 13, 2, 3, '#2d2424');

  // Fluffy cloud body (soft bottom shadow + pure white cloud bumps)
  b.ellipse(10, 9, 6.2, 4.4, '#e3e7ee');
  b.ellipse(10, 8, 5.8, 3.8, '#ffffff');
  b.ellipse(6, 8, 2.8, 2.6, '#ffffff');
  b.ellipse(10, 5.5, 3.4, 2.5, '#ffffff');
  b.ellipse(14, 7, 3.0, 2.8, '#ffffff');

  // Cute dark-brown sheep head on right + floppy ear + white pixel eye!
  b.ellipse(17, 7.5, 2.7, 2.4, '#3b2e2c');
  b.rect(14, 6, 2, 2, '#2a201f'); // ear
  b.px(18, 7, '#ffffff'); // bright eye!

  // Outer 1px pixel outline wraps ONLY the outside silhouette!
  b.outline1px('#18131d');
  return b.toCanvas();
}

function bakeWolfPixel(step: number): HTMLCanvasElement {
  // 24x17 crisp two-tone Timber Wolf!
  const b = new PixBuf(24, 17);
  const s = step === 0 ? 0 : 1;
  // Bushy tail on left
  b.line(2, 9, 6, 8, '#667080');
  b.line(2, 10, 6, 9, '#8590a2');
  b.px(2, 10, '#cfd6e2');

  // Running legs
  b.rect(7 - s, 11, 2, 4, '#4c5462');
  b.rect(10 + s, 11, 2, 4, '#667080');
  b.rect(14 - s, 11, 2, 4, '#4c5462');
  b.rect(17 + s, 11, 2, 4, '#667080');

  // Lean wolf torso & chest ruff
  b.rect(6, 7, 12, 5, '#6d7788');
  b.rect(7, 10, 10, 2, '#aeb7c6');
  b.rect(14, 6, 4, 5, '#7d889a');

  // Pointed wolf ears + long snout + black nose + glowing yellow eye!
  b.rect(16, 4, 5, 5, '#6d7788');
  b.rect(19, 6, 4, 3, '#7d889a');
  b.px(16, 2, '#4c5462');
  b.px(16, 3, '#6d7788');
  b.px(19, 2, '#4c5462');
  b.px(19, 3, '#8590a2');
  b.px(22, 6, '#141418'); // black nose
  b.px(19, 5, '#ffd43b'); // yellow wolf eye!

  b.outline1px('#16121c');
  return b.toCanvas();
}

function bakeZombiePixel(step: number): HTMLCanvasElement {
  // 20x22 crisp Pixel Zombie: vivid green head, red eyes, torn bloody shirt, TWO outstretched green arms!
  const b = new PixBuf(20, 22);
  const s = step === 0 ? 0 : 1;
  // Shuffling dark boots & pants
  b.rect(6 - s, 16, 3, 4, '#36404e');
  b.rect(10 + s, 16, 3, 4, '#2b3340');
  b.rect(6 - s, 19, 4, 2, '#1f1a1c');
  b.rect(10 + s, 19, 4, 2, '#1f1a1c');

  // Torn dark shirt + crimson bloodstain
  b.rect(6, 10, 7, 7, '#4f4640');
  b.rect(9, 11, 3, 3, '#c92a2a');
  b.px(10, 14, '#e03131');

  // Vivid zombie lime-green head (tilted slightly forward)
  b.rect(7, 4, 7, 6, '#76dd46');
  b.rect(7, 4, 6, 1, '#9bf06b');
  b.rect(7, 4, 2, 2, '#b02525'); // head wound
  // Glowing red-yellow eyes + dark open mouth!
  b.px(10, 6, '#ffec99');
  b.px(11, 6, '#ff1e1e');
  b.px(13, 6, '#ff1e1e');
  b.rect(11, 8, 3, 2, '#3b1114');

  // BOTH GREEN ZOMBIE ARMS STRETCHED STRAIGHT OUT FORWARD!
  b.rect(11, 9 + s, 7, 2, '#5cb832');
  b.rect(10, 11 - s, 8, 2, '#82e650');

  b.outline1px('#15111a');
  return b.toCanvas();
}

function bakeSkeletonPixel(step: number): HTMLCanvasElement {
  // 21x22 crisp Pixel Skeleton Warrior: white skull, ribcage, curved scimitar & buckler shield!
  const b = new PixBuf(21, 22);
  const s = step === 0 ? 0 : 1;
  // Bony legs
  b.rect(7 - s, 16, 2, 4, '#ebe8df');
  b.rect(11 + s, 16, 2, 4, '#d8d4c8');

  // Ribcage & spine
  b.rect(7, 10, 6, 6, '#231f26');
  b.rect(9, 10, 2, 6, '#f8f6f0');
  b.hline(7, 12, 11, '#f8f6f0');
  b.hline(7, 12, 13, '#f8f6f0');
  b.hline(8, 11, 15, '#e5e1d6');

  // Crisp white skull + hollow eye sockets
  b.rect(7, 4, 7, 6, '#f8f6f0');
  b.rect(9, 6, 2, 2, '#18141c');
  b.rect(12, 6, 2, 2, '#18141c');
  b.hline(9, 13, 9, '#cfc9bc');

  // Wooden round shield + raised silver scimitar!
  b.ellipse(7, 13, 2.5, 2.5, '#8c5832');
  b.px(7, 13, '#ced4da');
  b.line(13, 13, 18, 6 + s, '#e9ecef');
  b.line(14, 13, 19, 7 + s, '#adb5bd');
  b.px(13, 13, '#ffd43b');

  b.outline1px('#15111a');
  return b.toCanvas();
}

function flipCanvasHorizontal(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.translate(src.width, 0);
  g.scale(-1, 1);
  g.drawImage(src, 0, 0);
  return c;
}

const HUMAN_SPRITE_W = 20;
const HUMAN_SPRITE_H = 26;
const HUMAN_ANCHOR_X = 9;
const HUMAN_ANCHOR_Y = 24;

function bakeHumanPixelSprite(
  kIdx: number,
  role: number,
  skinIdx: number,
  hairIdx: number,
  strawHat: boolean,
  equipMode: number, // 0=idle arm, 1=wood, 2=sword, 3=swordSwing, 4=bow, 5=axe, 6=axeSwing
  waterMode: number, // 0=land, 1=rowboat, 2=drowning0, 3=drowning1
  infected: boolean,
  stepFrame: number,
): HTMLCanvasElement {
  const b = new PixBuf(HUMAN_SPRITE_W, HUMAN_SPRITE_H);
  const pal = KINGDOM_PALETTES[kIdx % KINGDOM_PALETTES.length];
  const skin = infected ? '#a9e378' : SKIN_TONES[skinIdx & 3];
  const hair = HAIR_COLORS[hairIdx & 3];
  const isKnight = role === 1;
  const isArcher = role === 2;
  const stride = stepFrame === 0 ? 1 : -1;

  const P = (gx: number, gy: number, gw: number, gh: number, col: string) => {
    b.rect(HUMAN_ANCHOR_X + gx, HUMAN_ANCHOR_Y + gy, gw, gh, col);
  };

  if (waterMode >= 2) {
    // Drowning in flood / ocean (CANT_SWIM trait): frantic splashing water & raised arms!
    P(-5, -2, 10, 3, '#a5f3fc');
    P(-7, -4, 2, 2, '#ffffff');
    P(5, -5, 2, 2, '#ffffff');
    P(-4, -9, 8, 6, '#16121f');
    P(-3, -8, 6, 4, pal.main);
    P(-4, -15, 8, 7, '#16121f');
    P(-3, -14, 6, 5, skin);
    P(0, -12, 1, 1, '#16121f');
    P(2, -12, 1, 1, '#16121f');
    const wave = waterMode === 3 ? 1 : 0;
    P(-5, -16 - wave, 2, 6, skin);
    P(3, -15 + wave, 2, 6, skin);
    return b.toCanvas();
  }

  if (waterMode === 1) {
    P(-7, -5, 14, 5, '#16121f');
    P(-6, -4, 12, 3, '#8b572a');
    P(-5, -3, 10, 1, '#b07440');
  } else {
    P(-3 - stride, -5, 4, 5, '#16121f');
    P(0 + stride, -5, 4, 5, '#16121f');
    P(-2 - stride, -4, 2, 3, '#49382e');
    P(1 + stride, -4, 2, 3, '#3b2c24');
    P(-2 - stride, -1, 3, 1, '#1f1715');
    P(1 + stride, -1, 3, 1, '#1f1715');
  }

  P(-4, -12, 8, 8, '#16121f');
  if (isKnight) {
    P(-3, -11, 6, 6, '#dee2e6');
    P(-3, -11, 2, 6, '#ffffff');
    P(-3, -7, 6, 2, pal.main);
  } else {
    P(-3, -11, 6, 6, pal.main);
    P(-3, -11, 2, 5, pal.light);
    P(-3, -6, 6, 1, '#3b2c24');
  }

  P(-4, -19, 8, 8, '#16121f');
  P(-3, -18, 6, 6, skin);
  P(0, -15, 1, 2, '#16121f');
  P(2, -15, 1, 2, '#16121f');

  if (isKnight) {
    P(-4, -20, 8, 5, '#16121f');
    P(-3, -19, 6, 4, '#e9ecef');
    P(-1, -16, 4, 1, '#212529');
    P(-4, -22, 4, 3, pal.main);
    P(-3, -22, 2, 2, pal.light);
  } else if (isArcher) {
    P(-4, -19, 8, 4, pal.dark);
    P(-3, -19, 6, 2, pal.main);
  } else if (strawHat) {
    P(-6, -18, 12, 2, '#16121f');
    P(-5, -18, 10, 1, '#ffd43b');
    P(-3, -20, 6, 2, '#fab005');
  } else {
    P(-3, -19, 6, 2, hair);
    P(-3, -17, 2, 3, hair);
  }

  if (equipMode === 1) {
    P(-5, -14, 10, 4, '#16121f');
    P(-4, -13, 8, 2, '#7c4d2b');
    P(3, -13, 1, 2, '#f3d9a4');
  } else if (equipMode === 2 || equipMode === 3) {
    const swing = equipMode === 3 ? 2 : 0;
    P(4, -20 + swing, 3, 10, '#16121f');
    P(5, -19 + swing, 1, 8, '#f8f9fa');
    P(3, -12 + swing, 5, 1, '#ffd43b');
    P(-6, -12, 5, 7, '#16121f');
    P(-5, -11, 3, 5, pal.main);
    P(-4, -10, 1, 3, '#ffffff');
  } else if (equipMode === 4) {
    P(3, -15, 2, 9, '#7c4d2b');
    P(2, -16, 2, 2, '#7c4d2b');
    P(2, -7, 2, 2, '#7c4d2b');
    P(2, -11, 6, 1, '#f8f9fa');
    P(7, -12, 2, 3, '#ced4da');
  } else if (equipMode === 5 || equipMode === 6) {
    const chop = equipMode === 6 ? 3 : 0;
    P(3, -15 + chop, 2, 7, '#7c4d2b');
    P(4, -16 + chop, 4, 3, '#ced4da');
    P(7, -16 + chop, 1, 3, '#ffffff');
  } else {
    P(1, -10, 2, 4, skin);
  }

  return b.toCanvas();
}

/**
 * ПИКСЕЛЬНОЕ РАЗРУШЕНИЕ: выбивает из спрайта отдельные пиксели (осколки/пробоины),
 * оставляя рваные края и тёмную копоть. Работает на уровне реальных пикселей спрайта!
 */
function erodeCanvas(src: HTMLCanvasElement, level: number, seed: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  let s = seed * 9301 + 49297;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const keepChance = level === 1 ? 0.74 : 0.42;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      const o = (y * c.width + x) * 4;
      if (d[o + 3] === 0) continue;
      const r = rnd();
      // нижние ряды разрушаются сильнее — здание «оседает»
      const bias = 1 - (y / c.height) * (level === 1 ? 0.18 : 0.34);
      if (r > keepChance * bias) {
        d[o + 3] = 0; // настоящая пробоина — сквозь неё видно землю!
        continue;
      }
      if (r > keepChance * bias - 0.22) {
        // копоть и сколы по краям пробоин
        d[o] = Math.max(0, d[o] * 0.45);
        d[o + 1] = Math.max(0, d[o + 1] * 0.42);
        d[o + 2] = Math.max(0, d[o + 2] * 0.44);
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export class ModelAtlas {
  public readonly treeSprites: HTMLCanvasElement[] = [];
  public readonly stumpSprite: HTMLCanvasElement;
  public readonly wheatSprite: HTMLCanvasElement;
  public readonly flowerSprite: HTMLCanvasElement;
  public readonly cottageSprites: HTMLCanvasElement[] = [];
  public readonly farmSprites: HTMLCanvasElement[] = [];
  public readonly towerSprites: HTMLCanvasElement[] = [];
  public readonly castleSprites: HTMLCanvasElement[] = [];
  public readonly baseSprites: HTMLCanvasElement[] = [];
  public readonly ruinSprite: HTMLCanvasElement;
  public readonly wallSprite: HTMLCanvasElement;
  public readonly radarSprites: HTMLCanvasElement[] = [];
  public readonly siloSprites: HTMLCanvasElement[] = [];
  public readonly dragonSprites: HTMLCanvasElement[] = [];
  public readonly helicopterSprites: HTMLCanvasElement[] = [];
  public readonly tankSprites: HTMLCanvasElement[] = [];
  public readonly tankSpritesFlip: HTMLCanvasElement[] = [];
  public readonly apcSprites: HTMLCanvasElement[] = [];
  public readonly apcSpritesFlip: HTMLCanvasElement[] = [];
  public readonly fpvDroneSprites: HTMLCanvasElement[] = [];
  public readonly cruiseSprite: HTMLCanvasElement;
  public readonly sheepSprites: HTMLCanvasElement[] = [];
  public readonly sheepSpritesFlip: HTMLCanvasElement[] = [];
  public readonly wolfSprites: HTMLCanvasElement[] = [];
  public readonly wolfSpritesFlip: HTMLCanvasElement[] = [];
  public readonly zombieSprites: HTMLCanvasElement[] = [];
  public readonly zombieSpritesFlip: HTMLCanvasElement[] = [];
  public readonly skeletonSprites: HTMLCanvasElement[] = [];
  public readonly skeletonSpritesFlip: HTMLCanvasElement[] = [];
  public readonly humanCache = new Map<number, HTMLCanvasElement>();
  public readonly tntSprite: HTMLCanvasElement;
  public readonly goldSprite: HTMLCanvasElement;
  private readonly dmgCache = new Map<number, HTMLCanvasElement>();
  private readonly spriteBank: HTMLCanvasElement[][] = [];

  constructor() {
    this.wheatSprite = bakeWheatPixel();
    this.stumpSprite = bakeWallPixel();
    this.flowerSprite = bakeWheatPixel();
    this.ruinSprite = bakeRuinsPixel();
    this.wallSprite = bakeWallPixel();
    this.goldSprite = bakeGoldPixel();
    this.tntSprite = bakeTntPixel();
    this.cruiseSprite = bakeCruiseMissilePixel();

    for (const pal of KINGDOM_PALETTES) {
      this.cottageSprites.push(bakeCottagePixel(pal));
      this.farmSprites.push(bakeFarmPixel(pal));
      this.towerSprites.push(bakeTowerPixel(pal));
      this.castleSprites.push(bakeCastlePixel(pal));
      this.baseSprites.push(bakeSurvivorBasePixel(pal));
      this.radarSprites.push(bakeRadarPixel(pal));
      this.siloSprites.push(bakeSiloPixel(pal));
    }

    this.dragonSprites = [
      bakeDragonPixelFrame(0),
      bakeDragonPixelFrame(1),
      bakeDragonPixelFrame(2),
    ];
    this.helicopterSprites = [
      bakeHelicopterPixelFrame(0),
      bakeHelicopterPixelFrame(1),
      bakeHelicopterPixelFrame(0),
    ];
    this.tankSprites = [bakeTankPixel(0), bakeTankPixel(1)];
    this.tankSpritesFlip = this.tankSprites.map(flipCanvasHorizontal);
    this.apcSprites = [bakeApcPixel(0), bakeApcPixel(1)];
    this.apcSpritesFlip = this.apcSprites.map(flipCanvasHorizontal);
    this.fpvDroneSprites = [bakeFpvDronePixel(0), bakeFpvDronePixel(1)];

    // Банк спрайтов зданий для попиксельного разрушения
    this.spriteBank[1] = this.stumpSprite ? [this.stumpSprite] : [this.cottageSprites[0]];
    this.spriteBank[2] = this.cottageSprites;   // казарма
    this.spriteBank[3] = this.castleSprites;    // штаб
    this.spriteBank[4] = this.farmSprites;      // склад ГСМ
    this.spriteBank[5] = this.towerSprites;     // ПВО
    this.spriteBank[6] = [this.ruinSprite];
    this.spriteBank[7] = this.baseSprites;      // бункер
    this.spriteBank[8] = [this.wallSprite];
    this.spriteBank[9] = this.radarSprites;     // РЛС
    this.spriteBank[10] = this.siloSprites;     // шахта
    this.sheepSprites = [bakeSheepPixel(0), bakeSheepPixel(1)];
    this.sheepSpritesFlip = this.sheepSprites.map(flipCanvasHorizontal);
    this.wolfSprites = [bakeWolfPixel(0), bakeWolfPixel(1)];
    this.wolfSpritesFlip = this.wolfSprites.map(flipCanvasHorizontal);
    this.zombieSprites = [bakeZombiePixel(0), bakeZombiePixel(1)];
    this.zombieSpritesFlip = this.zombieSprites.map(flipCanvasHorizontal);
    this.skeletonSprites = [bakeSkeletonPixel(0), bakeSkeletonPixel(1)];
    this.skeletonSpritesFlip = this.skeletonSprites.map(flipCanvasHorizontal);
  }

  /**
   * Возвращает спрайт здания с ПОПИКСЕЛЬНЫМИ разрушениями.
   * stage: 0 = целое, 1 = пробоины, 2 = полуразрушено (каркас)
   */
  public getDamagedBuilding(kind: number, kIdx: number, stage: number): HTMLCanvasElement {
    const bank = this.spriteBank[kind] || this.spriteBank[2];
    const base = bank[kIdx % bank.length];
    if (stage <= 0) return base;
    const key = (kind & 15) | ((kIdx & 7) << 4) | ((stage & 3) << 7);
    const cached = this.dmgCache.get(key);
    if (cached) return cached;
    const eroded = erodeCanvas(base, stage, key + 17);
    this.dmgCache.set(key, eroded);
    return eroded;
  }

  public getHumanSprite(
    kIdx: number,
    role: number,
    skinIdx: number,
    hairIdx: number,
    strawHat: boolean,
    equipMode: number,
    waterMode: number,
    infected: boolean,
    stepFrame: number,
    flipped: boolean,
  ): HTMLCanvasElement {
    const baseKey =
      (kIdx & 7) |
      ((role & 3) << 3) |
      ((skinIdx & 3) << 5) |
      ((hairIdx & 3) << 7) |
      ((strawHat ? 1 : 0) << 9) |
      ((equipMode & 7) << 10) |
      ((waterMode & 3) << 13) |
      ((infected ? 1 : 0) << 15) |
      ((stepFrame & 1) << 16);
    const fullKey = baseKey | ((flipped ? 1 : 0) << 17);
    let spr = this.humanCache.get(fullKey);
    if (spr) return spr;

    let rightSpr = this.humanCache.get(baseKey);
    if (!rightSpr) {
      rightSpr = bakeHumanPixelSprite(
        kIdx,
        role,
        skinIdx,
        hairIdx,
        strawHat,
        equipMode,
        waterMode,
        infected,
        stepFrame,
      );
      this.humanCache.set(baseKey, rightSpr);
    }
    if (!flipped) return rightSpr;
    spr = flipCanvasHorizontal(rightSpr);
    this.humanCache.set(fullKey, spr);
    return spr;
  }
}

// Singleton cache reference for unit helpers when drawing dynamically
let sharedAtlas: ModelAtlas | null = null;
function getSharedAtlas(): ModelAtlas {
  if (!sharedAtlas) sharedAtlas = new ModelAtlas();
  return sharedAtlas;
}

export function drawCampfireHD(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  scale: number,
  time: number,
  seed: number,
): void {
  const p = Math.max(1, Math.round(scale * 0.28));
  const ox = Math.round(sx);
  const oy = Math.round(sy);
  const flick = Math.floor(time * 9 + seed) % 3;

  // Stone ring & crossed wood logs
  ctx.fillStyle = '#495057';
  ctx.fillRect(ox - 4 * p, oy - p, 8 * p, 2 * p);
  ctx.fillStyle = '#6c4428';
  ctx.fillRect(ox - 3 * p, oy - 2 * p, 6 * p, p);

  // Pixel fire core!
  ctx.fillStyle = '#e8590c';
  ctx.fillRect(ox - 2 * p, oy - (5 + flick) * p, 4 * p, (3 + flick) * p);
  ctx.fillStyle = '#ffd43b';
  ctx.fillRect(ox - p, oy - (4 + flick) * p, 2 * p, (2 + flick) * p);
  ctx.fillStyle = '#fff9db';
  ctx.fillRect(ox - p, oy - 3 * p, p, p);
}

export function drawWindmillSails(
  ctx: CanvasRenderingContext2D,
  hubX: number,
  hubY: number,
  radius: number,
  angle: number,
): void {
  // Snap windmill rotation to crisp pixel-art steps so blades stay pure pixel art!
  const p = Math.max(1, Math.round(radius * 0.14));
  const steps = 16;
  const snapped = (Math.round((angle / (Math.PI * 2)) * steps) / steps) * Math.PI * 2;
  const hx = Math.round(hubX);
  const hy = Math.round(hubY);

  for (let arm = 0; arm < 4; arm++) {
    const a = snapped + arm * (Math.PI * 0.5);
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const segs = Math.max(4, Math.round(radius / p));
    for (let s = 1; s <= segs; s++) {
      const px = hx + Math.round(cos * s * p);
      const py = hy + Math.round(sin * s * p);
      ctx.fillStyle = '#3d2516';
      ctx.fillRect(px, py, p, p);
      if (s >= 2) {
        const sx2 = px + Math.round(-sin * p);
        const sy2 = py + Math.round(cos * p);
        ctx.fillStyle = '#f8f9fa';
        ctx.fillRect(sx2, sy2, p, p);
      }
    }
  }
  ctx.fillStyle = '#24160e';
  ctx.fillRect(hx - p, hy - p, 2 * p, 2 * p);
}

export function drawWavingFlag(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  pal: KingdomPalette,
  time: number,
  seed: number,
): void {
  const p = Math.max(1, Math.round(h * 0.22));
  const bx = Math.round(x);
  const by = Math.round(y);
  // Pixel pole
  ctx.fillStyle = '#2b211b';
  ctx.fillRect(bx, by - 3 * p, p, 6 * p);
  // Pixel waving banner segments!
  const cols = Math.max(3, Math.round(w / p));
  for (let c = 0; c < cols; c++) {
    const wave = Math.round(Math.sin(time * 6 + seed + c * 0.9)) * p;
    ctx.fillStyle = c === 0 ? pal.light : c === cols - 1 ? pal.dark : pal.main;
    ctx.fillRect(bx + (c + 1) * p, by - 3 * p + wave, p, 3 * p);
  }
}

/**
 * Pure Crisp 16-Bit Pixel Art Unit Renderer!
 * Renders Sheep, Wolves, Zombies, Skeletons, Villagers, Knights & Archers on exact integer pixels!
 */
export function drawVillagerHD(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  groundSy: number,
  scale: number,
  kingdom: number,
  state: number,
  wood: number,
  chopProgress: number,
  facing: number,
  walkPhase: number,
  variant: number,
  role = 0,
  inWater = false,
  hpRatio = 1.0,
  blessed = false,
  infected = false,
  sizeMult = 1.0,
  drowning = false,
  selected = false,
): void {
  const atlas = getSharedAtlas();
  const effScale = scale * sizeMult;
  const stepFrame = Math.sin(walkPhase) >= 0 ? 0 : 1;

  // Crisp pixel ground shadow
  const shW = Math.max(4, Math.round(effScale * 0.95));
  const shH = Math.max(2, Math.round(effScale * 0.3));
  ctx.fillStyle = 'rgba(10, 16, 22, 0.34)';
  ctx.fillRect(Math.round(sx - shW * 0.5), Math.round(groundSy - shH * 0.5), shW, shH);

  // Pixel infection / blessing ground aura
  if (infected && role <= 2) {
    ctx.fillStyle = '#80ed18';
    ctx.fillRect(Math.round(sx - shW * 0.65), Math.round(groundSy), shW + 4, 2);
  } else if (blessed) {
    ctx.fillStyle = '#ffe066';
    ctx.fillRect(Math.round(sx - shW * 0.65), Math.round(groundSy), shW + 4, 2);
  }

  // Selected unit crisp golden WorldBox pixel brackets!
  if (selected) {
    const p = Math.max(2, Math.round(effScale * 0.16));
    const bx = Math.round(sx - effScale * 0.9);
    const by = Math.round(sy - effScale * 1.9);
    const bw = Math.round(effScale * 1.8);
    const bh = Math.round(effScale * 2.1);
    ctx.fillStyle = '#ffe066';
    ctx.fillRect(bx, by, 2 * p, p);
    ctx.fillRect(bx, by, p, 2 * p);
    ctx.fillRect(bx + bw - 2 * p, by, 2 * p, p);
    ctx.fillRect(bx + bw - p, by, p, 2 * p);
    ctx.fillRect(bx, by + bh, 2 * p, p);
    ctx.fillRect(bx, by + bh - p, p, 2 * p);
    ctx.fillRect(bx + bw - 2 * p, by + bh, 2 * p, p);
    ctx.fillRect(bx + bw - p, by + bh - p, p, 2 * p);
  }

  // Baked pixel-art sprites for Sheep (5), Wolf (6), Zombie (3), Skeleton (4) — ZERO matrix push/pop!
  if (role === 5 || role === 6 || role === 3 || role === 4) {
    const flip = facing < 0;
    const spr =
      role === 5
        ? (flip ? atlas.sheepSpritesFlip : atlas.sheepSprites)[stepFrame]
        : role === 6
          ? (flip ? atlas.wolfSpritesFlip : atlas.wolfSprites)[stepFrame]
          : role === 3
            ? (flip ? atlas.zombieSpritesFlip : atlas.zombieSprites)[stepFrame]
            : (flip ? atlas.skeletonSpritesFlip : atlas.skeletonSprites)[stepFrame];
    const mult = role === 5 || role === 6 ? 1.65 : 1.78;
    const dw = Math.max(12, Math.round(effScale * mult));
    const dh = Math.max(10, Math.round(dw * (spr.height / spr.width)));
    const bob = state === 2 ? 0 : Math.round(Math.abs(Math.sin(walkPhase)) * 1.5);

    ctx.drawImage(spr, Math.round(sx - dw * 0.5), Math.round(sy - bob - dh * 0.92), dw, dh);

    if (hpRatio < 0.99 && (role === 3 || role === 4)) {
      const bw = Math.max(10, Math.round(effScale * 1.2));
      const bx = Math.round(sx - bw * 0.5);
      const by = Math.round(sy - dh - 4);
      ctx.fillStyle = '#14181f';
      ctx.fillRect(bx - 1, by - 1, bw + 2, 4);
      ctx.fillStyle = role === 3 ? '#9ef01a' : '#ffd43b';
      ctx.fillRect(bx, by, Math.max(1, Math.round(bw * hpRatio)), 2);
    }
    return;
  }

  // ── CRISP CACHED PIXEL ART HUMANS: VILLAGER (0), KNIGHT (1), ARCHER (2)! ──
  const pf = Math.max(0.75, effScale * 0.105);
  const skinIdx = variant & 3;
  const hairIdx = (variant >> 2) & 3;
  const strawHat = role === 0 && ((variant >> 4) & 3) === 0;
  const bob = inWater ? 0 : Math.abs(Math.sin(walkPhase)) > 0.55 ? Math.max(1, Math.round(pf)) : 0;

  let waterMode = 0;
  if (inWater && drowning) {
    waterMode = Math.sin(walkPhase * 3) > 0 ? 3 : 2;
  } else if (inWater) {
    waterMode = 1;
  }

  let equipMode = 0;
  if (wood > 0) {
    equipMode = 1;
  } else if (role === 1) {
    equipMode = state === 4 && Math.sin(chopProgress * 12) > 0 ? 3 : 2;
  } else if (role === 2) {
    equipMode = 4;
  } else if (state === 1 || state === 2 || state === 4) {
    equipMode = (state === 2 || state === 4) && Math.sin(chopProgress * 11) > 0 ? 6 : 5;
  }

  const flip = facing < 0;
  const spr = atlas.getHumanSprite(
    kingdom % KINGDOM_PALETTES.length,
    role,
    skinIdx,
    hairIdx,
    strawHat,
    equipMode,
    waterMode,
    infected,
    stepFrame,
    flip,
  );
  const anchorX = flip ? HUMAN_SPRITE_W - HUMAN_ANCHOR_X : HUMAN_ANCHOR_X;
  const dw = Math.max(8, Math.round(HUMAN_SPRITE_W * pf));
  const dh = Math.max(10, Math.round(HUMAN_SPRITE_H * pf));
  ctx.drawImage(
    spr,
    Math.round(sx - anchorX * pf),
    Math.round(sy - bob - HUMAN_ANCHOR_Y * pf),
    dw,
    dh,
  );

  if (hpRatio < 0.99 && waterMode < 2) {
    const bw = Math.max(10, Math.round(effScale * 1.15));
    const bx = Math.round(sx - bw * 0.5);
    const by = Math.round(sy - 23 * pf);
    ctx.fillStyle = '#14181f';
    ctx.fillRect(bx - 1, by - 1, bw + 2, 4);
    ctx.fillStyle = '#51cf66';
    ctx.fillRect(bx, by, Math.max(1, Math.round(bw * hpRatio)), 2);
  }
}

export function drawDragonHD(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  groundSy: number,
  scale: number,
  facing: number,
  time: number,
  hpRatio: number,
  dragonSprites?: HTMLCanvasElement[],
): void {
  // Crisp stepped pixel oval ground shadow under flying Dragon!
  const sw = Math.round(scale * 2.6);
  const sh = Math.max(4, Math.round(scale * 0.72));
  const shX = Math.round(sx - sw * 0.5);
  const shY = Math.round(groundSy - sh * 0.5);
  ctx.fillStyle = 'rgba(8, 12, 18, 0.30)';
  ctx.fillRect(shX + 4, shY, sw - 8, sh);
  ctx.fillRect(shX, shY + 2, sw, Math.max(2, sh - 4));

  const bob = Math.round(Math.sin(time * 5.8) * scale * 0.14);

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(sx), Math.round(sy + bob));
  ctx.scale(facing >= 0 ? 1 : -1, 1);

  if (dragonSprites && dragonSprites.length >= 3) {
    const beat = Math.floor(time * 6.5) & 3;
    const frameIdx = beat === 0 ? 0 : beat === 2 ? 2 : 1;
    const spr = dragonSprites[frameIdx];
    const drawW = Math.round(scale * 4.5);
    const drawH = Math.round(drawW * (spr.height / spr.width));
    ctx.drawImage(spr, Math.round(-drawW * 0.47), Math.round(-drawH * 0.58), drawW, drawH);

    // Crisp Pixel Dragonfire Breath Stream!
    const p = Math.max(2, Math.round(drawW / 68));
    const mx = Math.round(drawW * 0.39);
    const my = Math.round(-drawH * 0.12);
    const flick = Math.floor(time * 16) % 2;
    for (let step = 0; step < 8; step++) {
      const fx = mx + step * 2 * p;
      const fy = my + step * p + (step % 2 === flick ? p : 0);
      const sz = (2 + Math.floor(step * 0.6)) * p;
      ctx.fillStyle = step < 2 ? '#fff9db' : step < 5 ? '#ff922b' : '#e03131';
      ctx.fillRect(fx, fy, sz, sz);
    }
  }

  ctx.restore();

  if (hpRatio < 0.99) {
    const bw = Math.round(scale * 2.2);
    const bx = Math.round(sx - bw * 0.5);
    const by = Math.round(sy - scale * 1.85);
    ctx.fillStyle = '#12151c';
    ctx.fillRect(bx - 1, by - 1, bw + 2, 7);
    ctx.fillStyle = '#ff5252';
    ctx.fillRect(bx, by, Math.max(2, Math.round(bw * hpRatio)), 5);
  }
}
