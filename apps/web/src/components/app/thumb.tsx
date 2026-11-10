import { FilmIcon, ImageOffIcon, MusicIcon } from "lucide-react"

type Output = { url: string; mime: string }

/**
 * A task's first output as a square. A video or audio output, or a task with none, shows an icon in
 * its place, so a grid of mixed tasks keeps its rhythm.
 */
export function Thumb({
  prompt,
  outputs,
  className,
}: {
  prompt: string
  outputs: Output[]
  className: string
}) {
  const first = outputs[0]
  const Icon = !first ? ImageOffIcon : first.mime.startsWith("video/") ? FilmIcon : MusicIcon
  return (
    <div
      className={`flex items-center justify-center overflow-hidden rounded-lg bg-muted text-muted-foreground ${className}`}
    >
      {first?.mime.startsWith("image/") ? (
        <img src={first.url} alt={prompt} loading="lazy" className="size-full object-cover" />
      ) : (
        <Icon className="size-1/3 max-w-8" aria-hidden />
      )}
    </div>
  )
}
