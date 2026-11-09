import { loadJSON } from '../lib/data-loader.js';
import { escapeHtml } from '../lib/format.js';

const ALL = 'all';
const fmt = (v) => Number(v).toFixed(3);

class OodTable extends HTMLElement {
  constructor() {
    super();
    this._rows = [];
    this._metrics = [];
    this._cats = [];
    this._reference = null;
    this._cat = ALL;
    this._sort = { key: 'title', dir: 1 };
  }

  async connectedCallback() {
    let data;
    try {
      data = await loadJSON(this.getAttribute('src') || 'data/ood/ood_runs.json');
    } catch {
      this.innerHTML = '<p class="ood-empty">The results feed could not be loaded.</p>';
      return;
    }
    if (!this.isConnected) return;
    this._rows = data.rows || [];
    this._metrics = data.metrics || [];
    this._cats = data.categories || [];
    this._reference = data.reference || null;
    this.render();
    document.addEventListener('oodfilter', (e) => this.setCat(e.detail.cat, false));
  }

  setCat(cat, announce = true) {
    if (cat === this._cat) return;
    this._cat = cat;
    for (const c of this.querySelectorAll('.ood-chip')) {
      c.setAttribute('aria-pressed', String(c.dataset.cat === this._cat));
    }
    if (announce) {
      this.dispatchEvent(new CustomEvent('oodfilter', { detail: { cat }, bubbles: true }));
    }
    this.paint();
  }

  get filtered() {
    const rows = this._cat === ALL
      ? this._rows
      : this._rows.filter((r) => r.categoryId === this._cat);
    const { key, dir } = this._sort;
    return [...rows].sort((a, b) => {
      const va = key in (a.scores || {}) ? a.scores[key] : a[key];
      const vb = key in (b.scores || {}) ? b.scores[key] : b[key];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      return (typeof va === 'string' ? va.localeCompare(vb) : va - vb) * dir;
    });
  }

  render() {
    const chips = [{ id: ALL, label: 'All' }, ...this._cats];
    this.innerHTML = `
      <div class="ood-filters ood-filters--table" role="group" aria-label="Filter the table by subject">
        ${chips
          .map(
            (c) => `<button type="button" class="ood-chip" data-cat="${escapeHtml(c.id)}"
                      aria-pressed="${c.id === this._cat}">${escapeHtml(c.label)}</button>`
          )
          .join('')}
      </div>
      <div class="ood-tablewrap"><table class="ood-tbl">
        <thead>
          <tr>
            <th class="ood-th-name" data-sort="title" scope="col">Diagram</th>
            <th data-sort="category" scope="col">Subject</th>
            ${this._metrics
              .map(
                (m) => `<th data-sort="${escapeHtml(m.id)}" scope="col" class="ood-num"
                            title="${escapeHtml(m.title)}">${escapeHtml(m.label)}</th>`
              )
              .join('')}
          </tr>
        </thead>
        <tbody></tbody>
        <tfoot></tfoot>
      </table></div>`;

    this.querySelector('.ood-filters').addEventListener('click', (e) => {
      const chip = e.target.closest('[data-cat]');
      if (chip) this.setCat(chip.dataset.cat);
    });
    this.querySelector('thead').addEventListener('click', (e) => {
      const th = e.target.closest('[data-sort]');
      if (!th) return;
      const key = th.dataset.sort;
      this._sort = { key, dir: this._sort.key === key ? -this._sort.dir : 1 };
      this.paint();
    });
    this.paint();
  }

  _passed(band) {
    return band === 'A' || band === 'B';
  }

  _cell(metric, value) {
    if (value == null) {
      return '<td class="ood-num ood-pending"><span aria-label="not scored">—</span></td>';
    }
    if (metric.kind === 'gate') {
      const ok = this._passed(value);
      return `<td class="ood-num"><span class="ood-band ${ok ? 'is-pass' : 'is-fail'}"
                 title="${ok ? 'accepted' : 'rejected'}">${escapeHtml(value)}</span></td>`;
    }
    return `<td class="ood-num">${fmt(value)}</td>`;
  }

  paint() {
    const rows = this.filtered;
    const body = this.querySelector('tbody');
    const foot = this.querySelector('tfoot');

    for (const th of this.querySelectorAll('th[data-sort]')) {
      th.setAttribute('aria-sort',
        th.dataset.sort === this._sort.key
          ? (this._sort.dir === 1 ? 'ascending' : 'descending')
          : 'none');
    }

    body.innerHTML = rows.length
      ? rows
          .map(
            (r) => `<tr>
              <th scope="row" class="ood-th-name">${escapeHtml(r.title)}</th>
              <td><span class="ood-tag">${escapeHtml(r.category)}</span></td>
              ${this._metrics.map((m) => this._cell(m, (r.scores || {})[m.id])).join('')}
            </tr>`
          )
          .join('')
      : `<tr><td colspan="${2 + this._metrics.length}" class="ood-empty">No diagrams in this subject.</td></tr>`;

    const cells = this._metrics.map((m) => {
      const vals = rows.map((r) => (r.scores || {})[m.id]).filter((v) => v != null);
      if (!vals.length) return { html: '<td class="ood-num ood-pending">—</td>', n: 0 };
      if (m.kind === 'gate') {
        const passed = vals.filter((v) => this._passed(v)).length;
        return {
          n: vals.length,
          html: `<td class="ood-num"><b>${fmt(passed / vals.length)}</b></td>`,
        };
      }
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      return {
        n: vals.length,
        html: `<td class="ood-num"><b>${fmt(mean)}</b>${
          vals.length < rows.length ? `<small>n=${vals.length}</small>` : ''
        }</td>`,
      };
    });
    const summary = `
      <tr class="ood-sum">
        <th scope="row" class="ood-th-name">Mean</th>
        <td class="ood-sumnote">On Unfamiliar Diagrams</td>
        ${cells.map((c) => c.html).join('')}
      </tr>`;

    const ref = this._reference;
    const comparison =
      this._cat === ALL && ref
        ? `<tr class="ood-ref">
             <th scope="row" class="ood-th-name">${escapeHtml(ref.label)}</th>
             <td class="ood-sumnote">${escapeHtml(ref.sub || '')}</td>
             ${this._metrics
               .map((m) => {
                 const v = (ref.scores || {})[m.id];
                 return v == null
                   ? '<td class="ood-num ood-pending">—</td>'
                   : `<td class="ood-num"><b>${fmt(v)}</b></td>`;
               })
               .join('')}
           </tr>`
        : '';

    foot.innerHTML = summary + comparison;
  }
}

customElements.define('ood-table', OodTable);
