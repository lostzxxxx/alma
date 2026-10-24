// Tela de configurações.
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const api = window.alma;
const main = $('#main');

let S = {};
let data = {};

const M = window.Motion;

function toast(text) {
  const t = $('#toast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('show'), 2600);
}

// mensagem de status (testando / ✓ / ✗) aparece subindo de leve
function setStatus(el, kind, text) {
  el.className = 'status' + (kind ? ' ' + kind : '');
  el.textContent = text;
  M.stagger([el], { y: 4, duration: 180 });
}

async function save(patch, msg = 'Salvo') {
  try {
    // o que ainda não foi salvo (você continua mexendo) vale mais que a resposta que voltou
    S = { ...(await api.call('settings:save', patch)), ...pending };
    applyTheme();
    if (msg) toast(msg);
  } catch (e) {
    toast('Erro: ' + e.message);
  }
}

function applyTheme() {
  document.documentElement.style.setProperty('--hue', S.hue ?? 196);
  Theme.apply(S);
  M.setPreference(S.motion);
  $('#brandName').textContent = S.name || 'Alma';
  main.querySelectorAll('.seg').forEach(placeSeg);
}

// a Alminha também mora aqui: na marca da barra lateral, olhando para o mouse
const brandSoul = Mascot.mount($('#brandSoul'));
brandSoul.setBase('happy');
brandSoul.startIdle(() => !document.hidden);
document.addEventListener('mousemove', (e) => {
  brandSoul.look(e.clientX, e.clientY);
  heroSoul?.look(e.clientX, e.clientY);
});
let heroSoul = null;

// ---------- peças da tela (estilo de listas agrupadas) ----------
const cell = (title, sub, control, extra = '') =>
  `<div class="cell" ${extra}><div class="cell-txt"><div>${title}</div>${sub ? `<div class="cell-sub">${sub}</div>` : ''}</div>${control}</div>`;
const toggle = (id, on, label) => `<input type="checkbox" class="toggle" id="${id}" ${on ? 'checked' : ''} aria-label="${esc(label)}" />`;
// controle segmentado com um "polegar" que desliza até a opção escolhida
const seg = (key, opts, cur, label) =>
  `<div class="seg" role="radiogroup" aria-label="${esc(label)}" data-seg="${key}"><i class="seg-thumb"></i>${opts
    .map(([v, l]) => `<button role="radio" aria-checked="${v === cur}" class="${v === cur ? 'on' : ''}" data-v="${v}">${l}</button>`)
    .join('')}</div>`;
function placeSeg(s, instant) {
  const b = s.querySelector('button.on');
  const th = s.querySelector('.seg-thumb');
  if (!b || !th || !b.offsetWidth) return;
  if (instant) th.style.transition = 'none';
  th.style.width = b.offsetWidth + 'px';
  th.style.transform = `translateX(${b.offsetLeft}px)`;
  if (instant) {
    th.offsetWidth;
    th.style.transition = '';
  }
}

// ---------- tema (Aparência): aplica na hora e salva logo depois ----------
const theme = () => ({ ...Theme.DEFAULT, ...(S.theme || {}) });
const accentOn = (h) => (h === null ? theme().accent === 'neutral' : theme().accent !== 'neutral' && Number(S.hue) === h);
let saveT = null;
let saveMsg = '';
let pending = {};
function saveSoon(patch, msg = '') {
  pending = { ...pending, ...patch };
  if (msg) saveMsg = msg;
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    const p = pending;
    pending = {};
    save(p, saveMsg);
    saveMsg = '';
  }, 250);
}
function setTheme(patch, msg) {
  S = { ...S, theme: { ...theme(), ...patch } };
  applyTheme(); // esta janela muda na hora; a ilha muda quando salvar (250 ms)
  saveSoon({ theme: S.theme, hue: S.hue }, msg);
}

// ---------- atualizações (Geral) ----------
let U = { status: 'idle' };
const when = (t) => (t ? new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');
function updateCells() {
  const v = esc(U.version || '');
  const map = {
    dev: ['Rodando a partir do código', 'Atualizações só funcionam na Alma instalada.', ''],
    idle: ['Atualizações', 'A Alma procura sozinha ao abrir e a cada 6 horas, e avisa quando tiver versão nova.', '<button class="btn" data-upd="check">Procurar agora</button>'],
    checking: ['Procurando…', 'Conferindo se há uma versão nova.', '<span class="spin" aria-hidden="true"></span>'],
    none: ['Você está na versão mais nova', `Versão ${esc(U.current || S.version)}${U.checkedAt ? ` · conferido às ${when(U.checkedAt)}` : ''}`, '<button class="btn" data-upd="check">Procurar agora</button>'],
    available: [`Nova versão ${v} disponível`, `Você está na ${esc(U.current || S.version)}. Veja as novidades abaixo.`, '<button class="btn primary" data-upd="download">Baixar e instalar</button>'],
    downloading: [`Baixando a versão ${v}…`, `${U.percent || 0}% — você pode continuar usando a Alma.`, `<div class="upd-bar" role="progressbar" aria-valuenow="${U.percent || 0}" aria-valuemin="0" aria-valuemax="100"><i style="width:${U.percent || 0}%"></i></div>`],
    ready: [`Versão ${v} pronta`, 'A Alma fecha, instala e abre de novo em alguns segundos. Se preferir, ela instala quando você fechar.', '<button class="btn primary" data-upd="install">Reiniciar e instalar</button>'],
    error: ['Não deu certo', esc(U.error || ''), '<button class="btn" data-upd="check">Tentar de novo</button>'],
  };
  const [t, sub, ctl] = map[U.status] || map.idle;
  const notes = U.version && ['available', 'downloading', 'ready'].includes(U.status) && U.notes ? `<div class="cell notes"><div class="cell-txt"><div>Novidades da ${v}</div><div class="cell-sub upd-notes">${esc(U.notes)}</div></div></div>` : '';
  return cell(t, sub, ctl) + notes;
}
function drawUpdate() {
  const box = $('#updBox');
  if (box) box.innerHTML = updateCells();
}
api.on('update', (s) => {
  U = s;
  drawUpdate();
});
api.call('update:state').then((s) => ((U = s), drawUpdate())).catch(() => {});
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-upd]');
  if (!b) return;
  b.disabled = true;
  api.call(`update:${b.dataset.upd}`).then((s) => s && typeof s === 'object' && ((U = s), drawUpdate())).catch((err) => toast('Erro: ' + err.message));
});

// comportamento e lugar da ilha (Acessibilidade); `reveal` antigo vinha de `discreet`
function isl() {
  const o = { reveal: null, hoverDelay: 180, hideAfter: 2500, hoverOpen: false, position: 'center', display: 'primary', hideFullscreen: false, shortcut: '', ...(S.island || {}) };
  o.reveal ||= S.discreet === false ? 'always' : 'line';
  return o;
}
function saveIsland(patch, msg) {
  S = { ...S, island: { ...isl(), ...patch } };
  return save({ island: S.island }, msg);
}
// controles segmentados: marca a opção, desliza o polegar e avisa quem chamou
function bindSegs(onChange) {
  main.querySelectorAll('.seg').forEach((s) => {
    placeSeg(s, true);
    s.onclick = (e) => {
      const b = e.target.closest('button');
      if (!b || b.classList.contains('on')) return;
      s.querySelectorAll('button').forEach((x) => {
        x.classList.toggle('on', x === b);
        x.setAttribute('aria-checked', String(x === b));
      });
      placeSeg(s);
      onChange(s.dataset.seg, b.dataset.v);
    };
  });
}

const secretPh =(k, ph) => (S.secrets?.[k] ? '•••••••• (salvo — cole outro para trocar)' : ph);
const link = (url, text) => `<a href="#" data-ext="${esc(url)}">${esc(text || url)}</a>`;

// controles deslizantes: a parte preenchida do trilho acompanha o valor
const fillRange = (r) => r.style.setProperty('--p', `${((r.value - r.min) / (r.max - r.min)) * 100}%`);
document.addEventListener('input', (e) => e.target.type === 'range' && fillRange(e.target));

document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-ext]');
  if (a) {
    e.preventDefault();
    api.call('open:external', a.dataset.ext);
  }
});

