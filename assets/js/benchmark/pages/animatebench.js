
const PANES = ['diagram-density', 'narrative-diversity', 'rich-annotations', 'external-reference'];

function focusFromHash() {
  const id = location.hash.slice(1);
  if (!PANES.includes(id)) return;
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    block: 'center',
  });
  el.classList.add('is-called');
  setTimeout(() => el.classList.remove('is-called'), 1600);
}

addEventListener('load', () => requestAnimationFrame(focusFromHash));
addEventListener('hashchange', focusFromHash);

for (const li of document.querySelectorAll('.bx-legend li[data-pane]')) {
  li.addEventListener('click', () => {
    location.hash = li.dataset.pane;
  });
}
