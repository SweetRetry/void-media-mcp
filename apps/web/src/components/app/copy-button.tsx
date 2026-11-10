import { Button } from "@workspace/ui/components/button"
import { CheckIcon, CopyIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

/** Copies `text` and confirms in place for a moment. */
export function CopyButton({
  text,
  label = "Copy",
  size = "icon-sm",
}: {
  text: string
  label?: string
  size?: "icon-sm" | "icon"
}) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      variant="ghost"
      size={size}
      aria-label={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } catch {
          toast.error("The clipboard is not available here.")
        }
      }}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </Button>
  )
}
