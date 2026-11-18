// Windows/desktop wrapper: opens the interface in its own window and runs the game behind it.
const { app, BrowserWindow, Menu } = require('electron');
const path = require('path'), fs = require('fs');
const { start } = require('./server.js');

let win = null, srv = null, gameGone = false, closing = false;

app.whenReady().then(async () => {
  // packaged: <folder>/game/frogcomposband.exe beside the program; from source: the repository
  const packed = path.join(path.dirname(process.execPath), 'game');
  const root = fs.existsSync(packed) ? packed : path.resolve(__dirname, '..');
  const args = process.argv.slice(app.isPackaged ? 1 : 2).filter(a => /^-[a-zA-Z]/.test(a) && !a.startsWith('--'));
  srv = await start({ root, args, onExit: () => { gameGone = true; setTimeout(() => app.exit(0), closing ? 0 : 600); } });
  Menu.setApplicationMenu(null);
  win = new BrowserWindow({ width: 1600, height: 900, minWidth: 1280, minHeight: 720, backgroundColor: '#08090a', show: false, title: 'FrogComposband',
    icon: path.join(__dirname, 'ui', 'icon.png'), webPreferences: { backgroundThrottling: false, contextIsolation: true } });
  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  win.webContents.on('before-input-event', (e, k) => {
    if (k.type !== 'keyDown') return;
    if (k.key === 'F11' || (k.alt && k.key === 'Enter')) { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
  });
  win.on('page-title-updated', e => e.preventDefault());
  // closing the window saves the game first
  win.on('close', e => { if (!gameGone && !closing) { e.preventDefault(); closing = true; srv.quit(); setTimeout(() => app.exit(0), 5000); } });
  win.loadURL(`http://127.0.0.1:${srv.port}/`);
});
app.on('window-all-closed', () => app.quit());
