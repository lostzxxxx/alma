// Conta-gotas: fotografa a tela onde está o mouse e abre por cima uma janela com lupa para escolher um pixel.
// (O Electron não traz o conta-gotas do Chromium, então a Alma faz o seu.)
const { BrowserWindow, screen, desktopCapturer, ipcMain } = require('electron');
const path = require('path');

let open = null; // { win, resolve, image }

function finish(color) {
  if (!open) return;
  const { win, resolve } = open;
  open = null;
  resolve(color || null);
  if (!win.isDestroyed()) win.destroy();
}

ipcMain.handle('picker:image', () => ({ ok: true, data: open ? open.image : null }));
ipcMain.handle('picker:done', (_e, color) => {
  finish(color);
  return { ok: true, data: true };
});

async function pickColor() {
  if (open) finish(null);
  const pt = screen.getCursorScreenPoint();
  const d = screen.getDisplayNearestPoint(pt);
  const size = { width: Math.round(d.size.width * d.scaleFactor), height: Math.round(d.size.height * d.scaleFactor) };
  const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: size });
  const src = sources.find((s) => s.display_id === String(d.id)) || sources[0];
  if (!src) throw new Error('Não deu para ler a tela.');
  const win = new BrowserWindow({
    ...d.bounds,
    frame: false,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    backgroundColor: '#000000',
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setBounds(d.bounds);
  return new Promise((resolve) => {
    open = { win, resolve, image: { src: src.thumbnail.toDataURL(), x: pt.x - d.bounds.x, y: pt.y - d.bounds.y } };
    win.on('blur', () => finish(null)); // clicou em outra coisa: cancela
    win.on('closed', () => finish(null));
    win.loadFile(path.join(__dirname, 'ui', 'picker.html'));
    win.once('ready-to-show', () => {
      win.show();
      win.focus();
    });
  });
}

module.exports = { pickColor };
