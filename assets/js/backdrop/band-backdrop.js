/**
 * <band-backdrop></band-backdrop>
 *
 * A drop-in decorative ground for a full-bleed band. Put one inside a
 * section and the section gets a film-strip backdrop instead of bare
 * paper; take it out and nothing else changes.
 *
 * It renders only background: the element is `aria-hidden`, has no
 * focusable content and no pointer events, so it is invisible to
 * assistive technology and cannot intercept a click meant for the
 * carousel sitting over it.
 *
 * Its own folder (`assets/{css,js}/backdrop/`) rather than the gallery
 * module's, because the band it currently dresses is owned by that
 * module and this must not require editing a file someone else owns —
 * its entire footprint there is a single element in the markup.
 */
class BandBackdrop extends HTMLElement {
  connectedCallback() {
    this.setAttribute('aria-hidden', 'true');
    // The parent has to become the positioning and stacking context, and
    // its real content has to sit above this layer. Doing it from here
    // keeps the host's own stylesheet untouched.
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
