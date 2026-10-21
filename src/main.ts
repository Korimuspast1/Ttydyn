import './style.css';
import { SoundEffects } from './audio/sfx';
import { EntityManager } from './engine/entities';
import { PhysicsEngine } from './engine/physics';
import { WorldRenderer } from './engine/renderer';
import { WorldSaveManager } from './engine/saveSystem';
import {
  BRUSH_SIZES,
  CursorInspection,
  ToolId,
  WORLD_H,
  WORLD_W,
} from './engine/types';
import { WorldState } from './engine/world';
import { isMobileViewportOrTouch, triggerHaptic } from './platform/mobileBridge';
import { WorldBoxUI } from './ui/toolbar';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const uiRoot = document.getElementById('ui-layer') as HTMLElement;

const sfx = new SoundEffects();
const world = new WorldState();
const entities = new EntityManager(world, sfx);
const physics = new PhysicsEngine(world, entities, sfx);
const renderer = new WorldRenderer(canvas, world, physics, entities);
const saveManager = new WorldSaveManager();

world.onTerrainRegenerated = () => {
  entities.reset();
};
entities.reset();

let activeTool: ToolId = 'sand';
let brushIndex = 2; // 'M' default
let timeScale = 1;
let touchPanMode = false;
let batterySaver = false;
let appBackgroundPaused = false;

let isPainting = false;
let isPanning = false;
let lastMouseX = 0;
let lastMouseY = 0;
let prevPaintGx = -1;
let prevPaintGy = -1;
let cursorGx = WORLD_W * 0.5;
let cursorGy = WORLD_H * 0.5;
let cursorInBounds = false;

// Multi-touch Pinch-to-Zoom + 2-Finger Pan + Deferred Stroke Start (prevents accidental tap drops during pinch!)
interface TrackedPointer {
  x: number;
  y: number;
  startX: number;
  startY: number;
  downAt: number;
  pointerType: string;
}
const activePointers = new Map<number, TrackedPointer>();
let lastPinchDist = 0;
let lastPinchMidX = 0;
let lastPinchMidY = 0;
let gestureWasMultiTouch = false;
let pendingTouchStroke = false;
let panDragMoved = false;

const keysHeld = new Set<string>();
let villageFocusIndex = 0;

function computeOptimalDpr(): number {
  const raw = window.devicePixelRatio || 1;
  if (batterySaver) return Math.min(1.25, raw);
  if (isMobileViewportOrTouch()) return Math.min(1.75, raw);
  return Math.min(2, raw);
}

function resizeCanvas(): void {
  const dpr = computeOptimalDpr();
  renderer.dpr = dpr;
  canvas.width = Math.max(1, Math.round(window.innerWidth * dpr));
  canvas.height = Math.max(1, Math.round(window.innerHeight * dpr));
}

resizeCanvas();
renderer.fitCameraToViewport();
window.addEventListener('resize', () => {
  resizeCanvas();
  renderer.clampCamera();
});
window.addEventListener('orientationchange', () => {
  window.setTimeout(() => {
    resizeCanvas();
    renderer.clampCamera();
  }, 60);
});

