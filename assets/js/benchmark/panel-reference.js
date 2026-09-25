import { loadJSON, onVisible, esc, icon, panelHead, reducedMotion } from './bench-core.js';
import { lightbox, zoomBadge } from './bench-lightbox.js';

/**
 * <bench-reference src="data/benchmark/reference.json"></bench-reference>
 *
 * EXTERNAL REFERENCE — the figure's purple pane.
 *
 * The figure's bottom-right strip, animated as the four-step procedure
 * it actually describes:
 *
 *   1  the recorded conference talk, with a playhead running the bar
 *   2  scissors travel to the in-point, snip, travel to the out-point,
 *      snip again — and the discarded thirds fall away, leaving the window
 *      the figure is on screen
 *   3  the figure region is lifted out of that window: frames fly up
 *      out of the clip and flip over like the leaves of a book
 *   4  the narration is pulled off the audio track and scribed, one
 *      transcript line at a time
 *
 * The whole run is one CSS state machine keyed off `[data-step]`, so
 * scrubbing back to an earlier step re-winds the visuals exactly rather
 * than leaving half-finished transforms behind. Under reduced motion it
 * jumps to the end state with no travel at all.
 *
 * Every asset is real: the talk excerpt, the figure-region frames extracted
 * from it, and the speaker's own transcript. The frames carried their own
 * burned-in caption when captured; that strip is cropped off before they reach
 * the page, because the narration belongs to the animation, not to a still.
 * They also carry no in-video timestamp — the slide barely changes across the
 * excerpt, so there is nothing honest to match them against — and are numbered
 * in capture order instead of being given invented times.
 */

const STEP_MS = [1500, 2600, 2200, 2600];

class BenchReference extends HTMLElement {
  async connectedCallback() {
    const src = this.getAttribute('src');
    if (!src) return;
    try {
      this.data = await loadJSON(src);
    } catch {
      this.remove();
      return;
    }
    this.classList.add('bx-pane', 'br');
    this.dataset.accent = this.data.accent || 'reference';
    this.step = 0;
    this._token = 0;
    this._timers = [];
    this._render();

    // The pane autoplays once, the first time it is seen — it is an
    // explanation, not a decoration, and a viewer who scrolls past
    // should not have to hunt for a button to understand it.
    onVisible(this, () => this._run(), { rootMargin: '160px' });
  }

  disconnectedCallback() {
    this._token++;
    this._clearTimers();
  }

  _render() {
    const d = this.data;
    const t = d.talk;
    const fromPct = t.trim?.fromPct ?? 34;
    const toPct = t.trim?.toPct ?? 48;

    this.innerHTML = `
      ${panelHead(
        'External Reference',
        '',
        `<button type="button" class="br-replay">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
             <path d="M20 12a8 8 0 1 1-2.6-5.9M20 4.2V9h-4.8"/>
           </svg>
           <span>Play Annotation</span>
         </button>`
      )}
      <div class="bx-body br-body" data-step="0" style="--from:${fromPct}%; --to:${toPct}%">
        <p class="bx-blurb">${esc(d.blurb || '')}</p>

        <ol class="br-steps" aria-label="Extraction steps">
          ${d.stages
            .map(
              (s, i) => `<li class="br-step" data-i="${i}">
                <span class="br-step-n">${i + 1}</span>
                <span class="br-step-t">
                  <b>${esc(s.label)}</b>
                  <em>${esc(s.hint)}</em>
                </span>
              </li>`
            )
            .join('')}
        </ol>

        <div class="br-flow">
          <!-- 1 & 2 · the talk, and the cut -->
          <section class="br-col br-talk-col">
            <span class="bx-eyebrow">${esc(t.label)}</span>
            <div class="br-talk frame-paper bx-zoomable${t.poster ? ' is-loaded' : ''}"
                 data-open="talk"
                 role="button" tabindex="0" aria-label="Open the talk fullscreen">
              ${zoomBadge()}
              ${
                t.poster
                  ? `<img class="br-talk-still" src="${esc(t.poster)}"
                          alt="${esc(t.title || t.label)}" loading="lazy" decoding="async">`
                  : `<div class="br-talk-art" aria-hidden="true">
                       <span class="br-talk-figure"></span>
                       <span class="br-talk-speaker"></span>
                     </div>`
              }
              <span class="br-talk-badge">${esc(t.venue)}</span>
              <div class="bx-skel br-skel"><span class="bx-skel-tag">Talk recording</span></div>
            </div>

            <div class="br-foot-slot">
            <div class="br-timeline" role="img"
                 aria-label="Talk timeline, trimmed to ${esc(t.trim.from)} to ${esc(t.trim.to)}">
              <span class="br-tl-bar">
                <i class="br-tl-lead"></i>
                <i class="br-tl-keep"></i>
                <i class="br-tl-tail"></i>
                <i class="br-tl-head"></i>
              </span>
              ${icon('scissors', 'br-scissors')}
              <span class="br-tl-marks">
                <em class="br-tl-from">${esc(t.trim.from)}</em>
                <em class="br-tl-to">${esc(t.trim.to)}</em>
              </span>
            </div>
            <p class="br-trim-note hand">${esc(t.trimNote)}</p>
            </div>
          </section>

          <span class="br-arrow" aria-hidden="true"><i></i></span>

          <!-- 3 · frames flying out and flipping -->
          <section class="br-col br-frames-col">
            <span class="bx-eyebrow">${esc(d.extract.label)} <em>${esc(d.extract.sub)}</em></span>
            <div class="br-body-slot br-deck">
              ${d.extract.frames
                .map(
                  (f, i) => `
                <figure class="br-leaf bx-zoomable" style="--i:${i}" data-frame="${i}"
                        role="button" tabindex="0" aria-label="Open extracted frame ${i + 1} fullscreen">
                  <div class="br-leaf-inner">
                    <span class="br-leaf-face br-leaf-front">
                      ${f.src ? `<img src="${esc(f.src)}" alt="" loading="lazy" decoding="async">` : '<i class="br-leaf-art"></i>'}
                    </span>
                    <span class="br-leaf-face br-leaf-back"><em>${esc(f.at)}</em></span>
                  </div>
                </figure>`
                )
                .join('')}
            </div>
            <p class="br-extract-note">${esc(d.extract.note)}</p>
          </section>

          <span class="br-arrow" aria-hidden="true"><i></i></span>

          <!-- 4 · the transcript -->
          <section class="br-col br-script-col">
            <span class="bx-eyebrow">${esc(d.transcript.label)} <em>${esc(d.transcript.sub)}</em></span>
            <div class="br-body-slot">
            <div class="br-wave" aria-hidden="true">
              ${Array.from({ length: 34 }, (_, i) => `<i style="--i:${i}"></i>`).join('')}
            </div>
            <ul class="br-script bx-zoomable" data-open="transcript"
                role="button" tabindex="0" aria-label="Open the transcript fullscreen">
              ${d.transcript.lines
                .map(
                  (l, i) => `<li style="--i:${i}">
                    <span class="br-script-t">${esc(l.t || String(i + 1).padStart(2, '0'))}</span>
                    <span class="br-script-x">“${esc(l.text)}”</span>
                  </li>`
                )
                .join('')}
            </ul>
            </div>
            <p class="br-script-note">${esc(d.transcript.lines.length)} lines aligned</p>
          </section>
        </div>
      </div>`;

    this.body = this.querySelector('.br-body');
    this.querySelector('.br-replay').addEventListener('click', () => this._run());

    const open = (e) => {
      const host = e.target.closest('[data-open], [data-frame]');
      if (!host) return;
      if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
      if (e.type === 'keydown') e.preventDefault();
      if (host.dataset.frame !== undefined) this._openFrames(Number(host.dataset.frame));
      else if (host.dataset.open === 'transcript') this._openTranscript();
      else this._openTalk();
    };
    for (const host of this.querySelectorAll('[data-open], [data-frame]')) {
      host.addEventListener('click', open);
      host.addEventListener('keydown', open);
    }
  }

