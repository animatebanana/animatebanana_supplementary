/**
 * <prompt-library src="#element-id">
 *
 * A shelf of prompts: a list on the left, the chosen prompt on the right in a
 * scrollable reading panel. The prompt text is embedded in the page itself (a
 * <script type="application/json"> element named by `src`); there is no
 * separate prompt file. It holds one instruction per animation style plus the
 * rules every style's prompt ends with, and is laid out by
 * lib/prompt-format.js (headings and lists, without Markdown marks). The
 * wording is exactly what is embedded.
 *
 * The chosen style is mirrored into the hash (#prompt-alpha-masking) so a
 * single prompt can be linked to. Copying from the panel is refused (a
 * deterrent only).
 */
import { escapeHtml as esc } from '../lib/format.js';
import { formatPrompt } from '../lib/prompt-format.js';

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

class PromptLibrary extends HTMLElement {
  connectedCallback() {
    const src = this.getAttribute('src') || '';
    try { this.data = JSON.parse(document.querySelector(src).textContent); }
    catch { this.innerHTML = '<p class="pl-empty">The prompts could not be shown.</p>'; return; }

    this.items = this.data.styles.map((s, i) => ({ id: `prompt-${slug(s.style)}`, index: i, title: s.style }));
    this.innerHTML = `
      <div class="pl">
        <nav class="pl-rail" aria-label="Prompts by animation style">
          <ol>${this.items.map((it) => `<li><button type="button" class="pl-item" data-item="${it.id}">
            <span>${esc(it.title)}</span></button></li>`).join('')}</ol>
        </nav>
        <article class="pl-panel">
          <header class="pl-head"><div><span class="pl-kicker">Generation prompt</span><h3 data-title></h3></div></header>
          <div class="pl-body pt" data-body tabindex="0"></div>
        </article>
      </div>`;
    this.body = this.querySelector('[data-body]');
    this.addEventListener('click', (e) => {
      const it = e.target.closest('[data-item]');
      if (it) this.show(it.dataset.item, true);
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
    const s = this.data.styles[this.cur.index];
    this.querySelector('[data-title]').textContent = s.style;
    // The rules' own first line ("CRITICAL SYNCHRONIZATION RULES:") is shown as their heading.
    const rules = this.data.rules.replace(/^CRITICAL SYNCHRONIZATION RULES:/, '*** CRITICAL SYNCHRONIZATION RULES ***');
    this.body.innerHTML = `
      <section class="pl-instr">${formatPrompt(s.instruction)}</section>
      <section class="pl-rules">${formatPrompt(rules)}</section>`;
    this.body.scrollTop = 0;
  }
}

customElements.define('prompt-library', PromptLibrary);
