/**
 * The gallery's fullscreen example view.
 *
 * The grid is deliberately plain — one static diagram per card, nothing else —
 * so everything there is to know about an example lives here: the source
 * diagram on the left, the narrative it was animated into on the right, the
 * narration underneath, and the export row.
 *
 * It is a page, not a dialog with a page inside it. There is no title bar and
 * no footer of metadata chips: the gallery stratifies by style and nothing
 * else, so a header would have nothing true to put in it, and a chip row would
 * be repeating the one fact the style pill already carries. What is left is the
 * two panes, the way back, and the way along.
 *
 * THE WAY ALONG. The gallery is a list, and a list you can only read one entry
 * of — closing and reopening between each — is not being read. So the open view
 * carries prev/next over exactly the set the grid was showing, in the order it
 * is on screen, and the arrow keys drive them. Stepping swaps the contents of
 * the sheet rather than tearing it down and building another, so the frame
 * stays put and only the example inside it changes, and it deep-links as it
 * goes — the hash always names what is open, so Back walks the steps.
 *
 * PLAYBACK AND NARRATION ARE ONE CLOCK, and the clock is the clip's.
 * The pipeline's `mapping_log.txt` numbers its beats on the renderer's own
 * frame counter — half a second apart, every time, whatever was said — so
 * those stamps place nine lines in the first four seconds of a fifty-second
 * clip and then nothing. They are an ordering, not a timing. What the beats
 * genuinely carry is their text, and speech takes about as long as its text is
 * long, so the caption track is laid out by weighting each line against the
 * whole narration and stretching that over the clip's real, measured duration.
 * It is an estimate and it is honest about being one — but it tracks the voice
 * instead of contradicting it. `seconds` from the feed is only a fallback:
 * `loadedmetadata` gives the true length and the track is rebuilt from it.
 *
 * SOUND IS ON. The clips carry the pipeline's own spoken narration, and a
 * narrated clip played silently is half the result. So the viewer plays with
 * audio by default and offers a mute toggle rather than the other way round.
 * Two things have to be true for that to work and both are handled: the view
 * is opened by a click, so the page has the user activation an unmuted
 * autoplay needs, and if the browser refuses anyway the clip falls back to
 * muted and starts, with the button showing the real state, rather than
 * sitting there paused. The choice is remembered per viewer in `localStorage`,
 * which is the right size of storage for it: it is a preference about this
 * browser, not part of the example.
 *
 * An example whose clip has not been rendered yet still has its narration, so
 * it shows the beats as a list and says plainly that the clip is missing rather
 * than faking a player over a still.
 *
 * Part of the self-contained gallery module (assets/{css,js}/gallery/,
 * data/gallery/); it owns `.gl-*` and nothing else.
 */
import { formatTime, escapeHtml } from '../lib/format.js';

const reducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

// Whether this viewer has muted the gallery. A per-browser convenience, so
// localStorage is the right home for it; every access is guarded because a
// private window or blocked site data makes these throw rather than return.
const MUTE_KEY = 'ab.gallery.muted';
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
    /* nothing to do: the preference simply does not persist */
  }
};

/**
 * Beat start times across a clip of `duration` seconds.
 *
 * Each beat is given the share of the clip its text is the share of the whole
 * narration, with a small floor per beat so a three-word line still gets a
 * moment rather than flashing past. See the note at the top for why the
 * timestamps in the feed cannot be used for this.
 *
 * @param {{text:string}[]} beats
 * @param {number} duration seconds
 * @returns {number[]} one start time per beat, ascending, first at 0
 */
export function beatTrack(beats, duration) {
  if (!beats?.length || !(duration > 0)) return beats?.map(() => 0) ?? [];
  // Characters, not words: it tracks syllable count more closely, and a beat
  // naming "Spatial Pyramid Matching" really does take longer to say than one
  // of the same word count made of short words.
  const FLOOR = 8; // ~ two words' worth, so nothing collapses to nothing
  const weights = beats.map((b) => Math.max(FLOOR, (b.text || '').trim().length));
  const total = weights.reduce((a, w) => a + w, 0);
  const out = [];
  let at = 0;
  for (const w of weights) {
    out.push(Number(at.toFixed(3)));
    at += (w / total) * duration;
  }
  return out;
}

class GalleryLightbox {
  constructor() {
    this.el = null;
  }

