export const CHUNK_SIZE = 32;
export const CHUNK_SHIFT = 5;
export const CHUNK_MASK = 31;
export const CHUNK_AREA = CHUNK_SIZE * CHUNK_SIZE;

// Legacy radar window size (tiles scanned around camera on minimap)
export const RADAR_SPAN = 160;

// Isometric tile screen geometry (base zoom = 1.0 -> 32x16 classic pixel diamond)
export const ISO_HALF_W = 16;
export const ISO_HALF_H = 8;
export const ISO_WALL_H = 26;

// Ground surface material IDs
export const FLOOR_GRASS = 0;
export const FLOOR_DIRT = 1;
export const FLOOR_ASPHALT = 2;
export const FLOOR_ROAD_LINE = 3;
export const FLOOR_SIDEWALK = 4;
export const FLOOR_WOOD = 5;
export const FLOOR_TILE_WHITE = 6;
export const FLOOR_CONCRETE = 7;
export const FLOOR_WATER = 8;
export const FLOOR_GRAVEL = 9;
export const FLOOR_CARPET = 10;

// Structural tile block IDs (on infinite grid cell [gx, gy])
export const STRUCT_NONE = 0;
export const STRUCT_WALL_BRICK = 1;
export const STRUCT_WALL_WOOD = 2;
export const STRUCT_WALL_CONCRETE = 3;
export const STRUCT_WALL_STORE = 4;
export const STRUCT_DOOR_CLOSED = 5;
export const STRUCT_DOOR_OPEN = 6;
export const STRUCT_WINDOW_INTACT = 7;
export const STRUCT_WINDOW_BROKEN = 8;
export const STRUCT_FENCE_WOOD = 9;
export const STRUCT_FENCE_CHAIN = 10;
export const STRUCT_SANDBAG = 11;
export const STRUCT_RUBBLE = 12;

export function isOpaqueWallStruct(st: number): boolean {
  return (
    st === STRUCT_WALL_BRICK ||
    st === STRUCT_WALL_WOOD ||
    st === STRUCT_WALL_CONCRETE ||
    st === STRUCT_WALL_STORE
  );
}

// Furniture / Interactive Prop IDs
export const PROP_NONE = 0;
export const PROP_TREE_PINE = 1;
export const PROP_TREE_OAK = 2;
export const PROP_STREETLIGHT = 3;
export const PROP_FRIDGE = 4;
export const PROP_SHELF = 5;
export const PROP_MED_CABINET = 6;
export const PROP_GUN_LOCKER = 7;
export const PROP_CRATE = 8;
export const PROP_BED = 9;
export const PROP_GAS_PUMP = 10;
export const PROP_AIRDROP = 11;
export const PROP_TRASH_BIN = 12;
export const PROP_BARREL_FIRE = 13;
export const PROP_WORKBENCH = 14;
export const PROP_GENERATOR = 15;
export const PROP_HYDRANT = 16;
export const PROP_LOG_PILE = 17;
export const PROP_CORPSE = 18;

export interface AnimatedFxBurst {
  kind: 'explosion' | 'slash' | 'muzzle' | 'smoke_puff';
  x: number;
  y: number;
  z: number;
  angle: number;
  age: number;
  duration: number;
  scale: number;
  tint?: 'human' | 'zombie';
}

export type BuildingKind =
  | 'house'
  | 'police'
  | 'supermarket'
  | 'hospital'
  | 'warehouse'
  | 'gas_station'
  | 'military';

export interface RoomRect {
  x0: number;
  y0: number;
  w: number;
  h: number;
  roofColor: string;
}

export interface BuildingInfo {
  id: number;
  kind: BuildingKind;
  name: string;
  x0: number;
  y0: number;
  w: number;
  h: number;
  roofColor: string;
  wallStyle: number;
  isSafehouse: boolean;
  safehouseSquad: number; // 1 = Группа №1 в Полицейском участке!
  woodStock: number;
  expansions: number;
  rooms: RoomRect[];
  survivorsInside: number;
  zombiesInside: number;
  alarmTriggered: boolean;
  alarmTimer: number;
}

// Weapons — Deliberate, tactical Project Zomboid cadence (no arcade machine-gun speed!)
export const WPN_FISTS = 0;
export const WPN_BAT = 1;
export const WPN_AXE = 2;
export const WPN_PISTOL = 3;
export const WPN_SHOTGUN = 4;
export const WPN_RIFLE = 5;

export interface WeaponSpec {
  id: number;
  name: string;
  isGun: boolean;
  range: number;
  damage: number;
  cooldown: number;
  noiseRadius: number;
  pellets: number;
  spread: number;
  knockback: number;
}

