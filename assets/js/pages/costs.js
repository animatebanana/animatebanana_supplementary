import { loadJSON } from '../lib/data-loader.js';

/**
 * costs.html — calls and latency of the AnimateBanana pipeline,
 * measured on a sample set of 91 diagrams. Everything drawn or quoted
 * here comes from data/latency.json, which COST_LATENCY/build_latency.py
 * builds from COST_LATENCY/latency_per_sample.xlsx.
 *
 * The charts are SVG sized to their container (re-drawn when it
 * resizes, so text stays legible on a phone) or plain HTML. Each:
 *   - animates in when first scrolled into view, and on every change of
 *     view (points glide rather than jump);
 *   - carries a hover/focus tooltip on every mark;
 *   - offers a "Show as a table" view of the same numbers;
 *   - is followed by insight cards whose numbers are computed, not typed.
 *
 * Stage colours are fixed across the site: Diagram Transmuter yellow,
 * Animation Planner green, Diagram Animator light blue. Generators are
 * drawn as circles or solid fills, critics as diamonds or hatched fills.
 */

/* ================================================================ *
 * Utilities
 * ================================================================ */

const fmt = (n, d = 0) => Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (part, whole) => (part / whole) * 100;
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const SVGNS = 'http://www.w3.org/2000/svg';
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => 1 - (1 - t) ** 3;
const mins = (s) => `${fmt(s / 60, 1)} min`;
const secs = (s) => `${fmt(s)} s`;

function svgEl(tag, attrs = {}, parent) {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}

/** Run `step(t)` with eased t from 0 to 1 over `dur` ms (instantly if motion is unwelcome). */
function tween(dur, step) {
  if (reduced) return step(1);
  const t0 = performance.now();
  const frame = (now) => {
    const t = Math.min(1, (now - t0) / dur);
    step(ease(t));
    if (t < 1) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

/** A round step for an axis that will hold values up to `max`. */
function niceStep(max, count = 5) {
  const raw = max / count;
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
}
function axisFor(max, count = 5) {
  const step = niceStep(max, count);
  const top = Math.ceil(max / step - 1e-9) * step;
  const ticks = [];
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(+v.toFixed(6));
  return { top, ticks };
}

/** Deterministic jitter in [-1, 1] from a string, so dots never reshuffle between draws. */
function jitter(s) {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return ((h >>> 0) % 2001) / 1000 - 1;
}

/** Call `fn(width)` now and whenever the element's width changes. */
function onWidth(el, fn) {
  let last = 0;
  const run = () => {
    const w = Math.round(el.clientWidth);
    if (w && Math.abs(w - last) > 4) {
      last = w;
      fn(w);
    }
  };
  if ('ResizeObserver' in window) new ResizeObserver(run).observe(el);
  else window.addEventListener('resize', run);
  run();
}

/** An axis title; on a narrow chart it breaks onto two lines at " · ". */
function axisTitle(svg, text, W) {
  const t = svgEl('text', { x: 0, y: 14, class: 'fl-axis-title' }, svg);
  const parts = W < 560 ? text.split(' · ') : [text];
  parts.forEach((ln, k) => (svgEl('tspan', { x: 0, dy: k ? 13 : 0 }, t).textContent = ln));
  return t;
}

const attr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const tip = (html) => `data-tip="${attr(html)}" tabindex="0"`;
function setTip(el, html) {
  el.setAttribute('data-tip', html);
  el.setAttribute('tabindex', '0');
}

function tableView(headers, rows, note = '') {
  return `
    <details class="cl-table">
      <summary>Show as a table</summary>
      <div class="cl-table-scroll">
        <table>
          <thead><tr>${headers.map((h, i) => `<th${i ? ' class="num"' : ''}>${h}</th>`).join('')}</tr></thead>
          <tbody>${rows
            .map((r) => `<tr>${r.map((c, i) => `<td${i ? ' class="num"' : ''}>${c}</td>`).join('')}</tr>`)
            .join('')}</tbody>
        </table>
      </div>
      ${note ? `<p class="cl-table-note">${note}</p>` : ''}
    </details>`;
}

function legend(items) {
  return `<div class="cl-legend">${items
    .map((it) => `<span class="cl-legend-item"><i class="cl-swatch ${it.cls || ''}"></i>${it.label}</span>`)
    .join('')}</div>`;
}
const stageLegend = (d, extra = []) =>
  legend([...d.stages.map((s) => ({ label: `${s.label} · ${s.name}`, cls: `cl-st-${s.id}` })), ...extra]);

function toggle(group, options, active) {
  return `<div class="cl-toggle" role="group" data-group="${group}">${options
    .map(([v, label]) => `<button type="button" data-value="${v}" aria-pressed="${v === active}">${label}</button>`)
    .join('')}</div>`;
}
function wireToggles(root, onChange) {
  for (const group of root.querySelectorAll('.cl-toggle')) {
    group.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn || btn.getAttribute('aria-pressed') === 'true') return;
      pressToggle(root, group.dataset.group, btn.dataset.value);
      onChange(group.dataset.group, btn.dataset.value);
    });
  }
}
function pressToggle(root, group, value) {
  root.querySelectorAll(`.cl-toggle[data-group="${group}"] button`).forEach((b) =>
    b.setAttribute('aria-pressed', String(b.dataset.value === value))
  );
}

const stageChip = (s) => `<span class="cl-stage-chip cl-st-${s.id}">${s.label.replace('Stage ', '')}</span>`;

/** One figure per stage, each in its stage's chip: reads as three values, not one number. */
const trio = (d, vals, f) =>
  `<span class="cl-trio">${d.stages
    .map((s, i) => `<span class="cl-trio-i cl-st-${s.id}"><i>${s.label.replace('Stage ', 'S')}</i>${f(vals[i])}</span>`)
    .join('')}</span>`;

/** Insight cards under a chart: a big figure, a label, a sentence. */
function insights(cards) {
  return `<div class="cl-insights">${cards
    .map(
      (c, i) => `
      <div class="cl-insight ${c.cls || `cl-wash-${i % 6}`}" style="--i:${i}">
        <div class="cl-insight-big">${c.big}</div>
        <div class="cl-insight-k">${c.k}</div>
        <p>${c.text}</p>
      </div>`
    )
    .join('')}</div>`;
}

/* ================================================================ *
 * Section symbols
 * ================================================================ */

const GLYPHS = {
  layers: `
    <path class="g-l g-l3" d="M24 30 8 22.5 24 15l16 7.5Z"/>
    <path class="g-l g-l2 g-fill" d="M24 24.5 8 17 24 9.5 40 17Z"/>
    <path class="g-l g-l1" d="M8 29.5 24 37l16-7.5M8 35.5 24 43l16-7.5"/>`,
  wallet: `
    <path d="M9 15h27a3 3 0 0 1 3 3v17a3 3 0 0 1-3 3H11a3 3 0 0 1-3-3V16"/>
    <path d="M8 16a3 3 0 0 1 3-3h22v2"/>
    <rect class="g-fill" x="29" y="22" width="11" height="8" rx="2.5"/>
    <circle class="g-coin" cx="33.5" cy="26" r="1.6" fill="currentColor"/>`,
  coins: `
    <ellipse cx="24" cy="38" rx="13" ry="4.4"/><path d="M11 38v-5.5M37 38v-5.5"/>
    <ellipse cx="24" cy="32.5" rx="13" ry="4.4"/><path d="M11 32.5V27M37 32.5V27"/>
    <ellipse class="g-fill" cx="24" cy="27" rx="13" ry="4.4"/>
    <g class="g-drop"><circle class="g-fill" cx="24" cy="11" r="6.5"/><path d="M24 7.8v6.4"/></g>`,
  signal: `
    <circle class="g-fill" cx="24" cy="29" r="4.2"/><path d="M24 33.2V42M18 42h12"/>
    <path class="g-w g-w1" d="M17.5 22.5a9.2 9.2 0 0 1 13 0"/>
    <path class="g-w g-w2" d="M12.6 17.6a16 16 0 0 1 22.8 0"/>
    <path class="g-w g-w3" d="M7.8 12.8a22.8 22.8 0 0 1 32.4 0"/>`,
  stopwatch: `
    <path d="M19.5 5h9M24 5v5.5M35.5 12.5l2.6-2.6"/>
    <circle cx="24" cy="27" r="15.5"/>
    <path d="M24 13.5v2.2M24 38.3v2.2M10.5 27h2.2M35.3 27h2.2"/>
    <path class="g-wedge g-fill" d="M24 27V14.6A12.4 12.4 0 0 1 35.8 23.2Z" stroke="none"/>
    <g class="g-hand"><path d="M24 27V15.5"/></g>
    <circle cx="24" cy="27" r="2" fill="currentColor"/>`,
  grow: `
    <path d="M7 41h34"/>
    <rect class="g-bar g-b1 g-fill" x="10" y="29" width="7" height="12" rx="1.5"/>
    <rect class="g-bar g-b2 g-fill" x="20.5" y="21" width="7" height="20" rx="1.5"/>
    <rect class="g-bar g-b3 g-fill" x="31" y="11" width="7" height="30" rx="1.5"/>`,
};
function mountGlyphs() {
  for (const el of document.querySelectorAll('[data-glyph]')) {
    const g = GLYPHS[el.dataset.glyph];
    if (!g) continue;
    el.innerHTML = `<svg class="cl-glyph" viewBox="0 0 48 48" width="32" height="32" aria-hidden="true" fill="none"
      stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${g}</svg>`;
  }
}

/* ================================================================ *
 * The flow chart: a line through the pipeline, by stage or by agent
 * ================================================================ */

/**
 * One line across the pipeline. "By stage" plots each stage's total (the
 * sum over its agents); "By agent" opens every stage into its agents, and
 * the points glide apart. A dashed second line traces the three critics,
 * one per stage, so their trend across the pipeline reads on its own.
 *
 * `metric(kind, entity, stat)` returns the value to plot, where kind is
 * 'stage' or 'agent'.
 */
