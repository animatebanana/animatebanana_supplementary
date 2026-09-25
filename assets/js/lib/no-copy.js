/**
 * Pipeline intermediates (diagram code, parsed XML, animation code) are shown
 * on this site to explain the method, not to be lifted from it. This module
 * makes those panes non-selectable and refuses copy, cut, drag and the context
 * menu over them.
 *
 * It is a deterrent, not protection: the text still reaches the browser, so a
 * reader who opens dev tools or the network tab can still read it. Anything
 * that must not leave our machines should not be put on the page at all.
 *
 * Delegated from the document in the capture phase, so panes that a component
 * renders later are covered without re-running anything.
 */

/** Every pane that shows a pipeline intermediate. */
const GUARDED = [
  '.psm-code', // pipeline stage map — representation excerpt
  '.bl-code', // AnimateBench lightbox — XML / SVG source
  '.ed-xml', // editability — the XML comparison columns
  '.ed-xmlcols',
].join(',');

const inGuarded = (node) => {
  const el = node instanceof Element ? node : node?.parentElement;
  return !!el?.closest(GUARDED);
};

/** True when the selection starts or ends inside a guarded pane. */
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
      // An empty clipboard write, so a paste elsewhere does not quietly carry
      // whatever the previous copy left behind.
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
