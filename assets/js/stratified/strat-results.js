/**
 * <strat-results src="data/stratified/strata.json"></strat-results>
 *
 * The whole stratified-results section: one dropdown picks a figure property,
 * and three grouped bar charts redraw for it.
 *
 *   Gate pass rate       — Visual Fidelity, Style Compliance: the share of
 *                          samples in the group that cleared each gate
 *   Animation quality    — Selection Sensibility, Granularity & Pacing,
 *                          Narration Alignment
 *   Animated narrative   — the overall score, on its own
 *
 * THE GATES ARE COUNTED, NOT AVERAGED. Visual Fidelity and Style Compliance
 * are letter bands, and a band is a threshold: A or B passes, C or D fails,
 * and failing either one zeroes the sample's animated narrative score
 * outright. The 1–4 the workbook stores them as is a spreadsheet's way of
 * holding a letter, and it does not enter any arithmetic — build_strata.py
 * asserts that, row by row, before writing the data. An average of those
 * numbers therefore measured nothing: "3.77" is not three-quarters of
 * anything. What the gate does have is a pass rate, and that is what this
 * panel now draws.
 *
 * THREE CHARTS, NOT ONE. A pass rate is a share of samples and the quality
 * judgements are scores on 0–1; the two are not the same quantity even where
 * both happen to run 0–100%, and the headline score is kept out of the
 * quality panel so it is not read as a fourth judgement alongside its own
 * inputs. The three share the same groups, geometry and gridline rhythm, so
 * the eye still compares them panel for panel.
 *
 * COLOUR IS FIXED PER JUDGEMENT and assigned in a validated order (adjacent
 * pairs clear the colour-vision separation floor on this page's paper
 * surface). Do not recolour a series to match a mood, and do not add a
 * seventh — the order is the safety mechanism.
 *
 * Every number is read from strata.json, which is generated from the analysis
 * workbooks by data/stratified/build_strata.py. Nothing is computed here but
 * the bar heights.
 */

const ATTRIBUTES = [
  { key: 'density', label: 'Element density' },
  { key: 'connectivity', label: 'Connectivity' },
  { key: 'layout', label: 'Layout organization' },
  { key: 'depth', label: 'Hierarchical depth' },
  { key: 'raster', label: 'Raster content' },
];

/**
 * The chosen attribute lives in the hash so a reader can send "look at
 * connectivity" rather than a screenshot.
 *
 * It is prefixed, because this panel no longer has a page to itself: it sits at
 * the foot of animatebench.html, whose four benchmark panes deep-link through
 * the very same hash. An unprefixed `#connectivity` would be indistinguishable
 * from a pane id and, worse, writing one would silently wipe a pane anchor a
 * reader had been sent. `#strata-connectivity` cannot collide, and the page
 * glue knows to scroll to this section for anything carrying the prefix.
 */
const HASH_PREFIX = 'strata-';
/** Bare keys are still honoured, so links made before the merge keep working. */
function attrFromHash() {
  const raw = location.hash.slice(1);
  const key = raw.startsWith(HASH_PREFIX) ? raw.slice(HASH_PREFIX.length) : raw;
  return ATTRIBUTES.find((a) => a.key === key)?.key || '';
}

const PLOTS = [
  {
    key: 'gate',
    // `rate` reads counts out of `gate`, not means out of `metrics`, and is
    // labelled and explained as a share of samples throughout.
    kind: 'rate',
    title: 'Gate pass rate',
    min: 0,
    max: 1,
    ticks: [
      { v: 0, label: '0%' },
      { v: 0.25, label: '25%' },
      { v: 0.5, label: '50%' },
      { v: 0.75, label: '75%' },
      { v: 1, label: '100%' },
    ],
    step: 0.05,
    format: (v) => `${(v * 100).toFixed(1)}%`,
    series: [
      { key: 'vf', label: 'Visual fidelity', color: '#2a78d6' },
      { key: 'asc', label: 'Animation style compliance', color: '#eb6834' },
    ],
  },
  {
    key: 'quality',
    title: 'Animation quality scores',
    min: 0,
    max: 1,
    ticks: [
      { v: 0, label: '0' },
      { v: 0.25, label: '0.25' },
      { v: 0.5, label: '0.5' },
      { v: 0.75, label: '0.75' },
      { v: 1, label: '1' },
    ],
    step: 0.05,
    format: (v) => v.toFixed(3),
    series: [
      { key: 'ss', label: 'Selection sensibility', color: '#1baf7a' },
      { key: 'gp', label: 'Granularity & pacing', color: '#eda100' },
      { key: 'na', label: 'Narration alignment', color: '#e34948' },
    ],
  },
  {
    key: 'final',
    title: 'Animated narrative score',
    min: 0,
    max: 1,
    ticks: [
      { v: 0, label: '0' },
      { v: 0.25, label: '0.25' },
      { v: 0.5, label: '0.5' },
      { v: 0.75, label: '0.75' },
      { v: 1, label: '1' },
    ],
    step: 0.05,
    format: (v) => v.toFixed(3),
    series: [{ key: 'an', label: 'Animated narrative score', color: '#4a3aa7' }],
  },
];

