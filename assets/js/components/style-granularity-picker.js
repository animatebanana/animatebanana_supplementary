/**
 * <style-granularity-picker style-value="progressive" granularity-value="standard">
 *
 * Emits `stylechange` / `granularitychange` CustomEvents (bubbling)
 * rather than mutating anything itself — <example-viewer> listens and
 * reacts, and it's the same component <controls.html> uses standalone
 * for the before/after comparisons. Decoupled on purpose: adding a
 * new place that needs a style/granularity switch never means editing
 * this file.
 */
export const STYLES = [
  { key: 'progressive', label: 'Progressive Reveal' },
  { key: 'alpha', label: 'Alpha Masking' },
  { key: 'colorpop', label: 'Colour Pop' },
  { key: 'hopping', label: 'Hopping Box' },
  { key: 'sliding', label: 'Sliding Box' },
];

export const GRANULARITIES = [
  { key: 'concise', label: 'Concise', steps: 5 },
  { key: 'standard', label: 'Standard', steps: 8 },
  { key: 'detailed', label: 'Detailed', steps: 13 },
];

class StyleGranularityPicker extends HTMLElement {
  constructor() {
    super();
    this._style = this.getAttribute('style-value') || STYLES[0].key;
    this._granularity = this.getAttribute('granularity-value') || GRANULARITIES[1].key;
  }

  connectedCallback() {
    this.render();
  }

  get styleValue() { return this._style; }
  get granularityValue() { return this._granularity; }

  setStyle(key) {
    this._style = key;
    this.render();
    this.dispatchEvent(new CustomEvent('stylechange', { detail: { style: key }, bubbles: true }));
  }

  setGranularity(key) {
    this._granularity = key;
    this.render();
    this.dispatchEvent(new CustomEvent('granularitychange', { detail: { granularity: key }, bubbles: true }));
  }

  render() {
    const activeGran = GRANULARITIES.find((g) => g.key === this._granularity) || GRANULARITIES[1];
    this.innerHTML = `
      <div class="sg-group">
        <div class="sg-label">Animation style</div>
        <div class="sg-row" data-role="styles">
          ${STYLES.map((s) => `<button type="button" class="sg-pill ${s.key === this._style ? 'sg-pill-active' : ''}" data-key="${s.key}">${s.label}</button>`).join('')}
        </div>
      </div>
      <div class="sg-group">
        <div class="sg-label">Narrative granularity</div>
        <div class="sg-row" data-role="granularities">
          ${GRANULARITIES.map((g) => `<button type="button" class="sg-pill ${g.key === this._granularity ? 'sg-pill-active' : ''}" data-key="${g.key}">${g.label}</button>`).join('')}
        </div>
        <div class="sg-steps">${activeGran.steps} presentation steps</div>
      </div>`;

    this.querySelector('[data-role="styles"]').addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (btn) this.setStyle(btn.dataset.key);
    });
    this.querySelector('[data-role="granularities"]').addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (btn) this.setGranularity(btn.dataset.key);
    });
  }
}
customElements.define('style-granularity-picker', StyleGranularityPicker);
