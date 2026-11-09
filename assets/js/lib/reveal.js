const STAGGER_MS = 80;

const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-in');
      observer.unobserve(entry.target);
    }
  },
  { rootMargin: '0px 0px -8% 0px', threshold: 0.06 }
);

const matching = (root, selector) => [
  ...(root.nodeType === 1 && root.matches(selector) ? [root] : []),
  ...root.querySelectorAll(selector),
];

function register(root = document) {
  for (const group of matching(root, '[data-reveal-group]')) {
    [...group.children].forEach((child, i) => {
      child.classList.add('reveal');
      child.style.setProperty('--reveal-delay', `${i * STAGGER_MS}ms`);
    });
  }
  for (const el of matching(root, '.reveal:not(.is-in)')) observer.observe(el);
}

register();

new MutationObserver((records) => {
  for (const record of records) {
    for (const node of record.addedNodes) {
      if (node.nodeType === 1) register(node);
    }
  }
}).observe(document.body, { childList: true, subtree: true });
