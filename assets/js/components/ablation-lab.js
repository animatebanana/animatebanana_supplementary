import { loadJSON } from '../lib/data-loader.js';

/**
 * <ablation-lab src="data/ablations.json">
 *
 * An ablation is an edit to the pipeline, so the page lets you make the edit:
 * pick one and the wire it removes is visibly cut out of the schematic, the
 * cost shows up as a drop against the full system on every metric, and the
 * qualitative slot shows the same sample animated with and without the part.
 *
 * Deltas, bar lengths and the ranking are all derived from the six numbers per
 * row in data/ablations.json — never stored.
 */

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const f4 = (v) => (v == null ? '—' : Number(v).toFixed(4));

/* the pipeline, with every removable part given a cut id */
const SCHEMATIC = `
<svg class="ab-svg" viewBox="0 0 1000 268" role="img"
     aria-label="The AnimateBanana pipeline, with the parts each ablation removes">
  <defs>
    <marker id="ab-tip" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6"
            orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" fill="currentColor"/></marker>
  </defs>

  <g class="ab-flow">
    <line x1="176" y1="141" x2="206" y2="141" marker-end="url(#ab-tip)"/>
    <line x1="366" y1="141" x2="396" y2="141" marker-end="url(#ab-tip)"/>
    <line x1="556" y1="141" x2="586" y2="141" marker-end="url(#ab-tip)"/>
    <line x1="746" y1="141" x2="776" y2="141" marker-end="url(#ab-tip)"/>
    <line x1="936" y1="141" x2="966" y2="141" marker-end="url(#ab-tip)"/>
  </g>

  <g class="ab-box" data-part="stage1"><rect x="26"  y="110" width="150" height="62" rx="12"/>
    <text x="101" y="136">Stage 1</text><text x="101" y="155" class="ab-sub">Diagram &#8594; code</text></g>
  <g class="ab-box" data-part="stage2"><rect x="216" y="110" width="150" height="62" rx="12"/>
    <text x="291" y="136">Stage 2</text><text x="291" y="155" class="ab-sub">Code refinement</text></g>
  <g class="ab-box" data-part="sequencer"><rect x="406" y="110" width="150" height="62" rx="12"/>
    <text x="481" y="136">Sequencer</text><text x="481" y="155" class="ab-sub">Presentation plan</text></g>
  <g class="ab-box" data-part="narration"><rect x="596" y="110" width="150" height="62" rx="12"/>
    <text x="671" y="136">Narration</text><text x="671" y="155" class="ab-sub">Drafter</text></g>
  <g class="ab-box" data-part="designer"><rect x="786" y="110" width="150" height="62" rx="12"/>
    <text x="861" y="136">Animation</text><text x="861" y="155" class="ab-sub">Designer</text></g>

  <text class="ab-end" x="12" y="103">source</text>
  <text class="ab-end ab-endr" x="988" y="136">animation</text>

  <g class="ab-cut" data-cut="s1-critic">
    <path d="M56 110 C56 62 146 62 146 110" marker-end="url(#ab-tip)"/>
    <text x="101" y="52">critic</text></g>
  <g class="ab-cut" data-cut="seq-critic">
    <path d="M436 110 C436 62 526 62 526 110" marker-end="url(#ab-tip)"/>
    <text x="481" y="52">critic</text></g>
  <g class="ab-cut" data-cut="des-critic">
    <path d="M816 110 C816 62 906 62 906 110" marker-end="url(#ab-tip)"/>
    <text x="861" y="52">critic</text></g>

  <g class="ab-cut" data-cut="s2-image">
    <line x1="291" y1="212" x2="291" y2="176" marker-end="url(#ab-tip)"/>
    <rect x="226" y="212" width="130" height="28" rx="9"/>
    <text x="291" y="231">diagram image</text></g>
  <g class="ab-cut" data-cut="seq-xml">
    <line x1="481" y1="212" x2="481" y2="176" marker-end="url(#ab-tip)"/>
    <rect x="416" y="212" width="130" height="28" rx="9"/>
    <text x="481" y="231">XML schema</text></g>
  <g class="ab-cut" data-cut="narr-context">
    <line x1="671" y1="212" x2="671" y2="176" marker-end="url(#ab-tip)"/>
    <rect x="606" y="212" width="130" height="28" rx="9"/>
    <text x="671" y="231">paper context</text></g>
  <g class="ab-cut" data-cut="des-image">
    <line x1="861" y1="212" x2="861" y2="176" marker-end="url(#ab-tip)"/>
    <rect x="796" y="212" width="130" height="28" rx="9"/>
    <text x="861" y="231">diagram image</text></g>
</svg>`;

class AblationLab extends HTMLElement {
  async connectedCallback() {
    const src = this.getAttribute('src') || 'data/ablations.json';
    try { this.d = await loadJSON(src); }
    catch (e) { this.innerHTML = `<p class="ab-empty">Could not load ${esc(src)}.</p>`; return; }
    this.i = 0;
    this.innerHTML = this.shell();
    this.addEventListener('click', (e) => {
      const row = e.target.closest('[data-ab]');
      if (row) { this.i = +row.dataset.ab; this.paint(); }
    });
    this.paint();
  }

  get ab() { return this.d.ablations[this.i]; }

