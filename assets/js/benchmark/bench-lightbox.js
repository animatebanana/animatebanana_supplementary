import { esc, icon, reducedMotion, frameTrack } from './bench-core.js';

/**
 * The benchmark module's fullscreen viewer.
 *
 * Each pane holds assets that are too small to judge at pane scale — a 56px
 * beat thumbnail, a 260px-tall clip, an XML listing. This opens any of them at
 * window size.
 *
 * **One set at a time.** A pane never hands over everything it owns; it hands
 * over the one compartment the viewer was opened from. Click a frame and you
 * page through frames; click the XML and you get the XML, beside the figure it
 * describes, with nowhere to page to. That is deliberate: a viewer that walks
 * from a beat frame into a code listing invites you to read a set that was
 * never a set, and it makes "what am I looking at" a question.
 *
 * So `open()` takes `paging`, and only a genuine sequence sets it. With paging
 * off there is no prev/next, no thumbnail rail and no counter — just the asset.
 *
 *   { kind: 'image',  src, caption?, label?, meta? }
 *   { kind: 'video',  mp4, webm, poster, captions?: [{t, text, vt}] }
 *   { kind: 'svg',    src }                rendered live, source beside it
 *   { kind: 'code',   src, lang, beside? } a listing; `beside` puts an image
 *                                          on the left, the code on the right
 *   { kind: 'art',    html, caption? }     a drawn placeholder, for an asset
 *                                          that does not exist yet
 *
 * Captions are the item's business, not the viewer's: a frame passes none and
 * gets none. Only the finished clip carries `captions`, because there the
 * narration is the point and follows the playhead.
 *
 * Accessibility: a real modal — `role="dialog" aria-modal="true"`, focus moved
 * in and restored on close, Tab cycled inside, Escape closes, and
 * Left/Right/Home/End move through a set when there is one.
 */

const codeCache = new Map();

function fetchText(url) {
  if (!codeCache.has(url)) {
    codeCache.set(
      url,
      fetch(url).then((r) => {
        if (!r.ok) throw new Error(r.status);
        return r.text();
      })
    );
  }
  return codeCache.get(url);
}

class BenchLightbox {
  constructor() {
    this.el = null;
    this.items = [];
    this.i = 0;
  }

