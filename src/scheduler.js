// Tarefas agendadas (uma vez) e rotinas (todo dia / dias da semana).
// Cada item guarda uma lista de ações { tool, args } executadas sem precisar da IA.
const { EventEmitter } = require('events');
const crypto = require('crypto');

const DAY_NAMES = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const pad = (n) => String(n).padStart(2, '0');
const today = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

class Scheduler extends EventEmitter {
  constructor(store, runAction) {
    super();
    this.store = store;
    this.runAction = runAction; // async ({tool,args}) => result
    this.timer = null;
  }

  start() {
    this.timer = setInterval(() => this.tick(), 15000);
    setTimeout(() => this.tick(), 3000);
  }

  list() {
    return this.store.get('schedules');
  }

  addOnce({ at, actions, description }) {
    const when = new Date(at);
    if (Number.isNaN(when.getTime())) throw new Error('Data/hora inválida: ' + at);
    const item = { id: crypto.randomUUID().slice(0, 8), kind: 'once', at: when.toISOString(), actions, description: description || '' };
    this.store.update('schedules', (l) => [...l, item]);
    return item;
  }

  addRoutine({ time, days, actions, description }) {
    if (!/^\d{1,2}:\d{2}$/.test(time)) throw new Error('Horário deve ser HH:MM');
    const [h, m] = time.split(':').map(Number);
    const d = Array.isArray(days) && days.length ? days.map(Number).filter((x) => x >= 0 && x <= 6) : [0, 1, 2, 3, 4, 5, 6];
    const item = { id: crypto.randomUUID().slice(0, 8), kind: 'routine', time: `${pad(h)}:${pad(m)}`, days: d, actions, description: description || '', lastRun: null };
    this.store.update('schedules', (l) => [...l, item]);
    return item;
  }

  remove(id) {
    const before = this.list().length;
    this.store.update('schedules', (l) => l.filter((s) => s.id !== id));
    return before !== this.list().length;
  }

  describe(s) {
    if (s.kind === 'once') return `${new Date(s.at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`;
    const days = s.days.length === 7 ? 'todo dia' : s.days.map((d) => DAY_NAMES[d]).join(', ');
    return `${days} às ${s.time}`;
  }

  async run(item) {
    const results = [];
    for (const a of item.actions || []) {
      try {
        results.push({ tool: a.tool, ok: true, result: await this.runAction(a) });
      } catch (e) {
        results.push({ tool: a.tool, ok: false, error: e.message });
      }
    }
    this.emit('ran', item, results);
    return results;
  }

  async tick() {
    const now = new Date();
    const hhmm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const due = [];
    for (const s of this.list()) {
      if (s.kind === 'once' && new Date(s.at) <= now) due.push(s);
      if (s.kind === 'routine' && s.days.includes(now.getDay()) && s.lastRun !== today(now)) {
        // roda no minuto certo ou até 10 min depois (se o PC estava dormindo)
        const [h, m] = s.time.split(':').map(Number);
        const diff = (now.getHours() * 60 + now.getMinutes()) - (h * 60 + m);
        if (hhmm === s.time || (diff > 0 && diff <= 10)) due.push(s);
      }
    }
    if (!due.length) return;
    this.store.update('schedules', (l) =>
      l
        .filter((s) => !(s.kind === 'once' && due.some((d) => d.id === s.id)))
        .map((s) => (s.kind === 'routine' && due.some((d) => d.id === s.id) ? { ...s, lastRun: today(now) } : s)),
    );
    for (const item of due) await this.run(item);
  }
}

module.exports = { Scheduler };
