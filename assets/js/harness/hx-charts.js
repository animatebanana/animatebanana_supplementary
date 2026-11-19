import {
  ready, esc, AGENTS, AB_COLOR, CONDS, splitCond, condLabel, skillDrawer,
} from './hx-core.js';

const color = (c) => AGENTS[splitCond(c).agent].color;
const hatchDefs = (id) => `<defs>${Object.entries(AGENTS).map(([k, a]) => `
  <pattern id="${id}-h-${k}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <rect width="6" height="6" fill="${a.color}" opacity=".18"/><rect width="2.4" height="6" fill="${a.color}" opacity=".75"/></pattern>`).join('')}</defs>`;
const fillFor = (id, c) => (splitCond(c).budget ? color(c) : `url(#${id}-h-${splitCond(c).agent})`);

function marker(c, x, y, r = 6, extra = '') {
  const { agent, budget } = splitCond(c);
  const col = AGENTS[agent].color;
  const f = budget ? col : '#fff';
  return agent === 'claude'
    ? `<circle cx="${x}" cy="${y}" r="${r}" fill="${f}" stroke="${col}" stroke-width="2" ${extra}/>`
    : `<rect x="${x - r}" y="${y - r}" width="${r * 2}" height="${r * 2}" rx="2" fill="${f}" stroke="${col}" stroke-width="2" ${extra}/>`;
}

export function legend(withAB = true) {
  const item = (c) => `<span class="hx-lg"><svg viewBox="0 0 16 16" aria-hidden="true">${marker(c, 8, 8, 5)}</svg>${condLabel(c)}</span>`;
  return `<div class="hx-legend">${withAB ? `<span class="hx-lg"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.5" fill="${AB_COLOR}" stroke="#1F1C18" stroke-width="1.6"/></svg>AnimateBanana</span>` : ''}${CONDS.map(item).join('')}
    <span class="hx-lg is-note">filled = budget · hollow = no budget · circle = Claude · square = Gemini</span></div>`;
}

class HxTimeMean extends HTMLElement {
  connectedCallback() {
    const id = 'hxtm';
    const AB = 10.7;
    const groups = [['claude', [['claude_no_budget', 15.2], ['claude_budget', 9.2]]], ['gemini', [['gemini_no_budget', 31.2], ['gemini_budget', 10.4]]]];
    const W = 900; const L = 190; const R = 150; const max = 35; const barH = 34; const gap = 14; const head = 30; const top = 34;
    const x = (v) => L + (v / max) * (W - L - R);
    let y = top; let rows = '';
    for (const [agent, bars] of groups) {
      rows += `<text x="12" y="${y + 18}" class="hx-tmgroup">${esc(AGENTS[agent].label)}</text>`;
      y += head;
      for (const [c, v] of bars) {
        const { budget } = splitCond(c);
        rows += `<g><text x="${L - 12}" y="${y + barH / 2 + 5}" text-anchor="end" class="hx-rowlab">${budget ? 'budget' : 'no budget'}</text>
          <rect x="${L}" y="${y}" width="${x(v) - L}" height="${barH}" rx="4" fill="${fillFor(id, c)}" stroke="${color(c)}" stroke-width="1.6"/>
          <text x="${x(v) + 10}" y="${y + barH / 2 + 5}" class="hx-tmval">${v.toFixed(1)} min <tspan class="hx-tmx">· ${(v / AB).toFixed(1)}×</tspan></text></g>`;
        y += barH + gap;
      }
      y += 8;
    }
    const H = y + 52;
    this.innerHTML = `<svg viewBox="0 0 ${W} ${H + 10}" class="hx-chart" role="img" aria-label="Without a budget, agents take 1.4 to 2.9 times AnimateBanana's time per diagram. Mean minutes: Claude 15.2 without a budget and 9.2 with one; Gemini 31.2 and 10.4; AnimateBanana 10.7.">
      ${hatchDefs(id)}
      ${[0, 10, 20, 30].map((v) => `<line x1="${x(v)}" x2="${x(v)}" y1="${top}" y2="${H - 46}" class="hx-grid"/><text x="${x(v)}" y="${H - 28}" class="hx-tick" text-anchor="middle">${v}</text>`).join('')}
      <text x="${x(30)}" y="${H + 4}" class="hx-tick" text-anchor="middle">minutes per diagram</text>
      <line x1="${x(AB)}" x2="${x(AB)}" y1="${top - 14}" y2="${H - 46}" stroke="#1F1C18" stroke-width="2" stroke-dasharray="5 4"/>
      <rect x="${x(AB) + 6}" y="${top - 30}" width="186" height="22" rx="11" fill="${AB_COLOR}" stroke="#1F1C18" stroke-width="1.4"/>
      <text x="${x(AB) + 99}" y="${top - 15}" text-anchor="middle" class="hx-tmab">AnimateBanana: 10.7 min</text>
      ${rows}
    </svg>
    <div class="hx-legend"><span class="hx-lg"><i class="hx-sw" style="background:repeating-linear-gradient(135deg,#fff 0 3px,#999 3px 5px)"></i>no budget</span><span class="hx-lg"><i class="hx-sw" style="background:#777"></i>budget = AnimateBanana's time on that diagram</span></div>`;
  }
}

