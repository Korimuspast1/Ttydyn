import { ZomboidAudio } from '../audio/sfx';
import {
  FLOOR_WATER,
  isZombieRole,
  MAP_H,
  MAP_W,
  MOODLE_BITTEN,
  MOODLE_BLEEDING,
  MOODLE_HUNGRY,
  MOODLE_PANIC,
  MOODLE_TIRED,
  PROP_AIRDROP,
  PROP_CRATE,
  PROP_FRIDGE,
  PROP_GAS_PUMP,
  PROP_GUN_LOCKER,
  PROP_MED_CABINET,
  PROP_NONE,
  PROP_SHELF,
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
  STRUCT_WINDOW_BROKEN,
  STRUCT_WINDOW_INTACT,
  TimeOfDayMode,
  UnitInspectionData,
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

export const MAX_UNITS = 950;
export const MAX_PARTICLES = 2400;
export const MAX_BULLETS = 512;

export const PART_BLOOD = 0;
export const PART_GLASS = 1;
export const PART_SHELL = 2;
export const PART_SPLINTER = 3;
export const PART_FIRE = 4;
export const PART_SMOKE = 5;
export const PART_FLARE = 6;
export const PART_SPARK = 7;

const FIRST_NAMES = [
  'Рик', 'Дэрил', 'Гленн', 'Клэр', 'Леон', 'Элли', 'Джоэл', 'Билл', 'Зои', 'Фрэнсис',
  'Луис', 'Ник', 'Кейт', 'Артур', 'Шейн', 'Мэгги', 'Виктор', 'Елена', 'Макс', 'Сара',
];
const LAST_NAMES = [
  'Граймс', 'Диксон', 'Редфилд', 'Кеннеди', 'Миллер', 'Уильямс', 'Ковальски', 'Картер',
  'Новак', 'Браун', 'Харрис', 'Морган', 'Прайс', 'Фостер', 'Смит', 'Вэнс',
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

export class ZomboidSimulation {
  // Structure-of-Arrays Unit Storage (Zero GC hot loop!)
  public count = 0;
  public ux = new Float32Array(MAX_UNITS);
  public uy = new Float32Array(MAX_UNITS);
  public uvx = new Float32Array(MAX_UNITS);
  public uvy = new Float32Array(MAX_UNITS);
  public uAngle = new Float32Array(MAX_UNITS);
  public uRole = new Uint8Array(MAX_UNITS);
  public uWeapon = new Uint8Array(MAX_UNITS);
  public uAmmo = new Uint16Array(MAX_UNITS);
  public uFood = new Uint8Array(MAX_UNITS);
  public uBandages = new Uint8Array(MAX_UNITS);
  public uPlanks = new Uint8Array(MAX_UNITS);
  public uHp = new Float32Array(MAX_UNITS);
  public uMaxHp = new Float32Array(MAX_UNITS);
  public uInfection = new Float32Array(MAX_UNITS); // 0 = clean, >0..1 = Knox incubation!
  public uHunger = new Float32Array(MAX_UNITS);
  public uFatigue = new Float32Array(MAX_UNITS);
  public uPanic = new Float32Array(MAX_UNITS);
  public uMoodles = new Uint8Array(MAX_UNITS);
  public uBurning = new Float32Array(MAX_UNITS);
  public uCooldown = new Float32Array(MAX_UNITS);
  public uGoalX = new Float32Array(MAX_UNITS);
  public uGoalY = new Float32Array(MAX_UNITS);
  public uGoalTimer = new Float32Array(MAX_UNITS);
  public uHomeBldg = new Int16Array(MAX_UNITS);
  public uWalkPhase = new Float32Array(MAX_UNITS);
  public uVariant = new Uint8Array(MAX_UNITS);
  public uKills = new Uint16Array(MAX_UNITS);
  public uTask = new Uint8Array(MAX_UNITS); // 0=patrol, 1=loot, 2=barricade, 3=fight, 4=flee, 5=hunt_sound
  public uUid = new Int32Array(MAX_UNITS);
  public uNameIdx = new Uint16Array(MAX_UNITS);

  private nextUid = 1;
  public selectedUid = 0;

  // Spatial Hash Grid (4x4 tile cells -> 37x37 = 1369 cells)
  private static readonly GRID_W = 37;
  private gridHead = new Int16Array(1369);
  private gridNext = new Int16Array(MAX_UNITS);
  private targetCache = new Int16Array(MAX_UNITS);
  private aiTick = 0;

  // Ballistic Projectiles
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

  // 3D Physics Particles (Casings, Glass Shards, Blood, Splinters, Fire, Smoke, Flares)
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

  // Meta-Sound Waves & Helicopter Event
  public soundRings: SoundWaveRing[] = [];
  public showSoundWaves = true;

  public heliActive = false;
  public heliX = 0;
  public heliY = 0;
  public heliTimer = 0;
  private heliPingAccum = 0;

  // Day/Night Clock & Weather
  public worldMinutes = 8 * 60 + 20; // Starts 08:20 AM Day 1 of Outbreak!
  public dayNumber = 1;
  public timeMode: TimeOfDayMode = 'auto';
  public weather: WeatherMode = 'clear';
  public lightningFlash = 0;

  // Live Statistics
  public livingCount = 0;
  public zombieCount = 0;
  public totalInfectedTurned = 0;
  public safehouseCount = 0;

  private fireAccum = 0;
  private alarmBeepAccum = 0;
  public onRadioBroadcast?: (msg: string, color?: string) => void;

  constructor(
    public world: CityWorld,
    public sfx: ZomboidAudio,
  ) {
    this.populateInitialOutbreak();
  }

  public get darknessLevel(): number {
    if (this.timeMode === 'day') return 0.0;
    if (this.timeMode === 'dusk') return 0.45;
    if (this.timeMode === 'night') return 0.82;

    const hr = (this.worldMinutes % 1440) / 60;
    if (hr >= 7 && hr < 17.5) return this.weather === 'storm' ? 0.25 : 0.0;
    if (hr >= 17.5 && hr < 20.5) return ((hr - 17.5) / 3.0) * 0.80;
    if (hr >= 4.5 && hr < 7.0) return (1 - (hr - 4.5) / 2.5) * 0.80;
    return 0.80;
  }

  public get formattedClock(): string {
    const mins = Math.floor(this.worldMinutes) % 1440;
    const hh = String(Math.floor(mins / 60)).padStart(2, '0');
    const mm = String(mins % 60).padStart(2, '0');
    return `День ${this.dayNumber} • ${hh}:${mm}`;
  }

  public populateInitialOutbreak(): void {
    this.count = 0;
    this.bulletCount = 0;
    this.partCount = 0;
    this.soundRings = [];
    this.heliActive = false;
    this.worldMinutes = 8 * 60 + 20;
    this.dayNumber = 1;
    this.totalInfectedTurned = 0;
    this.selectedUid = 0;
    this.targetCache.fill(-1);

    // 1. Spawn Survivors, Police, Doctors & Store Clerks inside town buildings!
    for (const b of this.world.buildings) {
      const cx = b.x0 + b.w * 0.5;
      const cy = b.y0 + b.h * 0.5;
      if (b.kind === 'police') {
        b.isSafehouse = true;
        for (let k = 0; k < 5; k++) {
          this.spawnUnit(cx + (Math.random() - 0.5) * 3, cy + (Math.random() - 0.5) * 3, ROLE_POLICE, b.id);
        }
      } else if (b.kind === 'military') {
        b.isSafehouse = true;
        for (let k = 0; k < 6; k++) {
          this.spawnUnit(b.x0 + 2 + Math.random() * 10, b.y0 + 2 + Math.random() * 3, ROLE_SOLDIER, b.id);
        }
      } else if (b.kind === 'hospital') {
        b.isSafehouse = true;
        for (let k = 0; k < 4; k++) {
          this.spawnUnit(cx + (Math.random() - 0.5) * 3, cy + (Math.random() - 0.5) * 3, ROLE_MEDIC, b.id);
        }
      } else if (b.kind === 'house') {
        const n = 1 + ((Math.random() * 3) | 0);
        if (Math.random() < 0.35) b.isSafehouse = true;
        for (let k = 0; k < n; k++) {
          this.spawnUnit(cx + (Math.random() - 0.5) * 3, cy + (Math.random() - 0.5) * 3, ROLE_CIVILIAN, b.id);
        }
      } else {
        for (let k = 0; k < 2; k++) {
          this.spawnUnit(cx + (Math.random() - 0.5) * 3, cy + (Math.random() - 0.5) * 3, ROLE_CIVILIAN, b.id);
        }
      }
    }

    // Spawn small Raider gang on industrial outskirts!
    for (let r = 0; r < 5; r++) {
      this.spawnUnit(MAP_W - 22 + Math.random() * 6, 18 + Math.random() * 6, ROLE_RAIDER, -1);
    }

    // 2. Spawn Initial Zombie Outbreak directly on city streets, intersections, parking lots & highway approaches!
    for (let z = 0; z < 190; z++) {
      let gx = 14 + Math.random() * (MAP_W - 28);
      let gy = 14 + Math.random() * (MAP_H - 28);
      if (z < 95 && this.world.roadXs.length > 0 && this.world.roadYs.length > 0) {
        if (z % 2 === 0) {
          gx = this.world.roadXs[z % this.world.roadXs.length] + (Math.random() - 0.5) * 6;
          gy = 18 + Math.random() * (MAP_H - 36);
        } else {
          gx = 18 + Math.random() * (MAP_W - 36);
          gy = this.world.roadYs[z % this.world.roadYs.length] + (Math.random() - 0.5) * 6;
        }
      } else {
        const edge = z % 4;
        if (edge === 0) gy = 10 + Math.random() * 18;
        else if (edge === 1) gx = 10 + Math.random() * 18;
        else if (edge === 2) gy = MAP_H - 28 + Math.random() * 14;
      }

      const cellIdx = Math.max(0, Math.min(MAP_H - 1, gy | 0)) * MAP_W + Math.max(0, Math.min(MAP_W - 1, gx | 0));
      if (this.world.buildingId[cellIdx] >= 0) continue;

      const roll = Math.random();
      const role =
        roll < 0.10 ? ROLE_ZOMBIE_SPRINTER : roll < 0.18 ? ROLE_ZOMBIE_ARMORED : ROLE_ZOMBIE_SHAMBLER;
      this.spawnUnit(gx, gy, role, -1);
    }

    this.recountPopulations();
  }

  public spawnUnit(wx: number, wy: number, role: number, homeBldg = -1): number {
    if (this.count >= MAX_UNITS) return -1;

    // Nudge to nearest walkable cell if spawned inside a solid wall
    let sx = Math.max(2, Math.min(MAP_W - 3, wx));
    let sy = Math.max(2, Math.min(MAP_H - 3, wy));
    if (!this.world.isWalkable(sx | 0, sy | 0)) {
      let found = false;
      for (let rad = 1; rad <= 5 && !found; rad++) {
        for (let dy = -rad; dy <= rad && !found; dy++) {
          for (let dx = -rad; dx <= rad && !found; dx++) {
            const tx = (sx | 0) + dx;
            const ty = (sy | 0) + dy;
            if (this.world.isWalkable(tx, ty)) {
              sx = tx + 0.5;
              sy = ty + 0.5;
              found = true;
            }
          }
        }
      }
    }

    const i = this.count++;
    this.ux[i] = sx;
    this.uy[i] = sy;
    this.uvx[i] = 0;
    this.uvy[i] = 0;
    this.uAngle[i] = Math.random() * Math.PI * 2;
    this.uRole[i] = role;
    this.uVariant[i] = (Math.random() * 255) | 0;
    this.uNameIdx[i] = (Math.random() * 65535) | 0;
    this.uUid[i] = this.nextUid++;
    this.uHomeBldg[i] = homeBldg;
    this.uKills[i] = 0;
    this.uInfection[i] = 0;
    this.uHunger[i] = Math.random() * 0.25;
    this.uFatigue[i] = Math.random() * 0.2;
    this.uPanic[i] = 0;
    this.uMoodles[i] = 0;
    this.uBurning[i] = 0;
    this.uCooldown[i] = Math.random() * 0.4;
    this.uGoalX[i] = sx;
    this.uGoalY[i] = sy;
    this.uGoalTimer[i] = Math.random() * 1.5;
    this.uWalkPhase[i] = Math.random() * 6.28;
    this.uTask[i] = 0;
    this.targetCache[i] = -1;

    if (role === ROLE_POLICE) {
      this.uMaxHp[i] = 125;
      this.uWeapon[i] = Math.random() < 0.45 ? WPN_SHOTGUN : WPN_PISTOL;
      this.uAmmo[i] = 42;
      this.uFood[i] = 2;
      this.uBandages[i] = 2;
      this.uPlanks[i] = 1;
    } else if (role === ROLE_SOLDIER) {
      this.uMaxHp[i] = 155;
      this.uWeapon[i] = WPN_RIFLE;
      this.uAmmo[i] = 90;
      this.uFood[i] = 3;
      this.uBandages[i] = 3;
      this.uPlanks[i] = 2;
    } else if (role === ROLE_MEDIC) {
      this.uMaxHp[i] = 105;
      this.uWeapon[i] = Math.random() < 0.5 ? WPN_PISTOL : WPN_BAT;
      this.uAmmo[i] = 24;
      this.uFood[i] = 3;
      this.uBandages[i] = 6;
      this.uPlanks[i] = 2;
    } else if (role === ROLE_RAIDER) {
      this.uMaxHp[i] = 120;
      this.uWeapon[i] = Math.random() < 0.4 ? WPN_SHOTGUN : Math.random() < 0.6 ? WPN_PISTOL : WPN_AXE;
      this.uAmmo[i] = 36;
      this.uFood[i] = 2;
      this.uBandages[i] = 1;
      this.uPlanks[i] = 0;
    } else if (role === ROLE_CIVILIAN) {
      this.uMaxHp[i] = 100;
      const r = Math.random();
      this.uWeapon[i] = r < 0.14 ? WPN_PISTOL : r < 0.42 ? WPN_BAT : r < 0.58 ? WPN_AXE : WPN_FISTS;
      this.uAmmo[i] = this.uWeapon[i] === WPN_PISTOL ? 16 : 0;
      this.uFood[i] = 1 + ((Math.random() * 2) | 0);
      this.uBandages[i] = 1 + ((Math.random() * 2) | 0);
      this.uPlanks[i] = 1 + ((Math.random() * 3) | 0);
    } else {
      // Zombie Archetypes
      this.uMaxHp[i] =
        role === ROLE_ZOMBIE_ARMORED
          ? 240
          : role === ROLE_ZOMBIE_SPRINTER
            ? 85
            : role === ROLE_ZOMBIE_CRAWLER
              ? 60
              : 105;
      this.uWeapon[i] = WPN_FISTS;
      this.uAmmo[i] = 0;
      this.uFood[i] = 0;
      this.uBandages[i] = 0;
      this.uPlanks[i] = 0;
    }
    this.uHp[i] = this.uMaxHp[i];
    return i;
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
    const i = this.partCount < MAX_PARTICLES ? this.partCount++ : (this.partCursor = (this.partCursor + 1) % MAX_PARTICLES);
    this.px[i] = x;
    this.py[i] = y;
    this.pz[i] = z;
    this.pvx[i] = vx;
    this.pvy[i] = vy;
    this.pvz[i] = vz;
    this.pKind[i] = kind;
    this.pLife[i] = life;
    this.pMaxLife[i] = life;
  }

  /**
   * Emits a true Project Zomboid Meta-Sound Wave that draws idle/wandering zombies across town!
   */
  public emitSound(x: number, y: number, radius: number, color = '#ffd166', label?: string): void {
    if (this.showSoundWaves && radius >= 10 && this.soundRings.length < 28) {
      this.soundRings.push({
        x,
        y,
        maxRadius: radius,
        age: 0,
        duration: Math.min(1.6, 0.55 + radius * 0.014),
        color,
        label,
      });
    }

    const r2 = radius * radius;
    for (let i = 0; i < this.count; i++) {
      if (!isZombieRole(this.uRole[i]) || this.uHp[i] <= 0) continue;
      if (this.uTask[i] === 3) continue; // Already locked onto visible prey
      const dx = x - this.ux[i];
      const dy = y - this.uy[i];
      if (dx * dx + dy * dy <= r2) {
        this.uGoalX[i] = x + (Math.random() - 0.5) * 5;
        this.uGoalY[i] = y + (Math.random() - 0.5) * 5;
        this.uGoalTimer[i] = 5.5 + Math.random() * 4;
        this.uTask[i] = 5;
      }
    }
  }

  public triggerExplosion(cx: number, cy: number, radius: number, incendiary = true): void {
    this.sfx.playExplosion(radius / 5);
    this.emitSound(cx, cy, 85, '#ff4d4f', 'ВЗРЫВ!');

    // Shockwave tile destruction + shattered windows for 2.2x radius!
    const winR = Math.ceil(radius * 2.4);
    for (let y = Math.floor(cy - winR); y <= Math.ceil(cy + winR); y++) {
      for (let x = Math.floor(cx - winR); x <= Math.ceil(cx + winR); x++) {
        if (!this.world.inBounds(x, y)) continue;
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        const idx = y * MAP_W + x;

        if (d <= radius * 0.85) {
          this.world.scorch[idx] = Math.min(1, this.world.scorch[idx] + 0.85);
          if (this.world.struct[idx] !== STRUCT_NONE && this.world.floor[idx] !== FLOOR_WATER) {
            const dmg = (1 - d / (radius + 0.5)) * 820;
            if (dmg >= this.world.structHp[idx]) {
              this.world.struct[idx] = Math.random() < 0.4 ? STRUCT_RUBBLE : STRUCT_NONE;
              this.world.barricade[idx] = 0;
            } else {
              this.world.structHp[idx] -= dmg;
            }
          }
          if (incendiary && this.world.floor[idx] !== FLOOR_WATER && Math.random() < 0.72) {
            this.world.fire[idx] = Math.max(this.world.fire[idx], 0.65 + Math.random() * 0.35);
          }
          // Chain-explode nearby Gas Pumps!
          if (this.world.prop[idx] === PROP_GAS_PUMP) {
            this.world.prop[idx] = PROP_NONE;
            this.world.fire[idx] = 1.0;
          }
        } else if (d <= winR && this.world.struct[idx] === STRUCT_WINDOW_INTACT) {
          this.shatterWindow(x, y);
        }
      }
    }

    // Blast damage, knockdown, leg-crippling crawlers & car chain damage!
    for (let i = 0; i < this.count; i++) {
      if (this.uHp[i] <= 0) continue;
      const dx = this.ux[i] - cx;
      const dy = this.uy[i] - cy;
      const dist = Math.hypot(dx, dy);
      if (dist > radius * 1.9) continue;

      const falloff = Math.max(0, 1 - dist / (radius * 1.9));
      const inv = dist > 0.05 ? 1 / dist : 1;
      this.uvx[i] += dx * inv * falloff * 14;
      this.uvy[i] += dy * inv * falloff * 14;
      this.uHp[i] -= falloff * 185;
      if (incendiary && falloff > 0.35) this.uBurning[i] = Math.max(this.uBurning[i], 6.0);

      // Blast blows zombies' legs off -> turns living shamblers into Crawlers!
      if (this.uHp[i] > 0 && isZombieRole(this.uRole[i]) && falloff > 0.32 && Math.random() < 0.55) {
        this.uRole[i] = ROLE_ZOMBIE_CRAWLER;
      }
      for (let b = 0; b < 4; b++) {
        this.spawnParticle(
          this.ux[i],
          this.uy[i],
          0.6,
          (Math.random() - 0.5) * 6,
          (Math.random() - 0.5) * 6,
          2 + Math.random() * 5,
          PART_BLOOD,
          0.9,
        );
      }
    }

    for (const v of this.world.vehicles) {
      if (v.exploded) continue;
      const d = Math.hypot(v.x - cx, v.y - cy);
      if (d < radius * 1.8) {
        v.hp -= (1 - d / (radius * 1.8)) * 220;
        if (v.hasAlarm && v.alarmTimer <= 0 && !v.exploded) {
          v.alarmTimer = 14;
        }
        if (v.hp <= 40) v.burning = true;
      }
    }

    for (let p = 0; p < 55; p++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 2 + Math.random() * 11;
      this.spawnParticle(
        cx,
        cy,
        0.4,
        Math.cos(ang) * spd,
        Math.sin(ang) * spd,
        3 + Math.random() * 9,
        p % 3 === 0 ? PART_SMOKE : p % 2 === 0 ? PART_FIRE : PART_SPARK,
        0.6 + Math.random() * 0.9,
      );
    }
  }

  public shatterWindow(gx: number, gy: number): void {
    const idx = gy * MAP_W + gx;
    if (this.world.struct[idx] !== STRUCT_WINDOW_INTACT) return;
    this.world.struct[idx] = STRUCT_WINDOW_BROKEN;
    this.sfx.playGlassShatter();
    this.emitSound(gx + 0.5, gy + 0.5, 22, '#a8dadc');
    for (let s = 0; s < 8; s++) {
      this.spawnParticle(
        gx + 0.5,
        gy + 0.5,
        0.9,
        (Math.random() - 0.5) * 5,
        (Math.random() - 0.5) * 5,
        1.5 + Math.random() * 3.5,
        PART_GLASS,
        1.1,
      );
    }
  }

  public applyDirectorTool(tool: SimToolId, wx: number, wy: number): void {
    const gx = Math.floor(wx);
    const gy = Math.floor(wy);
    if (!this.world.inBounds(gx, gy)) return;

    if (tool === 'inspect') {
      this.selectUnitNear(wx, wy, 3.0);
      return;
    }
    if (tool === 'spawn_shambler') {
      for (let k = 0; k < 5; k++) {
        this.spawnUnit(wx + (Math.random() - 0.5) * 2.5, wy + (Math.random() - 0.5) * 2.5, ROLE_ZOMBIE_SHAMBLER);
      }
      this.sfx.playZombieGroan();
    } else if (tool === 'spawn_sprinter') {
      for (let k = 0; k < 3; k++) {
        this.spawnUnit(wx + (Math.random() - 0.5) * 2.2, wy + (Math.random() - 0.5) * 2.2, ROLE_ZOMBIE_SPRINTER);
      }
      this.sfx.playZombieGroan();
    } else if (tool === 'spawn_armored_zed') {
      for (let k = 0; k < 3; k++) {
        this.spawnUnit(wx + (Math.random() - 0.5) * 2.2, wy + (Math.random() - 0.5) * 2.2, ROLE_ZOMBIE_ARMORED);
      }
      this.sfx.playZombieGroan();
    } else if (tool === 'horde_wave') {
      const edgeX = wx < MAP_W * 0.5 ? 6 : MAP_W - 8;
      for (let k = 0; k < 32; k++) {
        const u = this.spawnUnit(
          edgeX + (Math.random() - 0.5) * 6,
          Math.max(8, Math.min(MAP_H - 12, wy + (Math.random() - 0.5) * 22)),
          Math.random() < 0.16 ? ROLE_ZOMBIE_SPRINTER : ROLE_ZOMBIE_SHAMBLER,
        );
        if (u >= 0) {
          this.uGoalX[u] = wx + (Math.random() - 0.5) * 8;
          this.uGoalY[u] = wy + (Math.random() - 0.5) * 8;
          this.uGoalTimer[u] = 25;
          this.uTask[u] = 5;
        }
      }
      this.emitSound(wx, wy, 75, '#b5e48c', 'МЕГА-ОРДА!');
      this.onRadioBroadcast?.('📻 ЭКСТРЕННО: Огромная орда прорвала кордон и движется на город!', '#b5e48c');
    } else if (tool === 'virus_cloud') {
      let infectedNow = 0;
      for (let i = 0; i < this.count; i++) {
        if (!isZombieRole(this.uRole[i]) && Math.hypot(this.ux[i] - wx, this.uy[i] - wy) < 6.5) {
          this.uInfection[i] = Math.max(this.uInfection[i], 0.28);
          this.uMoodles[i] |= MOODLE_BITTEN;
          infectedNow++;
        }
      }
      for (let p = 0; p < 24; p++) {
        this.spawnParticle(wx + (Math.random() - 0.5) * 5, wy + (Math.random() - 0.5) * 5, 0.5, 0, 0, 1.4, PART_FLARE, 1.4);
      }
      this.onRadioBroadcast?.(
        `☣ Аэрозоль вируса «Нокс» распылён (заражено выживших: ${infectedNow})!`,
        '#80ed99',
      );
    } else if (tool === 'spawn_survivors') {
      const bId = this.world.buildingId[gy * MAP_W + gx];
      for (let k = 0; k < 4; k++) {
        this.spawnUnit(wx + (Math.random() - 0.5) * 2.2, wy + (Math.random() - 0.5) * 2.2, ROLE_CIVILIAN, bId);
      }
      this.sfx.playUiClick(640);
    } else if (tool === 'spawn_police') {
      const bId = this.world.buildingId[gy * MAP_W + gx];
      for (let k = 0; k < 3; k++) {
        this.spawnUnit(wx + (Math.random() - 0.5) * 2.2, wy + (Math.random() - 0.5) * 2.2, ROLE_POLICE, bId);
      }
      this.sfx.playUiClick(700);
    } else if (tool === 'spawn_soldiers') {
      const bId = this.world.buildingId[gy * MAP_W + gx];
      for (let k = 0; k < 4; k++) {
        this.spawnUnit(wx + (Math.random() - 0.5) * 2.2, wy + (Math.random() - 0.5) * 2.2, ROLE_SOLDIER, bId);
      }
      this.sfx.playUiClick(740);
    } else if (tool === 'spawn_medics') {
      const bId = this.world.buildingId[gy * MAP_W + gx];
      for (let k = 0; k < 3; k++) {
        this.spawnUnit(wx + (Math.random() - 0.5) * 2.0, wy + (Math.random() - 0.5) * 2.0, ROLE_MEDIC, bId);
      }
      this.sfx.playUiClick(680);
    } else if (tool === 'spawn_raiders') {
      for (let k = 0; k < 4; k++) {
        this.spawnUnit(wx + (Math.random() - 0.5) * 2.5, wy + (Math.random() - 0.5) * 2.5, ROLE_RAIDER, -1);
      }
      this.onRadioBroadcast?.('💀 На окраине замечена вооружённая банда мародёров!', '#ff6b6b');
    } else if (tool === 'helicopter') {
      this.heliActive = true;
      this.heliX = wx;
      this.heliY = wy;
      this.heliTimer = 26.0;
      this.emitSound(wx, wy, 95, '#ffd166', '🚁 ВЕРТОЛЁТ!');
      this.onRadioBroadcast?.(
        '🚁 СЛЫШЕН ГУЛ ВЕРТОЛЁТА! Прожектор кружит над кварталами — все зомби идут на звук!',
        '#ffd166',
      );
    } else if (tool === 'sound_lure') {
      this.sfx.playAlarmBeep(true);
      this.emitSound(wx, wy, 72, '#ff9f1c', '🚨 СИРЕНА!');
      // Also trigger any car alarm near cursor!
      for (const v of this.world.vehicles) {
        if (!v.exploded && Math.hypot(v.x - wx, v.y - wy) < 6) {
          v.alarmTimer = 16;
          v.sirenOn = true;
        }
      }
    } else if (tool === 'molotov') {
      this.sfx.playGlassShatter();
      for (let y = gy - 2; y <= gy + 2; y++) {
        for (let x = gx - 2; x <= gx + 2; x++) {
          if (this.world.inBounds(x, y) && Math.hypot(x - gx, y - gy) <= 2.3) {
            const idx = y * MAP_W + x;
            if (this.world.floor[idx] !== FLOOR_WATER) {
              this.world.fire[idx] = 0.9 + Math.random() * 0.1;
              this.world.fuel[idx] = Math.max(this.world.fuel[idx], 0.8);
            }
          }
        }
      }
      this.emitSound(wx, wy, 20, '#ff5400');
    } else if (tool === 'propane_bomb') {
      this.triggerExplosion(wx, wy, 4.8, true);
    } else if (tool === 'airdrop') {
      const idx = gy * MAP_W + gx;
      this.world.prop[idx] = PROP_AIRDROP;
      this.world.loot[idx] = 12;
      this.emitSound(wx, wy, 35, '#8ac926', '📦 ГРУЗ');
      for (let p = 0; p < 22; p++) {
        this.spawnParticle(wx, wy, 0.4, (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5, 2.5 + Math.random() * 2, PART_FLARE, 2.4);
      }
      // Attract nearby survivors to claim the airdrop!
      for (let i = 0; i < this.count; i++) {
        if (!isZombieRole(this.uRole[i]) && Math.hypot(this.ux[i] - wx, this.uy[i] - wy) < 34) {
          this.uGoalX[i] = wx;
          this.uGoalY[i] = wy;
          this.uGoalTimer[i] = 10;
          this.uTask[i] = 1;
        }
      }
      this.onRadioBroadcast?.('📦 Сброшен военный контейнер с оружием, патронами и медикаментами!', '#8ac926');
    } else if (tool === 'barricade') {
      this.sfx.playWoodImpact(true);
      let boarded = 0;
      for (let y = gy - 3; y <= gy + 3; y++) {
        for (let x = gx - 3; x <= gx + 3; x++) {
          if (!this.world.inBounds(x, y)) continue;
          const idx = y * MAP_W + x;
          if (this.world.struct[idx] === STRUCT_WINDOW_INTACT || this.world.struct[idx] === STRUCT_WINDOW_BROKEN) {
            this.world.struct[idx] = STRUCT_WINDOW_BROKEN;
            this.world.barricade[idx] = 4;
            boarded++;
          }
        }
      }
      if (boarded === 0 && this.world.struct[gy * MAP_W + gx] === STRUCT_NONE) {
        for (let dx = -1; dx <= 1; dx++) {
          if (this.world.inBounds(gx + dx, gy) && this.world.struct[gy * MAP_W + gx + dx] === STRUCT_NONE) {
            this.world.struct[gy * MAP_W + gx + dx] = STRUCT_SANDBAG;
            this.world.structHp[gy * MAP_W + gx + dx] = 220;
          }
        }
      }
    } else if (tool === 'spawn_car') {
      this.world.vehicles.push({
        id: this.world.vehicles.length + 1,
        kind: Math.random() < 0.28 ? 'police' : Math.random() < 0.3 ? 'pickup' : 'sedan',
        color: '#3a5a78',
        x: wx,
        y: wy,
        vx: 0,
        vy: 0,
        axis: Math.random() < 0.5 ? 0 : 1,
        hp: 280,
        maxHp: 280,
        hasAlarm: true,
        alarmTimer: 0,
        sirenOn: false,
        headlightsOn: true,
        burning: false,
        exploded: false,
      });
      this.sfx.playUiClick(520);
    }
  }

  public selectUnitNear(wx: number, wy: number, radius = 3.2): boolean {
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
    if (this.selectedUid > 0) {
      for (let i = 0; i < this.count; i++) {
        if (this.uUid[i] === this.selectedUid && this.uHp[i] > 0) {
          idx = i;
          break;
        }
      }
      if (idx < 0) this.selectedUid = 0;
    }
    if (idx < 0) {
      let bestD2 = 1.6 * 1.6;
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
    const nSeed = this.uNameIdx[idx];
    const fullName = `${FIRST_NAMES[nSeed % FIRST_NAMES.length]} ${LAST_NAMES[(nSeed >> 5) % LAST_NAMES.length]}`;

    const roleNames: Record<number, string> = {
      [ROLE_CIVILIAN]: 'Гражданский выживший',
      [ROLE_POLICE]: 'Офицер полиции округа Нокс',
      [ROLE_SOLDIER]: 'Боец спецназа КЗО',
      [ROLE_MEDIC]: 'Врач скорой помощи',
      [ROLE_RAIDER]: 'Вооружённый мародёр',
      [ROLE_ZOMBIE_SHAMBLER]: 'Зомби-шатун (Ходячий)',
      [ROLE_ZOMBIE_SPRINTER]: 'Зомби-бегун (Спринтер!)',
      [ROLE_ZOMBIE_ARMORED]: 'Бронированный зомби КЗО',
      [ROLE_ZOMBIE_CRAWLER]: 'Ползучий мертвец',
    };

    const tasks: Record<number, string> = {
      0: zed ? 'Бродит по улицам в поисках добычи' : 'Охраняет периметр убежища',
      1: 'Ищет припасы, оружие и еду в зданиях',
      2: 'Заколачивает окна убежища досками',
      3: zed ? 'Рвётся к живой плоти!' : 'Ведёт прицельный огонь / бой!',
      4: 'В панике отступает от орды!',
      5: 'Идёт на источник громкого звука!',
    };

    const moodles: { label: string; color: string }[] = [];
    const m = this.uMoodles[idx];
    if (this.uBurning[idx] > 0) moodles.push({ label: '🔥 ГОРИТ В ОГНЕ!', color: '#ff5400' });
    if (m & MOODLE_BITTEN) moodles.push({ label: '☣ УКУШЕН (Вирус Нокс)', color: '#80ed99' });
    if (m & MOODLE_BLEEDING) moodles.push({ label: '🩸 Кровотечение', color: '#e63946' });
    if (m & MOODLE_PANIC) moodles.push({ label: '😱 Сильная паника', color: '#ffd166' });
    if (m & MOODLE_HUNGRY) moodles.push({ label: '🍖 Голоден (ищет еду)', color: '#f4a261' });
    if (m & MOODLE_TIRED) moodles.push({ label: '💤 Истощение', color: '#90e0ef' });

    const hb = this.uHomeBldg[idx];
    const homeName = hb >= 0 && hb < this.world.buildings.length ? this.world.buildings[hb].name : null;

    return {
      uid: this.uUid[idx],
      name: fullName,
      roleName: roleNames[role] || 'Неизвестный',
      isZombie: zed,
      hp: Math.ceil(this.uHp[idx]),
      maxHp: Math.ceil(this.uMaxHp[idx]),
      weaponName: zed ? 'Зубы и когти' : WEAPONS[this.uWeapon[idx]].name,
      ammo: this.uAmmo[idx],
      food: this.uFood[idx],
      bandages: this.uBandages[idx],
      planks: this.uPlanks[idx],
      kills: this.uKills[idx],
      taskText: tasks[this.uTask[idx]] || 'Выживает',
      infectionPct: Math.min(100, Math.round(this.uInfection[idx] * 100)),
      moodles,
      safehouseName: homeName,
    };
  }

  public step(dt: number): void {
    this.aiTick = (this.aiTick + 1) & 3;

    // 1. Advance Project Zomboid Clock & Dynamic Weather
    this.worldMinutes += dt * 16; // 1 real second = 16 in-game minutes
    if (this.worldMinutes >= 1440) {
      this.worldMinutes -= 1440;
      this.dayNumber++;
      this.onRadioBroadcast?.(
        `📅 Наступил День ${this.dayNumber} карантина в округе ${this.world.townName}. Живых: ${this.livingCount}, Зомби: ${this.zombieCount}`,
        '#e9c46a',
      );
    }

    if (this.lightningFlash > 0) this.lightningFlash = Math.max(0, this.lightningFlash - dt * 2.8);
    if (this.weather === 'storm' && Math.random() < dt * 0.22) {
      this.lightningFlash = 0.85;
      this.sfx.playExplosion(0.35);
    }

    // 2. Update Meta-Sound Waves & Helicopter Event
    for (let i = this.soundRings.length - 1; i >= 0; i--) {
      this.soundRings[i].age += dt;
      if (this.soundRings[i].age >= this.soundRings[i].duration) {
        this.soundRings.splice(i, 1);
      }
    }

    if (this.heliActive) {
      this.heliTimer -= dt;
      this.heliX = Math.max(18, Math.min(MAP_W - 18, this.heliX + Math.cos(this.heliTimer * 0.65) * 7.5 * dt));
      this.heliY = Math.max(18, Math.min(MAP_H - 18, this.heliY + Math.sin(this.heliTimer * 0.52) * 7.5 * dt));
      this.heliPingAccum += dt;
      if (this.heliPingAccum >= 0.85) {
        this.heliPingAccum = 0;
        this.sfx.playWoodImpact(false);
        this.emitSound(this.heliX, this.heliY, 92, '#ffd166');
      }
      if (this.heliTimer <= 0) {
        this.heliActive = false;
        this.onRadioBroadcast?.('🚁 Вертолёт СМИ улетел за пределы округа, оставив за собой толпы мертвецов.', '#adb5bd');
      }
    }

    // 3. Vehicle Alarms, Sirens & Car Fire Explosions!
    this.alarmBeepAccum += dt;
    const doBeep = this.alarmBeepAccum >= 0.45;
    if (doBeep) this.alarmBeepAccum = 0;

    for (const v of this.world.vehicles) {
      if (v.exploded) continue;
      if (v.alarmTimer > 0) {
        v.alarmTimer -= dt;
        v.headlightsOn = Math.floor(v.alarmTimer * 5) % 2 === 0;
        if (doBeep) {
          this.sfx.playAlarmBeep(Math.floor(v.alarmTimer * 2) % 2 === 0);
          this.emitSound(v.x, v.y, 64, '#ff9f1c');
        }
      } else if (v.sirenOn && doBeep) {
        this.emitSound(v.x, v.y, 55, '#4cc9f0');
      }

      if (v.burning) {
        v.hp -= dt * 36;
        if (Math.random() < 0.45) {
          this.spawnParticle(v.x + (Math.random() - 0.5), v.y + (Math.random() - 0.5), 0.7, 0, 0, 2.6, PART_FIRE, 0.55);
          this.spawnParticle(v.x, v.y, 1.1, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, 2.2, PART_SMOKE, 1.2);
        }
        if (v.hp <= 0) {
          v.exploded = true;
          v.burning = false;
          v.sirenOn = false;
          v.alarmTimer = 0;
          this.triggerExplosion(v.x, v.y, 4.2, true);
        }
      }
    }

    // 4. Fire Spread & Rain Extinguishing
    this.fireAccum += dt;
    if (this.fireAccum >= 0.25) {
      const fdt = this.fireAccum;
      this.fireAccum = 0;
      const rainDamp = this.weather === 'rain' || this.weather === 'storm' ? 0.55 : 0;

      for (let y = 1; y < MAP_H - 1; y++) {
        for (let x = 1; x < MAP_W - 1; x++) {
          const idx = y * MAP_W + x;
          const f = this.world.fire[idx];
          if (f <= 0.01) continue;

          if (Math.random() < 0.35) {
            this.spawnParticle(x + Math.random(), y + Math.random(), 0.2, 0, 0, 2.2 + Math.random() * 1.5, PART_FIRE, 0.45);
            if (Math.random() < 0.4) {
              this.spawnParticle(x + 0.5, y + 0.5, 0.8, 0.2, -0.1, 2.0, PART_SMOKE, 1.1);
            }
          }

          // Explode gas pump if touched by fire!
          if (this.world.prop[idx] === PROP_GAS_PUMP) {
            this.world.prop[idx] = PROP_NONE;
            this.triggerExplosion(x + 0.5, y + 0.5, 5.5, true);
            continue;
          }

          // Spread to neighbors with fuel
          if (f > 0.35 && Math.random() < fdt * 0.85) {
            const nx = x + (((Math.random() * 3) | 0) - 1);
            const ny = y + (((Math.random() * 3) | 0) - 1);
            const nIdx = ny * MAP_W + nx;
            if (this.world.fuel[nIdx] > 0.1 && this.world.fire[nIdx] < 0.2) {
              this.world.fire[nIdx] = 0.45;
            }
          }

          const outdoor = this.world.buildingId[idx] < 0;
          this.world.fuel[idx] = Math.max(0, this.world.fuel[idx] - fdt * 0.07);
          this.world.scorch[idx] = Math.min(1, this.world.scorch[idx] + fdt * 0.12);
          if (this.world.fuel[idx] <= 0.02) {
            if (this.world.struct[idx] !== STRUCT_NONE) {
              this.world.struct[idx] = STRUCT_RUBBLE;
              this.world.barricade[idx] = 0;
            }
            this.world.fire[idx] = Math.max(0, f - fdt * 0.8);
          } else if (outdoor && rainDamp > 0) {
            this.world.fire[idx] = Math.max(0, f - fdt * rainDamp);
          }
        }
      }
    }

    // 5. Update Ballistic Bullets & 3D Physics Particles
    this.updateBullets(dt);
    this.updateParticles(dt);

    // 6. Rebuild Spatial Grid & Step All Autonomous Survivors + Zombies
    this.rebuildSpatialGrid();
    this.updateUnits(dt);
  }

  private rebuildSpatialGrid(): void {
    this.gridHead.fill(-1);
    for (let i = 0; i < this.count; i++) {
      if (this.uHp[i] <= 0) continue;
      const cx = Math.max(0, Math.min(ZomboidSimulation.GRID_W - 1, (this.ux[i] * 0.25) | 0));
      const cy = Math.max(0, Math.min(ZomboidSimulation.GRID_W - 1, (this.uy[i] * 0.25) | 0));
      const cell = cy * ZomboidSimulation.GRID_W + cx;
      this.gridNext[i] = this.gridHead[cell];
      this.gridHead[cell] = i;
    }
  }

  private isHostile(roleA: number, roleB: number): boolean {
    const zA = isZombieRole(roleA);
    const zB = isZombieRole(roleB);
    if (zA !== zB) return true;
    if (zA) return false;
    return (roleA === ROLE_RAIDER) !== (roleB === ROLE_RAIDER);
  }

  private findNearestHostile(i: number, maxRange: number): number {
    const myRole = this.uRole[i];
    const x = this.ux[i];
    const y = this.uy[i];
    let best = -1;
    let bestD2 = maxRange * maxRange;

    const cx0 = Math.max(0, ((x - maxRange) * 0.25) | 0);
    const cx1 = Math.min(ZomboidSimulation.GRID_W - 1, ((x + maxRange) * 0.25) | 0);
    const cy0 = Math.max(0, ((y - maxRange) * 0.25) | 0);
    const cy1 = Math.min(ZomboidSimulation.GRID_W - 1, ((y + maxRange) * 0.25) | 0);

    for (let cy = cy0; cy <= cy1; cy++) {
      const row = cy * ZomboidSimulation.GRID_W;
      for (let cx = cx0; cx <= cx1; cx++) {
        let j = this.gridHead[row + cx];
        while (j >= 0) {
          if (j !== i && this.uHp[j] > 0 && this.isHostile(myRole, this.uRole[j])) {
            const dx = this.ux[j] - x;
            const dy = this.uy[j] - y;
            const d2 = dx * dx + dy * dy;
            if (d2 < bestD2) {
              bestD2 = d2;
              best = j;
            }
          }
          j = this.gridNext[j];
        }
      }
    }
    return best;
  }

  private hasClearShot(x0: number, y0: number, x1: number, y1: number): boolean {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const steps = Math.max(2, Math.ceil(Math.hypot(dx, dy) * 2));
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      if (this.world.blocksBullets(Math.floor(x0 + dx * t), Math.floor(y0 + dy * t))) {
        return false;
      }
    }
    return true;
  }

  private fireWeapon(shooterIdx: number, targetX: number, targetY: number): void {
    const wpn = WEAPONS[this.uWeapon[shooterIdx]];
    const sx = this.ux[shooterIdx];
    const sy = this.uy[shooterIdx];
    const baseAng = Math.atan2(targetY - sy, targetX - sx);
    const panicJitter = this.uPanic[shooterIdx] * 0.14;

    this.sfx.playGunshot(wpn.id === WPN_SHOTGUN ? 'shotgun' : wpn.id === WPN_RIFLE ? 'rifle' : 'pistol');
    this.emitSound(sx, sy, wpn.noiseRadius, '#ffd166');

    // Eject spinning brass shell casing with 3D bounce physics!
    const perp = baseAng + Math.PI * 0.5;
    this.spawnParticle(
      sx,
      sy,
      0.85,
      Math.cos(perp) * (1.8 + Math.random()),
      Math.sin(perp) * (1.8 + Math.random()),
      2.4 + Math.random() * 1.4,
      PART_SHELL,
      1.6,
    );
    // Muzzle spark
    this.spawnParticle(sx + Math.cos(baseAng) * 0.55, sy + Math.sin(baseAng) * 0.55, 0.85, 0, 0, 0, PART_SPARK, 0.08);

    const isRaider = this.uRole[shooterIdx] === ROLE_RAIDER ? 1 : 0;
    for (let p = 0; p < wpn.pellets; p++) {
      if (this.bulletCount >= MAX_BULLETS) break;
      const b = this.bulletCount++;
      const ang = baseAng + (Math.random() - 0.5) * (wpn.spread + panicJitter);
      const speed = 34.0;
      this.bx[b] = sx + Math.cos(ang) * 0.42;
      this.by[b] = sy + Math.sin(ang) * 0.42;
      this.bvx[b] = Math.cos(ang) * speed;
      this.bvy[b] = Math.sin(ang) * speed;
      this.bLife[b] = wpn.range / speed;
      this.bDmg[b] = wpn.damage;
      this.bKnock[b] = wpn.knockback;
      this.bRaider[b] = isRaider;
      this.bOwner[b] = this.uUid[shooterIdx];
    }
  }

  private updateBullets(dt: number): void {
    let write = 0;
    for (let b = 0; b < this.bulletCount; b++) {
      let life = this.bLife[b] - dt;
      if (life <= 0) continue;

      const x0 = this.bx[b];
      const y0 = this.by[b];
      const nx = x0 + this.bvx[b] * dt;
      const ny = y0 + this.bvy[b] * dt;
      const gx = Math.floor(nx);
      const gy = Math.floor(ny);

      if (!this.world.inBounds(gx, gy)) continue;
      const tIdx = gy * MAP_W + gx;

      // Bullet shatters intact glass windows in flight!
      if (this.world.struct[tIdx] === STRUCT_WINDOW_INTACT) {
        this.shatterWindow(gx, gy);
      }

      // Bullet hits gas pump -> massive explosion!
      if (this.world.prop[tIdx] === PROP_GAS_PUMP) {
        this.world.prop[tIdx] = PROP_NONE;
        this.triggerExplosion(gx + 0.5, gy + 0.5, 5.5, true);
        continue;
      }

      // Bullet hits solid brick/concrete/wood wall
      if (this.world.blocksBullets(gx, gy)) {
        this.spawnParticle(nx, ny, 0.85, -this.bvx[b] * 0.08, -this.bvy[b] * 0.08, 1.5, PART_SPARK, 0.16);
        continue;
      }

      // Check vehicle impact (sets off car alarms & damages engine!)
      let hitCar = false;
      for (const v of this.world.vehicles) {
        if (Math.abs(v.x - nx) < 1.15 && Math.abs(v.y - ny) < 1.15) {
          hitCar = true;
          this.spawnParticle(nx, ny, 0.7, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, 2, PART_SPARK, 0.22);
          if (!v.exploded) {
            v.hp -= this.bDmg[b] * 0.45;
            if (v.hasAlarm && v.alarmTimer <= 0) v.alarmTimer = 15;
            if (v.hp < 55) v.burning = true;
          }
          break;
        }
      }
      if (hitCar) continue;

      // Check unit hit using spatial grid!
      const cx = Math.max(0, Math.min(ZomboidSimulation.GRID_W - 1, (nx * 0.25) | 0));
      const cy = Math.max(0, Math.min(ZomboidSimulation.GRID_W - 1, (ny * 0.25) | 0));
      let hitUnit = -1;
      let j = this.gridHead[cy * ZomboidSimulation.GRID_W + cx];
      while (j >= 0) {
        if (this.uHp[j] > 0 && this.uUid[j] !== this.bOwner[b]) {
          const zed = isZombieRole(this.uRole[j]);
          const validTarget = zed || (this.bRaider[b] === 1) !== (this.uRole[j] === ROLE_RAIDER);
          if (validTarget) {
            const d2 = (this.ux[j] - nx) ** 2 + (this.uy[j] - ny) ** 2;
            if (d2 < 0.52 * 0.52) {
              hitUnit = j;
              break;
            }
          }
        }
        j = this.gridNext[j];
      }

      if (hitUnit >= 0) {
        const armorMult = this.uRole[hitUnit] === ROLE_ZOMBIE_ARMORED ? 0.42 : 1.0;
        this.uHp[hitUnit] -= this.bDmg[b] * armorMult;
        const spd = Math.hypot(this.bvx[b], this.bvy[b]) || 1;
        this.uvx[hitUnit] += (this.bvx[b] / spd) * this.bKnock[b];
        this.uvy[hitUnit] += (this.bvy[b] / spd) * this.bKnock[b];

        // Leg shot cripples zombie into a Crawler!
        if (
          this.uHp[hitUnit] > 0 &&
          this.uRole[hitUnit] === ROLE_ZOMBIE_SHAMBLER &&
          Math.random() < 0.14
        ) {
          this.uRole[hitUnit] = ROLE_ZOMBIE_CRAWLER;
        }

        if (!isZombieRole(this.uRole[hitUnit]) && Math.random() < 0.45) {
          this.uMoodles[hitUnit] |= MOODLE_BLEEDING;
        }

        // Credit kill
        if (this.uHp[hitUnit] <= 0) {
          for (let k = 0; k < this.count; k++) {
            if (this.uUid[k] === this.bOwner[b]) {
              this.uKills[k]++;
              break;
            }
          }
        }

        for (let s = 0; s < 4; s++) {
          this.spawnParticle(
            nx,
            ny,
            0.75,
            (this.bvx[b] / spd) * (1.5 + Math.random() * 2.5) + (Math.random() - 0.5) * 2,
            (this.bvy[b] / spd) * (1.5 + Math.random() * 2.5) + (Math.random() - 0.5) * 2,
            1.2 + Math.random() * 2.2,
            PART_BLOOD,
            0.75,
          );
        }
        continue;
      }

      this.bx[write] = nx;
      this.by[write] = ny;
      this.bvx[write] = this.bvx[b];
      this.bvy[write] = this.bvy[b];
      this.bLife[write] = life;
      this.bDmg[write] = this.bDmg[b];
      this.bKnock[write] = this.bKnock[b];
      this.bRaider[write] = this.bRaider[b];
      this.bOwner[write] = this.bOwner[b];
      write++;
    }
    this.bulletCount = write;
  }

  private updateParticles(dt: number): void {
    let write = 0;
    for (let i = 0; i < this.partCount; i++) {
      const life = this.pLife[i] - dt;
      if (life <= 0) continue;

      const kind = this.pKind[i];
      let x = this.px[i] + this.pvx[i] * dt;
      let y = this.py[i] + this.pvy[i] * dt;
      let z = this.pz[i] + this.pvz[i] * dt;
      let vx = this.pvx[i];
      let vy = this.pvy[i];
      let vz = this.pvz[i];

      if (kind === PART_SMOKE || kind === PART_FLARE || kind === PART_FIRE) {
        vx *= 0.96;
        vy *= 0.96;
      } else {
        vz -= 12.5 * dt;
        if (z <= 0) {
          z = 0;
          if (kind === PART_BLOOD) {
            const gx = Math.floor(x);
            const gy = Math.floor(y);
            if (this.world.inBounds(gx, gy)) {
              const idx = gy * MAP_W + gx;
              this.world.blood[idx] = Math.min(1, this.world.blood[idx] + 0.32);
            }
            continue;
          }
          // Shell casings & glass shards bounce on asphalt!
          vz = -vz * 0.42;
          vx *= 0.6;
          vy *= 0.6;
        }
      }

      this.px[write] = x;
      this.py[write] = y;
      this.pz[write] = z;
      this.pvx[write] = vx;
      this.pvy[write] = vy;
      this.pvz[write] = vz;
      this.pKind[write] = kind;
      this.pLife[write] = life;
      this.pMaxLife[write] = this.pMaxLife[i];
      write++;
    }
    this.partCount = write;
  }

  private updateUnits(dt: number): void {
    for (const b of this.world.buildings) {
      b.survivorsInside = 0;
      b.zombiesInside = 0;
    }

    for (let i = 0; i < this.count; i++) {
      if (this.uHp[i] <= 0) continue;

      let x = this.ux[i];
      let y = this.uy[i];
      const role = this.uRole[i];
      const zed = isZombieRole(role);
      const gx = Math.max(0, Math.min(MAP_W - 1, x | 0));
      const gy = Math.max(0, Math.min(MAP_H - 1, y | 0));
      const tIdx = gy * MAP_W + gx;

      // Track interior occupancy for automatic roof cutaway & stats!
      const bId = this.world.buildingId[tIdx];
      if (bId >= 0 && bId < this.world.buildings.length) {
        if (zed) this.world.buildings[bId].zombiesInside++;
        else this.world.buildings[bId].survivorsInside++;
      }

      // Standing on fire ignites unit!
      if (this.world.fire[tIdx] > 0.25) {
        this.uBurning[i] = Math.max(this.uBurning[i], 4.5);
      }
      if (this.uBurning[i] > 0) {
        this.uBurning[i] -= dt;
        this.uHp[i] -= dt * 19;
        if (Math.random() < 0.3) {
          this.spawnParticle(x, y, 0.8, 0, 0, 2.2, PART_FIRE, 0.35);
          // Burning zombie ignites wood floor/grass under its feet!
          if (this.world.fuel[tIdx] > 0.2 && this.world.fire[tIdx] < 0.3 && Math.random() < 0.25) {
            this.world.fire[tIdx] = 0.5;
          }
        }
      }

      // Crawler leaves trailing bloody smear!
      if (role === ROLE_ZOMBIE_CRAWLER && Math.random() < 0.12) {
        this.world.blood[tIdx] = Math.min(1, this.world.blood[tIdx] + 0.12);
      }

      // Survivor Moodles, Bleeding, Medics & Knox Infection Turning!
      if (!zed) {
        this.uHunger[i] = Math.min(1, this.uHunger[i] + dt * 0.008);
        this.uFatigue[i] = Math.min(1, this.uFatigue[i] + dt * 0.005);

        if (this.uHunger[i] > 0.65 && this.uFood[i] > 0) {
          this.uFood[i]--;
          this.uHunger[i] = 0.05;
          this.uHp[i] = Math.min(this.uMaxHp[i], this.uHp[i] + 18);
        }

        if (this.uMoodles[i] & MOODLE_BLEEDING) {
          this.uHp[i] -= dt * 3.2;
          if (Math.random() < 0.08) this.world.blood[tIdx] = Math.min(1, this.world.blood[tIdx] + 0.2);
          if (this.uBandages[i] > 0 && this.uCooldown[i] <= 0) {
            this.uBandages[i]--;
            this.uMoodles[i] &= ~MOODLE_BLEEDING;
            this.uHp[i] = Math.min(this.uMaxHp[i], this.uHp[i] + 15);
          }
        }

        // Knox Virus Incubation -> Turns Survivor into a Zombie RIGHT WHERE THEY STAND!
        if (this.uInfection[i] > 0) {
          this.uInfection[i] += dt * 0.038;
          this.uMoodles[i] |= MOODLE_BITTEN;
          if (this.uInfection[i] >= 1.0) {
            this.turnUnitIntoZombie(i);
            continue;
          }
        }

        // Sync Moodle Bitflags
        if (this.uHunger[i] > 0.6) this.uMoodles[i] |= MOODLE_HUNGRY;
        else this.uMoodles[i] &= ~MOODLE_HUNGRY;
        if (this.uFatigue[i] > 0.7) this.uMoodles[i] |= MOODLE_TIRED;
        else this.uMoodles[i] &= ~MOODLE_TIRED;
        if (this.uPanic[i] > 0.35) this.uMoodles[i] |= MOODLE_PANIC;
        else this.uMoodles[i] &= ~MOODLE_PANIC;
        this.uPanic[i] = Math.max(0, this.uPanic[i] - dt * 0.18);
      }

      if (this.uHp[i] <= 0) {
        if (!zed && this.uInfection[i] > 0) {
          this.turnUnitIntoZombie(i);
        }
        continue;
      }

      if (this.uCooldown[i] > 0) this.uCooldown[i] -= dt;
      this.uGoalTimer[i] -= dt;

      // ── AI TARGET SCANNING ──
      const sightRange = zed ? (this.darknessLevel > 0.5 ? 11.5 : 16.5) : 18.0;
      let enemy = this.targetCache[i];
      if (
        (i & 3) === this.aiTick ||
        enemy < 0 ||
        enemy >= this.count ||
        this.uHp[enemy] <= 0 ||
        !this.isHostile(role, this.uRole[enemy])
      ) {
        enemy = this.findNearestHostile(i, sightRange);
        this.targetCache[i] = enemy;
      }

      let moveX = 0;
      let moveY = 0;
      let speed = zed
        ? role === ROLE_ZOMBIE_SPRINTER
          ? 4.75
          : role === ROLE_ZOMBIE_CRAWLER
            ? 1.05
            : 1.85
        : role === ROLE_SOLDIER || role === ROLE_POLICE
          ? 3.65
          : 3.35;

      if (!zed && this.uFatigue[i] > 0.75) speed *= 0.82;

      if (zed) {
        // ══ ZOMBIE AI ══
        if (enemy >= 0) {
          const dx = this.ux[enemy] - x;
          const dy = this.uy[enemy] - y;
          const dist = Math.hypot(dx, dy) || 0.001;
          this.uTask[i] = 3;
          moveX = dx / dist;
          moveY = dy / dist;
          speed *= role === ROLE_ZOMBIE_SHAMBLER ? 1.32 : 1.08;

          // Zombie Bite & Drag-Down Attack!
          if (dist < 1.15 && this.uCooldown[i] <= 0) {
            this.uCooldown[i] = 0.85;
            this.sfx.playZombieGroan();
            this.uHp[enemy] -= role === ROLE_ZOMBIE_SPRINTER ? 22 : 16;
            this.uMoodles[enemy] |= MOODLE_BLEEDING;
            this.uPanic[enemy] = Math.min(1, this.uPanic[enemy] + 0.45);
            // 38% chance of lethal Knox Bite / Laceration infection!
            if (Math.random() < 0.38) {
              this.uInfection[enemy] = Math.max(this.uInfection[enemy], 0.12);
              this.uMoodles[enemy] |= MOODLE_BITTEN;
            }
            for (let s = 0; s < 3; s++) {
              this.spawnParticle(this.ux[enemy], this.uy[enemy], 0.8, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, 2, PART_BLOOD, 0.7);
            }
            if (this.uHp[enemy] <= 0) {
              this.turnUnitIntoZombie(enemy);
            }
          }
        } else {
          // Follow Meta-Sound target OR shamble slowly down streets!
          const dx = this.uGoalX[i] - x;
          const dy = this.uGoalY[i] - y;
          const dist = Math.hypot(dx, dy);
          if (dist < 1.5 || this.uGoalTimer[i] <= 0) {
            this.uTask[i] = 0;
            this.uGoalX[i] = Math.max(4, Math.min(MAP_W - 5, x + (Math.random() - 0.5) * 18));
            this.uGoalY[i] = Math.max(4, Math.min(MAP_H - 5, y + (Math.random() - 0.5) * 18));
            this.uGoalTimer[i] = 4 + Math.random() * 6;
            speed *= 0.55;
          } else {
            moveX = dx / dist;
            moveY = dy / dist;
            if (this.uTask[i] !== 5) speed *= 0.6;
          }
        }
      } else {
        // ══ SURVIVOR AI (Combat, Kiting, Medic Healing, Scavenging & Window Barricading!) ══
        // Medic heals nearby injured teammate first!
        if (role === ROLE_MEDIC && this.uCooldown[i] <= 0) {
          for (let k = 0; k < this.count; k++) {
            if (k !== i && !isZombieRole(this.uRole[k]) && this.uHp[k] > 0 && this.uHp[k] < this.uMaxHp[k] * 0.75) {
              if (Math.hypot(this.ux[k] - x, this.uy[k] - y) < 2.5) {
                this.uHp[k] = Math.min(this.uMaxHp[k], this.uHp[k] + 35);
                this.uMoodles[k] &= ~MOODLE_BLEEDING;
                this.uCooldown[i] = 1.1;
                break;
              }
            }
          }
        }

        // Fall back to melee weapon if firearm ran out of ammo!
        let wpnId = this.uWeapon[i];
        if (WEAPONS[wpnId].isGun && this.uAmmo[i] <= 0) {
          wpnId = (this.uVariant[i] & 1) === 0 ? WPN_BAT : WPN_FISTS;
        }
        const wpn = WEAPONS[wpnId];

        if (enemy >= 0) {
          const dx = this.ux[enemy] - x;
          const dy = this.uy[enemy] - y;
          const dist = Math.hypot(dx, dy) || 0.001;
          this.uAngle[i] = Math.atan2(dy, dx);

          if (dist < 4.5 && isZombieRole(this.uRole[enemy])) {
            this.uPanic[i] = Math.min(1, this.uPanic[i] + dt * 0.25);
          }

          if (wpn.isGun && this.uAmmo[i] > 0) {
            this.uTask[i] = 3;
            const clear = dist <= wpn.range && this.hasClearShot(x, y, this.ux[enemy], this.uy[enemy]);
            // Kite backward if zombie gets too close!
            if (dist < 3.4) {
              this.uTask[i] = 4;
              moveX = -dx / dist;
              moveY = -dy / dist;
            } else if (!clear) {
              moveX = dx / dist;
              moveY = dy / dist;
            }
            if (clear && this.uCooldown[i] <= 0) {
              const savedWpn = this.uWeapon[i];
              this.uWeapon[i] = wpnId;
              this.fireWeapon(i, this.ux[enemy], this.uy[enemy]);
              this.uWeapon[i] = savedWpn;
              this.uAmmo[i]--;
              this.uCooldown[i] = wpn.cooldown * (0.85 + Math.random() * 0.3);
            }
          } else {
            // Melee charge & shove/swing!
            this.uTask[i] = 3;
            if (dist > wpn.range * 0.85) {
              moveX = dx / dist;
              moveY = dy / dist;
            } else if (this.uCooldown[i] <= 0) {
              this.uCooldown[i] = wpn.cooldown;
              this.sfx.playWoodImpact(false);
              this.uHp[enemy] -= wpn.damage;
              this.uvx[enemy] += (dx / dist) * wpn.knockback;
              this.uvy[enemy] += (dy / dist) * wpn.knockback;
              for (let s = 0; s < 3; s++) {
                this.spawnParticle(this.ux[enemy], this.uy[enemy], 0.8, (dx / dist) * 3, (dy / dist) * 3, 2, PART_BLOOD, 0.7);
              }
              if (this.uHp[enemy] <= 0) this.uKills[i]++;
            }
          }
        } else {
          // Out of immediate combat -> Loot containers OR Barricade safehouse windows!
          const curLoot = this.world.loot[tIdx];
          if (curLoot > 0 && this.uCooldown[i] <= 0) {
            this.world.loot[tIdx]--;
            const propHere = this.world.prop[tIdx];
            if (propHere === PROP_GUN_LOCKER || propHere === PROP_AIRDROP) {
              this.uWeapon[i] = propHere === PROP_AIRDROP ? WPN_RIFLE : Math.random() < 0.5 ? WPN_SHOTGUN : WPN_PISTOL;
              this.uAmmo[i] += 36;
              this.uBandages[i] += 2;
              this.uFood[i] += 2;
            } else if (propHere === PROP_MED_CABINET) {
              this.uBandages[i] += 3;
              this.uHp[i] = this.uMaxHp[i];
            } else if (propHere === PROP_CRATE) {
              this.uPlanks[i] += 3;
              if (this.uWeapon[i] === WPN_FISTS) this.uWeapon[i] = Math.random() < 0.5 ? WPN_AXE : WPN_BAT;
            } else {
              this.uFood[i] += 2;
            }
            if (this.world.loot[tIdx] === 0 && propHere === PROP_AIRDROP) {
              this.world.prop[tIdx] = PROP_NONE;
            }
            this.uCooldown[i] = 0.8;
          }

          // Nail planks onto unbarricaded window right next to survivor inside their safehouse!
          if (this.uPlanks[i] > 0 && bId >= 0 && this.uCooldown[i] <= 0) {
            for (const [ox, oy] of [
              [1, 0],
              [-1, 0],
              [0, 1],
              [0, -1],
            ]) {
              const wx2 = gx + ox;
              const wy2 = gy + oy;
              if (!this.world.inBounds(wx2, wy2)) continue;
              const wIdx = wy2 * MAP_W + wx2;
              const st = this.world.struct[wIdx];
              if ((st === STRUCT_WINDOW_INTACT || st === STRUCT_WINDOW_BROKEN) && this.world.barricade[wIdx] < 3) {
                this.world.struct[wIdx] = STRUCT_WINDOW_BROKEN;
                this.world.barricade[wIdx]++;
                this.uPlanks[i]--;
                this.uTask[i] = 2;
                this.uCooldown[i] = 1.2;
                this.world.buildings[bId].isSafehouse = true;
                this.sfx.playWoodImpact(true);
                this.emitSound(wx2 + 0.5, wy2 + 0.5, 12, '#e9c46a');
                break;
              }
            }
          }

          // Pick next scavenging or safehouse goal when idle
          const dx = this.uGoalX[i] - x;
          const dy = this.uGoalY[i] - y;
          const dist = Math.hypot(dx, dy);
          if (dist < 1.2 || this.uGoalTimer[i] <= 0) {
            this.pickSurvivorGoal(i, gx, gy);
          } else {
            moveX = dx / dist;
            moveY = dy / dist;
          }
        }
      }

      // Apply velocity + knockback impulse damping + obstacle interaction!
      this.uvx[i] *= Math.max(0, 1 - 8.5 * dt);
      this.uvy[i] *= Math.max(0, 1 - 8.5 * dt);

      const stepVx = moveX * speed + this.uvx[i];
      const stepVy = moveY * speed + this.uvy[i];
      if (Math.abs(moveX) + Math.abs(moveY) > 0.05) {
        if (zed || enemy < 0) this.uAngle[i] = Math.atan2(moveY, moveX);
        this.uWalkPhase[i] += dt * speed * 3.4;
      }

      const tryX = x + stepVx * dt;
      const tryY = y + stepVy * dt;

      if (this.canTraverseOrInteract(i, Math.floor(tryX), Math.floor(y), zed, dt)) {
        x = tryX;
      } else {
        this.uvx[i] = 0;
      }
      if (this.canTraverseOrInteract(i, Math.floor(x), Math.floor(tryY), zed, dt)) {
        y = tryY;
      } else {
        this.uvy[i] = 0;
      }

      this.ux[i] = Math.max(1.5, Math.min(MAP_W - 2.5, x));
      this.uy[i] = Math.max(1.5, Math.min(MAP_H - 2.5, y));
    }

    // Compact dead corpses (leaving bloody stain on floor!)
    let write = 0;
    for (let i = 0; i < this.count; i++) {
      if (this.uHp[i] <= 0) {
        const idx = Math.floor(this.uy[i]) * MAP_W + Math.floor(this.ux[i]);
        if (idx >= 0 && idx < this.world.blood.length) {
          this.world.blood[idx] = Math.min(1, this.world.blood[idx] + 0.55);
        }
        continue;
      }
      if (write !== i) {
        this.copySlot(write, i);
      }
      write++;
    }
    this.count = write;
    this.recountPopulations();
  }

  private canTraverseOrInteract(unitIdx: number, tx: number, ty: number, zed: boolean, dt: number): boolean {
    if (!this.world.inBounds(tx, ty)) return false;
    if (this.world.isWalkable(tx, ty)) return true;

    const idx = ty * MAP_W + tx;
    const st = this.world.struct[idx];

    // Survivors smoothly open closed doors!
    if (!zed && st === STRUCT_DOOR_CLOSED) {
      this.world.struct[idx] = STRUCT_DOOR_OPEN;
      this.sfx.playWoodImpact(false);
      return true;
    }

    // Zombies pound on Closed Doors, Intact Windows, Barricades & Wooden Fences until they shatter!
    if (zed) {
      if (this.world.barricade[idx] > 0) {
        if (Math.random() < dt * 1.6) {
          this.world.barricade[idx]--;
          this.sfx.playWoodImpact(false);
          this.spawnParticle(tx + 0.5, ty + 0.5, 0.8, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, 2, PART_SPLINTER, 0.8);
        }
        return false;
      }
      if (st === STRUCT_WINDOW_INTACT) {
        this.world.structHp[idx] = Math.max(0, this.world.structHp[idx] - 75 * dt);
        if (this.world.structHp[idx] <= 0) {
          this.shatterWindow(tx, ty);
          return true;
        }
        return false;
      }
      if (st === STRUCT_DOOR_CLOSED || st === STRUCT_FENCE_WOOD || st === STRUCT_SANDBAG) {
        this.world.structHp[idx] = Math.max(0, this.world.structHp[idx] - 55 * dt);
        if (Math.random() < dt * 2.2) {
          this.sfx.playWoodImpact(false);
          this.emitSound(tx + 0.5, ty + 0.5, 14, '#e9c46a');
          this.spawnParticle(tx + 0.5, ty + 0.5, 0.8, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, 1.8, PART_SPLINTER, 0.6);
        }
        if (this.world.structHp[idx] <= 0) {
          this.world.struct[idx] = st === STRUCT_DOOR_CLOSED ? STRUCT_DOOR_OPEN : STRUCT_NONE;
          return true;
        }
      }
    }
    return false;
  }

  private pickSurvivorGoal(i: number, gx: number, gy: number): void {
    const needsLoot = this.uHunger[i] > 0.45 || this.uWeapon[i] === WPN_FISTS || this.uAmmo[i] < 6;
    if (needsLoot) {
      // Scan nearby radius for rich unlooted container!
      for (let attempt = 0; attempt < 18; attempt++) {
        const sx = Math.max(2, Math.min(MAP_W - 3, gx + (((Math.random() * 44) | 0) - 22)));
        const sy = Math.max(2, Math.min(MAP_H - 3, gy + (((Math.random() * 44) | 0) - 22)));
        if (this.world.loot[sy * MAP_W + sx] > 0) {
          this.uGoalX[i] = sx + 0.5;
          this.uGoalY[i] = sy + 0.5;
          this.uGoalTimer[i] = 9 + Math.random() * 5;
          this.uTask[i] = 1;
          return;
        }
      }
    }

    const hb = this.uHomeBldg[i];
    if (hb >= 0 && hb < this.world.buildings.length && this.uRole[i] !== ROLE_RAIDER) {
      const b = this.world.buildings[hb];
      this.uGoalX[i] = b.x0 + 1.5 + Math.random() * Math.max(1, b.w - 3);
      this.uGoalY[i] = b.y0 + 1.5 + Math.random() * Math.max(1, b.h - 3);
      this.uGoalTimer[i] = 6 + Math.random() * 6;
      this.uTask[i] = 0;
      return;
    }

    this.uGoalX[i] = Math.max(5, Math.min(MAP_W - 6, gx + (Math.random() - 0.5) * 28));
    this.uGoalY[i] = Math.max(5, Math.min(MAP_H - 6, gy + (Math.random() - 0.5) * 28));
    this.uGoalTimer[i] = 7 + Math.random() * 5;
    this.uTask[i] = 0;
  }

  private turnUnitIntoZombie(i: number): void {
    const wasPoliceOrSoldier = this.uRole[i] === ROLE_POLICE || this.uRole[i] === ROLE_SOLDIER;
    const bId = this.world.buildingId[Math.floor(this.uy[i]) * MAP_W + Math.floor(this.ux[i])];
    this.uRole[i] = wasPoliceOrSoldier ? ROLE_ZOMBIE_ARMORED : ROLE_ZOMBIE_SHAMBLER;
    this.uMaxHp[i] = wasPoliceOrSoldier ? 220 : 110;
    this.uHp[i] = this.uMaxHp[i];
    this.uInfection[i] = 1;
    this.uMoodles[i] = 0;
    this.uWeapon[i] = WPN_FISTS;
    this.targetCache[i] = -1;
    this.totalInfectedTurned++;
    this.sfx.playZombieGroan();

    if (bId >= 0 && this.world.buildings[bId].isSafehouse) {
      this.onRadioBroadcast?.(
        `☣ ТРАГЕДИЯ В УБЕЖИЩЕ: Заражённый обратился в зомби прямо внутри «${this.world.buildings[bId].name}»!`,
        '#ff6b6b',
      );
    }
  }

  private copySlot(dst: number, src: number): void {
    this.ux[dst] = this.ux[src];
    this.uy[dst] = this.uy[src];
    this.uvx[dst] = this.uvx[src];
    this.uvy[dst] = this.uvy[src];
    this.uAngle[dst] = this.uAngle[src];
    this.uRole[dst] = this.uRole[src];
    this.uWeapon[dst] = this.uWeapon[src];
    this.uAmmo[dst] = this.uAmmo[src];
    this.uFood[dst] = this.uFood[src];
    this.uBandages[dst] = this.uBandages[src];
    this.uPlanks[dst] = this.uPlanks[src];
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
    this.targetCache[dst] = -1;
  }

  private recountPopulations(): void {
    let live = 0;
    let zeds = 0;
    for (let i = 0; i < this.count; i++) {
      if (isZombieRole(this.uRole[i])) zeds++;
      else live++;
    }
    this.livingCount = live;
    this.zombieCount = zeds;

    let sh = 0;
    for (const b of this.world.buildings) {
      if (b.isSafehouse && b.survivorsInside > 0) sh++;
    }
    this.safehouseCount = sh;
  }
}
