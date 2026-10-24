// Site da Alma: rolagem suave, efeitos ligados à rolagem, a história da ilha, a Alminha e microinterações.
// Tudo que se mexe respeita "reduzir movimento" do sistema: aí fica só o essencial (esmaecer), sem deslocamentos.
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const light = matchMedia('(prefers-color-scheme: light)');
  window.Motion = { reduce }; // a Alminha (mascot.js) usa para não gesticular com movimento reduzido
  // e o CSS dela para parar o piscar e o flutuar
  const syncReduce = () => document.documentElement.classList.toggle('reduce', reduce.matches);
  syncReduce();
  reduce.addEventListener('change', syncReduce);

  // ---------- rolagem suave ----------
  let lenis = null;
  if (!reduce.matches && window.Lenis) {
    lenis = new window.Lenis({ duration: 1.15, easing: (t) => 1 - Math.pow(1 - t, 4), smoothWheel: true });
    window.__lenis = lenis; // para conferir as seções pulando direto (testes)
    const raf = (t) => {
      lenis.raf(t);
      requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
  }
  // links internos: rolam suave até a seção (e movem o foco para ela, para quem usa teclado)
  $$('a[href^="#"]').forEach((a) =>
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      const target = id === '#topo' ? document.body : id.length > 1 && $(id);
      if (!target) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(id === '#topo' ? 0 : target, { offset: id === '#ilha' ? 0 : -80 });
      else target.scrollIntoView({ behavior: reduce.matches ? 'auto' : 'smooth' });
      if (target !== document.body) {
        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      }
    }),
  );

  // ---------- aparecer com a rolagem (fade + desfoque + subida), em sequência dentro do mesmo grupo ----------
  const groups = new Map();
  $$('.reveal').forEach((el) => {
    const n = groups.get(el.parentElement) || 0;
    groups.set(el.parentElement, n + 1);
    el.style.setProperty('--d', `${Math.min(n, 6) * 80}ms`);
  });
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        en.target.classList.add('in');
        io.unobserve(en.target);
      }),
    { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
  );
  $$('.reveal').forEach((el) => io.observe(el));
  // o que já está na tela ao abrir aparece logo (sem depender do observador), na mesma sequência
  requestAnimationFrame(() =>
    $$('.reveal').forEach((el) => {
      if (el.getBoundingClientRect().top < innerHeight * 0.95) {
        el.classList.add('in');
        io.unobserve(el);
      }
    }),
  );

  // ---------- partículas da Alminha (uma camada só, fixa na tela) ----------
  const fxLayer = $('#fxLayer');

  // ---------- versão para baixar (releases.json; o lançamento atualiza esse arquivo) ----------
  fetch('releases.json', { cache: 'no-store' })
    .then((r) => r.json())
    .then(({ repo, latest }) => {
      const mb = `${Math.round(latest.size / 1048576)} MB`;
      const date = new Date(latest.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
      $$('.dl-version').forEach((el) => (el.textContent = `Versão ${latest.version}`));
      $$('.dl-version-lc').forEach((el) => (el.textContent = `versão ${latest.version}`));
      $$('.dl-size').forEach((el) => (el.textContent = mb));
      $$('.dl-date').forEach((el) => (el.textContent = date));
      const ul = $('#dlNotes');
      if (ul && latest.notes?.length) {
        ul.replaceChildren(...latest.notes.map((n) => Object.assign(document.createElement('li'), { textContent: n })));
      }
      // o instalador vem do GitHub Releases quando o repositório existir; até lá, da pasta download/ do próprio site
      const url = repo && !/SEU-USUARIO/.test(repo) ? `https://github.com/${repo}/releases/download/v${latest.version}/${latest.file}` : latest.url;
      if (url)
        $$('.dl-link').forEach((a) => {
          a.href = url;
          a.setAttribute('download', latest.file);
        });
    })
    .catch(() => {});

  // ---------- área de trabalho de mentira: escala 1280×720 para o tamanho da tela ----------
  const screen = $('#screen');
  const desk = $('#desk');
  // "câmera": no passo 2 a tela aproxima da ilha (zoom em volta do topo, no centro)
  let zoom = 1;
  const fitDesk = () => {
    const k = screen.clientWidth / 1280;
    desk.style.transform = `translate(${(640 * k * (1 - zoom)).toFixed(2)}px, 0) scale(${(k * zoom).toFixed(4)})`;
  };
  const setZoom = (z) => {
    if (z === zoom) return;
    zoom = reduce.matches ? 1 : z;
    fitDesk();
  };
  new ResizeObserver(fitDesk).observe(screen);
  fitDesk();
  const clock = () => {
    const d = new Date();
    $('#deskClock').textContent = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    $('#tbClock').textContent = $('#deskClock').textContent;
    $('#tbDate').textContent = d.toLocaleDateString('pt-BR');
    const s = d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' }).replace('.', '');
    $('#deskDate').textContent = s.charAt(0).toUpperCase() + s.slice(1);
  };
  clock();
  setInterval(clock, 15000);
  // os ícones da hotbar saem de dentro da ilha (cada um parte de perto do centro)
  $$('.d-dock .dk').forEach((dk, i, all) => {
    dk.style.setProperty('--i', i);
    dk.style.setProperty('--from', `${(all.length / 2 - i) * 46}px`);
  });

  // ---------- Alminhas ----------
  const deskSoul = window.Mascot ? window.Mascot.mount($('#deskSoul'), { fxLayer }) : null;
  const bigSoul = window.Mascot ? window.Mascot.mount($('#bigSoul'), { fxLayer }) : null;
  deskSoul?.setBase('sleepy');
  bigSoul?.setBase('happy');

  // ---------- topo: a ilha flutuante (Alminha viva, saudação pela hora) e as bolhas que se unem a ela ----------
  const hero = $('#topo');
  const stage = $('#heroStage');
  const heroIsland = $('#heroIsland');
  const heroSoul = window.Mascot ? window.Mascot.mount($('#heroSoul'), { fxLayer }) : null;
  const h = new Date().getHours();
  $('.hi-mid b').textContent = h < 5 ? 'Boa noite' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  const heroClock = () => {
    const d = new Date();
    $('#heroClock').textContent = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const s = d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' }).replace('.', '');
    $('#heroDay').textContent = s.charAt(0).toUpperCase() + s.slice(1);
  };
  heroClock();
  setInterval(heroClock, 15000);
  if (heroSoul) {
    heroSoul.setBase('happy');
    setTimeout(() => (heroSoul.emote('happy', 1600), heroSoul.react('wave')), 900); // dá oi quando a página abre
    heroSoul.startIdle(() => scrollY < innerHeight);
    $('#heroSoul').addEventListener('click', () => heroSoul.poke());
  }
  let heroMerged = false;
  function updateHero(vh) {
    // 0 no topo → 1 depois de ~240 px de rolagem (ela ainda está à vista): as bolhas entram na ilha e ela
    // recolhe para cima, virando a linha fina — como a ilha do app
    const m = clamp(scrollY / 240);
    stage.style.setProperty('--m', m.toFixed(3));
    if (m > 0.85 && !heroMerged) {
      heroMerged = true;
      heroSoul?.emote('excited', 900);
    } else if (m < 0.4) heroMerged = false;
  }

  // ---------- a história da ilha: 5 passos, conforme a rolagem ----------
  const story = $('#ilha');
  const wrap = $('#screenWrap');
  const steps = $$('#steps li');
  const bar = $('#storyBar');
  const panel = $('.d-panel');
  const dock = $('.d-dock');
  const drop = $('.d-drop');
  const file = $('.d-file');
  const cursorEl = $('.d-cursor');
  let step = -1;
  const FACES = { 1: 'sleepy', 2: 'happy', 3: 'neutral', 4: 'happy', 5: 'neutral' };
  const CURSOR = { 1: [820, 300], 2: [652, 14], 3: [752, 214], 4: [700, 70] };
  const setCursor = (x, y) => (cursorEl.style.setProperty('--cx', `${x}px`), cursorEl.style.setProperty('--cy', `${y}px`));
  let dropped = false;

  function enterStep(n) {
    if (n === step) return;
    const from = step;
    step = n;
    desk.dataset.step = n;
    steps.forEach((li) => li.classList.toggle('on', Number(li.dataset.step) === n));
    desk.classList.toggle('awake', n >= 2);
    desk.classList.toggle('spot', n <= 2); // holofote: o resto escurece, a ilha fica em destaque
    desk.classList.toggle('ring', n === 1); // anel pulsando e "Aqui mora a ilha"
    desk.classList.toggle('notb', n >= 4); // com a hotbar, a barra de tarefas pode sumir
    panel.classList.toggle('open', n === 3);
    dock.classList.toggle('open', n === 4);
    drop.classList.toggle('open', n === 5);
    if (CURSOR[n]) setCursor(...CURSOR[n]);
    setZoom(n === 1 ? 1.55 : n === 2 ? 1.9 : 1); // a câmera aproxima da ilha nos dois primeiros passos
    if (!deskSoul) return;
    deskSoul.setBase(FACES[n] || 'neutral');
    if (n === 2 && from < 2) setTimeout(() => (deskSoul.emote('happy', 1400), deskSoul.react('wave')), 450);
    if (n === 3) deskSoul.react('perk');
    if (n === 4) deskSoul.react('nod');
    if (n === 5) deskSoul.emote('surprised', 900);
  }

  // passo 5: o arquivo é arrastado até a ilha e "entra" nela
  function dragFile(sub) {
    const t = ease(clamp(sub / 0.72));
    const x = lerp(250, 616, t);
    const y = lerp(560, 70, t);
    const merge = clamp((sub - 0.72) / 0.12);
    file.style.setProperty('--fx', `${x}px`);
    file.style.setProperty('--fy', `${y}px`);
    file.style.setProperty('--fs', 1 - merge * 0.8);
    file.style.opacity = String(1 - merge);
    desk.classList.toggle('dragging', merge < 1);
    if (merge < 1) setCursor(x + 26, y + 40);
    drop.classList.toggle('hot', t > 0.82 && merge < 1);
    const done = merge >= 1;
    desk.classList.toggle('badge', done);
    if (done && !dropped) {
      dropped = true;
      if (deskSoul) {
        deskSoul.emote('excited', 1400);
        deskSoul.react('hop');
        deskSoul.fx('sparkle', 4);
      }
      drop.classList.remove('open');
      setCursor(690, 120);
    } else if (!done && dropped) {
      dropped = false;
      drop.classList.add('open');
    }
  }

  function updateStory(vh) {
    const r = story.getBoundingClientRect();
    // entrada: a tela vem inclinada e menor, e assenta quando a seção prende no topo
    const e = clamp(1 - r.top / vh);
    if (!reduce.matches) {
      wrap.style.setProperty('--sc', (0.84 + 0.16 * ease(e)).toFixed(4));
      wrap.style.setProperty('--rx', `${(1 - ease(e)) * 18}deg`);
      wrap.style.setProperty('--sy', `${(1 - ease(e)) * 60}px`);
    }
    const p = clamp(-r.top / (r.height - vh));
    bar.style.setProperty('--p', p.toFixed(3));
    const n = p < 0.15 ? 1 : p < 0.32 ? 2 : p < 0.5 ? 3 : p < 0.67 ? 4 : 5;
    enterStep(n);
    if (n === 5) dragFile((p - 0.67) / 0.33);
    else if (step !== 5) {
      desk.classList.remove('dragging', 'badge');
      file.style.opacity = '';
      dropped = false;
    }
  }

  // clicar num passo leva até ele (rolando suave)
  const STEP_AT = { 1: 0.07, 2: 0.235, 3: 0.41, 4: 0.585, 5: 0.9 };
  $$('.step-go').forEach((b) =>
    b.addEventListener('click', () => {
      const y = story.offsetTop + STEP_AT[b.dataset.go] * (story.offsetHeight - innerHeight);
      if (lenis) lenis.scrollTo(y, { duration: 1.3 });
      else scrollTo({ top: y, behavior: reduce.matches ? 'auto' : 'smooth' });
    }),
  );
  $$('#steps li').forEach((li) => li.addEventListener('click', (e) => !e.target.closest('.step-go') && $('.step-go', li).click()));

  // botões − e + do painel de mentira (dá para brincar com eles no passo 3)
  $$('.d-round').forEach((b) =>
    b.addEventListener('click', () => {
      const t = $('#deskTemp');
      const d = Number(b.dataset.temp);
      t.textContent = clamp(Number(t.textContent) + d, 16, 30);
      if (!deskSoul) return;
      deskSoul.react(d < 0 ? 'shiver' : 'nod');
      deskSoul.fx(d < 0 ? 'snow' : 'sun', 2);
    }),
  );

  // ---------- manifesto: as palavras acendem conforme a rolagem (as do fim, em destaque) ----------
  const mf = $('#manifesto');
  const mfText = $('#mfText');
  const words = mfText.textContent.trim().split(/\s+/);
  const colon = words.findIndex((w) => w.endsWith(':'));
  mfText.innerHTML = words.map((w, i) => `<span class="w${i > colon && colon >= 0 ? ' k' : ''}">${w}</span>`).join(' ');
  const wordEls = $$('.w', mfText);
  function updateManifesto(vh) {
    const r = mf.getBoundingClientRect();
    if (r.bottom < 0 || r.top > vh) return;
    const p = reduce.matches ? 1 : clamp(-r.top / (r.height - vh) * 1.15 + 0.08);
    const lit = Math.round(p * wordEls.length);
    wordEls.forEach((w, i) => w.classList.toggle('on', i < lit));
  }

  // ---------- temas: monta as cenas e move a faixa conforme a rolagem ----------
  const THEMES = {
    grafite: { w: ['#1f2937', '#4b5563', '#6366f1'], pb: 'linear-gradient(180deg, rgb(44 44 50 / .55), rgb(24 24 27 / .7))', pt: '#f5f5f7', pd: '#b6b6bc', pa: '#e4e4e8', on: '#1c1c1f', blur: '18px', rim: .25, edge: 'rgb(0 0 0 / .35)' },
    oceano: { w: ['#0c4a6e', '#0e7490', '#22d3ee'], pb: 'linear-gradient(180deg, rgb(20 60 84 / .55), rgb(11 36 51 / .72))', pt: '#f1f8fc', pd: '#a9c6d6', pa: '#5aa7ff', on: '#06121f', blur: '18px', rim: .25, edge: 'rgb(0 0 0 / .35)' },
    areia: { w: ['#fde68a', '#f59e0b', '#fb7185'], pb: '#f1ebe0', pt: '#1c1a17', pd: '#5b544a', pa: '#af4f1c', on: '#fff', blur: '0px', rim: .9, edge: 'rgb(0 0 0 / .08)' },
    ameixa: { w: ['#4c1d95', '#be185d', '#a78bfa'], pb: 'linear-gradient(180deg, rgb(52 36 80 / .55), rgb(29 19 48 / .72))', pt: '#f6f2ff', pd: '#c3b6dc', pa: '#b58cff', on: '#140a24', blur: '18px', rim: .25, edge: 'rgb(0 0 0 / .35)' },
    nuvem: { w: ['#38bdf8', '#a78bfa', '#f472b6'], pb: 'linear-gradient(180deg, rgb(255 255 255 / .38), rgb(255 255 255 / .2))', pt: '#0f1222', pd: '#3a3f55', pa: '#1d5fb3', on: '#fff', blur: '6px', rim: .9, edge: 'rgb(255 255 255 / .4)' },
    floresta: { w: ['#064e3b', '#65a30d', '#34d399'], pb: '#10241b', pt: '#eefaf3', pd: '#a3c4b2', pa: '#5ef5a8', on: '#05170e', blur: '0px', rim: .1, edge: 'rgb(255 255 255 / .06)' },
    vinho: { w: ['#7f1d1d', '#db2777', '#fb7185'], pb: 'linear-gradient(180deg, rgb(70 26 40 / .55), rgb(42 16 24 / .74))', pt: '#fff1f5', pd: '#d9b3bf', pa: '#ff6fb0', on: '#22060f', blur: '18px', rim: .25, edge: 'rgb(0 0 0 / .35)' },
  };
  const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  $$('.th-card').forEach((card) => {
    const t = THEMES[card.dataset.theme];
    const scene = document.createElement('div');
    scene.className = 'th-scene';
    scene.setAttribute('aria-hidden', 'true');
    scene.style.cssText = `--w1:${t.w[0]};--w2:${t.w[1]};--w3:${t.w[2]};--pb:${t.pb};--pt:${t.pt};--pd:${t.pd};--pa:${t.pa};--on:${t.on};--blur:${t.blur};--rim:${t.rim};--edge:${t.edge}`;
    scene.innerHTML = `<i class="tw1"></i><i class="tw2"></i><i class="tw3"></i>
      <div class="th-island"><span class="th-soul"></span><span>${time}</span></div>
      <div class="th-panel"><div class="th-row"><b>Clima</b><small>Ligado · 24° no ambiente</small></div>
        <div class="th-temp">21<sup>°C</sup></div>
        <div class="th-chips"><span class="on">Frio</span><span>Seco</span><span>Auto</span><span>Turbo</span></div></div>`;
    card.prepend(scene);
  });
  const themes = $('#temas');
  const track = $('#thTrack');
  const thCards = $$('.th-card');
  const thBar = $('#thBar');
  function updateThemes(vh) {
    const r = themes.getBoundingClientRect();
    if (r.bottom < -vh || r.top > vh * 1.5) return;
    const p = clamp(-r.top / (r.height - vh));
    const max = Math.max(0, track.scrollWidth - innerWidth);
    track.style.setProperty('--tx', `${(-max * p).toFixed(1)}px`);
    thBar.style.setProperty('--p', p.toFixed(3));
    if (reduce.matches) return;
    // o cartão do meio fica do tamanho certo; os das pontas, um pouco menores
    const cx = innerWidth / 2;
    for (const c of thCards) {
      const b = c.getBoundingClientRect();
      const d = Math.min(1, Math.abs(b.left + b.width / 2 - cx) / innerWidth);
      c.style.setProperty('--cs', (1 - d * 0.14).toFixed(3));
    }
  }

  // ---------- rodapé: a palavra "Alma" sobe enquanto aparece ----------
  const foot = $('.foot');
  const footWord = $('#footWord');
  function updateFoot(vh) {
    if (reduce.matches) return;
    const r = foot.getBoundingClientRect();
    if (r.top > vh) return;
    const q = clamp((vh - r.top) / r.height);
    footWord.style.setProperty('--fy', `${((1 - q) * 120).toFixed(1)}px`);
  }

  // ---------- Alminha grande: reage à rolagem, ao mouse e aos botões ----------
  const almSec = $('#alminha');
  const SCROLL_FACES = ['sleepy', 'neutral', 'happy', 'wink', 'love', 'excited'];
  let faceLock = 0;
  let lastFace = '';
  function updateAlminha(vh) {
    if (!bigSoul || Date.now() < faceLock) return;
    const r = almSec.getBoundingClientRect();
    if (r.bottom < 0 || r.top > vh) return;
    const q = clamp((vh - r.top) / (vh + r.height));
    const f = SCROLL_FACES[Math.min(SCROLL_FACES.length - 1, Math.floor(q * SCROLL_FACES.length))];
    if (f !== lastFace) {
      lastFace = f;
      bigSoul.setBase(f);
      if (f === 'love') bigSoul.fx('heart', 3);
    }
  }
  bigSoul?.startIdle(() => {
    const r = almSec.getBoundingClientRect();
    return r.top < innerHeight && r.bottom > 0 && Date.now() > faceLock;
  });
  const MOODS = {
    wave: () => (bigSoul.emote('happy', 1600), bigSoul.react('wave'), bigSoul.fx('sparkle', 3)),
    dance: () => bigSoul.dance(),
    cold: () => (bigSoul.emote('sad', 1600), bigSoul.react('shiver'), bigSoul.fx('snow', 8)),
    love: () => bigSoul.celebrate(),
    sleep: () => (bigSoul.yawn(), setTimeout(() => bigSoul.emote('sleepy', 2200), 1500)),
  };
  $$('[data-mood]').forEach((b) =>
    b.addEventListener('click', () => {
      if (!bigSoul) return;
      faceLock = Date.now() + 3500;
      MOODS[b.dataset.mood]();
    }),
  );
  // cor do corpo (as mesmas da Configurações › Aparência do app); vale para as duas Alminhas
  $$('.body-sw').forEach((b) =>
    b.addEventListener('click', () => {
      $$('.body-sw').forEach((x) => {
        x.classList.toggle('on', x === b);
        x.setAttribute('aria-pressed', String(x === b));
      });
      const cs = getComputedStyle(b);
      const root = document.documentElement.style;
      root.setProperty('--am-hi', cs.getPropertyValue('--hi'));
      root.setProperty('--am-body', cs.getPropertyValue('--c'));
      root.setProperty('--am-shade', cs.getPropertyValue('--sh'));
      root.setProperty('--am-arm', cs.getPropertyValue('--arm'));
      root.setProperty('--am-visor', cs.getPropertyValue('--visor'));
      if (bigSoul) {
        faceLock = Date.now() + 2000;
        bigSoul.emote('love', 1300);
        bigSoul.react('twirl');
      }
    }),
  );

  // ---------- Liquid Glass: trocar o material ----------
  const glassCard = $('#glassCard');
  const seg = $('.seg');
  const placeThumb = () => {
    const on = $('button.on', seg);
    const th = $('.seg-thumb', seg);
    th.style.width = `${on.offsetWidth}px`;
    th.style.transform = `translateX(${on.offsetLeft - 4}px)`;
  };
  $$('button', seg).forEach((b) =>
    b.addEventListener('click', () => {
      $$('button', seg).forEach((x) => {
        x.classList.toggle('on', x === b);
        x.setAttribute('aria-pressed', String(x === b));
      });
      glassCard.dataset.material = b.dataset.material;
      placeThumb();
    }),
  );
  placeThumb();
  addEventListener('resize', placeThumb);

  // ---------- luz ambiente: cada seção tem a sua cor (troca suave) ----------
  const AMB = {
    topo: [['#1d4ed8', '#7c3aed', '#0891b2'], ['#93c5fd', '#c4b5fd', '#67e8f9']],
    ilha: [['#1e3a8a', '#0e7490', '#6d28d9'], ['#a5b4fc', '#99f6e4', '#d8b4fe']],
    manifesto: [['#312e81', '#1e3a8a', '#0f766e'], ['#c7d2fe', '#bfdbfe', '#99f6e4']],
    novo: [['#be185d', '#7c3aed', '#d97706'], ['#fbcfe8', '#ddd6fe', '#fde68a']],
    temas: [['#9d174d', '#4c1d95', '#0e7490'], ['#fbcfe8', '#ddd6fe', '#a5f3fc']],
    alminha: [['#0369a1', '#22d3ee', '#4f46e5'], ['#bae6fd', '#a5f3fc', '#c7d2fe']],
    vidro: [['#be185d', '#7c3aed', '#d97706'], ['#fbcfe8', '#ddd6fe', '#fde68a']],
    recursos: [['#1d4ed8', '#0891b2', '#4338ca'], ['#bfdbfe', '#a5f3fc', '#c7d2fe']],
    privacidade: [['#047857', '#0e7490', '#1d4ed8'], ['#a7f3d0', '#a5f3fc', '#bfdbfe']],
    baixar: [['#1d4ed8', '#7c3aed', '#0ea5e9'], ['#93c5fd', '#c4b5fd', '#7dd3fc']],
  };
  const sections = $$('main > section[id]');
  const navLinks = $$('.nav-links a');
  let current = '';
  function updateSection(vh) {
    let id = sections[0].id;
    for (const s of sections) if (s.getBoundingClientRect().top < vh * 0.5) id = s.id;
    if (id === current) return;
    current = id;
    const [c1, c2, c3] = AMB[id][light.matches ? 1 : 0];
    const st = $('.ambient').style;
    st.setProperty('--c1', c1);
    st.setProperty('--c2', c2);
    st.setProperty('--c3', c3);
    navLinks.forEach((a) => a.classList.toggle('on', a.getAttribute('href') === `#${id}`));
    placeNavInd();
  }
  // a gota de vidro da barra vai até o link da seção atual (some quando a seção não tem link)
  const navInd = $('.nav-ind');
  function placeNavInd() {
    const a = navLinks.find((x) => x.classList.contains('on'));
    navInd.classList.toggle('on', Boolean(a));
    if (!a) return;
    navInd.style.width = `${a.offsetWidth}px`;
    navInd.style.transform = `translateX(${a.offsetLeft}px)`;
  }
  addEventListener('resize', placeNavInd);

  // ---------- barra do topo: some ao descer, volta ao subir ----------
  const nav = $('#nav');
  let lastY = scrollY;
  function updateNav() {
    const y = scrollY;
    if (Math.abs(y - lastY) < 6) return;
    nav.classList.toggle('hidden', y > lastY && y > 500 && !nav.contains(document.activeElement));
    lastY = y;
  }

  // ---------- profundidade: camadas em velocidades diferentes ----------
  const layers = $$('[data-speed]');
  const amb = $$('.ambient i');
  function updateParallax(vh) {
    if (reduce.matches) return;
    for (const l of layers) {
      const host = l.parentElement.getBoundingClientRect();
      const off = host.top + host.height / 2 - vh / 2;
      l.style.transform = `translate3d(0, ${(off * Number(l.dataset.speed)).toFixed(1)}px, 0)`;
    }
    amb.forEach((a, i) => (a.style.transform = `translate3d(0, ${(scrollY * (i === 1 ? -0.06 : 0.04)).toFixed(1)}px, 0)`));
  }

  // ---------- um quadro por mudança de rolagem ----------
  let queued = false;
  function frame() {
    queued = false;
    const vh = innerHeight;
    updateHero(vh);
    updateStory(vh);
    updateManifesto(vh);
    updateThemes(vh);
    updateFoot(vh);
    updateAlminha(vh);
    updateSection(vh);
    updateNav();
    updateParallax(vh);
  }
  const queue = () => {
    if (!queued) {
      queued = true;
      requestAnimationFrame(frame);
    }
  };
  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue);
  frame();

  // ---------- microinterações com o mouse ----------
  if (fine && !reduce.matches) {
    // reflexo que segue o mouse (vidro, botões e cartões)
    const sheen = $$('.nav, .btn-glass, .btn-primary, .glass-card, .card, .hero-island');
    addEventListener(
      'pointermove',
      (e) => {
        for (const el of sheen) {
          const r = el.getBoundingClientRect();
          if (e.clientY < r.top - 200 || e.clientY > r.bottom + 200) continue;
          el.style.setProperty('--mx', `${e.clientX - r.left}px`);
          el.style.setProperty('--my', `${e.clientY - r.top}px`);
        }
        // topo: a ilha inclina em 3D na direção do mouse, as bolhas se deslocam por profundidade e a luz segue
        if (scrollY < innerHeight) {
          const nx = e.clientX / innerWidth - 0.5;
          const ny = e.clientY / innerHeight - 0.5;
          heroIsland.style.setProperty('--ry', `${(nx * 14).toFixed(2)}deg`);
          heroIsland.style.setProperty('--rx', `${(-ny * 10).toFixed(2)}deg`);
          stage.style.setProperty('--px', `${(nx * 40).toFixed(1)}px`);
          stage.style.setProperty('--py', `${(ny * 30).toFixed(1)}px`);
          const hr = hero.getBoundingClientRect();
          hero.style.setProperty('--sx', `${e.clientX - hr.left}px`);
          hero.style.setProperty('--sy', `${e.clientY - hr.top}px`);
          heroSoul?.look(e.clientX, e.clientY);
          heroSoul?.lean(e.clientX);
        }
        // as Alminhas olham para o mouse
        deskSoul?.look(e.clientX, e.clientY);
        bigSoul?.look(e.clientX, e.clientY);
        bigSoul?.lean(e.clientX);
      },
      { passive: true },
    );
    // efeito magnético: o botão "puxa" de leve na direção do cursor
    $$('.magnetic').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
        const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
        el.style.setProperty('--tx', `${(dx * 6).toFixed(1)}px`);
        el.style.setProperty('--ty', `${(dy * 4).toFixed(1)}px`);
      });
      el.addEventListener('pointerleave', () => (el.style.setProperty('--tx', '0px'), el.style.setProperty('--ty', '0px')));
    });
    // cartões flutuam e inclinam um pouquinho na direção do mouse
    $$('.card').forEach((c) => {
      c.addEventListener('pointermove', (e) => {
        const r = c.getBoundingClientRect();
        c.style.setProperty('--ry', `${(((e.clientX - r.left) / r.width - 0.5) * 6).toFixed(2)}deg`);
        c.style.setProperty('--rx', `${(-((e.clientY - r.top) / r.height - 0.5) * 5).toFixed(2)}deg`);
      });
      c.addEventListener('pointerleave', () => (c.style.setProperty('--rx', '0deg'), c.style.setProperty('--ry', '0deg')));
    });
  }
})();
