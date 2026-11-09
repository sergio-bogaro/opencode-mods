import type { Context } from "@opencode/plugin/tui/context"
import type { Tab } from "./files/types"

type RequestState = { tab: Tab | null; focus: boolean }

function requestStore(ctx: Context, sessionID: string) {
  return ctx.storage.memory<RequestState>(`requested-tab:${sessionID}`, { initial: { tab: null, focus: false } })
}

export function requestedTab(ctx: Context, sessionID: string): Tab | null {
  return requestStore(ctx, sessionID)[0].tab
}

export function setRequestedTab(ctx: Context, sessionID: string, tab: Tab | null): void {
  requestStore(ctx, sessionID)[1](draft => {
    draft.tab = tab
  })
}

/** Pede que o painel assuma o teclado ao abrir ou ao trocar de aba. */
export function requestFocus(ctx: Context, sessionID: string): void {
  requestStore(ctx, sessionID)[1](draft => {
    draft.focus = true
  })
}

/** Consome o pedido de foco (uma única vez). */
export function consumeFocusRequest(ctx: Context, sessionID: string): boolean {
  const store = requestStore(ctx, sessionID)
  const focus = store[0].focus
  if (focus) {
    store[1](draft => {
      draft.focus = false
    })
  }
  return focus
}

export function clearFocusRequest(ctx: Context, sessionID: string): void {
  requestStore(ctx, sessionID)[1](draft => {
    draft.focus = false
  })
}
