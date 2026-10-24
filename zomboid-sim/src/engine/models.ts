import {
  PROP_AIRDROP,
  PROP_BARREL_FIRE,
  PROP_BED,
  PROP_CORPSE,
  PROP_CRATE,
  PROP_FRIDGE,
  PROP_GAS_PUMP,
  PROP_GENERATOR,
  PROP_GUN_LOCKER,
  PROP_HYDRANT,
  PROP_LOG_PILE,
  PROP_MED_CABINET,
  PROP_SHELF,
  PROP_STREETLIGHT,
  PROP_TRASH_BIN,
  PROP_TREE_OAK,
  PROP_TREE_PINE,
  PROP_WORKBENCH,
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
  attackPose = 0,
): HTMLCanvasElement {
  // Crawler Zombie lying low on ground!
  if (role === ROLE_ZOMBIE_CRAWLER) {
    const b = new PixBuf(22, 16);
    const zSkin = '#6e8c58';
    const shirt = CIV_SHIRTS[variant % CIV_SHIRTS.length];
    b.rect(4, 8, 9, 4, shirt);
    b.rect(2, 9, 4, 3, '#333942');
    b.rect(12, 6, 5, 5, zSkin);
    b.px(16, 8, '#c9182b');
    const reach = attackPose ? 19 : stepFrame === 0 ? 18 : stepFrame === 2 ? 14 : 16;
    b.rect(13, 10, reach - 12, 2, zSkin);
    b.px(6, 9, '#9e1b24');
    b.outline1px('#101211');
    return b.toCanvas();
  }

  const b = new PixBuf(26, 27);
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

  // Smooth 4-phase stride cycle: 0=left stride, 1=stance, 2=right stride, 3=stance
  const legA = stepFrame === 0 ? -2 : stepFrame === 2 ? 2 : 0;
  const legB = -legA;
  const bobY = stepFrame === 1 || stepFrame === 3 ? 0 : -1;

  // Boots & Jeans/Trousers (WorldBox clean pixel proportion!)
  b.rect(7 + legA, 18, 3, 5, pants);
  b.rect(11 + legB, 18, 3, 5, pants);
  b.rect(7 + legA, 22, 3, 2, '#1c1a19');
  b.rect(11 + legB, 22, 3, 2, '#1c1a19');

  // Backpack on survivors!
  if (!isZed && (variant & 1) === 0) {
    b.rect(4, 11 + bobY, 3, 6, role === ROLE_MEDIC ? '#c92a2a' : '#4a3f32');
  }

  // Torso + Armor Vest / Medic Cross / Blood stains on Zombies
  b.rect(7, 11 + bobY, 7, 7, torso);
  if (vest) {
    b.rect(7, 12 + bobY, 7, 5, vest);
  }
  if (role === ROLE_MEDIC) {
    b.rect(9, 13 + bobY, 3, 1, '#e03131');
    b.rect(10, 12 + bobY, 1, 3, '#e03131');
  }
  if (isZed) {
    b.rect(9, 12 + bobY, 3, 3, '#a61c24');
    b.px(8, 15 + bobY, '#7a1218');
  }

  // Head
  b.rect(7, 4 + bobY, 7, 7, skin);
  if (helmet) {
    b.rect(6, 3 + bobY, 9, 4, helmet);
    if (role === ROLE_POLICE) b.px(13, 4 + bobY, '#ffd43b');
  } else if (role === ROLE_RAIDER) {
    b.rect(7, 3 + bobY, 7, 3, hair);
    b.rect(7, 8 + bobY, 7, 3, '#b02020');
  } else {
    b.rect(7, 3 + bobY, 7, 3, hair);
    b.rect(7, 4 + bobY, 2, 3, hair);
  }

  // Eyes
  b.px(12, 7 + bobY, isZed ? (role === ROLE_ZOMBIE_SPRINTER ? '#ff3b3b' : '#d8f3dc') : '#151518');
  if (isZed) b.px(12, 9 + bobY, '#9e1b24');

  // Arms + Visible Project Zomboid Weapons (with animated swing / recoil!)
  if (isZed) {
    const armY = attackPose ? 9 : stepFrame === 0 ? 11 : 12;
    const armLen = attackPose ? 8 : 6;
    b.rect(13, armY + bobY, armLen, 2, skin);
    b.rect(12, armY + 2 + bobY, armLen - 1, 2, torso);
    b.px(12 + armLen, armY + bobY, '#d90429');
  } else if (weapon === WPN_BAT) {
    b.rect(12, 12 + bobY, 4, 2, skin);
    if (attackPose) {
      // Horizontal bat cleave forward!
      b.rect(15, 12 + bobY, 9, 2, '#c9965b');
      b.rect(20, 12 + bobY, 4, 3, '#9e2a2b');
    } else {
      for (let k = 0; k < 7; k++) {
        b.rect(15 + (k >> 1), 12 + bobY - k, 2, 2, k > 3 ? '#c9965b' : '#8c5e32');
      }
    }
  } else if (weapon === WPN_AXE) {
    b.rect(12, 12 + bobY, 4, 2, skin);
    if (attackPose) {
      // Forward downward fire-axe strike!
      b.rect(15, 12 + bobY, 8, 2, '#7c4d2b');
      b.rect(20, 10 + bobY, 4, 4, '#d90429');
      b.rect(23, 10 + bobY, 2, 5, '#f8f9fa');
    } else {
      for (let k = 0; k < 7; k++) {
        b.px(15 + (k >> 1), 13 + bobY - k, '#7c4d2b');
      }
      b.rect(17, 5 + bobY, 4, 3, '#d90429');
      b.rect(20, 5 + bobY, 2, 4, '#dee2e6');
    }
  } else if (weapon === WPN_PISTOL) {
    const kick = attackPose ? -1 : 0;
    b.rect(12, 12 + bobY + kick, 5, 2, skin);
    b.rect(17 + kick, 11 + bobY + kick, 4, 2, '#343a40');
    b.px(17 + kick, 13 + bobY + kick, '#212529');
  } else if (weapon === WPN_SHOTGUN) {
    const kick = attackPose ? -1 : 0;
    b.rect(11, 12 + bobY, 5, 2, skin);
    b.rect(13 + kick, 12 + bobY + kick, 4, 2, '#7c4d2b');
    b.rect(16 + kick, 11 + bobY + kick, 7, 2, '#343a40');
  } else if (weapon === WPN_RIFLE) {
    const kick = attackPose ? -1 : 0;
    b.rect(11, 12 + bobY, 5, 2, skin);
    b.rect(13 + kick, 11 + bobY + kick, 9, 2, '#212529');
    b.rect(17 + kick, 13 + bobY + kick, 2, 2, '#495057');
    b.px(22 + kick, 11 + bobY + kick, '#adb5bd');
  } else {
    b.rect(11, 12 + bobY, attackPose ? 7 : 3, attackPose ? 2 : 4, skin);
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
  } else if (propId === PROP_BARREL_FIRE) {
    // Rusted oil barrel with glowing coals & flames!
    b.rect(7, 10, 10, 14, '#5c3c28');
    b.rect(6, 13, 12, 2, '#2b2d42');
    b.rect(6, 19, 12, 2, '#2b2d42');
    b.ellipse(12, 10, 5, 2, '#d90429');
    b.poly([[9, 10], [11, 3], [14, 10]], '#fb5607');
    b.poly([[11, 10], [13, 5], [16, 10]], '#ffbe0b');
    b.px(12, 7, '#fff3b0');
  } else if (propId === PROP_WORKBENCH) {
    // Carpentry workbench with saw blade & tools!
    b.rect(3, 12, 18, 4, '#a47148');
    b.rect(4, 16, 3, 8, '#6f4518');
    b.rect(17, 16, 3, 8, '#6f4518');
    b.rect(6, 18, 12, 2, '#583101');
    b.rect(7, 9, 6, 3, '#adb5bd');
    b.rect(15, 10, 4, 2, '#d90429');
  } else if (propId === PROP_GENERATOR) {
    // Emergency gas generator!
    b.rect(4, 11, 16, 12, '#e9c46a');
    b.rect(5, 13, 8, 7, '#343a40');
    b.rect(14, 13, 5, 6, '#bc4749');
    b.rect(6, 8, 3, 3, '#495057');
    b.px(16, 15, '#80ed99');
  } else if (propId === PROP_HYDRANT) {
    // Classic red street fire hydrant!
    b.rect(9, 11, 6, 12, '#d90429');
    b.rect(7, 14, 10, 3, '#adb5bd');
    b.ellipse(12, 10, 3, 2, '#ef233c');
    b.rect(8, 22, 8, 2, '#6c757d');
  } else if (propId === PROP_LOG_PILE) {
    // Stacked timber logs for base expansion!
    for (const [lx, ly] of [[4, 18], [9, 18], [14, 18], [6, 14], [11, 14], [9, 10]]) {
      b.rect(lx, ly, 6, 4, '#7f5539');
      b.rect(lx + 4, ly + 1, 2, 2, '#ddb892');
    }
  } else if (propId === PROP_CORPSE) {
    // Fallen corpse in pool of dark blood
    b.ellipse(12, 20, 9, 4, '#6e0d16');
    b.rect(4, 17, 9, 4, '#4a5759');
    b.rect(12, 17, 6, 3, '#2b3340');
    b.rect(3, 16, 4, 4, '#6b8c58');
  } else {
    // Wooden crate / trash bin
    b.rect(5, 10, 14, 13, propId === PROP_TRASH_BIN ? '#3d5a45' : '#9c6b3c');
    b.rect(5, 13, 14, 2, propId === PROP_TRASH_BIN ? '#2b3f31' : '#6f4824');
  }
  b.outline1px('#101214');
  return b.toCanvas();
}

