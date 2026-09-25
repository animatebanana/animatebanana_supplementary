import { loadJSON } from '../lib/data-loader.js';

/**
 * <metric-tree></metric-tree>
 *
 * Mirrors the paper's validity-gate → narrative-quality metric tree
 * (VF, ASC → SS, GP, NA) as clickable nodes. Clicking a metric shows a
 * good-vs-bad scored example pair from data/evaluation_examples.json.
 * Add a metric by adding to METRICS below and to that JSON file —
 * rendering logic doesn't change.
 */
const METRICS = [
  { key: 'VF', label: 'VF', group: 'validity', name: 'Visual Fidelity' },
  { key: 'ASC', label: 'ASC', group: 'validity', name: 'Animation Style Compliance' },
  { key: 'SS', label: 'SS', group: 'quality', name: 'Selection Sensibility' },
  { key: 'GP', label: 'GP', group: 'quality', name: 'Granularity & Pacing' },
  { key: 'NA', label: 'NA', group: 'quality', name: 'Narration Alignment' },
];

class MetricTree extends HTMLElement {
  constructor() {
    super();
    this._active = 'GP';
    this._examples = {};
  }

  async connectedCallback() {
    this._examples = await loadJSON('data/evaluation_examples.json');
    this.render();
  }

  render() {
    const meta = METRICS.find((m) => m.key === this._active);
    const ex = this._examples[this._active];
    this.innerHTML = `
      <div class="mt-tree">
        ${METRICS.map((m) => `<button type="button" class="mt-node ${this._active === m.key ? 'mt-node-active' : ''} mt-${m.group}" data-key="${m.key}" title="${m.name}">${m.label}</button>`).join('')}
      </div>
      ${
        ex
          ? `
      <div class="mt-detail">
        <div class="page-head" style="padding-top:0;">
          <p>${meta.name} — ${meta.group === 'validity' ? 'a pass/fail validity gate' : 'a narrative-quality dimension, scored 0–1'}.</p>
        </div>
        <div class="mt-pair">
          <div class="mt-case mt-good">
            <div class="mt-case-label">${ex.good.label}</div>
            <div class="mt-case-score">${ex.good.score.toFixed(2)}</div>
            <div class="mt-case-note">${ex.good.note}</div>
          </div>
          <div class="mt-case mt-bad">
            <div class="mt-case-label">${ex.bad.label}</div>
            <div class="mt-case-score">${ex.bad.score.toFixed(2)}</div>
            <div class="mt-case-note">${ex.bad.note}</div>
          </div>
        </div>
      </div>`
          : '<div class="gg-empty">No worked example for this metric yet — add one to data/evaluation_examples.json.</div>'
      }`;

    this.querySelectorAll('.mt-node').forEach((btn) => {
      btn.addEventListener('click', () => {
        this._active = btn.dataset.key;
        this.render();
      });
    });
  }
}
customElements.define('metric-tree', MetricTree);
