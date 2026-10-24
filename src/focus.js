// Temporizador e foco: sessões de foco com pausas (pomodoro), contagem regressiva e cronômetro.
// Mora no processo principal, para continuar contando com o painel fechado; a ilha recebe o estado a cada segundo.
//   pomodoro: foco → pausa curta → foco … → pausa longa a cada N rodadas (tempos em Configurações › Módulos)
//   timer:    contagem regressiva de X minutos
//   watch:    cronômetro (conta para cima)
const { EventEmitter } = require('events');

const DEFAULTS = { focusMin: 25, shortMin: 5, longMin: 15, rounds: 4, autoBreak: true, autoFocus: false, sleep: true, silent: true, sound: true };

class Focus extends EventEmitter {
  constructor(store) {
    super();
    this.store = store;
    this.s = { mode: 'pomodoro', phase: 'idle', running: false, round: 1, total: 0, left: 0, elapsed: 0, timerMin: 10 };
    this.endsAt = 0;
    this.startedAt = 0;
    this.timer = setInterval(() => this._tick(), 1000);
  }

  opts() {
    return { ...DEFAULTS, ...(this.store.settings().focus || {}) };
  }

  state() {
    const s = { ...this.s };
    if (s.running && s.mode !== 'watch') s.left = Math.max(0, this.endsAt - Date.now());
    if (s.running && s.mode === 'watch') s.elapsed = this.s.elapsed + (Date.now() - this.startedAt);
    return { ...s, opts: this.opts(), now: Date.now() };
  }

  // fase de foco em andamento (a Alminha dorme e os avisos ficam quietos, se escolhido)
  focusing() {
    return this.s.running && (this.s.phase === 'focus' || this.s.phase === 'timer');
  }

  _emit() {
    this.emit('state', this.state());
  }

  _phaseMs(phase) {
    const o = this.opts();
    return { focus: o.focusMin, short: o.shortMin, long: o.longMin, timer: this.s.timerMin }[phase] * 60000;
  }

  _begin(phase) {
    const ms = this._phaseMs(phase);
    this.s = { ...this.s, phase, running: true, total: ms, left: ms };
    this.endsAt = Date.now() + ms;
    this.emit('phase', phase);
    this._emit();
  }

  start(mode = this.s.mode, opts = {}) {
    if (opts.minutes) this.s.timerMin = Math.max(1, Math.min(600, Number(opts.minutes)));
    this.s.mode = mode;
    if (mode === 'watch') {
      this.s = { ...this.s, phase: 'watch', running: true, elapsed: 0, total: 0 };
      this.startedAt = Date.now();
      this._emit();
      return this.state();
    }
    if (mode === 'timer') this._begin('timer');
    else {
      this.s.round = 1;
      this._begin('focus');
    }
    return this.state();
  }

  pause() {
    if (!this.s.running) return this.state();
    if (this.s.mode === 'watch') this.s.elapsed += Date.now() - this.startedAt;
    else this.s.left = Math.max(0, this.endsAt - Date.now());
    this.s.running = false;
    this._emit();
    return this.state();
  }

  resume() {
    if (this.s.running || this.s.phase === 'idle') return this.state();
    this.s.running = true;
    if (this.s.mode === 'watch') this.startedAt = Date.now();
    else this.endsAt = Date.now() + this.s.left;
    this._emit();
    return this.state();
  }

  stop() {
    const was = this.s.phase;
    this.s = { ...this.s, phase: 'idle', running: false, left: 0, total: 0, elapsed: 0, round: 1 };
    if (was !== 'idle') this.emit('phase', 'idle');
    this._emit();
    return this.state();
  }

  // pula para a próxima fase (no pomodoro) ou termina (timer)
  skip() {
    if (this.s.phase === 'idle') return this.state();
    this._finish(true);
    return this.state();
  }

  // muda os minutos da contagem regressiva (com ela parada)
  setTimer(min) {
    this.s.timerMin = Math.max(1, Math.min(600, Math.round(Number(min) || 1)));
    this._emit();
    return this.state();
  }

  _finish(skipped) {
    const o = this.opts();
    const phase = this.s.phase;
    this.emit('done', { phase, skipped, round: this.s.round });
    if (this.s.mode === 'timer') return this.stop();
    if (phase === 'focus') {
      const long = this.s.round % o.rounds === 0;
      this._begin(long ? 'long' : 'short');
      if (!o.autoBreak) this.pause();
    } else {
      this.s.round = phase === 'long' ? 1 : this.s.round + 1;
      this._begin('focus');
      if (!o.autoFocus) this.pause();
    }
  }

  _tick() {
    if (!this.s.running) return;
    if (this.s.mode !== 'watch' && Date.now() >= this.endsAt) this._finish(false);
    else this._emit();
  }
}

module.exports = { Focus, FOCUS_DEFAULTS: DEFAULTS };
