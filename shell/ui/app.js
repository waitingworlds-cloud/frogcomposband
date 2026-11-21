// FrogComposband interface. Talks to shell/server.js: /events (game to us), /in (keys to game).
'use strict';
const $ = s => document.querySelector(s);
const G = { w: 0, h: 0, s: [], a: [], cx: 0, cy: 0, cv: 0, icky: 0 };   // the game's text grid
let PAL = [], DICT = { r: [], f: [], k: [] }, S = null, built = false;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- layout scale: the design is 1080 units tall, any width ---------- */
let VH = 1080;
let SCALE = 1, VW = 1920;
function fit() {
  // fit 1080 units of height, unless the window is too narrow for the 1700-unit-wide layout: then fit the width and grow the map taller
  SCALE = Math.min(innerHeight / 1080, innerWidth / 1700); VW = innerWidth / SCALE; VH = innerHeight / SCALE;
  const st = $('#stage'); st.style.transform = `scale(${SCALE})`; st.style.width = VW + 'px'; st.style.height = VH + 'px';
  document.body.classList.toggle('narrow', VW < 1820);   // tight windows: the shortcut hints stack so the message log keeps its room
  draw();
}
addEventListener('resize', fit);

/* ---------- keys ---------- */
const KS = { ArrowLeft: 0xFF51, ArrowUp: 0xFF52, ArrowRight: 0xFF53, ArrowDown: 0xFF54, Home: 0xFF50, End: 0xFF57, PageUp: 0xFF55, PageDown: 0xFF56, Insert: 0xFF63,
  F1: 0xFFBE, F2: 0xFFBF, F3: 0xFFC0, F4: 0xFFC1, F5: 0xFFC2, F6: 0xFFC3, F7: 0xFFC4, F8: 0xFFC5, F9: 0xFFC6, F10: 0xFFC7, F11: 0xFFC8, F12: 0xFFC9 };
const KP = { Numpad0: 0xFFB0, Numpad1: 0xFFB1, Numpad2: 0xFFB2, Numpad3: 0xFFB3, Numpad4: 0xFFB4, Numpad5: 0xFFB5, Numpad6: 0xFFB6, Numpad7: 0xFFB7, Numpad8: 0xFFB8, Numpad9: 0xFFB9,
  NumpadEnter: 0xFF8D, NumpadAdd: 0xFFAB, NumpadSubtract: 0xFFAD, NumpadMultiply: 0xFFAA, NumpadDivide: 0xFFAF, NumpadDecimal: 0xFFAE };
const hex = bytes => bytes.map(b => (b & 255).toString(16).padStart(2, '0')).join('');
let sendQ = Promise.resolve();
function sendRaw(line) {
  // a walk of more than a step goes through the game's travel, which will not go in the dark: remember it, so it can be walked another way
  const mv = /^M ([13]) (-?\d+) (-?\d+)$/.exec(line); if (mv && S && S.p && (mv[1] === '3' || Math.max(Math.abs(+mv[2]), Math.abs(+mv[3])) > 1)) TRAVEL = { x: S.px + +mv[2], y: S.py + +mv[3], t: Date.now() };
  sendQ = sendQ.then(() => fetch('/in', { method: 'POST', body: line }).catch(() => {}));
}
let TRAVEL = null;
// after each turn: the travel just asked for was refused ("You cannot see!" with no light, "No route is found!"), so walk it a step at a time over what you have seen
function travelRetry() {
  if (!TRAVEL || !S || !S.p) return; if (Date.now() - TRAVEL.t > 2500) { TRAVEL = null; return; }
  if (!/You cannot see!|No route is found/.test(msgTop())) return;
  const t = TRAVEL; TRAVEL = null; if (typeof EXP !== 'undefined' && EXP.on) return;
  setTimeout(() => { if (playing() && !(typeof EXP !== 'undefined' && EXP.on) && !exploreGoto(t.x - S.px, t.y - S.py)) postToast('No way there that you know'); }, 60);
}
// the spell last picked from the spell list, so aiming it can show how wide it bursts
let CAST = { n: '', t: 0 };
function sendBytes(bytes) {
  if (bytes.length === 1 && typeof UI !== 'undefined' && UI && UI.kind === 'spells' && typeof uiOnTop === 'function' && uiOnTop()) { const r = UI.rows.find(r => r.k === String.fromCharCode(bytes[0])); if (r) CAST = { n: r.n, t: Date.now() }; }
  if (typeof hbNote === 'function') hbNote(bytes);
  if (bytes.length) sendRaw('X ' + hex(bytes));
}
function sendText(str) { sendBytes([...str].map(c => c.charCodeAt(0))); }
function trigger(ks, e) {
  const m = (e.ctrlKey ? 'N' : '') + (e.shiftKey ? 'S' : '') + (e.altKey ? 'O' : '');
  sendText(String.fromCharCode(31) + m + '_' + ks.toString(16).toUpperCase() + '\r');
}
let GAMEOVER = false, GONE = false;
function playAgain() { if (!GAMEOVER) return; GAMEOVER = false; GONE = false; G.w = 0; $('#app').innerHTML = '<div id="wait">Waking the dungeon…</div>'; sendRaw('N'); }
function leaveGame() { sendRaw('E'); try { window.close(); } catch (e) {} }
document.addEventListener('click', e => { if (e.target.closest('#again')) playAgain(); else if (e.target.closest('#leave')) leaveGame(); });
addEventListener('keydown', e => {
  if (GAMEOVER) { if (e.key === 'Enter') playAgain(); else if (e.key === 'Escape') leaveGame(); e.preventDefault(); return; }
  if (askKey(e) || spbKey(e) || shopKey(e) || itemsKey(e) || hotbarKey(e) || ambKey(e) || gmenuKey(e) || controlsKey(e) || ctxKey(e) || postKey(e) || sndKey(e) || exploreKey(e)) { e.preventDefault(); return; }
  if (e.key === 'F11' || e.key === 'F12' || (e.ctrlKey && /^[-+=0]$/.test(e.key))) return;   // window keys stay with the window
  if (e.metaKey) return;
  let handled = true;
  if (KP[e.code] && !(e.code === 'NumpadEnter' && false)) trigger(KP[e.code], e);
  else if (KS[e.key]) trigger(KS[e.key], e);
  else if (e.key === 'Escape') sendBytes([27]);
  else if (e.key === 'Enter') sendBytes([13]);
  else if (e.key === 'Tab') sendBytes([9]);
  else if (e.key === 'Backspace') sendBytes([8]);
  else if (e.key === 'Delete') sendBytes([0x7f]);
  else if (e.key.length === 1) {
    let c = e.key.charCodeAt(0);
    if (c > 255) handled = false;
    else if (e.ctrlKey && /[a-zA-Z\[\]\\^_@]/.test(e.key)) sendBytes([c & 0x1f]);
    else if (e.altKey) sendBytes([27, c]);
    else sendBytes([c]);
  } else handled = false;
  if (handled) e.preventDefault();
});

/* ---------- messages from the game ---------- */
// item descriptions are kept until the turn or what you carry, wear or stand by changes: clearing them on every
// redraw made a hovered item's card blink between its short tip and its full description
let DESC_SIG = '', DESC_SHOP = '';
const descSig = m => [m.px, m.py, m.gx, m.gy, m.p && [m.p.day, m.p.hour, m.p.min, m.p.au, m.p.lev, m.p.stats].join(), (m.msgs || []).slice(-1).map(x => x.turn + x.s).join(), (m.pack || []).map(o => o && o.n).join('|'), (m.equip || []).map(o => o && o.n).join('|'), (m.floor || []).map(o => o && o.n + o.dx + ',' + o.dy).join('|'), (m.mons || []).map(o => o.r + ':' + o.hp).join('|')].join('#');
// a screen keeps the largest size it has had while it stays open, so new text inside it (a longer list, a
// note, a prompt) never makes the whole panel jump or shrink under the pointer
let PHOLD = null;
function panelHold(root) {
  const p = root && root.querySelector('.npanel'); if (!p) { PHOLD = null; return; }
  const ttl = p.querySelector('.tabs .on, .mtitle, .dhead'), id = p.className.replace(/\bnaming\b/, '').trim() + '|' + (ttl ? ttl.textContent.trim() : '');
  if (!PHOLD || PHOLD.id !== id) PHOLD = { id, w: 0, h: 0 };
  p.style.minWidth = p.style.minHeight = '';
  const cs = getComputedStyle(p), r = p.getBoundingClientRect(), padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth), padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
  const w = r.width / SCALE - (cs.boxSizing === 'border-box' ? 0 : padX), h = r.height / SCALE - (cs.boxSizing === 'border-box' ? 0 : padY);
  PHOLD.w = Math.max(PHOLD.w, w); PHOLD.h = Math.max(PHOLD.h, h);
  p.style.minWidth = PHOLD.w + 'px'; p.style.minHeight = PHOLD.h + 'px';
}
function onMsg(m) {
  if (m.t === 'hello') { PAL = m.pal; }
  else if (m.t === 'dict') { DICT = m; }
  else if (m.t === 'f') {
    if (m.w !== G.w || m.h !== G.h) { G.w = m.w; G.h = m.h; G.s = Array(m.h).fill(' '.repeat(m.w)); G.a = Array(m.h).fill(null).map(() => new Uint8Array(m.w)); }
    for (const r of m.rows) { G.s[r.y] = r.s; const a = G.a[r.y]; for (let x = 0; x < m.w; x++) a[x] = parseInt(r.a.substr(x * 2, 2), 16); }
    G.cx = m.cx; G.cy = m.cy; G.cv = m.cv; G.lk = m.lk || null; G.gf = m.gf || null; G.icky = m.icky; G.ov = m.ov;
    if (!ftimer) ftimer = setTimeout(() => { ftimer = 0; schedule(); }, 22);
    ctxOnFrame();
  }
  else if (m.t === 's') { { const sg = descSig(m); if (sg !== DESC_SIG) { DESC_SIG = sg; DESC = {}; DESC_ASKED = {}; } } if (!m.map && S && S.map) { m.map = S.map; m.stale = 1; } fxOnState(S, m); if (typeof lvlOnState === 'function') lvlOnState(S, m); if (!S && m.map) { let seen = 1; try { seen = localStorage.getItem('ctl.seen'); localStorage.setItem('ctl.seen', '1'); } catch (x) {} } S = m; if (S.map && !S.stale && S.p && typeof exploreRemember === 'function') exploreRemember(); BASE = { s: G.s.slice(), a: G.a.map(r => r.slice()) }; clearTimeout(ftimer); ftimer = 0; schedule(); if (typeof tipRefresh === 'function') tipRefresh(); travelRetry(); if (typeof toastPlace === 'function') toastPlace(); if (typeof hbOnState === 'function') hbOnState(); }
  else if (m.t === 'ui') {
    if (m.kind === 'shop' || m.kind === 'home') { const sg = JSON.stringify(m.rows || m.items || m); if (sg !== DESC_SHOP) { DESC_SHOP = sg; for (const k in DESC) if (/^[sh]:/.test(k)) { delete DESC[k]; delete DESC_ASKED[k]; } } }
    if (m.kind) { if (UI && (UI.kind === 'shop' || UI.kind === 'home') && m.kind !== UI.kind) UIback = UI; UI = m; }
    else { UI = m.all ? null : UIback; UIback = null; }
    uiSel = ''; schedule(); ctxOnUi(m); if (typeof spbOnUi === 'function') spbOnUi(m);
  }
  else if (m.t === 'snd') sndEvent(m.v);
  else if (m.t === 'desc') descIn(m);
  else if (m.t === 'uisel') { uiSel = m.name; schedule(); }
  else if (m.t === 'bye') {
    if (GONE) return; GONE = true;   // the game and the server may both say goodbye
    built = false; S = null; UI = null; UIback = null; $('#term').classList.remove('on'); const nat = $('#native'); nat.classList.remove('on'); setHtml(nat, '');
    if (DIED) {   // a death: say farewell, and offer a new character without closing the program
      sendRaw('K'); const d = DIED; DIED = null;
      $('#app').innerHTML = `<div class="tscr over"><div class="tglow"></div><div class="tver">the tale of</div><h1>${esc(d.name)}</h1><div class="tver">${esc([d.title, d.cls].filter(Boolean).join(' · '))}${d.by && !/^quitting$/i.test(d.by) ? ' · slain by ' + esc(d.by) : ''}</div>
        ${d.lev || d.where ? `<div class="tver" style="font-size:.78em;opacity:.7;margin-top:2px">${esc([d.lev ? 'character level ' + d.lev : '', /^Level 0$/i.test(d.where) ? 'in the town' : d.where ? d.where.toLowerCase().replace(/^level/, 'dungeon level') : '', d.au ? d.au + ' gold' : ''].filter(Boolean).join(' · '))}</div>` : ''}
        <div class="tbtns"><span class="tbtn main" id="again"><span class="key">Enter</span>New character</span><span class="tbtn" id="leave"><span class="key">Esc</span>Quit</span></div></div>`;
      GAMEOVER = true;
    } else { sendRaw('E'); $('#app').innerHTML = '<div id="wait">The game has closed. You can close this window.</div>'; }
  }
}
let pend = false, ftimer = 0, BASE = null;
const setHtml = (el, h) => { if (el && el._h !== h) { el._h = h; el.innerHTML = h; return true; } return false; };
function schedule() { if (!pend) { pend = true; requestAnimationFrame(() => { pend = false; draw(); }); } }

