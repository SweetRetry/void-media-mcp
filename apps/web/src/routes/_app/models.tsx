import { createFileRoute, Link } from "@tanstack/react-router"
import { controlsOf, type MediaModel, models, providerOf } from "@workspace/model-providers"
import { Badge } from "@workspace/ui/components/badge"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"

import { CopyButton } from "@/components/app/copy-button"
import { PageHeader } from "@/components/app/page-header"

export const Route = createFileRoute("/_app/models")({
  head: () => ({ meta: [{ title: "Models" }] }),
  component: Models,
})

const KINDS = ["image", "video", "audio"] as const

/** The list price as the provider publishes it, in its own currency. */
function priceText(model: MediaModel) {
  const price = model.price
  if (!price) return "Unpublished"
  if ("tokensOf" in price) return `$${price.perMillion} per 1M output tokens`
  const one = (p: { amount: number; currency: string; per: string }) =>
    `${p.currency === "CNY" ? "¥" : "$"}${p.amount} per ${p.per}`
  if ("byVariant" in price)
    return Object.entries(price.byVariant)
      .map(([variant, p]) => `${variant}: ${one(p)}`)
      .join(", ")
  return one(price)
}

function Models() {
  return (
    <>
      <PageHeader crumbs={[{ label: "Models" }]} />
      <div className="p-4">
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
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {models
                  .filter((model) => model.modality === kind)
                  .map((model) => (
                    <Card key={model.id}>
                      <CardHeader>
                        <CardTitle>{model.name}</CardTitle>
                        <CardDescription className="font-mono text-xs">{model.id}</CardDescription>
                        <CardAction>
                          <CopyButton text={model.id} label="Copy model id" />
                        </CardAction>
                      </CardHeader>
                      <CardContent className="flex flex-col gap-3">
                        <div className="flex flex-wrap gap-1">
                          {model.capabilities.map((capability) => (
                            <Badge key={capability} variant="outline">
                              {capability}
                            </Badge>
                          ))}
                        </div>
                        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                          <dt className="text-muted-foreground">Provider</dt>
                          <dd>{providerOf(model.provider).name}</dd>
                          <dt className="text-muted-foreground">Price</dt>
                          <dd>{priceText(model)}</dd>
                          {controlsOf(model.params).map((control) => (
                            <ControlRow key={control.key} control={control} />
                          ))}
                        </dl>
                        <Link
                          to="/tasks"
                          search={{ model: model.id }}
                          className="text-sm text-primary hover:underline"
                        >
                          Its generations
                        </Link>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </>
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
      <dd>
        {values}
        <span className="text-muted-foreground"> (default {String(control.default)})</span>
      </dd>
    </>
  )
}
