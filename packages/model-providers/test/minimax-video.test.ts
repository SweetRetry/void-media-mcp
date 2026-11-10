import { describe, expect, it } from "vite-plus/test"

import { apiOf, type GenerationInput, type MediaModel, models, resolveInput } from "../src/index.ts"

const model = (name: string) => {
  const found = models.find((entry) => entry.name === name)
  if (!found) throw new Error(`No media model ${name}`)
  return found
}

const callFor = (target: MediaModel, input: GenerationInput) => {
  const checked = resolveInput(target, input)
  if (!checked.ok) throw new Error(JSON.stringify(checked.issues))
  return apiOf(target).submit(target, checked.value)
}

describe("MiniMax-H3 through Tu-zi", () => {
  const h3 = model("MiniMax-H3")
  const first = { role: "first-frame", url: "https://r/f.png", mime: "image/png" } as const
  const last = { role: "last-frame", url: "https://r/l.png", mime: "image/png" } as const
  const guide = { role: "reference", url: "https://r/g.png", mime: "image/png" } as const
  const voice = { role: "reference", url: "https://r/v.mp3", mime: "audio/mpeg" } as const
  const clip = { role: "reference", url: "https://r/c.mp4", mime: "video/mp4" } as const

  it("sends a first and last frame under MiniMax's role names, at the resolution picked", () => {
    expect(
      callFor(h3, {
        prompt: "a cat",
        references: [first, last],
        params: { resolution: "2K", duration: 8 },
      })
    ).toEqual({
      method: "POST",
      path: "/v2/video_generation",
      body: {
        kind: "json",
        value: {
          model: "MiniMax-H3",
          content: [
            { type: "text", text: "a cat" },
            { type: "image_url", image_url: { url: "https://r/f.png" }, role: "first_frame" },
            { type: "image_url", image_url: { url: "https://r/l.png" }, role: "last_frame" },
          ],
          ratio: "16:9",
          resolution: "2K",
          duration: 8,
        },
      },
    })
  })

  it("sends image, video and audio references as reference-to-video", () => {
    const value = callFor(h3, { prompt: "a cat", references: [guide, clip, voice] }).body
    expect(value).toEqual({
      kind: "json",
      value: {
        model: "MiniMax-H3",
        content: [
          { type: "text", text: "a cat" },
          { type: "image_url", image_url: { url: "https://r/g.png" }, role: "reference_image" },
          { type: "video_url", video_url: { url: "https://r/c.mp4" }, role: "reference_video" },
          { type: "audio_url", audio_url: { url: "https://r/v.mp3" }, role: "reference_audio" },
        ],
        ratio: "16:9",
        resolution: "768P",
        duration: 5,
      },
    })
  })

  it("follows a task from submit to video, through the query route", () => {
    const api = apiOf(h3)
    expect(api.read({ task_id: "424010985738629" })).toEqual({
      state: "pending",
      taskId: "424010985738629",
    })
    expect(api.poll?.call("424010985738629")).toEqual({
      method: "GET",
      path: "/v2/query/video_generation/424010985738629",
    })
    expect(api.poll?.read({ task: { id: "424010985738629", status: "running" } })).toEqual({
      state: "pending",
      taskId: "424010985738629",
    })
    expect(
      api.poll?.read({ task: { id: "424010985738629", status: "queued", content: {} } })
    ).toEqual({ state: "pending", taskId: "424010985738629" })
    expect(
      api.poll?.read({
        task: {
          id: "424010985738629",
          status: "succeeded",
          content: { url: "https://cdn.example/h3.mp4" },
        },
      })
    ).toEqual({
      state: "done",
      result: {
        type: "video",
        results: [{ asset: { kind: "url", url: "https://cdn.example/h3.mp4" } }],
      },
    })
    expect(api.poll?.read({ task: { id: "424010985738629", status: "failed" } })).toEqual({
      state: "failed",
      reason: "Task failed",
    })
  })
})
