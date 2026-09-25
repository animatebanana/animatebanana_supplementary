import { loadJSON } from '../lib/data-loader.js';

/**
 * <ablation-walk src="data/ablation_runs.json" insights="data/ablation_insights.json">
 *
 * One ablation on one sample. The pipeline diagram loops on its own, striking
 * out the part this experiment removed; below it the full system and the
 * ablated run sit side by side, each panel carrying its own diagram/animation
 * switch, its own transport, and its own caption.
 *
 * The animation SVGs burn their narration into a banner inside the picture.
 * That banner is hidden and the live caption mirrored out beneath the panel it
 * belongs to, so the figure keeps its height and the text stays legible.
 */

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const METRIC_NAME = {
  VF: 'Visual Fidelity', ASC: 'Animation Style Compliance', SS: 'Selection Sensibility',
  GP: 'Granularity & Pacing', NA: 'Narration Alignment', AN: 'Animated Narrative Score',
};
const METRIC_GROUP = { VF: 'gate', ASC: 'gate', SS: 'quality', GP: 'quality', NA: 'quality', AN: 'final' };
const BAND_RANK = { A: 4, B: 3, C: 2, D: 1 };
const SPEEDS = [0.5, 1, 2, 4];

class AblationWalk extends HTMLElement {
  async connectedCallback() {
    const src = this.getAttribute('src') || 'data/ablation_runs.json';
    try { this.data = await loadJSON(src); }
    catch { this.innerHTML = `<p class="abl-empty">Could not load ${esc(src)}.</p>`; return; }
    try { this.insights = await loadJSON(this.getAttribute('insights') || 'data/ablation_insights.json'); }
    catch { this.insights = {}; }

    const runnable = (this.data.experiments || []).filter(e => e.samples.length);
    if (!runnable.length) { this.innerHTML = '<p class="abl-empty">No ablations with paired samples yet.</p>'; return; }
    this.experiments = runnable;
    this.ei = Math.max(0, runnable.findIndex(e => e.d2c));
    this.si = 0;
    this.view = 'diagram';
    this.speed = { full: 1, ablated: 1 };

    this.innerHTML = `
      <div class="abl abl-window">
        <div class="abl-bar">
          <div class="abl-picks">
            <label><span>1 · Ablation</span>
              <select data-exp>${this.experiments.map((e, i) =>
                `<option value="${i}">${esc(e.name)}</option>`).join('')}</select></label>
            <label><span>2 · Sample</span><select data-sample></select></label>
          </div>
        </div>
        <div class="abl-body" data-body></div>
        <div class="abl-lightbox" data-lightbox hidden>
          <button class="abl-lbclose" data-lbclose type="button" aria-label="Close">×</button>
          <div class="abl-lbstage" data-lbstage></div>
        </div>
      </div>`;

    this.addEventListener('change', (e) => {
      if (e.target.matches('[data-exp]')) { this.ei = +e.target.value; this.si = 0; this.render(); }
      else if (e.target.matches('[data-sample]')) { this.si = +e.target.value; this.render(); }
      else if (e.target.matches('[data-speed]')) this.setSpeed(e.target.dataset.speed, +e.target.value);
      else if (e.target.matches('[data-seek]')) this.seek(e.target.dataset.seek, +e.target.value);
    });
    this.addEventListener('input', (e) => {
      if (e.target.matches('[data-seek]')) this.seek(e.target.dataset.seek, +e.target.value);
    });
    this.addEventListener('click', (e) => {
      const v = e.target.closest('[data-view]');
      if (v) { this.view = v.dataset.view; this.mountMedia(); return; }
      const pp = e.target.closest('[data-play]');
      if (pp) { this.togglePlay(pp.dataset.play); return; }
      if (e.target.closest('[data-lbclose]') || e.target.matches('[data-lightbox]')) { this.closeZoom(); return; }
      const z = e.target.closest('[data-zoomable]');
      if (z) this.openZoom(z.dataset.zoomable, z.dataset.zoomkind);
    });
    this._esc = (e) => { if (e.key === 'Escape') this.closeZoom(); };
    document.addEventListener('keydown', this._esc);

    this.pipelineMarkup = null;
    await this.render();
  }

  get exp() { return this.experiments[this.ei]; }
  get sample() { return this.exp.samples[this.si]; }

  insightFor(exp, sid) {
    const slot = (this.insights || {})[exp.key] || {};
    return ((slot[sid] || '').trim() || (slot._overall || '').trim());
  }

