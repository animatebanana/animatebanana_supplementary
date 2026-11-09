import { loadJSON } from '../../lib/data-loader.js';
import { galleryLightbox } from '../gallery-lightbox.js?v=2';

const browser = document.querySelector('gallery-browser');
const SRC = browser?.getAttribute('src') || 'data/gallery/gallery_items.json';

let feed = null;
const load = () => (feed ??= loadJSON(SRC));

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
    onNavigate: (next) => {
      mark(next.id);
      link(next.id, true);
    },
    onClose: () => {
      mark(null);
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

addEventListener('hashchange', () => {
  const id = location.hash.slice(1);
  if (!id) return galleryLightbox.close();
  if (galleryLightbox.el && galleryLightbox.item?.id === id) return;
  show(id, { push: false });
});

if (location.hash.slice(1)) {
  addEventListener('load', () => show(location.hash.slice(1), { push: false }));
}
