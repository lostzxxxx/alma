// Alma — ilha para Windows com a Alminha e painéis rápidos (ar-condicionado, música, tarefas,
// rotinas, área de transferência e apps).
const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage, Notification, clipboard, shell, desktopCapturer, nativeTheme, globalShortcut } = require('electron');
const path = require('path');
const { Store } = require('./store');
const { AirConditioner, DRIVERS } = require('./ac');
const { Scheduler } = require('./scheduler');
const { createTools } = require('./tools');
const { WindowsBridge } = require('./win/windows');
const { Dock } = require('./dock');
const { FileTray } = require('./filetray');
const { Updater } = require('./updater');
const { Focus } = require('./focus');
const { Actions, TEMPLATES } = require('./actions');
const { translate, LANGS } = require('./translate');
const { pickColor } = require('./colorpick');
const system = require('./system');

if (!app.requestSingleInstanceLock()) app.quit();
const DEBUG = Boolean(process.env.ALMA_DEBUG_PORT);
if (DEBUG) app.commandLine.appendSwitch('remote-debugging-port', process.env.ALMA_DEBUG_PORT);
app.setAppUserModelId('com.alma.assistente');

const ICON = path.join(__dirname, '..', 'assets', 'icon.png');
const UI = (f) => path.join(__dirname, 'ui', f);
const ISLAND_W = 760; // largura para caber a hotbar (a janela é transparente e deixa o mouse passar)
const ISLAND_H = 640;

let store, ac, scheduler, tools, winBridge, dock, fileTray, updater, focus, actions;
let silentMode = false; // modo silencioso (Alma Actions): avisos ficam quietos
let island, settingsWin, tray;
let ignoreClipboardUntil = 0;

// ---------------- helpers ----------------
const send = (win, ch, ...a) => win && !win.isDestroyed() && win.webContents.send(ch, ...a);
const ui = (ch, ...a) => {
  send(island, ch, ...a);
  send(settingsWin, ch, ...a);
};
// quieto: modo silencioso ligado, ou durante o foco com "silenciar avisos" (erros e atualizações ainda aparecem)
const quiet = () => silentMode || Boolean(focus?.focusing() && focus.opts().silent);
const toast = (text, kind = 'info', action) => {
  if (quiet() && kind !== 'error' && kind !== 'update') return;
  send(island, 'toast', { text, kind, action });
};

function notify(text, force) {
  if (quiet() && !force) return;
  send(island, 'toast', { text, kind: 'info' });
  if (Notification.isSupported()) new Notification({ title: store.settings().name, body: text, icon: ICON, silent: false }).show();
}
function setSilent(on) {
  silentMode = Boolean(on);
  ui('silent', silentMode);
}
// esconder/mostrar a ilha (Alma Actions)
let islandHidden = false;
function setIslandShown(show) {
  if (!island || island.isDestroyed()) return;
  islandHidden = !show;
  show ? island.showInactive() : island.hide();
}

// Erros de rede/aparelhos em frases curtas.
function prettyError(e) {
  const msg = String(e?.message || e || 'Erro desconhecido');
  if (/fetch failed|ENOTFOUND|ECONNRESET|network/i.test(msg)) return 'Sem conexão com a internet (ou o aparelho não respondeu).';
  return msg.length > 220 ? msg.slice(0, 220) + '…' : msg;
}

// ---------------- janelas ----------------
// Lugar da ilha (Configurações › Acessibilidade): monitor escolhido e esquerda/centro/direita do topo.
// A janela fica sempre dentro do monitor; o centro da ilha dentro dela (ISLAND_CX) é o que muda nas pontas,
// para o painel (470 px) caber inteiro. A página usa os mesmos valores (island.js).
const ISLAND_CX = { left: 250, center: ISLAND_W / 2, right: ISLAND_W - 250 };
const islandOpts = () => ({ position: 'center', display: 'primary', ...(store?.settings().island || {}) });
function islandDisplay() {
  const id = String(islandOpts().display);
  return screen.getAllDisplays().find((d) => String(d.id) === id) || screen.getPrimaryDisplay();
}
function islandBounds() {
  const d = islandDisplay();
  const pos = islandOpts().position;
  const wa = d.workArea;
  const x = pos === 'left' ? wa.x : pos === 'right' ? wa.x + wa.width - ISLAND_W : wa.x + (wa.width - ISLAND_W) / 2;
  return { x: Math.round(x), y: wa.y, width: ISLAND_W, height: ISLAND_H };
}
const islandCenterX = () => island.getBounds().x + (ISLAND_CX[islandOpts().position] ?? ISLAND_W / 2);
// muda de lugar (posição, monitor, monitores ligados/desligados) e avisa o vidro
function placeIsland() {
  if (!island || island.isDestroyed()) return;
  island.setBounds(islandBounds());
  send(island, 'glass:geometry', glassGeometry());
}

