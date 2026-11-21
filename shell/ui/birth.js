// Character creation. The game draws these screens as text (a summary on top, then lettered choices and notes).
// This reads that text and lays it out as a proper panel: your character on the left, the choices as buttons.
// Nothing is dropped: any line it does not recognise is shown as written. Keys work exactly as before.
'use strict';
const rowText = y => { const r = G.s[y]; return (Array.isArray(r) ? r.join('') : r || '').replace(/\x01/g, ' ').replace(/\s+$/, ''); };
function rowHtml(y, x0, x1) {
  const s = rowText(y), a = G.a[y] || []; let out = '', run = '', cur = -1;
  const flush = () => { if (run) out += cur > 1 ? `<span style="color:${readable(col(cur))}">${esc(run)}</span>` : esc(run); run = ''; };
  for (let x = x0; x < Math.min(x1, s.length); x++) { const at = s[x] === ' ' ? cur : (a[x] & 31); if (at !== cur) { flush(); cur = at; } run += s[x]; }
  flush(); return out;
}
const BKEY = { TAB: '\t', RET: '\r', ESC: '\x1b', SPC: ' ' };
function birthParse() {
  const rows = []; for (let y = 0; y < G.h; y++) rows.push(rowText(y));
  const welcome = rows.some(r => /Choose the Type of Game to Play/.test(r)), sheet = /^Name\s*:/.test(rows[0] || '');
  if (!welcome && !sheet) return null;
  const out = { fields: [], cols: [], lines: [], total: null, blocks: [], nchoice: 0 };
  let y = 0;
  if (sheet) {
    // the summary: "Label: value" on the left, a table of bonuses on the right
    const SPLIT = 26; let ends = [], starts = [];
    for (; y < rows.length; y++) {
      // with no realm line the sum of the bonuses (the "==" row) stands on a line of its own
      const lone = ends.length && !rows[y].slice(0, SPLIT - 3).trim() && /==/.test(rows[y].slice(SPLIT - 3, SPLIT + 4));
      // a second magic realm stands alone under the first
      if (!lone && out.fields.length && /^\s{5,}\S/.test(rows[y].slice(0, SPLIT)) && !rows[y].slice(SPLIT).trim() && !/:|\)/.test(rows[y])) { const pf = out.fields.filter(f => !f.side).pop(); if (pf && /^Magic/.test(pf.label)) { pf.value += ' · ' + rows[y].trim(); continue; } }
      const m = lone ? [0, '', ''] : /^([A-Z][A-Za-z ]{0,9}?)\s*:\s?(.*)$/.exec(rows[y].slice(0, SPLIT)); if (!m) break;
      const right = rows[y].slice(SPLIT).replace(/^=*/, s0 => ' '.repeat(s0.length)), f = { label: m[1], value: m[2].trim(), y, lone };
      if (!out.cols.length && y > 0 && right.trim() && !/:/.test(right) && !/\d/.test(right)) { const re = /\S+/g; let t; while ((t = re.exec(right))) { out.cols.push(t[0]); ends.push(SPLIT + t.index + t[0].length); starts.push(SPLIT + t.index); } out.words = !/STR\s+INT/.test(right); }
      else if (out.words && ends.length && right.trim()) { const vals = starts.map((st, i) => rows[y].slice(st, i + 1 < starts.length ? starts[i + 1] : 200).trim()); if (/==/.test(rows[y].slice(SPLIT - 3, SPLIT + 3))) out.total = vals; f.vals = vals; f.cols = starts.map(st => readable(col(((G.a[y] || [])[st] & 31) || 1))); }
      else if (ends.length && /[-+]\d|\d%/.test(right)) { const vals = ends.map(() => ''), tr = /[-+]?\d+%?/g; let t; while ((t = tr.exec(right))) { const e = SPLIT + t.index + t[0].length; let bi = 0; ends.forEach((c, i) => { if (Math.abs(c - e) < Math.abs(ends[bi] - e)) bi = i; }); vals[bi] = t[0]; } if (/==/.test(rows[y].slice(SPLIT - 2, SPLIT + 4)) || /==/.test(right)) out.total = vals; f.vals = vals; }
      else { const x = /(\S[^:]*):\s*(.*)$/.exec(right); if (x) out.fields.push({ label: x[1].trim(), value: x[2].trim(), y, side: 1 }); }
      out.fields.push(f);
    }
  }
  // the rest: headings, lettered choices, notes
  let para = null, stats = null, statCh = null; const endPara = () => { para = null; };
  for (; y < rows.length; y++) {
    if (!rows[y].trim()) { endPara(); continue; }
    const isStat = q => /^\s*\S\/\S\) \S+\s+\S/.test(q), nextRow = rows.slice(y + 1).find(q => q.trim()) || '';
    let r = rows[y];
    if (!isStat(r) && isStat(nextRow) && !/\) /.test(r)) { stats = { type: 'stats', cols: r.trim().split(/\s+/), rows: [], left: null }; statCh = { type: 'choices', items: [], cols: 1 }; out.blocks.push(stats, statCh); endPara(); continue; }
    const sm = /^(\s*)(\S)\/(\S)\) (\S+)(\s+)(.*)$/.exec(r);
    if (sm) {
      if (!stats) { stats = { type: 'stats', cols: [], rows: [], left: null }; statCh = { type: 'choices', items: [], cols: 1 }; out.blocks.push(stats, statCh); }
      const cut = sm[6].search(/\s{2,}(TAB|RET|ESC|SPC|\S)\) \S/), vals = (cut < 0 ? sm[6] : sm[6].slice(0, cut)).trim().split(/\s+/), pre = r.length - sm[6].length + (cut < 0 ? sm[6].length : cut);
      stats.rows.push({ dec: sm[2], inc: sm[3], name: sm[4], vals }); out.nchoice++; r = ' '.repeat(pre) + r.slice(pre); endPara(); if (!r.trim()) continue;
    } else if (stats && stats.left === null && /^\s*-?\d+\s*$/.test(r)) { stats.left = r.trim(); continue; }
    const found = [], re = /(^\s*|\s{2,})(TAB|RET|ESC|SPC|\S)\) (?=\S)/g; let m;
    while ((m = re.exec(r))) found.push({ at: m.index + m[1].length, key: m[2], from: m.index + m[0].length });
    if (found.length && found[0].at === r.search(/\S/)) {
      endPara(); let blk = sm ? statCh : out.blocks[out.blocks.length - 1]; if (!blk || blk.type !== 'choices') { blk = { type: 'choices', items: [], cols: 1 }; out.blocks.push(blk); }
      found.forEach((f, i) => { const to = i + 1 < found.length ? found[i + 1].at : r.length, label = r.slice(f.from, to).trim(), at = (G.a[y] || [])[f.from] & 31;
        blk.items.push({ key: f.key, label, html: rowHtml(y, f.from, f.from + r.slice(f.from, to).replace(/\s+$/, '').length), col: i, dim: at === 8 }); out.nchoice++; });
      if (!sm) blk.cols = Math.max(blk.cols, found.length); continue;
    }
    const next = rows.slice(y + 1).find(q => q.trim()) || '', lead = r.search(/\S/), table = (r.trim().match(/\S\s{2,}\S/g) || []).length >= 2;
    const allG = r.trim().length < 60 && [...r].every((ch, x) => ch === ' ' || ((G.a[y] || [])[x] & 31) === 13);
    if (!table && !para && (allG || (/^\s*(TAB|RET|ESC|SPC|\S)\) \S/.test(next) && r.trim().length < 70))) { out.blocks.push({ type: 'h', html: esc(r.trim()) }); continue; }
    if (table) { endPara(); let blk = out.blocks[out.blocks.length - 1]; if (!blk || blk.type !== 'pre') { blk = { type: 'pre', rows: [] }; out.blocks.push(blk); } blk.rows.push(rowHtml(y, 0, r.length) + (y === G.cy && G.cv ? '<i class="caret"></i>' : '')); continue; }
    if (!para) { para = { type: 'p', html: '' }; out.blocks.push(para); }
    para.html += (para.html ? ' ' : '') + rowHtml(y, lead, r.length) + (y === G.cy && G.cv ? '<i class="caret"></i>' : '');
  }
  return out;
}
/* the title screen: the game's news page waits for a key. Here it is a proper front door */
const TITLE_MOBS = ['giant green frog', "grip, farmer maggot's dog", 'cave troll', 'smeagol', 'morgoth, lord of darkness', 'lich', '5-headed hydra', 'mature red dragon', 'giant pink frog'];
function titleHtml() {
  if (S && S.p) return '';
  const all = G.s.join('\n'); if (!/Press Any Other Key to Play/.test(all)) return '';
  const v = (/FrogComposband ([^\s]+)( \([^)]*\))?/.exec(all) || []);
  return `<div class="tscr"><div class="tglow"></div>
    <div class="tmobs">${TITLE_MOBS.map((n, i) => `<canvas class="tmob" data-n="${esc(n)}" style="--i:${i - 4}"></canvas>`).join('')}</div>
    <h1>FrogComposband</h1><div class="tver">${esc((v[1] || '') + (v[2] || ''))}</div>
    <div class="tbtns"><span class="tbtn main" data-key=" "><span class="key">Enter</span>Play</span><span class="tbtn" data-key="?"><span class="key">?</span>Credits</span></div>
    <div class="ttip">Full keyboard play · click to walk · right-click anything for its actions · F1 all the controls</div></div>`;
}
function titleAfter() {
  document.querySelectorAll('.tmob').forEach(c => { const S2 = 96, d = 2 * SCALE * (devicePixelRatio || 1); c.width = c.height = Math.round(S2 * d); const g = c.getContext('2d'); g.scale(d, d); sprite.flat = true; sprite(g, 'mon', c.dataset.n, 0, 0, S2); sprite.flat = false; });
}
let naming = false;
// what each starting value costs (the game's own table)
const STAT_COST = { 8: -3, 9: -2, 10: -1, 11: 0, 12: 1, 13: 2, 14: 3, 15: 6, 16: 10, 17: 16, 18: 99 };
const STAT_SAY = { STR: ['Strength', 'Hitting hard, carrying more, heavier weapons'], INT: ['Intelligence', 'Spells for mages and the like, and using magic devices'], WIS: ['Wisdom', 'Spells for priests and the like, and resisting magic'],
  DEX: ['Dexterity', 'More blows, better aim, dodging and disarming'], CON: ['Constitution', 'More life, and getting it back faster'], CHR: ['Charisma', 'Better prices in shops, and some kinds of magic'] };
