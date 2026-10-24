// Ponte com o windows.ps1 (um PowerShell que fica aberto): janelas abertas, foco, fechar, menu Iniciar.
const { spawn } = require('child_process');
const path = require('path');
const readline = require('readline');

class WindowsBridge {
  constructor() {
    this.proc = null;
    this.seq = 0;
    this.pending = new Map(); // id -> { resolve, reject, timer }
    this.ownPids = [];
  }

  _ensure() {
    if (this.proc && this.proc.exitCode === null) return;
    // no app empacotado o .ps1 fica fora do app.asar (o PowerShell não lê de dentro dele)
    const script = path.join(__dirname, 'windows.ps1').replace(/app\.asar([\\/])/, 'app.asar.unpacked$1');
    this.proc = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script], {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    readline.createInterface({ input: this.proc.stdout }).on('line', (line) => this._onLine(line));
    this.proc.stderr.on('data', (d) => console.error('[janelas]', String(d).trim()));
    this.proc.on('exit', () => {
      for (const p of this.pending.values()) {
        clearTimeout(p.timer);
        p.reject(new Error('O ajudante de janelas fechou'));
      }
      this.pending.clear();
      this.proc = null;
    });
    // as janelas da própria Alma não aparecem na hotbar
    if (this.ownPids.length) this._write({ cmd: 'own', pids: this.ownPids, id: ++this.seq });
  }

  _write(obj) {
    this.proc.stdin.write(JSON.stringify(obj) + '\n');
  }

  _onLine(line) {
    let m;
    try {
      m = JSON.parse(line.replace(/^﻿/, ''));
    } catch {
      return;
    }
    const p = this.pending.get(m.id);
    if (!p) return;
    this.pending.delete(m.id);
    clearTimeout(p.timer);
    m.ok ? p.resolve(m.data) : p.reject(new Error(m.error || 'Erro nas janelas do Windows'));
  }

  call(cmd, args = {}, timeout = 15000) {
    this._ensure();
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('O ajudante de janelas não respondeu'));
      }, timeout);
      this.pending.set(id, { resolve, reject, timer });
      this._write({ ...args, cmd, id });
    });
  }

  setOwnPids(pids) {
    this.ownPids = pids;
    if (this.proc) this._write({ cmd: 'own', pids, id: ++this.seq });
  }

  list() {
    return this.call('list');
  }
  focus(hwnd) {
    return this.call('focus', { hwnd: String(hwnd) });
  }
  close(hwnd) {
    return this.call('close', { hwnd: String(hwnd) });
  }
  startMenu() {
    return this.call('start');
  }
  // app da Store: { exe, logo, aumid } a partir do AUMID ou do .exe
  appInfo({ aumid = '', exe = '' }) {
    return this.call('appinfo', { aumid, exe }, 20000);
  }
  // o que está tocando (null = nada); a capa só vem quando muda (thumbKey = a que você já tem)
  nowPlaying(thumbKey = '') {
    return this.call('nowplaying', { thumbKey }, 8000);
  }
  // tocar/pausar, próxima, anterior direto na sessão de mídia (false = não havia o que controlar)
  mediaControl(action) {
    return this.call('mediactl', { action }, 8000);
  }
  // app da frente em tela cheia: { left, top, right, bottom } do monitor (pixels reais) ou null
  fullscreen() {
    return this.call('fullscreen', {}, 2000);
  }
  // volume do Windows: { level 0–100, muted }; passe level e/ou muted para mudar
  volume(patch = {}) {
    return this.call('volume', patch, 5000);
  }
  // algum botão do mouse apertado agora
  mouseDown() {
    return this.call('mousedown', {}, 1000);
  }
  warmUp() {
    this._ensure();
  }
  shutdown() {
    try {
      this.proc?.stdin.end(JSON.stringify({ cmd: 'quit', id: 0 }) + '\n');
    } catch {}
  }
}

module.exports = { WindowsBridge };
