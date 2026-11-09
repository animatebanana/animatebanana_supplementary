import { formatTime, escapeHtml } from '../lib/format.js';

const reducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

const PDF_READERS = [
  {
    name: 'Adobe Acrobat Reader',
    href: 'https://get.adobe.com/reader/',
    note: 'Free \u00B7 Windows, macOS, Android, iOS',
  },
  {
    name: 'Foxit PDF Reader',
    href: 'https://www.foxit.com/pdf-reader/',
    note: 'Free \u00B7 Windows, macOS, Linux',
  },
];

const SOON_MS = 1900;

const MUTE_KEY = 'ab.gallery.muted';
const RATE_KEY = 'ab.gallery.rate';

const RATES = [1, 1.25, 1.5, 2, 0.75];
const fmtRate = (r) => `${Number.isInteger(r) ? r : String(r).replace(/0$/, '')}\u00D7`;
const readRate = () => {
  try {
    const r = Number(localStorage.getItem(RATE_KEY));
    return RATES.includes(r) ? r : 1;
  } catch {
    return 1;
  }
};
const writeRate = (r) => {
  try {
    localStorage.setItem(RATE_KEY, String(r));
  } catch {
  }
};

const readMuted = () => {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
};
const writeMuted = (v) => {
  try {
    localStorage.setItem(MUTE_KEY, v ? '1' : '0');
  } catch {
  }
};

export function beatTrack(beats, duration, nominal) {
  if (!beats?.length) return [];
  const timed = beats.every((b) => Number.isFinite(b?.t));
  if (!timed) {
    const step = duration > 0 ? duration / beats.length : 0;
    return beats.map((_, i) => Number((i * step).toFixed(3)));
  }
  const scale =
    duration > 0 && nominal > 0 && Math.abs(duration - nominal) > 0.5 ? duration / nominal : 1;
  return beats.map((b) => Number((b.t * scale).toFixed(3)));
}

class GalleryLightbox {
  constructor() {
    this.el = null;
    this.notice = null;
  }

  open({ item, items, index = 0, exports = [], onNavigate, onClose }) {
    this.close(true);
    this.items = (items?.length ? items : [item]).filter(Boolean);
    if (!this.items.length) return;
    this.i = Math.max(0, Math.min(this.items.length - 1, items?.length ? index : 0));
    this.exports = exports;
    this.onNavigate = onNavigate;
    this.onClose = onClose;
    this.returnFocus = document.activeElement;

    const el = document.createElement('div');
    el.className = 'gl';
    el.innerHTML = `
      <div class="gl-sheet" role="dialog" aria-modal="true" aria-label="Gallery example"></div>`;
    document.body.appendChild(el);
    document.body.classList.add('gl-locked');
    this.el = el;
    this.sheet = el.querySelector('.gl-sheet');

    el.addEventListener('click', (e) => {
      if (this.notice) {
        if (e.target.closest('[data-notice-go]')) {
          setTimeout(() => this._closeNotice(), 120);
          return;
        }
        if (e.target.closest('[data-notice-keep]')) return;
        if (
          e.target.closest('.gl-notice-x, .gl-notice-cancel') ||
          !e.target.closest('.gl-notice-box')
        ) {
          e.preventDefault();
          return this._closeNotice();
        }
        return;
      }
      if (e.target.closest('[data-close]')) return this.close();
      if (e.target.closest('.gl-prev')) return this.step(-1);
      if (e.target.closest('.gl-next')) return this.step(1);
      if (e.target.closest('.gl-play, .gl-bigplay')) return this._toggle();
      if (e.target.closest('.gl-mute')) return this._setMuted(!this.video?.muted);
      if (e.target.closest('.gl-rate')) return this._cycleRate();
      const gated = e.target.closest('[data-notice]');
      if (gated) {
        e.preventDefault();
        return this._openNotice(gated);
      }
      const off = e.target.closest('.gl-export--off');
      if (off) {
        e.preventDefault();
        return this._flashSoon(off);
      }
    });

    this._keys = (e) => {
      if (this.notice) {
        if (e.key === 'Escape') {
          e.preventDefault();
          return this._closeNotice();
        }
        if (e.key === 'Tab') return this._trap(e);
        return;
      }
      if (e.key === 'Escape') return this.close();
      if (e.key === 'Tab') return this._trap(e);
      const onField = e.target.closest('input, select, textarea');
      if (!onField && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        e.preventDefault();
        return this.step(e.key === 'ArrowRight' ? 1 : -1);
      }
      if (e.key === ' ' && this.video && !e.target.closest('input, button')) {
        e.preventDefault();
        this._toggle();
      }
    };
    document.addEventListener('keydown', this._keys);

    this._paint();
    requestAnimationFrame(() => el.classList.add('is-in'));
    this.sheet.querySelector('.gl-back')?.focus();
  }


