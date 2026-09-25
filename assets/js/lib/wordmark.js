/**
 * Static AnimateBanana wordmark matching the hero title: solid "Animate",
 * outlined + hatched "Banana" with a banana offset shadow. Styled by
 * `.wordmark` in base.css; size it with font-size on the element.
 * The shadow is its own span (not text-shadow) so it can't paint over the
 * clipped hatch fill.
 */
export const wordmark = (className = '') => `
  <span class="wordmark ${className}" aria-label="AnimateBanana">
    <span class="wordmark-a" aria-hidden="true">Animate</span><span class="wordmark-b" aria-hidden="true"><span class="wordmark-shadow">Banana</span><span class="wordmark-face">Banana</span></span>
  </span>`;
