import { createFileRoute, useRouter } from "@tanstack/react-router"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@workspace/ui/components/alert-dialog"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { useState } from "react"
import { toast } from "sonner"

import { CopyButton } from "@/components/app/copy-button"
import { PageHeader } from "@/components/app/page-header"
import { ago } from "@/lib/format"
import { connection, revokeClient } from "@/server/admin.functions"

export const Route = createFileRoute("/_app/connect")({
  loader: () => connection(),
  head: () => ({ meta: [{ title: "Connect" }] }),
  component: Connect,
})

function Connect() {
  const { mcpUrl, clients } = Route.useLoaderData()
  const command = `claude mcp add --transport http --scope user void-media ${mcpUrl}`

  return (
    <>
      <PageHeader crumbs={[{ label: "Connect" }]} />
      <div className="flex flex-col gap-4 p-4">
        <Card>
          <CardHeader>
            <CardTitle>Claude Code</CardTitle>
            <CardDescription>
              Add the server, then run /mcp in Claude Code and authenticate. A browser opens here to
              sign in and allow it.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Snippet label="Command" text={command} />
            <Snippet label="MCP URL" text={mcpUrl} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Authorized clients</CardTitle>
            <CardDescription>Each one can generate and read the log for you</CardDescription>
          </CardHeader>
          <CardContent>
            {clients.length === 0 ? (
              <p className="text-sm text-muted-foreground">No client has been authorized yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Authorized</TableHead>
                    <TableHead>Last used</TableHead>
                    <TableHead className="text-right">Generations</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((client) => (
                    <TableRow key={client.clientId}>
                      <TableCell>
                        <span className="font-medium">{client.name ?? "Unnamed client"}</span>
                        <span className="block font-mono text-xs text-muted-foreground">
                          {client.clientId.slice(0, 12)}
                        </span>
                      </TableCell>
                      <TableCell>{client.consentedAt ? ago(client.consentedAt) : "—"}</TableCell>
                      <TableCell>{client.lastUsed ? ago(client.lastUsed) : "Never"}</TableCell>
                      <TableCell className="text-right tabular-nums">{client.tasks}</TableCell>
                      <TableCell className="text-right">
                        {client.disabled ? (
                          <Badge variant="outline">Revoked</Badge>
                        ) : (
                          <RevokeButton clientId={client.clientId} name={client.name} />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function Snippet({ label, text }: { label: string; text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-muted p-2 pl-3">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <code className="min-w-0 flex-1 truncate text-xs">{text}</code>
      <CopyButton text={text} label={`Copy ${label.toLowerCase()}`} />
    </div>
  )
}

function RevokeButton({ clientId, name }: { clientId: string; name: string | null }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="destructive" size="sm" />}>
        Revoke
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revoke {name ?? "this client"}?</AlertDialogTitle>
          <AlertDialogDescription>
            Its tokens stop working now. To use it again, remove and re-add the server in Claude
            Code, then authorize it.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={async () => {
              setPending(true)
              await revokeClient({ data: { clientId } })
              setPending(false)
              toast.success("Revoked")
              await router.invalidate()
            }}
          >
            Revoke
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
