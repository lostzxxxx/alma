// Formato comum usado pela Alma para qualquer ar-condicionado:
//   status: { id, name, power: bool, mode: 'cool'|'heat'|'dry'|'fan'|'auto', temperature: number,
//             fan: 'auto'|'low'|'medium'|'high', turbo: bool|null (null = o aparelho não informa),
//             roomTemperature?: number, raw?: any }
//   set(id, { power?, temperature?, mode?, fan?, turbo? })   — turbo: true também liga o ar
const MODES = ['cool', 'heat', 'dry', 'fan', 'auto'];
const FANS = ['auto', 'low', 'medium', 'high'];

function clampTemp(t) {
  const n = Math.round(Number(t));
  if (!Number.isFinite(n)) throw new Error('Temperatura inválida');
  return Math.max(16, Math.min(30, n));
}

async function http(url, { method = 'GET', headers = {}, body, timeout = 15000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, {
      method,
      headers: { 'content-type': 'application/json', ...headers },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await res.text();
    let json;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { text };
    }
    if (!res.ok) {
      const msg = json?.error?.message || json?.message || json?.msg || text.slice(0, 200) || res.statusText;
      const err = new Error(`HTTP ${res.status}: ${msg}`);
      err.status = res.status;
      err.body = json;
      throw err;
    }
    return json;
  } finally {
    clearTimeout(t);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// algum comando que exige o ar ligado
const wantsOn = (cmd) => cmd.power === true || Boolean(cmd.mode) || cmd.temperature !== undefined || Boolean(cmd.fan) || cmd.turbo === true;

module.exports = { MODES, FANS, clampTemp, http, sleep, wantsOn };
