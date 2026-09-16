import { loadJSON, onVisible, esc, icon, panelHead, reducedMotion, frameTrack } from './bench-core.js';
import { lightbox, zoomBadge } from './bench-lightbox.js';

/**
 * <bench-annotations src="data/benchmark/annotations.json"></bench-annotations>
 *
 * RICH ANNOTATIONS PER NARRATIVE — the figure's green pane.
 *
 * A play/show mechanism rather than a static strip. Pressing Play runs
 * the four stages of the figure in order, and each one populates:
 *
 *   1  Input Diagram      the source figure lands
 *   2  Animation Sequence its frames deal out, one per beat
 *   3  Step-wise Narration the line for the current beat types itself in
 *   4  Animated Narrative  the finished clip plays
 *
 * Beats 2 and 3 advance together and stay linked afterwards: hovering
 * or clicking a frame scrubs the narration to that beat, so the pane is
 * a scrubber once the run has finished rather than a dead diagram. The
 * run is reversible, interruptible, and skipped entirely under
 * `prefers-reduced-motion`, which jumps straight to the finished state.
 *
 * Below the flow, the three additional artifacts open in a dialog:
 * the hierarchy-aware XML, the animation-aware diagram code, and the
 * executable animation code — the last of which is not a listing but
 * the SVG itself, playing.
 *
 * Each thing opens as its own compartment. The beat frames page through the
 * beat frames; the input figure, the clip and each artifact open on their own
 * with nowhere to page to. See bench-lightbox.js for why.
 *
 * TWO THINGS ABOUT THE NARRATION.
 *
 * It is never truncated. The typing rate is derived from how long the beat
 * actually lasts, so a thirty-word line types faster rather than being cut off
 * when the next beat lands, and the sheet shrinks its type to whatever size
 * fits the finished line rather than hiding the tail behind a scrollbar
 * nobody will find. Sped up and complete beats slowed down and clipped.
 *
 * And under the finished clip it follows the picture. This clip is a preview
 * of the animation, not the narrated render: it gives every state the same
 * frame budget, runs out of animation at 4.8s of its 9.7s, and holds the
 * finished figure for the rest. Spreading ten lines across the whole 9.7s is
 * why the caption still read 05 while the figure was plainly complete. So the
 * track is laid across the clip's ANIMATED span, measured at build time and
 * carried in the data file as `clipActive`, and the last line then holds
 * through the still tail. See `frameTrack` in bench-core.js.
 */

const BEAT_MS = 1150;

class BenchAnnotations extends HTMLElement {
  async connectedCallback() {
    const src = this.getAttribute('src');
    if (!src) return;
    try {
      this.data = await loadJSON(src);
    } catch {
      this.remove();
      return;
    }
    this.classList.add('bx-pane', 'ba');
    this.dataset.accent = this.data.accent || 'annotations';
    this.beat = 0;
    this.stage = 0;
    this._token = 0;
    this._timers = [];
    this._render();

    // The input figure is fetched as soon as the pane is in reach; the
    // beat frames and the clip wait for Play (or for reduced motion,
    // which has nothing to animate and so shows the end state at once).
    onVisible(this, () => (reducedMotion() ? this._finish() : this._loadInput()), {
      rootMargin: '240px',
    });
  }

  disconnectedCallback() {
    this._token++;
    this._clearTimers();
    clearTimeout(this._typeT);
  }

  get ex() {
    return this.data.example;
  }

