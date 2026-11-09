import type { Tab } from "./files/types"

export const PANEL = "opencode-mods.files"

export const TABS: readonly { id: Tab; icon: string; label: string; short: string }[] = [
  { id: "files", icon: "✎", label: "Arquivos", short: "Arq" },
  { id: "timeline", icon: "◷", label: "Tempo", short: "Tempo" },
  { id: "explain", icon: "✦", label: "BTW", short: "BTW" },
  { id: "commands", icon: "⌘", label: "Comandos", short: "Cmd" },
]

/** Próxima aba (ou anterior, com delta negativo), dando a volta no fim. */
export function nextTab(current: Tab, delta: number): Tab {
  const length = TABS.length
  const found = TABS.findIndex(item => item.id === current)
  const index = found < 0 ? 0 : found
  const step = ((delta % length) + length) % length
  return TABS[(index + step) % length]!.id
}

export const LOCAL_COMMANDS: readonly { name: string; description: string }[] = [
  { name: "limpar-linha-do-tempo", description: "Esvazia a linha do tempo desta sessão" },
  { name: "limpar-dados", description: "Zera o estado do painel desta sessão" },
  { name: "customize-opencode", description: "Abre a janela de customização do OpenCode" },
]

/** Comandos que continuam existindo, mas não aparecem na aba Comandos. */
const HIDDEN_COMMANDS = new Set(["arquivos", "linha-do-tempo", "init", "review", "goal"])

export function isHiddenCommand(name: string): boolean {
  return HIDDEN_COMMANDS.has(name.replace(/^\/+/, "").toLowerCase())
}
