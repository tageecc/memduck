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
        className="border-sidebar-border/80"
        collapsible="icon"
        variant="sidebar"
      >
        <SidebarHeader className="border-sidebar-border/80 border-b px-3 py-4 group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-3">
          <div className="flex items-center justify-between group-data-[collapsible=icon]:justify-center">
            <div className="flex min-w-0 items-center gap-3 group-data-[collapsible=icon]:hidden">
              <div className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-sidebar-primary/35 bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_0_28px_rgb(117_255_229/0.22)]">
                <span className="absolute inset-x-1 top-1 h-px bg-white/45" />
                <span className="font-mono text-[1rem] font-black leading-none">
                  m
                </span>
              </div>
              <div className="min-w-0">
                <span className="block font-mono text-[0.76rem] font-black text-sidebar-foreground tracking-[0.12em] leading-tight uppercase">
                  memduck
                </span>
                <span className="mt-0.5 block text-[0.62rem] text-sidebar-foreground/45 leading-tight">
                  local memory cockpit
                </span>
              </div>
            </div>
            <SidebarTrigger className="size-7 shrink-0 text-sidebar-foreground/55 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground group-data-[collapsible=icon]:mx-auto" />
          </div>
        </SidebarHeader>
        <SidebarContent className="px-2 py-3">
          <SidebarGroup className="p-0">
            <SidebarGroupContent>
              <SidebarSearchButton />
              <SiteNav items={navItems} />
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="border-sidebar-border/80 border-t px-3 py-3 group-data-[collapsible=icon]:hidden">
          <div className="flex items-center justify-between rounded-md border border-sidebar-border/70 bg-sidebar-accent/45 px-2.5 py-2">
            <span className="font-mono text-[0.58rem] text-sidebar-foreground/38 tracking-[0.18em] uppercase">
              runtime
            </span>
            <span className="font-mono text-[0.62rem] text-sidebar-primary tabular-nums">
              v{packageJson.version}
            </span>
          </div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset className="bg-transparent">
        <main className="mx-auto flex w-full max-w-[1520px] flex-1 flex-col gap-8 p-4 md:p-7 lg:p-9">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
