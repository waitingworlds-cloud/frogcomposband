// What you can do where you stand, offered as a button at the foot of the map: pick up what lies here, take the
// stairs, go into the shop whose door you are in. Double-click stairs anywhere to walk there and take them.
'use strict';
let STAIR_AT = null, HERE_CAME = { lvl: '', at: '' };
function hereCell() { if (!S || !S.map) return null; const mw = S.map.w, c = S.map.c[(S.map.h >> 1) * mw + (mw >> 1)], f = c && c[0]; return f ? { f, cls: featClass(f), name: (DICT.f[f] || [''])[0] || '' } : null; }
const hereBusy = () => /-more-/.test(msgTop()) || !!askKind();   // a question or a held message comes first
function hereActs() {
  if (!playing() || aimMode() || lookMode() || hereBusy() || (typeof EXP !== 'undefined' && EXP.on)) return [];
  const c = hereCell(), acts = [], here = (S.floor || []).filter(o => !o.dx && !o.dy);
  if (here.length) acts.push({ key: cmd('g'), cap: 'g', label: here.length === 1 ? 'Pick up ' + here[0].n : `Pick up ${here.length} things`, art: here[0] });
  // the stairs you have just come by are not offered until you have stepped off them
  const lvl = S.p.place + '|' + S.p.dlvl; if (lvl !== HERE_CAME.lvl) HERE_CAME = { lvl, at: S.px + ',' + S.py }; else if (HERE_CAME.at && HERE_CAME.at !== S.px + ',' + S.py) HERE_CAME.at = '';
  const came = !!HERE_CAME.at && !!S.p.dlvl;
  if (c && c.cls === 'down' && !came) acts.push({ key: cmd('>'), cap: '>', label: /entrance/i.test(c.name) ? 'Enter the ' + c.name.replace(/^entrance to (the )?/i, '') : 'Go down the stairs' });
  if (c && c.cls === 'up' && !came) acts.push({ key: cmd('<'), cap: '<', label: 'Go up the stairs' });
  // once the level is explored, the way on is one button away
  if (typeof EXP !== 'undefined' && EXP.doneLvl && EXP.doneLvl === EXP_MEM.lvl && S.p.dlvl && !(S.mons || []).some(m => !m.pet && !m.friendly)) {
    if ((!c || c.cls !== 'down') && hereFind('down')) acts.push({ stair: '>', label: 'Walk to the stairs down' });
    if ((!c || c.cls !== 'up') && !hereFind('down') && hereFind('up')) acts.push({ stair: '<', label: 'Walk to the stairs up' });
  }
  if (c && c.cls === 'shop') acts.push({ raw: 'M 1 0 0', cap: 'click', label: /^building$/i.test(c.name) ? 'Go inside' : 'Go into the ' + c.name.replace(/^(the )/i, '') });
  return acts;
}
// the nearest stairs of a kind that you know of on this level
function hereFind(cls) {
  const mw = S.map.w, sx = mw >> 1, sy = S.map.h >> 1; let best = null;
  S.map.c.forEach((c, i) => { if (!c || !c[0] || featClass(c[0]) !== cls) return; const dx = i % mw - sx, dy = ((i / mw) | 0) - sy, d = Math.max(Math.abs(dx), Math.abs(dy)); if (d && (!best || d < best.d)) best = { dx, dy, d }; });
  return best;
}
function hereStairs(k) { const b = hereFind(k === '>' ? 'down' : 'up'); if (!b || !playing()) return; STAIR_AT = { x: S.px + b.dx, y: S.py + b.dy, k, t: Date.now() }; sendRaw(`M 1 ${b.dx} ${b.dy}`); }
function hereHtml() {
  return hereActs().map((a, i) => `<span class="abtn ${i ? '' : 'go'}" ${a.stair ? `data-herestair="${esc(a.stair)}" data-tip="Walks there and takes them"` : a.raw ? `data-hereraw="${esc(a.raw)}"` : `data-key="${esc(a.key)}"`}>${a.art && artHtml(a.art.ki, 30) ? `<span class="hart">${artHtml(a.art.ki, 30)}</span>` : ''}${a.raw || a.stair ? '' : `<span class="key">${esc(a.cap)}</span>`}${esc(a.label)}</span>`).join('');
}
document.addEventListener('click', ev => {
  const t = ev.target.closest && ev.target.closest('[data-hereraw]'); if (t) { ev.stopPropagation(); sendRaw(t.dataset.hereraw); return; }
  const st = ev.target.closest && ev.target.closest('[data-herestair]'); if (st) { ev.stopPropagation(); hereStairs(st.dataset.herestair); }
}, true);
// a double click on stairs you can see: walk there, then take them
document.addEventListener('dblclick', ev => {
  if (ev.target.id !== 'map' || !playing() || aimMode() || lookMode()) return;
  const cell = mapCellAt(ev); if (!cell || !cell.c || !cell.c[0] || (!cell.dx && !cell.dy)) return;
  const cls = featClass(cell.c[0]); if (cls === 'down' || cls === 'up') STAIR_AT = { x: S.px + cell.dx, y: S.py + cell.dy, k: cls === 'down' ? '>' : '<', t: Date.now() };
});
setInterval(() => {
  if (!STAIR_AT) return; if (Date.now() - STAIR_AT.t > 90000) { STAIR_AT = null; return; }
  if (S && playing() && S.px === STAIR_AT.x && S.py === STAIR_AT.y && !hereBusy()) { const k = STAIR_AT.k; STAIR_AT = null; const c = hereCell(); if (c && c.cls === (k === '>' ? 'down' : 'up')) sendText(cmd(k)); }
}, 150);
addEventListener('keydown', () => { STAIR_AT = null; }, { capture: true });

// "No light": one click holds up a light you carry, with no list to pick from
let LIGHT_AUTO = 0;
document.addEventListener('click', ev => { if (ev.target.closest && ev.target.closest('[data-wlight]') && playing()) { ev.stopPropagation(); LIGHT_AUTO = Date.now(); sendText(cmd('w')); } }, true);
// one kind of shot to fire: nothing to choose, so it is not asked (press f, then aim)
function fireOnUi(m) {
  if (m.kind !== 'items' || !/^Fire which/i.test(m.prompt || '') || !LASTCMD || LASTCMD.k !== 'f' || Date.now() - LASTCMD.t > 1500) return;
  const its = (m.items || []).filter(i => i.o && i.k.trim()), tabs = (m.tabs || []).reduce((n, t) => n + (t.ct || 0), 0);
  if (its.length === 1 && tabs === 1 && (m.pages || 1) === 1) { LASTCMD.t = 0; sendText(its[0].k); }
}
function lightOnUi(m) {
  if (m.kind !== 'items' || !/wear|wield/i.test(m.prompt || '') || Date.now() - LIGHT_AUTO > 1500) return; LIGHT_AUTO = 0;
  const it = (m.items || []).find(i => i.o && i.k.trim() && i.o.tv === 39); if (it) sendText(it.k);
}
