import { ZomboidAudio } from '../audio/sfx';
import {
  AnimatedFxBurst,
  BRUSH_SIZES,
  CHUNK_SHIFT,
  CHUNK_SIZE,
  FLOOR_DIRT,
  FLOOR_GRASS,
  FLOOR_WATER,
  FLOOR_WOOD,
  isOpaqueWallStruct,
  isZombieRole,
  MOODLE_BITTEN,
  MOODLE_BLEEDING,
  MOODLE_HEAVY_LOAD,
  MOODLE_HUNGRY,
  MOODLE_PANIC,
  MOODLE_TIRED,
  PROP_AIRDROP,
  PROP_BED,
  PROP_CORPSE,
  PROP_CRATE,
  PROP_FRIDGE,
  PROP_GAS_PUMP,
  PROP_GUN_LOCKER,
  PROP_LOG_PILE,
  PROP_MED_CABINET,
  PROP_NONE,
  PROP_SHELF,
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
  SimToolId,
  STRUCT_DOOR_CLOSED,
  STRUCT_DOOR_OPEN,
  STRUCT_FENCE_WOOD,
  STRUCT_NONE,
  STRUCT_RUBBLE,
  STRUCT_SANDBAG,
  STRUCT_WALL_WOOD,
  STRUCT_WINDOW_BROKEN,
  STRUCT_WINDOW_INTACT,
  TimeOfDayMode,
  UnitInspectionData,
  Vehicle,
  WEAPONS,
  WeatherMode,
  WPN_AXE,
  WPN_BAT,
  WPN_FISTS,
  WPN_PISTOL,
  WPN_RIFLE,
  WPN_SHOTGUN,
} from './types';
import { CityWorld } from './world';

export const MAX_UNITS = 1100;
export const MAX_BULLETS = 320;
export const MAX_PARTICLES = 1800;

export const PART_BLOOD = 0;
export const PART_GLASS = 1;
export const PART_SHELL = 2;
export const PART_SPLINTER = 3;
export const PART_FIRE = 4;
export const PART_SMOKE = 5;
export const PART_SPARK = 6;
export const PART_FLARE = 7;

const FIRST_NAMES = [
  'Рик', 'Дэрил', 'Гленн', 'Мэгги', 'Шейн', 'Карл', 'Мишонн', 'Хершел',
  'Клэр', 'Леон', 'Джилл', 'Крис', 'Билл', 'Фрэнсис', 'Зои', 'Луис',
  'Элли', 'Джоэл', 'Томми', 'Тесс', 'Ник', 'Тревор', 'Артур', 'Сара',
];

const LAST_NAMES = [
  'Граймс', 'Диксон', 'РИ', 'Грин', 'Уолш', 'Редфилд', 'Кеннеди', ' Валентайн',
  'Овербек', 'Миллер', 'Уильямс', 'Картер', 'Морган', 'Портер', 'Бейкер', 'Коул',
];

export interface SoundWaveRing {
  x: number;
  y: number;
  maxRadius: number;
  age: number;
  duration: number;
  color: string;
  label?: string;
}

const HASH_BUCKETS = 4096;
const HASH_MASK = HASH_BUCKETS - 1;

function spatialBucket(cx: number, cy: number): number {
  return (Math.imul(cx, 73856093) ^ Math.imul(cy, 19349663)) & HASH_MASK;
}

export class ZomboidSimulation {
  // Structure-of-Arrays Unit Storage
  public count = 0;
  public ux = new Float32Array(MAX_UNITS);
  public uy = new Float32Array(MAX_UNITS);
  public uvx = new Float32Array(MAX_UNITS);
  public uvy = new Float32Array(MAX_UNITS);
  public uAngle = new Float32Array(MAX_UNITS);
  public uRole = new Uint8Array(MAX_UNITS);
  public uSquad = new Uint8Array(MAX_UNITS); // 1 = Группа №1 (Полицейский участок)!
  public uWeapon = new Uint8Array(MAX_UNITS);
  public uAmmo = new Uint16Array(MAX_UNITS);
  public uFood = new Uint8Array(MAX_UNITS);
  public uBandages = new Uint8Array(MAX_UNITS);
  public uPlanks = new Uint8Array(MAX_UNITS);
  public uWood = new Uint8Array(MAX_UNITS); // Construction logs for building room extensions!
  public uHp = new Float32Array(MAX_UNITS);
  public uMaxHp = new Float32Array(MAX_UNITS);
  public uInfection = new Float32Array(MAX_UNITS);
  public uHunger = new Float32Array(MAX_UNITS);
  public uFatigue = new Float32Array(MAX_UNITS);
  public uPanic = new Float32Array(MAX_UNITS);
  public uMoodles = new Uint8Array(MAX_UNITS);
  public uBurning = new Float32Array(MAX_UNITS);
  public uCooldown = new Float32Array(MAX_UNITS);
  public uGoalX = new Float32Array(MAX_UNITS);
  public uGoalY = new Float32Array(MAX_UNITS);
  public uGoalTimer = new Float32Array(MAX_UNITS);
  public uHomeBldg = new Int16Array(MAX_UNITS).fill(-1);
  public uWalkPhase = new Float32Array(MAX_UNITS);
  public uVariant = new Uint8Array(MAX_UNITS);
  public uKills = new Uint16Array(MAX_UNITS);
  public uTask = new Uint8Array(MAX_UNITS); // 0=patrol, 1=loot, 2=barricade, 3=fight, 4=flee, 5=hunt_sound, 6=chop_wood, 7=build_room
  public uUid = new Int32Array(MAX_UNITS);
  public uNameIdx = new Uint16Array(MAX_UNITS);
  public uStuckTimer = new Float32Array(MAX_UNITS);
  public uAttackAnim = new Float32Array(MAX_UNITS);
  public uStamina = new Float32Array(MAX_UNITS).fill(1);

  private nextUid = 1;
  private nextSquadId = 2; // 1 is ALWAYS reserved for Группа №1 in Police Station!
  public selectedUid = 0;
  public controlledUid = 0; // >0 = Player is directly controlling this exact survivor OR zombie!
  public brushIndex = 1;

  // Direct Player Possession Input State
  public playerInput = {
    moveScreenX: 0,
    moveScreenY: 0,
    sprint: false,
    aimWx: 16,
    aimWy: 16,
    primaryDown: false,
  };
  private footstepAccum = 0;

  // Multi-frame Pixel FX Flipbooks (Explosions, Muzzle Flashes, Melee Slash Arcs, Smoke Puffs)
  public fxBursts: AnimatedFxBurst[] = [];

  // Unbounded Spatial Hash Grid (4x4 tile cells across infinite world -∞ .. +∞!)
  private gridHead = new Int16Array(HASH_BUCKETS);
  private gridNext = new Int16Array(MAX_UNITS);
  private targetCache = new Int16Array(MAX_UNITS);
  private aiTick = 0;

  // Ballistic Projectiles (Slow visible tracers, strict wall stop!)
  public bulletCount = 0;
  public bx = new Float32Array(MAX_BULLETS);
  public by = new Float32Array(MAX_BULLETS);
  public bvx = new Float32Array(MAX_BULLETS);
  public bvy = new Float32Array(MAX_BULLETS);
  public bLife = new Float32Array(MAX_BULLETS);
  public bDmg = new Float32Array(MAX_BULLETS);
  public bKnock = new Float32Array(MAX_BULLETS);
  public bRaider = new Uint8Array(MAX_BULLETS);
  public bOwner = new Int32Array(MAX_BULLETS);

  // 3D Physics Particles
  public partCount = 0;
  public px = new Float32Array(MAX_PARTICLES);
  public py = new Float32Array(MAX_PARTICLES);
  public pz = new Float32Array(MAX_PARTICLES);
  public pvx = new Float32Array(MAX_PARTICLES);
  public pvy = new Float32Array(MAX_PARTICLES);
  public pvz = new Float32Array(MAX_PARTICLES);
  public pLife = new Float32Array(MAX_PARTICLES);
  public pMaxLife = new Float32Array(MAX_PARTICLES);
  public pKind = new Uint8Array(MAX_PARTICLES);
  private partCursor = 0;

  // Sound Waves & Helicopter
  public soundRings: SoundWaveRing[] = [];
  public showSoundWaves = true;

  public heliActive = false;
  public heliX = 0;
  public heliY = 0;
  public heliTimer = 0;
  private heliPingAccum = 0;

  // Day/Night & Weather (Calm slow clock!)
  public worldMinutes = 8 * 60 + 30;
  public dayNumber = 1;
  public timeMode: TimeOfDayMode = 'auto';
  public weather: WeatherMode = 'clear';
  public lightningFlash = 0;

  // Live Statistics
  public livingCount = 0;
  public squad1Count = 0;
  public zombieCount = 0;
  public totalInfectedTurned = 0;
  public safehouseCount = 0;
  public totalExpansionsBuilt = 0;
  public carsWreckedCount = 0;

  private fireAccum = 0;
  private buildCheckAccum = 0;
  private alarmBeepAccum = 0;
  public onRadioBroadcast?: (msg: string, color?: string) => void;

  constructor(
    public world: CityWorld,
    public sfx: ZomboidAudio,
  ) {
    this.world.onChunkGenerated = (cx, cy, newBldgIds) => {
      this.onNewChunkStreamed(cx, cy, newBldgIds);
    };
    this.populateInitialOutbreak();
  }

  public get darknessLevel(): number {
    if (this.timeMode === 'day') return 0.0;
    if (this.timeMode === 'dusk') return 0.45;
    if (this.timeMode === 'night') return 0.80;

    const hr = (this.worldMinutes % 1440) / 60;
    if (hr >= 7 && hr < 17.5) return this.weather === 'storm' ? 0.24 : 0.0;
    if (hr >= 17.5 && hr < 20.5) return ((hr - 17.5) / 3.0) * 0.78;
    if (hr >= 4.5 && hr < 7.0) return (1 - (hr - 4.5) / 2.5) * 0.78;
    return 0.78;
  }

  public get formattedClock(): string {
    const mins = Math.floor(this.worldMinutes) % 1440;
    const hh = String(Math.floor(mins / 60)).padStart(2, '0');
    const mm = String(mins % 60).padStart(2, '0');
    return `День ${this.dayNumber} • ${hh}:${mm}`;
  }

  public get policeStationCoords(): { x: number; y: number } {
    const hq = this.world.buildings[this.world.policeStationId];
    if (hq) {
      return { x: hq.x0 + hq.w * 0.5, y: hq.y0 + hq.h * 0.5 };
    }
    return { x: 17, y: 16 };
  }

  /**
   * Automatically spawns zombies & survivors into newly streamed infinite-world chunks!
   */
  private onNewChunkStreamed(cx: number, cy: number, newBldgIds: number[]): void {
    if (Math.abs(cx) <= 2 && Math.abs(cy) <= 2) return; // Origin 5x5 handled cleanly in populateInitialOutbreak
    if (this.count >= MAX_UNITS - 20) return;

    const baseX = cx << CHUNK_SHIFT;
    const baseY = cy << CHUNK_SHIFT;

    // Populate any newly discovered buildings in this chunk!
    for (const bId of newBldgIds) {
      const b = this.world.buildings[bId];
      if (!b) continue;
      const mx = b.x0 + b.w * 0.5;
      const my = b.y0 + b.h * 0.5;
      if (b.kind === 'military') {
        for (let k = 0; k < 4; k++) this.spawnUnit(mx + (k - 1.5), my, ROLE_SOLDIER, bId, b.safehouseSquad);
      } else if (b.kind === 'hospital') {
        const sq = this.nextSquadId++;
        b.isSafehouse = true;
        b.safehouseSquad = sq;
        for (let k = 0; k < 3; k++) this.spawnUnit(mx + (k - 1), my, ROLE_MEDIC, bId, sq);
      } else if (Math.random() < 0.45) {
        const sq = this.nextSquadId++;
        b.isSafehouse = true;
        b.safehouseSquad = sq;
        for (let k = 0; k < 2; k++) this.spawnUnit(mx + k, my, ROLE_CIVILIAN, bId, sq);
      }
    }

    // Spawn roaming street/forest zombies in this new chunk!
    const zCount = 3 + ((Math.random() * 5) | 0);
    for (let z = 0; z < zCount; z++) {
      const gx = baseX + 3 + Math.random() * 24;
      const gy = baseY + 3 + Math.random() * 24;
      if (this.world.getBuildingId(gx | 0, gy | 0) >= 0) continue;
      const r = Math.random();
      const role = r < 0.09 ? ROLE_ZOMBIE_SPRINTER : r < 0.18 ? ROLE_ZOMBIE_ARMORED : ROLE_ZOMBIE_SHAMBLER;
      this.spawnUnit(gx, gy, role, -1, 0);
    }
  }

  public populateInitialOutbreak(): void {
    this.count = 0;
    this.bulletCount = 0;
    this.partCount = 0;
    this.soundRings = [];
    this.heliActive = false;
    this.worldMinutes = 8 * 60 + 30;
    this.dayNumber = 1;
    this.totalInfectedTurned = 0;
    this.totalExpansionsBuilt = 0;
    this.carsWreckedCount = 0;
    this.selectedUid = 0;
    this.controlledUid = 0;
    this.fxBursts = [];
    this.nextSquadId = 2;
    this.targetCache.fill(-1);

    // 1. ALWAYS SPAWN ГРУППА №1 INSIDE THE CENTRAL POLICE STATION (`world.policeStationId`)!
    const hq = this.world.buildings[this.world.policeStationId];
    if (hq) {
      hq.isSafehouse = true;
      hq.safehouseSquad = 1;
      hq.woodStock = 42;
      const r0 = hq.rooms[0];
      const cx = r0.x0 + r0.w * 0.5;
      const cy = r0.y0 + r0.h * 0.5;

      // 8 Elite & Specialist Members of Группа №1 inside Police Station!
      const squad1Roles = [
        ROLE_POLICE,
        ROLE_POLICE,
        ROLE_POLICE,
        ROLE_POLICE,
        ROLE_MEDIC,
        ROLE_SOLDIER,
        ROLE_CIVILIAN, // Builder #1 (starts with axe + wood logs!)
        ROLE_CIVILIAN, // Builder #2
      ];
      for (let k = 0; k < squad1Roles.length; k++) {
        const ox = ((k % 4) - 1.5) * 1.4;
        const oy = (Math.floor(k / 4) - 0.5) * 1.6;
        const idx = this.spawnUnit(cx + ox, cy + oy, squad1Roles[k], hq.id, 1);
        if (idx >= 0 && squad1Roles[k] === ROLE_CIVILIAN) {
          this.uWeapon[idx] = WPN_AXE;
          this.uWood[idx] = 8;
          this.uPlanks[idx] = 6;
        }
      }
    }

    // 2. Populate surrounding starting buildings with Survivor Groups (#2, #3, ...)
    for (const b of this.world.buildings) {
      if (b.id === this.world.policeStationId) continue;
      const r0 = b.rooms[0];
      const cx = r0.x0 + r0.w * 0.5;
      const cy = r0.y0 + r0.h * 0.5;

      if (b.kind === 'military') {
        const sq = this.nextSquadId++;
        b.isSafehouse = true;
        b.safehouseSquad = sq;
        for (let k = 0; k < 5; k++) {
          this.spawnUnit(cx + (k - 2) * 1.1, cy, ROLE_SOLDIER, b.id, sq);
        }
      } else if (b.kind === 'hospital') {
        const sq = this.nextSquadId++;
        b.isSafehouse = true;
        b.safehouseSquad = sq;
        for (let k = 0; k < 4; k++) {
          this.spawnUnit(cx + ((k % 2) - 0.5) * 1.5, cy + (Math.floor(k / 2) - 0.5) * 1.5, ROLE_MEDIC, b.id, sq);
        }
      } else if (b.kind === 'house') {
        if (Math.random() < 0.65) {
          const sq = this.nextSquadId++;
          b.isSafehouse = true;
          b.safehouseSquad = sq;
          b.woodStock = 18; // Ready to chop 1-2 trees and expand their cottage!
          const n = 2 + ((Math.random() * 2) | 0);
          for (let k = 0; k < n; k++) {
            this.spawnUnit(cx + (k - 1) * 1.1, cy, ROLE_CIVILIAN, b.id, sq);
          }
        }
      } else {
        this.spawnUnit(cx, cy, ROLE_CIVILIAN, b.id, 0);
      }
    }

    // Raider gang on highway edge
    for (let r = 0; r < 4; r++) {
      this.spawnUnit(-44 + r * 1.3, -26 + r * 0.8, ROLE_RAIDER, -1, 99);
    }

    // 3. Spawn Street & Highway Zombies across the initial 5x5 chunks ( strictly outside buildings!)
    for (let z = 0; z < 165; z++) {
      let gx = -56 + Math.random() * 144;
      let gy = -56 + Math.random() * 144;
      // Keep immediate 8-tile doorway yard of Police Station slightly clear for first 4 seconds so we watch them approach!
      if (Math.hypot(gx - 17, gy - 16) < 11) {
        gx += 16;
      }
      if (this.world.getBuildingId(Math.floor(gx), Math.floor(gy)) >= 0) continue;
      if (this.world.isTileSolidForMovement(Math.floor(gx), Math.floor(gy), false)) continue;

      const roll = Math.random();
      const role =
        roll < 0.08 ? ROLE_ZOMBIE_SPRINTER : roll < 0.16 ? ROLE_ZOMBIE_ARMORED : ROLE_ZOMBIE_SHAMBLER;
      this.spawnUnit(gx, gy, role, -1, 0);
    }

    this.recountPopulations();
  }