/**
 * Multi-Frame Animated Pixel Fire Sprite (6 distinct flickering tongue frames!)
 * Crisp layered pixel art: dark outline -> crimson outer -> orange tongues -> gold inner -> white-yellow core!
 */
function bakePixelFireFrame(frame: number, tall: boolean): HTMLCanvasElement {
  const w = 22;
  const h = tall ? 30 : 22;
  const b = new PixBuf(w, h);
  const baseY = h - 3;
  const sway = [-2, -1, 1, 2, 1, -1][frame % 6];
  const tipH = tall ? 23 : 15;

  // Glowing ember bed at base
  b.ellipse(11, baseY, 7, 3, '#9d0208');
  b.ellipse(11, baseY, 5, 2, '#e85d04');

  // Outer crimson flame tongues
  b.poly([[4, baseY], [11 + sway, baseY - tipH], [18, baseY]], '#d00000');
  b.poly([[3, baseY - 1], [7 - sway, baseY - Math.round(tipH * 0.72)], [12, baseY]], '#dc2f02');
  b.poly([[10, baseY], [15 + sway, baseY - Math.round(tipH * 0.78)], [19, baseY - 1]], '#dc2f02');

  // Mid bright orange flame body
  b.poly([[6, baseY], [11 + sway, baseY - Math.round(tipH * 0.84)], [16, baseY]], '#f48c06');
  b.poly([[5, baseY - 1], [8 - sway, baseY - Math.round(tipH * 0.56)], [12, baseY]], '#fb5607');

  // Golden yellow inner flame
  b.poly([[8, baseY], [11 + (sway >> 1), baseY - Math.round(tipH * 0.58)], [14, baseY]], '#ffba08');

  // White-hot core
  b.poly([[9, baseY], [11, baseY - Math.round(tipH * 0.34)], [13, baseY]], '#fff3b0');

  // Floating pixel embers rising above flame tips!
  b.px(9 + sway, Math.max(1, baseY - tipH - ((frame * 2) % 4)), '#ffba08');
  b.px(13 - sway, Math.max(1, baseY - tipH + 2 - ((frame * 3) % 5)), '#fb5607');

  b.outline1px('#1a0805');
  return b.toCanvas();
}

