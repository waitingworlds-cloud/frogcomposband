// Placeholder figures until the tileset lands.
// Placeholder flat map renderer for interface mockups. NOT final art: the tileset thread owns the real look.
// Draws MAPSRC centred on the player into a canvas, 32 css px per tile (64 px at 4K).
const MOBS = {
  '@': { kind: 'hero', c: ['#d9cdb4', '#3d5a47', '#c9a24a'] },
  'p': { kind: 'human', c: ['#7a4a2c', '#c9b28a', '#d44a3a'] },
  'o': { kind: 'human', c: ['#5d7a3a', '#3a3328', '#d8d2c0'] },
  'C': { kind: 'beast', c: ['#8a6a48', '#3a2c20', '#e8e0d0'] },
  'S': { kind: 'spider', c: ['#4a3a5a', '#22202a', '#d44a3a'] },
  'I': { kind: 'bug', c: ['#d8d8cc', '#8a8a80', '#d44a3a'] },
  'R': { kind: 'beast', c: ['#7d8a5a', '#3a4028', '#e8c84a'] },
};
function drawMob(g, m, sx, sy, T) {
  const [a, b, c] = m.c, u = T / 32; g.save(); g.translate(sx, sy); g.scale(u, u);
  g.lineJoin = 'round'; g.lineWidth = 2.6; g.strokeStyle = '#0b0a09';
  const shape = (fill, fn) => { g.beginPath(); fn(); g.closePath(); g.stroke(); g.fillStyle = fill; g.fill(); };
  g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(16, 28, 10, 3, 0, 0, 7); g.fill();
  if (m.kind === 'hero') {
    shape(b, () => { g.moveTo(16, 6); g.lineTo(25, 28); g.lineTo(7, 28); });
    shape(a, () => g.arc(16, 9, 5, 0, 7));
    shape(b, () => { g.moveTo(10, 9); g.quadraticCurveTo(16, -1, 22, 9); g.lineTo(16, 6); });
    g.strokeStyle = '#0b0a09'; g.lineWidth = 4; g.beginPath(); g.moveTo(24, 12); g.lineTo(28, 22); g.stroke();
    g.strokeStyle = c; g.lineWidth = 2; g.beginPath(); g.moveTo(24, 12); g.lineTo(28, 22); g.stroke();
  } else if (m.kind === 'human') {
    shape(a, () => { g.moveTo(9, 13); g.lineTo(23, 13); g.lineTo(25, 28); g.lineTo(7, 28); });
    shape(b, () => g.arc(16, 8, 5.5, 0, 7));
    g.strokeStyle = '#0b0a09'; g.lineWidth = 4.5; g.beginPath(); g.moveTo(5, 24); g.lineTo(9, 4); g.stroke();
    g.strokeStyle = c; g.lineWidth = 2.2; g.beginPath(); g.moveTo(5, 24); g.lineTo(9, 4); g.stroke();
  } else if (m.kind === 'beast') {
    shape(a, () => g.ellipse(15, 19, 10, 6, 0, 0, 7));
    shape(a, () => g.arc(25, 13, 5, 0, 7));
    shape(b, () => { g.moveTo(8, 22); g.lineTo(10, 29); g.lineTo(13, 29); g.lineTo(13, 23); });
    shape(b, () => { g.moveTo(19, 23); g.lineTo(20, 29); g.lineTo(23, 29); g.lineTo(23, 22); });
    g.fillStyle = c; g.fillRect(26, 11, 2.5, 2.5);
  } else if (m.kind === 'spider') {
    g.lineWidth = 2; g.strokeStyle = b; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(16, 18); g.lineTo(3 + i * 2, 8 + i * 6); g.moveTo(16, 18); g.lineTo(29 - i * 2, 8 + i * 6); g.stroke(); }
    g.strokeStyle = '#0b0a09'; g.lineWidth = 2.6; shape(a, () => g.ellipse(16, 20, 7, 6, 0, 0, 7)); shape(a, () => g.arc(16, 12, 4, 0, 7));
    g.fillStyle = c; g.fillRect(13.5, 11, 2, 2); g.fillRect(16.5, 11, 2, 2);
  } else {
    shape(a, () => g.ellipse(16, 20, 8, 6, 0, 0, 7)); shape(b, () => g.arc(22, 16, 3.5, 0, 7)); g.fillStyle = c; g.fillRect(23, 15, 2, 2);
  }
  g.restore();
}

