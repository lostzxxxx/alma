// Gerenciador do ar-condicionado: escolhe o driver configurado e o aparelho certo.
const { MODES, FANS } = require('./common');
const { norm } = require('../system');

const DRIVERS = {
  demo: require('./demo'),
  lg: require('./lg'),
  smartthings: require('./smartthings'),
  tuya: require('./tuya'),
  homeassistant: require('./homeassistant'),
};

class AirConditioner {
  constructor(store) {
    this.store = store;
    this.ctx = { store, settings: () => store.settings() };
    this.instances = {};
    this.devices = [];
  }

  driverName() {
    return this.store.settings().ac.driver || 'demo';
  }

  driver(name = this.driverName()) {
    if (!DRIVERS[name]) throw new Error('Driver de ar desconhecido: ' + name);
    if (!this.instances[name]) this.instances[name] = DRIVERS[name](this.ctx);
    return this.instances[name];
  }

  reset() {
    this.instances = {};
    this.devices = [];
  }

  async list() {
    this.devices = await this.driver().list();
    return this.devices;
  }

  async resolve(device) {
    if (!this.devices.length) await this.list();
    if (!this.devices.length) throw new Error('Nenhum ar-condicionado encontrado nessa conta.');
    if (device) {
      const q = norm(device);
      const hit =
        this.devices.find((d) => d.id === device) ||
        this.devices.find((d) => norm(d.name) === q) ||
        this.devices.find((d) => norm(d.name).includes(q) || q.includes(norm(d.name)));
      if (hit) return hit;
    }
    const def = this.store.settings().ac.defaultDevice;
    return this.devices.find((d) => d.id === def) || this.devices[0];
  }

  async status(device) {
    const d = await this.resolve(device);
    const s = await this.driver().status(d.id);
    return { ...s, id: d.id, name: s.name || d.name };
  }

  async set(device, cmd) {
    const clean = {};
    if (cmd.power !== undefined && cmd.power !== null) clean.power = cmd.power === true || cmd.power === 'on' || cmd.power === 'true';
    if (cmd.mode) {
      if (!MODES.includes(cmd.mode)) throw new Error('Modo inválido: ' + cmd.mode);
      clean.mode = cmd.mode;
    }
    if (cmd.fan) {
      if (!FANS.includes(cmd.fan)) throw new Error('Ventilação inválida: ' + cmd.fan);
      clean.fan = cmd.fan;
    }
    if (cmd.temperature !== undefined && cmd.temperature !== null && cmd.temperature !== '') clean.temperature = Number(cmd.temperature);
    if (cmd.turbo !== undefined && cmd.turbo !== null) clean.turbo = cmd.turbo === true || cmd.turbo === 'on' || cmd.turbo === 'true';
    if (cmd.temperature_delta) {
      const cur = await this.status(device);
      clean.temperature = Number(cur.temperature || 23) + Number(cmd.temperature_delta);
    }
    const d = await this.resolve(device);
    const s = await this.driver().set(d.id, clean);
    return { ...s, id: d.id, name: s.name || d.name };
  }
}

module.exports = { AirConditioner, DRIVERS };
