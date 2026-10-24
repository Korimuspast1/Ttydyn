import { SoundEffects } from '../audio/sfx';
import { TraitBadge, UnitInspection, WORLD_H, WORLD_SIZE, WORLD_W } from './types';
import { WorldState } from './world';

const MAX_HUMANS = 1100;
const MAX_METEORS = 32;
const MAX_ARROWS = 260;
const MAX_DRAGONS = 12;
const MAX_MISSILES = 32;
const MAX_DRONES = 64;

export const ROLE_VILLAGER = 0;
export const ROLE_KNIGHT = 1;
export const ROLE_ARCHER = 2;
export const ROLE_ZOMBIE = 3;
export const ROLE_SKELETON = 4;
export const ROLE_SHEEP = 5;
export const ROLE_WOLF = 6;

export const BUILDING_RUINS = 6;
export const BUILDING_BASE = 7;
export const BUILDING_WALL = 8;
export const BUILDING_RADAR = 9;
export const BUILDING_SILO = 10;

export const ROLE_TANK = 7;
export const ROLE_APC = 8;

// Individual Unit Trait Bitmask Flags!
export const TRAIT_CANT_SWIM = 1 << 0;
export const TRAIT_SWIMMER = 1 << 1;
export const TRAIT_FAST = 1 << 2;
export const TRAIT_SLOW = 1 << 3;
export const TRAIT_GIANT = 1 << 4;
export const TRAIT_FRAGILE = 1 << 5;
export const TRAIT_IMMUNE = 1 << 6;
export const TRAIT_REGEN = 1 << 7;
export const TRAIT_PYROMANIAC = 1 << 8;
export const TRAIT_BRAVE = 1 << 9;
export const TRAIT_COWARD = 1 << 10;
export const TRAIT_HARDWORKER = 1 << 11;

const HUMAN_NAMES = [
  'Добрыня', 'Мирослав', 'Ярослав', 'Елисей', 'Любава', 'Забава',
  'Всеволод', 'Богдан', 'Алёша', 'Ратибор', 'Светозар', 'Марфа',
  'Яромир', 'Милана', 'Тихон', 'Варвара', 'Святослав', 'Дарья',
  'Гордей', 'Лада', 'Лука', 'Весна', 'Федот', 'Злата',
];

const STATE_WANDER = 0;
const STATE_SEEK_TREE = 1;
const STATE_CHOPPING = 2;
const STATE_RETURN_WOOD = 3;
const STATE_COMBAT = 4;

const VILLAGE_NAMES = [
  'Златоград',
  'Лесорубье',
  'Озёрск',
  'Сосновый Яр',
  'Алый Берег',
  'Севергард',
  'Дубрава',
  'Янтарск',
  'Тихий Плёс',
  'Каменогор',
  'Волнорез',
  'Светлополье',
  'Громоград',
  'Зеленодол',
  'Беловодье',
  'Орлиный Стан',
];

export interface Settlement {
  id: number;
  active: boolean;
  name: string;
  kingdom: number; // 0..5
  centerX: number;
  centerY: number;
  population: number;
  buildings: number;
  woodStockpile: number;
  goldStockpile: number;
  /** Кем аннексирована база (0 = свободна) — оккупированные провинции восстают! */
  annexedBy: number;
  /** Обратный отсчёт до восстания оккупированной базы */
  rebelTimer: number;
}

export interface LightningFlash {
  x: number;
  y: number;
  life: number;
  seed: number;
}

export interface NukeCloud {
  x: number;
  y: number;
  age: number;
  maxAge: number;
}

export interface ExplosionParticleEmitter {
  emitDebris(
    type: number,
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    mass: number,
  ): void;
}

export class EntityManager {
  // Living Units (Humans, Knights, Archers, Zombies, Skeletons, Sheep, Wolves)
  public humanCount = 0;
  public hx = new Float32Array(MAX_HUMANS);
  public hy = new Float32Array(MAX_HUMANS);
  public hz = new Float32Array(MAX_HUMANS);
  public hvz = new Float32Array(MAX_HUMANS);
  public hTargetX = new Float32Array(MAX_HUMANS);
  public hTargetY = new Float32Array(MAX_HUMANS);
  public hTimer = new Float32Array(MAX_HUMANS);
  public hKingdom = new Uint8Array(MAX_HUMANS);
  public hSettlement = new Uint8Array(MAX_HUMANS);
  public hRole = new Uint8Array(MAX_HUMANS);
  public hState = new Uint8Array(MAX_HUMANS);
  public hTreeIdx = new Int32Array(MAX_HUMANS);
  public hChopProgress = new Float32Array(MAX_HUMANS);
  public hWood = new Uint8Array(MAX_HUMANS);
  public hHp = new Float32Array(MAX_HUMANS);
  public hMaxHp = new Float32Array(MAX_HUMANS);
  public hAtkCooldown = new Float32Array(MAX_HUMANS);
  public hPlague = new Uint8Array(MAX_HUMANS);
  public hInfected = new Float32Array(MAX_HUMANS);
  public hBlessed = new Uint8Array(MAX_HUMANS);
  public hAge = new Float32Array(MAX_HUMANS);
  public hVariant = new Uint16Array(MAX_HUMANS);
  public hFacing = new Int8Array(MAX_HUMANS);
  public hWalkPhase = new Float32Array(MAX_HUMANS);
  public hTraits = new Uint16Array(MAX_HUMANS);
  public hKills = new Uint16Array(MAX_HUMANS);
  public hUid = new Uint32Array(MAX_HUMANS);
  public nextUnitUid = 1;
  public selectedUnitUid = 0;

  // Flying Arrows in Parabolic Flight
  public arrowCount = 0;
  public ax = new Float32Array(MAX_ARROWS);
  public ay = new Float32Array(MAX_ARROWS);
  public az = new Float32Array(MAX_ARROWS);
  public avx = new Float32Array(MAX_ARROWS);
  public avy = new Float32Array(MAX_ARROWS);
  public avz = new Float32Array(MAX_ARROWS);
  public aKingdom = new Uint8Array(MAX_ARROWS);
  public aDmg = new Float32Array(MAX_ARROWS);

  // Flying Fire Dragons
  public dragonCount = 0;
  public dx = new Float32Array(MAX_DRAGONS);
  public dy = new Float32Array(MAX_DRAGONS);
  public dz = new Float32Array(MAX_DRAGONS);
  public dvx = new Float32Array(MAX_DRAGONS);
  public dvy = new Float32Array(MAX_DRAGONS);
  public dHp = new Float32Array(MAX_DRAGONS);
  public dMaxHp = new Float32Array(MAX_DRAGONS);
  public dBreathTimer = new Float32Array(MAX_DRAGONS);

  // Ballistic / Cruise Missiles in flight
  public missileCount = 0;
  public msx = new Float32Array(MAX_MISSILES);
  public msy = new Float32Array(MAX_MISSILES);
  public msz = new Float32Array(MAX_MISSILES);
  public msvx = new Float32Array(MAX_MISSILES);
  public msvy = new Float32Array(MAX_MISSILES);
  public msvz = new Float32Array(MAX_MISSILES);
  public mstx = new Float32Array(MAX_MISSILES);
  public msty = new Float32Array(MAX_MISSILES);
  public msPower = new Float32Array(MAX_MISSILES);
  public msKind = new Uint8Array(MAX_MISSILES); // 0=ballistic 1=cruise 2=fab 3=grad
  public msKingdom = new Uint8Array(MAX_MISSILES);

  // FPV Kamikaze Drones
  public droneCount = 0;
  public drx = new Float32Array(MAX_DRONES);
  public dry = new Float32Array(MAX_DRONES);
  public drz = new Float32Array(MAX_DRONES);
  public drvx = new Float32Array(MAX_DRONES);
  public drvy = new Float32Array(MAX_DRONES);
  public drTargetX = new Float32Array(MAX_DRONES);
  public drTargetY = new Float32Array(MAX_DRONES);
  public drLife = new Float32Array(MAX_DRONES);
  public drKingdom = new Uint8Array(MAX_DRONES);

  // Visual Catastrophe FX (Sky Lightning Bolts & Atomic Mushroom Clouds)
  public lightningBolts: LightningFlash[] = [];
  public nukeClouds: NukeCloud[] = [];

  // Settlements & Kingdom Diplomacy War Matrix (6x6)
  public settlements: Settlement[] = [];
  private settlementById: (Settlement | undefined)[] = new Array(64);
  public warMatrix = new Uint8Array(36);
  // Матрица военных союзов (альянсы): союзники воюют вместе против общих врагов!
  public allyMatrix = new Uint8Array(36);
  public activeWarsCount = 0;
  public territoryVersion = 1;
  public onWorldEvent: ((message: string, color: string) => void) | null = null;

  private nextNameIdx = 0;
  private territoryTick = 0;
  private towerDefenseTick = 0;
  private autoDiplomacyTimer = 19.0;
  private bfsQueue = new Int32Array(WORLD_SIZE);
  private bfsDist = new Uint16Array(WORLD_SIZE);
  private towerIndices = new Int32Array(2048);
  private towerCount = 0;

  // Zero-allocation Spatial Hash Grid (8x8 tile cells -> 40x25 = 1000 cells)
  private gridHead = new Int16Array(1000);
  private gridNext = new Int16Array(MAX_HUMANS);
  private hEnemyCache = new Int16Array(MAX_HUMANS);
  private aiPhase = 0;
  private livingPreyCount = 0;

  // Streaking Meteors in Flight
  public meteorCount = 0;
  public mx = new Float32Array(MAX_METEORS);
  public my = new Float32Array(MAX_METEORS);
  public mz = new Float32Array(MAX_METEORS);
  public mvx = new Float32Array(MAX_METEORS);
  public mvy = new Float32Array(MAX_METEORS);
  public mvz = new Float32Array(MAX_METEORS);
  public mPower = new Float32Array(MAX_METEORS);

  public screenShake = 0;
  private nextKingdomCounter = 0;

  constructor(
    private world: WorldState,
    private sfx: SoundEffects,
  ) {}

  public reset(): void {
    this.humanCount = 0;
    this.arrowCount = 0;
    this.dragonCount = 0;
    this.missileCount = 0;
    this.droneCount = 0;
    this.meteorCount = 0;
    this.lightningBolts = [];
    this.nukeClouds = [];
    this.screenShake = 0;
    this.settlements = [];
    this.warMatrix.fill(0);
    this.allyMatrix.fill(0);
    this.activeWarsCount = 0;
    this.autoDiplomacyTimer = 18.0 + Math.random() * 8.0;
    this.nextKingdomCounter = 0;

    this.world.territory.fill(0);
    this.world.buildings.fill(0);
    this.world.buildingHp.fill(0);
    this.world.buildingSettlement.fill(0);
    this.world.buildingKingdom.fill(0);
    this.world.road.fill(0);

    this.spawnStarterColoniesAndWildlife();
    this.recomputeTerritories();
  }

  public isKingdomsAtWar(kA: number, kB: number): boolean {
    if (kA === kB) return false;
    if (kA >= 6 || kB >= 6) return true;
    return this.warMatrix[kA * 6 + kB] === 1;
  }
  public isSettlementAtWar(s: Settlement): boolean {
    for(let k=0;k<6;k++){ if(k!==s.kingdom && this.warMatrix[s.kingdom*6+k]) return true; }
    return false;
  }

  public setWarState(kA: number, kB: number, atWar: boolean): void {
    if (kA < 0 || kA >= 6 || kB < 0 || kB >= 6 || kA === kB) return;
    const prev = this.warMatrix[kA * 6 + kB];
    const val = atWar ? 1 : 0;
    if (prev === val) return;

    this.warMatrix[kA * 6 + kB] = val;
    this.warMatrix[kB * 6 + kA] = val;
    this.recountWars();

    const sA = this.settlements.find((s) => s.active && s.kingdom === kA);
    const sB = this.settlements.find((s) => s.active && s.kingdom === kB);
    if (atWar) {
      this.sfx.playWarHorn();
      // Союзники автоматически вступают в войну!
      this.pullAlliesIntoWar(kA, kB);
      // Mobilize militia in both kingdoms immediately!
      this.mobilizeKingdomArmy(kA);
      this.mobilizeKingdomArmy(kB);
      if (this.onWorldEvent && sA && sB) {
        this.onWorldEvent(`⚔ ${sA.name} объявил ВОЙНУ ${sB.name}!`, '#ff6b6b');
      }
    } else if (this.onWorldEvent && sA && sB) {
      this.onWorldEvent(`🕊 ${sA.name} и ${sB.name} заключили МИР!`, '#8ce99a');
    }
  }

  public isAllied(kA: number, kB: number): boolean {
    if (kA === kB) return false;
    if (kA >= 6 || kB >= 6) return false;
    return this.allyMatrix[kA * 6 + kB] === 1;
  }

  public setAllianceState(kA: number, kB: number, allied: boolean): void {
    if (kA < 0 || kA >= 6 || kB < 0 || kB >= 6 || kA === kB) return;
    const prev = this.allyMatrix[kA * 6 + kB];
    const val = allied ? 1 : 0;
    if (prev === val) return;
    this.allyMatrix[kA * 6 + kB] = val;
    this.allyMatrix[kB * 6 + kA] = val;
    const sA = this.settlements.find((s) => s.active && s.kingdom === kA);
    const sB = this.settlements.find((s) => s.active && s.kingdom === kB);
    if (this.onWorldEvent && sA && sB) {
      if (allied) {
        this.onWorldEvent(`🤝 АЛЬЯНС: ${sA.name} и ${sB.name} подписали военный пакт!`, '#69db7c');
      } else {
        this.onWorldEvent(`💔 Альянс ${sA.name} и ${sB.name} распался!`, '#ffa94d');
      }
    }
  }

  /** Враг моего союзника — мой враг: союзники автоматически вступают в войну! */
  private pullAlliesIntoWar(kA: number, kB: number): void {
    for (let k = 0; k < 6; k++) {
      if (k === kA || k === kB) continue;
      if (this.allyMatrix[kA * 6 + k] === 1 && this.warMatrix[k * 6 + kB] === 0) {
        this.warMatrix[k * 6 + kB] = 1;
        this.warMatrix[kB * 6 + k] = 1;
        this.mobilizeKingdomArmy(k);
      }
      if (this.allyMatrix[kB * 6 + k] === 1 && this.warMatrix[k * 6 + kA] === 0) {
        this.warMatrix[k * 6 + kA] = 1;
        this.warMatrix[kA * 6 + k] = 1;
        this.mobilizeKingdomArmy(k);
      }
    }
    this.recountWars();
  }

  public recountWars(): void {
    let c = 0;
    for (let a = 0; a < 6; a++) {
      for (let b = a + 1; b < 6; b++) {
        if (this.warMatrix[a * 6 + b]) c++;
      }
    }
    this.activeWarsCount = c;
  }

  private mobilizeKingdomArmy(kingdom: number): void {
    let promoted = 0;
    for (let i = 0; i < this.humanCount; i++) {
      if (this.hKingdom[i] === kingdom && this.hRole[i] === ROLE_VILLAGER) {
        if (promoted % 3 === 2) this.hRole[i] = ROLE_ARCHER;
        else this.hRole[i] = ROLE_KNIGHT;
        this.hMaxHp[i] = this.hRole[i] === ROLE_KNIGHT ? 155 : 100;
        this.hHp[i] = this.hMaxHp[i];
        this.hWood[i] = 0;
        this.hTimer[i] = 0;
        promoted++;
        if (promoted >= 7) break;
      }
    }
  }

