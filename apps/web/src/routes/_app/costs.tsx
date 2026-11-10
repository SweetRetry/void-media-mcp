import { createFileRoute } from "@tanstack/react-router"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
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

import { dailySeries, SpendChart } from "@/components/app/charts"
import { PageHeader } from "@/components/app/page-header"
import { RangePicker } from "@/components/app/range-picker"
import { Stat } from "@/components/app/stat"
import { runs, usd } from "@/lib/format"
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
      <div className="flex flex-col gap-4 p-4">
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat
            label="Delivered"
            value={usd(totals?.costUsd ?? 0)}
            hint="What delivered runs cost"
          />
          <Stat
            label="Quoted"
            value={usd(totals?.quotedUsd ?? 0)}
            hint={`${usd(drift)} not delivered`}
          />
          <Stat
            label="Unpriced"
            value={String(totals?.unpricedTasks ?? 0)}
            hint="Generations with no published price"
          />
          <Stat
            label="Possibly billed"
            value={runs(totals?.possiblyBilledRuns ?? 0)}
            hint="Check these against the provider's bill"
          />
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Quoted and delivered, per day</CardTitle>
            <CardDescription>{report.basis}</CardDescription>
          </CardHeader>
          <CardContent>
            <SpendChart data={series} compare />
          </CardContent>
        </Card>

        <Tabs defaultValue="model">
          <TabsList>
            <TabsTrigger value="model">By model</TabsTrigger>
            <TabsTrigger value="day">By day</TabsTrigger>
          </TabsList>
          <TabsContent value="model">
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
                    <TableCell className="font-mono text-xs">{row.model}</TableCell>
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
          <TabsContent value="day">
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
        </Tabs>
      </div>
    </>
  )
}
