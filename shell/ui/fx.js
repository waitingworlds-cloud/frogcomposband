// Feel: smooth steps, hit flashes, floating numbers, screen shake, low-health warning.
// Everything here is drawn from changes between two game states; it never delays a key press.
'use strict';
const FX = { scroll: null, mons: {}, floats: [], puffs: [], flash: {}, shake: null, lunge: {}, on: true };
const now = () => FX.freeze || performance.now();   // FX.freeze pins the clock (used when testing)
const ease = t => 1 - (1 - t) * (1 - t);
const STEP_MS = 95, HIT_MS = 55, HOLD_MS = 45, BACK_MS = 90;   // lunge out, hold on the hit, settle back

function fxOnState(prev, cur) {
  if (!FX.on || !prev || !prev.map || !cur.map || !prev.p || !cur.p) return;
  const t = now(), same = prev.p.place === cur.p.place && prev.p.dlvl === cur.p.dlvl;
  const mx = cur.px - prev.px, my = cur.py - prev.py, near = same && Math.abs(mx) <= 2 && Math.abs(my) <= 2;
  if (!near) { FX.scroll = null; FX.mons = {}; FX.floats = []; FX.puffs = []; FX.lunge = {}; return; }
  if (mx || my) FX.scroll = { dx: mx, dy: my, t };
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
      POST.hit = { x: ax, y: ay, t: at, w: crit ? 1.3 : .7 }; if (crit && !beats) { beats++; postBeat('crit', ax, ay, at); }
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
