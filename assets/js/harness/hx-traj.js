import {
  ready, getState, onState, esc, condLabel, sourceUrl, svgUrl, loadTrajectory, skillIcon, SvgPlayer, TOOLS, SKILLS, fmtMin, STAGE_OF,
} from './hx-core.js';

const ROWS = [
  { n: 1, stage: 'Converter', k: 'diagram-to-svg', t: '1a_conv' },
  { n: 2, stage: 'Raster integrator', k: 'region-crop', t: '1b_raster' },
  { n: 3, stage: 'Stage-1 critic', k: 'output-review', t: '1c_critic' },
  { n: null, stage: 'Critic renders', k: 'render-frames', t: null, note: 'part of the critic' },
  { n: 4, stage: 'Parser', k: 'diagram-structure', t: '2b_parse' },
  { n: 5, stage: 'Sequencer', k: 'presentation-order', t: '2c_seq' },
  { n: 6, stage: 'Narration drafter', k: 'step-narration', t: '2e_narr' },
  { n: 7, stage: 'Animation designer', k: 'svg-animation', t: '3a_design' },
  { n: null, stage: '', k: 'none', t: null, note: '—' },
];
const chip = (k) => `<span class="hx-lchip is-${k}">${skillIcon(k)}${esc(k === 'none' ? 'custom script' : k)}${TOOLS.has(k) ? ' <em>⚙ tool</em>' : ''}</span>`;
const mmss = (s) => (s == null ? '—' : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`);

class HxTrajectory extends HTMLElement {
  async connectedCallback() {
    this.d = await ready();
    this.innerHTML = `
      <div class="hx-tj">
        <div class="hx-tjtop is-two">
          <figure class="hx-card hx-tjimg"><figcaption>Source diagram <i>D</i><span class="hx-enl">click to enlarge</span></figcaption>
            <button type="button" class="hx-tjmedia" data-open aria-label="Open the source diagram large"><span data-src></span></button></figure>
          <figure class="hx-card hx-tjimg"><figcaption>Agent's final animation <i>Y</i><span class="hx-enl">click to enlarge</span><button type="button" class="hx-mini" data-play>Play</button></figcaption>
            <button type="button" class="hx-tjmedia" data-open aria-label="Open the agent's animation large"><span class="hx-stage" data-stage></span></button></figure>
        </div>
        <figure class="hx-card hx-cmpone">
          <figcaption><b>Comparison of AnimateBanana and the autonomous agent baseline</b><small data-agsub></small></figcaption>
          <div class="hx-cmpgrid"><div class="hx-tablewrap"><table class="hx-cmpt is-one">
            <thead>
              <tr class="is-group"><th colspan="3" scope="colgroup" class="is-ab"><span class="hx-cmptag is-ab">AnimateBanana · Gemini 3.8 Flash</span> linear orchestration: each stage once, in order</th>
                <th colspan="4" scope="colgroup" class="is-ag"><span class="hx-budgetchip" data-budget></span><span class="hx-cmptag" data-tag></span> skills invoked by the agent</th></tr>
              <tr><th scope="col">#</th><th scope="col">Stage</th><th scope="col" class="is-num is-sep">Time <small>min:sec</small></th>
                <th scope="col">Skill given to the agent</th><th scope="col">Invoked at steps</th><th scope="col" class="is-num">Calls</th><th scope="col" class="is-num">Time <small>min:sec</small></th></tr>
            </thead>
            <tbody data-rows></tbody>
          </table></div>
          <aside class="hx-flow"><div class="hx-flowhead"><span class="hx-cmptag" data-tag2></span><b>Decision flow</b><small>the raw decision file, step by step</small></div><ol class="hx-flowlist" data-flow></ol></aside></div>
        </figure>
        <div class="hx-card hx-unused"><span class="hx-label">Skills and tools this run never used</span><div class="hx-unusedlist" data-unused></div></div>
      </div>`;
    this.player = new SvgPlayer(this.querySelector('[data-stage]'), { onTime: (t, p) => { this.querySelector('[data-play]').textContent = p.playing ? 'Pause' : 'Play'; } });
    this.querySelector('[data-play]').addEventListener('click', () => this.player.toggle());
    this.addEventListener('click', (e) => {
      if (e.target.closest('[data-open]')) { const s = getState(); this.player.pause(); dispatchEvent(new CustomEvent('hx:open', { detail: { cond: s.cond, diagram: s.diagram } })); return; }
      const tr = e.target.closest('tr[data-k]');
      if (tr) this.select(tr.dataset.k);
    });
    this.addEventListener('keydown', (e) => { const tr = e.target.closest('tr[data-k]'); if (tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); this.select(tr.dataset.k); } });
    onState((s) => this.render(s));
    this.render(getState());
  }

  async render(s) {
    const d = this.d;
    const it = d.items.find((i) => i.diagram === s.diagram);
    const run = d.runs.find((r) => r.diagram === s.diagram && r.cond === s.cond);
    this.querySelector('[data-src]').innerHTML = it.has_source ? `<img src="${sourceUrl(s.diagram)}" alt="Source diagram ${esc(s.diagram)}">` : '';
    const tag = this.querySelector('[data-tag]');
    tag.textContent = condLabel(s.cond);
    tag.className = `hx-cmptag is-${s.agent}`;
    const bud = this.querySelector('[data-budget]');
    bud.classList.toggle('is-none', !s.budget);
    bud.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.6 2M9.5 2.5h5M12 2.5V6"/></svg>${s.budget ? `Assigned time budget <b>${run.budget_min}:00</b> <small>min:sec</small>` : 'No time budget assigned'}`;
    const tag2 = this.querySelector('[data-tag2]');
    tag2.textContent = condLabel(s.cond);
    tag2.className = `hx-cmptag is-${s.agent}`;
    const raw = await loadTrajectory(s.cond, s.diagram);
    if (getState().cond !== s.cond || getState().diagram !== s.diagram) return;
    const body = raw.filter((l) => String(l.decision ?? '').trim().toLowerCase() !== 'done');
    const seq = run.m.seq;
    const t = raw.map((l) => (typeof l.t === 'number' ? l.t : null));
    const dur = body.map((_, i) => (t[i] != null && t[i + 1] != null ? (t[i + 1] - t[i] + 86400) % 86400 : null));
    this.body = body; this.seq = seq;
    const timed = s.budget;
    this.querySelector('[data-agsub]').textContent = timed
      ? `${condLabel(s.cond)}: ${body.length} logged steps, ${fmtMin(run.minutes)} in total against a ${run.budget_min}:00 budget. Click a row to highlight its steps in the decision flow.`
      : `${condLabel(s.cond)}: ${body.length} logged steps, ${fmtMin(run.minutes)} in total. No-budget logs carry no timestamps, so per-skill times are not available. Click a row to highlight its steps in the decision flow.`;
    const abTotal = it.ab_s;
    this.querySelector('[data-rows]').innerHTML = ROWS.map((r) => {
      const idx = seq.map((x, i) => (x === r.k ? i : -1)).filter((i) => i >= 0);
      const time = timed && idx.length ? idx.reduce((a, i) => (a == null || dur[i] == null ? null : a + dur[i]), 0) : null;
      const abT = r.t ? mmss(it.ab_stage_s[r.t]) : `<span class="hx-notab">${r.note}</span>`;
      return `<tr data-k="${r.k}" tabindex="0" class="${r.k === 'none' ? 'is-custom' : ''}${idx.length ? '' : ' is-unused'}">
        <td>${r.n ? `<span class="hx-abn">${r.n}</span>` : ''}</td><th scope="row">${esc(r.stage)}</th><td class="is-num is-sep">${abT}</td>
        <td>${chip(r.k)}</td>
        <td>${idx.length ? `<div class="hx-tjused">${idx.map((i) => `<span>${i + 1}</span>`).join('')}</div>` : '<span class="hx-notused">not used</span>'}</td>
        <td class="is-num">${idx.length || '—'}</td><td class="is-num">${timed ? (idx.length ? mmss(time) : '—') : '—'}</td></tr>`;
    }).join('') + `<tr class="is-total"><td></td><th scope="row">Total</th><td class="is-num is-sep">${mmss(abTotal)}</td><td></td><td></td>
        <td class="is-num">${body.length}</td><td class="is-num">${fmtMin(run.minutes)}</td></tr>`;
    const used = new Set(seq);
    const unused = SKILLS.filter((k) => !used.has(k));
    this.querySelector('[data-unused]').innerHTML = unused.length
      ? unused.map((k) => `<span class="hx-unusedchip">${skillIcon(k)}<b>${esc(k)}</b><small>${TOOLS.has(k) ? 'tool' : 'skill'} · ${esc(k === 'output-review' ? 'Critics' : k === 'render-frames' ? 'Critic renders' : STAGE_OF[k])}</small></span>`).join('')
      : '<span class="hx-okchip">None: every skill and tool was used at least once.</span>';
    this.querySelector('[data-flow]').innerHTML = body.map((l, i) => `<li data-i="${i}" data-k="${seq[i]}"><span class="hx-lstep">${i + 1}</span>
      <div class="hx-flowtxt">${chip(seq[i])}<b>${esc(l.decision ?? '')}</b><i>${esc(l.reason ?? '')}</i></div></li>`).join('');
    this.select(null);
    const ok = await this.player.load(svgUrl(s.cond, s.diagram));
    if (ok && getState().cond === s.cond && getState().diagram === s.diagram) this.player.poster();
  }

  select(k) {
    if (!this.seq) return;
    for (const tr of this.querySelectorAll('tr[data-k]')) tr.classList.toggle('is-on', tr.dataset.k === k);
    const flow = this.querySelector('[data-flow]');
    flow.classList.toggle('is-filtered', !!k);
    let first = null;
    for (const li of flow.children) {
      const hit = !!k && li.dataset.k === k;
      li.classList.toggle('is-hit', hit);
      if (hit && !first) first = li;
    }
    flow.scrollTop = first ? first.offsetTop - flow.offsetTop - 8 : 0;
  }
}

customElements.define('hx-trajectory', HxTrajectory);
