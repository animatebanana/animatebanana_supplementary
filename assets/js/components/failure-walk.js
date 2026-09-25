import { loadJSON } from '../lib/data-loader.js';

/**
 * <failure-walk src="data/failure_runs.json">
 *
 * One window: pick a stage from the maroon bar and the pipeline diagram
 * unmasks that stage, leaving the rest of the pipeline faded behind it. Below
 * it sits the run that went wrong at that stage - the source diagram it was
 * given, the animation it produced, its scores, and what went wrong.
 *
 * The failure files render as live SVG rather than as clips: a failure is
 * usually visible standing still, and several of them are exactly the kind of
 * broken output that would not survive being re-rendered through a pipeline.
 */

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// playbackRate is capped at 16 by the browser, so that is the top of the list
const SPEEDS = [0.5, 1, 2, 4, 8, 16];

const METRIC_NAME = {
  VF: 'Visual Fidelity', ASC: 'Animation Style Compliance', SS: 'Selection Sensibility',
  GP: 'Granularity & Pacing', NA: 'Narration Alignment', AN: 'Animated Narrative Score',
};

class FailureWalk extends HTMLElement {
  async connectedCallback() {
    const src = this.getAttribute('src') || 'data/failure_runs.json';
    try { this.data = await loadJSON(src); }
    catch { this.innerHTML = `<p class="fw-empty">Could not load ${esc(src)}.</p>`; return; }

    this.stages = this.data.stages || [];
    if (!this.stages.length) { this.innerHTML = '<p class="fw-empty">No stages yet.</p>'; return; }
    this.gi = Math.max(0, this.stages.findIndex(s => s.samples.length));
    this.si = 0;

    this.innerHTML = `
      <div class="fw fw-window">
        <div class="fw-bar">
          <div class="fw-picks">
            <label><span>1 · Stage</span>
              <select data-stage>${this.stages.map((s, i) =>
                `<option value="${i}">${esc(s.name)}</option>`).join('')}</select></label>
            <label><span>2 · Failure case</span><select data-sample></select></label>
          </div>
        </div>
        <div class="fw-body" data-body></div>
        <div class="fw-lightbox" data-lightbox hidden>
          <button class="fw-lbclose" data-lbclose type="button" aria-label="Close">×</button>
          <div class="fw-lbstage" data-lbstage></div>
        </div>
      </div>`;

    this.addEventListener('change', (e) => {
      if (e.target.matches('[data-stage]')) { this.gi = +e.target.value; this.si = 0; this.render(); }
      else if (e.target.matches('[data-sample]')) { this.si = +e.target.value; this.render(); }
      else if (e.target.matches('[data-speed]')) this.setSpeed(+e.target.value);
      else if (e.target.matches('[data-seek]')) this.seek(+e.target.value);
    });
    this.addEventListener('input', (e) => {
      if (e.target.matches('[data-seek]')) this.seek(+e.target.value);
    });
    this.addEventListener('click', (e) => {
      if (e.target.closest('[data-lbclose]') || e.target.matches('[data-lightbox]')) {
        this.closeZoom(); return;
      }
      if (e.target.closest('[data-play]')) { this.togglePlay(); return; }
      const z = e.target.closest('[data-zoomable]');
      if (z) this.openZoom(z.dataset.zoomable);
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.closeZoom(); });

    await this.render();
  }

  get stage() { return this.stages[this.gi]; }
  get sample() { return this.stage.samples[this.si] || null; }

