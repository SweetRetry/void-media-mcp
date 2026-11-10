import { createFileRoute } from "@tanstack/react-router"
import { storage } from "void/storage"

import { outputKey } from "@/server/generation/runs.server"

/**
 * A generated file. The 128-bit random id is the capability: anyone with the link can fetch it, so
 * providers can take it as a reference and Claude Code can download it without a token.
 */
export const Route = createFileRoute("/f/$file")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const id = params.file.split(".")[0] ?? ""
        if (!/^[0-9a-f]{32}$/.test(id)) return new Response("Not found", { status: 404 })
        const object = await storage.get(outputKey(id))
        if (!object) return new Response("Not found", { status: 404 })
        const headers = new Headers()
        object.writeHttpMetadata(headers)
        headers.set("etag", object.httpEtag)
        headers.set("x-content-type-options", "nosniff")
        headers.set("content-security-policy", "sandbox")
        headers.set("cache-control", "public, max-age=31536000, immutable")
        return new Response(object.body, { headers })
      },
    },
  },
})
