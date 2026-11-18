// F1: a card of what the mouse and the interface's own keys do. The game's keys are all unchanged; ? opens its help.
'use strict';
const CONTROLS = [
  ['Mouse', [
    ['click a square', 'walk there (dots show the way)'], ['click a creature', 'attack it, or walk to it'], ['click yourself', 'pick up, or take the stairs you stand on'],
    ['click an item', 'walk over and pick it up'], ['right-click anything', 'everything you can do with it'], ['rest the pointer', 'what you know of a creature or item'],
    ['wheel over the map', 'zoom in and out'], ['drag an item onto the map', 'drop it'], ['click the area map', 'travel there'], ['click your name', 'character sheet'],
    ['shift-click a creature', 'fire your launcher at it'], ['click rubble or a vein', 'dig into it'], ['while aiming', 'click the square to aim at'], ['while looking', 'click a square to look at it'], ['prompts and menus', 'every key shown is a button'],
  ]],
  ['Keys', [
    ['x', 'explore until something turns up (original keys)'], ['F1', 'this card'], ['Esc', 'game menu, when nothing is open'], ['F6', 'sound: on, effects only, off'], ['F7', 'map lighting'],
    ['F8', 'retro moments'], ['F9', 'screen style (Shift+F9 back)'], ['Ctrl + / Ctrl −', 'interface size'], ['F11', 'full screen'], ['?', "the game's own help"],
  ]],
];
function controlsToggle(force) {
  let el = document.getElementById('controls');
  if (el && force !== true) { el.remove(); return; }
  if (el) return;
  el = document.createElement('div'); el.id = 'controls';
  el.innerHTML = `<div class="pane npanel ctlp"><div class="tabs"><div class="on">Controls</div><span class="dir" style="margin-left:auto;align-self:center;font-size:15px">every game key works as before</span></div>
    <div class="ctlg">${CONTROLS.map(([h, rows]) => `<div><div class="catr">${h}</div>${rows.map(([k, v]) => `<div class="ctlr"><span class="${h === 'Keys' ? 'key' : 'ctlk'}">${esc(k)}</span><span>${esc(v)}</span></div>`).join('')}</div>`).join('')}</div>
    <div class="nfoot"><span class="grow"></span><span class="row" data-ctlclose="1"><span class="key">F1</span>close</span></div></div>`;
  el.addEventListener('mousedown', e => { if (e.target === el || e.target.closest('[data-ctlclose]')) { e.stopPropagation(); el.remove(); } });
  document.body.appendChild(el);
}
function controlsKey(e) {
  if (e.key === 'F1') { controlsToggle(); return true; }
  if (e.key === 'Escape' && document.getElementById('controls')) { controlsToggle(); return true; }
  return false;
}

// Esc with nothing open: a small game menu. Every entry is the game's own key, so nothing here is new to learn
const GMENU = [['C', 'Character sheet', 'C'], ['i', 'Pack', 'i'], ['e', 'Equipment', 'e'], ['M', 'Level map', 'M'], ['~', 'Knowledge', '~'], ['Ctrl+P', 'Message history', '\x10'],
  ['=', 'Options', '='], ['?', 'Game help', '?'], ['F1', 'Mouse and new keys', 'F1'], ['Ctrl+S', 'Save', '\x13'], ['Ctrl+X', 'Save and quit', '\x18']];
function gmenuToggle(force) {
  let el = document.getElementById('gmenu');
  if (el && force !== true) { el.remove(); return; }
  if (el || !playing()) return;
  el = document.createElement('div'); el.id = 'gmenu'; el.className = 'ctlbg';
  el.innerHTML = `<div class="pane npanel gmp"><div class="tabs"><div class="on">Menu</div></div>
    <div class="gml">${GMENU.map(([k, n, v], i) => `<div class="mcard gmr" data-gm="${i}"><span class="key">${esc(k)}</span><span>${esc(n)}</span></div>`).join('')}</div>
    <div class="nfoot"><span class="grow"></span><span class="row" data-gmclose="1"><span class="key">Esc</span>back to the game</span></div></div>`;
  el.addEventListener('mousedown', e => {
    e.stopPropagation(); const r = e.target.closest('[data-gm]');
    if (r) { const v = GMENU[+r.dataset.gm][2]; el.remove(); if (v === 'F1') controlsToggle(true); else sendText(cmd(v)); return; }
    if (e.target === el || e.target.closest('[data-gmclose]')) el.remove();
  });
  document.body.appendChild(el);
}
// only when the game is not asking anything and no panel is up, so Esc keeps every job it had
const gmenuFree = () => playing() && !G.icky && !G.ov && !(typeof UI !== 'undefined' && UI && uiOnTop()) && !msgTop().trim() && !lookMode() && !aimMode() && !(typeof EXP !== 'undefined' && EXP.on) && !document.getElementById('controls');
let GM_LASTKEY = 0;
function gmenuKey(e) {
  const el = document.getElementById('gmenu'), gap = performance.now() - GM_LASTKEY; GM_LASTKEY = performance.now();
  if (el) {
    if (e.key === 'Escape') { el.remove(); return true; }
    const hit = GMENU.find(([k]) => k === e.key || (k.startsWith('Ctrl+') && e.ctrlKey && e.key.toLowerCase() === k.slice(5).toLowerCase()));
    el.remove(); if (hit) { if (hit[2] === 'F1') controlsToggle(true); else sendText(cmd(hit[2])); return true; }
    return false;
  }
  if (e.key === 'Escape' && !e.ctrlKey && !e.altKey && !e.repeat && gap > 400 && gmenuFree()) { gmenuToggle(true); return true; }   // a quick run of Escapes is clearing things, not asking for the menu
  return false;
}
