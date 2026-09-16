import { loadJSON, onVisible, esc, BenchSelect, panelHead, reducedMotion } from './bench-core.js';
import { lightbox, zoomBadge } from './bench-lightbox.js';

/**
 * <bench-density src="data/benchmark/density.json"></bench-density>
 *
 * DIAGRAM DENSITY, the figure's red pane.
 *
 * Three columns, matching the figure's reading order and the brief:
 *
 *   [ method rail ]   [ example stage ]   [ strata ]
 *      dropdown            centre          right side
 *
 * Picking a method in the dropdown swaps the axis, the blurb and the whole
 * stratum list; clicking a stratum pops its example up in the centre. Both
 * transitions are cross-fades on a fixed-height stage, so nothing below the
 * pane ever jumps.
 *
 * NO SHARES, NO THRESHOLDS, NO CAPTIONS. The strata used to carry a percentage
 * to one decimal place and a bar to match, and a threshold under each ("5 to 15
 * edges"). They were assigned by eye. A figure set that precisely beside a
 * judgement made that way reads as a measurement somebody took, and none was.
 * What is true is the ordering and the names, so the names are all that is
 * shown. The per-stratum blurb under the figure went the same way: the example
 * is there to be looked at, and a sentence telling you what you are looking at
 * was writing a caption for a picture that speaks.
 *
 * Every stratum's example is a real AnimateBench diagram chosen to sit in that
 * stratum. A stratum whose `example` is still null keeps a labelled paper
 * skeleton rather than borrowing a figure from a neighbour, so the pane never
 * shows something that could be mistaken for the wrong stratum.
 */

const METHOD_ICONS = {
  'element-density': 'grid',
  'hierarchical-depth': 'tree',
  connectivity: 'graph',
  'raster-content': 'image',
  'layout-organization': 'layout',
};

/**
 * The hand-drawn arrow under the stratum list, pointing back at the stage.
 *
 * "pick one, its example lands in the middle" is a sentence about where to
 * look, and an arrow that actually goes there says it better than the words
 * do. Drawn rather than an arrow glyph so it belongs to the same sketchbook as
 * the rest of the page, and pointing left because the stage is to the left.
 */
