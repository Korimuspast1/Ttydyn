// ─────────────────────────────────────────────────────────────
//  ТОСКА — данные мира: дома, двор, парковки, деревья, объекты
// ─────────────────────────────────────────────────────────────

export const W = 3072;
export const H = 1800;

export const STREET = { y0: 1436, y1: 1612 };
export const WALK_N = { y0: 1382, y1: 1436 };
export const WALK_S = { y0: 1612, y1: 1662 };

// маленький детерминированный рандом
export function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PALETTES = {
  panel:  { wall: '#8e8879', wall2: '#837d6f', seam: '#6f6a5e', roof: '#3f423f', win: '#2a3038', trim: '#9c9686' },
  panel2: { wall: '#8b8b83', wall2: '#7f7f78', seam: '#6a6a63', roof: '#3b3e3b', win: '#282e36', trim: '#98988f' },
  brick:  { wall: '#8a7060', wall2: '#7d6555', seam: '#67503f', roof: '#3e3d39', win: '#2a2f36', trim: '#93796a' },
  brick2: { wall: '#7d6f63', wall2: '#716457', seam: '#5d5147', roof: '#3a3c3a', win: '#29303a', trim: '#877a6d' },
  shop:   { wall: '#6f6a61', wall2: '#656057', seam: '#575249', roof: '#434540', win: '#2a3038', trim: '#7e786d' },
};

// ── ДОМА ───────────────────────────────────────────────────────
export const buildings = [
  { id: 'A', addr: 'ул. Заводская, 12', x: 170, y: 280, w: 1248, d: 52, h: 150, floors: 5, entrances: 6, pal: 'panel', seed: 101 },
  { id: 'B', addr: 'ул. Заводская, 14', x: 1476, y: 306, w: 656, d: 60, h: 252, floors: 9, entrances: 3, pal: 'brick', seed: 202 },
  { id: 'C', addr: 'ул. Заводская, 16', x: 2296, y: 504, w: 636, d: 52, h: 150, floors: 5, entrances: 3, pal: 'panel2', seed: 303 },
  { id: 'S', addr: 'ПРОДУКТЫ 24', x: 2180, y: 1260, w: 372, d: 46, h: 104, floors: 1, entrances: 0, pal: 'shop', seed: 404, shop: true },
];

for (const b of buildings) {
  b.palette = PALETTES[b.pal] || PALETTES.panel;
  b.baseY = b.y + b.d;
  b.topY = b.baseY - b.h;
  b.roofY = b.topY - b.d;
  b.seedRng = rng(b.seed);
}

// ── ГАРАЖИ (ряд боксов) ────────────────────────────────────────
export const garages = {
  id: 'G',
  x: 2504, y: 1024, w: 476, d: 46, h: 78, count: 6, seed: 515,
  baseY: 1070, topY: 992, roofY: 952,
};

// ── ДАЛЬНИЕ ДОМА ЗА ДОРОГОЙ ────────────────────────────────────
export const backdrop = {
  y: 1668, h: 126,
  seed: 777,
};

// ── ДОРОГИ / ДВОРОВЫЕ ПРОХОДЫ ──────────────────────────────────
export const paths = [
  { w: 54, pts: [[300, 470], [300, 1120]] },
  { w: 54, pts: [[560, 470], [560, 1120]] },
  { w: 50, pts: [[300, 640], [1500, 640]] },
  { w: 44, pts: [[820, 470], [820, 700]] },
  { w: 50, pts: [[1020, 470], [1020, 1060], [1180, 1120]] },
  { w: 50, pts: [[1240, 470], [1240, 980]] },
  { w: 50, pts: [[560, 1120], [1300, 1120]] },
  { w: 56, pts: [[880, 1050], [880, 1382]] },
  { w: 50, pts: [[1560, 470], [1560, 620]] },
  { w: 46, pts: [[1980, 470], [1980, 620]] },
  { w: 50, pts: [[2380, 620], [2380, 1210]] },
  { w: 56, pts: [[2380, 1210], [2380, 1382]] },
  { w: 44, pts: [[2060, 1382], [2060, 1240]] },
  { w: 46, pts: [[700, 960], [700, 1050]] },
  { w: 44, pts: [[2290, 470], [2290, 560]] },
];

