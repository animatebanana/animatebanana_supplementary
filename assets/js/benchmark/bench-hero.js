import { loadJSON, onVisible, esc, reducedMotion } from './bench-core.js';
import { GLYPH } from './bench-glyphs.js';


const DURATION = 1400;

class BenchHero extends HTMLElement {
  async connectedCallback() {
    const src = this.getAttribute('src');
    if (!src) return;
    let data;
    try {
      data = await loadJSON(src);
    } catch {
      return;
    }
    this.className = 'bh';
    const terms = data.scale || [];
    if (!terms.length) return;

    const term = (t, i) => {
      const hasNum = t.value !== null && t.value !== undefined && t.value !== '';
      return `
      <li class="bh-term${hasNum ? '' : ' bh-term--mark'}" style="--i:${i}">
        <span class="bh-glyph"${t.art && GLYPH[t.art] ? '' : ' aria-hidden="true"'}>${
          t.art && GLYPH[t.art] ? GLYPH[t.art] : ''
        }</span>
        ${
          hasNum
            ? `<span class="bh-num num-outline" data-to="${esc(numeric(t.value))}">${esc(t.value)}</span>`
            : ''
        }
        <span class="bh-lab">${esc(t.label)}</span>
        ${t.sub ? `<span class="bh-sub">${esc(t.sub)}</span>` : ''}
      </li>`;
    };

    const intro = data.intro || {};
    this.innerHTML = `
      ${intro.kicker ? `<div class="bh-head"><span class="bx-eyebrow bh-kicker">${esc(intro.kicker)}</span></div>` : ''}
      <ol class="bh-eq">${terms.map(term).join('')}</ol>`;

    for (const el of this.querySelectorAll('[data-to]')) {
      onVisible(el, (n) => count(n), { threshold: 0.4 });
    }
  }
}

function numeric(value) {
  const n = Number(String(value).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function count(el) {
  const end = Number(el.dataset.to) || 0;
  if (!end) return;
  const paint = (n) => (el.textContent = n.toLocaleString('en-US'));
  if (reducedMotion()) {
    paint(end);
    return;
  }
  const t0 = performance.now();
  const tick = (now) => {
    const p = Math.min((now - t0) / DURATION, 1);
    paint(Math.round(end * (1 - (1 - p) ** 4)));
    if (p < 1) requestAnimationFrame(tick);
  };
  paint(0);
  requestAnimationFrame(tick);
}

customElements.define('bench-hero', BenchHero);
