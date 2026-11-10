/**
 * Upstream shadcn/ui components now import from the `cn` package directly (`shadcn migrate cn`).
 * This file only keeps the public `@workspace/ui/lib/utils` alias that `components.json`
 * resolves as `aliases.utils`. Components don't import through it; don't reimplement merging here.
 */
export { cn } from "cn"