const ui = new WorldBoxUI(uiRoot, world, sfx, {
  onSelectTool: (tool) => {
    activeTool = tool;
    physics.resetStroke();
    if (
      tool === 'weather_rain' ||
      tool === 'weather_snow' ||
      tool === 'flood' ||
      tool === 'weather_clear'
    ) {
      physics.triggerWeatherOrFloodPower(tool);
    } else if (tool === 'peace') {
      entities.triggerPeacePower();
    }
  },
  onSetTouchPanMode: (panMode) => {
    touchPanMode = panMode;
    isPainting = false;
    pendingTouchStroke = false;
    physics.resetStroke();
  },
  onStepZoom: (factor) => {
    const cx = renderer.logicalWidth * 0.5;
    const cy = renderer.logicalHeight * 0.5;
    const before = renderer.screenToWorld(cx, cy);
    renderer.zoom *= factor;
    renderer.clampCamera();
    const after = renderer.screenToWorld(cx, cy);
    renderer.camX += before.gx - after.gx;
    renderer.camY += before.gy - after.gy;
    renderer.clampCamera();
  },
  onSetBatterySaver: (enabled) => {
    batterySaver = enabled;
    renderer.lowPowerFx = enabled;
    resizeCanvas();
    ui.showEventToast(
      enabled
        ? '🔋 Экономия заряда включена: снижено разрешение DPR и число частиц погоды'
        : '⚡ Максимальная чёткость и частота кадров включены!',
      enabled ? '#8ce99a' : '#ffd466',
    );
  },
  onUnpinUnit: () => {
    entities.selectedUnitUid = 0;
  },
  onSelectBrushIndex: (idx) => {
    brushIndex = idx;
  },
  onSetTimeScale: (scale) => {
    timeScale = scale;
  },
  onGenerateNewRandomWorld: () => {
    physics.clearParticles();
    world.generateRandomWorld();
    renderer.fitCameraToViewport();
    ui.showEventToast(`🎲 Создан новый случайный мир #${world.seed % 10000}!`, '#7af48c');
  },
  onSaveGame: (name) => {
    const saved = saveManager.saveWorld(world, entities, name);
    ui.showEventToast(`💾 Игра сохранена: «${saved.name}»`, '#6ce2ff');
  },
  onLoadGame: (slotId) => {
    physics.clearParticles();
    if (saveManager.loadWorld(slotId, world, entities)) {
      renderer.fitCameraToViewport();
      ui.showEventToast('📂 Сохранённый мир успешно загружен!', '#ffd466');
    }
  },
  onDeleteSave: (slotId) => {
    saveManager.deleteSave(slotId);
    ui.showEventToast('🗑 Сохранение удалено', '#ff9c92');
  },
  onExportSaveFile: (name) => {
    saveManager.exportToFile(world, entities, name);
    ui.showEventToast('⬇ Сохранение мира экспортировано (.json)', '#6ce2ff');
  },
  onImportSaveFile: async (file) => {
    physics.clearParticles();
    const res = await saveManager.importFromFile(file, world, entities);
    if (res) {
      renderer.fitCameraToViewport();
      ui.refreshSavesList();
      ui.showEventToast(`📂 Загружен мир из файла: «${res.name}»`, '#7af48c');
    }
  },
  getSavedWorlds: () => saveManager.listSaves(),
  onDrainAllWater: () => {
    world.water.fill(0);
    world.ice.fill(0);
    world.fluxL.fill(0);
    world.fluxR.fill(0);
    world.fluxU.fill(0);
    world.fluxD.fill(0);
    world.settings.openOceanEdges = false;
  },
  onFloodTsunami: () => {
    const W = WORLD_W;
    const H = WORLD_H;
    for (let x = 0; x < W; x++) {
      for (let band = 0; band < 7; band++) {
        const topIdx = band * W + x;
        const botIdx = (H - 1 - band) * W + x;
        world.water[topIdx] += 4.5;
        world.fluxD[topIdx] += 24;
        world.foam[topIdx] = 1.0;

        world.water[botIdx] += 4.5;
        world.fluxU[botIdx] += 24;
        world.foam[botIdx] = 1.0;
      }
    }
    for (let y = 0; y < H; y++) {
      for (let band = 0; band < 7; band++) {
        const leftIdx = y * W + band;
        const rightIdx = y * W + (W - 1 - band);
        world.water[leftIdx] += 4.5;
        world.fluxR[leftIdx] += 24;
        world.foam[leftIdx] = 1.0;

        world.water[rightIdx] += 4.5;
        world.fluxL[rightIdx] += 24;
        world.foam[rightIdx] = 1.0;
      }
    }
  },
  onMeteorShower: () => {
    for (let m = 0; m < 7; m++) {
      entities.spawnMeteor(
        WORLD_W * (0.18 + Math.random() * 0.64),
        WORLD_H * (0.18 + Math.random() * 0.64),
        1.15 + Math.random() * 0.5,
      );
    }
  },
  onResetZoom: () => {
    renderer.fitCameraToViewport();
  },
  onFocusVillage: () => {
    renderer.focusOnSettlement(villageFocusIndex++);
  },
});

