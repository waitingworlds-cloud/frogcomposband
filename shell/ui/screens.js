// Screens with their own layout (drawn from data the game sends), and mouse play.
'use strict';
let UI = null;   // the game's current native screen, or null

const TVCAT = tv => tv >= 90 && tv <= 109 ? 'Spellbooks' : tv === 75 || tv === 77 ? 'Potions' : tv === 70 || tv === 69 ? 'Scrolls' : tv === 55 || tv === 65 || tv === 66 ? 'Devices'
  : tv >= 16 && tv <= 18 ? 'Ammunition' : tv >= 19 && tv <= 23 ? 'Weapons' : tv >= 30 && tv <= 38 ? 'Armour' : tv === 39 ? 'Light' : tv === 40 || tv === 45 ? 'Jewellery'
  : tv === 80 ? 'Food' : tv === 127 ? 'Treasure' : 'Other things';
const lb = w => (w / 10).toFixed(1);

// is the game's own pop-up for this screen still the top thing on the grid? (something else may have opened over it)
function uiOnTop() {
  if (!UI) return false;
  if (UI.kind === 'items') { const last = plain(UI.prompt).trim().split('\n').pop().trim(); return (G.s[G.cy] || '').replace(/\x01/g, ' ').includes(last.slice(0, 14)); }
  return true;
}

function itemsHtml() {
  const u = UI, tab = u.tabs.find(t => t.on) || u.tabs[0], equip = tab && tab.loc === 1;
  let rows = '', lastCat = '', n = 0, cats = 0;
  for (const it of u.items) {
    const o = it.o, cat = equip ? '' : o ? TVCAT(o.tv) : '';
    if (cat && cat !== lastCat) { rows += `<div class="catr">${cat}</div>`; lastCat = cat; cats++; }
    const ic = o ? tvIcon(o.tv) : 'ring'; n++;
    rows += `<div class="tr ${oq(o)}" ${it.k.trim() ? `data-key="${esc(it.k)}"` : ''}><span class="key" style="${it.k.trim() ? '' : 'visibility:hidden'}">${esc(it.k)}</span><div class="slot t-${ic} ${o ? '' : 'empty'}">${icon(ic)}</div>
      <span class="n nowrap">${o ? esc(o.n) : '<i style="color:#5a5750">nothing</i>'}${it.slot ? `<small>${esc(it.slot)}</small>` : ''}</span>
      <span class="num" style="text-align:right">${it.failr != null ? `<span style="color:#ff9a86">${(it.failr / 10).toFixed(1)}%</span>` : ''}</span><span class="dir">${o ? lb(o.w) + ' lb' : ''}</span></div>`;
  }
  if (!n) rows = '<div class="sub" style="padding:18px 6px">Nothing here.</div>';
  // long lists: tighten the rows so the whole page fits
  const room = 800 - cats * 34, rh = Math.max(27, Math.min(38, Math.floor(room / Math.max(1, n))));
  const tabs = u.tabs.map(t => `<div class="${t.on ? 'on' : ''}">${esc(t.name)}</div>`).join('');
  return `<div class="pane npanel inv" style="--rh:${rh}px;width:800px">
    <div class="tabs">${tabs}<span class="dir" style="margin-left:auto;align-self:center;font-size:14px">${lb(u.wgt)} lb${u.pages > 1 ? ` · page ${u.page} of ${u.pages}` : ''}</span></div>
    <div class="nrows">${rows}</div>
    <div class="nfoot"><span class="live" style="white-space:pre-line">${rich(u.prompt.replace(/\n+/g, "\n"))}</span><span class="grow"></span>
      ${u.tabs.length > 1 ? '<span class="row" data-key="/"><span class="key">/</span>next tab</span>' : ''}${u.pages > 1 ? '<span class="row" data-key=" "><span class="key">Space</span>next page</span>' : ''}<span class="row" data-key="\x1b"><span class="key">Esc</span>close</span></div>
  </div>`;
}

function nativeHtml() {
  if (!UI || !UI.kind || !(G.ov || G.icky) || !uiOnTop()) return '';
  if (UI.kind === 'items') return itemsHtml();
  return '';
}

