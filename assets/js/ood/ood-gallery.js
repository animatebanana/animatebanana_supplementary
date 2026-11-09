import { loadJSON } from '../lib/data-loader.js';
import { onVisible } from '../lib/lazy-load.js';
import { escapeHtml, formatTime } from '../lib/format.js';

const ALL = 'all';
const RATES = [1, 1.5, 2, 0.5];
const reducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

class OodGallery extends HTMLElement {
  constructor() {
    super();
    this._items = [];
    this._cats = [];
    this._cat = ALL;
    this._observers = [];
  }

  async connectedCallback() {
    let data;
    try {
      data = await loadJSON(this.getAttribute('src') || 'data/ood/ood_items.json');
    } catch {
      this.innerHTML = '<p class="ood-empty">The gallery feed could not be loaded.</p>';
      return;
    }
    if (!this.isConnected) return;
    this._items = data.items || [];
    this._cats = data.categories || [];
    this.render();
  }

  disconnectedCallback() {
    for (const o of this._observers) o?.disconnect();
    this._observers = [];
    this._closeViewer();
  }

  get filtered() {
    return this._cat === ALL ? this._items : this._items.filter((i) => i.categoryId === this._cat);
  }

  render() {
    const chips = [{ id: ALL, label: 'All', count: this._items.length }, ...this._cats];
    this.innerHTML = `
      <div class="ood-filters" role="group" aria-label="Filter by subject">
        ${chips
          .map(
            (c) => `<button type="button" class="ood-chip" data-cat="${escapeHtml(c.id)}"
                      aria-pressed="${c.id === this._cat}">${escapeHtml(c.label)}</button>`
          )
          .join('')}
      </div>
      <div class="ood-grid"></div>`;

    this._grid = this.querySelector('.ood-grid');
    this.querySelector('.ood-filters').addEventListener('click', (e) => {
      const chip = e.target.closest('[data-cat]');
      if (!chip || chip.dataset.cat === this._cat) return;
      this._cat = chip.dataset.cat;
      for (const c of this.querySelectorAll('.ood-chip')) {
        c.setAttribute('aria-pressed', String(c.dataset.cat === this._cat));
      }
      this.dispatchEvent(new CustomEvent('oodfilter', { detail: { cat: this._cat }, bubbles: true }));
      this.paintGrid();
    });
    this._grid.addEventListener('click', (e) => {
      const card = e.target.closest('.ood-card');
      if (card) this._openViewer(card.dataset.id);
    });
    this.paintGrid();
  }

  paintGrid() {
    for (const o of this._observers) o?.disconnect();
    this._observers = [];
    const items = this.filtered;
    if (!items.length) {
      this._grid.innerHTML = '<p class="ood-empty">No diagrams in this subject yet.</p>';
      return;
    }
    this._grid.innerHTML = items
      .map(
        (it) => `
      <article class="ood-card" data-id="${escapeHtml(it.id)}" tabindex="0" role="button"
               aria-label="${escapeHtml(`Play the ${it.title} animation`)}">
        <div class="ood-thumb">
          <img alt="" decoding="async">
          <span class="ood-play" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M9 6.5l10 5.5-10 5.5z"/></svg>
          </span>
        </div>
        <div class="ood-cardfoot">
          <span class="ood-cardtitle">${escapeHtml(it.title)}</span>
          ${it.style ? `<span class="ood-style">${escapeHtml(it.style)}</span>` : ''}
        </div>
      </article>`
      )
      .join('');

    for (const it of items) {
      const card = this._grid.querySelector(`.ood-card[data-id="${CSS.escape(it.id)}"]`);
      const img = card?.querySelector('img');
      if (!img) continue;
      this._observers.push(
        onVisible(card, () => { img.src = it.thumb; }, { rootMargin: '400px 0px' })
      );
    }
  }


