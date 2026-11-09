import { loadJSON } from '../lib/data-loader.js';
import { onVisible } from '../lib/lazy-load.js';


const SEEK_PAD = 350;
const STEP_MS  = 2400;
const SPEEDS   = [0.5, 1, 1.5, 2];
const SHADOW_CSS = ':host{display:block}svg{display:block;width:100%;height:auto}';

const esc = (s) => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

function svgFrom(markup) {
  const doc = new DOMParser().parseFromString(markup, 'text/html');
  const svg = doc.querySelector('svg');
  if (!svg) return null;
  const banner = svg.querySelector('#narration_banner');
  if (banner) banner.remove();
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  return svg;
}

class Side {
  constructor(root, which, src, beats) {
    this.src = src; this.beats = beats;
    this.host   = root.querySelector('[data-stage="' + which + '"]');
    this.slate  = root.querySelector('[data-slate="' + which + '"]');
    this.bar    = root.querySelector('[data-bar="' + which + '"]');
    this.seekEl = this.bar.querySelector('.ed-seek');
    this.count  = this.bar.querySelector('[data-count]');
    this.playBtn = this.bar.querySelector('[data-act="play"]');
    this.i = 0; this.timer = null; this.rate = 1;
    this.anims = []; this.ready = false;
    this.seekEl.max = String(Math.max(0, beats.length - 1));
    this.wire();
    this.show(0);
  }
  wire() {
    this.playBtn.addEventListener('click', () => this.toggle());
    this.bar.querySelector('[data-act="prev"]').addEventListener('click', () => { this.stop(); this.show(this.i - 1); });
    this.bar.querySelector('[data-act="next"]').addEventListener('click', () => { this.stop(); this.show(this.i + 1); });
    this.bar.querySelector('[data-act="restart"]').addEventListener('click', () => { this.stop(); this.show(0); });
    this.seekEl.addEventListener('input', () => { this.stop(); this.show(+this.seekEl.value); });
    this.bar.querySelector('.ed-seg').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-rate]');
      if (!btn) return;
      this.rate = parseFloat(btn.dataset.rate);
      this.bar.querySelectorAll('.ed-seg button').forEach(b =>
        b.setAttribute('aria-pressed', String(b === btn)));
      if (this.timer) { clearInterval(this.timer); this.run(); }
    });
  }
  async load() {
    if (this.ready) return;
    let markup;
    try {
      markup = await fetch(this.src).then(r => r.text());
    } catch (e) { return this.fail('could not load the animation'); }
    const svg = svgFrom(markup);
    if (!svg) return this.fail('not an SVG');
    const vb = (svg.getAttribute('viewBox') || '0 0 4 3').split(/[\s,]+/).map(Number);
    if (vb[2] && vb[3]) this.host.style.aspectRatio = vb[2] + ' / ' + vb[3];
    this.root = this.host.shadowRoot || this.host.attachShadow({ mode: 'open' });
    this.root.innerHTML = '<style>' + SHADOW_CSS + '</style>';
    this.root.appendChild(document.importNode(svg, true));
    this.svg = this.root.querySelector('svg');
    this.freeze();
    await new Promise(r => requestAnimationFrame(r));
    this.freeze();
    this.crop(vb);
    this.ready = true;
    this.show(this.i);
  }
  fail(msg) {
    this.host.innerHTML = '<div class="ed-load">' + msg + '</div>';
  }
  freeze() {
    if (this.svg && this.svg.pauseAnimations) {
      try { this.svg.pauseAnimations(); } catch (e) {}
    }
    this.anims = [];
    this.root.querySelectorAll('*').forEach(el => {
      if (el.getAnimations) this.anims.push(...el.getAnimations());
    });
    this.anims.forEach(a => { try { a.pause(); } catch (e) {} });
  }
  crop(vb) {
    const svg = this.root.querySelector('svg');
    if (!svg || !svg.getBBox) return;
    let bb;
    try { bb = svg.getBBox(); } catch (e) { return; }
    if (!(bb.width > 1 && bb.height > 1)) return;
    const pad = Math.max(bb.width, bb.height) * 0.02;
    let x = bb.x - pad, y = bb.y - pad, w = bb.width + pad * 2, h = bb.height + pad * 2;
    if (vb[2] && vb[3]) {
      const slack = Math.max(vb[2], vb[3]) * 0.04;
      const x0 = Math.max(x, vb[0] - slack), y0 = Math.max(y, vb[1] - slack);
      w = Math.min(x + w, vb[0] + vb[2] + slack) - x0;
      h = Math.min(y + h, vb[1] + vb[3] + slack) - y0;
      x = x0; y = y0;
    }
    if (!(w > 1 && h > 1)) return;
    svg.setAttribute('viewBox', [x, y, w, h].join(' '));
    this.host.style.aspectRatio = w + ' / ' + h;
  }
  show(k) {
    const n = this.beats.length;
    this.i = Math.max(0, Math.min(n - 1, k));
    const beat = this.beats[this.i];
    if (this.ready && beat) {
      const ms = beat.t * 1000 + SEEK_PAD;
      this.anims.forEach(a => { try { a.currentTime = ms; } catch (e) {} });
      if (this.svg && this.svg.setCurrentTime) {
        try { this.svg.setCurrentTime(ms / 1000); } catch (e) {}
      }
    }
    this.slate.innerHTML = beat ? '<b>' + beat.ts + '</b>' + beat.text : '';
    this.seekEl.value = String(this.i);
    this.count.textContent = (this.i + 1) + ' / ' + n;
  }
  run() {
    this.timer = setInterval(() => {
      if (this.i >= this.beats.length - 1) return this.stop();
      this.show(this.i + 1);
    }, STEP_MS / this.rate);
  }
  stop() { clearInterval(this.timer); this.timer = null; this.playBtn.innerHTML = '&#9654;'; }
  toggle() {
    if (this.timer) return this.stop();
    if (this.i >= this.beats.length - 1) this.show(0);
    this.playBtn.innerHTML = '&#10073;&#10073;';
    this.run();
  }
}

