"use client";

import { SearchIcon } from "lucide-react";

export function SidebarSearchButton() {
  function open() {
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        ctrlKey: true,
        key: "k",
      }),
    );
  }

  return (
    <button
      className="mb-3 flex h-9 w-full items-center gap-2 rounded-lg border border-sidebar-border/80 bg-card/70 px-2.5 text-[0.78rem] text-sidebar-foreground/55 shadow-sm transition-all hover:border-sidebar-border hover:bg-card hover:text-sidebar-foreground group-data-[collapsible=icon]:hidden"
      onClick={open}
      type="button"
    >
      <SearchIcon className="size-3.5 shrink-0 opacity-60" />
      <span className="flex-1 text-left">快速跳转</span>
      <kbd className="rounded-md border border-sidebar-border bg-sidebar-accent px-1.5 py-0.5 font-mono text-[0.58rem] text-sidebar-foreground/55">
        ⌘K
      </kbd>
    </button>
  );
}