/** 6-Frame Pixel Explosion Flipbook (Flash -> Fireball -> Shockwave -> Dark Smoke Ring) */
function bakeExplosionFrame(frame: number): HTMLCanvasElement {
  const b = new PixBuf(44, 44);
  const cx = 22;
  const cy = 22;
  if (frame === 0) {
    b.ellipse(cx, cy, 9, 9, '#ffba08');
    b.ellipse(cx, cy, 6, 6, '#ffffff');
  } else if (frame === 1) {
    b.ellipse(cx, cy, 15, 14, '#d00000');
    b.ellipse(cx - 2, cy - 1, 12, 11, '#f48c06');
    b.ellipse(cx, cy, 8, 8, '#fff3b0');
  } else if (frame === 2) {
    b.ellipse(cx, cy, 19, 17, '#370617');
    b.ellipse(cx - 3, cy - 2, 14, 13, '#dc2f02');
    b.ellipse(cx + 3, cy + 1, 12, 11, '#f48c06');
    b.ellipse(cx, cy - 1, 7, 6, '#ffba08');
  } else if (frame === 3) {
    b.ellipse(cx - 4, cy - 3, 13, 12, '#2b2d42');
    b.ellipse(cx + 5, cy + 2, 12, 11, '#343a40');
    b.ellipse(cx, cy - 1, 11, 10, '#9d0208');
    b.ellipse(cx - 1, cy - 2, 6, 5, '#f48c06');
  } else if (frame === 4) {
    b.ellipse(cx - 6, cy - 4, 11, 10, '#343a40');
    b.ellipse(cx + 6, cy + 3, 10, 9, '#495057');
    b.ellipse(cx, cy, 8, 7, '#6a040f');
  } else {
    b.ellipse(cx - 7, cy - 5, 9, 8, '#495057');
    b.ellipse(cx + 7, cy + 4, 8, 7, '#6c757d');
  }
  b.outline1px('#140c0a');
  return b.toCanvas();
}

/** 4-Frame Pixel Smoke Cloud */
function bakeSmokeFrame(frame: number): HTMLCanvasElement {
  const b = new PixBuf(20, 20);
  const r = 4 + frame;
  const shade = frame < 2 ? '#343a40' : '#495057';
  const hi = frame < 2 ? '#495057' : '#6c757d';
  b.ellipse(10, 11 - frame, r, r - 1, shade);
  b.ellipse(9, 10 - frame, Math.max(2, r - 2), Math.max(2, r - 3), hi);
  b.outline1px('#1b1e22');
  return b.toCanvas();
}

