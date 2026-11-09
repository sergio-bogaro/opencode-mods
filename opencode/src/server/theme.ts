import { readFile, unlink } from "node:fs/promises"
import path from "node:path"
import { pluginRoot, themesDir, writeFileAtomic } from "../shared/paths"
import {
  BUILTIN_THEMES,
  getPath,
  setPath,
  type Json,
  type JsonObject,
} from "./cli-config"

export type ThemeMode = "light" | "dark"

export type ThemeColorDef = {
  path: string
  label: string
  group: string
}

export type ThemeColorRow = ThemeColorDef & {
  value: string
  default: string
}

export type ThemePalette = Record<ThemeMode, ThemeColorRow[]>

export type ThemeDraftState = {
  name: string
  originalName: string | null
  source: "new" | "existing"
  palette: ThemePalette
}

export type ThemeSnapshot = {
  mode: ThemeMode
  tokens: JsonObject
}

export type ThemeColorInput = {
  mode: ThemeMode
  path: string
  value: string
}

export type ThemeJsonState = {
  revision: number
  text: string
}

/** Cores semânticas que a janela edita com color picker. */
export const THEME_COLORS: ThemeColorDef[] = [
  { path: "text.base", label: "Texto", group: "Base" },
  { path: "text.muted", label: "Texto secundário", group: "Base" },
  { path: "background.base", label: "Fundo", group: "Base" },
  { path: "background.raised.base", label: "Painéis", group: "Base" },
  { path: "background.raised.high", label: "Painéis elevados", group: "Base" },
  { path: "border.base", label: "Bordas", group: "Base" },
  { path: "scrollbar.base", label: "Barra de rolagem", group: "Base" },

  { path: "text.action.primary.base", label: "Texto de ação", group: "Destaques" },
  { path: "text.feedback.error.base", label: "Erro", group: "Destaques" },
  { path: "text.feedback.warning.base", label: "Aviso", group: "Destaques" },
  { path: "text.feedback.success.base", label: "Sucesso", group: "Destaques" },
  { path: "text.feedback.info.base", label: "Informação", group: "Destaques" },

  { path: "diff.text.added", label: "Adicionado (texto)", group: "Diffs" },
  { path: "diff.text.removed", label: "Removido (texto)", group: "Diffs" },
  { path: "diff.background.added", label: "Adicionado (fundo)", group: "Diffs" },
  { path: "diff.background.removed", label: "Removido (fundo)", group: "Diffs" },
  { path: "diff.highlight.added", label: "Realce adicionado", group: "Diffs" },
  { path: "diff.highlight.removed", label: "Realce removido", group: "Diffs" },

  { path: "syntax.comment", label: "Comentário", group: "Sintaxe" },
  { path: "syntax.keyword", label: "Palavra-chave", group: "Sintaxe" },
  { path: "syntax.function", label: "Função", group: "Sintaxe" },
  { path: "syntax.string", label: "String", group: "Sintaxe" },
  { path: "syntax.number", label: "Número", group: "Sintaxe" },
  { path: "syntax.type", label: "Tipo", group: "Sintaxe" },

  { path: "markdown.heading", label: "Título", group: "Markdown" },
  { path: "markdown.link", label: "Link", group: "Markdown" },
  { path: "markdown.code", label: "Código", group: "Markdown" },
]

const ALLOWED_PATHS = new Set(THEME_COLORS.map(color => color.path))
const SNAPSHOT_GROUPS = ["text", "background", "border", "scrollbar", "diff", "syntax", "markdown", "@dialog"]

function isObject(value: Json | undefined): value is JsonObject {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

let templateCache: JsonObject | null = null

/** Template V2 completo do tema opencode; sempre devolve uma cópia. */
export async function themeTemplate(): Promise<JsonObject> {
  if (templateCache) return clone(templateCache)
  const file = path.join(pluginRoot, "assets", "theme-opencode.json")
  const parsed = JSON.parse((await readFile(file, "utf8")).replace(/^\uFEFF/, "")) as Json
  if (!isObject(parsed) || !isObject(parsed.base)) throw new Error("template de tema inválido")
  templateCache = parsed
  return clone(parsed)
}

export function themePath(name: string): string {
  return path.join(themesDir(), `${name}.json`)
}

export async function readThemeFile(name: string): Promise<string | null> {
  try {
    return await readFile(themePath(name), "utf8")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null
    throw error
  }
}

export async function writeThemeFile(name: string, theme: JsonObject): Promise<void> {
  await writeFileAtomic(themePath(name), JSON.stringify(theme, null, 2) + "\n")
}

export async function deleteThemeFile(name: string): Promise<void> {
  try {
    await unlink(themePath(name))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
  }
}

export function themeNameError(name: string): string {
  const value = name.trim()
  if (!value) return "Escolha um nome para o tema."
  if (value.length > 64) return "O nome do tema é longo demais."
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value)) {
    return "Use letras, números, ponto, hífen ou sublinhado; comece com letra ou número."
  }
  if (value.toLowerCase() === "system") return "\"system\" é reservado do OpenCode."
  if (BUILTIN_THEMES.includes(value.toLowerCase())) return `"${value}" é um tema embutido; escolha outro nome.`
  return ""
}

