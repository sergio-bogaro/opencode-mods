import type {
  FileDiffInfo,
  ModelInfo,
  ModelRef,
  SessionMessageAssistant,
  SessionMessageAssistantTool,
  SessionMessageCompaction,
  SessionMessageIdle,
  SessionMessageInfo,
  SessionMessageUser,
  TokenUsageInfo,
} from "@opencode/client"
import type { Context } from "@opencode/plugin/tui/context"
import { fileName, normalizePath, oneLine, parentDir } from "../../shared/format"
import type { FileRow, FileTotals, LoadedDiff, QuestionRow, Scope, Timeline, ToolRow } from "./types"

type Location = ReturnType<typeof sessionLocation>

export function sessionLocation(ctx: Context, sessionID: string): NonNullable<ReturnType<Context["data"]["session"]["get"]>>["location"] {
  const session = ctx.data.session.get(sessionID)
  return session?.location ?? ctx.location ?? ctx.data.location.default()
}

export async function syncData(ctx: Context, sessionID: string): Promise<void> {
  const location = sessionLocation(ctx, sessionID)
  await Promise.allSettled([
    ctx.data.session.sync(sessionID),
    ctx.data.session.message.sync(sessionID),
    ctx.data.location.vcs.sync(location),
    ctx.data.location.model.sync(location),
  ])
}

export async function loadMessages(
  ctx: Context,
  sessionID: string,
  alreadySynced = false,
): Promise<SessionMessageInfo[]> {
  if (!alreadySynced) await ctx.data.session.message.sync(sessionID)
  const byId = new Map<string, SessionMessageInfo>()
  for (const message of ctx.data.session.message.list(sessionID)) byId.set(message.id, message)
  return [...byId.values()].sort((a, b) => a.time.created - b.time.created)
}

export function isUser(message: SessionMessageInfo): message is SessionMessageUser {
  return message.type === "user"
}

export function isAssistant(message: SessionMessageInfo): message is SessionMessageAssistant {
  return message.type === "assistant"
}

export function isIdle(message: SessionMessageInfo): message is SessionMessageIdle {
  return message.type === "idle"
}

export function isCompaction(message: SessionMessageInfo): message is SessionMessageCompaction {
  return message.type === "compaction"
}

export function modelInfoForRef(
  ctx: Context,
  location: Location,
  ref: { providerID: string; id: string } | undefined,
): ModelInfo | undefined {
  if (!ref) return undefined
  const models = ctx.data.location.model.list(location) ?? []
  return models.find(model => model.providerID === ref.providerID && (model.modelID === ref.id || model.id === ref.id))
}

export function modelInfoFor(ctx: Context, sessionID: string): ModelInfo | undefined {
  const location = sessionLocation(ctx, sessionID)
  const ref = ctx.data.session.get(sessionID)?.model
  const selected = ctx.ui.model.current()
  return modelInfoForRef(ctx, location, ref ?? (selected ? { providerID: selected.providerID, id: selected.modelID } : undefined))
}

function userMessages(messages: SessionMessageInfo[]): SessionMessageUser[] {
  return messages.filter(isUser)
}

export async function loadDiff(
  ctx: Context,
  sessionID: string,
  scope: Scope,
  messages?: SessionMessageInfo[],
  context?: number,
): Promise<LoadedDiff> {
  const all = messages ?? (await loadMessages(ctx, sessionID))
  const users = userMessages(all)
  const cwd = normalizePath(sessionLocation(ctx, sessionID).directory).replace(/\/$/, "")
  if (users.length === 0) {
    return { files: [], messages: all, userMessages: users, totals: { added: 0, removed: 0, count: 0 } }
  }

  const from = scope === "session" ? users[0]!.id : users[users.length - 1]!.id
  const to = scope === "session" ? users[users.length - 1]!.id : undefined
  const options = context === undefined ? {} : { context }
  let diff: FileDiffInfo[] = []
  try {
    diff = await ctx.client.session.diff({ sessionID, from, to, ...options })
  } catch (error) {
    if (scope === "session") {
      // Sessão com troca de local ou histórico compactado: cai para a última pergunta.
      diff = await ctx.client.session.diff({ sessionID, from: users[users.length - 1]!.id, ...options })
    } else {
      throw error
    }
  }

  const files = diff.map(file => {
    const normalized = normalizePath(file.file)
    const relative = normalized.startsWith(normalizePath(cwd) + "/")
      ? normalized.slice(normalizePath(cwd).length + 1)
      : normalized
    const absolute = normalized.startsWith("/") || /^[A-Za-z]:\//.test(normalized)
      ? normalized
      : `${cwd}/${normalized}`
    return {
      ...file,
      name: fileName(relative),
      dir: parentDir(relative),
      absolute,
      created: file.status === "added",
      canRevert: !file.more && (file.status === "added" || (!!file.patch && file.patch.trim().length > 0)),
    } satisfies FileRow
  })

  files.sort((a, b) => a.dir.localeCompare(b.dir) || a.name.localeCompare(b.name))
  const totals: FileTotals = {
    added: files.reduce((sum, file) => sum + file.additions, 0),
    removed: files.reduce((sum, file) => sum + file.deletions, 0),
    count: files.length,
  }
  return { files, messages: all, userMessages: users, totals }
}

