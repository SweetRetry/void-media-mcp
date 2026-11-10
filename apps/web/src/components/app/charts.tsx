import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@workspace/ui/components/chart"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { daysOf, LOCALE, usd } from "@/lib/format"

/*
 * Charts follow DESIGN.md: `chart-1` for the series that matters, `chart-5` for context. The pair
 * is validated in both modes; every chart sits beside a table of the same numbers.
 */

type Day = { day: string; costUsd: number | null; quotedUsd: number | null; tasks: number }

/** Every day of the range, oldest first, with zeros where nothing ran. */
export function dailySeries(rows: Day[], days: number) {
  const byDay = new Map(rows.map((row) => [row.day, row]))
  return daysOf(days).map((day) => ({
    day,
    cost: byDay.get(day)?.costUsd ?? 0,
    quoted: byDay.get(day)?.quotedUsd ?? 0,
    tasks: byDay.get(day)?.tasks ?? 0,
  }))
}

const shortDay = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString(LOCALE, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })

const spendConfig = {
  cost: { label: "Delivered", color: "var(--chart-1)" },
  quoted: { label: "Quoted", color: "var(--chart-5)" },
} satisfies ChartConfig

/** Spend per day. With `compare`, the quote sits beside what delivered, as context. */
export function SpendChart({
  data,
  compare = false,
}: {
  data: ReturnType<typeof dailySeries>
  compare?: boolean
}) {
  return (
    <ChartContainer config={spendConfig} className="aspect-auto h-56 w-full">
      <BarChart data={data} barGap={2} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="day"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
          tickFormatter={shortDay}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={56}
          tickFormatter={(value: number) => `$${value.toFixed(2)}`}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              labelFormatter={(value) => shortDay(String(value))}
              formatter={(value, name) => (
                <div className="flex w-full justify-between gap-4">
                  <span className="text-muted-foreground">
                    {spendConfig[name as keyof typeof spendConfig]?.label ?? name}
                  </span>
                  <span className="font-mono tabular-nums">{usd(Number(value))}</span>
                </div>
              )}
            />
          }
        />
        {compare && <ChartLegend content={<ChartLegendContent />} />}
        {compare && <Bar dataKey="quoted" fill="var(--color-quoted)" radius={4} />}
        <Bar dataKey="cost" fill="var(--color-cost)" radius={4} />
      </BarChart>
    </ChartContainer>
  )
}
