import { loadJSON } from '../lib/data-loader.js';

const CATEGORY_TAG_CLASS = {
  'Machine Learning': 'tag-blue',
  'Computer Science': 'tag-pink',
  'Bioinformatics': 'tag-mint',
  Robotics: 'tag-tan',
};

function uniqueValues(items, key) {
  return ['All', ...Array.from(new Set(items.map((it) => it[key]))).sort()];
}

/**
 * <gallery-grid></gallery-grid>
 *
 * Filterable grid over data/examples.json (category / diagram type /
 * complexity). Dispatches `exampleselect` (detail: { id }) on card
 * click — it never opens a viewer itself, so it's equally usable
 * embedded in examples.html (opens a full-screen <dialog>) or in
 * animatebench.html (embedded inline below the dataset charts).
 *
 * Note on "style" as a filter: in the real benchmark each example may
 * ship with one curated rendered style. In this scaffold every
 * example is animatable in all five styles generically (see
 * example-viewer.js), so a style filter here wouldn't actually narrow
 * anything — once examples carry a real default/curated style, add it
 * back the same way category/diagramType/complexity work below.
 */
class GalleryGrid extends HTMLElement {
  constructor() {
    super();
    this._items = [];
    this._filters = { category: 'All', diagramType: 'All', complexity: 'All' };
  }

  async connectedCallback() {
    this._items = await loadJSON('data/examples.json');
    this.render();
  }

  setFilter(key, value) {
    this._filters[key] = value;
    this.render();
  }

  get filtered() {
    return this._items.filter(
      (it) =>
        (this._filters.category === 'All' || it.category === this._filters.category) &&
        (this._filters.diagramType === 'All' || it.diagramType === this._filters.diagramType) &&
        (this._filters.complexity === 'All' || it.complexity === this._filters.complexity)
    );
  }

  renderFilterRow(key) {
    const values = uniqueValues(this._items, key);
    return `<div class="gg-filter-row" data-filter="${key}">
      ${values.map((v) => `<button type="button" class="gg-chip ${this._filters[key] === v ? 'gg-chip-active' : ''}" data-value="${v}">${v}</button>`).join('')}
    </div>`;
  }

  render() {
    const cards = this.filtered;
    this.innerHTML = `
      <div class="gg-filters">
        ${this.renderFilterRow('category')}
        ${this.renderFilterRow('diagramType')}
        ${this.renderFilterRow('complexity')}
      </div>
      <div class="gg-grid" data-reveal-group>
        ${
          cards.length
            ? cards
                .map(
                  (it) => `
          <button type="button" class="gg-card" data-id="${it.id}">
            <div class="gg-thumb" data-role="thumb" data-id="${it.id}"></div>
            <div class="gg-body">
              <span class="tag ${CATEGORY_TAG_CLASS[it.category] || 'tag-tan'}">${it.category}</span>
              <div class="gg-title">${it.title}</div>
              <div class="gg-meta">${it.diagramType} · ${it.complexity}</div>
            </div>
          </button>`
                )
                .join('')
            : '<div class="gg-empty">No examples match these filters yet — try a broader category or type.</div>'
        }
      </div>`;

    this.querySelectorAll('.gg-filter-row').forEach((row) => {
      row.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (btn) this.setFilter(row.dataset.filter, btn.dataset.value);
      });
    });
    this.querySelectorAll('.gg-card').forEach((card) => {
      card.addEventListener('click', () => {
        this.dispatchEvent(new CustomEvent('exampleselect', { detail: { id: card.dataset.id }, bubbles: true }));
      });
    });
    this.loadThumbs(cards);
  }

  async loadThumbs(cards) {
    for (const it of cards) {
      const el = this.querySelector(`.gg-thumb[data-id="${it.id}"]`);
      if (!el) continue;
      try {
        const svg = await fetch(`examples/${it.id}/thumb.svg`).then((r) => r.text());
        el.innerHTML = svg;
      } catch {
        /* leave the hatched placeholder background visible */
      }
    }
  }
}
customElements.define('gallery-grid', GalleryGrid);
