import { loadJSON } from '../lib/data-loader.js';

/**
 * <demo-studio src="data/demo.json"></demo-studio>
 *
 * Wide, three-column demo of the system: source diagram + style picker on
 * the left, the AnimateBanana engine in the middle, the output animation on
 * the right, joined by flowing wires. Switching a figure, style, or
 * narration level runs the three pipeline stages visibly, then plays.
 *
 * Everything in the output is derived from one timeline value, so it can be
 * scrubbed, stepped, sped up, and looped:
 *   time → beat index (narration `t`) → which data-order elements are
 *   shown / current → per-style classes, focus-box geometry, typed caption.
 * Beats map onto element orders proportionally; Hopping/Sliding Box draw a
 * real overlay rect sized from getBBox() unions of each beat's elements.
 */
const TAIL_SECONDS = 5;
const TYPE_RATE = 0.026;
const ZOOM_MAX = 5;
const STAGE_MS = 520;
const SVG_NS = 'http://www.w3.org/2000/svg';
const LOGO = 'assets/img/logo.png';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const stroke = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 4.5l12.5 7.5-12.5 7.5z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="4.5" width="4.2" height="15" rx="1.2" fill="currentColor"/><rect x="13.8" y="4.5" width="4.2" height="15" rx="1.2" fill="currentColor"/></svg>',
  prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.5 5v14L9 12z" fill="currentColor"/><rect x="5" y="5" width="2.6" height="14" rx="1" fill="currentColor"/></svg>',
  next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 5v14L15 12z" fill="currentColor"/><rect x="16.4" y="5" width="2.6" height="14" rx="1" fill="currentColor"/></svg>',
  restart: stroke('<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4.5h4.5"/>'),
  loop: stroke('<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12"/><path d="M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/>'),
  zoomIn: stroke('<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L20 20M10.5 7.5v6M7.5 10.5h6"/>'),
  zoomOut: stroke('<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L20 20M7.5 10.5h6"/>'),
  fit: stroke('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  compare: stroke('<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M12 2v20"/>'),
  expand: stroke('<path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/>'),
  shrink: stroke('<path d="M4 14h6v6M20 10h-6V4M10 14l-7 7M14 10l7-7"/>'),
  captions: stroke('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M7 11h4M13 11h4M7 15h7"/>'),
  split: stroke('<path d="M9 7l-5 5 5 5M15 7l5 5-5 5"/>'),
  download: stroke('<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14"/>'),
};

const MINI = (kind) => `<svg class="ds-mini ds-mini-${kind}" viewBox="0 0 64 24" aria-hidden="true">
  <path class="ds-mini-edge" d="M17 12h8M39 12h8"/>
  <rect class="ds-mini-b b1" x="4" y="6" width="13" height="12" rx="3"/>
  <rect class="ds-mini-b b2" x="25" y="6" width="14" height="12" rx="3"/>
  <rect class="ds-mini-b b3" x="47" y="6" width="13" height="12" rx="3"/>
  <rect class="ds-mini-focus" x="1.5" y="3.5" width="18" height="17" rx="4"/>
</svg>`;

const STAGES = [
  { name: 'Diagram Transmuter', status: 'Transmuting the diagram…' },
  { name: 'Animation Planner', status: 'Planning the narration…' },
  { name: 'Diagram Animator', status: 'Animating the output…' },
];

const FORMATS = [
  ['PDF', 'Slide-by-slide handout'],
  ['SVG', 'Animated vector'],
  ['GIF', 'Looping image'],
  ['MP4', 'Narrated video'],
  ['PPTX', 'Editable slides'],
];

class DemoStudio extends HTMLElement {
  async connectedCallback() {
    this.innerHTML = '<p class="ds-loading hand">warming up the projector…</p>';
    const [config, examples] = await Promise.all([
      loadJSON(this.getAttribute('src') || 'data/demo.json'),
      loadJSON('data/examples.json'),
    ]);
    this.styles = config.styles;
    this.examples = config.examples
      .map((assets) => ({ ...examples.find((e) => e.id === assets.id), assets }))
      .filter((e) => e.title);
    this.s = {
      example: config.defaultExample || this.examples[0].id,
      style: config.defaultStyle || this.styles[0].id,
      granularity: 'standard',
      speed: 1, time: 0, playing: false, loop: true,
      captions: true, compare: false, split: 50,
      zoom: 1, px: 0, py: 0,
    };
    this.text = new Map();
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.renderShell();
    this.r = {};
    this.querySelectorAll('[data-ref]').forEach((el) => (this.r[el.dataset.ref] = el));
    this.root = this.querySelector('.ds');
    this.bind();
    this.setSpeed(1);
    this.renderFigures();
    await this.loadExample();
    this.syncPressed();
    this.seek(this.settle(0));
    this.watchLayout();
    this.watchAutoplay();
  }