  public spawnUnit(wx: number, wy: number, role: number, homeBldg = -1, squadId = 0): number {
    if (this.count >= MAX_UNITS) return -1;
    const isHuman = !isZombieRole(role);

    // Find clean non-colliding tile near (wx, wy) so NO ONE EVER SPAWNS INSIDE A WALL!
    let sx = wx;
    let sy = wy;
    if (this.world.isTileSolidForMovement(Math.floor(sx), Math.floor(sy), isHuman)) {
      let placed = false;
      for (let rad = 1; rad <= 6 && !placed; rad++) {
        for (let dy = -rad; dy <= rad && !placed; dy++) {
          for (let dx = -rad; dx <= rad; dx++) {
            const tx = Math.floor(wx) + dx;
            const ty = Math.floor(wy) + dy;
            if (!this.world.isTileSolidForMovement(tx, ty, isHuman)) {
              sx = tx + 0.5;
              sy = ty + 0.5;
              placed = true;
              break;
            }
          }
        }
      }
      if (!placed) return -1;
    }

    const i = this.count++;
    this.ux[i] = sx;
    this.uy[i] = sy;
    this.uvx[i] = 0;
    this.uvy[i] = 0;
    this.uAngle[i] = Math.random() * Math.PI * 2;
    this.uRole[i] = role;
    this.uSquad[i] = squadId;
    this.uHomeBldg[i] = homeBldg;
    this.uUid[i] = this.nextUid++;
    this.uNameIdx[i] = (Math.random() * 4096) | 0;
    this.uVariant[i] = (Math.random() * 64) | 0;
    this.uWalkPhase[i] = Math.random() * 6.28;
    this.uKills[i] = 0;
    this.uBurning[i] = 0;
    this.uInfection[i] = 0;
    this.uHunger[i] = Math.random() * 0.15;
    this.uFatigue[i] = Math.random() * 0.15;
    this.uPanic[i] = 0;
    this.uMoodles[i] = 0;
    this.uCooldown[i] = Math.random() * 0.6;
    this.uGoalX[i] = sx;
    this.uGoalY[i] = sy;
    this.uGoalTimer[i] = 0;
    this.uTask[i] = 0;
    this.uWood[i] = 0;
    this.uStuckTimer[i] = 0;
    this.uAttackAnim[i] = 0;
    this.uStamina[i] = 1.0;
    this.targetCache[i] = -1;

    if (role === ROLE_POLICE) {
      this.uMaxHp[i] = 135;
      this.uWeapon[i] = Math.random() < 0.45 ? WPN_SHOTGUN : WPN_PISTOL;
      this.uAmmo[i] = 48;
      this.uFood[i] = 4;
      this.uBandages[i] = 3;
      this.uPlanks[i] = 4;
      this.uWood[i] = 4;
    } else if (role === ROLE_SOLDIER) {
      this.uMaxHp[i] = 160;
      this.uWeapon[i] = WPN_RIFLE;
      this.uAmmo[i] = 90;
      this.uFood[i] = 5;
      this.uBandages[i] = 3;
      this.uPlanks[i] = 3;
      this.uWood[i] = 3;
    } else if (role === ROLE_MEDIC) {
      this.uMaxHp[i] = 115;
      this.uWeapon[i] = Math.random() < 0.6 ? WPN_PISTOL : WPN_BAT;
      this.uAmmo[i] = 28;
      this.uFood[i] = 4;
      this.uBandages[i] = 8;
      this.uPlanks[i] = 3;
      this.uWood[i] = 2;
    } else if (role === ROLE_RAIDER) {
      this.uMaxHp[i] = 125;
      this.uWeapon[i] = Math.random() < 0.35 ? WPN_RIFLE : WPN_SHOTGUN;
      this.uAmmo[i] = 45;
      this.uFood[i] = 2;
      this.uBandages[i] = 2;
      this.uPlanks[i] = 0;
    } else if (role === ROLE_CIVILIAN) {
      this.uMaxHp[i] = 105;
      const r = Math.random();
      this.uWeapon[i] = r < 0.32 ? WPN_AXE : r < 0.65 ? WPN_BAT : WPN_PISTOL;
      this.uAmmo[i] = this.uWeapon[i] >= WPN_PISTOL ? 22 : 0;
      this.uFood[i] = 3;
      this.uBandages[i] = 2;
      this.uPlanks[i] = 4;
      this.uWood[i] = 4;
    } else if (role === ROLE_ZOMBIE_ARMORED) {
      this.uMaxHp[i] = 210;
      this.uWeapon[i] = WPN_FISTS;
      this.uAmmo[i] = 0;
      this.uFood[i] = 0;
      this.uBandages[i] = 0;
      this.uPlanks[i] = 0;
    } else if (role === ROLE_ZOMBIE_SPRINTER) {
      this.uMaxHp[i] = 75;
      this.uWeapon[i] = WPN_FISTS;
      this.uAmmo[i] = 0;
      this.uFood[i] = 0;
      this.uBandages[i] = 0;
      this.uPlanks[i] = 0;
    } else if (role === ROLE_ZOMBIE_CRAWLER) {
      this.uMaxHp[i] = 55;
      this.uWeapon[i] = WPN_FISTS;
      this.uAmmo[i] = 0;
      this.uFood[i] = 0;
      this.uBandages[i] = 0;
      this.uPlanks[i] = 0;
    } else {
      this.uMaxHp[i] = 95;
      this.uWeapon[i] = WPN_FISTS;
      this.uAmmo[i] = 0;
      this.uFood[i] = 0;
      this.uBandages[i] = 0;
      this.uPlanks[i] = 0;
    }

    this.uHp[i] = this.uMaxHp[i];
    return i;
  }

  /**
   * ═══ STRICT LINE OF SIGHT CHECK — NO SHOOTING OR TARGETING THROUGH WALLS EVER! ═══
   * Walks every 0.18 tiles along the ray (x0, y0) -> (x1, y1).
   * Returns FALSE immediately if ANY brick/wood/concrete/store wall or closed door blocks the ray!
   */
  public hasLineOfSight(x0: number, y0: number, x1: number, y1: number): boolean {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.25) return true;

