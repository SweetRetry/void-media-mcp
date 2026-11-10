import { redirect } from "@tanstack/react-router"
import { createMiddleware } from "@tanstack/react-start"
import { getRequest } from "@tanstack/react-start/server"

import { getAuth } from "./auth.server"

/** Server functions that read admin data take this first. Without a session, it redirects to sign-in. */
export const signedIn = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const session = await getAuth().api.getSession({ headers: getRequest().headers })
  if (!session) throw redirect({ to: "/sign-in" })
  return next({ context: { user: { id: session.user.id, email: session.user.email } } })
})
