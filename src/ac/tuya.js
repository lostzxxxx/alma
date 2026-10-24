// Smart Life / Tuya (Elgin, Philco, TCL, controles IR Wi-Fi e muitas outras marcas "genéricas").
// Usa a Tuya Cloud API: crie um projeto em https://platform.tuya.com, vincule sua conta Smart Life
// (Devices > Link App Account) e copie Access ID e Access Secret.
const crypto = require('crypto');
const { http, clampTemp, sleep, wantsOn } = require('./common');

const REGIONS = {
  us: 'https://openapi.tuyaus.com', // América Ocidental (padrão para contas do Brasil)
  ueaz: 'https://openapi-ueaz.tuyaus.com', // América Oriental
  eu: 'https://openapi.tuyaeu.com',
  weaz: 'https://openapi-weaz.tuyaeu.com',
  in: 'https://openapi.tuyain.com',
  cn: 'https://openapi.tuyacn.com',
};

const MODE_CANDIDATES = {
  cool: ['cold', 'cool', 'COOL'],
  heat: ['hot', 'heat', 'HEAT'],
  dry: ['wet', 'dehumidification', 'dry', 'DRY'],
  fan: ['wind', 'fan', 'FAN', 'fan_only'],
  auto: ['auto', 'AUTO', 'smart'],
};
const FAN_CANDIDATES = { auto: ['auto'], low: ['low', 'level_1', '1'], medium: ['mid', 'middle', 'medium', 'level_2', '2'], high: ['high', 'level_3', '3', 'strong'] };
// Turbo: cada fabricante dá um nome. Primeiro procura uma função liga/desliga; se não houver,
// uma velocidade de ventilação "turbo".
const TURBO_SWITCHES = ['boost', 'turbo', 'turbo_mode', 'powerful', 'strong', 'strong_wind', 'super', 'super_wind', 'super_mode', 'jet', 'speed_up', 'quick_cool', 'rapid', 'fast'];
const TURBO_FAN_VALUES = ['turbo', 'super', 'max', 'powerful', 'boost'];

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

// Categorias Tuya de ar-condicionado (kt = ar nativo Wi-Fi, ex.: Elgin Eco Inverter Wi-Fi)
const AC_CATEGORIES = new Set(['kt', 'ktkzq', 'infrared_ac', 'qt', 'kj']);

// Erros comuns da Tuya Cloud em português, com a dica de como resolver.
function tuyaError(res) {
  const code = Number(res?.code);
  const tips = {
    1004: 'Access Secret errado (assinatura inválida). Copie de novo o Access Secret do projeto.',
    1005: 'Access ID errado. Copie de novo o Access ID do projeto.',
    1010: 'Token da Tuya expirou; tente de novo.',
    1106: 'Sem permissão para esse aparelho. Vincule sua conta Smart Life ao projeto (Devices › Link App Account).',
    1114: 'Access ID inválido.',
    2008: 'Comando não suportado por esse aparelho.',
    28841002: 'Data center errado ou desativado. Troque o data center (o mesmo escolhido ao criar o projeto).',
    28841101: 'O serviço "IoT Core" do projeto expirou. Renove em platform.tuya.com › Cloud › Cloud Services › IoT Core (é grátis).',
    28841105: 'O projeto não tem acesso a essa API. Em Cloud › Project › Service API, autorize "IoT Core".',
  };
  let tip = tips[code];
  if (!tip && /client_?id/i.test(res?.msg || '')) tip = tips[1005];
  if (!tip && /sign/i.test(res?.msg || '')) tip = tips[1004];
  return new Error('Smart Life: ' + (tip || res?.msg || `erro ${res?.code}`));
}