/**
 * The axis window is a choice, and the two options trade off against each
 * other, so the switch says which is which rather than leaving the reader to
 * work out why the bars moved.
 */
const ZOOM_NOTE = {
  off: 'Each chart runs its judgement’s full range. Groups that differ by a few hundredths look identical.',
  on: 'Each chart starts just below its lowest bar, so small differences are visible.',
};

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

class StratResults extends HTMLElement {
  async connectedCallback() {
    const src = this.getAttribute('src');
    if (!src) return;
    try {
      const res = await fetch(src);
      this.data = await res.json();
    } catch (err) {
      console.error('[stratified] data failed to load', err);
      this.setAttribute('data-error', 'true');
      return;
    }

    this.attr = attrFromHash() || 'density';
    this.className = 'sr';
    // Full range is the default: the zoomed view is something a reader asks
    // for, not something they are shown without being told.
    this.zoom = false;
    this.renderShell();
    this.draw();
  }

  renderShell() {
    this.innerHTML = `
      <div class="sr-bar">
        <span class="sr-pick-lab" id="sr-pick-lab">Stratify by</span>
        <div class="sr-menu">
          <button type="button" class="sr-menu-btn" aria-haspopup="listbox"
                  aria-expanded="false" aria-labelledby="sr-pick-lab sr-menu-cur">
            <span class="sr-menu-cur" id="sr-menu-cur">${esc(this.attrLabel())}</span>
            <svg class="sr-caret" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 6.5 8 10.5l4-4" stroke="currentColor" stroke-width="2"
                    stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <ul class="sr-menu-list" role="listbox" aria-labelledby="sr-pick-lab" tabindex="-1" hidden>
            ${ATTRIBUTES.map(
      (a, i) => `
              <li role="option" id="sr-opt-${a.key}" data-key="${a.key}" style="--i:${i}"
                  aria-selected="${a.key === this.attr}">
                <svg class="sr-menu-tick" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M3 8.5 6.5 12 13 4.5" stroke="currentColor" stroke-width="2.2"
                        stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span>${esc(a.label)}</span>
              </li>`
    ).join('')}
          </ul>
        </div>

        <label class="sr-switch">
          <input type="checkbox" data-role="zoom">
          <span class="sr-switch-track" aria-hidden="true"><i></i></span>
          <span class="sr-switch-text">
            <b>Zoom the scale</b>
            <em data-role="zoom-note">${esc(ZOOM_NOTE.off)}</em>
          </span>
        </label>
      </div>
      <div class="sr-plots"></div>
      <div class="sr-tip" hidden></div>`;

    this.btn = this.querySelector('.sr-menu-btn');
    this.list = this.querySelector('.sr-menu-list');
    this.tip = this.querySelector('.sr-tip');
    this.wireZoom();
    this.wireMenu();
  }

  attrLabel(key = this.attr) {
    return ATTRIBUTES.find((a) => a.key === key).label;
  }

  /**
   * One bar's number, whichever kind of panel it belongs to.
   *
   * `v` is the bar height in the panel's own units; the rest is what the
   * readout and the table show. A rate has no median or spread, so it
   * carries only the share that passed, and nothing downstream invents a
   * statistic the gate does not have.
   */
  reading(plot, c, s) {
    if (plot.kind === 'rate') {
      return { v: c.gate[s.key].rate, rate: true };
    }
    const m = c.metrics[s.key];
    return { v: m.mean, median: m.median, std: m.std };
  }