// ---------- módulos do painel (a mesma lista do island.js) ----------
const I = window.ICONS;
const MODULES = {
  ac: ['Clima', 'Ar-condicionado', I.ac],
  focus: ['Foco', 'Temporizador, pomodoro e cronômetro', I.timer],
  music: ['Música', 'O que está tocando e os controles', I.music],
  tasks: ['Tarefas', 'Lista de afazeres', I.tasks],
  tray: ['Bandeja', 'Arquivos guardados por 12 horas', I.tray],
  translate: ['Traduzir', 'Tradução rápida — arraste um texto até a ilha', I.translate],
  color: ['Cores', 'Conta-gotas: pegue a cor de qualquer ponto da tela', I.pipette],
  apps: ['Apps', 'Procurar e abrir programas', I.apps],
  clip: ['Copiados', 'O que você copiou por último', I.clip],
  routines: ['Rotinas', 'Rotinas antigas (as novas são as Ações)', I.clock],
};
function modules() {
  const saved = Array.isArray(S.modules) ? S.modules.filter((m) => MODULES[m.id]) : [];
  const known = new Set(saved.map((m) => m.id));
  return [...saved, ...Object.keys(MODULES).filter((id) => !known.has(id)).map((id) => ({ id, on: id !== 'routines' }))];
}
const fo = () => ({ focusMin: 25, shortMin: 5, longMin: 15, rounds: 4, autoBreak: true, autoFocus: false, sleep: true, silent: true, sound: true, ...(S.focus || {}) });
const tro = () => ({ target: 'pt-BR', alt: 'en', autoCopy: false, dropToTranslate: true, ...(S.translate || {}) });
const co = () => ({ format: 'hex', autoCopy: true, ...(S.color || {}) });
const minSel = (id, cur, list, label) =>
  `<select class="input compact" id="${id}" aria-label="${esc(label)}">${list.map((m) => `<option value="${m}" ${m === Number(cur) ? 'selected' : ''}>${m} min</option>`).join('')}</select>`;
let LANGS = {};

