import { z } from "zod"

import type { Outcome } from "../lib/result"
import { type Adapter, json, unreadable } from "./api"

/** Tu-zi's envelope: `code`, `message`, `data`. On submit, `data` is the task id. */
const submitted = z.object({
  code: z.string(),
  message: z.string().optional(),
  data: z.string().nullish(),
})

const clip = z.object({ audio_url: z.string().nullish() })

const task = z.object({
  task_id: z.string(),
  status: z.string(),
  fail_reason: z.string().nullish(),
  data: z.array(clip).nullish(),
})

const feed = z.object({ code: z.string(), data: z.array(task) })

/**
 * Suno through Tu-zi's format. `mv` carries the model id, and a prompt alone is enough. The feed is polled
 * until `SUCCESS` with audio on every song. A `fail_reason` or a `FAILURE` status fails the task.
 */
export const sunoMusic: Adapter = {
  submit(model, { prompt }) {
    return {
      method: "POST",
      path: "/suno/submit/music",
      body: json({ prompt, mv: model.id }),
    }
  },
  read(body) {
    const parsed = submitted.safeParse(body)
    if (!parsed.success) return unreadable("Suno submit", parsed.error)
    const { code, message, data } = parsed.data
    if (code === "success" && data) return { state: "pending", taskId: data }
    return { state: "failed", reason: message || `Submit refused with code ${code}` }
  },
  poll: {
    call: (taskId) => ({ method: "GET", path: `/v1/suno/feed?ids=${encodeURIComponent(taskId)}` }),
    read(body): Outcome {
      const parsed = feed.safeParse(body)
      if (!parsed.success) return unreadable("Suno feed", parsed.error)
      const job = parsed.data.data[0]
      if (!job) return { state: "failed", reason: "Task not found" }
      if (job.fail_reason || job.status === "FAILURE") {
        return { state: "failed", reason: job.fail_reason || "Task failed" }
      }
      if (job.status !== "SUCCESS") return { state: "pending", taskId: job.task_id }
      const clips = job.data ?? []
      const urls = clips.flatMap((song) => (song.audio_url ? [song.audio_url] : []))
      if (!clips.length || urls.length !== clips.length) {
        return { state: "failed", reason: "Finished without audio" }
      }
      return {
        state: "done",
        result: { type: "audio", results: urls.map((url) => ({ asset: { kind: "url", url } })) },
      }
    },
  },
}
