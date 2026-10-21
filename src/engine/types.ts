export const WORLD_W = 320;
export const WORLD_H = 200;
export const WORLD_SIZE = WORLD_W * WORLD_H;

export type WeatherType = 'clear' | 'rain' | 'storm' | 'snow';

export type ToolId =
  // Landscape Sculpting / World Interaction (4)
  | 'raise'
  | 'dig'
  | 'level'
  | 'wave'
  // Core Physical Materials & Ores (9)
  | 'sand'
  | 'water'
  | 'stone'
  | 'soil'
  | 'lava'
  | 'snow'
  | 'gold'
  | 'oil'
  | 'gunpowder'
  // Kingdoms, Unit Inspection, Diplomacy, Animals & Monsters (12)
  | 'inspect'
  | 'seeds'
  | 'humans'
  | 'warriors'
  | 'war'
  | 'peace'
  | 'blessing'
  | 'sheep'
  | 'wolves'
  | 'zombies'
  | 'skeletons'
  | 'dragon'
  // Divine Weather, Floods, Plagues & Catastrophes (11)
  | 'weather_rain'
  | 'weather_snow'
  | 'flood'
  | 'weather_clear'
  | 'fire'
  | 'lightning'
  | 'acid'
  | 'plague'
  | 'tnt'
  | 'meteor'
  | 'nuke';

export type PowerGroup = 'materials' | 'kingdoms' | 'chaos' | 'terraform';

export type ToolbarTab = 'all' | 'elements' | 'kingdoms' | 'chaos' | 'saves' | 'physics';

export interface PowerItemDef {
  id: ToolId;
  name: string;
  hotkey: string;
  group: PowerGroup;
  description: string;
  accentColor: string;
}

export interface PhysicsSettings {
  gravityScale: number;      // 0.5 .. 2.0
  seaLevel: number;          // 0.0 .. 10.0
  openOceanEdges: boolean;   // Infinite WorldBox sea at edges vs closed tank walls
  sandErosion: boolean;      // Flowing water carries loose sand downstream
  cloudsEnabled: boolean;    // Drifting WorldBox cloud shadows
  showCrossSection: boolean; // Live geological column readout at cursor
  showBorders: boolean;      // WorldBox settlement borders & village banners
}

export interface TraitBadge {
  label: string;
  color: string;
  desc: string;
}

export interface UnitInspection {
  uid: number;
  name: string;
  roleName: string;
  settlementName: string | null;
  age: number;
  kills: number;
  hp: number;
  maxHp: number;
  damage: number;
  speed: number;
  canSwim: boolean;
  drowning: boolean;
  infected: boolean;
  blessed: boolean;
  pinned: boolean;
  traits: TraitBadge[];
}

export interface CursorInspection {
  inBounds: boolean;
  gx: number;
  gy: number;
  biomeName: string;
  settlementName: string | null;
  soil: number;
  stone: number;
  sand: number;
  glass: number;
  water: number;
  lava: number;
  ice: number;
  totalSolid: number;
  flowSpeed: number;
  population: number;
  houses: number;
  warsActive: number;
  weather: WeatherType;
  seaRise: number;
  unit: UnitInspection | null;
}

export interface SavedWorldSummary {
  id: string;
  name: string;
  savedAt: string;
  seed: number;
  population: number;
  houses: number;
  thumbnailDataUrl: string;
}

