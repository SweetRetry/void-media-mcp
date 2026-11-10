import { createFileRoute } from "@tanstack/react-router"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Spinner } from "@workspace/ui/components/spinner"
import { CircleAlertIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { z } from "zod"

import { authClient } from "@/lib/auth-client"

/**
 * Where the admin approves an MCP client, such as Claude Code, to call the tools for them. The
 * signed `oauth_query` in the URL rides along with the consent call through the client plugin.
 */
export const Route = createFileRoute("/consent")({
  validateSearch: z.object({
    client_id: z.string().catch(""),
    scope: z.string().optional(),
    redirect_uri: z.string().optional(),
  }),
  head: () => ({ meta: [{ title: "Authorize a client" }] }),
  component: Consent,
})

const hostOf = (uri?: string) => {
  try {
    return uri ? new URL(uri).host : null
  } catch {
    return null
  }
}

function Consent() {
  const search = Route.useSearch()
  const scopes = (search.scope ?? "").split(" ").filter(Boolean)
  const [name, setName] = useState<string | null | undefined>(undefined)
  const [pending, setPending] = useState<"allow" | "deny" | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void authClient.oauth2
      .publicClient({ query: { client_id: search.client_id } })
      .then((result) =>
        setName((result.data as { client_name?: string } | null)?.client_name ?? null)
      )
  }, [search.client_id])

  async function answer(accept: boolean) {
    setPending(accept ? "allow" : "deny")
    const result = await authClient.oauth2.consent({ accept })
    if (result.error) {
      setPending(null)
      setError(result.error.message ?? "That did not go through.")
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
            {name === undefined ? (
              <Skeleton className="h-5 w-48" />
            ) : (
              `Authorize ${name ?? "this client"}?`
            )}
          </CardTitle>
          <CardDescription>
            It will generate images, video and audio on your provider accounts, which costs money,
            and read your generation log and costs.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Returns to</dt>
            <dd className="font-mono">{hostOf(search.redirect_uri) ?? "unknown"}</dd>
            <dt className="text-muted-foreground">Scopes</dt>
            <dd className="flex flex-wrap gap-1">
              {scopes.length ? (
                scopes.map((scope) => (
                  <Badge key={scope} variant="outline">
                    {scope}
                  </Badge>
                ))
              ) : (
                <span>default</span>
              )}
            </dd>
          </dl>
          {error && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter className="gap-2">
          <Button onClick={() => answer(true)} disabled={pending !== null}>
            {pending === "allow" && <Spinner data-icon="inline-start" />}
            Allow
          </Button>
          <Button variant="secondary" onClick={() => answer(false)} disabled={pending !== null}>
            {pending === "deny" && <Spinner data-icon="inline-start" />}
            Deny
          </Button>
        </CardFooter>
      </Card>
    </main>
  )
}
