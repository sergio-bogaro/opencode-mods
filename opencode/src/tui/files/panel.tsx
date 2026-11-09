import type { CommandInfo } from "@opencode/client"
import { SyntaxStyle, TextAttributes, type KeyEvent, type ScrollBoxRenderable } from "@opentui/core"
import { usePlugin } from "@opencode/plugin/tui"
import type { PanelInput } from "@opencode/plugin/tui/context"
import { createEffect, createMemo, createSignal, For, on, onCleanup, onMount, Show } from "solid-js"
import { duration, fit, money, normalizePath, oneLine, plural, tokens } from "../../shared/format"
import { isHiddenCommand, LOCAL_COMMANDS, nextTab, PANEL, TABS } from "../constants"
import { consumeFocusRequest, requestedTab, setRequestedTab } from "../request"
import { themeSignature } from "../theme-snapshot"
import { openCustomize, clearTimeline as clearTimelineAction, wipeData } from "./actions"
import { setTotalsFor } from "./cache"
import { loadAll, sessionLocation } from "./data"
import { availableModels, buildPrompt, currentModel, explainTitle, generateExplanation, variantsFor } from "./explain"
import { revertFile, revertQuestion } from "./revert"
import { filesStore, prefsFor, updatePrefs } from "./store"
import { DEFAULT_EXPLANATION, type Explanation, type QuestionRow, type Scope, type Tab } from "./types"

const REFRESH_EVENTS = new Set([
  "session.execution.started",
  "session.execution.succeeded",
  "session.execution.failed",
  "session.execution.interrupted",
  "session.tool.success",
  "session.tool.failed",
  "session.message.content.updated",
  "session.compaction.ended",
  "session.idle",
  "session.usage.updated",
  "session.usage.recorded",
  "session.model.selected",
  "session.revert.staged",
  "session.revert.committed",
  "session.revert.cleared",
])

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function statusMark(status: QuestionRow["status"]): string {
  if (status === "running") return "◌ "
  if (status === "error") return "✗ "
  if (status === "aborted") return "■ "
  return ""
}

function scopeLabel(scope: Scope): string {
  return scope === "turn" ? "esta pergunta" : "sessão toda"
}

