import { Plugin } from "@opencode/plugin"
import { setupCustomize } from "./src/server/customize"

export default Plugin.define({
  id: "opencode-mods",
  async setup(ctx) {
    const cleanups: Array<() => void | Promise<void>> = []

    if (ctx.options.customize !== false) {
      try {
        cleanups.push(await setupCustomize(ctx))
      } catch (error) {
        console.error("opencode-mods: não consegui registrar o customize-opencode:", error)
      }
    }

    return async () => {
      for (const cleanup of cleanups.reverse()) await cleanup()
    }
  },
})
