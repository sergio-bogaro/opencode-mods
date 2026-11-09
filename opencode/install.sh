#!/usr/bin/env bash
# Instala o opencode-mods no OpenCode em Linux/macOS.
#
# Uso:
#   bash install.sh            # cópia + dependências de runtime
#   bash install.sh --link     # symlink para este diretório (desenvolvimento)
#   bash install.sh --uninstall
#   bash install.sh --uninstall --purge
set -euo pipefail

if [ -z "${HOME:-}" ]; then
  printf 'ERRO: HOME não está definido.\n' >&2
  exit 1
fi

SOURCE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]:-$0}")" && pwd)"
CONFIG_ROOT="${XDG_CONFIG_HOME:-$HOME/.config}"
DATA_ROOT="${XDG_DATA_HOME:-$HOME/.local/share}"
PLUGINS_DIR="$CONFIG_ROOT/opencode/plugins"
TARGET="$PLUGINS_DIR/opencode-mods"
COMMANDS_DIR="$CONFIG_ROOT/opencode/commands"
COMMAND_NAME="commit.md"
COMMAND_SOURCE="$SOURCE/commands/$COMMAND_NAME"
COMMAND_TARGET="$COMMANDS_DIR/$COMMAND_NAME"
MODS_DATA="$DATA_ROOT/opencode/mods/opencode-mods"
BACKUPS="$CONFIG_ROOT/opencode/backups"
STAMP="$(date +%Y%m%d-%H%M%S)-$$"

MODE="copy"
UNINSTALL=0
PURGE=0

log() { printf '%s\n' "$*"; }
warn() { printf 'AVISO: %s\n' "$*" >&2; }
die() { printf 'ERRO: %s\n' "$*" >&2; exit 1; }

usage() {
  cat <<'EOF'
Uso: bash install.sh [opções]

  --link          usa symlink para este diretório (desenvolvimento)
  --uninstall     remove o plugin e o comando /commit
  --purge         com --uninstall, apaga também os dados em ~/.local/share/opencode/mods/opencode-mods
  -h, --help      mostra esta ajuda

Variáveis respeitadas: XDG_CONFIG_HOME, XDG_DATA_HOME e HOME.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --link) MODE="link" ;;
    --uninstall) UNINSTALL=1 ;;
    --purge) PURGE=1 ;;
    -h|--help) usage; exit 0 ;;
    *) die "opção desconhecida: $1 (use --help)" ;;
  esac
  shift
done

if [ "$PURGE" -eq 1 ] && [ "$UNINSTALL" -eq 0 ]; then
  die "--purge só pode ser usado junto com --uninstall"
fi

require_source() {
  for item in server.ts tui.tsx rpc.ts package.json package-lock.json src scripts assets; do
    if [ ! -e "$SOURCE/$item" ]; then
      die "arquivo $item não encontrado em $SOURCE. Rode o instalador dentro da pasta opencode/."
    fi
  done
}

check_version() {
  if ! command -v opencode >/dev/null 2>&1; then
    warn "OpenCode não encontrado no PATH. Instale o OpenCode 2.x antes de continuar."
    return
  fi
  local version major minor
  version="$(opencode --version 2>/dev/null | head -n1 || true)"
  if [ -z "$version" ]; then
    warn "não consegui descobrir a versão do OpenCode."
    return
  fi
  log "OpenCode: $version"
  set -- $(printf '%s' "$version" | sed -n 's/.*\([0-9][0-9]*\)\.\([0-9][0-9]*\).*/\1 \2/p' | head -n1)
  if [ "$#" -ge 2 ]; then
    major="$1"
    minor="$2"
    if [ "$major" -lt 2 ]; then
      die "este plugin exige OpenCode 2.x. Versão encontrada: $version"
    fi
    if [ "$major" -eq 2 ] && [ "$minor" -lt 2 ]; then
      warn "este plugin foi feito para OpenCode 2.2.x. Versão encontrada: $version"
    fi
  fi
}

backup_target() {
  if [ -e "$TARGET" ] || [ -L "$TARGET" ]; then
    local backup="$BACKUPS/opencode-mods-$STAMP/plugin"
    mkdir -p "$(dirname "$backup")"
    mv "$TARGET" "$backup"
    log "  versão anterior guardada em $backup"
  fi
}

