import assert from "node:assert/strict"
import { mkdir, mkdtemp, rm, utimes, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { withFileLock } from "../src/shared/paths.ts"

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function sandbox(): Promise<{ root: string; lockDir: string }> {
  const root = await mkdtemp(path.join(os.tmpdir(), "opencode-mods-lock-"))
  const lockDir = path.join(root, "opencode", "mods", "opencode-mods")
  await mkdir(lockDir, { recursive: true })
  process.env.XDG_DATA_HOME = root
  return { root, lockDir }
}

test("serializa operações concorrentes", async () => {
  const { root } = await sandbox()
  try {
    let active = 0
    let maximum = 0
    const done: number[] = []
    const run = (value: number) =>
      withFileLock("concurrent.lock", async () => {
        active++
        maximum = Math.max(maximum, active)
        await sleep(25)
        done.push(value)
        active--
      })

    await Promise.all([run(1), run(2)])
    assert.equal(maximum, 1)
    assert.deepEqual(done.sort((a, b) => a - b), [1, 2])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("recupera um lock órfão antigo", async () => {
  const { root, lockDir } = await sandbox()
  try {
    const lock = path.join(lockDir, "stale.lock")
    await writeFile(lock, "", "utf8")
    const old = new Date(Date.now() - 60_000)
    await utimes(lock, old, old)

    let ran = false
    await withFileLock("stale.lock", async () => {
      ran = true
    })
    assert.equal(ran, true)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("respeita o timeout de aquisição", async () => {
  const { root, lockDir } = await sandbox()
  try {
    await writeFile(path.join(lockDir, "busy.lock"), "", "utf8")
    await assert.rejects(
      withFileLock("busy.lock", async () => undefined, 120),
      /lock busy\.lock/,
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