  _openViewer(id) {
    const item = this._items.find((i) => i.id === id);
    if (!item || this._el) return;
    this._item = item;
    this._i = 0;
    this._playing = false;
    this._rate = 1;
    this._returnFocus = document.activeElement;

    const el = document.createElement('div');
    el.className = 'ood-viewer';
    el.innerHTML = `
      <div class="ood-sheet" role="dialog" aria-modal="true"
           aria-label="${escapeHtml(item.title)}">
        <div class="ood-vbar">
          <button type="button" class="ood-back" data-close>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M19.5 12h-14M11 5.5L5.5 12 11 18.5"/>
            </svg><span>Back to the gallery</span>
          </button>
          <span class="ood-vtitle">${escapeHtml(item.title)}</span>
          <span class="ood-vpill">${escapeHtml(item.category)}</span>
          ${item.style ? `<span class="ood-vpill ood-vpill--style">${escapeHtml(item.style)}</span>` : ''}
        </div>

        <div class="ood-panes">
          <figure class="ood-pane" data-pane="source">
            <figcaption>Published figure</figcaption>
            <div class="ood-stage" tabindex="0" role="button" aria-label="Enlarge the published figure">
              ${item.source
                ? `<img src="${escapeHtml(item.source)}" alt="Source figure" decoding="async">`
                : '<div class="ood-missing">No source figure kept for this diagram.</div>'}
              <span class="ood-zoomhint">click to enlarge</span>
            </div>
          </figure>
          <figure class="ood-pane" data-pane="anim">
            <figcaption>Generated animation</figcaption>
            <div class="ood-stage" tabindex="0" role="button" aria-label="Enlarge the generated animation">
              <img class="ood-frame is-on" alt="" decoding="async">
              <img class="ood-frame" alt="" aria-hidden="true" decoding="async">
              <div class="ood-loading"><span></span>Loading frames…</div>
              <span class="ood-zoomhint">click to enlarge</span>
            </div>
          </figure>
        </div>

        <div class="ood-transport" hidden>
          <button type="button" class="ood-pp" aria-label="Play">
            <svg class="ood-ic-play" viewBox="0 0 24 24"><path d="M8.5 5.5l11 6.5-11 6.5z"/></svg>
            <svg class="ood-ic-pause" viewBox="0 0 24 24"><path d="M8 5.5h3.4v13H8zM12.6 5.5H16v13h-3.4z"/></svg>
          </button>
          <input class="ood-seek" type="range" min="0" max="${item.frames.length - 1}"
                 value="0" step="1" aria-label="Step">
          <span class="ood-clock">${escapeHtml(formatTime(item.seconds))}</span>
          <button type="button" class="ood-rate" aria-label="Playback speed"><span>1×</span></button>
        </div>

        <p class="ood-caption" aria-live="polite"></p>
      </div>`;

    document.body.appendChild(el);
    document.body.classList.add('ood-locked');
    this._el = el;

    this._layers = [...el.querySelectorAll('.ood-frame')];
    this._live = 0;
    this._seek = el.querySelector('.ood-seek');
    this._caption = el.querySelector('.ood-caption');
    this._transport = el.querySelector('.ood-transport');
    this._rateEl = el.querySelector('.ood-rate span');

    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]') || e.target === el) return this._closeViewer();
      if (e.target.closest('.ood-pp')) return this._toggle();
      if (e.target.closest('.ood-rate')) return this._cycleRate();
      const stage = e.target.closest('.ood-stage');
      if (stage) return this._zoom(stage.closest('.ood-pane'));
    });
    el.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const stage = e.target.closest('.ood-stage');
      if (!stage) return;
      e.preventDefault();
      this._zoom(stage.closest('.ood-pane'));
    });
    this._seek.addEventListener('input', () => {
      this._pause();
      this._show(Number(this._seek.value));
    });
    this._keys = (e) => {
      if (e.key === 'Escape' && this._el?.classList.contains('is-zoomed')) {
        return this._zoom(null);
      }
      if (e.key === 'Escape') return this._closeViewer();
      if (e.target.closest('input')) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); this._pause(); this._show(this._i + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); this._pause(); this._show(this._i - 1); }
      if (e.key === ' ') { e.preventDefault(); this._toggle(); }
    };
    document.addEventListener('keydown', this._keys);

    requestAnimationFrame(() => el.classList.add('is-in'));
    this._show(0);
    this._preload().then(() => {
      if (!this._el) return;
      el.querySelector('.ood-loading')?.remove();
      this._transport.hidden = false;
      if (!reducedMotion()) this._play();
    });
    el.querySelector('.ood-back')?.focus();
  }

  _preload() {
    return Promise.all(
      this._item.frames.map(
        (src) =>
          new Promise((done) => {
            const im = new Image();
            im.onload = im.onerror = () => done();
            im.src = src;
          })
      )
    );
  }

  _show(n) {
    const item = this._item;
    if (!item) return;
    this._i = Math.max(0, Math.min(item.frames.length - 1, n));
    const src = item.frames[this._i];
    const live = this._layers[this._live];

    if (!live.getAttribute('src')) {
      live.src = src;
      live.classList.add('is-on');
    } else if (live.getAttribute('src') !== src) {
      const idle = this._layers[1 - this._live];
      const hold = item.beats[this._i]?.hold || 3;
      const fade = Math.round(
        Math.min(1000, Math.max(340, (hold * 1000) / this._rate * 0.5))
      );

      idle.style.setProperty('--ood-fade', `${fade}ms`);
      idle.style.zIndex = '2';
      live.style.zIndex = '1';
      idle.src = src;
      idle.classList.add('is-under');
      idle.classList.remove('is-on');
      void idle.offsetWidth;
      idle.classList.remove('is-under');
      idle.classList.add('is-on');

      clearTimeout(this._fade);
      this._fade = setTimeout(() => {
        live.classList.add('is-under');
        live.classList.remove('is-on');
      }, fade + 40);

      this._live = 1 - this._live;
    }
    const beat = item.beats[this._i];
    this._caption.textContent = beat ? beat.text : '';
    if (this._seek.value !== String(this._i)) this._seek.value = String(this._i);
  }

  _zoom(pane) {
    if (!this._el) return;
    const current = this._el.querySelector('.ood-pane.is-zoomed');
    const next = pane && pane !== current ? pane : null;
    for (const p of this._el.querySelectorAll('.ood-pane')) {
      p.classList.toggle('is-zoomed', p === next);
    }
    this._el.classList.toggle('is-zoomed', !!next);
  }

  _toggle() { this._playing ? this._pause() : this._play(); }

  _play() {
    if (!this._item) return;
    if (this._i >= this._item.frames.length - 1) this._show(0);
    this._playing = true;
    this._el.classList.add('is-playing');
    this._el.querySelector('.ood-pp')?.setAttribute('aria-label', 'Pause');
    this._tick();
  }

  _pause() {
    this._playing = false;
    clearTimeout(this._timer);
    this._el?.classList.remove('is-playing');
    this._el?.querySelector('.ood-pp')?.setAttribute('aria-label', 'Play');
  }

  _tick() {
    clearTimeout(this._timer);
    if (!this._playing || !this._item) return;
    const hold = (this._item.beats[this._i]?.hold || 3) * 1000 / this._rate;
    this._timer = setTimeout(() => {
      if (!this._playing) return;
      if (this._i >= this._item.frames.length - 1) return this._pause();
      this._show(this._i + 1);
      this._tick();
    }, hold);
  }

  _cycleRate() {
    this._rate = RATES[(RATES.indexOf(this._rate) + 1) % RATES.length];
    this._rateEl.textContent = `${this._rate}×`;
    if (this._playing) this._tick();
  }

  _closeViewer() {
    this._pause();
    clearTimeout(this._fade);
    document.removeEventListener('keydown', this._keys || (() => {}));
    const el = this._el;
    if (!el) return;
    this._el = null;
    this._item = null;
    document.body.classList.remove('ood-locked');
    el.classList.remove('is-in');
    setTimeout(() => el.remove(), reducedMotion() ? 0 : 180);
    this._returnFocus?.focus?.();
  }
}

customElements.define('ood-gallery', OodGallery);
