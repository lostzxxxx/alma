// Persistência local: um único data.json na pasta de dados do app.
// Segredos (tokens do ar) são cifrados com safeStorage (DPAPI do Windows).
const { app, safeStorage } = require('electron');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

const DEFAULTS = {
  settings: {
    name: 'Alma',
    hue: 196, // cor da alma (0-360)
    discreet: true, // antigo (antes de island.reveal): ilha vira uma linha fina quando parada
    // comportamento e lugar da ilha (Configurações › Acessibilidade)
    island: {
      reveal: null, // 'always' | 'line' | 'hidden'; null = segue o antigo `discreet`
      hoverDelay: 180, // ms com o mouse parado em cima para ela aparecer
      hideAfter: 2500, // ms para recolher depois que o mouse sai
      hoverOpen: false, // abre o painel só de passar o mouse
      position: 'center', // 'left' | 'center' | 'right' (no topo)
      display: 'primary', // id do monitor ou 'primary'
      hideFullscreen: false, // some quando um app está em tela cheia
      shortcut: '', // atalho de teclado para abrir o painel ('' = desligado)
    },
    motion: 'full', // animações: 'full' (sempre) | 'system' (segue o Windows) | 'reduced'
    dock: true, // hotbar desce da ilha ao passar o mouse
    // aparência (ui/theme.js tem a lista completa e os padrões): material 'solid' | 'glass' | 'clear', cor base,
    // destaque 'neutral' | 'hue' (usa `hue`), vidro (opacidade, desfoque, desfoque real, refração), forma, texto,
    // contraste, cor da Alminha, ícones da hotbar e o que aparece na ilha
    theme: { style: 'solid', base: '#18181b', accent: 'neutral', opacity: 0.78 },
    // módulos do painel: ordem e quais aparecem ([{ id, on }]); null = o padrão da ilha (island.js)
    modules: null,
    // temporizador e foco (minutos; ver focus.js)
    focus: { focusMin: 25, shortMin: 5, longMin: 15, rounds: 4, autoBreak: true, autoFocus: false, sleep: true, silent: true, sound: true },
    // tradução rápida: para qual idioma, e o alternativo quando o texto já está nele
    translate: { target: 'pt-BR', alt: 'en', autoCopy: false, dropToTranslate: true },
    // conta-gotas: formato copiado e se copia sozinho ao escolher
    color: { format: 'hex', autoCopy: true },
    openAtLogin: false,
    ac: { driver: 'demo', defaultDevice: '', options: {} },
  },
  secrets: {}, // nome -> base64 cifrado
  todos: [],
  schedules: [],
  memories: [], // sem uso desde que a Alma deixou de receber pedidos; mantido para não apagar dados antigos
  clipboard: [],
  favorites: [], // antigo (antes da hotbar)
  dock: null, // apps fixados na hotbar; null = ainda não importou da barra do Windows
  automations: [], // Alma Actions (actions.js)
  colors: [], // cores escolhidas com o conta-gotas (HEX, mais recentes primeiro)
  tray: [], // bandeja de arquivos: { id, path, name, size, dir, addedAt } — só a referência; sai em 12 h
  demoAc: {},
};

class Store extends EventEmitter {
  constructor() {
    super();
    this.file = path.join(app.getPath('userData'), 'data.json');
    this.data = structuredClone(DEFAULTS);
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      for (const k of Object.keys(DEFAULTS)) if (raw[k] !== undefined) this.data[k] = raw[k];
      this.data.settings = {
        ...DEFAULTS.settings,
        ...raw.settings,
        ac: { ...DEFAULTS.settings.ac, ...(raw.settings?.ac || {}) },
        island: { ...DEFAULTS.settings.island, ...(raw.settings?.island || {}) },
        focus: { ...DEFAULTS.settings.focus, ...(raw.settings?.focus || {}) },
        translate: { ...DEFAULTS.settings.translate, ...(raw.settings?.translate || {}) },
        color: { ...DEFAULTS.settings.color, ...(raw.settings?.color || {}) },
      };
      this.data.clipboard = (this.data.clipboard || []).filter((c) => c && typeof c.text === 'string');
    } catch {
      /* primeiro uso */
    }
    this._timer = null;
  }

  get(key) {
    return this.data[key];
  }

  set(key, value) {
    this.data[key] = value;
    this._scheduleSave();
    this.emit('change', key, value);
  }

  update(key, fn) {
    this.set(key, fn(this.data[key]));
  }

  settings() {
    return this.data.settings;
  }

  patchSettings(patch) {
    const cur = this.data.settings;
    const next = { ...cur, ...patch };
    if (patch.ac) next.ac = { ...cur.ac, ...patch.ac, options: { ...(patch.ac.options ?? cur.ac.options) } };
    if (patch.island) next.island = { ...cur.island, ...patch.island };
    for (const k of ['focus', 'translate', 'color']) if (patch[k]) next[k] = { ...cur[k], ...patch[k] };
    this.set('settings', next);
  }

  getSecret(name) {
    const enc = this.data.secrets[name];
    if (!enc) return '';
    try {
      return safeStorage.isEncryptionAvailable()
        ? safeStorage.decryptString(Buffer.from(enc, 'base64'))
        : Buffer.from(enc, 'base64').toString('utf8');
    } catch {
      return '';
    }
  }

  setSecret(name, value) {
    const secrets = { ...this.data.secrets };
    if (!value) delete secrets[name];
    else
      secrets[name] = safeStorage.isEncryptionAvailable()
        ? safeStorage.encryptString(value).toString('base64')
        : Buffer.from(value, 'utf8').toString('base64');
    this.set('secrets', secrets);
  }

  hasSecret(name) {
    return Boolean(this.data.secrets[name]);
  }

  _scheduleSave() {
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.flush(), 300);
  }

  flush() {
    clearTimeout(this._timer);
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf8');
    fs.renameSync(tmp, this.file);
  }
}

module.exports = { Store };