  /* ───────────── render ───────────── */

  async render() {
    this.stopCaptions();
    const e = this.exp, s = this.sample;
    this.querySelector('[data-exp]').value = String(this.ei);
    this.querySelector('[data-sample]').innerHTML = e.samples.map((x, i) =>
      `<option value="${i}"${i === this.si ? ' selected' : ''}>${esc(x.id)}</option>`).join('');
    this.view = (e.d2c && s.d2c) ? 'diagram' : 'animation';
    const insight = this.insightFor(e, s.id);

    this.querySelector('[data-body]').innerHTML = `
      <section class="abl-card abl-what">
        <div class="abl-kicker">The ablation</div>
        <h3>${esc(e.name)}</h3>
        <p class="abl-removed"><span class="abl-cut">removed</span>${esc(e.removed)}</p>
      </section>

      <section class="abl-card abl-pipe">
        <div class="abl-shead"><span class="abl-num">1</span>
          <h4>What is removed from the pipeline and from where?</h4></div>
        <div class="abl-pipewrap" data-pipe><p class="abl-loading">loading the pipeline diagram…</p></div>
      </section>

      <section class="abl-card abl-compare">
        <div class="abl-shead"><span class="abl-num">2</span><h4>Visual examples</h4>
          <span class="abl-sp"></span>
          ${e.d2c && s.d2c ? `<span class="abl-toggle" role="group" aria-label="View">
            <button data-view="diagram">Diagram</button>
            <button data-view="animation">Animation</button>
          </span>` : ''}
          <span class="abl-meta">${esc(s.id)}${s.style ? ` · ${esc(s.style)}` : ''}</span>
        </div>
        <div class="abl-trio">
          <figure class="abl-panel is-source">
            <figcaption><b>Source diagram</b></figcaption>
            <div class="abl-frame" ${s.source ? `data-zoomable="${esc(s.source)}" data-zoomkind="img"` : ''}>
              ${s.source ? `<img src="${esc(s.source)}" alt="">` : `<span class="abl-ph">no source image</span>`}
            </div>
          </figure>
          ${this.panelMarkup('full', 'AnimateBanana (Full system)', e, s)}
          ${this.panelMarkup('ablated', e.panel || 'Ablated', e, s)}
        </div>
      </section>

      ${this.scoresMarkup(e, s)}

      <section class="abl-card abl-insight ${insight ? '' : 'is-empty'}">
        <div class="abl-bulb" aria-hidden="true">
          <span class="abl-rays"></span>
          <svg viewBox="0 0 24 24"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5.9 1.2.9 1.9v.2h5.2v-.2c0-.7.3-1.4.9-1.9A6 6 0 0 0 12 3z"/></svg>
        </div>
        <div>
          <div class="abl-kicker">Insight</div>
          ${insight ? `<p>${esc(insight)}</p>`
                    : `<p class="abl-todo">Nothing written for this sample yet — add it on the
                        <code>${esc(e.key)} › ${esc(s.id)}</code> row of
                        <code>data/ablation_insights.csv</code>.</p>`}
        </div>
      </section>`;

    await this.mountPipeline();
    this.mountMedia();
  }

  /** one output panel: its own switch, its own transport, its own caption */
  panelMarkup(side, label, e, s) {
    return `
      <figure class="abl-panel is-${side}">
        <figcaption><b>${esc(label)}</b></figcaption>
        <div class="abl-frame" data-media="${side}"></div>
        <div class="abl-transport" data-transport="${side}" hidden>
          <button class="abl-pp" data-play="${side}" type="button" aria-label="Play or pause">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 3.2 12.6 8l-8.1 4.8z"/></svg>
          </button>
          <input class="abl-seek" type="range" min="0" max="1000" value="0"
                 data-seek="${side}" aria-label="Scrub">
          <select data-speed="${side}" aria-label="Speed">
            ${SPEEDS.map(x => `<option value="${x}"${x === 1 ? ' selected' : ''}>${x}×</option>`).join('')}
          </select>
        </div>
        <p class="abl-cap" data-cap="${side}"></p>
      </figure>`;
  }

  /* ───────────── scores, in the cost-card style ───────────── */

