/**
 * Page glue for animatebench.html.
 *
 * The four panes are self-registering custom elements, so there is very
 * little to do here — only the two things that are genuinely the
 * page's business rather than any one pane's:
 *
 *   1  deep-linking, so `animatebench.html#external-reference` opens on
 *      the pane someone was sent to rather than at the top;
 *   2  the legend's colour swatches, which are read from the same
 *      accent variables the panes use so the two can never disagree.
 */

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

// The panes fetch their JSON, so the target may not have its full height
// yet on first paint; one rAF after load is enough for the grid to settle.
addEventListener('load', () => requestAnimationFrame(focusFromHash));
addEventListener('hashchange', focusFromHash);

for (const li of document.querySelectorAll('.bx-legend li[data-pane]')) {
  li.addEventListener('click', () => {
    location.hash = li.dataset.pane;
  });
}
