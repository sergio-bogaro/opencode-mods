import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import { cliConfigPath, themesDir, writeFileAtomic } from "../shared/paths"

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json }
export type JsonObject = { [key: string]: Json }

export type Original = { value?: Json; absent?: true }
export type Originals = Record<string, Original>

export type ConfigRow = {
  key: string
  label: string
  description?: string
  kind: "choice" | "boolean" | "text" | "number"
  value: string | boolean | number
  options?: string[]
  group?: string
  min?: number
  max?: number
  step?: number
  integer?: boolean
  ui?: "slider" | "text"
  isLocked?: boolean
}

type ConfigDefinition = Omit<ConfigRow, "value"> & {
  default: string | boolean | number
}

const SCHEMA_URL = "https://opencode.ai/v2/cli.json"

/** Temas embutidos do OpenCode V2 (documentação oficial). */
export const BUILTIN_THEMES = [
  "aura",
  "ayu",
  "carbonfox",
  "catppuccin",
  "catppuccin-frappe",
  "catppuccin-macchiato",
  "cobalt2",
  "cursor",
  "dracula",
  "everforest",
  "flexoki",
  "github",
  "gruvbox",
  "kanagawa",
  "lucent-orng",
  "material",
  "matrix",
  "mercury",
  "monokai",
  "nightowl",
  "nord",
  "one-dark",
  "opencode",
  "orng",
  "osaka-jade",
  "palenight",
  "rosepine",
  "solarized",
  "synthwave84",
  "tokyonight",
  "vercel",
  "vesper",
  "zenburn",
]

const SPINNERS = [
  "block-soft-slide",
  "block-soft-sweep",
  "block-low-comet",
  "block-low-duet",
  "block-shuttle",
  "block-bridge",
  "block-squeeze",
  "small-toggle",
  "square-toggle",
  "grow-shrink",
  "quadrant-orbit",
  "crosshatch",
  "density-wave",
  "seed",
]

