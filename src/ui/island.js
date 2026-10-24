// Ilha da Alma: a Alminha, relógio e painéis rápidos.
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const I = window.ICONS;
const M = window.Motion;
const api = window.alma;

const pill = $('#pill');
const pillWrap = $('#pillWrap');
const panel = $('#panel');
const view = $('#view');
const alminha = Mascot.mount($('#soul'), { fxLayer: $('#fx') });

let data = { todos: [], schedules: [], clipboard: [], dock: [], settings: {} };
let tab = localStorage.getItem('tab') || 'ac';
let acState = null;
let acDevices = [];
let acError = '';
const skipRender = {}; // mudanças que a interface já aplicou de forma otimista
// temporizador e foco (o tempo corre no processo principal; ver "Temporizador e foco" abaixo)
let F = { mode: 'pomodoro', phase: 'idle', running: false, round: 1, total: 0, left: 0, elapsed: 0, timerMin: 10, opts: {} };

// =========================================================
// Modos da ilha: dormant (linha recolhida) · compact (cápsula)
// =========================================================
// comportamento e lugar (Configurações › Acessibilidade); `reveal` antigo vinha de `discreet`
const ISLAND_DEFAULTS = { reveal: null, hoverDelay: 180, hideAfter: 2500, hoverOpen: false, position: 'center' };
function isl() {
  const o = { ...ISLAND_DEFAULTS, ...(data.settings.island || {}) };
  o.reveal ||= data.settings.discreet === false ? 'always' : 'line';
  return o;
}
// centro da ilha dentro da janela (o mesmo que o main.js usa para posicionar a janela)
const ISLAND_CX = { left: 250, center: 380, right: 510 };
function applyIsland() {
  const o = isl();
  const root = document.documentElement;
  root.dataset.reveal = o.reveal;
  root.dataset.pos = ISLAND_CX[o.position] ? o.position : 'center';
  root.style.setProperty('--cx', `${ISLAND_CX[root.dataset.pos]}px`);
}
let mode = 'dormant'; // começa recolhida na borda e desce ao abrir
let lastActivity = Date.now();
let pointerInPill = false;
let pointerInDock = false;
let toastCount = 0;

const panelOpen = () => panel.classList.contains('open');

function computeMode() {
  if (panelOpen() || pointerInPill || pointerInDock || toastCount > 0 || dropOpen) return 'compact';
  const o = isl();
  if (o.reveal === 'always') return 'compact';
  return Date.now() - lastActivity > o.hideAfter ? 'dormant' : 'compact';
}

function updateMode() {
  const m = computeMode();
  if (m !== mode) {
    mode = m;
    pill.dataset.mode = m;
  }
  updateFace();
  updateDock();
}

// ---------- Alminha: o rosto de fundo acompanha a ilha ----------
const SLEEPY_AFTER = 45000; // parada à vista por muito tempo → cochila
let face = 'sleepy';
function baseFace() {
  if (mode === 'dormant') return 'sleepy'; // recolhe "indo dormir"
  if (focusSleeping()) return 'sleepy'; // modo foco: ela cochila junto (dá para desligar em Módulos › Foco)
  if (pointerInPill) return 'happy'; // mouse em cima: sorri
  if (!panelOpen() && Date.now() - lastActivity > SLEEPY_AFTER) return 'sleepy';
  return 'neutral';
}
function updateFace() {
  const f = baseFace();
  if (f === face) return;
  const was = face;
  face = f;
  // antes de cochilar à vista, boceja; ao acordar, se espreguiça (ou só levanta, se veio da linha recolhida)
  if (f === 'sleepy' && was === 'neutral' && mode !== 'dormant') {
    alminha.yawn();
    setTimeout(() => alminha.setBase(face), 1500);
    return;
  }
  alminha.setBase(f);
  if (was === 'sleepy') Math.random() < 0.4 ? (alminha.react('stretch'), alminha.emote('happy', 1100)) : alminha.react('perk');
}
alminha.setBase('sleepy');
// gestos ociosos de vez em quando, só com a cápsula à vista
alminha.startIdle(() => mode === 'compact' && !document.hidden && !focusSleeping());
setInterval(updateMode, 400);
const touch = () => {
  lastActivity = Date.now();
  updateMode();
};

// retângulo visível da cápsula (a linha recolhida usa a mesma área para acordar)
function pillRect() {
  const r = pillWrap.getBoundingClientRect();
  return { left: r.left + 86, right: r.right - 86, top: r.top, bottom: r.top + 38 };
}
const inRect = (x, y, r) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;

// mouse chegou na ilha: ela acena (no máximo a cada 30 s, para não cansar)
let lastGreet = 0;
function greet() {
  if (Date.now() - lastGreet < 30000) return;
  lastGreet = Date.now();
  setTimeout(() => alminha.react('wave'), 250);
}

// ---------- relógio + mini status do ar (o que aparece é escolhido em Aparência) ----------
function renderPillRight() {
  const look = { ...Theme.DEFAULT, ...(data.settings.theme || {}) };
  const now = new Date();
  const hm = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const day = now.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric' }).replace('.', '');
  const t = look.clock === 'none' ? '' : look.clock === 'date' ? `<span class="pr-day">${esc(day)}</span><span>${hm}</span>` : `<span>${hm}</span>`;
  let ac = '';
  if (look.acMini !== false && acState && acState.power && acState.temperature != null)
    ac = `<span class="acmini ${acState.mode === 'heat' ? 'heat' : ''}">${acState.turbo ? `<i class="acturbo" title="Turbo">${I.bolt}</i>` : ''}${acState.mode === 'heat' ? I.sun : I.snow}${acState.temperature}°</span>`;
  // foco em andamento: o tempo (com um anel de progresso) toma o lugar do relógio
  const focusChip =
    focusActive()
      ? `<span class="pr-focus" data-phase="${F.phase}" data-running="${F.running}"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.5" pathLength="100"/><circle class="pf" cx="10" cy="10" r="7.5" pathLength="100" style="stroke-dashoffset:${(100 - fProgress() * 100).toFixed(1)}"/></svg>${fTime()}</span>`
      : '';
  const moon = silentMode ? `<i class="pr-moon" title="Modo silencioso">${I.moon}</i>` : '';
  $('#pillRight').innerHTML = `${moon}${focusChip ? '' : ac}${focusChip || t}`;
  // ilha recolhida durante o foco: a linha fina vira uma barrinha de progresso
  pill.style.setProperty('--fp', focusActive() && F.mode !== 'watch' ? fProgress().toFixed(3) : '0');
  pill.classList.toggle('focusing', focusActive() && F.mode !== 'watch');
}
let silentMode = false;
api.on('silent', (on) => {
  silentMode = on;
  renderPillRight();
});
api.call('silent:get').then((on) => ((silentMode = on), renderPillRight())).catch(() => {});
setInterval(renderPillRight, 10000);

// =========================================================
// Mouse: a janela é transparente e "atravessável" fora dos elementos visíveis
// =========================================================
let interactive = false;
let wakeTimer = null;
let hoverOpenTimer = null;
function setInteractive(v) {
  if (v === interactive) return;
  interactive = v;
  api.send('island:mouse', v);
}
document.addEventListener('mousemove', (e) => {
  internalDrag = false; // um arrasto que saiu da bandeja já terminou
  alminha.look(e.clientX, e.clientY); // os olhos dela seguem o ponteiro
  alminha.lean(e.clientX); // e o corpo se inclina de leve para o mesmo lado
  const inPill = inRect(e.clientX, e.clientY, pillRect());
  if (!inPill) {
    clearTimeout(wakeTimer);
    clearTimeout(hoverOpenTimer);
    wakeTimer = hoverOpenTimer = null;
    if (pointerInPill) {
      pointerInPill = false;
      lastActivity = Date.now();
      updateMode();
    }
  } else if (!pointerInPill) {
    const enter = () => {
      pointerInPill = true;
      touch();
      greet();
      // "abrir o painel passando o mouse": abre depois de um instante com o mouse em cima
      if (isl().hoverOpen && !panelOpen()) hoverOpenTimer = setTimeout(() => pointerInPill && openPanel(), 550);
    };
    if (mode === 'dormant') {
      // acorda só se o mouse ficar ali o tempo escolhido (passar rápido rumo às abas do navegador não acorda)
      const wait = isl().hoverDelay;
      if (wait <= 0) enter();
      else
        wakeTimer ??= setTimeout(() => {
          wakeTimer = null;
          enter();
        }, wait);
    } else enter();
  }
  // hotbar: conta como "dentro" com uma folguinha em volta, para não fechar ao passar rente à borda
  const inDock = dockOpen && inRect(e.clientX, e.clientY, padRect(dockEl.getBoundingClientRect(), 8));
  if (inDock !== pointerInDock) {
    pointerInDock = inDock;
    updateMode();
  }
  const t = e.target;
  const over = (mode !== 'dormant' && inPill) || inDock || (panelOpen() && panel.contains(t)) || Boolean(t.closest && t.closest('.toast')) || (dropOpen && inDropZone(e.clientX, e.clientY));
  setInteractive(over);
});

