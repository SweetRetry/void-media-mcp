import { Link, useNavigate, useRouterState } from "@tanstack/react-router"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
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
import {
  BoxesIcon,
  ChevronsUpDownIcon,
  ListIcon,
  LogOutIcon,
  PlugIcon,
  ReceiptIcon,
  SparklesIcon,
} from "lucide-react"

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

export function AppSidebar({ email }: { email: string }) {
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
              <SparklesIcon />
              <span className="font-semibold">Void Media</span>
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
            <DropdownMenu>
              <DropdownMenuTrigger render={<SidebarMenuButton size="lg" />}>
                <span className="truncate">{email}</span>
                <ChevronsUpDownIcon className="ml-auto" />
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start">
                <DropdownMenuItem
                  onClick={async () => {
                    await authClient.signOut()
                    await navigate({ to: "/sign-in" })
                  }}
                >
                  <LogOutIcon />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
