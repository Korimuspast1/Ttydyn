/**
 * Real Recorded Foley & Studio Audio Engine (`./sfx/*`) — ZERO Procedural Synthesis!
 *
 * Uses 21 authentic recorded WAV / OGG / MP3 studio samples with:
 * - Decoded WebAudio `AudioBuffer` playback + Stereo Spatial Panning & Distance Attenuation
 * - Instant `HTMLAudioElement` clone fallback while buffers finish decoding
 * - Surface-aware footsteps (concrete, wood, grass, shattered glass)
 * - Automatic crackling fire loop (`burning.wav`) scaled by nearby flames
 */

export type SfxId =
  | 'pistol'
  | 'shotgun'
  | 'shotgun_cock'
  | 'rifle'
  | 'bullet_wall'
  | 'flesh_hit'
  | 'melee_swing'
  | 'wood_hit'
  | 'glass_shatter'
  | 'explosion'
  | 'burning'
  | 'zombie_groan1'
  | 'zombie_groan2'
  | 'zombie_death'
  | 'step_concrete'
  | 'step_wood'
  | 'step_grass'
  | 'step_glass'
  | 'pickup'
  | 'siren'
  | 'ui_click';

export const SFX_MANIFEST: Record<SfxId, string> = {
  pistol: './sfx/pistol.wav',
  shotgun: './sfx/shotgun.wav',
  shotgun_cock: './sfx/shotgun_cock.wav',
  rifle: './sfx/rifle.wav',
  bullet_wall: './sfx/bullet_wall.wav',
  flesh_hit: './sfx/flesh_hit.ogg',
  melee_swing: './sfx/melee_swing.mp3',
  wood_hit: './sfx/wood_hit.mp3',
  glass_shatter: './sfx/glass_shatter.mp3',
  explosion: './sfx/explosion.wav',
  burning: './sfx/burning.wav',
  zombie_groan1: './sfx/zombie_groan1.mp3',
  zombie_groan2: './sfx/zombie_groan2.mp3',
  zombie_death: './sfx/zombie_death.wav',
  step_concrete: './sfx/step_concrete.mp3',
  step_wood: './sfx/step_wood.mp3',
  step_grass: './sfx/step_grass.mp3',
  step_glass: './sfx/step_glass.mp3',
  pickup: './sfx/pickup.wav',
  siren: './sfx/siren.ogg',
  ui_click: './sfx/ui_click.ogg',
};

export class ZomboidAudio {
  private ctx: AudioContext | null = null;
  private rawBytes = new Map<SfxId, ArrayBuffer>();
  private buffers = new Map<SfxId, AudioBuffer>();
  private htmlPool = new Map<SfxId, HTMLAudioElement>();
  private lastPlayed = new Map<SfxId, number>();

  private fireLoopSrc: AudioBufferSourceNode | null = null;
  private fireLoopGain: GainNode | null = null;

  public muted = false;
  public listenerX = 16;
  public listenerY = 16;
  public loadedCount = 0;

  constructor() {
    this.preloadAllSamples();
  }