function createIsland() {
  island = new BrowserWindow({
    ...islandBounds(),
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    show: false,
    focusable: true,
    backgroundColor: '#00000000',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), backgroundThrottling: false },
  });
  island.setAlwaysOnTop(true, 'screen-saver');
  island.setVisibleOnAllWorkspaces(true);
  island.setIgnoreMouseEvents(true, { forward: true });
  island.loadFile(UI('island.html'));
  island.once('ready-to-show', () => island.showInactive());
  for (const ev of ['display-metrics-changed', 'display-added', 'display-removed']) screen.on(ev, placeIsland);
}

// Esconder com app em tela cheia (jogo, vídeo, F11) no monitor da ilha. Confere a cada 1,5 s, só com a opção ligada.
let hiddenForFullscreen = false;
function watchFullscreen() {
  setInterval(async () => {
    if (!island || island.isDestroyed()) return;
    let full = null;
    if (store.settings().island?.hideFullscreen) {
      const m = await winBridge.fullscreen().catch(() => null);
      if (m) {
        // o monitor da tela cheia é o da ilha? (o Windows responde em pixels reais)
        const b = island.getBounds();
        const p = screen.dipToScreenPoint({ x: b.x + ISLAND_W / 2, y: b.y + 5 });
        full = p.x >= m.left && p.x < m.right && p.y >= m.top && p.y < m.bottom;
      }
    }
    if (full && island.isVisible()) {
      hiddenForFullscreen = true;
      island.hide();
    } else if (!full && hiddenForFullscreen) {
      hiddenForFullscreen = false;
      if (!islandHidden) island.showInactive(); // uma Ação pode ter pedido para ela ficar escondida
    }
  }, 1500);
}

// Atalho de teclado para abrir/fechar o painel (acessibilidade: dá para usar a ilha sem mouse)
let shortcutNow = '';
function applyShortcut() {
  const acc = store.settings().island?.shortcut || '';
  if (acc === shortcutNow) return true;
  if (shortcutNow) globalShortcut.unregister(shortcutNow);
  shortcutNow = '';
  if (!acc) return true;
  const ok = globalShortcut.register(acc, () => {
    if (!island || island.isDestroyed()) return;
    if (hiddenForFullscreen || !island.isVisible()) island.showInactive();
    send(island, 'island:hotkey');
  });
  if (ok) shortcutNow = acc;
  return ok;
}

// Bandeja de arquivos: enquanto a ilha deixa o mouse passar, o Windows não entrega arrastos para ela (e, durante
// um arrasto, ela também não recebe o movimento do mouse). Então, se o ponteiro está em cima da ilha com um botão
// apertado — alguém trazendo um arquivo —, ela passa a "segurar" o mouse e o arrasto chega nela.
// Custa quase nada: só olha a posição do ponteiro; o botão só é consultado com o ponteiro em cima da ilha.
let islandInteractive = false;
let catchBusy = false;
function watchDragToIsland() {
  setInterval(async () => {
    if (!island || island.isDestroyed() || !island.isVisible() || islandInteractive || catchBusy) return;
    const p = screen.getCursorScreenPoint();
    const b = island.getBounds();
    const cx = islandCenterX();
    if (p.x < cx - 130 || p.x > cx + 130 || p.y < b.y || p.y > b.y + 46) return;
    catchBusy = true;
    const down = await winBridge.mouseDown().catch(() => false);
    catchBusy = false;
    if (!down || islandInteractive) return;
    islandInteractive = true;
    island.setIgnoreMouseEvents(false);
    send(island, 'island:catch'); // a página fica sabendo (e devolve o controle quando o ponteiro sair)
  }, 120);
}

