import { loadJSON } from '../lib/data-loader.js';
import { escapeHtml as esc } from '../lib/format.js';

const DEMO_URL = 'data/metrics/judge_demo.json?v=3';
let demoP;
const getDemo = () => (demoP ||= loadJSON(DEMO_URL));

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const J = { A: 4, B: 3, C: 2, D: 1 };
const fmt = (x) => (x == null ? '—' : x.toFixed(3));
const NAMES = {
  VF: 'Visual Fidelity', ASC: 'Animation Style Compliance',
  SS: 'Selection Sensibility', GP: 'Granularity and Pacing', NA: 'Narration Alignment',
};
const BANDS = { VF: ['A', 'B', 'C', 'D'], ASC: ['A', 'B', 'C', 'D'] };

class Wires {
  constructor(host) {
    this.host = host;
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.classList.add('jm-wires');
    this.svg.setAttribute('aria-hidden', 'true');
    const mk = (id, cls) => `<marker id="${host.id}-${id}" class="${cls}" viewBox="0 0 10 10" refX="8" refY="5"
      markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z"/></marker>`;
    this.svg.innerHTML = `<defs>${mk('arrow', 'is-idle')}${mk('arrow-on', 'is-live')}${mk('arrow-done', 'is-past')}</defs><g></g>`;
    host.prepend(this.svg);
    this.g = this.svg.querySelector('g');
    this.spec = [];
    this.st = new Map();
    new ResizeObserver(() => this.draw()).observe(host);
  }
  set(spec) { this.spec = spec; this.draw(); }
  marker(id) {
    const s = this.st.get(id);
    return `url(#${this.host.id}-${s === 'on' ? 'arrow-on' : s === 'done' ? 'arrow-done' : 'arrow'})`;
  }
  draw() {
    const H = this.host.getBoundingClientRect();
    if (!H.width) return;
    this.svg.setAttribute('viewBox', `0 0 ${H.width} ${H.height}`);
    const judge = this.host.querySelector('.jm-judge');
    if (!judge || getComputedStyle(this.svg).display === 'none') return;
    const J0 = judge.getBoundingClientRect();
    const vis = (w) => w.el.getBoundingClientRect().width > 0;
    const ins = this.spec.filter((w) => w.dir === 'in' && vis(w));
    const outs = this.spec.filter((w) => w.dir === 'out' && vis(w));
    const pad = Math.min(36, J0.height * 0.18);
    const at = (n, k) => J0.top + pad + ((J0.height - 2 * pad) * (n === 1 ? 0.5 : k / (n - 1))) - H.top;
    const path = (w, x1, y1, x2, y2) => {
      const dx = Math.max(30, (x2 - x1) * 0.5);
      return `<path data-w="${w.id}" d="M${x1} ${y1} C${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}" marker-end="${this.marker(w.id)}"/>`;
    };
    const paths = [];
    ins.forEach((w, k) => {
      const r = w.el.getBoundingClientRect();
      paths.push(path(w, r.right - H.left + 4, r.top + r.height / 2 - H.top, J0.left - H.left - 6, at(ins.length, k)));
    });
    outs.forEach((w, k) => {
      const r = w.el.getBoundingClientRect();
      paths.push(path(w, J0.right - H.left + 4, at(outs.length, k), r.left - H.left - 6, r.top + r.height / 2 - H.top));
    });
    this.g.innerHTML = paths.join('');
    for (const p of this.g.querySelectorAll('path')) {
      const s = this.st.get(p.dataset.w);
      p.classList.toggle('is-on', s === 'on');
      p.classList.toggle('is-done', s === 'done');
    }
  }
  on(id) { this.st.set(id, 'on'); this.draw(); }
  done(id) { this.st.set(id, 'done'); this.draw(); }
  off(id) { this.st.delete(id); this.draw(); }
  reset() { this.st.clear(); this.draw(); }
}

class Runner {
  constructor() { this.gen = 0; }
  next() { return ++this.gen; }
  wait(ms, gen) {
    return new Promise((res, rej) => setTimeout(() => (gen === this.gen ? res() : rej(new Error('cancelled'))),
      REDUCED ? Math.min(ms, 60) : ms));
  }
}

