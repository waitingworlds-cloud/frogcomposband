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
let MENU_NOTE = '';
const menuNote = () => MENU_NOTE ? `<div class="mnote"><span>${esc(MENU_NOTE)}</span><span class="btn go" data-key=" ">OK</span></div>` : '';
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
  // something the game says over a menu and waits on ("...just yet. Press any key to continue.", "... -more-"): a note on top of it
  MENU_NOTE = '';
  { const i = rows.findIndex(r => /-more-\s*$|Press any key to continue\.?\s*$/i.test(r.s)), ft = rows.findIndex(r => r.toks.length);
    if (i >= 0 && (ft < 0 || i < ft)) { MENU_NOTE = rows.slice(0, i + 1).map(r => r.s.trim()).filter(Boolean).join(' ').replace(/\s*(-more-|Press any key to continue\.?)\s*$/i, '').replace(/\begos\b/, 'enchanted kinds')
      .replace(/^You have activated the Mogaminator for the first time.*$/, 'Your pickup rules start from the game\'s own list. You can change them here at any time.'); rows.splice(0, i + 1); } }
  // only menus: a few choices, and not a page of running text or a table
  const filled = rows.filter(r => r.s.trim()).length;
  if ((n < 3 && !(n === 2 && filled <= 4)) || prose > 4 || n < filled * .3) return '';   // two choices count in a small box (which hand?)
  { const c = menuCards(rows, b) || menuSections(rows, b); if (c) return c; }
  if (G.icky) return '';   // any other menu is set as a page in the shared window, its choices still clickable
  const nw = b.x1 - b.x0 + 1, nh = rows.length;
  let fs = Math.floor(Math.min((HUB_H - 58 - 40 - (pg ? 92 : 0)) / nh / 1.4, 1452 / nw / .602)); fs = Math.max(11, Math.min(fs, 21));
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

