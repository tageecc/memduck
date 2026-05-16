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
    <SidebarMenu>
      {items.map((item) => {
        const active = isActivePath(pathname, item.href);
        const Icon = navIcons[item.icon];

        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              asChild
              isActive={active}
              size="default"
              tooltip={item.label}
            >
              <Link aria-current={active ? "page" : undefined} href={item.href}>
                <Icon />
                <span>{item.label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}
