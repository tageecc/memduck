import Image from "next/image";

import { SidebarSearchButton } from "@/components/sidebar-search-button";
import { type NavItem, SiteNav } from "@/components/site-nav";
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
  SidebarRail,
} from "@/components/ui/sidebar";

export function AppSidebar({
  items,
  quickJumpLabel,
  subtitle,
  versionLabel,
  version,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  items: NavItem[];
  quickJumpLabel: string;
  subtitle: string;
  versionLabel: string;
  version: string;
}) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg">
              <div className="relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg">
                <Image
                  alt=""
                  className="object-cover"
                  fill
                  sizes="32px"
                  src="/brand/memduck-logo.png"
                  unoptimized
                />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">memduck</span>
                <span className="truncate text-xs text-muted-foreground">
                  {subtitle}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent className="flex flex-col gap-2">
            <SidebarSearchButton label={quickJumpLabel} />
            <SiteNav items={items} />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton>
              <span>{versionLabel}</span>
              <span className="ml-auto font-mono text-muted-foreground tabular-nums">
                v{version}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
