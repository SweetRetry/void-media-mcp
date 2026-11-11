import { modelOf } from "@workspace/model-providers"

/** Dollars at list price. Sub-dollar amounts keep four places, since one image costs cents. */
export const usd = (value: number | null | undefined) =>
  value === null || value === undefined
    ? "—"
    : `$${value.toFixed(value !== 0 && Math.abs(value) < 1 ? 4 : 2)}`

/** The pages are in English, so dates are too, whatever the browser locale. */
const LOCALE = "en-US"

const relative = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" })
const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 86_400_000],
  ["month", 30 * 86_400_000],
  ["week", 7 * 86_400_000],
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
]

/**
 * `3 minutes ago`. Relative on purpose: it reads the same in the Worker (UTC) and the browser, so
 * server-rendered text hydrates without a mismatch. Absolute times go through `<LocalTime>`.
 */
export function ago(iso: string, now = Date.now()) {
  const ms = new Date(iso).getTime() - now
  for (const [unit, size] of STEPS)
    if (Math.abs(ms) >= size) return relative.format(Math.round(ms / size), unit)
  return "just now"
}

export const bytes = (n: number) =>
  n >= 1_048_576 ? `${(n / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`

/** A date and time in `timeZone`, or the runtime's own zone when none is given. */
export const dateTime = (iso: string, timeZone?: string) =>
  new Date(iso).toLocaleString(LOCALE, { timeZone, timeZoneName: timeZone ? "short" : undefined })

export const runs = (n: number) => `${n} ${n === 1 ? "run" : "runs"}`

/** A model's display name from the catalog; an id that left the catalog shows as itself. */
export const modelName = (id: string) => modelOf(id)?.name ?? id
