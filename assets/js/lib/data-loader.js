/**
 * Tiny fetch+cache wrapper so multiple components on the same page
 * (e.g. gallery-grid and example-viewer both wanting examples.json)
 * only trigger one network request. All JSON paths are relative to
 * the site root (see README "Path conventions").
 */
const cache = new Map();

export function loadJSON(path) {
  if (!cache.has(path)) {
    cache.set(
      path,
      fetch(path, { cache: 'no-cache' }).then((res) => {
        if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
        return res.json();
      })
    );
  }
  return cache.get(path);
}

/** Escape hatch for tests/dev: drop a cached path (or everything). */
export function clearCache(path) {
  if (path) cache.delete(path);
  else cache.clear();
}
