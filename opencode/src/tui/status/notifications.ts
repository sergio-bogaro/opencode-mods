import { spawn } from "node:child_process"
import type { Context } from "@opencode/plugin/tui/context"
import { duration, oneLine } from "../../shared/format"
import { scriptPath } from "../../shared/paths"

type Pose = "sucesso" | "interrompida" | "falhou" | "pergunta" | "permissao" | "agente"

function titleFor(ctx: Context, sessionID: string): string {
  return ctx.data.session.get(sessionID)?.title || "OpenCode"
}

function windowsToast(ctx: Context, sessionID: string, title: string, text: string, pose: Pose): void {
  if (process.platform !== "win32" || ctx.options.windowsToast !== true) return
  try {
    const child = spawn(
      "powershell",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        scriptPath("scripts", "toast.ps1"),
        sessionID,
        title,
        text,
        pose,
      ],
      { windowsHide: true, stdio: "ignore" },
    )
    child.on("error", () => {
      // spawn pode falhar de forma assíncrona; a notificação do OpenCode continua
    })
    child.unref()
  } catch {
    // sem toast nativo; a notificação do OpenCode continua
  }
}

export function installNotifications(ctx: Context): () => void {
  const started = new Map<string, number>()

  function toast(sessionID: string, message: string, variant: "info" | "success" | "warning" | "error"): void {
    ctx.ui.toast.show({ message, variant, sessionID })
  }

  function notify(
    sessionID: string,
    message: string,
    sound: "default" | "question" | "permission" | "error" | "done" | "subagent_done",
    pose: Pose,
    variant: "info" | "success" | "warning" | "error",
  ): void {
    const title = titleFor(ctx, sessionID)
    toast(sessionID, message, variant)
    void ctx.attention
      .notify({
        title,
        message,
        notification: { when: "blurred" },
        sound: { name: sound, when: "always" },
      })
      .catch(() => undefined)
    windowsToast(ctx, sessionID, title, message, pose)
  }

  const stop = ctx.data.listen(({ details }) => {
    if (details.type === "session.execution.started") {
      const id = (details as { data?: { sessionID?: string } }).data?.sessionID
      if (id) started.set(id, Date.now())
      return
    }

    if (details.type === "session.execution.succeeded") {
      const id = (details as { data?: { sessionID?: string } }).data?.sessionID
      if (!id) return
      const began = started.get(id)
      started.delete(id)
      notify(id, `${titleFor(ctx, id)} finalizou (${duration(began ? Date.now() - began : undefined)})`, "done", "sucesso", "success")
      return
    }

    if (details.type === "session.execution.failed") {
      const id = (details as { data?: { sessionID?: string } }).data?.sessionID
      if (!id) return
      started.delete(id)
      const error = (details as { data?: { error?: { message?: string } } }).data?.error?.message
      notify(id, `${titleFor(ctx, id)} falhou${error ? `: ${oneLine(error, 120)}` : ""}`, "error", "falhou", "error")
      return
    }

    if (details.type === "session.execution.interrupted") {
      const id = (details as { data?: { sessionID?: string } }).data?.sessionID
      if (!id) return
      started.delete(id)
      notify(id, `${titleFor(ctx, id)} interrompida`, "default", "interrompida", "warning")
      return
    }

    if (details.type === "permission.asked") {
      const data = (details as { data?: { sessionID?: string; action?: string; resources?: string[]; message?: string } }).data
      if (!data?.sessionID) return
      const what = data.message || [data.action, ...(data.resources ?? [])].filter(Boolean).join(" · ")
      notify(data.sessionID, `Precisa da sua permissão: ${oneLine(what || "ação pendente", 140)}`, "permission", "permissao", "warning")
      return
    }

    if (details.type === "form.created") {
      const sessionID = (details as { data?: { sessionID?: string } }).data?.sessionID
      if (!sessionID) return
      notify(sessionID, "Esperando sua resposta", "question", "pergunta", "info")
    }
  })

  return () => {
    stop()
    started.clear()
  }
}
