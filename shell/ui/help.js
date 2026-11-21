// Tooltips from the game's own help files: hover a race, class, personality, realm or game mode
// and its description from lib/help appears. Read once, kept in memory.
'use strict';
const HELP_FILES = ['option', 'Races', 'Classes', 'Personalities', 'MonsterRaces', 'Demigods', 'Draconians', 'Demons', 'Dragons', 'Orcs', 'Warlocks', 'DragonRealms', 'Disciples', 'Weaponmasters', 'Runeknights', 'Skillmasters', 'magic', 'birth'];
const TOPICS = {};
let topicsAsked = false;
function topicsLoad() {
  if (topicsAsked) return; topicsAsked = true;
  for (const f of HELP_FILES) fetch('help/' + f + '.txt').then(r => r.ok ? r.text() : '').then(t => {
    const parts = t.split(/<topic:/); parts.shift();
    for (const p of parts) { const e = p.indexOf('>'); if (e < 0) continue; const name = p.slice(0, e).trim().toLowerCase(); if (!TOPICS[name]) TOPICS[name] = p.slice(e + 1); }
  }).catch(() => {});
}
const helpStrip = s => s.replace(/<\/?(color|style|indent|link|topic)[^>]*>/g, '').replace(/<[^>]{1,40}>/g, '');
const TOPIC_ALIAS = { options: 'birthoptions', 'change name': 'charactername', 'name': 'charactername', 'more info': 'charattributes' };
function topicHtml(label, title) {
  if (/\//.test(label)) {   // a group of races: one line for each
    const rows = label.split('/').map(n => { const h = topicHtml(n.trim()); if (!h) return ''; const b = /<div class="tbody">([\s\S]*?)<\/div>/.exec(h); const first = b ? (b[1].match(/^.*?[.!?](\s|$)/) || [b[1]])[0] : '';
      return `<div class="tgrp"><b>${esc(n.trim())}</b> ${first}</div>`; }).join('');
    return rows ? `<div class="ttl">${esc(label.replace(/\//g, ', '))}</div>${rows}` : '';
  }
  const k = String(label || '').toLowerCase().replace(/\s*\(.*\)\s*$/, '').trim();
  const raw = TOPICS[TOPIC_ALIAS[k]] || TOPICS[k] || TOPICS[k + 'mode'] || TOPICS[k.replace(/ /g, '')] || TOPICS[k.replace(/ /g, '-')];
  if (!raw && k.length >= 19) { const full = Object.keys(TOPICS).find(t => t.startsWith(k)); if (full) return topicHtml(full, title); }
  if (!raw) return '';
  const lines = raw.replace(/\r/g, '').split('\n').slice(1); let out = '', text = 0, table = [], inTab = false, done = false;
  for (const l0 of lines) {
    const l = helpStrip(l0.replace(/\s*See (also )?<link:[^>]*>[^.]*\./g, ''));
    if (/<style:table>/.test(l0)) inTab = true;
    if (inTab) { if (/<\/style>/.test(l0)) break; if (l.trim() && table.length < 14) table.push(l.replace(/\s+$/, '')); continue; }
    if (/^\s*$/.test(l)) { if (text > 260) done = true; continue; }
    if (done) break;
    out += esc(l.trim()) + ' '; text += l.length; if (text > 700) break;
  }
  return `<div class="ttl">${esc(cap(title || label))}</div><div class="tbody">${out.trim()}</div>` + (table.length ? `<pre class="ttab">${esc(table.join('\n'))}</pre>` : '');
}
