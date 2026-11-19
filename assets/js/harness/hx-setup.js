import {
  ready, getState, setState, onState, esc, AGENTS, STYLE_NAMES, STYLES, SKILLS, TOOLS, STAGE_OF,
  normSkills, sourceUrl, svgUrl, loadTrajectory, loadNarration, narrationAt, mdMono, diffInserted, openDrawer,
  skillDrawer, allSkillsDrawer, styleDemo, SvgPlayer, Wires, REDUCED, condOf, skillIcon,
} from './hx-core.js';

const ICON = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>',
  pause: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 3h3v10H4zM9 3h3v10H9z"/></svg>',
  step: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3.2 10 8l-7 4.8zM11 3h2.4v10H11z"/></svg>',
  file: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2.5h8.5L19 7v14.5H6z"/><path d="M14 2.5V7h5M9 12h7M9 15.5h7M9 19h4"/></svg>',
  chev: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5"/></svg>',
};
const hint = (text) => `<span class="hx-hint2" aria-hidden="true"><i>${text}</i><svg viewBox="0 0 40 34"><path d="M36 5 C24 2, 12 7, 9 25"/><path d="M3 19 L9 27 L15 20"/></svg></span>`;
const SKILLS_ONLY = SKILLS.filter((s) => !TOOLS.has(s));
const TOOLS_ONLY = SKILLS.filter((s) => TOOLS.has(s));
const tile = (s) => `<button type="button" class="hx-sk${TOOLS.has(s) ? ' is-tool' : ''}" data-skill="${s}" title="Read ${s}/SKILL.md">
  <span class="hx-skico is-${s}">${skillIcon(s)}</span>
  <span class="hx-sktxt"><b>${s}</b><small>${STAGE_OF[s]}</small></span>${TOOLS.has(s) ? '<em class="hx-tooltag">⚙ script</em>' : ''}</button>`;

export function styleDrawer(data, style) {
  const s = data.styles[style];
  openDrawer({
    kicker: 'Requested style u',
    title: esc(STYLE_NAMES[style]),
    html: `
      <div class="hx-demowrap">${styleDemo(style)}<span>What the style means, on a toy diagram</span></div>
      <span class="hx-badge ${s.forbids_image_background ? 'is-yes' : 'is-no'}">Forbids using the image as a background: <b>${s.forbids_image_background ? 'yes' : 'no'}</b></span>
      <div class="hx-label">Exact A0 prompt given to the agent</div>
      <blockquote class="hx-prompt" data-copyroot><p data-copysrc>${esc(s.a0_prompt)}</p>
        <button type="button" class="hx-mini" data-copy>Copy</button></blockquote>
      ${s.forbids_image_background ? '' : '<p class="hx-quiet">This is the only style whose prompt does not say “Do not use the image as a background”. Six of the seven outputs that reveal the source PNG use this style (see Failure modes).</p>'}`,
  });
}

export function instructDrawer(data, item, budget) {
  const ins = data.instruct[item.style];
  const text = budget ? ins.budget : ins.no_budget;
  openDrawer({
    kicker: budget ? 'Instruction file · budget' : 'Instruction file · no budget',
    title: `instruct/${esc(item.style)}.md`,
    sub: budget ? 'Lines added for the budget condition are highlighted.' : '',
    html: `
      <div class="hx-label">Launch message, pasted as the only message of a fresh session</div>
      <div class="hx-bubble">${esc(budget ? item.msg_budget : item.msg_no_budget)}</div>
      <div class="hx-codecard" data-copyroot>
        <div class="hx-codehead"><b>instruct/${esc(item.style)}.md</b><button type="button" class="hx-mini" data-copy>Copy</button></div>
        <pre class="hx-md" data-copysrc data-raw="${esc(text)}">${mdMono(text, budget ? diffInserted(ins.no_budget, ins.budget) : null)}</pre>
      </div>`,
  });
}

