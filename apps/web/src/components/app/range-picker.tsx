import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group"

const RANGES = [1, 7, 30, 90] as const

/** The time range a page reports on, one row above its charts. */
export function RangePicker({
  days,
  onChange,
}: {
  days: number
  onChange: (days: number) => void
}) {
  return (
    <ToggleGroup
      variant="outline"
      size="sm"
      value={[String(days)]}
      onValueChange={(value: string[]) => value[0] && onChange(Number(value[0]))}
      aria-label="Range"
    >
      {RANGES.map((range) => (
        <ToggleGroupItem key={range} value={String(range)}>
          {range === 1 ? "24h" : `${range}d`}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
