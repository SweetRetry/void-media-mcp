import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router"
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { CircleAlertIcon, DownloadIcon, ExternalLinkIcon, RefreshCwIcon } from "lucide-react"
import type { ReactNode } from "react"

import { CopyButton } from "@/components/app/copy-button"
import { LocalTime } from "@/components/app/local-time"
import { PageHeader } from "@/components/app/page-header"
import { TaskState } from "@/components/app/task-state"
import { bytes, runs, usd } from "@/lib/format"
import { taskDetail } from "@/server/admin.functions"

export const Route = createFileRoute("/_app/tasks/$taskId")({
  loader: async ({ params }) => {
    const detail = await taskDetail({ data: { id: params.taskId } })
    if (!detail) throw notFound()
    return detail
  },
  head: () => ({ meta: [{ title: "Generation" }] }),
  component: TaskDetail,
})

const OPEN = new Set(["queued", "running", "confirming"])

function TaskDetail() {
  const { task, price, clientName } = Route.useLoaderData()
  const router = useRouter()

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Generations", to: "/tasks" }, { label: task.prompt.slice(0, 40) }]}
        actions={
          OPEN.has(task.state) && (
            <Button variant="secondary" size="sm" onClick={() => router.invalidate()}>
              <RefreshCwIcon data-icon="inline-start" />
              Refresh
            </Button>
          )
        }
      />
      <div className="grid gap-4 p-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          {task.failure && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertTitle>{task.state === "partial" ? "Some runs failed" : "It failed"}</AlertTitle>
              <AlertDescription>{task.failure}</AlertDescription>
            </Alert>
          )}
          {task.outputs.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>No output</CardTitle>
                <CardDescription>
                  {OPEN.has(task.state)
                    ? `${runs(task.pendingRuns || task.runs)} still with the provider.`
                    : "Nothing was delivered."}
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {task.outputs.map((output, index) => (
                <Card key={output.url}>
                  <CardContent>
                    <a href={output.url} target="_blank" rel="noreferrer" className="block">
                      {output.mime.startsWith("video/") ? (
                        <video src={output.url} controls className="w-full rounded-lg">
                          <track kind="captions" />
                        </video>
                      ) : output.mime.startsWith("audio/") ? (
                        <audio src={output.url} controls className="w-full">
                          <track kind="captions" />
                        </audio>
                      ) : (
                        <img src={output.url} alt={task.prompt} className="w-full rounded-lg" />
                      )}
                    </a>
                  </CardContent>
                  <CardHeader>
                    <CardTitle>Output {index + 1}</CardTitle>
                    <CardDescription>
                      {[
                        output.width && output.height ? `${output.width}×${output.height}` : null,
                        output.durationMs ? `${(output.durationMs / 1000).toFixed(1)}s` : null,
                        bytes(output.bytes),
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </CardDescription>
                    <CardAction>
                      <CopyButton text={output.url} label="Copy link" />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Download"
                        render={<a href={output.url} download aria-label="Download" />}
                        nativeButton={false}
                      >
                        <DownloadIcon />
                      </Button>
                    </CardAction>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Prompt</CardTitle>
              <CardAction>
                <CopyButton text={task.prompt} label="Copy prompt" />
              </CardAction>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{task.prompt}</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
              <CardAction>
                <TaskState state={task.state} />
              </CardAction>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <Row label="Model">
                  <Link
                    to="/tasks"
                    search={{ model: task.model }}
                    className="font-mono text-xs hover:underline"
                  >
                    {task.model}
                  </Link>
                </Row>
                <Row label="Runs">{task.runs}</Row>
                {Object.entries(task.params).map(([key, value]) => (
                  <Row key={key} label={key}>
                    {String(value)}
                  </Row>
                ))}
                <Row label="Client">{clientName ?? "—"}</Row>
                <Row label="Started">
                  <LocalTime iso={task.createdAt} />
                </Row>
                <Row label="Finished">
                  {task.finishedAt ? <LocalTime iso={task.finishedAt} /> : "—"}
                </Row>
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Cost</CardTitle>
              <CardDescription>List price, not an invoice</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <Row label="Quoted">{usd(task.quoteUsd)}</Row>
                <Row label="Delivered">{usd(task.costUsd)}</Row>
                <Row label="Tokens">{task.tokens ?? "—"}</Row>
                <Row label="Possibly billed">
                  {task.possiblyBilledRuns ? runs(task.possiblyBilledRuns) : "—"}
                </Row>
                {price && (
                  <Row label="Price">
                    {price.amount} {price.currency} per {price.per}
                  </Row>
                )}
              </dl>
            </CardContent>
          </Card>
          <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
            <span className="truncate font-mono">{task.id}</span>
            <CopyButton text={task.id} label="Copy task id" />
            {task.outputs[0] && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Open output"
                render={
                  <a
                    href={task.outputs[0].url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Open output"
                  />
                }
                nativeButton={false}
              >
                <ExternalLinkIcon />
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right tabular-nums">{children}</dd>
    </>
  )
}
