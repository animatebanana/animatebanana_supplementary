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
 * PLAYBACK AND NARRATION ARE ONE CLOCK, and the clock is the voice's.
 * Each beat's `t` in the feed is the second that line is actually spoken. It is
 * summed from the per-frame durations the clip was rendered with, and each of
 * those is the length of that line's synthesised audio — so the track is not an
 * estimate of the narration, it is the narration's own timing, and the sum of
 * it equals the clip's duration to within a frame.
 *
 * The one thing that must NOT be used here is `mapping_log.txt`: it stamps
 * beats on the renderer's frame counter, half a second apart whatever was said,
 * which would pile nine lines into the first four seconds of a two-minute clip.
 * An earlier version of this viewer, lacking the real durations, spread the
 * lines by text length instead; that tracked the voice roughly but drifted
 * badly once a line ran long. Both are gone.
 *
 * The track is still checked against the file the browser actually loaded: if
 * `loadedmetadata` reports a duration that disagrees with the feed's `seconds`
 * by more than a hair, the times are scaled by the ratio, so a re-encode that
 * changes the length cannot silently desynchronise the captions.
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
 * SCRUBBING IS THE POINT OF THE BAR, so the bar is built for it: a drawn rail
 * with the played part filled and the part the browser has buffered shaded
 * behind it, and a real range input laid over the whole width. The input is
 * what handles the drag, the click anywhere along the track, and the arrow
 * keys; nothing is re-implemented. The clips are faststart, so a seek lands
 * without waiting for the rest of the file.
 *
 * SPEED IS A READING CONTROL. A two-minute narration read at 1x is the honest
 * pace of the result, but someone comparing five styles is not listening to
 * all five — they are looking. So the rate cycles through the useful range on
 * one button, sticks per browser like the mute choice, and shows the rate it
 * is at rather than the one it would move to.
 *
 * An example whose clip has not been rendered yet still has its narration, so
 * it shows the beats as a list and says plainly that the clip is missing rather
 * than faking a player over a still.
 *
 * THE PDF EXPORT IS GATED, and deliberately. It is the one export that is not
 * simply a file: the motion is drawn by the PDF itself — page-level scripting
 * driving the frames — so Acrobat Reader and Foxit Reader play it and every
 * other viewer, the browser's own included, shows one still frame and a control
 * bar that does nothing. Handing that over as a bare download produces a
 * visitor who believes the export is broken. So the PDF pill opens a short
 * notice first: what plays it, where to get those two readers, and the fact
 * that the play/pause and speed controls are the ones drawn on the page rather
 * than the reader's own toolbar. The notice owns the download, so nobody
 * reaches the file without passing the paragraph that makes it work.
 *
 * A format an example does not have yet keeps its place in the row and flashes
 * "coming soon" when pressed. The row is a statement about what the pipeline
 * exports, which is the same on every example; a row that lost a pill per
 * example would read as a bug rather than as an inventory.
 *
 * Part of the self-contained gallery module (assets/{css,js}/gallery/,
 * data/gallery/); it owns `.gl-*` and nothing else.
 */
import { formatTime, escapeHtml } from '../lib/format.js';

const reducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/**
 * The two readers that can actually play the PDF exports, and where they come
 * from. Both are the vendors' own download pages rather than a mirror, and both
 * are free — which is the thing someone being asked to install something wants
 * to know first.
 */
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

/** How long "Coming soon" stays up after a pill with no file behind it is pressed. */
const SOON_MS = 1900;

// Whether this viewer has muted the gallery. A per-browser convenience, so
// localStorage is the right home for it; every access is guarded because a
// private window or blocked site data makes these throw rather than return.
const MUTE_KEY = 'ab.gallery.muted';
const RATE_KEY = 'ab.gallery.rate';

/** The speeds the button cycles. 1 first, so the honest pace is the default. */
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
    /* private window, or storage refused: the rate simply is not remembered */
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
    /* nothing to do: the preference simply does not persist */
  }
};

