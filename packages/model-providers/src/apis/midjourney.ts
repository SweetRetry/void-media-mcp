import { z } from "zod"

import type { Outcome } from "../lib/result"
import { type Adapter, json, unreadable } from "./api"

/** Code 1 is accepted. 21 and 22 mean the task exists or is queued, and still carry its id. */
const submitted = z.object({
  code: z.number(),
  description: z.string().optional(),
  result: z.unknown().optional(),
})

const task = z.object({
  id: z.string(),
  status: z.string(),
  progress: z.string().optional(),
  imageUrl: z.string().nullish(),
  imageUrls: z.array(z.object({ url: z.string() })).nullish(),
  failReason: z.string().nullish(),
})

/** `"45%"` into 45, when the proxy reports one. */
const percent = (progress?: string) => {
  const value = Number.parseFloat(progress ?? "")
  return Number.isFinite(value) ? value : undefined
}

/**
 * Midjourney behind midjourney-proxy. No product controls: flags such as `--ar` go in the prompt, and image
 * prompts lead as URLs. A finished task is a 2x2 grid, or four images where the proxy splits them.
 */
export const midjourney: Adapter = {
  submit(_model, { prompt, references }) {
    const urls = references.map((reference) => reference.url)
    return {
      method: "POST",
      path: "/mj/submit/imagine",
      body: json({ prompt: [...urls, prompt].join(" ") }),
    }
  },
  read(body) {
    const parsed = submitted.safeParse(body)
    if (!parsed.success) return unreadable("Midjourney submit", parsed.error)
    const { code, description, result } = parsed.data
    if ([1, 21, 22].includes(code) && typeof result === "string") {
      return { state: "pending", taskId: result }
    }
    return { state: "failed", reason: description ?? `Submit refused with code ${code}` }
  },
  poll: {
    call: (taskId) => ({ method: "GET", path: `/mj/task/${taskId}/fetch` }),
    read(body): Outcome {
      const parsed = task.safeParse(body)
      if (!parsed.success) return unreadable("Midjourney task", parsed.error)
      const { id, status, progress, imageUrl, imageUrls, failReason } = parsed.data
      if (status === "FAILURE") return { state: "failed", reason: failReason ?? "Task failed" }
      if (status !== "SUCCESS") return { state: "pending", taskId: id, progress: percent(progress) }
      const urls = imageUrls?.length
        ? imageUrls.map((image) => image.url)
        : imageUrl
          ? [imageUrl]
          : []
      if (!urls.length) return { state: "failed", reason: "Finished without an image" }
      return {
        state: "done",
        result: { type: "image", results: urls.map((url) => ({ asset: { kind: "url", url } })) },
      }
    },
  },
}
