import { ready, esc, AGENTS, fmtMin, AB_COLOR } from './hx-core.js';

const ROWS = [
  { key: 'ab', system: 'Gemini 3.8 Flash', harness: 'AnimateBanana', budget: null, color: AB_COLOR },
  { key: 'claude_budget', system: 'Opus 5', harness: 'Claude Code', budget: true, color: AGENTS.claude.color },
  { key: 'claude_no_budget', system: 'Opus 5', harness: 'Claude Code', budget: false, color: AGENTS.claude.color },
  { key: 'gemini_budget', system: 'Gemini 3.8 Flash', harness: 'Antigravity', budget: true, color: AGENTS.gemini.color },
  { key: 'gemini_no_budget', system: 'Gemini 3.8 Flash', harness: 'Antigravity', budget: false, color: AGENTS.gemini.color },
];
const meter = (v, color) => `<span class="hx-meter" aria-hidden="true"><i style="width:${(v * 100).toFixed(1)}%;background:${color}"></i></span>`;

class HxTable extends HTMLElement {
  async connectedCallback() {
    const d = await ready();
    this.innerHTML = `
      <div class="hx-sumwrap"><table class="hx-sumt" aria-label="Average time, fraction of valid outputs and animation quality per system">
        <thead><tr>
          <th scope="col">System</th><th scope="col">Harness</th><th scope="col">Budget</th>
          <th scope="col" class="is-num">Average time <small>min:sec</small></th>
          <th scope="col">Fraction of valid outputs</th>
          <th scope="col">Animation quality <small>AN</small></th>
        </tr></thead>
        <tbody>${ROWS.map((row) => {
          const g = d.table[row.key];
          const frac = g.valid / g.n;
          const q = g.an;
          return `<tr class="${row.key === 'ab' ? 'is-ab' : ''}">
            <th scope="row"><div class="hx-sys"><span class="hx-sysmark" style="--c:${row.color}"></span><span class="hx-sysname"><b>${esc(row.system)}</b>${row.sub ? `<small>${esc(row.sub)}</small>` : ''}</span></div></th>
            <td>${row.harness ? `<span class="hx-harness${row.key === 'ab' ? ' is-ab' : ''}">${esc(row.harness)}</span>` : '<span class="hx-na">—</span>'}</td>
            <td>${row.budget == null ? '<span class="hx-na">—</span>' : `<span class="hx-bpill ${row.budget ? 'is-b' : 'is-nb'}">${row.budget ? 'With budget' : 'Without budget'}</span>`}</td>
            <td class="is-num"><span class="hx-time">${fmtMin(g.minutes)}</span>${row.key === 'ab' ? '<small class="hx-basis">sets the time budget</small>' : ''}</td>
            <td><div class="hx-metric">${meter(frac, row.color)}<span class="hx-mv">${frac.toFixed(2)}</span><small>${g.valid} of ${g.n}</small></div></td>
            <td><div class="hx-metric">${meter(q, row.color)}<span class="hx-mv is-an">${q.toFixed(3)}</span></div></td></tr>`;
        }).join('')}</tbody>
      </table></div>`;
  }
}

customElements.define('hx-table', HxTable);