  _render() {
    const ex = this.ex;
    const steps = ['Input Diagram', 'Animation Sequence', 'Step-wise Narration', 'Animated Narrative'];

    this.innerHTML = `
      ${panelHead(
        'Rich Annotations Per Narrative',
        'one worked example',
        `<button type="button" class="ba-play" aria-live="polite">
           <span class="ba-play-ic" aria-hidden="true">
             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                  stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 6l9 6-9 6z"/></svg>
           </span>
           <span class="ba-play-label">Play the annotation</span>
         </button>`
      )}
      <div class="bx-body ba-body">
        <p class="bx-blurb">Every narrative in AnimateBench ships with the four artifacts below,
          produced together and checked against each other.</p>

        <ol class="ba-track" aria-label="Annotation stages">
          ${steps
            .map(
              (s, i) => `<li class="ba-track-step" data-step="${i}">
                <span class="ba-track-num">${i + 1}</span>
                <span class="ba-track-label">${esc(s)}</span>
              </li>`
            )
            .join('')}
        </ol>

        <div class="ba-flow" data-stage="0">
          <!-- 1 · input -->
          <figure class="ba-cell ba-input" data-cell="0">
            <figcaption class="ba-cell-head"><b>1</b> Input Diagram</figcaption>
            <div class="ba-cell-body frame-paper bx-zoomable" data-open="0"
                 role="button" tabindex="0" aria-label="Open the source figure fullscreen">
              ${zoomBadge()}
              <img class="ba-input-img" alt="Source figure" decoding="async">
              <div class="bx-skel ba-skel"><span class="bx-skel-tag">Source figure</span></div>
            </div>
          </figure>

          <span class="ba-arrow" aria-hidden="true"><i></i></span>

          <!-- 2 · sequence -->
          <figure class="ba-cell ba-seq" data-cell="1">
            <figcaption class="ba-cell-head"><b>2</b> Animation Sequence</figcaption>
            <!-- The same ruled container the other three cells use. Without it
                 this cell is a hole in the row before the run starts, and the
                 frames appear to float in the gap between two boxes. -->
            <div class="ba-cell-body frame-paper">
              <ol class="ba-frames" role="listbox" aria-label="Animation frames"></ol>
              <div class="bx-skel ba-skel ba-seq-skel">
                <span class="bx-skel-tag">${ex.beats.length} frames</span>
              </div>
            </div>
          </figure>

          <span class="ba-arrow" aria-hidden="true"><i></i></span>

          <!-- 3 · narration -->
          <figure class="ba-cell ba-narr" data-cell="2">
            <figcaption class="ba-cell-head"><b>3</b> Step-wise Narration</figcaption>
            <div class="ba-cell-body">
              <div class="ba-narr-sheet">
                <span class="ba-narr-beat"></span>
                <p class="ba-narr-text" aria-live="polite"></p>
                <span class="ba-narr-wave" aria-hidden="true">
                  ${Array.from({ length: 22 }, (_, i) => `<i style="--i:${i}"></i>`).join('')}
                </span>
              </div>
            </div>
          </figure>

          <span class="ba-arrow" aria-hidden="true"><i></i></span>

          <!-- 4 · narrative, with its narration as a caption under the clip -->
          <figure class="ba-cell ba-out" data-cell="3">
            <figcaption class="ba-cell-head"><b>4</b> Animated Narrative</figcaption>
            <div class="ba-cell-body frame-paper bx-zoomable" data-open="clip"
                 role="button" tabindex="0" aria-label="Open the animated narrative fullscreen">
              ${zoomBadge()}
              <video class="ba-video" muted loop playsinline preload="none"
                     disablepictureinpicture aria-label="Final animated narrative"></video>
              <div class="bx-skel ba-skel"><span class="bx-skel-tag">Final narrative</span></div>
            </div>
            <p class="ba-out-cap" aria-live="polite">
              <span class="ba-out-cap-t"></span>
              <span class="ba-out-cap-x"></span>
            </p>
          </figure>
        </div>

        <!-- additional artifacts -->
        <div class="ba-artifacts">
          <span class="bx-eyebrow ba-artifacts-head">Additional provided artifacts
            <em class="hand">click one to open the real file</em></span>
          <ul class="ba-art-list">
            ${this.data.artifacts
              .map(
                (a, i) => `
              <li>
                <button type="button" class="ba-art" data-art="${i}">
                  <span class="ba-art-ic">${icon(a.icon)}</span>
                  <span class="ba-art-text">
                    <span class="ba-art-label">${esc(a.label)}</span>
                    <span class="ba-art-sub">( ${esc(a.sub)} )</span>
                  </span>
                  <span class="ba-art-go" aria-hidden="true">→</span>
                </button>
              </li>`
              )
              .join('')}
          </ul>
        </div>
      </div>`;

    this.flow = this.querySelector('.ba-flow');
    this.framesEl = this.querySelector('.ba-frames');
    this.narrText = this.querySelector('.ba-narr-text');
    this.narrBeat = this.querySelector('.ba-narr-beat');
    this.video = this.querySelector('.ba-video');
    this.playBtn = this.querySelector('.ba-play');
    this.outCapT = this.querySelector('.ba-out-cap-t');
    this.outCapX = this.querySelector('.ba-out-cap-x');

    this.framesEl.innerHTML = this.ex.beats
      .map(
        (b, i) => `
      <li role="option" aria-selected="${i === 0}">
        <button type="button" class="ba-frame" data-beat="${i}" style="--i:${i}"
                aria-label="Frame ${i + 1} of ${this.ex.beats.length}">
          <img alt="" loading="lazy" decoding="async" data-src="${esc(b.frame)}">
          <span class="ba-frame-n">${String(i + 1).padStart(2, '0')}</span>
        </button>
      </li>`
      )
      .join('');

    this.playBtn.addEventListener('click', () => (this._running ? this._reset() : this._run()));
    // A single click opens the beat at full size — the frames are 56px
    // here, which is enough to follow the sequence and not enough to read
    // anything in it. Hovering still scrubs, so the pane stays browsable
    // without opening anything.
    this.framesEl.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-beat]');
      if (!b) return;
      const i = Number(b.dataset.beat);
      this._scrub(i);
      this._openFrames(i);
    });
    this.framesEl.addEventListener('pointerover', (e) => {
      const b = e.target.closest('button[data-beat]');
      if (b && this.stage >= 2) this._scrub(Number(b.dataset.beat), true);
    });
    this.framesEl.addEventListener('keydown', (e) => {
      const btns = [...this.framesEl.querySelectorAll('button[data-beat]')];
      const at = btns.indexOf(document.activeElement);
      if (at < 0) return;
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!step) return;
      e.preventDefault();
      const next = (at + step + btns.length) % btns.length;
      btns[next].focus();
      this._scrub(next);
    });

    this.querySelector('.ba-art-list').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-art]');
      if (b) this._openArtifact(Number(b.dataset.art));
    });

    // The input figure and the finished clip open the same way.
    const open = (e) => {
      const host = e.target.closest('[data-open]');
      if (!host) return;
      if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
      if (e.type === 'keydown') e.preventDefault();
      if (host.dataset.open === 'clip') this._openClip();
      else this._openInput();
    };
    for (const host of this.querySelectorAll('[data-open]')) {
      host.addEventListener('click', open);
      host.addEventListener('keydown', open);
    }
  }

  /** Idempotent: the first caller wins, later ones are no-ops. */
  _loadInput() {
    const img = this.querySelector('.ba-input-img');
    if (img.getAttribute('src')) return;
    img.addEventListener('load', () => this.querySelector('.ba-input').classList.add('is-loaded'), {
      once: true,
    });
    img.src = this.ex.input;
  }

  /* ---------- the scripted run ---------- */

  /**
   * The beats are scheduled, not awaited.
   *
   * An `await`-chain spanning the whole run needs its own cancel flag,
   * and a second press landing while the first run is mid-flight can
   * leave that flag set for the run still in progress — stranding the
   * flow half-lit. A monotonic token removes the shared state: each
   * timer only acts if the token it was issued under is still current,
   * so Play/Stop/Play is always exactly one live run.
   */
  _run() {
    // Pressing Play before the visibility observer has fired must still
    // work — the button is the explicit request the observer was only
    // guessing at — so arm on demand rather than returning silently.
    this._loadInput();
    const token = ++this._token;
    this._clearTimers();
    this._running = true;
    this._setPlay(true);

    if (reducedMotion()) {
      this._finish();
      return;
    }

    const at = (ms, fn) =>
      this._timers.push(setTimeout(() => token === this._token && fn(), ms));

    at(0, () => this._setStage(1)); // the input lands
    at(700, () => this._setStage(2)); // its frames deal out

    this.ex.beats.forEach((_, i) => {
      at(700 + i * BEAT_MS, () => {
        this._scrub(i);
        if (i === 0) this._setStage(3); // the narration starts writing
      });
    });

    at(700 + this.ex.beats.length * BEAT_MS, () => {
      this._setStage(4); // the finished clip
      this._playVideo();
      this._running = false;
      this._setPlay(false, true);
    });
  }

  _clearTimers() {
    for (const t of this._timers || []) clearTimeout(t);
    this._timers = [];
  }

  /** Straight to the end state: everything populated, nothing animated. */
  _finish() {
    this._loadInput();
    this._setStage(4);
    this._scrub(this.ex.beats.length - 1, true);
    this._playVideo();
    this._running = false;
    this._setPlay(false, true);
  }

  _reset() {
    this._token++;
    this._clearTimers();
    clearTimeout(this._typeT);
    this._running = false;
    this.video.pause();
    this.video.replaceChildren();
    this.video.removeAttribute('poster');
    this.video.load();
    this._setStage(0);
    this.narrText.textContent = '';
    this.narrBeat.textContent = '';
    this._setPlay(false);
  }

  _setPlay(running, done = false) {
    this.playBtn.classList.toggle('is-running', running);
    this.playBtn.querySelector('.ba-play-label').textContent = running
      ? 'Stop'
      : done
        ? 'Replay the annotation'
        : 'Play the annotation';
  }

  _setStage(n) {
    this.stage = n;
    this.flow.dataset.stage = String(n);
    this.querySelectorAll('.ba-track-step').forEach((s, i) => {
      s.classList.toggle('is-on', i < n);
      s.classList.toggle('is-now', i === n - 1);
    });
    if (n >= 2) {
      // Beat thumbnails only fetch their bytes once stage 2 is reached.
      this.framesEl.querySelectorAll('img[data-src]').forEach((im) => {
        im.src = im.dataset.src;
        im.removeAttribute('data-src');
      });
    }
  }

  _scrub(i, soft = false) {
    this.beat = i;
    const beats = this.ex.beats;
    this.framesEl.querySelectorAll('button[data-beat]').forEach((b, k) => {
      const on = k === i;
      b.classList.toggle('is-on', on);
      b.classList.toggle('is-seen', k <= i);
      b.parentElement.setAttribute('aria-selected', String(on));
    });
    this.narrBeat.textContent = `frame ${String(i + 1).padStart(2, '0')} of ${String(beats.length).padStart(2, '0')}`;
    this._type(beats[i].text, soft);
    this._fitNarration(beats[i].text);
    if (this.video.paused) this._capture(i); // the clip owns the caption once it runs
  }

  /**
   * Type the narration in; a hover scrub sets it outright instead.
   *
   * The rate comes from the beat's own budget rather than being a constant, so
   * every line — eight words or thirty — is fully written before the next beat
   * arrives. A long line simply types faster. The previous fixed 18ms tick
   * could not finish the longest lines inside a beat, and they were replaced
   * mid-sentence by the following one.
   */
  _type(text, instant) {
    clearTimeout(this._typeT);
    if (instant || reducedMotion()) {
      this.narrText.textContent = text;
      return;
    }
    const TICK = 18;
    // Leave a quarter of the beat on the end so the finished line can be read
    // rather than being completed exactly as it is replaced.
    const ticks = Math.max(1, Math.floor((BEAT_MS * 0.75) / TICK));
    const step = Math.max(1, Math.ceil(text.length / ticks));
    this.narrText.textContent = '';
    let at = 0;
    const tick = () => {
      at = Math.min(text.length, at + step);
      this.narrText.textContent = text.slice(0, at);
      if (at < text.length) this._typeT = setTimeout(tick, TICK);
    };
    tick();
  }

  /**
   * Set the sheet's type to whatever size shows the WHOLE line.
   *
   * The sheet is a fixed height on purpose — the pane must not grow as the run
   * plays — and the narration is the one thing in it whose length is not under
   * anyone's control. Scrolling it, which is what it used to do, hides the end
   * of every long beat: the box is retyping itself, so no one scrolls it.
   * Shrinking the type instead keeps every word on screen, and the measure is
   * taken against the FULL text rather than whatever has been typed so far,
   * so the size is settled before the line grows into it and does not jump
   * halfway through.
   */
  _fitNarration(full) {
    const el = this.narrText;
    if (!el) return;
    const box = el.parentElement;
    const probe = (this._probe ||= (() => {
      const n = document.createElement('p');
      n.className = 'ba-narr-text';
      n.setAttribute('aria-hidden', 'true');
      n.style.cssText =
        'position:absolute;visibility:hidden;pointer-events:none;left:0;right:0;transition:none';
      return n;
    })());
    if (probe.parentElement !== box) box.appendChild(probe);

    const MAX = 0.82; // rem — the comfortable size, used whenever it fits
    const MIN = 0.58; // rem — the floor; below this it stops being readable
    const room = el.clientHeight || box.clientHeight;
    const width = el.clientWidth;
    if (!room || !width) return;
    // Measured at the paragraph's own width, not the sheet's: the probe is
    // absolutely positioned, so its containing block is the sheet's padding
    // box and it would otherwise be a couple of dozen pixels wider — enough
    // to under-count the lines and pick a size that does not quite fit.
    probe.style.width = `${width}px`;
    probe.textContent = full;
    let size = MAX;
    for (; size > MIN; size -= 0.02) {
      probe.style.fontSize = `${size}rem`;
      if (probe.scrollHeight <= room) break;
    }
    el.style.setProperty('--ba-narr-fs', `${Math.max(MIN, size).toFixed(2)}rem`);
  }

  /**
   * The clip's caption is the narration, and each beat's position in the
   * rendered video is known (`vt` in the data file — the pipeline's own
   * frame durations divided by the 4x preview speed), so it follows the
   * playhead rather than sitting static. Before the clip is playing it
   * mirrors whatever beat is scrubbed.
   */
  _capture(i) {
    const b = this.ex.beats[i];
    if (!b || !this.outCapX) return;
    this.outCapT.textContent = String(i + 1).padStart(2, '0');
    this.outCapX.textContent = b.text;
  }

  /**
   * Tie the caption under the finished clip to the clip's own playhead.
   *
   * The track is computed from the clip's MEASURED duration rather than read
   * out of the data file: `vt` there is an even division, and an even division
   * of a narration whose lines run from eight words to thirty puts the caption
   * a sentence ahead of the voice long before the end. See `beatTrack`.
   */
  _syncCaption() {
    const v = this.video;
    const beats = this.ex.beats;
    if (!beats.length) return;

    const build = () => {
      const d = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : this.ex.clipSeconds;
      this._capTrack = frameTrack(beats, d || 0, this.ex.clipActive);
      this._capAt = -1;
    };
    build();
    v.addEventListener('loadedmetadata', build);

    v.addEventListener('timeupdate', () => {
      if (!this._capTrack?.length) return;
      let at = 0;
      this._capTrack.forEach((t, n) => {
        if (v.currentTime >= t - 0.05) at = n;
      });
      if (at !== this._capAt) {
        this._capAt = at;
        this._capture(at);
      }
    });
  }

  _playVideo() {
    const n = this.ex.narrative;
    if (!n || this.video.childElementCount) return this.video.play?.().catch(() => {});
    if (n.poster) this.video.poster = n.poster;
    for (const [url, type] of [[n.webm, 'video/webm'], [n.mp4, 'video/mp4']]) {
      if (!url) continue;
      const s = document.createElement('source');
      s.src = url;
      s.type = type;
      this.video.appendChild(s);
    }
    this.video.addEventListener(
      'loadeddata',
      () => {
        this.querySelector('.ba-out').classList.add('is-loaded');
        this._syncCaption();
        if (!reducedMotion()) this.video.play().catch(() => {});
      },
      { once: true }
    );
    this.video.addEventListener('error', () => this.querySelector('.ba-out').classList.remove('is-loaded'), {
      once: true,
    });
    this.video.load();
  }

  /* ---------- the viewer, one compartment per thing ---------- */

  _openInput() {
    this._loadInput();
    const ex = this.ex;
    lightbox.open({
      title: 'Input Diagram',
      accent: this.dataset.accent,
      items: [{
        kind: 'image',
        src: ex.input,
        label: ex.title,
        meta: 'the source figure, unmodified',
      }],
    });
  }

  /**
   * The beat frames, and only the frames.
   *
   * No narration underneath: at pane scale these are 56px wide, and what the
   * viewer is for here is seeing what the frame actually shows. The narration
   * belongs to the clip, where it can follow a playhead.
   */
  _openFrames(index = 0) {
    const beats = this.ex.beats;
    lightbox.open({
      title: 'Animation Sequence',
      accent: this.dataset.accent,
      paging: true,
      index,
      items: beats.map((b, i) => ({
        kind: 'image',
        src: b.frame,
        thumb: b.frame,
        short: String(i + 1).padStart(2, '0'),
        label: `Frame ${String(i + 1).padStart(2, '0')} of ${beats.length}`,
        icon: 'frames',
      })),
    });
  }

  /** The finished clip, with the whole narration timed to its playhead. */
  _openClip() {
    const ex = this.ex;
    // The same length-weighted track the pane uses, so the viewer and the pane
    // never disagree about which line is being spoken. If the clip is already
    // loaded here its real duration is the better number; otherwise the data
    // file's own figure stands in until the viewer measures it.
    const track =
      this._capTrack?.length === ex.beats.length
        ? this._capTrack
        : frameTrack(ex.beats, ex.clipSeconds || 0, ex.clipActive);
    lightbox.open({
      title: 'Animated Narrative',
      accent: this.dataset.accent,
      items: [{
        kind: 'video',
        mp4: ex.narrative?.mp4,
        webm: ex.narrative?.webm,
        poster: ex.narrative?.poster,
        label: 'Animated Narrative',
        meta: ex.clipSeconds ? `${ex.clipSeconds}s` : '',
        captionsActive: ex.clipActive,
        captions: ex.beats.map((b, i) => ({
          t: String(i + 1).padStart(2, '0'),
          text: b.text,
          vt: track[i],
        })),
      }],
    });
  }

  _openArtifact(n) {
    const a = this.data.artifacts[n];
    if (!a) return;
    lightbox.open({
      title: a.label,
      accent: this.dataset.accent,
      items: [{
        kind: a.kind === 'text' ? 'code' : 'svg',
        src: a.file,
        lang: a.lang,
        // The XML names nodes in a figure; read on its own it is a list of
        // ids. So it opens beside the figure it describes.
        beside: a.beside || null,
        besideLabel: a.beside ? this.ex.title : '',
        label: `${a.label} (${a.sub})`,
        meta: a.file.split('/').pop(),
        caption: a.blurb,
      }],
    });
  }
}

customElements.define('bench-annotations', BenchAnnotations);
