import { loadJSON } from '../lib/data-loader.js';
import { escapeHtml as esc } from '../lib/format.js';

export { esc };

export const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

let dataP;
export const getData = () => (dataP ||= loadJSON('data/harness/harness.json?v=11'));
export const hasFile = (data, kind, d) => !!data.items.find((i) => i.diagram === d)?.[kind === 'ab' ? 'has_ab' : 'has_source'];

export const AGENTS = {
  claude: { label: 'Claude Code · Opus 5', harness: 'Claude Code', model: 'Opus 5', short: 'Claude', color: '#D97757' },
  gemini: { label: 'Antigravity · Gemini 3.8 Flash', harness: 'Antigravity', model: 'Gemini 3.8 Flash', short: 'Gemini', color: '#3D6BE0' },
};
export const AB_COLOR = '#F2C94C';
export const CONDS = ['claude_no_budget', 'claude_budget', 'gemini_no_budget', 'gemini_budget'];
export const condOf = (agent, budget) => `${agent}_${budget ? 'budget' : 'no_budget'}`;
export const splitCond = (c) => ({ agent: c.split('_')[0], budget: c.endsWith('_budget') && !c.endsWith('no_budget') });
export const condLabel = (c) => {
  const { agent, budget } = splitCond(c);
  return `${AGENTS[agent].short} · ${budget ? 'budget' : 'no budget'}`;
};

export const STYLE_NAMES = {
  alpha_masking: 'Alpha Masking', colour_pop: 'Colour Pop', hopping_bounding_box: 'Hopping Bounding Box',
  progressive_reveal: 'Progressive Reveal', sliding_bounding_box: 'Sliding Bounding Box',
};
export const STYLES = Object.keys(STYLE_NAMES);

export const SKILLS = ['diagram-structure', 'diagram-to-svg', 'output-review', 'presentation-order',
  'region-crop', 'render-frames', 'step-narration', 'svg-animation'];
export const TOOLS = new Set(['region-crop', 'render-frames']);
export const STAGE_OF = {
  'diagram-to-svg': 'Converter', 'region-crop': 'Raster integrator', 'diagram-structure': 'Parser',
  'presentation-order': 'Sequencer', 'step-narration': 'Narration drafter', 'svg-animation': 'Animation designer',
  'output-review': 'Critics', 'render-frames': 'critic renders',
};
export const AB_ORDER = ['diagram-to-svg', 'region-crop', 'diagram-structure', 'presentation-order',
  'step-narration', 'svg-animation', 'output-review'];

export function normSkills(raw) {
  const s = String(raw ?? 'none').toLowerCase().replace(/\/skill\.md/g, '').split('(')[0];
  return [...new Set(s.split(/[+,]/).map((x) => x.trim()).filter((x) => SKILLS.includes(x)))];
}

export const fmtMin = (m) => {
  if (m == null || Number.isNaN(m)) return '—';
  const s = Math.round(m * 60);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
export const short = (d) => d.replace(/^CVPR_2025_/, '').replace(/^ICCV_2023_set5_0*/, 'ICCV ').replace(/^WACV_2024_set5_0*/, 'WACV ')
  .replace(/^Paper2Fig_pipe_diff_0*/, 'Paper2Fig ').replace(/^CVPR_SET2_0*/, 'CVPR-S2 ');

export const sourceUrl = (d) => `assets/harness/source/${d}.png`;
export const svgUrl = (cond, d) => `assets/harness/gallery/${cond}/${d}.svg`;

const trajCache = new Map();
export function loadTrajectory(cond, d) {
  const k = `${cond}/${d}`;
  if (!trajCache.has(k)) {
    trajCache.set(k, fetch(`data/harness/trajectories/${k}.jsonl`).then((r) => (r.ok ? r.text() : '')).then((t) =>
      t.split(/\r?\n/).filter((l) => l.trim()).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean)));
  }
  return trajCache.get(k);
}

