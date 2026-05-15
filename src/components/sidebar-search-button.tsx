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
      className="mb-1 flex h-8 w-full items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 text-[0.75rem] text-sidebar-foreground/50 transition-colors hover:bg-white/10 hover:text-sidebar-foreground/80 group-data-[collapsible=icon]:hidden"
      onClick={open}
      type="button"
    >
      <SearchIcon className="size-3.5 shrink-0 opacity-60" />
      <span className="flex-1 text-left">快速跳转</span>
      <kbd className="rounded bg-white/10 px-1 py-0.5 font-mono text-[0.6rem]">
        ⌘K
      </kbd>
    </button>
  );
}
