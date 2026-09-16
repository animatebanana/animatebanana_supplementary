import { loadJSON } from '../lib/data-loader.js';

/**
 * Page-specific glue (not a reusable component — this composition of
 * "two placeholder frames + a metrics row" is only used here). Reads
 * data/comparisons.json and renders one card per entry.
 */
const METRIC_KEYS = ['VF', 'ASC', 'SS', 'GP', 'NA', 'AANS'];

function metricsRow(metrics) {
  return `<div class="cmp-metrics">
    ${METRIC_KEYS.map((k) => `<div><div class="cmp-metric-key">${k}</div><div class="cmp-metric-val">${metrics[k].toFixed(2)}</div></div>`).join('')}
  </div>`;
}

async function render() {
  const comparisons = await loadJSON('data/comparisons.json');
  const list = document.querySelector('#comparisons-list');
  list.innerHTML = comparisons
    .map(
      (c) => `
    <div class="cmp-card">
      <div class="cmp-head">
        <span class="tag tag-blue">${c.category}</span>
        <span class="cmp-title">${c.title}</span>
        ${c.curated ? '<span class="tag tag-pink">Curated failure case</span>' : '<span class="tag tag-mint">Representative</span>'}
      </div>
      <div class="cmp-players">
        <div>
          <div class="cmp-player-label">Baseline</div>
          <div class="cmp-frame placeholder-diagram"></div>
          ${metricsRow(c.metrics.baseline)}
        </div>
        <div>
          <div class="cmp-player-label">AnimateBanana</div>
          <div class="cmp-frame placeholder-diagram"></div>
          ${metricsRow(c.metrics.ours)}
        </div>
      </div>
      <div class="cmp-note">${c.note}</div>
    </div>`
    )
    .join('');
}

render();