const judgeBlock = (extra = '') => `
  <div class="jm-judge" data-judge-block>
    <div class="jm-brand">
      <div class="jm-brandtop"><span class="jm-role">Judge</span><span class="jm-led" aria-hidden="true"></span></div>
      <div class="jm-brandmark"><img class="jm-logo" src="assets/metrics/kimi-logo.webp" alt="Kimi"><b class="jm-ver" data-model>2.6</b></div>
    </div>
    <div class="jm-evalcard" data-evalcard>
      <span class="jm-evalk" data-evalk>Ready</span>
      <b class="jm-evalname" data-metric>Press Start below</b>
      <span class="jm-evalstep" data-step></span>
      <div class="jm-work" aria-hidden="true"><i></i><i></i><i></i></div>
    </div>
  </div>
  ${extra}
  <div class="jm-startwrap">
    <svg class="jm-hintarrow" viewBox="0 0 90 60" aria-hidden="true">
      <path d="M80 10 C55 4, 25 14, 22 44"/><path d="M13 36 L22 46 L31 38"/>
    </svg>
    <span class="jm-hint">click to start</span>
    <button type="button" class="jm-start" data-start><span>Start</span></button>
  </div>`;

function setEval(judge, { k, name, step = '' }) {
  judge.querySelector('[data-evalk]').textContent = k;
  judge.querySelector('[data-metric]').textContent = name;
  judge.querySelector('[data-step]').textContent = step;
  const card = judge.querySelector('[data-evalcard]');
  card.classList.remove('is-flip'); void card.offsetWidth; card.classList.add('is-flip');
}

const illustrativeNote = `<p class="jm-illus"><b>Illustrative outputs.</b> The inputs are the real pipeline
  example; the judge outputs shown are an example, not a recorded judge run.</p>`;

const reel = (d) => `
  <div class="jm-reel" data-reel>
    <video src="${esc(d.video)}" poster="${esc(d.steps.at(-1).frame)}" muted playsinline preload="metadata"></video>
    <button type="button" class="jm-play" data-play aria-label="Play the generated narrative">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>
    </button>
  </div>
  <p class="jm-reelcap" data-reelcap aria-live="polite"></p>`;

function wireReel(root, start, steps) {
  const box = root.querySelector('[data-reel]');
  const v = box.querySelector('video');
  const cap = root.querySelector('[data-reelcap]');
  const play = () => { if (v.currentTime < start) v.currentTime = start; return v.play().catch(() => {}); };
  const caption = () => {
    let line = '';
    for (const s of steps) { if (v.currentTime + 0.05 >= s.time) line = s.narration; else break; }
    if (cap.textContent !== line) cap.textContent = line;
  };
  box.addEventListener('click', () => (v.paused ? play() : v.pause()));
  v.addEventListener('play', () => box.classList.add('is-playing'));
  v.addEventListener('pause', () => box.classList.remove('is-playing'));
  v.addEventListener('ended', () => box.classList.remove('is-playing'));
  for (const ev of ['timeupdate', 'seeked', 'play']) v.addEventListener(ev, caption);
  return { restart: () => { v.currentTime = start; return play(); } };
}

