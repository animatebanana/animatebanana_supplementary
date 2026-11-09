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
