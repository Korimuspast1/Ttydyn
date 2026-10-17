/**
 * app.js — пульт СГУ: синтез сигналов, реальные записи, рупор и поиск оригиналов.
 */

import { MODES, MODE_ORDER, REAL, PHRASES, LINKS, SEARCH_HINTS } from './modes.js';
import { SirenRig } from './engine.js';

const $ = (sel, root = document) => root.querySelector(sel);

/* ------------------------------------------------------------------ */
/*  Состояние                                                          */
/* ------------------------------------------------------------------ */

const LATCHED = MODE_ORDER.filter((id) => !MODES[id].momentary && MODES[id].group !== 'go');
const GO = MODE_ORDER.filter((id) => MODES[id].group === 'go');
const MOMENTARY = MODE_ORDER.filter((id) => MODES[id].momentary);

const state = {
  layering: false,
  lightbarManual: false,
  micTarget: PHRASES[0].id,
  own: [],
  held: new Set(),
  micPlayback: null,
};

const rig = new SirenRig({ onActive: () => syncButtons() });

/* ------------------------------------------------------------------ */
/*  Отрисовка                                                          */
/* ------------------------------------------------------------------ */

function modeButton(id, { momentary = false } = {}) {
  const m = MODES[id];
  const b = document.createElement('button');
  b.className = 'btn' + (momentary ? ' btn--hold' : '');
  b.dataset.id = id;
  b.type = 'button';
  b.innerHTML = `
    <span class="led led--${m.led}"></span>
    <span class="btn__name">${m.name}</span>
    <span class="btn__latin">${m.latin}</span>
    <span class="btn__hint">${m.hint}</span>
    <span class="btn__key">${momentary ? 'удерживать' : 'клавиша ' + m.key.toUpperCase()}</span>`;
  return b;
}

function realRow(rec) {
  const row = document.createElement('button');
  row.type = 'button';
  row.className = 'real__btn';
  row.dataset.real = rec.id;
  row.innerHTML = `
    <span class="led led--${rec.tag === 'fire' ? 'red' : rec.tag === 'yelp' ? 'blue' : 'amber'}"></span>
    <span class="real__name">${rec.name}</span>
    <span class="real__gear">${rec.gear}</span>
    <span class="real__origin">${rec.origin}</span>
    <span class="real__play">▶ слушать по кругу</span>`;
  return row;
}

function buildUI() {
  const modes = $('#modes');
  for (const id of LATCHED) modes.append(modeButton(id));

  const goWrap = $('#goModes');
  for (const id of GO) goWrap.append(modeButton(id));

  const moment = $('#momentary');
  for (const id of MOMENTARY) moment.append(modeButton(id, { momentary: true }));

  const realWrap = $('#realList');
  for (const rec of REAL) realWrap.append(realRow(rec));

  const phrases = $('#phrases');
  for (const p of PHRASES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.dataset.id = p.id;
    b.textContent = p.label;
    b.title = '«' + p.text + '»';
    phrases.append(b);
  }

  const sel = $('#micTarget');
  for (const p of PHRASES) {
    const o = document.createElement('option');
    o.value = p.id;
    o.textContent = 'Фраза: ' + p.label;
    sel.append(o);
  }

  const hints = $('#hints');
  for (const h of SEARCH_HINTS) {
    const c = document.createElement('button');
    c.type = 'button';
    c.className = 'chip chip--sm';
    c.textContent = h;
    c.onclick = () => { $('#q').value = h; runSearch(); };
    hints.append(c);
  }

  const links = $('#links');
  for (const l of LINKS) {
    const li = document.createElement('li');
    li.innerHTML = `<a href="${l.u}" target="_blank" rel="noopener noreferrer">${l.t}</a>`;
    links.append(li);
  }

  const cards = $('#cards');
  for (const id of MODE_ORDER) {
    const m = MODES[id];
    const d = document.createElement('article');
    d.className = 'card';
    d.innerHTML = `
      <h3><span class="led led--${m.led}"></span>${m.name} <em>${m.latin}</em></h3>
      <p>${m.about}</p>
      <p class="card__use"><b>Где применяют:</b> ${m.use}</p>`;
    cards.append(d);
  }
}

/* ------------------------------------------------------------------ */
/*  Синтезированные сигналы                                            */
/* ------------------------------------------------------------------ */

