import {
  loadJSON, onVisible, esc, icon, BenchSelect, panelHead, MediaSlot, reducedMotion,
} from './bench-core.js';
import { lightbox, zoomBadge } from './bench-lightbox.js';

/**
 * <bench-diversity src="data/benchmark/diversity.json"></bench-diversity>
 *
 * NARRATIVE DIVERSITY — the figure's blue pane.
 *
 * Same three-column shape as the density pane so the two read as a
 * pair, with one deliberate difference: **no numbers anywhere**. The
 * benchmark reports no distribution over these axes, so the right-hand
 * column lists variants with a qualitative hint and nothing else — no
 * percentages, no counts, no bars. Whatever is written in the data file
 * is what appears; the component computes no statistics.
 *
 * The centre is a video stage rather than a still. A variant carrying a
 * clip plays it, muted and looping; one carrying only a poster shows
 * the real final frame; one carrying neither keeps its paper skeleton.
 * Nothing is requested until the pane is on screen, and only the
 * selected variant ever holds a decoder (see MediaSlot).
 *
 * THE STAGE IS NOT A BUTTON HERE. In the other panes the media is a still and
 * clicking it to open it larger is the only thing a click could mean. This one
 * is a running clip with its own controls, and making the whole frame a zoom
 * target meant every click anywhere, the play badge included, threw the viewer
 * open. So fullscreen lives on the magnifier in the corner and nowhere else,
 * and because it is now the only way in, it stays visible rather than fading
 * up on hover.
 *
 * AND ON NARRATION LENGTH, THE NARRATION SHOWS. An axis about how much is said
 * per step cannot be demonstrated by a side label reading "a sentence per
 * step": the narration itself is the difference, so each variant carries its
 * own lines timed to its own clip and the line being spoken sits under the
 * stage, following the playhead. The other axes have nothing to read, which is
 * why their clips run at 4x and this one runs at 1x.
 *
 * WHICH MEANS IT NEEDS A WAY THROUGH. The Maximum variant is eighty seconds
 * long and its point is made in the first two lines; reading the ninth by
 * waiting for it is not reading it. So the narration comes with a step
 * control: prev/next, the position, and a tick per step you can click
 * straight to. Stepping seeks the clip and pauses it, because someone moving
 * by hand is reading, not watching, and a clip that keeps rolling would carry
 * them off the line they just chose. The play button in the same row gives the
 * clip back. Arrow keys work anywhere in the row.
 */

class BenchDiversity extends HTMLElement {
  async connectedCallback() {
    const src = this.getAttribute('src');
    if (!src) return;
    try {
      this.data = await loadJSON(src);
    } catch {
      this.remove();
      return;
    }
    this.classList.add('bx-pane', 'bv');
    this.dataset.accent = this.data.accent || 'diversity';
    this.cIndex = 0;
    this.vIndex = 0;
    this._render();

    onVisible(this, () => {
      this.media.arm();
      this._paintStage();
    }, { rootMargin: '220px' });

    // Playback follows visibility: scrolled away or tab hidden, nothing runs.
    this._vis = new IntersectionObserver(
      ([e]) => (e.isIntersecting && !document.hidden ? this.media.play() : this.media.pause()),
      { threshold: 0.15 }
    );
    this._vis.observe(this);
    this._hidden = () => (document.hidden ? this.media.pause() : this.media.play());
    document.addEventListener('visibilitychange', this._hidden);
  }

  disconnectedCallback() {
    this.select?.destroy();
    this._vis?.disconnect();
    document.removeEventListener('visibilitychange', this._hidden);
    this.media?.clear();
  }

  get category() {
    return this.data.categories[this.cIndex];
  }