function flowChart(host, d, o) {
  const state = { mode: 'stages', stat: o.stats[0][0], crit: 'on' };
  const stageIdx = Object.fromEntries(d.stages.map((s, i) => [s.id, i]));
  const agents = d.agents;
  const critics = agents.filter((a) => a.role === 'critic');

  host.innerHTML = `
    <div class="cl-controls">
      ${toggle('mode', [['stages', 'By stage'], ['agents', 'By agent']], 'stages')}
      ${o.stats.length > 1 ? toggle('stat', o.stats, state.stat) : ''}
      ${toggle('crit', [['on', 'Trace the critics'], ['off', 'Hide critic trace']], 'on')}
    </div>
    ${stageLegend(d, [
      { label: 'Other agents', cls: 'cl-swatch-dot' },
      { label: 'Critic', cls: 'cl-swatch-diamond' },
    ])}
    <div class="cl-svgbox cl-flow"></div>
    <p class="cl-chart-hint">Click a stage to open it into its agents.</p>
    ${o.table}`;
  const box = host.querySelector('.cl-flow');

  // The axis holds every value any view can show, so it never jumps; when
  // the views are in different units (tokens vs dollars), each gets its own.
  // ± 1 SD whiskers, when the chart has spreads to show (the token chart does not).
  const sdOf = (kind, e, stat) => (o.sd ? o.sd(kind, e, stat) || 0 : 0);
  const axisOf = (stat) => {
    const all = [];
    for (const [st] of o.stats) {
      if (o.axisPerStat && st !== stat) continue;
      d.stages.forEach((s) => all.push(o.metric('stage', s, st) + sdOf('stage', s, st)));
      agents.forEach((a) => all.push(o.metric('agent', a, st) + sdOf('agent', a, st)));
    }
    return axisFor(Math.max(...all) * 1.08);
  };
  let yAxis = axisOf(state.stat);

  let W = 0;
  let H = 0;
  let M = null;
  let els = null;
  let geo = null;
  // Too narrow for nine labels side by side: angle them, and leave the numbers to the tooltips.
  let narrow = false;

  const y = (v) => M.t + (H - M.t - M.b) * (1 - v / yAxis.top);

  /** A point, with the pixel ends of its ± 1 SD whisker. */
  const pt = (x, kind, e, stat) => {
    const v = o.metric(kind, e, stat);
    const sd = sdOf(kind, e, stat);
    return { x, y: y(v), lo: y(Math.max(0, v - sd)), hi: y(v + sd) };
  };

  function geometry(mode, stat) {
    const pw = W - M.l - M.r;
    const n = agents.length;
    const pts = [];
    const bands = [];
    const crit = [];
    if (mode === 'agents') {
      const sw = pw / n;
      agents.forEach((a, i) => pts.push(pt(M.l + (i + 0.5) * sw, 'agent', a, stat)));
      d.stages.forEach((s) => {
        const idx = agents.map((a, i) => (a.stage === s.id ? i : -1)).filter((i) => i >= 0);
        bands.push({ x: M.l + idx[0] * sw, w: (idx.length) * sw });
      });
      critics.forEach((c) => crit.push({ ...pts[agents.indexOf(c)] }));
    } else {
      const sw = pw / d.stages.length;
      agents.forEach((a) => {
        const j = stageIdx[a.stage];
        pts.push(pt(M.l + (j + 0.5) * sw, 'stage', d.stages[j], stat));
      });
      d.stages.forEach((s, j) => bands.push({ x: M.l + j * sw, w: sw }));
      critics.forEach((c) => crit.push(pt(M.l + (stageIdx[c.stage] + 0.5) * sw, 'agent', c, stat)));
    }
    return { pts, bands, crit, mix: mode === 'agents' ? 1 : 0 };
  }

  const mixPt = (p, q, t) => ({ x: lerp(p.x, q.x, t), y: lerp(p.y, q.y, t), lo: lerp(p.lo, q.lo, t), hi: lerp(p.hi, q.hi, t) });
  const mixGeo = (a, b, t) => ({
    pts: a.pts.map((p, i) => mixPt(p, b.pts[i], t)),
    bands: a.bands.map((p, i) => ({ x: lerp(p.x, b.bands[i].x, t), w: lerp(p.w, b.bands[i].w, t) })),
    crit: a.crit.map((p, i) => mixPt(p, b.crit[i], t)),
    mix: lerp(a.mix, b.mix, t),
  });

  const line = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('');

  // First agent of each stage stands for the stage when the view is closed.
  const lead = new Set(d.stages.map((s) => agents.findIndex((a) => a.stage === s.id)));

  const whisker = (p) =>
    !o.sd ? '' : p.lo - p.hi < 1 ? `M${p.x - 12},${p.y}h24` : `M${p.x},${p.hi}V${p.lo}M${p.x - 5},${p.hi}h10M${p.x - 5},${p.lo}h10`;

  function paint(g) {
    els.path.setAttribute('d', line(g.pts));
    g.pts.forEach((p, i) => els.err[i].setAttribute('d', whisker(p)));
    g.crit.forEach((p, i) => {
      els.critErr[i].setAttribute('d', whisker({ ...p, x: p.x }));
      // The critic's own value, beside its diamond; in the opened view the
      // agent's point already carries it.
      els.critVals[i].setAttribute('x', p.x + 15);
      els.critVals[i].setAttribute('y', p.y + 4);
      els.critVals[i].setAttribute('opacity', 1 - g.mix);
      els.critErr[i].setAttribute('opacity', 1 - g.mix);
    });
    els.critPath.setAttribute('d', line(g.crit));
    g.bands.forEach((b, j) => {
      els.bands[j].setAttribute('x', b.x);
      els.bands[j].setAttribute('width', Math.max(0, b.w));
      els.bandHits[j].setAttribute('x', b.x);
      els.bandHits[j].setAttribute('width', Math.max(0, b.w));
      const s = d.stages[j];
      els.bandTitles[j].setAttribute('x', b.x + b.w / 2);
      els.bandTitles[j].textContent = b.w > 190 ? `${s.label} · ${s.name}` : s.label;
      els.expand[j].setAttribute('x', b.x + b.w / 2);
      els.expand[j].setAttribute('opacity', 1 - g.mix);
      if (j) els.dividers[j - 1].setAttribute('x1', b.x), els.dividers[j - 1].setAttribute('x2', b.x);
    });
    g.pts.forEach((p, i) => {
      els.pts[i].setAttribute('transform', `translate(${p.x},${p.y})`);
      const show = lead.has(i) ? (narrow ? 1 - g.mix : 1) : narrow ? 0 : g.mix;
      els.vals[i].setAttribute('x', p.x);
      // Above the whisker's top, so the SD bar never runs through the label.
      els.vals[i].setAttribute('y', Math.min(p.y - 14, p.hi - 7));
      els.vals[i].setAttribute('opacity', show);
      els.xl[i].setAttribute('opacity', g.mix);
    });
    g.crit.forEach((p, i) => els.crit[i].setAttribute('transform', `translate(${p.x},${p.y})`));
  }

  function values() {
    const stat = state.stat;
    agents.forEach((a, i) => {
      const s = d.stages[stageIdx[a.stage]];
      const [kind, e] = state.mode === 'agents' ? ['agent', a] : ['stage', s];
      const v = o.metric(kind, e, stat);
      els.vals[i].textContent = o.pm ? o.pm(v, sdOf(kind, e, stat)) : o.show(v, stat);
      setTip(
        els.pts[i],
        state.mode === 'agents'
          ? `<b>${a.name}</b> · ${s.label}<br>${o.describe('agent', a, stat)}`
          : `<b>${s.label} · ${s.name}</b><br>${o.describe('stage', s, stat)}<br>click to open into its agents`
      );
    });
    critics.forEach((c, i) => {
      setTip(els.crit[i], `<b>${c.name}</b><br>${o.describe('agent', c, stat)}`);
      const v = o.metric('agent', c, stat);
      els.critVals[i].textContent = o.pm ? o.pm(v, sdOf('agent', c, stat)) : o.show(v, stat);
    });
  }

  function build(width) {
    W = width;
    H = W < 560 ? 360 : 420;
    narrow = (W - (W < 560 ? 40 : 56) - 14) / agents.length < 62;
    M = { l: W < 560 ? 40 : 56, r: 14, t: 66, b: narrow ? 104 : 76 };
    yAxis = axisOf(state.stat);
    box.innerHTML = '';
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: 'cl-svg', role: 'img', 'aria-label': o.aria }, box);
    const grid = svgEl('g', { class: 'fl-grid' }, svg);
    for (const t of yAxis.ticks) {
      svgEl('line', { x1: M.l, x2: W - M.r, y1: y(t), y2: y(t) }, grid);
      svgEl('text', { x: M.l - 8, y: y(t) + 4, 'text-anchor': 'end', class: 'fl-tick' }, grid).textContent = o.tick(t, state.stat);
    }
    axisTitle(svg, typeof o.yTitle === 'function' ? o.yTitle(state.stat) : o.yTitle, W);

    els = { bands: [], bandHits: [], bandTitles: [], expand: [], dividers: [], pts: [], vals: [], xl: [], crit: [], err: [], critErr: [], critVals: [] };
    const bandG = svgEl('g', {}, svg);
    d.stages.forEach((s) => {
      els.bands.push(svgEl('rect', { y: M.t - 30, height: H - M.t - M.b + 30, class: `fl-band cl-st-${s.id}` }, bandG));
      els.bandTitles.push(svgEl('text', { y: M.t - 12, 'text-anchor': 'middle', class: 'fl-band-title' }, bandG));
      const ex = svgEl('text', { y: H - M.b + (narrow ? 20 : 34), 'text-anchor': 'middle', class: 'fl-expand' }, bandG);
      ex.textContent = `open ${d.agents.filter((a) => a.stage === s.id).length} agents ▸`;
      els.expand.push(ex);
    });
    for (let j = 1; j < d.stages.length; j++) {
      els.dividers.push(svgEl('line', { y1: M.t - 30, y2: H - M.b, class: 'fl-divider' }, bandG));
    }
    svgEl('line', { x1: M.l, x2: W - M.r, y1: y(0), y2: y(0), class: 'fl-base' }, svg);

    agents.forEach((a) => els.err.push(svgEl('path', { class: `fl-err cl-st-${a.stage}` }, svg)));
    critics.forEach(() => els.critErr.push(svgEl('path', { class: 'fl-err fl-err-crit' }, svg)));
    els.path = svgEl('path', { class: 'fl-line', pathLength: 1 }, svg);
    els.critPath = svgEl('path', { class: 'fl-crit-line' }, svg);

    agents.forEach((a, i) => {
      const g = svgEl('g', { class: 'fl-pt-pos' }, svg);
      const inner = svgEl('g', { class: `fl-pt cl-st-${a.stage}`, style: `--i:${i}` }, g);
      svgEl('circle', { r: 7.5 }, inner);
      els.pts.push(g);
      els.vals.push(svgEl('text', { 'text-anchor': 'middle', class: 'fl-val' }, svg));
      const xl = svgEl('text', { 'text-anchor': 'middle', class: 'fl-xl' }, svg);
      if (narrow) xl.textContent = a.short;
      else {
        const words = a.short.split(' ');
        const half = Math.ceil(words.length / 2);
        [words.slice(0, half).join(' '), words.slice(half).join(' ')].filter(Boolean).forEach((ln, k) => {
          svgEl('tspan', { x: 0, dy: k ? 14 : 0 }, xl).textContent = ln;
        });
      }
      els.xl.push(xl);
    });
    critics.forEach((c, i) => {
      els.critVals.push(svgEl('text', { class: 'fl-val fl-crit-val' }, svg));
      const g = svgEl('g', { class: 'fl-crit-pos' }, svg);
      svgEl('path', { d: 'M0,-10.5L10.5,0L0,10.5L-10.5,0Z', class: `fl-crit cl-st-${c.stage}`, style: `--i:${i + 9}` }, g);
      els.crit.push(g);
    });
    // Band hit areas last, so a click anywhere in a closed stage opens it.
    d.stages.forEach(() => {
      const hit = svgEl('rect', { y: M.t - 30, height: H - M.t - M.b + 30, class: 'fl-hit' }, svg);
      hit.addEventListener('click', () => setMode('agents'));
      els.bandHits.push(hit);
    });
    // Points above the hit areas, so their tooltips still work.
    els.pts.forEach((p) => svg.appendChild(p));
    els.crit.forEach((p) => svg.appendChild(p));
    els.pts.forEach((p) => p.addEventListener('click', () => state.mode === 'stages' && setMode('agents')));

    geo = geometry(state.mode, state.stat);
    paint(geo);
    // Place the agent labels once; only their opacity changes.
    const g1 = geometry('agents', state.stat);
    els.xl.forEach((xl, i) => {
      xl.setAttribute('transform', narrow ? `translate(${g1.pts[i].x + 4},${H - M.b + 14}) rotate(-50)` : `translate(${g1.pts[i].x},${H - M.b + 22})`);
      if (narrow) xl.setAttribute('text-anchor', 'end');
      xl.removeAttribute('x');
    });
    values();
    svg.classList.toggle('no-crit', state.crit === 'off');
    svg.classList.toggle('is-agents', state.mode === 'agents');
    els.bandHits.forEach((h) => (h.style.display = state.mode === 'stages' ? '' : 'none'));
  }

  function go() {
    const from = geo;
    const to = geometry(state.mode, state.stat);
    values();
    box.querySelector('svg').classList.toggle('is-agents', state.mode === 'agents');
    els.bandHits.forEach((h) => (h.style.display = state.mode === 'stages' ? '' : 'none'));
    tween(750, (t) => paint((geo = mixGeo(from, to, t))));
  }
  function setMode(m) {
    if (state.mode === m) return;
    state.mode = m;
    pressToggle(host, 'mode', m);
    go();
  }

  wireToggles(host, (group, v) => {
    if (group === 'mode') setMode(v);
    if (group === 'stat') {
      state.stat = v;
      if (o.axisPerStat) {
        // A new unit needs a new axis: redraw, then replay the entrance.
        yAxis = axisOf(v);
        build(W);
        replay(host);
      } else go();
    }
    if (group === 'crit') {
      state.crit = v;
      box.querySelector('svg').classList.toggle('no-crit', v === 'off');
    }
  });
  onWidth(box, build);
}

/* ================================================================ *
 * Section 1 · Calls
 * ================================================================ */