class JudgeValidity extends HTMLElement {
  async connectedCallback() {
    const d = await getDemo();
    this.d = d;
    this.id ||= 'jm-validity';
    this.runner = new Runner();
    this.gateNote = (k) => `accept A, B · reject ${BANDS[k].slice(2).join(', ')}`;
    this.innerHTML = `
      <div class="jm jm--validity" id="${this.id}-m">
        <div class="jm-col jm-in">
          <figure class="jm-input" data-in="source">
            <figcaption><b>Source diagram</b><i>D</i></figcaption>
            <div class="jm-media"><img src="${esc(d.source)}" alt="The source pipeline diagram" loading="lazy"></div>
          </figure>
          <figure class="jm-input" data-in="video">
            <figcaption><b>Generated animated narrative</b><i>Y</i></figcaption>
            ${reel(d)}
          </figure>
          <div class="jm-input jm-stylein" data-in="style">
            <figcaption><b>Requested style</b><i>u</i></figcaption>
            <span class="jm-stylechip">${esc(d.style)}</span>
          </div>
        </div>
        <div class="jm-col jm-core">${judgeBlock()}</div>
        <div class="jm-col jm-out">
          <div class="jm-outhead">Judge outputs &middot; verdicts</div>
          ${['VF', 'ASC'].map((k) => `
            <article class="jm-verdict" data-out="${k}">
              <header><b>${NAMES[k]}</b><span>${k}</span></header>
              <div class="jm-mini">${BANDS[k].map((b, i) => `<span class="${i < 2 ? 'is-acc' : 'is-rej'}" data-b="${b}">${b}</span>`).join('')}
                <em data-gate>${this.gateNote(k)}</em></div>
            </article>`).join('')}
          <div class="jm-gatebar" data-gatebar>Both gates must pass before the sequence-level assessment.</div>
        </div>
      </div>
      ${illustrativeNote}`;
    this.m = this.querySelector('.jm');
    this.wires = new Wires(this.m);
    const q = (s) => this.m.querySelector(s);
    this.wires.set([
      { id: 'source', el: q('[data-in="source"]'), dir: 'in' },
      { id: 'video', el: q('[data-in="video"]'), dir: 'in' },
      { id: 'style', el: q('[data-in="style"]'), dir: 'in' },
      { id: 'out-VF', el: q('[data-out="VF"]'), dir: 'out' },
      { id: 'out-ASC', el: q('[data-out="ASC"]'), dir: 'out' },
    ]);
    this.reel = wireReel(this, d.steps[0].time, d.steps);
    this.querySelector('[data-start]').addEventListener('click', () => this.run());
  }

  reset() {
    this.wires.reset();
    for (const el of this.m.querySelectorAll('.is-lit, .is-shown, .is-pass, .is-fail, .is-hit')) {
      el.classList.remove('is-lit', 'is-shown', 'is-pass', 'is-fail', 'is-hit');
    }
    for (const k of ['VF', 'ASC']) {
      const v = this.m.querySelector(`[data-out="${k}"]`);
      v.querySelector('[data-gate]').textContent = this.gateNote(k);
    }
    const bar = this.m.querySelector('[data-gatebar]');
    bar.classList.remove('is-open');
    bar.textContent = 'Both gates must pass before the sequence-level assessment.';
  }

  async run() {
    const gen = this.runner.next();
    const w = (ms) => this.runner.wait(ms, gen);
    const btn = this.querySelector('[data-start] span');
    btn.textContent = 'Running…';
    this.querySelector('.jm-startwrap').classList.add('is-used');
    this.reset();
    this.reel.restart();
    const judge = this.m.querySelector('[data-judge-block]');
    try {
      for (const key of ['VF', 'ASC']) {
        setEval(judge, { k: 'Evaluating', name: NAMES[key] });
        await w(450);
        for (const inp of ['source', 'video', 'style']) {
          this.m.querySelector(`[data-in="${inp}"]`).classList.add('is-lit');
          this.wires.on(inp);
          await w(600);
        }
        judge.classList.add('is-thinking');
        await w(1300);
        judge.classList.remove('is-thinking');
        for (const inp of ['source', 'video', 'style']) this.wires.done(inp);
        const r = this.d.validity[key];
        const pass = ['A', 'B'].includes(r.band);
        this.wires.on(`out-${key}`);
        const card = this.m.querySelector(`[data-out="${key}"]`);
        card.classList.add('is-shown', pass ? 'is-pass' : 'is-fail');
        card.querySelector(`[data-b="${r.band}"]`)?.classList.add('is-hit');
        card.querySelector('[data-gate]').textContent = `Band ${r.band} → ${pass ? 'accept, gate passes' : 'reject, gate fails'}`;
        await w(1200);
        this.wires.done(`out-${key}`);
        for (const el of this.m.querySelectorAll('[data-in].is-lit')) el.classList.remove('is-lit');
        if (!pass) break;
      }
      const ok = ['A', 'B'].includes(this.d.validity.VF.band) && ['A', 'B'].includes(this.d.validity.ASC.band);
      const bar = this.m.querySelector('[data-gatebar]');
      bar.classList.toggle('is-open', ok);
      bar.innerHTML = ok ? 'Both gates pass (<i>G</i> = 1) &rarr; the sequence-level assessment follows.'
                         : 'A gate failed (<i>G</i> = 0) &rarr; the animation scores 0.';
      setEval(judge, { k: 'Done', name: ok ? 'Both gates passed' : 'A gate failed' });
      btn.textContent = 'Replay';
    } catch {  }
  }
}

