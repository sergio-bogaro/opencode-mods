import assert from "node:assert/strict"
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { configRows, readCli, restoreCli, setCliValue } from "../src/server/cli-config.ts"

async function sandbox(): Promise<{ root: string; config: string; themes: string }> {
  const root = await mkdtemp(path.join(os.tmpdir(), "opencode-mods-cli-"))
  const config = path.join(root, "opencode")
  const themes = path.join(config, "themes")
  await mkdir(themes, { recursive: true })
  process.env.XDG_CONFIG_HOME = root
  return { root, config, themes }
}

async function writeCliFile(config: string, value: unknown): Promise<void> {
  await mkdir(config, { recursive: true })
  await writeFile(path.join(config, "cli.json"), JSON.stringify(value, null, 2), "utf8")
}

async function cleanup(root: string): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await rm(root, { recursive: true, force: true })
      return
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (attempt === 4 || (code !== "ENOTEMPTY" && code !== "EBUSY" && code !== "EPERM")) throw error
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  }
}

test("lê o cli.json, aplica padrões e lista temas customizados", async () => {
  const { root, config, themes } = await sandbox()
  try {
    await writeFile(path.join(themes, "meu-tema.json"), "{}", "utf8")
    await writeCliFile(config, {
      $schema: "https://opencode.ai/v2/cli.json",
      theme: { name: "aura" },
      animations: false,
      custom: { keep: true },
    })

    const result = await configRows()
    assert.equal(result.error, "")
    const byKey = new Map(result.rows.map(row => [row.key, row]))
    assert.equal(byKey.get("theme.name")?.value, "aura")
    assert.ok(byKey.get("theme.name")?.options?.includes("meu-tema"))
    assert.ok(byKey.get("theme.name")?.options?.includes("tokyonight"))
    assert.equal(byKey.get("theme.mode")?.value, "system")
    assert.equal(byKey.get("animations")?.value, false)
    assert.equal(byKey.get("session.sidebar")?.value, "auto")
    assert.equal(byKey.get("session.verbosity")?.value, "medium")
    assert.equal(byKey.get("tabs.enabled")?.value, true)
    assert.equal(byKey.get("diffs.fullscreen")?.value, false)
    assert.equal(byKey.get("mini.replay_limit")?.value, 200)
    assert.equal(byKey.get("attention.volume")?.kind, "number")
    assert.equal(byKey.get("attention.volume")?.max, 1)
  } finally {
    await cleanup(root)
  }
})

test("valida escolhas, booleanos e números ao escrever", async () => {
  const { root, config } = await sandbox()
  try {
    await writeCliFile(config, { $schema: "https://opencode.ai/v2/cli.json" })

    assert.equal(await setCliValue("animations", false), "")
    assert.equal(await setCliValue("session.sidebar", "hide"), "")
    assert.equal(await setCliValue("scroll.speed", 0.5), "")
    assert.equal(await setCliValue("attention.volume", 0.75), "")
    assert.equal(await setCliValue("mini.replay_limit", 50), "")
    assert.equal(await setCliValue("theme.name", "tokyonight"), "")

    assert.match(await setCliValue("session.sidebar", "talvez"), /opção inválida/)
    assert.match(await setCliValue("scroll.speed", 0), /mínimo/)
    assert.match(await setCliValue("attention.volume", 1.2), /máximo/)
    assert.match(await setCliValue("mini.replay_limit", 2.5), /inteiro/)
    assert.match(await setCliValue("animations", "true"), /valor inválido/)
    assert.match(await setCliValue("nao.existe", true), /não existe/)

    const cli = await readCli()
    assert.equal(cli.animations, false)
    assert.deepEqual(cli.session, { sidebar: "hide" })
    assert.deepEqual(cli.scroll, { speed: 0.5 })
    assert.deepEqual(cli.attention, { volume: 0.75 })
    assert.deepEqual(cli.mini, { replay_limit: 50 })
    assert.deepEqual(cli.theme, { name: "tokyonight" })
  } finally {
    await cleanup(root)
  }
})

test("texto vazio remove a chave e preserva o resto do cli.json", async () => {
  const { root, config } = await sandbox()
  try {
    await writeCliFile(config, {
      $schema: "https://opencode.ai/v2/cli.json",
      attention: { sound_pack: "meu-pack" },
      keybinds: { "agent.cycle": "tab" },
    })

    assert.equal(await setCliValue("attention.sound_pack", ""), "")
    assert.equal(await setCliValue("theme.name", "  aurora  "), "")

    const cli = await readCli()
    assert.deepEqual(cli.attention, {})
    assert.deepEqual(cli.theme, { name: "aurora" })
    assert.deepEqual(cli.keybinds, { "agent.cycle": "tab" })
  } finally {
    await cleanup(root)
  }
})

test("restaura valores originais e apaga chaves que não existiam", async () => {
  const { root, config } = await sandbox()
  try {
    await writeCliFile(config, {
      $schema: "https://opencode.ai/v2/cli.json",
      theme: { name: "aura" },
    })

    assert.equal(await setCliValue("theme.name", "tokyonight"), "")
    assert.equal(await setCliValue("animations", false), "")
    const count = await restoreCli({
      "theme.name": { value: "aura" },
      animations: { absent: true },
    })
    assert.equal(count, 2)
    const cli = await readCli()
    assert.deepEqual(cli.theme, { name: "aura" })
    assert.equal("animations" in cli, false)
  } finally {
    await cleanup(root)
  }
})

test("cli.json inválido vira erro sem derrubar a leitura", async () => {
  const { root, config } = await sandbox()
  try {
    await writeCliFile(config, {})
    await writeFile(path.join(config, "cli.json"), "{ // comentário\n}", "utf8")
    const result = await configRows()
    assert.match(result.error, /cli\.json/)
    assert.deepEqual(result.rows, [])
  } finally {
    await cleanup(root)
  }
})

test("valores numéricos nulos usam o padrão em vez de zero", async () => {
  const { root, config } = await sandbox()
  try {
    await writeCliFile(config, { attention: { volume: null }, mini: { replay_limit: null } })
    const result = await configRows()
    const byKey = new Map(result.rows.map(row => [row.key, row.value]))
    assert.equal(byKey.get("attention.volume"), 0.4)
    assert.equal(byKey.get("mini.replay_limit"), 200)
  } finally {
    await cleanup(root)
  }
})

test("aceita cli.json com BOM UTF-8", async () => {
  const { root, config } = await sandbox()
  try {
    await mkdir(config, { recursive: true })
    await writeFile(path.join(config, "cli.json"), "\uFEFF" + JSON.stringify({ animations: false }), "utf8")
    const cli = await readCli()
    assert.equal(cli.animations, false)
  } finally {
    await cleanup(root)
  }
})

test("recusa cli.json que não é um objeto em vez de sobrescrever", async () => {
  const { root, config } = await sandbox()
  try {
    await mkdir(config, { recursive: true })
    await writeFile(path.join(config, "cli.json"), "[1,2,3]", "utf8")
    const result = await configRows()
    assert.match(result.error, /objeto JSON/)
    assert.deepEqual(result.rows, [])
  } finally {
    await cleanup(root)
  }
})

test("diffs.source não oferece o valor inválido turn", async () => {
  const { root, config } = await sandbox()
  try {
    await writeCliFile(config, {})
    const result = await configRows()
    const source = result.rows.find(row => row.key === "diffs.source")
    assert.deepEqual(source?.options, ["branch", "committed", "working"])
    assert.match(await setCliValue("diffs.source", "turn"), /opção inválida/)
  } finally {
    await cleanup(root)
  }
})
