/**
 * Shared plumbing for the benchmark module
 * (assets/{css,js}/benchmark/, data/benchmark/, assets/bench/).
 *
 * Nothing here touches another component. The only files the module
 * reads from outside its own folders are the site's two generic
 * helpers — `lib/data-loader.js` and `lib/lazy-load.js` — plus the
 * generic classes in `base.css` and the tokens in `tokens.css`, exactly
 * as the root README's "Adding a component" rule prescribes.
 */

export { loadJSON } from '../lib/data-loader.js';
export { onVisible } from '../lib/lazy-load.js';

/** Escape a string for interpolation into a template literal. */
export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** `prefers-reduced-motion: reduce` — checked live, not cached at load. */
export const reducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** Promise that resolves after `ms`, or immediately under reduced motion. */
export const wait = (ms) =>
  new Promise((r) => setTimeout(r, reducedMotion() ? 0 : ms));

/**
 * Where each narration line starts in a clip.
 *
 * Nothing in the pipeline records when a line is spoken, so every timing on
 * this page is derived, and the honest derivation depends on what kind of clip
 * it is.
 *
 * A PREVIEW of the animation gives every state the same frame budget and then
 * holds the finished figure for whatever is left. Pass its animated span as
 * `active` (measured at build time, carried in the data file) and the lines
 * divide that span evenly, so the last one lands as the picture completes and
 * holds through the still tail. Spreading them across the whole duration
 * instead is what left the caption reading 05 under a finished diagram.
 *
 * A NARRATED render is paced by the voice, and speech takes about as long as
 * its text is long. With no `active` span the lines are weighted by their own
 * length instead. Characters rather than words: a line naming "Spatial Pyramid
 * Matching" takes longer to say than three short ones. A floor per line keeps
 * a very short one from flashing past.
 *
 * Feed it the clip's MEASURED duration (`video.duration`) wherever one is
 * available; a figure from a data file is a fallback, not the truth.
 *
 * @param {{text?:string}[]} lines
 * @param {number} duration seconds
 * @param {number} [active] seconds of animation, for a preview clip
 * @returns {number[]} one start time per line, ascending, first at 0
 */
export function frameTrack(lines, duration, active) {
  const n = lines?.length ?? 0;
  if (!n || !(duration > 0)) return new Array(n).fill(0);

  if (active > 0 && n > 1) {
    const step = Math.min(active, duration) / (n - 1);
    return lines.map((_, i) => Number((i * step).toFixed(3)));
  }

  const FLOOR = 8; // ~ two words' worth
  const weights = lines.map((b) => Math.max(FLOOR, (b.text || '').trim().length));
  const total = weights.reduce((a, w) => a + w, 0);
  const out = [];
  let at = 0;
  for (const w of weights) {
    out.push(Number(at.toFixed(3)));
    at += (w / total) * duration;
  }
  return out;
}

/**
 * Small line-art icon set, drawn in the site's ink-outline register so
 * the panes read as part of the same sketchbook rather than as a
 * pasted-in icon font. 24x24, stroke-only, `currentColor`.
 */