const SQUIGGLE = `
  <svg class="bd-squiggle" viewBox="0 0 120 34" fill="none" aria-hidden="true">
    <path d="M114 7c-14 0-21 9-33 13S60 27 47 25 26 14 14 15"
          stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <path d="M21 9l-8 6 8 6" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

class BenchDensity extends HTMLElement {
  async connectedCallback() {
    const src = this.getAttribute('src');
    if (!src) return;
    try {
      this.data = await loadJSON(src);
    } catch {
      this.remove();
      return;
    }
    this.classList.add('bx-pane', 'bd');
    this.dataset.accent = this.data.accent || 'density';
    this.mIndex = 0;
    this.sIndex = 0;
    this._render();
    // The stage holds images; nothing is requested until the pane is seen.
    onVisible(this, () => {
      this._armed = true;
      this._paintStage();
    }, { rootMargin: '220px' });
  }

  disconnectedCallback() {
    this.select?.destroy();
  }

  get method() {
    return this.data.methods[this.mIndex];
  }

  _render() {
    const uid = `bd-${Math.random().toString(36).slice(2, 7)}`;
    this.uid = uid;
    this.innerHTML = `
      ${panelHead('Diagram Density', 'five stratification axes')}
      <div class="bx-body bd-body">
        <div class="bd-rail">
          <span class="bx-eyebrow" id="${uid}-lbl">Stratify by</span>
          <div class="bd-select-host"></div>
          <p class="bd-blurb"></p>
          <div class="bd-axis" aria-hidden="true">
            <span class="bd-axis-from"></span>
            <span class="bd-axis-line"><i></i></span>
            <span class="bd-axis-to"></span>
          </div>
        </div>

        <figure class="bd-stage" data-media="empty">
          <div class="bd-stage-frame frame-paper bx-zoomable" role="button" tabindex="0"
               aria-label="Open this example fullscreen">
            ${zoomBadge()}
            <img class="bd-stage-img" alt="" decoding="async">
            <div class="bx-skel bd-skel">
              <span class="bx-skel-tag"></span>
              <p class="bx-skel-note"></p>
            </div>
          </div>
        </figure>

        <div class="bd-strata">
          <span class="bx-eyebrow">Strata</span>
          <ul class="bd-list" role="tablist" aria-labelledby="${uid}-lbl"></ul>
          <p class="bd-hintline">${SQUIGGLE}<span class="hand">pick one, its example lands in the middle</span></p>
        </div>
      </div>`;

    this.select = new BenchSelect({
      labelledBy: `${uid}-lbl`,
      items: this.data.methods.map((m) => ({
        id: m.id,
        label: m.label,
        sub: m.unit,
        icon: METHOD_ICONS[m.id] || 'grid',
      })),
      onChange: (_id, i) => this._setMethod(i),
    });
    this.querySelector('.bd-select-host').appendChild(this.select.el);

    this.list = this.querySelector('.bd-list');
    this.stage = this.querySelector('.bd-stage');
    this.img = this.querySelector('.bd-stage-img');
    this.list.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-i]');
      if (b) this._setStratum(Number(b.dataset.i));
    });
    this.list.addEventListener('keydown', (e) => this._listKeys(e));

    const open = (e) => {
      if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
      if (e.type === 'keydown') e.preventDefault();
      this._expand();
    };
    const frame = this.querySelector('.bd-stage-frame');
    frame.addEventListener('click', open);
    frame.addEventListener('keydown', open);

    this._setMethod(0);
  }

  _listKeys(e) {
    const btns = [...this.list.querySelectorAll('button[data-i]')];
    const at = btns.indexOf(document.activeElement);
    if (at < 0) return;
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    let next = null;
    if (step) next = (at + step + btns.length) % btns.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = btns.length - 1;
    if (next === null) return;
    e.preventDefault();
    btns[next].focus();
    this._setStratum(next);
  }

  _setMethod(i) {
    this.mIndex = i;
    this.sIndex = 0;
    const m = this.method;

    this.querySelector('.bd-blurb').textContent = m.blurb || '';
    const axis = this.querySelector('.bd-axis');
    axis.hidden = !m.axis;
    if (m.axis) {
      axis.querySelector('.bd-axis-from').textContent = m.axis.from;
      axis.querySelector('.bd-axis-to').textContent = m.axis.to;
    }

    // The stratum is the whole row: a name, and whether it is the one showing.
    this.list.innerHTML = m.strata
      .map(
        (s, k) => `
      <li role="presentation">
        <button type="button" role="tab" data-i="${k}" id="${this.uid}-t${k}"
                aria-selected="${k === 0}" tabindex="${k === 0 ? 0 : -1}"
                class="bd-item${k === 0 ? ' is-on' : ''}">
          <span class="bd-item-dot" aria-hidden="true"></span>
          <span class="bd-item-label">${esc(s.label)}</span>
        </button>
      </li>`
      )
      .join('');

    // Seven layout strata would otherwise push the pane taller than every
    // other axis. Two columns keeps every method the same height without
    // scrolling a seven-item list.
    this.list.toggleAttribute('data-many', m.strata.length > 4);

    this._setStratum(0);
  }

  _setStratum(k) {
    this.sIndex = k;
    this.list.querySelectorAll('button[data-i]').forEach((b, i) => {
      b.classList.toggle('is-on', i === k);
      b.setAttribute('aria-selected', String(i === k));
      b.tabIndex = i === k ? 0 : -1;
    });
    this._paintStage();
  }

  /** Cross-fade the centre stage to the selected stratum's example. */
  _paintStage() {
    if (!this._armed) return;
    const m = this.method;
    const s = m.strata[this.sIndex];
    if (!s) return;

    this.stage.classList.add('is-swapping');
    clearTimeout(this._swapT);
    this._swapT = setTimeout(
      () => {
        const label = `${m.label} · ${s.label}`;
        this.querySelector('.bx-skel-tag').textContent = label;
        this.querySelector('.bx-skel-note').textContent =
          'No example figure for this stratum yet.';

        if (s.example) {
          this.img.alt = `${label}, example diagram`;
          this.img.src = s.example;
          this.img.decode?.().catch(() => {
            this.stage.dataset.media = 'empty';
          });
          this.stage.dataset.media = 'image';
        } else {
          this.img.removeAttribute('src');
          this.stage.dataset.media = 'empty';
        }
        this.stage.classList.remove('is-swapping');
      },
      reducedMotion() ? 0 : 150
    );
  }

  /**
   * The selected stratum's figure, on its own.
   *
   * Not the whole axis with prev/next: the rail beside the stage already picks
   * the stratum, and offering a second way to walk the same list inside the
   * viewer means two places disagree about which one is showing. The viewer
   * opens what was clicked and closes back to the pane.
   */
  _asset() {
    const m = this.method;
    const st = m.strata[this.sIndex];
    if (!st) return null;
    return {
      kind: st.example ? 'image' : 'art',
      src: st.example,
      html: st.example
        ? ''
        : `<div class="bx-skel bd-skel-big">
             <span class="bx-skel-tag">${esc(m.label)} · ${esc(st.label)}</span>
           </div>`,
      icon: 'image',
      label: `${m.label} · ${st.label}`,
      meta: m.unit || '',
      caption: st.example ? '' : 'No example figure for this stratum yet.',
    };
  }

  _expand() {
    const item = this._asset();
    if (item) {
      lightbox.open({ title: 'Diagram Density', accent: this.dataset.accent, items: [item] });
    }
  }
}

customElements.define('bench-density', BenchDensity);
