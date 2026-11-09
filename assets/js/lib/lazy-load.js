export function onVisible(el, callback, options = {}) {
  if (!('IntersectionObserver' in window)) {
    callback(el);
    return null;
  }
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        callback(entry.target);
        io.unobserve(entry.target);
      }
    }
  }, options);
  io.observe(el);
  return io;
}
