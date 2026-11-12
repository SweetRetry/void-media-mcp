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
import { Button } from "@workspace/ui/components/button"
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
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
  const command = `claude mcp add --transport http --scope user obscura ${mcpUrl}`

  return (
    <>
      <PageHeader crumbs={[{ label: "Connect" }]} />
      <div className="flex max-w-4xl flex-col gap-10 p-4 lg:p-6">
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold">Add to Claude Code</h2>
            <p className="text-sm text-muted-foreground">
              Run the command, then /mcp in Claude Code. A browser opens here to sign in and allow
              it.
            </p>
          </div>
          <FieldGroup>
            <Snippet label="Command" text={command} />
            <Snippet label="MCP URL, for other clients" text={mcpUrl} />
          </FieldGroup>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-base font-semibold">Authorized clients</h2>
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
                        <span className="text-sm text-muted-foreground">Revoked</span>
                      ) : (
                        <RevokeButton clientId={client.clientId} name={client.name} />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      </div>
    </>
  )
}

function Snippet({ label, text }: { label: string; text: string }) {
  const id = `snippet-${label.split(" ")[0]!.toLowerCase()}`
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="flex items-center gap-2">
        <Input id={id} readOnly value={text} onFocus={(event) => event.currentTarget.select()} />
        <CopyButton text={text} label={`Copy ${label.toLowerCase()}`} size="icon" />
      </div>
    </Field>
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