export const WEAPONS: WeaponSpec[] = [
  { id: WPN_FISTS, name: 'Толчок / Нож', isGun: false, range: 1.15, damage: 16, cooldown: 1.15, noiseRadius: 4, pellets: 1, spread: 0, knockback: 1.4 },
  { id: WPN_BAT, name: 'Бейсбольная бита', isGun: false, range: 1.38, damage: 34, cooldown: 1.25, noiseRadius: 6, pellets: 1, spread: 0, knockback: 2.6 },
  { id: WPN_AXE, name: 'Пожарный топор', isGun: false, range: 1.42, damage: 52, cooldown: 1.45, noiseRadius: 7, pellets: 1, spread: 0, knockback: 2.2 },
  { id: WPN_PISTOL, name: 'Пистолет M9 (9мм)', isGun: true, range: 12.5, damage: 42, cooldown: 1.30, noiseRadius: 24, pellets: 1, spread: 0.08, knockback: 1.4 },
  { id: WPN_SHOTGUN, name: 'Дробовик JS-2000', isGun: true, range: 8.2, damage: 30, cooldown: 2.10, noiseRadius: 40, pellets: 5, spread: 0.26, knockback: 3.0 },
  { id: WPN_RIFLE, name: 'Винтовка M16', isGun: true, range: 15.5, damage: 36, cooldown: 0.68, noiseRadius: 34, pellets: 1, spread: 0.06, knockback: 1.6 },
];

// Unit Roles
export const ROLE_CIVILIAN = 0;
export const ROLE_POLICE = 1;
export const ROLE_SOLDIER = 2;
export const ROLE_MEDIC = 3;
export const ROLE_RAIDER = 4;
export const ROLE_ZOMBIE_SHAMBLER = 5;
export const ROLE_ZOMBIE_SPRINTER = 6;
export const ROLE_ZOMBIE_ARMORED = 7;
export const ROLE_ZOMBIE_CRAWLER = 8;

export function isZombieRole(role: number): boolean {
  return role >= ROLE_ZOMBIE_SHAMBLER;
}

// Project Zomboid Moodles (Bitmask)
export const MOODLE_BLEEDING = 1 << 0;
export const MOODLE_BITTEN = 1 << 1;
export const MOODLE_PANIC = 1 << 2;
export const MOODLE_HUNGRY = 1 << 3;
export const MOODLE_TIRED = 1 << 4;
export const MOODLE_HEAVY_LOAD = 1 << 5;

// Vehicles — Destructible by zombies, bullets, fire & explosions!
export interface Vehicle {
  id: number;
  kind: 'sedan' | 'police' | 'ambulance' | 'pickup';
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  axis: 0 | 1; // 0 = along X road, 1 = along Y road
  hp: number;
  maxHp: number;
  hasAlarm: boolean;
  alarmTimer: number;
  sirenOn: boolean;
  headlightsOn: boolean;
  burning: boolean;
  glassBroken: boolean;
  hitFlash: number;
  exploded: boolean; // True = smashed / wrecked / burned out hulk!
}

export type TimeOfDayMode = 'auto' | 'day' | 'dusk' | 'night';
export type WeatherMode = 'clear' | 'rain' | 'storm' | 'fog';
export type RoofMode = 'auto' | 'cut_all' | 'solid';

export const BRUSH_SIZES = [
  { label: 'S', radius: 1 },
  { label: 'M', radius: 3 },
  { label: 'L', radius: 6 },
  { label: 'XL', radius: 10 },
];

export type SimToolId =
  | 'inspect'
  | 'expand_base'
  | 'barricade'
  | 'spawn_car'
  | 'spawn_shambler'
  | 'spawn_sprinter'
  | 'spawn_armored_zed'
  | 'horde_wave'
  | 'virus_cloud'
  | 'spawn_survivors'
  | 'spawn_police'
  | 'spawn_soldiers'
  | 'spawn_medics'
  | 'spawn_raiders'
  | 'helicopter'
  | 'sound_lure'
  | 'molotov'
  | 'propane_bomb'
  | 'airdrop';

export type ToolCategory = 'all' | 'zombies' | 'survivors' | 'build' | 'events';

export interface SimToolDef {
  id: SimToolId;
  name: string;
  short: string;
  hotkey: string;
  category: Exclude<ToolCategory, 'all'>;
  accent: string;
  desc: string;
}