  _goto(step) {
    this.step = step;
    this.body.dataset.step = String(step);
    this.querySelectorAll('.br-step').forEach((s, i) => {
      s.classList.toggle('is-on', i < step);
      s.classList.toggle('is-now', i === step - 1);
    });
  }

  /**
   * Schedule the four beats rather than awaiting them in sequence.
   *
   * An `await`-chain across ~9 seconds has to carry its own cancel flag,
   * and two overlapping runs (the autoplay landing at the same moment as
   * a Replay press) can then leave the flag set for the run that is
   * still going — which strands the pane on whatever step it had
   * reached. A monotonic token fixes that by construction: every timer
   * checks the token it was issued under, so a newer run silently
   * invalidates an older one and there is no shared flag to get wrong.
   */
  _run() {
    this._armed = true;
    const token = ++this._token;
    this._clearTimers();

    if (reducedMotion()) {
      this._goto(4);
      return;
    }

    this._goto(0);
    let at = 220;
    for (let i = 1; i <= 4; i++) {
      this._timers.push(
        setTimeout(() => {
          if (token === this._token) this._goto(i);
        }, at)
      );
      at += STEP_MS[i - 1];
    }
  }

  _clearTimers() {
    for (const t of this._timers || []) clearTimeout(t);
    this._timers = [];
  }

  /* ---------- the viewer, one compartment per thing ---------- */

  /**
   * Three things, three openings. The talk plays; the extracted frames page
   * through each other and carry no narration; the transcript opens as a page
   * of lines. Nothing walks from one into another — a viewer that steps from a
   * figure frame into a transcript would be presenting them as one sequence,
   * and they are not one.
   */
  _openTalk() {
    const t = this.data.talk;
    lightbox.open({
      title: t.label,
      accent: this.dataset.accent,
      items: [{
        kind: t.video ? 'video' : 'art',
        mp4: t.video,
        poster: t.poster,
        html: t.video
          ? ''
          : `<div class="br-art-big br-art-talk"><span class="br-talk-figure"></span>
               <span class="br-talk-speaker"></span></div>`,
        label: t.title || t.label,
        meta: [t.venue, t.uploader, t.trimNote].filter(Boolean).join(' \u00b7 '),
        caption: this.data.blurb,
      }],
    });
  }

  /** The extracted figure region, frame by frame — no narration underneath. */
  _openFrames(index = 0) {
    const f = this.data.extract.frames;
    lightbox.open({
      title: this.data.extract.label,
      accent: this.dataset.accent,
      paging: true,
      index,
      items: f.map((fr, i) => ({
        kind: 'image',
        src: fr.src,
        thumb: fr.src,
        short: fr.at || String(i + 1).padStart(2, '0'),
        label: `Extracted frame ${i + 1} of ${f.length}`,
        icon: 'frames',
      })),
    });
  }

  _openTranscript() {
    const tr = this.data.transcript;
    lightbox.open({
      title: tr.label,
      accent: this.dataset.accent,
      items: [{
        kind: 'art',
        html: '<div class="br-art-big br-art-script"><span class="br-art-wave"></span></div>',
        label: tr.label,
        meta: `${tr.sub} \u00b7 the speaker's own words`,
        captions: tr.lines.map((l, i) => ({
          t: l.t || String(i + 1).padStart(2, '0'),
          text: `\u201c${l.text}\u201d`,
        })),
      }],
    });
  }
}

customElements.define('bench-reference', BenchReference);
