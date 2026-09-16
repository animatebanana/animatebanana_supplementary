/**
 * <gallery-browser src="data/gallery/gallery_items.json"></gallery-browser>
 *
 * The full gallery on gallery.html. Style is the only axis it stratifies
 * by: a chip row over the five animation styles, then a full-bleed grid
 * of previews. Cards carry the style and nothing else — no titles, no
 * fields, no complexity — so the figures themselves are what you read.
 *
 * The chosen style is mirrored into the query string, so a filtered view
 * is shareable (the overview rail links straight into one) and the back
 * button walks the filter history.
 *
 * Cards are plain PNGs and nothing else — the source diagram as it was
 * published, not a frame of the animation. The animation is what the
 * fullscreen view is for, so the grid stays a sheet of figures you can scan
 * rather than a wall of competing motion.
 *
 * They load strictly on demand: nothing is requested until a card nears the
 * viewport, and nothing at all until the feed's `mediaReady` switch is on. A
 * card dispatches `galleryselect` rather than opening anything itself.
 *
 * Part of the self-contained gallery module (assets/{css,js}/gallery/,
 * data/gallery/); it owns no other component's files.
 */
import { loadJSON } from '../lib/data-loader.js';
import { onVisible } from '../lib/lazy-load.js';

const DEFAULT_SRC = 'data/gallery/gallery_items.json';
const ALL = 'All';

const escapeHTML = (value) =>
  String(value).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

class GalleryBrowser extends HTMLElement {
  constructor() {
    super();
    this._items = [];
    this._styles = [];
    this._style = ALL;
    this._observers = [];
    this._onPopState = () => {
      this._readURL();
      this.syncChips();
      this.renderGrid();
    };
  }

  async connectedCallback() {
    let data;
    try {
      data = await loadJSON(this.getAttribute('src') || DEFAULT_SRC);
    } catch {
      this.innerHTML = '<p class="gb-empty">The gallery feed could not be loaded.</p>';
      return;
    }
    if (!this.isConnected) return;

    this._items = Array.isArray(data.items) ? data.items : [];
    this._styles = Array.isArray(data.styles) ? data.styles : [];
    this._mediaReady = data.mediaReady === true;

    this._readURL();
    this.renderShell();
    this.buildChips();
    this.syncChips();
    this.renderGrid();
    window.addEventListener('popstate', this._onPopState);
  }

  disconnectedCallback() {
    window.removeEventListener('popstate', this._onPopState);
    for (const observer of this._observers) observer?.disconnect();
    this._observers = [];
  }

  // ---- filter state --------------------------------------------------

  get filtered() {
    return this._style === ALL ? this._items : this._items.filter((it) => it.style === this._style);
  }

  setStyle(style) {
    if (style === this._style) return;
    this._style = style;
    this._writeURL();
    this.syncChips();
    this.renderGrid();
  }

  _readURL() {
    this._style = new URLSearchParams(location.search).get('style') || ALL;
  }

  _writeURL() {
    const query = this._style === ALL ? '' : `?${new URLSearchParams({ style: this._style })}`;
    history.pushState(null, '', query || location.pathname);
  }

  // ---- rendering -----------------------------------------------------

  renderShell() {
    this.innerHTML = `
      <div class="gb-styles" role="group" aria-label="Filter by animation style"></div>
      <div class="gb-grid"></div>`;

    this._stylesRow = this.querySelector('.gb-styles');
    this._grid = this.querySelector('.gb-grid');

    this._stylesRow.addEventListener('click', (event) => {
      const chip = event.target.closest('button[data-value]');
      if (chip) this.setStyle(chip.dataset.value);
    });
    this._grid.addEventListener('click', (event) => {
      const card = event.target.closest('.gb-card');
      if (card) {
        this.dispatchEvent(
          new CustomEvent('galleryselect', { detail: { id: card.dataset.id }, bubbles: true })
        );
      }
    });
  }

  /**
   * Chips are built once and only re-synced — rebuilding their markup on
   * every change would yank focus out of the chip just clicked.
   */
  buildChips() {
    this._stylesRow.innerHTML = [ALL, ...this._styles.map((s) => s.label)]
      .map(
        (value) =>
          `<button type="button" class="gb-chip" data-value="${escapeHTML(value)}" aria-pressed="false">${escapeHTML(value)}</button>`
      )
      .join('');
  }

  syncChips() {
    for (const chip of this._stylesRow.querySelectorAll('.gb-chip')) {
      const active = chip.dataset.value === this._style;
      chip.classList.toggle('gb-chip-active', active);
      chip.setAttribute('aria-pressed', String(active));
    }
  }

  renderGrid() {
    for (const observer of this._observers) observer?.disconnect();
    this._observers = [];

    const cards = this.filtered;
    if (!cards.length) {
      this._grid.innerHTML = '<p class="gb-empty">No examples in this style yet.</p>';
      return;
    }

    this._grid.innerHTML = cards.map((it) => this.cardHTML(it)).join('');
    this._wirePreviews(cards);
  }

  /** The card's image. `preview` is the pre-rename spelling; both are honoured. */
  thumbOf(item) {
    return item.thumb || item.preview || '';
  }

  cardHTML(item) {
    return `
      <article class="gb-card" data-id="${escapeHTML(item.id)}" data-media="skeleton" tabindex="0"
               role="button" aria-label="${escapeHTML(`${item.style} example`)}">
        <div class="gb-thumb">
          <span class="gb-skeleton" aria-hidden="true">
            <svg viewBox="0 0 64 64"><rect x="6" y="14" width="52" height="36" rx="5"/><path d="M27 24.5l13 8.5-13 8.5z"/><path d="M14 14v36M50 14v36" opacity="0.5"/></svg>
          </span>
          <!-- No loading="lazy": the src is only assigned once our own
               IntersectionObserver says the frame is needed, so a second
               lazy gate would just delay the image we deliberately asked for. -->
          <img class="gb-img" alt="" decoding="async">
          <span class="gb-open" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
              <circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.4 15.4L21 21M10.5 7.6v5.8M7.6 10.5h5.8"/>
            </svg>
          </span>
        </div>
        <span class="gb-style">${escapeHTML(item.style)}</span>
      </article>`;
  }

  /**
   * One image per card, requested as that card nears the viewport — a
   * 144-card grid therefore costs nothing above the fold and never
   * fetches a preview nobody scrolled to. The whole mechanism stays
   * dormant until the feed's `mediaReady` switch is on, which keeps the
   * page 404-free while previews are still being produced.
   */
  _wirePreviews(cards) {
    for (const item of cards) {
      if (!(this._mediaReady || item.ready === true) || !this.thumbOf(item)) continue;
      const card = this._grid.querySelector(`.gb-card[data-id="${CSS.escape(item.id)}"]`);
      const img = card?.querySelector('.gb-img');
      if (!img) continue;

      img.addEventListener('load', () => { card.dataset.media = 'image'; });
      img.addEventListener('error', () => {
        // Preview not produced yet — keep the paper skeleton, no retry.
        img.removeAttribute('src');
        card.dataset.media = 'skeleton';
      });

      this._observers.push(
        onVisible(
          card,
          () => {
            card.dataset.media = 'loading';
            img.src = this.thumbOf(item);
          },
          { rootMargin: '400px 0px' }
        )
      );
    }
  }
}

customElements.define('gallery-browser', GalleryBrowser);
