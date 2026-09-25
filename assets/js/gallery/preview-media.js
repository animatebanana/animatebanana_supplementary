/**
 * On-demand media budget for <gallery-rail>.
 *
 * The rail carries five 16:9 preview videos. Fetching all five up front
 * would cost several megabytes and five decoders on the one page whose
 * job is a fast first paint, so this module enforces a hard budget:
 *
 *   • nothing is requested until the rail is armed (the host arms it the
 *     first time the band scrolls into view);
 *   • only the active slide and its immediate neighbours (HOT_RADIUS)
 *     ever hold a <video> with sources — anything outside that window is
 *     detached and re-load()ed so the browser can drop the buffered
 *     bytes and free the decoder;
 *   • posters reach one slide further (POSTER_RADIUS) so pressing an
 *     arrow lands on an image rather than an empty frame;
 *   • only the active slide plays. Neighbours stay primed at
 *     preload="metadata" and paused at t=0, so the next arrow press is
 *     instant without any of them ever decoding frames.
 *
 * A 404 or decode failure is remembered per item, so a slide whose media
 * has not been produced yet is never re-requested — it simply keeps its
 * paper skeleton.
 *
 * This file is part of the self-contained gallery module
 * (assets/{css,js}/gallery/); it does not touch any other component.
 */

export const HOT_RADIUS = 1;
export const POSTER_RADIUS = 2;

/**
 * Slide media states, mirrored onto `[data-media]` for the stylesheet.
 * 'video' means a decoded frame is on screen — it stays 'video' while
 * paused, so pausing freezes on the current frame instead of snapping
 * back to the poster. Whether it is actually running is a separate
 * `[data-playing]` flag.
 */
const STATE = {
  skeleton: 'skeleton',
  loading: 'loading',
  poster: 'poster',
  video: 'video',
  missing: 'missing',
};

export class PreviewMedia {
  constructor({ hotRadius = HOT_RADIUS, posterRadius = POSTER_RADIUS } = {}) {
    this.hotRadius = hotRadius;
    this.posterRadius = posterRadius;
    this._records = [];
    this._active = 0;
    this._armed = false;
    this._playing = false;
    // An explicit click on the active slide overrides the ambient
    // autoplay gate in both directions, and is forgotten on slide change.
    this._userPaused = false;
    this._userPlaying = false;
  }

  /**
   * @param {object} rec
   * @param {number} rec.index
   * @param {HTMLElement} rec.slide  the <li>, carries [data-media]
   * @param {HTMLVideoElement} rec.video
   * @param {HTMLImageElement} rec.poster
   * @param {string} [rec.posterSrc]  '' when no poster exists yet
   * @param {{src:string,type:string}[]} [rec.sources]  [] when no video exists yet
   */
  register(rec) {
    const record = {
      posterSrc: '',
      sources: [],
      posterRequested: false,
      videoAttached: false,
      started: false,
      failed: false,
      ...rec,
    };
    this._records[record.index] = record;

    record.poster.addEventListener('error', () => {
      // Poster missing is survivable: fall back to the paper skeleton.
      record.poster.removeAttribute('src');
      record.posterSrc = '';
      this._state(record);
    });
    record.poster.addEventListener('load', () => this._state(record));

    record.video.addEventListener('error', () => this._failVideo(record));
    // `playing` (not `canplay`) is the moment the poster can safely go.
    record.video.addEventListener('playing', () => {
      record.started = true;
      this._state(record);
    });
    record.video.addEventListener('pause', () => this._state(record));

    this._state(record);
    return record;
  }

  /** Arm on first view — before this, the rail costs zero requests. */
  arm() {
    if (this._armed) return;
    this._armed = true;
    this._apply();
  }

  setActive(index) {
    if (index === this._active) return;
    this._active = index;
    this._userPaused = false;
    this._userPlaying = false;
    this._apply();
  }

  /** True when this slide has video to play at all. */
  hasVideo(index) {
    const record = this._records[index];
    return Boolean(record && !record.failed && record.sources.length);
  }

