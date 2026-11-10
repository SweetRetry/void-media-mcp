import * as React from "react"
import { cn } from "cn"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-lg border border-input bg-muted px-2.5 py-2 text-base transition-colors outline-none placeholder:text-subtle-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring-soft disabled:cursor-not-allowed disabled:bg-surface-1 disabled:text-subtle-foreground aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
