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
  const top = msgTop(); if (!top) return null;
  if (/^Welcome! You begin life in the town/.test(top) && G.s.slice(0, 16).some(r => /-more-\s*$/.test((r || '').replace(/\x01/g, ' ').slice(0, S.rmsg[0] + S.rmsg[2])))) return { t: 'welcome' };   // the game's first words, about its message line: said here as a welcome
  if (/-more-/.test(top)) return null;
  if ((m = /^(.*?)\s*\[(y\/n(?:\/Auto)?|Y\/N|Y,n)\]\s*$/.exec(top))) return { t: 'yn', q: m[1], opts: m[2].split(/[\/,]/) };
  if ((m = /Quantity \((\d+)(?:-| to )(\d+)\):\s*(\d*)/.exec(top))) return { t: 'qty', lo: +m[1], hi: +m[2], v: m[3] === '' ? null : +m[3] };
  if ((m = /^Rest \(0-\d+, '\*' for HP\/SP, '&' as needed\):\s*(\S*)/.exec(top))) return { t: 'rest', v: m[1] };
  if ((m = /^Map sector \[[^\]]*\], which is\s*(.*?)\s*your sector\.\s+Direction\?$/.exec(top))) return { t: 'locate', where: m[1] };
  if (/^Direction\b.*\?$/.test(top)) return { t: /'\*'/.test(top) ? 'aim' : 'dir', cur: /'5'/.test(top) ? '5' : /'t'/.test(top) ? 't' : '', near: /'''/.test(top) };
  if ((m = /^(.*?)\s*\[((?:[a-z?+\-(]|<dir>)(?:,(?:[a-z?+\-(]|<dir>))+)\]\s*$/.exec(top))) { const keys = [...new Set(m[2].split(','))]; if (keys.includes('q') || keys.includes('r')) return { t: 'look', what: m[1], keys }; }
  if (/^Enter character to be identified/.test(top)) return { t: 'sym' };
  // the game stops you after a bad blow, so a key held down cannot walk you to your death
  if (/Press (Space|the space bar) to continue\.?\s*$/i.test(top)) return { t: 'hold', low: /LOW HITPOINT WARNING/.test(top) };
  // a line to type sits alone on the first message row with the cursor after it (a long message that happens to hold a colon does not)
  if (G.cv && G.cy === S.rmsg[1] && (m = /^(.{2,90}?):(?: (.*))?$/.exec(top))) return { t: 'text', label: m[1], v: m[2] || '' };
  return null;
}
let ASK_AIM = null;
// lines the game asks you to type that read better with a word of explanation
const ASK_WORDS = { 'Last word': ['Your last words', 'They are kept with your memorial. Type to change them.'], 'Inscription': ['Inscribe it', 'A short note shown after the item\'s name.'], 'Inscribe': ['Inscribe it', 'A short note shown after the item\'s name.'] };
const ASK_LOOK = [['t', 'Target this', 'go'], ['r', 'What is it?'], ['j', 'Walk here'], ['(', 'Walk here'], ['x', 'Items here'], ['+', 'Next'], ['-', 'Previous'], ['m', 'Creatures only'], ['o', 'Look anywhere'], ['p', 'Back to you'], ['?', 'Help']];
function askHtml() {
  const a = askKind(); if (!a || (a.t !== 'aim' && !(a.t === 'look' && ASK_AIM))) ASK_AIM = null;   // stepping through targets is still part of the same aim
  if (!a) return null;
  // what is being thrown or fired: only if it was picked just before the game asked where
  if (a.t === 'aim' && !ASK_AIM) { const sp = typeof CAST !== 'undefined' && CAST.n && Date.now() - CAST.t < 3000 ? CAST.n : ''; ASK_AIM = { sp, o: !sp && typeof LASTPICK !== 'undefined' && LASTPICK && Date.now() - LASTPICK.t < 3000 ? LASTPICK.o : null }; }
  const aimFor = ASK_AIM ? (ASK_AIM.sp ? ASK_AIM.sp : ASK_AIM.o ? 'the ' + baseName(ASK_AIM.o.n) : '') : '';
  const btn = (key, label, cls, capText, tip) => `<span class="abtn ${cls || ''}" data-key="${esc(key)}"${tip ? ` data-tip="${esc(tip)}"` : ''}><span class="key">${esc(capText || key)}</span>${label}</span>`;
  const cancel = label => `<span class="abtn" data-key="Esc"><span class="key">Esc</span>${label || 'Cancel'}</span>`;
  const pick = typeof LASTPICK !== 'undefined' && LASTPICK && Date.now() - LASTPICK.t < 30000 ? LASTPICK.o : null;
  if (a.t === 'yn') {
    const harm = /destroy|donate|suicide|genocide|remove/i.test(a.q);
    const bs = a.opts.map(o => /^y$/i.test(o) ? btn(o, 'Yes', harm ? 'warn' : 'go', o.toUpperCase()) : /^n$/i.test(o) ? btn(o, 'No', '', o.toUpperCase()) : btn('A', /destroy/i.test(a.q) ? 'Always destroy these' : 'Always', '', 'A', 'Adds this kind of item to your auto-destroy list, so you are never asked again.'));
    // the last question of a life: the game offers to keep a text picture of its own screen, which means nothing here (Y still does it)
    if (/^Dump the screen\?$/.test(a.q) && S.p && S.p.hp < 0) {
      const foe = (S.mons || []).filter(m => !m.pet).sort((x, y) => x.dist - y.dist)[0];
      return { cls: 'mid danger', html: `<div class="askh">You have died</div><div class="asks">${esc(S.p.place)}${S.p.dlvl ? ', level ' + S.p.dlvl : ''}${foe && foe.dist <= 2 ? ' · ' + esc(cap(foe.n.replace(/^an? /, ''))) + ' stands over you' : ''}</div>
        <div class="askb">${btn('n', 'Continue', 'warn', 'N')}</div>` };
    }
    // a few of the game's questions read better said plainly
    let q = a.q, sub = '', m2;
    if ((m2 = /^This is the entrance of (.+?) \(Danger level: (\d+)\) Do you really go into this dungeon\?$/.exec(q))) { const dn = m2[1].replace(/^the /i, ''); q = `Enter ${/^(Angband|Camelot|Hell|Heaven|Numenor|R'lyeh|Mount |Asgard|Atlantis|Random )/.test(dn) ? '' : 'the '}${dn}?`; sub = `Danger level ${m2[2]}`; }
    else if ((m2 = /^Really (.+)\?$/.exec(q))) q = cap(m2[1]) + '?';
    return { cls: 'mid', html: `<div class="askh">${esc(q)}</div>${sub ? `<div class="asks">${esc(sub)}</div>` : ''}<div class="askb">${bs.join('')}</div>` };
  }
  if (a.t === 'qty') {
    const v = a.v == null ? a.lo : Math.max(a.lo, Math.min(a.hi, a.v)), half = Math.max(a.lo, Math.ceil(a.hi / 2));
    const head = pick ? `<div class="askit"><div class="slot t-${tvIcon(pick.tv)}">${artHtml(pick.ki, 44) || icon(tvIcon(pick.tv))}</div><span>${esc(cap(pick.n.replace(/^(\d+|an?|the) /i, '')))}</span></div>` : '';
    const qv = typeof LASTPICK !== 'undefined' && LASTPICK && LASTPICK.c && Date.now() - LASTPICK.t < 8000 ? { d: 'Drop', v: 'Throw', k: 'Destroy', E: 'Eat', q: 'Quaff', r: 'Read', w: 'Take' }[LASTPICK.c] : '';
    return { cls: 'mid', html: `<div class="askh">${qv ? qv + ' how many?' : 'How many?'}</div>${head}
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
  if (a.t === 'locate') { const ar = (k, g, tip) => `<span class="btn askar" data-key="${k}" data-tip="${tip}">${g}</span>`;
    return { cls: 'strip', html: `<div class="askrow"><div class="grow"><div class="askh lite">Looking around the level</div><div class="asks">${a.where ? `You are looking ${esc(a.where.replace(/ of$/, '').toLowerCase())} of where you stand.` : 'This is where you stand.'} Move the view with the arrows.</div></div>${ar('4', '◀', 'West')}${ar('8', '▲', 'North')}${ar('2', '▼', 'South')}${ar('6', '▶', 'East')}<span class="btn go" data-key="Esc">Done</span></div>` }; }
  if (a.t === 'dir') return { cls: 'strip', html: `<div class="askrow"><div class="grow"><div class="askh lite">Which way?</div><div class="asks">Click a square next to you, or press a direction.</div></div>${cancel()}</div>` };
  const foes = a.t === 'aim' && (S.mons || []).some(m => !m.pet && !m.friendly);
  if (a.t === 'aim') return { cls: 'strip', html: `<div class="askrow">${ASK_AIM.o && artHtml(ASK_AIM.o.ki, 40) ? `<div class="slot askart t-${tvIcon(ASK_AIM.o.tv)}" data-tip="${esc(cap(ASK_AIM.o.n))}">${artHtml(ASK_AIM.o.ki, 40)}</div>` : ''}<div class="grow"><div class="askh lite">Choose a target${aimFor ? ` <span class="askfor">for ${esc(aimFor)}</span>` : ''}</div><div class="asks">${foes ? 'Click a creature, or any square to aim that way.' : 'Nothing is in sight. Click any square to aim that way.'}</div></div>
      ${a.cur ? btn(a.cur, 'Same target', 'go', a.cur, 'Aim at the creature you already have targeted') : ''}${foes ? (a.cur ? btn('*', 'Another', '', '*', 'Step through the creatures in view') : btn('*t', 'Nearest', 'go', '*', 'Aim at the nearest creature in view (press * to step through them)')) : ''}${cancel()}</div>` };
  if (a.t === 'look' && ASK_AIM && a.keys.includes('t')) {   // choosing a target for a shot or a spell: only what that needs
    const nm = cap(a.what.replace(/^Monster:\s*/i, '').replace(/^(an?|the) /i, '')), what = ASK_AIM.sp || (ASK_AIM.o ? 'the ' + baseName(ASK_AIM.o.n) : '');
    return { cls: 'strip', html: `<div class="askrow"><div class="grow"><div class="askh lite">${esc(nm)}</div><div class="asks">${what ? `Target for ${esc(what)}. ` : ''}Click another creature to change.</div></div>
      ${btn('t', 'Aim here', 'go', 't')}${a.keys.includes('+') ? btn('+', 'Next', '', '+', 'The next creature in view') : ''}${cancel()}</div>` };
  }
  if (a.t === 'look') {
    const bs = ASK_LOOK.filter(([k]) => a.keys.includes(k)).filter(([k], i, l) => !(k === '(' && l.some(o => o[0] === 'j'))).map(([k, w, c]) => btn(k, w, c));
    return { cls: 'strip look', html: `<div class="askh lite">${esc(a.what)}</div><div class="askb wrap">${bs.join('')}${cancel('Done')}</div>` };
  }
  if (a.t === 'welcome') return { cls: 'mid wide', html: `<div class="askh">Welcome to ${esc(S.p.place || 'the town')}</div>
      <div class="asks left">You begin in town with a little gold. Buy what you need in the shops, then look for the way down.</div>
      <div class="asktips"><div><b>Click</b> a square to walk there, a creature to fight it.</div><div><b>Right-click</b> anything to see what you can do with it.</div><div><b>${S.p.rl ? 'The map button' : 'M'}</b> opens the map of the town; click a place on it to go there.</div><div><b>F1</b> lists every control. Every key of the original game still works.</div></div>
      <div class="askb">${btn(' ', 'Begin', 'go', 'Space')}</div>` };
  if (a.t === 'hold') {
    const p = S.p, pct = p.mhp ? Math.max(0, Math.min(100, Math.round(100 * p.hp / p.mhp))) : 0;
    return { cls: 'mid' + (a.low ? ' danger' : ''), html: a.low ? `<div class="askh">Your life is low</div><div class="asklife"><i style="width:${pct}%"></i><b>${p.hp} of ${p.mhp}</b></div><div class="asks">The game has stopped you so a held key cannot walk you on.</div><div class="askb">${btn(' ', 'Carry on', 'warn', 'Space')}</div>`
      : `<div class="askh lite">A moment</div><div class="asks">${esc(plain(msgTop()).replace(/\s*Press (Space|the space bar) to continue\.?\s*$/i, ''))}</div><div class="askb">${btn(' ', 'Carry on', 'go', 'Space')}</div>` };
  }
  if (a.t === 'sym') return { cls: 'mid', html: `<div class="askh lite">Which creatures do you want to read about?</div><div class="asks">Or press the symbol of one kind.</div>
      <div class="askb col">${btn('\x01', 'Every creature you know', 'go', 'Ctrl A')}${btn('\x15', 'Named ones only', '', 'Ctrl U')}${btn('\x0e', 'All but the named ones', '', 'Ctrl N')}${btn('\r', 'Search by name', '', 'Enter')}</div><div class="askb">${cancel()}</div>` };
  if (a.t === 'text') { const w = ASK_WORDS[a.label]; if (w) { a.label = w[0]; a.sub = a.sub || w[1]; } }
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