async function toggleMode(id) {
  const m = MODES[id];
  if (m.momentary) return;

  if (!rig.isActive(id) && !state.layering && !m.group) {
    for (const other of LATCHED) {
      if (other !== id && rig.isActive(other)) rig.disable(other, 0.18);
    }
  }
  await rig.toggle(id);
  syncButtons();
}

async function pressMomentary(id) {
  if (state.held.has(id)) return;
  state.held.add(id);
  syncButtons();

  if (id === 'airhorn') {
    await rig.enable(id);
  } else if (id === 'mik') {
    await rig.ensure();
    rig.click();
    rig.duck(true, 0.14, 0.07);
    const player = await playMicTarget(true);
    if (!state.held.has('mik')) {
      if (player && player.stop) player.stop(0.05);
      rig.duck(false, 0.16, 0.22);
    } else {
      state.micPlayback = player;
    }
  }
  syncButtons();
}

function releaseMomentary(id) {
  if (!state.held.has(id)) return;
  state.held.delete(id);

  if (id === 'airhorn') {
    rig.disable(id, 0.1);
  } else if (id === 'mik') {
    rig.click(1600);
    rig.duck(false, 0.16, 0.22);
    if (state.micPlayback && state.micPlayback.stop) state.micPlayback.stop(0.08);
    state.micPlayback = null;
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  }
  syncButtons();
}

/* ------------------------------------------------------------------ */
/*  Реальные записи                                                    */
/* ------------------------------------------------------------------ */

async function toggleReal(id) {
  const rec = REAL.find((r) => r.id === id);
  if (!rec) return;
  if (rig.isLooping(id)) {
    rig.stopLoop(id, 0.15);
    syncButtons();
    return;
  }
  for (const other of rig.loopingIds()) rig.stopLoop(other, 0.12);
  if (!state.layering) {
    // реальная запись заменяет синтез — иначе два сигнала наложатся друг на друга
    for (const other of rig.activeIds()) {
      if (!MODES[other].momentary) rig.disable(other, 0.12);
    }
  }
  const ok = await rig.startLoop(id, rec.file, { gain: rec.gain, xfade: rec.xfade });
  if (!ok) flash('Не получилось запустить запись: ' + rec.file);
  syncButtons();
}

/* ------------------------------------------------------------------ */
/*  Рупор: речь                                                        */
/* ------------------------------------------------------------------ */

async function playMicTarget(held = false) {
  const target = state.micTarget;
  if (target.startsWith('own:')) {
    const own = state.own.find((o) => 'own:' + o.id === target);
    if (!own) return null;
    const buf = await decodeOwn(own);
    return buf ? rig.playBuffer(buf, { duck: !held }) : null;
  }
  if (target.startsWith('web:')) {
    const rec = webResults.find((r) => 'web:' + r.id === target);
    if (!rec) return null;
    return rig.playUrl(rec.url, { duck: !held });
  }
  const phrase = PHRASES.find((p) => p.id === target) || PHRASES[0];
  return speak(phrase, { held });
}

async function speak(phrase, { held = false } = {}) {
  await rig.ensure();
  const buf = await rig.loadClip(phrase.file);
  if (buf) return rig.playBuffer(buf, { duck: !held });

  if (!('speechSynthesis' in window)) {
    flash('Нет файла объявления и нет синтеза речи в браузере');
    return null;
  }
  const u = new SpeechSynthesisUtterance(phrase.text);
  u.lang = 'ru-RU';
  u.rate = 0.98;
  u.pitch = 0.82;
  const ru = speechSynthesis.getVoices().find((v) => /^ru/i.test(v.lang));
  if (ru) u.voice = ru;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    if (!held) rig.duck(false, 0.16, 0.25);
  };
  u.onend = finish;
  u.onerror = finish;
  if (!held) rig.duck(true, 0.16, 0.06);
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
  return {
    duration: 0,
    stop() { try { speechSynthesis.cancel(); } catch (e) { /* noop */ } finish(); },
  };
}

function stopAll() {
  if (state.micPlayback && state.micPlayback.stop) state.micPlayback.stop(0.05);
  state.micPlayback = null;
  state.held.clear();
  rig.stopAll(0.12);
  state.lightbarManual = false;
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  rig.duck(false, 0.16, 0.15);
  syncButtons();
}

/* ------------------------------------------------------------------ */
/*  Индикация                                                          */
/* ------------------------------------------------------------------ */

