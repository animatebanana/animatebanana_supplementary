import { loadJSON, onVisible, esc, reducedMotion } from './bench-core.js';
import { GLYPH } from './bench-glyphs.js';

/**
 * <bench-hero src="data/benchmark/hero.json"></bench-hero>
 *
 * The benchmark page's top card: the benchmark's scale, stated as three
 * facts — 5,000 samples, 5 animation styles, human-verified. Each fact is a
 * card of its own: drawn glyph, numeral, label, and one line of context.
 *
 * It used to be an equation (samples × styles = a product). That product is
 * gone: the row now states what the benchmark is rather than multiplying it
 * out, so there are no operators and no total.
 *
 * HUMAN VERIFICATION CARRIES NO COUNT, ON PURPOSE. Its term has `value: null`
 * in the JSON and renders nothing where the other two render a numeral. Do
 * not "fix" this by putting a number back — the absence is the statement.
 *
 * ONE LINE, ONE BASELINE. Every term renders the same four-part stack —
 * glyph, numeral, label, context — and both the glyph slot and the numeral
 * slot are fixed heights. Without those spacers the terms that carry a
 * drawing push their numeral down and the row stops being a row.
 *
 * Every number comes from the JSON, and it is the same file the overview
 * band reads, so correcting a count is one edit and both follow.
 */

const DURATION = 1400;

class BenchHero extends HTMLElement {
  async connectedCallback() {
    const src = this.getAttribute('src');
    if (!src) return;
    let data;
    try {
      data = await loadJSON(src);
    } catch {
      return; // the row introduces the panes below; never block them
    }
    this.className = 'bh';
    const terms = data.scale || [];
    if (!terms.length) return;

    // The glyph slot is always emitted, drawing or not — it is what keeps the
    // numerals on one line. See the note at the top of the file.
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

    // Same curve the overview band uses — 1.4s ease-out-quart at 40 %
    // visibility — so arriving here after seeing the band reads as the same
    // gesture rather than a second, different one.
    for (const el of this.querySelectorAll('[data-to]')) {
      onVisible(el, (n) => count(n), { threshold: 0.4 });
    }
  }
}

/** "5,000" -> 5000; anything unparseable counts as not countable. */
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