function xmlLine(line) {
  const id = (line.match(/\bid="([^"]+)"/) || [])[1] || '';
  let h = esc(line);
  h = h.replace(/([\w:-]+)(=)(&quot;[^&]*?&quot;)/g, '\u0001a$1\u0002\u0001p$2\u0002\u0001v$3\u0002')
       .replace(/(&lt;[?/]?)([\w:-]+)/g, '\u0001p$1\u0002\u0001t$2\u0002')
       .replace(/([/?]?&gt;)/g, '\u0001p$1\u0002')
       .replace(/\u0001([apvt])/g, '<i class="x-$1">').replace(/\u0002/g, '</i>');
  return `<span class="jm-xl" data-id="${esc(id)}">${h || ' '}</span>`;
}

const chips = (n) => Array.from({ length: n }, () => '<i></i>').join('');
function setChip(row, i, band) {
  const c = row.children[i];
  if (!c) return;
  c.textContent = band;
  c.className = `is-${band.toLowerCase()}`;
}

const ICONS = {
  caption: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 10h4M7 14h10"/></svg>',
  abstract: '<svg viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 11h7M9 15h7"/></svg>',
  method: '<svg viewBox="0 0 24 24"><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 18l-5-9V3"/><path d="M7.5 15h9"/></svg>',
};

const SEQ = ['SS', 'GP', 'NA'];

class JudgeNarrative extends HTMLElement {
  async connectedCallback() {
    const d = await getDemo();
    this.d = d;
    this.id ||= 'jm-narrative';
    this.runner = new Runner();
    this.metric = 'SS';
    this.ran = new Set();
    const n = d.steps.length;
    const sw = `
      <div class="jm-tabs" role="radiogroup" aria-label="Choose the metric to run">
        <span class="jm-tabsk">Choose a metric<small>then press Start</small></span>
        ${SEQ.map((k) => `<button type="button" role="radio" class="jm-tab is-${k.toLowerCase()}" data-metricpick="${k}">
          <b>${k}</b><span>${NAMES[k]}</span></button>`).join('')}
      </div>`;
    this.innerHTML = `
      ${sw}
      <div class="jm jm--narr" id="${this.id}-m">
        <div class="jm-col jm-in">
          <figure class="jm-input jm-in-src" data-in="source">
            <figcaption><b>Source diagram</b><i>D</i></figcaption>
            <div class="jm-media"><img src="${esc(d.source)}" alt="The source pipeline diagram" loading="lazy"></div>
          </figure>
          <figure class="jm-input" data-in="xml">
            <figcaption><b>Diagram XML</b></figcaption>
            <pre class="jm-xml jm-guard" data-xml>${d.xml.split('\n').map(xmlLine).join('\n')}</pre>
          </figure>
          <figure class="jm-input" data-in="frames">
            <figcaption><b>Frames</b><i>step <span data-tlabel>t</span> of ${n}</i></figcaption>
            <div class="jm-frames">
              <div class="jm-frame"><span>previous &middot; <i>t</i>&minus;1</span><div class="jm-media"><img data-prev alt="" decoding="async"></div>
                <p class="jm-fcap" data-capprev></p></div>
              <div class="jm-frame is-now"><span>current &middot; <i>t</i></span><div class="jm-media"><img data-cur alt="" decoding="async"></div>
                <p class="jm-fcap" data-capcur></p></div>
            </div>
          </figure>
          <div class="jm-input jm-stylein" data-in="style">
            <figcaption><b>Requested style</b><i>u</i></figcaption>
            <span class="jm-stylechip">${esc(d.style)}</span>
          </div>
          <div class="jm-input jm-context" data-in="context" hidden>
            <figcaption><b>Scientific context</b><i>for narration alignment</i></figcaption>
            <div class="jm-pieces">${d.context.map((c) => `
              <div class="jm-piece"><span class="jm-picon" aria-hidden="true">${ICONS[c.id] || ICONS.abstract}</span>
                <div><b>${esc(c.label)}</b><span>${esc(c.text)}</span></div></div>`).join('')}
            </div>
          </div>
        </div>
        <div class="jm-col jm-core">${judgeBlock()}</div>
        <div class="jm-col jm-out">
          <div class="jm-outhead">Sequence-level predictions</div>
          ${SEQ.map((k) => `
            <article class="jm-seq" data-out="${k}">
              <header><b>${NAMES[k]}</b><span>${k}</span></header>
              <div class="jm-seqchips" data-chips aria-label="Per-step outputs">${chips(n)}</div>
              <div class="jm-seqval"><span>score</span><b data-final>&mdash;</b></div>
            </article>`).join('')}
        </div>
      </div>
      <div class="jm-accum">
        <div class="jm-range">
          <span class="jm-rangehead">Judge output, per step</span>
          ${['A', 'B', 'C', 'D'].map((b) => `<span class="jm-rb is-${b.toLowerCase()}" data-rb="${b}"><b>${b}</b></span>`).join('')}
        </div>
        <div class="jm-meters">${SEQ.map((k) => `
          <div class="jm-meter" data-meter="${k}"><span class="jm-mk">${k}</span>
            <div class="jm-mchips" data-mchips>${chips(n)}</div>
            <div class="jm-mbar"><i data-fill></i></div><span class="jm-mv" data-val>&mdash;</span></div>`).join('')}
          <div class="jm-an" data-an>
            <span class="jm-ank">AN score</span>
            <em data-annote>run SS, GP and NA to get it</em>
            <b data-anval>&mdash;</b>
          </div>
        </div>
      </div>
      ${illustrativeNote}`;
    this.m = this.querySelector('.jm');
    this.wires = new Wires(this.m);
    const q = (s) => this.m.querySelector(s);
    this.wires.set([
      { id: 'source', el: q('[data-in="source"]'), dir: 'in' },
      { id: 'xml', el: q('[data-in="xml"]'), dir: 'in' },
      { id: 'frames', el: q('[data-in="frames"]'), dir: 'in' },
      { id: 'style', el: q('[data-in="style"]'), dir: 'in' },
      { id: 'context', el: q('[data-in="context"]'), dir: 'in' },
      ...SEQ.map((k) => ({ id: `out-${k}`, el: q(`[data-out="${k}"]`), dir: 'out' })),
    ]);
    this.querySelector('[data-start]').addEventListener('click', () => this.run());
    this.addEventListener('click', (e) => {
      const b = e.target.closest('[data-metricpick]');
      if (b) this.pick(b.dataset.metricpick);
    });
    this.pick('SS');
    for (const s of d.steps) { const im = new Image(); im.src = s.frame; }
  }

