// Sound, made on the spot (no recordings): every game sound event gets a short synthesized voice.
// On the big push-in moments everything slows and drops in pitch with the picture, then eases back.
// F6 steps through: all sound, effects only (no background air), off.
'use strict';
const SND = { ctx: null, mode: 1, index: null, count: 0, vol: .5, rate: 1, live: new Set(), last: {}, bed: null };
try { const m = localStorage.getItem('snd.mode'); if (m !== null) SND.mode = +m; } catch (e) {}
function sndCtx() {
  if (SND.ctx) { if (SND.ctx.state === 'suspended') SND.ctx.resume().catch(() => {}); return SND.ctx; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
  const c = SND.ctx = new AC(); SND.lp = c.createBiquadFilter(); SND.lp.type = 'lowpass'; SND.lp.frequency.value = 18000;
  SND.out = c.createGain(); SND.out.gain.value = SND.vol; const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 5;
  SND.lp.connect(comp); comp.connect(SND.out); SND.out.connect(c.destination);
  const n = c.sampleRate * 2, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0); let s = 22222;
  for (let i = 0; i < n; i++) { s = (s * 16807) % 2147483647; d[i] = s / 1073741823.5 - 1; } SND.noise = b;
  return c;
}
addEventListener('keydown', sndCtx, { capture: true }); addEventListener('pointerdown', sndCtx, { capture: true });
const cents = r => 1200 * Math.log2(r);
function sndTrack(node, dur) { SND.live.add(node); node.onended = () => SND.live.delete(node); if (SND.rate !== 1 && node.detune) node.detune.value = cents(SND.rate); }
// a pitched voice: wave, start and end pitch (Hz), length (s), loudness, delay (s)
function tone(type, f0, f1, dur, gain, at = 0, vib = 0) {
  const c = SND.ctx, t = c.currentTime + at, o = c.createOscillator(), g = c.createGain(); o.type = type;
  o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  if (vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = vib; lg.gain.value = f0 * .04; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur + .05); }
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + .006); g.gain.exponentialRampToValueAtTime(.0008, t + dur);
  o.connect(g); g.connect(SND.lp); o.start(t); o.stop(t + dur + .03); sndTrack(o, dur);
}
// a noise voice through a sweeping filter
function hiss(kind, f0, f1, dur, gain, at = 0, q = 1) {
  const c = SND.ctx, t = c.currentTime + at, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = SND.noise; s.loop = true; s.loopStart = Math.random();
  f.type = kind; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + .005); g.gain.exponentialRampToValueAtTime(.0008, t + dur);
  s.connect(f); f.connect(g); g.connect(SND.lp); s.start(t, Math.random()); s.stop(t + dur + .03); sndTrack(s, dur);
}
const seq = (type, notes, step, len, gain, at = 0) => notes.forEach((f, i) => tone(type, f, f, len, gain, at + i * step));
const V = {
  hit: () => { hiss('bandpass', 1400, 260, .09, .5, 0, 1.2); tone('square', 190, 70, .09, .16); },
  miss: () => hiss('highpass', 900, 3200, .12, .1),
  flee: () => seq('triangle', [660, 520, 400], .05, .07, .1),
  drop: () => { tone('sine', 150, 60, .12, .3); hiss('lowpass', 500, 120, .08, .2); },
  kill: () => { hiss('lowpass', 1800, 90, .28, .5); tone('square', 220, 55, .26, .16); tone('sine', 90, 40, .3, .35); },
  ukill: () => { V.kill(); seq('sawtooth', [196, 147, 98], .12, .5, .1, .08); tone('sine', 49, 49, 1.2, .3, .1); },
  level: () => seq('triangle', [523, 659, 784, 1047, 1319], .085, .32, .16),
  death: () => { seq('sawtooth', [220, 208, 175, 147, 110], .28, .6, .12); tone('sine', 55, 30, 2.2, .4); },
  study: () => { hiss('highpass', 2500, 5000, .12, .06); seq('sine', [880, 1320], .09, .3, .1, .1); },
  teleport: () => { tone('sine', 300, 2400, .32, .14); tone('triangle', 450, 3600, .32, .07, .03); hiss('bandpass', 800, 6000, .3, .12, 0, 4); },
  tpdown: () => { tone('sine', 1800, 120, .5, .14); hiss('bandpass', 5000, 300, .5, .12, 0, 4); },
  shoot: () => { tone('triangle', 520, 180, .07, .2); hiss('highpass', 1500, 4500, .13, .1, .02); },
  quaff: () => [0, .07, .15].forEach((d, i) => tone('sine', 380 + i * 90, 620 + i * 90, .06, .14, d)),
  zap: () => { tone('sawtooth', 1500, 240, .17, .11); tone('square', 2200, 400, .12, .05); },
  walk: () => hiss('lowpass', 420 + Math.random() * 160, 140, .045, .07),
  thunk: () => { tone('sine', 120, 55, .09, .32); hiss('lowpass', 700, 150, .05, .16); },
  eat: () => [0, .11, .22].forEach(d => hiss('bandpass', 1900, 900, .05, .16, d, 2)),
  bell: () => { tone('sine', 1245, 1245, .5, .1); tone('sine', 1868, 1868, .35, .05); },
  coin: () => { tone('square', 1976, 1976, .05, .06); tone('square', 2637, 2637, .22, .06, .05); },
  dig: () => { hiss('bandpass', 700, 260, .16, .32, 0, 1.5); tone('sine', 95, 60, .08, .2); },
  dooro: () => { tone('sawtooth', 95, 150, .16, .07, 0, 22); hiss('lowpass', 900, 300, .1, .12, .1); },
  doorc: () => { tone('sine', 110, 50, .1, .38); hiss('lowpass', 1200, 200, .06, .24); },
  scroll: () => { hiss('highpass', 1800, 4200, .16, .1); hiss('highpass', 3500, 1500, .14, .08, .12); },
  warn: () => seq('square', [740, 587, 740], .11, .09, .08),
  boom: () => { hiss('lowpass', 2600, 60, .6, .7); tone('sine', 80, 28, .6, .5); },
  heal: () => { tone('sine', 523, 784, .28, .1); tone('sine', 784, 1047, .3, .08, .1); },
  xheal: () => { V.heal(); seq('triangle', [1047, 1319, 1568], .08, .35, .08, .2); },
  bite: () => { hiss('bandpass', 2400, 700, .06, .4, 0, 3); tone('square', 150, 80, .07, .14, .01); },
  claw: () => [0, .04, .08].forEach(d => hiss('highpass', 2600, 1200, .05, .2, d)),
  touch: () => { tone('sine', 300, 180, .14, .14); hiss('lowpass', 800, 200, .1, .1); },
  sting: () => { tone('square', 1700, 900, .05, .1); hiss('highpass', 4000, 2000, .05, .14); },
  crush: () => { tone('sine', 95, 35, .2, .5); hiss('lowpass', 900, 100, .18, .35); },
  slime: () => { tone('sine', 240, 110, .13, .16, 0, 30); hiss('lowpass', 1200, 300, .12, .14); },
  cast: () => { tone('sawtooth', 220, 330, .3, .06, 0, 7); tone('sawtooth', 223, 327, .3, .06, 0, 9); hiss('bandpass', 600, 2400, .28, .08, 0, 6); },
  summon: () => { seq('sawtooth', [147, 175, 139], .1, .3, .07); hiss('bandpass', 300, 1500, .4, .1, 0, 8); },
  evil: () => { tone('sawtooth', 110, 104, .7, .1, 0, 5); tone('sawtooth', 156, 147, .7, .07, 0, 6); },
  breath: () => { hiss('bandpass', 400, 1800, .45, .5, 0, .8); hiss('lowpass', 1500, 200, .5, .3, .1); },
  growl: () => tone('sawtooth', 95, 70, .3, .12, 0, 28),
  wail: () => { tone('sine', 700, 380, .5, .1, 0, 9); tone('sine', 1050, 570, .5, .04, 0, 9); },
  fire: () => { hiss('bandpass', 900, 2600, .3, .22, 0, .7); [0, .06, .14, .2].forEach(d => hiss('highpass', 5000, 3000, .02, .16, d)); },
  acid: () => hiss('highpass', 5200, 2400, .4, .16),
  elec: () => [0, .03, .07, .1, .15].forEach(d => tone('square', 1800 + Math.random() * 1400, 300, .025, .08, d)),
  cold: () => { [0, .03, .07].forEach(d => tone('triangle', 2600 + Math.random() * 1500, 2000, .08, .07, d)); hiss('highpass', 6000, 3000, .18, .1); },
  buzz: () => tone('square', 110, 100, .11, .09),
  fail: () => { tone('triangle', 330, 196, .16, .12); hiss('lowpass', 900, 200, .12, .08); },
  wake: () => seq('triangle', [392, 587], .06, .08, .08),
  shimmer: () => seq('sine', [1047, 1319, 1568, 2093, 1568, 2093], .05, .22, .06),
  fanfare: () => { seq('square', [392, 523, 659, 784], .11, .22, .07); seq('triangle', [196, 262, 330, 392], .11, .3, .1); tone('triangle', 1047, 1047, .7, .1, .46); },
  crit: () => { tone('square', 1568, 2637, .09, .08); hiss('highpass', 3000, 7000, .1, .12); },
  heart: () => { tone('sine', 62, 40, .11, .5); tone('sine', 58, 38, .12, .36, .17); },
  click: () => tone('square', 1200, 900, .02, .03),
};
const SND_MAP = [null, 'hit', 'miss', 'flee', 'drop', 'kill', 'level', 'death', 'study', 'teleport', 'shoot', 'quaff', 'zap', 'walk', 'teleport', 'thunk', 'eat', 'bell', 'bell', 'coin', 'bell',
  'dig', 'dooro', 'doorc', 'tpdown', 'scroll', 'coin', 'coin', 'warn', 'boom', 'kill', 'ukill', 'fanfare', 'heal', 'xheal', 'bite', 'claw', 'cast', 'summon', 'breath', 'boom', 'heal', 'cast', 'evil',
  'touch', 'sting', 'crush', 'slime', 'wail', 'fanfare', 'fire', 'acid', 'elec', 'cold', 'buzz', 'fail', 'wake', 'shimmer', 'tpdown', 'growl', 'thunk', 'growl', 'growl', null, 'boom', 'cold'];
