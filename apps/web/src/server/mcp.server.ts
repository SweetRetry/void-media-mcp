import { ASPECT_RATIOS, controlsOf, models, type MediaModel } from "@workspace/model-providers"
import { McpServer } from "@modelcontextprotocol/server"
import env from "@env"
import { z } from "zod"

import { previewOf } from "./generation/preview.server"
import { storedOf } from "./generation/runs.server"
import { advanceTask, mediaModelOf, submitTask, taskOf } from "./generation/tasks.server"
import { costReport, listTasks, taskView, type TaskView } from "./generation/views.server"

/** Who is calling, from the verified access token: the user (`sub`) and the OAuth client (`azp`). */
export type Caller = { userId: string; clientId: string | null }

const FINAL = new Set(["succeeded", "partial", "failed"])
const POLL_MS = 4_000
const MAX_WAIT_S = 120

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Advances a task until it is final or `seconds` pass, so one tool call can return the result. */
async function waitFor(taskId: string, seconds: number) {
  const deadline = Date.now() + Math.min(seconds, MAX_WAIT_S) * 1000
  let task = await taskOf(taskId)
  while (task && !FINAL.has(task.state) && Date.now() + POLL_MS < deadline) {
    await sleep(POLL_MS)
    await advanceTask(taskId)
    task = await taskOf(taskId)
  }
  return task
}

/** A task as tool output: the JSON view, plus a link per output so the client can open it. */
function taskResult(view: TaskView) {
  const note = FINAL.has(view.state)
    ? undefined
    : `Still ${view.state}. Call get_task with task_id "${view.id}" (wait_seconds up to ${MAX_WAIT_S}) to collect it.`
  return {
    content: [
      { type: "text" as const, text: JSON.stringify(note ? { ...view, note } : view, null, 2) },
      ...view.outputs.map((output, index) => ({
        type: "resource_link" as const,
        uri: output.url,
        name: `${view.modality}-${index + 1}`,
        mimeType: output.mime,
      })),
    ],
    structuredContent: view,
  }
}

const refused = (message: string) => ({
  content: [{ type: "text" as const, text: message }],
  isError: true,
})

const params = z
  .object({
    aspectRatio: z.enum(ASPECT_RATIOS),
    resolution: z.string(),
    quality: z.string(),
    complexity: z.string(),
    count: z.number(),
    duration: z.number(),
    audio: z.boolean(),
    watermark: z.boolean(),
    sequential: z.boolean(),
  })
  .partial()
  .describe("Controls the model offers; list_models shows each model's options and defaults.")

const reference = z.object({
  url: z.url().describe("A public URL the provider can fetch."),
  role: z.enum(["reference", "first-frame", "last-frame", "mask"]).default("reference"),
  mime: z.string().describe("e.g. image/png, image/jpeg, video/mp4"),
})

/** Where a model's guide is read as an MCP resource. */
const guideUri = (model: MediaModel) => `void-media://guides/${model.id}`

const isoDate = z.iso.datetime({ offset: true }).or(z.iso.date())