// ---------- Alma Actions ----------
const WHEN = {
  app_open: 'Abrir um app ou jogo',
  app_close: 'Fechar um app ou jogo',
  fullscreen: 'Algo entrar em tela cheia (jogo, vídeo, apresentação)',
  focus_start: 'Começar o foco',
  focus_end: 'Acabar o foco',
  alma_start: 'A Alma abrir',
};
const UNDO = { app_open: 'Desfazer tudo quando o app fechar', fullscreen: 'Desfazer tudo ao sair da tela cheia', focus_start: 'Desfazer tudo quando o foco acabar' };
const STEPS = {
  volume: ['Ajustar o volume', (s) => `volume em ${s.level ?? 35}%`],
  mute: ['Deixar mudo', (s) => (s.on === false ? 'tirar o mudo' : 'deixar mudo')],
  silent: ['Modo silencioso', (s) => (s.on === false ? 'desligar o modo silencioso' : 'ligar o modo silencioso')],
  island: ['Mostrar ou esconder a ilha', (s) => (s.show ? 'mostrar a ilha' : 'esconder a ilha')],
  focus: ['Começar o foco', (s) => (s.mode === 'timer' ? `temporizador de ${s.minutes || 25} min` : 'começar um pomodoro')],
  open_app: ['Abrir um app', (s) => `abrir ${s.name || '…'}`],
  open_site: ['Abrir um site', (s) => `abrir ${s.url || '…'}`],
  media: ['Controlar a música', (s) => ({ play_pause: 'tocar/pausar', next: 'próxima música', previous: 'música anterior' })[s.action || 'play_pause']],
  ac: ['Ar-condicionado', (s) => (s.power === false ? 'desligar o ar' : `ligar o ar${s.temperature ? ` em ${s.temperature}°` : ''}`)],
  notify: ['Mostrar um aviso', (s) => `avisar “${s.text || '…'}”`],
};
const STEP_DEFAULT = { volume: { level: 35 }, mute: { on: true }, silent: { on: true }, island: { show: false }, focus: { start: true, mode: 'pomodoro', minutes: 25 }, open_app: { name: '' }, open_site: { url: '' }, media: { action: 'play_pause' }, ac: { power: true, temperature: 23 }, notify: { text: '' } };
const A = { list: [], editing: null, draft: null, apps: [], templates: [] };
const whenText = (w) => (w.type === 'app_open' || w.type === 'app_close' ? `${w.type === 'app_open' ? 'Abrir' : 'Fechar'} ${w.app?.name || w.app?.exe || 'um app'}` : WHEN[w.type] || '');
const ruleSummary = (r) => `${esc(whenText(r.when))} → ${r.do.length ? r.do.map((s) => esc(STEPS[s.type]?.[1](s) || s.type)).join(', ') : 'nada ainda'}`;
const opt = (v, l, cur) => `<option value="${esc(v)}" ${String(v) === String(cur) ? 'selected' : ''}>${esc(l)}</option>`;
function stepParams(s, i) {
  const on = (k, yes, no) => `<select class="input compact" data-k="${k}" data-i="${i}" data-bool>${opt('true', yes, s[k] !== false)}${opt('false', no, s[k] !== false)}</select>`;
  switch (s.type) {
    case 'volume':
      return `<input type="range" min="0" max="100" step="5" value="${s.level ?? 35}" data-k="level" data-i="${i}" data-num aria-label="Volume" /><b class="act-val">${s.level ?? 35}%</b>`;
    case 'mute':
      return on('on', 'Ligar o mudo', 'Tirar o mudo');
    case 'silent':
      return on('on', 'Ligar', 'Desligar');
    case 'island':
      return `<select class="input compact" data-k="show" data-i="${i}" data-bool>${opt('false', 'Esconder', Boolean(s.show))}${opt('true', 'Mostrar', Boolean(s.show))}</select>`;
    case 'focus':
      return `<select class="input compact" data-k="mode" data-i="${i}">${opt('pomodoro', 'Pomodoro', s.mode)}${opt('timer', 'Temporizador', s.mode)}</select>${s.mode === 'timer' ? `<input class="input act-num" type="number" min="1" max="240" value="${s.minutes || 25}" data-k="minutes" data-i="${i}" data-num aria-label="Minutos" /><span class="muted small">min</span>` : ''}`;
    case 'open_app':
      return `<input class="input" placeholder="Nome do app (ex.: Spotify)" value="${esc(s.name || '')}" data-k="name" data-i="${i}" />`;
    case 'open_site':
      return `<input class="input" placeholder="youtube.com" value="${esc(s.url || '')}" data-k="url" data-i="${i}" />`;
    case 'media':
      return `<select class="input compact" data-k="action" data-i="${i}">${opt('play_pause', 'Tocar / pausar', s.action)}${opt('next', 'Próxima', s.action)}${opt('previous', 'Anterior', s.action)}</select>`;
    case 'ac':
      return `${on('power', 'Ligar', 'Desligar')}${s.power !== false ? `<input class="input act-num" type="number" min="16" max="30" value="${s.temperature || 23}" data-k="temperature" data-i="${i}" data-num aria-label="Temperatura" /><span class="muted small">°C</span>` : ''}`;
    case 'notify':
      return `<input class="input" placeholder="O que a Alma deve dizer" maxlength="140" value="${esc(s.text || '')}" data-k="text" data-i="${i}" />`;
    default:
      return '';
  }
}
function ruleEditor(r) {
  const appWhen = r.when.type === 'app_open' || r.when.type === 'app_close';
  const exe = r.when.app?.exe || '';
  const apps = A.apps.some((a) => a.exe.toLowerCase() === exe.toLowerCase()) || !exe ? A.apps : [{ exe, name: r.when.app?.name || exe }, ...A.apps];
  return `
    <div class="act-edit">
      <div class="field-row"><label for="actName">Nome</label><input class="input" id="actName" maxlength="60" value="${esc(r.name)}" placeholder="Ex.: Jogando" /></div>
      <div class="act-block"><span class="act-tag">Quando</span>
        <select class="input" id="actWhen" aria-label="Quando">${Object.entries(WHEN).map(([v, l]) => opt(v, l, r.when.type)).join('')}</select>
        ${
          appWhen
            ? `<div class="act-app"><select class="input" id="actApp" aria-label="Qual app">${opt('', 'Escolha um app aberto agora…', exe)}${apps.map((a) => opt(a.exe, `${a.name} (${a.exe})`, exe)).join('')}${opt('__other', 'Outro: digitar o nome do .exe', '')}</select>
               <input class="input ${exe && !apps.length ? '' : 'hidden'}" id="actExe" placeholder="jogo.exe" value="${esc(exe)}" aria-label="Arquivo do app" /></div>
               <p class="muted small">Abra o jogo ou app antes para ele aparecer na lista.</p>`
            : ''
        }
      </div>
      <div class="act-block"><span class="act-tag">Fazer</span>
        <div class="act-steps">${r.do
          .map(
            (s, i) => `<div class="act-step">
              <select class="input compact" data-steptype="${i}" aria-label="Passo ${i + 1}">${Object.entries(STEPS).map(([v, [l]]) => opt(v, l, s.type)).join('')}</select>
              <div class="act-params">${stepParams(s, i)}</div>
              <button class="icon-btn" data-delstep="${i}" title="Tirar este passo" aria-label="Tirar este passo">${I.close}</button>
            </div>`,
          )
          .join('')}</div>
        <button class="btn" id="actAddStep">${I.plus.replace(/width="22" height="22"/, 'width="16" height="16"')} Adicionar passo</button>
      </div>
      ${UNDO[r.when.type] ? `<div class="group act-undo">${cell(UNDO[r.when.type], 'Volta o volume, a ilha e o modo silencioso como estavam antes.', toggle('actUndo', r.undo, UNDO[r.when.type]))}</div>` : ''}
      <div class="row"><button class="btn primary" id="actSave">Salvar ação</button><button class="btn" id="actCancel">Cancelar</button></div>
    </div>`;
}
function ruleCard(r) {
  if (A.editing === r.id) return `<div class="act-card editing" data-rule="${esc(r.id)}">${ruleEditor(A.draft)}</div>`;
  return `<div class="act-card" data-rule="${esc(r.id)}">
    <div class="act-head">
      <div class="cell-txt"><div>${esc(r.name)}</div><div class="cell-sub">${ruleSummary(r)}${r.undo ? ' · desfaz no fim' : ''}</div></div>
      <div class="row act-btns"><button class="btn" data-act="test">Testar</button><button class="btn" data-act="edit">Editar</button><button class="icon-btn" data-act="del" title="Excluir" aria-label="Excluir ${esc(r.name)}">${I.trash}</button>${toggle('acton-' + r.id, r.on, 'Ligada')}</div>
    </div>
  </div>`;
}
function drawActions() {
  const box = $('#actList');
  if (!box) return;
  const list = A.editing && !A.list.some((r) => r.id === A.editing) ? [...A.list, A.draft] : A.list;
  box.innerHTML = list.length ? list.map(ruleCard).join('') : `<div class="act-empty muted">Nenhuma ação ainda. Comece de um modelo acima ou crie a sua.</div>`;
  $('#actNew').hidden = Boolean(A.editing);
  bindActions();
}
async function saveActions(msg) {
  try {
    A.list = await api.call('actions:save', A.list);
    if (msg) toast(msg);
  } catch (e) {
    toast('Erro: ' + e.message);
  }
}
function editRule(r) {
  A.editing = r.id;
  A.draft = structuredClone(r);
  drawActions();
  M.stagger(main.querySelectorAll('.act-card.editing .act-edit > *'), { step: 30, max: 6 });
  api.call('actions:apps').then((apps) => {
    A.apps = apps;
    if (A.editing && (A.draft.when.type === 'app_open' || A.draft.when.type === 'app_close')) drawActions();
  }).catch(() => {});
}
function bindActions() {
  const box = $('#actList');
  if (!box) return;
  box.querySelectorAll('.act-card:not(.editing)').forEach((card) => {
    const r = A.list.find((x) => x.id === card.dataset.rule);
    if (!r) return;
    card.querySelector('.toggle').onchange = (e) => {
      r.on = e.target.checked;
      saveActions(r.on ? `“${r.name}” ligada` : `“${r.name}” desligada`);
    };
    card.querySelectorAll('[data-act]').forEach(
      (b) =>
        (b.onclick = async () => {
          const act = b.dataset.act;
          if (act === 'edit') return editRule(r);
          if (act === 'del') {
            A.list = A.list.filter((x) => x !== r);
            M.leave(card, { x: 0, y: -4 }).then(() => drawActions());
            return saveActions('Ação excluída');
          }
          b.disabled = true;
          await api.call('actions:test', r).then(() => toast(r.undo ? 'Testando… volta ao normal em 6 s' : 'Ação testada'), (e) => toast('Erro: ' + e.message));
          b.disabled = false;
        }),
    );
  });
  const ed = box.querySelector('.act-card.editing');
  if (!ed) return;
  const d = A.draft;
  $('#actName').oninput = (e) => (d.name = e.target.value);
  $('#actWhen').onchange = (e) => {
    d.when = { type: e.target.value, ...(d.when.app ? { app: d.when.app } : {}) };
    if (!UNDO[d.when.type]) d.undo = false;
    drawActions();
    if (d.when.type.startsWith('app_') && !A.apps.length) api.call('actions:apps').then((apps) => ((A.apps = apps), drawActions())).catch(() => {});
  };
  const appSel = $('#actApp');
  if (appSel)
    appSel.onchange = () => {
      const exeIn = $('#actExe');
      if (appSel.value === '__other') {
        exeIn.classList.remove('hidden');
        exeIn.value = '';
        exeIn.focus();
        d.when.app = null;
        return;
      }
      exeIn.classList.add('hidden');
      const a = A.apps.find((x) => x.exe === appSel.value);
      d.when.app = appSel.value ? { exe: appSel.value, name: a?.name || appSel.value } : null;
    };
  if ($('#actExe'))
    $('#actExe').oninput = (e) => {
      const v = e.target.value.trim();
      const exe = v && !/\.exe$/i.test(v) ? v + '.exe' : v;
      d.when.app = exe ? { exe, name: exe.replace(/\.exe$/i, '') } : null;
    };
  ed.querySelectorAll('[data-steptype]').forEach(
    (s) =>
      (s.onchange = () => {
        d.do[Number(s.dataset.steptype)] = { type: s.value, ...structuredClone(STEP_DEFAULT[s.value]) };
        drawActions();
      }),
  );
  ed.querySelectorAll('[data-k]').forEach((el) => {
    const set = () => {
      const step = d.do[Number(el.dataset.i)];
      step[el.dataset.k] = el.hasAttribute('data-bool') ? el.value === 'true' : el.hasAttribute('data-num') ? Number(el.value) : el.value;
      if (step.type === 'volume') el.nextElementSibling.textContent = `${step.level}%`;
      if (el.tagName === 'SELECT' && (step.type === 'focus' || step.type === 'ac')) drawActions(); // mostra/esconde minutos e temperatura
    };
    el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', set);
    if (el.type === 'range') fillRange(el);
  });
  ed.querySelectorAll('[data-delstep]').forEach(
    (b) =>
      (b.onclick = () => {
        d.do.splice(Number(b.dataset.delstep), 1);
        drawActions();
      }),
  );
  $('#actAddStep').onclick = () => {
    d.do.push({ type: 'volume', ...STEP_DEFAULT.volume });
    drawActions();
    const steps = main.querySelectorAll('.act-step');
    M.stagger([steps[steps.length - 1]], { y: -4 });
  };
  if ($('#actUndo')) $('#actUndo').onchange = (e) => (d.undo = e.target.checked);
  $('#actCancel').onclick = () => {
    A.editing = null;
    A.draft = null;
    drawActions();
  };
  $('#actSave').onclick = () => {
    if (d.when.type.startsWith('app_') && !d.when.app?.exe) return toast('Escolha qual app');
    if (!d.do.length) return toast('Adicione pelo menos um passo');
    if (d.do.some((s) => (s.type === 'open_app' && !s.name) || (s.type === 'open_site' && !s.url) || (s.type === 'notify' && !s.text))) return toast('Preencha os passos');
    d.name = d.name.trim() || whenText(d.when);
    const i = A.list.findIndex((x) => x.id === d.id);
    if (i >= 0) A.list[i] = d;
    else A.list.push(d);
    A.editing = null;
    A.draft = null;
    saveActions('Ação salva').then(drawActions);
  };
}