  _render() {
    const uid = `bv-${Math.random().toString(36).slice(2, 7)}`;
    this.uid = uid;
    this.innerHTML = `
      ${panelHead('Narrative Diversity', 'presentation characteristics')}
      <div class="bx-body bv-body">
        <div class="bv-rail">
          <span class="bx-eyebrow" id="${uid}-lbl">Vary by</span>
          <div class="bv-select-host"></div>
          <p class="bv-blurb"></p>
          <div class="bv-axis" aria-hidden="true">
            <span class="bv-axis-from"></span>
            <span class="bv-axis-line"><i></i></span>
            <span class="bv-axis-to"></span>
          </div>
        </div>

        <figure class="bv-stage" data-media="empty">
          <div class="bv-stage-frame frame-paper bx-zoomable">
            <button type="button" class="bv-zoom" aria-label="Open this clip fullscreen">
              ${zoomBadge()}
            </button>
            <img class="bv-poster" alt="" decoding="async">
            <video class="bv-video" muted loop playsinline preload="none"
                   disablepictureinpicture aria-label="Animated narrative preview"></video>
            <span class="bv-badge" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                   stroke-linecap="round" stroke-linejoin="round"><path d="M9 6.5l9 5.5-9 5.5z"/></svg>
            </span>
            <div class="bx-skel bv-skel">
              <span class="bx-skel-tag"></span>
              <p class="bx-skel-note"></p>
            </div>
          </div>
          <figcaption class="bv-cap"></figcaption>
          <div class="bv-narr" hidden>
            <p class="bv-line" aria-live="polite"></p>
            <div class="bv-steps">
              <button type="button" class="bv-run" aria-label="Play">
                <svg class="bv-ic-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 5.5l11 6.5-11 6.5z"/></svg>
                <svg class="bv-ic-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5h3.4v13H8zM12.6 5.5H16v13h-3.4z"/></svg>
              </button>
              <button type="button" class="bv-prev" aria-label="Previous step">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"
                     stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>
              </button>
              <span class="bv-count" aria-live="polite"></span>
              <button type="button" class="bv-next" aria-label="Next step">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"
                     stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>
              </button>
              <ol class="bv-ticks" aria-label="Steps"></ol>
            </div>
          </div>
        </figure>

        <div class="bv-variants">
          <span class="bx-eyebrow bv-variants-head">Variants</span>
          <ul class="bv-list" role="tablist" aria-labelledby="${uid}-lbl"></ul>
        </div>
      </div>`;

    this.select = new BenchSelect({
      labelledBy: `${uid}-lbl`,
      items: this.data.categories.map((c) => ({
        id: c.id,
        label: c.label,
        sub: c.sub,
        icon: c.icon,
      })),
      onChange: (_id, i) => this._setCategory(i),
    });
    this.querySelector('.bv-select-host').appendChild(this.select.el);

    this.list = this.querySelector('.bv-list');
    this.stage = this.querySelector('.bv-stage');
    this.cap = this.querySelector('.bv-cap');
    this.line = this.querySelector('.bv-line');
    this.narr = this.querySelector('.bv-narr');
    this.ticks = this.querySelector('.bv-ticks');
    this.count = this.querySelector('.bv-count');
    this.video = this.querySelector('.bv-video');
    this.media = new MediaSlot(this.stage, {
      img: this.querySelector('.bv-poster'),
      video: this.video,
    });

    // One listener for the life of the pane; which variant it is painting for
    // is read off `this._steps`, so switching variants never stacks another.
    this.video.addEventListener('timeupdate', () => this._paintLine());
    for (const ev of ['play', 'pause', 'ended']) {
      this.video.addEventListener(ev, () => this._paintRun());
    }

    this.narr.addEventListener('click', (e) => {
      if (e.target.closest('.bv-run')) return this._toggleRun();
      if (e.target.closest('.bv-prev')) return this._step(-1);
      if (e.target.closest('.bv-next')) return this._step(1);
      const tick = e.target.closest('.bv-tick');
      if (tick) this._goStep(Number(tick.dataset.i));
    });
    this.narr.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); this._step(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); this._step(-1); }
    });

    this.list.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-i]');
      if (b) this._setVariant(Number(b.dataset.i));
    });
    this.list.addEventListener('keydown', (e) => this._listKeys(e));

    // Only the magnifier. A click on the frame, the poster or the play badge
    // is a click on a playing clip and should do nothing to the page.
    this.querySelector('.bv-zoom').addEventListener('click', () => this._expand());

    this._setCategory(0);
  }

  _listKeys(e) {
    const btns = [...this.list.querySelectorAll('button[data-i]')];
    const at = btns.indexOf(document.activeElement);
    if (at < 0) return;
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    let next = null;
    if (step) next = (at + step + btns.length) % btns.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = btns.length - 1;
    if (next === null) return;
    e.preventDefault();
    btns[next].focus();
    this._setVariant(next);
  }

  _setCategory(i) {
    this.cIndex = i;
    this.vIndex = 0;
    const c = this.category;

    this.querySelector('.bv-blurb').textContent = c.blurb || '';
    const axis = this.querySelector('.bv-axis');
    axis.hidden = !c.axis;
    if (c.axis) {
      axis.querySelector('.bv-axis-from').textContent = c.axis.from;
      axis.querySelector('.bv-axis-to').textContent = c.axis.to;
    }

    // A layered category (the five base styles plus the Layer 2 camera
    // move) is grouped rather than flat, because "Pan and Zoom" is not a
    // sixth sibling — it composes on top of any of the five.
    const layered = !!c.layered;
    this.querySelector('.bv-variants-head').textContent = layered ? 'Layer 1 · Layer 2' : 'Variants';

    const item = (v, k) => `
      <li role="presentation">
        <button type="button" role="tab" data-i="${k}" aria-selected="${k === 0}"
                tabindex="${k === 0 ? 0 : -1}" class="bv-item${k === 0 ? ' is-on' : ''}"
                ${v.layer === 2 ? 'data-layer="2"' : ''}>
          <span class="bv-item-dot" aria-hidden="true"></span>
          <span class="bv-item-text">
            <span class="bv-item-label">${esc(v.label)}</span>
            ${v.hint ? `<span class="bv-item-hint">${esc(v.hint)}</span>` : ''}
          </span>
          ${v.video ? `<span class="bv-item-flag" title="clip available">${icon('film')}</span>` : ''}
        </button>
      </li>`;

    if (layered) {
      const l1 = c.variants.map((v, k) => [v, k]).filter(([v]) => v.layer !== 2);
      const l2 = c.variants.map((v, k) => [v, k]).filter(([v]) => v.layer === 2);
      this.list.innerHTML =
        l1.map(([v, k]) => item(v, k)).join('') +
        (l2.length
          ? `<li class="bv-sep" role="presentation"><span>Layer 2</span></li>` +
            l2.map(([v, k]) => item(v, k)).join('')
          : '');
    } else {
      this.list.innerHTML = c.variants.map(item).join('');
    }

    this.list.toggleAttribute('data-many', c.variants.length > 4);
    this._setVariant(0);
  }

  _setVariant(k) {
    this.vIndex = k;
    this.list.querySelectorAll('button[data-i]').forEach((b) => {
      const on = Number(b.dataset.i) === k;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
    });
    this._paintStage();
  }

  _paintStage() {
    const c = this.category;
    const v = c.variants[this.vIndex];
    if (!v) return;

    this.stage.classList.add('is-swapping');
    clearTimeout(this._swapT);
    this._swapT = setTimeout(
      () => {
        this.querySelector('.bx-skel-tag').textContent = `${c.label} · ${v.label}`;
        this.querySelector('.bx-skel-note').textContent =
          v.caption || 'No clip in the media set yet.';
        this.cap.textContent = v.poster || v.video ? v.caption || '' : '';
        // The clip first: MediaSlot.show() calls load(), and load() is what
        // returns currentTime to zero. Arming the steps before it meant the
        // outgoing clip's playhead was still standing when the first
        // `timeupdate` landed, so a variant opened on step 02 of the one
        // before it.
        this.media.show({
          key: `${c.id}/${v.id}`,
          poster: v.poster,
          mp4: v.video,
          webm: v.webm,
        });
        this._setSteps(v);
        this.stage.classList.remove('is-swapping');
      },
      reducedMotion() ? 0 : 150
    );
  }

  /**
   * Arm the narration line for a variant, or put it away.
   *
   * A variant with `beats` is one whose narration the page is showing; the
   * line takes over the caption's slot for it, because a static sentence about
   * the variant and the sentence being spoken in it cannot both live there.
   */
  _setSteps(v) {
    this._steps = v.beats?.length ? v.beats : null;
    this._lineAt = -1;
    this.narr.hidden = !this._steps;
    this.cap.hidden = !!this._steps;
    if (!this._steps) {
      this.ticks.innerHTML = '';
      return;
    }
    // One tick per step, wide enough to hit and narrow enough that twenty of
    // them still read as a rail rather than as twenty buttons.
    this.ticks.innerHTML = this._steps
      .map(
        (b, i) => `<li><button type="button" class="bv-tick" data-i="${i}"
                     aria-label="Step ${i + 1}: ${esc(b.text.slice(0, 60))}"
                     title="${esc(b.text)}"></button></li>`
      )
      .join('');
    // Start this variant at its own first line. `load()` is supposed to return
    // the playhead to zero, but it only does so once the load algorithm
    // actually runs, and a `timeupdate` carrying the previous clip's position
    // can land before then, which opened a variant partway into the one
    // before it. Saying so outright costs nothing and cannot race.
    try {
      this.video.currentTime = 0;
    } catch {
      /* no media to seek yet; the paint below still sets the line */
    }
    this._lineAt = -1;
    this._paintStep(0);
    this._paintRun();
  }

  /** The line being spoken now, from the clip's own playhead. */
  _paintLine() {
    // No source yet means no playhead worth reading: a `timeupdate` can still
    // arrive from the clip being torn down.
    if (!this._steps || !this.video?.childElementCount) return;
    const t = this.video.currentTime;
    let at = 0;
    this._steps.forEach((b, i) => {
      if (t >= b.t - 0.05) at = i;
    });
    this._paintStep(at);
  }

  /** Paint step `at` as the live one. Cheap and idempotent. */
  _paintStep(at) {
    if (!this._steps || at === this._lineAt) return;
    this._lineAt = at;
    this.line.textContent = this._steps[at].text;
    this.count.textContent =
      `${String(at + 1).padStart(2, '0')} / ${String(this._steps.length).padStart(2, '0')}`;
    this.ticks.querySelectorAll('.bv-tick').forEach((t, i) => {
      t.classList.toggle('is-on', i === at);
      t.classList.toggle('is-seen', i < at);
    });
    const prev = this.querySelector('.bv-prev');
    const next = this.querySelector('.bv-next');
    if (prev) prev.disabled = at === 0;
    if (next) next.disabled = at === this._steps.length - 1;
  }

  _step(d) {
    if (!this._steps) return;
    this._goStep(Math.max(0, Math.min(this._steps.length - 1, this._lineAt + d)));
  }

  /**
   * Jump to a step.
   *
   * The clip is paused as well as seeked: moving by hand is reading, and a
   * clip still rolling would take the reader off the line they just asked for
   * within a second or two.
   */
  _goStep(i) {
    const b = this._steps?.[i];
    if (!b || !this.video) return;
    this.video.pause();
    try {
      this.video.currentTime = b.t;
    } catch {
      /* metadata not in yet; the line below still moves */
    }
    this._paintStep(i);
  }

  _toggleRun() {
    if (!this.video) return;
    if (this.video.paused) this.video.play().catch(() => {});
    else this.video.pause();
  }

  _paintRun() {
    this.narr?.classList.toggle('is-running', !!this.video && !this.video.paused);
    const b = this.querySelector('.bv-run');
    if (b) b.setAttribute('aria-label', this.video?.paused ? 'Play' : 'Pause');
  }

  /**
   * The selected variant's clip, on its own.
   *
   * The variant list beside the stage is already the way to move between
   * styles; adding prev/next inside the viewer would be a second, competing
   * one. The viewer opens what was clicked, and closes back to the pane.
   */
  _asset() {
    const c = this.category;
    const v = c.variants[this.vIndex];
    if (!v) return null;
    return {
      kind: v.video ? 'video' : v.poster ? 'image' : 'art',
      src: v.poster,
      mp4: v.video,
      webm: v.webm,
      poster: v.poster,
      html:
        v.poster || v.video
          ? ''
          : `<div class="bx-skel bv-skel-big">
               <span class="bx-skel-tag">${esc(c.label)} · ${esc(v.label)}</span>
               <p class="bx-skel-note">${esc(v.caption || '')}</p>
             </div>`,
      icon: v.video ? 'play' : 'film',
      label: `${c.label} · ${v.label}`,
      meta: [c.sub, v.hint, v.seconds ? `${v.seconds}s` : '',
             v.speed > 1 ? `${v.speed}x` : '',
             v.layer === 2 ? 'Layer 2, composable on all five' : '']
        .filter(Boolean)
        .join(' · '),
      caption: v.caption,
      // The times are the clip's own, so the viewer does not re-derive them.
      captionsFixed: !!v.beats?.length,
      captions: v.beats?.length
        ? v.beats.map((b, i) => ({
            t: String(i + 1).padStart(2, '0'),
            text: b.text,
            vt: b.t,
          }))
        : null,
    };
  }

  _expand() {
    const item = this._asset();
    if (item) {
      lightbox.open({ title: 'Narrative Diversity', accent: this.dataset.accent, items: [item] });
    }
  }
}

customElements.define('bench-diversity', BenchDiversity);
