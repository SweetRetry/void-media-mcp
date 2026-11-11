import {
  TASK_STATES,
  generationTask,
  oauthClient,
  oauthConsent,
  oauthRefreshToken,
} from "@db/schema"
import type { Price } from "@workspace/model-providers"
import { createServerFn } from "@tanstack/react-start"
import { getRequest } from "@tanstack/react-start/server"
import env from "@env"
import { and, db, desc, eq, isNull, max, sql } from "void/db"
import { z } from "zod"

import { getAuth } from "./auth/auth.server"
import { signedIn } from "./auth/session.functions"
import { outputIdOf } from "./generation/runs.server"
import { advanceTask, taskOf } from "./generation/tasks.server"
import { offOf, setSwitch } from "./generation/switches.server"
import { costReport, countTasks, dailySpend, listTasks, taskView } from "./generation/views.server"

/*
 * The admin pages' server functions. Every one but `currentUser` runs behind `signedIn`, so it
 * reads only the session's own tasks.
 */

const OPEN = new Set(["queued", "running", "confirming"])
const days = z.number().int().min(1).max(366)
const sinceOf = (n: number) => new Date(Date.now() - n * 86_400_000)
const view = (row: Parameters<typeof taskView>[0]) => taskView(row, env.BETTER_AUTH_URL)

/** Polls open tasks once, so a page shows fresh states without waiting for the cron. */
async function refresh<T extends { id: string; state: string }>(rows: T[]) {
  const open = rows.filter((row) => OPEN.has(row.state))
  await Promise.allSettled(open.map((row) => advanceTask(row.id)))
  return open.length > 0
}

/** The signed-in admin, or null. The app layout redirects to sign-in on null. */
export const currentUser = createServerFn().handler(async () => {
  const session = await getAuth().api.getSession({ headers: getRequest().headers })
  return session ? { id: session.user.id, email: session.user.email } : null
})

const PAGE = 25
/** 53 weeks: the heatmap's full grid, whatever weekday today is. */
const HEATMAP_DAYS = 53 * 7

export const tasksPage = createServerFn()
  .middleware([signedIn])
  .validator(
    z.object({
      q: z.string().max(200).optional(),
      model: z.string().max(100).optional(),
      state: z.enum(TASK_STATES).optional(),
      page: z.number().int().min(1).max(10_000),
    })
  )
  .handler(async ({ context, data }) => {
    const filter = {
      query: data.q,
      model: data.model,
      state: data.state,
      limit: PAGE,
      offset: (data.page - 1) * PAGE,
    }
    let rows = await listTasks(context.user.id, filter)
    if (await refresh(rows)) rows = await listTasks(context.user.id, filter)
    const models = await db
      .selectDistinct({ model: generationTask.model })
      .from(generationTask)
      .where(eq(generationTask.userId, context.user.id))
    return {
      tasks: rows.map(view),
      total: await countTasks(context.user.id, filter),
      pageSize: PAGE,
      models: models.map((row) => row.model).sort(),
    }
  })

export const taskDetail = createServerFn()
  .middleware([signedIn])
  .validator(z.object({ id: z.string().max(64) }))
  .handler(async ({ context, data }) => {
    let task = await taskOf(data.id)
    if (!task || task.userId !== context.user.id) return null
    if (OPEN.has(task.state)) {
      await advanceTask(task.id)
      task = (await taskOf(task.id)) ?? task
    }
    const [client] = task.clientId
      ? await db
          .select({ name: oauthClient.name })
          .from(oauthClient)
          .where(eq(oauthClient.clientId, task.clientId))
      : []
    return {
      task: view(task),
      price: task.price as Price | null,
      clientName: client?.name ?? null,
      sources: await sourcesOf(context.user.id, task.references),
    }
  })

/**
 * For each reference that is one of our own outputs, the task that generated it, so the detail
 * page can link back along a chain of edits. Keyed by the reference URL.
 */
