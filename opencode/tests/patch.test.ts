import assert from "node:assert/strict"
import test from "node:test"
import { reversePatch } from "../src/shared/patch.ts"

test("reverte um arquivo modificado", () => {
  const patch = [
    "--- a/f.txt",
    "+++ b/f.txt",
    "@@ -1,3 +1,4 @@",
    " line1",
    "-line2",
    "+line2 changed",
    " line3",
    "+line4",
    "",
  ].join("\n")
  const result = reversePatch("line1\nline2 changed\nline3\nline4\n", patch, "modified")
  assert.deepEqual(result, { ok: true, content: "line1\nline2\nline3\n" })
})

test("reverte um arquivo novo apagando", () => {
  const result = reversePatch(null, "", "added")
  assert.deepEqual(result, { ok: true, content: null })
})

test("reconstrói um arquivo removido", () => {
  const patch = ["--- a/f.txt", "+++ /dev/null", "@@ -1,2 +0,0 @@", "-old1", "-old2", ""].join("\n")
  const result = reversePatch(null, patch, "deleted")
  assert.deepEqual(result, { ok: true, content: "old1\nold2\n" })
})

test("preserva a ausência de quebra de linha no fim", () => {
  const patch = [
    "--- a/f.txt",
    "+++ b/f.txt",
    "@@ -1 +1 @@",
    "-old",
    "\\ No newline at end of file",
    "+new",
    "\\ No newline at end of file",
    "",
  ].join("\n")
  const result = reversePatch("new", patch, "modified")
  assert.deepEqual(result, { ok: true, content: "old" })
})

test("restaura a quebra de linha que o arquivo atual não tem", () => {
  const patch = [
    "--- a/f.txt",
    "+++ b/f.txt",
    "@@ -1 +1 @@",
    "-old",
    "+new",
    "\\ No newline at end of file",
    "",
  ].join("\n")
  const result = reversePatch("new", patch, "modified")
  assert.deepEqual(result, { ok: true, content: "old\n" })
})

test("recusa quando o arquivo mudou depois do diff", () => {
  const patch = [
    "--- a/f.txt",
    "+++ b/f.txt",
    "@@ -1,2 +1,2 @@",
    " line1",
    "-old",
    "+new",
    "",
  ].join("\n")
  const result = reversePatch("line1\ndifferent\n", patch, "modified")
  assert.equal(result.ok, false)
})

test("trata linhas de conteúdo que parecem cabeçalho de arquivo", () => {
  const patch = [
    "--- a/f.txt",
    "+++ b/f.txt",
    "@@ -1,2 +1,2 @@",
    " keep",
    "---old",
    "+++new",
    "",
  ].join("\n")
  const result = reversePatch("keep\n++new\n", patch, "modified")
  assert.deepEqual(result, { ok: true, content: "keep\n--old\n" })
})

test("reverte múltiplos hunks", () => {
  const patch = [
    "--- a/f.txt",
    "+++ b/f.txt",
    "@@ -1,2 +1,2 @@",
    " one",
    "-two",
    "+TWO",
    "@@ -10,2 +10,2 @@",
    " ten",
    "-eleven",
    "+ELEVEN",
    "",
  ].join("\n")
  const source = ["one", "TWO", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "ELEVEN", ""].join(
    "\n",
  )
  const result = reversePatch(source, patch, "modified")
  assert.deepEqual(result, {
    ok: true,
    content: ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", ""].join("\n"),
  })
})

test("recusa um hunk truncado", () => {
  const patch = ["--- a/f.txt", "+++ b/f.txt", "@@ -1,3 +1,3 @@", " one", "-two", "+TWO", ""].join("\n")
  const result = reversePatch("one\nTWO\n", patch, "modified")
  assert.equal(result.ok, false)
})
