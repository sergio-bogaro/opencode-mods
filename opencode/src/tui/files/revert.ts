import { lstat, mkdir, readFile, unlink, writeFile } from "node:fs/promises"
import path from "node:path"
import type { SessionMessageInfo } from "@opencode/client"
import type { Context } from "@opencode/plugin/tui/context"
import { addedContent, reversePatch } from "../../shared/patch"
import { loadMessages, sessionLocation } from "./data"
import type { FileRow, Scope } from "./types"

function errno(error: unknown): string | undefined {
  return (error as NodeJS.ErrnoException | undefined)?.code
}

export type RevertResult = { ok: true; text: string } | { ok: false; text: string }

function inside(base: string, target: string): boolean {
  const normalizedBase = path.resolve(base)
  const normalizedTarget = path.resolve(target)
  const relative = path.relative(normalizedBase, normalizedTarget)
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))
}

function absoluteFor(base: string, file: string): string {
  return path.isAbsolute(file) ? file : path.resolve(base, file)
}

export async function revertFile(ctx: Context, sessionID: string, row: FileRow): Promise<RevertResult> {
  const base = sessionLocation(ctx, sessionID).directory
  const absolute = absoluteFor(base, row.file)
  const name = path.basename(absolute)
  if (!inside(base, absolute)) return { ok: false, text: "o caminho do arquivo está fora do projeto" }
  if (!row.canRevert) return { ok: false, text: "este arquivo não tem diff reversível" }

  if (row.status === "added") {
    let info
    try {
      info = await lstat(absolute)
    } catch (error) {
      if (errno(error) === "ENOENT") return { ok: true, text: `${name} já não existe (rollback)` }
      return { ok: false, text: "não consegui verificar o arquivo atual" }
    }
    if (info.isSymbolicLink()) return { ok: false, text: "o arquivo é um link simbólico; não vou apagá-lo" }

    let current: string
    try {
      current = await readFile(absolute, "utf8")
    } catch (error) {
      return { ok: false, text: `não consegui ler o arquivo atual: ${String(error)}` }
    }

    const eol = current.includes("\r\n") ? "\r\n" : "\n"
    const expected = addedContent(row.patch, eol)
    if (expected === null) {
      if (current !== "") {
        return { ok: false, text: "não dá para confirmar o conteúdo que este diff adicionou; não vou apagar o arquivo" }
      }
    } else if (current !== expected) {
      return { ok: false, text: "o arquivo mudou desde o diff; não vou apagar as alterações posteriores" }
    }

    try {
      await unlink(absolute)
      return { ok: true, text: `${name} apagado (rollback)` }
    } catch (error) {
      return { ok: false, text: `não consegui apagar o arquivo: ${String(error)}` }
    }
  }

  let source: string | null = null
  if (row.status === "deleted") {
    try {
      await lstat(absolute)
      return { ok: false, text: "o arquivo foi recriado depois do diff; não vou sobrescrever" }
    } catch (error) {
      if (errno(error) !== "ENOENT") return { ok: false, text: "não consegui verificar o arquivo atual" }
    }
  } else {
    let info
    try {
      info = await lstat(absolute)
    } catch (error) {
      if (errno(error) === "ENOENT") {
        return { ok: false, text: "o arquivo atual não existe; não dá para desfazer só ele" }
      }
      return { ok: false, text: "não consegui verificar o arquivo atual" }
    }
    if (info.isSymbolicLink()) return { ok: false, text: "o arquivo é um link simbólico; não vou escrever através dele" }
    try {
      source = await readFile(absolute, "utf8")
    } catch (error) {
      return { ok: false, text: `não consegui ler o arquivo atual: ${String(error)}` }
    }
  }

  const reversed = reversePatch(source, row.patch, row.status)
  if (!reversed.ok) return { ok: false, text: reversed.error }

  try {
    if (reversed.content === null) {
      await unlink(absolute).catch(error => {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
      })
      return { ok: true, text: `${name} apagado (rollback)` }
    }
    await mkdir(path.dirname(absolute), { recursive: true })
    await writeFile(absolute, reversed.content, "utf8")
    return {
      ok: true,
      text: row.status === "deleted" ? `${name} recriado (rollback)` : `${name} restaurado (rollback)`,
    }
  } catch (error) {
    return { ok: false, text: `não consegui escrever o arquivo: ${String(error)}` }
  }
}

export async function revertQuestion(
  ctx: Context,
  sessionID: string,
  scope: Scope,
  messageID?: string,
): Promise<RevertResult> {
  let messages: SessionMessageInfo[]
  try {
    messages = await loadMessages(ctx, sessionID)
  } catch (error) {
    return { ok: false, text: `não consegui carregar a sessão: ${String(error)}` }
  }
  const users = messages.filter(message => message.type === "user")
  if (users.length === 0) return { ok: false, text: "não há pergunta para desfazer" }
  const target =
    scope === "session"
      ? users[0]!
      : messageID
        ? users.find(message => message.id === messageID)
        : users[users.length - 1]!
  if (!target) return { ok: false, text: "não encontrei a pergunta selecionada; recarregue o painel" }
  try {
    await ctx.client.session.revert.stage({
      sessionID,
      messageID: target.id,
      files: true,
    })
    await ctx.client.session.revert.commit({ sessionID })
    const lastUser = users[users.length - 1]!.id
    return {
      ok: true,
      text:
        scope === "session"
          ? "Arquivos e conversa voltaram ao início da sessão."
          : target.id === lastUser
            ? "Arquivos e conversa da última pergunta foram desfeitos."
            : "Arquivos e conversa voltaram ao estado anterior à pergunta selecionada.",
    }
  } catch (error) {
    await ctx.client.session.revert.clear({ sessionID }).catch(() => undefined)
    return { ok: false, text: `não consegui reverter: ${String(error)}` }
  }
}
