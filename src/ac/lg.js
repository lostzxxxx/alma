// LG ThinQ (API oficial "ThinQ Connect" com Personal Access Token).
// Token: https://connect-pat.lgthinq.com  (entre com a conta LG, crie um token com permissões de
// listar dispositivos, ver status e controlar dispositivos).
const crypto = require('crypto');
const { http, clampTemp, sleep, wantsOn } = require('./common');

const API_KEY = 'v6GFvkweNo7DK7yD3ylIZ9w52aKBU0eJ7wLXkSR3'; // chave pública do SDK oficial (Apache-2.0)
const REGION_BY_COUNTRY = { BR: 'aic', US: 'aic', CA: 'aic', MX: 'aic', AR: 'aic', CL: 'aic', CO: 'aic', PE: 'aic', PT: 'eic', ES: 'eic', DE: 'eic', FR: 'eic', IT: 'eic', GB: 'eic', KR: 'kic', JP: 'kic', IN: 'kic', AU: 'kic' };

const MODE_TO_LG = { cool: 'COOL', heat: 'HEAT', dry: 'AIR_DRY', fan: 'FAN', auto: 'AUTO' };
const LG_TO_MODE = { COOL: 'cool', HEAT: 'heat', AIR_DRY: 'dry', FAN: 'fan', AUTO: 'auto', AI: 'auto', ENERGY_SAVING: 'cool' };
const FAN_TO_LG = { auto: 'AUTO', low: 'LOW', medium: 'MID', high: 'HIGH' };
const LG_TO_FAN = { AUTO: 'auto', LOW: 'low', LOW_MID: 'low', MID: 'medium', MID_HIGH: 'high', HIGH: 'high', POWER: 'high', SLOW: 'low', NATURE: 'auto' };

module.exports = (ctx) => {
  const opts = () => ctx.settings().ac.options || {};
  const country = () => String(opts().country || 'BR').toUpperCase();
  const base = () => `https://api-${REGION_BY_COUNTRY[country()] || 'aic'}.lgthinq.com`;

  const clientId = () => {
    let id = opts().clientId;
    if (!id) {
      id = 'alma-' + crypto.randomUUID();
      const ac = ctx.settings().ac;
      ctx.store.patchSettings({ ac: { options: { ...ac.options, clientId: id } } });
    }
    return id;
  };

  const headers = (extra = {}) => {
    const token = ctx.store.getSecret('lg_pat');
    if (!token) throw new Error('Falta o token da LG (Configurações > Ar-condicionado).');
    return {
      Authorization: `Bearer ${token}`,
      'x-country': country(),
      'x-message-id': crypto.randomBytes(16).toString('base64url').slice(0, 22),
      'x-client-id': clientId(),
      'x-api-key': API_KEY,
      'x-service-phase': 'OP',
      ...extra,
    };
  };

  const call = async (path, init = {}) => {
    const res = await http(base() + path, { ...init, headers: headers(init.headers) });
    return res.response ?? res;
  };

  const control = (id, payload) =>
    call(`/devices/${encodeURIComponent(id)}/control`, { method: 'POST', body: payload, headers: { 'x-conditional-control': 'true' } });

  return {
    label: 'LG ThinQ',
    async list() {
      const res = await call('/devices');
      const list = Array.isArray(res) ? res : res.devices || [];
      return list
        .filter((d) => /AIR_CONDITIONER|SYSTEM_BOILER|AIR/i.test(d.deviceInfo?.deviceType || ''))
        .map((d) => ({ id: d.deviceId, name: d.deviceInfo?.alias || d.deviceInfo?.modelName || d.deviceId }));
    },
    async status(id) {
      const s = await call(`/devices/${encodeURIComponent(id)}/state`);
      const t = s.temperature || {};
      const tu = s.temperatureInUnits ? [].concat(s.temperatureInUnits).find((x) => x.unit === 'C') || {} : {};
      return {
        id,
        power: (s.operation?.airConOperationMode || '').toUpperCase() === 'POWER_ON',
        mode: LG_TO_MODE[s.airConJobMode?.currentJobMode] || 'cool',
        temperature: t.targetTemperature ?? tu.targetTemperatureC ?? tu.targetTemperature ?? null,
        roomTemperature: t.currentTemperature ?? tu.currentTemperatureC ?? tu.currentTemperature ?? null,
        fan: LG_TO_FAN[s.airFlow?.windStrength || s.airFlow?.windStrengthDetail] || 'auto',
        // turbo da LG = modo Jato (ventilação "POWER")
        turbo: (s.airFlow?.windStrength || s.airFlow?.windStrengthDetail || '') === 'POWER',
        raw: s,
      };
    },
    async set(id, cmd) {
      // A API da LG aceita um recurso por requisição.
      if (cmd.power === false) {
        await control(id, { operation: { airConOperationMode: 'POWER_OFF' } });
        return this.status(id);
      }
      if (wantsOn(cmd)) {
        const cur = await this.status(id).catch(() => null);
        if (!cur || !cur.power) {
          await control(id, { operation: { airConOperationMode: 'POWER_ON' } });
          await sleep(1200);
        }
      }
      if (cmd.mode) await control(id, { airConJobMode: { currentJobMode: MODE_TO_LG[cmd.mode] } });
      if (cmd.temperature !== undefined) {
        const t = clampTemp(cmd.temperature);
        try {
          await control(id, { temperature: { targetTemperature: t, unit: 'C' } });
        } catch {
          await control(id, { temperatureInUnits: { targetTemperatureC: t, unit: 'C' } });
        }
      }
      // turbo ligado = ventilação POWER (Jato); desligado = volta para a ventilação pedida ou automática
      const wind = cmd.turbo === true ? 'POWER' : cmd.fan ? FAN_TO_LG[cmd.fan] : cmd.turbo === false ? 'AUTO' : null;
      if (wind) {
        try {
          await control(id, { airFlow: { windStrength: wind } });
        } catch (e) {
          try {
            await control(id, { airFlow: { windStrengthDetail: wind } });
          } catch {
            if (cmd.turbo) throw new Error('LG ThinQ: esse ar não aceitou o modo Jato/Turbo.');
            throw e;
          }
        }
      }
      await sleep(600);
      return this.status(id);
    },
  };
};
