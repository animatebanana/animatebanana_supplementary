import { escapeHtml as esc } from './format.js';

let STYLE_NAME = null;

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
  h = h.replace(/```(\w*)/g, '<code>&#96;&#96;&#96;$1</code>');
  h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  h = h.replace(/(^|[\s(])\*([^*\s][^*]*?)\*(?=[\s).,:;]|$)/g, '$1<em>$2</em>');
  h = h.replace(/`([^`]+)`/g, '<code>$1</code>');
  return h;
}
const stripMarks = (s) => s.replace(/^\*+|\*+$/g, '').replace(/:$/, '').trim();

function renderList(items) {
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

export function formatPrompt(text, slots = {}, fills = {}, filled = false, opts = {}) {
  const prevStyle = STYLE_NAME;
  if (opts.style) STYLE_NAME = opts.style;
  try { return layOut(text, slots, fills, filled, opts); }
  finally { STYLE_NAME = prevStyle; }
}

function layOut(text, slots, fills, filled, opts) {
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


export function judgePromptHTML(p, style, styles, example) {
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

export function fullPromptText(p, style) {
  let t = p.template;
  for (const [id, txt] of Object.entries(p.adapters[style])) {
    t = t.split(id === 'STYLE_ADAPTER' ? '{STYLE_ADAPTER}' : `{{${id}}}`).join(txt);
  }
  const art = /^[AEIOU]/.test(style) ? 'an' : 'a';
  return t.replace(/\{A_STYLE\}/g, `${art} ${style}`).replace(/\{STYLE\}/g, style);
}

export function inPlacePromptHTML(p, style) {
  const slots = Object.fromEntries(p.slots.map((s) => [s.id, s.label]));
  return formatPrompt(p.template, slots, p.adapters[style], true, { quiet: true, style });
}
