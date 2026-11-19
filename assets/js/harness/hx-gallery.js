import {
  ready, esc, CONDS, condLabel, splitCond, STYLE_NAMES, fmtMin, sourceUrl, svgUrl, hasFile, SvgPlayer, FramePlayer, abFramesBase, onVisible, loadTrajectory, loadNarration, narrationAt, setState,
} from './hx-core.js';

const AB_KEY = 'animatebanana';
const COLS = [['source', 'Source PNG'], [AB_KEY, 'AnimateBanana'], ...CONDS.map((c) => [c, condLabel(c)])];
const EXCLUDE = new Set(['WACV_2024_set5_000041', 'WACV_2024_set5_000010', 'ICCV_2023_set5_000003', 'CVPR_2025_pipe00041', 'Paper2Fig_pipe_diff_000000517', 'ICCV_2023_set5_000035', 'CVPR_2025_arch01871', 'CVPR_2025_arch03005']);
const ORDER = ['CVPR_2025_arch00855', 'CVPR_2025_arch01051', 'ICCV_2023_set5_000059', 'CVPR_2025_pipe00004', 'CVPR_2025_arch02298', 'CVPR_2025_pipe00011', 'CVPR_SET2_000042', 'Paper2Fig_pipe_diff_000000517', 'ICCV_2023_set5_000035'];
const rank = (dg) => { const i = ORDER.indexOf(dg); return i < 0 ? ORDER.length : i; };

class HxGallery extends HTMLElement {
  async connectedCallback() {
    const d = (this.d = await ready());
    const run = (dg, c) => d.runs.find((r) => r.diagram === dg && r.cond === c);
    this.innerHTML = `
      <div class="hx-gwrap"><div class="hx-gallery" role="table" aria-label="Gallery of outputs">
        <div class="hx-grow is-head" role="row"><span role="columnheader">Diagram</span>${COLS.map(([k, l]) => `<span role="columnheader" class="hx-ghead is-${k.split('_')[0]}${k.endsWith('_budget') && !k.endsWith('no_budget') ? ' is-b' : ''}">${esc(l)}</span>`).join('')}</div>
        ${d.items.filter((it) => !EXCLUDE.has(it.diagram)).map((it, i) => [it, i]).sort((a, b) => rank(a[0].diagram) - rank(b[0].diagram) || a[1] - b[1]).map(([it]) => `
          <div class="hx-grow" role="row" data-d="${it.diagram}">
            <span class="hx-glabel" role="rowheader"><b>${esc(it.diagram)}</b><small class="hx-gstyle">${esc(STYLE_NAMES[it.style])}</small>
              <span class="hx-gtimes"><span class="is-ab">AnimateBanana <b>${fmtMin(it.ab_min)}</b></span><span class="is-bud">Budget <b>${it.budget_min}:00</b></span></span></span>
            ${COLS.map(([k]) => {
              const r = k.includes('budget') ? run(it.diagram, k) : null;
              return `<button type="button" role="cell" class="hx-tile is-${k.split('_')[0]}" data-k="${k}" data-d="${it.diagram}" aria-label="${esc(`${it.diagram}, ${k === 'source' ? 'source PNG' : k === AB_KEY ? 'AnimateBanana' : condLabel(k)}`)}">
                ${r ? `<span class="hx-ttime">${fmtMin(r.minutes)}</span>` : k === AB_KEY ? `<span class="hx-ttime">${fmtMin(it.ab_min)}</span>` : '<span class="hx-ttime is-blank" aria-hidden="true">0:00</span>'}
                <span class="hx-thumb" data-thumb></span>
              </button>`;
            }).join('')}
          </div>`).join('')}
      </div></div>`;

    for (const t of this.querySelectorAll('.hx-tile')) onVisible(t, () => this.fill(t), '300px');
    this.addEventListener('click', (e) => { const t = e.target.closest('.hx-tile'); if (t) this.open(t.dataset.d, t.dataset.k); });
    this.addEventListener('mouseover', (e) => { const t = e.target.closest('.hx-tile'); if (t?.player && !t.player.playing) { t.player.seek(0); t.player.play(); } });
    this.addEventListener('mouseout', (e) => {
      const t = e.target.closest('.hx-tile');
      if (t?.player && !t.contains(e.relatedTarget)) { t.player.pause(); t.player.poster(); }
    });
    addEventListener('hx:open', (e) => { this.open(e.detail.diagram, e.detail.cond, { noReplay: !!e.detail.noReplay }); });
  }

  async fill(t) {
    const th = t.querySelector('[data-thumb]');
    const { k, d } = t.dataset;
    if (k === 'source') {
      th.innerHTML = hasFile(this.d, 'source', d) ? `<img src="${sourceUrl(d)}" alt="" loading="lazy">` : '';
      return;
    }
    if (k === AB_KEY && !hasFile(this.d, 'ab', d)) { th.innerHTML = ''; t.disabled = true; return; }
    const p = this.makePlayer(th, k, d, { loop: true });
    t.player = p;
    if (await p.ok) p.poster();
  }

