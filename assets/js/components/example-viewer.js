import { loadJSON } from '../lib/data-loader.js';
import { formatTime } from '../lib/format.js';
import './style-granularity-picker.js';

/**
 * <example-viewer example-id="cs-attention-block"></example-viewer>
 *
 * The one reusable "source diagram | animated narrative" viewer used
 * by the gallery, controls, evaluation, and (embedded, single-pane)
 * comparisons pages. Set example-id and it loads its own data.
 *
 * Path convention (see README): given example id X, this component
 * fetches:
 *   data/examples.json            — metadata + narration steps
 *   examples/X/diagram.svg        — the animation-aware source SVG
 *
 * Animation styles (progressive/alpha/colorpop/hopping/sliding) are
 * generic CSS in assets/css/animation-styles/*.css — they key off
 * `[data-order]` + `--order` on the SVG's own elements, so ANY
 * diagram.svg authored with that convention gets all five styles for
 * free. See assets/css/animation-styles/*.css for the mechanism.
 *
 * Scaffold simplification: narration is authored once per example
 * (examples.json → narration.standard) and reused for every
 * granularity setting. A real build would author distinct
 * concise/standard/detailed presentation plans per example and key
 * `narration` by granularity the same way; the granularity picker
 * here is fully wired up and ready for that — only the data source
 * (see loadNarrationSteps below) needs to change.
 */
class ExampleViewer extends HTMLElement {
  static get observedAttributes() { return ['example-id']; }

  constructor() {
    super();
    this._exampleId = null;
    this._data = null;
    this._diagramSVG = '';
    this._activeStepIndex = 0;
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (name === 'example-id' && newVal && newVal !== oldVal) {
      this._exampleId = newVal;
      this.load();
    }
  }

  connectedCallback() {
    const id = this.getAttribute('example-id');
    if (id && !this._data) {
      this._exampleId = id;
      this.load();
    }
  }

  async load() {
    const examples = await loadJSON('data/examples.json');
    this._data = examples.find((e) => e.id === this._exampleId);
    if (!this._data) {
      this.innerHTML = `<div class="ev-missing">Example "${this._exampleId}" not found in data/examples.json.</div>`;
      return;
    }
    this._diagramSVG = await fetch(`examples/${this._exampleId}/diagram.svg`).then((r) => r.text());
    this.render();
  }

  /** Scaffold simplification described in the file header — swap this
   *  out once granularity-specific presentation plans exist. */
  loadNarrationSteps() {
    return (this._data.narration && this._data.narration.standard) || [];
  }

  render() {
    const d = this._data;
    this.innerHTML = `
      <div class="ev">
        <div class="ev-topbar">
          <span class="tag tag-blue">${d.category}</span>
          <span class="ev-title">${d.title}</span>
        </div>
        <div class="ev-split">
          <div>
            <div class="ev-side-label">Source diagram</div>
            <div class="ev-frame ev-frame-static">${this._diagramSVG}</div>
          </div>
          <div>
            <div class="ev-side-label">Animated narrative</div>
            <div class="ev-frame ev-frame-animated" data-role="anim-frame">${this._diagramSVG}</div>
          </div>
        </div>
        <div class="ev-scrub" data-role="scrub"></div>
        <div class="ev-time" data-role="time"></div>
        <div class="ev-caption" data-role="caption"></div>
        <style-granularity-picker style-value="progressive" granularity-value="standard"></style-granularity-picker>
        <div class="ev-export">
          ${['SVG', 'GIF', 'MP4', 'PPTX', 'PDF'].map(
            (fmt) => `<button type="button" class="ev-export-btn" disabled title="Precomputed export — wire up examples/${d.id}/output.${fmt.toLowerCase()} once it exists">${fmt}</button>`
          ).join('')}
        </div>
      </div>`;

    this.$animFrame = this.querySelector('[data-role="anim-frame"]');
    this.$scrub = this.querySelector('[data-role="scrub"]');
    this.$time = this.querySelector('[data-role="time"]');
    this.$caption = this.querySelector('[data-role="caption"]');
    this.$picker = this.querySelector('style-granularity-picker');

    this.$picker.addEventListener('stylechange', (e) => this.applyStyle(e.detail.style));
    this.$picker.addEventListener('granularitychange', () => this.renderScrubber());

    this.applyStyle(this.$picker.styleValue);
    this.renderScrubber();
  }

  applyStyle(styleKey) {
    this.$animFrame.className = `ev-frame ev-frame-animated anim-${styleKey}`;
    // Restart the CSS animation from the beginning.
    const svg = this.$animFrame.querySelector('svg');
    if (svg) {
      svg.style.animation = 'none';
      // eslint-disable-next-line no-unused-expressions
      svg.offsetWidth; // force reflow
      svg.style.animation = '';
    }
  }

  renderScrubber() {
    const steps = this.loadNarrationSteps();
    if (!steps.length) {
      this.$scrub.innerHTML = '';
      this.$time.textContent = '';
      this.$caption.textContent = '';
      return;
    }
    const total = steps[steps.length - 1].t + 4;
    this.$scrub.innerHTML = `
      <div class="ev-track">
        <div class="ev-fill" data-role="fill"></div>
        ${steps.map((s, i) => `<div class="ev-marker" data-i="${i}" style="left:${((s.t / total) * 100).toFixed(1)}%"></div>`).join('')}
      </div>`;
    this.$scrub.querySelectorAll('.ev-marker').forEach((marker) => {
      marker.addEventListener('click', () => this.goToStep(Number(marker.dataset.i)));
    });
    this.goToStep(Math.min(this._activeStepIndex, steps.length - 1));
  }

  goToStep(i) {
    const steps = this.loadNarrationSteps();
    if (!steps.length) return;
    this._activeStepIndex = i;
    const step = steps[i];
    const total = steps[steps.length - 1].t + 4;
    this.$scrub.querySelectorAll('.ev-marker').forEach((m, idx) => m.classList.toggle('ev-marker-active', idx === i));
    const fill = this.$scrub.querySelector('[data-role="fill"]');
    if (fill) fill.style.width = `${((step.t / total) * 100).toFixed(1)}%`;
    this.$time.textContent = `${formatTime(step.t)} / ${formatTime(total)}`;
    this.$caption.textContent = step.caption;
  }
}
customElements.define('example-viewer', ExampleViewer);
