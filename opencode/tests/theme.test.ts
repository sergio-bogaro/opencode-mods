import assert from "node:assert/strict"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import {
  applyThemeColors,
  deleteThemeFile,
  loadThemeJson,
  newThemeFromSnapshot,
  nextThemeName,
  normalizeHex,
  readThemeFile,
  themeNameError,
  themePalette,
  themeTemplate,
  validateTheme,
  writeThemeFile,
} from "../src/server/theme.ts"

test("resolve as cores do template opencode nos dois modos", async () => {
  const template = await themeTemplate()
  const dark = themePalette(template, template, "dark")
  const light = themePalette(template, template, "light")
  const darkByPath = new Map(dark.map(row => [row.path, row.value]))
  const lightByPath = new Map(light.map(row => [row.path, row.value]))
  assert.equal(darkByPath.get("text.base"), "#EEEEEE")
  assert.equal(darkByPath.get("background.base"), "#0A0A0A")
  assert.equal(darkByPath.get("syntax.keyword"), "#9D7CD8")
  assert.equal(darkByPath.get("diff.text.added"), "#4FD6BE")
  assert.equal(lightByPath.get("text.base"), "#1A1A1A")
  assert.equal(lightByPath.get("background.base"), "#FFFFFF")
  assert.equal(lightByPath.get("border.base"), "#B8B8B8")
})

test("o snapshot do TUI vira as cores do modo ativo sem tocar no outro", async () => {
  const template = await themeTemplate()
  const theme = newThemeFromSnapshot(template, {
    mode: "dark",
    tokens: {
      text: { base: "#ff0000" },
      background: { base: "#101010" },
    },
  })
  const dark = new Map(themePalette(theme, template, "dark").map(row => [row.path, row.value]))
  const light = new Map(themePalette(theme, template, "light").map(row => [row.path, row.value]))
  assert.equal(dark.get("text.base"), "#FF0000")
  assert.equal(dark.get("background.base"), "#101010")
  assert.equal(dark.get("text.muted"), "#808080")
  assert.equal(light.get("text.base"), "#1A1A1A")
  assert.equal(light.get("background.base"), "#FFFFFF")
})

test("aplica cores por modo e valida hexadecimal", async () => {
  const template = await themeTemplate()
  const theme = newThemeFromSnapshot(template, null)
  const error = applyThemeColors(theme, [
    { mode: "dark", path: "text.base", value: "#123456" },
    { mode: "light", path: "text.base", value: "#abcdef" },
    { mode: "dark", path: "background.raised.base", value: "transparent" },
  ])
  assert.equal(error, "")
  const dark = new Map(themePalette(theme, template, "dark").map(row => [row.path, row.value]))
  const light = new Map(themePalette(theme, template, "light").map(row => [row.path, row.value]))
  assert.equal(dark.get("text.base"), "#123456")
  assert.equal(light.get("text.base"), "#ABCDEF")

  assert.match(applyThemeColors(theme, [{ mode: "dark", path: "text.base", value: "vermelho" }]), /Cor inválida/)
  assert.match(applyThemeColors(theme, [{ mode: "dark", path: "nao.existe", value: "#FFFFFF" }]), /desconhecida/)
  assert.equal(applyThemeColors(theme, [{ mode: "dark", path: "text.base", value: "" }]), "")
  const reset = new Map(themePalette(theme, template, "dark").map(row => [row.path, row.value]))
  assert.equal(reset.get("text.base"), "#EEEEEE")
})

test("preserva o canal alpha ao aplicar uma cor", async () => {
  const template = await themeTemplate()
  const theme = newThemeFromSnapshot(template, null)
  assert.equal(
    applyThemeColors(theme, [{ mode: "dark", path: "text.base", value: "#11223380" }]),
    "",
  )
  const dark = new Map(themePalette(theme, template, "dark").map(row => [row.path, row.value]))
  assert.equal(dark.get("text.base"), "#11223380")
})

test("valida nomes de tema e propõe um nome livre", () => {
  assert.equal(themeNameError("meu-tema"), "")
  assert.match(themeNameError(""), /nome/)
  assert.match(themeNameError("system"), /reservado/)
  assert.match(themeNameError("Aura"), /embutido/)
  assert.match(themeNameError("com espaço"), /letras/)
  assert.equal(nextThemeName(["meu-tema", "meu-tema-2"]), "meu-tema-3")
})

test("valida a estrutura do tema e normaliza hex", async () => {
  const template = await themeTemplate()
  assert.equal(validateTheme(template), "")
  assert.match(validateTheme({}), /objeto/)
  assert.match(validateTheme({ base: {} }), /light/)
  const withoutHues = JSON.parse(JSON.stringify(template)) as Record<string, any>
  delete withoutHues.dark.hue
  assert.match(validateTheme(withoutHues), /hue/)
  assert.equal(normalizeHex("#abc"), "#AABBCC")
  assert.equal(normalizeHex("aabbcc"), "#AABBCC")
  assert.equal(normalizeHex("#abcd"), "#AABBCCDD")
  assert.equal(normalizeHex("#aabbccdd"), "#AABBCCDD")
  assert.equal(normalizeHex("nope"), null)
})

test("aceita RGBA serializado no snapshot como fallback", async () => {
  const template = await themeTemplate()
  const theme = newThemeFromSnapshot(template, {
    mode: "dark",
    tokens: { text: { base: { r: 255, g: 0, b: 0, a: 255 } } },
  })
  const dark = new Map(themePalette(theme, template, "dark").map(row => [row.path, row.value]))
  assert.equal(dark.get("text.base"), "#FF0000")
})

test("grava, lê, valida e apaga arquivos de tema customizado", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "opencode-mods-theme-"))
  process.env.XDG_CONFIG_HOME = root
  try {
    const template = await themeTemplate()
    await writeThemeFile("meu-tema", template)
    const loaded = await loadThemeJson("meu-tema")
    assert.equal(loaded.error, "")
    assert.ok(loaded.theme)

    const snapshot = newThemeFromSnapshot(template, {
      mode: "dark",
      tokens: { text: { base: "#FF0000" }, background: { base: "#101010" } },
    })
    await writeThemeFile("snapshot", snapshot)
    const loadedSnapshot = await loadThemeJson("snapshot")
    assert.equal(loadedSnapshot.error, "")

    await writeFile(path.join(root, "opencode", "themes", "antigo.json"), JSON.stringify({ theme: {} }), "utf8")
    const old = await loadThemeJson("antigo")
    assert.match(old.error, /V1/)

    const missing = await loadThemeJson("nao-existe")
    assert.match(missing.error, /não existe/)

    const traversal = await loadThemeJson("../fora")
    assert.match(traversal.error, /letras/)
    assert.ok(await readThemeFile("meu-tema"))
    await deleteThemeFile("meu-tema")
    assert.equal(await readThemeFile("meu-tema"), null)
    await deleteThemeFile("meu-tema")
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
