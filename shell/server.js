// Shell server: starts the game, relays its state to the interface (a web page)
// and key presses back. Runs under plain Node (tests) and inside Electron.
//   node shell/server.js [--port 8777] [--game path] [-- game args...]
const http = require('http'), net = require('net'), fs = require('fs'), path = require('path');
const { spawn } = require('child_process');

function start(opts = {}) {
  const root = opts.root || path.resolve(__dirname, '..');
  const uiDir = opts.uiDir || path.join(__dirname, 'ui');
  const exe = process.platform === 'win32' ? 'frogcomposband.exe' : 'frogcomposband';
  const game = opts.game || [path.join(root, exe), path.join(root, 'src', exe)].find(p => fs.existsSync(p));
  const clients = new Set();
  let spawnGame = null, hello = null, dict = null, lastState = null, lastMap = null, lastUi = null, gameSock = null, child = null, pending = [];
  const rows = new Map(); let frameMeta = null;   // full copy of the text grid for late joiners

  // the game ending: tell the page once per run; the page answers K (keep the window: a death, a new character may follow) or E (close)
  let ended = false;
  const gone = () => { if (ended) return; ended = true; push('{"t":"bye"}'); if (opts.onExit) opts.onExit(); };
  const push = line => { for (const r of clients) r.write(`data: ${line}\n\n`); };
  const toGame = s => { if (gameSock) gameSock.write(s + '\n'); else pending.push(s); };

  const tcp = net.createServer(sock => {
    gameSock = sock; sock.setNoDelay(true);
    for (const p of pending) sock.write(p + '\n'); pending = [];
    let buf = '';
    sock.on('data', d => {
      buf += d.toString('latin1'); let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 1);
        if (!line) continue;
        const t = line.slice(6, 8);          // {"t":"X
        if (t === 'he') hello = line; else if (t === 'di') dict = line; else if (t === 's"') { lastState = line; if (line.includes('"map":{')) lastMap = line; } else if (t === 'ui') lastUi = line;
        else if (t === 'f"') { try { const f = JSON.parse(line); if (!frameMeta || frameMeta.w !== f.w || frameMeta.h !== f.h) rows.clear(); for (const r of f.rows) rows.set(r.y, r); f.rows = []; frameMeta = f; } catch (e) {} }
        push(line);
      }
    });
    sock.on('close', () => { gameSock = null; gone(); });
    sock.on('error', () => {});
  });

  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.ttf': 'font/ttf', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml' };
  const web = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      clients.add(res); req.on('close', () => clients.delete(res));
      if (hello) res.write(`data: ${hello}\n\n`);
      if (dict) res.write(`data: ${dict}\n\n`);
      if (frameMeta) res.write(`data: ${JSON.stringify({ ...frameMeta, rows: [...rows.values()] })}\n\n`);
      if (lastMap && lastMap !== lastState) res.write(`data: ${lastMap}\n\n`);
      if (lastState) res.write(`data: ${lastState}\n\n`);
      if (lastUi) res.write(`data: ${lastUi}\n\n`);
      return;
    }
    if (u.pathname === '/in' && req.method === 'POST') {
      let b = ''; req.on('data', d => b += d); req.on('end', () => {
        for (const l of b.split('\n')) {
          if (/^([XRVMT] [0-9a-fA-F -]+|Q|D [pe] [!-~])$/.test(l)) toGame(l);
          else if (l === 'K' && ended && opts.onKeep) opts.onKeep();
          else if (l === 'E' && ended && opts.onLeave) opts.onLeave();
          else if (l === 'N' && ended && spawnGame) spawnGame();
        }
        res.writeHead(204); res.end(); });
      return;
    }
    // the game's own help files, read-only, for tooltips (races, classes, options...)
    const hm = /^\/help\/([A-Za-z0-9_-]+\.txt)$/.exec(u.pathname);
    if (hm) { fs.readFile(path.join(root, 'lib', 'help', hm[1]), 'latin1', (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(d); }); return; }
    let f = path.normalize(path.join(uiDir, u.pathname === '/' ? 'index.html' : u.pathname));
    if (!f.startsWith(uiDir)) { res.writeHead(403); return res.end(); }
    fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end('not found'); } res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(d); });
  });

  return new Promise(resolve => {
    tcp.listen(0, '127.0.0.1', () => {
      const gport = tcp.address().port;
      web.listen(opts.port || 0, '127.0.0.1', () => {
        const env = { ...process.env, FROG_SHELL_PORT: String(gport), FROG_SHELL_COLS: String(opts.cols || 110), FROG_SHELL_ROWS: String(opts.rows || 40) };
        spawnGame = () => {
          ended = false; hello = dict = lastState = lastMap = lastUi = null; rows.clear(); frameMeta = null; pending = [];
          if (opts.onRespawn) opts.onRespawn();
          child = spawn(game, ['-mshell', ...(opts.args || [])], { cwd: root, env, stdio: ['ignore', 'inherit', 'inherit'] });
          child.on('exit', gone);
        };
        if (game && !opts.noGame) spawnGame(); else spawnGame = null;
        resolve({ port: web.address().port, gport, quit: () => toGame('Q'), stop: () => { try { child && child.kill(); } catch (e) {} tcp.close(); web.close(); } });
      });
    });
  });
}
module.exports = { start };

if (require.main === module) {
  const a = process.argv.slice(2), o = {}; const i = a.indexOf('--');
  if (i >= 0) o.args = a.splice(i).slice(1);
  for (let j = 0; j < a.length; j += 2) o[a[j].replace(/^--/, '')] = a[j + 1];
  if (o.port) o.port = +o.port;
  let t = 0;   // a death keeps the server for a new character; anything else ends it
  start({ ...o, onExit: () => { t = setTimeout(() => process.exit(0), 2500); }, onKeep: () => clearTimeout(t), onLeave: () => process.exit(0), onRespawn: () => clearTimeout(t) }).then(s => console.log(`interface at http://127.0.0.1:${s.port}/`));
}
