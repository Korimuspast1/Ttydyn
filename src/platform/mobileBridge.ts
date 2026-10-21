export interface AndroidNativeBridge {
  isNativeApk?: () => boolean;
  vibrate?: (durationMs: number) => void;
  shareWorldSave?: (filename: string, jsonContent: string) => boolean;
}

declare global {
  interface Window {
    AndroidBridge?: AndroidNativeBridge;
    __wbSetPaused?: (paused: boolean) => void;
    __wbHandleBackButton?: () => boolean;
  }
}

export function isNativeAndroidApk(): boolean {
  try {
    return Boolean(window.AndroidBridge && window.AndroidBridge.isNativeApk?.());
  } catch {
    return false;
  }
}

export function isMobileViewportOrTouch(): boolean {
  if (isNativeAndroidApk()) return true;
  if (typeof window === 'undefined') return false;
  if (window.innerWidth <= 920 || window.innerHeight <= 520) return true;
  return Boolean(
    window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window,
  );
}

let lastVibrateAt = 0;

export function triggerHaptic(kind: 'tap' | 'tool' | 'heavy' = 'tap'): void {
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
