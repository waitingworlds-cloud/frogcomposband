// Hotbar: ten slots for the spells and items you use most. Drag a spell card or a pack item onto a slot
// (or right-click one: "Put on the hotbar"), then click the slot or press Ctrl+1 ... Ctrl+0.
// A slot presses the same keys you would (cast key, book, spell; or quaff key, potion), but it finds the
// book, potion or spell by what it is each time, so it keeps working when the pack letters move.
'use strict';
const HB = { slots: Array(10).fill(null), no: [], fresh: false, who: null, mode: 'A' };
let LASTPICK = null;     // the item last chosen at one of the game's item prompts: { o, t }
let LASTCMD = null;      // the command key last pressed in play: { k, raw, t }
let SPELLPICK = null;    // after a hotbar cast opens the spell list, choose this spell: { n, t }
const HB_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

function hbLoad() {
  const who = S && S.p ? S.p.name : null; if (who === HB.who) return; HB.who = who;
  let v = null; try { v = JSON.parse(localStorage.getItem('hotbar:' + who)); } catch (e) {}
  if (Array.isArray(v)) v = { slots: v, no: [] };   // the first bars were a plain list
  HB.fresh = !v; HB.slots = v && Array.isArray(v.slots) && v.slots.length === 10 ? v.slots : Array(10).fill(null); HB.no = v && Array.isArray(v.no) ? v.no : [];
  HB_SEEN = null;
}
function hbSave() { try { localStorage.setItem('hotbar:' + HB.who, JSON.stringify({ slots: HB.slots, no: HB.no })); } catch (e) {} }
// a slot you clear is not filled again with the same thing by the bar's own suggestions
function hbClear(i) { const s = HB.slots[i]; if (s) { const id = hbId(s); if (!HB.no.includes(id)) HB.no.push(id); } HB.slots[i] = null; hbSave(); schedule(); }
const hbId = s => s.t === 'o' ? 'o:' + s.ki : 's:' + s.n;
function hbSet(i, s) { hbLoad(); if (i < 0) i = HB.slots.findIndex(x => !x); if (i < 0) i = 9; HB.slots[i] = s; hbSave(); schedule(); hbFlash(i); return i; }
let HB_FLASH = { i: -1, t: 0 };
function hbFlash(i) { HB_FLASH = { i, t: Date.now() }; setTimeout(schedule, 700); }

// what goes on a slot
const baseName = n => String(n).replace(/\s*\{[^}]*\}\s*$/, '').replace(/\s*\([^)]*\)/g, '').replace(/^(an?|the|\d+)\s+/i, '').trim();
function hbFromObj(o) {
  if (!o) return null; const a = objItems(o, false)[0]; if (!a || a.k === 'I') return null;
  return { t: 'o', c: a.k, verb: a.n, ki: o.ki, tv: o.tv, n: baseName(o.n) };
}
function hbFromSpell(r) {
  if (!r) return null;
  const c = !LASTCMD || /^[bPG]$/.test(LASTCMD.k) ? 'm' : LASTCMD.k;   // a list opened to browse or to study is cast with m
  const book = LASTPICK && Date.now() - LASTPICK.t < 120000 && LASTPICK.o.tv >= 90 && LASTPICK.o.tv <= 109 ? { ki: LASTPICK.o.ki, n: baseName(LASTPICK.o.n) } : null;
  return { t: 's', c, raw: !!(LASTCMD && LASTCMD.raw && c === LASTCMD.k), book, n: r.n, el: spElem(r.n) || '', cost: r.cost, unit: UI && UI.unit || 'SP' };
}

