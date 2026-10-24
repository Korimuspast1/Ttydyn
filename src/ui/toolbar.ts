import { SoundEffects } from '../audio/sfx';
import {
  BRUSH_SIZES,
  CursorInspection,
  POWER_ITEMS,
  PowerGroup,
  SavedWorldSummary,
  ToolId,
  ToolbarTab,
  WORLD_H,
  WORLD_W,
} from '../engine/types';
import { WorldState } from '../engine/world';
import {
  isNativeAndroidApk,
  isNativePcApp,
  pcOpenSavesFolder,
  pcQuitNativeApp,
  toggleDesktopFullscreen,
  triggerHaptic,
} from '../platform/mobileBridge';
import { createPixelIconCanvas, PixelIconName } from './pixelIcons';

export interface ToolbarCallbacks {
  onSelectTool: (tool: ToolId) => void;
  onSelectBrushIndex: (index: number) => void;
  onSetTimeScale: (scale: number) => void;
  onSetTouchPanMode: (panMode: boolean) => void;
  onStepZoom: (factor: number) => void;
  onJumpMinimap: (gx: number, gy: number) => void;
  onSetEdgeScroll: (enabled: boolean) => void;
  onTakeScreenshot: () => void;
  onQuickLoad: () => void;
  onSetBatterySaver: (enabled: boolean) => void;
  onGenerateNewRandomWorld: () => void;
  onSaveGame: (name?: string) => void;
  onLoadGame: (slotId: string) => void;
  onDeleteSave: (slotId: string) => void;
  onExportSaveFile: (name?: string) => void;
  onImportSaveFile: (file: File) => void;
  getSavedWorlds: () => SavedWorldSummary[];
  onDrainAllWater: () => void;
  onFloodTsunami: () => void;
  onMeteorShower: () => void;
  onResetZoom: () => void;
  onFocusVillage: () => void;
  onUnpinUnit: () => void;
}

export class WorldBoxUI {
  private activeTab: ToolbarTab = 'all';
  private activeTool: ToolId = 'infantry';
  private brushIndex = 2; // 'M'
  private timeScale = 1;
  private touchPanMode = false;
  private batterySaver = false;
  private mobileMenuOpen = false;

  public topLeftHidden = false;
  public bottomHidden = false;

  public minimapCanvas!: HTMLCanvasElement;
  public geoSliceCanvas!: HTMLCanvasElement;
  private topLeftEl!: HTMLElement;
  private versionTagEl!: HTMLElement;
  private quickBarEl!: HTMLElement;
  private pcNativeSlotEl!: HTMLElement;
  private mobileMenuBtn!: HTMLButtonElement;
  private restoreTopLeftBtn!: HTMLButtonElement;
  private dockWrapperEl!: HTMLElement;
  private restoreBottomBtn!: HTMLButtonElement;
  private thumbDockEl!: HTMLElement;
  private panToggleBtn!: HTMLButtonElement;
  private eventBannerEl!: HTMLElement;
  private eventBannerTimer: number | null = null;

  private tooltipTitleEl!: HTMLElement;
  private tooltipDescEl!: HTMLElement;
  private inspectorStatsEl!: HTMLElement;
  private inspectorPanelEl!: HTMLElement;
  private unitPassportEl!: HTMLElement;
  private fpsBadgeEl!: HTMLElement;
  private popBadgeEl!: HTMLElement;
  private houseBadgeEl!: HTMLElement;
  private warBadgeEl!: HTMLElement;
  private weatherBadgeEl!: HTMLElement;
  private soundBtnSlot!: HTMLElement;
  private savesListEl!: HTMLElement;
  private saveNameInputEl!: HTMLInputElement;
  private ecoButtons: HTMLButtonElement[] = [];

  private tabContainers: Record<ToolbarTab, HTMLElement> = {} as Record<ToolbarTab, HTMLElement>;
  private tabButtons: Record<ToolbarTab, HTMLButtonElement> = {} as Record<ToolbarTab, HTMLButtonElement>;
  private toolButtons: Partial<Record<ToolId, HTMLButtonElement[]>> = {};
  private brushButtons: HTMLButtonElement[] = [];
  private speedButtons: Map<number, HTMLButtonElement> = new Map();

  constructor(
    private root: HTMLElement,
    private world: WorldState,
    private sfx: SoundEffects,
    private callbacks: ToolbarCallbacks,
  ) {
    this.buildDOM();
    this.syncToolHighlight();
    this.syncBrushHighlight();
    this.syncSpeedHighlight();
    this.syncPanModeUI();
    this.switchTab('all', false);
  }

  public markNativePcReady(platform: string): void {
    const label = platform === 'win32' ? 'PC WINDOWS .EXE' : 'PC DESKTOP EDITION';
    if (this.versionTagEl) {
      this.versionTagEl.textContent = `v7.0 ${label}`;
    }
    this.renderPcNativeButtons();
  }

  private renderPcNativeButtons(): void {
    if (!this.pcNativeSlotEl) return;
    this.pcNativeSlotEl.innerHTML = '';

    if (isNativePcApp()) {
      const folderBtn = document.createElement('button');
      folderBtn.className = 'wb-mini-btn wb-mini-apk';
      folderBtn.textContent = '📂 ПАПКА МИРОВ';
      folderBtn.title = 'Открыть системную папку сохранений на компьютере';
      folderBtn.addEventListener('click', () => {
        this.sfx.playUiClick(680);
        void pcOpenSavesFolder();
      });

      const quitBtn = document.createElement('button');
      quitBtn.className = 'wb-mini-btn wb-mini-danger';
      quitBtn.textContent = '⏻ ВЫХОД';
      quitBtn.title = 'Закрыть игру и вернуться на рабочий стол';
      quitBtn.addEventListener('click', () => {
        this.sfx.playUiClick(360);
        void pcQuitNativeApp();
      });

      this.pcNativeSlotEl.appendChild(folderBtn);
      this.pcNativeSlotEl.appendChild(quitBtn);
    } else if (!isNativeAndroidApk()) {
      const exeLink = document.createElement('a');
      exeLink.href = './WorldBox-Sandbox.exe';
      exeLink.download = 'WorldBox-Sandbox.exe';
      exeLink.className = 'wb-mini-btn wb-mini-exe';
      exeLink.textContent = '🖥 СКАЧАТЬ .EXE (ПК)';
      exeLink.title = 'Скачать автономный порт для Windows 10/11 (WorldBox-Sandbox.exe)';
      exeLink.addEventListener('click', () => {
        triggerHaptic('tool');
        this.sfx.playUiClick(740);
      });

      const apkLink = document.createElement('a');
      apkLink.href = './WorldBox-Sandbox.apk';
      apkLink.download = 'WorldBox-Sandbox.apk';
      apkLink.className = 'wb-mini-btn wb-mini-apk';
      apkLink.textContent = '📱 APK';
      apkLink.title = 'Скачать Android-версию (WorldBox-Sandbox.apk)';
      apkLink.addEventListener('click', () => {
        triggerHaptic('tool');
        this.sfx.playUiClick(720);
      });

      this.pcNativeSlotEl.appendChild(exeLink);
      this.pcNativeSlotEl.appendChild(apkLink);
    }
  }

