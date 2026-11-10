/** A company whose API serves models, and what reaching it needs. */
export type ProviderId = "bytedance" | "tuzi"

export type Provider = {
  id: ProviderId
  /** Shown beside a model in the pickers. */
  name: string
  /** Base URL. A model's `path` is relative to it. */
  baseUrl: string
  /** Name of the secret or `.env` entry that holds its key. */
  keyEnv: string
}
