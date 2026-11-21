// Town buildings (the inn, guilds, the bounty office and their kind). The game draws these as a page of text:
// here the place gets the same window as a shop, with its services as buttons and what is said shown beside them.
'use strict';
function bldgInfo() {
  if (!S || !G.icky) return null;
  let ex = -1; for (let y = G.h - 1; y > 3; y--) if (/ESC\) Exit building/.test(rowText(y))) { ex = y; break; }
  if (ex < 0) return null;
  let hy = -1, hm = null, msg = ''; for (let y = 0; y < Math.min(ex, 8); y++) { if ((hm = /^\s*(\S.*?) \(([A-Za-z -]+)\)\s{2,}(\S.*?)\s*$/.exec(rowText(y)))) { hy = y; break; } if (rowText(y).trim()) msg += (msg ? ' ' : '') + rowText(y).trim(); }
  if (!hm) return null;
  const acts = []; let first = ex;
  for (let y = ex - 1; y > hy; y--) {
    const s = rowText(y), re = /(?:^|\s)(\S)\) (\S.*?)(?=\s{2,}|$)/g; let m, any = false;
    while ((m = re.exec(s))) { const x = m.index + m[0].indexOf(m[1] + ')'), a = (G.a[y] || [])[x + 3] & 31, pm = /^(.*?)\s*\((\d+)gp\)$/.exec(m[2]);
      acts.push({ k: m[1], n: pm ? pm[1] : m[2].replace(/\s*\(closed\)$/i, ''), cost: pm ? +pm[2] : 0, off: a === 8, closed: /\(closed\)$/i.test(m[2]), y, x }); any = true; }
    if (any) first = y; else if (s.trim() && acts.length) break; else if (!s.trim() && acts.length && y < first - 1) break;
  }
  acts.sort((p, q) => p.y - q.y || p.x - q.x);
  let gold = null; for (let y = ex; y < Math.min(G.h, ex + 3); y++) { const m = /Gold Remaining:\s*(-?\d+)/.exec(rowText(y)); if (m) gold = +m[1]; }
  return { owner: hm[1], race: hm[2], name: hm[3], acts, gold, y0: hy + 1, y1: first - 1, msg };
}
function bldgHtml() {
  const b = bldgInfo(); if (!b) return '';
  // what the place has said or shown (rumours, lists, results), set as type in the right half
  let ty0 = b.y0, ty1 = b.y1; while (ty0 <= ty1 && !rowText(ty0).trim()) ty0++; while (ty1 >= ty0 && !rowText(ty1).trim()) ty1--;
  let said = '';
  if (ty1 >= ty0) {
    let lx = 999, rx = 0; for (let y = ty0; y <= ty1; y++) { const s = rowText(y); if (!s.trim()) continue; lx = Math.min(lx, s.search(/\S/)); rx = Math.max(rx, s.length); }
    const nw = Math.max(40, rx - lx), fs = 18, cw = Math.round(Math.min(fs * .56, 800 / nw) * 100) / 100, lh = Math.min(25, Math.floor(600 / (ty1 - ty0 + 1)));
    let rows = ''; for (let y = ty0; y <= ty1; y++) rows += `<div class="pr">${pageRow(y, { x0: lx, x1: rx }, cw, false)}</div>`;
    said = `<div class="pgt" style="width:${Math.ceil(nw * cw)}px;font-size:${(fs * Math.min(1, cw / (fs * .56), lh / 25)).toFixed(1)}px;--lh:${lh}px">${rows}</div>`;
  }
  const yn = /^(.*?)\s*\[(y\/n|Y\/N|Y,n)\]\s*$/.exec(b.msg || '');
  if (yn) { const o = yn[2].split(/[\/,]/); said = `<div class="bmsg">${esc(yn[1])}<div class="askb"><span class="abtn go" data-key="${o[0]}"><span class="key">${o[0].toUpperCase()}</span>Yes</span><span class="abtn" data-key="${o[1]}"><span class="key">${o[1].toUpperCase()}</span>No</span></div></div>` + said; }
  else if (b.msg) { const more = /-more-/.test(b.msg); said = `<div class="bmsg">${esc(b.msg.replace(/-more-/, '').trim())}${more ? '<div class="askb"><span class="abtn go" data-key=" "><span class="key">Space</span>Continue</span></div>' : ''}</div>` + said; }
  const gold = b.gold != null ? b.gold : S.p.au;
  const card = a => { const cant = a.off || a.closed, why = a.closed ? 'Closed' : a.off ? (a.cost > gold ? 'You cannot afford this' : 'Not for you') : '';
    return `<div class="bact ${cant ? 'off' : ''}" ${cant ? '' : `data-key="${esc(a.k)}"`}${why ? ` data-tip="${why}"` : ''}><span class="key">${esc(a.k)}</span><span class="grow">${esc(a.n)}</span>${a.cost ? `<b class="num ${a.cost > gold ? 'short' : ''}">${a.cost.toLocaleString()}</b><span class="sub">gold</span>` : a.closed ? '<span class="sub">closed</span>' : '<span class="sub">free</span>'}</div>`; };
  return `<div class="pane npanel shopp shop2 bldg nohub">
    <div class="shtop"><div class="grow"><div class="spn" style="font-size:32px;color:var(--em2)">${esc(b.name)}</div><div class="sub">${esc(b.owner)}, ${esc(/^[aeiou]/i.test(b.race) ? 'an' : 'a')} ${esc(b.race.toLowerCase())}, runs this place</div></div><div style="text-align:right"><div class="lbl">your gold</div><b class="num" style="font-size:30px;color:#ffcf6a">${gold.toLocaleString()}</b></div></div>
    <div class="sh2"><div class="bacts"><div class="catr">what they offer</div>${b.acts.map(card).join('') || '<div class="sub" style="padding:12px 4px">Nothing for you here today.</div>'}</div>
      <div class="shcard bsaid">${said || `<div class="shempty"><div class="shemi">${icon('scroll')}</div><div>Choose what you want on the left.</div><div class="sub">Anything they tell you appears here.</div></div>`}</div></div>
    <div class="nfoot"><span class="sub">Click a service, or press its key.</span><span class="grow"></span><span class="row" data-key="\x1b"><span class="key">Esc</span>leave</span></div></div>`;
}
