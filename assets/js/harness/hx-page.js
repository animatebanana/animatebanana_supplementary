import { ready, getState, allSkillsDrawer } from './hx-core.js';
import { styleDrawer } from './hx-setup.js';
import './hx-charts.js';
import './hx-traj.js';
import './hx-failures.js';
import './hx-table.js';
import './hx-gallery.js';

document.querySelector('.hx-page').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-open]');
  if (!b) return;
  const data = await ready();
  const what = b.dataset.open;
  if (what === 'skills') allSkillsDrawer(data);
  else if (what === 'style') styleDrawer(data, data.items.find((i) => i.diagram === getState().diagram).style);
  else if (what.startsWith('style:')) styleDrawer(data, what.slice(6));
});
