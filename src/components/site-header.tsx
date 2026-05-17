"use client";

import { usePathname } from "next/navigation";

import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

const TITLES: Record<string, string> = {
  "/ask": "Ask",
  "/channels": "Channels",
  "/get-started": "Get Started",
  "/inbox": "Inbox",
  "/memory": "Memory",
  "/models": "Models",
  "/search": "Search",
  "/setup": "Setup",
  "/topics": "Topics",
};

function getTitle(pathname: string) {
  const match = Object.entries(TITLES).find(
    ([href]) => pathname === href || pathname.startsWith(`${href}/`),
  );
  return match?.[1] ?? "memduck";
}

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=offcanvas]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          className="mx-2 data-[orientation=vertical]:h-4"
          orientation="vertical"
        />
        <h1 className="text-base font-medium">{getTitle(pathname)}</h1>
      </div>
    </header>
  );
}