// using a slot
function hbUse(i) {
  hbLoad(); const s = HB.slots[i]; if (!s || !playing()) return;
  hbFlash(i);
  if (s.t === 'o') { PICK = { name: null, ki: s.ki, t: Date.now(), tabbed: 0 }; sendText(cmd(s.c)); return; }
  if (s.book) PICK = { name: null, ki: s.book.ki, t: Date.now(), tabbed: 0 };
  SPELLPICK = { n: s.n, t: Date.now() };
  sendText(s.raw ? s.c : cmd(s.c));
}
function hbOnUi(m) {
  if (m.kind === 'spells' && HB.who) { let ch = false; for (const s of HB.slots) { if (!s || s.t !== 's') continue; const r = (m.rows || []).find(r => r.n === s.n); if (r && r.cost != null && (s.cost !== r.cost || s.unit !== (m.unit || 'SP'))) { s.cost = r.cost; s.unit = m.unit || 'SP'; ch = true; } } if (ch) hbSave(); }
  if (!SPELLPICK || m.kind !== 'spells') return;
  const want = SPELLPICK; SPELLPICK = null; if (Date.now() - want.t > 5000) return;
  const r = (m.rows || []).find(r => r.n === want.n); if (r && r.k) sendText(r.k);
}
// remember what was picked and which command opened it, so a spell dragged from the list knows its book
function hbNote(bytes) {
  const top = typeof uiOnTop === 'function' && UI && uiOnTop();
  if (top && UI.kind === 'items' && bytes.length === 1) { const it = (UI.items || []).find(i => i.k === String.fromCharCode(bytes[0])); if (it && it.o) LASTPICK = { o: it.o, t: Date.now() }; return; }
  if (top || !playing()) return;
  if (bytes.length === 2 && bytes[0] === 92) LASTCMD = { k: String.fromCharCode(bytes[1]), raw: false, t: Date.now() };
  else if (bytes.length === 1 && bytes[0] > 32 && bytes[0] < 127) LASTCMD = { k: String.fromCharCode(bytes[0]), raw: true, t: Date.now() };
}

// how many you have, and whether it can be used now
function hbCount(s) { if (s.t !== 'o') return null; let n = 0; for (const o of S.pack || []) if (o.ki === s.ki) n += o.num; return !n && s.tv >= 16 && s.tv <= 18 ? null : n; }   // ammunition in the quiver is not in the pack list: leave it lit
function hbHave(s) { if (s.t === 'o') { const n = hbCount(s); return n == null || n > 0; } if (s.book) return (S.pack || []).some(o => o.ki === s.book.ki); return true; }
function hbShort(s) { if (s.t !== 's' || s.cost == null) return false; const have = s.unit === 'HP' ? S.p.hp : s.unit === 'au' ? S.p.au : S.p.sp; return s.cost > have; }