function callsFlow(host, d) {
  flowChart(host, d, {
    stats: [['mean', 'Mean']],
    metric: (kind, e) => e.calls.mean,
    sd: (kind, e) => e.calls.sd,
    pm: (v, sd) => `${fmt(v, 2)} ± ${fmt(sd, 2)}`,
    show: (v) => fmt(v, 2),
    tick: (v) => fmt(v, v % 1 ? 1 : 0),
    yTitle: `Model calls per diagram · mean ± 1 SD over ${d.n} diagrams`,
    aria: 'Mean model calls per diagram for each stage, expandable into agents',
    describe: (kind, e) =>
      `${fmt(e.calls.mean, 2)} ± ${fmt(e.calls.sd, 2)} calls (mean ± SD)<br>median ${fmt(e.calls.median, 1)} · max ${fmt(e.calls.max)}` +
      (kind === 'agent' && e.calls.ran < d.n ? `<br>runs on ${e.calls.ran} of ${d.n} diagrams` : '') +
      `<br>${fmt(e.share.calls, 1)}% of all calls`,
    table: tableView(
      ['Stage / agent', 'Mean calls', 'SD', 'Median', 'Max', 'Share of calls'],
      d.stages.flatMap((s) => [
        [`<b>${s.label} · ${s.name}</b>`, `<b>${fmt(s.calls.mean, 2)}</b>`, fmt(s.calls.sd, 2), fmt(s.calls.median, 1), fmt(s.calls.max), `${fmt(s.share.calls, 1)}%`],
        ...d.agents
          .filter((a) => a.stage === s.id)
          .map((a) => [`&nbsp;&nbsp;${a.code} · ${a.name}`, fmt(a.calls.mean, 2), fmt(a.calls.sd, 2), fmt(a.calls.median, 1), fmt(a.calls.max), `${fmt(a.share.calls, 1)}%`]),
      ]),
      `Averages across the ${d.n} profiled diagrams.`
    ),
  });
}

function callsInsights(d) {
  const crit = d.agents.filter((a) => a.role === 'critic');
  const top = [...crit].sort((a, b) => b.calls.mean - a.calls.mean)[0];
  const others = crit.filter((c) => c !== top);
  const t = d.totals;
  return insights([
    {
      big: `${fmt(t.critic.callShare)}%`,
      k: 'of all calls go to critics',
      text: `The three critics make ${fmt(t.critic.calls, 1)} of the ${fmt(t.calls.mean, 1)} calls a diagram needs.`,
    },
    {
      big: fmt(top.calls.mean, 2),
      k: `calls to the ${top.short}, the busiest critic`,
      text: `More than either other critic (${others.map((c) => `${c.short} ${fmt(c.calls.mean, 2)}`).join(', ')}).`,
      cls: 'cl-st-s1',
    },
    {
      big: crit.map((c) => fmt(c.calls.mean, 1)).join(' → '),
      k: 'critic calls, stage by stage',
      text: `Critic effort dips in the middle and rises again: the Planner Critic almost always signs off after one review, while Diagram to Animation Aware Code conversion (Stage 1) and Animation design (Stage 3) take more repair rounds.`,
    },
    {
      big: trio(d, d.stages.map((s) => s.calls.mean), (v) => fmt(v, 2)),
      k: 'average calls per stage',
      text: `Stages 1 and 2 cost about the same number of calls, but for different reasons: Stage 1 through critic repair, Stage 2 through four agents that almost always run once (except the Animation Planner Critic).`,
    },
  ]);
}

/** A red-orange ramp: pale peach at the low end, deep red at the high end. */
const HEAT = ['#FFF1E3', '#FDD3A8', '#F7A35C', '#E8672F', '#C23A1E', '#8E1D14'];
function heatColour(f) {
  const x = Math.min(1, Math.max(0, f)) * (HEAT.length - 1);
  const k = Math.min(HEAT.length - 2, Math.floor(x));
  const t = x - k;
  const h = (c) => [1, 3, 5].map((o) => parseInt(c.slice(o, o + 2), 16));
  const [a, b] = [h(HEAT[k]), h(HEAT[k + 1])];
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
}

/**
 * Styles × the two critics that see the animation style (the Planner
 * and Animator critics; Stage 1 runs before any style is chosen). One
 * shared scale, drawn as a key beside the grid.
 */
function styleHeat(d) {
  const crit = d.agents.filter((a) => a.role === 'critic' && a.stage !== 's1');
  const rows = [...d.styles].sort((a, b) => crit.reduce((t, c) => t + b.calls[c.code], 0) - crit.reduce((t, c) => t + a.calls[c.code], 0));
  const vals = rows.flatMap((s) => crit.map((c) => s.calls[c.code]));
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const f = (v) => (hi > lo ? (v - lo) / (hi - lo) : 0);
  let i = 0;
  const stops = HEAT.map((c, k) => `${c} ${(k / (HEAT.length - 1)) * 100}%`).join(', ');
  return `
    <div class="cl-heat-wrap">
      <div class="cl-heat" style="--cols:${crit.length}">
        <div class="cl-heat-corner">Style</div>
        ${crit.map((c) => `<div class="cl-heat-col cl-st-${c.stage}"><i class="cl-heat-dot"></i>${c.name}</div>`).join('')}
        ${rows
          .map(
            (s) => `
          <div class="cl-heat-row">${s.label}</div>
          ${crit
            .map((c) => {
              const v = s.calls[c.code];
              return `<div class="cl-heat-cell ${f(v) > 0.55 ? 'is-dark' : ''}" style="background:${heatColour(f(v))};--i:${i++}"
                ${tip(`<b>${s.label}</b> · ${c.name}<br>${fmt(v, 2)} calls per diagram, on average`)}>${fmt(v, 2)}</div>`;
            })
            .join('')}`
          )
          .join('')}
      </div>
      <div class="cl-heat-key" aria-hidden="true">
        <span>${fmt(hi, 2)}</span>
        <i style="background:linear-gradient(to top, ${stops})"></i>
        <span>${fmt(lo, 2)}</span>
        <small>mean calls per diagram</small>
      </div>
    </div>
    ${tableView(
      ['Style', ...crit.map((c) => c.name)],
      rows.map((s) => [s.label, ...crit.map((c) => fmt(s.calls[c.code], 2))]),
      `Mean calls per diagram, averaged over the diagrams animated in each style.`
    )}`;
}

function styleHeatInsights(d) {
  const a3 = [...d.styles].sort((a, b) => b.calls['3b'] - a.calls['3b']);
  const p = d.styles.map((s) => s.calls['2d']);
  const pTop = [...d.styles].sort((a, b) => b.calls['2d'] - a.calls['2d'])[0];
  return insights([
    {
      big: fmt(a3[0].calls['3b'], 2),
      k: `Animator Critic calls on ${a3[0].label.toLowerCase()}, the most of any style`,
      text: `Against ${fmt(a3.at(-1).calls['3b'], 2)} on ${a3.at(-1).label.toLowerCase()}, the fewest: ${fmt(a3[0].calls['3b'] / a3.at(-1).calls['3b'], 1)}× as many review and repair calls.`,
      cls: 'cl-st-s3',
    },
    {
      big: `${fmt(Math.min(...p), 2)}–${fmt(Math.max(...p), 2)}`,
      k: 'Planner Critic calls, across all five styles',
      text: `The Planner Critic hardly notices the style; ${pTop.label.toLowerCase()} asks the most of it, at ${fmt(pTop.calls['2d'], 2)}. Style is felt at Stage 3, where the animation itself is judged.`,
      cls: 'cl-st-s2',
    },
  ]);
}

/* ================================================================ *
 * Section 2 · Time
 * ================================================================ */

function timeFlow(host, d) {
  flowChart(host, d, {
    stats: [['mean', 'Mean']],
    metric: (kind, e) => e.latency.mean,
    sd: (kind, e) => e.latency.sd,
    pm: (v, sd) => `${fmt(v)} ± ${fmt(sd)} s`,
    show: (v) => secs(v),
    tick: (v) => `${fmt(v)}`,
    yTitle: `Seconds of model time per diagram · mean ± 1 SD over ${d.n} diagrams`,
    aria: 'Model time per diagram for each stage, expandable into agents',
    describe: (kind, e, st) =>
      `${secs(e.latency.mean)} ± ${secs(e.latency.sd)} (mean ± SD)<br>middle half ${secs(e.latency.p25)}–${secs(e.latency.p75)} · max ${secs(e.latency.max)}` +
      (kind === 'agent' ? `<br>${secs(e.latency.perCall)} per call` : '') +
      `<br>${fmt(e.share.latency, 1)}% of a diagram's time`,
    table: tableView(
      ['Stage / agent', 'Mean', 'SD', 'Median', 'Middle half', 'Per call', 'Share of time'],
      d.stages.flatMap((s) => [
        [`<b>${s.label} · ${s.name}</b>`, `<b>${secs(s.latency.mean)}</b>`, secs(s.latency.sd), secs(s.latency.median), `${secs(s.latency.p25)}–${secs(s.latency.p75)}`, '', `${fmt(s.share.latency, 1)}%`],
        ...d.agents
          .filter((a) => a.stage === s.id)
          .map((a) => [`&nbsp;&nbsp;${a.code} · ${a.name}`, secs(a.latency.mean), secs(a.latency.sd), secs(a.latency.median), `${secs(a.latency.p25)}–${secs(a.latency.p75)}`, secs(a.latency.perCall), `${fmt(a.share.latency, 1)}%`]),
      ]),
      d.notes['3b']
    ),
  });
}

function timeInsights(d) {
  const byTime = [...d.agents].sort((a, b) => b.latency.mean - a.latency.mean);
  const top = byTime[0];
  const crit = d.agents.filter((a) => a.role === 'critic').sort((a, b) => b.latency.mean - a.latency.mean);
  const [s1, s2, s3] = d.stages;
  return insights([
    {
      big: trio(d, [s1, s2, s3].map((s) => s.share.latency), (v) => `${fmt(v)}%`),
      k: 'share of the average diagram\'s time, stage by stage',
      text: `Stages 1 and 3 each take about ${mins((s1.latency.mean + s3.latency.mean) / 2)}; Stage 2, with four agents, takes the least (${mins(s2.latency.mean)}), because each of its calls is short.`,
    },
    {
      big: secs(top.latency.mean),
      k: `${top.name}: the single slowest agent`,
      text: `${fmt(top.share.latency)}% of a diagram's time in one call: it writes the whole animation program. Second is the ${byTime[1].short} (${secs(byTime[1].latency.mean)}), which writes the diagram code.`,
      cls: `cl-st-${top.stage}`,
    },
    {
      big: secs(crit[0].latency.mean),
      k: `in the ${crit[0].short}, the costliest critic in terms of time taken`,
      text: `Then the ${crit[1].short} (${secs(crit[1].latency.mean)}) and the ${crit[2].short} (${secs(crit[2].latency.mean)}). Together the critics take ${fmt(d.totals.critic.latencyShare)}% of the time.`,
      cls: `cl-st-${crit[0].stage}`,
    },
    {
      big: `${secs(d.agents.find((a) => a.code === '3a').latency.perCall)} vs ${fmt(Math.min(...crit.map((c) => c.latency.perCall)))}–${secs(Math.max(...crit.map((c) => c.latency.perCall)))}`,
      k: 'per call: generating vs reviewing',
      text: 'The other agents write whole programs in each call; critic calls are reviews and targeted repairs, and are shorter. That is why critics are half the calls but only a third of the time.',
    },
  ]);
}

/**
 * Share of calls (left) against share of time (right), per agent, as a
 * butterfly: two bars back to back from the agent's name, so each agent's
 * lean towards calls or towards time reads at a glance.
 */
function shareButterfly(d) {
  const max = Math.ceil(Math.max(...d.agents.flatMap((a) => [a.share.calls, a.share.latency])) / 5) * 5;
  const rows = d.agents
    .map(
      (a, i) => `
      <div class="cl-bf-row cl-st-${a.stage} ${a.role === 'critic' ? 'is-critic' : ''}" style="--i:${i}">
        <div class="cl-bf-side is-left"><b>${fmt(a.share.calls, 1)}%</b><i style="--w:${pct(a.share.calls, max)}%" ${tip(`<b>${a.name}</b><br>${fmt(a.share.calls, 1)}% of all calls`)}></i></div>
        <div class="cl-bf-name">${a.short}</div>
        <div class="cl-bf-side is-right"><i style="--w:${pct(a.share.latency, max)}%" ${tip(`<b>${a.name}</b><br>${fmt(a.share.latency, 1)}% of all time`)}></i><b>${fmt(a.share.latency, 1)}%</b></div>
      </div>`
    )
    .join('');
  return `
    <div class="cl-bf">
      <div class="cl-bf-row cl-bf-head"><div class="cl-bf-side is-left"><span>← share of calls</span></div><div class="cl-bf-name"></div><div class="cl-bf-side is-right"><span>share of time →</span></div></div>
      ${rows}
    </div>
    ${stageLegend(d, [{ label: 'Critic (hatched)', cls: 'cl-swatch-critic' }])}
    ${tableView(
      ['Agent', 'Share of calls', 'Share of time'],
      d.agents.map((a) => [a.name, `${fmt(a.share.calls, 1)}%`, `${fmt(a.share.latency, 1)}%`]),
      `Shares of the average diagram's calls and time, over the ${d.n} profiled diagrams.`
    )}`;
}

/**
 * Style explorer: every diagram as a dot, one row per style, for a chosen
 * agent. "Size-adjusted" removes what each diagram's element count
 * predicts, so a style is not blamed for drawing bigger diagrams.
 */
function styleStrip(host, d) {
  const choices = [
    ['3a', 'Animation Designer'],
    ['3b', 'Animator Critic'],
    ['1c', 'Transmuter Critic'],
    ['total', 'Across all stages'],
  ];
  const state = { agent: '3a', adj: 'adj' };
  // One colour per style (none is a stage hue); the rows already separate
  // the styles, so colour is a second cue, not the only one.
  const STYLE_COLOURS = ['#6a4fc4', '#d9481f', '#e87ba4', '#9b2c6a', '#1f4e8c'];
  const colourOf = (id) => STYLE_COLOURS[d.styles.findIndex((x) => x.id === id) % STYLE_COLOURS.length];
  host.innerHTML = `
    <div class="cl-controls">
      ${toggle('agent', choices, state.agent)}
    </div>
    <div class="cl-svgbox cl-strip"></div>
