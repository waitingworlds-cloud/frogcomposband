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
      const m = /^([A-Z][A-Za-z ]{0,9}?)\s*:\s?(.*)$/.exec(rows[y].slice(0, SPLIT)); if (!m) break;
      const right = rows[y].slice(SPLIT), f = { label: m[1], value: m[2].trim(), y };
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
    <div class="ttip">Full keyboard play · click to walk · right-click anything for its actions · F6 sound</div></div>`;
}
function titleAfter() {
  document.querySelectorAll('.tmob').forEach(c => { const S2 = 96, d = 2 * SCALE * (devicePixelRatio || 1); c.width = c.height = Math.round(S2 * d); const g = c.getContext('2d'); g.scale(d, d); sprite.flat = true; sprite(g, 'mon', c.dataset.n, 0, 0, S2); sprite.flat = false; });
}
function birthHtml() {
  topicsLoad();
  if (G.ov) return '';
  const b = birthParse(); if (!b || (!b.nchoice && !b.fields.length)) return '';
  const val = n => (b.fields.find(f => f.label === n) || {}).value || '';
  let left = '';
  if (b.fields.length) {
    const main = b.fields.filter(f => f.label !== 'Name' && !f.side), side = b.fields.filter(f => f.side);
    const tone = v => /^-/.test(v) ? 'neg' : /^\+0$|^100%$|^$/.test(v) ? 'zero' : 'pos';
    const table = b.cols.length ? `<div class="btab ${b.words ? 'words' : ''}" style="grid-template-columns:62px repeat(${b.cols.length},${b.words ? "auto" : "1fr"})"><span></span>${b.cols.map(c => `<span class="bh">${esc(c)}</span>`).join('')}
      ${main.filter(f => f.vals).map(f => { const tot = f.vals === b.total; return `<span class="bl ${tot ? 'tot' : ''}">${tot ? 'Total' : esc(f.label)}</span>${f.vals.map((v, i) => `<span class="bv ${tot ? 'tot' : ''} ${b.words ? '' : tone(v)}"${f.cols ? ` style="color:${f.cols[i]}"` : ''}>${esc(v)}</span>`).join('')}`; }).join('')}</div>` : '';
    left = `<div class="bsheet"><div class="bname">${esc(val('Name')) || 'Unnamed'}</div>
      <div class="bsub">${esc([val('Sex'), val('Race'), val('Class')].filter(Boolean).join(' · '))}</div>
      <div class="bfields">${main.concat(side).map(f => `<div class="bf"><span class="lbl">${esc(f.label)}</span><b>${esc(f.value) || '<i>none</i>'}</b></div>`).join('')}</div>
      <div class="sect" style="margin-top:14px">${b.words ? 'Skills' : 'Bonuses'}</div>${table}</div>`;
  }
  let right = '';
  for (const k of b.blocks) {
    if (k.type === 'h') right += `<div class="bhd">${k.html}</div>`;
    else if (k.type === 'p') right += `<p class="bp">${k.html}</p>`;
    else if (k.type === 'stats') right += `<div class="bst" style="grid-template-columns:90px 34px 64px 34px repeat(${Math.max(0, k.cols.length - 1)},70px)"><span></span><span></span><span class="bh">${esc(k.cols[0] || '')}</span><span></span>${k.cols.slice(1).map(c => `<span class="bh">${esc(c)}</span>`).join('')}
      ${k.rows.map(r => `<span class="sn">${esc(r.name)}</span><span class="key kb" data-key="${esc(r.dec)}" data-tip="Lower (${esc(r.dec)})">&minus;</span><b class="sv">${esc(r.vals[0] || '')}</b><span class="key kb" data-key="${esc(r.inc)}" data-tip="Raise (${esc(r.inc)})">+</span>${r.vals.slice(1).map((v, i) => `<span class="${i === r.vals.length - 2 ? 'st' : 'sm ' + (/^-/.test(v) ? 'neg' : /^\+0$/.test(v) ? 'zero' : /^\+/.test(v) ? 'pos' : '')}">${esc(v)}</span>`).join('')}`).join('')}
      ${k.left !== null ? `<span class="sn" style="grid-column:1/5;color:#b3ac9f;font-size:16px" data-tip="Each stat costs points: higher stats cost more. You have 30 to spend.">Points spent</span><span class="sm" style="color:${+k.left > 30 ? '#ff7a66' : +k.left === 30 ? '#a9c98c' : '#ffcf6a'};font-size:19px;white-space:nowrap">${esc(k.left)}<span style="color:#7d776c;font-size:14px"> / 30</span></span>` : ''}</div>`;
    else if (k.type === 'pre') right += `<pre class="bpre">${k.rows.join('\n')}</pre>`;
    else if (!k.items.length) continue;
    else { const n = k.items.length, cols = k.cols > 1 ? k.cols : n > 16 ? 3 : n > 5 ? 2 : 1;
      // two columns of text read down each column, so keep that order
      const ordered = k.cols > 1 ? k.items.filter(i => i.col === 0).concat(k.items.filter(i => i.col > 0)) : k.items, per = Math.ceil(ordered.length / cols);
      right += `<div class="bch" style="grid-template-columns:repeat(${cols},1fr);grid-template-rows:repeat(${k.cols > 1 ? Math.max(k.items.filter(i => i.col === 0).length, k.items.filter(i => i.col > 0).length) : per},auto)">${ordered.map(i => `<div class="bc ${i.dim ? 'dim' : ''}" data-topic="${esc(i.html.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, '').trim())}" data-key="${esc(BKEY[i.key] || i.key)}"><span class="key kb">${esc(i.key.length > 1 ? i.key[0] + i.key.slice(1).toLowerCase() : i.key)}</span><span>${i.html}</span></div>`).join('')}</div>`; }
  }
  return `<div class="pane npanel birth" style="width:${left ? 1320 : 900}px"><div class="tabs"><div class="on">${left ? 'Forge your character' : 'FrogComposband'}</div></div>
    <div class="bbody">${left}<div class="bright">${right}</div></div></div>`;
}
