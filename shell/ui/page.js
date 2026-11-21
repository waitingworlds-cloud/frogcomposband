// A page of the game's own text (help, the full character sheet, message history, knowledge lists), set as type
// inside the shared window: proportional text, section headings with rules, numbers kept in their columns, the
// game's key line turned into buttons. Each piece of text stays where the game put it, so tables still line up.
'use strict';
let PGEO = null;
const pgNum = t => /^[+\-(]?[\d][\d,.:\/%+\-x)]*$/.test(t);
const pgGrid = t => t.length >= 7 && !/ /.test(t) && (/^[a-z]{6,}@?$/.test(t) && t.charCodeAt(1) === t.charCodeAt(0) + 1 || t.replace(/[A-Za-z0-9]/g, '').length > t.length * .6);
const PG_TOK = /^\*?(\(([A-Za-z0-9@_?])\)|([A-Za-z0-9])\)|\[([A-Za-z0-9])\])( |$)/;
function pageRow(y, b, cw, menu) {
  const s = rowText(y).slice(0, b.x1 + 1), body = s.slice(b.x0);
  if (!body.trim()) return '';
  let m;
  if ((m = /^(\s*)([=\-]{3,})\s*(\S.*?)\s*([=\-]{3,})\s*$/.exec(body))) return `<span class="pc psec" style="left:${m[1].length * cw}px;width:${(body.length - m[1].length) * cw}px"><i></i><b>${esc(m[3])}</b><i></i></span>`;
  if ((m = /^(\s*)[=\-_]{6,}\s*$/.exec(body))) return `<span class="pc prule" style="left:${m[1].length * cw}px;width:${(body.trimEnd().length - m[1].length) * cw}px"></span>`;
  const re = /\S+(?: \S+)*/g; let h = '';
  while ((m = re.exec(s))) {
    if (m.index < b.x0) continue; const x = m.index, e = x + m[0].length, t = m[0];
    let k;
    if ((k = /^([=\-]{3,})\s+(\S.*?)\s+([=\-]{3,})$/.exec(t))) h += `<span class="pc psec" style="left:${(x - b.x0) * cw}px;width:${(e - x) * cw}px"><i></i><b>${esc(k[2])}</b><i></i></span>`;
    else if (/^\|+$/.test(t)) h += `<span class="pc pbar" style="left:${(x - b.x0 + .5) * cw}px"></span>`;
    else if (menu && (k = PG_TOK.exec(t))) { const key = k[2] || k[3] || k[4], n = k[0].trimEnd().length; h += `<span class="pc pk${t[0] === '*' ? ' cur' : ''}" data-key="${esc(key)}" style="left:${(x - b.x0) * cw}px"><span class="key">${esc(key)}</span><span style="margin-left:${(n + 1) * cw - 22}px">${rowHtml(y, x + n + 1, e)}</span></span>`; }
    else if (pgGrid(t)) h += `<span class="pc mono" style="left:${(x - b.x0) * cw}px;font-size:${(cw / .602).toFixed(2)}px">${rowHtml(y, x, e)}</span>`;
    else if (pgNum(t)) h += `<span class="pc r" style="left:${(e - b.x0) * cw}px">${rowHtml(y, x, e)}</span>`;
    else h += `<span class="pc" style="left:${(x - b.x0) * cw}px">${rowHtml(y, x, e)}</span>`;
  }
  return h;
}
// the auto-pickup rules editor writes straight over the map: a text editor by nature, so it keeps fixed-width type
const pageEditing = () => !!S && /^\(\^Q:Quit, \^W:Save&Quit|^\([a-z]-[a-z]\) Command:/.test(rowText(0)) && /^[#~?!(]|^\s*$/.test(rowText(1)) && !G.icky;
function editorHtml() {
  HUB.cur = 'opts';
  const fs = 17, cw = fs * .602, lh = 21.5, x1 = Math.min(G.w - 1, 118); let rows = '';
  for (let y = 1; y < G.h; y++) rows += `<div class="pr"><span class="pc mono" style="font-size:${fs}px;opacity:1">${rowHtml(y, 0, x1 + 1)}</span></div>`;
  const pos = /\((\d+),(\d+)\)\s*$/.exec(rowText(0)), menu = /Command:/.test(rowText(0));
  const caret = G.cv && G.cy >= 1 ? `<i class="mcaret" style="left:${G.cx * cw}px;top:${(G.cy - 1) * lh + lh - 3}px;width:${cw}px"></i>` : '';
  const k = (lab, attr, what) => `<span class="pgb" ${attr}><span class="key">${lab}</span>${what}</span>`;
  return `<div class="pane npanel hub">${hubTabsHtml('opts')}<div class="hubb term"><div class="hubterm"><div class="t-h pgh"><b>Auto-pickup rules</b><span class="pgn">one rule a line: what to pick up, leave or destroy without asking${pos ? ` · line ${+pos[2] + 1}` : ''}</span></div>
    <div class="t-w" style="align-items:flex-start;justify-content:flex-start;overflow:hidden"><div class="pgt" style="width:${Math.ceil((x1 + 1) * cw)}px;--lh:${lh}px">${rows}${caret}</div></div>
    <div class="t-f pgf">${menu ? k('Esc', 'data-key="Esc"', 'back to the rules') + '<span class="pgw">press a letter to choose</span>' : k('Esc', 'data-key="Esc"', 'menu') + k('Ctrl W', 'data-key="\x17"', 'save and close') + k('Ctrl Q', 'data-key="\x11"', 'close without saving') + '<span class="pgw">type to edit</span>'}</div></div></div></div>`;
}
function hubPageHtml(side) {
  HUB.cur = hubCur();
  const b = menuBox(), frame = body => `<div class="pane npanel hub">${hubTabsHtml(HUB.cur)}<div class="hubb term">${side || ''}<div class="hubterm">${body}</div></div></div>`;
  if (!b) return frame('');
  let { x0, y0, x1, y1 } = b; const skip = {};
  PAGER = pagerInfo(y0, y1); BROWSE = PAGER ? null : browseInfo(y0, y1);
  // a write-up of one item or creature laid over a knowledge list (72 columns wide, ending in its own "press any key"): only the write-up shows
  let over = false;
  if (!PAGER && !BROWSE && /^<dir>.*ESC\s*$/.test(rowText(y1).trim())) for (let y = y0; y < y1; y++) if (/^\[Press Any Key to Continue\]\s*$/.test(rowText(y).slice(0, 72).trim())) { over = true; y1 = y - 1; x0 = 0; x1 = Math.min(x1, 71); break; }
  const blank = y => !rowText(y).slice(x0, x1 + 1).trim();
  if (BROWSE) { skip[BROWSE.foot] = 1; if (BROWSE.foot === y1) y1--; if (BROWSE.title >= 0) { skip[BROWSE.title] = 1; if (BROWSE.title === y0) y0++; } }
  if (PAGER) { skip[PAGER.head] = 1; if (PAGER.foot >= 0) skip[PAGER.foot] = 1; if (PAGER.head === y0) y0++; if (PAGER.foot === y1) y1--; }
  while (y1 > y0 && blank(y1)) y1--; while (y0 < y1 && blank(y0)) y0++;
  // the text's own left edge, so a page indented by the game is not pushed off centre
  let lx = x1; for (let y = y0; y <= y1; y++) { if (skip[y]) continue; const i = rowText(y).slice(0, x1 + 1).search(/\S/); if (i >= x0 && i < lx) lx = i; } x0 = Math.min(lx, x1);
  // the game's own "(a-r, ESC=exit) Pick one:" line heads the page as a plain question; "[Press ESC to exit]" becomes buttons
  let ask = '', press = '';
  if (!PAGER && !BROWSE) for (let y = y0; y <= y1; y++) { if (skip[y]) continue; const t = rowText(y).slice(x0).trim(); let m;
    if (!ask && (m = /^\([^)]*ESC[^)]*\)\s*(\S.*?):?$/.exec(t))) { ask = m[1]; skip[y] = 1; }
    else if ((m = /^\[(Press [^\]]*)\]$/.exec(t))) { press = m[1]; skip[y] = 1; } }
  while (y1 > y0 && (blank(y1) || skip[y1])) y1--; while (y0 < y1 && (blank(y0) || skip[y0])) y0++;
  const kb = (lab, attr, what) => `<span class="pgb" ${attr}><span class="key">${lab}</span>${what}</span>`;
  const head = over ? '<b>From your journal</b>' : ask ? `<b>${esc(ask)}</b>` : PAGER ? pagerHead(PAGER) : BROWSE && BROWSE.title >= 0 ? `<b>${esc(BROWSE.name)}</b><span class="pgn">click a line to pick it · double-click to read about it</span>` : '';
  const foot = over ? kb('Space', 'data-key=" "', 'back to the list') : PAGER ? pagerFoot(PAGER) : BROWSE ? browseFoot(BROWSE) : press || ask ? kb('Esc', 'data-key="Esc"', 'close') + (/\?/.test(press) ? kb('?', 'data-key="?"', 'help') : '') + (/any key/i.test(press) ? kb('Space', 'data-key=" "', 'continue') : '') : '';
  const nw = Math.max(40, x1 - x0 + 1), nh = y1 - y0 + 1, sideW = side ? 624 : 0;
  const availW = 1452 - sideW, availH = HUB_H - 58 - 40 - (head ? 42 : 0) - (foot ? 48 : 0);
  let lh = Math.min(27, availH / Math.max(nh, 20)), fs = Math.min(19, lh / 1.34), cw = fs * .56;
  if (cw * nw > availW) { cw = availW / nw; fs = cw / .56; }
  cw = Math.round(cw * 100) / 100; lh = Math.floor(lh * 10) / 10;
  let rows = '', toks = 0;
  if (!(PAGER && /Character Sheet|Messages/i.test(PAGER.cap))) for (let y = y0; y <= y1; y++) if (!skip[y] && PG_TOK.test(rowText(y).slice(x0).trimStart())) toks++;
  for (let y = y0; y <= y1; y++) { if (skip[y]) continue; rows += `<div class="pr" data-gy="${y}">${pageRow(y, { x0, x1 }, cw, toks >= 3)}</div>`; }
  const caret = G.cv && G.cx >= x0 && G.cx <= x1 + 1 && G.cy >= y0 && G.cy <= y1 && !skip[G.cy] ? `<i class="mcaret" style="left:${(G.cx - x0) * cw}px;top:${(G.cy - y0) * lh + lh - 3}px;width:${cw}px"></i>` : '';
  PGEO = { x0, cw };
  return frame(`<div class="t-h pgh">${head}</div><div class="t-w${PAGER || over ? ' top' : ''}"><div class="pgt${BROWSE ? ' pick' : ''}" style="width:${Math.ceil(nw * cw)}px;font-size:${fs.toFixed(2)}px;--lh:${lh}px">${rows}${caret}</div></div><div class="t-f pgf">${foot}</div>`);
}
// A small page the game lays over the map (what an item is, what a creature is like): a card in the same type.
function floatHtml() {
  const b = menuBox(); if (!b) return '';
  let { x0, y0, x1, y1 } = b; PAGER = null; BROWSE = null;
  const txt = y => rowText(y).slice(x0, x1 + 1), rc = /^\s*Name\s*:\s*(.+?) \((.)\)\s*$/.exec(txt(y0));
  RECALL = !!rc; if (rc) y0++;
  let wait = '', more = false;
  for (let y = y1; y >= y0; y--) { const t = txt(y).trim(); if (!t) { if (y === y1) y1--; continue; } if (/^\[Press [^\]]*\]$|^-more-$|^\[.*to continue.*\]$/i.test(t)) { wait = t; if (y === y1) y1--; } break; }
  while (y1 > y0 && !txt(y1).trim()) y1--; while (y0 < y1 && !txt(y0).trim()) y0++;
  more = /press any key|-more-|continue/i.test(wait) || /press any (other )?key|press space/i.test(G.s.join('\n'));
  const nw = Math.max(48, x1 - x0 + 1), fs = 18, cw = Math.round(Math.min(fs * .56, 800 / nw) * 100) / 100, lh = 25;
  let rows = ''; for (let y = y0; y <= y1; y++) rows += `<div class="pr${y === y0 && !rc ? ' ptitle' : ''}" data-gy="${y}">${pageRow(y, { x0, x1 }, cw, false)}</div>`;
  PGEO = { x0, cw };
  const caret = G.cv && G.cx >= x0 && G.cx <= x1 + 1 && G.cy >= y0 && G.cy <= y1 ? `<i class="mcaret" style="left:${(G.cx - x0) * cw}px;top:${(G.cy - y0) * lh + lh - 3}px;width:${cw}px"></i>` : '';
  const head = rc ? `<div class="pgh fhead"><canvas class="rmob" data-n="${esc(rc[1])}"></canvas><b>${esc(rc[1])}</b><span class="pgn">what you know of it</span></div>` : '';
  const foot = rc && !more ? '<span class="abtn" data-key="r"><span class="key">r</span>Back</span><span class="abtn" data-key="Esc"><span class="key">Esc</span>Stop looking</span>' : more ? '<span class="abtn go" data-key=" "><span class="key">Space</span>Continue</span>' : '<span class="abtn" data-key="Esc"><span class="key">Esc</span>Close</span>';
  return `<div class="pane npanel fcard">${head}<div class="pgt" style="width:${Math.ceil(nw * cw)}px;font-size:${fs * Math.min(1, cw / (fs * .56))}px;--lh:${lh}px">${rows}${caret}</div><div class="askb ffoot">${foot}</div></div>`;
}
document.addEventListener('click', ev => {
  const row = ev.target.closest && ev.target.closest('.pgt .pr'); if (!row || !PGEO || ev.button !== 0) return;
  const r = row.getBoundingClientRect(), gy = +row.dataset.gy, gx = PGEO.x0 + Math.floor((ev.clientX - r.left) / SCALE / PGEO.cw);
  if (BROWSE && G.cv) { browsePick(gx, gy, ev.detail >= 2); return; }
  const s = (G.s[gy] || '').replace(/\x01/g, ' '); let best = null, m; const re = /(^|[\s\[(])([A-Za-z0-9])[)\]]( |$)/g;
  while ((m = re.exec(s))) { const at = m.index + m[1].length; if (at <= gx + 1) best = m[2]; else if (!best) best = m[2]; }
  if (best) sendText(best);
  else if (/press any (other )?key|press space/i.test(G.s.join('\n'))) sendText(' ');
  else if (RECALL) sendText('r');
});