const narrCache = new Map();
export function loadNarration(cond, d) {
  const k = `${cond}/${d}`;
  if (!narrCache.has(k)) {
    narrCache.set(k, fetch(`data/harness/narration/${k}.json`).then((r) => (r.ok ? r.json() : [])).catch(() => []).then((x) => (Array.isArray(x) ? x : [])));
  }
  return narrCache.get(k);
}
export function narrationAt(list, t) {
  if (!list?.length) return null;
  let cur = null;
  for (const s of list) if (t + 1e-3 >= (s.start ?? 0)) cur = s;
  return cur || list[0];
}

export const SKILL_ICON = {
  'diagram-structure': '<rect x="9" y="3" width="6" height="5" rx="1"/><rect x="3" y="16" width="6" height="5" rx="1"/><rect x="15" y="16" width="6" height="5" rx="1"/><path d="M12 8v4M6 16v-4h12v4"/>',
  'diagram-to-svg': '<path d="M8 8l-4 4 4 4M16 8l4 4-4 4M13.5 5.5l-3 13"/>',
  'output-review': '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M20 20l-4.6-4.6M7.8 10.6l1.9 1.9 3.4-3.6"/>',
  'presentation-order': '<path d="M9.5 6H20M9.5 12H20M9.5 18H20"/><circle cx="5" cy="6" r="1.6"/><circle cx="5" cy="12" r="1.6"/><circle cx="5" cy="18" r="1.6"/>',
  'region-crop': '<path d="M6 2v14a2 2 0 0 0 2 2h14M2 6h14a2 2 0 0 1 2 2v14"/>',
  'render-frames': '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M17 5v14M3 9.5h4M3 14.5h4M17 9.5h4M17 14.5h4"/>',
  'step-narration': '<path d="M4 5h16v10H10l-5 4v-4H4z"/><path d="M8 9h8M8 12h5"/>',
  'svg-animation': '<path d="M6 4.5l11 7.5-11 7.5z"/><path d="M19.5 7.5c1.6 2.6 1.6 6.4 0 9"/>',
  none: '<path d="M14.7 6.3a4 4 0 0 0-5.3 5.3L3.5 17.5l3 3 5.9-5.9a4 4 0 0 0 5.3-5.3l-2.5 2.5-2.4-.6-.6-2.4z"/>',
};
export const skillIcon = (k, cls = 'hx-ico') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${SKILL_ICON[k] || SKILL_ICON.none}</svg>`;

const existCache = new Map();
export const exists = (url) => {
  if (!existCache.has(url)) existCache.set(url, fetch(url, { method: 'HEAD' }).then((r) => r.ok).catch(() => false));
  return existCache.get(url);
};

const state = { diagram: 'CVPR_2025_arch01051', agent: 'claude', budget: true };
const listeners = new Set();
export const getState = () => ({ ...state, cond: condOf(state.agent, state.budget) });
export function setState({ __hash, ...patch }, { scroll = null } = {}) {
  Object.assign(state, patch);
  const s = getState();
  const hash = `#run=${s.cond}/${s.diagram}`;
  if (location.hash.startsWith('#run=') || __hash) history.replaceState(null, '', hash);
  for (const fn of listeners) fn(s);
  if (scroll) document.getElementById(scroll)?.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
}
export const onState = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export function readHash(items) {
  const m = location.hash.match(/^#run=([a-z_]+)\/([\w.-]+)$/);
  if (!m || !CONDS.includes(m[1]) || !items.some((i) => i.diagram === m[2])) return false;
  const { agent, budget } = splitCond(m[1]);
  Object.assign(state, { agent, budget, diagram: m[2] });
  return true;
}
export function linkRun(cond, d) { return `#run=${cond}/${d}`; }
let readyP;
export const ready = () => (readyP ||= getData().then((d) => { readHash(d.items); return d; }));

export function mdMono(text, mark = null) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  let fence = false;
  return lines.map((ln, i) => {
    let h = esc(ln);
    const isFence = /^```/.test(ln);
    if (isFence) fence = !fence;
    if (isFence || fence) h = `<span class="md-code">${h || ' '}</span>`;
    else if (/^#{1,6}\s/.test(ln)) h = `<span class="md-h">${h}</span>`;
    else if (/^---$/.test(ln)) h = `<span class="md-fm">${h}</span>`;
    else h = h.replace(/\*\*([^*]+)\*\*/g, '<b>**$1**</b>').replace(/`([^`]+)`/g, '<span class="md-tick">`$1`</span>');
    return `<span class="md-line${mark && mark.has(i) ? ' is-ins' : ''}">${h || ' '}</span>`;
  }).join('');
}

export function diffInserted(base, next) {
  const a = base.replace(/\r\n/g, '\n').split('\n');
  const b = next.replace(/\r\n/g, '\n').split('\n');
  const n = a.length; const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ins = new Set();
  let i = 0; let j = 0;
  while (j < m) {
    if (i < n && a[i] === b[j]) { i++; j++; } else if (i < n && dp[i + 1][j] >= dp[i][j + 1]) i++; else { ins.add(j); j++; }
  }
  return ins;
}

function smilDuration(svg) {
  let end = 0;
  const secs = (v) => {
    const m = String(v || '').trim().match(/^(-?[\d.]+)(ms|s|min)?$/);
    if (!m) return null;
    const x = parseFloat(m[1]);
    return m[2] === 'ms' ? x / 1000 : m[2] === 'min' ? x * 60 : x;
  };
  for (const el of svg.querySelectorAll('animate, animateTransform, animateMotion, set, animateColor')) {
    const dur = secs(el.getAttribute('dur')) ?? 0;
    const begins = String(el.getAttribute('begin') || '0').split(';').map(secs).filter((x) => x != null);
    const b = begins.length ? Math.max(...begins) : 0;
    const rc = el.getAttribute('repeatCount');
    const reps = rc && rc !== 'indefinite' ? parseFloat(rc) || 1 : 1;
    end = Math.max(end, b + dur * reps);
  }
  return end;
}

export class SvgPlayer {
  constructor(stage, { onTime, loop = false } = {}) {
    this.stage = stage;
    this.onTime = onTime;
    this.loop = loop;
    this.t = 0;
    this.duration = 0;
    this.playing = false;
    this.anims = [];
    this.tick = this.tick.bind(this);
  }

  async load(url) {
    this.pause();
    this.url = url;
    const token = (this.token = {});
    this.stage.replaceChildren();
    this.svg = null;
    this.anims = [];
    let text = '';
    try { const r = await fetch(url); if (!r.ok) throw new Error(); text = await r.text(); } catch { return false; }
    if (token !== this.token) return false;
    const host = document.createElement('div');
    host.className = 'hx-svghost';
    host.attachShadow({ mode: 'open' });
    host.shadowRoot.innerHTML = `<style>:host{display:block;width:100%;height:100%}svg{display:block;width:100%;height:100%}</style>${text.replace(/^﻿?<\?xml[^>]*>/, '')}`;
    const svg = host.shadowRoot.querySelector('svg');
    if (!svg) return false;
    if (!svg.getAttribute('viewBox')) {
      const w = parseFloat(svg.getAttribute('width')); const h = parseFloat(svg.getAttribute('height'));
      if (w && h) svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    }
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    this.stage.append(host);
    this.svg = svg;
    this.host = host;
    try { svg.pauseAnimations?.(); } catch { }
    for (let i = 0; i < 20 && token === this.token; i++) {
      this.scan();
      if (this.anims.length || i > 3) break;
      await new Promise((r) => setTimeout(r, 40));
    }
    return true;
  }

  scan() {
    const { host, svg } = this;
    if (!svg) return;
    this.anims = host.shadowRoot.getAnimations ? host.shadowRoot.getAnimations() : svg.getAnimations({ subtree: true });
    let cssEnd = 0;
    for (const a of this.anims) {
      a.pause();
      const tm = a.effect?.getTiming?.() || {};
      const it = Number.isFinite(tm.iterations) ? tm.iterations : 1;
      const d = typeof tm.duration === 'number' ? tm.duration : 0;
      cssEnd = Math.max(cssEnd, ((tm.delay || 0) + d * it + (tm.endDelay || 0)) / 1000);
    }
    this.duration = Math.min(Math.max(cssEnd, smilDuration(svg), 1), 600);
    this.loops = this.anims.some((a) => !Number.isFinite(a.effect?.getTiming?.().iterations ?? 1))
      || !!svg.querySelector('[repeatCount="indefinite"]');
  }

  async refresh() {
    for (let i = 0; i < 10 && this.svg; i++) {
      await new Promise((r) => setTimeout(r, 40));
      this.scan();
      if (this.anims.length) break;
    }
  }

  poster() {
    this.seek(this.loops ? this.duration * 0.92 : this.duration);
    if (!this.anims.length && this.svg && !this.retried) {
      this.retried = true;
      setTimeout(async () => { await this.refresh(); if (this.anims.length && !this.playing) this.seek(this.loops ? this.duration * 0.92 : this.duration); }, 400);
    }
  }

  seek(t) {
    this.t = Math.max(0, Math.min(t, this.duration));
    const tt = Math.min(this.t, Math.max(0, this.duration - 0.001));
    try { this.svg?.pauseAnimations?.(); this.svg?.setCurrentTime?.(tt); } catch { }
    for (const a of this.anims) { try { a.currentTime = tt * 1000; } catch { } }
    this.onTime?.(this.t, this);
  }

  play() {
    if (!this.svg || this.playing) return;
    if (this.t >= this.duration - 0.01) this.seek(0);
    this.playing = true;
    this.t0 = this.t;
    this.w0 = performance.now();
    this.timer = setInterval(this.tick, 33);
    this.onTime?.(this.t, this);
  }

  pause() {
    if (!this.playing) return;
    this.playing = false;
    clearInterval(this.timer);
    this.onTime?.(this.t, this);
  }

  toggle() { this.playing ? this.pause() : this.play(); }

  tick() {
    let t = this.t0 + (performance.now() - this.w0) / 1000;
    if (t >= this.duration) {
      if (this.loop) { this.t0 = 0; this.w0 = performance.now(); t = 0; } else { this.seek(this.duration); this.pause(); return; }
    }
    this.seek(t);
  }

  destroy() { this.pause(); this.token = null; this.stage.replaceChildren(); }
}

let drawer;
export function openDrawer({ kicker = '', title, sub = '', html, wide = false }) {
  if (!drawer) {
    drawer = document.createElement('div');
    drawer.className = 'hx-drawer';
    drawer.innerHTML = `
      <div class="hx-drawer-back" data-close></div>
      <aside class="hx-drawer-panel" role="dialog" aria-modal="true" aria-labelledby="hx-drawer-title" tabindex="-1">
        <header class="hx-drawer-head">
          <div><span class="hx-kicker" data-dk></span><h3 id="hx-drawer-title" data-dt></h3><p data-ds></p></div>
          <button type="button" class="hx-x" data-close aria-label="Close">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l10 10M13 3 3 13"/></svg></button>
        </header>
        <div class="hx-drawer-body" data-db></div>
      </aside>`;
    document.body.append(drawer);
    drawer.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeDrawer(); });
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && drawer.classList.contains('is-open')) closeDrawer(); });
  }
  drawer.querySelector('[data-dk]').textContent = kicker;
  drawer.querySelector('[data-dt]').innerHTML = title;
  const ds = drawer.querySelector('[data-ds]');
  ds.innerHTML = sub; ds.hidden = !sub;
  drawer.querySelector('[data-db]').innerHTML = html;
  drawer.classList.toggle('is-wide', wide);
  drawer.__return = document.activeElement;
  drawer.classList.add('is-open');
  document.documentElement.classList.add('hx-lock');
  drawer.querySelector('.hx-drawer-panel').focus({ preventScroll: true });
  wireCopy(drawer);
  return drawer.querySelector('[data-db]');
}
export function closeDrawer() {
  if (!drawer) return;
  drawer.classList.remove('is-open');
  document.documentElement.classList.remove('hx-lock');
  drawer.__return?.focus?.({ preventScroll: true });
}

