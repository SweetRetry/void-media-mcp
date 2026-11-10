import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"
import { SidebarInset, SidebarProvider } from "@workspace/ui/components/sidebar"
import { TooltipProvider } from "@workspace/ui/components/tooltip"

import { AppSidebar } from "@/components/app/app-sidebar"
import { currentUser } from "@/server/admin.functions"

/** Every admin page: signed in, with the sidebar. */
export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    const user = await currentUser()
    if (!user) throw redirect({ to: "/sign-in" })
    return { user }
  },
  component: AppLayout,
})

function AppLayout() {
  const { user } = Route.useRouteContext()
  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar email={user.email} />
        <SidebarInset>
          <Outlet />
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
