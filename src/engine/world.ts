import { mulberry32, NoiseGenerator } from './noise';
import { PhysicsSettings, WeatherType, WORLD_H, WORLD_SIZE, WORLD_W } from './types';

interface IslandMass {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  cosA: number;
  sinA: number;
  amp: number;
}

export class WorldState {
  public readonly width = WORLD_W;
  public readonly height = WORLD_H;
  public readonly size = WORLD_SIZE;

  // Solid terrain & mineral layers
  public soil = new Float32Array(WORLD_SIZE);
  public stone = new Float32Array(WORLD_SIZE);
  public sand = new Float32Array(WORLD_SIZE);
  public glass = new Float32Array(WORLD_SIZE);
  public tnt = new Float32Array(WORLD_SIZE);
  public gunpowder = new Float32Array(WORLD_SIZE);
  public goldOre = new Float32Array(WORLD_SIZE);
  public snowCover = new Float32Array(WORLD_SIZE);
  public snow = this.snowCover;

  // Liquid & frozen layers
  public water = new Float32Array(WORLD_SIZE);
  public ice = new Float32Array(WORLD_SIZE);
  public lava = new Float32Array(WORLD_SIZE);
  public acid = new Float32Array(WORLD_SIZE);
  public oil = new Float32Array(WORLD_SIZE);

  // Material currently sinking through water column
  public sinkingStone = new Float32Array(WORLD_SIZE);
  public sinkingSand = new Float32Array(WORLD_SIZE);

  // 2D Shallow-water virtual pipe fluxes (Water)
  public fluxL = new Float32Array(WORLD_SIZE);
  public fluxR = new Float32Array(WORLD_SIZE);
  public fluxU = new Float32Array(WORLD_SIZE);
  public fluxD = new Float32Array(WORLD_SIZE);
  public velX = new Float32Array(WORLD_SIZE);
  public velY = new Float32Array(WORLD_SIZE);

  // 2D Viscous Lava pipe fluxes
  public lFluxL = new Float32Array(WORLD_SIZE);
  public lFluxR = new Float32Array(WORLD_SIZE);
  public lFluxU = new Float32Array(WORLD_SIZE);
  public lFluxD = new Float32Array(WORLD_SIZE);

  // Surface chemistry, plague & civilization layers
  public wetness = new Float32Array(WORLD_SIZE);
  public foam = new Float32Array(WORLD_SIZE);
  public grass = new Float32Array(WORLD_SIZE);
  public fire = new Float32Array(WORLD_SIZE);
  public ash = new Float32Array(WORLD_SIZE);
  public plague = new Float32Array(WORLD_SIZE);
  public fuse = new Float32Array(WORLD_SIZE);
  public slipFlash = new Float32Array(WORLD_SIZE);

  // 0 = none, 1 = oak, 2 = pine, 3 = fruit/palm, 4 = flower, 5 = chopped stump, 6 = golden wheat
  public flora = new Uint8Array(WORLD_SIZE);
  public treeHp = new Uint8Array(WORLD_SIZE);
  public treeShake = new Float32Array(WORLD_SIZE);
  public stumpTimer = new Float32Array(WORLD_SIZE);

  // Civilization roads, buildings & WorldBox Settlement Territory borders!
  public road = new Float32Array(WORLD_SIZE);
  public territory = new Uint8Array(WORLD_SIZE);

  // 0 = none, 1 = sandbag nest, 2 = barracks, 3 = HQ castle, 4 = depot/factory, 5 = PVO tower, 6 = ruins, 7 = bunker, 8 = barrier, 9 = radar, 10 = silo
  public buildings = new Uint8Array(WORLD_SIZE);
  public buildingHp = new Float32Array(WORLD_SIZE);
  public buildingSettlement = new Uint8Array(WORLD_SIZE);
  public buildingKingdom = new Uint8Array(WORLD_SIZE);
  public totalHouses = 0;

  // Dynamic World Weather & Sea Flood State!
  public weather: WeatherType = 'clear';
  public weatherTimer = 45.0;
  public weatherLocked = false;
  public baseSeaLevel = 4.2;