export const POWER_ITEMS: PowerItemDef[] = [
  // Group 1: Materials, Elements & Ores (9)
  {
    id: 'sand',
    name: 'Песок',
    hotkey: '1',
    group: 'materials',
    description: 'Золотой песок: тонет в воде, намокает, образует пляжи и плавится от лавы в стекло!',
    accentColor: '#f5d47a',
  },
  {
    id: 'water',
    name: 'Вода',
    hotkey: '2',
    group: 'materials',
    description: 'Живая вода: течёт реками, тушит пожары и превращает лаву в базальт с клубами пара!',
    accentColor: '#4cc3f7',
  },
  {
    id: 'stone',
    name: 'Камень',
    hotkey: '3',
    group: 'materials',
    description: 'Тяжёлый камень: падает сквозь воду до дна и образует крутые скалы и крепостные дамбы.',
    accentColor: '#a6b1c2',
  },
  {
    id: 'soil',
    name: 'Почва',
    hotkey: '4',
    group: 'materials',
    description: 'Плодородная земля: формирует новые зелёные острова, холмы и равнины для королевств.',
    accentColor: '#b88456',
  },
  {
    id: 'lava',
    name: 'Лава',
    hotkey: '5',
    group: 'materials',
    description: 'Раскалённая магма: стекает со склонов, сжигает города, плавит песок и каменеет в воде!',
    accentColor: '#ff6e26',
  },
  {
    id: 'snow',
    name: 'Снег / Лёд',
    hotkey: '6',
    group: 'materials',
    description: 'Вечная мерзлота: сковывает моря и реки твёрдым льдом, по которому армии переходят проливы!',
    accentColor: '#c9f2ff',
  },
  {
    id: 'gold',
    name: 'Золото',
    hotkey: '',
    group: 'materials',
    description: 'Золотые жилы! Поселения добывают золото, быстрее строят замки и вооружают рыцарей.',
    accentColor: '#ffd740',
  },
  {
    id: 'oil',
    name: 'Нефть',
    hotkey: '',
    group: 'materials',
    description: 'Чёрная горючая нефть: разливается лужами и от малейшей искры вспыхивает стеной огня!',
    accentColor: '#9e86ff',
  },
  {
    id: 'gunpowder',
    name: 'Порох',
    hotkey: '',
    group: 'materials',
    description: 'Пороховая дорожка! Насыпь линию от костра до замка — огонь пробежит цепью взрывов!',
    accentColor: '#d0d7de',
  },

  // Group 2: Kingdoms, War, Wildlife & Undead (11)
  {
    id: 'seeds',
    name: 'Семена',
    hotkey: '7',
    group: 'kingdoms',
    description: 'Дождь жизни: мгновенно выращивает густые леса, яблони, сосны и цветущие луга!',
    accentColor: '#7be058',
  },
  {
    id: 'humans',
    name: 'Люди',
    hotkey: '8',
    group: 'kingdoms',
    description: 'Поселенцы: рубят лес, строят деревни, мельницы и замки, снаряжают флот и армии!',
    accentColor: '#ffbe88',
  },
  {
    id: 'warriors',
    name: 'Рыцари',
    hotkey: '9',
    group: 'kingdoms',
    description: 'Элитные воины в латных шлемах с мечами и щитами! Защищают город и штурмуют врагов.',
    accentColor: '#ffd566',
  },
  {
    id: 'war',
    name: 'Война',
    hotkey: 'G',
    group: 'kingdoms',
    description: 'Шёпот войны! Заставляет выбранное королевство немедленно объявить войну соседям!',
    accentColor: '#ff4757',
  },
  {
    id: 'peace',
    name: 'Мир',
    hotkey: 'P',
    group: 'kingdoms',
    description: 'Голубь мира: прекращает все войны выбранного королевства и мирит враждующие народы.',
    accentColor: '#a8f5ff',
  },
  {
    id: 'blessing',
    name: 'Благодать',
    hotkey: '',
    group: 'kingdoms',
    description: 'Божественное благословение: исцеляет раны, лечит чуму и усиливает воинов золотым щитом!',
    accentColor: '#fff176',
  },
  {
    id: 'sheep',
    name: 'Овечки',
    hotkey: '',
    group: 'kingdoms',
    description: 'Мирные пушистые овечки: пасутся стадами на зелёных лугах вокруг деревень.',
    accentColor: '#ffffff',
  },
  {
    id: 'wolves',
    name: 'Волки',
    hotkey: '',
    group: 'kingdoms',
    description: 'Лесные хищники: сбиваются в стаи в чащах и охотятся на дичь на окраинах.',
    accentColor: '#b0bec5',
  },
  {
    id: 'zombies',
    name: 'Зомби',
    hotkey: '',
    group: 'kingdoms',
    description: 'Орда зомби! Нападают на города и превращают укушенных жителей в новых зомби!',
    accentColor: '#76ff03',
  },
  {
    id: 'skeletons',
    name: 'Скелеты',
    hotkey: '',
    group: 'kingdoms',
    description: 'Армия скелетов с мечами! Восстают из костей и штурмуют башни и замки людей.',
    accentColor: '#eceff1',
  },
  {
    id: 'dragon',
    name: 'Дракон',
    hotkey: '',
    group: 'kingdoms',
    description: 'Крылатый огненный дракон! Кружит в небе и выжигает города пламенем, пока лучники бьют в ответ!',
    accentColor: '#ff5252',
  },
  {
    id: 'inspect',
    name: 'Осмотр',
    hotkey: 'I',
    group: 'kingdoms',
    description: 'Паспорт существа! Кликни по любому человеку, зомби, овечке или волку (или ПКМ!), чтобы изучить черты, возраст, урон и умение плавать!',
    accentColor: '#74c0fc',
  },

  // Group 3: Divine Weather, Floods & Catastrophes (11)
  {
    id: 'weather_rain',
    name: 'Дождь',
    hotkey: 'R',
    group: 'chaos',
    description: 'Долгий ливень! Льётся над всем миром, тушит пожары, наполняет реки и постепенно затапливает низины и берега!',
    accentColor: '#4dabf7',
  },
  {
    id: 'weather_snow',
    name: 'Снегопад',
    hotkey: '',
    group: 'chaos',
    description: 'Зимняя метель! Укрывает острова белым снегом и сковывает мелкие реки и проливы твёрдым льдом!',
    accentColor: '#e5f6ff',
  },
  {
    id: 'flood',
    name: 'Потоп!',
    hotkey: '',
    group: 'chaos',
    description: 'Великое Наводнение! Поднимает уровень мирового океана и обрушивает штормовую волну на города — неумеющие плавать тонут или бегут в горы!',
    accentColor: '#15aabf',
  },
  {
    id: 'weather_clear',
    name: 'Солнце',
    hotkey: '',
    group: 'chaos',
    description: 'Ясное небо и спад воды! Останавливает дождь и снег, высушивает лужи и возвращает океан обратно в берега!',
    accentColor: '#ffd43b',
  },
  {
    id: 'fire',
    name: 'Огонь',
    hotkey: '0',
    group: 'chaos',
    description: 'Живое пламя: сжигает леса, нефть и постройки, подрывает порох и динамит!',
    accentColor: '#ff942e',
  },
  {
    id: 'lightning',
    name: 'Молния',
    hotkey: 'L',
    group: 'chaos',
    description: 'Небесная молния! Бьёт зигзагом с небес, плавит песок в стекло, поджигает лес и мечет гром!',
    accentColor: '#82f7ff',
  },
  {
    id: 'acid',
    name: 'Кислота',
    hotkey: '',
    group: 'chaos',
    description: 'Едкая кислота: с шипением растворяет камень, стены, землю и проедает кратеры!',
    accentColor: '#7cff44',
  },
  {
    id: 'plague',
    name: 'Чума',
    hotkey: '',
    group: 'chaos',
    description: 'Лиловая чума: заразный мор, перекидывающийся между жителями (лечится Благодатью!).',
    accentColor: '#ce93d8',
  },
  {
    id: 'tnt',
    name: 'Динамит',
    hotkey: '-',
    group: 'chaos',
    description: 'Связки взрывчатки TNT! Детонируют от огня, молнии или взрыва соседней шашки!',
    accentColor: '#ff4238',
  },
  {
    id: 'meteor',
    name: 'Метеорит',
    hotkey: '=',
    group: 'chaos',
    description: 'Огненный астероид: падает из космоса, выбивая кратер с лавой, пеплом и ударной волной!',
    accentColor: '#ff7043',
  },
  {
    id: 'nuke',
    name: 'Царь-Бомба',
    hotkey: '',
    group: 'chaos',
    description: 'Ядерный удар! Ослепительная вспышка, гигантский ядерный гриб и исполинский кратер!',
    accentColor: '#ffea00',
  },

  // Group 4: Landscape Sculpting & Storms (4)
  {
    id: 'raise',
    name: 'Поднять',
    hotkey: 'Q',
    group: 'terraform',
    description: 'Выращивает горы, перешейки и новые острова прямо со дна океана.',
    accentColor: '#8be382',
  },
  {
    id: 'dig',
    name: 'Копать',
    hotkey: 'E',
    group: 'terraform',
    description: 'Прорывает судоходные проливы, крепостные рвы, реки и глубокие бухты.',
    accentColor: '#f29f58',
  },
  {
    id: 'level',
    name: 'Ровнять',
    hotkey: 'F',
    group: 'terraform',
    description: 'Выравнивает рельеф под идеальные плато для огромных столиц и замков.',
    accentColor: '#ffd566',
  },
  {
    id: 'wave',
    name: 'Торнадо',
    hotkey: 'V',
    group: 'terraform',
    description: 'Смерч и цунами: закручивает воду, песок, деревья и воинов в мощный вихрь!',
    accentColor: '#84e8ff',
  },
];

export interface BrushSizeDef {
  id: string;
  label: string;
  radius: number;
}

export const BRUSH_SIZES: BrushSizeDef[] = [
  { id: 'xs', label: '1px', radius: 0.7 },
  { id: 's', label: 'S', radius: 2.3 },
  { id: 'm', label: 'M', radius: 4.8 },
  { id: 'l', label: 'L', radius: 8.5 },
  { id: 'xl', label: 'XL', radius: 14.0 },
];
