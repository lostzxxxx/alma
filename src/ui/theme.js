// Tema da Alma: a partir da cor escolhida (base), do material (sólido / Liquid Glass / vidro claro), do destaque
// e dos ajustes de forma, gera todas as variáveis usadas pela ilha, hotbar e configurações.
// Cores claras viram tema claro sozinhas. "Reduzir transparência" e "Aumentar contraste" do Windows são respeitados.
(() => {
  // cores do app (base das superfícies)
  const PRESETS = [
    ['Grafite', '#18181b'],
    ['Meia-noite', '#0f1626'],
    ['Oceano', '#0b2433'],
    ['Floresta', '#10241b'],
    ['Ameixa', '#1d1330'],
    ['Vinho', '#2a1018'],
    ['Café', '#251b14'],
    ['Névoa', '#e9eaee'],
    ['Areia', '#f1ebe0'],
    ['Nuvem', '#fafafa'],
  ];
  // destaques: null = neutro (branco no escuro, grafite no claro); número = matiz
  const ACCENTS = [
    ['Neutro', null],
    ['Azul', 212],
    ['Ciano', 190],
    ['Verde', 150],
    ['Amarelo', 45],
    ['Laranja', 24],
    ['Rosa', 335],
    ['Roxo', 268],
  ];
  // corpo da Alminha: [nome, luz, corpo, sombra, braços, visor]
  const BODIES = {
    cream: ['Creme', '#ffffff', '#F6F4EF', '#d6d0c4', '#ece8df', '#1E2533'],
    snow: ['Neve', '#ffffff', '#eef3fa', '#c3cedd', '#e2e9f3', '#1b2230'],
    sky: ['Céu', '#f7fcff', '#d6ecfb', '#9cc4e2', '#c8e2f5', '#17222f'],
    mint: ['Menta', '#f7fffb', '#d5f3e4', '#9fd2b9', '#c9ecda', '#19272a'],
    lavender: ['Lavanda', '#fbf9ff', '#e4dcff', '#b3a5e6', '#d8cff8', '#1f1d33'],
    rose: ['Rosa', '#fff6f8', '#ffdbe5', '#e7a9bb', '#f7cfda', '#2a1d2a'],
    peach: ['Pêssego', '#fffaf5', '#ffe1cc', '#eab08d', '#f7d4bc', '#2b1f1c'],
    graphite: ['Grafite', '#8a8f99', '#4a4e57', '#2a2c32', '#3d4048', '#0c0e12'],
  };
  const RADIUS = { soft: 0.55, normal: 1, round: 1.4 };
  const TEXT = { small: 0.92, normal: 1, large: 1.12, xl: 1.24 };
  const DOCK = { s: [36, 22], m: [42, 26], l: [50, 32] };
  const DEFAULT = {
    style: 'solid', // 'solid' | 'glass' (Liquid Glass) | 'clear' (vidro claro)
    base: '#18181b',
    accent: 'neutral',
    opacity: 0.78, // quanto o vidro cobre o que está atrás
    blur: 24, // desfoque do vidro (px)
    realBlur: true, // desfoca o que está atrás da ilha de verdade (lê a tela)
    lens: true, // refração e brilho nas bordas
    radius: 'normal',
    text: 'normal',
    contrast: false,
    solid: false, // reduzir transparência
    body: 'cream',
    dock: 'm',
    clock: 'time', // 'time' | 'date' | 'none'
    acMini: true,
  };

  const mq = (q) => typeof matchMedia === 'function' && matchMedia(q).matches;
  const hexToRgb = (h) => {
    let s = String(h || '').replace('#', '');
    if (s.length === 3) s = [...s].map((c) => c + c).join('');
    const n = parseInt(s || '18181b', 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const lum = ([r, g, b]) => {
    const f = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const rgb = (c, a = 1) => `rgb(${c[0]} ${c[1]} ${c[2]} / ${+a.toFixed(3)})`;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function resolve(settings = {}) {
    const t = { ...DEFAULT, ...(settings.theme || {}) };
    const base = hexToRgb(t.base);
    const light = lum(base) > 0.36;
    const reduceT = t.solid || mq('(prefers-reduced-transparency: reduce)');
    const contrast = t.contrast || mq('(prefers-contrast: more)');
    const material = t.style === 'solid' || reduceT ? 'solid' : t.style === 'clear' ? 'clear' : 'glass';
    const glass = material !== 'solid';
    // regular: 35–95% de cobertura; claro: bem mais transparente (só a cor do fundo + desfoque leve)
    const opReg = clamp(Number(t.opacity) || DEFAULT.opacity, 0.35, 0.95);
    const op = material === 'clear' ? clamp(opReg - 0.5, 0.1, 0.42) : material === 'glass' ? opReg : 1;
    const opFlat = glass ? Math.max(op, 0.86) : 1; // sem desfoque real, o vidro fica mais firme para o texto continuar legível
    const blur = material === 'clear' ? clamp(Number(t.blur) * 0.4, 2, 14) : clamp(Number(t.blur) || 0, 0, 48);
    const ink = light ? [0, 0, 0] : [255, 255, 255];
    const k = contrast ? 1.7 : 1; // mais contraste: linhas e preenchimentos mais fortes
    const inkA = (a) => `rgb(${ink.join(' ')} / ${+Math.min(1, a * k).toFixed(3)})`;
    const raised = mix(base, ink, light ? 0.04 : 0.1); // superfície um pouco "acima"
    const deep = mix(base, light ? [255, 255, 255] : [0, 0, 0], light ? 0.5 : 0.3);
    const hue = settings.hue ?? 196;
    const neutral = t.accent === 'neutral' || t.accent == null;
    const soul = neutral ? (light ? '#2c2d33' : '#e4e4e8') : light ? `hsl(${hue} 72% 40%)` : `hsl(${hue} 92% 70%)`;
    const soulSoft = neutral ? inkA(light ? 0.08 : 0.1) : `hsl(${hue} 90% ${light ? 45 : 65}% / ${light ? 0.14 : 0.2})`;
    const onSoul = neutral ? (light ? '#ffffff' : '#1c1c1f') : light ? '#ffffff' : '#0b1015';
    const r = RADIUS[t.radius] || 1;
    const [dk, dkImg] = DOCK[t.dock] || DOCK.m;
    const body = BODIES[t.body] || BODIES.cream;
    // vidro: a cor base cobrindo o fundo, um pouco mais clara em cima (luz vindo de cima)
    const lgFill = (a) => `linear-gradient(180deg, ${rgb(mix(base, ink, light ? 0.02 : 0.07), a)}, ${rgb(base, Math.min(1, a + 0.04))})`;
    return {
      t,
      light,
      glass,
      material,
      contrast,
      reduceT,
      realBlur: glass && t.realBlur !== false,
      blur,
      lens: glass && t.lens !== false && !contrast,
      // para o vidro real (liquid.js) estimar a claridade final e trocar a cor do texto se precisar
      lg: { op, baseLum: lum(base) },
      vars: {
        '--ink': ink.join(' '),
        '--bg': rgb(base, glass ? Math.min(1, opFlat + 0.06) : 1),
        '--bg2': inkA(0.05),
        '--bg3': inkA(0.085),
        '--fill-1': inkA(0.05),
        '--fill-2': inkA(0.085),
        '--fill-3': inkA(0.13),
        '--line': inkA(light ? 0.11 : 0.1),
        '--edge': inkA(light ? 0.14 : 0.16),
        '--text': light ? '#111216' : '#f5f5f7',
        '--dim': contrast ? (light ? '#2e3036' : '#dcdce0') : light ? '#4f525a' : '#b6b6bc',
        '--faint': contrast ? (light ? '#44464d' : '#c4c4ca') : light ? '#6c6f78' : '#8f8f96',
        '--soul': soul,
        '--soul-soft': soulSoft,
        '--on-soul': onSoul,
        '--switch-on': neutral ? (light ? '#34c759' : '#30d158') : soul, // interruptor ligado: verde do sistema no neutro
        '--field': light ? 'rgb(255 255 255 / .72)' : 'rgb(0 0 0 / .28)',
        '--menu': rgb(raised),
        // Liquid Glass: preenchimento com desfoque real (--lg-fill) e sem (--lg-fill-flat)
        '--lg-fill': lgFill(op),
        '--lg-fill-flat': lgFill(opFlat),
        '--glass': lgFill(opFlat),
        '--lg-blur': `${blur}px`,
        '--lg-sat': material === 'clear' ? 1.25 : 1.5,
        '--lg-base': rgb(base),
        '--rim-hi': light ? 'rgb(255 255 255 / .95)' : `rgb(255 255 255 / ${material === 'clear' ? 0.5 : 0.34})`,
        '--rim-lo': light ? 'rgb(255 255 255 / .35)' : 'rgb(255 255 255 / .07)',
        '--rim-line': contrast ? inkA(0.3) : light ? 'rgb(0 0 0 / .1)' : 'rgb(0 0 0 / .35)',
        '--sheen': light ? 'rgb(255 255 255 / .55)' : `rgb(255 255 255 / ${material === 'solid' ? 0.04 : 0.09})`,
        '--shadow': light
          ? '0 16px 44px rgb(30 34 52 / .16), 0 2px 8px rgb(30 34 52 / .08)'
          : '0 18px 50px rgb(0 0 0 / .42), 0 2px 8px rgb(0 0 0 / .24)',
        // a ilha (um pouco mais firme que o painel, para o relógio ficar legível sobre qualquer fundo)
        '--pill': glass
          ? lgFill(Math.min(1, op + 0.08))
          : `linear-gradient(180deg, ${rgb(mix(base, ink, light ? 0.05 : 0.1))}, ${rgb(mix(base, deep, 0.35))})`,
        '--pill-flat': glass ? lgFill(Math.min(1, opFlat + 0.06)) : 'var(--pill)',
        '--pill-hover': rgb(mix(base, ink, light ? 0.1 : 0.16), glass ? Math.min(1, opFlat + 0.1) : 1),
        '--pill-dormant': rgb(mix(base, ink, light ? 0.14 : 0.12), 1),
        // janela de configurações: barra lateral é a camada de vidro; o conteúdo fica num material mais grosso
        '--app-bg': glass ? 'transparent' : rgb(deep),
        '--rail': glass ? rgb(base, clamp(opReg - 0.25, 0.42, 0.8)) : rgb(mix(deep, base, 0.5)),
        '--content-bg': glass ? rgb(deep, clamp(opReg + 0.08, 0.8, 0.97)) : rgb(deep),
        '--card': light ? rgb([255, 255, 255], glass ? 0.62 : 1) : rgb(mix(base, ink, 0.07), glass ? 0.7 : 1),
        // forma e tamanhos
        '--r': r,
        '--r-xl': `${Math.round(28 * r)}px`,
        '--r-lg': `${Math.round(20 * r)}px`,
        '--r-md': `${Math.round(14 * r)}px`,
        '--r-sm': `${Math.round(10 * r)}px`,
        '--zoom': TEXT[t.text] || 1,
        '--dk': `${dk}px`,
        '--dk-img': `${dkImg}px`,
        // Alminha
        '--am-hi': body[1],
        '--am-body': body[2],
        '--am-shade': body[3],
        '--am-arm': body[4],
        '--am-visor': body[5],
      },
    };
  }

  function apply(settings, root = document.documentElement) {
    const r = resolve(settings);
    for (const [k, v] of Object.entries(r.vars)) root.style.setProperty(k, v);
    root.dataset.style = r.material === 'solid' ? 'solid' : 'glass';
    root.dataset.material = r.material;
    root.dataset.tone = r.light ? 'light' : 'dark';
    root.dataset.lens = r.lens ? 'on' : 'off';
    root.dataset.realblur = r.realBlur ? 'on' : 'off';
    root.dataset.accent = r.t.accent === 'neutral' || r.t.accent == null ? 'neutral' : 'hue';
    root.classList.toggle('contrast', r.contrast);
    root.style.colorScheme = r.light ? 'light' : 'dark';
    return r;
  }

  window.Theme = { apply, resolve, PRESETS, ACCENTS, BODIES, DEFAULT };
})();
