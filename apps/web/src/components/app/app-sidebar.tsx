import { Link, useNavigate, useRouterState } from "@tanstack/react-router"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@workspace/ui/components/sidebar"
import { BoxesIcon, ListIcon, LogOutIcon, PlugIcon, ReceiptIcon } from "lucide-react"

import { Logo } from "@/components/app/logo"
import { authClient } from "@/lib/auth-client"

const SECTIONS = [
  {
    label: "Activity",
    items: [
      { to: "/tasks", label: "Generations", icon: ListIcon },
      { to: "/costs", label: "Costs", icon: ReceiptIcon },
    ],
  },
  {
    label: "Setup",
    items: [
      { to: "/models", label: "Models", icon: BoxesIcon },
      { to: "/connect", label: "Connect", icon: PlugIcon },
    ],
  },
] as const

export function AppSidebar() {
  const path = useRouterState({ select: (state) => state.location.pathname })
  const navigate = useNavigate()
  // On a phone the sidebar is a drawer; picking a page closes it.
  const { setOpenMobile } = useSidebar()
  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link to="/tasks" onClick={() => setOpenMobile(false)} />}
            >
              <Logo className="size-8" />
              <span className="font-semibold">Obscura</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {SECTIONS.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const active = path.startsWith(item.to)
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        isActive={active}
                        render={<Link to={item.to} onClick={() => setOpenMobile(false)} />}
                      >
                        <item.icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={async () => {
                await authClient.signOut()
                await navigate({ to: "/sign-in" })
              }}
            >
              <LogOutIcon />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
