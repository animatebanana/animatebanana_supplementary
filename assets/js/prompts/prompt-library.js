import { escapeHtml as esc } from '../lib/format.js';
import { formatPrompt, inPlacePromptHTML } from '../lib/prompt-format.js';

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const GROUPS = [
  { label: 'Validity gates', keys: ['VF', 'ASC'] },
  { label: 'Sequence level', keys: ['SS', 'GP', 'NA'] },
];

class PromptLibrary extends HTMLElement {
  connectedCallback() {
    const src = this.getAttribute('src') || '';
    this.kind = this.getAttribute('kind') || 'generation';
    try { this.data = JSON.parse(document.querySelector(src).textContent); }
    catch { this.innerHTML = '<p class="pl-empty">The prompts could not be shown.</p>'; return; }

    this.items = this.kind === 'judge'
      ? GROUPS.flatMap((g) => g.keys.map((k) => ({ id: `prompt-${k}`, key: k, group: g.label, title: this.data[k].name, tag: k })))
      : this.data.styles.map((s, i) => ({ id: `prompt-${slug(s.style)}`, index: i, title: s.style }));
    this.promptStyle = this.kind === 'judge' ? this.data.styles[0] : null;

    let lastGroup = null;
    const rail = this.items.map((it) => {
      const head = it.group && it.group !== lastGroup ? `<li class="pl-group">${esc((lastGroup = it.group))}</li>` : '';
      return `${head}<li><button type="button" class="pl-item" data-item="${it.id}">
        <span>${esc(it.title)}</span>${it.tag ? `<b>${esc(it.tag)}</b>` : ''}</button></li>`;
    }).join('');
    this.innerHTML = `
      <div class="pl">
        <nav class="pl-rail" aria-label="${this.kind === 'judge' ? 'Judge prompts by metric' : 'Prompts by animation style'}">
          <ol>${rail}</ol>
        </nav>
        <article class="pl-panel">
          <header class="pl-head"><div><span class="pl-kicker" data-kicker></span><h3 data-title></h3></div></header>
          <div class="pl-main">
            <div class="pl-body pt" data-body tabindex="0"></div>
            ${this.kind === 'judge' ? `<aside class="pl-styles" aria-label="Style adapter">
              <span class="pl-styleshead">Style adapter</span>
              ${this.data.styles.map((s) => `<button type="button" class="pl-style" data-style="${esc(s)}">${esc(s)}</button>`).join('')}
            </aside>` : ''}
          </div>
        </article>
      </div>`;
    this.body = this.querySelector('[data-body]');
    this.addEventListener('click', (e) => {
      const it = e.target.closest('[data-item]');
      if (it) { this.show(it.dataset.item, true); return; }
      const st = e.target.closest('[data-style]');
      if (st) {
        this.promptStyle = st.dataset.style;
        const y = this.body.scrollTop;
        this.render();
        this.body.scrollTop = y;
        for (const el of this.body.querySelectorAll('.pd-filled.is-quiet, .pd-srow.is-adapted, .pd-stylename')) el.classList.add('is-swapped');
      }
    });
    for (const ev of ['copy', 'cut', 'contextmenu', 'dragstart', 'selectstart']) {
      this.body.addEventListener(ev, (e) => e.preventDefault());
    }
    const fromHash = this.items.find((it) => `#${it.id}` === location.hash);
    this.show(fromHash ? fromHash.id : this.items[0].id, false);
    if (fromHash) setTimeout(() => this.scrollIntoView({ block: 'start' }), 150);
    window.addEventListener('hashchange', () => {
      const it = this.items.find((x) => `#${x.id}` === location.hash);
      if (it && it.id !== this.cur?.id) this.show(it.id, false);
    });
  }

  show(id, user) {
    this.cur = this.items.find((it) => it.id === id);
    for (const b of this.querySelectorAll('[data-item]')) {
      const on = b.dataset.item === id;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-current', on ? 'true' : 'false');
    }
    if (user) history.replaceState(null, '', `#${id}`);
    this.render();
    this.body.scrollTop = 0;
  }

  render() {
    const it = this.cur;
    const kicker = this.querySelector('[data-kicker]');
    const title = this.querySelector('[data-title]');
    if (this.kind === 'judge') {
      const p = this.data[it.key];
      kicker.textContent = `Judge prompt · ${it.group}`;
      title.textContent = `${p.name} (${p.abbr})`;
      for (const b of this.querySelectorAll('[data-style]')) {
        const on = b.dataset.style === this.promptStyle;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      }
      this.body.innerHTML = inPlacePromptHTML(p, this.promptStyle);
      return;
    }
    const s = this.data.styles[it.index];
    kicker.textContent = 'Generation prompt';
    title.textContent = s.style;
    const rules = this.data.rules.replace(/^CRITICAL SYNCHRONIZATION RULES:/, '*** CRITICAL SYNCHRONIZATION RULES ***');
    this.body.innerHTML = `
      <section class="pl-instr">${formatPrompt(s.instruction)}</section>
      <section class="pl-rules">${formatPrompt(rules)}</section>`;
  }
}

customElements.define('prompt-library', PromptLibrary);
