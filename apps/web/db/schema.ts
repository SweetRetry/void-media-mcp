import { sql } from "void/db"
import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "void/schema-d1"

import { user } from "./auth-schema"

export * from "./auth-schema"

/**
 * Generation tasks. Their outputs live in R2 and are listed in `provider_ref`. Change the schema,
 * then run `pnpm db:generate` and commit the SQL in db/migrations.
 */

const now = sql`(cast(unixepoch('subsecond') * 1000 as integer))`
const at = (name: string) => integer(name, { mode: "timestamp_ms" })

export const TASK_STATES = [
  "queued",
  "running",
  "confirming",
  "succeeded",
  "partial",
  "failed",
] as const

/**
 * One generation request: a prompt, params and references sent to one model `runs` times. It moves
 * queued → running → succeeded | partial | failed. `confirming` is a run whose request was lost
 * (timeout, 5xx), so the provider may still deliver and bill it. The cost columns are the audit.
 */
export const generationTask = sqliteTable(
  "generation_task",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** The OAuth client (`azp`) that asked for it, such as one Claude Code install. */
    clientId: text("client_id"),
    /** Makes a submit idempotent: the same key from the same user returns the same task. */
    clientKey: text("client_key"),
    /** The catalog's API model id, e.g. `doubao-seedream-5-0-260128`. */
    model: text("model").notNull(),
    provider: text("provider").notNull(),
    modality: text("modality", { enum: ["image", "video", "audio"] }).notNull(),
    prompt: text("prompt").notNull(),
    params: text("params", { mode: "json" })
      .notNull()
      .$type<Record<string, string | number | boolean>>(),
    references: text("references", { mode: "json" })
      .notNull()
      .$type<{ role: string; url: string; mime: string }[]>(),
    runs: integer("runs").notNull(),
    state: text("state", { enum: TASK_STATES }).notNull(),
    /** Each run's provider task, stored files or failure, as JSON (`Run[]` in src/server/generation/runs.server.ts). */
    providerRef: text("provider_ref"),
    failure: text("failure"),
    /** List price of every run at submit, in USD. Null when the catalog publishes no price. */
    quoteUsd: real("quote_usd"),
    /** What the delivered runs cost at list price, or by the tokens the provider reported. */
    costUsd: real("cost_usd"),
    /** The catalog price the quote and cost were computed from, as it stood at submit. */
    price: text("price", { mode: "json" }).$type<unknown>(),
    /** Tokens the provider reported billing, when it reports any. */
    tokens: integer("tokens"),
    /** Runs whose outcome stayed unknown: the provider may have billed them without delivering. */
    lostRuns: integer("lost_runs").notNull().default(0),
    createdAt: at("created_at").default(now).notNull(),
    startedAt: at("started_at"),
    finishedAt: at("finished_at"),
    confirmUntil: at("confirm_until"),
  },
  (table) => [
    index("generation_task_user_idx").on(table.userId, table.createdAt),
    index("generation_task_state_idx").on(table.state, table.createdAt),
    uniqueIndex("generation_task_client_key_idx").on(table.userId, table.clientKey),
  ]
)

/**
 * Models and providers the admin turned off. A row means off; deleting it turns the entry back on.
 * `generate` refuses an off model, and a model whose provider is off, before anything is recorded.
 * Tasks already running keep going, since their runs may already be billed.
 */
export const switchedOff = sqliteTable(
  "switched_off",
  {
    kind: text("kind", { enum: ["model", "provider"] }).notNull(),
    /** A catalog model id or provider id. */
    id: text("id").notNull(),
    offAt: at("off_at").default(now).notNull(),
  },
  (table) => [primaryKey({ columns: [table.kind, table.id] })]
)
