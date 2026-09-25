import { loadJSON } from '../lib/data-loader.js';
import { mountReel } from '../lib/reel-player.js';

/**
 * <eval-lab src="data/evaluation_runs.json">
 *
 * One animation, carried through the whole scheme as it actually ran: the two
 * gates in series, and — only if both open — the clip broken into frames and
 * the three quality judges working down them in parallel, then aggregation.
 *
 * Every band, every rationale and every score here is the judge's own output,
 * read out of EVALUATIONS_PAGE/<baseline>/Judge_Results/<sample>.json by
 * scripts/build_eval_runs.py. Nothing on this page is invented: a metric that
 * never ran shows as "not run", never as a guess.
 */

const NUM = { A: 4, B: 3, C: 2, D: 1 };
const ACCEPT = 'AB';
const ORDER = ['A', 'B', 'C', 'D'];

const BAND_WORD = {
  VF:  { A: 'Excellent', B: 'Good', C: 'Poor', D: 'Severe failure' },
  ASC: { A: 'Fully compliant', B: 'Mostly compliant', C: 'Non-compliant', D: 'Severe non-compliance' },
  SSS: { A: 'Fully sensible', B: 'Minor violations', C: 'Major violation', D: 'Severe violation' },
  GPS: { A: 'Well paced', B: 'Minor overload', C: 'Major overload', D: 'Severe overload' },
  NAS: { A: 'Well aligned', B: 'Minor flaws', C: 'Major flaws', D: 'Severe flaws' },
};

/** the six things the fidelity judge answers separately, in its own key order */
const VFS_CRITERIA = [
  ['VFS_element_alteration', 'Element alteration',
   'Do elements distort or morph mid-video until they are unrecognisable or wrong?'],
  ['VFS_visual_layout_fidelity', 'Visual layout fidelity',
   'Is the overall flow, containment hierarchy and set of connections accurate to the source?'],
  ['VFS_geometric_layout_fidelity', 'Geometric layout fidelity',
   'Is the spatial layout, relative positioning and alignment consistent with the source?'],
  ['VFS_proportion_scale_fidelity', 'Proportion & scale fidelity',
   'Are element sizes, scales and aspect ratios accurate to the original?'],
  ['VFS_text_typographic_integrity', 'Text & typographic integrity',
   'Are text labels and mathematical symbols legible and accurate?'],
  ['VFS_visual_quality_and_style_matching', 'Style and aesthetics',
   'Do the colours and treatment reflect the original diagram?'],
];

/** each animation style is compliant against its own rules */
const ASC_CHECKS = {
  'progressive reveal': [
    'Starts from a blank canvas',
    'Elements always build up, cumulatively',
    'Nothing disappears once it has been revealed',
  ],
  'alpha masking': [
    'Starts from a semi-transparent view of the whole diagram',
    'Each element is progressively unmasked',
    'Each element is masked again once its step is over',
  ],
  'colour pop': [
    'Starts from a fully greyscale canvas',
    'Colour is restored progressively and cumulatively',
    'Restored colour matches the source diagram',
  ],
  'hopping bbox': [
    'Exactly one red bounding box, present throughout',
    'The box hops rather than slides between elements',
    'Each hop follows the animation sequence',
  ],
  'sliding bbox': [
    'Exactly one red bounding box, present throughout',
    'The box slides rather than jumps between elements',
    'Each move follows the animation sequence',
  ],
};
const ASC_GENERIC = [
  'The fundamental rules of the style are followed',
  'The style is applied consistently to every element',
  'No transition breaks the style outright',
];

const QMETRICS = [
  ['SSS', 'SS', 'Selection Sensibility', 'Are the selected elements appropriate and correct?'],
  ['GPS', 'GP', 'Granularity &amp; Pacing', 'Is the amount revealed at each step appropriate?'],
  ['NAS', 'NA', 'Narration Alignment', 'Does the narration align with and explain the visual?'],
];

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const f4 = (v) => (v == null ? '—' : Number(v).toFixed(4));
const styleKey = (s) => (s || '').toLowerCase().replace(/\s*bounding\s*box/, ' bbox').trim();