/**
 * Beat start times, in seconds, for the clip the browser actually loaded.
 *
 * The feed already carries the real ones (see the note at the top), so this
 * does not compute a track — it takes the given times and, only if the loaded
 * file turns out to be a different length than the feed claims, rescales them
 * so the last line still lands with the last words. That guard is what keeps a
 * re-encoded clip from desynchronising the captions silently.
 *
 * Beats with no `t` at all are the one case left to estimate: they fall back to
 * an even spread, which is wrong but bounded, and no example in the shipped
 * feed takes that path.
 *
 * @param {{t?:number,text:string}[]} beats
 * @param {number} duration   the clip's real duration, seconds
 * @param {number} [nominal]  the duration the times were written against
 * @returns {number[]} one start time per beat, ascending, first at 0
 */
export function beatTrack(beats, duration, nominal) {
  if (!beats?.length) return [];
  const timed = beats.every((b) => Number.isFinite(b?.t));
  if (!timed) {
    const step = duration > 0 ? duration / beats.length : 0;
    return beats.map((_, i) => Number((i * step).toFixed(3)));
  }
  // Only a real disagreement is worth correcting; sub-second differences are
  // container rounding, and scaling by them would move every line for nothing.
  const scale =
    duration > 0 && nominal > 0 && Math.abs(duration - nominal) > 0.5 ? duration / nominal : 1;
  return beats.map((b) => Number((b.t * scale).toFixed(3)));
}

class GalleryLightbox {
  constructor() {
    this.el = null;
    /** The PDF reader notice while one is open; null means "no dialog on top". */
    this.notice = null;
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
      // The reader notice is asked first and answers on its own. While it is up
      // it is the dialog, so nothing behind it may act on a click — a stray
      // Next or Back underneath would tear the notice down mid-sentence.
      if (this.notice) {
        // The download is a real <a download>: let the browser have the click
        // and dismiss afterwards, so the anchor is still in the document when
        // the default action runs.
        if (e.target.closest('[data-notice-go]')) {
          setTimeout(() => this._closeNotice(), 120);
          return;
        }
        // A reader link opens in its own tab and leaves the notice standing:
        // the visitor is being sent to install something and will come back to
        // the download.
        if (e.target.closest('[data-notice-keep]')) return;
        // Dismissed by the cross, by "Not now", or by the backdrop around the
        // box. A click on the notice's own prose is someone reading it — very
        // likely selecting a URL — and must not take the notice away.
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
      // The PDF needs a word before it is handed over (see the note at the
      // top), so its pill opens the notice rather than downloading.
      const gated = e.target.closest('[data-notice]');
      if (gated) {
        e.preventDefault();
        return this._openNotice(gated);
      }
      // Every other available export is a plain <a download> and needs no
      // handler. A format this example does not have is a button, and pressing
      // it flashes what it is waiting for rather than doing nothing.
      const off = e.target.closest('.gl-export--off');
      if (off) {
        e.preventDefault();
        return this._flashSoon(off);
      }
    });

