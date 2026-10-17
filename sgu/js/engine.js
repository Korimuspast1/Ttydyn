/**
 * engine.js — синтезатор сигналов СГУ на Web Audio API.
 *
 * Никаких звуковых файлов для самих сирен не нужно: сигнал собирается в браузере
 * из осцилляторов, шейпера и «рупорных» фильтров — как это делает настоящая
 * электронная СГУ (генератор тона → усилитель → рупор).
 *
 * Тракт:  осц. основной (+ суб-осц.) → пульс → гейт → [ шейпер → пекинг → ФНЧ → ФВЧ ] → дак → мастер
 *                                                                             ↘ реверб (улица)
 */

import { MODES } from './modes.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;

/* ------------------------------------------------------------------ */
/*  Вспомогательные буферы                                            */
/* ------------------------------------------------------------------ */

function makeDriveCurve(amount = 1) {
  const n = 2048;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / (n - 1) - 1;
    const y = Math.tanh(x * (1.7 * amount)) * 0.95;
    // лёгкая асимметрия — «шершавый» лампово-рупорный тембр
    c[i] = clamp(y + 0.035 * x * x * Math.sign(x), -1, 1);
  }
  return c;
}

function makeNoiseBuffer(ctx, seconds = 2) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    last = 0.72 * last + 0.28 * w; // чуть «розовый» шум — больше воздуха
    d[i] = last;
  }
  return buf;
}

function makeImpulse(ctx, seconds = 1.15, decay = 3.4) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      // короткий «двор-город»: ранние отражения + шумовой хвост
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (i < 40 ? 0.4 : 1);
    }
  }
  return buf;
}

/* ------------------------------------------------------------------ */
/*  Один слой сирены                                                  */
/* ------------------------------------------------------------------ */

class Voice {
  constructor(rig, layer) {
    this.rig = rig;
    this.layer = layer;
    this.stopped = false;
  }

  start() {
    const rig = this.rig;
    const ctx = rig.ctx;
    const layer = this.layer;
    const now = ctx.currentTime;
    const layerGain = layer.gain ?? 1;

    // гейт включения/выключения слоя
    const gate = this.gate = ctx.createGain();
    gate.gain.value = 0.0001;

    // пульс (используется сигналами с паузами)
    const pulse = this.pulse = ctx.createGain();
    pulse.gain.value = layer.pulseStart ?? 1;

    // микс осцилляторов слоя
    const mix = this.mix = ctx.createGain();
    mix.gain.value = layerGain;
    mix.connect(pulse);
    pulse.connect(gate);
    gate.connect(rig.toneIn);

    // основной осциллятор
    const osc = this.osc = ctx.createOscillator();
    osc.type = layer.wave || 'square';
    osc.frequency.value = rig.params.low;
    const og = this.oscGain = ctx.createGain();
    og.gain.value = 1;
    osc.connect(og);
    og.connect(mix);
    this.pitches = [osc.frequency];

    // суб-осциллятор: добавляет «тело» и низ
    if (layer.sub) {
      const sub = this.sub = ctx.createOscillator();
      sub.type = layer.sub.wave || 'sawtooth';
      sub.frequency.value = rig.params.low;
      sub.detune.value = layer.sub.cents ?? -1200;
      const sg = this.subGain = ctx.createGain();
      sg.gain.value = layer.sub.gain ?? 0.25;
      sub.connect(sg);
      sg.connect(mix);
      this.pitches.push(sub.frequency);
    }

    // вибрато (моторный «рокот» старой сирены, дрожание ГО)
    if (layer.vibrato) {
      const lfo = this.lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = layer.vibrato.rate || 6;
      const lg = this.lfoGain = ctx.createGain();
      lg.gain.value = layer.vibrato.cents || 20;
      lfo.connect(lg);
      lg.connect(osc.detune);
      if (this.sub) lg.connect(this.sub.detune);
    }

    // шум «воздуха» (пневмогудок, старый ревун)
    if (layer.air) {
      const air = ctx.createBufferSource();
      air.buffer = rig.noise;
      air.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = layer.air.freq || 500;
      bp.Q.value = layer.air.q ?? 1;
      const ag = this.airGain = ctx.createGain();
      ag.gain.value = 0;
      air.connect(bp);
      bp.connect(ag);
      ag.connect(mix);
      this.air = air;
      this.airSpec = layer.air;
    }

    osc.start(now);
    if (this.sub) this.sub.start(now);
    if (this.lfo) this.lfo.start(now);
    if (this.air) this.air.start(now);

    gate.gain.setValueAtTime(0.0001, now);
    gate.gain.exponentialRampToValueAtTime(1, now + 0.05);

    if (this.airGain) {
      const a = this.airSpec;
      this.airGain.gain.setValueAtTime(0.0001, now);
      this.airGain.gain.exponentialRampToValueAtTime(a.gain ?? 0.12, now + (a.attack ?? 0.03));
      this.airGain.gain.exponentialRampToValueAtTime(
        Math.max(0.0002, a.sustain ?? 0.05), now + (a.attack ?? 0.03) + 0.35,
      );
    }

    // планировщик контура частоты
    this.cursor = 0;
    this.nextT = now + 0.03;
    this.timer = setInterval(() => this.tick(), 70);
    this.tick();
  }

