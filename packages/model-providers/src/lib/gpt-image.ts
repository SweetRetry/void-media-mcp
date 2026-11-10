import type { AspectRatio, Quality } from "./params"

/** Short side 1024, long side from the ratio rounded to 16. Matches OpenAI's documented sizes. */
export function dimensionsOf(ratio: AspectRatio): { width: number; height: number } {
  const [w, h] = ratio.split(":").map(Number) as [number, number]
  const long = Math.round((1024 * Math.max(w, h)) / Math.min(w, h) / 16) * 16
  return w >= h ? { width: long, height: 1024 } : { width: 1024, height: long }
}

/** The base token count per quality, from OpenAI's calculator for GPT Image 2.5 and 2.6. */
const BASE_TOKENS: Record<Quality, number> = {
  low: 16,
  medium: 24,
  high: 48,
  xhigh: 64,
  max: 96,
}

/** GPT Image 2.6 spends more tokens than 2.5 at low and medium. */
const GPT_IMAGE_26_FACTOR: Record<Quality, number> = {
  low: 4.2,
  medium: 3.3,
  high: 1,
  xhigh: 1,
  max: 1,
}

/**
 * Output tokens one image bills, per OpenAI's calculator (https://developers.openai.com/api/docs/guides/image-generation,
 * read 2026-11-05). It has no `complexity` term, so complexity does not change the price.
 */
export function outputTokens(
  model: "gpt-image-2.5" | "gpt-image-2.6",
  ratio: AspectRatio,
  step: Quality
): number {
  const { width, height } = dimensionsOf(ratio)
  const base = BASE_TOKENS[step]
  const scaled = base / (Math.max(width, height) / Math.min(width, height))
  const whole = Math.floor(scaled)
  // Halves round to the even neighbour, as the calculator does.
  const short = scaled - whole === 0.5 ? whole + (whole % 2) : Math.round(scaled)
  const tokens = Math.ceil((base * short * (2_000_000 + width * height)) / 4_000_000)
  return model === "gpt-image-2.6" ? Math.round(tokens * GPT_IMAGE_26_FACTOR[step]) : tokens
}
