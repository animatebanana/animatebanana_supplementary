import { loadJSON } from '../lib/data-loader.js';
import { mountReel } from '../lib/reel-player.js';

/**
 * <eval-walkthrough src="data/evaluation_runs.json">
 *
 * One run through the scheme, top to bottom: the inputs, the two gates, and —
 * only if both open — the video broken into frames, the three quality judges on
 * every frame, the sequence roll-up, and AANS.
 *
 * The gating judges are shown the video; the quality judges are shown the
 * frames. Every number comes from scripts/build_eval_runs.py, which computes it
 * from the judges' band strings; this file only displays.
 */

const NUM = { A: 4, B: 3, C: 2, D: 1 };
const GATE_BANDS = ['A', 'B', 'C', 'D'];
const ACCEPT = 'AB';
const BAND_WORD = {
  VF:  { A: 'Excellent', B: 'Good', C: 'Poor', D: 'Severe failure' },
  ASC: { A: 'Fully compliant', B: 'Mostly compliant', C: 'Non-compliant', D: 'Severe non-compliance' },
  SSS: { A: 'Fully sensible', B: 'Minor violations', C: 'Major violation', D: 'Severe violation' },
  GPS: { A: 'Well paced', B: 'Minor overload', C: 'Major overload', D: 'Severe overload' },
  NAS: { A: 'Well aligned', B: 'Minor flaws', C: 'Major flaws', D: 'Severe flaws' },
};
const METRICS = [
  ['SSS', 'Selection Sensibility', 'Are these the right elements to animate at this step?'],
  ['GPS', 'Granularity &amp; Pacing', 'Is this a reasonable amount to take in at once?'],
  ['NAS', 'Narration Alignment', 'Does the narration explain what is happening now?'],
];
const VF_CRITERIA = [
  ['Element alteration', 'No distortion or morphing mid-video'],
  ['Visual layout fidelity', 'Flow, containment hierarchy, connections'],
  ['Geometric layout fidelity', 'Spatial layout, positioning, alignment'],
  ['Proportion &amp; scale fidelity', 'Element sizes and aspect ratios'],
  ['Text &amp; typographic integrity', 'Labels and symbols legible and accurate'],
  ['Style and aesthetics', 'Colours and treatment reflect the source'],
];
const VF_CHECKS = [
  'Element alteration — does anything distort or morph mid-clip until it is wrong?',
  'Visual layout — is the flow, the containment hierarchy and every connection still the source diagram’s?',
  'Geometric layout — does the spatial arrangement and alignment hold?',
  'Proportion and scale — are sizes and aspect ratios faithful?',
  'Text and typography — is every label and symbol legible and correct?',
  'Style and aesthetics — do the colours read as the original diagram’s?',
];
const ASC_CHECKS = {
  'progressive reveal': ['Does it open on a blank canvas?',
                         'Does the build-up stay cumulative, never subtracting?',
                         'Does anything vanish after it has been revealed?'],
  'alpha masking': ['Does it open on a semi-transparent view of the whole diagram?',
                    'Is each element unmasked in sequence?',
                    'Is each element masked again once its step is over?'],
  'colour pop': ['Does it open on a fully greyscale canvas?',
                 'Is colour restored progressively and cumulatively?',
                 'Does the restored colour match the source diagram?'],
  'hopping bounding box': ['Is there exactly one red box, present throughout?',
                           'Does it hop rather than slide between elements?',
                           'Does each hop land on the next element in the sequence?'],
  'sliding bounding box': ['Is there exactly one red box, present throughout?',
                           'Does it slide rather than jump between elements?',
                           'Does each move follow the animation sequence?'],
};
const ASC_GENERIC = ['Are the fundamental rules of this style followed?',
                     'Is the style applied consistently to every element?',
                     'Does any transition break it outright?'];
