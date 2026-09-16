import { loadJSON, onVisible, esc, reducedMotion } from './bench-core.js';
import { GLYPH } from './bench-glyphs.js';

/**
 * <bench-band src="data/benchmark/hero.json"></bench-band>
 *
 * The AnimateBench band on the overview page: the benchmark's four
 * headline figures, counted up as they scroll into view, and the route
 * into the full benchmark page.
 *
 * It reads the same `data/benchmark/hero.json` the benchmark page's
 * equation row reads, so the two can never disagree — correcting a
 * count is one edit in one file.
 *
 * The count-up deliberately matches the site's existing stats band
 * (1400ms, ease-out-quart, fires at 40% visibility, `toLocaleString`
 * grouping) rather than inventing a second easing, so the two read as
 * the same gesture. It is reimplemented here rather than shared because
 * `pages/index.js` keys off `dataset_stats.json`, and pointing this
 * band at that file would mean editing a data file the rest of the site
 * owns.
 */

const DURATION = 1400;

class BenchBand extends HTMLElement {
  async connectedCallback() {
    const src = this.getAttribute('src');
    if (!src) return;
    let data;
    try {
      data = await loadJSON(src);
    } catch {
      this.remove(); // the band is an appendix teaser; never block the page
      return;
    }

    const tiles = data.counters || [];
    if (!tiles.length) {
      this.remove();
      return;
    }

    this.className = 'bb';
    this.innerHTML = `
      <ol class="bb-tiles">
        ${tiles
          .map(
            (t, i) => `
          <li class="bb-tile" style="--i:${i}">
            <span class="bb-glyph">${GLYPH[t.glyph] || ''}</span>
            <span class="bb-num num-outline" data-to="${Number(t.value) || 0}"
                  data-suffix="${esc(t.suffix || '')}">0</span>
            <span class="bb-lab">${esc(t.label)}</span>
            ${t.note ? `<span class="bb-note">${esc(t.note)}</span>` : ''}
          </li>`
          )
          .join('')}
      </ol>
      ${
        data.cta
          ? `<div class="bb-cta">
               <a class="btn btn-primary bb-cta-btn" href="${esc(data.cta.href)}">${esc(data.cta.label)}
                 <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                   <path d="M3 8h10M8.5 3.5 13 8l-4.5 4.5" stroke="currentColor" stroke-width="2"
                         stroke-linecap="round" stroke-linejoin="round"/>
                 </svg>
               </a>
               ${
                 data.cta.note
                   ? `<p class="bb-cta-note hand" aria-hidden="true">
                        <!-- The hero's own annotation arrow, reused verbatim rather
                             than redrawn, so the two hand notes on the page are the
                             same gesture. -->
                        <svg class="bb-cta-arrow" viewBox="0 0 56 44" fill="none" stroke="currentColor"
                             stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M50 40C38 42 30 34 34 26s14-4 8 4-22 6-28-16M8 20l6-8 8 4"/>
                        </svg>
                        <span>${esc(data.cta.note)}</span>
                      </p>`
                   : ''
               }
             </div>`
          : ''
      }`;

    for (const el of this.querySelectorAll('.bb-num')) {
      onVisible(el, (n) => this._count(n), { threshold: 0.4 });
    }
  }

  /** Same curve as the site's existing stats band: ease-out-quart over 1.4s. */
  _count(el) {
    const end = Number(el.dataset.to) || 0;
    const suffix = el.dataset.suffix || '';
    const paint = (n) => (el.textContent = n.toLocaleString('en-US') + suffix);

    if (reducedMotion()) {
      paint(end);
      return;
    }
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min((now - t0) / DURATION, 1);
      paint(Math.round(end * (1 - (1 - p) ** 4)));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}

customElements.define('bench-band', BenchBand);