/** Pixel Muzzle Flash Star & Melee Slash Crescent */
function bakeMuzzleFlash(frame: number): HTMLCanvasElement {
  const b = new PixBuf(16, 16);
  const len = frame === 0 ? 7 : 5;
  b.poly([[2, 8], [8 + len, 5], [8 + len, 11]], '#ff9f1c');
  b.poly([[2, 8], [6 + len, 7], [6 + len, 9]], '#ffffff');
  b.poly([[5, 3], [8, 8], [5, 13]], '#ffbf69');
  b.outline1px('#3d1308');
  return b.toCanvas();
}

function bakeSlashArc(frame: number, isZombie: boolean): HTMLCanvasElement {
  const b = new PixBuf(24, 24);
  const outer = isZombie ? '#d90429' : '#f8f9fa';
  const inner = isZombie ? '#ff758f' : '#ffd166';
  const shift = frame * 2;
  b.poly([[6, 3 + shift], [19, 8], [21, 14], [17, 20 - shift], [13, 14], [12, 9]], outer);
  b.poly([[10, 6 + shift], [18, 10], [18, 15], [14, 17 - shift]], inner);
  b.outline1px('#111315');
  return b.toCanvas();
}

export class ZomboidSpriteAtlas {
  private charCache = new Map<number, HTMLCanvasElement>();
  private carCache = new Map<string, HTMLCanvasElement>();
  private propCache = new Map<number, HTMLCanvasElement>();
  private fireSmall: HTMLCanvasElement[] = [];
  private fireTall: HTMLCanvasElement[] = [];
  private explosionFrames: HTMLCanvasElement[] = [];
  private smokeFrames: HTMLCanvasElement[] = [];
  private muzzleFrames: HTMLCanvasElement[] = [];
  private slashHumanFrames: HTMLCanvasElement[] = [];
  private slashZedFrames: HTMLCanvasElement[] = [];

  public getUnitSprite(
    role: number,
    variant: number,
    weapon: number,
    stepFrame: number,
    sick: boolean,
    flip: boolean,
    attackPose = 0,
  ): HTMLCanvasElement {
    const vMod = variant & 15;
    const sf = stepFrame & 3;
    const ap = attackPose ? 1 : 0;
    const key =
      (((((((role * 16 + vMod) * 7 + weapon) * 4 + sf) * 2 + ap) * 2 + (sick ? 1 : 0)) * 2 + (flip ? 1 : 0)) | 0);
    const hit = this.charCache.get(key);
    if (hit) return hit;

    const baseKey = key & ~1;
    let base = this.charCache.get(baseKey);
    if (!base) {
      base = bakeCharacterSprite(role, vMod, weapon, sf, sick, ap);
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

  public getFireSprite(frame: number, tall: boolean): HTMLCanvasElement {
    if (this.fireSmall.length === 0) {
      for (let f = 0; f < 6; f++) {
        this.fireSmall.push(bakePixelFireFrame(f, false));
        this.fireTall.push(bakePixelFireFrame(f, true));
      }
    }
    const arr = tall ? this.fireTall : this.fireSmall;
    return arr[((frame % 6) + 6) % 6];
  }

  public getExplosionSprite(frame: number): HTMLCanvasElement {
    if (this.explosionFrames.length === 0) {
      for (let f = 0; f < 6; f++) this.explosionFrames.push(bakeExplosionFrame(f));
    }
    return this.explosionFrames[Math.max(0, Math.min(5, frame | 0))];
  }

  public getSmokeSprite(frame: number): HTMLCanvasElement {
    if (this.smokeFrames.length === 0) {
      for (let f = 0; f < 4; f++) this.smokeFrames.push(bakeSmokeFrame(f));
    }
    return this.smokeFrames[Math.max(0, Math.min(3, frame | 0))];
  }

  public getMuzzleFlashSprite(frame: number): HTMLCanvasElement {
    if (this.muzzleFrames.length === 0) {
      for (let f = 0; f < 3; f++) this.muzzleFrames.push(bakeMuzzleFlash(f));
    }
    return this.muzzleFrames[Math.max(0, Math.min(2, frame | 0))];
  }

  public getSlashSprite(frame: number, isZombie: boolean): HTMLCanvasElement {
    if (this.slashHumanFrames.length === 0) {
      for (let f = 0; f < 3; f++) {
        this.slashHumanFrames.push(bakeSlashArc(f, false));
        this.slashZedFrames.push(bakeSlashArc(f, true));
      }
    }
    const arr = isZombie ? this.slashZedFrames : this.slashHumanFrames;
    return arr[Math.max(0, Math.min(2, frame | 0))];
  }
}