  step(d) {
    if (!this.el || this.items.length < 2) return;
    const next = this.i + d;
    if (next < 0 || next >= this.items.length) return;
    this.go(next);
  }

  go(k) {
    this._closeNotice({ focus: false });
    this.i = k;
    this._teardownPlayer();
    this._paint();
    this.onNavigate?.(this.item);
    const held = this.sheet.querySelector(`.gl-step:not([disabled])`);
    if (!this.sheet.contains(document.activeElement)) held?.focus();
  }

  get item() {
    return this.items[this.i];
  }


  _paint() {
    const item = this.item;
    const clip = item.narrative;
    const many = this.items.length > 1;
    this.el.dataset.style = item.styleId || '';
    this.el.dataset.clip = clip ? 'on' : 'off';
    this.el.dataset.paging = many ? 'on' : 'off';
    this.sheet.setAttribute('aria-label', `${item.style} example`);

    this.sheet.innerHTML = `
      <div class="gl-bar">
        <button type="button" class="gl-back" data-close>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M19.5 12h-14M11 5.5L5.5 12 11 18.5"/>
          </svg>
          <span>Back to gallery</span>
        </button>
        ${
          many
            ? `<div class="gl-paging">
                 <button type="button" class="gl-step gl-prev" aria-label="Previous example"
                         ${this.i === 0 ? 'disabled' : ''}>
                   <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>
                 </button>
                 <span class="gl-pos" aria-live="polite">
                   <b>${String(this.i + 1).padStart(2, '0')}</b> / ${String(this.items.length).padStart(2, '0')}
                 </span>
                 <button type="button" class="gl-step gl-next" aria-label="Next example"
                         ${this.i === this.items.length - 1 ? 'disabled' : ''}>
                   <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>
                 </button>
               </div>`
            : ''
        }
      </div>

      <div class="gl-panes">
        <figure class="gl-pane gl-pane--source">
          <figcaption class="gl-pane-head">Source diagram</figcaption>
          <div class="gl-stage">
            <img class="gl-source" src="${escapeHtml(item.source || item.thumb)}"
                 alt="Source diagram" decoding="async">
          </div>
        </figure>

        <figure class="gl-pane gl-pane--anim">
          <figcaption class="gl-pane-head">Animated narrative</figcaption>
          <div class="gl-stage">
            ${
              clip
                ? `<video class="gl-video" playsinline preload="metadata"
                          ${clip.poster ? `poster="${escapeHtml(clip.poster)}"` : ''}>
                     <source src="${escapeHtml(clip.mp4)}" type="video/mp4">
                   </video>
                   <button type="button" class="gl-bigplay" aria-label="Play the narrative">
                     <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 5.5l11 6.5-11 6.5z"/></svg>
                   </button>`
                : `<div class="gl-missing">
                     <svg viewBox="0 0 64 64" aria-hidden="true">
                       <rect x="7" y="15" width="50" height="34" rx="5"/>
                       <path d="M27 25.5l13 6.5-13 6.5z"/>
                     </svg>
                     <p>The rendered clip for this example is not in the media set yet.
                        Its narration is below.</p>
                   </div>`
            }
          </div>
        </figure>
      </div>

      ${
        clip
          ? `<div class="gl-transport">
               <button type="button" class="gl-play" aria-label="Play">
                 <svg class="gl-ic-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 5.5l11 6.5-11 6.5z"/></svg>
                 <svg class="gl-ic-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5h3.4v13H8zM12.6 5.5H16v13h-3.4z"/></svg>
               </button>
               <div class="gl-scrub">
                 <span class="gl-rail" aria-hidden="true">
                   <i class="gl-buffered"></i>
                   <i class="gl-played"></i>
                 </span>
                 <input class="gl-seek" type="range" min="0" max="1000" value="0" step="1"
                        aria-label="Seek within the clip">
               </div>
               <span class="gl-time"><b>0:00</b> / <em>${escapeHtml(
                 formatTime(clip.seconds || 0)
               )}</em></span>
               <button type="button" class="gl-rate" aria-label="Playback speed">
                 <span class="gl-rate-val">1\u00D7</span>
               </button>
               <button type="button" class="gl-mute" aria-pressed="false" aria-label="Mute">
                 <svg class="gl-ic-sound" viewBox="0 0 24 24" aria-hidden="true">
                   <path d="M4 9.5h3.5L12 5.6v12.8L7.5 14.5H4z"/>
                   <path class="gl-wave" d="M15.4 9.2a4 4 0 0 1 0 5.6M18 6.6a7.7 7.7 0 0 1 0 10.8"/>
                 </svg>
                 <svg class="gl-ic-muted" viewBox="0 0 24 24" aria-hidden="true">
                   <path d="M4 9.5h3.5L12 5.6v12.8L7.5 14.5H4z"/>
                   <path class="gl-wave" d="M15.6 9.6l4.8 4.8M20.4 9.6l-4.8 4.8"/>
                 </svg>
               </button>
             </div>`
          : ''
      }

      <div class="gl-narration">
        ${
          item.beats?.length
            ? clip
              ? `<p class="gl-line" aria-live="polite"></p>`
              : `<ol class="gl-beats">${item.beats
                  .map(
                    (b, i) =>
                      `<li><span>${String(i + 1).padStart(2, '0')}</span>
                         <p>${escapeHtml(b.text)}</p></li>`
                  )
                  .join('')}</ol>`
            : '<p class="gl-line gl-line--empty">No narration recorded for this example.</p>'
        }
      </div>

      <div class="gl-meta">
        <div class="gl-row">
          <span class="gl-key">Animation</span>
          <span class="gl-chip">${escapeHtml(item.style)}</span>
        </div>
        ${
          this.exports.length
            ? `<div class="gl-row">
                 <span class="gl-key">Export</span>
                 ${this.exports.map((x) => this.exportHTML(item, x)).join('')}
               </div>`
            : ''
        }
      </div>`;

    if (clip) this._wirePlayer();
  }

