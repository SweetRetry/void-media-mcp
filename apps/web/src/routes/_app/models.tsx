import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import {
  controlsOf,
  type MediaModel,
  models,
  providerOf,
  providers,
} from "@workspace/model-providers"
import { Switch } from "@workspace/ui/components/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"

import { Fragment, useState } from "react"
import { toast } from "sonner"

import { CopyButton } from "@/components/app/copy-button"
import { PageHeader } from "@/components/app/page-header"
import { modelsPage, switchEntry } from "@/server/admin.functions"

export const Route = createFileRoute("/_app/models")({
  loader: () => modelsPage(),
  head: () => ({ meta: [{ title: "Models" }] }),
  component: Models,
})

const KINDS = ["image", "video", "audio"] as const

function Models() {
  const data = Route.useLoaderData()
  const offModels = new Set(data.offModels)
  const offProviders = new Set<string>(data.offProviders)
  return (
    <>
      <PageHeader crumbs={[{ label: "Models" }]} />
      <div className="flex flex-col gap-6 p-4 lg:p-6">
        {/* Off means MCP clients neither see nor can generate with it; running tasks finish. */}
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">Providers</h2>
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            {providers.map((provider) => (
              <div key={provider.id} className="flex items-center gap-2 text-sm">
                <EntrySwitch
                  kind="provider"
                  id={provider.id}
                  name={provider.name}
                  on={!offProviders.has(provider.id)}
                />
                <span>{provider.name}</span>
                <span className="text-muted-foreground">
                  {models.filter((model) => model.provider === provider.id).length} models
                </span>
              </div>
            ))}
          </div>
        </section>
        <Tabs defaultValue="image">
          <TabsList>
            {KINDS.map((kind) => (
              <TabsTrigger key={kind} value={kind}>
                {kind[0]!.toUpperCase() + kind.slice(1)}
              </TabsTrigger>
            ))}
          </TabsList>
          {KINDS.map((kind) => (
            <TabsContent key={kind} value={kind}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Model</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>List price</TableHead>
                    <TableHead>Settings</TableHead>
                    <TableHead>Can also</TableHead>
                    <TableHead>On</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {models
                    .filter((model) => model.modality === kind)
                    .map((model) => (
                      <TableRow key={model.id} className="align-top">
                        <TableCell>
                          <Link
                            to="/tasks"
                            search={{ model: model.id }}
                            className="font-medium hover:underline"
                          >
                            {model.name}
                          </Link>
                          <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
                            {model.id}
                            <CopyButton text={model.id} label={`Copy ${model.name} id`} />
                          </span>
                        </TableCell>
                        <TableCell>{providerOf(model.provider).name}</TableCell>
                        <TableCell className="max-w-56 whitespace-normal">
                          <PriceLines model={model} />
                        </TableCell>
                        <TableCell className="whitespace-normal">
                          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                            {controlsOf(model.params).map((control) => (
                              <ControlRow key={control.key} control={control} />
                            ))}
                          </dl>
                        </TableCell>
                        <TableCell className="whitespace-normal">
                          <span className="text-muted-foreground">
                            {model.capabilities
                              .filter((capability) => !capability.startsWith("text-to-"))
                              .map((capability) => (
                                <span key={capability} className="block whitespace-nowrap">
                                  {capability}
                                </span>
                              ))}
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-normal">
                          <EntrySwitch
                            kind="model"
                            id={model.id}
                            name={model.name}
                            on={!offModels.has(model.id)}
                            providerOff={offProviders.has(model.provider)}
                          />
                          {offProviders.has(model.provider) && (
                            <span className="block text-xs text-muted-foreground">
                              Provider off
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </>
  )
}

/**
 * Turns a model or provider on or off. Shows the new state at once and rolls back if the save
 * fails. A model under an off provider is held off, so its own switch is disabled.
 */
function EntrySwitch({
  kind,
  id,
  name,
  on,
  providerOff = false,
}: {
  kind: "model" | "provider"
  id: string
  name: string
  on: boolean
  providerOff?: boolean
}) {
  const router = useRouter()
  const [pending, setPending] = useState<boolean | null>(null)
  return (
    <Switch
      checked={(pending ?? on) && !providerOff}
      disabled={providerOff || pending !== null}
      aria-label={`${name} on`}
      onCheckedChange={async (next: boolean) => {
        setPending(next)
        try {
          await switchEntry({ data: { kind, id, on: next } })
          await router.invalidate()
          toast.success(`Turned ${name} ${next ? "on" : "off"}`)
        } catch {
          toast.error(`Could not turn ${name} ${next ? "on" : "off"}. Try again.`)
        } finally {
          setPending(null)
        }
      }}
    />
  )
}

/** A price per variant gets a line each, so the variants line up under one another. */
function PriceLines({ model }: { model: MediaModel }) {
  const price = model.price
  if (!price) return <span className="text-muted-foreground">Unpublished</span>
  if ("tokensOf" in price) return <>${price.perMillion} per 1M output tokens</>
  const one = (p: { amount: number; currency: string; per: string }) =>
    `${p.currency === "CNY" ? "¥" : "$"}${p.amount} per ${p.per}`
  if (!("byVariant" in price)) return <>{one(price)}</>
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
      {Object.entries(price.byVariant).map(([variant, p]) => (
        <Fragment key={variant}>
          <dt className="text-muted-foreground">{variant}</dt>
          <dd>{one(p)}</dd>
        </Fragment>
      ))}
    </dl>
  )
}

function ControlRow({ control }: { control: ReturnType<typeof controlsOf>[number] }) {
  const values =
    "options" in control
      ? (control.options as readonly string[]).join(", ")
      : "min" in control
        ? `${control.min} to ${control.max}${control.unit ?? ""}`
        : "on or off"
  return (
    <>
      <dt className="text-muted-foreground">{control.label}</dt>
      <dd>{values}</dd>
    </>
  )
}