// onde a ilha está na tela (para alinhar o desfoque com o que está atrás dela)
function glassGeometry() {
  const d = islandDisplay();
  const b = island.getBounds();
  return { x: b.x - d.bounds.x, y: b.y - d.bounds.y, width: d.size.width, height: d.size.height, scale: d.scaleFactor };
}

// Estilo vidro: a janela de configurações usa o acrílico do próprio Windows (desfoca o que está atrás).
// A ilha não pode usar o acrílico (ela é uma janela transparente grande, e ele borraria o retângulo inteiro):
// ela desenha o próprio vidro a partir da imagem da tela (veja liquid.js).
function applyWindowTheme(win) {
  if (!win || win.isDestroyed()) return;
  const t = { style: 'solid', base: '#18181b', ...(store.settings().theme || {}) };
  const glass = t.style !== 'solid' && !t.solid; // "Reduzir transparência" volta para o sólido
  // o acrílico segue o tom da cor escolhida (cor clara → acrílico claro), senão o texto some na barra lateral
  const n = parseInt(String(t.base).replace('#', '').padEnd(6, '0').slice(0, 6), 16);
  const lin = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const light = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255) > 0.36;
  nativeTheme.themeSource = light ? 'light' : 'dark';
  try {
    win.setBackgroundMaterial(glass ? 'acrylic' : 'none');
  } catch {}
  win.setBackgroundColor(glass ? '#00000000' : t.base);
}

function openSettings(section) {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.show();
    settingsWin.focus();
    if (section) send(settingsWin, 'settings:section', section);
    return;
  }
  settingsWin = new BrowserWindow({
    width: 980,
    height: 760,
    minWidth: 640,
    minHeight: 560,
    title: 'Alma — Configurações',
    icon: ICON,
    autoHideMenuBar: true,
    backgroundColor: '#111113',
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  applyWindowTheme(settingsWin);
  settingsWin.loadFile(UI('settings.html'), section ? { hash: section } : undefined);
}

function createTray() {
  // na bandeja (16 px) vai o recorte perto da Alminha: a cápsula inteira ficaria pequena demais
  tray = new Tray(nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'icon-small.png')).resize({ width: 16, height: 16, quality: 'best' }));
  tray.setToolTip('Alma');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Configurações', click: () => openSettings() },
      { label: 'Mostrar/ocultar ilha', click: () => (island.isVisible() ? island.hide() : island.showInactive()) },
      { type: 'separator' },
      { label: 'Sair', click: () => app.quit() },
    ]),
  );
  tray.on('click', () => openSettings());
}

// ---------------- área de transferência ----------------
async function watchClipboard() {
  let last = await clipboard.readText().catch(() => '');
  setInterval(async () => {
    const t = await clipboard.readText().catch(() => '');
    if (typeof t !== 'string' || !t || t === last) return;
    last = t;
    if (Date.now() < ignoreClipboardUntil || t.length > 10000) return;
    store.update('clipboard', (l) => [{ text: t, at: Date.now() }, ...l.filter((c) => c.text !== t)].slice(0, 30));
    ui('data', { clipboard: store.get('clipboard') });
  }, 1200);
}

// ---------------- IPC ----------------
function publicSettings() {
  const s = store.settings();
  return {
    ...s,
    secrets: Object.fromEntries(['lg_pat', 'st_pat', 'st_client_secret', 'st_refresh', 'tuya_secret', 'ha_token'].map((k) => [k, store.hasSecret(k)])),
    drivers: Object.fromEntries(Object.keys(DRIVERS).map((k) => [k, ac.driver(k).label])),
    version: app.getVersion(),
  };
}

const schedulesView = () => store.get('schedules').map((s) => ({ ...s, when: scheduler.describe(s) }));