  pick(m) {
    this.runner.next();
    this.metric = m;
    for (const b of this.querySelectorAll('[data-metricpick]')) {
      const on = b.dataset.metricpick === m;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
    }
    this.wires.reset();
    for (const el of this.m.querySelectorAll('[data-in].is-lit')) el.classList.remove('is-lit');
    for (const el of this.querySelectorAll('.jm-meter')) el.classList.toggle('is-active', el.dataset.meter === m);
    this.setContext(m === 'NA');
    this.showStep(0, null);
    setEval(this.m.querySelector('[data-judge-block]'), { k: 'Ready', name: NAMES[m] });
    this.querySelector('[data-start] span').textContent = 'Start';
    this.querySelector('.jm-startwrap').classList.remove('is-used');
  }

  showStep(i, metric) {
    const s = this.d.steps[i];
    const prev = this.d.steps[i - 1];
    this.m.querySelector('[data-cur]').src = s.frame;
    this.m.querySelector('[data-capcur]').textContent = s.narration;
    this.m.querySelector('[data-capprev]').textContent = prev ? prev.narration : '';
    const pv = this.m.querySelector('[data-prev]');
    if (prev) { pv.src = prev.frame; pv.parentElement.classList.remove('is-empty'); }
    else { pv.removeAttribute('src'); pv.parentElement.classList.add('is-empty'); }
    this.m.querySelector('[data-tlabel]').textContent = metric ? String(s.t) : 't';
    const ids = new Set(metric ? s.elements : []);
    const pre = this.m.querySelector('[data-xml]');
    let first = null;
    for (const l of pre.querySelectorAll('.jm-xl')) {
      const hit = ids.has(l.dataset.id);
      l.classList.toggle('is-hit', hit);
      if (hit && !first) first = l;
    }
    if (first) pre.scrollTo({ top: first.offsetTop - pre.clientHeight / 3, behavior: REDUCED ? 'auto' : 'smooth' });
  }