const PATHS = {
  clock: '<circle cx="12" cy="12" r="8.4"/><path d="M12 7.2V12l3.2 2"/>',
  mic: '<rect x="9" y="3.2" width="6" height="10" rx="3"/><path d="M5.4 11.4a6.6 6.6 0 0 0 13.2 0M12 18v2.8"/>',
  film: '<rect x="3.2" y="5.2" width="17.6" height="13.6" rx="2"/><path d="M8 5.2v13.6M16 5.2v13.6M3.2 12h17.6"/>',
  grid: '<rect x="3.4" y="3.4" width="7" height="7" rx="1.4"/><rect x="13.6" y="3.4" width="7" height="7" rx="1.4"/><rect x="3.4" y="13.6" width="7" height="7" rx="1.4"/><rect x="13.6" y="13.6" width="7" height="7" rx="1.4"/>',
  tree: '<rect x="8.6" y="2.8" width="6.8" height="4.6" rx="1.2"/><rect x="2.4" y="16.6" width="6" height="4.6" rx="1.2"/><rect x="15.6" y="16.6" width="6" height="4.6" rx="1.2"/><path d="M12 7.4v4.4M5.4 16.6v-2.4h13.2v2.4M5.4 14.2h13.2"/>',
  graph: '<circle cx="5" cy="6" r="2.4"/><circle cx="19" cy="7.6" r="2.4"/><circle cx="11" cy="18" r="2.4"/><path d="M7.2 7.1l9.6 .8M6.3 8.1l3.6 7.7M17.9 9.8l-5.4 6.5"/>',
  image: '<rect x="3.2" y="4.8" width="17.6" height="14.4" rx="2"/><circle cx="8.6" cy="10" r="1.8"/><path d="M3.6 16.4l4.8-4 4 3.4 3.4-3 4.2 3.8"/>',
  layout: '<rect x="3.2" y="4.4" width="17.6" height="15.2" rx="2"/><path d="M3.2 9.2h17.6M9.6 9.2v10.4"/>',
  code: '<path d="M8.6 7.4L3.6 12l5 4.6M15.4 7.4l5 4.6-5 4.6M13.6 4.2l-3.2 15.6"/>',
  braces: '<path d="M9.4 3.6C6.8 3.6 7.4 8 7.4 9.4S6 12 4.4 12c1.6 0 3 1.2 3 2.6s-.6 5.8 2 5.8M14.6 3.6c2.6 0 2 4.4 2 5.8s1.4 2.6 3 2.6c-1.6 0-3 1.2-3 2.6s.6 5.8-2 5.8"/>',
  play: '<rect x="3.2" y="4.6" width="17.6" height="14.8" rx="2.6"/><path d="M10.2 9.4l4.6 2.6-4.6 2.6z"/>',
  scissors: '<circle cx="6.2" cy="6.2" r="2.6"/><circle cx="6.2" cy="17.8" r="2.6"/><path d="M8.4 7.8L19 17.4M19 6.6L8.4 16.2"/>',
  frames: '<rect x="6.4" y="3.6" width="14.2" height="11" rx="1.8"/><path d="M17.6 17.6H5.2a1.8 1.8 0 0 1-1.8-1.8V6.6"/>',
  quote: '<path d="M4.6 19.4V6.4a1.8 1.8 0 0 1 1.8-1.8h11.2a1.8 1.8 0 0 1 1.8 1.8v8.2a1.8 1.8 0 0 1-1.8 1.8H8.4z"/><path d="M8.4 9.4h7.2M8.4 12.6h4.6"/>',
  check: '<circle cx="12" cy="12" r="8.6"/><path d="M8.2 12.2l2.6 2.6 5-5.4"/>',
};

/** `icon('clock')` → an inline <svg>, or '' for an unknown name. */
export const icon = (name, cls = 'bx-ic') =>
  PATHS[name]
    ? `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true">${PATHS[name]}</svg>`
    : '';

/**
 * The panes' accessible dropdown.
 *
 * A native <select> cannot carry an icon, a description line and the
 * accent the pane keys off, and the figure this page reconstructs shows
 * each stratification axis with its own glyph — so this is a
 * listbox-pattern button + popup instead, with the full keyboard
 * contract (Enter/Space/Down to open, arrows and Home/End to move,
 * Enter to choose, Escape to dismiss) and roving `aria-activedescendant`
 * so screen readers announce the option, not the button.
 */
export class BenchSelect {
  /**
   * @param {object} o
   * @param {{id:string,label:string,sub?:string,icon?:string}[]} o.items
   * @param {(id:string, index:number)=>void} o.onChange
   * @param {string} [o.labelledBy]  id of the visible label element
   */
  constructor({ items, onChange, labelledBy = '' }) {
    this.items = items;
    this.onChange = onChange;
    this.index = 0;
    this.open = false;
    this.el = document.createElement('div');
    this.el.className = 'bx-select';
    this.uid = `bxs-${Math.random().toString(36).slice(2, 8)}`;
    this.labelledBy = labelledBy;
    this._render();
    this._wire();
  }

