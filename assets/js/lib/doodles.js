/**
 * Hand-drawn doodle library for the floating backdrop — the kind of
 * things that show up inside real AI and biology figures. Each entry is
 * the inner markup of a 64×64 SVG, stroked by <doodle-field>.
 * `fill="url(#dd-hatch)"` gives the banana cross-hatch.
 */
export const DOODLES = {
  neuralnet: `
    <path stroke-width="1.2" opacity=".7" d="M12 16L32 10M12 16L32 24M12 16L32 40M12 16L32 54M12 32L32 10M12 32L32 24M12 32L32 40M12 32L32 54M12 48L32 10M12 48L32 24M12 48L32 40M12 48L32 54M32 10L52 24M32 10L52 40M32 24L52 24M32 24L52 40M32 40L52 24M32 40L52 40M32 54L52 24M32 54L52 40"/>
    <circle cx="12" cy="16" r="3.8" fill="#FFFEF9"/><circle cx="12" cy="32" r="3.8" fill="#FFFEF9"/><circle cx="12" cy="48" r="3.8" fill="#FFFEF9"/>
    <circle cx="32" cy="10" r="3.8" fill="#FFFEF9"/><circle cx="32" cy="24" r="3.8" fill="#FFFEF9"/><circle cx="32" cy="40" r="3.8" fill="#FFFEF9"/><circle cx="32" cy="54" r="3.8" fill="#FFFEF9"/>
    <circle cx="52" cy="24" r="4.2" fill="url(#dd-hatch)"/><circle cx="52" cy="40" r="4.2" fill="url(#dd-hatch)"/>`,
  transformer: `
    <rect x="12" y="5" width="36" height="14" rx="3" fill="url(#dd-hatch)"/>
    <rect x="12" y="26" width="36" height="14" rx="3"/><rect x="12" y="47" width="36" height="12" rx="3"/>
    <path d="M30 19v7M30 40v7M18 12h14M18 33h20M18 53h10"/>
    <path d="M48 12c9 0 9 21 0 21M48 33c9 0 9 20 0 20"/><circle cx="55" cy="22.5" r="2.4"/>`,
  heatmap: `
    <rect x="10" y="10" width="44" height="44" rx="2"/>
    <rect x="10" y="10" width="11" height="11" fill="url(#dd-hatch)" stroke="none"/><rect x="21" y="21" width="11" height="11" fill="url(#dd-hatch)" stroke="none"/>
    <rect x="32" y="32" width="11" height="11" fill="url(#dd-hatch)" stroke="none"/><rect x="43" y="43" width="11" height="11" fill="url(#dd-hatch)" stroke="none"/>
    <rect x="32" y="10" width="11" height="11" fill="currentColor" opacity=".28" stroke="none"/><rect x="10" y="43" width="11" height="11" fill="currentColor" opacity=".18" stroke="none"/>
    <path stroke-width="1.3" d="M21 10v44M32 10v44M43 10v44M10 21h44M10 32h44M10 43h44"/>`,
  conv: `
    <path d="M6 26h26l10-12H16z"/><path d="M6 38h26l10-12H16z"/><path d="M6 50h26l10-12H16z" fill="url(#dd-hatch)"/>
    <rect x="47" y="36" width="11" height="11"/><path d="M36 44l11-8M36 50l11-3" stroke-dasharray="2 3"/>`,
  neuron: `
    <circle cx="18" cy="32" r="7" fill="url(#dd-hatch)"/>
    <path d="M12.5 27.5L6 20M6 20l-3 2M6 20l1-5M12.5 36.5L5 43M5 43l-2.5-3M5 43l1 4M16 25l-2-8M18 39l-1 8M25 32h29M54 32l6-6M54 32l6 6M54 32h7"/>
    <rect x="28" y="29" width="6" height="6" rx="3" fill="#FFFEF9"/><rect x="37" y="29" width="6" height="6" rx="3" fill="#FFFEF9"/><rect x="46" y="29" width="6" height="6" rx="3" fill="#FFFEF9"/>`,
  cell: `
    <ellipse cx="32" cy="32" rx="26" ry="22"/><circle cx="25" cy="30" r="9" fill="url(#dd-hatch)"/>
    <circle cx="27" cy="28" r="2.4" fill="currentColor"/>
    <rect x="38" y="36" width="14" height="7.5" rx="3.75"/><path stroke-width="1.4" d="M40 39.8c2-2 3 2 5 0s3 2 5 0M38 18c3-2 6 2 9 0s5 2 7 1M36 23c3-2 6 2 9 0"/>
    <circle cx="14" cy="38" r="1.2" fill="currentColor"/><circle cx="45" cy="28" r="1.2" fill="currentColor"/><circle cx="21" cy="46" r="1.2" fill="currentColor"/>`,
  microscope: `
    <path d="M12 57h38M36 57c11-4 13-17 4-25M22 44h20M34 36.5l-2 7"/>
    <path d="M20 11l10-4 12.5 26.5-10 4z" fill="url(#dd-hatch)"/><path d="M17.5 7.5l9-3.5"/><circle cx="37" cy="24" r="2.4"/>`,
  flowchart: `
    <rect x="19" y="4" width="26" height="11" rx="2.5"/><path d="M32 15v5"/>
    <path d="M32 20l9.5 8.5-9.5 8.5-9.5-8.5z" fill="url(#dd-hatch)"/>
    <path d="M22.5 28.5H14v8M41.5 28.5H50v8"/><rect x="5" y="37" width="18" height="11" rx="2.5"/><rect x="41" y="37" width="18" height="11" rx="2.5"/>
    <path d="M14 48v7h36v-7"/>`,
  loss: `
    <path d="M8 6v50h50"/><path d="M12 12c4 22 10 30 20 34s16 4 24 5"/>
    <path stroke-dasharray="3 3" d="M12 17c5 19 12 25 22 27s14 0 22-3"/>
    <circle cx="16" cy="26" r="1.9" fill="currentColor"/><circle cx="24" cy="38" r="1.9" fill="currentColor"/><circle cx="37" cy="46.5" r="1.9" fill="currentColor"/><circle cx="51" cy="50" r="1.9" fill="currentColor"/>`,
  scatter: `
    <path d="M8 6v50h50"/>
    <circle cx="18" cy="42" r="2.4"/><circle cx="23" cy="46" r="2.4"/><circle cx="16" cy="48" r="2.4"/><circle cx="25" cy="39" r="2.4"/><circle cx="20" cy="36" r="2.4"/>
    <circle cx="43" cy="18" r="3" fill="url(#dd-hatch)"/><circle cx="48" cy="25" r="3" fill="url(#dd-hatch)"/><circle cx="40" cy="25" r="3" fill="url(#dd-hatch)"/><circle cx="50" cy="16" r="3" fill="url(#dd-hatch)"/>
    <ellipse cx="45" cy="21" rx="12" ry="10" stroke-dasharray="3 3"/>`,
  attention: `
    <path d="M10 46C10 32 34 32 34 46M22 46C22 22 58 22 58 46"/><path stroke-width="3.4" d="M10 46C10 12 46 12 46 46"/>
    <rect x="6" y="46" width="8" height="10" rx="2"/><rect x="18" y="46" width="8" height="10" rx="2"/><rect x="30" y="46" width="8" height="10" rx="2" fill="url(#dd-hatch)"/>
    <rect x="42" y="46" width="8" height="10" rx="2"/><rect x="54" y="46" width="8" height="10" rx="2"/>`,
  dna: `
    <path d="M22 5c20 10 20 17 0 27s-20 17 0 27M42 5c-20 10-20 17 0 27s20 17 0 27"/>
    <path d="M25 11h14M28 19h8M25 26h14M25 38h14M28 45h8M25 53h14"/>`,
  molecule: `
    <path d="M33 25l-5.5 9.5h-11L11 25l5.5-9.5h11z"/>
    <path d="M53 45l-5.5 9.5h-11L31 45l5.5-9.5h11z" fill="url(#dd-hatch)"/>
    <path d="M27.5 34.5l9 1M47.5 35.5l6-14"/><circle cx="54.5" cy="18" r="3.2"/>`,
  flask: `
    <path d="M24 7h16M27.5 7v15L12.5 50a5 5 0 0 0 4.4 7.3h30.2a5 5 0 0 0 4.4-7.3L36.5 22V7"/>
    <path d="M17.2 41h29.6l4.7 9a3.4 3.4 0 0 1-3 5h-33a3.4 3.4 0 0 1-3-5z" fill="url(#dd-hatch)" stroke="none"/>
    <circle cx="29" cy="33" r="2.2"/><circle cx="35" cy="27" r="1.4"/>`,
  virus: `
    <circle cx="32" cy="32" r="13" fill="url(#dd-hatch)"/>
    <path d="M32 19v-8M32 45v8M19 32h-8M45 32h8M22.8 22.8l-5.6-5.6M41.2 41.2l5.6 5.6M22.8 41.2l-5.6 5.6M41.2 22.8l5.6-5.6"/>
    <circle cx="32" cy="9" r="2.2"/><circle cx="32" cy="55" r="2.2"/><circle cx="9" cy="32" r="2.2"/><circle cx="55" cy="32" r="2.2"/>
    <circle cx="15.5" cy="15.5" r="2.2"/><circle cx="48.5" cy="48.5" r="2.2"/><circle cx="15.5" cy="48.5" r="2.2"/><circle cx="48.5" cy="15.5" r="2.2"/>`,
  sigmoid: `
    <path opacity=".5" d="M6 32h52M32 6v52"/><path stroke-dasharray="3 3" d="M6 10h52"/>
    <path stroke-width="3" d="M6 54c16 0 18-2 26-22s10-22 26-22"/>`,
  sparkle: `
    <path d="M32 7c2 14 10.5 22.5 25 25-14.5 2.5-23 11-25 25-2-14-10.5-22.5-25-25 14.5-2.5 23-11 25-25z" fill="url(#dd-hatch)"/>`,
};

/** Notation from ML and biology figures, floated large and faint. */
export const GLYPHS = ['∑', '∇θ', 'σ(·)', '∂ℒ', 'λ', 'p(y|x)', 'α', 'softmax', 'ATCG', '∫'];
