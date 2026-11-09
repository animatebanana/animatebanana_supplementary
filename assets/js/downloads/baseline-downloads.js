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
const ICON_IMAGE = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m4 18 5-5 4 4 3-3 4 4"/></svg>';

function formatSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const fileIcon = (name) => (name.endsWith('/') ? ICON_FOLDER : /\.(png|jpe?g|webp)$/i.test(name) ? ICON_IMAGE : ICON_FILE);

class BaselineDownloads extends HTMLElement {
  async connectedCallback() {
    this.data = await loadJSON(this.getAttribute('src'));
    this.groups = this.data.groups;
    this.group = this.groups[0];
    this.index = -1;
    this.renderShell();
    this.renderDialog();
    window.addEventListener('hashchange', () => this.fromHash());
    this.fromHash();
  }

  href(model, sample) {
    return `${this.data.base || ''}${this.group.folder}/${sample.id}/${model.dir}.zip`;
  }

  modelsFor(sample) {
    return this.group.models.filter((m) => sample.files && sample.files[m.dir]);
  }

  renderShell() {
    this.innerHTML = `
      <div class="bo-switch" role="tablist" aria-label="Output group">
        ${this.groups
          .map(
            (g) => `
          <button type="button" role="tab" class="bo-switch-btn" data-group="${esc(g.id)}" aria-selected="false">
            <b>${esc(g.label)}</b><small>${esc(g.sub || '')}</small>
          </button>`
          )
          .join('')}
      </div>
      <div class="bo-groups" data-gallery></div>`;
    for (const btn of this.querySelectorAll('[data-group]')) {
      btn.addEventListener('click', () => {
        history.replaceState(null, '', `#${btn.dataset.group}`);
        this.selectGroup(btn.dataset.group);
      });
    }
  }

  selectGroup(id) {
    const g = this.groups.find((x) => x.id === id) || this.groups[0];
    const changed = g !== this.group || !this.querySelector('.bo-grid');
    this.group = g;
    for (const btn of this.querySelectorAll('[data-group]')) {
      const on = btn.dataset.group === g.id;
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-selected', String(on));
    }
    if (changed) this.renderGallery();
  }

  renderGallery() {
    const { samples, models, id } = this.group;
    this.querySelector('[data-gallery]').innerHTML = `
      <ul class="bo-grid">
        ${samples
          .map(
            (s, i) => `
          <li>
            <a class="bo-card" href="#${esc(id)}-${esc(s.id)}" data-index="${i}" style="--i:${i}">
              <span class="bo-card-media" style="--sty:${STYLE_COLORS[s.style] || '#625C50'}"><img src="${esc(s.image)}" alt="Source diagram ${esc(s.id)}" loading="lazy" decoding="async"></span>
              <span class="bo-card-body">
                ${styleBadge(s.style)}
                <span class="bo-card-id">${esc(s.id)}</span>
                <span class="bo-card-cta">${ICON_DOWNLOAD}<span>Download Outputs</span></span>
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
  }

  renderContents() {
    let stage = 0;
    this.dialog.querySelector('[data-contents]').innerHTML = this.group.contents
      .map((c) => {
        const head = c.stage && c.stage !== stage ? `<li class="bo-stage">${esc(STAGES[c.stage])}</li>` : '';
        stage = c.stage || stage;
        return `${head}<li${c.optional ? ' class="is-optional"' : ''}>${fileIcon(c.file)}<code>${esc(c.file)}</code><span>${esc(c.label)}${c.optional ? ' <em>when produced</em>' : ''}</span></li>`;
      })
      .join('');
  }

  fromHash() {
    const h = decodeURIComponent(location.hash.slice(1));
    const legacy = /^sample-(.+)$/.exec(h);
    let groupId = this.groups[0].id;
    let sampleId = null;
    if (legacy) {
      groupId = 'open';
      sampleId = legacy[1];
    } else {
      for (const g of this.groups) {
        if (h === g.id) groupId = g.id;
        else if (h.startsWith(`${g.id}-`)) {
          groupId = g.id;
          sampleId = h.slice(g.id.length + 1);
        }
      }
    }
    this.selectGroup(groupId);
    const i = sampleId ? this.group.samples.findIndex((s) => s.id === sampleId) : -1;
    if (i >= 0) this.open(i);
    else if (this.dialog.open) this.hide();
  }

  open(i) {
    this.index = i;
    const g = this.group;
    const s = g.samples[i];
    const d = this.dialog;
    this.renderContents();
    d.querySelector('[data-style]').innerHTML = styleBadge(s.style, ' bo-style-lg');
    d.querySelector('[data-frame]').style.setProperty('--sty', STYLE_COLORS[s.style] || '#625C50');
    d.querySelector('[data-models-title]').textContent = `Download each model's ${s.style} outputs for this example`;
    d.querySelector('[data-title]').textContent = s.id;
    d.querySelector('[data-count]').textContent = `${i + 1} / ${g.samples.length}`;
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
    const n = this.group.samples.length;
    const i = (this.index + delta + n) % n;
    history.replaceState(null, '', `#${this.group.id}-${this.group.samples[i].id}`);
    this.open(i);
  }

  hide() {
    this.dialog.close();
  }

  close() {
    this.hide();
    history.replaceState(null, '', `${location.pathname}${location.search}#${this.group.id}`);
    const card = this.querySelector(`[data-index="${this.index}"]`);
    if (card) card.focus();
  }
}

customElements.define('baseline-downloads', BaselineDownloads);