/* ---------- helpers over the text grid ---------- */
const CCH = 'dwsorgbuDWvyRGBULPICtSmMTOVcnKpi';
// the game's own colour tags inside a message
const plain = s => String(s).replace(/<[^<>]*>/g, '');
function rich(str) {
  let out = '', open = 0;
  String(str).split(/(<[^<>]*>)/).forEach(t => {
    const m = /^<color:([^>]+)>$/.exec(t);
    if (m) { const i = m[1].length === 1 ? CCH.indexOf(m[1]) : m[1] === 'keypress' ? 3 : 1; out += (open ? '</span>' : '') + `<span style="color:${readable(col(i < 0 ? 1 : i))}">`; open = 1; }
    else if (t === '</color>') { if (open) out += '</span>'; open = 0; }
    else if (/^<\/?(style|indent|tab|topic|link|var)[^>]*>$/.test(t)) return;
    else out += esc(t);
  });
  return out + (open ? '</span>' : '');
}
// dark blues and greys from the game's palette are hard to read on our dark panels: lift them
const rdc = {};
function readable(c) {
  if (rdc[c]) return rdc[c];
  const m = /^#(..)(..)(..)$/.exec(c); if (!m) return c;
  let [r, g, b] = m.slice(1).map(h => parseInt(h, 16)); const l = .3 * r + .59 * g + .11 * b;
  if (l < 105) { const k = (105 - l); r = Math.min(255, r + k * 1.1); g = Math.min(255, g + k * 1.1); b = Math.min(255, b + k * 1.3); }
  return rdc[c] = `rgb(${r | 0},${g | 0},${b | 0})`;
}
// live text on the game's message line (prompts, -more-), as coloured runs
// the whole message area as one line of text (a long message wraps onto the rows below the top one)
function msgTop() { const r = (S && S.rmsg) || [0, 0, 0, 1]; return G.s.slice(r[1], r[1] + Math.max(1, Math.min(8, r[3]))).map(l => r[2] ? (l || '').substr(r[0], r[2]) : l).join(' ').replace(/\x01/g, ' ').replace(/\s+/g, ' ').trim(); }
function liveHtml() {
  const r = S.rmsg; let out = '', any = false;
  for (let y = r[1]; y < r[1] + r[3] && y < G.h; y++) {
    const s = (G.s[y] || ''), a = G.a[y], w = y === 0 ? Math.min(G.w, S.rchar[0] + (y ? 0 : 99)) : r[0] + r[2];
    let line = '', cur = -1, txt = '';
    const flush = () => { if (txt) line += `<span style="color:${readable(col(cur))}">${esc(txt)}</span>`; txt = ''; };
    const end = s.slice(r[0], w).replace(/\s+$/, '').length + r[0];
    for (let x = r[0]; x < end; x++) { const ch = s[x] === '\x01' ? ' ' : s[x]; if (ch !== ' ' && a[x] !== cur) { flush(); cur = a[x]; } txt += ch; }
    flush();
    if (line) { out += (any ? ' ' : '') + line; any = true; }
  }
  return lookKeys(out) + qtyKeys();
}
// "Quantity (1-7):" gets buttons for one, half and all; each clears what was typed and answers
function qtyKeys() {
  const top = (G.s[0] || '').replace(/\x01/g, ' ');
  // which way: the map answers it (click a square); the keys it names become buttons too
  if (/^Direction\b.*\?/.test(top.trim()) && /'\*'|'5'|Escape/.test(top)) {
    const b = [];
    if (/'5'|'t'/.test(top)) b.push([/'5'/.test(top) ? '5' : 't', 'at your target']);
    if (/'\*'/.test(top)) b.push(['*', 'pick a target']);
    if (/'''/.test(top)) b.push(["'", 'nearest']);
    return '<span class="lkeys">' + b.map(([k, w]) => `<span class="lk" data-key="${esc(k)}"><span class="key">${esc(k)}</span>${w}</span>`).join('') + '<span class="lk" data-key="Esc"><span class="key">Esc</span>cancel</span><span class="lk dirk" style="opacity:.75"><i>or click where to aim</i></span></span>';
  }
  // resting: the usual answers as buttons
  if (/^Rest \(0-\d+, '\*' for HP\/SP, '&' as needed\)/.test(top)) return '<span class="lkeys">' + [['&', 'as needed'], ['*', 'until healed'], ['50', '50 turns']].map(([n, w]) => `<span class="lk" data-qty="${n}"><span class="key">${n}</span>${w}</span>`).join('') + '<span class="lk" data-key="Esc"><span class="key">Esc</span>cancel</span></span>';
  const m = /Quantity \((\d+)(?:-| to )(\d+)\)/.exec(top); if (!m) return '';
  const lo = +m[1], hi = +m[2], opts = [[lo, 'one'], [Math.max(lo, Math.floor(hi / 2)), 'half'], [hi, 'all']].filter((o, i, a) => a.findIndex(p => p[0] === o[0]) === i);
  return '<span class="lkeys">' + opts.map(([n, w]) => `<span class="lk" data-qty="${n}"><span class="key">${n}</span>${w}</span>`).join('') + '<span class="lk" data-key="\r"><span class="key">Enter</span>ok</span><span class="lk" data-key="Esc"><span class="key">Esc</span>cancel</span></span>';
}
// the look and target prompts end in a bare key list, [r,x,q,p,o,j,+,-,?,<dir>]: give each key a cap and a word, and make it a button
const LOOK_WORDS = { r: 'recall', x: 'items here', q: 'done', t: 'target', p: 'you', o: 'free look', m: 'creatures', j: 'travel here', '(': 'travel here', '+': 'next', '-': 'previous', '?': 'help' };
function lookKeys(h) {
  h = h.replace(/-more-/, '<span class="lk more" data-key=" "><span class="key">Space</span>more</span>');
  h = h.replace(/Press (<\/span><span[^>]*>)?Space ?(<\/span><span[^>]*>)?to continue\.?(<\/span>)?/, m => (m.endsWith('</span>') ? '</span>' : '') + '<span class="lk more" data-key=" "><span class="key">Space</span>continue</span>');
  // a yes or no question still waiting (no answer after it yet) gets two buttons
  if (/\[y\/n\]\s*(<\/span>)?\s*$/.test(h)) h += '<span class="lkeys"><span class="lk" data-key="y"><span class="key">y</span>yes</span><span class="lk" data-key="n"><span class="key">n</span>no</span></span>';
  return h.replace(/\[((?:[a-z?+\-(]|&lt;dir&gt;)(?:,(?:[a-z?+\-(]|&lt;dir&gt;))+)\]/, (all, list) => {
    const ks = [...new Set(list.split(','))]; if (!ks.includes('q') && !ks.includes('r')) return all;
    return '<span class="lkeys">' + ks.map(k => k === '&lt;dir&gt;' ? '<span class="lk dirk"><span class="key">⇆</span>move</span>' : `<span class="lk" data-key="${k}"><span class="key">${k === 'q' ? 'Esc' : k}</span>${LOOK_WORDS[k] || ''}</span>`).join('') + '</span>';
  });
}
let lookTimer = 0;
function fxKickLook() { if (!lookTimer) lookTimer = setTimeout(() => { lookTimer = 0; if (lookMode()) drawMap(); }, 50); }
const col = a => PAL[a & 31] || '#fff';
function rectText(r) {   // r = [x,y,w,h]; rows of {text, attr of first ink}
  const out = [];
  for (let y = r[1]; y < r[1] + r[3] && y < G.h; y++) {
    const s = (G.s[y] || '').substr(r[0], r[2]); const t = s.trim();
    if (!t) { out.push(null); continue; }
    const i = s.search(/\S/); out.push({ text: t, a: G.a[y][r[0] + i], y });
  }
  return out;
}
const DIRS = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
function dirOf(dx, dy) { if (!dx && !dy) return 'here'; const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)); return DIRS[(a + 8) % 8] + ' ' + Math.max(Math.abs(dx), Math.abs(dy)); }
function tvIcon(tv) {
  if (tv >= 90 && tv <= 109) return 'book';
  if (tv === 75 || tv === 77 || tv === 2) return 'potion';
  if (tv === 70 || tv === 69 || tv === 50) return 'scroll';
  if (tv === 55 || tv === 65 || tv === 66) return 'wand';
  if (tv === 80) return 'food'; if (tv === 127) return 'gold'; if (tv === 39) return 'torch';
  if (tv === 45) return 'ring'; if (tv === 40) return 'amulet'; if (tv === 35) return 'cloak';
  if (tv === 36 || tv === 37 || tv === 38) return 'armor'; if (tv === 34) return 'shield';
  if (tv === 32 || tv === 33) return 'helm'; if (tv === 30) return 'boots'; if (tv === 31) return 'gloves';
  if (tv === 19) return 'bow'; if (tv === 46 || (tv >= 16 && tv <= 18)) return 'quiver';
  if (tv === 23) return 'sword'; if (tv === 21 || tv === 22 || tv === 20) return 'dagger';
  return 'scroll';
}
const SLOT_ICON = { 1: 'gloves', 2: 'sword', 3: 'ring', 4: 'bow', 5: 'amulet', 6: 'torch', 7: 'armor', 8: 'cloak', 9: 'boots', 10: 'helm', 11: 'ring', 12: 'sword', 13: 'potion', 14: 'quiver' };
const oq = o => o ? (o.art || o.ego ? 'ego' : o.unk ? 'unknown' : '') : '';
const card = (title, body, cls = '', extra = '') => `<div class="card ch ${cls}"><div class="in ch">${title ? `<h3>${title}${extra ? `<em>${extra}</em>` : ''}</h3>` : ''}${body}</div></div>`;
// life and mana bars: when the value drops, a pale slice lingers and drains away; when it rises, the bar grows into place
const VBAR = {};
const vb = (cls, lab, v, m) => {
  const pct = m > 0 ? Math.max(0, Math.min(100, v / m * 100)) : 0, r = VBAR[cls] || (VBAR[cls] = { cur: pct, from: pct, t: 0 });
  if (pct !== r.cur) { r.from = r.cur; r.cur = pct; r.t = performance.now(); }
  const el = performance.now() - r.t, live = el < 1100 && r.from !== pct, d = `animation-delay:${Math.round((r.from > pct ? 260 : 0) - el)}ms`;
  const ghost = live && r.from > pct ? `<b style="--from:${r.from}%;--to:${pct}%;${d}"></b>` : '';
  const grow = live && r.from < pct ? ` class="grow" style="width:${pct}%;--from:${r.from}%;--to:${pct}%;${d}"` : ` style="width:${pct}%"`;
  return `<div class="vb ch ${cls}"><div class="tr ch">${ghost}<i${grow}></i><u></u></div><span class="l">${lab}</span><span class="v">${v}<small>/ ${m}</small></span></div>`;
};
const hpc = h => h > 75 ? 'ok' : h > 45 ? 'mid' : '';

/* ---------- the main screen ---------- */
// paper doll: where each kind of slot sits (x, y in a 272 x 452 box); several entries = several slots of that kind
const DOLLPOS = { 10: [[113, 6]], 8: [[44, 80]], 5: [[182, 80]], 7: [[113, 144]], 2: [[0, 208], [226, 208]], 12: [[0, 208], [226, 208]], 1: [[52, 294]], 6: [[174, 294]],
  3: [[0, 358], [226, 358]], 9: [[113, 404]], 4: [[0, 404]], 14: [[226, 404]], 11: [[113, 294], [113, 230]], 13: [[113, 294]] };
const FIG = `<svg class="fig" viewBox="0 0 200 392"><g fill="#2c2f34" opacity=".55"><circle cx="100" cy="46" r="26"/><path d="M88 70h24v14q34 4 44 22l12 150h-22l-8-104v68l6 164h-34l-10-140-10 140H56l6-164v-68l-8 104H32L44 106q10-18 44-22z"/></g></svg>`;
function dollHtml() {
  const used = {}, extra = [];
  let h = '';
  for (const e of S.equip) {
    const list = DOLLPOS[e.type] || [], n = used[e.type] = (used[e.type] || 0) + 1, p = list[n - 1];
    const ic = e.o ? tvIcon(e.o.tv) : SLOT_ICON[e.type] || 'ring';
    const slot = (st) => `<div class="slot t-${ic} ${oq(e.o)} ${e.o ? '' : 'empty'}" style="${st}" data-tip="${esc(e.o ? e.o.n : e.slot + ': nothing')}"${e.o ? ` data-worn="${esc(e.k)}" data-desc="e:${esc(e.k)}"` : ''}>${(e.o && artHtml(e.o.ki, 38)) || icon(ic)}<span class="key" style="${p && p[0] > 136 ? 'right:auto;left:-6px' : ''}">${esc(e.k)}</span></div>`;
    if (p) h += slot(`left:${p[0]}px;top:${p[1]}px`); else extra.push(slot('position:relative;width:40px'));
  }
  return `<div class="doll dB" style="height:452px;flex:none">${FIG}${h}</div>` + (extra.length ? `<div class="row" style="gap:10px;flex-wrap:wrap;margin-top:8px">${extra.join('')}</div>` : '');
}
let lastEff = '';
let CAN_STUDY = false;   // the game says there is a spell to learn
function effectsHtml() {
  if (G.icky || G.ov) return lastEff || '<div class="sub" style="font-size:14px">nothing unusual</div>';
  const out = [];
  for (const r of rectText(S.reff)) if (r) out.push(r);
  // the status bar packs several short words into one line, each in its own colour
  const sb = S.rstatus, y = sb[1];
  if (y < G.h) {
    const s = (G.s[y] || '').substr(sb[0], sb[2]), a = G.a[y]; let cur = null;
    for (let x = 0; x <= s.length; x++) {
      const ch = s[x] || ' ', at = a[sb[0] + x];
      if (ch !== ' ' && cur && cur.a === at && x - cur.end <= 1) { cur.text += (x - cur.end ? ' ' : '') + ch; cur.end = x + 1; }
      else if (ch !== ' ') { cur = { text: ch, a: at, end: x + 1 }; out.push(cur); }
    }
  }
  // in the dungeon with a light in the pack but none in hand: say so, and a click wields one
  const noLight = S.p.dlvl > 0 && (S.equip || []).some(e => e.slot === 'Light' && !e.o) && S.pack.some(o => o.tv === 39);
  CAN_STUDY = out.some(e => /^Study/.test(e.text || ''));
  if (!out.length && !noLight) return lastEff = '<div class="sub" style="font-size:14px">nothing unusual</div>';
  return lastEff = `<div class="conds">${out.map(e => { const t = condTip(e.text), study = /^Study/.test(e.text); return `<div class="chip${study ? ' go' : ''}" style="color:${col(e.a)}"${t ? ` data-tip="${esc(t)}"` : ''}${study ? ' data-key="\\G"' : ''}>${esc(e.text)}</div>`; }).join('')}${noLight ? `<div class="chip go" style="color:#ffc46a" data-key="\\w" data-tip="You carry a light but are not holding one.&#10;click or press w: wield it">No light</div>` : ''}</div>`;
}
// what the common conditions mean, for their tooltips
const COND_TIPS = [[/^Study/, 'You can learn a new spell. The number is how many you may learn.\nclick or press G: study one'], [/^Fast|^Haste/, 'Hasted: you act more often than usual.'], [/^Slow/, 'Slowed: everything gets more turns than you.'],
  [/^Blind/, 'Blind: you cannot see, read scrolls or cast most spells.'], [/^Conf/, 'Confused: you stumble in random directions and cannot read.'], [/^Pois/, 'Poisoned: you lose life each turn until it wears off.'],
  [/^(Afraid|Scared|Fear|Terror|Panic)/, 'Afraid: you cannot attack in melee.'], [/^Paral/, 'Paralyzed: you cannot act.'], [/^Hungry/, 'Hungry: eat something soon (E).'], [/^Weak/, 'Weak from hunger: eat now (E) or you will faint.'],
  [/^(Faint|Starv)/, 'Starving: eat now (E)!'], [/^Full/, 'Well fed.'], [/^Gorged/, 'Gorged: you ate too much and are slowed.'], [/Stun|Knocked/, 'Stunned: you fight and cast worse. A heavy stun knocks you out.'],
  [/Cut|Graze|Wound|Gash|Bleed/, 'Bleeding: you lose life each turn until it closes.'], [/^Hallu|^Image/, 'Hallucinating: what you see cannot be trusted.'], [/^Hero/, 'Heroism: better to-hit and no fear.'],
  [/^Bers|^Shero/, 'Berserk: big to-hit bonus and no fear, but worse armour.'], [/^Bless/, 'Blessed: better armour and to-hit.'], [/^(Res|R)(Fire|Cold|Elec|Acid|Pois)|^Rfire|^Rcold/i, 'A temporary resistance.'],
  [/^S?Inv|^SeeInv/, 'You can see invisible things.'], [/^Lev|^Float/, 'Levitating: you float over traps and water.'], [/^Prot|^PrtEvl/, 'Protected from evil.'], [/^Recall|^Recl|^Deep/, 'Word of Recall is active: you will be pulled away soon.'],
  [/^D?Trap/i, 'Traps nearby have been detected.'], [/^Slp|^Sleep/, 'Asleep.']];
function condTip(t) { const m = COND_TIPS.find(([re]) => re.test(t)); return m ? m[1] : ''; }
const STAT_TIPS = ['Strength: melee damage, how much you can carry, digging.', 'Intelligence: spell power and mana for book learners, magic devices.', 'Wisdom: saving throws, and spell power and mana for priests.', 'Dexterity: blows per round, armour, keeping thieves off your pack.', 'Constitution: hit points and how fast you heal.', 'Charisma: shop prices, and power for some classes.'];
function leftHtml() {
  const p = S.p, st = ['str', 'int', 'wis', 'dex', 'con', 'chr'];
  return `<div class="rail l" style="grid-row:1/3;grid-column:1">
  <div class="who" data-key="${esc(cmd('C'))}" data-tip="Character level ${p.lev} ${esc(p.race)} ${esc(p.cls)}&#10;click or press C: character sheet" style="cursor:pointer"><div style="position:relative;width:86px"><div class="portrait ch"><div class="in ch"><canvas id="port"></canvas></div></div><div class="lvl"><b>${p.lev}</b></div></div>
    <div style="min-width:0"><div class="name nowrap" style="font-size:${p.name.length > 9 ? 28 : p.name.length > 6 ? 34 : 42}px">${esc(p.name)}</div><div class="sub" style="margin-top:5px;line-height:1.25">${esc(p.race)} ${esc(p.cls)}<br>${esc([p.realm, p.pers].filter(Boolean).join(' · '))}</div></div></div>
  <div data-tip="Life ${p.hp} of ${p.mhp}. At zero you die.&#10;Resting (R) brings it back.">${vb('hp', 'Life', p.hp, p.mhp)}</div>${p.msp > 0 ? `<div data-tip="Mana ${p.sp} of ${p.msp}, spent on spells.&#10;It comes back as you rest.">${vb('sp', 'Mana', p.sp, p.msp)}</div>` : ''}
  <div class="row" data-tip="Experience ${p.exp.toLocaleString()}. Level ${p.lev + 1} at ${p.expNext.toLocaleString()}." style="gap:10px;margin:1px 2px 0"><span class="lbl">level ${p.lev}</span><div class="xp grow"><i style="width:${Math.max(0, Math.min(100, p.exp / Math.max(1, p.expNext) * 100))}%"></i></div><span class="num" style="font-size:12px;color:#a39a8a">${Math.max(0, p.expNext - p.exp).toLocaleString()} to go</span></div>
  <div class="tiles">${[['armour', p.ac, '', 'Armour class. The higher it is, the less often blows land and the less they hurt.'], ['speed', (p.speed >= 0 ? '+' : '') + p.speed, p.speed > 0 ? 'color:#b9d6a0' : p.speed < 0 ? 'color:#ff7a66' : '', 'Speed. +10 is twice as many moves as a normal creature; below zero you are slowed.'], ['gold', p.au.toLocaleString(), 'color:#ffcf6a', 'Gold, for the shops in town.']].map(([a, b, c, tip]) => `<div class="tile ch" data-tip="${tip}"><div class="ch"><span class="num" style="${c}">${b}</span><span class="lbl">${a}</span></div></div>`).join('')}</div>
  ${card('Attributes', `<div class="stats">${p.stats.map((b, i) => `<div class="row" data-tip="${STAT_TIPS[i]}"><span class="lbl">${st[i]}</span><span class="num" style="font-size:15px">${esc(b.trim())}</span></div>`).join('')}</div>`)}
  ${card('Conditions', effectsHtml())}
  ${card('Worn', dollHtml() + `<div class="burden" data-tip="Carrying ${(p.wgt / 10).toFixed(1)} lb of ${(p.wlim / 10).toFixed(0)} lb.&#10;Past the limit you slow down."><span class="lbl">burden</span><div class="xp grow"><i style="width:${Math.min(100, p.wgt / Math.max(1, p.wlim) * 100)}%;background:linear-gradient(90deg,#4f7a3a,#a9c98c);box-shadow:none"></i></div><span class="num" style="font-size:12px;color:#a39a8a">${(p.wgt / 10).toFixed(1)} / ${(p.wlim / 10).toFixed(0)} lb</span></div>`, 'grow', `<span class="key" style="cursor:pointer" data-key="${esc(cmd('e'))}" data-tip="Everything you wear and wield&#10;click or press e">e</span>`)}</div>`;
}
function groupMons() {
  const g = [], by = {};
  for (const m of [...S.mons].sort((a, b) => a.dist - b.dist)) {
    const st = m.asleep ? 'asleep' : m.afraid ? 'afraid' : m.pet ? 'pet' : m.friendly ? 'friendly' : 'awake';
    const key = m.uniq || m.target ? 'u' + m.i : m.r + st + (m.hp < 100 ? m.i : '');
    if (by[key]) { by[key].cnt++; continue; }
    g.push(by[key] = { ...m, st, cnt: 1 });
  }
  return g;
}
// how hard a creature is next to you, from its depth and your level: nothing, tough, or deadly
function threat(m) { const lv = +((DICT.r[m.r] || [])[3] || 0), pl = S.p.lev || 1; return m.pet || m.friendly ? '' : lv >= pl * 1.5 + 6 ? 'deadly' : lv >= pl + 4 ? 'tough' : ''; }
const THREAT_TIP = { tough: 'Tougher than you are used to: level {L}.', deadly: 'Far beyond you: level {L}. Think twice.' };
function threatPip(m) { const t = threat(m); return t ? `<span class="thr ${t}" data-tip="${THREAT_TIP[t].replace('{L}', (DICT.r[m.r] || [])[3])}">${t === 'deadly' ? '☠' : '!'}</span>` : ''; }
function mobsHtml(g) {
  if (!g.length) return '<div class="sub" style="font-size:14.500px;padding:4px 2px">nothing in view</div>';
  return g.slice(0, 9).map(m => `<div data-at="${m.dx},${m.dy}" data-tip="click: make it your target · right-click: actions" class="mob ${m.uniq ? 'uniq' : ''} ${m.target ? 'tgt' : ''} ${m.los ? '' : 'far'}"><div class="g"><canvas class="mobc" data-r="${m.r}"></canvas></div>
  <div class="row" style="gap:8px;min-width:0"><span class="n nowrap">${threatPip(m)}${esc(cap(m.n.replace(/^(an?|the) /i, '')))}${m.cnt > 1 ? ` <b class="num" style="font-size:13px">×${m.cnt}</b>` : ''}</span><span class="st">${m.st}</span></div><div class="dir">${dirOf(m.dx, m.dy)}</div>
  <div class="hpb ${hpc(m.hp)}" style="grid-column:2/4"><i style="width:${m.hp}%"></i></div></div>`).join('') + (g.length > 9 ? `<div class="sub" style="font-size:14px;padding-top:4px">and ${g.length - 9} more · <span class="key">[</span> full list</div>` : '');
}
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
// Recall: the creature under the pointer (on the map or in the list above), else your target, else the nearest.
// It stays on the last one pointed at, so you can move over to read it.
let RC_HOVER = null; const LORE = {}, LORE_ASKED = {};
function recallSubject() {
  return (RC_HOVER != null && S.mons.find(m => m.i === RC_HOVER)) || S.mons.find(m => m.target) || [...S.mons].sort((a, b) => a.dist - b.dist)[0] || null;
}
function recallSet(m) { const i = m ? m.i : null; if (i == null || i === RC_HOVER) return; RC_HOVER = i; schedule(); }
function loreAsk(key) { const t = Date.now(); if (LORE_ASKED[key] && t - LORE_ASKED[key] < 4000) return; LORE_ASKED[key] = t; setTimeout(() => sendRaw('D ' + key.replace(':', ' ')), 0); }
function loreIn(m) { if (/^m:/.test(m.key)) { LORE[m.key] = { h: loreRows(m.rows), t: Date.now() }; if (S && S.mons.some(x => 'm:' + x.r === m.key)) schedule(); } }
// the game's recall page, its lines joined back into paragraphs to fit the side panel; "Label : value" lines stay lines
function loreRows(list) {
  const out = []; let para = null, grid = null;
  list.forEach((r, n) => {
    const s = r.s.replace(/\s+$/, ''); if (n === 0 && /^Name\s*:/.test(s)) return;
    if (!s.trim()) { para = null; grid = null; return; }
    const seg = (x0, x1) => { let h = '', cur = -1, txt = ''; const fl = () => { if (txt) h += cur === 1 || cur === 0 ? esc(txt) : `<span style="color:${readable(col(cur))}">${esc(txt)}</span>`; txt = ''; };
      for (let x = x0; x < x1; x++) { const a = parseInt(r.a.substr(x * 2, 2), 16); if (s[x] !== ' ' && a !== cur) { fl(); cur = a; } txt += s[x]; } fl(); return h.replace(/ {2,}/g, ' ').trim(); };
    if (/^[A-Z][A-Za-z ]{0,10}:\s/.test(s)) {   // "Level : 9    Speed: 1.0x": short facts, two to a row
      if (!grid) { grid = []; out.push(grid); } para = null;
      const re = /\S+(?: \S+)*(?: *: *\S+(?: \S+)*)?/g; let m; while ((m = re.exec(s))) grid.push(seg(m.index, m.index + m[0].length));
    } else { grid = null; const h = seg(0, s.length); if (para) para.h += ' ' + h; else { para = { h }; out.push(para); } }
  });
  return out.map(p => Array.isArray(p) ? `<div class="rcfs">${p.map(f => `<span>${f}</span>`).join('')}</div>` : `<p>${p.h}</p>`).join('');
}
function recallHtml() {
  if (!S.mons.length) return '';
  const m = recallSubject(); if (!m) return '';
  const r = DICT.r[m.r] || [], key = 'm:' + m.r, lore = LORE[key];
  if (!lore || Date.now() - lore.t > 20000) loreAsk(key);
  const th = threat(m);
  return card('<span data-tip="What you know of the creature you last pointed at (or your target)&#10;rest the pointer on a creature, on the map or in the list above">Recall</span>', `<div class="rc">
    <div class="rchd"><div class="rcart"><canvas class="mobc" data-r="${m.r}"></canvas></div>
    <div class="grow" style="min-width:0"><div class="rcn">${esc(cap(m.n.replace(/^(an?|the) /i, '')))}</div>
      <div class="st">${m.uniq ? 'unique · ' : ''}level ${r[3] ?? '?'}${th ? ` · <b style="color:${th === 'deadly' ? '#ff8a70' : '#ffc46a'}">${th}</b>` : ''}</div>
      <div class="st">${m.asleep ? 'asleep' : m.afraid ? 'afraid' : m.pet ? 'your pet' : m.friendly ? 'friendly' : 'awake'} · ${dirOf(m.dx, m.dy)}${m.target ? ' · <b style="color:var(--em3)">your target</b>' : ''}</div>
      <div class="row" style="gap:8px;margin-top:6px"><div class="hpb ${hpc(m.hp)} grow" style="height:8px"><i style="width:${m.hp}%"></i></div><span class="num" style="font-size:12px">${esc(m.health || '')}</span></div></div></div>
    <div class="rclore">${lore ? lore.h : '<p class="sub">recalling…</p>'}</div>
    <div class="row rckeys">${m.target ? '' : `<span class="row" style="gap:6px;cursor:pointer" data-tgt="${m.dx},${m.dy}"><span class="key">t</span>target it</span>`}<span class="row" style="gap:6px;cursor:pointer" data-key="${esc(cmd('l'))}"><span class="key">l</span>look around</span></div></div>`, 'rcard');
}
function targetHtml() {
  const m = S.mons.find(x => x.target); if (!m) return '';
  const r = DICT.r[m.r] || [];
  return card('Target', `<div class="row" style="gap:12px;align-items:flex-start" data-desc="m:${m.r}"><div class="big"><canvas class="mobc" data-r="${m.r}"></canvas></div>
  <div class="grow"><div style="font-weight:600;font-size:17px;color:var(--em3);line-height:1.15">${esc(cap(m.n.replace(/^(an?|the) /i, '')))}</div><div class="st">${m.uniq ? 'unique · ' : ''}level ${r[3] ?? '?'} · ${m.asleep ? 'asleep' : m.afraid ? 'afraid' : 'awake'}</div>
   <div class="row" style="gap:8px;margin-top:6px"><div class="hpb ${hpc(m.hp)} grow" style="height:8px"><i style="width:${m.hp}%"></i></div><span class="num" style="font-size:12px">${esc(m.health)}</span></div></div></div>
  <div class="row" style="gap:12px;margin-top:8px;font-size:14px;color:#b3ac9f"><span class="row" style="gap:6px"><span class="key">*</span>next</span><span class="row" style="gap:6px"><span class="key">l</span>look</span><span class="row" style="gap:6px"><span class="key">/</span>full lore</span><span style="margin-left:auto" class="dir">${dirOf(m.dx, m.dy)}</span></div>`, 'tgtcard');
}
function floorHtml() {
  const f = [...S.floor].sort((a, b) => Math.max(Math.abs(a.dx), Math.abs(a.dy)) - Math.max(Math.abs(b.dx), Math.abs(b.dy)));
  if (!f.length) return '<div class="sub" style="font-size:14.500px;padding:4px 2px">nothing known nearby</div>';
  return f.slice(0, 9).map(o => { const ic = tvIcon(o.tv); return `<div class="row" data-at="${o.dx},${o.dy}" data-n="${esc(o.n)}"${o.oi ? ` data-desc="o:${o.oi}"` : ''} data-tip="${o.dx || o.dy ? 'click: walk over and pick it up' : 'click: pick it up'} · right-click: actions" style="gap:10px;height:27px;cursor:pointer"><span class="t-${ic}" style="font-size:19px">${artHtml(o.ki, 24) || icon(ic)}</span><span class="grow nowrap">${esc(o.n)}</span><span class="dir">${dirOf(o.dx, o.dy)}</span></div>`; }).join('') + (f.length > 9 ? `<div class="sub" style="font-size:14px">and ${f.length - 9} more · <span class="key">]</span> full list</div>` : '');
}
function rightHtml() {
  const g = groupMons(), awake = S.mons.filter(m => !m.asleep).length;
  return `<div class="rail r" style="grid-row:1/3;grid-column:-2/-1">${card('<span data-tip="Creatures you can see, nearest first&#10;click one: target it · right-click: actions · rest the pointer: what you know">In sight</span>', mobsHtml(g), '', S.mons.length ? `${awake} awake` : '')}${recallHtml()}${card('<span data-tip="Items you can see on the ground&#10;click one: walk over and pick it up">On the floor</span>', floorHtml(), 'grow')}
  ${card('<span data-tip="The level around you&#10;click: travel there · M: the whole level">Area map</span>', `<div class="minibox"><canvas id="mini"></canvas></div>`, '', `<span class="xpl${typeof EXP !== 'undefined' && EXP.on ? ' on' : ''}" data-explore="1" data-tip="Explore: walk on until something turns up.&#10;${S.p.rl ? 'click' : 'click or press x'}; any key stops it">${S.p.rl ? '' : '<span class="key">x</span>'}explore</span><span class="key">M</span>`)}</div>`;
}
const ACTIONS = [['m', 'Cast', 'book'], ['f', 'Fire', 'sling'], ['q', 'Quaff', 'potion'], ['r', 'Read', 'scroll'], ['a', 'Aim', 'wand'], ['E', 'Eat', 'food'], ['R', 'Rest', 'cloak'], ['g', 'Pick up', 'gold']];
const RL_KEY = { f: 't', a: 'z' };   // the roguelike keys show their own letters; a click always sends the plain command
const ACT_TIPS = { m: 'Cast a spell from a book', f: 'Fire your launcher', q: 'Quaff a potion', r: 'Read a scroll', a: 'Aim a wand', E: 'Eat something', R: 'Rest until healed or disturbed', g: 'Pick up what you stand on' };
const HINTS = [['?', 'help'], ['C', 'character'], ['i', 'pack'], ['=', 'options'], ['M', 'map'], ['Esc', 'menu']];
function countTv(pred) { let n = 0; for (const o of S.pack) if (pred(o.tv)) n += o.num; return n; }
// the log keeps the game's questions with the key that answered them: say the answer in words, and drop the key lists
function logTidy(s) {
  return String(s).replace(/\s*(?:<color:\w>)*\*\*\* LOW HITPOINT WARNING! \*\*\*(?:<\/color>)*\s*Press (?:<color:\w>)?Space(?:<\/color>)? to continue\.(?:<\/color>)*(?:\s*(?:<color:\w>)*=>\s*(?:<color:\w>)?.?(?:<\/color>)?\.?(?:<\/color>)*)?/g, ' <color:v>Your life is low.</color>')
    .replace(/\s*(?:<color:\w>)?\[(?:y\/n(?:\/Auto)?|Y\/N|Y,n)\](?:<\/color>)?/g, '')
    .replace(/\s*=>\s*(?:<color:\w>)?(.)(?:<\/color>)?\./g, (m0, k) => ({ y: ' <color:y>Yes.</color>', Y: ' <color:y>Yes.</color>', n: ' <color:y>No.</color>', N: ' <color:y>No.</color>', A: ' <color:y>Always.</color>' })[k] || '');
}
function consoleHtml() {
  const cnt = { q: countTv(t => t === 75), r: countTv(t => t === 70), E: countTv(t => t === 80), a: countTv(t => t === 65 || t === 66 || t === 55) };
  const noBow = !(S.equip || []).some(e => e.slot === 'Shooting' && e.o); if (!noBow) { const n = countTv(t => t >= 16 && t <= 18); if (n) cnt.f = n; }   // ammunition in the pack shows on the Fire button (a worn quiver keeps its own, so none here is not 'none')
  const noFloor = !S.floor.some(o => !o.dx && !o.dy);   // nothing to fire with: say so on the button
  const msgs = S.msgs.filter(m => (String(m.s).match(/\n/g) || []).length < 3).slice(-8);   // a picture of the map kept in the log (after a death) is not a line to read
  const lastTurn = msgs.length ? msgs[msgs.length - 1].turn : 0;   // this turn's lines read bright, older ones step back
  const log = msgs.map(m => `<div style="color:${m.c && m.c !== 1 ? readable(col(m.c)) : ''}${m.turn !== lastTurn ? ';opacity:.58' : ''}">${rich(logTidy(m.s))}${m.n > 1 ? ` <span style="opacity:.6">(x${m.n})</span>` : ''}</div>`).join('');
  return `<div class="console"><div class="logbox ch" data-key="\x10" data-tip="Message history (Ctrl+P)"><div class="log ch">${log}</div></div>
  ${HB.mode === 'A' ? `<div class="hbcol">${hotbarHtml()}` : ''}<div class="belt ch"><div class="acts ch">${ACTIONS.map(([k, n, ic]) => `<div class="act${cnt[k] === 0 || (k === 'f' && noBow) || (k === 'g' && noFloor) ? ' none' : ''}" data-key="${S.p.rl ? esc(cmd(k)) : k}" data-tip="${ACT_TIPS[k]}${k === 'f' && noBow ? ' · you hold no launcher' : k === 'g' && noFloor ? ' · nothing here now' : cnt[k] != null ? (cnt[k] ? ` · ${cnt[k]} in your pack` : ' · none in your pack') : ''} · ${S.p.rl ? RL_KEY[k] || k : k}"><div class="slot t-${ic}">${icon(ic)}<span class="key">${S.p.rl ? RL_KEY[k] || k : k}</span>${cnt[k] ? `<span class="cnt">${cnt[k]}</span>` : ''}</div>${n}</div>`).join('')}</div></div>${HB.mode === 'A' ? '</div>' : ''}
  <div class="hints">${HINTS.map(([k, n]) => `<div class="row" ${k === 'Esc' ? 'data-gmenu="1" data-tip="The game menu: save, options, knowledge, quit"' : `data-key="${k}"`}${k === '?' ? ' data-tip="The game\'s own help.&#10;F1: what the mouse and the new keys do"' : ''}><span class="key">${k}</span>${n}</div>`).join('')}</div></div>`;
}
function plaqueHtml() {
  const p = S.p, t = `${p.hour}:${String(p.min).padStart(2, '0')}`;
  return `${esc(p.place)}${p.dlvl ? `<s></s><b>level ${p.dlvl}</b><s></s>${p.dlvl * 50} ft` : ''}<s></s>day ${p.day}, ${t}`;
}
const MC = ['tl', 'tr', 'bl', 'br'].map(p => `<svg class="mcorner ${p}" viewBox="0 0 54 54"><defs><linearGradient id="mc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8a8f96"/><stop offset=".5" stop-color="#3a3d42"/><stop offset="1" stop-color="#1a1c1f"/></linearGradient></defs>
  <path fill="url(#mc)" stroke="#000" d="M8 .5H53.500L47 14H22L14 22V47L.5 53.500V8z"/><path fill="none" stroke="#ff8a3c" stroke-opacity=".75" d="M43 9.500H20L9.500 20V43"/><path fill="#ff8a3c" stroke="#000" d="M14 9l5 5-5 5-5-5z"/></svg>`).join('');

function buildMain() {
  $('#app').innerHTML = `<div id="L" style="display:contents"></div><div class="mapwrap"><div class="plaque ch"><div class="ch" id="plaque"></div></div><div class="clip"><canvas id="map"></canvas></div><div id="banner"></div><div id="here"></div>${MC}<div id="hbplate"></div></div><div id="R" style="display:contents"></div><div id="C" style="display:contents"></div>`;
  built = true;
}
function drawMobCanvas(cv, rIdx, size) {
  const d = 2 * SCALE * (devicePixelRatio || 1); cv.width = cv.height = Math.round(size * d);
  const g = cv.getContext('2d'); g.scale(d, d); sprite.flat = true; drawToken(g, 0, 0, size, DICT.r[rIdx] || ['?', 63, 1, 0, 0]); sprite.flat = false;   // list icons stay one size
}
// a creature until real sprites exist: its letter on a dark disc, in the game's own colour
function drawToken(g, x, y, T, r, uniq) {
  if (sprite(g, 'mon', r[0], x, y, T)) return;
  const ch = String.fromCharCode(r[1]), c = col(r[2]);
  g.save(); g.translate(x, y);
  g.fillStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.ellipse(T / 2, T * .86, T * .3, T * .09, 0, 0, 7); g.fill();
  g.beginPath(); g.arc(T / 2, T / 2, T * .4, 0, 7); g.fillStyle = '#101214'; g.fill(); g.lineWidth = Math.max(1.500, T * .06); g.strokeStyle = (uniq ?? r[4]) ? '#ff8a3c' : c; g.globalAlpha = .9; g.stroke(); g.globalAlpha = 1;
  g.font = `700 ${Math.round(T * .56)}px Inter`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = c; g.fillText(ch, T / 2, T / 2 + T * .03);
  g.restore();
}

/* ---------- tileset (optional): shell/ui/tiles/atlas.json, see tiles/README.md ---------- */
let TS = null;
function loadTiles() {
  fetch('tiles/atlas.json').then(r => r.ok ? r.json() : null).then(j => {
    if (!j || !j.images || !j.images.length) return; let left = j.images.length; j.img = j.images.map(n => { const im = new Image(); im.onload = im.onerror = () => { if (--left === 0) { TS = j; fclassClear(); schedule(); } }; im.src = 'tiles/' + n; return im; });
  }).catch(() => {});
}
const tkey = s => String(s || '').toLowerCase().replace(/[&~#]/g, '').replace(/\s+/g, ' ').trim().replace(/^(an?|the) /, '');
// magic and missiles in flight: the game shows them as * | - / \ in a colour; here they are bolts and bursts of light
function drawSpell(g, x, y, T, ch, c) {
  const dir = { '|': [0, 1], '-': [1, 0], '/': [1, -1], '\\': [1, 1] }[ch], cx = x + T / 2, cy = y + T / 2;
  if (!dir && ch !== '*') return false;
  g.save(); g.globalCompositeOperation = 'lighter';
  const halo = g.createRadialGradient(cx, cy, 0, cx, cy, T * (dir ? .8 : .95)); halo.addColorStop(0, c); halo.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalAlpha = dir ? .5 : .75; g.fillStyle = halo; g.fillRect(x - T, y - T, T * 3, T * 3); g.globalAlpha = 1;
  if (dir) { const n = Math.hypot(dir[0], dir[1]), ux = dir[0] / n * T * .62, uy = dir[1] / n * T * .62; g.lineCap = 'round';
    g.strokeStyle = c; g.lineWidth = T * .26; g.beginPath(); g.moveTo(cx - ux, cy - uy); g.lineTo(cx + ux, cy + uy); g.stroke();
    g.strokeStyle = '#fff'; g.lineWidth = T * .09; g.beginPath(); g.moveTo(cx - ux * .8, cy - uy * .8); g.lineTo(cx + ux * .8, cy + uy * .8); g.stroke(); }
  else { g.fillStyle = c; g.beginPath(); g.arc(cx, cy, T * .3, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(cx, cy, T * .15, 0, 7); g.fill();
    for (let i = 0; i < 5; i++) { const a = rnd(x + i * 7, y) * 6.283, r = T * (.32 + rnd(y, x + i) * .3); g.fillStyle = i % 2 ? '#fff' : c; g.fillRect(cx + Math.cos(a) * r - 1.5, cy + Math.sin(a) * r - 1.5, 3, 3); } }
  g.restore(); return true;
}
// a hurt creature blinks white in its own shape
let flashCv = null;
function spriteFlash(g, r, x, y, T, k) {
  if (!r || !TS || !TS.mon || !TS.mon[tkey(r[0])]) return false;
  const pad = T, n = Math.ceil(T * 3); if (!flashCv) flashCv = document.createElement('canvas'); if (flashCv.width !== n) flashCv.width = flashCv.height = n;
  const f = flashCv.getContext('2d'); f.globalCompositeOperation = 'source-over'; f.clearRect(0, 0, n, n); sprite(f, 'mon', r[0], pad, pad * 1.6, T);
  f.globalCompositeOperation = 'source-in'; f.fillStyle = '#fff'; f.fillRect(0, 0, n, n);
  g.globalAlpha = Math.min(1, k * 1.1); g.drawImage(flashCv, x - pad, y - pad * 1.6); g.globalAlpha = 1; return true;
}
// how much bigger or smaller a creature is drawn than one square, by the size class the tileset gives it
const SIZE_MUL = { tiny: .8, medium: 1, large: 1.2, huge: 1.5 };
// draw a named sprite into a T-sized square; false when the set has none
function sprite(g, kind, name, x, y, T, alt) {
  if (!TS || !TS[kind]) return false;
  const e = TS[kind][tkey(name)] || (alt && TS[kind][alt]); if (!e) return false;
  const im = TS.img[e[0]], t = TS.tile; if (!im || !im.naturalWidth) return false;
  const sz = kind === 'mon' && TS.size && !sprite.flat ? TS.size[tkey(name)] : 0, mul = typeof sz === 'number' && sz > 0 ? sz : SIZE_MUL[sz] || 1;
  const w = (e[3] || 1) * t, h = (e[4] || 1) * t, k = T / t * mul;   // sprites may be taller or wider than one square; they stand on the bottom middle
  g.drawImage(im, e[1] * t, e[2] * t, w, h, x + (T - w * k) / 2, y + T - h * k, w * k, h * k); return true;
}
// the art for an item kind. Flavoured kinds (potions, scrolls, rings...) get their looks shuffled each game,
// so they use the art of the kind whose look they have now: the picture never gives away what an unknown item is.
function objArt(ki) { const k = DICT && DICT.k[ki]; if (!k) return ''; const f = k[5]; return f && DICT.k[f] ? DICT.k[f][0] : k[0]; }
// a slot picture as HTML (a piece of the sheet as a background), or '' when the set has no art for it
function artHtml(ki, S) {
  if (!TS || !TS.obj || ki == null) return ''; const e = TS.obj[tkey(objArt(ki))]; if (!e) return '';
  const im = TS.img[e[0]]; if (!im || !im.naturalWidth) return ''; const t = TS.tile, k = S / t;
  return `<i class="oart" style="width:${S}px;height:${S}px;background:url('tiles/${TS.images[e[0]]}') -${e[1] * t * k}px -${e[2] * t * k}px / ${im.naturalWidth * k}px ${im.naturalHeight * k}px no-repeat"></i>`;
}
function fclassClear() { for (const k in fclass) delete fclass[k]; }

/* ---------- map ---------- */
const TH = { void: '#040506', wallTop: '#4a4f56', wallTopDim: '#2e3237', wallFace: '#2a2e33', wallFaceDim: '#1b1e22', mortar: '#0b0c0e', floorA: '#6c6a66', floorB: '#666460', floorDim: '#3d3e40',
  floorLine: '#585754', floorLineDim: '#323335', door: '#8a5a2c', doorDark: '#2c1c0c', stair: '#cfc8ba', accent: '#ffb070', danger: '#ff5a3c' };
const fclass = {};
function featClass(f) {
  if (fclass[f]) return fclass[f];
  const n = ((DICT.f[f] || [''])[0] || '').toLowerCase(), ch = String.fromCharCode((DICT.f[f] || [0, 46])[1]);
  let c = 'other';
  if (/door|curtain|gate of/.test(n)) c = /open|broken/.test(n) ? 'dooropen' : /secret/.test(n) ? 'wall' : 'door';
  else if (/tree/.test(n)) c = 'tree';
  else if (/wall|granite|permanent|vein|mountain|glacier|slope/.test(n) && ch !== '.') c = 'wall';
  else if (/up stair|shaft up|way up/.test(n) || ch === '<') c = 'up';
  else if (/down stair|shaft down|way down|entrance|town exit/.test(n) || ch === '>') c = 'down';
  else if (/^[0-9"M]$/.test(ch) || /^building$/.test(n)) c = 'shop';
  else if (/rubble/.test(n)) c = 'rubble';
  else if (/lava/.test(n)) c = 'lava';
  else if (/water|river|sea|swamp|slush/.test(n)) c = 'water';
  else if (/dark pit|crevasse/.test(n)) c = 'pit';
  else if (ch === '^' || /trap|rune|discolored|alarm|semicolon/.test(n)) c = 'trap';
  else if (/grass|flower|brake/.test(n)) c = 'grass';
  else if (/snow|ice/.test(n)) c = 'snow';
  else if (/floor|road|path|dirt|sand/.test(n) || ch === '.') c = 'floor';
  return fclass[f] = c;
}
// the way a click would walk you: shortest path over squares you know, round walls and chasms
const NOWALK = { wall: 1, rubble: 1, pit: 1, lava: 1 };
let pathMemo = { k: '', p: null };
function walkPath(tx, ty) {
  if (!S || !S.map) return null;
  const k = tx + ',' + ty + ',' + S.px + ',' + S.py + ',' + S.map.c.length + ',' + (S.turn || S.map.c);
  if (pathMemo.k === k && pathMemo.m === S.map) return pathMemo.p;
  const mw = S.map.w, mh = S.map.h, cells = S.map.c, sx = mw >> 1, sy = mh >> 1, gx = sx + tx, gy = sy + ty;
  let out = null;
  const ok = (x, y) => { if (x < 0 || y < 0 || x >= mw || y >= mh) return false; const c = cells[y * mw + x]; return !!(c && c[0]) && !NOWALK[featClass(c[0])]; };
  if (ok(gx, gy) && (gx !== sx || gy !== sy)) {
    // steps from the target to every square (the game's own travel map), then walk down it
    // from you the way the game's travel does: fewest steps, trying straight moves before diagonals
    const cost = new Int32Array(mw * mh).fill(-1), q = [gy * mw + gx]; cost[q[0]] = 0;
    for (let h = 0; h < q.length && cost[sy * mw + sx] < 0; h++) {
      const i = q[h], x = i % mw, y = (i / mw) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const nx = x + dx, ny = y + dy, j = ny * mw + nx; if ((ok(nx, ny) || (nx === sx && ny === sy)) && cost[j] < 0) { cost[j] = cost[i] + 1; q.push(j); } }
    }
    if (cost[sy * mw + sx] > 0) {
      out = []; let x = sx, y = sy;
      const D = [[0, 1], [-1, 0], [1, 0], [0, -1], [-1, 1], [-1, -1], [1, -1], [1, 1]];
      while (x !== gx || y !== gy) {
        let bx = -1, by = -1, bc = 1e9;
        for (const [dx, dy] of D) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= mw || ny >= mh) continue; const c = cost[ny * mw + nx]; if (c < 0) continue; if (c < bc) { bx = nx; by = ny; bc = c; } }
        if (bx < 0 || out.length > mw * mh) { out = null; break; }
        x = bx; y = by; out.push([x - sx, y - sy]);
      }
    }
  }
  pathMemo = { k, m: S.map, p: out }; return out;
}
const rnd = (x, y) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); };
function shade(hexc, k) { const n = parseInt(hexc.slice(1), 16); const f = v => Math.max(0, Math.min(255, Math.round(v * k))); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; }
let TILE = 32;
let EDGE = [];   // the edge pointers drawn last, for the pointer to find
function drawMap() {
  const cv = $('#map'); if (!cv || !S.map) return;
  const W = cv.clientWidth, H = cv.clientHeight, d = SCALE * (devicePixelRatio || 1);
  if (cv.width !== Math.round(W * d) || cv.height !== Math.round(H * d)) { cv.width = Math.round(W * d); cv.height = Math.round(H * d); }
  const g = cv.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0); g.fillStyle = TH.void; g.fillRect(0, 0, W, H);
  const T = TILE, mw = S.map.w, mh = S.map.h, cells = S.map.c, rm = S.rmap;
  const pcx = mw >> 1, pcy = mh >> 1;
  const [scx, scy] = fxScroll(), [shx, shy] = fxShake();
  const ox = Math.round(W / 2 - (pcx + .5) * T + scx * T + shx), oy = Math.round(H / 2 - (pcy + .5) * T + scy * T + shy);
  const monAt = {}; for (const m of S.mons) monAt[m.dx + ',' + m.dy] = m;
  const cellAt = (x, y) => (x < 0 || y < 0 || x >= mw || y >= mh) ? 0 : cells[y * mw + x];
  const isWall = c => c && c[0] && featClass(c[0]) === 'wall';
  const x0 = Math.max(0, Math.floor(-ox / T)), x1 = Math.min(mw - 1, Math.ceil((W - ox) / T)), y0 = Math.max(0, Math.floor(-oy / T)), y1 = Math.min(mh - 1, Math.ceil((H - oy) / T));
  const later = [], fxl = [], lon = LIGHT.on, gridOk = !S.stale && !G.icky && !G.ov && BASE, ml = S.rmsg;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const c = cells[y * mw + x], gy = S.gy + y - pcy, gx = S.gx + x - pcx;
    // what the game's own grid shows here: at rest (base) and right now (spell effects in flight)
    let ch = ' ', at = 1, bch = ' ', bat = 1;
    if (gridOk && gx >= rm[0] && gx < rm[0] + rm[2] && gy >= rm[1] && gy < rm[1] + rm[3] && !(gy < ml[1] + ml[3] && gx < ml[0] + ml[2])) {
      ch = (G.s[gy] || '')[gx] || ' '; at = G.a[gy][gx]; bch = (BASE.s[gy] || '')[gx] || ' '; bat = BASE.a[gy] ? BASE.a[gy][gx] : 1;
    }
    const fx = ch !== ' ' && (ch !== bch || at !== bat);
    const sx = ox + x * T, sy = oy + y * T;
    if (fx) fxl.push([x, y, at]);
    if (!c) { if (fx) later.push([sx, sy, ch, col(at), 1, 0]); continue; }
    const f = c[0], fl = c[1], lit = lon || !!(fl & 1), cls = f ? featClass(f) : 'floor';
    const fd = DICT.f[f] || ['', 46, 1], fcol = col(fd[2]), v = rnd(x + S.px, y + S.py);
    if (!f && !c[2] && !c[3] && !(fl & 4)) { if (fx) later.push([sx, sy, ch, col(at), 1, 0]); continue; }
    if (!f) { /* something seen on ground we have not mapped */ }
    else if (TS && TS.feat && sprite(g, 'feat', fd[0], sx, sy, T, TS.feat['class:' + cls] ? 'class:' + cls : null)) { if (!lit) { g.fillStyle = 'rgba(6,7,9,.5)'; g.fillRect(sx, sy, T, T); } }
    else
    if (cls === 'wall') {
      const below = cellAt(x, y + 1), open = below && below[0] && !isWall(below);
      g.fillStyle = lit ? TH.wallTop : TH.wallTopDim; g.fillRect(sx, sy, T, T);
      if (open) { g.fillStyle = lit ? TH.wallFace : TH.wallFaceDim; g.fillRect(sx, sy + T * .42, T, T * .58);
        g.fillStyle = TH.mortar; for (let i = 1; i < 3; i++) g.fillRect(sx + (i * T) / 3 + (v > .5 ? 3 : -2), sy + T * .42, 1, T * .58); g.fillRect(sx, sy + T * .7, T, 1); }
      g.fillStyle = TH.mortar; g.fillRect(sx, sy, T, 1); g.fillRect(sx, sy, 1, open ? T * .42 : T);
      if (fd[2] !== 1 && fd[2] !== 2 && fd[2] !== 8 && f) { g.globalAlpha = .22; g.fillStyle = fcol; g.fillRect(sx, sy, T, T); g.globalAlpha = 1; if (v > .4) { g.fillStyle = fcol; g.fillRect(sx + T * v * .7, sy + T * .2, 3, 3); g.fillRect(sx + T * .3, sy + T * v * .4, 2, 2); } }
    } else {
      let a = TH.floorA, b = TH.floorB, dm = TH.floorDim, ln = lit ? TH.floorLine : TH.floorLineDim;
      if (cls === 'water') { a = '#2f5f86'; b = '#2b587c'; dm = '#1c3a52'; ln = lit ? '#3a6f98' : '#22445e'; }
      else if (cls === 'lava') { a = '#b8441c'; b = '#a83c18'; dm = '#5e2410'; ln = lit ? '#e0702c' : '#6e2c14'; }
      else if (cls === 'grass' || cls === 'tree') { a = '#4c6a3c'; b = '#476438'; dm = '#2c3d24'; ln = lit ? '#42593a' : '#263420'; }
      else if (cls === 'snow') { a = '#aab4bd'; b = '#a2adb6'; dm = '#5b6269'; ln = lit ? '#95a0a9' : '#4c5359'; }
      else if (cls === 'other' && f) { a = shade(fcol, .45); b = shade(fcol, .42); dm = shade(fcol, .25); ln = shade(fcol, lit ? .36 : .2); }
      g.fillStyle = lit ? (v > .5 ? a : b) : dm; g.fillRect(sx, sy, T, T);
      g.fillStyle = ln; g.fillRect(sx, sy, T, 1); g.fillRect(sx, sy, 1, T);
      if (v > .8) { g.fillRect(sx + T * v * .7, sy + T * .6, 3, 2); g.fillRect(sx + T * .3, sy + T * v * .5, 2, 2); }
      if (cls === 'door') { g.fillStyle = TH.door; g.fillRect(sx + 5, sy + 3, T - 10, T - 4); g.fillStyle = TH.doorDark; g.fillRect(sx + T / 2 - 1, sy + 3, 2, T - 4); g.fillStyle = TH.accent; g.fillRect(sx + T - 11, sy + T / 2, 3, 3); }
      else if (cls === 'dooropen') { g.fillStyle = TH.door; g.fillRect(sx + 2, sy + 3, 5, T - 4); g.fillRect(sx + T - 7, sy + 3, 5, T - 4); }
      else if (cls === 'up' || cls === 'down') { g.fillStyle = TH.stair; for (let i = 0; i < 4; i++) g.fillRect(sx + 5 + i * 3, sy + 6 + i * 6, T - 10 - i * 3, 4);
        g.fillStyle = cls === 'down' ? '#7fd0f0' : TH.accent; g.beginPath(); if (cls === 'down') { g.moveTo(sx + T - 13, sy + 5); g.lineTo(sx + T - 4, sy + 5); g.lineTo(sx + T - 8.500, sy + 12); } else { g.moveTo(sx + T - 13, sy + 12); g.lineTo(sx + T - 4, sy + 12); g.lineTo(sx + T - 8.500, sy + 5); } g.fill(); }
      else if (cls === 'pit') { g.fillStyle = '#050607'; g.beginPath(); g.ellipse(sx + T / 2, sy + T / 2, T * .42, T * .36, 0, 0, 7); g.fill(); g.strokeStyle = lit ? '#2a2c2f' : '#1a1b1d'; g.lineWidth = 2; g.stroke(); }
      else if (cls === 'trap') { g.strokeStyle = readable(fcol); g.lineWidth = 2; g.globalAlpha = lit ? 1 : .6; g.beginPath(); g.moveTo(sx + T / 2, sy + 6); g.lineTo(sx + T - 6, sy + T - 7); g.lineTo(sx + 6, sy + T - 7); g.closePath(); g.stroke(); g.globalAlpha = 1; }
      else if (cls === 'shop') { g.fillStyle = TH.doorDark; g.fillRect(sx + 2, sy + 2, T - 4, T - 2); g.fillStyle = TH.door; g.fillRect(sx + 4, sy + 4, T - 8, T - 4); later.push([sx, sy, String.fromCharCode(fd[1]), '#ffe2b8', 1, 4]); }
      else if (cls === 'rubble') { g.fillStyle = lit ? '#8a8378' : '#4a4640'; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(sx + 6 + rnd(x + i, y) * (T - 12), sy + 8 + rnd(x, y + i) * (T - 14), 4 + rnd(i, x) * 3, 0, 7); g.fill(); } }
      else if (cls === 'tree') { g.fillStyle = lit ? '#2f5a2a' : '#1c3219'; g.beginPath(); g.arc(sx + T / 2, sy + T * .42, T * .34, 0, 7); g.fill(); g.fillStyle = '#3a2a1a'; g.fillRect(sx + T / 2 - 2, sy + T * .68, 4, T * .24); }
      else if (f && cls === 'other' && String.fromCharCode(fd[1]) !== '.' && String.fromCharCode(fd[1]) !== ' ') later.push([sx, sy, String.fromCharCode(fd[1]), readable(col(fd[2])), lit ? 1 : .6, 4]);
    }
    if (cls === 'water' || cls === 'lava') ambCell(g, cls, sx, sy, T, S.px + x - pcx, S.py + y - pcy, lit);
    if (c[3]) { const k = DICT.k[c[3]] || ['', 0, 0, 42, 1], own = bch !== ' ' && !c[2] && !(fl & 4); later.push([sx, sy, own ? bch : String.fromCharCode(k[3]), readable(own ? col(bat) : col(k[4])), 1, 1, objArt(c[3])]); }
    if (c[2]) later.push([sx, sy, c[2], null, lit ? 1 : .8, 2, monAt[(x - pcx) + ',' + (y - pcy)]]);
    else if (fl & 4) later.push([sx - scx * T, sy - scy * T, 0, null, 1, 3]);
    if (fx) later.push([sx, sy, ch, col(at), 1, 0]);
  }
  // player light
  const px = ox + (pcx + .5 - scx) * T, py = oy + (pcy + .5 - scy) * T; g.globalCompositeOperation = 'lighter';
  let gr = g.createRadialGradient(px, py, 10, px, py, T * 7); gr.addColorStop(0, 'rgba(255,140,60,.2)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over';
  if (lon) lightPass(g, ox, oy, T, cells, mw, mh, pcx, pcy, fxl, scx, scy);
  for (let [sx, sy, what, c, al, kind, nm] of later) {
    if (lon && kind !== 0 && kind !== 2 && kind !== 3) { const lx = Math.round((sx - ox) / T), ly = Math.round((sy - oy) / T); if (lx >= 0 && ly >= 0 && lx < mw && ly < mh) al *= .45 + .55 * Math.min(1, lightAt(lx, ly, mw) * 1.5); }
    g.globalAlpha = al;
    if (kind === 1 && sprite(g, 'obj', nm, sx, sy, T)) { g.globalAlpha = 1; continue; }
    if (kind === 2) { const mo = nm ? fxMon(nm.i) : [0, 0], lu = nm ? fxLunge(nm.i) : [0, 0], mx2 = sx + (mo[0] + lu[0]) * T, my2 = sy + (mo[1] + lu[1] + ambBob(nm, nm && nm.i)) * T; drawToken(g, mx2, my2, T, DICT.r[what] || ['?', 63, 1, 0, 0]);
      const fl2 = nm ? fxFlash(nm.i) : 0; if (fl2 && spriteFlash(g, DICT.r[what], mx2, my2, T, fl2)) { /* drawn */ } else if (fl2) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = fl2 * .85; g.fillStyle = '#fff'; g.beginPath(); g.arc(mx2 + T / 2, my2 + T / 2, T * .42, 0, 7); g.fill(); g.globalCompositeOperation = 'source-over'; } }
    else if (kind === 3) { const lu = fxLunge('p'); sx += lu[0] * T; sy += lu[1] * T;
      // a thin ring at your feet, so you find yourself at a glance on a dark or busy map
      g.save(); g.globalAlpha = .7; g.strokeStyle = '#ff9a4a'; g.lineWidth = Math.max(1.2, T / 26); g.beginPath(); g.ellipse(sx + T / 2, sy + T * .94, T * .44, T * .14, 0, 0, Math.PI * 2); g.stroke(); g.restore();
      if (!sprite(g, 'player', S.p.race + ' ' + S.p.cls, sx, sy, T, tkey(S.p.cls).replace(/ /g, '-')) && !sprite(g, 'player', S.p.race, sx, sy, T, 'default')) drawMob(g, MOBS['@'], sx, sy, T); }
    else if (kind === 0 && drawSpell(g, sx, sy, T, what, c)) { fxSpell(S.px + Math.round((sx - ox) / T) - pcx, S.py + Math.round((sy - oy) / T) - pcy, what, c); }
    else { g.font = `700 ${Math.round(T * (kind ? .62 : .66))}px Inter`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 3; g.strokeStyle = '#0b0a09'; g.lineJoin = 'round'; g.strokeText(what, sx + T / 2, sy + T / 2 + 1); g.fillStyle = c; g.fillText(what, sx + T / 2, sy + T / 2 + 1); }
    g.globalAlpha = 1;
  }
  // target brackets and health
  for (const m of S.mons) {
    const mo = fxMon(m.i), mx = ox + (pcx + m.dx + mo[0]) * T, my = oy + (pcy + m.dy + mo[1]) * T;
    if (m.hp < 100 || m.target) { const bh = Math.max(3, Math.round(T / 16)), by = my - bh - 2; g.fillStyle = '#000c'; g.fillRect(mx + 2, by - 1, T - 4, bh + 2); g.fillStyle = m.hp > 75 ? '#a9c98c' : m.hp > 45 ? '#ffc46a' : TH.danger; g.fillRect(mx + 3, by, (T - 6) * m.hp / 100, bh); }   // thicker on big tiles so it reads at 4K
    if (m.afraid && !m.asleep) { const r = Math.max(3.5, T * .12), cx = mx + T * .16, cy = my + T * .26; g.save(); g.fillStyle = '#9fd6ff'; g.strokeStyle = '#000c'; g.lineWidth = 1.5;   // afraid: a bead of sweat at its brow
      g.beginPath(); g.moveTo(cx, cy - r * 2); g.quadraticCurveTo(cx + r * 1.1, cy - r * .2, cx, cy + r); g.quadraticCurveTo(cx - r * 1.1, cy - r * .2, cx, cy - r * 2); g.stroke(); g.fill(); g.restore(); }
    if (m.asleep) { g.save(); g.font = `italic 700 ${Math.max(9, Math.round(T * .26))}px Spectral, serif`; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.lineWidth = 3; g.strokeStyle = '#000c';
      [[.04, .36, 1], [.24, .16, .75]].forEach(([fx, fy, k]) => { g.font = `italic 700 ${Math.max(11, Math.round(T * .38 * k))}px Spectral, serif`; g.strokeText('z', mx + T * fx, my + T * fy); g.fillStyle = '#bfe6f7'; g.fillText('z', mx + T * fx, my + T * fy); }); g.restore(); }   // asleep: a quiet zz at its brow
    { const th = threat(m); if (th) { const r = Math.max(5, T * .17), cx = mx + T - r * .9, cy = my + r * .9; g.fillStyle = th === 'deadly' ? '#5a1410e6' : '#4a3410e6'; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill(); g.strokeStyle = th === 'deadly' ? '#ff5a3c' : '#c8902a'; g.lineWidth = 1.2; g.stroke();
      g.fillStyle = th === 'deadly' ? '#ffb0a0' : '#ffd890'; g.font = `700 ${Math.round(r * 1.3)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(th === 'deadly' ? '☠' : '!', cx, cy + .5); } }   // much deeper than you: marked at its shoulder
    if (m.target) { g.strokeStyle = TH.danger; g.lineWidth = 2; const k = 8; [[0, 0, 1, 1], [T, 0, -1, 1], [0, T, 1, -1], [T, T, -1, -1]].forEach(([ax, ay, dx, dy]) => { g.beginPath(); g.moveTo(mx + ax + dx * k, my + ay); g.lineTo(mx + ax, my + ay); g.lineTo(mx + ax, my + ay + dy * k); g.stroke(); }); }
  }
  // the game's cursor (looking, targeting): corner brackets that breathe, and a sight line when a target is being picked
  const lm = lookMode();
  if (lm && G.lk) {
    const lx = ox + (pcx + G.lk[0]) * T, ly = oy + (pcy + G.lk[1]) * T, k = T * .3, pulse = (Math.sin(performance.now() / 180) + 1) / 2, o = 1 + pulse * T * .06;
    if (lm === 'target' && (G.lk[0] || G.lk[1])) { g.save(); g.strokeStyle = 'rgba(255,120,90,.7)'; g.lineWidth = 2; g.setLineDash([T * .22, T * .18]); g.beginPath(); g.moveTo(ox + (pcx + .5) * T, oy + (pcy + .5) * T); g.lineTo(lx + T / 2, ly + T / 2); g.stroke(); g.restore(); }
    g.fillStyle = lm === 'target' ? 'rgba(255,90,60,.16)' : 'rgba(255,207,158,.14)'; g.fillRect(lx, ly, T, T);
    g.strokeStyle = lm === 'target' ? TH.danger : '#ffcf9e'; g.lineWidth = 2.5;
    [[0, 0, 1, 1], [T, 0, -1, 1], [0, T, 1, -1], [T, T, -1, -1]].forEach(([ax, ay, dx, dy]) => { const x = lx + ax - dx * o, y = ly + ay - dy * o; g.beginPath(); g.moveTo(x + dx * k, y); g.lineTo(x, y); g.lineTo(x, y + dy * k); g.stroke(); });
    fxKickLook();
  } else if (G.cv && !G.icky && !G.ov && G.cx >= rm[0] && G.cx < rm[0] + rm[2] && G.cy >= rm[1] && G.cy < rm[1] + rm[3] && !(G.cx === S.gx && G.cy === S.gy)) {
    const ux = ox + (G.cx - S.gx + pcx) * T, uy = oy + (G.cy - S.gy + pcy) * T; g.strokeStyle = '#ffcf9e'; g.lineWidth = 2; g.strokeRect(ux + 1, uy + 1, T - 2, T - 2); g.fillStyle = 'rgba(255,176,112,.18)'; g.fillRect(ux, uy, T, T);
  }
  // creatures in sight but beyond the edge of the map view: a small pointer at the edge, towards them
  EDGE = [];
  for (const m of S.mons) {
    if (m.pet || m.friendly) continue;
    const mx = ox + (pcx + m.dx + .5) * T, my = oy + (pcy + m.dy + .5) * T; if (mx >= 0 && my >= 0 && mx <= W && my <= H) continue;
    const cx = W / 2, cy = H / 2, vx = mx - cx, vy = my - cy, pad = 16, k = Math.min((W / 2 - pad) / Math.abs(vx || 1e-6), (H / 2 - pad) / Math.abs(vy || 1e-6));
    const ex = cx + vx * k, ey = cy + vy * k, a = Math.atan2(vy, vx), r = Math.max(11, T * .36); EDGE.push({ x: ex, y: ey, r: r * 1.6, m });
    g.save(); g.translate(ex, ey); g.fillStyle = 'rgba(8,9,10,.75)'; g.beginPath(); g.arc(0, 0, r * 1.15, 0, 7); g.fill(); g.rotate(a); g.fillStyle = m.asleep ? '#ecc983' : TH.danger; g.strokeStyle = '#0b0c0e'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(r, 0); g.lineTo(-r * .7, r * .7); g.lineTo(-r * .35, 0); g.lineTo(-r * .7, -r * .7); g.closePath(); g.fill(); g.stroke(); g.restore();
  }
  const am = aimMode();
  if (am === 'dir') {   // a direction is wanted: show the eight squares you can pick
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const hx = ox + (pcx + dx) * T, hy = oy + (pcy + dy) * T, on = hover && hover.dx === dx && hover.dy === dy;
      g.fillStyle = on ? 'rgba(255,138,60,.28)' : 'rgba(255,207,158,.08)'; g.fillRect(hx + 2, hy + 2, T - 4, T - 4); g.strokeStyle = on ? 'rgba(255,176,112,.95)' : 'rgba(255,207,158,.35)'; g.lineWidth = 1.5; g.strokeRect(hx + 2.5, hy + 2.5, T - 5, T - 5); }
  } else if (am === 'aim' && hover && (hover.dx || hover.dy)) {   // aiming: a line from you to the square, and a reticle on it
    const x0 = ox + (pcx + .5) * T, y0 = oy + (pcy + .5) * T, x1 = ox + (pcx + hover.dx + .5) * T, y1 = oy + (pcy + hover.dy + .5) * T;
    // the line runs to where the shot would stop; past a wall or a creature in the way it goes faint, with a mark where it stops
    const bk = aimPath(hover.dx, hover.dy), bx1 = bk ? ox + (pcx + bk.dx + .5) * T : x1, by1 = bk ? oy + (pcy + bk.dy + .5) * T : y1;
    g.save(); g.strokeStyle = 'rgba(255,176,112,.85)'; g.lineWidth = 2; g.setLineDash([T * .22, T * .18]); g.beginPath(); g.moveTo(x0, y0); g.lineTo(bx1, by1); g.stroke();
    if (bk) { g.strokeStyle = 'rgba(255,176,112,.25)'; g.beginPath(); g.moveTo(bx1, by1); g.lineTo(x1, y1); g.stroke(); g.setLineDash([]);
      const q = T * .22; g.strokeStyle = bk.why === 'wall' ? '#c9c2b6' : TH.danger; g.lineWidth = 2.5; g.beginPath(); g.moveTo(bx1 - q, by1 - q); g.lineTo(bx1 + q, by1 + q); g.moveTo(bx1 + q, by1 - q); g.lineTo(bx1 - q, by1 + q); g.stroke(); }
    g.setLineDash([]);
    // a ball or a storm: the ground it will cover, about two squares round the reticle
    if (/ball|storm|burst|cloud|explosion|breath|blast|nova|wave/i.test(CAST.n) && Date.now() - CAST.t < 15000) {
      g.save(); g.setLineDash([]); g.fillStyle = 'rgba(255,90,60,.10)'; g.strokeStyle = 'rgba(255,138,90,.55)'; g.lineWidth = 1.5;
      for (let ddy = -2; ddy <= 2; ddy++) for (let ddx = -2; ddx <= 2; ddx++) { if (Math.max(Math.abs(ddx), Math.abs(ddy)) + Math.min(Math.abs(ddx), Math.abs(ddy)) / 2 > 2.5) continue; const bx = ox + (pcx + hover.dx + ddx) * T, by = oy + (pcy + hover.dy + ddy) * T; g.fillRect(bx + 1, by + 1, T - 2, T - 2); }
      g.beginPath(); g.arc(x1, y1, T * 2.5, 0, 7); g.stroke(); g.restore();
    }
    const r = T * .42; g.strokeStyle = TH.danger; g.lineWidth = 2; g.beginPath(); g.arc(x1, y1, r, 0, 7); g.stroke();
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { g.beginPath(); g.moveTo(x1 + a * r * .55, y1 + b * r * .55); g.lineTo(x1 + a * r * 1.3, y1 + b * r * 1.3); g.stroke(); }
    g.restore();
  } else if (hover && playing()) {
    const hx = ox + (pcx + hover.dx) * T, hy = oy + (pcy + hover.dy) * T; g.strokeStyle = 'rgba(255,207,158,.75)'; g.lineWidth = 1.5; g.strokeRect(hx + .5, hy + .5, T - 1, T - 1);
    // a walk longer than a step: dots along the way the click would take you
    const wp = !am && !lm && !G.icky && (Math.abs(hover.dx) > 1 || Math.abs(hover.dy) > 1) && !monAt[hover.dx + ',' + hover.dy] ? walkPath(hover.dx, hover.dy) : null;
    if (wp) { g.save(); for (let i = 0; i < wp.length - 1; i++) { const [wx, wy] = wp[i]; g.fillStyle = `rgba(255,207,158,${.75 - .35 * i / wp.length})`; g.beginPath(); g.arc(ox + (pcx + wx + .5) * T, oy + (pcy + wy + .5) * T, Math.max(2, T * .08), 0, 7); g.fill(); } g.restore(); }
  }
  if (atHover) {   // the side list row under the mouse: mark its square and draw the line to it
    const [adx, ady] = atHover.split(',').map(Number), ax = ox + (pcx + adx) * T, ay = oy + (pcy + ady) * T, k = T * .3;
    g.save(); g.strokeStyle = 'rgba(255,207,158,.55)'; g.lineWidth = 1.5; g.setLineDash([T * .16, T * .14]); g.beginPath(); g.moveTo(ox + (pcx + .5) * T, oy + (pcy + .5) * T); g.lineTo(ax + T / 2, ay + T / 2); g.stroke(); g.setLineDash([]);
    g.fillStyle = 'rgba(255,207,158,.14)'; g.fillRect(ax, ay, T, T); g.strokeStyle = '#ffcf9e'; g.lineWidth = 2.5;
    [[0, 0, 1, 1], [T, 0, -1, 1], [0, T, 1, -1], [T, T, -1, -1]].forEach(([bx, by, dx, dy]) => { g.beginPath(); g.moveTo(ax + bx + dx * k, ay + by); g.lineTo(ax + bx, ay + by); g.lineTo(ax + bx, ay + by + dy * k); g.stroke(); });
    g.restore();
  }
  fxDraw(g, (x, y) => [ox + (pcx + x - S.px) * T, oy + (pcy + y - S.py) * T], T);
  fxPartsDraw(g, (x, y) => [ox + (pcx + x - S.px) * T, oy + (pcy + y - S.py) * T], T);
  const vg = g.createRadialGradient(px, py, T * 6, px, py, Math.max(W, H) * .8); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(4,5,6,.55)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
  drawMini(pcx, pcy, Math.ceil(W / T), Math.ceil(H / T));
  const hpf = S.p.mhp > 0 ? S.p.hp / S.p.mhp : 1;
  postRender(cv, (x, y) => [(ox + (pcx + x - S.px + .5) * T) * d, (oy + (pcy + y - S.py + .5) * T) * d], Math.max(2, Math.round(T * d / 24)), hpf < .25 ? Math.min(1, 1 - Math.max(0, hpf) / .25) : 0);
}
function drawMini(pcx, pcy, vw, vh) {
  const cv = $('#mini'); if (!cv) return;
  const W = cv.clientWidth, H = cv.clientHeight, d = SCALE * (devicePixelRatio || 1) * 2; cv.width = W * d; cv.height = H * d;
  const g = cv.getContext('2d'); g.scale(d, d); g.fillStyle = '#0c0d0e'; g.fillRect(0, 0, W, H);
  const mw = S.map.w, mh = S.map.h, s = Math.min(W / mw, H / mh), ox = (W - mw * s) / 2, oy = (H - mh * s) / 2, cells = S.map.c;
  for (let i = 0; i < cells.length; i++) { const c = cells[i], x = i % mw, y = (i / mw) | 0;
    if (!c || !c[0]) { if (typeof EXP_MEM !== 'undefined' && EXP_MEM.m.get((S.px + x - pcx) + ',' + (S.py + y - pcy)) === 1) { g.fillStyle = '#1c1f22'; g.fillRect(ox + x * s, oy + y * s, s + .3, s + .3); } if (!c || !c[3] && !c[2]) continue; }
    const cls = c[0] ? featClass(c[0]) : 'floor';
    if (c[0]) { g.fillStyle = cls === 'wall' ? '#5a5e64' : cls === 'door' || cls === 'dooropen' ? '#8a5a2c' : cls === 'up' || cls === 'down' ? '#7fd0f0' : cls === 'water' ? '#2f5f86' : cls === 'tree' || cls === 'grass' ? '#33492a' : '#26292d';
    g.fillRect(ox + x * s, oy + y * s, s + .3, s + .3); }
    if (c[3]) { g.fillStyle = '#ffcf6a'; g.fillRect(ox + x * s, oy + y * s, s, s); }
    if (c[2]) { g.fillStyle = '#ff5a3c'; g.fillRect(ox + x * s - .5, oy + y * s - .5, s + 1, s + 1); } }
  g.fillStyle = '#ffb070'; g.fillRect(ox + pcx * s - 1, oy + pcy * s - 1, s + 2, s + 2);
  g.strokeStyle = '#ffb070'; g.lineWidth = 1; g.strokeRect(ox + (pcx - vw / 2) * s, oy + (pcy - vh / 2) * s, vw * s, vh * s);
}

/* ---------- plain view of any screen that has no native layout yet ---------- */
// float = a pop-up over the game: only the squares the pop-up has drawn are shown, in a panel sized to fit them
function drawTerm(float, root) {
  root = root || $('#term'); const hub = root.id !== 'term';
  let x0 = 0, y0 = 0, x1 = G.w - 1, y1 = G.h - 1;
  if (float) {
    x0 = y0 = 1e9; x1 = y1 = -1;
    for (let y = 0; y < G.h; y++) { const s = G.s[y] || ''; for (let x = 0; x < G.w; x++) if (s[x] !== '\x01') { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
    if (x1 < 0) return false;
    // trim blank edges
    const blankRow = y => { const s = G.s[y] || ''; for (let x = x0; x <= x1; x++) if (s[x] !== ' ' && s[x] !== '\x01') return false; return true; };
    const blankCol = x => { for (let y = y0; y <= y1; y++) { const c = (G.s[y] || '')[x]; if (c !== ' ' && c !== '\x01') return false; } return true; };
    while (y1 > y0 && blankRow(y1)) y1--; while (y0 < y1 && blankRow(y0)) y0++;
    while (x1 > x0 && blankCol(x1)) x1--; while (x0 < x1 && blankCol(x0)) x0++;
    if (x0 === x1 && y0 === y1 && blankRow(y0)) return false;
  }
  // a scrolling page (messages, help, lists): its caption and key line become a title bar and buttons
  PAGER = pagerInfo(y0, y1); BROWSE = PAGER ? null : browseInfo(y0, y1); const skip = {};
  // a creature's recall: its picture and name head the card
  const rc = !PAGER && !BROWSE && float ? /^\s*Name\s*:\s*(.+?) \((.)\)\s*$/.exec((G.s[y0] || '').replace(/\x01/g, ' ')) : null;
  RECALL = !!rc; if (rc) { skip[y0] = 1; y0++; }
  if (BROWSE) { skip[BROWSE.foot] = 1; if (BROWSE.foot === y1) y1--; if (BROWSE.title >= 0) { skip[BROWSE.title] = 1; if (BROWSE.title === y0) y0++; }
    while (y1 > y0 && !(G.s[y1] || '').replace(/[\x01 ]/g, '')) y1--; while (y0 < y1 && !(G.s[y0] || '').replace(/[\x01 ]/g, '')) y0++; }
  if (PAGER) { skip[PAGER.head] = 1; if (PAGER.foot >= 0) skip[PAGER.foot] = 1; if (PAGER.head === y0) y0++; if (PAGER.foot === y1) y1--;
    while (y1 > y0 && !(G.s[y1] || '').replace(/[\x01 ]/g, '')) y1--; }
  const rcH = rc ? `<canvas class="rmob" data-n="${esc(rc[1])}"></canvas><b>${esc(rc[1])}</b><span class="pgn">creature recall</span>` : '';
  setHtml(root.querySelector('.t-h'), rc ? rcH : PAGER ? pagerHead(PAGER) : BROWSE && BROWSE.title >= 0 ? `<b>${esc(BROWSE.name)}</b><span class="pgn">click a line to pick it · double-click to recall</span>` : '');
  const rcv = rc && root.querySelector('.t-h .rmob');
  if (rcv && !rcv._ok) {
    const c = rcv, d = 2 * SCALE * (devicePixelRatio || 1); c.width = c.height = Math.round(72 * d); const g = c.getContext('2d'); g.scale(d, d); sprite.flat = true; c._ok = sprite(g, 'mon', rc[1], 0, 0, 72); sprite.flat = false;
  }
  setHtml(root.querySelector('.t-f'), PAGER ? pagerFoot(PAGER) : BROWSE ? browseFoot(BROWSE) : rc ? (/press any key/i.test(G.s.join('')) ? '<span class="pgw">any key or a click goes on</span>' : '<span class="pgb" data-key="r"><span class="key">r</span>back</span><span class="pgb" data-key="Esc"><span class="key">Esc</span>stop looking</span><span class="pgw">a click goes back</span>') : /^\s*Window Flags/.test((G.s[y0] || '').replace(/\x01/g, ' ')) ? '<span class="pgw">these pick what the game\'s extra text windows show; this interface already shows it all in its own panels, so they change nothing here</span><span class="pgb" data-key="Esc"><span class="key">Esc</span>back</span>' : '');
  const cv = root.querySelector('.t-c'), sideW = hub && root.previousElementSibling ? root.previousElementSibling.offsetWidth + 24 : 0;
  const availW = hub ? 1452 - sideW : VW - 120, availH = hub ? HUB_H - 58 - 40 - (PAGER || BROWSE ? 92 : 0) : VH - 110 - (PAGER ? 96 : 0), nw = x1 - x0 + 1, nh = y1 - y0 + 1;
  let fs = hub ? Math.floor(Math.min(availH / Math.max(nh, 30) / 1.18, availW / Math.max(nw, 80) / .602)) : Math.floor(Math.min(availH / G.h / 1.18, availW / G.w / .602)); fs = Math.max(9, Math.min(fs, hub ? 19 : 24));
  const cw = Math.round(fs * .602 * 100) / 100, chh = Math.round(fs * 1.18), d = SCALE * (devicePixelRatio || 1);
  cv.style.width = cw * nw + 'px'; cv.style.height = chh * nh + 'px'; cv.width = Math.round(cw * nw * d); cv.height = Math.round(chh * nh * d);
  const g = cv.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0); g.font = `500 ${fs}px "DejaVu Sans Mono","Cascadia Mono",Consolas,monospace`; g.textBaseline = 'middle';
  for (let y = y0; y <= y1; y++) { if (skip[y]) continue; const s = G.s[y] || '', a = G.a[y]; for (let x = x0; x <= x1; x++) { const ch = s[x]; if (!ch || ch === ' ' || ch === '\x01') continue; g.fillStyle = readable(col(a[x])); g.fillText(ch, (x - x0) * cw, (y - y0) * chh + chh / 2); } }
  if (G.cv && G.cx >= x0 && G.cx <= x1 && G.cy >= y0 && G.cy <= y1) { g.fillStyle = 'rgba(255,176,112,.85)'; g.fillRect((G.cx - x0) * cw, (G.cy - y0) * chh + chh - 3, cw, 2); }
  TERMGEO = { x0, y0, cw, chh };
  return true;
}
const HUB_H = 950;
let TERMGEO = null, PAGER = null, BROWSE = null, RECALL = false;
// list browsers (knowledge, visuals): the bottom line reads "<dir>, 'r' to recall, ..., ESC"
function browseInfo(y0, y1) {
  let foot = -1;
  for (let y = y1; y >= Math.max(y0, y1 - 2); y--) { const t = (G.s[y] || '').replace(/\x01/g, ' ').trim(); if (/^<dir>.*ESC$/.test(t)) { foot = y; break; } if (t) break; }
  if (foot < 0) return null;
  for (let y = y0; y < foot; y++) if (/\[Press Any Key|-more-/i.test(G.s[y] || '')) return null;   // a recall laid over the list
  const line = (G.s[foot] || '').replace(/\x01/g, ' '), keys = []; let m; const re = /'(.)'(?:, '(.)')? (?:to|for) ([^,]+)/g;
  while ((m = re.exec(line))) { keys.push([m[1], m[2] ? m[3].trim() + ' ' : m[3].trim()]); if (m[2]) { keys[keys.length - 1][1] = 'copy'; keys.push([m[2], m[3].trim()]); } }
  if (/ENTER to accept/.test(line)) keys.push(['\r', 'accept']);
  let title = -1, name = '';
  for (let y = y0; y < foot; y++) { const t = (G.s[y] || '').replace(/\x01/g, ' ').trim(); if (!t) continue; if (t.length < 48 && !/[|=]{2}|:/.test(t)) { title = y; name = t; } break; }
  const recall = keys.find(k => /recall/.test(k[1]));
  return { foot, keys, title, name, recall: recall ? recall[0] : '' };
}
function browseFoot(b) {
  const k = (lab, attr, what) => `<span class="pgb" ${attr}><span class="key">${lab}</span>${what}</span>`;
  return k('Esc', 'data-key="Esc"', 'close') + '<span class="pgb"><span class="key">⇅</span>move</span>' + b.keys.map(([key, what]) => k(key === '\r' ? 'Enter' : esc(key), `data-key="${esc(key)}"`, esc(what))).join('') + '<span class="pgw">wheel moves</span>';
}
function pagerInfo(y0, y1) {
  let head = -1, foot = -1, cap = '', at = 0, of = 0, keys = '';
  for (let y = y0; y <= Math.min(y1, y0 + 2); y++) { const m = /\[(.+?), Line (\d+)\/(\d+)\]/.exec((G.s[y] || '').replace(/\x01/g, ' ')); if (m) { head = y; cap = m[1]; at = +m[2]; of = +m[3]; break; } }
  if (head < 0) return null;
  for (let y = y1; y > head; y--) { const m = /\[(Press [^\]]*)\]/.exec((G.s[y] || '').replace(/\x01/g, ' ')); if (m) { foot = y; keys = m[1]; break; } }
  return { head, foot, cap, at, of, keys, page: foot > head ? foot - head - 1 : y1 - head };
}
function pagerHead(p) {
  let cap = p.cap.replace(/^Help file '(.+?)'$/i, 'Help · $1').replace(/\.txt$/i, '').replace(/_contents$/i, '').replace(/_/g, ' ').replace(/^FrogComposband [^,]*,\s*/, ''); cap = cap.charAt(0).toUpperCase() + cap.slice(1);
  const of = Math.max(p.of, 1), a = Math.min(p.at, of), b = Math.min(of, p.at + p.page), w = Math.max(4, Math.min(100, p.page / of * 100)), l = of > p.page ? (a / Math.max(1, of - p.page)) * (100 - w) : 0;
  return `<b>${esc(cap)}</b><span class="pgn">${of > p.page ? `lines ${a + 1}–${b} of ${of}` : `${of} lines`}</span><i class="pgbar"><i style="left:${l.toFixed(1)}%;width:${w.toFixed(1)}%"></i></i>`;
}
function pagerFoot(p) {
  const k = (lab, attr, what) => `<span class="pgb" ${attr}><span class="key">${lab}</span>${what}</span>`;
  let h = k('Esc', 'data-key="Esc"', 'close');
  if (p.of > p.page) h += k('PgUp', 'data-ks="FF55"', 'page up') + k('PgDn', 'data-ks="FF56"', 'page down') + k('Home', 'data-ks="FF50"', 'top') + k('End', 'data-ks="FF57"', 'end');
  if (/M to toggle/.test(p.keys)) h += k('M', 'data-key="M"', 'mode');
  if (/\?/.test(p.keys)) h += k('?', 'data-key="?"', 'help');
  return h + '<span class="pgw">wheel scrolls</span>';
}

/* ---------- frame ---------- */
function draw() {
  if (!G.w) return;
  const inGame = !!(S && S.p && S.map);
  document.body.classList.add('main');
  $('#stage').style.setProperty('--vw', VW + 'px');
  let ask = null;
  if (inGame) {
    if (!built) buildMain();
    const nl = setHtml($('#L'), leftHtml()), nr = setHtml($('#R'), rightHtml()); setHtml($('#C'), consoleHtml()); setHtml($('#plaque'), plaqueHtml()); setHtml($('#hbplate'), HB.mode === 'B' ? hotbarHtml() : ''); document.body.classList.toggle('hbA', HB.mode === 'A');
    const pt = $('#port'); if (pt && nl) { const d = 2 * SCALE * (devicePixelRatio || 1); pt.width = pt.height = 72 * d; const g = pt.getContext('2d'); g.scale(d, d); drawMob(g, MOBS['@'], 0, 0, 72); }
    if (nr) document.querySelectorAll('.mobc').forEach(c => drawMobCanvas(c, +c.dataset.r, c.clientWidth || 38));
    askView(); drawMap();
    setHtml($('#here'), hereHtml()); tipStale();
    const bn = $('#banner'); ask = pageEditing() ? null : askHtml(); const live = ask || G.icky || G.ov || pageEditing() ? '' : liveHtml();
    const car = live && G.cv && G.cy < S.rmsg[1] + S.rmsg[3] ? '<i class="caret"></i>' : '', at = live.indexOf('<span class="lkeys">');
    if (ask) { setHtml(bn, ask.html); bn.className = 'on ask ' + ask.cls; }
    else { setHtml(bn, at >= 0 ? live.slice(0, at) + car + live.slice(at) : live + car); bn.className = live ? 'on' : ''; }
  }
  PAGER = null; BROWSE = null; RECALL = false; const t = $('#term'), nat = $('#native'), raw = inGame ? nativeHtml() : (titleHtml() || optsHtml() || birthHtml()); let show = false;
  // in play, every page shares one frame: a native panel is wrapped in it, and a page of the game's own text is drawn inside it
  const edit = inGame && !raw && pageEditing(), page = inGame && !raw && G.icky && !ask, nh = edit ? editorHtml() : page ? hubPageHtml(UI && UI.kind === 'char' && uiOnTop() ? charHtml() : '') : inGame ? (hubWrap(raw) || (G.ov && !G.icky && !ask ? floatHtml() : '') || (G.icky || G.ov || ask ? '' : hubHoldHtml())) : raw;
  const natWas = nat.classList.contains('on'), termWas = t.classList.contains('on');
  const natChanged = setHtml(nat, nh); if (natChanged) { showTip('', {}); if (!nat.querySelector('.hub')) panelHold(nat); } if (natChanged && nh && inGame) nativeAfter(); if (!inGame && (natChanged || TS && !nat._t) && nat.querySelector('.tmob')) { titleAfter(); nat._t = !!TS; } nat.classList.toggle('on', !!nh);
  if (page) show = false;
  else if (nh) show = false;
  else if (!inGame) show = drawTerm(false);
  else if (ask && G.ov) show = false;
  else if (G.icky || G.ov) show = drawTerm(!!G.ov);
  t.classList.toggle('on', !!show); t.classList.toggle('float', !!(show && inGame && G.ov));

  // a panel opening eases in rather than snapping; one already open just updates
  for (const [el, was] of [[nat, natWas], [t, termWas]]) if (!was && el.classList.contains('on')) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); const n = el._pop = (el._pop || 0) + 1; setTimeout(() => { if (el._pop === n) el.classList.remove('pop'); }, 220); }
  // the ease-in is for opening only: once it has played, the class goes, or every redraw (a new panel element) would fade in again
  // from nothing and flash whatever lies under it. And the start-up line has done its job once the game has drawn something.
  if ((nh || inGame) && !built) { const w = $('#wait'); if (w && /Waking/.test(w.textContent)) w.remove(); }
}
document.addEventListener('click', e => {
  const ks = e.target.closest('[data-ks]'); if (ks) { trigger(parseInt(ks.dataset.ks, 16), {}); return; }
  if (e.target.closest('[data-gmenu]')) { gmenuToggle(true); return; }
  const tg = e.target.closest('[data-tgt]'); if (tg) { sendRaw('T ' + tg.dataset.tgt.replace(',', ' ')); return; }
  if (e.target.closest('[data-explore]')) { if (EXP.on) exploreStop(); else exploreStart(); return; }
  const q = e.target.closest('[data-qty]'); if (q) { sendText('\b'.repeat(8) + '\x7f'.repeat(8) + q.dataset.qty + '\r'); return; }
  const k = e.target.closest('[data-key]'); if (k) { const v = k.dataset.key; if (v === 'Esc' || v === '\x1b') sendBytes([27]); else sendText(v.replace(/\n/g, '\r')); }   // HTML turns a stored Return into a newline: give the game its Return back
});
// start once every script has loaded (a message arriving between two script files would find half the interface missing)
Promise.all([document.fonts.ready, new Promise(r => document.readyState === 'complete' ? r() : addEventListener('load', r))]).then(() => { fit(); loadTiles(); const es = new EventSource('/events'); es.onmessage = ev => { try { onMsg(JSON.parse(ev.data)); } catch (err) { console.error(err); } }; });
