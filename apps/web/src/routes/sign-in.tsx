import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setPending(true)
    setError(null)
    const result = await authClient.signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
    })
    setPending(false)
    if (result.error) return setError(result.error.message ?? "Sign-in failed.")
    // Inside an OAuth flow the plugin has already redirected; otherwise go to the dashboard.
    if (!new URLSearchParams(window.location.search).has("sig")) await navigate({ to: "/" })
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-sm flex-col justify-center px-4">
      <h1 className="text-2xl font-semibold">Void Media</h1>
      <p className="mt-1 text-sm text-muted-foreground">Admin sign-in</p>
      <form onSubmit={submit} className="mt-6">
        <FieldGroup>
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
          {error && <FieldError>{error}</FieldError>}
          <Button type="submit" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </FieldGroup>
      </form>
    </main>
  )
}