export function FilesPanel(props: { panel: PanelInput }) {
  const ctx = usePlugin()
  const focusOnMount = consumeFocusRequest(ctx, props.panel.sessionID)
  const store = filesStore()
  const prefs = createMemo(() => prefsFor(store[0], props.panel.sessionID))
  const scope = createMemo(() => prefs().scope)
  const tab = createMemo(() => prefs().tab)
  const selected = createMemo(() => new Set(prefs().selected.map(normalizePath)))
  const explanation = createMemo(() => prefs().explain)

  const [loaded, setLoaded] = createSignal<Awaited<ReturnType<typeof loadAll>> | null>(null)
  const [error, setError] = createSignal("")
  const [notice, setNotice] = createSignal("")
  const [busy, setBusy] = createSignal(false)
  const [fileIndex, setFileIndex] = createSignal(0)
  const [questionIndex, setQuestionIndex] = createSignal(0)
  const [commandIndex, setCommandIndex] = createSignal(0)
  const [expanded, setExpanded] = createSignal<string | null>(null)
  const [commands, setCommands] = createSignal<CommandInfo[]>([])
  const [dialogOpen, setDialogOpen] = createSignal(false)
  const [hoveredTab, setHoveredTab] = createSignal<Tab | null>(null)
  const [pressedTab, setPressedTab] = createSignal<Tab | null>(null)
  const [noticeVariant, setNoticeVariant] = createSignal<"info" | "success" | "warning" | "error">("info")

  const files = createMemo(() => loaded()?.diff.files ?? [])
  const timeline = createMemo(() => loaded()?.timeline ?? { questions: [], compacts: 0, totalCost: 0, costEstimated: false, totalTime: 0, totalTools: 0 })
  const visibleQuestions = createMemo(() => [...timeline().questions].reverse())
  const currentFile = createMemo(() => files()[fileIndex()])
  const currentQuestion = createMemo(() => visibleQuestions()[questionIndex()])
  const selectedRows = createMemo(() => files().filter(row => selected().has(normalizePath(row.file))))

  const localCommands = createMemo(() =>
    LOCAL_COMMANDS.filter(command => !isHiddenCommand(command.name)).map(command => ({ ...command, local: true })),
  )
  const allCommands = createMemo(() => {
    const localNames = new Set(LOCAL_COMMANDS.map(command => command.name))
    return [
      ...localCommands(),
      ...commands()
        .filter(command => !localNames.has(command.name) && !isHiddenCommand(command.name))
        .map(command => ({ ...command, local: false })),
    ]
  })

  const [themeTick, setThemeTick] = createSignal(0)
  const theme = () => {
    themeTick()
    return ctx.theme
  }
  const colors = createMemo(() => {
    themeTick()
    const t = ctx.theme
    return {
      primary: t.text.action.primary.base,
      secondary: t.text.muted,
      dim: t.text.faint,
      inserted: t.diff.text.added,
      erased: t.diff.text.removed,
      warn: t.text.feedback.warning.base,
      ok: t.text.feedback.success.base,
      fail: t.text.feedback.error.base,
      base: t.text.base,
      active: props.panel.focused ? t.background.raised.high : t.background.raised.base,
    }
  })
  const currentBg = () => colors().active
  const width = () => Math.max(40, props.panel.width || 80)
  const noticeColor = () => {
    const variant = noticeVariant()
    if (variant === "error") return colors().fail
    if (variant === "warning") return colors().warn
    if (variant === "success") return colors().ok
    return colors().base
  }

  const syntax = createMemo(() =>
    SyntaxStyle.fromTheme(
      [
        { scope: ["default"], style: { foreground: theme().text.base } },
        { scope: ["comment"], style: { foreground: theme().syntax.comment } },
        { scope: ["keyword"], style: { foreground: theme().syntax.keyword } },
        { scope: ["function"], style: { foreground: theme().syntax.function } },
        { scope: ["string"], style: { foreground: theme().syntax.string } },
        { scope: ["number"], style: { foreground: theme().syntax.number } },
        { scope: ["type"], style: { foreground: theme().syntax.type } },
      ],
      ctx.renderer.nativeScene,
    ),
  )
  createEffect(
    on(syntax, (style, previous) => {
      if (previous) void ctx.renderer.idle().then(() => previous.destroy())
    }),
  )
  onCleanup(() => {
    const style = syntax()
    void ctx.renderer.idle().then(() => style.destroy())
  })

  let filesScroll: ScrollBoxRenderable | undefined
  let timelineScroll: ScrollBoxRenderable | undefined
  let commandsScroll: ScrollBoxRenderable | undefined
  let noticeTimer: ReturnType<typeof setTimeout> | undefined
  let themeTimer: ReturnType<typeof setInterval> | undefined
  let lastThemeSignature = ""
  let refreshToken = 0
  let explainToken = 0

  function themeSignatureNow(): string {
    try {
      return themeSignature(ctx.themeMode, ctx.theme)
    } catch {
      return ""
    }
  }

  function notify(text: string, variant: "info" | "success" | "warning" | "error" = "info"): void {
    setNotice(text)
    setNoticeVariant(variant)
    ctx.ui.toast.show({ message: text, variant })
    if (noticeTimer) clearTimeout(noticeTimer)
    noticeTimer = setTimeout(() => setNotice(""), 5000)
  }

  function notifyFor(
    sessionID: string,
    text: string,
    variant: "info" | "success" | "warning" | "error" = "info",
  ): void {
    if (props.panel.sessionID === sessionID) notify(text, variant)
    else ctx.ui.toast.show({ message: text, variant, sessionID })
  }

  async function withDialog<T>(open: () => Promise<T>): Promise<T> {
    setDialogOpen(true)
    try {
      return await open()
    } finally {
      setDialogOpen(false)
      if (ctx.ui.panel.current()?.name === PANEL) props.panel.focus()
    }
  }

  async function refresh(): Promise<void> {
    const id = props.panel.sessionID
    const token = ++refreshToken
    setBusy(true)
    setError("")
    try {
      const previousFileIndex = fileIndex()
      const previousFile = loaded()?.diff.files[previousFileIndex]?.file
      const previousQuestionIndex = questionIndex()
      const previousQuestion = previousQuestionIndex > 0 ? currentQuestion()?.id : undefined
      const data = await loadAll(ctx, id, scope(), prefs().cutoff)
      if (id !== props.panel.sessionID || token !== refreshToken) return
      setLoaded(data)
      setTotalsFor(id, scope(), data.diff.totals)
      const fileAt = previousFile ? data.diff.files.findIndex(row => row.file === previousFile) : -1
      setFileIndex(index => {
        if (index !== previousFileIndex) return clamp(index, 0, Math.max(0, data.diff.files.length - 1))
        return fileAt >= 0 ? fileAt : clamp(index, 0, Math.max(0, data.diff.files.length - 1))
      })
      const questions = [...data.timeline.questions].reverse()
      const questionAt = previousQuestion ? questions.findIndex(question => question.id === previousQuestion) : -1
      setQuestionIndex(index => {
        if (index !== previousQuestionIndex) return clamp(index, 0, Math.max(0, data.timeline.questions.length - 1))
        return questionAt >= 0 ? questionAt : clamp(index, 0, Math.max(0, data.timeline.questions.length - 1))
      })
    } catch (failure) {
      if (id === props.panel.sessionID && token === refreshToken) {
        setError(`Não consegui carregar os arquivos: ${String(failure)}`)
      }
    } finally {
      if (id === props.panel.sessionID && token === refreshToken) setBusy(false)
    }
  }

  async function refreshCommands(sessionID = props.panel.sessionID): Promise<void> {
    try {
      const location = sessionLocation(ctx, sessionID)
      await ctx.data.location.command.sync(location)
      if (sessionID !== props.panel.sessionID) return
      setCommands(ctx.data.location.command.list(location) ?? [])
    } catch {
      if (sessionID === props.panel.sessionID) setCommands([])
    }
  }

  function setTab(next: Tab): void {
    void updatePrefs(props.panel.sessionID, current => {
      current.tab = next
    })
  }

  function cycleTab(delta: number): void {
    setTab(nextTab(tab(), delta))
  }

  function toggleScope(): void {
    void updatePrefs(props.panel.sessionID, current => {
      current.scope = current.scope === "turn" ? "session" : "turn"
    })
  }

  function move(delta: number): void {
    if (tab() === "files") setFileIndex(index => clamp(index + delta, 0, Math.max(0, files().length - 1)))
    else if (tab() === "timeline")
      setQuestionIndex(index => clamp(index + delta, 0, Math.max(0, visibleQuestions().length - 1)))
    else if (tab() === "commands") setCommandIndex(index => clamp(index + delta, 0, Math.max(0, allCommands().length - 1)))
  }

  function toggleSelected(row: { file: string } | undefined): void {
    if (!row) return
    const key = normalizePath(row.file)
    void updatePrefs(props.panel.sessionID, current => {
      current.selected = current.selected.map(normalizePath).includes(key)
        ? current.selected.filter(item => normalizePath(item) !== key)
        : [...current.selected, key]
    })
  }

  function selectAll(): void {
    void updatePrefs(props.panel.sessionID, current => {
      current.selected = files().map(row => normalizePath(row.file))
    })
  }

  function selectNone(): void {
    void updatePrefs(props.panel.sessionID, current => {
      current.selected = []
    })
  }

  async function revertCurrentFile(): Promise<void> {
    const sessionID = props.panel.sessionID
    const row = currentFile()
    const selectedScope = scope()
    if (!row) return
    if (!row.canRevert) {
      notify("Este arquivo não tem diff reversível.", "warning")
      return
    }
    const ok = await withDialog(() =>
      ctx.ui.dialog.confirm({
        title: "Desfazer arquivo",
        message: `Desfazer as alterações de ${row.name} ${scopeLabel(selectedScope)}?`,
        label: { confirm: "Desfazer", cancel: "Cancelar" },
      }),
    )
    if (!ok) return
    const result = await revertFile(ctx, sessionID, row)
    notifyFor(sessionID, result.text, result.ok ? "success" : "error")
    if (result.ok) {
      await updatePrefs(sessionID, current => {
        current.selected = current.selected.filter(item => normalizePath(item) !== normalizePath(row.file))
      })
      if (props.panel.sessionID === sessionID) await refresh()
    }
  }

  async function revertCurrentQuestion(): Promise<void> {
    const sessionID = props.panel.sessionID
    const selectedScope = scope()
    const selected = tab() === "timeline" ? currentQuestion() : undefined
    const targetID = selectedScope === "turn" && selected && selected.n > 0 ? selected.id : undefined
    const target = targetID ? `a pergunta #${selected!.n}` : "a última pergunta"
    const ok = await withDialog(() =>
      ctx.ui.dialog.confirm({
        title: "Reverter pergunta",
        message:
          selectedScope === "turn"
            ? targetID
              ? `Reverter a partir da ${target}? Ela e as perguntas posteriores saem da conversa; os arquivos voltam ao estado anterior. Essa ação não pode ser desfeita facilmente.`
              : "Desfazer os arquivos e a conversa da última pergunta? Essa ação não pode ser desfeita facilmente."
            : "Voltar os arquivos e a conversa ao início da sessão? Essa ação não pode ser desfeita facilmente.",
        label: { confirm: "Reverter", cancel: "Cancelar" },
      }),
    )
    if (!ok) return
    const result = await revertQuestion(ctx, sessionID, selectedScope, targetID)
    notifyFor(sessionID, result.text, result.ok ? "success" : "error")
    if (result.ok && props.panel.sessionID === sessionID) await refresh()
  }

  async function clearTimeline(): Promise<void> {
    const sessionID = props.panel.sessionID
    const ok = await withDialog(() =>
      ctx.ui.dialog.confirm({
        title: "Limpar linha do tempo",
        message: "A aba Tempo fica vazia; a conversa não é apagada. Continuar?",
        label: { confirm: "Limpar", cancel: "Cancelar" },
      }),
    )
    if (!ok) return
    const done = await clearTimelineAction(ctx, sessionID)
    if (done === undefined) return
    notifyFor(
      sessionID,
      done ? "Linha do tempo limpa." : "Não há pergunta para esconder.",
      done ? "success" : "warning",
    )
    if (done && props.panel.sessionID === sessionID) await refresh()
  }

  async function wipeSessionData(): Promise<void> {
    const sessionID = props.panel.sessionID
    const ok = await withDialog(() =>
      ctx.ui.dialog.confirm({
        title: "Limpar dados",
        message:
          "Zera seleção, explicação e linha do tempo desta sessão. Os arquivos e o histórico do OpenCode não são tocados. Continuar?",
        label: { confirm: "Limpar", cancel: "Cancelar" },
      }),
    )
    if (!ok) return
    const done = await wipeData(ctx, sessionID)
    if (!done) return
    notifyFor(sessionID, "Estado do painel zerado.", "success")
    if (props.panel.sessionID !== sessionID) return
    setExpanded(null)
    await refresh()
  }

  async function explain(): Promise<void> {
    const sessionID = props.panel.sessionID
    const selectedScope = scope()
    const rows = selectedRows()
    if (rows.length === 0) {
      notify("Marque ao menos um arquivo na aba Arquivos.", "warning")
      setTab("files")
      return
    }
    const base = currentModel(ctx, sessionID, prefs().model)
    if (!base) {
      notify("Nenhum modelo disponível para explicar.", "error")
      return
    }
    const request = ++explainToken
    const variant = prefs().variant
    const model = { ...base, variant }
    const title = explainTitle(selectedScope, rows, base, variant)
    await updatePrefs(sessionID, current => {
      current.explain = { status: "running", title, text: "" }
    })
    if (props.panel.sessionID === sessionID) setTab("explain")
    try {
      const result = await generateExplanation(ctx, model, buildPrompt(selectedScope, rows))
      if (request !== explainToken) return
      await updatePrefs(sessionID, current => {
        current.explain = { status: "done", title, text: result.text }
      })
      notifyFor(sessionID, "Explicação pronta.", "success")
    } catch (failure) {
      if (request !== explainToken) return
      await updatePrefs(sessionID, current => {
        current.explain = { status: "error", title, text: `Não deu certo: ${String(failure)}` }
      })
      notifyFor(sessionID, "Não consegui gerar a explicação.", "error")
    }
  }

  async function pickModel(): Promise<void> {
    const sessionID = props.panel.sessionID
    const options = [
      { title: "Sessão (modelo atual)", value: "session", description: "Usa o modelo da conversa" },
      ...availableModels(ctx, sessionID).map(model => ({
        title: model.label,
        value: `${model.providerID}/${model.modelID}`,
      })),
    ]
    const value = await withDialog(() =>
      ctx.ui.dialog.select({ title: "Modelo para explicar", current: prefs().model, options }),
    )
    if (value) {
      await updatePrefs(sessionID, current => {
        current.model = value
        current.variant = undefined
      })
    }
  }

  async function pickVariant(): Promise<void> {
    const sessionID = props.panel.sessionID
    const base = currentModel(ctx, sessionID, prefs().model)
    const variants = variantsFor(ctx, sessionID, base)
    if (variants.length === 0) {
      notify("Este modelo não tem variantes.", "info")
      return
    }
    const value = await withDialog(() =>
      ctx.ui.dialog.select({
        title: "Variante do modelo",
        current: prefs().variant ?? "",
        options: [
          { title: "Padrão do modelo", value: "" },
          ...variants.map(variant => ({ title: variant, value: variant })),
        ],
      }),
    )
    if (value !== undefined) {
      await updatePrefs(sessionID, current => {
        current.variant = value || undefined
      })
    }
  }

  async function openCustomizeWindow(): Promise<void> {
    try {
      const text = await openCustomize(ctx, ctx.themeMode, ctx.theme)
      notify(text, "success")
    } catch (failure) {
      notify(`Não consegui abrir a customização: ${String(failure)}`, "error")
    }
  }

  async function runCommand(item: { name: string; local: boolean }): Promise<void> {
    if (item.local) {
      if (item.name === "limpar-linha-do-tempo") await clearTimeline()
      else if (item.name === "limpar-dados") await wipeSessionData()
      else if (item.name === "customize-opencode") await openCustomizeWindow()
      return
    }
    const sessionID = props.panel.sessionID
    try {
      await ctx.client.session.command({ sessionID, name: item.name, text: "" })
      notifyFor(sessionID, `/${item.name} enviado para a sessão.`, "success")
    } catch (failure) {
      notifyFor(sessionID, `/${item.name} falhou: ${String(failure)}`, "error")
    }
  }

  async function activate(): Promise<void> {
    if (tab() === "files") toggleSelected(currentFile())
    else if (tab() === "timeline") {
      const question = currentQuestion()
      if (question) setExpanded(expanded() === question.id ? null : question.id)
    } else if (tab() === "commands") {
      const item = allCommands()[commandIndex()]
      if (item) await runCommand(item)
    } else if (tab() === "explain") await explain()
  }

  function revertCurrent(): void {
    if (tab() === "files") void revertCurrentFile()
    else if (tab() === "timeline") void revertCurrentQuestion()
  }

  async function showHelp(): Promise<void> {
    await withDialog(() =>
      ctx.ui.dialog.alert({
        title: "Atalhos do painel",
        message:
          "1-4 abas · tab/shift+tab ou ←/→ trocar de aba\n" +
          "↑↓ navegar · espaço marcar/expandir · enter abrir/rodar\n" +
          "r desfazer arquivo · shift+r reverter pergunta · e explicar seleção\n" +
          "m modelo · v variante · t trocar escopo · a todos · n nenhum\n" +
          "f tela cheia · esc fechar · ? esta ajuda",
      }),
    )
  }

  createEffect(
    on(
      () => [props.panel.sessionID, scope(), prefs().cutoff] as const,
      ([sessionID], previous) => {
        const changedSession = previous !== undefined && previous[0] !== sessionID
        if (changedSession) {
          setLoaded(null)
          setError("")
          setNotice("")
          setExpanded(null)
          setFileIndex(0)
          setQuestionIndex(0)
          setCommandIndex(0)
          setCommands([])
          void refreshCommands(sessionID)
        } else if (previous === undefined) {
          void refreshCommands(sessionID)
        }
        void refresh()
      },
    ),
  )

  createEffect(() => {
    const wanted = requestedTab(ctx, props.panel.sessionID)
    if (!wanted) return
    setRequestedTab(ctx, props.panel.sessionID, null)
    // Se o painel já estava montado, o pedido de foco vale para este efeito.
    consumeFocusRequest(ctx, props.panel.sessionID)
    setTab(wanted)
    props.panel.focus()
  })

  createEffect(() => {
    const index = fileIndex()
    queueMicrotask(() => filesScroll?.scrollChildIntoView(`file-row-${index}`, { align: "nearest" }))
  })

  createEffect(() => {
    const index = questionIndex()
    queueMicrotask(() => timelineScroll?.scrollChildIntoView(`question-row-${index}`, { align: "nearest" }))
  })

  createEffect(() => {
    const index = commandIndex()
    queueMicrotask(() => commandsScroll?.scrollChildIntoView(`command-row-${index}`, { align: "nearest" }))
  })

  ctx.keymap.layer(() => ({
    mode: "global",
    priority: 80,
    enabled: () => props.panel.focused && ctx.ui.panel.current()?.name === PANEL && !dialogOpen(),
    commands: [
      { id: "opencode-mods.panel.files", title: "Aba Arquivos", bind: "1", run: () => setTab("files") },
      { id: "opencode-mods.panel.timeline", title: "Aba Tempo", bind: "2", run: () => setTab("timeline") },
      { id: "opencode-mods.panel.explain", title: "Aba BTW", bind: "3", run: () => setTab("explain") },
      { id: "opencode-mods.panel.commands", title: "Aba Comandos", bind: "4", run: () => setTab("commands") },
      { id: "opencode-mods.panel.nextTab", title: "Próxima aba", bind: "tab", run: () => cycleTab(1) },
      { id: "opencode-mods.panel.previousTab", title: "Aba anterior", bind: "shift+tab", run: () => cycleTab(-1) },
      { id: "opencode-mods.panel.nextTabRight", title: "Próxima aba", bind: "right", run: () => cycleTab(1) },
      { id: "opencode-mods.panel.previousTabLeft", title: "Aba anterior", bind: "left", run: () => cycleTab(-1) },
      { id: "opencode-mods.panel.up", title: "Subir", bind: "up", run: () => move(-1) },
      { id: "opencode-mods.panel.down", title: "Descer", bind: "down", run: () => move(1) },
      { id: "opencode-mods.panel.activate", title: "Abrir", bind: "space", run: () => void activate() },
      { id: "opencode-mods.panel.enter", title: "Abrir", bind: "return", run: () => void activate() },
      { id: "opencode-mods.panel.revert", title: "Desfazer", bind: "r", run: () => revertCurrent() },
      { id: "opencode-mods.panel.revertQuestion", title: "Reverter pergunta", bind: "shift+r", run: () => void revertCurrentQuestion() },
      { id: "opencode-mods.panel.explainRun", title: "Explicar", bind: "e", run: () => void explain() },
      { id: "opencode-mods.panel.model", title: "Modelo", bind: "m", run: () => void pickModel() },
      { id: "opencode-mods.panel.variant", title: "Variante", bind: "v", run: () => void pickVariant() },
      { id: "opencode-mods.panel.scope", title: "Trocar escopo", bind: "t", run: () => toggleScope() },
      { id: "opencode-mods.panel.all", title: "Marcar todos", bind: "a", run: () => selectAll() },
      { id: "opencode-mods.panel.none", title: "Desmarcar todos", bind: "n", run: () => selectNone() },
      { id: "opencode-mods.panel.fullscreen", title: "Tela cheia", bind: "f", run: () => props.panel.toggleFullscreen() },
      { id: "opencode-mods.panel.help", title: "Ajuda", bind: "?", run: () => void showHelp() },
      { id: "opencode-mods.panel.close", title: "Fechar", bind: "escape", run: () => props.panel.close() },
    ],
    bindings: [
      "opencode-mods.panel.files",
      "opencode-mods.panel.timeline",
      "opencode-mods.panel.explain",
      "opencode-mods.panel.commands",
      "opencode-mods.panel.nextTab",
      "opencode-mods.panel.previousTab",
      "opencode-mods.panel.nextTabRight",
      "opencode-mods.panel.previousTabLeft",
      "opencode-mods.panel.up",
      "opencode-mods.panel.down",
      "opencode-mods.panel.activate",
      "opencode-mods.panel.enter",
      "opencode-mods.panel.revert",
      "opencode-mods.panel.revertQuestion",
      "opencode-mods.panel.explainRun",
      "opencode-mods.panel.model",
      "opencode-mods.panel.variant",
      "opencode-mods.panel.scope",
      "opencode-mods.panel.all",
      "opencode-mods.panel.none",
      "opencode-mods.panel.fullscreen",
      "opencode-mods.panel.help",
      "opencode-mods.panel.close",
    ],
  }))

  onMount(() => {
    // O keymap do host pode deixar o Enter do prompt ganhar do painel; este
    // listener roda antes dele e garante o Enter nas abas do painel.
    const onKeyPress = (event: KeyEvent) => {
      if (event.repeated) return
      if (event.name !== "return" && event.name !== "enter") return
      if (!props.panel.focused || ctx.ui.panel.current()?.name !== PANEL || dialogOpen()) return
      event.preventDefault()
      event.stopPropagation()
      void activate()
    }
    ctx.renderer.keyInput.prependListener("keypress", onKeyPress)

    lastThemeSignature = themeSignatureNow()
    themeTimer = setInterval(() => {
      const next = themeSignatureNow()
      if (next === lastThemeSignature) return
      lastThemeSignature = next
      setThemeTick(value => value + 1)
    }, 500)

    let timer: ReturnType<typeof setTimeout> | undefined
    const stop = ctx.data.listen(({ details }) => {
      if (details.type === "config.updated") {
        const next = themeSignatureNow()
        if (next !== lastThemeSignature) {
          lastThemeSignature = next
          setThemeTick(value => value + 1)
        }
        return
      }
      if (!REFRESH_EVENTS.has(details.type)) return
      const sessionID = (details as { data?: { sessionID?: string } }).data?.sessionID
      if (sessionID !== props.panel.sessionID) return
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => void refresh(), 350)
    })
    // Abrir um painel novo dá o teclado a ele. Comandos pedem o foco de volta
    // para o painel; o autoOpen abre de propósito sem roubar o foco do prompt.
    const focusTimers = focusOnMount
      ? [0, 100, 300].map(delay =>
          setTimeout(() => {
            if (!props.panel.focused && ctx.ui.panel.current()?.name === PANEL) props.panel.focus()
          }, delay),
        )
      : [setTimeout(() => ctx.keymap.dispatch("pane.focus.left"))]
    onCleanup(() => {
      ctx.renderer.keyInput.off("keypress", onKeyPress)
      stop()
      if (timer) clearTimeout(timer)
      if (themeTimer) clearInterval(themeTimer)
      if (noticeTimer) clearTimeout(noticeTimer)
      for (const focusTimer of focusTimers) clearTimeout(focusTimer)
    })
  })

  function tabLabel(item: (typeof TABS)[number]): string {
    if (width() >= 64) return item.label
    if (width() >= 48) return item.short
    return ""
  }

  function tabBackground(item: Tab) {
    if (pressedTab() === item || tab() === item) return theme().background.raised.high
    if (hoveredTab() === item) return theme().background.raised.base
    return undefined
  }

  function tabForeground(item: Tab) {
    if (tab() === item) return props.panel.focused ? colors().primary : theme().text.base
    if (pressedTab() === item) return colors().primary
    if (hoveredTab() === item) return theme().text.base
    return colors().secondary
  }

  function tabBar() {
    return (
      <box flexDirection="row" width="100%" justifyContent="space-between" marginTop={2}>
        <For each={TABS}>
          {item => {
            const active = () => tab() === item.id
            const label = () => tabLabel(item)
            return (
              <box
                flexDirection="row"
                flexShrink={0}
                paddingX={1}
                backgroundColor={tabBackground(item.id)}
                onMouseOver={() => setHoveredTab(item.id)}
                onMouseOut={() => setHoveredTab(current => (current === item.id ? null : current))}
                onMouseDrag={() => setPressedTab(current => (current === item.id ? null : current))}
                onMouseDown={() => setPressedTab(item.id)}
                onMouseUp={() => {
                  if (pressedTab() !== item.id) return
                  setPressedTab(null)
                  props.panel.focus()
                  setTab(item.id)
                }}
              >
                <text
                  selectable={false}
                  fg={tabForeground(item.id)}
                  attributes={active() ? TextAttributes.UNDERLINE : undefined}
                >
                  {`${item.icon}${label() ? `  ${label()}` : ""}`}
                </text>
              </box>
            )
          }}
        </For>
      </box>
    )
  }

  function filesTab() {
    return (
      <box flexDirection="column" flexGrow={1} marginTop={1}>
        <box flexDirection="row" justifyContent="space-between">
          <text fg={colors().secondary}>
            {`${plural(files().length, "arquivo", "arquivos")} · ${scopeLabel(scope())}`}
          </text>
          <text fg={selectedRows().length ? colors().primary : colors().secondary}>
            {selectedRows().length ? `${selectedRows().length} marcado${selectedRows().length === 1 ? "" : "s"}` : "marque para explicar"}
          </text>
        </box>
        <Show when={files().length === 0}>
          <text fg={colors().dim} marginTop={1}>
            {scope() === "turn" ? "Nada alterado nesta pergunta. Veja a sessão toda com t." : "Nenhum arquivo alterado ainda."}
          </text>
        </Show>
        <scrollbox ref={element => (filesScroll = element)} flexGrow={1} marginTop={1} focused={false}>
          <For each={files()}>
            {(row, index) => {
              const isSelected = () => selected().has(normalizePath(row.file))
              const isCurrent = () => fileIndex() === index()
              return (
                <box
                  id={`file-row-${index()}`}
                  flexDirection="row"
                  justifyContent="space-between"
                  backgroundColor={isCurrent() ? currentBg() : undefined}
                  paddingX={1}
                  onMouseDown={() => {
                    const wasCurrent = isCurrent()
                    props.panel.focus()
                    setFileIndex(index())
                    if (wasCurrent) toggleSelected(row)
                  }}
                >
                  <box flexDirection="row" flexShrink={1}>
                    <text fg={isCurrent() ? (props.panel.focused ? colors().primary : colors().secondary) : colors().secondary}>
                      {isCurrent() ? "▌ " : "  "}
                    </text>
                    <text fg={isSelected() ? colors().primary : colors().secondary}>{isSelected() ? "☑ " : "☐ "}</text>
                    <text fg={isSelected() ? colors().primary : theme().text.base}>{fit(row.name, Math.max(12, width() - 40))}</text>
                    <text fg={colors().secondary}>{`  ${fit(row.dir, Math.max(8, width() - 52))}`}</text>
                    <Show when={row.created}>
                      <text fg={colors().ok}>{" novo"}</text>
                    </Show>
                  </box>
                  <box flexDirection="row" flexShrink={0}>
                    <text fg={colors().inserted}>{`+${row.additions}`}</text>
                    <text fg={colors().erased}>{` -${row.deletions}`}</text>
                    <text fg={row.canRevert ? colors().warn : colors().dim}>{row.canRevert ? "  ↶" : "  —"}</text>
                  </box>
                </box>
              )
            }}
          </For>
        </scrollbox>
      </box>
    )
  }

  function timelineTab() {
    return (
      <box flexDirection="column" flexGrow={1} marginTop={1}>
        <box flexDirection="row" justifyContent="space-between">
          <text fg={colors().secondary} flexShrink={1}>
            {oneLine(
              `${timeline().questions.filter(question => question.n > 0).length} perguntas · ${duration(timeline().totalTime)} · ${timeline().compacts} compact${timeline().compacts === 1 ? "" : "s"}`,
              Math.max(12, width() - 16),
            )}
          </text>
          <text fg={colors().warn} flexShrink={0}>
            {money(timeline().totalCost, timeline().costEstimated)}
          </text>
        </box>
        <Show when={visibleQuestions().length === 0}>
          <text fg={colors().dim} marginTop={1}>
            As perguntas aparecem aqui assim que você enviar uma.
          </text>
        </Show>
        <scrollbox ref={element => (timelineScroll = element)} flexGrow={1} marginTop={1} focused={false}>
          <For each={visibleQuestions()}>
            {(question, index) => {
              const isOpen = () => expanded() === question.id
              const isCurrent = () => questionIndex() === index()
              const color = () =>
                question.status === "error"
                  ? colors().fail
                  : question.status === "aborted"
                    ? colors().warn
                    : question.status === "running"
                      ? colors().primary
                      : colors().ok
              return (
                <box
                  id={`question-row-${index()}`}
                  flexDirection="column"
                  backgroundColor={isCurrent() ? currentBg() : undefined}
                  paddingX={1}
                  marginBottom={1}
                  onMouseDown={() => {
                    const wasCurrent = isCurrent()
                    props.panel.focus()
                    setQuestionIndex(index())
                    if (wasCurrent) setExpanded(expanded() === question.id ? null : question.id)
                  }}
                >
                  <box flexDirection="row">
                    <text fg={isCurrent() ? (props.panel.focused ? colors().primary : colors().secondary) : colors().secondary} flexShrink={0}>
                      {isCurrent() ? "▌" : " "}
                    </text>
                    <text fg={color()} flexShrink={0}>
                      {`${statusMark(question.status)}${isOpen() ? "▾" : "▸"} #${question.n} `}
                    </text>
                    <box flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0}>
                      <box flexDirection="row" justifyContent="space-between">
                        <text fg={theme().text.base} flexShrink={1}>
                          {oneLine(question.text, Math.max(10, width() - 28))}
                        </text>
                        <text fg={colors().warn} flexShrink={0}>{money(question.cost, question.costEstimated)}</text>
                      </box>
                      <text fg={colors().secondary}>
                        {oneLine(
                          `${duration(question.durationMs)} · ${tokens(question.tokensIn)}↑ ${tokens(question.tokensOut)}↓${question.ctxPct !== null ? ` · ctx ${question.ctxPct}%` : ""}`,
                          Math.max(12, width() - 14),
                        )}
                      </text>
                    </box>
                  </box>
                  <Show when={isOpen()}>
                    <box flexDirection="column" marginTop={1}>
                      <Show when={question.tools.length === 0}>
                        <text fg={colors().dim}>Nenhuma ferramenta usada.</text>
                      </Show>
                      <For each={question.tools.slice(-80)}>
                        {tool => (
                          <box flexDirection="row">
                            <text fg={tool.ok ? colors().ok : tool.running ? colors().primary : colors().fail}>{tool.ok ? "✓ " : tool.running ? "◌ " : "✗ "}</text>
                            <text fg={colors().primary} flexShrink={0}>{`${tool.name}${tool.agent ? " (agente)" : ""}`}</text>
                            <text fg={colors().secondary} flexGrow={1} flexShrink={1} minWidth={0}>
                              {`  ${oneLine(tool.summary, Math.max(8, width() - 36))}`}
                            </text>
                            <text fg={colors().dim} flexShrink={0}>{`  ${duration(tool.ms)}`}</text>
                          </box>
                        )}
                      </For>
                    </box>
                  </Show>
                </box>
              )
            }}
          </For>
        </scrollbox>
      </box>
    )
  }

  function explainTab() {
    const title = () => explanation().title || "Explicar seleção (btw)"
    return (
      <box flexDirection="column" flexGrow={1} marginTop={1}>
        <text fg={colors().primary}>{`✦ ${title()}`}</text>
        <text fg={colors().secondary}>
          {selectedRows().length
            ? `${plural(selectedRows().length, "arquivo", "arquivos")}: ${selectedRows().map(row => row.name).join(", ")}`
            : "Nenhum arquivo marcado: use espaço na aba Arquivos."}
        </text>
        <text fg={colors().secondary}>
          {oneLine(
            `modelo: ${currentModel(ctx, props.panel.sessionID, prefs().model)?.label ?? "sessão"} · variante: ${prefs().variant ?? "padrão"}  (m / v)`,
            Math.max(12, width() - 4),
          )}
        </text>
        <text fg={colors().dim}>{"e explicar · o texto abaixo não entra na conversa"}</text>
        <Show when={explanation().status === "running"}>
          <text fg={colors().secondary} marginTop={1}>
            Gerando a explicação…
          </text>
        </Show>
        <Show when={explanation().status === "error"}>
          <text fg={colors().fail} marginTop={1}>
            {explanation().text}
          </text>
        </Show>
        <Show when={explanation().status === "idle"}>
          <text fg={colors().dim} marginTop={1}>
            Marque arquivos e pressione e.
          </text>
        </Show>
        <Show when={explanation().status === "done"}>
          <scrollbox flexGrow={1} marginTop={1} focused={false}>
            <markdown content={explanation().text} syntaxStyle={syntax()} />
          </scrollbox>
        </Show>
      </box>
    )
  }

  function commandsTab() {
    return (
      <box flexDirection="column" flexGrow={1} marginTop={1}>
        <text fg={colors().secondary}>{`${allCommands().length} comandos · enter roda o selecionado`}</text>
        <scrollbox ref={element => (commandsScroll = element)} flexGrow={1} marginTop={1} focused={false}>
          <For each={allCommands()}>
            {(command, index) => {
              const isCurrent = () => commandIndex() === index()
              return (
                <box
                  id={`command-row-${index()}`}
                  flexDirection="column"
                  backgroundColor={isCurrent() ? currentBg() : undefined}
                  paddingX={1}
                  marginBottom={1}
                  onMouseDown={() => {
                    const wasCurrent = isCurrent()
                    props.panel.focus()
                    setCommandIndex(index())
                    if (wasCurrent) void runCommand(command)
                  }}
                >
                  <box flexDirection="row">
                    <text fg={isCurrent() ? (props.panel.focused ? colors().primary : colors().secondary) : colors().secondary}>
                      {isCurrent() ? "▌ " : "  "}
                    </text>
                    <text fg={isCurrent() ? (props.panel.focused ? colors().primary : theme().text.base) : theme().text.base}>{`/${command.name}`}</text>
                  </box>
                  <text fg={colors().secondary}>{`  ${oneLine(command.description ?? "", Math.max(10, width() - 4))}`}</text>
                </box>
              )
            }}
          </For>
        </scrollbox>
      </box>
    )
  }

  function focusLine(): string {
    if (props.panel.focused) return "● painel com foco"
    const shortcut = ctx.keymap.shortcuts("pane.focus.right")[0] ?? "ctrl+x →"
    const room = Math.max(10, width() - 2)
    const full = `○ painel sem foco · ${shortcut} para focar`
    const compact = `○ sem foco · ${shortcut}`
    return oneLine(full.length <= room ? full : compact, room)
  }

  function hint(): string {
    if (tab() === "files") return "tab/←→ abas · ↑↓ navegar · espaço marcar · r desfazer · shift+r reverter · e explicar · t escopo · ? ajuda"
    if (tab() === "timeline") return "tab/←→ abas · ↑↓ navegar · enter expandir · shift+r reverter · t escopo · ? ajuda"
    if (tab() === "explain") return "tab/←→ abas · e gerar · m modelo · v variante · ? ajuda"
    return "tab/←→ abas · ↑↓ navegar · enter rodar · ? ajuda"
  }

  return (
    <box flexDirection="column" flexGrow={1} padding={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text fg={props.panel.focused ? colors().primary : colors().secondary}>{"✻ Alterações da sessão"}</text>
        <text fg={colors().secondary}>{`${plural(files().length, "arquivo", "arquivos")}${busy() ? " · atualizando…" : ""}`}</text>
      </box>
      <text fg={props.panel.focused ? colors().ok : colors().secondary} height={1}>
        {focusLine()}
      </text>
      <box flexDirection="row">
        <text fg={colors().inserted}>{`+${loaded()?.diff.totals.added ?? 0}`}</text>
        <text fg={theme().text.base}>{"  "}</text>
        <text fg={colors().erased}>{`-${loaded()?.diff.totals.removed ?? 0}`}</text>
        <text fg={colors().secondary}>{`  ·  ${scopeLabel(scope())}  (t troca)`}</text>
      </box>

      {tabBar()}

      <Show when={tab() === "files"}>{filesTab()}</Show>
      <Show when={tab() === "timeline"}>{timelineTab()}</Show>
      <Show when={tab() === "explain"}>{explainTab()}</Show>
      <Show when={tab() === "commands"}>{commandsTab()}</Show>

      <text fg={colors().dim} marginTop={1}>
        {hint()}
      </text>
      <Show when={notice()}>
        <text fg={noticeColor()}>{notice()}</text>
      </Show>
      <Show when={error()}>
        <text fg={colors().fail}>{error()}</text>
      </Show>
    </box>
  )
}
