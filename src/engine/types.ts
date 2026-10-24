export const WORLD_W = 320;
export const WORLD_H = 200;
export const WORLD_SIZE = WORLD_W * WORLD_H;

export type WeatherType = 'clear' | 'rain' | 'storm' | 'snow';

export type ToolId =
  // Инженерные войска / земляные работы (4)
  | 'trench'
  | 'berm'
  | 'fortify'
  | 'smoke'
  // Оборонительные постройки (8)
  | 'bunker'
  | 'barracks'
  | 'depot'
  | 'hq'
  | 'pvo'
  | 'radar'
  | 'wall'
  | 'mine'
  // Пехота и техника (6)
  | 'infantry'
  | 'specops'
  | 'sniper'
  | 'tank'
  | 'apc'
  | 'supply'
  // Командование и разведка (4)
  | 'inspect'
  | 'war'
  | 'alliance'
  | 'recon'
  // Дроны и авиация (4)
  | 'fpv_drone'
  | 'lancet'
  | 'helicopter'
  | 'fighter'
  // Артиллерия и ракеты (9)
  | 'mortar'
  | 'artillery'
  | 'grad'
  | 'ballistic'
  | 'cruise'
  | 'fab'
  | 'napalm'
  | 'chemical'
  | 'nuke';

export type PowerGroup = 'engineer' | 'defense' | 'infantry' | 'command' | 'drones' | 'artillery';

export type ToolbarTab = 'all' | 'defense' | 'offense' | 'drones' | 'missiles' | 'saves' | 'physics';

export interface PowerItemDef {
  id: ToolId;
  name: string;
  hotkey: string;
  group: PowerGroup;
  description: string;
  accentColor: string;
}

export interface PhysicsSettings {
  gravityScale: number;
  seaLevel: number;
  openOceanEdges: boolean;
  sandErosion: boolean;
  cloudsEnabled: boolean;
  showCrossSection: boolean;
  showBorders: boolean;
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
  // Группа 1: Инженерные войска (4) — меняют рельеф
  {
    id: 'trench',
    name: 'Окоп',
    hotkey: 'Q',
    group: 'engineer',
    description: 'Сапёры роют глубокие окопы и противотанковые рвы! Защита от пуль и осколков.',
    accentColor: '#8d6e63',
  },
  {
    id: 'berm',
    name: 'Бруствер',
    hotkey: 'E',
    group: 'engineer',
    description: 'Насыпает земляной вал и бруствер — укрытие для пехоты и техники.',
    accentColor: '#a1887f',
  },
  {
    id: 'fortify',
    name: 'Бетонировать',
    hotkey: 'F',
    group: 'engineer',
    description: 'Заливает бетонную площадку под базу — ровное поле для штаба и ПВО.',
    accentColor: '#b0bec5',
  },
  {
    id: 'smoke',
    name: 'Дымзавеса',
    hotkey: 'V',
    group: 'engineer',
    description: 'Дымовые шашки и аэрозоль! Закрывает позицию от дронов и снайперов.',
    accentColor: '#90a4ae',
  },

