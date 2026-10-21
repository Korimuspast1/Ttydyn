export const MAP_W = 148;
export const MAP_H = 148;
export const MAP_SIZE = MAP_W * MAP_H;

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

// Structural tile block IDs (on grid cell [x, y])
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

// Building Archetypes
export type BuildingKind =
  | 'house'
  | 'police'
  | 'supermarket'
  | 'hospital'
  | 'warehouse'
  | 'gas_station'
  | 'military';

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
  safehouseSquad: number;
  survivorsInside: number;
  zombiesInside: number;
  alarmTriggered: boolean;
  alarmTimer: number;
}

// Weapons
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
  { id: WPN_FISTS, name: 'Толчок / Нож', isGun: false, range: 1.35, damage: 18, cooldown: 0.62, noiseRadius: 4, pellets: 1, spread: 0, knockback: 2.2 },
  { id: WPN_BAT, name: 'Бейсбольная бита', isGun: false, range: 1.65, damage: 36, cooldown: 0.68, noiseRadius: 6, pellets: 1, spread: 0, knockback: 4.5 },
  { id: WPN_AXE, name: 'Пожарный топор', isGun: false, range: 1.7, damage: 58, cooldown: 0.78, noiseRadius: 7, pellets: 1, spread: 0, knockback: 3.6 },
  { id: WPN_PISTOL, name: 'Пистолет M9 (9мм)', isGun: true, range: 13.5, damage: 44, cooldown: 0.44, noiseRadius: 28, pellets: 1, spread: 0.09, knockback: 2.0 },
  { id: WPN_SHOTGUN, name: 'Дробовик JS-2000', isGun: true, range: 8.8, damage: 34, cooldown: 0.92, noiseRadius: 48, pellets: 5, spread: 0.28, knockback: 5.2 },
  { id: WPN_RIFLE, name: 'Винтовка M16', isGun: true, range: 18.0, damage: 40, cooldown: 0.19, noiseRadius: 40, pellets: 1, spread: 0.06, knockback: 2.4 },
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

// Vehicles
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
  exploded: boolean;
}

export type TimeOfDayMode = 'auto' | 'day' | 'dusk' | 'night';
export type WeatherMode = 'clear' | 'rain' | 'storm' | 'fog';
export type RoofMode = 'auto' | 'cut_all' | 'solid';

export type SimToolId =
  | 'inspect'
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
  | 'airdrop'
  | 'barricade'
  | 'spawn_car';

export type ToolCategory = 'all' | 'zombies' | 'survivors' | 'events';

export interface SimToolDef {
  id: SimToolId;
  name: string;
  short: string;
  icon: string;
  hotkey: string;
  category: Exclude<ToolCategory, 'all'>;
  accent: string;
  desc: string;
}