entities.onWorldEvent = (message, color) => {
  ui.showEventToast(message, color);
};

// Native Android Lifecycle & Hardware Back Button Hooks
window.__wbSetPaused = (paused: boolean) => {
  appBackgroundPaused = paused;
  sfx.setSuspended(paused);
  if (!paused) {
    lastTime = performance.now();
  }
};

window.__wbHandleBackButton = () => {
  return ui.closeTransientPopups();
};

document.addEventListener('visibilitychange', () => {
  const hidden = document.hidden;
  appBackgroundPaused = hidden;
  sfx.setSuspended(hidden);
  if (!hidden) {
    lastTime = performance.now();
  }
});

function updateCursorFromScreen(clientX: number, clientY: number): void {
  const { gx, gy } = renderer.screenToWorld(clientX, clientY);
  cursorGx = gx;
  cursorGy = gy;
  cursorInBounds = gx >= 0 && gx < WORLD_W && gy >= 0 && gy < WORLD_H;
}

function getTwoPointers(): [TrackedPointer, TrackedPointer] | null {
  const it = activePointers.values();
  const a = it.next().value as TrackedPointer | undefined;
  const b = it.next().value as TrackedPointer | undefined;
  return a && b ? [a, b] : null;
}

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

canvas.addEventListener('pointerdown', (e) => {
  sfx.unlock();
  try {
    canvas.setPointerCapture(e.pointerId);
  } catch {
    // Ignore on synthetic events
  }

  activePointers.set(e.pointerId, {
    x: e.clientX,
    y: e.clientY,
    startX: e.clientX,
    startY: e.clientY,
    downAt: performance.now(),
    pointerType: e.pointerType,
  });

  // Two-finger Pinch-to-Zoom + Pan! Immediately cancel any unconfirmed single-finger stroke!
  if (activePointers.size >= 2) {
    gestureWasMultiTouch = true;
    pendingTouchStroke = false;
    isPainting = false;
    isPanning = false;
    physics.resetStroke();
    prevPaintGx = -1;
    prevPaintGy = -1;

    const pair = getTwoPointers();
    if (pair) {
      lastPinchDist = Math.hypot(pair[1].x - pair[0].x, pair[1].y - pair[0].y);
      lastPinchMidX = (pair[0].x + pair[1].x) * 0.5;
      lastPinchMidY = (pair[0].y + pair[1].y) * 0.5;
    }
    return;
  }

  gestureWasMultiTouch = false;
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
  updateCursorFromScreen(e.clientX, e.clientY);

  // Desktop middle/right click OR Alt+Drag OR Mobile One-Thumb Camera Mode!
  if (e.button === 1 || e.button === 2 || keysHeld.has('Alt') || touchPanMode) {
    if (e.button === 2 && cursorInBounds && !touchPanMode) {
      entities.selectUnitNear(cursorGx, cursorGy, 4.5);
    }
    isPanning = true;
    panDragMoved = false;
    canvas.style.cursor = 'grabbing';
    return;
  }

  if (e.button === 0) {
    if (e.pointerType === 'touch') {
      // Short 65ms multi-touch guard so starting a 2-finger pinch never drops an accidental Nuke/Meteor!
      pendingTouchStroke = true;
      prevPaintGx = cursorGx;
      prevPaintGy = cursorGy;
    } else {
      isPainting = true;
      physics.resetStroke();
      prevPaintGx = cursorGx;
      prevPaintGy = cursorGy;
      if (cursorInBounds) {
        physics.applyBrush(activeTool, cursorGx, cursorGy, BRUSH_SIZES[brushIndex].radius, 1 / 60);
      }
    }
  }
});

