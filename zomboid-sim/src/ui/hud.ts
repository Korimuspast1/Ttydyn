import { ZomboidAudio } from '../audio/sfx';
import { IsoCityRenderer } from '../engine/isoRenderer';
import { ZomboidSimulation } from '../engine/sim';
import {
  RoofMode,
  SIM_TOOLS,
  SimToolId,
  TimeOfDayMode,
  ToolCategory,
  UnitInspectionData,
  WeatherMode,
} from '../engine/types';
import { CityWorld } from '../engine/world';

const CATEGORIES: { id: ToolCategory; label: string }[] = [
  { id: 'all', label: '📋 Все (18)' },
  { id: 'zombies', label: '🧟 Эпидемия Нокс' },
  { id: 'survivors', label: '🔫 Выжившие и армия' },
  { id: 'events', label: '🚁 События, базы и огонь' },
];

export class ZomboidHUD {
  public activeCategory: ToolCategory = 'all';
  public activeTool: SimToolId = 'horde_wave';
  public simSpeed = 1;
  public paused = false;

  public minimapCanvas!: HTMLCanvasElement;
  private statsEl!: HTMLElement;
  private cityBadgeEl!: HTMLElement;
  private radioEl!: HTMLElement;
  private inspectorEl!: HTMLElement;
  private toolsRowEl!: HTMLElement;
  private catRowEl!: HTMLElement;
  private roofBtn!: HTMLButtonElement;
  private timeBtn!: HTMLButtonElement;
  private weatherBtn!: HTMLButtonElement;
  private waveBtn!: HTMLButtonElement;
  private soundBtn!: HTMLButtonElement;
  private speedBtns: HTMLButtonElement[] = [];

  private radioLog: { time: string; msg: string; color: string }[] = [];

  constructor(
    root: HTMLElement,
    private world: CityWorld,
    private sim: ZomboidSimulation,
    private renderer: IsoCityRenderer,
    private audio: ZomboidAudio,
    private onRegenerateCity: () => void,
  ) {
    this.mount(root);
    this.attachRadio();
    this.pushRadio(`Экстренное вещание Нокс: вспышка в г. ${this.world.townName}! Выжившие баррикадируют дома.`, '#ffd166');
  }

  private attachRadio(): void {
    this.sim.onRadioBroadcast = (msg: string, color = '#90e0ef') => {
      this.pushRadio(msg, color);
    };
  }

  public pushRadio(msg: string, color = '#90e0ef'): void {
    this.radioLog.unshift({ time: this.sim.formattedClock, msg, color });
    if (this.radioLog.length > 12) this.radioLog.length = 12;
    this.renderRadio();
  }

  private renderRadio(): void {
    if (!this.radioEl) return;
    let html = `<div class="pz-radio-title">📻 93.2 FM • ЭКСТРЕННОЕ РАДИО НОКС</div>`;
    for (let i = 0; i < Math.min(6, this.radioLog.length); i++) {
      const r = this.radioLog[i];
      html += `<div class="pz-radio-entry" style="border-left-color:${r.color}"><b>[${r.time}]</b> ${r.msg}</div>`;
    }
    this.radioEl.innerHTML = html;
  }

  public bindNewWorld(world: CityWorld, sim: ZomboidSimulation): void {
    this.world = world;
    this.sim = sim;
    this.attachRadio();
    this.updateCityBadge();
    this.pushRadio(`Сгенерирован новый округ: г. ${world.townName} (#${world.seed % 10000})!`, '#80ed99');
  }

