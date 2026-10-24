<div align="center">

<img src="assets/icon.png" width="112" alt="Ícone da Alma" />

# Alma

**A ilha no topo do seu Windows, com a Alminha.**

Foco, tradução, conta-gotas, ar-condicionado, música, arquivos e seus apps a um passar de mouse.

[![Baixar para Windows](https://img.shields.io/github/v/release/lostzxxxx/alma?label=baixar&style=for-the-badge&color=2f8cff)](https://github.com/lostzxxxx/alma/releases/latest)
[![Site](https://img.shields.io/badge/site-lostzxxxx.github.io%2Falma-7c3aed?style=for-the-badge)](https://lostzxxxx.github.io/alma/)
![Windows 10 e 11](https://img.shields.io/badge/Windows-10%20%7C%2011-0078d4?style=for-the-badge)

</div>

---

## O que é

A Alma é uma **ilha** colada no topo da tela do Windows, inspirada nas ilhas dos celulares. Parada, ela vira uma linha fina na borda (ou some de vez). Quando você para o mouse em cima, ela desce com a **Alminha**, a mascote que acena, cochila, treme de frio quando o ar gela e comemora quando você termina uma tarefa. Um clique abre um painel de vidro com tudo que você usa no dia a dia.

## Recursos

| | |
|---|---|
| ⏱️ **Foco** | Pomodoro, temporizador e cronômetro. O tempo aparece na ilha, a Alminha dorme e a Alma fica em silêncio enquanto você foca. |
| 🌐 **Tradução rápida** | Selecione um texto em qualquer app e arraste até a ilha. Ela descobre o idioma e traduz, sem abrir o navegador. |
| 🎨 **Conta-gotas** | Pegue a cor de qualquer ponto da tela com uma lupa e copie em HEX, RGB ou HSL. |
| ⚡ **Alma Actions** | Automações sem programar: *quando abrir um jogo → volume em 35%, modo silencioso, esconder a ilha*. E desfaz tudo quando acabar. |
| 🧩 **Módulos** | Escolha quais painéis aparecem, em que ordem, e esconda o que não usa. |
| ❄️ **Ar-condicionado** | Liga, desliga, temperatura, modo e turbo. Elgin/Philco/TCL (Smart Life), LG ThinQ, Samsung SmartThings e Home Assistant. |
| 🎵 **Tocando agora** | Capa, música e controles de qualquer player do Windows (Spotify, YouTube, …). |
| 📥 **Bandeja de arquivos** | Arraste arquivos até a ilha e use depois: arrastar para fora, copiar ou mover. Saem sozinhos em 12 horas. |
| 🚀 **Hotbar** | Seus apps fixados e as janelas abertas descem da ilha. A barra de tarefas pode até sumir. |
| 💧 **Liquid Glass** | Vidro com desfoque de verdade, borda que dobra a luz, temas, cores e cantos do seu jeito. |
| ♿ **Acessibilidade** | Posição no topo, monitor, jeito de aparecer, atalho de teclado, texto maior, contraste e menos movimento. |

## Instalar

1. Baixe o **`Alma-Setup-<versão>.exe`** na [página de versões](https://github.com/lostzxxxx/alma/releases/latest) ou no [site](https://lostzxxxx.github.io/alma/).
2. Abra o instalador. Ele instala só para você, sem pedir administrador.
3. Na primeira vez o Windows pode mostrar **"O Windows protegeu o computador"**, porque o instalador ainda não tem assinatura digital: clique em **Mais informações › Executar assim mesmo**.

A Alma procura versões novas sozinha e avisa na ilha. Nada é instalado sem você pedir (*Configurações › Geral › Atualizações*).

## Privacidade

- **Sem conta e sem login.** Tarefas, bandeja, cores e aparência ficam no seu PC (`%APPDATA%\Alma\data.json`).
- As chaves do ar-condicionado são cifradas pelo Windows (DPAPI).
- O vidro e o conta-gotas leem a imagem da tela na hora e descartam; nada é gravado nem enviado.
- A única coisa que sai do computador é o texto que você pede para traduzir, enviado ao serviço de tradução (Google Tradutor, ou MyMemory se ele falhar).

## Para desenvolvedores

Feita com [Electron](https://www.electronjs.org/), JavaScript puro e um ajudante em PowerShell para conversar com o Windows (janelas, mídia, volume, tela cheia).

```bash
npm install
npm start          # roda a partir do código
npm run dist       # gera instalador\Alma-Setup-<versão>.exe e latest.yml
```

```
src/
  main.js          janelas, IPC e o ciclo de vida do app
  focus.js         temporizador e pomodoro
  actions.js       Alma Actions (quando… fazer…)
  translate.js     tradução rápida
  colorpick.js     conta-gotas (lupa por cima da tela)
  filetray.js      bandeja de arquivos
  dock.js          hotbar
  updater.js       aviso de versão nova (electron-updater)
  ac/              drivers do ar-condicionado
  win/             ajudante do Windows (windows.ps1)
  ui/              ilha, Alminha, painéis e configurações
site/              o site (publicado no GitHub Pages pelo .github/workflows/site.yml)
```

Para ver o site localmente: `node scripts/serve.js site 4321` e abra http://127.0.0.1:4321.

### Lançar uma versão

1. Aumente `version` no `package.json` e rode `npm run dist`.
2. Crie a release com o instalador, o `.blockmap` e o `latest.yml` (é o que o atualizador da Alma lê):
   ```bash
   gh release create v<versão> instalador/Alma-Setup-<versão>.exe instalador/Alma-Setup-<versão>.exe.blockmap instalador/latest.yml
   ```
3. Atualize `site/releases.json` (versão, tamanho e novidades) e envie para a `main`: o site se publica sozinho.

Mais detalhes (configuração do ar, onde ficam os dados, atalhos) no [LEIA-ME](LEIA-ME.md).

---

<div align="center"><sub>Feita para o Windows, com carinho e a Alminha.</sub></div>
