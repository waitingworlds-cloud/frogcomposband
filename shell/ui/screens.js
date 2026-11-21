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

// The pack and what you wear. Looking through them (i, e): click a thing to pin it to the card at the right, which
// says what it is and offers what can be done with it as buttons. When the game asks "which one?" for some
// command, a click simply answers, and the card previews whatever the pointer is on.
const ITEMS = { sel: '', hov: '', acts: [] };
const itemsViewer = () => !!UI && UI.kind === 'items' && /examine which|inspect which/i.test(UI.prompt || '');
function itemsTab() { return (UI.tabs || []).find(t => t.on) || (UI.tabs || [])[0] || {}; }
function itemsCur() { const id = ITEMS.sel || ITEMS.hov; return id ? UI.items.find(i => i.o && i.k === id) : null; }
function itemsHtml() {
  const u = UI, tab = itemsTab(), equip = tab && tab.loc === 1, viewer = itemsViewer();
  if (ITEMS.tab !== tab.name) { ITEMS.tab = tab.name; ITEMS.sel = ITEMS.hov = ''; }
  if (ITEMS.sel && (!viewer || !u.items.some(i => i.o && i.k === ITEMS.sel))) ITEMS.sel = '';
  if (ITEMS.hov && !u.items.some(i => i.o && i.k === ITEMS.hov)) ITEMS.hov = '';
  const cur = itemsCur();
  let rows = '', lastCat = '', n = 0, cats = 0;
  for (const it of u.items) {
    const o = it.o, cat = equip ? '' : o ? TVCAT(o.tv) : '';
    if (cat && cat !== lastCat) { rows += `<div class="catr">${cat}</div>`; lastCat = cat; cats++; }
    const ic = o ? tvIcon(o.tv) : 'ring'; n++;
    const has = !!(o && it.k.trim()), mark = has && cur && cur.k === it.k ? (ITEMS.sel === it.k ? 'sel' : 'hov') : '';
    rows += `<div class="tr ${oq(o)} ${mark}" ${it.k.trim() ? `data-key="${esc(it.k)}"` : ''}${has ? ` data-ik="${esc(it.k)}"` : ''}><span class="key" style="${it.k.trim() ? '' : 'visibility:hidden'}"${viewer ? '' : ' data-tip="Or press this key"'}>${esc(it.k)}</span><div class="slot t-${ic} ${o ? '' : 'empty'}">${(o && artHtml(o.ki, 34)) || icon(ic)}</div>
      <span class="n nowrap">${o ? esc(o.n) : '<i style="color:#5a5750">nothing</i>'}${it.slot ? `<small>${esc(it.slot)}</small>` : ''}</span>
      <span class="num" style="text-align:right">${it.failr != null ? `<span style="color:#ff9a86">${(it.failr / 10).toFixed(1)}%</span>` : ''}</span><span class="dir">${o ? lb(o.w) + ' lb' : ''}</span></div>`;
  }
  if (!n) rows = '<div class="sub" style="padding:18px 6px">Nothing here.</div>';
  // long lists: tighten the rows so the whole page fits
  const room = (viewer ? 730 : 590) - cats * 34, rh = Math.max(27, Math.min(38, Math.floor(room / Math.max(1, n))));
  // a tab is a button: the game steps through its tabs with "/", so a click sends as many as it takes
  const tcur = Math.max(0, u.tabs.findIndex(t => t.on)), tabs = u.tabs.map((t, i) => `<div class="${t.on ? 'on' : 'tgo'}"${t.on ? '' : ` data-key="${'/'.repeat((i - tcur + u.tabs.length) % u.tabs.length)}" data-tip="Show ${esc(t.name.toLowerCase())}"`}>${esc(t.name)}</div>`).join('');
  let ask = u.prompt.replace(/\n+/g, '\n').split('\n').filter(l => viewer ? !/examine which|inspect which/i.test(l) : true).join('\n');
  // a "which one?" list with a single tab is headed by the question itself
  const q1 = !viewer && /\?\s*$/.test(plain(ask)) && plain(ask).trim().split('\n').length === 1 ? plain(ask).trim().replace(/\s*\(Esc to exit\)/i, '') : '';
  if (q1) ask = '';
  return `<div class="pane npanel inv inv2" style="--rh:${rh}px">
    <div class="tabs${u.tabs.length > 2 || !viewer ? ' multi' : ''}">${q1 ? `<div class="on">${esc(q1)}</div>${u.tabs.length > 1 ? `<span class="ptabs"><i>from your</i>${u.tabs.map((t, i) => `<span class="ptab${t.on ? ' on' : ''}"${t.on ? '' : ` data-key="${'/'.repeat((i - tcur + u.tabs.length) % u.tabs.length)}"`}>${esc(t.name.toLowerCase().replace(/^inventory$/, 'pack').replace(/^equipment$/, 'gear'))}</span>`).join('')}</span>` : ''}` : tabs}<span class="dir" style="margin-left:auto;align-self:center;font-size:14px">${lb(u.wgt)} lb${u.pages > 1 ? ` · page ${u.page} of ${u.pages}` : ''}</span></div>
    <div class="sh2"><div class="nrows">${rows}</div><div class="shcard">${itemsCardHtml(cur, equip, viewer)}</div></div>
    <div class="nfoot">${q1 ? '<span class="sub">Click one, or press its key.</span>' : `<span class="live" style="white-space:pre-line">${rich(ask)}</span>`}<span class="grow"></span>
      ${u.tabs.length > 1 ? '<span class="row" data-key="/"><span class="key">/</span>next tab</span>' : ''}${u.pages > 1 ? '<span class="row" data-key=" "><span class="key">Space</span>next page</span>' : ''}<span class="row" data-key="\x1b"><span class="key">Esc</span>close</span></div>
  </div>`;
}
// when the game lists only some of your things (the potions, say) its letters are not the pack's letters:
// find the thing itself among what you carry or wear, so the card describes the right one
function itemsDescKey(it, tab) {
  const list = tab.loc === 1 ? (S && S.equip) || [] : tab.loc === 2 ? (S && S.pack) || [] : null; if (!list) return '';
  const same = list.filter(e => (e.o || e).n === it.o.n), hit = same.find(e => e.k === it.k) || same[0];
  return hit ? (tab.loc === 1 ? 'e:' : 'p:') + hit.k : '';
}
function itemsCardHtml(it, worn, viewer) {
  ITEMS.acts = [];
  const verb = viewer ? '' : (/^\s*([A-Z][a-z]+)\b/.exec((UI.prompt || '').split('\n').pop() || '') || [])[1] || 'Choose';
  if (!it) return `<div class="shempty"><div class="shemi">${icon(worn ? 'armor' : 'potion')}</div><div>${viewer ? 'Point at anything to see what it is.' : esc(verb) + ' which one?'}</div><div class="sub">${viewer ? 'Click it to see what you can do with it.' : 'Click it in the list, or press its key.'}</div></div>`;
  const o = it.o, tab = itemsTab(), ic = tvIcon(o.tv), dk = itemsDescKey(it, tab), pinned = viewer && ITEMS.sel === it.k;
  if (dk && !DESC[dk] && !DESC_ASKED[dk]) { DESC_ASKED[dk] = 1; sendRaw('D ' + dk.replace(':', ' ')); }
  ITEMS.want = dk;
  const one = o.n.replace(/^(\d+|an?|the) /i, '');
  let foot;
  if (!viewer) foot = `<div class="shgo ghost">Click it to ${esc(verb.toLowerCase())}</div>`;
  else if (!pinned) foot = `<div class="shgo ghost">Click it for what you can do</div>`;
  else {
    const hs = !worn && typeof hbFromObj === 'function' && hbFromObj(o);
    const acts = objItems(o, worn).filter(a => a.k !== 'I').map(a => ({ k: a.k, n: a.n, run: () => { sendBytes([27]); setTimeout(a.run, 60); } }));
    if (hs) acts.push({ k: '', n: 'Put on the hotbar', run: () => hbSet(-1, hs) });
    ITEMS.acts = acts;
    foot = `<div class="iacts">${acts.map((a, i) => `<div class="iact ${i === 0 ? 'main' : ''}" data-iact="${i}">${i === 0 ? '<span class="key">Enter</span>' : ''}${esc(a.n)}</div>`).join('')}</div>`;
  }
  return `<div class="shhead"><div class="slot big t-${ic}">${artHtml(o.ki, 84) || icon(ic)}</div><div class="grow" style="min-width:0"><div class="shn">${esc(cap(one))}</div><div class="dir">${it.slot ? esc(it.slot) + ' · ' : ''}${o.num > 1 ? o.num + ' · ' : ''}${lb(o.w)} lb</div></div></div>
    <div class="shdesc">${(dk && DESC[dk] && shopDescTrim(DESC[dk])) || (dk ? '<span class="sub">reading the label…</span>' : '')}</div>
    <div class="shbuy">${foot}</div>`;
}
function itemsMove(d) {
  const list = UI.items.filter(i => i.o && i.k.trim()); if (!list.length) return;
  const i = list.findIndex(x => x.k === ITEMS.sel), j = i < 0 ? (d > 0 ? 0 : list.length - 1) : Math.max(0, Math.min(list.length - 1, i + d));
  ITEMS.sel = list[j].k; schedule();
}
// keys that belong to the list and its card while you look through your things; every other key goes to the game
function itemsKey(e) {
  if (!itemsViewer() || !uiOnTop() || e.ctrlKey || e.altKey || e.metaKey) return false;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { itemsMove(e.key === 'ArrowDown' ? 1 : -1); return true; }
  if (!ITEMS.sel) return false;
  if (e.key === 'Enter') { const a = ITEMS.acts[0]; if (a) a.run(); return true; }
  if (e.key === 'Escape') { ITEMS.sel = ''; schedule(); return true; }
  return false;
}
document.addEventListener('click', ev => {
  if (!UI || UI.kind !== 'items' || !ev.target.closest) return;
  const act = ev.target.closest('[data-iact]');
  if (act) { ev.stopPropagation(); ev.preventDefault(); const a = ITEMS.acts[+act.dataset.iact]; if (a) a.run(); return; }
  const row = ev.target.closest('.inv2 [data-ik]'); if (!row || !itemsViewer()) return;
  ev.stopPropagation(); ev.preventDefault();   // looking through your things: a click pins the item, it does not type its letter
  if (ITEMS.sel !== row.dataset.ik) { ITEMS.sel = row.dataset.ik; schedule(); }
}, true);
document.addEventListener('mousemove', ev => {
  if (!UI || UI.kind !== 'items' || !ev.target.closest) return;
  const row = ev.target.closest('.inv2 [data-ik]'), id = row ? row.dataset.ik : '';
  if (id && id !== ITEMS.hov) { ITEMS.hov = id; if (!ITEMS.sel) schedule(); }
});

