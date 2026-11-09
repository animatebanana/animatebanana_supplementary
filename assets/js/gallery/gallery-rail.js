import { loadJSON } from '../lib/data-loader.js';
import { onVisible } from '../lib/lazy-load.js';
import { PreviewMedia } from './preview-media.js';

const DEFAULT_SRC = 'data/gallery/rail_previews.json?v=3';

const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const escapeHTML = (value) =>
  String(value).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function roundRobinByStyle(items) {
  const decks = new Map();
  for (const item of items) {
    const key = item.styleId || item.style || '';
    if (!decks.has(key)) decks.set(key, []);
    decks.get(key).push(item);
  }
  const out = [];
  for (let round = 0; out.length < items.length; round += 1) {
    for (const deck of decks.values()) if (round < deck.length) out.push(deck[round]);
  }
  return out;
}

class GalleryRail extends HTMLElement {
  constructor() {
    super();
    this._items = [];
    this._slides = [];
    this._active = 0;
    this._frame = 0;
    this._media = new PreviewMedia();
    this._observers = [];
    this._onScroll = this._onScroll.bind(this);
    this._onResize = this._onResize.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onVisibilityChange = this._onVisibilityChange.bind(this);
  }

  async connectedCallback() {
    let data;
    try {
      data = await loadJSON(this.getAttribute('src') || DEFAULT_SRC);
    } catch {
      this.hidden = true;
      return;
    }
    if (!this.isConnected) return;

    const feed = Array.isArray(data.items) ? data.items : [];
    if (!feed.length) {
      this.hidden = true;
      return;
    }
    const lead = feed[Math.min(Math.max(Number(data.defaultIndex) || 0, 0), feed.length - 1)];
    this._items = roundRobinByStyle(feed);
    this._lead = Math.max(0, this._items.indexOf(lead));
    this._data = data;
    this._mediaReady = data.mediaReady === true;
    this._href = this.getAttribute('href') || data.href || 'gallery.html';
    this._active = this._lead;

    this.render();
    this._wireIntent();
  }

  disconnectedCallback() {
    cancelAnimationFrame(this._frame);
    this._track?.removeEventListener('scroll', this._onScroll);
    window.removeEventListener('resize', this._onResize);
    document.removeEventListener('visibilitychange', this._onVisibilityChange);
    this._motionQuery?.removeEventListener('change', this._onResize);
    for (const observer of this._observers) observer?.disconnect();
    this._observers = [];
    this._media.releaseAll();
  }


  render() {
    this.innerHTML = `
      <div class="gr-stage">
        <button type="button" class="gr-arrow gr-arrow-prev" data-step="-1" aria-label="Previous example">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4.5L7.5 12l7.5 7.5"/></svg>
        </button>

        <ul class="gr-track" role="group" aria-roledescription="carousel"
            aria-label="Preview examples from AnimateBench" tabindex="0">
          ${this._items.map((item, i) => this.slideHTML(item, i)).join('')}
        </ul>

        <button type="button" class="gr-arrow gr-arrow-next" data-step="1" aria-label="Next example">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4.5l7.5 7.5L9 19.5"/></svg>
        </button>
      </div>

      <div class="gr-caption" aria-live="polite">
        <p class="gr-caption-style"></p>
      </div>

      <div class="gr-cta-wrap">
        <a class="gr-cta" href="${escapeHTML(this._href)}">
          <span class="gr-cta-shine" aria-hidden="true"></span>
          <span class="gr-cta-label">Go to the gallery</span>
          <span class="gr-cta-arrow" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M4.5 12h14M13 6.5l5.5 5.5L13 17.5"/></svg>
          </span>
          <svg class="gr-cta-spark gr-cta-spark-1" viewBox="0 0 64 64" aria-hidden="true"><path d="M32 4c2.5 16 11 25 28 28-17 3-25.5 12-28 28-2.5-16-11-25-28-28 17-3 25.5-12 28-28z"/></svg>
          <svg class="gr-cta-spark gr-cta-spark-2" viewBox="0 0 64 64" aria-hidden="true"><path d="M32 4c2.5 16 11 25 28 28-17 3-25.5 12-28 28-2.5-16-11-25-28-28 17-3 25.5-12 28-28z"/></svg>
        </a>
      </div>`;

    this._track = this.querySelector('.gr-track');
    this._slides = [...this.querySelectorAll('.gr-slide')];
    this._captionStyle = this.querySelector('.gr-caption-style');

    this._registerMedia();
    this._wireEvents();

    this._recentre();
    document.fonts?.ready.then(() => {
      if (this.isConnected) this._recentre();
    });
  }

