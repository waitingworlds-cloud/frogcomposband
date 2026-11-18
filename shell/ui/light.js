// Map lighting. Every light (your torch, creatures that carry light, lava, spells in flight, hit flashes)
// is cast across the map and stopped by walls, so corners and pillars throw soft shadows.
// Lit rooms get an even cool light; places you remember but cannot see fall back to a cold dim.
'use strict';
const LIGHT = { on: true, ss: 3, mul: null, add: null, w: 0, h: 0, lum: null, flick: true };
try { if (localStorage.getItem('light') === '0') LIGHT.on = false; } catch (e) {}
const WARM = [1, .74, .46], COOL = [.70, .73, .82], MEMORY = [.52, .55, .66];
function hexRgb(h) { const n = parseInt(String(h).slice(1), 16) || 0xffffff; return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; }
// two slow waves and a fast one: reads as a flame without ever strobing
function flame(t, ph) { return LIGHT.flick ? .975 + .015 * Math.sin(t * .0061 + ph) + .01 * Math.sin(t * .0173 + ph * 2.3) : 1; }

// fxl: [x, y, attr] squares showing a spell effect right now
function lightPass(g, ox, oy, T, cells, mw, mh, pcx, pcy, fxl, scx, scy) {
  const ss = LIGHT.ss, w = mw * ss, h = mh * ss, t = now();
  if (LIGHT.w !== w || LIGHT.h !== h) {
    LIGHT.w = w; LIGHT.h = h; LIGHT.buf = new Float32Array(w * h * 3); LIGHT.lum = new Float32Array(mw * mh);
    LIGHT.mul = document.createElement('canvas'); LIGHT.add = document.createElement('canvas'); LIGHT.mul.width = LIGHT.add.width = w; LIGHT.mul.height = LIGHT.add.height = h;
    LIGHT.mi = LIGHT.mul.getContext('2d').createImageData(w, h); LIGHT.ai = LIGHT.add.getContext('2d').createImageData(w, h);
  }
  const L = LIGHT.buf, opq = new Uint8Array(mw * mh), src = [];
  // base light per square, and which squares stop light
  for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
    const c = cells[y * mw + x]; let a = null;
    if (c && (c[0] || (c[1] & 4))) {
      const fl = c[1], cls = c[0] ? featClass(c[0]) : 'floor';
      if (cls === 'wall' || cls === 'door' || cls === 'rubble' || cls === 'tree') opq[y * mw + x] = 1;
      if (fl & 1) a = (fl & 2) ? COOL : (fl & 8) ? [.2, .2, .22] : [.4, .42, .5];
      else a = MEMORY;
      if (cls === 'lava') { const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const n = cells[(y + dy) * mw + x + dx]; return !n || !n[0] || featClass(n[0]) !== 'lava'; });
        if (edge && src.length < 60) src.push([x + .5, y + .5, 2.6, [1, .40, .10], .75 * (.9 + .1 * Math.sin(t * .002 + x * 1.7 + y * 2.3))]); a = [.9, .5, .3]; }
      else if (cls === 'shop' && src.length < 60) src.push([x + .5, y + .7, 2.4, WARM, .55 * flame(t, x * 3.1 + y)]);
      else if ((cls === 'up' || cls === 'down') && (fl & 1)) src.push([x + .5, y + .5, 1.6, cls === 'down' ? [.5, .8, 1] : [1, .8, .55], .3]);
    } else opq[y * mw + x] = c ? 0 : 2;   // 2: nothing known there, light dies in it
    const r = a ? a[0] : 0, gg = a ? a[1] : 0, b = a ? a[2] : 0;
    for (let j = 0; j < ss; j++) for (let i = 0; i < ss; i++) { const k = ((y * ss + j) * w + x * ss + i) * 3; L[k] = r; L[k + 1] = gg; L[k + 2] = b; }
  }
  // the lights themselves
  const lite = S.p.lite == null ? 2 : S.p.lite, f0 = flame(t, 0);
  const jx = LIGHT.flick ? Math.sin(t * .011) * .02 : 0, jy = LIGHT.flick ? Math.cos(t * .013) * .02 : 0;
  if (lite > 0) src.push([pcx + .5 - scx + jx, pcy + .5 - scy + jy, lite + 1.6, WARM, 1.05 * f0]);
  else src.push([pcx + .5 - scx, pcy + .5 - scy, 1.7, [.5, .55, .7], .45]);
  for (const m of S.mons) {
    const mo = fxMon(m.i), mx = pcx + m.dx + .5 + mo[0], my = pcy + m.dy + .5 + mo[1];
    if (m.lt) src.push([mx, my, m.lt + 1.5, WARM, .9 * flame(t, m.i * 1.9)]);
    const fl = fxFlash(m.i); if (fl) src.push([mx, my, 2.2, [1, .95, .85], fl * .9]);
  }
  for (const p of FX.puffs) { const k = (t - p.t) / 380; if (k >= 0 && k < 1) src.push([pcx + p.x - S.px + .5, pcy + p.y - S.py + .5, 2.6, [1, .55, .2], (1 - k) * .8]); }
  if (fxl) for (const [x, y, at] of fxl) if (src.length < 140) { const c = hexRgb(col(at)); src.push([x + .5, y + .5, 2.8, c, .8]); }
  for (const [lx, ly, rad, c, pow] of src) {
    const cx0 = Math.floor(lx), cy0 = Math.floor(ly);
    const i0 = Math.max(0, Math.floor((lx - rad) * ss)), i1 = Math.min(w - 1, Math.ceil((lx + rad) * ss)), j0 = Math.max(0, Math.floor((ly - rad) * ss)), j1 = Math.min(h - 1, Math.ceil((ly + rad) * ss));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const px = (i + .5) / ss, py = (j + .5) / ss, dx = px - lx, dy = py - ly, d2 = dx * dx + dy * dy; if (d2 >= rad * rad) continue;
      const tx = Math.floor(px), ty = Math.floor(py);
      // walk from the light to this point; a wall on the way leaves it in shadow (the wall itself still catches the light)
      let ok = true; const d = Math.sqrt(d2), n = Math.ceil(d * 4);
      for (let s = 1; s < n; s++) { const qx = Math.floor(lx + dx * s / n), qy = Math.floor(ly + dy * s / n); if (qx === tx && qy === ty) break; if ((qx !== cx0 || qy !== cy0) && opq[qy * mw + qx]) { ok = false; break; } }
      if (!ok) continue;
      const q = 1 - d2 / (rad * rad), a = q * q * pow, k = (j * w + i) * 3; L[k] += c[0] * a; L[k + 1] += c[1] * a; L[k + 2] += c[2] * a;
    }
  }
  // out: a darkening layer and a soft coloured glow on top
  const M = LIGHT.mi.data, A = LIGHT.ai.data;
  for (let k = 0, o = 0, n = w * h; k < n; k++, o += 4) {
    const r = L[k * 3], gg = L[k * 3 + 1], b = L[k * 3 + 2];
    M[o] = r >= 1 ? 255 : r * 255; M[o + 1] = gg >= 1 ? 255 : gg * 255; M[o + 2] = b >= 1 ? 255 : b * 255; M[o + 3] = 255;
    const e = .24; A[o] = Math.min(255, Math.max(0, r - .55) * 255 * e); A[o + 1] = Math.min(255, Math.max(0, gg - .55) * 255 * e); A[o + 2] = Math.min(255, Math.max(0, b - .55) * 255 * e); A[o + 3] = 255;
  }
  for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) { const k = ((y * ss + (ss >> 1)) * w + x * ss + (ss >> 1)) * 3; LIGHT.lum[y * mw + x] = Math.min(1, (L[k] + L[k + 1] + L[k + 2]) / 3); }
  LIGHT.mul.getContext('2d').putImageData(LIGHT.mi, 0, 0); LIGHT.add.getContext('2d').putImageData(LIGHT.ai, 0, 0);
  g.save(); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.globalCompositeOperation = 'multiply'; g.drawImage(LIGHT.mul, ox, oy, mw * T, mh * T);
  g.globalCompositeOperation = 'lighter'; g.drawImage(LIGHT.add, ox, oy, mw * T, mh * T);
  g.restore();
}
// how bright a square is (0..1), for things standing on it
function lightAt(x, y, mw) { return LIGHT.lum ? LIGHT.lum[y * mw + x] || 0 : 1; }
// keep the flames alive while you stand still
setInterval(() => { if (LIGHT.on && LIGHT.flick && S && S.map && !document.hidden && typeof playing === 'function' && playing() && !fxRun) drawMap(); }, 90);