function birthHtml() {
  naming = false;
  TOPIC_FILE = '';
  topicsLoad();
  if (G.ov) return '';
  const b = birthParse(); if (!b || (!b.nchoice && !b.fields.length)) return '';
  const val = n => (b.fields.find(f => f.label === n) || {}).value || '';
  let left = '', intro = '';
  if (b.fields.length) {
    const main = b.fields.filter(f => f.label !== 'Name' && !f.side), side = b.fields.filter(f => f.side);
    const tone = v => /^-/.test(v) ? 'neg' : /^\+0$|^100%$|^$/.test(v) ? 'zero' : 'pos';
    const table = b.cols.length ? `<div class="btab ${b.words ? 'words' : ''}" style="grid-template-columns:62px repeat(${b.cols.length},${b.words ? "auto" : "1fr"})"><span></span>${b.cols.map(c => `<span class="bh">${esc(c)}</span>`).join('')}
      ${main.filter(f => f.vals).map(f => { const tot = f.vals === b.total; return `<span class="bl ${tot ? 'tot' : ''}">${tot ? 'Total' : esc(f.label)}</span>${f.vals.map((v, i) => `<span class="bv ${tot ? 'tot' : ''} ${b.words ? '' : tone(v)}"${f.cols ? ` style="color:${f.cols[i]}"` : ''}>${esc(v)}</span>`).join('')}`; }).join('')}</div>` : '';
    // the game is taking a new name (n): show it as a field being typed in, and let nothing else be clicked meanwhile,
    // since every click would type its letter into the name
    const nameY = G.s.findIndex(r => /^Name\s*:/.test((r || '').replace(/\x01/g, ' ')));
    naming = nameY >= 0 && !!G.cv && G.cy === nameY && G.cx >= 7 && G.cx < 40;
    const canName = b.blocks.some(k => k.items && k.items.some(i => i.key === 'n'));
    // the sheet is the form: each line that the game lets you change is a button (its "Change ..." entry leaves the list)
    const chg = {}; b.blocks.forEach(k => k.items && k.items.forEach(i => { const m = /^Change (.+)$/.exec(i.label); if (m && i.key.length === 1) chg[m[1].toLowerCase().slice(0, 4)] = i; }));
    const fgo = f => { const i = chg[f.label.toLowerCase().slice(0, 4)]; if (i) i.used = true; return i; };
    if (chg.name) chg.name.used = true;
    if (Object.keys(chg).length > 2 && !naming) {
      const SAY = { Race: 'Your people', Subrace: 'Your bloodline', Class: 'Your calling', Subclass: 'Your speciality', Pact: 'Your pact', Pers: 'Your nature', Magic: 'Your magic', Realm: 'Your magic', Patron: 'Your patron' };
      const WHO = b.fields.filter(q => !q.side && !q.lone && q.value && !/^(Name|Sex|Game Speed)$/.test(q.label)).map(q => [q.label, SAY[q.label] || 'Your ' + q.label.toLowerCase(), q.label === 'Class' ? 'class' : '']);
      const ORD = ['Race', 'Subrace', 'Class']; WHO.sort((x, y) => { const r = l => l === 'Pers' ? 90 : /^(Magic|Realm)$/.test(l) ? 95 : ORD.indexOf(l) >= 0 ? ORD.indexOf(l) : 50; return r(x[0]) - r(y[0]); });
      intro = '<div class="bhd">Who will you be?</div><p class="bp">This is your character so far. Change anything you like, and continue when it reads right.</p><div class="bwho' + (WHO.length > 4 ? ' tight' : '') + '">' + WHO.map(([lab, say, kind]) => {
        const f = b.fields.find(q => q.label === lab && !q.side), g = f && chg[lab.toLowerCase().slice(0, 4)]; if (!f || !f.value) return '';
        const first = f.value.split(' · ')[0], art = pickArtFor(first, kind); TOPIC_FILE = pickFile(say); const line = pickLine(first, ''); TOPIC_FILE = '';
        return `<div class="bwc${g ? ' go' : ''}"${g ? ` data-key="${esc(g.key)}"` : ''} data-topic="${esc(first)}" data-tf="${pickFile(say)}">${art ? `<canvas class="ptart" data-k="${art[0]}" data-n="${esc(art[1])}"></canvas>` : `<span class="ptart em">${esc(first.charAt(0))}</span>`}
          <div class="ptx"><i>${say}</i><b>${esc(f.value)}</b>${line ? `<span>${esc(line)}</span>` : ''}</div>${g ? '<span class="btn">Change</span>' : ''}</div>`; }).join('') + '</div>';
    }
    const nm = esc(val('Name')), dice = naming ? null : b.blocks.map(k => k.items && k.items.find(i => /^Random Name$/i.test(i.label))).find(Boolean); if (dice) dice.used = true;
    const port = pickArtFor(val('Class'), 'class') || pickArtFor(val('Race'), '') || ['player', 'default'];
    left = `<div class="bsheet"><canvas class="ptart bport" data-k="${port[0]}" data-n="${esc(port[1])}"></canvas>${naming ? `<div class="bname bnaming">${nm}<i class="bcaret"></i></div><div class="bnhint">Type a name · <span class="key kb" data-key="\r">Enter</span> keep it · <span class="key kb" data-key="\x1b">Esc</span> cancel</div>`
      : `<div class="bname${canName ? ' go' : ''}"${canName ? ` data-key="n" data-tip="Your name&#10;click or press n to change it"` : ''}><span class="bnm">${nm || 'Unnamed'}</span>${canName ? `<span class="bedit">rename</span>` : ''}${dice ? `<span class="bdice" data-key="${esc(dice.key)}" data-tip="A random name&#10;click or press ${esc(dice.key)}"><i></i><i></i><i></i><i></i><i></i></span>` : ''}</div>`}
      <div class="bsub">${esc([val('Sex'), val('Race'), val('Class')].filter(Boolean).join(' · '))}</div>
      <div class="bfields">${main.filter(f => !f.lone).concat(side).map(f => { const g = naming ? null : fgo(f); return `<div class="bf${g ? ' go' : ''}"${g ? ` data-key="${esc(g.key)}" data-tip="${esc(f.label)}&#10;click or press ${esc(g.key)} to change it"` : ''}><span class="lbl">${esc(f.label)}</span><b>${esc(f.value) || '<i>none</i>'}</b>${g ? `<span class="bedit">change</span>` : ''}</div>`; }).join('')}</div>
      <div class="sect" style="margin-top:14px">${b.words ? 'Skills' : 'Bonuses'}</div>${table}</div>`;
  }
  let right = '', ret = null, back = null, anyCh = false, head = null; const util = [], welcome = !b.fields.length;
  const UTIL = { 'help': 'Help', 'options': 'Options', 'view scores': 'Hall of fame', 'more info': b.words ? 'Show bonuses' : 'Show skills' };
  for (const k of b.blocks) if (k.items) { k.items = k.items.filter(i => { if (i.key === 'RET') { ret = i; return false; } if (i.key === 'ESC') { back = i; return false; } if (UTIL[i.label.toLowerCase()]) { util.push(i); return false; } return !i.used; }); if (k.items.length) anyCh = true; }
  if (welcome) right += '<p class="bp bwel">Deep below waits the <span style="color:#ff7a66">Serpent of Chaos</span>. Before you go down to face it, you need someone to send. First, choose how you want to play.</p>';
  const navWord = t => /^next screen$/i.test(t) ? 'Continue' : /^prev(ious)? screen$/i.test(t) ? 'Back' : t;
  for (const k of b.blocks) {
    if (k.type === 'p' && /^(Tip:|Use SHIFT\+choice to display help topic)/.test(k.html.replace(/<[^>]+>/g, '').trim())) continue;
    if (k.type === 'p' && /^Note: You may adjust each starting stat/.test(k.html.replace(/<[^>]+>/g, '').trim())) { right += '<p class="bp">Raise what your calling leans on. Each step costs more the higher a stat goes, and you have 30 points in all. Point at a plus or minus to see its price.</p>'; continue; }
    if (k.type === 'h' && /^Enter Your Starting Stats$/i.test(k.html)) k.html = 'Spend your starting points';   // the tip is about typing capital letters for help: pointing at a choice shows the same here
    if (k.type === 'h') { head = pickHead(k.html.replace(/&amp;/g, '&')); right += head ? `<div class="bhd">${esc(head[0])}</div>${head[1] ? `<p class="bp">${esc(head[1])}</p>` : ''}` : `<div class="bhd">${k.html}</div>`; }
    else if (k.type === 'p' && welcome) continue;   // the welcome is said above in fewer words
    else if (k.type === 'p') right += `<p class="bp">${k.html}</p>`;
    else if (k.type === 'stats') right += `<div class="bst" style="grid-template-columns:130px 34px 64px 34px repeat(${Math.max(0, k.cols.length - 1)},70px)"><span></span><span></span><span class="bh">${esc(k.cols[0] || '')}</span><span></span>${k.cols.slice(1).map(c => `<span class="bh">${esc(c)}</span>`).join('')}
      ${k.rows.map(r => { const v = +r.vals[0], spent = k.rows.reduce((a, q) => a + (STAT_COST[+q.vals[0]] || 0), 0), lo = v <= 8, hi = v >= 17 || spent - STAT_COST[v] + STAT_COST[v + 1] > 30;
        return `<span class="sn" data-tip="${esc((STAT_SAY[r.name] || [r.name, ''])[1])}">${esc((STAT_SAY[r.name] || [r.name])[0])}</span><span class="key kb ${lo ? 'off' : ''}" data-key="${esc(r.dec)}" data-tip="${lo ? 'Already at the lowest (8)' : `Lower (${esc(r.dec)}): gives back ${STAT_COST[v] - STAT_COST[v - 1]} point${STAT_COST[v] - STAT_COST[v - 1] === 1 ? '' : 's'}`}">&minus;</span><b class="sv">${esc(r.vals[0] || '')}</b><span class="key kb ${hi ? 'off' : ''}" data-key="${esc(r.inc)}" data-tip="${v >= 17 ? 'Already at the highest (17)' : hi ? `Raising this costs ${STAT_COST[v + 1] - STAT_COST[v]} more points than you have left` : `Raise (${esc(r.inc)}): costs ${STAT_COST[v + 1] - STAT_COST[v]} point${STAT_COST[v + 1] - STAT_COST[v] === 1 ? '' : 's'}`}">+</span>${r.vals.slice(1).map((v, i) => `<span class="${i === r.vals.length - 2 ? 'st' : 'sm ' + (/^-/.test(v) ? 'neg' : /^\+0$/.test(v) ? 'zero' : /^\+/.test(v) ? 'pos' : '')}">${esc(v)}</span>`).join('')}`; }).join('')}
      ${k.left !== null ? `<span class="sn" style="grid-column:1/5;color:#b3ac9f;font-size:16px" data-tip="Each stat costs points: higher stats cost more. You have 30 to spend.">Points spent</span><span class="sm" style="color:${+k.left > 30 ? '#ff7a66' : +k.left === 30 ? '#a9c98c' : '#ffcf6a'};font-size:19px;white-space:nowrap">${esc(k.left)}<span style="color:#7d776c;font-size:14px"> / 30</span></span>` : ''}</div>`;
    else if (k.type === 'pre') right += `<pre class="bpre">${k.rows.join('\n')}</pre>`;
    else if (!k.items.length) continue;
    else if (head) right += pickTiles(k.cols > 1 ? k.items.filter(i => i.col === 0).concat(k.items.filter(i => i.col > 0)) : k.items, head[0], head[1]);
    else { const n = k.items.length, cols = k.cols > 1 ? k.cols : n > 16 ? 3 : n > 5 ? 2 : 1;
      // two columns of text read down each column, so keep that order
      const ordered = k.cols > 1 ? k.items.filter(i => i.col === 0).concat(k.items.filter(i => i.col > 0)) : k.items, per = Math.ceil(ordered.length / cols);
      right += `<div class="bch" style="grid-template-columns:repeat(${cols},1fr);grid-template-rows:repeat(${k.cols > 1 ? Math.max(k.items.filter(i => i.col === 0).length, k.items.filter(i => i.col > 0).length) : per},auto)">${ordered.map(i => `<div class="bc ${i.dim ? 'dim' : ''}" data-topic="${esc(i.html.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, '').trim())}" data-key="${esc(BKEY[i.key] || i.key)}"><span class="key kb">${esc(i.key.length > 1 ? i.key[0] + i.key.slice(1).toLowerCase() : i.key)}</span><span>${i.html}</span></div>`).join('')}</div>`; }
  }
  return `<div class="pane npanel birth${naming ? ' naming' : ''}" style="width:${left ? 1320 : 900}px;${left ? 'min-height:736px;' : ''}display:flex;flex-direction:column;box-sizing:border-box"><div class="tabs"><div class="on">${left ? 'Forge your character' : 'A new adventure'}</div></div>
    <div class="bbody">${left}<div class="bright">${intro}${right}</div></div>
    <div class="bfoot"><span class="abtn" data-key="\x1b"><span class="key">Esc</span>${esc(back ? navWord(back.label) : 'Back')}</span><span class="sub">${anyCh && !intro && !welcome ? 'Arrows and Enter also choose' : ''}</span><span class="grow"></span>${util.map(i => `<span class="abtn sm" data-key="${esc(BKEY[i.key] || i.key)}" data-topic="${esc(i.label)}">${esc(UTIL[i.label.toLowerCase()])}</span>`).join('')}${ret ? `<span class="abtn go" data-key="\r"><span class="key">Enter</span>${esc(navWord(ret.label))}</span>` : ''}</div></div>`;
}