  tick() {
    if (this.stopped) return;
    const rig = this.rig;
    const ctx = rig.ctx;
    const horizon = ctx.currentTime + 0.7;
    let guard = 0;

    while (this.nextT < horizon && guard++ < 80) {
      const segs = this.layer.cycle(rig.params) || [];
      const len = segs.reduce((a, s) => a + s.d, 0);
      if (!(len > 0.001)) return;

      let off = this.cursor % len;
      if (off < 0) off += len;

      let start = 0;
      let seg = segs[segs.length - 1];
      for (const s of segs) {
        if (off < start + s.d - 1e-9) { seg = s; break; }
        start += s.d;
      }

      const into = clamp(off - start, 0, seg.d);
      const remain = Math.max(0.004, seg.d - into);
      const frac = seg.d > 0 ? into / seg.d : 0;
      const from = into > 1e-5 ? lerp(seg.from, seg.to, frac) : seg.from;
      const t0 = this.nextT;
      const t1 = t0 + remain;

      for (const p of this.pitches) {
        p.setValueAtTime(from, t0);
        p.linearRampToValueAtTime(seg.to, t1);
      }
      if (seg.level !== undefined) {
        this.pulse.gain.setTargetAtTime(seg.level, t0, 0.006);
      }

      this.nextT = t1;
      this.cursor = off + remain;
    }
  }

  stop(fade = 0.12) {
    if (this.stopped) return;
    this.stopped = true;
    const ctx = this.rig.ctx;
    const now = ctx.currentTime;
    clearInterval(this.timer);
    try {
      this.gate.gain.cancelScheduledValues(now);
      this.gate.gain.setValueAtTime(Math.max(0.0002, this.gate.gain.value), now);
      this.gate.gain.exponentialRampToValueAtTime(0.0001, now + fade);
    } catch (e) { /* noop */ }
    const end = now + fade + 0.06;
    for (const n of [this.osc, this.sub, this.lfo, this.air]) {
      if (n) { try { n.stop(end); } catch (e) { /* noop */ } }
    }
    setTimeout(() => {
      try { this.gate.disconnect(); this.mix.disconnect(); this.pulse.disconnect(); } catch (e) { /* noop */ }
    }, (fade + 0.3) * 1000);
  }
}

/* ------------------------------------------------------------------ */
/*  Установка                                                         */
/* ------------------------------------------------------------------ */

