import { loadJSON } from '../lib/data-loader.js';

/**
 * Page-specific glue for user-study.html. The protocol itself is
 * authored in the markup — it is prose, and prose belongs in HTML —
 * so this only fills the headline counts, the participant mix, and the
 * interface screenshots. Results are not repeated here; they live in
 * the paper.
 *
 * Every screenshot slot renders whether or not its image exists yet:
 * a missing file falls back to a frame naming the path it wants, so
 * the page stays honest about what has not been captured rather than
 * showing a broken image.
 */

/**
 * Line-art glyphs in the site's ink, one per stat. Drawn rather than
 * pulled from an icon font so they sit in the same hand as the doodle
 * field: 24-unit box, round caps, stroke only, no fill.
 */
const ICONS = {
  // Two figures, the taller one forward: a cohort rather than one person.
  people:
    '<circle cx="9.2" cy="7.8" r="3.2"/><path d="M3.4 19.6c0-3.2 2.6-5.4 5.8-5.4s5.8 2.2 5.8 5.4"/>' +
    '<path d="M16.4 6.6a2.9 2.9 0 0 1 0 5.6"/><path d="M17.4 14.6c2 .6 3.2 2.4 3.2 5"/>',
  // Three nodes wired together: the source figure, as the study shows it.
  diagram:
    '<rect x="2.8" y="3.4" width="7.4" height="5.2" rx="1.3"/><rect x="13.8" y="3.4" width="7.4" height="5.2" rx="1.3"/>' +
    '<rect x="8.3" y="15.4" width="7.4" height="5.2" rx="1.3"/><path d="M6.5 8.6v2.8h11V8.6M12 11.4v4"/>',
  clock: '<circle cx="12" cy="12" r="8.4"/><path d="M12 6.8V12l3.4 2.2"/>',
  // A flask for the experiments: two mains, two cohort.
  flask:
    '<path d="M9.6 3.4v5.8l-4.8 8c-.9 1.5.2 3.3 1.9 3.3h10.6c1.7 0 2.8-1.8 1.9-3.3l-4.8-8V3.4"/>' +
    '<path d="M8.4 3.4h7.2M7.6 14.2h8.8"/>',
  // Mortarboard, shared by every student tier so they read as one family.
  cap: '<path d="M12 4 21.4 8.4 12 12.8 2.6 8.4 12 4Z"/><path d="M6.6 10.6v4.5c0 1.5 2.4 2.7 5.4 2.7s5.4-1.2 5.4-2.7v-4.5"/>',
  // The doctoral cap keeps the tassel.
  'cap-phd':
    '<path d="M12 4 21.4 8.4 12 12.8 2.6 8.4 12 4Z"/><path d="M6.6 10.6v4.5c0 1.5 2.4 2.7 5.4 2.7s5.4-1.2 5.4-2.7v-4.5"/>' +
    '<path d="M21.4 8.4v5.2"/><circle cx="21.4" cy="15.2" r="1.5"/>',
  // Two caps, stacked: the undergraduate tier of the same family.
  'cap-dual':
    '<path d="M12 2.8 20.6 6.8 12 10.8 3.4 6.8 12 2.8Z"/><path d="m3.4 11.4 8.6 4 8.6-4"/>' +
    '<path d="M6.8 13v3.6c0 1.4 2.3 2.5 5.2 2.5s5.2-1.1 5.2-2.5V13"/>',
  // An open book for those who teach and publish.
  book:
    '<path d="M12 7.4c-1.5-1.3-3.8-1.9-7.4-1.9v11.2c3.6 0 5.9.6 7.4 1.9 1.5-1.3 3.8-1.9 7.4-1.9V5.5c-3.6 0-5.9.6-7.4 1.9Z"/>' +
    '<path d="M12 7.4v11.2"/>',
  briefcase:
    '<rect x="2.8" y="7.4" width="18.4" height="12.2" rx="2.2"/>' +
    '<path d="M8.8 7.4V5.6a1.8 1.8 0 0 1 1.8-1.8h2.8a1.8 1.8 0 0 1 1.8 1.8v1.8M2.8 12.6h18.4"/>',
  mars: '<circle cx="9.8" cy="14.4" r="5.8"/><path d="m14.2 10 6.4-6.4m-5 0h5v5"/>',
  venus: '<circle cx="12" cy="9" r="5.8"/><path d="M12 14.8v6.2M9 18h6"/>',
  // Neither arrow nor cross: a plain stroke out of the circle.
  others: '<circle cx="12" cy="14.4" r="5.8"/><path d="M12 8.6V2.8"/><path d="M9.6 5.2h4.8"/>',
};

