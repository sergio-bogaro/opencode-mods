import assert from "node:assert/strict"
import test from "node:test"
import { duration, fileName, fit, money, normalizePath, oneLine, parentDir, plural, tokens } from "../src/shared/format.ts"

test("formata dinheiro, duração e tokens", () => {
  assert.equal(money(0.34), "US$0.34")
  assert.equal(money(0.003), "US$0.003")
  assert.equal(money(0.34, true), "~US$0.34")
  assert.equal(money(undefined), "—")

  assert.equal(duration(0), "0s")
  assert.equal(duration(65_000), "1m05s")
  assert.equal(duration(3_660_000), "1h01m")
  assert.equal(duration(undefined), "—")

  assert.equal(tokens(0), "0")
  assert.equal(tokens(999), "999")
  assert.equal(tokens(1_500), "1.5k")
  assert.equal(tokens(2_000_000), "2.0M")
})

test("normaliza caminhos e mantém o final visível", () => {
  assert.equal(normalizePath("a\\b\\c.ts"), "a/b/c.ts")
  assert.equal(fileName("a/b/c.ts"), "c.ts")
  assert.equal(parentDir("a/b/c.ts"), "a/b")
  assert.equal(parentDir("c.ts"), ".")
  assert.equal(fit("src/components/panel.tsx", 12), "…s/panel.tsx")
  assert.equal(oneLine("  a\n\t b  ", 10), "a b")
  assert.equal(oneLine("abcdefgh", 5), "abcd…")
  assert.equal(plural(1, "arquivo", "arquivos"), "1 arquivo")
  assert.equal(plural(2, "arquivo", "arquivos"), "2 arquivos")
})