function tokenCount(tokens: TokenUsageInfo | undefined): { input: number; output: number; total: number } {
  if (!tokens) return { input: 0, output: 0, total: 0 }
  const input = tokens.input + tokens.cache.read + tokens.cache.write
  return { input, output: tokens.output, total: input + tokens.output }
}

function costTier(tokens: TokenUsageInfo, model: ModelInfo) {
  const total = tokens.input + tokens.output + tokens.cache.read + tokens.cache.write
  return [...model.cost]
    .filter(cost => !cost.tier || total >= cost.tier.size)
    .sort((left, right) => (right.tier?.size ?? 0) - (left.tier?.size ?? 0))[0]
}

export function modelCost(tokens: TokenUsageInfo | undefined, model: ModelInfo | undefined): number {
  if (!tokens || !model || model.cost.length === 0) return 0
  const tier = costTier(tokens, model) ?? model.cost[0]
  if (!tier) return 0
  return (
    (tokens.input * tier.input +
      tokens.output * tier.output +
      tokens.cache.read * tier.cache.read +
      tokens.cache.write * tier.cache.write) /
    1_000_000
  )
}

export function messageCost(
  message: { cost?: number; tokens?: TokenUsageInfo },
  model: ModelInfo | undefined,
): { value: number; estimated: boolean } {
  const reported = message.cost ?? 0
  if (reported > 0) return { value: reported, estimated: false }
  const value = modelCost(message.tokens, model)
  return { value, estimated: value > 0 }
}

function toolInput(tool: SessionMessageAssistantTool): Record<string, unknown> {
  const state = tool.state
  return state.status === "streaming" ? {} : (state.input as Record<string, unknown>)
}

function summarizeTool(name: string, input: Record<string, unknown>): string {
  const pick = (key: string) => (typeof input[key] === "string" ? (input[key] as string) : "")
  const file = pick("filePath") || pick("file_path") || pick("path") || pick("notebook_path")
  if (pick("command")) return oneLine(pick("command"), 160)
  if (file) return normalizePath(file).split("/").slice(-2).join("/")
  if (Array.isArray(input.questions) && input.questions[0] && typeof input.questions[0] === "object") {
    const question = input.questions[0] as Record<string, unknown>
    const header = typeof question.header === "string" ? question.header : ""
    const text = typeof question.question === "string" ? question.question : ""
    if (header || text) return oneLine(header || text, 120)
  }
  return oneLine(
    pick("pattern") || pick("description") || pick("url") || pick("query") || pick("skill") || pick("prompt") || pick("subagent_type"),
    120,
  )
}

function toolRow(tool: SessionMessageAssistantTool): ToolRow {
  const state = tool.state
  const created = tool.time.created
  const started = tool.time.ran ?? created
  const completed = tool.time.completed
  const ms =
    state.status === "completed" || state.status === "error"
      ? Math.max(0, (completed ?? started) - started)
      : Math.max(0, Date.now() - started)
  const ok = state.status === "completed"
  return {
    id: tool.id,
    name: tool.name,
    summary: state.status === "streaming" ? oneLine(state.input, 120) : summarizeTool(tool.name, toolInput(tool)),
    ms,
    ok,
    running: !ok && state.status !== "error",
    agent: tool.name === "task" || tool.name === "subagent",
  }
}

export type ModelResolver = (ref: ModelRef | undefined) => ModelInfo | undefined

function assistantUsage(
  message: SessionMessageAssistant,
  model: ModelInfo | undefined,
): { cost: number; costEstimated: boolean; tokensIn: number; tokensOut: number } {
  const tokens = tokenCount(message.tokens)
  const cost = messageCost(message, model)
  return {
    cost: cost.value,
    costEstimated: cost.estimated,
    tokensIn: tokens.input,
    tokensOut: tokens.output,
  }
}

function idleStatus(message: SessionMessageIdle): QuestionRow["status"] {
  if (message.outcome === "failed") return "error"
  if (message.outcome === "interrupted") return "aborted"
  return "done"
}

function newQuestion(id: string, n: number, text: string, startedAt: number): QuestionRow {
  return {
    id,
    n,
    text,
    startedAt,
    endedAt: null,
    durationMs: null,
    cost: 0,
    costEstimated: false,
    tokensIn: 0,
    tokensOut: 0,
    ctxPct: null,
    status: "running",
    tools: [],
  }
}

export function countCompacts(messages: SessionMessageInfo[]): number {
  return messages.filter(message => isCompaction(message) && message.status === "completed").length
}

/**
 * O custo da sessão pode incluir subagentes, título e outras chamadas que não
 * aparecem nas mensagens da sessão principal. A diferença vira uma linha
 * própria para a linha do tempo não divergir do rodapé.
 */
export function applySessionCost(timeline: Timeline, total: number, at: number): Timeline {
  const extra = total - timeline.totalCost
  if (!(extra > 0.000001)) return timeline
  const row = newQuestion("__outside__", 0, "(subagentes/fora da timeline)", at)
  row.cost = extra
  row.endedAt = at
  row.durationMs = 0
  row.status = "done"
  timeline.questions.unshift(row)
  timeline.totalCost += extra
  return timeline
}

