
const GUARDED = [
  '.psm-code',
  '.bl-code',
  '.ed-xml',
  '.ed-xmlcols',
].join(',');

const inGuarded = (node) => {
  const el = node instanceof Element ? node : node?.parentElement;
  return !!el?.closest(GUARDED);
};

function selectionTouchesGuarded() {
  const sel = document.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) return false;
  return inGuarded(sel.anchorNode) || inGuarded(sel.focusNode);
}

for (const type of ['copy', 'cut']) {
  document.addEventListener(
    type,
    (e) => {
      if (!selectionTouchesGuarded()) return;
      e.preventDefault();
      e.clipboardData?.setData('text/plain', '');
    },
    true
  );
}

for (const type of ['contextmenu', 'dragstart', 'selectstart']) {
  document.addEventListener(
    type,
    (e) => {
      if (inGuarded(e.target)) e.preventDefault();
    },
    true
  );
}