canvas.addEventListener('pointermove', (e) => {
  const tracked = activePointers.get(e.pointerId);
  if (tracked) {
    tracked.x = e.clientX;
    tracked.y = e.clientY;
  }

  // Handle smooth 2-finger Pinch-to-Zoom + Pan!
  if (activePointers.size >= 2) {
    const pair = getTwoPointers();
    if (pair) {
      const dist = Math.hypot(pair[1].x - pair[0].x, pair[1].y - pair[0].y);
      const midX = (pair[0].x + pair[1].x) * 0.5;
      const midY = (pair[0].y + pair[1].y) * 0.5;

      const worldBefore = renderer.screenToWorld(lastPinchMidX, lastPinchMidY);
      if (lastPinchDist > 8 && dist > 8) {
        renderer.zoom *= dist / lastPinchDist;
        renderer.clampCamera();
      }
      const worldAfter = renderer.screenToWorld(midX, midY);
      renderer.camX += worldBefore.gx - worldAfter.gx;
      renderer.camY += worldBefore.gy - worldAfter.gy;
      renderer.clampCamera();

      lastPinchDist = dist;
      lastPinchMidX = midX;
      lastPinchMidY = midY;
      updateCursorFromScreen(midX, midY);
    }
    return;
  }

  const dx = e.clientX - lastMouseX;
  const dy = e.clientY - lastMouseY;
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;

  if (isPanning) {
    if (tracked && Math.hypot(e.clientX - tracked.startX, e.clientY - tracked.startY) > 7) {
      panDragMoved = true;
    }
    renderer.camX -= dx / renderer.zoom;
    renderer.camY -= dy / renderer.zoom;
    renderer.clampCamera();
  } else if (pendingTouchStroke && tracked && !gestureWasMultiTouch) {
    // Confirm single-finger paint stroke immediately once finger starts drawing cleanly!
    if (Math.hypot(e.clientX - tracked.startX, e.clientY - tracked.startY) > 6) {
      pendingTouchStroke = false;
      isPainting = true;
      physics.resetStroke();
      if (cursorInBounds) {
        physics.applyBrush(activeTool, cursorGx, cursorGy, BRUSH_SIZES[brushIndex].radius, 1 / 60);
      }
    }
  }

  updateCursorFromScreen(e.clientX, e.clientY);
});

function finishPointer(e: PointerEvent): void {
  const tracked = activePointers.get(e.pointerId);
  activePointers.delete(e.pointerId);

  if (activePointers.size === 0) {
    if (!gestureWasMultiTouch && tracked) {
      // Quick single-finger tap in Paint Mode that lifted before the 65ms guard -> fire clean single tap!
      if (pendingTouchStroke && cursorInBounds) {
        triggerHaptic(activeTool === 'nuke' || activeTool === 'meteor' ? 'heavy' : 'tap');
        physics.applyBrush(activeTool, cursorGx, cursorGy, BRUSH_SIZES[brushIndex].radius, 1 / 60);
      } else if (touchPanMode && !panDragMoved && cursorInBounds) {
        // Quick tap in Camera Mode inspects any creature under your finger!
        if (entities.selectUnitNear(cursorGx, cursorGy, 5.2)) {
          triggerHaptic('tool');
        }
      }
    }

    pendingTouchStroke = false;
    isPainting = false;
    isPanning = false;
    panDragMoved = false;
    gestureWasMultiTouch = false;
    lastPinchDist = 0;
    physics.resetStroke();
    prevPaintGx = -1;
    prevPaintGy = -1;
    canvas.style.cursor = 'crosshair';
  } else if (activePointers.size === 1) {
    const remaining = activePointers.values().next().value as TrackedPointer;
    lastMouseX = remaining.x;
    lastMouseY = remaining.y;
  }
}

