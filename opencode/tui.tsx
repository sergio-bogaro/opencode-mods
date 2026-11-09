import { Plugin } from "@opencode/plugin/tui"
import type { Context } from "@opencode/plugin/tui/context"
import { Show } from "solid-js"
import { installAutoOpen } from "./src/tui/auto-open"
import { PANEL } from "./src/tui/constants"
import { clearTimeline, openCustomize, wipeData } from "./src/tui/files/actions"
import { FilesPanel } from "./src/tui/files/panel"
import { initFilesStore } from "./src/tui/files/store"
import type { Tab } from "./src/tui/files/types"
import { clearFocusRequest, requestFocus, setRequestedTab } from "./src/tui/request"
import { StatusFooter } from "./src/tui/status/footer"
import { installNotifications } from "./src/tui/status/notifications"
import { installThemeSync } from "./src/tui/theme-sync"

function currentSessionID(ctx: Context): string | undefined {
  const route = ctx.ui.router.current()
  return route.type === "session" ? route.sessionID : undefined
}

export default Plugin.define({
  id: "opencode-mods.tui",
  setup(ctx) {
    const filesChanged = ctx.options.filesChanged !== false
    const sessionStatus = ctx.options.sessionStatus !== false
    const customize = ctx.options.customize !== false
    const autoOpen = ctx.options.autoOpen !== false

    if (filesChanged || sessionStatus) initFilesStore(ctx)

    const cleanups: Array<() => void> = []

    if (filesChanged) {
      cleanups.push(
        ctx.ui.slot({
          append: "session.panel",
          render: panel => (
            <Show when={panel.name === PANEL}>
              <FilesPanel panel={panel} />
            </Show>
          ),
        }),
      )
    }

    const auto = filesChanged && autoOpen ? installAutoOpen(ctx) : undefined
    if (auto) cleanups.push(auto.dispose)

    if (sessionStatus) {
      cleanups.push(
        ctx.ui.slot({
          append: "prompt.footer.status",
          render: input => <StatusFooter sessionID={input.sessionID} mode={input.mode} showDetails={input.showDetails} />,
        }),
      )
      cleanups.push(installNotifications(ctx))
    }

    function openPanel(tab: Tab): void {
      const id = currentSessionID(ctx)
      if (!id) {
        ctx.ui.toast.show({ message: "Abra uma sessão para usar o painel de arquivos.", variant: "warning" })
        return
      }
      setRequestedTab(ctx, id, tab)
      requestFocus(ctx, id)
      const opened = ctx.ui.panel.open(PANEL)
      if (!opened) {
        setRequestedTab(ctx, id, null)
        clearFocusRequest(ctx, id)
        ctx.ui.toast.show({ message: "Abra uma sessão para usar o painel de arquivos.", variant: "warning" })
        return
      }
      auto?.resume()
    }

    if (filesChanged) {
      ctx.keymap.layer(() => ({
        mode: "global",
        priority: 40,
        commands: [
          {
            id: "opencode-mods.command.arquivos",
            title: "Arquivos alterados",
            group: "opencode-mods",
            palette: true,
            suggested: true,
            slash: { name: "arquivos" },
            run: () => openPanel("files"),
          },
          {
            id: "opencode-mods.command.linha-do-tempo",
            title: "Linha do tempo da sessão",
            group: "opencode-mods",
            palette: true,
            slash: { name: "linha-do-tempo" },
            run: () => openPanel("timeline"),
          },
          {
            id: "opencode-mods.command.limpar-linha-do-tempo",
            title: "Limpar linha do tempo",
            group: "opencode-mods",
            palette: true,
            slash: { name: "limpar-linha-do-tempo", arguments: true },
            run: async input => {
              const id = currentSessionID(ctx)
              if (!id) {
                ctx.ui.toast.show({ message: "Abra uma sessão primeiro.", variant: "warning" })
                return
              }
              const force = (input ?? "").trim().toLowerCase() === "confirmar"
              if (!force) {
                const ok = await ctx.ui.dialog.confirm({
                  title: "Limpar linha do tempo",
                  message: "A linha do tempo do painel fica vazia; a conversa não é apagada. Continuar?",
                  label: { confirm: "Limpar", cancel: "Cancelar" },
                })
                if (!ok) return
              }
              const done = await clearTimeline(ctx, id)
              if (done === undefined) return
              ctx.ui.toast.show({
                message: done ? "Linha do tempo limpa." : "Não há pergunta para esconder.",
                variant: done ? "success" : "warning",
                sessionID: id,
              })
            },
          },
          {
            id: "opencode-mods.command.limpar-dados",
            title: "Limpar dados do painel",
            group: "opencode-mods",
            palette: true,
            slash: { name: "limpar-dados", arguments: true },
            run: async input => {
              const id = currentSessionID(ctx)
              if (!id) {
                ctx.ui.toast.show({ message: "Abra uma sessão primeiro.", variant: "warning" })
                return
              }
              const force = (input ?? "").trim().toLowerCase() === "confirmar"
              if (!force) {
                const ok = await ctx.ui.dialog.confirm({
                  title: "Limpar dados",
                  message:
                    "Zera seleção, explicação e linha do tempo desta sessão. Os arquivos e o histórico do OpenCode não são tocados. Continuar?",
                  label: { confirm: "Limpar", cancel: "Cancelar" },
                })
                if (!ok) return
              }
              const done = await wipeData(ctx, id)
              if (!done) return
              ctx.ui.toast.show({ message: "Estado do painel zerado.", variant: "success", sessionID: id })
            },
          },
        ],
        bindings: [
          "opencode-mods.command.arquivos",
          "opencode-mods.command.linha-do-tempo",
          "opencode-mods.command.limpar-linha-do-tempo",
          "opencode-mods.command.limpar-dados",
        ],
      }))
    }

    if (customize) {
      cleanups.push(installThemeSync(ctx))
      ctx.keymap.layer(() => ({
        mode: "global",
        priority: 40,
        commands: [
          {
            id: "opencode-mods.command.customize",
            title: "Customizar OpenCode",
            group: "opencode-mods",
            palette: true,
            slash: { name: "customize-opencode" },
            run: async () => {
              const id = currentSessionID(ctx)
              try {
                const text = await openCustomize(ctx, ctx.themeMode, ctx.theme)
                ctx.ui.toast.show({ message: text, variant: "success", sessionID: id })
              } catch (error) {
                ctx.ui.toast.show({ message: `Não consegui abrir a customização: ${String(error)}`, variant: "error" })
              }
            },
          },
        ],
        bindings: ["opencode-mods.command.customize"],
      }))
    }

    return () => {
      for (const cleanup of cleanups) cleanup()
    }
  },
})
