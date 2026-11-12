import {
  apiOf,
  type HttpCall,
  type MediaModel,
  type Outcome,
  providerOf,
  type ResolvedInput,
} from "@workspace/model-providers"
import { env } from "cloudflare:workers"
import { storage } from "void/storage"

import { outputIdOf, outputKey } from "./runs.server"

/*
 * The one place the server talks to a generation provider. `packages/model-providers` describes
 * each call; this adds the base URL and the key, sends it and reads the answer back through the
 * model's adapter.
 */

/** How long one provider request may take before its status counts as unknown. */
const REQUEST_MS = 240_000

/**
 * Where a call stands from the server's side. `unknown` is a timeout, a dropped connection or a
 * server error: the provider may still be working, which a generation treats as confirming.
 */
export type Sent = Outcome | { state: "unknown"; reason: string }

/*
 * Read from `cloudflare:workers`, not `@env`: `void deploy` bundles the queue and cron handlers in a
 * separate build that resolves `void/env` to its browser copy, which throws on every server key.
 */
declare global {
  namespace Cloudflare {
    interface Env {
      ARK_API_KEY?: string
      TUZI_API_KEY?: string
      BETTER_AUTH_URL: string
    }
  }
}

/** A provider's key, by the `keyEnv` the catalog names. Read per call. */
const keyOf = (keyEnv: string) =>
  ({ ARK_API_KEY: env.ARK_API_KEY, TUZI_API_KEY: env.TUZI_API_KEY })[keyEnv]

/**
 * A reference's bytes, for a call that uploads them. Our own outputs (`/f/<id>`) are read from R2:
 * a Worker cannot fetch its own workers.dev URL, Cloudflare answers with an error page instead.
 */
async function fileOf(url: string): Promise<Blob | { failed: string }> {
  const parsed = new URL(url)
  if (parsed.origin === new URL(env.BETTER_AUTH_URL).origin && parsed.pathname.startsWith("/f/")) {
    const id = outputIdOf(parsed.pathname.slice(3))
    const object = id && (await storage.get(outputKey(id)))
    if (!object) return { failed: `${url} is not a stored output.` }
    return new Blob([await object.arrayBuffer()], { type: object.httpMetadata?.contentType })
  }
  const response = await fetch(url).catch(() => null)
  if (!response?.ok)
    return { failed: `${url} could not be fetched (${response?.status ?? "no answer"}).` }
  return response.blob()
}

async function bodyOf(
  call: HttpCall
): Promise<{ body?: BodyInit; type?: string } | { failed: string }> {
  if (!call.body) return {}
  if (call.body.kind === "json")
    return { body: JSON.stringify(call.body.value), type: "application/json" }
  const form = new FormData()
  for (const [field, value] of Object.entries(call.body.fields)) form.append(field, value)
  for (const file of call.body.files) {
    const blob = await fileOf(file.url)
    if ("failed" in blob) return blob
    form.append(file.field, blob)
  }
  return { body: form }
}

async function send(model: MediaModel, call: HttpCall): Promise<{ ok: unknown } | Sent> {
  const provider = providerOf(model.provider)
  const key = keyOf(provider.keyEnv)
  if (!key) return { state: "failed", reason: `${provider.name} is not configured.` }
  const built = await bodyOf(call)
  if ("failed" in built) return { state: "failed", reason: `A reference: ${built.failed}` }
  const { body, type } = built
  let response: Response
  try {
    response = await fetch(`${provider.baseUrl}${call.path}`, {
      method: call.method,
      headers: { authorization: `Bearer ${key}`, ...(type && { "content-type": type }) },
      body,
      signal: AbortSignal.timeout(REQUEST_MS),
    })
  } catch (error) {
    return { state: "unknown", reason: String(error) }
  }
  const text = await response.text()
  if (response.status >= 500 || response.status === 429)
    return { state: "unknown", reason: `${provider.name} answered ${response.status}` }
  if (!response.ok)
    return { state: "failed", reason: `${provider.name} refused it: ${errorOf(text)}` }
  try {
    return { ok: JSON.parse(text) }
  } catch {
    return { state: "failed", reason: `${provider.name} sent an unreadable answer.` }
  }
}

/** The provider's own error message, when its body carries one. */
function errorOf(text: string) {
  try {
    const body = JSON.parse(text) as { error?: { message?: string } | string; message?: string }
    const error = typeof body.error === "string" ? body.error : body.error?.message
    return (error ?? body.message ?? text).slice(0, 300)
  } catch {
    return text.slice(0, 300)
  }
}

/** Submits one run. A synchronous provider answers with the result; an asynchronous one, a task. */
export async function submitRun(model: MediaModel, input: ResolvedInput): Promise<Sent> {
  const adapter = apiOf(model)
  const sent = await send(model, adapter.submit(model, input))
  return "ok" in sent ? adapter.read(sent.ok) : sent
}

/** Asks an asynchronous provider where a submitted run stands. */
export async function pollRun(model: MediaModel, taskId: string): Promise<Sent> {
  const poll = apiOf(model).poll
  if (!poll) return { state: "unknown", reason: `${model.name} has no task to poll` }
  const sent = await send(model, poll.call(taskId))
  return "ok" in sent ? poll.read(sent.ok) : sent
}
