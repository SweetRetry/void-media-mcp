import { describe, expect, it } from "vite-plus/test"

import { apiOf, type GenerationInput, type MediaModel, models, resolveInput } from "../src/index.ts"

const model = (name: string) => {
  const found = models.find((entry) => entry.name === name)
  if (!found) throw new Error(`No media model ${name}`)
  return found
}

/** What a server does before it sends anything: check the input, then let the adapter write the call. */
const callFor = (target: MediaModel, input: GenerationInput) => {
  const checked = resolveInput(target, input)
  if (!checked.ok) throw new Error(JSON.stringify(checked.issues))
  return apiOf(target).submit(target, checked.value)
}

const issuesOf = (target: MediaModel, input: GenerationInput) => {
  const checked = resolveInput(target, input)
  return checked.ok ? [] : checked.issues
}

describe("input", () => {
  it("fills every control the caller leaves out with the model's default", () => {
    expect(resolveInput(model("Seedream 5.0 Pro"), { prompt: "  a cat  " })).toEqual({
      ok: true,
      value: {
        prompt: "a cat",
        references: [],
        params: { aspectRatio: "16:9", resolution: "1.5K" },
      },
    })
  })

  it("refuses a control the model does not have and a value it does not offer", () => {
    expect(
      issuesOf(model("GPT Image 2"), {
        prompt: "a cat",
        params: { duration: 5, quality: "max" },
      })
    ).toEqual([
      { path: "params.duration", message: "GPT Image 2 has no duration control" },
      { path: "params.quality", message: "must be one of low, medium, high" },
    ])
    expect(issuesOf(model("Seedance 2.0"), { prompt: "a cat", params: { duration: 20 } })).toEqual([
      { path: "params.duration", message: "must be between 4 and 15" },
    ])
  })

  it("refuses references the model cannot use", () => {
    const mask = { role: "mask", url: "https://r/m.png", mime: "image/png" } as const
    expect(issuesOf(model("Seedream 5.0 Pro"), { prompt: "a cat", references: [mask] })).toEqual([
      { path: "references.0", message: "Seedream 5.0 Pro does not support mask-edit" },
    ])
    const last = { role: "last-frame", url: "https://r/l.png", mime: "image/png" } as const
    expect(issuesOf(model("Seedance 2.0"), { prompt: "a cat", references: [last] })).toEqual([
      { path: "references", message: "a last frame needs a first frame" },
    ])
    const clip = { role: "reference", url: "https://r/c.mp4", mime: "video/mp4" } as const
    const first = { role: "first-frame", url: "https://r/f.png", mime: "image/png" } as const
    expect(issuesOf(model("MiniMax-H3"), { prompt: "a cat", references: [first, clip] })).toEqual([
      { path: "references", message: "MiniMax-H3 takes frames or references, not both" },
    ])
    expect(issuesOf(model("Seedance 2.0"), { prompt: "a cat", references: [first, clip] })).toEqual(
      []
    )
    expect(issuesOf(model("Midjourney"), { prompt: "a cat", references: [clip] })).toEqual([
      { path: "references.0", message: "Midjourney takes only image references" },
    ])
    const guides = ["a", "b"].map((name) => ({
      role: "reference" as const,
      url: `https://r/${name}.png`,
      mime: "image/png",
    }))
    expect(issuesOf(model("Seedream 5.0 Pro"), { prompt: "a cat", references: guides })).toEqual([])
  })
})