export class SirenRig {
  constructor(opts = {}) {
    this.params = { low: 600, high: 1500, rate: 1 };
    this.masterVolume = 0.85;
    this.hornMode = true;        // речь через рупор
    this.active = new Map();     // id -> { mode, voices: [] }
    this.loops = new Map();      // id -> { src, g, url } — реальные записи
    this.loopRate = 1;           // общий «тон» (±) для реальных записей
    this._seamless = new Map();  // url -> буфер со сшитым швом
    this.onActive = opts.onActive || null;
    this.clipCache = new Map();
    this.ctx = null;
  }

  get ready() { return !!this.ctx; }

  async ensure() {
    if (!this.ctx) this._build();
    if (this.ctx.state === 'suspended') {
      try { await this.ctx.resume(); } catch (e) { /* noop */ }
    }
    return this.ctx;
  }

  _build() {
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = this.ctx = new AC({ latencyHint: 'interactive' });
    this.noise = makeNoiseBuffer(ctx, 2);

    // --- мастер -------------------------------------------------
    const master = this.master = ctx.createGain();
    master.gain.value = this.masterVolume;
    const limiter = this.limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -5;
    limiter.knee.value = 4;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.004;
    limiter.release.value = 0.25;
    const analyser = this.analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.55;
    master.connect(limiter);
    limiter.connect(analyser);
    analyser.connect(ctx.destination);

    // «дак» — приглушение сирен при речи в микрофон
    const duck = this.duckGain = ctx.createGain();
    duck.gain.value = 1;
    duck.connect(master);

    // --- тракт сирен --------------------------------------------
    const toneIn = this.toneIn = ctx.createGain();
    toneIn.gain.value = 1;

    const drive = ctx.createWaveShaper();
    drive.curve = makeDriveCurve(1);
    drive.oversample = '2x';
    this.drive = drive;

    const peak = ctx.createBiquadFilter();
    peak.type = 'peaking';
    peak.frequency.value = 1150;
    peak.Q.value = 1.0;
    peak.gain.value = 5;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 4200;
    lp.Q.value = 0.6;

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 190;
    hp.Q.value = 0.7;

    toneIn.connect(drive);
    drive.connect(peak);
    peak.connect(lp);
    lp.connect(hp);

    const sirenSum = this.sirenSum = ctx.createGain();
    sirenSum.gain.value = 0.75;
    hp.connect(sirenSum);
    sirenSum.connect(duck);

    // реальные записи идут мимо «рупорного» драйва — они уже записаны на улице
    const loopsOut = this.loopsOut = ctx.createGain();
    loopsOut.gain.value = 1;
    loopsOut.connect(sirenSum);

    // улица: короткая реверберация, чтобы звук не был «сухим»
    const conv = this.conv = ctx.createConvolver();
    conv.buffer = makeImpulse(ctx, 1.2, 3.6);
    const wet = this.wet = ctx.createGain();
    wet.gain.value = 0.13;
    sirenSum.connect(conv);
    conv.connect(wet);
    wet.connect(duck);

    // --- тракт речи (рупор) -------------------------------------
    const voiceIn = this.voiceIn = ctx.createGain();
    voiceIn.gain.value = 1;

    const vHp = ctx.createBiquadFilter();
    vHp.type = 'highpass';
    vHp.frequency.value = 300;
    const vLp = ctx.createBiquadFilter();
    vLp.type = 'lowpass';
    vLp.frequency.value = 3400;
    vLp.Q.value = 0.8;
    const vDrive = ctx.createWaveShaper();
    vDrive.curve = makeDriveCurve(0.8);
    vDrive.oversample = '2x';
    const vPeak = ctx.createBiquadFilter();
    vPeak.type = 'peaking';
    vPeak.frequency.value = 1750;
    vPeak.Q.value = 1.1;
    vPeak.gain.value = 6;

    voiceIn.connect(vHp);
    vHp.connect(vLp);
    vLp.connect(vDrive);
    vDrive.connect(vPeak);

    const hornsOut = this.hornsOut = ctx.createGain();
    hornsOut.gain.value = this.hornMode ? 1 : 0;
    vPeak.connect(hornsOut);
    hornsOut.connect(master);

    const dryOut = this.dryOut = ctx.createGain();
    dryOut.gain.value = this.hornMode ? 0 : 1;
    voiceIn.connect(dryOut);
    dryOut.connect(master);

    // реверб для речи — тот же «двор»
    const vWet = this.vWet = ctx.createGain();
    vWet.gain.value = 0.1;
    vPeak.connect(vWet);
    vWet.connect(conv);
  }

