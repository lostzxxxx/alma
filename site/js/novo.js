// Novidades da 1.1 no site: demonstrações que dá para usar (foco, tradução, conta-gotas, módulos e Alma Actions)
// e os enfeites (céu estrelado, faixas de recursos, confete no download).
// Tudo funciona com mouse, toque e teclado; com "reduzir movimento" nada corre sozinho nem fica em loop.
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const fxLayer = $('#fxLayer');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const pad = (n) => String(n).padStart(2, '0');
  const mount = (el, base = 'happy') => {
    if (!window.Mascot || !el) return null;
    const m = window.Mascot.mount(el, { fxLayer });
    m.setBase(base);
    return m;
  };
  // avisa quando o elemento entra/sai da tela
  const watch = (el, fn, threshold = 0.3) => new IntersectionObserver((es) => es.forEach((e) => fn(e.isIntersecting)), { threshold }).observe(el);
  const svg = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  const IC = {
    ac: svg('<path d="M12 2v20M4.9 4.9l14.2 14.2M2 12h20M4.9 19.1 19.1 4.9"/>'),
    focus: svg('<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.5 1.5M9.5 2.5h5"/>'),
    music: svg('<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>'),
    tasks: svg('<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3.5 6 1.5 1.5L7.5 5M3.5 12l1.5 1.5 2.5-2.5M3.5 18l1.5 1.5 2.5-2.5"/>'),
    tray: svg('<path d="M3 13h5l1.5 3h5L16 13h5"/><path d="M5.5 5h13L21 13v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5z"/>'),
    translate: svg('<path d="M4 5h8M8 3v2M5.5 5c.8 3.2 3 5.6 6 7M10.5 5c-.6 3.4-2.7 6-5.8 7.6"/><path d="m12.5 20 3.8-9 3.8 9M13.9 17h4.8"/>'),
    color: svg('<path d="m14.5 6.5 3 3M3 21l1.2-3.6L14 7.6l2.4 2.4-9.8 9.8z"/><path d="M14.2 4.8 16 3a2.1 2.1 0 0 1 3 3l-1.8 1.8"/>'),
    apps: svg('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'),
    vol: svg('<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/>'),
    moon: svg('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>'),
    hide: svg('<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/>'),
    bell: svg('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>'),
    check: svg('<path d="m5 12 5 5L20 7"/>'),
    play: svg('<path d="M7 4.5v15l12-7.5z"/>'),
    pause: svg('<rect x="6" y="4.5" width="4" height="15" rx="1"/><rect x="14" y="4.5" width="4" height="15" rx="1"/>'),
    grip: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>',
  };

  // =========================================================
  // Enfeites
  // =========================================================
  // céu estrelado atrás de tudo (piscando devagar, cada estrela no seu ritmo)
  const amb = $('.ambient');
  if (amb) {
    const sky = document.createElement('div');
    sky.className = 'stars';
    for (let i = 0; i < 80; i++) {
      const s = document.createElement('span');
      s.style.cssText = `left:${(Math.random() * 100).toFixed(2)}%;top:${(Math.random() * 100).toFixed(2)}%;--s:${(Math.random() * 1.8 + 0.6).toFixed(2)}px;--t:${(Math.random() * 4 + 3).toFixed(1)}s;--dl:${(-Math.random() * 7).toFixed(1)}s`;
      sky.append(s);
    }
    amb.append(sky);
  }

  // faixas de recursos: duplica o conteúdo para a volta não ter emenda (a cópia é só visual)
  $$('.rb-track').forEach((t) => {
    const copy = t.innerHTML;
    t.insertAdjacentHTML('beforeend', copy);
    [...t.children].slice(t.children.length / 2).forEach((c) => c.setAttribute('aria-hidden', 'true'));
  });

  // confete ao clicar em baixar (raro, então pode comemorar)
  const CONFETTI = ['#7fe0ff', '#3a9dff', '#a78bfa', '#ff6fae', '#ffd60a', '#34c759'];
  $$('.dl-link').forEach((a) =>
    a.addEventListener('click', (e) => {
      if (reduce.matches) return;
      const r = a.getBoundingClientRect();
      const x = e.clientX || r.left + r.width / 2;
      const y = e.clientY || r.top + r.height / 2;
      for (let i = 0; i < 28; i++) {
        const p = document.createElement('i');
        p.className = 'confetti';
        p.style.cssText = `left:${x}px;top:${y}px;background:${CONFETTI[i % CONFETTI.length]}`;
        fxLayer.append(p);
        const ang = Math.random() * Math.PI * 2;
        const dist = 70 + Math.random() * 150;
        const dx = Math.cos(ang) * dist;
        const dy = Math.sin(ang) * dist - 70;
        p.animate(
          [
            { transform: 'translate(-50%, -50%) rotate(0deg) scale(1)', opacity: 1 },
            { transform: `translate(calc(-50% + ${dx.toFixed(0)}px), calc(-50% + ${(dy + 140).toFixed(0)}px)) rotate(${(Math.random() * 600 - 300).toFixed(0)}deg) scale(.6)`, opacity: 0 },
          ],
          { duration: 900 + Math.random() * 600, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' },
        ).finished.then(() => p.remove());
      }
    }),
  );

  // bordas que giram só nos cartões à vista
  $$('.demo').forEach((d) => watch(d, (v) => d.classList.toggle('inview', v), 0.05));

  // =========================================================
  // Foco (acelerado: 100 ms = 6 s, ou seja, 1 segundo vale 1 minuto)
  // =========================================================
  (() => {
    const demo = $('#demoFocus');
    if (!demo) return;
    const soul = mount($('#fSoul'));
    const PH = { focus: ['Foco', 25], short: ['Pausa curta', 5], long: ['Pausa longa', 15] };
    const F = { phase: 'focus', round: 1, total: 1500, left: 1500, running: false, timer: null, started: false, held: false };
    const play = $('#fPlay');
    function draw() {
      const t = `${pad(Math.floor(F.left / 60))}:${pad(F.left % 60)}`;
      $('#fTime').textContent = t;
      $('#fChip').textContent = t;
      const off = String(100 - (1 - F.left / F.total) * 100);
      $('#fRing').style.strokeDashoffset = off;
      $('#fMini').style.strokeDashoffset = off;
      $('#fPhase').textContent = F.phase === 'focus' ? `Foco · rodada ${F.round} de 4` : PH[F.phase][0];
      demo.dataset.phase = F.phase;
      demo.classList.toggle('sleeping', F.running && F.phase === 'focus');
      play.innerHTML = F.running ? IC.pause : IC.play;
      play.setAttribute('aria-label', F.running ? 'Pausar' : 'Começar');
      $$('#fDots i').forEach((d, i) => {
        d.classList.toggle('done', i < F.round - 1 || (i === F.round - 1 && F.phase !== 'focus'));
        d.classList.toggle('now', i === F.round - 1 && F.phase === 'focus');
      });
    }
    // a Alminha dorme durante o foco e acorda na pausa
    const face = () => soul?.setBase(F.running && F.phase === 'focus' ? 'sleepy' : 'happy');
    function next() {
      if (F.phase === 'focus') {
        F.phase = F.round % 4 === 0 ? 'long' : 'short';
        soul?.celebrate();
      } else {
        F.phase = 'focus';
        F.round = (F.round % 4) + 1;
        soul?.react('stretch');
      }
      F.total = F.left = PH[F.phase][1] * 60;
      face();
    }
    function tick() {
      F.left = Math.max(0, F.left - 6);
      if (F.left === 0) next();
      draw();
    }
    function start() {
      if (F.running) return;
      F.running = true;
      F.timer = setInterval(tick, 100);
      face();
      draw();
    }
    function pause() {
      F.running = false;
      clearInterval(F.timer);
      face();
      draw();
    }
    play.addEventListener('click', () => {
      F.held = false;
      F.running ? pause() : start();
    });
    $('#fReset').addEventListener('click', () => {
      pause();
      Object.assign(F, { phase: 'focus', round: 1, total: 1500, left: 1500 });
      soul?.react('nod');
      draw();
    });
    $('#fSkip').addEventListener('click', () => {
      next();
      draw();
    });
    draw();
    // começa sozinho na primeira vez que aparece; pausa fora da tela e volta quando aparece de novo
    watch(demo, (v) => {
      if (v && !F.started) {
        F.started = true;
        if (!reduce.matches) start();
      } else if (!v && F.running) {
        pause();
        F.held = true;
      } else if (v && F.held) {
        F.held = false;
        start();
      }
    });
  })();

  // =========================================================
  // Tradução rápida: arrastar uma frase até a ilha (ou clicar nela)
  // =========================================================
  (() => {
    const stage = $('#trStage');
    if (!stage) return;
    const island = $('#trIsland');
    const soul = mount($('#trSoul'));
    const PHRASES = [
      { from: 'Inglês', to: 'Português', out: 'Bom dia! Vamos começar?' },
      { from: 'Espanhol', to: 'Português', out: 'Onde fica a estação?' },
      { from: 'Francês', to: 'Português', out: 'Muito obrigado pela sua ajuda' },
      { from: 'Japonês', to: 'Português', out: 'Que dia bonito hoje, né?' },
      { from: 'Português', to: 'Inglês', out: 'Shall we grab a coffee?', note: 'Já estava em português: foi para o inglês' },
    ];
    let typing = null;
    let used = false;
    async function translate(i) {
      used = true;
      const p = PHRASES[i];
      const txt = $('#trText');
      clearInterval(typing);
      $('#trLangs').textContent = `${p.from} → ${p.to}`;
      $('#trNote').textContent = p.note || '';
      txt.className = 'tr-text wait';
      txt.textContent = 'Traduzindo…';
      island.classList.remove('hot');
      soul?.emote('think', 700);
      await wait(reduce.matches ? 150 : 550);
      txt.className = 'tr-text';
      if (reduce.matches) txt.textContent = p.out;
      else {
        // a tradução aparece escrevendo, letra por letra
        let n = 0;
        txt.innerHTML = '<span></span><i class="tr-caret"></i>';
        const span = txt.firstChild;
        typing = setInterval(() => {
          span.textContent = p.out.slice(0, ++n);
          if (n >= p.out.length) {
            clearInterval(typing);
            setTimeout(() => txt.querySelector('.tr-caret')?.remove(), 900);
          }
        }, 28);
      }
      soul?.emote('happy', 1300);
      soul?.react('nod');
      soul?.fx('sparkle', 2);
    }
    const near = (r, x, y, pad = 26) => x > r.left - pad && x < r.right + pad && y > r.top - pad && y < r.bottom + pad;
    // a frase "levanta" e segue o ponteiro; solta perto da ilha → traduz, longe → volta para o lugar
    $$('.tr-chip', stage).forEach((chip) => {
      let d = null;
      chip.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        const r = chip.getBoundingClientRect();
        d = { x0: e.clientX, y0: e.clientY, ox: e.clientX - r.left, oy: e.clientY - r.top, ghost: null };
        chip.setPointerCapture(e.pointerId);
      });
      chip.addEventListener('pointermove', (e) => {
        if (!d) return;
        if (!d.ghost) {
          if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 6) return;
          d.ghost = chip.cloneNode(true);
          d.ghost.classList.add('tr-ghost');
          d.ghost.removeAttribute('data-i');
          d.ghost.style.width = `${chip.offsetWidth}px`;
          document.body.append(d.ghost);
          chip.classList.add('lifted');
          soul?.emote('surprised', 700);
        }
        d.ghost.style.transform = `translate(${e.clientX - d.ox}px, ${e.clientY - d.oy}px) rotate(-3deg) scale(1.04)`;
        island.classList.toggle('hot', near(island.getBoundingClientRect(), e.clientX, e.clientY));
      });
      const end = (e) => {
        if (!d) return;
        const { ghost } = d;
        d = null;
        if (!ghost) return;
        chip.dataset.dragged = '1';
        const ir = island.getBoundingClientRect();
        const hit = near(ir, e.clientX, e.clientY);
        island.classList.remove('hot');
        const from = ghost.style.transform;
        const to = hit
          ? `translate(${ir.left + ir.width / 2 - ghost.offsetWidth / 2}px, ${ir.top + ir.height / 2 - ghost.offsetHeight / 2}px) scale(.2)`
          : `translate(${chip.getBoundingClientRect().left}px, ${chip.getBoundingClientRect().top}px)`;
        ghost
          .animate([{ transform: from, opacity: 1 }, { transform: to, opacity: hit ? 0 : 1 }], { duration: reduce.matches ? 1 : hit ? 320 : 380, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' })
          .finished.then(() => {
            ghost.remove();
            chip.classList.remove('lifted');
          });
        if (hit) translate(Number(chip.dataset.i));
      };
      chip.addEventListener('pointerup', end);
      chip.addEventListener('pointercancel', end);
      chip.addEventListener('click', () => {
        if (chip.dataset.dragged) return void delete chip.dataset.dragged;
        translate(Number(chip.dataset.i));
      });
    });
    // na primeira vez que aparece, a Alma mostra como é: uma frase voa sozinha até a ilha
    let shown = false;
    watch(
      stage,
      async (v) => {
        if (!v || shown || used || reduce.matches) return;
        shown = true;
        await wait(900);
        if (used) return;
        const chip = $('.tr-chip', stage);
        const cr = chip.getBoundingClientRect();
        const ir = island.getBoundingClientRect();
        const g = chip.cloneNode(true);
        g.classList.add('tr-ghost');
        g.style.width = `${chip.offsetWidth}px`;
        document.body.append(g);
        chip.classList.add('lifted');
        const a = `translate(${cr.left}px, ${cr.top}px)`;
        const b = `translate(${cr.left + (ir.left - cr.left) * 0.5}px, ${cr.top - 40}px) rotate(-4deg) scale(1.05)`;
        const c = `translate(${ir.left + ir.width / 2 - chip.offsetWidth / 2}px, ${ir.top + ir.height / 2 - chip.offsetHeight / 2}px) scale(.2)`;
        await g.animate([{ transform: a }, { transform: b, offset: 0.55 }, { transform: c, opacity: 0 }], { duration: 1300, easing: 'cubic-bezier(0.77, 0, 0.175, 1)' }).finished;
        g.remove();
        chip.classList.remove('lifted');
        translate(0);
      },
      0.6,
    );
  })();

  // =========================================================
  // Conta-gotas: uma "tela" desenhada num canvas; a lupa mostra os pixels e o clique pega a cor
  // =========================================================
  (() => {
    const screen = $('#cpScreen');
    if (!screen) return;
    const cv = $('#cpCanvas');
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    const zoom = $('#cpZoom').getContext('2d');
    const zimg = zoom.createImageData(15, 15);
    let img = null;
    let W = 0;
    let H = 0;
    let dpr = 1;
    let pos = { x: 0, y: 0 };
    let hist = [];
    let cur = { r: 58, g: 157, b: 255 };
    function paint() {
      dpr = Math.min(2, devicePixelRatio || 1);
      W = Math.round(screen.clientWidth * dpr);
      H = Math.round(screen.clientHeight * dpr);
      if (!W || !H) return;
      cv.width = W;
      cv.height = H;
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, '#0ea5e9');
      g.addColorStop(0.5, '#7c3aed');
      g.addColorStop(1, '#db2777');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      const blob = (x, y, r, c) => {
        const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, c);
        rg.addColorStop(1, 'transparent');
        ctx.fillStyle = rg;
        ctx.fillRect(0, 0, W, H);
      };
      blob(W * 0.78, H * 0.2, W * 0.32, '#ffd60acc');
      blob(W * 0.15, H * 0.85, W * 0.3, '#34d399cc');
      // uma janela com um cabeçalho e uma paleta de cores bem nítidas para pegar
      const rr = (x, y, w, h, r, c) => {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, r);
        ctx.fill();
      };
      const u = W / 100;
      rr(u * 8, H * 0.16, u * 46, H * 0.62, u * 2.2, '#fbfbfd');
      rr(u * 8, H * 0.16, u * 46, H * 0.12, [u * 2.2, u * 2.2, 0, 0], '#ff6fae');
      ['#ff375f', '#ff9f0a', '#ffd60a', '#34c759', '#3a9dff', '#a78bfa'].forEach((c, i) => rr(u * (11 + i * 7), H * 0.36, u * 5.6, u * 5.6, u * 1.2, c));
      ctx.fillStyle = '#e3e5ec';
      for (let i = 0; i < 3; i++) rr(u * 11, H * (0.55 + i * 0.07), u * (36 - i * 8), H * 0.035, u, '#e3e5ec');
      // e um "app" redondo do lado
      ctx.fillStyle = '#111216';
      ctx.beginPath();
      ctx.arc(u * 76, H * 0.62, u * 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#F6F4EF';
      ctx.beginPath();
      ctx.ellipse(u * 76, H * 0.62, u * 5, u * 5.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1E2533';
      rr(u * 72.6, H * 0.6, u * 6.8, u * 3.4, u * 1.6, '#1E2533');
      img = ctx.getImageData(0, 0, W, H).data;
    }
    const px = (x, y) => {
      const i = (Math.max(0, Math.min(H - 1, y)) * W + Math.max(0, Math.min(W - 1, x))) * 4;
      return { r: img[i], g: img[i + 1], b: img[i + 2] };
    };
    const hex = (c) => '#' + [c.r, c.g, c.b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
    function hsl({ r, g, b }) {
      const [R, G, B] = [r / 255, g / 255, b / 255];
      const max = Math.max(R, G, B);
      const min = Math.min(R, G, B);
      const l = (max + min) / 2;
      let h = 0;
      let s = 0;
      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        h = (max === R ? (G - B) / d + (G < B ? 6 : 0) : max === G ? (B - R) / d + 2 : (R - G) / d + 4) * 60;
      }
      return `hsl(${Math.round(h)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
    }
    const fmt = { hex, rgb: (c) => `rgb(${c.r}, ${c.g}, ${c.b})`, hsl };
    // move a lupa para (x, y) em pixels CSS dentro da tela
    function moveTo(x, y) {
      if (!img) return;
      pos = { x: Math.max(0, Math.min(screen.clientWidth - 1, x)), y: Math.max(0, Math.min(screen.clientHeight - 1, y)) };
      screen.style.setProperty('--lx', `${pos.x}px`);
      screen.style.setProperty('--ly', `${pos.y}px`);
      const cx = Math.round(pos.x * dpr);
      const cy = Math.round(pos.y * dpr);
      for (let j = 0; j < 15; j++)
        for (let i = 0; i < 15; i++) {
          const c = px(cx + i - 7, cy + j - 7);
          const k = (j * 15 + i) * 4;
          zimg.data[k] = c.r;
          zimg.data[k + 1] = c.g;
          zimg.data[k + 2] = c.b;
          zimg.data[k + 3] = 255;
        }
      zoom.putImageData(zimg, 0, 0);
      const c = px(cx, cy);
      screen.style.setProperty('--c', hex(c));
      $('#cpTagTxt').textContent = hex(c);
    }
    function show(c) {
      cur = c;
      $('#cpSw').style.setProperty('--c', hex(c));
      $$('.cp-val').forEach((b) => ($('b', b).textContent = fmt[b.dataset.f](c)));
    }
    const copy = (t) => navigator.clipboard?.writeText(t).catch(() => {});
    function pick() {
      const c = px(Math.round(pos.x * dpr), Math.round(pos.y * dpr));
      show(c);
      copy(hex(c));
      flash($('.cp-val[data-f="hex"]'));
      const h = hex(c);
      hist = [h, ...hist.filter((x) => x !== h)].slice(0, 8);
      $('#cpHist').innerHTML = hist.map((x) => `<button style="--c:${x}" data-hex="${x}" title="${x}" aria-label="Cor ${x}"></button>`).join('');
      if (!reduce.matches) {
        const rp = document.createElement('i');
        rp.className = 'cp-ripple';
        rp.style.cssText = `left:${pos.x}px;top:${pos.y}px;--c:${h}`;
        screen.append(rp);
        rp.addEventListener('animationend', () => rp.remove());
      }
    }
    function flash(b) {
      b.classList.add('copied');
      clearTimeout(b._t);
      b._t = setTimeout(() => b.classList.remove('copied'), 1200);
    }
    const local = (e) => {
      const r = screen.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };
    screen.addEventListener('pointerenter', () => screen.classList.add('active'));
    screen.addEventListener('pointerleave', (e) => e.pointerType === 'mouse' && screen.classList.remove('active'));
    screen.addEventListener('pointermove', (e) => moveTo(...local(e)));
    screen.addEventListener('pointerdown', (e) => {
      screen.classList.add('active');
      moveTo(...local(e));
    });
    screen.addEventListener('click', pick);
    screen.addEventListener('focus', () => {
      if (screen.classList.contains('active')) return;
      screen.classList.add('active');
      moveTo(screen.clientWidth / 2, screen.clientHeight / 2);
    });
    screen.addEventListener('blur', () => screen.classList.remove('active'));
    screen.addEventListener('keydown', (e) => {
      const s = e.shiftKey ? 16 : 3;
      const d = { ArrowLeft: [-s, 0], ArrowRight: [s, 0], ArrowUp: [0, -s], ArrowDown: [0, s] }[e.key];
      if (d) {
        e.preventDefault();
        moveTo(pos.x + d[0], pos.y + d[1]);
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        pick();
      }
    });
    $$('.cp-val').forEach((b) => b.addEventListener('click', () => (copy(fmt[b.dataset.f](cur)), flash(b))));
    $('#cpHist').addEventListener('click', (e) => {
      const b = e.target.closest('[data-hex]');
      if (!b) return;
      const n = parseInt(b.dataset.hex.slice(1), 16);
      show({ r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 });
      copy(b.dataset.hex);
      flash($('.cp-val[data-f="hex"]'));
    });
    new ResizeObserver(() => paint()).observe(screen);
    paint();
    show(cur);
    // primeira vez à vista: a lupa passeia até a paleta e pega o azul
    let shown = false;
    let user = false;
    screen.addEventListener('pointerenter', () => (user = true), { once: true });
    watch(
      screen,
      async (v) => {
        if (!v || shown || reduce.matches) return;
        shown = true;
        await wait(700);
        if (user || !img) return;
        screen.classList.add('active');
        const u = screen.clientWidth / 100;
        const path = [
          [u * 70, screen.clientHeight * 0.25],
          [u * 50, screen.clientHeight * 0.3],
          [u * 41.8, screen.clientHeight * 0.36 + u * 2.8],
        ];
        let [x, y] = [u * 88, screen.clientHeight * 0.8];
        for (const [tx, ty] of path) {
          const sx = x;
          const sy = y;
          const t0 = performance.now();
          await new Promise((done) => {
            const step = (now) => {
              if (user) return done();
              const t = Math.min(1, (now - t0) / 600);
              const k = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
              moveTo(sx + (tx - sx) * k, sy + (ty - sy) * k);
              t < 1 ? requestAnimationFrame(step) : done();
            };
            requestAnimationFrame(step);
          });
          [x, y] = [tx, ty];
        }
        if (user) return;
        await wait(350);
        pick();
        await wait(1400);
        if (!user && document.activeElement !== screen) screen.classList.remove('active');
      },
      0.6,
    );
  })();

  // =========================================================
  // Módulos: ligar, desligar e reordenar; a barra de abas acompanha
  // =========================================================
  (() => {
    const list = $('#mdList');
    if (!list) return;
    const tabs = $('#mdTabs');
    const ind = $('#mdInd');
    const MODS = [
      { id: 'ac', n: 'Clima', h: 200, on: true },
      { id: 'focus', n: 'Foco', h: 22, on: true },
      { id: 'music', n: 'Música', h: 330, on: true },
      { id: 'translate', n: 'Traduzir', h: 188, on: true },
      { id: 'color', n: 'Cores', h: 300, on: true },
      { id: 'tray', n: 'Bandeja', h: 150, on: false },
      { id: 'apps', n: 'Apps', h: 255, on: true },
    ];
    let sel = 'ac';
    list.innerHTML = MODS.map(
      (m) => `<li class="md-row ${m.on ? '' : 'off'}" data-id="${m.id}">
        <button class="md-grip" aria-label="Mover ${m.n} (Alt + setas)">${IC.grip}</button>
        <span class="md-ic" style="--h:${m.h}">${IC[m.id]}</span>
        <span class="md-name">${m.n}</span>
        <button class="sw" role="switch" aria-checked="${m.on}" aria-label="Mostrar ${m.n}"></button>
      </li>`,
    ).join('');
    const order = () => $$('.md-row', list).map((r) => MODS.find((m) => m.id === r.dataset.id));
    // FLIP: mede antes, muda o DOM, anima de onde estava para onde ficou
    const flip = (els, change) => {
      const before = new Map(els.map((el) => [el, el.getBoundingClientRect()]));
      change();
      if (reduce.matches) return;
      for (const [el, r] of before) {
        if (!el.isConnected) continue;
        const n = el.getBoundingClientRect();
        const dx = r.left - n.left;
        const dy = r.top - n.top;
        if (dx || dy) el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 260, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
      }
    };
    function placeInd(instant) {
      const b = $(`.md-tab[data-id="${sel}"]`, tabs);
      if (!b) return;
      if (instant) ind.style.transition = 'none';
      ind.style.width = `${b.offsetWidth}px`;
      ind.style.transform = `translateX(${b.offsetLeft}px)`;
      if (instant) requestAnimationFrame(() => (ind.style.transition = ''));
    }
    function renderTabs(first) {
      const on = order().filter((m) => m.on);
      if (!on.some((m) => m.id === sel)) sel = on[0].id;
      const old = new Map($$('.md-tab', tabs).map((b) => [b.dataset.id, b]));
      flip([...old.values()], () => {
        for (const [id, b] of old) if (!on.some((m) => m.id === id)) b.remove();
        on.forEach((m) => {
          let b = old.get(m.id);
          const fresh = !b;
          if (fresh) {
            b = document.createElement('button');
            b.className = 'md-tab';
            b.dataset.id = m.id;
            b.setAttribute('role', 'tab');
            b.innerHTML = `${IC[m.id]}<span>${m.n}</span>`;
            b.addEventListener('click', () => {
              sel = m.id;
              renderTabs();
            });
          }
          tabs.append(b);
          if (fresh && !first && !reduce.matches) b.animate([{ opacity: 0, transform: 'scale(.85)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
        });
      });
      $$('.md-tab', tabs).forEach((b) => {
        b.classList.toggle('on', b.dataset.id === sel);
        b.setAttribute('aria-selected', String(b.dataset.id === sel));
      });
      placeInd(first);
    }
    list.addEventListener('click', (e) => {
      const s = e.target.closest('.sw');
      if (!s) return;
      const row = s.closest('.md-row');
      const m = MODS.find((x) => x.id === row.dataset.id);
      if (m.on && MODS.filter((x) => x.on).length === 1) return; // pelo menos um fica ligado
      m.on = !m.on;
      s.setAttribute('aria-checked', String(m.on));
      row.classList.toggle('off', !m.on);
      renderTabs();
    });
    // teclado: Alt + ↑/↓ na alça move a linha
    list.addEventListener('keydown', (e) => {
      const g = e.target.closest('.md-grip');
      if (!g || !e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
      e.preventDefault();
      const row = g.closest('.md-row');
      const sib = e.key === 'ArrowUp' ? row.previousElementSibling : row.nextElementSibling;
      if (!sib) return;
      flip($$('.md-row', list), () => (e.key === 'ArrowUp' ? list.insertBefore(row, sib) : list.insertBefore(sib, row)));
      g.focus();
      renderTabs();
    });
    // arrastar pela alça: a linha segue o dedo/mouse e as outras abrem espaço
    list.addEventListener('pointerdown', (e) => {
      const g = e.target.closest('.md-grip');
      if (!g || e.button !== 0) return;
      e.preventDefault();
      const row = g.closest('.md-row');
      let y0 = e.clientY;
      row.classList.add('drag');
      g.setPointerCapture(e.pointerId);
      const move = (ev) => {
        let dy = ev.clientY - y0;
        const next = row.nextElementSibling;
        const prev = row.previousElementSibling;
        if (next && dy > next.offsetHeight / 2) {
          const h = next.offsetHeight + 6;
          flip([next], () => list.insertBefore(next, row));
          y0 += h;
          dy -= h;
        } else if (prev && dy < -prev.offsetHeight / 2) {
          const h = prev.offsetHeight + 6;
          flip([prev], () => list.insertBefore(row, prev));
          y0 -= h;
          dy += h;
        }
        row.style.transform = `translateY(${dy}px)`;
      };
      const up = () => {
        g.removeEventListener('pointermove', move);
        g.removeEventListener('pointerup', up);
        g.removeEventListener('pointercancel', up);
        row.classList.remove('drag');
        const from = row.style.transform;
        row.style.transform = '';
        if (from && !reduce.matches) row.animate([{ transform: from }, { transform: 'none' }], { duration: 220, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
        renderTabs();
      };
      g.addEventListener('pointermove', move);
      g.addEventListener('pointerup', up);
      g.addEventListener('pointercancel', up);
    });
    renderTabs(true);
    new ResizeObserver(() => placeInd(true)).observe(tabs);
  })();

  // =========================================================
  // Alma Actions: a regra à esquerda acende passo a passo enquanto a cena à direita acontece
  // =========================================================
  (() => {
    const demo = $('#demoAct');
    if (!demo) return;
    const scene = $('#actScene');
    const soul = mount($('#asSoul'));
    const ACTS = {
      game: { when: 'Abrir um jogo', undo: 'Desfazer tudo quando o jogo fechar', steps: [['vol', 'Ajustar o volume para 35%'], ['moon', 'Ligar o modo silencioso'], ['hide', 'Esconder a ilha']] },
      focus: { when: 'Começar o foco', undo: 'Desfazer tudo quando o foco acabar', steps: [['moon', 'Ligar o modo silencioso'], ['vol', 'Ajustar o volume para 25%']] },
      morning: { when: 'A Alma abrir', undo: null, steps: [['bell', 'Avisar “Bom dia! Que tal começar pelas tarefas?”']] },
    };
    let key = 'game';
    let run = 0;
    let visible = false;
    let vol = 80;
    let focusT = null;
    const clock = () => ($('#asClock').textContent = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    clock();
    setInterval(clock, 15000);
    function setVol(v) {
      const from = vol;
      vol = v;
      $('#asBar').style.setProperty('--v', String(v / 100));
      scene.classList.add('vol');
      // o número conta até o valor novo junto com a barra
      const t0 = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - t0) / (reduce.matches ? 1 : 800));
        $('#asVolN').textContent = Math.round(from + (v - from) * (1 - Math.pow(1 - t, 3)));
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      clearTimeout(setVol.t);
      setVol.t = setTimeout(() => scene.classList.remove('vol'), 1700);
    }
    const toast = (text) => {
      const t = $('#asToast');
      t.textContent = text;
      t.classList.add('show');
      clearTimeout(toast.t);
      toast.t = setTimeout(() => t.classList.remove('show'), 2600);
    };
    function focusClock(on) {
      clearInterval(focusT);
      if (!on) return;
      let left = 25 * 60 - 1;
      focusT = setInterval(() => {
        left = Math.max(0, left - 6);
        $('#asFocus').textContent = `${pad(Math.floor(left / 60))}:${pad(left % 60)}`;
        $('#asRing').style.strokeDashoffset = String(100 * (left / 1500));
      }, 100);
    }
    function renderRule() {
      const a = ACTS[key];
      $$('.act-tabs button', demo).forEach((b) => {
        b.classList.toggle('on', b.dataset.act === key);
        b.setAttribute('aria-selected', String(b.dataset.act === key));
      });
      $('#actWhen').textContent = a.when;
      $('#actSteps').innerHTML = a.steps.map(([ic, t]) => `<li><span class="ic">${IC[ic]}</span><span>${t}</span><span class="st">${IC.check}</span></li>`).join('');
      $('#actUndo').hidden = !a.undo;
      $('#actUndoTxt').textContent = a.undo || '';
    }
    function resetScene() {
      scene.className = 'act-scene';
      focusClock(false);
      $('#asToast').classList.remove('show');
      vol = 80;
      $('#asBar').style.setProperty('--v', '.8');
      $('#asVolN').textContent = '80';
      $('#actWhenBox').classList.remove('hit');
      soul?.setBase('happy');
    }
    async function play(k) {
      key = k;
      const id = ++run;
      // cada pausa confere se esta rodada ainda vale (trocou de exemplo ou saiu da tela → para)
      const step = async (ms) => {
        await wait(reduce.matches ? Math.min(ms, 500) : ms);
        if (id !== run) throw new Error('parou');
      };
      try {
        renderRule();
        resetScene();
        if (key === 'morning') scene.classList.add('pre');
        await step(800);
        // o "quando" acontece
        $('#actWhenBox').classList.add('hit');
        if (key === 'game') scene.classList.add('game');
        if (key === 'focus') {
          scene.classList.add('doc', 'focusing');
          soul?.setBase('sleepy');
          focusClock(true);
        }
        if (key === 'morning') {
          scene.classList.remove('pre');
          await step(500);
          soul?.react('wave');
        }
        await step(800);
        // os passos, um de cada vez
        const lis = $$('#actSteps li');
        for (let i = 0; i < lis.length; i++) {
          lis[i].classList.add('run');
          await step(500);
          const [ic] = ACTS[key].steps[i];
          if (ic === 'vol') setVol(key === 'game' ? 35 : 25);
          if (ic === 'moon') scene.classList.add('silent');
          if (ic === 'hide') scene.classList.add('hide-island');
          if (ic === 'bell') {
            toast('Bom dia! Que tal começar pelas tarefas?');
            soul?.emote('happy', 1500);
            soul?.fx('sparkle', 3);
          }
          await step(450);
          lis[i].classList.replace('run', 'done');
          await step(350);
        }
        $('#actWhenBox').classList.remove('hit');
        if (!ACTS[key].undo) {
          await step(3600);
        } else {
          await step(2600);
          // acabou (o jogo fechou / o foco terminou): a Alma desfaz tudo, de trás para frente
          $('#actUndo').classList.add('hit');
          scene.classList.remove('game', 'doc', 'focusing');
          focusClock(false);
          soul?.setBase('happy');
          await step(500);
          for (const li of lis.reverse()) {
            li.classList.replace('done', 'undone');
            if (li.textContent.includes('volume')) setVol(80);
            if (li.textContent.includes('silencioso')) scene.classList.remove('silent');
            if (li.textContent.includes('Esconder')) scene.classList.remove('hide-island');
            await step(380);
          }
          await step(400);
          toast('Tudo voltou como estava');
          soul?.react('nod');
          await step(3200);
        }
        // repete enquanto estiver à vista (com "reduzir movimento", só quando pedir)
        if (visible && !reduce.matches) play(key);
      } catch {
        /* rodada cancelada */
      }
    }
    $$('.act-tabs button', demo).forEach((b) => b.addEventListener('click', () => play(b.dataset.act)));
    $('#actReplay').addEventListener('click', () => play(key));
    renderRule();
    watch(
      scene,
      (v) => {
        visible = v;
        if (v) play(key);
        else run++; // fora da tela: para a rodada atual
      },
      0.4,
    );
  })();
})();