class EvalLab extends HTMLElement {
  async connectedCallback() {
    const src = this.getAttribute('src') || 'data/evaluation_runs.json';
    try { this.data = await loadJSON(src); }
    catch { this.innerHTML = `<p class="el-empty">Could not load ${esc(src)}.</p>`; return; }
    if (!this.data.baselines?.length) {
      this.innerHTML = '<p class="el-empty">No runs found.</p>'; return;
    }

    this.bi = 0; this.si = 0;
    this.innerHTML = `
      <div class="el">
        <div class="el-bar">
          <div class="el-pick">
            <label><span>1 · Baseline</span>
              <select data-baseline>${this.data.baselines.map((b, i) =>
                `<option value="${i}">${esc(b.label)}</option>`).join('')}</select></label>
            <span class="el-barrow">→</span>
            <label><span>2 · Sample</span><select data-sample></select></label>
          </div>
          <button class="el-run" data-run>
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 3.2 12.6 8l-8.1 4.8z"/></svg>
            Run evaluation
          </button>
        </div>
        <div class="el-flow" data-flow></div>
      </div>`;

    this.addEventListener('change', (e) => {
      if (e.target.matches('[data-baseline]')) { this.bi = +e.target.value; this.si = 0; this.render(); }
      else if (e.target.matches('[data-sample]')) { this.si = +e.target.value; this.render(); }
    });
    this.addEventListener('click', (e) => {
      if (e.target.closest('[data-run]')) return this.run();
      const chip = e.target.closest('[data-step]');
      if (chip) this.focusStep(+chip.dataset.step);
    });
    this.render();
  }

  get baseline() { return this.data.baselines[this.bi]; }
  get sample() { return this.baseline.samples[this.si]; }

  /** the source diagram is the same file whichever baseline animated it */
  sourceImage() {
    const id = this.sample.id;
    if (this.sample.source) return this.sample.source;
    for (const b of this.data.baselines)
      for (const s of b.samples) if (s.id === id && s.source) return s.source;
    return null;
  }

  frames() {
    const s = this.sample;
    return s.raw_frames?.length ? s.raw_frames : s.steps.map(x => x.frame).filter(Boolean);
  }

  /* ───────────────────────── render ───────────────────────── */

  render() {
    this.stopReel?.();
    this.busy = false;
    const b = this.baseline, s = this.sample, d = s.derived;
    this.querySelector('[data-sample]').innerHTML = b.samples.map((x, i) =>
      `<option value="${i}"${i === this.si ? ' selected' : ''}>${esc(x.id)}</option>`).join('');
    const btn = this.querySelector('[data-run]');
    btn.disabled = false;

    this.querySelector('[data-flow]').innerHTML = `
      ${this.stageInputs(s)}
      ${this.wire('to-vf', 'the clip goes to the fidelity judge')}
      ${this.stageGate('VF', s)}
      ${this.wire('to-asc', 'accept band → on to the style gate', 'gate')}
      ${this.stageGate('ASC', s)}
      ${this.wire('to-split', 'both gates open → the clip is broken into frames', 'gate')}
      ${this.stageSplit(s)}
      ${this.stageLanes(s)}
      ${this.stageAgg(s)}`;

    const reel = this.querySelector('[data-reel]');
    const fr = this.frames();
    if (reel && fr.length) this.stopReel = mountReel(reel, fr, { fps: 5 });
    this.focusStep(0);
  }