  _recentre() {
    this.scrollToIndex(this._active, 'auto');
    this._measure();
    this._syncCaption();
  }

  slideHTML(item, i) {
    const playable = this.hasVideo(item);
    const label = playable
      ? `Play the ${item.style} preview`
      : `${item.style} preview — no video rendered yet`;
    return `
      <li class="gr-slide" data-index="${i}" data-media="skeleton" data-playable="${playable}" style="--i:${i}">
        <button type="button" class="gr-frame" aria-label="${escapeHTML(label)}">
          <span class="gr-skeleton" aria-hidden="true">
            <svg class="gr-skeleton-mark" viewBox="0 0 64 64"><rect x="6" y="14" width="52" height="36" rx="5"/><path d="M27 24.5l13 8.5-13 8.5z"/><path d="M14 14v36M50 14v36" opacity="0.5"/></svg>
          </span>
          <!-- No loading="lazy": the src is only assigned once our own
               IntersectionObserver says the frame is needed, so a second
               lazy gate would just delay the image we deliberately asked for. -->
          <img class="gr-poster" alt="" decoding="async">
          <video class="gr-video" muted playsinline disablepictureinpicture
                 preload="none" tabindex="-1" aria-hidden="true"></video>
          ${
            playable
              ? `<span class="gr-badge" aria-hidden="true">
                   <svg class="gr-badge-play" viewBox="0 0 24 24"><path d="M9 6.5l10 5.5-10 5.5z"/></svg>
                   <svg class="gr-badge-pause" viewBox="0 0 24 24"><path d="M9 6.5h2.6v11H9zM12.9 6.5h2.6v11h-2.6z"/></svg>
                 </span>`
              : ''
          }
          ${item.duration ? `<span class="gr-dur" aria-hidden="true">${escapeHTML(item.duration)}</span>` : ''}
        </button>
      </li>`;
  }

  _advance() {
    if (this._items.length < 2) return;
    if (!this._onScreen || document.hidden || prefersReducedMotion()) return;
    this.step(1);
  }

  hasVideo(item) {
    return Boolean((this._mediaReady || item.ready === true) && item.sources?.length);
  }

  _registerMedia() {
    this._slides.forEach((slide, i) => {
      const item = this._items[i];
      const enabled = this._mediaReady || item.ready === true;
      this._media.register({
        index: i,
        slide,
        video: slide.querySelector('.gr-video'),
        poster: slide.querySelector('.gr-poster'),
        posterSrc: enabled ? item.poster || '' : '',
        sources: enabled ? item.sources || [] : [],
      });
    });
  }


