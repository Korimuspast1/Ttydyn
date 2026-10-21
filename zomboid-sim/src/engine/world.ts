import { fbm2D, hash2D, mulberry32 } from './noise';
import {
  BuildingInfo,
  BuildingKind,
  CHUNK_AREA,
  CHUNK_MASK,
  CHUNK_SHIFT,
  CHUNK_SIZE,
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
  isOpaqueWallStruct,
  PROP_BED,
  PROP_BARREL_FIRE,
  PROP_CORPSE,
  PROP_CRATE,
  PROP_FRIDGE,
  PROP_GAS_PUMP,
  PROP_GENERATOR,
  PROP_GUN_LOCKER,
  PROP_HYDRANT,
  PROP_LOG_PILE,
  PROP_MED_CABINET,
  PROP_NONE,
  PROP_SHELF,
  PROP_STREETLIGHT,
  PROP_TRASH_BIN,
  PROP_TREE_OAK,
  PROP_TREE_PINE,
  PROP_WORKBENCH,
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

export const COUNTY_NAMES = [
  'Малдро',
  'Вест-Пойнт',
  'Роузвуд',
  'Риверсайд',
  'Марч-Ридж',
  'Фолллейк',
  'Ирвингтон',
  'Эхо-Крик',
];

const HOUSE_SURNAMES = [
  'Смит',
  'Миллер',
  'Картер',
  'Браун',
  'Тейлор',
  'Уилсон',
  'Дэвис',
  'Мур',
  'Кларк',
  'Холл',
  'Янг',
  'Кинг',
];

const CAR_COLORS = ['#7f2d2d', '#2f4b69', '#4a5749', '#b8b2a6', '#8c6d32', '#3d3f45', '#5e4963'];

export class WorldChunk {
  public floor = new Uint8Array(CHUNK_AREA);
  public struct = new Uint8Array(CHUNK_AREA);
  public structHp = new Uint16Array(CHUNK_AREA);
  public barricade = new Uint8Array(CHUNK_AREA);
  public prop = new Uint8Array(CHUNK_AREA);
  public loot = new Uint8Array(CHUNK_AREA);
  public buildingId = new Int16Array(CHUNK_AREA).fill(-1);
  public fire = new Float32Array(CHUNK_AREA);
  public fuel = new Float32Array(CHUNK_AREA);
  public scorch = new Float32Array(CHUNK_AREA);
  public blood = new Float32Array(CHUNK_AREA);
  public variation = new Uint8Array(CHUNK_AREA);

  constructor(public readonly cx: number, public readonly cy: number) {}
}

export class CityWorld {
  public seed = 1;
  public townName = 'Малдро';
  public policeStationId = 0;

  public chunks = new Map<string, WorldChunk>();
  public buildings: BuildingInfo[] = [];
  public vehicles: Vehicle[] = [];
  private nextVehicleId = 1;

  // Hook fired whenever a brand-new chunk streams in so ZomboidSimulation populates street hordes/survivors!
  public onChunkGenerated?: (cx: number, cy: number, newBuildingIds: number[]) => void;

  // Fast 1-slot MRU cache so consecutive tile lookups run in ~2ns without string allocation!
  private cachedCx = 999999;
  private cachedCy = 999999;
  private cachedChunk: WorldChunk | null = null;
  private generatingSet = new Set<string>();

  constructor() {
    this.generateRandomCity();
  }

  public getChunk(cx: number, cy: number): WorldChunk {
    if (cx === this.cachedCx && cy === this.cachedCy && this.cachedChunk) {
      return this.cachedChunk;
    }
    const key = `${cx},${cy}`;
    let ch = this.chunks.get(key);
    if (!ch) {
      ch = new WorldChunk(cx, cy);
      this.chunks.set(key, ch);
      if (!this.generatingSet.has(key)) {
        this.generatingSet.add(key);
        this.populateChunkTerrainAndStructures(ch, cx, cy);
        this.generatingSet.delete(key);
      }
    }
    this.cachedCx = cx;
    this.cachedCy = cy;
    this.cachedChunk = ch;
    return ch;
  }

  public ensureAreaLoaded(centerWx: number, centerWy: number, radiusChunks = 2): void {
    const ccx = Math.floor(centerWx) >> CHUNK_SHIFT;
    const ccy = Math.floor(centerWy) >> CHUNK_SHIFT;
    for (let dy = -radiusChunks; dy <= radiusChunks; dy++) {
      for (let dx = -radiusChunks; dx <= radiusChunks; dx++) {
        this.getChunk(ccx + dx, ccy + dy);
      }
    }
  }

  // ═══ INFINITE WORLD ACCESSORS (Work for ANY integer gx, gy in -∞ .. +∞!) ═══
  public getFloor(gx: number, gy: number): number {
    return this.getChunk(gx >> CHUNK_SHIFT, gy >> CHUNK_SHIFT).floor[((gy & CHUNK_MASK) << CHUNK_SHIFT) | (gx & CHUNK_MASK)];
  }
  public setFloor(gx: number, gy: number, v: number): void {
    this.getChunk(gx >> CHUNK_SHIFT, gy >> CHUNK_SHIFT).floor[((gy & CHUNK_MASK) << CHUNK_SHIFT) | (gx & CHUNK_MASK)] = v;
  }

  public getStruct(gx: number, gy: number): number {
    return this.getChunk(gx >> CHUNK_SHIFT, gy >> CHUNK_SHIFT).struct[((gy & CHUNK_MASK) << CHUNK_SHIFT) | (gx & CHUNK_MASK)];
  }

  public setStruct(gx: number, gy: number, st: number): void {
    const ch = this.getChunk(gx >> CHUNK_SHIFT, gy >> CHUNK_SHIFT);
    const off = ((gy & CHUNK_MASK) << CHUNK_SHIFT) | (gx & CHUNK_MASK);
    ch.struct[off] = st;
    ch.barricade[off] = 0;
    if (st === STRUCT_WALL_CONCRETE) ch.structHp[off] = 900;
    else if (st === STRUCT_WALL_BRICK) ch.structHp[off] = 650;
    else if (st === STRUCT_WALL_STORE) ch.structHp[off] = 520;
    else if (st === STRUCT_WALL_WOOD) ch.structHp[off] = 320;
    else if (st === STRUCT_SANDBAG) ch.structHp[off] = 240;
    else if (st === STRUCT_FENCE_WOOD) ch.structHp[off] = 150;
    else if (st === STRUCT_FENCE_CHAIN) ch.structHp[off] = 420;
    else if (st === STRUCT_DOOR_CLOSED) ch.structHp[off] = 175;
    else if (st === STRUCT_WINDOW_INTACT) ch.structHp[off] = 45;
    else ch.structHp[off] = 0;
  }

  public getStructHp(gx: number, gy: number): number {
    return this.getChunk(gx >> CHUNK_SHIFT, gy >> CHUNK_SHIFT).structHp[((gy & CHUNK_MASK) << CHUNK_SHIFT) | (gx & CHUNK_MASK)];
  }
  public setStructHp(gx: number, gy: number, hp: number): void {
    this.getChunk(gx >> CHUNK_SHIFT, gy >> CHUNK_SHIFT).structHp[((gy & CHUNK_MASK) << CHUNK_SHIFT) | (gx & CHUNK_MASK)] = Math.max(0, hp | 0);
  }

  public getBarricade(gx: number, gy: number): number {
    return this.getChunk(gx >> CHUNK_SHIFT, gy >> CHUNK_SHIFT).barricade[((gy & CHUNK_MASK) << CHUNK_SHIFT) | (gx & CHUNK_MASK)];
  }
  public setBarricade(gx: number, gy: number, planks: number): void {
    this.getChunk(gx >> CHUNK_SHIFT, gy >> CHUNK_SHIFT).barricade[((gy & CHUNK_MASK) << CHUNK_SHIFT) | (gx & CHUNK_MASK)] = Math.max(0, Math.min(4, planks | 0));
  }

  public getProp(gx: number, gy: number): number {
    return this.getChunk(gx >> CHUNK_SHIFT, gy >> CHUNK_SHIFT).prop[((gy & CHUNK_MASK) << CHUNK_SHIFT) | (gx & CHUNK_MASK)];
  }
  public setProp(gx: number, gy: number, p: number): void {
    this.getChunk(gx >> CHUNK_SHIFT, gy >> CHUNK_SHIFT).prop[((gy & CHUNK_MASK) << CHUNK_SHIFT) | (gx & CHUNK_MASK)] = p;
  }

  public getLoot(gx: number, gy: number): number {
    return this.getChunk(gx >> CHUNK_SHIFT, gy >> CHUNK_SHIFT).loot[((gy & CHUNK_MASK) << CHUNK_SHIFT) | (gx & CHUNK_MASK)];
  }
  public setLoot(gx: number, gy: number, l: number): void {
    this.getChunk(gx >> CHUNK_SHIFT, gy >> CHUNK_SHIFT).loot[((gy & CHUNK_MASK) << CHUNK_SHIFT) | (gx & CHUNK_MASK)] = Math.max(0, l | 0);
  }

  public getBuildingId(gx: number, gy: number): number {
    return this.getChunk(gx >> CHUNK_SHIFT, gy >> CHUNK_SHIFT).buildingId[((gy & CHUNK_MASK) << CHUNK_SHIFT) | (gx & CHUNK_MASK)];
  }
  public setBuildingId(gx: number, gy: number, bId: number): void {
    this.getChunk(gx >> CHUNK_SHIFT, gy >> CHUNK_SHIFT).buildingId[((gy & CHUNK_MASK) << CHUNK_SHIFT) | (gx & CHUNK_MASK)] = bId;
  }

  public getFire(gx: number, gy: number): number {
    return this.getChunk(gx >> CHUNK_SHIFT, gy >> CHUNK_SHIFT).fire[((gy & CHUNK_MASK) << CHUNK_SHIFT) | (gx & CHUNK_MASK)];
  }
  public setFire(gx: number, gy: number, v: number): void {
    this.getChunk(gx >> CHUNK_SHIFT, gy >> CHUNK_SHIFT).fire[((gy & CHUNK_MASK) << CHUNK_SHIFT) | (gx & CHUNK_MASK)] = v;
  }

  public getFuel(gx: number, gy: number): number {
    return this.getChunk(gx >> CHUNK_SHIFT, gy >> CHUNK_SHIFT).fuel[((gy & CHUNK_MASK) << CHUNK_SHIFT) | (gx & CHUNK_MASK)];
  }
  public setFuel(gx: number, gy: number, v: number): void {
    this.getChunk(gx >> CHUNK_SHIFT, gy >> CHUNK_SHIFT).fuel[((gy & CHUNK_MASK) << CHUNK_SHIFT) | (gx & CHUNK_MASK)] = v;
  }

  public addBlood(gx: number, gy: number, amount: number): void {
    const ch = this.getChunk(gx >> CHUNK_SHIFT, gy >> CHUNK_SHIFT);
    const off = ((gy & CHUNK_MASK) << CHUNK_SHIFT) | (gx & CHUNK_MASK);
    ch.blood[off] = Math.min(1.0, ch.blood[off] + amount);
  }
  public getBlood(gx: number, gy: number): number {
    return this.getChunk(gx >> CHUNK_SHIFT, gy >> CHUNK_SHIFT).blood[((gy & CHUNK_MASK) << CHUNK_SHIFT) | (gx & CHUNK_MASK)];
  }

  public addScorch(gx: number, gy: number, amount: number): void {
    const ch = this.getChunk(gx >> CHUNK_SHIFT, gy >> CHUNK_SHIFT);
    const off = ((gy & CHUNK_MASK) << CHUNK_SHIFT) | (gx & CHUNK_MASK);
    ch.scorch[off] = Math.min(1.0, ch.scorch[off] + amount);
  }
  public getScorch(gx: number, gy: number): number {
    return this.getChunk(gx >> CHUNK_SHIFT, gy >> CHUNK_SHIFT).scorch[((gy & CHUNK_MASK) << CHUNK_SHIFT) | (gx & CHUNK_MASK)];
  }

  public getVariation(gx: number, gy: number): number {
    return this.getChunk(gx >> CHUNK_SHIFT, gy >> CHUNK_SHIFT).variation[((gy & CHUNK_MASK) << CHUNK_SHIFT) | (gx & CHUNK_MASK)];
  }

  /**
   * Strict solid collision query used by Circle-vs-Tile physics & AI navigation:
   * NOBODY can ever walk through walls, closed doors, intact/barricaded windows, water, or solid furniture!
   */
  public isTileSolidForMovement(gx: number, gy: number, isHuman: boolean): boolean {
    const ch = this.getChunk(gx >> CHUNK_SHIFT, gy >> CHUNK_SHIFT);
    const off = ((gy & CHUNK_MASK) << CHUNK_SHIFT) | (gx & CHUNK_MASK);

    if (ch.floor[off] === FLOOR_WATER) return true;

    const st = ch.struct[off];
    if (isOpaqueWallStruct(st) || st === STRUCT_FENCE_CHAIN) return true;
    if (ch.barricade[off] > 0) return true; // Nailed planks block BOTH zombies and humans until cleared!

    if (st === STRUCT_WINDOW_INTACT || st === STRUCT_FENCE_WOOD || st === STRUCT_SANDBAG) {
      return true;
    }

    if (st === STRUCT_DOOR_CLOSED) {
      // Closed doors physically block everyone until opened by a human hand or smashed by a zombie!
      return !isHuman;
    }

    // Heavy solid props (fridges, shelves, lockers, gas pumps) also have real physical collision!
    const prop = ch.prop[off];
    if (
      prop === PROP_GAS_PUMP ||
      prop === PROP_FRIDGE ||
      prop === PROP_SHELF ||
      prop === PROP_GUN_LOCKER ||
      prop === PROP_MED_CABINET
    ) {
      return true;
    }

    return false;
  }

  /**
   * Strict ballistic wall check:
   * Bullets and Line-of-Sight NEVER pass through solid walls (`Brick`, `Wood`, `Concrete`, `Store`) or closed doors!
   * Windows and low fences/sandbags allow shooting through (shattering glass on impact!).
   */
  public blocksBulletsAndSight(gx: number, gy: number): boolean {
    const st = this.getStruct(gx, gy);
    return isOpaqueWallStruct(st) || st === STRUCT_DOOR_CLOSED;
  }

  public generateRandomCity(): void {
    this.seed = ((Math.random() * 0x7fffffff) | 0) ^ ((Date.now() & 0xffff) << 7);
    this.townName = COUNTY_NAMES[Math.abs(this.seed) % COUNTY_NAMES.length];
    this.chunks.clear();
    this.buildings = [];
    this.vehicles = [];
    this.nextVehicleId = 1;
    this.cachedChunk = null;
    this.cachedCx = 999999;

    // Preload initial 5x5 chunk region (-2..+2, -2..+2 -> 160x160 tiles) around Origin (0,0)
    // ALWAYS generating Central Police Station (Squad #1 HQ) first at chunk (0, 0)!
    this.getChunk(0, 0);
    for (let cy = -2; cy <= 2; cy++) {
      for (let cx = -2; cx <= 2; cx++) {
        if (cx === 0 && cy === 0) continue;
        this.getChunk(cx, cy);
      }
    }
  }

  public spawnVehicle(
    x: number,
    y: number,
    kind: Vehicle['kind'],
    axis: 0 | 1,
    color?: string,
    sirenOn = false,
  ): Vehicle {
    const maxHp = kind === 'police' || kind === 'pickup' ? 320 : kind === 'ambulance' ? 350 : 250;
    const v: Vehicle = {
      id: this.nextVehicleId++,
      kind,
      color: color || CAR_COLORS[this.nextVehicleId % CAR_COLORS.length],
      x,
      y,
      vx: 0,
      vy: 0,
      axis,
      hp: maxHp,
      maxHp,
      hasAlarm: kind !== 'pickup' || Math.random() < 0.5,
      alarmTimer: 0,
      sirenOn,
      headlightsOn: sirenOn || Math.random() < 0.35,
      burning: false,
      glassBroken: false,
      hitFlash: 0,
      exploded: false,
    };
    this.vehicles.push(v);
    return v;
  }

  // ═══ PROCEDURAL INFINITE CHUNK STREAMING GENERATOR ═══
  private populateChunkTerrainAndStructures(ch: WorldChunk, cx: number, cy: number): void {
    const chunkSeed = (this.seed ^ Math.imul(cx, 374761393) ^ Math.imul(cy, 668265263)) >>> 0;
    const rng = mulberry32(chunkSeed);
    const baseWx = cx << CHUNK_SHIFT;
    const baseWy = cy << CHUNK_SHIFT;
    const newBldgIds: number[] = [];

    // Continuous infinite road grid along chunk borders:
    // Every chunk has an arterial street along lx in [1..5] (when cx%1 == 0 every 1 or 2 chunks)
    // Specifically: primary highways every chunk at lx = 2..6 (NS) when (cx & 1) === 0, and ly = 2..6 (EW) when (cy & 1) === 0!
    const hasRoadNS = (cx & 1) === 0;
    const hasRoadEW = (cy & 1) === 0;

    // Regional urbanization density from low-frequency 2D FBM (origin -2..2 is ALWAYS a major town!)
    const distOrigin = Math.hypot(cx, cy);
    const townNoise = fbm2D(cx * 0.28 + 11.3, cy * 0.28 - 4.7, this.seed, 3);
    const isUrbanChunk = distOrigin <= 2.3 || townNoise > 0.52;

    // 1. Base Ground, Infinite Rivers (outside immediate origin square), Sidewalks & Diagonal Dashed Roads
    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      const gy = baseWy + ly;
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const gx = baseWx + lx;
        const off = (ly << CHUNK_SHIFT) | lx;
        ch.variation[off] = (hash2D(gx, gy, this.seed) * 255) | 0;

        const onNS = hasRoadNS && lx >= 2 && lx <= 6;
        const onEW = hasRoadEW && ly >= 2 && ly <= 6;
        const onSidewalk =
          (hasRoadNS && (lx === 1 || lx === 7)) || (hasRoadEW && (ly === 1 || ly === 7));

        // Winding infinite river far enough from the starting Police Station
        const riverVal = Math.abs(fbm2D(gx * 0.014, gy * 0.014, this.seed ^ 0x55aa, 3) - 0.5);
        const isRiver = distOrigin > 2.6 && riverVal < 0.022;

        if (onNS || onEW) {
          if (isRiver) {
            // Concrete highway bridge deck across rivers!
            ch.floor[off] = FLOOR_CONCRETE;
          } else {
            const centerNS = onNS && !onEW && lx === 4 && (gy & 3) < 2;
            const centerEW = onEW && !onNS && ly === 4 && (gx & 3) < 2;
            ch.floor[off] = centerNS || centerEW ? FLOOR_ROAD_LINE : FLOOR_ASPHALT;
          }
          ch.fuel[off] = 0.02;
        } else if (onSidewalk) {
          ch.floor[off] = isRiver ? FLOOR_CONCRETE : FLOOR_SIDEWALK;
          ch.fuel[off] = 0.04;
          if (isRiver && ((hasRoadNS && (lx === 1 || lx === 7)) || (hasRoadEW && (ly === 1 || ly === 7)))) {
            ch.struct[off] = STRUCT_FENCE_CHAIN;
            ch.structHp[off] = 420;
          }
        } else if (isRiver) {
          ch.floor[off] = FLOOR_WATER;
          ch.fuel[off] = 0.0;
        } else {
          const dirtN = fbm2D(gx * 0.09, gy * 0.09, this.seed ^ 0x1234, 2);
          ch.floor[off] = dirtN > 0.68 ? FLOOR_DIRT : FLOOR_GRASS;
          ch.fuel[off] = 0.32;
        }
      }
    }

    // Streetlamps at sidewalks along roads
    if (hasRoadNS) {
      for (const ly of [9, 23]) {
        const off = (ly << CHUNK_SHIFT) | 1;
        if (ch.floor[off] === FLOOR_SIDEWALK && ch.struct[off] === STRUCT_NONE) {
          ch.prop[off] = PROP_STREETLIGHT;
        }
      }
    }
    if (hasRoadEW) {
      for (const lx of [9, 23]) {
        const off = (1 << CHUNK_SHIFT) | lx;
        if (ch.floor[off] === FLOOR_SIDEWALK && ch.struct[off] === STRUCT_NONE) {
          ch.prop[off] = PROP_STREETLIGHT;
        }
      }
    }

    // 2. Guaranteed Central Police Station HQ for ГРУППА №1 in Origin Chunk (0, 0)!
    const lotX = baseWx + 10;
    const lotY = baseWy + 10;

    if (cx === 0 && cy === 0) {
      const hqId = this.createBuildingBox(
        lotX,
        lotY,
        14,
        12,
        'police',
        `Полицейский участок ${this.townName}`,
        STRUCT_WALL_BRICK,
        FLOOR_TILE_WHITE,
        '#364958',
        rng,
        true,
        1, // ALWAYS SQUAD #1!
        42, // Starting lumber stock so Squad #1 begins building room extensions promptly!
      );
      this.policeStationId = hqId;
      newBldgIds.push(hqId);

      // Two parked Police Cruisers right outside Squad #1's station!
      this.spawnVehicle(baseWx + 5.5, baseWy + 13.5, 'police', 1, '#2b4570', true);
      this.spawnVehicle(baseWx + 5.5, baseWy + 19.5, 'police', 1, '#2b4570', false);
    } else if (isUrbanChunk) {
      // Guaranteed landmarks around starting downtown + procedural buildings in infinite satellite towns!
      let kind: BuildingKind = 'house';
      if (cx === 1 && cy === 0) kind = 'supermarket';
      else if (cx === 0 && cy === 1) kind = 'hospital';
      else if (cx === -1 && cy === 0) kind = 'gas_station';
      else if (cx === 0 && cy === -2) kind = 'military';
      else if (cx === 1 && cy === 1) kind = 'warehouse';
      else {
        const roll = rng();
        if (roll < 0.56) kind = 'house';
        else if (roll < 0.68) kind = 'supermarket';
        else if (roll < 0.78) kind = 'warehouse';
        else if (roll < 0.87) kind = 'gas_station';
        else if (roll < 0.94) kind = 'hospital';
        else kind = 'military';
      }

      if (kind === 'gas_station') {
        const id = this.constructGasStationLot(lotX, lotY, rng);
        if (id >= 0) newBldgIds.push(id);
      } else if (kind === 'house') {
        // Fit 1 or 2 cozy family houses on the 20x20 urban block!
        const w1 = 9 + ((rng() * 3) | 0);
        const h1 = 8 + ((rng() * 3) | 0);
        const surname1 = HOUSE_SURNAMES[(rng() * HOUSE_SURNAMES.length) | 0];
        const id1 = this.createBuildingBox(
          lotX,
          lotY,
          w1,
          h1,
          'house',
          `Дом семьи ${surname1}`,
          rng() < 0.45 ? STRUCT_WALL_BRICK : STRUCT_WALL_WOOD,
          FLOOR_WOOD,
          rng() < 0.5 ? '#5c4033' : '#4a5568',
          rng,
          false,
          0,
          14,
        );
        newBldgIds.push(id1);

        if (rng() < 0.72) {
          const surname2 = HOUSE_SURNAMES[(rng() * HOUSE_SURNAMES.length) | 0];
          const id2 = this.createBuildingBox(
            lotX + 11,
            lotY + 10,
            9,
            9,
            'house',
            `Коттедж ${surname2}`,
            STRUCT_WALL_WOOD,
            FLOOR_CARPET,
            '#4f5d4e',
            rng,
            false,
            0,
            12,
          );
          newBldgIds.push(id2);
        }
      } else if (kind === 'supermarket') {
        newBldgIds.push(
          this.createBuildingBox(
            lotX,
            lotY,
            15,
            13,
            'supermarket',
            'Универсам «Пятёрочка Нокс»',
            STRUCT_WALL_STORE,
            FLOOR_TILE_WHITE,
            '#4a5759',
            rng,
          ),
        );
      } else if (kind === 'hospital') {
        newBldgIds.push(
          this.createBuildingBox(
            lotX,
            lotY,
            14,
            12,
            'hospital',
            'Клиника Св. Марии',
            STRUCT_WALL_CONCRETE,
            FLOOR_TILE_WHITE,
            '#5c6b73',
            rng,
          ),
        );
      } else if (kind === 'warehouse') {
        newBldgIds.push(
          this.createBuildingBox(
            lotX,
            lotY,
            15,
            13,
            'warehouse',
            'Стройбаза и Склад Кентукки',
            STRUCT_WALL_CONCRETE,
            FLOOR_CONCRETE,
            '#495057',
            rng,
          ),
        );
      } else if (kind === 'military') {
        newBldgIds.push(
          this.createBuildingBox(
            lotX,
            lotY,
            14,
            10,
            'military',
            'Армейский блокпост КЗО',
            STRUCT_WALL_CONCRETE,
            FLOOR_CONCRETE,
            '#3f4a36',
            rng,
            true,
            90 + (Math.abs(cx + cy) % 9),
            24,
          ),
        );
      }
    } else if (rng() < 0.28) {
      // Isolated woodland cabin in forest chunks!
      newBldgIds.push(
        this.createBuildingBox(
          lotX + 3,
          lotY + 3,
          8,
          8,
          'house',
          'Лесная хижина егеря',
          STRUCT_WALL_WOOD,
          FLOOR_WOOD,
          '#4a3b2c',
          rng,
        ),
      );
    }

    // 3. Scatter Pine & Oak Trees across open grass/dirt tiles (Lumber resource for expanding buildings!)
    const treeDensity = isUrbanChunk ? 0.055 : 0.22;
    for (let ly = 8; ly < CHUNK_SIZE - 1; ly++) {
      for (let lx = 8; lx < CHUNK_SIZE - 1; lx++) {
        const off = (ly << CHUNK_SHIFT) | lx;
        if (ch.buildingId[off] >= 0 || ch.struct[off] !== STRUCT_NONE || ch.prop[off] !== PROP_NONE) continue;
        if (ch.floor[off] !== FLOOR_GRASS && ch.floor[off] !== FLOOR_DIRT) continue;
        if (rng() < treeDensity) {
          ch.prop[off] = rng() < 0.58 ? PROP_TREE_PINE : PROP_TREE_OAK;
          ch.loot[off] = 4; // Wood logs yield when chopped by survivor builders!
        }
      }
    }

    // 4. Spawn Parked / Abandoned Cars on Chunk Roads (Zombies will smash & wreck them over time!)
    if (hasRoadNS && rng() < 0.78) {
      const count = 1 + (rng() < 0.45 ? 1 : 0);
      for (let k = 0; k < count; k++) {
        const vx = baseWx + (rng() < 0.5 ? 2.8 : 5.6);
        const vy = baseWy + 10 + rng() * 19;
        if (this.getFloor(vx | 0, vy | 0) !== FLOOR_WATER) {
          const r = rng();
          const vKind: Vehicle['kind'] = r < 0.14 ? 'police' : r < 0.24 ? 'ambulance' : r < 0.52 ? 'pickup' : 'sedan';
          this.spawnVehicle(vx, vy, vKind, 1);
        }
      }
    }
    if (hasRoadEW && rng() < 0.72) {
      const vx = baseWx + 10 + rng() * 19;
      const vy = baseWy + (rng() < 0.5 ? 2.8 : 5.6);
      if (this.getFloor(vx | 0, vy | 0) !== FLOOR_WATER) {
        const r = rng();
        const vKind: Vehicle['kind'] = r < 0.15 ? 'pickup' : r < 0.25 ? 'police' : 'sedan';
        this.spawnVehicle(vx, vy, vKind, 0);
      }
    }

    // Notify simulation so newly streamed chunks populate street zombies & local survivors!
    this.onChunkGenerated?.(cx, cy, newBldgIds);
  }

  private constructGasStationLot(x0: number, y0: number, rng: () => number): number {
    for (let y = y0; y < y0 + 16; y++) {
      for (let x = x0; x < x0 + 16; x++) {
        this.setFloor(x, y, FLOOR_GRAVEL);
        this.setProp(x, y, PROP_NONE);
      }
    }
    const bId = this.createBuildingBox(
      x0 + 2,
      y0 + 1,
      11,
      7,
      'gas_station',
      'АЗС «Fossoil»',
      STRUCT_WALL_BRICK,
      FLOOR_TILE_WHITE,
      '#78290f',
      rng,
    );
    // Explosive fuel pump islands out front!
    for (const px of [x0 + 4, x0 + 10]) {
      for (const py of [y0 + 10, y0 + 13]) {
        this.setProp(px, py, PROP_GAS_PUMP);
        this.setFuel(px, py, 1.0);
      }
    }
    this.spawnVehicle(x0 + 7.2, y0 + 11.5, 'pickup', 0, '#8c2f39');
    return bId;
  }

  public createBuildingBox(
    x0: number,
    y0: number,
    w: number,
    h: number,
    kind: BuildingKind,
    name: string,
    wallStyle: number,
    floorStyle: number,
    roofColor: string,
    rng: () => number,
    isSafehouse = false,
    squadId = 0,
    woodStock = 10,
  ): number {
    const id = this.buildings.length;
    const info: BuildingInfo = {
      id,
      kind,
      name,
      x0,
      y0,
      w,
      h,
      roofColor,
      wallStyle,
      isSafehouse,
      safehouseSquad: squadId,
      woodStock,
      expansions: 0,
      rooms: [{ x0, y0, w, h, roofColor }],
      survivorsInside: 0,
      zombiesInside: 0,
      alarmTriggered: false,
      alarmTimer: 0,
    };
    this.buildings.push(info);

    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        this.setBuildingId(x, y, id);
        this.setFloor(x, y, floorStyle);
        this.setProp(x, y, PROP_NONE);
        this.setFuel(x, y, wallStyle === STRUCT_WALL_WOOD ? 0.85 : 0.35);
        const border = x === x0 || x === x0 + w - 1 || y === y0 || y === y0 + h - 1;
        if (border) this.setStruct(x, y, wallStyle);
        else this.setStruct(x, y, STRUCT_NONE);
      }
    }

    // Interior dividing room wall + open interior doorway
    if (w >= 9 && h >= 8 && kind !== 'supermarket' && kind !== 'warehouse') {
      const midX = x0 + (w >> 1);
      const doorY = y0 + (h >> 1);
      for (let y = y0 + 1; y < y0 + h - 1; y++) {
        this.setStruct(midX, y, y === doorY ? STRUCT_DOOR_OPEN : wallStyle);
      }
      for (let y = y0 + 1; y < y0 + h - 1; y++) {
        for (let x = midX + 1; x < x0 + w - 1; x++) {
          this.setFloor(x, y, FLOOR_TILE_WHITE);
        }
      }
    }

    // Guaranteed navigable front & side doors so nobody ever gets trapped inside!
    const doorSouthX = x0 + 2 + ((rng() * Math.max(1, w - 4)) | 0);
    const doorWestY = y0 + 2 + ((rng() * Math.max(1, h - 4)) | 0);
    this.setStruct(doorSouthX, y0 + h - 1, STRUCT_DOOR_OPEN);
    this.setStruct(x0, doorWestY, kind === 'police' ? STRUCT_DOOR_OPEN : STRUCT_DOOR_CLOSED);

    // Windows along outer walls
    for (let x = x0 + 2; x < x0 + w - 2; x += 3) {
      if (Math.abs(x - doorSouthX) >= 2) this.setStruct(x, y0 + h - 1, STRUCT_WINDOW_INTACT);
      this.setStruct(x, y0, STRUCT_WINDOW_INTACT);
    }
    for (let y = y0 + 2; y < y0 + h - 2; y += 3) {
      if (Math.abs(y - doorWestY) >= 2) this.setStruct(x0, y, STRUCT_WINDOW_INTACT);
      this.setStruct(x0 + w - 1, y, STRUCT_WINDOW_INTACT);
    }

    // Interior furniture & loot containers placed ONLY against inner perimeter leaving wide walkways!
    for (let y = y0 + 1; y < y0 + h - 1; y++) {
      for (let x = x0 + 1; x < x0 + w - 1; x++) {
        if (this.getStruct(x, y) !== STRUCT_NONE) continue;
        // Keep doorway approaches completely clear!
        if (Math.abs(x - doorSouthX) <= 1 && y >= y0 + h - 3) continue;
        if (Math.abs(y - doorWestY) <= 1 && x <= x0 + 2) continue;

        const nearWall = y === y0 + 1 || x === x0 + w - 2;
        if (kind === 'supermarket') {
          if (x % 3 === 0 && y > y0 + 2 && y < y0 + h - 2) {
            this.setProp(x, y, y === y0 + 3 ? PROP_FRIDGE : PROP_SHELF);
            this.setLoot(x, y, 7);
          }
        } else if (kind === 'police') {
          if (nearWall && rng() < 0.42) {
            const p = rng() < 0.55 ? PROP_GUN_LOCKER : rng() < 0.8 ? PROP_CRATE : PROP_BED;
            this.setProp(x, y, p);
            this.setLoot(x, y, 8);
          }
        } else if (kind === 'hospital') {
          if (nearWall && rng() < 0.42) {
            this.setProp(x, y, rng() < 0.6 ? PROP_MED_CABINET : PROP_BED);
            this.setLoot(x, y, 7);
          }
        } else if (kind === 'warehouse') {
          if (x % 3 === 0 && y % 2 === 1) {
            this.setProp(x, y, x === x0 + 3 ? PROP_WORKBENCH : x === x0 + 6 ? PROP_LOG_PILE : PROP_CRATE);
            this.setLoot(x, y, 8);
          }
        } else if (nearWall && rng() < 0.30) {
          const r = rng();
          this.setProp(x, y, r < 0.35 ? PROP_FRIDGE : r < 0.7 ? PROP_BED : PROP_CRATE);
          this.setLoot(x, y, 5);
        }
      }
    }

    // Exterior props around buildings: trash bin, emergency generator, burning barrel, log pile & sidewalk hydrant!
    if (this.getStruct(x0 - 1, y0 + 1) === STRUCT_NONE) {
      this.setProp(x0 - 1, y0 + 1, PROP_TRASH_BIN);
    }
    if (isSafehouse) {
      if (this.getStruct(x0 + w, y0 + 2) === STRUCT_NONE) {
        this.setProp(x0 + w, y0 + 2, PROP_GENERATOR);
      }
      if (this.getStruct(x0 - 2, y0 + h - 2) === STRUCT_NONE) {
        this.setProp(x0 - 2, y0 + h - 2, PROP_BARREL_FIRE);
      }
      if (this.getStruct(x0 + w, y0 + 4) === STRUCT_NONE) {
        this.setProp(x0 + w, y0 + 4, PROP_LOG_PILE);
        this.setLoot(x0 + w, y0 + 4, 8);
      }
    }
    if (this.getStruct(x0 + 2, y0 - 2) === STRUCT_NONE && this.getFloor(x0 + 2, y0 - 2) === FLOOR_SIDEWALK) {
      this.setProp(x0 + 2, y0 - 2, PROP_HYDRANT);
    }

    return id;
  }

  /**
   * EXPAND AN EXISTING BUILDING WITH A REAL ATTACHED ROOM EXTENSION!
   * Survivors automatically build new bedrooms, storage wings, infirmaries & armories as they gather wood,
   * AND the player can also invoke this directly with the `expand_base` WorldBox tool!
   */
  public expandBuildingWithNewRoom(bId: number): { ok: boolean; roomCenter?: { x: number; y: number }; label?: string } {
    const b = this.buildings[bId];
    if (!b || b.expansions >= 12) return { ok: false };

    const rw = 6;
    const rh = 6;

    // Try attaching a new wing flush against any existing room of this building (+X, +Y, -X, -Y)
    const dirs = [
      { dx: 1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: -1 },
    ];

    for (let rIdx = b.rooms.length - 1; rIdx >= 0; rIdx--) {
      const parent = b.rooms[rIdx];
      for (const d of dirs) {
        let nx0 = parent.x0;
        let ny0 = parent.y0;
        let doorX = parent.x0;
        let doorY = parent.y0;

        if (d.dx === 1) {
          nx0 = parent.x0 + parent.w - 1; // Overlap 1 tile so shared wall merges cleanly!
          ny0 = parent.y0 + 1;
          doorX = nx0;
          doorY = ny0 + (rh >> 1);
        } else if (d.dx === -1) {
          nx0 = parent.x0 - rw + 1;
          ny0 = parent.y0 + 1;
          doorX = parent.x0;
          doorY = ny0 + (rh >> 1);
        } else if (d.dy === 1) {
          nx0 = parent.x0 + 1;
          ny0 = parent.y0 + parent.h - 1;
          doorX = nx0 + (rw >> 1);
          doorY = ny0;
        } else {
          nx0 = parent.x0 + 1;
          ny0 = parent.y0 - rh + 1;
          doorX = nx0 + (rw >> 1);
          doorY = parent.y0;
        }

        // Check that all non-shared tiles of the candidate room are clear of other buildings, roads & water!
        let clear = true;
        for (let y = ny0; y < ny0 + rh && clear; y++) {
          for (let x = nx0; x < nx0 + rw; x++) {
            const owner = this.getBuildingId(x, y);
            if (owner >= 0 && owner !== bId) {
              clear = false;
              break;
            }
            if (owner < 0) {
              const flr = this.getFloor(x, y);
              if (flr === FLOOR_WATER || flr === FLOOR_ASPHALT || flr === FLOOR_ROAD_LINE) {
                clear = false;
                break;
              }
            }
          }
        }
        if (!clear) continue;

        // BUILD THE NEW ROOM EXTENSION!
        const annexWall = b.kind === 'police' && b.expansions % 2 === 1 ? STRUCT_WALL_BRICK : STRUCT_WALL_WOOD;
        const annexRoof = annexWall === STRUCT_WALL_BRICK ? b.roofColor : '#6b4f35';

        for (let y = ny0; y < ny0 + rh; y++) {
          for (let x = nx0; x < nx0 + rw; x++) {
            const wasInsideThisBldg = this.getBuildingId(x, y) === bId && !isOpaqueWallStruct(this.getStruct(x, y));
            this.setBuildingId(x, y, bId);
            this.setFloor(x, y, FLOOR_WOOD);
            this.setProp(x, y, PROP_NONE);
            this.setLoot(x, y, 0);
            this.setFuel(x, y, 0.72);

            const isOuterRim = x === nx0 || x === nx0 + rw - 1 || y === ny0 || y === ny0 + rh - 1;
            if (isOuterRim && !wasInsideThisBldg) {
              this.setStruct(x, y, annexWall);
            } else if (!isOuterRim) {
              this.setStruct(x, y, STRUCT_NONE);
            }
          }
        }

        // Cut wide interior connecting doorway between old room and new annex wing!
        this.setStruct(doorX, doorY, STRUCT_DOOR_OPEN);

        // Add windows + 1 exterior door on outward-facing wall of the annex!
        if (d.dx === 1) {
          this.setStruct(nx0 + rw - 1, ny0 + 2, STRUCT_WINDOW_INTACT);
          this.setStruct(nx0 + 2, ny0 + rh - 1, STRUCT_DOOR_OPEN);
        } else if (d.dx === -1) {
          this.setStruct(nx0, ny0 + 2, STRUCT_WINDOW_INTACT);
          this.setStruct(nx0 + 2, ny0 + rh - 1, STRUCT_DOOR_OPEN);
        } else if (d.dy === 1) {
          this.setStruct(nx0 + 2, ny0 + rh - 1, STRUCT_WINDOW_INTACT);
          this.setStruct(nx0 + rw - 1, ny0 + 2, STRUCT_DOOR_OPEN);
        } else {
          this.setStruct(nx0 + 2, ny0, STRUCT_WINDOW_INTACT);
          this.setStruct(nx0 + rw - 1, ny0 + 2, STRUCT_DOOR_OPEN);
        }

        // Furnish new room according to expansion specialty!
        const expType = b.expansions % 4;
        const propType =
          expType === 0 ? PROP_BED : expType === 1 ? PROP_GUN_LOCKER : expType === 2 ? PROP_MED_CABINET : PROP_WORKBENCH;
        const roleTitle =
          expType === 0 ? 'Казарма' : expType === 1 ? 'Оружейная' : expType === 2 ? 'Лазарет' : 'Мастерская';

        this.setProp(nx0 + 1, ny0 + 1, propType);
        this.setLoot(nx0 + 1, ny0 + 1, 8);
        this.setProp(nx0 + rw - 2, ny0 + 1, expType === 3 ? PROP_LOG_PILE : PROP_CRATE);
        this.setLoot(nx0 + rw - 2, ny0 + 1, 7);

        // Protective sandbag corner outside new wing!
        const sbX = d.dx >= 0 ? nx0 + rw : nx0 - 1;
        const sbY = ny0 + rh - 1;
        if (this.getBuildingId(sbX, sbY) < 0 && this.getStruct(sbX, sbY) === STRUCT_NONE) {
          this.setStruct(sbX, sbY, STRUCT_SANDBAG);
        }

        b.rooms.push({ x0: nx0, y0: ny0, w: rw, h: rh, roofColor: annexRoof });
        b.x0 = Math.min(b.x0, nx0);
        b.y0 = Math.min(b.y0, ny0);
        b.w = Math.max(b.x0 + b.w, nx0 + rw) - b.x0;
        b.h = Math.max(b.y0 + b.h, ny0 + rh) - b.y0;
        b.expansions++;
        b.isSafehouse = true;

        return {
          ok: true,
          roomCenter: { x: nx0 + rw * 0.5, y: ny0 + rh * 0.5 },
          label: roleTitle,
        };
      }
    }

    return { ok: false };
  }
}
