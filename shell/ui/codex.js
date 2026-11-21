// The journal's knowledge lists (items you know, the bestiary, terrain...). The game draws them as a two-column text
// table: groups on the left, the entries of the picked group on the right. Here the same rows are a proper list:
// group buttons on the left, entries with their pictures and counts on the right. A click picks a row (the game's own
// cursor is walked there), a double click or Read opens the write-up. Arrow keys and r work as before.
'use strict';
let CDX_K = null, CDX_TOP = 0;
function codexKind(name) {   // an item kind by the name the list shows
  if (!DICT || !DICT.k) return null;
  if (!CDX_K) { CDX_K = {}; DICT.k.forEach((k, i) => { if (k && k[0]) { const n = tkey(k[0]); if (!(n in CDX_K)) CDX_K[n] = i; } }); }
  const n = tkey(name); if (n in CDX_K) return CDX_K[n];
  const s = n.replace(/^(potions?|scrolls?|rings?|amulets?|wands?|rods?|staffs?|staves|mushrooms?|flasks?) of /, ''); if (s in CDX_K) return CDX_K[s];
  const p = n.replace(/s$/, ''); return p in CDX_K ? CDX_K[p] : null;
}
const CDX_COL = { Found: 'found', Bought: 'bought', Used: 'used', Dest: 'destroyed', Kills: 'slain' };
function codexHtml(b, y0, y1) {
  let hy = -1; for (let y = y0; y < b.foot; y++) if (/^Group\s+Name\b/.test(rowText(y))) { hy = y; break; }
  if (hy < 0) return '';
  let bx = -1; for (let y = hy + 2; y < b.foot && bx < 0; y++) bx = rowText(y).indexOf('|');
  if (bx < 1) return '';
  const cols = rowText(hy).slice(bx).replace(/^\s*Name/, '').trim().split(/\s+/).filter(Boolean), num = cols.filter(c => CDX_COL[c]), symFirst = cols[0] === 'Sym';
  const what = /item|enchant|artifact/i.test(b.name) ? 'obj' : /bestiary/i.test(b.name) ? 'mon' : /terrain/i.test(b.name) ? 'feat' : '';
  const attrAt = (y, x) => ((G.a[y] || [])[x] || 0) & 31, inGroups = G.cx < bx;
  const groups = [], ents = []; let total = null;
  for (let y = hy + 2; y < b.foot; y++) {
    const r = rowText(y), g = r.slice(0, bx).trim(), e = r.slice(bx + 1);
    if (g) groups.push({ name: g, y, sel: attrAt(y, r.search(/\S/)) === 14 });
    if (!e.trim()) continue;
    const at = bx + 1 + e.search(/\S/), m = /^\s*(.*?)(?:\s{2,}(\S.*))?$/.exec(e), vals = m[2] ? m[2].trim().split(/\s+/) : [];
    const nums = what === 'feat' ? [] : symFirst ? vals.slice(-num.length) : vals.slice(0, num.length);
    const row = { name: m[1].trim(), y, nums, sel: attrAt(y, at) === 14 };
    if (/^Totals?$/i.test(row.name)) total = row; else ents.push(row);
  }
  if (!groups.length) return '';
  const art = n => {
    if (what === 'obj') { const ki = codexKind(n), a = ki != null ? artHtml(ki, 40) : ''; if (a) return `<span class="cda">${a}</span>`; }
    if (what === 'mon' || what === 'feat') return `<canvas class="ptart cda" data-k="${what}" data-n="${esc(n)}"></canvas>`;
    return `<span class="ptart em cda">${esc(n.charAt(0).toUpperCase())}</span>`;
  };
  const gcol = `<div class="cdg">${groups.map(g => `<div class="cdgi ${g.sel ? 'sel' : ''} ${g.sel && inGroups ? 'cur' : ''}" data-bgx="1" data-bgy="${g.y}">${esc(cap(g.name))}</div>`).join('')}</div>`;
  const grid = `grid-template-columns:44px 1fr ${num.map(() => '92px').join(' ')}`;
  const head = num.length ? `<div class="cdh" style="${grid}"><span></span><span></span>${num.map(c => `<span>${CDX_COL[c]}</span>`).join('')}</div>` : '';
  const rows = ents.map(e => `<div class="cde ${e.sel ? 'sel' : ''} ${e.sel && !inGroups ? 'cur' : ''}" style="${grid}" data-bgx="${bx + 2}" data-bgy="${e.y}"${b.recall ? ' data-tip="Click to pick · double-click to read about it"' : ''}>${art(e.name)}<b>${esc(cap(e.name))}</b>${num.map((c, i) => `<span class="${+e.nums[i] ? '' : 'zero'}">${esc(e.nums[i] || '')}</span>`).join('')}</div>`).join('');
  const tot = total ? `<div class="cde tot" style="${grid}"><span></span><b>In all</b>${num.map((c, i) => `<span>${esc(total.nums[i] || '')}</span>`).join('')}</div>` : '';
  const cur = ents.find(e => e.sel) || null, gname = (groups.find(g => g.sel) || groups[0]).name;
  const empty = !ents.length ? `<div class="cdnone">${inGroups ? 'Pick a group on the left to see what you know in it.' : 'Nothing known here yet.'}</div>` : '';
  return `<div class="cdx">${gcol}<div class="cdl"><div class="cdt"><b>${esc(cap(gname))}</b>${cur && b.recall ? `<span class="grow"></span><span class="btn go" data-key="${esc(b.recall)}">Read about ${esc(cur.name.length > 28 ? 'it' : cap(cur.name))}</span>` : ''}</div>${head}<div class="cdrows">${rows}${empty}</div>${tot}</div></div>`;
}
document.addEventListener('click', ev => {
  const r = ev.target.closest && ev.target.closest('[data-bgy]'); if (!r || ev.button !== 0 || !BROWSE) return;
  browsePick(+r.dataset.bgx, +r.dataset.bgy, ev.detail >= 2);
});