  public triggerWarPower(gx: number, gy: number, radius: number): void {
    const activeKingdoms = Array.from(
      new Set(this.settlements.filter((s) => s.active).map((s) => s.kingdom)),
    );
    if (activeKingdoms.length < 2) return;

    // Find settlement under brush or nearest settlement to cursor
    let targetK = -1;
    let bestD = radius + 24;
    for (const s of this.settlements) {
      if (!s.active) continue;
      const d = Math.hypot(s.centerX - gx, s.centerY - gy);
      if (d < bestD) {
        bestD = d;
        targetK = s.kingdom;
      }
    }

    if (targetK >= 0) {
      for (const otherK of activeKingdoms) {
        if (otherK !== targetK) this.setWarState(targetK, otherK, true);
      }
    } else {
      this.setWarState(activeKingdoms[0], activeKingdoms[1], true);
    }
  }

  public triggerPeacePower(): void {
    let anyChanged = false;
    for (let a = 0; a < 6; a++) {
      for (let b = a + 1; b < 6; b++) {
        if (this.warMatrix[a * 6 + b]) {
          this.warMatrix[a * 6 + b] = 0;
          this.warMatrix[b * 6 + a] = 0;
          anyChanged = true;
        }
      }
    }
    this.activeWarsCount = 0;
    this.sfx.playLifeChime();
    if (anyChanged && this.onWorldEvent) {
      this.onWorldEvent('🕊 Божественное перемирие: все войны остановлены!', '#99e9f2');
    }
  }

  public triggerBlessingAt(gx: number, gy: number, radius: number): void {
    this.sfx.playLifeChime();
    for (let i = 0; i < this.humanCount; i++) {
      if (Math.hypot(this.hx[i] - gx, this.hy[i] - gy) <= radius + 1.5) {
        this.hPlague[i] = 0;
        this.hInfected[i] = 0; // Divine Blessing cures Zombie Bite too!
        if (this.hRole[i] <= ROLE_ARCHER) {
          this.hBlessed[i] = 1;
          this.hMaxHp[i] = Math.max(this.hMaxHp[i], 210);
          this.hHp[i] = this.hMaxHp[i];
        }
      }
    }
  }

  public getSettlementById(id: number): Settlement | undefined {
    if (id <= 0 || id >= 64) return undefined;
    const cached = this.settlementById[id];
    if (cached && cached.active && cached.id === id) return cached;
    for (let i = 0; i < this.settlements.length; i++) {
      const s = this.settlements[i];
      if (s.active && s.id === id) {
        this.settlementById[id] = s;
        return s;
      }
    }
    return undefined;
  }

  private rebuildUnitGrid(): number {
    this.gridHead.fill(-1);
    let zombies = 0;
    let prey = 0;
    for (let i = 0; i < this.humanCount; i++) {
      if (this.hHp[i] <= 0) continue;
      const r = this.hRole[i];
      if (r === ROLE_ZOMBIE) zombies++;
      else if (r <= ROLE_ARCHER || r === ROLE_SHEEP || r === ROLE_WOLF) prey++;

      let cx = (this.hx[i] * 0.125) | 0;
      let cy = (this.hy[i] * 0.125) | 0;
      if (cx < 0) cx = 0;
      else if (cx > 39) cx = 39;
      if (cy < 0) cy = 0;
      else if (cy > 24) cy = 24;
      const cell = cy * 40 + cx;
      this.gridNext[i] = this.gridHead[cell];
      this.gridHead[cell] = i;
    }
    this.livingPreyCount = prey;
    return zombies;
  }

  private findOrCreateSettlement(x: number, y: number, preferredKingdom?: number): Settlement {
    let nearest: Settlement | undefined;
    let bestDist = 42.0;
    for (const s of this.settlements) {
      if (!s.active) continue;
      const d = Math.hypot(s.centerX - x, s.centerY - y);
      if (d < bestDist) {
        bestDist = d;
        nearest = s;
      }
    }
    if (nearest) return nearest;

    let slotId = 1;
    const usedIds = new Set(this.settlements.filter((s) => s.active).map((s) => s.id));
    while (usedIds.has(slotId) && slotId < 32) slotId++;

    const kingdom =
      preferredKingdom !== undefined ? preferredKingdom % 6 : (this.nextKingdomCounter++) % 6;
    const name = VILLAGE_NAMES[this.nextNameIdx % VILLAGE_NAMES.length];
    this.nextNameIdx++;

    const cx = Math.max(4, Math.min(WORLD_W - 5, Math.round(x)));
    const cy = Math.max(4, Math.min(WORLD_H - 5, Math.round(y)));

    const created: Settlement = {
      id: slotId,
      active: true,
      name,
      kingdom,
      centerX: cx,
      centerY: cy,
      population: 1,
      buildings: 1,
      woodStockpile: 0,
      goldStockpile: 0,
      annexedBy: 0,
      rebelTimer: 0,
    };
    this.settlements.push(created);
    if (slotId > 0 && slotId < 64) {
      this.settlementById[slotId] = created;
    }

    const cIdx = cy * WORLD_W + cx;
    if (this.world.buildings[cIdx] === 0) {
      this.clearPlotForBuilding(cx, cy, 2);
      this.world.buildings[cIdx] = 1; // Starter campfire
      this.world.buildingHp[cIdx] = 65;
      this.world.buildingSettlement[cIdx] = slotId;
      this.world.buildingKingdom[cIdx] = kingdom;
    }

    return created;
  }

  private spawnStarterColoniesAndWildlife(): void {
    const W = WORLD_W;
    const H = WORLD_H;
    const chosen: { x: number; y: number }[] = [];

    // Dynamically discover 3 separated fertile islands/regions on ANY randomly generated world!
    for (let k = 0; k < 3; k++) {
      let bestX = -1;
      let bestY = -1;
      let bestScore = -1;

      for (let attempt = 0; attempt < 350; attempt++) {
        const tx = Math.floor(W * (0.12 + Math.random() * 0.76));
        const ty = Math.floor(H * (0.14 + Math.random() * 0.72));
        const idx = ty * W + tx;
        if (
          this.world.water[idx] > 0.01 ||
          this.world.lava[idx] > 0.01 ||
          this.world.grass[idx] < 0.65 ||
          this.world.stone[idx] > 0.25
        ) {
          continue;
        }

        let minDist = 999;
        for (const c of chosen) {
          minDist = Math.min(minDist, Math.hypot(tx - c.x, ty - c.y));
        }
        if (minDist < 62) continue;

        if (minDist > bestScore) {
          bestScore = minDist;
          bestX = tx;
          bestY = ty;
          if (minDist > 95) break;
        }
      }

      if (bestX >= 0) {
        chosen.push({ x: bestX, y: bestY });
        const s = this.findOrCreateSettlement(bestX, bestY, k);
        for (let n = 0; n < 8; n++) {
          const role = n === 6 ? ROLE_KNIGHT : n === 7 ? ROLE_ARCHER : ROLE_VILLAGER;
          this.spawnUnit(
            bestX + (Math.random() - 0.5) * 6,
            bestY + (Math.random() - 0.5) * 6,
            0,
            role,
            s.kingdom,
            s.id,
          );
        }
      }
    }

    // Scatter a few peaceful grazing Sheep flocks across green meadows!
    for (let sh = 0; sh < 12; sh++) {
      for (let tries = 0; tries < 50; tries++) {
        const sx = Math.floor(W * (0.1 + Math.random() * 0.8));
        const sy = Math.floor(H * (0.1 + Math.random() * 0.8));
        const si = sy * W + sx;
        if (this.world.water[si] <= 0.01 && this.world.grass[si] > 0.7) {
          this.spawnUnit(sx + 0.5, sy + 0.5, 0, ROLE_SHEEP, 0, 0);
          break;
        }
      }
    }
  }

  public spawnHuman(
    x: number,
    y: number,
    dropHeight = 18,
    kingdom?: number,
    settlementId?: number,
  ): void {
    this.spawnUnit(x, y, dropHeight, ROLE_VILLAGER, kingdom, settlementId);
  }

  public spawnUnit(
    x: number,
    y: number,
    dropHeight = 14,
    role = ROLE_VILLAGER,
    kingdom?: number,
    settlementId?: number,
  ): void {
    if (this.humanCount >= MAX_HUMANS) return;
    if (x < 2 || x >= WORLD_W - 2 || y < 2 || y >= WORLD_H - 2) return;

    const i = this.humanCount++;
    const gx = x | 0;
    const gy = y | 0;
    const idx = gy * WORLD_W + gx;
    const surf = this.world.surfaceHeight(idx);

    let sid = settlementId || 0;
    let k = kingdom !== undefined ? kingdom : 0;

    if (role === ROLE_ZOMBIE) {
      k = 6;
      sid = 0;
    } else if (role === ROLE_SKELETON) {
      k = 7;
      sid = 0;
    } else if (role === ROLE_SHEEP || role === ROLE_WOLF) {
      k = 8;
      sid = 0;
    } else {
      if (sid === 0 && this.world.water[idx] <= 0.08 && this.world.lava[idx] <= 0.01) {
        const s = this.findOrCreateSettlement(x, y, kingdom);
        sid = s.id;
        k = s.kingdom;
      } else if (sid === 0) {
        k = (this.nextKingdomCounter++) % 6;
      }
    }

    // Roll authentic individual WorldBox traits for this unit!
    let traits = 0;
    const swimRoll = Math.random();
    if (role === ROLE_SHEEP || swimRoll < 0.34) {
      traits |= TRAIT_CANT_SWIM;
    } else if (swimRoll > 0.78) {
      traits |= TRAIT_SWIMMER;
    }
    const spdRoll = Math.random();
    if (spdRoll < 0.22) traits |= TRAIT_FAST;
    else if (spdRoll > 0.84) traits |= TRAIT_SLOW;

    const sizeRoll = Math.random();
    if (sizeRoll < 0.14) traits |= TRAIT_GIANT;
    else if (sizeRoll > 0.88) traits |= TRAIT_FRAGILE;

    if (Math.random() < 0.15) traits |= TRAIT_IMMUNE;
    if (Math.random() < 0.14) traits |= TRAIT_REGEN;
    if (Math.random() < 0.1) traits |= TRAIT_PYROMANIAC;
    if (role <= ROLE_ARCHER) {
      const courageRoll = Math.random();
      if (courageRoll < 0.25 || role === ROLE_KNIGHT) traits |= TRAIT_BRAVE;
      else if (courageRoll > 0.82 && role === ROLE_VILLAGER) traits |= TRAIT_COWARD;
      if (role === ROLE_VILLAGER && Math.random() < 0.28) traits |= TRAIT_HARDWORKER;
    }

    let baseHp =
      role === ROLE_KNIGHT
        ? 155
        : role === ROLE_ARCHER
          ? 100
          : role === ROLE_ZOMBIE
            ? 210
            : role === ROLE_SKELETON
              ? 85
              : role === ROLE_WOLF
                ? 75
                : role === ROLE_SHEEP
                  ? 42
                  : 70;
    if (traits & TRAIT_GIANT) baseHp = Math.round(baseHp * 1.6);
    if (traits & TRAIT_FRAGILE) baseHp = Math.round(baseHp * 0.75);

    this.hx[i] = x;
    this.hy[i] = y;
    this.hz[i] = dropHeight > 0 ? surf + dropHeight : surf;
    this.hvz[i] = dropHeight > 0 ? -4 : 0;
    this.hTargetX[i] = x;
    this.hTargetY[i] = y;
    this.hTimer[i] = Math.random() * 0.4;
    this.hKingdom[i] = k;
    this.hSettlement[i] = sid;
    this.hRole[i] = role;
    this.hState[i] = STATE_WANDER;
    this.hTreeIdx[i] = -1;
    this.hChopProgress[i] = 0;
    this.hWood[i] = 0;
    this.hHp[i] = baseHp;
    this.hMaxHp[i] = baseHp;
    this.hAtkCooldown[i] = Math.random() * 0.25;
    this.hPlague[i] = 0;
    this.hInfected[i] = 0;
    this.hBlessed[i] = 0;
    this.hAge[i] = Math.random() * 14 + 6;
    this.hVariant[i] = (Math.random() * 65535) | 0;
    this.hFacing[i] = Math.random() < 0.5 ? -1 : 1;
    this.hWalkPhase[i] = Math.random() * Math.PI * 2;
    this.hTraits[i] = traits;
    this.hKills[i] = 0;
    this.hUid[i] = this.nextUnitUid++;
  }

  public isUnitDrowning(idx: number): boolean {
    const role = this.hRole[idx];
    if (role === ROLE_SKELETON) return false;
    if ((this.hTraits[idx] & TRAIT_CANT_SWIM) === 0) return false;
    const gx = Math.max(0, Math.min(WORLD_W - 1, this.hx[idx] | 0));
    const gy = Math.max(0, Math.min(WORLD_H - 1, this.hy[idx] | 0));
    const tIdx = gy * WORLD_W + gx;
    return this.world.water[tIdx] > 0.34 && this.world.ice[tIdx] < 0.12;
  }

  public getUnitSizeMult(idx: number): number {
    const t = this.hTraits[idx];
    if (t & TRAIT_GIANT) return 1.28;
    if (t & TRAIT_FRAGILE) return 0.85;
    return 1.0;
  }

  public selectUnitNear(gx: number, gy: number, maxDist = 4.5): boolean {
    let best = -1;
    let bestD = maxDist;
    for (let i = 0; i < this.humanCount; i++) {
      const d = Math.hypot(this.hx[i] - gx, this.hy[i] - gy);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best >= 0) {
      this.selectedUnitUid = this.hUid[best];
      this.sfx.playLifeChime();
      return true;
    }
    this.selectedUnitUid = 0;
    return false;
  }

