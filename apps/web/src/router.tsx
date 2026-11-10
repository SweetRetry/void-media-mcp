import { createRouter } from "@tanstack/react-router"

import { NotFound } from "./components/not-found"
import { routeTree } from "./routeTree.gen"

export function getRouter() {
  return createRouter({
    routeTree,
    defaultPreload: "intent",
    // Retry › First loads: nothing under 300ms, then a skeleton.
    defaultPendingMs: 300,
    defaultNotFoundComponent: NotFound,
    scrollRestoration: true,
  })
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
