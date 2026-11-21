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

// The journal's weapon and shooting pages: the game sets each weapon as a column of "Key : value" lines beside a little
// table of hit chances. Here each weapon is a card: its picture and name, the numbers in plain words, damage, and the
// chance to hit as bars.
const CS_KEY = { 'Weight': 'Weight', 'Profic': 'Practice', 'To Hit': 'To hit', 'To Dam': 'To damage', 'Blows': 'Blows a turn', 'Shots': 'Shots a turn', 'Mult': 'Multiplier', 'Xtra Dam': 'Extra damage', 'Range': 'Range', 'Breakage': 'Chance to break',
  'Crits': 'Critical hits', 'Normal': 'Against most things' };
const CS_HEAD = [/^Hand #(\d+)$/, /^Attack$/, /^Shooting$/, /^Ammo #(\d+)$/];
function combatHtml(y0, y1, x0, x1, skip) {
  const blocks = []; let cur = null, sec = null;
  for (let y = y0; y <= y1; y++) {
    if (skip[y]) continue; let t = rowText(y).slice(x0, x1 + 1).replace(/\s+$/, ''); if (!t.trim()) continue; let m, acc = null;
    if ((m = /\s{2,}(Accuracy|AC\s+Hit|(\d+)\s+(\d+)%)\s*$/.exec(t))) { acc = m[2] ? [+m[2], +m[3]] : 0; t = t.slice(0, m.index); }
    const s = t.trim(), a = y => (G.a[y] || [])[rowText(y).search(/\S/)] & 31;
    if (s) {
      if ((m = /^([\w# ]+?)\s*:\s*(\S.*)$/.exec(s)) && CS_HEAD.some(r => r.test(m[1].trim()))) { const k = m[1].trim(); blocks.push(cur = { k, name: m[2], secs: [sec = { head: '', rows: [] }], acc: [] }); }
      else if (!cur) return '';
      else if ((m = /^([\w ]+?)\s*:\s*(\S.*)$/.exec(s))) sec.rows.push({ k: m[1].trim(), v: m[2], col: (G.a[y] || [])[rowText(y).indexOf(m[2], x0)] });
      else if (s.length < 24 && !/[.:]$/.test(s)) cur.secs.push(sec = { head: s, rows: [] });
      else sec.rows.push({ k: '', v: s });
    }
    if (acc && cur) cur.acc.push(acc);
  }
  if (!blocks.length) return '';
  const find = n => { const all = [...((S && S.equip) || []), ...((S && S.pack) || [])].map(e => e.o || e).filter(o => o && o.n); return all.find(o => o.n === n) || all.find(o => nameParts(o.n).base.replace(/^(\d+|an?|the) /i, '') === nameParts(n).base.replace(/^(\d+|an?|the) /i, '')); };
  const lab = k => { let m; return (m = /^Hand #(\d+)$/.exec(k)) ? (blocks.filter(b => /^Hand/.test(b.k)).length > 1 ? 'In hand ' + m[1] : 'In your hand') : k === 'Attack' ? 'Your own attack' : k === 'Shooting' ? 'You shoot with' : (m = /^Ammo #(\d+)$/.exec(k)) ? 'What you shoot' : k; };
  const val = r => { let v = r.v, m; if (r.k === 'Crits' && (m = /^([\d.]+)x(?:\s+\(([\d.]+)%\))?$/.exec(v))) return `<b>&times;${m[1]}</b>${m[2] ? `<small>${m[2]}% of hits</small>` : ''}`;
    if ((m = /^(-?\d+) \+ (-?\d+) = (-?\d+)$/.exec(v))) return `<b>${+m[3] >= 0 ? '+' : ''}${m[3]}</b><small>${m[1]} from it, ${m[2]} from you</small>`;
    if ((m = /^(\S+)\s+\((.+)\)$/.exec(v))) return `<b>${esc(m[1])}</b><small>${esc(m[2].replace(/^\+0 To Hit$/, 'no bonus yet').replace(/To Hit/, 'to hit').replace(/^Multiplier Applies$/, 'the multiplier applies').replace(/^Multiplier Does Not Apply$/, 'the multiplier does not apply'))}</small>`;
    if ((m = /^(\S+)\s+\[(.+)\]$/.exec(v))) return `<b>${esc(m[1])}</b><small>&times;${esc(m[2].replace(/x$/, ''))}</small>`;
    return `<b>${esc(v.replace(/ lbs$/, ' lb'))}</b>`; };
  const card = b => { const o = find(b.name), ic = o ? tvIcon(o.tv) : b.k === 'Attack' ? 'sword' : 'sword';
    return `<div class="cs"><div class="csh"><div class="slot big t-${ic}">${(o && artHtml(o.ki, 64)) || (b.k === 'Attack' && S && S.p && S.p.form ? `<canvas class="ptart csart" data-k="mon" data-n="${esc(S.p.form)}"></canvas>` : '') || icon(ic)}</div><div><div class="csl">${esc(lab(b.k))}</div><div class="csn">${nameHtml(b.name.replace(/^(\d+|an?|the|Your) /i, ''), cap)}</div></div></div>
      <div class="csb${b.acc.length ? '' : ' solo'}"><div class="csc">${b.secs.filter(g => g.rows.length).map(g => `${g.head ? `<div class="cst">${esc(g.head === 'Damage' ? 'Damage each turn' : g.head)}</div>` : ''}<div class="csg">${g.rows.map(r => `<div class="csr${g.head ? ' dmg' : ''}"><span>${esc(CS_KEY[r.k] || r.k)}</span><span${r.col != null && g.head && !CS_KEY[r.k] ? ` style="color:${readable(col(r.col))}"` : ''}>${val(r)}</span></div>`).join('')}</div>`).join('')}</div>
      ${b.acc.length ? `<div class="csa"><div class="cst">Chance to hit</div><div class="csah"><span>target's armour</span></div>${b.acc.map(([ac, p]) => `<div class="csar"><span>${ac}</span><i><u style="width:${Math.max(2, p)}%"></u></i><b>${p}%</b></div>`).join('')}</div>` : ''}</div></div>`; };
  return `<div class="csw">${blocks.map(card).join('')}</div>`;
}

// The weapon skill page: the game's three columns of names and codes become headed groups with a
// five-step meter (or a bar in the two percent views), and its M toggle becomes four labelled views.
const SK_STEP = { Un: [0, 'Untrained'], Be: [1, 'Beginner'], Sk: [2, 'Skilled'], Ex: [3, 'Expert'], Ma: [4, 'Master'] };
const SK_MODES = [[/^Current Proficiency$/, 'Skill now', 'How practised you are with each weapon. Skill grows by using it on worthy foes.'], [/Proficiency Caps$/, 'Your limits', 'The most your calling can ever learn with each weapon.'], [/% of Caps$/, 'Share of your limit', 'How far along you are toward the most your calling can learn.'], [/% of Full Mastery$/, 'Share of mastery', 'How far along you are toward full mastery, whether or not your calling can reach it.']];
function skillHtml(y0, y1, x0, x1, skip) {
  const cap = PAGER ? PAGER.cap : '', mode = SK_MODES.findIndex(m => m[0].test(cap)); if (mode < 0) return '';
  const cols = [[], [], []], cur = [null, null, null]; let any = 0;
  for (let y = y0; y <= y1; y++) {
    if (skip[y]) continue; const t = rowText(y).slice(x0, x1 + 1).replace(/\x01/g, ' '), a = G.a[y] || [];
    for (let c = 0; c < 3; c++) {
      const cell = t.slice(c * 27, c * 27 + 27); if (!cell.trim()) { cur[c] = null; continue; }
      const m = /^(.+?)\s+(!?)(?:\[(Un|Be|Sk|Ex|Ma)\]|(\d+)%)\s*$/.exec(cell);
      if (!m) { cols[c].push(cur[c] = { h: cell.trim(), rows: [] }); continue; }
      if (!cur[c]) cols[c].push(cur[c] = { h: '', rows: [] });
      cur[c].rows.push({ n: m[1].trim(), top: !!m[2], code: m[3], pct: m[4] == null ? null : +m[4], worn: a[x0 + c * 27] === 14 }); any++;
    }
  }
  if (any < 4) return '';
  const meter = r => {
    if (r.pct != null) return `<span class="skb"><i style="width:${Math.min(100, r.pct)}%"></i></span><span class="skv">${r.pct}%</span>`;
    const st = SK_STEP[r.code] || [0, r.code];
    return `<span class="skp s${st[0]}">${[1, 2, 3, 4].map(i => `<i${i <= st[0] ? ' class="on"' : ''}></i>`).join('')}</span><span class="skv">${st[1]}${r.top ? '<em data-tip="As good as your calling can get with this">limit</em>' : ''}</span>`; };
  const row = r => `<div class="skr${(r.pct != null ? r.pct === 0 : (SK_STEP[r.code] || [0])[0] === 0) ? ' dim' : ''}${r.worn ? ' worn' : ''}"${r.worn ? ' data-tip="You are using this now"' : ''}><span class="skn">${esc(r.n)}</span>${meter(r)}</div>`;
  const tabs = SK_MODES.map((m, i) => `<span class="skt${i === mode ? ' on' : ''}"${i === mode ? '' : ` data-key="${'M'.repeat((i - mode + 4) % 4)}"`} data-tip="${esc(m[2])}">${m[1]}</span>`).join('');
  return `<div class="skw"><div class="skm">${tabs}<span class="skd">${esc(SK_MODES[mode][2])}</span></div><div class="skc">${cols.map(col => `<div class="skcol">${col.map(g => `<div class="skg">${g.h ? `<div class="skh">${esc(g.h)}</div>` : ''}${g.rows.map(row).join('')}</div>`).join('')}</div>`).join('')}</div></div>`;
}
// The spell skill page: one card per book, a row per spell with the same five-step meter.
function spellSkillHtml(y0, y1, x0, x1, skip) {
  const books = []; let realm = '', cur = null, any = 0;
  for (let y = y0; y <= y1; y++) {
    if (skip[y]) continue; const t = rowText(y).slice(x0, x1 + 1).replace(/\x01/g, ' '), a = G.a[y] || []; let m;
    if (!t.trim() || /^=+ .* =+$/.test(t.trim())) continue;
    if ((m = /^\s*Realm:\s*(\S.*?)\s*$/.exec(t))) { realm = m[1]; continue; }
    if ((m = /^\s*\[(.+?)\]\s+(?:Profic\s+)?Lvl\b/.exec(t))) { books.push(cur = { n: m[1], realm, rows: [], notes: [] }); continue; }
    if ((m = /^\s*([a-zA-Z0-9])\)\s+(.+?)\s+(?:\[(Un|Be|Sk|Ex|Ma)\]\s+)?(\d+)\s+(\d+)\s+(\d+)%\s+(.*?)\s+(\d+)\s+(\d+)\s+(\d+)%\s*$/.exec(t)) && cur) {
      cur.rows.push({ n: m[2], code: m[3] || '', lvl: +m[4], sp: +m[5], fail: +m[6], desc: m[7].trim(), cast: +m[8], bad: +m[9], dim: a[x0 + t.indexOf(m[2])] !== 1 }); any++; continue; }
    if (cur) cur.notes.push(t.trim()); else return '';
  }
  if (!any) return PAGER && /^Spell Proficiency/.test(PAGER.cap) ? '<div class="ssw"><div class="ssb sse"><b>No book magic to practise</b><span>Spell skill is earned by casting from spell books. This character draws on other powers, which are listed under Powers.</span></div></div>' : '';
  const prof = books.some(b => b.rows.some(r => r.code));
  const row = r => { const st = SK_STEP[r.code] || [0, '']; const unk = /^unknown$/i.test(r.desc);
    return `<div class="ssr${r.dim ? ' dim' : ''}${prof ? '' : ' np'}"><span class="skn">${esc(r.n)}</span>${prof ? `<span class="skp s${st[0]}">${[1, 2, 3, 4].map(i => `<i${i <= st[0] ? ' class="on"' : ''}></i>`).join('')}</span><span class="skv">${st[1]}</span>` : ''}<span class="ssv">${r.lvl}</span><span class="ssv ssm">${r.sp}</span><span class="ssv${r.fail >= 50 ? ' bad' : r.fail <= 15 ? ' ok' : ''}">${r.fail}%</span><span class="ssd"${unk ? ' data-tip="You learn what it does once you can cast it"' : ''}>${unk ? '·' : esc(r.desc)}</span><span class="ssc">${r.cast ? `${r.cast}×${r.bad ? ` <em>${r.bad} failed</em>` : ''}` : '<i>never</i>'}</span></div>`; };
  const head = `<div class="ssr hd${prof ? '' : ' np'}"><span></span>${prof ? '<span></span><span class="skv">skill</span>' : ''}<span class="ssv" data-tip="The character level at which you can cast it">level</span><span class="ssv ssm">mana</span><span class="ssv" data-tip="Chance the spell fizzles">fail</span><span class="ssd">effect</span><span class="ssc" data-tip="How often you have cast it">cast</span></div>`;
  return `<div class="ssw">${books.map((b, i) => `${b.realm && (!i || books[i - 1].realm !== b.realm) ? `<div class="ssrm"><span>${esc(b.realm)}</span> magic</div>` : ''}<div class="ssb"><div class="ssh">${esc(b.n)}</div>${head}${b.rows.map(row).join('')}${b.notes.map(n => `<div class="ssn">${esc(n)}</div>`).join('')}</div>`).join('')}</div>`;
}
// The hall of fame: the game's score table as a ranked list with pictures. A row opens that
// character's last record; the sort letters become chips.
let FAME_SORT = '';
const FAME_SORTS = [['S', 'Score', '\x13'], ['D', 'Date', '\x04'], ['N', 'Name', '\x0e'], ['R', 'People', '\x12'], ['C', 'Calling', '\x03']];
function fameFind(y0, y1) { for (let y = y0; y <= Math.min(y1, y0 + 3); y++) if (/^\s*High Score Listing\s*$/.test(rowText(y))) return y; return -1; }
function fameHtml(y0, y1) {
  const top = fameFind(y0, y1); if (top < 0) return '';
  const rows = []; let more = false;
  for (let y = top + 1; y <= y1; y++) { const t = rowText(y).replace(/\x01/g, ' '); let m;
    if ((m = /^\s([a-z])\)\s(.{15})\s([ \d]\d)\s(.{12})\s(.{13})\s*(\d+)\s+(\d+)\s(\S+)\s+(\S.*?)\s*$/.exec(t))) rows.push({ k: m[1], n: m[2].trim(), lv: +m[3], race: m[4].trim(), cls: m[5].trim(), score: +m[6], pos: +m[7], date: m[8], st: m[9], me: ((G.a[y] || [])[4] & 31) === 14 });
    else if (/PageUp/.test(t)) more = true; }
  if (!rows.length) return '';
  const sorted = f => rows.every((r, i) => !i || f(rows[i - 1], r) <= 0) || rows.every((r, i) => !i || f(rows[i - 1], r) >= 0);
  const cmp = { S: (a, b) => a.score - b.score, D: (a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0, N: (a, b) => a.n.toLowerCase() < b.n.toLowerCase() ? -1 : a.n.toLowerCase() > b.n.toLowerCase() ? 1 : 0, R: (a, b) => a.race < b.race ? -1 : a.race > b.race ? 1 : 0, C: (a, b) => a.cls < b.cls ? -1 : a.cls > b.cls ? 1 : 0 };
  const fits = FAME_SORTS.map(x => x[0]).filter(k => sorted(cmp[k])); const sort = fits.includes(FAME_SORT) ? FAME_SORT : (FAME_SORT = fits[0] || '');
  const MON = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = d => { const m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(d); return m ? `${+m[3]} ${MON[+m[2]] || ''} ${m[1]}` : d; };
  const row = r => { const mon = /^Monster$/i.test(r.cls), art = typeof pickArtFor === 'function' ? (!mon && pickArtFor(r.cls, 'class')) || pickArtFor(r.race, '') : null;
    const st = /^Dead/i.test(r.st) ? 'dead' : /^Winner/i.test(r.st) ? 'win' : 'alive';
    return `<div class="fmr${r.me ? ' me' : ''} ${st}" data-key="${r.k}" data-tip="Read ${esc(r.n)}'s last record"><span class="fmp${sort === 'S' && r.pos <= 3 ? ' p' + r.pos : ''}">${r.pos}</span>${art ? `<canvas class="ptart" data-k="${art[0]}" data-n="${esc(art[1])}"></canvas>` : `<span class="ptart em">${esc(r.n.charAt(0).toUpperCase())}</span>`}<span class="fmn"><b>${esc(r.n)}${r.me ? '<em>you</em>' : ''}</b><i>Level ${r.lv} ${esc(r.race)}${mon ? '' : ' ' + esc(r.cls)}</i></span><span class="fms"><b>${r.score.toLocaleString('en-US')}</b><i>score</i></span><span class="fmd">${esc(day(r.date))}</span><span class="fmst">${st === 'dead' ? 'Fallen' : st === 'win' ? 'Winner' : 'Alive'}</span><span class="key">${r.k}</span></div>`; };
  const chips = FAME_SORTS.map(x => `<span class="skt${x[0] === sort ? ' on' : ''}" data-fsort="${x[0]}" data-key="${x[2]}">${x[1]}</span>`).join('');
  return `<div class="fmw${rows.length > 12 ? ' two' : ''}"><div class="skm"><span class="fml">Sort by</span>${chips}<span class="skd">Click a character to read their last record.</span></div><div class="fmc">${rows.map(row).join('')}</div>${more ? '<div class="fmg"><span class="btn" data-ks="FF55">Earlier</span><span class="btn" data-ks="FF56">More</span></div>' : ''}</div>`;
}
document.addEventListener('click', e => { const f = e.target.closest && e.target.closest('[data-fsort]'); if (f) FAME_SORT = f.dataset.fsort; }, true);
// The journal's "about you" page: life rating and stat limits as tiles, then your people, calling, nature and
// magic each as a card with its picture and the game's own account of it.
function aboutHtml(y0, y1, x0, x1, skip) {
  const tiles = [], cards = []; let cur = null, para = null, any = false;
  const say = v => /^\?+$/.test(v) ? '<i data-tip="The game has not told you yet">?</i>' : esc(v);
  const flush = () => { para = null; };
  for (let y = y0; y <= y1; y++) {
    if (skip[y]) continue; const t = rowText(y).slice(x0, x1 + 1).trim(); let m;
    if (!t) { flush(); continue; }
    if ((m = /^Your current Life Rating is (\S+?)\.?$/.exec(t))) { tiles.unshift(`<div class="abt big" data-tip="How many hit points you gain each level, against the average for your kind: 100 is average"><b>${say(m[1])}</b><span>life rating</span></div>`); any = true; continue; }
    if (/^Limits of maximum stats$/.test(t)) { any = true; continue; }
    if ((m = /^(STR|INT|WIS|DEX|CON|CHR)\s*:\s*(\S+)$/.exec(t))) { tiles.push(`<div class="abt" data-tip="The highest your ${({ STR: 'strength', INT: 'intelligence', WIS: 'wisdom', DEX: 'dexterity', CON: 'constitution', CHR: 'charisma' })[m[1]]} can ever be raised"><b>${say(m[2])}</b><span>${m[1].toLowerCase()} limit</span></div>`); any = true; continue; }
    if ((m = /^(Race|Subrace|Class|Subclass|Personality|Realm|Realms?|First Realm|Second Realm|Patron|Speciality|Demigod|Parentage|Dragon Realm|Focus)\s*:\s*(\S.*)$/.exec(t))) { cards.push(cur = { k: m[1], n: m[2], ps: [], links: [] }); flush(); any = true; continue; }
    if (!cur) cards.push(cur = { k: '', n: '', ps: [], links: [], cont: 1 });
    if (!para) cur.ps.push(para = []);
    para.push(t);
  }
  if (!any && !cards.some(c => c.k)) return '';
  const lab = { Race: 'Your people', Subrace: 'Your kind', Class: 'Your calling', Subclass: 'Your path', Personality: 'Your nature', Realm: 'Your magic', 'First Realm': 'Your first magic', 'Second Realm': 'Your second magic' };
  const card = c => {
    const art = c.k && typeof pickArtFor === 'function' ? pickArtFor(c.n, c.k === 'Class' ? 'class' : '') : null;
    const body = c.ps.map(p => { let s = esc(p.join(' ')); s = s.replace(/\s*For more information, see \[([a-z])\]\./g, (m0, k) => { c.links.push(k); return ''; }); return s.trim() ? `<p>${s}</p>` : ''; }).join('');
    return `<div class="abc${c.cont ? ' cont' : ''}">${c.k ? `<div class="abh">${art ? `<canvas class="ptart" data-k="${art[0]}" data-n="${esc(art[1])}"></canvas>` : `<span class="ptart em">${esc(c.n.charAt(0).toUpperCase())}</span>`}<div><div class="csl">${esc(lab[c.k] || c.k)}</div><div class="csn">${esc(c.n)}</div></div>${c.links.map(k => `<span class="btn" data-key="${k}">Read more</span>`).join('')}</div>` : ''}${body}${!c.k && c.links.length ? `<div class="abl">${c.links.map(k => `<span class="btn" data-key="${k}">Read more</span>`).join('')}</div>` : ''}</div>`; };
  // the links are found while the body is built, so build bodies first
  const html = cards.map(c => { card(c); const l = c.links.slice(); c.links = []; const h = card(c); c.links = l; return h; });
  const more = PAGER && PAGER.at + PAGER.page < PAGER.of;
  return `<div class="abw">${tiles.length ? `<div class="abts">${tiles.join('')}</div>` : ''}${html.join('')}${more ? '<div class="abm"><span class="btn go" data-ks="FF56">Read on</span></div>' : ''}</div>`;
}
