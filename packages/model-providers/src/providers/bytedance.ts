import type { MediaModel } from "../lib/model"
import { ASPECT_RATIOS, type ParamSpec, type Resolution } from "../lib/params"
import type { Price } from "../lib/price"
import type { Provider } from "../lib/provider"

/** ByteDance's own models, served by Volcengine Ark (火山方舟). */
export const bytedance: Provider = {
  id: "bytedance",
  name: "ByteDance",
  baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
  keyEnv: "ARK_API_KEY",
  // Docs: https://www.volcengine.com/docs/82379
}

/** Seedream takes any `WxH`, so every ratio is offered. Resolution is what its price keys on. */
function imageParams(resolutions: readonly Resolution[], resolution: Resolution = "2K"): ParamSpec {
  return {
    aspectRatio: { options: ASPECT_RATIOS, default: "16:9" },
    resolution: { options: resolutions, default: resolution },
  }
}

/** The controls the Seedance series shares. The models differ only in the resolutions they accept. */
function videoParams(resolutions: readonly Resolution[]): ParamSpec {
  return {
    aspectRatio: {
      options: ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9"],
      default: "16:9",
    },
    resolution: { options: resolutions, default: "720p" },
    duration: { min: 4, max: 15, step: 1, default: 5 },
    watermark: { default: false },
    audio: { default: true },
  }
}

const cny = (amount: number, per: Price["per"]): Price => ({ amount, currency: "CNY", per })

/** Priced at the 480p and 720p rate without video input. 1080p and 4K have no published figure. */
const seedancePrice = (amount: number) => ({
  byVariant: { "480p": cny(amount, "million-tokens"), "720p": cny(amount, "million-tokens") },
})

export const bytedanceModels: MediaModel[] = [
  {
    id: "doubao-seedream-5-0-pro-260628",
    provider: "bytedance",
    name: "Seedream 5.0 Pro",
    modality: "image",
    api: "ark-images",
    capabilities: ["text-to-image", "image-edit", "multi-reference"],
    params: imageParams(["1K", "1.5K", "2K"], "1.5K"),
    maxReferences: 10,
    variant: "resolution",
    price: {
      byVariant: { "1K": cny(0.3, "output"), "1.5K": cny(0.3, "output"), "2K": cny(0.6, "output") },
    },
    // Docs: https://ark.volcengine.com/region:cn-beijing/docs/seedream-5-0-pro
    // Alias doubao-seedream-5-0-pro. 0.30 CNY covers outputs up to 2.61M px (1K and 1.5K). The first
    // input image is free, and each further one costs 0.02 CNY.
  },
  {
    id: "doubao-seedream-5-0-flash-260915",
    provider: "bytedance",
    name: "Seedream 5.0 Flash",
    modality: "image",
    api: "ark-images",
    capabilities: ["text-to-image", "image-edit", "multi-reference"],
    params: imageParams(["1K", "1.5K", "2K"]),
    price: { amount: 0.12, currency: "CNY", per: "output" },
    // Docs: https://ark.volcengine.com/region:cn-beijing/model/detail?Id=doubao-seedream-5-0-flash
    // Alias doubao-seedream-5-0-flash. Flat price for every size. Input images are not billed.
  },
  {
    id: "doubao-seedream-5-0-260128",
    provider: "bytedance",
    name: "Seedream 5.0 Lite",
    modality: "image",
    api: "ark-images",
    capabilities: [
      "text-to-image",
      "image-edit",
      "multi-reference",
      "sequential-images",
      "web-search",
    ],
    params: { ...imageParams(["1K", "2K", "3K", "4K"]), sequential: { default: false } },
    maxReferences: 14,
    price: { amount: 0.22, currency: "CNY", per: "output" },
    // Docs: https://ark.volcengine.com/region:cn-beijing/model/detail?Id=doubao-seedream-5-0
    // Alias doubao-seedream-5-0-lite-260128. The model square marks it as retiring, with no date.
    // Flat price. Input images are not billed, up to 14.
  },
  {
    id: "doubao-seedance-2-0-260128",
    provider: "bytedance",
    name: "Seedance 2.0",
    modality: "video",
    api: "ark-video",
    capabilities: [
      "text-to-video",
      "first-frame",
      "first-last-frame",
      "reference-to-video",
      "video-edit",
      "video-extend",
      "web-search",
    ],
    params: videoParams(["480p", "720p", "1080p", "4K"]),
    variant: "resolution",
    price: seedancePrice(46),
    // Docs: https://ark.volcengine.com/region:cn-beijing/docs/seedance-2-0
    // Alias doubao-seedance-2.0. Duration defaults to 5 s because the API's -1 (automatic) is not a slider stop.
  },
  {
    id: "doubao-seedance-2-0-fast-260128",
    provider: "bytedance",
    name: "Seedance 2.0 Fast",
    modality: "video",
    api: "ark-video",
    capabilities: [
      "text-to-video",
      "first-frame",
      "first-last-frame",
      "reference-to-video",
      "video-edit",
      "video-extend",
      "web-search",
    ],
    params: videoParams(["480p", "720p"]),
    variant: "resolution",
    price: seedancePrice(23),
    // Docs: https://ark.volcengine.com/region:cn-beijing/docs/seedance-2-0
    // Alias doubao-seedance-2.0-fast. Price is AI Hub's approximate rate. Input and output billing are not confirmed apart.
  },
  {
    id: "doubao-seedance-2-0-mini-260615",
    provider: "bytedance",
    name: "Seedance 2.0 Mini",
    modality: "video",
    api: "ark-video",
    capabilities: [
      "text-to-video",
      "first-frame",
      "first-last-frame",
      "reference-to-video",
      "video-edit",
      "video-extend",
      "web-search",
    ],
    params: videoParams(["480p", "720p"]),
    variant: "resolution",
    price: seedancePrice(37),
    // Docs: https://ark.volcengine.com/region:cn-beijing/docs/seedance-2-0
    // Alias doubao-seedance-2.0-mini. Price is AI Hub's approximate rate. Input and output billing are not confirmed apart.
  },
]