  _render() {
    const cur = this.items[this.index];
    this.el.innerHTML = `
      <button type="button" class="bx-select-btn" id="${this.uid}-btn"
              aria-haspopup="listbox" aria-expanded="false"
              ${this.labelledBy ? `aria-labelledby="${this.labelledBy} ${this.uid}-btn"` : ''}>
        <span class="bx-select-ic">${icon(cur.icon || 'grid')}</span>
        <span class="bx-select-text">
          <span class="bx-select-label">${esc(cur.label)}</span>
          ${cur.sub ? `<span class="bx-select-sub">${esc(cur.sub)}</span>` : ''}
        </span>
        <svg class="bx-select-caret" viewBox="0 0 16 16" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M4 6.5L8 10.5l4-4"/>
        </svg>
      </button>
      <ul class="bx-select-list" role="listbox" id="${this.uid}-list" tabindex="-1" hidden
          ${this.labelledBy ? `aria-labelledby="${this.labelledBy}"` : ''}>
        ${this.items
          .map(
            (it, i) => `
          <li role="option" id="${this.uid}-o${i}" data-i="${i}"
              aria-selected="${i === this.index}"${i === this.index ? ' class="is-sel"' : ''}>
            <span class="bx-select-opt">${esc(it.label)}</span>
          </li>`
          )
          .join('')}
      </ul>`;
    this.btn = this.el.querySelector('.bx-select-btn');
    this.list = this.el.querySelector('.bx-select-list');
  }

  _wire() {
    this.btn.addEventListener('click', () => this.toggle());
    this.btn.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        this.toggle(true);
      }
    });
    this.list.addEventListener('click', (e) => {
      const li = e.target.closest('li[data-i]');
      if (li) this.select(Number(li.dataset.i));
    });
    this.list.addEventListener('keydown', (e) => this._key(e));
    // Pointer-down, not click: a click elsewhere that also opens another
    // popup would otherwise leave two open for a frame.
    this._away = (e) => {
      if (this.open && !this.el.contains(e.target)) this.toggle(false);
    };
    document.addEventListener('pointerdown', this._away);
  }

  _key(e) {
    const last = this.items.length - 1;
    const move = (i) => {
      this._focus = Math.max(0, Math.min(last, i));
      this._paint();
      e.preventDefault();
    };
    if (e.key === 'ArrowDown') move((this._focus ?? this.index) + 1);
    else if (e.key === 'ArrowUp') move((this._focus ?? this.index) - 1);
    else if (e.key === 'Home') move(0);
    else if (e.key === 'End') move(last);
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.select(this._focus ?? this.index);
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      this.toggle(false);
      if (e.key === 'Escape') this.btn.focus();
    }
  }

  _paint() {
    const f = this._focus ?? this.index;
    this.list.setAttribute('aria-activedescendant', `${this.uid}-o${f}`);
    this.list.querySelectorAll('li').forEach((li, i) => {
      li.classList.toggle('is-focus', i === f);
      if (i === f) li.scrollIntoView({ block: 'nearest' });
    });
  }

  toggle(force) {
    this.open = force ?? !this.open;
    this.list.hidden = !this.open;
    this.btn.setAttribute('aria-expanded', String(this.open));
    this.el.classList.toggle('is-open', this.open);
    if (this.open) {
      this._focus = this.index;
      this.list.focus();
      this._paint();
    }
  }

  select(i) {
    this.index = i;
    this._focus = i;
    const cur = this.items[i];
    this.btn.querySelector('.bx-select-ic').innerHTML = icon(cur.icon || 'grid');
    this.btn.querySelector('.bx-select-label').textContent = cur.label;
    const sub = this.btn.querySelector('.bx-select-sub');
    if (sub) sub.textContent = cur.sub || '';
    this.list.querySelectorAll('li').forEach((li, k) => {
      li.setAttribute('aria-selected', String(k === i));
      li.classList.toggle('is-sel', k === i);
    });
    // The list is deliberately label-only: the glyph and the unit line
    // describe the *chosen* axis, so repeating them on every row turns a
    // five-item menu into a wall and buries the one that is selected.
    this.toggle(false);
    this.btn.focus();
    this.onChange?.(cur.id, i);
  }

  destroy() {
    document.removeEventListener('pointerdown', this._away);
  }
}

