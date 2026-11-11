import { generationTask } from "@db/schema"
import { and, count, db, desc, eq, gte, lt, or, sql, sum } from "void/db"

import { runsOf, storedOf } from "./runs.server"
import type { TaskRow } from "./tasks.server"

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "audio/mpeg": "mp3",
}

/** A task as the MCP tools and the web page show it. Output URLs are public capability links. */
export function taskView(task: TaskRow, origin: string) {
  const runs = runsOf(task.providerRef)
  const outputs = storedOf(task.providerRef).map((file) => ({
    url: `${origin}/f/${file.id}.${EXT[file.mime] ?? "bin"}`,
    mime: file.mime,
    bytes: file.bytes,
    width: file.width,
    height: file.height,
    durationMs: file.durationMs,
  }))
  return {
    id: task.id,
    state: task.state,
    model: task.model,
    modality: task.modality,
    prompt: task.prompt,
    params: task.params,
    references: task.references,
    runs: task.runs,
    pendingRuns: runs.filter((run) => "pending" in run).length,
    outputs,
    failure: task.failure,
    quoteUsd: task.quoteUsd,
    costUsd: task.costUsd,
    tokens: task.tokens,
    possiblyBilledRuns: task.lostRuns,
    clientId: task.clientId,
    createdAt: task.createdAt.toISOString(),
    finishedAt: task.finishedAt?.toISOString() ?? null,
  }
}

export type TaskView = ReturnType<typeof taskView>

export type Range = { since?: Date; until?: Date }

const inRange = (userId: string, range: Range) =>
  and(
    eq(generationTask.userId, userId),
    range.since && gte(generationTask.createdAt, range.since),
    range.until && lt(generationTask.createdAt, range.until)
  )

export type TaskFilter = Range & {
  /** Words the prompt contains, or a task id. Case-insensitive for ASCII. */
  query?: string
  model?: string
  state?: TaskRow["state"]
  limit?: number
  offset?: number
}

/** `%` and `_` in the words are matched literally. */
const contains = (words: string) => `%${words.replace(/[\\%_]/g, (char) => `\\${char}`)}%`

const matching = (userId: string, filter: TaskFilter) => {
  const query = filter.query?.trim() || undefined
  return and(
    inRange(userId, filter),
    filter.state ? eq(generationTask.state, filter.state) : undefined,
    filter.model ? eq(generationTask.model, filter.model) : undefined,
    query
      ? or(
          sql`${generationTask.prompt} like ${contains(query)} escape '\\'`,
          eq(generationTask.id, query)
        )
      : undefined
  )
}

/** The generation log, newest first, narrowed by prompt words, model and state. */
export const listTasks = (userId: string, filter: TaskFilter) =>
  db
    .select()
    .from(generationTask)
    .where(matching(userId, filter))
    .orderBy(desc(generationTask.createdAt))
    .limit(Math.min(filter.limit ?? 20, 200))
    .offset(filter.offset ?? 0)

/** How many tasks match, for paging. */
export async function countTasks(userId: string, filter: TaskFilter) {
  const [row] = await db.select({ n: count() }).from(generationTask).where(matching(userId, filter))
  return row?.n ?? 0
}

const day = sql<string>`strftime('%Y-%m-%d', ${generationTask.createdAt} / 1000, 'unixepoch')`

/**
 * The cost audit over a range, in USD at list price: totals, then per model and per day (UTC).
 * `quotedUsd` is what was estimated at submit; `costUsd` what delivered runs cost; runs that were
 * lost may have been billed by the provider without delivering, so they are counted apart.
 */
export async function costReport(userId: string, range: Range) {
  const columns = {
    tasks: count(),
    succeeded: sql<number>`sum(case when ${generationTask.state} = 'succeeded' then 1 else 0 end)`,
    failed: sql<number>`sum(case when ${generationTask.state} = 'failed' then 1 else 0 end)`,
    open: sql<number>`sum(case when ${generationTask.state} in ('queued','running','confirming') then 1 else 0 end)`,
    quotedUsd: sum(generationTask.quoteUsd).mapWith(Number),
    costUsd: sum(generationTask.costUsd).mapWith(Number),
    unpricedTasks: sql<number>`sum(case when ${generationTask.quoteUsd} is null then 1 else 0 end)`,
    possiblyBilledRuns: sum(generationTask.lostRuns).mapWith(Number),
  }
  const where = inRange(userId, range)
  const [totals] = await db.select(columns).from(generationTask).where(where)
  const byModel = await db
    .select({ model: generationTask.model, ...columns })
    .from(generationTask)
    .where(where)
    .groupBy(generationTask.model)
    .orderBy(desc(sum(generationTask.costUsd)))
  const byDay = await db
    .select({ day, ...columns })
    .from(generationTask)
    .where(where)
    .groupBy(day)
    .orderBy(desc(day))
  return {
    currency: "USD",
    basis: "Catalog list prices; CNY converted at the pinned rate. Not a provider invoice.",
    since: range.since?.toISOString() ?? null,
    until: range.until?.toISOString() ?? null,
    totals,
    byModel,
    byDay,
  }
}

/** Delivered spend and task count per UTC day since a date, for the activity heatmap. */
export const dailySpend = (userId: string, since: Date) =>
  db
    .select({ day, costUsd: sum(generationTask.costUsd).mapWith(Number), tasks: count() })
    .from(generationTask)
    .where(inRange(userId, { since }))
    .groupBy(day)
