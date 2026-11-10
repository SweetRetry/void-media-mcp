import type { ResolvedInput } from "../lib/input"
import type { MediaModel } from "../lib/model"
import type { Outcome } from "../lib/result"

/** Multipart files are named by URL. The server fetches each into the form, since a provider upload cannot take a link. */
export type Body =
  | { kind: "json"; value: unknown }
  | { kind: "multipart"; fields: Record<string, string>; files: { field: string; url: string }[] }

/** One HTTP call, described not made. `path` is relative to `baseUrl`. The server adds the base, key and content type, so this package holds no secret. */
export type HttpCall = { method: "GET" | "POST"; path: string; body?: Body }

/** `submit` writes the request, `read` parses the answer, and `poll` exists only for async providers. */
export type Adapter = {
  submit(model: MediaModel, input: ResolvedInput): HttpCall
  read(response: unknown): Outcome
  poll?: {
    call(taskId: string): HttpCall
    read(response: unknown): Outcome
  }
}

export const json = (value: unknown): Body => ({ kind: "json", value })

/** An answer that does not parse is a failure with the parser's message, never a throw. */
export const unreadable = (what: string, error: { message: string }): Outcome => ({
  state: "failed",
  reason: `Unreadable ${what} response: ${error.message}`,
})
