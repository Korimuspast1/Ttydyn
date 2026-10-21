import { ZomboidAudio } from '../audio/sfx';
import { IsoCityRenderer } from '../engine/isoRenderer';
import { ZomboidSimulation } from '../engine/sim';
import {
  BRUSH_SIZES,
  RADAR_SPAN,
  RoofMode,
  SIM_TOOLS,
  SimToolId,
  TimeOfDayMode,
  ToolCategory,
  UnitInspectionData,
  WeatherMode,
} from '../engine/types';
import { CityWorld } from '../engine/world';
import { createZomboidPixelIcon } from './pixelIcons';

const TABS: {
  id: ToolCategory;
  label: string;
  icon: 'tab_all' | 'tab_build' | 'tab_survivors' | 'tab_zombies' | 'tab_events';
}[] = [
  { id: 'all', label: 'Все силы', icon: 'tab_all' },
  { id: 'build', label: 'Базы и авто', icon: 'tab_build' },
  { id: 'survivors', label: 'Люди и отряды', icon: 'tab_survivors' },
  { id: 'zombies', label: 'Орда и Нокс', icon: 'tab_zombies' },
  { id: 'events', label: 'События', icon: 'tab_events' },
];

export class ZomboidHUD {
  public activeCategory: ToolCategory = 'all';
  public activeTool: SimToolId = 'expand_base';
  public simSpeed = 1; // Supports 0.5 (Slow-Mo!), 1, 2, 4
  public paused = false;
  public touchPanMode = false;

  public minimapCanvas!: HTMLCanvasElement;
  private coordsEl!: HTMLElement;
  private bannerEl!: HTMLElement;
  private bannerTimer: number | null = null;
  private topLeftEl!: HTMLElement;
  private restoreTopBtn!: HTMLButtonElement;
  private dockEl!: HTMLElement;
  private restoreDockBtn!: HTMLButtonElement;
  private playerBarEl!: HTMLElement;
  private playerStatusEl!: HTMLElement;
  private statsRowEl!: HTMLElement;
  private versionTagEl!: HTMLElement;
  private radioListEl!: HTMLElement;
  private passportEl!: HTMLElement;
  private infoTitleEl!: HTMLElement;
  private infoDescEl!: HTMLElement;
  private tabsStripEl!: HTMLElement;
  private trayEl!: HTMLElement;
  private panThumbBtn!: HTMLButtonElement;