  exportHTML(item, target) {
    const file = item.downloads?.[target.id];
    if (!file?.href) {
      return '';
    }
    const gate = target.id === 'pdf' ? ' data-notice' : '';
    return `<a class="gl-export gl-export--${escapeHtml(target.id)}" href="${escapeHtml(file.href)}"
               download="${escapeHtml(file.name || '')}"${gate}
               title="${escapeHtml(file.note || `Download the ${target.label} export.`)}">${escapeHtml(
      target.label
    )}</a>`;
  }


  _flashSoon(pill) {
    clearTimeout(this._soon);
    for (const lit of this.sheet?.querySelectorAll('.gl-export.is-soon') || []) {
      lit.classList.remove('is-soon');
    }
    pill.classList.add('is-soon');
    this._soon = setTimeout(() => pill.classList.remove('is-soon'), SOON_MS);
  }

  _openNotice(pill) {
    if (this.notice || !this.el) return;
    const href = pill.getAttribute('href');
    if (!href) return;
    const name = pill.getAttribute('download') || '';

    this._noticeFrom = pill;
    this.video?.pause();

    const notice = document.createElement('div');
    notice.className = 'gl-notice';
    notice.innerHTML = `
      <div class="gl-notice-box" role="dialog" aria-modal="true" aria-labelledby="gl-notice-title">
        <button type="button" class="gl-notice-x" aria-label="Close this notice">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"
               stroke-linecap="round" aria-hidden="true">
            <path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>
          </svg>
        </button>

        <p class="gl-notice-kicker">Before you open it</p>
        <h2 class="gl-notice-title" id="gl-notice-title">Do you have the required PDF viewer?</h2>
        <p class="gl-notice-lede">The downloaded PDF must be opened in <b>Adobe Acrobat Reader</b>
          or <b>Foxit PDF Reader</b> to render and play the animation natively in the PDF and use the
          controls. In a browser's built-in viewer, Chrome, Edge, Firefox, Safari, or in macOS
          Preview the file still opens, but you will get one still frame and controls will not work.
          You can download the viewer from the links given below.</p>

        <section class="gl-notice-sec">
          <h3 class="gl-notice-h">Don't have either? Both are free</h3>
          <ul class="gl-notice-readers">
            ${PDF_READERS.map(
              (r) => `<li>
                <a href="${escapeHtml(r.href)}" target="_blank" rel="noopener noreferrer"
                   data-notice-keep>
                  <span class="gl-notice-reader">${escapeHtml(r.name)}</span>
                  <span class="gl-notice-note">${escapeHtml(r.note)}</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                       stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M14 4.5h5.5V10M19 5l-8.5 8.5"/>
                    <path d="M18 14.5v4A1.5 1.5 0 0 1 16.5 20h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6h4"/>
                  </svg>
                </a>
              </li>`
            ).join('')}
          </ul>
        </section>

        <section class="gl-notice-sec">
          <h3 class="gl-notice-h">How to use the controls</h3>
          <p class="gl-notice-p">Use the small control bar embedded in the page, just under the
            figure, not the reader's own toolbar.</p>
          <ul class="gl-notice-keys">
            <li><span class="gl-notice-key" aria-hidden="true">&#9654; &#10073;&#10073;</span>
              <span>Play the animation, and press again to pause it.</span></li>
            <li><span class="gl-notice-key" aria-hidden="true">&#8722; &nbsp;&#43;</span>
              <span>Slow the playback down or speed it up, a step per press.</span></li>
            <li><span class="gl-notice-key" aria-hidden="true">&#9664;&#10073; &#10073;&#9654;</span>
              <span>Step one frame back or forward while it is paused.</span></li>
          </ul>
        </section>

        <div class="gl-notice-foot">
          <a class="gl-notice-go" href="${escapeHtml(href)}" download="${escapeHtml(name)}"
             data-notice-go>Download the PDF</a>
          <button type="button" class="gl-notice-cancel">Not now</button>
        </div>
      </div>`;

    this.el.appendChild(notice);
    this.notice = notice;
    requestAnimationFrame(() => notice.classList.add('is-in'));
    notice.querySelector('.gl-notice-go')?.focus();
  }

