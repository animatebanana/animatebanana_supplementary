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

export function clearCache(path) {
  if (path) cache.delete(path);
  else cache.clear();
}
