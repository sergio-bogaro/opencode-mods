import type { Context } from "@opencode/plugin/tui/context"
import { ModsRpc } from "../../../rpc"
import { themeSnapshot } from "../theme-snapshot"
import { loadMessages } from "./data"
import { updatePrefs } from "./store"
import { DEFAULT_EXPLANATION } from "./types"

export async function latestUserMessageID(ctx: Context, sessionID: string): Promise<string | undefined> {
  const messages = await loadMessages(ctx, sessionID)
  const users = messages.filter(message => message.type === "user")
  return users[users.length - 1]?.id
}

export async function clearTimeline(ctx: Context, sessionID: string): Promise<boolean | undefined> {
  let id: string | undefined
  try {
    id = await latestUserMessageID(ctx, sessionID)
  } catch (error) {
    ctx.ui.toast.show({
      message: `Não consegui carregar a sessão: ${String(error)}`,
      variant: "error",
      sessionID,
    })
    return undefined
  }
  if (!id) return false
  let changed = false
  await updatePrefs(sessionID, prefs => {
    changed = prefs.cutoff !== id
    prefs.cutoff = id
  })
  return changed
}

export async function wipeData(ctx: Context, sessionID: string): Promise<boolean> {
  let id: string | undefined
  try {
    id = await latestUserMessageID(ctx, sessionID)
  } catch (error) {
    ctx.ui.toast.show({
      message: `Não consegui carregar a sessão: ${String(error)}`,
      variant: "error",
      sessionID,
    })
    return false
  }
  await updatePrefs(sessionID, prefs => {
    prefs.selected = []
    prefs.cutoff = id
    prefs.explain = { ...DEFAULT_EXPLANATION }
  })
  return true
}

export async function openCustomize(ctx: Context, mode: "light" | "dark", theme: unknown): Promise<string> {
  const tokens = themeSnapshot(theme)
  const result = (await ctx.client.rpc(ModsRpc).openCustomize({ theme: { mode, tokens } })) as { text?: string }
  return result.text ?? ""
}
