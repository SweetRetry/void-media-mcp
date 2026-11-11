import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import {
  controlsOf,
  type MediaModel,
  models,
  defaultsOf,
  type Price,
  type Provider,
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
import { ChevronDownIcon } from "lucide-react"

import { motion } from "motion/react"
import { Fragment, useState } from "react"
import { toast } from "sonner"

import { CopyButton } from "@/components/app/copy-button"
import { PageHeader } from "@/components/app/page-header"
import { modelsPage, switchEntry } from "@/server/admin.functions"
import { quoteOf } from "@/server/generation/pricing"

export const Route = createFileRoute("/_app/models")({
  loader: () => modelsPage(),
  head: () => ({ meta: [{ title: "Models" }] }),
  component: Models,
})

const KINDS = { image: "Image", video: "Video", audio: "Audio" } as const
const ORDER = Object.keys(KINDS)

/*
 * One table, grouped by provider: a provider's switch sits on its group's header row, in the same
 * column as its models' switches, so what it turns off is what sits under it. The row keeps what
 * is compared or switched (name, kind, price in USD, on); settings, inputs and the provider's own
 * price list open under the row.
 */
function Models() {
  const data = Route.useLoaderData()
  const offModels = new Set(data.offModels)
  const offProviders = new Set<string>(data.offProviders)
  const keyless = new Set<string>(data.keyless)
  const [open, setOpen] = useState<string | null>(null)

  return (
    <>
      <PageHeader crumbs={[{ label: "Models" }]} />
      <div className="p-4 lg:p-6">
        {/* Fixed columns: opening a row's details must not move the columns being compared. */}
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead>Model</TableHead>
              {/* Zero-width below sm rather than hidden, so every row keeps four cells and colSpan holds. */}
              <TableHead className="w-0 px-0 sm:w-24 sm:px-2">
                <span className="sr-only sm:not-sr-only">Kind</span>
              </TableHead>
              <TableHead className="w-32 text-right sm:w-56">Price (USD)</TableHead>
              <TableHead className="w-16">On</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {providers.map((provider) => (
              <ProviderRows
                key={provider.id}
                provider={provider}
                providerOff={offProviders.has(provider.id)}
                keyless={keyless.has(provider.id)}
                offModels={offModels}
                open={open}
                onToggle={(id) => setOpen((current) => (current === id ? null : id))}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  )
}

function ProviderRows({
  provider,
  providerOff,
  keyless,
  offModels,
  open,
  onToggle,
}: {
  provider: Provider
  providerOff: boolean
  keyless: boolean
  offModels: Set<string>
  open: string | null
  onToggle: (id: string) => void
}) {
  const own = models
    .filter((model) => model.provider === provider.id)
    .sort((a, b) => ORDER.indexOf(a.modality) - ORDER.indexOf(b.modality))
  return (
    <>
      <TableRow>
        <TableCell className="pt-8 whitespace-normal">
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="font-medium">{provider.name}</span>
            {/* One note at a time: an off provider needs no key warning until it is back on. */}
            {keyless && !providerOff && (
              <span className="inline-flex items-start gap-2 text-warning">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-warning" aria-hidden />
                No API key. Set {provider.keyEnv}.
              </span>
            )}
            {providerOff && (
              <span className="text-muted-foreground">Off. Clients can't use its models.</span>
            )}
          </span>
        </TableCell>
        {/* The same cells as a model row, so the switch lands in the On column at every width. */}
        <TableCell className="px-0 sm:px-2" />
        <TableCell />
        <TableCell className="pt-8">
          <EntrySwitch kind="provider" id={provider.id} name={provider.name} on={!providerOff} />
        </TableCell>
      </TableRow>
      {own.map((model) => (
        <Fragment key={model.id}>
          <TableRow>
            <TableCell className="whitespace-normal">
              {/* The name opens the row's details: settings, inputs and the provider's prices. */}
              <button
                type="button"
                aria-expanded={open === model.id}
                aria-controls={`details-${model.id}`}
                onClick={() => onToggle(model.id)}
                className="inline-flex items-center gap-1 rounded-sm text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {model.name}
                <ChevronDownIcon
                  aria-hidden
                  className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none in-aria-expanded:rotate-180"
                />
              </button>
              {/* Too long to read at phone width; there it opens with the details instead. */}
              <span className="hidden items-center gap-1 sm:flex">
                <ModelId model={model} />
              </span>
            </TableCell>
            <TableCell className="px-0 sm:px-2">
              <span className="sr-only sm:not-sr-only">{KINDS[model.modality]}</span>
            </TableCell>
            <TableCell className="text-right whitespace-normal tabular-nums">
              {priceLine(model)}
            </TableCell>
            <TableCell>
              <EntrySwitch
                kind="model"
                id={model.id}
                name={model.name}
                on={!offModels.has(model.id)}
                held={providerOff}
              />
            </TableCell>
          </TableRow>
          {open === model.id && (
            <TableRow id={`details-${model.id}`}>
              <TableCell colSpan={4} className="whitespace-normal">
                <Details model={model} />
              </TableCell>
            </TableRow>
          )}
        </Fragment>
      ))}
    </>
  )
}

/**
 * What a run costs in USD at the model's defaults, as one figure or the range over the control
 * that sets the price. Video is per second whatever the provider bills (tokens or seconds), so
 * every video model reads in the same unit.
 */
function priceLine(model: MediaModel) {
  const defaults = defaultsOf(model.params)
  const key = model.variant ?? (model.modality === "video" ? "resolution" : "quality")
  const spec = model.params[key]
  const values: (string | undefined)[] = spec && "options" in spec ? [...spec.options] : [undefined]
  // Per second for video; per delivered file otherwise (a Midjourney run is four images).
  const per = model.modality === "video" ? defaults.duration : (model.outputsPerRun ?? 1)
  const usd = values
    .flatMap((value) => {
      const run = quoteOf(model, { ...defaults, ...(value && { [key]: value }) }, 1).usd
      return run === null || !per ? [] : [run / per]
    })
    .sort((x, y) => x - y)
  if (usd.length === 0) return "—"
  const low = usd[0]!
  const high = usd[usd.length - 1]!
  const range = low === high ? dollars(low) : `${dollars(low)}–${dollars(high)}`
  // The unit may wrap under the figure on a narrow screen; the figure itself never breaks.
  return (
    <>
      <span className="whitespace-nowrap">{range}</span>{" "}
      <span className="whitespace-nowrap">/ {UNIT[model.modality]}</span>
    </>
  )
}

const UNIT = { image: "image", video: "s", audio: "track" } as const

/** The id clients pass as `model`, with a copy button. */
function ModelId({ model }: { model: MediaModel }) {
  return (
    <>
      <span className="font-mono text-xs text-muted-foreground">{model.id}</span>
      <CopyButton text={model.id} label={`Copy ${model.name} id`} />
    </>
  )
}

/** Two significant digits under a dollar: one image costs cents, and the range has to fit a row. */
const dollars = (value: number) =>
  value >= 1 ? `$${value.toFixed(2)}` : `$${Number(value.toPrecision(2))}`

const CAPABILITIES: Record<string, string> = {
  "image-edit": "Edits an image",
  "multi-reference": "Several references",
  "mask-edit": "Mask",
  "sequential-images": "Image series",
  "first-frame": "First frame",
  "first-last-frame": "First and last frame",
  "reference-to-video": "Reference images",
  "video-edit": "Edits a video",
  "video-extend": "Extends a video",
  "web-search": "Web search",
}

/** What opens under a row: the settings, what it takes besides a prompt, and the provider's own prices. */
function Details({ model }: { model: MediaModel }) {
  const inputs = model.capabilities.filter((capability) => !capability.startsWith("text-to-"))
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid gap-6 pt-2 pb-4 sm:grid-cols-3"
    >
      <p className="flex items-center gap-1 sm:hidden">
        <ModelId model={model} />
      </p>
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Settings</h3>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          {controlsOf(model.params).map((control) => (
            <Fragment key={control.key}>
              <dt>{control.label}</dt>
              <dd>
                {"options" in control
                  ? (control.options as readonly string[]).join(", ")
                  : "min" in control
                    ? `${control.min} to ${control.max}${control.unit ?? ""}`
                    : "On or off"}
              </dd>
            </Fragment>
          ))}
        </dl>
      </section>
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Takes</h3>
        {inputs.length ? (
          <ul className="flex flex-col gap-1">
            {inputs.map((capability) => (
              <li key={capability}>{CAPABILITIES[capability] ?? capability}</li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">A prompt only</p>
        )}
      </section>
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">List price</h3>
        <ListPrice model={model} />
      </section>
      {/* Acts on the whole model, so it closes the details rather than sitting under one part. */}
      <Link
        to="/tasks"
        search={{ model: model.id }}
        className="text-primary hover:underline sm:col-span-3"
      >
        View its generations
      </Link>
    </motion.div>
  )
}

/** The provider's price as published, in its own currency: what the USD figure was converted from. */
function ListPrice({ model }: { model: MediaModel }) {
  const price = model.price
  if (!price) return <p className="text-muted-foreground">No published price</p>
  if ("tokensOf" in price) return <p>${price.perMillion} per 1M output tokens</p>
  const one = (p: Price) => `${p.currency === "CNY" ? "¥" : "$"}${p.amount} per ${p.per}`
  if (!("byVariant" in price)) return <p>{one(price)}</p>
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
      {Object.entries(price.byVariant).map(([variant, p]) => (
        <Fragment key={variant}>
          <dt>{variant}</dt>
          <dd className="tabular-nums">{one(p)}</dd>
        </Fragment>
      ))}
    </dl>
  )
}

/**
 * Turns a model or provider on or off. Shows the new state at once and rolls back if the save
 * fails, with a toast only then. A model under an off provider keeps showing its own setting,
 * disabled, so turning the provider back on brings back exactly what it shows.
 */
function EntrySwitch({
  kind,
  id,
  name,
  on,
  held = false,
}: {
  kind: "model" | "provider"
  id: string
  name: string
  on: boolean
  held?: boolean
}) {
  const router = useRouter()
  const [pending, setPending] = useState<boolean | null>(null)
  return (
    <span className="inline-flex items-center gap-2">
      <Switch
        checked={pending ?? on}
        disabled={held || pending !== null}
        aria-label={held ? `${name} on (its provider is off)` : `${name} on`}
        onCheckedChange={async (next: boolean) => {
          setPending(next)
          try {
            await switchEntry({ data: { kind, id, on: next } })
            await router.invalidate()
          } catch {
            toast.error(`Could not turn ${name} ${next ? "on" : "off"}. Try again.`)
          } finally {
            setPending(null)
          }
        }}
      />
      {/* The quiet dot DESIGN.md asks of a toggle: shown until the save is confirmed. The slot is
          always there, so the column never shifts. */}
      <span
        aria-hidden
        className={
          pending === null
            ? "invisible size-1.5 rounded-full"
            : "size-1.5 rounded-full bg-muted-foreground motion-safe:animate-pulse"
        }
      />
    </span>
  )
}