const VERDICT = {
  VF:  { A: 'true to the source and stable throughout',
         B: 'small deviations, still unmistakably the same diagram',
         C: 'poor fidelity — the diagram is not preserved',
         D: 'severe failure — this is not the source diagram any more' },
  ASC: { A: 'every rule, on every transition',
         B: 'the major rules hold for every element; only the opening deviates',
         C: 'the rules of the style are not followed consistently',
         D: 'the style is broken throughout' },
};
const OPENER = {
  VF: (style) => `Sampling the clip at 2 FPS${style ? `, with the ${style.toLowerCase()} rule set in hand so its quirks are not counted as damage` : ''}.`,
  ASC: () => 'Sampling at 4 FPS — the transitions here are quick, and a sparse sample invites hallucination.',
};
const OUTCOME = {
  vf_fail:  ['Discarded at the VF gate', 'stop'],
  asc_fail: ['Discarded at the ASC gate', 'stop'],
  pass_low: ['Valid', 'warn'],
  pass_high:['Valid', 'go'],
};

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const f4 = (v) => (v == null ? '—' : Number(v).toFixed(4));

const ICON_DIAGRAM = `<svg viewBox="0 0 40 30" aria-hidden="true"><rect x="1" y="6" width="12" height="8" rx="2"/><rect x="27" y="2" width="12" height="8" rx="2"/><rect x="27" y="19" width="12" height="8" rx="2"/><path d="M13 10h8v-4h6M21 10v13h6"/></svg>`;
const ICON_FILM = `<svg viewBox="0 0 40 30" aria-hidden="true"><rect x="1" y="4" width="38" height="22" rx="3"/><path d="M1 9h38M1 21h38"/></svg>`;

class EvalWalkthrough extends HTMLElement {
  async connectedCallback() {
    const src = this.getAttribute('src') || 'data/evaluation_runs.json';
    try { this.data = await loadJSON(src); }
    catch (e) { this.innerHTML = `<p class="ev-empty">Could not load ${esc(src)}.</p>`; return; }
    if (!this.data.baselines || !this.data.baselines.length) {
      this.innerHTML = '<p class="ev-empty">No runs in EVALUATIONS_PAGE yet.</p>'; return;
    }
    this.bi = 0; this.si = 0; this.step = 0;
    this.innerHTML = `
      <div class="ev">
        <div class="ev-bar">
          <label class="ev-pick"><span>1 &middot; Baseline</span>
            <select data-baseline>${this.data.baselines.map((b, i) =>
              `<option value="${i}">${esc(b.label)}</option>`).join('')}</select></label>
          <span class="ev-arrowsm">&rarr;</span>
          <label class="ev-pick"><span>2 &middot; Sample</span><select data-sample></select></label>
          <span class="ev-sp"></span>
          <button class="ev-run" data-run>Run evaluation</button>
        </div>
        <div class="ev-body"></div>
      </div>`;
    this.addEventListener('change', (e) => {
      if (e.target.matches('[data-baseline]')) { this.bi = +e.target.value; this.si = 0; this.render(); }
      if (e.target.matches('[data-sample]')) { this.si = +e.target.value; this.render(); }
    });
    this.addEventListener('click', (e) => {
      if (e.target.closest('[data-run]')) return this.play();
      const c = e.target.closest('[data-step]');
      if (c) this.pick(+c.dataset.step);
    });
    this.render();
  }

  get baseline() { return this.data.baselines[this.bi]; }
  get sample() { return this.baseline.samples[this.si]; }

  /** the same sample elsewhere in the benchmark, for a real clip and a real source image */
  sibling() {
    const id = this.sample.id;
    const out = { video: null, source: this.sample.source || null };
    for (const b of this.data.baselines) {
      for (const s of b.samples) {
        if (s.id !== id) continue;
        if (!out.source && s.source) out.source = s.source;
        if (!out.video && s.video) out.video = { src: s.video, from: b.label };
      }
    }
    return out;
  }