// a plain list of choices, one per line (the options menu and its kind): shown as cards like the start screen.
// Anything with more on a line than a key and its name keeps the text layout above.
function menuCards(rows, b) {
  const items = rows.filter(r => r.toks.length), other = rows.filter(r => !r.toks.length && r.s.trim());
  if (items.length < 4 || items.length > 30 || other.length > 4) return '';
  if (!items.every(r => r.toks.length === 1 && !r.s.slice(b.x0, r.toks[0].at).trim() && !r.s.slice(r.toks[0].end).trim() && r.toks[0].end - r.toks[0].at < 48)) return '';
  const first = rows.findIndex(r => r.s.trim()), title = rows[first] && !rows[first].toks.length ? rows[first] : null;
  const lastItem = rows.indexOf(items[items.length - 1]);
  if (other.some(r => r !== title && rows.indexOf(r) < lastItem)) return '';   // words between the choices: not a plain list
  const foot = rows.slice(lastItem + 1).filter(r => r.s.trim());
  let groups = [[]];
  rows.slice(title ? first + 1 : 0, lastItem + 1).forEach(r => { if (r.toks.length) groups[groups.length - 1].push(r); else if (groups[groups.length - 1].length) groups.push([]); });
  groups = groups.filter(g => g.length);
  // the game marks the row its cursor is on with its own colour: the one item coloured unlike the rest
  const hue = r => { const a = G.a[r.y] || [], t = r.toks[0]; for (let x = t.at + t.len; x < t.end; x++) if (rowText(r.y)[x] !== ' ') return a[x] & 31; return -1; };
  const hues = items.map(hue), tally = {}; hues.forEach(h => tally[h] = (tally[h] || 0) + 1);
  const odd = hues.filter(h => tally[h] === 1), cur = odd.length === 1 && Object.keys(tally).length === 2 ? items[hues.indexOf(odd[0])] : null;
  const tw = title && MENU_TITLES[title.s.trim()], hid = r => MENU_HIDE[r.s.slice(r.toks[0].at + r.toks[0].len, r.toks[0].end).trim()];
  const card = r => { const t = r.toks[0], k = esc(t.key); return hid(r) ? '' : `<div class="mcard${r === cur ? ' cur' : ''}${MENU_NOTE ? ' off' : ''}" data-key="${k}"><span class="key">${k}</span><span class="ml">${menuWord(r, t.at + t.len, t.end)}</span></div>`; };
  const footRow = r => /^Move to <dir>, Select to Enter, Cancel to ESC/.test(r.s.trim()) ? '<span class="row" data-key="Esc" style="cursor:pointer"><span class="key">Esc</span>Close</span><span class="mhint">click a choice, or use the arrows and Enter</span>' : rowHtml(r.y, r.s.search(/\S/), b.x1 + 1);
  return `<div class="pane npanel menup mcards${tw ? ' mjournal mopts' : ''}">${title ? `<div class="mtitle ctitle">${tw ? `${esc(tw[0])}<small>${esc(tw[1])}</small>` : rowHtml(title.y, title.s.search(/\S/), b.x1 + 1)}</div>` : ''}
    ${menuNote()}${groups.map(g => `<div class="mgrid">${g.map(card).join('')}</div>`).join('')}
    ${foot.length ? `<div class="mfoot">${foot.map(footRow).join('<br>')}${digitKeys(foot)}</div>` : ''}</div>`;
}
// a number asked below a menu ("Delay Factor (0-9 or ESC to accept)"): each digit is a button
function digitKeys(foot) {
  const m = foot.map(r => r.s).join(' ').match(/\((\d)-(\d) or ESC/i); if (!m) return '';
  let h = ''; for (let d = +m[1]; d <= +m[2]; d++) h += `<span class="mcard mdig" data-key="${d}"><span class="key">${d}</span></span>`;
  return `<div class="mdigs">${h}<span class="mcard mdig" data-key="Esc"><span class="key">Esc</span><span class="ml">done</span></span></div>`;
}

// plainer names for the game's own menu words, with a line saying what each choice shows
const MENU_TITLES = { 'Display current knowledge': ['Journal', 'Everything your character has learned so far'] };
const MENU_HIDE = { 'Window Flags': 1 };   // extra terminal windows: this version has none (the key still works)
Object.assign(MENU_TITLES, { 'FrogComposband Options': ['Options', 'How the game plays, and what it shows you'] });
const MENU_WORDS = {
  'Input Options': ['Controls', 'keys, prompts and repeats'], 'Map Screen Options': ['Map', 'what the map shows'], 'Text Display Options': ['Text', 'how messages and lists read'],
  'Game-Play Options': ['Play', 'habits while you play'], 'Disturbance Options': ['Interruptions', 'what stops you mid-stride'], 'Auto-Destroyer Options': ['Junk', 'what to destroy without asking'],
  'List Display Options': ['Lists', 'the creature and item lists'], 'Mogaminator Preferences': ['Pickup rules', 'what you take or leave'], 'Base Delay Factor': ['Animation speed', 'how long effects linger'],
  'Hitpoint Warning': ['Low life warning', 'when the game warns you'], 'Mana Color Threshold': ['Low mana warning', 'when the mana bar changes colour'], 'Autosave Options': ['Autosave', 'how often the game saves itself'],
  'Birth Options (Browse Only)': ['Starting rules', 'chosen at creation: view only'],
  'Artifacts': ['Artifacts', 'one-of-a-kind treasures you have found'], 'Objects': ['Items', 'every kind of item you know'], 'Egos': ['Enchanted kinds', 'special makes of weapon and armour'],
  'Auto Pick/Destroy': ['Pickup rules', 'what you take or destroy without asking'], 'Known Monsters': ['Bestiary', 'creatures you have met'], 'Wanted Monsters': ['Bounties', 'creatures with a price on their head'],
  'Remaining Uniques': ['Named foes', 'the ones still alive'], 'Kill Count': ['Kills', 'what you have slain'], 'Pets': ['Companions', 'who follows you'], 'Dungeons': ['Dungeons', 'how deep you have been'],
  'Quests': ['Quests', 'what you have been asked to do'], 'Terrain Symbols': ['Terrain', 'the kinds of ground and wall'], 'About Yourself': ['About you', 'your race, class and what you can do'],
  'Weapon Damage': ['Weapon damage', 'what your blows do'], 'Extra Info': ['Class notes', 'spells and talents of your calling'], 'High Score List': ['Hall of fame', 'characters past and present'],
  'Proficiency': ['Weapon skill', 'practice with each weapon'], 'Spell Proficiency': ['Spell skill', 'practice with each spell'],
  'Exit menu': ['Close'], 'Object Knowledge': ['Items'], 'Monster Knowledge': ['Creatures'], 'Dungeon Knowledge': ['The world'], 'Self Knowledge': ['Yourself'], 'Skills': ['Practice'] };
const menuWord = (r, x, e) => { const w = MENU_WORDS[r.s.slice(x, e).trim()]; return w ? `<span class="mw">${esc(w[0])}</span>${w[1] ? `<small class="mwd">${esc(w[1])}</small>` : ''}` : rowHtml(r.y, x, e); };
// two columns of choices under headings (the knowledge menu and its kind): headed groups of cards.
// Anything else on the lines (a description beside a choice, prose between them) keeps the text layout.
function menuSections(rows, b) {
  const isEsc = t => t.key === 'Esc';
  const note = MENU_NOTE;
  const items = rows.filter(r => r.toks.some(t => !isEsc(t)));
  if (items.length < 4 || items.length > 40) return '';
  const ats = []; items.forEach(r => r.toks.forEach(t => { if (!isEsc(t)) ats.push(t.at); }));
  const lo = Math.min(...ats), hi = Math.max(...ats); if (hi - lo < 12 || !ats.every(a => a - lo <= 3 || hi - a <= 3)) return '';
  const mid = (lo + hi) >> 1, firstItem = rows.indexOf(items[0]), lastItem = rows.indexOf(items[items.length - 1]);
  // text runs on a line that are not part of a choice
  const loose = r => { const out = [], re = /\S+(?: {1,2}\S+)*/g; let m; while ((m = re.exec(r.s))) { const x = m.index, e = x + m[0].length; if (x >= b.x0 && !r.toks.some(t => x < t.end && e > t.at)) out.push({ x, e }); } return out; };
  const first = rows.findIndex(r => r.s.trim()); let title = null;
  if (first < firstItem && !rows[first].toks.length && loose(rows[first]).length === 1) { const nx = rows.slice(first + 1).find(r => r.s.trim()); if (nx && !nx.toks.length) title = rows[first]; }
  const cols = [[], []]; let heads = 0;
  for (const r of rows.slice(title ? first + 1 : 0, lastItem + 1)) {
    const ls = loose(r);
    if (ls.some(l => l.e - l.x > 40)) return '';                       // prose: not a plain menu
    for (const l of ls) { const c = l.x < mid ? 0 : 1; if (r.toks.some(t => (t.at < mid ? 0 : 1) === c && !isEsc(t))) return ''; cols[c].push({ head: (MENU_WORDS[r.s.slice(l.x, l.e).trim()] || [])[0] ? esc(MENU_WORDS[r.s.slice(l.x, l.e).trim()][0]) : rowHtml(r.y, l.x, l.e), items: [] }); heads++; }
    for (const t of r.toks) { if (isEsc(t)) continue; const c = t.at < mid ? 0 : 1; if (!cols[c].length) cols[c].push({ head: '', items: [] }); cols[c][cols[c].length - 1].items.push({ r, t }); }
  }
  if (heads < 2) return '';
  const esc1 = rows.flatMap(r => r.toks.filter(isEsc).map(t => ({ r, t })));
  const foot = rows.slice(lastItem + 1).filter(r => r.s.trim() && !r.toks.length && !/:\s*_?\s*$/.test(r.s));
  const tw = title && MENU_TITLES[title.s.trim()];
  const card = ({ r, t }) => { const k = esc(t.key); return `<div class="mcard${note ? ' off' : ''}" data-key="${k}"><span class="key">${k === '_' ? '&#95;' : k}</span><span class="ml">${menuWord(r, t.at + t.len, t.end)}</span></div>`; };
  const sec = g => g.items.length ? `<div class="msec">${g.head ? `<div class="mhead">${g.head}</div>` : ''}<div class="mlist">${g.items.map(card).join('')}</div></div>` : '';
  return `<div class="pane npanel menup mcards msect${tw ? ' mjournal' : ''}">${title ? `<div class="mtitle ctitle">${tw ? `${esc(tw[0])}<small>${esc(tw[1])}</small>` : rowHtml(title.y, title.s.search(/\S/), b.x1 + 1)}</div>` : ''}
    ${menuNote()}
    <div class="mcols">${cols.map(c => `<div>${c.map(sec).join('')}</div>`).join('')}</div>
    ${foot.length || esc1.length ? `<div class="mfoot">${foot.map(r => rowHtml(r.y, r.s.search(/\S/), b.x1 + 1)).join('<br>')}${note ? '' : esc1.map(({ r, t }) => `<span class="row" data-key="Esc" style="cursor:pointer"><span class="key">Esc</span>${menuWord(r, t.at + t.len, t.end)}</span>`).join('')}</div>` : ''}</div>`;
}
