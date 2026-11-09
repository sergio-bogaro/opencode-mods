import { randomUUID } from "node:crypto"
import { mkdir, open, readFile, rename, stat, unlink, writeFile, type FileHandle } from "node:fs/promises"
import { homedir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

export const pluginRoot = path.resolve(fileURLToPath(new URL("../..", import.meta.url)))

export function homeDir(): string {
  if (process.platform === "win32" && process.env.USERPROFILE) return process.env.USERPROFILE
  return homedir()
}

export function configDir(): string {
  const xdg = process.env.XDG_CONFIG_HOME
  return xdg ? path.join(xdg, "opencode") : path.join(homeDir(), ".config", "opencode")
}

export function dataDir(): string {
  const xdg = process.env.XDG_DATA_HOME
  return xdg ? path.join(xdg, "opencode") : path.join(homeDir(), ".local", "share", "opencode")
}

export function modsDir(): string {
  return path.join(dataDir(), "mods", "opencode-mods")
}

export function customizeDir(): string {
  return path.join(modsDir(), "customize-opencode")
}

export function cliConfigPath(): string {
  return path.join(configDir(), "cli.json")
}

export function themesDir(): string {
  return path.join(configDir(), "themes")
}

export function scriptPath(...parts: string[]): string {
  return path.join(pluginRoot, ...parts)
}

export async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true })
}

/**
 * Serializa operações entre processos que compartilham o mesmo diretório de
 * dados. Operações de customize são curtas; um lock velho é considerado órfão.
 */
export async function withFileLock<T>(
  name: string,
  task: () => Promise<T>,
  timeoutMs = 15_000,
): Promise<T> {
  await ensureDir(modsDir())
  const file = path.join(modsDir(), name)
  const token = randomUUID()
  const started = Date.now()
  let handle: FileHandle | undefined

  while (!handle) {
    try {
      handle = await open(file, "wx")
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error
      let stale = false
      try {
        const info = await stat(file)
        stale = Date.now() - info.mtimeMs > 10_000
      } catch {
        stale = false
      }
      if (stale) {
        await unlink(file).catch(() => undefined)
        continue
      }
      if (Date.now() - started > timeoutMs) {
        throw new Error(`não consegui obter o lock ${name}; outra instância pode estar editando`)
      }
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  }

  try {
    await handle.writeFile(token, "utf8")
  } catch (error) {
    await handle.close().catch(() => undefined)
    await unlink(file).catch(() => undefined)
    throw error
  }

  try {
    return await task()
  } finally {
    await handle.close().catch(() => undefined)
    const current = await readFile(file, "utf8").catch(() => "")
    if (current === token) await unlink(file).catch(() => undefined)
  }
}

/**
 * Grava em um arquivo temporário no mesmo diretório e troca por rename.
 * Evita deixar configurações e backups pela metade se o processo cair.
 */
export async function writeFileAtomic(file: string, data: string): Promise<void> {
  const dir = path.dirname(file)
  await ensureDir(dir)
  const temp = path.join(dir, `.${path.basename(file)}.${randomUUID()}.tmp`)
  try {
    await writeFile(temp, data, "utf8")
    await rename(temp, file)
  } catch (error) {
    await unlink(temp).catch(() => undefined)
    throw error
  }
}
