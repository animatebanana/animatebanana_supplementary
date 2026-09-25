/**
 * The footer's "Last updated" date and time, read from the files rather than typed.
 *
 * It used to be nine copies of one hand-written string, and nine copies of a
 * string is a string that goes stale: it sat on 24 September through a day of
 * edits because keeping it true meant remembering to edit it in nine places.
 * So nothing types a date any more. The page reports when it was actually last
 * changed, and the answer follows the files on its own.
 *
 * WHAT COUNTS AS THE PAGE CHANGING. `document.lastModified` alone is not
 * enough: it is the HTML file's own timestamp, and most of what this site is
 * lives beside it. Edit `gallery_items.json` or `gallery-lightbox.js` and the
 * page is different in every way a reader would notice while `gallery.html` is
 * untouched. So the stamp is the newest modification time across the document
 * and the code and content it actually loaded -- which the Resource Timing API
 * can list, because those are the things the browser just fetched. Media is
 * left out deliberately: a re-encoded MP4 is the same example, not an update.
 *
 * DEGRADING. Three things can go wrong and each has an answer that is still
 * true rather than merely non-empty:
 *
 *   - Opened from the disk (`file://`), where `fetch` is blocked and there are
 *     no headers to read. `document.lastModified` is the file's own mtime
 *     there, which is exactly right, so the subresource pass is skipped.
 *   - A server that sends no `Last-Modified`. Browsers then hand back the
 *     current time from `document.lastModified`, which would re-date the page
 *     on every visit, so a timestamp inside the last minute is not trusted and
 *     the markup's own text is left standing.
 *   - No JavaScript at all. The markup ships with a real date in it, kept
 *     current by `tools/set_updated.py`, and this script only ever replaces it
 *     with something newer.
 *
 * AOE, because that is what a submission deadline is quoted in. Anywhere on
 * Earth is UTC-12: the date is still "today" somewhere until it is over
 * everywhere. So the instant is shifted twelve hours back and read in UTC --
 * never in the reader's own zone, which would put a different date in the
 * footer for a reader in Auckland than for one in Los Angeles.
 */

/** Anywhere on Earth is UTC-12, so the AOE date is the UTC date twelve hours back. */
const AOE_OFFSET_MS = 12 * 60 * 60 * 1000;

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Extensions worth consulting: the code and the content, not the media. */
const WATCHED = /\.(?:html?|css|m?js|json|svg)(?:[?#]|$)/i;

/**
 * How many subresources to ask about. Every page here loads well under this;
 * the cap is only so that a page which one day loads two hundred of them
 * cannot turn its footer into a burst of requests.
 */
const MAX_PROBES = 24;

/** A timestamp this close to now is the server declining to answer, not an edit. */
const SUSPICIOUSLY_NOW_MS = 60 * 1000;

const pad2 = (n) => String(n).padStart(2, '0');

/** `25 September 2026, 03:06`, in AOE: the date unpadded, the 24-hour time padded. */
function formatAOE(ms) {
  const d = new Date(ms - AOE_OFFSET_MS);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ` +
    `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

/** The document's own timestamp, or null if the browser had nothing real to give. */
function documentTime() {
  const t = Date.parse(document.lastModified);
  if (!Number.isFinite(t)) return null;
  // A server with no Last-Modified header makes this "now" on every load.
  return Date.now() - t < SUSPICIOUSLY_NOW_MS ? null : t;
}

/**
 * The newest `Last-Modified` among the code and content this page loaded.
 *
 * HEAD rather than GET so nothing is downloaded twice, same-origin only so the
 * page never asks another host about itself, and `allSettled` so one resource
 * that 404s or is blocked cannot take the whole answer down with it.
 */
async function subresourceTime() {
  if (!/^https?:$/.test(location.protocol) || typeof fetch !== 'function') return null;

  const found = [];
  const seen = new Set();
  for (const entry of performance.getEntriesByType?.('resource') || []) {
    const url = entry.name;
    if (seen.has(url) || !WATCHED.test(url)) continue;
    if (new URL(url, location.href).origin !== location.origin) continue;
    seen.add(url);
    found.push(url);
  }
  // Content first: the data files are what an edit usually touches, and they
  // load after the stylesheets and scripts, so a plain first-N cut missed them.
  const isData = (u) => new URL(u, location.href).pathname.includes('/data/');
  const urls = [...found.filter(isData), ...found.filter((u) => !isData(u))].slice(0, MAX_PROBES);
  if (!urls.length) return null;

  const results = await Promise.allSettled(
    urls.map((u) => fetch(u, { method: 'HEAD', cache: 'no-store' }))
  );
  let newest = null;
  for (const r of results) {
    if (r.status !== 'fulfilled' || !r.value.ok) continue;
    const t = Date.parse(r.value.headers.get('Last-Modified') || '');
    if (Number.isFinite(t) && (newest === null || t > newest)) newest = t;
  }
  return newest;
}

async function paint() {
  const slots = document.querySelectorAll('[data-updated]');
  if (!slots.length) return;

  const times = [documentTime(), await subresourceTime()].filter((t) => t !== null);
  if (!times.length) return; // nothing trustworthy to say; the markup's date stands

  const stamp = formatAOE(Math.max(...times));
  for (const slot of slots) slot.textContent = `Last updated ${stamp} (AOE)`;
}

// After load, so the resource list is complete and the footer never competes
// with the page for the first paint.
const run = () => paint().catch(() => {
  /* the date written into the markup is already correct enough to leave alone */
});

if (document.readyState === 'complete') run();
else addEventListener('load', run, { once: true });