  setContext(on) {
    const c = this.m.querySelector('[data-in="context"]');
    if (c.hidden === !on) return;
    c.hidden = !on;
    if (on) { c.classList.remove('is-pop'); void c.offsetWidth; c.classList.add('is-pop'); }
    this.wires.draw();
  }

  paint(m, k, sum) {
    const v = 1 - sum / (3 * k);
    const meter = this.querySelector(`[data-meter="${m}"]`);
    meter.querySelector('[data-fill]').style.width = `${(v * 100).toFixed(1)}%`;
    meter.querySelector('[data-val]').textContent = fmt(v);
  }

  paintAN() {
    const left = SEQ.filter((k) => !this.ran.has(k));
    const box = this.querySelector('[data-an]');
    if (left.length) {
      box.classList.remove('is-ready');
      this.querySelector('[data-anval]').textContent = '—';
      this.querySelector('[data-annote]').textContent = `run ${left.join(', ')} to get it`;
      return;
    }
    const v = this.d.validity;
    const G = ['A', 'B'].includes(v.VF.band) && ['A', 'B'].includes(v.ASC.band) ? 1 : 0;
    const q = SEQ.reduce((a, k) => a + this.d.sequence[k], 0) / SEQ.length;
    box.classList.add('is-ready');
    this.querySelector('[data-anval]').textContent = fmt(G * q);
    this.querySelector('[data-annote]').textContent = `G = ${G} · mean of SS, GP and NA`;
  }

  async run() {
    const gen = this.runner.next();
    const w = (ms) => this.runner.wait(ms, gen);
    const d = this.d;
    const m = this.metric;
    const btn = this.querySelector('[data-start] span');
    btn.textContent = 'Running…';
    this.querySelector('.jm-startwrap').classList.add('is-used');
    this.wires.reset();
    const out = this.m.querySelector(`[data-out="${m}"]`);
    out.classList.remove('is-shown');
    out.querySelector('[data-final]').textContent = '—';
    const meter = this.querySelector(`[data-meter="${m}"]`);
    meter.querySelector('[data-fill]').style.width = '0%';
    meter.querySelector('[data-val]').textContent = '—';
    for (const row of [meter.querySelector('[data-mchips]'), out.querySelector('[data-chips]')]) {
      for (const c of row.children) { c.textContent = ''; c.className = ''; }
    }
    const judge = this.m.querySelector('[data-judge-block]');
    setEval(judge, { k: 'Evaluating', name: NAMES[m] });
    try {
      const ins = ['source', 'xml', 'style', ...(m === 'NA' ? ['context'] : [])];
      for (const inp of ins) {
        this.m.querySelector(`[data-in="${inp}"]`).classList.add('is-lit');
        this.wires.on(inp);
        await w(inp === 'context' ? 650 : 420);
      }
      this.m.querySelector('[data-in="frames"]').classList.add('is-lit');
      this.wires.on('frames');
      let sum = 0;
      for (let i = 0; i < d.steps.length; i++) {
        const band = d.steps[i].bands[m];
        this.showStep(i, m);
        judge.querySelector('[data-step]').textContent = `step ${i + 1} of ${d.steps.length}`;
        judge.classList.add('is-thinking');
        await w(m === 'NA' ? 420 : 260);
        judge.classList.remove('is-thinking');
        sum += 4 - J[band];
        const rb = this.querySelector(`[data-rb="${band}"]`);
        rb.classList.remove('is-flash'); void rb.offsetWidth; rb.classList.add('is-flash');
        setChip(meter.querySelector('[data-mchips]'), i, band);
        this.paint(m, i + 1, sum);
        await w(m === 'NA' ? 380 : 200);
      }
      for (const inp of [...ins, 'frames']) {
        this.wires.done(inp);
        this.m.querySelector(`[data-in="${inp}"]`).classList.remove('is-lit');
      }
      this.wires.on(`out-${m}`);
      await w(400);
      out.classList.add('is-shown');
      d.steps.forEach((st, i) => setChip(out.querySelector('[data-chips]'), i, st.bands[m]));
      out.querySelector('[data-final]').textContent = fmt(d.sequence[m]);
      this.wires.done(`out-${m}`);
      setEval(judge, { k: 'Done', name: `${NAMES[m]}: ${fmt(d.sequence[m])}` });
      this.ran.add(m);
      this.paintAN();
      btn.textContent = 'Replay';
    } catch {  }
  }
}