let uiSel = '', spHover = '';
function gridHas(re) { for (let y = 0; y < G.h; y++) if (re.test((G.s[y] || '').replace(/\x01/g, ' '))) return true; return false; }
// a spell's element read off its name, for a coloured edge and a faint glow on its card
const SP_ELEM = [[/acid|corro/i, '#a6e05a'], [/lightning|zap|shock|thunder|storm|elec/i, '#9fb4ff'], [/frost|cold|\bice|freez|glacier|blizzard/i, '#8fd8ff'],
  [/fire|flame|burn|inferno|heat|plasma|meteor|hellfire|scorch/i, '#ff7a2a'], [/poison|stinking|venom|toxic/i, '#6ac85a'],
  [/dark|nether|shadow|death|drain|curse|doom|vampir|necro/i, '#a06ad0'], [/heal|cure|bless|holy|\blight\b|sun|star|radian|prayer|protection/i, '#ffe08a'],
  [/mana|chaos|missile|arcane|teleport|blink|portal|time|gravity|nexus|dimension/i, '#c08aff']];
function spElem(n) { const m = SP_ELEM.find(([re]) => re.test(n)); return m ? m[1] : ''; }
const SHOP_TIPS = { B: 'Buy everything on the shelves', S: 'Pay to swap the stock for new goods', R: 'Pay to have an item held for you', '?': 'The game&#39;s help for this place', '\x1b': 'Leave' };
// The shop works by pointing: click a thing to see it on the card at the right, set how many, press Buy (or Sell).
// Nothing is asked by letter. The card sends the game the item and the count in one go ("B b slot count").
// The keys still do what they always did: b and s start the game's own questions, shown on the line below the list.
const SHOP = { tab: 'buy', sel: null, hov: null, qty: 1, name: '', sure: '' };
// the home and the museum are the same shelves without prices: take and leave instead of buy and sell
const shopLike = () => !!UI && (UI.kind === 'shop' || UI.kind === 'home');
const shopWords = () => { const u = UI, home = u.kind === 'home', mus = home && !!u.museum;
  return { home, mus, free: home || !!u.nosell,
    t1: mus ? 'On display' : home ? 'Kept here' : 'For sale', t2: mus ? 'Donate from your pack' : home ? 'Leave from your pack' : (u.nosell ? 'Give' : 'Sell') + ' from your pack',
    get: mus ? '' : home ? 'Take' : 'Buy', put: mus ? 'Donate' : home ? 'Leave here' : u.nosell ? 'Give' : 'Sell',
    kget: home ? 'g' : 'b', kput: home ? 'd' : 's' }; };