function syncButtons() {
  document.querySelectorAll('.btn[data-id]').forEach((b) => {
    const id = b.dataset.id;
    b.classList.toggle('is-on', rig.isActive(id) || state.held.has(id));
  });
  document.querySelectorAll('.real__btn[data-real]').forEach((b) => {
    const id = b.dataset.real;
    const on = rig.isLooping(id);
    b.classList.toggle('is-on', on);
    const label = b.querySelector('.real__play');
    if (label) label.textContent = on ? '■ остановить' : '▶ слушать по кругу';
  });

  const names = [...new Set([...rig.activeIds(), ...state.held, ...rig.loopingIds()])]
    .map((id) => MODES[id] ? MODES[id].name : (REAL.find((r) => r.id === id) || {}).name)
    .filter(Boolean);
  $('#status').textContent = names.length ? 'ВКЛ: ' + names.join(' + ') : 'готов';
  updateLightbar();
}

function updateLightbar() {
  const active = rig.activeIds();
  const loops = rig.loopingIds();
  const siren = active.find((id) => MODES[id].group !== 'go');
  const real = loops.map((id) => (REAL.find((r) => r.id === id) || {}).tag)[0];
  const bar = $('#lightbar');
  const on = state.lightbarManual || !!siren || !!real;
  bar.classList.toggle('is-on', on);

  let period = 0.42;
  if (real) {
    period = real === 'yelp' ? 0.22 : real === 'hilo' ? 0.34 : real === 'fire' ? 0.3 : 0.5;
  } else if (siren === 'yelp' || siren === 'pursuit') period = 0.22;
  else if (siren === 'wail') period = 0.5;
  else if (siren === 'hilo') period = 0.34;
  else if (siren === 'pulsar') period = 0.28;
  bar.style.setProperty('--ph', period + 's');
  $('#lampBtn').classList.toggle('is-on', state.lightbarManual);
}

let flashTimer = null;
function flash(text) {
  $('#status').textContent = text;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(syncButtons, 2000);
}

/* ------------------------------------------------------------------ */
/*  Свои записи (IndexedDB)                                            */
/* ------------------------------------------------------------------ */

const DB_NAME = 'sgu-own-sounds';
let dbPromise = null;
const ownBuffers = new Map();

function db() {
  if (!dbPromise) {
    dbPromise = new Promise((res, rej) => {
      const rq = indexedDB.open(DB_NAME, 1);
      rq.onupgradeneeded = () => {
        const d = rq.result;
        if (!d.objectStoreNames.contains('sounds')) d.createObjectStore('sounds', { keyPath: 'id' });
      };
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => rej(rq.error);
    });
  }
  return dbPromise;
}

async function ownAll() {
  const d = await db();
  return new Promise((res, rej) => {
    const rq = d.transaction('sounds', 'readonly').objectStore('sounds').getAll();
    rq.onsuccess = () => res(rq.result || []);
    rq.onerror = () => rej(rq.error);
  });
}

async function ownPut(rec) {
  const d = await db();
  return new Promise((res, rej) => {
    const tx = d.transaction('sounds', 'readwrite');
    tx.objectStore('sounds').put(rec);
    tx.oncomplete = () => res(true);
    tx.onerror = () => rej(tx.error);
  });
}

async function ownDel(id) {
  const d = await db();
  ownBuffers.delete(id);
  return new Promise((res) => {
    const tx = d.transaction('sounds', 'readwrite');
    tx.objectStore('sounds').delete(id);
    tx.oncomplete = () => res(true);
  });
}

async function decodeOwn(rec) {
  await rig.ensure();
  if (ownBuffers.has(rec.id)) return ownBuffers.get(rec.id);
  try {
    const ab = rec.data instanceof ArrayBuffer ? rec.data : await rec.data.arrayBuffer();
    const buf = await rig.ctx.decodeAudioData(ab.slice(0));
    ownBuffers.set(rec.id, buf);
    return buf;
  } catch (e) {
    flash('Не удалось прочитать файл: ' + rec.name);
    return null;
  }
}

async function saveBlob(name, type, blob) {
  const data = await blob.arrayBuffer();
  await ownPut({ id: String(Date.now()) + '-' + Math.random().toString(36).slice(2, 7), name, type, data });
  await renderOwn();
}

async function addFiles(files) {
  const list = [...files].filter((f) => /audio|mp3|ogg|wav|m4a|aac|flac|opus|webm/i.test(f.type + ' ' + f.name));
  if (!list.length) { flash('Это не похоже на аудиофайл'); return; }
  for (const f of list) await saveBlob(f.name, f.type, f);
  flash('Добавлено записей: ' + list.length);
}

