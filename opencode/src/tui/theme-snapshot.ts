const THEME_GROUPS = ["text", "background", "border", "scrollbar", "diff", "syntax", "markdown", "@dialog"] as const

function isRGBA(value: unknown): value is { toInts: () => number[] } {
  return !!value && typeof value === "object" && typeof (value as { toInts?: unknown }).toInts === "function"
}

function byte(value: number): string {
  return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0")
}

function rgbaToHex(value: { toInts: () => number[] }): string {
  const [r = 0, g = 0, b = 0, a = 255] = value.toInts()
  return `#${byte(r)}${byte(g)}${byte(b)}${a < 255 ? byte(a) : ""}`.toUpperCase()
}

function snapshotValue(value: unknown): unknown {
  if (isRGBA(value)) return rgbaToHex(value)
  if (typeof value === "string") return value
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const out: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value)) {
      if (key === "state" || key === "source" || key === "increase" || key === "decrease") continue
      const clean = snapshotValue(item)
      if (clean !== undefined) out[key] = clean
    }
    return out
  }
  return undefined
}

/** Converte o ResolvedTheme (RGBA) do TUI em JSON de cores para o servidor. */
export function themeSnapshot(theme: unknown): Record<string, unknown> {
  if (!theme || typeof theme !== "object") return {}
  const source = theme as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const group of THEME_GROUPS) {
    const value = source[group]
    if (!value || typeof value !== "object") continue
    const clean = snapshotValue(value)
    if (clean && typeof clean === "object") out[group] = clean
  }
  return out
}

/** Assinatura barata para detectar troca de tema no TUI. */
export function themeSignature(mode: string, theme: unknown): string {
  return mode + JSON.stringify(themeSnapshot(theme))
}
