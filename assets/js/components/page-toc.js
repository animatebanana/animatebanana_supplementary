function wireToc() {
  const toc = document.querySelector('#pg-toc');
  if (!toc) return;
  const links = [...toc.querySelectorAll('[data-toc]')];
  const fill = toc.querySelector('.pg-toc-bar i');
  const wrap = toc.closest('.page') || document.body;
  const list = toc.querySelector('.pg-toc-list');
  let lastActive = -1;
  let ticking = false;
  const update = () => {
    ticking = false;
    const r = wrap.getBoundingClientRect();
    const total = r.height - window.innerHeight;
    const done = Math.min(1, Math.max(0, -r.top / Math.max(1, total)));
    fill.style.transform = `scaleX(${done})`;
    const sections = links.map((a) => document.getElementById(a.dataset.toc));
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
  const sentinel = document.createElement('div');
  sentinel.className = 'pg-toc-sentinel';
  toc.before(sentinel);
  new IntersectionObserver(([e]) => toc.classList.toggle('is-stuck', !e.isIntersecting)).observe(sentinel);
  update();
}

function settleHash() {
  const id = decodeURIComponent(location.hash.slice(1));
  if (!id) return;
  let stopped = false;
  const stop = () => { stopped = true; };
  for (const ev of ['wheel', 'touchstart', 'keydown', 'pointerdown']) {
    window.addEventListener(ev, stop, { once: true, passive: true });
  }
  const t0 = performance.now();
  const tick = () => {
    if (stopped || performance.now() - t0 > 6000) return;
    const el = document.getElementById(id);
    if (el) {
      const want = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
      if (Math.abs(el.getBoundingClientRect().top - want) > 2) el.scrollIntoView({ block: 'start' });
    }
    setTimeout(tick, 120);
  };
  tick();
}

wireToc();
settleHash();
window.addEventListener('hashchange', settleHash);