async function renderOwn() {
  state.own = (await ownAll()).sort((a, b) => a.name.localeCompare(b.name));
  const wrap = $('#ownlist');
  wrap.innerHTML = '';
  if (!state.own.length) {
    wrap.innerHTML = '<p class="hint">Пока пусто. Перетащи файлы выше или сохрани запись из поиска ниже.</p>';
  }
  for (const rec of state.own) {
    const row = document.createElement('div');
    row.className = 'own';
    row.innerHTML = `
      <button class="own__play" type="button" title="Проиграть через рупор">▶</button>
      <span class="own__name"></span>
      <button class="own__mic" type="button" title="Поставить в «микрофон»">в микрофон</button>
      <button class="own__del" type="button" title="Удалить">✕</button>`;
    row.querySelector('.own__name').textContent = rec.name;
    row.querySelector('.own__play').onclick = async () => {
      const buf = await decodeOwn(rec);
      if (buf) rig.playBuffer(buf, { duck: true });
    };
    row.querySelector('.own__mic').onclick = () => {
      state.micTarget = 'own:' + rec.id;
      $('#micTarget').value = 'own:' + rec.id;
      flash('Микрофон: ' + rec.name);
    };
    row.querySelector('.own__del').onclick = async () => {
      await ownDel(rec.id);
      if (state.micTarget === 'own:' + rec.id) { state.micTarget = PHRASES[0].id; $('#micTarget').value = PHRASES[0].id; }
      renderOwn();
    };
    wrap.append(row);
  }
  refreshMicOptions();
}

/** Варианты для «микрофона»: фразы, свои записи и найденные в интернете */
function refreshMicOptions() {
  const sel = $('#micTarget');
  [...sel.querySelectorAll('option[data-dyn]')].forEach((o) => o.remove());
  for (const rec of state.own) {
    const o = document.createElement('option');
    o.dataset.dyn = '1';
    o.value = 'own:' + rec.id;
    o.textContent = 'Своя запись: ' + rec.name;
    sel.append(o);
  }
  for (const r of webResults) {
    const o = document.createElement('option');
    o.dataset.dyn = '1';
    o.value = 'web:' + r.id;
    o.textContent = 'Из интернета: ' + r.title.slice(0, 60);
    sel.append(o);
  }
  sel.value = state.micTarget;
}

/* ------------------------------------------------------------------ */
/*  Поиск настоящих записей в интернете (Wikimedia Commons)            */
/* ------------------------------------------------------------------ */

const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
let webResults = [];

function stripTags(html) {
  const d = document.createElement('div');
  d.innerHTML = html || '';
  return (d.textContent || '').replace(/\s+/g, ' ').trim();
}

function fmtDuration(v) {
  const s = parseFloat(String(v).replace(',', '.'));
  if (!isFinite(s)) return '';
  return s >= 60 ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : `${s.toFixed(1)} с`;
}

async function searchCommons(query) {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    generator: 'search',
    gsrsearch: `${query} filetype:audio`,
    gsrnamespace: '6',
    gsrlimit: '30',
    prop: 'imageinfo',
    iiprop: 'url|mime|size|extmetadata',
  });
  const res = await fetch(`${COMMONS_API}?${params.toString()}`);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  const pages = Object.values((data && data.query && data.query.pages) || {});
  return pages.map((p) => {
    const ii = (p.imageinfo || [])[0] || {};
    const meta = ii.extmetadata || {};
    return {
      id: String(p.pageid),
      title: String(p.title || '').replace(/^File:/, ''),
      url: ii.url,
      mime: ii.mime || '',
      kb: ii.size ? Math.round(ii.size / 1024) : 0,
      duration: fmtDuration(meta.Duration ? meta.Duration.value : ''),
      license: stripTags(meta.LicenseShortName ? meta.LicenseShortName.value : ''),
      artist: stripTags(meta.Artist ? meta.Artist.value : '').slice(0, 90),
      page: 'https://commons.wikimedia.org/wiki/' + encodeURIComponent(p.title || ''),
    };
  }).filter((x) => x.url);
}

