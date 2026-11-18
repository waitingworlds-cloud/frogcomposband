// Feel: smooth steps, hit flashes, floating numbers, screen shake, low-health warning.
// Everything here is drawn from changes between two game states; it never delays a key press.
'use strict';
const FX = { scroll: null, mons: {}, floats: [], puffs: [], flash: {}, shake: null, lunge: {}, on: true, parts: [], rings: [], seen: {}, lastProj: 0 };
const now = () => FX.freeze || performance.now();   // FX.freeze pins the clock (used when testing)
const ease = t => 1 - (1 - t) * (1 - t);
const STEP_MS = 95, HIT_MS = 55, HOLD_MS = 45, BACK_MS = 90;   // lunge out, hold on the hit, settle back

function fxOnState(prev, cur) {
  if (!FX.on || !prev || !prev.map || !cur.map || !prev.p || !cur.p) return;
  const t = now(), same = prev.p.place === cur.p.place && prev.p.dlvl === cur.p.dlvl;
  const mx = cur.px - prev.px, my = cur.py - prev.py, near = same && Math.abs(mx) <= 2 && Math.abs(my) <= 2;
  fxSelf(prev, cur, same, near);
  // death: the world drains of colour and the fall is named
  document.body.classList.toggle('dying', cur.p.hp < 0);
  if (cur.p.hp < 0 && prev.p.hp >= 0) { fxBanner('You die', 'the light goes out', 'death'); FX.shake = { t, amp: 10, ms: 600 }; }
  if (!same && cur.p.place !== 'Surface') fxBanner(cur.p.place || 'Somewhere new', cur.p.dlvl ? `Level ${cur.p.dlvl} · ${(cur.p.dlvl * 50).toLocaleString()} ft` : '');   // a new level or place: name it, as a film names its scenes
  if (same && typeof rectText === 'function' && cur.reff) fxAura(cur, rectText(cur.reff).filter(Boolean).map(r => r.text).join('|'));
  if (!near) { FX.scroll = null; FX.mons = {}; FX.floats = []; FX.puffs = []; FX.lunge = {}; return; }
  if (mx || my) FX.scroll = { dx: mx, dy: my, t };
  if (mx || my) sndPlay('walk');
  // creatures: slide to their new square, flash when hurt, puff when gone
  const old = {}; for (const m of prev.mons) old[m.i] = m;
  // what the game just said: a telling blow earns the crit look
  const seenTurn = prev.msgs && prev.msgs.length ? prev.msgs[prev.msgs.length - 1] : null, fresh = [];
  for (let i = (cur.msgs || []).length - 1; i >= 0 && fresh.length < 6; i--) { const m = cur.msgs[i]; if (seenTurn && m.turn === seenTurn.turn && m.s === seenTurn.s) break; fresh.push(String(m.s).replace(/<\/?color[^>]*>/g, '')); }
  const said = fresh.join(' '), crit = /(good|great|superb|\*GREAT\*|\*SUPERB\*) hit|backstab|cruelly attack|ruthlessly sneak|critical/i.test(said);
  let beats = 0;
  const seen = {};
  for (const m of cur.mons) {
    seen[m.i] = 1; const o = old[m.i]; if (!o || o.r !== m.r) continue;
    const ax = cur.px + m.dx, ay = cur.py + m.dy, bx = prev.px + o.dx, by = prev.py + o.dy;
    if ((ax !== bx || ay !== by) && Math.abs(ax - bx) <= 2 && Math.abs(ay - by) <= 2) FX.mons[m.i] = { dx: bx - ax, dy: by - ay, t };
    const lost = (o.rh != null && m.rh != null) ? o.rh - m.rh : (m.hp < o.hp ? 1 : 0);
    if (lost > 0) {
      // we strike: lean into the blow when it is next to us, then the flash and number land on the hit
      const melee = Math.abs(m.dx) <= 1 && Math.abs(m.dy) <= 1 && !mx && !my, at = melee ? t + HIT_MS : t;
      if (melee) FX.lunge.p = { dx: m.dx, dy: m.dy, t };
      POST.hit = { x: ax, y: ay, t: at, w: crit ? 1.3 : .7 }; if (crit && !beats) { beats++; postBeat('crit', ax, ay, at); sndPlay('crit'); }
      fxImpact(ax, ay, at, crit ? 14 : 7, melee ? Math.sign(m.dx) : 0, melee ? Math.sign(m.dy) : 0);
      if (!melee && FX.lastEl && t - FX.lastProj < 700) fxBurst(ax + .5, ay + .5, FX.lastEl, FX.lastC, false, at);
      FX.flash[m.i] = at; FX.floats.push({ x: ax, y: ay, s: o.rh != null ? '-' + lost : '-' + (o.hp - m.hp) + '%', c: '#ffd9a8', t: at, small: 1, px: Math.sign(m.dx) * .28 });
    }
  }
  // swings that found nothing, and spells shrugged off, say so where they happened
  { const bare = n => String(n || '').replace(/^(an?|the|some) /i, '').toLowerCase(), hurt = {};
    for (const m of cur.mons) { const o = old[m.i]; if (o && ((o.rh != null && m.rh != null) ? o.rh - m.rh : o.hp - m.hp) > 0) hurt[m.i] = 1; }
    const xn = s => { const r = /\(x(\d+)\)\s*$/.exec(s); return r ? +r[1] : 1; }, cnt = re => fresh.reduce((a, s) => a + (s.match(re) || []).length * xn(s), 0), misses = cnt(/\bYou miss\b/g);
    if (misses) { const adj = cur.mons.filter(m => m.los && Math.abs(m.dx) <= 1 && Math.abs(m.dy) <= 1 && (m.dx || m.dy) && !hurt[m.i] && !m.pet && !m.friendly);
      const m = adj[0];
      if (m && !mx && !my) { if (!FX.lunge.p) FX.lunge.p = { dx: m.dx, dy: m.dy, t }; FX.floats.push({ x: cur.px + m.dx, y: cur.py + m.dy, s: misses > 1 ? 'miss ×' + misses : 'miss', c: '#b9b2a6', t: t + HIT_MS, small: 1, px: Math.sign(m.dx) * .28 }); } }
    const theyMiss = cnt(/\b(It|it|[A-Z][\w' -]*?) misses( you)?[.!]/g) - cnt(/barely misses you/g);
    if (theyMiss && cur.p.hp >= prev.p.hp) FX.floats.push({ x: cur.px, y: cur.py, s: theyMiss > 1 ? 'miss ×' + theyMiss : 'miss', c: '#b9b2a6', t: t + HIT_MS, small: 1, up: .45, px: .45 });
    const shrug = {};
    for (const s of fresh) { const r = /^(.+?) (resists( a lot| somewhat)?|is unaffected|is immune)[.!]/.exec(s); if (!r) continue; const who = bare(r[1]);
      const m = cur.mons.filter(m => m.los && bare(m.n) === who).sort((a, b) => a.dist - b.dist)[0]; if (!m || shrug[m.i]) continue; shrug[m.i] = 1;
      FX.floats.push({ x: cur.px + m.dx, y: cur.py + m.dy, s: /unaffected|immune/.test(r[2]) ? 'immune' : 'resists', c: '#d7c9a0', t: t + 120, small: 1, up: .7, px: -.3 }); } }
  for (const o of prev.mons) if (!seen[o.i] && o.los && o.dist <= 12 && cur.p.hp > 0) {
    // gone from sight right after being hurt or while next to us: most likely slain
    if (o.hp < 100 || o.dist <= 1) {
      const melee = o.dist <= 1 && !mx && !my, at = melee ? t + HIT_MS : t;
      if (melee) FX.lunge.p = { dx: o.dx, dy: o.dy, t };
      FX.puffs.push({ x: prev.px + o.dx, y: prev.py + o.dy, t: at, r: o.r });
      if (!FX.shake) FX.shake = { t: at, amp: 3, ms: 130 };
      // a unique falling, or a kill that brings a new level, gets the big finish; other kills keep the pace
      const lvl = cur.p.lev > prev.p.lev;
      if (o.uniq || lvl) { postBeat('kill', prev.px + o.dx, prev.py + o.dy, at); postClimax(prev.px + o.dx, prev.py + o.dy, at); }
      else if (crit) POST.hit = { x: prev.px + o.dx, y: prev.py + o.dy, t: at, w: 1.3 };
    }
  }
  // the player: numbers for damage and healing, shake and a red pulse when hit
  const d = cur.p.hp - prev.p.hp;
  if (d < 0) {
    // whoever stands next to us and is awake leans in; with several, the nearest one does
    const foes = cur.mons.filter(m => m.los && !m.asleep && Math.abs(m.dx) <= 1 && Math.abs(m.dy) <= 1);
    const hit = foes.length ? t + HIT_MS : t;
    for (const m of foes) if (!FX.lunge[m.i]) FX.lunge[m.i] = { dx: -m.dx, dy: -m.dy, t };
    FX.floats.push({ x: cur.px, y: cur.py, s: String(d), c: '#ff6a55', t: hit, big: 1, up: .55 });
    if (FX.lastEl && t - FX.lastProj < 700) fxBurst(cur.px + .5, cur.py + .5, FX.lastEl, FX.lastC, false, hit);   // struck by a spell: it clings to us for a moment
    fxImpact(cur.px, cur.py, hit, Math.min(14, 5 + Math.round(-d / Math.max(1, cur.p.mhp) * 30)), foes.length ? -Math.sign(foes[0].dx) : 0, foes.length ? -Math.sign(foes[0].dy) : 0);
    const frac = Math.min(1, -d / Math.max(1, cur.p.mhp));
    FX.shake = { t: hit, amp: 2 + frac * 16, ms: 150 + frac * 250 };
    if (-d >= cur.p.mhp * .25) postBeat('hurt', cur.px, cur.py, hit); else POST.hit = POST.hit || { x: cur.px, y: cur.py, t: hit, w: .5 + frac * 2 };
    const h = document.getElementById('hurt'); if (h) { h.style.setProperty('--a', (.25 + frac * .6).toFixed(2)); h.classList.remove('go'); void h.offsetWidth; h.classList.add('go'); }
  } else if (d > 0 && d >= Math.max(2, cur.p.mhp * .03)) FX.floats.push({ x: cur.px, y: cur.py, s: '+' + d, c: '#a9e08c', t, big: 1, up: .55 }), (d >= cur.p.mhp * .15 && postBeat('heal', cur.px, cur.py, t));
  const ds = cur.p.sp - prev.p.sp; if (ds < 0 && cur.p.msp > 0) FX.floats.push({ x: cur.px, y: cur.py, s: String(ds), c: '#7fd0f0', t: t + 60, small: 1, px: -.75, up: -.35 });
  // picked something up: its name rises off us; gold too
  if (prev.pack && cur.pack && !cur.icky) {
    const had = {}; for (const o of prev.pack) had[o.ki] = (had[o.ki] || 0) + (o.num || 1);
    // what came off our body is not a find
    const eqn = (L, k) => (L || []).filter(e => e.o && e.o.ki === k).reduce((a, e) => a + (e.o.num || 1), 0);
    for (const e of prev.equip || []) if (e.o) had[e.o.ki] = (had[e.o.ki] || 0) + Math.max(0, eqn(prev.equip, e.o.ki) - eqn(cur.equip, e.o.ki)) / Math.max(1, (prev.equip || []).filter(q => q.o && q.o.ki === e.o.ki).length);
    const got = []; const seenK = {};
    for (const o of cur.pack) { if (seenK[o.ki]) continue; seenK[o.ki] = 1; const n = cur.pack.filter(q => q.ki === o.ki).reduce((a, q) => a + (q.num || 1), 0) - (had[o.ki] || 0);
      const nm = String(o.n).replace(/\s*\{.*\}\s*$/, ''), tot = cur.pack.filter(q => q.ki === o.ki).reduce((a, q) => a + (q.num || 1), 0);
      if (n > 0) got.push(n === tot ? '+ ' + nm.replace(/^(an?|the) /i, '') : `+${n} (${nm})`); }
    got.slice(0, 2).forEach((g, i) => FX.floats.push({ x: cur.px, y: cur.py, s: g.length > 30 ? g.slice(0, 29) + '…' : g, c: '#f1e3c4', t: t + i * 260, small: 1, up: .9 }));
  }
  const gold = cur.p.au - prev.p.au; if (gold > 0 && !cur.icky) FX.floats.push({ x: cur.px, y: cur.py, s: '+' + gold.toLocaleString() + ' gold', c: '#ffcf6a', t: t + 80, small: 1, up: .6, px: .6 });
  if (cur.p.lev > prev.p.lev) postBeat('level', cur.px, cur.py, t + 120);
  if (cur.p.lev > prev.p.lev) fxBanner('Level ' + cur.p.lev, 'You grow stronger');
  for (const o of prev.mons) if (o.uniq && !seen[o.i] && o.los && (o.hp < 100 || o.dist <= 1) && cur.p.hp > 0 && /slain|destroyed/i.test(said)) fxBanner(String(o.n).replace(/^(an?|the) /i, ''), 'has fallen');
  document.body.classList.toggle('lowhp', cur.p.mhp > 0 && cur.p.hp / cur.p.mhp < .25 && cur.p.hp >= 0);
  fxKick();
}
function fxActive() {
  const t = now();
  if (FX.scroll && t - FX.scroll.t < STEP_MS) return true;
  for (const k in FX.mons) { if (t - FX.mons[k].t < STEP_MS) return true; delete FX.mons[k]; }
  for (const k in FX.lunge) { if (t - FX.lunge[k].t < HIT_MS + HOLD_MS + BACK_MS) return true; delete FX.lunge[k]; }
  FX.floats = FX.floats.filter(f => t - f.t < 900); FX.puffs = FX.puffs.filter(f => t - f.t < 380);
  FX.parts = FX.parts.filter(p => t - p.t < p.life); FX.rings = FX.rings.filter(r => t - r.t < r.life);
  if (FX.parts.length || FX.rings.length) return true;
  for (const k in FX.flash) if (t - FX.flash[k] > 220) delete FX.flash[k];
  if (FX.shake && t - FX.shake.t > FX.shake.ms) FX.shake = null;
  if (postActive()) return true;
  return FX.floats.length > 0 || FX.puffs.length > 0 || Object.keys(FX.flash).length > 0 || !!FX.shake;
}
let fxRun = false;
function fxKick() { if (fxRun) return; fxRun = true; const step = () => { if (fxActive() && S && S.map) { drawMap(); requestAnimationFrame(step); } else { fxRun = false; if (S && S.map) drawMap(); } }; requestAnimationFrame(step); }
// how far (in squares) the view still has to slide
function fxScroll() { const s = FX.scroll; if (!s) return [0, 0]; const k = (now() - s.t) / STEP_MS; if (k >= 1) return [0, 0]; const e = 1 - ease(k); return [s.dx * e, s.dy * e]; }
function fxMon(i) { const s = FX.mons[i]; if (!s) return [0, 0]; const k = (now() - s.t) / STEP_MS; if (k >= 1) return [0, 0]; const e = 1 - ease(k); return [s.dx * e, s.dy * e]; }
function fxFlash(i) { const t = FX.flash[i]; if (!t) return 0; const k = (now() - t) / 220; return k < 0 || k >= 1 ? 0 : 1 - k; }
// attack lean: out fast, a short hold on the hit (the "hit stop"), then back. who is 'p' or a creature's number
function fxLunge(who) { const s = FX.lunge[who]; if (!s) return [0, 0]; const e = now() - s.t; if (e < 0 || e >= HIT_MS + HOLD_MS + BACK_MS) return [0, 0];
  const a = (e < HIT_MS ? ease(e / HIT_MS) : e < HIT_MS + HOLD_MS ? 1 : 1 - ease((e - HIT_MS - HOLD_MS) / BACK_MS)) * .3; return [s.dx * a, s.dy * a]; }
function fxShake() { const s = FX.shake; if (!s) return [0, 0]; const k = (now() - s.t) / s.ms; if (k < 0 || k >= 1) return [0, 0]; const a = s.amp * (1 - k); return [Math.sin(k * 40) * a, Math.cos(k * 33) * a * .6]; }
/* ---------- spell particles ----------
 * The game animates bolts and balls as coloured * | - / \ marks. Each new mark sheds sparks that outlive it,
 * a ball mark throws a burst and a shock ring, and the start of each volley flares at whoever cast it. */
const rnd1 = () => Math.random() * 2 - 1;
function fxPart(x, y, vx, vy, life, size, c, kind) { if (FX.parts.length < 700) FX.parts.push({ x, y, vx, vy, t: now(), life, size, c, kind }); }
// what a bolt or ball is made of, read off its colour: each element moves its own way
function fxElem(c) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(c || ''); if (!m) return 'plain';
  const r = parseInt(m[1], 16) / 255, g = parseInt(m[2], 16) / 255, b = parseInt(m[3], 16) / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (d < .12) return l > .7 ? 'light' : l < .35 ? 'dark' : 'plain';
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360;
  if (l < .3) return 'dark';
  if (h < 50 || h >= 345) return 'fire';
  if (h < 68) return 'elec';
  if (h < 160) return mx === g && r < .45 && b < .45 && l < .5 ? 'poison' : 'acid';
  if (h < 215) return 'cold';
  if (h < 255) return 'elec';
  return 'arcane';
}
function fxBurst(cx, cy, el, c, big, t) {
  const n = big ? 1 : .35, P = (vx, vy, life, size, col, kind, g, extra) => FX.parts.length < 700 && FX.parts.push(Object.assign({ x: cx + (big ? 0 : rnd1() * .18), y: cy + (big ? 0 : rnd1() * .18), vx, vy, t, life, size, c: col, kind, g }, extra || {}));
  const ring = (a, b) => FX.rings.push({ x: cx, y: cy, t, life: 420, r0: a, r1: b, c, w: 3 });
  if (el === 'fire') {              // embers that climb and flicker out, a hot core
    if (big) ring(.15, 1.05);
    for (let i = 0; i < 22 * n; i++) { const a = Math.random() * 6.283, s = (big ? 1.2 : .5) + Math.random() * 2.2; P(Math.cos(a) * s, Math.sin(a) * s - .6, 500 + Math.random() * 500, 2.5 + Math.random() * 3, ['#ffe08a', '#ff8a2a', c, '#ff5a1a'][i % 4], 'spark', -1.6); }
  } else if (el === 'cold') {       // slow crystals that turn and settle
    if (big) ring(.2, 1.1);
    for (let i = 0; i < 18 * n; i++) { const a = Math.random() * 6.283, s = (big ? .8 : .3) + Math.random() * 1.6; P(Math.cos(a) * s, Math.sin(a) * s, 700 + Math.random() * 500, 3 + Math.random() * 3, i % 3 ? '#cfeeff' : '#ffffff', 'flake', .45, { spin: rnd1() * 8 }); }
  } else if (el === 'elec') {       // forks of lightning that crack and vanish
    if (big) ring(.1, .9);
    for (let i = 0; i < (big ? 7 : 3); i++) P(0, 0, 140 + Math.random() * 120, 0, i % 2 ? c : '#ffffff', 'arc', 0, { a: Math.random() * 6.283, len: (big ? .7 : .45) + Math.random() * .5, seed: Math.random() * 99 });
    for (let i = 0; i < 8 * n; i++) { const a = Math.random() * 6.283, s = 2 + Math.random() * 4; P(Math.cos(a) * s, Math.sin(a) * s, 200 + Math.random() * 200, 2 + Math.random() * 1.5, '#ffffff', 'spark', 0); }
  } else if (el === 'acid' || el === 'water') {       // a splash of drops that fall back down
    if (big) ring(.15, .95);
    for (let i = 0; i < 18 * n; i++) { const a = -Math.PI / 2 + rnd1() * 1.4, s = (big ? 1.6 : .8) + Math.random() * 2.2; P(Math.cos(a) * s * .8, Math.sin(a) * s, 450 + Math.random() * 300, 3 + Math.random() * 2.5, i % 3 ? c : el === 'water' ? '#e0f4ff' : '#e8ffb0', 'drop', 5.5, { solid: i % 3 !== 0 }); }
  } else if (el === 'poison' || el === 'dark') {   // a cloud that swells and drifts
    const col = el === 'dark' ? '#1c1424' : c;
    if (big && el === 'dark') FX.rings.push({ x: cx, y: cy, t, life: 460, r0: 1.1, r1: .15, c: '#8a4ad0', w: 2.5 });   // darkness pulls inward
    for (let i = 0; i < (big ? 9 : 3); i++) { const a = Math.random() * 6.283, s = .2 + Math.random() * (big ? .9 : .4); P(Math.cos(a) * s, Math.sin(a) * s - .25, 700 + Math.random() * 500, 0, col, 'smoke', -.2, { r0: .18 + Math.random() * .12, r1: (big ? .7 : .45) + Math.random() * .3, solid: el === 'dark' }); }
    if (el === 'poison') for (let i = 0; i < 10 * n; i++) { const a = Math.random() * 6.283, s = .4 + Math.random() * 1.2; P(Math.cos(a) * s, Math.sin(a) * s - .3, 700 + Math.random() * 500, 2.5 + Math.random() * 2, i % 3 ? '#9cff6a' : '#e0ffc0', 'mote', -.4); }
    if (el === 'dark') for (let i = 0; i < 8 * n; i++) { const a = Math.random() * 6.283, s = .8 + Math.random() * 1.5; P(Math.cos(a) * s, Math.sin(a) * s, 500 + Math.random() * 300, 2.5, i % 2 ? '#b07aff' : '#5a2a8a', 'spark', 0); }
  } else if (el === 'shard') {      // hard fragments thrown outward, tumbling and dropping
    if (big) ring(.15, .9);
    for (let i = 0; i < 16 * n; i++) { const a = Math.random() * 6.283, s = (big ? 2.2 : 1) + Math.random() * 3; P(Math.cos(a) * s, Math.sin(a) * s - .5, 380 + Math.random() * 300, 2.5 + Math.random() * 2.5, i % 3 ? '#d8d2c8' : c, 'flake', 2.4, { spin: rnd1() * 14, solid: true }); }
  } else if (el === 'light') {      // a clean flash with rays
    if (big) { ring(.15, 1.15); FX.rings.push({ x: cx, y: cy, t: t + 60, life: 360, r0: .1, r1: .7, c: '#ffffff', w: 2 }); }
    for (let i = 0; i < (big ? 10 : 4); i++) P(0, 0, 220 + Math.random() * 120, 0, i % 2 ? '#fffbe0' : c, 'arc', 0, { a: i / (big ? 10 : 4) * 6.283 + Math.random() * .3, len: (big ? .9 : .5), seed: 0, straight: 1 });
    for (let i = 0; i < 10 * n; i++) { const a = Math.random() * 6.283, s = 1 + Math.random() * 2.5; P(Math.cos(a) * s, Math.sin(a) * s, 400 + Math.random() * 300, 2.5, '#ffffff', 'mote', 0); }
  } else {                           // light, arcane and the rest: a bright burst of sparks
    if (big) ring(.15, 1.05);
    for (let i = 0; i < 18 * n; i++) { const a = Math.random() * 6.283, s = (big ? 2.6 : 1) + Math.random() * 3.2; P(Math.cos(a) * s, Math.sin(a) * s, 420 + Math.random() * 380, 3 + Math.random() * 3, i % 3 ? c : '#fff', 'spark'); }
  }
  P(0, 0, big ? 300 : 220, big ? 9 : 6, el === 'dark' ? '#6a3aa0' : c, 'glow');
}
const SPELL_SND = { fire: 'fire', cold: 'cold', elec: 'elec', acid: 'acid', water: 'slime', poison: 'slime', dark: 'evil', light: 'shimmer', arcane: 'zap', shard: 'shoot', plain: 'zap' };
function fxSpell(lx, ly, ch, c) {
  if (!FX.on) return;
  const t = now(), key = lx + ',' + ly + ch; if (t - (FX.seen[key] || 0) < 160) return; FX.seen[key] = t;
  if (t - FX.lastProj > 260) {   // a new volley: flare at the caster next to the first mark
    FX.seen = {}; FX.seen[key] = t;
    const who = [[S.px, S.py]].concat(S.mons.map(m => [S.px + m.dx, S.py + m.dy])).map(([x, y]) => [x, y, Math.hypot(x - lx, y - ly)]).filter(w => w[2] <= 1.5).sort((a, b) => a[2] - b[2])[0];
    if (who) fxCast(who[0], who[1], c);
  }
  const fresh = t - FX.lastProj > 260;
  FX.lastProj = t; FX.lastEl = (G && G.gf) || fxElem(c); FX.lastC = c;
  // each volley sounds like its element once; a ball adds its blast when it bursts
  if (fresh && typeof sndPlay === 'function') sndPlay(SPELL_SND[FX.lastEl] || 'zap');
  if (fresh) FX.boomed = 0;
  if (ch === '*' && !FX.boomed) { FX.boomed = 1; if (typeof sndPlay === 'function') sndPlay('boom'); }
  fxBurst(lx + .5, ly + .5, FX.lastEl, c, ch === '*', t);
  fxKick();
}
// what is upon us, shown each turn as a few motes around the player: never a running animation
const AURA = [[/Pois/i, '#7dff6a', 'up', 2], [/Cut|Graze|Wound|Bleed|Gash/i, '#d0302a', 'drop', 1], [/Fast|Haste|Speed/i, '#e8f4ff', 'streak', 2],
  [/Bless|Hero|Berserk|Shero/i, '#ffd36b', 'up', 2], [/Afraid|Terror|Fear/i, '#b08aff', 'up', 1], [/Stun|Knocked/i, '#fff07a', 'orbit', 2], [/Conf|Halluc/i, '#ff8ad8', 'orbit', 2],
  [/Slow/i, '#8a8f96', 'drop', 1], [/Invuln|Wraith|Shield/i, '#9fd6ff', 'orbit', 1]];
function fxAura(cur, txt) {
  if (!FX.on || !txt) return; const x = cur.px + .5, y = cur.py + .5, t = now(); let any = 0;
  for (const [re, c, kind, n] of AURA) { if (!re.test(txt)) continue; any = 1;
    for (let i = 0; i < n; i++) {
      if (kind === 'up') fxPart(x + rnd1() * .35, y + .25, rnd1() * .12, -.6 - Math.random() * .5, 650 + Math.random() * 300, 3.2, c, 'mote');
      else if (kind === 'drop') FX.parts.length < 700 && FX.parts.push({ x: x + rnd1() * .25, y: y, vx: rnd1() * .2, vy: .2, t, life: 500, size: 3.4, c, kind: 'drop', g: 2.5, solid: true });
      else if (kind === 'streak') fxPart(x + rnd1() * .3, y + rnd1() * .3, -Math.sign(rnd1() || 1) * (2.5 + Math.random()), 0, 260, 2.8, c, 'spark');
      else { const a = Math.random() * 6.283; fxPart(x + Math.cos(a) * .4, y - .35 + Math.sin(a) * .12, -Math.sin(a) * 1.2, Math.cos(a) * .4, 480, 3.2, c, 'mote'); }
    } }
  if (any) fxKick();
}
// a blow lands: drops fly off the far side of the square, with a few bright chips at the point of contact
function fxImpact(x, y, at, n, dx, dy) {
  if (!FX.on) return; const cx = x + .5, cy = y + .45;
  for (let i = 0; i < n; i++) { const a = Math.atan2(dy, dx) + rnd1() * (dx || dy ? 1.1 : 3.14), s = 2.4 + Math.random() * 3, bright = i % 4 === 0;
    FX.parts.length < 700 && FX.parts.push({ x: cx, y: cy, vx: Math.cos(a) * s, vy: Math.sin(a) * s - .9, t: at, life: 380 + Math.random() * 320, size: bright ? 2.5 : 3 + Math.random() * 2.5, c: bright ? '#ffe2c0' : (i % 3 ? '#c7352b' : '#7a1410'), kind: 'spark', solid: !bright }); }
}
function fxCast(x, y, c) {
  const t = now(), cx = x + .5, cy = y + .5;
  FX.rings.push({ x: cx, y: cy, t, life: 360, r0: .75, r1: .25, c, w: 2 });
  for (let i = 0; i < 14; i++) { const a = i / 14 * 6.283, r = .7; fxPart(cx + Math.cos(a) * r, cy + Math.sin(a) * r, -Math.cos(a) * 1.6 + Math.sin(a) * .8, -Math.sin(a) * 1.6 - Math.cos(a) * .8, 320, 2.4, i % 2 ? c : '#fff', 'spark'); }
}
// what happened to us, read off the change in state: a blink out and in, mending, mana coming back, a new level
function fxSelf(prev, cur, same, near) {
  const P = prev.p, C = cur.p, x = cur.px + .5, y = cur.py + .5, t = now();
  if (same && !near) {                         // teleported on this level: a swirl where we were, sparks gathering where we land
    const ox = prev.px + .5, oy = prev.py + .5;
    for (let i = 0; i < 16; i++) { const a = Math.random() * 6.283, s = .6 + Math.random() * 1.4; fxPart(ox, oy, Math.cos(a) * s, Math.sin(a) * s - .8, 500 + Math.random() * 300, 2.5 + Math.random() * 2, i % 3 ? '#b58cff' : '#fff', 'mote'); }
    FX.rings.push({ x: ox, y: oy, t, life: 380, r0: .2, r1: .9, c: '#b58cff', w: 2 });
    FX.rings.push({ x, y, t, life: 420, r0: 1.1, r1: .2, c: '#c9a8ff', w: 2.5 });
    for (let i = 0; i < 14; i++) { const a = i / 14 * 6.283, r = 1; fxPart(x + Math.cos(a) * r, y + Math.sin(a) * r, -Math.cos(a) * 2.2, -Math.sin(a) * 2.2, 420, 2.6, i % 2 ? '#c9a8ff' : '#fff', 'mote'); }
    fxPart(x, y, 0, 0, 380, 8, '#b58cff', 'glow'); fxKick(); return;
  }
  if (!same) return;
  const healed = C.hp - P.hp, mana = C.sp - P.sp;
  if (healed > 0 && healed >= Math.max(3, C.mhp * .08)) {   // real mending, not the trickle of rest
    const n = Math.min(18, 8 + Math.round(healed / Math.max(1, C.mhp) * 20));
    for (let i = 0; i < n; i++) fxPart(x + rnd1() * .45, y + .2 + Math.random() * .3, rnd1() * .15, -.9 - Math.random() * .8, 600 + Math.random() * 400, 2.5 + Math.random() * 2, i % 3 ? '#7dff9a' : '#e8ffe8', 'mote');
    fxPart(x, y, 0, 0, 420, 7, '#5fe07a', 'glow'); fxKick();
  }
  if (mana > 0 && mana >= Math.max(3, C.msp * .15)) {
    for (let i = 0; i < 8; i++) fxPart(x + rnd1() * .4, y + .2, rnd1() * .1, -.7 - Math.random() * .6, 600 + Math.random() * 300, 2.2, i % 2 ? '#7fb6ff' : '#e0ecff', 'mote');
    fxKick();
  }
  if (C.lev > P.lev) {                         // a new level: a golden ring rises out of us and the air fills with sparks
    FX.rings.push({ x, y, t, life: 700, r0: .2, r1: 1.8, c: '#ffd36b', w: 3 }); FX.rings.push({ x, y, t: t + 140, life: 600, r0: .2, r1: 1.3, c: '#fff1c2', w: 2 });
    for (let i = 0; i < 24; i++) { const a = Math.random() * 6.283, s = 1 + Math.random() * 2.5; fxPart(x, y, Math.cos(a) * s, Math.sin(a) * s - 1.2, 800 + Math.random() * 500, 3 + Math.random() * 2.5, i % 3 ? '#ffd36b' : '#fff', 'mote'); }
    fxPart(x, y, 0, 0, 600, 10, '#ffcf5a', 'glow'); fxKick();
  }
}
function fxPartsDraw(g, toXY, T) {
  if (!FX.parts.length && !FX.rings.length) return;
  const t = now(); g.save(); g.globalCompositeOperation = 'lighter';
  for (const r of FX.rings) { const k = (t - r.t) / r.life; if (k < 0 || k >= 1) continue; const [x, y] = toXY(r.x, r.y), e = 1 - (1 - k) * (1 - k);
    g.globalAlpha = (1 - k) * .9; g.strokeStyle = r.c; g.lineWidth = r.w * (1 - k * .6); g.beginPath(); g.arc(x, y, T * (r.r0 + (r.r1 - r.r0) * e), 0, 7); g.stroke(); }
  for (const p of FX.parts) { const k = (t - p.t) / p.life; if (k < 0 || k >= 1) continue; const s = (t - p.t) / 1000, drag = 1 - Math.min(.6, s * 1.4);
    const [x, y] = toXY(p.x + p.vx * s * drag, p.y + p.vy * s * drag + (p.g != null ? p.g : p.kind === 'spark' ? .9 : 0) * s * s);
    if (p.kind === 'arc') {   // a jagged fork, redrawn a little differently every frame so it crackles
      const n = 5, L = p.len * T, ca = Math.cos(p.a), sa = Math.sin(p.a), j = Math.floor(t / 40);
      g.globalCompositeOperation = 'lighter'; g.globalAlpha = (1 - k) * (.6 + .4 * rnd(j, p.seed)); g.strokeStyle = p.c; g.lineWidth = Math.max(1.5, T / 22); g.lineJoin = 'round';
      g.beginPath(); g.moveTo(x, y); for (let i = 1; i <= n; i++) { const f = i / n, w = p.straight ? 0 : (rnd(j + i, p.seed + i) - .5) * T * .28 * (i < n ? 1 : 0); g.lineTo(x + ca * L * f - sa * w, y + sa * L * f + ca * w); } g.stroke(); continue; }
    if (p.kind === 'smoke') { const r = T * (p.r0 + (p.r1 - p.r0) * Math.sqrt(k)), gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, p.c); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalCompositeOperation = p.solid ? 'source-over' : 'lighter'; g.globalAlpha = Math.min(1, (1 - k) * 1.4) * (p.solid ? .85 : .6); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); continue; }
    if (p.kind === 'glow') { const r = T * (.35 + k * .4), gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, p.c); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.globalCompositeOperation = 'lighter'; g.globalAlpha = (1 - k) * .55; g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); continue; }
    if (p.solid) { g.globalCompositeOperation = 'source-over'; g.globalAlpha = Math.min(1, (1 - k) * 1.6); } else { g.globalCompositeOperation = 'lighter'; g.globalAlpha = 1 - k; }
    g.fillStyle = p.c; const z = p.size * Math.max(1, T / 32) * (1 - k * .5);
    if (p.kind === 'flake') { g.save(); g.translate(x, y); g.rotate(p.spin * s); g.fillRect(-z / 2, -z / 6, z, z / 3); g.fillRect(-z / 6, -z / 2, z / 3, z); g.restore(); }
    else if (p.kind === 'drop') { g.beginPath(); g.arc(x, y, z / 2, 0, 7); g.fill(); }
    else g.fillRect(x - z / 2, y - z / 2, z, z); }
  g.restore(); g.globalAlpha = 1;
}
// floating numbers and death puffs, drawn over the map. toXY turns a level square into canvas pixels
function fxDraw(g, toXY, T) {
  const t = now();
  for (const p of FX.puffs) { const k = (t - p.t) / 380; if (k < 0 || k >= 1) continue; const [x, y] = toXY(p.x, p.y);
    if (typeof spriteFlash === 'function' && DICT.r[p.r]) spriteFlash(g, DICT.r[p.r], x, y - k * T * .15, T, (1 - k) * .8);   // the fallen creature's shape fades out
    g.globalAlpha = 1 - k; g.strokeStyle = '#ffcf9e'; g.lineWidth = 2; g.beginPath(); g.arc(x + T / 2, y + T / 2, T * (.25 + k * .55), 0, 7); g.stroke();
    g.fillStyle = '#ff8a3c'; for (let i = 0; i < 6; i++) { const a = i * 1.047 + p.x, r = T * (.2 + k * .7); g.fillRect(x + T / 2 + Math.cos(a) * r - 1.5, y + T / 2 + Math.sin(a) * r - 1.5, 3, 3); } g.globalAlpha = 1; }
  for (const f of FX.floats) { const k = (t - f.t) / 900; if (k < 0 || k >= 1 || !f.s) continue; const [x, y] = toXY(f.x, f.y);
    const size = Math.round(T * (f.big ? .62 : .44)), pop = k < .12 ? .7 + k / .12 * .5 : 1.2 - Math.min(1, (k - .12) / .15) * .2;
    g.save(); g.translate(x + T / 2 + (f.px || 0) * T, y - k * T * 1.1 + (f.small ? T * .1 : 0) - (f.up || 0) * T); g.scale(pop, pop); g.globalAlpha = k > .7 ? (1 - k) / .3 : 1;
    g.font = `800 ${size}px Inter`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = Math.max(3, size * .22); g.lineJoin = 'round'; g.strokeStyle = '#0b0a09'; g.strokeText(f.s, 0, 0); g.fillStyle = f.c; g.fillText(f.s, 0, 0); g.restore(); }
}

// a large line across the map for the rare big moments (a new level, a unique slain); never blocks input
function fxBanner(title, sub, kind) {
  let el = document.getElementById('bigmsg'); if (!el) { el = document.createElement('div'); el.id = 'bigmsg'; document.getElementById('stage').appendChild(el); }
  el.innerHTML = `<b>${esc(title)}</b><span>${esc(sub || '')}</span>`; el.className = kind || ''; void el.offsetWidth; el.classList.add('go');
}
