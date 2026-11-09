import type { SessionMessageInfo, UsageLimitsInfo } from "@opencode/client"
import type { RGBA } from "@opentui/core"
import { usePlugin } from "@opencode/plugin/tui"
import { createEffect, createMemo, createSignal, For, on, onCleanup, onMount } from "solid-js"
import { fileName, fit, money, normalizePath } from "../../shared/format"
import { refreshTotals, totalsFor } from "../files/cache"
import { messageCost, modelInfoFor, modelInfoForRef, sessionLocation } from "../files/data"
import { filesStore, prefsFor } from "../files/store"

type FooterProps = {
  readonly sessionID?: string
  readonly mode: "normal" | "shell"
  readonly showDetails: boolean
}

const REFRESH_EVENTS = new Set([
  "session.execution.started",
  "session.execution.succeeded",
  "session.execution.failed",
  "session.execution.interrupted",
  "session.tool.success",
  "session.tool.failed",
  "session.message.content.updated",
  "session.compaction.ended",
  "session.idle",
  "session.usage.updated",
  "session.usage.recorded",
  "session.model.selected",
  "session.revert.staged",
  "session.revert.committed",
  "session.revert.cleared",
  "vcs.branch.updated",
])

export function StatusFooter(props: FooterProps) {
  const ctx = usePlugin()
  const store = filesStore()
  const filesEnabled = ctx.options.filesChanged !== false
  const [tick, setTick] = createSignal(0)
  const [messages, setMessages] = createSignal<SessionMessageInfo[]>([])
  const [usage, setUsage] = createSignal<UsageLimitsInfo | null>(null)
  let refreshToken = 0
  let usageAt = 0

  const sessionID = () => props.sessionID
  const session = createMemo(() => {
    tick()
    const id = sessionID()
    return id ? ctx.data.session.get(id) : undefined
  })
  const location = createMemo(() => {
    tick()
    const id = sessionID()
    return id ? sessionLocation(ctx, id) : ctx.location ?? ctx.data.location.default()
  })
  const branch = createMemo(() => {
    tick()
    return ctx.data.location.vcs.info(location())?.branch?.current
  })
  const prefs = createMemo(() => (sessionID() ? prefsFor(store[0], sessionID()!) : undefined))
  const totals = createMemo(() => (sessionID() && prefs() ? totalsFor(sessionID()!, prefs()!.scope) : undefined))
  const model = createMemo(() => {
    tick()
    const id = sessionID()
    return id ? modelInfoFor(ctx, id) : undefined
  })
  const cost = createMemo(() => {
    if (!sessionID()) return { value: 0, estimated: false }
    const reported = session()?.cost ?? 0
    if (reported > 0) return { value: reported, estimated: false }
    let value = 0
    let estimated = false
    for (const message of messages()) {
      if (message.type === "compaction" && message.status === "running") continue
      if (message.type !== "assistant" && message.type !== "compaction") continue
      const ref =
        message.type === "assistant"
          ? message.model
          : message.status === "completed"
            ? message.model
            : undefined
      const messageModel = (ref ? modelInfoForRef(ctx, location(), ref) : undefined) ?? model()
      const item = messageCost(message, messageModel)
      value += item.value
      estimated ||= item.estimated
    }
    return { value, estimated }
  })
  const compacts = createMemo(() => messages().filter(message => message.type === "compaction" && message.status === "completed").length)
  const weekly = createMemo(() => usage()?.go?.weekly?.percent)
  const explain = createMemo(() => prefs()?.explain)
  const folder = createMemo(() => fit(fileName(location().directory), 14))
  const costLabel = createMemo(() => {
    const { value, estimated } = cost()
    if (props.showDetails) return money(value, estimated)
    const formatted = value < 0.01 ? `$${value.toFixed(3)}` : `$${value.toFixed(2)}`
    return estimated ? `~${formatted}` : formatted
  })
  const btw = createMemo(() => {
    const suffix = props.showDetails ? " BTW" : ""
    if (explain()?.status === "running") return `✦⋯${suffix}`
    if (explain()?.status === "done") return `✦●${suffix}`
    return `✦${suffix}`
  })
  const weekColor = () => {
    const value = weekly()
    if (value === undefined) return ctx.theme.text.muted
    return value >= 80 ? ctx.theme.text.feedback.error.base : ctx.theme.text.action.primary.base
  }
  const segments = createMemo(() => {
    const parts: Array<{ text: string; color: RGBA }> = []
    parts.push({ text: folder(), color: ctx.theme.text.action.primary.base })
    if (branch()) parts.push({ text: fit(branch()!, 16), color: ctx.theme.text.action.primary.base })
    if (weekly() !== undefined) {
      parts.push({ text: props.showDetails ? `semana ${weekly()}%` : `sem ${weekly()}%`, color: weekColor() })
    }
    if (compacts() > 0) {
      const count = compacts()
      parts.push({
        text: props.showDetails ? `${count} compact${count === 1 ? "" : "s"}` : `${count}c`,
        color: ctx.theme.text.feedback.warning.base,
      })
    }
    parts.push({ text: costLabel(), color: ctx.theme.text.feedback.warning.base })
    if (filesEnabled && totals()) {
      parts.push({
        text: `+${totals()!.added} -${totals()!.removed}`,
        color: ctx.theme.diff.text.added,
      })
    }
    if (filesEnabled) {
      parts.push({ text: btw(), color: explain()?.status === "running" ? ctx.theme.text.action.primary.base : ctx.theme.text.muted })
    }
    return parts
  })

  async function refreshUsage(force = false): Promise<void> {
    const now = Date.now()
    if (!force && now - usageAt < 15_000) return
    usageAt = now
    try {
      const result = await ctx.client.experimental.usage.limits()
      setUsage(result.data)
    } catch {
      setUsage(null)
    }
  }

  async function refreshMessages(): Promise<void> {
    const id = sessionID()
    if (!id) return
    const token = ++refreshToken
    try {
      await ctx.data.session.message.sync(id)
      if (id !== sessionID() || token !== refreshToken) return
      setMessages([...(ctx.data.session.message.list(id) ?? [])])
    } catch {
      if (id === sessionID() && token === refreshToken) setMessages([])
    }
  }

  async function refreshAll(): Promise<void> {
    const id = sessionID()
    if (!id) return
    setTick(value => value + 1)
    await Promise.allSettled([
      ctx.data.session.sync(id),
      refreshMessages(),
      refreshUsage(true),
      ctx.data.location.vcs.sync(location()),
      ctx.data.location.model.sync(location()),
    ])
    setTick(value => value + 1)
    const current = prefs()
    if (filesEnabled && current) void refreshTotals(ctx, id, current.scope)
  }

  onMount(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const stop = ctx.data.listen(({ details }) => {
      const id = sessionID()
      if (!id) return
      if (!REFRESH_EVENTS.has(details.type)) return

      if (details.type === "vcs.branch.updated") {
        const eventLocation = (details as { location?: { directory?: string } }).location?.directory
        if (eventLocation && normalizePath(eventLocation) !== normalizePath(location().directory)) return
        void ctx.data.location.vcs.sync(location())
      } else {
        const eventSession = (details as { data?: { sessionID?: string } }).data?.sessionID
        if (eventSession !== id) return
        if (details.type === "session.model.selected") void ctx.data.location.model.sync(location())
      }

      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        if (sessionID() !== id) return
        setTick(value => value + 1)
        void refreshMessages()
        void refreshUsage()
        const current = prefs()
        if (filesEnabled && current) void refreshTotals(ctx, id, current.scope)
      }, 300)
    })
    onCleanup(() => {
      stop()
      if (timer) clearTimeout(timer)
    })
  })

  createEffect(
    on(
      () => prefs()?.scope,
      scope => {
        const id = sessionID()
        if (filesEnabled && id && scope) void refreshTotals(ctx, id, scope)
      },
    ),
  )

  createEffect(
    on(
      () => sessionID(),
      id => {
        setMessages([])
        refreshToken++
        if (!id) return
        void refreshAll()
      },
    ),
  )

  if (!props.sessionID) return <box />

  return (
    <text fg={ctx.theme.text.muted}>
      <For each={segments()}>
        {(segment, index) => (
          <>
            {index() > 0 ? " · " : ""}
            <span {...({ fg: segment.color } as Record<string, unknown>)}>{segment.text}</span>
          </>
        )}
      </For>
    </text>
  )
}