// ── ПАРКОВКИ ───────────────────────────────────────────────────
// slot: [x, y, dir] — dir 1: носом вниз, -1: носом вверх
export const parkings = [
  { id: 'p1', x: 1610, y: 640, w: 430, d: 350, rows: 2, seed: 11 },
  { id: 'p2', x: 180, y: 1150, w: 570, d: 140, rows: 1, seed: 22 },
  { id: 'p3', x: 1690, y: 1190, w: 350, d: 118, rows: 1, seed: 33 },
  { id: 'p4', x: 2510, y: 760, w: 470, d: 140, rows: 1, seed: 44 },
];

export const CARS_COLORS = ['#3f4a52', '#5a3b3b', '#6b6a63', '#8d8b80', '#39424e', '#4b4a3c', '#2f3a3a', '#6d5b4a', '#7a7d80'];

// ── ДЕРЕВЬЯ ────────────────────────────────────────────────────
export const trees = [];

// ── ФОНАРИ ─────────────────────────────────────────────────────
export const lamps = [
  { x: 400, y: 600, h: 4.6 },
  { x: 900, y: 560, h: 4.2 },
  { x: 1420, y: 600, h: 4.6 },
  { x: 2010, y: 610, h: 4.2 },
  { x: 660, y: 1120, h: 4.0 },
  { x: 1160, y: 1080, h: 4.4 },
  { x: 1750, y: 1130, h: 4.2 },
  { x: 2300, y: 900, h: 4.4 },
  { x: 900, y: 1338, h: 4.0 },
  { x: 1960, y: 1338, h: 4.0 },
  { x: 2760, y: 1160, h: 4.6 },
  { x: 250, y: 330, h: 4.0 },
];

// ── ЛАВОЧКИ ────────────────────────────────────────────────────
export const benches = [
  { x: 470, y: 1094, dir: 0 },   // 0: сиденье лицом вниз (на юг)
  { x: 1000, y: 1072, dir: 1 },
  { x: 1900, y: 1010, dir: 1 },
  { x: 2440, y: 706, dir: 0 },
  { x: 800, y: 1326, dir: 0 },
  { x: 1520, y: 940, dir: 1 },
  { x: 640, y: 760, dir: 0 },
];

// ── МУСОРКА ────────────────────────────────────────────────────
export const dumpsterPad = { x: 1232, y: 1000, w: 136, h: 96 };
export const dumpsters = [
  { x: 1248, y: 1026, color: '#3e5a46' },
  { x: 1292, y: 1026, color: '#4a4a4e' },
  { x: 1336, y: 1026, color: '#3e5a46' },
];

// ── ТРАНСФОРМАТОРНАЯ БУДКА ─────────────────────────────────────
export const trafo = { x: 1436, y: 790, w: 82, d: 62, h: 66 };
export const trafoY = trafo.y + trafo.d;

// ── ДЕТСКАЯ ПЛОЩАДКА ───────────────────────────────────────────
export const playground = { x: 600, y: 760, w: 400, d: 300 };
export const swing = { x: 646, y: 878, w: 108, d: 26 };
export const slide = { x: 928, y: 858, w: 78, d: 64 };
export const carousel = { x: 800, y: 985, r: 42 };
export const sandbox = { x: 660, y: 960, w: 108, d: 76 };
export const mushroom = { x: 600, y: 952 };

// ── ХОККЕЙНАЯ КОРОБКА ─────────────────────────────────────────
export const hockey = { x: 244, y: 596, w: 384, d: 292, wall: 7, gate: 72 };

// ── АВТОБУСНАЯ ОСТАНОВКА ──────────────────────────────────────
export const busStop = { x: 690, y: 1358, w: 210, d: 44 };