install_plugin() {
  require_source
  check_version
  mkdir -p "$PLUGINS_DIR"
  backup_target

  if [ "$MODE" = "link" ]; then
    for dependency in solid-js @opentui/solid @opentui/core; do
      if [ ! -e "$SOURCE/node_modules/$dependency" ]; then
        die "rode 'npm install' em $SOURCE antes de instalar com --link (falta $dependency)."
      fi
    done
    ln -s "$SOURCE" "$TARGET"
    log "OK symlink criado: $TARGET -> $SOURCE"
  else
    mkdir -p "$TARGET"
    for item in server.ts tui.tsx rpc.ts package.json package-lock.json tsconfig.json README.md src scripts assets; do
      if [ -e "$SOURCE/$item" ]; then
        cp -R "$SOURCE/$item" "$TARGET/"
      fi
    done

    if ! command -v npm >/dev/null 2>&1; then
      die "npm não encontrado no PATH. Instale o Node.js/npm ou use --link."
    fi

    log "  instalando dependências de runtime..."
    if ! (cd "$TARGET" && npm ci --omit=dev --ignore-scripts --no-audit --no-fund); then
      warn "npm ci falhou; tentando npm install..."
      if ! (cd "$TARGET" && npm install --omit=dev --ignore-scripts --no-audit --no-fund); then
        die "não consegui instalar as dependências de runtime em $TARGET."
      fi
    fi

    # O host fornece @opencode; uma cópia local seria rejeitada.
    rm -rf "$TARGET/node_modules/@opencode"

    for dependency in solid-js @opentui/solid @opentui/core; do
      if [ ! -e "$TARGET/node_modules/$dependency" ]; then
        die "dependência de runtime ausente: $dependency"
      fi
    done
    log "OK plugin copiado e dependências de runtime instaladas"
  fi
}

install_command() {
  if [ ! -f "$COMMAND_SOURCE" ]; then
    warn "comando /commit não encontrado em $COMMAND_SOURCE"
    return
  fi
  mkdir -p "$COMMANDS_DIR"
  if [ -f "$COMMAND_TARGET" ] && ! cmp -s "$COMMAND_SOURCE" "$COMMAND_TARGET"; then
    local backup="$BACKUPS/opencode-mods-$STAMP/commands/$COMMAND_NAME"
    mkdir -p "$(dirname "$backup")"
    cp -p "$COMMAND_TARGET" "$backup"
    log "  comando existente guardado em $backup"
  fi
  cp "$COMMAND_SOURCE" "$COMMAND_TARGET"
  log "OK comando instalado em $COMMAND_TARGET"
}

remove_target() {
  if [ -L "$TARGET" ]; then
    rm -f "$TARGET"
    log "OK plugin (symlink) removido de $TARGET"
  elif [ -d "$TARGET" ]; then
    rm -rf "$TARGET"
    log "OK plugin removido de $TARGET"
  elif [ -e "$TARGET" ]; then
    rm -f "$TARGET"
    log "OK plugin removido de $TARGET"
  else
    log "-- plugin não estava instalado em $TARGET"
  fi
}

remove_command() {
  if [ ! -f "$COMMAND_TARGET" ]; then
    return
  fi
  if ! grep -q 'opencode-mods: comando /commit' "$COMMAND_TARGET"; then
    warn "$COMMAND_TARGET não foi criado pelo opencode-mods; não removi."
    return
  fi
  if [ -f "$COMMAND_SOURCE" ] && ! cmp -s "$COMMAND_SOURCE" "$COMMAND_TARGET"; then
    warn "$COMMAND_TARGET foi modificado; não removi. Se quiser, apague manualmente."
    return
  fi
  rm -f "$COMMAND_TARGET"
  log "OK comando removido de $COMMAND_TARGET"
}

if [ "$UNINSTALL" -eq 1 ]; then
  remove_target
  remove_command
  if [ "$PURGE" -eq 1 ]; then
    if [ -e "$MODS_DATA" ]; then
      rm -rf "$MODS_DATA"
      log "OK dados removidos de $MODS_DATA"
    else
      log "-- dados não encontrados em $MODS_DATA"
    fi
  else
    log "    dados mantidos em $MODS_DATA (use --purge para apagar)"
  fi
  exit 0
fi

install_plugin
install_command

log ""
log "Pronto. Feche e reabra o TUI do OpenCode para carregar a parte visual."
log "Comandos: /commit  /arquivos  /linha-do-tempo  /limpar-linha-do-tempo  /limpar-dados"
log "A janela /customize-opencode é exclusiva do Windows."
log "Dados: $MODS_DATA"