class EditDiff extends HTMLElement {
  async connectedCallback() {
    const src = this.getAttribute('src') || 'data/editability.json';
    let data, notes = { sections: {}, examples: {} }, titles = { titles: {} };
    try {
      data = await loadJSON(src);
    } catch (e) {
      this.innerHTML = '<p class="ed-note">Could not load ' + src + '.</p>';
      return;
    }
    try {
      notes = await loadJSON(this.getAttribute('notes') || 'data/editability_notes.json');
    } catch (e) {  }
    try {
      titles = await loadJSON(this.getAttribute('titles') || 'data/editability_titles.json');
    } catch (e) {  }
    this.titles = titles.titles || {};

    const only = this.getAttribute('only');
    this.bare = !!only;
    const groups = only
      ? data.groups
          .map(g => ({ ...g, examples: g.examples.filter(ex => this.anchorFor(g, ex) === only) }))
          .filter(g => g.examples.length)
      : data.groups;
    if (only && !groups.length) {
      this.innerHTML = '<p class="ed-note">No editability example called ' + only + '.</p>';
      return;
    }

    this._count = 0;
    this.innerHTML = groups.map(g => this.group(g, notes)).join('') + this.modal();

    this.addEventListener('click', (e) => {
      const b = e.target.closest('[data-link]');
      if (b) this.copyLink(b);
    });
    this.markTarget();
    window.addEventListener('hashchange', () => this.markTarget());
    this.dlg = this.querySelector('.ed-modal');
    this.querySelector('.ed-close').addEventListener('click', () => this.dlg.close());
    groups.forEach(g => g.examples.forEach(ex => {
      if (ex.identical) return;
      this.wire(ex);
      const btn = this.querySelector('[data-xml="' + CSS.escape(ex.id) + '"]');
      if (btn) btn.addEventListener('click', () => this.openXml(ex));
    }));
  }


  anchorFor(g, ex) { return `ed-${g.key}-${ex.id}`; }

  markTarget() {
    const id = decodeURIComponent(location.hash.slice(1));
    if (!id) return;
    const el = this.querySelector(`[id="${CSS.escape(id)}"]`);
    if (!el) return;
    this.querySelectorAll('.is-linked').forEach(x => x.classList.remove('is-linked'));
    el.classList.add('is-linked');
    this.settleTo(el);
  }

