import { loadJSON, onVisible, esc, BenchSelect, panelHead, reducedMotion } from './bench-core.js';
import { lightbox, zoomBadge } from './bench-lightbox.js';

/**
 * <bench-density src="data/benchmark/density.json"></bench-density>
 *
 * DIAGRAM DIVERSITY, the figure's red pane.
 *
 * Two columns:
 *
 *   [ method + strata + shares ]   [ example stage ]
 *          left column                  right, large
 *
 * Picking a method in the dropdown swaps the axis, the blurb, the stratum
 * list and the share chart; clicking a stratum swaps the still on the stage.
 * The stage is a fixed-height box, so nothing below the pane ever jumps.
 *
 * NAMES AND SHARES ARE THE FIGURE'S. Each stratum's label and `share` are
 * copied verbatim from the AnimateBench figure. Layout Organization reports
 * no shares there, so it shows none here; no number is computed or invented.
 *
 * THE STAGE IS NOT A BUTTON. The still is there to be looked at; the only way
 * into the viewer is the magnifier in the corner (same rule as the blue pane).
 * The viewer opens the stratum's animation - silent, looping, and captioned
 * from the `captions.vtt` beside it. A stratum whose animation has not been
 * built yet opens on its still instead.
 */

const METHOD_ICONS = {
  'element-density': 'grid',
  'hierarchical-depth': 'tree',
  connectivity: 'graph',
  'raster-content': 'image',
  'layout-organization': 'layout',
};

/**
 * The hand-drawn "click here" note above the stage: a looping arrow that lands
 * on the magnifier, because that button is the only way to the full clip.
 */
const PLAY_DOODLE = `
  <span class="bd-doodle" aria-hidden="true">
    <span class="hand bd-doodle-text">click here to play the animation</span>
    <svg class="bd-doodle-arrow" viewBox="0 0 70 46" fill="none">
      <path d="M4 10c14-8 32-8 40 2s-4 18-10 12 4-16 16-10 12 16 12 26"
            stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/>
      <path d="M55 32l7 10 6-11" stroke="currentColor" stroke-width="2.1"
            stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </span>`;

const fmtShare = (v) => `${Number(v).toFixed(1)}%`;

/**
 * Stamp a media URL with the data file's `version`.
 *
 * The examples are replaced in place - the same `diagram.png` and
 * `preview.mp4` under the same stratum folder - so a browser that has been
 * here before will happily show yesterday's figure. Bumping `version` in
 * density.json when the media changes is what makes the new files appear.
 */
