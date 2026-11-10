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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { z } from "zod"

import { dailySeries, ModelSpendChart, SpendChart } from "@/components/app/charts"
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
  const { report } = Route.useLoaderData()
  const { days } = Route.useLoaderDeps()
  const navigate = Route.useNavigate()
  const totals = report.totals
  const series = dailySeries(report.byDay, days)
  const drift = (totals?.quotedUsd ?? 0) - (totals?.costUsd ?? 0)

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

        {/* Each view is a chart and the table of the same numbers under it. */}
        <Tabs defaultValue="day">
          <TabsList>
            <TabsTrigger value="day">By day</TabsTrigger>
            <TabsTrigger value="model">By model</TabsTrigger>
          </TabsList>
          <TabsContent value="day" className="flex flex-col gap-6">
            <SpendChart data={series} compare />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Day (UTC)</TableHead>
                  <TableHead className="text-right">Generations</TableHead>
                  <TableHead className="text-right">Quoted</TableHead>
                  <TableHead className="text-right">Delivered</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...series].reverse().map((row) => (
                  <TableRow key={row.day}>
                    <TableCell>{row.day}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.tasks}</TableCell>
                    <TableCell className="text-right tabular-nums">{usd(row.quoted)}</TableCell>
                    <TableCell className="text-right tabular-nums">{usd(row.cost)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>
          <TabsContent value="model" className="flex flex-col gap-6">
            {report.byModel.length > 0 && <ModelSpendChart rows={report.byModel} />}
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
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}