  settleTo(el) {
    clearTimeout(this._settle);
    const offset = () => {
      const v = getComputedStyle(document.documentElement)
        .getPropertyValue('--anchor-offset').trim();
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : 86;
    };
    const target = () => Math.max(0, window.scrollY + el.getBoundingClientRect().top - offset());

    let expected = target();
    window.scrollTo({ top: expected, behavior: 'smooth' });

    let taken = false;
    const onWheel = () => { taken = true; };
    ['wheel', 'touchmove', 'keydown'].forEach(t =>
      window.addEventListener(t, onWheel, { passive: true, once: true }));

    const checks = [90, 260, 550, 900, 1400, 2000];
    let i = 0;
    const tick = () => {
      if (taken || i >= checks.length) {
        ['wheel', 'touchmove', 'keydown'].forEach(t => window.removeEventListener(t, onWheel));
        return;
      }
      const want = target();
      if (Math.abs(want - window.scrollY) > 4) {
        window.scrollTo({ top: want, behavior: i < 2 ? 'smooth' : 'auto' });
      }
      i += 1;
      this._settle = setTimeout(tick, checks[i - 1]);
    };
    this._settle = setTimeout(tick, checks[0]);
  }

  async copyLink(btn) {
    const url = new URL(location.href);
    url.hash = btn.dataset.link;
    history.replaceState(null, '', url);
    let ok = true;
    try { await navigator.clipboard.writeText(url.href); }
    catch { ok = false; }
    btn.classList.add('is-copied');
    btn.setAttribute('aria-label', ok ? 'Link copied' : 'Link is in the address bar');
    setTimeout(() => { btn.classList.remove('is-copied'); }, 1400);
    this.markTarget();
  }

  group(g, notes) {
    const shown = g.examples.filter(e => !e.identical);
    if (this.bare) return shown.map(e => this.example(e, g, notes)).join('');
    const note = (notes.sections || {})[g.key] || '';
    return `
      <section class="ed-section" id="ed-${g.key}">
        <div class="ed-banner"><span class="ed-mark"></span><h2>${g.banner}</h2></div>
        ${note ? `<p class="ed-obs ed-obs-section">${note}</p>` : ''}
        ${shown.map(e => this.example(e, g, notes)).join('')}
      </section>`;
  }

  transport(which) {
    return `
      <div class="ed-bar" data-bar="${which}">
        <button data-act="play" title="Play">&#9654;</button>
        <button data-act="prev" title="Previous">&lsaquo;</button>
        <button data-act="next" title="Next">&rsaquo;</button>
        <input class="ed-seek" type="range" min="0" max="1" value="0" step="1" aria-label="Step">
        <span class="ed-count" data-count></span>
        <span class="ed-seg" role="group" aria-label="Speed">
          ${SPEEDS.map(r => `<button data-rate="${r}"${r === 1 ? ' aria-pressed="true"' : ''}>${r}&times;</button>`).join('')}
        </span>
        <button data-act="restart" title="Back to the start">&#8635;</button>
      </div>`;
  }

  side(which, label) {
    return `
      <div class="ed-side ed-${which}">
        <div class="ed-sidehead"><i></i>${label}</div>
        <div class="ed-stage" data-stage="${which}"><div class="ed-load">animation loads when you scroll here</div></div>
        <div class="ed-slate" data-slate="${which}"></div>
        ${this.transport(which)}
      </div>`;
  }

