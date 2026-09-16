import { loadJSON, onVisible, esc, icon, reducedMotion } from './bench-core.js';
import { GLYPH } from './bench-glyphs.js';

/**
 * <bench-hero src="data/benchmark/hero.json"></bench-hero>
 *
 * The benchmark page's top row: the scale equation (5,000 diagrams × 5 styles
 * = 25,000 narratives) and the human-verified count beside it.
 *
 * This is the first thing on the page the whole appendix is about, and it used
 * to be the quietest — a thin rule of small numerals, while the teaser for the
 * same figures on the overview page was a band of counted-up display numerals
 * with drawn glyphs. The page you arrive at should not be a downgrade from the
 * card that sent you, so the row carries the band's treatment: the same
 * glyphs, the same hatched display numerals, the same count-up on entry — with
 * the operators the band has no use for, because here the numbers are an
 * argument (this many, times this many, gives this many) and not four
 * independent facts.
 *
 * ONE LINE, ONE BASELINE. Every term renders the same three-part stack —
 * glyph, numeral, label — even when it has no glyph of its own, and the glyph
 * slot is a fixed height. Without that spacer the terms that carry a drawing
 * push their numeral down and the total's numeral floats alone above them,
 * which is not an equation, it is three numbers at three heights. The verified
 * count sits at the end of the same row, set small: it qualifies the 25,000,
 * it is not a fourth headline figure, and it should not read like one.
 *
 * Every number comes from the JSON, and it is the same file the band reads, so
 * correcting a count is one edit and both follow.
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
    const { equation = [], verified } = data;

    // The glyph slot is always emitted, drawing or not — it is what keeps the
    // three numerals on one line. See the note at the top of the file.
    const term = (t, i) => `
      <li class="bh-term${t.wide ? ' bh-term--hero' : ''}" style="--i:${i}">
        <span class="bh-glyph"${t.art && GLYPH[t.art] ? '' : ' aria-hidden="true"'}>${
          t.art && GLYPH[t.art] ? GLYPH[t.art] : ''
        }</span>
        <span class="bh-num num-outline" data-to="${esc(numeric(t.value))}">${esc(t.value)}</span>
        <span class="bh-lab">${esc(t.label)}</span>
      </li>`;

    this.innerHTML = `
      <ol class="bh-eq">
        ${equation
          .map((t, i) =>
            t.kind === 'op'
              ? `<li class="bh-op" aria-hidden="true">${esc(t.value)}</li>`
              : term(t, i)
          )
          .join('')}
      </ol>
      ${
        verified
          ? `<aside class="bh-verified">
               <span class="bh-glyph bh-glyph--verified" aria-hidden="true">${GLYPH.verified}</span>
               <span class="bh-verified-text">
                 <span class="bh-verified-top">
                   <b class="bh-verified-num" data-to="${esc(numeric(verified.value))}">${esc(verified.value)}</b>
                   <span class="bh-verified-lab">${esc(verified.label)}</span>
                 </span>
                 ${
                   verified.note
                     ? `<em class="bh-verified-note">${icon('check', 'bh-check')}${esc(verified.note)}</em>`
                     : ''
                 }
               </span>
             </aside>`
          : ''
      }`;

    // Same curve the overview band uses — 1.4s ease-out-quart at 40 %
    // visibility — so arriving here after seeing the band reads as the same
    // gesture rather than a second, different one.
    for (const el of this.querySelectorAll('[data-to]')) {
      onVisible(el, (n) => count(n), { threshold: 0.4 });
    }
  }
}

/** "25,000" -> 25000; anything unparseable counts as not countable. */
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
