import { escapeHtml as esc } from '../lib/format.js';

const STEP = 1500;
const DUR = 9500;
const NOTE_T = 2100;
const START_T = 700;
const FLAG = '#C2283C';

const PANELS = [
  {
    key: 'bench',
    label: 'AnimateBench output',
    sub: '(Human Verified Narrative)',
    src: 'assets/metrics/seq/bench_animation.svg',
    caps: [
      'The pipeline begins with a centralized trainer module and a database containing a corpus of IR files.',
      'The trainer distributes the current behavioral policy, while IR files are concurrently supplied.',
      'Both are received by a parallel data collection framework operating multiple independent instances.',
      'The collectors generate training data from these interactions and send it back to optimize the trainer.',
      'Once the learning objectives are met, the trainer exports the optimized model.',
      'This establishes the final trained policy, saved for deployment and downstream tasks.',
    ],
    bands: { VF: 'A', ASC: 'A' },
    an: '1.0',
    seqs: [
      { k: 'SS', name: 'Selection Sensibility', v: '1.0', g: 'AAAAAA' },
      { k: 'GP', name: 'Granularity and Pacing', v: '1.0', g: 'AAAAAA' },
      { k: 'NA', name: 'Narration Alignment', v: '1.0', g: 'AAAAAA' },
    ],
  },
  {
    key: 'gen',
    label: 'Example output (synthetically generated)',
    src: 'assets/metrics/seq/baseline_animation.svg',
    caps: [
      'The pipeline starts with a centralized Trainer module and a Pre-Inlining IR Corpus database.',
      'Three data pathways connect the system: dispatching the policy, returning training data, and feeding IR files.',
      'These pathways converge at the Parallel Data Collector, which runs multiple Data Collector instances to gather rollouts.',
      'Once policy optimization is complete, the Trainer initiates an export operation.',
      'This produces the final Trained Policy as a TF SavedModel ready for deployment.',
    ],
    bands: { VF: 'A', ASC: 'A' },
    an: '0.822',
    seqs: [
      { k: 'SS', name: 'Selection Sensibility', v: '0.733', g: 'ADBAA' },
      { k: 'GP', name: 'Granularity and Pacing', v: '1.0', g: 'AAAAA' },
      { k: 'NA', name: 'Narration Alignment', v: '0.733', g: 'ACCAA' },
    ],
  },
];

const SHADOW_CSS = `
  :host { display: block; }
  svg { display: block; width: 100%; height: auto; }
  #narration_banner { display: none; }
  #trainer, #pre_inlining_ir_corpus { transition: filter .35s; }
  :host(.is-note) #trainer, :host(.is-note) #pre_inlining_ir_corpus { filter: opacity(.3) grayscale(1); }
  :host(.is-flag) #edge_training_data { stroke: ${FLAG}; stroke-width: 2.2; }
  :host(.is-flag) #text_training_data { fill: ${FLAG}; font-weight: 700; }
`;

const ICONS = {
  play: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 3.2 12.6 8l-8.1 4.8z"/></svg>',
  pause: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 3h3v10H4zM9 3h3v10H9z"/></svg>',
  replay: '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3.2 8a4.8 4.8 0 1 0 1.4-3.4"/><path d="M3 2.6v2.6h2.6"/></svg>',
};

const scoreBox = (p) => `
  <div class="sq-scores" data-scores="${p.key}">
    <div class="sq-bands">
      <span class="sq-pill" title="Visual Fidelity"><b>VF</b><em class="sq-band">${p.bands.VF}</em></span>
      <span class="sq-pill" title="Animation Style Compliance"><b>ASC</b><em class="sq-band">${p.bands.ASC}</em></span>
      <span class="sq-pill sq-an${p.key === 'gen' ? ' is-watch' : ''}" title="Animation quality score"><b>AN</b><strong>${p.an}</strong></span>
    </div>
    ${p.seqs.map((s) => `
      <div class="sq-row${s.g.includes('D') || s.g.includes('C') ? ' is-watch' : ''}" title="${esc(s.name)}">
        <b>${s.k}</b>
        <strong>${s.v}</strong>
        <span class="sq-seq">${[...s.g].map((c, j) => `<u class="g-${c}" data-j="${j}">${c}</u>`).join('')}</span>
      </div>`).join('')}
  </div>`;