  example(ex, g, notes) {
    const note = (notes.examples || {})[ex.id] || '';
    const anchor = this.anchorFor(g, ex);
    const title = (this.titles || {})[anchor] || '';
    return `
      <article class="ed-ex" id="${anchor}" data-ex="${ex.id}">
        <header class="ed-exhead">
          ${this.bare ? '' : `<span class="ed-num">Example ${(this._count = (this._count || 0) + 1)}</span>`}
          <span class="ed-headtext">
            ${title
              ? `<h3 class="ed-title">${esc(title)}</h3>`
              : `<h3 class="ed-title is-empty">Untitled — add it under
                   <code>"${anchor}"</code> in <code>data/editability_titles.json</code></h3>`}
            <span class="ed-src">${ex.id}</span>
          </span>
          <span class="ed-sp"></span>
          ${ex.xml ? `<button class="ed-xmlbtn" data-xml="${ex.id}">Compare XMLs</button>` : ''}
          <span class="ed-chip">${ex.style}</span>
          ${this.bare
            ? `<a class="ed-link" href="editability.html#${anchor}"
                  title="Open this example on the editability page"
                  aria-label="Open this example on the editability page">`
            : `<a class="ed-link" href="#${anchor}" data-link="${anchor}"
                  title="Copy a link to this example" aria-label="Copy a link to this example">`}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M10 13a5 5 0 0 0 7.1 0l3-3A5 5 0 0 0 13 3l-1.7 1.7"/>
              <path d="M14 11a5 5 0 0 0-7.1 0l-3 3A5 5 0 0 0 11 21l1.7-1.7"/>
            </svg>
          </a>
        </header>

        <div class="ed-cols">
          ${this.side('before', 'Before the edit')}

          <div class="ed-mid">
            <div class="ed-from">
              <span class="ed-avatar" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                     stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="8" r="3.4"/><path d="M4.5 20c.6-4 3.8-6 7.5-6s6.9 2 7.5 6"/>
                </svg>
              </span>
              <span class="ed-fromlab">from a user<b>Edit suggestion</b></span>
            </div>
            <div class="ed-prompt">${ex.prompt || '—'}</div>
            <svg class="ed-feed" viewBox="0 0 40 46" aria-hidden="true" fill="none"
                 stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 3v33"/><path d="M11 27l9 9 9-9"/>
            </svg>
            <img class="ed-logo" src="${g.logo}" alt="${g.agent}" loading="lazy">
            <div class="ed-agentname">${g.agent}</div>
          </div>

          ${this.side('after', 'After the edit')}
        </div>

        <!-- Observation: edit data/editability_notes.json → examples["${ex.id}"] -->
        <p class="ed-obs${note ? '' : ' is-empty'}" data-obs>${note}</p>
      </article>`;
  }

  modal() {
    return `
      <dialog class="ed-modal">
        <div class="ed-modalhead">
          <h3 data-mtitle>Recovered representation</h3>
          <span class="ed-sp"></span>
          <span class="ed-key" data-mkey></span>
          <button class="ed-close">Close</button>
        </div>
        <div class="ed-xmlcols" data-mbody></div>
      </dialog>`;
  }


  wire(ex) {
    const root = this.querySelector('[data-ex="' + CSS.escape(ex.id) + '"]');
    const A = new Side(root, 'before', ex.srcBefore, ex.before);
    const B = new Side(root, 'after',  ex.srcAfter,  ex.after);
    onVisible(root, () => { A.load(); B.load(); }, { rootMargin: '400px' });
  }

  async openXml(ex) {
    const body = this.querySelector('[data-mbody]');
    this.querySelector('[data-mtitle]').textContent =
      'Recovered representation · ' + ex.id;
    body.innerHTML = '<div class="ed-load" style="padding:40px">loading…</div>';
    this.dlg.showModal();

    const render = async (side, caption) => {
      const info = ex.xml[side];
      const text = await fetch(info.src).then(r => r.text());
      const lines = text.replace(/\r/g, '').split('\n');
      const mark = new Map();
      info.spans.forEach(sp => {
        for (let n = sp.from; n <= sp.to; n++) mark.set(n, sp.swatch);
        mark.set(sp.from + ':edge', true); mark.set(sp.to + ':edge', true);
      });
      const rows = lines.map((l, k) => {
        const n = k + 1, sw = mark.get(n);
        const cls = 'ln' + (sw ? ' hl-' + sw : '') + (mark.get(n + ':edge') ? ' edge' : '');
        return '<div class="' + cls + '"><i>' + n + '</i>' + esc(l) + '</div>';
      }).join('');
      return '<div class="ed-xmlcol"><div class="ed-xmlcap">' + caption +
             '</div><div class="ed-xml">' + rows + '</div></div>';
    };

    const labels = { a: 'Facial Feature Extractor', b: 'Person Dictionary', c: 'Combined module' };
    const swatches = { a: '#2F6FB5', b: '#C4682A', c: '#3E8C4B' };
    const seen = [];
    ['before', 'after'].forEach(s =>
      ex.xml[s].spans.forEach(sp => { if (!seen.includes(sp.swatch)) seen.push(sp.swatch); }));
    this.querySelector('[data-mkey]').innerHTML = seen.map(sw =>
      '<span><i style="background:' + swatches[sw] + '"></i>' + (labels[sw] || sw) + '</span>').join('');

    const [b, a] = await Promise.all([render('before', 'Before the edit'),
                                      render('after',  'After the edit')]);
    body.innerHTML = b + a;
  }
}

customElements.define('edit-diff', EditDiff);
