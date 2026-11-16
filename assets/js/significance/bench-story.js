import { escapeHtml as esc } from '../lib/format.js';

const STEP = 1500;
const FLAG = '#C2283C';
const ERR_STEP = 1;
const NAMES = { SS: 'Selection Sensibility', GP: 'Granularity and Pacing', NA: 'Narration Alignment' };
const SEQ = ['SS', 'GP', 'NA'];
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

const RUNS = {
  method: {
    src: 'assets/significance/method_animation.svg',
    alt: 'Output of M',
    steps: [
      { ids: ['trainer', 'pre_inlining_ir_corpus'],
        cap: 'The pipeline starts with a centralized Trainer module and a Pre-Inlining IR Corpus database.' },
      { ids: ['edge_policy', 'text_policy', 'text_tf_savedmodel', 'edge_training_data', 'text_training_data', 'edge_ir_files', 'text_ir_files'],
        cap: 'Three data pathways connect the system: dispatching the policy, returning training data, and feeding IR files.' },
      { ids: ['parallel_data_collector_block'],
        cap: 'These pathways converge at the Parallel Data Collector, which runs multiple Data Collector instances to gather rollouts.' },
      { ids: ['edge_export', 'text_export'],
        cap: 'Once policy optimization is complete, the Trainer initiates an export operation.' },
      { ids: ['trained_policy'],
        cap: 'This produces the final Trained Policy as a TF SavedModel ready for deployment.' },
    ],
    scores: { SS: ['0.733', 'ADBAA'], GP: ['1.0', 'AAAAA'], NA: ['0.733', 'ACCAA'] },
  },
  bench: {
    src: 'assets/significance/bench_animation.svg',
    alt: 'AnimateBench output',
    steps: [
      { ids: ['trainer', 'pre_inlining_ir_corpus'],
        cap: 'The pipeline begins with a centralized trainer module and a database containing a corpus of IR files.' },
      { ids: ['edge_policy', 'text_policy', 'text_tf_savedmodel', 'edge_ir_files', 'text_ir_files'],
        cap: 'The trainer distributes the current behavioral policy, while IR files are concurrently supplied.' },
      { ids: ['parallel_data_collector_block'],
        cap: 'Both are received by a parallel data collection framework operating multiple independent instances.' },
      { ids: ['edge_training_data', 'text_training_data'],
        cap: 'The collectors generate training data from these interactions and send it back to optimize the trainer.' },
      { ids: ['edge_export', 'text_export'],
        cap: 'Once the learning objectives are met, the trainer exports the optimized model.' },
      { ids: ['trained_policy'],
        cap: 'This establishes the final trained policy, saved for deployment and downstream tasks.' },
    ],
    scores: { SS: ['1.0', 'AAAAAA'], GP: ['1.0', 'AAAAAA'], NA: ['1.0', 'AAAAAA'] },
  },
};

const markupCache = {};
const getMarkup = (key) => (markupCache[key] ||= fetch(RUNS[key].src).then((r) => r.text()));

