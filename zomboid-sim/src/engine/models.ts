import {
  PROP_AIRDROP,
  PROP_BED,
  PROP_CRATE,
  PROP_FRIDGE,
  PROP_GAS_PUMP,
  PROP_GUN_LOCKER,
  PROP_MED_CABINET,
  PROP_SHELF,
  PROP_STREETLIGHT,
  PROP_TRASH_BIN,
  PROP_TREE_OAK,
  PROP_TREE_PINE,
  ROLE_CIVILIAN,
  ROLE_MEDIC,
  ROLE_POLICE,
  ROLE_RAIDER,
  ROLE_SOLDIER,
  ROLE_ZOMBIE_ARMORED,
  ROLE_ZOMBIE_CRAWLER,
  ROLE_ZOMBIE_SHAMBLER,
  ROLE_ZOMBIE_SPRINTER,
  Vehicle,
  WPN_AXE,
  WPN_BAT,
  WPN_PISTOL,
  WPN_RIFLE,
  WPN_SHOTGUN,
} from './types';

function hexToRgba(hex: string): [number, number, number, number] {
  const c = hex.charCodeAt(0) === 35 ? hex.slice(1) : hex;
  if (c.length === 6) {
    return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16), 255];
  }
  return [
    parseInt(c.slice(0, 2), 16),
    parseInt(c.slice(2, 4), 16),
    parseInt(c.slice(4, 6), 16),
    parseInt(c.slice(6, 8), 16),
  ];
}

/**
 * WorldBox-lineage Crisp 16-bit Pixel Buffer with 1px dark outline baker (`outline1px`)
 */
export class PixBuf {
  public data: Uint8ClampedArray;
  constructor(
    public w: number,
    public h: number,
  ) {
    this.data = new Uint8ClampedArray(w * h * 4);
  }

  public px(x: number, y: number, hex: string): void {
    const ix = x | 0;
    const iy = y | 0;
    if (ix < 0 || ix >= this.w || iy < 0 || iy >= this.h) return;
    const [r, g, b, a] = hexToRgba(hex);
    const o = (iy * this.w + ix) * 4;
    this.data[o] = r;
    this.data[o + 1] = g;
    this.data[o + 2] = b;
    this.data[o + 3] = a;
  }

