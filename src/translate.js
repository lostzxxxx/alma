// Tradução rápida, gratuita e sem chave: primeiro o endpoint público do Google Tradutor (rápido), e se ele
// falhar, o MyMemory. Os dois detectam o idioma sozinhos.
// Se o texto já está no idioma de destino, traduz para o idioma alternativo (ex.: português → inglês).
const LANGS = {
  'pt-BR': 'Português',
  en: 'Inglês',
  es: 'Espanhol',
  fr: 'Francês',
  de: 'Alemão',
  it: 'Italiano',
  ja: 'Japonês',
  ko: 'Coreano',
  'zh-CN': 'Chinês',
  ru: 'Russo',
};
const base = (l) => String(l || '').toLowerCase().split('-')[0];

// o Google usa "pt" para o português do Brasil
const gcode = (l) => (l === 'Autodetect' ? 'auto' : l === 'pt-BR' ? 'pt' : l);
async function google(text, from, to) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(gcode(from))}&tl=${encodeURIComponent(gcode(to))}&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error('Google Tradutor: ' + res.status);
  const j = await res.json();
  const out = (j[0] || []).map((s) => s[0] || '').join('');
  if (!out) throw new Error('Google Tradutor: resposta vazia');
  return { text: out, detected: j[2] || from };
}

async function call(text, from, to) {
  try {
    return await google(text, from, to);
  } catch {
    return await myMemory(text, from, to);
  }
}

async function myMemory(text, from, to) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(from)}|${encodeURIComponent(to)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error('O serviço de tradução não respondeu agora.');
  const j = await res.json();
  if (Number(j.responseStatus) !== 200) {
    if (/QUOTA|LIMIT/i.test(j.responseDetails || '')) throw new Error('O limite diário da tradução grátis acabou. Tente amanhã.');
    throw new Error(j.responseDetails || 'Não deu para traduzir esse texto.');
  }
  return { text: j.responseData.translatedText, detected: j.responseData.detectedLanguage || from };
}

// opts: { target, alt, from }
async function translate(text, opts = {}) {
  const clean = String(text || '').trim();
  if (!clean) throw new Error('Nada para traduzir.');
  if (clean.length > 500) throw new Error('Texto longo demais: a tradução rápida aceita até 500 caracteres por vez.');
  const target = opts.target || 'pt-BR';
  const alt = opts.alt || 'en';
  const from = opts.from && opts.from !== 'auto' ? opts.from : 'Autodetect';
  let r = await call(clean, from, target);
  let to = target;
  // já estava no idioma de destino: vai para o alternativo
  if (base(r.detected) === base(target) && base(alt) !== base(target)) {
    r = await call(clean, r.detected, alt);
    to = alt;
  }
  return { source: clean, text: r.text, from: r.detected, to };
}

module.exports = { translate, LANGS };
