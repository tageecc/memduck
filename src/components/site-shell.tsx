import type { CSSProperties, PropsWithChildren } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
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
  const pageTitles = {
    "/ask": copy.shell.nav.agent,
    "/channels": copy.shell.nav.channels,
    "/get-started": copy.getStarted.introEyebrow,
    "/inbox": copy.shell.nav.memories,
    "/memory": copy.shell.nav.memories,
    "/models": copy.shell.nav.models,
    "/search": copy.shell.nav.search,
    "/setup": copy.shell.nav.setup,
    "/topics": copy.shell.nav.topics,
  };

  return (
    <SidebarProvider
      style={
        {
          "--header-height": "calc(var(--spacing) * 12)",
          "--sidebar-width": "calc(var(--spacing) * 72)",
        } as CSSProperties
      }
    >
      <AppSidebar
        items={navItems}
        quickJumpLabel={copy.shell.quickJump}
        subtitle={copy.shell.subtitle}
        versionLabel={copy.shell.version}
        variant="inset"
        version={packageJson.version}
      />
      <SidebarInset>
        <SiteHeader titles={pageTitles} />
        <main className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col">{children}</div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
