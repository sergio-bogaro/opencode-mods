import type { Context } from "@opencode/plugin/tui/context"
import { createSignal } from "solid-js"
import { loadDiff } from "./data"
import type { FileTotals, Scope } from "./types"

export type TotalsMap = Record<string, FileTotals>

const [totals, setTotals] = createSignal<TotalsMap>({})
const inFlight = new Map<string, Promise<void>>()
const queued = new Set<string>()

export { totals }

export function totalsKey(sessionID: string, scope: Scope): string {
  return `${sessionID}:${scope}`
}

export function setTotalsFor(sessionID: string, scope: Scope, value: FileTotals): void {
  setTotals(previous => ({ ...previous, [totalsKey(sessionID, scope)]: value }))
}

export function totalsFor(sessionID: string, scope: Scope): FileTotals | undefined {
  return totals()[totalsKey(sessionID, scope)]
}

export async function refreshTotals(ctx: Context, sessionID: string, scope: Scope): Promise<void> {
  const key = totalsKey(sessionID, scope)
  const running = inFlight.get(key)
  if (running) {
    queued.add(key)
    return running
  }
  const promise = (async () => {
    try {
      const loaded = await loadDiff(ctx, sessionID, scope, undefined, 0)
      setTotalsFor(sessionID, scope, loaded.totals)
    } catch {
      // sem números agora; o painel mostra o erro completo
    } finally {
      inFlight.delete(key)
      if (queued.delete(key)) void refreshTotals(ctx, sessionID, scope)
    }
  })()
  inFlight.set(key, promise)
  return promise
}
