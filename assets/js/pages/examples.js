/**
 * Wires <gallery-grid>'s `exampleselect` event to the full-screen
 * <dialog> holding <example-viewer>. This is the entire page-specific
 * glue — both components are reused as-is from assets/js/components/.
 */
const grid = document.querySelector('gallery-grid');
const dialog = document.querySelector('#viewer-dialog');
const viewer = document.querySelector('#viewer');
const closeBtn = document.querySelector('#viewer-close');

grid.addEventListener('exampleselect', (e) => {
  viewer.setAttribute('example-id', e.detail.id);
  dialog.showModal();
});

closeBtn.addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (e) => {
  // Click on the backdrop (the <dialog> element itself, outside the inner wrapper) closes it.
  if (e.target === dialog) dialog.close();
});