  scoresMarkup(e, s) {
    const rows = e.metrics.map(m => {
      const full = s.scores[m]?.full, abl = s.scores[m]?.ablated;
      const d = this.deltaOf(full, abl);
      const gated = full?.kind === 'band' || abl?.kind === 'band';
      // whichever side scores higher reads green and whichever scores lower reads
      // red: an ablation is not always a loss, and the full system is not always
      // the winner, so neither side gets a fixed colour
      const win = d.dir === 'up' ? ['lose', 'win']
                : d.dir === 'down' ? ['win', 'lose'] : ['tie', 'tie'];
      return `<div class="abl-mrow is-${METRIC_GROUP[m] || 'quality'} is-${d.dir}">
        <div class="abl-mname">
          <b>${m}</b><i>${METRIC_NAME[m] || m}</i>
          <em class="is-${d.dir}">${d.label}</em>
        </div>
        <div class="abl-mcell is-full is-${win[0]}">${this.scoreCell(m, full, abl, 'full', gated)}</div>
        <div class="abl-mcell is-ablated is-${win[1]}">${this.scoreCell(m, abl, full, 'ablated', gated)}</div>
      </div>`;
    }).join('');
    return `
      <section class="abl-card abl-scores">
        <div class="abl-shead"><span class="abl-num">3</span>
          <h4>Effect on relevant metrics</h4></div>
        <div class="abl-mrows">${rows}</div>
      </section>`;
  }

  /** a gated metric reads as milestones; a continuous one as a slider */
  scoreCell(metric, mine, other, side, gated) {
    if (!mine) return `<span class="abl-nodata">no row</span>`;
    if (gated) {
      const band = mine.kind === 'band' ? mine.band : null;
      const otherBand = other?.kind === 'band' ? other.band : null;
      return this.bandTrack(
        side === 'full' ? mine : other,
        side === 'full' ? other : mine,
        band, otherBand, side) + `<span class="abl-mval">${esc(mine.text)}</span>`;
    }
    if (mine.kind !== 'num') return `<span class="abl-mval is-na">${esc(mine.text)}</span>`;
    const pct = Math.max(0, Math.min(100, mine.value * 100));
    return `<div class="abl-slider">
        <i style="width:${pct.toFixed(1)}%"></i>
        <span class="abl-knob" style="left:${pct.toFixed(1)}%"></span>
      </div>
      <span class="abl-mval">${esc(mine.text)}</span>`;
  }

  /** A gated metric is ordinal, not continuous: D–C–B–A as milestones, with the
   *  drop drawn between where the full system landed and where the ablation did. */
  bandTrack(full, abl, mineBand, otherBand, side) {
    const order = ['D', 'C', 'B', 'A'];
    const pos = (b) => (order.indexOf(b) / (order.length - 1)) * 92 + 4;
    return `<div class="abl-track is-${side}">${order.map(b => {
      const on = b === mineBand;
      return `<span class="abl-tick ${on ? 'is-on' : ''}" style="left:${pos(b)}%">
        <i></i><span>${b}</span></span>`;
    }).join('')}</div>`;
  }

  /** how far it moved, as a signed label plus a 0–100 bar length */
  deltaOf(full, abl) {
    if (!full || !abl) return { dir: 'flat', label: '', pct: 0 };
    if (full.kind === 'band' && abl.kind === 'band') {
      const d = BAND_RANK[abl.band] - BAND_RANK[full.band];
      if (!d) return { dir: 'flat', label: 'unchanged', pct: 0 };
      return { dir: d < 0 ? 'down' : 'up', pct: Math.min(100, Math.abs(d) / 3 * 100),
               label: `${d < 0 ? '↓' : '↑'} ${Math.abs(d)} band${Math.abs(d) > 1 ? 's' : ''}` };
    }
    if (full.kind === 'num' && abl.kind === 'num') {
      const d = abl.value - full.value;
      if (Math.abs(d) < 1e-4) return { dir: 'flat', label: 'unchanged', pct: 0 };
      return { dir: d < 0 ? 'down' : 'up', pct: Math.min(100, Math.abs(d) / 0.3 * 100),
               label: `${d < 0 ? '−' : '+'}${Math.abs(d).toFixed(4)}` };
    }
    if (abl.kind === 'na') return { dir: 'down', label: 'not scored', pct: 100 };
    return { dir: 'flat', label: '', pct: 0 };
  }

  /* ───────────── pipeline, looping on its own ───────────── */