export function nextThemeName(taken: string[]): string {
  const used = new Set(taken.map(name => name.toLowerCase()))
  const base = "meu-tema"
  let candidate = base
  let index = 1
  while (used.has(candidate.toLowerCase()) || themeNameError(candidate) !== "") {
    index++
    candidate = `${base}-${index}`
  }
  return candidate
}

export function validateTheme(theme: Json | undefined): string {
  if (!isObject(theme)) return "O tema precisa ser um objeto JSON."
  if (!isObject(theme.base)) return "O tema precisa ter um objeto \"base\"."
  if (!isObject(theme.light) && !isObject(theme.dark)) return "O tema precisa ter \"light\" ou \"dark\"."
  for (const mode of ["light", "dark"] as const) {
    const value = theme[mode]
    if (!isObject(value)) continue
    if (!isObject(value.hue)) return `O modo ${mode} precisa ter um objeto "hue".`
  }
  return ""
}

export function isV2Theme(theme: Json | undefined): theme is JsonObject {
  return validateTheme(theme) === ""
}

export async function loadThemeJson(name: string): Promise<{ theme?: JsonObject; error: string }> {
  const nameError = themeNameError(name)
  if (nameError) return { error: nameError }
  const text = await readThemeFile(name)
  if (text === null) return { error: `O tema "${name}" não existe em ${themesDir()}.` }
  let parsed: Json
  try {
    parsed = JSON.parse(text.replace(/^\uFEFF/, "")) as Json
  } catch {
    return { error: `O tema "${name}" não é um JSON válido.` }
  }
  if (!isV2Theme(parsed)) {
    if (isObject(parsed) && isObject(parsed.theme) && !isObject(parsed.base)) {
      return { error: `O tema "${name}" está no formato antigo (V1); esta janela só edita temas V2. Crie um tema novo.` }
    }
    return { error: `O tema "${name}" é inválido: ${validateTheme(parsed)}` }
  }
  return { theme: parsed, error: "" }
}

