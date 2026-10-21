/**
 * Procedural Project Zomboid WebAudio Sound Synthesizer
 * Synthesizes 9mm shots, 12g shotguns, M16 bursts, shattering glass, wood barricades,
 * car alarms, helicopter blades, zombie groans, screams, and explosions offline!
 */
export class ZomboidAudio {
  private ctx: AudioContext | null = null;
  private noiseBuf: AudioBuffer | null = null;
  public muted = false;
  private lastShotAt = 0;
  private lastGlassAt = 0;
  private lastGroanAt = 0;
  private lastThudAt = 0;

  private ensure(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AC) {
        this.ctx = new AC();
        const len = Math.floor(this.ctx.sampleRate * 1.2);
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) {
          data[i] = Math.random() * 2 - 1;
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

  public setSuspended(suspended: boolean): void {
    if (!this.ctx) return;
    if (suspended && this.ctx.state === 'running') {
      this.ctx.suspend().catch(() => {});
    } else if (!suspended && !this.muted && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public playUiClick(freq = 540): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.65, t + 0.045);
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    osc.connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.055);
  }

  public playGunshot(kind: 'pistol' | 'shotgun' | 'rifle'): void {
    const ctx = this.ensure();
    if (!ctx || !this.noiseBuf) return;
    const now = performance.now();
    if (now - this.lastShotAt < 42) return;
    this.lastShotAt = now;

    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;

    const filter = ctx.createBiquadFilter();
    filter.type = kind === 'shotgun' ? 'lowpass' : 'bandpass';
    filter.frequency.setValueAtTime(kind === 'shotgun' ? 880 : kind === 'rifle' ? 1450 : 1850, t);
    filter.frequency.exponentialRampToValueAtTime(220, t + (kind === 'shotgun' ? 0.28 : 0.14));

    const g = ctx.createGain();
    const peak = kind === 'shotgun' ? 0.24 : kind === 'rifle' ? 0.15 : 0.14;
    const dur = kind === 'shotgun' ? 0.30 : 0.15;
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);

    src.connect(filter).connect(g).connect(ctx.destination);
    src.start(t, Math.random() * 0.3, dur + 0.02);
  }

  public playGlassShatter(): void {
    const ctx = this.ensure();
    if (!ctx || !this.noiseBuf) return;
    const now = performance.now();
    if (now - this.lastGlassAt < 90) return;
    this.lastGlassAt = now;

    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(3400, t);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
    src.connect(hp).connect(g).connect(ctx.destination);
    src.start(t, 0, 0.25);

    for (let k = 0; k < 3; k++) {
      const o = ctx.createOscillator();
      const og = ctx.createGain();
      o.type = 'square';
      o.frequency.setValueAtTime(2400 + Math.random() * 2600, t + k * 0.035);
      og.gain.setValueAtTime(0.035, t + k * 0.035);
      og.gain.exponentialRampToValueAtTime(0.0008, t + k * 0.035 + 0.07);
      o.connect(og).connect(ctx.destination);
      o.start(t + k * 0.035);
      o.stop(t + k * 0.035 + 0.08);
    }
  }

  public playWoodImpact(hammer = false): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const now = performance.now();
    if (now - this.lastThudAt < 75) return;
    this.lastThudAt = now;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = hammer ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(hammer ? 310 : 125, t);
    osc.frequency.exponentialRampToValueAtTime(52, t + 0.09);
    g.gain.setValueAtTime(0.13, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.095);
    osc.connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  public playZombieGroan(): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const now = performance.now();
    if (now - this.lastGroanAt < 380) return;
    this.lastGroanAt = now;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    const base = 78 + Math.random() * 34;
    osc.frequency.setValueAtTime(base, t);
    osc.frequency.linearRampToValueAtTime(base * 0.78, t + 0.26);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(420, t);

    g.gain.setValueAtTime(0.055, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    osc.connect(lp).connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  public playAlarmBeep(high: boolean): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(high ? 960 : 720, t);
    g.gain.setValueAtTime(0.055, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    osc.connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  public playExplosion(power = 1.0): void {
    const ctx = this.ensure();
    if (!ctx || !this.noiseBuf) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(520, t);
    lp.frequency.exponentialRampToValueAtTime(55, t + 0.65);

    const g = ctx.createGain();
    g.gain.setValueAtTime(Math.min(0.34, 0.24 * power), t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.68);
    src.connect(lp).connect(g).connect(ctx.destination);
    src.start(t, 0, 0.7);
  }
}