  // Группа 2: Оборонительные постройки (8)
  {
    id: 'bunker',
    name: 'Бункер',
    hotkey: '1',
    group: 'defense',
    description: 'Железобетонный бункер с амбразурами! Выдерживает миномёты, но не ФАБ.',
    accentColor: '#78909c',
  },
  {
    id: 'barracks',
    name: 'Казарма',
    hotkey: '2',
    group: 'defense',
    description: 'Казарма — спаунит отряды, хранит БК и ускоряет мобилизацию.',
    accentColor: '#6d4c41',
  },
  {
    id: 'depot',
    name: 'Склад ГСМ',
    hotkey: '3',
    group: 'defense',
    description: 'Склад топлива и БК! Авто-пополняет технику. Взорви — будет огненный шар.',
    accentColor: '#ff8f00',
  },
  {
    id: 'hq',
    name: 'ШТАБ',
    hotkey: '4',
    group: 'defense',
    description: 'Командный пункт! Центр государства — захват штаба = капитуляция. Даёт радар.',
    accentColor: '#ffd600',
  },
  {
    id: 'pvo',
    name: 'ПВО',
    hotkey: '5',
    group: 'defense',
    description: 'ЗРК Панцирь! Авто-перехватывает ракеты, ФАБ и дроны в радиусе 28 клеток.',
    accentColor: '#00bcd4',
  },
  {
    id: 'radar',
    name: 'РЛС',
    hotkey: '6',
    group: 'defense',
    description: 'РЛС 59Н6 — подсвечивает все вражеские дроны и ракеты на мини-карте.',
    accentColor: '#4fc3f7',
  },
  {
    id: 'wall',
    name: 'Ежи / Забор',
    hotkey: '',
    group: 'defense',
    description: 'Противотанковые ежи и колючка! Останавливают танки и пехоту.',
    accentColor: '#8d6e63',
  },
  {
    id: 'mine',
    name: 'Мины',
    hotkey: '',
    group: 'defense',
    description: 'Минное поле TM-62! Невидимо для врага — рвёт танки и пехоту при контакте.',
    accentColor: '#e53935',
  },

  // Группа 3: Пехота и техника (6)
  {
    id: 'infantry',
    name: 'Пехота',
    hotkey: '7',
    group: 'infantry',
    description: 'Мотострелки с АК! Копают, строят базы, штурмуют здания и идут в атаку.',
    accentColor: '#7cb342',
  },
  {
    id: 'specops',
    name: 'Спецназ',
    hotkey: '8',
    group: 'infantry',
    description: 'Штурмовики в броне! +60% урона, быстрее бегают, берут окопы первыми.',
    accentColor: '#f4511e',
  },
  {
    id: 'sniper',
    name: 'Снайпер',
    hotkey: '9',
    group: 'infantry',
    description: 'Снайпер с СВД! Дальний точный огонь 22 клетки, игнорит укрытия.',
    accentColor: '#558b2f',
  },
  {
    id: 'tank',
    name: 'Танк Т-90',
    hotkey: '',
    group: 'infantry',
    description: 'Тяжёлый танк! 400 HP, пушка 85 урона, давит окопы и стены, но тонет в болоте.',
    accentColor: '#37474f',
  },
  {
    id: 'apc',
    name: 'БТР-82',
    hotkey: '',
    group: 'infantry',
    description: 'Бронетранспортёр! Быстро возит пехоту, 30мм пушка, уязвим к минам.',
    accentColor: '#607d8b',
  },
  {
    id: 'supply',
    name: 'Снабжение',
    hotkey: '',
    group: 'infantry',
    description: 'Сброс ящика БК с парашютом! Лечит и пополняет всех рядом.',
    accentColor: '#ffca28',
  },

  // Группа 4: Командование (4)
  {
    id: 'inspect',
    name: 'Осмотр',
    hotkey: 'I',
    group: 'command',
    description: 'Паспорт бойца! ПКМ по любому солдату/танку/доту — покажет HP, урон и черты.',
    accentColor: '#74c0fc',
  },
  {
    id: 'war',
    name: 'ВОЙНА',
    hotkey: 'G',
    group: 'command',
    description: 'Приказ к атаке! Выбранная база объявляет войну всем соседям!',
    accentColor: '#ff3d00',
  },
  {
    id: 'alliance',
    name: 'Союз',
    hotkey: 'P',
    group: 'command',
    description: 'Дипломатия! Заключает мир и альянс — бывшие враги станут союзниками.',
    accentColor: '#00e676',
  },
  {
    id: 'recon',
    name: 'Разведчик',
    hotkey: 'R',
    group: 'command',
    description: 'Квадрокоптер-разведчик! Летит над картой, подсвечивает мины и врага.',
    accentColor: '#b388ff',
  },

