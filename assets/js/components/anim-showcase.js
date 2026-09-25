import { loadJSON } from '../lib/data-loader.js';
import { wordmark } from '../lib/wordmark.js';

/**
 * <anim-showcase src="data/showcase.json"></anim-showcase>
 *
 * A self-running loop through the sample library (built by
 * scripts/build_showcase.py), laid out left to right:
 *
 *   [ source diagram ] ─┐
 *                        ├─▶ [ engine chip ] ─▶ [ output animation ]
 *   [ animation style ] ─┘
 *
 * Styles take turns. For each turn a figure is taken from the queue, its
 * style lights up, the figure and a style tag travel into the engine's
 * input pins, the three modules on the engine's rail light up while the
 * frames preload, and the output window — lit in the style's colour —
 * plays the frames in sync with their narration. When a narrative ends
 * the next figure is taken automatically. Viewers only control playback.
 */
const IMAGE_FLIGHT_MS = 2300;
const STYLE_DELAY_MS = 1100;
const STYLE_FLIGHT_MS = 2100;
const PROGRESS_MS = 5600;
const OUTPUT_FLIGHT_MS = 1200;
const END_HOLD_MS = 1800;
const QUEUE_SIZE = 5;
const HISTORY_MAX = 30;
const CACHE_SAMPLES = 4;
const SPEEDS = [1, 1.5, 2];
const LOGO = 'assets/img/logo.png';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const f1 = (v) => v.toFixed(1);
const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const shuffle = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const stroke = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l12 7-12 7z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="5" width="4" height="14" rx="1.2" fill="currentColor"/><rect x="13.5" y="5" width="4" height="14" rx="1.2" fill="currentColor"/></svg>',
  prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 6v12l-8.5-6z" fill="currentColor"/><path d="M11 6v12l-8.5-6z" fill="currentColor"/></svg>',
  next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6v12l8.5-6z" fill="currentColor"/><path d="M13 6v12l8.5-6z" fill="currentColor"/></svg>',
  expand: stroke('<path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/>'),
  shrink: stroke('<path d="M4 14h6v6M20 10h-6V4M10 14l-7 7M14 10l7-7"/>'),
  zoom: stroke('<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L20 20M10.5 7.5v6M7.5 10.5h6"/>'),
  close: stroke('<path d="M6 6l12 12M18 6L6 18"/>'),
};

/* Gear drawn like the chip icon: ink outline, white body, accent hub. */
const GEAR = `<svg class="as-gear" viewBox="0 0 64 64" aria-hidden="true">
  <path class="as-gear-body" d="M27 4h10l1.6 7.2a21 21 0 0 1 5.5 2.3l6.2-4 7 7-4 6.2a21 21 0 0 1 2.3 5.5L63 29.8v10l-7.2 1.6a21 21 0 0 1-2.3 5.5l4 6.2-7 7-6.2-4a21 21 0 0 1-5.5 2.3L37 65.6H27l-1.6-7.2a21 21 0 0 1-5.5-2.3l-6.2 4-7-7 4-6.2a21 21 0 0 1-2.3-5.5L1 39.8v-10l7.4-1.6a21 21 0 0 1 2.3-5.5l-4-6.2 7-7 6.2 4a21 21 0 0 1 5.5-2.3z" transform="translate(0 -1) scale(1 .97)"/>
  <circle class="as-gear-hub" cx="32" cy="33" r="9.5"/>
</svg>`;

const STAGES = ['Diagram Transmuter', 'Animation Planner', 'Diagram Animator'];
const MODULE_ICONS = [
  stroke('<path d="M8 8l-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14"/>'),
  stroke('<rect x="5" y="4.5" width="14" height="16.5" rx="2"/><path d="M9 3h6v3H9zM8.5 11.5l2 2 3.5-4M8.5 17h7"/>'),
  stroke('<rect x="3" y="4.5" width="18" height="15" rx="3"/><path d="M10 9l5 3-5 3z"/>'),
];

const MINI = (kind) => `<svg class="as-mini as-mini-${kind}" viewBox="0 0 64 24" aria-hidden="true">
  <path class="as-mini-edge" d="M17 12h8M39 12h8"/>
  <rect class="as-mini-b b1" x="4" y="6" width="13" height="12" rx="3"/>
  <rect class="as-mini-b b2" x="25" y="6" width="14" height="12" rx="3"/>
  <rect class="as-mini-b b3" x="47" y="6" width="13" height="12" rx="3"/>
  <rect class="as-mini-focus" x="1.5" y="3.5" width="18" height="17" rx="4"/>
</svg>`;