// =========================================================
// Bandeja de arquivos — arraste arquivos para a ilha; eles ficam 12 h na aba Bandeja
// =========================================================
const dropEl = $('#drop');
$('.drop-ic', dropEl).innerHTML = I.dropIn;
let dropOpen = false;
let dragDepth = 0;
let dropHideT = null;
let internalDrag = false; // arrasto que começou na própria bandeja (não é para guardar de novo)
// o que está chegando: arquivos (vão para a bandeja) ou texto selecionado (vai para a tradução)
const dragKind = (e) => {
  const types = [...(e.dataTransfer?.types || [])];
  if (types.includes('Files')) return 'files';
  if (types.includes('text/plain') && data.settings.translate?.dropToTranslate !== false) return 'text';
  return '';
};
const isFileDrag = (e) => Boolean(dragKind(e));
const DROP_TEXT = {
  files: ['Solte para guardar na bandeja', 'Fica aqui por 12 horas, pronto para enviar ou mover'],
  text: ['Solte para traduzir', 'A tradução aparece no painel, pronta para copiar'],
};
// arrastos que começam dentro da própria ilha (texto do painel, itens da bandeja) não são para guardar
document.addEventListener('dragstart', () => (internalDrag = true), true);
document.addEventListener('dragend', () => (internalDrag = false), true);
// o processo principal segurou o mouse porque alguém está arrastando algo até a ilha
api.on('island:catch', () => (interactive = true));
// onde dá para soltar: a ilha, a área "Solte aqui" e o painel aberto. Fora disso a janela volta a deixar o
// arquivo passar para o que está embaixo (a ilha é uma janela grande e transparente).
function inDropZone(x, y) {
  return (
    inRect(x, y, padRect(pillRect(), 10)) ||
    (dropOpen && inRect(x, y, padRect(dropEl.getBoundingClientRect(), 14))) ||
    (panelOpen() && inRect(x, y, panel.getBoundingClientRect()))
  );
}
function showDrop() {
  clearTimeout(dropHideT);
  if (dropOpen) return;
  dropOpen = true;
  hideDock();
  dropEl.classList.add('open');
  document.body.classList.add('drop-open');
  touch();
  alminha.emote('surprised', 900); // "opa, o que é isso?"
  alminha.react('perk');
}
function hideDrop(now) {
  clearTimeout(dropHideT);
  const go = () => {
    dropOpen = false;
    dragDepth = 0;
    dropEl.classList.remove('open', 'hot');
    document.body.classList.remove('drop-open');
    touch();
  };
  now ? go() : (dropHideT = setTimeout(go, 160));
}
document.addEventListener('dragenter', (e) => {
  if (!isFileDrag(e) || internalDrag) return;
  e.preventDefault();
  dragDepth++;
  const [title, sub] = DROP_TEXT[dragKind(e)];
  $('.drop-in b', dropEl).textContent = title;
  $('.drop-in small', dropEl).textContent = sub;
  $('.drop-ic', dropEl).innerHTML = dragKind(e) === 'text' ? I.translate : I.dropIn;
  showDrop();
});
document.addEventListener('dragover', (e) => {
  if (!isFileDrag(e) || internalDrag) return;
  if (!inDropZone(e.clientX, e.clientY)) {
    setInteractive(false); // deixa o arquivo seguir para a janela de baixo
    return;
  }
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
  const hot = inRect(e.clientX, e.clientY, padRect(dropEl.getBoundingClientRect(), 14)) || inRect(e.clientX, e.clientY, padRect(pillRect(), 10));
  if (hot !== dropEl.classList.contains('hot')) {
    dropEl.classList.toggle('hot', hot);
    if (hot) alminha.emote('excited', 1200); // braços abertos para pegar
  }
});
document.addEventListener('dragleave', (e) => {
  if (!isFileDrag(e)) return;
  if (--dragDepth <= 0) {
    hideDrop();
    setInteractive(false); // o arrasto saiu da ilha: ela volta a deixar o mouse passar
  }
});
document.addEventListener('drop', async (e) => {
  if (!isFileDrag(e)) return;
  e.preventDefault();
  const wasInternal = internalDrag;
  const kind = dragKind(e);
  hideDrop(true);
  if (wasInternal) return;
  if (kind === 'text') {
    // texto selecionado em qualquer app: traduz na hora
    const text = e.dataTransfer.getData('text/plain');
    alminha.emote('excited', 1000);
    alminha.react('hop');
    return translateDropped(text);
  }
  const paths = [...e.dataTransfer.files].map((f) => api.pathForFile(f)).filter(Boolean);
  if (!paths.length) return toast({ text: 'Só dá para guardar arquivos e pastas na bandeja.', kind: 'warn' });
  try {
    data.tray = await api.call('tray:add', paths);
  } catch (err) {
    return toastErr(err);
  }
  updateTrayBadge(true);
  alminha.emote('happy', 1400);
  alminha.react('hop'); // pegou!
  alminha.fx('sparkle', 3);
  toast({ text: paths.length > 1 ? `${paths.length} itens guardados na bandeja` : 'Guardado na bandeja' });
  if (panelOpen()) {
    tab = 'tray';
    render(true);
  }
});

// contador no canto da Alminha (clique abre a bandeja)
function updateTrayBadge(bump) {
  const b = $('#trayBadge');
  const n = (data.tray || []).length;
  b.hidden = !n;
  b.textContent = n > 9 ? '9+' : String(n);
  b.setAttribute('aria-label', `Bandeja: ${n} ${n === 1 ? 'item' : 'itens'}`);
  if (bump && n) M.pop(b);
}
document.addEventListener('mouseleave', () => {
  pointerInPill = false;
  pointerInDock = false;
  updateDock();
  setInteractive(false);
  alminha.look(null);
  alminha.lean(null);
  updateFace();
});

// =========================================================
// Hotbar — apps fixados + janelas abertas, no lugar da barra de tarefas do Windows
// =========================================================
const dockEl = $('#dock');
const dockItemsEl = $('#dockItems');
const dockIcons = new Map(); // chave → ícone (também usado na aba Apps)
let dockOpen = false;
let dockHideT = null;
let dockPoll = null;
const padRect = (r, p) => ({ left: r.left - p, right: r.right + p, top: r.top - p, bottom: r.bottom + p });

// com "abrir o painel passando o mouse", passar o mouse é para o painel: a hotbar não desce
const wantDock = () => data.settings.dock !== false && !isl().hoverOpen && mode !== 'dormant' && !panelOpen() && (pointerInPill || pointerInDock);
function updateDock() {
  if (wantDock()) {
    clearTimeout(dockHideT);
    dockHideT = null;
    if (!dockOpen) showDock();
  } else if (dockOpen && !dockHideT) {
    dockHideT = setTimeout(() => {
      dockHideT = null;
      if (!wantDock()) hideDock();
    }, 350);
  }
}
function showDock() {
  dockOpen = true;
  dockEl.classList.add('open');
  document.body.classList.add('dock-open');
  refreshDock(true);
  clearInterval(dockPoll);
  dockPoll = setInterval(refreshDock, 1000); // só consulta as janelas enquanto a hotbar está à vista
}
function hideDock() {
  clearTimeout(dockHideT);
  dockHideT = null;
  if (!dockOpen) return;
  dockOpen = false;
  pointerInDock = false;
  clearInterval(dockPoll);
  dockEl.classList.remove('open');
  document.body.classList.remove('dock-open');
}

async function refreshDock(entering) {
  let items;
  try {
    items = await api.call('dock:state');
  } catch {
    return;
  }
  for (const it of items) if (it.icon) dockIcons.set(it.key, it.icon);
  renderDock(items, entering === true);
}

// Atualiza os botões no lugar (sem redesenhar tudo): ícones não piscam e só o que mudou anima.
function renderDock(items, entering) {
  const existing = new Map([...dockItemsEl.querySelectorAll('.dk')].map((b) => [b.dataset.key, b]));
  const added = [];
  let sep = dockItemsEl.querySelector('.dk-sep');
  const firstRunning = items.findIndex((i) => !i.pinned);
  const light = document.documentElement.dataset.tone === 'light';
  items.forEach((it, idx) => {
    const src = light && it.iconLight ? it.iconLight : it.icon; // logo próprio para tema claro, quando o app tem
    let b = existing.get(it.key);
    if (!b) {
      b = document.createElement('button');
      b.className = 'dk';
      b.dataset.key = it.key;
      const h = [...it.name].reduce((n, c) => n + c.charCodeAt(0), 0) % 360;
      b.innerHTML = `${src ? `<img src="${src}" alt="" />` : `<b style="--h:${h}">${esc(it.name[0] || '?')}</b>`}<i class="dot"></i><span class="tip"></span>`;
      added.push(b);
    } else if (src) {
      const img = b.querySelector('img');
      if (!img) b.querySelector('b')?.replaceWith(Object.assign(document.createElement('img'), { src, alt: '' }));
      else if (img.getAttribute('src') !== src) img.src = src;
    }
    existing.delete(it.key);
    b.setAttribute('aria-label', it.name);
    b.querySelector('.tip').textContent = it.windows.length > 1 ? `${it.name} · ${it.windows.length} janelas` : it.name;
    b.classList.toggle('run', it.windows.length > 0);
    b.classList.toggle('multi', it.windows.length > 1);
    b.classList.toggle('active', it.active);
    // separador entre fixados e apps só abertos
    if (idx === firstRunning && firstRunning > 0) {
      if (!sep) {
        sep = document.createElement('span');
        sep.className = 'dk-sep';
      }
      dockItemsEl.append(sep);
    }
    dockItemsEl.append(b); // append move o botão para a posição certa
  });
  if (sep && !(firstRunning > 0)) sep.remove();
  for (const b of existing.values()) M.leave(b, { x: 0, y: -4 }).then(() => b.remove());
  if (entering) M.stagger(dockEl.querySelectorAll('.dk'), { step: 22, max: 14, y: -6 });
  else if (added.length) M.stagger(added, { y: -6 });
}

dockEl.addEventListener('click', async (e) => {
  const b = e.target.closest('.dk');
  if (!b) return;
  if (b.hasAttribute('data-start')) return api.call('dock:start').catch(toastErr);
  try {
    const r = await api.call('dock:activate', b.dataset.key);
    if (r === 'launched') {
      alminha.react('hop');
      alminha.fx('sparkle', 2);
    } else if (r === 'focused') alminha.react('nod');
  } catch (err) {
    toastErr(err);
  }
  setTimeout(refreshDock, 250);
});
dockEl.addEventListener('contextmenu', (e) => {
  const b = e.target.closest('.dk[data-key]');
  if (!b) return;
  e.preventDefault();
  api.call('dock:menu', b.dataset.key).catch(toastErr);
});
api.on('dock:changed', () => dockOpen && refreshDock());
// hotbar: os ícones perto do mouse crescem de leve, como uma lupa (só com mouse e sem movimento reduzido)
const fineHover = matchMedia('(hover: hover) and (pointer: fine)');
let magX = null;
dockItemsEl.addEventListener('mousemove', (e) => {
  if (!fineHover.matches || M.reduce.matches) return;
  if (magX === null)
    requestAnimationFrame(() => {
      for (const b of dockItemsEl.querySelectorAll('.dk')) {
        const r = b.getBoundingClientRect();
        const k = Math.max(0, 1 - Math.abs(magX - (r.left + r.width / 2)) / 110);
        const ic = b.querySelector('img, b');
        if (ic) ic.style.transform = k ? `translateY(${(2 * k).toFixed(2)}px) scale(${(1 + 0.18 * k).toFixed(3)})` : '';
      }
      magX = null;
    });
  magX = e.clientX;
});
dockItemsEl.addEventListener('mouseleave', () => {
  for (const ic of dockItemsEl.querySelectorAll('.dk img, .dk b')) ic.style.transform = '';
});

