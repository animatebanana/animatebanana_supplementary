import { loadJSON } from '../lib/data-loader.js';
import { mountReel } from '../lib/reel-player.js';

/**
 * <metric-scheme src="data/evaluation_runs.json">
 *
 * The evaluation scheme itself, before any example: what each metric asks, what
 * the judge is given, what the four ordinal levels mean, and how the levels
 * become one score. Three panels, in the order the scheme runs —
 * validity, then narrative quality, then aggregation.
 *
 * The worked example in the aggregation panel is not invented: it is a real run
 * out of data/evaluation_runs.json, so the arithmetic on screen is the
 * arithmetic the benchmark actually did.
 */

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const J = { A: 4, B: 3, C: 2, D: 1 };

const ICON_DIAGRAM = `<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1" y="3" width="5" height="4" rx="1"/><rect x="10" y="1" width="5" height="4" rx="1"/><rect x="10" y="8" width="5" height="4" rx="1"/><path d="M6 5h3v-1h2.5M9 5v6.5h1.5"/></svg>`;
const ICON_FRAME = `<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="2" width="13" height="12" rx="1.5"/><path d="M1.5 5.5h13M4.5 2v3.5M11.5 2v3.5"/></svg>`;
const ICON_XML = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3 2 8l3 5M11 3l3 5-3 5M9 2l-2 12"/></svg>`;
const ICON_STYLE = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1 2 6l6 9 6-9-6-5Z"/><path d="M2 6h12"/></svg>`;
const ICON_DOC = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 1.5h6l3 3v10h-9z"/><path d="M9.5 1.5v3h3M5.5 8h5M5.5 10.5h5M5.5 6h2"/></svg>`;

const GATES = [
  {
    key: 'VFS', title: 'Visual Fidelity', abbr: 'VFS',
    q: 'Is the animation true to the source diagram, and stable while it plays?',
    def: `Compares the animation, rendered in its animation style, against the original
          diagram — overall visual fidelity plus temporal stability, meaning no jitter and
          no rendering artefacts. The first gate: it discards animations that are not the
          diagram any more.`,
    judge: 'Gemini 3.6 Flash', fps: 2, input: 'the video',
    adapter: `The animation style is given to the judge as well, so style-specific quirks are
              not mistaken for damage — the red box of a hopping-bbox animation is not an
              artefact, and the grey opening of a colour-pop animation is not a lost palette.`,
    criteria: [
      ['Element alteration', 'Do elements distort or morph mid-video until they are unrecognisable or wrong?'],
      ['Visual layout fidelity', 'Is the overall flow, containment hierarchy and set of connections accurate to the source?'],
      ['Geometric layout fidelity', 'Is the spatial layout, relative positioning and alignment consistent with the source?'],
      ['Proportion & scale fidelity', 'Are element sizes, scales and aspect ratios accurate to the original?'],
      ['Text & typographic integrity', 'Are text labels and mathematical symbols legible and correct?'],
      ['Style and aesthetics', 'Do the colours and treatment reflect the original diagram?'],
    ],
    bands: [['A', 'Excellent', 1], ['B', 'Good', 1], ['C', 'Poor', 0], ['D', 'Severe failure', 0]],
  },
  {
    key: 'ASCS', title: 'Animation Style Compliance', abbr: 'ASCS',
    q: 'Was the requested style actually applied, throughout the whole video?',
    def: `Checks whether the requested animation style has been correctly applied across the
          video. The second gate: it discards animations that break the fundamental rules of
          a style, or apply it so inconsistently that no element is safe.`,
    judge: 'Gemini 3.6 Flash', fps: 4, input: 'the video',
    adapter: `Sampled at twice the rate of the fidelity judge: these clips are short and their
              transitions quick, and a sparse sample invites the judge to hallucinate what
              happened between frames.`,
    criteria: [
      ['Progressive reveal', 'From a blank canvas, elements build up to the full diagram, always cumulative; nothing disappears once revealed.'],
      ['Alpha masking', 'From a semi-transparent view of the whole diagram, elements are progressively unmasked, then masked again.'],
      ['Colour pop', 'From a fully greyscale canvas, elements are progressively and cumulatively restored to their original colour.'],
      ['Hopping bbox', 'A red bounding box hops from one element of focus to the next, following the animation sequence.'],
      ['Sliding bbox', 'A red bounding box slides from one element of focus to the next, following the animation sequence.'],
    ],
    critlabel: 'Each style has its own checklist',
    bands: [['A', 'Fully compliant', 1], ['B', 'Mostly compliant', 1],
            ['C', 'Non-compliant', 0], ['D', 'Severe non-compliance', 0]],
    bandnote: `Band B forgives a non-compliant <em>start</em> — a progressive reveal that does not
               begin on a blank canvas, a colour pop whose first element arrives pre-coloured —
               when everything after it is right.`,
  },
];