`;
  const box = host.querySelector('.cl-strip');
  const codes = d.agents.map((a) => a.code);
  const styles = [...d.styles];

  // Linear fit of a measure on element count, over all diagrams.
  const fitOf = (vals) => {
    const xs = d.samples.map((s) => s.el);
    const mx = xs.reduce((a, b) => a + b) / xs.length;
    const my = vals.reduce((a, b) => a + b) / vals.length;
    let num = 0;
    let den = 0;
    xs.forEach((x, i) => ((num += (x - mx) * (vals[i] - my)), (den += (x - mx) ** 2)));
    const b = num / den;
    return { a: my - b * mx, b, mean: my };
  };
  const raw = (s, k) => (k === 'total' ? s.latency : s.l[codes.indexOf(k)]);
  const valuesFor = (k, mode) => {
    const v = d.samples.map((s) => raw(s, k));
    if (mode === 'raw') return v;
    const f = fitOf(v);
    return d.samples.map((s, i) => f.mean + (v[i] - (f.a + f.b * s.el)));
  };

  let W = 0;
  let svg = null;
  let dots = [];
  let means = [];
  let meanLabels = [];
  let x = null;
  let H = 0;
  const M = { l: 0, r: 20, t: 16, b: 40 };
  const rowH = 58;

  function scaleFor(k) {
    const all = [...valuesFor(k, 'raw'), ...valuesFor(k, 'adj')];
    const ax = axisFor(Math.max(...all));
    return ax;
  }

  function layout(k, mode) {
    const v = valuesFor(k, mode);
    const out = { dots: v.map((val) => x(val)), means: [] };
    styles.forEach((st) => {
      const idx = d.samples.map((s, i) => (s.style === st.id ? i : -1)).filter((i) => i >= 0);
      out.means.push(idx.reduce((t, i) => t + v[i], 0) / idx.length);
    });
    out.meanX = out.means.map((m) => x(m));
    return out;
  }

  function build(width, animateIn) {
    W = width;
    M.l = W < 560 ? 104 : 176;
    H = M.t + styles.length * rowH + M.b;
    box.innerHTML = '';
    svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: 'cl-svg', role: 'img', 'aria-label': 'Per-diagram time by animation style' }, box);
    const ax = scaleFor(state.agent);
    x = (v) => M.l + (W - M.l - M.r) * (v / ax.top);
    for (const t of ax.ticks) {
      svgEl('line', { x1: x(t), x2: x(t), y1: M.t, y2: H - M.b, class: 'st-grid' }, svg);
      svgEl('text', { x: x(t), y: H - M.b + 18, 'text-anchor': 'middle', class: 'fl-tick' }, svg).textContent = `${fmt(t)} s`;
    }
    styles.forEach((st, r) => {
      const cy = M.t + r * rowH + rowH / 2;
      if (r % 2 === 0) svgEl('rect', { x: 0, y: cy - rowH / 2, width: W, height: rowH, class: 'st-row' }, svg);
      svgEl('circle', { cx: M.l - 10, cy, r: 5, class: 'st-key', style: `--c:${colourOf(st.id)}` }, svg);
      const lab = svgEl('text', { x: M.l - 22, y: cy + 4, 'text-anchor': 'end', class: 'st-label' }, svg);
      lab.textContent = W < 560 ? st.label.replace(' bounding box', ' bbox') : st.label;
    });
    const L = layout(state.agent, state.adj);
    const agentName = state.agent === 'total' ? 'whole diagram' : d.agents.find((a) => a.code === state.agent).name;
    dots = d.samples.map((s, i) => {
      const r = styles.findIndex((st) => st.id === s.style);
      const cy = M.t + r * rowH + rowH / 2 + jitter(s.id) * (rowH * 0.3);
      const c = svgEl('circle', { cx: L.dots[i], cy, r: 5.5, class: 'st-dot', style: `--i:${i % 30};--c:${colourOf(s.style)}` }, svg);
      setTip(c, `<b>${s.id}</b><br>${styles[r].label} · ${s.el} elements<br>${agentName}: ${secs(raw(s, state.agent))}`);
      return c;
    });
    means = styles.map((st, r) => {
      const cy = M.t + r * rowH + rowH / 2;
      const g = svgEl('g', { class: 'st-mean', transform: `translate(${L.meanX[r]},${cy})` }, svg);
      svgEl('line', { x1: 0, x2: 0, y1: -rowH / 2 + 6, y2: rowH / 2 - 6 }, g);
      svgEl('path', { d: 'M0,-8L8,0L0,8L-8,0Z' }, g);
      return g;
    });
    meanLabels = styles.map((st, r) => {
      const cy = M.t + r * rowH + rowH / 2;
      const t = svgEl('text', { x: L.meanX[r] + 12, y: cy - 10, class: 'st-mean-label' }, svg);
      t.textContent = secs(L.means[r]);
      return t;
    });
    markTop(L);
    if (animateIn) {
      svg.classList.add('st-enter');
      requestAnimationFrame(() => requestAnimationFrame(() => svg.classList.remove('st-enter')));
    }
  }

  function markTop(L) {
    const best = L.means.indexOf(Math.max(...L.means));
    means.forEach((m, r) => m.classList.toggle('is-top', r === best));
  }

  wireToggles(host, (group, v) => {
    state[group] = v;
    if (group === 'agent') build(W, true);
  });
  onWidth(box, (w) => build(w, false));
}

/* ================================================================ *
 * Section 3 · Tokens
 * ================================================================ */

function tokensFlow(host, d) {
  const cost = (v) => `$${fmt(v, 3)}`;
  const kTok = (v) => `${fmt(v, 1)}k`;
  flowChart(host, d, {
    stats: [['total', 'All tokens'], ['prompt', 'Prompt'], ['completion', 'Completion'], ['cost', 'Cost ($)']],
    axisPerStat: true,
    metric: (kind, e, st) => e.tokens[st],
    show: (v, st) => (st === 'cost' ? cost(v) : kTok(v)),
    tick: (v, st) => (st === 'cost' ? `$${fmt(v, 2)}` : `${fmt(v)}k`),
    yTitle: (st) => (st === 'cost' ? `Dollars per diagram (${d.model})` : `Thousands of ${st === 'total' ? '' : `${st} `}tokens per diagram`),
    aria: 'Tokens and cost per diagram for each stage, expandable into agents',
    describe: (kind, e) =>
      `${kTok(e.tokens.total)} tokens per diagram<br>${kTok(e.tokens.prompt)} prompt + ${kTok(e.tokens.completion)} completion` +
      `<br>${kTok(e.tokens.perCall)} per call · ${cost(e.tokens.cost)}` +
      `<br>${fmt(e.share.tokens, 1)}% of tokens · ${fmt(e.share.cost, 1)}% of cost`,
    table: tableView(
      ['Stage / agent', 'Prompt', 'Completion', 'All tokens', 'Per call', 'Cost', 'Share of tokens'],
      [
        ...d.stages.flatMap((s) => [
          [`<b>${s.label} · ${s.name}</b>`, `<b>${kTok(s.tokens.prompt)}</b>`, `<b>${kTok(s.tokens.completion)}</b>`, `<b>${kTok(s.tokens.total)}</b>`, kTok(s.tokens.perCall), `<b>${cost(s.tokens.cost)}</b>`, `${fmt(s.share.tokens, 1)}%`],
          ...d.agents
            .filter((a) => a.stage === s.id)
            .map((a) => [`&nbsp;&nbsp;${a.code} · ${a.name}`, kTok(a.tokens.prompt), kTok(a.tokens.completion), kTok(a.tokens.total), kTok(a.tokens.perCall), cost(a.tokens.cost), `${fmt(a.share.tokens, 1)}%`]),
        ]),
        ['<b>Whole diagram</b>', kTok(d.tokens.prompt), kTok(d.tokens.completion), `<b>${kTok(d.tokens.total)}</b>`, '', `<b>${cost(d.tokens.cost)}</b>`, '100%'],
      ],
      `${d.tokens.note} Measured totals: ${fmt(d.tokens.reported.prompt, 1)}k prompt + ${fmt(d.tokens.reported.completion, 1)}k completion. Cost at $${d.tokens.rates.prompt} / $${d.tokens.rates.completion} per million prompt / completion tokens.`
    ),
  });
}

function tokensInsights(d) {
  const byTok = [...d.agents].sort((a, b) => b.tokens.total - a.tokens.total);
  const top = byTok[0];
  const s3 = d.stages[2];
  const crit = d.agents.filter((a) => a.role === 'critic');
  const critCost = crit.reduce((t, a) => t + a.share.cost, 0);
  const ratio = d.tokens.rates.completion / d.tokens.rates.prompt;
  return insights([
    {
      big: `${fmt(s3.share.tokens)}%`,
      k: `of tokens are spent in Stage 3, on ${fmt(s3.share.calls)}% of the calls`,
      text: `The Diagram Animator is the token-heavy stage: ${fmt(s3.tokens.perCall, 1)}k tokens per call, against ${fmt(d.stages[0].tokens.perCall, 1)}k in Stage 1 and ${fmt(d.stages[1].tokens.perCall, 1)}k in Stage 2.`,
      cls: 'cl-st-s3',
    },
    {
      big: `${fmt(top.tokens.total, 1)}k`,
      k: `tokens in the ${top.short}, the most of any agent`,
      text: `${fmt(top.share.tokens)}% of all tokens, and ${fmt((top.tokens.prompt / top.tokens.total) * 100)}% of them prompt tokens`,
      cls: `cl-st-${top.stage}`,
    },
    {
      big: `${fmt(d.tokens.criticShare)}%`,
      k: 'of tokens go to the three critics',
      text: `But ${fmt(critCost)}% of the cost: critics mostly read, and prompt tokens cost ${fmt(ratio)}× less than completion tokens.`,
    },
    {
      big: `$${fmt(d.tokens.cost, 3)}`,
      k: 'per diagram, from the per-agent figures',
      text: `${fmt(d.tokens.total, 1)}k tokens per diagram at ${d.model} batch rates. The measured total is ${fmt(d.tokens.reported.total, 1)}k tokens and $0.152; the per-agent figures are rounded.`,
    },
  ]);
}

/* ================================================================ *
 * Section 3 · What drives the time
 * ================================================================ */

function sizeScatter(host, d) {
  const state = { y: 'latency' };
  const fitOf = d.vsElements;
  host.innerHTML = `
    <div class="cl-controls">${toggle('y', [['latency', 'Model time'], ['calls', 'Model calls']], 'latency')}</div>
    <div class="cl-svgbox cl-scatter"></div>
    <div class="cl-scatter-r"></div>`;
  const box = host.querySelector('.cl-scatter');
  const Y = {
    latency: { get: (s) => s.latency / 60, title: 'Model time per diagram (min)', fit: (e) => (fitOf.latency.intercept + fitOf.latency.slope * e) / 60, stat: fitOf.latency, show: (v) => `${fmt(v, 1)} min` },
    calls: { get: (s) => s.calls, title: 'Model calls per diagram', fit: (e) => fitOf.calls.intercept + fitOf.calls.slope * e, stat: fitOf.calls, show: (v) => `${fmt(v)} calls` },
  };
  const yMax = { latency: axisFor(Math.max(...d.samples.map(Y.latency.get))), calls: axisFor(Math.max(...d.samples.map(Y.calls.get)) + 1) };
  const xAx = axisFor(Math.max(...d.samples.map((s) => s.el)));
  let W = 0;
  let H = 0;
  let M = null;
  let els = null;
  const X = (v) => M.l + (W - M.l - M.r) * (v / xAx.top);
  const Yp = (v, k) => M.t + (H - M.t - M.b) * (1 - v / yMax[k].top);

  function build(width) {
    W = width;
    H = W < 560 ? 330 : 400;
    M = { l: 48, r: 16, t: 34, b: 44 };
    box.innerHTML = '';
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: 'cl-svg', role: 'img', 'aria-label': 'Diagram size against model time or calls' }, box);
    for (const t of xAx.ticks) {
      svgEl('line', { x1: X(t), x2: X(t), y1: M.t, y2: H - M.b, class: 'st-grid' }, svg);
      svgEl('text', { x: X(t), y: H - M.b + 18, 'text-anchor': 'middle', class: 'fl-tick' }, svg).textContent = fmt(t);
    }
    svgEl('text', { x: W - M.r, y: H - 6, 'text-anchor': 'end', class: 'fl-axis-title' }, svg).textContent = 'Elements in the diagram';
    els = { yg: svgEl('g', {}, svg), title: svgEl('text', { x: 10, y: 18, class: 'fl-axis-title' }, svg) };
    els.fit = svgEl('line', { class: 'sc-fit' }, svg);
    els.dots = d.samples.map((s, i) => {
      const c = svgEl('circle', { cx: X(s.el), r: 5.5, class: `sc-dot t-${s.tertile}`, style: `--i:${i % 40}` }, svg);
      return c;
    });
    draw(state.y, 1, state.y);
  }

  function yAxisFor(k) {
    els.yg.innerHTML = '';
    for (const t of yMax[k].ticks) {
      svgEl('line', { x1: M.l, x2: W - M.r, y1: Yp(t, k), y2: Yp(t, k), class: 'st-grid' }, els.yg);
      svgEl('text', { x: M.l - 8, y: Yp(t, k) + 4, 'text-anchor': 'end', class: 'fl-tick' }, els.yg).textContent = fmt(t);
    }
    els.title.textContent = Y[k].title;
  }

  function draw(k, t, from) {
    if (t === 1 || t === 0) yAxisFor(k);
    d.samples.forEach((s, i) => {
      const y0 = Yp(Y[from].get(s), from);
      const y1 = Yp(Y[k].get(s), k);
      els.dots[i].setAttribute('cy', lerp(y0, y1, t));
      if (t === 1) setTip(els.dots[i], `<b>${s.id}</b><br>${s.el} elements · ${d.styles.find((x) => x.id === s.style).label}<br>${Y.latency.show(s.latency / 60)} · ${s.calls} calls`);
    });
    const e0 = 0;
    const e1 = xAx.top;
    const f0 = [Yp(Y[from].fit(e0), from), Yp(Y[from].fit(e1), from)];
    const f1 = [Yp(Y[k].fit(e0), k), Yp(Y[k].fit(e1), k)];
    els.fit.setAttribute('x1', X(e0));
    els.fit.setAttribute('x2', X(e1));
    els.fit.setAttribute('y1', lerp(f0[0], f1[0], t));
    els.fit.setAttribute('y2', lerp(f0[1], f1[1], t));
    const st = Y[k].stat;
    host.querySelector('.cl-scatter-r').innerHTML = `Pearson <b>r = ${fmt(st.r, 2)}</b> · Spearman <b>ρ = ${fmt(st.rho, 2)}</b> · ${
      k === 'latency' ? `each extra 10 elements adds about ${fmt(st.slope * 10)} s` : `calls barely move with size (${fmt(st.slope * 100, 1)} per 100 elements)`
    }`;
  }

  wireToggles(host, (g, v) => {
    const from = state.y;
    state.y = v;
    yAxisFor(v);
    tween(700, (t) => draw(v, t === 1 ? 1 : t, from));
  });
  onWidth(box, build);
}

function tertileTable(d) {
  const maxLat = Math.max(...d.tertiles.map((t) => t.latency));
  const maxCalls = Math.max(...d.tertiles.map((t) => t.calls));
  return `
    <div class="cl-tert">
      ${d.tertiles
        .map(
          (t, i) => `
        <div class="cl-tert-col" style="--i:${i}">
          <div class="cl-tert-head">${t.elements[0]}–${t.elements[1]} elements<small>${t.n} diagrams · the ${['smallest', 'middle', 'largest'][i]} third</small></div>
          <div class="cl-tert-bars">
            <div class="cl-tert-bar is-calls" style="--h:${pct(t.calls, maxCalls)}%" ${tip(`<b>${t.id} complexity</b><br>${fmt(t.calls, 2)} calls per diagram`)}><b>${fmt(t.calls, 1)}</b><span>calls</span></div>
            <div class="cl-tert-bar is-time" style="--h:${pct(t.latency, maxLat)}%" ${tip(`<b>${t.id} complexity</b><br>${mins(t.latency)} per diagram`)}><b>${fmt(t.latency / 60, 1)}</b><span>min</span></div>
          </div>
        </div>`
        )
        .join('')}
    </div>
    ${tableView(
      ['Third', 'Elements', 'Diagrams', 'Calls', 'Critic calls', 'Stage 1', 'Stage 2', 'Stage 3', 'Total time'],
      d.tertiles.map((t) => [t.id, `${t.elements[0]}–${t.elements[1]}`, t.n, fmt(t.calls, 2), fmt(t.criticCalls, 2), ...t.stageLatency.map(secs), mins(t.latency)])
    )}`;
}

/** Which agents' time grows with diagram size: Pearson r per agent. */
function agentScaling(d) {
  const rows = [...d.agents].sort((a, b) => b.vsElements.latencyR - a.vsElements.latencyR);
  return `
    <div class="cl-rbars">
      ${rows
        .map(
          (a, i) => `
        <div class="cl-rbar-row" style="--i:${i}">
          <div class="cl-rbar-label">${a.short}</div>
          <div class="cl-rbar-track"><i class="cl-rbar cl-st-${a.stage} ${a.role === 'critic' ? 'is-critic' : ''}" style="--w:${pct(Math.max(0, a.vsElements.latencyR), 1)}%"
            ${tip(`<b>${a.name}</b><br>r = ${fmt(a.vsElements.latencyR, 2)} (ρ = ${fmt(a.vsElements.latencyRho, 2)})<br>+${fmt(a.vsElements.secPer10Elements, 1)} s per 10 elements`)}></i></div>
          <div class="cl-rbar-val">${fmt(a.vsElements.latencyR, 2)}</div>
        </div>`
        )
        .join('')}
    </div>
    ${tableView(
      ['Agent', 'Pearson r', 'Spearman ρ', 'Seconds per 10 elements'],
      rows.map((a) => [a.name, fmt(a.vsElements.latencyR, 2), fmt(a.vsElements.latencyRho, 2), fmt(a.vsElements.secPer10Elements, 1)]),
      'Correlation between each agent\'s time on a diagram and the number of elements in it.'
    )}`;
}

function sizeInsights(d) {
  const v = d.vsElements;
  const [lo, , hi] = d.tertiles;
  const gens = d.agents.filter((a) => a.role === 'generator' && a.code !== '1b').map((a) => a.vsElements.latencyR);
  const loop = d.agents.filter((a) => ['1c', '3b'].includes(a.code));
  return insights([
    {
      big: `r = ${fmt(v.calls.r, 2)}`,
      k: 'calls against diagram size',
      text: `The number of calls does not grow with a diagram: small and large diagrams need the same ${fmt(lo.calls, 1)} and ${fmt(hi.calls, 1)} calls. Critic rounds do not rise with size.`,
    },
    {
      big: `r = ${fmt(v.latency.r, 2)}`,
      k: 'time against diagram size',
      text: `Time does grow, from ${mins(lo.latency)} for the smallest third to ${mins(hi.latency)} for the largest: each call has more to read and write, not more calls to make.`,
    },
    {
      big: `${fmt(Math.min(...gens), 2)}–${fmt(Math.max(...gens), 2)}`,
      k: 'correlation (r) between time and diagram size, for the agents that generate',
      text: `An r near 1 means an agent's time rises steadily with diagram size; near 0 means size makes little difference. The agents that generate code or plans take longer on bigger diagrams, while the two critics that iterate barely change with size (${loop.map((a) => `${a.short} ${fmt(a.vsElements.latencyR, 2)}`).join(', ')}).`
    },
  ]);
}

