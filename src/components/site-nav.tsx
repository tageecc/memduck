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
    <SidebarMenu className="gap-0.5">
      {items.map((item) => {
        const active = isActivePath(pathname, item.href);
        const Icon = navIcons[item.icon];

        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              asChild
              className={cn(
                "h-[2.1rem] rounded-md border border-transparent px-2.5 text-[0.8rem] font-medium text-sidebar-foreground/60 transition-all duration-100",
                "hover:bg-white/7 hover:text-sidebar-foreground/85",
                "data-[active=true]:border-sidebar-border/40 data-[active=true]:bg-white/[0.09] data-[active=true]:font-semibold data-[active=true]:text-sidebar-foreground",
                "data-[active=true]:shadow-[inset_2.5px_0_0_0_var(--sidebar-primary)]",
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