  private mount(root: HTMLElement): void {
    // 1. Top Bar
    const topBar = document.createElement('div');
    topBar.className = 'pz-top-bar';

    const titlePanel = document.createElement('div');
    titlePanel.className = 'pz-panel pz-title-row';

    const brand = document.createElement('div');
    brand.className = 'pz-brand';
    brand.textContent = '☣ PROJECT ZOMBOID: ОКРУГ НОКС 2.5D';

    this.cityBadgeEl = document.createElement('div');
    this.cityBadgeEl.className = 'pz-city-badge';

    this.statsEl = document.createElement('div');
    this.statsEl.className = 'pz-stats-strip';

    titlePanel.append(brand, this.cityBadgeEl, this.statsEl);

    // Quick Director Action Strip
    const controls = document.createElement('div');
    controls.className = 'pz-controls-row';

    const newCityBtn = document.createElement('button');
    newCityBtn.className = 'pz-btn accent';
    newCityBtn.textContent = '🎲 Новый случайный город';
    newCityBtn.onclick = () => {
      this.audio.unlock();
      this.audio.playUiClick(620);
      this.onRegenerateCity();
    };

    const dlExeLink = document.createElement('a');
    dlExeLink.className = 'pz-btn';
    dlExeLink.style.textDecoration = 'none';
    dlExeLink.style.borderColor = '#52b788';
    dlExeLink.style.color = '#d8f3dc';
    dlExeLink.href = './Zomboid-Knox-PC.exe';
    dlExeLink.download = 'Zomboid-Knox-PC.exe';
    dlExeLink.textContent = '⬇ Скачать .EXE';

    this.roofBtn = document.createElement('button');
    this.roofBtn.className = 'pz-btn active';
    this.roofBtn.textContent = '🏠 Крыши: Авто-срез';
    this.roofBtn.onclick = () => {
      const order: RoofMode[] = ['auto', 'cut_all', 'solid'];
      const next = order[(order.indexOf(this.renderer.roofMode) + 1) % order.length];
      this.renderer.roofMode = next;
      this.roofBtn.textContent =
        next === 'auto' ? '🏠 Крыши: Авто-срез' : next === 'cut_all' ? '🏚 Скрыть ВСЕ крыши' : '🏢 Крыши: Закрыты';
    };

    this.timeBtn = document.createElement('button');
    this.timeBtn.className = 'pz-btn';
    this.timeBtn.textContent = '🕒 Сутки: Цикл';
    this.timeBtn.onclick = () => {
      const order: TimeOfDayMode[] = ['auto', 'day', 'dusk', 'night'];
      const next = order[(order.indexOf(this.sim.timeMode) + 1) % order.length];
      this.sim.timeMode = next;
      this.timeBtn.textContent =
        next === 'auto' ? '🕒 Сутки: Цикл' : next === 'day' ? '☀ День' : next === 'dusk' ? '🌅 Закат' : '🌙 Тёмная ночь';
    };

    this.weatherBtn = document.createElement('button');
    this.weatherBtn.className = 'pz-btn';
    this.weatherBtn.textContent = '🌤 Ясно';
    this.weatherBtn.onclick = () => {
      const order: WeatherMode[] = ['clear', 'rain', 'storm', 'fog'];
      const next = order[(order.indexOf(this.sim.weather) + 1) % order.length];
      this.sim.weather = next;
      this.weatherBtn.textContent =
        next === 'clear' ? '🌤 Ясно' : next === 'rain' ? '🌧 Ливень' : next === 'storm' ? '⛈ Гроза' : '🌫 Густой туман';
    };

    this.waveBtn = document.createElement('button');
    this.waveBtn.className = 'pz-btn active';
    this.waveBtn.textContent = '📡 Волны шума';
    this.waveBtn.onclick = () => {
      this.sim.showSoundWaves = !this.sim.showSoundWaves;
      this.waveBtn.classList.toggle('active', this.sim.showSoundWaves);
    };

    this.soundBtn = document.createElement('button');
    this.soundBtn.className = 'pz-btn active';
    this.soundBtn.textContent = '🔊 Звук';
    this.soundBtn.onclick = () => {
      this.audio.unlock();
      this.audio.muted = !this.audio.muted;
      this.audio.setSuspended(this.audio.muted);
      this.soundBtn.textContent = !this.audio.muted ? '🔊 Звук' : '🔇 Тихо';
      this.soundBtn.classList.toggle('active', !this.audio.muted);
    };

    controls.append(newCityBtn, dlExeLink, this.roofBtn, this.timeBtn, this.weatherBtn, this.waveBtn, this.soundBtn);

    // Speed buttons
    const speeds = [
      { label: '⏸', spd: 0 },
      { label: '▶ 1x', spd: 1 },
      { label: '⏩ 2x', spd: 2 },
      { label: '⏩ 4x', spd: 4 },
    ];
    for (const s of speeds) {
      const b = document.createElement('button');
      b.className = `pz-btn${s.spd === 1 ? ' active' : ''}`;
      b.textContent = s.label;
      b.onclick = () => {
        if (s.spd === 0) {
          this.paused = true;
        } else {
          this.paused = false;
          this.simSpeed = s.spd;
        }
        this.speedBtns.forEach((btn, idx) =>
          btn.classList.toggle('active', speeds[idx].spd === (this.paused ? 0 : this.simSpeed)),
        );
      };
      this.speedBtns.push(b);
      controls.appendChild(b);
    }

    topBar.append(titlePanel, controls);
    root.appendChild(topBar);

    // 2. Right Minimap & Knox Emergency Radio Feed
    const rightDock = document.createElement('div');
    rightDock.className = 'pz-right-dock';

    const mapBox = document.createElement('div');
    mapBox.className = 'pz-panel pz-minimap-box';
    const mapHead = document.createElement('div');
    mapHead.className = 'pz-minimap-header';
    mapHead.innerHTML = '<span>РАДАР ОКРУГА</span><span>148×148</span>';

    this.minimapCanvas = document.createElement('canvas');
    this.minimapCanvas.id = 'minimap-canvas';
    this.minimapCanvas.width = 148;
    this.minimapCanvas.height = 148;
    this.minimapCanvas.addEventListener('pointerdown', (ev) => {
      const rect = this.minimapCanvas.getBoundingClientRect();
      const nx = (ev.clientX - rect.left) / rect.width;
      const ny = (ev.clientY - rect.top) / rect.height;
      this.renderer.camX = nx * 148;
      this.renderer.camY = ny * 148;
      this.renderer.clampCamera();
    });
    mapBox.append(mapHead, this.minimapCanvas);

    this.radioEl = document.createElement('div');
    this.radioEl.className = 'pz-panel pz-radio-box';

    rightDock.append(mapBox, this.radioEl);
    root.appendChild(rightDock);

    // 3. Biometric Unit & Safehouse Inspector
    this.inspectorEl = document.createElement('div');
    this.inspectorEl.className = 'pz-panel pz-inspector';
    root.appendChild(this.inspectorEl);

    // 4. Bottom Director Dock
    const bottomDock = document.createElement('div');
    bottomDock.className = 'pz-panel pz-bottom-dock';

    this.catRowEl = document.createElement('div');
    this.catRowEl.className = 'pz-cat-tabs';

    this.toolsRowEl = document.createElement('div');
    this.toolsRowEl.className = 'pz-tools-row';

    bottomDock.append(this.catRowEl, this.toolsRowEl);
    root.appendChild(bottomDock);

    this.updateCityBadge();
    this.renderCategories();
    this.renderTools();
  }

