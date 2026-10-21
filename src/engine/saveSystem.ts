import { exportWorldJson } from '../platform/mobileBridge';
import { EntityManager, Settlement } from './entities';
import { KINGDOM_PALETTES } from './models';
import { SavedWorldSummary, WeatherType, WORLD_H, WORLD_W } from './types';
import { WorldState } from './world';

const STORAGE_INDEX_KEY = 'ttydyn_world_saves_index_v2';
const STORAGE_SLOT_PREFIX = 'ttydyn_world_slot_v2_';

export interface SavedUnitRecord {
  x: number;
  y: number;
  z: number;
  kingdom: number;
  settlement: number;
  role: number;
  state: number;
  wood: number;
  hp: number;
  maxHp: number;
  blessed: number;
  infected?: number;
  traits?: number;
  kills?: number;
  age?: number;
  variant: number;
}

export interface SavedDragonRecord {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
}

export interface SerializedWorldPayload {
  version: 2;
  summary: SavedWorldSummary;
  seaLevel: number;
  baseSeaLevel?: number;
  weather?: WeatherType;
  weatherLocked?: boolean;
  warMatrix: number[];
  heightLayersB64: Record<string, string>;
  byteLayersB64: Record<string, string>;
  settlements: Settlement[];
  units: SavedUnitRecord[];
  dragons: SavedDragonRecord[];
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

/** Fast RLE encoder for Uint8Array: [count (1..255), value] pairs */
function encodeRleUint8(arr: Uint8Array): string {
  const out: number[] = [];
  let i = 0;
  const n = arr.length;
  while (i < n) {
    const val = arr[i];
    let run = 1;
    while (i + run < n && arr[i + run] === val && run < 255) {
      run++;
    }
    out.push(run, val);
    i += run;
  }
  return uint8ToBase64(new Uint8Array(out));
}

function decodeRleUint8(b64: string, target: Uint8Array): void {
  const src = base64ToUint8(b64);
  let outIdx = 0;
  for (let i = 0; i + 1 < src.length && outIdx < target.length; i += 2) {
    const run = src[i];
    const val = src[i + 1];
    target.fill(val, outIdx, Math.min(target.length, outIdx + run));
    outIdx += run;
  }
}

/**
 * Compact delta + zero-run encoder for continuous Float32 terrain heights (1/128 unit precision).
 * Compresses full 64,000-cell world height maps into ~110 KB Base64 synchronously in <2ms!
 */
function encodeFloatHeight(arr: Float32Array): string {
  const out: number[] = [];
  let prev = 0;
  let i = 0;
  const n = arr.length;
  while (i < n) {
    const q = Math.max(-32767, Math.min(32767, Math.round(arr[i] * 128)));
    if (q === prev) {
      let run = 1;
      while (
        i + run < n &&
        Math.max(-32767, Math.min(32767, Math.round(arr[i + run] * 128))) === prev &&
        run < 255
      ) {
        run++;
      }
      if (run >= 3) {
        out.push(0x80, run);
        i += run;
        continue;
      }
    }
    const diff = q - prev;
    if (diff >= -125 && diff <= 125) {
      out.push((diff + 126) & 0xff);
    } else {
      out.push(0xff, (q >> 8) & 0xff, q & 0xff);
    }
    prev = q;
    i++;
  }
  return uint8ToBase64(new Uint8Array(out));
}

function decodeFloatHeight(b64: string, target: Float32Array): void {
  const src = base64ToUint8(b64);
  let prev = 0;
  let outIdx = 0;
  let i = 0;
  while (i < src.length && outIdx < target.length) {
    const tag = src[i++];
    if (tag === 0x80) {
      const run = src[i++];
      const val = prev / 128;
      const end = Math.min(target.length, outIdx + run);
      target.fill(val, outIdx, end);
      outIdx = end;
    } else if (tag === 0xff) {
      const hi = src[i++];
      const lo = src[i++];
      let q = (hi << 8) | lo;
      if (q >= 0x8000) q -= 0x10000;
      prev = q;
      target[outIdx++] = prev / 128;
    } else {
      prev += tag - 126;
      target[outIdx++] = prev / 128;
    }
  }
}

function encodeScaledByteLayer(arr: Float32Array, scale = 100): string {
  const tmp = new Uint8Array(arr.length);
  for (let i = 0; i < arr.length; i++) {
    tmp[i] = Math.max(0, Math.min(255, Math.round(arr[i] * scale)));
  }
  return encodeRleUint8(tmp);
}

function decodeScaledByteLayer(b64: string, target: Float32Array, scale = 100): void {
  const tmp = new Uint8Array(target.length);
  decodeRleUint8(b64, tmp);
  for (let i = 0; i < target.length; i++) {
    target[i] = tmp[i] / scale;
  }
}

/** Generate a crisp 80x50 color minimap dataURL showing oceans, beaches, forests & kingdom borders */
export function buildWorldMinimapDataUrl(world: WorldState, entities: EntityManager): string {
  if (typeof document === 'undefined') return '';
  const mw = 80;
  const mh = 50;
  const c = document.createElement('canvas');
  c.width = mw;
  c.height = mh;
  const ctx = c.getContext('2d');
  if (!ctx) return '';
  const img = ctx.createImageData(mw, mh);
  const d = img.data;

  for (let py = 0; py < mh; py++) {
    const wy = Math.min(WORLD_H - 1, py * 4 + 1);
    for (let px = 0; px < mw; px++) {
      const wx = Math.min(WORLD_W - 1, px * 4 + 1);
      const idx = wy * WORLD_W + wx;
      const o = (py * mw + px) * 4;
      const water = world.water[idx];
      const h = world.solidHeight(idx);

      let r = 24;
      let g = 98;
      let b = 158;

      if (water > 0.05) {
        if (water < 0.8) {
          r = 56;
          g = 178;
          b = 204;
        } else if (water < 2.2) {
          r = 32;
          g = 128;
          b = 182;
        }
      } else if (world.lava[idx] > 0.05) {
        r = 250;
        g = 96;
        b = 24;
      } else if (world.snowCover[idx] > 0.1 || h > 9.4) {
        r = 236;
        g = 244;
        b = 252;
      } else if (world.stone[idx] > 0.4 || h > 7.4) {
        r = 128;
        g = 132;
        b = 140;
      } else if (world.sand[idx] > 0.25 || h < world.settings.seaLevel + 0.55) {
        r = 232;
        g = 206;
        b = 142;
      } else if (world.flora[idx] >= 1 && world.flora[idx] <= 3) {
        r = 38;
        g = 116;
        b = 46;
      } else {
        r = 96;
        g = 174;
        b = 68;
      }

      const sid = world.territory[idx];
      if (sid > 0 && water <= 0.05) {
        const sObj = entities.getSettlementById(sid);
        if (sObj) {
          const [kr, kg, kb] = KINGDOM_PALETTES[sObj.kingdom % KINGDOM_PALETTES.length].rgb;
          r = Math.round(r * 0.42 + kr * 0.58);
          g = Math.round(g * 0.42 + kg * 0.58);
          b = Math.round(b * 0.42 + kb * 0.58);
        }
      }

      d[o] = r;
      d[o + 1] = g;
      d[o + 2] = b;
      d[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL('image/png');
}

export function serializeWorldState(
  world: WorldState,
  entities: EntityManager,
  customName?: string,
  existingId?: string,
): SerializedWorldPayload {
  const id = existingId || `slot_${Date.now()}_${Math.floor(Math.random() * 9999)}`;

  let popCount = 0;
  const units: SavedUnitRecord[] = [];
  for (let i = 0; i < entities.humanCount; i++) {
    if (entities.hRole[i] <= 2) popCount++;
    units.push({
      x: Math.round(entities.hx[i] * 100) / 100,
      y: Math.round(entities.hy[i] * 100) / 100,
      z: Math.round(entities.hz[i] * 100) / 100,
      kingdom: entities.hKingdom[i],
      settlement: entities.hSettlement[i],
      role: entities.hRole[i],
      state: entities.hState[i],
      wood: entities.hWood[i],
      hp: Math.round(entities.hHp[i]),
      maxHp: Math.round(entities.hMaxHp[i]),
      blessed: entities.hBlessed[i],
      infected: Math.round(entities.hInfected[i] * 100) / 100,
      traits: entities.hTraits[i],
      kills: entities.hKills[i],
      age: Math.round(entities.hAge[i]),
      variant: entities.hVariant[i],
    });
  }

  const dragons: SavedDragonRecord[] = [];
  for (let d = 0; d < entities.dragonCount; d++) {
    dragons.push({
      x: Math.round(entities.dx[d] * 100) / 100,
      y: Math.round(entities.dy[d] * 100) / 100,
      z: Math.round(entities.dz[d] * 100) / 100,
      vx: Math.round(entities.dvx[d] * 100) / 100,
      vy: Math.round(entities.dvy[d] * 100) / 100,
      hp: Math.round(entities.dHp[d]),
      maxHp: Math.round(entities.dMaxHp[d]),
    });
  }

  const summary: SavedWorldSummary = {
    id,
    name: customName?.trim() || `Мир #${world.seed % 10000}`,
    seed: world.seed,
    savedAt: new Date().toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }),
    population: popCount,
    houses: world.totalHouses,
    thumbnailDataUrl: buildWorldMinimapDataUrl(world, entities),
  };

  return {
    version: 2,
    summary,
    seaLevel: world.settings.seaLevel,
    baseSeaLevel: world.baseSeaLevel,
    weather: world.weather,
    weatherLocked: world.weatherLocked,
    warMatrix: Array.from(entities.warMatrix),
    heightLayersB64: {
      soil: encodeFloatHeight(world.soil),
      sand: encodeFloatHeight(world.sand),
      stone: encodeFloatHeight(world.stone),
      water: encodeFloatHeight(world.water),
    },
    byteLayersB64: {
      snow: encodeScaledByteLayer(world.snowCover, 50),
      ice: encodeScaledByteLayer(world.ice, 50),
      lava: encodeScaledByteLayer(world.lava, 40),
      glass: encodeScaledByteLayer(world.glass, 50),
      acid: encodeScaledByteLayer(world.acid, 50),
      tnt: encodeScaledByteLayer(world.tnt, 50),
      grass: encodeScaledByteLayer(world.grass, 100),
      ash: encodeScaledByteLayer(world.ash, 100),
      fire: encodeScaledByteLayer(world.fire, 50),
      road: encodeScaledByteLayer(world.road, 100),
      oil: encodeScaledByteLayer(world.oil, 60),
      gunpowder: encodeScaledByteLayer(world.gunpowder, 100),
      goldOre: encodeScaledByteLayer(world.goldOre, 100),
      plague: encodeScaledByteLayer(world.plague, 100),
      buildingHp: encodeScaledByteLayer(world.buildingHp, 1),
      flora: encodeRleUint8(world.flora),
      treeHp: encodeRleUint8(world.treeHp),
      buildings: encodeRleUint8(world.buildings),
      buildingKingdom: encodeRleUint8(world.buildingKingdom),
      buildingSettlement: encodeRleUint8(world.buildingSettlement),
      territory: encodeRleUint8(world.territory),
    },
    settlements: entities.settlements.map((s) => ({ ...s })),
    units,
    dragons,
  };
}

export function deserializeWorldState(
  payload: SerializedWorldPayload,
  world: WorldState,
  entities: EntityManager,
): void {
  world.clearAllArrays();
  world.seed = payload.summary.seed;
  world.baseSeaLevel = payload.baseSeaLevel ?? 4.2;
  world.settings.seaLevel = payload.seaLevel ?? 4.2;
  world.weather = payload.weather ?? 'clear';
  world.weatherLocked = payload.weatherLocked ?? false;

  if (payload.heightLayersB64.soil) decodeFloatHeight(payload.heightLayersB64.soil, world.soil);
  if (payload.heightLayersB64.sand) decodeFloatHeight(payload.heightLayersB64.sand, world.sand);
  if (payload.heightLayersB64.stone) decodeFloatHeight(payload.heightLayersB64.stone, world.stone);
  if (payload.heightLayersB64.water) decodeFloatHeight(payload.heightLayersB64.water, world.water);

  const b = payload.byteLayersB64;
  if (b.snow) decodeScaledByteLayer(b.snow, world.snowCover, 50);
  if (b.ice) decodeScaledByteLayer(b.ice, world.ice, 50);
  if (b.lava) decodeScaledByteLayer(b.lava, world.lava, 40);
  if (b.glass) decodeScaledByteLayer(b.glass, world.glass, 50);
  if (b.acid) decodeScaledByteLayer(b.acid, world.acid, 50);
  if (b.tnt) decodeScaledByteLayer(b.tnt, world.tnt, 50);
  if (b.grass) decodeScaledByteLayer(b.grass, world.grass, 100);
  if (b.ash) decodeScaledByteLayer(b.ash, world.ash, 100);
  if (b.fire) decodeScaledByteLayer(b.fire, world.fire, 50);
  if (b.road) decodeScaledByteLayer(b.road, world.road, 100);
  if (b.oil) decodeScaledByteLayer(b.oil, world.oil, 60);
  if (b.gunpowder) decodeScaledByteLayer(b.gunpowder, world.gunpowder, 100);
  if (b.goldOre) decodeScaledByteLayer(b.goldOre, world.goldOre, 100);
  if (b.plague) decodeScaledByteLayer(b.plague, world.plague, 100);
  if (b.buildingHp) decodeScaledByteLayer(b.buildingHp, world.buildingHp, 1);

  if (b.flora) decodeRleUint8(b.flora, world.flora);
  if (b.treeHp) decodeRleUint8(b.treeHp, world.treeHp);
  if (b.buildings) decodeRleUint8(b.buildings, world.buildings);
  if (b.buildingKingdom) decodeRleUint8(b.buildingKingdom, world.buildingKingdom);
  if (b.buildingSettlement) decodeRleUint8(b.buildingSettlement, world.buildingSettlement);
  if (b.territory) decodeRleUint8(b.territory, world.territory);

  let houseCount = 0;
  for (let i = 0; i < world.buildings.length; i++) {
    const bt = world.buildings[i];
    if (bt >= 2 && bt !== 6 && bt !== 8) houseCount++;
  }
  world.totalHouses = houseCount;

  entities.meteorCount = 0;
  entities.arrowCount = 0;
  entities.lightningBolts = [];
  entities.nukeClouds = [];

  entities.warMatrix.fill(0);
  let warCount = 0;
  if (payload.warMatrix) {
    for (let i = 0; i < Math.min(36, payload.warMatrix.length); i++) {
      entities.warMatrix[i] = payload.warMatrix[i];
    }
    for (let k1 = 0; k1 < 6; k1++) {
      for (let k2 = k1 + 1; k2 < 6; k2++) {
        if (entities.warMatrix[k1 * 6 + k2]) warCount++;
      }
    }
  }
  entities.activeWarsCount = warCount;

  entities.settlements = (payload.settlements || []).map((s) => ({
    ...s,
    goldStockpile: s.goldStockpile ?? 0,
  }));

  const units = payload.units || [];
  entities.humanCount = Math.min(units.length, entities.hx.length);
  for (let i = 0; i < entities.humanCount; i++) {
    const u = units[i];
    entities.hx[i] = u.x;
    entities.hy[i] = u.y;
    entities.hz[i] = u.z;
    entities.hvz[i] = 0;
    entities.hTargetX[i] = u.x;
    entities.hTargetY[i] = u.y;
    entities.hTimer[i] = 0.2;
    entities.hKingdom[i] = u.kingdom;
    entities.hSettlement[i] = u.settlement;
    entities.hRole[i] = u.role;
    entities.hState[i] = u.state;
    entities.hTreeIdx[i] = -1;
    entities.hChopProgress[i] = 0;
    entities.hWood[i] = u.wood;
    entities.hHp[i] = u.hp;
    entities.hMaxHp[i] = u.maxHp;
    entities.hAtkCooldown[i] = 0;
    entities.hPlague[i] = 0;
    entities.hInfected[i] = u.infected ?? 0;
    entities.hBlessed[i] = u.blessed;
    entities.hAge[i] = u.age ?? 18;
    entities.hTraits[i] = u.traits ?? 0;
    entities.hKills[i] = u.kills ?? 0;
    entities.hUid[i] = entities.nextUnitUid++;
    entities.hVariant[i] = u.variant;
    entities.hFacing[i] = 1;
    entities.hWalkPhase[i] = 0;
  }

  const dragons = payload.dragons || [];
  entities.dragonCount = Math.min(dragons.length, entities.dx.length);
  for (let d = 0; d < entities.dragonCount; d++) {
    entities.dx[d] = dragons[d].x;
    entities.dy[d] = dragons[d].y;
    entities.dz[d] = dragons[d].z;
    entities.dvx[d] = dragons[d].vx;
    entities.dvy[d] = dragons[d].vy;
    entities.dHp[d] = dragons[d].hp;
    entities.dMaxHp[d] = dragons[d].maxHp;
    entities.dBreathTimer[d] = 1.0;
  }

  entities.recomputeTerritories();
}

export class WorldSaveManager {
  listSaves(): SavedWorldSummary[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_INDEX_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as SavedWorldSummary[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  saveWorld(
    world: WorldState,
    entities: EntityManager,
    name?: string,
    overwriteId?: string,
  ): SavedWorldSummary {
    const payload = serializeWorldState(world, entities, name, overwriteId);
    if (typeof localStorage !== 'undefined') {
      const serialized = JSON.stringify(payload);
      localStorage.setItem(STORAGE_SLOT_PREFIX + payload.summary.id, serialized);

      const list = this.listSaves().filter((s) => s.id !== payload.summary.id);
      list.unshift(payload.summary);
      localStorage.setItem(STORAGE_INDEX_KEY, JSON.stringify(list));
    }
    return payload.summary;
  }

  loadWorld(slotId: string, world: WorldState, entities: EntityManager): boolean {
    if (typeof localStorage === 'undefined') return false;
    try {
      const raw = localStorage.getItem(STORAGE_SLOT_PREFIX + slotId);
      if (!raw) return false;
      const payload = JSON.parse(raw) as SerializedWorldPayload;
      deserializeWorldState(payload, world, entities);
      return true;
    } catch {
      return false;
    }
  }

  deleteSave(slotId: string): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(STORAGE_SLOT_PREFIX + slotId);
    const next = this.listSaves().filter((s) => s.id !== slotId);
    localStorage.setItem(STORAGE_INDEX_KEY, JSON.stringify(next));
  }

  exportToFile(world: WorldState, entities: EntityManager, name?: string): void {
    const payload = serializeWorldState(world, entities, name);
    exportWorldJson(`ttydyn-world-${world.seed}.json`, JSON.stringify(payload));
  }

  async importFromFile(
    file: File,
    world: WorldState,
    entities: EntityManager,
  ): Promise<SavedWorldSummary | null> {
    try {
      const text = await file.text();
      const payload = JSON.parse(text) as SerializedWorldPayload;
      if (!payload || !payload.heightLayersB64) return null;
      deserializeWorldState(payload, world, entities);
      return this.saveWorld(world, entities, payload.summary?.name);
    } catch {
      return null;
    }
  }
}
