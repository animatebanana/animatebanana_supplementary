import { loadJSON, onVisible, esc } from './bench-core.js';
import { lightbox, zoomBadge } from './bench-lightbox.js';

/**
 * <bench-sources src="data/benchmark/sources.json"></bench-sources>
 *
 * FIGURE SOURCES — the figure that opens the benchmark page.
 *
 * It sits above the four panes because it answers the question they all
 * assume: where 5,000 process diagrams came from. The four quadrants of the
 * figure are repeated beside it as a list, tinted to match, so the venues are
 * readable as text at any size — the figure itself is 4000px wide and only
 * legible zoomed.
 *
 * TWO COPIES OF THE FIGURE, ON PURPOSE. The page loads a web-sized copy
 * (`display`, with `displaySmall` for narrow screens); the magnifier opens the
 * full-resolution original, which is the one worth zooming into. Same rule as
 * every other stage on this page: the picture is not a button, the magnifier
 * is.
 */

class BenchSources extends HTMLElement {
  async connectedCallback() {
    const src = this.getAttribute('src');
    if (!src) return;
    let d;
    try {
      d = await loadJSON(src);
    } catch {
      this.remove(); // decoration for the panes below; never block them
      return;
    }
    this.data = d;
    this.className = 'bs';

    const chips = (d.sources || [])
      .map(
        (s) => `
        <li class="bs-src" style="--c:${esc(s.colour || '#1A1815')}">
          <span class="bs-src-dot" aria-hidden="true"></span>
          <span class="bs-src-text">
            <b>${esc(s.label)}</b>
            ${s.note ? `<span>${esc(s.note)}</span>` : ''}
          </span>
        </li>`
      )
      .join('');

    this.innerHTML = `
      <div class="bs-rail">
        ${d.kicker ? `<span class="bx-eyebrow">${esc(d.kicker)}</span>` : ''}
        ${d.title ? `<h2 class="bs-title">${esc(d.title)}</h2>` : ''}
        <!-- the four sources below say it more precisely than a paragraph -->
        <ul class="bs-srcs">${chips}</ul>
      </div>

      <figure class="bs-stage">
        <div class="bs-frame frame-paper">
          <button type="button" class="bs-zoom" aria-label="Open the figure full size">
            ${zoomBadge()}
          </button>
          <img class="bs-img" alt="${esc(d.alt || d.title || '')}" loading="lazy" decoding="async"
               ${d.displaySmall ? `srcset="${esc(d.displaySmall)} 1100w, ${esc(d.display || d.image)} 2200w"` : ''}
               sizes="(max-width: 900px) 92vw, 62vw">
        </div>
      </figure>`;

    this.querySelector('.bs-zoom').addEventListener('click', () => {
      lightbox.open({
        title: d.kicker || 'Figure sources',
        accent: 'diversity',
        // No label and no caption: the figure carries its own headings, and
        // the page repeats them beside it, so a title and a description
        // under the enlarged copy would only say it a third time. `alt`
        // still describes the picture for anyone who cannot see it.
        items: [{ kind: 'image', src: d.image || d.display, alt: d.alt || d.title || '' }],
      });
    });

    // A 4000px figure is not worth fetching before it is anywhere near view.
    const img = this.querySelector('.bs-img');
    onVisible(this, () => {
      img.src = d.display || d.image;
    }, { rootMargin: '300px' });
  }
}

customElements.define('bench-sources', BenchSources);