  // Группа 5: Дроны и авиация (4)
  {
    id: 'fpv_drone',
    name: 'FPV-камикадзе',
    hotkey: '0',
    group: 'drones',
    description: 'FPV-дрон с гранатой! Ты наводишь — он пикирует и сносит дом в пыль с воронкой!',
    accentColor: '#ff1744',
  },
  {
    id: 'lancet',
    name: 'Ланцет',
    hotkey: '-',
    group: 'drones',
    description: 'Барражирующий Ланцет! Долго кружит, сам находит ПВО и танки, бьёт сверху.',
    accentColor: '#d50000',
  },
  {
    id: 'helicopter',
    name: 'Ка-52',
    hotkey: '',
    group: 'drones',
    description: 'Ударный вертолёт! НУРСами жжёт окопы и пехоту, уязвим к ПЗРК.',
    accentColor: '#33691e',
  },
  {
    id: 'fighter',
    name: 'Су-34',
    hotkey: '=',
    group: 'drones',
    description: 'Фронтовой бомбардировщик! Сбрасывает ФАБ-500 и уходит на сверхзвуке.',
    accentColor: '#0d47a1',
  },

  // Группа 6: Артиллерия и ракеты (9)
  {
    id: 'mortar',
    name: 'Миномёт 120мм',
    hotkey: '',
    group: 'artillery',
    description: 'Тихий миномёт! Навесная траектория через холмы, копает воронку 6м.',
    accentColor: '#6d4c41',
  },
  {
    id: 'artillery',
    name: 'Гаубица 152мм',
    hotkey: 'L',
    group: 'artillery',
    description: 'Дальнобойная арта! Бьёт через полкарты, ломает бункеры с 3 попаданий.',
    accentColor: '#4e342e',
  },
  {
    id: 'grad',
    name: 'РСЗО Град',
    hotkey: '',
    group: 'artillery',
    description: 'Пакет 40 ракет! Накрывает площадь 12×12 — ровняет окопы и лес.',
    accentColor: '#ff6f00',
  },
  {
    id: 'ballistic',
    name: 'Искандер-М',
    hotkey: '',
    group: 'artillery',
    description: 'Баллистика! Уходит в стратосферу и падает вертикально — воронка 18м, сносит квартал!',
    accentColor: '#ff3d00',
  },
  {
    id: 'cruise',
    name: 'Калибр',
    hotkey: '',
    group: 'artillery',
    description: 'Крылатая ракета! Летит низко над землёй, огибает горы, бьёт точно в штаб.',
    accentColor: '#e65100',
  },
  {
    id: 'fab',
    name: 'ФАБ-1500',
    hotkey: '',
    group: 'artillery',
    description: 'Планирующая бомба УМПК! Сбрасывается с Су-34, пробивает бункер и оставляет кратер.',
    accentColor: '#bf360c',
  },
  {
    id: 'napalm',
    name: 'ТОС-1А',
    hotkey: '',
    group: 'artillery',
    description: 'Огнемёт Солнцепёк! Термобарический взрыв — выжигает окопы и блиндажи.',
    accentColor: '#ff6d00',
  },
  {
    id: 'chemical',
    name: 'Хим. удар',
    hotkey: '',
    group: 'artillery',
    description: 'Зарин! Зелёное облако — медленно растворяет бетон и пехоту без противогаза.',
    accentColor: '#76ff03',
  },
  {
    id: 'nuke',
    name: 'Ядерка',
    hotkey: '',
    group: 'artillery',
    description: 'Тактический ядерный удар! Гриб 3км, выжженная земля, все в радиусе — в пепел.',
    accentColor: '#ffea00',
  },
];

// Максимальная прочность каждой военной постройки (для попиксельного разрушения)
export const BUILDING_MAX_HP: Record<number, number> = {
  1: 65,
  2: 140,
  3: 520,
  4: 150,
  5: 260,
  6: 0,
  7: 420,
  8: 165,
  9: 180,
  10: 320,
};

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
