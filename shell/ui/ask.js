// Questions the game asks while you are on the map (yes or no, how many, which way, rest how long, a line to type)
// get a card with real buttons in place of a line of text with key letters. Every key still answers as it always did.
'use strict';
function askKind() {
  if (!S || G.icky) return null;
  let m;
  if (G.ov) {   // a line to type that the game drew over the map (an inscription, a name): the same card, with what it said above
    if (typeof UI !== 'undefined' && UI && uiOnTop()) return null;
    const b = menuBox(); if (!b || b.y1 - b.y0 > 3 || !G.cv || G.cy !== b.y1) return null;
    const row = y => (G.s[y] || '').replace(/\x01/g, ' ').trim();
    if (!(m = /^(.{2,90}?):(?: (.*))?$/.exec(row(b.y1)))) return null;
    const above = []; for (let y = b.y0; y < b.y1; y++) if (row(y)) above.push(row(y));
    return { t: 'text', label: m[1], v: m[2] || '', sub: above.join(' ') };
  }
  const top = msgTop(); if (!top || /-more-/.test(top)) return null;
  if ((m = /^(.*?)\s*\[(y\/n(?:\/Auto)?|Y\/N|Y,n)\]\s*$/.exec(top))) return { t: 'yn', q: m[1], opts: m[2].split(/[\/,]/) };
  if ((m = /Quantity \((\d+)(?:-| to )(\d+)\):\s*(\d*)/.exec(top))) return { t: 'qty', lo: +m[1], hi: +m[2], v: m[3] === '' ? null : +m[3] };
  if ((m = /^Rest \(0-\d+, '\*' for HP\/SP, '&' as needed\):\s*(\S*)/.exec(top))) return { t: 'rest', v: m[1] };
  if (/^Direction\b.*\?$/.test(top)) return { t: /'\*'/.test(top) ? 'aim' : 'dir', cur: /'5'/.test(top) ? '5' : /'t'/.test(top) ? 't' : '', near: /'''/.test(top) };
  if ((m = /^(.*?)\s*\[((?:[a-z?+\-(]|<dir>)(?:,(?:[a-z?+\-(]|<dir>))+)\]\s*$/.exec(top))) { const keys = [...new Set(m[2].split(','))]; if (keys.includes('q') || keys.includes('r')) return { t: 'look', what: m[1], keys }; }
  if (/^Enter character to be identified/.test(top)) return { t: 'sym' };
  if (G.cv && G.cy < S.rmsg[1] + Math.max(1, S.rmsg[3]) && (m = /^(.{2,90}?):(?: (.*))?$/.exec(top))) return { t: 'text', label: m[1], v: m[2] || '' };
  return null;
}
const ASK_LOOK = [['t', 'Target this', 'go'], ['r', 'What is it?'], ['j', 'Walk here'], ['(', 'Walk here'], ['x', 'Items here'], ['+', 'Next'], ['-', 'Previous'], ['m', 'Creatures only'], ['o', 'Look anywhere'], ['p', 'Back to you'], ['?', 'Help']];
function askHtml() {
  const a = askKind(); if (!a) return null;
  const btn = (key, label, cls, capText, tip) => `<span class="abtn ${cls || ''}" data-key="${esc(key)}"${tip ? ` data-tip="${esc(tip)}"` : ''}><span class="key">${esc(capText || key)}</span>${label}</span>`;
  const cancel = label => `<span class="abtn" data-key="Esc"><span class="key">Esc</span>${label || 'Cancel'}</span>`;
  const pick = typeof LASTPICK !== 'undefined' && LASTPICK && Date.now() - LASTPICK.t < 30000 ? LASTPICK.o : null;
  if (a.t === 'yn') {
    const harm = /destroy|donate|suicide|genocide|remove/i.test(a.q);
    const bs = a.opts.map(o => /^y$/i.test(o) ? btn(o, 'Yes', harm ? 'warn' : 'go', o.toUpperCase()) : /^n$/i.test(o) ? btn(o, 'No', '', o.toUpperCase()) : btn('A', /destroy/i.test(a.q) ? 'Always destroy these' : 'Always', '', 'A', 'Adds this kind of item to your auto-destroy list, so you are never asked again.'));
    // a few of the game's questions read better said plainly
    let q = a.q, sub = '', m2;
    if ((m2 = /^This is the entrance of (.+?) \(Danger level: (\d+)\) Do you really go into this dungeon\?$/.exec(q))) { q = `Enter the ${m2[1].replace(/^the /i, '')}?`; sub = `Danger level ${m2[2]}`; }
    else if ((m2 = /^Really (.+)\?$/.exec(q))) q = cap(m2[1]) + '?';
    return { cls: 'mid', html: `<div class="askh">${esc(q)}</div>${sub ? `<div class="asks">${esc(sub)}</div>` : ''}<div class="askb">${bs.join('')}</div>` };
  }
  if (a.t === 'qty') {
    const v = a.v == null ? a.lo : Math.max(a.lo, Math.min(a.hi, a.v)), half = Math.max(a.lo, Math.ceil(a.hi / 2));
    const head = pick ? `<div class="askit"><div class="slot t-${tvIcon(pick.tv)}">${artHtml(pick.ki, 44) || icon(tvIcon(pick.tv))}</div><span>${esc(cap(pick.n.replace(/^(\d+|an?|the) /i, '')))}</span></div>` : '';
    return { cls: 'mid', html: `<div class="askh">How many?</div>${head}
      <div class="shqty askq"><span class="key kb ${v <= a.lo ? 'off' : ''}" data-askq="-1" data-tip="One fewer (Left)">&minus;</span><b class="num">${v}</b><span class="key kb ${v >= a.hi ? 'off' : ''}" data-askq="1" data-tip="One more (Right)">+</span>
      <span class="shchip" data-askq="=${a.lo}">${a.lo}</span>${a.hi > 3 ? `<span class="shchip" data-askq="=${half}">half</span>` : ''}<span class="shchip" data-askq="=${a.hi}">all ${a.hi}</span></div>
      <div class="askb">${btn('\r', 'OK', 'go', 'Enter')}${cancel()}</div>` };
  }
  if (a.t === 'rest') {
    const q = (n, label, cls, tip) => `<span class="abtn ${cls || ''}" data-qty="${n}" data-tip="${tip}"><span class="key">${n}</span>${label}</span>`;
    return { cls: 'mid', html: `<div class="askh">Rest how long?</div><div class="asks">You wake at once if anything disturbs you.</div>
      <div class="askb col">${q('&', 'As long as needed', 'go', 'Until life and mana are back and what ails you has passed')}${q('*', 'Until life or mana is full', '', 'Stops as soon as either one is full')}${q('50', 'Fifty turns', '', 'A short breather')}</div>
      <div class="askb">${cancel()}</div>` };
  }
  if (a.t === 'dir') return { cls: 'strip', html: `<div class="askrow"><div class="grow"><div class="askh lite">Which way?</div><div class="asks">Click a square next to you, or press a direction.</div></div>${cancel()}</div>` };
  if (a.t === 'aim') return { cls: 'strip', html: `<div class="askrow"><div class="grow"><div class="askh lite">Choose a target</div><div class="asks">Click a creature, or any square to aim that way.</div></div>
      ${a.cur ? btn(a.cur, 'Same target', 'go', a.cur, 'Aim at the creature you already have targeted') : ''}${btn('*', a.cur ? 'Another' : 'Nearest', a.cur ? '' : 'go', '*', 'Step through the creatures in view')}${cancel()}</div>` };
  if (a.t === 'look') {
    const bs = ASK_LOOK.filter(([k]) => a.keys.includes(k)).filter(([k], i, l) => !(k === '(' && l.some(o => o[0] === 'j'))).map(([k, w, c]) => btn(k, w, c));
    return { cls: 'strip look', html: `<div class="askh lite">${esc(a.what)}</div><div class="askb wrap">${bs.join('')}${cancel('Done')}</div>` };
  }
  if (a.t === 'sym') return { cls: 'mid', html: `<div class="askh lite">Which creatures do you want to read about?</div><div class="asks">Or press the symbol of one kind.</div>
      <div class="askb col">${btn('\x01', 'Every creature you know', 'go', 'Ctrl A')}${btn('\x15', 'Named ones only', '', 'Ctrl U')}${btn('\x0e', 'All but the named ones', '', 'Ctrl N')}${btn('\r', 'Search by name', '', 'Enter')}</div><div class="askb">${cancel()}</div>` };
  if (a.t === 'text') return { cls: 'mid', html: `<div class="askh lite">${esc(a.label)}</div>${a.sub ? `<div class="asks">${esc(a.sub)}</div>` : ''}<div class="askf">${esc(a.v)}<i class="caret"></i></div><div class="askb">${btn('\r', 'OK', 'go', 'Enter')}${cancel()}</div>` };
  return null;
}
function askQty(d) {
  const a = askKind(); if (!a || a.t !== 'qty') return false;
  const v = a.v == null ? a.lo : a.v, n = Math.max(a.lo, Math.min(a.hi, String(d)[0] === '=' ? +String(d).slice(1) : v + (+d)));
  sendText('\b'.repeat(8) + '\x7f'.repeat(8) + n); return true;
}
function askKey(e) {
  if (e.ctrlKey || e.altKey || e.metaKey) return false;
  if (e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === '+' || e.key === '=') return askQty(1);
  if (e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.key === '-') return askQty(-1);
  return false;
}
document.addEventListener('click', ev => { const q = ev.target.closest && ev.target.closest('[data-askq]'); if (!q) return; ev.stopPropagation(); ev.preventDefault(); askQty(q.dataset.askq); }, true);
document.addEventListener('wheel', ev => { if (ev.target.closest && ev.target.closest('.askq')) { ev.preventDefault(); askQty(ev.deltaY < 0 ? 1 : -1); } }, { passive: false });