export function normalizeHex(value: string): string | null {
  const text = value.trim().replace(/^#/, "")
  if (!/^[0-9a-fA-F]+$/.test(text)) return null
  if (text.length === 3) return ("#" + text.split("").map(char => char + char).join("")).toUpperCase()
  if (text.length === 4) return ("#" + text.split("").map(char => char + char).join("")).toUpperCase()
  if (text.length === 6) return ("#" + text).toUpperCase()
  if (text.length === 8) return ("#" + text).toUpperCase()
  return null
}

function mergeDeep(base: Json | undefined, override: Json | undefined): Json | undefined {
  if (isObject(base) && isObject(override)) {
    const out: JsonObject = { ...base }
    for (const [key, value] of Object.entries(override)) {
      out[key] = mergeDeep(base[key], value) as Json
    }
    return out
  }
  return override === undefined ? base : override
}

function mergedMode(theme: JsonObject, mode: ThemeMode): JsonObject {
  const base = isObject(theme.base) ? theme.base : {}
  const current = isObject(theme[mode]) ? (theme[mode] as JsonObject) : {}
  return mergeDeep(base, current) as JsonObject
}

function resolveHue(theme: JsonObject, mode: ThemeMode, name: string, step: string | undefined, seen: Set<string>): string {
  const key = `${name}.${step ?? ""}`
  if (seen.has(key)) return ""
  seen.add(key)
  const hue = getPath(theme, [mode, "hue", name])
  if (typeof hue === "string") {
    if (hue.startsWith("$hue.")) {
      const parts = hue.slice(5).split(".")
      const alias = parts[0]
      const aliasStep = parts[1] ?? step
      if (!alias) return ""
      return resolveHue(theme, mode, alias, aliasStep, seen)
    }
    return normalizeHex(hue) ?? ""
  }
  if (!isObject(hue) || !step) return ""
  const value = hue[step]
  if (typeof value !== "string") return ""
  if (value.startsWith("$hue.")) {
    const parts = value.slice(5).split(".")
    const alias = parts[0]
    const aliasStep = parts[1] ?? step
    if (!alias) return ""
    return resolveHue(theme, mode, alias, aliasStep, seen)
  }
  return normalizeHex(value) ?? ""
}

/** Resolve um token de cor do tema para #RRGGBB (ou "" para transparente/desconhecido). */
export function resolveColor(value: Json | undefined, theme: JsonObject, mode: ThemeMode, seen = new Set<string>()): string {
  if (typeof value !== "string") return ""
  const text = value.trim()
  if (!text || text === "transparent" || text === "none") return ""
  const hex = normalizeHex(text)
  if (hex) return hex
  if (text.startsWith("$hue.")) {
    const parts = text.slice(5).split(".")
    const name = parts[0]
    const step = parts[1]
    if (!name) return ""
    return resolveHue(theme, mode, name, step, seen)
  }
  if (text.startsWith("$")) {
    const key = text.slice(1)
    if (seen.has(key)) return ""
    seen.add(key)
    const merged = mergedMode(theme, mode)
    return resolveColor(getPath(merged, key.split(".")), theme, mode, seen)
  }
  return ""
}

export function themePalette(theme: JsonObject, template: JsonObject, mode: ThemeMode): ThemeColorRow[] {
  const merged = mergedMode(theme, mode)
  const templateMerged = mergedMode(template, mode)
  return THEME_COLORS.map(definition => {
    const value = resolveColor(getPath(merged, definition.path.split(".")), theme, mode)
    const fallback = resolveColor(getPath(templateMerged, definition.path.split(".")), template, mode)
    return {
      ...definition,
      value: value || fallback || "#000000",
      default: fallback || value || "#000000",
    }
  })
}

export function themePaletteAll(theme: JsonObject, template: JsonObject): ThemePalette {
  return {
    light: themePalette(theme, template, "light"),
    dark: themePalette(theme, template, "dark"),
  }
}

export function themeDraftState(
  theme: JsonObject,
  template: JsonObject,
  name: string,
  originalName: string | null,
  source: "new" | "existing",
): ThemeDraftState {
  return { name, originalName, source, palette: themePaletteAll(theme, template) }
}

function ensureMode(theme: JsonObject, mode: ThemeMode): JsonObject {
  const current = theme[mode]
  if (isObject(current)) return current
  const next: JsonObject = {}
  theme[mode] = next
  return next
}

export function applyThemeColors(theme: JsonObject, colors: ThemeColorInput[]): string {
  for (const color of colors) {
    if (!color || typeof color !== "object" || typeof color.path !== "string" || typeof color.value !== "string") {
      return "Cor inválida."
    }
    if (color.mode !== "light" && color.mode !== "dark") return "Modo de tema inválido."
    if (!ALLOWED_PATHS.has(color.path)) return `Cor desconhecida: ${color.path}.`
    const text = color.value.trim()
    const target = ensureMode(theme, color.mode)
    if (text === "") {
      setPath(target, color.path.split("."), undefined)
      continue
    }
    const value = text.toLowerCase() === "transparent" ? "transparent" : normalizeHex(text)
    if (!value) return `Cor inválida em ${color.path}: ${color.value}.`
    setPath(target, color.path.split("."), value)
  }
  return ""
}

function sanitize(value: Json): Json | undefined {
  if (typeof value === "string") return value
  if (isObject(value)) {
    if (typeof value.r === "number" && typeof value.g === "number" && typeof value.b === "number") {
      const byte = (input: number) => Math.max(0, Math.min(255, Math.round(input))).toString(16).padStart(2, "0")
      const alpha = typeof value.a === "number" ? value.a : 255
      return `#${byte(value.r)}${byte(value.g)}${byte(value.b)}${alpha < 255 ? byte(alpha) : ""}`.toUpperCase()
    }
    const out: JsonObject = {}
    for (const [key, item] of Object.entries(value)) {
      const clean = sanitize(item as Json)
      if (clean !== undefined) out[key] = clean
    }
    return out
  }
  return undefined
}

/** Aplica o tema resolvido do TUI no modo em que a janela foi aberta. */
export function applyThemeSnapshot(theme: JsonObject, snapshot: ThemeSnapshot | null): void {
  if (!snapshot) return
  if (snapshot.mode !== "light" && snapshot.mode !== "dark") return
  if (!isObject(snapshot.tokens)) return
  const target = ensureMode(theme, snapshot.mode)
  for (const group of SNAPSHOT_GROUPS) {
    const value = snapshot.tokens[group]
    if (!isObject(value)) continue
    const clean = sanitize(value)
    if (isObject(clean)) target[group] = mergeDeep(target[group], clean) as Json
  }
}

export function newThemeFromSnapshot(template: JsonObject, snapshot: ThemeSnapshot | null): JsonObject {
  const theme = clone(template)
  theme.$schema = "https://opencode.ai/theme.json"
  applyThemeSnapshot(theme, snapshot)
  return theme
}

export function themeJsonText(theme: JsonObject): string {
  return JSON.stringify(theme, null, 2)
}
