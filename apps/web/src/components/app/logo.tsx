import { cn } from "@workspace/ui/lib/utils"

/** Obscura's mark, hand-painted in atelier: a dark chamber, and the one point of light let in. */
export function Logo({ className }: { className?: string }) {
  return <img src="/icon-192.png" alt="" className={cn("shrink-0 rounded-lg", className)} />
}
