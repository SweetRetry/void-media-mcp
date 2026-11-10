import { createFileRoute, redirect } from "@tanstack/react-router"

/** Generations is the home page; the bare root sends you there. */
export const Route = createFileRoute("/_app/")({
  beforeLoad: () => {
    throw redirect({ to: "/tasks" })
  },
})
