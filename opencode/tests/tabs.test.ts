import assert from "node:assert/strict"
import test from "node:test"
import { nextTab, TABS } from "../src/tui/constants"

test("a próxima aba avança e volta para o início", () => {
  assert.equal(nextTab("files", 1), "timeline")
  assert.equal(nextTab("timeline", 1), "explain")
  assert.equal(nextTab("explain", 1), "commands")
  assert.equal(nextTab("commands", 1), "files")
})

test("a aba anterior retrocede e volta para o fim", () => {
  assert.equal(nextTab("files", -1), "commands")
  assert.equal(nextTab("timeline", -1), "files")
  assert.equal(nextTab("commands", -1), "explain")
})

test("saltos maiores dão a volta sem estourar o índice", () => {
  assert.equal(nextTab("files", TABS.length), "files")
  assert.equal(nextTab("files", TABS.length + 1), "timeline")
  assert.equal(nextTab("files", -TABS.length - 1), "commands")
})

test("uma aba desconhecida começa pela primeira", () => {
  assert.equal(nextTab("desconhecida" as never, 1), "timeline")
})
