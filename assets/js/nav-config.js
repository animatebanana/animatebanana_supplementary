/**
 * Single source of truth for the persistent top nav. Add a new
 * section here and it appears on every page that includes
 * <site-nav> — no need to touch nine copies of a hardcoded <nav>.
 *
 * Order is the reading order of the appendix. `id` must match the
 * `current="…"` attribute the page sets on its <site-nav>.
 */
export const NAV_SECTIONS = [
  { id: 'overview',     label: 'Overview',     href: 'index.html' },
  { id: 'examples',     label: 'Examples',     href: 'gallery.html' },      // the gallery module owns this page
  { id: 'pipeline',     label: 'Pipeline',     href: 'pipeline.html' },     // the animated walkthrough
  { id: 'animatebench', label: 'AnimateBench', href: 'animatebench.html' }, // the benchmark module owns this page
  { id: 'evaluation',   label: 'Evaluation',   href: 'evaluation.html' },
  { id: 'ablations',    label: 'Ablations',    href: 'ablations.html' },
  { id: 'editability',  label: 'Editability',  href: 'editability.html' },
];
