import { NAV_SECTIONS } from '../nav-config.js?v=2';
import { wordmark } from '../lib/wordmark.js';

const brand = () => `
  <a class="brand" href="index.html" aria-label="AnimateBanana home">
    <img class="brand-logo" src="assets/img/logo.png" alt="" width="1536" height="1024">
    ${wordmark()}
  </a>`;

/**
 * <site-nav current="examples"></site-nav>
 * A slim bar with the brand and a Menu button that opens a slide-in
 * drawer listing every section (from nav-config.js), on all screen sizes.
 *
 * The drawer is appended to <body>, not rendered inside the nav: the
 * nav's backdrop-filter would otherwise become the containing block for
 * the drawer's position: fixed.
 */
class SiteNav extends HTMLElement {
  connectedCallback() {
    const current = this.getAttribute('current') || '';
    this.innerHTML = `
      <div class="nav">
        ${brand()}
        <button type="button" class="nav-toggle" aria-expanded="false" aria-controls="nav-drawer">
          <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden="true"><path d="M1 1.5h16M1 7h11M1 12.5h16" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
          Menu
        </button>
      </div>
      <div class="nav-progress" aria-hidden="true"></div>`;

    this.drawer = document.createElement('div');
    this.drawer.className = 'nav-drawer';
    this.drawer.id = 'nav-drawer';
    this.drawer.innerHTML = `
      <div class="nd-backdrop" data-close></div>
      <aside class="nd-panel" role="dialog" aria-modal="true" aria-label="Site sections">
        <div class="nd-head">
          ${brand()}
          <button type="button" class="nd-close" data-close aria-label="Close menu">
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 2l12 12M14 2L2 14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>
          </button>
        </div>
        <p class="nd-kicker">The appendix</p>
        <nav class="nd-links" aria-label="Sections">
          ${NAV_SECTIONS.map(
            (s, i) => `<a href="${s.href}" style="--i:${i}"${s.id === current ? ' class="active" aria-current="page"' : ''}>
              <span class="nd-num">${String(i).padStart(2, '0')}</span>
              <span class="nd-label">${s.label}</span>
              <span class="nd-arrow" aria-hidden="true">→</span>
            </a>`
          ).join('')}
        </nav>
        <div class="nd-foot">
          <a class="btn btn-primary" href="resources.html">Paper ↗</a>
          <a class="btn" href="resources.html">Code</a>
        </div>
      </aside>`;
    document.body.append(this.drawer);

    this.toggle = this.querySelector('.nav-toggle');
    this.toggle.addEventListener('click', () => this.open());
    this.drawer.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]') || e.target.closest('.nd-links a')) this.close();
    });
    this.onKey = (e) => { if (e.key === 'Escape') this.close(); };

    this.progress = this.querySelector('.nav-progress');
    this.onScroll = this.onScroll.bind(this);
    addEventListener('scroll', this.onScroll, { passive: true });
    this.onScroll();
  }

  disconnectedCallback() {
    removeEventListener('scroll', this.onScroll);
    document.removeEventListener('keydown', this.onKey);
    this.drawer?.remove();
  }

  open() {
    this.drawer.classList.add('is-open');
    document.documentElement.classList.add('nd-lock');
    this.toggle.setAttribute('aria-expanded', 'true');
    document.addEventListener('keydown', this.onKey);
    this.drawer.querySelector('.nd-close').focus({ preventScroll: true });
  }

  close() {
    if (!this.drawer.classList.contains('is-open')) return;
    this.drawer.classList.remove('is-open');
    document.documentElement.classList.remove('nd-lock');
    this.toggle.setAttribute('aria-expanded', 'false');
    document.removeEventListener('keydown', this.onKey);
    this.toggle.focus();
  }

  onScroll() {
    if (this.ticking) return;
    this.ticking = true;
    requestAnimationFrame(() => {
      const y = scrollY;
      this.classList.toggle('is-stuck', y > 8);
      const span = document.documentElement.scrollHeight - innerHeight;
      this.progress.style.setProperty('--progress', span > 0 ? Math.min(y / span, 1) : 0);
      this.ticking = false;
    });
  }
}
customElements.define('site-nav', SiteNav);