// The journal's rosters (what you have slain, who travels with you). The game writes them as a page of text lines;
// here each line is a tile with the creature's picture. Paging stays the game's own.
function rosterMon(name) {   // the picture for a creature named in the plural ("Goombas", "pile of coins")
  if (!TS || !TS.mon) return ''; const n = tkey(name.replace(/^pile of /i, ''));
  const b = n.replace(/^the /, ''); const tries = [n, b, 'the ' + b, n.replace(/s$/, ''), n.replace(/es$/, ''), n.replace(/ies$/, 'y'), n.replace(/ves$/, 'f'), n.replace(/men$/, 'man'), n.replace(/mice$/, 'mouse'), n.replace(/(\w+)s (\w+)$/, '$1 $2'), n.replace(/s of /, ' of ')];
  for (const t of tries) if (TS.mon[t]) return t;
  return '';
}
function rosterHtml(y0, y1, x0, x1, skip, mode) {
  let say = '', tot = [], tiles = '', bands = ''; const pets = mode === 'pets';
  for (let y = y0; y <= y1; y++) {
    if (skip[y]) continue; const t = rowText(y).slice(x0, x1 + 1).trim(); if (!t || /^[- ]{6,}$/.test(t)) continue; let m;
    if ((m = /^(Total|Upkeep): (.*)$/.exec(t))) { tot.push(m[1] === 'Upkeep' ? 'upkeep ' + m[2].replace(/\.$/, '') : m[2].replace(/\.$/, '')); continue; }
    if (/^You have (defeated|turned in) |^No known uniques/.test(t)) { say = t.replace('No known uniques alive.', 'No named foe you know of is still alive.').replace('turned in all wanted monsters', 'claimed every bounty on the list'); continue; }
    if (mode === 'alive') {
      if ((m = /^Total\s+alive:\s*(\d+)$/.exec(t))) { tot.push(m[1] + ' still alive that you know of'); continue; }
      if ((m = /^(Surface|Level\s+(\d+)-\s*(\d*))\s+alive:\s*(\d+)$/.exec(t))) { if (+m[4]) bands += `<span class="kcb"><b>${m[4]}</b>${m[2] ? (m[3] ? 'levels ' + m[2] + ' to ' + m[3] : 'below level 100') : 'on the surface'}</span>`; continue; }
    }
    if (mode === 'wanted') {
      if ((m = /^Today target\s*:\s*(.*)$/.exec(t))) { say = /^unknown$/i.test(m[1]) ? 'You have not learned today\'s bounty yet.' : 'Today\'s bounty: ' + m[1] + '.'; continue; }
      if (/^List of wanted monsters$/.test(t)) continue;
    }
    let name = t, n = '', sub = '';
    if (pets) { if ((m = /^(.*?) \((?:L(\d+), )?([^()]*)\)$/.exec(t))) { name = m[1]; sub = [m[2] ? 'level ' + m[2] : '', m[3]].filter(Boolean).join(' · '); } }
    else if (mode === 'alive') { if ((m = /^(.*) \(level (\d+)\)$/.exec(t))) { name = m[1]; sub = 'level ' + m[2]; } }
    else if (mode === 'wanted') sub = 'wanted';
    else if ((m = /^(\d+) (.*)$/.exec(t))) { n = m[1]; name = m[2]; } else sub = 'one of a kind';
    const art = rosterMon(name.replace(/^(?:your|a|an) /i, ''));
    tiles += `<div class="kce">${art ? `<canvas class="ptart" data-k="mon" data-n="${esc(art)}"></canvas>` : `<span class="ptart em">${esc(name.replace(/^(pile of|the) /i, '').charAt(0).toUpperCase())}</span>`}<div class="ptx"><b>${esc(cap(name))}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</div>${n ? `<em>&times;${esc(n)}</em>` : ''}</div>`;
  }
  if (!tiles && !say) return '';
  return `<div class="kcw">${say ? `<div class="kcsay">${esc(say)}</div>` : ''}${bands ? `<div class="kcbs">${bands}</div>` : ''}<div class="kcl">${tiles}</div>${tot.length ? `<div class="kctot">${esc(cap(tot.join(' · ')))}</div>` : ''}</div>`;
}