// ── ПЕШЕХОДНЫЙ ПЕРЕХОД ────────────────────────────────────────
export const crosswalk = { x: 1140, w: 128 };

// ── ЛУЖИ ───────────────────────────────────────────────────────
export const puddles = [
  { x: 760, y: 700, rx: 66, ry: 24, a: 0.4 },
  { x: 1070, y: 900, rx: 48, ry: 18, a: 0.35 },
  { x: 420, y: 1180, rx: 82, ry: 26, a: 0.45 },
  { x: 1690, y: 1150, rx: 58, ry: 20, a: 0.4 },
  { x: 1320, y: 900, rx: 44, ry: 16, a: 0.35 },
  { x: 2160, y: 1000, rx: 70, ry: 24, a: 0.4 },
  { x: 880, y: 1300, rx: 54, ry: 18, a: 0.35 },
  { x: 1660, y: 820, rx: 40, ry: 14, a: 0.3 },
  { x: 960, y: 1500, rx: 90, ry: 22, a: 0.2 },
  { x: 2560, y: 1240, rx: 62, ry: 20, a: 0.35 },
  { x: 330, y: 820, rx: 40, ry: 16, a: 0.3 },
  { x: 1850, y: 560, rx: 46, ry: 16, a: 0.3 },
];

// ── ЛЮКИ, ПЯТНА, ТРЕЩИНЫ ──────────────────────────────────────
export const manholes = [
  { x: 700, y: 700, r: 13 },
  { x: 1330, y: 940, r: 12 },
  { x: 2080, y: 1080, r: 14 },
  { x: 1120, y: 1180, r: 13 },
  { x: 500, y: 1300, r: 11 },
  { x: 2400, y: 1140, r: 12 },
];

// ── КОТ ────────────────────────────────────────────────────────
export const cat = { x: 1400, y: 1128 };

// ── ГОЛУБИ ─────────────────────────────────────────────────────
export const pigeons = [
  { x: 1210, y: 1148, fly: 0, flyV: 0 },
  { x: 1252, y: 1168, fly: 0, flyV: 0 },
  { x: 1186, y: 1172, fly: 0, flyV: 0 },
  { x: 1500, y: 700, fly: 0, flyV: 0 },
  { x: 1530, y: 712, fly: 0, flyV: 0 },
];

// ── NPC ────────────────────────────────────────────────────────
export const npcs = [
  {
    id: 'grandma', kind: 'grandma', x: 470, y: 1082, name: 'Зинаида Петровна',
    lines: [
      'Внучек, ты чей будешь? Из двенадцатого? А, не помню… Раньше всех помнила.',
      'Раньше тут качели были, а теперь эти, железные. И вода в подвале. Всё как-то не так.',
      'Мой-то на восьмом живёт, свет не включает. Говорит, экономить надо. На что экономить-то?',
      'Сын звонит по воскресеньям. Голос как из телевизора, далёкий.',
      'Тихо сегодня. Хорошо. Хоть кто-то по двору ходит.',
    ],
  },
  {
    id: 'man', kind: 'man', x: 2386, y: 1128, name: 'Серёга',
    lines: [
      'Ты не смотри, что старушка. Карбюратор — дело тонкое. Тут не спешить надо.',
      'Второй день ковыряюсь. Искра есть, бензин есть, а души нет.',
      'Раньше в гаражах до ночи сидели, чай на паяльной лампе. А сейчас всё брошенное стоит.',
      'Слышь, а не куришь? А, нет. Ну и правильно.',
    ],
    smoke: true,
  },
];

