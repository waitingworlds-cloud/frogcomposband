// The spellbook. One page for every spell list the game shows (books, class powers, racial powers): the spells down
// the left, and the one you point at or click on a card at the right with what it does, what it costs and a button
// to cast it. Your books sit along the top as buttons, so changing book is one click. Letter keys still cast at once.
'use strict';
const SPB = { sel: '', books: null, cmd: 'm', book: '', auto: 0 };
const spbPicking = () => !!UI && UI.kind === 'items' && /which book/i.test(UI.prompt || '');
const spbBookName = n => { const m = /\[(.+?)\]/.exec(n); return m ? m[1] : baseName(n); };
function spbOnUi(m) {
  if (m.kind !== 'items' || !/which book/i.test(m.prompt || '')) return;
  SPB.books = (m.items || []).filter(i => i.o && i.k.trim()).map(i => ({ k: i.k, n: i.o.n, ki: i.o.ki, tv: i.o.tv }));
  SPB.cmd = /study/i.test(m.prompt) ? 'G' : /browse/i.test(m.prompt) ? 'b' : 'm';
  // opened with the mouse: go straight into the book last used (or the only one), so no extra step
  if (Date.now() - SPB.auto < 1500 && SPB.books.length) { SPB.auto = 0; const b = SPB.books.find(b => b.n === SPB.book) || SPB.books[0]; SPB.book = b.n; sendText(b.k); }
}
function spbVerb() {
  const prompt = (G.s[0] || '').replace(/\x01/g, ' ');
  if (spbPicking()) return { v: '', word: 'spell' };
  const m = /([A-Za-z]+) which ([a-z ]+?)\?/.exec(prompt), v = m ? m[1] : 'Cast';
  return { v: /^browse$/i.test(v) ? '' : /^study$/i.test(v) ? 'Learn' : cap(v.toLowerCase()), word: m ? m[2] : 'spell', study: /^study$/i.test(v) };
}
function spbCur() {
  if (!UI || UI.kind !== 'spells') return null; const rows = UI.rows || [];
  return rows.find(r => r.n === SPB.sel) || rows.find(r => r.n === spHover) || rows.find(r => r.n === uiSel) || (UI.sel >= 0 ? rows[UI.sel] : null) || null;
}
function spellsHtml() {
  const picking = spbPicking(), u = picking ? { rows: [], realm: '', unit: 'SP' } : UI, rows = u.rows || [], V = spbVerb();
  if (SPB.sel && !rows.some(r => r.n === SPB.sel)) SPB.sel = '';
  if (!picking && typeof LASTPICK !== 'undefined' && LASTPICK && LASTPICK.o.tv >= 90 && LASTPICK.o.tv <= 109 && Date.now() - LASTPICK.t < 4000) SPB.book = LASTPICK.o.n;
  const cur = spbCur(), unit = u.unit === 'HP' ? 'life' : u.unit === 'au' ? 'gold' : 'mana';
  const have = u.unit === 'HP' ? S.p.hp : u.unit === 'au' ? S.p.au : S.p.sp;
  const bookish = picking || (u.realm && u.realm !== 'Powers' && SPB.books && SPB.books.length);
  const two = rows.length > 22, rh = Math.max(28, Math.min(40, Math.floor(760 / Math.max(1, two ? Math.ceil(rows.length / 2) : rows.length))));
  const list = rows.map(r => {
    const f = r.fail == null ? null : r.fail, fc = f == null ? '' : f <= 15 ? '#a9c98c' : f <= 40 ? '#ffc46a' : '#ff7a66';
    const el = spElem(r.n), early = r.lvl != null && S.p.lev < r.lvl, unk = r.info === 'unknown', bookSp = r.info != null && u.realm !== 'Powers';
    // casting: what you have not learned steps back. learning: what you can learn now stands out, what you know already steps back
    const dim = r.dim || early || (V.study ? bookSp && !unk : unk), tag = V.study ? (bookSp && !unk ? 'known' : early ? '' : unk ? 'can learn' : '') : unk ? (early ? '' : 'not learned') : '';
    const mark = cur === r ? (SPB.sel === r.n ? 'sel' : 'hov') : '';
    return `<div class="tr sprow ${dim ? 'dim' : ''} ${mark}" data-sp="${esc(r.n)}"${el ? ` style="--el:${el}"` : ''}><span class="key" data-tip="Press this key to ${V.v ? V.v.toLowerCase() : 'read'} it at once">${esc(r.k)}</span><i class="spdot"></i>
      <span class="n nowrap" style="${dim ? '' : V.study && unk ? 'color:#7fd4ff' : 'color:#f4efe4'}">${esc(r.n)}${tag ? `<small class="sptag${tag === 'can learn' ? ' go' : ''}">${tag}</small>` : ''}</span>
      <span class="dir">${r.lvl != null ? 'lv ' + r.lvl : ''}</span>
      ${r.cost != null ? `<span class="spm ${u.unit === 'HP' ? 'hp' : ''} ${r.cost > have ? 'short' : ''}">${icon('potion')}<b>${r.cost}</b></span>` : '<span></span>'}
      <span class="spf" style="color:${fc}">${f != null ? f + '%' : ''}</span></div>`;
  }).join('');
  const books = bookish && SPB.books ? `<span class="spbooks">${(picking ? (UI.items || []).filter(i => i.o && i.k.trim()).map(i => ({ k: i.k, n: i.o.n, ki: i.o.ki, tv: i.o.tv })) : SPB.books).map(b => `<span class="spbk ${!picking && b.n === SPB.book ? 'on' : ''}" data-spbook="${esc(b.k)}" data-tip="${esc(cap(b.n.replace(/^(an?|the) /i, '')))}"><span class="slot t-book">${artHtml(b.ki, 28) || icon('book')}</span>${esc(spbBookName(b.n))}${picking ? `<span class="key">${esc(b.k)}</span>` : ''}</span>`).join('')}</span>` : '';
  // choosing a book: the books themselves, large, in place of an empty list
  const pk = !picking ? null : SPB.cmd === 'G' ? ['Learn a new spell', 'Which book will you learn from?'] : SPB.cmd === 'b' ? ['Your spellbooks', 'Which book do you want to read?'] : ['Cast a spell', 'Which book is it in?'];
  const tiles = picking ? `<div class="spq">${pk[1]}</div><div class="spbigs">${(UI.items || []).filter(i => i.o && i.k.trim()).map(i => `<div class="spbig" data-spbook="${esc(i.k)}"><span class="slot t-book">${artHtml(i.o.ki, 56) || icon('book')}</span><div><b>${esc(spbBookName(i.o.n))}</b><i>${esc(cap(i.o.n.replace(/^(an?|the) /i, '').replace(/\s*\[.*$/, '')))}</i></div><span class="key">${esc(i.k)}</span></div>`).join('')}</div>` : '';
  const title = picking ? pk[0] : V.study ? 'Learn a new spell' : u.realm || 'Spells';
  const hint = picking ? 'Pick a book to open it.' : !V.v ? 'Point at a spell to read what it does.' : `Click a ${V.word} to read it, then ${V.v}. Double-click ${V.v.toLowerCase()}s it at once.`;
  return `<div class="pane npanel spell2" style="--rh:${rh}px">
    <div class="tabs multi"><div class="on">${esc(title)}</div>${picking ? '' : books}<span class="dir" style="margin-left:auto;align-self:center;font-size:15px">${u.unit === 'au' ? '' : u.unit === 'HP' ? `you have ${S.p.hp} life` : `you have ${S.p.sp} of ${S.p.msp} mana`}</span></div>
    <div class="sh2"><div class="nrows ${two ? 'two' : ''}">${picking ? tiles : list || '<div class="sub" style="padding:18px 6px">Nothing here yet.</div>'}</div><div class="shcard">${spbCardHtml(cur, u, V, have, unit)}</div></div>
    <div class="nfoot"><span class="sub">${hint}</span><span class="grow"></span>${V.study || picking || !(typeof CAN_STUDY !== 'undefined' && CAN_STUDY) ? '' : '<span class="row" data-spstudy="1"><span class="key">G</span>learn a new spell</span>'}<span class="row" data-key="\x1b"><span class="key">Esc</span>close</span></div></div>`;
}
function spbCardHtml(r, u, V, have, unit) {
  if (!r && spbPicking()) return `<div class="shempty"><div class="shemi">${icon('book')}</div><div>Pick a book.</div><div class="sub">Click it, or press its key.</div></div>`;
  if (!r) return `<div class="shempty"><div class="shemi">${icon('book')}</div><div>Point at a ${esc(V.word && V.word.length < 14 ? V.word.replace(/^dragon /, '') : 'spell')} to see what it does.</div><div class="sub">${V.v ? `Click it, then ${V.v}.` : ''}</div></div>`;
  const el = spElem(r.n), early = r.lvl != null && S.p.lev < r.lvl, short = r.cost != null && r.cost > have, pinned = SPB.sel === r.n;
  const prof = r.prof ? r.prof.replace(/[\[\]]/g, '').trim() + (r.max ? ' (max)' : '') : '';
  const facts = [r.cost != null ? ['costs', `${r.cost} ${unit}`] : null, r.fail != null ? ['chance to fail', r.fail + '%'] : null, r.lvl != null ? ['level', r.lvl] : null, prof ? ['your skill', prof] : null, r.stat ? ['uses', r.stat] : null].filter(Boolean);
  const why = early ? `You need to be level ${r.lvl}.` : r.fail === 100 ? 'You cannot manage this yet.' : short ? `You have ${have} ${unit}: casting it now will strain you.` : '';
  const label = V.v ? `${V.v}${r.cost != null && !V.study ? ` for ${r.cost} ${unit}` : ''}` : '';
  return `<div class="shhead"><div class="slot big spicon"${el ? ` style="--el:${el}"` : ''}>${SPARK}</div><div class="grow" style="min-width:0"><div class="shn">${esc(r.n)}</div><div class="dir">${esc([u.realm && u.realm !== 'Powers' ? u.realm : '', r.lvl != null ? 'level ' + r.lvl : ''].filter(Boolean).join(' · '))}</div></div></div>
    <div class="shdesc"><div class="dsc">${esc(r.desc || '')}</div>${r.info && r.info !== 'unknown' ? `<div class="dsc" style="color:#ffcf9e;margin-top:8px">${esc(r.info)}</div>` : ''}</div>
    <div class="shbuy"><div class="facts">${facts.map(([l, v]) => `<div><span class="lbl">${l}</span><b>${esc(String(v))}</b></div>`).join('')}</div>
      ${why ? `<div class="spwarn">${why}</div>` : ''}
      ${!label ? '' : early ? `<div class="shgo off">Needs level ${r.lvl}</div>` : pinned ? `<div class="shgo" data-spgo="1"><span class="key">Enter</span>${esc(label)}</div>` : `<div class="shgo ghost">Click the ${V.word} to ${V.v.toLowerCase()} it</div>`}</div>`;
}
function spbCast() { const r = spbCur(), V = spbVerb(); if (!r || !V.v || (r.lvl != null && S.p.lev < r.lvl)) return false; SPB.sel = ''; sendText(r.k); return true; }
function spbBook(k) {
  if (spbPicking()) { const b = (UI.items || []).find(i => i.k === k); if (b && b.o) SPB.book = b.o.n; sendText(k); return; }
  const b = (SPB.books || []).find(b => b.k === k); if (!b || b.n === SPB.book) return;
  SPB.book = b.n; SPB.sel = ''; HUB.last = 'spells'; HUB.t = Date.now(); HUB.hold = Date.now() + 700;
  sendBytes([27]); sendBytes([27]); setTimeout(() => { sendText('\\' + SPB.cmd); setTimeout(() => sendText(k), 60); }, 100);
}
function spbKey(e) {
  if (!UI || UI.kind !== 'spells' || !uiOnTop() || e.ctrlKey || e.altKey || e.metaKey) return false;
  const rows = UI.rows || [];
  if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !(UI.sel >= 0) && rows.length) {
    const i = rows.indexOf(spbCur()), n = rows.length, j = i < 0 ? (e.key === 'ArrowDown' ? 0 : n - 1) : (i + (e.key === 'ArrowDown' ? 1 : n - 1)) % n;
    SPB.sel = rows[j].n; schedule(); return true;
  }
  if (e.key === 'Enter' && SPB.sel) return spbCast();
  return false;
}
document.addEventListener('click', ev => {
  if (!ev.target.closest) return;
  const go = ev.target.closest('[data-spgo]'), bk = ev.target.closest('[data-spbook]'), st = ev.target.closest('[data-spstudy]'), row = ev.target.closest('.spell2 [data-sp]');
  // the Cast button on the bar and the Spells tab open the book last used, with no "which book?" step
  const kb = ev.target.closest('[data-key]'); if (kb && /^\\?m$/.test(kb.dataset.key) && !(UI && uiOnTop())) SPB.auto = Date.now();
  if (!go && !bk && !st && !row) return;
  ev.stopPropagation(); ev.preventDefault();
  if (go) spbCast();
  else if (bk) spbBook(bk.dataset.spbook);
  else if (st) { SPB.auto = Date.now(); sendBytes([27]); sendBytes([27]); setTimeout(() => sendText('\\G'), 100); HUB.last = 'spells'; HUB.t = Date.now(); HUB.hold = Date.now() + 700; }
  else if (SPB.sel !== row.dataset.sp) { SPB.sel = row.dataset.sp; schedule(); }
}, true);
document.addEventListener('dblclick', ev => { const row = ev.target.closest && ev.target.closest('.spell2 [data-sp]'); if (row && UI && UI.kind === 'spells') { ev.preventDefault(); SPB.sel = row.dataset.sp; spbCast(); } }, true);
