export function pad(n: number): string {
  return String(n).padStart(2, "0")
}

export function money(usd: number | null | undefined, estimated = false): string {
  if (usd === null || usd === undefined) return "—"
  const value = usd < 0.01 ? `US$${usd.toFixed(3)}` : `US$${usd.toFixed(2)}`
  return estimated ? `~${value}` : value
}

export function duration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "—"
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  return m < 60 ? `${m}m${pad(s % 60)}s` : `${Math.floor(m / 60)}h${pad(m % 60)}m`
}

export function tokens(n: number | null | undefined): string {
  if (!n) return "0"
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

export function oneLine(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim()
  return t.length > max ? t.slice(0, max - 1) + "…" : t
}

export function fit(text: string, width: number): string {
  if (text.length <= width) return text
  if (width <= 1) return "…"
  return "…" + text.slice(text.length - (width - 1))
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

export function normalizePath(value: string): string {
  return value.replace(/\\/g, "/")
}

export function fileName(value: string): string {
  const normalized = normalizePath(value)
  return normalized.split("/").pop() || normalized
}

export function parentDir(value: string): string {
  const normalized = normalizePath(value)
  const name = fileName(normalized)
  return normalized.slice(0, normalized.length - name.length).replace(/\/$/, "") || "."
}

export function formatDurationSince(ms: number): string {
  return duration(Math.max(0, Date.now() - ms))
}

export function mask(text: string, max: number): string {
  return oneLine(text.replace(/[\x00-\x1F\x7F]/g, ""), max)
}