const SPARK = '<svg class="ic hbsp" viewBox="0 0 24 24"><path d="M12 1l2.6 7.400L22 12l-7.400 2.600L12 23l-2.600-8.400L2 12l7.400-3.600z"/></svg>';
function hbSlotHtml(s, i) {
  const key = HB_KEYS[i], fl = HB_FLASH.i === i && Date.now() - HB_FLASH.t < 600 ? ' fl' : '';
  if (!s) return `<div class="hbs empty${fl}" data-hb="${i}" data-tip="Empty slot&#10;drag a spell or an item here, or right-click one: Put on the hotbar"><div class="slot"><span class="key">${key}</span></div><span class="hbn"></span></div>`;
  const n = hbCount(s), have = hbHave(s), short = hbShort(s), need = have && !short ? hbNeed(s) : '';
  const pic = s.t === 'o' ? (artHtml(s.ki, 40) || icon(tvIcon(s.tv))) : `<span class="hbspell">${s.book ? artHtml(s.book.ki, 40) : ''}${SPARK}<b class="hbm">${esc(hbMono(s.n))}</b></span>`;
  const what = s.t === 'o' ? `${s.verb}: ${s.n}${n != null ? ` · ${n} with you` : ''}` : `Cast ${s.n}${s.cost != null ? ` · ${s.cost} ${s.unit === 'HP' ? 'life' : s.unit === 'au' ? 'gold' : 'mana'}` : ''}${s.book ? ` · from ${s.book.n}` : ''}`;
  return `<div class="hbs ${s.t === 's' ? 'sp' : ''}${have ? '' : ' none'}${short ? ' short' : ''}${need ? ' need' : ''}${fl}"${s.t === 's' ? ` style="--el:${s.el || '#ff9a4a'}"` : ''} data-hb="${i}" data-tip="${need ? esc(need) + '&#10;' : ''}${esc(what)}${have ? '' : s.t === 'o' ? ' · none with you' : ' · the book is not with you'}&#10;click or Ctrl+${key} · drag it off to clear it · right-click: more"><div class="slot">${pic}<span class="key">${key}</span>${n ? `<span class="cnt">${n}</span>` : ''}</div><span class="hbn">${esc(hbLabel(s))}</span></div>`;
}
// a short label under the slot: what a potion or scroll does, the thing itself otherwise ("Rations of Food" is rations)
function hbLabel(s) {
  if (s.t === 's') return s.n;
  const m = s.n.match(/^(?:Potions?|Scrolls?|Wands?|Staffs?|Staves|Rods?|Flasks?|Mushrooms?) of (.+)$/i); if (m) return m[1];
  return s.n.replace(/ of .*$/, '').replace(/\s*\(.*$/, '');
}
const hbMono = n => n.split(/\s+/).filter(w => !/^(of|the|a|an)$/i.test(w)).slice(0, 2).map(w => w[0]).join('').toUpperCase();
function hotbarHtml() {
  if (!S || !S.p) return ''; hbLoad();
  return `<div class="hbar ch hb${HB.mode}"><div class="hbin ch">${HB.slots.map(hbSlotHtml).join('')}</div></div>`;
}

// keys: Ctrl+1 ... Ctrl+0
function hotbarKey(e) {
  if (!e.ctrlKey || e.altKey || e.metaKey || !/^Digit[0-9]$/.test(e.code) || !playing()) return false;
  if (typeof uiOnTop === 'function' && UI && uiOnTop()) return false;
  hbUse((+e.code.slice(5) + 9) % 10); return true;
}

// the mouse: click uses, right-click offers, drag moves between slots or off to clear
document.addEventListener('click', ev => { const h = ev.target.closest && ev.target.closest('[data-hb]'); if (h && !(window.__noClick && Date.now() - window.__noClick < 300)) hbUse(+h.dataset.hb); });
function hbCtx(ev) {
  const h = ev.target.closest && ev.target.closest('[data-hb]');
  if (h && playing()) { hbLoad(); const i = +h.dataset.hb, s = HB.slots[i]; if (!s) return ['Hotbar slot ' + HB_KEYS[i], [{ k: '', n: 'Drag a spell or an item here', dim: true, run: () => {} }]];
    return [s.n, [{ k: 'u', n: s.t === 'o' ? s.verb : 'Cast', run: () => hbUse(i) }, { k: 'c', n: 'Clear this slot', run: () => hbClear(i) }]]; }
  const sp = ev.target.closest && ev.target.closest('.sprow[data-sp]');
  if (sp && UI && UI.kind === 'spells') { const r = UI.rows.find(r => r.n === sp.dataset.sp); if (r) return [r.n, [{ k: 'm', n: 'Cast it', run: () => sendText(r.k) }, { k: 'h', n: 'Put on the hotbar', run: () => hbSet(-1, hbFromSpell(r)) }]]; }
  return null;
}
function hbDropAt(x, y) { const els = document.querySelectorAll('[data-hb]'); for (const el of els) if (inRect(el, x, y)) return +el.dataset.hb; return -1; }
// drags that start on a spell card or a hotbar slot (pack items come through ctx.js's drag)
let HBDRAG = null;
document.addEventListener('mousedown', ev => {
  if (ev.button !== 0 || CTX) return;
  const h = ev.target.closest && ev.target.closest('[data-hb]');
  if (h) { hbLoad(); const i = +h.dataset.hb; if (HB.slots[i]) HBDRAG = { from: i, s: HB.slots[i], x: ev.clientX, y: ev.clientY, on: false }; return; }
  const sp = ev.target.closest && ev.target.closest('.sprow[data-sp]');
  if (sp && UI && UI.kind === 'spells') { const r = UI.rows.find(r => r.n === sp.dataset.sp); if (r) HBDRAG = { from: -1, s: hbFromSpell(r), x: ev.clientX, y: ev.clientY, on: false }; }
}, true);
document.addEventListener('mousemove', ev => {
  if (!HBDRAG) return;
  if (!HBDRAG.on && Math.hypot(ev.clientX - HBDRAG.x, ev.clientY - HBDRAG.y) < 8) return;
  HBDRAG.on = true; showTip('', ev);
  const i = hbDropAt(ev.clientX, ev.clientY), g = $('#drag');
  g.innerHTML = i >= 0 ? `<b>Slot ${HB_KEYS[i]}</b> ${esc(HBDRAG.s.n)}` : HBDRAG.from >= 0 ? `<b>Clear</b> ${esc(HBDRAG.s.n)}` : esc(HBDRAG.s.n);
  g.className = i >= 0 || HBDRAG.from >= 0 ? 'ok' : ''; g.style.display = 'block'; g.style.left = ev.clientX / SCALE + 14 + 'px'; g.style.top = ev.clientY / SCALE + 10 + 'px';
  document.body.classList.add('dragging');
  document.querySelectorAll('[data-hb]').forEach(el => el.classList.toggle('drop', +el.dataset.hb === i));
}, true);
document.addEventListener('mouseup', ev => {
  if (!HBDRAG) return; const d = HBDRAG; HBDRAG = null;
  document.querySelectorAll('[data-hb].drop').forEach(el => el.classList.remove('drop'));
  if (!d.on) return;
  $('#drag').style.display = 'none'; document.body.classList.remove('dragging'); window.__noClick = Date.now();
  const i = hbDropAt(ev.clientX, ev.clientY);
  if (d.from >= 0) { if (i === d.from) return; if (i < 0) { hbClear(d.from); return; } const t = HB.slots[i]; HB.slots[i] = d.s; HB.slots[d.from] = t; hbSave(); schedule(); hbFlash(i); return; }
  if (i >= 0) hbSet(i, d.s);
}, true);

/* ---------- the smart part ----------
 * Each slot has a job: healing, getting away, food, mana. When that job is wanted (life low, something deadly
 * close, hungry, out of mana) the slot pulses and its tip says why. A new character's bar starts with the
 * useful things in the pack, a useful find goes into an empty slot, and so does a spell you learn that heals,
 * gets you away or hurts things. Anything you clear stays cleared. */
const HB_HEAL = /Cure (Light|Serious|Critical) Wounds|^\*?Healing\*?$|^Life$|Curing|Neutralize Poison|Heroism|Berserk|Regenerat/i;
const HB_ESC = /Phase Door|^Teleport(ation)?$|Teleport Self|Teleport Level|Blink|Getaway|Escape|Dimension Door/i;
const HB_HURT = /Missile|Bolt|Ball|Blast|Strike|Orb|Spear|Arrow|Stinking Cloud|Lightning|Nether|Fire|Frost|Acid|Mana Storm|Shard|Wave/i;
function hbRole(s) {
  const n = s.t === 'o' ? hbLabel(s) : s.n;
  if (s.t === 'o') {
    if (s.tv === 80) return 'food';
    if (s.tv === 75 && /Restore Mana/i.test(n)) return 'mana';
    if (s.tv === 75 && HB_HEAL.test(n)) return 'heal';
    if (s.tv === 70 && HB_ESC.test(n)) return 'escape';
    if (s.tv === 70 && /Word of Recall/i.test(n)) return 'recall';
    return '';
  }
  if (/Satisfy Hunger|Create Food|Nourish/i.test(n)) return 'food';
  if (HB_HEAL.test(n) || /^Cure|Heal/i.test(n)) return 'heal';
  if (HB_ESC.test(n)) return 'escape';
  if (HB_HURT.test(n)) return 'hurt';
  return '';
}
function hbStatus() { const sb = S.rstatus; return sb && sb[1] < G.h ? (G.s[sb[1]] || '').substr(sb[0], sb[2]).replace(/\x01/g, ' ') : ''; }
function hbNeed(s) {
  if (!S || !S.p) return ''; const p = S.p, life = p.mhp ? p.hp / p.mhp : 1, st = hbStatus(), role = hbRole(s);
  if (role === 'heal') { if (life <= .5) return 'Your life is low'; const m = st.match(/Poison|Blind|Confus|Stun|Graze|Cut|Gash|Wound|Afraid|Scared/i); if (m) return 'You are ' + ({ poison: 'poisoned', blind: 'blind', confus: 'confused', stun: 'stunned', afraid: 'afraid', scared: 'afraid' }[m[0].toLowerCase()] || 'bleeding'); }
  if (role === 'escape') { if (life <= .3) return 'Your life is very low: get away'; if ((S.mons || []).some(m => m.los && !m.asleep && threat(m) === 'deadly')) return 'Something far beyond you is close'; }
  if (role === 'food' && /Hungry|Weak|Faint|Starv/i.test(st)) return 'You are hungry';
  if (role === 'mana' && p.msp > 0 && p.sp / p.msp <= .2) return 'Your mana is low';
  return '';
}
// on every state: fill a fresh bar, add useful finds and learned spells, quietly
let HB_SEEN = null;
function hbOnState() {
  if (!S || !S.p || !S.pack || !playing()) return; hbLoad(); let added = [];
  const has = id => HB.slots.some(x => x && hbId(x) === id), free = () => HB.slots.findIndex(x => !x);
  const put = s => { const i = free(); if (i < 0 || has(hbId(s)) || HB.no.includes(hbId(s))) return; HB.slots[i] = s; added.push([i, s]); };
  // useful things in the pack: healing first, then getting away, recall, mana, one kind of food
  const pick = S.pack.map(o => hbFromObj(o)).filter(Boolean).map(s => [s, hbRole(s)]).filter(([, r]) => r && r !== 'hurt');
  const order = { heal: 0, escape: 1, recall: 2, mana: 3, food: 4 };
  pick.sort((a, b) => order[a[1]] - order[b[1]]);
  for (const [sl, r] of pick) { if (r === 'food' && HB.slots.some(x => x && hbRole(x) === 'food')) continue; put(sl); }
  // spells just learned
  const msgs = S.msgs || [], key = m => m.turn + '|' + m.s;
  if (!HB_SEEN) HB_SEEN = new Set(msgs.map(key));   // what was already in the log when the bar loaded is history
  else for (const m of msgs) { if (HB_SEEN.has(key(m))) continue; HB_SEEN.add(key(m));
    const lm = plain(m.s).match(/You have learned the (?:spell|prayer|technique|power|ritual) of (.+?)\./i); if (!lm) continue;
    const r = hbFromSpell({ n: lm[1], cost: null }); r.c = 'm'; r.raw = false; if (hbRole(r)) put(r); }
  HB.fresh = false;
  if (added.length) { hbSave(); for (const [i] of added) hbFlash(i); if (typeof postToast === 'function') postToast(added.length === 1 ? `Hotbar ${HB_KEYS[added[0][0]]}: ${hbLabel(added[0][1])} (drag it off to clear it)` : `Hotbar: added ${added.map(([i, s]) => HB_KEYS[i] + ' ' + hbLabel(s)).join(', ')}`); }
}
