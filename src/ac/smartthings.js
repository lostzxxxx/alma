// Samsung SmartThings (e outras marcas que aparecem no app SmartThings).
// Dois jeitos de autenticar:
//  1) Token pessoal (https://account.smartthings.com/tokens) — tokens novos valem 24 h.
//  2) OAuth (app criado com a SmartThings CLI) — a Alma renova o acesso sozinha.
const { http, clampTemp, sleep, wantsOn } = require('./common');

const API = 'https://api.smartthings.com/v1';
const TOKEN_URL = 'https://auth-global.api.smartthings.com/oauth/token';
const FAN_TO_ST = { auto: 'auto', low: 'low', medium: 'medium', high: 'high' };

module.exports = (ctx) => {
  const opts = () => ctx.settings().ac.options || {};

  async function oauthToken(params) {
    const { clientId } = opts();
    const secret = ctx.store.getSecret('st_client_secret');
    const res = await http(TOKEN_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + Buffer.from(`${clientId}:${secret}`).toString('base64'),
      },
      body: new URLSearchParams({ client_id: clientId, ...params }).toString(),
    });
    ctx.store.setSecret('st_access', res.access_token);
    if (res.refresh_token) ctx.store.setSecret('st_refresh', res.refresh_token);
    ctx.store.patchSettings({ ac: { options: { ...opts(), stExpires: Date.now() + (res.expires_in || 86399) * 1000 } } });
    return res.access_token;
  }

  async function token() {
    if (opts().authMode === 'oauth') {
      const refresh = ctx.store.getSecret('st_refresh');
      if (!refresh) throw new Error('SmartThings OAuth ainda não conectado (Configurações > Ar-condicionado).');
      if (ctx.store.getSecret('st_access') && Date.now() < (opts().stExpires || 0) - 60000) return ctx.store.getSecret('st_access');
      return oauthToken({ grant_type: 'refresh_token', refresh_token: refresh });
    }
    const pat = ctx.store.getSecret('st_pat');
    if (!pat) throw new Error('Falta o token do SmartThings (Configurações > Ar-condicionado).');
    return pat;
  }

  const call = async (path, init = {}) => http(API + path, { ...init, headers: { Authorization: `Bearer ${await token()}` } });

  const send = (id, commands) =>
    call(`/devices/${encodeURIComponent(id)}/commands`, {
      method: 'POST',
      body: { commands: commands.map((c) => ({ component: 'main', ...c })) },
    });

  const v = (comp, cap, attr) => comp?.[cap]?.[attr]?.value;

  return {
    label: 'Samsung SmartThings',
    // Troca o "code" do OAuth por tokens (chamado pela tela de configurações).
    async exchangeCode(code, redirectUri) {
      await oauthToken({ grant_type: 'authorization_code', code, redirect_uri: redirectUri });
      return { ok: true };
    },
    authorizeUrl(redirectUri) {
      const p = new URLSearchParams({
        client_id: opts().clientId || '',
        response_type: 'code',
        redirect_uri: redirectUri,
        scope: 'r:devices:* x:devices:*',
      });
      return `https://api.smartthings.com/oauth/authorize?${p}`;
    },
    async list() {
      const res = await call('/devices?capability=airConditionerMode');
      return (res.items || []).map((d) => ({ id: d.deviceId, name: d.label || d.name }));
    },
    async status(id) {
      const res = await call(`/devices/${encodeURIComponent(id)}/status`);
      const m = res.components?.main || {};
      const mode = String(v(m, 'airConditionerMode', 'airConditionerMode') || 'cool');
      this._supported = v(m, 'airConditionerMode', 'supportedAcModes') || [];
      // turbo da Samsung = modo opcional "speed" (Rápido)
      const optional = v(m, 'custom.airConditionerOptionalMode', 'supportedAcOptionalMode') || [];
      this._turbo = optional.includes('speed');
      return {
        id,
        power: v(m, 'switch', 'switch') === 'on',
        mode: { cool: 'cool', heat: 'heat', dry: 'dry', wind: 'fan', fanOnly: 'fan', fan: 'fan', auto: 'auto', aIComfort: 'auto' }[mode] || mode,
        temperature: v(m, 'thermostatCoolingSetpoint', 'coolingSetpoint') ?? null,
        roomTemperature: v(m, 'temperatureMeasurement', 'temperature') ?? null,
        fan: v(m, 'airConditionerFanMode', 'fanMode') || 'auto',
        turbo: this._turbo ? v(m, 'custom.airConditionerOptionalMode', 'acOptionalMode') === 'speed' : null,
        raw: m,
      };
    },
    async set(id, cmd) {
      const cmds = [];
      if (cmd.power === false) cmds.push({ capability: 'switch', command: 'off' });
      else if (wantsOn(cmd)) cmds.push({ capability: 'switch', command: 'on' });
      if (cmd.power !== false) {
        if (cmd.mode) {
          if (!this._supported) await this.status(id).catch(() => {});
          const sup = this._supported || [];
          let m = cmd.mode;
          if (m === 'fan') m = sup.includes('wind') ? 'wind' : sup.includes('fanOnly') ? 'fanOnly' : 'fan';
          cmds.push({ capability: 'airConditionerMode', command: 'setAirConditionerMode', arguments: [m] });
        }
        if (cmd.temperature !== undefined)
          cmds.push({ capability: 'thermostatCoolingSetpoint', command: 'setCoolingSetpoint', arguments: [clampTemp(cmd.temperature)] });
        if (cmd.fan) cmds.push({ capability: 'airConditionerFanMode', command: 'setFanMode', arguments: [FAN_TO_ST[cmd.fan]] });
        if (cmd.turbo !== undefined) {
          if (this._turbo === undefined) await this.status(id).catch(() => {});
          if (!this._turbo) throw new Error('SmartThings: esse ar não tem o modo Rápido/Turbo.');
          cmds.push({ capability: 'custom.airConditionerOptionalMode', command: 'setAcOptionalMode', arguments: [cmd.turbo ? 'speed' : 'off'] });
        }
      }
      if (cmds.length) await send(id, cmds);
      await sleep(800);
      return this.status(id);
    },
  };
};
