# opencode-mods — mods para OpenCode

**Painel de arquivos alterados**, **status da sessão** e **customização visual** para o OpenCode.

Requer **OpenCode 2.2.x** (API de plugins V2). O painel e o rodapé rodam em Linux, macOS e Windows. A janela de customização usa WPF no Windows; o instalador tem versões para PowerShell (Windows) e shell (Linux/macOS).

## O que tem

| Mod | O que faz |
| --- | --- |
| `files-changed` | Painel com abas **Arquivos**, **Tempo**, **BTW** e **Comandos**: diffs por pergunta ou sessão, revert nativo/por arquivo, explicação por IA, linha do tempo com custo/tokens/ferramentas |
| `session-status` | Rodapé com pasta, branch, uso semanal (quando disponível), compacts, custo e estado do painel; notificações de fim/erro/permissão |
| `customize-opencode` | Janela para as opções do `cli.json` do OpenCode e para criar/editar temas customizados |

## Instalação

### Windows

No PowerShell, dentro de `opencode/`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1
```

Para desenvolver, use um junction em vez de copiar:

```powershell
npm install
.\install.ps1 -Link
```

### Linux e macOS

Dentro de `opencode/`:

```bash
bash install.sh
```

Para desenvolver, use um symlink em vez de copiar:

```bash
npm install
bash install.sh --link
```

Em ambos os instaladores, o modo padrão copia o plugin para:

```text
~/.config/opencode/plugins/opencode-mods
```

e instala ali as dependências de runtime do TUI (`solid-js`, `@opentui/core` e `@opentui/solid`) com `npm ci --omit=dev`. O OpenCode descobre o plugin nesse diretório sozinho. Se o TUI estiver aberto, feche antes de rodar o instalador: o watcher pode tentar recarregar a pasta no meio da cópia. Depois **reabra o TUI** (não basta `/reload`).

O modo cópia precisa de `npm` no PATH. O modo `-Link`/`--link` usa o `node_modules` do repositório e exige que `npm install` já tenha sido rodado em `opencode/`.

Ele também instala o comando `/commit` em `~/.config/opencode/commands/commit.md`. Se já existir um `commit.md` diferente do que será instalado — inclusive uma versão antiga editada por você —, o instalador guarda uma cópia em `~/.config/opencode/backups/opencode-mods-<data>/commands/commit.md` antes de copiar.

No Linux/macOS, `XDG_CONFIG_HOME` e `XDG_DATA_HOME` são respeitados.

### Opções

As opções ficam na entrada do plugin no `opencode.json(c)`:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    {
      "package": "./plugins/opencode-mods",
      "options": {
        "filesChanged": true,
        "autoOpen": true,
        "sessionStatus": true,
        "customize": true,
        "windowsToast": false
      }
    }
  ]
}
```

- `filesChanged`: liga o painel e os comandos `/arquivos`, `/linha-do-tempo`, `/limpar-*`.
- `autoOpen`: abre o painel junto com a sessão, sem tirar o foco do prompt (padrão: ligado). Se você fechar o painel, ele para de reabrir sozinho nesta execução; `/arquivos` ou `/linha-do-tempo` reativam o acompanhamento.
- `sessionStatus`: liga o rodapé e as notificações.
- `customize`: liga `/customize-opencode` e o editor de tema.
- `windowsToast`: usa o toast nativo do Windows com as poses (padrão: notificação do OpenCode).

Se você usa a instalação por descoberta automática (recomendada), pode pular a entrada no `opencode.jsonc`; as opções padrão são todas ligadas e o toast do Windows desligado.

Para usar opções, instale o pacote **fora** de `plugins/` (por exemplo, copie para `~/.config/opencode/mods/opencode-mods`) e aponte a entrada `plugins` para ele. Não mantenha as duas cópias ao mesmo tempo, senão o mesmo plugin pode ser carregado duas vezes.

## Comandos

| Comando | O que faz |
| --- | --- |
| `/arquivos` | Abre o painel na aba Arquivos |
| `/linha-do-tempo` | Abre o painel na aba Tempo |
| `/limpar-linha-do-tempo` | Esvazia a aba Tempo (não apaga a conversa); as próximas perguntas aparecem normalmente |
| `/limpar-dados` | Zera seleção, explicação e linha do tempo desta sessão |
| `/customize-opencode` | Abre a janela de customização |
| `/commit` | Analisa as mudanças e faz o commit com o Claude Haiku 5.5, numa sessão filha (não faz push) |

`/limpar-linha-do-tempo` e `/limpar-dados` pedem confirmação; também aceitam `confirmar` para pular o diálogo.