// ── ИНТЕРАКТИВ ────────────────────────────────────────────────
export const interactables = [
  {
    id: 'bench-1', kind: 'bench', x: 526, y: 1098, r: 40, bx: 470, by: 1097, label: 'сесть на лавочку',
    lines: [
      'Лавочка холодная, краска облупилась. Пахнет мокрым деревом и чужим прошлым.',
      'Сидишь — и вроде никуда не надо. Хорошее чувство.',
    ],
  },
  {
    id: 'bench-2', kind: 'bench', x: 1000, y: 1078, r: 40, bx: 1000, by: 1078, label: 'сесть на лавочку',
    lines: [
      'На этой кто-то вырезал ножом «САША + ЛЕНА 98». Интересно, где они сейчас.',
    ],
  },
  {
    id: 'swing', kind: 'swing', x: 700, y: 900, r: 58, label: 'покачаться на качелях',
    lines: [
      'Ржавые цепи скрипят на одной ноте. Как будто двор вздыхает.',
      'В детстве казалось, что если раскачаться сильно-сильно — можно улететь. Не улетел.',
    ],
  },
  {
    id: 'carousel', kind: 'carousel', x: 800, y: 985, r: 46, label: 'крутнуть карусель',
    lines: [
      'Карусель делает полоборота и замирает. Дальше — уже некому.',
    ],
  },
  {
    id: 'sandbox', kind: 'sandbox', x: 706, y: 998, r: 58, label: 'заглянуть в песочницу',
    lines: [
      'В песке — окурок, крышка от бутылки и чей-то маленький совок. Всё, что осталось от лета.',
    ],
  },
  {
    id: 'dumpster', kind: 'dumpster', x: 1288, y: 1060, r: 54, label: 'заглянуть в контейнер',
    lines: [
      'Пахнет мокрым картоном. Кто-то выбросил сервант — тот самый, из восьмидесятых, с полировкой.',
      'Сервант. Значит, и правда съезжают.',
    ],
  },
  {
    id: 'trafo', kind: 'graffiti', x: 1476, y: 850, r: 52, label: 'рассмотреть будку',
    lines: [
      'На будке написано «ЦОЙ ЖИВ» и поверх — что-то совсем неразборчивое. Гудит на одной ноте.',
      'Если приложить руку — тепло. Внутри что-то живое, трансформатор, сердце района.',
    ],
  },
  {
    id: 'hockey', kind: 'hockey', x: 430, y: 596, r: 70, label: 'заглянуть в коробку',
    lines: [
      'Коробка пустая. Сетка на воротах провисла, как старое гамак. Клюшку забыли — она так и мокнет у борта.',
      'Зимой тут заливали лёд. Все кричали. Сейчас — только дождь стучит по бортам.',
    ],
  },
  {
    id: 'ball', kind: 'ball', x: 1040, y: 880, r: 44, label: 'пнуть мяч',
    lines: [
      'Мяч старый, облезлый, но ещё прыгает. Глухой звук по мокрому асфальту.',
    ],
  },
  {
    id: 'cat', kind: 'cat', x: cat.x, y: cat.y, r: 42, label: 'погладить кота',
    lines: [
      'Кот выгибается под ладонью и урчит. Пахнет мокрой шерстью и подвалом.',
      'Он идёт за тобой. Или просто идёт. Не понять.',
    ],
  },
  {
    id: 'bus', kind: 'bus', x: 795, y: 1402, r: 62, label: 'ждать автобус',
    lines: [
      'Автобуса нет. По расписанию — 19:58. На часах 19:47. Ещё есть время подумать.',
      'Стекло остановки мокрое. В отражении — ты и один фонарь.',
    ],
  },
  {
    id: 'radio', kind: 'radio', x: 1176, y: 344, r: 56, label: 'включить радио на подоконнике',
    lines: [
      'Радио шипит, потом ловит волну. Старый вальс, будто из другой жизни.',
    ],
  },
  {
    id: 'door-12', kind: 'door', x: 274, y: 336, r: 50, label: 'набрать код',
    lines: [
      'Код не подошёл. Или это уже не тот подъезд.',
      'Домофон молчит. Внутри — только лестница и запах чужих обедов.',
    ],
  },
  {
    id: 'door-14', kind: 'door', x: 1585, y: 364, r: 50, label: 'позвонить в квартиру',
    lines: [
      'Никто не открывает. За дверью — тишина, телевизор и чья-то жизнь.',
    ],
  },
  {
    id: 'shop', kind: 'shop', x: 2366, y: 1306, r: 58, label: 'зайти в «Продукты 24»',
    lines: [
      'Внутри свет, тепло и продавщица с журналом. Пахнет хлебом и чуть-чуть хлоркой.',
      'Ты ничего не покупаешь. Просто постоял у витрины — и стало легче.',
    ],
  },
  {
    id: 'lamp-1', kind: 'lamp', x: 400, y: 600, r: 46, label: 'постоять под фонарём',
    lines: [
      'Под фонарём дождь виден по-настоящему. Миллион медленных линий.',
    ],
  },
  {
    id: 'lamppost-mid', kind: 'lamp', x: 1160, y: 1080, r: 42, label: 'постоять под фонарём',
    lines: [
      'Лампа моргает. Потом всё-таки держится. Как все мы.',
    ],
  },
  {
    id: 'puddle', kind: 'puddle', x: 760, y: 700, r: 40, label: 'наступить в лужу',
    lines: [
      'Брызги. В луже отражается одно окно и кусок неба. Целый мир, размером с сапог.',
    ],
  },
  {
    id: 'puddle2', kind: 'puddle', x: 2160, y: 1000, r: 46, label: 'наступить в лужу',
    lines: [
      'Вода холодная, через шов. Зато честно.',
    ],
  },
  {
    id: 'car-hood', kind: 'car', x: 2386, y: 1092, r: 54, label: 'заглянуть под капот',
    lines: [
      'Капот тёплый. Мотор только что работал — или это руки Серёги его грели.',
    ],
  },
  {
    id: 'pigeons', kind: 'pigeons', x: 1240, y: 1160, r: 58, label: 'спугнуть голубей',
    lines: [
      'Голуби срываются все разом. Хлопанье крыльев — единственный громкий звук за вечер.',
    ],
  },
  {
    id: 'garage-g', kind: 'graffiti', x: 2760, y: 1090, r: 52, label: 'рассмотреть гаражи',
    lines: [
      'На воротах — «СПАРТАК» и год, который уже стёрся. Внутри, наверное, всё ещё пахнет бензином.',
    ],
  },
  {
    id: 'crosswalk', kind: 'crosswalk', x: 1204, y: 1524, r: 52, label: 'посмотреть на дорогу',
    lines: [
      'Машины проезжают редко. Каждая — событие. Провожаешь глазами и думаешь: куда это всё едет.',
    ],
  },
  {
    id: 'grandma', kind: 'npc', npc: 'grandma', x: 470, y: 1102, r: 54, label: 'поговорить',
    lines: [],
  },
  {
    id: 'man', kind: 'npc', npc: 'man', x: 2386, y: 1112, r: 54, label: 'поговорить',
    lines: [],
  },
];