const DEFINITIONS: ConfigDefinition[] = [
  // Tema
  { key: "theme.name", label: "Tema", description: "Tema embutido, de sistema ou customizado.", kind: "text", default: "opencode", group: "Tema" },
  { key: "theme.mode", label: "Modo do tema", description: "Segue o terminal ou trava em claro/escuro.", kind: "choice", options: ["system", "dark", "light"], default: "system", group: "Tema" },

  // Aparência
  { key: "animations", label: "Animações", description: "Animações da interface.", kind: "boolean", default: true, group: "Aparência" },
  { key: "cursor.style", label: "Cursor", description: "Forma do cursor do terminal.", kind: "choice", options: ["default", "block", "underline", "line"], default: "default", group: "Aparência" },
  { key: "cursor.blinking", label: "Cursor piscando", kind: "boolean", default: true, group: "Aparência" },
  { key: "highlights", label: "Novidades", description: "Mostra as novidades da versão ao abrir.", kind: "boolean", default: true, group: "Aparência" },
  { key: "terminal.title", label: "Título do terminal", kind: "boolean", default: true, group: "Terminal" },
  { key: "terminal.copy", label: "Copiar ao selecionar", kind: "choice", options: ["manual", "select"], default: process.platform === "win32" ? "manual" : "select", group: "Terminal" },

  // Alertas
  { key: "attention.notifications", label: "Notificações do sistema", kind: "boolean", default: true, group: "Alertas" },
  { key: "attention.sound", label: "Som", kind: "boolean", default: true, group: "Alertas" },
  { key: "attention.volume", label: "Volume", description: "De 0 a 100%.", kind: "number", default: 0.4, min: 0, max: 1, step: 0.05, ui: "slider", group: "Alertas" },
  { key: "attention.sound_pack", label: "Pacote de som", kind: "text", default: "opencode.default", group: "Alertas" },

  // Sessão
  { key: "session.sidebar", label: "Sidebar", description: "Mostra quando couber ou esconde.", kind: "choice", options: ["auto", "hide"], default: "auto", group: "Sessão" },
  { key: "session.scrollbar", label: "Barra de rolagem", kind: "boolean", default: true, group: "Sessão" },
  { key: "session.submit_scroll", label: "Rolagem ao enviar", description: "Vai para a última mensagem ou mantém a posição.", kind: "choice", options: ["bottom", "keep"], default: "bottom", group: "Sessão" },
  { key: "session.thinking", label: "Raciocínio", description: "Mostra o raciocínio do modelo por padrão.", kind: "choice", options: ["show", "hide"], default: "show", group: "Sessão" },
  { key: "session.verbosity", label: "Detalhe do transcript", description: "Quanto de ferramentas e raciocínio aparece na conversa.", kind: "choice", options: ["low", "medium", "high"], default: "medium", group: "Sessão" },
  { key: "session.grouping", label: "Agrupar itens", kind: "choice", options: ["auto", "none"], default: "auto", group: "Sessão" },
  { key: "session.image_preview", label: "Prévia de imagens", kind: "boolean", default: false, group: "Sessão" },
  { key: "session.tps", label: "Tokens por segundo", kind: "boolean", default: true, group: "Sessão" },
  { key: "session.markdown", label: "Markdown", description: "Mostra a fonte ou o texto renderizado.", kind: "choice", options: ["rendered", "source"], default: "rendered", group: "Sessão" },
  { key: "session.new_location", label: "Nova sessão", kind: "choice", options: ["launch", "inherit"], default: "launch", group: "Sessão" },
  { key: "session.permissions", label: "Permissões", description: "Pede ou aceita automaticamente.", kind: "choice", options: ["prompt", "autoaccept"], default: "prompt", group: "Sessão" },

  // Abas
  { key: "tabs.mode", label: "Abas", kind: "choice", options: ["auto", "on", "off"], default: "auto", group: "Abas" },
  { key: "tabs.enabled", label: "Abas (legado)", description: "Equivale a tabs.mode on/off; o OpenCode não reescreve o arquivo.", kind: "boolean", default: true, group: "Abas" },
  { key: "tabs.scope", label: "Escopo das abas", kind: "choice", options: ["cwd", "global"], default: "cwd", group: "Abas" },
  { key: "tabs.layout", label: "Layout das abas", kind: "choice", options: ["horizontal", "vertical"], default: "horizontal", group: "Abas" },
  { key: "tabs.indicators", label: "Indicadores", kind: "choice", options: ["status", "numbers"], default: "status", group: "Abas" },

  // Diffs
  { key: "diffs.source", label: "Escopo do diff", kind: "choice", options: ["branch", "committed", "working"], default: "branch", group: "Diffs" },
  { key: "diffs.wrap", label: "Quebra de linha", kind: "choice", options: ["word", "none"], default: "word", group: "Diffs" },
  { key: "diffs.tree", label: "Árvore de arquivos", kind: "boolean", default: true, group: "Diffs" },
  { key: "diffs.single", label: "Um arquivo por vez", kind: "boolean", default: false, group: "Diffs" },
  { key: "diffs.view", label: "Layout do diff", kind: "choice", options: ["auto", "split", "unified"], default: "auto", group: "Diffs" },
  { key: "diffs.fullscreen", label: "Diff em tela cheia", kind: "boolean", default: false, group: "Diffs" },

  // Entrada
  { key: "mouse", label: "Mouse", kind: "boolean", default: true, group: "Entrada" },
  { key: "scroll.speed", label: "Velocidade da rolagem", description: "Distância por evento de rolagem.", kind: "number", default: 3, min: 0.001, step: 0.1, group: "Entrada" },
  { key: "scroll.acceleration", label: "Aceleração da rolagem", kind: "boolean", default: false, group: "Entrada" },
  { key: "prompt.editor", label: "Contexto do editor", kind: "boolean", default: true, group: "Entrada" },
  { key: "prompt.paste", label: "Colar", kind: "choice", options: ["compact", "full"], default: "compact", group: "Entrada" },
  { key: "prompt.image_preview", label: "Prévia de imagem no prompt", kind: "boolean", default: false, group: "Entrada" },

  // Mini
  { key: "mini.thinking", label: "Raciocínio", kind: "choice", options: ["show", "hide"], default: "show", group: "Mini" },
  { key: "mini.tools", label: "Ferramentas", kind: "choice", options: ["show", "hide"], default: "hide", group: "Mini" },
  { key: "mini.shell_output", label: "Saída do shell", kind: "choice", options: ["show", "hide"], default: "hide", group: "Mini" },
  { key: "mini.turn_summary", label: "Resumo do turno", kind: "choice", options: ["show", "hide"], default: "show", group: "Mini" },
  { key: "mini.footer", label: "Rodapé", kind: "choice", options: ["show", "hide"], default: "show", group: "Mini" },
  { key: "mini.splash", label: "Splash", kind: "choice", options: ["show", "hide"], default: "show", group: "Mini" },
  { key: "mini.work_spinner", label: "Spinner", kind: "choice", options: SPINNERS, default: "block-soft-slide", group: "Mini" },
  { key: "mini.mono", label: "ASCII monoespaçado", kind: "boolean", default: false, group: "Mini" },
  { key: "mini.replay", label: "Replay", description: "Restaura o histórico ao retomar e ao redimensionar.", kind: "boolean", default: true, group: "Mini" },
  { key: "mini.replay_limit", label: "Limite do replay", description: "Mensagens mais novas mantidas no replay.", kind: "number", default: 200, min: 1, step: 1, integer: true, group: "Mini" },
]

export function getPath(object: JsonObject, keys: readonly string[]): Json | undefined {
  let current: Json | undefined = object
  for (const key of keys) {
    if (current === null || typeof current !== "object" || Array.isArray(current)) return undefined
    current = (current as JsonObject)[key]
  }
  return current
}