// The journal's quest page: each quest is a card (its name, how dangerous it is, what is asked of you); quests that
// are over become one line each with how deep, at what level and when. Paging stays the game's own.
function questsHtml(y0, y1, x0, x1, skip) {
  const out = []; let cur = null, sec = '';
  const flush = () => { if (cur) { out.push(`<div class="qc${cur.cont ? ' cont' : ''}"><div class="qch"><b>${esc(cur.name)}</b>${cur.lvl ? `<span class="qcl" data-tip="How dangerous it is: about the depth it is meant for">danger ${esc(cur.lvl)}</span>` : ''}</div>${cur.txt.length ? `<p>${esc(cur.txt.join(' '))}</p>` : ''}</div>`); cur = null; } };
  for (let y = y0; y <= y1; y++) {
    if (skip[y]) continue; const t = rowText(y).slice(x0, x1 + 1).trim(); if (!t) continue; let m;
    if ((m = /^(Current|Completed|Failed) Quests$/.exec(t))) { flush(); sec = m[1]; out.push(`<div class="qcs ${sec.toLowerCase()}">${{ Current: 'What is asked of you now', Completed: 'Done', Failed: 'Failed' }[sec]}</div>`); continue; }
    if ((m = /^(.*?)\s+\(Lvl (\d+)\)$/.exec(t))) { flush(); cur = { name: m[1], lvl: m[2], txt: [] }; continue; }
    if ((m = /^(.*?)\s{2,}DL(\d+)\s*(.*)$/.exec(t))) { flush(); const r = m[3].trim(), d = /^CL(\d+)\s*(?:Day (\d+), (\d+:\d+))?/.exec(r);
      out.push(`<div class="qd"><b>${esc(m[1])}</b><span>depth ${esc(m[2])}</span><span>${d ? 'at level ' + esc(d[1]) : esc(r.toLowerCase())}</span><span>${d && d[2] ? 'day ' + esc(d[2]) + ', ' + esc(d[3]) : ''}</span></div>`); continue; }
    if (!cur) cur = { name: sec ? '' : 'Continued', cont: 1, txt: [] };
    cur.txt.push(t);
  }
  flush();
  return out.length ? `<div class="qcw">${out.join('')}</div>` : '';
}
// The journal's dungeons page: where you are now, and how deep you have been in each place you know.
function dungeonsHtml(y0, y1, x0, x1, skip) {
  let say = '', rows = '', rest = '';
  for (let y = y0; y <= y1; y++) {
    if (skip[y]) continue; const t = rowText(y).slice(x0, x1 + 1).trim(); if (!t) continue; let m;
    if ((m = /^Now, you are exploring level (\d+) of (.*?)\.$/.exec(t))) { say = `You are on level ${m[1]} of ${m[2]}.`; continue; }
    if ((m = /^(!?)\s*(.*?)\s*: level\s+(\d+)$/.exec(t))) { const f = (typeof TS !== 'undefined' && TS && TS.feat && TS.feat[tkey('entrance')]) ? `<canvas class="ptart" data-k="feat" data-n="entrance"></canvas>` : `<span class="ptart em">${esc(m[2].charAt(0).toUpperCase())}</span>`;
      rows += `<div class="kce">${f}<div class="ptx"><b>${esc(m[2])}</b><span>deepest so far: level ${esc(m[3])}${m[1] ? ' · its master is beaten' : ''}</span></div></div>`; continue; }
    rest += `<div class="kcsay">${esc(t)}</div>`;
  }
  if (!rows && !say) return '';
  return `<div class="kcw">${say ? `<div class="kcsay">${esc(say)}</div>` : ''}<div class="kcl">${rows}</div>${rest}</div>`;
}