class SeqCompare extends HTMLElement {
  async connectedCallback() {
    this.t = 0;
    this.playing = false;
    this.notePlayed = false;
    this.anims = [];
    this.innerHTML = `
      <div class="sq">
        <div class="sq-grid">
          ${PANELS.map((p) => `
            <figure class="sq-panel is-${p.key}">
              <figcaption><b>${esc(p.label)}</b>${p.sub ? `<span>${esc(p.sub)}</span>` : ''}</figcaption>
              <div class="sq-frame"><div class="sq-stage" data-stage="${p.key}"></div></div>
              <div class="sq-cap" data-cap="${p.key}"></div>
              ${scoreBox(p)}
            </figure>`).join('')}
        </div>
        <aside class="sq-note" data-note>
          <span class="sq-note-mark" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="${FLAG}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2.8 19.4h18.4z"/><path d="M12 10v4.4M12 17.2v.1"/></svg></span>
          <div>
            <b>Logical inconsistency at step 2</b>
            <p>An outgoing edge (training data) cannot logically emanate from an empty space before its
            source node (Parallel Data Collector) exists.</p>
          </div>
        </aside>
        <div class="sq-controls">
          <button type="button" class="sq-btn" data-toggle>${ICONS.play}<span>Play</span></button>
          <button type="button" class="sq-btn is-ghost" data-replay>${ICONS.replay}<span>Replay</span></button>
          <input type="range" class="sq-range" min="0" max="${DUR}" step="10" value="${START_T}" aria-label="Timeline">
          <button type="button" class="sq-btn is-ghost" data-step2><span>Step 2 inconsistency</span></button>
        </div>
      </div>`;

    this.root = this.querySelector('.sq');
    this.btn = this.querySelector('[data-toggle]');
    this.range = this.querySelector('.sq-range');
    this.hosts = {};
    this.capEls = {};
    this.seqEls = {};
    for (const p of PANELS) {
      this.capEls[p.key] = this.querySelector(`[data-cap="${p.key}"]`);
      this.seqEls[p.key] = [...this.querySelectorAll(`[data-scores="${p.key}"] .sq-seq`)];
    }

    await Promise.all(PANELS.map((p) => this.mount(p)));
    await this.collect();
    this.setTime(START_T);

    this.tick = this.tick.bind(this);
    this.btn.addEventListener('click', () => this.toggle());
    this.querySelector('[data-replay]').addEventListener('click', () => {
      this.pause();
      this.notePlayed = false;
      this.setTime(0);
      this.play();
    });
    this.querySelector('[data-step2]').addEventListener('click', () => {
      this.notePlayed = true;
      this.pause();
      this.setTime(NOTE_T);
    });
    this.range.addEventListener('input', () => {
      this.notePlayed = true;
      this.pause();
      this.setTime(+this.range.value);
    });
  }

  async collect() {
    for (let i = 0; i < 40 && !this.anims.length; i++) {
      for (const h of Object.values(this.hosts)) {
        const svg = h.shadowRoot.querySelector('svg');
        if (!svg) continue;
        for (const a of svg.getAnimations({ subtree: true })) {
          a.pause();
          this.anims.push(a);
        }
      }
      if (!this.anims.length) await new Promise((r) => setTimeout(r, 50));
    }
  }

  async mount(p) {
    const stage = this.querySelector(`[data-stage="${p.key}"]`);
    const host = document.createElement('div');
    host.attachShadow({ mode: 'open' });
    let markup = '';
    try {
      markup = await (await fetch(p.src, { cache: 'no-cache' })).text();
    } catch {
      stage.textContent = 'The animation could not be loaded.';
      return;
    }
    host.shadowRoot.innerHTML = `<style>${SHADOW_CSS}</style>${markup}`;
    const svg = host.shadowRoot.querySelector('svg');
    svg.setAttribute('viewBox', '0 0 541 304');
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    const base = svg.querySelector('marker#arrow');
    if (base) {
      const flag = base.cloneNode(true);
      flag.id = 'arrow-flag';
      flag.querySelector('path')?.setAttribute('fill', FLAG);
      base.after(flag);
    }
    stage.append(host);
    this.hosts[p.key] = host;
  }

  setTime(t) {
    this.t = Math.max(0, Math.min(t, DUR));
    for (const a of this.anims) a.currentTime = this.t;
    this.range.value = this.t;
    for (const p of PANELS) {
      const i = Math.min(Math.floor(this.t / STEP), p.caps.length - 1);
      const el = this.capEls[p.key];
      if (el.textContent !== p.caps[i]) el.textContent = p.caps[i];
      for (const seq of this.seqEls[p.key]) {
        [...seq.children].forEach((u, j) => {
          u.classList.toggle('is-now', j === i);
          u.classList.toggle('is-past', j < i);
        });
      }
    }
    this.updateUi();
  }

  get atNote() {
    return !this.playing && Math.abs(this.t - NOTE_T) <= 80;
  }

  updateUi() {
    const open = this.atNote;
    this.root.classList.toggle('is-note', open);
    for (const h of Object.values(this.hosts)) h.classList.toggle('is-note', open);
    const gen = this.hosts.gen;
    if (gen) {
      gen.classList.toggle('is-flag', open);
      gen.shadowRoot.querySelector('#edge_training_data')
        ?.setAttribute('marker-end', open ? 'url(#arrow-flag)' : 'url(#arrow)');
    }
    this.btn.innerHTML = this.playing
      ? `${ICONS.pause}<span>Pause</span>`
      : `${ICONS.play}<span>Play</span>`;
  }

  toggle() {
    if (this.playing) return this.pause();
    if (this.t >= DUR) {
      this.notePlayed = false;
      this.setTime(0);
    }
    this.play();
  }

  play() {
    if (this.playing) return;
    this.playing = true;
    this.t0 = this.t;
    this.w0 = performance.now();
    this.updateUi();
    this.timer = setInterval(this.tick, 16);
  }

  pause() {
    this.playing = false;
    clearInterval(this.timer);
    this.updateUi();
  }

  tick() {
    if (!this.playing) return;
    const t = Math.min(this.t0 + (performance.now() - this.w0), DUR);
    if (!this.notePlayed && t >= NOTE_T) {
      this.notePlayed = true;
      this.pause();
      this.setTime(NOTE_T);
      return;
    }
    this.setTime(t);
    if (t >= DUR) this.pause();
  }
}

customElements.define('seq-compare', SeqCompare);
