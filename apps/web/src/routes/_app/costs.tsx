import { createFileRoute } from "@tanstack/react-router"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { z } from "zod"

import { ActivityHeatmap } from "@/components/ui/activity-heatmap"
import {
  Breakdown,
  BreakdownBar,
  BreakdownLegend,
  breakdownColors,
} from "@/components/ui/breakdown"
import { PageHeader } from "@/components/app/page-header"
import { RangePicker } from "@/components/app/range-picker"
import { modelName, runs, usd } from "@/lib/format"
import { costsPage } from "@/server/admin.functions"

export const Route = createFileRoute("/_app/costs")({
  validateSearch: z.object({ days: z.number().int().min(1).max(366).optional() }),
  loaderDeps: ({ search }) => ({ days: search.days ?? 30 }),
  loader: ({ deps }) => costsPage({ data: deps }),
  head: () => ({ meta: [{ title: "Costs" }] }),
  component: Costs,
})

function Costs() {
  const { report, year } = Route.useLoaderData()
  const { days } = Route.useLoaderDeps()
  const navigate = Route.useNavigate()
  const totals = report.totals
  const drift = (totals?.quotedUsd ?? 0) - (totals?.costUsd ?? 0)
  const parts = report.byModel.map((row) => ({
    key: row.model,
    label: modelName(row.model),
    value: row.costUsd ?? 0,
  }))
  // By rank in this range, not by catalog: with 15 models the catalog walks the five chart hues
  // three times, so two neighbours in the bar could share a hue.
  const colors = breakdownColors(parts.map((part) => part.key))

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Costs" }]}
        actions={
          <RangePicker days={days} onChange={(next) => navigate({ search: { days: next } })} />
        }
      />
      <div className="flex flex-col gap-8 p-4 lg:p-6">
        <section className="flex flex-wrap items-end gap-x-12 gap-y-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm text-muted-foreground">Delivered</h2>
            <p className="text-3xl font-semibold tabular-nums">{usd(totals?.costUsd ?? 0)}</p>
            <p className="text-xs text-muted-foreground">{report.basis}</p>
          </div>
          <dl className="grid grid-cols-[auto_auto] gap-x-6 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Quoted</dt>
            <dd className="text-right tabular-nums">{usd(totals?.quotedUsd ?? 0)}</dd>
            <dt className="text-muted-foreground">Not delivered</dt>
            <dd className="text-right tabular-nums">{usd(drift)}</dd>
            {(totals?.possiblyBilledRuns ?? 0) > 0 && (
              <>
                <dt className="text-muted-foreground">Possibly billed</dt>
                <dd className="text-right text-warning tabular-nums">
                  {runs(totals?.possiblyBilledRuns ?? 0)}
                </dd>
              </>
            )}
            {(totals?.unpricedTasks ?? 0) > 0 && (
              <>
                <dt className="text-muted-foreground">Unpriced</dt>
                <dd className="text-right tabular-nums">{totals?.unpricedTasks}</dd>
              </>
            )}
          </dl>
        </section>

        {parts.some((part) => part.value > 0) && (
          <section className="flex flex-col gap-4">
            <h2 className="text-sm font-medium">Delivered by model</h2>
            <Breakdown
              items={parts}
              colors={colors}
              formatValue={usd}
              formatShare={(share) => `${Math.round(share)}% of delivered`}
            >
              <BreakdownBar label="Delivered spend by model" />
              <BreakdownLegend />
            </Breakdown>
          </section>
        )}

        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-medium">Past year</h2>
          <ActivityHeatmap
            data={year.days.map((row) => ({ date: row.day, value: row.costUsd ?? 0 }))}
            end={year.end}
            formatValue={(value) => (value > 0 ? usd(value) : "No spend")}
          />
        </section>

        {/* The audit the bar leaves out: per model, what failed, what may be billed, what was quoted. */}
        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-medium">By model</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Model</TableHead>
                <TableHead className="text-right">Generations</TableHead>
                <TableHead className="text-right">Failed</TableHead>
                <TableHead className="text-right">Possibly billed</TableHead>
                <TableHead className="text-right">Quoted</TableHead>
                <TableHead className="text-right">Delivered</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.byModel.map((row) => (
                <TableRow key={row.model}>
                  <TableCell>{modelName(row.model)}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.tasks}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.failed}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.possiblyBilledRuns}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{usd(row.quotedUsd)}</TableCell>
                  <TableCell className="text-right tabular-nums">{usd(row.costUsd)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>Total</TableCell>
                <TableCell className="text-right tabular-nums">{totals?.tasks ?? 0}</TableCell>
                <TableCell className="text-right tabular-nums">{totals?.failed ?? 0}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {totals?.possiblyBilledRuns ?? 0}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {usd(totals?.quotedUsd ?? 0)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {usd(totals?.costUsd ?? 0)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </section>
      </div>
    </>
  )
}