  render() {
    (this._stopReels || []).forEach(fn => fn());
    this._stopReels = [];
    const b = this.baseline, s = this.sample, d = s.derived;
    this.querySelector('[data-sample]').innerHTML = b.samples.map((x, i) =>
      `<option value="${i}"${i === this.si ? ' selected' : ''}>${esc(x.id)}</option>`).join('');

    this.step = 0;
    this.querySelector('.ev-body').innerHTML = `
      ${this.inputs(s)}
      ${this.gate('VF', 'Visual Fidelity', 'VFS', s, 2,
                  'Is the animation true to the source diagram, and stable while it plays?')}
      ${this.link(d.vf_pass, d.vf_pass
          ? 'Band A or B — accepted, on to the style gate'
          : 'Band C or D — discarded. G = 0, AANS = 0')}
      ${d.vf_pass ? this.gate('ASC', 'Animation Style Compliance', 'ASCS', s, 4,
                  'Was the requested style actually applied, throughout the whole video?')
                  : this.naGate()}
      ${d.vf_pass ? this.link(d.asc_pass, d.asc_pass
          ? 'Band A or B — accepted, the animation is valid'
          : 'Band C or D — discarded. G = 0, AANS = 0') : ''}
      ${d.G ? this.split(s) : this.halted(d.gated_at)}
      ${d.G && d.N ? this.frames(s) : ''}
      ${d.G && d.metrics ? this.rollup(s) : ''}
      ${this.final(s)}`;
    const reel = this.querySelector('[data-reel]');
    const frames = this.mediaFrames(s);
    if (reel && frames.length) this._stopReels.push(mountReel(reel, frames, { fps: 5 }));
    if (d.G && d.N) this.pick(0);
  }

  /** this run's own frames, judged or not — the reel to fall back on when no clip was kept */
  mediaFrames(s) {
    if (s.raw_frames && s.raw_frames.length) return s.raw_frames;
    return s.steps.map(x => x.frame).filter(Boolean);
  }

