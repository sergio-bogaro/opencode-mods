import assert from "node:assert/strict"
import test from "node:test"
import type { ModelInfo, SessionMessageInfo } from "@opencode/client"
import { applyCutoff, applySessionCost, buildTimeline } from "../src/tui/files/data"

function user(id: string, created: number, text = id): SessionMessageInfo {
  return { id, type: "user", time: { created }, text }
}

function assistant(id: string, created: number): SessionMessageInfo {
  return {
    id,
    type: "assistant",
    time: { created },
    agent: "build",
    model: { providerID: "test", modelID: "test" },
    content: [],
    cost: 0.1,
  } as unknown as SessionMessageInfo
}

function idle(id: string, created: number): SessionMessageInfo {
  return { id, type: "idle", time: { created }, outcome: "succeeded" }
}

function turn(number: number, start: number, text: string): SessionMessageInfo[] {
  return [user(`u${number}`, start, text), assistant(`a${number}`, start + 10), idle(`i${number}`, start + 20)]
}

const messages: SessionMessageInfo[] = [...turn(1, 100, "primeira"), ...turn(2, 200, "segunda")]

test("corte em uma pergunta esconde o turno inteiro", () => {
  assert.deepEqual(
    applyCutoff(messages, "u1").map(message => message.id),
    ["u2", "a2", "i2"],
  )
  const timeline = buildTimeline(applyCutoff(messages, "u1"), undefined)
  assert.deepEqual(
    timeline.questions.map(question => [question.n, question.text]),
    [[1, "segunda"]],
  )
})

test("corte no meio de um turno pula para a próxima pergunta", () => {
  for (const cutoff of ["a1", "i1"]) {
    assert.deepEqual(
      applyCutoff(messages, cutoff).map(message => message.id),
      ["u2", "a2", "i2"],
    )
    assert.deepEqual(
      buildTimeline(applyCutoff(messages, cutoff), undefined).questions.map(question => question.n),
      [1],
    )
  }
})

test("corte na última pergunta esvazia a linha do tempo", () => {
  assert.deepEqual(applyCutoff(messages, "u2"), [])
  assert.deepEqual(buildTimeline(applyCutoff(messages, "u2"), undefined).questions, [])
})

test("corte na última mensagem esvazia a linha do tempo", () => {
  assert.deepEqual(applyCutoff(messages, "i2"), [])
  assert.deepEqual(buildTimeline(applyCutoff(messages, "i2"), undefined).questions, [])
})

test("novas mensagens do turno cortado não criam pergunta fantasma", () => {
  const running = [...messages, assistant("a2b", 320)]
  assert.deepEqual(applyCutoff(running, "u2"), [])
  assert.deepEqual(buildTimeline(applyCutoff(running, "u2"), undefined).questions, [])

  const next = [...running, ...turn(3, 400, "terceira")]
  const timeline = buildTimeline(applyCutoff(next, "u2"), undefined)
  assert.deepEqual(
    timeline.questions.map(question => [question.n, question.text]),
    [[1, "terceira"]],
  )
})

test("corte desconhecido mantém a linha do tempo", () => {
  assert.deepEqual(applyCutoff(messages, "missing"), messages)
  assert.equal(buildTimeline(applyCutoff(messages, "missing"), undefined).questions.length, 2)
})

test("estima o custo com o modelo de cada mensagem", () => {
  const cheap = {
    providerID: "p",
    modelID: "cheap",
    cost: [{ input: 1, output: 0, cache: { read: 0, write: 0 } }],
    limit: { context: 1000 },
  } as unknown as ModelInfo
  const expensive = {
    providerID: "p",
    modelID: "expensive",
    cost: [{ input: 10, output: 0, cache: { read: 0, write: 0 } }],
    limit: { context: 2000 },
  } as unknown as ModelInfo
  const tokens = { input: 1_000_000, output: 0, reasoning: 0, cache: { read: 0, write: 0 } }

  const withModel = (id: string, created: number, modelID: string): SessionMessageInfo =>
    ({
      id,
      type: "assistant",
      time: { created },
      agent: "build",
      model: { providerID: "p", id: modelID },
      content: [],
      cost: 0,
      tokens,
    }) as unknown as SessionMessageInfo

  const timeline = buildTimeline(
    [user("u1", 100), withModel("a1", 110, "cheap"), idle("i1", 120), user("u2", 200), withModel("a2", 210, "expensive"), idle("i2", 220)],
    expensive,
    ref => (ref?.id === "cheap" ? cheap : ref?.id === "expensive" ? expensive : undefined),
  )

  assert.equal(timeline.totalCost, 11)
  assert.deepEqual(
    timeline.questions.map(question => question.cost),
    [1, 10],
  )
})

test("custo de compactação fora do turno entra no total", () => {
  const timeline = buildTimeline(
    [
      ...turn(1, 100, "primeira"),
      {
        id: "c1",
        type: "compaction",
        time: { created: 150 },
        status: "completed",
        reason: "manual",
        summary: "resumo",
        cost: 0.5,
      } as unknown as SessionMessageInfo,
    ],
    undefined,
  )

  assert.equal(timeline.totalCost, 0.6)
  assert.equal(timeline.questions[0]?.n, 1)
  assert.equal(timeline.questions[1]?.n, 0)
  assert.equal(timeline.questions[1]?.cost, 0.5)
})

test("custo da sessão fora das mensagens vira uma linha própria", () => {
  const timeline = buildTimeline(turn(1, 100, "primeira"), undefined)
  assert.equal(timeline.totalCost, 0.1)

  applySessionCost(timeline, 0.35, 150)
  assert.equal(timeline.totalCost, 0.35)
  assert.equal(timeline.questions[0]?.text, "(subagentes/fora da timeline)")
  assert.ok(Math.abs((timeline.questions[0]?.cost ?? 0) - 0.25) < 1e-9)
  assert.equal(timeline.questions[0]?.n, 0)

  applySessionCost(timeline, 0.35, 160)
  assert.equal(timeline.questions.filter(question => question.id === "__outside__").length, 1)

  applySessionCost(timeline, 0.2, 170)
  assert.equal(timeline.totalCost, 0.35)
})
