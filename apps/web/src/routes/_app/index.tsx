import { createFileRoute, Link } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { ImageOffIcon } from "lucide-react"
import { z } from "zod"

import { dailySeries, ModelSpendChart, SpendChart } from "@/components/app/charts"
import { Thumb } from "@/components/app/thumb"
import { PageHeader } from "@/components/app/page-header"
import { RangePicker } from "@/components/app/range-picker"
import { Stat } from "@/components/app/stat"
import { TaskState } from "@/components/app/task-state"
import { ago, runs, usd } from "@/lib/format"
import { overview } from "@/server/admin.functions"

export const Route = createFileRoute("/_app/")({
  validateSearch: z.object({ days: z.number().int().min(1).max(366).optional() }),
  loaderDeps: ({ search }) => ({ days: search.days ?? 7 }),
  loader: ({ deps }) => overview({ data: deps }),
  head: () => ({ meta: [{ title: "Overview" }] }),
  component: Overview,
})

function Overview() {
  const { report, recent } = Route.useLoaderData()
  const { days } = Route.useLoaderDeps()
  const navigate = Route.useNavigate()
  const totals = report.totals
  const finished = (totals?.succeeded ?? 0) + (totals?.failed ?? 0)
  const successRate = finished ? `${Math.round(((totals?.succeeded ?? 0) / finished) * 100)}%` : "—"

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Overview" }]}
        actions={
          <RangePicker days={days} onChange={(next) => navigate({ search: { days: next } })} />
        }
      />
      <div className="flex flex-col gap-4 p-4">
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat
            label="Spend"
            value={usd(totals?.costUsd ?? 0)}
            hint={`Quoted ${usd(totals?.quotedUsd ?? 0)}`}
          />
          <Stat
            label="Generations"
            value={String(totals?.tasks ?? 0)}
            hint={`${totals?.open ?? 0} in progress`}
          />
          <Stat label="Success rate" value={successRate} hint={`${totals?.failed ?? 0} failed`} />
          <Stat
            label="Possibly billed"
            value={runs(totals?.possiblyBilledRuns ?? 0)}
            hint="Lost before delivering"
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Daily spend</CardTitle>
              <CardDescription>Delivered runs at list price, UTC days</CardDescription>
              <CardAction>
                <Button
                  variant="ghost"
                  size="sm"
                  render={<Link to="/costs" search={{ days }} />}
                  nativeButton={false}
                >
                  Cost audit
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              {report.byDay.length ? (
                <SpendChart data={dailySeries(report.byDay, days)} />
              ) : (
                <p className="text-sm text-muted-foreground">Nothing ran in this range.</p>
              )}
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Spend by model</CardTitle>
              <CardDescription>Top eight in this range</CardDescription>
            </CardHeader>
            <CardContent>
              {report.byModel.length ? (
                <ModelSpendChart rows={report.byModel} />
              ) : (
                <p className="text-sm text-muted-foreground">Nothing ran in this range.</p>
              )}
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Recent generations</CardTitle>
            <CardAction>
              <Button variant="ghost" size="sm" render={<Link to="/tasks" />} nativeButton={false}>
                View all
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <ImageOffIcon />
                  </EmptyMedia>
                  <EmptyTitle>No generations yet</EmptyTitle>
                  <EmptyDescription>Ask Claude Code to generate an image.</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button variant="secondary" render={<Link to="/connect" />} nativeButton={false}>
                    Connect Claude Code
                  </Button>
                </EmptyContent>
              </Empty>
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {recent.map((task) => (
                  <li key={task.id}>
                    <Link
                      to="/tasks/$taskId"
                      params={{ taskId: task.id }}
                      className="group flex flex-col items-start gap-2 rounded-lg"
                    >
                      <Thumb
                        prompt={task.prompt}
                        outputs={task.outputs}
                        className="aspect-square w-full group-hover:opacity-90"
                      />
                      <TaskState state={task.state} />
                      <p className="line-clamp-2 text-xs group-hover:underline">{task.prompt}</p>
                      <span className="text-xs text-muted-foreground">{ago(task.createdAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
