import "yet-another-react-lightbox/styles.css"

import { type ReactNode, useState } from "react"
import Lightbox, { type GenericSlide, type Slide } from "yet-another-react-lightbox"
import Video from "yet-another-react-lightbox/plugins/video"
import Zoom from "yet-another-react-lightbox/plugins/zoom"

declare module "yet-another-react-lightbox" {
  interface SlideAudio extends GenericSlide {
    type: "audio"
    src: string
  }
  interface SlideTypes {
    audio: SlideAudio
  }
}

export type PreviewMedia = { url: string; mime: string; alt: string }

function slideOf({ url, mime, alt }: PreviewMedia): Slide {
  if (mime.startsWith("video/"))
    return {
      type: "video",
      sources: [{ src: url, type: mime }],
      controls: true,
      autoPlay: true,
      playsInline: true,
    }
  if (mime.startsWith("audio/")) return { type: "audio", src: url }
  return { src: url, alt }
}

/**
 * Wraps a thumbnail so a click opens the image, video or audio over the page instead of in a new
 * tab. The viewer opens on `media[index]` and steps through the rest with the arrows, the arrow
 * keys or a swipe. Images zoom with the wheel, a pinch, a double click or the toolbar; video and
 * audio start playing with the browser's own controls. Escape, the close button or a click on the
 * backdrop closes it.
 */
export function MediaPreview({
  media,
  index = 0,
  label = "View full size",
  children,
}: {
  media: PreviewMedia[]
  index?: number
  label?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const single = media.length < 2
  return (
    <>
      <button
        type="button"
        aria-label={label}
        className="block w-full cursor-zoom-in rounded-lg"
        onClick={() => setOpen(true)}
      >
        {children}
      </button>
      <Lightbox
        open={open}
        close={() => setOpen(false)}
        slides={media.map(slideOf)}
        index={index}
        plugins={[Video, Zoom]}
        zoom={{ scrollToZoom: true, maxZoomPixelRatio: 3 }}
        carousel={{ finite: true }}
        controller={{ closeOnBackdropClick: true }}
        render={{
          slide: ({ slide, offset }) =>
            slide.type === "audio" ? (
              <audio src={slide.src} controls autoPlay={offset === 0}>
                <track kind="captions" />
              </audio>
            ) : undefined,
          ...(single && { buttonPrev: () => null, buttonNext: () => null }),
        }}
      />
    </>
  )
}