  private updateCityBadge(): void {
    this.cityBadgeEl.textContent = `📍 г. ${this.world.townName} (#${this.world.seed % 10000}) • ${this.world.buildings.length} зданий • ${this.world.vehicles.length} авто`;
  }

  public selectTool(toolId: SimToolId): void {
    this.activeTool = toolId;
    this.renderTools();
  }

  private renderCategories(): void {
    this.catRowEl.innerHTML = '';
    for (const c of CATEGORIES) {
      const b = document.createElement('button');
      b.className = `pz-cat-btn${this.activeCategory === c.id ? ' active' : ''}`;
      b.textContent = c.label;
      b.onclick = () => {
        this.activeCategory = c.id;
        this.renderCategories();
        if (c.id !== 'all') {
          const firstTool = SIM_TOOLS.find((t) => t.category === c.id);
          if (firstTool) this.activeTool = firstTool.id;
        }
        this.renderTools();
      };
      this.catRowEl.appendChild(b);
    }
  }

  private renderTools(): void {
    this.toolsRowEl.innerHTML = '';
    for (const tool of SIM_TOOLS) {
      if (this.activeCategory !== 'all' && tool.category !== this.activeCategory) continue;
      const b = document.createElement('button');
      b.className = `pz-tool-btn${this.activeTool === tool.id ? ' active' : ''}`;
      b.title = `${tool.name} — ${tool.desc}`;
      b.innerHTML = `<span>${tool.icon}</span><span>${tool.short}</span>`;
      b.onclick = () => {
        this.audio.unlock();
        this.audio.playUiClick(500);
        this.activeTool = tool.id;
        this.renderTools();
      };
      this.toolsRowEl.appendChild(b);
    }
  }