  /* ---------------- параметры ---------------- */

  setParam(k, v) { this.params[k] = v; }
  getParam(k) { return this.params[k]; }

  setMasterVolume(v) {
    this.masterVolume = clamp(v, 0, 1);
    if (this.master) {
      this.master.gain.setTargetAtTime(Math.pow(this.masterVolume, 1.5), this.ctx.currentTime, 0.02);
    }
  }

  setHornMode(on) {
    this.hornMode = !!on;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.hornsOut.gain.setTargetAtTime(on ? 1 : 0, t, 0.03);
    this.dryOut.gain.setTargetAtTime(on ? 0 : 1, t, 0.03);
  }

  /* ---------------- сигналы ---------------- */

  isActive(id) { return this.active.has(id); }
  activeIds() { return [...this.active.keys()]; }

  async enable(id, { fade = 0.12 } = {}) {
    const mode = MODES[id];
    if (!mode || !mode.layers || this.active.has(id)) return false;
    await this.ensure();
    const voices = mode.layers.map((layer) => {
      const v = new Voice(this, layer);
      v.start();
      return v;
    });
    this.active.set(id, { mode, voices });
    this._changed();
    return true;
  }

  async toggle(id) {
    return this.isActive(id) ? this.disable(id) : this.enable(id);
  }

  disable(id, fade = 0.14) {
    const entry = this.active.get(id);
    if (!entry) return false;
    this.active.delete(id);
    for (const v of entry.voices) v.stop(fade);
    this._changed();
    return true;
  }

  /** Гасим всё (включая «моментальные» сигналы и реальные записи) */
  stopAll(fade = 0.12) {
    const ids = [...this.active.keys()];
    for (const id of ids) this.disable(id, fade);
    for (const id of [...this.loops.keys()]) this.stopLoop(id, fade);
    return ids;
  }

  /* ---------------- реальные записи (лупы) ---------------- */

  isLooping(id) { return this.loops.has(id); }
  loopingIds() { return [...this.loops.keys()]; }