### `/commit`

`/commit` analisa `git status`, `git diff` e os últimos commits e faz o commit das mudanças. Ele roda numa **sessão filha** com `opencode-go/claude-haiku-5-5#low`, então o modelo da sessão principal não muda; o resultado volta para a conversa quando termina.

O comando:

- faz stage com caminhos explícitos (evita `git add -A` e `git add .`);
- não inclui segredos, `node_modules`, builds ou artefatos gerados;
- não faz push, não usa `--amend` e não descarta mudanças;
- para em conflitos ou merge/rebase em andamento;
- aceita instruções extras: `/commit "só os arquivos do painel"`.

Para trocar o modelo, edite a linha `model:` em `~/.config/opencode/commands/commit.md` (ou em `opencode/commands/commit.md` e rode o instalador de novo). O modo `-Link` também copia o comando, então editar o arquivo do repositório não atualiza o comando instalado sozinho.

## Painel de arquivos

O painel abre sozinho ao entrar numa sessão, sem tirar o foco do prompt. Se você fechar, ele não reabre sozinho nesta execução; `/arquivos` ou `/linha-do-tempo` trazem o painel de volta. O painel é keyboard-first:

| Tecla | Ação |
| --- | --- |
| `1` `2` `3` `4` | Arquivos / Tempo / BTW / Comandos |
| `tab` / `shift+tab` | Próxima / aba anterior (dá a volta) |
| `←` `→` | Aba anterior / próxima (dá a volta) |
| `↑` `↓` | Navegar |
| `espaço` / `enter` | Marcar arquivo, expandir pergunta ou rodar comando |
| `r` | Desfazer o arquivo selecionado |
| `shift+r` | Reverter a pergunta/sessão (revert nativo do OpenCode) |
| `e` | Explicar os arquivos marcados |
| `m` / `v` | Modelo / variante da explicação |
| `t` | Alternar “esta pergunta” / “sessão toda” |
| `a` / `n` | Marcar todos / desmarcar todos |
| `f` | Tela cheia |
| `?` | Ajuda |
| `esc` | Fechar |

O cabeçalho mostra `● painel com foco` ou `○ painel sem foco`; quando está sem foco, ele também exibe o atalho `pane.focus.right` para trazer o teclado de volta. A linha atual ganha um marcador `▌` e um fundo mais forte quando o painel está com foco.

O mouse também funciona: passar o mouse destaca a aba; clique em qualquer ponto dela para trocá-la, e o clique não seleciona o texto (a aba ativa fica sublinhada e destacada mesmo sem foco). Clique numa linha para selecioná-la e clique de novo na mesma linha para marcar o arquivo, expandir a pergunta ou rodar o comando. O teclado continua sendo o caminho principal.

O diff vem de `session.diff` do OpenCode, então funciona com edições feitas por ferramentas e por comandos de shell. O revert por pergunta usa `session.revert`: na aba Tempo, `shift+r` reverte a partir da pergunta destacada; nas outras abas, usa a última pergunta. O revert por arquivo aplica o patch inverso e recusa quando o arquivo mudou desde o diff.

Se o custo reportado da sessão for maior que a soma das mensagens visíveis — por exemplo, por causa de subagentes —, a aba Tempo mostra uma linha `(subagentes/fora da timeline)` com a diferença.

A explicação usa `experimental.generate.text`, não entra na conversa e aceita qualquer modelo/variante configurado no OpenCode.

## Rodapé

O rodapé mostra, quando disponível:

```text
pasta │ branch │ semana 12% │ 2 compacts │ US$0.34 │ +10 -2 │ ✦ BTW
```

- `semana` só aparece com dados de uso do OpenCode Go/Console; nos outros provedores o segmento não aparece.
- `compacts` conta as compactações concluídas da sessão.
- `+N -M` usa o mesmo recorte (pergunta/sessão) do painel e atualiza quando as ferramentas mexem em arquivos.
- `custo` usa o valor reportado pelo provedor; quando ele não reporta (caso do OpenCode Go), é estimado pela tabela de preços do modelo e aparece com `~` (ex.: `~US$0.27`). O mesmo vale para os custos da aba Tempo.

Notificações usam `attention.notify` do OpenCode: fim, erro, interrupção, permissão e formulário. Com `windowsToast: true`, o Windows também recebe o toast com as poses em `assets/poses`.

## Customize

`/customize-opencode` abre a janela com cinco abas para as opções do `~/.config/opencode/cli.json` e o editor de tema:

- **Tema:** `theme.name` (select com temas embutidos e customizados), `theme.mode` e o editor de tema customizado.
- **Aparência:** animações, cursor, novidades, título/cópia do terminal e alertas (notificações, som, volume e pacote).
- **Sessão:** sidebar, scrollbar, raciocínio, markdown, permissões, abas e diffs.
- **Entrada:** mouse, rolagem, contexto do editor, colar e prévia de imagem.
- **Mini:** todas as opções de `opencode mini`.

### Editor de tema

O OpenCode não deixa editar temas embutidos. A janela cria ou altera um **tema customizado** em:

```text
~/.config/opencode/themes/<nome>.json
```

O rascunho parte do tema que estava ativo quando a janela abriu. As cores principais (fundo, superfícies, texto, bordas, destaque, feedback, diffs, sintaxe e markdown) têm color picker e preview ao vivo, em claro e escuro. Os campos aceitam `#RGB`, `#RGBA`, `#RRGGBB` e `#RRGGBBAA`; o color picker usa RGB e o canal alpha continua preservado quando você edita o texto. O restante — escalas de hue e tokens não listados — fica no template `opencode` e pode ser ajustado no **Avançado (JSON do tema)**. Ao salvar, o `theme.name` passa a apontar para o tema novo.

A própria moldura da janela acompanha em tempo real as cores do tema ativo do OpenCode (claro ou escuro); o rascunho do editor continua no tema que você está editando. O select de **Tema** lista os temas embutidos e os globais em `~/.config/opencode/themes`; temas de projeto em `.opencode/themes` ainda precisam ser escolhidos editando o `cli.json`.

Enquanto o tema é aplicado, a janela mostra `⟳ Aplicando tema…` no topo. Se demorar mais de ~3 s, ela avisa que temas novos podem precisar de reabrir o OpenCode.

O template `assets/theme-opencode.json` é uma cópia do tema `opencode` do projeto OpenCode (MIT).

Temas existentes no formato antigo (V1) não são sobrescritos: a janela avisa e sugere criar um tema novo. Para usar outro tema embutido como base, selecione-o antes de abrir a janela. Temas novos podem precisar de fechar e reabrir o OpenCode para aparecer.

As mudanças no `cli.json` são recarregadas pelo OpenCode sem reiniciar. O botão **Restaurar padrão** volta as opções e também restaura ou apaga os arquivos de tema criados/alterados pela janela. O estado fica em:

```text
~/.local/share/opencode/mods/opencode-mods/customize-opencode/
```

O estado da janela usa um arquivo por processo (`state-<pid>-<id>.json`), para duas instâncias do OpenCode não sobrescreverem a janela uma da outra. Alterações em `cli.json`, temas e `original.json` são serializadas por um lock compartilhado (`customize.lock`); o `original.json` (dados de restore) continua global.

> Vindo da versão anterior: ajustes feitos no Windows Terminal não são mais restaurados por esta janela. O backup antigo, se existir, continua em `wt-settings.backup.json` nessa pasta.

Ficam fora da janela, para editar direto no `cli.json`: `keybinds`, `plugins`, `attention.sounds`, `debug.*` e `experimental`. O instalador não altera `opencode.jsonc`, `cli.json` nem `themes/`; só a janela, quando você manda.

## Dados

```text
~/.local/share/opencode/mods/opencode-mods/     # dados dos mods
~/.config/opencode/commands/commit.md          # comando de commit instalado pelo instalador
~/.config/opencode/cli.json                   # opções editadas pelo customize
~/.config/opencode/themes/                    # temas criados/editados pelo customize
```

`/limpar-dados` não toca nos snapshots do OpenCode, nos seus arquivos ou no histórico da conversa. Ele limpa apenas o estado do painel.

## Desinstalar

Windows:

```powershell
.\install.ps1 -Uninstall
```

Linux/macOS:

```bash
bash install.sh --uninstall
```

Para apagar também os dados do customize:

```powershell
.\install.ps1 -Uninstall -Purge
```

```bash
bash install.sh --uninstall --purge
```

O `-Purge`/`--purge` remove só `~/.local/share/opencode/mods/opencode-mods`; `cli.json` e os temas em `~/.config/opencode/themes` são seus arquivos e continuam lá. Use **Restaurar padrão** na janela antes de desinstalar se quiser voltar o que foi mudado.

A desinstalação também remove `~/.config/opencode/commands/commit.md` se ele foi instalado pelo opencode-mods (o arquivo tem um marcador). Se você editou ou substituiu o arquivo, ele é mantido.

## Solução de problemas

