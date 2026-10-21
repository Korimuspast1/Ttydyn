import { SoundEffects } from '../audio/sfx';
import {
  EntityManager,
  ExplosionParticleEmitter,
  ROLE_KNIGHT,
  ROLE_SHEEP,
  ROLE_SKELETON,
  ROLE_VILLAGER,
  ROLE_WOLF,
  ROLE_ZOMBIE,
} from './entities';
import { ToolId, WORLD_H, WORLD_W } from './types';
import { WorldState } from './world';

// Sky-falling & buoyant 3D particle types
export const PARTICLE_SAND = 1;
export const PARTICLE_WATER = 2;
export const PARTICLE_STONE = 3;
export const PARTICLE_SPLASH = 4;
export const PARTICLE_DUST = 5;
export const PARTICLE_SOIL = 6;
export const PARTICLE_LAVA = 7;
export const PARTICLE_SNOW = 8;
export const PARTICLE_SEED = 9;
export const PARTICLE_FIRE = 10;
export const PARTICLE_ACID = 11;
export const PARTICLE_TNT = 12;
export const PARTICLE_STEAM = 13;
export const PARTICLE_SMOKE = 14;
export const PARTICLE_EMBER = 15;
export const PARTICLE_WOOD_CHIP = 16;
export const PARTICLE_LEAF = 17;

const MAX_PARTICLES = 22000;

const N8_DX = [-1, 1, 0, 0, -1, 1, -1, 1];
const N8_DY = [0, 0, -1, 1, -1, -1, 1, 1];
const N8_DIST = [1, 1, 1, 1, 1.4142135, 1.4142135, 1.4142135, 1.4142135];

export class PhysicsEngine implements ExplosionParticleEmitter {
  public count = 0;
  public pType = new Uint8Array(MAX_PARTICLES);
  public pX = new Float32Array(MAX_PARTICLES);
  public pY = new Float32Array(MAX_PARTICLES);
  public pZ = new Float32Array(MAX_PARTICLES);
  public pVx = new Float32Array(MAX_PARTICLES);
  public pVy = new Float32Array(MAX_PARTICLES);
  public pVz = new Float32Array(MAX_PARTICLES);
  public pMass = new Float32Array(MAX_PARTICLES);
  public pLife = new Float32Array(MAX_PARTICLES);
  public pSeed = new Uint8Array(MAX_PARTICLES);

  private tickCounter = 0;
  private levelTargetHeight: number | null = null;
  private meteorCooldown = 0;
  private humanSpawnAccum = 0;
  private solidCache = new Float32Array(WORLD_W * WORLD_H);
  private surfCache = new Float32Array(WORLD_W * WORLD_H);
  private lavaSleepTicks = 0;
  private sinkSleepTicks = 0;
  private chemMinIdx = 0;
  private chemMaxIdx = WORLD_W * WORLD_H - 1;

  constructor(
    private world: WorldState,
    private entities: EntityManager,
    private sfx: SoundEffects,
  ) {}

  public clearParticles(): void {
    this.count = 0;
    this.levelTargetHeight = null;
  }

  public resetStroke(): void {
    this.levelTargetHeight = null;
  }

  public emitDebris(
    type: number,
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    mass: number,
  ): void {
    this.spawnParticle(type, x, y, z, vx, vy, vz, mass, 0.85 + Math.random() * 0.65);
  }

  private spawnParticle(
    type: number,
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    mass: number,
    life = 4.0,
  ): void {
    if (this.count >= MAX_PARTICLES) return;
    const i = this.count++;
    this.pType[i] = type;
    this.pX[i] = x;
    this.pY[i] = y;
    this.pZ[i] = z;
    this.pVx[i] = vx;
    this.pVy[i] = vy;
    this.pVz[i] = vz;
    this.pMass[i] = mass;
    this.pLife[i] = life;
    this.pSeed[i] = (Math.random() * 255) | 0;
  }