// ── ГЕНЕРАЦИЯ ДЕРЕВЬЕВ ────────────────────────────────────────
const noTree = [
  ...buildings.map((b) => ({ x: b.x - 26, y: b.y, w: b.w + 52, d: b.d + 76 })),
  { x: garages.x, y: garages.y, w: garages.w, d: garages.d },
  { x: hockey.x, y: hockey.y, w: hockey.w, d: hockey.d },
  { x: playground.x, y: playground.y, w: playground.w, d: playground.d },
  { x: busStop.x - 40, y: busStop.y - 40, w: busStop.w + 80, d: busStop.d + 80 },
  ...parkings.map((p) => ({ x: p.x - 26, y: p.y - 26, w: p.w + 52, d: p.d + 52 })),
  { x: dumpsterPad.x, y: dumpsterPad.y, w: dumpsterPad.w, d: dumpsterPad.h },
  { x: trafo.x, y: trafo.y, w: trafo.w, d: trafo.d },
];

function inRect(px, py, r) {
  return px > r.x - 22 && px < r.x + r.w + 22 && py > r.y - 22 && py < r.y + r.d + 22;
}

function nearPath(px, py) {
  for (const p of paths) {
    const w = p.w / 2 + 18;
    for (let i = 0; i < p.pts.length - 1; i++) {
      const [x1, y1] = p.pts[i];
      const [x2, y2] = p.pts[i + 1];
      const dx = x2 - x1, dy = y2 - y1;
      const len = dx * dx + dy * dy;
      let t = len ? ((px - x1) * dx + (py - y1) * dy) / len : 0;
      t = Math.max(0, Math.min(1, t));
      const cx = x1 + dx * t, cy = y1 + dy * t;
      if (Math.hypot(px - cx, py - cy) < w) return true;
    }
  }
  return false;
}