  async mountPipeline() {
    const host = this.querySelector('[data-pipe]');
    if (!host) return;
    const path = this.data.pipeline;
    if (!path) { host.innerHTML = '<p class="abl-ph">no pipeline diagram was emitted</p>'; return; }
    if (!this.pipelineMarkup) {
      try {
        const res = await fetch(path, { cache: 'no-cache' });
        this.pipelineMarkup = (await res.text()).replace(/<\?xml[^>]*\?>/, '');
      } catch { host.innerHTML = '<p class="abl-ph">could not load the pipeline diagram</p>'; return; }
    }
    host.innerHTML = this.pipelineMarkup;
    const svg = host.querySelector('svg');
    if (!svg) return;
    svg.removeAttribute('width'); svg.removeAttribute('height');
    svg.classList.add('abl-pipesvg');

    const ns = 'http://www.w3.org/2000/svg';
    for (const id of this.exp.cross || []) {
      const node = svg.querySelector(`#${CSS.escape(id)}`);
      if (!node) continue;
      let b; try { b = node.getBBox(); } catch { continue; }
      if (!b.width || !b.height) continue;
      const pad = Math.max(6, Math.min(b.width, b.height) * 0.12);
      const x1 = b.x - pad, y1 = b.y - pad, x2 = b.x + b.width + pad, y2 = b.y + b.height + pad;

      const g = document.createElementNS(ns, 'g');
      g.setAttribute('class', 'abl-crossg');
      const box = document.createElementNS(ns, 'rect');
      box.setAttribute('x', x1); box.setAttribute('y', y1);
      box.setAttribute('width', x2 - x1); box.setAttribute('height', y2 - y1);
      box.setAttribute('rx', 8); box.setAttribute('class', 'abl-crossbox');
      g.appendChild(box);
      for (const [ax, ay, bx, by] of [[x1, y1, x2, y2], [x2, y1, x1, y2]]) {
        const l = document.createElementNS(ns, 'line');
        l.setAttribute('x1', ax); l.setAttribute('y1', ay);
        l.setAttribute('x2', bx); l.setAttribute('y2', by);
        l.setAttribute('class', 'abl-crossline');
        l.style.setProperty('--len', Math.hypot(bx - ax, by - ay));
        g.appendChild(l);
      }
      svg.appendChild(g);
      node.classList.add('abl-cutnode');
    }
  }

  /* ───────────── the two outputs ───────────── */

  mountMedia() {
    const e = this.exp, s = this.sample;
    this.stopCaptions();
    for (const side of ['full', 'ablated']) {
      const host = this.querySelector(`[data-media="${side}"]`);
      const cap = this.querySelector(`[data-cap="${side}"]`);
      const transport = this.querySelector(`[data-transport="${side}"]`);
      if (!host) continue;


      this.querySelectorAll('[data-view]').forEach(b =>
        b.classList.toggle('is-on', b.dataset.view === this.view));
      const showDiagram = e.d2c && s.d2c && this.view === 'diagram';
      if (showDiagram) {
        if (transport) transport.hidden = true;
        if (cap) cap.textContent = 'animation-aware diagram code, rendered · click to zoom';
        this.mountDiagram(host, s.d2c[side]);
        continue;
      }

      const media = s.animation[side];
      if (media.kind === 'video') {
        host.innerHTML = `<video src="${esc(media.src)}" muted loop playsinline preload="metadata"></video>`;
        host.setAttribute('data-zoomable', media.src);
        host.setAttribute('data-zoomkind', 'video');
        if (transport) transport.hidden = false;
        if (cap) cap.textContent = '';
        this.mountClip(host.querySelector('video'), media, side);
      } else {
        if (transport) transport.hidden = false;
        if (cap) cap.textContent = '';
        this.mountAnimation(host, media.src, side);
      }
    }
  }

  /**
   * A clip built by build_ablation_videos.py plays through the same transport as
   * a live SVG. The splitter wrote `<name>.captions.json` beside it — the same
   * narration steps with the timestamps they fire at — so the caption pane can
   * follow the video without loading (and animating) the SVG it came from.
   */
  async mountClip(el, media, side) {
    if (!el) return;
    this.vid = this.vid || {};
    this.vid[side] = { el, caps: [], last: -1 };
    this.querySelector(`[data-cap="${side}"]`)?.classList.remove('is-note');
    el.playbackRate = this.speed[side];
    el.play().catch(() => {});          // muted, so autoplay is allowed
    this.startCaptions();
    if (!media.captions) {
      // a clip the run shipped ready-made, with no SVG to read a step list from
      const cap = this.querySelector(`[data-cap="${side}"]`);
      if (cap) {
        cap.textContent = 'narration is burned into this clip — no animation SVG '
                        + 'was exported on this side to caption it from';
        cap.classList.add('is-note');
      }
      return;
    }
    try {
      const caps = await (await fetch(media.captions, { cache: 'force-cache' })).json();
      if (this.vid[side]?.el === el) this.vid[side].caps = caps;
    } catch { /* no timeline: the narration is still burned into the frames */ }
  }