/* ================================================================ *
 * Section 5 · Stratified: one line per class of diagram
 * ================================================================ */

// Series colours for classes: none is a stage hue (those stay on the
// stage bands). Checked with the dataviz validator; each class also has
// its own marker shape, so colour never carries identity alone.
const CLASS_COLOURS = ['#6a4fc4', '#d9481f', '#e87ba4', '#9b2c6a'];
const CLASS_SHAPES = ['circle', 'square', 'triangle', 'diamond', 'hexagon', 'star', 'cross'];
const SMALL_COLOUR = '#958E7F';

function markerPath(shape, r = 6.5) {
  if (shape === 'square') return `M${-r * 0.85},${-r * 0.85}h${r * 1.7}v${r * 1.7}h${-r * 1.7}Z`;
  if (shape === 'triangle') return `M0,${-r * 1.05}L${r},${r * 0.75}L${-r},${r * 0.75}Z`;
  if (shape === 'diamond') return `M0,${-r * 1.15}L${r * 1.15},0L0,${r * 1.15}L${-r * 1.15},0Z`;
  if (shape === 'hexagon') {
    const pts = Array.from({ length: 6 }, (_, k) => [Math.cos((Math.PI / 3) * k) * r * 1.05, Math.sin((Math.PI / 3) * k) * r * 1.05]);
    return `M${pts.map((q) => q.map((v) => v.toFixed(2)).join(',')).join('L')}Z`;
  }
  if (shape === 'star') {
    const pts = Array.from({ length: 10 }, (_, k) => {
      const rr = k % 2 ? r * 0.5 : r * 1.2;
      const a = (Math.PI / 5) * k - Math.PI / 2;
      return [Math.cos(a) * rr, Math.sin(a) * rr];
    });
    return `M${pts.map((q) => q.map((v) => v.toFixed(2)).join(',')).join('L')}Z`;
  }
  if (shape === 'cross') {
    const a = r * 0.38;
    const b = r * 1.05;
    return `M${-a},${-b}h${2 * a}v${b - a}h${b - a}v${2 * a}h${a - b}v${b - a}h${-2 * a}v${a - b}h${a - b}v${-2 * a}h${b - a}Z`;
  }
  return `M${-r},0a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0`;
}

/**
 * The pipeline again, one line per class of a chosen property of the
 * diagram (density, connectivity, layout, depth, rasters). Switch between
 * time and calls, open the stages into agents, and click a class in the
 * legend to hide it. Classes with too few diagrams are drawn faded and
 * dashed, and are left out of every insight.
 */
/** How the per-class cost is estimated; tokens are only known as per-agent averages. */
const COST_NOTE = (d) =>
  `Estimated: tokens are only known as a per-agent average over all diagrams, so each agent's average cost is scaled by how long it ran on each diagram relative to its average (time tracks both extra calls and longer calls). At ${d.model} rates of $${d.tokens.rates.prompt} / $${d.tokens.rates.completion} per million prompt / completion tokens, as in section 3.`;