  stageInputs(s) {
    const src = this.sourceImage();
    const fr = this.frames();
    return `
      <section class="el-stage el-inputs is-live" data-stage="inputs">
        <header class="el-shead">
          <span class="el-num">0</span>
          <h3>The inputs</h3>
          <span class="el-sp"></span>
        </header>
        <div class="el-io">
          <figure class="el-iobox">
            <figcaption>Source diagram <i>D</i></figcaption>
            ${src ? `<img src="${esc(src)}" alt="">`
                  : `<div class="el-ph">no source image for this sample</div>`}
            <span class="el-ionote">${esc(s.id)}</span>
          </figure>
          <div class="el-plus">+</div>
          <figure class="el-iobox">
            <figcaption>Animated narrative <i>V</i></figcaption>
            <div class="el-reel">
              <span class="el-perf"></span>
              <div class="el-reelbody">
                ${s.video
                  ? `<video src="${esc(s.video)}" muted loop playsinline autoplay preload="metadata"></video>`
                  : fr.length ? `<img data-reel alt="">`
                  : `<div class="el-ph">no clip for this run</div>`}
              </div>
              <span class="el-perf"></span>
            </div>
            <span class="el-ionote">${s.video ? 'rendered clip'
              : fr.length ? `${fr.length} frames, played back` : '—'}</span>
          </figure>
        </div>
      </section>`;
  }

  /** a gate: its checklist, the judge's own words per item, then the band */
  stageGate(key, s) {
    const isVF = key === 'VF';
    const band = s.bands[key];
    const rat = s.rationale?.[key] || {};
    const ran = !!band;
    const pass = isVF ? s.derived.vf_pass : s.derived.asc_pass;
    const title = isVF ? 'Visual Fidelity' : 'Animation Style Compliance';
    const abbr = isVF ? 'VFS' : 'ASCS';
    const fps = isVF ? 2 : 4;

    const rows = isVF
      ? VFS_CRITERIA.map(([k, name, q], i) => this.critRow(i, name, q, rat.criteria?.[k]))
      : (ASC_CHECKS[styleKey(s.style)] || ASC_GENERIC)
          .map((c, i) => this.critRow(i, c, '', i === 0 ? rat.summary : null));

    if (!ran) return '';            // never asked: the stage does not exist at all

    return `
      <section class="el-stage el-gate is-${key.toLowerCase()}"
               data-stage="${key}" data-pass="${pass ? 1 : 0}">
        <header class="el-shead">
          <span class="el-num">${isVF ? 1 : 2}</span>
          <h3>${title} <span class="el-abbr">${abbr}</span></h3>
          <span class="el-sp"></span>
          <span class="el-meta">gate · ${fps} FPS</span>
        </header>

        <div class="el-gatebody">
          <ul class="el-crits" data-crits>${rows.join('')}</ul>
          <aside class="el-verdict" data-verdict>
            <div class="el-vlabel">Judgment</div>
            <div class="el-score"><b data-score>–</b><em>band</em></div>
            <div class="el-bandcol">${ORDER.map(x => `
              <span class="el-band b-${x}" data-band="${x}">
                <b>${x}</b><i>${esc(BAND_WORD[key][x])}</i>
                <em>${ACCEPT.includes(x) ? 'pass' : 'discard'}</em></span>`).join('')}</div>
          </aside>
        </div>
        ${rat.summary && isVF ? `<p class="el-summary" data-summary>
          <span>summary</span>${esc(rat.summary)}</p>` : ''}
        <p class="el-outcome" data-outcome></p>
      </section>`;
  }

  critRow(i, name, q, rationale) {
    return `
      <li class="el-crit" style="--i:${i}">
        <span class="el-tick"></span>
        <div>
          <b>${name}</b>
          ${q ? `<span class="el-critq">${q}</span>` : ''}
          ${rationale ? `<p class="el-rat"><span class="el-dots"><i></i><i></i><i></i></span>
            <span class="el-rattext">${esc(rationale)}</span></p>` : ''}
        </div>
      </li>`;
  }

  wire(id, text, kind = '') {
    return `<div class="el-wire ${kind ? 'is-' + kind : ''}" data-wire="${id}">
      <span class="el-packet"></span><span class="el-wtext">${esc(text)}</span></div>`;
  }