  async render() {
    const g = this.stage, s = this.sample;
    const picker = this.querySelector('[data-sample]');
    picker.innerHTML = g.samples.length
      ? g.samples.map((x, i) => `<option value="${i}">${esc(x.id)}</option>`).join('')
      : `<option>— none yet —</option>`;
    picker.disabled = !g.samples.length;
    picker.value = String(this.si);
    this.querySelector('[data-stage]').value = String(this.gi);

    this.querySelector('[data-body]').innerHTML = `
      <section class="fw-card">
        <div class="fw-shead"><span class="fw-num">1</span>
          <h4>Failure mapped to stages</h4>
          <span class="fw-sp"></span>
          <span class="fw-chip">${esc(g.critic)}</span>
        </div>
        <div class="fw-pipewrap" data-pipe><p class="fw-loading">loading the pipeline diagram…</p></div>
      </section>

      ${s ? `
      <section class="fw-card">
        <div class="fw-shead"><span class="fw-num">2</span><h4>Visual examples</h4>
          <span class="fw-sp"></span>
          <span class="fw-meta">${esc(s.id)}${s.style ? ` · ${esc(s.style)}` : ''}</span>
        </div>
        <div class="fw-pair">
          <figure class="fw-panel is-source">
            <figcaption><b>Source diagram</b></figcaption>
            <div class="fw-frame" ${s.source ? `data-zoomable="${esc(s.source)}"` : ''}>
              ${s.source ? `<img src="${esc(s.source)}" alt="">`
                         : `<span class="fw-ph">no source image for this sample</span>`}
            </div>
          </figure>
          <figure class="fw-panel is-out">
            <figcaption><b>AnimateBanana output</b></figcaption>
            <div class="fw-frame is-video" data-media></div>
            <div class="fw-transport" data-transport hidden>
              <button class="fw-pp" data-play type="button" aria-label="Play or pause">
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 3.2 12.6 8l-8.1 4.8z"/></svg>
              </button>
              <input class="fw-seek" type="range" min="0" max="1000" value="0" data-seek aria-label="Scrub">
              <select data-speed aria-label="Speed">
                ${SPEEDS.map(x => `<option value="${x}"${x === 1 ? ' selected' : ''}>${x}×</option>`).join('')}
              </select>
            </div>
            <p class="fw-cap" data-cap></p>
          </figure>
        </div>
      </section>

      <section class="fw-card fw-note ${s.note ? '' : 'is-empty'}">
        <div class="fw-warn" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M12 3 2 20h20L12 3z"/><path d="M12 9v5M12 17h.01"/></svg>
        </div>
        <div>
          <div class="fw-kicker">Failure observation</div>
          ${s.note ? `<p>${esc(s.note)}</p>`
                   : `<p class="fw-todo">Nothing written for this one yet — add it on the
                       <code>${esc(g.key)} › ${esc(s.id)}</code> row of
                       <code>data/failure_notes.csv</code>.</p>`}
        </div>
      </section>` : `
      <section class="fw-card">
        <p class="fw-todo">No failure examples in <code>FAILURES_PAGE/${esc(g.key === 'stage1' ? 'Stage_1' : g.key === 'stage2' ? 'Stage_2' : 'Stage_3')}/</code> yet.
           Drop the animation files in and rerun <code>scripts/build_failures.py</code>.</p>
      </section>`}`;

    await this.mountPipeline();
    if (s) this.mountFailure();
  }

  /* ───────────── the pipeline, masked down to one stage ───────────── */

  async mountPipeline() {
    const host = this.querySelector('[data-pipe]');
    if (!host || !this.data.pipeline) return;
    if (!this._pipe) {
      try {
        const res = await fetch(this.data.pipeline, { cache: 'no-cache' });
        this._pipe = await res.text();
      } catch {
        host.innerHTML = `<p class="fw-ph">could not load the pipeline diagram</p>`;
        return;
      }
    }
    host.innerHTML = this._pipe;
    const svg = host.querySelector('svg');
    if (!svg) return;
    svg.removeAttribute('width'); svg.removeAttribute('height');
    svg.setAttribute('class', 'fw-pipe');
    this.maskTo(svg, this.stage.num);
  }

