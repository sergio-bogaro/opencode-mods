import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process"
import { randomUUID } from "node:crypto"
import { readFile, rm } from "node:fs/promises"
import path from "node:path"
import type { Plugin } from "@opencode/plugin"
import { ModsRpc } from "../../rpc"
import { cliConfigPath, customizeDir, ensureDir, scriptPath, themesDir, withFileLock, writeFileAtomic } from "../shared/paths"
import {
  configRows,
  customThemeNames,
  getPath,
  readCli,
  restoreCli,
  setCliValue,
  type Json,
  type JsonObject,
  type Originals as CliOriginals,
} from "./cli-config"
import {
  applyThemeColors,
  deleteThemeFile,
  loadThemeJson,
  newThemeFromSnapshot,
  nextThemeName,
  readThemeFile,
  themeDraftState,
  themeJsonText,
  themeNameError,
  themePalette,
  themePath,
  themeTemplate,
  validateTheme,
  writeThemeFile,
  type ThemeColorInput,
  type ThemeColorRow,
  type ThemeJsonState,
  type ThemeMode,
  type ThemeSnapshot,
} from "./theme"

type Context = Plugin.Context
type Stream = ChildProcessWithoutNullStreams

type ThemeOriginal = { content?: string; absent?: true }
type Originals = {
  config: CliOriginals
  themes: Record<string, ThemeOriginal>
}

type WindowCommand =
  | { cmd: "config"; key: string; value: string | boolean | number }
  | { cmd: "restore" }
  | { cmd: "theme-new" }
  | { cmd: "theme-edit"; name: string }
  | { cmd: "theme-save"; name: string; colors?: ThemeColorInput[] }
  | { cmd: "theme-json-get" }
  | { cmd: "theme-json"; json: Json }
  | { cmd: "theme-delete"; name: string }
  | { cmd: "refresh" }

type Registration = {
  dispose: () => Promise<void>
}

type OpenInput = {
  theme?: { mode?: string; tokens?: JsonObject }
}

let win: Stream | null = null
let registration: Registration | undefined

let snapshot: ThemeSnapshot | null = null
let activePalette: { mode: ThemeMode; palette: ThemeColorRow[] } | null = null
let draft: JsonObject | null = null
let draftName = ""
let draftOriginalName: string | null = null
let draftSource: "new" | "existing" = "new"
let draftRevision = 0
let draftJson = ""

const stateName = `state-${process.pid}-${randomUUID().slice(0, 8)}.json`
const customizeLock = "customize.lock"

function dataDir(): string {
  return customizeDir()
}

function statePath(): string {
  return path.join(dataDir(), stateName)
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse((await readFile(file, "utf8")).replace(/^\uFEFF/, "")) as T
  } catch {
    return fallback
  }
}

async function readOriginals(): Promise<Originals> {
  const originals = await readJson<{ config?: CliOriginals; themes?: Record<string, ThemeOriginal> }>(
    path.join(dataDir(), "original.json"),
    {},
  )
  return { config: originals.config ?? {}, themes: originals.themes ?? {} }
}

async function writeOriginals(originals: Originals): Promise<void> {
  await writeFileAtomic(path.join(dataDir(), "original.json"), JSON.stringify(originals, null, 2))
}

function changedCount(originals: Originals): number {
  return Object.keys(originals.config).length + Object.keys(originals.themes).length
}

function touchDraft(): void {
  if (!draft) return
  draftRevision++
  draftJson = themeJsonText(draft)
}

function setDraft(theme: JsonObject, name: string, originalName: string | null, source: "new" | "existing"): void {
  draft = theme
  draftName = name
  draftOriginalName = originalName
  draftSource = source
  touchDraft()
}

function acceptSnapshot(input: OpenInput): boolean {
  const theme = input?.theme
  if (
    theme &&
    (theme.mode === "light" || theme.mode === "dark") &&
    theme.tokens &&
    typeof theme.tokens === "object" &&
    !Array.isArray(theme.tokens)
  ) {
    snapshot = { mode: theme.mode, tokens: theme.tokens }
    return true
  }
  return false
}

async function refreshActivePalette(): Promise<void> {
  if (!snapshot) {
    activePalette = null
    return
  }
  const template = await themeTemplate()
  const theme = newThemeFromSnapshot(template, snapshot)
  activePalette = { mode: snapshot.mode, palette: themePalette(theme, template, snapshot.mode) }
}

async function updateTheme(input: OpenInput): Promise<void> {
  if (!acceptSnapshot(input)) return
  await refreshActivePalette()
  if (win || draft) await publish()
}

async function startNewDraft(): Promise<void> {
  const template = await themeTemplate()
  const theme = newThemeFromSnapshot(template, snapshot)
  const name = nextThemeName(await customThemeNames())
  setDraft(theme, name, null, "new")
}

