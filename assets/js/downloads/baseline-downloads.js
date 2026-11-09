import { loadJSON } from '../lib/data-loader.js';

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const STYLE_COLORS = {
  'Progressive Reveal': '#3F86D8',
  'Alpha Masking': '#8B6CD9',
  'Colour Pop': '#E0588A',
  'Hopping Bounding Box': '#22A06B',
  'Sliding Bounding Box': '#E8952A',
};

const styleBadge = (style, extra = '') =>
  `<span class="bo-style${extra}" style="--sty:${STYLE_COLORS[style] || '#625C50'}"><i aria-hidden="true"></i><small>Animation style</small><b>${esc(style)}</b></span>`;

const STAGES = { 1: 'Stage I · Diagram Transmuter', 2: 'Stage II · Animation Planner', 3: 'Stage III · Diagram Animator' };

const ICON_DOWNLOAD =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 19h14"/></svg>';
const ICON_CLOSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
const ICON_PREV = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg>';
const ICON_NEXT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>';
const ICON_FILE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/></svg>';
const ICON_FOLDER = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h6l2 2h10v11H3z"/></svg>';

function formatSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

class BaselineDownloads extends HTMLElement {
  async connectedCallback() {
    this.data = await loadJSON(this.getAttribute('src'));
    this.index = -1;
    this.renderGallery();
    this.renderDialog();
    window.addEventListener('hashchange', () => this.fromHash());
    this.fromHash();
  }

  href(model, sample) {
    return `${this.data.base || ''}${this.data.folder}/${sample.id}/${model.dir}.zip`;
  }

  modelsFor(sample) {
    return this.data.models.filter((m) => sample.files && sample.files[m.dir]);
  }

  renderGallery() {
    const { samples, models } = this.data;
    this.innerHTML = `
      <div class="bo-summary">
        <span><b>${samples.length}</b> representative examples</span>
        <span class="bo-dot" aria-hidden="true"></span>
        <span><b>${models.length}</b> models</span>
        <span class="bo-dot" aria-hidden="true"></span>
        <span>one <b>.zip</b> per example and model</span>
      </div>
      <ul class="bo-grid">
        ${samples
          .map(
            (s, i) => `
          <li>
            <a class="bo-card" href="#sample-${esc(s.id)}" data-index="${i}" style="--i:${i}">
              <span class="bo-card-media" style="--sty:${STYLE_COLORS[s.style] || '#625C50'}"><img src="${esc(s.image)}" alt="Source diagram ${esc(s.id)}" loading="lazy" decoding="async"></span>
              <span class="bo-card-body">
                ${styleBadge(s.style)}
                <span class="bo-card-id">${esc(s.id)}</span>
                <span class="bo-card-cta">${ICON_DOWNLOAD}<span>Outputs from ${this.modelsFor(s).length} models</span></span>
              </span>
            </a>
          </li>`
          )
          .join('')}
      </ul>`;
  }

