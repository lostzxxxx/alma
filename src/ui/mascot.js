// Alminha — a mascote da Alma. Um SVG pequeno com expressões (rostos), gestos e partículas.
//   rostos   (estado contínuo, trocam com fade): neutral · happy · listen · think · talk · focus · sleepy · surprised · sad
//                                               wink · love · dizzy · excited · yawn
//   gestos   (WAAPI, um de cada vez por parte):  hop · squish · shake · shiver · wave · perk · nod · dance · twirl · peek
//                                               stretch · giggle · dropHop · doubleBlink
//   partículas (fx):                            sparkle · heart · note · snow · sun
//   "vida": loops no CSS (flutuar, piscar, gota) + gestos ociosos aleatórios + inclinar na direção do mouse.
(() => {
  const SVG = `
<svg class="alminha" viewBox="0 0 40 46" data-face="neutral" aria-hidden="true">
  <defs>
    <radialGradient id="amBody" cx="36%" cy="28%" r="78%">
      <stop offset="0" class="am-c-hi" stop-color="#ffffff" />
      <stop offset="0.45" class="am-c-body" stop-color="#F6F4EF" />
      <stop offset="1" class="am-c-shade" stop-color="#d6d0c4" />
    </radialGradient>
    <radialGradient id="amTail" cx="50%" cy="50%" r="50%">
      <stop offset="0" class="am-glowstop" stop-opacity="0.95" />
      <stop offset="1" class="am-glowstop" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="amDrop" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.9" />
      <stop offset="0.55" class="am-glowstop" />
    </linearGradient>
    <clipPath id="amBodyClip"><path d="M20 10C30 10 35.5 16.5 35.5 24C35.5 33 28.5 40 22 42.5Q20 43.4 18 42.5C11.5 40 4.5 33 4.5 24C4.5 16.5 10 10 20 10Z" /></clipPath>
    <filter id="amGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="0.7" result="b" />
      <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
    </filter>
  </defs>
  <g class="am-float">
    <g class="am-react">
      <path class="am-drop" fill="url(#amDrop)" d="M22.6 1.1C24.9 3.3 25.4 6.2 23.4 7.8C21.6 9.2 19 8.1 19.1 5.9C19.2 4.1 21.1 2.8 22.6 1.1Z" />
      <g class="am-pulse">
        <ellipse class="am-arm am-arm-l" cx="5.2" cy="29.5" rx="3" ry="2.4" fill="#ece8df" />
        <ellipse class="am-arm am-arm-r" cx="34.8" cy="29.5" rx="3" ry="2.4" fill="#ece8df" />
        <path fill="url(#amBody)" d="M20 10C30 10 35.5 16.5 35.5 24C35.5 33 28.5 40 22 42.5Q20 43.4 18 42.5C11.5 40 4.5 33 4.5 24C4.5 16.5 10 10 20 10Z" />
        <ellipse class="am-tail" clip-path="url(#amBodyClip)" cx="20" cy="42" rx="6.5" ry="3.6" fill="url(#amTail)" />
        <rect class="am-face" x="8.5" y="15.4" width="23" height="14.6" rx="7" fill="#1E2533" />
        <ellipse class="am-blush am-blush-l" cx="11.6" cy="27.2" rx="1.6" ry="0.9" />
        <ellipse class="am-blush am-blush-r" cx="28.4" cy="27.2" rx="1.6" ry="0.9" />
        <g class="am-look">
          <g class="am-eyes" filter="url(#amGlow)">
            <g class="am-blink">
              <ellipse class="e-dot e-l" cx="15" cy="22.6" rx="2" ry="2.5" />
              <ellipse class="e-dot e-r" cx="25" cy="22.6" rx="2" ry="2.5" />
            </g>
            <path class="e-line e-happy" d="M12.7 23.7Q15 20.7 17.3 23.7M22.7 23.7Q25 20.7 27.3 23.7" />
            <path class="e-line e-happy-r" d="M22.7 23.7Q25 20.7 27.3 23.7" />
            <path class="e-line e-closed" d="M12.7 22.3Q15 24.6 17.3 22.3M22.7 22.3Q25 24.6 27.3 22.3" />
            <path class="e-line e-x" d="M13.6 21.2L16.4 24M16.4 21.2L13.6 24M23.6 21.2L26.4 24M26.4 21.2L23.6 24" />
            <g transform="translate(12.7 20.5) scale(0.46)"><path class="e-fill e-heart" d="M5 8.5C2 6.3 0 4.6 0 2.6 0 1.1 1.1 0 2.5 0 3.6 0 4.5.7 5 1.6 5.5.7 6.4 0 7.5 0 8.9 0 10 1.1 10 2.6 10 4.6 8 6.3 5 8.5Z" /></g>
            <g transform="translate(22.7 20.5) scale(0.46)"><path class="e-fill e-heart" d="M5 8.5C2 6.3 0 4.6 0 2.6 0 1.1 1.1 0 2.5 0 3.6 0 4.5.7 5 1.6 5.5.7 6.4 0 7.5 0 8.9 0 10 1.1 10 2.6 10 4.6 8 6.3 5 8.5Z" /></g>
            <path class="m-line m-smile" d="M18.3 26.3Q20 27.8 21.7 26.3" />
            <path class="m-line m-frown" d="M18.4 27.4Q20 26 21.6 27.4" />
            <path class="m-line m-flat" d="M18.7 26.9H21.3" />
            <circle class="m-fill m-o" cx="20" cy="27" r="0.95" />
            <ellipse class="m-fill m-open" cx="20" cy="26.9" rx="1.6" ry="1.25" />
            <path class="m-fill m-big" d="M17.7 25.9H22.3Q22.3 28.5 20 28.5Q17.7 28.5 17.7 25.9Z" />
            <ellipse class="m-fill m-yawn" cx="20" cy="27.3" rx="1.4" ry="1.9" />
          </g>
        </g>
        <path class="am-z" d="M33 9.2h2.4l-2.4 2.6h2.4M36.4 5.6h1.7l-1.7 1.9h1.7" />
      </g>
    </g>
  </g>
</svg>`;

  // ---------- partículas (desenhadas numa camada fora da ilha, para não serem recortadas) ----------
  const FX = {
    sparkle: '<svg viewBox="0 0 10 10"><path d="M5 0 6.1 3.9 10 5 6.1 6.1 5 10 3.9 6.1 0 5 3.9 3.9Z"/></svg>',
    heart: '<svg viewBox="0 0 10 9"><path d="M5 8.5C2 6.3 0 4.6 0 2.6 0 1.1 1.1 0 2.5 0 3.6 0 4.5.7 5 1.6 5.5.7 6.4 0 7.5 0 8.9 0 10 1.1 10 2.6 10 4.6 8 6.3 5 8.5Z"/></svg>',
    note: '<svg viewBox="0 0 10 12"><path d="M6.2 0h1.5v8.4a2.4 2 0 1 1-1.5-1.8Z"/><path d="M7.7 0c1.4 1.1 2.3 2 2.3 3.9-.7-1-1.4-1.5-2.3-1.7Z"/></svg>',
    snow: '<svg viewBox="0 0 10 10" class="stroke"><path d="M5 .5v9M1.1 2.75l7.8 4.5M1.1 7.25l7.8-4.5"/></svg>',
    sun: '<svg viewBox="0 0 10 10" class="stroke"><circle cx="5" cy="5" r="2" /><path d="M5 0v1.4M5 8.6V10M0 5h1.4M8.6 5H10M1.5 1.5l1 1M7.5 7.5l1 1M1.5 8.5l1-1M7.5 2.5l1-1"/></svg>',
  };

  const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
  const reduce = () => Boolean(window.Motion && window.Motion.reduce.matches);
  const rand = (a, b) => a + Math.random() * (b - a);

  // Gestos: quadros-chave curtos, só transform. Cada um roda numa parte; os que caem em partes que já têm
  // loop no CSS (braços, gota, piscar) usam composite 'add' para somar ao loop sem tranco.
  const swayFrames = (deg, n) => [{ transform: 'none' }, ...Array.from({ length: n }, (_, i) => ({ transform: `rotate(${i % 2 ? -deg : deg}deg) translateY(${i % 2 ? 0 : -1}px)` })), { transform: 'none' }];
  const REACTIONS = {
    hop: {
      part: '.am-react',
      frames: [
        { transform: 'none' },
        { transform: 'translateY(1px) scale(1.07, 0.9)', offset: 0.18 },
        { transform: 'translateY(-4.5px) scale(0.95, 1.06)', offset: 0.45 },
        { transform: 'translateY(0.4px) scale(1.04, 0.96)', offset: 0.75 },
        { transform: 'none' },
      ],
      duration: 560,
      drop: 90, // a gota acompanha um instante depois
    },
    perk: {
      part: '.am-react',
      frames: [{ transform: 'translateY(2px) scale(1.04, 0.94)' }, { transform: 'translateY(-2px) scale(0.97, 1.04)', offset: 0.45 }, { transform: 'none' }],
      duration: 420,
      drop: 60,
    },
    squish: {
      part: '.am-react',
      frames: [{ transform: 'scale(1.1, 0.86)' }, { transform: 'scale(0.97, 1.04)', offset: 0.55 }, { transform: 'none' }],
      duration: 360,
    },
    nod: { part: '.am-react', frames: [{ transform: 'none' }, { transform: 'rotate(7deg)', offset: 0.4 }, { transform: 'none' }], duration: 380 },
    shake: { part: '.am-react', frames: [0, -1.8, 1.6, -1.2, 0.8, -0.4, 0].map((x) => ({ transform: `translateX(${x}px)` })), duration: 460 },
    shiver: { part: '.am-react', frames: [0, 0.7, -0.7, 0.6, -0.6, 0.5, -0.5, 0.3, 0].map((x) => ({ transform: `translateX(${x}px) scale(0.98, 1)` })), duration: 560 },
    giggle: { part: '.am-react', frames: [0, -1, 0, -1, 0, -0.6, 0].map((y) => ({ transform: `translateY(${y}px) scale(${1 + y * -0.02}, ${1 + y * 0.02})` })), duration: 520 },
    dance: { part: '.am-react', frames: swayFrames(9, 6), duration: 1700 },
    twirl: {
      part: '.am-react',
      // comemoração: agacha, salta alto balançando de leve para os lados e aterrissa (sem girar)
      frames: [
        { transform: 'none' },
        { transform: 'translateY(1px) scale(1.08, 0.88)', offset: 0.14 },
        { transform: 'translateY(-6px) scale(0.94, 1.07) rotate(-5deg)', offset: 0.4 },
        { transform: 'translateY(-6.5px) scale(0.95, 1.06) rotate(5deg)', offset: 0.58 },
        { transform: 'translateY(0.6px) scale(1.06, 0.93)', offset: 0.82 },
        { transform: 'none' },
      ],
      duration: 760,
      drop: 120,
    },
    peek: {
      part: '.am-react',
      frames: [
        { transform: 'none' },
        { transform: 'translateY(7px) scale(1, 0.96)', offset: 0.3 },
        { transform: 'translateY(7px) scale(1, 0.96)', offset: 0.6 },
        { transform: 'translateY(-1.5px)', offset: 0.85 },
        { transform: 'none' },
      ],
      duration: 1300,
    },
    stretch: {
      part: '.am-react',
      frames: [{ transform: 'none' }, { transform: 'translateY(-1px) scale(0.95, 1.1)', offset: 0.4 }, { transform: 'translateY(-1px) scale(0.95, 1.1)', offset: 0.65 }, { transform: 'none' }],
      duration: 1100,
      arms: true,
    },
    wave: {
      part: '.am-arm-r',
      frames: [
        { transform: 'none' },
        { transform: 'translate(-0.5px, -3px) rotate(-55deg)', offset: 0.2 },
        { transform: 'translate(-0.5px, -3px) rotate(-25deg)', offset: 0.4 },
        { transform: 'translate(-0.5px, -3px) rotate(-55deg)', offset: 0.6 },
        { transform: 'translate(-0.5px, -3px) rotate(-25deg)', offset: 0.8 },
        { transform: 'none' },
      ],
      duration: 900,
      composite: 'add',
    },
    dropHop: {
      part: '.am-drop',
      frames: [{ transform: 'none' }, { transform: 'translateY(-3px) rotate(-12deg)', offset: 0.35 }, { transform: 'translateY(0.4px)', offset: 0.7 }, { transform: 'none' }],
      duration: 700,
      composite: 'add',
    },
    doubleBlink: {
      part: '.am-blink',
      frames: [{ transform: 'none' }, { transform: 'scaleY(0.1)', offset: 0.15 }, { transform: 'none', offset: 0.35 }, { transform: 'scaleY(0.1)', offset: 0.55 }, { transform: 'none', offset: 0.75 }, { transform: 'none' }],
      duration: 620,
      composite: 'add',
    },
  };

  function mount(host, { fxLayer } = {}) {
    host.innerHTML = SVG;
    const svg = host.querySelector('svg');
    const look = svg.querySelector('.am-look');
    const pulse = svg.querySelector('.am-pulse');
    const mouth = svg.querySelector('.m-open');
    let base = 'neutral';
    let override = null;
    let overrideT = null;
    let lvl = 0;
    let lookLock = 0; // durante "olhar em volta" o ponteiro não manda nos olhos
    const running = {};

    const apply = () => (svg.dataset.face = override || base);

    function emote(face, ms = 1400) {
      override = face;
      apply();
      clearTimeout(overrideT);
      overrideT = setTimeout(() => {
        override = null;
        apply();
      }, ms);
    }

    function animatePart(sel, frames, opts) {
      const el = svg.querySelector(sel);
      if (!el) return null;
      running[sel]?.cancel();
      const a = el.animate(frames, { easing: 'ease-in-out', ...opts });
      running[sel] = a;
      return a;
    }

    function react(name) {
      const r = REACTIONS[name];
      if (!r || reduce()) return;
      animatePart(r.part, r.frames, { duration: r.duration, composite: r.composite || 'replace' });
      // a gota é "solta": segue o corpo com um pequeno atraso (movimento secundário)
      if (r.drop) animatePart('.am-drop', [{ transform: 'none' }, { transform: 'translateY(1.5px)', offset: 0.3 }, { transform: 'translateY(-2.5px)', offset: 0.6 }, { transform: 'none' }], { duration: r.duration, delay: r.drop, composite: 'add' });
      if (r.arms) {
        const up = (dir) => [{ transform: 'none' }, { transform: `translateY(-3px) rotate(${dir * 50}deg)`, offset: 0.4 }, { transform: `translateY(-3px) rotate(${dir * 50}deg)`, offset: 0.65 }, { transform: 'none' }];
        animatePart('.am-arm-l', up(1), { duration: r.duration, composite: 'add' });
        animatePart('.am-arm-r', up(-1), { duration: r.duration, composite: 'add' });
      }
    }

    // Partículas saindo da Alminha. Para cima é a borda da tela, então elas abrem para os lados e descem.
    function fx(kind, n = 4, { color, spread = 1 } = {}) {
      if (!fxLayer || reduce() || !FX[kind]) return;
      const b = svg.getBoundingClientRect();
      const cx = b.left + b.width / 2;
      const cy = b.top + b.height * 0.45;
      for (let i = 0; i < n; i++) {
        const el = document.createElement('span');
        el.className = `am-fx am-fx-${kind}`;
        el.innerHTML = FX[kind];
        if (color) el.style.setProperty('--fx', color);
        const size = kind === 'note' ? rand(9, 12) : rand(7, 10.5);
        el.style.cssText += `left:${cx - size / 2}px;top:${cy - size / 2}px;width:${size}px;height:${size}px`;
        fxLayer.append(el);
        const side = i % 2 ? 1 : -1;
        const dx =
          kind === 'note' ? rand(10, 26) * (Math.random() < 0.75 ? 1 : -1) : kind === 'snow' ? rand(-16, 16) : side * rand(10, 22) * spread;
        const dy = kind === 'snow' ? rand(22, 36) : kind === 'note' ? rand(6, 16) : rand(-6, 18);
        const rot = kind === 'note' ? rand(-20, 20) : rand(-90, 90);
        const a = el.animate(
          [
            { transform: 'translate(0,0) scale(0.3)', opacity: 0 },
            { transform: `translate(${dx * 0.35}px,${dy * 0.25}px) scale(1)`, opacity: 1, offset: 0.25 },
            { transform: `translate(${dx}px,${dy}px) scale(0.7) rotate(${rot}deg)`, opacity: 0 },
          ],
          { duration: rand(900, 1400), delay: i * rand(40, 90), easing: EASE_OUT, fill: 'backwards' },
        );
        a.finished.then(() => el.remove(), () => el.remove());
      }
    }

    // Olhar em volta: esquerda, direita, de volta (gesto ocioso)
    function lookAround() {
      if (reduce()) return;
      lookLock = Date.now() + 1900;
      const steps = [
        [0, 'translate(-1.9px, -0.3px)'],
        [650, 'translate(1.9px, -0.3px)'],
        [1350, ''],
      ];
      for (const [t, v] of steps) setTimeout(() => (look.style.transform = v), t);
    }

    // ---------- gestos ociosos: de vez em quando, sem ninguém pedir ----------
    const IDLE = [
      [5, () => react('doubleBlink')],
      [4, lookAround],
      [4, () => react('dropHop')],
      [3, () => (emote('wink', 900), react('nod'))],
      [3, () => (emote('happy', 1300), react('stretch'))],
      [2, () => (emote('wink', 1600), fx('note', 2))], // assobia
      [2, () => react('peek')],
      [1, () => (emote('excited', 900), react('twirl'), fx('sparkle', 3))],
    ];
    let idleTimer = null;
    function startIdle(canAct) {
      clearTimeout(idleTimer);
      const next = () => {
        idleTimer = setTimeout(() => {
          if (canAct() && !override && !reduce()) {
            const total = IDLE.reduce((s, [w]) => s + w, 0);
            let r = Math.random() * total;
            const act = IDLE.find(([w]) => (r -= w) < 0) || IDLE[0];
            act[1]();
          }
          next();
        }, rand(10000, 24000));
      };
      next();
    }

    // ---------- cutucar: cócegas; muitas vezes seguidas → tontinha ----------
    let pokes = [];
    function poke() {
      const now = Date.now();
      pokes = [...pokes.filter((t) => now - t < 1400), now];
      if (pokes.length >= 4) {
        pokes = [];
        emote('dizzy', 1900);
        react('twirl');
        setTimeout(() => react('shake'), 760);
        fx('sparkle', 5);
        return;
      }
      react('squish');
      setTimeout(() => react('giggle'), 200);
      emote(pokes.length >= 2 ? 'excited' : 'happy', 1100);
      if (pokes.length >= 2) fx('sparkle', 2);
    }

    return {
      el: svg,
      setBase(face) {
        if (face === base) return;
        base = face;
        apply();
      },
      emote,
      react,
      fx,
      poke,
      lookAround,
      startIdle,
      // sequências prontas para eventos do app
      celebrate() {
        emote('love', 2200);
        react('hop');
        setTimeout(() => react('twirl'), 600);
        fx('heart', 5);
        setTimeout(() => fx('sparkle', 4), 300);
      },
      dance() {
        emote('excited', 1800);
        react('dance');
        fx('note', 4);
      },
      yawn() {
        emote('yawn', 1500);
        react('stretch');
      },
      // olhos e boca acompanham o ponteiro (coordenadas da janela)
      look(x, y) {
        if (Date.now() < lookLock) return;
        if (x == null) {
          look.style.transform = '';
          return;
        }
        const b = svg.getBoundingClientRect();
        const dx = Math.max(-1, Math.min(1, (x - (b.left + b.width / 2)) / 140));
        const dy = Math.max(-1, Math.min(1, (y - (b.top + b.height * 0.5)) / 70));
        look.style.transform = `translate(${(dx * 1.8).toFixed(2)}px, ${(dy * 1.1).toFixed(2)}px)`;
      },
      // o corpo se inclina de leve na direção do ponteiro (a gota fica, e balança atrás)
      lean(x) {
        if (reduce() || x == null) {
          pulse.style.rotate = '';
          return;
        }
        const b = svg.getBoundingClientRect();
        const dx = Math.max(-1, Math.min(1, (x - (b.left + b.width / 2)) / 220));
        pulse.style.rotate = `${(dx * 7).toFixed(1)}deg`;
      },
      // nível de voz por quadro (mantido para o caso de a voz voltar)
      level(v, kind) {
        const target = reduce() ? 0 : Math.min(1, v || 0);
        lvl += (target - lvl) * 0.3;
        if (kind === 'listen' && lvl > 0.01) pulse.style.transform = `scale(${(1 - lvl * 0.03).toFixed(3)}, ${(1 + lvl * 0.07).toFixed(3)})`;
        else pulse.style.transform = '';
        mouth.style.transform = kind === 'talk' ? `scale(${(1 + lvl * 0.25).toFixed(3)}, ${(0.35 + lvl * 1.5).toFixed(3)})` : '';
        return lvl;
      },
    };
  }

  window.Mascot = { mount };
})();
