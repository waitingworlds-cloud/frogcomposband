// Living map: the map keeps moving gently while you think. Water ripples, lava breathes, torches flicker
// (the light pass already flickers; this keeps redrawing so you see it), awake creatures sway, sleepers breathe,
// and dust drifts in your light. About 20 redraws a second, only while the map is in view.
// Shift+F7 turns it off and on; "reduce motion" in the system settings starts it off.
'use strict';
const AMB = { on: true, t: 0, motes: [] };
try { const v = localStorage.getItem('amb'); if (v === '0' || (v === null && matchMedia('(prefers-reduced-motion: reduce)').matches)) AMB.on = false; } catch (e) {}
const ambT = () => performance.now() / 1000;
// water: two drifting bands of light; lava: a slow glow that rises and falls, with the odd bright bubble
function ambCell(g, cls, sx, sy, T, wx, wy, lit) {
  if (!AMB.on) return; const t = ambT();
  if (cls === 'water') {
    g.save(); g.globalAlpha = lit ? .24 : .11; g.strokeStyle = '#cfefff'; g.lineWidth = Math.max(1, T / 40);
    for (let k = 0; k < 2; k++) { const ph = t * (1.1 + k * .4) + wx * .9 + wy * 1.7 + k * 2.1, yy = sy + T * (.3 + .4 * k) + Math.sin(ph) * T * .06;
      g.beginPath(); g.moveTo(sx + T * .12, yy); g.quadraticCurveTo(sx + T * .5, yy + Math.sin(ph * 1.3) * T * .08, sx + T * .88, yy); g.stroke(); }
    g.restore();
  } else if (cls === 'lava') {
    const p = .5 + .5 * Math.sin(t * 1.6 + wx * .7 + wy * 1.1);
    g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = (lit ? .12 : .06) + p * .14; g.fillStyle = '#ff8a2a'; g.fillRect(sx, sy, T, T);
    const b = (t * .5 + (wx * 7.3 + wy * 3.1) % 1) % 1;   // a bubble rises, swells and pops every couple of seconds
    if (b < .35) { g.globalAlpha = .5 * (1 - b / .35); g.fillStyle = '#ffd08a'; g.beginPath(); g.arc(sx + T * (.3 + ((wx * 13 + wy * 7) % 5) / 10), sy + T * (.7 - b), T * (.04 + b * .1), 0, 7); g.fill(); }
    g.restore();
  }
}
// a creature's sway: awake ones bob a little, sleepers barely breathe
function ambBob(m, i) { if (!AMB.on || !m) return 0; const t = ambT(), ph = (i || 0) * 1.7; return m.asleep ? Math.sin(t * 1.2 + ph) * .008 : Math.sin(t * 3.1 + ph) * .022; }
function ambKey(e) {
  if (e.key !== 'F7' || !e.shiftKey) return false;
  AMB.on = !AMB.on; try { localStorage.setItem('amb', AMB.on ? '1' : '0'); } catch (x) {}
  if (typeof postToast === 'function') postToast('Living map: ' + (AMB.on ? 'on' : 'off')); if (S && S.map) drawMap(); return true;
}
// the idle redraw: only when nothing else is drawing the map and it can be seen. A slow machine gets fewer frames.
function ambTick() {
  let wait = 50;
  if (AMB.on && !document.hidden && S && S.map && S.p && !(typeof fxRun !== 'undefined' && fxRun) && !(typeof FX !== 'undefined' && FX.freeze)) {
    const cv = document.getElementById('map');
    if (cv && cv.clientWidth) { const t0 = performance.now(); drawMap(); wait = Math.max(50, (performance.now() - t0) * 4); }
  }
  setTimeout(ambTick, wait);
}
setTimeout(ambTick, 500);
