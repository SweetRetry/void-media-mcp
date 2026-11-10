import { createFileRoute, Link } from "@tanstack/react-router"
import { controlsOf, type MediaModel, models, providerOf } from "@workspace/model-providers"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"

import { Fragment } from "react"

import { CopyButton } from "@/components/app/copy-button"
import { PageHeader } from "@/components/app/page-header"

export const Route = createFileRoute("/_app/models")({
  head: () => ({ meta: [{ title: "Models" }] }),
  component: Models,
})

const KINDS = ["image", "video", "audio"] as const

function Models() {
  return (
    <>
      <PageHeader crumbs={[{ label: "Models" }]} />
      <div className="p-4 lg:p-6">
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
