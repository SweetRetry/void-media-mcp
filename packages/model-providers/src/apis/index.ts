import type { ApiId, MediaModel } from "../lib/model"
import type { Adapter } from "./api"
import { arkImages } from "./ark-images"
import { geminiImage } from "./gemini-image"
import { midjourney } from "./midjourney"
import { openaiImages } from "./openai-images"
import { sunoMusic } from "./suno-music"
import { arkVideo } from "./video/ark"
import { minimaxVideo } from "./video/minimax"

const ADAPTERS: Record<ApiId, Adapter> = {
  "ark-images": arkImages,
  "ark-video": arkVideo,
  "openai-images": openaiImages,
  "gemini-image": geminiImage,
  midjourney,
  "minimax-video": minimaxVideo,
  "suno-music": sunoMusic,
}

/** The adapter for a model's API. */
export const apiOf = (model: MediaModel): Adapter => ADAPTERS[model.api]

export type { Adapter, Body, HttpCall } from "./api"
