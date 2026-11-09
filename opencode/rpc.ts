import { Rpc } from "@opencode/plugin/rpc"

const themeSnapshot = {
  type: "object",
  properties: {
    mode: { type: "string", enum: ["light", "dark"] },
    tokens: { type: "object", additionalProperties: true },
  },
  additionalProperties: false,
} as const

export const ModsRpc = Rpc.define({
  id: "opencode-mods",
  methods: {
    openCustomize: {
      input: {
        type: "object",
        properties: { theme: themeSnapshot },
        additionalProperties: false,
      },
      output: {
        type: "object",
        properties: { text: { type: "string" } },
        required: ["text"],
        additionalProperties: false,
      },
    },
    customizeTheme: {
      input: {
        type: "object",
        properties: { theme: themeSnapshot },
        additionalProperties: false,
      },
      output: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
  events: {},
}) as unknown as Rpc.PortableDefinition