// recorded clips from the sound pool, when the build has them: sounds/index.json = { "<voice>": [{ "f": "file.ogg", "g": 1 }, ...] }
// a voice with clips plays one of them (never the same twice running); the rest stay synthesized
const CLIPS = {};
function sndLoad() {
  fetch('sounds/index.json').then(r => r.ok ? r.json() : null).then(j => { if (!j) return; SND.index = j; }).catch(() => {});
}
function sndClip(name) {
  const list = SND.index && SND.index[name]; if (!list || !list.length) return false;
  let i = Math.floor(Math.random() * list.length); if (list.length > 1 && i === CLIPS['last:' + name]) i = (i + 1) % list.length; CLIPS['last:' + name] = i;
  const e = list[i], key = e.f, buf = CLIPS[key];
  if (buf === undefined) { CLIPS[key] = null; fetch('sounds/' + key).then(r => r.arrayBuffer()).then(a => SND.ctx.decodeAudioData(a)).then(b => { CLIPS[key] = b; }).catch(() => { CLIPS[key] = false; }); return false; }
  if (!buf) return buf === null ? false : false;
  const c = SND.ctx, s = c.createBufferSource(), g = c.createGain(); s.buffer = buf; g.gain.value = e.g == null ? .8 : e.g; s.playbackRate.value = .96 + Math.random() * .08;
  s.connect(g); g.connect(SND.lp); s.start(); sndTrack(s, buf.duration); return true;
}
sndLoad();
function sndPlay(name) {
  if (!SND.mode || !V[name] || !sndCtx() || SND.ctx.state !== 'running') return;
  const t = performance.now(); if (t - (SND.last[name] || 0) < 45 || SND.live.size > 40) return; SND.last[name] = t;
  try { if (!sndClip(name)) V[name](); } catch (e) {}
}
function sndEvent(v) { SND.count++; const n = SND_MAP[v]; if (n) sndPlay(n); }
// slow motion: playing voices bend down, new ones start lower, and the top end closes in
function sndRate(r) {
  if (!SND.ctx || Math.abs(r - SND.rate) < .01) return; SND.rate = r; const t = SND.ctx.currentTime;
  for (const n of SND.live) if (n.detune) n.detune.setTargetAtTime(cents(r), t, .03);
  SND.lp.frequency.setTargetAtTime(r < 1 ? 600 + 17400 * Math.pow((r - .45) / .55, 2) : 18000, t, .04);
}
// the air of the place: a low bed under everything, a drip now and then underground
function sndBed() {
  const want = SND.mode === 1 && S && S.p && SND.ctx && SND.ctx.state === 'running' ? (S.p.dlvl > 0 ? 'deep' : 'town') : '';
  if (want === (SND.bed && SND.bed.kind || '')) return;
  if (SND.bed) { const b = SND.bed; b.g.gain.setTargetAtTime(0, SND.ctx.currentTime, .6); setTimeout(() => { try { b.s.stop(); } catch (e) {} SND.live.delete(b.s); }, 2500); clearInterval(b.iv); SND.bed = null; }
  if (!want) return;
  const c = SND.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = SND.noise; s.loop = true;
  f.type = want === 'deep' ? 'lowpass' : 'bandpass'; f.frequency.value = want === 'deep' ? 150 : 420; f.Q.value = .4; g.gain.value = 0; g.gain.setTargetAtTime(want === 'deep' ? .16 : .035, c.currentTime, 1.5);
  s.connect(f); f.connect(g); g.connect(SND.lp); s.start(); SND.live.add(s); if (SND.rate !== 1) s.detune.value = cents(SND.rate);
  const iv = setInterval(() => { if (document.hidden || !SND.mode) return; if (want === 'deep' && Math.random() < .3) { const p = 1500 + Math.random() * 1400; tone('sine', p, p * .55, .07, .035); tone('sine', p * 1.5, p * .8, .05, .02, .09); } }, 2600);
  SND.bed = { kind: want, s, g, iv };
}
setInterval(() => { sndBed(); if (SND.mode && document.body.classList.contains('lowhp') && S && S.p && S.p.hp > 0 && !document.hidden) sndPlay('heart'); }, 1150);
function sndKey(e) {
  if (e.key !== 'F6') return false; SND.mode = (SND.mode + 2) % 3;   // all -> off -> effects only -> all
  try { localStorage.setItem('snd.mode', SND.mode); } catch (x) {} sndBed(); postToast('Sound: ' + ['off', 'on', 'effects only'][SND.mode]); if (SND.mode) sndPlay('bell'); return true;
}
