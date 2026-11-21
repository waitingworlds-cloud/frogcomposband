// The journal's knowledge lists (items you know, the bestiary, terrain...). The game draws them as a two-column text
// table: groups on the left, the entries of the picked group on the right. Here the same rows are a proper list:
// group buttons on the left, entries with their pictures and counts on the right. A click picks a row (the game's own
// cursor is walked there), a double click or Read opens the write-up. Arrow keys and r work as before.
'use strict';
let CDX_K = null, CDX_TOP = 0;
function codexKind(name) {   // an item kind by the name the list shows
  if (!DICT || !DICT.k) return null;
  if (!CDX_K) { CDX_K = {}; DICT.k.forEach((k, i) => { if (k && k[0]) { const n = tkey(k[0]); if (!(n in CDX_K)) CDX_K[n] = i; } }); }
  const n = tkey(name); if (n in CDX_K) return CDX_K[n];
  const s = n.replace(/^(potions?|scrolls?|rings?|amulets?|wands?|rods?|staffs?|staves|mushrooms?|flasks?) of /, ''); if (s in CDX_K) return CDX_K[s];
  const p = n.replace(/s$/, ''); return p in CDX_K ? CDX_K[p] : null;
}
const CDX_COL = { Found: 'found', Bought: 'bought', Used: 'used', Dest: 'destroyed', Kills: 'slain' };
function codexHtml(b, y0, y1) {
  let hy = -1; for (let y = y0; y < b.foot; y++) if (/^Group\s+Name\b/.test(rowText(y))) { hy = y; break; }
  if (hy < 0) return '';
  let bx = -1; for (let y = hy + 2; y < b.foot && bx < 0; y++) bx = rowText(y).indexOf('|');
  if (bx < 1) return '';
  const cols = rowText(hy).slice(bx).replace(/^\s*Name/, '').trim().split(/\s+/).filter(Boolean), num = cols.filter(c => CDX_COL[c]), symFirst = cols[0] === 'Sym';
  const what = /item|enchant|artifact/i.test(b.name) ? 'obj' : /bestiary/i.test(b.name) ? 'mon' : /terrain/i.test(b.name) ? 'feat' : '';
  const attrAt = (y, x) => ((G.a[y] || [])[x] || 0) & 31, inGroups = G.cx < bx;
  const groups = [], ents = []; let total = null;
  for (let y = hy + 2; y < b.foot; y++) {
    const r = rowText(y), g = r.slice(0, bx).trim(), e = r.slice(bx + 1);
    if (g) groups.push({ name: g, y, sel: attrAt(y, r.search(/\S/)) === 14 });
    if (!e.trim()) continue;
    const at = bx + 1 + e.search(/\S/), m = /^\s*(.*?)(?:\s{2,}(\S.*))?$/.exec(e), vals = m[2] ? m[2].trim().split(/\s+/) : [];
    const nums = what === 'feat' ? [] : symFirst ? vals.slice(-num.length) : vals.slice(0, num.length);
    const row = { name: m[1].trim(), y, nums, sel: attrAt(y, at) === 14 };
    if (/^Totals?$/i.test(row.name)) total = row; else ents.push(row);
  }
  if (!groups.length) return '';
  const art = n => {
    if (what === 'obj') { const ki = codexKind(n), a = ki != null ? artHtml(ki, 40) : ''; if (a) return `<span class="cda">${a}</span>`; }
    if (what === 'mon' || what === 'feat') return `<canvas class="ptart cda" data-k="${what}" data-n="${esc(n)}"></canvas>`;
    return `<span class="ptart em cda">${esc(n.charAt(0).toUpperCase())}</span>`;
  };
  const gcol = `<div class="cdg">${groups.map(g => `<div class="cdgi ${g.sel ? 'sel' : ''} ${g.sel && inGroups ? 'cur' : ''}" data-bgx="1" data-bgy="${g.y}">${esc(cap(g.name))}</div>`).join('')}</div>`;
  const grid = `grid-template-columns:44px 1fr ${num.map(() => '92px').join(' ')}`;
  const head = num.length ? `<div class="cdh" style="${grid}"><span></span><span></span>${num.map(c => `<span>${CDX_COL[c]}</span>`).join('')}</div>` : '';
  const rows = ents.map(e => `<div class="cde ${e.sel ? 'sel' : ''} ${e.sel && !inGroups ? 'cur' : ''}" style="${grid}" data-bgx="${bx + 2}" data-bgy="${e.y}"${b.recall ? ' data-tip="Click to pick · double-click to read about it"' : ''}>${art(e.name)}<b>${esc(cap(e.name))}</b>${num.map((c, i) => `<span class="${+e.nums[i] ? '' : 'zero'}">${esc(e.nums[i] || '')}</span>`).join('')}</div>`).join('');
  const tot = total ? `<div class="cde tot" style="${grid}"><span></span><b>In all</b>${num.map((c, i) => `<span>${esc(total.nums[i] || '')}</span>`).join('')}</div>` : '';
  const cur = ents.find(e => e.sel) || null, gname = (groups.find(g => g.sel) || groups[0]).name;
  const empty = !ents.length ? `<div class="cdnone">${inGroups ? 'Pick a group on the left to see what you know in it.' : 'Nothing known here yet.'}</div>` : '';
  return `<div class="cdx">${gcol}<div class="cdl"><div class="cdt"><b>${esc(cap(gname))}</b>${cur && b.recall ? `<span class="grow"></span><span class="btn go" data-key="${esc(b.recall)}">Read about ${esc(cur.name.length > 28 ? 'it' : cap(cur.name))}</span>` : ''}</div>${head}<div class="cdrows">${rows}${empty}</div>${tot}</div></div>`;
}
document.addEventListener('click', ev => {
  const r = ev.target.closest && ev.target.closest('[data-bgy]'); if (!r || ev.button !== 0 || !BROWSE) return;
  browsePick(+r.dataset.bgx, +r.dataset.bgy, ev.detail >= 2);
});
