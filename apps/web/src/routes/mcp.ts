import { createMcpHandler } from "@modelcontextprotocol/server"
import { createFileRoute } from "@tanstack/react-router"

import { withMcpAuth } from "@/server/auth/mcp-auth.server"
import { mcpServer } from "@/server/mcp.server"

/**
 * The MCP endpoint (Streamable HTTP). Each request gets a fresh server; 2025-era clients are
 * served statelessly. The bearer token must be a JWT this server issued for `/mcp`; without one
 * the answer is a 401 whose `WWW-Authenticate` points the client at OAuth discovery.
 */
const serve = (request: Request) =>
  withMcpAuth(request, (claims) => {
    const caller = {
      userId: String(claims.sub),
      clientId: typeof claims.azp === "string" ? claims.azp : null,
    }
    return createMcpHandler(() => mcpServer(caller)).fetch(request)
  })

export const Route = createFileRoute("/mcp")({
  server: {
    handlers: {
      POST: ({ request }) => serve(request),
      GET: ({ request }) => serve(request),
      DELETE: ({ request }) => serve(request),
    },
  },
})
