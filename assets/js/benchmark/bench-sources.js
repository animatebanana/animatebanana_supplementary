import { loadJSON, onVisible, esc } from './bench-core.js';
import { lightbox, zoomBadge } from './bench-lightbox.js';


class BenchSources extends HTMLElement {
  async connectedCallback() {
    const src = this.getAttribute('src');
    if (!src) return;
    let d;
    try {
      d = await loadJSON(src);
    } catch {
      this.remove();
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
        items: [{ kind: 'image', src: d.image || d.display, alt: d.alt || d.title || '' }],
      });
    });

    const img = this.querySelector('.bs-img');
    onVisible(this, () => {
      img.src = d.display || d.image;
    }, { rootMargin: '300px' });
  }
}

customElements.define('bench-sources', BenchSources);