### `Cannot find package 'solid-js' imported from .../src/tui/request.ts`

A parte do servidor carregou, mas o plugin de TUI falhou. Isso acontece quando a pasta instalada não tem as dependências de runtime do TUI. O instalador normal já as instala; se você copiou o plugin manualmente, reinstale com:

```powershell
.\install.ps1
```

```bash
bash install.sh
```

Ou use o junction/symlink, que aproveita o `node_modules` do repositório:

```powershell
.\install.ps1 -Link
```

```bash
bash install.sh --link
```

Não basta copiar só `solid-js`: o transform de JSX também precisa de `@opentui/solid` e `@opentui/core` locais. O OpenCode 2.2.x tem uma limitação conhecida com plugins TUI externos em TSX ([issue #39986](https://github.com/anomalyco/opencode/issues/39986)); por isso este pacote é instalado como plugin local fora de `node_modules` e leva as cópias de runtime junto.

### O rodapé/painel não aparece depois de instalar

O plugin de TUI só é carregado quando o TUI inicia. Feche e reabra o OpenCode; `/reload` sozinho recarrega o servidor, não a parte visual.

### O painel abre, mas as teclas não respondem

O painel divide o espaço com o prompt, e o teclado fica em apenas um dos dois. O `autoOpen` abre de propósito sem foco, para você já poder digitar; os comandos de aba (`/arquivos`, `/linha-do-tempo`) tentam assumir o foco. Se o prompt ainda estiver com o foco, o cabeçalho mostra `painel sem foco`.

Use o atalho `pane.focus.right` para focar o painel (padrão: `ctrl+x` e depois `→`) e `pane.focus.left` para voltar ao prompt (padrão: `ctrl+x` e depois `←`). Se você customizou esses atalhos no `cli.json`, use os seus.

## Limitações

- A API de plugins do OpenCode é experimental; este pacote foi feito para **2.2.x**.
- Não existe “destacar janela” no TUI: use `f` para tela cheia.
- O painel ocupa o mesmo espaço da sidebar nativa: abrir o painel esconde a sidebar e abrir a sidebar fecha o painel (comportamento do host).
- Não há API para rolar até uma mensagem específica; a linha do tempo não tem o botão “ir” do mod original.
- O revert por arquivo é melhor-esforço: se o arquivo mudou depois do diff ou é um link simbólico, ele recusa e você pode usar o revert da pergunta.
- O uso semanal depende do provedor (OpenCode Go/Console).
- A janela de customização é Windows-only; no Linux/macOS o comando `/customize-opencode` apenas informa isso. O painel e o rodapé são multiplataforma.
- O editor de tema cria temas no formato V2 em `~/.config/opencode/themes`; temas embutidos não são alterados e temas V1 não são sobrescritos.
- A janela cobre as opções visuais do `cli.json`; `keybinds`, `plugins`, `attention.sounds`, `debug.*` e `experimental` continuam sendo editados à mão.
- O painel é keyboard-first; o mouse seleciona linhas e troca abas, mas o teclado continua sendo o caminho principal.
- O `/commit` não faz push; rode `git push` depois. O modelo `opencode-go/claude-haiku-5-5` precisa estar disponível no seu provedor (ajuste a linha `model:` se não estiver).

## Desenvolvimento

```bash
cd opencode
npm install
npm run check      # typecheck + testes
npm run test:coverage
npm run test:ui    # smoke test da janela WPF (Windows)
bash tests/install-sh.test.sh  # teste do instalador Linux/macOS
```

O plugin é carregado direto dos arquivos `.ts`/`.tsx` pelo OpenCode; não há build separado. Use `.\install.ps1 -Link` no Windows ou `bash install.sh --link` no Linux/macOS para iterar. Mudanças no servidor podem ser recarregadas com `/reload`; mudanças no TUI precisam de fechar e reabrir o OpenCode.

## Estrutura

```text
opencode/
  server.ts                 # RPC e customize (Windows/WPF + cli.json)
  tui.tsx                   # painel, rodapé, comandos e notificações
  rpc.ts                    # contrato server <-> TUI
  install.ps1               # instalador Windows/PowerShell
  install.sh                # instalador Linux/macOS
  commands/commit.md         # comando /commit (instalado em ~/.config/opencode/commands)
  src/shared/               # paths, formatação e patch reverso
  src/server/               # customize, cli.json e editor de tema
  src/tui/                  # painel, dados, status e notificações
  scripts/                  # WPF, toast e foco
  assets/                   # ícone, poses do toast e template do tema opencode
  tests/                    # testes TypeScript e smoke tests
```
