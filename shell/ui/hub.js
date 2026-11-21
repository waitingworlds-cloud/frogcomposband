// One window for everything you open in play. The pack, what you wear, spells, the character sheet, the map, the
// journal, messages, options and help all appear in the same frame, at the same size, with tabs across the top to
// move between them. Each tab presses the same key the keyboard would.
'use strict';
const HUB_TABS = [['pack', 'Pack', 'i'], ['gear', 'Gear', 'e'], ['spells', 'Spells', 'm'], ['char', 'Character', 'C'], ['map', 'Map', 'M'],
  ['journal', 'Journal', '~'], ['log', 'Messages', '\x10', 'Ctrl P'], ['opts', 'Options', '='], ['help', 'Help', '?']];
const HUB = { last: '', t: 0, hold: 0, cur: '' };
const HUB_KEY = { i: 'pack', e: 'gear', m: 'spells', b: 'spells', G: 'spells', U: 'spells', C: 'char', M: 'map', '~': 'journal', '=': 'opts', '?': 'help' };
function hubCur() {
  if (typeof UI !== 'undefined' && UI && UI.kind && uiOnTop()) {
    if (UI.kind === 'items' && spbPicking()) return 'spells';
    if (UI.kind === 'items') return itemsViewer() ? (itemsTab().loc === 1 ? 'gear' : 'pack') : '';
    if (UI.kind === 'spells') return 'spells';
    if (UI.kind === 'char') return 'char';
    if (UI.kind === 'lmap') return 'map';
  }
  const pg = G.icky ? pagerInfo(0, G.h - 1) : null, cap = pg ? pg.cap : '';
  if (/Help file/i.test(cap)) return 'help'; if (/Character Sheet/i.test(cap)) return 'char'; if (/Message/i.test(cap)) return 'log';
  const lk = typeof LASTCMD !== 'undefined' && LASTCMD && LASTCMD.t > HUB.t ? HUB_KEY[LASTCMD.k] : HUB.last;
  return lk || '';
}
function hubTabsHtml(cur) {
  if (S && S.p && S.p.hp < 0) return `<div class="hubt"><div class="hubtab on"><span>${cur === 'log' ? 'Last messages' : cur === 'char' ? 'Character' : 'The fallen'}</span></div><span class="grow"></span><span class="hubx" data-key="Esc" data-tip="Close (Esc)">&times;</span></div>`;   // the dead have nowhere else to go
  const tabs = HUB_TABS.filter(t => t[0] !== 'spells' || (S && S.p && (S.p.msp > 0 || S.p.realm)) || cur === 'spells');
  return `<div class="hubt">${tabs.map(([id, label, key, name]) => `<div class="hubtab${id === cur ? ' on' : ''}" data-hub="${id}"><span>${label}</span><span class="key">${esc(name || key)}</span></div>`).join('')}<span class="grow"></span><span class="hubx" data-key="Esc" data-tip="Close (Esc)">&times;</span></div>`;
}
// wrap a native panel in the frame (shops, your home and death keep their own; so does a "which one?" list)
function hubWrap(html) {
  if (!html) return '';
  const k = typeof UI !== 'undefined' && UI && UI.kind && uiOnTop() ? UI.kind : '';
  if (k === 'shop' || k === 'home' || (k === 'items' && !itemsViewer() && !spbPicking()) || /class="[^"]*\b(deathp?|nohub)\b/.test(html.slice(0, 200))) return html;
  HUB.cur = hubCur();
  return `<div class="pane npanel hub">${hubTabsHtml(HUB.cur)}<div class="hubb">${html}</div></div>`;
}
// the frame around a page of the game's own text; the caller draws the text into the canvas
function hubTermHtml(side) {
  HUB.cur = hubCur();
  return `<div class="pane npanel hub">${hubTabsHtml(HUB.cur)}<div class="hubb term">${side || ''}<div class="hubterm"><div class="t-h pgh"></div><div class="t-w"><canvas class="t-c"></canvas></div><div class="t-f pgf"></div></div></div></div>`;
}
// while one page closes and the next opens, the frame stays up, so nothing blinks
function hubHoldHtml() { return Date.now() < HUB.hold ? `<div class="pane npanel hub">${hubTabsHtml(HUB.last)}<div class="hubb"></div></div>` : ''; }
function hubGo(id) {
  const t = HUB_TABS.find(t => t[0] === id); if (!t || !S || !S.map) return;
  HUB.last = id; HUB.t = Date.now(); HUB.hold = Date.now() + 700;
  if (id === 'spells') SPB.auto = Date.now();
  sendBytes([27]); sendBytes([27]); sendBytes([27]); setTimeout(() => sendText('\\' + t[2]), 110); schedule();
  setTimeout(schedule, 720);
}
document.addEventListener('click', ev => {
  const t = ev.target.closest && ev.target.closest('[data-hub]'); if (!t) return;
  ev.stopPropagation(); ev.preventDefault(); if (t.dataset.hub !== HUB.cur) hubGo(t.dataset.hub);
}, true);
