import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router"
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { controlsOf, modelOf } from "@workspace/model-providers"
import {
  CircleAlertIcon,
  DownloadIcon,
  FileQuestionIcon,
  MusicIcon,
  RefreshCwIcon,
} from "lucide-react"
import { type ReactNode, useEffect, useRef, useState } from "react"

import { CopyButton } from "@/components/app/copy-button"
import { MediaPreview } from "@/components/app/media-preview"
import { LocalTime } from "@/components/app/local-time"
import { PageHeader } from "@/components/app/page-header"
import { TaskState } from "@/components/app/task-state"
import { bytes, modelName, runs, usd } from "@/lib/format"
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
  const { task, price, clientName, sources } = Route.useLoaderData()
  const router = useRouter()
  const open = OPEN.has(task.state)
  const model = modelOf(task.model)
  // The image outputs as one set, so the viewer steps between them.
  const gallery = task.outputs
    .filter((output) => !output.mime.startsWith("video/") && !output.mime.startsWith("audio/"))
    .map((output) => ({ url: output.url, mime: output.mime, alt: task.prompt }))
  const labels = new Map<string, string>(
    model ? controlsOf(model.params).map((c) => [c.key, c.label]) : []
  )

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Generations", to: "/tasks" }, { label: task.prompt.slice(0, 40) }]}
        actions={
          open && (
            <Button variant="secondary" size="sm" onClick={() => router.invalidate()}>
              <RefreshCwIcon data-icon="inline-start" />
              Refresh
            </Button>
          )
        }
      />
      <div className="grid grid-cols-12 gap-8 p-4 lg:p-6">
        <div className="col-span-12 flex flex-col gap-8 lg:col-span-8">
          {task.failure && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertTitle>{task.state === "partial" ? "Some runs failed" : "It failed"}</AlertTitle>
              <AlertDescription>{task.failure}</AlertDescription>
            </Alert>
          )}

          {task.outputs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {open
                ? `${runs(task.pendingRuns || task.runs)} still with the provider.`
                : "Nothing was delivered."}
            </p>
          ) : (
            <div
              className={
                task.outputs.length > 1 ? "grid gap-6 sm:grid-cols-2" : "flex max-w-xl flex-col"
              }
            >
              {task.outputs.map((output) => (
                <figure key={output.url} className="flex flex-col gap-2">
                  {output.mime.startsWith("video/") ? (
                    <video src={output.url} controls className="w-full rounded-lg bg-muted">
                      <track kind="captions" />
                    </video>
                  ) : output.mime.startsWith("audio/") ? (
                    <audio src={output.url} controls className="w-full">
                      <track kind="captions" />
                    </audio>
                  ) : (
                    <MediaPreview
                      media={gallery}
                      index={gallery.findIndex((item) => item.url === output.url)}
                    >
                      <img src={output.url} alt={task.prompt} className="w-full rounded-lg" />
                    </MediaPreview>
                  )}
                  <figcaption className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {output.width && output.height ? `${output.width}×${output.height}` : null}
                      {output.durationMs ? ` ${(output.durationMs / 1000).toFixed(1)}s` : null}
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                      {bytes(output.bytes)}
                    </span>
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
                  </figcaption>
                </figure>
              ))}
            </div>
          )}

          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium">Prompt</h2>
              <CopyButton text={task.prompt} label="Copy prompt" />
            </div>
            <p className="text-sm whitespace-pre-wrap">{task.prompt}</p>
          </section>

          {task.references.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-medium">References</h2>
              <ul className="flex flex-wrap gap-4">
                {task.references.map((reference, index) => (
                  <li key={`${index}-${reference.url}`} className="flex w-32 flex-col gap-1.5">
                    <ReferenceMedia url={reference.url} mime={reference.mime} />
                    <span className="text-xs text-muted-foreground">
                      {ROLES[reference.role] ?? reference.role}
                    </span>
                    {sources[reference.url] && (
                      <Link
                        to="/tasks/$taskId"
                        params={{ taskId: sources[reference.url]! }}
                        className="text-xs hover:underline"
                      >
                        From a generation
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="col-span-12 flex flex-col gap-8 lg:col-span-4">
          <Facts>
            <Row label="State">
              <TaskState state={task.state} />
            </Row>
            <Row label="Model">
              <Link to="/tasks" search={{ model: task.model }} className="hover:underline">
                {modelName(task.model)}
              </Link>
            </Row>
            {task.runs > 1 && <Row label="Runs">{task.runs}</Row>}
            <Row label="Client">{clientName ?? "—"}</Row>
            <Row label="Created">
              <LocalTime iso={task.createdAt} />
            </Row>
            <Row label="Finished">
              {task.finishedAt ? <LocalTime iso={task.finishedAt} /> : "—"}
            </Row>
          </Facts>

          {Object.keys(task.params).length > 0 && (
            <Facts title="Settings">
              {Object.entries(task.params).map(([key, value]) => (
                <Row key={key} label={labels.get(key) ?? key}>
                  {String(value)}
                </Row>
              ))}
            </Facts>
          )}

          <Facts title="Cost">
            <Row label="Quoted">{usd(task.quoteUsd)}</Row>
            <Row label="Delivered">{usd(task.costUsd)}</Row>
            {task.tokens ? <Row label="Tokens">{task.tokens}</Row> : null}
            {task.possiblyBilledRuns ? (
              <Row label="Possibly billed">
                <span className="text-warning">{runs(task.possiblyBilledRuns)}</span>
              </Row>
            ) : null}
            {price && (
              <Row label="List price">
                {price.amount} {price.currency} per {price.per}
              </Row>
            )}
          </Facts>

          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="min-w-0 truncate font-mono">{task.id}</span>
            <CopyButton text={task.id} label="Copy task id" />
          </div>
        </aside>
      </div>
    </>
  )
}

const ROLES: Record<string, string> = {
  reference: "Reference",
  "first-frame": "First frame",
  "last-frame": "Last frame",
  mask: "Mask",
}

/**
 * A reference as a square. Outside URLs often expire (temporary image hosts), so one that no longer
 * loads says so instead of showing a broken image.
 */
function ReferenceMedia({ url, mime }: { url: string; mime: string }) {
  const [gone, setGone] = useState(false)
  const image = useRef<HTMLImageElement>(null)
  // An image that failed while the page was server-rendered fired its error before React listened.
  useEffect(() => {
    if (image.current?.complete && image.current.naturalWidth === 0) setGone(true)
  }, [])
  const box = "flex size-32 items-center justify-center overflow-hidden rounded-lg bg-muted"
  if (gone)
    return (
      <div className={`${box} flex-col gap-1 text-muted-foreground`}>
        <FileQuestionIcon className="size-5" aria-hidden />
        <span className="text-xs">Unavailable</span>
      </div>
    )
  const media = [{ url, mime, alt: "Reference" }]
  if (mime.startsWith("video/"))
    return (
      <MediaPreview media={media} label="Play reference video">
        <video
          src={url}
          muted
          preload="metadata"
          className={`${box} object-cover`}
          onError={() => setGone(true)}
        >
          <track kind="captions" />
        </video>
      </MediaPreview>
    )
  if (mime.startsWith("audio/"))
    return (
      <MediaPreview media={media} label="Play reference audio">
        <div className={`${box} text-muted-foreground`}>
          <MusicIcon className="size-5" aria-hidden />
        </div>
      </MediaPreview>
    )
  return (
    <MediaPreview media={media}>
      <img
        ref={image}
        src={url}
        alt="Reference"
        loading="lazy"
        className={`${box} object-cover`}
        onError={() => setGone(true)}
      />
    </MediaPreview>
  )
}

/** A group of label and value rows; the first group needs no title, the state leads it. */
function Facts({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      {title && <h2 className="text-sm font-medium">{title}</h2>}
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">{children}</dl>
    </section>
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
