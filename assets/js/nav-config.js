/**
 * Single source of truth for the persistent top nav. Add a new
 * section here and it appears on every page that includes
 * <site-nav> — no need to touch nine copies of a hardcoded <nav>.
 *
 * Order is the reading order of the appendix. `id` must match the
 * `current="…"` attribute the page sets on its <site-nav>.
 *
 * The pipeline, editability, gallery and benchmark also appear on the overview
 * as sections of their own, in the same order they are listed here.
 */
export const NAV_SECTIONS = [
  { id: 'overview',     label: 'Overview',     href: 'index.html' },
  { id: 'pipeline',     label: 'Pipeline Walkthrough', href: 'pipeline.html' },
  { id: 'editability',  label: 'Editability and Controllability', href: 'editability.html' },
  { id: 'examples',     label: 'Example Gallery', href: 'gallery.html' },     // the gallery module owns this page
  { id: 'animatebench', label: 'AnimateBench', href: 'animatebench.html' }, // the benchmark module owns this page
  { id: 'evaluation',   label: 'Evaluation',   href: 'evaluation.html' },
  { id: 'ablations',    label: 'Ablations',    href: 'ablations.html' },
  { id: 'failures',     label: 'Failure cases', href: 'failures.html' },
  { id: 'user-study',   label: 'User study',   href: 'user-study.html' },
  { id: 'costs',        label: 'Latency and Costs', href: 'costs.html' },
];