  public getUnitInspection(hoverGx: number, hoverGy: number, inBounds: boolean): UnitInspection | null {
    let idx = -1;
    let pinned = false;

    if (this.selectedUnitUid > 0) {
      for (let i = 0; i < this.humanCount; i++) {
        if (this.hUid[i] === this.selectedUnitUid) {
          idx = i;
          pinned = true;
          break;
        }
      }
      if (idx < 0) this.selectedUnitUid = 0;
    }

    if (idx < 0 && inBounds) {
      let bestD = 3.2;
      for (let i = 0; i < this.humanCount; i++) {
        const d = Math.hypot(this.hx[i] - hoverGx, this.hy[i] - hoverGy);
        if (d < bestD) {
          bestD = d;
          idx = i;
        }
      }
    }

    if (idx < 0) return null;

    const role = this.hRole[idx];
    const traitsMask = this.hTraits[idx];
    const uid = this.hUid[idx];
    const settle = this.getSettlementById(this.hSettlement[idx]);

    const roleNames: Record<number, string> = {
      0: 'Житель',
      1: 'Рыцарь',
      2: 'Лучник',
      3: 'Зомби',
      4: 'Скелет',
      5: 'Овечка',
      6: 'Лесной волк',
    };

    const name =
      role <= 2
        ? HUMAN_NAMES[(uid + this.hVariant[idx]) % HUMAN_NAMES.length]
        : role === 3
          ? `Зомби #${uid % 100}`
          : role === 4
            ? `Костяк #${uid % 100}`
            : role === 5
              ? `Бяша #${uid % 100}`
              : `Волк #${uid % 100}`;

    let dmg = role === ROLE_KNIGHT ? 26 : role === ROLE_ZOMBIE ? 26 : role === ROLE_SKELETON ? 20 : 13;
    if (traitsMask & TRAIT_GIANT) dmg = Math.round(dmg * 1.35);
    if (this.hBlessed[idx]) dmg = Math.round(dmg * 1.45);

    let spd = role === ROLE_SHEEP ? 4.2 : role === ROLE_ZOMBIE ? 7.4 : 8.0;
    if (traitsMask & TRAIT_FAST) spd *= 1.35;
    if (traitsMask & TRAIT_SLOW) spd *= 0.74;

    const badges: TraitBadge[] = [];
    if (traitsMask & TRAIT_CANT_SWIM) {
      badges.push({ label: '🌊 Не умеет плавать', color: '#ff6b6b', desc: 'Боится глубокой воды и тонет при наводнении!' });
    } else if (traitsMask & TRAIT_SWIMMER) {
      badges.push({ label: '🏊 Отличный пловец', color: '#4dabf7', desc: 'Быстро плывёт и никогда не тонет!' });
    }
    if (traitsMask & TRAIT_GIANT) badges.push({ label: '💪 Гигант', color: '#ffa94d', desc: 'Огромный рост, +60% здоровья и +35% силы!' });
    if (traitsMask & TRAIT_FRAGILE) badges.push({ label: '🐣 Хрупкий', color: '#ced4da', desc: 'Невысокий рост и сниженный запас здоровья.' });
    if (traitsMask & TRAIT_FAST) badges.push({ label: '⚡ Быстрый', color: '#ffe066', desc: '+35% к скорости бега!' });
    if (traitsMask & TRAIT_SLOW) badges.push({ label: '🐢 Медлительный', color: '#adb5bd', desc: 'Ходит неспешно (-26% к скорости).' });
    if (traitsMask & TRAIT_IMMUNE) badges.push({ label: '🧬 Иммунитет', color: '#69db7c', desc: 'Не заражается чумой и укусом зомби!' });
    if (traitsMask & TRAIT_REGEN) badges.push({ label: '💚 Регенерация', color: '#51cf66', desc: 'Сам залечивает раны со временем.' });
    if (traitsMask & TRAIT_PYROMANIAC) badges.push({ label: '🔥 Пироман', color: '#ff922b', desc: 'Не горит в огне и высекает искры в бою!' });
    if (traitsMask & TRAIT_BRAVE) badges.push({ label: '🦁 Храбрый', color: '#ffd43b', desc: 'Бесстрашно бросается в бой с монстрами!' });
    if (traitsMask & TRAIT_COWARD) badges.push({ label: '😱 Пугливый', color: '#e599f7', desc: 'Издалека убегает от любой опасности.' });
    if (traitsMask & TRAIT_HARDWORKER) badges.push({ label: '🪓 Трудолюбивый', color: '#c0eb75', desc: 'Быстро рубит лес и носит больше брёвен!' });

    return {
      uid,
      name,
      roleName: roleNames[role] ?? 'Существо',
      settlementName: settle ? settle.name : null,
      age: Math.max(1, Math.floor(this.hAge[idx])),
      kills: this.hKills[idx],
      hp: Math.ceil(this.hHp[idx]),
      maxHp: Math.ceil(this.hMaxHp[idx]),
      damage: dmg,
      speed: Math.round(spd * 10) / 10,
      canSwim: (traitsMask & TRAIT_CANT_SWIM) === 0,
      drowning: this.isUnitDrowning(idx),
      infected: this.hInfected[idx] > 0,
      blessed: this.hBlessed[idx] !== 0,
      pinned,
      traits: badges,
    };
  }

  public spawnDragon(x: number, y: number): void {
    if (this.dragonCount >= MAX_DRAGONS) return;
    const i = this.dragonCount++;
    const idx =
      Math.max(0, Math.min(WORLD_H - 1, y | 0)) * WORLD_W +
      Math.max(0, Math.min(WORLD_W - 1, x | 0));
    const ang = Math.random() * Math.PI * 2;
    this.dx[i] = x;
    this.dy[i] = y;
    this.dz[i] = this.world.surfaceHeight(idx) + 16;
    this.dvx[i] = Math.cos(ang) * 14;
    this.dvy[i] = Math.sin(ang) * 14;
    this.dMaxHp[i] = 480;
    this.dHp[i] = 480;
    this.dBreathTimer[i] = 0.25;
    this.sfx.playWarHorn();
  }

  public fireArrow(
    x0: number,
    y0: number,
    z0: number,
    tx: number,
    ty: number,
    tz: number,
    kingdom: number,
    dmg = 22,
  ): void {
    if (this.arrowCount >= MAX_ARROWS) return;
    const a = this.arrowCount++;
    const dx = tx - x0;
    const dy = ty - y0;
    const dist = Math.max(1.5, Math.hypot(dx, dy));
    const tFlight = Math.min(0.85, dist / 28.0);
    const g = 34.0;

    this.ax[a] = x0;
    this.ay[a] = y0;
    this.az[a] = z0 + 1.1;
    this.avx[a] = dx / tFlight;
    this.avy[a] = dy / tFlight;
    this.avz[a] = (tz - (z0 + 1.1)) / tFlight + 0.5 * g * tFlight;
    this.aKingdom[a] = kingdom;
    this.aDmg[a] = dmg;
  }

  public spawnMeteor(targetX: number, targetY: number, power = 1.0): void {
    if (this.meteorCount >= MAX_METEORS) return;
    const i = this.meteorCount++;
    const idx =
      Math.max(0, Math.min(WORLD_H - 1, targetY | 0)) * WORLD_W +
      Math.max(0, Math.min(WORLD_W - 1, targetX | 0));
    const surf = this.world.surfaceHeight(idx);

    const flightTime = 0.52;
    const startOffsetX = -32 + (Math.random() - 0.5) * 8;
    const startOffsetY = -42 + (Math.random() - 0.5) * 8;
    const startZ = surf + 68;

    this.mx[i] = targetX + startOffsetX;
    this.my[i] = targetY + startOffsetY;
    this.mz[i] = startZ;
    this.mvx[i] = -startOffsetX / flightTime;
    this.mvy[i] = -startOffsetY / flightTime;
    this.mvz[i] = -(startZ - surf) / flightTime;
    this.mPower[i] = power;

    this.sfx.playFireCrackle();
  }

  public spawnBallisticMissile(targetX: number, targetY: number, sourceKingdom: number, kind: number = 0, power = 1.0): void {
    if (this.missileCount >= MAX_MISSILES) return;
    const i = this.missileCount++;
    const sx = targetX + (Math.random()-0.5)*18 - 12; // launch offset
    const sy = targetY + (Math.random()-0.5)*18 - 20;
    const sIdx = Math.max(0, Math.min(WORLD_H-1, sy|0))*WORLD_W + Math.max(0, Math.min(WORLD_W-1, sx|0));
    const surf = this.world.surfaceHeight(sIdx);
    const tIdx = Math.max(0, Math.min(WORLD_H-1, targetY|0))*WORLD_W + Math.max(0, Math.min(WORLD_W-1, targetX|0));
    const targetSurf = this.world.surfaceHeight(tIdx);
    const flightTime = kind===0 ? 1.25 : kind===1 ? 1.8 : 0.9; // ballistic longer
    this.msx[i]=sx; this.msy[i]=sy; this.msz[i]= kind===0 ? surf+42 : kind===1 ? surf+6 : surf+18;
    this.msvx[i]=(targetX - sx)/flightTime;
    this.msvy[i]=(targetY - sy)/flightTime;
    this.msvz[i]= kind===0 ? 38 : kind===1 ? -2 : 18; // vertical component
    // ballistic will be parabolic handled in update
    this.mstx[i]=targetX; this.msty[i]=targetY; this.msPower[i]=power; this.msKind[i]=kind; this.msKingdom[i]=sourceKingdom;
    this.sfx.playMissileLaunch();
    if (this.onWorldEvent && kind===0) this.onWorldEvent('🚀 ПУСК БАЛЛИСТИЧЕСКОЙ РАКЕТЫ!', '#ff3d00');
  }
  public spawnFpvDrone(targetX: number, targetY: number, sourceKingdom: number): void {
    if (this.droneCount >= MAX_DRONES) return;
    const i = this.droneCount++;
    // spawn 12 tiles behind target direction (random)
    const ang = Math.random()*Math.PI*2;
    const sx = targetX + Math.cos(ang)*14;
    const sy = targetY + Math.sin(ang)*14;
    const sIdx = Math.max(0, Math.min(WORLD_H-1, sy|0))*WORLD_W + Math.max(0, Math.min(WORLD_W-1, sx|0));
    const surf = this.world.surfaceHeight(sIdx);
    this.drx[i]=sx; this.dry[i]=sy; this.drz[i]=surf+5.5;
    this.drvx[i]=0; this.drvy[i]=0;
    this.drTargetX[i]=targetX; this.drTargetY[i]=targetY; this.drLife[i]=9.0; this.drKingdom[i]=sourceKingdom;
    this.sfx.playUiClick(620);
  }

  public spawnReconUav(gx: number, gy: number): void {
    if (this.droneCount >= MAX_DRONES) return;
    const i = this.droneCount++;
    const sIdx = Math.max(0, Math.min(WORLD_H - 1, gy | 0)) * WORLD_W + Math.max(0, Math.min(WORLD_W - 1, gx | 0));
    this.drx[i] = gx;
    this.dry[i] = gy;
    this.drz[i] = this.world.surfaceHeight(sIdx) + 18;
    this.drvx[i] = 0;
    this.drvy[i] = 0;
    this.drTargetX[i] = gx;
    this.drTargetY[i] = gy;
    this.drLife[i] = 26.0; // long loiter recon UAV
    this.drKingdom[i] = 0;
    this.sfx.playUiClick(760);
    if (this.onWorldEvent) this.onWorldEvent('🛰 Разведчик в воздухе: вскрывает мины и позиции врага!', '#b388ff');
  }

  public spawnArtilleryShell(targetX: number, targetY: number, kind: number): void {
    // 0 = mortar (high arc), 1 = howitzer (fast flat)
    if (this.missileCount >= MAX_MISSILES) return;
    const i = this.missileCount++;
    const sx = targetX + (Math.random() - 0.5) * 26 - 4;
    const sy = targetY + (Math.random() - 0.5) * 26 - 26;
    const sIdx = Math.max(0, Math.min(WORLD_H - 1, sy | 0)) * WORLD_W + Math.max(0, Math.min(WORLD_W - 1, sx | 0));
    const surf = this.world.surfaceHeight(sIdx);
    const flightTime = kind === 0 ? 1.9 : 1.15;
    this.msx[i] = sx;
    this.msy[i] = sy;
    this.msz[i] = surf + (kind === 0 ? 30 : 22);
    this.msvx[i] = (targetX - sx) / flightTime;
    this.msvy[i] = (targetY - sy) / flightTime;
    this.msvz[i] = kind === 0 ? 34 : 24;
    this.mstx[i] = targetX;
    this.msty[i] = targetY;
    this.msPower[i] = kind === 0 ? 0.72 : 1.05;
    this.msKind[i] = kind === 0 ? 4 : 5; // 4 = mortar, 5 = howitzer
    this.msKingdom[i] = 0;
    this.sfx.playFireCrackle();
  }

  public spawnCruiseMissile(targetX: number, targetY: number, sourceKingdom: number): void {
    this.spawnBallisticMissile(targetX, targetY, sourceKingdom, 1, 1.15);
  }

  public triggerLightning(
    cx: number,
    cy: number,
    emitter: ExplosionParticleEmitter,
    partEmber: number,
    partSmoke: number,
  ): void {
    this.lightningBolts.push({ x: cx, y: cy, life: 0.28, seed: Math.random() * 1000 });
    this.screenShake = Math.min(12, this.screenShake + 5.5);
    this.sfx.playExplosion(0.95);

    const W = WORLD_W;
    const H = WORLD_H;
    const r = 5.5;
    for (let y = Math.max(1, (cy - r) | 0); y <= Math.min(H - 2, (cy + r) | 0); y++) {
      for (let x = Math.max(1, (cx - r) | 0); x <= Math.min(W - 2, (cx + r) | 0); x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d > r) continue;
        const idx = y * W + x;
        // Melt beach sand directly into crystal glass (fulgurite)!
        if (this.world.sand[idx] > 0.12 && d < 3.5) {
          const melt = Math.min(this.world.sand[idx], 0.9);
          this.world.sand[idx] -= melt;
          this.world.glass[idx] += melt;
        }
        if (this.world.water[idx] < 0.04 && d < 3.8) {
          this.world.fire[idx] = Math.max(this.world.fire[idx], 1.25);
        }
        if (this.world.tnt[idx] > 0.02 || this.world.gunpowder[idx] > 0.02) {
          this.world.fuse[idx] = 0.03;
        }
      }
    }

    for (let i = 0; i < this.humanCount; i++) {
      const d = Math.hypot(this.hx[i] - cx, this.hy[i] - cy);
      if (d < 6.5) {
        this.hHp[i] -= 85 * (1 - d / 7.5);
        this.hvz[i] = 16;
      }
    }

