import { env } from "cloudflare:workers"
import { storage } from "void/storage"

import { outputKey } from "./runs.server"

declare global {
  namespace Cloudflare {
    interface Env {
      /** Cloudflare Images, declared in `void.config.ts`. Local dev runs it on sharp. */
      IMAGES: ImagesBinding
    }
  }
}

/** Long edge of a preview. Claude downsizes past about 1568px anyway, and smaller saves context. */
const EDGE = 1024

/** A stored image output scaled down to WebP, as base64, so an MCP tool result can carry it. */
export async function previewOf(id: string) {
  const object = await storage.get(outputKey(id))
  if (!object) return null
  const result = await env.IMAGES.input(object.body)
    .transform({ width: EDGE, height: EDGE, fit: "scale-down" })
    .output({ format: "image/webp", quality: 80 })
  return {
    data: await new Response(result.image({ encoding: "base64" })).text(),
    mimeType: result.contentType(),
  }
}