  private playHeroBtn!: HTMLButtonElement;
  private playZombieBtn!: HTMLButtonElement;
  private roofBtn!: HTMLButtonElement;
  private timeBtn!: HTMLButtonElement;
  private weatherBtn!: HTMLButtonElement;
  private soundBtn!: HTMLButtonElement;
  private brushBtns: HTMLButtonElement[] = [];
  private speedBtns: { el: HTMLButtonElement; val: number }[] = [];

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
    this.pushRadio(
      `Группа №1 заняла «Полицейский участок ${this.world.townName}»! Нажмите [🎮 Играть за бойца] или [E] на любом персонаже!`,
      '#4cc9f0',
    );
  }

  private attachRadio(): void {
    this.sim.onRadioBroadcast = (msg: string, color = '#ffd466') => {
      this.pushRadio(msg, color);
      this.showHeraldBanner(msg, color);
    };
  }

  public showHeraldBanner(msg: string, color = '#ffd466'): void {
    if (!this.bannerEl) return;
    this.bannerEl.textContent = msg;
    this.bannerEl.style.color = color;
    this.bannerEl.classList.add('visible');
    if (this.bannerTimer) window.clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => {
      this.bannerEl.classList.remove('visible');
    }, 3400);
  }

  public pushRadio(msg: string, color = '#ffd466'): void {
    this.radioLog.unshift({ time: this.sim.formattedClock, msg, color });
    if (this.radioLog.length > 14) this.radioLog.length = 14;
    if (!this.radioListEl) return;
    this.radioListEl.innerHTML = this.radioLog
      .slice(0, 5)
      .map((r) => `<div class="wb-radio-row" style="border-left-color:${r.color}"><b>[${r.time}]</b> ${r.msg}</div>`)
      .join('');
  }

  public bindNewWorld(world: CityWorld, sim: ZomboidSimulation): void {
    this.world = world;
    this.sim = sim;
    this.attachRadio();
    this.versionTagEl.textContent = `Округ ${world.townName} • Бесконечный мир`;
    this.pushRadio(`Новый открытый мир: ${world.townName}! Вы можете вселиться в любого человека или зомби!`, '#80ed99');
  }

  public enterPossessionZoom(): void {
    if (this.renderer.zoom < 1.55) {
      this.renderer.zoom = 1.68;
    }
    this.paused = false;
    this.syncSpeedHighlight();
  }

  private mount(root: HTMLElement): void {
    // 1. WorldBox Event Herald Banner
    this.bannerEl = document.createElement('div');
    this.bannerEl.className = 'wb-panel wb-event-banner';
    root.appendChild(this.bannerEl);

    // Restore pills when F1/F2 panels collapsed
    this.restoreTopBtn = document.createElement('button');
    this.restoreTopBtn.className = 'wb-panel wb-restore-pill wb-restore-top-left wb-panel-hidden';
    this.restoreTopBtn.textContent = '📊 Показать статистику [F1]';
    this.restoreTopBtn.onclick = () => this.toggleTopLeft(false);
    root.appendChild(this.restoreTopBtn);

    this.restoreDockBtn = document.createElement('button');
    this.restoreDockBtn.className = 'wb-panel wb-restore-pill wb-restore-bottom wb-panel-hidden';
    this.restoreDockBtn.textContent = '🧰 Открыть панель сил WorldBox [F2]';
    this.restoreDockBtn.onclick = () => this.toggleBottomDock(false);
    root.appendChild(this.restoreDockBtn);

    // 2. Top-Left WorldBox Panel
    this.topLeftEl = document.createElement('div');
    this.topLeftEl.className = 'wb-panel wb-top-left';

    const brandRow = document.createElement('div');
    brandRow.className = 'wb-brand-row';

    const dot = document.createElement('span');
    dot.className = 'wb-crown-dot';

    const title = document.createElement('span');
    title.className = 'wb-game-title';
    title.textContent = 'ZOMBOID × WORLDBOX 2.5D';

    this.versionTagEl = document.createElement('span');
    this.versionTagEl.textContent = `Округ ${this.world.townName} • Бесконечный мир`;
    this.versionTagEl.className = 'wb-version-tag';

    const hideTop = document.createElement('button');
    hideTop.className = 'wb-collapse-btn';
    hideTop.textContent = 'Скрыть [F1]';
    hideTop.onclick = () => this.toggleTopLeft(true);

    brandRow.append(dot, title, this.versionTagEl, hideTop);

    this.statsRowEl = document.createElement('div');
    this.statsRowEl.className = 'wb-stats-row';

    // Quick WorldBox wooden buttons row (Play as Survivor / Play as Zombie / Squad #1 / World / Environment!)
    const quick = document.createElement('div');
    quick.className = 'wb-quick-buttons';

    this.playHeroBtn = document.createElement('button');
    this.playHeroBtn.className = 'wb-mini-btn wb-mini-play';
    this.playHeroBtn.textContent = '🎮 Играть за бойца';
    this.playHeroBtn.onclick = () => {
      this.audio.unlock();
      if (this.sim.controlledUid > 0) {
        this.sim.releaseControl();
      } else if (this.sim.possessBestUnit(false, this.renderer.camX, this.renderer.camY)) {
        this.enterPossessionZoom();
      }
    };

    this.playZombieBtn = document.createElement('button');
    this.playZombieBtn.className = 'wb-mini-btn wb-mini-zombie';
    this.playZombieBtn.textContent = '🧟 Играть за зомби';
    this.playZombieBtn.onclick = () => {
      this.audio.unlock();
      if (this.sim.possessBestUnit(true, this.renderer.camX, this.renderer.camY)) {
        this.enterPossessionZoom();
      }
    };

    const jumpSquad1Btn = document.createElement('button');
    jumpSquad1Btn.className = 'wb-mini-btn wb-mini-squad1';
    jumpSquad1Btn.textContent = '🚓 Группа №1';
    jumpSquad1Btn.onclick = () => {
      this.audio.unlock();
      this.audio.playUiClick(660);
      this.sim.releaseControl();
      this.renderer.focusSquad1PoliceStation();
    };

    const newWorldBtn = document.createElement('button');
    newWorldBtn.className = 'wb-mini-btn wb-mini-accent';
    newWorldBtn.textContent = '🎲 Новый мир';
    newWorldBtn.onclick = () => {
      this.audio.unlock();
      this.audio.playUiClick(580);
      this.onRegenerateCity();
    };

    this.roofBtn = document.createElement('button');
    this.roofBtn.className = 'wb-mini-btn';
    this.roofBtn.textContent = '🏠 Крыши: Авто';
    this.roofBtn.onclick = () => {
      const order: RoofMode[] = ['auto', 'cut_all', 'solid'];
      const next = order[(order.indexOf(this.renderer.roofMode) + 1) % order.length];
      this.renderer.roofMode = next;
      this.roofBtn.textContent =
        next === 'auto' ? '🏠 Крыши: Авто' : next === 'cut_all' ? '🏚 Все открыты' : '🏢 Крыши вкл.';
    };

    this.timeBtn = document.createElement('button');
    this.timeBtn.className = 'wb-mini-btn';
    this.timeBtn.textContent = '🕒 Цикл суток';
    this.timeBtn.onclick = () => {
      const order: TimeOfDayMode[] = ['auto', 'day', 'dusk', 'night'];
      const next = order[(order.indexOf(this.sim.timeMode) + 1) % order.length];
      this.sim.timeMode = next;
      this.timeBtn.textContent =
        next === 'auto' ? '🕒 Цикл суток' : next === 'day' ? '☀ День' : next === 'dusk' ? '🌅 Закат' : '🌙 Ночь';
    };

    this.weatherBtn = document.createElement('button');
    this.weatherBtn.className = 'wb-mini-btn';
    this.weatherBtn.textContent = '🌤 Ясно';
    this.weatherBtn.onclick = () => {
      const order: WeatherMode[] = ['clear', 'rain', 'storm', 'fog'];
      const next = order[(order.indexOf(this.sim.weather) + 1) % order.length];
      this.sim.weather = next;
      this.weatherBtn.textContent =
        next === 'clear' ? '🌤 Ясно' : next === 'rain' ? '🌧 Дождь' : next === 'storm' ? '⛈ Гроза' : '🌫 Туман';
    };

    this.soundBtn = document.createElement('button');
    this.soundBtn.className = 'wb-mini-btn';
    this.soundBtn.textContent = '🔊 Звук';
    this.soundBtn.onclick = () => {
      this.audio.unlock();
      this.audio.muted = !this.audio.muted;
      this.audio.setSuspended(this.audio.muted);
      this.soundBtn.textContent = this.audio.muted ? '🔇 Тихо' : '🔊 Звук';
    };

    quick.append(
      this.playHeroBtn,
      this.playZombieBtn,
      jumpSquad1Btn,
      newWorldBtn,
      this.roofBtn,
      this.timeBtn,
      this.weatherBtn,
      this.soundBtn,
    );
    this.topLeftEl.append(brandRow, this.statsRowEl, quick);
    root.appendChild(this.topLeftEl);

    // 3. Top-Right Infinite Open World Radar + 93.2 FM Radio
    const topRight = document.createElement('div');
    topRight.className = 'wb-panel wb-top-right';

    const radarHdr = document.createElement('div');
    radarHdr.className = 'wb-slice-header';
    radarHdr.innerHTML = '<span>РАДАР МИРА</span><span id="wb-coords">17, 16</span>';
    this.coordsEl = radarHdr.querySelector('#wb-coords')!;

    this.minimapCanvas = document.createElement('canvas');
    this.minimapCanvas.id = 'minimap-canvas';
    this.minimapCanvas.width = 160;
    this.minimapCanvas.height = 128;
    this.minimapCanvas.addEventListener('pointerdown', (ev) => {
      const rect = this.minimapCanvas.getBoundingClientRect();
      const nx = (ev.clientX - rect.left) / rect.width - 0.5;
      const ny = (ev.clientY - rect.top) / rect.height - 0.5;
      this.renderer.camX += nx * RADAR_SPAN;
      this.renderer.camY += ny * RADAR_SPAN;
    });

    const radioHdr = document.createElement('div');
    radioHdr.className = 'wb-slice-header';
    radioHdr.innerHTML = '<span>📻 93.2 FM НОКС</span>';

    this.radioListEl = document.createElement('div');
    this.radioListEl.className = 'wb-radio-list';

    topRight.append(radarHdr, this.minimapCanvas, radioHdr, this.radioListEl);
    root.appendChild(topRight);

    // 4. Right-Edge WorldBox Thumb Controls
    const thumbDock = document.createElement('div');
    thumbDock.className = 'wb-panel wb-thumb-dock';

    this.panThumbBtn = document.createElement('button');
    this.panThumbBtn.className = 'wb-thumb-btn';
    this.panThumbBtn.innerHTML = '<span>🤚</span><small>Камера</small>';
    this.panThumbBtn.onclick = () => {
      this.touchPanMode = !this.touchPanMode;
      this.panThumbBtn.classList.toggle('pan-active', this.touchPanMode);
    };

    const zoomIn = document.createElement('button');
    zoomIn.className = 'wb-thumb-btn';
    zoomIn.innerHTML = '<span>+</span><small>Ближе</small>';
    zoomIn.onclick = () => {
      this.renderer.zoom = Math.min(3.2, this.renderer.zoom * 1.2);
    };

    const zoomOut = document.createElement('button');
    zoomOut.className = 'wb-thumb-btn';
    zoomOut.innerHTML = '<span>−</span><small>Дальше</small>';
    zoomOut.onclick = () => {
      this.renderer.zoom = Math.max(0.45, this.renderer.zoom / 1.2);
    };

    thumbDock.append(this.panThumbBtn, zoomIn, zoomOut);
    root.appendChild(thumbDock);

    // 5. Left WorldBox Unit Passport Card (Delegated pointerdown so Possess button ALWAYS responds!)
    this.passportEl = document.createElement('div');
    this.passportEl.className = 'wb-panel wb-passport';
    this.passportEl.addEventListener('pointerdown', (ev) => {
      const target = (ev.target as HTMLElement).closest<HTMLElement>('[data-action]');
      if (!target) return;
      ev.stopPropagation();
      this.audio.unlock();
      const action = target.dataset.action;
      if (action === 'possess') {
        const uid = Number(target.dataset.uid || '0');
        if (uid > 0 && this.sim.possessUnitByUid(uid)) {
          this.enterPossessionZoom();
        }
      } else if (action === 'release') {
        this.sim.releaseControl();
      } else if (action === 'cycle') {
        if (this.sim.cycleControlledUnit()) this.enterPossessionZoom();
      }
    });
    root.appendChild(this.passportEl);

    // 5.5 Direct Play-As-Anyone WorldBox Bottom Control Bar!
    this.playerBarEl = document.createElement('div');
    this.playerBarEl.className = 'wb-panel wb-player-bar';
    this.playerStatusEl = document.createElement('div');
    this.playerStatusEl.className = 'wb-player-top';

    const actRow = document.createElement('div');
    actRow.className = 'wb-player-actions';

    const mkAct = (label: string, cls: string, fn: () => void) => {
      const b = document.createElement('button');
      b.className = `wb-mini-btn ${cls}`;
      b.textContent = label;
      b.onclick = () => {
        this.audio.unlock();
        fn();
      };
      return b;
    };

    actRow.append(
      mkAct('⚔ Удар / Укус [ПКМ]', '', () => this.sim.playerMeleeStrike()),
      mkAct('🔄 Оружие [Q]', '', () => this.sim.playerCycleWeapon()),
      mkAct('✋ Дверь / Лут / Рубить [F]', '', () => this.sim.playerInteract()),
      mkAct('🩹 Бинт / Еда [H]', '', () => this.sim.playerHealSelf()),
      mkAct('🏗 Комната / Мешки [B]', 'wb-mini-accent', () => this.sim.playerBuildAction()),
      mkAct('📻 Зов отряда / Орды [G]', 'wb-mini-squad1', () => this.sim.playerSpecialCall()),
      mkAct('🔁 Другой герой [Tab]', 'wb-mini-play', () => {
        if (this.sim.cycleControlledUnit()) this.enterPossessionZoom();
      }),
      mkAct('👑 Режим Бога [Esc]', '', () => this.sim.releaseControl()),
    );

    this.playerBarEl.append(this.playerStatusEl, actRow);
    root.appendChild(this.playerBarEl);

    // 6. Iconic Bottom WorldBox Shelf, Tabs, Brush Selector & Slow/Fast Speed Bar!
    this.dockEl = document.createElement('div');
    this.dockEl.className = 'wb-dock-wrapper';

    const infoPlaque = document.createElement('div');
    infoPlaque.className = 'wb-info-plaque';
    this.infoTitleEl = document.createElement('span');
    this.infoTitleEl.className = 'wb-info-title';
    this.infoDescEl = document.createElement('span');
    this.infoDescEl.className = 'wb-info-desc';
    infoPlaque.append(this.infoTitleEl, this.infoDescEl);

    const dockTop = document.createElement('div');
    dockTop.className = 'wb-dock-top-bar';

    this.tabsStripEl = document.createElement('div');
    this.tabsStripEl.className = 'wb-tabs-strip';

    const inlineControls = document.createElement('div');
    inlineControls.className = 'wb-dock-controls-inline';

    // WorldBox Brush Size Group
    const brushGroup = document.createElement('div');
    brushGroup.className = 'wb-pill-group';
    const brushLbl = document.createElement('span');
    brushLbl.className = 'wb-group-label';
    brushLbl.textContent = 'Кисть:';
    brushGroup.appendChild(brushLbl);

    BRUSH_SIZES.forEach((bs, idx) => {
      const b = document.createElement('button');
      b.className = `wb-chip-btn${this.sim.brushIndex === idx ? ' active' : ''}`;
      b.textContent = bs.label;
      b.onclick = () => {
        this.sim.brushIndex = idx;
        this.brushBtns.forEach((btn, k) => btn.classList.toggle('active', k === idx));
      };
      this.brushBtns.push(b);
      brushGroup.appendChild(b);
    });

    // WorldBox Speed Group (includes 0.5x Slow-Motion!)
    const speedGroup = document.createElement('div');
    speedGroup.className = 'wb-pill-group';
    const speedLbl = document.createElement('span');
    speedLbl.className = 'wb-group-label';
    speedLbl.textContent = 'Темп:';
    speedGroup.appendChild(speedLbl);

    const speeds = [
      { label: '||', val: 0 },
      { label: '0.5x', val: 0.5 },
      { label: '1x', val: 1 },
      { label: '2x', val: 2 },
      { label: '4x', val: 4 },
    ];
    for (const sp of speeds) {
      const b = document.createElement('button');
      b.className = `wb-chip-btn${sp.val === 1 ? ' active' : ''}`;
      b.textContent = sp.label;
      b.onclick = () => {
        if (sp.val === 0) {
          this.paused = true;
        } else {
          this.paused = false;
          this.simSpeed = sp.val;
        }
        this.syncSpeedHighlight();
      };
      this.speedBtns.push({ el: b, val: sp.val });
      speedGroup.appendChild(b);
    }

    const collapseDock = document.createElement('button');
    collapseDock.className = 'wb-collapse-btn';
    collapseDock.textContent = 'Скрыть [F2]';
    collapseDock.onclick = () => this.toggleBottomDock(true);

    inlineControls.append(brushGroup, speedGroup, collapseDock);
    dockTop.append(this.tabsStripEl, inlineControls);

    const shelf = document.createElement('div');
    shelf.className = 'wb-shelf';
    this.trayEl = document.createElement('div');
    this.trayEl.className = 'wb-tray';
    shelf.appendChild(this.trayEl);

    this.dockEl.append(infoPlaque, dockTop, shelf);
    root.appendChild(this.dockEl);

    this.renderTabs();
    this.renderPowersTray();
    this.updateInfoPlaque();
  }

  public syncSpeedHighlight(): void {
    const activeVal = this.paused ? 0 : this.simSpeed;
    for (const item of this.speedBtns) {
      item.el.classList.toggle('active', item.val === activeVal);
    }
  }

  public toggleTopLeft(hide?: boolean): void {
    const shouldHide = hide ?? !this.topLeftEl.classList.contains('wb-panel-hidden');
    this.topLeftEl.classList.toggle('wb-panel-hidden', shouldHide);
    this.restoreTopBtn.classList.toggle('wb-panel-hidden', !shouldHide);
  }

  public toggleBottomDock(hide?: boolean): void {
    const shouldHide = hide ?? !this.dockEl.classList.contains('wb-panel-hidden');
    this.dockEl.classList.toggle('wb-panel-hidden', shouldHide);
    this.restoreDockBtn.classList.toggle('wb-panel-hidden', !shouldHide);
  }

  public selectTool(toolId: SimToolId): void {
    this.activeTool = toolId;
    this.renderPowersTray();
    this.updateInfoPlaque();
  }

  private updateInfoPlaque(): void {
    const def = SIM_TOOLS.find((t) => t.id === this.activeTool) || SIM_TOOLS[0];
    this.infoTitleEl.textContent = def.name.toUpperCase();
    this.infoTitleEl.style.color = def.accent;
    this.infoDescEl.textContent = def.desc;
  }

  private renderTabs(): void {
    this.tabsStripEl.innerHTML = '';
    for (const tab of TABS) {
      const btn = document.createElement('button');
      btn.className = `wb-tab-btn${this.activeCategory === tab.id ? ' active' : ''}`;
      btn.appendChild(createZomboidPixelIcon(tab.icon, 16));
      const span = document.createElement('span');
      span.textContent = tab.label;
      btn.appendChild(span);
      btn.onclick = () => {
        this.audio.unlock();
        this.audio.playUiClick(520);
        this.activeCategory = tab.id;
        this.renderTabs();
        this.renderPowersTray();
      };
      this.tabsStripEl.appendChild(btn);
    }
  }

  private renderPowersTray(): void {
    this.trayEl.innerHTML = '';
    for (const tool of SIM_TOOLS) {
      if (this.activeCategory !== 'all' && tool.category !== this.activeCategory) continue;

      const btn = document.createElement('button');
      btn.className = `wb-power-btn${this.activeTool === tool.id ? ' selected' : ''}`;
      btn.title = `${tool.name} [${tool.hotkey}] — ${tool.desc}`;

      const hk = document.createElement('span');
      hk.className = 'wb-hotkey';
      hk.textContent = tool.hotkey;

      const icon = createZomboidPixelIcon(tool.id, 26);

      const lbl = document.createElement('span');
      lbl.className = 'wb-power-label';
      lbl.textContent = tool.short;

      btn.append(hk, icon, lbl);
      btn.onclick = () => {
        this.audio.unlock();
        this.audio.playUiClick(540);
        this.touchPanMode = false;
        this.panThumbBtn.classList.remove('pan-active');
        this.selectTool(tool.id);
      };
      this.trayEl.appendChild(btn);
    }
  }

  public updateTelemetry(hoverUnit: UnitInspectionData | null): void {
    this.coordsEl.textContent = `X:${Math.round(this.renderer.camX)} Y:${Math.round(this.renderer.camY)}`;

    const isPlaying = this.sim.controlledUid > 0;
    this.playHeroBtn.textContent = isPlaying ? '👑 Выйти в Режим Бога' : '🎮 Играть за бойца';
    this.playerBarEl.classList.toggle('visible', isPlaying);
    if (isPlaying) {
      this.dockEl.classList.add('wb-panel-hidden');
      this.restoreDockBtn.classList.add('wb-panel-hidden');
    } else if (!this.restoreDockBtn.classList.contains('wb-user-hidden')) {
      this.dockEl.classList.remove('wb-panel-hidden');
    }

    this.statsRowEl.innerHTML = `
      <span>⌚ <b>${this.sim.formattedClock}</b></span>
      <span class="wb-sep">|</span>
      <span style="color:#99e9f2">🚓 Группа №1: <b>${this.sim.squad1Count}</b></span>
      <span class="wb-sep">|</span>
      <span>🧑 Выжившие: <b>${this.sim.livingCount}</b></span>
      <span class="wb-sep">|</span>
      <span style="color:#ff9c92">🧟 Зомби: <b>${this.sim.zombieCount}</b></span>
      <span class="wb-sep">|</span>
      <span>🏗 Пристройки: <b>${this.sim.totalExpansionsBuilt}</b></span>
      <span class="wb-sep">|</span>
      <span>🚗 Разбито авто: <b>${this.sim.carsWreckedCount}</b></span>
    `;

    if (isPlaying && hoverUnit && hoverUnit.isControlled) {
      this.playerStatusEl.innerHTML = hoverUnit.isZombie
        ? `<span style="color:#80ed99"><b>🧟 ВЫ ИГРАЕТЕ ЗА ЗОМБИ: ${hoverUnit.name}</b> (${hoverUnit.roleName})</span>
           <span>❤️ HP: <b>${hoverUnit.hp}/${hoverUnit.maxHp}</b> • ⚡ Силы: <b>${hoverUnit.staminaPct}%</b> • WASD + Shift бег • ЛКМ укус/крушить!</span>`
        : `<span style="color:#ffd466"><b>🎮 ВЫ ИГРАЕТЕ ЗА: ${hoverUnit.name}</b> (${hoverUnit.roleName})</span>
           <span>❤️ HP: <b>${hoverUnit.hp}/${hoverUnit.maxHp}</b> • ⚡ <b>${hoverUnit.staminaPct}%</b> • 🔫 <b>${hoverUnit.weaponName}</b> (патр: <b>${hoverUnit.ammo}</b>) • 🪵 <b>${hoverUnit.wood}</b> • 🩹 <b>${hoverUnit.bandages}</b> • 🥫 <b>${hoverUnit.food}</b></span>`;
    }

    if (!hoverUnit) {
      this.passportEl.classList.remove('visible');
      return;
    }

    this.passportEl.classList.add('visible');
    const hpPct = Math.max(0, Math.min(100, Math.round((hoverUnit.hp / Math.max(1, hoverUnit.maxHp)) * 100)));
    const sqBadge =
      !hoverUnit.isZombie && hoverUnit.squadId > 0
        ? hoverUnit.squadId === 1
          ? '<span style="color:#4cc9f0">[ГРУППА №1]</span> '
          : `<span style="color:#ffd466">[Отряд #${hoverUnit.squadId}]</span> `
        : '';

    this.passportEl.innerHTML = `
      <div class="wb-pass-title">
        <span>${sqBadge}${hoverUnit.name}</span>
        <span>${hoverUnit.hp}/${hoverUnit.maxHp} HP</span>
      </div>
      <div class="wb-pass-line">${hoverUnit.roleName} • <b>${hoverUnit.taskText}</b></div>
      <div class="wb-bar-bg"><div class="wb-bar-fill ${hoverUnit.isZombie ? 'zed' : ''}" style="width:${hpPct}%"></div></div>
      ${
        !hoverUnit.isZombie
          ? `<div class="wb-pass-line">Оружие: <b>${hoverUnit.weaponName}</b> (патр: <b>${hoverUnit.ammo}</b>) • Убито: <b>${hoverUnit.kills}</b></div>
             <div class="wb-pass-line">🪵 Брёвна: <b>${hoverUnit.wood}</b> • Доски: <b>${hoverUnit.planks}</b> • 🥫 Еда: <b>${hoverUnit.food}</b> • 🩹 Бинты: <b>${hoverUnit.bandages}</b></div>
             <div class="wb-pass-line">База: <b>${hoverUnit.safehouseName || 'Кочует по открытому миру'}</b></div>`
          : `<div class="wb-pass-line">Можно вселиться и играть за этого зомби: кусать людей и ломать авто!</div>`
      }
      ${
        hoverUnit.moodles.length > 0
          ? `<div class="wb-moodles-row">${hoverUnit.moodles
              .map((m) => `<span class="wb-moodle-pill" style="border-color:${m.color};color:${m.color}">${m.label}</span>`)
              .join('')}</div>`
          : ''
      }
      <div class="wb-possess-row">
        ${
          hoverUnit.isControlled
            ? `<button class="wb-possess-btn" data-action="cycle">🔁 Другой [Tab]</button>
               <button class="wb-possess-btn wb-exit" data-action="release">👑 Выйти [Esc]</button>`
            : `<button class="wb-possess-btn" data-action="possess" data-uid="${hoverUnit.uid}">🎮 Играть за ${hoverUnit.isZombie ? 'этого зомби' : 'этого бойца'} [E]</button>`
        }
      </div>
    `;
  }
}