  wireZoom() {
    const box = this.querySelector('[data-role="zoom"]');
    const note = this.querySelector('[data-role="zoom-note"]');
    box.checked = this.zoom;
    box.addEventListener('change', () => {
      this.zoom = box.checked;
      note.textContent = this.zoom ? ZOOM_NOTE.on : ZOOM_NOTE.off;
      this.draw();
    });
  }

  /**
   * The axis window for one panel.
   *
   * Off, it is the judgement's own full range, with the letter bands (or the
   * round quarters) the scale was designed around — the safe default,
   * because nothing is exaggerated and nothing is hidden.
   *
   * On, it is the tightest round window that still holds every bar in the
   * panel, one step of slack either side, so differences of a few
   * hundredths become readable. Each panel picks its own window: the three
   * are no longer comparable bar-height for bar-height, which is why the
   * window is printed under the chart rather than left for the reader to
   * infer from the axis. `step` is the judgement's own grain — quarter-band
   * for gating, 0.05 for the rest — so a zoomed axis never lands on a
   * value the scale does not use.
   */
  window(plot, classes) {
    if (!this.zoom) return { lo: plot.min, hi: plot.max, ticks: plot.ticks, zoomed: false };

    const r = (v) => Math.round(v * 1e6) / 1e6;
    const step = plot.step;
    const vals = classes.flatMap((c) => plot.series.map((s) => this.reading(plot, c, s).v));
    const lo = r(Math.max(plot.min, (Math.floor(Math.min(...vals) / step) - 1) * step));
    const hi = r(Math.min(plot.max, (Math.ceil(Math.max(...vals) / step) + 1) * step));

    // A window no tighter than the full range buys nothing; fall back rather
    // than relabel the same axis.
    if (hi - lo < step || (lo <= plot.min && hi >= plot.max)) {
      return { lo: plot.min, hi: plot.max, ticks: plot.ticks, zoomed: false };
    }

    // At most five gridlines, spaced a whole number of steps apart, with the
    // top of the window always labelled.
    const steps = Math.round((hi - lo) / step);
    const every = Math.max(1, Math.ceil(steps / 4));
    const ticks = [];
    for (let i = 0; i <= steps; i += every) {
      const v = r(lo + i * step);
      ticks.push({ v, label: plot.format(v) });
    }
    if (ticks[ticks.length - 1].v < hi) ticks.push({ v: hi, label: plot.format(hi) });

    return { lo, hi, ticks, zoomed: true };
  }