const icon = (name) =>
  ICONS[name]
    ? `<svg class="us-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"
         stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`
    : '';

function headline(rows) {
  return rows
    .map(
      (r, i) => `
    <div class="us-head-stat us-a-${r.accent}" style="--i:${i}">
      <div class="us-head-glyph">${icon(r.icon)}</div>
      <div class="us-head-body">
        <div class="us-head-value" data-count="${r.value}">${r.value}${r.unit ? `<span class="us-head-unit">${r.unit}</span>` : ''}</div>
        <div class="us-head-label">${r.label}</div>
        ${r.sub ? `<div class="us-head-sub">${r.sub}</div>` : ''}
      </div>
    </div>`
    )
    .join('');
}

/** A stat with no number yet stays visibly empty rather than guessed at. */
function cohortStat(s, i) {
  if (s.pending) {
    return `
    <div class="us-tile us-tile-pending us-a-${s.accent}" style="--i:${i}">
      <div class="us-tile-glyph">${icon(s.icon)}</div>
      <div class="us-tile-body">
        <div class="us-tile-value">&mdash;</div>
        <div class="us-tile-label">${s.label}</div>
        <div class="us-tile-note">count not supplied yet</div>
      </div>
    </div>`;
  }
  return `
    <div class="us-tile us-a-${s.accent}" style="--i:${i}">
      <div class="us-tile-glyph">${icon(s.icon)}</div>
      <div class="us-tile-body">
        <div class="us-tile-value" data-count="${s.value}">${s.value}<span class="us-tile-unit">%</span></div>
        <div class="us-tile-label">${s.label}</div>
        <div class="us-tile-note">${s.count} of 38</div>
      </div>
    </div>`;
}

function cohort({ title, note, groups, setting }) {
  return `
    <div class="us-cohort-head">
      <h3>${title}</h3>
      <p>${note}</p>
    </div>
    ${groups
      .map(
        (g) => `
      <div class="us-group">
        <div class="us-group-title">${g.title}</div>
        <div class="us-tiles">${g.stats.map(cohortStat).join('')}</div>
      </div>`
      )
      .join('')}
    <div class="us-setting">
      ${setting
        .map(
          (s) => `
        <div class="us-setting-item">
          <div class="us-setting-title">${s.title}</div>
          <p class="us-setting-text">${s.text}</p>
        </div>`
        )
        .join('')}
    </div>`;
}

/**
 * Count each percentage up from zero the first time its tile is seen.
 * A number that lands rather than simply appearing is easier to read
 * off a wall of tiles — but only when motion is welcome.
 */
function animateCounts(root) {
  const targets = root.querySelectorAll('[data-count]');
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    for (const el of targets) settle(el);
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        countUp(entry.target);
        io.unobserve(entry.target);
      }
    },
    { threshold: 0.4 }
  );
  for (const el of targets) io.observe(el);
}

const unitOf = (el) => el.querySelector('span')?.outerHTML || '';

function settle(el) {
  const raw = el.dataset.count;
  const n = Number(raw);
  el.innerHTML = (Number.isFinite(n) ? n.toFixed(raw.includes('.') ? 1 : 0) : raw) + unitOf(el);
}

/**
 * The markup already holds the final number, so a browser that never
 * runs this (background tab, throttled rAF) still shows the right
 * figure. Counting only rewinds it to zero and plays it forward.
 */
