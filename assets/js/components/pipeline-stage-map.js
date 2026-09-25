import { loadJSON } from '../lib/data-loader.js';
import { escapeHtml } from '../lib/format.js';

/**
 * <pipeline-stage-map></pipeline-stage-map>
 *
 * Reads data/pipeline_stages.json (an ordered array of
 * { key, label, renderedLabel, codeTitle, codeSnippet, whatChanged })
 * and lets a reviewer click through Source → Stage 1 → 2 → 3 → Final,
 * swapping both the "rendered visual state" panel and the
 * representation-code excerpt beside it. To add a stage, or change
 * what one shows, edit the JSON — this component has no stage-specific
 * logic in it.
 */
class PipelineStageMap extends HTMLElement {
  constructor() {
    super();
    this._stages = [];
    this._stage = null;
    this._zoomed = false;
  }

  async connectedCallback() {
    this._stages = await loadJSON('data/pipeline_stages.json');
    this._stage = this.getAttribute('initial-stage') || this._stages[0]?.key;
    this.render();
  }

  render() {
    const current = this._stages.find((s) => s.key === this._stage) || this._stages[0];
    this.innerHTML = `
      <div class="psm-map">
        ${this._stages
          .map(
            (s) => `
          <button type="button" class="psm-node ${s.key === this._stage ? 'psm-node-active' : ''}" data-key="${s.key}">
            <span class="psm-dot"></span><span class="psm-label">${s.label}</span>
          </button>`
          )
          .join('')}
      </div>
      <div class="psm-panels">
        <div class="psm-panel">
          <div class="psm-panel-head">
            <span>Rendered visual state</span>
            <button type="button" class="psm-zoom" data-role="zoom">Zoom &amp; pan</button>
          </div>
          <div class="psm-frame"><div class="psm-render ${this._zoomed ? 'psm-zoomed' : ''}">${current.renderedLabel}</div></div>
        </div>
        <div class="psm-panel">
          <div class="psm-panel-head"><span>Representation excerpt</span></div>
          <div class="psm-code-title">${current.codeTitle}</div>
          <pre class="psm-code">${escapeHtml(current.codeSnippet)}</pre>
        </div>
      </div>
      <div class="psm-changed"><strong>What changed:</strong> ${current.whatChanged}</div>`;

    this.querySelectorAll('.psm-node').forEach((btn) => {
      btn.addEventListener('click', () => {
        this._stage = btn.dataset.key;
        this.render();
      });
    });
    this.querySelector('[data-role="zoom"]').addEventListener('click', () => {
      this._zoomed = !this._zoomed;
      this.render();
    });
  }
}
customElements.define('pipeline-stage-map', PipelineStageMap);
