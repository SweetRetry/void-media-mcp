import { createFileRoute, Link } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group"
import { ImageOffIcon, PlayIcon } from "lucide-react"
import { z } from "zod"

import { PageHeader } from "@/components/app/page-header"
import { galleryPage } from "@/server/admin.functions"

const MODALITIES = ["image", "video", "audio"] as const

export const Route = createFileRoute("/_app/gallery")({
  validateSearch: z.object({
    modality: z.enum(MODALITIES).optional(),
    page: z.number().int().min(1).optional(),
  }),
  loaderDeps: ({ search }) => ({ modality: search.modality, page: search.page ?? 1 }),
  loader: ({ deps }) => galleryPage({ data: deps }),
  head: () => ({ meta: [{ title: "Gallery" }] }),
  component: Gallery,
})

function Gallery() {
  const { items, hasMore } = Route.useLoaderData()
  const { modality, page } = Route.useLoaderDeps()
  const navigate = Route.useNavigate()

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Gallery" }]}
        actions={
          <ToggleGroup
            variant="outline"
            size="sm"
            value={[modality ?? "all"]}
            onValueChange={(value: string[]) => {
              const next = value[0]
              if (!next) return
              void navigate({
                search: {
                  modality: next === "all" ? undefined : (next as (typeof MODALITIES)[number]),
                },
              })
            }}
            aria-label="Kind"
          >
            <ToggleGroupItem value="all">All</ToggleGroupItem>
            {MODALITIES.map((kind) => (
              <ToggleGroupItem key={kind} value={kind}>
                {kind[0]!.toUpperCase() + kind.slice(1)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        }
      />
      <div className="flex flex-col gap-4 p-4">
        {items.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ImageOffIcon />
              </EmptyMedia>
              <EmptyTitle>Nothing here yet</EmptyTitle>
              <EmptyDescription>Delivered outputs show up here.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {items.map((item) => (
              <li key={item.url}>
                <Link
                  to="/tasks/$taskId"
                  params={{ taskId: item.taskId }}
                  className="group relative block aspect-square overflow-hidden rounded-lg bg-muted"
                  title={item.prompt}
                >
                  {item.mime.startsWith("image/") ? (
                    <img
                      src={item.url}
                      alt={item.prompt}
                      loading="lazy"
                      className="size-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : item.mime.startsWith("video/") ? (
                    <>
                      <video
                        src={item.url}
                        muted
                        preload="metadata"
                        className="size-full object-cover"
                      />
                      <PlayIcon className="absolute inset-0 m-auto size-8 text-foreground" />
                    </>
                  ) : (
                    <span className="flex size-full items-center justify-center text-sm text-muted-foreground">
                      {item.mime}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
        {(page > 1 || hasMore) && (
          <div className="flex justify-center gap-2">
            <Button
              variant="ghost"
              disabled={page <= 1}
              onClick={() => navigate({ search: { modality, page: page - 1 } })}
            >
              Newer
            </Button>
            <Button
              variant="ghost"
              disabled={!hasMore}
              onClick={() => navigate({ search: { modality, page: page + 1 } })}
            >
              Older
            </Button>
          </div>
        )}
      </div>
    </>
  )
}