  stageSplit(s) {
    const steps = s.steps;
    return `
      <section class="el-stage el-split" data-stage="split">
        <header class="el-shead">
          <span class="el-num">3</span>
          <h3>The clip becomes ${steps.length || '—'} presentation steps</h3>
          <span class="el-sp"></span>
          <span class="el-meta">frames → the quality judges</span>
        </header>
        <div class="el-strip" data-strip>${steps.map((st, i) => `
          <figure class="el-frame" data-step="${i}" style="--i:${i}">
            ${st.frame ? `<img src="${esc(st.frame)}" alt="step ${st.t}" loading="lazy">`
                       : `<div class="el-ph is-sm">${st.t}</div>`}
            <figcaption>${st.t}</figcaption>
          </figure>`).join('')}</div>
      </section>`;
  }

  /** the three judges, working down the same frames at the same time */
  stageLanes(s) {
    const steps = s.steps;
    return `
      <section class="el-stage el-lanes" data-stage="lanes">
        <header class="el-shead">
          <span class="el-num">4</span>
          <h3>Three judges, every step, in parallel</h3>
          <span class="el-sp"></span>
          <span class="el-meta">A B C D → 4 3 2 1</span>
        </header>
        <div class="el-lanewrap">
          ${QMETRICS.map(([k, short, name, q]) => `
            <div class="el-lane m-${k.toLowerCase()}" data-lane="${k}">
              <div class="el-lanehead">
                <b>${short}</b><i>${name}</i><span>${q}</span>
              </div>
              <div class="el-chips">${steps.map((st, i) => {
                const b = st[k.toLowerCase()];
                return `<span class="el-chip" data-step="${i}" data-lane-chip
                              style="--i:${i}" data-band="${b || ''}">${b ? NUM[b] : '·'}</span>`;
              }).join('')}</div>
            </div>`).join('')}
        </div>
        <div class="el-focus" data-focus></div>
      </section>`;
  }

  stageAgg(s) {
    const d = s.derived;
    const m = d.metrics;
    return `
      <section class="el-stage el-agg" data-stage="agg">
        <header class="el-shead">
          <span class="el-num">5</span>
          <h3>Aggregation</h3>
          <span class="el-sp"></span>
          <span class="el-meta"><i>d</i><sub>o</sub> = 1/3<i>N</i> · Σ |4 − <i>j<sub>t</sub></i>| &nbsp;·&nbsp; Q = 1 − <i>d</i><sub>o</sub></span>
        </header>
        <div class="el-qrow">
          ${QMETRICS.map(([k, short]) => {
            const mm = m?.[k];
            return `<div class="el-qbox m-${k.toLowerCase()}" data-q="${k}">
              <span class="el-qname">Q<sub>${short}</sub></span>
              <b data-qval>–</b>
              <em>${mm ? `d<sub>o</sub> = ${mm.d_o.toFixed(4)}` : 'not computed'}</em>
            </div>`;
          }).join('')}
        </div>
        <div class="el-final">
          <div class="el-fbox" data-final="G"><span>Validity gate</span><b data-fval>–</b>
            <em>${d.G ? 'both gates open' : `closed at the ${d.gated_at || 'first'} gate`}</em></div>
          <div class="el-fop">×</div>
          <div class="el-fbox" data-final="Qn"><span>Narrative quality <i>Q<sub>n</sub></i></span>
            <b data-fval>–</b><em>${d.Qn == null ? 'never computed' : 'mean of the three'}</em></div>
          <div class="el-fop">=</div>
          <div class="el-fbox is-out" data-final="AN"><span>Animated Narrative Score</span>
            <b data-fval>–</b><em>AN = <i>G</i> · <i>Q<sub>n</sub></i></em></div>
        </div>
      </section>`;
  }

  /* ───────────────────────── interaction ───────────────────────── */

