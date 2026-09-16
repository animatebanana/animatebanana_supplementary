/**
 * Plays a sequence of still frames back as a loop, standing in for a video
 * element when no encoded clip was kept — most runs here only ever had their
 * frames extracted, not a video file. `mount` swaps one <img>'s src on an
 * interval; call the returned function to stop it (e.g. before re-rendering).
 */
export function mountReel(img, frames, { fps = 4 } = {}) {
  if (!img || !frames || !frames.length) return () => {};
  let i = 0;
  img.src = frames[0];
  img.classList.add('is-reel');
  if (frames.length === 1) return () => {};
  const id = setInterval(() => {
    i = (i + 1) % frames.length;
    img.src = frames[i];
  }, Math.round(1000 / fps));
  return () => clearInterval(id);
}