window.addEventListener('pointerup', finishPointer);
window.addEventListener('pointercancel', finishPointer);

canvas.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    const before = renderer.screenToWorld(e.clientX, e.clientY);
    const zoomFactor = e.deltaY < 0 ? 1.14 : 1 / 1.14;
    renderer.zoom *= zoomFactor;
    renderer.clampCamera();
    const after = renderer.screenToWorld(e.clientX, e.clientY);
    renderer.camX += before.gx - after.gx;
    renderer.camY += before.gy - after.gy;
    renderer.clampCamera();
    updateCursorFromScreen(e.clientX, e.clientY);
  },
  { passive: false },
);

// Keyboard shortcuts across powers + camera + hide UI panels + unit inspect + random world
window.addEventListener('keydown', (e) => {
  if (document.activeElement && document.activeElement.tagName === 'INPUT') {
    return;
  }
  keysHeld.add(e.key);
  const code = e.code;

  if (code === 'Digit1') ui.selectTool('sand', true);
  else if (code === 'Digit2') ui.selectTool('water', true);
  else if (code === 'Digit3') ui.selectTool('stone', true);
  else if (code === 'Digit4') ui.selectTool('soil', true);
  else if (code === 'Digit5') ui.selectTool('lava', true);
  else if (code === 'Digit6') ui.selectTool('snow', true);
  else if (code === 'Digit7') ui.selectTool('seeds', true);
  else if (code === 'Digit8') ui.selectTool('humans', true);
  else if (code === 'Digit9') ui.selectTool('fire', true);
  else if (code === 'Digit0') ui.selectTool('acid', true);
  else if (code === 'Minus') ui.selectTool('tnt', true);
  else if (code === 'Equal') ui.selectTool('meteor', true);
  else if (code === 'KeyQ') ui.selectTool('raise', true);
  else if (code === 'KeyE') ui.selectTool('dig', true);
  else if (code === 'KeyF') ui.selectTool('level', true);
  else if (code === 'KeyV') ui.selectTool('wave', true);
  else if (code === 'KeyI') ui.selectTool('inspect', true);
  else if (code === 'BracketLeft') ui.setBrushIndex(brushIndex - 1, true);
  else if (code === 'BracketRight') ui.setBrushIndex(brushIndex + 1, true);
  else if (code === 'Space') {
    e.preventDefault();
    ui.setTimeScale(timeScale === 0 ? 1 : 0, true);
  } else if (code === 'KeyH') {
    sfx.playUiClick(520);
    ui.toggleAllPanels();
  } else if (code === 'KeyM') {
    ui.toggleMute();
  } else if (code === 'KeyB') {
    sfx.playUiClick(540);
    world.settings.showBorders = !world.settings.showBorders;
  } else if (code === 'KeyZ') {
    sfx.playUiClick(660);
    renderer.focusOnSettlement(villageFocusIndex++);
  } else if (code === 'KeyR') {
    sfx.playUiClick(620);
    physics.clearParticles();
    world.generateRandomWorld();
    renderer.fitCameraToViewport();
    ui.showEventToast(`🎲 Создан новый случайный мир #${world.seed % 10000}!`, '#7af48c');
  }
});

window.addEventListener('keyup', (e) => {
  keysHeld.delete(e.key);
});

