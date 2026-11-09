class BandBackdrop extends HTMLElement {
  connectedCallback() {
    this.setAttribute('aria-hidden', 'true');
    this.parentElement?.classList.add('bk-host');

    this.innerHTML = `
      <span class="bk-spot"></span>
      <span class="bk-line"></span>
      <span class="bk-rail bk-rail-top"><i></i></span>
      <span class="bk-rail bk-rail-bot"><i></i></span>
      <span class="bk-ghost bk-ghost-l"></span>
      <span class="bk-ghost bk-ghost-r"></span>
      <span class="bk-mark bk-mark-tl"></span>
      <span class="bk-mark bk-mark-tr"></span>
      <span class="bk-mark bk-mark-bl"></span>
      <span class="bk-mark bk-mark-br"></span>`;
  }
}

customElements.define('band-backdrop', BandBackdrop);
