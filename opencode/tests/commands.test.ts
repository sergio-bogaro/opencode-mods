import assert from "node:assert/strict"
import test from "node:test"
import { isHiddenCommand, LOCAL_COMMANDS } from "../src/tui/constants"

test("comandos ocultos não aparecem na aba Comandos", () => {
  for (const name of ["arquivos", "linha-do-tempo", "init", "review", "goal"]) {
    assert.equal(isHiddenCommand(name), true)
    assert.equal(isHiddenCommand(`/${name}`), true)
    assert.equal(isHiddenCommand(name.toUpperCase()), true)
  }

  assert.equal(isHiddenCommand("limpar-dados"), false)
  assert.equal(isHiddenCommand("customize-opencode"), false)
  assert.ok(LOCAL_COMMANDS.every(command => !isHiddenCommand(command.name)))
})