  public applyBrush(
    tool: ToolId,
    gx: number,
    gy: number,
    radius: number,
    dt: number,
  ): void {
    const W = WORLD_W;
    const H = WORLD_H;

    // 1. Direct Landscape Sculpting & Tornado Tools
    if (tool === 'raise') {
      this.applyRaiseTerrain(gx, gy, radius, dt);
      return;
    }
    if (tool === 'dig') {
      this.applyDig(gx, gy, radius, dt);
      return;
    }
    if (tool === 'level') {
      this.applyLevelTerrain(gx, gy, radius, dt);
      return;
    }
    if (tool === 'wave') {
      this.applyTornadoVortex(gx, gy, radius, dt);
      return;
    }

    // 2. Meteors, Nuke, Lightning, Diplomacy & Living Creatures!
    if (tool === 'meteor') {
      if (this.meteorCooldown <= 0) {
        const power = Math.max(0.75, Math.min(2.1, 0.65 + radius * 0.1));
        this.entities.spawnMeteor(gx, gy, power);
        this.meteorCooldown = 0.22;
      }
      return;
    }

    if (tool === 'nuke') {
      if (this.meteorCooldown <= 0) {
        this.entities.triggerTsarBomba(
          gx,
          gy,
          this,
          PARTICLE_STONE,
          PARTICLE_SAND,
          PARTICLE_EMBER,
          PARTICLE_SMOKE,
        );
        this.meteorCooldown = 0.75;
      }
      return;
    }

    if (tool === 'lightning') {
      if (this.meteorCooldown <= 0) {
        this.entities.triggerLightning(gx, gy, this, PARTICLE_EMBER, PARTICLE_SMOKE);
        this.meteorCooldown = 0.15;
      }
      return;
    }

    if (tool === 'war') {
      if (this.meteorCooldown <= 0) {
        this.entities.triggerWarPower(gx, gy, radius);
        this.meteorCooldown = 0.45;
      }
      return;
    }

    if (tool === 'peace') {
      if (this.meteorCooldown <= 0) {
        this.entities.triggerPeacePower();
        this.meteorCooldown = 0.45;
      }
      return;
    }

    if (tool === 'blessing') {
      this.entities.triggerBlessingAt(gx, gy, radius);
      for (let k = 0; k < 4; k++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * radius;
        const px = gx + Math.cos(a) * r;
        const py = gy + Math.sin(a) * r;
        if (px >= 1 && px < W - 1 && py >= 1 && py < H - 1) {
          this.spawnParticle(
            PARTICLE_EMBER,
            px,
            py,
            this.world.surfaceHeight((py | 0) * W + (px | 0)) + 1.0,
            0,
            0,
            9 + Math.random() * 6,
            0,
            0.55,
          );
        }
      }
      return;
    }

    if (tool === 'inspect') {
      if (this.meteorCooldown <= 0) {
        this.entities.selectUnitNear(gx, gy, 4.5);
        this.meteorCooldown = 0.2;
      }
      return;
    }

    if (
      tool === 'weather_rain' ||
      tool === 'weather_snow' ||
      tool === 'flood' ||
      tool === 'weather_clear'
    ) {
      if (this.meteorCooldown <= 0) {
        this.triggerWeatherOrFloodPower(tool, gx, gy);
        this.meteorCooldown = 0.35;
      }
      return;
    }

    if (tool === 'dragon') {
      if (this.meteorCooldown <= 0) {
        this.entities.spawnDragon(gx, gy);
        this.meteorCooldown = 0.55;
      }
      return;
    }

    if (tool === 'zombies') {
      if (this.meteorCooldown <= 0) {
        this.sfx.playLifeChime();
        const count = radius <= 3.2 ? 1 : radius <= 6 ? 2 : 4;
        for (let k = 0; k < count; k++) {
          const ang = Math.random() * Math.PI * 2;
          const r = count === 1 ? 0 : Math.sqrt(Math.random()) * radius * 0.5;
          this.entities.spawnUnit(gx + Math.cos(ang) * r, gy + Math.sin(ang) * r, 14, ROLE_ZOMBIE);
        }
        this.meteorCooldown = 0.26;
      }
      return;
    }

    if (
      tool === 'humans' ||
      tool === 'warriors' ||
      tool === 'skeletons' ||
      tool === 'sheep' ||
      tool === 'wolves'
    ) {
      this.humanSpawnAccum += dt * (tool === 'sheep' || tool === 'wolves' ? 14 : 20);
      const toSpawn = Math.floor(this.humanSpawnAccum);
      if (toSpawn >= 1) {
        this.humanSpawnAccum -= toSpawn;
        this.sfx.playLifeChime();
        const role =
          tool === 'warriors'
            ? ROLE_KNIGHT
            : tool === 'skeletons'
              ? ROLE_SKELETON
              : tool === 'sheep'
                ? ROLE_SHEEP
                : tool === 'wolves'
                  ? ROLE_WOLF
                  : ROLE_VILLAGER;
        const capped = Math.min(5, toSpawn);
        for (let k = 0; k < capped; k++) {
          const ang = Math.random() * Math.PI * 2;
          const r = Math.sqrt(Math.random()) * Math.max(1.2, radius * 0.8);
          this.entities.spawnUnit(gx + Math.cos(ang) * r, gy + Math.sin(ang) * r, 15, role);
        }
      }
      return;
    }

    // Direct Surface Materials: Gold Ore, Oil, Gunpowder & Plague
    if (tool === 'gold' || tool === 'oil' || tool === 'gunpowder' || tool === 'plague') {
      const rCeil = Math.ceil(radius);
      for (let y = Math.max(1, (gy - rCeil) | 0); y <= Math.min(H - 2, (gy + rCeil) | 0); y++) {
        for (let x = Math.max(1, (gx - rCeil) | 0); x <= Math.min(W - 2, (gx + rCeil) | 0); x++) {
          if (Math.hypot(x - gx, y - gy) > radius) continue;
          const idx = y * W + x;
          if (tool === 'gold' && this.world.water[idx] < 0.05) {
            this.world.goldOre[idx] = 1.0;
          } else if (tool === 'oil') {
            this.world.oil[idx] = Math.min(1.5, this.world.oil[idx] + 3.5 * dt);
          } else if (tool === 'gunpowder' && this.world.water[idx] < 0.05) {
            this.world.gunpowder[idx] = Math.min(1.0, this.world.gunpowder[idx] + 4.5 * dt);
          } else if (tool === 'plague') {
            this.world.plague[idx] = Math.min(1.0, this.world.plague[idx] + 4.0 * dt);
          }
        }
      }
      this.sfx.playSandGrain();
      return;
    }

    // 3. Sky-Falling WorldBox Elements & Powers!
    const areaScale = Math.max(1, radius * radius * 1.4);

    const dropScatter = (
      pType: number,
      count: number,
      dropMin: number,
      dropSpan: number,
      spreadV: number,
      vzInit: number,
      massMin: number,
      massSpan: number,
    ) => {
      for (let n = 0; n < count; n++) {
        const ang = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * radius;
        const px = gx + Math.cos(ang) * r;
        const py = gy + Math.sin(ang) * r;
        if (px < 0.5 || px >= W - 0.5 || py < 0.5 || py >= H - 0.5) continue;
        const idx = (py | 0) * W + (px | 0);
        const dropZ = this.world.surfaceHeight(idx) + dropMin + Math.random() * dropSpan;
        this.spawnParticle(
          pType,
          px,
          py,
          dropZ,
          (Math.random() - 0.5) * spreadV,
          (Math.random() - 0.5) * spreadV,
          vzInit - Math.random() * 6,
          massMin + Math.random() * massSpan,
        );
      }
    };

    if (tool === 'sand') {
      this.sfx.playSandGrain();
      const cnt = Math.min(200, Math.max(3, Math.ceil(areaScale * 2.5 * (dt * 60))));
      dropScatter(PARTICLE_SAND, cnt, 18, 11, 3.4, -7, 0.19, 0.08);
    } else if (tool === 'water') {
      this.sfx.playWaterDrop();
      const cnt = Math.min(220, Math.max(4, Math.ceil(areaScale * 2.8 * (dt * 60))));
      dropScatter(PARTICLE_WATER, cnt, 21, 13, 2.2, -14, 0.26, 0.12);
    } else if (tool === 'stone') {
      const cnt = Math.min(125, Math.max(2, Math.ceil(areaScale * 1.35 * (dt * 60))));
      dropScatter(PARTICLE_STONE, cnt, 22, 9, 0.9, -20, 0.52, 0.24);
    } else if (tool === 'soil') {
      this.sfx.playSandGrain();
      const cnt = Math.min(150, Math.max(3, Math.ceil(areaScale * 1.8 * (dt * 60))));
      dropScatter(PARTICLE_SOIL, cnt, 19, 9, 1.8, -14, 0.36, 0.16);
    } else if (tool === 'lava') {
      this.sfx.playFireCrackle();
      const cnt = Math.min(150, Math.max(3, Math.ceil(areaScale * 1.9 * (dt * 60))));
      dropScatter(PARTICLE_LAVA, cnt, 20, 10, 2.4, -12, 0.24, 0.12);
    } else if (tool === 'snow') {
      this.sfx.playSandGrain();
      const cnt = Math.min(170, Math.max(4, Math.ceil(areaScale * 2.2 * (dt * 60))));
      dropScatter(PARTICLE_SNOW, cnt, 19, 12, 4.2, -2, 0.24, 0.10);
    } else if (tool === 'seeds') {
      this.sfx.playLifeChime();
      const cnt = Math.min(110, Math.max(3, Math.ceil(areaScale * 1.5 * (dt * 60))));
      dropScatter(PARTICLE_SEED, cnt, 17, 10, 3.6, -6, 1.0, 0);
    } else if (tool === 'fire') {
      this.sfx.playFireCrackle();
      const cnt = Math.min(140, Math.max(4, Math.ceil(areaScale * 2.0 * (dt * 60))));
      dropScatter(PARTICLE_FIRE, cnt, 16, 10, 4.4, -11, 0.9, 0.3);
    } else if (tool === 'acid') {
      this.sfx.playSteamHiss();
      const cnt = Math.min(160, Math.max(3, Math.ceil(areaScale * 2.0 * (dt * 60))));
      dropScatter(PARTICLE_ACID, cnt, 20, 11, 2.4, -14, 0.22, 0.10);
    } else if (tool === 'tnt') {
      this.sfx.playUiClick(320);
      const cnt = Math.min(95, Math.max(2, Math.ceil(areaScale * 1.25 * (dt * 60))));
      dropScatter(PARTICLE_TNT, cnt, 16, 7, 0.8, -16, 0.45, 0.15);
    }
  }

