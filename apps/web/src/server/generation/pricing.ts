import {
  type MediaModel,
  type Params,
  type Price,
  priceOf,
  type Resolution,
  usdOf,
} from "@workspace/model-providers"

/*
 * What a run costs at the catalog's list prices, in US dollars. These are estimates from published
 * prices, not the provider's invoice: only token-priced models report what they billed.
 */

/**
 * Seedance bills tokens of width × height × frames over 1024. A clip has 24 frames a second plus
 * one: a 5 s clip at 480p was billed 121 frames (50,638 tokens) on 2026-11-01.
 */
const VIDEO_FPS = 24
/** The most pixels a frame has at each video resolution, over every ratio Ark offers there. */
const VIDEO_PIXELS: Partial<Record<Resolution, number>> = {
  "480p": 864 * 496,
  "720p": 1112 * 834,
}

function videoTokens(params: Partial<Params>) {
  const pixels = params.resolution ? VIDEO_PIXELS[params.resolution] : undefined
  if (!pixels || !params.duration) return null
  return Math.ceil((pixels * (VIDEO_FPS * params.duration + 1)) / 1024)
}

/** One run's list price at these (resolved) params. Null when the catalog cannot tell. */
function runUsd(model: MediaModel, params: Partial<Params>): number | null {
  const price = priceOf(model, params)
  if (!price) return null
  if (price.per === "output") return usdOf(price)
  if (price.per === "second")
    return params.duration === undefined ? null : usdOf(price, params.duration)
  if (price.per === "million-tokens" && model.modality === "video") {
    const tokens = videoTokens(params)
    return tokens === null ? null : usdOf(price, tokens / 1_000_000)
  }
  return null
}

/** The most runs one task takes. A model whose run already delivers several outputs takes one. */
export const maxRunsOf = (model: MediaModel) => ((model.outputsPerRun ?? 1) > 1 ? 1 : 4)

export type Quote = { usd: number | null; price: Price | null }

/** Every run costs the same, so a quote is the run price times the runs. */
export function quoteOf(model: MediaModel, params: Partial<Params>, runs: number): Quote {
  const run = runUsd(model, params)
  return { usd: run === null ? null : run * runs, price: priceOf(model, params) }
}

/**
 * What the delivered runs cost: the run price for each, or, for a token-priced model that reports
 * usage, the tokens it billed. Undelivered runs cost nothing here; lost runs are counted apart.
 */
export function costOf(
  model: MediaModel,
  params: Partial<Params>,
  delivered: { runs: number; tokens?: number }
): number | null {
  if (delivered.runs === 0) return 0
  const price = priceOf(model, params)
  if (price?.per === "million-tokens" && delivered.tokens !== undefined)
    return usdOf(price, delivered.tokens / 1_000_000)
  const run = runUsd(model, params)
  return run === null ? null : run * delivered.runs
}