  _closeNotice({ focus = true } = {}) {
    const notice = this.notice;
    if (!notice) return;
    this.notice = null;
    notice.classList.remove('is-in');
    const done = () => notice.remove();
    if (reducedMotion()) done();
    else setTimeout(done, 160);
    const from = this._noticeFrom;
    this._noticeFrom = null;
    if (focus && from && document.contains(from)) from.focus();
  }


  _wirePlayer() {
    this._player = new AbortController();
    const on = { signal: this._player.signal };
    this.video = this.sheet.querySelector('.gl-video');
    this.muteBtn = this.sheet.querySelector('.gl-mute');
    this.seek = this.sheet.querySelector('.gl-seek');
    this.played = this.sheet.querySelector('.gl-played');
    this.buffered = this.sheet.querySelector('.gl-buffered');
    this.rateBtn = this.sheet.querySelector('.gl-rate');
    this.now = this.sheet.querySelector('.gl-time b');
    this.total = this.sheet.querySelector('.gl-time em');
    this.line = this.sheet.querySelector('.gl-line');
    this.beats = this.item.beats || [];
    this._beatAt = -1;

    this._nominal = this.item.narrative?.seconds || 0;
    this._track = beatTrack(this.beats, this._nominal, this._nominal);

    const playing = (v) => this.el?.classList.toggle('is-playing', v);
    this.video.addEventListener('loadedmetadata', () => {
      const d = this.video.duration;
      if (Number.isFinite(d) && d > 0) {
        this.total.textContent = formatTime(d);
        this._track = beatTrack(this.beats, d, this._nominal);
        this._beatAt = -1;
      }
      this._paintClock();
    }, on);
    this.video.addEventListener('timeupdate', () => this._paintClock(), on);
    this.video.addEventListener('progress', () => this._paintBuffer(), on);
    this.video.addEventListener('ratechange', () => this._paintRate(), on);
    this.video.addEventListener('play', () => playing(true), on);
    this.video.addEventListener('pause', () => playing(false), on);
    this.video.addEventListener('ended', () => playing(false), on);

    this.seek.addEventListener('input', () => {
      const d = this.video?.duration || 0;
      if (!d) return;
      this.video.currentTime = (Number(this.seek.value) / 1000) * d;
      this._paintClock(true);
    }, on);

    this._setMuted(readMuted(), { remember: false });
    this._setRate(readRate(), { remember: false });
    this._paintClock();
    this._paintBuffer();
    if (!reducedMotion()) this._start();
  }