const shopAsking = () => /which item|quantity|really |\[y\/n\]|-more-|\(Inven|\(Equip/i.test([0, 1, 2].map(y => (G.s[y] || '').replace(/\x01/g, ' ')).join(' '));
const shopId = r => (r.wh ? 's' + r.wh : 'b') + ':' + r.sl;
function shopRows() { const rows = (UI && UI.rows) || []; return { buy: rows.filter(r => !r.wh), sell: rows.filter(r => r.wh) }; }
function shopCur() { const { buy, sell } = shopRows(), id = SHOP.sel || SHOP.hov; return id ? buy.concat(sell).find(r => shopId(r) === id) : null; }
// how many of this could change hands: what is there, and what the gold reaches
function shopMax(r) { return r.wh || UI.kind === 'home' ? r.num : Math.max(0, Math.min(r.num, r.price > 0 ? Math.floor(UI.gold / r.price) : r.num)); }
function shopHtml() {
  const u = UI, { buy, sell } = shopRows(), W = shopWords(), gold = u.gold != null ? u.gold : S && S.p ? S.p.au : 0;
  if (SHOP.name !== u.name) { SHOP.name = u.name; SHOP.tab = 'buy'; SHOP.sel = SHOP.hov = null; SHOP.qty = 1; SHOP.sure = ''; }
  const msg = [0, 1, 2].map(y => (G.s[y] || '').replace(/\x01/g, ' ').trim()).filter(Boolean).join(' ');
  const asking = shopAsking(), askSell = asking && /sell which|give which|drop which|donate which|\(Inven|\(Equip/i.test(msg);
  if (SHOP.sel && !buy.concat(sell).some(r => shopId(r) === SHOP.sel)) SHOP.sel = null;
  if (SHOP.hov && !buy.concat(sell).some(r => shopId(r) === SHOP.hov)) SHOP.hov = null;
  const tab = askSell ? 'sell' : asking ? 'buy' : SHOP.tab, list = tab === 'sell' ? sell : buy, cur = asking ? null : shopCur();
  if (cur) SHOP.qty = Math.max(1, Math.min(SHOP.qty, Math.max(1, shopMax(cur))));
  const rowsHtml = list.map(r => { const ic = tvIcon(r.tv), id = shopId(r), selling = !!r.wh, dead = W.home ? false : selling ? (!u.nosell && !r.price) : !r.ok;
    const act = asking ? (selling ? '' : ` data-key="${esc(r.k)}"`) : ` data-shop="${id}"`;
    return `<div class="srow ${r.art || r.ego ? 'ego' : ''} ${dead ? 'cant' : ''} ${cur && shopId(cur) === id ? (SHOP.sel === id ? 'sel' : 'hov') : ''}"${act}>
    ${selling ? '' : `<span class="key kb" data-tip="With the keys: ${W.mus ? 'x' : W.kget}, then ${esc(r.k)}">${esc(r.k)}</span>`}<div class="slot t-${ic}">${artHtml(r.ki, 40) || icon(ic)}</div>
    <div class="grow" style="min-width:0"><div class="n nowrap">${esc(r.n)}</div><div class="dir">${lb(r.w)} lb${r.num > 1 && W.home ? ' each' : ''}${r.off ? ` · <span style="color:#a9c98c">${r.off}% off</span>` : ''}</div></div>
    <span class="price num"${W.home ? ' style="color:#c9b28a" data-tip="The game&#39;s score for it"' : ''}>${W.home ? (r.score || 0).toLocaleString() : selling && u.nosell ? '' : selling && !r.price ? '<i>no interest</i>' : r.price.toLocaleString()}</span></div>`; }).join('')
    || `<div class="sub" style="padding:20px">${tab === 'sell' ? (W.home ? 'Your pack is empty.' : 'You carry nothing this shop takes.') : W.mus ? 'Nothing has been donated yet.' : W.home ? 'Your home is empty. Leave things here from the other tab.' : 'The shelves are empty.'}</div>`;
  const cmds = W.mus ? [['r', 'remove'], ['?', 'help'], ['\x1b', 'leave']] : W.home ? [['r', 'destroy'], ['?', 'help'], ['\x1b', 'leave']] : [['B', 'buy out'], ['S', 'shuffle stock'], ['R', 'reserve'], ['?', 'help'], ['\x1b', 'leave']];
  const tot = W.home ? buy.reduce((a, r) => a + r.w * r.num, 0) : 0;
  return `<div class="pane npanel shopp shop2">
    <div class="row" style="gap:18px;align-items:flex-end;border-bottom:1px solid #000;box-shadow:0 1px 0 #4a4e54;padding-bottom:10px">
      <div class="grow"><div class="spn" style="font-size:34px;color:var(--em2)">${esc(u.name)}</div><div class="sub">${W.home ? `${u.count} ${u.count === 1 ? 'thing' : 'things'}${W.mus ? ' on display · donations are final' : ` kept here · ${lb(tot)} lb on this page`}` : `${esc(u.owner)}, ${/^[aeiou]/i.test(u.race) ? 'an' : 'a'} ${esc(u.race.toLowerCase())}, keeps this shop · pays up to ${u.purse.toLocaleString()} for one item`}</div></div>
      <div style="text-align:right"><div class="lbl">your gold</div><div class="num" style="font-size:28px;color:#ffcf6a">${gold.toLocaleString()}</div></div></div>
    <div class="sh2">
      <div class="sh2l">
        <div class="shtabs"><div class="${tab === 'buy' ? 'on' : ''}" data-shoptab="buy">${W.t1} <small>${buy.length}</small></div><div class="${tab === 'sell' ? 'on' : ''}" data-shoptab="sell">${W.t2} <small>${sell.length}</small></div>${u.pages > 1 ? `<span class="grow"></span><span class="row shpg" data-key=" " data-tip="Next page of the shelves (Space)">page ${u.page} of ${u.pages} &rsaquo;</span>` : ''}</div>
        <div class="shlist">${rowsHtml}</div>
      </div>
      <div class="shcard">${asking ? `<div class="shask"><div class="dsch">${W.home ? 'the game asks' : 'the shopkeeper asks'}</div><div class="live" style="font-size:20px">${lookKeys(esc(msg))}${qtyKeys()}</div><div class="hint">Answer with the keys, or click an item in the list. Esc cancels.</div></div>` : shopCardHtml(cur)}</div>
    </div>
    <div class="live shmsg">${asking ? '' : lookKeys(esc(msg))}</div>
    <div class="nfoot" style="flex-wrap:wrap">${cmds.map(([k, n]) => `<span class="row" data-key="${k}"${SHOP_TIPS[k] ? ` data-tip="${SHOP_TIPS[k]}"` : ''}><span class="key">${k === '\x1b' ? 'Esc' : k}</span>${n}</span>`).join('')}<span class="grow"></span><span class="sub">keys: ${W.mus ? '' : `<b>${W.kget}</b> ${W.get.toLowerCase()} · `}<b>${W.kput}</b> ${W.put.toLowerCase()} · arrows, Tab and Enter work on the list</span></div></div>`;
}
function shopCardHtml(r) {
  const u = UI;
  if (!r) return `<div class="shempty"><div class="shemi">${icon('gold')}</div><div>Point at anything to see what it is.</div><div class="sub">Click it to ${shopWords().mus ? 'look closer, or donate from your pack' : shopWords().home ? 'take it or leave it here' : 'buy or sell'}.</div></div>`;
  const W = shopWords(), gold = u.gold != null ? u.gold : S && S.p ? S.p.au : 0;
  const selling = !!r.wh, id = shopId(r), pinned = SHOP.sel === id, ic = tvIcon(r.tv), dk = selling ? (r.wh === 'p' ? 'p:' + r.k : '') : (W.home ? 'h:' : 's:') + r.sl;
  if (dk && !DESC[dk] && !DESC_ASKED[dk]) { DESC_ASKED[dk] = 1; sendRaw('D ' + dk.replace(':', ' ')); }
  SHOP.want = dk;
  const price = r.price || 0, max = shopMax(r), q = Math.min(SHOP.qty, Math.max(1, max)), total = price * q, free = W.free;
  const cant = W.home ? '' : selling ? (!free && !price ? 'This shop has no interest in it' : '') : (max < 1 ? 'You do not have enough gold' : '');
  const one = r.n.replace(/^(\d+|an?|the) /i, ''), verb = selling ? W.put : W.get, view = !verb;   // the museum's shelves are only for looking
  const step = r.num > 1 && !cant && !view ? `<div class="shqty"><span class="lbl">how many</span>
      <span class="key kb ${q <= 1 ? 'off' : ''}" data-shopq="-1" data-tip="One fewer (Left)">&minus;</span><b class="num">${q}</b><span class="key kb ${q >= max ? 'off' : ''}" data-shopq="1" data-tip="One more (Right)">+</span>
      <span class="shchip" data-shopq="=1">1</span>${max > 3 ? `<span class="shchip" data-shopq="=${Math.ceil(max / 2)}">half</span>` : ''}<span class="shchip" data-shopq="=${max}" data-tip="${selling || W.home ? 'All ' + r.num : max < r.num ? 'As many as your gold buys' : 'All ' + r.num}">${selling || W.home || max >= r.num ? 'all' : 'max'} ${max}</span></div>` : '';
  const sum = free ? (W.home && !view ? `<div class="sub shafter">${selling ? 'Your pack will be' : 'You will carry'} <b>${lb(r.w * q)} lb</b> ${selling ? 'lighter' : 'more'}</div>` : '') : `<div class="shsum"><span>${selling ? 'They pay' : 'Price'}</span><b class="num">${price.toLocaleString()}</b><span class="sub">${r.num > 1 ? 'each' : 'gold'}</span>
      ${q > 1 || r.num > 1 ? `<span class="grow"></span><span>Total</span><b class="num tot">${total.toLocaleString()}</b>` : ''}</div>
      <div class="sub shafter">${cant ? '' : `Leaves you with <b>${(gold + (selling ? total : -total)).toLocaleString()}</b> gold`}</div>`;
  const final = W.mus && selling, sure = final && SHOP.sure === id;
  const label = sure ? 'Yes, donate it for good' : `${verb}${q > 1 ? ' ' + q : ''}${free ? '' : ` for ${total.toLocaleString()} gold`}`;
  return `<div class="shhead"><div class="slot big t-${ic}">${artHtml(r.ki, 84) || icon(ic)}</div><div class="grow" style="min-width:0"><div class="shn">${esc(cap(one))}</div><div class="dir">${r.num > 1 ? `${r.num} ${selling ? 'in your pack' : W.home ? 'here' : 'in stock'} · ` : ''}${lb(r.w)} lb${r.num > 1 ? ' each' : ''}${r.off ? ` · <span style="color:#a9c98c">${r.off}% off</span>` : ''}</div></div></div>
    <div class="shdesc">${(dk && DESC[dk] && shopDescTrim(DESC[dk])) || (dk ? '<span class="sub">reading the label…</span>' : '')}</div>
    <div class="shbuy">${pinned ? step : ''}${sum}
      ${final && pinned ? `<div class="sub shafter" style="color:#ff9a86">${sure ? 'It can never be taken back.' : 'Donations are final.'}</div>` : ''}
      ${view ? `<div class="shgo ghost">On display. Donations cannot be taken back.</div>` : cant ? `<div class="shgo off">${cant}</div>` : pinned ? `<div class="shgo ${sure ? 'warn' : ''}" data-shopgo="1"><span class="key">Enter</span>${label}</div>` : `<div class="shgo ghost">Click the item to ${verb.toLowerCase()}${/here$/.test(verb) ? '' : ' it'}</div>`}</div>`;
}
// the game's page opens with the item's name and weight, which the card already shows above
const shopDescTrim = h => h.replace(/<div class="dsc">[^\n]*\n/g, '<div class="dsc">');
function shopTrade() {
  const r = shopCur(); if (!r || SHOP.sel !== shopId(r) || shopAsking()) return false;
  const W = shopWords(), max = shopMax(r), q = Math.max(1, Math.min(SHOP.qty, max));
  if (W.home) {
    if (!r.wh && W.mus) return true;                                             // nothing leaves the museum
    if (r.wh && W.mus && SHOP.sure !== shopId(r)) { SHOP.sure = shopId(r); schedule(); return true; }   // a donation is asked twice
    sendRaw(r.wh ? `H d ${r.wh} ${r.sl} ${q}` : `H g ${r.sl} ${q}`);
  } else {
    if (max < 1 || (r.wh && !UI.nosell && !r.price)) return true;
    sendRaw(r.wh ? `B s ${r.wh} ${r.sl} ${q}` : `B b ${r.sl} ${q}`);
  }
  SHOP.qty = 1; SHOP.sure = ''; return true;
}
function shopQty(d) { const r = shopCur(); if (!r) return; const max = Math.max(1, shopMax(r)); SHOP.qty = Math.max(1, Math.min(max, String(d)[0] === '=' ? +String(d).slice(1) : SHOP.qty + (+d))); schedule(); }
function shopMove(d) {
  const { buy, sell } = shopRows(), list = SHOP.tab === 'sell' ? sell : buy; if (!list.length) return;
  const i = list.findIndex(r => shopId(r) === SHOP.sel), j = i < 0 ? (d > 0 ? 0 : list.length - 1) : Math.max(0, Math.min(list.length - 1, i + d));
  SHOP.sel = shopId(list[j]); SHOP.qty = 1; SHOP.sure = ''; schedule();
  requestAnimationFrame(() => { const e = document.querySelector('.shlist .srow.sel'); if (e && e.scrollIntoView) e.scrollIntoView({ block: 'nearest' }); });
}
// keys that belong to the list and its card; every other key goes to the game as before
function shopKey(e) {
  if (!shopLike() || !uiOnTop() || shopAsking() || e.ctrlKey || e.altKey || e.metaKey) return false;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { shopMove(e.key === 'ArrowDown' ? 1 : -1); return true; }
  if (e.key === 'Tab') { SHOP.tab = SHOP.tab === 'buy' ? 'sell' : 'buy'; SHOP.sel = SHOP.hov = null; SHOP.qty = 1; SHOP.sure = ''; schedule(); return true; }
  if (!SHOP.sel) return false;
  if (e.key === 'Enter') return shopTrade();
  if (e.key === 'Escape') { SHOP.sel = null; SHOP.qty = 1; SHOP.sure = ''; schedule(); return true; }
  if (e.key === 'ArrowRight' || e.key === '+' || e.key === '=') { shopQty(1); return true; }
  if (e.key === 'ArrowLeft' || e.key === '-') { shopQty(-1); return true; }
  return false;
}
document.addEventListener('click', ev => {
  if (!shopLike() || !ev.target.closest) return;
  const go = ev.target.closest('[data-shopgo]'), q = ev.target.closest('[data-shopq]'), tb = ev.target.closest('[data-shoptab]'), row = ev.target.closest('[data-shop]');
  if (!go && !q && !tb && !row) return;
  ev.stopPropagation(); ev.preventDefault();
  if (go) shopTrade();
  else if (q) shopQty(q.dataset.shopq);
  else if (tb) { if (!shopAsking() && SHOP.tab !== tb.dataset.shoptab) { SHOP.tab = tb.dataset.shoptab; SHOP.sel = SHOP.hov = null; SHOP.qty = 1; SHOP.sure = ''; schedule(); } }
  else if (SHOP.sel !== row.dataset.shop) { SHOP.sel = row.dataset.shop; SHOP.qty = 1; SHOP.sure = ''; schedule(); }
}, true);
document.addEventListener('dblclick', ev => { const row = ev.target.closest && ev.target.closest('[data-shop]'); if (row && shopLike() && SHOP.sel === row.dataset.shop) { ev.preventDefault(); shopTrade(); } }, true);
document.addEventListener('mousemove', ev => {
  if (!shopLike() || !ev.target.closest) return;
  const row = ev.target.closest('[data-shop]'), id = row ? row.dataset.shop : null;
  if (id && id !== SHOP.hov) { SHOP.hov = id; if (!SHOP.sel) schedule(); }
});
document.addEventListener('wheel', ev => { if (shopLike() && SHOP.sel && ev.target.closest && ev.target.closest('.shqty')) { ev.preventDefault(); shopQty(ev.deltaY < 0 ? 1 : -1); } }, { passive: false });

function homeHtml() { return shopHtml(); }

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
function nativeAfter() {
  lmapDraw();
  document.querySelectorAll('#native .rmob').forEach(c => { if (c._ok) return; const d = 2 * SCALE * (devicePixelRatio || 1); c.width = c.height = Math.round(72 * d); const g = c.getContext('2d'); g.scale(d, d); sprite.flat = true; c._ok = sprite(g, 'mon', c.dataset.n, 0, 0, 72); sprite.flat = false; });
}

function nativeHtml() {
  NATIVE_SIDE = false;
  if (!(G.ov || G.icky)) return '';
  const dh = deathHtml(); if (dh) return dh;
  if (!UI || !UI.kind || !uiOnTop()) return bldgHtml() || optsHtml() || menuHtml();
  if (UI.kind === 'items') return spbPicking() ? spellsHtml() : itemsHtml();
  if (UI.kind === 'spells') return spellsHtml();
  if (UI.kind === 'shop') return shopHtml();
  if (UI.kind === 'home') return homeHtml();
  if (UI.kind === 'lmap') return lmapHtml();
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
  // the game offers to write the character to a file: say so plainly, with the name being typed in a field
  const fi = ask.findIndex(l => /^\s*Filename:/.test(l));
  if (fi >= 0) {
    const typed = ask[fi].replace(/^\s*Filename:\s?/, '');
    return deathFrame(d, `<div class="dnote">Type a name to keep a record of this character as a file, or leave it empty.</div><div class="dfield">${esc(typed)}<i class="dcaret"></i></div>`,
      `<span class="pgb" data-key="\r"><span class="key">Enter</span>${typed.trim() ? 'save the record' : 'see the character'}</span><span class="pgb" data-key="Esc"><span class="key">Esc</span>skip</span>`);
  }
  const cy = G.cy - (G.s.length - d.after.length), live = ask.map((l, i) => `<div class="dl">${esc(l)}${G.cv && i === ask.length - 1 ? '<i class="dcaret"></i>' : ''}</div>`).join('');
  return deathFrame(d, live, `<span class="pgb" data-key="\r"><span class="key">Enter</span>${/-more-/.test(msgTop()) ? 'continue' : 'see the character'}</span><span class="pgb" data-key="Esc"><span class="key">Esc</span>skip</span>`);
}
function deathFrame(d, live, btns) {
  const where = /^Level 0$/i.test(d.where) ? 'in the town' : d.where ? 'on ' + d.where.toLowerCase().replace(/^level/, 'dungeon level') : '';
  return `<div class="pane npanel deathp"><div class="dhead">Here lies</div><div class="dname">${esc(d.name)}</div><div class="dtitle">${esc([d.title, d.cls].filter(Boolean).join(' · '))}</div>
    <div class="dby">${/^quitting$/i.test(d.by) ? 'Laid down the quest ' : d.by ? `Slain by <b>${esc(d.by)}</b> ` : ''}${esc(where)}</div>
    <div class="dstats"><div><b>${esc(d.lev)}</b><span>level</span></div><div><b>${esc(d.exp)}</b><span>experience</span></div><div><b>${esc(d.au)}</b><span>gold</span></div></div>
    <div class="dwhen">${esc(d.when)}</div><div class="dask">${live}</div>
    <div class="dbtns">${btns}</div></div>`;
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
// an edge pointer under the mouse: the creature it points to
function edgeAt(ev) {
  const cv = $('#map'); if (!cv || !EDGE.length) return null;
  const r = cv.getBoundingClientRect(), x = (ev.clientX - r.left) / SCALE, y = (ev.clientY - r.top) / SCALE;
  const e = EDGE.find(e => Math.hypot(e.x - x, e.y - y) <= e.r); return e ? e.m : null;
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
// where a bolt aimed at a square would stop: at the first wall (or closed door, or rubble) or the first creature on the way
function aimPath(dx, dy) {
  const n = Math.max(Math.abs(dx), Math.abs(dy)), mw = S.map.w, cx = mw >> 1, cy = S.map.h >> 1;
  for (let i = 1; i < n; i++) {
    const x = Math.round(dx * i / n), y = Math.round(dy * i / n), c = S.map.c[(cy + y) * mw + cx + x];
    const fc = c && c[0] ? featClass(c[0]) : '';
    if (fc === 'wall' || fc === 'door' || fc === 'rubble') return { dx: x, dy: y, why: 'wall', i, n };
    const m = S.mons.find(m => m.dx === x && m.dy === y && !m.pet);
    if (m) return { dx: x, dy: y, why: 'mon', m, i, n };
  }
  return null;
}
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
  if (aimMode()) return (out.join('<br>') || 'here') + `<div class="hint">${aimMode() === 'dir' ? (Math.max(Math.abs(cell.dx), Math.abs(cell.dy)) === 1 ? 'click: this way' : 'pick a square next to you') : (() => { const b = aimPath(cell.dx, cell.dy); return b ? (b.why === 'wall' ? 'a wall is in the way · ' : `it would hit ${esc(b.m.n.replace(/^(an?|the) /i, 'the '))} first · `) : ''; })() + 'click: aim here'}</div>`;
  if (!out.length) return '';
  const far = Math.abs(cell.dx) > 1 || Math.abs(cell.dy) > 1;
  const bow = m && (cell.dx || cell.dy) && (S.equip || []).some(e => e.slot === 'Shooting' && e.o) ? ' · shift-click: fire' + ((b => b ? (b.why === 'wall' ? ' (a wall is in the way)' : ` (${esc(b.m.n.replace(/^(an?|the) /i, 'the '))} is in the way)`) : '')(aimPath(cell.dx, cell.dy))) : '';
  const blocked = !m && (cell.dx || cell.dy) && !digHere(cell) && c[0] ? ({ wall: 'no way through', pit: 'you need to fly to cross it' })[featClass(c[0])] || '' : '';   // say so instead of offering a step that bumps
  const stair = !cell.dx && !cell.dy && !S.floor.some(o => !o.dx && !o.dy) && c[0] ? featClass(c[0]) : '';
  return out.join('<br>') + `<div class="hint">${stair === 'down' ? 'click: go down' : stair === 'up' ? 'click: go up' : !cell.dx && !cell.dy ? 'click: pick up' : digHere(cell) === 'dig' ? 'click: tunnel' : digHere(cell) === 'hard' ? 'too hard to dig with what you have' : blocked ? blocked : far ? (S.floor.some(o => o.dx === cell.dx && o.dy === cell.dy) && !m ? 'click: walk over and pick up' : 'click: walk here') + ((w => w ? ` (${w.length} steps)` : '')(m ? null : walkPath(cell.dx, cell.dy))) : m ? 'click: attack' : 'click: step'}${bow} · right-click: actions</div>`;
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
let TIP_EL = null;   // the button a hint belongs to: when a redraw takes the button away, the hint goes with it
function tipStale() { if (TIP_EL && !TIP_EL.isConnected) { TIP_EL = null; const t = $('#tip'); if (t) t.style.display = 'none'; } }
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
/* ---------- compare: what changes if you put this on ----------
 * From the two describe pages: armour, damage per hit, to-hit, weight and launcher power as numbers, then every
 * property one has and the other lacks, as gains and losses. */
const rowTxt = r => r.s.replace(/\x01/g, ' ').replace(/\s+$/, '');
function cmpFacts(rows) {
  const t = rows.map(rowTxt), name = (t[0] || '').replace(/\s+[\d.]+ lbs?$/, '').trim(), wt = +(((t[0] || '').match(/([\d.]+) lbs?$/) || [])[1] || 0);
  // blocks between blank lines; a block of plain sentences is what the thing looks like or where it came from: not a property
  const PROP = /^(Sustain|Increase|Decrease|Aura of|Immunity to|Resist|Slay|Vulnerability to|Kill|Brand|[+-][\d.]+%? to|It |Score:)/;
  const blocks = []; let cur = [];
  for (let i = 1; i < t.length; i++) { if (t[i].trim()) cur.push(t[i]); else if (cur.length) { blocks.push(cur); cur = []; } } if (cur.length) blocks.push(cur);
  const lines = [];
  const STRONG = /^(Sustain|Increase|Decrease|Aura of|Immunity to|Resist|Slay|Vulnerability to|Kill|Brand|[+-][\d.]+%? to)/;
  for (const [bi, b] of blocks.entries()) {
    const f = b[0].trim();
    if (/^You can't remember/.test(f)) continue;
    if (bi === 0 && !STRONG.test(f)) continue;   // the first block says what it looks like
    if (!PROP.test(f) && /\b[a-z]{3,}\b/.test(f)) continue;   // lower-case words: a sentence about it, not a list of powers
    for (const l of b) { if (/^\s{3,}\S/.test(l) && lines.length) lines[lines.length - 1] += ' ' + l.trim(); else lines.push(l.trim()); }
  }
  const facts = new Set();
  for (const l of lines) {
    if (/^(Score:|This object|You can't|It reminds you)/.test(l)) continue;
    const m = l.match(/^(Sustain|Increase|Decrease|Aura of|Immunity to|Resist|Slay|Vulnerability to|Kill|Brand|[+-][\d.]+%? to)\s+(.+?)\.?$/);
    const parts = m ? m[2].split(/,\s*|\s+and\s+/) : !/\.$/.test(l) && /,/.test(l) ? l.split(/,\s*/) : [l.replace(/\.$/, '')];
    for (const p of parts) if (p.trim()) facts.add(m ? m[1] + ' ' + p.trim() : p.trim());
  }
  const num = (re, f) => { const x = name.match(re); return x ? f(x) : null; };
  return { name, wt, facts,
    ac: num(/\[(\d+),\s*([+-]\d+)\]/, x => +x[1] + +x[2]) ?? num(/\[([+-]\d+)\]/, x => +x[1]),
    dice: num(/\((\d+)d(\d+)\)/, x => +x[1] * (+x[2] + 1) / 2),
    hit: num(/\(([+-]\d+),\s*([+-]\d+)\)/, x => [+x[1], +x[2]]) ?? num(/\(([+-]\d+)\)/, x => [+x[1], 0]),   // body armour shows only a to-hit penalty
    mult: num(/\(x(\d+(?:\.\d+)?)\)/, x => +x[1]) };
}
function cmpHtml(rows, cmp) {
  const a = cmpFacts(rows), b = cmpFacts(cmp), out = [];
  const d = (label, x, y, unit, fix) => { if (x == null && y == null) return; x = x || 0; y = y || 0; const v = x - y; if (Math.abs(v) < 1e-9) return;
    out.push(`<span class="${v > 0 ? 'up' : 'down'}">${v > 0 ? '+' : '−'}${Math.abs(v).toFixed(fix || 0)}${unit || ''} ${label}</span>`); };
  d('armour', a.ac, b.ac);
  if (a.dice != null || b.dice != null) d('damage a hit', (a.dice || 0) + ((a.hit || [0, 0])[1]), (b.dice || 0) + ((b.hit || [0, 0])[1]), '', 1);
  if (a.hit || b.hit) d('to hit', (a.hit || [0])[0], (b.hit || [0])[0]);
  if (a.dice == null && b.dice == null && (a.hit || b.hit)) d('to damage', (a.hit || [0, 0])[1], (b.hit || [0, 0])[1]);
  d('launcher power', a.mult, b.mult, 'x', 1);
  // bonuses that both have in different amounts read as one change ("+1 Stealth"), not a gain and a loss
  const nums = fs => { const m = {}; for (const f of fs) { const x = f.match(/^([+-][\d.]+)(%?) to (.+)$/); if (x) m[x[3]] = [+x[1], x[2]]; } return m; };
  const na = nums(a.facts), nb = nums(b.facts);
  for (const k of new Set([...Object.keys(na), ...Object.keys(nb)])) { const x = na[k] || [0, (nb[k] || [])[1]], y = nb[k] || [0, x[1]]; d(k, x[0], y[0], x[1] || y[1], Number.isInteger(x[0] - y[0]) ? 0 : 2); }
  const isNum = f => /^[+-][\d.]+%? to /.test(f);
  const gain = [...a.facts].filter(f => !isNum(f) && !b.facts.has(f)), loss = [...b.facts].filter(f => !isNum(f) && !a.facts.has(f));
  const wd = a.wt - b.wt; const wtxt = Math.abs(wd) >= .05 ? `<span class="${wd > 0 ? 'down' : 'up'} soft">${wd > 0 ? '+' : '−'}${Math.abs(wd).toFixed(1)} lb${a.dice != null && wd > 0 ? ' (heavier: maybe fewer blows)' : ''}</span>` : '';
  if (!out.length && !gain.length && !loss.length && !wtxt) return `<div class="cmpb"><div class="dsch">if you wear this instead</div><span class="soft">no difference you know of</span></div>`;
  return `<div class="cmpb"><div class="dsch">if you wear this instead of ${esc(b.name.replace(/^(an?|the) /i, '').replace(/\s*[([][^)\]]*[)\]]/g, ''))}</div>${out.join('')}${wtxt}
    ${gain.length ? `<div class="cmpl up">${gain.map(f => '+ ' + esc(f)).join('<br>')}</div>` : ''}${loss.length ? `<div class="cmpl down">${loss.map(f => '− ' + esc(f)).join('<br>')}</div>` : ''}</div>`;
}
function descIn(m) {
  if (typeof loreIn === 'function') loreIn(m);
  if ((shopLike() && SHOP.want === m.key) || (UI && UI.kind === 'items' && ITEMS.want === m.key)) setTimeout(schedule, 0);
  // something you could wear arrives with what you wear in that place now, shown beside it
  DESC[m.key] = m.cmp && m.cmp.length ? cmpHtml(m.rows, m.cmp) + `<div class="dscw"><div><div class="dsch">this</div>${descRows(m.rows)}</div><div><div class="dsch">what you wear now</div>${descRows(m.cmp)}</div></div>` : descRows(m.rows);
  if (descHover === m.key && descEv && loreKey === m.key && hover) { $('#tip').classList.add('wide'); showTip(cellTip(hover) + '<div style="margin-top:8px;padding-top:8px;border-top:1px solid #3a2a1c">' + DESC[m.key] + '</div>', descEv); return; }
  if (descHover === m.key && descEv) { const de = descEv.target.closest && descEv.target.closest('[data-desc]'); $('#tip').classList.add('wide'); showTip(DESC[m.key] + (de ? descHint(de) : ''), descEv); }
}
function descHint(de) { const t = (de.dataset.tip || '').split('\n')[1] || (de.dataset.worn ? 'right-click: actions · drag onto the map to drop' : de.classList.contains('mob') ? de.dataset.tip : ''); return t ? `<div class="hint">${esc(t)}</div>` : ''; }
document.addEventListener('mousemove', ev => {
  const atEl = ev.target.closest && ev.target.closest('[data-at]'), atv = atEl ? atEl.dataset.at : '';
  if (atv !== atHover) { atHover = atv; if (S && S.map) requestAnimationFrame(drawMap); }
  if (atEl && atEl.classList.contains('mob') && S && S.mons) { const [ax, ay] = atv.split(',').map(Number); recallSet(S.mons.find(m => m.dx === ax && m.dy === ay)); }   // a creature or item in the side lists: show where it is
  if (typeof CTX !== 'undefined' && CTX) return showTip('', ev);
  const tipEl = ev.target.closest && ev.target.closest('[data-tip]');
  // an item: its full description from the game, fetched once and kept until the next turn
  const de = ev.target.closest && ev.target.closest('[data-desc]');
  descHover = de ? de.dataset.desc : ''; descEv = ev;
  if (de) { const d = DESC[descHover]; if (d) { $('#tip').classList.add('wide'); return showTip(d + descHint(de), ev); } if (!DESC_ASKED[descHover]) { DESC_ASKED[descHover] = 1; sendRaw('D ' + descHover.replace(':', ' ')); } }
  const sp = ev.target.closest && ev.target.closest('[data-sp]'); if ((sp ? sp.dataset.sp : '') !== spHover) { spHover = sp ? sp.dataset.sp : ''; schedule(); }
  const tp = ev.target.closest && ev.target.closest('[data-topic]'), th = tp ? topicHtml(tp.dataset.topic, tp.dataset.tt) : '';
  $('#tip').classList.toggle('wide', !!th);
  if (th) return showTip(th, ev);
  TIP_EL = tipEl || null;
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
  if (ev.target.id === 'map' && playing() && !aimMode() && !lookMode()) {
    const em = edgeAt(ev);
    if (em) { ev.target.style.cursor = 'pointer'; if (hover) { hover = null; requestAnimationFrame(drawMap); } return showTip(`<b>${esc(cap(em.n.replace(/^(an?|the) /i, '')))}</b> <span class="sub">${dirOf(em.dx, em.dy)}${em.asleep ? ' · asleep' : ''}</span><div class="hint">beyond the edge of the view · click: target it</div>`, ev); }
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
      if (m && !m.pet) recallSet(m); const key = fo ? 'o:' + fo.oi : '';   // a creature's lore shows in the Recall panel; an item's in the tip
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
  if (ev.target.id === 'map' && playing() && ev.button === 0 && !aimMode() && !lookMode()) { const em = edgeAt(ev); if (em) { ev.preventDefault(); sendRaw(`T ${em.dx} ${em.dy}`); return; } }
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
  if (ev.target.classList && ev.target.classList.contains('t-c') && TERMGEO && ev.button === 0) {
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
  if (BROWSE && ev.target.closest && ev.target.closest('#term,.hubterm')) {   // a list: the wheel walks the picked line
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
