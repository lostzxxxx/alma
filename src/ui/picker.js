// Conta-gotas: a foto da tela por baixo, a lupa segue o mouse; clique (ou Enter) escolhe, Esc cancela.
(async () => {
  const api = window.alma;
  const shot = document.getElementById('shot');
  const zoom = document.getElementById('zoom').getContext('2d', { willReadFrequently: true });
  const loupe = document.getElementById('loupe');
  const tag = document.getElementById('tag');
  const sw = document.getElementById('sw');
  const hexEl = document.getElementById('hex');
  const N = 15; // pixels mostrados na lupa
  const img = await api.call('picker:image');
  if (!img) return api.call('picker:done', null);
  shot.src = img.src;
  await shot.decode();
  // a foto em tamanho real, para ler o pixel exato
  const full = Object.assign(document.createElement('canvas'), { width: shot.naturalWidth, height: shot.naturalHeight });
  const fctx = full.getContext('2d', { willReadFrequently: true });
  fctx.drawImage(shot, 0, 0);
  const k = shot.naturalWidth / innerWidth; // pixels reais por px da janela
  let x = img.x; // começa onde o mouse já estava
  let y = img.y;
  let color = null;
  const hex = (r, g, b) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();

  function draw() {
    const px = Math.min(full.width - 1, Math.max(0, Math.round(x * k)));
    const py = Math.min(full.height - 1, Math.max(0, Math.round(y * k)));
    const [r, g, b] = fctx.getImageData(px, py, 1, 1).data;
    color = { hex: hex(r, g, b), r, g, b };
    zoom.imageSmoothingEnabled = false;
    zoom.clearRect(0, 0, 150, 150);
    zoom.drawImage(full, px - (N >> 1), py - (N >> 1), N, N, 0, 0, 150, 150);
    // a lupa fica do lado oposto à borda mais próxima, para não sair da tela
    const lx = x + 24 + 150 > innerWidth ? x - 24 - 150 : x + 24;
    const ly = y + 24 + 150 > innerHeight ? y - 24 - 150 : y + 24;
    loupe.style.transform = `translate(${lx}px, ${ly}px)`;
    tag.style.transform = `translate(${lx + 18}px, ${ly + 160}px)`;
    sw.style.background = color.hex;
    hexEl.textContent = color.hex;
  }
  const pick = () => api.call('picker:done', color);
  const cancel = () => api.call('picker:done', null);
  addEventListener('mousemove', (e) => {
    x = e.clientX;
    y = e.clientY;
    requestAnimationFrame(draw);
  });
  addEventListener('mousedown', (e) => (e.button === 0 ? pick() : cancel()));
  addEventListener('contextmenu', (e) => e.preventDefault());
  addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 10 : 1;
    if (e.key === 'Escape') return cancel();
    if (e.key === 'Enter' || e.key === ' ') return pick();
    if (e.key === 'ArrowLeft') x -= step / k;
    else if (e.key === 'ArrowRight') x += step / k;
    else if (e.key === 'ArrowUp') y -= step / k;
    else if (e.key === 'ArrowDown') y += step / k;
    else return;
    e.preventDefault();
    draw();
  });
  setTimeout(() => (document.getElementById('hint').style.opacity = '0.0'), 3500);
  draw();
})();