  public showEventToast(message: string, color = '#ffd466'): void {
    if (!this.eventBannerEl) return;
    this.eventBannerEl.textContent = message;
    this.eventBannerEl.style.borderColor = color;
    this.eventBannerEl.style.color = '#fff7e6';
    this.eventBannerEl.classList.add('visible');
    if (this.eventBannerTimer !== null) {
      window.clearTimeout(this.eventBannerTimer);
    }
    this.eventBannerTimer = window.setTimeout(() => {
      this.eventBannerEl.classList.remove('visible');
    }, 3400);
  }

  public setTopLeftHidden(hidden: boolean): void {
    this.topLeftHidden = hidden;
    this.topLeftEl.classList.toggle('wb-panel-hidden', hidden);
    this.restoreTopLeftBtn.classList.toggle('wb-panel-hidden', !hidden);
  }

  public setBottomHidden(hidden: boolean): void {
    this.bottomHidden = hidden;
    this.dockWrapperEl.classList.toggle('wb-panel-hidden', hidden);
    this.restoreBottomBtn.classList.toggle('wb-panel-hidden', !hidden);
  }

  public toggleAllPanels(): void {
    const targetHide = !(this.topLeftHidden && this.bottomHidden);
    this.setTopLeftHidden(targetHide);
    this.setBottomHidden(targetHide);
  }

  public closeTransientPopups(): boolean {
    if (this.mobileMenuOpen) {
      this.setMobileMenuOpen(false);
      return true;
    }
    if (!this.unitPassportEl.classList.contains('wb-panel-hidden')) {
      this.callbacks.onUnpinUnit();
      this.unitPassportEl.classList.add('wb-panel-hidden');
      return true;
    }
    if (this.activeTab !== 'all') {
      this.switchTab('all', true);
      return true;
    }
    return false;
  }

  public setTouchPanMode(panMode: boolean, playFeedback = true): void {
    this.touchPanMode = panMode;
    this.syncPanModeUI();
    if (playFeedback) {
      triggerHaptic('tap');
      this.sfx.playUiClick(panMode ? 560 : 690);
      this.showEventToast(
        panMode
          ? '🖐 Режим камеры: 1 палец двигает карту и открывает паспорт жителя'
          : '🖌 Режим кисти: 1 палец творит, 2 пальца двигают и приближают',
        panMode ? '#74c0fc' : '#ffd466',
      );
    }
    this.callbacks.onSetTouchPanMode(panMode);
  }

  private syncPanModeUI(): void {
    if (!this.panToggleBtn) return;
    this.panToggleBtn.classList.toggle('pan-active', this.touchPanMode);
    this.panToggleBtn.innerHTML = this.touchPanMode
      ? '<span class="wb-thumb-glyph">🖐</span><small>КАМЕРА</small>'
      : '<span class="wb-thumb-glyph">🖌</span><small>КИСТЬ</small>';
    this.panToggleBtn.title = this.touchPanMode
      ? 'Сейчас: 1 палец двигает камеру и осматривает существ (нажми для рисования)'
      : 'Сейчас: 1 палец применяет силу Бога (нажми для режима камеры)';
  }

  private setMobileMenuOpen(open: boolean): void {
    this.mobileMenuOpen = open;
    this.quickBarEl.classList.toggle('wb-mobile-open', open);
    this.mobileMenuBtn.classList.toggle('active', open);
    this.mobileMenuBtn.textContent = open ? '✕ МЕНЮ' : '⚙ МЕНЮ';
  }

  public setBatterySaver(enabled: boolean): void {
    this.batterySaver = enabled;
    for (const b of this.ecoButtons) {
      b.classList.toggle('active', enabled);
      b.textContent = enabled ? '🔋 ЭКОНОМ: ВКЛ' : '⚡ FPS: МАКС';
    }
    this.callbacks.onSetBatterySaver(enabled);
  }

  public refreshSavesList(): void {
    if (!this.savesListEl) return;
    this.savesListEl.innerHTML = '';
    const saves = this.callbacks.getSavedWorlds();

    if (saves.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'wb-saves-empty';
      empty.textContent = 'Нет сохранений — нажмите «💾 Сохранить» (или F5 на ПК)!';
      this.savesListEl.appendChild(empty);
      return;
    }

    for (const s of saves) {
      const card = document.createElement('div');
      card.className = 'wb-save-card';

      if (s.thumbnailDataUrl) {
        const img = document.createElement('img');
        img.src = s.thumbnailDataUrl;
        img.alt = s.name;
        img.className = 'wb-save-thumb';
        card.appendChild(img);
      }

      const meta = document.createElement('div');
      meta.className = 'wb-save-meta';
      meta.innerHTML = `
        <div class="wb-save-name">${this.escapeHtml(s.name)}</div>
        <div class="wb-save-sub">Бойцы: <b>${s.population}</b> • Объекты: <b>${s.houses}</b> • ${s.savedAt}</div>
      `;
      card.appendChild(meta);

      const actions = document.createElement('div');
      actions.className = 'wb-save-actions';

      const loadBtn = document.createElement('button');
      loadBtn.className = 'wb-mini-btn wb-mini-accent';
      loadBtn.textContent = '▶ ИГРАТЬ';
      loadBtn.title = 'Загрузить этот сохранённый мир';
      loadBtn.addEventListener('click', () => {
        triggerHaptic('tool');
        this.sfx.playUiClick(680);
        this.callbacks.onLoadGame(s.id);
      });

      const delBtn = document.createElement('button');
      delBtn.className = 'wb-mini-btn wb-mini-danger';
      delBtn.textContent = '✕';
      delBtn.title = 'Удалить сохранение';
      delBtn.addEventListener('click', () => {
        triggerHaptic('tap');
        this.sfx.playUiClick(340);
        this.callbacks.onDeleteSave(s.id);
        this.refreshSavesList();
      });

      actions.appendChild(loadBtn);
      actions.appendChild(delBtn);
      card.appendChild(actions);

      this.savesListEl.appendChild(card);
    }
  }

