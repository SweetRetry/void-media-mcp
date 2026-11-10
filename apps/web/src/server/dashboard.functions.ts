import { createServerFn } from "@tanstack/react-start"
import env from "@env"
import { z } from "zod"

import { signedIn } from "./auth/session.functions"
import { advanceTask } from "./generation/tasks.server"
import { costReport, listTasks, taskView } from "./generation/views.server"

const OPEN = new Set(["queued", "running", "confirming"])

/** The admin page: the cost audit over the last `days`, and the usage log. */
export const dashboard = createServerFn()
  .middleware([signedIn])
  .validator(
    z.object({
      days: z.number().int().min(1).max(366),
      q: z.string().max(200).optional(),
      model: z.string().max(100).optional(),
    })
  )
  .handler(async ({ context, data }) => {
    const since = new Date(Date.now() - data.days * 86_400_000)
    const filter = { since, query: data.q, model: data.model, limit: 100 }
    let tasks = await listTasks(context.user.id, filter)
    // Open tasks are polled once on load, so the page shows fresh states without waiting for cron.
    const open = tasks.filter((task) => OPEN.has(task.state))
    if (open.length) {
      await Promise.allSettled(open.map((task) => advanceTask(task.id)))
      tasks = await listTasks(context.user.id, filter)
    }
    return {
      email: context.user.email,
      mcpUrl: `${env.BETTER_AUTH_URL}/mcp`,
      report: await costReport(context.user.id, { since }),
      tasks: tasks.map((task) => taskView(task, env.BETTER_AUTH_URL)),
    }
  })