describe("one product input, each provider's spelling", () => {
  const wide = { prompt: "a cat", params: { aspectRatio: "16:9" } } as const

  it("sends Seedream a resolution's pixels at the ratio", () => {
    expect(
      callFor(model("Seedream 5.0 Pro"), {
        prompt: "a cat",
        params: { aspectRatio: "16:9", resolution: "2K" },
      })
    ).toEqual({
      method: "POST",
      path: "/images/generations",
      body: {
        kind: "json",
        value: {
          model: "doubao-seedream-5-0-pro-260628",
          prompt: "a cat",
          size: "2736x1536",
          watermark: false,
          response_format: "url",
        },
      },
    })
  })

  it("sends Seedance the ratio it defaults to, 16:9", () => {
    const frame = { role: "first-frame", url: "https://r/f.png", mime: "image/png" } as const
    expect(callFor(model("Seedance 2.0 Fast"), { prompt: "a cat", references: [frame] })).toEqual({
      method: "POST",
      path: "/contents/generations/tasks",
      body: {
        kind: "json",
        value: {
          model: "doubao-seedance-2-0-fast-260128",
          content: [
            { type: "text", text: "a cat" },
            { type: "image_url", image_url: { url: "https://r/f.png" }, role: "first_frame" },
          ],
          ratio: "16:9",
          resolution: "720p",
          duration: 5,
          seed: -1,
          generate_audio: true,
          watermark: false,
        },
      },
    })
  })

  it("sends Gemini `imageConfig.aspectRatio` with the model in the path", () => {
    expect(callFor(model("Nano Banana 2.1"), wide)).toEqual({
      method: "POST",
      path: "/v1beta/models/gemini-nano-banana-2.1:generateContent",
      body: {
        kind: "json",
        value: {
          contents: [{ role: "user", parts: [{ text: "a cat" }] }],
          generationConfig: {
            responseModalities: ["IMAGE"],
            imageConfig: { aspectRatio: "16:9", imageSize: "1K" },
          },
        },
      },
    })
  })

  it("passes Midjourney the user's own flags and refuses product controls", () => {
    const guide = { role: "reference", url: "https://r/g.png", mime: "image/png" } as const
    const prompt = "a cat --ar 16:9 --v 7"
    expect(callFor(model("Midjourney"), { prompt, references: [guide] })).toEqual({
      method: "POST",
      path: "/mj/submit/imagine",
      body: { kind: "json", value: { prompt: "https://r/g.png a cat --ar 16:9 --v 7" } },
    })
    expect(issuesOf(model("Midjourney"), wide)).toEqual([
      { path: "params.aspectRatio", message: "Midjourney has no aspectRatio control" },
    ])
  })

  it("sends GPT Image any ratio as a size with a 1024 short side", () => {
    const sizes = (["16:9", "9:16", "4:3", "21:9", "1:1"] as const).map(
      (aspectRatio) =>
        (
          callFor(model("GPT Image 2"), { prompt: "a cat", params: { aspectRatio } }).body as {
            value: { size: string }
          }
        ).value.size
    )
    expect(sizes).toEqual(["1824x1024", "1024x1824", "1360x1024", "2384x1024", "1024x1024"])
  })

  it("sends GPT Image 2.6 the complexity the user picks, and refuses it on 2.5", () => {
    expect(
      callFor(model("GPT Image 2.6 Flare"), {
        prompt: "a cat",
        params: { complexity: "low" },
      }).body
    ).toEqual({
      kind: "json",
      value: {
        model: "gpt-image-2.6-flare",
        prompt: "a cat",
        size: "1824x1024",
        quality: "medium",
        complexity: "low",
        output_format: "png",
        n: 1,
      },
    })
    expect(
      issuesOf(model("GPT Image 2.5 Flare"), { prompt: "a cat", params: { complexity: "low" } })
    ).toEqual([
      { path: "params.complexity", message: "GPT Image 2.5 Flare has no complexity control" },
    ])
  })

  it("sends GPT Image a documented size, and an upload once it has references", () => {
    const square = { prompt: "a cat", params: { aspectRatio: "3:2" } } as const
    expect(callFor(model("GPT Image 2"), square).body).toEqual({
      kind: "json",
      value: {
        model: "gpt-image-2",
        prompt: "a cat",
        size: "1536x1024",
        quality: "medium",
        output_format: "png",
        n: 1,
      },
    })
    const references = [
      { role: "reference", url: "https://r/a.png", mime: "image/png" },
      { role: "mask", url: "https://r/m.png", mime: "image/png" },
    ] as const
    expect(callFor(model("GPT Image 2"), { ...square, references })).toEqual({
      method: "POST",
      path: "/v1/images/edits",
      body: {
        kind: "multipart",
        fields: {
          model: "gpt-image-2",
          prompt: "a cat",
          size: "1536x1024",
          quality: "medium",
          output_format: "png",
          n: "1",
        },
        files: [
          { field: "image[]", url: "https://r/a.png" },
          { field: "mask", url: "https://r/m.png" },
        ],
      },
    })
  })
})

