/**
 * The contents bar: it sticks under the site nav, marks the section in
 * view, and fills a thin bar with how far through the page the reader is.
 */
function wireToc() {
  const toc = document.querySelector('#pg-toc');
  const links = [...toc.querySelectorAll('[data-toc]')];
  const sections = links.map((a) => document.getElementById(a.dataset.toc));
  const fill = toc.querySelector('.pg-toc-bar i');
  const wrap = document.querySelector('.abl-widepage');
  const list = toc.querySelector('.pg-toc-list');
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
  sentinel.className = 'pg-toc-sentinel';
  toc.before(sentinel);
  new IntersectionObserver(([e]) => toc.classList.toggle('is-stuck', !e.isIntersecting)).observe(sentinel);
  update();
}


wireToc();