  shell() {
    const list = this.d.ablations.map((a, i) => `
      <button class="ab-chip" data-ab="${i}">
        <b>${esc(a.label)}</b>
        <i data-chipdelta="${a.id}"></i>
      </button>`).join('');
    return `
      ${this.d.full._placeholder ? `<p class="ab-flag">The <b>AnimateBanana (full)</b> row in
        <code>data/ablations.json</code> is a placeholder — every delta on this page is measured
        against it, so fill it from the main results table first.</p>` : ''}
      <div class="ab-top">
        <div class="ab-schem">
          <div class="ab-kicker">The pipeline, with the removed part cut out</div>
          ${SCHEMATIC}
          <p class="ab-caption" data-caption></p>
        </div>
        <div class="ab-list">
          <div class="ab-kicker">Remove one part</div>
          ${list}
        </div>
      </div>
      <div class="ab-cost" data-cost></div>
      <div class="ab-qual" data-qual></div>
      <div class="ab-tablewrap">
        <div class="ab-kicker">Every ablation, every metric</div>
        <table class="ab-table" data-table></table>
      </div>`;
  }

  paint() {
    const a = this.ab, full = this.d.full.scores;
    this.querySelectorAll('[data-ab]').forEach((n, i) => n.classList.toggle('is-on', i === this.i));
    this.querySelectorAll('[data-chipdelta]').forEach(n => {
      const ab = this.d.ablations.find(x => x.id === n.dataset.chipdelta);
      const dl = ab.scores.AANS - full.AANS;
      n.textContent = (dl >= 0 ? '+' : '−') + Math.abs(dl).toFixed(4);
      n.className = dl < 0 ? 'is-down' : 'is-up';
    });

    this.querySelectorAll('.ab-cut').forEach(g =>
      g.classList.toggle('is-cut', a.cuts.includes(g.dataset.cut)));
    this.querySelectorAll('.ab-box').forEach(g =>
      g.classList.toggle('is-touched', a.stage === 'all' || g.dataset.part === a.stage));

    this.querySelector('[data-caption]').innerHTML =
      `<b>${esc(a.question)}</b> ${esc(a.note)}`;

    /* cost of the ablation, metric by metric */
    const worst = Math.max(...this.d.metrics.map(m =>
      Math.max(...this.d.ablations.map(x => Math.abs(x.scores[m.key] - full[m.key])))));
    this.querySelector('[data-cost]').innerHTML = `
      <div class="ab-kicker">What it costs, against the full system</div>
      <div class="ab-costrow">${this.d.metrics.map(m => {
        const v = a.scores[m.key], dl = v - full[m.key];
        const w = worst ? Math.min(100, Math.abs(dl) / worst * 100) : 0;
        return `<div class="ab-metric is-${m.group}">
          <span class="ab-mk">${m.key}</span>
          <span class="ab-mlab">${esc(m.label)}</span>
          <div class="ab-bar"><i style="width:${w.toFixed(1)}%"></i></div>
          <div class="ab-nums"><b>${f4(v)}</b>
            <em class="${dl < 0 ? 'is-down' : 'is-up'}">${dl < 0 ? '−' : '+'}${Math.abs(dl).toFixed(4)}</em></div>
          <span class="ab-mnote">full ${f4(full[m.key])}</span>
        </div>`;
      }).join('')}</div>`;

    /* qualitative slot */
    const ex = (this.d.examples || {})[a.id] || [];
    this.querySelector('[data-qual]').innerHTML = `
      <div class="ab-kicker">Same sample, with and without</div>
      ${ex.length ? ex.map(x => `
        <div class="ab-pair">
          <figure><figcaption>Full AnimateBanana</figcaption>
            ${media(x.full)}</figure>
          <figure><figcaption>${esc(a.label)}</figcaption>
            ${media(x.ablated)}</figure>
          <p class="ab-paircap">${esc(x.caption || '')}</p>
        </div>`).join('')
        : `<div class="ab-pending">
             <b>Qualitative example pending.</b>
             <span>Add entries under <code>examples["${esc(a.id)}"]</code> in
               <code>data/ablations.json</code>: each one is
               <code>{ sample, full, ablated, caption }</code>, where <code>full</code> and
               <code>ablated</code> are paths to the two animations of the same diagram.</span>
           </div>`}`;

    /* the table */
    const head = `<thead><tr><th class="ab-rowname">Ablation</th>
      ${this.d.metrics.map(m => `<th class="is-${m.group}">${m.key}</th>`).join('')}</tr></thead>`;
    const row = (label, sc, cls, idx) => `
      <tr class="${cls}"${idx == null ? '' : ` data-ab="${idx}"`}>
        <th class="ab-rowname">${esc(label)}</th>
        ${this.d.metrics.map(m => {
          const v = sc[m.key], dl = idx == null ? 0 : v - full[m.key];
          return `<td class="is-${m.group}" style="--t:${shade(v)}">
            ${f4(v)}${idx == null ? '' : `<em>${dl < 0 ? '−' : '+'}${Math.abs(dl).toFixed(3)}</em>`}</td>`;
        }).join('')}</tr>`;
    this.querySelector('[data-table]').innerHTML = head + '<tbody>' +
      row(this.d.full.label, full, 'is-full', null) +
      this.d.ablations.map((x, i) => row(x.label, x.scores, i === this.i ? 'is-on' : '', i)).join('') +
      '</tbody>';
  }
}

/* colour intensity for a table cell: 0.70 -> 0, 1.00 -> 1 */
function shade(v) {
  return Math.max(0, Math.min(1, (v - 0.70) / 0.30)).toFixed(3);
}
function media(src) {
  if (!src) return '<div class="ab-load">not supplied</div>';
  return /\.mp4$/i.test(src)
    ? `<video src="${esc(src)}" controls muted loop playsinline preload="metadata"></video>`
    : `<img src="${esc(src)}" alt="" loading="lazy">`;
}

customElements.define('ablation-lab', AblationLab);
