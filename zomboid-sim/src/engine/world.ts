import { fbm2D, mulberry32 } from './noise';
import {
  BuildingInfo,
  BuildingKind,
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
  MAP_H,
  MAP_SIZE,
  MAP_W,
  PROP_BED,
  PROP_CRATE,
  PROP_FRIDGE,
  PROP_GAS_PUMP,
  PROP_GUN_LOCKER,
  PROP_MED_CABINET,
  PROP_NONE,
  PROP_SHELF,
  PROP_STREETLIGHT,
  PROP_TRASH_BIN,
  PROP_TREE_OAK,
  PROP_TREE_PINE,
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
  Vehicle,
} from './types';

const TOWN_NAMES = [
  'Малдро',
  'Вест-Пойнт',
  'Роузвуд',
  'Риверсайд',
  'Марч-Ридж',
  'Фолллейк',
  'Ирвингтон',
  'Эхо-Крик',
];

const CAR_COLORS = ['#7f2d2d', '#2f4b69', '#4a5749', '#b8b2a6', '#8c6d32', '#3d3f45', '#5e4963'];

export class CityWorld {
  public seed = 1;
  public townName = 'Малдро';

  public floor = new Uint8Array(MAP_SIZE);
  public struct = new Uint8Array(MAP_SIZE);
  public structHp = new Uint16Array(MAP_SIZE);
  public barricade = new Uint8Array(MAP_SIZE); // 0..4 planks nailed to window/door
  public prop = new Uint8Array(MAP_SIZE);
  public loot = new Uint8Array(MAP_SIZE); // remaining loot charges 0..8
  public buildingId = new Int16Array(MAP_SIZE); // -1 outdoors, >= 0 building index
  public fire = new Float32Array(MAP_SIZE);
  public fuel = new Float32Array(MAP_SIZE);
  public scorch = new Float32Array(MAP_SIZE);
  public blood = new Float32Array(MAP_SIZE);
  public variation = new Uint8Array(MAP_SIZE);

  public buildings: BuildingInfo[] = [];
  public vehicles: Vehicle[] = [];
  public roadXs: number[] = [];
  public roadYs: number[] = [];

  constructor() {
    this.generateRandomCity();
  }

  public inBounds(x: number, y: number): boolean {
    return x >= 0 && x < MAP_W && y >= 0 && y < MAP_H;
  }

  public isWalkable(gx: number, gy: number): boolean {
    if (gx < 1 || gx >= MAP_W - 1 || gy < 1 || gy >= MAP_H - 1) return false;
    const idx = gy * MAP_W + gx;
    if (this.floor[idx] === FLOOR_WATER) return false;
    const st = this.struct[idx];
    if (
      st === STRUCT_WALL_BRICK ||
      st === STRUCT_WALL_WOOD ||
      st === STRUCT_WALL_CONCRETE ||
      st === STRUCT_WALL_STORE ||
      st === STRUCT_FENCE_CHAIN
    ) {
      return false;
    }
    if (st === STRUCT_DOOR_CLOSED || st === STRUCT_WINDOW_INTACT || st === STRUCT_FENCE_WOOD || st === STRUCT_SANDBAG) {
      return false;
    }
    if (st === STRUCT_WINDOW_BROKEN && this.barricade[idx] > 0) {
      return false;
    }
    const pr = this.prop[idx];
    if (
      pr === PROP_TREE_PINE ||
      pr === PROP_TREE_OAK ||
      pr === PROP_STREETLIGHT ||
      pr === PROP_GAS_PUMP
    ) {
      return false;
    }
    return true;
  }

  public blocksBullets(gx: number, gy: number): boolean {
    if (!this.inBounds(gx, gy)) return true;
    const st = this.struct[gy * MAP_W + gx];
    return (
      st === STRUCT_WALL_BRICK ||
      st === STRUCT_WALL_WOOD ||
      st === STRUCT_WALL_CONCRETE ||
      st === STRUCT_WALL_STORE ||
      st === STRUCT_DOOR_CLOSED
    );
  }