async function runSearch() {
  const q = $('#q').value.trim();
  const box = $('#webResults');
  if (!q) { flash('Введи запрос для поиска'); return; }
  box.innerHTML = '<p class="hint">Ищу…</p>';
  try {
    webResults = await searchCommons(q);
  } catch (e) {
    box.innerHTML = '';
    const p = document.createElement('p');
    p.className = 'hint hint--warn';
    p.textContent = 'Поиск не удался (' + e.message + '). Похоже, браузер не пустил запрос к Wikimedia Commons — '
      + 'тогда просто скачай нужный файл вручную и перетащи его в «Свои записи» выше.';
    box.append(p);
    return;
  }
  box.innerHTML = '';
  if (!webResults.length) {
    box.innerHTML = '<p class="hint">Ничего не нашлось. Попробуй другой запрос, например «police siren».</p>';
    return;
  }
  const wrap = document.createElement('div');
  wrap.className = 'web';
  for (const r of webResults) {
    const row = document.createElement('div');
    row.className = 'web__row';
    row.innerHTML = `
      <div class="web__meta">
        <span class="web__title"></span>
        <span class="web__sub"></span>
      </div>
      <button class="web__play" type="button">▶ через рупор</button>
      <button class="web__save" type="button">⇩ сохранить</button>
      <a class="web__link" href="${r.page}" target="_blank" rel="noopener noreferrer">страница</a>`;
    row.querySelector('.web__title').textContent = r.title;
    row.querySelector('.web__sub').textContent = [r.duration, r.kb ? r.kb + ' КБ' : '', r.license, r.artist]
      .filter(Boolean).join(' · ');
    row.querySelector('.web__play').onclick = async (e) => {
      const b = e.currentTarget;
      b.textContent = '…';
      const player = await rig.playUrl(r.url, { duck: true });
      b.textContent = player ? '▶ через рупор' : 'не читается';
      if (!player) setTimeout(() => { b.textContent = '▶ через рупор'; }, 2000);
    };
    row.querySelector('.web__save').onclick = async (e) => {
      const b = e.currentTarget;
      b.textContent = '…';
      try {
        const res = await fetch(r.url);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const blob = await res.blob();
        await saveBlob(r.title.replace(/\.[a-z0-9]+$/i, '') + '.mp3', blob.type || 'audio/mpeg', blob);
        b.textContent = '⇩ сохранено';
        flash('Сохранено в «Свои записи»: ' + r.title);
      } catch (err) {
        b.textContent = '⇩ не вышло';
        flash('Скачать не удалось: ' + err.message);
      }
      setTimeout(() => { b.textContent = '⇩ сохранить'; }, 2500);
      refreshMicOptions();
    };
    wrap.append(row);
  }
  box.append(wrap);
  refreshMicOptions();
}

/* ------------------------------------------------------------------ */
/*  Сборка страницы                                                    */
/* ------------------------------------------------------------------ */