  private escapeHtml(str: string): string {
    return str.replace(/[&<>"']/g, (c) =>
      c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
    );
  }

  private buildDOM(): void {
    // 0. Live War & World Event Herald Toast Banner (Top Center)
    this.eventBannerEl = document.createElement('div');
    this.eventBannerEl.className = 'wb-panel wb-event-banner';
    this.root.appendChild(this.eventBannerEl);

    // 1. Top-Left WorldBox HUD Plaque
    const topLeft = document.createElement('div');
    topLeft.className = 'wb-panel wb-top-left';
    topLeft.innerHTML = `
      <div class="wb-brand-row">
        <span class="wb-crown-dot"></span>
        <span class="wb-game-title">ВОЕННЫЙ СИМУЛЯТОР</span>
        <span id="wb-version-tag" class="wb-version-tag">${isNativePcApp() ? 'v7.0 MILITARY PC DESKTOP' : 'v7.0 MILITARY PC + MOBILE'}</span>
        <button id="wb-hide-top-left" class="wb-collapse-btn" title="Скрыть верхнюю панель (H)">▲</button>
      </div>
      <div class="wb-stats-row">
        <span id="wb-fps" class="wb-fps-pill">60 FPS</span>
        <span class="wb-sep wb-desktop-only">|</span>
        <span class="wb-pop-pill">👥 <span class="wb-stat-word">Бойцы: </span><b id="wb-pop">0</b></span>
        <span class="wb-sep">•</span>
        <span>🏠 <span class="wb-stat-word">Объекты: </span><b id="wb-houses">0</b></span>
        <span class="wb-sep">•</span>
        <span class="wb-war-pill">⚔ <span class="wb-stat-word">Конфликты: </span><b id="wb-wars">0</b></span>
        <span class="wb-sep">•</span>
        <span id="wb-weather" class="wb-weather-pill">☀ Ясно</span>
        <button id="wb-mobile-menu-toggle" class="wb-collapse-btn wb-mobile-menu-btn">⚙ МЕНЮ</button>
        <button id="wb-mobile-hide-top" class="wb-collapse-btn wb-mobile-only-inline" title="Скрыть HUD">▲</button>
      </div>
      <div class="wb-hints-row">
        ЛКМ: операция &bull; ПКМ/WASD+Shift: камера &bull; Колесо: зум &bull; Ctrl+Колесо: радиус &bull; F5/F9: сохр. &bull; F11: экран &bull; F12: скриншот &bull; N: новый театр
      </div>
    `;
    this.topLeftEl = topLeft;
    this.versionTagEl = topLeft.querySelector('#wb-version-tag')!;
    this.root.appendChild(topLeft);

    this.restoreTopLeftBtn = document.createElement('button');
    this.restoreTopLeftBtn.className = 'wb-panel wb-restore-pill wb-restore-top-left wb-panel-hidden';
    this.restoreTopLeftBtn.textContent = '▼ HUD';
    this.restoreTopLeftBtn.title = 'Показать верхнюю панель';
    this.restoreTopLeftBtn.addEventListener('click', () => {
      triggerHaptic('tap');
      this.sfx.playUiClick(620);
      this.setTopLeftHidden(false);
    });
    this.root.appendChild(this.restoreTopLeftBtn);

    const onHideTop = () => {
      triggerHaptic('tap');
      this.sfx.playUiClick(460);
      this.setTopLeftHidden(true);
    };
    topLeft.querySelector('#wb-hide-top-left')!.addEventListener('click', onHideTop);
    topLeft.querySelector('#wb-mobile-hide-top')!.addEventListener('click', onHideTop);

    this.mobileMenuBtn = topLeft.querySelector('#wb-mobile-menu-toggle') as HTMLButtonElement;
    this.mobileMenuBtn.addEventListener('click', () => {
      triggerHaptic('tap');
      this.sfx.playUiClick(580);
      this.setMobileMenuOpen(!this.mobileMenuOpen);
    });

    this.fpsBadgeEl = topLeft.querySelector('#wb-fps')!;
    this.popBadgeEl = topLeft.querySelector('#wb-pop')!;
    this.houseBadgeEl = topLeft.querySelector('#wb-houses')!;
    this.warBadgeEl = topLeft.querySelector('#wb-wars')!;
    this.weatherBadgeEl = topLeft.querySelector('#wb-weather')!;

    const quickBar = document.createElement('div');
    quickBar.className = 'wb-quick-buttons';
    this.quickBarEl = quickBar;

    const soundBtn = document.createElement('button');
    soundBtn.className = 'wb-mini-btn';
    soundBtn.title = 'Звук вкл/выкл (M)';
    this.soundBtnSlot = document.createElement('span');
    this.soundBtnSlot.appendChild(createPixelIconCanvas('soundOn', 1));
    soundBtn.appendChild(this.soundBtnSlot);
    soundBtn.addEventListener('click', () => {
      triggerHaptic('tap');
      this.toggleMute();
    });

    const zoomTownBtn = document.createElement('button');
    zoomTownBtn.className = 'wb-mini-btn wb-mini-text-btn wb-mini-accent';
    zoomTownBtn.textContent = '🏘 В ДЕРЕВНЮ';
    zoomTownBtn.title = 'Приблизить камеру к королевству (Z)';
    zoomTownBtn.addEventListener('click', () => {
      triggerHaptic('tap');
      this.sfx.playUiClick(660);
      this.callbacks.onFocusVillage();
      this.setMobileMenuOpen(false);
    });

    const fitBtn = document.createElement('button');
    fitBtn.className = 'wb-mini-btn wb-mini-text-btn';
    fitBtn.textContent = '🗺 ВЕСЬ МИР';
    fitBtn.title = 'Показать весь случайный архипелаг';
    fitBtn.addEventListener('click', () => {
      triggerHaptic('tap');
      this.sfx.playUiClick(580);
      this.callbacks.onResetZoom();
      this.setMobileMenuOpen(false);
    });

    const newWorldBtn = document.createElement('button');
    newWorldBtn.className = 'wb-mini-btn wb-mini-text-btn';
    newWorldBtn.textContent = '🎲 НОВЫЙ МИР';
    newWorldBtn.title = 'Сгенерировать полностью новый случайный мир (R)';
    newWorldBtn.addEventListener('click', () => {
      triggerHaptic('heavy');
      this.sfx.playUiClick(640);
      this.callbacks.onGenerateNewRandomWorld();
      this.setMobileMenuOpen(false);
    });

    const quickSaveBtn = document.createElement('button');
    quickSaveBtn.className = 'wb-mini-btn wb-mini-text-btn wb-mini-save';
    quickSaveBtn.textContent = '💾 СОХР. [F5]';
    quickSaveBtn.title = 'Быстро сохранить текущую игру (F5)';
    quickSaveBtn.addEventListener('click', () => {
      triggerHaptic('tool');
      this.sfx.playUiClick(700);
      this.callbacks.onSaveGame();
      this.refreshSavesList();
      this.setMobileMenuOpen(false);
    });

    const quickLoadBtn = document.createElement('button');
    quickLoadBtn.className = 'wb-mini-btn wb-mini-text-btn wb-desktop-only';
    quickLoadBtn.textContent = '📂 ЗАГР. [F9]';
    quickLoadBtn.title = 'Быстро загрузить последнее сохранение (F9)';
    quickLoadBtn.addEventListener('click', () => {
      this.sfx.playUiClick(650);
      this.callbacks.onQuickLoad();
    });

    const fullscreenBtn = document.createElement('button');
    fullscreenBtn.className = 'wb-mini-btn wb-mini-text-btn wb-desktop-only';
    fullscreenBtn.textContent = '⛶ ЭКРАН [F11]';
    fullscreenBtn.title = 'Полноэкранный режим на ПК (F11)';
    fullscreenBtn.addEventListener('click', () => {
      this.sfx.playUiClick(640);
      toggleDesktopFullscreen();
    });

    const shotBtn = document.createElement('button');
    shotBtn.className = 'wb-mini-btn wb-mini-text-btn wb-desktop-only';
    shotBtn.textContent = '📸 СКРИН [F12]';
    shotBtn.title = 'Сделать чёткий пиксельный скриншот мира (F12)';
    shotBtn.addEventListener('click', () => {
      this.sfx.playUiClick(720);
      this.callbacks.onTakeScreenshot();
    });

    const bordersBtn = document.createElement('button');
    bordersBtn.className = 'wb-mini-btn wb-mini-text-btn';
    bordersBtn.textContent = 'ГРАНИЦЫ: ВКЛ';
    bordersBtn.title = 'Показать/скрыть границы королевств (B)';
    bordersBtn.addEventListener('click', () => {
      triggerHaptic('tap');
      this.sfx.playUiClick(540);
      this.world.settings.showBorders = !this.world.settings.showBorders;
      bordersBtn.textContent = this.world.settings.showBorders ? 'ГРАНИЦЫ: ВКЛ' : 'ГРАНИЦЫ: ВЫКЛ';
    });

    const quickEcoBtn = document.createElement('button');
    quickEcoBtn.className = 'wb-mini-btn wb-mini-text-btn wb-mobile-only-inline';
    quickEcoBtn.textContent = '⚡ FPS: МАКС';
    quickEcoBtn.title = 'Режим экономии заряда батареи на телефоне';
    quickEcoBtn.addEventListener('click', () => {
      triggerHaptic('tap');
      this.sfx.playUiClick(600);
      this.setBatterySaver(!this.batterySaver);
    });
    this.ecoButtons.push(quickEcoBtn);

    this.pcNativeSlotEl = document.createElement('span');
    this.pcNativeSlotEl.className = 'wb-native-slot';

    quickBar.appendChild(soundBtn);
    quickBar.appendChild(zoomTownBtn);
    quickBar.appendChild(fitBtn);
    quickBar.appendChild(newWorldBtn);
    quickBar.appendChild(quickSaveBtn);
    quickBar.appendChild(quickLoadBtn);
    quickBar.appendChild(fullscreenBtn);
    quickBar.appendChild(shotBtn);
    quickBar.appendChild(bordersBtn);
    quickBar.appendChild(quickEcoBtn);
    quickBar.appendChild(this.pcNativeSlotEl);

    this.renderPcNativeButtons();
    topLeft.appendChild(quickBar);

    // 1B. Ergonomic Right-Edge Thumb Controls Dock (Touch / Mobile devices)
    const thumbDock = document.createElement('div');
    thumbDock.className = 'wb-panel wb-thumb-dock';

    this.panToggleBtn = document.createElement('button');
    this.panToggleBtn.className = 'wb-thumb-btn wb-thumb-mode-btn';
    this.panToggleBtn.addEventListener('click', () => {
      this.setTouchPanMode(!this.touchPanMode, true);
    });

    const zoomInBtn = document.createElement('button');
    zoomInBtn.className = 'wb-thumb-btn';
    zoomInBtn.innerHTML = '<span>＋</span>';
    zoomInBtn.title = 'Приблизить карту';
    zoomInBtn.addEventListener('click', () => {
      triggerHaptic('tap');
      this.sfx.playUiClick(660);
      this.callbacks.onStepZoom(1.3);
    });

    const zoomOutBtn = document.createElement('button');
    zoomOutBtn.className = 'wb-thumb-btn';
    zoomOutBtn.innerHTML = '<span>－</span>';
    zoomOutBtn.title = 'Отдалить карту';
    zoomOutBtn.addEventListener('click', () => {
      triggerHaptic('tap');
      this.sfx.playUiClick(520);
      this.callbacks.onStepZoom(1 / 1.3);
    });

    const quickInspectBtn = document.createElement('button');
    quickInspectBtn.className = 'wb-thumb-btn';
    quickInspectBtn.innerHTML = '<span>🔍</span>';
    quickInspectBtn.title = 'Осмотр паспорта и черт существа';
    quickInspectBtn.addEventListener('click', () => {
      triggerHaptic('tool');
      this.setTouchPanMode(false, false);
      this.selectTool('inspect', true);
      this.showEventToast('🔍 Нажми на любого человека, зомби или зверя для осмотра!', '#74c0fc');
    });

    const quickTownThumbBtn = document.createElement('button');
    quickTownThumbBtn.className = 'wb-thumb-btn';
    quickTownThumbBtn.innerHTML = '<span>🏘</span>';
    quickTownThumbBtn.title = 'Перейти к следующему королевству';
    quickTownThumbBtn.addEventListener('click', () => {
      triggerHaptic('tap');
      this.sfx.playUiClick(660);
      this.callbacks.onFocusVillage();
    });

    thumbDock.appendChild(this.panToggleBtn);
    thumbDock.appendChild(zoomInBtn);
    thumbDock.appendChild(zoomOutBtn);
    thumbDock.appendChild(quickInspectBtn);
    thumbDock.appendChild(quickTownThumbBtn);
    this.thumbDockEl = thumbDock;
    this.root.appendChild(thumbDock);

    // 2. Top-Right PC Interactive Minimap Radar + Live Geo-Slice & Cursor Tile Inspector
    const topRight = document.createElement('div');
    topRight.className = 'wb-panel wb-top-right';

    const mapHeader = document.createElement('div');
    mapHeader.className = 'wb-slice-header';
    mapHeader.textContent = 'МИНИ-КАРТА МИРА';

    this.minimapCanvas = document.createElement('canvas');
    this.minimapCanvas.width = 160;
    this.minimapCanvas.height = 100;
    this.minimapCanvas.className = 'wb-minimap-canvas';
    this.minimapCanvas.title = 'Кликните или зажмите ЛКМ для быстрого перемещения камеры по миру';

    let draggingMinimap = false;
    const jumpFromMinimapEvent = (ev: PointerEvent) => {
      const rect = this.minimapCanvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const nx = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
      const ny = Math.max(0, Math.min(1, (ev.clientY - rect.top) / rect.height));
      this.callbacks.onJumpMinimap(nx * WORLD_W, ny * WORLD_H);
    };
    this.minimapCanvas.addEventListener('pointerdown', (ev) => {
      draggingMinimap = true;
      try {
        this.minimapCanvas.setPointerCapture(ev.pointerId);
      } catch {
        // Ignore
      }
      this.sfx.playUiClick(620);
      jumpFromMinimapEvent(ev);
    });
    this.minimapCanvas.addEventListener('pointermove', (ev) => {
      if (draggingMinimap) jumpFromMinimapEvent(ev);
    });
    const endMiniDrag = () => {
      draggingMinimap = false;
    };
    this.minimapCanvas.addEventListener('pointerup', endMiniDrag);
    this.minimapCanvas.addEventListener('pointercancel', endMiniDrag);

    const sliceHeader = document.createElement('div');
    sliceHeader.className = 'wb-slice-header wb-slice-subhdr';
    sliceHeader.textContent = 'РАЗРЕЗ ПОРОД';

    this.geoSliceCanvas = document.createElement('canvas');
    this.geoSliceCanvas.width = 119;
    this.geoSliceCanvas.height = 64;
    this.geoSliceCanvas.className = 'wb-slice-canvas';

    this.inspectorStatsEl = document.createElement('div');
    this.inspectorStatsEl.className = 'wb-inspector-stats';
    this.inspectorStatsEl.innerHTML = 'Наведи курсор на мир';

    topRight.appendChild(mapHeader);
    topRight.appendChild(this.minimapCanvas);
    topRight.appendChild(sliceHeader);
    topRight.appendChild(this.geoSliceCanvas);
    topRight.appendChild(this.inspectorStatsEl);
    this.inspectorPanelEl = topRight;
    this.root.appendChild(topRight);

    // 2B. Floating Individual Unit Passport Card
    this.unitPassportEl = document.createElement('div');
    this.unitPassportEl.className = 'wb-panel wb-unit-passport wb-panel-hidden';
    this.root.appendChild(this.unitPassportEl);

    // 3. Bottom WorldBox Power Dock
    const dockWrapper = document.createElement('div');
    dockWrapper.className = 'wb-dock-wrapper';
    this.dockWrapperEl = dockWrapper;

    this.restoreBottomBtn = document.createElement('button');
    this.restoreBottomBtn.className = 'wb-panel wb-restore-pill wb-restore-bottom wb-panel-hidden';
    this.restoreBottomBtn.textContent = `▲ ПАНЕЛЬ ОПЕРАЦИЙ (${POWER_ITEMS.length})`;
    this.restoreBottomBtn.title = 'Показать нижнюю панель инструментов';
    this.restoreBottomBtn.addEventListener('click', () => {
      triggerHaptic('tap');
      this.sfx.playUiClick(620);
      this.setBottomHidden(false);
    });
    this.root.appendChild(this.restoreBottomBtn);

    const infoPlaque = document.createElement('div');
    infoPlaque.className = 'wb-info-plaque';
    this.tooltipTitleEl = document.createElement('span');
    this.tooltipTitleEl.className = 'wb-info-title';
    this.tooltipDescEl = document.createElement('span');
    this.tooltipDescEl.className = 'wb-info-desc';
    infoPlaque.appendChild(this.tooltipTitleEl);
    infoPlaque.appendChild(this.tooltipDescEl);
    dockWrapper.appendChild(infoPlaque);

    const controlsBar = document.createElement('div');
    controlsBar.className = 'wb-dock-top-bar';

    const tabsRow = document.createElement('div');
    tabsRow.className = 'wb-tabs-strip';

    const tabSpecs: { id: ToolbarTab; label: string; shortLabel: string; icon: PixelIconName }[] = [
      { id: 'all', label: `Все операции (${POWER_ITEMS.length})`, shortLabel: `Все (${POWER_ITEMS.length})`, icon: 'powers' },
      { id: 'defense', label: 'База и Оборона', shortLabel: 'Оборона', icon: 'bunker' },
      { id: 'offense', label: 'Войска и Техника', shortLabel: 'Войска', icon: 'infantry' },
      { id: 'drones', label: 'Дроны и Авиация', shortLabel: 'Дроны', icon: 'fpv_drone' },
      { id: 'missiles', label: 'Ракеты и Артиллерия', shortLabel: 'Ракеты', icon: 'ballistic' },
      { id: 'saves', label: 'Театр и Сохранения', shortLabel: 'Миры', icon: 'save' },
      { id: 'physics', label: 'Настройки и ПК', shortLabel: 'Настройки', icon: 'physics' },
    ];

    for (const t of tabSpecs) {
      const btn = document.createElement('button');
      btn.className = 'wb-tab-btn';
      btn.appendChild(createPixelIconCanvas(t.icon, 1));
      const lblFull = document.createElement('span');
      lblFull.className = 'wb-tab-lbl-full';
      lblFull.textContent = t.label;
      const lblShort = document.createElement('span');
      lblShort.className = 'wb-tab-lbl-short';
      lblShort.textContent = t.shortLabel;
      btn.appendChild(lblFull);
      btn.appendChild(lblShort);
      btn.addEventListener('click', () => {
        triggerHaptic('tap');
        this.switchTab(t.id, true);
        if (t.id === 'saves') this.refreshSavesList();
      });
      this.tabButtons[t.id] = btn;
      tabsRow.appendChild(btn);
    }

    const rightControls = document.createElement('div');
    rightControls.className = 'wb-dock-controls-inline';

    const brushGroup = document.createElement('div');
    brushGroup.className = 'wb-pill-group';
    const brushTitle = document.createElement('span');
    brushTitle.className = 'wb-group-label';
    brushTitle.textContent = 'КИСТЬ:';
    brushGroup.appendChild(brushTitle);

    BRUSH_SIZES.forEach((b, idx) => {
      const btn = document.createElement('button');
      btn.className = 'wb-chip-btn';
      btn.textContent = b.label;
      btn.title = `Размер кисти: ${b.label} ([ / ] или Ctrl+Колесо мыши)`;
      btn.addEventListener('click', () => {
        triggerHaptic('tap');
        this.setBrushIndex(idx, true);
      });
      this.brushButtons.push(btn);
      brushGroup.appendChild(btn);
    });

    const speedGroup = document.createElement('div');
    speedGroup.className = 'wb-pill-group';
    const speedTitle = document.createElement('span');
    speedTitle.className = 'wb-group-label';
    speedTitle.textContent = 'ВРЕМЯ:';
    speedGroup.appendChild(speedTitle);

    for (const s of [
      { val: 0, text: '||' },
      { val: 1, text: '1x' },
      { val: 2, text: '2x' },
      { val: 5, text: '5x' },
      { val: 10, text: '10x', pcExtra: true },
    ]) {
      const btn = document.createElement('button');
      btn.className = 'wb-chip-btn' + (s.pcExtra ? ' wb-desktop-only' : '');
      btn.textContent = s.text;
      btn.addEventListener('click', () => {
        triggerHaptic('tap');
        this.setTimeScale(s.val, true);
      });
      this.speedButtons.set(s.val, btn);
      speedGroup.appendChild(btn);
    }

    const hideBottomBtn = document.createElement('button');
    hideBottomBtn.className = 'wb-collapse-btn';
    hideBottomBtn.textContent = '▼';
    hideBottomBtn.title = 'Скрыть нижнюю панель инструментов (H)';
    hideBottomBtn.addEventListener('click', () => {
      triggerHaptic('tap');
      this.sfx.playUiClick(460);
      this.setBottomHidden(true);
    });

    rightControls.appendChild(brushGroup);
    rightControls.appendChild(speedGroup);
    rightControls.appendChild(hideBottomBtn);

    controlsBar.appendChild(tabsRow);
    controlsBar.appendChild(rightControls);
    dockWrapper.appendChild(controlsBar);

    const shelf = document.createElement('div');
    shelf.className = 'wb-shelf';

    // TAB 1: ВСЕ БОЕВЫЕ ОПЕРАЦИИ
    const allTray = document.createElement('div');
    allTray.className = 'wb-tray wb-powers-grid wb-all-powers-tray';
    const groupsOrder: PowerGroup[] = ['engineer', 'defense', 'infantry', 'command', 'drones', 'artillery'];
    groupsOrder.forEach((grp, gIdx) => {
      const grpItems = POWER_ITEMS.filter((p) => p.group === grp);
      for (const item of grpItems) {
        allTray.appendChild(this.createPowerButton(item.id, item.name, item.hotkey, item.accentColor, true));
      }
      if (gIdx < groupsOrder.length - 1) {
        const div = document.createElement('div');
        div.className = 'wb-tray-divider';
        allTray.appendChild(div);
      }
    });
    this.tabContainers.all = allTray;
    shelf.appendChild(allTray);

    // TAB 2: ИНЖЕНЕРИЯ, БАЗА И ОБОРОНА
    const defenseTray = document.createElement('div');
    defenseTray.className = 'wb-tray wb-powers-grid';
    for (const item of POWER_ITEMS.filter((p) => p.group === 'engineer' || p.group === 'defense')) {
      defenseTray.appendChild(this.createPowerButton(item.id, item.name, item.hotkey, item.accentColor, false));
    }
    this.tabContainers.defense = defenseTray;
    shelf.appendChild(defenseTray);

    // TAB 3: ПЕХОТА, ТЕХНИКА И КОМАНДОВАНИЕ
    const offenseTray = document.createElement('div');
    offenseTray.className = 'wb-tray wb-powers-grid';
    for (const item of POWER_ITEMS.filter((p) => p.group === 'infantry' || p.group === 'command')) {
      offenseTray.appendChild(this.createPowerButton(item.id, item.name, item.hotkey, item.accentColor, false));
    }
    this.tabContainers.offense = offenseTray;
    shelf.appendChild(offenseTray);

    // TAB 4: ДРОНЫ И АВИАЦИЯ
    const dronesTray = document.createElement('div');
    dronesTray.className = 'wb-tray wb-powers-grid';
    for (const item of POWER_ITEMS.filter((p) => p.group === 'drones')) {
      dronesTray.appendChild(this.createPowerButton(item.id, item.name, item.hotkey, item.accentColor, false));
    }
    this.tabContainers.drones = dronesTray;
    shelf.appendChild(dronesTray);

    // TAB 5: АРТИЛЛЕРИЯ И РАКЕТЫ
    const missilesTray = document.createElement('div');
    missilesTray.className = 'wb-tray wb-powers-grid';
    for (const item of POWER_ITEMS.filter((p) => p.group === 'artillery')) {
      missilesTray.appendChild(this.createPowerButton(item.id, item.name, item.hotkey, item.accentColor, false));
    }
    this.tabContainers.missiles = missilesTray;
    shelf.appendChild(missilesTray);

    // TAB 5: RANDOM WORLD GENERATOR + MULTI-SLOT WORLD SAVES & FILE BACKUP
    const savesTray = document.createElement('div');
    savesTray.className = 'wb-tray wb-saves-tray';

    const saveControlsRow = document.createElement('div');
    saveControlsRow.className = 'wb-save-controls-col';

    const newRandomBtn = document.createElement('button');
    newRandomBtn.className = 'wb-action-card wb-action-highlight';
    newRandomBtn.innerHTML = '<span>🎲 НОВЫЙ СЛУЧАЙНЫЙ МИР</span><small>100% рандом [R]</small>';
    newRandomBtn.addEventListener('click', () => {
      triggerHaptic('heavy');
      this.sfx.playUiClick(660);
      this.callbacks.onGenerateNewRandomWorld();
    });

    const saveFormRow = document.createElement('div');
    saveFormRow.className = 'wb-save-form-row';

    this.saveNameInputEl = document.createElement('input');
    this.saveNameInputEl.type = 'text';
    this.saveNameInputEl.maxLength = 28;
    this.saveNameInputEl.placeholder = 'Название мира...';
    this.saveNameInputEl.className = 'wb-save-input';
    this.saveNameInputEl.addEventListener('keydown', (ev) => ev.stopPropagation());

    const doSaveBtn = document.createElement('button');
    doSaveBtn.className = 'wb-mini-btn wb-mini-save';
    doSaveBtn.textContent = '💾 СОХРАНИТЬ';
    doSaveBtn.addEventListener('click', () => {
      triggerHaptic('tool');
      this.sfx.playUiClick(720);
      this.callbacks.onSaveGame(this.saveNameInputEl.value);
      this.saveNameInputEl.value = '';
      this.refreshSavesList();
    });

    const exportBtn = document.createElement('button');
    exportBtn.className = 'wb-mini-btn';
    exportBtn.textContent = '⬇ В ФАЙЛ';
    exportBtn.title = 'Экспортировать / поделиться файлом мира (.json)';
    exportBtn.addEventListener('click', () => {
      triggerHaptic('tool');
      this.sfx.playUiClick(640);
      this.callbacks.onExportSaveFile(this.saveNameInputEl.value);
    });

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json,application/json';
    fileInput.style.display = 'none';
    fileInput.addEventListener('change', () => {
      const f = fileInput.files?.[0];
      if (f) {
        this.callbacks.onImportSaveFile(f);
        fileInput.value = '';
      }
    });

    const importBtn = document.createElement('button');
    importBtn.className = 'wb-mini-btn';
    importBtn.textContent = '📂 ИЗ ФАЙЛА';
    importBtn.title = 'Загрузить сохранённый мир из .json файла';
    importBtn.addEventListener('click', () => {
      triggerHaptic('tap');
      this.sfx.playUiClick(600);
      fileInput.click();
    });

    saveFormRow.appendChild(this.saveNameInputEl);
    saveFormRow.appendChild(doSaveBtn);
    saveFormRow.appendChild(exportBtn);
    saveFormRow.appendChild(importBtn);
    saveFormRow.appendChild(fileInput);

    const cataclysmRow = document.createElement('div');
    cataclysmRow.className = 'wb-save-form-row';
    const tsunamiBtn = document.createElement('button');
    tsunamiBtn.className = 'wb-mini-btn';
    tsunamiBtn.textContent = '🌊 ЦУНАМИ';
    tsunamiBtn.addEventListener('click', () => {
      triggerHaptic('heavy');
      this.sfx.playWaterDrop();
      this.callbacks.onFloodTsunami();
    });
    const meteorRainBtn = document.createElement('button');
    meteorRainBtn.className = 'wb-mini-btn';
    meteorRainBtn.textContent = '☄ ЗВЕЗДОПАД';
    meteorRainBtn.addEventListener('click', () => {
      triggerHaptic('heavy');
      this.sfx.playExplosion(1.0);
      this.callbacks.onMeteorShower();
    });
    const drainBtn = document.createElement('button');
    drainBtn.className = 'wb-mini-btn';
    drainBtn.textContent = '☀ ОСУШИТЬ';
    drainBtn.addEventListener('click', () => {
      triggerHaptic('tool');
      this.sfx.playUiClick(480);
      this.callbacks.onDrainAllWater();
    });
    cataclysmRow.appendChild(tsunamiBtn);
    cataclysmRow.appendChild(meteorRainBtn);
    cataclysmRow.appendChild(drainBtn);

    saveControlsRow.appendChild(newRandomBtn);
    saveControlsRow.appendChild(saveFormRow);
    saveControlsRow.appendChild(cataclysmRow);

    this.savesListEl = document.createElement('div');
    this.savesListEl.className = 'wb-saves-list';

    savesTray.appendChild(saveControlsRow);
    savesTray.appendChild(this.savesListEl);
    this.tabContainers.saves = savesTray;
    shelf.appendChild(savesTray);

    // TAB 6: PHYSICS & PC / PERFORMANCE SETTINGS
    const physicsTray = document.createElement('div');
    physicsTray.className = 'wb-tray wb-physics-tray';

    const gravWrap = document.createElement('label');
    gravWrap.className = 'wb-slider-box';
    gravWrap.innerHTML = `<span>Гравитация: <b id="wb-grav-val">1.0x</b></span>`;
    const gravInput = document.createElement('input');
    gravInput.type = 'range';
    gravInput.min = '0.4';
    gravInput.max = '2.2';
    gravInput.step = '0.1';
    gravInput.value = String(this.world.settings.gravityScale);
    gravInput.addEventListener('input', () => {
      const v = parseFloat(gravInput.value);
      this.world.settings.gravityScale = v;
      gravWrap.querySelector('#wb-grav-val')!.textContent = `${v.toFixed(1)}x`;
    });
    gravWrap.appendChild(gravInput);

    const seaWrap = document.createElement('label');
    seaWrap.className = 'wb-slider-box';
    seaWrap.innerHTML = `<span>Уровень моря: <b id="wb-sea-val">${this.world.settings.seaLevel.toFixed(1)}</b></span>`;
    const seaInput = document.createElement('input');
    seaInput.type = 'range';
    seaInput.min = '0.0';
    seaInput.max = '9.0';
    seaInput.step = '0.2';
    seaInput.value = String(this.world.settings.seaLevel);
    seaInput.addEventListener('input', () => {
      const v = parseFloat(seaInput.value);
      this.world.settings.seaLevel = v;
      this.world.settings.openOceanEdges = true;
      seaWrap.querySelector('#wb-sea-val')!.textContent = v.toFixed(1);
    });
    seaWrap.appendChild(seaInput);

    const makeToggle = (
      label: string,
      initial: boolean,
      onChange: (checked: boolean) => void,
    ): HTMLElement => {
      const btn = document.createElement('button');
      btn.className = 'wb-toggle-pill' + (initial ? ' active' : '');
      let state = initial;
      const sync = () => {
        btn.classList.toggle('active', state);
        btn.textContent = `${label}: ${state ? 'ВКЛ' : 'ВЫКЛ'}`;
      };
      sync();
      btn.addEventListener('click', () => {
        state = !state;
        triggerHaptic('tap');
        this.sfx.playUiClick(state ? 640 : 440);
        sync();
        onChange(state);
      });
      return btn;
    };

    const ecoToggleBtn = document.createElement('button');
    ecoToggleBtn.className = 'wb-toggle-pill';
    ecoToggleBtn.textContent = '⚡ FPS: МАКС';
    ecoToggleBtn.addEventListener('click', () => {
      triggerHaptic('tap');
      this.sfx.playUiClick(600);
      this.setBatterySaver(!this.batterySaver);
    });
    this.ecoButtons.push(ecoToggleBtn);

    physicsTray.appendChild(gravWrap);
    physicsTray.appendChild(seaWrap);
    physicsTray.appendChild(
      makeToggle('Прокрутка краем (ПК)', false, (c) => {
        this.callbacks.onSetEdgeScroll(c);
      }),
    );
    physicsTray.appendChild(ecoToggleBtn);
    physicsTray.appendChild(
      makeToggle('Океан', this.world.settings.openOceanEdges, (c) => {
        this.world.settings.openOceanEdges = c;
      }),
    );
    physicsTray.appendChild(
      makeToggle('Эрозия', this.world.settings.sandErosion, (c) => {
        this.world.settings.sandErosion = c;
      }),
    );
    physicsTray.appendChild(
      makeToggle('Облака', this.world.settings.cloudsEnabled, (c) => {
        this.world.settings.cloudsEnabled = c;
      }),
    );
    physicsTray.appendChild(
      makeToggle('Мини-карта и разрез', this.world.settings.showCrossSection, (c) => {
        this.world.settings.showCrossSection = c;
        this.inspectorPanelEl.style.display = c ? '' : 'none';
      }),
    );

    this.tabContainers.physics = physicsTray;
    shelf.appendChild(physicsTray);

    dockWrapper.appendChild(shelf);
    this.root.appendChild(dockWrapper);

    this.refreshSavesList();
  }

  private createPowerButton(
    id: ToolId,
    name: string,
    hotkey: string,
    accentColor: string,
    compact: boolean,
  ): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = compact ? 'wb-power-btn wb-power-compact' : 'wb-power-btn wb-power-large';
    btn.style.setProperty('--power-accent', accentColor);
    btn.title = hotkey ? `${name} [${hotkey}]` : name;

    if (hotkey) {
      const keyTag = document.createElement('span');
      keyTag.className = 'wb-hotkey';
      keyTag.textContent = hotkey;
      btn.appendChild(keyTag);
    }

    btn.appendChild(createPixelIconCanvas(id as PixelIconName, compact ? 1.5 : 2));

    const label = document.createElement('span');
    label.className = 'wb-power-label';
    label.textContent = name;
    btn.appendChild(label);

    btn.addEventListener('click', () => {
      triggerHaptic('tool');
      if (this.touchPanMode) {
        this.setTouchPanMode(false, false);
      }
      this.selectTool(id, true);
    });
    btn.addEventListener('pointerenter', () => this.previewToolDescription(id));
    btn.addEventListener('pointerleave', () => this.previewToolDescription(this.activeTool));

    if (!this.toolButtons[id]) this.toolButtons[id] = [];
    this.toolButtons[id]!.push(btn);

    return btn;
  }