  /* ---------- the inputs ---------- */
  inputs(s) {
    const sib = this.sibling();
    const frames = this.mediaFrames(s);
    const own = s.video ? { kind: 'video', src: s.video }
              : frames.length ? { kind: 'reel', n: frames.length }
              : sib.video ? { kind: 'video', src: sib.video.src, from: sib.video.from }
              : null;
    return `
      <section class="ev-card ev-inputs" data-node="inputs">
        <div class="ev-head">
          <span class="ev-kicker">Step 0 &middot; the inputs</span>
          <h3>The source diagram, and the animation to be judged</h3>
          <span class="ev-sp"></span>
          <span class="ev-judge">${s.style ? esc(s.style) : 'style not recorded'}</span>
        </div>
        <div class="ev-io">
          <figure class="ev-iobox">
            <figcaption>Source diagram <i>D</i></figcaption>
            ${sib.source ? `<img src="${esc(sib.source)}" alt="" loading="lazy">`
                         : `<div class="ev-ph">${ICON_DIAGRAM}<span>add this sample's image to <code>Original_Image/</code></span></div>`}
          </figure>
          <div class="ev-ioarrow">&rarr;</div>
          <figure class="ev-iobox">
            <figcaption>Animated narrative <i>V</i> &mdash; what both gates watch</figcaption>
            <div class="ev-film"><div class="ev-filmbody">
              <span class="ev-perf"></span>
              ${own && own.kind === 'video'
                ? `<video src="${esc(own.src)}" controls muted loop playsinline autoplay preload="metadata"></video>`
                : own && own.kind === 'reel' ? `<img data-reel alt="" loading="lazy">`
                : `<div class="ev-ph">${ICON_FILM}<span>no clip for this run</span></div>`}
              <span class="ev-perf"></span>
            </div></div>
            ${own && own.kind === 'video' && own.from
              ? `<span class="ev-fromnote">same sample, clip from ${esc(own.from)}</span>`
              : own && own.kind === 'reel' ? `<span class="ev-fromnote">${own.n} extracted frames, played back</span>` : ''}
          </figure>
        </div>
      </section>`;
  }

  /* ---------- the gates ---------- */
  gate(key, name, abbr, s, fps, question) {
    const b = s.bands[key];
    const pass = key === 'VF' ? s.derived.vf_pass : s.derived.asc_pass;
    const checks = key === 'VF' ? VF_CHECKS
      : (ASC_CHECKS[(s.style || '').toLowerCase()] || ASC_GENERIC);
    const items = key === 'VF'
      ? VF_CRITERIA.map(([t, h], i) => `<li style="--i:${i}"><b>${t}</b><em>${h}</em></li>`).join('')
      : checks.map((c, i) => `<li style="--i:${i}"><b>${esc(c)}</b></li>`).join('');
    return `
      <section class="ev-card ev-gate is-${pass ? 'pass' : 'fail'}" data-node="${key}">
        <div class="ev-head">
          <span class="ev-kicker">Gating metric &middot; judged on the video at ${fps} FPS</span>
          <h3>${name} <span class="ev-abbr">${abbr}</span></h3>
        </div>
        <p class="ev-q">${question}</p>
        <div class="ev-gatebody">
          <div class="ev-cloud" data-cloud>
            <div class="ev-cloudhead">selection &amp; reasoning</div>
            <ol>
              <li class="is-open">${esc(OPENER[key](s.style))}</li>
              ${checks.map((c, i) => `<li class="ev-check" style="--i:${i + 1}">${esc(c)}</li>`).join('')}
              <li class="is-verdict" style="--i:${checks.length + 1}">Band ${b} — ${esc(VERDICT[key][b] || '')}.</li>
            </ol>
          </div>
          <ul class="ev-crit">${items}</ul>
        </div>
        <div class="ev-verdict" data-verdict>
          <div class="ev-bands">${GATE_BANDS.map(x => `
            <span class="ev-band is-${x === b ? 'on' : 'off'} ${ACCEPT.includes(x) ? 'is-accept' : 'is-discard'}">
              <b>${x}</b><i>${esc(BAND_WORD[key][x])}</i>
              <em>${ACCEPT.includes(x) ? 'accept' : 'discard'}</em></span>`).join('')}</div>
          <p class="ev-gateline is-${pass ? 'pass' : 'fail'}">
            Band ${b} &mdash; ${pass ? 'accept band, evaluation continues'
                                     : 'discard band, evaluation stops here'}</p>
        </div>
      </section>`;
  }

  naGate() {
    return `
      <section class="ev-card ev-gate is-na" data-node="ASC">
        <div class="ev-head">
          <span class="ev-kicker">Gating metric</span>
          <h3>Animation Style Compliance <span class="ev-abbr">ASCS</span></h3>
        </div>
        <div class="ev-cloud is-na">
          <div class="ev-cloudhead">not applicable</div>
          <p>The fidelity gate had already closed, so this judge was never run — the field
            reads <code>NA</code> rather than a band, and there is no reasoning to show.</p>
        </div>
      </section>`;
  }

  link(pass, text) {
    return `<div class="ev-link is-${pass ? 'pass' : 'fail'}">
      <span class="ev-linkdot"></span><span class="ev-linktext">${esc(text)}</span></div>`;
  }

  halted(where) {
    return `<section class="ev-card ev-halt" data-node="halt">
      <b>Evaluation stops at the ${esc(where || 'gate')} gate.</b>
      <span>The quality judges never see this animation: no frames are extracted, and SSS,
        GPS and NAS are never computed — all three read <code>NA</code> in the judge's file.
        G = 0, so AANS = 0 whatever the narrative would have been worth.</span></section>`;
  }

  /* ---------- video becomes frames ---------- */
  split(s) {
    return `
      <section class="ev-card ev-split" data-node="split">
        <div class="ev-head">
          <span class="ev-kicker">Both gates open</span>
          <h3>The video is broken into its ${s.derived.N} presentation steps</h3>
          <span class="ev-sp"></span>
          <span class="ev-judge">frames &rarr; the quality judges</span>
        </div>
        <div class="ev-striprow">${s.steps.map((st, i) => `
          <figure class="ev-strip" data-step="${i}">
            ${st.frame ? `<img src="${esc(st.frame)}" alt="frame ${i + 1}" loading="lazy">`
                       : `<div class="ev-ph is-small"><span>${i + 1}</span></div>`}
            <figcaption>${i + 1}</figcaption>
          </figure>`).join('')}</div>
      </section>`;
  }

  /* ---------- per-frame judging ---------- */
  frames(s) {
    const head = s.steps.map(st => `<th>${st.t}</th>`).join('');
    const rows = METRICS.map(([k, name]) => `
      <tr>
        <th class="ev-mname"><b>${k}</b><i>${name}</i></th>
        ${s.steps.map((st, i) => {
          const band = st[k.toLowerCase()];
          return `<td data-step="${i}" class="ev-cell is-${band || 'x'}">${band ? NUM[band] : '·'}</td>`;
        }).join('')}</tr>`).join('');
    return `
      <section class="ev-card ev-frames" data-node="frames">
        <div class="ev-head">
          <span class="ev-kicker">Quality metrics &middot; judged per frame, three in parallel</span>
          <h3>One ordinal judgment per metric, at every step</h3>
          <span class="ev-sp"></span>
          <span class="ev-judge">${s.derived.N} frames</span>
        </div>
        <div class="ev-framewrap">
          <div class="ev-trio" data-trio></div>
          <div class="ev-judgecol">
            <p class="ev-narr" data-narr></p>
            <div class="ev-jrow" data-judges></div>
          </div>
        </div>
        <div class="ev-tablewrap">
          <table class="ev-grid">
            <thead><tr><th class="ev-mname">Presentation step <i>t</i></th>${head}</tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </section>`;
  }

  pick(i) {
    const s = this.sample;
    if (!s.derived.G || !s.steps.length) return;
    this.step = Math.max(0, Math.min(s.steps.length - 1, i));
    const k = this.step, st = s.steps[k];
    const trio = [s.steps[k - 1], st, s.steps[k + 1]];
    const labels = ['step <i>t</i> &minus; 1', 'step <i>t</i>', 'step <i>t</i> + 1'];
    const box = this.querySelector('[data-trio]');
    if (box) box.innerHTML = trio.map((x, n) => `
      <figure class="ev-tframe${n === 1 ? ' is-now' : ''}">
        <figcaption>${labels[n]}</figcaption>
        ${x && x.frame ? `<img src="${esc(x.frame)}" alt="" loading="lazy">`
                       : `<div class="ev-ph is-small"><span>${n === 0 ? 'no previous frame — not sent for the first step' : 'end of the sequence'}</span></div>`}
      </figure>`).join('');
    const nar = this.querySelector('[data-narr]');
    if (nar) nar.innerHTML = `<span>narration at step ${st.t}</span>${esc(st.narration || '—')}`;
    const col = this.querySelector('[data-judges]');
    if (col) col.innerHTML = METRICS.map(([key, name, q]) => {
      const band = st[key.toLowerCase()];
      return `<div class="ev-jcard is-${band || 'x'}">
        <span class="ev-jnum">${band ? NUM[band] : '·'}</span>
        <b>${key}</b><i>${band ? esc(BAND_WORD[key][band]) : 'not judged'}</i>
        <p>${q}</p></div>`;
    }).join('');
    this.querySelectorAll('.ev-cell, .ev-strip').forEach(n =>
      n.classList.toggle('is-on', +n.dataset.step === this.step));
  }

  /* ---------- roll-up + final ---------- */
  rollup(s) {
    const d = s.derived;
    const cards = METRICS.map(([k]) => {
      const m = d.metrics[k], js = s.steps.map(x => NUM[x[k.toLowerCase()]]);
      const sum = m.dists.reduce((a, b) => a + b, 0);
      return `<div class="ev-qcard">
        <div class="ev-qhead"><b>${k}</b>
          <span>&Sigma;|4 &minus; <i>j<sub>t</sub></i>| = ${sum} &nbsp;/&nbsp; 3<i>N</i> = ${3 * m.dists.length}</span></div>
        <table class="ev-ord">
          <tr><th><i>j<sub>t</sub></i></th>${js.map(x =>
            `<td><span class="ev-jchip is-j${x}">${x}</span></td>`).join('')}</tr>
          <tr><th>|4&minus;<i>j</i>|</th>${m.dists.map(x =>
            `<td><span class="ev-dchip is-d${x}">${x}</span></td>`).join('')}</tr>
        </table>
        <div class="ev-qline"><i>d</i><sub>o</sub> = ${m.d_o.toFixed(4)}
          <b>Q<sub>${k}</sub> = ${f4(m.Q)}</b></div>
      </div>`;
    }).join('');
    return `
      <section class="ev-card ev-roll" data-node="roll">
        <div class="ev-head">
          <span class="ev-kicker">Sequence level</span>
          <h3>Ordinal judgments &rarr; one quality score per metric</h3>
        </div>
        <p class="ev-form">Every step contributes its distance from the ideal, 4:
          <code><i>d</i><sub>o</sub> = 1/3<i>N</i> &middot; &Sigma;<sub><i>t</i></sub> |4 &minus; <i>j<sub>t</sub></i>|</code>,
          <code>Q = 1 &minus; <i>d</i><sub>o</sub></code>. Three is the furthest a single step can
          fall, so 3<i>N</i> puts every metric on the same 0&ndash;1 scale.</p>
        <div class="ev-qrow">${cards}</div>
        <div class="ev-qn">Q<sub>n</sub> = ( ${METRICS.map(([k]) => f4(d.metrics[k].Q)).join(' + ')} ) / 3
          = <b>${f4(d.Qn)}</b></div>
      </section>`;
  }

  final(s) {
    const d = s.derived;
    return `
      <section class="ev-card ev-final is-${d.G ? 'go' : 'stop'}" data-node="final">
        <div class="ev-finalrow">
          <div class="ev-fbox"><span>Validity gate</span><b><i>G</i> = ${d.G}</b>
            <i>${d.G ? 'VF and ASC both in an accept band' : 'closed at the ' + d.gated_at + ' gate'}</i></div>
          <div class="ev-op">&times;</div>
          <div class="ev-fbox"><span>Narrative quality</span>
            <b><i>Q<sub>n</sub></i> = ${d.Qn == null ? '—' : f4(d.Qn)}</b>
            <i>${d.G ? 'mean of the three metric scores' : 'never computed'}</i></div>
          <div class="ev-op">=</div>
          <div class="ev-fbox is-out"><span>Animated Narrative Score</span>
            <b>AANS = ${d.AANS == null ? '—' : Number(d.AANS).toFixed(4)}</b>
            <i><i>G</i> &middot; <i>Q<sub>n</sub></i> &isin; [0, 1]</i></div>
        </div>
      </section>`;
  }

  /* ---------- the run-through ---------- */
  async play() {
    if (this.busy) return;
    this.busy = true;
    const btn = this.querySelector('[data-run]');
    btn.disabled = true; btn.textContent = 'Running…';
    const body = this.querySelector('.ev-body');
    body.classList.add('is-running');
    body.querySelectorAll('[data-node], .ev-link, .ev-cloud li, .ev-crit li, [data-verdict], .ev-cell, .ev-strip')
        .forEach(n => n.classList.add('is-hidden'));

    const show = async (n, ms) => {
      n.classList.remove('is-hidden');
      n.scrollIntoView({ block: 'center', behavior: 'smooth' });
      await wait(ms);
    };
    for (const node of body.querySelectorAll('[data-node], .ev-link')) {
      await show(node, 300);
      for (const li of node.querySelectorAll('.ev-cloud li')) await show(li, 600);
      for (const li of node.querySelectorAll('.ev-crit li')) await show(li, 110);
      const v = node.querySelector('[data-verdict]');
      if (v) { await wait(240); await show(v, 560); }
      for (const f of node.querySelectorAll('.ev-strip')) await show(f, 110);
      const cells = [...node.querySelectorAll('.ev-cell')];
      if (cells.length) {
        for (let t = 0; t < this.sample.steps.length; t++) {
          cells.filter(c => +c.dataset.step === t).forEach(c => c.classList.remove('is-hidden'));
          this.pick(t);
          await wait(300);
        }
      }
    }
    body.classList.remove('is-running');
    btn.disabled = false; btn.textContent = 'Run evaluation';
    this.busy = false;
  }
}

customElements.define('eval-walkthrough', EvalWalkthrough);
