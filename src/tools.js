// Ações que as rotinas agendadas executam (e o "adicionar tarefa" do painel).
const crypto = require('crypto');
const system = require('./system');

function createTools(ctx) {
  const { store, ac, notify, ui } = ctx;

  const exec = {
    open_app: ({ name }) => system.openApp(name),
    open_website: ({ url }) => system.openUrl(url),
    web_search: ({ query, site }) => system.webSearch(query, site),
    play_youtube: ({ query }) => system.playYoutube(query),
    media_control: ({ action, times }) => system.media(action, times),
    set_volume: ({ percent }) => system.setVolume(percent),

    todo_add: ({ text, time }) => {
      const item = { id: crypto.randomUUID().slice(0, 6), text, time: time || '', done: false, created: Date.now() };
      store.update('todos', (l) => [...l, item]);
      return { ok: true, item };
    },

    ac_control: async (args) => {
      const s = await ac.set(args.device, args);
      ui('ac-updated', s);
      const { raw, ...rest } = s;
      return { ok: true, state: rest };
    },
    notify: ({ text }) => {
      notify(text);
      return { ok: true };
    },
  };

  async function run(name, args = {}) {
    const fn = exec[name];
    if (!fn) throw new Error('Ação desconhecida: ' + name);
    return fn(args || {});
  }

  return { run };
}

module.exports = { createTools };
