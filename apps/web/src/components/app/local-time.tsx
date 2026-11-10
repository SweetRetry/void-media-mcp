import { useHydrated } from "@tanstack/react-router"

import { dateTime } from "@/lib/format"

/**
 * An absolute time in the viewer's zone. The Worker renders in UTC and does not know that zone, so
 * the server and the first client render both say UTC, and the local time replaces it on hydrate.
 */
export function LocalTime({ iso }: { iso: string }) {
  const hydrated = useHydrated()
  return <time dateTime={iso}>{dateTime(iso, hydrated ? undefined : "UTC")}</time>
}