export function wireCopy(root) {
  for (const b of root.querySelectorAll('[data-copy]:not([data-wired])')) {
    b.dataset.wired = '1';
    b.addEventListener('click', async () => {
      const src = root.querySelector(b.dataset.copy) || b.closest('[data-copyroot]')?.querySelector('[data-copysrc]');
      const text = src?.dataset.raw ?? src?.textContent ?? '';
      try { await navigator.clipboard.writeText(text); b.textContent = 'Copied'; } catch { b.textContent = 'Select and copy'; }
      setTimeout(() => { b.textContent = 'Copy'; }, 1400);
    });
  }
}

export function skillDrawer(data, name) {
  const s = data.skills[name];
  const tool = TOOLS.has(name);
  const html = `
    <div class="hx-codecard" data-copyroot>
      <div class="hx-codehead"><b>.claude/skills/${esc(name)}/SKILL.md</b><button type="button" class="hx-mini" data-copy>Copy</button></div>
      <pre class="hx-md" data-copysrc data-raw="${esc(s.md)}">${mdMono(s.md)}</pre>
    </div>
    ${tool ? `<details class="hx-script" data-copyroot>
      <summary><span>scripts/${esc(s.script_name)}</span><em>⚙ script given to the agent</em></summary>
      <div class="hx-codehead"><b>${esc(s.script_name)}</b><button type="button" class="hx-mini" data-copy>Copy</button></div>
      <pre class="hx-md hx-py" data-copysrc data-raw="${esc(s.script)}">${esc(s.script)}</pre>
    </details>` : ''}
    <p class="hx-quiet">The same files were given to both harnesses (<code>.claude/skills</code> and <code>.agents/skills</code> are identical). No order, schemas, rubrics, thresholds or examples.</p>`;
  openDrawer({ kicker: tool ? 'Tool · skill with a script' : 'Skill', title: esc(name), html });
}