async function editDraft(name: string): Promise<string> {
  const result = await loadThemeJson(name)
  if (result.error || !result.theme) return result.error
  setDraft(result.theme, name, name, "existing")
  return ""
}

async function publishUnlocked(message = ""): Promise<void> {
  await ensureDir(dataDir())
  const config = await configRows()
  const themes = await customThemeNames()
  const template = await themeTemplate()
  const themeDraft = draft ? themeDraftState(draft, template, draftName, draftOriginalName, draftSource) : null
  const themeJson: ThemeJsonState | null = draft ? { revision: draftRevision, text: draftJson } : null
  const originals = await readOriginals()
  const state = {
    error: config.error,
    message,
    config: config.rows,
    themes,
    themeDraft,
    themeJson,
    activeTheme: activePalette,
    configPath: cliConfigPath(),
    themesDir: themesDir(),
    snapshotMode: snapshot?.mode ?? null,
    changed: changedCount(originals),
  }
  await writeFileAtomic(statePath(), JSON.stringify(state))
}

async function publish(message = ""): Promise<void> {
  return withFileLock(customizeLock, () => publishUnlocked(message))
}

async function setConfigUnlocked(key: string, value: string | boolean | number): Promise<string> {
  const rows = await configRows()
  if (rows.error) return rows.error
  if (!rows.rows.some(row => row.key === key)) return `Configuração ${key} não existe.`
  const originals = await readOriginals()
  if (!(key in originals.config)) {
    const cli = await readCli()
    const before = getPath(cli, key.split("."))
    originals.config[key] = before === undefined ? { absent: true } : { value: before }
    await writeOriginals(originals)
    const error = await setCliValue(key, value)
    if (error) {
      delete originals.config[key]
      await writeOriginals(originals)
    }
    return error
  }
  return setCliValue(key, value)
}

async function setConfig(key: string, value: string | boolean | number): Promise<string> {
  return withFileLock(customizeLock, () => setConfigUnlocked(key, value))
}

async function restoreUnlocked(): Promise<string> {
  const originals = await readOriginals()
  const remaining: Originals = { config: {}, themes: {} }
  let count = 0
  const errors: string[] = []
  for (const [name, original] of Object.entries(originals.themes)) {
    try {
      if (original.absent) {
        await deleteThemeFile(name)
      } else if (original.content !== undefined) {
        await writeFileAtomic(themePath(name), original.content)
      }
      count++
    } catch (error) {
      errors.push(`${name}: ${String(error)}`)
      remaining.themes[name] = original
    }
  }
  if (Object.keys(originals.config).length > 0) {
    try {
      count += await restoreCli(originals.config)
    } catch (error) {
      errors.push(`cli.json: ${String(error)}`)
      remaining.config = originals.config
    }
  }
  await writeOriginals(remaining)
  await startNewDraft()
  const base = count ? `Padrão restaurado (${count} ${count === 1 ? "ajuste" : "ajustes"}).` : "Nada para restaurar."
  return errors.length ? `${base} Falhas: ${errors.join("; ")}` : base
}

async function restore(): Promise<string> {
  return withFileLock(customizeLock, restoreUnlocked)
}

async function saveDraftUnlocked(name: string, colors: ThemeColorInput[]): Promise<string> {
  if (!draft) return "Nenhum tema em edição."
  const cleanName = name.trim()
  const nameError = themeNameError(cleanName)
  if (nameError) return nameError
  const existing = await readThemeFile(cleanName)
  const same = draftOriginalName !== null && cleanName === draftOriginalName
  if (!same && existing !== null) return `Já existe um tema chamado "${cleanName}".`
  const originals = await readOriginals()
  if (!(cleanName in originals.themes)) {
    originals.themes[cleanName] = existing === null ? { absent: true } : { content: existing }
  }
  const next = structuredClone(draft)
  const colorError = applyThemeColors(next, colors)
  if (colorError) return colorError
  const validation = validateTheme(next)
  if (validation) return validation

  await writeOriginals(originals)
  await writeThemeFile(cleanName, next)
  draft = next
  touchDraft()
  draftName = cleanName
  draftOriginalName = cleanName
  draftSource = "existing"
  const configError = await setConfigUnlocked("theme.name", cleanName)
  const message = `Tema "${cleanName}" salvo e aplicado.`
  return configError ? `${message} Mas o theme.name não mudou: ${configError}` : message
}

async function saveDraft(name: string, colors: ThemeColorInput[]): Promise<string> {
  return withFileLock(customizeLock, () => saveDraftUnlocked(name, colors))
}

async function applyJson(json: Json): Promise<string> {
  const error = validateTheme(json)
  if (error) return error
  const theme = json as JsonObject
  theme.$schema ??= "https://opencode.ai/theme.json"
  setDraft(theme, draftName, draftOriginalName, draftSource)
  return "JSON aplicado ao rascunho."
}

