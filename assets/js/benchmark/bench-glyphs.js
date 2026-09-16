/**
 * The benchmark's four headline figures, as drawings.
 *
 * Taken from the figure's own top row rather than from an icon set: a stack of
 * diagram thumbnails, the five style swatches (each showing its own signature),
 * a narrative frame with its play head, and the verification badge. Ink
 * outline, pastel fills, banana reserved for the accent — the site's register
 * throughout.
 *
 * They live in their own file because two places draw them: the counted-up band
 * on the overview page (<bench-band>) and the scale row at the top of the
 * benchmark page (<bench-hero>). One copy means the two cannot drift apart, and
 * neither owns the other's file.
 */
export const GLYPH = {
  diagrams: `
    <svg viewBox="0 0 64 48" fill="none" aria-hidden="true">
      <g stroke="currentColor" stroke-width="1.6" stroke-linejoin="round">
        <rect x="4.5" y="10.5" width="38" height="28" rx="2.5" fill="var(--paper)"/>
        <rect x="10.5" y="7.5" width="38" height="28" rx="2.5" fill="var(--paper)"/>
        <rect x="16.5" y="4.5" width="42" height="31" rx="2.5" fill="#fff"/>
      </g>
      <g stroke="currentColor" stroke-width="1.4" stroke-linecap="round">
        <rect x="21" y="11" width="11" height="7.5" rx="1.5" fill="var(--blue-soft)"/>
        <rect x="42" y="11" width="11" height="7.5" rx="1.5" fill="var(--mint-soft)"/>
        <rect x="31.5" y="23" width="11" height="7.5" rx="1.5" fill="var(--banana-soft)"/>
        <path d="M32.5 14.8h8.2M37 19v3.2M36.5 18.6 37 22.6l-1.7-1.4M40.7 14.4l1.2.4-1.2.5"/>
      </g>
    </svg>`,

  styles: `
    <svg viewBox="0 0 64 48" fill="none" aria-hidden="true">
      <g stroke="currentColor" stroke-width="1.5">
        <rect x="2.5" y="12.5" width="13" height="23" rx="2" fill="#fff"/>
        <rect x="15.5" y="9.5" width="13" height="29" rx="2" fill="#fff"/>
        <rect x="28.5" y="6.5" width="13" height="35" rx="2" fill="#fff"/>
        <rect x="41.5" y="9.5" width="13" height="29" rx="2" fill="#fff"/>
        <rect x="51.5" y="12.5" width="10" height="23" rx="2" fill="#fff"/>
      </g>
      <g stroke="currentColor" stroke-width="1.2" stroke-linecap="round">
        <rect x="5.5" y="19" width="7" height="5" rx="1" fill="var(--blue)" opacity=".45"/>
        <rect x="5.5" y="26" width="7" height="5" rx="1" fill="var(--blue)" opacity=".85"/>
        <rect x="18.5" y="16" width="7" height="5" rx="1" fill="var(--mint)"/>
        <rect x="18.5" y="24" width="7" height="5" rx="1" fill="none"/>
        <rect x="31.5" y="12" width="7" height="5" rx="1" fill="var(--banana)"/>
        <rect x="31.5" y="20" width="7" height="5" rx="1" fill="none"/>
        <rect x="31.5" y="28" width="7" height="5" rx="1" fill="none"/>
        <rect x="44.5" y="16" width="7" height="5" rx="1" fill="var(--pink)"/>
        <rect x="44.5" y="24" width="7" height="5" rx="1" fill="none" stroke-dasharray="2 2"/>
        <rect x="54" y="19" width="5" height="5" rx="1" fill="var(--tan)"/>
      </g>
    </svg>`,

  narratives: `
    <svg viewBox="0 0 64 48" fill="none" aria-hidden="true">
      <g stroke="currentColor" stroke-width="1.6" stroke-linejoin="round">
        <rect x="8.5" y="6.5" width="42" height="31" rx="3" fill="#fff"/>
        <path d="M8.5 13.5h42M8.5 30.5h42"/>
      </g>
      <g stroke="currentColor" stroke-width="1.2">
        <rect x="11.5" y="8.5" width="4" height="3" rx=".8" fill="var(--bg-sunk)"/>
        <rect x="19.5" y="8.5" width="4" height="3" rx=".8" fill="var(--bg-sunk)"/>
        <rect x="27.5" y="8.5" width="4" height="3" rx=".8" fill="var(--bg-sunk)"/>
        <rect x="35.5" y="8.5" width="4" height="3" rx=".8" fill="var(--bg-sunk)"/>
        <rect x="43.5" y="8.5" width="4" height="3" rx=".8" fill="var(--bg-sunk)"/>
        <rect x="11.5" y="32.5" width="4" height="3" rx=".8" fill="var(--bg-sunk)"/>
        <rect x="19.5" y="32.5" width="4" height="3" rx=".8" fill="var(--bg-sunk)"/>
        <rect x="27.5" y="32.5" width="4" height="3" rx=".8" fill="var(--bg-sunk)"/>
        <rect x="35.5" y="32.5" width="4" height="3" rx=".8" fill="var(--bg-sunk)"/>
        <rect x="43.5" y="32.5" width="4" height="3" rx=".8" fill="var(--bg-sunk)"/>
      </g>
      <path d="M26 16.6 37.5 22 26 27.4z" fill="var(--banana)" stroke="currentColor"
            stroke-width="1.5" stroke-linejoin="round"/>
      <g stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity=".5">
        <path d="M54 17.5h5M54 22h7.5M54 26.5h5"/>
      </g>
    </svg>`,

  verified: `
    <svg viewBox="0 0 64 48" fill="none" aria-hidden="true">
      <path d="M32 3.5 45 8v12.4c0 9.2-5.6 17.2-13 20.1-7.4-2.9-13-10.9-13-20.1V8z"
            fill="var(--banana-soft)" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
      <circle cx="32" cy="18" r="4.2" fill="#fff" stroke="currentColor" stroke-width="1.5"/>
      <path d="M24.6 30.5c1-4 3.9-6.2 7.4-6.2s6.4 2.2 7.4 6.2" fill="#fff"
            stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <circle cx="46" cy="33" r="8.2" fill="var(--banana)" stroke="currentColor" stroke-width="1.6"/>
      <path d="m42.4 33.2 2.6 2.6 4.8-5.2" stroke="currentColor" stroke-width="1.9"
            stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
};
