// Screens with their own layout (drawn from data the game sends), and mouse play.
'use strict';
let UI = null, UIback = null;   // the game's current native screen, or null

const TVCAT = tv => tv >= 90 && tv <= 109 ? 'Spellbooks' : tv === 75 || tv === 77 ? 'Potions' : tv === 70 || tv === 69 ? 'Scrolls' : tv === 55 || tv === 65 || tv === 66 ? 'Devices'
  : tv >= 16 && tv <= 18 ? 'Ammunition' : tv >= 19 && tv <= 23 ? 'Weapons' : tv >= 30 && tv <= 38 ? 'Armour' : tv === 39 ? 'Light' : tv === 40 || tv === 45 ? 'Jewellery'
  : tv === 80 ? 'Food' : tv === 127 ? 'Treasure' : 'Other things';
const lb = w => (w / 10).toFixed(1);

// is the game's own pop-up for this screen still the top thing on the grid? (something else may have opened over it)
function uiOnTop() {
  if (!UI) return false;
  if (UI.kind === 'items') { const last = plain(UI.prompt).trim().split('\n').pop().trim(); return (G.s[G.cy] || '').replace(/\x01/g, ' ').includes(last.slice(0, 14)); }
  if (UI.kind === 'shop' || UI.kind === 'home') return !G.ov;
  if (UI.kind === 'char') return gridHas(/\[Character Sheet/);
  if (UI.kind === 'lmap') return G.icky && !gridHas(/-more-/);
  if (UI.kind === 'spells') return gridHas(/Lvl\s+(SP|HP|Cost)/);
  return true;
}

function itemsHtml() {
  const u = UI, tab = u.tabs.find(t => t.on) || u.tabs[0], equip = tab && tab.loc === 1;
  let rows = '', lastCat = '', n = 0, cats = 0;
  for (const it of u.items) {
    const o = it.o, cat = equip ? '' : o ? TVCAT(o.tv) : '';
    if (cat && cat !== lastCat) { rows += `<div class="catr">${cat}</div>`; lastCat = cat; cats++; }
    const ic = o ? tvIcon(o.tv) : 'ring'; n++;
    const dk = o && it.k.trim() && (tab.loc === 1 || tab.loc === 2) ? ` data-desc="${tab.loc === 1 ? 'e' : 'p'}:${esc(it.k)}"` : '';
    rows += `<div class="tr ${oq(o)}"${dk} ${it.k.trim() ? `data-key="${esc(it.k)}"` : ''}${o ? ` data-tip="${esc(o.n + ' · ' + lb(o.w) + ' lb' + (it.k.trim() ? '\nclick: choose · right-click: more actions' : ''))}"` : ''}><span class="key" style="${it.k.trim() ? '' : 'visibility:hidden'}">${esc(it.k)}</span><div class="slot t-${ic} ${o ? '' : 'empty'}">${(o && artHtml(o.ki, 34)) || icon(ic)}</div>
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

let uiSel = '', spHover = '';
function gridHas(re) { for (let y = 0; y < G.h; y++) if (re.test((G.s[y] || '').replace(/\x01/g, ' '))) return true; return false; }
// a spell's element read off its name, for a coloured edge and a faint glow on its card
const SP_ELEM = [[/acid|corro/i, '#a6e05a'], [/lightning|zap|shock|thunder|storm|elec/i, '#9fb4ff'], [/frost|cold|\bice|freez|glacier|blizzard/i, '#8fd8ff'],
  [/fire|flame|burn|inferno|heat|plasma|meteor|hellfire|scorch/i, '#ff7a2a'], [/poison|stinking|venom|toxic/i, '#6ac85a'],
  [/dark|nether|shadow|death|drain|curse|doom|vampir|necro/i, '#a06ad0'], [/heal|cure|bless|holy|\blight\b|sun|star|radian|prayer|protection/i, '#ffe08a'],
  [/mana|chaos|missile|arcane|teleport|blink|portal|time|gravity|nexus|dimension/i, '#c08aff']];
function spElem(n) { const m = SP_ELEM.find(([re]) => re.test(n)); return m ? m[1] : ''; }
function spellsHtml() {
  const u = UI, rows = u.rows, big = rows.length <= 14;
  const prompt = (G.s[0] || '').replace(/\x01/g, ' ').trim();
  const cur = rows.find(r => r.n === spHover) || rows.find(r => r.n === uiSel) || (u.sel >= 0 ? rows[u.sel] : null);
  const unit = u.unit === 'HP' ? 'life' : u.unit === 'au' ? 'gold' : 'mana';
  const have = u.unit === 'HP' ? S.p.hp : u.unit === 'au' ? S.p.au : S.p.sp;   // a cost above what you have shows red
  const cards = rows.map((r, i) => {
    const f = r.fail == null ? null : r.fail, fc = f == null ? '' : f <= 15 ? '#a9c98c' : f <= 40 ? '#ffc46a' : '#ff7a66';
    const el = spElem(r.n);
    return `<div class="spc ${r.dim || !r.ok ? 'dim' : ''} ${cur === r ? 'sel' : ''} ${big ? '' : 'sm'} ${el ? 'el' : ''}" data-key="${esc(r.k)}" data-sp="${esc(r.n)}"${el ? ` style="--el:${el}"` : ''}>
      <span class="key kb">${esc(r.k)}</span>
      <div class="grow" style="min-width:0"><div class="spn nowrap" style="${r.col && r.col !== 1 ? `color:${readable(col(r.col))}` : ''}">${esc(r.n)}</div>${big ? `<div class="sps nowrap">${esc([r.info, r.lvl != null ? 'level ' + r.lvl : '', r.prof ? r.prof.replace(/[\[\]]/g, '').trim() + (r.max ? ' (max)' : '') : '', r.stat || ''].filter(Boolean).join(' · '))}</div>` : ''}</div>
      ${!big && r.lvl != null ? `<span class="dir">lv ${r.lvl}</span>` : ''}
      ${r.cost != null ? `<span class="spm ${u.unit === 'HP' ? 'hp' : ''} ${r.cost > have ? 'short' : ''}"${r.cost > have ? ` data-tip="You have ${have} ${unit}: not enough to cast this safely."` : ''}>${icon('potion')}<b>${r.cost}</b></span>` : ''}
      ${f != null ? `<span class="ring" style="--p:${Math.min(100, f)};--rc:${fc}"><span class="rv">${f}%</span></span>` : ''}</div>`;
  }).join('');
  const detail = cur ? `<div class="spd"><div class="spn" style="font-size:24px">${esc(cur.n)}</div><div class="grow" style="font-size:17px;line-height:1.35;color:#d9d2c4">${esc(cur.desc || '')}${cur.info ? `<div style="color:#ffcf9e;margin-top:4px">${esc(cur.info)}</div>` : ''}</div>
     <div class="facts" style="grid-template-columns:auto auto;gap:4px 22px">${cur.cost != null ? `<div><span class="lbl">costs</span><b>${cur.cost} ${unit}</b></div>` : ''}${cur.fail != null ? `<div><span class="lbl">fails</span><b>${cur.fail}%</b></div>` : ''}${cur.lvl != null ? `<div><span class="lbl">level</span><b>${cur.lvl}</b></div>` : ''}</div></div>`
    : `<div class="spd"><div class="sub">Point at a spell to read what it does.</div></div>`;
  return `<div class="pane npanel" style="width:${rows.length > 28 ? 1500 : 1180}px">
    <div class="tabs"><div class="on">${esc(u.realm || 'Spells')}</div><span class="dir" style="margin-left:auto;align-self:center;font-size:15px">${u.unit === 'au' ? '' : u.unit === 'HP' ? `you have ${S.p.hp} life` : `you have ${S.p.sp} mana`}</span></div>
    <div class="spg" style="grid-template-columns:repeat(${rows.length > 28 ? 3 : 2},1fr)">${cards}</div>${detail}
    <div class="nfoot"><span class="live">${esc(prompt)}</span><span class="grow"></span><span class="row" data-key="\x1b"><span class="key">Esc</span>close</span></div></div>`;
}

function shopHtml() {
  const u = UI, rows = u.rows, two = rows.length > 13;
  const msg = [0, 1, 2].map(y => (G.s[y] || '').replace(/\x01/g, ' ').trim()).filter(Boolean).join(' ');
  const asking = /which item/i.test(msg);
  const list = rows.map(r => { const ic = tvIcon(r.tv); return `<div class="srow ${r.art || r.ego ? 'ego' : ''} ${r.ok ? '' : 'cant'}" data-key="${asking ? '' : 'b'}${esc(r.k)}"${r.sl ? ` data-desc="s:${r.sl}"` : ''} data-tip="${esc(r.n)}\n${asking ? 'click: choose this' : `click: buy · ${r.price.toLocaleString()} gold${r.ok ? '' : ' (more than you have)'}`}">
    <span class="key kb">${esc(r.k)}</span><div class="slot t-${ic}">${artHtml(r.ki, 40) || icon(ic)}</div>
    <div class="grow" style="min-width:0"><div class="n nowrap">${esc(r.n)}</div><div class="dir">${lb(r.w)} lb${r.off ? ` · <span style="color:#a9c98c">${r.off}% off</span>` : ''}</div></div>
    <span class="price num">${r.price.toLocaleString()}</span></div>`; }).join('') || '<div class="sub" style="padding:20px">The shelves are empty.</div>';
  const cmds = [['b', 'buy'], ['s', u.nosell ? 'give' : 'sell'], ['x', 'examine'], ['B', 'buy out'], ['S', 'shuffle stock'], ['R', 'reserve'], ['?', 'help'], ['\x1b', 'leave']];
  return `<div class="pane npanel shopp" style="width:${two ? 1400 : 860}px">
    <div class="row" style="gap:18px;align-items:flex-end;border-bottom:1px solid #000;box-shadow:0 1px 0 #4a4e54;padding-bottom:10px">
      <div class="grow"><div class="spn" style="font-size:34px;color:var(--em2)">${esc(u.name)}</div><div class="sub">${esc(u.owner)}, ${/^[aeiou]/i.test(u.race) ? 'an' : 'a'} ${esc(u.race.toLowerCase())}, keeps this shop · pays up to ${u.purse.toLocaleString()} for one item</div></div>
      <div style="text-align:right"><div class="lbl">your gold</div><div class="num" style="font-size:28px;color:#ffcf6a">${u.gold.toLocaleString()}</div></div></div>
    <div class="shg" style="grid-template-columns:repeat(${two ? 2 : 1},1fr)">${list}</div>
    <div class="live" style="min-height:26px;font-size:19px;padding:2px 4px">${lookKeys(esc(msg))}${qtyKeys()}</div>
    <div class="nfoot" style="flex-wrap:wrap">${cmds.map(([k, n]) => `<span class="row" data-key="${k}"><span class="key">${k === '\x1b' ? 'Esc' : k}</span>${n}</span>`).join('')}<span class="grow"></span>${u.pages > 1 ? `<span class="row" data-key=" "><span class="key">Space</span>page ${u.page} of ${u.pages}</span>` : ''}</div></div>`;
}

/* the home and the museum: the same shelves look as a shop, with weights and the game's score instead of prices */
function homeHtml() {
  const u = UI, rows = u.rows, two = rows.length > 13, mus = !!u.museum;
  const msg = [0, 1, 2].map(y => (G.s[y] || '').replace(/\x01/g, ' ').trim()).filter(Boolean).join(' ');
  const asking = /which item|\(Inven|\(Equip|quantity/i.test(msg);
  const tot = rows.reduce((a, r) => a + r.w * r.num, 0);
  const list = rows.map(r => { const ic = tvIcon(r.tv); const act = asking ? 'click: choose this' : mus ? 'click: examine' : 'click: take it with you';
    return `<div class="srow ${r.art || r.ego ? 'ego' : ''}" data-key="${asking ? '' : mus ? 'x' : 'g'}${esc(r.k)}" data-desc="h:${r.sl}" data-tip="${esc(r.n)}\n${act}">
    <span class="key kb">${esc(r.k)}</span><div class="slot t-${ic}">${artHtml(r.ki, 40) || icon(ic)}</div>
    <div class="grow" style="min-width:0"><div class="n nowrap">${esc(r.n)}</div><div class="dir">${lb(r.w * r.num)} lb</div></div>
    <span class="price num" style="color:#c9b28a" title="score">${r.score.toLocaleString()}</span></div>`; }).join('') || `<div class="sub" style="padding:20px">${mus ? 'Nothing has been donated yet.' : 'Your home is empty. Press d to leave something here.'}</div>`;
  const cmds = mus ? [['d', 'donate'], ['x', 'examine'], ['r', 'remove'], ['?', 'help'], ['\x1b', 'leave']]
    : [['g', 'take'], ['d', 'leave here'], ['x', 'examine'], ['r', 'destroy'], ['?', 'help'], ['\x1b', 'leave']];
  return `<div class="pane npanel shopp" style="width:${two ? 1400 : 860}px">
    <div class="row" style="gap:18px;align-items:flex-end;border-bottom:1px solid #000;box-shadow:0 1px 0 #4a4e54;padding-bottom:10px">
      <div class="grow"><div class="spn" style="font-size:34px;color:var(--em2)">${esc(mus ? 'The Museum' : 'Your Home')}</div><div class="sub">${mus ? 'Donations are final, and shown here for good' : 'Safe storage. Nothing here is ever lost or stolen'} · ${u.count} ${u.count === 1 ? 'item' : 'items'}${rows.length ? ` · ${lb(tot)} lb on this page` : ''}</div></div>
      <div style="text-align:right"><div class="lbl">your gold</div><div class="num" style="font-size:28px;color:#ffcf6a">${S && S.p ? S.p.au.toLocaleString() : ''}</div></div></div>
    <div class="shg" style="grid-template-columns:repeat(${two ? 2 : 1},1fr)">${list}</div>
    <div class="live" style="min-height:26px;font-size:19px;padding:2px 4px">${lookKeys(esc(msg))}${qtyKeys()}</div>
    <div class="nfoot" style="flex-wrap:wrap">${cmds.map(([k, n]) => `<span class="row" data-key="${k}"><span class="key">${k === '\x1b' ? 'Esc' : k}</span>${n}</span>`).join('')}<span class="grow"></span>${u.pages > 1 ? `<span class="row" data-key=" "><span class="key">Space</span>page ${u.page} of ${u.pages}</span>` : ''}</div></div>`;
}

const LMC = { wall: '#5a5e64', door: '#a06a34', dooropen: '#a06a34', up: '#7fd0f0', down: '#7fd0f0', water: '#2f5f86', lava: '#b8441c', tree: '#2f5a2a', grass: '#3c5530', shop: '#ffb070', rubble: '#6c665c', pit: '#101113', trap: '#c84a36', snow: '#9aa4ad', floor: '#33373c', other: '#3d4046' };
function lmapGeo() { const u = UI, s = Math.max(2, Math.min(1400 / u.w, 640 / u.h, 14)); return { s, W: Math.round(u.w * s), H: Math.round(u.h * s) }; }
function lmapHtml() {
  const u = UI, g = lmapGeo(), pois = [];
  let known = 0;
  u.c.forEach((c, i) => { const f = Array.isArray(c) ? c[0] : c; if (!f) return; known++; const cls = featClass(f); if (cls === 'up' || cls === 'down' || cls === 'shop') pois.push({ n: (DICT.f[f] || [''])[0], cls, x: i % u.w, y: (i / u.w) | 0 }); });
  pois.sort((a, b) => Math.max(Math.abs(a.x - u.px), Math.abs(a.y - u.py)) - Math.max(Math.abs(b.x - u.px), Math.abs(b.y - u.py)));
  const seen = {}, list = pois.filter(p => p.cls !== 'shop' || p.n !== 'Building').filter(p => { const k = p.cls === 'shop' ? p.n : p.n + (seen[p.n] || 0); seen[p.n] = (seen[p.n] || 0) + 1; return p.cls === 'shop' ? seen[p.n] === 1 : seen[p.n] <= 3; }).slice(0, 14);
  const leg = [['#ffb070', 'You'], ['#ff5a3c', 'Creature in sight'], ['#7fd0f0', 'Stairs'], ['#a06a34', 'Door'], ['#ffcf6a', 'Item'], ['#33373c', 'Explored floor'], ['#5a5e64', 'Wall']];
  return `<div class="pane npanel" style="width:${Math.max(900, g.W + 60)}px">
    <div class="tabs"><div class="on">Level map</div><span class="dir" style="margin-left:auto;align-self:center;font-size:15px">${esc(u.place)}${u.dlvl ? `, level ${u.dlvl} · ${u.dlvl * 50} ft` : ''}</span></div>
    <div style="display:flex;justify-content:center;margin:12px 0 8px"><canvas id="lmapc" style="width:${g.W}px;height:${g.H}px;box-shadow:0 0 0 1px #000,0 0 0 2px #2e3135;background:#0c0d0e;cursor:pointer"></canvas></div>
    <div class="row" style="gap:20px;flex-wrap:wrap;font-size:14px;color:#b3ac9f">${leg.map(([c, n]) => `<span class="row" style="gap:7px"><i style="width:11px;height:11px;background:${c};display:inline-block"></i>${n}</span>`).join('')}</div>
    ${list.length && !u.wild ? `<div class="catr" style="margin-top:6px">go to</div><div class="row" style="gap:8px;flex-wrap:wrap">${list.map(p => `<div class="grp" style="font-size:17px;padding:6px 12px;cursor:pointer" data-go="${p.x - u.px},${p.y - u.py}">${esc(cap(p.n))} <small>${dirOf(p.x - u.px, p.y - u.py)}</small></div>`).join('')}</div>` : ''}
    <div class="nfoot"><span class="sub">${u.wild ? 'The wilderness map.' : 'Click anywhere you have explored to walk there.'}</span><span class="grow"></span><span class="row" data-key="\x1b"><span class="key">Esc</span>close</span></div></div>`;
}
function lmapDraw() {
  const cv = $('#lmapc'); if (!cv || !UI || UI.kind !== 'lmap') return;
  const u = UI, g = lmapGeo(), d = SCALE * (devicePixelRatio || 1); cv.width = Math.round(g.W * d); cv.height = Math.round(g.H * d);
  const x = cv.getContext('2d'); x.setTransform(d, 0, 0, d, 0, 0); const s = g.s;
  u.c.forEach((c, i) => { const f = Array.isArray(c) ? c[0] : c, cx = (i % u.w) * s, cy = ((i / u.w) | 0) * s;
    if (f) { x.fillStyle = LMC[featClass(f)] || LMC.other; x.fillRect(cx, cy, s + .4, s + .4); }
    if (Array.isArray(c)) { if (c[2]) { x.fillStyle = '#ffcf6a'; x.fillRect(cx + s * .2, cy + s * .2, s * .6, s * .6); } if (c[1]) { x.fillStyle = '#ff5a3c'; x.fillRect(cx - 1, cy - 1, s + 2, s + 2); } } });
  x.fillStyle = '#ffb070'; x.fillRect(u.px * s - 2, u.py * s - 2, s + 4, s + 4); x.strokeStyle = '#000'; x.lineWidth = 1; x.strokeRect(u.px * s - 2.5, u.py * s - 2.5, s + 5, s + 5);
}
let NATIVE_SIDE = false;
const SKL = ['very bad', 'bad', 'poor', 'fair', 'good', 'very good', 'excellent', 'superb', 'heroic', 'legendary'];
function charHtml() {
  const u = UI, p = S.p, sk = u.rows.filter(r => r.t === 'skill'), res = u.rows.filter(r => r.t === 'res');
  const tile = (v, l) => `<div class="tile ch"><div class="ch"><b>${v}</b><span class="lbl">${l}</span></div></div>`;
  const h = Math.floor(u.play / 3600), m = Math.floor(u.play / 60) % 60;
  const bars = d => { let i = SKL.indexOf(d.toLowerCase().replace(/\[.*$/, '').trim()); if (i < 0) i = 9; const n = Math.max(1, Math.round((i + 1) * .8)); return `<span class="sbar">${Array.from({ length: 8 }, (_, k) => `<i class="${k < n ? 'on' : ''} ${i >= 8 ? 'hero' : ''}"></i>`).join('')}</span>`; };
  return `<div class="pane npanel charp" style="width:660px">
    <div class="tabs"><div class="on">Character</div></div>
    <div style="margin:8px 0 2px"><span class="spn" style="font-size:30px;color:#f4efe4">${esc(p.name)}</span> <span class="sub" style="font-size:18px">the level ${p.lev} ${esc(p.race)} ${esc(p.cls)}</span></div>
    <div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:6px">${[u.sex, p.pers + ' personality', p.realm ? p.realm + ' realm' : ''].filter(Boolean).map(t => `<span class="grp" style="font-size:15px;padding:4px 10px">${esc(t)}</span>`).join('')}</div>
    <div class="catr">progress</div>
    <div class="ptiles">${tile(u.kills.toLocaleString(), 'kills')}${tile(u.uniques, 'uniques slain')}${tile(u.arts < 0 ? 'n/a' : u.arts, 'artifacts found')}${tile(u.maxdepth ? u.maxdepth * 50 + ' ft' : 'none', 'deepest dive')}${tile('Day ' + p.day, 'at ' + p.hour + ':' + String(p.min).padStart(2, '0'))}${tile(h + 'h ' + String(m).padStart(2, '0') + 'm', 'played')}</div>
    <div class="row" style="gap:10px;margin:10px 2px 0"><span class="lbl">experience</span><div class="xp grow"><i style="width:${u.adv > 0 ? Math.min(100, u.exp / u.adv * 100) : 100}%"></i></div><span class="num" style="font-size:14px">${u.exp.toLocaleString()}${u.adv > 0 ? ' / ' + u.adv.toLocaleString() : ''}</span></div>
    ${u.exp < u.maxexp ? `<div class="sub" style="color:#ffc46a;font-size:14px">experience drained: your best was ${u.maxexp.toLocaleString()}</div>` : ''}
    <div class="catr">skills</div>
    ${sk.map(r => `<div class="row skl"><span class="grow">${esc(r.n)}</span>${bars(r.d)}<span style="width:110px;text-align:right;color:${readable(col(r.col))}">${esc(r.d)}</span></div>`).join('')}
    <div class="catr">resistances</div>
    <div class="resg">${res.map(r => `<div class="rs ${r.pct > 0 ? 'on' : r.pct < 0 ? 'bad' : ''}"><span>${esc(r.n)}</span><b>${r.pct ? r.pct + '%' : '–'}</b></div>`).join('')}</div>
    <div class="sub" style="font-size:14px;margin-top:8px">The full sheet is on the right. Arrow keys and Page Down scroll it.</div></div>`;
}
function nativeAfter() { lmapDraw(); }

function nativeHtml() {
  NATIVE_SIDE = false;
  if (!(G.ov || G.icky)) return '';
  const dh = deathHtml(); if (dh) return dh;
  if (!UI || !UI.kind || !uiOnTop()) return optsHtml() || menuHtml();
  if (UI.kind === 'items') return itemsHtml();
  if (UI.kind === 'spells') return spellsHtml();
  if (UI.kind === 'shop') return shopHtml();
  if (UI.kind === 'home') return homeHtml();
  if (UI.kind === 'lmap') return lmapHtml();
  if (UI.kind === 'char' && VW >= 1760) { NATIVE_SIDE = true; return charHtml(); }
  return UI.kind === 'char' ? '' : menuHtml();
}

/* ---------- death: the tombstone becomes a memorial card; what the game asks next stays live under it ---------- */
let DIED = null;
function deathRead() {
  const rows = G.s.map(r => (r || '').replace(/\x01/g, ' ')); const top = rows.findIndex(r => /\bRIP\b/.test(r)); if (top < 0) return null;
  const end = rows.findIndex((r, i) => i > top && /^_{4,}\)/.test(r.trim())); if (end < 0) return null;
  // the stone is the box between the pipes: take its middle column of words
  const inner = rows.slice(top + 1, end).map(r => { const a = r.indexOf('|'), b = r.indexOf('|', a + 1); const m = /\/(.*)\\/.exec(r); return (a >= 0 && b > a ? r.slice(a + 1, b) : m ? m[1] : '').trim(); }).filter(Boolean);
  const pick = re => { const l = inner.find(x => re.test(x)); return l ? l.replace(re, '').trim() : ''; };
  const name = inner[0] || '', i1 = inner.indexOf('the');
  const d = { name, title: i1 >= 0 ? inner[i1 + 1] : '', cls: i1 >= 0 ? inner[i1 + 2] : '', lev: pick(/^Level:\s*/), exp: pick(/^Exp:\s*/), au: pick(/^AU:\s*/),
    where: (inner.find(x => /^Killed on/.test(x)) || '').replace(/^Killed on\s*/, ''), by: (inner.find(x => /^by /.test(x)) || '').replace(/^by\s*/, '').replace(/\.$/, ''),
    when: inner.find(x => /\d{4}$/.test(x)) || '', after: rows.slice(end + 1) };
  return d;
}
function deathHtml() {
  const d = deathRead(); if (!d) return ''; DIED = d;
  const ask = d.after.map(r => r.replace(/\s+$/, '')).filter(Boolean);
  const cy = G.cy - (G.s.length - d.after.length), live = ask.map((l, i) => `<div class="dl">${esc(l)}${G.cv && i === ask.length - 1 ? '<i class="dcaret"></i>' : ''}</div>`).join('');
  const where = /^Level 0$/i.test(d.where) ? 'in the town' : d.where ? 'on ' + d.where.toLowerCase().replace(/^level/, 'dungeon level') : '';
  return `<div class="pane npanel deathp"><div class="dhead">Here lies</div><div class="dname">${esc(d.name)}</div><div class="dtitle">${esc([d.title, d.cls].filter(Boolean).join(' · '))}</div>
    <div class="dby">${/^quitting$/i.test(d.by) ? 'Laid down the quest ' : d.by ? `Slain by <b>${esc(d.by)}</b> ` : ''}${esc(where)}</div>
    <div class="dstats"><div><b>${esc(d.lev)}</b><span>level</span></div><div><b>${esc(d.exp)}</b><span>experience</span></div><div><b>${esc(d.au)}</b><span>gold</span></div></div>
    <div class="dwhen">${esc(d.when)}</div><div class="dask">${live}</div>
    <div class="dbtns"><span class="pgb" data-key="\r"><span class="key">Enter</span>see the character</span><span class="pgb" data-key="Esc"><span class="key">Esc</span>skip</span></div></div>`;
}

/* ---------- mouse ---------- */
// a point on the area map (the small map in the corner) as a square, from the player
function miniCellAt(ev) {
  const cv = $('#mini'); if (!cv || !S || !S.map) return null;
  const r = cv.getBoundingClientRect(), W = cv.clientWidth, H = cv.clientHeight, x = (ev.clientX - r.left) / SCALE, y = (ev.clientY - r.top) / SCALE;
  const mw = S.map.w, mh = S.map.h, sc = Math.min(W / mw, H / mh), cx = Math.floor((x - (W - mw * sc) / 2) / sc), cy = Math.floor((y - (H - mh * sc) / 2) / sc);
  if (cx < 0 || cy < 0 || cx >= mw || cy >= mh) return null;
  return { dx: cx - (mw >> 1), dy: cy - (mh >> 1), c: S.map.c[cy * mw + cx] };
}
function mapCellAt(ev) {
  const cv = $('#map'); if (!cv || !S || !S.map) return null;
  const r = cv.getBoundingClientRect(); const x = (ev.clientX - r.left) / SCALE, y = (ev.clientY - r.top) / SCALE;
  const W = cv.clientWidth, H = cv.clientHeight, T = TILE;
  const dx = Math.floor((x - W / 2 + T / 2) / T), dy = Math.floor((y - H / 2 + T / 2) / T);
  const mw = S.map.w, mh = S.map.h, cx = (mw >> 1) + dx, cy = (mh >> 1) + dy;
  return { dx, dy, c: cx >= 0 && cy >= 0 && cx < mw && cy < mh ? S.map.c[cy * mw + cx] : 0 };
}
const playing = () => S && S.map && !G.icky && !G.ov;
// is the game asking for a direction? 'aim' takes any square (a target), 'dir' only the eight around you
function aimMode() { if (!S || G.icky || G.ov) return ''; const t = (G.s[0] || '').replace(/\x01/g, ' '); return /^Direction \(/.test(t) ? (/target/.test(t) ? 'aim' : 'dir') : ''; }
// looking or picking a target: the prompt on the top line ends in the key list
function lookMode() { if (!S || G.icky || G.ov) return ''; const t = (G.s[0] || '').replace(/\x01/g, ' '); if (!/,<dir>\]/.test(t)) return ''; return /\[[^\]]*\bt,/.test(t) && !/\bm,/.test(t) ? 'target' : 'look'; }
// a vein or rubble right beside you: a click digs at it instead of bumping
const digHere = cell => { if (!(cell && cell.c && cell.c[0] && Math.max(Math.abs(cell.dx), Math.abs(cell.dy)) === 1) || S.mons.some(m => m.dx === cell.dx && m.dy === cell.dy)) return '';
  const f = DICT.f[cell.c[0]] || [''], n = f[0]; if (!/rubble|vein|magma|quartz|seam/i.test(n) || /passable/i.test(n)) return '';
  return /rubble/i.test(n) || S.p.dig == null || f[3] == null || S.p.dig > f[3] ? 'dig' : 'hard'; };   // the game will not even try a vein your digging cannot break
function cellTip(cell) {
  const c = cell.c; if (!c) return '';
  const out = [], m = S.mons.find(m => m.dx === cell.dx && m.dy === cell.dy);
  if (!cell.dx && !cell.dy) out.push('<b>You</b>');
  if (m) out.push(`<b style="color:${m.uniq ? '#ffb070' : '#f4efe4'}">${esc(cap(m.n.replace(/^(an?|the) /i, '')))}</b><br><span class="sub">${(DICT.r[m.r] || [])[3] != null ? 'level ' + DICT.r[m.r][3] + (threat(m) ? ` <b style="color:${threat(m) === 'deadly' ? '#ff8a70' : '#ffc46a'}">${threat(m)}</b>` : '') + ' · ' : ''}${m.asleep ? 'asleep' : m.afraid ? 'afraid' : m.pet ? 'your pet' : m.friendly ? 'friendly' : 'awake'} · ${esc(m.health)}</span>`);
  for (const o of S.floor) if (o.dx === cell.dx && o.dy === cell.dy) out.push(esc(o.n));
  if (c[0]) out.push(`<span style="color:#b3ac9f">${esc(cap((DICT.f[c[0]] || [''])[0]))}</span>`);
  if (lookMode()) return (out.join('<br>') || 'here') + `<div class="hint">${lookMode() === 'target' ? 'click: target this' : 'click: look here'}</div>`;
  if (aimMode()) return (out.join('<br>') || 'here') + `<div class="hint">${aimMode() === 'dir' ? (Math.max(Math.abs(cell.dx), Math.abs(cell.dy)) === 1 ? 'click: this way' : 'pick a square next to you') : 'click: aim here'}</div>`;
  if (!out.length) return '';
  const far = Math.abs(cell.dx) > 1 || Math.abs(cell.dy) > 1;
  const bow = m && (cell.dx || cell.dy) && (S.equip || []).some(e => e.slot === 'Shooting' && e.o) ? ' · shift-click: fire' : '';
  const stair = !cell.dx && !cell.dy && !S.floor.some(o => !o.dx && !o.dy) && c[0] ? featClass(c[0]) : '';
  return out.join('<br>') + `<div class="hint">${stair === 'down' ? 'click: go down' : stair === 'up' ? 'click: go up' : !cell.dx && !cell.dy ? 'click: pick up' : digHere(cell) === 'dig' ? 'click: tunnel' : digHere(cell) === 'hard' ? 'too hard to dig with what you have' : far ? (S.floor.some(o => o.dx === cell.dx && o.dy === cell.dy) && !m ? 'click: walk over and pick up' : 'click: walk here') + ((w => w ? ` (${w.length} steps)` : '')(m ? null : walkPath(cell.dx, cell.dy))) : m ? 'click: attack' : 'click: step'}${bow} · right-click: actions</div>`;
}
// after each turn, a tip resting on the map follows what is now under the pointer (a hurt creature, a square you moved off)
let MAPEV = null;
function tipRefresh() {
  const t = $('#tip'); if (!MAPEV || !t || t.style.display !== 'block' || !S || !S.map || !playing() || aimMode() || lookMode()) return;
  const el = document.elementFromPoint(MAPEV.clientX, MAPEV.clientY); if (!el || el.id !== 'map') return;
  const cell = mapCellAt(MAPEV); hover = cell; if (!cell) return showTip('', MAPEV);
  if (t.classList.contains('wide')) {   // the lore stays while the same kind of creature or item is still there
    const m = S.mons.find(m => m.dx === cell.dx && m.dy === cell.dy), fo = !m && S.floor.find(o => o.dx === cell.dx && o.dy === cell.dy && o.oi), key = m ? 'm:' + m.r : fo ? 'o:' + fo.oi : '';
    const lore = t.lastElementChild && t.lastElementChild.tagName === 'DIV' && /margin-top/.test(t.lastElementChild.getAttribute('style') || '') ? t.lastElementChild.outerHTML : '';
    if (key && key === loreKey && lore) return showTip(cellTip(cell) + lore, MAPEV);
    t.classList.remove('wide'); loreKey = ''; descHover = '';
  }
  showTip(cellTip(cell), MAPEV);
}
function showTip(html, ev) {
  const t = $('#tip'); if (!html) { t.style.display = 'none'; return; }
  t.innerHTML = html; t.style.display = 'block';
  const sw = innerWidth / SCALE, sh = VH, w = t.offsetWidth, h = t.offsetHeight;
  let x = ev.clientX / SCALE + 18, y = ev.clientY / SCALE + 20;
  if (x + w > sw - 8) x = ev.clientX / SCALE - w - 14; if (y + h > sh - 8) y = ev.clientY / SCALE - h - 12;
  t.style.left = Math.max(4, x) + 'px'; t.style.top = Math.max(4, y) + 'px';
}
let loreT = 0, loreKey = '', hover = null, atHover = '', DESC = {}, DESC_ASKED = {}, descHover = '', descEv = null;
function descRows(list) {
  const rows = list.map(r => { let h = '', cur = -1, txt = ''; const fl = () => { if (txt) h += cur === 1 || cur === 0 ? esc(txt) : `<span style="color:${readable(col(cur))}">${esc(txt)}</span>`; txt = ''; };
    const s = r.s.replace(/\s+$/, ''); for (let x = 0; x < s.length; x++) { const a = parseInt(r.a.substr(x * 2, 2), 16); if (s[x] !== ' ' && a !== cur) { fl(); cur = a; } txt += s[x]; } fl(); return h; });
  while (rows.length && !rows[rows.length - 1]) rows.pop();
  return `<div class="dsc">${rows.join('\n')}</div>`;
}
function descIn(m) {
  // something you could wear arrives with what you wear in that place now, shown beside it
  DESC[m.key] = m.cmp && m.cmp.length ? `<div class="dscw"><div><div class="dsch">this</div>${descRows(m.rows)}</div><div><div class="dsch">what you wear now</div>${descRows(m.cmp)}</div></div>` : descRows(m.rows);
  if (descHover === m.key && descEv && loreKey === m.key && hover) { $('#tip').classList.add('wide'); showTip(cellTip(hover) + '<div style="margin-top:8px;padding-top:8px;border-top:1px solid #3a2a1c">' + DESC[m.key] + '</div>', descEv); return; }
  if (descHover === m.key && descEv) { const de = descEv.target.closest && descEv.target.closest('[data-desc]'); $('#tip').classList.add('wide'); showTip(DESC[m.key] + (de ? descHint(de) : ''), descEv); }
}
function descHint(de) { const t = (de.dataset.tip || '').split('\n')[1] || (de.dataset.worn ? 'right-click: actions · drag onto the map to drop' : de.classList.contains('mob') ? de.dataset.tip : ''); return t ? `<div class="hint">${esc(t)}</div>` : ''; }
document.addEventListener('mousemove', ev => {
  const atEl = ev.target.closest && ev.target.closest('[data-at]'), atv = atEl ? atEl.dataset.at : '';
  if (atv !== atHover) { atHover = atv; if (S && S.map) requestAnimationFrame(drawMap); }   // a creature or item in the side lists: show where it is
  if (CTX) return showTip('', ev);
  const tipEl = ev.target.closest && ev.target.closest('[data-tip]');
  // an item: its full description from the game, fetched once and kept until the next turn
  const de = ev.target.closest && ev.target.closest('[data-desc]');
  descHover = de ? de.dataset.desc : ''; descEv = ev;
  if (de) { const d = DESC[descHover]; if (d) { $('#tip').classList.add('wide'); return showTip(d + descHint(de), ev); } if (!DESC_ASKED[descHover]) { DESC_ASKED[descHover] = 1; sendRaw('D ' + descHover.replace(':', ' ')); } }
  const sp = ev.target.closest && ev.target.closest('[data-sp]'); if ((sp ? sp.dataset.sp : '') !== spHover) { spHover = sp ? sp.dataset.sp : ''; schedule(); }
  const tp = ev.target.closest && ev.target.closest('[data-topic]'), th = tp ? topicHtml(tp.dataset.topic, tp.dataset.tt) : '';
  $('#tip').classList.toggle('wide', !!th);
  if (th) return showTip(th, ev);
  if (tipEl) { const [a, b] = tipEl.dataset.tip.split('\n'); return showTip(esc(a) + (b ? `<div class="hint">${esc(b)}</div>` : ''), ev); }
  if (ev.target.id === 'lmapc' && UI && UI.kind === 'lmap') {
    const r = ev.target.getBoundingClientRect(), g = lmapGeo(), cx = Math.floor((ev.clientX - r.left) / SCALE / g.s), cy = Math.floor((ev.clientY - r.top) / SCALE / g.s), c = UI.c[cy * UI.w + cx];
    const f = Array.isArray(c) ? c[0] : c, out = []; if (Array.isArray(c) && c[1]) out.push('<b>' + esc(cap((DICT.r[c[1]] || ['?'])[0])) + '</b>'); if (Array.isArray(c) && c[2]) out.push(esc((DICT.k[c[2]] || ['item'])[0])); if (f) out.push(`<span style="color:#b3ac9f">${esc((DICT.f[f] || [''])[0])}</span>`);
    return showTip(out.join('<br>'), ev);
  }
  if (ev.target.id === 'mini' && playing()) {
    const cell = miniCellAt(ev), f = cell && cell.c && cell.c[0] ? cap((DICT.f[cell.c[0]] || [''])[0]) : '';
    ev.target.style.cursor = f ? 'pointer' : 'default';
    return showTip(f ? `${esc(f)} <span class="sub">${dirOf(cell.dx, cell.dy)}</span><div class="hint">click: travel here</div>` : '', ev);
  }
  if (ev.target.id === 'map' && playing()) {
    MAPEV = ev; const cell = mapCellAt(ev);
    // the pointer says what a click will do: aim, attack, or walk
    { const foe = cell && S.mons.find(m => m.dx === cell.dx && m.dy === cell.dy && !m.pet && !m.friendly), want = aimMode() || lookMode() ? 'crosshair' : foe ? 'pointer' : 'default';
      if (ev.target.style.cursor !== want) ev.target.style.cursor = want; }
    if (!hover || !cell || hover.dx !== cell.dx || hover.dy !== cell.dy) {
      hover = cell; requestAnimationFrame(drawMap); clearTimeout(loreT); loreKey = '';
      // resting the pointer on a creature for a moment opens what you know of it
      const m = cell && S.mons.find(m => m.dx === cell.dx && m.dy === cell.dy), fo = cell && !m && S.floor.find(o => o.dx === cell.dx && o.dy === cell.dy && o.oi);
      const key = m ? 'm:' + m.r : fo ? 'o:' + fo.oi : '';
      if (key && !aimMode() && !lookMode()) loreT = setTimeout(() => { loreKey = key; descHover = loreKey; if (DESC[loreKey]) { $('#tip').classList.add('wide'); showTip(cellTip(cell) + '<div style="margin-top:8px;padding-top:8px;border-top:1px solid #3a2a1c">' + DESC[loreKey] + '</div>', descEv); } else if (!DESC_ASKED[loreKey]) { DESC_ASKED[loreKey] = 1; sendRaw('D ' + key.replace(':', ' ')); } }, 650);
    }
    if (loreKey && DESC[loreKey]) { descHover = loreKey; $('#tip').classList.add('wide'); return showTip((cell ? cellTip(cell) : '') + '<div style="margin-top:8px;padding-top:8px;border-top:1px solid #3a2a1c">' + DESC[loreKey] + '</div>', ev); }
    if (loreKey) descHover = loreKey;
    return showTip(cell ? cellTip(cell) : '', ev);
  }
  if (hover) { hover = null; requestAnimationFrame(drawMap); }
  clearTimeout(loreT); loreKey = '';
  showTip('', ev);
});
document.addEventListener('mouseleave', () => { hover = null; showTip('', {}); });
// an item picked from the floor list: walk there, then pick it up on arrival
let PICK_AT = null;
setInterval(() => {
  if (!PICK_AT) return; if (Date.now() - PICK_AT.t > 20000) { PICK_AT = null; return; }
  if (S && playing() && S.px === PICK_AT.x && S.py === PICK_AT.y && !expAsk()) { PICK_AT = null; if (S.floor.some(o => !o.dx && !o.dy)) sendText(cmd('g')); }
}, 150);
addEventListener('keydown', () => { PICK_AT = null; }, { capture: true });
document.addEventListener('mousedown', ev => {
  // the side lists: a creature row picks it as the target, an item row walks you to it
  const sideAt = ev.button === 0 && playing() && !aimMode() && !lookMode() && ev.target.closest && ev.target.closest('.mob[data-at], .row[data-at]');
  if (sideAt && !CTX) {
    const [dx, dy] = sideAt.dataset.at.split(',').map(Number);
    if (sideAt.classList.contains('mob')) sendRaw(`T ${dx} ${dy}`); else { sendRaw(`M 1 ${dx} ${dy}`); if (dx || dy) PICK_AT = { x: S.px + dx, y: S.py + dy, t: Date.now() }; }
    return;
  }
  const go = ev.target.closest && ev.target.closest('[data-go]');
  if (go) { const [dx, dy] = go.dataset.go.split(','); sendRaw(`M 3 ${dx} ${dy}`); return; }
  if (ev.target.id === 'lmapc' && UI && UI.kind === 'lmap' && !UI.wild) {
    const r = ev.target.getBoundingClientRect(), g = lmapGeo(), cx = Math.floor((ev.clientX - r.left) / SCALE / g.s), cy = Math.floor((ev.clientY - r.top) / SCALE / g.s);
    const c = UI.c[cy * UI.w + cx]; if (c && (Array.isArray(c) ? c[0] : c)) sendRaw(`M 3 ${cx - UI.px} ${cy - UI.py}`); return;
  }
  if (ev.target.id === 'map' && S && /-more-|Press Space to continue/.test(msgTop()) && ev.button === 0) { ev.preventDefault(); sendText(' '); return; }   // more to read: a click reads on
  if (ev.target.id === 'map' && playing() && lookMode() && G.lk && ev.button === 0) {
    // looking: walk the look cursor to the clicked square (free look first, then a step at a time)
    const cell = mapCellAt(ev); if (!cell) return; ev.preventDefault();
    const free = /\bm,/.test((G.s[0] || '').replace(/\x01/g, ' '));
    const aiming = lookMode() === 'target';
    let dx = cell.dx - G.lk[0], dy = cell.dy - G.lk[1], keys = free || (!dx && !dy) ? '' : 'o';   // free look starts where the cursor is
    while (dx || dy) { const sx = Math.sign(dx), sy = Math.sign(dy); keys += dirKey(sx, sy); dx -= sx; dy -= sy; }
    if (aiming) keys += 't';   // picking a target: the click picks it
    if (keys) sendText(keys); return;
  }
  if (ev.target.id === 'map' && playing() && aimMode() && ev.button === 0) {
    // the game is asking for a direction: a click answers it
    const cell = mapCellAt(ev); if (!cell) return; ev.preventDefault();
    if (aimMode() === 'dir') { if (Math.max(Math.abs(cell.dx), Math.abs(cell.dy)) === 1) sendText(dirKey(cell.dx, cell.dy)); return; }
    if (!cell.dx && !cell.dy) return;
    sendRaw(`T ${cell.dx} ${cell.dy}`); setTimeout(() => sendText('t'), 40); return;
  }
  if (ev.target.id === 'mini' && playing() && ev.button === 0 && !aimMode() && !lookMode()) {
    // the area map: click a known square to travel there
    const cell = miniCellAt(ev); ev.preventDefault(); if (!cell || !(cell.c && cell.c[0]) || (!cell.dx && !cell.dy)) return;
    if (!walkPath(cell.dx, cell.dy) && typeof exploreGoto === 'function' && exploreGoto(cell.dx, cell.dy)) return;
    sendRaw(`M 1 ${cell.dx} ${cell.dy}`); return;
  }
  if (ev.target.id === 'map' && playing()) {
    const cell = mapCellAt(ev); if (!cell) return;
    // nowhere known to go: say so here instead of a "cannot travel" line in the log
    if (!(cell.c && cell.c[0]) && (cell.dx || cell.dy) && !S.mons.some(m => m.dx === cell.dx && m.dy === cell.dy) && !S.floor.some(o => o.dx === cell.dx && o.dy === cell.dy)) { showTip('<span class="sub">unexplored</span>', ev); ev.preventDefault(); return; }
    // shift-click a creature: fire your launcher at it
    if (ev.button === 0 && ev.shiftKey && (cell.dx || cell.dy) && S.mons.some(m => m.dx === cell.dx && m.dy === cell.dy) && (S.equip || []).some(e => e.slot === 'Shooting' && e.o)) { cmdAim('f', cell.dx, cell.dy); ev.preventDefault(); return; }
    // standing on stairs with nothing to pick up: a click on yourself takes them
    const sc = ev.button === 0 && !cell.dx && !cell.dy && !S.floor.some(o => !o.dx && !o.dy) && cell.c && cell.c[0] ? featClass(cell.c[0]) : '';
    if (sc === 'down' || sc === 'up') { sendText(cmd(sc === 'down' ? '>' : '<')); ev.preventDefault(); return; }
    if (ev.button === 0 && digHere(cell)) { if (digHere(cell) === 'dig') sendText(cmd('T') + dirKey(cell.dx, cell.dy)); else postToast('Too hard to dig with what you have'); ev.preventDefault(); return; }
    if (ev.button === 0 && (cell.dx || cell.dy) && S.floor.some(o => o.dx === cell.dx && o.dy === cell.dy) && !S.mons.some(m => m.dx === cell.dx && m.dy === cell.dy)) PICK_AT = { x: S.px + cell.dx, y: S.py + cell.dy, t: Date.now() };   // an item there: pick it up on arrival
    // too far for the game to find a way (it forgets dark floor): walk it over the squares this interface remembers
    if (ev.button === 0 && Math.max(Math.abs(cell.dx), Math.abs(cell.dy)) > 1 && !walkPath(cell.dx, cell.dy) && typeof exploreGoto === 'function' && exploreGoto(cell.dx, cell.dy, S.mons.find(m => m.dx === cell.dx && m.dy === cell.dy && !m.pet && !m.friendly))) { ev.preventDefault(); return; }
    sendRaw(`M ${ev.button === 2 ? 2 : 1} ${cell.dx} ${cell.dy}`); ev.preventDefault(); return;
  }
  // the plain text panel: clicking a line that offers a lettered choice presses that letter
  if (ev.target.id === 'termc' && TERMGEO && ev.button === 0) {
    const r = ev.target.getBoundingClientRect(), gx = TERMGEO.x0 + Math.floor((ev.clientX - r.left) / SCALE / TERMGEO.cw), gy = TERMGEO.y0 + Math.floor((ev.clientY - r.top) / SCALE / TERMGEO.chh);
    if (BROWSE && G.cv) { browsePick(gx, gy, ev.detail >= 2); return; }
    const s = (G.s[gy] || '').replace(/\x01/g, ' '); let best = null, m; const re = /(^|[\s\[(])([A-Za-z0-9])[)\]]( |$)/g;
    while ((m = re.exec(s))) { const at = m.index + m[1].length; if (at <= gx + 1) best = m[2]; else if (!best) best = m[2]; }
    if (best) sendText(best);
    else if (/press any (other )?key|press space/i.test(G.s.join('\n'))) sendText(' ');
    else if (RECALL) sendText('r');   // a recall over the look prompt: back to looking   // a page that waits for any key: a click will do
  }
});
document.addEventListener('contextmenu', ev => ev.preventDefault());
// the wheel over the map zooms it
// a list browser: the game's cursor sits on the picked line of the column in use. A click moves it there (crossing columns
// first if need be), a second click on the picked line recalls it
function browseCol(gx) { const s = (G.s[G.cy] || ''); for (let x = Math.min(gx, G.cx); x < Math.max(gx, G.cx); x++) if (s[x] === '|') return gx < G.cx ? -1 : 1; for (let y = G.cy - 3; y <= G.cy + 3; y++) { const r = G.s[y] || ''; for (let x = Math.min(gx, G.cx); x < Math.max(gx, G.cx); x++) if (r[x] === '|') return gx < G.cx ? -1 : 1; } return 0; }
function browsePick(gx, gy, dbl) {
  const side = browseCol(gx);
  if (side) { sendText(side > 0 ? '6' : '4'); setTimeout(() => { if (BROWSE && G.cv) browsePick(gx, gy, false); }, 160); return; }
  const d = gy - G.cy;
  if (!d) { if (dbl && BROWSE.recall) sendText(BROWSE.recall); else if (BROWSE.recall && browsePick.last === gy && Date.now() - browsePick.t < 600) sendText(BROWSE.recall); browsePick.last = gy; browsePick.t = Date.now(); return; }
  sendText((d > 0 ? '2' : '8').repeat(Math.min(60, Math.abs(d)))); browsePick.last = gy; browsePick.t = Date.now();
}
let wheelAcc = 0;
document.addEventListener('wheel', ev => {
  if (BROWSE && ev.target.closest && ev.target.closest('#term')) {   // a list: the wheel walks the picked line
    wheelAcc += ev.deltaY; const n = Math.trunc(wheelAcc / 40); if (!n) return; wheelAcc -= n * 40;
    sendText((n > 0 ? '2' : '8').repeat(Math.min(8, Math.abs(n)))); return;
  }
  if (PAGER && ev.target.closest && ev.target.closest('#term,#native')) {   // a scrolling page: the wheel moves it three lines a notch
    wheelAcc += ev.deltaY; const n = Math.trunc(wheelAcc / 40); if (!n) return; wheelAcc -= n * 40;
    for (let i = 0; i < Math.min(12, Math.abs(n) * 3); i++) trigger(n > 0 ? KS.ArrowDown : KS.ArrowUp, {}); return;
  }
  if (ev.ctrlKey) ev.preventDefault();   // never let the window itself zoom
  if (ev.target.id !== 'map') return;
  // touchpads and free-spinning wheels send a stream of small steps: gather them, and change the zoom at most one notch
  // every 140 ms, so the map never jumps through several sizes at once
  const dy = ev.deltaMode === 1 ? ev.deltaY * 40 : ev.deltaMode === 2 ? ev.deltaY * 400 : ev.deltaY, t = performance.now();
  if (t - zoomLast > 300) zoomAcc = 0; zoomLast = t; zoomAcc += dy; if (Math.abs(zoomAcc) < 60 || t - zoomT < 140) return;
  const steps = [20, 24, 28, 32, 40, 48, 56, 64]; let i = steps.indexOf(TILE); if (i < 0) i = 3;
  i = Math.max(0, Math.min(steps.length - 1, i + (zoomAcc < 0 ? 1 : -1))); zoomAcc = 0; zoomT = t;
  if (steps[i] === TILE) return; TILE = steps[i];
  try { localStorage.setItem('tile', TILE); } catch (e) {}
  askView(); schedule();
}, { passive: false });
let zoomAcc = 0, zoomT = 0, zoomLast = 0;
try { const t = +localStorage.getItem('tile'); if (t >= 20 && t <= 64) TILE = t; } catch (e) {}
// tell the game how much map we can show
let lastView = '';
function askView() {
  const cv = $('#map'); if (!cv) return;
  const w = Math.ceil(cv.clientWidth / TILE) + 3 | 1, h = Math.ceil(cv.clientHeight / TILE) + 3 | 1, v = `V ${w} ${h}`;
  if (v !== lastView && w > 5 && h > 5) { lastView = v; sendRaw(v); }
}