// clique na ilha abre/fecha o painel. Na Alminha é cutucada (cócegas; muitas seguidas → tontinha):
// abre o painel se estiver fechado, mas não fecha — dá para cutucar à vontade.
pill.addEventListener('click', (e) => {
  if (mode === 'dormant') return;
  if (e.target.closest('#trayBadge')) {
    tab = 'tray';
    localStorage.setItem('tab', tab);
    panelOpen() ? render(true) : openPanel();
    return;
  }
  if (e.target.closest('#soul')) {
    alminha.poke();
    if (!panelOpen()) openPanel();
    return;
  }
  panelOpen() ? closePanel() : openPanel();
});
// a ilha afunda um pouquinho ao ser apertada: confirma o clique antes do painel abrir
pill.addEventListener('pointerdown', (e) => e.button === 0 && mode !== 'dormant' && pillWrap.classList.add('pressed'));
for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) pill.addEventListener(ev, () => pillWrap.classList.remove('pressed'));

// ---------- painel ----------
let closeTimer = null;
function openPanel() {
  clearTimeout(closeTimer);
  if (panelOpen()) return;
  hideDock(); // o painel ocupa o lugar da hotbar
  renderHeader();
  panel.classList.add('open');
  render(true);
  if (tab === 'ac') refreshAc();
  touch();
  alminha.react('perk'); // "vamos lá!"
}
function closePanel() {
  panel.classList.remove('open');
  stopNp();
  if (document.activeElement && panel.contains(document.activeElement)) document.activeElement.blur();
  touch();
}
panel.addEventListener('mouseleave', (e) => {
  if (e.relatedTarget && pillWrap.contains(e.relatedTarget)) return;
  clearTimeout(closeTimer);
  closeTimer = setTimeout(() => {
    const a = document.activeElement;
    if (a && panel.contains(a) && a.tagName === 'INPUT' && a.value) return;
    closePanel();
  }, 600);
});
panel.addEventListener('mouseenter', () => clearTimeout(closeTimer));
// ---------- teclado: atalho global abre/fecha; Esc fecha e devolve o foco para o app que estava na frente ----------
let keyboardOpened = false;
function closeFromKeyboard() {
  closePanel();
  if (keyboardOpened) api.send('island:blur');
  keyboardOpened = false;
}
document.addEventListener('keydown', (e) => e.key === 'Escape' && panelOpen() && closeFromKeyboard());
api.on('island:hotkey', () => {
  if (panelOpen()) return closeFromKeyboard();
  keyboardOpened = true;
  openPanel();
  api.send('island:focus');
  // o foco vai para a aba atual: Tab percorre o painel, ← → trocam de aba, Enter aciona
  setTimeout(() => $(`#tabs button[data-tab="${tab}"]`)?.focus(), 60);
});
document.addEventListener('mousedown', (e) => {
  if (e.target.closest('input, select, textarea')) api.send('island:focus');
});

// ---------- avisos ----------
function toast({ text, kind = 'info', action }) {
  const el = document.createElement(action ? 'button' : 'div');
  el.className = `toast ${kind}`;
  el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  el.append(Object.assign(document.createElement('span'), { textContent: text }));
  let dragged = false;
  // aviso de versão nova: clicar abre Configurações › Geral (novidades e "Baixar e instalar")
  if (action === 'update') el.addEventListener('click', () => !dragged && api.call('settings:open', 'general'));
  $('#toasts').append(el);
  LiquidGlass.attach(el);
  toastCount++;
  // erro: fica triste e balança; versão nova: empolgada com brilhos; aviso bom: dá um pulinho
  if (kind === 'update') {
    alminha.emote('excited', 2000);
    alminha.react('twirl');
    alminha.fx('sparkle', 5);
  } else if (kind === 'error') {
    alminha.emote('sad', 1800);
    alminha.react('shake');
  } else {
    alminha.emote('happy', 1400);
    alminha.react('hop');
  }
  touch();
  // some sozinho, mas o tempo para enquanto o mouse está em cima (dá para ler com calma)
  let left = kind === 'update' ? 12000 : kind === 'error' ? 7000 : 4000;
  let since = Date.now();
  let timer = setTimeout(dismiss, left);
  let gone = false;
  function dismiss() {
    if (gone) return;
    gone = true;
    clearTimeout(timer);
    el.classList.add('leaving');
    setTimeout(() => {
      M.collapse(el); // os avisos de baixo sobem deslizando
      toastCount--;
      touch();
    }, 200);
  }
  el.addEventListener('mouseenter', () => {
    clearTimeout(timer);
    left = Math.max(1500, left - (Date.now() - since));
  });
  el.addEventListener('mouseleave', () => {
    if (gone || drag) return;
    since = Date.now();
    timer = setTimeout(dismiss, left);
  });
  // arrastar para cima fecha (sai pelo mesmo lado por onde entrou); para baixo ele resiste e volta
  let drag = null;
  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    drag = { y: e.clientY, t: performance.now(), moved: false };
    dragged = false;
    try {
      el.setPointerCapture(e.pointerId); // continua recebendo o movimento mesmo se o mouse sair do aviso
    } catch {}
  });
  el.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dy = e.clientY - drag.y;
    if (!drag.moved && Math.abs(dy) < 4) return;
    drag.moved = true;
    el.classList.add('dragging');
    el.style.transform = `translateY(${dy < 0 ? dy : dy * 0.2}px)`;
    el.style.opacity = dy < 0 ? String(Math.max(0.2, 1 + dy / 90)) : '';
  });
  const endDrag = (e) => {
    if (!drag) return;
    const dy = e.clientY - drag.y;
    const v = dy / Math.max(1, performance.now() - drag.t); // px/ms: um "peteleco" rápido também fecha
    dragged = drag.moved;
    drag = null;
    el.classList.remove('dragging');
    el.style.transform = '';
    el.style.opacity = '';
    if (dragged && (dy < -26 || v < -0.45)) dismiss();
    else if (!gone && !el.matches(':hover')) {
      since = Date.now();
      timer = setTimeout(dismiss, left);
    }
  };
  el.addEventListener('pointerup', endDrag);
  el.addEventListener('pointercancel', endDrag);
}
const toastErr = (e) => toast({ text: e.message || String(e), kind: 'error' });
api.on('toast', toast);

// ---------- dados ----------
api.on('data', (patch) => {
  // copiou algo novo → um aceno discreto de "peguei"
  if (patch.clipboard && patch.clipboard[0]?.text !== data.clipboard?.[0]?.text) alminha.react('nod');
  let dirty = false;
  for (const [k, v] of Object.entries(patch)) {
    data[k] = v;
    if (skipRender[k] > 0) skipRender[k]--;
    else if (k !== 'tray' || tab === 'tray') dirty = true;
  }
  if (patch.tray) updateTrayBadge();
  if (dirty && panelOpen() && tab !== 'ac') render(false);
});
api.on('settings', (s) => {
  data.settings = s;
  applyHue();
  acDevices = [];
  touch();
});
api.on('ac-updated', (s) => {
  acState = s;
  acError = '';
  renderPillRight();
  if (tab === 'ac' && panelOpen()) renderAc();
});

function applyHue() {
  document.documentElement.style.setProperty('--hue', data.settings.hue ?? 196);
  const tone = document.documentElement.dataset.tone;
  const r = Theme.apply(data.settings); // cores, material e formas (Configurações › Aparência)
  LiquidGlass.configure(r);
  applyIsland(); // jeito de aparecer e lugar (Configurações › Acessibilidade)
  renderHeader();
  buildTabs(); // módulos ligados e a ordem (Configurações › Módulos)
  M.setPreference(data.settings.motion);
  renderPillRight();
  if (dockOpen && tone !== document.documentElement.dataset.tone) {
    dockItemsEl.innerHTML = ''; // troca para os logos do tom novo (claro/escuro)
    refreshDock();
  }
  if (panelOpen()) moveIndicator(true); // abas mudam de tamanho com o texto
}

// Liquid Glass: superfícies flutuantes da ilha (o conteúdo de dentro não é vidro)
LiquidGlass.attach(pill, { active: () => mode !== 'dormant', lens: false });
LiquidGlass.attach(panel, { active: panelOpen });
LiquidGlass.attach(dockEl, { active: () => dockOpen });
LiquidGlass.attach(dropEl, { active: () => dropOpen });