function registerIpc() {
  const h = (ch, fn) =>
    ipcMain.handle(ch, async (_e, ...a) => {
      try {
        return { ok: true, data: await fn(...a) };
      } catch (e) {
        return { ok: false, error: prettyError(e) };
      }
    });

  ipcMain.on('island:mouse', (_e, interactive) => {
    if (!island || island.isDestroyed()) return;
    islandInteractive = Boolean(interactive);
    island.setIgnoreMouseEvents(!interactive, { forward: true });
  });
  ipcMain.on('island:focus', () => island && island.focus());
  // painel fechado pelo teclado: devolve o foco para o app que estava na frente
  ipcMain.on('island:blur', () => island && !island.isDestroyed() && island.blur());
  h('screen:displays', () => {
    const primary = screen.getPrimaryDisplay().id;
    return screen.getAllDisplays().map((d, i) => ({
      id: String(d.id),
      label: `Monitor ${i + 1}${d.id === primary ? ' (principal)' : ''} · ${Math.round(d.size.width * d.scaleFactor)}×${Math.round(d.size.height * d.scaleFactor)}`,
    }));
  });
  // Liquid Glass da ilha: ela lê a imagem da tela para desenhar o desfoque do que está atrás (veja ui/liquid.js).
  // Nada é gravado nem enviado. Enquanto lê, a ilha fica fora das capturas (senão desfocaria a si mesma).
  // Efeito colateral: prints e gravações de tela não mostram a ilha nesse período.
  h('glass:start', async () => {
    island.setContentProtection(true);
    const d = islandDisplay();
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 0, height: 0 } });
    const src = sources.find((s) => s.display_id === String(d.id)) || sources[0];
    if (!src) throw new Error('Tela não encontrada para o vidro.');
    await new Promise((r) => setTimeout(r, 80)); // o Windows aplica a exclusão no próximo quadro
    return { ...glassGeometry(), sourceId: src.id };
  });
  h('glass:stop', () => island.setContentProtection(false));

  // dados
  h('data:get', async () => ({
    tray: await fileTray.view(),
    todos: store.get('todos'),
    schedules: schedulesView(),
    clipboard: store.get('clipboard'),
    dock: store.get('dock') || [],
    settings: publicSettings(),
  }));
  h('todo:add', (text) => tools.run('todo_add', { text }));
  h('todo:toggle', (id) => store.update('todos', (l) => l.map((t) => (t.id === id ? { ...t, done: !t.done } : t))));
  h('todo:remove', (id) => store.update('todos', (l) => l.filter((t) => t.id !== id)));
  h('schedule:remove', (id) => scheduler.remove(id));
  h('schedule:run', (id) => {
    const s = store.get('schedules').find((x) => x.id === id);
    return s && scheduler.run(s);
  });
  h('clipboard:copy', (text) => {
    ignoreClipboardUntil = Date.now() + 1500;
    return clipboard.writeText(text);
  });
  h('clipboard:clear', () => store.set('clipboard', []));

  // apps
  h('apps:search', async (q) => (await system.findApps(q, 12)).map(({ name, id }) => ({ name, id })));
  h('apps:launch', (id) => system.launchAppId(id));
  // a estrela da aba Apps fixa/desafixa o app na hotbar
  h('apps:favorite', ({ id, name }) => {
    dock.pinApp({ id, name });
    send(island, 'dock:changed');
  });

  // bandeja de arquivos
  h('tray:add', (paths) => fileTray.add(Array.isArray(paths) ? paths.map(String) : []));
  h('tray:remove', (id) => fileTray.remove(id));
  h('tray:clear', () => fileTray.clear());
  h('tray:open', (id) => fileTray.open(id));
  h('tray:reveal', (id) => fileTray.reveal(id));
  h('tray:copy', (ids) => fileTray.copy([].concat(ids)));
  h('tray:move', (id) => fileTray.move(id, island));
  // arrastar da bandeja para fora: a página cancela o arrasto dela e o processo principal começa o do Windows
  ipcMain.on('tray:drag', (e, ids) => {
    const d = fileTray.dragInfo([].concat(ids));
    if (!d) return;
    e.sender.startDrag(d.files.length > 1 ? { files: d.files, file: d.files[0], icon: d.icon } : { file: d.files[0], icon: d.icon });
  });

  // hotbar
  const dockChanged = () => send(island, 'dock:changed');
  h('dock:state', () => dock.state());
  h('dock:activate', (key) => dock.activate(key));
  h('dock:menu', (key) => dock.menu(key, island, dockChanged));
  h('dock:start', () => winBridge.startMenu());
  h('dock:reorder', (keys) => (dock.reorder(keys), dockChanged()));
  h('open:taskbar-settings', () => shell.openExternal('ms-settings:taskbar'));

  // mídia
  // tocar/pausar/pular vão direto para a sessão de mídia do Windows; sem sessão (ou volume), teclas de mídia
  h('media', async (action) => {
    if (['play_pause', 'next', 'previous'].includes(action) && (await winBridge.mediaControl(action).catch(() => false))) return { ok: true };
    return system.media(action);
  });
  h('media:now', (thumbKey) => winBridge.nowPlaying(thumbKey));
  h('media:youtube', (query) => system.playYoutube(query));

  // ar-condicionado
  const strip = ({ raw, ...s }) => s;
  h('ac:list', () => ac.list());
  h('ac:status', async (device) => strip(await ac.status(device)));
  h('ac:set', async (device, cmd) => {
    const s = strip(await ac.set(device, cmd));
    ui('ac-updated', s);
    return s;
  });

  // configurações
  h('settings:get', () => publicSettings());
  h('settings:save', (patch) => {
    const { secrets, ...rest } = patch || {};
    if (rest.ac) ac.reset();
    store.patchSettings(rest);
    for (const [k, v] of Object.entries(secrets || {})) if (v !== undefined && v !== null) store.setSecret(k, v);
    if (secrets && Object.keys(secrets).length) ac.reset();
    if ('openAtLogin' in rest) setLogin(rest.openAtLogin);
    if ('theme' in rest) applyWindowTheme(settingsWin);
    if (rest.island) {
      placeIsland();
      if (!applyShortcut()) {
        store.patchSettings({ island: { shortcut: '' } });
        ui('settings', publicSettings());
        throw new Error('Esse atalho já é usado por outro programa. Escolha outro.');
      }
    }
    ui('settings', publicSettings());
    return publicSettings();
  });
  h('settings:open', (section) => openSettings(section));
  // temporizador e foco
  h('focus:state', () => focus.state());
  h('focus:start', (mode, opts) => focus.start(mode, opts || {}));
  h('focus:pause', () => focus.pause());
  h('focus:resume', () => focus.resume());
  h('focus:stop', () => focus.stop());
  h('focus:skip', () => focus.skip());
  h('focus:timer', (min) => focus.setTimer(min));

  // tradução rápida
  h('translate:langs', () => LANGS);
  h('translate:run', (text, opts) => translate(text, { ...(store.settings().translate || {}), ...(opts || {}) }));

  // conta-gotas: escolhe um pixel da tela e guarda no histórico
  h('color:pick', async () => {
    const c = await pickColor();
    if (c) store.update('colors', (l) => [c.hex, ...(l || []).filter((x) => x !== c.hex)].slice(0, 24));
    return c;
  });
  h('color:history', () => store.get('colors') || []);
  h('color:clear', () => store.set('colors', []));

  // Alma Actions
  h('actions:list', () => actions.list());
  h('actions:save', (list) => actions.save(list));
  h('actions:templates', () => TEMPLATES);
  h('actions:test', (rule) => actions.test(rule));
  // apps abertos agora (para escolher em "Quando abrir…")
  h('actions:apps', async () => {
    const l = await winBridge.list();
    const seen = new Map();
    for (const w of l.windows || []) {
      const exe = path.basename(w.exe || '');
      if (exe && !seen.has(exe.toLowerCase())) seen.set(exe.toLowerCase(), { exe, name: w.desc || exe.replace(/\.exe$/i, '') });
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  });
  h('silent:get', () => silentMode);
  h('silent:set', (on) => setSilent(on));

  // atualizações
  h('update:state', () => updater.state);
  h('update:check', () => updater.check(true));
  h('update:download', () => updater.download());
  h('update:install', () => updater.install());
  h('st:authorize-url', (redirect) => ac.driver('smartthings').authorizeUrl(redirect));
  h('st:exchange', ({ code, redirect }) => ac.driver('smartthings').exchangeCode(code, redirect));
  h('open:external', (url) => system.openUrl(url));
  if (DEBUG) {
    h('debug:tool', (name, args) => tools.run(name, args));
    h('debug:scheduler-tick', () => scheduler.tick());
    h('debug:ac-inspect', async () => {
      const d = await ac.resolve();
      return ac.driver().inspect ? ac.driver().inspect(d.id) : 'driver sem inspeção';
    });
  }
  h('app:quit', () => app.quit());
}

