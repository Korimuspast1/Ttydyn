import './style.css';
import { ZomboidAudio } from './audio/sfx';
import { IsoCityRenderer } from './engine/isoRenderer';
import { ZomboidSimulation } from './engine/sim';
import { SIM_TOOLS } from './engine/types';
import { CityWorld } from './engine/world';
import { ZomboidHUD } from './ui/hud';

const appRoot = document.getElementById('app')!;
const canvas = document.createElement('canvas');
canvas.id = 'iso-canvas';
appRoot.appendChild(canvas);

const audio = new ZomboidAudio();
const world = new CityWorld();
const sim = new ZomboidSimulation(world, audio);
const renderer = new IsoCityRenderer(canvas, world, sim);

function resizeCanvas(): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  renderer.dpr = dpr;
  canvas.width = Math.max(320, Math.floor(window.innerWidth * dpr));
  canvas.height = Math.max(240, Math.floor(window.innerHeight * dpr));
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();
renderer.focusSquad1PoliceStation();

function regenerateRandomCity(): void {
  world.generateRandomCity();
  sim.populateInitialOutbreak();
  renderer.focusSquad1PoliceStation();
  hud.bindNewWorld(world, sim);
}

const hud = new ZomboidHUD(appRoot, world, sim, renderer, audio, regenerateRandomCity);

// ══ POINTER, UNBOUNDED INFINITE WORLD CAMERA DRAG, WHEEL ZOOM & WORLDBOX BRUSH INPUT ══
let cursorSx = window.innerWidth * 0.5;
let cursorSy = window.innerHeight * 0.5;
let cursorWx = renderer.camX;
let cursorWy = renderer.camY;

let isPanning = false;
let isPainting = false;
let panLastX = 0;
let panLastY = 0;
let paintCooldown = 0;

function updateWorldCursor(sx: number, sy: number): void {
  cursorSx = sx;
  cursorSy = sy;
  const w = renderer.screenToWorld(sx, sy);
  cursorWx = w.wx;
  cursorWy = w.wy;
}

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  updateWorldCursor(e.clientX, e.clientY);

  if (e.button === 1 || e.button === 2 || hud.touchPanMode) {
    isPanning = true;
    panLastX = e.clientX;
    panLastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
    return;
  }

  if (hud.activeTool === 'inspect') {
    sim.selectUnitNear(cursorWx, cursorWy, 2.5);
    isPanning = true;
    panLastX = e.clientX;
    panLastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
    return;
  }

  sim.applyDirectorTool(hud.activeTool, cursorWx, cursorWy);
  isPainting = true;
  paintCooldown = 0.24;
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener('pointermove', (e) => {
  if (isPanning) {
    const dx = e.clientX - panLastX;
    const dy = e.clientY - panLastY;
    panLastX = e.clientX;
    panLastY = e.clientY;

    const hw = 16 * renderer.zoom;
    const hh = 8 * renderer.zoom;
    const a = -dx / hw;
    const b = -dy / hh;
    renderer.camX += (a + b) * 0.5;
    renderer.camY += (b - a) * 0.5;
    renderer.clampCamera();
  }
  updateWorldCursor(e.clientX, e.clientY);
});

window.addEventListener('pointerup', () => {
  isPanning = false;
  isPainting = false;
});

canvas.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    const before = renderer.screenToWorld(e.clientX, e.clientY);
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    renderer.zoom = Math.max(0.45, Math.min(3.2, renderer.zoom * factor));
    const after = renderer.screenToWorld(e.clientX, e.clientY);
    renderer.camX += before.wx - after.wx;
    renderer.camY += before.wy - after.wy;
    renderer.clampCamera();
    updateWorldCursor(e.clientX, e.clientY);
  },
  { passive: false },
);

const keys = new Set<string>();
window.addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'Space') {
    hud.paused = !hud.paused;
    hud.syncSpeedHighlight();
  } else if (e.code === 'F1') {
    e.preventDefault();
    hud.toggleTopLeft();
  } else if (e.code === 'F2') {
    e.preventDefault();
    hud.toggleBottomDock();
  } else if (e.code === 'KeyR') {
    regenerateRandomCity();
  } else {
    const pressed = e.key.toUpperCase();
    const match = SIM_TOOLS.find((t) => t.hotkey.toUpperCase() === pressed);
    if (match) hud.selectTool(match.id);
  }
});
window.addEventListener('keyup', (e) => keys.delete(e.code));

// ══ MAIN 60 FPS REAL-TIME SIMULATION + INFINITE 2.5D RENDER LOOP ══
let lastTs = performance.now();
let uiAccum = 0;

function frame(now: number): void {
  const rawDt = Math.min(0.05, Math.max(0.001, (now - lastTs) / 1000));
  lastTs = now;

  // Smooth isometric WASD / Arrow camera glide across the infinite world!
  const boost = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 2.2 : 1.0;
  const panSpd = (18 / renderer.zoom) * boost * rawDt;
  if (keys.has('KeyW') || keys.has('ArrowUp')) {
    renderer.camX -= panSpd;
    renderer.camY -= panSpd;
  }
  if (keys.has('KeyS') || keys.has('ArrowDown')) {
    renderer.camX += panSpd;
    renderer.camY += panSpd;
  }
  if (keys.has('KeyA') || keys.has('ArrowLeft')) {
    renderer.camX -= panSpd;
    renderer.camY += panSpd;
  }
  if (keys.has('KeyD') || keys.has('ArrowRight')) {
    renderer.camX += panSpd;
    renderer.camY -= panSpd;
  }
  renderer.clampCamera();
  updateWorldCursor(cursorSx, cursorSy);

  if (isPainting) {
    paintCooldown -= rawDt;
    if (paintCooldown <= 0) {
      paintCooldown = 0.22;
      if (
        hud.activeTool === 'spawn_shambler' ||
        hud.activeTool === 'spawn_sprinter' ||
        hud.activeTool === 'barricade' ||
        hud.activeTool === 'molotov'
      ) {
        sim.applyDirectorTool(hud.activeTool, cursorWx, cursorWy);
      }
    }
  }

  // Supports 0.5x Slow-Motion as well as 1x, 2x, 4x!
  if (!hud.paused) {
    if (hud.simSpeed < 1) {
      sim.step(rawDt * hud.simSpeed);
    } else {
      const steps = Math.round(hud.simSpeed);
      for (let s = 0; s < steps; s++) {
        sim.step(rawDt);
      }
    }
  }

  renderer.render(now * 0.001, cursorWx, cursorWy, hud.activeTool);

  uiAccum += rawDt;
  if (uiAccum >= 0.16) {
    uiAccum = 0;
    const inspectData = sim.getUnitInspection(cursorWx, cursorWy);
    hud.updateTelemetry(inspectData);
    renderer.renderMinimap(hud.minimapCanvas);
  }

  requestAnimationFrame(frame);
}

sim.step(0.05);
requestAnimationFrame(frame);

(window as unknown as Record<string, unknown>).__ZOMBOID_APP__ = {
  getWorld: () => world,
  getSim: () => sim,
  getRenderer: () => renderer,
  regenerateRandomCity,
};