const QUALITY = [
  {
    key: 'SSS', title: 'Selection Sensibility', abbr: 'SSS',
    q: 'Are these the right elements to animate at this step?',
    def: `Whether the choice of elements animated at each timestep is a reasonable one. That
          sensibility follows from the flow, hierarchy and relationships already in the
          diagram, which the ground-truth XML schema from AnimateBench makes explicit.`,
    criteria: [
      ['Element appropriateness', 'Is the newly targeted element the correct logical focus for this frame? This catches both elements omitted at a crucial step and the style applied correctly but to the wrong element.'],
      ['Valid grouping', 'If several elements are targeted together, is that grouping logically valid — no dependency constraint violated?'],
    ],
    bands: [[4, 'Fully sensible'], [3, 'Minor violations'], [2, 'Major violation'], [1, 'Severe violation']],
  },
  {
    key: 'GPS', title: 'Granularity & Pacing', abbr: 'GPS',
    q: 'Is this a reasonable amount to take in at once?',
    def: `Whether the volume of elements animated at each timestep is a reasonable chunk
          rather than an overwhelming cognitive load. Two rules set the granularity; the
          third exists to argue back and stop the first two over-penalising.`,
    criteria: [
      ['Volume animated together', 'Sparse, or an overload? Sparsity means the diagram was broken into more steps, and is not penalised.'],
      ['Complexity of the chunk', 'Are the elements targeted together intrinsically complex enough that grouping them overloads the viewer, even when the count is acceptable?'],
      ['Relevance — the shield', 'If a large, complex group is genuinely needed to preserve the explanatory flow, both are excused and the penalty is lowered.'],
    ],
    bands: [[4, 'Well paced'], [3, 'Minor overload'], [2, 'Major overload'], [1, 'Severe overload']],
  },
  {
    key: 'NAS', title: 'Narration Alignment', abbr: 'NAS',
    q: 'Does the narration explain what is happening right now?',
    def: `Whether the commentary on a frame is aligned with the animation playing on it. The
          only judge that also receives a context dump — the paper's title, abstract and
          method section, and the diagram caption where one exists.`,
    criteria: [
      ['Transition alignment', 'Does the narration address what is transitioning, highlighting or appearing in this step? Dwelling on past steps while ignoring the active elements is a violation.'],
      ['Narrative & contextual value', 'Does it explain what the step represents or accomplishes? Concise is fine, insightful is the bar; superficial description is penalised.'],
      ['Coherence & factuality', 'Is it grammatical and logically sound, faithful to the context dump and the text in the diagram — no invented terms, methods or acronyms?'],
    ],
    bands: [[4, 'Well aligned and insightful'], [3, 'Minor flaws'], [2, 'Major flaws'], [1, 'Severe flaws']],
  },
];

