# Alma: ilha no topo da tela (com controle do ar-condicionado)

Uma "ilha" colada no topo do monitor, com a mascote **Alminha** e painéis rápidos.
A Alma não recebe pedidos: tudo é feito pelos painéis.

## Instalar e atualizar
- Instalador: `instalador\Alma-Setup-<versão>.exe` (instala só para você, sem pedir administrador, em
  `%LOCALAPPDATA%\Programs\Alma`, com atalhos na Área de Trabalho e no Menu Iniciar). Desinstala por
  *Configurações do Windows › Aplicativos*; o desinstalador pergunta se apaga também os seus dados.
- **Versão nova:** a Alma procura ao abrir e a cada 6 horas. Quando acha, avisa na ilha e com uma notificação;
  em *Configurações › Geral › Atualizações* aparecem as novidades e o botão **Baixar e instalar**
  (ela só baixa quando você pede). Depois, **Reiniciar e instalar** — ou ela instala quando você fechar.
- O Windows mostra "O Windows protegeu o computador" na primeira instalação porque o instalador ainda não é
  assinado digitalmente: *Mais informações › Executar assim mesmo*.

## Abrir
- Atalho **Alma** na Área de Trabalho ou no Menu Iniciar.
- A ilha fica recolhida numa linha fina no topo da tela; pare o mouse em cima dela para ela descer.
  Clique para abrir os painéis. A Alma também fica na bandeja do Windows, perto do relógio.

## Painéis
| Aba | O que faz |
|---|---|
| ❄ Clima | Liga/desliga o ar, temperatura, modo e ventilação |
| Foco | Pomodoro (foco, pausa curta, pausa longa a cada N rodadas), temporizador e cronômetro. Na ilha recolhida o tempo aparece no lugar do relógio e a linha fina vira barra de progresso; a Alminha dorme durante o foco e a Alma fica em silêncio (só avisa o fim) |
| Traduzir | Tradução rápida (Google Tradutor; MyMemory se ele falhar): cole, digite ou **arraste um texto selecionado até a ilha**. Se o texto já está no seu idioma, vai para o alternativo |
| Cores | Conta-gotas: "Escolher uma cor da tela" abre uma lupa por cima da tela (setas movem 1 px, Shift+setas 10 px, clique/Enter escolhe, Esc cancela). Copia em HEX, RGB ou HSL e guarda as 24 últimas |
| Música | O que está tocando agora (capa, música, artista, app e progresso — de qualquer player que apareça no controle de mídia do Windows), tocar/pausar, anterior/próxima, volume e tocar algo no YouTube |
| Tarefas | Lista de tarefas com marcar como feita e apagar |
| Rotinas | Agendamentos já criados: executar agora ou apagar |
| Copiados | Histórico da área de transferência (clique para copiar de novo) |
| Apps | Apps favoritos e busca de apps instalados |
| Bandeja | Bandeja temporária de arquivos (veja abaixo) |

## Módulos
Em *Configurações › Módulos*: ligue/desligue cada painel e mude a ordem (arrastando ou com as setas ↑ ↓).
Com mais de 7 ligados, as abas mostram só os ícones. Na mesma tela ficam as opções do Foco (tempos, rodadas,
pausa/foco automáticos, Alminha dormindo, silêncio, som), da Tradução (idiomas, traduzir ao soltar, copiar
sozinho) e do Conta-gotas (formato, copiar sozinho).

## Alma Actions
Em *Configurações › Ações*: "**Quando** algo acontecer, **fazer** isto e aquilo".
- Quando: abrir ou fechar um app/jogo (escolhido da lista de abertos ou pelo nome do .exe), algo entrar em
  tela cheia, começar/acabar o foco, a Alma abrir.
- Fazer: volume, mudo, modo silencioso, mostrar/esconder a ilha, começar o foco, abrir app, abrir site,
  controlar a música, ar-condicionado, mostrar um aviso.
- "Desfazer quando terminar": ao fechar o app / sair da tela cheia / acabar o foco, volta tudo como estava.
- Modelos prontos: *Jogando*, *Hora de focar*, *Bom dia, Alma*. **Testar** roda agora (e desfaz em 6 s).
- A Alma confere os apps abertos e a tela cheia a cada 2,5 s (`src/actions.js`).

## Acessibilidade
Em *Configurações › Acessibilidade*:

| Opção | O que faz |
|---|---|
| Quando parada, a ilha fica | **Sempre visível**, **Linha fina** (padrão) ou **Escondida** (some de vez; volta quando o mouse para no lugar dela) |
| Tempo com o mouse em cima | Na hora / Rápido / Médio / Devagar, para ela não abrir sem querer |
| Recolher depois de | 1 s, 2,5 s, 5 s ou 10 s depois que o mouse sai |
| Abrir o painel só passando o mouse | Abre sem clicar (a hotbar deixa de descer sozinha) |
| Esconder com app em tela cheia | Some em jogos, vídeos e apresentações em tela cheia |
| Lugar no topo da tela / Monitor | Esquerda, centro ou direita; em qual monitor |
| Atalho para abrir o painel | Ctrl+Alt+A, Ctrl+Alt+Espaço, Ctrl+Shift+Espaço ou Alt+Shift+A. No painel: ← → trocam de aba, Tab passa pelos botões, Enter aciona, Esc fecha |
| Visão / Movimento | Tamanho do texto, reduzir transparência, aumentar contraste e animações |

