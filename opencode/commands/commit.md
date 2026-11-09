---
# opencode-mods: comando /commit
description: Analisa as mudanças e faz o commit numa sessão filha com Haiku 5.5
agent: build
model: opencode-go/claude-haiku-5-5#low
subagent: true
---

Analise as mudanças pendentes neste repositório e faça um commit delas.

## Status atual
!`git status --short`

## Mudanças não staged
!`git diff`

## Mudanças staged
!`git diff --cached`

## Últimos commits (para seguir o estilo)
!`git log --oneline -10`

Regras:
- Se não houver mudanças (status vazio), avise e pare.
- Leia o conteúdo dos arquivos novos/untracked (`??`) antes de decidir incluí-los.
- Siga o estilo e o idioma das mensagens de commit do histórico; se não houver histórico, use `tipo(escopo): resumo` com `feat`, `fix`, `docs`, `chore`, `refactor` ou `test`.
- Faça stage com caminhos explícitos (`git add <arquivo>`). Evite `git add -A` e `git add .`.
- Nunca inclua segredos (`.env`, chaves, credenciais, tokens), dependências (`node_modules`), builds ou artefatos gerados. Se algo parecer suspeito, não faça o commit e explique o que encontrou.
- Se houver conflitos de merge/rebase ou uma operação em andamento, não resolva nem faça o commit; avise e pare.
- Prefira um único commit. Se as mudanças forem claramente de assuntos diferentes, faça commits separados e coerentes.
- Não faça push, não use `--amend`, não descarte mudanças e não edite arquivos.
- No final, mostre o(s) hash(es) curto(s), a(s) mensagem(ns) e um resumo de uma linha do que foi commitado.

Instruções extras do usuário: $ARGUMENTS
