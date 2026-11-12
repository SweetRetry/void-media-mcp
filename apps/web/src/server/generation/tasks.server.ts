import { generationTask } from "@db/schema"
import {
  type MediaModel,
  modelOf,
  models,
  type Params,
  type Reference,
  type ResolvedInput,
  resolveInput,
} from "@workspace/model-providers"
import { and, asc, db, eq, inArray } from "void/db"
import { queues } from "void/queues"
import { storage } from "void/storage"

import { costOf, maxRunsOf, type Quote, quoteOf } from "./pricing"
import { pollRun, submitRun } from "./provider.server"
import { outputKey, type Run, runOf, runsOf } from "./runs.server"
import { isOn, offOf } from "./switches.server"

/*
 * A task's state machine. `startTask` sends a queued task to its provider and runs only in the
 * `generations` queue, so a synchronous provider call outlives whoever asked for it. `advanceTask`
 * moves one task along and is safe to call any number of times from anywhere at once (the MCP
 * tools, the web page and the cron all call it): every transition is an UPDATE guarded by the
 * state it leaves, so only one caller wins it.
 */

export type TaskRow = typeof generationTask.$inferSelect

/** A queued task that never started within this fails. */
const QUEUE_LIMIT_MS = 10 * 60_000
/** A running task with no recorded runs after this lost its synchronous request. */
const SYNC_LOST_MS = 10 * 60_000
/** How long a confirming task keeps polling for a result the provider may still deliver. */
const CONFIRM_MS = 24 * 3_600_000

/** A media model by API id or by its display name. */
export const mediaModelOf = (key: string): MediaModel | undefined =>
  modelOf(key) ?? models.find((model) => model.name === key)

export type SubmitInput = {
  model: string
  prompt: string
  params?: Partial<Params>
  references?: Reference[]
  runs?: number
  clientKey?: string
}

export type Submitted = { ok: TaskRow } | { refused: string }

/** Checks a request against its model and prices it. Records nothing, so it is safe to call to show a quote. */
export async function checkTask(
  input: SubmitInput
): Promise<
  { refused: string } | { model: MediaModel; runs: number; resolved: ResolvedInput; quote: Quote }
> {
  const model = mediaModelOf(input.model)
  if (!model) return { refused: `Unknown model "${input.model}". Call list_models.` }
  if (!isOn(await offOf(), model))
    return { refused: `${model.name} is turned off. Call list_models for the models that are on.` }
  const runs = input.runs ?? 1
  const maxRuns = maxRunsOf(model)
  if (!Number.isInteger(runs) || runs < 1 || runs > maxRuns)
    return { refused: `runs must be a whole number from 1 to ${maxRuns} for ${model.name}.` }
  const resolved = resolveInput(model, {
    prompt: input.prompt,
    params: input.params,
    references: input.references,
  })
  if (!resolved.ok)
    return { refused: resolved.issues.map((issue) => `${issue.path} ${issue.message}`).join("; ") }
  return {
    model,
    runs,
    resolved: resolved.value,
    quote: quoteOf(model, resolved.value.params, runs),
  }
}

/** The task this user already made with this `clientKey`, if any. */
export const taskByClientKey = async (userId: string, clientKey: string) =>
  (
    await db
      .select()
      .from(generationTask)
      .where(and(eq(generationTask.userId, userId), eq(generationTask.clientKey, clientKey)))
  )[0]

/**
 * Accepts a request: checks it against the model, prices it, records it as queued, then queues its start.
 * The same `clientKey` from the same user returns the task it already made.
 */
export async function submitTask(
  owner: { userId: string; clientId: string | null },
  input: SubmitInput
): Promise<Submitted> {
  // A retry returns the task it already made, even if its model was turned off since.
  if (input.clientKey) {
    const existing = await taskByClientKey(owner.userId, input.clientKey)
    if (existing) return { ok: existing }
  }

  const checked = await checkTask(input)
  if ("refused" in checked) return checked
  const { model, runs, resolved, quote } = checked

  const [task] = await db
    .insert(generationTask)
    .values({
      id: crypto.randomUUID(),
      userId: owner.userId,
      clientId: owner.clientId,
      clientKey: input.clientKey ?? null,
      model: model.id,
      provider: model.provider,
      modality: model.modality,
      prompt: resolved.prompt,
      params: resolved.params,
      references: [...resolved.references],
      runs,
      state: "queued",
      quoteUsd: quote.usd,
      price: quote.price,
    })
    .onConflictDoNothing()
    .returning()
  if (!task) return submitTask(owner, input) // Lost a race on the same clientKey: read the winner.
  await queues.generations.send({ taskId: task.id })
  return { ok: task }
}

export const taskOf = async (id: string) =>
  (await db.select().from(generationTask).where(eq(generationTask.id, id)))[0]

const resolved = (run: Run) => "stored" in run || "failed" in run

