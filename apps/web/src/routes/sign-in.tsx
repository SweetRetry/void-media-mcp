import { createFileRoute, useHydrated, useNavigate } from "@tanstack/react-router"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"
import { CircleAlertIcon } from "lucide-react"
import { type FormEvent, useState } from "react"

import { authClient } from "@/lib/auth-client"

/**
 * The admin's sign-in. An MCP client's authorization sends the browser here with a signed
 * `oauth_query`; after sign-in the OAuth plugin continues it to consent on its own.
 */
export const Route = createFileRoute("/sign-in")({
  head: () => ({ meta: [{ title: "Sign in to Void Media" }] }),
  component: SignIn,
})

function SignIn() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  // Until React has hydrated, a submit would be the browser's own; the button waits for it.
  const ready = useHydrated()

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setPending(true)
    setError(null)
    const result = await authClient.signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
    })
    if (result.error) {
      setPending(false)
      return setError(result.error.message ?? "Sign-in failed.")
    }
    // Inside an OAuth flow the plugin has already redirected; otherwise go to the overview.
    if (!new URLSearchParams(window.location.search).has("sig")) await navigate({ to: "/" })
  }

  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Void Media</CardTitle>
          <CardDescription>Sign in with the admin account</CardDescription>
        </CardHeader>
        <CardContent>
          {/* POST, so a submit before hydration never puts the password in the URL. */}
          <form method="post" onSubmit={submit}>
            <FieldGroup>
              {error && (
                <Alert variant="destructive">
                  <CircleAlertIcon />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input id="email" name="email" type="email" autoComplete="username" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </Field>
              <Button type="submit" disabled={!ready || pending}>
                {pending && <Spinner data-icon="inline-start" />}
                Sign in
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