    const baseIdx = Math.max(0, Math.min(H - 1, cy | 0)) * W + Math.max(0, Math.min(W - 1, cx | 0));
    const z0 = this.world.surfaceHeight(baseIdx) + 1;
    for (let k = 0; k < 22; k++) {
      const a = Math.random() * Math.PI * 2;
      emitter.emitDebris(
        k % 3 === 0 ? partSmoke : partEmber,
        cx,
        cy,
        z0,
        Math.cos(a) * (8 + Math.random() * 14),
        Math.sin(a) * (8 + Math.random() * 14),
        12 + Math.random() * 18,
        0,
      );
    }
  }

  public triggerTsarBomba(
    cx: number,
    cy: number,
    emitter: ExplosionParticleEmitter,
    partStone: number,
    partSand: number,
    partEmber: number,
    partSmoke: number,
  ): void {
    this.nukeClouds.push({ x: cx, y: cy, age: 0, maxAge: 6.5 });
    this.detonateExplosion(
      cx,
      cy,
      26.0,
      3.2,
      true,
      emitter,
      partStone,
      partSand,
      partEmber,
      partSmoke,
    );
    if (this.onWorldEvent) {
      this.onWorldEvent('☢ Сброшена Царь-Бомба! Гигантский ядерный взрыв!', '#ffe066');
    }
  }

  public detonateExplosion(
    cx: number,
    cy: number,
    radius: number,
    power: number,
    spawnLava: boolean,
    emitter: ExplosionParticleEmitter,
    partStone: number,
    partSand: number,
    partEmber: number,
    partSmoke: number,
  ): void {
    const W = WORLD_W;
    const H = WORLD_H;
    const rCeil = Math.ceil(radius);

    this.sfx.playExplosion(power);
    this.screenShake = Math.min(18, this.screenShake + 4.5 * power);

    const blastR = radius * 1.45;
    for (let i = 0; i < this.humanCount; i++) {
      const dx = this.hx[i] - cx;
      const dy = this.hy[i] - cy;
      const d = Math.hypot(dx, dy);
      if (d < radius * 0.65) {
        this.hHp[i] = -999;
      } else if (d < blastR) {
        const f = 1.0 - d / blastR;
        this.hHp[i] -= 75 * f * power;
        this.hvz[i] = 14 + f * 20;
        const inv = d > 0.01 ? 1 / d : 0;
        this.hTargetX[i] = Math.max(2, Math.min(W - 3, this.hx[i] + dx * inv * 12));
        this.hTargetY[i] = Math.max(2, Math.min(H - 3, this.hy[i] + dy * inv * 12));
      }
    }

    for (let y = Math.max(1, Math.floor(cy - rCeil)); y <= Math.min(H - 2, Math.ceil(cy + rCeil)); y++) {
      for (let x = Math.max(1, Math.floor(cx - rCeil)); x <= Math.min(W - 2, Math.ceil(cx + rCeil)); x++) {
        const dx = x - cx;
        const dy = y - cy;
        const d = Math.hypot(dx, dy);
        if (d > radius) continue;

        const idx = y * W + x;
        const norm = 1.0 - (d / radius) * (d / radius);
        const carve = norm * 2.85 * power;

        this.world.flora[idx] = 0;
        this.world.treeHp[idx] = 0;
        this.world.road[idx] = 0;
        this.world.snowCover[idx] = 0;
        if (this.world.ice[idx] > 0) {
          this.world.water[idx] += this.world.ice[idx];
          this.world.ice[idx] = 0;
        }
        if (this.world.buildings[idx] !== 0) {
          this.world.buildings[idx] = 0;
          this.world.buildingHp[idx] = 0;
          this.world.buildingSettlement[idx] = 0;
          this.world.fire[idx] = 1.2;
        }

        if (this.world.tnt[idx] > 0.02 || this.world.gunpowder[idx] > 0.02) {
          if (d < 1.8) {
            this.world.tnt[idx] = 0;
            this.world.gunpowder[idx] = 0;
            this.world.fuse[idx] = 0;
          } else if (this.world.fuse[idx] <= 0) {
            this.world.fuse[idx] = 0.04 + (d / radius) * 0.12;
          }
        }

        let rem = carve;
        const takeSand = Math.min(this.world.sand[idx], rem);
        this.world.sand[idx] -= takeSand;
        rem -= takeSand;

        const takeGlass = Math.min(this.world.glass[idx], rem);
        this.world.glass[idx] -= takeGlass;
        rem -= takeGlass;

        const takeStone = Math.min(this.world.stone[idx], rem * 0.8);
        this.world.stone[idx] -= takeStone;
        rem -= takeStone;

        if (rem > 0) {
          this.world.soil[idx] = Math.max(0.45, this.world.soil[idx] - rem * 0.85);
        }

        this.world.grass[idx] = Math.max(0, this.world.grass[idx] - norm * 1.4);
        this.world.ash[idx] = Math.min(1.0, this.world.ash[idx] + norm * 0.95);

        if (spawnLava && d < radius * 0.42 && this.world.water[idx] < 0.4) {
          this.world.lava[idx] += (1.0 - d / (radius * 0.42)) * 1.15;
        } else if (d > radius * 0.55 && this.world.water[idx] < 0.05 && Math.random() < 0.45) {
          this.world.fire[idx] = Math.max(this.world.fire[idx], 0.95);
        }

        if (this.world.water[idx] > 0.05 && d > 0.2) {
          const push = (1.0 - d / radius) * 26.0 * power;
          const nx = dx / d;
          const ny = dy / d;
          if (nx < 0) this.world.fluxL[idx] += -nx * push;
          else this.world.fluxR[idx] += nx * push;
          if (ny < 0) this.world.fluxU[idx] += -ny * push;
          else this.world.fluxD[idx] += ny * push;
          this.world.foam[idx] = 1.0;
        }
      }
    }

    const baseIdx =
      Math.max(0, Math.min(H - 1, cy | 0)) * W + Math.max(0, Math.min(W - 1, cx | 0));
    const baseZ = this.world.surfaceHeight(baseIdx);
    const debrisCount = Math.min(95, Math.round(28 * power));

    for (let k = 0; k < debrisCount; k++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = (9 + Math.random() * 26) * power;
      const roll = Math.random();
      const pType =
        roll < 0.25 ? partStone : roll < 0.45 ? partSand : roll < 0.8 ? partEmber : partSmoke;
      const mass = pType === partStone ? 0.32 : pType === partSand ? 0.22 : 0;
      const upVel =
        pType === partSmoke
          ? 9 + Math.random() * 12
          : (18 + Math.random() * 26) * Math.min(1.5, power);

      emitter.emitDebris(
        pType,
        cx + (Math.random() - 0.5) * 3,
        cy + (Math.random() - 0.5) * 3,
        baseZ + 1.2,
        Math.cos(ang) * (pType === partSmoke ? spd * 0.25 : spd),
        Math.sin(ang) * (pType === partSmoke ? spd * 0.25 : spd),
        upVel,
        mass,
      );
    }

    this.recomputeTerritories();
  }

  public update(
    dt: number,
    emitter: ExplosionParticleEmitter,
    partStone: number,
    partSand: number,
    partEmber: number,
    partSmoke: number,
    partWoodChip: number,
    partLeaf: number,
  ): void {
    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - 28.0 * dt);
    }

    // Update Lightning Flashes & Nuke Mushroom Clouds
    for (let i = this.lightningBolts.length - 1; i >= 0; i--) {
      this.lightningBolts[i].life -= dt;
      if (this.lightningBolts[i].life <= 0) this.lightningBolts.splice(i, 1);
    }
    for (let i = this.nukeClouds.length - 1; i >= 0; i--) {
      this.nukeClouds[i].age += dt;
      if (this.nukeClouds[i].age >= this.nukeClouds[i].maxAge) this.nukeClouds.splice(i, 1);
    }

    // Military diplomacy & auto missile launches!
    this.autoDiplomacyTimer -= dt;
    if (this.autoDiplomacyTimer <= 0) {
      this.autoDiplomacyTimer = 20.0 + Math.random() * 12.0;
      const grownKingdoms = Array.from(
        new Set(
          this.settlements
            .filter((s) => s.active && (s.buildings >= 3 || s.population >= 5))
            .map((s) => s.kingdom),
        ),
      );
      // Дипломатия: общий враг скрепляет союзы (enemy of my enemy)!
      for (let a = 0; a < 6; a++) {
        for (let b = a + 1; b < 6; b++) {
          if (this.warMatrix[a * 6 + b] === 1) continue;
          if (this.allyMatrix[a * 6 + b] === 1) continue;
          let commonEnemy = false;
          for (let c = 0; c < 6; c++) {
            if (this.warMatrix[a * 6 + c] === 1 && this.warMatrix[b * 6 + c] === 1) {
              commonEnemy = true;
              break;
            }
          }
          if (commonEnemy && Math.random() < 0.6) {
            this.setAllianceState(a, b, true);
          }
        }
      }

      if (grownKingdoms.length >= 2 && this.activeWarsCount === 0 && Math.random()<0.7) {
        const idxA = (Math.random() * grownKingdoms.length) | 0;
        let idxB = (Math.random() * grownKingdoms.length) | 0;
        if (idxB === idxA) idxB = (idxA + 1) % grownKingdoms.length;
        this.setWarState(grownKingdoms[idxA], grownKingdoms[idxB], true);
      }

      // Оккупированные провинции поднимают восстание и возвращают независимость!
      for (const s of this.settlements) {
        if (!s.active || s.annexedBy === 0) continue;
        s.rebelTimer -= 20.0;
        if (s.rebelTimer <= 0 && s.population >= 2) {
          const occupier = s.annexedBy;
          s.annexedBy = 0;
          s.rebelTimer = 0;
          // Восставшие возвращают себе ШТАБ и объявляют войну оккупанту
          const capIdx = s.centerY * WORLD_W + s.centerX;
          if (this.world.buildings[capIdx] === 3) {
            this.world.buildingKingdom[capIdx] = s.kingdom;
            this.world.buildingSettlement[capIdx] = s.id;
            this.world.buildingHp[capIdx] = 300;
          }
          this.setWarState(s.kingdom, occupier, true);
          if (this.onWorldEvent) {
            this.onWorldEvent(`🔥 ВОССТАНИЕ! ${s.name} вернул себе ШТАБ и снова воюет!`, '#ff922b');
          }
        }
      }

      // Воюющие стороны сами наносят ракетные и дроновые удары!
      if (this.activeWarsCount > 0) {
        const warPairs: [number, number][] = [];
        for (let a = 0; a < 6; a++) {
          for (let b = a + 1; b < 6; b++) {
            if (this.warMatrix[a * 6 + b] === 1) warPairs.push([a, b]);
          }
        }
        if (warPairs.length > 0) {
          const pair = warPairs[(Math.random() * warPairs.length) | 0];
          const flip = Math.random() < 0.5;
          const atkK = flip ? pair[1] : pair[0];
          const defK = flip ? pair[0] : pair[1];
          const attacker = this.settlements.find((s) => s.active && s.kingdom === atkK);
          const defender = this.settlements.find((s) => s.active && s.kingdom === defK);

          if (attacker && defender) {
            // Баллистика / «Калибр» по вражеской базе
            if (this.missileCount < 5 && Math.random() < 0.75) {
              this.spawnBallisticMissile(
                defender.centerX + (Math.random() - 0.5) * 6,
                defender.centerY + (Math.random() - 0.5) * 6,
                atkK,
                Math.random() < 0.55 ? 0 : 1,
                1.0 + Math.random() * 0.7,
              );
            }
            // Рой FPV-камикадзе по передовой
            if (this.droneCount < 10 && Math.random() < 0.8) {
              const swarm = 1 + ((Math.random() * 3) | 0);
              for (let k = 0; k < swarm; k++) {
                this.spawnFpvDrone(
                  defender.centerX + (Math.random() - 0.5) * 9,
                  defender.centerY + (Math.random() - 0.5) * 9,
                  atkK,
                );
              }
            }
            // Артиллерийский налёт
            if (Math.random() < 0.6) {
              const shots = 1 + ((Math.random() * 3) | 0);
              for (let k = 0; k < shots; k++) {
                this.spawnArtilleryShell(
                  defender.centerX + (Math.random() - 0.5) * 12,
                  defender.centerY + (Math.random() - 0.5) * 12,
                  Math.random() < 0.5 ? 0 : 1,
                );
              }
            }
          }
        }
      }
    }

    this.updateMeteors(dt, emitter, partStone, partSand, partEmber, partSmoke);
    this.updateMissiles(dt, emitter, partStone, partSand, partEmber, partSmoke);
    this.updateDrones(dt, emitter, partStone, partSand, partEmber, partSmoke);
    this.updateDragons(dt, emitter, partEmber, partSmoke);
    this.rebuildUnitGrid();
    this.updateArrows(dt, emitter, partEmber);
    this.updateTowerDefenses(dt);
    this.updatePvoInterceptors(dt);
    this.updateUnits(dt, emitter, partWoodChip, partLeaf, partEmber);

    this.territoryTick++;
    if (this.territoryTick >= 15) {
      this.territoryTick = 0;
      this.recomputeTerritories();
    }
  }

  private updateTowerDefenses(dt: number): void {
    this.towerDefenseTick += dt;
    if (this.towerDefenseTick < 0.85) return;
    this.towerDefenseTick = 0;

    if ((this.humanCount === 0 && this.dragonCount === 0) || this.towerCount === 0) return;

    const W = WORLD_W;
    for (let t = 0; t < this.towerCount; t++) {
      const i = this.towerIndices[t];
      const b = this.world.buildings[i];
      if (b !== 5 && b !== 3 && b !== BUILDING_BASE) continue;
      const tk = this.world.buildingKingdom[i];
      const tx = (i % W) + 0.5;
      const ty = ((i / W) | 0) + 0.5;
      const tz = this.world.surfaceHeight(i) + 2.5;

      let shot = false;
      for (let d = 0; d < this.dragonCount; d++) {
        const ddx = this.dx[d] - tx;
        const ddy = this.dy[d] - ty;
        if (ddx * ddx + ddy * ddy < 676) {
          this.fireArrow(tx, ty, tz, this.dx[d], this.dy[d], this.dz[d], tk, 28);
          shot = true;
          break;
        }
      }
      if (shot) continue;

      const cx0 = Math.max(0, ((tx - 20) * 0.125) | 0);
      const cx1 = Math.min(39, ((tx + 20) * 0.125) | 0);
      const cy0 = Math.max(0, ((ty - 20) * 0.125) | 0);
      const cy1 = Math.min(24, ((ty + 20) * 0.125) | 0);
      for (let cy = cy0; cy <= cy1 && !shot; cy++) {
        const row = cy * 40;
        for (let cx = cx0; cx <= cx1; cx++) {
          let h = this.gridHead[row + cx];
          while (h >= 0) {
            const hk = this.hKingdom[h];
            if (hk !== 8 && this.isKingdomsAtWar(tk, hk)) {
              const ddx = this.hx[h] - tx;
              const ddy = this.hy[h] - ty;
              if (ddx * ddx + ddy * ddy < 400) {
                this.fireArrow(tx, ty, tz, this.hx[h], this.hy[h], this.hz[h], tk, 20);
                shot = true;
                break;
              }
            }
            h = this.gridNext[h];
          }
          if (shot) break;
        }
      }
    }
  }

  private updateArrows(
    dt: number,
    emitter: ExplosionParticleEmitter,
    partEmber: number,
  ): void {
    let write = 0;
    for (let i = 0; i < this.arrowCount; i++) {
      this.ax[i] += this.avx[i] * dt;
      this.ay[i] += this.avy[i] * dt;
      this.az[i] += this.avz[i] * dt;
      this.avz[i] -= 34.0 * dt;

      const x = this.ax[i];
      const y = this.ay[i];
      const z = this.az[i];
      if (x < 1 || x >= WORLD_W - 1 || y < 1 || y >= WORLD_H - 1) continue;

      let hit = false;
      const ak = this.aKingdom[i];

      for (let d = 0; d < this.dragonCount; d++) {
        const ddx = this.dx[d] - x;
        const ddy = this.dy[d] - y;
        if (ddx * ddx + ddy * ddy < 11.56 && Math.abs(this.dz[d] - z) < 6.0) {
          this.dHp[d] -= this.aDmg[i];
          emitter.emitDebris(partEmber, x, y, z, 0, 0, 5, 0);
          hit = true;
          break;
        }
      }

      if (!hit) {
        const cx0 = Math.max(0, ((x - 2) * 0.125) | 0);
        const cx1 = Math.min(39, ((x + 2) * 0.125) | 0);
        const cy0 = Math.max(0, ((y - 2) * 0.125) | 0);
        const cy1 = Math.min(24, ((y + 2) * 0.125) | 0);
        for (let cy = cy0; cy <= cy1 && !hit; cy++) {
          const row = cy * 40;
          for (let cx = cx0; cx <= cx1; cx++) {
            let h = this.gridHead[row + cx];
            while (h >= 0) {
              const hk = this.hKingdom[h];
              if (hk !== 8 && this.isKingdomsAtWar(ak, hk)) {
                const ddx = this.hx[h] - x;
                const ddy = this.hy[h] - y;
                if (ddx * ddx + ddy * ddy < 1.8225) {
                  const mult = this.hRole[h] === ROLE_ZOMBIE ? 0.3 : 1.0;
                  this.hHp[h] -= this.aDmg[i] * mult;
                  hit = true;
                  break;
                }
              }
              h = this.gridNext[h];
            }
            if (hit) break;
          }
        }
      }

      const surf = this.world.surfaceHeight((y | 0) * WORLD_W + (x | 0));
      if (hit || z <= surf) continue;

      this.ax[write] = x;
      this.ay[write] = y;
      this.az[write] = z;
      this.avx[write] = this.avx[i];
      this.avy[write] = this.avy[i];
      this.avz[write] = this.avz[i];
      this.aKingdom[write] = ak;
      this.aDmg[write] = this.aDmg[i];
      write++;
    }
    this.arrowCount = write;
  }

  private updateDragons(
    dt: number,
    emitter: ExplosionParticleEmitter,
    partEmber: number,
    partSmoke: number,
  ): void {
    let write = 0;
    for (let i = 0; i < this.dragonCount; i++) {
      if (this.dHp[i] <= 0) {
        this.sfx.playExplosion(1.1);
        for (let k = 0; k < 25; k++) {
          const a = Math.random() * Math.PI * 2;
          emitter.emitDebris(
            k % 2 === 0 ? partEmber : partSmoke,
            this.dx[i],
            this.dy[i],
            this.dz[i],
            Math.cos(a) * 14,
            Math.sin(a) * 14,
            8 + Math.random() * 14,
            0,
          );
        }
        if (this.onWorldEvent) {
          this.onWorldEvent('🐉 Огненный дракон повержен защитниками!', '#ffd43b');
        }
        continue;
      }

      // Steer loosely toward nearest active settlement or center of map
      let tx = WORLD_W * 0.5;
      let ty = WORLD_H * 0.5;
      if (this.settlements.length > 0) {
        const s = this.settlements[(i + ((performance.now() / 6000) | 0)) % this.settlements.length];
        if (s && s.active) {
          tx = s.centerX;
          ty = s.centerY;
        }
      }
      const ddx = tx - this.dx[i];
      const ddy = ty - this.dy[i];
      const len = Math.max(1, Math.hypot(ddx, ddy));
      this.dvx[i] += ((ddx / len) * 16 - this.dvx[i]) * 0.85 * dt;
      this.dvy[i] += ((ddy / len) * 16 - this.dvy[i]) * 0.85 * dt;

      this.dx[i] += this.dvx[i] * dt;
      this.dy[i] += this.dvy[i] * dt;

      const gx = Math.max(1, Math.min(WORLD_W - 2, this.dx[i] | 0));
      const gy = Math.max(1, Math.min(WORLD_H - 2, this.dy[i] | 0));
      const gIdx = gy * WORLD_W + gx;
      const targetZ = this.world.surfaceHeight(gIdx) + 14.0;
      this.dz[i] += (targetZ - this.dz[i]) * 3.0 * dt;

      // Breathe focused dragonfire bursts when near settlements or units (no endless continent fire!)
      this.dBreathTimer[i] -= dt;
      if (this.dBreathTimer[i] <= 0) {
        this.dBreathTimer[i] = 0.24;
        if (this.world.water[gIdx] < 0.08 && len < 26) {
          this.world.fire[gIdx] = Math.max(this.world.fire[gIdx], 0.9);
          emitter.emitDebris(
            partEmber,
            this.dx[i] + this.dvx[i] * 0.12,
            this.dy[i] + this.dvy[i] * 0.12,
            this.dz[i] - 2,
            this.dvx[i] * 0.9,
            this.dvy[i] * 0.9,
            -22,
            0,
          );
        }
      }

      this.dx[write] = this.dx[i];
      this.dy[write] = this.dy[i];
      this.dz[write] = this.dz[i];
      this.dvx[write] = this.dvx[i];
      this.dvy[write] = this.dvy[i];
      this.dHp[write] = this.dHp[i];
      this.dMaxHp[write] = this.dMaxHp[i];
      this.dBreathTimer[write] = this.dBreathTimer[i];
      write++;
    }
    this.dragonCount = write;
  }

  private updateMissiles(
    dt: number,
    emitter: ExplosionParticleEmitter,
    partStone: number,
    partSand: number,
    partEmber: number,
    partSmoke: number,
  ): void {
    let write=0;
    for(let i=0;i<this.missileCount;i++){
      const kind=this.msKind[i];
      // ballistic has gravity arc, cruise low
      if(kind===0){ this.msvz[i]-= 52*dt; } // ballistic gravity
      else if(kind===1){ this.msvz[i]+= (2 - this.msvz[i])*2*dt; } // cruise level
      else if(kind===4 || kind===5){ this.msvz[i]-= 32*dt; }
      else { this.msvz[i]-= 34*dt; }
      this.msx[i]+=this.msvx[i]*dt;
      this.msy[i]+=this.msvy[i]*dt;
      this.msz[i]+=this.msvz[i]*dt;
      const gx = Math.max(0, Math.min(WORLD_W-1, this.msx[i]|0));
      const gy = Math.max(0, Math.min(WORLD_H-1, this.msy[i]|0));
      const surf = this.world.surfaceHeight(gy*WORLD_W+gx);
      // smoke trail
      if(Math.random()<0.7) emitter.emitDebris(partSmoke, this.msx[i], this.msy[i], this.msz[i], (Math.random()-0.5)*2, (Math.random()-0.5)*2, -1, 0);
      if(kind===1){
        // cruise terrain hugging - keep 4-6 above ground
        const targetAlt = surf+5;
        this.msz[i] += (targetAlt - this.msz[i])*4*dt;
      }
      // Check PVO intercept - will be handled in updatePvoInterceptors but also direct hit check
      // Ground impact
      if(this.msz[i] <= surf+0.6){
        const power = this.msPower[i];
        const radius = kind===0 ? 16*power : kind===1 ? 11*power : kind===2 ? 13*power : kind===4 ? 7*power : kind===5 ? 10*power : 8*power;
        const spawnLava = kind===0;
        this.detonateExplosion(this.msx[i], this.msy[i], radius, power*1.4, spawnLava, emitter, partStone, partSand, partEmber, partSmoke);
        // pixel debris for buildings
        for(let k=0;k<18;k++) emitter.emitDebris(partStone, this.msx[i]+(Math.random()-0.5)*4, this.msy[i]+(Math.random()-0.5)*4, surf+1, (Math.random()-0.5)*18, (Math.random()-0.5)*18, 14+Math.random()*12, 0.2);
        continue;
      }
      // keep
      this.msx[write]=this.msx[i]; this.msy[write]=this.msy[i]; this.msz[write]=this.msz[i];
      this.msvx[write]=this.msvx[i]; this.msvy[write]=this.msvy[i]; this.msvz[write]=this.msvz[i];
      this.mstx[write]=this.mstx[i]; this.msty[write]=this.msty[i]; this.msPower[write]=this.msPower[i]; this.msKind[write]=kind; this.msKingdom[write]=this.msKingdom[i];
      write++;
    }
    this.missileCount=write;
  }
  private updateDrones(
    dt: number,
    emitter: ExplosionParticleEmitter,
    partStone: number,
    partSand: number,
    partEmber: number,
    partSmoke: number,
  ): void {
    let write=0;
    for(let i=0;i<this.droneCount;i++){
      this.drLife[i]-=dt;
      if(this.drLife[i]<=0){ // self destruct
        const gx=Math.max(0,Math.min(WORLD_W-1,this.drx[i]|0)); const gy=Math.max(0,Math.min(WORLD_H-1,this.dry[i]|0)); const surf=this.world.surfaceHeight(gy*WORLD_W+gx);
        this.detonateExplosion(this.drx[i],this.dry[i], 4.5, 0.7, false, emitter, partStone, partSand, partEmber, partSmoke);
        continue;
      }
      const tx=this.drTargetX[i], ty=this.drTargetY[i];
      const dx=tx - this.drx[i], dy=ty - this.dry[i];
      const dist=Math.hypot(dx,dy);
      // homing with slight wobble
      const targetVx = dist>0.5 ? (dx/dist)*18 : 0;
      const targetVy = dist>0.5 ? (dy/dist)*18 : 0;
      this.drvx[i] += (targetVx - this.drvx[i])*3.5*dt;
      this.drvy[i] += (targetVy - this.drvy[i])*3.5*dt;
      // add wobble for realism
      this.drvx[i] += Math.sin(performance.now()*0.01 + i)*0.3*dt;
      this.drx[i]+=this.drvx[i]*dt;
      this.dry[i]+=this.drvy[i]*dt;
      // keep altitude low over terrain
      const gx=Math.max(0,Math.min(WORLD_W-1,this.drx[i]|0)); const gy=Math.max(0,Math.min(WORLD_H-1,this.dry[i]|0));
      const surf=this.world.surfaceHeight(gy*WORLD_W+gx);
      this.drz[i] += (surf+3.2 - this.drz[i])*6*dt;
      // prop wash dust
      if(Math.random()<0.4) emitter.emitDebris(partSmoke, this.drx[i], this.dry[i], this.drz[i]-1, (Math.random()-0.5)*3, (Math.random()-0.5)*3, 1, 0);
      // impact check - within 1.2 of target or building hit
      const idx = gy*WORLD_W+gx;
      const isBuilding = this.world.buildings[idx]!==0 && this.world.buildings[idx]!==BUILDING_RUINS;
      if(dist<1.4 || isBuilding){
        this.detonateExplosion(this.drx[i], this.dry[i], 6.2, 0.95, false, emitter, partStone, partSand, partEmber, partSmoke);
        // camera shake small
        this.screenShake = Math.min(12, this.screenShake+3);
        continue;
      }
      // keep
      this.drx[write]=this.drx[i]; this.dry[write]=this.dry[i]; this.drz[write]=this.drz[i];
      this.drvx[write]=this.drvx[i]; this.drvy[write]=this.drvy[i];
      this.drTargetX[write]=this.drTargetX[i]; this.drTargetY[write]=this.drTargetY[i];
      this.drLife[write]=this.drLife[i]; this.drKingdom[write]=this.drKingdom[i];
      write++;
    }
    this.droneCount=write;
  }
  private updatePvoInterceptors(dt: number): void {
    if(this.missileCount===0 && this.droneCount===0) return;
    // Each PVO tower can fire every 0.9s
    this.towerDefenseTick += dt;
    // Reuse towerDefenseTick for PVO as well
    // Actually we handle separate timing via arrow cooldown already - use simple scan every 0.6s
    if(this.towerDefenseTick<0.55) return;
    // Scan PVO buildings
    const W=WORLD_W;
    for(let ti=0; ti<this.towerCount; ti++){
      const idx=this.towerIndices[ti];
      const b=this.world.buildings[idx];
      if(b!==5 && b!==BUILDING_SILO && b!==BUILDING_RADAR) continue; // only PVO/silo/radar intercept
      const tk=this.world.buildingKingdom[idx];
      const tx=(idx%W)+0.5, ty=((idx/W)|0)+0.5;
      // check missiles
      for(let m=0;m<this.missileCount;m++){
        if(this.msKingdom[m]===tk) continue;
        const ddx=this.msx[m]-tx, ddy=this.msy[m]-ty;
        if(ddx*ddx+ddy*ddy < 28*28){
          // fire interceptor arrow
          const tz=this.msz[m];
          this.fireArrow(tx,ty,this.world.surfaceHeight(idx)+4, this.msx[m], this.msy[m], tz, tk, 90);
          // 30% chance to instantly destroy for gameplay feel (PVO effective)
          if(Math.random()<0.18){
            // airburst
            this.msz[m]= this.world.surfaceHeight(((this.msy[m]|0)*W + (this.msx[m]|0)))+8; // mark for explosion next tick
            // create intercept explosion mid-air
            // we can just remove missile and create small airburst
            // swap with last
            this.missileCount--; // will be cleaned up but simple remove by swapping
            for(let k=m;k<this.missileCount;k++){ this.msx[k]=this.msx[k+1]; this.msy[k]=this.msy[k+1]; this.msz[k]=this.msz[k+1]; this.msvx[k]=this.msvx[k+1]; this.msvy[k]=this.msvy[k+1]; this.msvz[k]=this.msvz[k+1]; this.mstx[k]=this.mstx[k+1]; this.msty[k]=this.msty[k+1]; this.msPower[k]=this.msPower[k+1]; this.msKind[k]=this.msKind[k+1]; this.msKingdom[k]=this.msKingdom[k+1];}
            if(this.onWorldEvent && Math.random()<0.3) this.onWorldEvent(`🛡 ПВО ${this.getSettlementById(this.world.buildingSettlement[idx])?.name || ''} сбило ракету!`, '#4fc3f7');
            this.towerDefenseTick=0;
            return;
          }
        }
      }
      // check drones
      for(let d=0; d<this.droneCount; d++){
        if(this.drKingdom[d]===tk) continue;
        const ddx=this.drx[d]-tx, ddy=this.dry[d]-ty;
        if(ddx*ddx+ddy*ddy < 22*22){
          this.fireArrow(tx,ty,this.world.surfaceHeight(idx)+4, this.drx[d], this.dry[d], this.drz[d], tk, 70);
          if(Math.random()<0.22){
            this.droneCount--;
            for(let k=d;k<this.droneCount;k++){ this.drx[k]=this.drx[k+1]; this.dry[k]=this.dry[k+1]; this.drz[k]=this.drz[k+1]; this.drvx[k]=this.drvx[k+1]; this.drvy[k]=this.drvy[k+1]; this.drTargetX[k]=this.drTargetX[k+1]; this.drTargetY[k]=this.drTargetY[k+1]; this.drLife[k]=this.drLife[k+1]; this.drKingdom[k]=this.drKingdom[k+1];}
            if(this.onWorldEvent && Math.random()<0.3) this.onWorldEvent(`🛡 ПВО сбило FPV-дрон!`, '#4fc3f7');
            this.towerDefenseTick=0;
            return;
          }
        }
      }
    }
  }

  private updateMeteors(
    dt: number,
    emitter: ExplosionParticleEmitter,
    partStone: number,
    partSand: number,
    partEmber: number,
    partSmoke: number,
  ): void {
    let write = 0;
    for (let i = 0; i < this.meteorCount; i++) {
      this.mx[i] += this.mvx[i] * dt;
      this.my[i] += this.mvy[i] * dt;
      this.mz[i] += this.mvz[i] * dt;

      const gx = Math.max(0, Math.min(WORLD_W - 1, this.mx[i] | 0));
      const gy = Math.max(0, Math.min(WORLD_H - 1, this.my[i] | 0));
      const surf = this.world.surfaceHeight(gy * WORLD_W + gx);

      emitter.emitDebris(
        partEmber,
        this.mx[i] + (Math.random() - 0.5) * 2,
        this.my[i] + (Math.random() - 0.5) * 2,
        this.mz[i],
        (Math.random() - 0.5) * 5,
        (Math.random() - 0.5) * 5,
        2 + Math.random() * 5,
        0,
      );
      if (Math.random() < 0.65) {
        emitter.emitDebris(
          partSmoke,
          this.mx[i],
          this.my[i],
          this.mz[i] + 1,
          (Math.random() - 0.5) * 3,
          (Math.random() - 0.5) * 3,
          6 + Math.random() * 6,
          0,
        );
      }

      if (this.mz[i] <= surf + 0.5) {
        const p = this.mPower[i];
        this.detonateExplosion(
          this.mx[i],
          this.my[i],
          10.5 * p,
          1.45 * p,
          true,
          emitter,
          partStone,
          partSand,
          partEmber,
          partSmoke,
        );
        continue;
      }

      this.mx[write] = this.mx[i];
      this.my[write] = this.my[i];
      this.mz[write] = this.mz[i];
      this.mvx[write] = this.mvx[i];
      this.mvy[write] = this.mvy[i];
      this.mvz[write] = this.mvz[i];
      this.mPower[write] = this.mPower[i];
      write++;
    }
    this.meteorCount = write;
  }

  private clearPlotForBuilding(cx: number, cy: number, clearRadius: number): void {
    const W = WORLD_W;
    const H = WORLD_H;
    for (let oy = -clearRadius; oy <= clearRadius; oy++) {
      for (let ox = -clearRadius; ox <= clearRadius; ox++) {
        const nx = cx + ox;
        const ny = cy + oy;
        if (nx < 1 || nx >= W - 1 || ny < 1 || ny >= H - 1) continue;
        const ni = ny * W + nx;
        if (this.world.flora[ni] >= 1 && this.world.flora[ni] <= 5) {
          this.world.flora[ni] = 0;
          this.world.treeHp[ni] = 0;
        }
        if (Math.hypot(ox, oy) <= clearRadius * 0.72) {
          this.world.road[ni] = Math.max(this.world.road[ni], 0.85);
        }
      }
    }
  }

  private layVillageRoad(x0: number, y0: number, x1: number, y1: number): void {
    const W = WORLD_W;
    const H = WORLD_H;
    const steps = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    if (steps > 42) return;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const rx = Math.round(x0 + (x1 - x0) * t + Math.sin(t * Math.PI) * 0.8);
      const ry = Math.round(y0 + (y1 - y0) * t);
      if (rx < 1 || rx >= W - 1 || ry < 1 || ry >= H - 1) continue;
      const idx = ry * W + rx;
      if (this.world.water[idx] <= 0.05 && this.world.lava[idx] <= 0.01) {
        this.world.road[idx] = Math.min(1.0, Math.max(this.world.road[idx], 0.92));
        if (this.world.flora[idx] >= 1 && this.world.flora[idx] <= 5) {
          this.world.flora[idx] = 0;
          this.world.treeHp[idx] = 0;
        }
      }
    }
  }

  private plantWheatAroundFarm(cx: number, cy: number): void {
    const W = WORLD_W;
    const H = WORLD_H;
    for (let oy = -4; oy <= 4; oy++) {
      for (let ox = -4; ox <= 4; ox++) {
        if (Math.abs(ox) <= 2 && Math.abs(oy) <= 2) continue;
        const nx = cx + ox;
        const ny = cy + oy;
        if (nx < 2 || nx >= W - 2 || ny < 2 || ny >= H - 2) continue;
        const ni = ny * W + nx;
        if (
          this.world.water[ni] <= 0.02 &&
          this.world.sand[ni] < 0.3 &&
          this.world.stone[ni] < 0.3 &&
          this.world.buildings[ni] === 0 &&
          this.world.road[ni] < 0.4 &&
          Math.random() < 0.72
        ) {
          this.world.flora[ni] = 6;
        }
      }
    }
  }

  private findGoodBuildPlot(
    centerX: number,
    centerY: number,
    settlementId: number,
  ): { bx: number; by: number } | null {
    const W = WORLD_W;
    const H = WORLD_H;
    for (let attempt = 0; attempt < 28; attempt++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = 5 + Math.random() * 19;
      const bx = Math.round(centerX + Math.cos(ang) * dist);
      const by = Math.round(centerY + Math.sin(ang) * dist);
      if (bx < 5 || bx >= W - 5 || by < 6 || by >= H - 5) continue;

      const idx = by * W + bx;
      const owner = this.world.territory[idx];
      if (owner !== 0 && owner !== settlementId) continue;

      if (
        this.world.water[idx] > 0.02 ||
        this.world.lava[idx] > 0.01 ||
        this.world.acid[idx] > 0.01 ||
        this.world.fire[idx] > 0.02 ||
        this.world.stone[idx] > 0.55
      ) {
        continue;
      }

      if (this.hasNoNearbyBuilding(bx, by, 5)) {
        return { bx, by };
      }
    }
    return null;
  }

  private findNearestTree(gx: number, gy: number, maxR: number): number {
    const W = WORLD_W;
    const H = WORLD_H;
    let bestIdx = -1;
    let bestD2 = maxR * maxR;

    for (let r = 2; r <= maxR; r += 3) {
      const yMin = Math.max(1, gy - r);
      const yMax = Math.min(H - 2, gy + r);
      const xMin = Math.max(1, gx - r);
      const xMax = Math.min(W - 2, gx + r);

      for (let y = yMin; y <= yMax; y += 2) {
        const row = y * W;
        for (let x = xMin; x <= xMax; x += 2) {
          const f = this.world.flora[row + x];
          if (f >= 1 && f <= 3) {
            const d2 = (x - gx) * (x - gx) + (y - gy) * (y - gy);
            if (d2 < bestD2) {
              bestD2 = d2;
              bestIdx = row + x;
            }
          }
        }
      }
      if (bestIdx >= 0) return bestIdx;
    }
    return bestIdx;
  }

  private isHostilePair(myRole: number, myK: number, otherRole: number, otherK: number): boolean {
    if (myRole === ROLE_WOLF) return otherRole === ROLE_SHEEP || otherRole === ROLE_ZOMBIE;
    if (myRole === ROLE_ZOMBIE) {
      return otherRole <= ROLE_ARCHER || otherRole === ROLE_SHEEP || otherRole === ROLE_WOLF;
    }
    if (otherRole === ROLE_SHEEP) return false;
    return this.isKingdomsAtWar(myK, otherK);
  }

  private findNearestEnemyUnit(i: number, x: number, y: number, maxRange: number): number {
    const myRole = this.hRole[i];
    if (myRole === ROLE_SHEEP) return -1;
    if (myRole === ROLE_ZOMBIE && this.livingPreyCount === 0) return -1;

    const myK = this.hKingdom[i];
    let best = -1;
    let bestD2 = maxRange * maxRange;

    const localR = maxRange <= 48 ? maxRange : 24;
    const localLim2 = localR * localR;
    const cx0 = Math.max(0, ((x - localR) * 0.125) | 0);
    const cx1 = Math.min(39, ((x + localR) * 0.125) | 0);
    const cy0 = Math.max(0, ((y - localR) * 0.125) | 0);
    const cy1 = Math.min(24, ((y + localR) * 0.125) | 0);

    let localBestD2 = maxRange <= 48 ? bestD2 : localLim2;
    for (let cy = cy0; cy <= cy1; cy++) {
      const row = cy * 40;
      for (let cx = cx0; cx <= cx1; cx++) {
        let j = this.gridHead[row + cx];
        while (j >= 0) {
          if (j !== i && this.hHp[j] > 0 && this.isHostilePair(myRole, myK, this.hRole[j], this.hKingdom[j])) {
            const ddx = this.hx[j] - x;
            const ddy = this.hy[j] - y;
            const d2 = ddx * ddx + ddy * ddy;
            if (d2 < localBestD2) {
              localBestD2 = d2;
              best = j;
            }
          }
          j = this.gridNext[j];
        }
      }
    }

    if (maxRange <= 48 || best >= 0) return best;

    for (let j = 0; j < this.humanCount; j++) {
      if (j === i || this.hHp[j] <= 0) continue;
      if (!this.isHostilePair(myRole, myK, this.hRole[j], this.hKingdom[j])) continue;
      const ddx = this.hx[j] - x;
      const ddy = this.hy[j] - y;
      const d2 = ddx * ddx + ddy * ddy;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = j;
      }
    }
    return best;
  }

  private findEnemySettlementCenter(myKingdom: number, x: number, y: number): Settlement | null {
    let best: Settlement | null = null;
    let bestD = 1e9;
    for (const s of this.settlements) {
      if (!s.active) continue;
      if (!this.isKingdomsAtWar(myKingdom, s.kingdom)) continue;
      const d = Math.hypot(s.centerX - x, s.centerY - y);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

  private updateUnits(
    dt: number,
    emitter: ExplosionParticleEmitter,
    partWoodChip: number,
    partLeaf: number,
    partEmber: number,
  ): void {
    const W = WORLD_W;
    const H = WORLD_H;

    this.aiPhase = (this.aiPhase + 1) & 3;
    for (const s of this.settlements) {
      s.population = 0;
    }

    let totalZombiesNow = 0;
    for (let i = 0; i < this.humanCount; i++) {
      if (this.hRole[i] === ROLE_ZOMBIE && this.hHp[i] > 0) totalZombiesNow++;
    }

    let write = 0;
    const pendingZombieSpawns: [number, number][] = [];

    for (let i = 0; i < this.humanCount; i++) {
      let x = this.hx[i];
      let y = this.hy[i];
      let z = this.hz[i];
      let vz = this.hvz[i];
      let hp = this.hHp[i];
      let maxHp = this.hMaxHp[i];
      let role = this.hRole[i];
      let kingdom = this.hKingdom[i];
      let sid = this.hSettlement[i];
      let infectedTimer = this.hInfected[i];

      const gx = Math.max(1, Math.min(W - 2, x | 0));
      const gy = Math.max(1, Math.min(H - 2, y | 0));
      const idx = gy * W + gx;

      const traits = this.hTraits[i];

      // Environmental, Fire, Regeneration & DROWNING (TRAIT_CANT_SWIM!) Damage
      const fireHurt = this.world.fire[idx] > 0.28 && (traits & TRAIT_PYROMANIAC) === 0;
      if (this.world.lava[idx] > 0.03 || fireHurt || this.world.acid[idx] > 0.025) {
        hp -= 95.0 * dt;
      }

      // Units who CANNOT SWIM (🌊 Не умеет плавать) panic & drown in deep flood / ocean water!
      if (
        role !== ROLE_SKELETON &&
        (traits & TRAIT_CANT_SWIM) !== 0 &&
        this.world.water[idx] > 0.34 &&
        this.world.ice[idx] < 0.12
      ) {
        hp -= 20.0 * dt;
        this.world.foam[idx] = Math.max(this.world.foam[idx], 0.65);
      }

      if ((traits & TRAIT_REGEN) !== 0 && hp > 0 && hp < maxHp) {
        hp = Math.min(maxHp, hp + 5.5 * dt);
      }

      if (
        this.world.plague[idx] > 0.1 &&
        role <= ROLE_ARCHER &&
        !this.hBlessed[i] &&
        (traits & TRAIT_IMMUNE) === 0
      ) {
        this.hPlague[i] = 1;
        this.world.plague[idx] = Math.max(0, this.world.plague[idx] - 0.15);
      }
      if (this.hPlague[i]) {
        hp -= 7.5 * dt;
        if (Math.random() < 0.8 * dt) {
          this.world.plague[idx] = Math.min(1, this.world.plague[idx] + 0.25);
        }
      }

      // ZOMBIE VIRUS INCUBATION: Bitten humans turn into fresh Zombies right inside their village!
      if (infectedTimer > 0 && role <= ROLE_ARCHER) {
        infectedTimer -= dt;
        if (infectedTimer <= 0) {
          const prevSettle = sid > 0 ? this.getSettlementById(sid) : undefined;
          role = ROLE_ZOMBIE;
          kingdom = 6;
          sid = 0;
          maxHp = 210;
          hp = 210;
          this.hPlague[i] = 0;
          this.hBlessed[i] = 0;
          this.hWood[i] = 0;
          infectedTimer = 0;
          emitter.emitDebris(partLeaf, x, y, z + 1.1, 0, 0, 10, 0);
          if (prevSettle && totalZombiesNow < 4 && this.onWorldEvent) {
            this.onWorldEvent(
              `☣ ЗОМБИ-АПОКАЛИПСИС! Инфекция вспыхнула в поселении ${prevSettle.name}!`,
              '#9ef01a',
            );
          }
          totalZombiesNow++;
        }
      }

      if (hp <= 0) {
        emitter.emitDebris(partEmber, x, y, z + 0.8, 0, 0, 8, 0);
        // Any bitten human who dies from wounds rises immediately as an undead Zombie!
        if (infectedTimer > 0 && role <= ROLE_ARCHER) {
          pendingZombieSpawns.push([x, y]);
        }
        continue;
      }

      const surf = this.world.surfaceHeight(idx);
      const inWater = this.world.water[idx] > 0.18 && this.world.ice[idx] < 0.12;

      if (z > surf + 0.05 || vz !== 0) {
        vz -= 42.0 * this.world.settings.gravityScale * dt;
        z += vz * dt;
        if (z <= surf) {
          z = surf;
          vz = 0;
        }
      } else {
        z = surf;
      }

      // ZOMBIES TRAMPLE GOLDEN WHEAT & FLOWERS INTO MUD AS THEY SHAMBLE!
      if (role === ROLE_ZOMBIE && !inWater) {
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            const ni = (gy + oy) * W + (gx + ox);
            const f = this.world.flora[ni];
            if (f === 6 || f === 4) {
              this.world.flora[ni] = 0;
              this.world.grass[ni] = Math.min(this.world.grass[ni], 0.1);
              this.world.ash[ni] = Math.max(this.world.ash[ni], 0.24);
              if (f === 6) {
                emitter.emitDebris(
                  partWoodChip,
                  gx + ox + 0.5,
                  gy + oy + 0.5,
                  surf + 0.6,
                  (Math.random() - 0.5) * 6,
                  (Math.random() - 0.5) * 6,
                  5 + Math.random() * 5,
                  0,
                );
              }
            }
          }
        }
      }

      this.hAge[i] += dt;
      this.hTimer[i] -= dt;
      if (this.hAtkCooldown[i] > 0) this.hAtkCooldown[i] -= dt;

      let state = this.hState[i];
      let treeIdx = this.hTreeIdx[i];

      if (role <= ROLE_ARCHER && sid === 0 && !inWater) {
        const s = this.findOrCreateSettlement(x, y, kingdom);
        sid = s.id;
      }
      let settlement = sid > 0 ? this.getSettlementById(sid) : undefined;
      // If old village was completely wiped out to Ruins by Zombies, refugees found a NEW Survivor Base on safe ground!
      if (role <= ROLE_ARCHER && !settlement && !inWater && infectedTimer <= 0) {
        const nearZombie = this.findNearestEnemyUnit(i, x, y, 18.0);
        if (nearZombie < 0) {
          const newBase = this.findOrCreateSettlement(x, y, kingdom);
          sid = newBase.id;
          settlement = newBase;
          const capIdx = newBase.centerY * W + newBase.centerX;
          this.clearPlotForBuilding(newBase.centerX, newBase.centerY, 4);
          this.world.buildings[capIdx] = BUILDING_BASE;
          this.world.buildingHp[capIdx] = 360;
          this.world.buildingSettlement[capIdx] = newBase.id;
          this.world.buildingKingdom[capIdx] = newBase.kingdom;
          newBase.woodStockpile = Math.max(newBase.woodStockpile, 8);
          this.buildPalisadeRing(newBase, 3);
          this.recomputeTerritories();
          if (this.onWorldEvent) {
            this.onWorldEvent(
              `🛡 Выжившие основали укреплённую базу «${newBase.name}»!`,
              '#7af48c',
            );
          }
        }
      }
      if (settlement && role <= ROLE_ARCHER) settlement.population++;

      // Mine shiny Gold Ore when walking over mountain veins!
      if (role <= ROLE_ARCHER && settlement && this.world.goldOre[idx] > 0.05) {
        this.world.goldOre[idx] = 0;
        settlement.goldStockpile += 2;
      }

      // ======================================================================
      // WARFARE, ZOMBIE HORDES, BUILDING DESTRUCTION -> RUINS & WILDLIFE AI
      // ======================================================================
      const isFighter =
        role === ROLE_KNIGHT ||
        role === ROLE_ARCHER ||
        role === ROLE_ZOMBIE ||
        role === ROLE_SKELETON ||
        role === ROLE_WOLF;

      let inCombat = false;
      // Zombies smell living prey across the whole map (165 tiles) so even 1 Zombie hunts down civilization!
      const scanRange = role === ROLE_ZOMBIE ? 165.0 : isFighter ? 46.0 : 12.0;
      let enemyIdx = this.hEnemyCache[i];
      if (
        (i & 3) === this.aiPhase ||
        enemyIdx < 0 ||
        enemyIdx >= this.humanCount ||
        this.hHp[enemyIdx] <= 0 ||
        !this.isHostilePair(role, kingdom, this.hRole[enemyIdx], this.hKingdom[enemyIdx])
      ) {
        enemyIdx = this.findNearestEnemyUnit(i, x, y, scanRange);
        this.hEnemyCache[i] = enemyIdx;
      }

      // Unarmed villagers without BRAVE trait panic & run inside their Base / flee away when a Zombie approaches!
      if (
        role === ROLE_VILLAGER &&
        (traits & TRAIT_BRAVE) === 0 &&
        enemyIdx >= 0 &&
        this.hRole[enemyIdx] === ROLE_ZOMBIE
      ) {
        const zx = this.hx[enemyIdx];
        const zy = this.hy[enemyIdx];
        const distZ = Math.hypot(zx - x, zy - y);
        const fleeDist = (traits & TRAIT_COWARD) !== 0 ? 18.0 : 11.0;
        if (infectedTimer > 0 && settlement) {
          inCombat = true;
          state = STATE_WANDER;
          this.hTargetX[i] = settlement.centerX;
          this.hTargetY[i] = settlement.centerY;
        } else if (distZ < fleeDist && distZ > 1.85) {
          inCombat = true;
          state = STATE_WANDER;
          if (settlement && settlement.buildings >= 1 && Math.hypot(settlement.centerX - x, settlement.centerY - y) > 4.5) {
            this.hTargetX[i] = settlement.centerX;
            this.hTargetY[i] = settlement.centerY;
          } else {
            const awayX = x + ((x - zx) / Math.max(0.5, distZ)) * 14;
            const awayY = y + ((y - zy) / Math.max(0.5, distZ)) * 14;
            this.hTargetX[i] = Math.max(3, Math.min(W - 4, awayX));
            this.hTargetY[i] = Math.max(3, Math.min(H - 4, awayY));
          }
        }
      }

      // Check if a Zombie right next to an intact human building should bash it down on the way!
      let nearbyZombieTargetBld = -1;
      if (role === ROLE_ZOMBIE) {
        for (let oy = -2; oy <= 2 && nearbyZombieTargetBld < 0; oy++) {
          for (let ox = -2; ox <= 2; ox++) {
            const ni = (gy + oy) * W + (gx + ox);
            if (ni < 0 || ni >= WORLD_SIZE) continue;
            const b = this.world.buildings[ni];
            if (b !== 0 && b !== BUILDING_RUINS && this.world.buildingKingdom[ni] < 6) {
              nearbyZombieTargetBld = ni;
              break;
            }
          }
        }
      }

      if (!inCombat && enemyIdx >= 0 && (nearbyZombieTargetBld < 0 || Math.hypot(this.hx[enemyIdx] - x, this.hy[enemyIdx] - y) <= 4.0)) {
        const ex = this.hx[enemyIdx];
        const ey = this.hy[enemyIdx];
        const distE = Math.hypot(ex - x, ey - y);
        inCombat = true;

        if (role === ROLE_ARCHER && distE <= 19.0 && distE >= 3.0) {
          state = STATE_COMBAT;
          this.hFacing[i] = ex >= x ? 1 : -1;
          if (this.hAtkCooldown[i] <= 0) {
            this.hAtkCooldown[i] = 0.55;
            this.sfx.playGunfire();
            this.fireArrow(
              x,
              y,
              z,
              ex,
              ey,
              this.hz[enemyIdx],
              kingdom,
              this.hBlessed[i] ? 34 : 24,
            );
          }
        } else if (distE <= 1.95) {
          state = STATE_COMBAT;
          this.hChopProgress[i] += dt * 1.5;
          this.hFacing[i] = ex >= x ? 1 : -1;
          if (this.hAtkCooldown[i] <= 0) {
            this.hAtkCooldown[i] = role === ROLE_ZOMBIE ? 0.36 : 0.52;
            const dmg =
              (role === ROLE_KNIGHT
                ? 26
                : role === ROLE_ZOMBIE
                  ? 26
                  : role === ROLE_SKELETON
                    ? 20
                    : 13) *
              (this.hBlessed[i] ? 1.45 : 1.0) *
              ((traits & TRAIT_GIANT) !== 0 ? 1.35 : 1.0);
            this.hHp[enemyIdx] -= dmg;
            if (this.hHp[enemyIdx] <= 0) {
              this.hKills[i] = Math.min(65535, this.hKills[i] + 1);
            }
            if ((traits & TRAIT_PYROMANIAC) !== 0 && Math.random() < 0.25 && this.world.water[idx] <= 0.02) {
              this.world.fire[idx] = Math.max(this.world.fire[idx], 0.55);
            }
            this.sfx.playSwordClash();
            emitter.emitDebris(
              partEmber,
              (x + ex) * 0.5,
              (y + ey) * 0.5,
              z + 1.0,
              (Math.random() - 0.5) * 8,
              (Math.random() - 0.5) * 8,
              7,
              0,
            );

            // INFECTIOUS ZOMBIE BITE! (TRAIT_IMMUNE protects natural survivors!)
            if (role === ROLE_ZOMBIE) {
              hp = Math.min(maxHp, hp + 22);
              const victimRole = this.hRole[enemyIdx];
              const victimImmune = (this.hTraits[enemyIdx] & TRAIT_IMMUNE) !== 0;
              if (victimRole <= ROLE_ARCHER && !this.hBlessed[enemyIdx] && !victimImmune) {
                if (this.hInfected[enemyIdx] <= 0) {
                  this.hInfected[enemyIdx] = 1.8 + Math.random() * 0.9;
                }
                if (this.hHp[enemyIdx] <= 0) {
                  this.hInfected[enemyIdx] = 0;
                  pendingZombieSpawns.push([ex, ey]);
                }
              } else if (victimRole === ROLE_SHEEP && this.hHp[enemyIdx] <= 0) {
                pendingZombieSpawns.push([ex, ey]);
              }
            }
          }
        } else {
          state = STATE_WANDER;
          if (role === ROLE_ZOMBIE) {
            // ZOMBIE HORDE COHESION via O(1) 5x5 Spatial Hash Grid!
            let sumZx = 0;
            let sumZy = 0;
            let sepX = 0;
            let sepY = 0;
            let zNeighbors = 0;
            const zcx0 = Math.max(0, ((x - 16) * 0.125) | 0);
            const zcx1 = Math.min(39, ((x + 16) * 0.125) | 0);
            const zcy0 = Math.max(0, ((y - 16) * 0.125) | 0);
            const zcy1 = Math.min(24, ((y + 16) * 0.125) | 0);
            for (let zcy = zcy0; zcy <= zcy1; zcy++) {
              const zRow = zcy * 40;
              for (let zcx = zcx0; zcx <= zcx1; zcx++) {
                let j = this.gridHead[zRow + zcx];
                while (j >= 0) {
                  if (j !== i && this.hRole[j] === ROLE_ZOMBIE && this.hHp[j] > 0) {
                    const ddx = this.hx[j] - x;
                    const ddy = this.hy[j] - y;
                    const d2 = ddx * ddx + ddy * ddy;
                    if (d2 < 256) {
                      sumZx += this.hx[j];
                      sumZy += this.hy[j];
                      zNeighbors++;
                      if (d2 < 1.3 && d2 > 0.001) {
                        sepX -= ddx * 2.2;
                        sepY -= ddy * 2.2;
                      }
                    }
                  }
                  j = this.gridNext[j];
                }
              }
            }
            if (zNeighbors > 0) {
              const cxHorde = sumZx / zNeighbors;
              const cyHorde = sumZy / zNeighbors;
              this.hTargetX[i] = ex * 0.74 + cxHorde * 0.26 + sepX;
              this.hTargetY[i] = ey * 0.74 + cyHorde * 0.26 + sepY;
            } else {
              this.hTargetX[i] = ex;
              this.hTargetY[i] = ey;
            }
          } else {
            this.hTargetX[i] = ex;
            this.hTargetY[i] = ey;
          }
        }
      } else if (!inCombat && isFighter && role !== ROLE_WOLF) {
        // Siege & Conquer Enemy Towns OR Zombie Horde Smashing Houses into RUINS!
        const enemyTown = this.findEnemySettlementCenter(kingdom, x, y);
        const siegeIdx = nearbyZombieTargetBld >= 0 ? nearbyZombieTargetBld : (() => {
          if (!enemyTown) return -1;
          for (let oy = -2; oy <= 2; oy++) {
            for (let ox = -2; ox <= 2; ox++) {
              const ni = (gy + oy) * W + (gx + ox);
              if (ni < 0 || ni >= WORLD_SIZE) continue;
              const b = this.world.buildings[ni];
              if (
                b !== 0 &&
                b !== BUILDING_RUINS &&
                this.isKingdomsAtWar(kingdom, this.world.buildingKingdom[ni])
              ) {
                return ni;
              }
            }
          }
          return -1;
        })();

        if (siegeIdx >= 0) {
          inCombat = true;
          state = STATE_COMBAT;
          const bx = (siegeIdx % W) + 0.5;
          this.hFacing[i] = bx >= x ? 1 : -1;
          this.hChopProgress[i] += dt * 1.5;
          if (this.hAtkCooldown[i] <= 0) {
            this.hAtkCooldown[i] = 0.55;
            this.world.buildingHp[siegeIdx] -= role === ROLE_ZOMBIE ? 24 : 26;
            this.sfx.playWoodChop();
            emitter.emitDebris(
              partWoodChip,
              bx,
              ((siegeIdx / W) | 0) + 0.5,
              z + 1.4,
              (Math.random() - 0.5) * 8,
              (Math.random() - 0.5) * 8,
              8,
              0,
            );

            if (this.world.buildingHp[siegeIdx] <= 0) {
              const oldBld = this.world.buildings[siegeIdx];
              if (kingdom < 6 && settlement && oldBld !== BUILDING_WALL) {
                // KINGDOM CONQUEST!
                this.world.buildingKingdom[siegeIdx] = kingdom;
                this.world.buildingSettlement[siegeIdx] = settlement.id;
                this.world.buildingHp[siegeIdx] = 110;
                if (enemyTown && enemyTown.centerY * W + enemyTown.centerX === siegeIdx) {
                  // Штаб взят — база оккупирована, но гарнизон готовит восстание!
                  enemyTown.annexedBy = kingdom;
                  enemyTown.rebelTimer = 18.0 + Math.random() * 16.0;
                  if (this.onWorldEvent) {
                    this.onWorldEvent(
                      `👑 ${settlement.name} ЗАХВАТИЛ ШТАБ ${enemyTown.name}! Провинция оккупирована — готовится восстание!`,
                      '#ffd43b',
                    );
                  }
                }
                this.recomputeTerritories();
              } else {
                // ZOMBIE HORDE SMASHES HOUSE INTO VISIBLE DEVASTATED RUINS (РАЗРУХА)!
                this.world.buildings[siegeIdx] =
                  oldBld === BUILDING_WALL || oldBld === 1 ? 0 : BUILDING_RUINS;
                this.world.buildingSettlement[siegeIdx] = 0;
                this.world.buildingHp[siegeIdx] = 0;
                this.world.ash[siegeIdx] = Math.max(this.world.ash[siegeIdx], 0.65);
                this.world.grass[siegeIdx] = 0;
                // Infected inhabitants trapped in smashed cottages crawl out as new Zombies!
                if (role === ROLE_ZOMBIE && oldBld >= 2 && oldBld <= 4) {
                  pendingZombieSpawns.push([bx + 0.4, ((siegeIdx / W) | 0) + 0.5]);
                  if (Math.random() < 0.55) {
                    pendingZombieSpawns.push([bx - 0.4, ((siegeIdx / W) | 0) + 0.5]);
                  }
                }
                this.recomputeTerritories();
              }
            }
          }
        } else if (enemyTown) {
          inCombat = true;
          state = STATE_WANDER;
          this.hTargetX[i] = enemyTown.centerX + (Math.random() - 0.5) * 4;
          this.hTargetY[i] = enemyTown.centerY + (Math.random() - 0.5) * 4;
        }
      }

      // ======================================================================
      // PEACEFUL VILLAGE LUMBERJACKING, BUILDING & EXPANSION AI
      // ======================================================================
      if (!inCombat && role === ROLE_VILLAGER) {
        if (state === STATE_CHOPPING) {
          if (
            treeIdx < 0 ||
            treeIdx >= WORLD_SIZE ||
            this.world.flora[treeIdx] < 1 ||
            this.world.flora[treeIdx] > 3
          ) {
            state = STATE_WANDER;
            treeIdx = -1;
          } else {
            const chopSpeed = (traits & TRAIT_HARDWORKER) !== 0 ? 1.65 : 1.0;
            const prevSwing = (this.hChopProgress[i] / 0.42) | 0;
            this.hChopProgress[i] += dt * chopSpeed;
            const curSwing = (this.hChopProgress[i] / 0.42) | 0;

            if (curSwing > prevSwing) {
              this.sfx.playWoodChop();
              this.world.treeShake[treeIdx] = 0.36;

              const tx = (treeIdx % W) + 0.5;
              const ty = ((treeIdx / W) | 0) + 0.5;
              const tz = this.world.surfaceHeight(treeIdx) + 1.0;

              for (let c = 0; c < 3; c++) {
                const a = Math.random() * Math.PI * 2;
                emitter.emitDebris(
                  partWoodChip,
                  tx,
                  ty,
                  tz,
                  Math.cos(a) * (4 + Math.random() * 6),
                  Math.sin(a) * (4 + Math.random() * 6),
                  7 + Math.random() * 8,
                  0,
                );
              }
              emitter.emitDebris(
                partLeaf,
                tx,
                ty,
                tz + 1.6,
                (Math.random() - 0.5) * 4,
                (Math.random() - 0.5) * 4,
                3 + Math.random() * 4,
                0,
              );

              const thp = this.world.treeHp[treeIdx] > 0 ? this.world.treeHp[treeIdx] - 1 : 0;
              this.world.treeHp[treeIdx] = thp;

              if (thp <= 0) {
                this.world.flora[treeIdx] = 5;
                this.world.stumpTimer[treeIdx] = 10.0 + Math.random() * 6.0;
                const woodGain = (traits & TRAIT_HARDWORKER) !== 0 ? 2 : 1;
                this.hWood[i] = Math.min(4, this.hWood[i] + woodGain);
                treeIdx = -1;
                if (this.hWood[i] >= 2 || Math.random() < 0.45) {
                  state = settlement ? STATE_RETURN_WOOD : STATE_WANDER;
                  if (settlement) {
                    this.hTargetX[i] = settlement.centerX + (Math.random() - 0.5) * 4;
                    this.hTargetY[i] = settlement.centerY + (Math.random() - 0.5) * 4;
                  }
                } else {
                  state = STATE_WANDER;
                  this.hTimer[i] = 0.05;
                }
              }
            }
          }
        }

        if (state !== STATE_CHOPPING && this.hTimer[i] <= 0) {
          this.hTimer[i] = 0.65 + Math.random() * 0.9;

          if (inWater) {
            this.pickSafeLandTarget(i, x, y, true);
            state = STATE_WANDER;
          } else if (this.hWood[i] > 0 && settlement) {
            const distHome = Math.hypot(settlement.centerX - x, settlement.centerY - y);
            if (distHome > 9.0) {
              this.hTargetX[i] = settlement.centerX + (Math.random() - 0.5) * 5;
              this.hTargetY[i] = settlement.centerY + (Math.random() - 0.5) * 5;
              state = STATE_RETURN_WOOD;
            } else {
              settlement.woodStockpile += this.hWood[i];
              this.hWood[i] = 0;
              state = STATE_WANDER;
              this.tryConstructSettlementBuilding(settlement);
              this.pickSafeLandTarget(i, x, y, false);
            }
          } else if (settlement && settlement.woodStockpile < 32) {
            const nearTree = this.findNearestTree(gx, gy, 46);
            if (nearTree >= 0) {
              treeIdx = nearTree;
              this.hTargetX[i] = (nearTree % W) + 0.5;
              this.hTargetY[i] = ((nearTree / W) | 0) + 0.5;
              state = STATE_SEEK_TREE;
            } else {
              this.pickSafeLandTarget(i, x, y, false);
              state = STATE_WANDER;
            }
          } else {
            if (settlement && settlement.woodStockpile >= 3) {
              this.tryConstructSettlementBuilding(settlement);
            }
            this.pickSafeLandTarget(i, x, y, false);
            state = STATE_WANDER;
          }

          // Village population growth + automatic Knight & Archer recruitment!
          if (
            settlement &&
            settlement.buildings >= 2 &&
            settlement.population < 5 + settlement.buildings * 3 &&
            this.humanCount < MAX_HUMANS - 12 &&
            Math.random() < 0.055
          ) {
            const rollRole = Math.random();
            const newRole =
              rollRole < 0.24 ? ROLE_KNIGHT : rollRole < 0.36 ? ROLE_ARCHER : ROLE_VILLAGER;
            this.spawnUnit(
              settlement.centerX + (Math.random() - 0.5) * 4,
              settlement.centerY + (Math.random() - 0.5) * 4,
              0,
              newRole,
              settlement.kingdom,
              settlement.id,
            );
          }
        }
      } else if (!inCombat && this.hTimer[i] <= 0) {
        // Post-apocalypse idle Zombies calmly wander dry land at a relaxed pace!
        this.hTimer[i] = role === ROLE_ZOMBIE ? 1.8 + Math.random() * 2.2 : 0.8 + Math.random() * 1.1;
        this.pickSafeLandTarget(i, x, y, inWater);
        state = STATE_WANDER;
      }

      // ======================================================================
      // SMOOTH MOVEMENT (TRAITS + DROWNING + CALM IDLE ZOMBIE STROLL!)
      // ======================================================================
      let facing = this.hFacing[i] || 1;
      let walkPhase = this.hWalkPhase[i];

      if (state === STATE_CHOPPING && treeIdx >= 0) {
        const tx = (treeIdx % W) + 0.5;
        facing = tx >= x ? 1 : -1;
      } else if (state !== STATE_CHOPPING && state !== STATE_COMBAT && z <= surf + 0.2) {
        const dx = this.hTargetX[i] - x;
        const dy = this.hTargetY[i] - y;
        const d = Math.hypot(dx, dy);

        if (state === STATE_SEEK_TREE && treeIdx >= 0 && d <= 1.55) {
          state = STATE_CHOPPING;
          this.hChopProgress[i] = 0.2;
          facing = dx >= 0 ? 1 : -1;
        } else if (d > 0.25) {
          if (Math.abs(dx) > 0.08) {
            facing = dx >= 0 ? 1 : -1;
          }
          const onRoad = this.world.road[idx] > 0.45 ? 1.25 : 1.0;
          const traitSpd =
            ((traits & TRAIT_FAST) !== 0 ? 1.35 : 1.0) *
            ((traits & TRAIT_SLOW) !== 0 ? 0.74 : 1.0);
          // When Zombies have wiped out everyone, they just stroll peacefully (2.35 tiles/s)!
          const baseSpeed =
            role === ROLE_SHEEP
              ? 4.2
              : role === ROLE_ZOMBIE
                ? inCombat
                  ? 7.4
                  : 2.35
                : 8.0;
          let waterSpeed = inCombat ? 8.2 : 3.8;
          if ((traits & TRAIT_SWIMMER) !== 0) waterSpeed *= 1.55;
          else if ((traits & TRAIT_CANT_SWIM) !== 0) waterSpeed = 2.0; // flailing in panic!
          const speed = (inWater ? waterSpeed : baseSpeed) * onRoad * traitSpd;
          const stepX = (dx / d) * speed * dt;
          const stepY = (dy / d) * speed * dt;
          const nextGx = Math.max(1, Math.min(W - 2, (x + stepX) | 0));
          const nextGy = Math.max(1, Math.min(H - 2, (y + stepY) | 0));
          const nextIdx = nextGy * W + nextGx;

          const cliffDiff = Math.abs(this.world.solidHeight(nextIdx) - this.world.solidHeight(idx));
          const blockedByWall =
            (role === ROLE_ZOMBIE || role === ROLE_SKELETON) &&
            this.world.buildings[nextIdx] === BUILDING_WALL;
          // Non-swimmers and peaceful idle zombies avoid stepping off dry land into deep water!
          const avoidsDeepWater =
            !inWater &&
            this.world.water[nextIdx] > 0.34 &&
            this.world.ice[nextIdx] < 0.12 &&
            (((traits & TRAIT_CANT_SWIM) !== 0 && !inCombat) || (role === ROLE_ZOMBIE && !inCombat));

          if (this.world.lava[nextIdx] <= 0.01 && cliffDiff < 2.2 && !blockedByWall && !avoidsDeepWater) {
            x += stepX;
            y += stepY;
            walkPhase += speed * dt * 2.1;
          } else {
            this.hTimer[i] = 0;
          }
        }
      }

      this.hx[write] = x;
      this.hy[write] = y;
      this.hz[write] = z;
      this.hvz[write] = vz;
      this.hTargetX[write] = this.hTargetX[i];
      this.hTargetY[write] = this.hTargetY[i];
      this.hTimer[write] = this.hTimer[i];
      this.hKingdom[write] = kingdom;
      this.hSettlement[write] = sid;
      this.hRole[write] = role;
      this.hState[write] = state;
      this.hTreeIdx[write] = treeIdx;
      this.hChopProgress[write] = this.hChopProgress[i];
      this.hWood[write] = this.hWood[i];
      this.hHp[write] = hp;
      this.hMaxHp[write] = maxHp;
      this.hAtkCooldown[write] = this.hAtkCooldown[i];
      this.hPlague[write] = this.hPlague[i];
      this.hInfected[write] = infectedTimer;
      this.hBlessed[write] = this.hBlessed[i];
      this.hAge[write] = this.hAge[i];
      this.hVariant[write] = this.hVariant[i];
      this.hFacing[write] = facing;
      this.hWalkPhase[write] = walkPhase;
      this.hTraits[write] = traits;
      this.hKills[write] = this.hKills[i];
      this.hUid[write] = this.hUid[i];
      this.hEnemyCache[write] = enemyIdx;
      write++;
    }

    this.humanCount = write;

    for (const [zx, zy] of pendingZombieSpawns) {
      this.spawnUnit(zx, zy, 0, ROLE_ZOMBIE);
    }
  }

  // Build protective Spiked Wooden Palisade Barricades around a Survivor Base / Village!
  private buildPalisadeRing(s: Settlement, count: number): void {
    const W = WORLD_W;
    const H = WORLD_H;
    let placed = 0;
    for (let attempt = 0; attempt < 26 && placed < count; attempt++) {
      const ang = (attempt / 26) * Math.PI * 2 + Math.random() * 0.25;
      const r = 6.2;
      const wx = Math.round(s.centerX + Math.cos(ang) * r);
      const wy = Math.round(s.centerY + Math.sin(ang) * r);
      if (wx < 3 || wx >= W - 3 || wy < 3 || wy >= H - 3) continue;
      const wi = wy * W + wx;
      if (
        this.world.water[wi] <= 0.02 &&
        this.world.lava[wi] <= 0.01 &&
        (this.world.buildings[wi] === 0 || this.world.buildings[wi] === BUILDING_RUINS)
      ) {
        this.world.flora[wi] = 0;
        this.world.buildings[wi] = BUILDING_WALL;
        this.world.buildingHp[wi] = 165;
        this.world.buildingSettlement[wi] = s.id;
        this.world.buildingKingdom[wi] = s.kingdom;
        placed++;
      }
    }
  }

  // Военные базы! Строят казармы, ПВО, радары и бункеры
  private tryConstructSettlementBuilding(s: Settlement): void {
    const W = WORLD_W;
    const capIdx = s.centerY * W + s.centerX;
    const atWar = this.isSettlementAtWar(s);
    const cost = atWar ? 1 : s.goldStockpile > 0 ? 2 : 3;

    // Штаб - сердце базы, если разрушен - строим заново
    if (s.buildings >= 2 && (this.world.buildings[capIdx] === 1 || this.world.buildings[capIdx] === BUILDING_RUINS || this.world.buildings[capIdx]===0) && s.woodStockpile >= cost) {
      this.clearPlotForBuilding(s.centerX, s.centerY, 4);
      this.world.buildings[capIdx] = 3; // HQ
      this.world.buildingHp[capIdx] = 520;
      this.world.buildingSettlement[capIdx] = s.id;
      this.world.buildingKingdom[capIdx] = s.kingdom;
      s.woodStockpile -= cost;
      if (s.goldStockpile > 0) s.goldStockpile--;
      this.buildPalisadeRing(s, 4);
      this.recomputeTerritories();
      return;
    }
    // При войне сразу укрепляем центр бункером
    if (atWar && this.world.buildings[capIdx] !== 3 && this.world.buildings[capIdx] !== BUILDING_BASE && s.woodStockpile >= cost) {
      this.clearPlotForBuilding(s.centerX, s.centerY, 4);
      this.world.buildings[capIdx] = BUILDING_BASE; // concrete bunker
      this.world.buildingHp[capIdx] = 480;
      this.world.buildingSettlement[capIdx] = s.id;
      this.world.buildingKingdom[capIdx] = s.kingdom;
      s.woodStockpile -= cost;
      this.buildPalisadeRing(s, 6);
      if (this.onWorldEvent) this.onWorldEvent(`🛡 ${s.name} возвёл бункер!`, '#ffd466');
      this.recomputeTerritories();
      return;
    }

    const maxCap = atWar ? 32 : 22;
    if (s.woodStockpile < cost || s.buildings >= maxCap) return;
    const plot = this.findGoodBuildPlot(s.centerX, s.centerY, s.id);
    if (!plot) return;
    const pIdx = plot.by * W + plot.bx;
    this.clearPlotForBuilding(plot.bx, plot.by, 3);
    this.layVillageRoad(s.centerX, s.centerY, plot.bx, plot.by);

    let bType = 2; let bHp = 140;
    const roll = Math.random();
    if (atWar) {
      if (s.buildings % 5 === 0) { bType = BUILDING_SILO; bHp = 320; } // missile silo
      else if (s.buildings % 5 === 1) { bType = 5; bHp = 260; } // PVO
      else if (s.buildings % 5 === 2) { bType = BUILDING_RADAR; bHp = 180; }
      else if (s.buildings % 5 === 3) { bType = BUILDING_BASE; bHp = 380; this.buildPalisadeRing(s, 3); }
      else { bType = 4; bHp = 160; }
    } else {
      if (s.buildings % 4 === 0) { bType = 2; bHp = 140; }
      else if (s.buildings % 4 === 1) { bType = 4; bHp = 150; }
      else if (s.buildings % 4 === 2) { bType = 5; bHp = 200; }
      else { bType = BUILDING_RADAR; bHp = 170; }
    }

    this.world.buildings[pIdx] = bType;
    this.world.buildingHp[pIdx] = bHp;
    this.world.buildingSettlement[pIdx] = s.id;
    this.world.buildingKingdom[pIdx] = s.kingdom;
    s.woodStockpile -= cost;
    if (s.goldStockpile > 0) s.goldStockpile--;
    this.recomputeTerritories();
  }

  private pickSafeLandTarget(i: number, x: number, y: number, inWater: boolean): void {
    const W = WORLD_W;
    const H = WORLD_H;
    let bestTx = x;
    let bestTy = y;
    let bestScore = -1e9;
    const cantSwim = (this.hTraits[i] & TRAIT_CANT_SWIM) !== 0;
    const isZombie = this.hRole[i] === ROLE_ZOMBIE;
    const floodActive = this.world.settings.seaLevel > this.world.baseSeaLevel + 0.35;

    for (let sample = 0; sample < 9; sample++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = isZombie ? 4 + Math.random() * 12 : 2 + Math.random() * 12;
      const cx = Math.max(2, Math.min(W - 3, Math.round(x + Math.cos(ang) * dist)));
      const cy = Math.max(2, Math.min(H - 3, Math.round(y + Math.sin(ang) * dist)));
      const ci = cy * W + cx;

      let score = Math.random() * 2.5;
      if (this.world.lava[ci] > 0.01 || this.world.fire[ci] > 0.02 || this.world.acid[ci] > 0.01) {
        score -= 500;
      }
      if (this.world.water[ci] > 0.12 && this.world.ice[ci] < 0.12) {
        score -= inWater ? this.world.water[ci] * 24.0 : cantSwim || isZombie ? 950.0 : 110.0;
      } else {
        score += 24.0;
        // During floods or when caught in water, climb high hills & mountains!
        if (floodActive || inWater) {
          score += this.world.solidHeight(ci) * 5.0;
        }
        if (this.world.road[ci] > 0.4) score += 5.0;
        if (this.world.grass[ci] > 0.4) score += 4.0;
      }

      if (score > bestScore) {
        bestScore = score;
        bestTx = cx + 0.5;
        bestTy = cy + 0.5;
      }
    }
    this.hTargetX[i] = bestTx;
    this.hTargetY[i] = bestTy;
  }

  private hasNoNearbyBuilding(gx: number, gy: number, minGap: number): boolean {
    const W = WORLD_W;
    for (let oy = -minGap; oy <= minGap; oy++) {
      for (let ox = -minGap; ox <= minGap; ox++) {
        const nx = gx + ox;
        const ny = gy + oy;
        if (nx < 0 || nx >= W || ny < 0 || ny >= WORLD_H) continue;
        const b = this.world.buildings[ny * W + nx];
        if (b !== 0 && b !== BUILDING_RUINS && b !== BUILDING_WALL) return false;
      }
    }
    return true;
  }

  public recomputeTerritories(): void {
    const W = WORLD_W;
    const H = WORLD_H;
    const terr = this.world.territory;
    const distArr = this.bfsDist;
    const queue = this.bfsQueue;

    terr.fill(0);
    distArr.fill(65535);

    let head = 0;
    let tail = 0;

    this.settlementById.fill(undefined);
    for (const s of this.settlements) {
      if (!s.active) continue;
      if (s.id > 0 && s.id < 64) this.settlementById[s.id] = s;
      s.buildings = 0;
    }

    let totalHouses = 0;
    let tCount = 0;
    for (let i = 0; i < WORLD_SIZE; i++) {
      const b = this.world.buildings[i];
      if (b === 0 || b === BUILDING_RUINS) continue;
      if (b >= 2 && b !== BUILDING_WALL) totalHouses++;
      if ((b === 5 || b === 3 || b === BUILDING_BASE) && tCount < this.towerIndices.length) {
        this.towerIndices[tCount++] = i;
      }
      const sid = this.world.buildingSettlement[i];
      if (sid === 0) continue;
      if (b !== BUILDING_WALL) {
        const sObj = this.settlementById[sid];
        if (sObj) sObj.buildings++;
      }
      terr[i] = sid;
      distArr[i] = b === 3 || b === BUILDING_BASE ? 0 : 4;
      queue[tail++] = i;
    }
    this.towerCount = tCount;
    this.world.totalHouses = totalHouses;

    for (const s of this.settlements) {
      if (s.active && s.population === 0 && s.buildings === 0) {
        s.active = false;
        if (s.id > 0 && s.id < 64) this.settlementById[s.id] = undefined;
      }
    }

    const MAX_BORDER_COST = 30;
    while (head < tail) {
      const cur = queue[head++];
      const curCost = distArr[cur];
      if (curCost >= MAX_BORDER_COST) continue;

      const sid = terr[cur];
      const cx = cur % W;
      const cy = (cur / W) | 0;

      for (let dy = -1; dy <= 1; dy++) {
        const ny = cy + dy;
        if (ny < 0 || ny >= H) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = cx + dx;
          if (nx < 0 || nx >= W) continue;

          const ni = ny * W + nx;
          if (
            (this.world.water[ni] > 0.22 && this.world.ice[ni] < 0.1) ||
            this.world.lava[ni] > 0.08
          ) {
            continue;
          }

          const stepCost = dx !== 0 && dy !== 0 ? 3 : 2;
          const nextCost = curCost + stepCost;
          if (nextCost <= MAX_BORDER_COST && nextCost < distArr[ni]) {
            distArr[ni] = nextCost;
            terr[ni] = sid;
            queue[tail++] = ni;
          }
        }
      }
    }

    this.territoryVersion++;
  }
}