export function allSkillsDrawer(data) {
  openDrawer({
    kicker: 'Stage descriptions', title: 'The 8 skills, exactly as the agents saw them', wide: true,
    html: `<div class="hx-skillgrid">${SKILLS.map((n) => `
      <div class="hx-codecard"><div class="hx-codehead"><b>${esc(n)}/SKILL.md</b>${TOOLS.has(n) ? '<em class="hx-gear">⚙ script</em>' : ''}</div>
        <pre class="hx-md">${mdMono(data.skills[n].md)}</pre></div>`).join('')}</div>
      <p class="hx-quiet">Listed alphabetically, as in the workspace. The same files were given to both harnesses. No order, schemas, rubrics, thresholds or examples.</p>`,
  });
}

const DEMO_BOXES = [[12, 42], [84, 10], [84, 74], [156, 42], [228, 42]];
const DEMO_FILL = ['#FDE2C4', '#D7E8FB', '#DDF1DF', '#F4D9EC', '#FFF0B3'];
const DEMO_STROKE = ['#C77A2E', '#3D6BE0', '#3C8A4E', '#A0438A', '#B08900'];

export function styleDemo(style) {
  const N = DEMO_BOXES.length; const T = 7.5;
  const pct = (i) => ((i + 0.5) / N) * 80;
  const id = `hxd-${style}`;
  let css = ''; let extra = '';
  const box = (i, fill, stroke, cls = '') => `<rect class="${cls}" x="${DEMO_BOXES[i][0]}" y="${DEMO_BOXES[i][1]}" width="56" height="30" rx="7" fill="${fill}" stroke="${stroke}" stroke-width="1.6"/>`;
  const edges = `<g class="d-edges" stroke="#8A8378" stroke-width="1.4" fill="none" marker-end="url(#${id}-a)">
      <path d="M68 57 L84 30"/><path d="M68 57 L84 86"/><path d="M140 25 L156 52"/><path d="M140 89 L156 62"/><path d="M212 57 L228 57"/></g>`;
  const marker = `<defs><marker id="${id}-a" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10z" fill="#8A8378"/></marker></defs>`;
  let body = '';
  if (style === 'progressive_reveal') {
    body = `${DEMO_BOXES.map((_, i) => `<g class="d-r${i}">${box(i, DEMO_FILL[i], DEMO_STROKE[i])}</g>`).join('')}`;
    css = DEMO_BOXES.map((_, i) => `@keyframes ${id}-${i}{0%,${pct(i) - 1}%{opacity:0}${pct(i) + 3}%,94%{opacity:1}100%{opacity:0}} .d-r${i}{animation:${id}-${i} ${T}s infinite}`).join('')
      + `.d-edges{animation:${id}-e ${T}s infinite}@keyframes ${id}-e{0%,${pct(1)}%{opacity:0}${pct(4) + 3}%,94%{opacity:1}100%{opacity:0}}`;
  } else if (style === 'alpha_masking') {
    body = `${DEMO_BOXES.map((_, i) => box(i, DEMO_FILL[i], DEMO_STROKE[i])).join('')}
      ${DEMO_BOXES.map((b, i) => `<rect class="d-v${i}" x="${b[0] - 4}" y="${b[1] - 4}" width="64" height="38" rx="8" fill="#FAF7F0"/>`).join('')}`;
    css = DEMO_BOXES.map((_, i) => `@keyframes ${id}-${i}{0%,${pct(i) - 1}%{opacity:.68}${pct(i) + 4}%,94%{opacity:0}100%{opacity:.68}} .d-v${i}{opacity:.68;animation:${id}-${i} ${T}s infinite}`).join('');
    extra = `<rect class="d-veil" x="0" y="0" width="300" height="114" fill="#FAF7F0" opacity=".28"/>`;
  } else if (style === 'colour_pop') {
    body = `${DEMO_BOXES.map((_, i) => box(i, '#E4E2DE', '#8F8B85')).join('')}${DEMO_BOXES.map((_, i) => `<g class="d-c${i}">${box(i, DEMO_FILL[i], DEMO_STROKE[i])}</g>`).join('')}`;
    css = DEMO_BOXES.map((_, i) => `@keyframes ${id}-${i}{0%,${pct(i) - 1}%{opacity:0}${pct(i) + 4}%,94%{opacity:1}100%{opacity:0}} .d-c${i}{animation:${id}-${i} ${T}s infinite}`).join('');
  } else {
    const slide = style === 'sliding_bounding_box';
    body = DEMO_BOXES.map((_, i) => box(i, DEMO_FILL[i], DEMO_STROKE[i])).join('')
      + `<rect class="d-hop" x="-4" y="-4" width="64" height="38" rx="8" fill="none" stroke="#E0262D" stroke-width="3"/>`;
    const kf = DEMO_BOXES.map((b, i) => {
      const p0 = (i / N) * 92; const p1 = ((i + 1) / N) * 92 - (slide ? 8 : 0.01);
      return `${p0.toFixed(2)}%{transform:translate(${b[0]}px,${b[1]}px)}${p1.toFixed(2)}%{transform:translate(${b[0]}px,${b[1]}px)}`;
    }).join('') + `100%{transform:translate(${DEMO_BOXES[N - 1][0]}px,${DEMO_BOXES[N - 1][1]}px)}`;
    css = `@keyframes ${id}-h{${kf}} .d-hop{animation:${id}-h ${T}s infinite ${slide ? 'ease-in-out' : 'steps(1,end)'}}`;
    if (!slide) css = css.replace('steps(1,end)', 'step-end');
  }
  return `<svg class="hx-demo" viewBox="0 0 300 114" role="img" aria-label="${esc(STYLE_NAMES[style])} on a toy five-box diagram">
    <style>${css}@media (prefers-reduced-motion: reduce){*{animation:none!important}.d-veil{opacity:0}}</style>${marker}${edges}${body}${extra}</svg>`;
}

