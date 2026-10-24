// Liquid Glass da ilha — desfoque de verdade do que está atrás das superfícies flutuantes (ilha, painel,
// hotbar, avisos). A janela é transparente e o Windows não desfoca o que está atrás dela, então a Alma lê a
// imagem da tela (a própria ilha fica fora da captura) e põe essa imagem no fundo de cada superfície, alinhada
// com a tela e desfocada pela placa de vídeo (filtro CSS), com a cor do vidro por cima. Nada é gravado nem enviado.
//   • refração: na borda, uma cópia um pouco reduzida da imagem — a área de fora "dobra" para dentro, como numa lente
//   • texto adaptável: sobre um fundo muito claro (ou muito escuro) a superfície troca a cor do texto
//   • brilho que acompanha o mouse (variáveis --mx/--my, usadas no CSS)
// Custo: a captura roda a 15 quadros em meia resolução e só enquanto há vidro à vista; o resto é da GPU.
window.LiquidGlass = (() => {
  const api = window.alma;
  const root = document.documentElement;
  const FPS = 15; // o fundo é desfocado: 15 quadros bastam
  const IDLE_STOP = 4000; // ilha recolhida por esse tempo → para de ler a tela (volta em ~0,3 s ao acordar)
  const LENS = 0.93; // escala da cópia da borda (menor que 1 = mostra mais área, espremida)

  const surfaces = new Set();
  let cfg = { on: false, op: 0.78, light: false, baseLum: 0 };
  let stream = null;
  let geo = null;
  let starting = null;
  let failed = false;
  let lastActive = Date.now();
  let timer = 0;

  // ---------- superfícies ----------
  // .lg-back (cor base) › vídeo desfocado › borda de lente › .lg-tint (cor do vidro); fica atrás do conteúdo
  function attach(el, { active = () => true, lens = true } = {}) {
    const back = document.createElement('div');
    back.className = 'lg-back';
    back.setAttribute('aria-hidden', 'true');
    back.innerHTML = `<video class="lg-video" muted playsinline></video>${lens ? '<div class="lg-lens"><video class="lg-video" muted playsinline></video></div>' : ''}<div class="lg-tint"></div>`;
    el.prepend(back);
    el.classList.add('lg');
    const s = { el, back, videos: [...back.querySelectorAll('video')], active, key: '', flip: false, lumAt: 0, playing: false };
    if (stream) s.videos.forEach((v) => (v.srcObject = stream));
    surfaces.add(s);
    kick();
    return s;
  }

  // (janela escondida — por exemplo, app em tela cheia — conta como nada à vista: a leitura da tela para)
  const visible = (s) => !document.hidden && s.el.isConnected && s.active() && s.el.checkVisibility({ visibilityProperty: true });

  // ---------- configuração (vem do tema) ----------
  function configure(r) {
    cfg = { on: r.realBlur && !failed, op: r.lg.op, light: r.light, baseLum: r.lg.baseLum, clear: r.material === 'clear' };
    root.classList.toggle('backdrop', cfg.on);
    for (const s of surfaces) {
      s.key = '';
      setFlip(s, false);
    }
    if (!cfg.on) stop();
    kick();
  }

  // ---------- leitura da tela ----------
  function start() {
    if (stream || starting || !cfg.on) return;
    starting = (async () => {
      const g = await api.call('glass:start');
      geo = g;
      const s = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: g.sourceId,
            maxFrameRate: FPS,
            // meia resolução: depois do desfoque não faz diferença, e cada quadro custa um quarto
            maxWidth: Math.round((g.width * g.scale) / 2),
            maxHeight: Math.round((g.height * g.scale) / 2),
          },
        },
      });
      if (!cfg.on) {
        s.getTracks().forEach((t) => t.stop());
        api.call('glass:stop').catch(() => {});
        return;
      }
      stream = s;
      s.getVideoTracks()[0].addEventListener('ended', stop);
      for (const sf of surfaces) {
        sf.videos.forEach((v) => (v.srcObject = s));
        sf.playing = false;
        sf.key = '';
      }
      root.style.setProperty('--lg-screen-w', `${g.width}px`);
      root.style.setProperty('--lg-screen-h', `${g.height}px`);
      kick();
    })()
      .catch((e) => {
        // sem permissão de captura (ou o Windows não deixou): fica o vidro sem desfoque
        console.warn('Liquid Glass: desfoque real indisponível —', e.message);
        failed = true;
        cfg.on = false;
        root.classList.remove('backdrop', 'backdrop-live');
        api.call('glass:stop').catch(() => {});
      })
      .finally(() => (starting = null));
  }

  function stop() {
    if (!stream && !starting) return;
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    root.classList.remove('backdrop-live');
    for (const s of surfaces) {
      s.videos.forEach((v) => (v.srcObject = null));
      s.playing = false;
    }
    api.call('glass:stop').catch(() => {});
  }

  api.on('glass:geometry', (g) => {
    geo = { ...geo, ...g };
    root.style.setProperty('--lg-screen-w', `${geo.width}px`);
    root.style.setProperty('--lg-screen-h', `${geo.height}px`);
    for (const s of surfaces) s.key = '';
  });

  // ---------- alinhamento: a imagem da tela fica parada na tela, não na superfície ----------
  function place(s) {
    const r = s.back.getBoundingClientRect();
    if (r.width < 2) return;
    // posição sem o "zoom" das animações de entrada (o painel cresce de 96% para 100%)
    const sx = r.width / (s.back.offsetWidth || r.width);
    const sy = r.height / (s.back.offsetHeight || r.height);
    const key = `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)},${Math.round(r.height)}`;
    if (key === s.key) return;
    s.key = key;
    const x = geo.x + r.left;
    const y = geo.y + r.top;
    // (origem 0 0) ponto u da tela → (u − x) / escala, dentro da superfície
    const t = `scale(${1 / sx}, ${1 / sy}) translate(${-x}px, ${-y}px)`;
    s.videos[0].style.transform = t;
    if (s.videos[1]) {
      // borda de lente: a mesma imagem reduzida em volta do centro da superfície (u → c + (u − c)·LENS)
      const cx = (x + r.width / 2) * (1 - LENS);
      const cy = (y + r.height / 2) * (1 - LENS);
      s.videos[1].style.transform = `${t} translate(${cx}px, ${cy}px) scale(${LENS})`;
    }
  }

  // texto adaptável: mede a claridade do fundo de vez em quando e troca a cor do texto se ele ficaria ilegível
  const probe = Object.assign(document.createElement('canvas'), { width: 4, height: 4 });
  const pctx = probe.getContext('2d', { willReadFrequently: true });
  const lin = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  function adapt(s) {
    const v = s.videos[0];
    if (!v.videoWidth || !geo) return;
    const now = performance.now();
    if (now - s.lumAt < 700) return;
    s.lumAt = now;
    const r = s.back.getBoundingClientRect();
    const k = v.videoWidth / geo.width;
    try {
      pctx.drawImage(v, Math.max(0, (geo.x + r.left) * k), Math.max(0, (geo.y + r.top) * k), r.width * k, r.height * k, 0, 0, 4, 4);
    } catch {
      return;
    }
    const d = pctx.getImageData(0, 0, 4, 4).data;
    let L = 0;
    for (let i = 0; i < d.length; i += 4) L += 0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2]);
    // claridade final ≈ fundo misturado com a cor do vidro
    L = (L / 16) * (1 - cfg.op) + cfg.baseLum * cfg.op;
    // com folga (histerese) para não ficar trocando
    if (!cfg.light) setFlip(s, s.flip ? L > 0.3 : L > 0.42);
    else setFlip(s, s.flip ? L < 0.22 : L < 0.14);
  }
  function setFlip(s, on) {
    if (s.flip === on) return;
    s.flip = on;
    s.el.classList.toggle('lg-flip', on);
  }

  // ---------- laço ----------
  // Só posiciona (barato); quadro a quadro enquanto algo se mexe, senão a cada 120 ms.
  let raf = 0;
  let still = 0;
  function kick() {
    if (raf || !cfg.on) return;
    clearTimeout(timer);
    timer = 0;
    raf = requestAnimationFrame(loop);
  }
  const later = (ms) => (timer = setTimeout(() => ((timer = 0), kick()), ms));
  function loop() {
    raf = 0;
    if (!cfg.on) return; // sem desfoque real o CSS cuida do vidro sozinho
    let any = false;
    let moved = false;
    for (const s of [...surfaces]) {
      if (!s.el.isConnected) {
        surfaces.delete(s);
        continue;
      }
      const vis = visible(s);
      any ||= vis;
      // vídeo só toca nas superfícies à vista
      if (stream && vis !== s.playing) {
        s.playing = vis;
        s.videos.forEach((v) => (vis ? v.play().catch(() => {}) : v.pause()));
      }
      if (!vis || !geo) continue;
      const before = s.key;
      place(s);
      moved ||= before !== s.key;
      if (stream) adapt(s);
    }
    if (any) lastActive = Date.now();
    if (any && !stream) start();
    if (!any && stream && Date.now() - lastActive > IDLE_STOP) stop();
    if (stream && !root.classList.contains('backdrop-live') && [...surfaces].some((s) => s.playing && s.videos[0].readyState >= 2))
      root.classList.add('backdrop-live'); // o vidro "materializa" (o CSS faz o fade)
    still = moved ? 0 : still + 1;
    if (any && still < 20) raf = requestAnimationFrame(loop);
    else later(any ? 120 : 250);
  }
  // começou uma transição (painel abrindo, ilha mudando de forma): acompanha quadro a quadro na hora
  document.addEventListener('transitionrun', kick, true);

  // brilho que segue o mouse
  document.addEventListener('mousemove', (e) => {
    for (const s of surfaces) {
      if (!visible(s)) continue;
      const r = s.el.getBoundingClientRect();
      s.el.style.setProperty('--mx', `${Math.round(e.clientX - r.left)}px`);
      s.el.style.setProperty('--my', `${Math.round(e.clientY - r.top)}px`);
    }
  });

  return { attach, configure, get running() { return Boolean(stream); } };
})();
