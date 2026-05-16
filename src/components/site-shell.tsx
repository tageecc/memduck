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
  SidebarHeader,
  SidebarInset,
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
    <SidebarProvider className="min-h-svh bg-transparent">
      <Sidebar
        className="border-sidebar-border bg-sidebar"
        collapsible="icon"
        variant="sidebar"
      >
        <SidebarHeader className="border-sidebar-border border-b px-3 py-3 group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-3">
          <div className="flex items-center justify-between group-data-[collapsible=icon]:justify-center">
            <div className="flex min-w-0 items-center gap-3 group-data-[collapsible=icon]:hidden">
              <div className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-sidebar-border bg-card">
                <Image
                  alt=""
                  className="object-cover"
                  fill
                  sizes="36px"
                  src="/brand/memduck-logo.png"
                  unoptimized
                />
              </div>
              <div className="min-w-0">
                <span className="block font-medium text-[0.94rem] text-sidebar-foreground leading-none">
                  memduck
                </span>
                <span className="mt-1 block text-[0.65rem] text-sidebar-foreground/48 leading-tight">
                  memory workspace
                </span>
              </div>
            </div>
            <SidebarTrigger className="size-7 shrink-0 rounded-md text-sidebar-foreground/52 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground group-data-[collapsible=icon]:mx-auto" />
          </div>
        </SidebarHeader>
        <SidebarContent className="px-2 py-2">
          <SidebarGroup className="p-0">
            <SidebarGroupContent>
              <SidebarSearchButton />
              <SiteNav items={navItems} />
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="border-sidebar-border border-t px-3 py-3 group-data-[collapsible=icon]:hidden">
          <div className="flex items-center justify-between px-1 text-[0.66rem]">
            <span className="text-[0.68rem] text-sidebar-foreground/45">
              version
            </span>
            <span className="font-mono text-[0.66rem] text-sidebar-foreground/60 tabular-nums">
              v{packageJson.version}
            </span>
          </div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset className="bg-transparent">
        <main className="flex w-full flex-1 flex-col">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