  /**
   * An SVG loaded through <img> is sandboxed: the browser refuses to fetch any
   * external resource from it, so every raster crop inside one of these files
   * would be missing however its path was written. And the paths are wrong
   * anyway — authored as `../rasters/` or `../../rasters/` when the crops sit
   * in a `rasters/` folder beside the file itself. So the markup is fetched,
   * the crops repointed at absolute URLs, and the result handed to an <object>
   * as a blob: the crops load, and the file's own CSS stays out of the page.
   */
  async blobSvg(src) {
    const abs = new URL(src, document.baseURI);
    const res = await fetch(abs, { cache: 'no-cache' });
    let markup = (await res.text()).replace(
      /((?:xlink:)?href=")((?:\.\.\/)*)rasters\//g,
      (_m, attr) => `${attr}${abs.href.slice(0, abs.href.lastIndexOf('/') + 1)}rasters/`);
    // a bare & in a CSS comment makes the file invalid XML, which a browser
    // refuses outright; escaping it costs nothing and renders them all
    markup = markup.replace(/&(?!#?\w+;)/g, '&amp;');
    // some exports are SVG markup saved as .html, so trust the content
    const type = /^\s*(<\?xml|<svg)/i.test(markup) ? 'image/svg+xml' : 'text/html';
    const url = URL.createObjectURL(new Blob([markup], { type }));
    (this._blobs = this._blobs || []).push(url);
    return url;
  }

  async mountAnimation(host, src, side) {
    let url;
    try { url = await this.blobSvg(src); }
    catch { host.innerHTML = `<span class="abl-ph">could not load this animation</span>`; return; }
    host.innerHTML = `<object type="image/svg+xml" data="${url}" data-anim="${side}"></object>`;
    host.setAttribute('data-zoomable', url);
    host.setAttribute('data-zoomkind', 'svg');
    this.hookAnimation(host.querySelector('object'), side);
  }

  /** the Stage-1 diagram exports, which carry raster crops of their own */
  async mountDiagram(host, src) {
    let url;
    try { url = await this.blobSvg(src); }
    catch { host.innerHTML = `<span class="abl-ph">could not load this diagram</span>`; return; }
    host.innerHTML = `<object type="image/svg+xml" data="${url}"></object>`;
    host.setAttribute('data-zoomable', url);
    host.setAttribute('data-zoomkind', 'svg');
  }

  /** hide the burned-in banner, take hold of the clock, mirror the caption out */
  hookAnimation(obj, side) {
    if (!obj) return;
    obj.addEventListener('load', () => {
      const doc = obj.contentDocument;
      if (!doc) return;
      // must be namespaced: an HTML <style> appended into an SVG document is ignored
      const style = doc.createElementNS('http://www.w3.org/2000/svg', 'style');
      // visibility, not display: display:none would stop the animations we read
      style.textContent = '#narration_banner{visibility:hidden!important}';
      doc.documentElement.appendChild(style);

      // the caption class differs between runs (`narr-text` vs `narr_txt`);
      // the id pattern is the one thing both conventions share
      const nodes = [...doc.querySelectorAll('[id^="narr_ts"]')].sort((a, b) =>
        (+(a.id.match(/\d+/) || [0])[0]) - (+(b.id.match(/\d+/) || [0])[0]));
      this.anim = this.anim || {};
      this.anim[side] = { doc, nodes, obj };
      this.setSpeed(side, this.speed[side]);
      this.startCaptions();
    }, { once: true });
  }

  animations(side) {
    const a = this.anim?.[side];
    return a?.doc?.getAnimations ? a.doc.getAnimations() : [];
  }

  setSpeed(side, rate) {
    this.speed[side] = rate;
    this.animations(side).forEach(a => { a.playbackRate = rate; });
    const clip = this.vid?.[side];
    if (clip) clip.el.playbackRate = rate;
    const sel = this.querySelector(`[data-speed="${side}"]`);
    if (sel) sel.value = String(rate);
  }

  seek(side, per1000) {
    this._seeking = Date.now();
    const clip = this.vid?.[side];
    if (clip && clip.el.duration) {
      clip.el.currentTime = (per1000 / 1000) * clip.el.duration;
      return;
    }
    const anims = this.animations(side);
    if (!anims.length) return;
    const dur = anims[0].effect?.getTiming?.().duration || 96000;
    anims.forEach(a => { a.currentTime = (per1000 / 1000) * dur; });
    this._seeking = Date.now();
  }

  togglePlay(side) {
    const clip = this.vid?.[side];
    if (clip) {
      const paused = clip.el.paused;
      if (paused) clip.el.play().catch(() => {}); else clip.el.pause();
      this.querySelector(`[data-play="${side}"]`)?.classList.toggle('is-paused', !paused);
      return;
    }
    const anims = this.animations(side);
    if (!anims.length) return;
    const paused = anims[0].playState === 'paused';
    anims.forEach(a => paused ? a.play() : a.pause());
    this.querySelector(`[data-play="${side}"]`)?.classList.toggle('is-paused', !paused);
  }

  startCaptions() {
    if (this.capTimer) return;
    this.capTimer = setInterval(() => {
      if (document.hidden) return;          // a hidden tab freezes the SVGs' own clocks
      for (const side of ['full', 'ablated']) {
        const clip = this.vid?.[side];
        if (clip && clip.el.isConnected) { this.tickClip(side, clip); continue; }
        const a = this.anim?.[side];
        if (!a) continue;
        const out = this.querySelector(`[data-cap="${side}"]`);
        if (out && a.nodes.length) {
          const live = a.nodes.find(n =>
            parseFloat(a.doc.defaultView.getComputedStyle(n).opacity || '0') > 0.5);
          const text = live ? live.textContent.trim() : '';
          if (text && out.textContent !== text) out.textContent = text;
        }
        const bar = this.querySelector(`[data-seek="${side}"]`);
        const anims = this.animations(side);
        if (bar && anims.length && Date.now() - (this._seeking || 0) > 700) {
          const t = anims[0].currentTime || 0;
          const dur = anims[0].effect?.getTiming?.().duration || 96000;
          bar.value = String(Math.round((t % dur) / dur * 1000));
        }
      }
    }, 120);
  }

  /** the clip's own currentTime picks the narration step and moves the scrubber */
  tickClip(side, clip) {
    const t = clip.el.currentTime || 0;
    const out = this.querySelector(`[data-cap="${side}"]`);
    if (out && clip.caps.length) {
      let i = 0;
      while (i + 1 < clip.caps.length && clip.caps[i + 1].t <= t + 0.01) i += 1;
      if (i !== clip.last) {
        clip.last = i;
        out.textContent = clip.caps[i].text || '';
      }
    }
    const bar = this.querySelector(`[data-seek="${side}"]`);
    const dur = clip.el.duration;
    if (bar && dur && Date.now() - (this._seeking || 0) > 700) {
      bar.value = String(Math.round(t / dur * 1000));
    }
  }

  stopCaptions() {
    if (this.capTimer) { clearInterval(this.capTimer); this.capTimer = null; }
    this.anim = {};
    this.vid = {};
    (this._blobs || []).forEach(URL.revokeObjectURL);
    this._blobs = [];
  }

  /* ───────────── zoom ───────────── */

  openZoom(src, kind) {
    const lb = this.querySelector('[data-lightbox]');
    const stage = this.querySelector('[data-lbstage]');
    if (!lb || !stage || !src) return;
    stage.innerHTML = kind === 'svg'
      ? `<object type="image/svg+xml" data="${esc(src)}"></object>`
      : kind === 'video'
        ? `<video src="${esc(src)}" controls autoplay loop muted playsinline></video>`
        : `<img src="${esc(src)}" alt="">`;
    lb.hidden = false;
    document.body.classList.add('abl-noscroll');
  }

  closeZoom() {
    const lb = this.querySelector('[data-lightbox]');
    if (!lb || lb.hidden) return;
    lb.hidden = true;
    this.querySelector('[data-lbstage]').innerHTML = '';
    document.body.classList.remove('abl-noscroll');
  }

  disconnectedCallback() {
    this.stopCaptions();
    document.removeEventListener('keydown', this._esc);
  }
}

customElements.define('ablation-walk', AblationWalk);
