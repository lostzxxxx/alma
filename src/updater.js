// Atualizações da Alma: procura versão nova (ao abrir e a cada 6 h), avisa e mostra as novidades.
// Só baixa e instala quando a pessoa pede (Configurações › Geral › Atualizações).
// As versões ficam nas Releases do GitHub (configurado em package.json › build.publish); para testar sem
// publicar, ALMA_UPDATE_URL aponta para uma pasta servida localmente com o latest.yml e o instalador.
const { app } = require('electron');
const { EventEmitter } = require('events');

const EVERY = 6 * 60 * 60 * 1000;

// texto simples a partir das notas da versão (o GitHub manda HTML)
function plainNotes(notes) {
  const list = Array.isArray(notes) ? notes.map((n) => n.note || '') : [notes || ''];
  return list
    .join('\n')
    .replace(/<\/(p|li|h\d)>|<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

class Updater extends EventEmitter {
  constructor() {
    super();
    this.state = { status: 'idle', current: app.getVersion() };
    this.updater = null;
    this.manual = false;
    this.notified = '';
    const testUrl = process.env.ALMA_UPDATE_URL;
    this.enabled = app.isPackaged || Boolean(testUrl);
    if (!this.enabled) return; // rodando do código: não há o que atualizar
    const { autoUpdater } = require('electron-updater');
    this.updater = autoUpdater;
    autoUpdater.autoDownload = false; // avisa e pergunta
    autoUpdater.autoInstallOnAppQuit = true; // baixou e não reiniciou: instala ao fechar a Alma
    autoUpdater.logger = null;
    if (testUrl) {
      autoUpdater.forceDevUpdateConfig = true;
      autoUpdater.setFeedURL({ provider: 'generic', url: testUrl });
    }
    autoUpdater.on('checking-for-update', () => this._set({ status: 'checking' }));
    autoUpdater.on('update-not-available', () => this._set({ status: 'none', checkedAt: Date.now() }));
    autoUpdater.on('update-available', (info) => {
      this._set({ status: 'available', version: info.version, notes: plainNotes(info.releaseNotes), date: info.releaseDate, checkedAt: Date.now() });
      if (this.notified !== info.version) {
        this.notified = info.version;
        this.emit('available', this.state);
      }
    });
    autoUpdater.on('download-progress', (p) => this._set({ status: 'downloading', percent: Math.round(p.percent || 0) }));
    autoUpdater.on('update-downloaded', () => this._set({ status: 'ready', percent: 100 }));
    autoUpdater.on('error', (e) => {
      // procura automática que falhou (sem internet, ainda sem publicação): fica quieta
      const wasDownloading = this.state.status === 'downloading';
      if (!this.manual && !wasDownloading) return this._set({ status: this.state.version ? 'available' : 'idle' });
      this._set({ status: 'error', error: wasDownloading ? 'O download falhou. Tente de novo.' : 'Não deu para procurar agora (sem internet ou nenhuma versão publicada ainda).', detail: String(e?.message || e).slice(0, 300) });
    });
  }

  _set(patch) {
    this.state = { ...this.state, ...patch, current: app.getVersion() };
    this.emit('state', this.state);
  }

  start() {
    if (!this.enabled) return;
    setTimeout(() => this.check(false), 15000);
    setInterval(() => this.check(false), EVERY);
  }

  async check(manual = true) {
    if (!this.enabled) {
      this._set({ status: 'dev' });
      return this.state;
    }
    if (['checking', 'downloading', 'ready'].includes(this.state.status)) return this.state;
    this.manual = manual;
    try {
      await this.updater.checkForUpdates();
    } catch {
      /* o evento 'error' já cuidou */
    }
    return this.state;
  }

  async download() {
    if (!this.enabled || this.state.status !== 'available') return this.state;
    this._set({ status: 'downloading', percent: 0 });
    try {
      await this.updater.downloadUpdate();
    } catch {
      /* o evento 'error' já cuidou */
    }
    return this.state;
  }

  // fecha a Alma, instala sem janelas (mesma pasta, mesmos atalhos) e abre de novo
  install() {
    if (this.state.status !== 'ready') return false;
    setImmediate(() => this.updater.quitAndInstall(true, true));
    return true;
  }
}

module.exports = { Updater };