function countUp(el) {
  const raw = el.dataset.count;
  const target = Number(raw);
  if (!Number.isFinite(target)) return; // "~1", "2+2" — nothing to count
  const decimals = raw.includes('.') ? 1 : 0;
  const unit = unitOf(el);
  const start = performance.now();
  const step = (now) => {
    const t = Math.min((now - start) / 900, 1);
    const eased = 1 - (1 - t) ** 3;
    el.innerHTML = (target * eased).toFixed(decimals) + unit;
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/**
 * Each step in the markup carries an empty `.us-shot-mount` naming the
 * screenshot it wants. Fill it with the image if the file is there, and
 * with a frame naming the missing path if it is not — so an uncaptured
 * stage says so instead of showing a broken image.
 */
function mountScreens(list) {
  const byId = new Map(list.map((s) => [s.id, s]));
  for (const mount of document.querySelectorAll('.us-shot-mount')) {
    const s = byId.get(mount.dataset.screen);
    if (!s) continue;
    mount.innerHTML = `
      <figure class="us-shot reveal">
        <div class="us-shot-frame">
          <div class="us-shot-bar">
            <span class="us-shot-dot"></span><span class="us-shot-dot"></span><span class="us-shot-dot"></span>
            <span class="us-shot-name">${s.title}</span>
          </div>
          <div class="us-screen-slot placeholder-diagram">Screenshot not captured yet.<br>Drop it at <b>${s.src}</b></div>
        </div>
        <figcaption>${s.caption}</figcaption>
      </figure>`;

    const img = new Image();
    img.onload = () => {
      const slot = mount.querySelector('.us-screen-slot');
      if (!slot) return;
      img.alt = s.caption;
      // Clicking opens the full-size capture: these are dense screens,
      // and the column they sit in is narrower than they were taken.
      const link = document.createElement('a');
      link.className = 'us-shot-link';
      link.href = s.src;
      link.target = '_blank';
      link.rel = 'noopener';
      link.append(img);
      slot.replaceWith(link);
      mount.querySelector('figcaption').insertAdjacentHTML(
        'beforeend',
        ' <span class="us-shot-zoom">(click to open full size)</span>'
      );
    };
    img.src = s.src;
  }
}

async function render() {
  const data = await loadJSON('data/user_study.json');
  document.querySelector('#us-headline').innerHTML = headline(data.headline);
  document.querySelector('#us-cohort').innerHTML = cohort(data.cohort);
  animateCounts(document);
  mountScreens(data.screens);
}

render();

/**
 * The contents bar: it sticks under the site nav, marks the section in
 * view, and fills a thin bar with how far through the page the reader is.
 */
function wireToc() {
  const toc = document.querySelector('#us-toc');
  const links = [...toc.querySelectorAll('[data-toc]')];
  const sections = links.map((a) => document.getElementById(a.dataset.toc));
  const fill = toc.querySelector('.us-toc-bar i');
  const wrap = document.querySelector('.us-widepage');
  const list = toc.querySelector('.us-toc-list');
  let lastActive = -1;
  let ticking = false;
  const update = () => {
    ticking = false;
    const r = wrap.getBoundingClientRect();
    const total = r.height - window.innerHeight;
    const done = Math.min(1, Math.max(0, -r.top / Math.max(1, total)));
    fill.style.transform = `scaleX(${done})`;
    let active = 0;
    sections.forEach((sec, k) => {
      if (sec && sec.getBoundingClientRect().top < window.innerHeight * 0.35) active = k;
    });
    const started = sections[0] && sections[0].getBoundingClientRect().top < window.innerHeight * 0.35;
    links.forEach((a, k) => a.classList.toggle('is-active', k === active && started));
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
  sentinel.className = 'us-toc-sentinel';
  toc.before(sentinel);
  new IntersectionObserver(([e]) => toc.classList.toggle('is-stuck', !e.isIntersecting)).observe(sentinel);
  update();
}

wireToc();
