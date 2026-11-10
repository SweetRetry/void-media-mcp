import { createFileRoute } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import { useEffect, useState } from "react"

import { authClient } from "@/lib/auth-client"

/**
 * Where the admin approves an MCP client, such as Claude Code, to call the tools for them. The
 * signed `oauth_query` in the URL rides along with the consent call through the client plugin.
 */
export const Route = createFileRoute("/consent")({
  head: () => ({ meta: [{ title: "Authorize a client" }] }),
  component: Consent,
})

type Client = { client_name?: string; client_uri?: string }

function Consent() {
  const [client, setClient] = useState<Client | null>(null)
  const [scopes, setScopes] = useState<string[]>([])
  const [redirectHost, setRedirectHost] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const query = new URLSearchParams(window.location.search)
    const clientId = query.get("client_id") ?? ""
    setScopes((query.get("scope") ?? "").split(" ").filter(Boolean))
    try {
      setRedirectHost(new URL(query.get("redirect_uri") ?? "").host)
    } catch {
      setRedirectHost("")
    }
    void authClient.oauth2
      .publicClient({ query: { client_id: clientId } })
      .then((result) => setClient((result.data as Client | null) ?? {}))
  }, [])

  async function answer(accept: boolean) {
    setPending(true)
    const result = await authClient.oauth2.consent({ accept })
    setPending(false)
    if (result.error) setError(result.error.message ?? "That did not go through.")
  }

  const name = client?.client_name || "An MCP client"
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center px-4">
      <h1 className="text-2xl font-semibold">Authorize {name}?</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        It will be able to generate images, video and audio on your provider accounts, which costs
        money, and read your usage log and cost report.
      </p>
      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Returns to</dt>
        <dd className="font-mono">{redirectHost || "unknown"}</dd>
        <dt className="text-muted-foreground">Scopes</dt>
        <dd className="font-mono">{scopes.join(" ") || "default"}</dd>
      </dl>
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      <div className="mt-6 flex gap-2">
        <Button onClick={() => answer(true)} disabled={pending}>
          Allow
        </Button>
        <Button variant="secondary" onClick={() => answer(false)} disabled={pending}>
          Deny
        </Button>
      </div>
    </main>
  )
}