{
  const r = rng(9091);
  const fixed = [
    [150, 560], [1420, 706], [1466, 1050], [2124, 700], [2090, 880], [2196, 1186],
    [646, 1186], [1226, 780], [1136, 1022], [1906, 792], [2276, 1006], [2900, 1300],
    [1670, 1336], [548, 1352], [2830, 640], [1526, 1156], [790, 486], [1310, 1136],
    [1004, 700], [1790, 930], [400, 960], [2620, 700], [1200, 1280], [2330, 1240],
  ];
  for (const [x, y] of fixed) {
    if (!noTree.some((rc) => inRect(x, y, rc)) && !nearPath(x, y)) {
      trees.push({ x, y, seed: r(), kind: r() > 0.55 ? 'birch' : 'poplar', s: 0.85 + r() * 0.4 });
    }
  }
  let tries = 0;
  while (trees.length < 40 && tries < 4000) {
    tries++;
    const x = 60 + r() * (W - 120);
    const y = 70 + r() * 1300;
    if (noTree.some((rc) => inRect(x, y, rc))) continue;
    if (nearPath(x, y)) continue;
    if (y > 1340) continue;
    let ok = true;
    for (const t of trees) {
      if (Math.hypot(t.x - x, t.y - y) < 74) { ok = false; break; }
    }
    if (!ok) continue;
    for (const l of lamps) if (Math.hypot(l.x - x, l.y - y) < 40) ok = false;
    if (!ok) continue;
    trees.push({ x, y, seed: r(), kind: r() > 0.5 ? 'birch' : 'poplar', s: 0.8 + r() * 0.5 });
  }
}
trees.sort((a, b) => a.y - b.y);

// ── МАШИНЫ ────────────────────────────────────────────────────
export const cars = [];
{
  const r = rng(4242);
  const slotW = 78;
  const carH = 112;
  for (const p of parkings) {
    const rr = rng(p.seed);
    const cols = Math.max(1, Math.floor((p.w - 24) / slotW));
    const startX = p.x + (p.w - cols * slotW) / 2 + 6;
    for (let row = 0; row < p.rows; row++) {
      const cy = row === 0 ? p.y + 16 : p.y + p.d - carH - 16;
      for (let c = 0; c < cols; c++) {
        const cx = startX + c * slotW + (slotW - 46) / 2;
        if (rr() < 0.28) continue; // пустое место
        const color = CARS_COLORS[Math.floor(rr() * CARS_COLORS.length)];
        cars.push({
          x: cx, y: cy, w: 46, h: carH, color,
          rot: (rr() - 0.5) * 0.06,
          cover: rr() < 0.12,
          seed: rr(),
        });
      }
    }
  }
  // машины «как поставили»
  cars.push({ x: 1500, y: 1156, w: 46, h: 110, color: '#5b5147', rot: -0.12, seed: 0.3, cover: false });
  cars.push({ x: 940, y: 1160, w: 46, h: 110, color: '#3d4750', rot: 0.16, seed: 0.6, cover: false });
  // «Лада» Серёги с открытым капотом
  cars.push({ x: 2340, y: 1030, w: 48, h: 116, color: '#6b7a6a', rot: 0.03, seed: 0.9, hoodOpen: true });
}

