class HeroWordmark extends HTMLElement {
  connectedCallback() {
    const text = this.getAttribute('text') || 'AnimateBanana';
    const split = Number(this.getAttribute('split') ?? 7);

    const solid = [...text.slice(0, split)]
      .map((ch, i) => `<i class="wm-l" style="--i:${i}">${ch}</i>`)
      .join('');

    const outlined = [...text.slice(split)]
      .map(
        (ch, j) =>
          `<i class="wm-l wm-l-out" style="--i:${split + j}"><span class="wm-shadow">${ch}</span><span class="wm-face">${ch}</span></i>`
      )
      .join('');

    this.innerHTML = `
      <h1 class="wm" aria-label="${text}">
        <span class="wm-seg wm-seg-a" aria-hidden="true">${solid}</span><span
              class="wm-seg wm-seg-b" aria-hidden="true">${outlined}</span>
      </h1>`;
  }
}
customElements.define('hero-wordmark', HeroWordmark);