function inspectTileAtCursor(): CursorInspection {
  let pop = 0;
  for (let i = 0; i < entities.humanCount; i++) {
    if (entities.hRole[i] <= 2) pop++;
  }
  const houses = world.totalHouses;
  const warsActive = entities.activeWarsCount;
  const weather = world.weather;
  const seaRise = Math.max(0, world.settings.seaLevel - world.baseSeaLevel);
  const unit = entities.getUnitInspection(cursorGx, cursorGy, cursorInBounds);

  if (!cursorInBounds) {
    return {
      inBounds: false,
      gx: 0,
      gy: 0,
      biomeName: 'Океан',
      settlementName: null,
      soil: 0,
      stone: 0,
      sand: 0,
      glass: 0,
      water: 0,
      lava: 0,
      ice: 0,
      totalSolid: 0,
      flowSpeed: 0,
      population: pop,
      houses,
      warsActive,
      weather,
      seaRise,
      unit,
    };
  }

  const gx = Math.floor(cursorGx);
  const gy = Math.floor(cursorGy);
  const idx = gy * WORLD_W + gx;

  const soil = world.soil[idx];
  const stone = world.stone[idx];
  const sand = world.sand[idx];
  const glass = world.glass[idx];
  const water = world.water[idx];
  const lava = world.lava[idx];
  const ice = world.ice[idx];
  const totalSolid = world.solidHeight(idx);
  const speed = Math.hypot(world.velX[idx], world.velY[idx]);
  const ownerSettle = entities.getSettlementById(world.territory[idx]);

  let biomeName = 'Равнина';
  if (lava > 0.03) biomeName = 'Раскалённая лава';
  else if (world.acid[idx] > 0.02) biomeName = 'Лужа кислоты';
  else if (world.plague[idx] > 0.05) biomeName = 'Чумные миазмы';
  else if (world.fire[idx] > 0.05) biomeName = 'Пожар!';
  else if (world.oil[idx] > 0.05) biomeName = 'Пятно нефти';
  else if (world.gunpowder[idx] > 0.05) biomeName = 'Дорожка пороха';
  else if (world.goldOre[idx] > 0.25) biomeName = 'Золотая жила!';
  else if (world.buildings[idx] === 6) biomeName = 'Разруха (руины дома)';
  else if (world.buildings[idx] === 7) biomeName = 'База выживших';
  else if (world.buildings[idx] === 8) biomeName = 'Деревянный частокол';
  else if (world.buildings[idx] === 3) biomeName = 'Каменная цитадель';
  else if (world.buildings[idx] === 4) biomeName = 'Мельница и пшеница';
  else if (world.buildings[idx] === 5) biomeName = 'Сторожевая башня';
  else if (world.buildings[idx] >= 2) biomeName = 'Жилой дом';
  else if (world.tnt[idx] > 0.04) biomeName = 'Заряд TNT';
  else if (ice > 0.04) biomeName = 'Ледяной покров';
  else if (water > 2.8) biomeName = 'Глубокий океан';
  else if (water > 0.9) biomeName = speed > 0.7 ? 'Бурный поток' : 'Лагуна / Пролив';
  else if (water > 0.03) biomeName = speed > 0.75 ? 'Речной порог' : 'Мелководье';
  else if (world.snowCover[idx] > 0.25) biomeName = 'Снежный склон';
  else if (glass > 0.08) biomeName = 'Плавленое стекло';
  else if (sand > 0.12) biomeName = world.wetness[idx] > 0.4 ? 'Мокрый пляж' : 'Золотой песок';
  else if (stone > 0.18) biomeName = totalSolid > 12.5 ? 'Снежный пик' : 'Горная скала';
  else if (world.ash[idx] > 0.35) biomeName = 'Выжженный пепел';
  else if (world.grass[idx] > 0.4) biomeName = totalSolid > 6.1 ? 'Лесной холм' : 'Зелёный луг';
  else biomeName = 'Земля';

  return {
    inBounds: true,
    gx,
    gy,
    biomeName,
    settlementName: ownerSettle ? ownerSettle.name : null,
    soil,
    stone,
    sand,
    glass,
    water,
    lava,
    ice,
    totalSolid,
    flowSpeed: speed,
    population: pop,
    houses,
    warsActive,
    weather,
    seaRise,
    unit,
  };
}

let lastTime = performance.now();
let fpsSmooth = 60;
let hudTimer = 0;

