// Bandeja temporária de arquivos: arraste arquivos para a ilha e eles ficam guardados aqui até você levar
// para outro lugar (arrastando para fora, "Mover para…" ou "Copiar"). Cada item sai da bandeja 12 h depois
// de entrar. A bandeja guarda só a referência: o arquivo continua onde está e nunca é apagado por ela.
const { app, nativeImage, shell, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TTL = 12 * 60 * 60 * 1000;
const MAX = 50;

class FileTray {
  constructor({ store, powershell, onChange }) {
    this.store = store;
    this.powershell = powershell;
    this.onChange = onChange;
    this.icons = new Map(); // caminho → { url, image } (miniatura de imagens/vídeos/PDF, ou ícone do tipo)
    this.timer = setInterval(() => this.prune(), 60 * 1000);
    this.prune();
  }

  items() {
    return this.store.get('tray') || [];
  }

  _save(list) {
    this.store.set('tray', list);
    this.onChange();
  }

  // tira o que passou de 12 h
  prune() {
    const now = Date.now();
    const list = this.items();
    const keep = list.filter((t) => now - t.addedAt < TTL);
    if (keep.length !== list.length) this._save(keep);
  }

  async _icon(p) {
    if (this.icons.has(p)) return this.icons.get(p);
    let image = null;
    try {
      image = await nativeImage.createThumbnailFromPath(p, { width: 96, height: 96 }); // miniatura de verdade (fotos, vídeos, PDF)
    } catch {}
    if (!image || image.isEmpty()) image = await app.getFileIcon(p, { size: 'large' }).catch(() => null);
    const icon = image && !image.isEmpty() ? { url: image.toDataURL(), image } : { url: '', image: null };
    this.icons.set(p, icon);
    return icon;
  }

  // o que a ilha mostra
  async view() {
    const now = Date.now();
    const list = this.items().filter((t) => now - t.addedAt < TTL);
    return Promise.all(
      list.map(async (t) => {
        const missing = !fs.existsSync(t.path);
        return { ...t, missing, icon: missing ? '' : (await this._icon(t.path)).url, expiresAt: t.addedAt + TTL };
      }),
    );
  }

  // arquivos soltos na ilha (o mesmo arquivo de novo só renova as 12 h)
  async add(paths) {
    const now = Date.now();
    let list = this.items();
    for (const p of [...new Set(paths)].filter(Boolean)) {
      let st;
      try {
        st = await fs.promises.stat(p);
      } catch {
        continue;
      }
      list = list.filter((t) => t.path.toLowerCase() !== p.toLowerCase());
      list.unshift({ id: crypto.randomUUID(), path: p, name: path.basename(p) || p, size: st.isDirectory() ? 0 : st.size, dir: st.isDirectory(), addedAt: now });
    }
    this._save(list.slice(0, MAX));
    return this.view();
  }

  _get(id) {
    const t = this.items().find((x) => x.id === id);
    if (!t) throw new Error('Esse item já saiu da bandeja.');
    return t;
  }

  remove(id) {
    this._save(this.items().filter((t) => t.id !== id));
  }

  clear() {
    this._save([]);
  }

  open(id) {
    return shell.openPath(this._get(id).path).then((err) => {
      if (err) throw new Error(err);
    });
  }

  reveal(id) {
    shell.showItemInFolder(this._get(id).path);
  }

  // "Copiar": põe os arquivos na área de transferência do Windows, para colar numa pasta, no WhatsApp, e-mail…
  async copy(ids) {
    const files = this.items()
      .filter((t) => ids.includes(t.id) && fs.existsSync(t.path))
      .map((t) => `'${t.path.replace(/'/g, "''")}'`);
    if (!files.length) throw new Error('Nenhum arquivo para copiar.');
    await this.powershell(`Set-Clipboard -LiteralPath ${files.join(',')}`);
    return files.length;
  }

  // "Mover para…": escolhe a pasta e move de verdade (a bandeja passa a apontar para o lugar novo)
  async move(id, parent) {
    const t = this._get(id);
    const r = await dialog.showOpenDialog(parent, { title: `Mover "${t.name}" para…`, properties: ['openDirectory', 'createDirectory'] });
    if (r.canceled || !r.filePaths[0]) return null;
    const dest = path.join(r.filePaths[0], t.name);
    if (path.resolve(dest).toLowerCase() === path.resolve(t.path).toLowerCase()) return null;
    if (fs.existsSync(dest)) throw new Error(`Já existe "${t.name}" nessa pasta.`);
    try {
      await fs.promises.rename(t.path, dest);
    } catch (e) {
      if (e.code !== 'EXDEV') throw e;
      // outro disco: copia e depois apaga o original
      await fs.promises.cp(t.path, dest, { recursive: true, errorOnExist: true });
      await fs.promises.rm(t.path, { recursive: true, force: true });
    }
    this.icons.delete(t.path);
    this._save(this.items().map((x) => (x.id === id ? { ...x, path: dest } : x)));
    return dest;
  }

  // arrastar da bandeja para fora (o Windows decide o destino; arquivos vão como cópia)
  dragInfo(ids) {
    const files = this.items().filter((t) => ids.includes(t.id) && fs.existsSync(t.path));
    if (!files.length) return null;
    const first = this.icons.get(files[0].path)?.image;
    const icon = first ? first.resize({ width: 48 }) : nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'icon.png')).resize({ width: 32 });
    return { files: files.map((t) => t.path), icon };
  }
}

module.exports = { FileTray, TRAY_TTL: TTL };
