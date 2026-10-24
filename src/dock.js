// Hotbar da Alma: apps fixados + janelas abertas, no lugar da barra de tarefas do Windows.
// Fixado: { id, name, appId?, exe?, path? }  — appId (menu Iniciar) abre qualquer app, inclusive os da Store;
// exe serve para reconhecer as janelas abertas e para o ícone.
const { app, shell, Menu, nativeImage } = require('electron');
const { spawn } = require('child_process');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const system = require('./system');

const base = (p) => path.basename(String(p || '')).toLowerCase();
const EXPLORER = { appId: 'Microsoft.Windows.Explorer', exe: 'C:\\Windows\\explorer.exe', name: 'Explorador de Arquivos' };
// pastas especiais que aparecem no começo do AppID de apps clássicos no menu Iniciar
const KNOWN = {
  '{6D809377-6AF0-444B-8957-A3773F02200E}': process.env.ProgramW6432 || process.env.ProgramFiles,
  '{7C5A40EF-A0FB-4BFC-874A-C0F2E0B9FA8E}': process.env['ProgramFiles(x86)'],
  '{F38BF404-1D43-42F2-9305-67DE0B28FC23}': process.env.SystemRoot,
  '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}': path.join(process.env.SystemRoot || 'C:\\Windows', 'System32'),
};

class Dock {
  constructor({ store, win, notify }) {
    this.store = store;
    this.win = win;
    this.notify = notify;
    this.icons = new Map(); // caminho → dataURL
    this.last = { items: [] };
  }

  pins() {
    return this.store.get('dock') || [];
  }
  savePins(list) {
    this.store.set('dock', list);
  }

  // ---------- reconhecer apps ----------
  async startAppFor({ exe, desc }) {
    if (base(exe) === 'explorer.exe') return { id: EXPLORER.appId, name: EXPLORER.name };
    const list = await system.apps();
    for (const q of [path.basename(exe || '', '.exe'), desc]) {
      const key = system.norm(q);
      if (!key) continue;
      const hit = list.find((a) => a.key === key) || list.find((a) => a.key.startsWith(key + ' ') || key.startsWith(a.key + ' '));
      if (hit) return hit;
    }
    return null;
  }

  // descobre o .exe de um fixado (para o ícone e para achar as janelas dele)
  async resolveExe(pin) {
    if (pin.exe) return pin.exe;
    let exe = '';
    try {
      if (pin.appId === EXPLORER.appId) exe = EXPLORER.exe;
      else if (pin.appId && pin.appId.includes('!')) exe = (await this.storeInfo(pin)).exe;
      else if (pin.appId && /^\{[0-9A-F-]+\}\\/i.test(pin.appId)) {
        const [guid, ...rest] = pin.appId.split('\\');
        if (KNOWN[guid.toUpperCase()]) exe = path.join(KNOWN[guid.toUpperCase()], ...rest);
      } else if (pin.path && pin.path.toLowerCase().endsWith('.lnk')) exe = shell.readShortcutLink(pin.path).target || '';
      else if (pin.path) exe = pin.path;
      if (!exe) exe = this.startMenuTarget(pin.name);
    } catch {}
    if (exe) this.savePins(this.pins().map((p) => (p.id === pin.id ? { ...p, exe } : p)));
    return exe;
  }

