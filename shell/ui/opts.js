// The option pages (Input, Map Screen, Game-Play, Birth...) as a settings panel: every option with
// its value as a switch, its short name, and its description from the game's help on hover.
// Built from the game's own page text, so nothing is lost; clicking moves the game's cursor and
// presses y or n exactly as the keyboard would. Keys work as before (arrows, y/n, Esc).
'use strict';
const OPT_HEAD = /^(.+?)\s*\((?:RET:next, (y\/n:change, ESC:accept|ESC:exit), \?:help|RET to advance, y\/n to set(, 'F' for frequency)?, ESC to accept)\)/;
function optsParse() {
  const head = OPT_HEAD.exec(rowText(0)); if (!head) return null;
  const rows = []; let note = '';
  for (let y = 1; y < G.h; y++) {
    const s = rowText(y); if (!s.trim()) continue;
    const m = /^(.{1,48}?)\s*: (.*?)\s*(?:\(([^)]*)\)?)?$/.exec(s);
    if (m && s.length > 48 && s[48] === ':') rows.push({ y, label: m[1].trim(), value: m[2].trim(), id: (m[3] || '').trim() });
    else rows.push({ y, note: s.trim() });
  }
  if (!rows.some(r => !r.note)) return null;
  return { title: head[1].replace(/\s*\(.*$/, ''), browse: /ESC:exit/.test(head[2] || ''), freq: !!head[3], help: !!head[2], rows, cur: G.cy };
}
function optsHtml() {
  const o = optsParse(); if (!o) return '';
  topicsLoad();
  const opts = o.rows.filter(r => !r.note), cur = opts.findIndex(r => r.y === o.cur);
  let i = -1;
  const body = o.rows.map(r => {
    if (r.note) return `<div class="onote">${esc(r.note)}</div>`;
    i++;
    const yn = /^(yes|no)$/i.test(r.value), on = /^yes$/i.test(r.value);
    const ctl = yn ? `<span class="osw ${on ? 'on' : ''}"><i></i></span>`
      : `<span class="oval"><b class="key kb" data-oi="${i}" data-od="n">&lsaquo;</b><span>${esc(r.value)}</span><b class="key kb" data-oi="${i}" data-od="y">&rsaquo;</b></span>`;
    return `<div class="orow ${i === cur ? 'sel' : ''} ${o.browse ? 'ro' : ''}" data-oi="${i}" data-od="${yn ? (on ? 'n' : 'y') : ''}" data-topic="${esc(r.id)}" data-tt="${esc(r.label)}">
      <span class="olab">${esc(r.label)}</span><span class="oid">${esc(r.id)}</span>${o.browse ? `<span class="oro">${esc(r.value)}</span>` : ctl}</div>`;
  }).join('');
  OPTS = { cur, n: opts.length, browse: o.browse };
  return `<div class="pane npanel optp"><div class="tabs"><div class="on">${esc(o.title)}</div></div>
    <div class="orows">${body}</div>
    <div class="nfoot"><span class="sub">${o.browse ? 'These are set when a character is created and can only be viewed here.' : 'Click an option to change it. Hover for what it does.'}</span><span class="grow"></span>
      ${o.freq ? '<span class="row" data-key="F"><span class="key">F</span>how often</span>' : ''}${o.help ? '<span class="row" data-key="?"><span class="key">?</span>help</span>' : ''}<span class="row" data-key="\x1b"><span class="key">Esc</span>${o.browse ? 'close' : 'done'}</span></div></div>`;
}
let OPTS = null;
// move the game's cursor to option i, then press y or n
function optsGo(i, d) {
  if (!OPTS || OPTS.cur < 0) return;
  const diff = i - OPTS.cur; let keys = diff > 0 ? '2'.repeat(diff) : '8'.repeat(-diff);
  if (d && !OPTS.browse) keys += d;
  if (keys) sendText(keys);
}
document.addEventListener('click', ev => {
  const t = ev.target.closest && ev.target.closest('.optp [data-oi]'); if (!t) return;
  ev.stopPropagation(); optsGo(+t.dataset.oi, t.dataset.od);
}, true);