module.exports = (ctx) => {
  const opts = () => ctx.settings().ac.options || {};
  const region = () => (REGIONS[opts().region] ? opts().region : 'us');
  const base = () => REGIONS[region()];
  let tok = null; // { access, expires, region }
  const specCache = new Map();

  function sign(method, path, body, accessToken = '') {
    const clientId = opts().accessId;
    const secret = ctx.store.getSecret('tuya_secret');
    if (!clientId || !secret) throw new Error('Falta Access ID / Access Secret da Tuya (Configurações > Ar-condicionado).');
    const t = Date.now().toString();
    const nonce = crypto.randomUUID();
    const [p, q] = path.split('?');
    const sortedQuery = q ? '?' + q.split('&').sort().join('&') : '';
    const stringToSign = [method, sha256(body || ''), '', p + sortedQuery].join('\n');
    const signature = crypto.createHmac('sha256', secret).update(clientId + accessToken + t + nonce + stringToSign).digest('hex').toUpperCase();
    const h = { client_id: clientId, sign: signature, t, nonce, sign_method: 'HMAC-SHA256' };
    if (accessToken) h.access_token = accessToken;
    return h;
  }

  async function accessToken() {
    if (tok && tok.region === region() && Date.now() < tok.expires - 60000) return tok.access;
    const path = '/v1.0/token?grant_type=1';
    const res = await http(base() + path, { headers: sign('GET', path, '') });
    if (!res.success) throw tuyaError(res);
    tok = { access: res.result.access_token, expires: Date.now() + res.result.expire_time * 1000, region: region() };
    return tok.access;
  }

  async function call(method, path, body, retry = true) {
    const at = await accessToken();
    const b = body === undefined ? '' : JSON.stringify(body);
    const res = await http(base() + path, { method, headers: sign(method, path, b, at), body: b || undefined });
    if (!res.success) {
      if (Number(res.code) === 1010 && retry) {
        tok = null;
        return call(method, path, body, false);
      }
      throw tuyaError(res);
    }
    return res.result;
  }

  // Lista os aparelhos vinculados ao projeto (tenta as duas APIs da Tuya).
  async function listDevices() {
    try {
      const res = await call('GET', '/v2.0/cloud/thing/device?page_size=20');
      const list = Array.isArray(res) ? res : res?.list || [];
      if (list.length) return list.map((d) => ({ id: d.id, name: d.customName || d.name || d.id, category: d.category }));
    } catch (e) {
      if (/Access (ID|Secret)|Data center|IoT Core/.test(e.message)) throw e;
    }
    const res = await call('GET', '/v1.0/iot-01/associated-users/devices?size=50');
    const list = res?.devices || res?.list || [];
    return list.map((d) => ({ id: d.id, name: d.name || d.id, category: d.category }));
  }

  async function spec(id) {
    if (!specCache.has(id)) {
      const s = await call('GET', `/v1.0/iot-03/devices/${id}/specification`);
      const fns = {};
      for (const f of s.functions || []) {
        let values = {};
        try {
          values = JSON.parse(f.values || '{}');
        } catch {}
        fns[f.code] = { type: f.type, values };
      }
      specCache.set(id, fns);
    }
    return specCache.get(id);
  }

  const pick = (fns, codes) => codes.find((c) => fns[c]);
  const FAN_CODES = ['fan_speed_enum', 'windspeed', 'fan_speed'];

  // Como ligar o turbo neste aparelho: { kind: 'switch', code } | { kind: 'fan', code, value } | null
  function turboWay(fns, s = {}) {
    const sw = TURBO_SWITCHES.find((c) => fns[c]?.type === 'Boolean' || (!fns[c] && typeof s[c] === 'boolean'));
    if (sw) return { kind: 'switch', code: sw };
    const fanCode = pick(fns, FAN_CODES);
    const value = fanCode && TURBO_FAN_VALUES.find((v) => (fns[fanCode]?.values?.range || []).includes(v));
    return value ? { kind: 'fan', code: fanCode, value } : null;
  }

  return {
    label: 'Smart Life / Tuya',
    // só leitura: funções que o aparelho anuncia e o estado atual (para diagnóstico)
    async inspect(id) {
      const fns = await spec(id).catch((e) => ({ erro: e.message }));
      const st = await call('GET', `/v1.0/iot-03/devices/${id}/status`).catch((e) => [{ code: 'erro', value: e.message }]);
      return { functions: fns, status: Object.fromEntries(st.map((x) => [x.code, x.value])) };
    },
    async list() {
      const manual = opts().deviceId;
      let all;
      try {
        all = await listDevices();
      } catch (e) {
        if (manual) return [{ id: manual, name: 'Ar-condicionado' }];
        throw e;
      }
      if (!all.length && manual) return [{ id: manual, name: 'Ar-condicionado' }];
      if (!all.length)
        throw new Error('Smart Life: nenhum aparelho no projeto. Vincule sua conta Smart Life (Devices › Link App Account) e confira o data center.');
      const acs = all.filter((d) => AC_CATEGORIES.has(d.category));
      return (acs.length ? acs : all).map(({ id, name, category }) => ({ id, name: category === 'infrared_ac' ? `${name} (infravermelho)` : name }));
    },
    async status(id) {
      const fns = await spec(id).catch(() => ({}));
      const list = await call('GET', `/v1.0/iot-03/devices/${id}/status`).catch((e) => {
        if (/Access|Data center|IoT Core/.test(e.message)) throw e;
        return call('GET', `/v1.0/devices/${id}/status`);
      });
      const s = Object.fromEntries(list.map((x) => [x.code, x.value]));
      const tempCode = pick(s, ['temp_set', 'temp_set_f', 'T', 'set_temp']);
      const scale = fns[tempCode]?.values?.scale ?? (s[tempCode] > 100 ? 1 : 0);
      const curCode = pick(s, ['temp_current', 'temp_indoor', 'current_temp']);
      const curScale = s[curCode] > 100 ? 1 : 0;
      const modeRaw = String(s.mode ?? '');
      const mode = Object.keys(MODE_CANDIDATES).find((m) => MODE_CANDIDATES[m].includes(modeRaw)) || 'cool';
      const fanRaw = String(s.fan_speed_enum ?? s.windspeed ?? s.fan_speed ?? '');
      const fan = Object.keys(FAN_CANDIDATES).find((f) => FAN_CANDIDATES[f].includes(fanRaw)) || 'auto';
      const tw = turboWay(fns, s);
      const turbo = !tw ? null : tw.kind === 'switch' ? Boolean(s[tw.code]) : fanRaw === tw.value;
      return {
        id,
        power: Boolean(s.switch ?? s.Power ?? s.power),
        mode,
        temperature: tempCode ? s[tempCode] / 10 ** scale : null,
        roomTemperature: curCode ? s[curCode] / 10 ** curScale : null,
        fan: turbo && tw.kind === 'fan' ? 'high' : fan,
        turbo,
        raw: s,
      };
    },
    async set(id, cmd) {
      const fns = await spec(id).catch(() => ({}));
      const commands = [];
      const powerCode = pick(fns, ['switch', 'Power', 'power']) || 'switch';
      if (cmd.power === false) commands.push({ code: powerCode, value: false });
      else if (wantsOn(cmd)) commands.push({ code: powerCode, value: true });
      if (cmd.power !== false) {
        if (cmd.mode) {
          const allowed = fns.mode?.values?.range || MODE_CANDIDATES[cmd.mode];
          const value = MODE_CANDIDATES[cmd.mode].find((v) => allowed.includes(v)) || MODE_CANDIDATES[cmd.mode][0];
          commands.push({ code: 'mode', value });
        }
        if (cmd.temperature !== undefined) {
          const code = pick(fns, ['temp_set', 'set_temp', 'T']) || 'temp_set';
          let scale = fns[code]?.values?.scale;
          if (scale === undefined) {
            // sem especificação: deduz pela leitura atual (ex.: 240 = 24,0 °C)
            const cur = await this.status(id).catch(() => null);
            scale = cur?.raw?.[code] > 100 ? 1 : 0;
          }
          commands.push({ code, value: Math.round(clampTemp(cmd.temperature) * 10 ** scale) });
        }
        if (cmd.fan) {
          const code = pick(fns, FAN_CODES) || 'fan_speed_enum';
          const allowed = fns[code]?.values?.range || FAN_CANDIDATES[cmd.fan];
          const value = FAN_CANDIDATES[cmd.fan].find((v) => allowed.includes(v)) || FAN_CANDIDATES[cmd.fan][0];
          commands.push({ code, value });
        }
        if (cmd.turbo !== undefined) {
          let tw = turboWay(fns);
          if (!tw) {
            // sem especificação da nuvem: olha o que o aparelho está reportando
            const cur = await this.status(id).catch(() => null);
            tw = turboWay(fns, cur?.raw);
          }
          if (!tw)
            throw new Error(
              'Smart Life: o turbo desse ar não aparece no modo "Padrão" da nuvem Tuya. Para liberar: platform.tuya.com › Cloud › seu projeto › Devices › no seu ar, "Change Control Instruction Mode" › DP Instruction. A Alma reconhece o turbo sozinha depois.',
            );
          if (tw.kind === 'switch') commands.push({ code: tw.code, value: cmd.turbo });
          else if (cmd.turbo) commands.push({ code: tw.code, value: tw.value });
          else if (!cmd.fan) {
            // sair do turbo pela ventilação: volta para o automático (ou a primeira velocidade que existir)
            const range = fns[tw.code]?.values?.range || [];
            commands.push({ code: tw.code, value: range.includes('auto') ? 'auto' : range.find((v) => !TURBO_FAN_VALUES.includes(v)) || 'auto' });
          }
        }
      }
      if (commands.length) {
        try {
          await call('POST', `/v1.0/iot-03/devices/${id}/commands`, { commands });
        } catch (e) {
          // projetos em "DP Instruction" às vezes só aceitam a API antiga
          if (/Access|Data center|IoT Core|permissão/.test(e.message)) throw e;
          await call('POST', `/v1.0/devices/${id}/commands`, { commands });
        }
      }
      await sleep(800);
      return this.status(id);
    },
  };
};
