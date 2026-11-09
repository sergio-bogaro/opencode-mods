export type PatchStatus = "added" | "deleted" | "modified"

export type ReverseResult =
  | { ok: true; content: string | null }
  | { ok: false; error: string }

type Hunk = {
  oldStart: number
  oldCount: number
  newStart: number
  newCount: number
  lines: string[]
}

type Parsed = {
  hunks: Hunk[]
  /** O patch diz que o conteúdo antigo não termina com quebra de linha. */
  oldNoNewline: boolean
  /** O patch diz que o conteúdo novo (atual) não termina com quebra de linha. */
  newNoNewline: boolean
}

function parseHunks(patch: string): Parsed | null {
  const lines = patch.replace(/\r\n/g, "\n").split("\n")
  const hunks: Hunk[] = []
  let current: Hunk | null = null
  let oldRemaining = 0
  let newRemaining = 0
  let oldNoNewline = false
  let newNoNewline = false
  let lastKind: "old" | "new" | "context" | "" = ""

  for (const raw of lines) {
    if (raw.startsWith("@@")) {
      const match = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(raw)
      if (!match) return null
      current = {
        oldStart: Number(match[1]),
        oldCount: match[2] === undefined ? 1 : Number(match[2]),
        newStart: Number(match[3]),
        newCount: match[4] === undefined ? 1 : Number(match[4]),
        lines: [],
      }
      oldRemaining = current.oldCount
      newRemaining = current.newCount
      hunks.push(current)
      lastKind = ""
      continue
    }
    if (!current) {
      // Depois de um hunk completo, um novo cabeçalho de arquivo começa outro
      // diff; não misture os dois no mesmo resultado.
      if (hunks.length > 0 && (raw.startsWith("diff ") || raw.startsWith("--- ") || raw.startsWith("+++ "))) break
      continue
    }
    if (raw.startsWith("\\ No newline at end of file")) {
      if (lastKind === "old") oldNoNewline = true
      else if (lastKind === "new") newNoNewline = true
      else if (lastKind === "context") {
        oldNoNewline = true
        newNoNewline = true
      }
      continue
    }
    if (oldRemaining === 0 && newRemaining === 0) {
      // O hunk terminou. Cabeçalhos de arquivo e o próximo hunk não são conteúdo.
      current = null
      continue
    }
    if (raw === "") continue

    const kind = raw[0]
    if (kind !== " " && kind !== "+" && kind !== "-") continue
    if (kind === " ") {
      if (oldRemaining === 0 || newRemaining === 0) return null
      oldRemaining--
      newRemaining--
    } else if (kind === "+") {
      if (newRemaining === 0) return null
      newRemaining--
    } else {
      if (oldRemaining === 0) return null
      oldRemaining--
    }
    current.lines.push(raw)
    lastKind = kind === " " ? "context" : kind === "+" ? "new" : "old"
  }

  if (current && (oldRemaining !== 0 || newRemaining !== 0)) return null
  return hunks.length ? { hunks, oldNoNewline, newNoNewline } : null
}

function collectOldLines(parsed: Parsed): string[] {
  const out: string[] = []
  for (const hunk of parsed.hunks) {
    for (const line of hunk.lines) {
      if (line[0] === "-" || line[0] === " ") out.push(line.slice(1))
    }
  }
  return out
}

function collectNewLines(parsed: Parsed): string[] {
  const out: string[] = []
  for (const hunk of parsed.hunks) {
    for (const line of hunk.lines) {
      if (line[0] === "+" || line[0] === " ") out.push(line.slice(1))
    }
  }
  return out
}

/**
 * Conteúdo que um arquivo novo deve ter depois do patch. Serve para conferir
 * que o arquivo atual ainda é o que o diff adicionou antes de apagá-lo.
 */
export function addedContent(patch: string, eol = "\n"): string | null {
  const parsed = parseHunks(patch)
  if (!parsed) return null
  const lines = collectNewLines(parsed)
  if (lines.length === 0) return ""
  return lines.join(eol) + (parsed.newNoNewline ? "" : eol)
}

function sameLines(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((line, i) => line === right[i])
}

/**
 * Aplica o inverso de um patch unificado.
 *
 * `source` é o conteúdo atual (depois do patch); `null` quando o arquivo não
 * existe mais. Para arquivos removidos, o conteúdo antigo é reconstruído a
 * partir das linhas `-` do patch.
 */
export function reversePatch(source: string | null, patch: string, status: PatchStatus): ReverseResult {
  if (status === "added") return { ok: true, content: null }
  if (!patch.trim()) return { ok: false, error: "o diff deste arquivo não foi registrado" }

  const parsed = parseHunks(patch)
  if (!parsed) return { ok: false, error: "o patch não tem hunks válidos" }

  const eol = source?.includes("\r\n") ? "\r\n" : "\n"

  if (status === "deleted" || source === null) {
    const old = collectOldLines(parsed)
    if (old.length === 0) return { ok: false, error: "não há conteúdo antigo no patch" }
    return { ok: true, content: old.join(eol) + (parsed.oldNoNewline ? "" : eol) }
  }

  const normalized = source.replace(/\r\n/g, "\n")
  const endsWithNewline = normalized.endsWith("\n")
  const lines = (endsWithNewline ? normalized.slice(0, -1) : normalized).split("\n")
  const out: string[] = []
  let cursor = 0

  for (const hunk of parsed.hunks) {
    const after = hunk.lines.filter(line => line[0] === " " || line[0] === "+").map(line => line.slice(1))
    const before = hunk.lines.filter(line => line[0] === " " || line[0] === "-").map(line => line.slice(1))
    const start = hunk.newStart === 0 ? 0 : hunk.newStart - 1
    if (start < cursor || start + after.length > lines.length) {
      return { ok: false, error: "o patch não encaixa no arquivo atual" }
    }
    if (!sameLines(lines.slice(start, start + after.length), after)) {
      return { ok: false, error: "o arquivo mudou desde o diff; não dá para desfazer só ele" }
    }
    out.push(...lines.slice(cursor, start))
    out.push(...before)
    cursor = start + after.length
  }
  out.push(...lines.slice(cursor))

  const lastHunk = parsed.hunks[parsed.hunks.length - 1]!
  const lastAfter = lastHunk.lines.filter(line => line[0] === " " || line[0] === "+").length
  const touchesEof = lastHunk.newStart === 0 || lastHunk.newStart - 1 + lastAfter >= lines.length
  const resultEndsWithNewline = touchesEof ? !parsed.oldNoNewline : endsWithNewline
  return { ok: true, content: out.join(eol) + (resultEndsWithNewline ? eol : "") }
}

/** Só para testes/manutenção: mostra se o patch parece reversível. */
export function canReverse(patch: string): boolean {
  return parseHunks(patch) !== null
}