function frame(now: number): void {
  if (appBackgroundPaused) {
    lastTime = now;
    requestAnimationFrame(frame);
    return;
  }

  const rawDt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
  lastTime = now;
  fpsSmooth = fpsSmooth * 0.92 + (1 / rawDt) * 0.08;

  // Confirm held stationary touch stroke after 65ms if still only 1 finger down!
  if (pendingTouchStroke && activePointers.size === 1 && !gestureWasMultiTouch) {
    const p = activePointers.values().next().value as TrackedPointer;
    if (now - p.downAt >= 65) {
      pendingTouchStroke = false;
      isPainting = true;
      physics.resetStroke();
      if (cursorInBounds) {
        physics.applyBrush(activeTool, cursorGx, cursorGy, BRUSH_SIZES[brushIndex].radius, 1 / 60);
      }
    }
  }

  // WASD / Arrows camera movement
  const panSpeed = (160 / renderer.zoom) * rawDt;
  let movedCam = false;
  if (keysHeld.has('w') || keysHeld.has('W') || keysHeld.has('ц') || keysHeld.has('Ц') || keysHeld.has('ArrowUp')) {
    renderer.camY -= panSpeed;
    movedCam = true;
  }
  if (keysHeld.has('s') || keysHeld.has('S') || keysHeld.has('ы') || keysHeld.has('Ы') || keysHeld.has('ArrowDown')) {
    renderer.camY += panSpeed;
    movedCam = true;
  }
  if (keysHeld.has('a') || keysHeld.has('A') || keysHeld.has('ф') || keysHeld.has('Ф') || keysHeld.has('ArrowLeft')) {
    renderer.camX -= panSpeed;
    movedCam = true;
  }
  if (keysHeld.has('d') || keysHeld.has('D') || keysHeld.has('в') || keysHeld.has('В') || keysHeld.has('ArrowRight')) {
    renderer.camX += panSpeed;
    movedCam = true;
  }
  if (movedCam) {
    renderer.clampCamera();
    updateCursorFromScreen(lastMouseX, lastMouseY);
  }

  if (isPainting && cursorInBounds) {
    const r = BRUSH_SIZES[brushIndex].radius;
    const dist = prevPaintGx >= 0 ? Math.hypot(cursorGx - prevPaintGx, cursorGy - prevPaintGy) : 0;
    const steps = Math.min(8, Math.max(1, Math.ceil(dist / Math.max(1, r * 0.7))));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const ix = prevPaintGx >= 0 ? prevPaintGx + (cursorGx - prevPaintGx) * t : cursorGx;
      const iy = prevPaintGy >= 0 ? prevPaintGy + (cursorGy - prevPaintGy) * t : cursorGy;
      physics.applyBrush(activeTool, ix, iy, r, rawDt / steps);
    }
    prevPaintGx = cursorGx;
    prevPaintGy = cursorGy;
  }

  // Substep coalescing: caps heavy grid scans to <= 2 passes/frame even at 5x simulation speed!
  if (timeScale > 0) {
    const maxPasses = batterySaver ? 1 : 2;
    const passes = Math.min(timeScale, maxPasses);
    const stepDt = (timeScale / passes) * (1 / 60);
    for (let s = 0; s < passes; s++) {
      physics.step(stepDt);
    }
  }

  const showReticle = cursorInBounds && (!isMobileViewportOrTouch() || isPainting || pendingTouchStroke);
  renderer.render(
    now / 1000,
    cursorGx,
    cursorGy,
    showReticle,
    activeTool,
    BRUSH_SIZES[brushIndex].radius,
  );

  if (world.settings.showCrossSection && !isMobileViewportOrTouch()) {
    renderer.renderGeoSlice(ui.geoSliceCanvas, cursorGx, cursorGy, cursorInBounds);
  }

  hudTimer += rawDt;
  if (hudTimer >= (batterySaver ? 0.16 : 0.08)) {
    hudTimer = 0;
    ui.updateHUD(fpsSmooth, inspectTileAtCursor());
  }

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
