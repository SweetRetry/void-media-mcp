import "yet-another-react-lightbox/styles.css"

import { type ReactNode, useState } from "react"
import Lightbox from "yet-another-react-lightbox"
import Zoom from "yet-another-react-lightbox/plugins/zoom"

export type PreviewSlide = { src: string; alt: string }

/**
 * Wraps a thumbnail so a click opens the full image over the page instead of in a new tab. The
 * viewer opens on `slides[index]` and steps through the rest with the arrows, the arrow keys or a
 * swipe. It zooms with the wheel, a pinch, a double click or its toolbar, and closes on Escape,
 * the close button or a click on the backdrop.
 */
export function ImagePreview({
  slides,
  index = 0,
  children,
}: {
  slides: PreviewSlide[]
  index?: number
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const single = slides.length < 2
  return (
    <>
      <button
        type="button"
        aria-label="View full size"
        className="block w-full cursor-zoom-in rounded-lg"
        onClick={() => setOpen(true)}
      >
        {children}
      </button>
      <Lightbox
        open={open}
        close={() => setOpen(false)}
        slides={slides}
        index={index}
        plugins={[Zoom]}
        zoom={{ scrollToZoom: true, maxZoomPixelRatio: 3 }}
        carousel={{ finite: true }}
        controller={{ closeOnBackdropClick: true }}
        render={single ? { buttonPrev: () => null, buttonNext: () => null } : undefined}
      />
    </>
  )
}
