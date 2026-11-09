import type { Context } from "@opencode/plugin/tui/context"
import { ModsRpc } from "../../rpc"
import { themeSnapshot } from "./theme-snapshot"

/**
 * Mantém o servidor com o palette do tema ativo. A janela WPF consulta esse
 * palette para acompanhar o tema em tempo real, sem precisar ser reaberta.
 */
export function installThemeSync(ctx: Context): () => void {
  let last = ""
  let stopped = false

  const send = (): void => {
    if (stopped) return
    try {
      const mode = ctx.themeMode
      const tokens = themeSnapshot(ctx.theme)
      const signature = mode + JSON.stringify(tokens)
      if (signature === last) return
      last = signature
      void ctx.client
        .rpc(ModsRpc)
        .customizeTheme({ theme: { mode, tokens } })
        .catch(() => {
          if (last === signature) last = ""
        })
    } catch {
      // sem tema ou servidor indisponível: tenta de novo no próximo tick
    }
  }

  send()
  const timer = setInterval(send, 500)
  return () => {
    stopped = true
    clearInterval(timer)
  }
}