export function setPath(object: JsonObject, keys: readonly string[], value: Json | undefined): void {
  let current = object
  for (const key of keys.slice(0, -1)) {
    const next = current[key]
    if (next === null || typeof next !== "object" || Array.isArray(next)) {
      if (value === undefined) return
      current[key] = {}
    }
    current = current[key] as JsonObject
  }
  const last = keys[keys.length - 1]
  if (last === undefined) return
  if (value === undefined) delete current[last]
  else current[last] = value
}

export async function readCli(): Promise<JsonObject> {
  const file = cliConfigPath()
  let text: string
  try {
    text = await readFile(file, "utf8")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { $schema: SCHEMA_URL }
    throw new Error(`não consegui ler o cli.json (${file}): ${String(error)}`)
  }

  let parsed: Json
  try {
    parsed = JSON.parse(text.replace(/^\uFEFF/, "")) as Json
  } catch {
    throw new Error("o cli.json tem comentários ou está inválido")
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("o cli.json precisa ser um objeto JSON")
  }
  return parsed as JsonObject
}

export async function writeCli(cli: JsonObject): Promise<void> {
  cli.$schema ??= SCHEMA_URL
  await writeFileAtomic(cliConfigPath(), JSON.stringify(cli, null, 2) + "\n")
}

/** Nomes dos temas customizados em ~/.config/opencode/themes. */
export async function customThemeNames(): Promise<string[]> {
  try {
    const entries = await readdir(themesDir(), { withFileTypes: true })
    return entries
      .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
      .map(entry => path.basename(entry.name, path.extname(entry.name)))
      .sort((left, right) => left.localeCompare(right))
  } catch {
    return []
  }
}

export async function configRows(): Promise<{ rows: ConfigRow[]; error: string }> {
  let cli: JsonObject
  try {
    cli = await readCli()
  } catch (error) {
    return { rows: [], error: String(error) }
  }
  const themes = await customThemeNames()
  const builtin = [...new Set(["opencode", "system", ...BUILTIN_THEMES])]
  const rows = DEFINITIONS.map(definition => {
    const raw = getPath(cli, definition.key.split("."))
    let value: string | boolean | number
    if (definition.kind === "boolean") {
      value = typeof raw === "boolean" ? raw : definition.default
    } else if (definition.kind === "number") {
      const parsed =
        typeof raw === "number"
          ? raw
          : typeof raw === "string" && raw.trim() !== ""
            ? Number(raw)
            : Number.NaN
      let numeric = Number.isFinite(parsed) ? parsed : Number(definition.default)
      if (definition.min !== undefined) numeric = Math.max(definition.min, numeric)
      if (definition.max !== undefined) numeric = Math.min(definition.max, numeric)
      if (definition.integer) numeric = Math.round(numeric)
      value = numeric
    } else {
      value = typeof raw === "string" ? raw : definition.default
    }
    let options = definition.options
    if (definition.key === "theme.name") {
      options = [...new Set([...builtin, ...themes, String(value)].filter(Boolean))]
    } else if (definition.kind === "choice") {
      const current = String(value)
      options = [...new Set([current, ...(definition.options ?? [])])]
    }
    return {
      ...definition,
      value,
      options,
      isLocked: false,
    } satisfies ConfigRow
  })
  return { rows, error: "" }
}

export async function setCliValue(key: string, value: string | boolean | number): Promise<string> {
  const definition = DEFINITIONS.find(item => item.key === key)
  if (!definition) return `Configuração ${key} não existe.`
  let next: Json | undefined = value
  if (definition.kind === "boolean") {
    if (typeof value !== "boolean") return `${definition.label}: valor inválido.`
  } else if (definition.kind === "number") {
    if (typeof value !== "number" && typeof value !== "string") return `${definition.label}: número inválido.`
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return `${definition.label}: número inválido.`
    if (definition.integer && !Number.isInteger(parsed)) return `${definition.label}: use um número inteiro.`
    if (definition.min !== undefined && parsed < definition.min) return `${definition.label}: o mínimo é ${definition.min}.`
    if (definition.max !== undefined && parsed > definition.max) return `${definition.label}: o máximo é ${definition.max}.`
    next = parsed
  } else if (definition.kind === "choice") {
    const text = String(value)
    if (!(definition.options ?? []).includes(text)) return `${definition.label}: opção inválida.`
    next = text
  } else {
    if (typeof value !== "string") return `${definition.label}: valor inválido.`
    const text = value.trim()
    next = text === "" ? undefined : text
  }
  const cli = await readCli()
  setPath(cli, key.split("."), next)
  await writeCli(cli)
  return ""
}

export async function restoreCli(originals: Originals): Promise<number> {
  const keys = Object.keys(originals)
  if (keys.length === 0) return 0
  const cli = await readCli()
  for (const key of keys) {
    const original = originals[key]!
    setPath(cli, key.split("."), original.absent ? undefined : original.value)
  }
  await writeCli(cli)
  return keys.length
}