class HxCondSwitch extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <div class="hx-cswitch" role="radiogroup" aria-label="Condition">
        <button type="button" role="radio" data-b="1"><b>Budget</b><span>AnimateBanana's own time per diagram, rounded up · stopped at exactly N minutes</span></button>
        <button type="button" role="radio" data-b="0"><b>No budget</b><span>no time limit · the agent stops when it is satisfied</span></button>
      </div>`;
    this.addEventListener('click', (e) => { const b = e.target.closest('[data-b]'); if (b) setState({ budget: b.dataset.b === '1', __hash: true }); });
    const paint = (s) => { for (const b of this.querySelectorAll('[data-b]')) { const on = (b.dataset.b === '1') === s.budget; b.classList.toggle('is-on', on); b.setAttribute('aria-checked', on); } };
    onState(paint);
    ready().then(() => paint(getState()));
  }
}
customElements.define('hx-cond-switch', HxCondSwitch);

const chipOf = (k) => `<span class="hx-lchip is-${k}">${skillIcon(k)}${k === 'none' ? 'custom script' : esc(k)}${TOOLS.has(k) ? ' <em>⚙ tool</em>' : ''}</span>`;
const lineChips = (l) => {
  if (String(l.decision ?? '').trim().toLowerCase() === 'done') return '<span class="hx-lchip is-done">done</span>';
  const used = normSkills(l.skill);
  return (used.length ? used : ['none']).map(chipOf).join('');
};

export function logDrawer(cond, diagram, log) {
  openDrawer({
    kicker: 'Decision file', wide: true,
    title: `decisions.jsonl <small class="hx-dsub">${esc(diagram)}</small>`,
    sub: 'Written by the agent before every action. Each line names the skill or tool it used, or a custom script of its own.',
    html: `<ol class="hx-live is-full">${log.map((l, i) => `<li class="${String(l.decision ?? '').trim().toLowerCase() === 'done' ? 'is-done' : ''} is-typed">
      <span class="hx-lstep">${esc(l.step ?? i + 1)}</span>
      <span class="hx-lchips">${lineChips(l)}</span><span class="hx-ltext"><b>${esc(l.decision ?? '')}</b><i>${esc(l.reason ?? '')}</i></span></li>`).join('')}</ol>`,
  });
}

class HxSetup extends HTMLElement {
  async connectedCallback() {
    const data = (this.data = await ready());
    this.id ||= 'hx-rig';
    this.speed = 1;
    this.innerHTML = `
      <div class="hx-rig2" id="${this.id}-m">
        <div class="hx-col hx-incol">
          <div class="hx-colhead">Inputs</div>
          <figure class="jm-input" data-in="source">
            <figcaption><b>Source diagram</b><i>D</i></figcaption>
            <div class="jm-media hx-src" data-src></div>
            <label class="hx-select"><span>Diagram</span>
              <select data-diagram aria-label="Diagram">${data.items.map((it) => `<option value="${it.diagram}">${esc(it.diagram)}</option>`).join('')}</select>
            </label>
          </figure>
          <div class="jm-input" data-in="style">
            <figcaption><b>Requested style</b><i>u</i></figcaption>
            ${hint('click a style to read its prompt')}
            <div class="hx-pills">${STYLES.map((s) => `<button type="button" class="hx-pill" data-style="${s}">${STYLE_NAMES[s]}</button>`).join('')}</div>
          </div>
          <div class="jm-input" data-in="instruct">
            <figcaption><b>Instruction file</b></figcaption>
            ${hint('click to read it')}
            <button type="button" class="hx-filebtn" data-instructbtn>
              <span class="hx-fileico">${ICON.file}</span>
              <span class="hx-filetxt"><b data-instructname></b><small>task text, output format, decision-log rules</small></span>
              <span class="hx-chev">${ICON.chev}</span>
            </button>
            <div class="hx-bubble is-sm" data-launch></div>
          </div>
        </div>

        <div class="hx-col hx-agentcol">
          <div class="hx-colhead">Agent</div>
          <div class="hx-agent2" data-core>
            <div class="hx-agenttop">
              <span class="hx-chip">Agent</span>
              <div class="hx-seg hx-agentseg2" role="radiogroup" aria-label="Agent harness">
                ${Object.entries(AGENTS).map(([k, a]) => `<button type="button" role="radio" data-agent="${k}">${esc(a.label)}</button>`).join('')}
              </div>
              <span class="jm-led" aria-hidden="true"></span>
            </div>
            <div class="hx-skillhead">
              <b>Skills <i>𝒮</i><small>capabilities the agent carries out with its own model</small></b>
              ${hint('click a skill or tool to read its SKILL.md')}
            </div>
            <div class="hx-dock2">${SKILLS_ONLY.map(tile).join('')}</div>
            <div class="hx-skillhead"><b>Tools<small>skills that come with a working script</small></b><b class="is-right">Or neither<small>the agent's own code</small></b></div>
            <div class="hx-dock2 is-tools">${TOOLS_ONLY.map(tile).join('')}
              <div class="hx-sk is-ghost" data-skill="none"><span class="hx-skico is-none">${skillIcon('none')}</span><span class="hx-sktxt"><b>Custom script</b><small class="is-shown">no predefined skill</small></span></div>
            </div>
            <label class="hx-switch"><input type="checkbox" data-reveal><span>Show which AnimateBanana stage each skill stands in for</span></label>
            <div class="hx-pop" data-pop aria-live="polite"><i class="hx-popptr" data-ptr></i><div class="hx-popbody" data-popbody></div></div>
          </div>
          <div class="jm-startwrap">
            <svg class="jm-hintarrow" viewBox="0 0 90 60" aria-hidden="true"><path d="M80 10 C55 4, 25 14, 22 44"/><path d="M13 36 L22 46 L31 38"/></svg>
            <span class="jm-hint">click to start</span>
            <button type="button" class="jm-start" data-start><span>Start</span></button>
          </div>
          <div class="hx-ctl" data-ctl hidden>
            <button type="button" class="hx-mini" data-pause>${ICON.pause}<span>Pause</span></button>
            <button type="button" class="hx-mini" data-stepbtn>${ICON.step}<span>Step</span></button>
            <span class="hx-speed" role="radiogroup" aria-label="Replay speed">${[1, 2, 4].map((x) => `<button type="button" role="radio" data-speed="${x}">${x}×</button>`).join('')}</span>
          </div>
        </div>

        <div class="hx-col hx-outcol">
          <div class="hx-colhead">Output</div>
          <figure class="jm-input hx-outcard" data-out="svg">
            <figcaption><b>Animation with narration</b><i>Y</i></figcaption>
            <div class="hx-wait" data-wait><p>The agent's animation and narration appear here when the run finishes.</p><button type="button" class="hx-mini" data-showout>Show it now</button></div>
            <div class="jm-reel hx-reel2" data-reel><div class="hx-stage" data-stage></div>
              <button type="button" class="jm-play" data-play aria-label="Play the agent's animation">${ICON.play}</button></div>
            <input type="range" class="hx-range" data-scrub min="0" max="100" step="0.05" value="0" aria-label="Animation time">
            <div class="hx-narr" aria-live="polite"><span class="hx-narrk" data-narrk></span><p data-narr></p></div>
            <button type="button" class="jm-start hx-viewlog" data-viewlog hidden>${ICON.file}<span>View decision file</span></button>
          </figure>
        </div>
      </div>`;

    const m = (this.m = this.querySelector('.hx-rig2'));
    const q = (s) => m.querySelector(s);
    this.wires = new Wires(m, [
      ['source', q('[data-in="source"]'), q('[data-core]')],
      ['style', q('[data-in="style"]'), q('[data-core]')],
      ['instruct', q('[data-in="instruct"]'), q('[data-core]')],
      ['out-svg', q('[data-core]'), q('[data-out="svg"]')],
    ]);
    this.player = new SvgPlayer(q('[data-stage]'), { onTime: (t, p) => this.onTime(t, p) });

    q('[data-diagram]').addEventListener('change', (e) => setState({ diagram: e.target.value, __hash: true }));
    m.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.style) styleDrawer(data, b.dataset.style);
      else if (b.dataset.skill && b.dataset.skill !== 'none') skillDrawer(data, b.dataset.skill);
      else if (b.dataset.agent) setState({ agent: b.dataset.agent, __hash: true });
      else if (b.dataset.speed) this.setSpeed(+b.dataset.speed);
      else if (b.hasAttribute('data-instructbtn')) instructDrawer(data, this.item, getState().budget);
      else if (b.dataset.seek != null) { this.player.pause(); this.player.seek(+b.dataset.seek + 0.05); }
      else if (b.hasAttribute('data-showout')) this.reveal(true);
      else if (b.hasAttribute('data-viewlog')) { const s = getState(); logDrawer(s.cond, s.diagram, this.log || []); }
    });
    q('[data-reveal]').addEventListener('change', (e) => m.classList.toggle('is-reveal', e.target.checked));
    q('[data-play]').addEventListener('click', () => this.player.toggle());
    q('[data-reel]').addEventListener('click', (e) => { if (!e.target.closest('[data-play]') && this.player.playing) this.player.pause(); });
    q('[data-scrub]').addEventListener('input', (e) => { this.player.pause(); this.player.seek(+e.target.value); });
    q('[data-start]').addEventListener('click', () => this.start());
    q('[data-pause]').addEventListener('click', () => (this.timer ? this.halt() : this.resume()));
    q('[data-stepbtn]').addEventListener('click', () => { this.halt(); this.advance(); });
    this.setSpeed(1);
    onState((s) => this.render(s));
    this.render(getState());
  }

  onTime(t, p) {
    const q = (s) => this.m.querySelector(s);
    const r = q('[data-scrub]');
    r.max = p.duration.toFixed(2);
    r.value = t.toFixed(2);
    q('[data-reel]').classList.toggle('is-playing', p.playing);
    const n = narrationAt(this.narr, t);
    const k = q('[data-narrk]'); const tx = q('[data-narr]');
    if (n) {
      if (tx.textContent !== n.narration) tx.textContent = n.narration;
      k.textContent = 'Narration';
    } else { k.textContent = ''; tx.textContent = ''; }
  }

  async render(s) {
    const data = this.data;
    const q = (sel) => this.m.querySelector(sel);
    const it = data.items.find((i) => i.diagram === s.diagram);
    this.item = it;
    this.reset();
    q('[data-diagram]').value = s.diagram;
    q('[data-src]').innerHTML = it.has_source ? `<img src="${sourceUrl(s.diagram)}" alt="Source diagram ${esc(s.diagram)}">` : `<div class="hx-srcph"><span>${esc(s.diagram)}.png</span></div>`;
    for (const b of this.m.querySelectorAll('[data-style]')) b.classList.toggle('is-on', b.dataset.style === it.style);
    for (const b of this.m.querySelectorAll('[data-agent]')) { const on = b.dataset.agent === s.agent; b.classList.toggle('is-on', on); b.setAttribute('aria-checked', on); }
    this.m.dataset.agent = s.agent;
    this.m.classList.toggle('is-budget', s.budget);
    this.m.classList.add('is-waiting');
    q('[data-instructname]').textContent = `instruct/${it.style}.md`;
    q('[data-launch]').innerHTML = `<span>Launch message</span>${esc(s.budget ? it.msg_budget : it.msg_no_budget)}`;
    q('[data-narr]').textContent = '';
    q('[data-narrk]').textContent = '';
    const [log, narr] = await Promise.all([loadTrajectory(s.cond, s.diagram), loadNarration(s.cond, s.diagram)]);
    if (getState().cond !== s.cond || getState().diagram !== s.diagram) return;
    this.log = log; this.narr = narr;
    this.idlePop();
    const ok = await this.player.load(svgUrl(s.cond, s.diagram));
    if (ok && getState().cond === s.cond && getState().diagram === s.diagram) this.player.poster();
  }

  idlePop() {
    const pop = this.m.querySelector('[data-pop]');
    pop.classList.remove('is-step');
    pop.querySelector('[data-ptr]').hidden = true;
    pop.querySelector('[data-popbody]').innerHTML = `<span class="hx-poplab">Decision</span>
      <b>Press Start to watch the agent work through this run.</b>
      <i>Each decision pops up here as the agent invokes a skill, runs a tool or writes a custom script. ${this.log ? `${this.log.length} logged lines.` : ''}</i>`;
  }

  setSpeed(x) {
    this.speed = x;
    for (const b of this.m.querySelectorAll('[data-speed]')) { const on = +b.dataset.speed === x; b.classList.toggle('is-on', on); b.setAttribute('aria-checked', on); }
    if (this.timer) { this.halt(); this.resume(); }
  }

  reset() {
    this.halt();
    clearInterval(this.typer);
    this.i = -1;
    const q = (sel) => this.m.querySelector(sel);
    q('[data-ctl]').hidden = true;
    q('[data-viewlog]').hidden = true;
    q('[data-start] span').textContent = 'Start';
    this.querySelector('.jm-startwrap').classList.remove('is-used');
    q('[data-core]').classList.remove('is-thinking');
    for (const c of this.m.querySelectorAll('.hx-sk')) c.classList.remove('is-lit', 'was-lit');
    this.wires.set(['source', 'style', 'instruct', 'out-svg'], false);
    if (this.log) this.idlePop();
  }

  start() {
    if (!this.log?.length) return;
    this.reset();
    this.player.pause();
    const q = (sel) => this.m.querySelector(sel);
    this.querySelector('.jm-startwrap').classList.add('is-used');
    q('[data-ctl]').hidden = false;
    q('[data-start] span').textContent = 'Replaying…';
    this.m.classList.add('is-waiting');
    this.wires.set(['source', 'style', 'instruct'], true);
    this.resume();
  }

  resume() {
    if (!this.log || this.i >= this.log.length - 1) return;
    this.m.querySelector('[data-core]').classList.add('is-thinking');
    this.m.querySelector('[data-pause] span').textContent = 'Pause';
    this.timer = setInterval(() => this.advance(), (REDUCED ? 500 : 1500) / this.speed);
    this.advance();
  }

  halt() {
    clearInterval(this.timer);
    this.timer = null;
    if (!this.m) return;
    this.m.querySelector('[data-core]')?.classList.remove('is-thinking');
    const p = this.m.querySelector('[data-pause] span');
    if (p) p.textContent = 'Resume';
  }

  advance() {
    if (!this.log || this.i >= this.log.length - 1) return;
    this.i++;
    const l = this.log[this.i];
    const done = String(l.decision ?? '').trim().toLowerCase() === 'done';
    const used = normSkills(l.skill);
    let target = null;
    for (const c of this.m.querySelectorAll('.hx-sk')) {
      if (c.classList.contains('is-lit')) c.classList.add('was-lit');
      const on = c.dataset.skill === 'none' ? used.length === 0 && !done : used.includes(c.dataset.skill);
      c.classList.remove('is-lit');
      if (on) { void c.offsetWidth; c.classList.add('is-lit'); target ||= c; }
    }
    const pop = this.m.querySelector('[data-pop]');
    const body = pop.querySelector('[data-popbody]');
    body.innerHTML = `<span class="hx-poplab">Decision</span><div class="hx-pophead"><span class="hx-lstep">${esc(l.step ?? this.i + 1)}</span>
      <span class="hx-lchips">${lineChips(l)}</span><span class="hx-popcount">${this.i + 1} / ${this.log.length}</span></div>
      <b data-type></b><i data-reason>${esc(l.reason ?? '')}</i>`;
    pop.classList.remove('is-step'); void pop.offsetWidth; pop.classList.add('is-step');
    const ptr = pop.querySelector('[data-ptr]');
    if (target) {
      const pr = pop.getBoundingClientRect(); const tr = target.getBoundingClientRect();
      ptr.hidden = false;
      ptr.style.left = `${Math.max(16, Math.min(pr.width - 16, tr.left + tr.width / 2 - pr.left))}px`;
      ptr.style.height = `${Math.max(10, pr.top - tr.bottom)}px`;
    } else ptr.hidden = true;
    this.type(body.querySelector('[data-type]'), l.decision ?? '', pop);
    if (this.i >= this.log.length - 1) this.finish();
  }

  type(el, text, pop) {
    clearInterval(this.typer);
    pop.classList.remove('is-typed');
    if (REDUCED) { el.textContent = text; pop.classList.add('is-typed'); return; }
    el.setAttribute('data-typing', '');
    let n = 0;
    const per = Math.max(1, Math.ceil(text.length / (36 / Math.min(this.speed, 2))));
    this.typer = setInterval(() => {
      n = Math.min(text.length, n + per);
      el.textContent = text.slice(0, n);
      if (n >= text.length) { clearInterval(this.typer); el.removeAttribute('data-typing'); pop.classList.add('is-typed'); }
    }, 18);
  }

  finish() {
    this.halt();
    const q = (sel) => this.m.querySelector(sel);
    q('[data-start] span').textContent = 'Replay';
    q('[data-pause] span').textContent = 'Pause';
    q('[data-ctl]').hidden = true;
    this.wires.set(['source', 'style', 'instruct'], false);
    this.wires.set(['out-svg'], true);
    setTimeout(() => this.reveal(true), REDUCED ? 0 : 900 / this.speed);
  }

  async reveal(play) {
    this.m.classList.remove('is-waiting');
    this.m.querySelector('[data-viewlog]').hidden = false;
    await this.player.refresh();
    const out = this.m.querySelector('[data-out="svg"]');
    out.classList.add('is-lit');
    setTimeout(() => out.classList.remove('is-lit'), 1600);
    if (play) { this.player.seek(0); this.player.play(); }
  }
}

customElements.define('hx-setup', HxSetup);

class HxRunPicker extends HTMLElement {
  async connectedCallback() {
    const data = await ready();
    this.innerHTML = `
      <div class="hx-picker">
        <label class="hx-select"><span>Diagram</span><select data-d>${data.items.map((it) => `<option value="${it.diagram}">${esc(it.diagram)}</option>`).join('')}</select></label>
        <div class="hx-seg" role="radiogroup" aria-label="Run">${['claude_no_budget', 'claude_budget', 'gemini_no_budget', 'gemini_budget'].map((c) => {
          const [a, ...rest] = c.split('_'); const b = rest.join('_') === 'budget';
          return `<button type="button" role="radio" data-c="${c}" class="is-${a}${b ? ' is-b' : ' is-nb'}">${AGENTS[a].short} · ${b ? 'budget' : 'no budget'}</button>`;
        }).join('')}</div>
      </div>`;
    this.querySelector('[data-d]').addEventListener('change', (e) => setState({ diagram: e.target.value, __hash: true }));
    this.addEventListener('click', (e) => {
      const b = e.target.closest('[data-c]');
      if (!b) return;
      const [a, ...rest] = b.dataset.c.split('_');
      setState({ agent: a, budget: rest.join('_') === 'budget', __hash: true });
    });
    const paint = (s) => {
      this.querySelector('[data-d]').value = s.diagram;
      for (const b of this.querySelectorAll('[data-c]')) { const on = b.dataset.c === s.cond; b.classList.toggle('is-on', on); b.setAttribute('aria-checked', on); }
    };
    onState(paint);
    paint(getState());
  }
}
customElements.define('hx-run-picker', HxRunPicker);

export { condOf, allSkillsDrawer };
