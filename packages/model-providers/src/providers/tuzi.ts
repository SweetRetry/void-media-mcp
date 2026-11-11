import type { MediaModel } from "../lib/model"
import { ASPECT_RATIOS, type ParamSpec, type Quality } from "../lib/params"
import type { OutputTokenPrice, Price } from "../lib/price"
import { outputTokens } from "../lib/gpt-image"
import type { Provider } from "../lib/provider"
import midjourneyGuide from "../guides/midjourney.md?raw"

/** Tu-zi fronts OpenAI, Google and Midjourney models behind one key. */
export const tuzi: Provider = {
  id: "tuzi",
  name: "Tu-zi",
  baseUrl: "https://api.tu-zi.com",
  keyEnv: "TUZI_API_KEY",
  // Docs: https://tuzi-api.apifox.cn/
}

/** Any `WxH` whose sides divide by 16, so every ratio is offered. Quality sets the price, so it is the variant. */
function gptImageParams(quality: readonly Quality[]): ParamSpec {
  return {
    aspectRatio: { options: ASPECT_RATIOS, default: "16:9" },
    quality: { options: quality, default: "medium" },
    count: { min: 1, max: 10, step: 1, default: 1 },
  }
}

const usd = (amount: number): Price => ({ amount, currency: "USD", per: "output" })

/** Billed per output token at $30 per million. The token count depends on size and quality, so the price is set per run. */
const gptImageOutputPrice = (model: "gpt-image-2.5" | "gpt-image-2.6"): OutputTokenPrice => ({
  currency: "USD",
  perMillion: 30,
  tokensOf: ({ aspectRatio, quality }) =>
    aspectRatio && quality ? outputTokens(model, aspectRatio, quality) : null,
})

/** Tu-zi models carry the upstream vendor's list price. */
const gptImage2Price = {
  byVariant: { low: usd(0.006), medium: usd(0.053), high: usd(0.211) },
}

/** MiniMax-H3 bills per second of output, at the chosen resolution. */
const perSecond = (amount: number): Price => ({ amount, currency: "USD", per: "second" })