const pins = (side, count, ports = {}) =>
  `<span class="as-pins as-pins-${side}" aria-hidden="true">${
    Array.from({ length: count }, (_, i) => `<i${ports[i] ? ` data-port="${ports[i]}"` : ''}></i>`).join('')
  }</span>`;

class AnimShowcase extends HTMLElement {
  async connectedCallback() {
    this.innerHTML = '<p class="as-loading hand">warming up the projector…</p>';
    const data = await loadJSON(this.getAttribute('src') || 'data/showcase.json');

    this.styles = data.styles;
    this.styleById = Object.fromEntries(this.styles.map((s) => [s.id, s]));
    this.pool = Object.fromEntries(this.styles.map((s) => [s.id, data.samples.filter((x) => x.style === s.id)]));
    this.order = this.styles.map((s) => s.id).filter((id) => this.pool[id].length);
    this.decks = Object.fromEntries(this.order.map((id) => [id, []]));
    this.turn = Math.floor(Math.random() * this.order.length);

    this.queue = [];
    this.history = [];
    this.hIndex = -1;
    this.token = 0;
    this.phase = 'idle';
    this.paused = false;
    this.offscreen = true;
    this.time = 0;
    this.speedIndex = 0;
    this.frameCache = new Map();
    this.cachedSamples = [];
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

    // `first` names the sample the demo opens on; the rest cycle as usual.
    const opener = data.samples.find((x) => x.id === data.first);
    if (opener) this.queue.push(opener);
    this.fillQueue();
    this.renderShell();
    this.r = {};
    this.querySelectorAll('[data-ref]').forEach((el) => (this.r[el.dataset.ref] = el));
    this.root = this.querySelector('.as');
    this.modEls = [...this.r.track.querySelectorAll('.as-mod')];
    this.bind();
    this.watch();
  }