/* ---------- mouse ---------- */
function mapCellAt(ev) {
  const cv = $('#map'); if (!cv || !S || !S.map) return null;
  const r = cv.getBoundingClientRect(); const x = (ev.clientX - r.left) / SCALE, y = (ev.clientY - r.top) / SCALE;
  const W = cv.clientWidth, H = cv.clientHeight, T = TILE;
  const dx = Math.floor((x - W / 2 + T / 2) / T), dy = Math.floor((y - H / 2 + T / 2) / T);
  const mw = S.map.w, mh = S.map.h, cx = (mw >> 1) + dx, cy = (mh >> 1) + dy;
  return { dx, dy, c: cx >= 0 && cy >= 0 && cx < mw && cy < mh ? S.map.c[cy * mw + cx] : 0 };
}
const playing = () => S && S.map && !G.icky && !G.ov;
function cellTip(cell) {
  const c = cell.c; if (!c) return '';
  const out = [], m = S.mons.find(m => m.dx === cell.dx && m.dy === cell.dy);
  if (!cell.dx && !cell.dy) out.push('<b>You</b>');
  if (m) out.push(`<b style="color:${m.uniq ? '#ffb070' : '#f4efe4'}">${esc(cap(m.n.replace(/^(an?|the) /i, '')))}</b><br><span class="sub">${m.asleep ? 'asleep' : m.afraid ? 'afraid' : m.pet ? 'your pet' : m.friendly ? 'friendly' : 'awake'} · ${esc(m.health)}</span>`);
  for (const o of S.floor) if (o.dx === cell.dx && o.dy === cell.dy) out.push(esc(o.n));
  if (c[0]) out.push(`<span style="color:#b3ac9f">${esc((DICT.f[c[0]] || [''])[0])}</span>`);
  if (!out.length) return '';
  const far = Math.abs(cell.dx) > 1 || Math.abs(cell.dy) > 1;
  return out.join('<br>') + `<div class="hint">${!cell.dx && !cell.dy ? 'click: pick up' : far ? 'click: walk here' : m ? 'click: attack' : 'click: step'}${m || S.floor.some(o => o.dx === cell.dx && o.dy === cell.dy) ? ' · right-click: details' : ''}</div>`;
}
function showTip(html, ev) {
  const t = $('#tip'); if (!html) { t.style.display = 'none'; return; }
  t.innerHTML = html; t.style.display = 'block';
  const sw = innerWidth / SCALE, sh = 1080, w = t.offsetWidth, h = t.offsetHeight;
  let x = ev.clientX / SCALE + 18, y = ev.clientY / SCALE + 20;
  if (x + w > sw - 8) x = ev.clientX / SCALE - w - 14; if (y + h > sh - 8) y = ev.clientY / SCALE - h - 12;
  t.style.left = Math.max(4, x) + 'px'; t.style.top = Math.max(4, y) + 'px';
}
let hover = null;
document.addEventListener('mousemove', ev => {
  const tipEl = ev.target.closest && ev.target.closest('[data-tip]');
  if (tipEl) return showTip(esc(tipEl.dataset.tip), ev);
  if (ev.target.id === 'map' && playing()) { const cell = mapCellAt(ev); if (!hover || !cell || hover.dx !== cell.dx || hover.dy !== cell.dy) { hover = cell; requestAnimationFrame(drawMap); } return showTip(cell ? cellTip(cell) : '', ev); }
  if (hover) { hover = null; requestAnimationFrame(drawMap); }
  showTip('', ev);
});
document.addEventListener('mouseleave', () => { hover = null; showTip('', {}); });
document.addEventListener('mousedown', ev => {
  if (ev.target.id === 'map' && playing()) {
    const cell = mapCellAt(ev); if (!cell) return;
    sendRaw(`M ${ev.button === 2 ? 2 : 1} ${cell.dx} ${cell.dy}`); ev.preventDefault(); return;
  }
  // the plain text panel: clicking a line that offers a lettered choice presses that letter
  if (ev.target.id === 'termc' && TERMGEO && ev.button === 0) {
    const r = ev.target.getBoundingClientRect(), gx = TERMGEO.x0 + Math.floor((ev.clientX - r.left) / SCALE / TERMGEO.cw), gy = TERMGEO.y0 + Math.floor((ev.clientY - r.top) / SCALE / TERMGEO.chh);
    const s = (G.s[gy] || '').replace(/\x01/g, ' '); let best = null, m; const re = /(^|[\s\[(])([A-Za-z0-9])[)\]]( |$)/g;
    while ((m = re.exec(s))) { const at = m.index + m[1].length; if (at <= gx + 1) best = m[2]; else if (!best) best = m[2]; }
    if (best) sendText(best);
  }
});
document.addEventListener('contextmenu', ev => ev.preventDefault());
// the wheel over the map zooms it
document.addEventListener('wheel', ev => {
  if (ev.target.id !== 'map') return;
  const steps = [20, 24, 28, 32, 40, 48, 56, 64]; let i = steps.indexOf(TILE); if (i < 0) i = 3;
  i = Math.max(0, Math.min(steps.length - 1, i + (ev.deltaY < 0 ? 1 : -1))); TILE = steps[i];
  try { localStorage.setItem('tile', TILE); } catch (e) {}
  askView(); schedule();
}, { passive: true });
try { const t = +localStorage.getItem('tile'); if (t >= 20 && t <= 64) TILE = t; } catch (e) {}
// tell the game how much map we can show
let lastView = '';
function askView() {
  const cv = $('#map'); if (!cv) return;
  const w = Math.ceil(cv.clientWidth / TILE) + 3 | 1, h = Math.ceil(cv.clientHeight / TILE) + 3 | 1, v = `V ${w} ${h}`;
  if (v !== lastView && w > 5 && h > 5) { lastView = v; sendRaw(v); }
}
