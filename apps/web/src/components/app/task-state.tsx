import { Badge } from "@workspace/ui/components/badge"
import { Spinner } from "@workspace/ui/components/spinner"
import { CircleAlertIcon, CircleCheckIcon, CircleDashedIcon } from "lucide-react"

const OPEN = new Set(["queued", "running", "confirming"])

/** A task's state as a badge: an icon and the word, never color alone. */
export function TaskState({ state }: { state: string }) {
  if (OPEN.has(state))
    return (
      <Badge variant="outline">
        {state === "queued" ? <CircleDashedIcon /> : <Spinner />}
        {state}
      </Badge>
    )
  if (state === "failed")
    return (
      <Badge variant="destructive">
        <CircleAlertIcon />
        failed
      </Badge>
    )
  return (
    <Badge variant="secondary">
      {state === "partial" ? <CircleAlertIcon /> : <CircleCheckIcon />}
      {state}
    </Badge>
  )
}
