// Screen pass over the map only (never the panels or text): bloom, scanlines, phosphor mask,
// lens split, and the short "retro moments" that land on a combat beat (halftone on a heal,
// dither crush and zoom on a critical hit, tape tear when badly hurt, duotone on a great kill,
// lens flare on a level-up). Stationary by design: no flicker, roll or animated noise.
// The styles and their numbers match the ones used in NewRL.
'use strict';
const POST = { gl: null, ok: false, style: 4, moments: true, list: [], climax: null, toast: 0 };
const POST_STYLES = [
  { name: 'Off', v: [0, 1.5, 0, 0, 0] },
  { name: 'Soft bloom', v: [.55, 1.5, 0, 0, 0] },
  { name: 'Soft CRT', v: [.55, 1.5, .10, .035, .06] },
  { name: 'Strong CRT', v: [1, 2, .25, .10, .14] },
  { name: 'PVM aperture grille', v: [.5, 1.5, .5, .18, .04], s: { scan: 1, beam: .7, mask: 1, comp: .8 } },
  { name: 'Slot mask TV', v: [.7, 2, .3, .14, .12], s: { scan: 1, beam: .4, mask: 2, glow: .15, comp: .75 } },
  { name: 'Shadow mask', v: [.6, 1.8, .28, .22, .1], s: { scan: 1, beam: .3, mask: 3, glow: .1, comp: .75 } },
  { name: 'Composite video', v: [.55, 2, .2, 0, .1], s: { scan: 1, beam: .2, mask: 0, bleed: .7, glow: .2, comp: .5 } },
  { name: 'Arcade curved', v: [.75, 2, .42, .15, .22], s: { scan: 1, beam: .6, mask: 1, glow: .12, curve: .1, comp: .75 } },
  { name: 'Clean scanlines', v: [.4, 1.5, .38, 0, 0], s: { scan: 1, beam: 0, mask: 0, comp: .6 } },
];
try { const s = localStorage.getItem('post.style'); if (s !== null && POST_STYLES[+s]) POST.style = +s; if (localStorage.getItem('post.moments') === '0') POST.moments = false; } catch (e) {}

/* ---------- retro moments ---------- */
const M_KIND = { halftone: 1, cmyk: 2, dither: 3, vhs: 4, duotone: 5, zoom: 6, flare: 7 };
const M_DUR = { halftone: 500, cmyk: 420, dither: 320, vhs: 260, duotone: 360, zoom: 240, flare: 550 };
const M_TINT = { heal: [.561, .831, .416], buff: [.875, .729, .478], crit: [1, .831, .478], hurt: [.871, .51, .459], kill: [.847, .796, .69], level: [.875, .729, .478] };
const M_LOOKS = { heal: ['halftone'], buff: ['cmyk'], crit: ['dither', 'zoom'], hurt: ['vhs'], kill: ['duotone', 'vhs'], level: ['flare', 'cmyk'], climax: ['duotone'] };
const CLIMAX_MS = 1100, CLIMAX_IN = 120, CLIMAX_HOLD = 380, CLIMAX_ZOOM = .3;
// beat: heal | buff | crit | hurt | kill | level. x, y: the level square it happens on. at: when it lands
function postBeat(beat, x, y, at, power) {
  if (!POST.moments || !POST.ok || !M_LOOKS[beat]) return;
  for (const look of M_LOOKS[beat]) POST.list.push({ look, beat, x, y, t: at, ms: M_DUR[look], k: power || 1 });
  while (POST.list.length > 12) POST.list.shift();
}
// the big finish: the view pushes in on the square and the colour drains, then eases back. Never holds up a key press
function postClimax(x, y, at) {
  if (!POST.moments || !POST.ok) return;
  POST.climax = { x, y, t: at };
  POST.list.push({ look: 'duotone', beat: 'kill', x, y, t: at, ms: CLIMAX_MS * .7, k: 1 });
}
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function postClimaxDepth(t) { const c = POST.climax; if (!c) return 0; const a = t - c.t; if (a < 0) return 0; if (a >= CLIMAX_MS) { POST.climax = null; return 0; }
  return a < CLIMAX_IN ? sstep(0, CLIMAX_IN, a) : a < CLIMAX_IN + CLIMAX_HOLD ? 1 : 1 - sstep(CLIMAX_IN + CLIMAX_HOLD, CLIMAX_MS, a); }