  /**
   * Click on the centred slide: play it, or pause it where it stands.
   * A user play beats the reduced-motion autoplay gate — they asked for
   * it — and a user pause survives until they move to another slide.
   */
  togglePlay() {
    const record = this._records[this._active];
    if (!this._armed || !record || record.failed || !record.sources.length) return;
    this._attachVideo(record);

    if (record.video.paused) {
      this._userPaused = false;
      this._userPlaying = true;
      this._safePlay(record);
    } else {
      this._userPaused = true;
      this._userPlaying = false;
      this._pause(record, false); // hold position; this is a pause, not a reset
    }
    this._state(record);
  }

  /** Playback gate: on screen, tab visible, motion allowed. */
  setPlaying(playing) {
    if (playing === this._playing) return;
    this._playing = playing;
    this._apply();
  }

  /** Tear everything down: detach every src so nothing keeps buffering. */
  releaseAll() {
    for (const record of this._records) {
      if (record) this._detachVideo(record);
    }
  }

  // ---- internals ----------------------------------------------------

  _apply() {
    if (!this._armed) return;
    for (const record of this._records) {
      if (!record) continue;
      const distance = Math.abs(record.index - this._active);

      if (distance <= this.posterRadius) this._requestPoster(record);

      if (distance <= this.hotRadius) {
        this._attachVideo(record);
        // Only the active slide is worth buffering ahead of time.
        record.video.preload = distance === 0 ? 'auto' : 'metadata';
      } else {
        this._detachVideo(record);
      }

      const wanted = distance === 0 && (this._playing || this._userPlaying) && !this._userPaused;
      if (wanted) this._safePlay(record);
      else this._pause(record, distance !== 0 || !this._userPaused);

      this._state(record);
    }
  }

  _requestPoster(record) {
    if (record.posterRequested || !record.posterSrc) return;
    record.posterRequested = true;
    record.poster.src = record.posterSrc;
    this._state(record);
  }

  _attachVideo(record) {
    if (record.videoAttached || record.failed || !record.sources.length) return;
    record.videoAttached = true;
    record.pendingSources = record.sources.length;

    // Poster on the element too, so there is no white flash between the
    // <img> fading out and the first decoded frame arriving.
    if (record.posterSrc) record.video.poster = record.posterSrc;

    for (const source of record.sources) {
      const el = document.createElement('source');
      el.type = source.type;
      el.addEventListener('error', () => {
        record.pendingSources -= 1;
        if (record.pendingSources <= 0) this._failVideo(record);
      });
      el.src = source.src; // set last: assigning src is what starts the fetch
      record.video.appendChild(el);
    }
    record.video.load();
    this._state(record);
  }

  _detachVideo(record) {
    if (!record.videoAttached) return;
    record.videoAttached = false;
    record.started = false;
    const { video } = record;
    video.pause();
    video.replaceChildren();
    video.removeAttribute('src');
    video.removeAttribute('poster');
    video.preload = 'none';
    // Re-load() with no source is what actually lets the engine release
    // the buffered bytes and the decoder for this element.
    video.load();
    this._state(record);
  }

  _safePlay(record) {
    if (!record.videoAttached || record.failed) return;
    const attempt = record.video.play();
    // Autoplay can still be refused (power saving, engine policy) —
    // that is fine, the poster stays up and nothing is broken.
    if (attempt && typeof attempt.catch === 'function') attempt.catch(() => {});
  }

  _pause(record, rewind = true) {
    if (!record.videoAttached) return;
    record.video.pause();
    if (rewind && record.video.currentTime) {
      try {
        record.video.currentTime = 0;
      } catch {
        /* seeking before metadata lands throws in some engines */
      }
    }
  }

  _failVideo(record) {
    if (record.failed) return;
    record.failed = true;
    record.sources = [];
    this._detachVideo(record);
    this._state(record);
  }

  _state(record) {
    const { video, poster } = record;
    let state = STATE.skeleton;

    if (record.started && video.readyState >= 2) state = STATE.video;
    else if (poster.getAttribute('src') && poster.complete && poster.naturalWidth) state = STATE.poster;
    else if (record.posterRequested || record.videoAttached) state = STATE.loading;
    else if (record.failed && !record.posterSrc) state = STATE.missing;

    record.slide.dataset.media = state;
    record.slide.dataset.playing = String(record.videoAttached && !video.paused);
  }
}
