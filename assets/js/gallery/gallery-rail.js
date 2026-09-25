/**
 * <gallery-rail src="data/gallery/rail_previews.json"></gallery-rail>
 *
 * The overview page's "Explore More Examples" band: a horizontally
 * scrollable, snap-centred carousel of the gallery's own examples, an arrow
 * on each side, and the call-through to the full gallery.
 *
 * WHICH EXAMPLE IS SHOWING CHANGES ONLY WHEN ASKED.
 * The band is a scroll container with mandatory snapping, and the media
 * budget is constantly attaching and detaching videos on the slides either
 * side of the middle. Every one of those attachments is a content change
 * inside the snap container, and a browser answers a content change by
 * re-snapping - which can land a pixel into the neighbour, whose video then
 * attaches, which re-snaps again. Left to read the scroll position, the rail
 * walks itself through the gallery with nobody touching it.
 *
 * So the active slide is owned by navigation, not by measurement. Arrows,
 * arrow keys and clicking a neighbour set it outright; a scroll the visitor
 * performs themselves commits it too. A scroll nobody asked for only repaints
 * the proximity shading and is otherwise ignored.
 *
 * IT PLAYS ONCE AND WAITS. The band used to loop every preview for ever,
 * which turns a demo into wallpaper and makes it impossible to tell whether
 * the thing on screen is still going or has been going for five minutes. A
 * preview now runs through and holds on its last frame; Replay plays it again,
 * and nothing moves to another example unless the visitor asks for it with the
 * arrows, the keyboard or a click on a neighbouring slide.
 *
 * IT CARRIES PREVIEWS, NOT THE CLIPS THEMSELVES. Every example in the gallery
 * appears here, but as a silent preview at four times the pace - a hundred
 * kilobytes or so against fifteen megabytes for the first narrated clip alone.
 * Pointing the rail at the real files left the band blank while a narration
 * nobody had asked for downloaded. The demo is a glance; the gallery is where
 * an example is watched and heard.
 *
 * Design notes
 * ------------
 * • It is a real scroll container, not a transform-driven slider — the
 *   arrows just call scrollTo(), so trackpads, touch, shift-wheel and
 *   scrollbars all work for free and nothing has to be re-implemented.
 * • Slide emphasis is continuous: a scroll listener writes a 0→1
 *   proximity-to-centre value onto each slide as `--p`, and the
 *   stylesheet interpolates scale/opacity/shadow from it. Measurement
 *   is rAF-coalesced, so a fling costs one layout read per frame.
 * • All media loading is deferred and budgeted — see preview-media.js.
 *   Nothing is fetched until the band is on screen, only the active
 *   slide ± 1 ever holds a video, and only the active one plays.
 *
 * Part of the self-contained gallery module (assets/{css,js}/gallery/,
 * data/gallery/). It reads the shared lib/ helpers but owns no other
 * component's files.
 */
import { loadJSON } from '../lib/data-loader.js';
import { onVisible } from '../lib/lazy-load.js';
import { PreviewMedia } from './preview-media.js';

const DEFAULT_SRC = 'data/gallery/rail_previews.json?v=3';   /* previews, not the gallery's full clips - see tools/build_rail_feed.py */

