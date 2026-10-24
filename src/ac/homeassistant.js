// Home Assistant: cobre praticamente qualquer marca (Midea/Springer, Gree, Daikin, Fujitsu,
// Electrolux, controles IR Broadlink...). Basta uma entidade "climate.*" e um token de longa duração.
const { http, clampTemp, sleep } = require('./common');

const MODE_TO_HA = { cool: 'cool', heat: 'heat', dry: 'dry', fan: 'fan_only', auto: 'heat_cool' };
const HA_TO_MODE = { cool: 'cool', heat: 'heat', dry: 'dry', fan_only: 'fan', heat_cool: 'auto', auto: 'auto' };
const FAN_CANDIDATES = { auto: ['auto', 'Auto'], low: ['low', 'Low', 'quiet', 'silent'], medium: ['medium', 'Medium', 'mid', 'middle'], high: ['high', 'High', 'strong', 'Strong'] };
// turbo: a predefinição padrão "boost" do Home Assistant, ou uma ventilação turbo da integração
const TURBO_FANS = ['turbo', 'Turbo', 'boost', 'Boost', 'max', 'Max', 'powerful', 'Powerful'];

module.exports = (ctx) => {
  const opts = () => ctx.settings().ac.options || {};
  const base = () => String(opts().url || 'http://homeassistant.local:8123').replace(/\/+$/, '');
  const headers = () => {
    const t = ctx.store.getSecret('ha_token');
    if (!t) throw new Error('Falta o token do Home Assistant (Configurações > Ar-condicionado).');
    return { Authorization: `Bearer ${t}` };
  };
  const service = (domain, name, data) => http(`${base()}/api/services/${domain}/${name}`, { method: 'POST', headers: headers(), body: data });

  return {
    label: 'Home Assistant',
    async list() {
      const states = await http(`${base()}/api/states`, { headers: headers() });
      return states.filter((s) => s.entity_id.startsWith('climate.')).map((s) => ({ id: s.entity_id, name: s.attributes.friendly_name || s.entity_id }));
    },
    async status(id) {
      const s = await http(`${base()}/api/states/${id}`, { headers: headers() });
      const a = s.attributes || {};
      this._modes = a.hvac_modes || [];
      this._fans = a.fan_modes || [];
      this._presets = a.preset_modes || [];
      const fanRaw = a.fan_mode || 'auto';
      const turboFan = TURBO_FANS.find((f) => this._fans.includes(f));
      this._turbo = this._presets.includes('boost') ? { kind: 'preset' } : turboFan ? { kind: 'fan', value: turboFan } : null;
      return {
        id,
        name: a.friendly_name,
        power: s.state !== 'off' && s.state !== 'unavailable',
        mode: HA_TO_MODE[s.state] || 'cool',
        temperature: a.temperature ?? null,
        roomTemperature: a.current_temperature ?? null,
        fan: Object.keys(FAN_CANDIDATES).find((f) => FAN_CANDIDATES[f].includes(fanRaw)) || (fanRaw === turboFan ? 'high' : 'auto'),
        turbo: !this._turbo ? null : this._turbo.kind === 'preset' ? a.preset_mode === 'boost' : fanRaw === turboFan,
        raw: s,
      };
    },
    async set(id, cmd) {
      if (!this._modes) await this.status(id).catch(() => {});
      if (cmd.power === false) {
        await service('climate', 'set_hvac_mode', { entity_id: id, hvac_mode: 'off' });
      } else {
        if (cmd.mode) {
          let m = MODE_TO_HA[cmd.mode];
          if (cmd.mode === 'auto' && this._modes?.length && !this._modes.includes(m)) m = 'auto';
          await service('climate', 'set_hvac_mode', { entity_id: id, hvac_mode: m });
        } else if (cmd.power === true || cmd.temperature !== undefined || cmd.fan || cmd.turbo === true) {
          const cur = await this.status(id);
          if (!cur.power) await service('climate', 'turn_on', { entity_id: id });
        }
        if (cmd.temperature !== undefined) await service('climate', 'set_temperature', { entity_id: id, temperature: clampTemp(cmd.temperature) });
        if (cmd.fan) {
          const value = FAN_CANDIDATES[cmd.fan].find((v) => (this._fans || []).includes(v)) || cmd.fan;
          await service('climate', 'set_fan_mode', { entity_id: id, fan_mode: value });
        }
        if (cmd.turbo !== undefined) {
          if (this._turbo === undefined) await this.status(id).catch(() => {});
          const t = this._turbo;
          if (!t) throw new Error('Home Assistant: essa entidade não tem turbo (nem a predefinição "boost" nem uma ventilação turbo).');
          if (t.kind === 'preset') {
            const off = this._presets.includes('none') ? 'none' : this._presets.find((p) => p !== 'boost') || 'none';
            await service('climate', 'set_preset_mode', { entity_id: id, preset_mode: cmd.turbo ? 'boost' : off });
          } else if (cmd.turbo || !cmd.fan) {
            const back = FAN_CANDIDATES.auto.find((v) => (this._fans || []).includes(v)) || (this._fans || []).find((f) => !TURBO_FANS.includes(f)) || 'auto';
            await service('climate', 'set_fan_mode', { entity_id: id, fan_mode: cmd.turbo ? t.value : back });
          }
        }
      }
      await sleep(500);
      return this.status(id);
    },
  };
};
