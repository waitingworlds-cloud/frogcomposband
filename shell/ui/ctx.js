// Right-click menus: actions for a square on the map, a monster or item in the side lists,
// an item in the pack, or a worn item. Every action just presses the same keys you would,
// so the keyboard stays the real way to play; the menu itself also works from the keyboard
// (arrows + Enter, or the letter shown, Esc closes).
'use strict';
let CTX = null;          // the open menu: { items, sel }
let PICK = null;         // after a menu command opens the game's item prompt, choose this item: { name, t, tabbed }
let AIM = 0;             // when set, answer the game's next "Direction" prompt with the current target

const dirKey = (dx, dy) => String.fromCharCode(48 + (dy < 0 ? 7 : dy > 0 ? 1 : 4) + Math.sign(dx) + 1);
const cmd = c => '\\' + c;                       // '\' makes the game read the next key as a plain command, whatever the keymap
function cmdPick(c, name) { PICK = { name, c, t: Date.now(), tabbed: 0 }; sendText(cmd(c)); }
function cmdAim(c, dx, dy) { sendRaw(`T ${dx} ${dy}`); AIM = Date.now(); sendText(cmd(c)); }

/* ---------- what you can do ---------- */
function featName(c) { return c && c[0] ? ((DICT.f[c[0]] || [''])[0] || '').toLowerCase() : ''; }
function cellItems(cell) {
  const { dx, dy } = cell, adj = Math.abs(dx) <= 1 && Math.abs(dy) <= 1, here = !dx && !dy;
  const m = S.mons.find(m => m.dx === dx && m.dy === dy), objs = S.floor.filter(o => o.dx === dx && o.dy === dy), f = featName(cell.c);
  const out = [];
  if (here) {
    if (objs.length) out.push({ k: 'g', n: objs.length > 1 ? 'Pick up items here' : 'Pick up ' + objs[0].n, run: () => sendText(cmd('g')) });
    if (/up stair|up staircase|shaft up|way up/.test(f)) out.push({ k: '<', n: 'Go up the stairs', run: () => sendText(cmd('<')) });
    if (/down stair|down staircase|trap ?door|entrance to|shaft down|way down/.test(f)) out.push({ k: '>', n: /entrance/.test(f) ? 'Enter the dungeon' : 'Go down the stairs', run: () => sendText(cmd('>')) });
    if (cell.c && cell.c[0] && featClass(cell.c[0]) === 'shop' && f !== 'building') out.push({ k: '', n: 'Go into ' + (DICT.f[cell.c[0]] || [''])[0].replace(/^the /i, ''), run: () => sendRaw('M 1 0 0'), hot: true });
    // the nearest known way down (or up), by the walking distance
    for (const [cls, word] of [['down', 'down'], ['up', 'up']]) {
      if (featClass((cell.c || [])[0] || 0) === cls) continue;
      const mw = S.map.w, sx = mw >> 1, sy = S.map.h >> 1; let best = null;
      S.map.c.forEach((c, i) => { if (!c || !c[0] || featClass(c[0]) !== cls) return; const dx = i % mw - sx, dy = ((i / mw) | 0) - sy; if (best && Math.max(Math.abs(dx), Math.abs(dy)) >= best.n) return; const p = walkPath(dx, dy); if (p && (!best || p.length < best.n)) best = { dx, dy, n: p.length }; });
      if (best) out.push({ k: '', n: `Walk to the nearest way ${word} (${best.n} steps)`, run: () => sendRaw(`M 1 ${best.dx} ${best.dy}`) });
    }
    if (!expFoes().some(expThreat)) out.push({ k: S.p.rl ? '' : 'x', n: 'Explore until something turns up', run: () => exploreStart() });
    out.push({ k: 'R', n: 'Rest as needed', run: () => sendText(cmd('R') + '&\r') });
    out.push({ k: 'i', n: 'Open your pack', run: () => sendText(cmd('i')) });
    out.push({ k: 'l', n: 'Look around', run: () => sendText(cmd('l')) });
    return out;
  }
  if (m) {
    const nm = cap(m.n.replace(/^(an?|the) /i, ''));
    out.push({ k: 'a', n: (adj ? 'Attack ' : 'Charge ') + nm, run: () => sendRaw(`M 1 ${dx} ${dy}`), hot: !m.pet && !m.friendly });
    if ((S.equip || []).some(e => e.slot === 'Shooting' && e.o)) out.push({ k: 'f', n: 'Fire at it', run: () => cmdAim('f', dx, dy), dim: !m.los });   // only with something to shoot with
    out.push({ k: 'v', n: 'Throw at it', run: () => cmdAim('v', dx, dy), dim: !m.los });
    if (S.p.msp > 0 || S.p.realm) out.push({ k: 'm', n: 'Cast a spell at it', run: () => cmdAim('m', dx, dy), dim: !m.los });
    out.push({ k: 't', n: 'Target it', run: () => sendRaw(`T ${dx} ${dy}`) });
    out.push({ k: 'r', n: 'Recall what you know', run: () => sendRaw(`M 2 ${dx} ${dy}`) });
    return out;
  }
  out.push({ k: 'w', n: adj ? 'Step here' : 'Walk here', run: () => (!adj && !walkPath(dx, dy) && exploreGoto(dx, dy)) || sendRaw(`M 1 ${dx} ${dy}`) });
  if (adj) {
    const d = dirKey(dx, dy);
    if (/open door|broken door/.test(f)) out.push({ k: 'c', n: 'Close the door', run: () => sendText(cmd('c') + d) });
    if (/closed door|locked door|door$/.test(f) && !/open|broken/.test(f)) out.push({ k: 'o', n: 'Open the door', run: () => sendText(cmd('o') + d) });
    if (/door/.test(f)) out.push({ k: 'j', n: 'Jam the door shut', run: () => sendText(cmd('j') + d) });
    if (/trap|rune|glyph/.test(f)) out.push({ k: 'D', n: 'Disarm', run: () => sendText(cmd('D') + d) });
    if (/wall|rubble|vein|tree|granite|magma|quartz|seam/.test(f) && !/permanent/.test(f)) { const pw = (DICT.f[cell.c[0]] || [])[3], hard = !/rubble/.test(f) && S.p.dig != null && pw != null && S.p.dig <= pw;
      out.push({ k: 'T', n: hard ? 'Tunnel through (too hard for what you hold)' : 'Tunnel through', run: () => sendText(cmd('T') + d), dim: hard }); }
  }
  out.push({ k: 'x', n: 'Target this spot', run: () => sendRaw(`T ${dx} ${dy}`) });
  out.push({ k: 'r', n: 'Look closely', run: () => sendRaw(`M 2 ${dx} ${dy}`) });
  return out;
}
const TV = { potion: [75, 77], scroll: [70], food: [80], wand: [65], staff: [55], rod: [66], ammo: [16, 17, 18], book: [] };
function objItems(o, worn) {
  const tv = o.tv, out = [], is = k => TV[k].includes(tv), wearable = (tv >= 19 && tv <= 23) || (tv >= 30 && tv <= 45) || tv === 39;
  if (worn) {
    out.push({ k: 't', n: 'Take it off', run: () => cmdPick('t', o.n) });
    if (tv === 19) out.push({ k: 'f', n: 'Fire', run: () => sendText(cmd('f')) });
  } else {
    if (is('potion')) out.push({ k: 'q', n: 'Quaff', run: () => cmdPick('q', o.n) });
    if (is('scroll')) out.push({ k: 'r', n: 'Read', run: () => cmdPick('r', o.n) });
    if (is('food')) out.push({ k: 'E', n: 'Eat', run: () => cmdPick('E', o.n) });
    if (is('wand')) out.push({ k: 'a', n: 'Aim', run: () => cmdPick('a', o.n) });
    if (is('staff')) out.push({ k: 'u', n: 'Use', run: () => cmdPick('u', o.n) });
    if (is('rod')) out.push({ k: 'z', n: 'Zap', run: () => cmdPick('z', o.n) });
    if (tv >= 90 && tv <= 109) { out.push({ k: 'b', n: 'Browse', run: () => cmdPick('b', o.n) }); out.push({ k: 'm', n: 'Cast from it', run: () => cmdPick('m', o.n) }); }
    if (is('ammo')) out.push({ k: 'f', n: 'Fire', run: () => cmdPick('f', o.n) });
    if (wearable) out.push({ k: 'w', n: tv >= 19 && tv <= 23 ? 'Wield' : tv === 39 ? 'Carry as your light' : tv === 40 || tv === 45 ? 'Put on' : tv >= 30 && tv <= 38 ? 'Wear' : 'Wear or wield', run: () => cmdPick('w', o.n) });
    out.push({ k: 'v', n: 'Throw', run: () => cmdPick('v', o.n) });
    out.push({ k: 'd', n: 'Drop', run: () => cmdPick('d', o.n) });
  }
  out.push({ k: 'I', n: 'Inspect', run: () => cmdPick('I', o.n) });
  out.push({ k: '{', n: 'Inscribe', run: () => cmdPick('{', o.n) });
  return out;
}