  public seed = 0;
  public onTerrainRegenerated: (() => void) | null = null;

  public settings: PhysicsSettings = {
    gravityScale: 1.0,
    seaLevel: 4.2,
    openOceanEdges: true,
    sandErosion: true,
    cloudsEnabled: true,
    showCrossSection: true,
    showBorders: true,
  };

  constructor() {
    // Every new game launches a brand-new 100% randomly generated world!
    this.generateRandomWorld();
  }

  public solidHeight(idx: number): number {
    return (
      this.soil[idx] +
      this.stone[idx] +
      this.sand[idx] +
      this.glass[idx] +
      this.tnt[idx] +
      this.gunpowder[idx] * 0.5
    );
  }

  public surfaceHeight(idx: number): number {
    return (
      this.soil[idx] +
      this.stone[idx] +
      this.sand[idx] +
      this.glass[idx] +
      this.tnt[idx] +
      this.gunpowder[idx] * 0.5 +
      this.snowCover[idx] * 0.35 +
      this.water[idx] +
      this.ice[idx] +
      this.lava[idx] +
      this.acid[idx] +
      this.oil[idx]
    );
  }

  public clearAll(): void {
    this.clearAllArrays();
  }

  public clearAllArrays(): void {
    this.soil.fill(0);
    this.stone.fill(0);
    this.sand.fill(0);
    this.glass.fill(0);
    this.tnt.fill(0);
    this.gunpowder.fill(0);
    this.goldOre.fill(0);
    this.snowCover.fill(0);

    this.water.fill(0);
    this.ice.fill(0);
    this.lava.fill(0);
    this.acid.fill(0);
    this.oil.fill(0);

    this.sinkingStone.fill(0);
    this.sinkingSand.fill(0);

    this.fluxL.fill(0);
    this.fluxR.fill(0);
    this.fluxU.fill(0);
    this.fluxD.fill(0);
    this.velX.fill(0);
    this.velY.fill(0);

    this.lFluxL.fill(0);
    this.lFluxR.fill(0);
    this.lFluxU.fill(0);
    this.lFluxD.fill(0);

    this.wetness.fill(0);
    this.foam.fill(0);
    this.grass.fill(0);
    this.fire.fill(0);
    this.ash.fill(0);
    this.plague.fill(0);
    this.fuse.fill(0);
    this.slipFlash.fill(0);
    this.flora.fill(0);
    this.treeHp.fill(0);
    this.treeShake.fill(0);
    this.stumpTimer.fill(0);
    this.road.fill(0);
    this.territory.fill(0);
    this.buildings.fill(0);
    this.buildingHp.fill(0);
    this.buildingSettlement.fill(0);
    this.buildingKingdom.fill(0);
    this.totalHouses = 0;
  }