  makePlayer(stage, k, d, opts = {}) {
    if (k === AB_KEY) {
      const it = this.d.items.find((i) => i.diagram === d);
      const p = new FramePlayer(stage, opts);
      p.ok = p.load(it.ab_frames || [], abFramesBase(d));
      return p;
    }
    const p = new SvgPlayer(stage, opts);
    p.ok = p.load(svgUrl(k, d));
    return p;
  }

  async open(diagram, key, { noReplay = false } = {}) {
    const d = this.d;
    const it = d.items.find((i) => i.diagram === diagram);
    if (key === 'source') key = CONDS[0];
    if (!this.lb) this.buildLightbox();
    const lb = this.lb;
    this.cur = { diagram, key };
    lb.querySelector('[data-lbtitle]').textContent = diagram;
    lb.querySelector('[data-lbsub]').textContent = `${STYLE_NAMES[it.style]} · AnimateBanana ${fmtMin(it.ab_min)} · budget ${it.budget_min}:00`;
    const src = lb.querySelector('[data-lbsrc]');
    src.innerHTML = it.has_source ? `<img src="${sourceUrl(diagram)}" alt="Source diagram ${esc(diagram)}">` : '';
    const avail = COLS.slice(1).map(([k]) => [k, k === AB_KEY ? !!it.has_ab : true]);
    lb.querySelector('[data-picks]').innerHTML = avail.map(([k, ok]) => `<label class="hx-pick is-${k.split('_')[0]}"><input type="checkbox" value="${k}" ${k === key ? 'checked' : ''} ${ok ? '' : 'disabled'}><span>${esc(k === AB_KEY ? 'AnimateBanana' : condLabel(k))}</span></label>`).join('');
    lb.querySelector('[data-replay]').hidden = noReplay;
    lb.hidden = false;
    document.documentElement.classList.add('hx-lock');
    lb.querySelector('.hx-lbpanel').focus({ preventScroll: true });
    this.compare = false;
    lb.classList.remove('is-compare');
    await this.loadPlayers([key]);
  }

