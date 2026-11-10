import type { MediaModality, MediaModel } from "../lib/model"
import type { Provider, ProviderId } from "../lib/provider"
import { bytedance, bytedanceModels } from "./bytedance"
import { tuzi, tuziModels } from "./tuzi"

/** Every provider the catalog knows, in listing order. */
export const providers: Provider[] = [bytedance, tuzi]

/** Every media model the catalog knows, grouped by provider. */
export const models: MediaModel[] = [...bytedanceModels, ...tuziModels]

const byId = new Map(providers.map((provider) => [provider.id, provider]))
const modelById = new Map(models.map((model) => [model.id, model]))

/** A provider by id. Throws when a model cites one the catalog does not list. */
export function providerOf(id: ProviderId): Provider {
  const provider = byId.get(id)
  if (!provider) throw new RangeError(`Unknown provider: ${id}`)
  return provider
}

/** The models that produce one modality, in catalog order. */
export const modelsOf = (modality: MediaModality): MediaModel[] =>
  models.filter((model) => model.modality === modality)

/** A media model by its API id, or undefined when the catalog has none. */
export const modelOf = (id: string): MediaModel | undefined => modelById.get(id)