describe("every provider's answer, one result shape", () => {
  it("reads Seedream's links and sizes", () => {
    const answer = { data: [{ url: "https://ark/a.png", size: "2048x2048" }] }
    expect(apiOf(model("Seedream 5.0 Pro")).read(answer)).toEqual({
      state: "done",
      result: {
        type: "image",
        results: [{ asset: { kind: "url", url: "https://ark/a.png" }, width: 2048, height: 2048 }],
      },
    })
  })

  it("reads GPT Image's inline bytes and names their format", () => {
    expect(apiOf(model("GPT Image 2")).read({ data: [{ b64_json: "/9j/4AAQ" }] })).toEqual({
      state: "done",
      result: {
        type: "image",
        results: [{ asset: { kind: "inline", mime: "image/jpeg", base64: "/9j/4AAQ" } }],
      },
    })
  })

  it("reads Gemini's inline parts and a blocked prompt", () => {
    const api = apiOf(model("Nano Banana 2.1"))
    const part = { inlineData: { mimeType: "image/png", data: "iVBOR" } }
    expect(api.read({ candidates: [{ content: { parts: [{}, part] } }] })).toEqual({
      state: "done",
      result: {
        type: "image",
        results: [{ asset: { kind: "inline", mime: "image/png", base64: "iVBOR" } }],
      },
    })
    expect(api.read({ promptFeedback: { blockReason: "SAFETY" } })).toEqual({
      state: "failed",
      reason: "SAFETY",
    })
  })

  it("follows a Seedance task from submit to video, with the tokens it billed", () => {
    const api = apiOf(model("Seedance 2.0"))
    expect(api.read({ id: "cgt-1" })).toEqual({ state: "pending", taskId: "cgt-1" })
    expect(api.poll?.call("cgt-1")).toEqual({
      method: "GET",
      path: "/contents/generations/tasks/cgt-1",
    })
    expect(api.poll?.read({ id: "cgt-1", status: "running" })).toEqual({
      state: "pending",
      taskId: "cgt-1",
    })
    const done = {
      id: "cgt-1",
      status: "succeeded",
      content: { video_url: "https://ark/v.mp4" },
      usage: { completion_tokens: 108900 },
    }
    expect(api.poll?.read(done)).toEqual({
      state: "done",
      result: {
        type: "video",
        results: [{ asset: { kind: "url", url: "https://ark/v.mp4" } }],
        usage: { tokens: 108900 },
      },
    })
    const failed = { id: "cgt-1", status: "failed", error: { message: "Sensitive content" } }
    expect(api.poll?.read(failed)).toEqual({ state: "failed", reason: "Sensitive content" })
  })

  it("follows a Midjourney task, its progress and its split images", () => {
    const api = apiOf(model("Midjourney"))
    expect(api.read({ code: 1, result: "17" })).toEqual({ state: "pending", taskId: "17" })
    expect(api.read({ code: 24, description: "Banned prompt" })).toEqual({
      state: "failed",
      reason: "Banned prompt",
    })
    expect(api.poll?.read({ id: "17", status: "IN_PROGRESS", progress: "45%" })).toEqual({
      state: "pending",
      taskId: "17",
      progress: 45,
    })
    const done = { id: "17", status: "SUCCESS", imageUrls: [{ url: "https://mj/1.png" }] }
    expect(api.poll?.read(done)).toEqual({
      state: "done",
      result: { type: "image", results: [{ asset: { kind: "url", url: "https://mj/1.png" } }] },
    })
  })

  it("turns an answer it cannot parse into a failure instead of throwing", () => {
    const outcome = apiOf(model("Seedream 5.0 Flash")).read({ error: "rate limited" })
    expect(outcome.state).toBe("failed")
  })
})

describe("Suno through Tu-zi", () => {
  const suno = model("Suno v6")
  const input = { prompt: "[Verse] hello", references: [], params: {} }

  it("submits the prompt and the model id as mv", () => {
    expect(apiOf(suno).submit(suno, input)).toEqual({
      method: "POST",
      path: "/suno/submit/music",
      body: { kind: "json", value: { prompt: "[Verse] hello", mv: "chirp-hawk" } },
    })
  })

  it("takes the task id the submit answers with", () => {
    const adapter = apiOf(suno)
    expect(adapter.read({ code: "success", message: "", data: "task_abc" })).toEqual({
      state: "pending",
      taskId: "task_abc",
    })
    expect(adapter.poll?.call("task_abc")).toEqual({
      method: "GET",
      path: "/v1/suno/feed?ids=task_abc",
    })
  })

  it("refuses a submit the envelope marks as failed, with its message", () => {
    expect(apiOf(suno).read({ code: "fail", message: "quota exhausted" })).toEqual({
      state: "failed",
      reason: "quota exhausted",
    })
  })

  it("delivers every song's audio once the task is SUCCESS", () => {
    const poll = apiOf(suno).poll!
    expect(
      poll.read({
        code: "success",
        data: [
          {
            task_id: "task_abc",
            status: "SUCCESS",
            fail_reason: "",
            data: [
              { status: "complete", audio_url: "https://cdn/a.mp3" },
              { status: "complete", audio_url: "https://cdn/b.mp3" },
            ],
          },
        ],
      })
    ).toEqual({
      state: "done",
      result: {
        type: "audio",
        results: [
          { asset: { kind: "url", url: "https://cdn/a.mp3" } },
          { asset: { kind: "url", url: "https://cdn/b.mp3" } },
        ],
      },
    })
  })

  it("fails the task with its fail reason", () => {
    expect(
      apiOf(suno).poll?.read({
        code: "success",
        data: [
          { task_id: "task_abc", status: "FAILURE", fail_reason: "Content blocked", data: [] },
        ],
      })
    ).toEqual({ state: "failed", reason: "Content blocked" })
  })

  it("fails a finished task whose songs carry no audio", () => {
    expect(
      apiOf(suno).poll?.read({
        code: "success",
        data: [{ task_id: "task_abc", status: "SUCCESS", fail_reason: "", data: [{}] }],
      })
    ).toEqual({ state: "failed", reason: "Finished without audio" })
  })
})