  public generateRandomWorld(customSeed?: number): void {
    this.seed =
      customSeed !== undefined
        ? customSeed >>> 0
        : ((Math.floor(Math.random() * 0x7fffffff) ^ (Date.now() & 0xfffffff)) >>> 0) || 777123;

    this.clearAllArrays();
    this.settings.openOceanEdges = true;
    this.baseSeaLevel = 4.2;
    this.settings.seaLevel = 4.2;
    this.weather = 'clear';
    this.weatherTimer = 38.0 + Math.random() * 25.0;
    this.weatherLocked = false;

    const rng = mulberry32(this.seed ^ 0x9e3779b9);
    const noise = new NoiseGenerator(this.seed);

    const W = this.width;
    const H = this.height;
    const sea = this.settings.seaLevel;

    // Roll 3..6 distinct continents/islands with repulsive spacing so every game looks unique!
    const numMasses = 3 + Math.floor(rng() * 4);
    const masses: IslandMass[] = [];

    for (let m = 0; m < numMasses; m++) {
      let cx = W * 0.5;
      let cy = H * 0.5;
      let bestDist = -1;

      for (let attempt = 0; attempt < 24; attempt++) {
        const tx = W * (0.16 + rng() * 0.68);
        const ty = H * (0.18 + rng() * 0.64);
        let minD = 9999;
        for (const prev of masses) {
          minD = Math.min(minD, Math.hypot(tx - prev.cx, ty - prev.cy));
        }
        if (minD > bestDist) {
          bestDist = minD;
          cx = tx;
          cy = ty;
        }
      }

      const isMajor = m < 2;
      const rx = isMajor ? W * (0.21 + rng() * 0.12) : W * (0.11 + rng() * 0.09);
      const ry = isMajor ? H * (0.26 + rng() * 0.14) : H * (0.15 + rng() * 0.11);
      const ang = rng() * Math.PI * 2;
      masses.push({
        cx,
        cy,
        rx,
        ry,
        cosA: Math.cos(ang),
        sinA: Math.sin(ang),
        amp: isMajor ? 1.05 + rng() * 0.22 : 0.84 + rng() * 0.22,
      });
    }

    // Optional volcanic crater(s) (0..2) at randomized continent coordinates
    const numCraters = rng() < 0.3 ? 0 : 1 + (rng() < 0.4 ? 1 : 0);
    const craters: { x: number; y: number; r: number }[] = [];
    for (let c = 0; c < numCraters; c++) {
      const host = masses[c % masses.length];
      craters.push({
        x: host.cx + (rng() - 0.5) * host.rx * 0.6,
        y: host.cy + (rng() - 0.5) * host.ry * 0.6,
        r: 11 + rng() * 7,
      });
    }

    // Optional winding river channel (0..2) carving natural straits/rivers across continents!
    const numRivers = 1 + (rng() < 0.5 ? 1 : 0);
    const rivers: { x0: number; y0: number; dirX: number; dirY: number; phase: number; freq: number }[] = [];
    for (let rv = 0; rv < numRivers; rv++) {
      const host = masses[rv % masses.length];
      const a = rng() * Math.PI * 2;
      rivers.push({
        x0: host.cx,
        y0: host.cy,
        dirX: Math.cos(a),
        dirY: Math.sin(a),
        phase: rng() * Math.PI * 2,
        freq: 0.045 + rng() * 0.035,
      });
    }

    const noiseScale = 52 + rng() * 16;
    const mtnThreshold = 7.45 + rng() * 0.7;

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = y * W + x;
        const nx = x / noiseScale;
        const ny = y / noiseScale;

        let mask = 0;
        for (let m = 0; m < masses.length; m++) {
          const mass = masses[m];
          const dx = x - mass.cx;
          const dy = y - mass.cy;
          const ux = (dx * mass.cosA + dy * mass.sinA) / mass.rx;
          const uy = (-dx * mass.sinA + dy * mass.cosA) / mass.ry;
          const d2 = ux * ux + uy * uy;
          const val = (1.12 - d2) * mass.amp;
          if (val > mask) mask = val;
        }

        const coastWarp = noise.warpedFbm(nx * 1.2, ny * 1.2, 1.05, 5);
        const fineDetail = noise.fbm(nx * 3.9, ny * 3.9, 4) * 0.6;
        const ridge = noise.ridged(nx * 2.05 + 4.3, ny * 2.05 - 2.7, 4);

        let base = 1.05 + mask * 6.85 + coastWarp * 3.85 + fineDetail;

        // Smooth natural ocean margin around world borders
        const edgeDist = Math.min(x / 22, (W - 1 - x) / 22, y / 18, (H - 1 - y) / 18, 1.0);
        base = base * (0.26 + 0.74 * edgeDist);

        // Carve natural meandering rivers across islands!
        for (let rv = 0; rv < rivers.length; rv++) {
          const rObj = rivers[rv];
          const rx = x - rObj.x0;
          const ry = y - rObj.y0;
          const along = rx * rObj.dirX + ry * rObj.dirY;
          const perp =
            -rx * rObj.dirY +
            ry * rObj.dirX +
            Math.sin(along * rObj.freq + rObj.phase) * 9.5;
          const distRiver = Math.abs(perp);
          if (distRiver < 3.4 && along > -8) {
            base -= (1.0 - distRiver / 3.4) * 2.65;
          }
        }

        base = Math.max(0.55, base);

        let rockAdd = 0;
        let sandAdd = 0;
        let soilVal = base;

        if (base > mtnThreshold + 1.35) {
          const mtnFactor = (base - (mtnThreshold + 1.35)) * (0.65 + ridge * 1.55);
          rockAdd = mtnFactor * 1.45;
          soilVal = mtnThreshold + 1.35 + (base - (mtnThreshold + 1.35)) * 0.14;
        }

        for (let c = 0; c < craters.length; c++) {
          const cr = craters[c];
          const dc = Math.hypot(x - cr.x, y - cr.y) / cr.r;
          if (dc < 1.32) {
            if (dc > 0.84) {
              const rim = Math.sin(((dc - 0.84) / 0.48) * Math.PI);
              rockAdd += rim * 3.1;
            } else {
              const bowl = 1.0 - (dc / 0.84) * (dc / 0.84);
              soilVal = Math.max(2.2, soilVal - bowl * 3.3);
              rockAdd = Math.max(0.45, rockAdd + 0.7 - bowl * 1.3);
            }
          }
        }

        // Golden sandy beaches along shorelines & shallow reefs!
        const totalEst = soilVal + rockAdd;
        if (totalEst > sea - 1.15 && totalEst < sea + 1.18 && rockAdd < 0.45) {
          sandAdd = (1.18 - Math.abs(totalEst - sea)) * 0.92;
          soilVal = Math.max(0.5, soilVal - sandAdd * 0.68);
        }

        this.soil[idx] = soilVal;
        this.stone[idx] = rockAdd;
        this.sand[idx] = sandAdd;

        // Scatter shiny Gold Ore deposits on mountain foothills!
        if (
          rockAdd > 0.25 &&
          rockAdd < 2.6 &&
          noise.fbm(nx * 9.5 + 31.7, ny * 9.5 - 12.4, 3) > 0.46
        ) {
          this.goldOre[idx] = 1.0;
        }
      }
    }

    this.populateInitialWaterAndFlora(rng, noise);
    if (this.onTerrainRegenerated) this.onTerrainRegenerated();
  }

  private populateInitialWaterAndFlora(rng: () => number, noise: NoiseGenerator): void {
    const W = this.width;
    const H = this.height;
    const sea = this.settings.seaLevel;

    for (let i = 0; i < this.size; i++) {
      const x = i % W;
      const y = (i / W) | 0;
      const h = this.solidHeight(i);

      if (h < sea) {
        this.water[i] = sea - h;
        this.wetness[i] = 1.0;
      } else {
        this.water[i] = 0;
        this.wetness[i] = h < sea + 0.3 ? 0.55 : 0;

        // Lush WorldBox meadows, pine highlands, orchards & wildflowers!
        if (this.sand[i] < 0.22 && this.stone[i] < 0.35 && h >= sea + 0.2) {
          this.grass[i] = 1.0;
          const forestPatch = noise.fbm(x / 18.0 + 11.2, y / 18.0 + 4.7, 3);
          if (forestPatch > -0.05 && rng() < 0.42) {
            if (h > sea + 2.3) {
              this.flora[i] = 2; // Pine
              this.treeHp[i] = 4;
            } else if (rng() < 0.24) {
              this.flora[i] = 3; // Apple/Fruit Oak
              this.treeHp[i] = 4;
            } else {
              this.flora[i] = 1; // Lush Oak
              this.treeHp[i] = 4;
            }
          } else if (rng() < 0.045) {
            this.flora[i] = 4; // Wildflower
          }
        } else if (
          this.sand[i] >= 0.22 &&
          h >= sea + 0.3 &&
          h <= sea + 1.25 &&
          rng() < 0.032
        ) {
          this.flora[i] = 3;
          this.treeHp[i] = 3;
        }
      }
    }

    for (let x = 0; x < W; x++) {
      this.flora[x] = 0;
      this.flora[(H - 1) * W + x] = 0;
    }
  }
}

export { WorldState as World };

