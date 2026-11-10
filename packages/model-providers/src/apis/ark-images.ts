import { z } from "zod"

import type { AspectRatio, Resolution } from "../lib/params"
import { type Adapter, json, unreadable } from "./api"

const response = z.object({
  data: z.array(
    z.union([
      z.object({ url: z.string(), size: z.string().optional() }),
      z.object({ error: z.object({ message: z.string() }) }),
    ])
  ),
  usage: z.object({ generated_images: z.number() }).optional(),
})

const SIDE: Partial<Record<Resolution, number>> = {
  "1K": 1024,
  "1.5K": 1536,
  "2K": 2048,
  "3K": 3072,
  "4K": 4096,
}

/** Width and height for a resolution at a ratio: the square's area reshaped, each side rounded to 16. Null for video. */
function pixelsOf(
  ratio: AspectRatio,
  resolution: Resolution
): { width: number; height: number } | null {
  const side = SIDE[resolution]
  if (!side) return null
  const [w, h] = ratio.split(":").map(Number) as [number, number]
  const round = (n: number) => Math.round(n / 16) * 16
  const width = side * Math.sqrt(w / h)
  return { width: round(width), height: round((side * side) / width) }
}

/** `"2048x2048"` into numbers, when Ark reports the delivered size. */
const sizeOf = (size?: string) => {
  const [width, height] = (size ?? "").split("x").map(Number)
  return width && height ? { width, height } : {}
}

/** Seedream answers in the same call. A resolution (`2K`) leaves the ratio to the prompt, so a chosen ratio is sent as `WxH` pixels. */
export const arkImages: Adapter = {
  submit(model, { prompt, references, params }) {
    const resolution = params.resolution ?? "2K"
    const pixels = pixelsOf(params.aspectRatio ?? "16:9", resolution)
    const images = references.map((reference) => reference.url)
    return {
      method: "POST",
      path: "/images/generations",
      body: json({
        model: model.id,
        prompt,
        size: pixels ? `${pixels.width}x${pixels.height}` : resolution,
        ...(images.length === 1 && { image: images[0] }),
        ...(images.length > 1 && { image: images }),
        ...(params.sequential !== undefined && {
          sequential_image_generation: params.sequential ? "auto" : "disabled",
        }),
        watermark: params.watermark ?? false,
        response_format: "url",
      }),
    }
  },
  read(body) {
    const parsed = response.safeParse(body)
    if (!parsed.success) return unreadable("Ark image", parsed.error)
    const results = parsed.data.data.flatMap((item) =>
      "url" in item
        ? [{ asset: { kind: "url" as const, url: item.url }, ...sizeOf(item.size) }]
        : []
    )
    if (!results.length) {
      const failed = parsed.data.data.find((item) => "error" in item)
      return {
        state: "failed",
        reason: failed && "error" in failed ? failed.error.message : "No image",
      }
    }
    return { state: "done", result: { type: "image", results } }
  },
}
