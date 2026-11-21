// Character creation choices as picture tiles. The game still lists them with letters; here each choice is a tile
// with a picture, its name and a line about it. The letters stay out of sight until you point at a tile or move to
// it with the arrow keys, and pressing a letter works as it always did.
'use strict';
// who belongs to each kind of people and each kind of calling (from the game's own tables; used for the line under a tile)
const PICK_IN = {
  'human': 'Amberite, Barbarian, Demigod, Dunadan, Human, Igor', 'elf': 'Dark-Elf, High-Elf, Tomte, Wood-Elf', 'hobbit/dwarf': 'Dwarf, Gnome, Hobbit, Nibelung',
  'fairy': 'Shadow-Fairy, Sprite', 'angel/demon': 'Archon, Balrog, Imp', 'orc/troll/giant': 'Cyclops, Half-Giant, Half-Orc, Half-Titan, Half-Troll, Kobold, Ogre, Snotling',
  'shapeshifter': 'Beorning, Doppelganger, Werewolf', 'undead': 'Einheri, Skeleton, Spectre, Vampire, Zombie', 'other': 'Android, Beastman, Boit, Centaur, Draconian, Ent, Golem, Klackon, Kutar, Mindflayer, Tonberry, Yeek',
  'melee': 'Berserker, Blood-Knight, Duelist, Mauler, Rune-Knight, Samurai, Warrior, Weaponmaster, Weaponsmith', 'archery': 'Archer, Sniper', 'martial arts': 'Force-Trainer, Monk, Mystic',
  'magic': 'Blood-Mage, Blue-Mage, Gray-Mage, High-Mage, Mage, Necromancer, Sorcerer, Yellow-Mage', 'devices': 'Alchemist, Devicemaster, Magic-Eater', 'prayer': 'Priest', 'stealth': 'Ninja, Rogue, Scout',
  'hybrid': 'Chaos-Warrior, Disciple, Ninja-Lawyer, Paladin, Ranger, Red-Mage, Warrior-Mage', 'riding': 'Beastmaster, Cavalry', 'mind': 'Mindcrafter, Mirror-Master, Psion, Time-Lord, Warlock',
  'animal': 'Centipede, Hound, Hydra, Spider', 'elemental/vortex': 'Elemental, Vortex', 'jelly': 'Jelly, Quylthulg', 'mimic/possessor': 'Death-Sword, Armor, Mimic, Possessor, Ring',
};
const PICK_IN_CLASS = { 'other': 'Archaeologist, Bard, Lawyer, Politician, Rage-Mage, Skillmaster, Tourist, Wild-Talent' };
const PICK_IN_MON = { 'undead': 'Lich, Mummy, Vampire', 'orc/troll/giant': 'Giant, Orc, Troll', 'angel/demon': 'Angel, Demon', 'other': 'Pumpkin, Xorn', 'mimic/possessor': 'Death-Sword, Filthy Rag, Mimic, Possessor, Ring' };
// a line of our own for the choices that have no page in the game's help
const PICK_SAY = {
  'beginner': 'A gentler start: fewer choices to make and a simpler world. Best for a first run.', 'normal': 'The full game, with every people, calling and option open.', 'monster': 'Play as a creature of the dungeon and grow into its mightier forms.',
  'random': 'Let fate decide.', 'male': '', 'female': '',
};
// game speed has its own words (its Normal is not the game type's Normal)
const PICK_SPEED = { 'normal': 'The full-length game, at the classic pace.', 'coffee-break': 'A shorter game: you grow faster and the way down is quicker.', 'instant coffee': 'Shorter still, for a single sitting.' };
// the picture for a choice: [sheet, name]. Callings use the hero pictures; peoples borrow the creature that looks like them
const _pm = n => ['mon', n], _pp = n => ['player', n], _pb = n => ['obj', n];
const PICK_ART = {
  'beginner': _pm('giant green frog'), 'normal': _pp('paladin'), 'monster': _pm('mature red dragon'),
  'human': _pm('swordsman'), 'elf': _pm('elf lord'), 'hobbit/dwarf': _pm('nar, the dwarf'), 'fairy': _pm('shadow fairy'), 'angel/demon': _pm('archon'), 'orc/troll/giant': _pm('cave troll'), 'shapeshifter': _pp('werewolf'), 'undead': _pm('skeleton human'), 'other': _pm('mind flayer'),
  'amberite': _pm('lord borel of hendrake'), 'barbarian': _pp('berserker'), 'demigod': _pp('demigod'), 'dunadan': _pm('ranger'), 'igor': _pp('igor'),
  'dark-elf': _pm('dark elf'), 'high-elf': _pm('elf lord'), 'tomte': _pm('gnome mage'), 'wood-elf': _pm('high-elven ranger'),
  'dwarf': _pm('nar, the dwarf'), 'gnome': _pm('gnome mage'), 'hobbit': _pm('scruffy looking hobbit'), 'nibelung': _pm('nibelung'),
  'shadow-fairy': _pm('shadow fairy'), 'sprite': _pm("will o' the wisp"), 'archon': _pm('archon'), 'balrog': _pm('lesser balrog'), 'imp': _pm('imp'),
  'cyclops': _pm('cyclops'), 'half-giant': _pm('hill giant'), 'half-orc': _pm('half-orc'), 'half-titan': _pm('lesser titan'), 'half-troll': _pm('half-troll'), 'kobold': _pm('kobold'), 'ogre': _pm('ogre'), 'snotling': _pm('snaga'),
  'beorning': _pp('beorning'), 'doppelganger': _pp('doppelganger'), 'werewolf': _pp('werewolf'),
  'einheri': _pm('einheri berserker'), 'skeleton': _pm('skeleton human'), 'spectre': _pm('spectre'), 'vampire': _pm('vampire'), 'zombie': _pm('zombified human'),
  'android': _pm('iron golem'), 'beastman': _pm('chaos beastman'), 'boit': _pm('giant green frog'), 'draconian': _pm('young bronze dragon'), 'ent': _pm('ent'), 'golem': _pm('stone golem'), 'klackon': _pm('soldier ant'), 'kutar': _pm('kutar'), 'mindflayer': _pm('mind flayer'), 'mind-flayer': _pm('mind flayer'), 'tonberry': _pm('tonberry'), 'yeek': _pm('blue yeek'),
  'melee': _pp('warrior'), 'archery': _pp('archer'), 'martial arts': _pp('monk'), 'magic': _pp('mage'), 'devices': _pp('devicemaster'), 'prayer': _pp('priest'), 'stealth': _pp('rogue'), 'hybrid': _pp('paladin'), 'riding': _pp('cavalry'), 'mind': _pp('mindcrafter'),
  'disciple': _pp('troika'),
  'dragons': _pm('young blue dragon'), 'angels': _pm('angel'), 'demons': _pm('imp'), 'hounds': _pm('fire hound'), 'spiders': _pm('giant spider'), 'giants': _pm('hill giant'),
  'animal': _pm('fire hound'), 'beholder': _pm('beholder'), 'dragon': _pm('young blue dragon'), 'elemental/vortex': _pm('fire elemental'), 'jelly': _pm('yellow jelly'), 'leprechaun': _pm('cheerful leprechaun'), 'mimic/possessor': _pm('chest mimic'),
  'centipede': _pm('giant white centipede'), 'hound': _pm('fire hound'), 'hydra': _pm('5-headed hydra'), 'spider': _pm('giant spider'), 'angel': _pm('angel'), 'demon': _pm('imp'), 'elemental': _pm('fire elemental'), 'vortex': _pm('fire vortex'), 'quylthulg': _pm('quylthulg'),
  'death-sword': _pm('death sword'), 'mimic': _pm('chest mimic'), 'ring': _pm('ring mimic'), 'possessor': _pm('poltergeist'), 'giant': _pm('hill giant'), 'orc': _pm('cave orc'), 'troll': _pm('stone troll'), 'lich': _pm('lich'), 'mummy': _pm('greater mummy'),
  'life': _pb('[book of common prayer]'), 'sorcery': _pb("[beginner's handbook]"), 'nature': _pb('[call of the wild]'), 'chaos': _pb('[sign of chaos]'), 'death': _pb('[black prayers]'), 'trump': _pb('[conjurings tricks]'), 'arcane': _pb('[cantrips for beginners]'),
  'craft': _pb('[handbook for pupils]'), 'daemon': _pb('[dark incantations]'), 'crusade': _pb('[rites of initiation]'), 'necromancy': _pb('[stench of death]'), 'armageddon': _pb('[book of elements]'), 'law': _pb('[attractions of law]'),
  'music': _pb("[minstrel's music]"), 'kendo': _pb('[bugei shofu]'), 'hex': _pb('[handbook of hex]'), 'rage': _pb('[anger management]'), 'burglary': _pb("[burglar's handbook]"),
};
const PICK_ALIAS = { "tanar'ri": 'marilith', 'servant of khorne': 'bloodletter of khorne', 'orc fighter': 'cave orc', 'filthy rag': 'filthy rag', 'pumpkin': 'pumpkin', 'armor': 'animated armor' };
// the headings in plain words: [title, a line under it]
const PICK_HEAD = [
  [/^Choose the Type of Game to Play$/i, 'How do you want to play?', ''],
  [/^Choose a Type of Race to Play$/i, 'Your people', 'Pick a kind first. You choose the exact people next.'],
  [/^Choose Your Race$/i, 'Your people', 'Each people is stronger in some things and weaker in others. Point at one to read about it.'],
  [/^Choose a Type of Monster to Play$/i, 'Your creature', 'Pick a kind first.'],
  [/^Choose Your Monster Race$/i, 'Your creature', 'Point at one to read about it.'],
  [/^Choose a Type of Class to Play$/i, 'Your calling', 'How do you want to fight? Pick a style first.'],
  [/^Choose Your Class$/i, 'Your calling', 'Your calling decides how you fight and what you can learn. Point at one to read about it.'],
  [/^Choose Your Personality$/i, 'Your nature', 'A small twist on your character. Ordinary changes nothing.'],
  [/^Toggle Personalities/i, 'Your natures', 'Pick two or more, then continue.'],
  [/^Choose Your (Primary )?Magic Realm$/i, 'Your magic', 'The school of spells you will study. Point at one to read about it.'],
  [/^Choose Your Secondary Magic Realm$/i, 'Your second magic', 'A second school of spells to study beside the first.'],
  [/^Choose Your Realm$/i, 'Your focus', 'What your dragon turns its power to.'],
  [/^Choose Game Speed$/i, 'Game speed', 'How fast the world moves around you.'],
  [/^Choose Warlock Pact$/i, 'Your pact', 'The power you have bargained with.'],
  [/^Choose Speciali[st]y$/i, 'Your speciality', ''],
  [/^Choose Bias$/i, 'Your leaning', ''],
  [/^Choose Patron$/i, 'Your patron', ''],
];
// which help file holds the pages for the choices under a heading
let PICK_SUB = '', PICK_RAW = '';   // the race whose bloodlines are on offer, and the game's own heading
const PICK_SUBFILE = { dragon: 'Dragons', demon: 'Demons', orc: 'Orcs', draconian: 'Draconians', demigod: 'Demigods' };
function pickFile(h) { return /bloodline|parent/i.test(h) ? PICK_SUBFILE[PICK_SUB.toLowerCase()] || 'MonsterRaces' : /focus/i.test(h) ? 'DragonRealms' : /magic/i.test(h) ? 'magic' : /creature/i.test(h) ? 'MonsterRaces' : /people/i.test(h) ? 'Races' : /calling/i.test(h) ? 'Classes' : /nature/i.test(h) ? 'Personalities' : ''; }
function pickHead(t) {
  PICK_RAW = t; const m = /^Choose (\S+) (Subrace|Parentage)$/i.exec(t);
  if (m) { PICK_SUB = m[1]; return /parent/i.test(m[2]) ? ['Your parent', 'The god you are descended from. Each leaves you a different gift.'] : ['Your bloodline', `Which kind of ${m[1].toLowerCase()} will you be? Point at one to read about it.`]; }
  for (const [re, a, b] of PICK_HEAD) if (re.test(t)) return [a, b]; return null;
}
const pickName = s => String(s || '').replace(/\s*\(.*\)\s*$/, '').trim().toLowerCase();
function pickArtFor(label, kindHint) {
  const k = pickName(label); if (!k || k === 'random') return null;
  if (kindHint === 'class' && k === 'other') return ['player', 'tourist'];
  if (kindHint === 'class' && TS && TS.player && TS.player[k.replace(/ /g, '-')]) return ['player', k.replace(/ /g, '-')];
  if (PICK_ART[k]) return PICK_ART[k];
  if (TS && TS.player && TS.player[k.replace(/ /g, '-')]) return ['player', k.replace(/ /g, '-')];
  if (TS && TS.mon) for (const n of [k, PICK_ALIAS[k], 'young ' + k, 'young ' + k + ' dragon', 'baby ' + k + ' dragon', k.replace(/ dragon$/, ' drake'), 'lesser ' + k]) if (n && TS.mon[n]) return ['mon', n];
  return null;
}
// the first sentence of a choice's help page, as the line under its name
function pickLine(label, heading) {
  const k = pickName(label);
  if (/world moves/.test(heading || '')) return PICK_SPEED[k] || '';
  if (PICK_SAY[k] != null) return PICK_SAY[k];
  if (/kind first|style first/.test(heading || '')) { const g = (/calling|fight/i.test(heading) && PICK_IN_CLASS[k]) || (/creature/i.test(heading) && PICK_IN_MON[k]) || PICK_IN[k] || PICK_IN_CLASS[k]; if (g) return g; }
  const h = typeof topicHtml === 'function' ? topicHtml(label) : ''; if (!h) return '';
  const b = /<div class="tbody">([\s\S]*?)<\/div>/.exec(h); if (!b) return '';
  const txt = b[1].replace(/<[^>]+>/g, '').replace(/\s*\(\s*\)/g, '').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>'); const m = /^.*?[.!?](?=\s|$)/.exec(txt); let s = (m ? m[0] : txt).trim();
  if (s.length < 40 && m) { const m2 = /^.*?[.!?](?=\s|$)/.exec(txt.slice(m[0].length).trim()); if (m2) s += ' ' + m2[0]; }
  return s;
}
const BPICK = { hov: -1, sig: '' };
// one block of choices as tiles. items: [{key,label,html,dim}], head: the plain heading line (for the sub lines)
function pickTiles(items, heading, sub) {
  const kind = /calling/i.test(heading) ? 'class' : '', n = items.length, big = n <= 4, small = n > 15;
  const cols = big ? Math.min(3, n) : small ? 4 : n > 9 ? 3 : n > 4 ? 3 : 2;
  TOPIC_FILE = pickFile(heading);
  const sig = heading + '|' + items.map(i => i.key).join(''); if (BPICK.sig !== sig) { BPICK.sig = sig; BPICK.hov = -1; }
  return `<div class="ptl ${big ? 'big' : small ? 'small' : ''}" style="grid-template-columns:repeat(${cols},minmax(0,1fr))">${items.map((i, ix) => {
    const label = i.html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&[a-z]+;/g, '').trim(), rnd = /^random/i.test(label), art = rnd || /speed|focus/i.test(heading) ? null : pickArtFor(label, kind), now = !i.dim && /<span style/.test(i.html);
    const line = small ? '' : pickLine(label, heading + ' ' + (sub || '')), key = BKEY[i.key] || i.key, kshow = i.key.length > 1 ? i.key[0] + i.key.slice(1).toLowerCase() : i.key;
    return `<div class="pt ${i.dim ? 'dim' : ''} ${rnd ? 'rnd' : ''} ${now ? 'now' : ''} ${ix === BPICK.hov ? 'sel' : ''}" data-pti="${ix}" data-topic="${esc(label)}" data-key="${esc(key)}">
      ${art ? `<canvas class="ptart" data-k="${art[0]}" data-n="${esc(art[1])}"></canvas>` : `<span class="ptart em">${rnd ? '?' : esc(label.charAt(0).toUpperCase())}</span>`}
      <div class="ptx"><b${/\//.test(label) ? ' class="two"' : ''}>${rnd ? 'Surprise me' : esc(label).replace(/\//g, '&nbsp;/ ')}</b>${line ? `<span>${esc(line)}</span>` : ''}</div>${now ? '<em class="ptnow">yours now</em>' : ''}<span class="key kb ptk">${esc(kshow)}</span></div>`; }).join('')}</div>`;
}
// draw the pictures once the tiles are on the page (and again when the art arrives)
function pickAfter() {
  document.querySelectorAll('canvas.ptart').forEach(c => {
    const css = c.clientWidth || 56, d = (devicePixelRatio || 1) * 2 * (typeof SCALE === 'number' ? SCALE : 1); c.width = c.height = Math.round(css * d); const g = c.getContext('2d'); g.scale(d, d); g.imageSmoothingEnabled = false;
    sprite.flat = true; const ok = sprite(g, c.dataset.k, c.dataset.n, 0, 0, css) || (c.dataset.k === 'player' && sprite(g, 'player', 'default', 0, 0, css)); sprite.flat = false; c.classList.toggle('none', !ok);
  });
}
// arrows move between tiles and Enter picks the lit one, so the letters are never needed
function pickKey(e) {
  const tiles = [...document.querySelectorAll('#native .ptl .pt')]; if (!tiles.length || (typeof naming !== 'undefined' && naming) || e.ctrlKey || e.altKey || e.metaKey) return false;
  const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
  if (dir) {
    if (BPICK.hov < 0) { BPICK.hov = 0; schedule(); return true; }
    const cur = tiles[BPICK.hov] || tiles[0], r = cur.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2; let best = -1, bd = 1e9;
    tiles.forEach((t, i) => { if (t === cur) return; const q = t.getBoundingClientRect(), x = q.left + q.width / 2 - cx, y = q.top + q.height / 2 - cy;
      const along = dir[0] ? x * dir[0] : y * dir[1], off = Math.abs(dir[0] ? y : x); if (along < 4) return; const dist = along + off * 3; if (dist < bd) { bd = dist; best = i; } });
    if (best >= 0) { BPICK.hov = best; schedule(); } return true;
  }
  if (e.key === 'Enter' && BPICK.hov >= 0 && tiles[BPICK.hov]) { const k = tiles[BPICK.hov].dataset.key; BPICK.hov = -1; sendText(k); return true; }
  return false;
}
