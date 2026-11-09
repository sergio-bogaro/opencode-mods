import assert from "node:assert/strict"
import test from "node:test"
import type { Context } from "@opencode/plugin/tui/context"
import { createStore, produce, type Store } from "solid-js/store"
import {
  clearFocusRequest,
  consumeFocusRequest,
  requestFocus,
  requestedTab,
  setRequestedTab,
} from "../src/tui/request"
import type { Tab } from "../src/tui/files/types"

type RequestState = { tab: Tab | null; focus: boolean }

function fakeContext(): Context {
  const memories = new Map<string, readonly [Store<RequestState>, (mutation: (draft: RequestState) => void) => void]>()
  return {
    storage: {
      memory(key: string, options: { initial: RequestState }) {
        const existing = memories.get(key)
        if (existing) return existing
        const [store, setStore] = createStore(options.initial)
        const entry = [store, (mutation: (draft: RequestState) => void) => setStore(produce(mutation))] as const
        memories.set(key, entry)
        return entry
      },
    },
  } as unknown as Context
}

test("guarda e limpa a aba pedida no storage de memória do host", () => {
  const ctx = fakeContext()

  assert.equal(requestedTab(ctx, "s1"), null)
  setRequestedTab(ctx, "s1", "timeline")
  assert.equal(requestedTab(ctx, "s1"), "timeline")
  setRequestedTab(ctx, "s1", "files")
  assert.equal(requestedTab(ctx, "s1"), "files")
  setRequestedTab(ctx, "s1", null)
  assert.equal(requestedTab(ctx, "s1"), null)
})

test("duas leituras do mesmo contexto compartilham o mesmo pedido", () => {
  const ctx = fakeContext()

  setRequestedTab(ctx, "s1", "explain")
  assert.equal(requestedTab(ctx, "s1"), "explain")
  assert.equal(requestedTab(ctx, "s1"), "explain")
})

test("pedidos de sessões diferentes não se misturam", () => {
  const ctx = fakeContext()

  setRequestedTab(ctx, "s1", "timeline")
  setRequestedTab(ctx, "s2", "files")

  assert.equal(requestedTab(ctx, "s1"), "timeline")
  assert.equal(requestedTab(ctx, "s2"), "files")
  assert.equal(requestedTab(ctx, "s3"), null)
})

test("o pedido de foco é consumido uma única vez", () => {
  const ctx = fakeContext()

  assert.equal(consumeFocusRequest(ctx, "s1"), false)
  requestFocus(ctx, "s1")
  assert.equal(consumeFocusRequest(ctx, "s1"), true)
  assert.equal(consumeFocusRequest(ctx, "s1"), false)
})

test("o foco também é isolado por sessão", () => {
  const ctx = fakeContext()

  requestFocus(ctx, "s1")
  assert.equal(consumeFocusRequest(ctx, "s2"), false)
  assert.equal(consumeFocusRequest(ctx, "s1"), true)
})

test("limpar o pedido de foco não mexe na aba pedida", () => {
  const ctx = fakeContext()

  setRequestedTab(ctx, "s1", "timeline")
  requestFocus(ctx, "s1")
  clearFocusRequest(ctx, "s1")

  assert.equal(consumeFocusRequest(ctx, "s1"), false)
  assert.equal(requestedTab(ctx, "s1"), "timeline")
})
