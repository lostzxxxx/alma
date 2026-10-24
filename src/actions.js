// Alma Actions: pequenas automações sem programar — "Quando <algo acontecer>, fazer <isto e aquilo>".
// Cada ação pode "desfazer quando terminar": ao fechar o app / sair da tela cheia / acabar o foco, volta tudo
// como estava (o volume de antes, a ilha à vista, o modo silencioso desligado…).
//
//   quando: app_open {app} · app_close {app} · fullscreen · focus_start · focus_end · alma_start
//   fazer:  volume {level} · mute {on} · silent {on} · island {show} · focus {start} · open_app {name}
//           open_site {url} · media {action} · ac {power, temperature} · notify {text}
const { EventEmitter } = require('events');
const path = require('path');
const crypto = require('crypto');

const exeOf = (p) => path.basename(String(p || '')).toLowerCase();

// modelos prontos (Configurações › Ações › "Começar de um modelo")
const TEMPLATES = [
  {
    name: 'Jogando',
    when: { type: 'fullscreen' },
    do: [{ type: 'volume', level: 35 }, { type: 'silent', on: true }, { type: 'island', show: false }],
    undo: true,
  },
  {
    name: 'Hora de focar',
    when: { type: 'focus_start' },
    do: [{ type: 'silent', on: true }, { type: 'volume', level: 25 }],
    undo: true,
  },
  {
    name: 'Bom dia, Alma',
    when: { type: 'alma_start' },
    do: [{ type: 'notify', text: 'Bom dia! Que tal começar pelas tarefas?' }],
    undo: false,
  },
];

class Actions extends EventEmitter {
  constructor({ store, win, focus, system, ctx }) {
    super();
    this.store = store;
    this.win = win;
    this.focus = focus;
    this.system = system;
    this.ctx = ctx; // { silent(), setSilent(on), islandShown(), setIsland(show), notify(text), ac(cmd) }
    this.prevExes = null;
    this.prevFull = false;
    this.active = {}; // id da ação → passos para desfazer
    this.busy = false;
  }

  list() {
    return this.store.get('automations') || [];
  }

  save(list) {
    const clean = (Array.isArray(list) ? list : []).map((r) => ({
      id: r.id || crypto.randomUUID(),
      name: String(r.name || 'Ação').slice(0, 60),
      on: r.on !== false,
      when: r.when || { type: 'alma_start' },
      do: Array.isArray(r.do) ? r.do.slice(0, 12) : [],
      undo: Boolean(r.undo),
    }));
    this.store.set('automations', clean);
    return clean;
  }

  start() {
    setInterval(() => this.poll().catch(() => {}), 2500);
    setTimeout(() => this.trigger('alma_start'), 4000);
    this.focus.on('phase', (p) => {
      if (p === 'focus' || p === 'timer') this.trigger('focus_start');
      if (p === 'short' || p === 'long' || p === 'idle') this.trigger('focus_end', true);
    });
  }

  // eventos sem app: dispara as do tipo; "end" desfaz as de começo (foco acabou → desfaz "começar o foco")
  trigger(type, end) {
    for (const r of this.list().filter((x) => x.on)) {
      if (r.when.type === type) this.fire(r);
      if (end && type === 'focus_end' && r.when.type === 'focus_start' && r.undo) this.revert(r);
    }
  }

  async poll() {
    const rules = this.list().filter((r) => r.on);
    if (!rules.length || this.busy) return;
    this.busy = true;
    try {
      if (rules.some((r) => r.when.type === 'app_open' || r.when.type === 'app_close')) {
        const l = await this.win.list();
        const exes = new Set((l.windows || []).map((w) => exeOf(w.exe)));
        // na primeira olhada só anota o que já estava aberto (não dispara por apps que já estavam rodando)
        if (this.prevExes) {
          for (const r of rules) {
            const exe = exeOf(r.when.app?.exe);
            if (!exe) continue;
            const opened = exes.has(exe) && !this.prevExes.has(exe);
            const closed = !exes.has(exe) && this.prevExes.has(exe);
            if (r.when.type === 'app_open' && opened) this.fire(r);
            if (r.when.type === 'app_open' && closed && r.undo) this.revert(r);
            if (r.when.type === 'app_close' && closed) this.fire(r);
          }
        }
        this.prevExes = exes;
      }
      if (rules.some((r) => r.when.type === 'fullscreen')) {
        const full = Boolean(await this.win.fullscreen().catch(() => null));
        if (full !== this.prevFull) {
          for (const r of rules.filter((x) => x.when.type === 'fullscreen')) full ? this.fire(r) : r.undo && this.revert(r);
        }
        this.prevFull = full;
      }
    } finally {
      this.busy = false;
    }
  }

  async fire(rule) {
    if (this.active[rule.id]) return; // já está valendo
    const undo = [];
    for (const a of rule.do) {
      try {
        const u = await this.run(a);
        if (u) undo.push(u);
      } catch (e) {
        this.emit('error', rule, e);
      }
    }
    if (rule.undo) this.active[rule.id] = undo;
    this.emit('ran', rule);
  }

  async revert(rule) {
    const steps = this.active[rule.id];
    if (!steps) return;
    delete this.active[rule.id];
    for (const u of steps.reverse()) await this.run(u).catch(() => {});
    this.emit('reverted', rule);
  }

  // roda um passo e devolve como desfazê-lo
  async run(a) {
    switch (a.type) {
      case 'volume': {
        const before = await this.win.volume();
        await this.win.volume({ level: Number(a.level) });
        return { type: 'volume', level: before.level };
      }
      case 'mute': {
        const before = await this.win.volume();
        await this.win.volume({ muted: Boolean(a.on) });
        return { type: 'mute', on: before.muted };
      }
      case 'silent': {
        const before = this.ctx.silent();
        this.ctx.setSilent(Boolean(a.on));
        return { type: 'silent', on: before };
      }
      case 'island': {
        const before = this.ctx.islandShown();
        this.ctx.setIsland(Boolean(a.show));
        return { type: 'island', show: before };
      }
      case 'focus':
        if (a.start) {
          this.focus.start(a.mode || 'pomodoro', { minutes: a.minutes });
          return { type: 'focus', start: false };
        }
        this.focus.stop();
        return null;
      case 'open_app':
        await this.system.openApp(a.name);
        return null;
      case 'open_site':
        await this.system.openUrl(a.url);
        return null;
      case 'media':
        // direto no player (GSMTC) quando dá; senão a tecla de mídia
        if (!(await this.win.mediaControl(a.action || 'play_pause').catch(() => false))) await this.system.media(a.action || 'play_pause');
        return null;
      case 'ac':
        await this.ctx.ac(a.power === false ? { power: false } : { power: true, ...(a.temperature ? { temperature: Number(a.temperature) } : {}) });
        return null;
      case 'notify':
        this.ctx.notify(String(a.text || 'Alma Actions'));
        return null;
      default:
        return null;
    }
  }

  // "Testar" nas Configurações: roda agora e desfaz em 6 s (se a ação desfaz)
  async test(rule) {
    await this.fire({ ...rule, id: 'teste-' + rule.id });
    if (rule.undo) setTimeout(() => this.revert({ id: 'teste-' + rule.id }), 6000);
  }
}

module.exports = { Actions, TEMPLATES };
