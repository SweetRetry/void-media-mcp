import type { Capability, MediaModel } from "./model"
import { defaultsOf, type ParamKey, type Params } from "./params"

/** `reference` guides any number of images; frame roles pin a video's ends; `mask` marks what an edit may change. */
export type ReferenceRole = "reference" | "first-frame" | "last-frame" | "mask"

/** Media a request carries. The provider must be able to fetch the URL, so the server signs it first. */
export type Reference = { role: ReferenceRole; url: string; mime: string }

type Media = "image" | "video" | "audio"
const MEDIA = new Set<string>(["image", "video", "audio"])

/** `image/png` is an image. `resolveInput` refuses any other kind, so past it every reference has one. */
export const mediaOf = (reference: Reference): Media => reference.mime.split("/")[0] as Media

/** A generation request in the product's vocabulary, shared by every model. */
export type GenerationInput = {
  prompt: string
  references?: readonly Reference[]
  params?: Partial<Params>
}

/** Input checked against one model: every control it has is set, and nothing it lacks is. */
export type ResolvedInput = {
  prompt: string
  references: readonly Reference[]
  params: Partial<Params>
}

export type Issue = { path: string; message: string }

export type Checked<T> = { ok: true; value: T } | { ok: false; issues: Issue[] }

/** Capabilities that let a model take a reference in this role. One image guide is an edit; more than one needs multi-reference. */
function capabilitiesFor(model: MediaModel, reference: Reference, guides: number): Capability[] {
  if (reference.role === "mask") return ["mask-edit"]
  if (reference.role === "first-frame") return ["first-frame"]
  if (reference.role === "last-frame") return ["first-last-frame"]
  if (model.modality === "video") {
    return mediaOf(reference) === "video"
      ? ["video-edit", "reference-to-video"]
      : ["reference-to-video"]
  }
  return guides > 1 ? ["multi-reference"] : ["image-edit", "multi-reference"]
}

function checkParam(model: MediaModel, key: ParamKey, value: unknown): string | null {
  const spec = model.params[key]
  if (!spec) return `${model.name} has no ${key} control`
  if ("options" in spec) {
    return (spec.options as readonly unknown[]).includes(value)
      ? null
      : `must be one of ${spec.options.join(", ")}`
  }
  if ("min" in spec) {
    if (typeof value !== "number" || !Number.isFinite(value)) return "must be a number"
    if (value < spec.min || value > spec.max) return `must be between ${spec.min} and ${spec.max}`
    return (value - spec.min) % spec.step === 0 ? null : `must step by ${spec.step}`
  }
  return typeof value === "boolean" ? null : "must be true or false"
}

/** Checks input against one model and fills the defaults. Runs before any adapter, so adapters trust what they read. */
export function resolveInput(model: MediaModel, input: GenerationInput): Checked<ResolvedInput> {
  const issues: Issue[] = []
  const prompt = input.prompt.trim()
  if (!prompt) issues.push({ path: "prompt", message: "is empty" })

  const given = input.params ?? {}
  for (const key of Object.keys(given) as ParamKey[]) {
    if (given[key] === undefined) continue
    const message = checkParam(model, key, given[key])
    if (message) issues.push({ path: `params.${key}`, message })
  }

  const references = input.references ?? []
  const guides = references.filter((reference) => reference.role === "reference").length
  if (model.maxReferences !== undefined && references.length > model.maxReferences) {
    issues.push({ path: "references", message: `takes at most ${model.maxReferences}` })
  }
  references.forEach((reference, index) => {
    const path = `references.${index}`
    if (!MEDIA.has(reference.mime.split("/")[0] ?? "")) {
      issues.push({ path, message: `${reference.mime} is not image, video or audio` })
      return
    }
    if (model.modality === "image" && mediaOf(reference) !== "image") {
      issues.push({ path, message: `${model.name} takes only image references` })
    }
    const needs = capabilitiesFor(model, reference, guides)
    if (!needs.some((capability) => model.capabilities.includes(capability))) {
      issues.push({ path, message: `${model.name} does not support ${needs.join(" or ")}` })
    }
  })
  const has = (role: Reference["role"]) => references.some((reference) => reference.role === role)
  if (has("last-frame") && !has("first-frame")) {
    issues.push({ path: "references", message: "a last frame needs a first frame" })
  }
  if (model.framesAlone && (has("first-frame") || has("last-frame")) && has("reference")) {
    issues.push({
      path: "references",
      message: `${model.name} takes frames or references, not both`,
    })
  }

  if (issues.length) return { ok: false, issues }
  return {
    ok: true,
    value: { prompt, references, params: { ...defaultsOf(model.params), ...given } },
  }
}