  /**
   * @param {object} o
   * @param {object} [o.item]    one entry from gallery_items.json
   * @param {object[]} [o.items] the set to step through; defaults to [item]
   * @param {number} [o.index]   where in that set to open
   * @param {{id:string,label:string}[]} [o.exports]  export targets to offer
   * @param {(item:object) => void} [o.onNavigate]  called when prev/next moves
   * @param {() => void} [o.onClose]
   */
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
      if (e.target.closest('[data-close]')) return this.close();
      if (e.target.closest('.gl-prev')) return this.step(-1);
      if (e.target.closest('.gl-next')) return this.step(1);
      if (e.target.closest('.gl-play, .gl-bigplay')) return this._toggle();
      if (e.target.closest('.gl-mute')) return this._setMuted(!this.video?.muted);
      const x = e.target.closest('.gl-export');
      if (x) return this._export(x);
    });

    this._keys = (e) => {
      if (e.key === 'Escape') return this.close();
      if (e.key === 'Tab') return this._trap(e);
      // The seek bar owns Left/Right while it has focus — scrubbing a clip is
      // the more specific gesture, and stealing it would make the bar useless.
      // Nothing else does: after clicking Next the focus is on Next, and a
      // button that swallowed the arrow keys would mean the arrows stopped
      // working the moment you used the arrows.
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

  /* ---------- moving through the set ---------- */

  step(d) {
    if (!this.el || this.items.length < 2) return;
    const next = this.i + d;
    if (next < 0 || next >= this.items.length) return; // the ends are ends
    this.go(next);
  }

  /**
   * Swap the contents, keep the sheet.
   *
   * Reopening from scratch would replay the entry transition on every step,
   * which reads as the viewer closing and a different one arriving — the
   * opposite of what paging through one list should feel like.
   */
  go(k) {
    this.i = k;
    this._teardownPlayer();
    this._paint();
    this.onNavigate?.(this.item);
    // Focus follows the arrow the visitor is using, or falls back to the exit
    // when a button has just gone disabled under their pointer.
    const held = this.sheet.querySelector(`.gl-step:not([disabled])`);
    if (!this.sheet.contains(document.activeElement)) held?.focus();
  }

  get item() {
    return this.items[this.i];
  }

  /* ---------- the sheet ---------- */

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
               <input class="gl-seek" type="range" min="0" max="1000" value="0" step="1"
                      aria-label="Seek">
               <span class="gl-time"><b>0:00</b> / <em>${escapeHtml(
                 formatTime(clip.seconds || 0)
               )}</em></span>
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
                 ${this.exports
                   .map(
                     (x) =>
                       `<button type="button" class="gl-export" data-export="${escapeHtml(x.id)}"
                                title="Export is not wired up yet">${escapeHtml(x.label)}</button>`
                   )
                   .join('')}
               </div>`
            : ''
        }
      </div>`;

    if (clip) this._wirePlayer();
  }

  /* ---------- the player ---------- */

  _wirePlayer() {
    // Every listener below is bound to one AbortController so closing the view
    // — or stepping to the next example — detaches all of them at once.
    // Without it a `timeupdate` still in flight lands after teardown and paints
    // onto elements that are no longer there.
    this._player = new AbortController();
    const on = { signal: this._player.signal };
    this.video = this.sheet.querySelector('.gl-video');
    this.muteBtn = this.sheet.querySelector('.gl-mute');
    this.seek = this.sheet.querySelector('.gl-seek');
    this.now = this.sheet.querySelector('.gl-time b');
    this.total = this.sheet.querySelector('.gl-time em');
    this.line = this.sheet.querySelector('.gl-line');
    this.beats = this.item.beats || [];
    this._beatAt = -1;

    // A track from the feed's own `seconds`, so a caption is showing before
    // the metadata lands; rebuilt below from the length the file really is.
    this._track = beatTrack(this.beats, this.item.narrative?.seconds || 0);

    const playing = (v) => this.el?.classList.toggle('is-playing', v);
    this.video.addEventListener('loadedmetadata', () => {
      const d = this.video.duration;
      if (Number.isFinite(d) && d > 0) {
        this.total.textContent = formatTime(d);
        this._track = beatTrack(this.beats, d);
        this._beatAt = -1;
      }
      this._paintClock();
    }, on);
    this.video.addEventListener('timeupdate', () => this._paintClock(), on);
    this.video.addEventListener('play', () => playing(true), on);
    this.video.addEventListener('pause', () => playing(false), on);
    this.video.addEventListener('ended', () => playing(false), on);

    // Dragging the bar is a scrub, so the caption has to follow the drag and
    // not wait for the next `timeupdate` — the point of scrubbing is reading
    // where you are.
    this.seek.addEventListener('input', () => {
      const d = this.video?.duration || 0;
      if (!d) return;
      this.video.currentTime = (Number(this.seek.value) / 1000) * d;
      this._paintClock(true);
    }, on);

    this._setMuted(readMuted(), { remember: false });
    this._paintClock();
    if (!reducedMotion()) this._start();
  }

  /**
   * Start playing, with sound unless the viewer has muted it.
   *
   * Opening the view is a click, so the page normally has the activation an
   * unmuted autoplay needs. When it does not, `play()` rejects; rather than
   * leaving a paused clip the viewer has to notice and press, the clip is
   * muted and started, and the button then shows what is actually true.
   */
  _start() {
    const v = this.video;
    if (!v) return;
    v.play().catch(() => {
      if (v.muted) return;              // refused for some other reason
      this._setMuted(true, { remember: false });
      v.play().catch(() => {});
    });
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

  /** One pass over the clock: the bar, the time, and which beat is live. */
  _paintClock(fromScrub = false) {
    const v = this.video;
    if (!v || !this.el) return;
    const d = v.duration || 0;
    if (!fromScrub && d) this.seek.value = String(Math.round((v.currentTime / d) * 1000));
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

  /**
   * Export is a placeholder on purpose: the buttons name the three targets the
   * gallery will offer, and say so rather than silently doing nothing, so the
   * row can be wired up later without the layout moving.
   */
  _export(button) {
    button.classList.add('is-pending');
    button.setAttribute('aria-disabled', 'true');
    clearTimeout(this._exportT);
    this._exportT = setTimeout(() => {
      button.classList.remove('is-pending');
      button.removeAttribute('aria-disabled');
    }, 1400);
  }

  _trap(e) {
    const f = [
      ...this.el.querySelectorAll(
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

/** One view for the page — two open examples is never the answer. */
export const galleryLightbox = new GalleryLightbox();