// =========================================================
// Módulos — o que aparece no painel e em que ordem (Configurações › Módulos); indicador desliza até a aba
// =========================================================
const MODULES = {
  ac: { icon: I.ac, label: 'Clima', title: 'Ar-condicionado' },
  focus: { icon: I.timer, label: 'Foco', title: 'Temporizador e foco' },
  music: { icon: I.music, label: 'Música', title: 'Música' },
  tasks: { icon: I.tasks, label: 'Tarefas', title: 'Tarefas' },
  tray: { icon: I.tray, label: 'Bandeja', title: 'Bandeja de arquivos' },
  translate: { icon: I.translate, label: 'Traduzir', title: 'Tradução rápida' },
  color: { icon: I.pipette, label: 'Cores', title: 'Conta-gotas de cores' },
  apps: { icon: I.apps, label: 'Apps', title: 'Apps' },
  clip: { icon: I.clip, label: 'Copiados', title: 'Área de transferência' },
  routines: { icon: I.clock, label: 'Rotinas', title: 'Rotinas' },
};
// ordem e escolha salvas; módulos novos entram no fim, ligados (as rotinas vêm desligadas: não dá mais para criar)
function moduleIds() {
  const saved = Array.isArray(data.settings.modules) ? data.settings.modules.filter((m) => MODULES[m.id]) : [];
  const known = new Set(saved.map((m) => m.id));
  const all = [...saved, ...Object.keys(MODULES).filter((id) => !known.has(id)).map((id) => ({ id, on: id !== 'routines' }))];
  const on = all.filter((m) => m.on).map((m) => m.id);
  return on.length ? on : ['ac'];
}
let tabIds = [];
function buildTabs() {
  const ids = moduleIds();
  if (ids.join() === tabIds.join()) return;
  tabIds = ids;
  const bar = $('#tabs');
  bar.querySelectorAll('button').forEach((b) => b.remove());
  // muitos módulos: só os ícones (o nome aparece ao passar o mouse e para leitores de tela)
  bar.classList.toggle('icons', ids.length > 7);
  bar.insertAdjacentHTML('beforeend', ids.map((id) => `<button role="tab" data-tab="${id}" title="${MODULES[id].title}" aria-label="${MODULES[id].title}">${MODULES[id].icon}<span>${MODULES[id].label}</span></button>`).join(''));
  if (!ids.includes(tab)) tab = ids[0];
  if (panelOpen()) render('instant');
}
$('#tabs').setAttribute('role', 'tablist');
$('#tabs').setAttribute('aria-label', 'Painéis');
// ← → trocam de aba (com o foco nas abas), como num controle de abas do sistema
$('#tabs').addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  const next = tabIds[(tabIds.indexOf(tab) + (e.key === 'ArrowRight' ? 1 : -1) + tabIds.length) % tabIds.length];
  $(`#tabs button[data-tab="${next}"]`).click();
  $(`#tabs button[data-tab="${next}"]`).focus();
  e.preventDefault();
});
// cabeçalho: o nome da Alma e a data de hoje
let brandName = null;
function renderHeader() {
  const name = data.settings.name || 'Alma';
  if (name !== brandName) {
    brandName = name;
    $('#panelBrand').innerHTML = `<span class="panel-wordmark">${esc(name)}</span><small>Seu espaço pessoal</small>`;
  }
  const d = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' }).replace('.', '');
  $('#panelDate').textContent = d.charAt(0).toUpperCase() + d.slice(1);
}
// Configurações abrem uma janela: é uma ação, não uma aba — fica no cabeçalho
$('#openSettings').innerHTML = I.gear;
$('#openSettings').addEventListener('click', () => api.call('settings:open'));
if (!MODULES[tab]) tab = 'ac';
const tabInd = $('#tabInd');
function moveIndicator(instant) {
  const b = $(`#tabs button[data-tab="${tab}"]`);
  document.querySelectorAll('#tabs button').forEach((x) => {
    x.classList.toggle('on', x === b);
    x.setAttribute('aria-selected', String(x === b));
    x.tabIndex = x === b ? 0 : -1; // Tab entra na aba atual; as setas andam entre elas
  });
  if (!b || !b.offsetWidth) return;
  if (instant) tabInd.style.transition = 'none';
  tabInd.style.width = b.offsetWidth + 'px';
  tabInd.style.transform = `translateX(${b.offsetLeft}px)`;
  if (instant) requestAnimationFrame(() => (tabInd.style.transition = ''));
}
$('#tabs').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || b.dataset.tab === tab) return;
  const dir = tabIds.indexOf(b.dataset.tab) > tabIds.indexOf(tab) ? 1 : -1;
  tab = b.dataset.tab;
  localStorage.setItem('tab', tab);
  render(dir); // o conteúdo novo entra do lado da aba escolhida
  if (tab === 'ac') refreshAc();
  alminha.react('nod'); // acompanha a troca de aba com um aceno de cabeça
});

