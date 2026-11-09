import assert from "node:assert/strict"
import test from "node:test"
import { stepAutoOpen } from "../src/tui/auto-open"
import { PANEL } from "../src/tui/constants"

const home = { type: "home" } as const
const session = (sessionID: string) => ({ type: "session", sessionID }) as const
const shown = (sessionID: string) => ({ name: PANEL, sessionID })

test("abre na primeira sessão e não na tela inicial", () => {
  const start = stepAutoOpen(true, undefined, home, undefined)
  assert.deepEqual(start, { active: true, at: undefined, open: undefined })

  const first = stepAutoOpen(start.active, start.at, session("ses_1"), undefined)
  assert.deepEqual(first, { active: true, at: undefined, open: "ses_1" })
})

test("não reabre quando o painel já está na sessão", () => {
  const step = stepAutoOpen(true, undefined, session("ses_1"), shown("ses_1"))
  assert.deepEqual(step, { active: true, at: "ses_1", open: undefined })
})

test("acompanha a troca de sessão", () => {
  const step = stepAutoOpen(true, "ses_1", session("ses_2"), shown("ses_1"))
  assert.deepEqual(step, { active: true, at: "ses_1", open: "ses_2" })
})

test("fechado na mesma sessão, para de reabrir", () => {
  const step = stepAutoOpen(true, "ses_1", session("ses_1"), undefined)
  assert.deepEqual(step, { active: false, at: "ses_1", open: undefined })
})

test("voltar da tela inicial mantém o acompanhamento", () => {
  const hidden = stepAutoOpen(true, "ses_1", home, undefined)
  assert.deepEqual(hidden, { active: true, at: undefined, open: undefined })

  const again = stepAutoOpen(hidden.active, hidden.at, session("ses_1"), undefined)
  assert.deepEqual(again, { active: true, at: undefined, open: "ses_1" })
})

test("parado, não abre nada", () => {
  const step = stepAutoOpen(false, "ses_1", session("ses_2"), undefined)
  assert.deepEqual(step, { active: false, at: "ses_1", open: undefined })
})
