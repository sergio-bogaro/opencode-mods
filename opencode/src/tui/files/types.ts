import type { FileDiffInfo } from "@opencode/client"

export type Scope = "turn" | "session"
export type Tab = "files" | "timeline" | "explain" | "commands"
export type ExplainStatus = "idle" | "running" | "done" | "error"

export type Explanation = {
  status: ExplainStatus
  title: string
  text: string
}

export type SessionPrefs = {
  scope: Scope
  tab: Tab
  selected: string[]
  model: string
  variant?: string
  /** Mensagem a partir da qual a linha do tempo é mostrada. */
  cutoff?: string
  explain: Explanation
}

export type FilesState = {
  sessions: Record<string, SessionPrefs>
}

export type FileRow = FileDiffInfo & {
  name: string
  dir: string
  absolute: string
  created: boolean
  canRevert: boolean
}

export type ToolRow = {
  id: string
  name: string
  summary: string
  ms: number
  ok: boolean
  running: boolean
  agent: boolean
}

export type QuestionRow = {
  id: string
  n: number
  text: string
  startedAt: number
  endedAt: number | null
  durationMs: number | null
  cost: number
  costEstimated: boolean
  tokensIn: number
  tokensOut: number
  ctxPct: number | null
  status: "running" | "done" | "aborted" | "error"
  tools: ToolRow[]
}

export type Timeline = {
  questions: QuestionRow[]
  compacts: number
  totalCost: number
  costEstimated: boolean
  totalTime: number
  totalTools: number
}

export type FileTotals = {
  added: number
  removed: number
  count: number
}

export type LoadedDiff = {
  files: FileRow[]
  messages: import("@opencode/client").SessionMessageInfo[]
  userMessages: import("@opencode/client").SessionMessageUser[]
  totals: FileTotals
}

export const DEFAULT_EXPLANATION: Explanation = { status: "idle", title: "", text: "" }

export const DEFAULT_PREFS: SessionPrefs = {
  scope: "turn",
  tab: "files",
  selected: [],
  model: "session",
  explain: DEFAULT_EXPLANATION,
}