class MetricScheme extends HTMLElement {
  async connectedCallback() {
    try { this.data = await loadJSON(this.getAttribute('src') || 'data/evaluation_runs.json'); }
    catch (e) { this.data = null; }
    this.demo = this.pickDemo();
    this.media = this.pickMedia();
    this.open = null;
    this.render();
    this.addEventListener('click', (e) => {
      const card = e.target.closest('[data-metric]');
      if (!card) return;
      const k = card.dataset.metric;
      this.open = this.open === k ? null : k;
      this.render();
    });
  }

  /** the demo sample's own source image, plus its own frames to play back as a reel */
  pickMedia() {
    const out = { source: null, frames: [] };
    if (!this.data || !this.demo) return out;
    const s = this.demo.sample;
    out.source = s.source;
    out.frames = (s.raw_frames && s.raw_frames.length) ? s.raw_frames
               : s.steps.map(x => x.frame).filter(Boolean);
    if (!out.source) {
      for (const b of this.data.baselines || []) {
        for (const x of b.samples || []) if (!out.source && x.source) out.source = x.source;
      }
    }
    return out;
  }

  /** a real passing run, for the worked example and the frame strip */
  pickDemo() {
    if (!this.data) return null;
    for (const b of this.data.baselines || []) {
      for (const s of b.samples || []) {
        if (s.derived.G && s.derived.metrics && s.steps.length >= 3 && s.steps[0].frame) {
          return { baseline: b.label, sample: s };
        }
      }
    }
    return null;
  }

  render() {
    if (this._stopReel) { this._stopReel(); this._stopReel = null; }
    this.innerHTML = `
      <div class="ms">
        ${this.panelA()}
        ${this.panelB()}
        ${this.panelC()}
      </div>`;
    const reel = this.querySelector('[data-reel]');
    if (reel) this._stopReel = mountReel(reel, this.media.frames, { fps: 4 });
  }

