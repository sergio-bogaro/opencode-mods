import assert from "node:assert/strict"
import test from "node:test"
import type { ModelInfo, TokenUsageInfo } from "@opencode/client"
import { messageCost, modelCost } from "../src/tui/files/data"

const tokens: TokenUsageInfo = {
  input: 1_000_000,
  output: 1_000_000,
  reasoning: 0,
  cache: { read: 1_000_000, write: 0 },
}

const model = {
  cost: [{ input: 0.15, output: 0.6, cache: { read: 0.003, write: 0 } }],
} as ModelInfo

test("estima o custo pela tabela de preços do modelo", () => {
  const value = modelCost(tokens, model)
  assert.ok(Math.abs(value - 0.753) < 1e-9, `esperava 0.753, recebeu ${value}`)
})

test("prefere o custo reportado pelo provedor", () => {
  assert.deepEqual(messageCost({ cost: 0.5, tokens }, model), { value: 0.5, estimated: false })
})

test("cai na estimativa quando o provedor reporta zero", () => {
  const result = messageCost({ cost: 0, tokens }, model)
  assert.equal(result.estimated, true)
  assert.ok(Math.abs(result.value - 0.753) < 1e-9, `esperava 0.753, recebeu ${result.value}`)
})

test("escolhe o tier de contexto correto", () => {
  const tiered = {
    cost: [
      { input: 1, output: 2, cache: { read: 0, write: 0 } },
      { tier: { type: "context", size: 1000 }, input: 2, output: 4, cache: { read: 0, write: 0 } },
    ],
  } as ModelInfo
  const small: TokenUsageInfo = { input: 500, output: 0, reasoning: 0, cache: { read: 0, write: 0 } }
  const large: TokenUsageInfo = { input: 1500, output: 0, reasoning: 0, cache: { read: 0, write: 0 } }

  assert.equal(modelCost(small, tiered), 500 * 1 / 1_000_000)
  assert.equal(modelCost(large, tiered), 1500 * 2 / 1_000_000)
})

test("sem tokens ou sem preço, o custo é zero", () => {
  assert.equal(modelCost(undefined, model), 0)
  assert.equal(modelCost(tokens, undefined), 0)
  assert.deepEqual(messageCost({ cost: 0 }, model), { value: 0, estimated: false })
})