  renderDialog() {
    const dlg = document.createElement('dialog');
    dlg.className = 'bo-dialog';
    dlg.setAttribute('aria-labelledby', 'bo-dialog-title');
    dlg.innerHTML = `
      <div class="bo-panel">
        <header class="bo-panel-head">
          <div>
            <span data-style></span>
            <h2 id="bo-dialog-title" data-title></h2>
          </div>
          <div class="bo-panel-nav">
            <button type="button" class="bo-icon-btn" data-prev aria-label="Previous example">${ICON_PREV}</button>
            <span class="bo-count" data-count></span>
            <button type="button" class="bo-icon-btn" data-next aria-label="Next example">${ICON_NEXT}</button>
            <button type="button" class="bo-icon-btn bo-close" data-close aria-label="Close">${ICON_CLOSE}</button>
          </div>
        </header>
        <div class="bo-panel-body">
          <figure class="bo-source">
            <div class="bo-source-frame" data-frame><a data-full target="_blank" rel="noopener"><img data-img alt=""></a></div>
            <figcaption>Source diagram</figcaption>
            <div class="bo-contents">
              <div class="bo-contents-title">Each .zip contains</div>
              <ol data-contents></ol>
            </div>
          </figure>
          <div class="bo-models">
            <div class="bo-models-title" data-models-title></div>
            <ul data-models></ul>
          </div>
        </div>
      </div>`;
    document.body.append(dlg);
    this.dialog = dlg;

    dlg.querySelector('[data-close]').addEventListener('click', () => this.close());
    dlg.querySelector('[data-prev]').addEventListener('click', () => this.step(-1));
    dlg.querySelector('[data-next]').addEventListener('click', () => this.step(1));
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg) this.close();
    });
    dlg.addEventListener('cancel', (e) => {
      e.preventDefault();
      this.close();
    });
    dlg.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') this.step(-1);
      if (e.key === 'ArrowRight') this.step(1);
    });

    let group = 0;
    dlg.querySelector('[data-contents]').innerHTML = this.data.contents
      .map((c) => {
        const head = c.stage !== group ? `<li class="bo-stage">${esc(STAGES[c.stage])}</li>` : '';
        group = c.stage;
        const icon = c.file.endsWith('/') ? ICON_FOLDER : ICON_FILE;
        return `${head}<li${c.optional ? ' class="is-optional"' : ''}>${icon}<code>${esc(c.file)}</code><span>${esc(c.label)}${c.optional ? ' <em>when produced</em>' : ''}</span></li>`;
      })
      .join('');
  }

  fromHash() {
    const m = /^#sample-(.+)$/.exec(decodeURIComponent(location.hash));
    const i = m ? this.data.samples.findIndex((s) => s.id === m[1]) : -1;
    if (i >= 0) this.open(i);
    else if (this.dialog.open) this.hide();
  }

  open(i) {
    this.index = i;
    const s = this.data.samples[i];
    const d = this.dialog;
    d.querySelector('[data-style]').innerHTML = styleBadge(s.style, ' bo-style-lg');
    d.querySelector('[data-frame]').style.setProperty('--sty', STYLE_COLORS[s.style] || '#625C50');
    d.querySelector('[data-models-title]').textContent = `Download each model's ${s.style} outputs for this example`;
    d.querySelector('[data-title]').textContent = s.id;
    d.querySelector('[data-count]').textContent = `${i + 1} / ${this.data.samples.length}`;
    const img = d.querySelector('[data-img]');
    img.src = s.image;
    img.alt = `Source diagram ${s.id}`;
    d.querySelector('[data-full]').href = s.image;
    d.querySelector('[data-models]').innerHTML = this.modelsFor(s)
      .map((m) => {
        const href = this.href(m, s);
        return `
        <li class="bo-model${m.main ? ' is-main' : ''}">
          <div class="bo-model-name">
            <b>${esc(m.name)}</b>
            ${m.main ? '<span class="bo-tag bo-tag-main">Main backbone</span>' : ''}
            ${m.params ? `<span class="bo-tag">${esc(m.params)}</span>` : ''}
          </div>
          <a class="bo-dl" href="${esc(href)}" download>
            ${ICON_DOWNLOAD}<span>Download .zip</span><small>${esc(formatSize(s.files[m.dir]))}</small>
          </a>
        </li>`;
      })
      .join('');
    if (!d.open) d.showModal();
  }

  step(delta) {
    const n = this.data.samples.length;
    const i = (this.index + delta + n) % n;
    history.replaceState(null, '', `#sample-${this.data.samples[i].id}`);
    this.open(i);
  }

  hide() {
    this.dialog.close();
  }

  close() {
    this.hide();
    history.replaceState(null, '', location.pathname + location.search);
    const card = this.querySelector(`[data-index="${this.index}"]`);
    if (card) card.focus();
  }
}

customElements.define('baseline-downloads', BaselineDownloads);
