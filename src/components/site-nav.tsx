"use client";

import {
  BotIcon,
  DatabaseIcon,
  type LucideIcon,
  PlugIcon,
  SearchIcon,
  SettingsIcon,
  SlidersHorizontalIcon,
  TagsIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  icon: keyof typeof navIcons;
  label: string;
};

const navIcons = {
  agent: BotIcon,
  channels: PlugIcon,
  memories: DatabaseIcon,
  models: SlidersHorizontalIcon,
  search: SearchIcon,
  setup: SettingsIcon,
  topics: TagsIcon,
} satisfies Record<string, LucideIcon>;

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <SidebarMenu className="gap-1.5">
      {items.map((item) => {
        const active = isActivePath(pathname, item.href);
        const Icon = navIcons[item.icon];

        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              asChild
              className={cn(
                "h-9 rounded-md border border-transparent px-2.5 font-mono text-[0.72rem] font-semibold tracking-[0.05em] text-sidebar-foreground/58 transition-all duration-150",
                "hover:border-sidebar-border/75 hover:bg-sidebar-accent/68 hover:text-sidebar-foreground",
                "data-[active=true]:border-sidebar-primary/34 data-[active=true]:bg-sidebar-primary/12 data-[active=true]:text-sidebar-primary",
                "data-[active=true]:shadow-[inset_2.5px_0_0_0_var(--sidebar-primary),0_0_26px_rgb(117_255_229/0.08)]",
              )}
              isActive={active}
              size="default"
              tooltip={item.label}
            >
              <Link aria-current={active ? "page" : undefined} href={item.href}>
                <Icon className="opacity-90" />
                <span>{item.label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}