/** Claims a queued task and submits its runs. Called by the `generations` queue only. */
export async function startTask(taskId: string, now = new Date()): Promise<void> {
  const task = await taskOf(taskId)
  if (task?.state !== "queued") return
  const model = mediaModelOf(task.model)
  if (!model) return void (await end(task, "The model left the catalog.", now))
  const claimed = await db
    .update(generationTask)
    .set({ state: "running", startedAt: now })
    .where(and(eq(generationTask.id, task.id), eq(generationTask.state, "queued")))
    .returning({ id: generationTask.id })
  if (!claimed.length) return
  const input = {
    prompt: task.prompt,
    params: task.params as Partial<Params>,
    references: task.references as Reference[],
  }
  const sent = await Promise.all(Array.from({ length: task.runs }, () => submitRun(model, input)))
  const runs = await Promise.all(sent.map((item) => runOf(task.id, item, false)))
  return next({ ...task, state: "running" }, model, runs, new Date())
}

/**
 * Moves one task along: a queued task that the queue never started fails, a running one polls its
 * provider, a confirming one keeps polling until its window closes. Final tasks are left alone.
 */
export async function advanceTask(taskId: string, now = new Date()): Promise<void> {
  const task = await taskOf(taskId)
  if (!task || !["queued", "running", "confirming"].includes(task.state)) return
  const model = mediaModelOf(task.model)
  if (!model) return void (await end(task, "The model left the catalog.", now))

  if (task.state === "queued") {
    if (now.getTime() - task.createdAt.getTime() > QUEUE_LIMIT_MS)
      await end(task, "It never started within the queue limit.", now)
    return
  }

  const runs = runsOf(task.providerRef)
  if (!runs.length) {
    // A synchronous submission still in flight, or one whose worker died mid-request.
    if (task.startedAt && now.getTime() - task.startedAt.getTime() > SYNC_LOST_MS)
      await next(
        task,
        model,
        Array.from({ length: task.runs }, () => ({ lost: "No answer" })),
        now
      )
    return
  }
  const polled = await Promise.all(
    runs.map(async (run) => {
      if (!("pending" in run)) return run
      const sent = await pollRun(model, run.pending)
      // A poll that gets no clear answer asks again next time.
      return sent.state === "unknown" ? run : runOf(task.id, sent, true)
    })
  )
  return next(task, model, polled, now)
}

/** What a task's runs say it should do next. */
async function next(task: TaskRow, model: MediaModel, runs: Run[], now: Date) {
  const late = task.state === "confirming" && task.confirmUntil !== null && now > task.confirmUntil
  // A lost run with no provider task to ask cannot come back, so it fails, possibly billed.
  const final = runs.map((run): Run => ("lost" in run ? { failed: run.lost, billable: true } : run))
  if (final.every(resolved) || late) return settle(task, model, final, now)
  const confirming = task.state === "confirming" || runs.some((run) => "lost" in run)
  await db
    .update(generationTask)
    .set({
      providerRef: JSON.stringify(runs),
      ...(confirming &&
        task.state !== "confirming" && {
          state: "confirming" as const,
          confirmUntil: new Date(now.getTime() + CONFIRM_MS),
        }),
    })
    .where(and(eq(generationTask.id, task.id), eq(generationTask.state, task.state)))
}

/** Ends a task whose runs all resolved (or whose window closed), with its cost for the audit. */
async function settle(task: TaskRow, model: MediaModel, runs: Run[], now: Date) {
  const delivered = runs.filter((run) => "stored" in run && run.stored.length)
  const tokens = delivered.reduce((sum, run) => sum + (("tokens" in run && run.tokens) || 0), 0)
  const failures = runs.flatMap((run) =>
    "failed" in run ? [run.failed] : "pending" in run ? ["No result within 24 hours"] : []
  )
  const billable = runs.filter((run) => "billable" in run || "pending" in run).length
  const state =
    delivered.length === 0 ? "failed" : delivered.length < task.runs ? "partial" : "succeeded"
  const settled = await db
    .update(generationTask)
    .set({
      state,
      finishedAt: now,
      providerRef: JSON.stringify(runs),
      costUsd: costOf(model, task.params as Partial<Params>, {
        runs: delivered.length,
        ...(tokens && { tokens }),
      }),
      tokens: tokens || null,
      lostRuns: billable,
      failure: failures.length
        ? state === "failed"
          ? failures[0]!
          : `${failures.length} of ${task.runs} runs failed: ${failures[0]}`
        : null,
    })
    .where(
      and(eq(generationTask.id, task.id), inArray(generationTask.state, ["running", "confirming"]))
    )
    .returning({ id: generationTask.id })
  if (!settled.length) {
    // Another advance settled it first; these copies are nobody's.
    const ids = delivered.flatMap((run) =>
      "stored" in run ? run.stored.map((file) => file.id) : []
    )
    await Promise.all(ids.map((id) => storage.delete(outputKey(id))))
  }
}

/** A task ends before any run was sent: nothing was delivered or billed. */
async function end(task: TaskRow, failure: string, now: Date) {
  await db
    .update(generationTask)
    .set({ state: "failed", failure, finishedAt: now, costUsd: 0 })
    .where(and(eq(generationTask.id, task.id), eq(generationTask.state, task.state)))
}

/** Every task not yet final, oldest first, which the cron moves along when nobody is polling. */
export async function advanceDue(now = new Date()) {
  const due = await db
    .select({ id: generationTask.id })
    .from(generationTask)
    .where(inArray(generationTask.state, ["queued", "running", "confirming"]))
    .orderBy(asc(generationTask.createdAt))
    .limit(50)
  for (const task of due) {
    try {
      await advanceTask(task.id, now)
    } catch (error) {
      console.warn(`advance ${task.id}: ${String(error)}`)
    }
  }
}
