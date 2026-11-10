import { drizzleAdapter } from "@better-auth/drizzle-adapter"
import { mcp } from "@better-auth/mcp"
import { betterAuth } from "better-auth"
import { jwt } from "better-auth/plugins"
import { tanstackStartCookies } from "better-auth/tanstack-start"
import env from "@env"
import { db } from "void/db"

import * as schema from "@db/schema"

/** The MCP endpoint's canonical URL. Tokens are audience-bound to it. */
export const mcpResource = () => `${env.BETTER_AUTH_URL}/mcp`

/**
 * Better Auth on D1, as the OAuth 2.1 authorization server for MCP clients. One admin account
 * exists, seeded by `scripts/seed-admin.ts`; sign-up is off, so nobody else can get a session.
 * MCP clients register themselves (RFC 7591) and get JWT access tokens bound to `/mcp`.
 */
const create = () =>
  betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    database: drizzleAdapter(db, { provider: "sqlite", schema }),
    emailAndPassword: { enabled: true, disableSignUp: true },
    // The OAuth provider serves its own token endpoint; Better Auth's session `/token` would clash.
    disabledPaths: ["/token"],
    plugins: [
      jwt({ disableSettingJwtHeader: true }),
      mcp({
        loginPage: "/sign-in",
        consentPage: "/consent",
        resource: mcpResource(),
        // Claude Code registers itself on first connect. Only the admin can then authorize it.
        allowDynamicClientRegistration: true,
        allowUnauthenticatedClientRegistration: true,
        clientRegistrationDefaultApplicationType: "infer",
      }),
      // Sets the session cookie from server functions too; it must stay the last plugin.
      tanstackStartCookies(),
    ],
  })

let instance: ReturnType<typeof create> | undefined

/** The Better Auth instance, built on first use, since `env` and `db` exist only inside a request. */
export const getAuth = () => (instance ??= create())
