const { contextBridge, ipcRenderer, webUtils } = require('electron');

const SEND = new Set(['island:mouse', 'island:focus', 'island:blur', 'tray:drag']);
const LISTEN = new Set(['toast', 'data', 'ac-updated', 'settings', 'settings:section', 'dock:changed', 'glass:geometry', 'island:catch', 'island:hotkey', 'update', 'focus', 'focus:done', 'silent']);

contextBridge.exposeInMainWorld('alma', {
  // chamadas com resposta { ok, data | error }
  call: async (channel, ...args) => {
    const res = await ipcRenderer.invoke(channel, ...args);
    if (!res.ok) throw new Error(res.error);
    return res.data;
  },
  send: (channel, ...args) => SEND.has(channel) && ipcRenderer.send(channel, ...args),
  // caminho de um arquivo solto na janela (bandeja de arquivos)
  pathForFile: (file) => {
    try {
      return webUtils.getPathForFile(file);
    } catch {
      return '';
    }
  },
  on: (channel, fn) => {
    if (!LISTEN.has(channel)) return () => {};
    const l = (_e, ...a) => fn(...a);
    ipcRenderer.on(channel, l);
    return () => ipcRenderer.removeListener(channel, l);
  },
});
