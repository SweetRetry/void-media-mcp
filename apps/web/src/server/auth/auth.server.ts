import { drizzleAdapter } from "@better-auth/drizzle-adapter"
import { mcp } from "@better-auth/mcp"
import { betterAuth } from "better-auth"
import { jwt } from "better-auth/plugins"
import { tanstackStartCookies } from "better-auth/tanstack-start"
import env from "@env"
import { db, eq } from "void/db"

import * as schema from "@db/schema"

/** The MCP endpoint's canonical URL. Tokens are audience-bound to it. */
export const mcpResource = () => `${env.BETTER_AUTH_URL}/mcp`

/** Only a verified Google address listed in ADMIN_EMAILS may hold an account or a session. */
const isAdmin = (email: string, verified: boolean) =>
  verified &&
  env.ADMIN_EMAILS.split(",")
    .map((allowed) => allowed.trim().toLowerCase())
    .includes(email.toLowerCase())

/**
 * Better Auth on D1, as the OAuth 2.1 authorization server for MCP clients. The admin signs in
 * with Google; an address outside ADMIN_EMAILS is refused before a user row or a session is written.
 * MCP clients register themselves (RFC 7591) and get JWT access tokens bound to `/mcp`.
 */
const create = () =>
  betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    database: drizzleAdapter(db, { provider: "sqlite", schema }),
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        prompt: "select_account",
      },
    },
    databaseHooks: {
      user: {
        create: { before: async (user) => isAdmin(user.email, user.emailVerified) },
      },
      // The gate for every sign-in, including a user row whose address was later removed from ADMIN_EMAILS.
      session: {
        create: {
          before: async (session) => {
            const [owner] = await db
              .select({ email: schema.user.email, verified: schema.user.emailVerified })
              .from(schema.user)
              .where(eq(schema.user.id, session.userId))
            return !!owner && isAdmin(owner.email, owner.verified)
          },
        },
      },
    },
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