const TRACKS = {
  bench: { label: 'Animation sequence of verified animated narrative from AnimateBench',
    steps: ['Input image', 'Feature learning sub-network', 'Bilinear pooling', 'Neural network',
            'Spectral averaging layer', 'Auxiliary classifier', 'Predictions'] },
  model: { label: 'Model generated animation sequence',
    steps: ['Input image', 'Feature learning sub-network', 'Spectral averaging layer', 'Auxiliary classifier',
            'Bilinear pooling', 'Neural network', 'Predictions'] },
};
const BRANCH = { 'Bilinear pooling': 'b1', 'Neural network': 'b1', 'Spectral averaging layer': 'b2', 'Auxiliary classifier': 'b2' };
const STEP_S = 4;

class RefFreeTracks extends HTMLElement {
  connectedCallback() {
    const n = TRACKS.bench.steps.length;
    const ts = (k) => `0:${String(k * STEP_S).padStart(2, '0')}`;
    const same = (k) => TRACKS.bench.steps[k] === TRACKS.model.steps[k];
    const row = (key) => `
      <div class="rf-track" data-track="${key}">
        <div class="rf-label">${esc(TRACKS[key].label)}</div>
        <ol class="rf-steps">${TRACKS[key].steps.map((s, k) => `
          <li class="rf-step ${BRANCH[s] ? 'is-' + BRANCH[s] : ''}${same(k) ? '' : ' is-diff'}" data-k="${k}">
            <span class="rf-t">${ts(k)}</span><b>${esc(s)}</b></li>`).join('')}</ol>
      </div>`;
    this.innerHTML = `
      <div class="rf">
        <div class="rf-head">
          <button type="button" class="rf-play" data-play><span>Play</span></button>
          <span class="rf-key"><i class="is-b1"></i>bilinear branch <i class="is-b2"></i>spectral branch</span>
        </div>
        <div class="rf-rows">
          ${row('bench')}
          <ol class="rf-verdicts" aria-label="Step-by-step comparison">${TRACKS.bench.steps.map((s, k) =>
            `<li class="rf-v ${same(k) ? 'is-match' : 'is-mismatch'}" data-k="${k}">${same(k) ? 'match' : 'mismatch'}</li>`).join('')}</ol>
          ${row('model')}
          <div class="rf-playhead" data-head></div>
        </div>
      </div>`;
    this.n = n;
    this.querySelector('[data-play]').addEventListener('click', () => this.play());
    new IntersectionObserver(([e], o) => { if (e.isIntersecting) { o.disconnect(); this.play(); } }, { threshold: 0.5 }).observe(this);
  }

  async play() {
    const gen = (this.gen = (this.gen || 0) + 1);
    const head = this.querySelector('[data-head]');
    for (const el of this.querySelectorAll('.rf-step, .rf-v')) el.classList.remove('is-on');
    this.querySelector('[data-play] span').textContent = 'Playing…';
    for (let k = 0; k < this.n; k++) {
      if (gen !== this.gen) return;
      const ref = this.querySelector(`[data-track="bench"] [data-k="${k}"]`);
      head.style.transform = `translateX(${ref.offsetLeft + ref.offsetWidth / 2}px)`;
      head.classList.add('is-on');
      for (const s of this.querySelectorAll(`[data-k="${k}"]`)) s.classList.add('is-on');
      await new Promise((r) => setTimeout(r, REDUCED ? 30 : 950));
    }
    if (gen !== this.gen) return;
    this.querySelector('[data-play] span').textContent = 'Replay';
  }
}

customElements.define('judge-validity', JudgeValidity);
customElements.define('judge-narrative', JudgeNarrative);
customElements.define('ref-free-tracks', RefFreeTracks);
