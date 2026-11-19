import { esc, ready, condLabel, svgUrl, SvgPlayer, onVisible, AGENTS, splitCond } from './hx-core.js';

class HxScrubber extends HTMLElement {
  connectedCallback() {
    const frames = this.getAttribute('frames').split(',');
    const alt = this.getAttribute('alt') || '';
    let notes = [];
    try { notes = JSON.parse(this.getAttribute('notes') || '[]'); } catch { }
    const f = frames[+(this.getAttribute('start') || 0)];
    this.innerHTML = `
      <div class="hx-scrubstage">
        <img src="${esc(f)}" alt="${esc(alt)}" loading="lazy">
        <svg class="hx-anno" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          ${notes.map((n) => `<g class="is-on"><ellipse cx="${n.x + n.w / 2}" cy="${n.y + n.h / 2}" rx="${n.w / 2}" ry="${n.h / 2}" /></g>`).join('')}
        </svg>
        ${notes.map((n) => `<span class="hx-annolab is-on" style="left:${n.lx}%;top:${n.ly}%">${esc(n.label)}</span>`).join('')}
      </div>`;
  }
}

customElements.define('hx-scrubber', HxScrubber);


const poster = (stage, cond, d) => onVisible(stage, async () => {
  const p = new SvgPlayer(stage);
  if (await p.load(svgUrl(cond, d))) p.poster();
}, '300px');
const open = (cond, diagram) => dispatchEvent(new CustomEvent('hx:open', { detail: { cond, diagram, noReplay: true } }));

class HxPairGrid extends HTMLElement {
  async connectedCallback() {
    const d = await ready();
    const runs = d.runs.filter((r) => r.cond === 'claude_budget' && r.rasters_dropped);
    this.innerHTML = `<div class="hx-wgrid is-2">${runs.map((r) => `
      <figure class="hx-wcell">
        <figcaption>${esc(r.diagram)}</figcaption>
        <div class="hx-wpair">
          <button type="button" class="hx-wshot" data-c="claude_no_budget" data-d="${r.diagram}" aria-label="Open ${esc(r.diagram)}, Claude without a budget"><span class="hx-stage"></span><em>Without a budget</em></button>
          <button type="button" class="hx-wshot is-b" data-c="claude_budget" data-d="${r.diagram}" aria-label="Open ${esc(r.diagram)}, Claude with a budget"><span class="hx-stage"></span><em>With a budget</em></button>
        </div>
      </figure>`).join('')}</div>`;
    for (const b of this.querySelectorAll('.hx-wshot')) poster(b.querySelector('.hx-stage'), b.dataset.c, b.dataset.d);
    this.addEventListener('click', (e) => { const b = e.target.closest('.hx-wshot'); if (b) open(b.dataset.c, b.dataset.d); });
  }
}

class HxRevealGrid extends HTMLElement {
  async connectedCallback() {
    const d = await ready();
    const runs = d.runs.filter((r) => r.reveals_source);
    this.innerHTML = `<div class="hx-wgrid is-4">${runs.map((r) => `
      <figure class="hx-wcell">
        <button type="button" class="hx-wshot is-single" data-c="${r.cond}" data-d="${r.diagram}" aria-label="Open ${esc(r.diagram)}, ${esc(condLabel(r.cond))}"><span class="hx-stage"></span></button>
        <figcaption><span class="hx-dot" style="--c:${AGENTS[splitCond(r.cond).agent].color}"></span>${esc(condLabel(r.cond))}<small>${esc(r.diagram)}</small></figcaption>
      </figure>`).join('')}</div>`;
    for (const b of this.querySelectorAll('.hx-wshot')) poster(b.querySelector('.hx-stage'), b.dataset.c, b.dataset.d);
    this.addEventListener('click', (e) => { const b = e.target.closest('.hx-wshot'); if (b) open(b.dataset.c, b.dataset.d); });
  }
}

class HxBudgetUse extends HTMLElement {
  async connectedCallback() {
    const d = await ready();
    const its = d.items;
    const run = (dg, c) => d.runs.find((r) => r.diagram === dg && r.cond === c);
    const W = 900; const L = 210; const R = 60; const rowH = 30; const top = 30; const max = 150;
    const x = (v) => L + (v / max) * (W - L - R);
    const H = top + its.length * rowH + 40;
    const bar = (c, v, y) => `<rect x="${L}" y="${y}" width="${x(v) - L}" height="10" rx="2" fill="${AGENTS[splitCond(c).agent].color}" opacity="${v > 100 ? 1 : 0.85}"/>
      <text x="${x(v) + 6}" y="${y + 9}" class="hx-val">${v}%</text>`;
    this.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="hx-chart" role="img" aria-label="Share of the time budget each budgeted run used, per diagram. Claude used 87% on average and Gemini 95%.">
      ${[0, 50, 100, 150].map((v) => `<line x1="${x(v)}" x2="${x(v)}" y1="${top - 8}" y2="${H - 34}" class="hx-grid"/><text x="${x(v)}" y="${H - 16}" class="hx-tick" text-anchor="middle">${v}%</text>`).join('')}
      <line x1="${x(100)}" x2="${x(100)}" y1="${top - 14}" y2="${H - 34}" stroke="#1F1C18" stroke-width="2" stroke-dasharray="5 4"/>
      <text x="${x(100) + 6}" y="${top - 16}" class="hx-tick">full budget</text>
      ${its.map((it, i) => {
        const y = top + i * rowH;
        const c = run(it.diagram, 'claude_budget'); const g = run(it.diagram, 'gemini_budget');
        return `<g><title>${esc(it.diagram)}: Claude ${c.budget_use_pct}%, Gemini ${g.budget_use_pct}% of a ${it.budget_min}-minute budget</title>
          <text x="${L - 10}" y="${y + 15}" text-anchor="end" class="hx-rowlab">${esc(it.diagram)}</text>
          ${bar('claude_budget', c.budget_use_pct, y + 2)}${bar('gemini_budget', g.budget_use_pct, y + 14)}</g>`;
      }).join('')}
    </svg>
    <div class="hx-legend"><span class="hx-lg"><i class="hx-sw" style="background:${AGENTS.claude.color}"></i>Claude Code · Opus 5 (87% on average)</span><span class="hx-lg"><i class="hx-sw" style="background:${AGENTS.gemini.color}"></i>Antigravity · Gemini 3.8 Flash (95% on average)</span></div>`;
  }
}

customElements.define('hx-pair-grid', HxPairGrid);
customElements.define('hx-reveal-grid', HxRevealGrid);
customElements.define('hx-budget-use', HxBudgetUse);
