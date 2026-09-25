/**
 * <stat-chart src="data/dataset_stats.json" metric="byCategory" chart-title="Scientific categories"></stat-chart>
 *
 * Generic pastel bar chart: point it at any JSON file and any
 * top-level key holding an array of { label, value } rows. Used four
 * times on animatebench.html (category / diagram type / complexity /
 * animation style) with zero component-side changes — only the
 * attributes differ.
 */
const BAR_COLORS = ['var(--sc-blue)', 'var(--sc-pink)', 'var(--sc-mint)', 'var(--sc-tan)'];

class StatChart extends HTMLElement {
  static get observedAttributes() { return ['src', 'metric', 'chart-title']; }

  connectedCallback() { this.load(); }
  attributeChangedCallback() { this.load(); }

  async load() {
    const src = this.getAttribute('src');
    const metric = this.getAttribute('metric');
    if (!src || !metric) return;
    const stats = await (await fetch(src)).json();
    this.renderBars(stats[metric] || [], this.getAttribute('chart-title') || metric);
  }

  renderBars(rows, title) {
    const max = Math.max(...rows.map((r) => r.value), 1);
    this.innerHTML = `
      <div class="sc-title">${title}</div>
      <div class="sc-rows">
        ${rows
          .map(
            (r, i) => `
          <div class="sc-row">
            <div class="sc-label">${r.label}</div>
            <div class="sc-bar-track"><div class="sc-bar" style="width:${((r.value / max) * 100).toFixed(1)}%;background:${BAR_COLORS[i % BAR_COLORS.length]}"></div></div>
            <div class="sc-value">${r.value}%</div>
          </div>`
          )
          .join('')}
      </div>`;
  }
}
customElements.define('stat-chart', StatChart);