function strataChart(host, d) {
  const dims = d.strata;
  const agents = d.agents;
  const stageIdx = Object.fromEntries(d.stages.map((s, i) => [s.id, i]));
  const state = { dim: dims[0].key, metric: 'latency', mode: 'stages', stat: 'mean', hidden: new Set() };
  const dimOf = () => dims.find((x) => x.key === state.dim);
  const UNIT = {
    latency: { show: (v) => secs(v), total: (v) => mins(v), tick: (v) => fmt(v), title: 'Seconds of model time' },
    calls: { show: (v) => `${fmt(v, 2)} calls`, total: (v) => `${fmt(v, 1)} calls`, tick: (v) => fmt(v, v % 1 ? 1 : 0), title: 'Model calls' },
    cost: { show: (v) => `$${fmt(v, 3)}`, total: (v) => `$${fmt(v, 3)}`, tick: (v) => `$${fmt(v, 2)}`, title: 'Estimated dollars' },
  };
  const U = () => UNIT[state.metric];

  host.innerHTML = `
    <div class="cl-builder">
      <div class="cl-builder-row"><span class="cl-builder-k">Stratify by</span>${toggle('dim', dims.map((x) => [x.key, x.label]), state.dim)}</div>
      <div class="cl-builder-row"><span class="cl-builder-k">Measure</span>${toggle('metric', [['latency', 'Latency'], ['calls', 'Number of calls'], ['cost', 'Estimated cost']], state.metric)}
        ${toggle('mode', [['stages', 'By stage'], ['agents', 'By agent']], state.mode)}</div>
    </div>
    <div class="cl-sx-legend"></div>
    <div class="cl-svgbox cl-sx"></div>
    <p class="cl-sx-costnote" hidden></p>
    <div class="cl-sx-total"></div>
    <div class="cl-sx-insights"></div>
    <div class="cl-sx-table"></div>`;
  const box = host.querySelector('.cl-sx');

  let W = 0;
  let H = 0;
  let M = null;
  let els = null;
  let geo = null;
  let yAx = null;

  // Colour and shape follow a class's rank among the classes that are big
  // enough to read, so every dimension uses the same four series slots.
  function styleOf(dim) {
    let k = 0;
    return dim.classes.map((c, ci) => ({
      colour: c.small ? SMALL_COLOUR : CLASS_COLOURS[k++ % CLASS_COLOURS.length],
      shape: CLASS_SHAPES[ci % CLASS_SHAPES.length],
      small: c.small,
    }));
  }

  const val = (c, kind, id, metric = state.metric, stat = state.stat) =>
    kind === 'stage' ? c.stages[id][metric][stat] : c.agents[id][metric][stat];
  const sdv = (c, kind, id, metric = state.metric) => val(c, kind, id, metric, 'sd') || 0;

  function axisFor_(dim, metric) {
    const all = [];
    for (const c of dim.classes) {
      if (c.small) continue; // a two-diagram class's spread should not set the scale
      d.stages.forEach((s) => all.push(val(c, 'stage', s.id, metric, 'mean') + sdv(c, 'stage', s.id, metric)));
      agents.forEach((a) => all.push(val(c, 'agent', a.code, metric, 'mean') + sdv(c, 'agent', a.code, metric)));
    }
    return axisFor(Math.max(...all) * 1.06);
  }

  const y = (v) => M.t + (H - M.t - M.b) * (1 - Math.min(v, yAx.top) / yAx.top);
  function xs(mode) {
    const pw = W - M.l - M.r;
    if (mode === 'agents') return agents.map((a, i) => M.l + (i + 0.5) * (pw / agents.length));
    return agents.map((a) => M.l + (stageIdx[a.stage] + 0.5) * (pw / d.stages.length));
  }
  function geometry() {
    const dim = dimOf();
    const X = xs(state.mode);
    return dim.classes.map((c) =>
      agents.map((a, i) => {
        const [kind, id] = state.mode === 'agents' ? ['agent', a.code] : ['stage', a.stage];
        const v = val(c, kind, id);
        const sd = sdv(c, kind, id);
        return { x: X[i], y: y(v), lo: y(Math.max(0, v - sd)), hi: y(v + sd) };
      })
    );
  }
  const lead = new Set(d.stages.map((s) => agents.findIndex((a) => a.stage === s.id)));
  const show = (i) => state.mode === 'agents' || lead.has(i);
  const line = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('');

  function paint(g) {
    const dim = dimOf();
    dim.classes.forEach((c, ci) => {
      const e = els.series[ci];
      e.path.setAttribute('d', line(g[ci]));
      g[ci].forEach((p, i) => {
        e.marks[i].setAttribute('transform', `translate(${p.x},${p.y})`);
        const up = p.hi - p.y;
        const dn = p.lo - p.y;
        e.errs[i].setAttribute('d', dn - up < 1 ? 'M-11,0h22' : `M0,${up}V${dn}M-4,${up}h8M-4,${dn}h8`);
      });
    });
    placeEndLabels(g);
  }

  /** End-of-line labels, nudged apart so they never overlap. */
  function placeEndLabels(g) {
    if (!els.ends.length) return;
    const dim = dimOf();
    const items = dim.classes
      .map((c, ci) => ({ ci, y: g[ci].at(-1).y, hidden: state.hidden.has(c.name) }))
      .filter((it) => !it.hidden)
      .sort((a, b) => a.y - b.y);
    const gap = 15;
    for (let i = 1; i < items.length; i++) items[i].y = Math.max(items[i].y, items[i - 1].y + gap);
    const over = items.length ? items.at(-1).y - (H - M.b) : 0;
    if (over > 0) items.forEach((it) => (it.y -= over));
    for (let i = items.length - 2; i >= 0; i--) items[i].y = Math.min(items[i].y, items[i + 1].y - gap);
    const x = g[0].at(-1).x + 14;
    els.ends.forEach((t) => (t.style.display = 'none'));
    for (const it of items) {
      const t = els.ends[it.ci];
      t.style.display = '';
      t.setAttribute('x', x);
      t.setAttribute('y', it.y + 4);
    }
  }

  function build(width) {
    W = width;
    const dim = dimOf();
    const styles = styleOf(dim);
    const narrow = W < 640;
    H = narrow ? 380 : 440;
    M = { l: narrow ? 40 : 56, r: narrow ? 14 : 190, t: 62, b: narrow ? 100 : 70 };
    yAx = axisFor_(dim, state.metric);
    box.innerHTML = '';
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: 'cl-svg', role: 'img', 'aria-label': `${dim.label}: ${U().title.toLowerCase()} through the pipeline, one line per class` }, box);
    const pw = W - M.l - M.r;
    // Stage bands: the stages keep their own colours underneath the class lines.
    const stageBands = state.mode === 'agents'
      ? d.stages.map((s) => {
          const idx = agents.map((a, i) => (a.stage === s.id ? i : -1)).filter((i) => i >= 0);
          return { s, x: M.l + idx[0] * (pw / agents.length), w: idx.length * (pw / agents.length) };
        })
      : d.stages.map((s, j) => ({ s, x: M.l + j * (pw / d.stages.length), w: pw / d.stages.length }));
    for (const b of stageBands) {
      svgEl('rect', { x: b.x, y: M.t - 26, width: b.w, height: H - M.t - M.b + 26, class: `fl-band cl-st-${b.s.id}` }, svg);
      svgEl('text', { x: b.x + b.w / 2, y: M.t - 10, 'text-anchor': 'middle', class: 'fl-band-title' }, svg).textContent =
        b.w > 190 ? `${b.s.label} · ${b.s.name}` : b.s.label;
    }
    for (const t of yAx.ticks) {
      svgEl('line', { x1: M.l, x2: W - M.r, y1: y(t), y2: y(t), class: 'st-grid' }, svg);
      svgEl('text', { x: M.l - 8, y: y(t) + 4, 'text-anchor': 'end', class: 'fl-tick' }, svg).textContent = U().tick(t);
    }
    svgEl('line', { x1: M.l, x2: W - M.r, y1: y(0), y2: y(0), class: 'fl-base' }, svg);
    axisTitle(svg, `${U().title} per diagram · class mean ± 1 SD`, W);
    // Agent labels in the opened view.
    if (state.mode === 'agents') {
      const X = xs('agents');
      agents.forEach((a, i) => {
        const t = svgEl('text', { class: 'fl-xl', 'text-anchor': narrow ? 'end' : 'middle' }, svg);
        if (narrow) {
          t.setAttribute('transform', `translate(${X[i] + 4},${H - M.b + 14}) rotate(-50)`);
          t.textContent = a.short;
        } else {
          t.setAttribute('transform', `translate(${X[i]},${H - M.b + 20})`);
          const words = a.short.split(' ');
          const half = Math.ceil(words.length / 2);
          [words.slice(0, half).join(' '), words.slice(half).join(' ')].filter(Boolean).forEach((ln, k) => {
            svgEl('tspan', { x: 0, dy: k ? 14 : 0 }, t).textContent = ln;
          });
        }
      });
    }

    els = { series: [], ends: [] };
    dim.classes.forEach((c, ci) => {
      const st = styles[ci];
      const g = svgEl('g', { class: `sx-series ${st.small ? 'is-small' : ''} ${state.hidden.has(c.name) ? 'is-hidden' : ''}`, style: `--c:${st.colour};--i:${ci}`, 'data-class': c.name }, svg);
      const path = svgEl('path', { class: 'sx-line', pathLength: 1 }, g);
      const errs = [];
      const marks = agents.map((a, i) => {
        const m = svgEl('g', { class: 'sx-mark-pos' }, g);
        errs.push(svgEl('path', { class: 'sx-err' }, m));
        svgEl('path', { d: markerPath(st.shape), class: 'sx-mark', style: `--j:${i}` }, m);
        if (!show(i)) m.style.display = 'none';
        const stage = d.stages[stageIdx[a.stage]];
        const [kind, id] = state.mode === 'agents' ? ['agent', a.code] : ['stage', a.stage];
        const v = val(c, kind, id);
        setTip(m, `<b>${c.name}</b> · ${c.n} diagram${c.n === 1 ? '' : 's'}${c.small ? ' (too few to read)' : ''}<br>${state.mode === 'agents' ? a.name : `${stage.label} · ${stage.name}`}<br>${U().show(v)} ± ${U().show(sdv(c, kind, id))} (mean ± SD)`);
        return m;
      });
      els.series.push({ g, path, marks, errs });
      if (!narrow) {
        const t = svgEl('text', { class: 'sx-end' }, svg);
        t.innerHTML = `<tspan class="sx-end-dot" style="fill:${st.colour}">●</tspan> ${c.name} <tspan class="sx-end-n">n=${c.n}</tspan>`;
        els.ends.push(t);
      }
      // Hovering a class lifts its line and quiets the others.
      g.addEventListener('pointerenter', () => svg.classList.add('has-focus') || g.classList.add('is-focus'));
      g.addEventListener('pointerleave', () => svg.classList.remove('has-focus') || g.classList.remove('is-focus'));
    });

    const note = host.querySelector('.cl-sx-costnote');
    note.hidden = state.metric !== 'cost';
    note.textContent = COST_NOTE(d);
    geo = geometry();
    paint(geo);
    legendOf(dim, styles);
    totals(dim, styles);
    insightsOf(dim);
    tableOf(dim);
  }

  function legendOf(dim, styles) {
    host.querySelector('.cl-sx-legend').innerHTML = `<div class="cl-chips">${dim.classes
      .map(
        (c, ci) => `<button type="button" class="cl-sx-chip ${c.small ? 'is-small' : ''}" data-class="${attr(c.name)}" aria-pressed="${!state.hidden.has(c.name)}" style="--c:${styles[ci].colour}">
          <svg viewBox="-9 -9 18 18" width="14" height="14" aria-hidden="true"><path d="${markerPath(styles[ci].shape, 6)}"/></svg>${c.name}<small>n=${c.n}${c.small ? ' · too few' : ''}</small></button>`
      )
      .join('')}</div>`;
    host.querySelectorAll('.cl-sx-chip').forEach((chip) =>
      chip.addEventListener('click', () => {
        const name = chip.dataset.class;
        if (state.hidden.has(name)) state.hidden.delete(name);
        else state.hidden.add(name);
        chip.setAttribute('aria-pressed', String(!state.hidden.has(name)));
        els.series.forEach((s) => s.g.classList.toggle('is-hidden', state.hidden.has(s.g.dataset.class)));
        placeEndLabels(geo);
      })
    );
  }

  /** The whole diagram per class: total time or calls, with each class's size beside it. */
  function totals(dim, styles) {
    const vals = dim.classes.map((c) => c.total[state.metric].mean);
    const sds = dim.classes.map((c) => c.total[state.metric].sd || 0);
    const max = Math.max(...vals);
    host.querySelector('.cl-sx-total').innerHTML = `
      <div class="cl-sx-total-k">Whole diagram, all stages · class mean ± SD</div>
      ${dim.classes
        .map(
          (c, ci) => `
        <div class="cl-sx-trow ${c.small ? 'is-small' : ''}" style="--c:${styles[ci].colour};--i:${ci}">
          <span class="cl-sx-tname">${c.name}<small>n=${c.n} · ${fmt(c.total.elements)} elements on average</small></span>
          <span class="cl-sx-ttrack"><i style="--w:${pct(vals[ci], max)}%"></i></span>
          <b>${U().total(vals[ci])}<small>± ${U().total(sds[ci])}</small></b>
        </div>`
        )
        .join('')}`;
  }

  function insightsOf(dim) {
    const big = dim.classes.filter((c) => !c.small);
    const small = dim.classes.filter((c) => c.small);
    const cards = [];
    if (big.length >= 2) {
      const T = (c) => c.total.latency[state.stat];
      const byT = [...big].sort((a, b) => T(b) - T(a));
      const [hi, lo] = [byT[0], byT.at(-1)];
      const gaps = d.stages.map((s) => ({ s, gap: hi.stages[s.id].latency[state.stat] - lo.stages[s.id].latency[state.stat] })).sort((a, b) => b.gap - a.gap);
      cards.push({
        big: `${fmt(T(hi) / T(lo), 2)}×`,
        k: `${dim.label.toLowerCase()}: the time for ${hi.name.toLowerCase()} over ${lo.name.toLowerCase()} diagrams`,
        text: `${mins(T(hi))} against ${mins(T(lo))} per diagram. The largest gap is in ${gaps[0].s.label} (${gaps[0].s.name}), +${secs(gaps[0].gap)}.`,
        cls: `cl-st-${gaps[0].s.id}`,
      });
      const C = big.map((c) => c.total.calls[state.stat]);
      cards.push({
        big: `${fmt(Math.min(...C), 1)}–${fmt(Math.max(...C), 1)}`,
        k: `calls per diagram across the ${dim.label.toLowerCase()} classes`,
        text:
          Math.max(...C) - Math.min(...C) < 1
            ? 'The number of calls barely changes from class to class: the extra time comes from longer calls, not from more of them.'
            : `Calls differ by ${fmt(Math.max(...C) - Math.min(...C), 1)} per diagram between the classes: part of the time gap is extra critic rounds.`,
      });
      const Q = (c) => c.total.cost[state.stat];
      const byQ = [...big].sort((a, b) => Q(b) - Q(a));
      cards.push({
        big: `$${fmt(Q(byQ.at(-1)), 3)} → $${fmt(Q(byQ[0]), 3)}`,
        k: `estimated cost per diagram, ${byQ.at(-1).name.toLowerCase()} to ${byQ[0].name.toLowerCase()}`,
        text: `${fmt(Q(byQ[0]) / Q(byQ.at(-1)), 2)}× the cost, at ${d.model} batch rates. An estimate: each agent's average cost scaled by how long it runs on these diagrams.`,
      });
    }
    host.querySelector('.cl-sx-insights').innerHTML = insights(cards);
    const box2 = host.querySelector('.cl-sx-insights .cl-insights');
    if (box2) requestAnimationFrame(() => box2.classList.add('is-in'));
  }

  function tableOf(dim) {
    const unit = U().show;
    host.querySelector('.cl-sx-table').innerHTML = tableView(
      ['Class', 'Diagrams', ...d.stages.map((s) => s.label), 'Whole diagram'],
      dim.classes.map((c) => [c.name, c.n, ...d.stages.map((s) => `${unit(c.stages[s.id][state.metric].mean)} ± ${unit(c.stages[s.id][state.metric].sd || 0)}`), `<b>${unit(c.total[state.metric].mean)} ± ${unit(c.total[state.metric].sd || 0)}</b>`]),
      `${U().title} per diagram (class mean ± SD), by ${dim.label.toLowerCase()} class, from the stratification workbooks joined to the ${d.n} profiled diagrams by sample name.` +
        (state.metric === 'cost' ? ` ${COST_NOTE(d)}` : '')
    );
  }

  function retarget(rebuildAxis) {
    const from = geo;
    if (rebuildAxis) {
      build(W);
      const to = geo;
      tween(750, (t) =>
        paint((geo = to.map((pts, ci) => pts.map((p, i) => {
          const f = from[ci]?.[i] ?? p;
          return { x: lerp(f.x, p.x, t), y: lerp(f.y, p.y, t), lo: lerp(f.lo ?? p.lo, p.lo, t), hi: lerp(f.hi ?? p.hi, p.hi, t) };
        }))))
      );
      return;
    }
  }

  wireToggles(host, (group, v) => {
    state[group] = v;
    if (group === 'dim') {
      state.hidden.clear();
      build(W);
      replay(host);
      return;
    }
    // Same classes, new positions: redraw the frame, then glide the lines there.
    retarget(true);
  });
  onWidth(box, build);
}

