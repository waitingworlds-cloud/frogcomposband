// Lettered menus the game draws as text (options, knowledge, and the many small "pick one" lists).
// The text keeps its exact place, so nothing is lost or reflowed; each choice gains a key cap,
// a hover highlight, and a click that presses the same key. Keys work exactly as before.
'use strict';
const MENU_TOK = /(^|\s{2,}|^\s+)(\(([A-Za-z0-9@_?])\)|([A-Za-z0-9])\)|\[([A-Za-z0-9])\]|(ESC)\))(?= \S)/g;
function menuBox() {
  let x0 = 0, y0 = 0, x1 = G.w - 1, y1 = G.h - 1;
  const ch = (y, x) => { const r = G.s[y]; return r ? r[x] : ' '; };
  if (G.ov) {
    x0 = y0 = 1e9; x1 = y1 = -1;
    for (let y = 0; y < G.h; y++) for (let x = 0; x < G.w; x++) if (ch(y, x) !== '\x01') { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return null;
  }
  const solid = c => c && c !== ' ' && c !== '\x01';
  const blankRow = y => { for (let x = x0; x <= x1; x++) if (solid(ch(y, x))) return false; return true; };
  const blankCol = x => { for (let y = y0; y <= y1; y++) if (solid(ch(y, x))) return false; return true; };
  while (y1 > y0 && blankRow(y1)) y1--; while (y0 < y1 && blankRow(y0)) y0++;
  while (x1 > x0 && blankCol(x1)) x1--; while (x0 < x1 && blankCol(x0)) x0++;
  return { x0, y0, x1, y1 };
}
function menuHtml() {
  const b = menuBox(); if (!b) return '';
  const rows = []; let n = 0, prose = 0; const pg = pagerInfo(b.y0, b.y1);
  for (let y = b.y0; y <= b.y1; y++) {
    if (pg && (y === pg.head || y === pg.foot)) continue;
    const s = rowText(y).slice(0, b.x1 + 1), toks = []; let m; MENU_TOK.lastIndex = 0;
    while ((m = MENU_TOK.exec(s))) {
      const at = m.index + m[1].length, len = m[2].length, key = m[3] || m[4] || m[5] || (m[6] && 'Esc');
      let end = s.indexOf('  ', at + len + 1); if (end < 0) end = s.length;
      toks.push({ at, len, key, end }); n++;
    }
    if (!toks.length && s.trim().length > 60) prose++;
    rows.push({ y, s, toks });
  }
  if (pg) while (rows.length && !rows[rows.length - 1].s.trim()) rows.pop();
  // only menus: a few choices, and not a page of running text or a table
  const filled = rows.filter(r => r.s.trim()).length;
  if ((n < 3 && !(n === 2 && filled <= 4)) || prose > 4 || n < filled * .3) return '';   // two choices count in a small box (which hand?)
  const nw = b.x1 - b.x0 + 1, nh = rows.length;
  let fs = Math.floor(Math.min((VH - 150) / nh / 1.4, (VW - 160) / nw / .602)); fs = Math.max(11, Math.min(fs, 21));
  const lh = Math.round(fs * 1.4), first = rows.findIndex(r => r.s.trim());
  let out = '';
  rows.forEach((r, i) => {
    if (i === first && !r.toks.length && r.s.trim().length < 50 && !/^[\[(<]/.test(r.s.trim())) { out += `<div class="mrow mtitle" style="padding-left:${r.s.search(/\S/) - b.x0 > 3 ? (r.s.search(/\S/) - b.x0) + 'ch' : 0}">${rowHtml(r.y, r.s.search(/\S/), b.x1 + 1)}</div>`; return; }
    let h = '', x = b.x0;
    for (const t of r.toks) {
      if (t.at < x) continue;
      h += rowHtml(r.y, x, t.at);
      const k = esc(t.key);
      h += `<span class="mch" data-key="${k}"><span class="mkc" style="width:${t.len}ch"><span class="key">${k}</span></span>${rowHtml(r.y, t.at + t.len, t.end)}</span>`;
      x = t.end;
    }
    h += rowHtml(r.y, x, b.x1 + 1);
    out += `<div class="mrow">${h || ' '}</div>`;
  });
  const caret = G.cv && G.cx >= b.x0 && G.cx <= b.x1 + 1 && G.cy >= b.y0 && G.cy <= b.y1 ? `<i class="mcaret" style="left:${G.cx - b.x0}ch;top:${(G.cy - b.y0) * lh + lh - 4}px"></i>` : '';
  const top = pg ? (pg.head === b.y0 ? 1 : 0) : 0;   // rows above the caret that were lifted into the title bar
  const car = pg && G.cy === pg.foot ? '' : caret && top ? caret.replace(/top:(\d+)px/, (m, v) => `top:${v - lh}px`) : caret;
  PAGER = pg;
  return `<div class="pane npanel menup">${pg ? `<div class="pgh">${pagerHead(pg)}</div>` : ''}<div class="mbody" style="font-size:${fs}px;--lh:${lh}px;width:${nw + 1}ch">${out}${car}</div>${pg ? `<div class="pgf">${pagerFoot(pg)}</div>` : ''}</div>`;
}
