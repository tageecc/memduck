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
    <SidebarProvider className="bg-background">
      <Sidebar collapsible="icon" variant="inset">
        <SidebarHeader className="border-sidebar-border border-b px-3 py-4 group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-3">
          <div className="flex items-center justify-between group-data-[collapsible=icon]:justify-center">
            <div className="flex min-w-0 items-center gap-3 group-data-[collapsible=icon]:hidden">
              {/* logo mark */}
              <div className="relative flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary shadow-[0_0_0_1px_rgba(255,255,255,0.12),inset_0_1px_0_rgba(255,255,255,0.08)]">
                <span className="font-serif text-[1.05rem] font-semibold italic text-sidebar-primary-foreground leading-none">
                  m
                </span>
              </div>
              <div className="min-w-0">
                <span className="block font-sans text-[0.72rem] font-semibold text-sidebar-foreground tracking-wide leading-tight">
                  memduck
                </span>
                <span className="block text-[0.62rem] text-sidebar-foreground/40 leading-tight mt-0.5">
                  知识记忆库
                </span>
              </div>
            </div>
            <SidebarTrigger className="shrink-0 size-7 text-sidebar-foreground/50 hover:bg-white/8 hover:text-sidebar-foreground transition-colors group-data-[collapsible=icon]:mx-auto" />
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
        <SidebarFooter className="border-sidebar-border border-t px-3 py-2.5 group-data-[collapsible=icon]:hidden">
          <span className="font-mono text-[0.6rem] text-sidebar-foreground/30 tabular-nums tracking-wide">
            v{packageJson.version}
          </span>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset className="bg-background md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:border md:peer-data-[variant=inset]:border-border/50 md:peer-data-[variant=inset]:shadow-[0_2px_8px_0_rgb(0_0_0/0.06)]">
        <main className="flex w-full flex-1 flex-col gap-8 p-5 md:p-7 lg:p-10">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
