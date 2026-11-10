import {
  apiOf,
  type HttpCall,
  type MediaModel,
  type Outcome,
  providerOf,
  type ResolvedInput,
} from "@workspace/model-providers"
import env from "@env"

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

/** A provider's key, by the `keyEnv` the catalog names. Read per call, inside the request. */
const keyOf = (keyEnv: string) =>
  ({ ARK_API_KEY: env.ARK_API_KEY, TUZI_API_KEY: env.TUZI_API_KEY })[keyEnv]

async function bodyOf(call: HttpCall): Promise<{ body?: BodyInit; type?: string }> {
  if (!call.body) return {}
  if (call.body.kind === "json")
    return { body: JSON.stringify(call.body.value), type: "application/json" }
  const form = new FormData()
  for (const [field, value] of Object.entries(call.body.fields)) form.append(field, value)
  for (const file of call.body.files) {
    const response = await fetch(file.url)
    form.append(file.field, await response.blob())
  }
  return { body: form }
}

async function send(model: MediaModel, call: HttpCall): Promise<{ ok: unknown } | Sent> {
  const provider = providerOf(model.provider)
  const key = keyOf(provider.keyEnv)
  if (!key) return { state: "failed", reason: `${provider.name} is not configured.` }
  const { body, type } = await bodyOf(call)
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