/* ================================================================ *
 * Section 6 · What AnimateBanana would cost on each model
 * ================================================================ */

/**
 * One row per model: the cost of animating a diagram with AnimateBanana
 * if that model were its backbone, split by stage or by token type. A
 * second view shows the raw prices behind it. No scores: the closed
 * models were only ever scored zero-shot, never inside the pipeline.
 */
/**
 * The closed-source models we did not run, as bars, with our own backbone
 * below a horizontal rule so the gap between them is the point of the block.
 */
function extraRows(B) {
  const ours = B.models.find((m) => m.isOurs);
  const rows = [...(B.notEvaluated || [])].sort((a, b) => b.cost - a.cost);
  const all = [...rows, { ...ours, isRef: true }];
  const max = Math.max(...all.map((m) => m.cost));
  return all
    .map((m, i) => {
      const pr = m.split ? m.split.prompt : (B.tokensK.prompt * m.price.in) / 1000;
      const co = m.split ? m.split.completion : (B.tokensK.completion * m.price.out) / 1000;
      const seg = (cls, v, label) =>
        `<i class="cl-bc-seg ${cls} ${pct(v, max) < 9 ? 'is-tight' : ''}" style="flex-grow:${pct(v, m.cost)}" ${tip(`<b>${m.name}</b><br>${label}<br>$${fmt(v, 2)} of $${fmt(m.cost, 2)}`)}>${pct(v, max) < 9 ? '' : `<span>$${fmt(v, 2)}</span>`}</i>`;
      return `
      <div class="cl-bc-row cl-bc-xrow ${m.isRef ? 'is-ref' : ''}" style="--i:${i}">
        <div class="cl-bc-name">${m.name}${m.isRef ? '<small>our backbone &mdash; evaluated</small>' : ''}</div>
        <div class="cl-bc-track"><div class="cl-bc-bar" style="--w:${pct(m.cost, max)}%">${seg('is-prompt', pr, 'Prompt tokens')}${seg('is-completion', co, 'Completion tokens')}</div></div>
        <div class="cl-bc-val">$${fmt(m.cost, 2)}<small>${m.isRef ? 'what we paid' : `${fmt(m.cost / ours.cost, 1)}× our backbone`}</small></div>
      </div>`;
    })
    .join('');
}

/** The same models as a table, with our backbone below the same rule. */
function extraTable(B) {
  const ours = B.models.find((m) => m.isOurs);
  const usd = (v) => `$${fmt(v, v < 0.1 ? 3 : 2)}`;
  const row = (m, ref) =>
    `<tr class="${ref ? 'cl-bc-xref' : ''}"><td>${m.price.source ? `<a href="${m.price.source}" target="_blank" rel="noopener">${m.name}</a>` : m.name}${ref ? ' <small>(our backbone)</small>' : ''}</td><td class="num">${fmt(m.price.in, 2)}</td><td class="num">${fmt(m.price.out, 2)}</td><td class="num"><b>${usd(m.cost)}</b></td><td class="num">${ref ? '&mdash;' : `${fmt(m.cost / ours.cost, 1)}×`}</td></tr>`;
  return [...(B.notEvaluated || [])].sort((a, b) => b.cost - a.cost).map((m) => row(m, false)).join('') + row(ours, true);
}

const ourName = (B) => B.models.find((m) => m.isOurs).name;

function baselineCosts(host, d) {
  const B = d.baselines;
  const closed = B.models.filter((m) => m.kind === 'closed');
  const open = B.models.filter((m) => m.kind === 'open');
  const state = { view: 'cost', split: 'stage' };
  const usd = (v) => `$${fmt(v, v < 0.1 ? 3 : 2)}`;

  host.innerHTML = `
    <div class="cl-controls">
      ${toggle('view', [['cost', 'Cost per diagram'], ['price', 'Price per million tokens']], state.view)}
      <span class="cl-split-toggle">${toggle('split', [['stage', 'Split by stage'], ['type', 'Split by token type']], state.split)}</span>
    </div>
    <div class="cl-bc-legend"></div>
    <div class="cl-bc"></div>
    <div class="cl-bc-open">
      <div class="cl-bc-open-k">Open weights · no cost</div>
      <div class="cl-bc-open-list">${open
        .map((m) => `<span class="cl-bc-open-chip" ${tip(`<b>${m.name}</b>${m.params ? ` · ${m.params}` : ''}<br>open weights, self-hosted: no API cost (hardware not counted)`)}>${m.name}${m.params ? `<small>${m.params}</small>` : ''}</span>`)
        .join('')}</div>
    </div>
    <div class="cl-bc-table"></div>
    <div class="cl-bc-extra cl-table">
      <h4 class="cl-bc-extra-title">Closed source models we did not evaluate · cost per diagram</h4>
      <p class="cl-bc-extra-sub">Below the line is ${ourName(B)}, the backbone AnimateBanana actually ran on. Each model above it would cost several times more per diagram.</p>
      <div class="cl-bc-extra-chart">${extraRows(B)}</div>
      <div class="cl-legend cl-bc-extra-legend"><span class="cl-legend-item"><i class="cl-swatch cl-swatch-prompt"></i>Prompt tokens</span><span class="cl-legend-item"><i class="cl-swatch cl-swatch-completion"></i>Completion tokens</span></div>
      <div class="cl-table-scroll">
        <table>
          <thead><tr><th>Model</th><th class="num">Prompt $/M</th><th class="num">Completion $/M</th><th class="num">Cost per diagram</th><th class="num">vs ${ourName(B)}</th></tr></thead>
          <tbody>${extraTable(B)}</tbody>
        </table>
      </div>
      <p class="cl-table-note">${B.notEvaluatedNote || ''}</p>
    </div>`;

  function draw() {
    host.querySelector('.cl-split-toggle').style.display = state.view === 'cost' ? '' : 'none';
    const rows = [...closed].sort((a, b) => b.cost - a.cost);
    let html;
    if (state.view === 'cost') {
      const max = Math.max(...rows.map((m) => m.cost));
      const segsOf = (m) =>
        state.split === 'stage'
          ? d.stages.map((s) => ({ cls: `cl-st-${s.id}`, v: m.stageCost[s.id], label: `${s.label} · ${s.name}` }))
          : [
              { cls: 'is-prompt', v: m.split.prompt, label: `Prompt tokens (${fmt(B.tokensK.prompt, 1)}k at $${fmt(m.price.in, 2)}/M)` },
              { cls: 'is-completion', v: m.split.completion, label: `Completion tokens (${fmt(B.tokensK.completion, 1)}k at $${fmt(m.price.out, 2)}/M)` },
            ];
      html = rows
        .map((m, i) => {
          const segs = segsOf(m);
          // A segment too narrow for a horizontal figure moves the whole row's
          // figures just past the end of its bar, as tags in segment order, so
          // the bar itself stays to scale and every label stays horizontal.
          const outside = segs.some((sg) => pct(sg.v, max) < 5.5);
          const segTip = (sg) => tip(`<b>${m.name}</b><br>${sg.label}<br>${usd(sg.v)} · ${fmt(pct(sg.v, m.cost))}% of ${usd(m.cost)}`);
          return `
          <div class="cl-bc-row ${m.isOurs ? 'is-ours' : ''}" style="--i:${i}">
            <div class="cl-bc-name">${m.name}${m.isOurs ? '<small>AnimateBanana\'s backbone</small>' : ''}</div>
            <div class="cl-bc-track"><div class="cl-bc-bar" style="--w:${pct(m.cost, max)}%">${segs
              .map(
                (sg) => `<i class="cl-bc-seg ${sg.cls} ${pct(sg.v, max) < 9 ? 'is-tight' : ''}" style="flex-grow:${pct(sg.v, m.cost)}"
                  ${segTip(sg)}>${outside ? '' : `<span>${usd2(sg.v)}</span>`}</i>`
              )
              .join('')}</div>${
                outside
                  ? `<div class="cl-bc-out" style="left:calc(${pct(m.cost, max)}% + 10px)">${segs
                      .map((sg) => `<span class="cl-bc-tag ${sg.cls}" ${segTip(sg)}><i></i>${usd2(sg.v)}</span>`)
                      .join('')}</div>`
                  : ''
              }</div>
            <div class="cl-bc-val">${usd(m.cost)}<small>${m.isOurs ? 'the cheapest' : `${fmt(m.cost / rows.find((r) => r.isOurs).cost, 1)}× the cheapest`}</small></div>
          </div>`;
        })
        .join('');
      host.querySelector('.cl-bc-legend').innerHTML =
        state.split === 'stage'
          ? stageLegend(d)
          : legend([{ label: 'Prompt tokens', cls: 'cl-swatch-prompt' }, { label: 'Completion tokens', cls: 'cl-swatch-completion' }]);
    } else {
      const max = Math.max(...rows.map((m) => m.price.out));
      html = rows
        .map(
          (m, i) => `
          <div class="cl-bc-row ${m.isOurs ? 'is-ours' : ''}" style="--i:${i}">
            <div class="cl-bc-name">${m.name}<small>${m.price.source ? `<a href="${m.price.source}" target="_blank" rel="noopener">${m.price.provider}</a>` : m.price.provider}</small></div>
            <div class="cl-bc-track cl-bc-pair">
              <div class="cl-bc-bar cl-bc-price is-prompt" style="--w:${pct(m.price.in, max)}%" ${tip(`<b>${m.name}</b><br>$${fmt(m.price.in, 2)} per million prompt tokens`)}></div>
              <div class="cl-bc-bar cl-bc-price is-completion" style="--w:${pct(m.price.out, max)}%" ${tip(`<b>${m.name}</b><br>$${fmt(m.price.out, 2)} per million completion tokens`)}></div>
            </div>
            <div class="cl-bc-val cl-bc-val-pair"><span>$${fmt(m.price.in, 2)}</span><span>$${fmt(m.price.out, 2)}</span></div>
          </div>`
        )
        .join('');
      host.querySelector('.cl-bc-legend').innerHTML = legend([
        { label: 'Prompt (input) price', cls: 'cl-swatch-prompt' },
        { label: 'Completion (output) price', cls: 'cl-swatch-completion' },
      ]);
    }
    host.querySelector('.cl-bc').innerHTML = html;
    host.querySelector('.cl-bc-table').innerHTML = tableView(
      ['Model', 'Prompt $/M', 'Completion $/M', 'Stage 1', 'Stage 2', 'Stage 3', 'Cost per diagram'],
      [
        ...rows.map((m) => [m.name, fmt(m.price.in, 2), fmt(m.price.out, 2), usd(m.stageCost.s1), usd(m.stageCost.s2), usd(m.stageCost.s3), `<b>${usd(m.cost)}</b>`]),
        ...open.map((m) => [m.name, '–', '–', '–', '–', '–', 'no cost (open weights)']),
      ],
      `Each model priced on AnimateBanana's measured token profile per diagram (${fmt(B.tokensK.prompt, 1)}k prompt + ${fmt(B.tokensK.completion, 1)}k completion tokens, from Gemini 3.7 Flash) at the provider's official standard price. Other models would use somewhat different token counts. ${B.note}`
    );
  }

  wireToggles(host, (group, v) => {
    state[group] = v;
    draw();
    replay(host);
  });
  draw();
}