  /* ---------------- (a) validity ---------------- */
  panelA() {
    const s = this.demo && this.demo.sample;
    const m = this.media || {};
    const src = m.source || (s && s.source);
    return `
      <section class="ms-panel is-a">
        <header><span class="ms-tag">a</span>
          <h3>Validity</h3>
          <p>Does the animation realise the source diagram, in the style that was asked for?</p>
        </header>

        <div class="ms-inputs">
          <figure class="ms-in"><figcaption>Source diagram <i>D</i></figcaption>
            ${src ? `<img src="${esc(src)}" alt="" loading="lazy">`
                  : `<div class="ms-ph">add the sample's image to <code>Original_Image/</code></div>`}</figure>
          <figure class="ms-in"><figcaption>Animated narrative <i>V</i></figcaption>
            <div class="ms-film">
              <div class="ms-filmbody">
                <span class="ms-perf"></span>
                ${m.frames && m.frames.length
                  ? `<img data-reel alt="" loading="lazy">`
                  : '<div class="ms-ph">video</div>'}
                <span class="ms-perf"></span>
              </div>
            </div></figure>
          <figure class="ms-in"><figcaption>Requested style <i>U</i></figcaption>
            <div class="ms-style">${esc((s && s.style) || 'e.g. progressive reveal')}</div></figure>
        </div>

        <div class="ms-fork">${GATES.map(() => '<span></span>').join('')}</div>
        <div class="ms-gaterow">${GATES.map(m => this.card(m, 'gate')).join('')}</div>
        <div class="ms-join"></div>

        <div class="ms-gate">
          <b>Validity gate <i>G</i></b>
          <span><i>G</i> = 1 when VFS and ASCS are <em>both</em> at level 4 or 3 — otherwise
            <i>G</i> = 0, the animation is discarded, and nothing below is ever computed.</span>
        </div>
      </section>`;
  }

  /* ---------------- (b) narrative quality ---------------- */
  panelB() {
    const s = this.demo && this.demo.sample;
    const i = s ? Math.min(2, s.steps.length - 2) : 0;
    const trio = s ? [s.steps[i - 1] || s.steps[0], s.steps[i], s.steps[i + 1]] : [];
    const labels = ['step t − 1', 'step t', 'step t + 1'];
    return `
      <section class="ms-panel is-b">
        <header><span class="ms-tag">b</span>
          <h3>Narrative Quality</h3>
          <p>For animations that survive both gates: at every step, are the chosen elements,
             the pacing and the narration right?</p>
        </header>

        <div class="ms-steps">${trio.map((st, k) => `${k > 0 ? '<span class="ms-steparrow">&rarr;</span>' : ''}
          <figure class="ms-step${k === 1 ? ' is-now' : ''}">
            <figcaption>${labels[k]}</figcaption>
            ${st && st.frame ? `<img src="${esc(st.frame)}" alt="" loading="lazy">`
                             : '<div class="ms-ph">frame</div>'}
          </figure>`).join('')}</div>
        ${trio[1] && trio[1].narration ? `<p class="ms-narr">
          <span>narration at step <i>t</i></span>${esc(trio[1].narration)}</p>` : ''}

        <div class="ms-evidence">
          <b>What the judge sees, per frame</b>
          <div class="ms-evchips">
            <span class="ms-evchip">${ICON_DIAGRAM} source diagram</span>
            <span class="ms-evchip">${ICON_FRAME} state at <i>t</i>&minus;1</span>
            <span class="ms-evchip is-now">${ICON_FRAME} state at <i>t</i></span>
            <span class="ms-evchip">${ICON_XML} XML schema</span>
            <span class="ms-evchip">${ICON_STYLE} style adapter</span>
            <span class="ms-evchip is-nas">${ICON_DOC} context dump <i>(NAS only)</i></span>
          </div>
        </div>

        <div class="ms-fork is-three">${QUALITY.map(() => '<span></span>').join('')}</div>
        <div class="ms-qrow">${QUALITY.map(m => this.card(m, 'quality')).join('')}</div>
        <p class="ms-foot">All three run on the same frame, independently, and every frame of the
          animation is judged. Kimi 2.6 is the judge for all three.</p>
      </section>`;
  }

  /* ---------------- (c) aggregation ---------------- */
  panelC() {
    const d = this.demo;
    const s = d && d.sample;
    const m = s && s.derived.metrics && s.derived.metrics.SSS;
    const js = m ? s.steps.map(x => J[x.sss]) : [4, 3, 4, 3, 2];
    const N = js.length;
    const dists = js.map(x => 4 - x);
    const sum = dists.reduce((a, b) => a + b, 0);
    const d_o = m ? m.d_o : +(sum / (3 * N)).toFixed(4);
    const Q = m ? m.Q : +(1 - d_o).toFixed(4);

    const row = (label, cells, cls = '') =>
      `<tr class="${cls}"><th>${label}</th>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`;

    return `
      <section class="ms-panel is-c">
        <header><span class="ms-tag">c</span>
          <h3>Aggregation</h3>
          <p>How the ordinal judgments become one number.</p>
        </header>

        <div class="ms-work">
          <div class="ms-tablewrap">
            <div class="ms-workhead">${d
              ? `A real sequence &mdash; SSS on <b>${esc(d.baseline)}</b> / <code>${esc(s.id)}</code>`
              : 'One metric, one sequence'}</div>
            <table class="ms-ord">
              ${row('Presentation step <i>t</i>', js.map((_, i) => i + 1), 'is-head')}
              ${row('Ordinal judgment <i>j<sub>t</sub></i>', js.map(x => `<span class="ms-j is-j${x}">${x}</span>`), 'is-j')}
              ${row('Ideal (all 4s)', js.map(() => 4))}
              ${row('Distance |4 &minus; <i>j<sub>t</sub></i>|', dists.map(x => `<span class="ms-d is-d${x}">${x}</span>`))}
            </table>
          </div>
          <div class="ms-calc">
            <div class="ms-eq">
              <span>normalised ordinal distance</span>
              <code><i>d</i><sub>o</sub> = 1 / 3<i>N</i> &middot; &Sigma;<sub><i>t</i></sub> |4 &minus; <i>j<sub>t</sub></i>|
                = ${sum} / ${3 * N} = <b>${d_o.toFixed(4)}</b></code>
            </div>
            <div class="ms-eq is-out">
              <span>quality score</span>
              <code><i>Q</i> = 1 &minus; <i>d</i><sub>o</sub> = <b>${Q.toFixed(4)}</b></code>
            </div>
            <p class="ms-why">Three is the largest a single step can be wrong by — level 1 against
              an ideal of 4 — so dividing by 3<i>N</i> puts every metric on the same 0&ndash;1 scale
              however long the animation is.</p>
          </div>
        </div>

        <div class="ms-agg">
          <div class="ms-qtile">Q<sub>SSS</sub></div>
          <div class="ms-qtile">Q<sub>GPS</sub></div>
          <div class="ms-qtile">Q<sub>NAS</sub></div>
          <div class="ms-qmean">
            <i>Q<sub>n</sub></i> = ( Q<sub>SSS</sub> + Q<sub>GPS</sub> + Q<sub>NAS</sub> ) / 3
          </div>
        </div>

        <div class="ms-final">
          <div class="ms-fbox"><span>validity gate</span><b><i>G</i> &isin; {0, 1}</b></div>
          <div class="ms-op">&times;</div>
          <div class="ms-fbox"><span>narrative quality</span><b><i>Q<sub>n</sub></i> &isin; [0, 1]</b></div>
          <div class="ms-op">=</div>
          <div class="ms-fbox is-out"><span>Animated Narrative Score</span>
            <b>AANS = <i>G</i> &middot; <i>Q<sub>n</sub></i></b></div>
        </div>
        <p class="ms-foot">A single failed gate sends the whole thing to zero, however good the
          narration was. That is the point of gating first.</p>
      </section>`;
  }

  /* ---------------- a metric card ---------------- */
  card(m, kind) {
    const open = this.open === m.key;
    return `
      <article class="ms-card is-${kind}${open ? ' is-open' : ''}" data-metric="${m.key}">
        <div class="ms-cardhead">
          <b>${esc(m.title)}</b><span class="ms-abbr">${m.abbr}</span>
          ${kind === 'gate' ? `<span class="ms-fps">${m.input} &middot; ${m.fps} FPS</span>` : ''}
          <span class="ms-more">${open ? '−' : '+'}</span>
        </div>
        <p class="ms-q">${esc(m.q)}</p>
        <div class="ms-scale">${m.bands.map(([n, word, ok]) => {
          const isBand = typeof n === 'string';
          return `<span class="ms-band is-j${isBand ? { A: 4, B: 3, C: 2, D: 1 }[n] : n}${
            ok === 1 ? ' is-accept' : ok === 0 ? ' is-discard' : ''}">
            <b>${n}</b><i>${esc(word)}</i></span>`;
        }).join('')}</div>
        ${kind === 'gate'
          ? `<p class="ms-passline">Band A and B pass &mdash; 
             Band ${m.bands.filter(b => b[2] === 0).map(b => b[0]).join(' and ')} discard</p>` : ''}
        <div class="ms-drawer">
          <p class="ms-def">${m.def}</p>
          ${m.adapter ? `<p class="ms-adapter">${m.adapter}</p>` : ''}
          <div class="ms-critlabel">${esc(m.critlabel || 'Criteria')}</div>
          <ul class="ms-crit">${m.criteria.map(([t, h]) =>
            `<li><b>${esc(t)}</b><span>${esc(h)}</span></li>`).join('')}</ul>
          ${m.bandnote ? `<p class="ms-bandnote">${m.bandnote}</p>` : ''}
          ${kind === 'gate' ? `<p class="ms-judge">Judge: ${esc(m.judge)}, on ${esc(m.input)} at ${m.fps} FPS.</p>` : ''}
        </div>
      </article>`;
  }
}

customElements.define('metric-scheme', MetricScheme);