  public switchTab(tab: ToolbarTab, playSound: boolean): void {
    this.activeTab = tab;
    if (playSound) this.sfx.playUiClick(580);

    (Object.keys(this.tabContainers) as ToolbarTab[]).forEach((k) => {
      this.tabContainers[k].style.display = k === tab ? '' : 'none';
      this.tabButtons[k].classList.toggle('active', k === tab);
    });
  }

  public selectTool(tool: ToolId, playSound: boolean): void {
    this.activeTool = tool;
    if (playSound) this.sfx.playUiClick(700);
    this.syncToolHighlight();
    this.callbacks.onSelectTool(tool);
  }

  public setBrushIndex(index: number, playSound: boolean): void {
    const clamped = Math.max(0, Math.min(BRUSH_SIZES.length - 1, index));
    this.brushIndex = clamped;
    if (playSound) this.sfx.playUiClick(520 + clamped * 55);
    this.syncBrushHighlight();
    this.callbacks.onSelectBrushIndex(clamped);
  }

  public setTimeScale(scale: number, playSound: boolean): void {
    this.timeScale = scale;
    if (playSound) this.sfx.playUiClick(scale === 0 ? 380 : 660);
    this.syncSpeedHighlight();
    this.callbacks.onSetTimeScale(scale);
  }