// ── МЯЧ ───────────────────────────────────────────────────────
export const ball = { x: 1040, y: 880, r: 6.5 };

// ── КОЛЛИЗИИ ─────────────────────────────────────────────────
export const rects = [];
export const circles = [];

for (const b of buildings) rects.push({ x: b.x, y: b.y, w: b.w, h: b.d, tag: 'building' });
rects.push({ x: garages.x, y: garages.y, w: garages.w, h: garages.d, tag: 'garage' });

for (const t of trees) circles.push({ x: t.x, y: t.y, r: 8 });
for (const l of lamps) circles.push({ x: l.x, y: l.y, r: 5 });

for (const b of benches) {
  if (b.dir === 0) rects.push({ x: b.x - 34, y: b.y - 10, w: 68, h: 22, tag: 'bench' });
  else rects.push({ x: b.x - 34, y: b.y - 10, w: 68, h: 22, tag: 'bench' });
}

for (const d of dumpsters) rects.push({ x: d.x - 14, y: d.y - 22, w: 34, h: 46, tag: 'dumpster' });
rects.push({ x: trafo.x, y: trafo.y, w: trafo.w, h: trafo.d, tag: 'trafo' });

// коробка: стены, с проёмом
{
  const { x, y, w, d, wall } = hockey;
  rects.push({ x, y, w, h: wall, tag: 'wall' });
  rects.push({ x, y: y + d - wall, w, h: wall, tag: 'wall' });
  rects.push({ x, y, w: wall, h: d, tag: 'wall' });
  const gate = 64;
  rects.push({ x: x + w - wall, y, w: wall, h: (d - gate) / 2, tag: 'wall' });
  rects.push({ x: x + w - wall, y: y + d - (d - gate) / 2, w: wall, h: (d - gate) / 2, tag: 'wall' });
}

// качели
rects.push({ x: swing.x - 6, y: swing.y - 8, w: 12, h: 14, tag: 'swing' });
rects.push({ x: swing.x + swing.w - 6, y: swing.y - 8, w: 12, h: 14, tag: 'swing' });
// горка
rects.push({ x: slide.x, y: slide.y, w: slide.w, h: slide.d, tag: 'slide' });
// карусель
circles.push({ x: carousel.x, y: carousel.y, r: 9 }); // только стойка — по диску можно ходить
// грибок
circles.push({ x: mushroom.x, y: mushroom.y, r: 7 });
// остановка
rects.push({ x: busStop.x, y: busStop.y, w: 8, h: busStop.d, tag: 'glass' });
rects.push({ x: busStop.x + busStop.w - 8, y: busStop.y, w: 8, h: busStop.d, tag: 'glass' });
rects.push({ x: busStop.x, y: busStop.y, w: busStop.w, h: 6, tag: 'glass' });
// машины
for (const c of cars) rects.push({ x: c.x, y: c.y, w: c.w, h: c.h, tag: 'car' });

// NPC — бабушка и мужик (раньше сквозь них проходили насквозь)
for (const n of npcs) circles.push({ x: n.x, y: n.y, r: 11, tag: 'npc' });

export function isBlocked(px, py, r = 10) {
  if (px < 24 || py < 40 || px > W - 24 || py > H - 20) return true;
  for (const rc of rects) {
    const cx = Math.max(rc.x, Math.min(px, rc.x + rc.w));
    const cy = Math.max(rc.y, Math.min(py, rc.y + rc.h));
    if ((px - cx) * (px - cx) + (py - cy) * (py - cy) < r * r) return true;
  }
  for (const c of circles) {
    const d = Math.hypot(px - c.x, py - c.y);
    if (d < c.r + r) return true;
  }
  return false;
}

// ── ДИАЛОГИ ──────────────────────────────────────────────────
export const introThoughts = [
  '19:47. Дождь. Двор как двор — таких тысячи, и все они похожи на этот.',
  'Ты вышел просто так. Без цели. Просто выйти — тоже цель.',
];
