/**
 * Page glue for gallery.html.
 *
 * <gallery-browser> owns every filter and the grid; <gallery-lightbox> owns the
 * fullscreen example. The only things left that are genuinely the page's
 * business are joining them, and making the join survive a reload.
 *
 * A card click deep-links the example into the hash and opens it. Closing the
 * view drops the hash again, so the back button walks the same path the clicks
 * did and a shared `gallery.html?style=…#id` link lands on the open example
 * rather than on the grid with something highlighted somewhere below the fold.
 *
 * The open view can also step to the next example without closing, and the set
 * it steps through is the grid's own — whatever the style filter is currently
 * showing, in the order it is on screen. That is the page's business rather
 * than the viewer's: the viewer does not know what is filtered, and the grid
 * does not know what is open. Each step deep-links like a click, so paging
 * through five examples leaves five history entries and Back retraces them.
 */
import { loadJSON } from '../../lib/data-loader.js';
import { galleryLightbox } from '../gallery-lightbox.js';

const browser = document.querySelector('gallery-browser');
const SRC = browser?.getAttribute('src') || 'data/gallery/gallery_items.json';

let feed = null;
const load = () => (feed ??= loadJSON(SRC));

/**
 * The set the viewer pages through: what the grid is showing right now.
 * Falls back to the whole feed before the grid has rendered (a shared `#id`
 * link arriving cold), so prev/next is never dead on first paint.
 */
function visibleSet(data) {
  const shown = browser?.filtered;
  return Array.isArray(shown) && shown.length ? shown : data?.items || [];
}

async function show(id, { push = true } = {}) {
  const data = await load().catch(() => null);
  const items = visibleSet(data);
  const index = items.findIndex((it) => it.id === id);
  const item = index >= 0 ? items[index] : data?.items?.find((it) => it.id === id);
  if (!item) return;

  mark(id);
  link(id, push);
  galleryLightbox.open({
    item,
    items: index >= 0 ? items : [item],
    index: Math.max(0, index),
    exports: data.exports || [],
    // A step is a move to another example, and reads exactly like a click on
    // its card would: the hash names it and history records it.
    onNavigate: (next) => {
      mark(next.id);
      link(next.id, true);
    },
    onClose: () => {
      mark(null);
      // Closing is a step back, not a new place: replace the hash rather than
      // pushing a second entry, so one Back press returns to wherever the
      // visitor was before the gallery.
      if (location.hash) {
        history.replaceState(null, '', `${location.pathname}${location.search}`);
      }
    },
  });
}

function link(id, push) {
  if (!push || location.hash.slice(1) === id) return;
  history.pushState(null, '', `${location.pathname}${location.search}#${id}`);
}

function mark(id) {
  for (const card of browser?.querySelectorAll('.gb-card') || []) {
    card.classList.toggle('is-selected', !!id && card.dataset.id === id);
  }
}

browser?.addEventListener('galleryselect', (event) => show(event.detail.id));

// A hash change is the back button leaving the example, the back button
// stepping between two of them, or a link arriving at one. All three are
// handled by asking what the hash says now — but a hash we just wrote
// ourselves while paging is already on screen, so it is left alone.
addEventListener('hashchange', () => {
  const id = location.hash.slice(1);
  if (!id) return galleryLightbox.close();
  if (galleryLightbox.el && galleryLightbox.item?.id === id) return;
  show(id, { push: false });
});

// The grid renders from its own fetch, so the cards may not exist yet on load;
// the viewer does not need them, and mark() is a no-op until they arrive.
if (location.hash.slice(1)) {
  addEventListener('load', () => show(location.hash.slice(1), { push: false }));
}
