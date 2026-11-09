# opencode-mods

Mods para o [OpenCode](https://opencode.ai): painel de arquivos alterados, status da sessão e customização visual. A janela de customização usa WPF no Windows; o painel e o rodapé são multiplataforma.

## O que tem

| Mod | O que faz |
| --- | --- |
| `files-changed` | Painel com abas **Arquivos**, **Tempo**, **BTW** e **Comandos**: diffs por pergunta ou sessão, revert nativo/por arquivo, explicação por IA, linha do tempo com custo, tokens e ferramentas |
| `session-status` | Rodapé com pasta, branch, uso semanal (quando disponível), compacts, custo e estado do painel; notificações de fim, erro e permissão |
| `customize-opencode` | Janela para as opções do `cli.json` do OpenCode e para criar/editar temas customizados |

## Requisitos

- **OpenCode 2.2.x** (API de plugins V2)
- Windows para a janela de customização; o painel e o rodapé são multiplataforma
- Node.js/npm no PATH para a instalação no modo cópia

## Instalação

### Windows

No PowerShell, dentro de `opencode/`:

```powershell
cd opencode
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1
```

Para desenvolver, use um junction para esta pasta:

```powershell
cd opencode
npm install
.\install.ps1 -Link
```

### Linux e macOS

Dentro de `opencode/`:

```bash
cd opencode
bash install.sh
```

Para desenvolver, use um symlink:

```bash
cd opencode
npm install
bash install.sh --link
```

O instalador copia o plugin para `~/.config/opencode/plugins/opencode-mods`, instala as dependências de runtime do TUI e cria o comando `/commit`. Depois **feche e reabra o TUI** (não basta `/reload`).

Para remover no Windows:

```powershell
.\install.ps1 -Uninstall
```

Para remover no Linux/macOS:

```bash
bash install.sh --uninstall
```

Use `-Uninstall -Purge` ou `--uninstall --purge` para apagar também os dados em `~/.local/share/opencode/mods/opencode-mods`.

## Documentação

Instruções completas, opções, comandos, atalhos, dados e solução de problemas: [`opencode/README.md`](opencode/README.md).

## Dados

```text
~/.local/share/opencode/mods/opencode-mods/    # dados dos mods
~/.config/opencode/commands/commit.md          # comando /commit
~/.config/opencode/cli.json                    # opções editadas pelo customize
~/.config/opencode/themes/                     # temas criados/editados
```