export class Wires {
  constructor(host, spec) {
    this.host = host;
    this.spec = spec;
    this.lit = new Set();
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.classList.add('jm-wires');
    this.svg.setAttribute('aria-hidden', 'true');
    const mk = (id, cls) => `<marker id="${host.id}-${id}" class="${cls}" viewBox="0 0 10 10" refX="8" refY="5"
      markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z"/></marker>`;
    this.svg.innerHTML = `<defs>${mk('arrow', 'is-idle')}${mk('arrow-on', 'is-live')}</defs><g></g>`;
    host.prepend(this.svg);
    this.g = this.svg.querySelector('g');
    new ResizeObserver(() => this.draw()).observe(host);
  }
  set(ids, on) { for (const i of ids) on ? this.lit.add(i) : this.lit.delete(i); this.draw(); }
  draw() {
    const H = this.host.getBoundingClientRect();
    if (!H.width || getComputedStyle(this.svg).display === 'none') return;
    this.svg.setAttribute('viewBox', `0 0 ${H.width} ${H.height}`);
    this.g.innerHTML = this.spec.map(([id, a, b, dir]) => {
      const r1 = a.getBoundingClientRect(); const r2 = b.getBoundingClientRect();
      if (!r1.width || !r2.width) return '';
      const on = this.lit.has(id);
      const mk = `url(#${this.host.id}-${on ? 'arrow-on' : 'arrow'})`;
      if (dir === 'down') {
        const x = r1.left + r1.width / 2 - H.left; const y1 = r1.bottom - H.top + 4; const y2 = r2.top - H.top - 6;
        return `<path class="${on ? 'is-on' : ''}" d="M${x} ${y1} L${x} ${y2}" marker-end="${mk}"/>`;
      }
      const x1 = r1.right - H.left + 4; const y1 = r1.top + r1.height / 2 - H.top;
      const x2 = r2.left - H.left - 6; const y2 = r2.top + Math.min(r2.height / 2, 120) - H.top;
      const dx = Math.max(24, (x2 - x1) * 0.5);
      return `<path class="${on ? 'is-on' : ''}" d="M${x1} ${y1} C${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}" marker-end="${mk}"/>`;
    }).join('');
  }
}

