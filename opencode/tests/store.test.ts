import assert from "node:assert/strict"
import test from "node:test"
import { normalizePrefs, prefsFor } from "../src/tui/files/store.ts"
import type { FilesState } from "../src/tui/files/types.ts"

test("completa preferências antigas com os padrões atuais", () => {
  const state = {
    sessions: {
      s1: { scope: "turn", tab: "files", selected: [], model: "session" },
    },
  } as unknown as FilesState

  const prefs = prefsFor(state, "s1")
  assert.deepEqual(prefs.explain, { status: "idle", title: "", text: "" })
  assert.deepEqual(prefs.selected, [])
  assert.equal(prefs.cutoff, undefined)
})

test("normaliza valores inválidos e descarta seleção que não é texto", () => {
  const prefs = normalizePrefs({
    scope: "qualquer",
    tab: "inexistente",
    selected: ["a.ts", 42, null],
    model: "",
    variant: 7,
    cutoff: 10,
    explain: { status: "qualquer", title: 1, text: null },
  })

  assert.equal(prefs.scope, "turn")
  assert.equal(prefs.tab, "files")
  assert.deepEqual(prefs.selected, ["a.ts"])
  assert.equal(prefs.model, "session")
  assert.equal(prefs.variant, undefined)
  assert.equal(prefs.cutoff, undefined)
  assert.deepEqual(prefs.explain, { status: "idle", title: "", text: "" })
})

test("marca explicação que ficou executando como interrompida", () => {
  const prefs = normalizePrefs({ explain: { status: "running", title: "t", text: "" } })
  assert.equal(prefs.explain.status, "error")
  assert.equal(prefs.explain.text, "A geração anterior foi interrompida.")
})

test("preferências ausentes usam o objeto padrão", () => {
  const state = { sessions: {} } as FilesState
  const prefs = prefsFor(state, "s1")
  assert.equal(prefs.scope, "turn")
  assert.equal(prefs.tab, "files")
  assert.equal(prefs.model, "session")
})
