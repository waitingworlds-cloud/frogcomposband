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
  if (!near) { FX.scroll = null; FX.mons = {}; FX.floats = []; FX.puffs = []; FX.lunge = {}; return; }
  if (mx || my) FX.scroll = { dx: mx, dy: my, t };
  if (mx || my) sndPlay('walk');
  // creatures: slide to their new square, flash when hurt, puff when gone
  const old = {}; for (const m of prev.mons) old[m.i] = m;
  // what the game just said: a telling blow earns the crit look
  const seenTurn = prev.msgs && prev.msgs.length ? prev.msgs[prev.msgs.length - 1] : null, fresh = [];
  for (let i = (cur.msgs || []).length - 1; i >= 0 && fresh.length < 6; i--) { const m = cur.msgs[i]; if (seenTurn && m.turn === seenTurn.turn && m.s === seenTurn.s) break; fresh.push(m.s); }
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
      FX.flash[m.i] = at; FX.floats.push({ x: ax, y: ay, s: o.rh != null ? '-' + lost : '-' + (o.hp - m.hp) + '%', c: '#ffd9a8', t: at, small: 1, px: Math.sign(m.dx) * .28 });
    }
  }
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
    const frac = Math.min(1, -d / Math.max(1, cur.p.mhp));
    FX.shake = { t: hit, amp: 2 + frac * 16, ms: 150 + frac * 250 };
    if (-d >= cur.p.mhp * .25) postBeat('hurt', cur.px, cur.py, hit); else POST.hit = POST.hit || { x: cur.px, y: cur.py, t: hit, w: .5 + frac * 2 };
    const h = document.getElementById('hurt'); if (h) { h.style.setProperty('--a', (.25 + frac * .6).toFixed(2)); h.classList.remove('go'); void h.offsetWidth; h.classList.add('go'); }
  } else if (d > 0 && d >= Math.max(2, cur.p.mhp * .03)) FX.floats.push({ x: cur.px, y: cur.py, s: '+' + d, c: '#a9e08c', t, big: 1, up: .55 }), (d >= cur.p.mhp * .15 && postBeat('heal', cur.px, cur.py, t));
  const ds = cur.p.sp - prev.p.sp; if (ds < 0 && cur.p.msp > 0) FX.floats.push({ x: cur.px, y: cur.py, s: String(ds), c: '#7fd0f0', t: t + 60, small: 1, px: -.75, up: -.35 });
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
function fxSpell(lx, ly, ch, c) {
  if (!FX.on) return;
  const t = now(), key = lx + ',' + ly + ch; if (t - (FX.seen[key] || 0) < 160) return; FX.seen[key] = t;
  if (t - FX.lastProj > 260) {   // a new volley: flare at the caster next to the first mark
    FX.seen = {}; FX.seen[key] = t;
    const who = [[S.px, S.py]].concat(S.mons.map(m => [S.px + m.dx, S.py + m.dy])).map(([x, y]) => [x, y, Math.hypot(x - lx, y - ly)]).filter(w => w[2] <= 1.5).sort((a, b) => a[2] - b[2])[0];
    if (who) fxCast(who[0], who[1], c);
  }
  FX.lastProj = t;
  const cx = lx + .5, cy = ly + .5;
  if (ch === '*') {
    FX.rings.push({ x: cx, y: cy, t, life: 420, r0: .15, r1: 1.05, c, w: 3 });
    for (let i = 0; i < 18; i++) { const a = Math.random() * 6.283, s = 2.6 + Math.random() * 3.2; fxPart(cx, cy, Math.cos(a) * s, Math.sin(a) * s, 420 + Math.random() * 380, 3 + Math.random() * 3, i % 3 ? c : '#fff', 'spark'); }
    fxPart(cx, cy, 0, 0, 300, 9, c, 'glow');
  } else {
    for (let i = 0; i < 4; i++) fxPart(cx + rnd1() * .18, cy + rnd1() * .18, rnd1() * .9, rnd1() * .9 - .35, 300 + Math.random() * 350, 1.8 + Math.random() * 2, i ? c : '#fff', 'spark');
    fxPart(cx, cy, 0, 0, 220, 6, c, 'glow');
  }
  fxKick();
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
    const [x, y] = toXY(p.x + p.vx * s * drag, p.y + p.vy * s * drag + (p.kind === 'spark' ? s * s * .9 : 0));
    if (p.kind === 'glow') { const r = T * (.35 + k * .4), gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, p.c); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.globalAlpha = (1 - k) * .55; g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); continue; }
    g.globalAlpha = 1 - k; g.fillStyle = p.c; const z = p.size * (1 - k * .5); g.fillRect(x - z / 2, y - z / 2, z, z); }
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
function fxBanner(title, sub) {
  let el = document.getElementById('bigmsg'); if (!el) { el = document.createElement('div'); el.id = 'bigmsg'; document.getElementById('stage').appendChild(el); }
  el.innerHTML = `<b>${esc(title)}</b><span>${esc(sub || '')}</span>`; el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
}