## Bandeja de arquivos
Arraste arquivos ou pastas até a ilha: ela abre a área **Solte aqui** e guarda tudo na aba **Bandeja**
(o número no ombro da Alminha mostra quantos itens há; clicar nele abre a bandeja). De lá:
- **Arraste para fora** para enviar num chat/e-mail ou soltar numa pasta (vai como cópia). "Arraste daqui para levar os N" leva todos.
- **Copiar** põe o arquivo na área de transferência: é só colar (Ctrl+V) numa pasta ou conversa.
- **Mover para…** move de verdade para a pasta que você escolher.
- **Mostrar na pasta**, clique duplo abre, **×** tira da bandeja.

Cada item sai da bandeja **12 horas** depois de entrar (soltar o mesmo arquivo de novo renova o prazo).
A bandeja guarda só a referência: o arquivo continua onde estava e nunca é apagado por ela.

O botão de engrenagem no canto do painel abre as Configurações.

## Aparência (Liquid Glass)
Em *Configurações › Aparência*, com uma prévia ao vivo no topo:

| Opção | O que muda |
|---|---|
| Material | **Sólido**, **Liquid Glass** (vidro que desfoca o que está atrás, com brilho e refração nas bordas) ou **Vidro claro** (quase transparente; o texto troca de cor sozinho sobre fundos claros/escuros) |
| Vidro | Transparência, desfoque, desfoque real da tela e refração nas bordas |
| Cores | Cor do app (10 prontas ou qualquer uma), cor de destaque e ajuste fino |
| Alminha | Cor do corpo (Creme, Neve, Céu, Menta, Lavanda, Rosa, Pêssego, Grafite) |
| Forma e tamanho | Cantos, tamanho do texto, tamanho dos ícones da hotbar |
| Ilha | Nome, relógio (hora / dia e hora / esconder), temperatura do ar ao lado do relógio |
| Acessibilidade | Reduzir transparência e aumentar contraste (também seguem o Windows sozinhos) |

**Desfoque real da tela:** o Windows não desfoca o que está atrás de uma janela transparente como a ilha, então
a Alma lê a imagem da tela só para desenhar o vidro (nada é gravado nem enviado). Enquanto o vidro está à vista, a
ilha fica fora de prints e gravações de tela. Desligue essa opção se precisar mostrar a ilha num print.

## Ar-condicionado
Em *Configurações › Ar-condicionado*, escolha como seu ar se conecta:

| Seu ar / app | Escolha | O que precisa |
|---|---|---|
| LG (app LG ThinQ) | **LG ThinQ** | Token em https://connect-pat.lgthinq.com |
| Samsung (app SmartThings) | **Samsung SmartThings** | Token em https://account.smartthings.com/tokens (vale 24 h) ou OAuth |
| Elgin, Philco, TCL, controle IR Wi-Fi (app Smart Life) | **Smart Life / Tuya** | Projeto grátis em https://platform.tuya.com |
| Midea/Springer/Carrier, Gree, Daikin, Fujitsu, Electrolux… | **Home Assistant** | Home Assistant com o ar como `climate.*` |
| Só quero testar | **Demonstração** | nada |

Clique em **Salvar e procurar aparelhos** e escolha o principal.

## Onde ficam os dados
`%APPDATA%\Alma\data.json`. Os tokens do ar ficam cifrados (DPAPI do Windows).

## Site
`site/` é o site da Alma (HTML, CSS e JS, sem servidor): `index.html`, `css/site.css`, `js/site.js`,
a Alminha (`js/mascot.js` e `css/mascot.css`, cópias do app), rolagem suave com Lenis (`js/vendor`, licença MIT)
e `releases.json` (versão, tamanho e novidades mostrados na página — atualize a cada lançamento).
Para ver localmente: `node scripts/serve.js site 4321` e abra http://127.0.0.1:4321.
O botão de download aponta para as Releases do GitHub quando `repo` em `releases.json` tiver o usuário certo.

## Desenvolvimento
```
npm start          # roda a partir do código
npm run dist       # gera instalador\Alma-Setup-<versão>.exe + latest.yml (aumente "version" no package.json antes)
npm run package    # (antigo) pasta solta em release\Alma-win32-x64
```
Estrutura: `src/main.js` (janelas e IPC), `src/tools.js` (ações das rotinas), `src/ac/*` (drivers do ar),
`src/scheduler.js` (rotinas), `src/system.js` (apps, mídia, sites), `src/ui/*` (ilha, Alminha, configurações;
`theme.js` gera as cores e formas, `glass.css` é a linguagem visual, `liquid.js` faz o desfoque real).
A parte antiga de pedidos (voz, Gemini, comandos, atalhos) foi guardada em `_removido/` e não entra no app.