  // atalho do menu Iniciar com o mesmo nome (apps clássicos como Discord)
  startMenuTarget(name) {
    const want = system.norm(name);
    const roots = [path.join(process.env.ProgramData || 'C:\\ProgramData', 'Microsoft\\Windows\\Start Menu\\Programs'), path.join(app.getPath('appData'), 'Microsoft\\Windows\\Start Menu\\Programs')];
    const walk = (dir, depth) => {
      let entries = [];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return '';
      }
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory() && depth < 3) {
          const r = walk(full, depth + 1);
          if (r) return r;
        } else if (e.name.toLowerCase().endsWith('.lnk') && system.norm(e.name.slice(0, -4)) === want) {
          try {
            const l = shell.readShortcutLink(full);
            // Squirrel (Discord, Slack…): o atalho aponta para Update.exe --processStart X.exe
            const m = /--processStart\s+"?([^"\s]+)/i.exec(l.args || '');
            return m ? path.join(path.dirname(l.target), m[1]) : l.target;
          } catch {}
        }
      }
      return '';
    };
    for (const r of roots) {
      const hit = walk(r, 0);
      if (hit) return hit;
    }
    return '';
  }

  // app da Store fixado: guarda o .exe e o logo do pacote (o .exe deles não tem ícone dentro)
  async storeInfo(pin) {
    const info = await this.win.appInfo({ aumid: pin.appId }).catch(() => ({}));
    const patch = { logo: info.logo || '', logoLight: info.logoLight || '', ...(info.exe && !pin.exe ? { exe: info.exe } : {}) };
    this.savePins(this.pins().map((p) => (p.id === pin.id ? { ...p, ...patch } : p)));
    return { ...pin, ...patch };
  }

  // app da Store que está só aberto (não fixado): logo pelo caminho do .exe
  async storeLogo(exe) {
    if (!/\\WindowsApps\\/i.test(exe)) return '';
    const k = 'logo:' + exe;
    if (!this.icons.has(k)) this.icons.set(k, (await this.win.appInfo({ exe }).catch(() => ({}))).logo || '');
    return this.icons.get(k);
  }

  async icon(file, logo) {
    const key = logo || file;
    if (!key) return '';
    if (this.icons.has(key)) return this.icons.get(key);
    let url = '';
    try {
      url = logo ? nativeImage.createFromPath(logo).resize({ width: 64, quality: 'best' }).toDataURL() : (await app.getFileIcon(file, { size: 'large' })).toDataURL();
    } catch {}
    this.icons.set(key, url);
    return url;
  }

  // ---------- primeira vez: o que está na barra do Windows + o que está aberto ----------
  async seed() {
    if (this.store.get('dock')) return;
    const pins = [];
    const add = (p) => {
      if (pins.some((x) => (x.appId && x.appId === p.appId) || (x.exe && base(x.exe) === base(p.exe)))) return;
      pins.push({ id: crypto.randomUUID().slice(0, 8), ...p });
    };
    pins.push({ id: 'explorer', ...EXPLORER });
    const dir = path.join(app.getPath('appData'), 'Microsoft\\Internet Explorer\\Quick Launch\\User Pinned\\TaskBar');
    try {
      for (const f of fs.readdirSync(dir).filter((x) => x.toLowerCase().endsWith('.lnk'))) {
        const full = path.join(dir, f);
        let target = '';
        try {
          target = shell.readShortcutLink(full).target;
        } catch {}
        if (!target) continue; // o "Explorador de Arquivos" já entrou
        const sa = await this.startAppFor({ exe: target, desc: f.slice(0, -4) });
        add({ name: sa?.name || f.slice(0, -4), appId: sa?.id, exe: target, path: full });
      }
    } catch {}
    try {
      const { windows } = await this.win.list();
      for (const w of windows) {
        if (base(w.exe) === 'explorer.exe' || /\\(windows\\(system32|immersivecontrolpanel))\\/i.test(w.exe)) continue;
        const sa = await this.startAppFor(w);
        add({ name: sa?.name || w.desc || path.basename(w.exe, '.exe'), appId: sa?.id, exe: w.exe });
      }
    } catch {}
    this.savePins(pins);
  }

  // ---------- estado para a ilha ----------
  async state() {
    let windows = [];
    let fg = '0';
    try {
      ({ windows, fg } = await this.win.list());
    } catch {}
    const groups = new Map(); // exe base → janelas (na ordem do Windows: a mais recente primeiro)
    for (const w of windows) {
      const k = base(w.exe);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(w);
    }
    const items = [];
    for (let pin of this.pins()) {
      if (pin.appId && pin.appId.includes('!') && pin.logoLight === undefined) pin = await this.storeInfo(pin);
      const exe = pin.exe || (await this.resolveExe(pin));
      const ws = groups.get(base(exe)) || [];
      groups.delete(base(exe));
      items.push({
        key: pin.id,
        name: pin.name,
        pinned: true,
        icon: await this.icon(exe || pin.path, pin.logo),
        iconLight: pin.logoLight ? await this.icon(null, pin.logoLight) : '', // logo para temas claros
        windows: ws.map((w) => w.hwnd),
        active: ws.some((w) => w.hwnd === fg),
      });
    }
    for (const [k, ws] of groups) {
      const w = ws[0];
      const icon = await this.icon(w.exe, await this.storeLogo(w.exe));
      items.push({ key: 'run:' + k, name: w.desc || path.basename(w.exe, '.exe'), pinned: false, exe: w.exe, icon, windows: ws.map((x) => x.hwnd), active: ws.some((x) => x.hwnd === fg) });
    }
    this.last = { items, fg };
    return items;
  }

  item(key) {
    return this.last.items.find((i) => i.key === key);
  }

  launch(key) {
    const pin = this.pins().find((p) => p.id === key);
    const it = this.item(key);
    if (pin?.appId) return system.launchAppId(pin.appId);
    const file = pin?.path || pin?.exe || it?.exe;
    if (!file) throw new Error('Não sei abrir esse app');
    if (file.toLowerCase().endsWith('.exe')) spawn(file, [], { detached: true, stdio: 'ignore', cwd: path.dirname(file) }).unref();
    else shell.openPath(file);
  }

  // clique: sem janela → abre; com janela → traz para a frente (ou minimiza se já estava);
  // várias janelas e uma já na frente → passa para a próxima
  async activate(key) {
    const it = this.item(key);
    if (!it || !it.windows.length) {
      this.launch(key);
      return 'launched';
    }
    let target = it.windows[0];
    if (it.active && it.windows.length > 1) {
      const i = it.windows.indexOf(this.last.fg);
      target = it.windows[(i + 1) % it.windows.length];
    }
    return this.win.focus(target);
  }

  pin(key) {
    const it = this.item(key);
    if (!it || it.pinned) return;
    return this.startAppFor({ exe: it.exe, desc: it.name }).then((sa) => {
      this.savePins([...this.pins(), { id: crypto.randomUUID().slice(0, 8), name: sa?.name || it.name, appId: sa?.id, exe: it.exe }]);
    });
  }
  pinApp({ id, name }) {
    if (this.pins().some((p) => p.appId === id)) this.savePins(this.pins().filter((p) => p.appId !== id));
    else this.savePins([...this.pins(), { id: crypto.randomUUID().slice(0, 8), name, appId: id }]);
  }
  unpin(key) {
    this.savePins(this.pins().filter((p) => p.id !== key));
  }
  move(key, dir) {
    const list = [...this.pins()];
    const i = list.findIndex((p) => p.id === key);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    this.savePins(list);
  }
  reorder(keys) {
    const byId = new Map(this.pins().map((p) => [p.id, p]));
    const list = keys.map((k) => byId.get(k)).filter(Boolean);
    for (const p of this.pins()) if (!list.includes(p)) list.push(p);
    this.savePins(list);
  }

  // menu do botão direito (nativo do Windows)
  menu(key, win, onChange) {
    const it = this.item(key);
    if (!it) return;
    const pins = this.pins();
    const idx = pins.findIndex((p) => p.id === key);
    const done = () => onChange && onChange();
    const tpl = [
      { label: it.name, enabled: false },
      { type: 'separator' },
      { label: it.windows.length ? 'Abrir nova janela' : 'Abrir', click: () => this.launch(key) },
      it.pinned
        ? { label: 'Desafixar da hotbar', click: () => (this.unpin(key), done()) }
        : { label: 'Fixar na hotbar', click: () => Promise.resolve(this.pin(key)).then(done) },
    ];
    if (it.pinned && pins.length > 1)
      tpl.push(
        { label: 'Mover para a esquerda', enabled: idx > 0, click: () => (this.move(key, -1), done()) },
        { label: 'Mover para a direita', enabled: idx < pins.length - 1, click: () => (this.move(key, 1), done()) },
      );
    if (it.windows.length)
      tpl.push({ type: 'separator' }, { label: it.windows.length > 1 ? `Fechar ${it.windows.length} janelas` : 'Fechar janela', click: () => Promise.all(it.windows.map((h) => this.win.close(h))).then(done) });
    Menu.buildFromTemplate(tpl).popup({ window: win });
  }
}

module.exports = { Dock };