const SHARE_KEYS = [['understand_pct', 'Understand the image', '#CDBDEB'], ['build_pct', 'Build SVG + animation', '#F7D9A6'],
  ['check_pct', 'Check and fix', '#A5D8B3'], ['order_narrate_pct', 'Order + narration', '#F4BACB'], ['other_pct', 'Other', '#DDD8CE']];

class HxShares extends HTMLElement {
  async connectedCallback() {
    const d = await ready();
    const W = 960; const L = 170; const R = 10; const rowH = 44; const H = d.stage_shares.length * rowH + 10;
    const pw = W - L - R;
    this.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="hx-chart" role="img" aria-label="Agents spend their time re-reading the image; AnimateBanana spends it checking. Share of time per activity for AnimateBanana and the four agent conditions.">
      ${d.stage_shares.map((r, i) => {
        let acc = 0;
        const y = i * rowH + 6;
        const isAb = r.system === 'ab';
        const tag = isAb ? `<circle cx="14" cy="${y + 15}" r="6" fill="${AB_COLOR}" stroke="#1F1C18" stroke-width="1.8"/>` : `<g>${marker(r.system, 14, y + 15, 5.5)}</g>`;
        return `<g>${tag}<text x="28" y="${y + 19}" class="hx-rowlab is-strong">${esc(r.label)}</text>
          ${SHARE_KEYS.map(([k, lab, c]) => {
            const v = r[k]; const x0 = L + (acc / 100) * pw; const w = (v / 100) * pw; acc += v;
            return v > 0 ? `<g><rect x="${x0}" y="${y}" width="${w}" height="30" fill="${c}" stroke="#1F1C18" stroke-width="1.2"/>
              ${w > 34 ? `<text x="${x0 + w / 2}" y="${y + 19}" text-anchor="middle" class="hx-seg-t">${Math.round(v)}%</text>` : ''}
              <title>${esc(r.label)} · ${lab}: ${v}%</title></g>` : '';
          }).join('')}</g>`;
      }).join('')}
    </svg>
    <div class="hx-legend">${SHARE_KEYS.map(([, lab, c]) => `<span class="hx-lg"><i class="hx-sw" style="background:${c}"></i>${lab}</span>`).join('')}</div>`;
  }
}

class HxHeatmap extends HTMLElement {
  async connectedCallback() {
    const d = await ready();
    const cell = (c, v) => {
      const a = v / 15;
      const col = color(c);
      return `<td class="${v === 0 ? 'is-zero' : ''}" style="--a:${a.toFixed(2)};--c:${col}" title="${esc(condLabel(c))}: ${v} of 15 runs"><span>${v}</span></td>`;
    };
    this.innerHTML = `
      <div class="hx-tablewrap"><table class="hx-heat" aria-label="The only skill both agents kept everywhere was render-frames. Runs using each skill, out of 15, per condition.">
        <thead><tr><th scope="col">Skill <small>and the AnimateBanana stage it stands in for</small></th>${CONDS.map((c) => `<th scope="col" class="is-${splitCond(c).agent}${splitCond(c).budget ? ' is-b' : ' is-nb'}">${esc(condLabel(c))}</th>`).join('')}</tr></thead>
        <tbody>${d.skill_use.map((r) => `<tr><th scope="row"><button type="button" data-skill="${r.skill}">${esc(r.skill)}</button><span class="hx-heatstage">${esc(r.stage.replace(/[()]/g, '').replace(/^./, (c) => c.toUpperCase()))}</span></th>${CONDS.map((c) => cell(c, r[c])).join('')}</tr>`).join('')}</tbody>
      </table></div>
      <p class="hx-cardnote">Each cell: runs (of 15) that used the skill at least once. Click a skill to read its SKILL.md.</p>`;
    this.addEventListener('click', (e) => { const b = e.target.closest('[data-skill]'); if (b) skillDrawer(d, b.dataset.skill); });
  }
}

customElements.define('hx-time-mean', HxTimeMean);
customElements.define('hx-shares', HxShares);
customElements.define('hx-heatmap', HxHeatmap);