/**
 * The module's one media rule: a frame requests its bytes only once it
 * is both on screen and actually selected, and a source that 404s or
 * fails to decode is remembered and never asked for again — a slot
 * whose clip has not been produced yet simply keeps its paper skeleton.
 *
 * `stage` is any element carrying `[data-media]`; the stylesheet keys
 * every visual state off that one attribute.
 */
export class MediaSlot {
  constructor(stage, { img, video }) {
    this.stage = stage;
    this.img = img;
    this.video = video;
    this.failed = new Set();
    this.armed = false;
    this._token = 0;
    video?.addEventListener('error', () => this._fail(this._current));
    img?.addEventListener('error', () => this._fail(this._current));
  }

  arm() {
    this.armed = true;
    if (this._pending) this.show(this._pending);
  }

  _fail(key) {
    if (key) this.failed.add(key);
    this.stage.dataset.media = 'missing';
  }

  /** @param {{key:string, poster?:string|null, mp4?:string|null, webm?:string|null}} src */
  show(src) {
    this._pending = src;
    if (!this.armed) return;
    const token = ++this._token;
    this._current = src.key;
    this.clear();

    const hasVideo = (src.mp4 || src.webm) && !this.failed.has(src.key);
    const hasPoster = src.poster && !this.failed.has(`${src.key}:poster`);

    if (!hasVideo && !hasPoster) {
      this.stage.dataset.media = 'empty';
      return;
    }
    this.stage.dataset.media = 'loading';

    if (hasPoster) {
      this.img.decoding = 'async';
      this.img.src = src.poster;
      this.img
        .decode?.()
        .then(() => {
          if (token !== this._token) return;
          if (this.stage.dataset.media !== 'video') this.stage.dataset.media = 'poster';
        })
        .catch(() => {
          if (token === this._token) this.failed.add(`${src.key}:poster`);
        });
      if (!this.img.decode) this.stage.dataset.media = 'poster';
    }

    if (hasVideo) {
      if (src.poster) this.video.poster = src.poster;
      for (const [url, type] of [
        [src.webm, 'video/webm'],
        [src.mp4, 'video/mp4'],
      ]) {
        if (!url) continue;
        const s = document.createElement('source');
        s.src = url;
        s.type = type;
        this.video.appendChild(s);
      }
      this.video.load();
      this.video.addEventListener(
        'loadeddata',
        () => {
          if (token !== this._token) return;
          this.stage.dataset.media = 'video';
          if (!reducedMotion()) this.video.play().catch(() => {});
        },
        { once: true }
      );
    }
  }

  /** Detach sources and re-load() — the only thing that frees the decoder. */
  clear() {
    if (this.video) {
      this.video.pause();
      this.video.replaceChildren();
      this.video.removeAttribute('poster');
      this.video.load();
    }
    if (this.img) this.img.removeAttribute('src');
  }

  play() {
    if (this.stage.dataset.media === 'video') this.video.play().catch(() => {});
  }

  pause() {
    this.video?.pause();
  }
}

/**
 * Panel chrome shared by all four panes: the ruled header bar in the
 * pane's own accent, with an optional right-hand slot.
 */
export const panelHead = (title, sub = '', right = '') => `
  <header class="bx-head">
    <h3 class="bx-head-title">${esc(title)}</h3>
    ${sub ? `<p class="bx-head-sub">${esc(sub)}</p>` : ''}
    ${right ? `<div class="bx-head-right">${right}</div>` : ''}
  </header>`;
