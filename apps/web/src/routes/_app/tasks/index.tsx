import { createFileRoute, Link } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@workspace/ui/components/input-group"
import { Pagination, PaginationContent, PaginationItem } from "@workspace/ui/components/pagination"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { ChevronLeftIcon, ChevronRightIcon, SearchIcon, SearchXIcon } from "lucide-react"
import { z } from "zod"

import { Thumb } from "@/components/app/thumb"
import { PageHeader } from "@/components/app/page-header"
import { TaskState } from "@/components/app/task-state"
import { ago, usd } from "@/lib/format"
import { tasksPage } from "@/server/admin.functions"

const STATES = ["queued", "running", "confirming", "succeeded", "partial", "failed"] as const
const ALL = "all"

const search = z.object({
  q: z.string().optional(),
  model: z.string().optional(),
  state: z.enum(STATES).optional(),
  page: z.number().int().min(1).optional(),
})

export const Route = createFileRoute("/_app/tasks/")({
  validateSearch: search,
  loaderDeps: ({ search }) => ({ ...search, page: search.page ?? 1 }),
  loader: ({ deps }) => tasksPage({ data: deps }),
  head: () => ({ meta: [{ title: "Generations" }] }),
  component: Tasks,
})

function Tasks() {
  const { tasks, total, pageSize, models } = Route.useLoaderData()
  const filters = Route.useSearch()
  const navigate = Route.useNavigate()
  const page = filters.page ?? 1
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const filter = (next: z.infer<typeof search>) =>
    navigate({ search: (prev) => ({ ...prev, ...next, page: undefined }) })

  return (
    <>
      <PageHeader crumbs={[{ label: "Generations" }]} />
      <div className="flex flex-col gap-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <form
            className="w-full sm:w-72"
            onSubmit={(event) => {
              event.preventDefault()
              const q = String(new FormData(event.currentTarget).get("q") ?? "").trim()
              void filter({ q: q || undefined })
            }}
          >
            <InputGroup>
              <InputGroupAddon>
                <SearchIcon />
              </InputGroupAddon>
              <InputGroupInput
                name="q"
                key={filters.q}
                defaultValue={filters.q}
                placeholder="Search prompts or a task id"
                aria-label="Search prompts"
              />
            </InputGroup>
          </form>
          <Select
            value={filters.model ?? ALL}
            onValueChange={(value) => filter({ model: value === ALL ? undefined : String(value) })}
          >
            <SelectTrigger aria-label="Model" className="w-56">
              <SelectValue>{(value: string) => (value === ALL ? "All models" : value)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All models</SelectItem>
              {models.map((model) => (
                <SelectItem key={model} value={model}>
                  {model}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.state ?? ALL}
            onValueChange={(value) =>
              filter({ state: value === ALL ? undefined : (value as (typeof STATES)[number]) })
            }
          >
            <SelectTrigger aria-label="State" className="w-36">
              <SelectValue>{(value: string) => (value === ALL ? "Any state" : value)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Any state</SelectItem>
              {STATES.map((state) => (
                <SelectItem key={state} value={state}>
                  {state}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(filters.q || filters.model || filters.state) && (
            <Button variant="ghost" onClick={() => navigate({ search: {} })}>
              Clear
            </Button>
          )}
          <span className="ml-auto text-sm text-muted-foreground tabular-nums">
            {total} {total === 1 ? "generation" : "generations"}
          </span>
        </div>

        {tasks.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <SearchXIcon />
              </EmptyMedia>
              <EmptyTitle>No matching generations</EmptyTitle>
              <EmptyDescription>Try other words, or clear the filters.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Output</TableHead>
                <TableHead>Prompt</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>State</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell>
                    <Thumb prompt={task.prompt} outputs={task.outputs} className="size-12" />
                  </TableCell>
                  <TableCell className="max-w-md">
                    <Link
                      to="/tasks/$taskId"
                      params={{ taskId: task.id }}
                      className="line-clamp-2 whitespace-normal hover:underline"
                    >
                      {task.prompt}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{task.model}</TableCell>
                  <TableCell>
                    <TaskState state={task.state} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {usd(task.costUsd ?? task.quoteUsd)}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-xs text-muted-foreground">{ago(task.createdAt)}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {pages > 1 && (
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <Button
                  variant="ghost"
                  disabled={page <= 1}
                  onClick={() => navigate({ search: { ...filters, page: page - 1 } })}
                >
                  <ChevronLeftIcon data-icon="inline-start" />
                  Previous
                </Button>
              </PaginationItem>
              <PaginationItem>
                <span className="px-3 text-sm text-muted-foreground tabular-nums">
                  {page} / {pages}
                </span>
              </PaginationItem>
              <PaginationItem>
                <Button
                  variant="ghost"
                  disabled={page >= pages}
                  onClick={() => navigate({ search: { ...filters, page: page + 1 } })}
                >
                  Next
                  <ChevronRightIcon data-icon="inline-end" />
                </Button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </div>
    </>
  )
}
