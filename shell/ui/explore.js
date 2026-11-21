// Exploring: walk to the nearest edge of what you know, again and again, until something turns up.
// x starts it (the original keyset leaves x unused), or right-click yourself; any key or click stops it.
'use strict';
const EXP = { on: false, pos: '', still: 0, tgt: '', same: 0, bad: {}, hp: 0, items: null, timer: 0 };
const EXP_AVOID = { wall: 1, rubble: 1, pit: 1, lava: 1, water: 1, trap: 1, shop: 1 };   // a shop door is only stepped on when it is where you are going

// what you have seen on this level, kept here: the game forgets dark floor once your light moves on
const EXP_MEM = { lvl: '', m: new Map() };
function exploreRemember() {
  const lvl = S.p.place + '|' + S.p.dlvl + '|' + (S.p.depth || 0); if (lvl !== EXP_MEM.lvl) { EXP_MEM.lvl = lvl; EXP_MEM.m = new Map(); }
  const mw = S.map.w, sx = mw >> 1, sy = S.map.h >> 1, cells = S.map.c;
  for (let i = 0; i < cells.length; i++) { const c = cells[i]; if (!c || !c[0]) continue; EXP_MEM.m.set((S.px + i % mw - sx) + ',' + (S.py + ((i / mw) | 0) - sy), EXP_AVOID[featClass(c[0])] ? 0 : 1); }
}
// the first step towards the nearest remembered square you can walk to that touches the unknown
function exploreStep() {
  // walking to a goal may cross squares you have never seen (near the straight way there): bumping a wall there just finds another way
  const box = EXP.goal ? (([gx, gy]) => [Math.min(gx, S.px) - 6, Math.min(gy, S.py) - 6, Math.max(gx, S.px) + 6, Math.max(gy, S.py) + 6])(EXP.goal.split(',').map(Number)) : null;
  const M = EXP_MEM.m, k = (x, y) => x + ',' + y, start = k(S.px, S.py), prev = new Map([[start, null]]), q = [[S.px, S.py]];
  for (let h = 0; h < q.length; h++) {
    const [x, y] = q[h];
    if (h && EXP.goal) { if (k(x, y) === EXP.goal) { let cur = k(x, y), p; while ((p = prev.get(cur)) !== start) cur = p; const [fx, fy] = cur.split(',').map(Number); return { dx: fx - S.px, dy: fy - S.py, goal: EXP.goal }; } }
    else if (h && !EXP.bad[k(x, y)]) { let edge = false; for (let dy = -1; dy <= 1 && !edge; dy++) for (let dx = -1; dx <= 1; dx++) if (!M.has(k(x + dx, y + dy))) { edge = true; break; }
      if (edge) { let cur = k(x, y), p; while ((p = prev.get(cur)) !== start) cur = p; const [fx, fy] = cur.split(',').map(Number); return { dx: fx - S.px, dy: fy - S.py, goal: k(x, y) }; } }
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const nk = k(x + dx, y + dy); if ((M.get(nk) === 1 || nk === EXP.goal || (box && !M.has(nk) && x + dx >= box[0] && x + dx <= box[2] && y + dy >= box[1] && y + dy <= box[3])) && !prev.has(nk)) { prev.set(nk, k(x, y)); q.push([x + dx, y + dy]); } }
  }
  return null;
}
const EXP_JUNK = /\b(Corpse|Skeleton|Skull|Statue|Shard of Pottery|Broken (Stick|Bone)|Empty Bottle|Canine tooth)s?\b/i;   // not worth the walk
const expAsk = () => /-more-|Press Space to continue|\?\s*$|\[y\/n\]|:\s*$/.test(msgTop());
const expFoes = () => S.mons.filter(m => !m.pet && !m.friendly);
// what holds explore back: a sleeper right beside you, or an awake creature you can see or that is close. One only sensed through the walls, far off, does not.
const expThreat = m => m.asleep ? m.dist <= 2 : !!(m.los || m.dist <= 5);
const expItems = () => new Set(S.floor.map(o => (S.px + o.dx) + ',' + (S.py + o.dy) + ',' + o.n));
function exploreStart() {
  if (!playing() || EXP.on) return;
  // a creature asleep some way off does not hold you here: explore goes on and stops if it wakes or you come up beside it
  const foes = expFoes(), near = foes.filter(expThreat).sort((a, b) => a.dist - b.dist)[0];
  if (near) { postToast(near.asleep ? cap(near.n.replace(/^(an?|the) /i, '')) + ' sleeps right beside you' : 'Not while ' + near.n.replace(/^(an?) /i, 'the ') + ' is awake in sight'); return; }
  if (S.p.dlvl && (S.equip || []).some(e => e.slot === 'Light' && !e.o)) { postToast('You carry no light: wield a torch first'); return; }
  Object.assign(EXP, { on: true, goal: '', fetch: '', seen: null, sleep: new Set(foes.filter(f => f.asleep && f.los).map(f => f.i)), jam: {}, chase: null, pos: '', still: 0, fail: 0, tgt: '', bad: {}, hp: S.p.hp, items: expItems() }); exploreRemember();
  postToast(foes.some(f => f.asleep && f.los) ? 'Exploring quietly past the sleeper · any key stops' : 'Exploring · any key stops'); clearInterval(EXP.timer); EXP.timer = setInterval(exploreTick, 90);
}
// walk to a square (or after a creature) the game cannot route to because it forgot the dark floor between; false when no remembered way
function exploreGoto(dx, dy, mon) {
  if (!playing() || !S.map) return false; exploreRemember();
  const goal = (S.px + dx) + ',' + (S.py + dy); Object.assign(EXP, { goal, fetch: '', chase: mon ? mon.i : null, bad: {} });
  const st = exploreStep(); if (!st) { EXP.goal = ''; return false; }
  exploreStop(); Object.assign(EXP, { on: true, goal, fetch: '', sleep: null, chase: mon ? mon.i : null, seen: new Set(expFoes().map(f => f.i)), pos: '', still: 0, fail: 0, tgt: '', bad: {}, hp: S.p.hp, items: expItems() });
  clearInterval(EXP.timer); EXP.timer = setInterval(exploreTick, 90); exploreTick(); return true;
}
function exploreStop(why) { if (!EXP.on) return; EXP.on = false; clearInterval(EXP.timer); if (why) postToast(why); }
function exploreTick() {
  if (!EXP.on || !S || !S.map) return exploreStop();
  if (G.icky || G.ov || expAsk()) return exploreStop();   // a prompt or a -more- wants you
  if (EXP.chase != null) {   // after a creature: follow it, and stop next to it (or next to anything else that is hostile)
    const m = S.mons.find(m => m.i === EXP.chase);
    if (m) EXP.goal = (S.px + m.dx) + ',' + (S.py + m.dy); else EXP.chase = null;   // lost sight of it: carry on to where it was
  }
  if (EXP.goal && expFoes().some(f => f.dist <= 1)) return exploreStop();
  if (EXP.chase == null) {
    const slp = EXP.sleep, f = expFoes().filter(m => !(slp && slp.has(m.i) && m.asleep && m.dist > 1) && (m.los || m.dist <= 5)).sort((a, b) => a.dist - b.dist)[0];
    if (f && !(EXP.goal && !EXP.fetch && EXP.seen && EXP.seen.has(f.i))) { if (typeof sndPlay === 'function') sndPlay('warn'); return exploreStop(cap(f.n) + (slp && slp.has(f.i) ? (f.asleep ? ' sleeps right beside you' : ' wakes up') : f.asleep ? ' sleeps ahead' : ' comes into view')); }
  }
  if (S.p.hp < EXP.hp) return exploreStop('You are hurt');
  EXP.hp = S.p.hp;
  const roam = !EXP.goal || !!EXP.fetch;   // exploring (and fetching what it finds), as against walking to a place you clicked
  if (!roam) for (const k of expItems()) if (!EXP.items.has(k)) return exploreStop('You see ' + k.split(',').slice(2).join(','));
  exploreRemember();
  const pos = S.px + ',' + S.py;
  if (roam) {
    // exploring picks up what it finds: walk to the nearest thing lying about, take it, and carry on
    if (EXP.gotLvl !== EXP_MEM.lvl || !EXP.got) { EXP.gotLvl = EXP_MEM.lvl; EXP.got = new Set(); }
    if (EXP.fetch && pos === EXP.goal) {
      const here = S.floor.filter(o => !o.dx && !o.dy); EXP.got.add(EXP.fetch); EXP.fetch = ''; EXP.goal = '';
      if (here.length) { for (const o of here) EXP.got.add(pos + ',' + o.n); sendText(cmd('g')); EXP.pos = ''; EXP.still = 0; return; }
    }
    if (!EXP.fetch) {
      const o = S.floor.filter(o => (o.dx || o.dy) && !EXP_JUNK.test(o.n) && !EXP.got.has((S.px + o.dx) + ',' + (S.py + o.dy) + ',' + o.n) && EXP_MEM.m.get((S.px + o.dx) + ',' + (S.py + o.dy)) !== 0)
        .sort((a, b) => Math.max(Math.abs(a.dx), Math.abs(a.dy)) - Math.max(Math.abs(b.dx), Math.abs(b.dy)))[0];
      if (o) { EXP.fetch = (S.px + o.dx) + ',' + (S.py + o.dy) + ',' + o.n; EXP.goal = (S.px + o.dx) + ',' + (S.py + o.dy); EXP.fail = 0; }
    }
  }
  const dropFetch = () => { EXP.got.add(EXP.fetch); EXP.fetch = ''; EXP.goal = ''; EXP.fail = 0; };
  if (EXP.goal && pos === EXP.goal) return exploreStop();
  if (pos === EXP.pos && ++EXP.still < 4) return;   // the last step has not landed yet
  const jam = /door appears to be stuck/i.test(msgTop());   // a jammed door will not give to more of the same: leave it after a few tries, and do not come back to it
  if (pos === EXP.pos) { if (++EXP.fail >= (jam ? 3 : EXP.door ? 14 : EXP.goal ? 8 : 3) && EXP.tgt) { if (EXP.fetch) dropFetch(); else if (EXP.goal) return exploreStop(jam ? 'The door is stuck fast' : 'Something is in the way'); else { EXP.bad[EXP.tgt] = 1; if (jam) (EXP.jam = EXP.jam || {})[EXP.tgt] = 1; } EXP.fail = 0; } } else EXP.fail = 0;   // a door opening costs a step; a wall that will not give, the goal is dropped
  if (pos === EXP.tgt && !EXP.goal) EXP.bad[EXP.tgt] = 1;   // stood there and the unknown beside it stayed unknown: nothing more to see from it
  EXP.pos = pos; EXP.still = 0;
  let st = exploreStep();
  if (EXP_MEM.m.size !== EXP.size) { EXP.size = EXP_MEM.m.size; EXP.retried = false; }
  if (!st && EXP.fetch) { dropFetch(); st = exploreStep(); }   // no way to it: leave it and explore on
  if (!st && EXP.goal) return exploreStop('No way there that you know');
  if (!st && !EXP.retried && Object.keys(EXP.bad).length) { EXP.bad = Object.assign({}, EXP.jam); EXP.retried = true; st = exploreStep(); }   // before giving up, try the places set aside once more
  if (!st) { EXP.doneLvl = EXP_MEM.lvl; schedule(); return exploreStop('Nothing more to explore that you can reach'); }
  // a locked door can take several tries to open: give it time before giving up on it
  { const mw = S.map.w, c = S.map.c[((S.map.h >> 1) + st.dy) * mw + (mw >> 1) + st.dx]; EXP.door = !!(c && c[0] && featClass(c[0]) === 'door'); }
  EXP.tgt = st.goal; sendRaw(`M 1 ${st.dx} ${st.dy}`);
}
function exploreKey(e) {
  if (EXP.on) { exploreStop(); if (e.key === 'Escape' || e.key === 'x') return true; return false; }   // any key stops it; Escape and x only stop
  if (e.key === 'x' && !e.ctrlKey && !e.altKey && !e.metaKey && S && S.p && !S.p.rl && playing() && !expAsk() && !(UI && uiOnTop()) && !lookMode() && !aimMode() && !/\]\s*$/.test((G.s[0] || '').replace(/\x01/g, ' ').trim())) { exploreStart(); return true; }
  return false;
}
addEventListener('mousedown', e => { if (EXP.on && !(e.target.closest && e.target.closest('[data-explore]'))) exploreStop(); }, { capture: true });