    this._keys = (e) => {
      // Same precedence as the click handler: while the notice is open it is
      // the dialog, so Escape dismisses it rather than the example behind it,
      // and none of the view's own shortcuts are listening.
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
    // A notice belongs to the example it was opened from, and the repaint below
    // replaces that pill, so the notice goes with it.
    this._closeNotice({ focus: false });
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

  /**
   * One export target for this example.
   *
   * Every target is a pre-built file sitting in `assets/gallery/exports/`, so
   * the button is a plain download link — nothing is assembled in the browser,
   * which is what keeps the deck and the animation package identical to what
   * the pipeline produced and keeps the page free of a zip library it would
   * otherwise need for one click.
   *
   * The PDF is the exception, and only in that its click is intercepted: the
   * element is still an href/download pair, but the notice is what activates
   * it, because a PDF whose animation the document draws itself reads as a
   * broken export in every viewer but two.
   *
   * A target the example does not have is a button rather than a link and says
   * "coming soon" when pressed. The row keeps every format either way: which
   * formats exist is a fact about the gallery, and a row that changed width per
   * example would read as a bug.
   */
  exportHTML(item, target) {
    const file = item.downloads?.[target.id];
    if (!file?.href) {
      return `<button type="button" class="gl-export gl-export--off"
                      title="The ${escapeHtml(target.label)} export for this example is still being produced.">
                <span class="gl-export-face">${escapeHtml(target.label)}</span>
                <span class="gl-soon" aria-hidden="true">Coming soon</span>
                <span class="sr-only">— coming soon</span>
              </button>`;
    }
    // `data-notice` is what the click handler looks for. The href and the
    // download name sit on the element either way, so the notice has
    // everything it needs and the pill is still a working download link if the
    // handler never runs.
    const gate = target.id === 'pdf' ? ' data-notice' : '';
    return `<a class="gl-export gl-export--${escapeHtml(target.id)}" href="${escapeHtml(file.href)}"
               download="${escapeHtml(file.name || '')}"${gate}
               title="${escapeHtml(file.note || `Download the ${target.label} export.`)}">${escapeHtml(
      target.label
    )}</a>`;
  }

  /* ---------- the PDF reader notice ---------- */

  /**
   * Flash "coming soon" on an export that has no file behind it yet.
   *
   * The bubble is on `:hover` and `:focus-visible` in CSS as well; this is the
   * press, which is the only one a touch screen has. One timer for the view, so
   * pressing two pills in turn does not leave the first one lit.
   */
  _flashSoon(pill) {
    clearTimeout(this._soon);
    for (const lit of this.sheet?.querySelectorAll('.gl-export.is-soon') || []) {
      lit.classList.remove('is-soon');
    }
    pill.classList.add('is-soon');
    this._soon = setTimeout(() => pill.classList.remove('is-soon'), SOON_MS);
  }

  /**
   * The notice that stands between the PDF pill and the file.
   *
   * It says three things, in the order someone needs them: which two readers
   * play the animation, where to get them, and that the play/pause and speed
   * controls are the ones drawn on the page rather than the reader's toolbar.
   * The download is the notice's primary action, so the paragraph is
   * unavoidable exactly once per click and never twice.
   *
   * The clip behind it is paused: the notice is something to read, and reading
   * it over a narration talking about something else is not reading it.
   *
   * @param {HTMLAnchorElement} pill  the PDF export link that was clicked
   */
  _openNotice(pill) {
    if (this.notice || !this.el) return;
    const href = pill.getAttribute('href');
    if (!href) return;
    // What the file saves as. It is set on the anchor and never printed — the
    // pipeline's internal id is not something a visitor needs to read.
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

  /**
   * Take the notice down.
   *
   * Focus goes back to the pill it came from, which is where the visitor was.
   * `focus: false` is for the case where that pill is about to be repainted out
   * of existence by a step, and the `document.contains` check covers the same
   * thing happening for any other reason.
   */
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
    this.played = this.sheet.querySelector('.gl-played');
    this.buffered = this.sheet.querySelector('.gl-buffered');
    this.rateBtn = this.sheet.querySelector('.gl-rate');
    this.now = this.sheet.querySelector('.gl-time b');
    this.total = this.sheet.querySelector('.gl-time em');
    this.line = this.sheet.querySelector('.gl-line');
    this.beats = this.item.beats || [];
    this._beatAt = -1;

    // The feed's times as written, so a caption is on screen before metadata
    // lands; re-checked below against the length the file really is.
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
    this._setRate(readRate(), { remember: false });
    this._paintClock();
    this._paintBuffer();
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

  /** Step to the next speed in the cycle. */
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

  /**
   * How much of the clip the browser is holding, shaded behind the playhead.
   *
   * It is the honest answer to "can I jump there yet": these files are
   * faststart so a seek anywhere works regardless, but a seek into unbuffered
   * video pauses to fetch, and the shading is what says so in advance.
   */
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

  /** One pass over the clock: the bar, the time, and which beat is live. */
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


  /**
   * Keep Tab inside the view — or, while the reader notice is up, inside the
   * notice. Trapping into the whole view there would tab the visitor onto
   * buttons behind a dialog they cannot see past.
   */
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
    // The notice is a child of the view, so removing the view removes it — but
    // the handles have to be dropped too, or the next open starts out believing
    // a dialog is already on screen.
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

/** One view for the page — two open examples is never the answer. */
export const galleryLightbox = new GalleryLightbox();
