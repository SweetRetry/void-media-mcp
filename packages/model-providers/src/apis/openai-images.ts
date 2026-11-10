import { z } from "zod"

import type { AspectRatio } from "../lib/params"
import { dimensionsOf } from "../lib/gpt-image"
import type { Output } from "../lib/result"
import { type Adapter, json, unreadable } from "./api"

const response = z.object({
  data: z.array(z.object({ b64_json: z.string().optional(), url: z.string().optional() })),
})

/** The `WxH` a request sends for a ratio. */
function sizeOf(ratio: AspectRatio): string {
  const { width, height } = dimensionsOf(ratio)
  return `${width}x${height}`
}

/** The format the bytes are in, read from their signature, since the response does not name it. */
const mimeOf = (base64: string) =>
  base64.startsWith("/9j/") ? "image/jpeg" : base64.startsWith("UklGR") ? "image/webp" : "image/png"

/** GPT Image on an OpenAI-compatible endpoint. A prompt alone goes as JSON to `generations`. Any reference makes an `edits` upload. */
export const openaiImages: Adapter = {
  submit(model, { prompt, references, params }) {
    const options = {
      model: model.id,
      prompt,
      ...(params.aspectRatio && { size: sizeOf(params.aspectRatio) }),
      ...(params.quality && { quality: params.quality }),
      ...(params.complexity && { complexity: params.complexity }),
      // No format control in the product, so PNG is fixed.
      output_format: "png",
      ...(params.count !== undefined && { n: params.count }),
    }
    if (!references.length) {
      return { method: "POST", path: "/v1/images/generations", body: json(options) }
    }
    return {
      method: "POST",
      path: "/v1/images/edits",
      body: {
        kind: "multipart",
        fields: Object.fromEntries(
          Object.entries(options).map(([key, value]) => [key, String(value)])
        ),
        files: references.map((reference) => ({
          field: reference.role === "mask" ? "mask" : "image[]",
          url: reference.url,
        })),
      },
    }
  },
  read(body) {
    const parsed = response.safeParse(body)
    if (!parsed.success) return unreadable("OpenAI image", parsed.error)
    const results = parsed.data.data.flatMap(({ b64_json, url }): Output[] => {
      if (b64_json) return [{ asset: { kind: "inline", mime: mimeOf(b64_json), base64: b64_json } }]
      return url ? [{ asset: { kind: "url", url } }] : []
    })
    return results.length
      ? { state: "done", result: { type: "image", results } }
      : { state: "failed", reason: "No image" }
  },
}
