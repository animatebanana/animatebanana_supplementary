import { loadJSON, onVisible, esc, icon, panelHead, reducedMotion, frameTrack } from './bench-core.js';
import { lightbox, zoomBadge } from './bench-lightbox.js';


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
        <p class="bx-blurb">The following artifacts are provided with every sample of
          AnimateBench.</p>

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

  _loadInput() {
    const img = this.querySelector('.ba-input-img');
    if (img.getAttribute('src')) return;
    img.addEventListener('load', () => this.querySelector('.ba-input').classList.add('is-loaded'), {
      once: true,
    });
    img.src = this.ex.input;
  }


  _run() {
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

    at(0, () => this._setStage(1));
    at(700, () => this._setStage(2));

    this.ex.beats.forEach((_, i) => {
      at(700 + i * BEAT_MS, () => {
        this._scrub(i);
        if (i === 0) this._setStage(3);
      });
    });

    at(700 + this.ex.beats.length * BEAT_MS, () => {
      this._setStage(4);
      this._playVideo();
      this._running = false;
      this._setPlay(false, true);
    });
  }

  _clearTimers() {
    for (const t of this._timers || []) clearTimeout(t);
    this._timers = [];
  }

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
    if (this.video.paused) this._capture(i);
  }

  _type(text, instant) {
    clearTimeout(this._typeT);
    if (instant || reducedMotion()) {
      this.narrText.textContent = text;
      return;
    }
    const TICK = 18;
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

    const MAX = 0.82;
    const MIN = 0.58;
    const room = el.clientHeight || box.clientHeight;
    const width = el.clientWidth;
    if (!room || !width) return;
    probe.style.width = `${width}px`;
    probe.textContent = full;
    let size = MAX;
    for (; size > MIN; size -= 0.02) {
      probe.style.fontSize = `${size}rem`;
      if (probe.scrollHeight <= room) break;
    }
    el.style.setProperty('--ba-narr-fs', `${Math.max(MIN, size).toFixed(2)}rem`);
  }

  _capture(i) {
    const b = this.ex.beats[i];
    if (!b || !this.outCapX) return;
    this.outCapT.textContent = String(i + 1).padStart(2, '0');
    this.outCapX.textContent = b.text;
  }

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

  _openClip() {
    const ex = this.ex;
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
