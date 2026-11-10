import type { MediaModality } from "./model"

/** Links from providers expire, or bytes come inline. The server copies either to storage, so no provider link is kept. */
export type Asset = { kind: "url"; url: string } | { kind: "inline"; mime: string; base64: string }

export type Output = { asset: Asset; width?: number; height?: number }

/** Every provider's answer in one shape. */
export type GenerationResult = {
  type: MediaModality
  results: Output[]
  /** Tokens billed, for token-priced models. */
  usage?: { tokens: number }
}

/** Where a generation stands. A sync provider answers `done` or `failed` at once. An async one answers `pending` with a task to poll. */
export type Outcome =
  | { state: "pending"; taskId: string; progress?: number }
  | { state: "done"; result: GenerationResult }
  | { state: "failed"; reason: string }