export function onVisible(el, fn, margin = '200px') {
  const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); fn(); } }, { rootMargin: margin });
  io.observe(el);
}

export class FramePlayer {
  constructor(stage, { onTime, loop = false } = {}) {
    this.stage = stage; this.onTime = onTime; this.loop = loop;
    this.t = 0; this.duration = 0; this.playing = false; this.frames = [];
    this.tick = this.tick.bind(this);
  }

  load(frames, base) {
    this.pause();
    this.frames = frames || [];
    this.duration = this.frames.length ? this.frames.at(-1).t + 2.5 : 1;
    this.stage.replaceChildren();
    const box = document.createElement('div');
    box.className = 'hx-framebox';
    this.img = document.createElement('img');
    this.img.alt = '';
    this.img.decoding = 'async';
    box.append(this.img);
    this.stage.append(box);
    for (const f of this.frames) { const im = new Image(); im.src = `${base}/${f.f}`; }
    this.base = base;
    this.idx = -1;
    return Promise.resolve(true);
  }

  frameAt(t) {
    let i = 0;
    for (let k = 0; k < this.frames.length; k++) if (this.frames[k].t <= t + 1e-3) i = k;
    return i;
  }

  narrationAt(t) { const f = this.frames[this.frameAt(t)]; return f ? { step: this.frameAt(t) + 1, narration: f.n } : null; }

