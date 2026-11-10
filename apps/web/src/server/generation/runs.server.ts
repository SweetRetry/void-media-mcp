import type { Output } from "@workspace/model-providers"
import { storage } from "void/storage"

import { factsOf, mimeOf } from "./facts"
import type { Sent } from "./provider.server"

/** A delivered file in R2 under `o/<id>`. The random id is the capability in its public URL. */
type Stored = {
  id: string
  mime: string
  bytes: number
  width?: number
  height?: number
  durationMs?: number
}

/**
 * Where one run of a task stands, kept in `provider_ref`: the provider's task while it runs, the
 * files it delivered, or why it failed. `lost` is a run whose outcome is unknown (a timeout or a
 * 5xx), and `billable` marks a failure that began as lost, since the provider may have charged it.
 */
export type Run =
  | { pending: string }
  | { stored: Stored[]; tokens?: number }
  | { failed: string; billable?: true }
  | { lost: string }

export const runsOf = (providerRef: string | null): Run[] =>
  providerRef ? (JSON.parse(providerRef) as Run[]) : []

export const outputKey = (id: string) => `o/${id}`

const randomId = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
    b.toString(16).padStart(2, "0")
  ).join("")

/** Copies one delivered output into R2, so no provider link (which expires) is kept. */
async function store(taskId: string, output: Output): Promise<Stored> {
  let bytes: Uint8Array
  let mime: string
  if (output.asset.kind === "inline") {
    bytes = Uint8Array.from(atob(output.asset.base64), (char) => char.charCodeAt(0))
    mime = output.asset.mime
  } else {
    const response = await fetch(output.asset.url)
    if (!response.ok) throw new Error(`Fetching an output answered ${response.status}`)
    bytes = new Uint8Array(await response.arrayBuffer())
    mime = response.headers.get("content-type")?.split(";")[0] ?? "application/octet-stream"
  }
  mime = mimeOf(bytes, mime)
  const id = randomId()
  await storage.put(outputKey(id), bytes, {
    httpMetadata: { contentType: mime },
    customMetadata: { task: taskId },
  })
  const facts = factsOf(bytes)
  return {
    id,
    mime,
    bytes: bytes.length,
    width: facts.width ?? output.width,
    height: facts.height ?? output.height,
    durationMs: facts.durationMs,
  }
}

/** What a provider's answer for one run becomes. A done run is stored at once. */
export async function runOf(taskId: string, sent: Sent, submitted: boolean): Promise<Run> {
  if (sent.state === "pending") return { pending: sent.taskId }
  if (sent.state === "failed") return { failed: sent.reason }
  if (sent.state === "unknown") return { lost: sent.reason }
  if (!sent.result.results.length) return { failed: "The provider delivered no file." }
  try {
    const stored = await Promise.all(sent.result.results.map((output) => store(taskId, output)))
    return { stored, ...(sent.result.usage && { tokens: sent.result.usage.tokens }) }
  } catch (error) {
    // Delivered but not copied: a poll can fetch it again; a synchronous answer is gone, and billed.
    return submitted ? { lost: String(error) } : { failed: String(error), billable: true }
  }
}