  /**
   * Сшиваем конец с началом — запись зацикливается без щелчка на стыке.
   * out[i] = src[L-X+i]*(1-w) + src[i]*w, где w = i/X.
   */
  makeSeamless(buffer, xfade = 0.12) {
    const sr = buffer.sampleRate;
    const X = Math.min(Math.floor(xfade * sr), Math.floor(buffer.length / 4));
    if (X < 96) return buffer;
    const outLen = buffer.length - X;
    const out = this.ctx.createBuffer(buffer.numberOfChannels, outLen, sr);
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const src = buffer.getChannelData(ch);
      const dst = out.getChannelData(ch);
      dst.set(src.subarray(X, X + outLen));
      for (let i = 0; i < X; i++) {
        const w = i / X;
        dst[i] = src[i] * w + src[X + i] * (1 - w);
      }
    }
    return out;
  }

  seamlessBuffer(url, raw, xfade) {
    const key = url + '|' + xfade;
    if (this._seamless.has(key)) return this._seamless.get(key);
    const buf = this.makeSeamless(raw, xfade);
    this._seamless.set(key, buf);
    return buf;
  }

  /** Включить реальную запись по кругу. Возвращает true, если заиграло. */
  async startLoop(id, url, { gain = 1, xfade = 0.12, fade = 0.05 } = {}) {
    if (this.loops.has(id)) return true;
    await this.ensure();
    const raw = await this.loadClip(url);
    if (!raw) return false;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.seamlessBuffer(url, raw, xfade);
    src.loop = true;
    src.playbackRate.value = this.loopRate;
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    src.connect(g);
    g.connect(this.loopsOut);
    src.start();
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, gain), ctx.currentTime + fade);
    this.loops.set(id, { src, g, url, gain });
    this._changed();
    return true;
  }

  stopLoop(id, fade = 0.15) {
    const e = this.loops.get(id);
    if (!e) return false;
    this.loops.delete(id);
    const t = this.ctx.currentTime;
    try {
      e.g.gain.cancelScheduledValues(t);
      e.g.gain.setValueAtTime(Math.max(0.0002, e.g.gain.value), t);
      e.g.gain.exponentialRampToValueAtTime(0.0002, t + fade);
    } catch (err) { /* noop */ }
    try { e.src.stop(t + fade + 0.05); } catch (err) { /* noop */ }
    this._changed();
    return true;
  }

  /** Общий «тон» реальных записей: 1.0 — как записано, 0.85 — ниже, 1.15 — выше. */
  setLoopRate(rate) {
    this.loopRate = rate;
    if (!this.ctx) return;
    for (const e of this.loops.values()) {
      e.src.playbackRate.setTargetAtTime(rate, this.ctx.currentTime, 0.03);
    }
  }

  _changed() {
    if (this.onActive) this.onActive(this.activeIds());
  }

  /* ---------------- дак и щелчки ---------------- */

  duck(on, depth = 0.16, time = 0.12) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.duckGain.gain.cancelScheduledValues(t);
    this.duckGain.gain.setValueAtTime(Math.max(0.0005, this.duckGain.gain.value), t);
    this.duckGain.gain.linearRampToValueAtTime(on ? depth : 1, t + time);
  }

  /** Щелчок тангенты микрофона */
  click(bright = 2200) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = bright;
    bp.Q.value = 1.4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    src.connect(bp); bp.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + 0.08);
  }

  /* ---------------- записи (речь) ---------------- */

  async loadClip(url) {
    if (this.clipCache.has(url)) return this.clipCache.get(url);
    let buf = null;
    try {
      const res = await fetch(url, { cache: 'force-cache' });
      if (res.ok) {
        const ab = await res.arrayBuffer();
        buf = await this.ctx.decodeAudioData(ab);
      }
    } catch (e) {
      buf = null;
    }
    this.clipCache.set(url, buf);
    return buf;
  }

  /**
   * Проиграть буфер через рупор.
   * Возвращает { duration, stop(fade) } — чтобы можно было оборвать объявление.
   */
  playBuffer(buffer, { gain = 1, duck = true } = {}) {
    if (!buffer || !this.ctx) return null;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(g);
    g.connect(this.voiceIn);
    const t = ctx.currentTime + 0.01;
    src.start(t);

    let unduckTimer = null;
    if (duck) {
      this.duck(true, 0.14, 0.06);
      unduckTimer = setTimeout(() => this.duck(false, 0.16, 0.25), Math.max(0, (buffer.duration - 0.15) * 1000));
    }
    src.onended = () => clearTimeout(unduckTimer);

    return {
      duration: buffer.duration,
      stop: (fade = 0.06) => {
        clearTimeout(unduckTimer);
        const now = ctx.currentTime;
        try {
          g.gain.cancelScheduledValues(now);
          g.gain.setValueAtTime(Math.max(0.0005, g.gain.value), now);
          g.gain.exponentialRampToValueAtTime(0.0005, now + fade);
        } catch (e) { /* noop */ }
        try { src.stop(now + fade + 0.02); } catch (e) { /* noop */ }
      },
    };
  }

  /** Проиграть файл по URL через рупор (с кэшем). */
  async playUrl(url, opts = {}) {
    await this.ensure();
    const buf = await this.loadClip(url);
    if (!buf) return null;
    return this.playBuffer(buf, opts);
  }
}
