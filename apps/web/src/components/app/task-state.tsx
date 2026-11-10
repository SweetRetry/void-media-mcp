import type { TASK_STATES } from "@db/schema"
import { Spinner } from "@workspace/ui/components/spinner"

// The schema's list, restated so the browser bundle does not pull in the schema module.
export const STATES = [
  "queued",
  "running",
  "confirming",
  "succeeded",
  "partial",
  "failed",
] as const satisfies typeof TASK_STATES
export type State = (typeof STATES)[number]

/** One name per state, used by the filter and every row alike. */
export const STATE_LABEL: Record<State, string> = {
  queued: "Queued",
  running: "Running",
  confirming: "Confirming",
  succeeded: "Done",
  partial: "Partly done",
  failed: "Failed",
}

const DOT: Record<State, string> = {
  queued: "bg-muted-foreground",
  running: "",
  confirming: "",
  succeeded: "bg-success",
  partial: "bg-warning",
  failed: "bg-destructive",
}

/**
 * A task's state as a dot and a word. Done is the norm and stays quiet; the word carries the state,
 * the dot only helps a scan, so color is never the only signal.
 */
export function TaskState({ state }: { state: string }) {
  const known = state as State
  const working = known === "running" || known === "confirming"
  return (
    <span className="inline-flex items-center gap-2 text-sm whitespace-nowrap">
      {working ? (
        <span className="text-muted-foreground">
          <Spinner className="size-3.5" />
        </span>
      ) : (
        <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${DOT[known] ?? ""}`} />
      )}
      <span className={known === "succeeded" ? "text-muted-foreground" : undefined}>
        {STATE_LABEL[known] ?? state}
      </span>
    </span>
  )
}