  public toggleMute(): void {
    const muted = !this.sfx.muted;
    this.sfx.muted = muted;
    this.soundBtnSlot.innerHTML = '';
    this.soundBtnSlot.appendChild(createPixelIconCanvas(muted ? 'soundOff' : 'soundOn', 1));
    if (!muted) this.sfx.playUiClick(680);
  }

  private previewToolDescription(id: ToolId): void {
    const def = POWER_ITEMS.find((p) => p.id === id);
    if (!def) return;
    this.tooltipTitleEl.textContent = def.name.toUpperCase();
    this.tooltipTitleEl.style.color = def.accentColor;
    this.tooltipDescEl.textContent = ` — ${def.description}`;
  }

  private syncToolHighlight(): void {
    (Object.keys(this.toolButtons) as ToolId[]).forEach((id) => {
      const active = id === this.activeTool;
      for (const b of this.toolButtons[id] || []) {
        b.classList.toggle('selected', active);
      }
    });
    this.previewToolDescription(this.activeTool);
  }

  private syncBrushHighlight(): void {
    this.brushButtons.forEach((b, idx) => {
      b.classList.toggle('active', idx === this.brushIndex);
    });
  }

  private syncSpeedHighlight(): void {
    this.speedButtons.forEach((btn, val) => {
      btn.classList.toggle('active', val === this.timeScale);
    });
  }