export const SIM_TOOLS: SimToolDef[] = [
  {
    id: 'inspect',
    name: 'Лупа и Паспорт',
    short: 'Осмотр',
    hotkey: '1',
    category: 'survivors',
    accent: '#94d2bd',
    desc: 'Осмотреть паспорт выжившего/зомби, отряд, мудлы, инвентарь и срез здания.',
  },
  {
    id: 'expand_base',
    name: 'Расширить здание / Пристройка',
    short: 'Пристройка',
    hotkey: '2',
    category: 'build',
    accent: '#ffd466',
    desc: 'Достроить новую жилую комнату-крыло к ближайшему зданию или возвести новый форпост выживших!',
  },
  {
    id: 'barricade',
    name: 'Баррикады и мешки',
    short: 'Укрепить',
    hotkey: 'B',
    category: 'build',
    accent: '#bc6c25',
    desc: 'Заколотить окна досками и выставить прочные мешки с песком (непроходимая коллизия!).',
  },
  {
    id: 'spawn_car',
    name: 'Автомобиль',
    short: 'Машина',
    hotkey: 'C',
    category: 'build',
    accent: '#4895ef',
    desc: 'Поставить машину с коллизией и сигнализацией — зомби со временем разгромят её в хлам!',
  },
  {
    id: 'airdrop',
    name: 'Военный груз',
    short: 'Груз КЗО',
    hotkey: 'Q',
    category: 'build',
    accent: '#8ac926',
    desc: 'Сбросить армейский ящик с оружием, едой, брёвнами для стройки и досками.',
  },
  {
    id: 'spawn_shambler',
    name: 'Зомби-шатуны',
    short: 'Шатуны',
    hotkey: '3',
    category: 'zombies',
    accent: '#7cb518',
    desc: 'Медленные, неумолимые мертвецы: выламывают двери, бьют окна и крушат машины.',
  },
  {
    id: 'spawn_sprinter',
    name: 'Зомби-бегуны',
    short: 'Бегуны',
    hotkey: '4',
    category: 'zombies',
    accent: '#e63946',
    desc: 'Опасные быстрые заражённые — стремительно обходят препятствия и штурмуют входы.',
  },
  {
    id: 'spawn_armored_zed',
    name: 'Броне-зомби КЗО',
    short: 'Броне-зомби',
    hotkey: '5',
    category: 'zombies',
    accent: '#6b705c',
    desc: 'Заражённые военные в бронежилетах и касках — сносят баррикады и капоты машин.',
  },
  {
    id: 'horde_wave',
    name: 'Волна орды',
    short: 'Орда',
    hotkey: '6',
    category: 'zombies',
    accent: '#b5e48c',
    desc: 'Поднять крупную орду зомби в выбранном районе открытого мира.',
  },
  {
    id: 'virus_cloud',
    name: 'Штамм «Нокс»',
    short: 'Вирус',
    hotkey: '7',
    category: 'zombies',
    accent: '#80ed99',
    desc: 'Скрытое заражение выживших — больные обратятся в зомби прямо внутри убежища!',
  },
  {
    id: 'spawn_survivors',
    name: 'Группа выживших',
    short: 'Выжившие',
    hotkey: '8',
    category: 'survivors',
    accent: '#e9c46a',
    desc: 'Люди рубят деревья, таскают брёвна, сами расширяют дома пристройками и держат оборону.',
  },
  {
    id: 'spawn_police',
    name: 'Подкрепление Группы №1',
    short: 'Полиция',
    hotkey: '9',
    category: 'survivors',
    accent: '#4cc9f0',
    desc: 'Офицеры полиции Нокс (вливаются в Группу №1, охраняют и расширяют участок).',
  },
  {
    id: 'spawn_soldiers',
    name: 'Спецназ карантина',
    short: 'Военные',
    hotkey: '0',
    category: 'survivors',
    accent: '#a3b18a',
    desc: 'Бойцы карантина с M16: ведут прицельный огонь только по прямой видимости.',
  },
  {
    id: 'spawn_medics',
    name: 'Полевые медики',
    short: 'Медики',
    hotkey: 'M',
    category: 'survivors',
    accent: '#f8f9fa',
    desc: 'Врачи скорой помощи: лечат раненых союзников и перевязывают кровотечения.',
  },
  {
    id: 'spawn_raiders',
    name: 'Банда мародёров',
    short: 'Мародёры',
    hotkey: '-',
    category: 'survivors',
    accent: '#ff6b6b',
    desc: 'Враждебные налётчики — штурмуют чужие базы и ведут перестрелки на улицах.',
  },
  {
    id: 'helicopter',
    name: 'Вертолёт СМИ',
    short: 'Вертолёт',
    hotkey: 'H',
    category: 'events',
    accent: '#ffd166',
    desc: 'Гул винтов и прожектор стягивают зомби со всех окрестных чанков!',
  },
  {
    id: 'sound_lure',
    name: 'Сирена / Ревун',
    short: 'Сирена',
    hotkey: 'G',
    category: 'events',
    accent: '#ff9f1c',
    desc: 'Мощная сирена и автосигнализации — приманивают мертвецов к машинам.',
  },
  {
    id: 'molotov',
    name: 'Коктейль Молотова',
    short: 'Молотов',
    hotkey: 'F',
    category: 'events',
    accent: '#ff5400',
    desc: 'Бутылка с зажигательной смесью — поджигает улицы, орды и деревянные постройки.',
  },
  {
    id: 'propane_bomb',
    name: 'Взрыв пропана',
    short: 'Пропан',
    hotkey: 'X',
    category: 'events',
    accent: '#d90429',
    desc: 'Мощный взрыв: проламывает стены для штурма, мнёт машины и разбрасывает осколки!',
  },
];

export interface UnitInspectionData {
  uid: number;
  name: string;
  squadId: number;
  roleName: string;
  isZombie: boolean;
  isControlled: boolean;
  hp: number;
  maxHp: number;
  staminaPct: number;
  weaponId: number;
  weaponName: string;
  ammo: number;
  food: number;
  bandages: number;
  planks: number;
  wood: number;
  kills: number;
  taskText: string;
  infectionPct: number;
  moodles: { label: string; color: string }[];
  safehouseName: string | null;
}
