import type { Context } from "@opencode/plugin/tui/context"
import type { Store } from "solid-js/store"
import { DEFAULT_EXPLANATION, DEFAULT_PREFS, type Explanation, type FilesState, type SessionPrefs } from "./types"

type FilesStore = readonly [Store<FilesState>, (mutation: (draft: FilesState) => void) => Promise<void>]

let current: FilesStore | null = null

export function initFilesStore(ctx: Context): void {
  current = ctx.storage.store<FilesState>("files-changed", { initial: { sessions: {} } })
}

export function filesStore(): FilesStore {
  if (!current) throw new Error("files-changed: store não inicializado")
  return current
}

function normalizeExplanation(value: unknown): Explanation {
  if (!value || typeof value !== "object") return { ...DEFAULT_EXPLANATION }
  const raw = value as Partial<Explanation>
  const status =
    raw.status === "done" || raw.status === "error"
      ? raw.status
      : raw.status === "running"
        ? "error"
        : "idle"
  return {
    status,
    title: typeof raw.title === "string" ? raw.title : "",
    text:
      typeof raw.text === "string" && raw.text
        ? raw.text
        : status === "error" && raw.status === "running"
          ? "A geração anterior foi interrompida."
          : "",
  }
}

/** Normaliza estado persistido por versões anteriores do plugin. */
export function normalizePrefs(value: unknown): SessionPrefs {
  const raw = value && typeof value === "object" ? (value as Partial<SessionPrefs>) : {}
  return {
    scope: raw.scope === "session" ? "session" : "turn",
    tab: raw.tab === "timeline" || raw.tab === "explain" || raw.tab === "commands" ? raw.tab : "files",
    selected: Array.isArray(raw.selected)
      ? raw.selected.filter((item): item is string => typeof item === "string")
      : [],
    model: typeof raw.model === "string" && raw.model ? raw.model : DEFAULT_PREFS.model,
    variant: typeof raw.variant === "string" && raw.variant ? raw.variant : undefined,
    cutoff: typeof raw.cutoff === "string" && raw.cutoff ? raw.cutoff : undefined,
    explain: normalizeExplanation(raw.explain),
  }
}

export function prefsFor(state: FilesState, sessionID: string): SessionPrefs {
  const stored = state.sessions[sessionID]
  return stored ? normalizePrefs(stored) : DEFAULT_PREFS
}

export async function updatePrefs(sessionID: string, mutate: (prefs: SessionPrefs) => void): Promise<void> {
  const [, update] = filesStore()
  await update(draft => {
    draft.sessions[sessionID] = normalizePrefs(draft.sessions[sessionID])
    mutate(draft.sessions[sessionID]!)
  })
}
