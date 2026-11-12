import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router"
import { Toaster } from "@workspace/ui/components/sonner"
import { MotionConfig } from "motion/react"
import type { ReactNode } from "react"

import { EASE } from "@/lib/ease"
import appCss from "../styles.css?url"

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Obscura" },
      { name: "robots", content: "noindex" },
    ],
    links: [
      // Retry: Inter with the opsz axis.
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400..600&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      // The mark, hand-painted in atelier (works 009 and 010); the small sizes are drawn heavier.
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32.png" },
      { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon-16.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-192.png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
  }),
  component: () => <Outlet />,
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {/* Retry: one curve and duration for every Motion transition; reduced motion follows the OS. */}
        <MotionConfig reducedMotion="user" transition={{ duration: 0.2, ease: EASE }}>
          {children}
          <Toaster />
        </MotionConfig>
        <Scripts />
      </body>
    </html>
  )
}
