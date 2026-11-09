
const AOE_OFFSET_MS = 12 * 60 * 60 * 1000;

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const WATCHED = /\.(?:html?|css|m?js|json|svg)(?:[?#]|$)/i;

const MAX_PROBES = 24;

const SUSPICIOUSLY_NOW_MS = 60 * 1000;

const pad2 = (n) => String(n).padStart(2, '0');

function formatAOE(ms) {
  const d = new Date(ms - AOE_OFFSET_MS);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ` +
    `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

function documentTime() {
  const t = Date.parse(document.lastModified);
  if (!Number.isFinite(t)) return null;
  return Date.now() - t < SUSPICIOUSLY_NOW_MS ? null : t;
}

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
  if (!times.length) return;

  const stamp = formatAOE(Math.max(...times));
  for (const slot of slots) slot.textContent = `Last updated ${stamp} (AOE)`;
}

const run = () => paint().catch(() => {
});

if (document.readyState === 'complete') run();
else addEventListener('load', run, { once: true });
