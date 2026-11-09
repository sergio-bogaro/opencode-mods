import type { ModelInfo } from "@opencode/client"
import type { Context } from "@opencode/plugin/tui/context"
import { money, plural } from "../../shared/format"
import { modelInfoFor, sessionLocation } from "./data"
import type { FileRow, Scope } from "./types"

const PATCH_LIMIT = 16_000
const PROMPT_LIMIT = 120_000

export type ExplainModel = {
  providerID: string
  modelID: string
  variant?: string
  label: string
}

export function availableModels(ctx: Context, sessionID: string): ExplainModel[] {
  const location = sessionLocation(ctx, sessionID)
  const models = ctx.data.location.model.list(location) ?? []
  return models
    .filter(model => model.enabled && (model.type === undefined || model.type === "chat"))
    .map(model => ({
      providerID: model.providerID,
      modelID: model.modelID,
      label: `${model.name} · ${model.providerID}`,
    }))
}

export function currentModel(ctx: Context, sessionID: string, key: string): ExplainModel | undefined {
  if (key === "session") {
    const info = modelInfoFor(ctx, sessionID)
    if (info) {
      return {
        providerID: info.providerID,
        modelID: info.modelID,
        label: `${info.name} · sessão`,
      }
    }
    const selected = ctx.ui.model.current()
    if (!selected) return undefined
    return { providerID: selected.providerID, modelID: selected.modelID, label: "Sessão" }
  }
  return availableModels(ctx, sessionID).find(model => `${model.providerID}/${model.modelID}` === key)
}

export function variantsFor(ctx: Context, sessionID: string, model: ExplainModel | undefined): string[] {
  if (!model) return []
  const location = sessionLocation(ctx, sessionID)
  const models = ctx.data.location.model.list(location) ?? []
  const info = models.find(item => item.providerID === model.providerID && item.modelID === model.modelID)
  return info?.variants.map(variant => variant.id) ?? []
}

export function modelInfoName(model: ModelInfo | undefined): string {
  return model?.name ?? "modelo da sessão"
}

function patchFor(row: FileRow): string {
  if (!row.patch) return "(diff não registrado)"
  const text = row.patch.length > PATCH_LIMIT ? row.patch.slice(0, PATCH_LIMIT) + "\n… (diff cortado)" : row.patch
  return text
}

export function buildPrompt(scope: Scope, rows: FileRow[]): string {
  const parts: string[] = []
  let size = 0
  for (const row of rows) {
    const head =
      `### ${row.file} (+${row.additions} -${row.deletions}, ` +
      `${plural(row.additions + row.deletions, "linha alterada", "linhas alteradas")}${row.created ? ", arquivo novo" : ""})`
    const part = `${head}\n\`\`\`diff\n${patchFor(row)}\n\`\`\``
    if (size + part.length > PROMPT_LIMIT) {
      parts.push(`### ${row.file}\n(omitido: o prompt ficaria grande demais)`)
      continue
    }
    size += part.length
    parts.push(part)
  }

  return (
    `Explique em PT-BR, de forma objetiva, as alterações feitas nos arquivos abaixo ` +
    `${scope === "turn" ? "na última pergunta" : "nesta sessão"}: ` +
    "o que mudou em cada um e por quê (quando der para inferir), e o que merece revisão ou pode " +
    "quebrar. Use um título por arquivo e tópicos curtos. Não use ferramentas; responda direto.\n\n" +
    parts.join("\n\n")
  )
}

export function explainTitle(scope: Scope, rows: FileRow[], model: ExplainModel | undefined, variant: string | undefined): string {
  const label = model?.label ?? "sessão"
  return `${plural(rows.length, "arquivo", "arquivos")} · ${scope === "turn" ? "esta pergunta" : "sessão toda"} · ${label}${
    variant ? ` (${variant})` : ""
  }`
}

export async function generateExplanation(
  ctx: Context,
  model: ExplainModel | undefined,
  prompt: string,
): Promise<{ text: string; cost?: number }> {
  if (!model) throw new Error("nenhum modelo disponível para explicar")
  const result = await ctx.client.experimental.generate.text({
    prompt,
    model: { providerID: model.providerID, id: model.modelID, variant: model.variant },
  })
  return { text: result.text }
}

export function explainCostLabel(cost: number | undefined): string {
  return cost === undefined ? "" : ` · ${money(cost)}`
}
