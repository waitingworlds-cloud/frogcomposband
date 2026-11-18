// F1: a card of what the mouse and the interface's own keys do. The game's keys are all unchanged; ? opens its help.
'use strict';
const CONTROLS = [
  ['Mouse', [
    ['click a square', 'walk there (dots show the way)'], ['click a creature', 'attack it, or walk to it'], ['click yourself', 'pick up, or take the stairs you stand on'],
    ['click an item', 'walk over and pick it up'], ['right-click anything', 'everything you can do with it'], ['rest the pointer', 'what you know of a creature or item'],
    ['wheel over the map', 'zoom in and out'], ['drag an item onto the map', 'drop it'], ['click the area map', 'travel there'],
    ['shift-click a creature', 'fire your launcher at it'], ['click rubble or a vein', 'dig into it'], ['while aiming', 'click the square to aim at'], ['while looking', 'click a square to look at it'], ['prompts and menus', 'every key shown is a button'],
  ]],
  ['Keys', [
    ['x', 'explore until something turns up (original keys)'], ['F1', 'this card'], ['F6', 'sound: on, effects only, off'], ['F7', 'map lighting'],
    ['F8', 'retro moments'], ['F9', 'screen style (Shift+F9 back)'], ['Ctrl + / Ctrl −', 'interface size'], ['?', "the game's own help"],
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