export const SIM_TOOLS: SimToolDef[] = [
  {
    id: 'inspect',
    name: 'Осмотр и Рентген',
    short: 'Осмотр',
    icon: '🔍',
    hotkey: '1',
    category: 'survivors',
    accent: '#94d2bd',
    desc: 'Осмотреть паспорт выжившего/зомби (мудлы, укусы, инвентарь) и заглянуть внутрь здания.',
  },
  {
    id: 'spawn_shambler',
    name: 'Зомби-шатуны',
    short: 'Шатуны',
    icon: '🧟',
    hotkey: '2',
    category: 'zombies',
    accent: '#7cb518',
    desc: 'Классические ходячие мертвецы Project Zomboid. Идут на каждый выстрел и выламывают окна.',
  },
  {
    id: 'spawn_sprinter',
    name: 'Зомби-бегуны',
    short: 'Бегуны',
    icon: '🏃',
    hotkey: '3',
    category: 'zombies',
    accent: '#e63946',
    desc: 'Смертельно опасные быстрые спринтеры! Мгновенно врываются в дома и рвут оборону.',
  },
  {
    id: 'spawn_armored_zed',
    name: 'Броне-зомби КЗО',
    short: 'Спец-зомби',
    icon: '🪖',
    hotkey: '4',
    category: 'zombies',
    accent: '#6b705c',
    desc: 'Заражённые солдаты и спецназ в касках и бронежилетах — выдерживают десятки пуль.',
  },
  {
    id: 'horde_wave',
    name: 'Мега-орда с шоссе',
    short: 'Мега-орда',
    icon: '☣',
    hotkey: '5',
    category: 'zombies',
    accent: '#b5e48c',
    desc: 'Направить огромную волну голодных зомби с окраин прямо на выбранный квартал!',
  },
  {
    id: 'virus_cloud',
    name: 'Штамм «Нокс»',
    short: 'Вирус',
    icon: '🦠',
    hotkey: '6',
    category: 'zombies',
    accent: '#80ed99',
    desc: 'Скрытое заражение людей! Больные вернутся в убежище к друзьям и обратятся прямо внутри базы.',
  },
  {
    id: 'spawn_survivors',
    name: 'Отряд выживших',
    short: 'Выжившие',
    icon: '🧑',
    hotkey: '7',
    category: 'survivors',
    accent: '#e9c46a',
    desc: 'Гражданские выжившие: сами лутают дома, ищут еду/оружие и заколачивают окна убежищ досками.',
  },
  {
    id: 'spawn_police',
    name: 'Патруль полиции',
    short: 'Полиция',
    icon: '👮',
    hotkey: '8',
    category: 'survivors',
    accent: '#4cc9f0',
    desc: 'Офицеры полиции округа Нокс с дробовиками JS-2000 и пистолетами M9.',
  },
  {
    id: 'spawn_soldiers',
    name: 'Спецназ карантина',
    short: 'Военные',
    icon: '🎖',
    hotkey: '9',
    category: 'survivors',
    accent: '#a3b18a',
    desc: 'Элитный армейский отряд зачистки со штурмовыми винтовками M16 и большим боезапасом.',
  },
  {
    id: 'spawn_medics',
    name: 'Полевые врачи',
    short: 'Медики',
    icon: '🩺',
    hotkey: '0',
    category: 'survivors',
    accent: '#f8f9fa',
    desc: 'Спасатели с аптечками: перевязывают кровотечения и лечат раненых выживших в бою.',
  },
  {
    id: 'spawn_raiders',
    name: 'Банда мародёров',
    short: 'Мародёры',
    icon: '💀',
    hotkey: '-',
    category: 'survivors',
    accent: '#ff6b6b',
    desc: 'Враждебные вооружённые бандиты! Атакуют обычных выживших и шумят выстрелами на весь город.',
  },
  {
    id: 'helicopter',
    name: 'Вертолёт СМИ!',
    short: 'Вертолёт',
    icon: '🚁',
    hotkey: 'H',
    category: 'events',
    accent: '#ffd166',
    desc: 'Культовое мета-событие Project Zomboid! Гул винтов и прожектор стягивают ВСЕХ зомби округа!',
  },
  {
    id: 'sound_lure',
    name: 'Ревун / Сирена',
    short: 'Сирена',
    icon: '🚨',
    hotkey: 'G',
    category: 'events',
    accent: '#ff9f1c',
    desc: 'Включить мощную полицейскую сирену или сигнализацию — уводит или собирает орды со всех улиц.',
  },
  {
    id: 'molotov',
    name: 'Коктейль Молотова',
    short: 'Молотов',
    icon: '🍾',
    hotkey: 'F',
    category: 'events',
    accent: '#ff5400',
    desc: 'Разбивает бутылку с горящим бензином! Зомби горят на ходу и поджигают деревянные дома.',
  },
  {
    id: 'propane_bomb',
    name: 'Взрыв пропана',
    short: 'Пропан',
    icon: '🧨',
    hotkey: 'E',
    category: 'events',
    accent: '#d90429',
    desc: 'Мощнейшая физическая ударная волна: разносит стены, выбивает стёкла на квартал и рвёт ноги зомби!',
  },
  {
    id: 'airdrop',
    name: 'Военный груз',
    short: 'Сброс лута',
    icon: '📦',
    hotkey: 'Q',
    category: 'events',
    accent: '#8ac926',
    desc: 'Сбросить армейский контейнер с M16, дробовиками, едой, бинтами и досками (с сигнальным дымом!).',
  },
  {
    id: 'barricade',
    name: 'Баррикады и мешки',
    short: 'Укрепить',
    icon: '🧱',
    hotkey: 'B',
    category: 'events',
    accent: '#bc6c25',
    desc: 'Заколотить ближайшие окна досками и выставить мешки с песком для обороны улицы.',
  },
  {
    id: 'spawn_car',
    name: 'Автомобиль',
    short: 'Машина',
    icon: '🚗',
    hotkey: 'C',
    category: 'events',
    accent: '#4895ef',
    desc: 'Поставить машину (с рабочей сигнализацией, фарами и взрывоопасным бензобаком!).',
  },
];

export interface UnitInspectionData {
  uid: number;
  name: string;
  roleName: string;
  isZombie: boolean;
  hp: number;
  maxHp: number;
  weaponName: string;
  ammo: number;
  food: number;
  bandages: number;
  planks: number;
  kills: number;
  taskText: string;
  infectionPct: number;
  moodles: { label: string; color: string }[];
  safehouseName: string | null;
}