/* ---------- a slot of yours, and what you carry that goes in it ---------- */
let SLOTPICK = null;     // wearing into a slot you clicked: the game's "which slot?" is answered with that slot
let GEARHOLD = 0;         // until then the gear tab is left on screen while the game does the wearing
let GEARBACK = null;     // worn from the gear tab: open the tab again once it is on
const WILD_NO = 'You cannot change your gear out on the world map. Step into a place first.';
const slotFits = i => ((S && S.pack) || []).filter(o => o.fit && (o.fit >> i) & 1);   // i counts your slots from 0, as S.equip does
const slotVerb = t => t === 2 || t === 12 || t === 4 ? 'Wield' : t === 3 || t === 5 ? 'Put on' : t === 6 ? 'Hold up' : t === 13 ? 'Ready' : 'Wear';
const SLOT_WANTS = { 1: 'Gloves or gauntlets go here.', 2: 'A weapon or a shield goes here.', 3: 'A ring goes here.', 4: 'A bow, sling or crossbow goes here.', 5: 'An amulet goes here.', 6: 'A torch or lantern goes here.', 7: 'Body armour goes here.', 8: 'A cloak goes here.', 9: 'Boots go here.', 10: 'A helm or cap goes here.', 11: 'Almost anything can go here.', 12: 'A weapon goes here.', 13: 'A capture ball goes here.', 14: 'A quiver goes here.' };
const fitName = o => o.n.replace(/\s*\{[^}]*\}\s*$/, '').replace(/\s*\([^)]*\)/g, '').replace(/^(\d+) /, 'one of your $1 ');
function gearBack(i) { const e = S.equip[i]; GEARBACK = e ? { i, t: Date.now(), had: e.o ? e.o.n : '' } : null; if (e) { GEARHOLD = Date.now() + 1800; setTimeout(schedule, 1850); } }
function wearInto(o, i, back) {
  const e = S.equip[i]; if (!e || !o) return;
  if (S.p.wild) { postToast(WILD_NO); return; }
  SLOTPICK = { k: e.k, t: Date.now(), had: e.o ? e.o.n : '' }; if (back) gearBack(i); else GEARBACK = null;
  cmdPick('w', o.n);
}
// left-click a slot on your figure: what you carry that goes there (and, if something is worn, what can be done with it)
function slotMenu(i, ev) {
  const e = S.equip[i]; if (!e) return;
  if (S.p.wild && (!e.o || slotFits(i).length)) { postToast(WILD_NO); if (!e.o) return; }
  const items = e.o ? objItems(e.o, true) : [];
  if (!S.p.wild) for (const o of slotFits(i)) items.push({ k: '', n: (e.o ? 'Swap for ' : slotVerb(e.type) + ' ') + fitName(o), run: () => wearInto(o, i), hot: !e.o });
  if (!items.length) { postToast('You carry nothing for this slot (' + e.slot.toLowerCase() + ')'); return; }
  if (typeof showTip === 'function') showTip('', {});
  ctxOpen(e.o ? cap(e.o.n.replace(/^(an?|the) /i, '').replace(/\s*[({\[].*$/, '')) : e.slot, items, ev);
}
function gearOnState() {
  if (SLOTPICK) { const e = S.equip.find(e => e.k === SLOTPICK.k); if (!e || (e.o ? e.o.n : '') !== SLOTPICK.had) SLOTPICK = null; }   // it is on: no slot question is coming
  const g = GEARBACK; if (!g) return; if (Date.now() - g.t > 3000) { GEARBACK = null; return; }
  const e = S.equip[g.i]; if (!e || (e.o ? e.o.n : '') === g.had || !playing() || expAsk()) return;   // not on yet, or the game has something to say first
  GEARBACK = null; ITEMS.back = g.i; sendText(cmd('e'));
}
document.addEventListener('click', ev => {
  const sl = ev.target.closest && ev.target.closest('#L .doll [data-eqi], #L .dollx [data-eqi]'); if (!sl || !S || !S.equip || CTX || !playing()) return;
  ev.stopPropagation(); ev.preventDefault(); slotMenu(+sl.dataset.eqi, ev);
}, true);

/* ---------- the menu ---------- */
function ctxOpen(title, items, ev) {
  if (!items.length) return;
  CTX = { items, sel: Math.max(0, items.findIndex(i => !i.dim)) };
  const el = $('#ctx');
  el.innerHTML = `<div class="ctt">${esc(title)}</div>` + items.map((it, i) => `<div class="cti ${it.dim ? 'dim' : ''} ${it.hot ? 'hot' : ''}" data-ci="${i}"><span class="key"${it.k ? '' : ' style="visibility:hidden"'}>${esc(it.k || 'x')}</span>${esc(it.n)}</div>`).join('') + '<div class="cth">Esc to close</div>';
  el.style.display = 'block'; showTip('', ev);
  const sw = innerWidth / SCALE, sh = VH, w = el.offsetWidth, h = el.offsetHeight;
  let x = ev.clientX / SCALE + 4, y = ev.clientY / SCALE + 4;
  if (x + w > sw - 8) x = ev.clientX / SCALE - w - 4; if (y + h > sh - 8) y = Math.max(8, sh - h - 8);
  el.style.left = Math.max(4, x) + 'px'; el.style.top = Math.max(4, y) + 'px';
  ctxMark();
}
function ctxMark() { document.querySelectorAll('#ctx .cti').forEach((d, i) => d.classList.toggle('sel', i === CTX.sel)); }
function ctxClose() { CTX = null; const el = $('#ctx'); if (el) el.style.display = 'none'; }
function ctxRun(i) { const it = CTX && CTX.items[i]; ctxClose(); if (it) it.run(); }
function ctxKey(e) {
  if (!CTX) return false;
  const n = CTX.items.length;
  if (e.key === 'Escape') ctxClose();
  else if (e.key === 'ArrowDown') { CTX.sel = (CTX.sel + 1) % n; ctxMark(); }
  else if (e.key === 'ArrowUp') { CTX.sel = (CTX.sel + n - 1) % n; ctxMark(); }
  else if (e.key === 'Enter' || e.key === ' ') ctxRun(CTX.sel);
  else if (e.key.length === 1) { const i = CTX.items.findIndex(it => it.k === e.key); if (i >= 0) ctxRun(i); else if (!e.shiftKey) ctxClose(); }
  else if (!/^(Shift|Control|Alt|Meta)$/.test(e.key)) ctxClose();
  return true;
}

/* ---------- following up on the game's prompts ---------- */
// a question of the game's that was answered for you (which item, which slot) is never put on screen:
// what was there stays until the game has moved on
let ANS = { t: 0, ui: null, slot: 0 };
function ctxAnswering() {
  const t = Date.now() - ANS.t; if (t > 1200) return false;
  return (ANS.ui && UI === ANS.ui) || (ANS.slot && gridHas(/Choose an equipment slot/)) || (!!SLOTPICK && t < 300);
}
function ctxOnUi(m) {
  hbOnUi(m); lvlOnUi(m);
  if (!PICK) return;
  if (Date.now() - PICK.t > 4000) { PICK = null; return; }
  if (m.kind !== 'items') return;
  const hit = m.items.find(it => it.o && (PICK.ki != null ? it.o.ki === PICK.ki : it.o.n === PICK.name) && it.k.trim());
  if (hit) { const c = PICK.c; PICK = null; ANS = { t: Date.now(), ui: m }; sendText(hit.k); if (typeof LASTPICK !== 'undefined') LASTPICK = { o: hit.o, c, t: Date.now() }; return; }
  if (m.tabs && m.tabs.length > 1 && PICK.tabbed < m.tabs.length - 1) { PICK.tabbed++; ANS = { t: Date.now(), ui: m }; sendText('/'); return; }
  PICK = null;   // not offered here: leave the choice to you
}
function ctxOnFrame() {
  if (SLOTPICK) { if (Date.now() - SLOTPICK.t > 2000) SLOTPICK = null; else if (gridHas(/Choose an equipment slot/)) { const k = SLOTPICK.k; SLOTPICK = null; ANS = { t: Date.now(), ui: null, slot: 1 }; setTimeout(schedule, 1250); sendText(k); } }
  if (!AIM) return;
  if (Date.now() - AIM > 30000) { AIM = 0; return; }
  const top = (G.s[0] || '').replace(/\x01/g, ' ');
  if (/^Direction \(/.test(top)) { AIM = 0; sendText('t'); }
}

/* ---------- mouse ---------- */
function ctxTarget(ev) {
  const t = ev.target, hb = hbCtx(ev); if (hb) return hb;
  if (t.id === 'map' && playing()) { const cell = mapCellAt(ev); if (!cell) return null; const m = S.mons.find(m => m.dx === cell.dx && m.dy === cell.dy);
    const f = featName(cell.c), title = !cell.dx && !cell.dy ? 'You' : m ? cap(m.n.replace(/^(an?|the) /i, '')) : cap(f || 'here');
    return [title, cellItems(cell)]; }
  const at = t.closest && t.closest('[data-at]');
  if (at && playing()) { const [dx, dy] = at.dataset.at.split(',').map(Number); const c = S.map ? S.map.c[((S.map.h >> 1) + dy) * S.map.w + (S.map.w >> 1) + dx] : 0;
    const m = S.mons.find(m => m.dx === dx && m.dy === dy); return [m ? cap(m.n.replace(/^(an?|the) /i, '')) : at.dataset.n || 'There', cellItems({ dx, dy, c })]; }
  const worn = t.closest && t.closest('[data-worn]');
  if (worn && playing()) { const e = S.equip.find(e => e.k === worn.dataset.worn), tab = !!worn.closest('.inv2'); if (e && e.o) return [e.o.n, tab ? objItems(e.o, true).map(a => ({ ...a, run: () => { sendText('\x1b'); setTimeout(a.run, 60); } })) : objItems(e.o, true)]; }
  const row = t.closest && t.closest('.inv .tr[data-key]');
  if (row && UI && UI.kind === 'items') { const it = UI.items.find(i => i.k === row.dataset.key); if (it && it.o) {
      const tab = UI.tabs.find(x => x.on) || UI.tabs[0], isWorn = tab && tab.loc === 1;
      const hs = !isWorn && hbFromObj(it.o);
      return [it.o.n, objItems(it.o, isWorn).map(a => ({ ...a, run: () => { sendText('\x1b'); setTimeout(a.run, 60); } })).concat(hs ? [{ k: 'h', n: 'Put on the hotbar', run: () => hbSet(-1, hs) }] : [])]; } }
  return null;
}
document.addEventListener('mousedown', ev => {
  const inMenu = ev.target.closest && ev.target.closest('#ctx');
  if (inMenu) { const ci = ev.target.closest('[data-ci]'); if (ci && ev.button === 0) ctxRun(+ci.dataset.ci); ev.stopPropagation(); ev.preventDefault(); return; }
  if (CTX) { ctxClose(); if (ev.button === 0) { ev.stopPropagation(); return; } }
  if (ev.button !== 2) return;
  const r = ctxTarget(ev); if (!r) return;
  ev.stopPropagation(); ev.preventDefault(); ctxOpen(r[0], r[1], ev);
}, true);
document.addEventListener('mousemove', ev => {
  if (!CTX) return; const ci = ev.target.closest && ev.target.closest('#ctx [data-ci]'); if (ci && +ci.dataset.ci !== CTX.sel) { CTX.sel = +ci.dataset.ci; ctxMark(); }
}, true);

/* ---------- drag and drop ----------
 * Drag a pack item onto the map to drop it, or onto your figure to wear it.
 * Drag something you wear onto the map to drop it. */
let DRAG = null;
function dragWhat(t) {
  const row = t.closest && t.closest('.inv .tr[data-key]');
  if (row && UI && UI.kind === 'items') { const it = UI.items.find(i => i.k === row.dataset.key), tab = UI.tabs.find(x => x.on) || UI.tabs[0];
    if (it && it.o) return { o: it.o, worn: !!(tab && tab.loc === 1), panel: row.closest('.npanel'), el: row }; }
  const w = t.closest && t.closest('[data-worn]');
  if (w && playing()) { const e = S.equip.find(e => e.k === w.dataset.worn); if (e && e.o) return { o: e.o, worn: true, el: w }; }
  return null;
}
const inRect = (el, x, y) => { if (!el) return false; const r = el.getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; };
function dropTarget(x, y) {
  const hb = hbDropAt(x, y); if (hb >= 0) return !DRAG.worn && hbFromObj(DRAG.o) ? { hb, n: 'Slot ' + HB_KEYS[hb] } : null;
  if (DRAG.panel && inRect(DRAG.panel, x, y)) return null;
  if (inRect($('.doll'), x, y)) { const tv = DRAG.o.tv; return !DRAG.worn && ((tv >= 19 && tv <= 23) || (tv >= 30 && tv <= 45)) ? { c: 'w', n: 'Wear' } : null; }
  if (inRect($('#map'), x, y)) return { c: 'd', n: 'Drop' };
  return null;
}
document.addEventListener('mousedown', ev => {
  if (ev.button !== 0 || CTX) return; const d = dragWhat(ev.target); if (!d) return;
  DRAG = { ...d, x: ev.clientX, y: ev.clientY, on: false };
}, true);
document.addEventListener('mousemove', ev => {
  if (!DRAG) return;
  if (!DRAG.on && Math.hypot(ev.clientX - DRAG.x, ev.clientY - DRAG.y) < 8) return;
  DRAG.on = true; showTip('', ev);
  const g = $('#drag'), t = dropTarget(ev.clientX, ev.clientY);
  g.innerHTML = `${t ? `<b>${t.n}</b> ` : ''}${esc(DRAG.o.n)}`; g.className = t ? 'ok' : '';
  g.style.display = 'block'; g.style.left = ev.clientX / SCALE + 14 + 'px'; g.style.top = ev.clientY / SCALE + 10 + 'px';
  document.body.classList.add('dragging');
}, true);
document.addEventListener('mouseup', ev => {
  if (!DRAG) return; const d = DRAG; DRAG = null; $('#drag').style.display = 'none'; document.body.classList.remove('dragging');
  if (!d.on) return;
  window.__noClick = Date.now();
  const t = (DRAG = d, dropTarget(ev.clientX, ev.clientY)); DRAG = null; if (!t) return;
  if (t.hb != null) { hbSet(t.hb, hbFromObj(d.o)); return; }
  if (d.panel) { sendText('\x1b'); setTimeout(() => cmdPick(t.c, d.o.n), 60); } else cmdPick(t.c, d.o.n);
}, true);
// a drag is not a click
document.addEventListener('click', ev => { if (window.__noClick && Date.now() - window.__noClick < 300) { ev.stopPropagation(); ev.preventDefault(); } }, true);
