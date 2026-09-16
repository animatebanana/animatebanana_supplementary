/**
 * IntersectionObserver helper for the site's "nothing below the fold
 * loads until it's needed" rule (see the work plan's performance
 * budget). Use it to defer starting an animation, loading a video's
 * real `src`, or fetching a heavy asset until the element is on
 * screen.
 *
 * onVisible(el, cb) calls cb(el) once, the first time el intersects
 * the viewport, then stops observing.
 */
export function onVisible(el, callback, options = {}) {
  if (!('IntersectionObserver' in window)) {
    callback(el); // graceful fallback: just run it
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
