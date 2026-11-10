import { Card, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import type { ReactNode } from "react"

/** One headline number: what it is, the value, and a line of context. */
export function Stat({ label, value, hint }: { label: string; value: string; hint?: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
        {hint && <CardDescription>{hint}</CardDescription>}
      </CardHeader>
    </Card>
  )
}
