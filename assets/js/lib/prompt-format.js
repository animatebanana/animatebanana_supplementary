/**
 * Lays out a prompt for reading: headings, paragraphs, (nested) lists and the
 * response format as a field list, with Markdown marks, *** banners and JSON
 * punctuation removed. The words themselves are never changed.
 *
 * Shared by every page that shows a prompt.
 */
import { escapeHtml as esc } from './format.js';

/* While a prompt is laid out for one particular style, its name stands in for
   {STYLE} / {A_STYLE}, marked so it can be seen to change with the style. */
let STYLE_NAME = null;

/** Inline formatting: bold, italics and code spans lose their marks. */
function inline(raw) {
  let h = esc(raw);
  if (STYLE_NAME) {
    const name = `<span class="pd-stylename">${esc(STYLE_NAME)}</span>`;
    const art = /^[AEIOU]/.test(STYLE_NAME) ? 'an' : 'a';
    h = h.replace(/\{A_STYLE\}/g, `${art} ${name}`).replace(/\{STYLE\}/g, name);
  }
  h = h.replace(/\{A_STYLE\}/g, '<span class="pd-var">a / an + style name</span>')
       .replace(/\{STYLE\}/g, '<span class="pd-var">style name</span>')
       .replace(/\{STYLE_ADAPTER\}/g, '<span class="pd-var">style adapter</span>');
  // the prompts themselves mention ```json (telling the model not to use it):
  // that is content, shown as a literal
  h = h.replace(/```(\w*)/g, '<code>&#96;&#96;&#96;$1</code>');
  h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  h = h.replace(/(^|[\s(])\*([^*\s][^*]*?)\*(?=[\s).,:;]|$)/g, '$1<em>$2</em>');
  h = h.replace(/`([^`]+)`/g, '<code>$1</code>');
  return h;
}
const stripMarks = (s) => s.replace(/^\*+|\*+$/g, '').replace(/:$/, '').trim();

function renderList(items) {
  // items: [{level, ordered, num, html}] -> nested lists; a deeper item nests
  // inside the item before it.
  let i = 0;
  const build = (level) => {
    const ordered = items[i].ordered;
    let out = ordered ? '<ol class="pd-ol">' : '<ul class="pd-ul">';
    while (i < items.length && items[i].level === level) {
      const it = items[i++];
      let inner = `<div class="pd-lt">${it.html}</div>`;
      if (i < items.length && items[i].level > level) inner += build(items[i].level);
      out += ordered ? `<li><span class="pd-num">${esc(it.num)}</span><div class="pd-li">${inner}</div></li>`
                     : `<li><div class="pd-li">${inner}</div></li>`;
    }
    return out + (ordered ? '</ol>' : '</ul>');
  };
  let html = '';
  while (i < items.length) html += build(items[i].level);
  return html;
}

/** The response format as a field list. A style slot inside it ({{sN}}) is
 *  expanded with the chosen style's wording for those fields, marked. */
function renderSchema(lines, fills = {}) {
  const rows = [];
  let inGroup = false;
  const expanded = [];
  for (const l of lines) {
    const sm = l.trim().match(/^\{\{(\w+)\}\}$/);
    if (sm && fills[sm[1]] != null) for (const x of fills[sm[1]].split('\n')) expanded.push([x, true]);
    else expanded.push([l, false]);
  }
  for (const [l, adapted] of expanded) {
    const t = l.trim();
    let m;
    if ((m = t.match(/^"([^"]+)"\s*:\s*\{\s*$/))) { rows.push(`<div class="pd-sgroup"><code>${esc(m[1])}</code></div>`); inGroup = true; }
    else if (/^\},?$/.test(t)) inGroup = false;
    else if ((m = t.match(/^"([^"]+)"\s*:\s*"(.*)"\s*,?\s*$/))) {
      const val = m[2].replace(/^<|>$/g, '');
      rows.push(`<div class="pd-srow${inGroup ? ' is-nested' : ''}${adapted ? ' is-adapted' : ''}"${adapted ? ' title="Wording set by the style adapter"' : ''}>
        <code>${esc(m[1])}</code><span>${inline(val)}</span></div>`);
    }
  }
  return `<div class="pd-schema">${rows.join('')}</div>`;
}

/** The prompt text, laid out: headings, paragraphs, lists, response format.
 *  slots: {id: label}. fills: {id: text} for the chosen style. In `filled`
 *  mode every slot is shown with its text (highlighted); otherwise a slot
 *  outside the response format is shown as a marker pointing to the list
 *  of adapters at the bottom. */
export function formatPrompt(text, slots = {}, fills = {}, filled = false, opts = {}) {
  const prevStyle = STYLE_NAME;
  if (opts.style) STYLE_NAME = opts.style;
  try { return layOut(text, slots, fills, filled, opts); }
  finally { STYLE_NAME = prevStyle; }
}

function layOut(text, slots, fills, filled, opts) {
  // Slots and *** section headings may sit side by side on one line in an
  // arranged template; give each its own line before laying out.
  const lines = text.replace(/\r/g, '')
    .replace(/(\{\{\w+\}\})/g, '\n$1\n')
    .replace(/(\*\*\*[^*\n]+\*\*\*)/g, '\n$1\n')
    .split('\n');
  const out = [];
  let para = [];
  let items = [];
  const flushPara = () => { if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`); para = []; };
  const flushList = () => { if (items.length) out.push(renderList(items)); items = []; };
  const flush = () => { flushPara(); flushList(); };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();
    let m;
    if (/^```/.test(t)) continue;
    if (!t) { flush(); continue; }
    if ((m = t.match(/^\{\{(\w+)\}\}$/)) || t === '{STYLE_ADAPTER}') {
      flush();
      const id = m ? m[1] : 'STYLE_ADAPTER';
      if (filled && fills[id] != null && opts.quiet) {
        // shown in place, exactly as written: no label, only a quiet mark
        out.push(`<div class="pd-filled is-quiet">${layOut(fills[id], {}, {}, false, opts)}</div>`);
      } else if (filled && fills[id] != null) {
        out.push(`<div class="pd-filled"><span class="pd-slot-tag">Style adapter &middot; ${esc(slots[id] || '')}</span>
          ${formatPrompt(fills[id])}</div>`);
      } else {
        out.push(`<div class="pd-slot"><span class="pd-slot-tag">Style adapter</span>
          <b>${esc(slots[id] || 'Style adapter')}</b><span class="pd-slot-note">filled from the list at the bottom</span></div>`);
      }
      continue;
    }
    if (t === '{') {
      flush();
      const block = [];
      let depth = 1;
      while (++i < lines.length) {
        const s = lines[i];
        depth += (s.match(/\{/g) || []).length - (s.match(/\}/g) || []).length;
        if (depth <= 0) break;
        block.push(s);
      }
      out.push(renderSchema(block, fills));
      continue;
    }
    if ((m = t.match(/^\*\*\*\s*(.+?)\s*\*\*\*$/)) || (m = t.match(/^#{1,4}\s+(.+)$/))) {
      flush(); out.push(`<h4 class="pd-h">${inline(stripMarks(m[1].replace(/\*\*/g, '')))}</h4>`); continue;
    }
    if ((m = t.match(/^\*\*([^*]+)\*\*$/))) { flush(); out.push(`<h5 class="pd-h5">${inline(stripMarks(m[1]))}</h5>`); continue; }
    if ((m = line.match(/^(\s*)[-*•]\s+(.*)$/))) {
      flushPara(); items.push({ level: Math.floor(m[1].replace(/\t/g, '  ').length / 2), ordered: false, html: inline(m[2]) }); continue;
    }
    if ((m = line.match(/^(\s*)(\d+)\.\s+(.*)$/))) {
      flushPara(); items.push({ level: Math.floor(m[1].length / 2), ordered: true, num: m[2], html: inline(m[3]) }); continue;
    }
    flushList();
    para.push(t);
  }
  flush();
  return out.join('');
}


/**
 * A prompt shared across styles, for one style: its inputs, the prompt, then
 * the style switch and the per-style parts.
 *
 * A prompt that is almost entirely style-specific reads as empty when
 * shown as slots, so it is shown whole for the chosen style instead, with the
 * style-specific parts highlighted. Slots inside the response format are always
 * shown in place in the chosen style's wording (marked), so the adapter list
 * leaves them out.
 */
export function judgePromptHTML(p, style, styles, example) {
  if (p.pending) return '<p class="pd-pending">This prompt will be added shortly.</p>';
  const slots = Object.fromEntries(p.slots.map((s) => [s.id, s.label]));
  const filled = p.template.replace(/\{\{\w+\}\}/g, '').replace(/\*\*\*[^*]+\*\*\*/g, '').trim().length < 400;
  const at = p.template.search(/^\{\s*$/m);
  const schemaIds = new Set(at < 0 ? [] : [...p.template.slice(at).matchAll(/\{\{(\w+)\}\}/g)].map((x) => x[1]));
  const adapters = filled ? '' : p.slots.filter((sl) => !schemaIds.has(sl.id)).map((sl) => `
    <div class="pd-apart">${p.slots.length > 1 ? `<div class="pd-alabel">${esc(sl.label)}</div>` : ''}
      ${formatPrompt(p.adapters[style][sl.id])}</div>`).join('');
  return `
    ${p.inputs ? `<section class="pd-in"><h4 class="pd-h">What the judge receives</h4>
      <ol class="pd-chips">${p.inputs.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></section>` : ''}
    <section class="pd-prompt">${formatPrompt(p.template, slots, p.adapters[style], filled)}</section>
    <section class="pd-adapters">
      <h4 class="pd-h">Style adapters</h4>
      <p class="pd-note">${filled
        ? 'Most of this prompt depends on the style. The highlighted parts above are the adapter for the style picked here.'
        : 'The prompt is the same for every style; only these parts change.'}${example
        ? ` The worked example uses <b>${esc(example)}</b>.` : ''}</p>
      <div class="pd-styles">${styles.map((s) =>
        `<button type="button" data-style="${esc(s)}"${s === style ? ' class="is-on"' : ''}>${esc(s)}</button>`).join('')}</div>
      <div class="pd-adapter">${adapters}</div>
    </section>`;
}

/** The complete prompt for one style, exactly as it is given to the judge:
 *  the shared text with that style's parts and name filled in. */
export function fullPromptText(p, style) {
  let t = p.template;
  for (const [id, txt] of Object.entries(p.adapters[style])) {
    t = t.split(id === 'STYLE_ADAPTER' ? '{STYLE_ADAPTER}' : `{{${id}}}`).join(txt);
  }
  const art = /^[AEIOU]/.test(style) ? 'an' : 'a';
  return t.replace(/\{A_STYLE\}/g, `${art} ${style}`).replace(/\{STYLE\}/g, style);
}

/** The complete prompt for one style, laid out with its style-specific parts
 *  in place and quietly marked, so switching styles visibly swaps just those
 *  parts. The words are exactly the prompt's own. */
export function inPlacePromptHTML(p, style) {
  const slots = Object.fromEntries(p.slots.map((s) => [s.id, s.label]));
  return formatPrompt(p.template, slots, p.adapters[style], true, { quiet: true, style });
}