  _wireEvents() {
    this._track.addEventListener('scroll', this._onScroll, { passive: true });
    window.addEventListener('resize', this._onResize, { passive: true });
    document.addEventListener('visibilitychange', this._onVisibilityChange);
    this.addEventListener('keydown', this._onKeyDown);

    this._motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this._motionQuery.addEventListener('change', this._onResize);

    if ('ResizeObserver' in window) {
      const ro = new ResizeObserver(() => this._onResize());
      ro.observe(this._track);
      this._observers.push(ro);
    }

    for (const arrow of this.querySelectorAll('.gr-arrow')) {
      arrow.addEventListener('click', () => this.step(Number(arrow.dataset.step)));
    }

    this.addEventListener('ended', (event) => {
      if (event.target.classList?.contains('gr-video')) this._advance();
    }, true);

    this._track.addEventListener('click', (event) => {
      const slide = event.target.closest('.gr-slide');
      if (!slide) return;
      const index = Number(slide.dataset.index);
      if (index === this._active) this._media.togglePlay();
      else this.scrollToIndex(index);
    });

    this._observers.push(onVisible(this, () => {
      this._media.arm();
      if (this._landed) return;
      this._landed = true;
      const lead = Math.min(Math.max(this._lead || 0, 0), this._items.length - 1);
      this.scrollToIndex(lead, 'auto');
      this._syncCaption();
      this._media.setActive(lead);
      this._syncPlayback();
    }, { rootMargin: '200px 0px' }));

    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(
        ([entry]) => {
          this._onScreen = entry.isIntersecting;
          this._syncPlayback();
        },
        { threshold: 0.25 }
      );
      io.observe(this);
      this._observers.push(io);
    } else {
      this._onScreen = true;
      this._syncPlayback();
    }
  }

  _onScroll() {
    if (this._userScrolling) {
      clearTimeout(this._intentT);
      this._intentT = setTimeout(() => this._settle(), 160);
    }
    if (this._frame) return;
    this._frame = requestAnimationFrame(() => {
      this._frame = 0;
      this._measure();
    });
  }

  _settle() {
    this._measure();
    this._userScrolling = false;
  }

  _wireIntent() {
    const open = () => {
      this._userScrolling = true;
      clearTimeout(this._intentT);
    };
    for (const ev of ['pointerdown', 'touchstart', 'wheel', 'keydown']) {
      this._track.addEventListener(ev, open, { passive: true });
    }
  }

  _onResize() {
    this._recentre();
    this._syncPlayback();
  }

  _onVisibilityChange() {
    this._syncPlayback();
  }

  _onKeyDown(event) {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.step(1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.step(-1);
    }
  }


  step(delta) {
    const n = this._items.length;
    if (!n) return;
    const next = (((this._active + delta) % n) + n) % n;
    this.scrollToIndex(next, Math.abs(next - this._active) > 1 ? 'auto' : undefined);
  }

  scrollToIndex(index, behavior) {
    const clamped = Math.min(Math.max(index, 0), this._slides.length - 1);
    const slide = this._slides[clamped];
    if (!slide) return;
    const moved = clamped !== this._active;
    this._active = clamped;
    const left = slide.offsetLeft - (this._track.clientWidth - slide.offsetWidth) / 2;
    this._track.scrollTo({
      left,
      behavior: behavior || (prefersReducedMotion() ? 'auto' : 'smooth'),
    });
    if (moved) {
      this._syncCaption();
      this._media.setActive(clamped);
      this._syncPlayback();
    }
    this._syncArrows();
  }

  _measure() {
    if (!this._slides.length) return;
    const centre = this._track.scrollLeft + this._track.clientWidth / 2;
    let best = 0;
    let bestDistance = Infinity;

    for (const slide of this._slides) {
      const width = slide.offsetWidth || 1;
      const distance = Math.abs(slide.offsetLeft + width / 2 - centre);
      const proximity = Math.max(0, 1 - distance / (width * 1.25));
      slide.style.setProperty('--p', proximity.toFixed(3));
      if (distance < bestDistance) {
        bestDistance = distance;
        best = Number(slide.dataset.index);
      }
    }

    if (best !== this._active && this._userScrolling) {
      this._active = best;
      this._syncCaption();
      this._media.setActive(best);
      this._syncPlayback();
    }
    this._syncArrows();
  }

  _syncArrows() {
    this.querySelector('.gr-arrow-prev').disabled = false;
    this.querySelector('.gr-arrow-next').disabled = false;
  }

  _syncCaption() {
    const item = this._items[this._active];
    if (!item) return;
    for (const slide of this._slides) {
      slide.classList.toggle('is-active', Number(slide.dataset.index) === this._active);
    }
    this._captionStyle.textContent = item.style;
  }

  _syncPlayback() {
    this._media.setPlaying(
      Boolean(this._onScreen) && !document.hidden && !prefersReducedMotion()
    );
  }
}

customElements.define('gallery-rail', GalleryRail);
