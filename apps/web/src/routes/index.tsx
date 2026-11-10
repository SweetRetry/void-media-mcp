import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { z } from "zod"

import { authClient } from "@/lib/auth-client"
import { dashboard } from "@/server/dashboard.functions"

const RANGES = [1, 7, 30, 90] as const

/** The admin page: how to connect, what it cost, and every task. */
export const Route = createFileRoute("/")({
  validateSearch: z.object({
    days: z.number().int().min(1).max(366).optional(),
    q: z.string().optional(),
    model: z.string().optional(),
  }),
  loaderDeps: ({ search }) => ({ days: search.days ?? 7, q: search.q, model: search.model }),
  loader: ({ deps }) => dashboard({ data: deps }),
  head: () => ({ meta: [{ title: "Void Media" }] }),
  component: Dashboard,
})

const usd = (value: number | null | undefined) =>
  value === null || value === undefined ? "—" : `$${value.toFixed(value < 1 ? 4 : 2)}`

const STATE_VARIANT = {
  succeeded: "secondary",
  partial: "outline",
  failed: "destructive",
} as const

function Dashboard() {
  const { email, mcpUrl, report, tasks } = Route.useLoaderData()
  const search = Route.useSearch()
  const days = search.days ?? 7
  const navigate = useNavigate()
  const totals = report.totals

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Void Media</h1>
          <p className="text-sm text-muted-foreground">{email}</p>
        </div>
        <Button
          variant="ghost"
          onClick={async () => {
            await authClient.signOut()
            await navigate({ to: "/sign-in" })
          }}
        >
          Sign out
        </Button>
      </header>

      <section className="mt-6">
        <h2 className="text-sm font-medium">Connect Claude Code</h2>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-muted p-3 text-xs">
          claude mcp add --transport http void-media {mcpUrl}
        </pre>
        <p className="mt-1 text-xs text-muted-foreground">
          Then run /mcp in Claude Code and authenticate. It opens this site to sign in and approve.
        </p>
      </section>

      <section className="mt-8">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-sm font-medium">Cost audit</h2>
          <nav className="flex gap-1" aria-label="Range">
            {RANGES.map((range) => (
              <Link
                key={range}
                to="/"
                search={{ ...search, days: range }}
                aria-current={range === days ? "page" : undefined}
                className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors aria-[current=page]:bg-muted aria-[current=page]:text-foreground"
              >
                {range === 1 ? "24h" : `${range}d`}
              </Link>
            ))}
          </nav>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label="Cost (delivered)" value={usd(totals?.costUsd ?? 0)} />
          <Stat label="Quoted" value={usd(totals?.quotedUsd ?? 0)} />
          <Stat label="Tasks" value={String(totals?.tasks ?? 0)} />
          <Stat label="Failed" value={String(totals?.failed ?? 0)} />
          <Stat
            label="Possibly billed, undelivered"
            value={`${totals?.possiblyBilledRuns ?? 0} runs`}
          />
        </dl>
        <p className="mt-2 text-xs text-muted-foreground">{report.basis}</p>

        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Model</TableHead>
                <TableHead className="text-right">Tasks</TableHead>
                <TableHead className="text-right">Quoted</TableHead>
                <TableHead className="text-right">Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.byModel.map((row) => (
                <TableRow key={row.model}>
                  <TableCell className="font-mono text-xs">{row.model}</TableCell>
                  <TableCell className="text-right">{row.tasks}</TableCell>
                  <TableCell className="text-right">{usd(row.quotedUsd)}</TableCell>
                  <TableCell className="text-right">{usd(row.costUsd)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Day (UTC)</TableHead>
                <TableHead className="text-right">Tasks</TableHead>
                <TableHead className="text-right">Failed</TableHead>
                <TableHead className="text-right">Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.byDay.map((row) => (
                <TableRow key={row.day}>
                  <TableCell>{row.day}</TableCell>
                  <TableCell className="text-right">{row.tasks}</TableCell>
                  <TableCell className="text-right">{row.failed}</TableCell>
                  <TableCell className="text-right">{usd(row.costUsd)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-medium">Generation log</h2>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              const form = new FormData(event.currentTarget)
              const text = (key: string) => String(form.get(key) ?? "").trim() || undefined
              void navigate({ to: "/", search: { days, q: text("q"), model: text("model") } })
            }}
          >
            <Input
              name="q"
              defaultValue={search.q}
              placeholder="Search prompts or a task id"
              aria-label="Search prompts"
              className="w-64"
            />
            <select
              name="model"
              defaultValue={search.model ?? ""}
              aria-label="Model"
              className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
            >
              <option value="">All models</option>
              {report.byModel.map((row) => (
                <option key={row.model} value={row.model}>
                  {row.model}
                </option>
              ))}
            </select>
            <Button type="submit" variant="secondary">
              Search
            </Button>
          </form>
        </div>
        {tasks.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {search.q || search.model
              ? "Nothing matches. Try other words or a wider range."
              : "No tasks in this range. Ask Claude Code to generate an image."}
          </p>
        ) : (
          <Table className="mt-3">
            <TableHeader>
              <TableRow>
                <TableHead>Output</TableHead>
                <TableHead>Prompt</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>State</TableHead>
                <TableHead className="text-right">Quoted</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell>
                    <div className="flex gap-1">
                      {task.outputs.map((output) => (
                        <a key={output.url} href={output.url} target="_blank" rel="noreferrer">
                          {output.mime.startsWith("image/") ? (
                            <img
                              src={output.url}
                              alt=""
                              loading="lazy"
                              className="size-12 rounded-md object-cover"
                            />
                          ) : (
                            <span className="text-xs text-primary">{output.mime}</span>
                          )}
                        </a>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <p className="line-clamp-2 text-xs">{task.prompt}</p>
                    {task.failure && (
                      <p className="line-clamp-2 text-xs text-destructive">{task.failure}</p>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{task.model}</TableCell>
                  <TableCell>
                    <Badge
                      variant={STATE_VARIANT[task.state as keyof typeof STATE_VARIANT] ?? "outline"}
                    >
                      {task.state}
                    </Badge>
                    {task.possiblyBilledRuns > 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {task.possiblyBilledRuns} lost run(s)
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{usd(task.quoteUsd)}</TableCell>
                  <TableCell className="text-right">{usd(task.costUsd)}</TableCell>
                  <TableCell>
                    <span className="text-xs whitespace-nowrap text-muted-foreground">
                      {new Date(task.createdAt).toLocaleString()}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </main>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/50 p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  )
}