  private applyRaiseTerrain(gx: number, gy: number, radius: number, dt: number): void {
    const W = WORLD_W;
    const H = WORLD_H;
    const effR = Math.max(1.5, radius);
    const rCeil = Math.ceil(effR + 1);
    const minX = Math.max(1, Math.floor(gx - rCeil));
    const maxX = Math.min(W - 2, Math.ceil(gx + rCeil));
    const minY = Math.max(1, Math.floor(gy - rCeil));
    const maxY = Math.min(H - 2, Math.ceil(gy + rCeil));
    const power = 8.2 * dt;

    this.sfx.playSandGrain();

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const d = Math.hypot(x - gx, y - gy);
        if (d > effR) continue;
        const smooth = Math.cos((d / effR) * Math.PI * 0.5);
        const add = power * smooth;
        const idx = y * W + x;
        const curH = this.world.solidHeight(idx);

        if (curH > 8.2) {
          this.world.stone[idx] += add;
          this.world.grass[idx] = Math.max(0, this.world.grass[idx] - add);
        } else {
          this.world.soil[idx] += add;
          if (curH + add > this.world.settings.seaLevel + 0.3 && this.world.water[idx] < 0.05) {
            this.world.grass[idx] = Math.min(1.0, this.world.grass[idx] + add * 0.6);
          }
        }
      }
    }
  }

  private applyDig(gx: number, gy: number, radius: number, dt: number): void {
    const W = WORLD_W;
    const H = WORLD_H;
    const effR = Math.max(1.2, radius);
    const rCeil = Math.ceil(effR + 1);
    const minX = Math.max(1, Math.floor(gx - rCeil));
    const maxX = Math.min(W - 2, Math.ceil(gx + rCeil));
    const minY = Math.max(1, Math.floor(gy - rCeil));
    const maxY = Math.min(H - 2, Math.ceil(gy + rCeil));
    const digPower = 9.2 * dt;

    this.sfx.playSandGrain();

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const d = Math.hypot(x - gx, y - gy);
        if (d > effR + 0.35) continue;
        const falloff = Math.max(0.25, 1.0 - (d / (effR + 0.6)) * 0.7);
        let rem = digPower * falloff;
        const idx = y * W + x;

        this.world.flora[idx] = 0;
        this.world.buildings[idx] = 0;
        this.world.snowCover[idx] = 0;
        this.world.tnt[idx] = 0;
        this.world.grass[idx] *= 0.45;

        const layers = [this.world.sand, this.world.glass, this.world.stone];
        for (const layer of layers) {
          if (rem <= 0) break;
          if (layer[idx] > 0) {
            const take = Math.min(layer[idx], rem);
            layer[idx] -= take;
            rem -= take;
          }
        }
        if (rem > 0 && this.world.soil[idx] > 0.35) {
          this.world.soil[idx] = Math.max(0.35, this.world.soil[idx] - rem);
        }
      }
    }
  }

  private applyLevelTerrain(gx: number, gy: number, radius: number, dt: number): void {
    const W = WORLD_W;
    const H = WORLD_H;
    const cx = Math.max(1, Math.min(W - 2, gx | 0));
    const cy = Math.max(1, Math.min(H - 2, gy | 0));

    if (this.levelTargetHeight === null) {
      this.levelTargetHeight = Math.max(1.0, this.world.solidHeight(cy * W + cx));
    }
    const target = this.levelTargetHeight;

    const effR = Math.max(1.8, radius);
    const rCeil = Math.ceil(effR + 1);
    const minX = Math.max(1, Math.floor(gx - rCeil));
    const maxX = Math.min(W - 2, Math.ceil(gx + rCeil));
    const minY = Math.max(1, Math.floor(gy - rCeil));
    const maxY = Math.min(H - 2, Math.ceil(gy + rCeil));

    this.sfx.playSandGrain();

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const d = Math.hypot(x - gx, y - gy);
        if (d > effR) continue;
        const idx = y * W + x;
        const cur = this.world.solidHeight(idx);
        const diff = target - cur;
        if (Math.abs(diff) < 0.03) continue;

        const rate = Math.min(1.0, 9.0 * dt * (1.0 - (d / effR) * 0.5));
        const delta = diff * rate;

        if (delta > 0) {
          this.world.soil[idx] += delta;
          if (cur + delta > this.world.settings.seaLevel + 0.25 && this.world.water[idx] < 0.05) {
            this.world.grass[idx] = Math.min(1.0, this.world.grass[idx] + 0.25);
          }
        } else {
          let rem = -delta;
          this.world.flora[idx] = 0;
          const layers = [this.world.sand, this.world.glass, this.world.stone, this.world.soil];
          for (const l of layers) {
            if (rem <= 0) break;
            const take = Math.min(l[idx], rem);
            l[idx] -= take;
            rem -= take;
          }
          this.world.soil[idx] = Math.max(0.35, this.world.soil[idx]);
        }
      }
    }
  }

  private applyTornadoVortex(gx: number, gy: number, radius: number, dt: number): void {
    const W = WORLD_W;
    const H = WORLD_H;
    const effR = Math.max(5.0, radius * 1.8);
    const rCeil = Math.ceil(effR);
    const minX = Math.max(1, Math.floor(gx - rCeil));
    const maxX = Math.min(W - 2, Math.ceil(gx + rCeil));
    const minY = Math.max(1, Math.floor(gy - rCeil));
    const maxY = Math.min(H - 2, Math.ceil(gy + rCeil));

    this.sfx.playFireCrackle();

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x - gx;
        const dy = y - gy;
        const d = Math.hypot(dx, dy);
        if (d > effR || d < 0.2) continue;

        const idx = y * W + x;
        const falloff = 1.0 - d / effR;
        // Swirl tangential vector (-dy/d, dx/d) + slight inward pull!
        const tx = (-dy / d) * 0.85 - (dx / d) * 0.35;
        const ty = (dx / d) * 0.85 - (dy / d) * 0.35;
        const swirl = falloff * 18.0;

        if (this.world.water[idx] > 0.03) {
          if (tx < 0) this.world.fluxL[idx] += -tx * swirl;
          else this.world.fluxR[idx] += tx * swirl;
          if (ty < 0) this.world.fluxU[idx] += -ty * swirl;
          else this.world.fluxD[idx] += ty * swirl;
          if (Math.random() < 0.25) {
            this.world.foam[idx] = Math.min(0.9, this.world.foam[idx] + 0.45);
          }
        }

        // Lift loose sand, trees & embers up into spinning 3D funnel!
        if (Math.random() < falloff * 14 * dt) {
          const surf = this.world.surfaceHeight(idx);
          if (this.world.flora[idx] !== 0) {
            this.world.flora[idx] = 0;
          }
          if (this.world.sand[idx] > 0.15) {
            const lift = Math.min(this.world.sand[idx], 0.18);
            this.world.sand[idx] -= lift;
            this.spawnParticle(
              PARTICLE_SAND,
              x,
              y,
              surf + 1,
              tx * 18,
              ty * 18,
              22 + Math.random() * 14,
              lift,
            );
          } else if (this.world.fire[idx] > 0.1) {
            this.spawnParticle(
              PARTICLE_EMBER,
              x,
              y,
              surf + 1,
              tx * 20,
              ty * 20,
              24 + Math.random() * 14,
              0,
              0.9,
            );
          }
        }
      }
    }
  }

  public step(dt: number): void {
    this.tickCounter++;
    if (this.meteorCooldown > 0) {
      this.meteorCooldown = Math.max(0, this.meteorCooldown - dt);
    }

    // 0. Dynamic WorldBox Weather, Long Monsoon Rain, Snowfall & Great Floods!
    this.stepWeatherAndFlood(dt);

    // 1. Sky-falling & buoyant 3D particles
    this.updateParticles(dt);

    // 2. Underwater sinking stone & sand (skips full scan when idle, re-checks every 4 ticks)
    if (this.sinkSleepTicks > 0) {
      this.sinkSleepTicks--;
    } else if (!this.updateUnderwaterSinking(dt)) {
      this.sinkSleepTicks = 4;
    }

    // Precompute solid height array ONCE for all fluid + granular passes this substep!
    this.refreshSolidCache();

    // 3. Water Shallow-Water Solver (CFL-tuned single pass) + Viscous Lava Solver
    const fluidDt = 0.078 * Math.min(1.5, dt * 60);
    this.stepShallowWater(fluidDt);
    if (this.lavaSleepTicks > 0) {
      this.lavaSleepTicks--;
    } else if (!this.stepViscousLava(fluidDt * 0.55)) {
      this.lavaSleepTicks = 4;
    }

    // 4. Granular avalanching (Sand, Soil, Heavy Stone) using cached heights
    if ((this.tickCounter & 1) === 0) {
      this.stepGranularPhysics();
    }

    // 5. Thermal, Chemical, Wildfire, Acid, Ice & TNT Chain-Reactions!
    this.stepChemistryAndEcology(dt);

    // 6. Living WorldBox Villagers, Lumberjacks, Settlements & Meteors
    this.entities.update(
      dt,
      this,
      PARTICLE_STONE,
      PARTICLE_SAND,
      PARTICLE_EMBER,
      PARTICLE_SMOKE,
      PARTICLE_WOOD_CHIP,
      PARTICLE_LEAF,
    );
  }

  public triggerWeatherOrFloodPower(tool: ToolId, gx?: number, gy?: number): void {
    const W = WORLD_W;
    const H = WORLD_H;

    if (tool === 'weather_rain') {
      const next = this.world.weather === 'rain' ? 'storm' : 'rain';
      this.world.weather = next;
      this.world.weatherLocked = true;
      this.world.weatherTimer = 120.0;
      this.sfx.playSteamHiss();
      if (this.entities.onWorldEvent) {
        this.entities.onWorldEvent(
          next === 'storm'
            ? '⛈ Грозовой шторм! Проливной ливень стремительно затапливает низины!'
            : '🌧 Затяжной дождь! Реки и озёра начинают медленно выходить из берегов!',
          '#74c0fc',
        );
      }
      return;
    }

    if (tool === 'weather_snow') {
      this.world.weather = 'snow';
      this.world.weatherLocked = true;
      this.world.weatherTimer = 95.0;
      this.sfx.playSandGrain();
      if (this.entities.onWorldEvent) {
        this.entities.onWorldEvent(
          '❄️ Снегопад! Острова укрывает белым снегом, а мелководья замерзают!',
          '#e5f6ff',
        );
      }
      return;
    }

    if (tool === 'weather_clear') {
      this.world.weather = 'clear';
      this.world.weatherLocked = false;
      this.world.weatherTimer = 55.0;
      this.sfx.playLifeChime();
      if (this.entities.onWorldEvent) {
        this.entities.onWorldEvent(
          '☀️ Ясное солнце! Дождь стих, паводковые воды уходят обратно в океан!',
          '#ffd43b',
        );
      }
      return;
    }

    if (tool === 'flood') {
      this.world.weather = 'storm';
      this.world.weatherLocked = true;
      this.world.weatherTimer = 140.0;
      const newSea = Math.min(this.world.baseSeaLevel + 6.4, this.world.settings.seaLevel + 1.6);
      this.world.settings.seaLevel = newSea;
      this.sfx.playExplosion(0.95);
      this.entities.screenShake = Math.max(this.entities.screenShake, 8.0);

      // Push foaming tsunami floodwaters from all sea tiles & optional click epicenter!
      for (let i = 0; i < this.world.size; i++) {
        const h = this.world.solidHeight(i);
        if (h < newSea - 0.15 && this.world.water[i] > 0.05) {
          const targetDepth = newSea - h;
          if (this.world.water[i] < targetDepth) {
            this.world.water[i] += (targetDepth - this.world.water[i]) * 0.48;
            if (targetDepth < 1.6) {
              this.world.foam[i] = 0.85;
            }
          }
        }
      }
      if (gx !== undefined && gy !== undefined) {
        const cx = Math.max(2, Math.min(W - 3, gx | 0));
        const cy = Math.max(2, Math.min(H - 3, gy | 0));
        for (let oy = -7; oy <= 7; oy++) {
          for (let ox = -7; ox <= 7; ox++) {
            if (ox * ox + oy * oy > 49) continue;
            const ni = (cy + oy) * W + (cx + ox);
            this.world.water[ni] += 1.4;
            this.world.foam[ni] = 1.0;
          }
        }
      }

      if (this.entities.onWorldEvent) {
        const rise = (newSea - this.world.baseSeaLevel).toFixed(1);
        this.entities.onWorldEvent(
          `🌊 ВЕЛИКИЙ ПОТОП! Уровень мирового океана поднялся на +${rise}м!`,
          '#3bc9db',
        );
      }
    }
  }

  private stepWeatherAndFlood(dt: number): void {
    const W = WORLD_W;
    const H = WORLD_H;

    // Automatic organic weather cycle when player hasn't locked manual weather
    if (!this.world.weatherLocked) {
      this.world.weatherTimer -= dt;
      if (this.world.weatherTimer <= 0) {
        const r = Math.random();
        if (this.world.weather !== 'clear') {
          this.world.weather = 'clear';
          this.world.weatherTimer = 42.0 + Math.random() * 28.0;
        } else if (r < 0.52) {
          // Natural long rain that can last up to 85s and flood lowlands!
          this.world.weather = 'rain';
          this.world.weatherTimer = 55.0 + Math.random() * 35.0;
          if (this.entities.onWorldEvent) {
            this.entities.onWorldEvent('🌧 Начался долгий дождь над архипелагом...', '#74c0fc');
          }
        } else if (r < 0.78) {
          this.world.weather = 'snow';
          this.world.weatherTimer = 40.0 + Math.random() * 25.0;
          if (this.entities.onWorldEvent) {
            this.entities.onWorldEvent('❄️ С севера пришли снежные тучи!', '#e5f6ff');
          }
        } else {
          this.world.weather = 'storm';
          this.world.weatherTimer = 34.0 + Math.random() * 22.0;
          if (this.entities.onWorldEvent) {
            this.entities.onWorldEvent('⛈ Началась гроза с проливным ливнем!', '#4dabf7');
          }
        }
      }
    }

    const w = this.world.weather;
    const stride = 8;
    const phase = this.tickCounter % stride;

    if (w === 'rain' || w === 'storm') {
      const isStorm = w === 'storm';
      // Long rain steadily raises rivers & sea level so prolonged rain genuinely floods coastal towns!
      const maxRainSea = this.world.baseSeaLevel + (isStorm ? 4.4 : 2.9);
      if (this.world.settings.seaLevel < maxRainSea) {
        this.world.settings.seaLevel = Math.min(
          maxRainSea,
          this.world.settings.seaLevel + (isStorm ? 0.085 : 0.042) * dt,
        );
      }

      // Occasional thunderbolt during thunderstorm!
      if (isStorm && Math.random() < 0.55 * dt) {
        const lx = 12 + Math.random() * (W - 24);
        const ly = 12 + Math.random() * (H - 24);
        this.entities.triggerLightning(lx, ly, this, PARTICLE_EMBER, PARTICLE_SMOKE);
      }

      const dropAdd = (isStorm ? 0.055 : 0.028) * stride * dt;
      for (let i = phase; i < this.world.size; i += stride) {
        this.world.wetness[i] = 1.0;
        if (this.world.fire[i] > 0) {
          this.world.fire[i] = Math.max(0, this.world.fire[i] - 3.2 * stride * dt);
        }
        // Rain accumulates real flowing water on land & swells valleys and rivers!
        this.world.water[i] += dropAdd;
        // Melt snow slowly under rain
        if (this.world.snowCover[i] > 0) {
          const melt = Math.min(this.world.snowCover[i], 0.14 * stride * dt);
          this.world.snowCover[i] -= melt;
          this.world.water[i] += melt * 0.35;
        }
      }
    } else if (w === 'snow') {
      for (let i = phase; i < this.world.size; i += stride) {
        if (this.world.fire[i] > 0) {
          this.world.fire[i] = Math.max(0, this.world.fire[i] - 2.2 * stride * dt);
        }
        if (this.world.lava[i] <= 0.01) {
          if (this.world.water[i] > 0.04 && this.world.water[i] < 1.35) {
            // Freeze shallow lakes, rivers & flooded bays into solid walkable ice!
            const frz = Math.min(this.world.water[i], 0.08 * stride * dt);
            this.world.water[i] -= frz;
            this.world.ice[i] += frz;
          } else if (this.world.water[i] <= 0.04) {
            this.world.snowCover[i] = Math.min(1.1, this.world.snowCover[i] + 0.09 * stride * dt);
          }
        }
      }
    } else {
      // Clear sunny sky: floodwaters gradually recede back into the sea & inland puddles dry!
      if (this.world.settings.seaLevel > this.world.baseSeaLevel) {
        this.world.settings.seaLevel = Math.max(
          this.world.baseSeaLevel,
          this.world.settings.seaLevel - 0.24 * dt,
        );
      }
      for (let i = phase; i < this.world.size; i += stride) {
        const h = this.world.solidHeight(i);
        if (h > this.world.settings.seaLevel + 0.08 && this.world.water[i] > 0) {
          this.world.water[i] = Math.max(0, this.world.water[i] - 0.065 * stride * dt);
        }
        if (h < this.world.baseSeaLevel + 3.2 && this.world.snowCover[i] > 0) {
          this.world.snowCover[i] = Math.max(0, this.world.snowCover[i] - 0.05 * stride * dt);
        }
      }
    }
  }

  private kickWaterSplash(idx: number, impulse: number, foamAdd = 0.35): void {
    this.world.fluxL[idx] += impulse;
    this.world.fluxR[idx] += impulse;
    this.world.fluxU[idx] += impulse;
    this.world.fluxD[idx] += impulse;
    if (foamAdd > 0) {
      this.world.foam[idx] = Math.min(1.0, this.world.foam[idx] + foamAdd);
    }
  }

  private updateParticles(dt: number): void {
    const W = WORLD_W;
    const H = WORLD_H;
    const gScale = this.world.settings.gravityScale;

    let writeIdx = 0;
    for (let i = 0; i < this.count; i++) {
      const type = this.pType[i];
      let life = this.pLife[i] - dt;
      if (life <= 0) continue;

      let x = this.pX[i];
      let y = this.pY[i];
      let z = this.pZ[i];
      let vx = this.pVx[i];
      let vy = this.pVy[i];
      let vz = this.pVz[i];
      const mass = this.pMass[i];

      // Buoyant rising sky particles (Steam, Smoke, Embers)
      if (type === PARTICLE_STEAM || type === PARTICLE_SMOKE || type === PARTICLE_EMBER) {
        if (type === PARTICLE_EMBER) {
          vz -= 28 * dt;
        } else {
          vz += (14 - vz * 0.8) * dt;
        }
        x += (vx + Math.sin(this.tickCounter * 0.08 + this.pSeed[i]) * 2.2) * dt;
        y += vy * dt;
        z += vz * dt;

        if (x < 0.5 || x >= W - 0.5 || y < 0.5 || y >= H - 0.5) continue;
        const surf = this.world.surfaceHeight((y | 0) * W + (x | 0));
        if (type === PARTICLE_EMBER && z <= surf) {
          // Falling spark can ignite forest!
          const landIdx = (y | 0) * W + (x | 0);
          if (this.world.water[landIdx] < 0.02 && this.world.flora[landIdx] !== 0 && Math.random() < 0.35) {
            this.world.fire[landIdx] = 1.0;
          }
          continue;
        }

        this.pType[writeIdx] = type;
        this.pX[writeIdx] = x;
        this.pY[writeIdx] = y;
        this.pZ[writeIdx] = z;
        this.pVx[writeIdx] = vx * 0.96;
        this.pVy[writeIdx] = vy * 0.96;
        this.pVz[writeIdx] = vz;
        this.pMass[writeIdx] = mass;
        this.pLife[writeIdx] = life;
        this.pSeed[writeIdx] = this.pSeed[i];
        writeIdx++;
        continue;
      }

      // Falling particles
      const grav =
        type === PARTICLE_STONE
          ? 168 * gScale
          : type === PARTICLE_SNOW
            ? 28 * gScale
            : type === PARTICLE_SEED
              ? 48 * gScale
              : 108 * gScale;

      if (type === PARTICLE_SNOW) {
        x += Math.sin(this.tickCounter * 0.1 + this.pSeed[i]) * 5.0 * dt;
      }

      vz -= grav * dt;
      x += vx * dt;
      y += vy * dt;
      z += vz * dt;

      if (x < 0.5 || x >= W - 0.5 || y < 0.5 || y >= H - 0.5) continue;

      const gx = x | 0;
      const gy = y | 0;
      const idx = gy * W + gx;
      const surfZ = this.world.surfaceHeight(idx);

      if (z > surfZ) {
        this.pType[writeIdx] = type;
        this.pX[writeIdx] = x;
        this.pY[writeIdx] = y;
        this.pZ[writeIdx] = z;
        this.pVx[writeIdx] = vx;
        this.pVy[writeIdx] = vy;
        this.pVz[writeIdx] = vz;
        this.pMass[writeIdx] = mass;
        this.pLife[writeIdx] = life;
        this.pSeed[writeIdx] = this.pSeed[i];
        writeIdx++;
      } else {
        this.handleParticleLanding(type, x, y, gx, gy, idx, surfZ, mass, this.pSeed[i]);
      }
    }

    this.count = writeIdx;
  }

  private handleParticleLanding(
    type: number,
    x: number,
    y: number,
    gx: number,
    gy: number,
    idx: number,
    surfZ: number,
    mass: number,
    seed: number,
  ): void {
    const W = WORLD_W;
    const wDepth = this.world.water[idx];

    if (type === PARTICLE_SAND) {
      this.world.flora[idx] = 0;
      if (this.world.lava[idx] > 0.05) {
        // Sand falling directly into molten lava melts straight into crystal Glass!
        this.world.glass[idx] += mass;
        return;
      }
      if (wDepth > 0.14) {
        this.world.sinkingSand[idx] += mass;
        this.sinkSleepTicks = 0;
        this.kickWaterSplash(idx, 1.35, 0.22);
      } else {
        this.world.sand[idx] += mass;
        this.world.grass[idx] = Math.max(0, this.world.grass[idx] - 0.55);
      }
    } else if (type === PARTICLE_WATER) {
      this.world.fire[idx] = 0;
      this.world.water[idx] += mass;
      this.world.wetness[idx] = 1.0;
      this.kickWaterSplash(idx, 0.9, Math.random() < 0.15 ? 0.35 : 0.0);
    } else if (type === PARTICLE_STONE) {
      this.world.flora[idx] = 0;
      if (gx > 0) this.world.flora[idx - 1] = 0;
      if (gx < W - 1) this.world.flora[idx + 1] = 0;

      if (wDepth > 0.15) {
        this.sfx.playStoneImpact(true);
        this.world.sinkingStone[idx] += mass;
        this.sinkSleepTicks = 0;
        this.kickWaterSplash(idx, 4.8, 0.65);
        if (Math.random() < 0.55) {
          this.spawnParticle(PARTICLE_SPLASH, x, y, surfZ + 0.35, (Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9, 14, 0, 0.5);
        }
      } else {
        this.sfx.playStoneImpact(false);
        this.world.stone[idx] += mass;
        this.world.grass[idx] = 0;
        if (this.world.sand[idx] > 0.35) {
          const squeeze = Math.min(this.world.sand[idx] * 0.25, 0.15);
          this.world.sand[idx] -= squeeze;
          const nIdx = idx + N8_DY[seed & 3] * W + N8_DX[seed & 3];
          if (nIdx >= 0 && nIdx < this.world.size) this.world.sand[nIdx] += squeeze;
        }
      }
    } else if (type === PARTICLE_SOIL) {
      this.world.soil[idx] += mass;
      this.world.ash[idx] = 0;
      if (wDepth < 0.08 && this.world.solidHeight(idx) > this.world.settings.seaLevel + 0.2) {
        this.world.grass[idx] = Math.min(1.0, this.world.grass[idx] + 0.45);
      } else if (wDepth > 0.15) {
        this.kickWaterSplash(idx, 1.8, 0.25);
      }
    } else if (type === PARTICLE_LAVA) {
      this.world.flora[idx] = 0;
      this.world.snowCover[idx] = 0;
      if (this.world.ice[idx] > 0) {
        this.world.water[idx] += this.world.ice[idx];
        this.world.ice[idx] = 0;
      }
      this.world.lava[idx] += mass;
      this.lavaSleepTicks = 0;
      if (this.world.tnt[idx] > 0.02 && this.world.fuse[idx] <= 0) {
        this.world.fuse[idx] = 0.04;
      }
    } else if (type === PARTICLE_SNOW) {
      this.world.fire[idx] = 0;
      if (this.world.lava[idx] > 0.02) {
        // Quenches lava into stone with steam puff!
        const cool = Math.min(this.world.lava[idx], mass);
        this.world.lava[idx] -= cool;
        this.world.stone[idx] += cool;
        this.sfx.playSteamHiss();
        if (Math.random() < 0.35) {
          this.spawnParticle(PARTICLE_STEAM, x, y, surfZ + 0.5, 0, 0, 8, 0, 1.0);
        }
      } else if (wDepth > 0.04) {
        // Freezes open water directly into walkable crystal Ice!
        const freeze = Math.min(wDepth, mass * 1.35);
        this.world.water[idx] -= freeze;
        this.world.ice[idx] += freeze;
      } else {
        this.world.snowCover[idx] = Math.min(1.6, this.world.snowCover[idx] + mass);
      }
    } else if (type === PARTICLE_SEED) {
      // Magical WorldBox Life Spore: lush grass, wildflowers, palms, oaks & pines!
      this.world.ash[idx] = 0;
      if (wDepth <= 0.03 && this.world.lava[idx] <= 0.01 && this.world.acid[idx] <= 0.01) {
        const h = this.world.solidHeight(idx);
        if (this.world.sand[idx] >= 0.2) {
          if (Math.random() < 0.18 && this.world.flora[idx] === 0) {
            this.world.flora[idx] = 3; // Palm tree on sandy beach!
            this.world.treeHp[idx] = 3;
          }
        } else if (this.world.stone[idx] < 0.55) {
          this.world.grass[idx] = 1.0;
          this.world.snowCover[idx] = Math.max(0, this.world.snowCover[idx] - 0.5);
          if ((this.world.flora[idx] === 0 || this.world.flora[idx] === 5) && this.world.buildings[idx] === 0) {
            const r = Math.random();
            if (h > 6.3 && r < 0.30) {
              this.world.flora[idx] = 2; // Pine
              this.world.treeHp[idx] = 3;
            } else if (r < 0.28) {
              this.world.flora[idx] = 1; // Oak
              this.world.treeHp[idx] = 3;
            } else if (r > 0.82) {
              this.world.flora[idx] = 4; // Flower
            }
          }
        }
      }
    } else if (type === PARTICLE_FIRE) {
      if (this.world.snowCover[idx] > 0 || this.world.ice[idx] > 0) {
        const meltIce = Math.min(this.world.ice[idx], 0.35);
        this.world.ice[idx] -= meltIce;
        this.world.water[idx] += meltIce;
        const meltSnow = Math.min(this.world.snowCover[idx], 0.45);
        this.world.snowCover[idx] -= meltSnow;
        this.world.water[idx] += meltSnow * 0.4;
      } else if (wDepth > 0.03) {
        this.world.water[idx] = Math.max(0, wDepth - 0.06);
        if (Math.random() < 0.25) {
          this.sfx.playSteamHiss();
          this.spawnParticle(PARTICLE_STEAM, x, y, surfZ + 0.5, 0, 0, 9, 0, 0.9);
        }
      } else {
        this.world.fire[idx] = Math.min(1.5, this.world.fire[idx] + mass);
        if (this.world.tnt[idx] > 0.02 && this.world.fuse[idx] <= 0) {
          this.world.fuse[idx] = 0.03;
        }
      }
    } else if (type === PARTICLE_ACID) {
      this.world.acid[idx] += mass;
      this.world.flora[idx] = 0;
    } else if (type === PARTICLE_TNT) {
      this.world.flora[idx] = 0;
      this.world.tnt[idx] += mass;
      if (this.world.fire[idx] > 0.05 || this.world.lava[idx] > 0.02) {
        this.world.fuse[idx] = 0.04;
      }
    }
  }

  private refreshSolidCache(): void {
    const size = this.world.size;
    const out = this.solidCache;
    const { soil, stone, sand, glass, tnt, gunpowder } = this.world;
    for (let i = 0; i < size; i++) {
      out[i] = soil[i] + stone[i] + sand[i] + glass[i] + tnt[i] + gunpowder[i] * 0.5;
    }
  }

  private updateUnderwaterSinking(dt: number): boolean {
    const W = WORLD_W;
    const H = WORLD_H;
    const size = this.world.size;
    const gScale = this.world.settings.gravityScale;
    const { sinkingStone, sinkingSand, stone, sand, water, foam, velX, velY } = this.world;

    const stoneSinkStep = 9.5 * gScale * dt;
    const sandSinkStep = 4.6 * gScale * dt;
    let anyActive = false;

    for (let i = 0; i < size; i++) {
      const sRock = sinkingStone[i];
      if (sRock > 0.0001) {
        anyActive = true;
        const settle = sRock < stoneSinkStep ? sRock : stoneSinkStep > 0.06 ? stoneSinkStep : Math.min(sRock, 0.06);
        sinkingStone[i] = sRock - settle;
        stone[i] += settle;
        if (water[i] > 0.25 && Math.random() < 0.22) {
          foam[i] = Math.min(1.0, foam[i] + 0.35);
        }
        if (sinkingStone[i] <= 0.0005) {
          stone[i] += sinkingStone[i];
          sinkingStone[i] = 0;
        }
      }

      const sSand = sinkingSand[i];
      if (sSand > 0.0001) {
        anyActive = true;
        const settle = sSand < sandSinkStep ? sSand : sandSinkStep > 0.04 ? sandSinkStep : Math.min(sSand, 0.04);
        sinkingSand[i] = sSand - settle;

        let targetIdx = i;
        const vx = velX[i];
        const vy = velY[i];
        if (Math.abs(vx) + Math.abs(vy) > 0.4) {
          const x = i % W;
          const y = (i / W) | 0;
          const nx = Math.min(W - 1, Math.max(0, Math.round(x + Math.sign(vx))));
          const ny = Math.min(H - 1, Math.max(0, Math.round(y + Math.sign(vy))));
          targetIdx = ny * W + nx;
        }

        sand[targetIdx] += settle;
        if (sinkingSand[i] <= 0.0005) {
          sand[i] += sinkingSand[i];
          sinkingSand[i] = 0;
        }
      }
    }
    return anyActive;
  }

  private stepShallowWater(dt: number): void {
    const W = WORLD_W;
    const H = WORLD_H;
    const size = this.world.size;
    const water = this.world.water;
    const ice = this.world.ice;
    const solid = this.solidCache;
    const surfArr = this.surfCache;
    const fluxL = this.world.fluxL;
    const fluxR = this.world.fluxR;
    const fluxU = this.world.fluxU;
    const fluxD = this.world.fluxD;
    const pipeAccel = 26.0 * dt;

    for (let i = 0; i < size; i++) {
      surfArr[i] = solid[i] + ice[i] + water[i];
    }

    for (let y = 0; y < H; y++) {
      const row = y * W;
      for (let x = 0; x < W; x++) {
        const i = row + x;
        const w = water[i];
        if (w <= 0.0004 && fluxL[i] === 0 && fluxR[i] === 0 && fluxU[i] === 0 && fluxD[i] === 0) {
          continue;
        }

        const damp = w < 0.08 ? 0.86 : 0.986;
        const surf = surfArr[i];

        let fL = 0;
        if (x > 0) {
          const v = fluxL[i] * damp + pipeAccel * (surf - surfArr[i - 1]);
          if (v > 0) fL = v;
        }
        let fR = 0;
        if (x < W - 1) {
          const v = fluxR[i] * damp + pipeAccel * (surf - surfArr[i + 1]);
          if (v > 0) fR = v;
        }
        let fU = 0;
        if (y > 0) {
          const v = fluxU[i] * damp + pipeAccel * (surf - surfArr[i - W]);
          if (v > 0) fU = v;
        }
        let fD = 0;
        if (y < H - 1) {
          const v = fluxD[i] * damp + pipeAccel * (surf - surfArr[i + W]);
          if (v > 0) fD = v;
        }

        const sumOut = (fL + fR + fU + fD) * dt;
        if (sumOut > w) {
          if (w <= 0.0001) {
            fL = 0; fR = 0; fU = 0; fD = 0;
          } else {
            const scale = w / sumOut;
            fL *= scale; fR *= scale; fU *= scale; fD *= scale;
          }
        }

        fluxL[i] = fL;
        fluxR[i] = fR;
        fluxU[i] = fU;
        fluxD[i] = fD;
      }
    }

    const velX = this.world.velX;
    const velY = this.world.velY;

    for (let y = 0; y < H; y++) {
      const row = y * W;
      for (let x = 0; x < W; x++) {
        const i = row + x;
        const inL = x > 0 ? fluxR[i - 1] : 0;
        const inR = x < W - 1 ? fluxL[i + 1] : 0;
        const inU = y > 0 ? fluxD[i - W] : 0;
        const inD = y < H - 1 ? fluxU[i + W] : 0;

        const outSum = fluxL[i] + fluxR[i] + fluxU[i] + fluxD[i];
        const net = (inL + inR + inU + inD - outSum) * dt;

        let newW = water[i] + net;
        if (newW < 0.0005) newW = 0;
        water[i] = newW;

        velX[i] = 0.5 * (inL - fluxL[i] + fluxR[i] - inR);
        velY[i] = 0.5 * (inU - fluxU[i] + fluxD[i] - inD);
      }
    }

    if (this.world.settings.openOceanEdges) {
      const sea = this.world.settings.seaLevel;
      for (let x = 0; x < W; x++) {
        this.relaxBorderCell(x, sea);
        this.relaxBorderCell((H - 1) * W + x, sea);
      }
      for (let y = 1; y < H - 1; y++) {
        this.relaxBorderCell(y * W, sea);
        this.relaxBorderCell(y * W + (W - 1), sea);
      }
    }
  }

  private stepViscousLava(dt: number): boolean {
    const W = WORLD_W;
    const H = WORLD_H;
    const lava = this.world.lava;
    const solid = this.solidCache;
    const fL = this.world.lFluxL;
    const fR = this.world.lFluxR;
    const fU = this.world.lFluxU;
    const fD = this.world.lFluxD;
    const lavaAccel = 8.5 * dt;
    let anyActive = false;

    for (let y = 0; y < H; y++) {
      const row = y * W;
      for (let x = 0; x < W; x++) {
        const i = row + x;
        const lv = lava[i];
        if (lv <= 0.001 && fL[i] === 0 && fR[i] === 0 && fU[i] === 0 && fD[i] === 0) continue;
        anyActive = true;

        const damp = 0.80;
        const surf = solid[i] + lv;

        let oL = x > 0 ? Math.max(0, fL[i] * damp + lavaAccel * (surf - (solid[i - 1] + lava[i - 1]))) : 0;
        let oR = x < W - 1 ? Math.max(0, fR[i] * damp + lavaAccel * (surf - (solid[i + 1] + lava[i + 1]))) : 0;
        let oU = y > 0 ? Math.max(0, fU[i] * damp + lavaAccel * (surf - (solid[i - W] + lava[i - W]))) : 0;
        let oD = y < H - 1 ? Math.max(0, fD[i] * damp + lavaAccel * (surf - (solid[i + W] + lava[i + W]))) : 0;

        const sumOut = (oL + oR + oU + oD) * dt;
        if (sumOut > lv) {
          const s = lv <= 0.0001 ? 0 : lv / sumOut;
          oL *= s; oR *= s; oU *= s; oD *= s;
        }
        fL[i] = oL; fR[i] = oR; fU[i] = oU; fD[i] = oD;
      }
    }

    if (!anyActive) return false;

    for (let y = 0; y < H; y++) {
      const row = y * W;
      for (let x = 0; x < W; x++) {
        const i = row + x;
        const inL = x > 0 ? fR[i - 1] : 0;
        const inR = x < W - 1 ? fL[i + 1] : 0;
        const inU = y > 0 ? fD[i - W] : 0;
        const inD = y < H - 1 ? fU[i + W] : 0;
        const net = (inL + inR + inU + inD - (fL[i] + fR[i] + fU[i] + fD[i])) * dt;
        const nextLv = lava[i] + net;
        lava[i] = nextLv < 0.0006 ? 0 : nextLv;
      }
    }
    return true;
  }

  private relaxBorderCell(idx: number, seaLevel: number): void {
    const targetW = seaLevel - this.solidCache[idx] - this.world.ice[idx];
    const clamped = targetW > 0 ? targetW : 0;
    this.world.water[idx] += (clamped - this.world.water[idx]) * 0.24;
  }

  private stepGranularPhysics(): void {
    const W = WORLD_W;
    const H = WORLD_H;
    const sand = this.world.sand;
    const stone = this.world.stone;
    const solid = this.solidCache;
    const water = this.world.water;
    const wetness = this.world.wetness;
    const slipFlash = this.world.slipFlash;
    const flora = this.world.flora;

    const flipX = (this.tickCounter & 1) === 1;
    const flipY = (this.tickCounter & 2) === 2;
    const startOff = this.tickCounter & 7;

    for (let yi = 0; yi < H; yi++) {
      const y = flipY ? H - 1 - yi : yi;
      const row = y * W;

      for (let xi = 0; xi < W; xi++) {
        const x = flipX ? W - 1 - xi : xi;
        const i = row + x;

        const sandAmt = sand[i];
        const stoneAmt = stone[i];
        if (sandAmt < 0.015 && stoneAmt < 0.05) continue;

        const hSelf = solid[i];

        if (sandAmt >= 0.015) {
          const isWet = water[i] > 0.05 || wetness[i] > 0.35;
          const repose = isWet ? 0.30 : 0.52;

          let bestNeighbor = -1;
          let maxExcess = 0;

          for (let k = 0; k < 8; k++) {
            const dir = (k + startOff) & 7;
            const nx = x + N8_DX[dir];
            const ny = y + N8_DY[dir];
            if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
            const ni = ny * W + nx;
            const excess = hSelf - solid[ni] - repose * N8_DIST[dir];
            if (excess > maxExcess) {
              maxExcess = excess;
              bestNeighbor = ni;
            }
          }

          if (bestNeighbor >= 0 && maxExcess > 0.01) {
            const move = sandAmt < maxExcess * 0.48 ? sandAmt : maxExcess * 0.48;
            sand[i] = sandAmt - move;
            sand[bestNeighbor] += move;
            solid[i] = hSelf - move;
            solid[bestNeighbor] += move;
            if (move > 0.025) {
              slipFlash[bestNeighbor] = Math.min(1.0, slipFlash[bestNeighbor] + 0.65);
              flora[bestNeighbor] = 0;
            }
            continue;
          }
        }

        if (stoneAmt >= 0.05 && sandAmt < 0.02) {
          const stoneRepose = 2.5;
          let bestNeighbor = -1;
          let maxExcess = 0;

          for (let k = 0; k < 8; k++) {
            const dir = (k + startOff) & 7;
            const nx = x + N8_DX[dir];
            const ny = y + N8_DY[dir];
            if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
            const ni = ny * W + nx;
            const excess = hSelf - solid[ni] - stoneRepose * N8_DIST[dir];
            if (excess > maxExcess) {
              maxExcess = excess;
              bestNeighbor = ni;
            }
          }

          if (bestNeighbor >= 0 && maxExcess > 0.02) {
            const move = stoneAmt < maxExcess * 0.56 ? stoneAmt : maxExcess * 0.56;
            stone[i] = stoneAmt - move;
            stone[bestNeighbor] += move;
            solid[i] = hSelf - move;
            solid[bestNeighbor] += move;
            slipFlash[bestNeighbor] = 1.0;
            flora[bestNeighbor] = 0;
          }
        }
      }
    }
  }

  private stepChemistryAndEcology(dt: number): void {
    const W = WORLD_W;
    const H = WORLD_H;
    const size = this.world.size;
    const {
      water,
      lava,
      acid,
      sand,
      glass,
      stone,
      soil,
      ice,
      snowCover: snow,
      fire,
      ash,
      fuse,
      tnt,
      wetness,
      foam,
      grass,
      flora,
      slipFlash,
      treeShake,
      stumpTimer,
      treeHp,
      buildings,
      buildingHp,
      buildingSettlement,
      gunpowder,
      oil,
      plague,
      road,
      territory,
      velX,
      velY,
    } = this.world;
    const doErosion = this.world.settings.sandErosion;

    // Pass A: Active bounding-window 60Hz reactions (full sweep every 4 ticks to discover external ignitions!)
    const fullChemSweep = (this.tickCounter & 3) === 0;
    const scanStart = fullChemSweep ? 0 : Math.max(0, this.chemMinIdx - W - 2);
    const scanEnd = fullChemSweep ? size - 1 : Math.min(size - 1, this.chemMaxIdx + W + 2);
    let nextMin = size;
    let nextMax = -1;

    for (let i = scanStart; i <= scanEnd; i++) {
      if (fuse[i] + lava[i] + fire[i] + acid[i] + gunpowder[i] <= 0.003) continue;
      if (i < nextMin) nextMin = i;
      if (i > nextMax) nextMax = i;

      const x = i % W;
      const y = (i / W) | 0;

      // 1. TNT Armed Fuse Countdown -> Chain Explosion!
      if (fuse[i] > 0) {
        fuse[i] -= dt;
        if (fuse[i] <= 0 && tnt[i] > 0.01) {
          const charge = Math.min(2.0, 0.75 + tnt[i] * 0.65);
          tnt[i] = 0;
          fuse[i] = 0;
          this.lavaSleepTicks = 0;
          this.entities.detonateExplosion(
            x,
            y,
            6.5 * charge,
            charge,
            false,
            this,
            PARTICLE_STONE,
            PARTICLE_SAND,
            PARTICLE_EMBER,
            PARTICLE_SMOKE,
          );
          continue;
        }
      }

      // 2. Molten Lava Reactions: Water -> Basalt Stone + Steam! Sand -> Crystal Glass!
      const lv = lava[i];
      if (lv > 0.005) {
        this.lavaSleepTicks = 0;
        grass[i] = 0;
        flora[i] = 0;
        snow[i] = 0;
        if (buildings[i] !== 0) {
          buildings[i] = 0;
          fire[i] = 1.3;
        }
        if (tnt[i] > 0.02 && fuse[i] <= 0) {
          fuse[i] = 0.03;
        }

        if (ice[i] > 0) {
          const m = Math.min(ice[i], 3.0 * dt);
          ice[i] -= m;
          water[i] += m;
        }

        if (water[i] > 0.01) {
          const react = Math.min(lv, water[i], 4.2 * dt);
          lava[i] -= react;
          water[i] -= react * 0.9;
          stone[i] += react * 1.15;
          foam[i] = 1.0;
          this.sfx.playSteamHiss();
          if (Math.random() < 0.28) {
            this.spawnParticle(
              PARTICLE_STEAM,
              x + Math.random(),
              y + Math.random(),
              this.world.surfaceHeight(i) + 0.6,
              (Math.random() - 0.5) * 3,
              (Math.random() - 0.5) * 3,
              10 + Math.random() * 8,
              0,
              1.1,
            );
          }
        }

        if (sand[i] > 0.02) {
          const vitrify = Math.min(sand[i], 1.8 * dt);
          sand[i] -= vitrify;
          glass[i] += vitrify;
        }

        if (Math.random() < 2.2 * dt) {
          const dir = (Math.random() * 8) | 0;
          const nx = x + N8_DX[dir];
          const ny = y + N8_DY[dir];
          if (nx >= 0 && nx < W && ny >= 0 && ny < H) {
            const ni = ny * W + nx;
            if (snow[ni] > 0) snow[ni] = Math.max(0, snow[ni] - 0.5);
            if (ice[ni] > 0) {
              const mi = Math.min(ice[ni], 0.35);
              ice[ni] -= mi;
              water[ni] += mi;
            }
            if (tnt[ni] > 0.02 && fuse[ni] <= 0) {
              fuse[ni] = 0.05;
            } else if (water[ni] < 0.02 && (flora[ni] >= 1 || (buildings[ni] >= 2 && buildings[ni] !== 6))) {
              fire[ni] = Math.max(fire[ni], 1.05);
            }
            if (water[ni] > 0.15) {
              const crust = Math.min(lava[i], 0.85 * dt);
              lava[i] -= crust;
              stone[i] += crust;
              if (Math.random() < 0.3) {
                this.sfx.playSteamHiss();
                this.spawnParticle(PARTICLE_STEAM, nx, ny, this.world.surfaceHeight(ni) + 0.5, 0, 0, 11, 0, 1.0);
              }
            }
          }
        }

        if (lava[i] < 0.28) {
          const cool = Math.min(lava[i], 0.035 * dt);
          lava[i] -= cool;
          stone[i] += cool;
        }
        if (Math.random() < 0.008) {
          this.spawnParticle(PARTICLE_EMBER, x, y, this.world.surfaceHeight(i) + 0.5, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, 10 + Math.random() * 10, 0, 0.8);
        }
      }

      // Gunpowder fast chain ignition & Oil roaring inferno!
      if (gunpowder[i] > 0.02 && (fire[i] > 0.05 || lava[i] > 0.01)) {
        gunpowder[i] = 0;
        fire[i] = 1.6;
        this.sfx.playFireCrackle();
        for (let d = 0; d < 8; d++) {
          const nx = x + N8_DX[d];
          const ny = y + N8_DY[d];
          if (nx > 0 && nx < W - 1 && ny > 0 && ny < H - 1) {
            const ni = ny * W + nx;
            if (gunpowder[ni] > 0.02) fire[ni] = 1.6;
            if (tnt[ni] > 0.02 && fuse[ni] <= 0) fuse[ni] = 0.03;
          }
        }
        this.spawnParticle(PARTICLE_EMBER, x + 0.5, y + 0.5, this.world.surfaceHeight(i) + 0.8, (Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9, 13, 0, 0.5);
      }

      if (oil[i] > 0.01 && (fire[i] > 0.05 || lava[i] > 0.01)) {
        oil[i] = Math.max(0, oil[i] - 0.45 * dt);
        fire[i] = 1.5;
        for (let d = 0; d < 8; d++) {
          const nx = x + N8_DX[d];
          const ny = y + N8_DY[d];
          if (nx > 0 && nx < W - 1 && ny > 0 && ny < H - 1) {
            const ni = ny * W + nx;
            if (oil[ni] > 0.02) fire[ni] = 1.5;
          }
        }
      }

      // 3. Controlled, Realistic Living Fire (NO instant island-wide flash-burns!)
      if (fire[i] > 0.01) {
        if (water[i] > 0.02 || snow[i] > 0.05) {
          fire[i] = 0;
          snow[i] = Math.max(0, snow[i] - 0.25);
          if (Math.random() < 0.2) {
            this.spawnParticle(PARTICLE_STEAM, x, y, this.world.surfaceHeight(i) + 0.4, 0, 0, 9, 0, 0.8);
          }
        } else {
          const hasTree = flora[i] >= 1 && flora[i] <= 3;
          const bld = buildings[i];
          const isIntactBld = bld >= 1 && bld !== 6;
          const burnRate = hasTree ? 0.38 : isIntactBld ? 0.3 : 1.08;
          fire[i] = Math.max(0, fire[i] - burnRate * dt);
          grass[i] = Math.max(0, grass[i] - 0.95 * dt);
          ash[i] = Math.min(0.85, ash[i] + 0.65 * dt);

          if (tnt[i] > 0.02 && fuse[i] <= 0) {
            fuse[i] = 0.04;
          }

          if (isIntactBld) {
            buildingHp[i] -= 16 * dt;
            if (buildingHp[i] <= 0) {
              buildings[i] = bld >= 2 ? 6 : 0;
              buildingSettlement[i] = 0;
              buildingHp[i] = 0;
              fire[i] = 0.2;
            }
          }

          if (fire[i] < 0.22 && (hasTree || flora[i] === 6)) {
            flora[i] = hasTree ? 5 : 0;
          }

          if (Math.random() < (hasTree ? 2.6 : 0.45) * dt) {
            const dir = (Math.random() * 8) | 0;
            const nx = x + N8_DX[dir];
            const ny = y + N8_DY[dir];
            if (nx >= 0 && nx < W && ny >= 0 && ny < H) {
              const ni = ny * W + nx;
              const nb = buildings[ni];
              if (tnt[ni] > 0.02 && fuse[ni] <= 0) {
                fuse[ni] = 0.06;
              } else if (
                water[ni] <= 0.01 &&
                fire[ni] <= 0.05 &&
                wetness[ni] < 0.2 &&
                road[ni] < 0.45 &&
                ((flora[ni] >= 1 && flora[ni] <= 3) ||
                  flora[ni] === 6 ||
                  (nb >= 2 && nb !== 6 && Math.random() < 0.45))
              ) {
                fire[ni] = 0.95 + Math.random() * 0.25;
              }
            }
          }

          if (Math.random() < 0.07) {
            this.spawnParticle(
              Math.random() < 0.72 ? PARTICLE_SMOKE : PARTICLE_EMBER,
              x + Math.random(),
              y + Math.random(),
              this.world.surfaceHeight(i) + 0.7,
              (Math.random() - 0.5) * 3,
              (Math.random() - 0.5) * 3,
              8 + Math.random() * 8,
              0,
              0.95,
            );
          }
        }
      }

      // 4. Corrosive Acid Liquid: flows downhill & dissolves stone/sand/glass/soil!
      if (acid[i] > 0.003) {
        flora[i] = 0;
        grass[i] = 0;
        buildings[i] = 0;
        if (tnt[i] > 0.02 && fuse[i] <= 0) {
          fuse[i] = 0.04;
        }

        const eat = Math.min(acid[i] * 1.4, 2.6 * dt);
        let dissolved = 0;
        for (const layer of [sand, glass, stone]) {
          if (layer[i] > 0 && dissolved < eat) {
            const d = Math.min(layer[i], eat - dissolved);
            layer[i] -= d;
            dissolved += d;
          }
        }
        if (dissolved < eat && soil[i] > 0.35) {
          const d = Math.min(soil[i] - 0.35, eat - dissolved);
          soil[i] -= d;
          dissolved += d;
        }
        acid[i] = Math.max(0, acid[i] - (dissolved * 0.65 + (water[i] > 0.6 ? 0.9 * dt : 0.08 * dt)));

        if (acid[i] > 0.02) {
          let lowest = i;
          let minSurf = this.world.surfaceHeight(i);
          for (let d = 0; d < 4; d++) {
            const nx = x + N8_DX[d];
            const ny = y + N8_DY[d];
            if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
            const ni = ny * W + nx;
            const s = this.world.surfaceHeight(ni);
            if (s < minSurf - 0.02) {
              minSurf = s;
              lowest = ni;
            }
          }
          if (lowest !== i) {
            const flow = acid[i] * 0.38;
            acid[i] -= flow;
            acid[lowest] += flow;
          }
        }
      }
    }

    this.chemMinIdx = nextMin;
    this.chemMaxIdx = nextMax;

    // Pass B: 4-phase strided Water Erosion, Moisture, Stump Decay & Grass Ecology (identical rate/sec!)
    const ecoStride = 4;
    const ecoPhase = this.tickCounter & 3;
    const edt = dt * ecoStride;

    for (let i = ecoPhase; i < size; i += ecoStride) {
      if (slipFlash[i] > 0) slipFlash[i] = Math.max(0, slipFlash[i] - 3.2 * edt);
      if (treeShake[i] > 0) treeShake[i] = Math.max(0, treeShake[i] - 4.5 * edt);
      if (plague[i] > 0) plague[i] = Math.max(0, plague[i] - 0.06 * edt);
      if (flora[i] === 5) {
        stumpTimer[i] -= edt;
        if (stumpTimer[i] <= 0) flora[i] = 0;
      }

      const x = i % W;
      const y = (i / W) | 0;
      const w = water[i];
      const vx = velX[i];
      const vy = velY[i];
      const speedSq = vx * vx + vy * vy;

      if (w > 0.02 && speedSq > 1.1025) {
        const speed = Math.sqrt(speedSq);
        if (speed > 1.35) {
          foam[i] = Math.min(0.85, foam[i] + (speed - 1.35) * 0.9 * edt * 8);
        }
        if (doErosion && sand[i] > 0.03) {
          const nx = Math.min(W - 1, Math.max(0, Math.round(x + vx / speed)));
          const ny = Math.min(H - 1, Math.max(0, Math.round(y + vy / speed)));
          const ni = ny * W + nx;
          if (ni !== i) {
            const carry = Math.min(sand[i], 0.088 * (speed - 1.05));
            sand[i] -= carry;
            sand[ni] += carry;
          }
        }
      } else if (foam[i] > 0) {
        foam[i] = Math.max(0, foam[i] - 2.35 * edt);
      }

      if (w > 0.015) {
        wetness[i] = 1.0;
        if (ash[i] > 0) ash[i] = Math.max(0, ash[i] - 0.8 * edt);
        if (w > 0.18 && ice[i] < 0.05) {
          grass[i] = Math.max(0, grass[i] - 0.85 * edt);
          if (flora[i] !== 0 && w > 0.35) flora[i] = 0;
          if (buildings[i] !== 0 && w > 0.45) buildings[i] = 0;
        }
      } else {
        const nearWater =
          (x > 0 && water[i - 1] > 0.05) ||
          (x < W - 1 && water[i + 1] > 0.05) ||
          (y > 0 && water[i - W] > 0.05) ||
          (y < H - 1 && water[i + W] > 0.05);

        if (nearWater) {
          wetness[i] = Math.min(1.0, wetness[i] + 2.4 * edt);
        } else if (wetness[i] > 0) {
          wetness[i] = Math.max(0, wetness[i] - 0.22 * edt);
        }

        if (ash[i] > 0) {
          ash[i] = Math.max(0, ash[i] - 0.035 * edt);
        }

        if (
          stone[i] < 0.25 &&
          sand[i] < 0.2 &&
          glass[i] < 0.1 &&
          tnt[i] < 0.05 &&
          lava[i] <= 0.005 &&
          acid[i] <= 0.005 &&
          fire[i] <= 0.01 &&
          soil[i] > 0.8
        ) {
          if (grass[i] < 1.0 && ash[i] < 0.5) {
            grass[i] = Math.min(1.0, grass[i] + (ash[i] > 0.05 ? 0.18 : 0.08) * edt);
          }
          if (
            grass[i] > 0.85 &&
            flora[i] === 0 &&
            territory[i] === 0 &&
            road[i] < 0.1 &&
            buildings[i] === 0
          ) {
            const hasLivingTreeNeighbor =
              (x > 0 && flora[i - 1] >= 1 && flora[i - 1] <= 3) ||
              (x < W - 1 && flora[i + 1] >= 1 && flora[i + 1] <= 3) ||
              (y > 0 && flora[i - W] >= 1 && flora[i - W] <= 3) ||
              (y < H - 1 && flora[i + W] >= 1 && flora[i + W] <= 3);
            if (hasLivingTreeNeighbor && Math.random() < 0.000016) {
              flora[i] = soil[i] > 6.2 ? 2 : 1;
              treeHp[i] = 3;
            }
          }
        } else if (stone[i] >= 0.3 || sand[i] >= 0.3 || glass[i] >= 0.2) {
          grass[i] = Math.max(0, grass[i] - 1.8 * edt);
        }
      }
    }
  }
}
