import { createFileRoute } from "@tanstack/react-router"

import { getAuth } from "@/server/auth/auth.server"

/**
 * OAuth discovery at the origin root, where MCP clients look for it: the protected resource
 * metadata for `/mcp` (RFC 9728) and the authorization server metadata (RFC 8414). Better Auth's
 * mcp() plugin answers both from its request hook.
 */
export const Route = createFileRoute("/.well-known/$")({
  server: {
    handlers: {
      GET: ({ request }) => getAuth().handler(request),
    },
  },
})
