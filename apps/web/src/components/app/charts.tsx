import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@workspace/ui/components/chart"
import type { CSSProperties } from "react"
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts"

import { daysOf, LOCALE, modelName, usd } from "@/lib/format"

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

/** Axis dollars: cents above $1, two significant digits below, so small ranges never repeat a tick. */
const tick = (value: number) =>
  value === 0 || value >= 1 ? `$${value.toFixed(2)}` : `$${Number(value.toPrecision(2))}`

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
        <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={tick} />
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

const modelConfig = { cost: { label: "Delivered", color: "var(--chart-1)" } } satisfies ChartConfig

/** Delivered spend per model, largest first, on one baseline: ranked bars compare more exactly than a pie. */
export function ModelSpendChart({ rows }: { rows: { model: string; costUsd: number | null }[] }) {
  const data = rows
    .map((row) => ({ model: modelName(row.model), cost: row.costUsd ?? 0 }))
    .sort((a, b) => b.cost - a.cost)
  // Each name sits above its bar, so a long model id never competes with the bars for width.
  return (
    <ChartContainer
      config={modelConfig}
      className="aspect-auto h-[calc(var(--rows)*44px+8px)] w-full"
      style={{ "--rows": data.length } as CSSProperties}
    >
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 16, right: 64, left: 0 }}
        barCategoryGap={14}
        accessibilityLayer
      >
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="model" hide />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              hideIndicator
              formatter={(value) => (
                <span className="font-mono tabular-nums">{usd(Number(value))}</span>
              )}
            />
          }
        />
        <Bar dataKey="cost" fill="var(--color-cost)" radius={4} minPointSize={2}>
          <LabelList
            dataKey="model"
            content={({ x, y, value }) => (
              <text x={Number(x)} y={Number(y) - 6} className="fill-muted-foreground text-xs">
                {String(value)}
              </text>
            )}
          />
          <LabelList
            dataKey="cost"
            position="right"
            className="fill-foreground"
            formatter={(value: unknown) => usd(Number(value))}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}