  /**
   * @param {object} o
   * @param {string} o.title
   * @param {string} o.accent
   * @param {object[]} o.items
   * @param {number} [o.index]
   * @param {boolean} [o.paging]  true only for a real sequence (frames)
   */
  open({ title, accent, items, index = 0, paging = false }) {
    this.close(true);
    this.items = items.filter(Boolean);
    if (!this.items.length) return;
    this.paging = paging && this.items.length > 1;
    this.i = Math.max(0, Math.min(this.items.length - 1, index));
    this.returnFocus = document.activeElement;

    const el = document.createElement('div');
    el.className = 'bl';
    el.dataset.accent = accent || 'annotations';
    el.dataset.paging = this.paging ? 'on' : 'off';
    el.innerHTML = `
      <div class="bl-backdrop" data-close></div>
      <div class="bl-panel" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <header class="bl-head">
          <span class="bl-title">${esc(title)}</span>
          <span class="bl-count" aria-live="polite"></span>
          <button type="button" class="bl-close" data-close aria-label="Close viewer">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2"
                 stroke-linecap="round"><path d="M2 2l12 12M14 2L2 14"/></svg>
          </button>
        </header>

        <div class="bl-body">
          ${
            this.paging
              ? `<button type="button" class="bl-nav bl-prev" aria-label="Previous">
                   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
                        stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>
                 </button>`
              : ''
          }
          <div class="bl-stage" data-zoom="out" tabindex="-1">
            <div class="bl-zoomer"></div>
          </div>
          ${
            this.paging
              ? `<button type="button" class="bl-nav bl-next" aria-label="Next">
                   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
                        stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>
                 </button>`
              : ''
          }
        </div>

        <div class="bl-zoombar" hidden>
          <button type="button" class="bl-zb" data-z="-">−</button>
          <span class="bl-zb-val">100%</span>
          <button type="button" class="bl-zb" data-z="+">+</button>
          <button type="button" class="bl-zb bl-zb-reset" data-z="0">Fit</button>
          <em>click the image to zoom · drag to pan · scroll to scale</em>
        </div>
        <figcaption class="bl-cap"></figcaption>
        ${this.paging ? '<ol class="bl-rail" role="tablist" aria-label="Frames"></ol>' : ''}
      </div>`;

    document.body.appendChild(el);
    document.body.classList.add('bl-locked');
    this.el = el;
    this.stage = el.querySelector('.bl-stage');
    this.zoomer = el.querySelector('.bl-zoomer');
    this.zoombar = el.querySelector('.bl-zoombar');
    this.cap = el.querySelector('.bl-cap');
    this.rail = el.querySelector('.bl-rail');

    if (this.rail) {
      this.rail.innerHTML = this.items
        .map(
          (it, k) => `
        <li role="presentation">
          <button type="button" role="tab" data-i="${k}" class="bl-thumb"
                  aria-selected="${k === this.i}" title="${esc(it.label || `Item ${k + 1}`)}">
            ${
              it.thumb
                ? `<img src="${esc(it.thumb)}" alt="" loading="lazy" decoding="async">`
                : `<span class="bl-thumb-ic">${icon(it.icon || 'image')}</span>`
            }
            <em>${esc(it.short || String(k + 1).padStart(2, '0'))}</em>
          </button>
        </li>`
        )
        .join('');
    }

    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) return this.close();
      const t = e.target.closest('.bl-thumb');
      if (t) return this.go(Number(t.dataset.i));
      if (e.target.closest('.bl-prev')) return this.step(-1);
      if (e.target.closest('.bl-next')) return this.step(1);
      const z = e.target.closest('.bl-zb');
      if (z) return this._zoomBy(z.dataset.z);
    });
    this._wireZoom();

    this._keys = (e) => {
      if (e.key === 'Escape') return this.close();
      if (!this.paging) {
        if (e.key === 'Tab') this._trap(e);
        return;
      }
      if (e.key === 'ArrowRight') return this.step(1);
      if (e.key === 'ArrowLeft') return this.step(-1);
      if (e.key === 'Home') return this.go(0);
      if (e.key === 'End') return this.go(this.items.length - 1);
      if (e.key === 'Tab') this._trap(e);
    };
    document.addEventListener('keydown', this._keys);

    requestAnimationFrame(() => el.classList.add('is-in'));
    this.go(this.i);
    el.querySelector('.bl-close').focus();
  }

  /** Keep Tab inside the dialog — it is modal, so nothing behind it is reachable. */
  _trap(e) {
    const f = [
      ...this.el.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
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

  step(d) {
    this.go((this.i + d + this.items.length) % this.items.length);
  }

  go(k) {
    this.i = k;
    const it = this.items[k];
    this.el.querySelector('.bl-count').textContent = this.paging
      ? `${String(k + 1).padStart(2, '0')} / ${String(this.items.length).padStart(2, '0')}`
      : it.meta || '';
    this.rail?.querySelectorAll('.bl-thumb').forEach((b, j) => {
      b.setAttribute('aria-selected', String(j === k));
      b.classList.toggle('is-on', j === k);
      if (j === k) b.scrollIntoView({ block: 'nearest', inline: 'center' });
    });

    this.stage.dataset.kind = it.kind;
    this.zoomer.innerHTML = this._render(it);
    this.cap.innerHTML = this._caption(it);
    // Only pixels are worth zooming; a code listing has its own scroll
    // and an SVG artifact is already vector-sharp at any size.
    this._zoomable = it.kind === 'image' || it.kind === 'video' || it.kind === 'art';
    this.zoombar.hidden = !this._zoomable;
    this._setZoom(1, 0.5, 0.5);

    if (it.kind === 'code' || it.kind === 'svg') this._loadCode(it);
    if (it.kind === 'video') this._wireVideo(it);
  }

  _render(it) {
    switch (it.kind) {
      case 'image':
        return `<img class="bl-img" src="${esc(it.src)}" alt="${esc(it.label || '')}" decoding="async">`;
      case 'video':
        return `<video class="bl-video" controls autoplay muted loop playsinline
                  ${it.poster ? `poster="${esc(it.poster)}"` : ''}>
                  ${it.webm ? `<source src="${esc(it.webm)}" type="video/webm">` : ''}
                  ${it.mp4 ? `<source src="${esc(it.mp4)}" type="video/mp4">` : ''}
                </video>`;
      case 'svg':
        return `<div class="bl-split">
                  <div class="bl-render"><object type="image/svg+xml" data="${esc(it.src)}"
                       aria-label="${esc(it.label || '')}"></object></div>
                  <pre class="bl-code"><code>loading…</code></pre>
                </div>`;
      case 'code':
        // A structural artifact is unreadable on its own: the XML names
        // nodes in a figure, so the figure belongs on the page with it.
        return it.beside
          ? `<div class="bl-split">
               <figure class="bl-render bl-render--img">
                 <img src="${esc(it.beside)}" alt="${esc(it.besideLabel || 'The figure this describes')}"
                      decoding="async">
                 <figcaption>${esc(it.besideLabel || 'The figure it describes')}</figcaption>
               </figure>
               <pre class="bl-code"><code>loading…</code></pre>
             </div>`
          : `<pre class="bl-code bl-code--solo"><code>loading…</code></pre>`;
      case 'art':
        return `<div class="bl-art">${it.html || ''}</div>`;
      default:
        return '';
    }
  }

  _caption(it) {
    const lines = it.captions
      ? `<ol class="bl-script">${it.captions
          .map(
            (c, n) => `<li data-n="${n}"><span>${esc(c.t || String(n + 1).padStart(2, '0'))}</span>
                        <p>${esc(c.text)}</p></li>`
          )
          .join('')}</ol>`
      : '';
    return `
      ${it.label ? `<b class="bl-cap-label">${esc(it.label)}</b>` : ''}
      ${it.meta && this.paging ? `<span class="bl-cap-meta">${esc(it.meta)}</span>` : ''}
      ${it.caption ? `<p class="bl-cap-text">${esc(it.caption)}</p>` : ''}
      ${lines}`;
  }

  /* ---------- click to zoom ---------- */

  /**
   * Zoom is the reason the viewer exists: a beat frame at pane scale is 56px
   * wide, and even filling the stage a 1000px-wide process diagram is
   * unreadable at its labels. So the stage is a fixed window onto a
   * `transform: scale()`d layer.
   *
   * The interaction is the one people already expect from an image viewer:
   * click to zoom in on the point you clicked, click again to fit, scroll to
   * scale continuously, drag to pan once zoomed. The transform origin follows
   * the pointer so the thing under the cursor stays under the cursor.
   */
  _wireZoom() {
    const st = this.stage;

    st.addEventListener('click', (e) => {
      if (!this._zoomable) return;
      if (this._dragged) return; // a pan is not a click
      // A <video> owns its own controls; zoom it from the bar instead.
      if (e.target.tagName === 'VIDEO') return;
      const { x, y } = this._point(e);
      this._setZoom(this._z > 1 ? 1 : 2.5, x, y);
    });

    st.addEventListener(
      'wheel',
      (e) => {
        if (!this._zoomable) return;
        e.preventDefault();
        const { x, y } = this._point(e);
        this._setZoom(this._z * (e.deltaY < 0 ? 1.18 : 1 / 1.18), x, y);
      },
      { passive: false }
    );

    st.addEventListener('pointerdown', (e) => {
      if (!this._zoomable || this._z <= 1) return;
      this._drag = { x: e.clientX, y: e.clientY, ox: this._ox, oy: this._oy };
      this._dragged = false;
      st.setPointerCapture(e.pointerId);
      st.dataset.grab = 'on';
    });
    st.addEventListener('pointermove', (e) => {
      if (!this._drag) return;
      const dx = e.clientX - this._drag.x;
      const dy = e.clientY - this._drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) this._dragged = true;
      const r = st.getBoundingClientRect();
      this._ox = Math.min(1, Math.max(0, this._drag.ox - dx / (r.width * (this._z - 1) || 1)));
      this._oy = Math.min(1, Math.max(0, this._drag.oy - dy / (r.height * (this._z - 1) || 1)));
      this._paintZoom();
    });
    const end = () => {
      this._drag = null;
      delete st.dataset.grab;
      setTimeout(() => (this._dragged = false), 0);
    };
    st.addEventListener('pointerup', end);
    st.addEventListener('pointercancel', end);
  }

  /** Pointer position inside the stage, as a 0..1 fraction. */
  _point(e) {
    const r = this.stage.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    };
  }

  _zoomBy(op) {
    if (op === '0') return this._setZoom(1, 0.5, 0.5);
    this._setZoom(this._z * (op === '+' ? 1.4 : 1 / 1.4), this._ox, this._oy);
  }

  _setZoom(z, ox = 0.5, oy = 0.5) {
    this._z = Math.min(8, Math.max(1, z));
    if (this._z === 1) {
      this._ox = 0.5;
      this._oy = 0.5;
    } else {
      this._ox = ox;
      this._oy = oy;
    }
    this._paintZoom();
  }

  _paintZoom() {
    this.zoomer.style.transformOrigin = `${this._ox * 100}% ${this._oy * 100}%`;
    this.zoomer.style.transform = `scale(${this._z})`;
    this.stage.dataset.zoom = this._z > 1 ? 'in' : 'out';
    const val = this.el?.querySelector('.bl-zb-val');
    if (val) val.textContent = `${Math.round(this._z * 100)}%`;
  }

  async _loadCode(it) {
    const code = this.stage.querySelector('code');
    if (!code) return;
    try {
      const text = await fetchText(it.src);
      code.textContent = text.length > 60000 ? `${text.slice(0, 60000)}\n…` : text;
    } catch {
      code.textContent = 'Could not read this file from here.';
    }
  }

  /**
   * The narration under the clip is not decoration — it is the beat's own line,
   * and each beat's position in the clip is known, so the caption follows the
   * playhead rather than sitting static. Only the clip gets this; frames pass
   * no captions at all.
   */
  _wireVideo(it) {
    const v = this.stage.querySelector('video');
    if (!v || !it.captions?.length) return;
    const list = this.cap.querySelector('.bl-script');
    if (!list) return;
    let marks = it.captions.map((c) => (typeof c.vt === 'number' ? c.vt : null));
    if (marks.every((m) => m === null)) return;

    // The caller's times were computed against whatever duration it knew.
    // Here the file itself is loaded, so its measured length is the better
    // number and the track is rebuilt from it, by the same rule the pane used,
    // so the viewer and the pane it opened from stay in step.
    // `captionsFixed` means the caller measured these against this very file
    // and there is nothing better to compute; anything else is an estimate the
    // real duration improves on.
    if (!it.captionsFixed) {
      v.addEventListener('loadedmetadata', () => {
        if (Number.isFinite(v.duration) && v.duration > 0) {
          marks = frameTrack(it.captions, v.duration, it.captionsActive);
          paint();
        }
      });
    }

    list.classList.add('is-timed');
    const paint = () => {
      const t = v.currentTime;
      let at = 0;
      marks.forEach((m, n) => {
        if (m !== null && t >= m - 0.05) at = n;
      });
      list.querySelectorAll('li').forEach((li, n) => li.classList.toggle('is-now', n === at));
      const on = list.querySelector('li.is-now');
      if (on) on.scrollIntoView({ block: 'nearest' });
    };
    v.addEventListener('timeupdate', paint);
    paint();
  }

  close(silent = false) {
    document.removeEventListener('keydown', this._keys || (() => {}));
    const el = this.el;
    if (!el) return;
    this.el = null;
    document.body.classList.remove('bl-locked');
    el.classList.remove('is-in');
    const done = () => el.remove();
    if (silent || reducedMotion()) done();
    else setTimeout(done, 220);
    if (!silent) this.returnFocus?.focus?.();
  }
}