  /**
   * A hand-built listbox rather than a native <select>, because a native one
   * cannot be styled to match the rest of the page. It keeps the parts that
   * matter: roles the screen reader understands, arrow keys, Home/End,
   * Escape, type-ahead by first letter, and focus returning to the button.
   */
  wireMenu() {
    const options = [...this.list.querySelectorAll('[role="option"]')];

    const open = (focusKey = this.attr) => {
      this.list.hidden = false;
      this.btn.setAttribute('aria-expanded', 'true');
      this.list.classList.add('is-open');
      this.focusOption(options.find((o) => o.dataset.key === focusKey) || options[0]);
    };
    const close = ({ refocus = true } = {}) => {
      if (this.list.hidden) return;
      this.list.classList.remove('is-open');
      this.list.hidden = true;
      this.btn.setAttribute('aria-expanded', 'false');
      if (refocus) this.btn.focus();
    };
    this.closeMenu = close;

    const pick = (el) => {
      this.attr = el.dataset.key;
      for (const o of options) o.setAttribute('aria-selected', String(o === el));
      this.querySelector('.sr-menu-cur').textContent = this.attrLabel();
      history.replaceState(null, '', `#${HASH_PREFIX}${this.attr}`);
      close();
      this.draw();
    };

    this.btn.addEventListener('click', () => (this.list.hidden ? open() : close()));
    this.btn.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    });

    for (const o of options) {
      o.addEventListener('click', () => pick(o));
      o.addEventListener('pointerenter', () => this.focusOption(o));
    }

    this.list.addEventListener('keydown', (e) => {
      const at = options.indexOf(this.active);
      const go = (i) => {
        e.preventDefault();
        this.focusOption(options[(i + options.length) % options.length]);
      };
      if (e.key === 'ArrowDown') go(at + 1);
      else if (e.key === 'ArrowUp') go(at - 1);
      else if (e.key === 'Home') go(0);
      else if (e.key === 'End') go(options.length - 1);
      else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        pick(this.active);
      } else if (e.key === 'Escape' || e.key === 'Tab') close();
      else if (/^[a-z]$/i.test(e.key)) {
        const hit = options.find((o) => o.textContent.trim().toLowerCase().startsWith(e.key.toLowerCase()));
        if (hit) go(options.indexOf(hit));
      }
    });

    document.addEventListener('pointerdown', (e) => {
      if (!this.contains(e.target)) close({ refocus: false });
    });
  }

  focusOption(el) {
    if (!el) return;
    for (const o of this.list.children) o.classList.toggle('is-active', o === el);
    this.active = el;
    this.list.setAttribute('aria-activedescendant', el.id);
    this.list.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'nearest' });
  }

  draw() {
    const classes = this.data.attributes[this.attr];

    this.querySelector('.sr-plots').innerHTML = PLOTS.map((plot, pi) => {
      // The judgement's own full range by default; the zoom switch trades
      // that for a window tight around this panel's bars. Either way the
      // window is declared, never silently truncated.
      const win = this.window(plot, classes);
      const lo = win.lo;
      const hi = win.hi;
      const span = hi - lo;
      const ticks = win.ticks;
      // Every bar is labelled, including in the crowded views. Where a
      // horizontal number would be wider than the bar it belongs to, the
      // labels turn on their side and the plot gives up more of its top to
      // them — narrow enough to stay one-per-bar, and still read left to
      // right in the same order as the bars.
      // `many` is a property of the view, not of one panel, so the label
      // strip is the same height in all three and their gridlines stay on
      // one rhythm; only the panels whose bars are actually narrow turn
      // their labels.
      const many = classes.length > 4;
      const crowded = many && plot.series.length > 1;
      // The tick labels are positioned absolutely, so they contribute no
      // width of their own and the axis column would collapse to nothing —
      // which pushed a zoomed axis's longer numbers out through the side of
      // the panel. The column is sized here from the longest label it has to
      // carry, in the mono `ch` the ticks are actually set in.
      const axisCh = Math.max(...ticks.map((t) => String(t.label).length)) + 0.6;
      // Bars are rendered flat and grown on the next frame, in reading order,
      // so a redraw reads as the new numbers arriving rather than as a swap.
      let slot = -1;

      const grid = ticks
        .map(
          (t) =>
            `<span class="sr-line${t.v === lo ? ' is-base' : ''}" style="--y:${(t.v - lo) / span
            }"></span>`
        )
        .join('');

      const axis = ticks
        .map(
          (t) =>
            `<span class="sr-tick" style="--y:${(t.v - lo) / span}">${esc(t.label)}</span>`
        )
        .join('');

      const groups = classes
        .map((c) => {
          const bars = plot.series
            .map((s) => {
              const d = this.reading(plot, c, s);
              const p = Math.max(0, Math.min(1, (d.v - lo) / span));
              const rate = plot.kind === 'rate';
              slot += 1;
              return `
                <span class="sr-slot" style="--c:${s.color};--d:${slot}"
                      data-series="${esc(s.label)}"
                      data-group="${esc(c.label)}"
                      data-mean="${plot.format(d.v)}"
                      ${rate
          ? 'data-rate="1"'
          : `data-median="${plot.format(d.median)}" data-std="${d.std.toFixed(3)}"`
        }
                      tabindex="0" role="img"
                      aria-label="${esc(c.label)}, ${esc(s.label)}: ${rate
          ? `${plot.format(d.v)} passed`
          : `average ${plot.format(d.v)}`
        }">
                  <em class="sr-val">${plot.format(d.v)}</em>
                  <span class="sr-fill" data-p="${p.toFixed(4)}"></span>
                </span>`;
            })
            .join('');
          return `
            <div class="sr-group">
              <div class="sr-cluster">${bars}</div>
              <div class="sr-glabel"><b>${esc(c.short)}</b></div>
            </div>`;
        })
        .join('');

      return `
        <figure class="sr-plot sr-plot--${plot.key}${crowded ? ' is-crowded' : ''} reveal"
                style="--reveal-delay:${pi * 90}ms;--axis-w:${axisCh}ch;--head:${many ? 46 : 22}px">
          <figcaption class="sr-head">
            <h2 class="sr-title">${esc(plot.title)}</h2>
            <!-- One series needs no legend: the title names it. The list is
                 still emitted, empty, because its reserved height is what keeps
                 the three panels' plot areas on one line. -->
            <ul class="sr-legend"${plot.series.length > 1 ? '' : ' aria-hidden="true"'}>
              ${plot.series.length > 1
          ? plot.series
            .map((s) => `<li style="--c:${s.color}"><i></i>${esc(s.label)}</li>`)
            .join('')
          : ''
        }
            </ul>
          </figcaption>
          <div class="sr-canvas">
            <div class="sr-yaxis">${axis}</div>
            <div class="sr-field">
              <div class="sr-grid">${grid}</div>
              <div class="sr-groups" data-cols="${classes.length}">${groups}</div>
            </div>
          </div>
          ${win.zoomed
          ? `<p class="sr-zoom-note">Axis ${esc(plot.format(lo))} – ${esc(plot.format(hi))}, not the full ${esc(plot.format(plot.min))} – ${esc(plot.format(plot.max))}</p>`
          : ''
        }
          <details class="sr-table">
            <summary>Numbers</summary>
            ${this.table(plot, classes)}
          </details>
        </figure>`;
    }).join('');

    for (const slot of this.querySelectorAll('.sr-slot')) {
      slot.addEventListener('pointerenter', (e) => this.showTip(e.currentTarget));
      // The readout follows the pointer off the bar immediately. Relying on
      // the host's pointerleave alone left it hanging over the next bar.
      slot.addEventListener('pointerleave', () => this.hideTip());
      slot.addEventListener('focus', (e) => this.showTip(e.currentTarget));
      slot.addEventListener('blur', () => this.hideTip());
    }

    this.grow();
  }

  /** Grow the bars from the baseline once the browser has laid them out. */
  grow() {
    const fills = [...this.querySelectorAll('.sr-fill')];
    const paint = () => {
      for (const f of fills) f.style.setProperty('--p', f.dataset.p);
    };
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      paint();
      return;
    }
    this.classList.add('is-growing');
    requestAnimationFrame(() => requestAnimationFrame(paint));
  }

  table(plot, classes) {
    return `
      <div class="sr-table-scroll">
      <table>
        <thead>
          <tr><th scope="col">Group</th>
            ${plot.series.map((s) => `<th scope="col">${esc(s.label)}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${classes
        .map((c) => {
          const cells = plot.series
            .map((s) => {
              const d = this.reading(plot, c, s);
              return `<td>${esc(plot.format(d.v))}</td>`;
            })
            .join('');
          return `<tr><th scope="row">${esc(c.label)}</th>${cells}</tr>`;
        })
        .join('')}
        </tbody>
      </table>
      </div>`;
  }

  showTip(el) {
    const d = el.dataset;
    this.tip.innerHTML = `
      <b class="sr-tip-head"><i style="--c:${el.style.getPropertyValue('--c')}"></i>${esc(d.series)}</b>
      <span class="sr-tip-group">${esc(d.group)}</span>
      <dl>
        ${d.rate !== undefined
        ? `<dt>Pass rate</dt><dd>${esc(d.mean)}</dd>`
        : `<dt>Average</dt><dd>${esc(d.mean)}</dd>
           <dt>Median</dt><dd>${esc(d.median)}</dd>
           <dt>Spread</dt><dd>± ${esc(d.std)}</dd>`
      }
      </dl>`;
    this.tip.hidden = false;
    const r = el.getBoundingClientRect();
    const host = this.getBoundingClientRect();
    const t = this.tip.getBoundingClientRect();

    let x = r.left - host.left + r.width / 2 - t.width / 2;
    x = Math.max(4, Math.min(x, host.width - t.width - 4));

    // Hangs BELOW the top of the bar it describes. Above was the obvious
    // choice and the wrong one: these bars start high in their plot, so the
    // readout landed on the panel's own title, or on the control bar above
    // the whole section. It only flips up for a bar too short to hang from.
    const bar = el.querySelector('.sr-fill');
    const barTop = (bar || el).getBoundingClientRect().top - host.top;
    const below = barTop + 14;
    const y =
      below + t.height <= host.height - 4 ? below : Math.max(4, barTop - t.height - 10);

    this.tip.style.left = `${x}px`;
    this.tip.style.top = `${y}px`;
  }

  hideTip() {
    if (this.tip) this.tip.hidden = true;
  }
}

customElements.define('strat-results', StratResults);