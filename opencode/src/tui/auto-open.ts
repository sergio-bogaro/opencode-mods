import type { Context } from "@opencode/plugin/tui/context"
import { createEffect, createRoot, untrack } from "solid-js"
import { PANEL } from "./constants"

const MAX_ATTEMPTS = 6

export type AutoOpen = {
  /** Volta a acompanhar as sessões depois de uma abertura manual do painel. */
  readonly resume: () => void
  readonly dispose: () => void
}

export type AutoOpenStep = {
  readonly active: boolean
  readonly at: string | undefined
  /** Sessão que deve ser aberta agora, se houver. */
  readonly open: string | undefined
}

/** Decide o próximo passo do auto-open a partir da rota e do painel atual. */
export function stepAutoOpen(
  active: boolean,
  at: string | undefined,
  route: { readonly type: string; readonly sessionID?: string },
  shown: { readonly name: string; readonly sessionID: string } | undefined,
): AutoOpenStep {
  if (!active) return { active, at, open: undefined }

  if (route.type !== "session" || !route.sessionID) {
    // Na tela inicial o host esconde o painel; ele volta na próxima sessão.
    return { active, at: undefined, open: undefined }
  }

  const id = route.sessionID
  if (shown?.name === PANEL && shown.sessionID === id) {
    return { active, at: id, open: undefined }
  }

  // Sumiu com a mesma sessão ativa: foi fechado pelo usuário ou pelo host.
  if (!shown && at === id) return { active: false, at, open: undefined }

  return { active, at, open: id }
}

/**
 * Abre o painel junto com a sessão, sem pedir foco.
 *
 * O painel acompanha a troca de sessão; se for fechado enquanto a mesma sessão
 * está ativa (Esc, leader+b, terminal ou outro painel), para de reabrir. Abrir
 * de novo por /arquivos reativa o acompanhamento.
 */
export function installAutoOpen(ctx: Context): AutoOpen {
  let active = true
  /** Sessão onde o painel estava aberto pela última vez. */
  let at: string | undefined
  /** Sessão que está sendo aberta agora. */
  let target: string | undefined
  let attempt = 0
  let timer: ReturnType<typeof setTimeout> | undefined

  function clearTimer(): void {
    if (!timer) return
    clearTimeout(timer)
    timer = undefined
  }

  function tryOpen(sessionID: string): void {
    if (!active || target !== sessionID) return

    const route = ctx.ui.router.current()
    if (route.type !== "session" || route.sessionID !== sessionID) {
      target = undefined
      return
    }

    const current = ctx.ui.panel.current()
    if (current?.name === PANEL && current.sessionID === sessionID) {
      at = sessionID
      target = undefined
      return
    }

    if (ctx.ui.panel.open(PANEL)) {
      at = sessionID
      target = undefined
      return
    }

    if (attempt >= MAX_ATTEMPTS) {
      target = undefined
      return
    }

    const delay = 100 + attempt * 100
    attempt++
    timer = setTimeout(() => {
      timer = undefined
      tryOpen(sessionID)
    }, delay)
  }

  function schedule(sessionID: string): void {
    clearTimer()
    target = sessionID
    attempt = 0
    tryOpen(sessionID)
  }

  const stop = createRoot(dispose => {
    createEffect(() => {
      const route = ctx.ui.router.current()
      const current = ctx.ui.panel.current()
      untrack(() => {
        const step = stepAutoOpen(active, at, route, current)
        active = step.active
        at = step.at
        if (step.open === undefined) {
          target = undefined
          clearTimer()
          return
        }
        if (target !== step.open) schedule(step.open)
      })
    })
    return dispose
  })

  return {
    resume() {
      active = true
      target = undefined
      clearTimer()
      const current = ctx.ui.panel.current()
      at = current?.name === PANEL ? current.sessionID : undefined
    },
    dispose() {
      clearTimer()
      stop()
    },
  }
}