function baselineCostInsights(d) {
  const B = d.baselines;
  const rows = B.models.filter((m) => m.kind === 'closed').sort((a, b) => a.cost - b.cost);
  const ours = rows.find((m) => m.isOurs);
  const top = rows.at(-1);
  const compShare = rows.map((m) => pct(m.split.completion, m.cost));
  const s3 = rows.map((m) => pct(m.stageCost.s3, m.cost));
  const ratio = rows.map((m) => m.price.out / m.price.in);
  return insights([
    {
      big: `$${fmt(ours.cost, 2)}`,
      k: `per diagram on ${ours.name}, the cheapest closed-source backbone`,
      text: `At standard prices; the half-price batch tier we ran on brings it to $${fmt(ours.cost / 2, 2)}. Open-weight backbones carry no API cost at all.`,
    },
    {
      big: `${fmt(top.cost / ours.cost, 1)}×`,
      k: `the cost on ${top.name}, an agentic harness`,
      text: `${usd2(top.cost)} per diagram: running the pipeline through an agentic harness costs far more than calling a model directly. Every other closed model falls between ${usd2(rows[1].cost)} and ${usd2(rows.at(-2).cost)}.`,
    },
    {
      big: `${span(compShare)}%`,
      k: 'of the cost is completion tokens, on every model',
      text: `Although completion is only a third of the tokens, it is priced ${span(ratio)}× higher per token, so the output price decides the bill.`,
    },
    {
      big: `${span(s3)}%`,
      k: `of the cost falls in Stage 3, on ${new Set(s3.map((v) => fmt(v))).size === 1 ? 'every' : 'each'} model`,
      text: 'The Diagram Animator is the most expensive stage whichever model runs it: it holds the Animation Designer and the token-heavy Animator Critic.',
      cls: 'cl-st-s3',
    },
  ]);
}
const usd2 = (v) => `$${fmt(v, 2)}`;
/** "a–b", or just "a" when both round to the same figure. */
const span = (vals, dec = 0) => {
  const lo = fmt(Math.min(...vals), dec);
  const hi = fmt(Math.max(...vals), dec);
  return lo === hi ? lo : `${lo}–${hi}`;
};

/* ================================================================ *
 * Motion, tooltips, wiring
 * ================================================================ */

function playOnView(els) {
  if (reduced || !('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      }
    },
    // A low threshold with a bottom inset: tall charts on a phone could never reach a proportional one.
    { threshold: 0.01, rootMargin: '0px 0px -12% 0px' }
  );
  els.forEach((el) => io.observe(el));
}

function replay(el) {
  el.classList.add('cl-reset');
  el.classList.remove('is-in');
  void el.offsetWidth;
  el.classList.remove('cl-reset');
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-in')));
}

function wireTooltip() {
  const box = document.querySelector('#cl-tip');
  let current = null;
  const place = (x, y) => {
    const r = box.getBoundingClientRect();
    const left = Math.min(Math.max(8, x - r.width / 2), window.innerWidth - r.width - 8);
    const top = y - r.height - 14 < 8 ? y + 18 : y - r.height - 14;
    box.style.transform = `translate(${left}px, ${top}px)`;
  };
  const show = (el, x, y) => {
    current = el;
    box.innerHTML = el.getAttribute('data-tip');
    box.hidden = false;
    place(x, y);
  };
  const hide = () => {
    current = null;
    box.hidden = true;
  };
  document.addEventListener('pointerover', (e) => {
    const el = e.target.closest('[data-tip]');
    if (el) show(el, e.clientX, e.clientY);
    else if (current) hide();
  });
  document.addEventListener('pointermove', (e) => {
    if (current && e.target.closest('[data-tip]') === current) place(e.clientX, e.clientY);
  });
  document.addEventListener('pointerleave', hide);
  document.addEventListener('focusin', (e) => {
    const el = e.target.closest('[data-tip]');
    if (!el) return;
    const r = el.getBoundingClientRect();
    show(el, r.left + r.width / 2, r.top);
  });
  document.addEventListener('focusout', hide);
  window.addEventListener('scroll', () => current && hide(), { passive: true });
}

/** Charts that build themselves (`host`) and plain-HTML charts (`html`), with the insight cards that follow each. */
const CHARTS = {
  'calls-flow': { host: callsFlow, after: callsInsights },
  'style-heat': { html: styleHeat, after: styleHeatInsights },
  'time-flow': { host: timeFlow, after: timeInsights },
  'share-butterfly': { html: shareButterfly },
  'style-strip': { host: styleStrip },
  'tokens-flow': { host: tokensFlow, after: tokensInsights },
  'size-scatter': { host: sizeScatter, after: sizeInsights },
  tertiles: { html: tertileTable },
  'agent-scaling': { html: agentScaling },
  strata: { host: strataChart },
  'baseline-costs': { host: baselineCosts, after: baselineCostInsights },
};

/**
 * The page's writing comes from data/costs_copy.json: the head, the
 * contents bar, and every section with its cards. Only the numbers are
 * computed; all prose is editable there.
 */
function buildPage(copy) {
  const head = document.querySelector('#cl-head');
  head.querySelector('.kicker').innerHTML = copy.page.kicker;
  head.querySelector('h1').innerHTML = copy.page.title;
  document.title = `${copy.page.title.replace(/<[^>]+>/g, '')} · AnimateBanana`;
  document.querySelector('#cl-intro').innerHTML = copy.page.intro;

  document.querySelector('#cl-toc').innerHTML = `
    <div class="cl-toc-inner">
      <span class="cl-toc-title">${copy.toc.title}<small>${copy.toc.hint}</small></span>
      <div class="cl-toc-list">${copy.sections
        .map((s) => `<a href="#${s.id}" data-toc="${s.id}"><b>${s.num}</b><span>${s.toc}</span></a>`)
        .join('')}</div>
    </div>
    <i class="cl-toc-bar"><i></i></i>`;

  document.querySelector('#cl-sections').innerHTML = copy.sections
    .map(
      (s) => `
    <section class="cl-section" id="${s.id}">
      <div class="cl-section-head">
        <span class="cl-section-num">${s.num}</span>
        <span class="cl-section-glyph" data-glyph="${s.glyph}"></span>
        <div>
          <div class="kicker kicker-left">${s.kicker}</div>
          <h2>${s.title}</h2>
        </div>
      </div>
      <p class="cl-lede">${s.lede}</p>
      ${s.cards
        .map(
          (c) => `
      <figure class="cl-card cl-acc-${c.accent || 'violet'}">
        <figcaption class="cl-card-head">
          <div>
            <h3>${c.title}</h3>
            ${c.desc ? `<p>${c.desc}</p>` : ''}
          </div>
        </figcaption>
        <div data-chart="${c.chart}"></div>
      </figure>`
        )
        .join('')}
    </section>`
    )
    .join('');
}

/**
 * The contents bar: it sticks under the site nav, marks the section in
 * view, and fills a thin bar with how far through the page the reader is.
 */
function wireToc() {
  const toc = document.querySelector('#cl-toc');
  const links = [...toc.querySelectorAll('[data-toc]')];
  const sections = links.map((a) => document.getElementById(a.dataset.toc));
  const fill = toc.querySelector('.cl-toc-bar i');
  const wrap = document.querySelector('#cl-sections');
  const list = toc.querySelector('.cl-toc-list');
  let lastActive = -1;
  let ticking = false;
  const update = () => {
    ticking = false;
    const r = wrap.getBoundingClientRect();
    const total = r.height - window.innerHeight * 0.5;
    const done = Math.min(1, Math.max(0, (window.innerHeight * 0.3 - r.top) / Math.max(1, total)));
    fill.style.transform = `scaleX(${done})`;
    let active = 0;
    sections.forEach((sec, k) => {
      if (sec && sec.getBoundingClientRect().top < window.innerHeight * 0.35) active = k;
    });
    links.forEach((a, k) => a.classList.toggle('is-active', k === active && r.top < window.innerHeight * 0.35));
    const cur = links[active];
    if (cur && active !== lastActive && list.scrollWidth > list.clientWidth) {
      list.scrollTo({ left: cur.offsetLeft - (list.clientWidth - cur.offsetWidth) / 2, behavior: 'smooth' });
    }
    lastActive = active;
  };
  window.addEventListener('scroll', () => {
    if (!ticking) (ticking = true), requestAnimationFrame(update);
  }, { passive: true });
  // A sentinel just above the bar tells us when it has stuck.
  const sentinel = document.createElement('div');
  sentinel.className = 'cl-toc-sentinel';
  toc.before(sentinel);
  new IntersectionObserver(([e]) => toc.classList.toggle('is-stuck', !e.isIntersecting)).observe(sentinel);
  update();
}

async function render() {
  const [d, copy] = await Promise.all([loadJSON('data/latency.json'), loadJSON('data/costs_copy.json')]);
  buildPage(copy);
  mountGlyphs();

  const mounts = [...document.querySelectorAll('[data-chart]')];
  for (const m of mounts) {
    const c = CHARTS[m.dataset.chart];
    if (!c) continue;
    m.classList.add('cl-chart', `cl-chart-${m.dataset.chart}`);
    if (c.html) m.innerHTML = c.html(d);
    else c.host(m, d);
    if (c.after) {
      const card = m.closest('.cl-card') || m;
      card.insertAdjacentHTML('afterend', c.after(d));
    }
    const head = m.closest('.cl-card')?.querySelector('.cl-card-head');
    if (head && c.html) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cl-replay';
      btn.innerHTML = '<svg class="cl-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 1 0 2.3-5.6"/><path d="M3.6 3.6v4.2h4.2"/></svg><span>Replay</span>';
      btn.addEventListener('click', () => replay(m));
      head.append(btn);
    }
  }

  playOnView([...mounts, ...document.querySelectorAll('.cl-section-head, .cl-insights')]);
  window.addEventListener('beforeprint', () => document.querySelectorAll('.cl-chart, .cl-insights').forEach((el) => el.classList.add('is-in')));
  wireTooltip();
  wireToc();
  // A link straight to a section should still land on it once the page is built.
  if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
}

render();
