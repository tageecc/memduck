"use client";

import {
  BotIcon,
  DatabaseIcon,
  DownloadIcon,
  LinkIcon,
  PlugIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  SlidersHorizontalIcon,
  TagsIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import type { MemoryCard } from "@/lib/memduck/service";

const NAV_COMMANDS = [
  { href: "/ask", icon: BotIcon, label: "Agent 对话", shortcut: "G A" },
  { href: "/inbox", icon: DatabaseIcon, label: "记忆收件箱", shortcut: "G I" },
  { href: "/search", icon: SearchIcon, label: "语义搜索", shortcut: "G S" },
  { href: "/topics", icon: TagsIcon, label: "主题", shortcut: "G T" },
  {
    href: "/models",
    icon: SlidersHorizontalIcon,
    label: "模型配置",
    shortcut: "G M",
  },
  { href: "/channels", icon: PlugIcon, label: "渠道配置", shortcut: "G C" },
  { href: "/setup", icon: SettingsIcon, label: "设置", shortcut: "G ," },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [recentCards, setRecentCards] = useState<MemoryCard[]>([]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    void fetch("/api/memory-cards?limit=8")
      .then((r) => r.json() as Promise<MemoryCard[]>)
      .then((cards) => setRecentCards(cards.slice(0, 8)))
      .catch(() => {});
  }, [open]);

  function run(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  const filteredCards = query
    ? recentCards.filter(
        (c) =>
          c.title.toLowerCase().includes(query.toLowerCase()) ||
          c.summary.toLowerCase().includes(query.toLowerCase()),
      )
    : recentCards;

  return (
    <CommandDialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setQuery("");
      }}
      title="命令面板"
      description="跳转页面或搜索记忆"
    >
      <CommandInput
        placeholder="跳转页面、搜索记忆…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>没有匹配项。</CommandEmpty>

        <CommandGroup heading="导航">
          {NAV_COMMANDS.map((cmd) => (
            <CommandItem key={cmd.href} onSelect={() => run(cmd.href)}>
              <cmd.icon className="text-muted-foreground" />
              {cmd.label}
              <CommandShortcut>{cmd.shortcut}</CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="快捷操作">
          <CommandItem onSelect={() => run("/ask?q=")}>
            <PlusIcon className="text-muted-foreground" />
            新建对话
          </CommandItem>
          <CommandItem onSelect={() => run("/search")}>
            <SearchIcon className="text-muted-foreground" />
            语义搜索
          </CommandItem>
          <CommandItem
            onSelect={() => {
              setOpen(false);
              void fetch("/api/export")
                .then((r) => r.blob())
                .then((blob) => {
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `memduck-export-${new Date().toISOString().slice(0, 10)}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                });
            }}
          >
            <DownloadIcon className="text-muted-foreground" />
            导出全部记忆
          </CommandItem>
        </CommandGroup>

        {filteredCards.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={query ? "记忆搜索" : "最近记忆"}>
              {filteredCards.map((card) => (
                <CommandItem
                  key={card.id}
                  onSelect={() => run(`/memory/${card.id}`)}
                >
                  <LinkIcon className="text-muted-foreground" />
                  <span className="truncate">{card.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
