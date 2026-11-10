import env from "@env"
import { createLocalJWKSet, type JSONWebKeySet, type JWTPayload, jwtVerify } from "jose"

import { getAuth, mcpResource } from "./auth.server"

/*
 * Verifies an MCP access token in-process. `requireMcpAuth` from @better-auth/mcp fetches the
 * JWKS over HTTP from this same origin, and a Worker fetching its own workers.dev URL gets a 404
 * from Cloudflare, so the keys are read through the auth API instead of the network.
 */

const metadataUrl = () => `${env.BETTER_AUTH_URL}/.well-known/oauth-protected-resource/mcp`

/** The RFC 9728 challenge an MCP client follows into OAuth discovery. */
function unauthorized(error?: string) {
  const params = [`resource_metadata="${metadataUrl()}"`]
  if (error) params.unshift(`error="invalid_token"`, `error_description="${error}"`)
  return Response.json(
    { jsonrpc: "2.0", error: { code: -32000, message: error ?? "Unauthorized" }, id: null },
    { status: 401, headers: { "www-authenticate": `Bearer ${params.join(", ")}` } }
  )
}

/** Runs `handler` with the token's claims when the request carries a valid access token for `/mcp`. */
export async function withMcpAuth(
  request: Request,
  handler: (claims: JWTPayload) => Promise<Response>
): Promise<Response> {
  const header = request.headers.get("authorization") ?? ""
  const token = /^Bearer (.+)$/i.exec(header)?.[1]
  if (!token) return unauthorized()
  let claims: JWTPayload
  try {
    const jwks = (await getAuth().api.getJwks()) as JSONWebKeySet
    ;({ payload: claims } = await jwtVerify(token, createLocalJWKSet(jwks), {
      issuer: `${env.BETTER_AUTH_URL}/api/auth`,
      audience: mcpResource(),
      typ: "at+jwt",
      requiredClaims: ["sub", "azp"],
    }))
  } catch (error) {
    return unauthorized(
      error instanceof Error ? error.message.replaceAll('"', "'") : "invalid token"
    )
  }
  return handler(claims)
}
