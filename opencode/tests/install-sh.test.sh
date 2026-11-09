#!/usr/bin/env bash
# Teste do install.sh em Linux/macOS, sem rede: usa npm/opencode falsos.
set -euo pipefail

REPO="$(cd -- "$(dirname -- "${BASH_SOURCE[0]:-$0}")/.." && pwd)"
ROOT="$(mktemp -d)"
trap 'rm -rf "$ROOT"' EXIT

BIN="$ROOT/bin"
mkdir -p "$BIN"

cat > "$BIN/opencode" <<'EOF'
#!/usr/bin/env bash
echo "opencode 2.2.5"
EOF

cat > "$BIN/npm" <<'EOF'
#!/usr/bin/env bash
set -e
mkdir -p node_modules/solid-js node_modules/@opentui/solid node_modules/@opentui/core node_modules/@opencode/foreign
EOF

chmod +x "$BIN/opencode" "$BIN/npm"
export PATH="$BIN:$PATH"
export XDG_CONFIG_HOME="$ROOT/config"
export XDG_DATA_HOME="$ROOT/data"
cd "$REPO"

bash install.sh >/dev/null

TARGET="$XDG_CONFIG_HOME/opencode/plugins/opencode-mods"
COMMAND="$XDG_CONFIG_HOME/opencode/commands/commit.md"

[ -f "$TARGET/server.ts" ]
[ -f "$TARGET/tui.tsx" ]
[ -f "$TARGET/src/tui/files/panel.tsx" ]
[ -d "$TARGET/node_modules/solid-js" ]
[ -d "$TARGET/node_modules/@opentui/solid" ]
[ -d "$TARGET/node_modules/@opentui/core" ]
[ ! -e "$TARGET/node_modules/@opencode" ]
[ -f "$COMMAND" ]
grep -q 'opencode-mods: comando /commit' "$COMMAND"

printf '\n# edicao do usuario\n' >> "$COMMAND"
bash install.sh >/dev/null
[ "$(find "$XDG_CONFIG_HOME/opencode/backups" -type f -name commit.md | wc -l)" -ge 1 ]
! grep -q 'edicao do usuario' "$COMMAND"

bash install.sh --uninstall >/dev/null
[ ! -e "$TARGET" ]
[ ! -e "$COMMAND" ]

mkdir -p "$XDG_DATA_HOME/opencode/mods/opencode-mods"
printf 'dados' > "$XDG_DATA_HOME/opencode/mods/opencode-mods/state"
bash install.sh --uninstall --purge >/dev/null
[ ! -e "$XDG_DATA_HOME/opencode/mods/opencode-mods" ]

bash install.sh --link >/dev/null
[ -L "$TARGET" ]
[ "$(readlink "$TARGET")" = "$REPO" ]
[ -f "$COMMAND" ]
bash install.sh --uninstall >/dev/null
[ ! -e "$TARGET" ]

echo "OK  install.sh"
