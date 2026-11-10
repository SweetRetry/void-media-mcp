import type { ChoiceKey, ParamSpec } from "./params"
import type { OutputTokenPrice, Price, VariantPrices } from "./price"
import type { ProviderId } from "./provider"

export type MediaModality = "image" | "video" | "audio"

/** A working method a model supports, in the product's terms. */
export type Capability =
  | "text-to-image"
  | "image-edit"
  | "multi-reference"
  | "mask-edit"
  | "sequential-images"
  | "text-to-video"
  | "text-to-audio"
  | "first-frame"
  | "first-last-frame"
  | "reference-to-video"
  | "video-edit"
  | "video-extend"
  | "web-search"

/** The call shape a generation model is reached through. Each names one adapter in `src/apis/`. */
export type ApiId =
  | "ark-images"
  | "ark-video"
  | "openai-images"
  | "gemini-image"
  | "midjourney"
  | "minimax-video"
  | "suno-music"

type Entry = {
  /** The API model string sent as `model`, with its version suffix. */
  id: string
  provider: ProviderId
  /** Shown in the product. Unique across the catalog, since prices and records key on it. */
  name: string
  capabilities: Capability[]
}

/** A model the composer can run. Its controls use the product's vocabulary. */
export type MediaModel = Entry & {
  modality: MediaModality
  api: ApiId
  params: ParamSpec
  /** The control whose value changes the price, such as GPT Image's quality. The model preference does not read it. */
  variant?: ChoiceKey
  /** One price, or one per variant value. Null when unpublished. */
  price: Price | VariantPrices | OutputTokenPrice | null
  /** Reference media per request, when the provider publishes a limit. */
  maxReferences?: number
  /** Files one run delivers, when not one. Midjourney makes four. Billing stays per run. */
  outputsPerRun?: number
  /** The provider refuses a first or last frame together with reference media, as MiniMax does. */
  framesAlone?: true
}