export const tuziModels: MediaModel[] = [
  {
    id: "gpt-image-2",
    provider: "tuzi",
    name: "GPT Image 2",
    modality: "image",
    api: "openai-images",
    capabilities: ["text-to-image", "image-edit", "multi-reference", "mask-edit"],
    params: gptImageParams(["low", "medium", "high"]),
    variant: "quality",
    price: gptImage2Price,
    // Docs: https://api.tu-zi.com/en/docs/providers/openai/image
    // Price: OpenAI's per-image list price at 1024x1024, the dearest of its listed sizes, read 2026-11-02
    // (https://developers.openai.com/api/docs/guides/image-generation). `auto` takes the high price.
  },
  {
    id: "gpt-image-2.5-flare",
    provider: "tuzi",
    name: "GPT Image 2.5 Flare",
    modality: "image",
    api: "openai-images",
    capabilities: ["text-to-image", "image-edit", "multi-reference", "mask-edit"],
    params: gptImageParams(["low", "medium", "high", "xhigh", "max"]),
    variant: "quality",
    price: gptImageOutputPrice("gpt-image-2.5"),
    // Docs: https://api.tu-zi.com/en/docs/providers/openai/image
    // Tu-zi's image page lists only `gpt-image-2`; this id runs ahead of it. Price follows OpenAI's
    // calculator (lib/gpt-image.ts), read 2026-11-05. Flare is the fast everyday snapshot.
  },
  {
    id: "gpt-image-2.5-sunburst",
    provider: "tuzi",
    name: "GPT Image 2.5 Sunburst",
    modality: "image",
    api: "openai-images",
    capabilities: ["text-to-image", "image-edit", "multi-reference", "mask-edit"],
    params: gptImageParams(["low", "medium", "high", "xhigh", "max"]),
    variant: "quality",
    price: gptImageOutputPrice("gpt-image-2.5"),
    // Docs: https://api.tu-zi.com/en/docs/providers/openai/image
    // Same as Flare. Sunburst is the editing-precision snapshot.
  },
  {
    id: "gpt-image-2.6-flare",
    provider: "tuzi",
    name: "GPT Image 2.6 Flare",
    modality: "image",
    api: "openai-images",
    capabilities: ["text-to-image", "image-edit", "multi-reference", "mask-edit"],
    params: {
      ...gptImageParams(["low", "medium", "high", "xhigh", "max"]),
      complexity: { options: ["low", "medium", "high"], default: "high" },
    },
    variant: "quality",
    price: gptImageOutputPrice("gpt-image-2.6"),
    // Docs: https://api.tu-zi.com/en/docs/providers/openai/image
    // Tu-zi's usage is marked `estimated` and differs from OpenAI's calculator, so the upstream bill may
    // differ from the list price. `complexity` is not in the calculator, so it does not change the price.
    // Tu-zi accepts any value and does not show whether it took effect. A 1024x1024 request came back 1254x1254.
  },
  {
    id: "gpt-image-2.6-sunburst",
    provider: "tuzi",
    name: "GPT Image 2.6 Sunburst",
    modality: "image",
    api: "openai-images",
    capabilities: ["text-to-image", "image-edit", "multi-reference", "mask-edit"],
    params: {
      ...gptImageParams(["low", "medium", "high", "xhigh", "max"]),
      complexity: { options: ["low", "medium", "high"], default: "high" },
    },
    variant: "quality",
    price: gptImageOutputPrice("gpt-image-2.6"),
    // Docs: https://api.tu-zi.com/en/docs/providers/openai/image
    // Same as Flare. Sunburst is the detailed-work snapshot.
  },
  {
    id: "gemini-nano-banana-2.1",
    provider: "tuzi",
    name: "Nano Banana 2.1",
    modality: "image",
    api: "gemini-image",
    capabilities: ["text-to-image", "image-edit", "multi-reference", "web-search"],
    params: {
      aspectRatio: {
        options: ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"],
        default: "16:9",
      },
      resolution: { options: ["1K", "2K", "4K"], default: "1K" },
    },
    variant: "resolution",
    price: { byVariant: { "1K": usd(0.0336), "2K": usd(0.0504), "4K": usd(0.113) } },
    // Docs: https://api.tu-zi.com/en/docs/providers/google-gemini/image
    // Price: Google's Standard-tier per-image rate, read 2026-11-02 (https://ai.google.dev/gemini-api/docs/pricing).
    // Input tokens are not counted. Tu-zi's docs do not list this id, but the id is Google's own.
  },
  {
    id: "mj-imagine",
    provider: "tuzi",
    name: "Midjourney",
    modality: "image",
    api: "midjourney",
    capabilities: ["text-to-image", "multi-reference"],
    params: {},
    outputsPerRun: 4,
    guide: midjourneyGuide,
    price: { amount: 0.15, currency: "CNY", per: "output" },
    // Docs: https://api.tu-zi.com/en/docs/api/midjourney
    // No controls: flags go in the prompt, and `guides/midjourney.md` is their reference. One run delivers four images.
    // Midjourney publishes no API price, so the price is the user's rule: 0.15 CNY per task.
  },
  {
    id: "MiniMax-H3",
    provider: "tuzi",
    name: "MiniMax-H3",
    modality: "video",
    api: "minimax-video",
    capabilities: ["text-to-video", "first-frame", "first-last-frame", "reference-to-video"],
    params: {
      aspectRatio: { options: ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"], default: "16:9" },
      resolution: { options: ["768p", "2K"], default: "768p" },
      duration: { min: 4, max: 15, step: 1, default: 5 },
    },
    variant: "resolution",
    price: { byVariant: { "768p": perSecond(0.08), "2K": perSecond(0.13) } },
    framesAlone: true,
    // Docs: https://api.tu-zi.com/en/docs/providers/minimax/video
    // Price: MiniMax's official per-second rate, read 2026-11-05 (https://platform.minimax.io/docs/pricing/overview).
    // Input is not counted: five images per task are free, and reference video and audio bill by duration.
    // A frame set together with reference media is refused upstream, so `framesAlone` refuses it first.
  },
  {
    id: "chirp-hawk",
    provider: "tuzi",
    name: "Suno v6",
    modality: "audio",
    api: "suno-music",
    capabilities: ["text-to-audio"],
    params: {},
    price: null,
    // Docs: https://tuzi-api.apifox.cn/343646958e0
    // Suno publishes no API price, so `price` stays null.
  },
]
