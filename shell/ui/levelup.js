// Level-up card: when you gain a level, a card over the map says what you gained (life, mana, stats),
// what the game told you about it, and which spells you have reached, with a button to learn them.
// It stays until you close it or play on for a few turns; keys keep going to the game.
'use strict';
const LV = { el: null, turns: 0, data: null };
let SPELLBOOK = null;   // spells seen in lists, by name: { lvl, book } (kept per character)
function spellsLoad() { const who = S && S.p ? S.p.name : ''; if (SPELLBOOK && SPELLBOOK.who === who) return; let v = null; try { v = JSON.parse(localStorage.getItem('spells:' + who)); } catch (e) {} SPELLBOOK = { who, all: v || {} }; }
function lvlOnUi(m) {
  if (m.kind !== 'spells' || !S || !S.p) return; spellsLoad(); let ch = false;
  const book = LASTPICK && Date.now() - LASTPICK.t < 120000 && LASTPICK.o.tv >= 90 && LASTPICK.o.tv <= 109 ? baseName(LASTPICK.o.n) : '';
  for (const r of m.rows || []) if (r.n && r.lvl != null) { const o = SPELLBOOK.all[r.n]; if (!o || o.lvl !== r.lvl || (book && o.book !== book)) { SPELLBOOK.all[r.n] = { lvl: r.lvl, book: book || (o && o.book) || '' }; ch = true; } }
  if (ch) try { localStorage.setItem('spells:' + SPELLBOOK.who, JSON.stringify(SPELLBOOK.all)); } catch (e) {}
}
const LV_STATS = ['Strength', 'Intelligence', 'Wisdom', 'Dexterity', 'Constitution', 'Charisma'];
function lvlOnState(prev, cur) {
  if (LV.data) { LV.turns++; if (LV.turns > 40 && !(LV.el && LV.el.matches(':hover'))) lvlClose(); else lvlDraw(); }
  if (!prev || !prev.p || !cur || !cur.p || cur.p.name !== prev.p.name || !(cur.p.lev > prev.p.lev)) return;
  const p = cur.p, q = prev.p, gains = [];
  if (p.mhp > q.mhp) gains.push(['life', `+${p.mhp - q.mhp}`, `${p.mhp} in all`]);
  if (p.msp > q.msp) gains.push(['mana', `+${p.msp - q.msp}`, `${p.msp} in all`]);
  (p.stats || []).forEach((s, i) => { const a = String(s).trim(), b = String((q.stats || [])[i] || '').trim(); if (a !== b && b) gains.push([LV_STATS[i].toLowerCase(), a, `was ${b}`]); });
  if (p.ac !== q.ac) gains.push(['armour', (p.ac > q.ac ? '+' : '') + (p.ac - q.ac), `${p.ac} in all`]);
  if (p.speed !== q.speed) gains.push(['speed', (p.speed > q.speed ? '+' : '') + (p.speed - q.speed), '']);
  spellsLoad();
  const reach = Object.entries(SPELLBOOK.all).filter(([, v]) => v.lvl > q.lev && v.lvl <= p.lev).map(([n, v]) => ({ n, book: v.book }));
  const t = cur.msgs && cur.msgs.length ? cur.msgs[cur.msgs.length - 1].turn : 0;
  LV.data = { lev: p.lev, from: q.lev, gains, reach, turn: t }; LV.turns = 0; lvlDraw(true);
}
function lvlSaid() {   // what the game said on the turn you went up, but the level line itself
  if (!LV.data || !S || !S.msgs) return [];
  return S.msgs.filter(m => m.turn >= LV.data.turn && !/Welcome to level|You feel something in the air/i.test(plain(m.s))).map(m => plain(m.s)).filter(s => /learn|power|feel|can now|gain|new|ability|mutat/i.test(s)).slice(-4);
}
function lvlDraw(fresh) {
  const d = LV.data; if (!d) return;
  if (!LV.el) { LV.el = document.createElement('div'); LV.el.id = 'lvlcard'; document.getElementById('stage').appendChild(LV.el); }
  const study = typeof CAN_STUDY !== 'undefined' && CAN_STUDY;
  const said = lvlSaid();
  LV.el.innerHTML = `<div class="lvc ch"><div class="lvi ch">
    <div class="lvh"><div class="lvn">${d.lev}</div><div><b>Level ${d.lev}</b><span>${esc([S.p.race, S.p.cls].filter(Boolean).join(' '))}${d.lev - d.from > 1 ? ` · up ${d.lev - d.from} levels` : ''}</span></div><span class="grow"></span><span class="lvx" data-lvx="1" data-tip="Close (or just play on)">×</span></div>
    ${d.gains.length ? `<div class="lvg">${d.gains.map(([k, v, s]) => `<div class="lvgi"><b>${esc(v)}</b><span>${esc(k)}</span>${s ? `<i>${esc(s)}</i>` : ''}</div>`).join('')}</div>` : ''}
    ${d.reach.length ? `<div class="lvs"><div class="dsch">spells now within reach</div>${d.reach.map(r => `<div class="lvsp"><span class="hbsp-i">${SPARK}</span><b>${esc(r.n)}</b>${r.book ? `<i>${esc(r.book)}</i>` : ''}</div>`).join('')}</div>` : ''}
    ${said.length ? `<div class="lvsaid">${said.map(s => `<div>${esc(s)}</div>`).join('')}</div>` : ''}
    <div class="lvb">${study ? `<span class="btn go" data-key="\\G" data-tip="Study: pick a book, then the spell">Learn new spells</span>` : ''}<span class="btn" data-key="\\C">Character sheet</span><span class="btn" data-lvx="1">Close</span></div></div></div>`;
  if (fresh) { LV.el.classList.remove('in'); void LV.el.offsetWidth; LV.el.classList.add('in'); }
}
function lvlClose() { LV.data = null; if (LV.el) LV.el.innerHTML = ''; }
document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-lvx]')) lvlClose(); else if (e.target.closest && e.target.closest('#lvlcard [data-key]')) setTimeout(lvlClose, 50); });