  private preloadAllSamples(): void {
    if (typeof window === 'undefined' || typeof fetch === 'undefined') return;

    (Object.keys(SFX_MANIFEST) as SfxId[]).forEach((id) => {
      const url = SFX_MANIFEST[id];
      try {
        const el = new Audio(url);
        el.preload = 'auto';
        this.htmlPool.set(id, el);
      } catch {
        // Headless test environment safety
      }

      fetch(url)
        .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error(`HTTP ${res.status}`))))
        .then((ab) => {
          this.rawBytes.set(id, ab);
          this.loadedCount++;
          if (this.ctx) {
            this.decodeSingle(id, ab);
          }
        })
        .catch(() => {});
    });
  }

  private decodeSingle(id: SfxId, ab: ArrayBuffer): void {
    if (!this.ctx || this.buffers.has(id)) return;
    this.ctx
      .decodeAudioData(ab.slice(0))
      .then((decoded) => {
        this.buffers.set(id, decoded);
      })
      .catch(() => {});
  }

  private ensure(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AC =
        window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AC) {
        this.ctx = new AC();
        for (const [id, ab] of this.rawBytes.entries()) {
          this.decodeSingle(id, ab);
        }
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public unlock(): void {
    this.ensure();
  }

  public setListener(wx: number, wy: number): void {
    this.listenerX = wx;
    this.listenerY = wy;
  }

  public setSuspended(suspended: boolean): void {
    if (!this.ctx) return;
    if (suspended && this.ctx.state === 'running') {
      this.ctx.suspend().catch(() => {});
    } else if (!suspended && !this.muted && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  private computeSpatial(wx?: number, wy?: number, maxDist = 42): { vol: number; pan: number } {
    if (wx === undefined || wy === undefined) return { vol: 1.0, pan: 0 };
    const dx = wx - this.listenerX;
    const dy = wy - this.listenerY;
    const dist = Math.hypot(dx, dy);
    if (dist > maxDist) return { vol: 0, pan: 0 };
    const falloff = Math.max(0, 1 - dist / maxDist);
    // Isometric screen horizontal axis is proportional to (dx - dy)
    const screenDx = (dx - dy) * 0.055;
    const pan = Math.max(-0.85, Math.min(0.85, screenDx));
    return { vol: falloff * falloff * 0.85 + falloff * 0.15, pan };
  }

  public playSample(
    id: SfxId,
    opts?: {
      volume?: number;
      rate?: number;
      minGapMs?: number;
      wx?: number;
      wy?: number;
      maxDist?: number;
      delaySec?: number;
    },
  ): void {
    if (this.muted) return;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const minGap = opts?.minGapMs ?? 45;
    const prev = this.lastPlayed.get(id) ?? -9999;
    if (now - prev < minGap) return;

    const spatial = this.computeSpatial(opts?.wx, opts?.wy, opts?.maxDist ?? 44);
    const finalVol = Math.min(1.0, (opts?.volume ?? 0.55) * spatial.vol);
    if (finalVol < 0.012) return;

    this.lastPlayed.set(id, now);
    const ctx = this.ensure();
    const buf = this.buffers.get(id);

    if (ctx && buf) {
      const startAt = ctx.currentTime + (opts?.delaySec ?? 0);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = opts?.rate ?? 0.95 + Math.random() * 0.1;

      const gain = ctx.createGain();
      gain.gain.value = finalVol;

      if (typeof ctx.createStereoPanner === 'function' && spatial.pan !== 0) {
        const panner = ctx.createStereoPanner();
        panner.pan.value = spatial.pan;
        src.connect(gain);
        gain.connect(panner);
        panner.connect(ctx.destination);
      } else {
        src.connect(gain);
        gain.connect(ctx.destination);
      }
      src.start(startAt);
      return;
    }

    // Immediate real HTMLAudio fallback if buffer is still decoding right after boot
    const proto = this.htmlPool.get(id);
    if (proto) {
      const run = () => {
        try {
          const clone = proto.cloneNode() as HTMLAudioElement;
          clone.volume = Math.max(0, Math.min(1, finalVol));
          clone.playbackRate = opts?.rate ?? 1.0;
          clone.play().catch(() => {});
        } catch {
          // Ignore autoplay edge error
        }
      };
      if (opts?.delaySec) setTimeout(run, opts.delaySec * 1000);
      else run();
    }
  }

  /** Smooth ambient real fire crackle loop (`burning.wav`) proportional to nearby visible fire */
  public updateFireAmbience(intensity01: number): void {
    const target = this.muted ? 0 : Math.max(0, Math.min(0.42, intensity01 * 0.42));
    if (target <= 0.01) {
      if (this.fireLoopGain && this.ctx) {
        this.fireLoopGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.18);
      }
      return;
    }
    const ctx = this.ensure();
    const buf = this.buffers.get('burning');
    if (!ctx || !buf) return;

    if (!this.fireLoopSrc || !this.fireLoopGain) {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const g = ctx.createGain();
      g.gain.value = 0.001;
      src.connect(g);
      g.connect(ctx.destination);
      src.start();
      this.fireLoopSrc = src;
      this.fireLoopGain = g;
    }
    this.fireLoopGain.gain.setTargetAtTime(target, ctx.currentTime, 0.15);
  }

  // ═══ SEMANTIC GAMEPLAY SOUND TRIGGERS (100% REAL STUDIO SAMPLES) ═══

  public playUiClick(freq = 540): void {
    const rate = Math.max(0.82, Math.min(1.22, freq / 540));
    this.playSample('ui_click', { volume: 0.45, rate, minGapMs: 25 });
  }

  public playPickup(wx?: number, wy?: number): void {
    this.playSample('pickup', { volume: 0.55, rate: 0.96 + Math.random() * 0.08, minGapMs: 50, wx, wy });
  }

  public playGunshot(kind: 'pistol' | 'shotgun' | 'rifle', wx?: number, wy?: number, isPlayer = false): void {
    const boost = isPlayer ? 1.25 : 1.0;
    if (kind === 'shotgun') {
      this.playSample('shotgun', {
        volume: 0.72 * boost,
        rate: 0.95 + Math.random() * 0.08,
        minGapMs: isPlayer ? 80 : 120,
        wx,
        wy,
        maxDist: 56,
      });
      // Real pump-action rack sound 0.28s after firing 12-gauge!
      this.playSample('shotgun_cock', {
        volume: 0.48 * boost,
        rate: 0.98 + Math.random() * 0.05,
        minGapMs: 220,
        wx,
        wy,
        maxDist: 32,
        delaySec: 0.28,
      });
    } else if (kind === 'rifle') {
      this.playSample('rifle', {
        volume: 0.56 * boost,
        rate: 0.96 + Math.random() * 0.08,
        minGapMs: isPlayer ? 55 : 95,
        wx,
        wy,
        maxDist: 52,
      });
    } else {
      this.playSample('pistol', {
        volume: 0.54 * boost,
        rate: 0.95 + Math.random() * 0.1,
        minGapMs: isPlayer ? 65 : 105,
        wx,
        wy,
        maxDist: 46,
      });
    }
  }

  public playBulletWallImpact(wx?: number, wy?: number): void {
    this.playSample('bullet_wall', {
      volume: 0.36,
      rate: 0.92 + Math.random() * 0.16,
      minGapMs: 65,
      wx,
      wy,
      maxDist: 34,
    });
  }

  public playMeleeSwing(wx?: number, wy?: number, isPlayer = false): void {
    this.playSample('melee_swing', {
      volume: isPlayer ? 0.62 : 0.34,
      rate: 0.93 + Math.random() * 0.14,
      minGapMs: isPlayer ? 90 : 220,
      wx,
      wy,
      maxDist: 26,
    });
  }

  public playFleshHit(wx?: number, wy?: number): void {
    this.playSample('flesh_hit', {
      volume: 0.52,
      rate: 0.92 + Math.random() * 0.15,
      minGapMs: 60,
      wx,
      wy,
      maxDist: 34,
    });
  }

  public playGlassShatter(wx?: number, wy?: number): void {
    this.playSample('glass_shatter', {
      volume: 0.62,
      rate: 0.94 + Math.random() * 0.12,
      minGapMs: 110,
      wx,
      wy,
      maxDist: 42,
    });
  }

  public playWoodImpact(hammer = false, wx?: number, wy?: number): void {
    this.playSample('wood_hit', {
      volume: hammer ? 0.52 : 0.44,
      rate: hammer ? 1.12 + Math.random() * 0.1 : 0.88 + Math.random() * 0.12,
      minGapMs: 85,
      wx,
      wy,
      maxDist: 34,
    });
  }

  public playZombieGroan(wx?: number, wy?: number, forceLoud = false): void {
    const pick: SfxId = Math.random() < 0.5 ? 'zombie_groan1' : 'zombie_groan2';
    this.playSample(pick, {
      volume: forceLoud ? 0.72 : 0.42,
      rate: forceLoud ? 0.86 : 0.9 + Math.random() * 0.2,
      minGapMs: forceLoud ? 120 : 480,
      wx,
      wy,
      maxDist: forceLoud ? 52 : 30,
    });
  }

  public playZombieDeath(wx?: number, wy?: number): void {
    this.playSample('zombie_death', {
      volume: 0.48,
      rate: 0.92 + Math.random() * 0.16,
      minGapMs: 140,
      wx,
      wy,
      maxDist: 34,
    });
  }

  public playFootstep(surface: 'concrete' | 'wood' | 'grass' | 'glass', wx?: number, wy?: number, sprint = false): void {
    const id: SfxId =
      surface === 'wood'
        ? 'step_wood'
        : surface === 'grass'
          ? 'step_grass'
          : surface === 'glass'
            ? 'step_glass'
            : 'step_concrete';
    this.playSample(id, {
      volume: sprint ? 0.38 : 0.26,
      rate: (sprint ? 1.08 : 0.95) + Math.random() * 0.1,
      minGapMs: sprint ? 160 : 240,
      wx,
      wy,
      maxDist: 22,
    });
  }

  public playAlarmBeep(_high: boolean, wx?: number, wy?: number): void {
    this.playSample('siren', {
      volume: 0.34,
      rate: 0.98 + Math.random() * 0.05,
      minGapMs: 900,
      wx,
      wy,
      maxDist: 52,
    });
  }

  public playExplosion(wx?: number, wy?: number): void {
    this.playSample('explosion', {
      volume: 0.88,
      rate: 0.94 + Math.random() * 0.1,
      minGapMs: 120,
      wx,
      wy,
      maxDist: 75,
    });
  }
}
