import assert from "node:assert/strict"
import test from "node:test"
import { themeSignature, themeSnapshot } from "../src/tui/theme-snapshot.ts"

class RGBA {
  constructor(
    readonly r: number,
    readonly g: number,
    readonly b: number,
    readonly a = 255,
  ) {}
  toInts(): number[] {
    return [this.r, this.g, this.b, this.a]
  }
}

test("converte RGBA do TUI para hex e ignora funções e hues", () => {
  const snapshot = themeSnapshot({
    text: {
      base: new RGBA(255, 0, 0),
      muted: new RGBA(128, 128, 128, 128),
      action: {
        primary: {
          base: new RGBA(1, 2, 3),
          state: () => "x",
        },
      },
    },
    background: { base: "#101418", raised: { base: new RGBA(10, 20, 30) } },
    syntax: { keyword: new RGBA(102, 204, 255) },
    hue: { gray: new RGBA(0, 0, 0) },
    categorical: [new RGBA(1, 1, 1)],
    surface: () => "x",
  })

  assert.deepEqual(snapshot, {
    text: {
      base: "#FF0000",
      muted: "#80808080",
      action: { primary: { base: "#010203" } },
    },
    background: { base: "#101418", raised: { base: "#0A141E" } },
    syntax: { keyword: "#66CCFF" },
  })
})

test("aceita tema vazio ou inválido sem quebrar", () => {
  assert.deepEqual(themeSnapshot(null), {})
  assert.deepEqual(themeSnapshot("x"), {})
  assert.deepEqual(themeSnapshot({ text: "x" }), {})
})

test("a assinatura muda quando o modo ou uma cor muda", () => {
  const dark = themeSignature("dark", { text: { base: new RGBA(255, 0, 0) } })
  const light = themeSignature("light", { text: { base: new RGBA(255, 0, 0) } })
  const other = themeSignature("dark", { text: { base: new RGBA(0, 255, 0) } })
  assert.notEqual(dark, light)
  assert.notEqual(dark, other)
  assert.equal(themeSignature("dark", { text: { base: new RGBA(255, 0, 0) } }), dark)
})