const stamped = (url, v) => (url && v ? `${url}${url.includes('?') ? '&' : '?'}v=${encodeURIComponent(v)}` : url);

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
      ${panelHead('Diagram Diversity', 'five stratification axes')}
      <div class="bx-body bd-body">
        <div class="bd-side">
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

          <div class="bd-strata">
            <span class="bx-eyebrow">Strata</span>
            <ul class="bd-list" role="tablist" aria-labelledby="${uid}-lbl"></ul>
          </div>

          <div class="bd-stats" hidden>
            <span class="bx-eyebrow">Share of AnimateBench</span>
            <ul class="bd-stat-list"></ul>
          </div>
        </div>

        <figure class="bd-stage" data-media="empty">
          ${PLAY_DOODLE}
          <div class="bd-stage-frame frame-paper">
            <button type="button" class="bd-zoom" aria-label="Play the animation">
              ${zoomBadge()}
            </button>
            <img class="bd-stage-img" alt="" decoding="async">
            <div class="bx-skel bd-skel">
              <span class="bx-skel-tag"></span>
              <p class="bx-skel-note"></p>
            </div>
          </div>
        </figure>
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
    this.stats = this.querySelector('.bd-stats');
    this.stage = this.querySelector('.bd-stage');
    this.img = this.querySelector('.bd-stage-img');
    this.list.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-i]');
      if (b) this._setStratum(Number(b.dataset.i));
    });
    this.list.addEventListener('keydown', (e) => this._listKeys(e));

    // Only the magnifier opens the viewer. A click on the still does nothing.
    this.querySelector('.bd-zoom').addEventListener('click', () => this._expand());

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

    // The axis's name, its unit and its ends say what it is; the paragraph
    // under them restated it. `blurb` stays in the data as the axis's
    // definition of record — it is simply not printed here.
    this.querySelector('.bd-blurb').hidden = true;
    const axis = this.querySelector('.bd-axis');
    axis.hidden = !m.axis;
    if (m.axis) {
      axis.querySelector('.bd-axis-from').textContent = m.axis.from;
      axis.querySelector('.bd-axis-to').textContent = m.axis.to;
    }

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
    this.list.toggleAttribute('data-many', m.strata.length > 4);

    this._paintStats();
    this._setStratum(0);
  }

  /**
   * The figure's shares for this axis, largest first (the figure's order).
   * Only strata that carry a `share` are listed; an axis with none hides the
   * block entirely rather than showing an empty chart.
   */
  _paintStats() {
    const rows = this.method.strata
      .map((s, k) => ({ s, k }))
      .filter(({ s }) => typeof s.share === 'number')
      .sort((a, b) => b.s.share - a.s.share);
    this.stats.hidden = !rows.length;
    this.stats.querySelector('.bd-stat-list').innerHTML = rows
      .map(
        ({ s, k }) => `
      <li class="bd-stat" data-k="${k}">
        <span class="bd-stat-val">${fmtShare(s.share)}</span>
        <span class="bd-stat-bar" aria-hidden="true"><i style="--w:${Math.max(0, Math.min(100, s.share))}%"></i></span>
        <span class="bd-stat-label">${esc(s.label)}</span>
      </li>`
      )
      .join('');
  }

  _setStratum(k) {
    this.sIndex = k;
    this.list.querySelectorAll('button[data-i]').forEach((b, i) => {
      b.classList.toggle('is-on', i === k);
      b.setAttribute('aria-selected', String(i === k));
      b.tabIndex = i === k ? 0 : -1;
    });
    this.stats.querySelectorAll('.bd-stat').forEach((r) => {
      r.classList.toggle('is-on', Number(r.dataset.k) === k);
    });
    this._paintStage();
  }

  /** Cross-fade the stage to the selected stratum's still. */
  _paintStage() {
    if (!this._armed) return;
    const m = this.method;
    const s = m.strata[this.sIndex];
    if (!s) return;
    const image = stamped(s.example?.image, this.data.version);

    this.stage.classList.add('is-swapping');
    clearTimeout(this._swapT);
    this._swapT = setTimeout(
      () => {
        const label = `${m.label} · ${s.label}`;
        this.querySelector('.bx-skel-tag').textContent = label;
        this.querySelector('.bx-skel-note').textContent =
          'No example figure for this stratum yet.';

        if (image) {
          this.img.alt = `${label}, example diagram`;
          this.img.src = image;
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
   * The selected stratum's animation, on its own: `preview` is the clip built
   * from the diagram's own animation frames and `captions` is its script. A
   * stratum with no clip yet opens on the still, which is the honest thing to
   * show rather than an empty player.
   */
  _asset() {
    const m = this.method;
    const st = m.strata[this.sIndex];
    if (!st) return null;
    const ex = st.example || {};
    const label = `${m.label} · ${st.label}`;
    const meta = [ex.style, typeof st.share === 'number' ? `${fmtShare(st.share)} of AnimateBench` : '']
      .filter(Boolean)
      .join(' · ');
    if (!ex.image && !ex.preview) {
      return {
        kind: 'art',
        html: `<div class="bx-skel bd-skel-big"><span class="bx-skel-tag">${esc(label)}</span></div>`,
        label,
        caption: 'No example figure for this stratum yet.',
      };
    }
    const v = this.data.version;
    if (!ex.preview) {
      return { kind: 'image', src: stamped(ex.image, v), label, meta, caption: 'Animation not built yet.' };
    }
    return {
      kind: 'clip',
      src: stamped(ex.preview, v),
      poster: stamped(ex.image, v),
      vtt: stamped(ex.captions, v),
      label,
      meta,
    };
  }

  _expand() {
    const item = this._asset();
    if (item) {
      lightbox.open({ title: 'Diagram Diversity', accent: this.dataset.accent, items: [item] });
    }
  }
}

customElements.define('bench-density', BenchDensity);
