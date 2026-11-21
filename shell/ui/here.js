// What you can do where you stand, offered as a button at the foot of the map: pick up what lies here, take the
// stairs, go into the shop whose door you are in. Double-click stairs anywhere to walk there and take them.
'use strict';
let STAIR_AT = null;
function hereCell() { if (!S || !S.map) return null; const mw = S.map.w, c = S.map.c[(S.map.h >> 1) * mw + (mw >> 1)], f = c && c[0]; return f ? { f, cls: featClass(f), name: (DICT.f[f] || [''])[0] || '' } : null; }
function hereActs() {
  if (!playing() || aimMode() || lookMode() || msgTop() || (typeof EXP !== 'undefined' && EXP.on)) return [];
  const c = hereCell(), acts = [], here = (S.floor || []).filter(o => !o.dx && !o.dy);
  if (here.length) acts.push({ key: cmd('g'), cap: 'g', label: here.length === 1 ? 'Pick up ' + here[0].n : `Pick up ${here.length} things`, art: here[0] });
  if (c && c.cls === 'down') acts.push({ key: cmd('>'), cap: '>', label: /entrance/i.test(c.name) ? 'Enter the ' + c.name.replace(/^entrance to (the )?/i, '') : 'Go down the stairs' });
  if (c && c.cls === 'up') acts.push({ key: cmd('<'), cap: '<', label: 'Go up the stairs' });
  if (c && c.cls === 'shop') acts.push({ raw: 'M 1 0 0', cap: 'click', label: /^building$/i.test(c.name) ? 'Go inside' : 'Go into the ' + c.name.replace(/^(the )/i, '') });
  return acts;
}
function hereHtml() {
  return hereActs().map((a, i) => `<span class="abtn ${i ? '' : 'go'}" ${a.raw ? `data-hereraw="${esc(a.raw)}"` : `data-key="${esc(a.key)}"`}>${a.art && artHtml(a.art.ki, 30) ? `<span class="hart">${artHtml(a.art.ki, 30)}</span>` : ''}${a.raw ? '' : `<span class="key">${esc(a.cap)}</span>`}${esc(a.label)}</span>`).join('');
}
document.addEventListener('click', ev => { const t = ev.target.closest && ev.target.closest('[data-hereraw]'); if (t) { ev.stopPropagation(); sendRaw(t.dataset.hereraw); } }, true);
// a double click on stairs you can see: walk there, then take them
document.addEventListener('dblclick', ev => {
  if (ev.target.id !== 'map' || !playing() || aimMode() || lookMode()) return;
  const cell = mapCellAt(ev); if (!cell || !cell.c || !cell.c[0] || (!cell.dx && !cell.dy)) return;
  const cls = featClass(cell.c[0]); if (cls === 'down' || cls === 'up') STAIR_AT = { x: S.px + cell.dx, y: S.py + cell.dy, k: cls === 'down' ? '>' : '<', t: Date.now() };
});
setInterval(() => {
  if (!STAIR_AT) return; if (Date.now() - STAIR_AT.t > 90000) { STAIR_AT = null; return; }
  if (S && playing() && S.px === STAIR_AT.x && S.py === STAIR_AT.y && !msgTop()) { const k = STAIR_AT.k; STAIR_AT = null; const c = hereCell(); if (c && c.cls === (k === '>' ? 'down' : 'up')) sendText(cmd(k)); }
}, 150);
addEventListener('keydown', () => { STAIR_AT = null; }, { capture: true });
