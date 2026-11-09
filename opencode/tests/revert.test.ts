import assert from "node:assert/strict"
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import type { Context } from "@opencode/plugin/tui/context"
import { revertFile, revertQuestion } from "../src/tui/files/revert.ts"
import type { FileRow } from "../src/tui/files/types.ts"

function fakeContext(directory: string): Context {
  return {
    data: { session: { get: () => ({ location: { directory } }) } },
    location: { directory },
  } as unknown as Context
}

function row(file: string, patch: string, status: FileRow["status"]): FileRow {
  return {
    file,
    patch,
    additions: 1,
    deletions: status === "deleted" ? 1 : 0,
    status,
    name: path.basename(file),
    dir: ".",
    absolute: file,
    created: status === "added",
    canRevert: true,
  }
}

async function sandbox(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "opencode-mods-revert-"))
}

const addedPatch = ["--- /dev/null", "+++ b/novo.txt", "@@ -0,0 +1,2 @@", "+linha 1", "+linha 2", ""].join("\n")

test("apaga um arquivo novo quando o conteúdo ainda é o do diff", async () => {
  const dir = await sandbox()
  try {
    const file = path.join(dir, "novo.txt")
    await writeFile(file, "linha 1\nlinha 2\n", "utf8")
    const result = await revertFile(fakeContext(dir), "s1", row("novo.txt", addedPatch, "added"))
    assert.deepEqual(result, { ok: true, text: "novo.txt apagado (rollback)" })
    await assert.rejects(readFile(file))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("não apaga um arquivo novo que mudou depois do diff", async () => {
  const dir = await sandbox()
  try {
    const file = path.join(dir, "novo.txt")
    await writeFile(file, "linha 1\neditado depois\n", "utf8")
    const result = await revertFile(fakeContext(dir), "s1", row("novo.txt", addedPatch, "added"))
    assert.equal(result.ok, false)
    assert.match(result.text, /mudou desde o diff/)
    assert.equal(await readFile(file, "utf8"), "linha 1\neditado depois\n")
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("não apaga um arquivo novo sem patch que permita conferir o conteúdo", async () => {
  const dir = await sandbox()
  try {
    const file = path.join(dir, "novo.txt")
    await writeFile(file, "conteúdo", "utf8")
    const result = await revertFile(fakeContext(dir), "s1", row("novo.txt", "", "added"))
    assert.equal(result.ok, false)
    assert.match(result.text, /não vou apagar/)
    assert.equal(await readFile(file, "utf8"), "conteúdo")
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("recria um arquivo removido quando ele continua ausente", async () => {
  const dir = await sandbox()
  try {
    const patch = ["--- a/antigo.txt", "+++ /dev/null", "@@ -1,2 +0,0 @@", "-linha 1", "-linha 2", ""].join("\n")
    const result = await revertFile(fakeContext(dir), "s1", row("antigo.txt", patch, "deleted"))
    assert.deepEqual(result, { ok: true, text: "antigo.txt recriado (rollback)" })
    assert.equal(await readFile(path.join(dir, "antigo.txt"), "utf8"), "linha 1\nlinha 2\n")
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("não sobrescreve um arquivo removido que foi recriado depois", async () => {
  const dir = await sandbox()
  try {
    const file = path.join(dir, "antigo.txt")
    await writeFile(file, "versão nova", "utf8")
    const patch = ["--- a/antigo.txt", "+++ /dev/null", "@@ -1,1 +0,0 @@", "-versão antiga", ""].join("\n")
    const result = await revertFile(fakeContext(dir), "s1", row("antigo.txt", patch, "deleted"))
    assert.equal(result.ok, false)
    assert.match(result.text, /recriado depois do diff/)
    assert.equal(await readFile(file, "utf8"), "versão nova")
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("restaura um arquivo modificado e recusa quando o conteúdo divergiu", async () => {
  const dir = await sandbox()
  try {
    const file = path.join(dir, "f.txt")
    const patch = ["--- a/f.txt", "+++ b/f.txt", "@@ -1,2 +1,2 @@", " keep", "-old", "+new", ""].join("\n")

    await writeFile(file, "keep\nnew\n", "utf8")
    assert.deepEqual(await revertFile(fakeContext(dir), "s1", row("f.txt", patch, "modified")), {
      ok: true,
      text: "f.txt restaurado (rollback)",
    })
    assert.equal(await readFile(file, "utf8"), "keep\nold\n")

    await writeFile(file, "keep\ndifferent\n", "utf8")
    const result = await revertFile(fakeContext(dir), "s1", row("f.txt", patch, "modified"))
    assert.equal(result.ok, false)
    assert.match(result.text, /mudou desde o diff/)
    assert.equal(await readFile(file, "utf8"), "keep\ndifferent\n")
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("recusa caminho fora do diretório da sessão", async () => {
  const dir = await sandbox()
  try {
    const result = await revertFile(fakeContext(dir), "s1", row("../fora.txt", addedPatch, "added"))
    assert.equal(result.ok, false)
    assert.match(result.text, /fora do projeto/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

function questionContext(): { ctx: Context; staged: Array<{ messageID?: string }> } {
  const messages = [
    { id: "u1", type: "user", time: { created: 1 }, text: "primeira" },
    { id: "u2", type: "user", time: { created: 2 }, text: "segunda" },
    { id: "u3", type: "user", time: { created: 3 }, text: "terceira" },
  ]
  const staged: Array<{ messageID?: string }> = []
  const ctx = {
    data: {
      session: {
        message: {
          sync: async () => undefined,
          list: () => messages,
        },
      },
    },
    client: {
      session: {
        revert: {
          stage: async (input: { messageID?: string }) => {
            staged.push(input)
          },
          commit: async () => undefined,
          clear: async () => undefined,
        },
      },
    },
  } as unknown as Context
  return { ctx, staged }
}

test("reverte a pergunta destacada, não sempre a última", async () => {
  const { ctx, staged } = questionContext()
  const result = await revertQuestion(ctx, "s1", "turn", "u2")
  assert.deepEqual(result, {
    ok: true,
    text: "Arquivos e conversa voltaram ao estado anterior à pergunta selecionada.",
  })
  assert.equal(staged[0]?.messageID, "u2")
})

test("recusa uma pergunta destacada que não existe mais", async () => {
  const { ctx, staged } = questionContext()
  const result = await revertQuestion(ctx, "s1", "turn", "sumiu")
  assert.equal(result.ok, false)
  assert.match(result.text, /não encontrei/)
  assert.equal(staged.length, 0)
})

test("sem alvo explícito, reverter turno usa a última pergunta", async () => {
  const { ctx, staged } = questionContext()
  const result = await revertQuestion(ctx, "s1", "turn")
  assert.equal(result.ok, true)
  assert.equal(staged[0]?.messageID, "u3")
})

test("não escreve através de link simbólico", async t => {
  const dir = await sandbox()
  try {
    const target = path.join(dir, "real.txt")
    const link = path.join(dir, "link.txt")
    await writeFile(target, "keep\nnew\n", "utf8")
    try {
      await symlink(target, link, "file")
    } catch {
      t.skip("criação de symlink não permitida neste ambiente")
      return
    }

    const patch = ["--- a/f.txt", "+++ b/f.txt", "@@ -1,2 +1,2 @@", " keep", "-old", "+new", ""].join("\n")
    const result = await revertFile(fakeContext(dir), "s1", row("link.txt", patch, "modified"))
    assert.equal(result.ok, false)
    assert.match(result.text, /link simbólico/)
    assert.equal(await readFile(target, "utf8"), "keep\nnew\n")
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
