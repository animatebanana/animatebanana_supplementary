import { DOODLES, GLYPHS } from '../lib/doodles.js';

/**
 * <doodle-field></doodle-field>                  — full hero backdrop
 * <doodle-field density="sparse"></doodle-field> — lighter, for page heads
 *
 * Floats hand-drawn AI/biology figure doodles and faint notation behind
 * its parent (which must be position: relative). Items sit on three depth
 * layers that move at different rates with the pointer and scroll, while
 * each bobs on its own CSS loop. Placement is hand-tuned, not random, and
 * keeps clear of the centre column where the heading sits.
 */
const HERO_LAYOUT = [
  // [kind, x%, y%, size px, rotation°, depth 0-2]
  ['neuralnet', 6, 14, 86, -8, 2], ['cell', 14, 66, 78, 6, 1], ['dna', 3, 42, 58, 12, 0],
  ['transformer', 89, 12, 72, 6, 2], ['neuron', 94, 47, 76, -12, 1], ['heatmap', 84, 74, 62, 10, 0],
  ['attention', 25, 8, 58, -4, 0], ['sparkle', 73, 21, 30, 0, 1], ['flowchart', 8, 89, 70, -6, 2],
  ['loss', 91, 90, 64, -8, 2], ['virus', 77, 54, 44, 0, 0], ['molecule', 20, 38, 50, 14, 0],
  ['microscope', 69, 86, 58, -4, 1], ['scatter', 29, 79, 56, 4, 1], ['conv', 97, 28, 52, 8, 0],
  ['flask', 1, 71, 50, 6, 1], ['sigmoid', 63, 6, 44, 0, 0], ['sparkle', 31, 56, 20, 0, 2],
  ['glyph', 13, 26, 150, -6, 0], ['glyph', 85, 34, 150, 8, 0], ['glyph', 57, 78, 120, -4, 0],
  ['glyph', 40, 93, 110, 6, 0],
];

const SPARSE_LAYOUT = [
  ['neuralnet', 6, 22, 58, -10, 1], ['sparkle', 16, 72, 24, 0, 2], ['cell', 90, 20, 54, 8, 1],
  ['attention', 86, 74, 50, -6, 2], ['dna', 22, 12, 36, 12, 0], ['heatmap', 76, 10, 42, 0, 0],
  ['glyph', 10, 58, 120, -6, 0], ['glyph', 92, 52, 120, 8, 0],
];

const DEPTH = [0.35, 0.7, 1.15];

class DoodleField extends HTMLElement {
  connectedCallback() {
    const sparse = this.getAttribute('density') === 'sparse';
    const layout = sparse ? SPARSE_LAYOUT : HERO_LAYOUT;
    let glyphIndex = sparse ? 3 : 0;

    const layers = [[], [], []];
    layout.forEach(([kind, x, y, size, rot, depth], i) => {
      const bob = `--bob-dur:${7 + ((i * 1.7) % 6)}s;--bob-delay:-${(i * 0.9) % 7}s;--rot:${rot}deg`;
      const pos = `left:${x}%;top:${y}%;width:${size}px;height:${size}px;${bob}`;
      if (kind === 'glyph') {
        const g = GLYPHS[glyphIndex++ % GLYPHS.length];
        const fs = Math.round(size / Math.max(1, g.length * 0.42));
        layers[depth].push(`<span class="df-item df-glyph" style="${pos};font-size:${fs}px">${g}</span>`);
      } else {
        layers[depth].push(`<svg class="df-item df-doodle" style="${pos}" viewBox="0 0 64 64">${DOODLES[kind]}</svg>`);
      }
    });

    this.setAttribute('aria-hidden', 'true');
    this.innerHTML = `
      <svg width="0" height="0" style="position:absolute">
        <defs>
          <pattern id="dd-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
            <rect width="5" height="5" fill="#FFFEF9"/><rect width="2.2" height="5" fill="#FFD43B"/>
          </pattern>
          <filter id="dd-rough"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="4"/>
            <feDisplacementMap in="SourceGraphic" scale="2.2"/></filter>
        </defs>
      </svg>
      ${layers.map((items, d) => `<div class="df-layer" data-depth="${d}">${items.join('')}</div>`).join('')}`;

    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    this.layers = [...this.querySelectorAll('.df-layer')];
    this.pointer = { x: 0, y: 0 };
    this.onPointer = (e) => {
      this.pointer.x = e.clientX / innerWidth - 0.5;
      this.pointer.y = e.clientY / innerHeight - 0.5;
      this.schedule();
    };
    this.onScroll = () => this.schedule();
    addEventListener('pointermove', this.onPointer, { passive: true });
    addEventListener('scroll', this.onScroll, { passive: true });
  }

  disconnectedCallback() {
    removeEventListener('pointermove', this.onPointer);
    removeEventListener('scroll', this.onScroll);
  }

  schedule() {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      const sy = scrollY;
      this.layers.forEach((layer, d) => {
        const k = DEPTH[d];
        const tx = -this.pointer.x * 26 * k;
        const ty = -this.pointer.y * 18 * k - sy * 0.12 * k;
        layer.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0)`;
      });
    });
  }
}
customElements.define('doodle-field', DoodleField);
