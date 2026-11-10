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
  },
  component: AppLayout,
})

function AppLayout() {
  return (
    <TooltipProvider>
      {/* Always open on desktop; on a phone the sidebar is a drawer behind the header button. */}
      <SidebarProvider open onOpenChange={() => {}}>
        <AppSidebar />
        <SidebarInset>
          <Outlet />
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
