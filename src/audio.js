// ─────────────────────────────────────────────────────────────
//  ТОСКА — звук: дождь, ветер, шаги, далёкий город
//  всё генерируется процедурно (без файлов)
// ─────────────────────────────────────────────────────────────

export class Soundscape {
  constructor() {
    this.ctx = null;
    this.started = false;
    this.muted = false;
    this.master = null;
    this.rainGain = null;
    this.windGain = null;
    this.humGain = null;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const ctx = this.ctx;

    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.85;
    this.master.connect(ctx.destination);

    // мягкий компрессор, чтобы не резало
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 4;
    comp.connect(this.master);

    // ── дождь: шум через фильтр ──
    const rain = this.makeNoise(6);
    const rainHP = ctx.createBiquadFilter();
    rainHP.type = 'highpass';
    rainHP.frequency.value = 900;
    const rainLP = ctx.createBiquadFilter();
    rainLP.type = 'lowpass';
    rainLP.frequency.value = 7200;
    this.rainGain = ctx.createGain();
    this.rainGain.gain.value = 0.075;
    rain.connect(rainHP).connect(rainLP).connect(this.rainGain).connect(comp);
    rain.start();

    // ── ветер: шум пониже с LFO ──
    const wind = this.makeNoise(8);
    const wLP = ctx.createBiquadFilter();
    wLP.type = 'lowpass';
    wLP.frequency.value = 420;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.05;
    wind.connect(wLP).connect(this.windGain).connect(comp);
    wind.start();

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.055;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.032;
    lfo.connect(lfoGain).connect(this.windGain.gain);
    lfo.start();

    const lfo2 = ctx.createOscillator();
    lfo2.frequency.value = 0.017;
    const lfo2g = ctx.createGain();
    lfo2g.gain.value = 380;
    lfo2.connect(lfo2g).connect(wLP.frequency);
    lfo2.start();

    // ── далёкий гул района: 50 Гц + квинта ──
    this.humGain = ctx.createGain();
    this.humGain.gain.value = 0.018;
    this.humGain.connect(comp);
    for (const [f, g] of [[50, 1], [75, 0.5], [100, 0.22]]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const og = ctx.createGain();
      og.gain.value = g;
      o.connect(og).connect(this.humGain);
      o.start();
    }

    this.comp = comp;
    this.started = true;
  }

  makeNoise(seconds = 4) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    // розовый шум (простой фильтр)
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 1.0526913;
      d[i] = (b0 + b1 + b2 + white * 0.1848) * 0.22;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    return src;
  }

  resume() {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(m) {
    this.muted = m;
    if (!this.master) return;
    this.master.gain.setTargetAtTime(m ? 0 : 0.85, this.ctx.currentTime, 0.12);
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  // ── шаги по мокрому асфальту ──
  step(running = false) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = this.makeNoise(0.16);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900 + Math.random() * 700;
    bp.Q.value = 0.8;
    const g = ctx.createGain();
    const vol = running ? 0.13 : 0.075;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + 0.18);
  }

  // ── блип «мысли» ──
  blip(freq = 420, dur = 0.18, type = 'sine', vol = 0.05) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.88, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  // ── скрип качелей ──
  creak() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(140 + Math.random() * 60, t);
    o.frequency.linearRampToValueAtTime(90 + Math.random() * 40, t + 0.42);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 700;
    f.Q.value = 6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.035, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    o.connect(f).connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.5);
  }

  // ── хлопанье крыльев ──
  wings() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    for (let i = 0; i < 5; i++) {
      const t = t0 + i * 0.06 + Math.random() * 0.02;
      const src = this.makeNoise(0.08);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1600 + Math.random() * 900;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.05, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
      src.connect(bp).connect(g).connect(this.master);
      src.start(t);
      src.stop(t + 0.09);
    }
  }

  // ── урчание кота ──
  purr() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = this.makeNoise(0.9);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 220;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.1);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);
    const trem = ctx.createOscillator();
    trem.frequency.value = 24;
    const tg = ctx.createGain();
    tg.gain.value = 0.03;
    trem.connect(tg).connect(g.gain);
    src.connect(lp).connect(g).connect(this.master);
    src.start(t);
    trem.start(t);
    src.stop(t + 0.9);
    trem.stop(t + 0.9);
  }

  // ── далёкий гудок / поезд ──
  distantHorn() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.028, t + 0.6);
    g.gain.setValueAtTime(0.028, t + 1.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.4);
    lp.connect(g).connect(this.master);
    for (const f of [110, 146.8, 220]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      const og = ctx.createGain();
      og.gain.value = 0.3;
      o.connect(og).connect(lp);
      o.start(t);
      o.stop(t + 3.5);
    }
  }

  // ── звук «радио» из окна ──
  radio() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.02, t + 0.4);
    g.gain.setValueAtTime(0.02, t + 3.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 4.4);
    lp.connect(g).connect(this.master);
    // триольный вальс
    const notes = [329.6, 392, 440, 392, 329.6, 293.7, 329.6, 440];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      const og = ctx.createGain();
      const st = t + 0.15 + i * 0.42;
      og.gain.setValueAtTime(0.0001, st);
      og.gain.exponentialRampToValueAtTime(0.5, st + 0.03);
      og.gain.exponentialRampToValueAtTime(0.0001, st + 0.4);
      o.connect(og).connect(lp);
      o.start(st);
      o.stop(st + 0.45);
    });
  }

  // ── проезжающая машина (шум + гул) ──
  carPass(dir = 1, duration = 2.6) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = this.makeNoise(duration + 0.5);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.1;
    bp.frequency.setValueAtTime(320, t);
    bp.frequency.linearRampToValueAtTime(900, t + duration * 0.45);
    bp.frequency.linearRampToValueAtTime(260, t + duration);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + duration * 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) {
      pan.pan.setValueAtTime(dir > 0 ? -0.8 : 0.8, t);
      pan.pan.linearRampToValueAtTime(dir > 0 ? 0.8 : -0.8, t + duration);
      src.connect(bp).connect(g).connect(pan).connect(this.master);
    } else {
      src.connect(bp).connect(g).connect(this.master);
    }
    src.start(t);
    src.stop(t + duration + 0.2);
  }

  // ── скрип двери ──
  door() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(220, t);
    o.frequency.linearRampToValueAtTime(120, t + 0.6);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1100;
    f.Q.value = 8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.03, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);
    o.connect(f).connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.7);
  }
}
