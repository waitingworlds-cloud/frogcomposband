// Exploring: walk to the nearest edge of what you know, again and again, until something turns up.
// x starts it (the original keyset leaves x unused), or right-click yourself; any key or click stops it.
'use strict';
const EXP = { on: false, pos: '', still: 0, tgt: '', same: 0, bad: {}, hp: 0, items: null, timer: 0 };
const EXP_AVOID = { wall: 1, rubble: 1, pit: 1, lava: 1, water: 1, trap: 1 };

// what you have seen on this level, kept here: the game forgets dark floor once your light moves on
const EXP_MEM = { lvl: '', m: new Map() };
function exploreRemember() {
  const lvl = S.p.place + '|' + S.p.dlvl + '|' + (S.p.depth || 0); if (lvl !== EXP_MEM.lvl) { EXP_MEM.lvl = lvl; EXP_MEM.m = new Map(); }
  const mw = S.map.w, sx = mw >> 1, sy = S.map.h >> 1, cells = S.map.c;
  for (let i = 0; i < cells.length; i++) { const c = cells[i]; if (!c || !c[0]) continue; EXP_MEM.m.set((S.px + i % mw - sx) + ',' + (S.py + ((i / mw) | 0) - sy), EXP_AVOID[featClass(c[0])] ? 0 : 1); }
}
// the first step towards the nearest remembered square you can walk to that touches the unknown
function exploreStep() {
  const M = EXP_MEM.m, k = (x, y) => x + ',' + y, start = k(S.px, S.py), prev = new Map([[start, null]]), q = [[S.px, S.py]];
  for (let h = 0; h < q.length; h++) {
    const [x, y] = q[h];
    if (h && !EXP.bad[k(x, y)]) { let edge = false; for (let dy = -1; dy <= 1 && !edge; dy++) for (let dx = -1; dx <= 1; dx++) if (!M.has(k(x + dx, y + dy))) { edge = true; break; }
      if (edge) { let cur = k(x, y), p; while ((p = prev.get(cur)) !== start) cur = p; const [fx, fy] = cur.split(',').map(Number); return { dx: fx - S.px, dy: fy - S.py, goal: k(x, y) }; } }
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const nk = k(x + dx, y + dy); if (M.get(nk) === 1 && !prev.has(nk)) { prev.set(nk, k(x, y)); q.push([x + dx, y + dy]); } }
  }
  return null;
}
const expAsk = () => /-more-|\?\s*$|\[y\/n\]|:\s*$/.test((G.s[0] || '').replace(/\x01/g, ' ').trim());
const expFoes = () => S.mons.filter(m => !m.pet && !m.friendly);
const expItems = () => new Set(S.floor.map(o => (S.px + o.dx) + ',' + (S.py + o.dy) + ',' + o.n));
function exploreStart() {
  if (!playing() || EXP.on) return;
  if (expFoes().length) { postToast('Not while something is in sight'); return; }
  if (S.p.dlvl && (S.equip || []).some(e => e.slot === 'Light' && !e.o)) { postToast('You carry no light: wield a torch first'); return; }
  Object.assign(EXP, { on: true, pos: '', still: 0, fail: 0, tgt: '', bad: {}, hp: S.p.hp, items: expItems() }); exploreRemember();
  postToast('Exploring · any key stops'); clearInterval(EXP.timer); EXP.timer = setInterval(exploreTick, 90);
}
function exploreStop(why) { if (!EXP.on) return; EXP.on = false; clearInterval(EXP.timer); if (why) postToast(why); }
function exploreTick() {
  if (!EXP.on || !S || !S.map) return exploreStop();
  if (G.icky || G.ov || expAsk()) return exploreStop();   // a prompt or a -more- wants you
  { const f = expFoes().sort((a, b) => a.dist - b.dist)[0]; if (f) return exploreStop(cap(f.n) + ' comes into view'); }
  if (S.p.hp < EXP.hp) return exploreStop('You are hurt');
  EXP.hp = S.p.hp;
  for (const k of expItems()) if (!EXP.items.has(k)) return exploreStop('You see ' + k.split(',').slice(2).join(','));
  exploreRemember();
  const pos = S.px + ',' + S.py;
  if (pos === EXP.pos && ++EXP.still < 4) return;   // the last step has not landed yet
  if (pos === EXP.pos) { if (++EXP.fail >= (EXP.door ? 14 : 3) && EXP.tgt) { EXP.bad[EXP.tgt] = 1; EXP.fail = 0; } } else EXP.fail = 0;   // a door opening costs a step; a wall that will not give, the goal is dropped
  if (pos === EXP.tgt) EXP.bad[EXP.tgt] = 1;   // stood there and the unknown beside it stayed unknown: nothing more to see from it
  EXP.pos = pos; EXP.still = 0;
  let st = exploreStep();
  if (EXP_MEM.m.size !== EXP.size) { EXP.size = EXP_MEM.m.size; EXP.retried = false; }
  if (!st && !EXP.retried && Object.keys(EXP.bad).length) { EXP.bad = {}; EXP.retried = true; st = exploreStep(); }   // before giving up, try the places set aside once more
  if (!st) return exploreStop('Nothing more to explore that you can reach');
  // a locked door can take several tries to open: give it time before giving up on it
  { const mw = S.map.w, c = S.map.c[((S.map.h >> 1) + st.dy) * mw + (mw >> 1) + st.dx]; EXP.door = !!(c && c[0] && featClass(c[0]) === 'door'); }
  EXP.tgt = st.goal; sendRaw(`M 1 ${st.dx} ${st.dy}`);
}
function exploreKey(e) {
  if (EXP.on) { exploreStop(); if (e.key === 'Escape' || e.key === 'x') return true; return false; }   // any key stops it; Escape and x only stop
  if (e.key === 'x' && !e.ctrlKey && !e.altKey && !e.metaKey && S && S.p && !S.p.rl && playing() && !expAsk() && !(UI && uiOnTop())) { exploreStart(); return true; }
  return false;
}
addEventListener('mousedown', e => { if (EXP.on && !(e.target.closest && e.target.closest('[data-explore]'))) exploreStop(); }, { capture: true });
