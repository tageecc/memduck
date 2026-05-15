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
      className="mb-3 flex h-9 w-full items-center gap-2 rounded-md border border-sidebar-border/80 bg-sidebar-accent/42 px-2.5 font-mono text-[0.7rem] font-medium text-sidebar-foreground/55 transition-all hover:border-sidebar-primary/35 hover:bg-sidebar-accent hover:text-sidebar-foreground group-data-[collapsible=icon]:hidden"
      onClick={open}
      type="button"
    >
      <SearchIcon className="size-3.5 shrink-0 opacity-60" />
      <span className="flex-1 text-left">快速跳转</span>
      <kbd className="rounded-[3px] border border-sidebar-border/70 bg-sidebar/70 px-1 py-0.5 text-[0.58rem] text-sidebar-primary">
        ⌘K
      </kbd>
    </button>
  );
}