const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const escapeHTML = (value) =>
  String(value).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const pad = (n) => String(n).padStart(2, '0');

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
      this.hidden = true; // no feed, no band — never a broken shell
      return;
    }
    if (!this.isConnected) return;

    this._items = Array.isArray(data.items) ? data.items : [];
    if (!this._items.length) {
      this.hidden = true;
      return;
    }
    this._data = data;
    this._mediaReady = data.mediaReady === true;
    this._href = this.getAttribute('href') || data.href || 'gallery.html';
    this._active = Math.min(Math.max(Number(data.defaultIndex) || 0, 0), this._items.length - 1);

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

  // ---- rendering ----------------------------------------------------

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
        <p class="gr-caption-sub">
          <span class="gr-caption-dur"></span>
          <span class="gr-caption-sep" hidden aria-hidden="true">·</span>
          <span class="gr-counter-now">01</span><span class="gr-counter-of"></span>
        </p>
        <button type="button" class="gr-replay" aria-label="Play this example again">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M20 12a8 8 0 1 1-2.6-5.9M20 4.2V9h-4.8"/>
          </svg>
          <span>Replay</span>
        </button>
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
    this._captionDur = this.querySelector('.gr-caption-dur');
    this._captionSep = this.querySelector('.gr-caption-sep');
    this._counterNow = this.querySelector('.gr-counter-now');
    this.querySelector('.gr-counter-of').textContent = ` / ${pad(this._items.length)}`;

    this._registerMedia();
    this._wireEvents();

    // Centre the opening slide synchronously — deferring this to rAF
    // would leave the rail uninitialised until first paint, which never
    // comes if the page opened in a background tab.
    this._recentre();
    // Web fonts land after first layout and shift the caption's height,
    // so take one more pass once they are in.
    document.fonts?.ready.then(() => {
      if (this.isConnected) this._recentre();
    });
  }

  /** Re-centre on the active slide and resync everything derived from it. */
  _recentre() {
    this.scrollToIndex(this._active, 'auto');
    this._measure();
    this._syncCaption();
  }

  /**
   * A slide carries its animation style and nothing else, and its frame
   * is a play control rather than a link — clicking a preview plays it
   * where it is. The band's CTA is the one route into the gallery.
   */
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

  /**
   * Play the example on screen from the top.
   *
   * The preview runs once and holds its last frame, so this is how an example
   * is watched a second time - and the only thing on the band that restarts
   * anything. It never changes which example is showing.
   */
  _replay() {
    const video = this.querySelector('.gr-slide.is-active .gr-video');
    if (!video) return;
    this._media.arm();
    this._media.setActive(this._active);
    try {
      video.currentTime = 0;
    } catch {
      /* metadata not in yet; play() below still starts it from the top */
    }
    const attempt = video.play();
    if (attempt && typeof attempt.catch === 'function') attempt.catch(() => {});
    this.classList.remove('is-ended');
  }

  /** Whether this item has video the rail is actually allowed to load. */
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

  // ---- events -------------------------------------------------------

  _wireEvents() {
    this._track.addEventListener('scroll', this._onScroll, { passive: true });
    window.addEventListener('resize', this._onResize, { passive: true });
    document.addEventListener('visibilitychange', this._onVisibilityChange);
    this.addEventListener('keydown', this._onKeyDown);

    this._motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this._motionQuery.addEventListener('change', this._onResize);

    // Catches container-driven size changes the window resize event
    // never sees — a sidebar opening, or the band being revealed after
    // starting out hidden. Re-centring does not alter the track's box,
    // so this cannot feed itself.
    if ('ResizeObserver' in window) {
      const ro = new ResizeObserver(() => this._onResize());
      ro.observe(this._track);
      this._observers.push(ro);
    }

    for (const arrow of this.querySelectorAll('.gr-arrow')) {
      arrow.addEventListener('click', () => this.step(Number(arrow.dataset.step)));
    }

    this.querySelector('.gr-replay')?.addEventListener('click', () => this._replay());

    // A preview that has run out says so, so Replay reads as the way on
    // rather than as a control that happens to be there.
    this.addEventListener('ended', (event) => {
      if (event.target.classList?.contains('gr-video')) this.classList.add('is-ended');
    }, true);

    // Off-centre slide: centre it. Centred slide: play or pause it in
    // place. Neither navigates — the band's CTA owns that.
    this._track.addEventListener('click', (event) => {
      const slide = event.target.closest('.gr-slide');
      if (!slide) return;
      const index = Number(slide.dataset.index);
      if (index === this._active) this._media.togglePlay();
      else this.scrollToIndex(index);
    });

    // Arm on first view: before the band is on screen it costs 0 bytes.
    //
    // And land on the lead example. The rail is a scroll container, so a
    // page restored mid-scroll, a deep link, or simply a browser keeping its
    // last position can leave the band opened on whichever slide happened to
    // be centred. Arriving at the demo should always begin where the feed
    // begins - the pipeline's own figure - and only the FIRST arrival, so a
    // visitor who scrolls the rail and comes back is left where they were.
    this._observers.push(onVisible(this, () => {
      this._media.arm();
      if (this._landed) return;
      this._landed = true;
      const lead = Math.min(Math.max(Number(this._data?.defaultIndex) || 0, 0),
                            this._items.length - 1);
      this.scrollToIndex(lead, 'auto');
      this._syncCaption();
      this._media.setActive(lead);
      this._syncPlayback();
    }, { rootMargin: '200px 0px' }));

    // Playback follows visibility — scrolled away means paused, not
    // decoding frames behind the fold.
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
    // A gesture's momentum keeps the track moving after the finger or the
    // wheel has stopped, so the window stays open a moment past the last
    // event. This is set before the frame gate below, or a coalesced frame
    // swallows the end of the gesture and the slide is never committed.
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

  /** The gesture has come to rest: take whatever is centred now. */
  _settle() {
    this._measure();
    this._userScrolling = false;
  }

  /** The gestures that mean "I am moving this", and nothing else. */
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

  // ---- carousel mechanics -------------------------------------------

  step(delta) {
    this.scrollToIndex(this._active + delta);
  }

  scrollToIndex(index, behavior) {
    const clamped = Math.min(Math.max(index, 0), this._slides.length - 1);
    const slide = this._slides[clamped];
    if (!slide) return;
    // Asking for a slide IS the decision; the scroll that follows is how it
    // is shown, not how it is decided. Reading it back from the scroll
    // position is what let a re-snap move the rail on its own.
    const moved = clamped !== this._active;
    this._active = clamped;
    const left = slide.offsetLeft - (this._track.clientWidth - slide.offsetWidth) / 2;
    this._track.scrollTo({
      left,
      behavior: behavior || (prefersReducedMotion() ? 'auto' : 'smooth'),
    });
    if (moved) {
      this.classList.remove('is-ended');
      this._syncCaption();
      this._media.setActive(clamped);
      this._syncPlayback();
    }
    this._syncArrows();
  }

  /**
   * One layout read per animation frame: write each slide's 0→1
   * closeness to the track centre into `--p` and pick the winner.
   */
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

    // Only a scroll the visitor is performing commits a new slide. A
    // re-snap after a video attached, a resize, a restored scroll position:
    // those move the track without anyone asking, and must not move the demo.
    if (best !== this._active && this._userScrolling) {
      this._active = best;
      this.classList.remove('is-ended');
      this._syncCaption();
      this._media.setActive(best);
      this._syncPlayback();
    }
    this._syncArrows();
  }

  _syncArrows() {
    this.querySelector('.gr-arrow-prev').disabled = this._active === 0;
    this.querySelector('.gr-arrow-next').disabled = this._active === this._items.length - 1;
  }

  _syncCaption() {
    const item = this._items[this._active];
    if (!item) return;
    for (const slide of this._slides) {
      slide.classList.toggle('is-active', Number(slide.dataset.index) === this._active);
    }
    this._captionStyle.textContent = item.style;
    // Styles with no rendered video yet have no run time to show.
    this._captionDur.textContent = item.duration || '';
    this._captionSep.hidden = !item.duration;
    this._counterNow.textContent = pad(this._active + 1);
  }

  _syncPlayback() {
    this._media.setPlaying(
      Boolean(this._onScreen) && !document.hidden && !prefersReducedMotion()
    );
  }
}

customElements.define('gallery-rail', GalleryRail);