/** A fresh MCP server for one request, with the caller bound into every tool. */
export function mcpServer(caller: Caller) {
  const origin = env.BETTER_AUTH_URL
  const server = new McpServer({ name: "void-media", version: "0.1.0" })

  server.registerTool(
    "list_models",
    {
      title: "List models",
      description: [
        "Image, video and audio generation models: id, capabilities, controls with their options and defaults,",
        "and list price. A model with a guide takes its syntax in the prompt: call get_model_guide before",
        "writing for it, and follow the guide over what you remember about the model.",
      ].join(" "),
      inputSchema: z.object({ modality: z.enum(["image", "video", "audio"]).optional() }),
      annotations: { readOnlyHint: true },
    },
    async ({ modality }) => {
      const list = models
        .filter((model) => !modality || model.modality === modality)
        .map((model) => ({
          id: model.id,
          name: model.name,
          provider: model.provider,
          modality: model.modality,
          capabilities: model.capabilities,
          controls: controlsOf(model.params).map(({ label: _, widget: __, ...control }) => control),
          maxReferences: model.maxReferences,
          outputsPerRun: model.outputsPerRun,
          guide: model.guide && guideUri(model),
          price:
            model.price && "tokensOf" in model.price
              ? { currency: "USD", perMillionOutputTokens: model.price.perMillion }
              : model.price,
        }))
      return { content: [{ type: "text", text: JSON.stringify(list, null, 2) }] }
    }
  )

  server.registerTool(
    "get_model_guide",
    {
      title: "Get model guide",
      description: [
        "The prompt-writing guide of a model that list_models marks with a guide: its current version,",
        "prompt syntax and parameters. Read it before the first generate call for that model.",
      ].join(" "),
      inputSchema: z.object({ model: z.string().describe("A model id or name from list_models.") }),
      annotations: { readOnlyHint: true },
    },
    async (input) => {
      const model = mediaModelOf(input.model)
      if (!model) return refused(`Unknown model "${input.model}". Call list_models.`)
      if (!model.guide)
        return refused(`${model.name} has no guide. Its controls are in list_models.`)
      return { content: [{ type: "text", text: model.guide }] }
    }
  )

  // The same guides as resources, for clients that let a person attach one.
  for (const model of models) {
    const { guide } = model
    if (!guide) continue
    server.registerResource(
      `${model.id}-guide`,
      guideUri(model),
      { title: `${model.name} prompt guide`, mimeType: "text/markdown" },
      async (uri) => ({ contents: [{ uri: uri.href, mimeType: "text/markdown", text: guide }] })
    )
  }

  server.registerTool(
    "generate",
    {
      title: "Generate media",
      description: [
        "Generate images, video or audio with one model. Images usually finish within the call;",
        "video returns a task to collect with get_task. Each run is billed by the provider, so",
        "prefer runs=1 unless asked for variations. Pass client_key to make a retry idempotent.",
        "Returns the task with its quote and, once done, public output URLs.",
      ].join(" "),
      inputSchema: z.object({
        model: z.string().describe("A model id or name from list_models."),
        prompt: z.string().min(1),
        params: params.optional(),
        references: z.array(reference).max(16).optional(),
        runs: z.number().int().min(1).max(4).default(1),
        client_key: z.string().max(200).optional(),
        wait_seconds: z
          .number()
          .min(0)
          .max(MAX_WAIT_S)
          .optional()
          .describe(
            "How long to wait for the result. Default 60 for image and audio, 0 for video."
          ),
      }),
    },
    async (input) => {
      const submitted = await submitTask(caller, {
        model: input.model,
        prompt: input.prompt,
        params: input.params as never,
        references: input.references,
        runs: input.runs,
        clientKey: input.client_key,
      })
      if ("refused" in submitted) return refused(submitted.refused)
      const wait = input.wait_seconds ?? (submitted.ok.modality === "video" ? 0 : 60)
      const task = (await waitFor(submitted.ok.id, wait)) ?? submitted.ok
      return taskResult(taskView(task, origin))
    }
  )

  server.registerTool(
    "get_task",
    {
      title: "Get task",
      description:
        "A generation task's state, outputs and cost. Polls the provider; wait_seconds blocks until it finishes or the time passes.",
      inputSchema: z.object({
        task_id: z.string(),
        wait_seconds: z.number().min(0).max(MAX_WAIT_S).default(0),
      }),
    },
    async ({ task_id, wait_seconds }) => {
      const found = await taskOf(task_id)
      if (!found || found.userId !== caller.userId) return refused("No such task.")
      await advanceTask(task_id)
      const task = (await waitFor(task_id, wait_seconds)) ?? found
      return taskResult(taskView(task, origin))
    }
  )

  server.registerTool(
    "view_output",
    {
      title: "View output",
      description: [
        "Look at a task's generated images, scaled to fit 1024px, to judge them before refining",
        "the prompt. index (1-based, as in the output names) picks one image; without it, all of",
        "them. Video and audio can't be viewed; open their URLs instead.",
      ].join(" "),
      inputSchema: z.object({
        task_id: z.string(),
        index: z.number().int().min(1).optional(),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ task_id, index }) => {
      const task = await taskOf(task_id)
      if (!task || task.userId !== caller.userId) return refused("No such task.")
      const files = storedOf(task.providerRef)
      const urls = taskView(task, origin).outputs.map((output) => output.url)
      const picked = files
        .map((file, i) => ({ ...file, n: i + 1, url: urls[i] }))
        .filter((file) => index === undefined || file.n === index)
      if (picked.length === 0)
        return refused(
          files.length === 0
            ? `The task has no outputs yet (${task.state}).`
            : `The task has ${files.length} outputs; index ${index} is out of range.`
        )
      const images = picked.filter((file) => file.mime.startsWith("image/"))
      if (images.length === 0)
        return refused(`These outputs are ${picked[0]?.mime}, not images. Open their URLs instead.`)
      try {
        const previews = await Promise.all(images.map((file) => previewOf(file.id)))
        return {
          content: images.flatMap((file, i) => {
            const preview = previews[i]
            const label = `${task.modality}-${file.n}: ${file.url} (${file.width ?? "?"}x${file.height ?? "?"})`
            return preview
              ? [
                  { type: "text" as const, text: label },
                  { type: "image" as const, data: preview.data, mimeType: preview.mimeType },
                ]
              : [{ type: "text" as const, text: `${label} is missing from storage.` }]
          }),
        }
      } catch (error) {
        return refused(`Could not render a preview: ${(error as Error).message}`)
      }
    }
  )

  server.registerTool(
    "list_tasks",
    {
      title: "Search tasks",
      description:
        "Search the generation log, newest first: by words in the prompt (or a task id), model, state and date. Each task has its outputs' URLs, state and cost.",
      inputSchema: z.object({
        query: z.string().optional().describe("Words the prompt contains, or a task id."),
        model: z.string().optional().describe("A model id from list_models."),
        limit: z.number().int().min(1).max(200).default(20),
        state: z
          .enum(["queued", "running", "confirming", "succeeded", "partial", "failed"])
          .optional(),
        since: isoDate.optional(),
        until: isoDate.optional(),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ query, model, limit, state, since, until }) => {
      const rows = await listTasks(caller.userId, {
        query,
        model,
        limit,
        state,
        until: until ? new Date(until) : undefined,
        since: since ? new Date(since) : undefined,
      })
      const views = rows.map((row) => taskView(row, origin))
      return { content: [{ type: "text", text: JSON.stringify(views, null, 2) }] }
    }
  )

  server.registerTool(
    "cost_report",
    {
      title: "Cost report",
      description:
        "Cost audit in USD at list price over a date range: totals, per model and per day, with quoted vs delivered cost and runs the provider may have billed without delivering.",
      inputSchema: z.object({ since: isoDate.optional(), until: isoDate.optional() }),
      annotations: { readOnlyHint: true },
    },
    async ({ since, until }) => {
      const report = await costReport(caller.userId, {
        since: since ? new Date(since) : undefined,
        until: until ? new Date(until) : undefined,
      })
      return { content: [{ type: "text", text: JSON.stringify(report, null, 2) }] }
    }
  )

  return server
}
