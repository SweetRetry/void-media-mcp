import { createFileRoute } from "@tanstack/react-router"

import { getAuth } from "@/server/auth/auth.server"

/** Better Auth: sign-in, session, and the OAuth endpoints (`/oauth2/*`, `/jwks`). */
export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => getAuth().handler(request),
      POST: ({ request }) => getAuth().handler(request),
    },
  },
})