  disconnectedCallback() {
    cancelAnimationFrame(this.raf);
    clearTimeout(this.pipeTimer);
    this.io?.disconnect();
    this.ro?.disconnect();
    document.removeEventListener('pointerdown', this.onDocPointer);
    document.removeEventListener('fullscreenchange', this.onFullscreen);
  }

  /* ------------------------------------------------------------ shell */

  renderShell() {
    const styleRows = this.styles.map((st) => `
      <button type="button" class="ds-style" role="radio" data-style="${st.id}" aria-checked="false">
        <span class="ds-radio" aria-hidden="true"></span>
        <span class="ds-style-text">
          <span class="ds-style-name">${esc(st.label)}</span>
          <span class="ds-style-blurb">${esc(st.blurb)}</span>
        </span>
        ${MINI(st.id)}
      </button>`).join('');

    this.innerHTML = `
      <div class="ds">
        <div class="ds-grid" data-ref="grid">
          <svg class="ds-wires" data-ref="wires" aria-hidden="true"></svg>

          <div class="ds-col ds-col-in">
            <section class="ds-card ds-source" data-ref="sourceCard" aria-label="Source diagram">
              <header class="ds-card-head">
                <h3 class="ds-label">Source diagram</h3>
                <span class="ds-file" data-ref="file">—</span>
              </header>
              <div class="ds-source-view" data-ref="sourceView"></div>
              <div class="ds-figs" data-ref="figs"></div>
            </section>

            <section class="ds-card ds-stylecard" data-ref="styleCard" aria-label="Animation style">
              <header class="ds-card-head">
                <h3 class="ds-label">Animation style</h3>
                <span class="ds-sub">Select &amp; switch</span>
              </header>
              <div class="ds-styles" role="radiogroup" aria-label="Animation style">${styleRows}</div>
              <div class="ds-narr">
                <span class="ds-label">Narration</span>
                <div class="ds-seg" role="radiogroup" aria-label="Narrative granularity">
                  ${['concise', 'standard', 'detailed'].map((g) => `<button type="button" role="radio" data-gran="${g}" aria-checked="false">${g[0].toUpperCase() + g.slice(1)}</button>`).join('')}
                </div>
                <p class="ds-note" data-ref="granNote"></p>
              </div>
            </section>
          </div>

          <div class="ds-col ds-col-engine">
            <div class="ds-engine" data-ref="engine">
              <img class="ds-engine-logo" src="${LOGO}" alt="" width="1536" height="1024">
              <div class="ds-engine-text">
                <div class="ds-engine-name">Animate<b>Banana</b></div>
                <div class="ds-engine-status" data-ref="engineStatus" aria-live="polite">Active agent pipeline</div>
              </div>
              <ol class="ds-stages" data-ref="stages">
                ${STAGES.map((st) => `<li><span class="ds-stage-dot"></span>${st.name}</li>`).join('')}
              </ol>
            </div>
          </div>

          <div class="ds-col ds-col-out">
            <section class="ds-card ds-output" data-ref="outputCard" aria-label="Output animation">
              <header class="ds-card-head">
                <h3 class="ds-label">Output animation</h3>
                <span class="ds-style-badge" data-ref="styleBadge"></span>
                <div class="ds-head-actions">
                  <button type="button" class="ds-ibtn" data-act="captions" aria-pressed="true" title="Narration captions">${I.captions}<span>Captions</span></button>
                  <button type="button" class="ds-ibtn" data-act="compare" aria-pressed="false" title="Compare with the original (C)">${I.compare}<span>Compare</span></button>
                  <button type="button" class="ds-ibtn" data-act="fullscreen" data-ref="fsBtn" aria-label="Full screen (F)" title="Full screen (F)">${I.expand}</button>
                  <div class="ds-dl">
                    <button type="button" class="ds-dl-btn" data-act="download" data-ref="dlBtn" aria-haspopup="true" aria-expanded="false">${I.download}<span>Download</span></button>
                    <div class="ds-dl-menu" data-ref="dlMenu" hidden>
                      ${FORMATS.map(([f, d]) => `<button type="button" class="ds-dl-item" disabled><b>${f}</b><span>${d}</span><em>soon</em></button>`).join('')}
                    </div>
                  </div>
                </div>
              </header>

              <div class="ds-canvas" data-ref="canvas" tabindex="0" aria-label="Animation canvas — drag to pan, Ctrl or ⌘ plus scroll to zoom">
                <div class="ds-view ds-view-static"><div class="ds-world" data-ref="worldStatic"></div></div>
                <div class="ds-view ds-view-anim"><div class="ds-world ds-anim" data-ref="worldAnim"></div></div>

                <div class="ds-split" data-ref="split" role="slider" tabindex="0" aria-label="Compare divider" aria-valuemin="5" aria-valuemax="95" aria-valuenow="50">
                  <span class="ds-split-knob">${I.split}</span>
                </div>
                <span class="ds-cmp-tag ds-cmp-l">Original</span>
                <span class="ds-cmp-tag ds-cmp-r">Animated</span>

                <span class="ds-beat-badge" data-ref="beatBadge">Beat 1</span>
                <span class="ds-hint" data-ref="hint">Drag to pan · Ctrl/⌘ + scroll to zoom · double-click to dive in</span>

                <div class="ds-zoom">
                  <button type="button" class="ds-ibtn" data-act="zoom-in" aria-label="Zoom in">${I.zoomIn}</button>
                  <span class="ds-zoom-val" data-ref="zoomVal">100%</span>
                  <button type="button" class="ds-ibtn" data-act="zoom-out" aria-label="Zoom out">${I.zoomOut}</button>
                  <button type="button" class="ds-ibtn" data-act="fit" aria-label="Reset view">${I.fit}</button>
                </div>

                <div class="ds-caption" data-ref="caption">
                  <img class="ds-avatar" src="${LOGO}" alt="" width="1536" height="1024">
                  <p aria-live="polite"><span data-ref="captionText"></span><i class="ds-caret" aria-hidden="true"></i></p>
                </div>
              </div>

              <div class="ds-transport">
                <div class="ds-buttons">
                  <button type="button" class="ds-ibtn" data-act="restart" aria-label="Restart">${I.restart}</button>
                  <button type="button" class="ds-ibtn" data-act="prev" aria-label="Previous beat">${I.prev}</button>
                  <button type="button" class="ds-play" data-act="play" data-ref="playBtn" aria-label="Play">${I.play}</button>
                  <button type="button" class="ds-ibtn" data-act="next" aria-label="Next beat">${I.next}</button>
                </div>
                <div class="ds-scrub" data-ref="scrub" role="slider" tabindex="0" aria-label="Timeline" aria-valuemin="0">
                  <div class="ds-track"><div class="ds-fill" data-ref="fill"></div><div data-ref="ticks"></div></div>
                  <div class="ds-head" data-ref="head"></div>
                  <div class="ds-tip" data-ref="tip"></div>
                </div>
                <span class="ds-time" data-ref="time">0:00 / 0:00</span>
                <button type="button" class="ds-ibtn" data-act="loop" data-ref="loopBtn" aria-pressed="true" title="Loop playback">${I.loop}</button>
                <div class="ds-speed" role="radiogroup" aria-label="Playback speed">
                  ${[0.5, 1, 1.5, 2].map((v) => `<button type="button" role="radio" data-speed="${v}" aria-checked="false">${v}×</button>`).join('')}
                </div>
              </div>

              <ol class="ds-beats" data-ref="beats" aria-label="Narration beats"></ol>
            </section>
          </div>
        </div>
        <p class="ds-keys"><kbd>Space</kbd>play <kbd>←</kbd><kbd>→</kbd>beats <kbd>C</kbd>compare <kbd>F</kbd>full screen <kbd>+</kbd><kbd>−</kbd>zoom</p>
      </div>`;
  }