  focusStep(i) {
    const s = this.sample, steps = s.steps;
    const box = this.querySelector('[data-focus]');
    if (!box) return;
    if (!steps.length) { box.innerHTML = ''; return; }
    const k = Math.max(0, Math.min(steps.length - 1, i));
    this.step = k;
    const st = steps[k];
    box.innerHTML = `
      <figure class="el-focusframe">
        ${st.frame ? `<img src="${esc(st.frame)}" alt="">` : `<div class="el-ph is-sm">—</div>`}
        <figcaption>step ${st.t} of ${steps.length}</figcaption>
      </figure>
      <div class="el-focusbody">
        <p class="el-narr"><span>narration at this step</span>${esc(st.narration || '—')}</p>
        <div class="el-focusjudge">${QMETRICS.map(([key, short]) => {
          const b = st[key.toLowerCase()];
          return `<span class="el-fj m-${key.toLowerCase()}" data-band="${b || ''}">
            <b>${b ? NUM[b] : '·'}</b><i>${short}</i>
            <em>${b ? esc(BAND_WORD[key][b]) : 'not judged'}</em></span>`;
        }).join('')}</div>
      </div>`;
    this.querySelectorAll('[data-step]').forEach(n =>
      n.classList.toggle('is-on', +n.dataset.step === k));
  }

  /* ───────────────────────── the run ───────────────────────── */

  async run() {
    if (this.busy) return;
    this.busy = true;
    const s = this.sample, d = s.derived;
    const flow = this.querySelector('[data-flow]');
    const btn = this.querySelector('[data-run]');
    btn.disabled = true;
    btn.classList.add('is-running');

    // back to the resting state the svg uses: everything dimmed, every value a dash
    flow.classList.add('is-armed');
    flow.querySelectorAll('.el-stage').forEach(n => n.classList.remove('is-live', 'is-done'));
    flow.querySelector('[data-stage="inputs"]').classList.add('is-live');
    flow.querySelectorAll('.el-wire').forEach(n => n.classList.remove('is-live'));
    flow.querySelectorAll('.el-crit').forEach(n => n.classList.remove('is-thinking', 'is-done'));
    flow.querySelectorAll('[data-band]').forEach(n => n.classList.remove('is-on'));
    flow.querySelectorAll('[data-score], [data-qval], [data-fval]').forEach(n => n.textContent = '–');
    flow.querySelectorAll('.el-chip').forEach(n => n.classList.remove('is-in'));
    flow.querySelectorAll('.el-frame').forEach(n => n.classList.remove('is-in'));
    flow.querySelectorAll('[data-outcome]').forEach(n => { n.textContent = ''; n.className = 'el-outcome'; });
    flow.querySelector('[data-summary]')?.classList.remove('is-in');

    const see = (el) => el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const live = async (sel, ms = 420) => {
      const el = typeof sel === 'string' ? flow.querySelector(sel) : sel;
      if (!el) return null;
      el.classList.add('is-live'); see(el); await wait(ms);
      return el;
    };

    await wait(250);
    await live('[data-wire="to-vf"]', 700);

    const vfOpen = await this.runGate('VF', flow, see);
    if (!vfOpen) return this.finishRun(s, flow, btn, false);

    await live('[data-wire="to-asc"]', 650);
    const ascOpen = await this.runGate('ASC', flow, see);
    if (!ascOpen) return this.finishRun(s, flow, btn, false);

    await live('[data-wire="to-split"]', 650);

    // the clip deals itself out into frames
    const split = await live('[data-stage="split"]', 260);
    const frames = [...flow.querySelectorAll('.el-frame')];
    for (const f of frames) { f.classList.add('is-in'); await wait(45); }
    await wait(320);

    // three lanes filling at once, left to right
    const lanes = await live('[data-stage="lanes"]', 240);
    const N = s.steps.length;
    for (let t = 0; t < N; t++) {
      flow.querySelectorAll(`.el-chip[data-step="${t}"]`).forEach(c => c.classList.add('is-in'));
      this.focusStep(t);
      await wait(Math.max(90, 520 - N * 22));
    }
    await wait(300);

    // aggregation, one number at a time
    await live('[data-stage="agg"]', 260);
    for (const [k] of QMETRICS) {
      const box = flow.querySelector(`[data-q="${k}"]`);
      const v = d.metrics?.[k]?.Q;
      box.classList.add('is-in');
      await this.countTo(box.querySelector('[data-qval]'), v, 520);
      await wait(120);
    }
    await wait(180);
    const gBox = flow.querySelector('[data-final="G"]');
    gBox.classList.add('is-in');
    gBox.querySelector('[data-fval]').textContent = String(d.G);
    await wait(360);
    const qBox = flow.querySelector('[data-final="Qn"]');
    qBox.classList.add('is-in');
    await this.countTo(qBox.querySelector('[data-fval]'), d.Qn, 620);
    await wait(320);
    const aBox = flow.querySelector('[data-final="AN"]');
    aBox.classList.add('is-in', 'is-flash');
    await this.countTo(aBox.querySelector('[data-fval]'), d.AANS, 820);

    this.finishRun(s, flow, btn, true);
  }

