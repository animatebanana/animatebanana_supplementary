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
 *   { kind: 'embed', src, duration, cues } an animation that is a document of
 *                                          its own (an SVG with its own CSS),
 *                                          played in an iframe with its lines
 *                                          under it
 *   { kind: 'clip', src, poster, vtt }  a silent animation that loops,
 *                                          its line of narration shown in a
 *                                          panel under it, read from a
 *                                          from WebVTT; `mp4` is tried first
 *                                          and `preview` (silent) second
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
    // Trimmed, so an item with nothing to say leaves the node genuinely
    // empty: `.bl-cap:empty` hides the box, and whitespace would defeat it.
    this.cap.innerHTML = this._caption(it).trim();
    // Only pixels are worth zooming; a code listing has its own scroll
    // and an SVG artifact is already vector-sharp at any size.
    this._zoomable =
      it.kind === 'image' || it.kind === 'video' || it.kind === 'art' ||
      it.kind === 'clip' || it.kind === 'embed';
    this.zoombar.hidden = !this._zoomable;
    this._setZoom(1, 0.5, 0.5);

    if (it.kind === 'code' || it.kind === 'svg') this._loadCode(it);
    if (it.kind === 'video') this._wireVideo(it);
    if (it.kind === 'clip') this._wireClip(it);
    if (it.kind === 'embed') this._wireEmbed(it);
  }

  _render(it) {
    switch (it.kind) {
      case 'image':
        return `<img class="bl-img" src="${esc(it.src)}" alt="${esc(it.alt ?? it.label ?? '')}" decoding="async">`;
      case 'video':
        return `<video class="bl-video" controls autoplay muted loop playsinline
                  ${it.poster ? `poster="${esc(it.poster)}"` : ''}>
                  ${it.webm ? `<source src="${esc(it.webm)}" type="video/webm">` : ''}
                  ${it.mp4 ? `<source src="${esc(it.mp4)}" type="video/mp4">` : ''}
                </video>`;
      case 'embed':
        // Its own document, with its own stylesheet and its own animation:
        // an iframe keeps the two from reaching into each other.
        return `<iframe class="bl-embed" src="${esc(it.src)}" title="${esc(it.label || 'Animation')}"
                  scrolling="no"></iframe>`;
      case 'clip':
        // Silent by construction: these animations were never narrated, so
        // the element is muted and loops, and the words live in the caption
        // track below rather than in an audio channel.
        return `<video class="bl-video bl-nv-video" playsinline preload="auto" muted loop
                  ${it.poster ? `poster="${esc(it.poster)}"` : ''}>
                  ${it.src ? `<source src="${esc(it.src)}" type="video/mp4">` : ''}
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
    if (it.kind === 'embed') {
      return `
        ${it.label ? `<b class="bl-cap-label">${esc(it.label)}</b>` : ''}
        ${it.meta ? `<span class="bl-cap-meta">${esc(it.meta)}</span>` : ''}
        <p class="bl-nv-caption" aria-live="polite"></p>`;
    }
    if (it.kind === 'clip') {
      return `
        ${it.label ? `<b class="bl-cap-label">${esc(it.label)}</b>` : ''}
        ${it.meta ? `<span class="bl-cap-meta">${esc(it.meta)}</span>` : ''}
        <div class="bl-nv-bar">
          <button type="button" class="bl-nv-btn bl-nv-play" aria-label="Pause">
            <svg class="bl-nv-ic-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 5.5l11 6.5-11 6.5z"/></svg>
            <svg class="bl-nv-ic-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 5.5h3.6v13H7.5zM12.9 5.5h3.6v13h-3.6z"/></svg>
          </button>
          <div class="bl-nv-seek">
            <span class="bl-nv-track" aria-hidden="true"><i></i></span>
            <input type="range" min="0" max="1000" value="0" step="1"
                   class="bl-nv-range" aria-label="Seek within the animation">
          </div>
          <span class="bl-nv-time"><b>0:00</b> / <span>0:00</span></span>
          <span class="bl-nv-status" aria-live="polite" hidden></span>
        </div>
        <p class="bl-nv-caption" aria-live="polite"></p>`;
    }
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
      const cut = text.length > 60000 ? `${text.slice(0, 60000)}\n…` : text;
      code.innerHTML = markup(cut);
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

  /**
   * The animation, on its own: silent, looping, and captioned.
   *
   * These clips were rendered from a diagram's own animation frames and have
   * no audio, so there is nothing to unmute. What the narration says lives in
   * the WebVTT file beside the clip, and exactly one line of it is on screen
   * at a time, in the panel under the animation. No caption burned over the
   * picture, and no scrolling transcript beside it: the animation is the
   * thing being watched, and the panel says what is happening in it.
   */
  _wireClip(it) {
    const v = this.stage.querySelector('video');
    const bar = this.cap.querySelector('.bl-nv-bar');
    const line = this.cap.querySelector('.bl-nv-caption');
    const status = this.cap.querySelector('.bl-nv-status');
    const playBtn = this.cap.querySelector('.bl-nv-play');
    const range = this.cap.querySelector('.bl-nv-range');
    const fill = this.cap.querySelector('.bl-nv-track i');
    const timeNow = this.cap.querySelector('.bl-nv-time b');
    const timeAll = this.cap.querySelector('.bl-nv-time span');
    if (!v || !bar) return;

    let cues = [];
    let at = -1;
    let scrubbing = false;

    const clock = (t) => {
      if (!Number.isFinite(t)) t = 0;
      return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
    };
    const paintRun = () => {
      bar.classList.toggle('is-running', !v.paused);
      playBtn.setAttribute('aria-label', v.paused ? 'Play' : 'Pause');
    };
    const paintTime = () => {
      const d = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : 0;
      timeNow.textContent = clock(v.currentTime);
      timeAll.textContent = clock(d);
      const p = d ? Math.min(1, v.currentTime / d) : 0;
      fill.style.width = `${p * 100}%`;
      if (!scrubbing) range.value = String(Math.round(p * 1000));
    };
    // One line at a time, and the panel keeps its height between lines so
    // the picture above it never moves as the words change.
    const paintLine = (force) => {
      if (!cues.length) return;
      const t = v.currentTime;
      let k = -1;
      cues.forEach((c, n) => {
        if (t >= c.start - 0.05) k = n;
      });
      if (k === at && !force) return;
      at = k;
      const on = k >= 0 && t < cues[k].end + 0.4;
      const text = on ? cues[k].text : '';
      if (text === line.textContent) return;
      line.classList.add('is-swapping');
      clearTimeout(this._capT);
      this._capT = setTimeout(() => {
        line.textContent = text;
        line.classList.remove('is-swapping');
      }, reducedMotion() ? 0 : 140);
    };
    const setCues = (next) => {
      cues = next;
      at = -1;
      line.hidden = !cues.length;
      paintLine(true);
    };

    const onLoaded = async () => {
      paintTime();
      try {
        const r = await fetch(it.vtt);
        if (!r.ok) throw new Error(r.status);
        setCues(parseVTT(await r.text()));
      } catch {
        setCues([]);
      }
    };

    const fallBack = () => {
      if (this.stage.querySelector('video') !== v) return;
      // Only when nothing could be loaded at all. A <source> error can also
      // arrive after a clip is already playing; that is not a missing video.
      if (v.readyState > 0 || v.networkState !== HTMLMediaElement.NETWORK_NO_SOURCE) return;
      this.zoomer.innerHTML = it.poster
        ? `<img class="bl-img" src="${esc(it.poster)}" alt="${esc(it.label || '')}" decoding="async">`
        : '';
      line.hidden = true;
      bar.dataset.mode = 'none';
      status.hidden = false;
      status.textContent = 'Animation not uploaded yet';
      playBtn.disabled = true;
      range.disabled = true;
    };

    const sources = v.querySelectorAll('source');
    sources[sources.length - 1]?.addEventListener('error', fallBack);
    if (!sources.length) fallBack();

    v.muted = true;                       // silent clips; nothing to unmute
    v.addEventListener('loadedmetadata', onLoaded, { once: true });
    v.addEventListener('timeupdate', () => {
      paintLine(false);
      paintTime();
    });
    v.addEventListener('seeked', () => {
      paintLine(true);
      paintTime();
    });
    for (const ev of ['play', 'pause', 'ended']) v.addEventListener(ev, paintRun);

    v.play().catch(() => {});

    // A click on the picture plays or pauses, as on any player.
    v.addEventListener('click', () => (v.paused ? v.play().catch(() => {}) : v.pause()));
    playBtn.addEventListener('click', () => (v.paused ? v.play().catch(() => {}) : v.pause()));

    const seek = () => {
      const d = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : 0;
      if (!d) return;
      v.currentTime = (Number(range.value) / 1000) * d;
      paintTime();
    };
    range.addEventListener('pointerdown', () => (scrubbing = true));
    range.addEventListener('input', seek);
    range.addEventListener('change', () => {
      scrubbing = false;
      seek();
    });

    paintRun();
    paintTime();
  }

  /**
   * The embedded animation's narration, one line at a time.
   *
   * There is no playhead to read: the animation is CSS inside another
   * document, so its position comes from that document's own running
   * animation where the browser exposes it, and from a wall clock where it
   * does not. Either way the caption is the only thing being driven — the
   * picture runs itself.
   */
  _wireEmbed(it) {
    const frame = this.stage.querySelector('iframe');
    const line = this.cap.querySelector('.bl-nv-caption');
    if (!frame || !line || !it.cues?.length) return;

    const t0 = performance.now();
    let at = -1;
    let cand = -1; // index waiting to be confirmed
    let held = 0; // frames it has held for
    let anim = null; // the latched animation clock
    let lastT = 0;
    this._capWant = null;

    /* The clock has to be the SAME clock every frame. The embedded SVG's
       animations all run in lockstep, so which one is picked does not
       matter — but whether there is one does: `getAnimations()` comes back
       empty while the document is loading and again whenever the run is
       rebuilt, and the old code quietly fell back to the wall clock for
       those frames. The two clocks have different phases, so every lapse
       jumped the position and flipped the cue index. Latch an animation
       once one exists and hold the last good position through any gap. */
    const readClock = () => {
      const dur = it.duration || 1;
      try {
        if (!anim || anim.playState === 'idle' || anim.currentTime == null) {
          const runs = frame.contentDocument?.getAnimations?.() || [];
          anim = runs.find((a) => a.currentTime != null) || anim;
        }
        if (anim?.currentTime != null) {
          lastT = (anim.currentTime / 1000) % dur;
          return lastT;
        }
      } catch {
        /* not ready, or not readable */
      }
      if (anim) return lastT; // hold the last good position rather than jump
      lastT = ((performance.now() - t0) / 1000) % dur;
      return lastT;
    };

    /* One fade at a time: comparing against the queued text, not just the
       DOM, stops a burst of cue changes restarting the fade-out repeatedly
       and leaving the line stuck at opacity 0. */
    const setLine = (text) => {
      if (line.textContent === text) {
        this._capWant = text;
        clearTimeout(this._capT);
        line.classList.remove('is-swapping');
        return;
      }
      if (this._capWant === text) return;
      this._capWant = text;
      line.classList.add('is-swapping');
      clearTimeout(this._capT);
      this._capT = setTimeout(() => {
        line.textContent = this._capWant;
        line.classList.remove('is-swapping');
      }, reducedMotion() ? 0 : 140);
    };

    const tick = () => {
      if (!this.el || !line.isConnected) return;       // the viewer has closed
      const t = readClock();
      let k = -1;
      it.cues.forEach((c, i) => {
        if (t >= c.start - 0.05) k = i;
      });
      // One stray frame must not swap the line: a new index has to hold for
      // two frames running before it is committed.
      if (k === at) {
        cand = k;
        held = 0;
      } else if (k === cand) {
        if (++held >= 2) {
          at = k;
          setLine(k >= 0 ? it.cues[k].text : '');
        }
      } else {
        cand = k;
        held = 1;
      }
      this._embedRaf = requestAnimationFrame(tick);
    };
    this._embedRaf = requestAnimationFrame(tick);
  }

  close(silent = false) {
    if (this._embedRaf) cancelAnimationFrame(this._embedRaf);
    this._embedRaf = 0;
    document.removeEventListener('keydown', this._keys || (() => {}));
    const el = this.el;
    if (!el) return;
    this.el = null;
    // A narrated clip must fall silent the moment the viewer closes, not when
    // its node is finally removed after the exit transition.
    el.querySelectorAll('video').forEach((v) => v.pause());
    document.body.classList.remove('bl-locked');
    el.classList.remove('is-in');
    const done = () => el.remove();
    if (silent || reducedMotion()) done();
    else setTimeout(done, 220);
    if (!silent) this.returnFocus?.focus?.();
  }
}

/**
 * Colour the markup of an XML or SVG artifact.
 *
 * These files are the point of the pane — a hierarchy-aware XML tree, a
 * diagram redrawn as addressable SVG, that SVG with its animation compiled in
 * — and read as one grey slab none of that is visible. So the tags, the
 * attributes they carry and the values on them are told apart, which is
 * enough to see the structure at a glance. No library: one pass, and anything
 * it does not recognise stays plain text.
 */
function markup(text) {
  const out = [];
  const re = /<!--[\s\S]*?-->|<\/?[A-Za-z_][\w:.-]*(?:"[^"]*"|'[^']*'|[^<>])*\/?>/g;
  let at = 0;
  let m;
  const plain = (t) => t && out.push(esc(t));
  while ((m = re.exec(text))) {
    plain(text.slice(at, m.index));
    at = m.index + m[0].length;
    const tag = m[0];
    if (tag.startsWith('<!--')) {
      out.push(`<i class="tk-com">${esc(tag)}</i>`);
      continue;
    }
    // <name  attr="value" …  />  — the name, then each attribute in turn
    const head = tag.match(/^<\/?[A-Za-z_][\w:.-]*/)[0];
    const tail = tag.endsWith('/>') ? '/>' : '>';
    const body = tag.slice(head.length, tag.length - tail.length);
    const name = head.replace(/^<\/?/, '');
    out.push(`<i class="tk-punc">${head.startsWith('</') ? '&#60;/' : '&#60;'}</i>`);
    out.push(`<i class="tk-tag">${esc(name)}</i>`);
    out.push(
      esc(body).replace(
        /([\w:.-]+)(\s*=\s*)(&#34;[^&]*&#34;|&#39;[^&]*&#39;|"[^"]*"|'[^']*')/g,
        (_a, k, eq, v) => `<i class="tk-attr">${k}</i>${eq}<i class="tk-val">${v}</i>`
      )
    );
    out.push(`<i class="tk-punc">${esc(tail)}</i>`);
  }
  plain(text.slice(at));
  return out.join('');
}

/** Minimal WebVTT reader: cue timings and text, nothing else. */
function parseVTT(text) {
  const toSec = (s) => {
    const p = s.trim().replace(',', '.').split(':').map(Number);
    return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1];
  };
  return text
    .replace(/\r/g, '')
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block.split('\n');
      const i = lines.findIndex((l) => l.includes('-->'));
      if (i < 0) return null;
      const [a, b] = lines[i].split('-->');
      const txt = lines.slice(i + 1).join(' ').trim();
      if (!txt) return null;
      return { start: toSec(a), end: toSec(b.trim().split(/\s+/)[0]), text: txt };
    })
    .filter(Boolean);
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