  renderFigures() {
    this.r.figs.innerHTML = this.examples.map((ex) => `
      <button type="button" class="ds-fig" data-example="${ex.id}" aria-pressed="false" title="${esc(ex.title)}">
        <span class="ds-fig-thumb" data-thumb="${ex.id}"></span>
        <span class="ds-fig-title">${esc(ex.title)}</span>
      </button>`).join('');
    for (const ex of this.examples) {
      this.fetchText(`examples/${ex.id}/diagram.svg`)
        .then((svg) => { this.r.figs.querySelector(`[data-thumb="${ex.id}"]`).innerHTML = svg; })
        .catch(() => {});
    }
  }

  renderBeats() {
    this.r.beats.innerHTML = this.steps.map((st, i) => `
      <li><button type="button" class="ds-beat" data-beat="${i}">
        <span class="ds-beat-num num-outline">${i + 1}</span>
        <span class="ds-beat-time">${fmt(st.t)}</span>
        <span class="ds-beat-cap">${esc(st.caption)}</span>
        <span class="ds-beat-bar"></span>
      </button></li>`).join('');
    this.beatChips = [...this.r.beats.querySelectorAll('.ds-beat')];
    this.activeBeat = -1;
    this.r.ticks.innerHTML = this.steps.slice(1)
      .map((st) => `<span class="ds-tick" style="left:${(st.t / this.total) * 100}%"></span>`).join('');
    this.r.scrub.setAttribute('aria-valuemax', this.total.toFixed(1));
  }

