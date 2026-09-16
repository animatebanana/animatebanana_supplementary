import { loadJSON } from '../lib/data-loader.js';

/**
 * Overview page glue: counts the stats band up from
 * data/dataset_stats.json when it scrolls into view (array-valued keys
 * count their length). The live demo itself is <anim-showcase>.
 */
async function initStats() {
  const stats = await loadJSON('data/dataset_stats.json');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const target = (el) => {
    const v = stats[el.dataset.count];
    return Array.isArray(v) ? v.length : Number(v) || 0;
  };

  const run = (el) => {
    const end = target(el);
    if (reduced) { el.textContent = end.toLocaleString('en-US'); return; }
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / 1400, 1);
      el.textContent = Math.round(end * (1 - Math.pow(1 - p, 4))).toLocaleString('en-US');
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      run(e.target);
      io.unobserve(e.target);
    }
  }, { threshold: 0.4 });
  document.querySelectorAll('[data-count]').forEach((el) => io.observe(el));
}

initStats();