  /** one gate: checklist items think, then resolve, then the band lands */
  async runGate(key, flow, see) {
    const s = this.sample;
    const band = s.bands[key];
    const stage = flow.querySelector(`[data-stage="${key}"]`);
    if (!band || !stage) return false;  // never asked: nothing to show, nothing to open

    stage.classList.add('is-live'); see(stage);
    await wait(360);

    for (const row of stage.querySelectorAll('.el-crit')) {
      row.classList.add('is-thinking');
      await wait(row.querySelector('.el-rattext') ? 520 : 200);
      row.classList.remove('is-thinking');
      row.classList.add('is-done');
      await wait(190);
    }

    await wait(220);
    stage.querySelector('[data-summary]')?.classList.add('is-in');
    const chip = stage.querySelector(`[data-band="${band}"]`);
    chip?.classList.add('is-on');
    const score = stage.querySelector('[data-score]');
    if (score) { score.textContent = band; score.classList.add('is-flash'); }
    await wait(560);

    const pass = ACCEPT.includes(band);
    const out = stage.querySelector('[data-outcome]');
    if (out) {
      out.className = `el-outcome is-${pass ? 'pass' : 'fail'}`;
      out.innerHTML = pass
        ? `Band <b>${band}</b> — accept band, the animation continues.`
        : `Band <b>${band}</b> — discard band. The evaluation stops here, <i>G</i> = 0 and AN = 0.`;
    }
    stage.classList.add('is-done');
    await wait(520);
    return pass;
  }

  /** the gate closed: push the zeros through so the ending is still explicit */
  finishRun(s, flow, btn, passed) {
    if (!passed) {
      flow.querySelector('[data-stage="agg"]')?.classList.add('is-live');
      const set = (which, text, flash) => {
        const box = flow.querySelector(`[data-final="${which}"]`);
        if (!box) return box;
        box.classList.add('is-in', ...(flash ? ['is-flash'] : []));
        const val = box.querySelector('[data-fval]');
        if (val) val.textContent = text;
        return box;
      };
      set('G', '0');
      set('Qn', '—');
      set('AN', '0.0000', true)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    flow.classList.remove('is-armed');
    btn.disabled = false;
    btn.classList.remove('is-running');
    this.busy = false;
  }

  /** Stepped on a timer rather than rAF: a backgrounded tab pauses animation
   *  frames entirely, which would strand the run mid-count with Run disabled. */
  async countTo(el, value, ms) {
    if (!el) return;
    if (value == null) { el.textContent = '—'; return; }
    const t0 = performance.now();
    return new Promise(done => {
      const tick = () => {
        const p = Math.min(1, (performance.now() - t0) / ms);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = (value * eased).toFixed(4);
        if (p < 1) setTimeout(tick, 16);
        else { el.textContent = Number(value).toFixed(4); el.classList.add('is-flash'); done(); }
      };
      tick();
    });
  }
}

customElements.define('eval-lab', EvalLab);
