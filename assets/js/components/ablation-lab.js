import { loadJSON } from '../lib/data-loader.js';

/**
 * <ablation-lab src="data/ablations.json">
 *
 * Every ablation against every metric. Each row is tinted by the stage it cuts
 * into — Stage 1 yellow, Stage 2 green, Stage 3 blue — and the best run in each
 * column is picked out in green. The numbers come from the paper table; the
 * shading, the deltas and the per-column winner are derived here.
 */

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
/* Three decimals, because three is what the paper's table prints and what
   data/ablations.json holds. A fourth would be a zero this data never
   measured, dressed up as precision. */
const score = (v) => (v == null ? '—' : Number(v).toFixed(3));

/** the paper's short metric names, whatever the data file calls them */
const SHORT = { VF: 'VF', ASC: 'ASC', SSS: 'SS', GPS: 'GP', NAS: 'NA', AANS: 'AN' };
/** which stage each ablation cuts into, for the row tint */
const STAGE_OF = { stage1: 1, stage2: 2, sequencer: 2, narration: 2, designer: 3, all: 0 };
const STAGE_LABEL = { 1: 'Stage 1', 2: 'Stage 2', 3: 'Stage 3', 0: 'All stages' };

class AblationLab extends HTMLElement {
  async connectedCallback() {
    const src = this.getAttribute('src') || 'data/ablations.json';
    try { this.d = await loadJSON(src); }
    catch { this.innerHTML = `<p class="ab-empty">Could not load ${esc(src)}.</p>`; return; }

    this.innerHTML = `
      <div class="ab-heatwrap" data-heat>
        <div class="ab-heathead">
          <div>
            <div class="ab-kicker">Every ablation, every metric</div>
            <p class="ab-heatnote">Rows tinted by the stage they cut into. Deeper red is a
              steeper fall from the full system; the best run in each column is green.</p>
          </div>
          <div class="ab-legend">
            ${[1, 2, 3].map(n => `<span class="ab-lg s${n}">${STAGE_LABEL[n]}</span>`).join('')}
          </div>
          <button class="ab-zoom" data-zoom type="button">
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M2 6V2h4M14 10v4h-4M10 2h4v4M6 14H2v-4"/></svg>
            <span>Full screen</span>
          </button>
        </div>
        ${this.heatmap()}
      </div>`;

    this.addEventListener('click', (e) => { if (e.target.closest('[data-zoom]')) this.toggleZoom(); });
    this._onKey = (e) => { if (e.key === 'Escape') this.toggleZoom(false); };
  }

  heatmap() {
    const d = this.d, full = d.full.scores;
    const rows = [
      { label: d.full.label || 'AnimateBanana (full)', scores: full, isFull: true, stage: null },
      ...d.ablations.map(a => ({ label: a.label, scores: a.scores, stage: STAGE_OF[a.stage] ?? 0 })),
    ];
    const worst = Math.max(...d.ablations.flatMap(a =>
      d.metrics.map(m => Math.abs((a.scores[m.key] ?? 0) - (full[m.key] ?? 0)))), 1e-4);
    // the winner in each column, so "best" is stated rather than assumed
    const best = {};
    for (const m of d.metrics) best[m.key] = Math.max(...rows.map(r => r.scores[m.key] ?? -Infinity));

    const head = d.metrics.map(m =>
      `<th class="is-${m.group}"><b>${esc(SHORT[m.key] || m.key)}</b><i>${esc(m.label)}</i></th>`).join('');

    const body = rows.map(r => {
      const cells = d.metrics.map(m => {
        const v = r.scores[m.key];
        const isBest = v != null && Math.abs(v - best[m.key]) < 1e-9;
        const dl = r.isFull ? 0 : (v ?? 0) - (full[m.key] ?? 0);
        const t = r.isFull ? 0 : Math.min(1, Math.abs(dl) / worst);
        const cls = isBest ? 'is-best' : dl < 0 ? 'is-drop' : dl > 0 ? 'is-gain' : 'is-flat';
        return `<td class="ab-cell ${cls}" style="--t:${t.toFixed(3)}">
          <b>${score(v)}</b>
          ${r.isFull ? '<em class="ab-baselbl">baseline</em>'
                     : `<em>${dl < 0 ? '−' : '+'}${Math.abs(dl).toFixed(3)}</em>`}
        </td>`;
      }).join('');
      const stage = r.isFull ? null : r.stage;
      return `<tr class="${r.isFull ? 'is-full' : ''}">
        <th class="ab-rowname">
          <span class="ab-rowlbl ${r.isFull ? 'is-base' : 's' + stage}">${esc(r.label)}</span>
          ${r.isFull ? '' : `<span class="ab-rowstage">${STAGE_LABEL[stage]}</span>`}
        </th>${cells}</tr>`;
    }).join('');

    return `<div class="ab-heatscroll">
      <table class="ab-heat">
        <thead><tr><th class="ab-rowname">Ablation</th>${head}</tr></thead>
        <tbody>${body}</tbody>
      </table></div>`;
  }

  toggleZoom(force) {
    const box = this.querySelector('[data-heat]');
    const on = force ?? !box.classList.contains('is-zoom');
    box.classList.toggle('is-zoom', on);
    document.body.classList.toggle('ab-noscroll', on);
    const lbl = this.querySelector('[data-zoom] span');
    if (lbl) lbl.textContent = on ? 'Close' : 'Full screen';
    if (on) document.addEventListener('keydown', this._onKey);
    else document.removeEventListener('keydown', this._onKey);
  }

  disconnectedCallback() { document.removeEventListener('keydown', this._onKey); }
}

customElements.define('ablation-lab', AblationLab);