  _start() {
    const v = this.video;
    if (!v) return;
    v.play().catch(() => {
      if (v.muted) return;
      this._setMuted(true, { remember: false });
      v.play().catch(() => {});
    });
  }

  _cycleRate() {
    const at = RATES.indexOf(this.video?.playbackRate ?? 1);
    this._setRate(RATES[(at + 1) % RATES.length]);
  }

  _setRate(rate, { remember = true } = {}) {
    const r = RATES.includes(rate) ? rate : 1;
    if (this.video) this.video.playbackRate = r;
    if (remember) writeRate(r);
    this._paintRate();
  }

  _paintRate() {
    const r = this.video?.playbackRate ?? 1;
    const el = this.rateBtn?.querySelector('.gl-rate-val');
    if (el) el.textContent = fmtRate(r);
    this.rateBtn?.classList.toggle('is-off', r !== 1);
    this.rateBtn?.setAttribute('aria-label', `Playback speed ${fmtRate(r)}, change`);
  }

  _paintBuffer() {
    const v = this.video;
    if (!v || !this.buffered) return;
    const d = v.duration;
    if (!Number.isFinite(d) || d <= 0) return;
    let end = 0;
    for (let i = 0; i < v.buffered.length; i += 1) {
      if (v.buffered.start(i) <= v.currentTime) end = Math.max(end, v.buffered.end(i));
    }
    this.buffered.style.width = `${Math.min(100, (end / d) * 100)}%`;
  }

  _setMuted(muted, { remember = true } = {}) {
    if (this.video) this.video.muted = muted;
    if (remember) writeMuted(muted);
    this.el?.classList.toggle('is-muted', muted);
    if (this.muteBtn) {
      this.muteBtn.setAttribute('aria-pressed', String(muted));
      this.muteBtn.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
    }
  }

  _teardownPlayer() {
    this.video?.pause();
    this._player?.abort();
    this._player = null;
    this.video = null;
    this.el?.classList.remove('is-playing');
  }

  _toggle() {
    if (!this.video) return;
    if (this.video.paused) this.video.play().catch(() => {});
    else this.video.pause();
  }

  _paintClock(fromScrub = false) {
    const v = this.video;
    if (!v || !this.el) return;
    const d = v.duration || 0;
    if (!fromScrub && d) this.seek.value = String(Math.round((v.currentTime / d) * 1000));
    if (this.played) this.played.style.width = d ? `${(v.currentTime / d) * 100}%` : '0%';
    this.now.textContent = formatTime(v.currentTime || 0);

    if (!this.line || !this.beats.length) return;
    let at = 0;
    this._track.forEach((t, i) => {
      if (v.currentTime >= t - 0.05) at = i;
    });
    if (at === this._beatAt) return;
    this._beatAt = at;
    this.line.textContent = this.beats[at].text;
  }


  _trap(e) {
    const root = this.notice || this.el;
    const f = [
      ...root.querySelectorAll(
        'button:not([disabled]), input, [href], [tabindex]:not([tabindex="-1"])'
      ),
    ].filter((n) => n.offsetParent !== null);
    if (!f.length) return;
    const first = f[0];
    const last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  close(silent = false) {
    document.removeEventListener('keydown', this._keys || (() => {}));
    const el = this.el;
    if (!el) return;
    this.notice = null;
    this._noticeFrom = null;
    clearTimeout(this._soon);
    this.el = null;
    this._teardownPlayer();
    document.body.classList.remove('gl-locked');
    el.classList.remove('is-in');
    const done = () => el.remove();
    if (silent || reducedMotion()) done();
    else setTimeout(done, 200);
    if (!silent) {
      this.returnFocus?.focus?.();
      this.onClose?.();
    }
  }
}

export const galleryLightbox = new GalleryLightbox();