  public updateTelemetry(hoverUnit: UnitInspectionData | null): void {
    this.statsEl.innerHTML = `
      <span class="pz-stat clock">⌚ ${this.sim.formattedClock}</span>
      <span class="pz-stat surv">🧑 Выжившие: ${this.sim.livingCount}</span>
      <span class="pz-stat zed">🧟 Орда: ${this.sim.zombieCount}</span>
      <span class="pz-stat inf">☣ Обратились: ${this.sim.totalInfectedTurned}</span>
      <span class="pz-stat safe">🛡 Убежища: ${this.sim.safehouseCount}</span>
    `;

    if (!hoverUnit) {
      this.inspectorEl.classList.remove('visible');
      return;
    }

    this.inspectorEl.classList.add('visible');
    const zed = hoverUnit.isZombie;
    const hpPct = Math.max(0, Math.min(100, Math.round((hoverUnit.hp / Math.max(1, hoverUnit.maxHp)) * 100)));

    this.inspectorEl.innerHTML = `
      <div class="pz-insp-head">
        <span>${zed ? '🧟' : '🧑'} ${hoverUnit.name}</span>
        <span>${hoverUnit.hp}/${hoverUnit.maxHp} HP</span>
      </div>
      <div class="pz-insp-sub">${hoverUnit.roleName} • ${hoverUnit.taskText}</div>
      <div class="pz-bar-wrap"><div class="pz-bar-fill ${zed ? 'zed' : ''}" style="width:${hpPct}%"></div></div>
      ${
        !zed
          ? `<div class="pz-insp-sub">🔫 ${hoverUnit.weaponName} (патроны: ${hoverUnit.ammo}) • 💀 Убито: ${hoverUnit.kills}</div>
             <div class="pz-insp-sub">🥫 Еда: ${hoverUnit.food} • 🪵 Доски: ${hoverUnit.planks} • 🩹 Бинты: ${hoverUnit.bandages}</div>
             <div class="pz-insp-sub">🏠 Убежище: ${hoverUnit.safehouseName || 'В поиске дома'}</div>`
          : `<div class="pz-insp-sub">💀 Штамм Нокс • Идёт на выстрелы, сирены и свет фонарей</div>`
      }
      ${
        !zed && hoverUnit.infectionPct > 0
          ? `<div class="pz-insp-sub" style="color:#a7c957">☣ Инкубация вируса Нокс: ${hoverUnit.infectionPct}%</div>
             <div class="pz-bar-wrap"><div class="pz-bar-fill virus" style="width:${hoverUnit.infectionPct}%"></div></div>`
          : ''
      }
      ${
        hoverUnit.moodles.length > 0
          ? `<div class="pz-moodles">${hoverUnit.moodles
              .map(
                (m) =>
                  `<span class="pz-moodle-tag" style="border-color:${m.color};color:#fff">${m.label}</span>`,
              )
              .join('')}</div>`
          : ''
      }
    `;
  }
}
