import { createFileRoute, useHydrated } from "@tanstack/react-router"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Spinner } from "@workspace/ui/components/spinner"
import { CircleAlertIcon } from "lucide-react"
import { useState } from "react"
import { z } from "zod"

import { authClient } from "@/lib/auth-client"

/**
 * The admin's sign-in, through Google. An MCP client's authorization sends the browser here with a
 * signed `oauth_query`; the client plugin carries it into the Google round trip, and after the
 * callback the OAuth plugin continues to consent on its own. A refused address comes back with
 * `?error=`.
 */
export const Route = createFileRoute("/sign-in")({
  validateSearch: z.object({ error: z.string().optional() }),
  head: () => ({ meta: [{ title: "Sign in to Obscura" }] }),
  component: SignIn,
})

function SignIn() {
  const { error: refused } = Route.useSearch()
  const [error, setError] = useState<string | null>(
    refused ? "This Google account can't sign in here." : null
  )
  const [pending, setPending] = useState(false)
  // Until React has hydrated, a click would do nothing; the button waits for it.
  const ready = useHydrated()

  async function signIn() {
    setPending(true)
    setError(null)
    const result = await authClient.signIn.social({
      provider: "google",
      callbackURL: "/",
      errorCallbackURL: "/sign-in",
    })
    if (result.error) {
      setPending(false)
      setError(result.error.message ?? "Sign-in failed.")
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          {/* The hand-painted lockup, on its own dark plate. */}
          <img
            src="/logo.webp"
            alt="Obscura"
            className="mb-4 h-14 w-auto justify-self-start rounded-lg"
          />
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Only the admin's Google account can sign in.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button onClick={signIn} disabled={!ready || pending}>
            {pending && <Spinner data-icon="inline-start" />}
            Continue with Google
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
