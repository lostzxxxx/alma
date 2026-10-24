// Pequenos utilitários de animação (WAAPI: rápido, interrompível, sem biblioteca).
(() => {
  // Movimento reduzido: segue o Windows ("Efeitos de animação") ou a escolha feita nas configurações.
  // O CSS usa a classe `reduce` no <html> em vez da media query, para a escolha da Alma valer.
  const systemReduce = matchMedia('(prefers-reduced-motion: reduce)');
  let preference = 'full';
  const reduce = {
    get matches() {
      return preference === 'reduced' || (preference === 'system' && systemReduce.matches);
    },
  };
  function setPreference(p) {
    preference = p === 'system' || p === 'reduced' ? p : 'full';
    document.documentElement.classList.toggle('reduce', reduce.matches);
  }
  systemReduce.addEventListener('change', () => setPreference(preference));
  setPreference('full');
  const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
  // a mesma mola do CSS (--ease-morph), para o que desliza na tela
  const morph = () => {
    const s = getComputedStyle(document.documentElement);
    return { easing: s.getPropertyValue('--ease-morph').trim() || 'ease-out', duration: parseFloat(s.getPropertyValue('--dur-morph')) || 600 };
  };

  // Entrada escalonada de um grupo (listas, cards). Só para aparições ocasionais.
  function stagger(els, { step = 35, max = 8, duration = 220, y = 6 } = {}) {
    [...els].slice(0, max).forEach((el, i) => {
      el.animate(
        reduce.matches
          ? [{ opacity: 0 }, { opacity: 1 }]
          : [
              { opacity: 0, transform: `translateY(${y}px)` },
              { opacity: 1, transform: 'none' },
            ],
        { duration, delay: i * step, easing: EASE_OUT, fill: 'backwards' },
      );
    });
  }

  // Sai do jeito que entrou e só depois remove/executa.
  function leave(el, { x = 0, y = -4, duration = 160 } = {}) {
    const a = el.animate(
      reduce.matches
        ? [{ opacity: 1 }, { opacity: 0 }]
        : [
            { opacity: 1, transform: 'none' },
            { opacity: 0, transform: `translate(${x}px, ${y}px) scale(0.98)` },
          ],
      { duration, easing: EASE_OUT, fill: 'forwards' },
    );
    return a.finished.catch(() => {});
  }

  // Remove o elemento e faz os irmãos deslizarem para o espaço vago (FLIP) em vez de pularem.
  function collapse(el) {
    const parent = el?.parentElement;
    if (!parent) return;
    const sibs = [...parent.children].filter((s) => s !== el);
    const before = sibs.map((s) => s.getBoundingClientRect().top);
    el.remove();
    if (reduce.matches) return;
    const timing = morph();
    sibs.forEach((s, i) => {
      const dy = before[i] - s.getBoundingClientRect().top;
      if (Math.abs(dy) < 0.5) return;
      s.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], timing);
    });
  }

  // Troca de número "rolando" na direção da mudança (ex.: temperatura).
  function roll(el, dir) {
    if (reduce.matches || !dir) return;
    el.animate(
      [
        { opacity: 0, transform: `translateY(${dir > 0 ? 28 : -28}%)` },
        { opacity: 1, transform: 'none' },
      ],
      { duration: 180, easing: EASE_OUT },
    );
  }

  function pop(el) {
    if (reduce.matches) return;
    el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 220, easing: EASE_OUT });
  }

  // Esconde com animação de saída e depois aplica display:none (entrada usa @starting-style no CSS).
  function hide(el, cls = 'show') {
    if (!el.classList.contains(cls)) return;
    el.classList.add('leaving');
    clearTimeout(el._hideT);
    el._hideT = setTimeout(() => {
      el.classList.remove(cls, 'leaving');
    }, 170);
  }
  function show(el, cls = 'show') {
    clearTimeout(el._hideT);
    el.classList.remove('leaving');
    el.classList.add(cls);
  }

  window.Motion = { stagger, leave, collapse, roll, pop, hide, show, reduce, setPreference };
})();
