// Ações no Windows: abrir apps, sites, buscas, mídia e volume.
const { shell } = require('electron');
const { spawn, execFile } = require('child_process');

const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function powershell(script, { timeout = 20000 } = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { timeout, windowsHide: true, maxBuffer: 16 * 1024 * 1024, encoding: 'utf8' },
      (err, stdout) => (err ? reject(err) : resolve(stdout)),
    );
  });
}

// ---------- Apps ----------
let appIndex = [];
let appIndexAt = 0;

async function refreshApps() {
  const out = await powershell(
    '[Console]::OutputEncoding=[Text.Encoding]::UTF8; Get-StartApps | Select-Object Name,AppID | ConvertTo-Json -Compress',
  );
  const list = JSON.parse(out || '[]');
  appIndex = (Array.isArray(list) ? list : [list])
    .filter((a) => a && a.Name && a.AppID)
    .filter((a) => !/uninstall|desinstalar/i.test(a.Name))
    .map((a) => ({ name: a.Name, id: a.AppID, key: norm(a.Name) }));
  appIndexAt = Date.now();
  return appIndex;
}

async function apps() {
  if (!appIndex.length || Date.now() - appIndexAt > 30 * 60 * 1000) {
    try {
      await refreshApps();
    } catch (e) {
      console.error('Get-StartApps falhou', e.message);
    }
  }
  return appIndex;
}

function scoreApp(app, q) {
  if (app.key === q) return 100;
  if (app.key.startsWith(q)) return 80 - (app.key.length - q.length) * 0.1;
  const words = app.key.split(' ');
  if (words.includes(q)) return 70;
  if (app.key.includes(q)) return 60;
  const qw = q.split(' ');
  const hits = qw.filter((w) => w.length > 1 && app.key.includes(w)).length;
  return hits ? (40 * hits) / qw.length : 0;
}

async function findApps(query, limit = 8) {
  const q = norm(query);
  const list = await apps();
  if (!q) return list.slice(0, limit);
  return list
    .map((a) => ({ a, s: scoreApp(a, q) }))
    .filter((x) => x.s > 0)
    .sort((x, y) => y.s - x.s)
    .slice(0, limit)
    .map((x) => x.a);
}

function launchAppId(id) {
  spawn('explorer.exe', [`shell:AppsFolder\\${id}`], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
}

async function openApp(name) {
  const [best] = await findApps(name, 1);
  if (best) {
    launchAppId(best.id);
    return { ok: true, opened: best.name };
  }
  // fallback: comandos registrados (notepad, calc, mspaint...)
  const safe = String(name).replace(/[^\w.\- ]/g, '').trim();
  if (!safe) return { ok: false, error: 'Nome de app vazio' };
  spawn('cmd.exe', ['/c', 'start', '""', safe], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  return { ok: true, opened: safe, note: 'Não achei no menu Iniciar, tentei pelo comando do Windows.' };
}

// ---------- Web ----------
const SITES = {
  google: (q) => `https://www.google.com/search?q=${q}`,
  youtube: (q) => `https://www.youtube.com/results?search_query=${q}`,
  amazon: (q) => `https://www.amazon.com.br/s?k=${q}`,
  mercadolivre: (q) => `https://lista.mercadolivre.com.br/${q}`,
  shopee: (q) => `https://shopee.com.br/search?keyword=${q}`,
  wikipedia: (q) => `https://pt.wikipedia.org/w/index.php?search=${q}`,
  maps: (q) => `https://www.google.com/maps/search/${q}`,
  spotify: (q) => `https://open.spotify.com/search/${q}`,
  github: (q) => `https://github.com/search?q=${q}`,
  imagens: (q) => `https://www.google.com/search?tbm=isch&q=${q}`,
  noticias: (q) => `https://news.google.com/search?q=${q}&hl=pt-BR`,
  netflix: (q) => `https://www.netflix.com/search?q=${q}`,
};

function openUrl(url) {
  let u = String(url || '').trim();
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  const parsed = new URL(u);
  if (!/^https?:$/.test(parsed.protocol)) throw new Error('Só abro links http/https');
  shell.openExternal(parsed.toString());
  return { ok: true, opened: parsed.toString() };
}

function webSearch(query, site = 'google') {
  const fn = SITES[norm(site).replace(/ /g, '')] || SITES.google;
  return openUrl(fn(encodeURIComponent(query)));
}

async function playYoutube(query) {
  const res = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=pt-BR`, {
    headers: { 'accept-language': 'pt-BR,pt;q=0.9', 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
  });
  const html = await res.text();
  const m = html.match(/"videoId":"([\w-]{11})"/);
  if (!m) return webSearch(query, 'youtube');
  return openUrl(`https://www.youtube.com/watch?v=${m[1]}`);
}

// ---------- Mídia / volume ----------
const MEDIA = { play_pause: 179, next: 176, previous: 177, stop: 178, volume_up: 175, volume_down: 174, mute: 173 };

function sendVirtualKeys(codes) {
  const body = codes.map((c) => `$w.SendKeys([char]${c})`).join(';');
  return powershell(`$w=New-Object -ComObject WScript.Shell;${body}`);
}

async function media(action, times = 1) {
  const code = MEDIA[action];
  if (!code) throw new Error('Ação de mídia desconhecida: ' + action);
  const n = Math.max(1, Math.min(50, Number(times) || 1));
  await sendVirtualKeys(Array(n).fill(code));
  return { ok: true };
}

async function setVolume(percent) {
  const p = Math.max(0, Math.min(100, Math.round(Number(percent))));
  await sendVirtualKeys([...Array(50).fill(MEDIA.volume_down), ...Array(Math.round(p / 2)).fill(MEDIA.volume_up)]);
  return { ok: true, volume: p };
}

module.exports = {
  norm,
  powershell,
  apps,
  refreshApps,
  findApps,
  launchAppId,
  openApp,
  openUrl,
  webSearch,
  playYoutube,
  media,
  setVolume,
  SITES,
};