    const steps = Math.ceil(dist / 0.18);
    const inv = 1 / steps;
    for (let s = 1; s < steps; s++) {
      const px = x0 + dx * (s * inv);
      const py = y0 + dy * (s * inv);
      if (this.world.blocksBulletsAndSight(Math.floor(px), Math.floor(py))) {
        return false;
      }
    }
    return true;
  }

  /**
   * ═══ HARD CIRCLE-VS-TILE & CIRCLE-VS-VEHICLE COLLISION RESOLVER ═══
   * Guarantees 100.0% physical non-penetration of all walls, windows, barricades, furniture, water & cars!
   * When a zombie collides with a door, window, barricade, fence, sandbag, wooden wall OR CAR,
   * the zombie physically bashes and wears down that structure/car over time!
   */
  private resolveUnitCollisions(i: number, dt: number): void {
    const R = 0.29;
    const isHuman = !isZombieRole(this.uRole[i]);

    // 1. Check all 3x3 surrounding grid tiles
    const cgx = Math.floor(this.ux[i]);
    const cgy = Math.floor(this.uy[i]);

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const tx = cgx + dx;
        const ty = cgy + dy;

        // Humans approaching an unbarricaded closed door automatically open it!
        if (isHuman && this.world.getStruct(tx, ty) === STRUCT_DOOR_CLOSED && this.world.getBarricade(tx, ty) === 0) {
          const nearDoor = Math.hypot(this.ux[i] - (tx + 0.5), this.uy[i] - (ty + 0.5));
          if (nearDoor < 0.92) {
            this.world.setStruct(tx, ty, STRUCT_DOOR_OPEN);
            this.sfx.playWoodImpact(false);
            continue;
          }
        }

        if (!this.world.isTileSolidForMovement(tx, ty, isHuman)) continue;

        // Closest point on tile AABB [tx, tx+1] x [ty, ty+1] to unit circle center (ux, uy)
        const closestX = Math.max(tx, Math.min(tx + 1, this.ux[i]));
        const closestY = Math.max(ty, Math.min(ty + 1, this.uy[i]));
        const vx = this.ux[i] - closestX;
        const vy = this.uy[i] - closestY;
        const d2 = vx * vx + vy * vy;

        if (d2 < R * R) {
          if (d2 > 1e-6) {
            const d = Math.sqrt(d2);
            const overlap = R - d;
            this.ux[i] += (vx / d) * overlap;
            this.uy[i] += (vy / d) * overlap;
          } else {
            // Exact center overlap fallback: push out along smallest penetration axis
            const penLeft = this.ux[i] - tx;
            const penRight = tx + 1 - this.ux[i];
            const penTop = this.uy[i] - ty;
            const penBot = ty + 1 - this.uy[i];
            const m = Math.min(penLeft, penRight, penTop, penBot);
            if (m === penLeft) this.ux[i] = tx - R;
            else if (m === penRight) this.ux[i] = tx + 1 + R;
            else if (m === penTop) this.uy[i] = ty - R;
            else this.uy[i] = ty + 1 + R;
          }

          // ZOMBIES PHYSICALLY BASH & BREAK DOORS, BARRICADES, WINDOWS, FENCES, SANDBAGS & WOOD WALLS!
          if (!isHuman && this.uCooldown[i] <= 0) {
            this.zombieBashTile(i, tx, ty);
          }
        }
      }
    }

    // 2. Circle-vs-Vehicle Solid Collision + ZOMBIES SMASHING & WRECKING CARS OVER TIME!
    for (let vIdx = 0; vIdx < this.world.vehicles.length; vIdx++) {
      const v = this.world.vehicles[vIdx];
      const halfW = v.axis === 0 ? 1.15 : 0.72;
      const halfH = v.axis === 0 ? 0.72 : 1.15;

      if (Math.abs(this.ux[i] - v.x) > halfW + R + 0.3 || Math.abs(this.uy[i] - v.y) > halfH + R + 0.3) {
        continue;
      }

      const closestX = Math.max(v.x - halfW, Math.min(v.x + halfW, this.ux[i]));
      const closestY = Math.max(v.y - halfH, Math.min(v.y + halfH, this.uy[i]));
      const dx = this.ux[i] - closestX;
      const dy = this.uy[i] - closestY;
      const d2 = dx * dx + dy * dy;

      if (d2 < R * R) {
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2);
          const overlap = R - d;
          this.ux[i] += (dx / d) * overlap;
          this.uy[i] += (dy / d) * overlap;
        } else {
          this.ux[i] += R;
        }

        // Zombies aggressively claw, dent, set off alarms, shatter windshields & wreck cars over time!
        if (!isHuman && !v.exploded && this.uCooldown[i] <= 0) {
          this.uCooldown[i] = 1.15;
          this.uAngle[i] = Math.atan2(v.y - this.uy[i], v.x - this.ux[i]);
          const bashDmg = this.uRole[i] === ROLE_ZOMBIE_ARMORED ? 24 : 15;
          this.damageVehicle(v, bashDmg, false);
        }
      }
    }

    void dt;
  }

  private zombieBashTile(zIdx: number, tx: number, ty: number): void {
    const planks = this.world.getBarricade(tx, ty);
    if (planks > 0) {
      this.uCooldown[zIdx] = 1.35;
      if (Math.random() < 0.32) {
        this.world.setBarricade(tx, ty, planks - 1);
        this.sfx.playWoodImpact(true);
        for (let p = 0; p < 5; p++) {
          this.spawnParticle(tx + 0.5, ty + 0.5, 0.5, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, 2.2, PART_SPLINTER, 0.9);
        }
      } else {
        this.sfx.playWoodImpact(false);
      }
      return;
    }

    const st = this.world.getStruct(tx, ty);
    if (st === STRUCT_WINDOW_INTACT) {
      this.uCooldown[zIdx] = 1.1;
      const hp = this.world.getStructHp(tx, ty) - 24;
      if (hp <= 0) {
        this.world.setStruct(tx, ty, STRUCT_WINDOW_BROKEN);
        this.sfx.playGlassShatter();
        this.emitSound(tx + 0.5, ty + 0.5, 14, '#90e0ef');
        for (let p = 0; p < 9; p++) {
          this.spawnParticle(tx + 0.5, ty + 0.5, 0.6, (Math.random() - 0.5) * 3.5, (Math.random() - 0.5) * 3.5, 2.0, PART_GLASS, 1.3);
        }
      } else {
        this.world.setStructHp(tx, ty, hp);
      }
    } else if (
      st === STRUCT_DOOR_CLOSED ||
      st === STRUCT_FENCE_WOOD ||
      st === STRUCT_SANDBAG ||
      st === STRUCT_WALL_WOOD
    ) {
      this.uCooldown[zIdx] = 1.3;
      const dmg = this.uRole[zIdx] === ROLE_ZOMBIE_ARMORED ? 22 : 13;
      const hp = this.world.getStructHp(tx, ty) - dmg;
      this.sfx.playWoodImpact(false);
      this.emitSound(tx + 0.5, ty + 0.5, 9, '#dda15e');
      if (hp <= 0) {
        this.world.setStruct(tx, ty, st === STRUCT_WALL_WOOD ? STRUCT_RUBBLE : STRUCT_NONE);
        for (let p = 0; p < 8; p++) {
          this.spawnParticle(tx + 0.5, ty + 0.5, 0.5, (Math.random() - 0.5) * 3.5, (Math.random() - 0.5) * 3.5, 2.4, PART_SPLINTER, 1.2);
        }
      } else {
        this.world.setStructHp(tx, ty, hp);
      }
    }
  }

  public damageVehicle(v: Vehicle, dmg: number, fromBulletOrFire: boolean): void {
    if (v.exploded) return;
    v.hp -= dmg;
    v.hitFlash = 0.22;

    if (fromBulletOrFire) {
      this.spawnParticle(v.x, v.y, 0.5, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, 2.5, PART_SPARK, 0.45);
    } else {
      this.sfx.playWoodImpact(false);
      this.spawnParticle(v.x, v.y, 0.45, (Math.random() - 0.5) * 2.6, (Math.random() - 0.5) * 2.6, 1.8, PART_SPARK, 0.4);
    }

    // Trigger car alarm when attacked!
    if (v.hasAlarm && v.alarmTimer <= 0 && !v.sirenOn) {
      v.alarmTimer = 14.0;
      v.headlightsOn = true;
      this.emitSound(v.x, v.y, 44, '#ff9f1c', 'СИГНАЛИЗАЦИЯ!');
      this.onRadioBroadcast?.('🚨 Зомби раскачивают машину — сработала громкая автосигнализация!', '#ff9f1c');
    }

    // Shatter car windows at < 65% HP!
    if (!v.glassBroken && v.hp < v.maxHp * 0.65) {
      v.glassBroken = true;
      this.sfx.playGlassShatter();
      for (let p = 0; p < 10; p++) {
        this.spawnParticle(v.x, v.y, 0.65, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, 2.4, PART_GLASS, 1.4);
      }
    }

    // Complete Vehicle Destruction at <= 0 HP!
    if (v.hp <= 0) {
      v.hp = 0;
      v.exploded = true;
      v.sirenOn = false;
      v.alarmTimer = 0;
      v.headlightsOn = false;
      this.carsWreckedCount++;

      if (fromBulletOrFire || Math.random() < 0.35) {
        // Fuel tank ignites in a dramatic blast!
        this.triggerExplosion(v.x, v.y, 3.6, true);
        this.onRadioBroadcast?.('💥 Разбитый автомобиль взлетел на воздух от детонации бензобака!', '#ff5400');
      } else {
        // Zombies tear the car into a smoking rusted wreck!
        this.sfx.playExplosion(0.55);
        this.world.addScorch(Math.floor(v.x), Math.floor(v.y), 0.75);
        for (let p = 0; p < 16; p++) {
          this.spawnParticle(v.x, v.y, 0.5, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, 2.8, PART_SMOKE, 2.2);
          this.spawnParticle(v.x, v.y, 0.4, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5, 3.0, PART_SPARK, 0.8);
        }
        this.onRadioBroadcast?.('🚗 Толпа зомби окончательно разгромила и смяла автомобиль на улице!', '#e9c46a');
      }
    }
  }

  /**
   * Smart obstacle & doorway navigation so humans walk cleanly OUT doors to chop wood / loot
   * and walk IN doors back to their Safehouse without ever pressing into solid brick walls!
   */
  private steerAroundObstacles(i: number, goalX: number, goalY: number, isHuman: boolean): { dx: number; dy: number } {
    let targetX = goalX;
    let targetY = goalY;

    // Doorway routing for humans crossing into/out of a building!
    if (isHuman) {
      const curB = this.world.getBuildingId(Math.floor(this.ux[i]), Math.floor(this.uy[i]));
      const dstB = this.world.getBuildingId(Math.floor(goalX), Math.floor(goalY));
      if (curB !== dstB) {
        const bToCheck = curB >= 0 ? this.world.buildings[curB] : dstB >= 0 ? this.world.buildings[dstB] : undefined;
        if (bToCheck) {
          let bestDoorX = targetX;
          let bestDoorY = targetY;
          let bestScore = 1e9;
          for (let y = bToCheck.y0; y < bToCheck.y0 + bToCheck.h; y++) {
            for (let x = bToCheck.x0; x < bToCheck.x0 + bToCheck.w; x++) {
              const st = this.world.getStruct(x, y);
              if (st === STRUCT_DOOR_OPEN || (st === STRUCT_DOOR_CLOSED && this.world.getBarricade(x, y) === 0)) {
                const cx = x + 0.5;
                const cy = y + 0.5;
                const dMe = Math.hypot(cx - this.ux[i], cy - this.uy[i]);
                // If already standing right inside the doorway (< 0.85 tiles), step straight toward final goal!
                if (dMe < 0.85) {
                  bestScore = -1;
                  break;
                }
                const score = dMe + Math.hypot(cx - goalX, cy - goalY) * 0.45;
                if (score < bestScore) {
                  bestScore = score;
                  bestDoorX = cx;
                  bestDoorY = cy;
                }
              }
            }
            if (bestScore < 0) break;
          }
          if (bestScore >= 0 && bestScore < 1e8) {
            targetX = bestDoorX;
            targetY = bestDoorY;
          }
        }
      }
    }

    const baseAng = Math.atan2(targetY - this.uy[i], targetX - this.ux[i]);
    const offsets = [0, 0.55, -0.55, 1.1, -1.1, 1.65, -1.65];
    for (const off of offsets) {
      const a = baseAng + off;
      const px = this.ux[i] + Math.cos(a) * 0.62;
      const py = this.uy[i] + Math.sin(a) * 0.62;
      if (!this.world.isTileSolidForMovement(Math.floor(px), Math.floor(py), isHuman)) {
        return { dx: Math.cos(a), dy: Math.sin(a) };
      }
    }

    return { dx: Math.cos(baseAng), dy: Math.sin(baseAng) };
  }

  public step(dt: number): void {
    // 1. Calm, atmospheric Project Zomboid Day/Night Clock (~2.2 real sec = 1 in-game minute)
    this.worldMinutes += dt * 0.45;
    if (this.worldMinutes >= 1440) {
      this.worldMinutes -= 1440;
      this.dayNumber++;
      this.onRadioBroadcast?.(`🌅 Наступил День ${this.dayNumber} карантина в округе Нокс.`, '#ffd166');
    }

    if (this.lightningFlash > 0) this.lightningFlash = Math.max(0, this.lightningFlash - dt * 2.4);
    if (this.weather === 'storm' && Math.random() < dt * 0.14) {
      this.lightningFlash = 0.72;
      this.sfx.playExplosion();
    }

    // 2. Rebuild Infinite Spatial Hash Grid
    this.gridHead.fill(-1);
    for (let i = 0; i < this.count; i++) {
      if (this.uHp[i] <= 0) continue;
      const b = spatialBucket(Math.floor(this.ux[i]) >> 2, Math.floor(this.uy[i]) >> 2);
      this.gridNext[i] = this.gridHead[b];
      this.gridHead[b] = i;
    }

    // 3. Helicopter Event & Vehicle Alarms / Smoke
    if (this.heliActive) {
      this.heliTimer -= dt;
      this.heliX += Math.cos(this.worldMinutes * 0.35) * dt * 2.4;
      this.heliY += Math.sin(this.worldMinutes * 0.27) * dt * 2.4;
      this.heliPingAccum += dt;
      if (this.heliPingAccum >= 1.6) {
        this.heliPingAccum = 0;
        this.emitSound(this.heliX, this.heliY, 68, '#ffd166', '🚁 ВЕРТОЛЁТ');
      }
      if (this.heliTimer <= 0) this.heliActive = false;
    }

    this.alarmBeepAccum += dt;
    for (const v of this.world.vehicles) {
      if (v.hitFlash > 0) v.hitFlash = Math.max(0, v.hitFlash - dt);
      if (!v.exploded && v.hp < v.maxHp * 0.45 && Math.random() < dt * 3.5) {
        this.spawnParticle(v.x, v.y, 0.55, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, 1.4, PART_SMOKE, 1.5);
      }
      if (!v.exploded && (v.alarmTimer > 0 || v.sirenOn)) {
        if (v.alarmTimer > 0) v.alarmTimer = Math.max(0, v.alarmTimer - dt);
        if (this.alarmBeepAccum >= 1.1) {
          this.emitSound(v.x, v.y, 38, '#ff9f1c');
        }
      }
    }
    if (this.alarmBeepAccum >= 1.1) {
      this.alarmBeepAccum = 0;
    }

    // 4. Autonomous Safehouse Room Expansion Check!
    this.buildCheckAccum += dt;
    if (this.buildCheckAccum >= 3.2) {
      this.buildCheckAccum = 0;
      this.processAutonomousBuildingExpansions();
    }

    // 5. Update Units (Slow deliberate Project Zomboid speeds + Strict Sub-Stepped Collision!)
    this.aiTick++;
    for (let i = 0; i < this.count; i++) {
      if (this.uHp[i] <= 0) continue;
      this.updateSingleUnit(i, dt);
    }

    // Compact dead units & spawn persistent ground corpses!
    let write = 0;
    for (let i = 0; i < this.count; i++) {
      if (this.uHp[i] > 0) {
        if (write !== i) this.copyUnitSlot(write, i);
        write++;
      } else {
        const dgX = Math.floor(this.ux[i]);
        const dgY = Math.floor(this.uy[i]);
        this.world.addBlood(dgX, dgY, 0.55);
        if (this.world.getProp(dgX, dgY) === PROP_NONE && this.world.getStruct(dgX, dgY) === STRUCT_NONE) {
          this.world.setProp(dgX, dgY, PROP_CORPSE);
        }
        if (isZombieRole(this.uRole[i])) {
          this.sfx.playZombieDeath(this.ux[i], this.uy[i]);
        }
        if (this.uUid[i] === this.controlledUid) {
          this.controlledUid = 0;
          this.onRadioBroadcast?.('☠ Ваш персонаж погиб! Выберите другого выжившего или зомби [Tab / E]!', '#ff6b6b');
        }
      }
    }
    this.count = write;

    // 6. Micro-stepped Bullets (100% blocked by walls!) & 3D Particles & Multi-Frame FX Flipbooks & Fire
    this.stepBullets(dt);
    this.stepParticles(dt);
    this.stepFxBursts(dt);
    this.stepFire(dt);

    // 7. Sound Wave Rings Decay
    for (let s = this.soundRings.length - 1; s >= 0; s--) {
      this.soundRings[s].age += dt;
      if (this.soundRings[s].age >= this.soundRings[s].duration) {
        this.soundRings.splice(s, 1);
      }
    }

    if ((this.aiTick & 7) === 0) {
      this.recountPopulations();
    }
  }

  private processAutonomousBuildingExpansions(): void {
    for (const b of this.world.buildings) {
      if (!b.isSafehouse || b.survivorsInside <= 0) continue;
      // Squad #1 and active survivor safehouses automatically construct attached rooms once they gather 22 wood!
      if (b.woodStock >= 22 && b.expansions < 10) {
        const res = this.world.expandBuildingWithNewRoom(b.id);
        if (res.ok && res.roomCenter) {
          b.woodStock -= 22;
          this.totalExpansionsBuilt++;
          this.sfx.playWoodImpact(true);
          this.emitSound(res.roomCenter.x, res.roomCenter.y, 18, '#ffd466', '🔨 СТРОЙКА');
          for (let p = 0; p < 16; p++) {
            this.spawnParticle(
              res.roomCenter.x + (Math.random() - 0.5) * 3,
              res.roomCenter.y + (Math.random() - 0.5) * 3,
              0.6,
              (Math.random() - 0.5) * 3,
              (Math.random() - 0.5) * 3,
              2.4,
              PART_SPLINTER,
              1.1,
            );
          }
          const tag = b.safehouseSquad === 1 ? 'Группа №1' : `Выжившие (${b.name})`;
          this.onRadioBroadcast?.(
            `🏗 ${tag} достроила новое крыло «${res.label}» к зданию «${b.name}»!`,
            '#ffd466',
          );
          break; // Max 1 expansion per check cycle for smooth natural pacing!
        }
      }
    }
  }

  private updateSingleUnit(i: number, dt: number): void {
    const role = this.uRole[i];
    const zed = isZombieRole(role);
    const isHuman = !zed;

    if (this.uCooldown[i] > 0) this.uCooldown[i] -= dt;
    if (this.uGoalTimer[i] > 0) this.uGoalTimer[i] -= dt;
    if (this.uAttackAnim[i] > 0) this.uAttackAnim[i] = Math.max(0, this.uAttackAnim[i] - dt);

    // Fire damage
    const tileFire = this.world.getFire(Math.floor(this.ux[i]), Math.floor(this.uy[i]));
    if (tileFire > 0.25) this.uBurning[i] = Math.max(this.uBurning[i], 3.0);
    if (this.uBurning[i] > 0) {
      this.uBurning[i] -= dt;
      this.uHp[i] -= dt * 11;
      if (Math.random() < dt * 5) {
        this.spawnParticle(this.ux[i], this.uy[i], 0.5, 0, 0, 1.6, PART_FIRE, 0.45);
      }
    }

    // Knox Virus Incubation & Survivor Needs (Slow, dramatic pacing!)
    if (isHuman) {
      this.uHunger[i] = Math.min(1, this.uHunger[i] + dt * 0.004);
      if (this.uHunger[i] > 0.65 && this.uFood[i] > 0) {
        this.uFood[i]--;
        this.uHunger[i] = 0.05;
        this.uHp[i] = Math.min(this.uMaxHp[i], this.uHp[i] + 18);
      }
      if (this.uHp[i] < this.uMaxHp[i] * 0.72 && this.uBandages[i] > 0) {
        this.uBandages[i]--;
        this.uHp[i] = Math.min(this.uMaxHp[i], this.uHp[i] + 32);
        this.uMoodles[i] &= ~MOODLE_BLEEDING;
      }

      if (this.uInfection[i] > 0) {
        this.uInfection[i] += dt * 0.018; // ~55 real seconds from bite to reanimation inside base!
        this.uMoodles[i] |= MOODLE_BITTEN;
        if (this.uInfection[i] >= 1.0) {
          this.uRole[i] = ROLE_ZOMBIE_SHAMBLER;
          this.uWeapon[i] = WPN_FISTS;
          this.uHp[i] = 100;
          this.uMaxHp[i] = 100;
          this.uInfection[i] = 0;
          this.totalInfectedTurned++;
          this.sfx.playZombieGroan(this.ux[i], this.uy[i], true);
          const sq = this.uSquad[i];
          this.uSquad[i] = 0;
          this.onRadioBroadcast?.(
            `☣ ТРАГЕДИЯ${sq === 1 ? ' В ГРУППЕ №1' : ''}: укушенный выживший обратился в зомби прямо на базе!`,
            '#80ed99',
          );
          return;
        }
      }

      // Update Moodles bitmask
      if (this.uHunger[i] > 0.55) this.uMoodles[i] |= MOODLE_HUNGRY;
      else this.uMoodles[i] &= ~MOODLE_HUNGRY;
      if (this.uWood[i] >= 8) this.uMoodles[i] |= MOODLE_HEAVY_LOAD;
      else this.uMoodles[i] &= ~MOODLE_HEAVY_LOAD;
    }

    // ★ DIRECT PLAYER CONTROL MODE — Player is driving this exact character!
    if (this.controlledUid > 0 && this.uUid[i] === this.controlledUid) {
      this.updateControlledUnit(i, dt, isHuman);
      return;
    }

    // Periodic AI Target Search WITH STRICT LINE-OF-SIGHT CHECK FOR HUMANS!
    if (((this.aiTick + i) & 7) === 0) {
      this.targetCache[i] = this.acquireTarget(i, zed);
    }

    let moveSpd = 0;
    let moveDx = 0;
    let moveDy = 0;

    // Deliberate, authentic Project Zomboid movement speeds!
    const baseSpeed = zed
      ? role === ROLE_ZOMBIE_SPRINTER
        ? 1.42
        : role === ROLE_ZOMBIE_ARMORED
          ? 0.42
          : role === ROLE_ZOMBIE_CRAWLER
            ? 0.25
            : 0.52
      : role === ROLE_SOLDIER
        ? 1.18
        : role === ROLE_POLICE
          ? 1.12
          : 1.04;

    const tgt = this.targetCache[i];
    if (tgt >= 0 && tgt < this.count && this.uHp[tgt] > 0) {
      const dx = this.ux[tgt] - this.ux[i];
      const dy = this.uy[tgt] - this.uy[i];
      const dist = Math.hypot(dx, dy);

      if (zed) {
        this.uTask[i] = 3;
        this.uAngle[i] = Math.atan2(dy, dx);
        if (dist <= 0.92) {
          // Zombie melee bite/claw!
          if (this.uCooldown[i] <= 0) {
            this.uCooldown[i] = 1.25;
            this.zombieBiteHuman(i, tgt);
          }
        } else {
          const st = this.steerAroundObstacles(i, this.ux[tgt], this.uy[tgt], false);
          moveDx = st.dx;
          moveDy = st.dy;
          moveSpd = baseSpeed;
        }
      } else {
        // HUMAN COMBAT AI — ONLY SHOOTS / ATTACKS IF TRUE LINE OF SIGHT EXISTS (NEVER THROUGH WALLS!)
        const wpn = WEAPONS[this.uWeapon[i]] || WEAPONS[0];
        const useGun = wpn.isGun && this.uAmmo[i] > 0;
        const effRange = useGun ? wpn.range : 1.38;
        const canSee = this.hasLineOfSight(this.ux[i], this.uy[i], this.ux[tgt], this.uy[tgt]);

        if (dist <= effRange && canSee) {
          this.uTask[i] = 3;
          this.uAngle[i] = Math.atan2(dy, dx);

          // Back away slowly if zombie gets uncomfortably close (< 3.0 tiles) while shooting!
          if (useGun && dist < 3.0) {
            const away = this.steerAroundObstacles(i, this.ux[i] - dx * 2, this.uy[i] - dy * 2, true);
            moveDx = away.dx;
            moveDy = away.dy;
            moveSpd = baseSpeed * 0.72;
          }

          if (this.uCooldown[i] <= 0) {
            this.humanPerformAttack(i, tgt, useGun);
          }
        } else if (dist < 13.0) {
          // Reposition around walls/doors to acquire true line of sight!
          this.uTask[i] = 3;
          const st = this.steerAroundObstacles(i, this.ux[tgt], this.uy[tgt], true);
          moveDx = st.dx;
          moveDy = st.dy;
          moveSpd = baseSpeed * 0.88;
        }
      }
    } else if (zed) {
      // Roaming Zombie AI: slowly shambles toward sound waves or nearby vehicles to smash them!
      if (this.uGoalTimer[i] <= 0) {
        let foundCar = false;
        if (Math.random() < 0.28) {
          for (const v of this.world.vehicles) {
            if (!v.exploded && Math.hypot(v.x - this.ux[i], v.y - this.uy[i]) < 14) {
              this.uGoalX[i] = v.x;
              this.uGoalY[i] = v.y;
              this.uGoalTimer[i] = 6.0;
              foundCar = true;
              break;
            }
          }
        }
        if (!foundCar) {
          this.uGoalX[i] = this.ux[i] + (Math.random() - 0.5) * 14;
          this.uGoalY[i] = this.uy[i] + (Math.random() - 0.5) * 14;
          this.uGoalTimer[i] = 4.5 + Math.random() * 4.0;
        }
      }
      const dGoal = Math.hypot(this.uGoalX[i] - this.ux[i], this.uGoalY[i] - this.uy[i]);
      if (dGoal > 0.6) {
        const st = this.steerAroundObstacles(i, this.uGoalX[i], this.uGoalY[i], false);
        moveDx = st.dx;
        moveDy = st.dy;
        moveSpd = baseSpeed * 0.65;
      }
    } else {
      // PEACEFUL / SURVIVAL HUMAN AI:
      // 1) Deliver collected construction logs back to Home Safehouse for Room Expansion!
      // 2) Nail wooden barricades onto broken/unboarded safehouse windows!
      // 3) Go outside to chop nearby Pine/Oak trees for wood logs OR loot containers!
      // 4) Medics heal wounded allies!
      const stepRes = this.updateHumanCivilianTasks(i, baseSpeed);
      moveDx = stepRes.dx;
      moveDy = stepRes.dy;
      moveSpd = stepRes.spd;
    }

    // Apply smooth velocity + Unit-vs-Unit physical push separation + 2x Sub-Stepped Wall/Car Collision!
    let sepX = 0;
    let sepY = 0;
    const bCx = Math.floor(this.ux[i]) >> 2;
    const bCy = Math.floor(this.uy[i]) >> 2;
    for (let gy = bCy - 1; gy <= bCy + 1; gy++) {
      for (let gx = bCx - 1; gx <= bCx + 1; gx++) {
        let n = this.gridHead[spatialBucket(gx, gy)];
        let guard = 0;
        while (n >= 0 && guard++ < 24) {
          if (n !== i) {
            const ox = this.ux[i] - this.ux[n];
            const oy = this.uy[i] - this.uy[n];
            const d2 = ox * ox + oy * oy;
            if (d2 > 1e-5 && d2 < 0.34) {
              const d = Math.sqrt(d2);
              const f = (0.58 - d) * 1.6;
              sepX += (ox / d) * f;
              sepY += (oy / d) * f;
            }
          }
          n = this.gridNext[n];
        }
      }
    }

    this.uvx[i] = moveDx * moveSpd + sepX;
    this.uvy[i] = moveDy * moveSpd + sepY;
    const totalSpd = Math.hypot(this.uvx[i], this.uvy[i]);
    if (totalSpd > 0.12) {
      if (moveSpd > 0.05) this.uAngle[i] = Math.atan2(this.uvy[i], this.uvx[i]);
      this.uWalkPhase[i] += dt * totalSpd * 5.2;
    }

    // 2 Sub-steps per tick guarantees max step < 0.06 tiles -> 100% IMPOSSIBLE TO CROSS ANY WALL!
    const halfDt = dt * 0.5;
    for (let sub = 0; sub < 2; sub++) {
      this.ux[i] += this.uvx[i] * halfDt;
      this.uy[i] += this.uvy[i] * halfDt;
      this.resolveUnitCollisions(i, halfDt);
    }
  }

  private updateHumanCivilianTasks(i: number, baseSpeed: number): { dx: number; dy: number; spd: number } {
    const homeId = this.uHomeBldg[i];
    const home = homeId >= 0 ? this.world.buildings[homeId] : undefined;

    // Medics prioritize healing injured squadmates nearby!
    if (this.uRole[i] === ROLE_MEDIC) {
      for (let k = 0; k < this.count; k++) {
        if (k !== i && !isZombieRole(this.uRole[k]) && this.uHp[k] < this.uMaxHp[k] * 0.85) {
          const d = Math.hypot(this.ux[k] - this.ux[i], this.uy[k] - this.uy[i]);
          if (d < 1.5 && this.uCooldown[i] <= 0) {
            this.uCooldown[i] = 1.6;
            this.uHp[k] = Math.min(this.uMaxHp[k], this.uHp[k] + 28);
            this.uMoodles[k] &= ~MOODLE_BLEEDING;
            return { dx: 0, dy: 0, spd: 0 };
          }
          if (d < 16) {
            this.uTask[i] = 0;
            const st = this.steerAroundObstacles(i, this.ux[k], this.uy[k], true);
            return { dx: st.dx, dy: st.dy, spd: baseSpeed };
          }
        }
      }
    }

    // Check immediate tile around survivor for Tree Chopping OR Container Looting OR Window Barricading!
    const gx = Math.floor(this.ux[i]);
    const gy = Math.floor(this.uy[i]);

    // If carrying >= 6 logs and has a home Safehouse -> haul lumber home to expand building!
    if (home && this.uWood[i] >= 6) {
      this.uTask[i] = 7; // Haul & expand building!
      const hx = home.rooms[0].x0 + home.rooms[0].w * 0.5;
      const hy = home.rooms[0].y0 + home.rooms[0].h * 0.5;
      if (Math.hypot(hx - this.ux[i], hy - this.uy[i]) < 3.2) {
        home.woodStock += this.uWood[i];
        this.uWood[i] = 0;
        this.sfx.playWoodImpact(true);
        return { dx: 0, dy: 0, spd: 0 };
      }
      const st = this.steerAroundObstacles(i, hx, hy, true);
      return { dx: st.dx, dy: st.dy, spd: baseSpeed * 0.92 };
    }

    // Interact with adjacent trees / loot crates / unbarricaded windows
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const tx = gx + dx;
        const ty = gy + dy;
        const prop = this.world.getProp(tx, ty);
        const loot = this.world.getLoot(tx, ty);

        // Chop Pine/Oak trees into construction wood logs & planks!
        if ((prop === PROP_TREE_PINE || prop === PROP_TREE_OAK) && loot > 0 && this.uWood[i] < 8) {
          this.uTask[i] = 6;
          if (this.uCooldown[i] <= 0) {
            this.uCooldown[i] = 1.35;
            this.world.setLoot(tx, ty, loot - 1);
            this.uWood[i] += 3;
            this.uPlanks[i] = Math.min(8, this.uPlanks[i] + 1);
            this.sfx.playWoodImpact(true);
            for (let p = 0; p < 4; p++) {
              this.spawnParticle(tx + 0.5, ty + 0.5, 0.5, (Math.random() - 0.5) * 2.5, (Math.random() - 0.5) * 2.5, 2.0, PART_SPLINTER, 0.8);
            }
            if (loot - 1 <= 0) {
              this.world.setProp(tx, ty, PROP_NONE);
            }
          }
          return { dx: 0, dy: 0, spd: 0 };
        }

        // Loot indoor shelves, gun lockers, crates & airdrops!
        if (prop >= PROP_FRIDGE && prop <= PROP_AIRDROP && loot > 0) {
          this.uTask[i] = 1;
          if (this.uCooldown[i] <= 0) {
            this.uCooldown[i] = 1.4;
            this.world.setLoot(tx, ty, loot - 1);
            if (prop === PROP_GUN_LOCKER || prop === PROP_AIRDROP) {
              if (this.uWeapon[i] < WPN_PISTOL) this.uWeapon[i] = Math.random() < 0.5 ? WPN_SHOTGUN : WPN_RIFLE;
              this.uAmmo[i] += 24;
            } else if (prop === PROP_MED_CABINET) {
              this.uBandages[i] = Math.min(10, this.uBandages[i] + 2);
            } else if (prop === PROP_CRATE) {
              this.uWood[i] = Math.min(10, this.uWood[i] + 4);
              this.uPlanks[i] = Math.min(8, this.uPlanks[i] + 2);
            } else {
              this.uFood[i] = Math.min(8, this.uFood[i] + 2);
            }
          }
          return { dx: 0, dy: 0, spd: 0 };
        }

        // Nail planks onto broken windows of own Safehouse!
        const st = this.world.getStruct(tx, ty);
        if (
          this.uPlanks[i] > 0 &&
          homeId >= 0 &&
          this.world.getBuildingId(tx, ty) === homeId &&
          st === STRUCT_WINDOW_BROKEN &&
          this.world.getBarricade(tx, ty) < 3
        ) {
          this.uTask[i] = 2;
          if (this.uCooldown[i] <= 0) {
            this.uCooldown[i] = 1.5;
            this.uPlanks[i]--;
            this.world.setBarricade(tx, ty, this.world.getBarricade(tx, ty) + 1);
            this.sfx.playWoodImpact(true);
          }
          return { dx: 0, dy: 0, spd: 0 };
        }
      }
    }

    // Pick next calm goal (chop tree near base for expansion wood, patrol base, or scavenge nearby store!)
    if (this.uGoalTimer[i] <= 0) {
      let picked = false;
      // Builders / half of squad actively scan within 18 tiles for a tree or crate to gather expansion wood!
      if (home && home.expansions < 8 && (i % 2 === 0 || this.uWeapon[i] === WPN_AXE)) {
        for (let tries = 0; tries < 22; tries++) {
          const sx = Math.floor(home.x0 + home.w * 0.5 + (Math.random() - 0.5) * 34);
          const sy = Math.floor(home.y0 + home.h * 0.5 + (Math.random() - 0.5) * 34);
          const pr = this.world.getProp(sx, sy);
          if ((pr === PROP_TREE_PINE || pr === PROP_TREE_OAK || pr === PROP_CRATE) && this.world.getLoot(sx, sy) > 0) {
            this.uGoalX[i] = sx + 0.5;
            this.uGoalY[i] = sy + 0.5;
            this.uGoalTimer[i] = 9.0;
            this.uTask[i] = 6;
            picked = true;
            break;
          }
        }
      }

      if (!picked && home) {
        // Calm guard patrol inside/around own Safehouse rooms!
        const rm = home.rooms[(Math.random() * home.rooms.length) | 0];
        this.uGoalX[i] = rm.x0 + 1.5 + Math.random() * Math.max(1, rm.w - 3);
        this.uGoalY[i] = rm.y0 + 1.5 + Math.random() * Math.max(1, rm.h - 3);
        this.uGoalTimer[i] = 5.0 + Math.random() * 4.0;
        this.uTask[i] = 0;
        picked = true;
      }

      if (!picked) {
        this.uGoalX[i] = this.ux[i] + (Math.random() - 0.5) * 16;
        this.uGoalY[i] = this.uy[i] + (Math.random() - 0.5) * 16;
        this.uGoalTimer[i] = 6.0;
        this.uTask[i] = 1;
      }
    }

    const d = Math.hypot(this.uGoalX[i] - this.ux[i], this.uGoalY[i] - this.uy[i]);
    if (d < 0.75) return { dx: 0, dy: 0, spd: 0 };
    const st = this.steerAroundObstacles(i, this.uGoalX[i], this.uGoalY[i], true);
    return { dx: st.dx, dy: st.dy, spd: baseSpeed * 0.85 };
  }

  private acquireTarget(i: number, isZed: boolean): number {
    const ux = this.ux[i];
    const uy = this.uy[i];
    const isRaider = this.uRole[i] === ROLE_RAIDER;
    const maxR = isZed ? 15.0 : 15.5;
    let best = -1;
    let bestScore = maxR * maxR;

    const c0x = Math.floor(ux - maxR) >> 2;
    const c1x = Math.floor(ux + maxR) >> 2;
    const c0y = Math.floor(uy - maxR) >> 2;
    const c1y = Math.floor(uy + maxR) >> 2;

    for (let cy = c0y; cy <= c1y; cy++) {
      for (let cx = c0x; cx <= c1x; cx++) {
        let k = this.gridHead[spatialBucket(cx, cy)];
        let guard = 0;
        while (k >= 0 && guard++ < 32) {
          if (k !== i && this.uHp[k] > 0) {
            const kZed = isZombieRole(this.uRole[k]);
            const hostile = isZed ? !kZed : kZed || isRaider !== (this.uRole[k] === ROLE_RAIDER);
            if (hostile) {
              const d2 = (this.ux[k] - ux) ** 2 + (this.uy[k] - uy) ** 2;
              if (d2 < bestScore) {
                // CRITICAL: Humans prioritize targets they have TRUE LINE OF SIGHT to (not behind solid walls!)
                const los = this.hasLineOfSight(ux, uy, this.ux[k], this.uy[k]);
                if (los) {
                  bestScore = d2;
                  best = k;
                } else if (isZed && d2 < 36) {
                  // Zombies only sense through doors/windows when very close (< 6 tiles)
                  bestScore = d2 * 1.6;
                  best = k;
                }
              }
            }
          }
          k = this.gridNext[k];
        }
      }
    }
    return best;
  }

  private humanPerformAttack(i: number, tgt: number, useGun: boolean): void {
    const wpn = WEAPONS[this.uWeapon[i]] || WEAPONS[0];
    this.uCooldown[i] = wpn.cooldown * (0.92 + Math.random() * 0.2);
    this.uAttackAnim[i] = 0.26;

    const ang = Math.atan2(this.uy[tgt] - this.uy[i], this.ux[tgt] - this.ux[i]);
    this.uAngle[i] = ang;

    if (!useGun) {
      // Melee strike (Axe / Baseball Bat / Knife) with slash FX & real studio impact audio!
      this.sfx.playMeleeSwing(this.ux[i], this.uy[i]);
      this.sfx.playFleshHit(this.ux[tgt], this.uy[tgt]);
      this.spawnFxBurst('slash', this.ux[i] + Math.cos(ang) * 0.65, this.uy[i] + Math.sin(ang) * 0.65, 0.5, ang, 0.22, 1.0, 'human');
      this.uHp[tgt] -= wpn.damage;
      this.world.addBlood(Math.floor(this.ux[tgt]), Math.floor(this.uy[tgt]), 0.25);
      for (let p = 0; p < 5; p++) {
        this.spawnParticle(this.ux[tgt], this.uy[tgt], 0.5, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, 1.8, PART_BLOOD, 0.9);
      }
      if (this.uHp[tgt] <= 0) this.uKills[i]++;
      return;
    }

    // Double-check strict Line of Sight right before pulling trigger!
    if (!this.hasLineOfSight(this.ux[i], this.uy[i], this.ux[tgt], this.uy[tgt])) return;

    this.uAmmo[i]--;
    this.sfx.playGunshot(
      this.uWeapon[i] === WPN_SHOTGUN ? 'shotgun' : this.uWeapon[i] === WPN_RIFLE ? 'rifle' : 'pistol',
      this.ux[i],
      this.uy[i],
      false,
    );
    this.spawnFxBurst('muzzle', this.ux[i] + Math.cos(ang) * 0.52, this.uy[i] + Math.sin(ang) * 0.52, 0.52, ang, 0.12, 1.0);
    this.emitSound(this.ux[i], this.uy[i], wpn.noiseRadius, '#ffd166');

    // Eject brass shell casing!
    this.spawnParticle(
      this.ux[i],
      this.uy[i],
      0.55,
      Math.cos(ang + 1.5) * 2.2,
      Math.sin(ang + 1.5) * 2.2,
      2.6,
      PART_SHELL,
      1.6,
    );

    const speed = 15.0; // Slower visible tracer velocity!
    for (let p = 0; p < wpn.pellets && this.bulletCount < MAX_BULLETS; p++) {
      const a = ang + (Math.random() - 0.5) * wpn.spread;
      const b = this.bulletCount++;
      this.bx[b] = this.ux[i] + Math.cos(a) * 0.36;
      this.by[b] = this.uy[i] + Math.sin(a) * 0.36;
      this.bvx[b] = Math.cos(a) * speed;
      this.bvy[b] = Math.sin(a) * speed;
      this.bLife[b] = wpn.range / speed;
      this.bDmg[b] = wpn.damage;
      this.bKnock[b] = wpn.knockback;
      this.bRaider[b] = this.uRole[i] === ROLE_RAIDER ? 1 : 0;
      this.bOwner[b] = i;
    }
  }

  private zombieBiteHuman(zIdx: number, hIdx: number): void {
    this.uAttackAnim[zIdx] = 0.28;
    const ang = Math.atan2(this.uy[hIdx] - this.uy[zIdx], this.ux[hIdx] - this.ux[zIdx]);
    this.spawnFxBurst('slash', this.ux[zIdx] + Math.cos(ang) * 0.55, this.uy[zIdx] + Math.sin(ang) * 0.55, 0.5, ang, 0.24, 0.95, 'zombie');
    this.sfx.playZombieGroan(this.ux[zIdx], this.uy[zIdx]);
    this.sfx.playFleshHit(this.ux[hIdx], this.uy[hIdx]);

    this.uHp[hIdx] -= 16;
    this.uPanic[hIdx] = 1.0;
    this.uMoodles[hIdx] |= MOODLE_PANIC | MOODLE_BLEEDING;
    this.world.addBlood(Math.floor(this.ux[hIdx]), Math.floor(this.uy[hIdx]), 0.32);

    // 22% chance of lethal Knox Virus bite infection!
    if (this.uInfection[hIdx] <= 0 && Math.random() < 0.22) {
      this.uInfection[hIdx] = 0.05;
      this.uMoodles[hIdx] |= MOODLE_BITTEN;
    }

    for (let p = 0; p < 6; p++) {
      this.spawnParticle(this.ux[hIdx], this.uy[hIdx], 0.5, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, 2.0, PART_BLOOD, 1.0);
    }

    if (this.uHp[hIdx] <= 0) {
      // Killed human immediately rises as fresh zombie!
      this.uRole[hIdx] = ROLE_ZOMBIE_SHAMBLER;
      this.uWeapon[hIdx] = WPN_FISTS;
      this.uHp[hIdx] = 95;
      this.uMaxHp[hIdx] = 95;
      this.uSquad[hIdx] = 0;
      this.totalInfectedTurned++;
      this.sfx.playZombieGroan(this.ux[hIdx], this.uy[hIdx], true);
      if (this.uUid[hIdx] === this.controlledUid) {
        this.onRadioBroadcast?.('🧟 ВАС ОБРАТИЛИ В ЗОМБИ! Теперь вы можете кусать выживших и крушить машины!', '#80ed99');
      }
    }
  }

  /**
   * ═══ MICRO-STEPPED BALLISTICS — 100.0% STOPPED BY EVERY SOLID WALL & VEHICLE! ═══
   */
  private stepBullets(dt: number): void {
    let write = 0;
    for (let b = 0; b < this.bulletCount; b++) {
      this.bLife[b] -= dt;
      if (this.bLife[b] <= 0) continue;

      const totalDx = this.bvx[b] * dt;
      const totalDy = this.bvy[b] * dt;
      const dist = Math.hypot(totalDx, totalDy);
      const steps = Math.max(1, Math.ceil(dist / 0.15));
      const sx = totalDx / steps;
      const sy = totalDy / steps;

      let alive = true;
      for (let s = 0; s < steps && alive; s++) {
        this.bx[b] += sx;
        this.by[b] += sy;

        const gx = Math.floor(this.bx[b]);
        const gy = Math.floor(this.by[b]);

        // 1. STRICT SOLID WALL CHECK — Bullet NEVER penetrates ANY wall!
        if (this.world.blocksBulletsAndSight(gx, gy)) {
          this.sfx.playBulletWallImpact(this.bx[b], this.by[b]);
          for (let p = 0; p < 4; p++) {
            this.spawnParticle(this.bx[b] - sx, this.by[b] - sy, 0.55, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, 2.2, PART_SPARK, 0.35);
          }
          alive = false;
          break;
        }

        // Shatter intact windows cleanly when shot through!
        if (this.world.getStruct(gx, gy) === STRUCT_WINDOW_INTACT) {
          this.world.setStruct(gx, gy, STRUCT_WINDOW_BROKEN);
          this.sfx.playGlassShatter(gx + 0.5, gy + 0.5);
          for (let p = 0; p < 8; p++) {
            this.spawnParticle(gx + 0.5, gy + 0.5, 0.6, (Math.random() - 0.5) * 3.5, (Math.random() - 0.5) * 3.5, 2.0, PART_GLASS, 1.3);
          }
        }

        // Gas pump explosion on stray bullet!
        if (this.world.getProp(gx, gy) === PROP_GAS_PUMP) {
          this.world.setProp(gx, gy, PROP_NONE);
          this.triggerExplosion(gx + 0.5, gy + 0.5, 5.2, true);
          alive = false;
          break;
        }

        // 2. Vehicle metal body check
        for (const v of this.world.vehicles) {
          const hw = v.axis === 0 ? 1.15 : 0.72;
          const hh = v.axis === 0 ? 0.72 : 1.15;
          if (Math.abs(this.bx[b] - v.x) < hw && Math.abs(this.by[b] - v.y) < hh) {
            this.damageVehicle(v, this.bDmg[b] * 0.45, true);
            alive = false;
            break;
          }
        }
        if (!alive) break;

        // 3. Unit hit check via spatial bucket
        const bucket = spatialBucket(gx >> 2, gy >> 2);
        let u = this.gridHead[bucket];
        let guard = 0;
        while (u >= 0 && guard++ < 32) {
          if (this.uHp[u] > 0 && u !== this.bOwner[b]) {
            const zed = isZombieRole(this.uRole[u]);
            const canHit = zed || (this.bRaider[b] === 1 && this.uRole[u] !== ROLE_RAIDER) || (this.bRaider[b] === 0 && this.uRole[u] === ROLE_RAIDER);
            if (canHit) {
              const d2 = (this.ux[u] - this.bx[b]) ** 2 + (this.uy[u] - this.by[b]) ** 2;
              if (d2 < 0.22) {
                this.uHp[u] -= this.bDmg[b];
                this.sfx.playFleshHit(this.ux[u], this.uy[u]);
                this.world.addBlood(Math.floor(this.ux[u]), Math.floor(this.uy[u]), 0.22);
                const mag = Math.max(0.01, Math.hypot(this.bvx[b], this.bvy[b]));
                this.ux[u] += (this.bvx[b] / mag) * this.bKnock[b] * 0.08;
                this.uy[u] += (this.bvy[b] / mag) * this.bKnock[b] * 0.08;
                this.resolveUnitCollisions(u, 0.016);

                // Leg-crippling shot turns shambler into slow crawler!
                if (this.uRole[u] === ROLE_ZOMBIE_SHAMBLER && this.uHp[u] > 0 && this.uHp[u] < 35 && Math.random() < 0.3) {
                  this.uRole[u] = ROLE_ZOMBIE_CRAWLER;
                }

                for (let p = 0; p < 5; p++) {
                  this.spawnParticle(this.bx[b], this.by[b], 0.5, (Math.random() - 0.5) * 3.2, (Math.random() - 0.5) * 3.2, 2.0, PART_BLOOD, 0.9);
                }
                const owner = this.bOwner[b];
                if (this.uHp[u] <= 0 && owner >= 0 && owner < this.count) {
                  this.uKills[owner]++;
                }
                alive = false;
                break;
              }
            }
          }
          u = this.gridNext[u];
        }
      }

      if (alive) {
        if (write !== b) {
          this.bx[write] = this.bx[b];
          this.by[write] = this.by[b];
          this.bvx[write] = this.bvx[b];
          this.bvy[write] = this.bvy[b];
          this.bLife[write] = this.bLife[b];
          this.bDmg[write] = this.bDmg[b];
          this.bKnock[write] = this.bKnock[b];
          this.bRaider[write] = this.bRaider[b];
          this.bOwner[write] = this.bOwner[b];
        }
        write++;
      }
    }
    this.bulletCount = write;
  }

  private stepParticles(dt: number): void {
    let write = 0;
    for (let p = 0; p < this.partCount; p++) {
      this.pLife[p] -= dt;
      if (this.pLife[p] <= 0) continue;

      this.px[p] += this.pvx[p] * dt;
      this.py[p] += this.pvy[p] * dt;
      this.pz[p] += this.pvz[p] * dt;

      const kind = this.pKind[p];
      if (kind === PART_SMOKE || kind === PART_FIRE || kind === PART_FLARE) {
        this.pvz[p] += dt * 0.8;
      } else {
        this.pvz[p] -= dt * 9.5;
        if (this.pz[p] < 0) {
          this.pz[p] = 0;
          this.pvz[p] = -this.pvz[p] * 0.35;
          this.pvx[p] *= 0.6;
          this.pvy[p] *= 0.6;
        }
      }

      if (write !== p) {
        this.px[write] = this.px[p];
        this.py[write] = this.py[p];
        this.pz[write] = this.pz[p];
        this.pvx[write] = this.pvx[p];
        this.pvy[write] = this.pvy[p];
        this.pvz[write] = this.pvz[p];
        this.pLife[write] = this.pLife[p];
        this.pMaxLife[write] = this.pMaxLife[p];
        this.pKind[write] = this.pKind[p];
      }
      write++;
    }
    this.partCount = write;
  }

  private stepFire(dt: number): void {
    this.fireAccum += dt;
    if (this.fireAccum < 0.35) return;
    const stepDt = this.fireAccum;
    this.fireAccum = 0;

    for (const ch of this.world.chunks.values()) {
      for (let ly = 0; ly < CHUNK_SIZE; ly++) {
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          const off = (ly << CHUNK_SHIFT) | lx;
          const f = ch.fire[off];
          if (f <= 0.01) continue;

          const gx = (ch.cx << CHUNK_SHIFT) + lx;
          const gy = (ch.cy << CHUNK_SHIFT) + ly;

          ch.fire[off] = Math.max(0, f - stepDt * (this.weather === 'rain' || this.weather === 'storm' ? 0.35 : 0.10));
          ch.fuel[off] = Math.max(0, ch.fuel[off] - stepDt * 0.12);
          ch.scorch[off] = Math.min(1, ch.scorch[off] + stepDt * 0.25);

          if (Math.random() < 0.45) {
            this.spawnParticle(gx + 0.5, gy + 0.5, 0.3, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5, 1.8, PART_FIRE, 0.55);
          }

          if (f > 0.55 && Math.random() < 0.18) {
            const nx = gx + ((Math.random() * 3) | 0) - 1;
            const ny = gy + ((Math.random() * 3) | 0) - 1;
            if (this.world.getFuel(nx, ny) > 0.2 && this.world.getFire(nx, ny) < 0.2) {
              this.world.setFire(nx, ny, 0.75);
            }
          }
        }
      }
    }
  }

  public emitSound(x: number, y: number, radius: number, color = '#ffd166', label?: string): void {
    if (this.soundRings.length < 28) {
      this.soundRings.push({
        x,
        y,
        maxRadius: radius,
        age: 0,
        duration: Math.max(1.2, Math.min(2.6, radius * 0.045)),
        color,
        label,
      });
    }

    const r2 = radius * radius;
    for (let i = 0; i < this.count; i++) {
      if (!isZombieRole(this.uRole[i]) || this.uHp[i] <= 0) continue;
      const d2 = (this.ux[i] - x) ** 2 + (this.uy[i] - y) ** 2;
      if (d2 < r2 && this.targetCache[i] < 0) {
        this.uGoalX[i] = x + (Math.random() - 0.5) * 4;
        this.uGoalY[i] = y + (Math.random() - 0.5) * 4;
        this.uGoalTimer[i] = 8.0 + Math.random() * 4.0;
        this.uTask[i] = 5;
      }
    }
  }

  public triggerExplosion(wx: number, wy: number, radius: number, spawnFire: boolean): void {
    this.sfx.playExplosion(wx, wy);
    this.emitSound(wx, wy, 75, '#ff5400', '💥 ВЗРЫВ!');
    // Multi-frame Pixel Explosion Flipbook + Rising Smoke Billows!
    this.spawnFxBurst('explosion', wx, wy, 0.4, 0, 0.62, Math.max(1.1, radius * 0.48));
    for (let k = 0; k < 4; k++) {
      this.spawnFxBurst(
        'smoke_puff',
        wx + (Math.random() - 0.5) * radius * 0.8,
        wy + (Math.random() - 0.5) * radius * 0.8,
        0.5 + k * 0.25,
        0,
        1.15 + Math.random() * 0.5,
        1.15,
      );
    }

    const rCeil = Math.ceil(radius);
    const cgx = Math.floor(wx);
    const cgy = Math.floor(wy);

    for (let y = cgy - rCeil; y <= cgy + rCeil; y++) {
      for (let x = cgx - rCeil; x <= cgx + rCeil; x++) {
        const d = Math.hypot(x + 0.5 - wx, y + 0.5 - wy);
        if (d > radius) continue;
        this.world.addScorch(x, y, 0.85 * (1 - d / radius));
        if (d < radius * 0.72) {
          const st = this.world.getStruct(x, y);
          if (st !== STRUCT_NONE) {
            this.world.setStruct(x, y, STRUCT_RUBBLE);
          }
          if (spawnFire && this.world.getFloor(x, y) !== FLOOR_WATER && Math.random() < 0.55) {
            this.world.setFire(x, y, 0.9);
            this.world.setFuel(x, y, 0.7);
          }
        } else if (this.world.getStruct(x, y) === STRUCT_WINDOW_INTACT) {
          this.world.setStruct(x, y, STRUCT_WINDOW_BROKEN);
        }
      }
    }

    for (let i = 0; i < this.count; i++) {
      const d = Math.hypot(this.ux[i] - wx, this.uy[i] - wy);
      if (d < radius * 1.45) {
        const dmg = (1 - d / (radius * 1.45)) * 165;
        this.uHp[i] -= dmg;
        this.uBurning[i] = 2.5;
        if (this.uRole[i] === ROLE_ZOMBIE_SHAMBLER && this.uHp[i] > 0) {
          this.uRole[i] = ROLE_ZOMBIE_CRAWLER;
        }
      }
    }

    for (let p = 0; p < 36; p++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 2 + Math.random() * 7;
      this.spawnParticle(
        wx,
        wy,
        0.5,
        Math.cos(a) * spd,
        Math.sin(a) * spd,
        2 + Math.random() * 4,
        p % 2 === 0 ? PART_FIRE : PART_SMOKE,
        1.6,
      );
    }
  }

  public spawnParticle(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    kind: number,
    life: number,
  ): void {
    const idx = this.partCount < MAX_PARTICLES ? this.partCount++ : (this.partCursor = (this.partCursor + 1) % MAX_PARTICLES);
    this.px[idx] = x;
    this.py[idx] = y;
    this.pz[idx] = z;
    this.pvx[idx] = vx;
    this.pvy[idx] = vy;
    this.pvz[idx] = vz;
    this.pKind[idx] = kind;
    this.pLife[idx] = life;
    this.pMaxLife[idx] = life;
  }

  public applyDirectorTool(tool: SimToolId, wx: number, wy: number): void {
    const gx = Math.floor(wx);
    const gy = Math.floor(wy);
    const brushR = BRUSH_SIZES[this.brushIndex]?.radius ?? 3;

    if (tool === 'expand_base') {
      // Find building under/near cursor -> expand with a new attached room, OR build a brand new Safehouse Outpost in the open!
      let targetBldg = this.world.getBuildingId(gx, gy);
      if (targetBldg < 0) {
        let bestD = 12;
        for (const b of this.world.buildings) {
          const d = Math.hypot(b.x0 + b.w * 0.5 - wx, b.y0 + b.h * 0.5 - wy);
          if (d < bestD) {
            bestD = d;
            targetBldg = b.id;
          }
        }
      }

      if (targetBldg >= 0) {
        const res = this.world.expandBuildingWithNewRoom(targetBldg);
        if (res.ok && res.roomCenter) {
          this.totalExpansionsBuilt++;
          this.sfx.playWoodImpact(true);
          for (let p = 0; p < 16; p++) {
            this.spawnParticle(res.roomCenter.x, res.roomCenter.y, 0.6, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, 2.2, PART_SPLINTER, 1.0);
          }
          this.onRadioBroadcast?.(
            `🏗 Достроено новое помещение «${res.label}» у «${this.world.buildings[targetBldg].name}»!`,
            '#ffd466',
          );
        }
      } else {
        // Construct a brand-new fortified wooden Outpost in the open world!
        const sq = this.nextSquadId++;
        const newId = this.world.createBuildingBox(
          gx - 4,
          gy - 4,
          9,
          8,
          'house',
          `Форпост выживших №${sq}`,
          STRUCT_WALL_WOOD,
          5,
          '#6b4f35',
          Math.random,
          true,
          sq,
          28,
        );
        for (let k = 0; k < 3; k++) {
          this.spawnUnit(gx + (k - 1), gy, ROLE_CIVILIAN, newId, sq);
        }
        this.sfx.playWoodImpact(true);
        this.onRadioBroadcast?.(`🏠 Возведён новый укреплённый «Форпост выживших №${sq}»!`, '#80ed99');
      }
      return;
    }

    if (tool === 'spawn_shambler') {
      const n = Math.max(1, Math.round(brushR * 0.8));
      for (let k = 0; k < n; k++) {
        this.spawnUnit(wx + (Math.random() - 0.5) * brushR, wy + (Math.random() - 0.5) * brushR, ROLE_ZOMBIE_SHAMBLER, -1, 0);
      }
      this.sfx.playZombieGroan();
    } else if (tool === 'spawn_sprinter') {
      for (let k = 0; k < 2; k++) {
        this.spawnUnit(wx + (Math.random() - 0.5) * 2, wy + (Math.random() - 0.5) * 2, ROLE_ZOMBIE_SPRINTER, -1, 0);
      }
      this.sfx.playZombieGroan();
    } else if (tool === 'spawn_armored_zed') {
      for (let k = 0; k < 2; k++) {
        this.spawnUnit(wx + (Math.random() - 0.5) * 2, wy + (Math.random() - 0.5) * 2, ROLE_ZOMBIE_ARMORED, -1, 0);
      }
    } else if (tool === 'horde_wave') {
      for (let k = 0; k < 22; k++) {
        const a = Math.random() * Math.PI * 2;
        const r = 2 + Math.random() * (brushR + 4);
        const role = k % 7 === 0 ? ROLE_ZOMBIE_SPRINTER : k % 5 === 0 ? ROLE_ZOMBIE_ARMORED : ROLE_ZOMBIE_SHAMBLER;
        this.spawnUnit(wx + Math.cos(a) * r, wy + Math.sin(a) * r, role, -1, 0);
      }
      this.sfx.playZombieGroan();
      this.onRadioBroadcast?.('☣ Крупная волна мертвецов замечена на подступах к району!', '#b5e48c');
    } else if (tool === 'virus_cloud') {
      for (let p = 0; p < 18; p++) {
        this.spawnParticle(wx + (Math.random() - 0.5) * 5, wy + (Math.random() - 0.5) * 5, 0.5, 0, 0, 1.0, PART_FLARE, 2.2);
      }
      for (let i = 0; i < this.count; i++) {
        if (!isZombieRole(this.uRole[i]) && Math.hypot(this.ux[i] - wx, this.uy[i] - wy) <= brushR + 3) {
          this.uInfection[i] = Math.max(this.uInfection[i], 0.35);
          this.uMoodles[i] |= MOODLE_BITTEN;
        }
      }
      this.onRadioBroadcast?.('🦠 Распылён аэрозоль штамма «Нокс» — заражённые скрывают симптомы!', '#80ed99');
    } else if (tool === 'spawn_survivors') {
      const bId = this.world.getBuildingId(gx, gy);
      const sq = bId >= 0 && this.world.buildings[bId].safehouseSquad > 0 ? this.world.buildings[bId].safehouseSquad : this.nextSquadId++;
      if (bId >= 0) {
        this.world.buildings[bId].isSafehouse = true;
        this.world.buildings[bId].safehouseSquad = sq;
      }
      for (let k = 0; k < 3; k++) {
        this.spawnUnit(wx + (Math.random() - 0.5) * 2, wy + (Math.random() - 0.5) * 2, ROLE_CIVILIAN, bId, sq);
      }
    } else if (tool === 'spawn_police') {
      // Reinforcements ALWAYS join Squad #1 centered on the Police Station!
      for (let k = 0; k < 3; k++) {
        this.spawnUnit(wx + (Math.random() - 0.5) * 2, wy + (Math.random() - 0.5) * 2, ROLE_POLICE, this.world.policeStationId, 1);
      }
      this.onRadioBroadcast?.('🚓 Прибыло подкрепление офицеров для Группы №1!', '#4cc9f0');
    } else if (tool === 'spawn_soldiers') {
      const bId = this.world.getBuildingId(gx, gy);
      for (let k = 0; k < 4; k++) {
        this.spawnUnit(wx + (Math.random() - 0.5) * 2, wy + (Math.random() - 0.5) * 2, ROLE_SOLDIER, bId, 1);
      }
    } else if (tool === 'spawn_medics') {
      const bId = this.world.getBuildingId(gx, gy);
      for (let k = 0; k < 3; k++) {
        this.spawnUnit(wx + (Math.random() - 0.5) * 2, wy + (Math.random() - 0.5) * 2, ROLE_MEDIC, bId >= 0 ? bId : this.world.policeStationId, 1);
      }
    } else if (tool === 'spawn_raiders') {
      for (let k = 0; k < 4; k++) {
        this.spawnUnit(wx + (Math.random() - 0.5) * 2.5, wy + (Math.random() - 0.5) * 2.5, ROLE_RAIDER, -1, 99);
      }
      this.onRadioBroadcast?.('💀 На трассе замечена вооружённая банда мародёров!', '#ff6b6b');
    } else if (tool === 'helicopter') {
      this.heliActive = true;
      this.heliX = wx;
      this.heliY = wy;
      this.heliTimer = 32.0;
      this.emitSound(wx, wy, 85, '#ffd166', '🚁 ВЕРТОЛЁТ');
      this.onRadioBroadcast?.('🚁 Слышен гул вертолёта СМИ! Зомби со всей округи идут на звук!', '#ffd166');
    } else if (tool === 'sound_lure') {
      this.sfx.playAlarmBeep(true);
      this.emitSound(wx, wy, 65, '#ff9f1c', '🚨 СИРЕНА');
      for (const v of this.world.vehicles) {
        if (!v.exploded && Math.hypot(v.x - wx, v.y - wy) < 8) {
          v.alarmTimer = 18;
          v.sirenOn = true;
        }
      }
    } else if (tool === 'molotov') {
      this.sfx.playGlassShatter();
      const r = Math.max(1.5, brushR * 0.55);
      for (let y = gy - 3; y <= gy + 3; y++) {
        for (let x = gx - 3; x <= gx + 3; x++) {
          if (Math.hypot(x - gx, y - gy) <= r && this.world.getFloor(x, y) !== FLOOR_WATER) {
            this.world.setFire(x, y, 0.92);
            this.world.setFuel(x, y, Math.max(0.75, this.world.getFuel(x, y)));
          }
        }
      }
      this.emitSound(wx, wy, 20, '#ff5400');
    } else if (tool === 'propane_bomb') {
      this.triggerExplosion(wx, wy, Math.max(4.0, brushR * 0.9), true);
    } else if (tool === 'airdrop') {
      this.world.setProp(gx, gy, PROP_AIRDROP);
      this.world.setLoot(gx, gy, 14);
      if (this.world.buildings[this.world.policeStationId]) {
        this.world.buildings[this.world.policeStationId].woodStock += 12;
      }
      this.emitSound(wx, wy, 32, '#8ac926', '📦 ГРУЗ');
      for (let p = 0; p < 20; p++) {
        this.spawnParticle(wx, wy, 0.4, (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5, 2.6, PART_FLARE, 2.5);
      }
      this.onRadioBroadcast?.('📦 Сброшен военный груз (оружие, стройматериалы и медикаменты)!', '#8ac926');
    } else if (tool === 'barricade') {
      this.sfx.playWoodImpact(true);
      let boarded = 0;
      for (let y = gy - 3; y <= gy + 3; y++) {
        for (let x = gx - 3; x <= gx + 3; x++) {
          const st = this.world.getStruct(x, y);
          if (st === STRUCT_WINDOW_INTACT || st === STRUCT_WINDOW_BROKEN) {
            this.world.setStruct(x, y, STRUCT_WINDOW_BROKEN);
            this.world.setBarricade(x, y, 4);
            boarded++;
          }
        }
      }
      if (boarded === 0) {
        const half = Math.max(1, Math.floor(brushR * 0.4));
        for (let dx = -half; dx <= half; dx++) {
          if (this.world.getStruct(gx + dx, gy) === STRUCT_NONE) {
            this.world.setStruct(gx + dx, gy, STRUCT_SANDBAG);
          }
        }
      }
    } else if (tool === 'spawn_car') {
      const r = Math.random();
      const kind: Vehicle['kind'] = r < 0.3 ? 'police' : r < 0.55 ? 'pickup' : r < 0.72 ? 'ambulance' : 'sedan';
      this.world.spawnVehicle(wx, wy, kind, Math.random() < 0.5 ? 0 : 1);
      this.sfx.playUiClick(520);
    }
  }

  public selectUnitNear(wx: number, wy: number, radius = 2.8): boolean {
    let best = -1;
    let bestD2 = radius * radius;
    for (let i = 0; i < this.count; i++) {
      if (this.uHp[i] <= 0) continue;
      const d2 = (this.ux[i] - wx) ** 2 + (this.uy[i] - wy) ** 2;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = i;
      }
    }
    this.selectedUid = best >= 0 ? this.uUid[best] : 0;
    return best >= 0;
  }

  public getUnitInspection(hoverWx: number, hoverWy: number): UnitInspectionData | null {
    let idx = -1;
    // Always prioritize currently possessed character if Player is in Direct Control Mode (unless inspecting another selected unit)!
    if (this.selectedUid > 0) {
      for (let i = 0; i < this.count; i++) {
        if (this.uUid[i] === this.selectedUid && this.uHp[i] > 0) {
          idx = i;
          break;
        }
      }
      if (idx < 0) this.selectedUid = 0;
    }
    if (idx < 0 && this.controlledUid > 0) {
      idx = this.getControlledIndex();
    }
    if (idx < 0) {
      let bestD2 = 1.8 * 1.8;
      for (let i = 0; i < this.count; i++) {
        if (this.uHp[i] <= 0) continue;
        const d2 = (this.ux[i] - hoverWx) ** 2 + (this.uy[i] - hoverWy) ** 2;
        if (d2 < bestD2) {
          bestD2 = d2;
          idx = i;
        }
      }
    }
    if (idx < 0) return null;

    const role = this.uRole[idx];
    const zed = isZombieRole(role);
    const isCtrl = this.uUid[idx] === this.controlledUid && this.controlledUid > 0;
    const nSeed = this.uNameIdx[idx];
    const fullName = `${FIRST_NAMES[nSeed % FIRST_NAMES.length]} ${LAST_NAMES[(nSeed >> 5) % LAST_NAMES.length].trim()}`;

    const roleNames: Record<number, string> = {
      [ROLE_CIVILIAN]: 'Выживший-строитель',
      [ROLE_POLICE]: 'Офицер полиции Нокс',
      [ROLE_SOLDIER]: 'Боец карантина КЗО',
      [ROLE_MEDIC]: 'Полевой врач',
      [ROLE_RAIDER]: 'Бандит-мародёр',
      [ROLE_ZOMBIE_SHAMBLER]: 'Зомби-шатун',
      [ROLE_ZOMBIE_SPRINTER]: 'Зомби-бегун',
      [ROLE_ZOMBIE_ARMORED]: 'Броне-зомби КЗО',
      [ROLE_ZOMBIE_CRAWLER]: 'Ползучий мертвец',
    };

    const taskNames: Record<number, string> = {
      0: 'Патрулирует базу',
      1: 'Ищет припасы',
      2: 'Заколачивает окна',
      3: 'Ведёт бой',
      4: 'Отступает за укрытие',
      5: 'Идёт на шум / ломает авто',
      6: 'Рубит лес для стройки',
      7: 'Несёт брёвна на расширение базы',
    };

    const m = this.uMoodles[idx];
    const moodles: { label: string; color: string }[] = [];
    if (m & MOODLE_BITTEN) moodles.push({ label: '☣ УКУШЕН', color: '#80ed99' });
    if (m & MOODLE_BLEEDING) moodles.push({ label: '🩸 КРОВОТЕЧЕНИЕ', color: '#e63946' });
    if (m & MOODLE_PANIC) moodles.push({ label: '😱 ПАНИКА', color: '#ff9f1c' });
    if (m & MOODLE_HUNGRY) moodles.push({ label: '🥫 ГОЛОД', color: '#e9c46a' });
    if (m & MOODLE_TIRED) moodles.push({ label: '💤 УСТАЛОСТЬ', color: '#90e0ef' });
    if (m & MOODLE_HEAVY_LOAD) moodles.push({ label: '🪵 БРЁВНА', color: '#bc6c25' });

    const hb = this.uHomeBldg[idx];
    const safeName = hb >= 0 && this.world.buildings[hb] ? this.world.buildings[hb].name : null;

    return {
      uid: this.uUid[idx],
      name: fullName,
      squadId: this.uSquad[idx],
      roleName: roleNames[role] || 'Неизвестный',
      isZombie: zed,
      isControlled: isCtrl,
      hp: Math.ceil(this.uHp[idx]),
      maxHp: Math.ceil(this.uMaxHp[idx]),
      staminaPct: Math.round(this.uStamina[idx] * 100),
      weaponId: this.uWeapon[idx],
      weaponName: WEAPONS[this.uWeapon[idx]]?.name || 'Безоружен',
      ammo: this.uAmmo[idx],
      food: this.uFood[idx],
      bandages: this.uBandages[idx],
      planks: this.uPlanks[idx],
      wood: this.uWood[idx],
      kills: this.uKills[idx],
      taskText: isCtrl ? '🎮 ПРЯМОЕ УПРАВЛЕНИЕ ИГРОКА' : taskNames[this.uTask[idx]] || 'Осматривается',
      infectionPct: Math.min(100, Math.round(this.uInfection[idx] * 100)),
      moodles,
      safehouseName: safeName,
    };
  }

  public recountPopulations(): void {
    for (const b of this.world.buildings) {
      b.survivorsInside = 0;
      b.zombiesInside = 0;
    }

    let liv = 0;
    let sq1 = 0;
    let zeds = 0;

    for (let i = 0; i < this.count; i++) {
      if (this.uHp[i] <= 0) continue;
      const z = isZombieRole(this.uRole[i]);
      if (z) zeds++;
      else {
        liv++;
        if (this.uSquad[i] === 1) sq1++;
      }

      const bId = this.world.getBuildingId(Math.floor(this.ux[i]), Math.floor(this.uy[i]));
      if (bId >= 0 && this.world.buildings[bId]) {
        if (z) this.world.buildings[bId].zombiesInside++;
        else this.world.buildings[bId].survivorsInside++;
      }
    }

    this.livingCount = liv;
    this.squad1Count = sq1;
    this.zombieCount = zeds;
    this.safehouseCount = this.world.buildings.filter((b) => b.isSafehouse && b.survivorsInside > 0).length;
  }

  private copyUnitSlot(dst: number, src: number): void {
    this.ux[dst] = this.ux[src];
    this.uy[dst] = this.uy[src];
    this.uvx[dst] = this.uvx[src];
    this.uvy[dst] = this.uvy[src];
    this.uAngle[dst] = this.uAngle[src];
    this.uRole[dst] = this.uRole[src];
    this.uSquad[dst] = this.uSquad[src];
    this.uWeapon[dst] = this.uWeapon[src];
    this.uAmmo[dst] = this.uAmmo[src];
    this.uFood[dst] = this.uFood[src];
    this.uBandages[dst] = this.uBandages[src];
    this.uPlanks[dst] = this.uPlanks[src];
    this.uWood[dst] = this.uWood[src];
    this.uHp[dst] = this.uHp[src];
    this.uMaxHp[dst] = this.uMaxHp[src];
    this.uInfection[dst] = this.uInfection[src];
    this.uHunger[dst] = this.uHunger[src];
    this.uFatigue[dst] = this.uFatigue[src];
    this.uPanic[dst] = this.uPanic[src];
    this.uMoodles[dst] = this.uMoodles[src];
    this.uBurning[dst] = this.uBurning[src];
    this.uCooldown[dst] = this.uCooldown[src];
    this.uGoalX[dst] = this.uGoalX[src];
    this.uGoalY[dst] = this.uGoalY[src];
    this.uGoalTimer[dst] = this.uGoalTimer[src];
    this.uHomeBldg[dst] = this.uHomeBldg[src];
    this.uWalkPhase[dst] = this.uWalkPhase[src];
    this.uVariant[dst] = this.uVariant[src];
    this.uKills[dst] = this.uKills[src];
    this.uTask[dst] = this.uTask[src];
    this.uUid[dst] = this.uUid[src];
    this.uNameIdx[dst] = this.uNameIdx[src];
    this.uStuckTimer[dst] = this.uStuckTimer[src];
    this.uAttackAnim[dst] = this.uAttackAnim[src];
    this.uStamina[dst] = this.uStamina[src];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ★ DIRECT PLAY-AS-ANYONE MODE (PLAY AS ANY HUMAN SURVIVOR OR ANY ZOMBIE!) ★
  // ═══════════════════════════════════════════════════════════════════════════

  public spawnFxBurst(
    kind: AnimatedFxBurst['kind'],
    x: number,
    y: number,
    z: number,
    angle: number,
    duration: number,
    scale = 1.0,
    tint?: 'human' | 'zombie',
  ): void {
    if (this.fxBursts.length >= 64) this.fxBursts.shift();
    this.fxBursts.push({ kind, x, y, z, angle, age: 0, duration, scale, tint });
  }

  private stepFxBursts(dt: number): void {
    for (let k = this.fxBursts.length - 1; k >= 0; k--) {
      const fx = this.fxBursts[k];
      fx.age += dt;
      if (fx.kind === 'smoke_puff') {
        fx.z += dt * 0.9;
      }
      if (fx.age >= fx.duration) {
        this.fxBursts.splice(k, 1);
      }
    }
  }

  public getControlledIndex(): number {
    if (this.controlledUid <= 0) return -1;
    for (let i = 0; i < this.count; i++) {
      if (this.uUid[i] === this.controlledUid && this.uHp[i] > 0) return i;
    }
    this.controlledUid = 0;
    return -1;
  }

  public possessUnitByUid(uid: number): boolean {
    for (let i = 0; i < this.count; i++) {
      if (this.uUid[i] === uid && this.uHp[i] > 0) {
        this.controlledUid = uid;
        this.selectedUid = uid;
        this.uCooldown[i] = 0;
        const zed = isZombieRole(this.uRole[i]);
        const nSeed = this.uNameIdx[i];
        const fullName = `${FIRST_NAMES[nSeed % FIRST_NAMES.length]} ${LAST_NAMES[(nSeed >> 5) % LAST_NAMES.length].trim()}`;
        this.sfx.playUiClick(680);
        if (zed) this.sfx.playZombieGroan(this.ux[i], this.uy[i], true);
        this.onRadioBroadcast?.(
          zed
            ? `🧟 Вы вселились в зомби (${fullName})! WASD — идти, ЛКМ — укус/крушить, G — зов орды, Esc — выход`
            : `🎮 Вы играете за ${fullName}! WASD — идти, ЛКМ — огонь/удар, F — действие, Q — оружие, B — стройка, Esc — выход`,
          zed ? '#80ed99' : '#ffd466',
        );
        return true;
      }
    }
    return false;
  }

  public possessNearCursor(wx: number, wy: number, radius = 3.2): boolean {
    let best = -1;
    let bestD2 = radius * radius;
    for (let i = 0; i < this.count; i++) {
      if (this.uHp[i] <= 0) continue;
      const d2 = (this.ux[i] - wx) ** 2 + (this.uy[i] - wy) ** 2;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = i;
      }
    }
    if (best >= 0) return this.possessUnitByUid(this.uUid[best]);
    return false;
  }

  public possessBestUnit(preferZombie = false, nearX?: number, nearY?: number): boolean {
    let best = -1;
    let bestScore = 1e9;
    const cx = nearX ?? this.policeStationCoords.x;
    const cy = nearY ?? this.policeStationCoords.y;

    for (let i = 0; i < this.count; i++) {
      if (this.uHp[i] <= 0) continue;
      const zed = isZombieRole(this.uRole[i]);
      if (zed !== preferZombie) continue;
      let score = Math.hypot(this.ux[i] - cx, this.uy[i] - cy);
      if (!zed && this.uSquad[i] === 1) score -= 25; // Prioritize Группа №1 when picking default survivor!
      if (!zed && this.uWeapon[i] >= WPN_PISTOL) score -= 5; // Prefer armed firearm fighter first!
      if (score < bestScore) {
        bestScore = score;
        best = i;
      }
    }
    if (best >= 0) return this.possessUnitByUid(this.uUid[best]);
    return false;
  }

  public cycleControlledUnit(): boolean {
    if (this.count === 0) return false;
    const curIdx = this.getControlledIndex();
    const start = curIdx >= 0 ? curIdx + 1 : 0;
    for (let step = 0; step < this.count; step++) {
      const k = (start + step) % this.count;
      if (this.uHp[k] > 0) {
        return this.possessUnitByUid(this.uUid[k]);
      }
    }
    return false;
  }

  public releaseControl(): void {
    if (this.controlledUid <= 0) return;
    this.controlledUid = 0;
    this.playerInput.primaryDown = false;
    this.sfx.playUiClick(480);
    this.onRadioBroadcast?.('👑 Возврат в Режим Бога WorldBox! Персонаж снова под управлением ИИ.', '#94d2bd');
  }

  private updateControlledUnit(i: number, dt: number, isHuman: boolean): void {
    // 1. Always orient character smoothly toward mouse world cursor!
    const aimDx = this.playerInput.aimWx - this.ux[i];
    const aimDy = this.playerInput.aimWy - this.uy[i];
    if (Math.hypot(aimDx, aimDy) > 0.05) {
      this.uAngle[i] = Math.atan2(aimDy, aimDx);
    }

    // 2. Convert screen-space WASD input cleanly into isometric world movement vector!
    // Screen right (+sx) = (+wx, -wy); Screen down (+sy) = (+wx, +wy)
    const sx = this.playerInput.moveScreenX;
    const sy = this.playerInput.moveScreenY;
    let moveWx = sx + sy;
    let moveWy = sy - sx;
    const mag = Math.hypot(moveWx, moveWy);

    const role = this.uRole[i];
    const baseWalk = isHuman
      ? 2.85
      : role === ROLE_ZOMBIE_SPRINTER
        ? 3.1
        : role === ROLE_ZOMBIE_CRAWLER
          ? 1.15
          : 2.05;

    let isSprinting = false;
    let spd = 0;
    if (mag > 0.01) {
      moveWx /= mag;
      moveWy /= mag;
      if (this.playerInput.sprint && this.uStamina[i] > 0.08) {
        isSprinting = true;
        this.uStamina[i] = Math.max(0, this.uStamina[i] - dt * 0.24);
      } else {
        this.uStamina[i] = Math.min(1, this.uStamina[i] + dt * 0.14);
      }
      spd = baseWalk * (isSprinting ? 1.58 : 1.0);
    } else {
      moveWx = 0;
      moveWy = 0;
      this.uStamina[i] = Math.min(1, this.uStamina[i] + dt * 0.26);
    }

    this.uMoodles[i] = this.uStamina[i] < 0.25 ? this.uMoodles[i] | MOODLE_TIRED : this.uMoodles[i] & ~MOODLE_TIRED;

    this.uvx[i] = moveWx * spd;
    this.uvy[i] = moveWy * spd;

    if (spd > 0.1) {
      this.uWalkPhase[i] += dt * spd * 4.6;
      this.footstepAccum += dt * (isSprinting ? 1.5 : 1.0);
      if (this.footstepAccum >= 0.34) {
        this.footstepAccum = 0;
        const gx = Math.floor(this.ux[i]);
        const gy = Math.floor(this.uy[i]);
        const flr = this.world.getFloor(gx, gy);
        const st = this.world.getStruct(gx, gy);
        const surf: 'glass' | 'wood' | 'grass' | 'concrete' =
          st === STRUCT_WINDOW_BROKEN
            ? 'glass'
            : flr === FLOOR_WOOD
              ? 'wood'
              : flr === FLOOR_GRASS || flr === FLOOR_DIRT
                ? 'grass'
                : 'concrete';
        this.sfx.playFootstep(surf, this.ux[i], this.uy[i], isSprinting);
      }
    }

    // 4 Sub-steps per frame for silky sliding along walls & vehicles with ZERO wall clipping!
    const subDt = dt * 0.25;
    for (let s = 0; s < 4; s++) {
      this.ux[i] += this.uvx[i] * subDt;
      this.uy[i] += this.uvy[i] * subDt;
      this.resolveUnitCollisions(i, subDt);
    }

    // Ensure infinite chunks keep streaming seamlessly as the player explores!
    if ((this.aiTick & 15) === 0) {
      this.world.ensureAreaLoaded(this.ux[i], this.uy[i], 2);
    }

    // Continuous primary attack when holding Left Mouse Button!
    if (this.playerInput.primaryDown && this.uCooldown[i] <= 0) {
      this.playerPrimaryAttack();
    }
  }

  public playerPrimaryAttack(): void {
    const i = this.getControlledIndex();
    if (i < 0 || this.uCooldown[i] > 0) return;

    const zed = isZombieRole(this.uRole[i]);
    if (zed) {
      this.performPlayerZombieClaw(i);
      return;
    }

    const wpn = WEAPONS[this.uWeapon[i]] || WEAPONS[0];
    if (!wpn.isGun || this.uAmmo[i] <= 0) {
      this.playerMeleeStrike();
      return;
    }

    // Responsive player firearm shot along cursor angle!
    const ang = Math.atan2(this.playerInput.aimWy - this.uy[i], this.playerInput.aimWx - this.ux[i]);
    this.uAngle[i] = ang;
    this.uAttackAnim[i] = 0.22;
    this.uCooldown[i] =
      this.uWeapon[i] === WPN_RIFLE ? 0.16 : this.uWeapon[i] === WPN_SHOTGUN ? 0.62 : 0.34;
    this.uAmmo[i]--;

    this.sfx.playGunshot(
      this.uWeapon[i] === WPN_SHOTGUN ? 'shotgun' : this.uWeapon[i] === WPN_RIFLE ? 'rifle' : 'pistol',
      this.ux[i],
      this.uy[i],
      true,
    );
    this.spawnFxBurst('muzzle', this.ux[i] + Math.cos(ang) * 0.55, this.uy[i] + Math.sin(ang) * 0.55, 0.52, ang, 0.12, 1.25);
    this.emitSound(this.ux[i], this.uy[i], wpn.noiseRadius, '#ffd166');

    this.spawnParticle(
      this.ux[i],
      this.uy[i],
      0.55,
      Math.cos(ang + 1.5) * 2.5,
      Math.sin(ang + 1.5) * 2.5,
      2.8,
      PART_SHELL,
      1.6,
    );

    const speed = 18.0;
    for (let p = 0; p < wpn.pellets && this.bulletCount < MAX_BULLETS; p++) {
      const a = ang + (Math.random() - 0.5) * wpn.spread * 0.75;
      const b = this.bulletCount++;
      this.bx[b] = this.ux[i] + Math.cos(a) * 0.36;
      this.by[b] = this.uy[i] + Math.sin(a) * 0.36;
      this.bvx[b] = Math.cos(a) * speed;
      this.bvy[b] = Math.sin(a) * speed;
      this.bLife[b] = (wpn.range + 2.5) / speed;
      this.bDmg[b] = wpn.damage * 1.25;
      this.bKnock[b] = wpn.knockback * 1.2;
      this.bRaider[b] = this.uRole[i] === ROLE_RAIDER ? 1 : 0;
      this.bOwner[b] = i;
    }
  }

  public playerMeleeStrike(): void {
    const i = this.getControlledIndex();
    if (i < 0) return;
    if (isZombieRole(this.uRole[i])) {
      this.performPlayerZombieClaw(i);
      return;
    }
    if (this.uCooldown[i] > 0) return;

    const ang = Math.atan2(this.playerInput.aimWy - this.uy[i], this.playerInput.aimWx - this.ux[i]);
    this.uAngle[i] = ang;
    this.uAttackAnim[i] = 0.28;
    this.uCooldown[i] = 0.42;

    this.sfx.playMeleeSwing(this.ux[i], this.uy[i], true);
    this.spawnFxBurst(
      'slash',
      this.ux[i] + Math.cos(ang) * 0.72,
      this.uy[i] + Math.sin(ang) * 0.72,
      0.5,
      ang,
      0.24,
      1.25,
      'human',
    );

    const dmg = this.uWeapon[i] === WPN_AXE ? 68 : this.uWeapon[i] === WPN_BAT ? 50 : 34;

    // 1. Cleave all hostile targets in a wide 120° arc up to 1.85 tiles in front (respecting walls!)
    for (let k = 0; k < this.count; k++) {
      if (k === i || this.uHp[k] <= 0) continue;
      const isEnemy =
        isZombieRole(this.uRole[k]) ||
        (this.uRole[i] === ROLE_RAIDER ? this.uRole[k] !== ROLE_RAIDER : this.uRole[k] === ROLE_RAIDER);
      if (!isEnemy) continue;

      const dx = this.ux[k] - this.ux[i];
      const dy = this.uy[k] - this.uy[i];
      const dist = Math.hypot(dx, dy);
      if (dist > 1.85) continue;
      const diff = Math.abs(Math.atan2(Math.sin(Math.atan2(dy, dx) - ang), Math.cos(Math.atan2(dy, dx) - ang)));
      if (diff > 1.15) continue;
      if (!this.hasLineOfSight(this.ux[i], this.uy[i], this.ux[k], this.uy[k])) continue;

      this.uHp[k] -= dmg;
      this.sfx.playFleshHit(this.ux[k], this.uy[k]);
      this.world.addBlood(Math.floor(this.ux[k]), Math.floor(this.uy[k]), 0.32);
      if (dist > 0.05) {
        this.ux[k] += (dx / dist) * 0.42;
        this.uy[k] += (dy / dist) * 0.42;
        this.resolveUnitCollisions(k, 0.016);
      }
      for (let p = 0; p < 6; p++) {
        this.spawnParticle(this.ux[k], this.uy[k], 0.5, (Math.random() - 0.5) * 3.2, (Math.random() - 0.5) * 3.2, 2.0, PART_BLOOD, 0.9);
      }
      if (this.uHp[k] <= 0) this.uKills[i]++;
    }

    // 2. Also chop trees or smash intact window directly ahead!
    const tx = Math.floor(this.ux[i] + Math.cos(ang) * 1.05);
    const ty = Math.floor(this.uy[i] + Math.sin(ang) * 1.05);
    const prop = this.world.getProp(tx, ty);
    if (prop === PROP_TREE_PINE || prop === PROP_TREE_OAK) {
      const left = this.world.getLoot(tx, ty);
      this.world.setLoot(tx, ty, Math.max(0, left - 1));
      this.uWood[i] = Math.min(20, this.uWood[i] + 3);
      this.uPlanks[i] = Math.min(12, this.uPlanks[i] + 1);
      this.sfx.playWoodImpact(true, tx + 0.5, ty + 0.5);
      for (let p = 0; p < 5; p++) {
        this.spawnParticle(tx + 0.5, ty + 0.5, 0.5, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, 2.2, PART_SPLINTER, 0.8);
      }
      if (left - 1 <= 0) this.world.setProp(tx, ty, PROP_NONE);
    } else if (this.world.getStruct(tx, ty) === STRUCT_WINDOW_INTACT) {
      this.world.setStruct(tx, ty, STRUCT_WINDOW_BROKEN);
      this.sfx.playGlassShatter(tx + 0.5, ty + 0.5);
    }
  }

  private performPlayerZombieClaw(i: number): void {
    const ang = Math.atan2(this.playerInput.aimWy - this.uy[i], this.playerInput.aimWx - this.ux[i]);
    this.uAngle[i] = ang;
    this.uAttackAnim[i] = 0.30;
    this.uCooldown[i] = 0.52;

    this.sfx.playZombieGroan(this.ux[i], this.uy[i], true);
    this.spawnFxBurst(
      'slash',
      this.ux[i] + Math.cos(ang) * 0.68,
      this.uy[i] + Math.sin(ang) * 0.68,
      0.5,
      ang,
      0.25,
      1.2,
      'zombie',
    );

    // 1. Bite nearby humans!
    for (let k = 0; k < this.count; k++) {
      if (k === i || this.uHp[k] <= 0 || isZombieRole(this.uRole[k])) continue;
      if (Math.hypot(this.ux[k] - this.ux[i], this.uy[k] - this.uy[i]) <= 1.65) {
        if (this.hasLineOfSight(this.ux[i], this.uy[i], this.ux[k], this.uy[k])) {
          this.zombieBiteHuman(i, k);
          this.uKills[i]++;
        }
      }
    }

    // 2. Smash doors, barricaded windows, fences & vehicles right in front of the player zombie!
    const tx = Math.floor(this.ux[i] + Math.cos(ang) * 0.95);
    const ty = Math.floor(this.uy[i] + Math.sin(ang) * 0.95);
    const barr = this.world.getBarricade(tx, ty);
    const st = this.world.getStruct(tx, ty);
    if (barr > 0) {
      this.world.setBarricade(tx, ty, barr - 1);
      this.sfx.playWoodImpact(false, tx + 0.5, ty + 0.5);
    } else if (st === STRUCT_WINDOW_INTACT) {
      this.world.setStruct(tx, ty, STRUCT_WINDOW_BROKEN);
      this.sfx.playGlassShatter(tx + 0.5, ty + 0.5);
    } else if (st === STRUCT_DOOR_CLOSED || st === STRUCT_FENCE_WOOD || st === STRUCT_SANDBAG) {
      const hp = this.world.getStructHp(tx, ty) - 65;
      this.sfx.playWoodImpact(false, tx + 0.5, ty + 0.5);
      if (hp <= 0) this.world.setStruct(tx, ty, STRUCT_NONE);
      else this.world.setStructHp(tx, ty, hp);
    }

    for (const v of this.world.vehicles) {
      if (!v.exploded && Math.hypot(v.x - this.ux[i], v.y - this.uy[i]) < 2.1) {
        this.damageVehicle(v, 36, false);
      }
    }
  }

  public playerCycleWeapon(): void {
    const i = this.getControlledIndex();
    if (i < 0 || isZombieRole(this.uRole[i])) return;
    const order = [WPN_AXE, WPN_PISTOL, WPN_SHOTGUN, WPN_RIFLE, WPN_BAT];
    const next = order[(order.indexOf(this.uWeapon[i]) + 1) % order.length];
    this.uWeapon[i] = next;
    if (WEAPONS[next].isGun && this.uAmmo[i] === 0) {
      this.uAmmo[i] = 24;
    }
    this.sfx.playPickup(this.ux[i], this.uy[i]);
  }

  public playerInteract(): void {
    const i = this.getControlledIndex();
    if (i < 0) return;
    if (isZombieRole(this.uRole[i])) {
      this.performPlayerZombieClaw(i);
      return;
    }

    const gx = Math.floor(this.ux[i]);
    const gy = Math.floor(this.uy[i]);

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const tx = gx + dx;
        const ty = gy + dy;
        const st = this.world.getStruct(tx, ty);

        // 1. Toggle Closed/Open Door!
        if (st === STRUCT_DOOR_CLOSED) {
          this.world.setStruct(tx, ty, STRUCT_DOOR_OPEN);
          this.sfx.playWoodImpact(true, tx + 0.5, ty + 0.5);
          return;
        }
        if (st === STRUCT_DOOR_OPEN && (dx !== 0 || dy !== 0)) {
          this.world.setStruct(tx, ty, STRUCT_DOOR_CLOSED);
          this.sfx.playWoodImpact(true, tx + 0.5, ty + 0.5);
          return;
        }

        // 2. Barricade intact/broken window if carrying planks!
        if ((st === STRUCT_WINDOW_INTACT || st === STRUCT_WINDOW_BROKEN) && this.uPlanks[i] > 0 && this.world.getBarricade(tx, ty) < 4) {
          this.uPlanks[i]--;
          this.world.setBarricade(tx, ty, this.world.getBarricade(tx, ty) + 1);
          this.sfx.playWoodImpact(true, tx + 0.5, ty + 0.5);
          return;
        }

        // 3. Loot nearby container / pile / tree!
        const prop = this.world.getProp(tx, ty);
        const loot = this.world.getLoot(tx, ty);
        if (prop !== PROP_NONE && loot > 0) {
          this.world.setLoot(tx, ty, loot - 1);
          if (prop === PROP_TREE_PINE || prop === PROP_TREE_OAK || prop === PROP_LOG_PILE) {
            this.uWood[i] = Math.min(24, this.uWood[i] + 4);
            this.uPlanks[i] = Math.min(12, this.uPlanks[i] + 2);
            this.sfx.playWoodImpact(true, tx + 0.5, ty + 0.5);
            if (loot - 1 <= 0) this.world.setProp(tx, ty, PROP_NONE);
          } else {
            this.uAmmo[i] += 20;
            this.uFood[i] = Math.min(12, this.uFood[i] + 2);
            this.uBandages[i] = Math.min(12, this.uBandages[i] + 2);
            this.uPlanks[i] = Math.min(12, this.uPlanks[i] + 2);
            this.uWood[i] = Math.min(24, this.uWood[i] + 3);
            this.sfx.playPickup(this.ux[i], this.uy[i]);
          }
          return;
        }
      }
    }
  }

  public playerHealSelf(): void {
    const i = this.getControlledIndex();
    if (i < 0 || isZombieRole(this.uRole[i])) return;
    if (this.uBandages[i] > 0) {
      this.uBandages[i]--;
      this.uHp[i] = Math.min(this.uMaxHp[i], this.uHp[i] + 45);
      this.uMoodles[i] &= ~MOODLE_BLEEDING;
      this.sfx.playPickup(this.ux[i], this.uy[i]);
    } else if (this.uFood[i] > 0) {
      this.uFood[i]--;
      this.uHunger[i] = 0;
      this.uHp[i] = Math.min(this.uMaxHp[i], this.uHp[i] + 28);
      this.sfx.playPickup(this.ux[i], this.uy[i]);
    }
  }

  public playerBuildAction(): void {
    const i = this.getControlledIndex();
    if (i < 0 || isZombieRole(this.uRole[i])) return;

    const curB = this.world.getBuildingId(Math.floor(this.ux[i]), Math.floor(this.uy[i]));
    if (curB >= 0) {
      const res = this.world.expandBuildingWithNewRoom(curB);
      if (res.ok && res.roomCenter) {
        this.totalExpansionsBuilt++;
        this.uWood[i] = Math.max(0, this.uWood[i] - 4);
        this.sfx.playWoodImpact(true, res.roomCenter.x, res.roomCenter.y);
        this.onRadioBroadcast?.(`🏗 Вы пристроили комнату «${res.label}» к «${this.world.buildings[curB].name}»!`, '#ffd466');
        return;
      }
    }

    // Outside: place a solid Sandbag fortification right in front of your character!
    const ang = this.uAngle[i];
    const bx = Math.floor(this.ux[i] + Math.cos(ang) * 1.35);
    const by = Math.floor(this.uy[i] + Math.sin(ang) * 1.35);
    if (this.world.getStruct(bx, by) === STRUCT_NONE) {
      this.world.setStruct(bx, by, STRUCT_SANDBAG);
      this.sfx.playWoodImpact(true, bx + 0.5, by + 0.5);
    }
  }

  public playerSpecialCall(): void {
    const i = this.getControlledIndex();
    if (i < 0) return;
    const zed = isZombieRole(this.uRole[i]);
    if (zed) {
      // Zombie Alpha Horde Roar — calls every zombie within 42 tiles to swarm with you!
      this.sfx.playZombieGroan(this.ux[i], this.uy[i], true);
      this.emitSound(this.ux[i], this.uy[i], 42, '#80ed99', '🧟 ЗОВ ОРДЫ!');
      for (let k = 0; k < this.count; k++) {
        if (k !== i && isZombieRole(this.uRole[k]) && Math.hypot(this.ux[k] - this.ux[i], this.uy[k] - this.uy[i]) < 42) {
          this.uGoalX[k] = this.playerInput.aimWx;
          this.uGoalY[k] = this.playerInput.aimWy;
          this.uGoalTimer[k] = 10.0;
        }
      }
      this.onRadioBroadcast?.('🧟 РЁВ ВОЖАКА ОРДЫ! Все мертвецы в округе стягиваются к вашей цели!', '#80ed99');
    } else {
      // Human Squad Radio Rally!
      this.sfx.playUiClick(740);
      let rallied = 0;
      for (let k = 0; k < this.count; k++) {
        if (k !== i && !isZombieRole(this.uRole[k]) && this.uRole[k] !== ROLE_RAIDER) {
          if (Math.hypot(this.ux[k] - this.ux[i], this.uy[k] - this.uy[i]) < 26) {
            this.uGoalX[k] = this.ux[i] + (Math.random() - 0.5) * 3;
            this.uGoalY[k] = this.uy[i] + (Math.random() - 0.5) * 3;
            this.uGoalTimer[k] = 8.0;
            rallied++;
          }
        }
      }
      this.onRadioBroadcast?.(`📻 Рация отряда: ${rallied} бойцов стягиваются к вашей позиции!`, '#4cc9f0');
    }
  }
}