  public generateRandomCity(customSeed?: number): void {
    this.seed = customSeed ?? ((Math.random() * 0x7fffffff) | 1);
    const rng = mulberry32(this.seed);

    this.townName = `${TOWN_NAMES[(rng() * TOWN_NAMES.length) | 0]} #${this.seed % 1000}`;

    this.floor.fill(FLOOR_GRASS);
    this.struct.fill(STRUCT_NONE);
    this.structHp.fill(0);
    this.barricade.fill(0);
    this.prop.fill(PROP_NONE);
    this.loot.fill(0);
    this.buildingId.fill(-1);
    this.fire.fill(0);
    this.fuel.fill(0);
    this.scorch.fill(0);
    this.blood.fill(0);
    this.buildings = [];
    this.vehicles = [];

    // 1. Natural Kentucky grass, dirt patches, river edge & variation
    const riverSide = rng() < 0.5 ? 'east' : 'south';
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const idx = y * MAP_W + x;
        this.variation[idx] = (rng() * 255) | 0;
        const n = fbm2D(x * 0.06, y * 0.06, this.seed);
        if (n > 0.66) this.floor[idx] = FLOOR_DIRT;
        this.fuel[idx] = 0.25;

        const wobble = Math.sin((riverSide === 'east' ? y : x) * 0.07 + this.seed * 0.01) * 3.5;
        if (riverSide === 'east' && x > MAP_W - 10 + wobble) {
          this.floor[idx] = FLOOR_WATER;
          this.fuel[idx] = 0;
        } else if (riverSide === 'south' && y > MAP_H - 10 + wobble) {
          this.floor[idx] = FLOOR_WATER;
          this.fuel[idx] = 0;
        }
      }
    }

    // 2. Randomized Street Grid (4 vertical avenues x 4 horizontal streets)
    this.roadXs = [];
    this.roadYs = [];
    let cx = 20 + ((rng() * 6) | 0);
    while (cx < MAP_W - 24) {
      this.roadXs.push(cx);
      cx += 26 + ((rng() * 9) | 0);
    }
    let cy = 20 + ((rng() * 6) | 0);
    while (cy < MAP_H - 24) {
      this.roadYs.push(cy);
      cy += 26 + ((rng() * 9) | 0);
    }

    const paintRoadTile = (x: number, y: number, isLine: boolean) => {
      if (!this.inBounds(x, y)) return;
      const idx = y * MAP_W + x;
      this.floor[idx] = isLine ? FLOOR_ROAD_LINE : FLOOR_ASPHALT;
      this.fuel[idx] = 0;
      this.prop[idx] = PROP_NONE;
    };

    const paintSidewalk = (x: number, y: number) => {
      if (!this.inBounds(x, y)) return;
      const idx = y * MAP_W + x;
      if (this.floor[idx] === FLOOR_ASPHALT || this.floor[idx] === FLOOR_ROAD_LINE || this.floor[idx] === FLOOR_WATER) {
        return;
      }
      this.floor[idx] = FLOOR_SIDEWALK;
      this.fuel[idx] = 0;
    };

    for (const rx of this.roadXs) {
      for (let y = 0; y < MAP_H; y++) {
        for (let dx = -3; dx <= 3; dx++) {
          paintRoadTile(rx + dx, y, dx === 0 && (y % 4 < 2));
        }
        paintSidewalk(rx - 4, y);
        paintSidewalk(rx + 4, y);
      }
    }
    for (const ry of this.roadYs) {
      for (let x = 0; x < MAP_W; x++) {
        for (let dy = -3; dy <= 3; dy++) {
          const idxCheck = this.inBounds(x, ry + dy) ? this.floor[(ry + dy) * MAP_W + x] : 0;
          const intersection = idxCheck === FLOOR_ASPHALT || idxCheck === FLOOR_ROAD_LINE;
          paintRoadTile(x, ry + dy, !intersection && dy === 0 && (x % 4 < 2));
        }
        paintSidewalk(x, ry - 4);
        paintSidewalk(x, ry + 4);
      }
    }

    // Add Streetlights at intersections & along avenues!
    for (const rx of this.roadXs) {
      for (const ry of this.roadYs) {
        for (const [sx, sy] of [
          [rx - 4, ry - 4],
          [rx + 4, ry + 4],
        ]) {
          if (this.inBounds(sx, sy) && this.floor[sy * MAP_W + sx] === FLOOR_SIDEWALK) {
            this.prop[sy * MAP_W + sx] = PROP_STREETLIGHT;
          }
        }
      }
    }

    // 3. Collect city blocks between streets and build authentic multi-room Project Zomboid buildings!
    interface BlockLot {
      x0: number;
      y0: number;
      w: number;
      h: number;
      isCenter: boolean;
    }
    const lots: BlockLot[] = [];
    for (let ix = 0; ix < this.roadXs.length - 1; ix++) {
      for (let iy = 0; iy < this.roadYs.length - 1; iy++) {
        const bx0 = this.roadXs[ix] + 5;
        const bx1 = this.roadXs[ix + 1] - 5;
        const by0 = this.roadYs[iy] + 5;
        const by1 = this.roadYs[iy + 1] - 5;
        const bw = bx1 - bx0;
        const bh = by1 - by0;
        if (bw < 11 || bh < 11) continue;

        // Subdivide large blocks into 2 lots for dense realistic town layout!
        if (bw >= 20 && rng() < 0.72) {
          const half = (bw >> 1) - 1;
          lots.push({ x0: bx0, y0: by0, w: half, h: bh, isCenter: ix > 0 && iy > 0 });
          lots.push({ x0: bx0 + half + 2, y0: by0, w: bw - half - 2, h: bh, isCenter: ix > 0 && iy > 0 });
        } else if (bh >= 20 && rng() < 0.72) {
          const half = (bh >> 1) - 1;
          lots.push({ x0: bx0, y0: by0, w: bw, h: half, isCenter: ix > 0 && iy > 0 });
          lots.push({ x0: bx0, y0: by0 + half + 2, w: bw, h: bh - half - 2, isCenter: ix > 0 && iy > 0 });
        } else {
          lots.push({ x0: bx0, y0: by0, w: bw, h: bh, isCenter: ix > 0 && iy > 0 });
        }
      }
    }

    // Shuffle lots slightly so special landmarks appear in organic new places every city!
    for (let i = lots.length - 1; i > 0; i--) {
      const j = (rng() * (i + 1)) | 0;
      const tmp = lots[i];
      lots[i] = lots[j];
      lots[j] = tmp;
    }

    const specialQueue: BuildingKind[] = [
      'police',
      'supermarket',
      'hospital',
      'gas_station',
      'warehouse',
      'supermarket',
      'warehouse',
    ];

    let vehicleId = 1;
    for (let li = 0; li < lots.length; li++) {
      const lot = lots[li];
      const kind: BuildingKind = li < specialQueue.length ? specialQueue[li] : 'house';
      this.constructBuildingOnLot(lot.x0, lot.y0, lot.w, lot.h, kind, rng, () => vehicleId++);
    }

    // 4. Construct Military Quarantine Checkpoint across main northern highway entrance!
    if (this.roadXs.length > 0) {
      const mx = this.roadXs[0];
      const my = 8;
      this.constructMilitaryCheckpoint(mx, my, rng, () => vehicleId++);
    }

    // 5. Spawn abandoned cars & pile-ups along streets and intersections!
    for (let k = 0; k < 24; k++) {
      const onVert = rng() < 0.5;
      const gx = onVert
        ? this.roadXs[(rng() * this.roadXs.length) | 0] + (rng() < 0.5 ? -2 : 2)
        : 12 + rng() * (MAP_W - 28);
      const gy = onVert
        ? 14 + rng() * (MAP_H - 30)
        : this.roadYs[(rng() * this.roadYs.length) | 0] + (rng() < 0.5 ? -2 : 2);
      const ix = Math.round(gx);
      const iy = Math.round(gy);
      if (!this.inBounds(ix, iy) || this.floor[iy * MAP_W + ix] !== FLOOR_ASPHALT) continue;

      const tooClose = this.vehicles.some((v) => Math.hypot(v.x - ix, v.y - iy) < 5.5);
      if (tooClose) continue;

      const roll = rng();
      const kind: Vehicle['kind'] =
        roll < 0.14 ? 'police' : roll < 0.24 ? 'ambulance' : roll < 0.45 ? 'pickup' : 'sedan';
      this.vehicles.push({
        id: vehicleId++,
        kind,
        color: kind === 'police' ? '#253852' : kind === 'ambulance' ? '#e9ecef' : CAR_COLORS[(rng() * CAR_COLORS.length) | 0],
        x: ix + 0.5,
        y: iy + 0.5,
        vx: 0,
        vy: 0,
        axis: onVert ? 1 : 0,
        hp: 260,
        maxHp: 260,
        hasAlarm: rng() < 0.55,
        alarmTimer: 0,
        sirenOn: kind === 'police' && rng() < 0.25,
        headlightsOn: rng() < 0.35,
        burning: false,
        exploded: false,
      });
    }

    // 6. Dense Kentucky Pine & Oak Woods around town outskirts & empty yards!
    for (let y = 2; y < MAP_H - 2; y++) {
      for (let x = 2; x < MAP_W - 2; x++) {
        const idx = y * MAP_W + x;
        if (this.buildingId[idx] >= 0 || this.struct[idx] !== STRUCT_NONE || this.prop[idx] !== PROP_NONE) {
          continue;
        }
        if (this.floor[idx] !== FLOOR_GRASS && this.floor[idx] !== FLOOR_DIRT) continue;

        const outskirt =
          x < 15 || y < 15 || x > MAP_W - 18 || y > MAP_H - 18;
        const forestNoise = fbm2D(x * 0.09, y * 0.09, this.seed + 555);
        const chance = outskirt ? (forestNoise > 0.42 ? 0.44 : 0.14) : 0.035;
        if (rng() < chance) {
          this.prop[idx] = rng() < 0.58 ? PROP_TREE_PINE : PROP_TREE_OAK;
          this.fuel[idx] = 0.85;
        }
      }
    }
  }

  private setStruct(x: number, y: number, st: number): void {
    if (!this.inBounds(x, y)) return;
    const idx = y * MAP_W + x;
    this.struct[idx] = st;
    this.prop[idx] = PROP_NONE;
    this.structHp[idx] =
      st === STRUCT_WALL_CONCRETE
        ? 900
        : st === STRUCT_WALL_BRICK || st === STRUCT_WALL_STORE
          ? 650
          : st === STRUCT_WALL_WOOD
            ? 380
            : st === STRUCT_DOOR_CLOSED
              ? 135
              : st === STRUCT_WINDOW_INTACT
                ? 45
                : st === STRUCT_FENCE_WOOD || st === STRUCT_SANDBAG
                  ? 150
                  : 0;
  }

  private constructBuildingOnLot(
    lx: number,
    ly: number,
    lw: number,
    lh: number,
    kind: BuildingKind,
    rng: () => number,
    nextCarId: () => number,
  ): void {
    // Gas station: open concrete forecourt with explosive fuel pump islands + small convenience shop!
    if (kind === 'gas_station') {
      for (let y = ly; y < ly + lh; y++) {
        for (let x = lx; x < lx + lw; x++) {
          if (!this.inBounds(x, y)) continue;
          this.floor[y * MAP_W + x] = FLOOR_CONCRETE;
          this.fuel[y * MAP_W + x] = 0.15;
        }
      }
      const shopW = Math.min(9, Math.max(6, lw - 5));
      const shopH = Math.min(8, Math.max(6, (lh >> 1)));
      this.buildBoxStructure(
        lx + 1,
        ly + 1,
        shopW,
        shopH,
        'gas_station',
        'АЗС «Fossoil»',
        STRUCT_WALL_STORE,
        FLOOR_TILE_WHITE,
        '#8c3b32',
        rng,
      );
      // Explosive Gas Pump Islands!
      const py = Math.min(ly + lh - 3, ly + shopH + 3);
      for (let px = lx + 2; px < lx + lw - 2; px += 4) {
        if (this.inBounds(px, py)) {
          this.prop[py * MAP_W + px] = PROP_GAS_PUMP;
          this.fuel[py * MAP_W + px] = 2.5;
        }
      }
      if (this.inBounds(lx + 4, py + 1)) {
        this.vehicles.push({
          id: nextCarId(),
          kind: 'pickup',
          color: '#9e3b33',
          x: lx + 4.5,
          y: py + 1.5,
          vx: 0,
          vy: 0,
          axis: 0,
          hp: 250,
          maxHp: 250,
          hasAlarm: true,
          alarmTimer: 0,
          sirenOn: false,
          headlightsOn: true,
          burning: false,
          exploded: false,
        });
      }
      return;
    }

    const pad = kind === 'house' ? 2 : 1;
    const bw = Math.max(7, Math.min(kind === 'house' ? 11 : 15, lw - pad * 2));
    const bh = Math.max(7, Math.min(kind === 'house' ? 10 : 14, lh - pad * 2));
    const bx = lx + ((lw - bw) >> 1);
    const by = ly + ((lh - bh) >> 1);

    // Optional parking asphalt apron or wooden backyard fence
    if (kind !== 'house') {
      for (let y = ly; y < ly + lh; y++) {
        for (let x = lx; x < lx + lw; x++) {
          if (this.inBounds(x, y)) {
            this.floor[y * MAP_W + x] = FLOOR_GRAVEL;
            this.fuel[y * MAP_W + x] = 0;
          }
        }
      }
    } else if (rng() < 0.65) {
      // Suburban wooden backyard fence!
      for (let x = lx; x < lx + lw; x++) {
        if (x % 5 !== 2) this.setStruct(x, ly + lh - 1, STRUCT_FENCE_WOOD);
      }
    }

    const meta: Record<
      Exclude<BuildingKind, 'gas_station' | 'military'>,
      { title: string[]; wall: number; flr: number; roof: string }
    > = {
      house: {
        title: ['Жилой коттедж', 'Дом семьи Смит', 'Двухкомнатный дом', 'Загородный дом', 'Старый особняк'],
        wall: rng() < 0.55 ? STRUCT_WALL_WOOD : STRUCT_WALL_BRICK,
        flr: rng() < 0.7 ? FLOOR_WOOD : FLOOR_CARPET,
        roof: rng() < 0.5 ? '#4a3b34' : '#3a4247',
      },
      police: {
        title: ['Полицейский участок Нокс'],
        wall: STRUCT_WALL_BRICK,
        flr: FLOOR_CONCRETE,
        roof: '#2d3a4a',
      },
      supermarket: {
        title: ['Супермаркет «GigaMart»', 'Универсам «Пятёрочка Нокс»'],
        wall: STRUCT_WALL_STORE,
        flr: FLOOR_TILE_WHITE,
        roof: '#5c3a34',
      },
      hospital: {
        title: ['Клиника «Кортман Медикал»'],
        wall: STRUCT_WALL_CONCRETE,
        flr: FLOOR_TILE_WHITE,
        roof: '#3b4d54',
      },
      warehouse: {
        title: ['Склад «МакКой Лес»', 'Стройбаза и Хозтовары'],
        wall: STRUCT_WALL_CONCRETE,
        flr: FLOOR_CONCRETE,
        roof: '#494742',
      },
    };

    const spec = meta[kind as Exclude<BuildingKind, 'gas_station' | 'military'>];
    const title = spec.title[(rng() * spec.title.length) | 0];
    this.buildBoxStructure(bx, by, bw, bh, kind, title, spec.wall, spec.flr, spec.roof, rng);

    // Park emergency vehicles outside Police & Hospital!
    if ((kind === 'police' || kind === 'hospital') && this.inBounds(bx + 2, ly + lh - 1)) {
      this.vehicles.push({
        id: nextCarId(),
        kind: kind === 'police' ? 'police' : 'ambulance',
        color: kind === 'police' ? '#253852' : '#f1f5f9',
        x: bx + 2.5,
        y: ly + lh - 0.5,
        vx: 0,
        vy: 0,
        axis: 0,
        hp: 300,
        maxHp: 300,
        hasAlarm: true,
        alarmTimer: 0,
        sirenOn: false,
        headlightsOn: true,
        burning: false,
        exploded: false,
      });
    }
  }

  private buildBoxStructure(
    bx: number,
    by: number,
    bw: number,
    bh: number,
    kind: BuildingKind,
    name: string,
    wallType: number,
    floorType: number,
    roofColor: string,
    rng: () => number,
  ): void {
    const id = this.buildings.length;
    this.buildings.push({
      id,
      kind,
      name,
      x0: bx,
      y0: by,
      w: bw,
      h: bh,
      roofColor,
      wallStyle: wallType,
      isSafehouse: false,
      safehouseSquad: -1,
      survivorsInside: 0,
      zombiesInside: 0,
      alarmTriggered: false,
      alarmTimer: 0,
    });

    // Floor & perimeter walls
    for (let y = by; y < by + bh; y++) {
      for (let x = bx; x < bx + bw; x++) {
        if (!this.inBounds(x, y)) continue;
        const idx = y * MAP_W + x;
        this.buildingId[idx] = id;
        this.floor[idx] = floorType;
        this.prop[idx] = PROP_NONE;
        this.fuel[idx] = wallType === STRUCT_WALL_WOOD ? 0.9 : 0.45;

        const onEdge = x === bx || x === bx + bw - 1 || y === by || y === by + bh - 1;
        if (onEdge) {
          this.setStruct(x, y, wallType);
        } else {
          this.struct[idx] = STRUCT_NONE;
        }
      }
    }

    // Internal partition wall + interior door for realistic rooms!
    if (bw >= 9 && bh >= 8 && kind !== 'supermarket' && kind !== 'warehouse') {
      const splitX = bx + (bw >> 1);
      const doorY = by + (bh >> 1);
      for (let y = by + 1; y < by + bh - 1; y++) {
        this.setStruct(splitX, y, y === doorY ? STRUCT_DOOR_OPEN : wallType);
      }
      // Kitchen / bathroom tile in right half!
      for (let y = by + 1; y < by + bh - 1; y++) {
        for (let x = splitX + 1; x < bx + bw - 1; x++) {
          this.floor[y * MAP_W + x] = FLOOR_TILE_WHITE;
        }
      }
    }

    // Exterior doors (front + back) & Glass Windows around perimeter!
    const doorBottomX = bx + 2 + ((rng() * Math.max(1, bw - 4)) | 0);
    const doorTopX = bx + 2 + ((rng() * Math.max(1, bw - 4)) | 0);
    this.setStruct(doorBottomX, by + bh - 1, rng() < 0.25 ? STRUCT_DOOR_OPEN : STRUCT_DOOR_CLOSED);
    this.setStruct(doorTopX, by, STRUCT_DOOR_CLOSED);

    for (let x = bx + 2; x < bx + bw - 2; x += 3) {
      if (Math.abs(x - doorBottomX) >= 2) {
        this.setStruct(x, by + bh - 1, rng() < 0.12 ? STRUCT_WINDOW_BROKEN : STRUCT_WINDOW_INTACT);
      }
      if (Math.abs(x - doorTopX) >= 2) {
        this.setStruct(x, by, STRUCT_WINDOW_INTACT);
      }
    }
    for (let y = by + 2; y < by + bh - 2; y += 3) {
      this.setStruct(bx, y, STRUCT_WINDOW_INTACT);
      this.setStruct(bx + bw - 1, y, rng() < 0.12 ? STRUCT_WINDOW_BROKEN : STRUCT_WINDOW_INTACT);
    }

    // Furnish interiors with rich Project Zomboid loot containers!
    for (let y = by + 1; y < by + bh - 1; y++) {
      for (let x = bx + 1; x < bx + bw - 1; x++) {
        const idx = y * MAP_W + x;
        if (this.struct[idx] !== STRUCT_NONE) continue;
        // Keep doorway aisles clear
        if (x === doorBottomX || x === doorTopX) continue;

        const nearWall = x === bx + 1 || x === bx + bw - 2 || y === by + 1 || y === by + bh - 2;
        if (kind === 'supermarket') {
          if (x % 2 === 0 && y > by + 1 && y < by + bh - 2) {
            this.prop[idx] = y === by + 2 ? PROP_FRIDGE : PROP_SHELF;
            this.loot[idx] = 6;
          }
        } else if (kind === 'police') {
          if (nearWall && rng() < 0.34) {
            this.prop[idx] = PROP_GUN_LOCKER;
            this.loot[idx] = 7;
          }
        } else if (kind === 'hospital') {
          if (nearWall && rng() < 0.35) {
            this.prop[idx] = rng() < 0.6 ? PROP_MED_CABINET : PROP_BED;
            this.loot[idx] = 6;
          }
        } else if (kind === 'warehouse') {
          if (rng() < 0.25) {
            this.prop[idx] = PROP_CRATE;
            this.loot[idx] = 6;
          }
        } else if (kind === 'gas_station') {
          if (nearWall && rng() < 0.35) {
            this.prop[idx] = rng() < 0.5 ? PROP_FRIDGE : PROP_SHELF;
            this.loot[idx] = 5;
          }
        } else {
          // Suburban house: fridge, beds, storage crates!
          if (nearWall && rng() < 0.24) {
            const r = rng();
            this.prop[idx] = r < 0.34 ? PROP_FRIDGE : r < 0.68 ? PROP_BED : PROP_CRATE;
            this.loot[idx] = this.prop[idx] === PROP_BED ? 2 : 5;
          }
        }
      }
    }

    // Outside trash bin near back door
    if (this.inBounds(bx - 1, by + 1) && this.struct[(by + 1) * MAP_W + (bx - 1)] === STRUCT_NONE) {
      this.prop[(by + 1) * MAP_W + (bx - 1)] = PROP_TRASH_BIN;
    }
  }

  private constructMilitaryCheckpoint(mx: number, my: number, rng: () => number, nextCarId: () => number): void {
    const bx = Math.max(4, mx - 8);
    const bw = 17;
    const bh = 7;
    const id = this.buildings.length;
    this.buildings.push({
      id,
      kind: 'military',
      name: 'Армейский блокпост КЗО',
      x0: bx,
      y0: my,
      w: bw,
      h: bh,
      roofColor: '#3f4a36',
      wallStyle: STRUCT_WALL_CONCRETE,
      isSafehouse: true,
      safehouseSquad: 99,
      survivorsInside: 0,
      zombiesInside: 0,
      alarmTriggered: false,
      alarmTimer: 0,
    });

    // Sandbag barricades across highway + command bunker + ammo crates!
    for (let x = bx; x < bx + bw; x++) {
      if (Math.abs(x - mx) <= 5 && x !== mx) {
        this.setStruct(x, my + bh, STRUCT_SANDBAG);
      } else if (Math.abs(x - mx) > 5) {
        this.setStruct(x, my + bh, STRUCT_FENCE_CHAIN);
      }
    }

    this.buildBoxStructure(
      bx + 1,
      my,
      6,
      5,
      'military',
      'Штаб КЗО «Дельта»',
      STRUCT_WALL_CONCRETE,
      FLOOR_CONCRETE,
      '#3f4a36',
      rng,
    );

    if (this.inBounds(mx + 2, my + 2)) {
      this.prop[(my + 2) * MAP_W + (mx + 2)] = PROP_GUN_LOCKER;
      this.loot[(my + 2) * MAP_W + (mx + 2)] = 8;
    }
    if (this.inBounds(mx - 2, my + 3)) {
      this.vehicles.push({
        id: nextCarId(),
        kind: 'pickup',
        color: '#46543a',
        x: mx - 1.5,
        y: my + 3.5,
        vx: 0,
        vy: 0,
        axis: 0,
        hp: 340,
        maxHp: 340,
        hasAlarm: false,
        alarmTimer: 0,
        sirenOn: false,
        headlightsOn: true,
        burning: false,
        exploded: false,
      });
    }
  }
}
