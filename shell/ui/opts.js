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
// options that only changed the old text screen (its refresh, its side bar, its symbols): they do nothing here, so they are
// left off the page unless the game's cursor is standing on one
const OPT_OLD = { fresh_before: 1, fresh_after: 1, fresh_message: 1, hilite_player: 1, equippy_chars: 1, display_hp_bar: 1, display_sp_bar: 1, show_rogue_keys: 1, display_race: 1, ring_bell: 1, object_list_width: 1, monster_list_width: 1 };
// the plainer way to say some of them
const OPT_SAY = { rogue_like_commands: 'Classic roguelike keys (h j k l to move)', always_pickup: 'Pick things up as you walk over them', quick_messages: 'Any key dismisses a message', command_menu: 'Enter opens a menu of commands',
  use_old_target: 'Keep aiming at your last target without asking', auto_target: 'Aim at the nearest creature without asking', always_repeat: 'Keep trying doors, traps and digging until done', confirm_destroy: 'Ask before destroying worthless items',
  confirm_wear: 'Ask before putting on a cursed item', target_pet: 'Let your own pets be targeted', easy_open: 'Open doors by walking into them', easy_disarm: 'Disarm traps by walking into them', limit_shop_prompts: 'Shops offer only as many as you can afford',
  center_player: 'Keep the map centred on you', center_running: 'Stay centred while running too', display_path: 'Show the path of a shot before firing', depth_in_feet: 'Show depth in feet', last_words: 'Leave last words when you die',
  find_ignore_stairs: 'Run past stairs without stopping', find_ignore_doors: 'Run through open doors', disturb_near: 'Stop when a creature in view moves', disturb_move: 'Stop when any creature moves', disturb_pets: 'Stop when your pets move',
  destroy_items: 'Destroy junk without asking', show_weights: 'Show weights in item lists', show_discounts: 'Show discounts in item lists', display_distance: 'Show distance in the creature list', list_stairs: 'Show stairs in the floor list' };
function optsHtml() {
  const o = optsParse(); if (!o) return '';
  topicsLoad();
  const opts = o.rows.filter(r => !r.note), cur = opts.findIndex(r => r.y === o.cur);
  let i = -1;
  const body = o.rows.map(r => {
    if (r.note) return /scroll down for more/i.test(r.note) ? '<div class="onote">More options below: scroll, or move down with the arrow keys.</div>' : `<div class="onote">${esc(r.note)}</div>`;
    i++;
    if (OPT_OLD[r.id] && r.y !== o.cur) return '';
    const yn = /^(yes|no)$/i.test(r.value), on = /^yes$/i.test(r.value);
    const ctl = yn ? `<span class="osw ${on ? 'on' : ''}"><i></i></span>`
      : `<span class="oval"><b class="key kb" data-oi="${i}" data-od="n">&lsaquo;</b><span>${esc(r.value)}</span><b class="key kb" data-oi="${i}" data-od="y">&rsaquo;</b></span>`;
    const sc = /\(\*\)/.test(r.label), lab = OPT_SAY[r.id] || r.label.replace(/\s*\(\*\)\s*/g, ' ').replace(/(\S)\(/g, '$1 (').replace(/\bMogaminator\b/g, 'pickup rules').trim();
    return `<div class="orow ${i === cur ? 'sel' : ''} ${o.browse ? 'ro' : ''}" data-oi="${i}" data-od="${yn ? (on ? 'n' : 'y') : ''}" data-topic="${esc(r.id || optTopic(lab))}" data-tt="${esc(lab)}">
      <span class="olab">${esc(lab)}${sc ? ' <span class="oscore">score</span>' : ''}</span>${o.browse ? `<span class="oro">${esc(r.value)}</span>` : ctl}</div>`;
  }).join('');
  OPTS = { cur, n: opts.length, browse: o.browse };
  const mw = typeof MENU_WORDS !== 'undefined' && MENU_WORDS[o.title], title = /^Birth Option/i.test(o.title) ? 'Starting rules' : mw ? mw[0] : o.title, scored = /effect score/i.test(o.title) || o.rows.some(r => /\(\*\)/.test(r.label || ''));
  return `<div class="pane npanel optp"><div class="tabs"><div class="on">${esc(title)}</div></div>
    ${scored ? '<div class="onote">These are fixed once your character is made. Options marked <span class="oscore">score</span> change how your final score is counted.</div>' : ''}
    <div class="ohd"><span class="btn" data-key="\x1b">&lsaquo; All options</span><b>${esc(title)}</b>${mw && mw[1] ? `<i>${esc(mw[1])}</i>` : ''}</div>
    <div class="orows">${body}</div>
    <div class="nfoot"><span class="sub">${o.browse ? 'These are set when a character is created and can only be viewed here.' : 'Click an option to change it. Hover for what it does.'}</span><span class="grow"></span>
      ${o.freq ? '<span class="row" data-key="F"><span class="key">F</span>how often</span>' : ''}${o.help ? '<span class="row" data-key="?"><span class="key">?</span>help</span>' : ''}<span class="row" data-key="\x1b"><span class="key">Esc</span>${o.browse ? 'close' : 'done'}</span></div></div>`;
}
let OPTS = null;
// options whose line carries no short name: find their help by the words on the line
const OPT_TOPIC = [[/arena/i, 'ironman_empty_levels'], [/active pantheons/i, 'single_pantheon'], [/guaranteed pantheon/i, 'guaranteed_pantheon'], [/level size/i, 'always_small_levels']];
function optTopic(label) {
  for (const [re, t] of OPT_TOPIC) if (re.test(label)) return t;
  const k = String(label).toLowerCase(); for (const n in TOPICS) if (helpStrip(TOPICS[n]).trim().toLowerCase().startsWith(k + ' (')) return n;
  return '';
}
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