  public rect(x: number, y: number, w: number, h: number, hex: string): void {
    const x0 = Math.max(0, x | 0);
    const y0 = Math.max(0, y | 0);
    const x1 = Math.min(this.w, (x + w) | 0);
    const y1 = Math.min(this.h, (y + h) | 0);
    const [r, g, b, a] = hexToRgba(hex);
    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        const o = (py * this.w + px) * 4;
        this.data[o] = r;
        this.data[o + 1] = g;
        this.data[o + 2] = b;
        this.data[o + 3] = a;
      }
    }
  }

  public ellipse(cx: number, cy: number, rx: number, ry: number, hex: string): void {
    const [r, g, b, a] = hexToRgba(hex);
    const x0 = Math.max(0, Math.floor(cx - rx));
    const x1 = Math.min(this.w - 1, Math.ceil(cx + rx));
    const y0 = Math.max(0, Math.floor(cy - ry));
    const y1 = Math.min(this.h - 1, Math.ceil(cy + ry));
    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        const dx = (px - cx) / rx;
        const dy = (py - cy) / ry;
        if (dx * dx + dy * dy <= 1.0) {
          const o = (py * this.w + px) * 4;
          this.data[o] = r;
          this.data[o + 1] = g;
          this.data[o + 2] = b;
          this.data[o + 3] = a;
        }
      }
    }
  }

  public poly(pts: [number, number][], hex: string): void {
    const [r, g, b, a] = hexToRgba(hex);
    let minY = this.h;
    let maxY = 0;
    for (const p of pts) {
      if (p[1] < minY) minY = p[1];
      if (p[1] > maxY) maxY = p[1];
    }
    const y0 = Math.max(0, Math.floor(minY));
    const y1 = Math.min(this.h - 1, Math.ceil(maxY));
    for (let y = y0; y <= y1; y++) {
      const nodes: number[] = [];
      let j = pts.length - 1;
      for (let i = 0; i < pts.length; i++) {
        const yi = pts[i][1];
        const yj = pts[j][1];
        const xi = pts[i][0];
        const xj = pts[j][0];
        if ((yi < y + 0.5 && yj >= y + 0.5) || (yj < y + 0.5 && yi >= y + 0.5)) {
          nodes.push(xi + ((y + 0.5 - yi) / (yj - yi)) * (xj - xi));
        }
        j = i;
      }
      nodes.sort((m, n) => m - n);
      for (let k = 0; k + 1 < nodes.length; k += 2) {
        const sx = Math.max(0, Math.round(nodes[k]));
        const ex = Math.min(this.w - 1, Math.round(nodes[k + 1]));
        for (let x = sx; x <= ex; x++) {
          const o = (y * this.w + x) * 4;
          this.data[o] = r;
          this.data[o + 1] = g;
          this.data[o + 2] = b;
          this.data[o + 3] = a;
        }
      }
    }
  }

  public outline1px(hex = '#121316'): void {
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

function flipH(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.translate(src.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(src, 0, 0);
  return c;
}

const SKIN_TONES = ['#f3ccb0', '#e3b38e', '#c9936b', '#8d5b3e'];
const HAIR_TONES = ['#2a201b', '#5c3c24', '#a67b38', '#494e54'];
const CIV_SHIRTS = ['#9e3b33', '#3d6380', '#4f6d44', '#a87c33', '#6b4c7a', '#555b61'];

function bakeCharacterSprite(
  role: number,
  variant: number,
  weapon: number,
  stepFrame: number,
  sick: boolean,
): HTMLCanvasElement {
  // Crawler Zombie lying low on ground!
  if (role === ROLE_ZOMBIE_CRAWLER) {
    const b = new PixBuf(22, 16);
    const zSkin = '#6e8c58';
    const shirt = CIV_SHIRTS[variant % CIV_SHIRTS.length];
    b.rect(4, 8, 9, 4, shirt);
    b.rect(2, 9, 4, 3, '#333942');
    // Head & reaching bloody arm
    b.rect(12, 6, 5, 5, zSkin);
    b.px(16, 8, '#c9182b');
    const reach = stepFrame === 0 ? 17 : 15;
    b.rect(13, 10, reach - 12, 2, zSkin);
    b.px(6, 9, '#9e1b24');
    b.outline1px('#101211');
    return b.toCanvas();
  }

  const b = new PixBuf(24, 26);
  const isZed = role >= ROLE_ZOMBIE_SHAMBLER;
  const skin = isZed
    ? role === ROLE_ZOMBIE_SPRINTER
      ? '#7c8f69'
      : '#668755'
    : sick
      ? '#b9cf9a'
      : SKIN_TONES[variant & 3];
  const hair = HAIR_TONES[(variant >> 2) & 3];

  let torso = CIV_SHIRTS[variant % CIV_SHIRTS.length];
  let pants = '#2c3545';
  let helmet = '';
  let vest = '';

  if (role === ROLE_POLICE || (role === ROLE_ZOMBIE_ARMORED && (variant & 1) === 0)) {
    torso = '#223a5e';
    pants = '#192942';
    helmet = '#1b2d4a';
    vest = '#1a2029';
  } else if (role === ROLE_SOLDIER || role === ROLE_ZOMBIE_ARMORED) {
    torso = '#4a593d';
    pants = '#39462f';
    helmet = '#3d4c32';
    vest = '#2f3a27';
  } else if (role === ROLE_MEDIC) {
    torso = '#e8eef2';
    pants = '#2b4c65';
  } else if (role === ROLE_RAIDER) {
    torso = '#2b2628';
    pants = '#211d1f';
    vest = '#6e2020';
  }

  const legA = stepFrame === 0 ? -1 : 1;
  const legB = -legA;

  // Boots & Jeans/Trousers (WorldBox clean pixel proportion!)
  b.rect(7 + legA, 18, 3, 5, pants);
  b.rect(11 + legB, 18, 3, 5, pants);
  b.rect(7 + legA, 22, 3, 2, '#1c1a19');
  b.rect(11 + legB, 22, 3, 2, '#1c1a19');

  // Backpack on survivors!
  if (!isZed && (variant & 1) === 0) {
    b.rect(4, 11, 3, 6, role === ROLE_MEDIC ? '#c92a2a' : '#4a3f32');
  }

  // Torso + Armor Vest / Medic Cross / Blood stains on Zombies
  b.rect(7, 11, 7, 7, torso);
  if (vest) {
    b.rect(7, 12, 7, 5, vest);
  }
  if (role === ROLE_MEDIC) {
    b.rect(9, 13, 3, 1, '#e03131');
    b.rect(10, 12, 1, 3, '#e03131');
  }
  if (isZed) {
    // Torn bloody shirt & exposed ribs on zombies!
    b.rect(9, 12, 3, 3, '#a61c24');
    b.px(8, 15, '#7a1218');
  }

  // Head
  b.rect(7, 4, 7, 7, skin);
  if (helmet) {
    b.rect(6, 3, 9, 4, helmet);
    if (role === ROLE_POLICE) b.px(13, 4, '#ffd43b'); // Gold police badge on cap!
  } else if (role === ROLE_RAIDER) {
    b.rect(7, 3, 7, 3, hair);
    b.rect(7, 8, 7, 3, '#b02020'); // Red bandit bandana!
  } else {
    b.rect(7, 3, 7, 3, hair);
    b.rect(7, 4, 2, 3, hair);
  }

  // Eyes
  b.px(12, 7, isZed ? (role === ROLE_ZOMBIE_SPRINTER ? '#ff3b3b' : '#d8f3dc') : '#151518');
  if (isZed) b.px(12, 9, '#9e1b24'); // Bloody zombie jaw

  // Arms + Visible Project Zomboid Weapons!
  if (isZed) {
    // Classic outstretched zombie arms reaching forward!
    const armY = stepFrame === 0 ? 11 : 12;
    b.rect(13, armY, 6, 2, skin);
    b.rect(12, armY + 2, 5, 2, torso);
    b.px(18, armY, '#9e1b24');
  } else if (weapon === WPN_BAT) {
    b.rect(12, 12, 4, 2, skin);
    // Wooden baseball bat angled up!
    for (let k = 0; k < 7; k++) {
      b.rect(15 + (k >> 1), 12 - k, 2, 2, k > 3 ? '#c9965b' : '#8c5e32');
    }
  } else if (weapon === WPN_AXE) {
    b.rect(12, 12, 4, 2, skin);
    for (let k = 0; k < 7; k++) {
      b.px(15 + (k >> 1), 13 - k, '#7c4d2b');
    }
    // Red & steel fire-axe head!
    b.rect(17, 5, 4, 3, '#d90429');
    b.rect(20, 5, 2, 4, '#dee2e6');
  } else if (weapon === WPN_PISTOL) {
    b.rect(12, 12, 5, 2, skin);
    b.rect(17, 11, 4, 2, '#343a40');
    b.px(17, 13, '#212529');
  } else if (weapon === WPN_SHOTGUN) {
    b.rect(11, 12, 5, 2, skin);
    b.rect(13, 12, 4, 2, '#7c4d2b'); // Wooden stock & pump
    b.rect(16, 11, 7, 2, '#343a40'); // Long 12-gauge barrel
  } else if (weapon === WPN_RIFLE) {
    b.rect(11, 12, 5, 2, skin);
    b.rect(13, 11, 9, 2, '#212529');
    b.rect(17, 13, 2, 2, '#495057'); // Curved M16 magazine
    b.px(22, 11, '#adb5bd');
  } else {
    b.rect(10, 12, 3, 4, skin);
  }

  b.outline1px('#101214');
  return b.toCanvas();
}

function bakeIsoCar(kind: Vehicle['kind'], bodyHex: string, axis: 0 | 1, burned: boolean): HTMLCanvasElement {
  const b = new PixBuf(56, 40);
  const colMain = burned ? '#2d2a28' : bodyHex;
  const colTop = burned ? '#3b3734' : lighten(colMain, 26);
  const colSide = burned ? '#1f1d1b' : darken(colMain, 28);
  const glass = burned ? '#171615' : '#6c8ea4';

  // Isometric 3D boxy 1993 Kentucky Sedan / Cruiser / Van!
  // Chassis lower box
  b.poly(
    [
      [8, 22],
      [28, 12],
      [48, 20],
      [28, 30],
    ],
    colTop,
  );
  b.poly(
    [
      [8, 22],
      [28, 30],
      [28, 36],
      [8, 28],
    ],
    colMain,
  );
  b.poly(
    [
      [28, 30],
      [48, 20],
      [48, 26],
      [28, 36],
    ],
    colSide,
  );

  // Cabin roof & windshields
  const tall = kind === 'ambulance' ? 8 : 6;
  b.poly(
    [
      [16, 18 - tall],
      [29, 12 - tall],
      [40, 16 - tall],
      [27, 22 - tall],
    ],
    kind === 'police' && !burned ? '#f1f3f5' : colTop,
  );
  b.poly(
    [
      [14, 20],
      [16, 18 - tall],
      [27, 22 - tall],
      [26, 26],
    ],
    glass,
  );
  b.poly(
    [
      [27, 22 - tall],
      [40, 16 - tall],
      [42, 20],
      [26, 26],
    ],
    glass,
  );

  // Wheels
  b.ellipse(15, 29, 3.2, 3.2, '#16181a');
  b.ellipse(24, 33, 3.2, 3.2, '#16181a');
  b.ellipse(41, 25, 3.0, 3.0, '#16181a');

  // Headlights & Taillights
  if (!burned) {
    b.rect(9, 24, 2, 2, '#fff3b0');
    b.rect(25, 31, 2, 2, '#fff3b0');
    b.rect(46, 21, 2, 2, '#e63946');
    if (kind === 'police' || kind === 'ambulance') {
      // Police / EMS roof lightbar!
      b.rect(25, 13 - tall, 3, 2, '#e63946');
      b.rect(28, 13 - tall, 3, 2, '#3a86ff');
    }
  }

  b.outline1px('#0f1112');
  const base = b.toCanvas();
  return axis === 1 ? flipH(base) : base;
}

function lighten(hex: string, add: number): string {
  const [r, g, b] = hexToRgba(hex);
  const toH = (v: number) => Math.min(255, Math.max(0, v + add)).toString(16).padStart(2, '0');
  return `#${toH(r)}${toH(g)}${toH(b)}`;
}

function darken(hex: string, sub: number): string {
  return lighten(hex, -sub);
}

function bakeIsoProp(propId: number): HTMLCanvasElement {
  if (propId === PROP_TREE_PINE) {
    const b = new PixBuf(34, 48);
    b.rect(15, 36, 4, 10, '#4f3522');
    b.poly([[17, 4], [29, 20], [5, 20]], '#2f4a2e');
    b.poly([[17, 13], [31, 30], [3, 30]], '#263d25');
    b.poly([[17, 22], [32, 39], [2, 39]], '#1d301d');
    b.poly([[17, 4], [17, 36], [5, 20]], '#3b5c39');
    b.outline1px('#0f1410');
    return b.toCanvas();
  }
  if (propId === PROP_TREE_OAK) {
    const b = new PixBuf(36, 44);
    b.rect(16, 30, 4, 12, '#573b26');
    b.ellipse(18, 19, 13, 12, '#344e30');
    b.ellipse(14, 15, 9, 8, '#46663e');
    b.ellipse(22, 22, 8, 7, '#273b24');
    b.outline1px('#0f1410');
    return b.toCanvas();
  }
  if (propId === PROP_STREETLIGHT) {
    const b = new PixBuf(20, 44);
    b.rect(9, 8, 2, 34, '#495057');
    b.rect(9, 7, 7, 2, '#6c757d');
    b.rect(14, 9, 3, 2, '#fff3b0');
    b.outline1px('#111315');
    return b.toCanvas();
  }

  const b = new PixBuf(24, 28);
  if (propId === PROP_FRIDGE) {
    b.rect(6, 5, 12, 19, '#dee2e6');
    b.rect(14, 5, 4, 19, '#adb5bd');
    b.rect(6, 12, 12, 1, '#495057');
    b.rect(7, 8, 1, 3, '#6c757d');
    b.rect(7, 14, 1, 4, '#6c757d');
  } else if (propId === PROP_SHELF) {
    b.rect(4, 6, 16, 18, '#6c462b');
    b.rect(5, 9, 14, 3, '#c9182b');
    b.rect(9, 9, 4, 3, '#e9c46a');
    b.rect(5, 15, 14, 3, '#457b9d');
    b.rect(11, 15, 5, 3, '#8ac926');
  } else if (propId === PROP_MED_CABINET) {
    b.rect(5, 6, 14, 17, '#f1f5f9');
    b.rect(10, 10, 4, 2, '#e63946');
    b.rect(11, 9, 2, 4, '#e63946');
  } else if (propId === PROP_GUN_LOCKER) {
    b.rect(5, 5, 14, 19, '#2b3945');
    b.rect(7, 8, 2, 12, '#adb5bd');
    b.rect(11, 8, 2, 12, '#adb5bd');
    b.px(16, 14, '#ffd166');
  } else if (propId === PROP_BED) {
    b.rect(3, 12, 18, 10, '#3a5a78');
    b.rect(4, 12, 5, 5, '#f8f9fa');
    b.rect(3, 19, 18, 4, '#5c3c24');
  } else if (propId === PROP_GAS_PUMP) {
    b.rect(6, 6, 12, 18, '#d90429');
    b.rect(8, 8, 8, 5, '#e9ecef');
    b.rect(17, 12, 2, 8, '#212529');
  } else if (propId === PROP_AIRDROP) {
    b.rect(3, 9, 18, 14, '#4a5d3b');
    b.rect(3, 14, 18, 3, '#e9c46a');
    b.rect(10, 9, 3, 14, '#2b3322');
  } else {
    // Wooden crate / trash bin
    b.rect(5, 10, 14, 13, propId === PROP_TRASH_BIN ? '#3d5a45' : '#9c6b3c');
    b.rect(5, 13, 14, 2, propId === PROP_TRASH_BIN ? '#2b3f31' : '#6f4824');
  }
  b.outline1px('#101214');
  return b.toCanvas();
}

export class ZomboidSpriteAtlas {
  private charCache = new Map<number, HTMLCanvasElement>();
  private carCache = new Map<string, HTMLCanvasElement>();
  private propCache = new Map<number, HTMLCanvasElement>();

  public getUnitSprite(
    role: number,
    variant: number,
    weapon: number,
    stepFrame: number,
    sick: boolean,
    flip: boolean,
  ): HTMLCanvasElement {
    const vMod = variant & 15;
    const key =
      ((((((role * 16 + vMod) * 7 + weapon) * 2 + stepFrame) * 2 + (sick ? 1 : 0)) * 2 + (flip ? 1 : 0)) | 0);
    const hit = this.charCache.get(key);
    if (hit) return hit;

    const baseKey = key & ~1;
    let base = this.charCache.get(baseKey);
    if (!base) {
      base = bakeCharacterSprite(role, vMod, weapon, stepFrame, sick);
      this.charCache.set(baseKey, base);
    }
    if (!flip) return base;
    const flipped = flipH(base);
    this.charCache.set(key, flipped);
    return flipped;
  }

  public getCarSprite(kind: Vehicle['kind'], color: string, axis: 0 | 1, burned: boolean): HTMLCanvasElement {
    const key = `${kind}:${burned ? 'burn' : color}:${axis}`;
    const hit = this.carCache.get(key);
    if (hit) return hit;
    const spr = bakeIsoCar(kind, color, axis, burned);
    this.carCache.set(key, spr);
    return spr;
  }

  public getPropSprite(propId: number): HTMLCanvasElement {
    const hit = this.propCache.get(propId);
    if (hit) return hit;
    const spr = bakeIsoProp(propId);
    this.propCache.set(propId, spr);
    return spr;
  }
}