  buildLightbox() {
    const lb = (this.lb = document.createElement('div'));
    lb.className = 'hx-lb';
    lb.hidden = true;
    lb.innerHTML = `
      <div class="hx-lbback" data-close></div>
      <div class="hx-lbpanel" role="dialog" aria-modal="true" aria-labelledby="hx-lbt" tabindex="-1">
        <header class="hx-lbhead"><div><span class="hx-kicker">Gallery</span><h3 id="hx-lbt" data-lbtitle></h3><p data-lbsub></p></div>
          <div class="hx-lbacts"><button type="button" class="hx-mini" data-cmp>Compare</button><button type="button" class="hx-mini" data-replay>Open in setup replay</button>
          <button type="button" class="hx-x" data-close aria-label="Close"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l10 10M13 3 3 13"/></svg></button></div></header>
        <div class="hx-picks" data-picks></div>
        <div class="hx-lbbody">
          <figure class="hx-lbsrc"><figcaption>Source diagram <i>D</i></figcaption><div data-lbsrc></div></figure>
          <div class="hx-lbplayers" data-players></div>
        </div>
        <div class="hx-lbctl">
          <button type="button" class="jm-start is-sm" data-lbplay><span>Play</span></button>
          <input type="range" class="hx-range" data-lbscrub min="0" max="10" step="0.05" value="0" aria-label="Animation time">
        </div>
        <div class="hx-narr" data-lbnarr><span class="hx-narrk" data-lbnk></span><p data-lbnt></p></div>
        <details class="hx-lblog"><summary>Decision log</summary><ol class="hx-log is-static" data-lblog></ol></details>
      </div>`;
    document.body.append(lb);
    const close = () => { this.stopAll(); lb.hidden = true; document.documentElement.classList.remove('hx-lock'); };
    lb.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && !lb.hidden) close(); });
    lb.querySelector('[data-lbplay]').addEventListener('click', () => (this.playing ? this.pauseAll() : this.playAll()));
    lb.querySelector('[data-lbscrub]').addEventListener('input', (e) => { this.pauseAll(); this.seekAll(+e.target.value); });
    lb.querySelector('[data-cmp]').addEventListener('click', () => {
      this.compare = !this.compare;
      lb.classList.toggle('is-compare', this.compare);
      lb.querySelector('[data-cmp]').textContent = this.compare ? 'Single view' : 'Compare';
      const picked = [...lb.querySelectorAll('[data-picks] input:checked')].map((i) => i.value);
      if (!this.compare) this.loadPlayers([picked[0] || this.cur.key]);
      else this.loadPlayers(picked.length > 1 ? picked : [this.cur.key, ...CONDS.filter((c) => c !== this.cur.key).slice(0, 1)]);
    });
    lb.querySelector('[data-picks]').addEventListener('change', (e) => {
      const boxes = [...lb.querySelectorAll('[data-picks] input')];
      if (!this.compare) { for (const b of boxes) b.checked = b === e.target; this.loadPlayers([e.target.value]); return; }
      const picked = boxes.filter((b) => b.checked);
      if (picked.length > 4) e.target.checked = false;
      const keys = boxes.filter((b) => b.checked).map((b) => b.value);
      if (keys.length) this.loadPlayers(keys);
    });
    lb.querySelector('[data-replay]').addEventListener('click', () => {
      const k = this.players?.[0]?.key;
      const cond = CONDS.includes(k) ? k : CONDS.includes(this.cur.key) ? this.cur.key : CONDS[0];
      const { agent, budget } = splitCond(cond);
      close();
      setState({ diagram: this.cur.diagram, agent, budget, __hash: true }, { scroll: 'hx-setup' });
    });
  }

  async loadPlayers(keys) {
    this.stopAll();
    const lb = this.lb;
    for (const b of lb.querySelectorAll('[data-picks] input')) b.checked = keys.includes(b.value);
    const box = lb.querySelector('[data-players]');
    box.dataset.n = keys.length;
    box.innerHTML = keys.map((k) => `<figure class="hx-lbp is-${k.split('_')[0]}"><figcaption>${esc(k === AB_KEY ? 'AnimateBanana' : condLabel(k))}</figcaption><div class="jm-reel hx-reel"><div class="hx-stage" data-k="${k}"></div></div></figure>`).join('');
    const { diagram } = this.cur;
    this.players = await Promise.all(keys.map(async (k) => {
      const p = this.makePlayer(box.querySelector(`[data-k="${k}"]`), k, diagram);
      p.key = k;
      await p.ok;
      return p;
    }));
    this.dur = Math.max(1, ...this.players.map((p) => p.duration));
    const scrub = lb.querySelector('[data-lbscrub]');
    scrub.max = this.dur.toFixed(2);
    this.seekAll(0);
    const logKey = keys.find((k) => CONDS.includes(k));
    this.narrKey = keys[0];
    this.narr = CONDS.includes(keys[0]) ? await loadNarration(keys[0], diagram) : [];
    lb.querySelector('[data-lbnarr]').hidden = !(this.narr.length || keys[0] === AB_KEY);
    const ol = lb.querySelector('[data-lblog]');
    lb.querySelector('.hx-lblog').hidden = !logKey;
    if (logKey) {
      const log = await loadTrajectory(logKey, diagram);
      lb.querySelector('.hx-lblog summary').textContent = `Decision log · ${condLabel(logKey)} (${log.length} lines)`;
      ol.innerHTML = log.map((l, i) => `<li><span>${l.step ?? i + 1}</span><b>${esc(l.decision ?? '')}</b><em>${esc(l.skill ?? 'none')}</em><i>${esc(l.reason ?? '')}</i></li>`).join('');
    }
    this.playAll();
  }

  seekAll(t) {
    this.t = Math.max(0, Math.min(t, this.dur || 0));
    for (const p of this.players || []) p.seek(Math.min(this.t, p.duration));
    const lb = this.lb;
    lb.querySelector('[data-lbscrub]').value = this.t.toFixed(2);
    const first = this.players?.[0];
    const n = first?.key === AB_KEY ? first.narrationAt(this.t) : narrationAt(this.narr, this.t);
    const who = first ? (first.key === AB_KEY ? 'AnimateBanana' : condLabel(first.key)) : '';
    lb.querySelector('[data-lbnk]').textContent = n ? `Narration${this.players.length > 1 ? ` · ${who}` : ''}` : '';
    const tx = lb.querySelector('[data-lbnt]');
    if (tx.textContent !== (n?.narration || '')) tx.textContent = n?.narration || '';
  }

  playAll() {
    if (!this.players?.length) return;
    if (this.t >= this.dur - 0.05) this.seekAll(0);
    this.playing = true;
    this.t0 = this.t; this.w0 = performance.now();
    clearInterval(this.timer);
    this.timer = setInterval(() => {
      const t = this.t0 + (performance.now() - this.w0) / 1000;
      if (t >= this.dur) { this.seekAll(this.dur); this.pauseAll(); return; }
      this.seekAll(t);
    }, 40);
    this.lb.querySelector('[data-lbplay] span').textContent = 'Pause';
  }

  pauseAll() {
    this.playing = false;
    clearInterval(this.timer);
    this.lb?.querySelector('[data-lbplay] span') && (this.lb.querySelector('[data-lbplay] span').textContent = 'Play');
  }

  stopAll() { this.pauseAll(); for (const p of this.players || []) p.destroy(); this.players = []; }
}

customElements.define('hx-gallery', HxGallery);