function bind() {
  $('#modes').addEventListener('click', (e) => {
    const b = e.target.closest('.btn[data-id]');
    if (b) toggleMode(b.dataset.id);
  });
  $('#goModes').addEventListener('click', (e) => {
    const b = e.target.closest('.btn[data-id]');
    if (b) toggleMode(b.dataset.id);
  });

  $('#realList').addEventListener('click', (e) => {
    const b = e.target.closest('.real__btn[data-real]');
    if (b) toggleReal(b.dataset.real);
  });

  const moment = $('#momentary');
  const down = (e) => {
    const b = e.target.closest('.btn[data-id]');
    if (!b) return;
    e.preventDefault();
    b.classList.add('is-held');
    if (b.setPointerCapture) { try { b.setPointerCapture(e.pointerId); } catch (err) { /* noop */ } }
    pressMomentary(b.dataset.id);
  };
  const up = (e) => {
    const b = e.target.closest('.btn[data-id]');
    document.querySelectorAll('.btn.is-held').forEach((x) => x.classList.remove('is-held'));
    if (!b) return;
    releaseMomentary(b.dataset.id);
  };
  moment.addEventListener('pointerdown', down);
  moment.addEventListener('pointerup', up);
  moment.addEventListener('pointercancel', up);

  $('#phrases').addEventListener('click', (e) => {
    const c = e.target.closest('.chip[data-id]');
    if (!c) return;
    state.micTarget = c.dataset.id;
    $('#micTarget').value = c.dataset.id;
    document.querySelectorAll('#phrases .chip').forEach((x) => x.classList.toggle('is-sel', x === c));
    speak(PHRASES.find((p) => p.id === c.dataset.id));
  });

  $('#micTarget').onchange = (e) => { state.micTarget = e.target.value; };

  $('#stopBtn').onclick = stopAll;
  $('#vol').oninput = (e) => rig.setMasterVolume(+e.target.value);
  $('#lampBtn').onclick = () => { state.lightbarManual = !state.lightbarManual; updateLightbar(); };
  $('#layering').onchange = (e) => { state.layering = e.target.checked; };
  $('#hornMode').onchange = (e) => { rig.setHornMode(e.target.checked); };

  $('#realTone').oninput = (e) => {
    const v = +e.target.value;
    rig.setLoopRate(v);
    $('#realToneVal').textContent = (v * 100).toFixed(0) + '%';
  };

  const bindRange = (sel, key, fmt) => {
    const el = $(sel);
    const out = $(sel + 'Val');
    el.oninput = () => {
      rig.setParam(key, +el.value);
      out.textContent = fmt(el.value);
    };
    out.textContent = fmt(el.value);
    rig.setParam(key, +el.value);
  };
  bindRange('#pitchLow', 'low', (v) => v + ' Гц');
  bindRange('#pitchHigh', 'high', (v) => v + ' Гц');
  bindRange('#rate', 'rate', (v) => (+v).toFixed(2) + '×');

  // свои записи
  const drop = $('#drop');
  const inp = $('#file');
  $('#pick').onclick = () => inp.click();
  inp.onchange = () => { if (inp.files && inp.files.length) addFiles(inp.files); inp.value = ''; };
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => {
    e.preventDefault(); drop.classList.add('is-over');
  }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => {
    e.preventDefault(); drop.classList.remove('is-over');
  }));
  drop.addEventListener('drop', (e) => {
    const f = e.dataTransfer && e.dataTransfer.files;
    if (f && f.length) addFiles(f);
  });

  // поиск в интернете
  $('#searchBtn').onclick = runSearch;
  $('#q').addEventListener('keydown', (e) => { if (e.key === 'Enter') runSearch(); });

  // клавиатура
  window.addEventListener('keydown', (e) => {
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
    if (e.code === 'Space') {
      e.preventDefault();
      if (!e.repeat) pressMomentary('airhorn');
      return;
    }
    if (e.key === 'm' || e.key === 'M' || e.key === 'ь' || e.key === 'Ь') {
      if (!e.repeat) pressMomentary('mik');
      return;
    }
    if (e.key === 'Escape') { stopAll(); return; }
    if (e.key === 'l' || e.key === 'L' || e.key === 'д' || e.key === 'Д') {
      state.lightbarManual = !state.lightbarManual; updateLightbar(); return;
    }
    const id = MODE_ORDER.find((k) => MODES[k].key === e.key);
    if (id && !MODES[id].momentary) toggleMode(id);
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') releaseMomentary('airhorn');
    if (e.key === 'm' || e.key === 'M' || e.key === 'ь' || e.key === 'Ь') releaseMomentary('mik');
  });

  document.addEventListener('visibilitychange', () => { if (document.hidden) stopAll(); });
}

function meter() {
  const canvas = $('#meter');
  const ctx2d = canvas.getContext('2d');
  let data = null;
  const loop = () => {
    requestAnimationFrame(loop);
    const w = canvas.width = canvas.clientWidth * devicePixelRatio;
    const h = canvas.height = canvas.clientHeight * devicePixelRatio;
    ctx2d.clearRect(0, 0, w, h);
    let level = 0;
    if (rig.ready && rig.analyser) {
      if (!data || data.length !== rig.analyser.fftSize) data = new Uint8Array(rig.analyser.fftSize);
      rig.analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (const v of data) { const x = (v - 128) / 128; sum += x * x; }
      level = Math.sqrt(sum / data.length) * 1.6;
    }
    const bars = 48;
    for (let i = 0; i < bars; i++) {
      const frac = i / bars;
      const on = level > frac * 0.85;
      const bh = h * (0.25 + 0.75 * frac);
      ctx2d.fillStyle = on
        ? (frac > 0.85 ? '#ff3b46' : frac > 0.6 ? '#ffc14d' : '#3fd07a')
        : 'rgba(255,255,255,0.06)';
      ctx2d.fillRect((i * w) / bars + 1, (h - bh) / 2, w / bars - 2, bh);
    }
  };
  loop();
}

buildUI();
bind();
renderOwn().catch(() => {});
meter();
syncButtons();

if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = () => {};