// The help's contents pages (its opening page and each topic's list of chapters): the game draws them as a lettered
// list; here each chapter is a card under its heading, and a click opens it. The letters still work.
const HELP_WORDS = {
  'General Information': ['The game in brief', 'what kind of game this is, and how it is won'], 'Creating a Character': ['Making a character', 'peoples, callings and starting choices'],
  'Commands': ['Keys', 'every key and what it does'], 'Frequently Asked Questions': ['Common questions', 'short answers to common puzzles'], 'Common Mistakes to Avoid': ['Mistakes to avoid', 'how new adventurers die'],
  'Races, Classes and Personalities': ['Peoples, callings and natures', 'every one of them in full'], 'The Towns and Wilderness': ['Towns and the wild', 'shops, buildings and the land between'],
  'The Dungeons': ['Dungeons', 'levels, stairs, traps and danger'], 'Objects': ['Items', 'what things do, and how you learn it'], 'Monsters and Pets': ['Creatures and companions', 'what they can do; keeping pets'],
  'Attacking and Weapons': ['Fighting', 'blows, criticals and shooting'], 'Defending and Armor': ['Defence', 'armour, resistances and saving throws'], 'Spellcasting': ['Magic', 'realms, books and failure'],
  'Status Effects': ['Conditions', 'poison, fear, stunning and the rest'], 'Glossary/List of Concepts': ['Glossary', 'the game\'s words explained'], 'Options': ['Options', 'what each setting changes'],
  'User Preference Files': ['Settings files', 'for seasoned players'], 'The Speed System': ['Speed', 'how speed turns into turns'], 'The Proficiency System': ['Practice', 'how skills grow with use'],
  'The Mogaminator': ['Pickup rules', 'the game\'s own rule language, in full'], 'Subwindows': ['Extra windows', 'for the plain-text version of the game'] };
function helpMenuHtml(y0, y1, x0, x1, skip) {
  const secs = []; let cur = null, title = '', gap = true, n = 0, more = '';
  for (let y = y0; y <= y1; y++) {
    if (skip[y]) continue; const t = rowText(y).slice(x0, x1 + 1).trim(); let m;
    if (!t) { gap = true; continue; }
    if ((m = /^\[([a-zA-Z0-9])\]\s+(\S.*)$/.exec(t))) { if (!cur || (gap && cur.items.length)) secs.push(cur = { head: '', items: [] }); cur.items.push({ k: m[1], n: m[2].trim() }); n++; gap = false; continue; }
    if (/^\(\?\) Help System Commands$/.test(t)) { more = '?'; continue; }
    if (/^\[\?\]\s/.test(t)) { more = '?'; continue; }
    if (/^Please choose one of the following/i.test(t)) continue;
    if (!title && !n) { title = t.replace(/\.$/, ''); gap = true; continue; }
    if (/:$/.test(t) && t.length < 40) { secs.push(cur = { head: t.replace(/:$/, ''), items: [] }); gap = false; continue; }
    return '';   // running text: not a contents page
  }
  if (n < 2) return '';
  const home = title === 'Welcome to the Online Help System';
  const card = it => { const w = home && HELP_WORDS[it.n]; return `<div class="mcard" data-key="${esc(it.k)}"><span class="key">${esc(it.k)}</span><span class="ml"><span class="mw">${esc(w ? w[0] : it.n)}</span>${w ? `<small class="mwd">${esc(w[1])}</small>` : ''}</span></div>`; };
  return `<div class="hlpw${secs.length > 1 || n > 9 ? '' : ' one'}"><div class="hlpt">${esc(home ? 'What would you like to know?' : title)}</div>
    ${secs.filter(g => g.items.length).map(g => `<div class="msec">${g.head ? `<div class="mhead">${esc(g.head)}</div>` : ''}<div class="hlpg">${g.items.map(card).join('')}</div></div>`).join('')}
    </div>`;
}