  disconnectedCallback() {
    this.stopClock();
    cancelAnimationFrame(this.progRaf);
    clearTimeout(this.endTimer);
    this.io?.disconnect();
    this.ro?.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibility);
    document.removeEventListener('fullscreenchange', this.onFullscreen);
  }

  /* ------------------------------------------------------------ markup */

  renderShell() {
    this.innerHTML = `
      <div class="as">
        <div class="as-grid" data-ref="grid">
          <svg class="as-wires" data-ref="wires" aria-hidden="true"></svg>
          <div class="as-packets" data-ref="packets" aria-hidden="true"></div>

          <div class="as-col-in">
            <section class="as-card as-source" data-ref="sourceCard" aria-label="Source diagram">
              <header class="as-head">
                <h3 class="as-label">Source diagram</h3>
                <span class="as-id" data-ref="sourceId">—</span>
                <button type="button" class="as-icon-btn" data-act="lightbox" aria-label="View the source diagram full size" title="View full size">${ICON.zoom}</button>
              </header>
              <button type="button" class="as-source-view" data-act="lightbox" data-ref="sourceView" aria-label="View the source diagram full size">
                <span class="as-scan" data-ref="scan"></span>
                <span class="as-view-hint">${ICON.zoom}View full size</span>
              </button>
              <div class="as-queue-wrap">
                <span class="as-sublabel">Up next</span>
                <ol class="as-queue" data-ref="queue"></ol>
              </div>
            </section>

            <section class="as-card as-stylecard" data-ref="styleCard" aria-label="Animation style, picked automatically">
              <header class="as-head">
                <h3 class="as-label">Animation style</h3>
                <span class="as-auto"><i></i>Auto-selected</span>
              </header>
              <ul class="as-styles">
                ${this.styles.map((s) => `
                  <li class="as-style" data-style="${s.id}" style="--sc:${s.color}">
                    <span class="as-swatch"></span>
                    <span class="as-style-text">
                      <span class="as-style-name">${esc(s.label)}</span>
                      <span class="as-style-blurb">${esc(s.blurb)}</span>
                    </span>
                    ${MINI(s.id)}
                  </li>`).join('')}
              </ul>
            </section>
          </div>

          <div class="as-engine-slot">
            <div class="as-engine" data-ref="engine">
              ${pins('l', 5, { 1: 'in-figure', 3: 'in-style' })}
              ${pins('r', 5, { 2: 'out' })}
              ${pins('t', 4)}
              ${pins('b', 4)}
              <div class="as-chip">
                <img class="as-engine-logo" src="${LOGO}" alt="" width="1536" height="1024">
                ${wordmark('as-eng-name')}
              </div>
              <div class="as-track" data-ref="track" role="progressbar" aria-label="Pipeline progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
                <div class="as-rail"><div class="as-rail-fill"></div></div>
                ${STAGES.map((name, i) => `
                  <div class="as-mod" style="--x:${((i * 2 + 1) / 6).toFixed(4)}">
                    <span class="as-mod-node">${MODULE_ICONS[i]}</span>
                    <span class="as-mod-name">${name.replace(' ', '<br>')}</span>
                  </div>`).join('')}
              </div>
              <div class="as-eng-status"><span class="as-eng-led"></span><span data-ref="pct">Standing by</span></div>
              ${GEAR}
            </div>
          </div>

          <div class="as-out-wrap" data-ref="outWrap">
            <section class="as-card as-output" data-ref="outputCard" aria-label="Output animation">
              <header class="as-head">
                <h3 class="as-label">Output animation</h3>
                <span class="as-badge" data-ref="badge"></span>
                <span class="as-id" data-ref="outId"></span>
              </header>
              <div class="as-stage" data-ref="stage">
                <img class="as-frame" data-ref="frame" alt="">
                <div class="as-rendering">
                  <span class="as-dots"><i></i><i></i><i></i></span>
                  <span data-ref="renderText">Rendering…</span>
                </div>
              </div>
              <div class="as-caption">
                <span class="as-quote" aria-hidden="true">“</span>
                <p data-ref="captionText" aria-live="polite"></p>
              </div>
              <div class="as-controls">
                <div class="as-transport">
                  <button type="button" class="as-btn as-skip" data-act="prev" data-note="prev" aria-label="Previous animation" title="Previous animation (←)">${ICON.prev}</button>
                  <button type="button" class="as-btn as-play" data-act="play" data-note="play" data-ref="playBtn" aria-label="Pause" title="Play / pause (Space)">${ICON.pause}</button>
                  <button type="button" class="as-btn as-skip" data-act="next" data-note="next" aria-label="Next animation" title="Next animation (→)">${ICON.next}</button>
                </div>
                <div class="as-scrub" data-ref="scrub" role="slider" tabindex="0" aria-label="Narration timeline" aria-valuemin="0">
                  <div class="as-track-bar"><div class="as-fill" data-ref="fill"></div><div data-ref="ticks"></div></div>
                  <div class="as-knob" data-ref="knob"></div>
                </div>
                <span class="as-time" data-ref="time">0:00 / 0:00</span>
                <button type="button" class="as-pill" data-act="speed" data-note="speed" data-ref="speedBtn" aria-label="Playback speed: 1×" title="Playback speed">1×</button>
                <button type="button" class="as-btn" data-act="fullscreen" data-note="fs" data-ref="fsBtn" aria-label="Full screen" title="Full screen (F)">${ICON.expand}</button>
              </div>
            </section>
            <svg class="as-note-arrows" data-ref="noteArrows" aria-hidden="true"></svg>
            <div class="as-notes" data-ref="notes" aria-hidden="true">
              <span class="as-note" data-for="prev">previous animation</span>
              <span class="as-note" data-for="play">play / pause</span>
              <span class="as-note" data-for="next">skip to the next one!</span>
              <span class="as-note" data-for="speed">speed it up</span>
              <span class="as-note" data-for="fs">go full screen</span>
            </div>
          </div>
        </div>

        <dialog class="as-lightbox" data-ref="lightbox" aria-label="Source diagram, full size">
          <div class="as-lb-card">
            <header class="as-lb-head">
              <span class="as-label">Source diagram</span>
              <span class="as-id" data-ref="lbId"></span>
              <button type="button" class="as-icon-btn" data-act="close-lightbox" aria-label="Close">${ICON.close}</button>
            </header>
            <div class="as-lb-body"><img data-ref="lbImg" alt=""></div>
          </div>
        </dialog>
      </div>`;
  }

  renderQueue() {
    this.r.queue.innerHTML = this.queue.map((s) => `
      <li style="--qc:${this.styleById[s.style].color}" title="${esc(this.styleById[s.style].label)}">
        ${s.original ? `<img src="${esc(s.original)}" alt="" loading="lazy" decoding="async">` : ''}
      </li>`).join('');
    if (this.reduced) return;
    [...this.r.queue.children].forEach((li, i) => {
      li.animate([{ opacity: 0, transform: 'translateX(16px)' }, { opacity: 1, transform: 'none' }],
        { duration: 480, delay: i * 60, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' });
    });
  }

  renderTicks() {
    const s = this.sample;
    const starts = [];
    let last = -1;
    for (const [, t, g] of s.frames) {
      if (g !== last && t > 0) starts.push(t);
      last = g;
    }
    this.r.ticks.innerHTML = starts.map((t) => `<span class="as-tick-mark" style="left:${(t / s.duration) * 100}%"></span>`).join('');
    this.r.scrub.setAttribute('aria-valuemax', s.duration.toFixed(1));
  }

  /* ------------------------------------------------------------ queue & flow */

  fillQueue() {
    while (this.queue.length < QUEUE_SIZE) {
      const style = this.order[this.turn++ % this.order.length];
      if (!this.decks[style].length) this.decks[style] = shuffle([...this.pool[style]]);
      this.queue.push(this.decks[style].pop());
    }
  }

  advance(dir) {
    clearTimeout(this.endTimer);
    this.stopClock();
    cancelAnimationFrame(this.progRaf);

    let sample;
    if (dir < 0) {
      if (this.hIndex <= 0) return this.seek(0);
      sample = this.history[--this.hIndex];
    } else if (this.hIndex < this.history.length - 1) {
      sample = this.history[++this.hIndex];
    } else {
      sample = this.queue.shift();
      this.fillQueue();
      this.history.push(sample);
      if (this.history.length > HISTORY_MAX) this.history.shift();
      this.hIndex = this.history.length - 1;
    }
    this.load(sample, ++this.token);
  }

  async load(sample, token) {
    const style = this.styleById[sample.style];
    const alive = () => token === this.token;
    this.phase = 'ingest';
    this.sample = null;
    this.current = sample;

    this.root.style.setProperty('--ac', style.color);
    this.root.classList.add('is-busy');
    this.setProgress(0);
    this.r.pct.textContent = 'Receiving figure…';
    this.styleCardLight(style.id);
    this.showSource(sample);
    this.renderQueue();
    this.r.badge.textContent = style.label;
    this.r.outId.textContent = sample.id;
    this.r.renderText.textContent = `Rendering ${style.label}…`;
    this.r.stage.classList.add('is-rendering');
    this.r.captionText.textContent = '';
    this.r.ticks.innerHTML = '';
    this.r.fill.style.width = '0%';
    this.r.knob.style.left = '0%';
    this.r.time.textContent = `0:00 / ${fmt(sample.duration)}`;

    const figure = this.fly(0, sample.original ? `<img src="${esc(sample.original)}" alt="">` : '', 'as-packet-img', IMAGE_FLIGHT_MS);
    this.preload(sample, token);
    if (!this.reduced) await wait(STYLE_DELAY_MS);
    if (!alive()) return;
    this.r.pct.textContent = `Receiving style · ${style.label}`;
    const tag = this.fly(1, `<span>${esc(style.label)}</span>`, 'as-packet-chip', STYLE_FLIGHT_MS);
    await Promise.all([figure, tag]);
    if (!alive()) return;

    await this.runProgress(token);
    if (!alive()) return;
    this.r.pct.textContent = 'Sending to output…';
    await this.fly(2, '<i></i>', 'as-packet-dot', OUTPUT_FLIGHT_MS);
    if (!alive()) return;
    this.enterPlayback(sample);
  }

  preload(sample, token) {
    const urls = sample.frames.map(([file]) => sample.dir + file);
    let done = 0;
    this.loadFrac = 0;
    this.images = urls.map((url) => {
      let img = this.frameCache.get(url);
      if (!img) {
        img = new Image();
        img.decoding = 'async';
        img.src = url;
        this.frameCache.set(url, img);
      }
      const settle = () => {
        done += 1;
        if (token === this.token) this.loadFrac = done / urls.length;
      };
      if (img.complete) settle();
      else {
        img.addEventListener('load', settle, { once: true });
        img.addEventListener('error', settle, { once: true });
      }
      return img;
    });

    this.cachedSamples = this.cachedSamples.filter((s) => s !== sample);
    this.cachedSamples.push(sample);
    while (this.cachedSamples.length > CACHE_SAMPLES) {
      const old = this.cachedSamples.shift();
      old.frames.forEach(([file]) => this.frameCache.delete(old.dir + file));
    }
  }

  runProgress(token) {
    return new Promise((resolve) => {
      const start = performance.now();
      const dur = this.reduced ? 400 : PROGRESS_MS;
      const tick = (now) => {
        if (token !== this.token) return resolve();
        const p = Math.min((now - start) / dur, this.loadFrac);
        this.setProgress(p);
        if (p >= 1) return resolve();
        this.progRaf = requestAnimationFrame(tick);
      };
      this.progRaf = requestAnimationFrame(tick);
    });
  }

  setProgress(p) {
    this.r.track.style.setProperty('--p', p.toFixed(4));
    this.modEls.forEach((mod, i) => {
      mod.classList.toggle('is-reached', p >= (2 * i + 1) / 6);
      mod.classList.toggle('is-active', p > i / 3 && p < (i + 1) / 3);
      mod.classList.toggle('is-done', p >= (i + 1) / 3);
    });
    this.r.track.setAttribute('aria-valuenow', String(Math.round(p * 100)));
    if (p > 0) this.r.pct.textContent = p >= 1 ? 'Rendered' : `${STAGES[Math.min(2, Math.floor(p * 3))]} · ${Math.round(p * 100)}%`;
  }

  enterPlayback(sample) {
    this.sample = sample;
    this.phase = 'play';
    this.time = 0;
    this.lastFrame = -1;
    this.lastGroup = -1;
    this.root.classList.remove('is-busy');
    this.r.stage.classList.remove('is-rendering');
    this.renderTicks();
    this.renderAt(0);
    if (!this.reduced) {
      this.r.outputCard.animate(
        [{ boxShadow: '0 0 0 0 var(--ac)' }, { boxShadow: '0 0 0 18px transparent' }],
        { duration: 800, easing: 'ease-out' }
      );
    }
    this.r.pct.textContent = 'Now playing';
    this.resume();
  }

  /* ------------------------------------------------------------ playback */

  get speed() { return SPEEDS[this.speedIndex]; }

  resume() {
    this.syncPlay();
    if (this.paused || this.offscreen) return;
    if (this.phase === 'play') this.startClock();
    else if (this.phase === 'ended') this.advance(1);
  }

  startClock() {
    if (this.clockRaf || !this.sample) return;
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      this.time += dt * this.speed;
      if (this.time >= this.sample.duration) {
        this.time = this.sample.duration;
        this.renderAt(this.time);
        this.clockRaf = null;
        return this.onEnded();
      }
      this.renderAt(this.time);
      this.clockRaf = requestAnimationFrame(tick);
    };
    this.clockRaf = requestAnimationFrame(tick);
  }

  stopClock() {
    cancelAnimationFrame(this.clockRaf);
    this.clockRaf = null;
  }

  onEnded() {
    this.phase = 'ended';
    this.endTimer = setTimeout(() => {
      if (!this.paused && !this.offscreen) this.advance(1);
    }, END_HOLD_MS);
  }

  seek(t) {
    if (!this.sample) return;
    clearTimeout(this.endTimer);
    this.stopClock();
    this.time = clamp(t, 0, this.sample.duration);
    this.phase = 'play';
    this.renderAt(this.time);
    if (!this.scrubbing) this.resume();
  }

  togglePlay() {
    this.paused = !this.paused;
    if (this.paused) {
      this.stopClock();
      clearTimeout(this.endTimer);
      this.syncPlay();
    } else {
      this.resume();
    }
  }

  cycleSpeed() {
    this.speedIndex = (this.speedIndex + 1) % SPEEDS.length;
    const label = `${this.speed}×`;
    this.r.speedBtn.textContent = label;
    this.r.speedBtn.setAttribute('aria-label', `Playback speed: ${label}`);
    this.r.speedBtn.classList.toggle('is-fast', this.speed > 1);
  }

  syncPlay() {
    const playing = !this.paused;
    this.r.playBtn.innerHTML = playing ? ICON.pause : ICON.play;
    this.r.playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    this.root.classList.toggle('is-paused', !playing);
  }

  renderAt(t) {
    const s = this.sample;
    const frames = s.frames;
    let i = 0;
    while (i + 1 < frames.length && frames[i + 1][1] <= t) i++;

    if (i !== this.lastFrame) {
      this.r.frame.src = this.images[i]?.src || s.dir + frames[i][0];
      this.lastFrame = i;
    }
    const g = frames[i][2];
    if (g !== this.lastGroup) {
      this.lastGroup = g;
      this.r.captionText.textContent = s.captions[g];
      if (!this.reduced) {
        this.r.captionText.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }],
          { duration: 420, easing: 'cubic-bezier(.22,1,.36,1)' });
      }
    }

    const frac = s.duration ? t / s.duration : 0;
    this.r.fill.style.width = `${frac * 100}%`;
    this.r.knob.style.left = `${frac * 100}%`;
    this.r.time.textContent = `${fmt(t)} / ${fmt(s.duration)}`;
    this.r.scrub.setAttribute('aria-valuenow', t.toFixed(1));
    this.r.scrub.setAttribute('aria-valuetext', `${fmt(t)} of ${fmt(s.duration)}`);
  }

  /* ------------------------------------------------------------ source & style */

  showSource(sample) {
    const view = this.r.sourceView;
    const old = view.querySelectorAll('img');
    this.r.sourceId.textContent = sample.id;
    if (sample.original) {
      const img = document.createElement('img');
      img.src = sample.original;
      img.alt = `Original figure ${sample.id}`;
      view.append(img);
      if (!this.reduced) img.animate([{ opacity: 0, transform: 'scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 600, easing: 'ease-out' });
    }
    setTimeout(() => old.forEach((el) => el.remove()), this.reduced ? 0 : 600);
    if (!this.reduced) {
      this.r.scan.animate([{ top: '-45%', opacity: 0 }, { opacity: 1, offset: 0.15 }, { top: '105%', opacity: 0.9 }],
        { duration: 1800, easing: 'cubic-bezier(.45,0,.3,1)' });
    }
  }

  styleCardLight(id) {
    this.querySelectorAll('.as-style').forEach((li) => {
      const on = li.dataset.style === id;
      li.classList.toggle('is-active', on);
      if (on) li.setAttribute('aria-current', 'true');
      else li.removeAttribute('aria-current');
    });
  }

  openLightbox() {
    const s = this.current;
    if (!s?.original) return;
    this.r.lbImg.src = s.original;
    this.r.lbImg.alt = `Original figure ${s.id}`;
    this.r.lbId.textContent = s.id;
    this.lightboxPaused = !this.paused;
    if (this.lightboxPaused) this.togglePlay();
    this.r.lightbox.showModal();
  }

  closeLightbox() {
    if (this.r.lightbox.open) this.r.lightbox.close();
    if (this.lightboxPaused) {
      this.lightboxPaused = false;
      if (this.paused) this.togglePlay();
    }
  }

  toggleFullscreen() {
    const card = this.r.outputCard;
    if (!card.requestFullscreen) {
      card.classList.toggle('is-pseudo-full');
      document.documentElement.classList.toggle('nd-lock', card.classList.contains('is-pseudo-full'));
      return this.syncFullscreen();
    }
    if (document.fullscreenElement) document.exitFullscreen();
    else card.requestFullscreen();
  }

  syncFullscreen() {
    const card = this.r.outputCard;
    const on = document.fullscreenElement === card || card.classList.contains('is-pseudo-full');
    this.r.fsBtn.innerHTML = on ? ICON.shrink : ICON.expand;
    this.r.fsBtn.setAttribute('aria-label', on ? 'Exit full screen' : 'Full screen');
    this.placeNotes();
  }

  /* ------------------------------------------------------------ wires, packets, notes */

  drawWires() {
    const svg = this.r.wires;
    if (getComputedStyle(svg).display === 'none') { svg.innerHTML = ''; this.paths = null; return; }
    const G = this.r.grid.getBoundingClientRect();
    const box = (el) => {
      const r = el.getBoundingClientRect();
      return { l: r.left - G.left, r: r.right - G.left, cy: r.top - G.top + r.height / 2 };
    };
    // Pin terminals sit just beyond the outer end of each lead.
    const port = (name) => {
      const pin = this.r.engine.querySelector(`[data-port="${name}"]`);
      const r = pin.getBoundingClientRect();
      const left = pin.parentElement.classList.contains('as-pins-l');
      return { x: (left ? r.left : r.right) - G.left + (left ? -12 : 12), y: r.top - G.top + r.height / 2 };
    };
    const src = box(this.r.sourceCard);
    const sty = box(this.r.styleCard);
    const out = box(this.r.outputCard);
    const inFig = port('in-figure');
    const inSty = port('in-style');
    const outP = port('out');
    const g = 14;
    const curve = (x1, y1, x2, y2) => {
      const mx = (x1 + x2) / 2;
      return `M${f1(x1)} ${f1(y1)} C${f1(mx)} ${f1(y1)} ${f1(mx)} ${f1(y2)} ${f1(x2)} ${f1(y2)}`;
    };
    const head = (x, y) => `M${f1(x - 10)} ${f1(y - 7)}L${f1(x)} ${f1(y)}L${f1(x - 10)} ${f1(y + 7)}`;
    const wires = [
      [src.r + g, src.cy, inFig.x, inFig.y],
      [sty.r + g, sty.cy, inSty.x, inSty.y],
      [outP.x, outP.y, out.l - g, out.cy],
    ];
    svg.setAttribute('viewBox', `0 0 ${f1(G.width)} ${f1(G.height)}`);
    svg.innerHTML = wires.map(([x1, y1, x2, y2]) => {
      const d = curve(x1, y1, x2, y2);
      return `<g class="as-wire">
        <path class="as-wire-track" d="${d}"/>
        <path class="as-wire-flow" d="${d}"/>
        <circle class="as-wire-start" cx="${f1(x1)}" cy="${f1(y1)}" r="5"/>
        <path class="as-wire-head" d="${head(x2, y2)}"/>
      </g>`;
    }).join('');
    this.paths = [...svg.querySelectorAll('.as-wire-track')];
  }

  fly(index, html, className, duration) {
    const path = this.paths?.[index];
    if (this.reduced || !path || this.offscreen) return Promise.resolve();
    const el = document.createElement('div');
    el.className = `as-packet ${className}`;
    el.innerHTML = html;
    this.r.packets.append(el);

    const L = path.getTotalLength();
    const N = 36;
    const keyframes = [];
    for (let k = 0; k <= N; k++) {
      const pt = path.getPointAtLength((L * k) / N);
      const edge = k === 0 || k === N;
      keyframes.push({
        transform: `translate(${f1(pt.x)}px, ${f1(pt.y)}px) translate(-50%, -50%) scale(${edge ? 0.6 : 1})`,
        opacity: edge ? 0 : 1,
      });
    }
    const anim = el.animate(keyframes, { duration, easing: 'cubic-bezier(.45,.05,.3,1)' });
    // Animations stall in background tabs; never let the loop wait on one past its duration.
    const timeout = wait(duration + 150);
    return Promise.race([anim.finished.catch(() => {}), timeout]).then(() => el.remove());
  }

  /** Hand-written labels under the playback buttons, each with a drawn arrow. */
  placeNotes() {
    const svg = this.r.noteArrows;
    const notes = [...this.r.notes.children];
    if (getComputedStyle(this.r.notes).display === 'none' || document.fullscreenElement) { svg.innerHTML = ''; return; }

    const W = this.r.outWrap.getBoundingClientRect();
    const card = this.r.outputCard.getBoundingClientRect();
    const rowY = card.bottom - W.top + 50;
    const gap = 22;
    const items = notes.map((n) => {
      const b = this.r.outputCard.querySelector(`[data-note="${n.dataset.for}"]`).getBoundingClientRect();
      return { n, bx: b.left - W.left + b.width / 2, by: b.bottom - W.top, w: n.offsetWidth };
    }).sort((a, b) => a.bx - b.bx);

    let right = -Infinity;
    for (const it of items) {
      it.cx = Math.max(it.bx, right + gap + it.w / 2, it.w / 2);
      right = it.cx + it.w / 2;
    }
    let left = W.width;
    for (let k = items.length - 1; k >= 0; k--) {
      const it = items[k];
      it.cx = Math.min(it.cx, left - gap - it.w / 2);
      left = it.cx - it.w / 2;
    }

    svg.setAttribute('viewBox', `0 0 ${f1(W.width)} ${f1(W.height)}`);
    svg.innerHTML = items.map((it, i) => {
      it.n.style.left = `${f1(it.cx - it.w / 2)}px`;
      it.n.style.top = `${f1(rowY)}px`;
      it.n.style.setProperty('--tilt', `${i % 2 ? 2.5 : -2.5}deg`);

      const x1 = it.cx + clamp(it.bx - it.cx, -it.w * 0.3, it.w * 0.3);
      const y1 = rowY - 4;
      const x2 = it.bx;
      const y2 = it.by + 6;
      const bend = (i % 2 ? 1 : -1) * Math.max(18, Math.abs(x2 - x1) * 0.4);
      const mx = (x1 + x2) / 2 + bend;
      const my = (y1 + y2) / 2 + 8;
      const a = Math.atan2(y2 - my, x2 - mx);
      const hx1 = x2 - 11 * Math.cos(a - 0.5);
      const hy1 = y2 - 11 * Math.sin(a - 0.5);
      const hx2 = x2 - 11 * Math.cos(a + 0.5);
      const hy2 = y2 - 11 * Math.sin(a + 0.5);
      return `<path d="M${f1(x1)} ${f1(y1)} Q${f1(mx)} ${f1(my)} ${f1(x2)} ${f1(y2)}"/>
              <path d="M${f1(hx1)} ${f1(hy1)} L${f1(x2)} ${f1(y2)} L${f1(hx2)} ${f1(hy2)}"/>`;
    }).join('');
  }

  /* ------------------------------------------------------------ events */

  bind() {
    this.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const act = b.dataset.act;
      if (act === 'play') this.togglePlay();
      else if (act === 'next') this.advance(1);
      else if (act === 'prev') {
        if (this.sample && this.time > 3) this.seek(0);
        else this.advance(-1);
      } else if (act === 'speed') this.cycleSpeed();
      else if (act === 'fullscreen') this.toggleFullscreen();
      else if (act === 'lightbox') this.openLightbox();
      else if (act === 'close-lightbox') this.closeLightbox();
    });

    this.r.lightbox.addEventListener('click', (e) => {
      if (e.target === this.r.lightbox) this.closeLightbox();
    });
    this.r.lightbox.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      this.closeLightbox();
    });
    // Any other way the dialog closes still resumes playback (idempotent).
    this.r.lightbox.addEventListener('close', () => this.closeLightbox());

    this.addEventListener('keydown', (e) => {
      if (this.r.lightbox.open) return;
      if (e.key === ' ' && !e.target.closest('button')) { e.preventDefault(); this.togglePlay(); }
      else if (e.key === 'ArrowRight' && e.target === this.r.scrub) { e.preventDefault(); this.seek(this.time + 1); }
      else if (e.key === 'ArrowLeft' && e.target === this.r.scrub) { e.preventDefault(); this.seek(this.time - 1); }
      else if (e.key === 'ArrowRight') this.advance(1);
      else if (e.key === 'ArrowLeft') this.advance(-1);
      else if (e.key === 'f' || e.key === 'F') this.toggleFullscreen();
    });

    const scrub = this.r.scrub;
    const timeAt = (e) => {
      const r = scrub.getBoundingClientRect();
      return clamp((e.clientX - r.left) / r.width, 0, 1) * (this.sample?.duration || 0);
    };
    scrub.addEventListener('pointerdown', (e) => {
      if (!this.sample) return;
      scrub.setPointerCapture(e.pointerId);
      this.scrubbing = true;
      scrub.classList.add('is-dragging');
      this.seek(timeAt(e));
    });
    scrub.addEventListener('pointermove', (e) => { if (this.scrubbing) this.seek(timeAt(e)); });
    const end = () => {
      if (!this.scrubbing) return;
      this.scrubbing = false;
      scrub.classList.remove('is-dragging');
      this.resume();
    };
    scrub.addEventListener('pointerup', end);
    scrub.addEventListener('pointercancel', end);

    this.onFullscreen = () => this.syncFullscreen();
    document.addEventListener('fullscreenchange', this.onFullscreen);
  }

  watch() {
    const setOffscreen = (off) => {
      this.offscreen = off;
      if (off) {
        this.stopClock();
        clearTimeout(this.endTimer);
      } else if (!this.started) {
        this.started = true;
        this.advance(1);
      } else {
        this.resume();
      }
    };
    this.io = new IntersectionObserver(([entry]) => setOffscreen(!entry.isIntersecting || document.hidden), { threshold: 0.15 });
    this.io.observe(this.r.grid);
    this.onVisibility = () => setOffscreen(document.hidden);
    document.addEventListener('visibilitychange', this.onVisibility);

    const layout = () => { this.drawWires(); this.placeNotes(); };
    this.ro = new ResizeObserver(layout);
    this.ro.observe(this.r.grid);
    this.querySelectorAll('img').forEach((img) => img.addEventListener('load', layout, { once: true }));
    document.fonts?.ready.then(layout);
    layout();
  }
}
customElements.define('anim-showcase', AnimShowcase);