  public updateHUD(fps: number, info: CursorInspection): void {
    this.fpsBadgeEl.textContent = `${Math.round(fps)} FPS`;
    this.popBadgeEl.textContent = `${info.population}`;
    this.houseBadgeEl.textContent = `${info.houses}`;
    this.warBadgeEl.textContent = `${info.warsActive}`;
    this.warBadgeEl.parentElement!.classList.toggle('wb-war-active', info.warsActive > 0);

    const weatherLabels: Record<string, string> = {
      clear: '☀ Ясно',
      rain: '🌧 Дождь',
      storm: '⛈ Шторм',
      snow: '❄ Снег',
    };
    const riseStr = info.seaRise > 0.15 ? ` +${info.seaRise.toFixed(1)}м` : '';
    this.weatherBadgeEl.textContent = `${weatherLabels[info.weather] || '☀ Ясно'}${riseStr}`;

    if (info.unit) {
      const u = info.unit;
      const statusHtml = [
        u.drowning ? `<span class="wb-unit-alert wb-alert-drown">🌊 ТОНЕТ!</span>` : '',
        u.infected ? `<span class="wb-unit-alert wb-alert-zombie">☣ ЗАРАЖЁН!</span>` : '',
        u.blessed ? `<span class="wb-unit-alert wb-alert-bless">✨ БЛАГОДАТЬ</span>` : '',
      ].join('');
      const traitsHtml = u.traits
        .map(
          (t) =>
            `<span class="wb-trait-chip" style="border-color:${t.color};color:${t.color}" title="${this.escapeHtml(t.desc)}">${this.escapeHtml(t.label)}</span>`,
        )
        .join('');
      const unpinBtn = u.pinned
        ? `<button id="wb-unpin-unit" class="wb-collapse-btn wb-passport-close" title="Закрыть паспорт">✕</button>`
        : '';

      this.unitPassportEl.innerHTML = `
        <div class="wb-unit-header">
          <div>
            <div class="wb-unit-name">${this.escapeHtml(u.name)}</div>
            <div class="wb-unit-sub">${this.escapeHtml(u.roleName)}${u.settlementName ? ` • ${this.escapeHtml(u.settlementName)}` : ''}</div>
          </div>
          ${unpinBtn}
        </div>
        ${statusHtml ? `<div class="wb-unit-alerts">${statusHtml}</div>` : ''}
        <div class="wb-stat-line"><span>Здоровье:</span><b>${u.hp} / ${u.maxHp}</b></div>
        <div class="wb-stat-line"><span>Сила / Скор.:</span><b>⚔ ${u.damage} &bull; ⚡ ${u.speed}</b></div>
        <div class="wb-stat-line"><span>Возраст / Бои:</span><b>${u.age} л. &bull; 💀 ${u.kills}</b></div>
        <div class="wb-stat-line"><span>Плавание:</span><b style="color:${u.canSwim ? '#74c0fc' : '#ff6b6b'}">${u.canSwim ? '✅ Умеет плавать' : '❌ Не умеет (тонет!)'}</b></div>
        <div class="wb-trait-list">${traitsHtml || '<span class="wb-trait-chip">Обычный житель</span>'}</div>
      `;
      this.unitPassportEl.classList.remove('wb-panel-hidden');
      const closeBtn = this.unitPassportEl.querySelector('#wb-unpin-unit');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          triggerHaptic('tap');
          this.sfx.playUiClick(500);
          this.callbacks.onUnpinUnit();
        });
      }
    } else {
      this.unitPassportEl.classList.add('wb-panel-hidden');
    }

    if (!info.inBounds) {
      this.inspectorStatsEl.innerHTML = `<div class="wb-stat-biome">Открытый океан</div>`;
      return;
    }

    const settleTag = info.settlementName
      ? `<div class="wb-stat-kingdom">&#9813; ${info.settlementName}</div>`
      : '';

    this.inspectorStatsEl.innerHTML = `
      <div class="wb-stat-biome">${info.biomeName}</div>
      ${settleTag}
      <div class="wb-stat-line"><span>Коорд:</span><b>${info.gx}, ${info.gy}</b></div>
      <div class="wb-stat-line"><span>Высота:</span><b>${info.totalSolid.toFixed(1)} м</b></div>
      <div class="wb-stat-line"><span>Вода:</span><b>${info.water.toFixed(1)} м</b></div>
    `;
  }
}