const frameCache = {};
function frameUrl(key, k, flag = false) {
  const id = `${key}-${k}-${flag ? 1 : 0}`;
  return (frameCache[id] ||= getMarkup(key).then((src) => {
    const shown = RUNS[key].steps.slice(0, k + 1).flatMap((s) => s.ids);
    let css = `#narration_banner{display:none}*{animation:none!important}${shown.map((i) => `#${i}`).join(',')}{opacity:1!important}`;
    let s = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '')
      .replace(/&(?!(?:[a-zA-Z]+|#\d+|#x[\da-fA-F]+);)/g, '&amp;')
      .replace(/<svg\b[^>]*>/,'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 541 304" width="541" height="304">');
    if (flag) {
      css += `#edge_training_data{stroke:${FLAG};stroke-width:2.6}#text_training_data{fill:${FLAG};font-weight:700}`;
      s = s.replace('</defs>', `<marker id="arrow-flag" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${FLAG}"/></marker></defs>`)
        .replace(/(<line id="edge_training_data"[^>]*?)url\(#arrow\)/, '$1url(#arrow-flag)');
    }
    s = s.replace(/<\/svg>\s*$/, `<style>${css}</style></svg>`);
    return URL.createObjectURL(new Blob([s], { type: 'image/svg+xml' }));
  }));
}

async function fillFrames(root) {
  await Promise.all([...root.querySelectorAll('img[data-frame]')].map(async (img) => {
    const [key, k, flag] = img.dataset.frame.split(':');
    img.src = await frameUrl(key, +k, flag === 'flag');
  }));
}

const ICON = {
  tick: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12.5l4 4 8-9"/></svg>',
  cross: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg>',
  play: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 3.2 12.6 8l-8.1 4.8z"/></svg>',
  pause: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 3h3v10H4zM9 3h3v10H9z"/></svg>',
  warn: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="${FLAG}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2.8 19.4h18.4z"/><path d="M12 10v4.4M12 17.2v.1"/></svg>`,
};

const ok = (g) => g === 'A' || g === 'B';

class Wires {
  constructor(host, spec) {
    this.host = host;
    this.spec = spec;
    this.on = false;
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.classList.add('jm-wires');
    this.svg.setAttribute('aria-hidden', 'true');
    const mk = (id, cls) => `<marker id="${host.id}-${id}" class="${cls}" viewBox="0 0 10 10" refX="8" refY="5"
      markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z"/></marker>`;
    this.svg.innerHTML = `<defs>${mk('arrow', 'is-idle')}${mk('arrow-on', 'is-live')}</defs><g></g>`;
    host.prepend(this.svg);
    this.g = this.svg.querySelector('g');
    new ResizeObserver(() => this.draw()).observe(host);
  }
  set(on) { this.on = on; this.draw(); }
  draw() {
    const H = this.host.getBoundingClientRect();
    if (!H.width || getComputedStyle(this.svg).display === 'none') return;
    this.svg.setAttribute('viewBox', `0 0 ${H.width} ${H.height}`);
    const mark = `url(#${this.host.id}-${this.on ? 'arrow-on' : 'arrow'})`;
    this.g.innerHTML = this.spec.map(([a, b]) => {
      const r1 = a.getBoundingClientRect();
      const r2 = b.getBoundingClientRect();
      const x1 = r1.right - H.left + 4;
      const y1 = r1.top + r1.height / 2 - H.top;
      const x2 = r2.left - H.left - 6;
      const y2 = r2.top + r2.height / 2 - H.top;
      const dx = Math.max(24, (x2 - x1) * 0.5);
      return `<path class="${this.on ? 'is-on' : ''}" d="M${x1} ${y1} C${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}" marker-end="${mark}"/>`;
    }).join('');
  }
}

class BsSetup extends HTMLElement {
  async connectedCallback() {
    const run = RUNS.method;
    this.n = run.steps.length;
    this.dur = this.n * STEP;
    this.t = 0;
    this.playing = false;
    this.anims = [];
    this.id ||= 'bs-setup';
    this.innerHTML = `
      <div class="jm bs-setup" id="${this.id}-m">
        <div class="jm-col jm-in">
          <figure class="jm-input" data-in="source">
            <figcaption><b>Diagram</b><i>D</i></figcaption>
            <div class="jm-media"><img src="assets/significance/Paper2Fig_pipe_easy_000000517.png" alt="The example diagram D" loading="lazy"></div>
          </figure>
          <div class="jm-input jm-stylein" data-in="style">
            <figcaption><b>Animation style</b><i>S</i></figcaption>
            <span class="jm-stylechip">Progressive Reveal</span>
          </div>
        </div>
        <div class="jm-col jm-core">
          <div class="bs-method" data-core>
            <span class="bs-role">End-to-end animation method</span>
            <img class="bs-mlogo" src="assets/significance/method-m.png" alt="M" width="256" height="256">
          </div>
        </div>
        <div class="jm-col jm-out">
          <figure class="jm-input bs-output" data-out>
            <figcaption><b>Output animation sequence</b><i>from M</i></figcaption>
            <div class="bs-player"><div class="bs-stage" data-stage></div></div>
            <p class="bs-cap" data-cap aria-live="polite"></p>
            <div class="bs-controls">
              <button type="button" class="bs-btn" data-toggle>${ICON.play}<span>Play</span></button>
              <input type="range" class="bs-range" min="0" max="${this.dur}" step="10" value="0" aria-label="Animation timeline">
              <span class="bs-stepk" data-stepk></span>
            </div>
          </figure>
        </div>
      </div>`;
    const m = this.querySelector('.jm');
    const q = (s) => m.querySelector(s);
    this.wires = new Wires(m, [[q('[data-in="source"]'), q('[data-core]')], [q('[data-in="style"]'), q('[data-core]')], [q('[data-core]'), q('[data-out]')]]);
    this.btn = q('[data-toggle]');
    this.range = q('.bs-range');
    this.cap = q('[data-cap]');
    this.stepk = q('[data-stepk]');
    this.tick = this.tick.bind(this);

    await this.mount(q('[data-stage]'));
    await this.collect();
    this.setTime(this.dur);

    this.btn.addEventListener('click', () => (this.playing ? this.pause() : this.play()));
    this.range.addEventListener('input', () => { this.pause(); this.setTime(+this.range.value); });
    new IntersectionObserver(([e], o) => {
      if (e.isIntersecting) { o.disconnect(); if (!REDUCED) { this.setTime(0); this.play(); } }
    }, { threshold: 0.45 }).observe(this);
  }

  async mount(stage) {
    const host = document.createElement('div');
    host.attachShadow({ mode: 'open' });
    let src = '';
    try { src = await getMarkup('method'); } catch { stage.textContent = 'The animation could not be loaded.'; return; }
    host.shadowRoot.innerHTML = `<style>:host{display:block}svg{display:block;width:100%;height:auto}#narration_banner{display:none}</style>${src}`;
    const svg = host.shadowRoot.querySelector('svg');
    svg.setAttribute('viewBox', '0 0 541 304');
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Animation sequence generated by M');
    stage.append(host);
    this.host = host;
  }

  async collect() {
    for (let i = 0; i < 40 && !this.anims.length; i++) {
      const svg = this.host?.shadowRoot.querySelector('svg');
      if (svg) for (const a of svg.getAnimations({ subtree: true })) { a.pause(); this.anims.push(a); }
      if (!this.anims.length) await new Promise((r) => setTimeout(r, 50));
    }
  }

  setTime(t) {
    this.t = Math.max(0, Math.min(t, this.dur));
    for (const a of this.anims) a.currentTime = Math.min(this.t, this.dur - 1);
    this.range.value = this.t;
    const i = Math.min(Math.floor(this.t / STEP), this.n - 1);
    const cap = RUNS.method.steps[i].cap;
    if (this.cap.textContent !== cap) this.cap.textContent = cap;
    this.stepk.textContent = `Step ${i + 1} of ${this.n}`;
  }

  ui() {
    this.btn.innerHTML = this.playing ? `${ICON.pause}<span>Pause</span>` : `${ICON.play}<span>Play</span>`;
    this.wires.set(this.playing);
  }

  play() {
    if (this.playing) return;
    if (this.t >= this.dur) this.setTime(0);
    this.playing = true;
    this.t0 = this.t;
    this.w0 = performance.now();
    this.ui();
    this.timer = setInterval(this.tick, 16);
  }

  pause() {
    this.playing = false;
    clearInterval(this.timer);
    this.ui();
  }

  tick() {
    const t = Math.min(this.t0 + (performance.now() - this.w0), this.dur);
    this.setTime(t);
    if (t >= this.dur) this.pause();
  }
}

class BsScores extends HTMLElement {
  connectedCallback() {
    const key = this.getAttribute('run') === 'bench' ? 'bench' : 'method';
    const run = RUNS[key];
    const who = key === 'bench' ? 'AnimateBench' : 'M';
    this.innerHTML = `
      <div class="bs-scores is-${key}">
        ${SEQ.map((k) => {
          const [v, g] = run.scores[k];
          return `
          <article class="bs-metric">
            <header class="bs-mhead">
              <h3>${NAMES[k]} <span class="bs-abbr">${k}</span></h3>
              <div class="bs-mscore"><span>${k} score</span><b>${v}</b></div>
            </header>
            <ol class="bs-frames" style="--n:${run.steps.length}">
              ${[...g].map((c, j) => `
                <li class="bs-frame ${ok(c) ? 'is-ok' : 'is-bad'}">
                  <span class="bs-stepn">Step ${j + 1}</span>
                  <div class="bs-shot">
                    <img data-frame="${key}:${j}" alt="${esc(`${who}, step ${j + 1}`)}" title="${esc(run.steps[j].cap)}">
                    <i class="bs-mark" aria-label="${ok(c) ? 'correct' : 'incorrect'}">${ok(c) ? ICON.tick : ICON.cross}</i>
                  </div>
                  <span class="bs-grade g-${c}">${c}</span>
                </li>`).join('')}
            </ol>
          </article>`;
        }).join('')}
      </div>`;
    fillFrames(this);
  }
}

class BsCompare extends HTMLElement {
  connectedCallback() {
    const cols = RUNS.bench.steps.length;
    const cell = (key, j) => {
      const run = RUNS[key];
      if (j >= run.steps.length) return '<li class="bs-cframe is-none" aria-hidden="true"></li>';
      const err = key === 'method' && j === ERR_STEP;
      const fix = key === 'bench' && j === 3;
      return `
        <li class="bs-cframe${j === ERR_STEP ? ' is-focus' : ''}${err ? ' is-err' : ''}${fix ? ' is-fix' : ''}">
          <span class="bs-stepn">Step ${j + 1}</span>
          <div class="bs-shot"><img data-frame="${key}:${j}${err ? ':flag' : ''}" alt="${esc(`${run.alt}, step ${j + 1}`)}" title="${esc(run.steps[j].cap)}">
            ${err ? `<i class="bs-mark is-bad">${ICON.cross}</i>` : ''}</div>
          ${err ? '<span class="bs-errtags"><span class="g-D">SS D</span><span class="g-C">NA C</span></span>' : ''}
          ${fix ? '<span class="bs-fixtag">training data</span>' : ''}
        </li>`;
    };
    const row = (key, title, sub) => `
      <div class="bs-crow is-${key}">
        <div class="bs-clabel"><b>${title}</b><small>${sub}</small></div>
        <ol class="bs-cframes" style="--n:${cols}">${Array.from({ length: cols }, (_, j) => cell(key, j)).join('')}</ol>
      </div>`;
    const card = (key, title, flag) => `
      <figure class="bs-dcard is-${key}">
        <figcaption><b>${title}</b><span>Step ${ERR_STEP + 1}</span></figcaption>
        <div class="bs-shot"><img data-frame="${key}:${ERR_STEP}${flag ? ':flag' : ''}" alt="${esc(`${RUNS[key].alt}, step ${ERR_STEP + 1}`)}"></div>
        <p class="bs-dcap">${esc(RUNS[key].steps[ERR_STEP].cap)}</p>
      </figure>`;
    this.innerHTML = `
      <div class="bs-compare">
        <div class="bs-cscroll">
          ${row('bench', 'AnimateBench', 'Human-verified narrative')}
          ${row('method', 'M', 'Generated sequence')}
        </div>
        <div class="bs-detail">
          ${card('bench', 'AnimateBench', false)}
          ${card('method', 'M', true)}
        </div>
        <aside class="bs-flag">
          <span class="bs-flagmark">${ICON.warn}</span>
          <p>At step ${ERR_STEP + 1}, the backward arrow for <b>training data</b> appears before its originating block,
          the <b>Parallel Data Collector</b>, is even revealed, which is erroneous.</p>
        </aside>
      </div>`;
    fillFrames(this);
  }
}

customElements.define('bs-setup', BsSetup);
customElements.define('bs-scores', BsScores);
customElements.define('bs-compare', BsCompare);
