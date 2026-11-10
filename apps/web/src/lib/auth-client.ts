import { oauthProviderClient } from "@better-auth/oauth-provider/client"
import { createAuthClient } from "better-auth/react"

/**
 * Better Auth's browser client. The OAuth plugin sends the signed `oauth_query` from the current
 * URL with every request, so signing in on `/sign-in?…` resumes the authorization it came from.
 */
export const authClient = createAuthClient({ plugins: [oauthProviderClient()] })
