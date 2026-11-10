import { z } from "zod"

import type { Outcome } from "../../lib/result"
import { type Adapter, json, unreadable } from "../api"
import { contentOf } from "./content"

const created = z.object({ task_id: z.string() })

const queried = z.object({
  task: z.object({
    id: z.string(),
    status: z.enum(["queued", "running", "succeeded", "failed", "cancelled"]),
    /** Empty while the task runs, so the url is read only on success. */
    content: z.object({ url: z.string().optional() }).nullish(),
  }),
})

/** MiniMax-H3 through Tu-zi's MiniMax-shaped route. The prompt and references share one `content` list, as on Ark. Resolutions are capitalized. */
export const minimaxVideo: Adapter = {
  submit(model, { prompt, references, params }) {
    return {
      method: "POST",
      path: "/v2/video_generation",
      body: json({
        model: model.id,
        content: [{ type: "text", text: prompt }, ...references.map(contentOf)],
        ...(params.aspectRatio && { ratio: params.aspectRatio }),
        ...(params.resolution && { resolution: params.resolution.toUpperCase() }),
        ...(params.duration !== undefined && { duration: params.duration }),
      }),
    }
  },
  read(body) {
    const parsed = created.safeParse(body)
    return parsed.success
      ? { state: "pending", taskId: parsed.data.task_id }
      : unreadable("MiniMax task", parsed.error)
  },
  poll: {
    call: (taskId) => ({ method: "GET", path: `/v2/query/video_generation/${taskId}` }),
    read(body): Outcome {
      const parsed = queried.safeParse(body)
      if (!parsed.success) return unreadable("MiniMax task", parsed.error)
      const { id, status, content } = parsed.data.task
      if (status === "queued" || status === "running") return { state: "pending", taskId: id }
      if (status === "succeeded") {
        if (!content?.url) return { state: "failed", reason: "Finished without a video" }
        return {
          state: "done",
          result: { type: "video", results: [{ asset: { kind: "url", url: content.url } }] },
        }
      }
      return { state: "failed", reason: `Task ${status}` }
    },
  },
}
