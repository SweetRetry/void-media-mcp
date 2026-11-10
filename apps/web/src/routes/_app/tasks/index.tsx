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
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  LayoutGridIcon,
  ListIcon,
  SearchIcon,
  SearchXIcon,
} from "lucide-react"
import { z } from "zod"

import { PageHeader } from "@/components/app/page-header"
import { type State, STATE_LABEL, STATES, TaskState } from "@/components/app/task-state"
import { Thumb } from "@/components/app/thumb"
import { ago, modelName, usd } from "@/lib/format"
import { tasksPage } from "@/server/admin.functions"

const ALL = "all"

const search = z.object({
  q: z.string().optional(),
  model: z.string().optional(),
  state: z.enum(STATES).optional(),
  page: z.number().int().min(1).optional(),
  view: z.enum(["list", "grid"]).optional(),
})

type Search = z.infer<typeof search>

export const Route = createFileRoute("/_app/tasks/")({
  validateSearch: search,
  loaderDeps: ({ search: { q, model, state, page } }) => ({ q, model, state, page: page ?? 1 }),
  loader: ({ deps }) => tasksPage({ data: deps }),
  head: () => ({ meta: [{ title: "Generations" }] }),
  component: Tasks,
})

type Task = Awaited<ReturnType<typeof tasksPage>>["tasks"][number]

function Tasks() {
  const { tasks, total, pageSize, models } = Route.useLoaderData()
  const filters = Route.useSearch()
  const navigate = Route.useNavigate()
  const page = filters.page ?? 1
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const view = filters.view ?? "list"
  const filter = (next: Search) =>
    navigate({ search: (prev) => ({ ...prev, ...next, page: undefined }) })
  const filtered = Boolean(filters.q || filters.model || filters.state)

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Generations" }]}
        actions={
          <ToggleGroup
            variant="outline"
            size="sm"
            value={[view]}
            onValueChange={(value: string[]) =>
              value[0] &&
              navigate({
                search: (prev) => ({ ...prev, view: value[0] === "grid" ? "grid" : undefined }),
              })
            }
          >
            <ToggleGroupItem value="list" aria-label="List">
              <ListIcon />
            </ToggleGroupItem>
            <ToggleGroupItem value="grid" aria-label="Grid">
              <LayoutGridIcon />
            </ToggleGroupItem>
          </ToggleGroup>
        }
      />
      <div className="flex flex-col gap-6 p-4 lg:p-6">
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
            <SelectTrigger aria-label="Model" className="w-48">
              <SelectValue>
                {(value: string) => (value === ALL ? "All models" : modelName(value))}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All models</SelectItem>
              {models.map((model) => (
                <SelectItem key={model} value={model}>
                  {modelName(model)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.state ?? ALL}
            onValueChange={(value) =>
              filter({ state: value === ALL ? undefined : (value as State) })
            }
          >
            <SelectTrigger aria-label="State" className="w-36">
              <SelectValue>
                {(value: string) => (value === ALL ? "Any state" : STATE_LABEL[value as State])}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Any state</SelectItem>
              {STATES.map((state) => (
                <SelectItem key={state} value={state}>
                  {STATE_LABEL[state]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filtered && (
            <Button
              variant="ghost"
              onClick={() => navigate({ search: (prev) => ({ view: prev.view }) })}
            >
              Clear
            </Button>
          )}
          {pages > 1 && (
            <span className="ml-auto text-sm text-muted-foreground tabular-nums">
              {total} generations
            </span>
          )}
        </div>

        {tasks.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <SearchXIcon />
              </EmptyMedia>
              <EmptyTitle>{filtered ? "No matching generations" : "No generations yet"}</EmptyTitle>
              <EmptyDescription>
                {filtered
                  ? "Try other words, or clear the filters."
                  : "Ask Claude Code to generate an image. It shows up here."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : view === "grid" ? (
          <TaskGrid tasks={tasks} />
        ) : (
          <TaskTable tasks={tasks} />
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
                  {page} of {pages}
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

function TaskTable({ tasks }: { tasks: Task[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-16">
            <span className="sr-only">Output</span>
          </TableHead>
          <TableHead>Prompt</TableHead>
          <TableHead>Model</TableHead>
          <TableHead>State</TableHead>
          <TableHead className="text-right">Cost</TableHead>
          <TableHead className="text-right">Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.map((task) => (
          <TableRow key={task.id}>
            <TableCell>
              <Thumb prompt={task.prompt} outputs={task.outputs} className="size-10" />
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
            <TableCell>
              <span className="text-muted-foreground">{modelName(task.model)}</span>
            </TableCell>
            <TableCell>
              <TaskState state={task.state} />
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {usd(task.costUsd ?? task.quoteUsd)}
            </TableCell>
            <TableCell className="text-right">
              <span className="text-muted-foreground tabular-nums">{ago(task.createdAt)}</span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

/** The same page as a wall of outputs; a task that is not done says so under its tile. */
function TaskGrid({ tasks }: { tasks: Task[] }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {tasks.map((task) => (
        <li key={task.id}>
          <Link
            to="/tasks/$taskId"
            params={{ taskId: task.id }}
            className="group flex flex-col gap-2"
          >
            <Thumb
              prompt={task.prompt}
              outputs={task.outputs}
              className="aspect-square w-full group-hover:opacity-90"
            />
            <p className="line-clamp-2 text-sm group-hover:underline">{task.prompt}</p>
            {task.state === "succeeded" ? (
              <span className="text-xs text-muted-foreground">{ago(task.createdAt)}</span>
            ) : (
              <TaskState state={task.state} />
            )}
          </Link>
        </li>
      ))}
    </ul>
  )
}