// ---------------- seções ----------------
const SECTIONS = {
  ac() {
    const d = S.ac?.driver || 'demo';
    const o = S.ac?.options || {};
    const cards = [
      ['lg', 'LG ThinQ', 'Ar LG com Wi-Fi (app LG ThinQ)'],
      ['smartthings', 'Samsung SmartThings', 'Samsung WindFree e marcas no SmartThings'],
      ['tuya', 'Elgin / Smart Life', 'Elgin, Philco, TCL e outros no app Smart Life'],
      ['homeassistant', 'Home Assistant', 'Midea/Springer, Gree, Daikin, Fujitsu, Electrolux, Broadlink…'],
      ['demo', 'Demonstração', 'Simulado, para testar a Alma'],
    ];
    const forms = {
      demo: `<p class="muted">Modo de teste: a Alma finge controlar um ar. Útil para experimentar o painel.</p>`,
      lg: `
        <ol class="steps">
          <li>Abra ${link('https://connect-pat.lgthinq.com', 'connect-pat.lgthinq.com')} e entre com a <b>mesma conta do app LG ThinQ</b>.</li>
          <li>Clique em <b>ADD NEW TOKEN</b>, dê um nome (ex.: Alma) e marque todas as permissões de dispositivos (listar, ver status e <b>controlar</b>).</li>
          <li>Copie o token (ele só aparece uma vez) e cole abaixo.</li>
        </ol>
        <div class="field-row"><label>País da conta</label>
          <select class="input" id="lg_country">${['BR', 'PT', 'US', 'AR', 'MX', 'CL', 'CO', 'ES', 'DE', 'GB', 'KR', 'IN', 'AU'].map((c) => `<option ${c === (o.country || 'BR') ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
        <div class="field-row"><label>Token pessoal (PAT)</label><input class="input" id="lg_pat" type="password" placeholder="${esc(secretPh('lg_pat', 'thinqpat_…'))}" /></div>`,
      smartthings: `
        <div class="field-row"><label>Como autenticar</label>
          <select class="input" id="st_mode"><option value="pat" ${o.authMode !== 'oauth' ? 'selected' : ''}>Token pessoal (simples, vale 24 h)</option><option value="oauth" ${o.authMode === 'oauth' ? 'selected' : ''}>OAuth (renova sozinho — avançado)</option></select></div>
        <div id="st_pat_box" class="${o.authMode === 'oauth' ? 'hidden' : ''}">
          <ol class="steps">
            <li>Abra ${link('https://account.smartthings.com/tokens', 'account.smartthings.com/tokens')} e clique em <b>Generate new token</b>.</li>
            <li>Marque <b>Devices</b>: List, See e Control all devices. Gere e copie o token.</li>
            <li>Atenção: a Samsung faz esses tokens novos expirarem em 24 h. Para não precisar trocar todo dia, use OAuth.</li>
          </ol>
          <div class="field-row"><label>Token</label><input class="input" id="st_pat" type="password" placeholder="${esc(secretPh('st_pat', 'Cole o token'))}" /></div>
        </div>
        <div id="st_oauth_box" class="${o.authMode === 'oauth' ? '' : 'hidden'}">
          <ol class="steps">
            <li>Instale a ${link('https://github.com/SmartThingsCommunity/smartthings-cli', 'SmartThings CLI')} e rode <b>smartthings apps:create</b> escolhendo <b>OAuth-In App</b>, escopos <b>r:devices:* x:devices:*</b> e o redirect abaixo.</li>
            <li>Cole o Client ID e o Client Secret, clique em <b>Abrir autorização</b>, autorize e cole aqui o endereço final (ou só o <i>code</i>).</li>
          </ol>
          <div class="field-row"><label>Client ID</label><input class="input" id="st_client" value="${esc(o.clientId || '')}" /></div>
          <div class="field-row"><label>Client Secret</label><input class="input" id="st_secret" type="password" placeholder="${esc(secretPh('st_client_secret', ''))}" /></div>
          <div class="field-row"><label>Redirect URI</label><input class="input" id="st_redirect" value="${esc(o.redirectUri || 'https://httpbin.org/get')}" /></div>
          <div class="row" style="margin-bottom:12px"><button class="btn" id="st_auth">Abrir autorização</button></div>
          <div class="field-row"><label>Endereço final ou code</label><input class="input" id="st_code" placeholder="https://httpbin.org/get?code=…" /></div>
          <div class="row"><button class="btn" id="st_exchange">Conectar</button><span class="muted small">${S.secrets?.st_refresh ? '✓ Conectado' : ''}</span></div>
        </div>`,
      tuya: `
        <p class="muted small" style="margin-bottom:10px">Para ar Elgin, Philco, TCL e outros que você controla pelo app <b>Smart Life</b>. É grátis e você só faz isso uma vez (~10 min).</p>
        <ol class="steps">
          <li>Crie uma conta grátis em ${link('https://platform.tuya.com', 'platform.tuya.com')} (pode usar o mesmo e-mail do Smart Life).</li>
          <li>Vá em <b>Cloud › Development › Create Cloud Project</b>: nome "Alma", Industry <b>Smart Home</b>, Development Method <b>Smart Home</b>, Data Center <b>Western America Data Center</b>. Na tela seguinte deixe marcado <b>IoT Core</b> e confirme.</li>
          <li>No projeto, abra <b>Devices › Link App Account › Add App Account</b> e escaneie o QR code com o app <b>Smart Life</b> (aba Eu/Perfil › ícone de leitor no canto). Seu ar deve aparecer na lista.</li>
          <li>Na aba <b>Overview</b> copie o <b>Access ID/Client ID</b> e o <b>Access Secret/Client Secret</b> e cole abaixo.</li>
        </ol>
        <p class="muted small" style="margin-bottom:12px">Se o QR disser que a região não bate, crie o projeto com <b>Eastern America</b> e escolha o mesmo aqui. O "IoT Core" grátis precisa ser renovado de tempos em tempos (a Alma avisa quando expirar).</p>
        <p class="muted small" style="margin-bottom:12px"><b>Turbo e velocidade do ventilador:</b> no modo "Padrão" a nuvem Tuya só mostra as funções comuns. Para liberar tudo o que o seu ar tem (como o turbo), no projeto abra <b>Devices</b>, clique no seu ar › <b>Change Control Instruction Mode</b> › <b>DP Instruction</b>.</p>
        <div class="field-row"><label>Data center</label>
          <select class="input" id="tuya_region">${[
            ['us', 'Western America (padrão para o Brasil)'],
            ['ueaz', 'Eastern America'],
            ['eu', 'Central Europe'],
            ['weaz', 'Western Europe'],
            ['in', 'India'],
            ['cn', 'China'],
          ]
            .map(([v, l]) => `<option value="${v}" ${v === (o.region || 'us') ? 'selected' : ''}>${l}</option>`)
            .join('')}</select></div>
        <div class="field-row"><label>Access ID</label><input class="input" id="tuya_id" value="${esc(o.accessId || '')}" /></div>
        <div class="field-row"><label>Access Secret</label><input class="input" id="tuya_secret" type="password" placeholder="${esc(secretPh('tuya_secret', ''))}" /></div>
        <div class="field-row"><label>ID do aparelho (opcional, se a lista não aparecer)</label><input class="input" id="tuya_dev" value="${esc(o.deviceId || '')}" /></div>`,
      homeassistant: `
        <ol class="steps">
          <li>No Home Assistant, adicione a integração da sua marca (Midea, Gree, Daikin, Broadlink IR…) para o ar aparecer como <b>climate.*</b>.</li>
          <li>Seu perfil › <b>Segurança</b> › <b>Tokens de acesso de longa duração</b> › Criar token.</li>
        </ol>
        <div class="field-row"><label>Endereço do Home Assistant</label><input class="input" id="ha_url" value="${esc(o.url || 'http://homeassistant.local:8123')}" /></div>
        <div class="field-row"><label>Token de longa duração</label><input class="input" id="ha_token" type="password" placeholder="${esc(secretPh('ha_token', ''))}" /></div>`,
    };
    return `
      <h1>Ar-condicionado</h1>
      <p class="lead">Escolha como seu ar se conecta. Depois de configurar, controle pela aba ❄ da ilha.</p>
      <div class="drivers">${cards.map(([id, name, desc]) => `<button class="driver ${id === d ? 'on' : ''}" data-driver="${id}"><b>${name}</b><span>${desc}</span></button>`).join('')}</div>
      <div class="card">
        ${forms[d]}
        <div class="row"><button class="btn primary" id="acsave">Salvar e procurar aparelhos</button></div>
        <div class="status" id="acstatus"></div>
        <div class="devices" id="acdevices"></div>
      </div>
      <p class="muted small" style="max-width:680px">Sua marca não está na lista? Midea, Springer, Carrier, Gree, Daikin, Fujitsu e Electrolux funcionam pelo Home Assistant. Ar sem Wi-Fi funciona com um emissor infravermelho (Broadlink ou um "controle universal Wi-Fi" Smart Life).</p>`;
  },

  soul() {
    const t = theme();
    const base = String(t.base).toLowerCase();
    const isPreset = Theme.PRESETS.some(([, c]) => c === base);
    const glassy = t.style !== 'solid';
    return `
      <h1>Aparência</h1>
      <p class="lead">Material, cores e formas da sua Alma. Tudo muda na hora — a ilha, a hotbar e esta janela.</p>

      <div class="hero" aria-hidden="true">
        <div class="hero-wall"><i></i><i></i><i></i></div>
        <div class="hero-pill hero-glass"><span class="hero-soul" id="heroSoul"></span><span class="hero-clock">14:32</span></div>
        <div class="hero-panel hero-glass">
          <div class="hero-tabs"><b></b><span></span><span></span><span></span><span></span></div>
          <div class="hero-temp">23<sup>°</sup></div>
          <div class="hero-row"><span class="hero-dot"></span><span class="hero-line"></span></div>
          <div class="hero-row"><span class="hero-dot"></span><span class="hero-line short"></span></div>
        </div>
        <div class="hero-dock hero-glass"><i style="--h:210"></i><i style="--h:140"></i><i style="--h:20"></i><i style="--h:280"></i><i style="--h:45"></i></div>
      </div>

      <h2>Material</h2>
      <div class="styles">
        <button class="style-card ${t.style === 'solid' ? 'on' : ''}" data-style="solid"><span class="prev prev-solid"><i></i></span><b>Sólido</b><span>Superfícies firmes, máximo contraste.</span></button>
        <button class="style-card ${t.style === 'glass' ? 'on' : ''}" data-style="glass"><span class="prev prev-glass"><i></i></span><b>Liquid Glass</b><span>Vidro que desfoca o que está atrás, com brilho nas bordas.</span></button>
        <button class="style-card ${t.style === 'clear' ? 'on' : ''}" data-style="clear"><span class="prev prev-clear"><i></i></span><b>Vidro claro</b><span>Quase transparente; o texto se adapta ao fundo.</span></button>
      </div>
      <div class="reveal ${glassy ? 'shown' : ''}" id="glassOpts">
        <div class="group">
          ${cell('Transparência', '', `<div class="range-cell"><input type="range" min="5" max="65" id="sclear" value="${Math.round((1 - t.opacity) * 100)}" aria-label="Transparência do vidro" /><div class="range-ends"><span>Firme</span><span>Transparente</span></div></div>`)}
          ${cell('Desfoque', '', `<div class="range-cell"><input type="range" min="0" max="48" id="sblur" value="${Number(t.blur ?? 24)}" aria-label="Desfoque do vidro" /><div class="range-ends"><span>Nítido</span><span>Fosco</span></div></div>`)}
          ${cell('Desfoque real da tela', 'A Alma lê a imagem da tela só para desenhar o vidro — nada é gravado nem enviado. Enquanto ligado, a ilha não aparece em prints e gravações de tela.', toggle('sreal', t.realBlur !== false, 'Desfoque real da tela'))}
          ${cell('Refração nas bordas', 'A borda do vidro dobra a imagem de trás, como uma lente, e brilha com o mouse.', toggle('slens', t.lens !== false, 'Refração nas bordas'))}
        </div>
      </div>

      <h2>Cor do app</h2>
      <div class="group pad">
        <div class="swatches">${Theme.PRESETS.map(
          ([n, c]) => `<button class="swatch ${c === base ? 'on' : ''}" data-base="${c}" style="--c:${c}" title="${n}"><span></span><em>${n}</em></button>`,
        ).join('')}
          <label class="swatch custom ${isPreset ? '' : 'on'}" title="Escolher qualquer cor" style="--c:${isPreset ? 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' : base}">
            <input type="color" id="sbase" value="${esc(base)}" /><span></span><em>Sua cor</em></label>
        </div>
      </div>

      <h2>Cor de destaque</h2>
      <div class="group pad">
        <div class="swatches">${Theme.ACCENTS.map(
          ([n, h]) =>
            `<button class="swatch accent ${accentOn(h) ? 'on' : ''}" data-accent="${h ?? 'neutral'}" style="--c:${h === null ? 'linear-gradient(135deg, #f4f4f6 50%, #2c2d33 50%)' : `hsl(${h} 85% 60%)`}" title="${n}"><span></span><em>${n}</em></button>`,
        ).join('')}</div>
        <div class="field-row" style="margin:18px 0 0"><label for="shue">Ajuste fino (também é o brilho da Alminha)</label><div class="hue-bar"></div><input type="range" min="0" max="360" id="shue" value="${S.hue ?? 196}" /></div>
      </div>

      <h2>Alminha</h2>
      <div class="group pad">
        <div class="swatches">${Object.entries(Theme.BODIES)
          .map(
            ([id, [n, hi, c, sh, , visor]]) =>
              `<button class="swatch body ${(t.body || 'cream') === id ? 'on' : ''}" data-body="${id}" style="--hi:${hi};--c:${c};--sh:${sh};--visor:${visor}" title="${n}"><span></span><em>${n}</em></button>`,
          )
          .join('')}</div>
      </div>

      <h2>Forma e tamanho</h2>
      <div class="group">
        ${cell('Cantos', '', seg('radius', [['soft', 'Suaves'], ['normal', 'Padrão'], ['round', 'Redondos']], t.radius || 'normal', 'Cantos'))}
        ${cell('Tamanho do texto', 'Nos painéis da ilha e nesta janela.', seg('text', [['small', 'P'], ['normal', 'Padrão'], ['large', 'G'], ['xl', 'GG']], t.text || 'normal', 'Tamanho do texto'))}
        ${cell('Ícones da hotbar', '', seg('dock', [['s', 'Pequenos'], ['m', 'Médios'], ['l', 'Grandes']], t.dock || 'm', 'Ícones da hotbar'))}
      </div>

      <h2>Ilha</h2>
      <div class="group">
        ${cell('Nome', 'Aparece nas notificações e aqui no alto.', `<input class="input compact" id="sname" value="${esc(S.name)}" aria-label="Nome" />`)}
        ${cell('Relógio', '', seg('clock', [['time', 'Hora'], ['date', 'Dia e hora'], ['none', 'Esconder']], t.clock || 'time', 'Relógio'))}
        ${cell('Temperatura do ar', 'Mostra a temperatura ao lado do relógio quando o ar está ligado.', toggle('sacmini', t.acMini !== false, 'Temperatura do ar na ilha'))}
      </div>
      <p class="muted small" style="margin:4px 16px 0">Transparência, contraste, jeito de aparecer e posição da ilha ficam em <a href="#access">Acessibilidade</a>.</p>`;
  },

  access() {
    const o = isl();
    const t = theme();
    const sysT = matchMedia('(prefers-reduced-transparency: reduce)').matches;
    const sysC = matchMedia('(prefers-contrast: more)').matches;
    const SHORTCUTS = [
      ['', 'Desligado'],
      ['Control+Alt+A', 'Ctrl + Alt + A'],
      ['Control+Alt+Space', 'Ctrl + Alt + Espaço'],
      ['Control+Shift+Space', 'Ctrl + Shift + Espaço'],
      ['Alt+Shift+A', 'Alt + Shift + A'],
    ];
    return `
      <h1>Acessibilidade</h1>
      <p class="lead">Como a ilha aparece, onde ela fica e jeitos de usar a Alma com mais conforto — inclusive só pelo teclado.</p>

      <h2>Aparecer e sumir</h2>
      <div class="group">
        ${cell('Quando parada, a ilha fica', 'Sempre visível: a cápsula fica à vista. Linha fina: vira um risquinho no topo. Escondida: some de vez e só volta quando você para o mouse no lugar dela.', seg('reveal', [['always', 'Sempre visível'], ['line', 'Linha fina'], ['hidden', 'Escondida']], o.reveal, 'Como a ilha fica quando parada'))}
        ${cell('Tempo com o mouse em cima para aparecer', 'Mais tempo evita que ela abra sem querer quando você passa rumo às abas do navegador.', seg('hoverDelay', [['0', 'Na hora'], ['180', 'Rápido'], ['500', 'Médio'], ['1000', 'Devagar']], String(o.hoverDelay), 'Tempo para aparecer'))}
        ${cell('Recolher depois de', 'Quanto tempo ela espera depois que o mouse sai.', seg('hideAfter', [['1000', '1 s'], ['2500', '2,5 s'], ['5000', '5 s'], ['10000', '10 s']], String(o.hideAfter), 'Recolher depois de'))}
        ${cell('Abrir o painel só passando o mouse', 'Sem precisar clicar: pare o mouse na ilha por meio segundo. A hotbar deixa de descer sozinha.', toggle('ahoveropen', o.hoverOpen, 'Abrir o painel passando o mouse'))}
        ${cell('Esconder com app em tela cheia', 'Some durante jogos, vídeos e apresentações em tela cheia e volta quando você sair deles.', toggle('afull', o.hideFullscreen, 'Esconder com app em tela cheia'))}
      </div>

      <h2>Posição</h2>
      <div class="group">
        ${cell('Lugar no topo da tela', 'O painel, a hotbar e os avisos descem do mesmo lugar.', seg('position', [['left', 'Esquerda'], ['center', 'Centro'], ['right', 'Direita']], o.position, 'Lugar no topo da tela'))}
        ${cell('Monitor', 'Em qual tela a ilha fica.', `<select class="input compact" id="adisplay" aria-label="Monitor"><option value="primary">Monitor principal</option></select>`)}
      </div>

      <h2>Teclado</h2>
      <div class="group">
        ${cell(
          'Atalho para abrir o painel',
          'Funciona em qualquer app. Com o painel aberto: <kbd>←</kbd> <kbd>→</kbd> trocam de aba, <kbd>Tab</kbd> passa pelos botões, <kbd>Enter</kbd> aciona e <kbd>Esc</kbd> fecha.',
          `<select class="input compact" id="ashortcut" aria-label="Atalho para abrir o painel">${SHORTCUTS.map(([v, l]) => `<option value="${v}" ${v === (o.shortcut || '') ? 'selected' : ''}>${l}</option>`).join('')}</select>`,
        )}
      </div>

      <h2>Visão</h2>
      <div class="group">
        ${cell('Tamanho do texto', 'Nos painéis da ilha e nesta janela.', seg('text', [['small', 'P'], ['normal', 'Padrão'], ['large', 'G'], ['xl', 'GG']], t.text || 'normal', 'Tamanho do texto'))}
        ${cell('Reduzir transparência', sysT ? 'O Windows já está com a transparência desligada, e a Alma segue.' : 'Troca o vidro por superfícies sólidas.', toggle('ssolid', Boolean(t.solid) || sysT, 'Reduzir transparência'))}
        ${cell('Aumentar contraste', sysC ? 'O Windows já está com contraste alto, e a Alma segue.' : 'Textos mais fortes e bordas mais marcadas.', toggle('scontrast', Boolean(t.contrast) || sysC, 'Aumentar contraste'))}
      </div>

      <h2>Movimento</h2>
      <div class="group">
        ${cell(
          'Animações',
          matchMedia('(prefers-reduced-motion: reduce)').matches
            ? 'Os "Efeitos de animação" do Windows estão desligados — em "Seguir o Windows" a Alma só esmaece.'
            : 'Movimento da ilha, da Alminha, dos painéis e das listas.',
          `<select class="input compact" id="gmotion" aria-label="Animações">${[
            ['system', 'Seguir o Windows'],
            ['full', 'Sempre ligadas'],
            ['reduced', 'Reduzidas'],
          ]
            .map(([v, l]) => `<option value="${v}" ${v === (S.motion || 'full') ? 'selected' : ''}>${l}</option>`)
            .join('')}</select>`,
        )}
      </div>`;
  },

  modules() {
    const f = fo();
    const t = tro();
    const c = co();
    const langs = Object.entries(LANGS);
    const langSel = (id, cur, label) => `<select class="input compact" id="${id}" aria-label="${esc(label)}">${langs.map(([v, l]) => opt(v, l, cur)).join('')}</select>`;
    return `
      <h1>Módulos</h1>
      <p class="lead">Escolha o que aparece quando a ilha abre e em que ordem. Arraste pela alça ou use as setas; desligue o que você não usa.</p>
      <div class="group mod-list" id="modList" role="list">${modules()
        .map(
          (m, i, all) => `<div class="cell mod-row" role="listitem" draggable="true" data-mod="${m.id}">
            <span class="mod-grip" aria-hidden="true">${I.grip}</span>
            <span class="tile t-mod">${MODULES[m.id][2]}</span>
            <div class="cell-txt"><div>${MODULES[m.id][0]}</div><div class="cell-sub">${MODULES[m.id][1]}</div></div>
            <div class="row mod-ctl">
              <button class="icon-btn" data-move="-1" ${i === 0 ? 'disabled' : ''} title="Subir" aria-label="Subir ${MODULES[m.id][0]}"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 15 6-6 6 6"/></svg></button>
              <button class="icon-btn" data-move="1" ${i === all.length - 1 ? 'disabled' : ''} title="Descer" aria-label="Descer ${MODULES[m.id][0]}"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></button>
              ${toggle('mod-' + m.id, m.on, 'Mostrar ' + MODULES[m.id][0])}
            </div>
          </div>`,
        )
        .join('')}</div>
      <p class="muted small" style="margin:4px 16px 0">Com mais de 7 módulos ligados, as abas mostram só os ícones.</p>

      <h2>Foco</h2>
      <div class="group">
        ${cell('Tempo de foco', '', minSel('ffocus', f.focusMin, [10, 15, 20, 25, 30, 40, 45, 50, 60, 90], 'Tempo de foco'))}
        ${cell('Pausa curta', '', minSel('fshort', f.shortMin, [3, 5, 10, 15], 'Pausa curta'))}
        ${cell('Pausa longa', '', minSel('flong', f.longMin, [10, 15, 20, 25, 30], 'Pausa longa'))}
        ${cell('Rodadas até a pausa longa', '', seg('rounds', [['2', '2'], ['3', '3'], ['4', '4'], ['5', '5'], ['6', '6']], String(f.rounds), 'Rodadas até a pausa longa'))}
        ${cell('Começar a pausa sozinho', 'Quando o foco acaba, a pausa já começa a contar.', toggle('fautobreak', f.autoBreak, 'Começar a pausa sozinho'))}
        ${cell('Voltar ao foco sozinho', 'Quando a pausa acaba, a próxima rodada começa.', toggle('fautofocus', f.autoFocus, 'Voltar ao foco sozinho'))}
        ${cell('A Alminha dorme durante o foco', 'Ela fecha os olhos e para de se mexer para não te distrair.', toggle('fsleep', f.sleep, 'A Alminha dorme durante o foco'))}
        ${cell('Silêncio durante o foco', 'Sem avisos e notificações da Alma enquanto você foca (o fim do foco ainda avisa).', toggle('fsilent', f.silent, 'Silêncio durante o foco'))}
        ${cell('Som ao terminar', 'Um sininho curto quando o foco ou a pausa acaba.', toggle('fsound', f.sound, 'Som ao terminar'))}
      </div>

      <h2>Tradução rápida</h2>
      <div class="group">
        ${cell('Traduzir para', '', langSel('ttarget', t.target, 'Traduzir para'))}
        ${cell('Se o texto já estiver nesse idioma, traduzir para', '', langSel('talt', t.alt, 'Idioma alternativo'))}
        ${cell('Traduzir ao soltar um texto na ilha', 'Selecione um texto em qualquer app e arraste até a ilha.', toggle('tdrop', t.dropToTranslate !== false, 'Traduzir ao soltar um texto na ilha'))}
        ${cell('Copiar a tradução sozinho', '', toggle('tcopy', t.autoCopy, 'Copiar a tradução sozinho'))}
      </div>
      <p class="muted small" style="margin:4px 16px 0">A tradução usa o Google Tradutor (ou o MyMemory, se ele falhar): o texto, até 500 letras, é enviado para o serviço.</p>

      <h2>Conta-gotas</h2>
      <div class="group">
        ${cell('Formato copiado', '', seg('cformat', [['hex', 'HEX'], ['rgb', 'RGB'], ['hsl', 'HSL']], c.format, 'Formato copiado'))}
        ${cell('Copiar a cor ao escolher', 'Escolheu, já está na área de transferência.', toggle('ccopy', c.autoCopy, 'Copiar a cor ao escolher'))}
      </div>`;
  },

  actions() {
    return `
      <h1>Ações</h1>
      <p class="lead">Quando algo acontecer, a Alma faz por você. Por exemplo: quando abrir um jogo, baixar o volume, ligar o modo silencioso e esconder a ilha.</p>
      <h2>Começar de um modelo</h2>
      <div class="act-templates">${A.templates
        .map((t, i) => `<button class="act-tpl" data-tpl="${i}"><b>${esc(t.name)}</b><span>${ruleSummary(t)}</span></button>`)
        .join('')}</div>
      <h2>Suas ações</h2>
      <div id="actList"></div>
      <div class="row" style="margin-top:12px"><button class="btn primary" id="actNew">Nova ação</button></div>
      <p class="muted small" style="margin:14px 4px 0;max-width:620px">A Alma confere os apps abertos e a tela cheia a cada 2 segundos e meio. "Testar" roda a ação agora e, se ela desfaz no fim, volta tudo ao normal em 6 segundos.</p>`;
  },

  general() {
    return `
      <h1>Geral</h1>
      <div class="group">
        ${cell('Hotbar', 'Seus apps descem da ilha ao passar o mouse: clique abre ou traz para a frente; botão direito fixa, move e fecha.', toggle('gdock', S.dock !== false, 'Hotbar'))}
        ${cell('Esconder a barra de tarefas do Windows', 'Com a hotbar, a barra de baixo pode sumir: ligue "Ocultar automaticamente a barra de tarefas" na tela que vai abrir.', '<button class="btn" id="gtaskbar">Abrir</button>')}
      </div>
      <div class="group">
        ${cell('Abrir com o Windows', '', toggle('glogin', S.openAtLogin, 'Abrir com o Windows'))}
      </div>
      <h2>Atualizações</h2>
      <div class="group" id="updBox">${updateCells()}</div>
      <div class="group">
        ${cell('Versão', '', `<span class="muted">${esc(S.version)}</span>`)}
        ${cell('Fechar a Alma completamente', 'A Alma fica na bandeja do Windows (perto do relógio).', '<button class="btn danger" id="gquit">Sair</button>')}
      </div>`;
  },
};

// ---------------- ligação dos eventos por seção ----------------
const BIND = {
  ac() {
    document.querySelectorAll('[data-driver]').forEach((b) => {
      b.onclick = async () => {
        // marca na hora (a borda faz a transição), salva e depois remonta o formulário
        document.querySelectorAll('[data-driver]').forEach((x) => x.classList.toggle('on', x === b));
        await save({ ac: { driver: b.dataset.driver } }, 'Tipo de ar alterado');
        render('ac');
      };
    });
    const d = S.ac?.driver || 'demo';
    const o = { ...(S.ac?.options || {}) };
    if (d === 'smartthings') {
      $('#st_mode').onchange = async (e) => {
        await save({ ac: { options: { ...o, authMode: e.target.value } } });
        render('ac');
      };
      const authFields = async () => {
        const secret = $('#st_secret').value.trim();
        await save({ ac: { options: { ...o, authMode: 'oauth', clientId: $('#st_client').value.trim(), redirectUri: $('#st_redirect').value.trim() } }, secrets: secret ? { st_client_secret: secret } : {} });
      };
      if ($('#st_auth'))
        $('#st_auth').onclick = async () => {
          await authFields();
          const url = await api.call('st:authorize-url', $('#st_redirect').value.trim());
          api.call('open:external', url);
        };
      if ($('#st_exchange'))
        $('#st_exchange').onclick = async () => {
          await authFields();
          let code = $('#st_code').value.trim();
          try {
            code = new URL(code).searchParams.get('code') || code;
          } catch {}
          try {
            await api.call('st:exchange', { code, redirect: $('#st_redirect').value.trim() });
            toast('SmartThings conectado!');
            S = await api.call('settings:get');
            render('ac');
          } catch (e) {
            toast('Erro: ' + e.message);
          }
        };
    }
    $('#acsave').onclick = async () => {
      const status = $('#acstatus');
      const options = { ...o };
      const secrets = {};
      const val = (id) => ($('#' + id) ? $('#' + id).value.trim() : '');
      if (d === 'lg') {
        options.country = val('lg_country');
        if (val('lg_pat')) secrets.lg_pat = val('lg_pat');
      }
      if (d === 'smartthings') {
        options.authMode = val('st_mode');
        if (val('st_pat')) secrets.st_pat = val('st_pat');
        if (options.authMode === 'oauth') {
          options.clientId = val('st_client');
          options.redirectUri = val('st_redirect');
          if (val('st_secret')) secrets.st_client_secret = val('st_secret');
        }
      }
      if (d === 'tuya') {
        options.region = val('tuya_region');
        options.accessId = val('tuya_id');
        options.deviceId = val('tuya_dev');
        if (val('tuya_secret')) secrets.tuya_secret = val('tuya_secret');
      }
      if (d === 'homeassistant') {
        options.url = val('ha_url');
        if (val('ha_token')) secrets.ha_token = val('ha_token');
      }
      await save({ ac: { driver: d, options }, secrets });
      setStatus(status, '', 'Procurando aparelhos…');
      try {
        const list = await api.call('ac:list');
        if (!list.length) throw new Error('Nenhum ar-condicionado encontrado nessa conta.');
        setStatus(status, 'ok', `✓ ${list.length} aparelho(s) encontrado(s). Escolha o principal:`);
        const def = S.ac?.defaultDevice || list[0].id;
        $('#acdevices').innerHTML = list
          .map((x) => `<label><input type="radio" name="acdev" value="${esc(x.id)}" ${x.id === def ? 'checked' : ''}/> ${esc(x.name)}</label>`)
          .join('');
        M.stagger($('#acdevices').children);
        if (!S.ac?.defaultDevice) save({ ac: { defaultDevice: list[0].id } }, 'Aparelho principal definido');
        document.querySelectorAll('[name=acdev]').forEach((r) => (r.onchange = () => save({ ac: { defaultDevice: r.value } }, 'Aparelho principal definido')));
      } catch (e) {
        setStatus(status, 'err', '✗ ' + e.message);
      }
    };
  },

  soul() {
    const mark = (sel, on) => main.querySelectorAll(sel).forEach((el) => el.classList.toggle('on', on(el)));
    // nome: salva sozinho um instante depois de parar de digitar
    $('#sname').oninput = (e) => saveSoon({ name: e.target.value.trim() || 'Alma' }, 'Nome salvo');

    // a Alminha da prévia (estática, só olha o mouse)
    heroSoul = Mascot.mount($('#heroSoul'));
    heroSoul.setBase('happy');

    const STYLE_MSG = { solid: 'Material sólido', glass: 'Liquid Glass', clear: 'Vidro claro' };
    main.querySelectorAll('[data-style]').forEach((b) => {
      b.onclick = () => {
        const style = b.dataset.style;
        mark('[data-style]', (x) => x === b);
        $('#glassOpts').classList.toggle('shown', style !== 'solid');
        setTheme({ style }, STYLE_MSG[style]);
        if (style !== 'solid') heroSoul.react('hop');
      };
    });
    $('#sclear').oninput = (e) => setTheme({ opacity: 1 - Number(e.target.value) / 100 });
    $('#sblur').oninput = (e) => setTheme({ blur: Number(e.target.value) });
    $('#sreal').onchange = (e) => setTheme({ realBlur: e.target.checked }, e.target.checked ? 'Desfoque real ligado' : 'Desfoque real desligado');
    $('#slens').onchange = (e) => setTheme({ lens: e.target.checked }, e.target.checked ? 'Refração ligada' : 'Refração desligada');

    bindSegs((key, v) => setTheme({ [key]: v }));

    main.querySelectorAll('[data-body]').forEach((b) => {
      b.onclick = () => {
        mark('[data-body]', (x) => x === b);
        setTheme({ body: b.dataset.body }, 'Cor da Alminha alterada');
        brandSoul.emote('love', 1200);
        brandSoul.react('twirl');
        heroSoul.react('hop');
      };
    });
    $('#sacmini').onchange = (e) => setTheme({ acMini: e.target.checked });

    main.querySelectorAll('[data-base]').forEach((b) => {
      b.onclick = () => {
        mark('[data-base], .swatch.custom', (x) => x === b);
        $('#sbase').value = b.dataset.base;
        setTheme({ base: b.dataset.base }, 'Cor alterada');
      };
    });
    $('#sbase').oninput = (e) => {
      const c = e.target.value;
      mark('[data-base], .swatch.custom', (x) => x.classList.contains('custom'));
      $('.swatch.custom').style.setProperty('--c', c);
      setTheme({ base: c });
    };

    main.querySelectorAll('[data-accent]').forEach((b) => {
      b.onclick = () => {
        const v = b.dataset.accent;
        if (v !== 'neutral') {
          S.hue = Number(v);
          $('#shue').value = v;
        }
        mark('[data-accent]', (x) => x === b);
        setTheme({ accent: v === 'neutral' ? 'neutral' : 'hue' }, 'Destaque alterado');
      };
    });
    $('#shue').oninput = (e) => {
      S.hue = Number(e.target.value);
      mark('[data-accent]', () => false);
      setTheme({ accent: 'hue' });
    };
  },

  access() {
    const MSG = {
      reveal: { always: 'Ilha sempre visível', line: 'Ilha vira uma linha fina', hidden: 'Ilha some quando parada' },
      position: { left: 'Ilha à esquerda', center: 'Ilha no centro', right: 'Ilha à direita' },
    };
    bindSegs((key, v) => {
      if (key === 'text') return setTheme({ text: v });
      saveIsland({ [key]: key === 'hoverDelay' || key === 'hideAfter' ? Number(v) : v }, MSG[key]?.[v] || 'Salvo');
    });
    $('#ahoveropen').onchange = (e) => saveIsland({ hoverOpen: e.target.checked }, e.target.checked ? 'Painel abre ao passar o mouse' : 'Painel abre com clique');
    $('#afull').onchange = (e) => saveIsland({ hideFullscreen: e.target.checked }, e.target.checked ? 'Some com app em tela cheia' : 'Fica à vista em tela cheia');
    // monitores ligados agora
    api.call('screen:displays').then((list) => {
      const sel = $('#adisplay');
      if (!sel) return;
      const cur = String(isl().display || 'primary');
      sel.innerHTML = `<option value="primary">Sempre o principal</option>${list.map((d) => `<option value="${esc(d.id)}" ${d.id === cur ? 'selected' : ''}>${esc(d.label)}</option>`).join('')}`;
      sel.disabled = list.length < 2;
      if (list.length < 2) sel.title = 'Só há um monitor ligado';
    });
    $('#adisplay').onchange = (e) => saveIsland({ display: e.target.value }, 'Monitor da ilha alterado');
    $('#ashortcut').onchange = async (e) => {
      const v = e.target.value;
      await saveIsland({ shortcut: v }, v ? `Atalho: ${e.target.selectedOptions[0].textContent}` : 'Atalho desligado');
      S = await api.call('settings:get');
      if ((isl().shortcut || '') !== v) render('access'); // outro programa já usa esse atalho: volta para o que ficou
    };
    $('#ssolid').onchange = (e) => setTheme({ solid: e.target.checked }, e.target.checked ? 'Transparência reduzida' : 'Transparência normal');
    $('#scontrast').onchange = (e) => setTheme({ contrast: e.target.checked }, e.target.checked ? 'Contraste aumentado' : 'Contraste normal');
    // quando o Windows já decide, o botão só mostra o estado
    if (matchMedia('(prefers-reduced-transparency: reduce)').matches) $('#ssolid').disabled = true;
    if (matchMedia('(prefers-contrast: more)').matches) $('#scontrast').disabled = true;
    $('#gmotion').onchange = (e) => save({ motion: e.target.value }, 'Animações alteradas');
  },

  modules() {
    const list = $('#modList');
    const saveMods = (msg) => {
      const mods = [...list.querySelectorAll('.mod-row')].map((r) => ({ id: r.dataset.mod, on: r.querySelector('.toggle').checked }));
      if (!mods.some((m) => m.on)) {
        toast('Deixe pelo menos um módulo ligado');
        return false;
      }
      S = { ...S, modules: mods };
      save({ modules: mods }, msg);
      list.querySelectorAll('.mod-row').forEach((r, i, all) => {
        r.querySelector('[data-move="-1"]').disabled = i === 0;
        r.querySelector('[data-move="1"]').disabled = i === all.length - 1;
      });
      return true;
    };
    // as outras linhas deslizam até o lugar novo (FLIP), em vez de pular
    const moveRow = (row, before) => {
      const rows = [...list.children];
      const first = new Map(rows.map((r) => [r, r.getBoundingClientRect().top]));
      list.insertBefore(row, before);
      if (M.reduce.matches) return;
      for (const r of rows) {
        const dy = first.get(r) - r.getBoundingClientRect().top;
        if (dy) r.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 220, easing: 'cubic-bezier(0.77, 0, 0.175, 1)' });
      }
    };
    list.querySelectorAll('.mod-row').forEach((row) => {
      const tg = row.querySelector('.toggle');
      tg.onchange = () => {
        if (!saveMods(`${MODULES[row.dataset.mod][0]} ${tg.checked ? 'aparece no painel' : 'escondido'}`)) tg.checked = true;
        row.classList.toggle('off', !tg.checked);
      };
      row.classList.toggle('off', !tg.checked);
      row.querySelectorAll('[data-move]').forEach(
        (b) =>
          (b.onclick = () => {
            const up = b.dataset.move === '-1';
            const target = up ? row.previousElementSibling : row.nextElementSibling?.nextElementSibling;
            moveRow(row, target || null);
            saveMods('Ordem salva');
            b.disabled ? row.querySelector(`[data-move="${up ? 1 : -1}"]`).focus() : b.focus();
          }),
      );
      // arrastar pela linha: as outras abrem espaço enquanto você arrasta
      row.ondragstart = (e) => {
        if (e.target.closest('button, input')) return e.preventDefault();
        row.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', row.dataset.mod);
      };
      row.ondragend = () => {
        row.classList.remove('dragging');
        saveMods('Ordem salva');
      };
    });
    list.ondragover = (e) => {
      const drag = list.querySelector('.dragging');
      if (!drag) return;
      e.preventDefault();
      const over = e.target.closest('.mod-row');
      if (!over || over === drag) return;
      const r = over.getBoundingClientRect();
      const after = e.clientY > r.top + r.height / 2;
      const ref = after ? over.nextElementSibling : over;
      if (ref !== drag && ref !== drag.nextElementSibling) moveRow(drag, ref);
    };

    const saveFocus = (patch, msg = 'Salvo') => {
      S = { ...S, focus: { ...fo(), ...patch } };
      save({ focus: patch }, msg);
    };
    $('#ffocus').onchange = (e) => saveFocus({ focusMin: Number(e.target.value) }, `Foco de ${e.target.value} min`);
    $('#fshort').onchange = (e) => saveFocus({ shortMin: Number(e.target.value) }, `Pausa curta de ${e.target.value} min`);
    $('#flong').onchange = (e) => saveFocus({ longMin: Number(e.target.value) }, `Pausa longa de ${e.target.value} min`);
    for (const [id, k] of [['fautobreak', 'autoBreak'], ['fautofocus', 'autoFocus'], ['fsleep', 'sleep'], ['fsilent', 'silent'], ['fsound', 'sound']])
      $('#' + id).onchange = (e) => saveFocus({ [k]: e.target.checked });
    bindSegs((key, v) => {
      if (key === 'rounds') saveFocus({ rounds: Number(v) }, `Pausa longa a cada ${v} rodadas`);
      if (key === 'cformat') save({ color: { format: v } }, `Copiar em ${v.toUpperCase()}`);
    });
    $('#ttarget').onchange = (e) => save({ translate: { target: e.target.value } }, `Traduzir para ${e.target.selectedOptions[0].textContent}`);
    $('#talt').onchange = (e) => save({ translate: { alt: e.target.value } });
    $('#tdrop').onchange = (e) => save({ translate: { dropToTranslate: e.target.checked } });
    $('#tcopy').onchange = (e) => save({ translate: { autoCopy: e.target.checked } });
    $('#ccopy').onchange = (e) => save({ color: { autoCopy: e.target.checked } });
  },

  actions() {
    main.querySelectorAll('[data-tpl]').forEach(
      (b) =>
        (b.onclick = () => {
          const t = A.templates[Number(b.dataset.tpl)];
          editRule({ ...structuredClone(t), id: 'nova-' + Date.now().toString(36), on: true });
        }),
    );
    $('#actNew').onclick = () => editRule({ id: 'nova-' + Date.now().toString(36), name: '', on: true, when: { type: 'app_open', app: null }, do: [{ type: 'volume', level: 35 }], undo: true });
    drawActions();
  },

  general() {
    $('#gdock').onchange = (e) => save({ dock: e.target.checked }, e.target.checked ? 'Hotbar ativada' : 'Hotbar desativada');
    $('#gtaskbar').onclick = () => api.call('open:taskbar-settings');
    $('#glogin').onchange = (e) => save({ openAtLogin: e.target.checked });
    $('#gquit').onclick = () => api.call('app:quit');
  },
};

// marcador do menu desliza até a seção escolhida
const navInd = $('#navInd');
function moveNav(instant) {
  const a = $('#nav a.on');
  if (!a) return;
  if (instant) navInd.style.transition = 'none';
  navInd.style.height = a.offsetHeight + 'px';
  navInd.style.transform = `translateY(${a.offsetTop}px)`;
  if (instant) {
    navInd.offsetWidth; // aplica a posição sem animar antes de religar a transição
    navInd.style.transition = '';
  }
}

let current = null;
function render(section) {
  if (!SECTIONS[section]) section = 'ac';
  const first = current === null;
  const changed = section !== current;
  current = section;
  main.innerHTML = SECTIONS[section]();
  BIND[section]();
  main.querySelectorAll('input[type=range]').forEach(fillRange);
  document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('on', a.getAttribute('href') === '#' + section));
  moveNav(first);
  if (changed) {
    // seção nova: o conteúdo entra em sequência, de cima para baixo
    main.scrollTop = 0;
    M.stagger(main.children, { step: 40, max: 8 });
  } else {
    // mesma seção remontada (ex.: trocou o tipo de ar): só o formulário entra
    M.stagger(main.querySelectorAll('.card'), { max: 2 });
  }
}

addEventListener('hashchange', () => render(location.hash.slice(1)));
api.on('settings:section', (s) => {
  location.hash = s;
  render(s);
});
api.on('settings', (s) => {
  S = s;
  applyTheme();
});
api.on('data', (p) => Object.assign(data, p));

(async () => {
  S = await api.call('settings:get');
  data = await api.call('data:get');
  [LANGS, A.templates, A.list] = await Promise.all([api.call('translate:langs'), api.call('actions:templates'), api.call('actions:list')].map((p) => p.catch(() => [])));
  applyTheme();
  render(location.hash.slice(1) || 'ac');
})();