async function sourcesOf(userId: string, references: { url: string }[]) {
  const origin = new URL(env.BETTER_AUTH_URL).origin
  const sources: Record<string, string> = {}
  for (const { url } of references) {
    const parsed = URL.parse(url)
    if (parsed?.origin !== origin || !parsed.pathname.startsWith("/f/")) continue
    const id = outputIdOf(parsed.pathname.slice(3))
    if (!id) continue
    const [row] = await db
      .select({ id: generationTask.id })
      .from(generationTask)
      .where(
        and(eq(generationTask.userId, userId), sql`${generationTask.providerRef} like ${`%${id}%`}`)
      )
      .limit(1)
    if (row) sources[url] = row.id
  }
  return sources
}

export const costsPage = createServerFn()
  .middleware([signedIn])
  .validator(z.object({ days }))
  .handler(async ({ context, data }) => {
    // The heatmap's year ends on today in UTC, the zone the report's days are counted in.
    const today = new Date().toISOString().slice(0, 10)
    return {
      report: await costReport(context.user.id, { since: sinceOf(data.days) }),
      year: { end: today, days: await dailySpend(context.user.id, sinceOf(HEATMAP_DAYS)) },
    }
  })

/** What the admin turned off, for the models page's switches. */
export const modelsPage = createServerFn()
  .middleware([signedIn])
  .handler(async () => {
    const off = await offOf()
    return { offModels: [...off.models], offProviders: [...off.providers] }
  })

/** Turns a model or a whole provider on or off for every MCP client. */
export const switchEntry = createServerFn({ method: "POST" })
  .middleware([signedIn])
  .validator(
    z.object({ kind: z.enum(["model", "provider"]), id: z.string().max(100), on: z.boolean() })
  )
  .handler(async ({ data }) => {
    await setSwitch(data.kind, data.id, data.on)
    return { ok: true }
  })

/** The MCP URL, and every client the admin has authorized, with its last task. */
export const connection = createServerFn()
  .middleware([signedIn])
  .handler(async ({ context }) => {
    const clients = await db
      .select({
        clientId: oauthClient.clientId,
        name: oauthClient.name,
        disabled: oauthClient.disabled,
        registeredAt: oauthClient.createdAt,
        consentedAt: oauthConsent.createdAt,
      })
      .from(oauthConsent)
      .innerJoin(oauthClient, eq(oauthClient.clientId, oauthConsent.clientId))
      .where(eq(oauthConsent.userId, context.user.id))
      .orderBy(desc(oauthConsent.createdAt))
    const usage = await db
      .select({
        clientId: generationTask.clientId,
        lastUsed: max(generationTask.createdAt),
        tasks: sql<number>`count(*)`,
      })
      .from(generationTask)
      .where(eq(generationTask.userId, context.user.id))
      .groupBy(generationTask.clientId)
    const byClient = new Map(usage.map((row) => [row.clientId, row]))
    return {
      mcpUrl: `${env.BETTER_AUTH_URL}/mcp`,
      clients: clients.map((client) => ({
        ...client,
        registeredAt: client.registeredAt?.toISOString() ?? null,
        consentedAt: client.consentedAt?.toISOString() ?? null,
        lastUsed: byClient.get(client.clientId)?.lastUsed?.toISOString() ?? null,
        tasks: byClient.get(client.clientId)?.tasks ?? 0,
      })),
    }
  })

/**
 * Cuts a client off: it is disabled (the MCP route refuses its tokens at once), its refresh tokens
 * are revoked and its consent is removed. Re-adding the server in Claude Code registers a new one.
 */
export const revokeClient = createServerFn({ method: "POST" })
  .middleware([signedIn])
  .validator(z.object({ clientId: z.string().max(200) }))
  .handler(async ({ context, data }) => {
    const now = new Date()
    await db.batch([
      db.update(oauthClient).set({ disabled: true }).where(eq(oauthClient.clientId, data.clientId)),
      db
        .update(oauthRefreshToken)
        .set({ revoked: now })
        .where(
          and(
            eq(oauthRefreshToken.clientId, data.clientId),
            eq(oauthRefreshToken.userId, context.user.id),
            isNull(oauthRefreshToken.revoked)
          )
        ),
      db
        .delete(oauthConsent)
        .where(
          and(eq(oauthConsent.clientId, data.clientId), eq(oauthConsent.userId, context.user.id))
        ),
    ])
    return { ok: true }
  })