// The journal's pickup rules: the game lists each rule as its own shorthand ("[Pick Up] potions:speed#!kq").
// Here every rule is a line in plain words: what happens, to which things, and the note it writes on them.
const RULE_ACT = { 'Pick Up': ['Take', 'pick'], 'Leave': ['Leave', 'leave'], 'Destroy': ['Destroy', 'destroy'], 'Query': ['Ask first', 'ask'] };
function ruleWords(t) {
  let m, ident = false, note = '';
  t = t.replace(/^[~!;(]+/, ''); if (t[0] === '?') { ident = true; t = t.slice(1); }
  if ((m = /^(.*?)#(.*)$/.exec(t))) { t = m[1]; note = m[2]; }
  t = t.replace(/\barmors\b/g, 'armour').replace(/^collecting (\w+)/, '$1 like ones you already carry').replace(/^unaware (\w+)/, '$1 of a kind you have not learned yet').replace(/^unsensed (\w+)/, '$1 you have no feel for yet');
  let h;
  if ((m = /^([^:]*):\^?(.*)$/.exec(t)) && m[1].trim()) h = `<b>${esc(m[1].trim())}</b> ${/:\^/.test(t) ? 'whose name starts with' : 'named'} &ldquo;${esc(m[2].trim())}&rdquo;`;
  else if ((m = /^\^(.+)$/.exec(t))) h = `anything whose name starts with &ldquo;${esc(m[1].trim())}&rdquo;`;
  else if (/\b(items|potions|scrolls|weapons|armour|shooters|spellbooks|corpses|skeletons|rings|amulets|wands|staves|rods|lights?|missiles|chests|figurines|capture balls|devices)\b/.test(t)) h = `<b>${esc(t.trim())}</b>`;
  else h = `anything named &ldquo;${esc(t.trim())}&rdquo;`;
  return h + (ident ? '<span class="ich" data-tip="It is identified for you first, if you carry the means">identify it</span>' : '') + (note ? `<span class="ich ins" data-tip="Written on the item when you take it. Notes like these make the game ask before you destroy, sell or drink it">note ${esc(note)}</span>` : '');
}
function rulesHtml(y0, y1, x0, x1, skip) {
  const rows = []; let n = 0, count = '', off = '';
  for (let y = y0; y <= y1; y++) {
    if (skip[y]) continue; const t = rowText(y).slice(x0, x1 + 1).trim(); if (!t) continue; let m;
    if ((m = /^([\[(])(Pick Up|Leave|Destroy|Query)[\])]\s+(\S.*)$/.exec(t))) { const a = RULE_ACT[m[2]]; rows.push(`<div class="rl"><span class="rla a-${a[1]}">${a[0]}</span><span class="rlt">${ruleWords(m[3])}</span></div>`); n++; continue; }
    if ((m = /^There (?:is|are) (\d+) registered lines?/.exec(t))) { count = m[1]; continue; }
    if (/^For help on the Mogaminator/.test(t)) continue;
    if (/^You have (disabled|not yet activated) the Mogaminator/.test(t)) { off = /disabled/.test(t) ? 'Pickup rules are switched off.' : 'Pickup rules are not in use yet. Open them once from Options to start from the game\'s own list.'; continue; }
    if (!n) continue;
    return '';   // something else on the page: leave it as the game set it
  }
  if (!n && !off) return '';
  return `<div class="rlw"><div class="rli">${off ? esc(off) : `${count ? count + ' rules. ' : ''}The game reads them from the top, and the first one that fits an item decides what happens to it.`}
    <span class="rlb"><span class="btn" data-key="a">How rules work</span><span class="btn go" data-jump="_">Change the rules</span></span></div><div class="rlc">${rows.join('')}</div></div>`;
}
