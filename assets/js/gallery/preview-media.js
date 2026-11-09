
export const HOT_RADIUS = 1;
export const POSTER_RADIUS = 2;

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
    this._userPaused = false;
    this._userPlaying = false;
  }

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
      record.poster.removeAttribute('src');
      record.posterSrc = '';
      this._state(record);
    });
    record.poster.addEventListener('load', () => this._state(record));

    record.video.addEventListener('error', () => this._failVideo(record));
    record.video.addEventListener('playing', () => {
      record.started = true;
      this._state(record);
    });
    record.video.addEventListener('pause', () => this._state(record));

    this._state(record);
    return record;
  }

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

  hasVideo(index) {
    const record = this._records[index];
    return Boolean(record && !record.failed && record.sources.length);
  }

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
      this._pause(record, false);
    }
    this._state(record);
  }

  setPlaying(playing) {
    if (playing === this._playing) return;
    this._playing = playing;
    this._apply();
  }

  releaseAll() {
    for (const record of this._records) {
      if (record) this._detachVideo(record);
    }
  }


  _apply() {
    if (!this._armed) return;
    for (const record of this._records) {
      if (!record) continue;
      const distance = Math.abs(record.index - this._active);

      if (distance <= this.posterRadius) this._requestPoster(record);

      if (distance <= this.hotRadius) {
        this._attachVideo(record);
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

    if (record.posterSrc) record.video.poster = record.posterSrc;

    for (const source of record.sources) {
      const el = document.createElement('source');
      el.type = source.type;
      el.addEventListener('error', () => {
        record.pendingSources -= 1;
        if (record.pendingSources <= 0) this._failVideo(record);
      });
      el.src = source.src;
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
    video.load();
    this._state(record);
  }

  _safePlay(record) {
    if (!record.videoAttached || record.failed) return;
    const attempt = record.video.play();
    if (attempt && typeof attempt.catch === 'function') attempt.catch(() => {});
  }

  _pause(record, rewind = true) {
    if (!record.videoAttached) return;
    record.video.pause();
    if (rewind && record.video.currentTime) {
      try {
        record.video.currentTime = 0;
      } catch {
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
