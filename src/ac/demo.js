// Ar de demonstração: guarda o estado localmente, para testar a interface e os comandos de voz.
const { clampTemp } = require('./common');

module.exports = (ctx) => {
  const get = () => ({ power: false, mode: 'cool', temperature: 23, fan: 'auto', turbo: false, roomTemperature: 27, ...ctx.store.get('demoAc') });
  return {
    label: 'Demonstração (simulado)',
    async list() {
      return [{ id: 'demo', name: 'Ar da sala (demo)' }];
    },
    async status() {
      return { id: 'demo', name: 'Ar da sala (demo)', ...get() };
    },
    async set(_id, cmd) {
      const s = get();
      if (cmd.power !== undefined) s.power = Boolean(cmd.power);
      if (cmd.mode) s.mode = cmd.mode;
      if (cmd.fan) {
        s.fan = cmd.fan;
        s.turbo = false; // como nos aparelhos de verdade: mexer na ventilação sai do turbo
      }
      if (cmd.turbo !== undefined) {
        s.turbo = Boolean(cmd.turbo);
        if (s.turbo) s.power = true;
      }
      if (!s.power) s.turbo = false;
      if (cmd.temperature !== undefined) s.temperature = clampTemp(cmd.temperature);
      ctx.store.set('demoAc', s);
      return this.status();
    },
  };
};
