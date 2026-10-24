export interface AndroidNativeBridge {
  isNativeApk?: () => boolean;
  vibrate?: (durationMs: number) => void;
  shareWorldSave?: (filename: string, jsonContent: string) => boolean;
}

export interface PcNativeStatus {
  nativePc: boolean;
  platform: string;
  savesDir: string;
  screenshotsDir: string;
}

declare global {
  interface Window {
    AndroidBridge?: AndroidNativeBridge;
    __wbSetPaused?: (paused: boolean) => void;
    __wbHandleBackButton?: () => boolean;
  }
}

let cachedPcStatus: PcNativeStatus | null = null;

export function isNativeAndroidApk(): boolean {
  try {
    return Boolean(window.AndroidBridge && window.AndroidBridge.isNativeApk?.());
  } catch {
    return false;
  }
}

export function isNativePcApp(): boolean {
  if (cachedPcStatus?.nativePc) return true;
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).get('pc') === '1';
  } catch {
    return false;
  }
}

export function getPcStatus(): PcNativeStatus | null {
  return cachedPcStatus;
}

export async function initPcNativeBridge(): Promise<PcNativeStatus | null> {
  if (typeof window === 'undefined' || isNativeAndroidApk()) return null;
  try {
    const res = await fetch('/__pc/status', { cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as PcNativeStatus;
    if (data && data.nativePc) {
      cachedPcStatus = data;
      return data;
    }
  } catch {
    // Running as normal web app or Android APK
  }
  return null;
}

export async function pcFetchDiskSaves(): Promise<string[]> {
  if (!isNativePcApp()) return [];
  try {
    const res = await fetch('/__pc/saves', { cache: 'no-store' });
    if (!res.ok) return [];
    const payload = (await res.json()) as { saves?: string[] };
    return Array.isArray(payload.saves) ? payload.saves : [];
  } catch {
    return [];
  }
}

export async function pcWriteDiskSave(slotId: string, jsonText: string): Promise<boolean> {
  if (!isNativePcApp()) return false;
  try {
    const res = await fetch(`/__pc/save?id=${encodeURIComponent(slotId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: jsonText,
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function pcDeleteDiskSave(slotId: string): Promise<boolean> {
  if (!isNativePcApp()) return false;
  try {
    const res = await fetch(`/__pc/save?id=${encodeURIComponent(slotId)}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function pcOpenSavesFolder(): Promise<boolean> {
  if (!isNativePcApp()) return false;
  try {
    const res = await fetch('/__pc/open-saves-dir', { method: 'POST' });
    return res.ok;
  } catch {
    return false;
  }
}

export async function captureWorldScreenshot(canvas: HTMLCanvasElement): Promise<string | null> {
  const dataUrl = canvas.toDataURL('image/png');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `WorldBox-${stamp}.png`;

  if (isNativePcApp()) {
    try {
      const b64 = dataUrl.split(',')[1] || '';
      const res = await fetch(`/__pc/screenshot?name=${encodeURIComponent(filename)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: b64,
      });
      if (res.ok) {
        const out = (await res.json()) as { path?: string };
        return out.path || filename;
      }
    } catch {
      // Fallback to browser download below
    }
  }

  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
  return filename;
}

export async function pcSendHeartbeat(): Promise<void> {
  if (!isNativePcApp()) return;
  try {
    await fetch('/__pc/heartbeat', { method: 'POST', keepalive: true });
  } catch {
    // Ignore transient network errors
  }
}

export async function pcQuitNativeApp(): Promise<void> {
  if (!isNativePcApp()) return;
  try {
    await fetch('/__pc/quit', { method: 'POST', keepalive: true });
  } catch {
    // Process exits immediately
  }
  try {
    window.close();
  } catch {
    // Ignore
  }
}

export function toggleDesktopFullscreen(): boolean {
  if (typeof document === 'undefined') return false;
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.().catch(() => {});
    return true;
  }
  document.exitFullscreen?.().catch(() => {});
  return false;
}

export function isMobileViewportOrTouch(): boolean {
  if (isNativeAndroidApk()) return true;
  if (isNativePcApp()) return false;
  if (typeof window === 'undefined') return false;
  if (window.innerWidth <= 920 || window.innerHeight <= 520) return true;
  return Boolean(window.matchMedia?.('(pointer: coarse)').matches);
}

let lastVibrateAt = 0;

export function triggerHaptic(kind: 'tap' | 'tool' | 'heavy' = 'tap'): void {
  if (isNativePcApp()) return;
  const now = performance.now();
  const minGap = kind === 'heavy' ? 90 : 35;
  if (now - lastVibrateAt < minGap) return;
  lastVibrateAt = now;

  const ms = kind === 'heavy' ? 28 : kind === 'tool' ? 14 : 8;
  try {
    if (window.AndroidBridge?.vibrate) {
      window.AndroidBridge.vibrate(ms);
      return;
    }
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(ms);
    }
  } catch {
    // Ignore on unsupported devices
  }
}

export function exportWorldJson(filename: string, jsonText: string): void {
  try {
    if (window.AndroidBridge?.shareWorldSave) {
      const ok = window.AndroidBridge.shareWorldSave(filename, jsonText);
      if (ok) return;
    }
  } catch {
    // Fallback to browser download below
  }

  const blob = new Blob([jsonText], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
