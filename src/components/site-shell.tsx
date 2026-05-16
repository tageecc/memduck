import Image from "next/image";
import type { PropsWithChildren } from "react";

import { SidebarSearchButton } from "@/components/sidebar-search-button";
import { SiteNav } from "@/components/site-nav";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { getLocaleContext } from "@/lib/i18n-server";

import packageJson from "../../package.json";

const NAV_ITEMS = [
  { href: "/ask", icon: "agent", key: "agent" },
  { href: "/inbox", icon: "memories", key: "memories" },
  { href: "/topics", icon: "topics", key: "topics" },
  { href: "/search", icon: "search", key: "search" },
  { href: "/models", icon: "models", key: "models" },
  { href: "/channels", icon: "channels", key: "channels" },
  { href: "/setup", icon: "setup", key: "setup" },
] as const;

export async function SiteShell({ children }: PropsWithChildren) {
  const { copy } = await getLocaleContext();
  const navItems = NAV_ITEMS.map((item) => ({
    href: item.href,
    icon: item.icon,
    label: copy.shell.nav[item.key],
  }));

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
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
                    memory workspace
                  </span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarSearchButton />
              <SiteNav items={navItems} />
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <div className="flex items-center justify-between px-2 text-xs group-data-[collapsible=icon]:hidden">
            <span className="text-muted-foreground">version</span>
            <span className="font-mono text-muted-foreground tabular-nums">
              v{packageJson.version}
            </span>
          </div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
        </header>
        <main className="flex w-full flex-1 flex-col">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