  /**
   * Alpha masking: everything fades back except the stage in question, which
   * keeps full opacity. The diagram names its parts by stage - `node_s2_…`,
   * `edge_s2_…`, `text_s2_…`, `text_io_s2_…` and `block_stage2` - and the
   * blocks are siblings rather than containers, so the labels have to be
   * matched too. Leaving them dimmed under a lit block was what made the
   * unmasked stage look half-drawn.
   */
  maskTo(svg, num) {
    // the block, its nodes, its edges and its labels - but not the inputs and
    // outputs sitting around it (`node_s2_in_d`, `text_io_s2_…`), which belong
    // to the pipeline between the stages rather than to the stage itself
    const mine = new RegExp(`^(node|edge|text)_s${num}_|^block_stage${num}$`);
    const io = new RegExp(`^node_s${num}_(in|out)_`);
    for (const el of svg.querySelectorAll('[data-id]')) {
      const id = el.getAttribute('data-id');
      if (id === 'canvas_bg') continue;
      const on = mine.test(id) && !io.test(id);
      el.classList.toggle('fw-lit', on);
      el.classList.toggle('fw-dim', !on);
    }
  }

  /* ───────────── the failing output ───────────── */

  /**
   * The failure files point at their crops as `../../rasters/<sample>/…` while
   * the crops sit in a `rasters/` folder beside the file, and an SVG loaded
   * through <img> may not fetch external images at all - so the markup is
   * fetched, the crops repointed absolutely, and the result handed to an
   * <object> as a blob.
   */
  async mountFailure() {
    const host = this.querySelector('[data-media]');
    const s = this.sample;
    if (!host || !s) return;
    if (s.media.kind === 'video') { this.mountClip(host, s); return; }
    this.querySelector('[data-transport]').hidden = true;
    const abs = new URL(s.media.src, document.baseURI);
    let markup;
    try {
      markup = await (await fetch(abs, { cache: 'no-cache' })).text();
    } catch {
      host.innerHTML = `<span class="fw-ph">could not load this animation</span>`;
      return;
    }
    const dir = abs.href.slice(0, abs.href.lastIndexOf('/') + 1);
    markup = markup.replace(/((?:xlink:)?href=")((?:\.\.\/)*)rasters\//g,
                            (_m, attr) => `${attr}${dir}rasters/`);
    // a bare & in a CSS comment makes the file invalid XML, which a browser
    // refuses outright; escaping it costs nothing and renders them all
    markup = markup.replace(/&(?!#?\w+;)/g, '&amp;');
    const type = /^\s*(<\?xml|<svg)/i.test(markup) ? 'image/svg+xml' : 'text/html';
    const url = URL.createObjectURL(new Blob([markup], { type }));
    (this._blobs = this._blobs || []).forEach(URL.revokeObjectURL);
    this._blobs = [url];
    host.innerHTML = `<object type="image/svg+xml" data="${url}"></object>`;
    host.setAttribute('data-zoomable', url);
  }

  /**
   * A clip built from the animation, played through the panel's own transport
   * with its narration in the pane below rather than burned into the picture.
   * The timeline beside the clip says which line belongs to which moment.
   */
  async mountClip(host, s) {
    host.innerHTML = `<video src="${esc(s.media.src)}" muted loop playsinline preload="metadata"></video>`;
    host.setAttribute('data-zoomable', s.media.src);
    const el = host.querySelector('video');
    this.clip = { el, caps: [], last: -1 };
    this.querySelector('[data-transport]').hidden = false;
    const cap = this.querySelector('[data-cap]');
    if (cap) { cap.textContent = ''; cap.classList.remove('is-note'); }
    el.playbackRate = this.speed || 1;
    el.play().catch(() => {});
    this.startCaptions();
    if (!s.media.captions) {
      if (cap) {
        cap.textContent = 'no narration timeline for this one';
        cap.classList.add('is-note');
      }
      return;
    }
    try {
      const caps = await (await fetch(s.media.captions, { cache: 'force-cache' })).json();
      if (this.clip?.el === el) this.clip.caps = caps;
    } catch { /* the clip still plays; there is just nothing to mirror out */ }
  }

  startCaptions() {
    if (this.capTimer) return;
    this.capTimer = setInterval(() => {
      const c = this.clip;
      if (document.hidden || !c || !c.el.isConnected) return;
      const t = c.el.currentTime || 0;
      const out = this.querySelector('[data-cap]');
      if (out && c.caps.length) {
        let i = 0;
        while (i + 1 < c.caps.length && c.caps[i + 1].t <= t + 0.01) i += 1;
        if (i !== c.last) { c.last = i; out.textContent = c.caps[i].text || ''; }
      }
      const bar = this.querySelector('[data-seek]');
      if (bar && c.el.duration && Date.now() - (this._seeking || 0) > 700) {
        bar.value = String(Math.round(t / c.el.duration * 1000));
      }
    }, 120);
  }

  togglePlay() {
    const c = this.clip;
    if (!c) return;
    const paused = c.el.paused;
    if (paused) c.el.play().catch(() => {}); else c.el.pause();
    this.querySelector('[data-play]')?.classList.toggle('is-paused', !paused);
  }

  seek(per1000) {
    this._seeking = Date.now();
    const c = this.clip;
    if (c?.el.duration) c.el.currentTime = (per1000 / 1000) * c.el.duration;
  }

  setSpeed(rate) {
    this.speed = rate;
    if (this.clip) this.clip.el.playbackRate = rate;
  }

  /* ───────────── zoom ───────────── */

  openZoom(src) {
    const lb = this.querySelector('[data-lightbox]');
    const stage = this.querySelector('[data-lbstage]');
    if (!lb || !stage || !src) return;
    stage.innerHTML = /\.mp4/.test(src)
      ? `<video src="${esc(src)}" controls autoplay loop muted playsinline></video>`
      : /^blob:/.test(src) || /\.svg/.test(src)
        ? `<object type="image/svg+xml" data="${esc(src)}"></object>`
        : `<img src="${esc(src)}" alt="">`;
    lb.hidden = false;
    document.body.classList.add('fw-noscroll');
  }

  closeZoom() {
    const lb = this.querySelector('[data-lightbox]');
    if (!lb || lb.hidden) return;
    lb.hidden = true;
    this.querySelector('[data-lbstage]').innerHTML = '';
    document.body.classList.remove('fw-noscroll');
  }

  disconnectedCallback() {
    (this._blobs || []).forEach(URL.revokeObjectURL);
    if (this.capTimer) clearInterval(this.capTimer);
  }
}

customElements.define('failure-walk', FailureWalk);


/**
 * <failure-evidence src="data/failure_runs.json">
 *
 * The claim the page is making, with the numbers behind it. Removing a critic
 * costs progressively less the later in the pipeline it sits - but the cost is
 * not graded quality. Among the runs that produced anything at all, the mean AN
 * hardly moves; what changes is how often a run collapses to nothing. So both
 * columns are shown, because reporting only the overall mean would credit the
 * critics with something the data does not say.
 */
class FailureEvidence extends HTMLElement {
  async connectedCallback() {
    const src = this.getAttribute('src') || 'data/failure_runs.json';
    let data;
    try { data = await loadJSON(src); }
    catch { this.innerHTML = `<p class="fw-empty">Could not load ${esc(src)}.</p>`; return; }

    const insight = (data.critic_insight || '').trim();
    const table = data.critic_table;
    this.innerHTML = `
      <div class="fw-evidence">
        <section class="fw-obs ${insight ? '' : 'is-empty'}">
          <div class="fw-bulb" aria-hidden="true">
            <span class="fw-rays"></span>
            <svg viewBox="0 0 24 24"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5.9 1.2.9 1.9v.2h5.2v-.2c0-.7.3-1.4.9-1.9A6 6 0 0 0 12 3z"/></svg>
          </div>
          <div>
            <div class="fw-kicker">Insight</div>
            <p>${esc(insight)}</p>
          </div>
        </section>

        ${table ? this.tableMarkup(table) : ''}

      </div>`;
    this.mountRuns(table);
  }

  /**
   * One sample, the full system and each critic removed in turn, side by side.
   * Every column plays its own clip with its narration underneath and closes
   * with the (VF, ASC, AN) tuple - the two gates and the score they gate - so a
   * band falling or a score dropping is visible without reading the numbers.
   */
  tableMarkup(t) {
    const base = t.runs.find(r => r.key === 'full')?.scores || {};
    const cols = t.runs.map((r, i) => {
      const tup = ['VF', 'ASC', 'AN'].map(m => {
        const v = r.scores[m];
        return { m, text: v ? v.text : '\u2014', worse: this.worse(base[m], v) };
      });
      return `<div class="fw-col is-${esc(r.key)} ${r.key === 'full' ? 'is-base' : ''}">
        <div class="fw-colhead">${esc(r.label)}</div>
        <div class="fw-colframe" data-run="${i}">${r.media ? ''
          : `<span class="fw-ph">no animation for this run</span>`}</div>
        <div class="fw-coltransport" data-runbar="${i}"${r.media ? '' : ' hidden'}>
          <button class="fw-pp is-sm" data-runplay="${i}" type="button" aria-label="Play or pause">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 3.2 12.6 8l-8.1 4.8z"/></svg>
          </button>
          <input class="fw-seek" type="range" min="0" max="1000" value="0"
                 data-runseek="${i}" aria-label="Scrub">
          <select data-runspeed="${i}" aria-label="Speed">
            ${SPEEDS.map(x => `<option value="${x}"${x === 1 ? ' selected' : ''}>${x}×</option>`).join('')}
          </select>
        </div>
        <p class="fw-cap fw-colcap" data-runcap="${i}"></p>
        <div class="fw-tuple">
          <span class="fw-paren">(</span>${tup.map(x =>
            `<span class="fw-tup ${x.worse ? 'is-worse' : ''}" title="${esc(x.m)}">${esc(x.text)}</span>`
          ).join('<span class="fw-comma">,</span>')}<span class="fw-paren">)</span>
        </div>
      </div>`;
    }).join('');
    return `<div class="fw-runs">
      <div class="fw-runhead"><b>${esc(t.sample)}</b> \u2014 the same diagram through every run,
        with <span class="fw-tuplabel">(VF, ASC, AN)</span> underneath</div>
      <div class="fw-runrow">
        <div class="fw-col is-src">
          <div class="fw-colhead">Original diagram</div>
          <div class="fw-colframe">${t.source
            ? `<img src="${esc(t.source)}" alt="">`
            : `<span class="fw-ph">no source image</span>`}</div>
          <div class="fw-tuple"><span class="fw-tuplabel">(VF, ASC, AN)</span></div>
        </div>
        ${cols}
      </div>
    </div>`;
  }

  /** did this run do worse than the full system on this metric? */
  worse(base, v) {
    if (!base || !v) return false;
    if (v.kind === 'na') return true;
    if (base.kind === 'band' && v.kind === 'band') {
      const R = { A: 4, B: 3, C: 2, D: 1 };
      return R[v.band] < R[base.band];
    }
    if (base.kind === 'num' && v.kind === 'num') return v.value < base.value - 1e-4;
    return false;
  }

  /** every column plays its clip, captioned from its own timeline */
  mountRuns(t) {
    if (!t) return;
    this.clips = [];
    this.bindTransport();
    t.runs.forEach((r, i) => {
      const host = this.querySelector(`[data-run="${i}"]`);
      if (!host || !r.media) return;
      if (r.media.kind !== 'video') {
        // a run that produced a static diagram has nothing to play, and no
        // narration of its own to caption it with
        this.blobInto(host, r.media.src);
        const bar = this.querySelector(`[data-runbar="${i}"]`);
        if (bar) bar.hidden = true;
        const out = this.querySelector(`[data-runcap="${i}"]`);
        if (out) {
          out.textContent = r.media.kind === 'still'
            ? 'this run produced a static diagram - no animation, so no narration'
            : 'animation not rendered yet';
          out.classList.add('is-note');
        }
        return;
      }
      host.innerHTML = `<video src="${esc(r.media.src)}" muted loop autoplay playsinline preload="metadata"></video>`;
      const el = host.querySelector('video');
      const clip = { el, index: i, caps: [], last: -1,
                     out: this.querySelector(`[data-runcap="${i}"]`),
                     bar: this.querySelector(`[data-runseek="${i}"]`) };
      this.clips.push(clip);
      el.play().catch(() => {});
      if (!r.media.captions) {
        if (clip.out) {
          clip.out.textContent = 'no narration timeline';
          clip.out.classList.add('is-note');
        }
        return;
      }
      fetch(r.media.captions, { cache: 'force-cache' }).then(res => res.json())
        .then(caps => { clip.caps = caps; }).catch(() => {});
    });
    if (this.clips.length && !this.timer) {
      this.timer = setInterval(() => {
        if (document.hidden) return;
        for (const c of this.clips) {
          if (!c.el.isConnected) continue;
          const now = c.el.currentTime || 0;
          if (c.caps.length) {
            let i = 0;
            while (i + 1 < c.caps.length && c.caps[i + 1].t <= now + 0.01) i += 1;
            if (i !== c.last && c.out) { c.last = i; c.out.textContent = c.caps[i].text || ''; }
          }
          if (c.bar && c.el.duration && Date.now() - (this._seeking || 0) > 700) {
            c.bar.value = String(Math.round(now / c.el.duration * 1000));
          }
        }
      }, 140);
    }
  }

  /**
   * One transport per column rather than one for the row: the clips are
   * different lengths, so a shared scrubber would mean different moments in
   * each. Bound once, on the host, so re-rendering the row costs nothing.
   */
  bindTransport() {
    if (this._bound) return;
    this._bound = true;
    const clipAt = (el, attr) => {
      const i = el.getAttribute(attr);
      return i === null ? null : this.clips.find(c => c.index === +i);
    };
    this.addEventListener('click', (e) => {
      const b = e.target.closest('[data-runplay]');
      if (!b) return;
      const c = clipAt(b, 'data-runplay');
      if (!c) return;
      const paused = c.el.paused;
      if (paused) c.el.play().catch(() => {}); else c.el.pause();
      b.classList.toggle('is-paused', !paused);
    });
    const scrub = (e) => {
      const r = e.target.closest('[data-runseek]');
      if (!r) return;
      const c = clipAt(r, 'data-runseek');
      if (!c || !c.el.duration) return;
      this._seeking = Date.now();
      c.el.currentTime = (+r.value / 1000) * c.el.duration;
    };
    this.addEventListener('input', scrub);
    this.addEventListener('change', (e) => {
      scrub(e);
      const sel = e.target.closest('[data-runspeed]');
      if (!sel) return;
      const c = clipAt(sel, 'data-runspeed');
      if (c) c.el.playbackRate = +sel.value;
    });
  }

  /** render an SVG through a blob so its raster crops resolve and load */
  async blobInto(host, src) {
    const abs = new URL(src, document.baseURI);
    let markup;
    try {
      markup = await (await fetch(abs, { cache: 'no-cache' })).text();
    } catch {
      host.innerHTML = `<span class="fw-ph">could not load this diagram</span>`;
      return;
    }
    const dir = abs.href.slice(0, abs.href.lastIndexOf('/') + 1);
    markup = markup.replace(/((?:xlink:)?href=")((?:\.\.\/)*)rasters\//g,
                            (_m, attr) => `${attr}${dir}rasters/`)
                   .replace(/&(?!#?\w+;)/g, '&amp;');
    const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }));
    (this._blobs = this._blobs || []).push(url);
    host.innerHTML = `<object type="image/svg+xml" data="${url}"></object>`;
    host.setAttribute('data-zoomable', url);
  }

  disconnectedCallback() {
    if (this.timer) clearInterval(this.timer);
    (this._blobs || []).forEach(URL.revokeObjectURL);
  }
}

customElements.define('failure-evidence', FailureEvidence);