const VIEWS = {
  ac: () => renderAc(true),
  focus: renderFocus,
  music: renderMusic,
  tasks: renderTasks,
  translate: renderTranslate,
  color: renderColor,
  routines: renderRoutines,
  clip: renderClip,
  apps: renderApps,
  tray: renderTray,
};
// animateIn: true (painel abrindo: entra em sequência) · 1/-1 (troca de aba: desliza daquele lado) · 'instant'
function render(animateIn) {
  moveIndicator(!panelOpen() || animateIn === 'instant');
  if (tab !== 'ac') acBuilt = false;
  if (tab !== 'music') stopNp();
  VIEWS[tab](animateIn);
  if (!animateIn || animateIn === 'instant') return;
  view.scrollTop = 0;
  if (animateIn === 1 || animateIn === -1) {
    // troca de aba: um deslize curto na direção da aba (onde o conteúdo "estava"), sem sequência
    if (!M.reduce.matches)
      view.animate([{ opacity: 0, transform: `translateX(${animateIn * 18}px)` }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
    return;
  }
  M.stagger(view.querySelectorAll('h3, .card-x, .list, .tray-all, .foot, #favBox, #appq, .seg-f, .ring-wrap, .f-row, .tr-langs, .tr-in, .cp-pick, .cp-hist'), { step: 30, max: 9 });
}

// =========================================================
// Ar-condicionado — montado uma vez e atualizado no lugar
// =========================================================
const MODES = [
  ['cool', I.snow, 'Frio'],
  ['heat', I.sun, 'Quente'],
  ['dry', I.drop, 'Seco'],
  ['fan', I.fan, 'Ventilar'],
  ['auto', I.auto, 'Auto'],
];
const FANS = [
  ['auto', 'Auto'],
  ['low', 'Baixa'],
  ['medium', 'Média'],
  ['high', 'Alta'],
];
let acBusy = false;
let acBuilt = false;
let shownTemp = null;

async function refreshAc() {
  try {
    if (!acDevices.length) acDevices = await api.call('ac:list');
    acState = await api.call('ac:status', acState?.id);
    acError = '';
  } catch (e) {
    acError = e.message;
  }
  renderPillRight();
  if (tab === 'ac' && panelOpen()) renderAc();
}

function buildAc() {
  view.innerHTML = `
    <div class="ac" id="ac">
      <div class="card-x ac-card">
        <div class="ac-top"><span id="acDev"></span>
          <span class="row"><span class="muted small" id="acDrv"></span>
          <button class="icon-btn" data-act="refresh" title="Atualizar" aria-label="Atualizar">${I.refresh}</button></span>
        </div>
        <div class="ac-main">
          <button class="round" data-act="minus" title="Mais frio" aria-label="Mais frio">${I.minus}</button>
          <div class="ac-temp"><span class="num" id="acNum">--</span><sup>°C</sup></div>
          <button class="round" data-act="plus" title="Mais quente" aria-label="Mais quente">${I.plus}</button>
        </div>
        <div class="ac-sub" id="acSub"></div>
        <div class="row ac-actions">
          <button class="power" id="acPow" data-act="power" title="Ligar/desligar" aria-label="Ligar ou desligar">${I.power}</button>
          <button class="turbo" id="acTurbo" data-act="turbo" title="Turbo: potência máxima para gelar (ou esquentar) rápido">${I.bolt}<span>Turbo</span></button>
        </div>
      </div>
      <div class="card-x">
        <div class="label">Modo</div>
        <div class="chips">${MODES.map(([m, ic, l]) => `<button class="chip" data-mode="${m}">${ic}${l}</button>`).join('')}</div>
        <div class="label">Ventilação</div>
        <div class="chips">${FANS.map(([f, l]) => `<button class="chip" data-fan="${f}">${l}</button>`).join('')}</div>
      </div>
    </div>`;
  acBuilt = true;
  shownTemp = null;
  $('#acDev').dataset.key = '';
}

function renderAc() {
  const driver = data.settings.drivers?.[data.settings.ac?.driver] || '';
  if (acError) {
    acBuilt = false;
    view.innerHTML = `<h3>Ar-condicionado <span class="muted small">${esc(driver)}</span></h3>
      <div class="empty">Não consegui falar com o ar.<br><span class="small">${esc(acError)}</span><br><br>
      <button class="btn" data-act="retry">${I.refresh} Tentar de novo</button>
      <button class="btn primary" data-act="config">Configurar</button></div>`;
    return;
  }
  if (!acState) {
    acBuilt = false;
    view.innerHTML = `<h3>Ar-condicionado</h3><div class="empty">Carregando…</div>`;
    return;
  }
  if (!acBuilt || !$('#ac')) buildAc();
  const s = acState;
  $('#ac').classList.toggle('off', !s.power);
  $('#ac').classList.toggle('busy', acBusy);
  $('#acDrv').textContent = driver;

  const devKey = acDevices.map((d) => d.id).join('|') + '#' + s.id;
  if ($('#acDev').dataset.key !== devKey) {
    $('#acDev').dataset.key = devKey;
    $('#acDev').innerHTML =
      acDevices.length > 1
        ? `<select class="field" data-act="device">${acDevices.map((d) => `<option value="${esc(d.id)}" ${d.id === s.id ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</select>`
        : `<span class="ac-name">${esc(s.name || 'Ar-condicionado')}</span>`;
  }

  const t = s.temperature ?? '--';
  if (String(t) !== String(shownTemp)) {
    const num = $('#acNum');
    num.textContent = t;
    if (shownTemp !== null && typeof t === 'number') M.roll(num, t - shownTemp);
    shownTemp = t;
  }
  $('#acSub').textContent = `${s.power ? (s.turbo ? 'Ligado · Turbo' : 'Ligado') : 'Desligado'}${s.roomTemperature != null ? ` · Ambiente ${s.roomTemperature}°` : ''}`;
  $('#acPow').classList.toggle('on', Boolean(s.power));
  const turbo = $('#acTurbo');
  turbo.classList.toggle('on', s.turbo === true && s.power);
  turbo.classList.toggle('unknown', s.turbo === null || s.turbo === undefined); // o aparelho não informa: dá para tentar
  turbo.setAttribute('aria-pressed', String(s.turbo === true));
  $('#ac').classList.toggle('ac-turbo-on', s.turbo === true && s.power);
  view.querySelectorAll('[data-mode]').forEach((c) => c.classList.toggle('on', c.dataset.mode === s.mode));
  view.querySelectorAll('[data-fan]').forEach((c) => c.classList.toggle('on', c.dataset.fan === s.fan));
}

async function acSet(cmd) {
  // otimista: a interface muda na hora, o aparelho confirma depois
  const before = acState;
  acState = {
    ...acState,
    ...cmd,
    ...(cmd.mode || cmd.fan || cmd.temperature !== undefined || cmd.turbo === true ? { power: cmd.power ?? true } : {}),
    ...(cmd.power === false ? { turbo: acState?.turbo === null ? null : false } : {}),
  };
  acBusy = true;
  renderAc();
  // Alminha reage ao ar: desligou → cochila; ligou → acena (e neva ou faz sol); frio → treme e neva; quente → pulinho ao sol
  const heat = (acState?.mode || cmd.mode) === 'heat';
  if (cmd.power === false) alminha.emote('sleepy', 1600);
  else if (cmd.turbo === true) {
    // turbo: ela fica empolgada e cai uma nevasca (ou uma chuva de sol, no quente)
    alminha.emote('excited', 1600);
    alminha.react(heat ? 'hop' : 'shiver');
    alminha.fx(heat ? 'sun' : 'snow', heat ? 6 : 10, { spread: 1.4 });
  } else if (cmd.turbo === false) alminha.react('nod');
  else if (cmd.power === true) {
    alminha.emote('happy', 1400);
    alminha.react('wave');
    alminha.fx(heat ? 'sun' : 'snow', heat ? 3 : 5);
  } else if (cmd.mode === 'cool') {
    alminha.react('shiver');
    alminha.fx('snow', 5);
  } else if (cmd.mode === 'heat') {
    alminha.react('hop');
    alminha.fx('sun', 3);
  } else if (cmd.mode || cmd.fan) alminha.react('nod');
  try {
    acState = await api.call('ac:set', before?.id, cmd);
  } catch (e) {
    acState = before;
    toastErr(e);
  }
  acBusy = false;
  renderPillRight();
  renderAc();
}

// vários cliques em +/− viram um comando só
let tempTimer = null;
function bumpTemp(d) {
  if (!acState) return;
  acState = { ...acState, temperature: Math.max(16, Math.min(30, Number(acState.temperature || 23) + d)) };
  renderAc();
  // mais frio → arrepio e um floquinho; mais quente → aceno e um solzinho
  alminha.react(d < 0 ? 'shiver' : 'nod');
  alminha.fx(d < 0 ? 'snow' : 'sun', 1);
  clearTimeout(tempTimer);
  tempTimer = setTimeout(() => acSet({ temperature: acState.temperature }), 700);
}

// =========================================================
// Cliques dentro do painel
// =========================================================
view.addEventListener('click', async (e) => {
  const t = e.target.closest('button, [data-clip], [data-launch]');
  if (!t) return;
  const act = t.dataset.act;
  // ar
  if (act === 'retry' || act === 'refresh') {
    acDevices = [];
    acError = '';
    if (act === 'retry') {
      acState = null;
      renderAc();
    }
    return refreshAc();
  }
  if (act === 'config') return api.call('settings:open', 'ac');
  if (act === 'minus') return bumpTemp(-1);
  if (act === 'plus') return bumpTemp(1);
  if (act === 'power') return acSet({ power: !acState.power });
  if (act === 'turbo') {
    M.pop(t.querySelector('svg'));
    return acSet({ turbo: !(acState.turbo === true && acState.power) });
  }
  if (t.dataset.mode) return acSet({ mode: t.dataset.mode });
  if (t.dataset.fan) return acSet({ fan: t.dataset.fan });
  // música
  if (t.dataset.media) {
    // tocar/trocar de música → dança soltando notinhas; volume/mudo → só um aceno
    if (/play_pause|next|previous/.test(t.dataset.media)) alminha.dance();
    else alminha.react('nod');
    // tocar/pausar muda o botão na hora (o Windows confirma na próxima consulta)
    if (t.dataset.media === 'play_pause' && np) {
      np = { ...np, position: npPosition(), updatedAt: Date.now(), status: np.status === 'playing' ? 'paused' : 'playing' };
      drawNp();
    }
    await api.call('media', t.dataset.media).catch(toastErr);
    return setTimeout(refreshNp, 400);
  }
  // tarefas
  if (t.dataset.todo) {
    const item = t.closest('.item');
    item.classList.toggle('done');
    M.pop(t);
    data.todos = data.todos.map((x) => (x.id === t.dataset.todo ? { ...x, done: !x.done } : x));
    if (item.classList.contains('done')) {
      // tarefa feita → pulinho com brilhos; todas feitas → comemoração com corações
      if (data.todos.every((x) => x.done)) alminha.celebrate();
      else {
        alminha.emote('excited', 1300);
        alminha.react('hop');
        alminha.fx('sparkle', 4);
      }
    } else alminha.react('nod');
    updateTaskCount();
    skipRender.todos = (skipRender.todos || 0) + 1;
    return api.call('todo:toggle', t.dataset.todo);
  }
  if (t.dataset.deltodo) {
    const id = t.dataset.deltodo;
    data.todos = data.todos.filter((x) => x.id !== id);
    skipRender.todos = (skipRender.todos || 0) + 1;
    api.call('todo:remove', id);
    await M.leave(t.closest('.item'), { x: 14, y: 0 });
    M.collapse(t.closest('.item'));
    updateTaskCount();
    if (!data.todos.length) renderTasks();
    return;
  }
  // rotinas
  if (t.dataset.delsched) {
    const id = t.dataset.delsched;
    data.schedules = data.schedules.filter((x) => x.id !== id);
    skipRender.schedules = (skipRender.schedules || 0) + 1;
    api.call('schedule:remove', id);
    await M.leave(t.closest('.item'), { x: 14, y: 0 });
    M.collapse(t.closest('.item'));
    if (!data.schedules.length) renderRoutines();
    return;
  }
  if (t.dataset.runsched) {
    flash(t.closest('.item'));
    alminha.react('wave');
    return api.call('schedule:run', t.dataset.runsched).then(() => toast({ text: 'Rotina executada' }));
  }
  // área de transferência
  if (t.dataset.clip !== undefined) {
    flash(t);
    await api.call('clipboard:copy', data.clipboard[Number(t.dataset.clip)].text);
    return toast({ text: 'Copiado!' });
  }
  if (act === 'clearclip') {
    await Promise.all([...view.querySelectorAll('.item')].map((el) => M.leave(el)));
    return api.call('clipboard:clear').then(() => ((data.clipboard = []), renderClip()));
  }
  // apps
  if (t.dataset.launch) {
    flash(t.closest('.item') || t);
    alminha.react('hop');
    alminha.fx('sparkle', 2);
    return api.call('apps:launch', t.dataset.launch);
  }
  if (t.dataset.dock) {
    alminha.react('hop');
    return api.call('dock:activate', t.dataset.dock).catch(toastErr);
  }
  if (t.dataset.fav) {
    // ★ fixa/desafixa o app na hotbar
    const { fav: id, name } = t.dataset;
    const on = !data.dock.some((p) => p.appId === id);
    t.classList.toggle('on', on);
    M.pop(t);
    if (on) {
      alminha.emote('love', 1300); // fixou → olhos de coração
      alminha.fx('heart', 3);
    }
    data.dock = on ? [...data.dock, { id: 'novo-' + id, name, appId: id }] : data.dock.filter((p) => p.appId !== id);
    skipRender.dock = (skipRender.dock || 0) + 1;
    renderFavGrid(on ? 'novo-' + id : null);
    return api.call('apps:favorite', { id, name });
  }
});

view.addEventListener('change', async (e) => {
  if (e.target.dataset.act === 'device') {
    acState = await api.call('ac:status', e.target.value).catch((err) => (toastErr(err), acState));
    renderAc();
  }
});

function flash(el) {
  if (!el) return;
  el.classList.add('flash');
  setTimeout(() => el.classList.remove('flash'), 220);
}

// ---------- música ----------
// "Tocando agora" vem do controle de mídia do Windows (Spotify, YouTube no navegador, players…).
// Enquanto a aba está aberta, consulta a cada 1,5 s; a barra de progresso anda sozinha entre uma consulta e outra.
let np = null; // { app, title, artist, album, status, position, duration, updatedAt, canPrev, canNext, thumbKey }
let npThumb = { key: '', src: '' };
let npPoll = null;
let npTick = null;
const APP_NAMES = [
  ['spotify', 'Spotify'], ['msedge', 'Edge'], ['chrome', 'Chrome'], ['brave', 'Brave'], ['firefox', 'Firefox'], ['308046b0af4a39cb', 'Firefox'],
  ['opera', 'Opera'], ['vlc', 'VLC'], ['zunemusic', 'Media Player'], ['microsoft.media', 'Media Player'], ['deezer', 'Deezer'], ['tidal', 'Tidal'],
  ['applemusic', 'Apple Music'], ['itunes', 'iTunes'], ['discord', 'Discord'], ['youtube', 'YouTube Music'],
];
const appLabel = (id = '') => APP_NAMES.find(([k]) => id.toLowerCase().includes(k))?.[1] || id.split('!').pop().split(/[\\/]/).pop().replace(/\.exe$/i, '');
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function npPosition() {
  if (!np || !(np.duration > 0)) return 0;
  const since = (Date.now() - np.updatedAt) / 1000;
  // alguns apps só atualizam a posição quando algo muda: tocando, ela anda desde a última atualização
  const p = np.status === 'playing' && since >= 0 && since < np.duration + 5 ? np.position + since : np.position;
  return Math.max(0, Math.min(np.duration, p));
}
function drawNpTime() {
  const box = $('#npTime');
  if (!box) return;
  const ok = np && np.duration > 0;
  box.classList.toggle('hidden', !ok);
  if (!ok) return;
  const p = npPosition();
  $('#npPos').textContent = mmss(p);
  $('#npDur').textContent = mmss(np.duration);
  $('#npFill').style.setProperty('--p', (p / np.duration).toFixed(4));
}
function drawNp(changed) {
  const card = $('#np');
  if (!card) return;
  const playing = np?.status === 'playing';
  card.classList.toggle('empty', !np);
  card.classList.toggle('paused', Boolean(np) && !playing);
  $('#npTitle').textContent = np ? np.title || 'Sem título' : 'Nada tocando agora';
  $('#npArtist').textContent = np ? [np.artist, np.album && np.album !== np.title ? np.album : ''].filter(Boolean).join(' · ') || appLabel(np.app) : 'Dê play no Spotify, no YouTube ou em qualquer player';
  $('#npApp').textContent = np ? appLabel(np.app) : '';
  const art = $('#npArt');
  const src = np && npThumb.key === np.thumbKey ? npThumb.src : '';
  if (art.dataset.src !== src) {
    art.dataset.src = src;
    art.innerHTML = src ? `<img src="${src}" alt="" />` : I.music;
    card.style.setProperty('--art', src ? `url("${src}")` : 'none');
  }
  if (changed) M.pop(art);
  const play = view.querySelector('[data-media="play_pause"]');
  if (play) {
    play.innerHTML = playing ? I.pause : I.play;
    play.title = playing ? 'Pausar' : 'Tocar';
    play.setAttribute('aria-label', play.title);
  }
  view.querySelector('[data-media="previous"]')?.toggleAttribute('disabled', Boolean(np) && !np.canPrev);
  view.querySelector('[data-media="next"]')?.toggleAttribute('disabled', Boolean(np) && !np.canNext);
  drawNpTime();
}
async function refreshNp() {
  let r;
  try {
    r = await api.call('media:now', npThumb.key);
  } catch {
    return;
  }
  const before = np?.thumbKey;
  np = r || null;
  if (np?.thumb) npThumb = { key: np.thumbKey, src: np.thumb };
  else if (np && np.thumbKey !== npThumb.key) npThumb = { key: np.thumbKey, src: '' };
  const changed = Boolean(np && before && before !== np.thumbKey);
  if (changed) alminha.fx('note', 2); // música nova: solta umas notinhas
  if (tab === 'music' && panelOpen()) drawNp(changed);
}
function startNp() {
  clearInterval(npPoll);
  clearInterval(npTick);
  refreshNp();
  npPoll = setInterval(() => (tab === 'music' && panelOpen() ? refreshNp() : stopNp()), 1500);
  npTick = setInterval(drawNpTime, 500);
}
function stopNp() {
  clearInterval(npPoll);
  clearInterval(npTick);
  npPoll = npTick = null;
}

function renderMusic() {
  view.innerHTML = `
    <h3>Tocando agora <span class="muted small" id="npApp"></span></h3>
    <div class="card-x player np empty" id="np">
      <div class="np-row">
        <div class="np-art" id="npArt">${I.music}</div>
        <div class="np-info"><div class="np-title" id="npTitle">Nada tocando agora</div><div class="np-artist" id="npArtist"></div></div>
      </div>
      <div class="np-time hidden" id="npTime"><span id="npPos">0:00</span><div class="np-bar"><i id="npFill"></i></div><span id="npDur">0:00</span></div>
      <div class="media">
        <button class="round" data-media="previous" title="Anterior" aria-label="Anterior">${I.prev}</button>
        <button class="round big" data-media="play_pause" title="Tocar" aria-label="Tocar">${I.play}</button>
        <button class="round" data-media="next" title="Próxima" aria-label="Próxima">${I.next}</button>
      </div>
      <div class="vol">
        <button class="icon-btn" data-media="volume_down" title="Diminuir volume" aria-label="Diminuir volume">${I.volDown}</button>
        <button class="icon-btn" data-media="mute" title="Mudo" aria-label="Mudo">${I.mute}</button>
        <button class="icon-btn" data-media="volume_up" title="Aumentar volume" aria-label="Aumentar volume">${I.volUp}</button>
      </div>
    </div>
    <h3>YouTube</h3>
    <form id="ytForm" class="card-x row yt"><input class="field grow" id="ytq" placeholder="O que você quer ouvir? (ex.: lo-fi para estudar)" aria-label="Tocar no YouTube" /><button class="btn primary">Tocar</button></form>
    <p class="foot">Funciona com Spotify, YouTube, Deezer e qualquer player do Windows.</p>`;
  drawNp();
  startNp();
  $('#ytForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = $('#ytq').value.trim();
    if (q) {
      alminha.dance();
      api.call('media:youtube', q).catch(toastErr);
    }
    $('#ytq').value = '';
  });
}

// ---------- tarefas ----------
let knownTodoIds = new Set();
function todoHtml(t) {
  return `<div class="item ${t.done ? 'done' : ''}" data-id="${t.id}">
    <button class="check" data-todo="${t.id}">${I.check}</button>
    <div class="txt"><span class="t">${esc(t.text)}</span>${t.time ? `<div class="sub">${esc(t.time)}</div>` : ''}</div>
    <button class="icon-btn" data-deltodo="${t.id}" title="Apagar">${I.trash}</button></div>`;
}
function updateTaskCount() {
  const c = $('#todoCount');
  if (c) c.textContent = `${data.todos.filter((t) => t.done).length}/${data.todos.length}`;
}
function renderTasks(animateIn) {
  const todos = data.todos;
  const focused = document.activeElement?.id === 'todoIn';
  view.innerHTML = `
    <h3>Tarefas <span id="todoCount"></span></h3>
    <form id="todoForm" class="row" style="margin-bottom:10px"><input class="field grow" id="todoIn" placeholder="Nova tarefa…" /><button class="btn">${I.plus}</button></form>
    <div class="list">${todos.length ? todos.map(todoHtml).join('') : '<div class="empty">Nada por aqui. Escreva uma tarefa acima.</div>'}</div>`;
  updateTaskCount();
  // só a tarefa recém-criada entra animada (quando não é a abertura do painel)
  if (!animateIn) M.stagger(todos.filter((t) => !knownTodoIds.has(t.id)).map((t) => view.querySelector(`[data-id="${t.id}"]`)).filter(Boolean));
  knownTodoIds = new Set(todos.map((t) => t.id));
  if (focused) $('#todoIn').focus();
  $('#todoForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = $('#todoIn').value.trim();
    if (!v) return;
    $('#todoIn').value = '';
    alminha.react('nod'); // "anotado!"
    alminha.fx('sparkle', 2);
    api.call('todo:add', v);
  });
}

// ---------- rotinas ----------
const TOOL_SHORT = { open_app: 'abrir', open_website: 'site', web_search: 'pesquisar', play_youtube: 'YouTube', media_control: 'mídia', set_volume: 'volume', ac_control: 'ar', notify: 'lembrete' };
function actionText(a) {
  const v = a.args || {};
  if (a.tool === 'ac_control') return `ar ${v.power === false ? 'desligar' : [v.temperature && v.temperature + '°', v.mode, v.fan].filter(Boolean).join(' ') || 'ligar'}`;
  return `${TOOL_SHORT[a.tool] || a.tool} ${v.name || v.query || v.url || v.text || v.action || v.percent || ''}`.trim();
}
function renderRoutines() {
  const list = data.schedules;
  view.innerHTML = `
    <h3>Agendamentos e rotinas</h3>
    <div class="list">${
      list.length
        ? list
            .map(
              (s) => `<div class="item"><div class="txt"><span>${esc(s.description || s.actions.map(actionText).join(' · '))}</span>
          <div class="sub">${s.kind === 'routine' ? '↻ ' : '◷ '}${esc(s.when)} — ${esc(s.actions.map(actionText).join(' · '))}</div></div>
          <button class="icon-btn" title="Executar agora" data-runsched="${s.id}">${I.run}</button>
          <button class="icon-btn" title="Apagar" data-delsched="${s.id}">${I.trash}</button></div>`,
            )
            .join('')
        : '<div class="empty">Nenhuma rotina agendada.</div>'
    }</div>`;
}

// ---------- área de transferência ----------
function renderClip() {
  const list = data.clipboard;
  view.innerHTML = `
    <h3>Área de transferência ${list.length ? `<button class="btn small" data-act="clearclip">Limpar</button>` : ''}</h3>
    <div class="list">${
      list.length
        ? list.map((c, i) => `<div class="item clip" data-clip="${i}" title="Clique para copiar"><div class="txt clip">${esc(c.text.slice(0, 300))}</div></div>`).join('')
        : '<div class="empty">O que você copiar aparece aqui.</div>'
    }</div>`;
}

// ---------- apps ----------
let appResults = [];
// fixados da hotbar (com o ícone de verdade, quando a hotbar já carregou)
function tile(p) {
  const h = [...p.name].reduce((n, c) => n + c.charCodeAt(0), 0) % 360;
  const icon = dockIcons.get(p.id);
  return `<button class="app-tile" data-dock="${esc(p.id)}" data-key="${esc(p.id)}" title="${esc(p.name)}">${icon ? `<img src="${icon}" alt="" />` : `<b style="--h:${h}">${esc(p.name[0] || '?')}</b>`}${esc(p.name.length > 18 ? p.name.slice(0, 17) + '…' : p.name)}</button>`;
}
function renderFavGrid(newId) {
  const box = $('#favBox');
  if (!box) return;
  const pins = data.dock || [];
  box.innerHTML = pins.length
    ? `<div class="apps-grid">${pins.map(tile).join('')}</div>`
    : '<div class="muted small" style="margin-bottom:14px">Marque apps com ★ para fixar na hotbar.</div>';
  if (newId) M.stagger([box.querySelector(`[data-key="${CSS.escape(newId)}"]`)].filter(Boolean));
}
function renderApps() {
  view.innerHTML = `
    <h3>Na hotbar</h3>
    <div id="favBox"></div>
    <h3>Todos os apps</h3>
    <input class="field" id="appq" placeholder="Buscar app…" aria-label="Buscar app" />
    <div class="list" id="appList" style="margin-top:8px"></div>`;
  renderFavGrid();
  const q = $('#appq');
  const draw = () =>
    ($('#appList').innerHTML = appResults
      .map(
        (a) => `<div class="item"><div class="txt" style="cursor:pointer" data-launch="${esc(a.id)}">${esc(a.name)}</div>
        <button class="icon-btn star ${(data.dock || []).some((p) => p.appId === a.id) ? 'on' : ''}" title="Fixar na hotbar" data-fav="${esc(a.id)}" data-name="${esc(a.name)}">${I.star}</button></div>`,
      )
      .join(''));
  let t = null;
  q.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(async () => {
      appResults = await api.call('apps:search', q.value);
      draw();
    }, 150);
  });
  api.call('apps:search', '').then((r) => {
    appResults = r;
    draw();
    M.stagger($('#appList').querySelectorAll('.item'), { max: 6 });
  });
}

// ---------- bandeja de arquivos ----------
const fmtSize = (b) => (b < 1024 ? `${b} B` : b < 1048576 ? `${Math.round(b / 1024)} KB` : b < 1073741824 ? `${(b / 1048576).toFixed(1).replace('.', ',')} MB` : `${(b / 1073741824).toFixed(1).replace('.', ',')} GB`);
function trayLeft(t) {
  const ms = t.expiresAt - Date.now();
  return ms >= 5400000 ? `sai em ${Math.round(ms / 3600000)} h` : `sai em ${Math.max(1, Math.ceil(ms / 60000))} min`;
}
function trayItem(t) {
  return `<div class="item tray-item ${t.missing ? 'missing' : ''}" data-tray="${t.id}" draggable="${!t.missing}" title="${t.missing ? 'O arquivo não está mais nesse lugar' : `${esc(t.path)}\nArraste para enviar ou soltar numa pasta · clique duplo abre`}">
    <span class="tray-ic">${t.icon ? `<img src="${t.icon}" alt="" draggable="false" />` : t.dir ? I.folder : I.file}</span>
    <div class="txt"><span class="t">${esc(t.name)}</span><div class="sub">${t.missing ? 'Não encontrado (foi movido ou apagado)' : `${t.dir ? 'Pasta' : fmtSize(t.size)} · ${trayLeft(t)}`}</div></div>
    ${t.missing ? '' : `<button class="icon-btn" data-traycopy="${t.id}" title="Copiar (para colar numa pasta ou conversa)" aria-label="Copiar">${I.copy}</button>
    <button class="icon-btn" data-traymove="${t.id}" title="Mover para…" aria-label="Mover para">${I.move}</button>
    <button class="icon-btn" data-trayreveal="${t.id}" title="Mostrar na pasta" aria-label="Mostrar na pasta">${I.folder}</button>`}
    <button class="icon-btn" data-trayrm="${t.id}" title="Tirar da bandeja (o arquivo continua onde está)" aria-label="Tirar da bandeja">${I.close}</button></div>`;
}
function renderTray() {
  const list = data.tray || [];
  const ok = list.filter((t) => !t.missing);
  view.innerHTML = `
    <h3>Bandeja de arquivos ${list.length ? `<button class="btn small" data-act="trayclear">Limpar</button>` : ''}</h3>
    ${
      ok.length > 1
        ? `<div class="tray-all" draggable="true" data-trayall title="Arraste para levar todos de uma vez">${I.tray}<span>Arraste daqui para levar os ${ok.length}</span><button class="btn small" data-act="traycopyall">Copiar todos</button></div>`
        : ''
    }
    <div class="list">${
      list.length
        ? list.map(trayItem).join('')
        : `<div class="empty tray-empty">${I.dropIn}<br>Arraste arquivos até a ilha no topo da tela<br><span class="small">Eles ficam aqui por 12 horas, prontos para enviar ou mover.</span></div>`
    }</div>`;
}
// as horas restantes mudam sozinhas
setInterval(() => tab === 'tray' && panelOpen() && !document.querySelector('.tray-item:active') && renderTray(), 60000);

// arrastar da bandeja para fora: o Windows assume o arrasto (vai para pastas, chats, e-mail…)
view.addEventListener('dragstart', (e) => {
  const all = e.target.closest?.('[data-trayall]');
  const it = e.target.closest?.('.tray-item');
  if (!all && !it) return;
  e.preventDefault();
  if (it?.classList.contains('missing')) return;
  internalDrag = true;
  const ids = all ? (data.tray || []).filter((t) => !t.missing).map((t) => t.id) : [it.dataset.tray];
  api.send('tray:drag', ids);
  alminha.react('nod');
});
view.addEventListener('dblclick', (e) => {
  const it = e.target.closest('.tray-item:not(.missing)');
  if (it && !e.target.closest('button')) api.call('tray:open', it.dataset.tray).catch(toastErr);
});
async function trayAction(t) {
  const d = t.dataset;
  if (d.traycopy || d.act === 'traycopyall') {
    const ids = d.traycopy ? [d.traycopy] : (data.tray || []).filter((x) => !x.missing).map((x) => x.id);
    const n = await api.call('tray:copy', ids);
    alminha.react('nod');
    return toast({ text: n > 1 ? `${n} arquivos copiados — é só colar (Ctrl+V)` : 'Copiado — é só colar (Ctrl+V)' });
  }
  if (d.traymove) {
    const dest = await api.call('tray:move', d.traymove);
    if (dest) {
      alminha.react('hop');
      toast({ text: 'Movido para ' + dest.split(/[\\/]/).slice(-2, -1)[0] });
    }
    return;
  }
  if (d.trayreveal) return api.call('tray:reveal', d.trayreveal);
  if (d.trayrm) {
    const row = t.closest('.item');
    data.tray = data.tray.filter((x) => x.id !== d.trayrm);
    skipRender.tray = (skipRender.tray || 0) + 1;
    api.call('tray:remove', d.trayrm);
    updateTrayBadge();
    await M.leave(row, { x: 14, y: 0 });
    M.collapse(row);
    if (!data.tray.length) renderTray();
    return;
  }
  if (d.act === 'trayclear') {
    await Promise.all([...view.querySelectorAll('.tray-item, .tray-all')].map((el) => M.leave(el)));
    data.tray = [];
    skipRender.tray = (skipRender.tray || 0) + 1;
    await api.call('tray:clear');
    updateTrayBadge();
    return renderTray();
  }
}
view.addEventListener('click', (e) => {
  const t = e.target.closest('[data-traycopy], [data-traymove], [data-trayreveal], [data-trayrm], [data-act="trayclear"], [data-act="traycopyall"]');
  if (t) trayAction(t).catch(toastErr);
});

// =========================================================
// Temporizador e foco — o tempo corre no processo principal; aqui só desenha (ilha, painel, Alminha)
// =========================================================
const mmssLong = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h ? h + ':' + String(m).padStart(2, '0') : m}:${String(s % 60).padStart(2, '0')}`;
};
const PHASE_LABEL = { focus: 'Foco', short: 'Pausa curta', long: 'Pausa longa', timer: 'Contagem regressiva', watch: 'Cronômetro', idle: 'Pronto para começar' };
const focusActive = () => F.phase !== 'idle';
// a Alminha cochila durante o foco (se escolhido)
const focusSleeping = () => F.running && (F.phase === 'focus' || F.phase === 'timer') && F.opts.sleep !== false;
const fTime = () => (F.mode === 'watch' ? mmssLong(F.elapsed) : mmssLong(F.phase === 'idle' ? (F.mode === 'timer' ? F.timerMin : F.opts.focusMin || 25) * 60000 : F.left));
const fProgress = () => (F.mode === 'watch' || !F.total ? (F.mode === 'watch' ? (F.elapsed % 60000) / 60000 : 0) : 1 - F.left / F.total);

function renderFocus() {
  const presets = [5, 10, 15, 25, 45, 60];
  view.innerHTML = `
    <div class="seg-f" role="group" aria-label="Tipo">
      <button data-fmode="pomodoro">Pomodoro</button><button data-fmode="timer">Timer</button><button data-fmode="watch">Cronômetro</button>
    </div>
    <div class="ring-wrap">
      <svg class="ring" viewBox="0 0 120 120" aria-hidden="true"><circle class="ring-bg" cx="60" cy="60" r="52"/><circle class="ring-fg" id="ringFg" cx="60" cy="60" r="52" pathLength="100"/></svg>
      <div class="ring-txt"><b id="fTime" aria-live="off">25:00</b><small id="fPhase"></small></div>
    </div>
    <div class="f-row f-presets" id="fPresets">${presets.map((m) => `<button class="chip" data-fmin="${m}">${m} min</button>`).join('')}</div>
    <div class="f-row f-actions">
      <button class="round" data-f="stop" title="Parar" aria-label="Parar">${I.stop}</button>
      <button class="round big" data-f="toggle" id="fToggle" title="Começar" aria-label="Começar">${I.play}</button>
      <button class="round" data-f="skip" title="Pular para a próxima fase" aria-label="Pular">${I.skip}</button>
    </div>
    <div class="f-row f-dots" id="fDots" aria-hidden="true"></div>`;
  drawFocus();
}
function drawFocus() {
  if (tab !== 'focus' || !panelOpen() || !$('#fTime')) return;
  view.querySelectorAll('[data-fmode]').forEach((b) => {
    b.classList.toggle('on', b.dataset.fmode === F.mode);
    b.setAttribute('aria-pressed', String(b.dataset.fmode === F.mode));
  });
  $('#fTime').textContent = fTime();
  const round = F.mode === 'pomodoro' && F.phase !== 'idle' ? ` · rodada ${F.round} de ${F.opts.rounds || 4}` : '';
  $('#fPhase').textContent = (F.phase === 'idle' ? PHASE_LABEL.idle : PHASE_LABEL[F.phase] + (F.running ? '' : ' · pausado')) + round;
  $('#ringFg').style.strokeDashoffset = String(100 - fProgress() * 100);
  $('.ring-wrap').dataset.phase = F.phase;
  $('#fPresets').hidden = F.mode !== 'timer' || F.phase !== 'idle';
  view.querySelectorAll('[data-fmin]').forEach((c) => c.classList.toggle('on', Number(c.dataset.fmin) === F.timerMin));
  const t = $('#fToggle');
  t.innerHTML = F.running ? I.pause : I.play;
  t.title = F.running ? 'Pausar' : F.phase === 'idle' ? 'Começar' : 'Continuar';
  t.setAttribute('aria-label', t.title);
  view.querySelector('[data-f="skip"]').disabled = F.phase === 'idle' || F.mode === 'watch';
  view.querySelector('[data-f="stop"]').disabled = F.phase === 'idle';
  $('#fDots').innerHTML =
    F.mode === 'pomodoro' ? Array.from({ length: F.opts.rounds || 4 }, (_, i) => `<i class="${i < F.round - (F.phase === 'focus' ? 1 : 0) ? 'done' : i === F.round - 1 && F.phase === 'focus' ? 'now' : ''}"></i>`).join('') : '';
}
view.addEventListener('click', (e) => {
  const t = e.target.closest('[data-f], [data-fmode], [data-fmin]');
  if (!t) return;
  if (t.dataset.fmode) {
    if (F.phase !== 'idle') api.call('focus:stop');
    F = { ...F, mode: t.dataset.fmode, phase: 'idle', running: false };
    return drawFocus();
  }
  if (t.dataset.fmin) return api.call('focus:timer', Number(t.dataset.fmin)).then((s) => ((F = s), drawFocus()));
  const a = t.dataset.f;
  M.pop(t);
  if (a === 'toggle') {
    if (F.running) api.call('focus:pause');
    else if (F.phase === 'idle') {
      api.call('focus:start', F.mode, { minutes: F.timerMin });
      alminha.emote('focus', 1500); // "vamos lá"
      alminha.react('nod');
    } else api.call('focus:resume');
  }
  if (a === 'stop') api.call('focus:stop');
  if (a === 'skip') api.call('focus:skip');
});
api.on('focus', (s) => {
  const wasSleeping = focusSleeping();
  F = s;
  drawFocus();
  renderPillRight();
  if (wasSleeping !== focusSleeping()) updateFace();
});
// fim de fase: a Alminha acorda e comemora, com um sininho (se ligado)
api.on('focus:done', (d) => {
  if (d.skipped) return;
  if (d.phase === 'focus' || d.phase === 'timer') alminha.celebrate();
  else (alminha.emote('happy', 1500), alminha.react('perk'));
  if (F.opts.sound !== false) chime(d.phase === 'focus' || d.phase === 'timer');
  touch();
});
// sininho curto (dois tons) feito na hora, sem arquivo de som
function chime(up) {
  try {
    const ctx = new AudioContext();
    const notes = up ? [660, 880, 1320] : [880, 660];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      const t0 = ctx.currentTime + i * 0.16;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.18, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.5);
      o.connect(g).connect(ctx.destination);
      o.start(t0);
      o.stop(t0 + 0.55);
    });
    setTimeout(() => ctx.close(), 1500);
  } catch {}
}

// =========================================================
// Tradução rápida — digite/cole aqui, ou arraste um texto até a ilha
// =========================================================
let TR = { source: '', text: '', from: '', to: '', busy: false, error: '' };
let LANGS = null;
const langName = (code) => (LANGS && (LANGS[code] || LANGS[Object.keys(LANGS).find((k) => k.split('-')[0] === String(code).split('-')[0])])) || code;
async function renderTranslate() {
  LANGS ??= await api.call('translate:langs').catch(() => ({ 'pt-BR': 'Português', en: 'Inglês' }));
  const o = { target: 'pt-BR', alt: 'en', ...(data.settings.translate || {}) };
  const opts = (sel) => Object.entries(LANGS).map(([k, v]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${v}</option>`).join('');
  view.innerHTML = `
    <h3>Tradução rápida</h3>
    <div class="tr-langs"><span class="muted small">Para</span><select class="field" id="trTo" aria-label="Traduzir para">${opts(o.target)}</select>
      <span class="muted small tr-or">ou, se já estiver nele,</span><select class="field" id="trAlt" aria-label="Idioma alternativo">${opts(o.alt)}</select></div>
    <textarea class="field tr-in" id="trIn" placeholder="Digite ou cole um texto… ou arraste uma seleção até a ilha" maxlength="500">${esc(TR.source)}</textarea>
    <div class="row tr-btns"><button class="btn" data-tr="paste">Colar</button><span class="grow"></span><button class="btn primary" data-tr="go">Traduzir</button></div>
    <div id="trOut"></div>`;
  drawTranslation();
}
function drawTranslation() {
  const out = $('#trOut');
  if (!out) return;
  if (TR.busy) return void (out.innerHTML = '<div class="card-x tr-out"><span class="muted">Traduzindo…</span></div>');
  if (TR.error) return void (out.innerHTML = `<div class="card-x tr-out"><span class="muted">${esc(TR.error)}</span></div>`);
  if (!TR.text) return void (out.innerHTML = '');
  out.innerHTML = `<div class="card-x tr-out"><div class="tr-meta"><span>${esc(langName(TR.from))} → ${esc(langName(TR.to))}</span>
    <button class="icon-btn" data-tr="copy" title="Copiar tradução" aria-label="Copiar tradução">${I.copy}</button></div><p class="tr-text">${esc(TR.text)}</p></div>`;
  M.stagger([out.firstElementChild]);
}
async function runTranslate(text) {
  const src = String(text || '').trim();
  if (!src) return;
  TR = { ...TR, source: src, busy: true, error: '', text: '' };
  drawTranslation();
  alminha.emote('think', 3000);
  try {
    const r = await api.call('translate:run', src, { target: $('#trTo')?.value, alt: $('#trAlt')?.value });
    TR = { ...TR, ...r, busy: false };
    alminha.emote('happy', 1300);
    alminha.react('nod');
    if (data.settings.translate?.autoCopy) api.call('clipboard:copy', r.text);
  } catch (err) {
    TR = { ...TR, busy: false, error: err.message };
    alminha.emote('sad', 1300);
  }
  drawTranslation();
}
view.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-tr]');
  if (!t) return;
  const a = t.dataset.tr;
  if (a === 'go') runTranslate($('#trIn').value);
  if (a === 'paste') {
    const txt = await navigator.clipboard.readText().catch(() => '');
    $('#trIn').value = txt.slice(0, 500);
    runTranslate(txt);
  }
  if (a === 'copy') {
    await api.call('clipboard:copy', TR.text);
    M.pop(t);
    toast({ text: 'Tradução copiada' });
  }
});
view.addEventListener('keydown', (e) => {
  if (e.target.id === 'trIn' && e.key === 'Enter' && (e.ctrlKey || !e.shiftKey)) {
    e.preventDefault();
    runTranslate(e.target.value);
  }
});
view.addEventListener('change', (e) => {
  if (e.target.id === 'trTo' || e.target.id === 'trAlt') api.call('settings:save', { translate: { target: $('#trTo').value, alt: $('#trAlt').value } });
});
// texto solto na ilha: abre a tradução já traduzindo
function translateDropped(text) {
  tab = 'translate';
  if (!tabIds.includes('translate')) tabIds.push('translate'); // módulo escondido: mostra só desta vez
  panelOpen() ? render(true) : openPanel();
  setTimeout(() => {
    if ($('#trIn')) $('#trIn').value = text.slice(0, 500);
    runTranslate(text.slice(0, 500));
  }, 60);
}

// =========================================================
// Conta-gotas de cores — escolha um pixel da tela; copia em HEX, RGB ou HSL
// =========================================================
let COLOR = null; // { hex, r, g, b }
let colorHistory = [];
const hexToRgb = (h) => {
  const n = parseInt(h.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
};
function toHsl({ r, g, b }) {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === R ? (G - B) / d + (G < B ? 6 : 0) : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
    h *= 60;
  }
  return `hsl(${Math.round(h)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
}
const colorText = (c, fmt) => (fmt === 'rgb' ? `rgb(${c.r}, ${c.g}, ${c.b})` : fmt === 'hsl' ? toHsl(c) : c.hex);
async function renderColor() {
  colorHistory = await api.call('color:history').catch(() => []);
  if (!COLOR && colorHistory[0]) COLOR = { hex: colorHistory[0], ...hexToRgb(colorHistory[0]) };
  view.innerHTML = `
    <div class="card-x cp-main" id="cpMain"></div>
    <button class="btn primary cp-pick" data-cp="pick">${I.pipette}<span>Escolher uma cor da tela</span></button>
    <h3>Recentes ${colorHistory.length ? '<button class="btn small" data-cp="clear">Limpar</button>' : ''}</h3>
    <div class="cp-hist" id="cpHist"></div>`;
  drawColor();
}
function drawColor() {
  const main = $('#cpMain');
  if (!main) return;
  main.innerHTML = COLOR
    ? `<span class="cp-sw" style="--c:${COLOR.hex}"></span><div class="cp-vals">${['hex', 'rgb', 'hsl']
        .map((f) => `<button class="cp-val" data-cpcopy="${f}" title="Copiar"><small>${f.toUpperCase()}</small><b>${colorText(COLOR, f)}</b>${I.copy}</button>`)
        .join('')}</div>`
    : `<span class="cp-sw empty"></span><p class="muted small">Clique no botão e depois em qualquer lugar da tela. A cor fica aqui, pronta para copiar.</p>`;
  $('#cpHist').innerHTML = colorHistory.length
    ? colorHistory.map((h) => `<button class="cp-chip" data-cphex="${h}" style="--c:${h}" title="${h}" aria-label="Cor ${h}"></button>`).join('')
    : '<p class="muted small">As cores que você escolher aparecem aqui.</p>';
}
async function copyColor(fmt) {
  if (!COLOR) return;
  const txt = colorText(COLOR, fmt);
  await api.call('clipboard:copy', txt);
  toast({ text: `Copiado ${txt}` });
}
view.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-cp], [data-cpcopy], [data-cphex]');
  if (!t) return;
  if (t.dataset.cpcopy) return M.pop(t), copyColor(t.dataset.cpcopy);
  if (t.dataset.cphex) {
    COLOR = { hex: t.dataset.cphex, ...hexToRgb(t.dataset.cphex) };
    drawColor();
    return copyColor(data.settings.color?.format || 'hex');
  }
  if (t.dataset.cp === 'clear') {
    await api.call('color:clear');
    colorHistory = [];
    return renderColor();
  }
  if (t.dataset.cp === 'pick') pickScreenColor();
});
async function pickScreenColor() {
  closePanel();
  let c = null;
  try {
    c = await api.call('color:pick');
  } catch (err) {
    return toastErr(err);
  }
  if (!c) return;
  COLOR = c;
  tab = 'color';
  openPanel();
  // a Alminha solta brilhos na cor escolhida
  alminha.emote('love', 1300);
  alminha.fx('sparkle', 5, { color: c.hex });
  if (data.settings.color?.autoCopy !== false) copyColor(data.settings.color?.format || 'hex');
}

// ---------- início ----------
(async () => {
  try {
    data = await api.call('data:get');
  } catch {}
  knownTodoIds = new Set(data.todos.map((t) => t.id));
  updateTrayBadge();
  F = await api.call('focus:state').catch(() => F);
  applyHue();
  renderPillRight();
  moveIndicator(true);
  refreshAc();
  touch();
  // primeira aparição: desce da borda e dá oi
  setTimeout(() => {
    alminha.emote('happy', 1600);
    alminha.react('wave');
  }, 450);
})();