function postEnvelope(age, ms) { if (age < 0) return 0; const rise = Math.min(1, age / 35), fall = 1 - Math.max(0, Math.min(1, (age - 35) / Math.max(1, ms - 35))); return rise * fall * fall; }
function postActive() { const t = now(); POST.list = POST.list.filter(m => t - m.t < m.ms); return POST.list.length > 0 || !!POST.climax || t < POST.toast; }
// the running looks as shader inputs: the strongest of each look, at most four, in starting order
function postRunning(t) {
  let run = [];
  for (const m of POST.list) { const s = Math.min(1.5, postEnvelope(t - m.t, m.ms) * m.k); if (s <= 0) continue;
    const same = run.find(r => r.look === m.look); if (same) { if (same.s >= s) continue; run = run.filter(r => r !== same); }
    run.push({ look: m.look, s, x: m.x, y: m.y, age: (t - m.t) / 1000, tint: M_TINT[m.beat] || [1, 1, 1] }); }
  if (run.length > 4) { const keep = run.slice().sort((a, b) => b.s - a.s).slice(0, 4); run = run.filter(r => keep.includes(r)); }
  return run;
}

/* ---------- the pass ---------- */
const POST_VS = `#version 300 es
in vec2 p; out vec2 UV; void main(){ UV = vec2(p.x*.5+.5, .5-p.y*.5); gl_Position = vec4(p,0.,1.); }`;
const POST_FS = `#version 300 es
precision highp float;
in vec2 UV; out vec4 COLOR;
uniform sampler2D tex;
uniform vec2 view_size;            // pixels
uniform float bloom_strength, bloom_radius, scan_strength, mask_strength, vignette_strength;
uniform int scan_mode, mask_type;
uniform float beam, bleed, glow, curvature, compensate, aberration, art_px, low_health;
uniform vec3 strike;               // xy pixels, z strength
uniform int moment_count;
uniform int moment_kinds[4]; uniform float moment_strengths[4]; uniform vec2 moment_centers[4]; uniform float moment_ages[4]; uniform vec3 moment_tints[4];
uniform float climax_zoom; uniform vec2 climax_center;
const vec3 moment_ink = vec3(0.05,0.07,0.09);
#define PX (1.0/view_size)
vec3 tx(vec2 uv){ return texture(tex, clamp(uv, PX*.5, 1.0-PX*.5)).rgb; }
vec3 bright_sample(vec2 at){ vec3 c = tx(at); float peak = max(c.r,max(c.g,c.b)); return c*smoothstep(0.40,0.82,peak); }
float luma_of(vec3 c){ return dot(c,vec3(0.299,0.587,0.114)); }
float hash12(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float halftone_dot(vec2 px, float cell, float angle, float value){
  mat2 r = mat2(vec2(cos(angle),-sin(angle)),vec2(sin(angle),cos(angle)));
  vec2 local = fract(r*px/cell)-0.5; float radius = sqrt(clamp(value,0.0,1.0))*0.62;
  return 1.0-smoothstep(radius-0.08,radius+0.08,length(local)); }
vec3 lens_flare(vec2 at, vec2 source, vec2 size, vec3 tint){
  vec2 d = (at-source)/size.y; float streak = exp(-abs(d.y)*90.0)*exp(-abs(d.x)*2.2); float core = exp(-dot(d,d)*220.0);
  vec3 flare = tint*streak*0.7+vec3(1.0,0.95,0.85)*core*0.35; vec2 axis = size*0.5-source;
  for (int i=1;i<=3;i++){ vec2 ghost = source+axis*(0.6*float(i)); vec2 q=(at-ghost)/size.y; float g = exp(-dot(q,q)*(260.0/float(i))); flare += mix(tint,vec3(0.6,0.75,1.0),float(i)/3.0)*g*0.35; }
  return flare; }
const float BAYER4[16] = float[16](0.0,8.0,2.0,10.0,12.0,4.0,14.0,6.0,3.0,11.0,1.0,9.0,15.0,7.0,13.0,5.0);
vec3 retro_moment(vec3 c, vec2 suv, vec2 px, float art, int kind, float s, vec2 center, float age, vec3 tint){
  if (kind == 0 || s <= 0.0) return c;
  float dist = length(px-center); float reach = max(view_size.x,view_size.y);
  if (kind == 1) { float ring = smoothstep(reach*(0.15+age*1.6),0.0,dist); float dots = halftone_dot(px,max(4.0,art*3.0),0.785,luma_of(c)*1.2+0.08);
    vec3 dotted = mix(moment_ink,tint*(0.55+0.6*luma_of(c)),dots); return mix(c,dotted,s*ring*0.85); }
  if (kind == 2) { vec2 away = normalize(px-center+vec2(0.001))*s*art*1.5;
    vec3 cs = tx(suv+away*PX); vec3 ms = tx(suv-away*PX); float k = 1.0-max(c.r,max(c.g,c.b));
    vec3 cmy = (vec3(1.0)-vec3(cs.r,ms.g,c.b)-k)/max(1.0-k,0.001); float cell = max(4.0,art*2.5);
    vec3 ink = vec3(halftone_dot(px,cell,0.262,cmy.x),halftone_dot(px,cell,1.309,cmy.y),halftone_dot(px,cell,0.0,cmy.z));
    float key = halftone_dot(px,cell,0.785,k); vec3 printed = (vec3(1.0)-ink)*(1.0-key*0.85);
    return mix(c,printed,s*0.8)+lens_flare(px,center,view_size,tint)*s; }
  if (kind == 3) { int bx = int(mod(floor(px.x/max(1.0,art)),4.0)); int by = int(mod(floor(px.y/max(1.0,art)),4.0));
    float threshold = (BAYER4[by*4+bx]+0.5)/16.0-0.5; float levels = 2.0; vec3 lifted = pow(c,vec3(0.7));
    vec3 crushed = floor(lifted*levels+threshold+0.5)/levels; float ring = 1.0-smoothstep(0.0,art*6.0,abs(dist-reach*age*1.4));
    crushed = mix(crushed,vec3(1.0)-crushed,ring*0.8); return mix(c,crushed,s); }
  if (kind == 4) { float band = floor(px.y/max(2.0,art*3.0)); float jitter = (hash12(vec2(band,floor(age*30.0)))-0.5)*2.0;
    float tear = step(0.55,hash12(vec2(band*0.37,floor(age*24.0))))*jitter*art*6.0*s; vec2 shifted = suv+vec2(tear,0.0)*PX;
    vec3 torn = tx(shifted); torn.r = tx(shifted+vec2(art*2.0*s,0.0)*PX).r; float grain = (hash12(px+age*91.0)-0.5)*0.18*s; return mix(c,torn+grain,s); }
  if (kind == 5) { float l = smoothstep(0.08,0.75,luma_of(c)); return mix(c,mix(moment_ink,tint,l),s*0.9); }
  if (kind == 6) { vec3 sum = c; vec2 step_uv = (center-px)/view_size*0.035*s; for (int i=1;i<=7;i++) sum += tx(suv+step_uv*float(i)); return mix(c,sum/8.0,s); }
  if (kind == 7) return c+lens_flare(px,center,view_size,tint)*s;
  return c; }
vec3 to_yiq(vec3 c){ return vec3(dot(c,vec3(0.299,0.587,0.114)),dot(c,vec3(0.596,-0.274,-0.322)),dot(c,vec3(0.211,-0.523,0.312))); }
vec3 from_yiq(vec3 c){ return vec3(dot(c,vec3(1.0,0.956,0.621)),dot(c,vec3(1.0,-0.272,-0.647)),dot(c,vec3(1.0,-1.106,1.703))); }
vec3 phosphor_mask(vec2 px){ vec3 mask = vec3(1.0-mask_strength); float column;
  if (mask_type == 3) column = mod(floor(px.x+1.5*mod(floor(px.y/2.0),2.0)),3.0); else column = mod(floor(px.x),3.0);
  if (column < 1.0) mask.r = 1.0; else if (column < 2.0) mask.g = 1.0; else mask.b = 1.0;
  if (mask_type == 2) { float offset = mod(floor(px.x/3.0),2.0)*2.0; if (mod(floor(px.y)+offset,4.0) < 1.0) mask *= 1.0-mask_strength; }
  return mask; }
float beam_erf(float x){ float v = abs(x); float t = 1.0/(1.0+0.3275911*v);
  float poly = (((((1.061405429*t-1.453152027)*t)+1.421413741)*t-0.284496736)*t+0.254829592)*t; return sign(x)*(1.0-poly*exp(-v*v)); }
float scanline_average(float phase, float footprint, float centre, float width){
  float scale = 1.41421356237/width; float base = beam_erf(-centre*scale); float full = beam_erf((1.0-centre)*scale)-base;
  float lo = phase-footprint*0.5; float hi = phase+footprint*0.5; float integral = (floor(hi)-floor(lo))*full;
  integral += beam_erf((fract(hi)-centre)*scale)-beam_erf((fract(lo)-centre)*scale);
  return 1.0-clamp(integral*width*0.62665706866/footprint,0.0,1.0); }
void main(){
  vec2 uv = UV; float frame_edge = 1.0;
  if (curvature > 0.0) { vec2 c = UV*2.0-1.0; c *= 1.0+curvature*dot(c,c)*0.5; c *= 1.0-curvature*0.25; uv = c*0.5+0.5;
    vec2 corner = max(abs(c)-vec2(1.0-0.06),vec2(0.0)); frame_edge = 1.0-smoothstep(0.045,0.06,length(corner));
    if (any(lessThan(uv,vec2(0.0))) || any(greaterThan(uv,vec2(1.0)))) frame_edge = 0.0; }
  if (climax_zoom > 0.0) { vec2 focus = clamp(climax_center/view_size,vec2(0.0),vec2(1.0)); uv = focus+(uv-focus)/(1.0+climax_zoom); }
  vec2 px = uv*view_size;
  vec3 result = tx(uv);
  if (bleed > 0.0) { vec2 step_uv = vec2(art_px/view_size.x,0.0); vec3 here = to_yiq(result); vec3 wide = vec3(0.0);
    for (int i=-3;i<=3;i++) wide += to_yiq(tx(uv+step_uv*float(i)*0.75)); wide /= 7.0;
    result = from_yiq(vec3(mix(here.x,wide.x,bleed*0.25),mix(here.yz,wide.yz,bleed))); }
  if (aberration > 0.0 || strike.z > 0.0) { vec2 shift = (uv*2.0-1.0)*aberration;
    if (strike.z > 0.0) { vec2 away = px-strike.xy; float reach = max(view_size.x,view_size.y)*0.6; shift += away/max(length(away),1.0)*strike.z*6.0*(1.0-smoothstep(0.0,reach,length(away))*0.6); }
    vec2 offset = shift*PX; result.r = tx(uv+offset).r; result.b = tx(uv-offset).b; }
  for (int m=0;m<4;m++) { if (m >= moment_count) break;
    result = retro_moment(result,uv,px,art_px,moment_kinds[m],moment_strengths[m],moment_centers[m],moment_ages[m],moment_tints[m]); }
  if (bloom_strength > 0.0) { vec2 p = PX*bloom_radius*max(1.0,art_px*.5);
    vec3 halo = bright_sample(uv+vec2(p.x,0.0)); halo += bright_sample(uv-vec2(p.x,0.0)); halo += bright_sample(uv+vec2(0.0,p.y)); halo += bright_sample(uv-vec2(0.0,p.y));
    halo += bright_sample(uv+p); halo += bright_sample(uv-p); halo += bright_sample(uv+vec2(p.x,-p.y)); halo += bright_sample(uv+vec2(-p.x,p.y));
    halo += 0.5*bright_sample(uv+vec2(2.0*p.x,0.0)); halo += 0.5*bright_sample(uv-vec2(2.0*p.x,0.0)); halo += 0.5*bright_sample(uv+vec2(0.0,2.0*p.y)); halo += 0.5*bright_sample(uv-vec2(0.0,2.0*p.y));
    vec3 wide = bright_sample(uv+vec2(p.x*4.0,0.0)); wide += bright_sample(uv-vec2(p.x*4.0,0.0)); wide += bright_sample(uv+vec2(0.0,p.y*4.0)); wide += bright_sample(uv-vec2(0.0,p.y*4.0));
    result += (halo/10.0+wide*0.035)*bloom_strength*(vec3(1.0)-result); }
  if (glow > 0.0) { vec2 g = PX*max(3.0,art_px*4.0); vec3 soft = vec3(0.0);
    for (int i=0;i<8;i++) { float a = float(i)*0.7853982; soft += tx(uv+vec2(cos(a),sin(a))*g); } result += soft/8.0*glow*0.6*(vec3(1.0)-result); }
  float line;
  if (scan_mode == 1) { float row_position = px.y/art_px; float row = fract(row_position); float pixels = max(art_px,1.0);
    float centre = (floor(pixels*0.5)+0.5)/pixels; float width = mix(0.3,0.3+0.32*beam,clamp(luma_of(result),0.0,1.0));
    line = scanline_average(row,max(fwidth(row_position),0.0001),centre,width);
  } else line = 0.5+0.5*cos(gl_FragCoord.y*2.0943951);
  result *= 1.0-scan_strength*line;
  if (mask_type > 0) result *= phosphor_mask(gl_FragCoord.xy);
  float lost = (1.0-scan_strength*(scan_mode == 1 ? 0.45 : 0.5))*(1.0-mask_strength*(mask_type > 0 ? 0.667 : 0.0));
  result *= mix(1.0,1.0/max(lost,0.3),compensate);
  vec2 edge = uv*2.0-1.0; result *= 1.0-vignette_strength*smoothstep(0.3,1.5,dot(edge,edge));
  if (climax_zoom > 0.0) { vec2 rim = UV*2.0-1.0; result *= 1.0-min(0.75,climax_zoom*2.6)*smoothstep(0.15,1.3,dot(rim,rim)); result = mix(result,vec3(luma_of(result)),min(0.45,climax_zoom*1.1)); }
  if (low_health > 0.0) { result = mix(result,vec3(dot(result,vec3(0.2126,0.7152,0.0722))),0.35*low_health);
    vec2 centered = (UV-0.5)*vec2(view_size.x/max(view_size.y,1.0),1.0); result = mix(result,vec3(0.55,0.04,0.03),smoothstep(0.5,1.05,length(centered))*low_health*0.3); }
  COLOR = vec4(clamp(result*frame_edge,vec3(0.0),vec3(1.0)),1.0);
}`;
function postInit(src) {
  if (POST.cv && POST.cv.isConnected) return POST.ok;
  const cv = document.createElement('canvas'); cv.id = 'mapfx'; cv.style.cssText = 'position:absolute;inset:0;pointer-events:none';
  src.parentNode.insertBefore(cv, src.nextSibling); POST.cv = cv; POST.ok = false;
  const gl = cv.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: true }); if (!gl) { cv.remove(); return false; }
  const sh = (type, text) => { const s = gl.createShader(type); gl.shaderSource(s, text); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  try {
    const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, POST_VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, POST_FS)); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
    gl.useProgram(pr); const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    POST.gl = gl; POST.pr = pr; POST.u = {}; POST.ok = true;
    cv.addEventListener('webglcontextlost', () => { POST.ok = false; cv.remove(); POST.cv = null; src.style.opacity = ''; });
  } catch (e) { console.warn('screen pass unavailable: ' + e.message); cv.remove(); POST.cv = null; POST.dead = true; return false; }
  return true;
}
// src: the finished map canvas. toPx(x, y): level square to canvas pixel (its centre). art: screen pixels per art pixel
function postRender(src, toPx, art, lowHealth) {
  const st = POST_STYLES[POST.style], quiet = POST.style === 0 && !postActive() && !lowHealth;
  if (POST.dead || quiet || !postInit(src)) { if (POST.cv) POST.cv.style.display = 'none'; src.style.opacity = ''; return; }
  const gl = POST.gl, cv = POST.cv, t = now(); cv.style.display = ''; src.style.opacity = '0';
  if (cv.width !== src.width || cv.height !== src.height) { cv.width = src.width; cv.height = src.height; }
  gl.viewport(0, 0, cv.width, cv.height);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
  const U = n => POST.u[n] || (POST.u[n] = gl.getUniformLocation(POST.pr, n)), s = st.s || {};
  gl.uniform2f(U('view_size'), cv.width, cv.height);
  ['bloom_strength', 'bloom_radius', 'scan_strength', 'mask_strength', 'vignette_strength'].forEach((n, i) => gl.uniform1f(U(n), st.v[i]));
  gl.uniform1i(U('scan_mode'), s.scan || 0); gl.uniform1i(U('mask_type'), s.mask == null ? 1 : s.mask);
  gl.uniform1f(U('beam'), s.beam || 0); gl.uniform1f(U('bleed'), s.bleed || 0); gl.uniform1f(U('glow'), s.glow || 0); gl.uniform1f(U('curvature'), s.curve || 0); gl.uniform1f(U('compensate'), s.comp || 0);
  gl.uniform1f(U('aberration'), POST.style ? 1.2 * art / 2 : 0); gl.uniform1f(U('art_px'), art); gl.uniform1f(U('low_health'), lowHealth || 0);
  // strike split from the freshest hit
  let strike = [0, 0, 0];
  if (POST.moments && POST.hit) { const e = t - POST.hit.t; if (e >= 0 && e < 300) { const [x, y] = toPx(POST.hit.x, POST.hit.y); strike = [x, y, POST.hit.w * Math.pow(1 - e / 300, 2)]; } else if (e >= 300) POST.hit = null; }
  gl.uniform3f(U('strike'), strike[0], strike[1], strike[2]);
  const run = postRunning(t), kinds = [0, 0, 0, 0], str = [0, 0, 0, 0], cen = new Float32Array(8), ages = [0, 0, 0, 0], tints = new Float32Array(12);
  run.forEach((m, i) => { kinds[i] = M_KIND[m.look]; str[i] = m.s; const [x, y] = toPx(m.x, m.y); cen[i * 2] = x; cen[i * 2 + 1] = y; ages[i] = m.age; tints.set(m.tint, i * 3); });
  gl.uniform1i(U('moment_count'), run.length); gl.uniform1iv(U('moment_kinds'), kinds); gl.uniform1fv(U('moment_strengths'), str); gl.uniform2fv(U('moment_centers'), cen); gl.uniform1fv(U('moment_ages'), ages); gl.uniform3fv(U('moment_tints'), tints);
  const depth = postClimaxDepth(t); gl.uniform1f(U('climax_zoom'), CLIMAX_ZOOM * depth);
  if (POST.climax) { const [x, y] = toPx(POST.climax.x, POST.climax.y); gl.uniform2f(U('climax_center'), x, y); }
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}
// F9 steps through the screen styles, F8 turns the retro moments on or off; both are remembered
function postKey(e) {
  if (e.key === 'F9') { POST.style = (POST.style + (e.shiftKey ? POST_STYLES.length - 1 : 1)) % POST_STYLES.length; try { localStorage.setItem('post.style', POST.style); } catch (x) {} postToast('Screen style: ' + POST_STYLES[POST.style].name); return true; }
  if (e.key === 'F8') { POST.moments = !POST.moments; try { localStorage.setItem('post.moments', POST.moments ? '1' : '0'); } catch (x) {} postToast('Retro moments: ' + (POST.moments ? 'on' : 'off')); return true; }
  if (e.key === 'F7') { LIGHT.on = !LIGHT.on; try { localStorage.setItem('light', LIGHT.on ? '1' : '0'); } catch (x) {} postToast('Map lighting: ' + (LIGHT.on ? 'on' : 'off')); return true; }
  return false;
}
function postToast(text) {
  let el = document.getElementById('toast'); if (!el) { el = document.createElement('div'); el.id = 'toast'; document.getElementById('stage').appendChild(el); }
  el.textContent = text; el.classList.add('on'); clearTimeout(postToast.h); postToast.h = setTimeout(() => el.classList.remove('on'), 1600);
  if (S && S.map) drawMap();
}