function setLogin(open) {
  app.setLoginItemSettings({ openAtLogin: Boolean(open), path: process.execPath, args: app.isPackaged ? [] : [app.getAppPath()] });
}

// ---------------- inicialização ----------------
app.whenReady().then(() => {
  store = new Store();
  ac = new AirConditioner(store);
  tools = createTools({ store, ac, notify, ui });

  // rotinas já criadas continuam rodando nos horários
  scheduler = new Scheduler(store, (a) => tools.run(a.tool, a.args));
  scheduler.on('ran', (item, results) => {
    const failed = results.filter((r) => !r.ok);
    const summary = item.description || item.actions.map((a) => a.tool).join(', ');
    if (!item.actions.every((a) => a.tool === 'notify')) notify(`Rotina feita: ${summary}${failed.length ? ` (falhou: ${failed.map((f) => f.error).join('; ')})` : ''}`);
  });

  store.on('change', (k) => {
    if (k === 'todos' || k === 'schedules' || k === 'dock') ui('data', { [k]: k === 'schedules' ? schedulesView() : store.get(k) });
  });

  // hotbar: ponte com as janelas do Windows (as janelas da própria Alma ficam de fora)
  winBridge = new WindowsBridge();
  winBridge.setOwnPids([process.pid]);
  winBridge.warmUp();
  dock = new Dock({ store, win: winBridge, notify });
  fileTray = new FileTray({ store, powershell: system.powershell, onChange: async () => ui('data', { tray: await fileTray.view() }) });
  setTimeout(() => dock.seed().then(() => send(island, 'dock:changed')).catch((e) => console.error('hotbar', e)), 1500);

  // temporizador e foco: estado a cada segundo para a ilha; fim de fase avisa (mesmo no silencioso)
  focus = new Focus(store);
  focus.on('state', (s) => send(island, 'focus', s));
  focus.on('done', (d) => {
    const msg = {
      focus: 'Foco concluído! Hora de uma pausa.',
      short: 'Pausa acabou. Bora focar?',
      long: 'Pausa longa acabou. Bora focar?',
      timer: 'O tempo acabou!',
    }[d.phase];
    send(island, 'focus:done', d);
    if (msg && !d.skipped) notify(msg, true);
  });

  // Alma Actions
  actions = new Actions({
    store,
    win: winBridge,
    focus,
    system,
    ctx: {
      silent: () => silentMode,
      setSilent,
      islandShown: () => !islandHidden,
      setIsland: setIslandShown,
      notify: (t) => notify(t, true),
      ac: (cmd) => ac.set(undefined, cmd).then((s) => ui('ac-updated', s)),
    },
  });
  actions.on('error', (rule, e) => toast(`Ação "${rule.name}": ${prettyError(e)}`, 'error'));

  // versão nova: aviso na ilha (clicar abre Configurações › Geral) e notificação do Windows
  updater = new Updater();
  updater.on('state', (s) => ui('update', s));
  updater.on('available', (s) => {
    toast(`Nova versão ${s.version} disponível — clique para ver as novidades`, 'update', 'update');
    if (Notification.isSupported()) {
      const n = new Notification({ title: 'Nova versão da Alma', body: `A versão ${s.version} está disponível. Clique para ver as novidades e instalar.`, icon: ICON });
      n.on('click', () => openSettings('general'));
      n.show();
    }
  });

  registerIpc();
  createIsland();
  watchDragToIsland();
  watchFullscreen();
  applyShortcut();
  createTray();
  watchClipboard();
  scheduler.start();
  updater.start();
  actions.start();
  // "Abrir com o Windows" aponta para onde a Alma está agora (ela pode ter mudado de pasta ao ser instalada)
  if (store.settings().openAtLogin) setLogin(true);
  system.apps().catch(() => {});
  ac.list().catch(() => {});
});

app.on('second-instance', () => openSettings());
app.on('window-all-closed', (e) => e.preventDefault?.()); // continua na bandeja
app.on('before-quit', () => {
  try {
    store?.flush();
    winBridge?.shutdown();
    globalShortcut.unregisterAll();
  } catch {}
});