export function buildTimeline(
  messages: SessionMessageInfo[],
  model: ModelInfo | undefined,
  resolveModel?: ModelResolver,
): Timeline {
  const modelFor = (ref: ModelRef | undefined) => resolveModel?.(ref) ?? model
  const questions: QuestionRow[] = []
  let current: QuestionRow | null = null
  let compacts = 0

  const close = (endedAt: number, status: QuestionRow["status"]) => {
    if (!current) return
    current.endedAt = endedAt
    current.durationMs = Math.max(0, endedAt - current.startedAt)
    current.status = status
    current = null
  }

  for (const message of messages) {
    if (isUser(message)) {
      if (current) close(message.time.created, "done")
      current = newQuestion(
        message.id,
        questions.filter(question => question.n > 0).length + 1,
        oneLine(message.text, 200),
        message.time.created,
      )
      questions.push(current)
      continue
    }

    if (isIdle(message)) {
      close(message.time.created, idleStatus(message))
      continue
    }

    if (isCompaction(message)) {
      if (message.status === "completed") compacts++
      if (message.status === "running") continue
      if (!current) {
        // Compactação manual entre turnos: sem pergunta corrente, cria uma
        // linha própria para o custo não desaparecer do total.
        current = newQuestion(message.id, 0, "(fora do turno)", message.time.created)
        questions.push(current)
      }
      const compactModel = message.status === "completed" ? message.model : undefined
      const cost = messageCost(message, modelFor(compactModel))
      current.cost += cost.value
      current.costEstimated ||= cost.estimated
      const tokens = tokenCount(message.tokens)
      current.tokensIn += tokens.input
      current.tokensOut += tokens.output
      if (current.n === 0) close(message.time.created, "done")
      continue
    }

    if (isAssistant(message)) {
      if (!current) {
        current = newQuestion(message.id, 0, "(antes da primeira pergunta)", message.time.created)
        questions.push(current)
      }
      const messageModel = modelFor(message.model)
      const usage = assistantUsage(message, messageModel)
      current.cost += usage.cost
      current.costEstimated ||= usage.costEstimated
      current.tokensIn += usage.tokensIn
      current.tokensOut += usage.tokensOut
      const contextLimit = messageModel?.limit.context
      if (contextLimit && contextLimit > 0) {
        const used = usage.tokensIn + usage.tokensOut
        current.ctxPct = Math.min(100, Math.max(0, Math.round((used / contextLimit) * 100)))
      }
      for (const content of message.content) {
        if (content.type === "tool") current.tools.push(toolRow(content))
      }
    }
  }

  if (current) {
    const last = messages[messages.length - 1]
    current.durationMs = last ? Math.max(0, last.time.created - current.startedAt) : null
    current.status = "running"
  }

  const totalCost = questions.reduce((sum, question) => sum + question.cost, 0)
  const costEstimated = questions.some(question => question.costEstimated)
  const totalTime = questions.reduce((sum, question) => sum + (question.durationMs ?? 0), 0)
  const totalTools = questions.reduce((sum, question) => sum + question.tools.length, 0)
  return { questions, compacts, totalCost, costEstimated, totalTime, totalTools }
}

export function applyCutoff(messages: SessionMessageInfo[], cutoff: string | undefined): SessionMessageInfo[] {
  if (!cutoff) return messages
  const index = messages.findIndex(message => message.id === cutoff)
  if (index < 0) return messages
  // Esconde o turno inteiro do corte. Cortar só depois do ID deixaria os
  // assistentes/idle daquele turno sem a pergunta e criaria uma linha "#0".
  const nextUser = messages.findIndex((message, position) => position > index && isUser(message))
  return nextUser < 0 ? [] : messages.slice(nextUser)
}

export type Loaded = {
  diff: LoadedDiff
  timeline: Timeline
  model: ModelInfo | undefined
}

export async function loadAll(ctx: Context, sessionID: string, scope: Scope, cutoff?: string): Promise<Loaded> {
  await syncData(ctx, sessionID)
  const messages = await loadMessages(ctx, sessionID, true)
  const diff = await loadDiff(ctx, sessionID, scope, messages)
  const location = sessionLocation(ctx, sessionID)
  const model = modelInfoFor(ctx, sessionID)
  const visible = applyCutoff(messages, cutoff)
  const timeline = buildTimeline(visible, model, ref => modelInfoForRef(ctx, location, ref))
  timeline.compacts = countCompacts(messages)
  const hidden = !!cutoff && messages.some(message => message.id === cutoff)
  if (!hidden) {
    let sessionCost = 0
    try {
      sessionCost = ctx.data.session.cost(sessionID)
    } catch {
      sessionCost = 0
    }
    applySessionCost(timeline, sessionCost, visible[visible.length - 1]?.time.created ?? Date.now())
  }
  return { diff, timeline, model }
}

export function sessionTitle(ctx: Context, sessionID: string): string {
  return ctx.data.session.get(sessionID)?.title || "OpenCode"
}

export type { Location }