async function deleteDraftUnlocked(name: string): Promise<string> {
  const clean = name.trim()
  const nameError = themeNameError(clean)
  if (nameError) return nameError
  const content = await readThemeFile(clean)
  if (content === null) return `O tema "${clean}" não existe.`
  const originals = await readOriginals()
  if (!(clean in originals.themes)) originals.themes[clean] = { content }
  await writeOriginals(originals)
  await deleteThemeFile(clean)
  let message = `Tema "${clean}" removido.`
  const rows = await configRows()
  const active = rows.rows.find(row => row.key === "theme.name")
  if (active && String(active.value) === clean) {
    const configError = await setConfigUnlocked("theme.name", "opencode")
    if (configError) message += ` Mas o theme.name não mudou: ${configError}`
    else message += " O tema ativo voltou para opencode."
  }
  await startNewDraft()
  return message
}

async function deleteDraft(name: string): Promise<string> {
  return withFileLock(customizeLock, () => deleteDraftUnlocked(name))
}

async function handle(line: string): Promise<void> {
  let command: WindowCommand
  try {
    command = JSON.parse(line) as WindowCommand
  } catch {
    return
  }
  let message = ""
  try {
    if (command.cmd === "config") message = await setConfig(String(command.key), command.value)
    else if (command.cmd === "restore") message = await restore()
    else if (command.cmd === "theme-new") {
      await startNewDraft()
      message = "Novo tema criado a partir do tema atual."
    } else if (command.cmd === "theme-edit") message = await editDraft(String(command.name))
    else if (command.cmd === "theme-save") {
      const rawColors = command.colors as unknown
      const colors = Array.isArray(rawColors) ? (rawColors as ThemeColorInput[]) : rawColors ? [rawColors as ThemeColorInput] : []
      message = await saveDraft(String(command.name), colors)
    } else if (command.cmd === "theme-json-get") {
      if (draft) {
        touchDraft()
        message = "JSON atualizado."
      }
    } else if (command.cmd === "theme-json") message = await applyJson(command.json)
    else if (command.cmd === "theme-delete") message = await deleteDraft(String(command.name))
    else if (command.cmd === "refresh") message = ""
  } catch (error) {
    message = `Não deu certo: ${String(error)}`
  }
  await publish(message)
}

function pump(stream: Stream): void {
  let buffer = ""
  let chain = Promise.resolve()
  stream.stdout.setEncoding("utf8")
  stream.stdout.on("data", (chunk: string) => {
    buffer += chunk
    let at = buffer.indexOf("\n")
    while (at >= 0) {
      const line = buffer.slice(0, at).trim()
      buffer = buffer.slice(at + 1)
      if (line.startsWith("{")) chain = chain.then(() => handle(line)).catch(() => undefined)
      at = buffer.indexOf("\n")
    }
  })
  stream.stderr.setEncoding("utf8")
  stream.stderr.on("data", (chunk: string) => {
    const text = chunk.trim()
    if (text) console.error("opencode-mods: customize-opencode (stderr):", text.slice(0, 2000))
  })
  stream.on("error", (error: Error) => {
    if (win === stream) win = null
    console.error("opencode-mods: customize-opencode falhou:", error)
  })
  stream.on("close", (code: number | null) => {
    if (win === stream) win = null
    if (code && code !== 0) console.error(`opencode-mods: customize-opencode terminou com código ${code}`)
  })
}

async function openWindow(input: OpenInput): Promise<string> {
  if (process.platform !== "win32") return "A customização visual está disponível apenas no Windows."
  if (win) {
    await publish()
    return "A janela de customização já está aberta."
  }
  acceptSnapshot(input)
  await refreshActivePalette()
  await startNewDraft()
  await publish()
  const child = spawn(
    "powershell",
    [
      "-NoProfile",
      "-STA",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      scriptPath("scripts", "customize", "window.ps1"),
      statePath(),
    ],
    { windowsHide: true },
  )
  const spawnError = await new Promise<Error | undefined>(resolve => {
    let settled = false
    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      resolve(error)
    }
    child.once("error", finish)
    setTimeout(() => finish(), 100)
  })
  if (spawnError) {
    child.kill()
    throw new Error(`não consegui abrir a janela: ${String(spawnError)}`)
  }
  win = child
  pump(child)
  return "Janela de customização aberta."
}

export async function setupCustomize(ctx: Context): Promise<() => Promise<void>> {
  registration = await ctx.rpc.register(ModsRpc, {
    openCustomize: async input => ({
      text: await openWindow((input ?? {}) as OpenInput),
    }),
    customizeTheme: async input => {
      await updateTheme((input ?? {}) as OpenInput)
      return {}
    },
  })

  return async () => {
    win?.kill()
    win = null
    await registration?.dispose()
    registration = undefined
    await rm(statePath(), { force: true }).catch(() => undefined)
  }
}
