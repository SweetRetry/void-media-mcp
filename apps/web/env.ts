import { defineEnv, string, url } from "void/env"

// Server code reads these as `import env from "@env"`. Void's TanStack Start entry does not import
// this file, so importing it is what registers the schema and validates the values.
export default defineEnv({
  // Signs sessions, OAuth query state and the JWKS private key's encryption. At least 32 characters.
  BETTER_AUTH_SECRET: string(),
  // The public origin. It is the OAuth issuer's base and the MCP resource (`${BETTER_AUTH_URL}/mcp`),
  // so it must be fixed rather than read from each request. Local: http://localhost:5173.
  BETTER_AUTH_URL: url(),
  // Provider keys, named by each provider's `keyEnv` in packages/model-providers. Unset, that
  // provider's models fail at submission.
  ARK_API_KEY: string().optional(),
  TUZI_API_KEY: string().optional(),
})