  syncPressed() {
    this.querySelectorAll('[data-example]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.example === this.s.example)));
    this.querySelectorAll('[data-style]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.style === this.s.style)));
    this.querySelectorAll('[data-gran]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.gran === this.s.granularity)));
    this.querySelectorAll('[data-speed]').forEach((b) => b.setAttribute('aria-checked', String(Number(b.dataset.speed) === this.s.speed)));
  }

  /* ------------------------------------------------------------ wires */

  watchLayout() {
    this.ro = new ResizeObserver(() => this.drawWires());
    this.ro.observe(this.r.grid);
    this.querySelectorAll('img').forEach((img) => img.addEventListener('load', () => this.drawWires(), { once: true }));
    document.fonts?.ready.then(() => this.drawWires());
    this.drawWires();
  }

  drawWires() {
    const svg = this.r.wires;
    if (getComputedStyle(svg).display === 'none') { svg.innerHTML = ''; return; }
    const G = this.r.grid.getBoundingClientRect();
    const rel = (el) => {
      const r = el.getBoundingClientRect();
      return { l: r.left - G.left, r: r.right - G.left, cy: r.top - G.top + r.height / 2 };
    };
    const src = rel(this.r.sourceCard);
    const sty = rel(this.r.styleCard);
    const eng = rel(this.r.engine);
    const out = rel(this.r.outputCard);
    const gap = 12;
    const curve = (x1, y1, x2, y2) => {
      const mx = (x1 + x2) / 2;
      return `M${x1.toFixed(1)} ${y1.toFixed(1)} C${mx.toFixed(1)} ${y1.toFixed(1)} ${mx.toFixed(1)} ${y2.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
    };
    const wires = [
      [src.r + gap, src.cy, eng.l - gap, eng.cy - 22],
      [sty.r + gap, sty.cy, eng.l - gap, eng.cy + 22],
      [eng.r + gap, eng.cy, out.l - gap, out.cy],
    ];
    svg.setAttribute('viewBox', `0 0 ${G.width.toFixed(1)} ${G.height.toFixed(1)}`);
    svg.innerHTML = wires.map(([x1, y1, x2, y2]) => {
      const d = curve(x1, y1, x2, y2);
      return `<g class="ds-wire">
        <path class="ds-wire-track" d="${d}"/>
        <path class="ds-wire-flow" d="${d}"/>
        <circle class="ds-wire-end" cx="${x1.toFixed(1)}" cy="${y1.toFixed(1)}" r="4.5"/>
        <path class="ds-wire-arrow" d="M${(x2 - 8).toFixed(1)} ${(y2 - 5.5).toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}L${(x2 - 8).toFixed(1)} ${(y2 + 5.5).toFixed(1)}"/>
      </g>`;
    }).join('');
  }

  /* ------------------------------------------------------------ data */

  fetchText(url) {
    if (!this.text.has(url)) {
      this.text.set(url, fetch(url).then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${url}`);
        return r.text();
      }));
    }
    return this.text.get(url);
  }

  svgUrl(style) {
    const ex = this.current;
    return (style && ex.assets.svg?.[style]) || `examples/${ex.id}/diagram.svg`;
  }

  buildSteps() {
    const n = this.current.narration || {};
    const g = this.s.granularity;
    let steps = n[g];
    let note = '';
    if (!steps) {
      const std = n.standard || [];
      if (g === 'concise') {
        steps = [];
        for (let i = 0; i < std.length; i += 2) {
          steps.push({ t: std[i].t, caption: [std[i], std[i + 1]].filter(Boolean).map((x) => x.caption).join(' ') });
        }
        note = 'Concise plan derived from Standard for now.';
      } else {
        steps = std;
        if (g === 'detailed') note = 'Detailed plan coming soon — showing Standard.';
      }
    }
    this.steps = steps.length ? steps : [{ t: 0, caption: '' }];
    this.durs = this.steps.map((st, i) => (this.steps[i + 1]?.t ?? st.t + TAIL_SECONDS) - st.t);
    this.total = this.steps.at(-1).t + TAIL_SECONDS;
    this.r.granNote.textContent = note;
    this.renderBeats();
    if (this.els) this.computeRanges();
  }

  async loadExample() {
    this.current = this.examples.find((e) => e.id === this.s.example);
    this.els = null;
    this.buildSteps();
    const src = this.current.assets.sourceImage;
    const staticMarkup = src
      ? `<img src="${esc(src)}" alt="Original figure: ${esc(this.current.title)}">`
      : await this.fetchText(this.svgUrl(null));
    this.r.sourceView.innerHTML = staticMarkup;
    this.r.worldStatic.innerHTML = staticMarkup;
    this.r.file.textContent = `${this.current.id}.svg`;
    this.setView(1, 0, 0);
    await this.loadAnim();
  }

  async loadAnim() {
    const token = (this.loadToken = (this.loadToken || 0) + 1);
    const text = await this.fetchText(this.svgUrl(this.s.style));
    if (token !== this.loadToken) return;

    const world = this.r.worldAnim;
    world.className = `ds-world ds-anim ds-style-${this.s.style}`;
    world.innerHTML = text;
    const svg = world.querySelector('svg');
    this.els = [...svg.querySelectorAll('[data-order]')].map((el) => ({ el, order: Number(el.dataset.order) }));
    this.orderCount = Math.max(0, ...this.els.map((x) => x.order)) + 1;

    this.focus = document.createElementNS(SVG_NS, 'rect');
    this.focus.setAttribute('class', 'ds-focus');
    this.focus.setAttribute('rx', '9');
    svg.appendChild(this.focus);

    this.computeRanges();
    this.r.styleBadge.textContent = this.styles.find((s) => s.id === this.s.style)?.label || '';
    this.capKey = null;
    this.render();
  }

  computeRanges() {
    const S = this.steps.length;
    const O = this.orderCount;
    this.ranges = this.steps.map((_, i) => [Math.round((i * O) / S), Math.round(((i + 1) * O) / S)]);
    this.boxes = this.ranges.map(([lo, hi]) => this.unionBox(lo, hi));
    for (let i = 1; i < this.boxes.length; i++) this.boxes[i] ||= this.boxes[i - 1];
  }

  unionBox(lo, hi) {
    let box = null;
    for (const { el, order } of this.els) {
      if (order < lo || order >= hi) continue;
      const b = el.getBBox();
      if (!b.width && !b.height) continue;
      box = box
        ? { x1: Math.min(box.x1, b.x), y1: Math.min(box.y1, b.y), x2: Math.max(box.x2, b.x + b.width), y2: Math.max(box.y2, b.y + b.height) }
        : { x1: b.x, y1: b.y, x2: b.x + b.width, y2: b.y + b.height };
    }
    const pad = 7;
    return box && { x: box.x1 - pad, y: box.y1 - pad, w: box.x2 - box.x1 + pad * 2, h: box.y2 - box.y1 + pad * 2 };
  }

  /* ------------------------------------------------------------ pipeline */

  runPipeline({ play = true } = {}) {
    clearTimeout(this.pipeTimer);
    this.pause();
    this.seek(0);
    const stages = [...this.r.stages.children];

    const finish = () => {
      this.root.classList.remove('is-busy');
      stages.forEach((li) => { li.classList.remove('is-active'); li.classList.add('is-done'); });
      this.r.engineStatus.textContent = 'Narrative ready';
      this.pipeTimer = setTimeout(() => (this.r.engineStatus.textContent = 'Active agent pipeline'), 2400);
      if (play) this.play();
    };
    if (this.reduced) return finish();

    this.root.classList.add('is-busy');
    let k = 0;
    const step = () => {
      if (k === STAGES.length) return finish();
      stages.forEach((li, j) => {
        li.classList.toggle('is-active', j === k);
        li.classList.toggle('is-done', j < k);
      });
      this.r.engineStatus.textContent = STAGES[k].status;
      k += 1;
      this.pipeTimer = setTimeout(step, STAGE_MS);
    };
    step();
  }

  /* ------------------------------------------------------------ timeline */

  beatAt(t) {
    let i = 0;
    for (let k = 0; k < this.steps.length; k++) if (this.steps[k].t <= t) i = k;
    return i;
  }

  stagger(i) {
    const [lo, hi] = this.ranges?.[i] || [0, 0];
    const n = hi - lo;
    return n > 1 ? Math.min(0.55, (this.durs[i] * 0.45) / (n - 1)) : 0;
  }

  settle(i) {
    const [lo, hi] = this.ranges?.[i] || [0, 0];
    const elems = this.stagger(i) * Math.max(0, hi - lo - 1) + 0.6;
    const words = (this.steps[i].caption || '').length * TYPE_RATE + 0.2;
    return this.steps[i].t + Math.min(this.durs[i] - 0.05, Math.max(elems, words));
  }

  seek(t) {
    this.s.time = clamp(t, 0, this.total);
    this.render();
  }

  gotoBeat(i) {
    i = clamp(i, 0, this.steps.length - 1);
    this.seek(this.s.playing ? this.steps[i].t : this.settle(i));
  }

  play() {
    if (this.s.time >= this.total - 0.02) this.s.time = 0;
    this.s.playing = true;
    this.root.classList.add('is-playing');
    this.r.playBtn.innerHTML = I.pause;
    this.r.playBtn.setAttribute('aria-label', 'Pause');
    let last = performance.now();
    const tick = (now) => {
      if (!this.s.playing) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      this.s.time += dt * this.s.speed;
      if (this.s.time >= this.total) {
        if (this.s.loop) this.s.time = 0;
        else { this.s.time = this.total; this.render(); this.pause(); return; }
      }
      this.render();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  pause() {
    this.s.playing = false;
    cancelAnimationFrame(this.raf);
    this.root.classList.remove('is-playing');
    this.r.playBtn.innerHTML = I.play;
    this.r.playBtn.setAttribute('aria-label', 'Play');
  }

  render() {
    if (!this.steps) return;
    const t = this.s.time;
    const i = this.beatAt(t);
    const local = t - this.steps[i].t;
    const [lo, hi] = this.ranges?.[i] || [0, 0];
    const stag = this.stagger(i);

    for (const { el, order } of this.els || []) {
      const shown = order < lo || (order < hi && local >= (order - lo) * stag);
      el.classList.toggle('is-shown', shown);
      el.classList.toggle('is-current', shown && order >= lo);
    }

    this.renderFocus(i, local);
    this.renderCaption(i, local);

    const frac = this.total ? t / this.total : 0;
    this.r.fill.style.width = `${frac * 100}%`;
    this.r.head.style.left = `${frac * 100}%`;
    this.r.scrub.setAttribute('aria-valuenow', t.toFixed(1));
    this.r.scrub.setAttribute('aria-valuetext', `${fmt(t)}, beat ${i + 1} of ${this.steps.length}`);
    this.r.time.textContent = `${fmt(t)} / ${fmt(this.total)}`;
    this.r.beatBadge.textContent = `Beat ${i + 1} / ${this.steps.length}`;

    if (this.activeBeat !== i) {
      this.beatChips.forEach((c, k) => {
        c.classList.toggle('is-active', k === i);
        c.classList.toggle('is-past', k < i);
      });
      const li = this.beatChips[i].parentElement;
      const strip = this.r.beats;
      strip.scrollTo({ left: li.offsetLeft - strip.clientWidth / 2 + li.offsetWidth / 2, behavior: this.reduced ? 'auto' : 'smooth' });
      this.activeBeat = i;
    }
    this.beatChips[i].style.setProperty('--p', Math.min(local / this.durs[i], 1).toFixed(3));
  }

  renderFocus(i, local) {
    const f = this.focus;
    if (!f) return;
    const style = this.s.style;
    let b = this.boxes?.[i];
    if ((style !== 'hopping' && style !== 'sliding') || !b) { f.classList.remove('on'); return; }

    if (style === 'sliding' && i > 0 && this.boxes[i - 1]) {
      const a = this.boxes[i - 1];
      const p = Math.min(local / Math.min(1.1, this.durs[i] * 0.5), 1);
      const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      b = { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e, w: a.w + (b.w - a.w) * e, h: a.h + (b.h - a.h) * e };
    }
    f.setAttribute('x', b.x.toFixed(2));
    f.setAttribute('y', b.y.toFixed(2));
    f.setAttribute('width', b.w.toFixed(2));
    f.setAttribute('height', b.h.toFixed(2));
    f.classList.add('on');
    f.classList.toggle('land', style === 'hopping' && local < 0.2);
  }

  renderCaption(i, local) {
    const cap = this.steps[i].caption || '';
    const n = this.reduced ? cap.length : Math.min(cap.length, Math.floor(local / TYPE_RATE));
    const key = `${i}:${n}`;
    if (key === this.capKey) return;
    this.capKey = key;
    this.r.captionText.textContent = cap.slice(0, n);
    this.r.caption.classList.toggle('is-typing', n < cap.length);
  }

  /* ------------------------------------------------------------ controls */

  bind() {
    this.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || !this.contains(b) || b.disabled) return;
      if (b.dataset.act) this.act(b.dataset.act);
      else if (b.dataset.style) this.setStyle(b.dataset.style);
      else if (b.dataset.gran) this.setGranularity(b.dataset.gran);
      else if (b.dataset.speed) this.setSpeed(Number(b.dataset.speed));
      else if (b.dataset.example) this.setExample(b.dataset.example);
      else if (b.dataset.beat) this.gotoBeat(Number(b.dataset.beat));
    });
    this.addEventListener('pointerdown', () => (this.touched = true));
    this.addEventListener('keydown', (e) => { this.touched = true; this.onKey(e); });

    this.onFullscreen = () => this.syncFullscreen();
    document.addEventListener('fullscreenchange', this.onFullscreen);

    this.bindScrub();
    this.bindCanvas();
    this.bindSplit();
  }

  act(name) {
    const c = this.r.canvas.getBoundingClientRect();
    const beat = this.beatAt(this.s.time);
    switch (name) {
      case 'play': return this.s.playing ? this.pause() : this.play();
      case 'prev': return this.gotoBeat(beat - 1);
      case 'next': return this.gotoBeat(beat + 1);
      case 'restart': this.seek(0); return this.play();
      case 'loop':
        this.s.loop = !this.s.loop;
        return this.r.loopBtn.setAttribute('aria-pressed', String(this.s.loop));
      case 'zoom-in': return this.animateView(() => this.zoomAt(c.width / 2, c.height / 2, 1.5));
      case 'zoom-out': return this.animateView(() => this.zoomAt(c.width / 2, c.height / 2, 1 / 1.5));
      case 'fit': return this.animateView(() => this.setView(1, 0, 0));
      case 'compare': return this.setCompare(!this.s.compare);
      case 'captions': return this.setCaptions(!this.s.captions);
      case 'fullscreen': return this.toggleFullscreen();
      case 'download': return this.setMenu(this.r.dlMenu.hidden);
    }
  }

  setMenu(open) {
    this.r.dlMenu.hidden = !open;
    this.r.dlBtn.setAttribute('aria-expanded', String(open));
  }

  async setStyle(id) {
    if (id === this.s.style) return;
    this.s.style = id;
    this.syncPressed();
    await this.loadAnim();
    this.runPipeline();
  }

  async setExample(id) {
    if (id === this.s.example) return;
    this.s.example = id;
    this.syncPressed();
    await this.loadExample();
    this.runPipeline();
  }

  setGranularity(g) {
    if (g === this.s.granularity) return;
    this.s.granularity = g;
    this.syncPressed();
    this.buildSteps();
    this.capKey = null;
    this.runPipeline();
  }

  setSpeed(v) {
    this.s.speed = v;
    this.style.setProperty('--ds-speed', v);
    this.syncPressed();
  }

  setCompare(on) {
    this.s.compare = on;
    this.r.canvas.classList.toggle('is-compare', on);
    this.querySelector('[data-act="compare"]').setAttribute('aria-pressed', String(on));
    this.setSplit(this.s.split);
  }

  setCaptions(on) {
    this.s.captions = on;
    this.r.canvas.classList.toggle('no-captions', !on);
    this.querySelector('[data-act="captions"]').setAttribute('aria-pressed', String(on));
  }

  onKey(e) {
    if (e.target.closest('input, textarea, select')) return;
    const onButton = !!e.target.closest('button');
    const k = e.key;
    if (k === 'Escape' && !this.r.dlMenu.hidden) { this.setMenu(false); this.r.dlBtn.focus(); }
    else if (k === ' ' && !onButton) { e.preventDefault(); this.act('play'); }
    else if ((k === 'ArrowRight' || k === 'ArrowLeft') && e.target === this.r.scrub) {
      e.preventDefault();
      this.seek(this.s.time + (k === 'ArrowRight' ? 1 : -1));
    } else if ((k === 'ArrowRight' || k === 'ArrowLeft') && !e.target.closest('[role="radiogroup"], .ds-split')) {
      e.preventDefault();
      this.act(k === 'ArrowRight' ? 'next' : 'prev');
    } else if (k === '+' || k === '=') this.act('zoom-in');
    else if (k === '-') this.act('zoom-out');
    else if (k === '0') this.act('fit');
    else if (k === 'c' || k === 'C') this.act('compare');
    else if (k === 'f' || k === 'F') this.act('fullscreen');
  }

  bindScrub() {
    const scrub = this.r.scrub;
    const timeAt = (e) => {
      const r = scrub.getBoundingClientRect();
      return clamp((e.clientX - r.left) / r.width, 0, 1) * this.total;
    };
    scrub.addEventListener('pointerdown', (e) => {
      scrub.setPointerCapture(e.pointerId);
      this.scrubbing = true;
      this.resumeAfterScrub = this.s.playing;
      this.pause();
      scrub.classList.add('is-dragging');
      this.seek(timeAt(e));
    });
    scrub.addEventListener('pointermove', (e) => {
      const t = timeAt(e);
      this.showTip(t);
      if (this.scrubbing) this.seek(t);
    });
    const end = () => {
      if (!this.scrubbing) return;
      this.scrubbing = false;
      scrub.classList.remove('is-dragging');
      if (this.resumeAfterScrub) this.play();
    };
    scrub.addEventListener('pointerup', end);
    scrub.addEventListener('pointercancel', end);
    scrub.addEventListener('pointerleave', () => this.r.tip.classList.remove('on'));
  }

  showTip(t) {
    const i = this.beatAt(t);
    const cap = this.steps[i].caption || '';
    this.r.tip.textContent = `${fmt(t)} · ${cap.length > 52 ? `${cap.slice(0, 50)}…` : cap}`;
    const w = this.r.scrub.clientWidth;
    const tipW = this.r.tip.offsetWidth;
    this.r.tip.style.left = `${clamp((t / this.total) * w, tipW / 2, w - tipW / 2)}px`;
    this.r.tip.classList.add('on');
  }

  bindCanvas() {
    const c = this.r.canvas;
    const onChrome = (e) => e.target.closest('button, .ds-split, .ds-caption');

    c.addEventListener('wheel', (e) => {
      if (!(e.ctrlKey || e.metaKey || this.engaged)) { this.flashHint(); return; }
      e.preventDefault();
      const r = c.getBoundingClientRect();
      this.zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0022));
    }, { passive: false });

    c.addEventListener('pointerdown', (e) => {
      if (onChrome(e)) return;
      this.engaged = true;
      c.classList.add('is-engaged');
      c.focus({ preventScroll: true });
      this.drag = { x: e.clientX, y: e.clientY, px: this.s.px, py: this.s.py };
      c.setPointerCapture(e.pointerId);
      c.classList.add('is-grabbing');
    });
    c.addEventListener('pointermove', (e) => {
      if (!this.drag) return;
      this.setView(this.s.zoom, this.drag.px + e.clientX - this.drag.x, this.drag.py + e.clientY - this.drag.y);
    });
    const up = () => { this.drag = null; c.classList.remove('is-grabbing'); };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);

    c.addEventListener('dblclick', (e) => {
      if (onChrome(e)) return;
      const r = c.getBoundingClientRect();
      this.animateView(() => (this.s.zoom >= 3.4 ? this.setView(1, 0, 0) : this.zoomAt(e.clientX - r.left, e.clientY - r.top, 2)));
    });

    this.onDocPointer = (e) => {
      if (!c.contains(e.target)) { this.engaged = false; c.classList.remove('is-engaged'); }
      if (!this.r.dlMenu.hidden && !e.target.closest('.ds-dl')) this.setMenu(false);
    };
    document.addEventListener('pointerdown', this.onDocPointer);
  }

  zoomAt(x, y, factor) {
    const z = this.s.zoom;
    const nz = clamp(z * factor, 1, ZOOM_MAX);
    const k = nz / z;
    this.setView(nz, x - (x - this.s.px) * k, y - (y - this.s.py) * k);
  }

  setView(z, px, py) {
    const { width: W, height: H } = this.r.canvas.getBoundingClientRect();
    if (z <= 1.001) { z = 1; px = 0; py = 0; }
    else { px = clamp(px, W * (1 - z), 0); py = clamp(py, H * (1 - z), 0); }
    Object.assign(this.s, { zoom: z, px, py });
    const tf = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px) scale(${z.toFixed(3)})`;
    this.r.worldStatic.style.transform = tf;
    this.r.worldAnim.style.transform = tf;
    this.r.zoomVal.textContent = `${Math.round(z * 100)}%`;
    this.r.canvas.classList.toggle('is-zoomed', z > 1);
  }

  animateView(fn) {
    const c = this.r.canvas;
    c.classList.add('is-animating-view');
    fn();
    clearTimeout(this.viewTimer);
    this.viewTimer = setTimeout(() => c.classList.remove('is-animating-view'), 340);
  }

  flashHint() {
    this.r.hint.classList.add('show');
    clearTimeout(this.hintTimer);
    this.hintTimer = setTimeout(() => this.r.hint.classList.remove('show'), 1600);
  }

  bindSplit() {
    const h = this.r.split;
    const move = (e) => {
      const r = this.r.canvas.getBoundingClientRect();
      this.setSplit(((e.clientX - r.left) / r.width) * 100);
    };
    h.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      h.setPointerCapture(e.pointerId);
      this.splitting = true;
      move(e);
    });
    h.addEventListener('pointermove', (e) => { if (this.splitting) move(e); });
    h.addEventListener('pointerup', () => (this.splitting = false));
    h.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      e.stopPropagation();
      this.setSplit(this.s.split + (e.key === 'ArrowLeft' ? -5 : 5));
    });
  }

  setSplit(v) {
    this.s.split = clamp(v, 5, 95);
    this.r.canvas.style.setProperty('--split', `${this.s.split}%`);
    this.r.split.setAttribute('aria-valuenow', String(Math.round(this.s.split)));
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
    this.r.fsBtn.innerHTML = on ? I.shrink : I.expand;
    this.r.fsBtn.setAttribute('aria-label', on ? 'Exit full screen (F)' : 'Full screen (F)');
    setTimeout(() => this.setView(1, 0, 0), 60);
  }

  watchAutoplay() {
    if (this.reduced) return;
    this.io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !this.touched && !this.autoplayed) {
        this.autoplayed = true;
        this.runPipeline();
      } else if (!entry.isIntersecting && this.s.playing && !document.fullscreenElement) {
        this.pause();
      }
    }, { threshold: 0.45 });
    this.io.observe(this.r.canvas);
  }
}
customElements.define('demo-studio', DemoStudio);