  seek(t) {
    this.t = Math.max(0, Math.min(t, this.duration));
    const i = this.frameAt(this.t);
    if (i !== this.idx && this.frames[i]) { this.idx = i; this.img.src = `${this.base}/${this.frames[i].f}`; }
    this.onTime?.(this.t, this);
  }

  poster() { this.seek(this.duration); }

  play() {
    if (!this.frames.length || this.playing) return;
    if (this.t >= this.duration - 0.01) this.seek(0);
    this.playing = true; this.t0 = this.t; this.w0 = performance.now();
    this.timer = setInterval(this.tick, 50);
    this.onTime?.(this.t, this);
  }

  pause() { if (!this.playing) return; this.playing = false; clearInterval(this.timer); this.onTime?.(this.t, this); }

  toggle() { this.playing ? this.pause() : this.play(); }

  tick() {
    let t = this.t0 + (performance.now() - this.w0) / 1000;
    if (t >= this.duration) {
      if (this.loop) { this.t0 = 0; this.w0 = performance.now(); t = 0; } else { this.seek(this.duration); this.pause(); return; }
    }
    this.seek(t);
  }

  destroy() { this.pause(); this.stage.replaceChildren(); }
}
export const abFramesBase = (d) => `assets/harness/gallery/animatebanana/${d}`;