/** One viewer for the whole page — two open dialogs is never the answer. */
export const lightbox = new BenchLightbox();

/**
 * The affordance every zoomable thing in a pane carries: a magnifier that fades
 * in on hover, so "this opens bigger" is visible rather than something you have
 * to discover by clicking.
 */
export const zoomBadge = () => `
  <span class="bx-zoom" aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round">
      <circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.4 15.4L21 21M10.5 7.6v5.8M7.6 10.5h5.8"/>
    </svg>
  </span>`;

/**
 * No longer used, and deliberately.
 *
 * Every panel header used to carry a Fullscreen button, which is a second
 * control for something the pane already offers in the better place: the media
 * itself is the button (`.bx-zoomable`, with the magnifier that fades in on
 * hover), so the header's copy was a duplicate that also had to guess which of
 * a pane's several assets "the" one was. Clicking the figure, the clip, a
 * frame or an artifact still opens it; the header just no longer says so
 * twice.
 *
 * Kept exported so a pane that genuinely needs a header action can be written
 * without reinventing the styling, but nothing calls it today.
 */
export const expandButton = (label = 'Open fullscreen') => `
  <button type="button" class="bx-expand" aria-label="${esc(label)}">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M9 3.8H3.8V9M15 3.8h5.2V9M15 20.2h5.2V15M9 20.2H3.8V15"/>
    </svg>
    <span>Fullscreen</span>
  </button>`;
