"use client";

import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CopyIcon,
  PlayIcon,
  PlugIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useEffectEvent, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  ChannelCatalogEntry,
  ChannelCatalogId,
  ChannelField,
} from "@/lib/channels/catalog";
import { channelSaveStatusMessage } from "@/lib/channels/readiness-copy";
import type { ChannelRuntimeReadiness } from "@/lib/channels/runtime-types";
import {
  errorMessageFromJson,
  readErrorMessage,
  readJsonObject,
} from "@/lib/http/response";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type PublicChannelSettings = {
  channels: Record<
    ChannelCatalogId,
    {
      enabled: boolean;
      secrets?: Record<string, boolean>;
      values: Record<string, string>;
    }
  >;
};

type ChannelConnectionStatus = {
  lastHeartbeatAt: string;
  metadata: Record<string, string>;
} | null;

type ChannelCenterPayload = {
  catalog: ChannelCatalogEntry[];
  connectionStatus: Partial<Record<ChannelCatalogId, ChannelConnectionStatus>>;
  runtimeReadiness: Partial<Record<ChannelCatalogId, ChannelRuntimeReadiness>>;
  settings: PublicChannelSettings;
};

type StatusNotice = {
  message: string;
  tone: "error" | "info" | "success";
};

type VisibleChannelCatalogId = Exclude<ChannelCatalogId, "web">;

const CHANNEL_COPY = {
  en: {
    addChannel: "Add channel",
    allAdded: "All added",
    bridgeUrl: "Ingest URL",
    cancel: "Cancel",
    close: "Disabled",
    copied: "Copied",
    copiedNotice: "Copied.",
    copy: "Copy",
    delete: "Delete",
    deleteConfirm: "Delete channel configuration?",
    deleteConfirmButton: "Delete",
    deleteDescription:
      "Deleting this channel disables the input surface and removes it from the channel list.",
    deleting: "Deleting...",
    docs: "Docs",
    enable: "Enabled",
    emptyDescription: "Use the top-right button to add an input surface.",
    emptyTitle: "No channels yet",
    loadingDescription: "Manage external input surfaces and connection state",
    missingFields: "Runtime missing fields",
    nativeRuntime: "Native runtime",
    noMatches: "No matching channels",
    notAdded: "Not added",
    pendingRuntime: "Runtime in progress",
    readyMissingFields: "Complete required fields before testing",
    runtimeNotReady: "This channel runtime is still being integrated",
    savedSecret: "Saved; leave blank to keep unchanged",
    saving: "Saving...",
    save: "Save",
    searchPlaceholder: "Search channels...",
    selectChannel: "Select channel",
    statusConfigured: "Configured",
    statusConnected: "Connected",
    statusNeedsConfig: "Needs config",
    statusTitleError: "Needs attention",
    statusTitleInfo: "Note",
    statusTitleSuccess: "Done",
    subtitle: "Manage external input surfaces and connection state",
    test: "Test ingest",
    title: "Channels",
    webhookRuntime: "Webhook adapter",
  },
  zh: {
    addChannel: "添加渠道",
    allAdded: "全部已添加",
    bridgeUrl: "接入地址",
    cancel: "取消",
    close: "关闭",
    copied: "已复制",
    copiedNotice: "已复制。",
    copy: "复制",
    delete: "删除",
    deleteConfirm: "删除渠道配置？",
    deleteConfirmButton: "确认删除",
    deleteDescription: "删除后会关闭这个输入入口，并从渠道列表中移除。",
    deleting: "删除中...",
    docs: "官方文档",
    enable: "启用",
    emptyDescription: "点击右上角添加一个输入入口。",
    emptyTitle: "还没有渠道",
    loadingDescription: "管理外部输入入口与连接状态",
    missingFields: "运行时缺少字段",
    nativeRuntime: "原生运行时",
    noMatches: "没有匹配的渠道",
    notAdded: "未添加",
    pendingRuntime: "运行时接入中",
    readyMissingFields: "补全必填字段后可测试",
    runtimeNotReady: "该渠道运行时仍在接入中",
    savedSecret: "已保存；留空保持不变",
    saving: "保存中...",
    save: "保存",
    searchPlaceholder: "搜索渠道…",
    selectChannel: "选择渠道",
    statusConfigured: "已配置",
    statusConnected: "已连接",
    statusNeedsConfig: "待配置",
    statusTitleError: "需要处理",
    statusTitleInfo: "提示",
    statusTitleSuccess: "已完成",
    subtitle: "管理外部输入入口与连接状态",
    test: "测试接入",
    title: "渠道",
    webhookRuntime: "Webhook 接入",
  },
} as const;

type ChannelCopy = (typeof CHANNEL_COPY)[keyof typeof CHANNEL_COPY];

const channelLogoSources = {
  bluebubbles: "/channel-logos/bluebubbles.svg",
  discord: "/channel-logos/discord.svg",
  dingtalk: "/channel-logos/dingtalk.svg",
  extension: "/channel-logos/extension.svg",
  feishu: "/channel-logos/feishu.svg",
  googlechat: "/channel-logos/googlechat.svg",
  imessage: "/channel-logos/imessage.svg",
  ios: "/channel-logos/ios.svg",
  irc: "/channel-logos/irc.svg",
  line: "/channel-logos/line.svg",
  matrix: "/channel-logos/matrix.svg",
  mattermost: "/channel-logos/mattermost.svg",
  msteams: "/channel-logos/msteams.svg",
  "nextcloud-talk": "/channel-logos/nextcloud-talk.svg",
  nostr: "/channel-logos/nostr.svg",
  qqbot: "/channel-logos/qqbot.svg",
  signal: "/channel-logos/signal.svg",
  slack: "/channel-logos/slack.svg",
  "synology-chat": "/channel-logos/synology-chat.svg",
  telegram: "/channel-logos/telegram.svg",
  tlon: "/channel-logos/tlon.svg",
  twitch: "/channel-logos/twitch.svg",
  "voice-call": "/channel-logos/voice-call.svg",
  webchat: "/channel-logos/webchat.svg",
  wechat: "/channel-logos/wechat.svg",
  whatsapp: "/channel-logos/whatsapp.svg",
  yuanbao: "/channel-logos/yuanbao.svg",
  zalo: "/channel-logos/zalo.svg",
  zalouser: "/channel-logos/zalouser.svg",
} satisfies Record<VisibleChannelCatalogId, string>;

function ChannelLogo({
  channelId,
  framed = false,
  size = "default",
}: {
  channelId: ChannelCatalogId;
  framed?: boolean;
  size?: "default" | "sm";
}) {
  if (channelId === "web") {
    return null;
  }

  const src = channelLogoSources[channelId];

  if (!src) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          "flex shrink-0 items-center justify-center rounded-md border border-primary/24 bg-primary/10 font-mono font-bold text-primary",
          size === "sm" ? "size-5 text-[0.58rem]" : "size-6 text-[0.68rem]",
        )}
      >
        {channelId.slice(0, 1).toUpperCase()}
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center",
        framed
          ? size === "sm"
            ? "size-8 rounded-lg border bg-card p-1"
            : "size-10 rounded-xl border bg-card p-2 shadow-sm"
          : size === "sm"
            ? "size-5"
            : "size-6",
      )}
    >
      <span
        className={cn("relative block", size === "sm" ? "size-4" : "size-full")}
      >
        <Image
          alt=""
          className="object-contain"
          draggable={false}
          fill
          sizes={size === "sm" ? "16px" : "24px"}
          src={src}
          unoptimized
        />
      </span>
    </span>
  );
}

function statusLabel(
  copy: ChannelCopy,
  enabled: boolean,
  connected?: ChannelConnectionStatus,
  runtime?: ChannelRuntimeReadiness,
) {
  if (!enabled) {
    return copy.notAdded;
  }

  if (runtime && !runtime.ready) {
    return copy.statusNeedsConfig;
  }

  return connected ? copy.statusConnected : copy.statusConfigured;
}

function statusVariant(
  enabled: boolean,
  connected?: ChannelConnectionStatus,
  runtime?: ChannelRuntimeReadiness,
) {
  if (runtime && !runtime.ready) {
    return "outline";
  }

  return enabled || connected ? "secondary" : "outline";
}

function isRuntimeImplemented(runtime?: ChannelRuntimeReadiness) {
  return runtime?.status === "native" || runtime?.status === "webhook-adapter";
}

function inputTypeFor(field: ChannelField) {
  if (field.kind === "password") {
    return "password";
  }

  if (field.kind === "number") {
    return "number";
  }

  if (field.kind === "url") {
    return "url";
  }

  return "text";
}

function isExternalUrl(value: string) {
  return /^https?:\/\//u.test(value);
}

function channelLabel(channel: ChannelCatalogEntry, locale: Locale) {
  if (locale === "en" && channel.id === "dingtalk") {
    return "DingTalk";
  }

  return channel.label;
}

function fieldLabel(
  channel: ChannelCatalogEntry,
  field: ChannelField,
  locale: Locale,
) {
  if (
    locale === "en" &&
    (channel.id === "extension" || channel.id === "telegram") &&
    field.key === "captureBaseUrl"
  ) {
    return "Service URL";
  }

  return field.label;
}

function channelRuntimePriority(runtime?: ChannelRuntimeReadiness) {
  if (runtime?.status === "native") {
    return 0;
  }

  if (runtime?.status === "webhook-adapter") {
    return 1;
  }

  return 2;
}

function statusNoticeTitle(copy: ChannelCopy, tone: StatusNotice["tone"]) {
  switch (tone) {
    case "error":
      return copy.statusTitleError;
    case "success":
      return copy.statusTitleSuccess;
    case "info":
      return copy.statusTitleInfo;
  }
}

export function ChannelCenter({ locale }: { locale: Locale }) {
  const copy = CHANNEL_COPY[locale === "zh" ? "zh" : "en"];
  const [catalog, setCatalog] = useState<ChannelCatalogEntry[]>([]);
  const [settings, setSettings] = useState<PublicChannelSettings | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    Partial<Record<ChannelCatalogId, ChannelConnectionStatus>>
  >({});
  const [runtimeReadiness, setRuntimeReadiness] = useState<
    Partial<Record<ChannelCatalogId, ChannelRuntimeReadiness>>
  >({});
  const [openChannel, setOpenChannel] = useState<ChannelCatalogId | null>(null);
  const [copiedChannel, setCopiedChannel] = useState<ChannelCatalogId | null>(
    null,
  );
  const [channelQuery, setChannelQuery] = useState("");
  const [origin, setOrigin] = useState("");
  const [statusNotice, setStatusNotice] = useState<StatusNotice | null>(null);
  const [pending, setPending] = useState(false);
  const [deleteCandidate, setDeleteCandidate] =
    useState<ChannelCatalogEntry | null>(null);

  const loadChannelCenter = useEffectEvent(async () => {
    setStatusNotice(null);

    try {
      const response = await fetch("/api/settings/channels");
      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "渠道加载失败。"));
      }

      const payload = (await readJsonObject(
        response,
      )) as Partial<ChannelCenterPayload> | null;
      if (
        !payload ||
        !Array.isArray(payload.catalog) ||
        !payload.settings?.channels
      ) {
        throw new Error("渠道加载失败。");
      }

      const addedChannel = payload.catalog.find(
        (channel) =>
          channel.id !== "web" &&
          payload.settings?.channels[channel.id]?.enabled,
      );

      setCatalog(payload.catalog);
      setSettings(payload.settings);
      setConnectionStatus(payload.connectionStatus ?? {});
      setRuntimeReadiness(payload.runtimeReadiness ?? {});
      setOpenChannel(addedChannel?.id ?? null);
    } catch (error) {
      setStatusNotice({
        message: error instanceof Error ? error.message : "渠道加载失败。",
        tone: "error",
      });
    }
  });

  useEffect(() => {
    setOrigin(window.location.origin);
    void loadChannelCenter();
  }, []);

  function updateChannelValue(
    channelId: ChannelCatalogId,
    fieldKey: string,
    value: string,
  ) {
    setSettings((current) => {
      if (!current) {
        return current;
      }

      const existing = current.channels[channelId] ?? {
        enabled: false,
        values: {},
      };

      return {
        ...current,
        channels: {
          ...current.channels,
          [channelId]: {
            ...existing,
            values: {
              ...existing.values,
              [fieldKey]: value,
            },
          },
        },
      };
    });
  }

  function setChannelEnabled(
    current: PublicChannelSettings,
    channel: ChannelCatalogEntry,
    enabled: boolean,
  ) {
    const existing = current.channels[channel.id] ?? {
      enabled: false,
      values: {},
    };
    const defaults = Object.fromEntries(
      channel.fields.map((field) => [field.key, field.defaultValue ?? ""]),
    );

    return {
      ...current,
      channels: {
        ...current.channels,
        [channel.id]: {
          enabled,
          values: {
            ...defaults,
            ...existing.values,
          },
        },
      },
    };
  }

  async function persistSettings(
    nextSettings: PublicChannelSettings,
    statusChannelId?: ChannelCatalogId,
  ) {
    setPending(true);
    setStatusNotice(null);
    const channels = Object.fromEntries(
      Object.entries(nextSettings.channels).map(([channelId, setting]) => {
        const channel = catalog.find((entry) => entry.id === channelId);
        const values = { ...setting.values };

        for (const field of channel?.fields ?? []) {
          if (
            field.secret &&
            setting.secrets?.[field.key] &&
            !values[field.key]
          ) {
            delete values[field.key];
          }
        }

        return [
          channelId,
          {
            enabled: setting.enabled,
            values,
          },
        ];
      }),
    );

    try {
      const response = await fetch("/api/settings/channels", {
        body: JSON.stringify({ channels }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const payload = (await readJsonObject(response)) as
        | (ChannelCenterPayload & { error?: string })
        | { error?: string }
        | null;

      if (!response.ok || !payload || !("settings" in payload)) {
        throw new Error(errorMessageFromJson(payload, "渠道保存失败。"));
      }

      setCatalog(payload.catalog);
      setSettings(payload.settings);
      setConnectionStatus(payload.connectionStatus);
      setRuntimeReadiness(payload.runtimeReadiness);
      setStatusNotice({
        message: channelSaveStatusMessage(
          statusChannelId
            ? payload.runtimeReadiness[statusChannelId]
            : undefined,
        ),
        tone: "success",
      });
      return payload;
    } catch (error) {
      const message = error instanceof Error ? error.message : "渠道保存失败。";
      setStatusNotice({ message, tone: "error" });
      return null;
    } finally {
      setPending(false);
    }
  }

  function addChannel(channel: ChannelCatalogEntry) {
    setSettings((current) => {
      if (!current) {
        return current;
      }

      return setChannelEnabled(current, channel, true);
    });
    setOpenChannel(channel.id);
    setStatusNotice(null);
  }

  function removeChannel(channel: ChannelCatalogEntry) {
    if (!settings) {
      return;
    }

    const nextSettings = setChannelEnabled(settings, channel, false);
    const nextOpen = catalog.find(
      (entry) =>
        entry.id !== "web" &&
        entry.id !== channel.id &&
        nextSettings.channels[entry.id]?.enabled,
    );

    setSettings(nextSettings);
    setOpenChannel(nextOpen?.id ?? null);
    setDeleteCandidate(null);
    void persistSettings(nextSettings);
  }

  async function copyBridgeUrl(channelId: ChannelCatalogId, value: string) {
    setStatusNotice(null);

    try {
      await navigator.clipboard.writeText(value);
      setCopiedChannel(channelId);
      setStatusNotice({ message: copy.copiedNotice, tone: "success" });
      window.setTimeout(() => setCopiedChannel(null), 1600);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setStatusNotice({ message, tone: "error" });
    }
  }

  async function testChannel(channel: ChannelCatalogEntry) {
    if (!settings) {
      return;
    }

    const payload = await persistSettings(settings, channel.id);
    if (!payload) {
      return;
    }

    const readiness = payload.runtimeReadiness[channel.id];
    if (readiness && !isRuntimeImplemented(readiness)) {
      setStatusNotice({
        message: "该渠道运行时仍在接入中，当前只能保存配置。",
        tone: "info",
      });
      return;
    }

    if (!readiness?.ready) {
      setStatusNotice({
        message: readiness?.missingFields.length
          ? `测试前请补全：${readiness.missingFields.join(", ")}。`
          : "测试前请先启用并保存渠道配置。",
        tone: "info",
      });
      return;
    }

    setPending(true);
    setStatusNotice(null);
    try {
      const response = await fetch("/api/channels/heartbeat", {
        body: JSON.stringify({
          channel: channel.id,
          metadata: { source: "ui-test" },
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const heartbeat = (await readJsonObject(response)) as {
        error?: string;
        status?: ChannelConnectionStatus;
      } | null;

      if (!response.ok) {
        throw new Error(errorMessageFromJson(heartbeat, "渠道测试失败。"));
      }

      setConnectionStatus((current) => ({
        ...current,
        [channel.id]: heartbeat?.status ?? null,
      }));
      setStatusNotice({
        message: `${channel.label} 测试通过。`,
        tone: "success",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "渠道测试失败。";
      setStatusNotice({ message, tone: "error" });
    } finally {
      setPending(false);
    }
  }

  if (!settings) {
    return (
      <section className="flex flex-1 flex-col gap-4 p-4">
        <div>
          <h1 className="text-lg font-medium">{copy.title}</h1>
          <p className="text-muted-foreground text-sm">
            {copy.loadingDescription}
          </p>
        </div>
        {statusNotice ? (
          <Alert
            variant={statusNotice.tone === "error" ? "destructive" : "default"}
          >
            <AlertTitle>
              {statusNoticeTitle(copy, statusNotice.tone)}
            </AlertTitle>
            <AlertDescription>{statusNotice.message}</AlertDescription>
          </Alert>
        ) : (
          <Card>
            <CardContent>
              <Skeleton className="h-28 w-full" />
            </CardContent>
          </Card>
        )}
      </section>
    );
  }

  const visibleCatalog = catalog.filter((channel) => channel.id !== "web");
  const addedChannels = visibleCatalog.filter(
    (channel) => settings.channels[channel.id]?.enabled,
  );
  const normalizedChannelQuery = channelQuery.trim().toLocaleLowerCase();
  const availableChannels = visibleCatalog
    .filter((channel) => !settings.channels[channel.id]?.enabled)
    .sort((left, right) => {
      const leftPriority = channelRuntimePriority(runtimeReadiness[left.id]);
      const rightPriority = channelRuntimePriority(runtimeReadiness[right.id]);

      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }

      return channelLabel(left, locale).localeCompare(
        channelLabel(right, locale),
      );
    });
  const filteredAvailableChannels = normalizedChannelQuery
    ? availableChannels.filter((channel) =>
        [channelLabel(channel, locale), channel.id]
          .join(" ")
          .toLocaleLowerCase()
          .includes(normalizedChannelQuery),
      )
    : availableChannels;

  return (
    <section className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg font-medium">{copy.title}</h1>
          <p className="text-muted-foreground text-sm">{copy.subtitle}</p>
        </div>
        <DropdownMenu
          onOpenChange={(open) => {
            if (!open) {
              setChannelQuery("");
            }
          }}
        >
          <DropdownMenuTrigger asChild>
            <Button
              className="h-8 shrink-0 px-3 text-xs"
              size="sm"
              variant="outline"
            >
              <PlusIcon data-icon="inline-start" />
              {copy.addChannel}
              <ChevronDownIcon data-icon="inline-end" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="max-h-[min(26rem,calc(100vh-8rem))] w-[calc(100vw-2rem)] max-w-72 overflow-y-auto"
            sideOffset={8}
          >
            <DropdownMenuLabel>{copy.selectChannel}</DropdownMenuLabel>
            {availableChannels.length > 0 ? (
              <div className="relative px-1 pb-1">
                <SearchIcon className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 size-4 text-muted-foreground" />
                <Input
                  className="h-8 pl-8"
                  onChange={(event) => setChannelQuery(event.target.value)}
                  onKeyDown={(event) => event.stopPropagation()}
                  placeholder={copy.searchPlaceholder}
                  value={channelQuery}
                />
              </div>
            ) : null}
            <DropdownMenuGroup>
              {availableChannels.length > 0 ? (
                filteredAvailableChannels.length > 0 ? (
                  filteredAvailableChannels.map((channel) => (
                    <DropdownMenuItem
                      key={channel.id}
                      onSelect={() => {
                        addChannel(channel);
                        setChannelQuery("");
                      }}
                    >
                      <ChannelLogo channelId={channel.id} size="sm" />
                      {channelLabel(channel, locale)}
                    </DropdownMenuItem>
                  ))
                ) : (
                  <DropdownMenuItem disabled className="text-muted-foreground">
                    {copy.noMatches}
                  </DropdownMenuItem>
                )
              ) : (
                <DropdownMenuItem disabled>{copy.allAdded}</DropdownMenuItem>
              )}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {addedChannels.length === 0 ? (
        <Empty className="min-h-80 border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <PlugIcon />
            </EmptyMedia>
            <EmptyTitle>{copy.emptyTitle}</EmptyTitle>
            <EmptyDescription>{copy.emptyDescription}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex flex-col gap-3">
          {addedChannels.map((channel) => {
            const setting = settings.channels[channel.id];
            const connected = connectionStatus[channel.id];
            const runtime = runtimeReadiness[channel.id];
            const open = openChannel === channel.id;
            const bridgeUrl = origin
              ? `${origin}/api/channels/${channel.id}/ingest`
              : "";

            return (
              <Collapsible key={channel.id} open={open}>
                <Card>
                  <CardHeader>
                    <div className="flex min-w-0 items-center gap-3">
                      <ChannelLogo channelId={channel.id} framed />
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <CardTitle>{channelLabel(channel, locale)}</CardTitle>
                        <Badge
                          variant={statusVariant(
                            Boolean(setting?.enabled),
                            connected,
                            runtime,
                          )}
                        >
                          {statusLabel(
                            copy,
                            Boolean(setting?.enabled),
                            connected,
                            runtime,
                          )}
                        </Badge>
                        {runtime ? (
                          <Badge
                            variant={runtime.ready ? "secondary" : "outline"}
                          >
                            {runtime.status === "native"
                              ? copy.nativeRuntime
                              : runtime.status === "webhook-adapter"
                                ? copy.webhookRuntime
                                : copy.pendingRuntime}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                    <CardAction className="flex items-center gap-1">
                      <Button
                        aria-label={
                          open ? copy.runtimeNotReady : copy.addChannel
                        }
                        onClick={() => setOpenChannel(open ? null : channel.id)}
                        size="icon-sm"
                        type="button"
                        variant="ghost"
                      >
                        {open ? <ChevronUpIcon /> : <ChevronDownIcon />}
                      </Button>
                    </CardAction>
                  </CardHeader>

                  <CollapsibleContent>
                    <CardContent className="pb-5">
                      <FieldGroup>
                        <Field>
                          <FieldLabel htmlFor={`${channel.id}-bridge-url`}>
                            {copy.bridgeUrl}
                          </FieldLabel>
                          <div className="flex gap-2">
                            <Input
                              id={`${channel.id}-bridge-url`}
                              readOnly
                              value={bridgeUrl}
                            />
                            <Button
                              disabled={!bridgeUrl}
                              onClick={() =>
                                copyBridgeUrl(channel.id, bridgeUrl)
                              }
                              size="xs"
                              type="button"
                              variant="secondary"
                            >
                              {copiedChannel === channel.id ? (
                                <CheckIcon data-icon="inline-start" />
                              ) : (
                                <CopyIcon data-icon="inline-start" />
                              )}
                              {copiedChannel === channel.id
                                ? copy.copied
                                : copy.copy}
                            </Button>
                          </div>
                        </Field>

                        {channel.fields.map((field) => {
                          const secretSaved = Boolean(
                            setting?.secrets?.[field.key],
                          );
                          const value = setting?.values[field.key] ?? "";

                          return (
                            <Field key={field.key}>
                              <FieldLabel
                                htmlFor={`${channel.id}-${field.key}`}
                              >
                                {fieldLabel(channel, field, locale)}
                              </FieldLabel>
                              {field.kind === "boolean" ? (
                                <Select
                                  onValueChange={(nextValue) =>
                                    updateChannelValue(
                                      channel.id,
                                      field.key,
                                      nextValue,
                                    )
                                  }
                                  value={value}
                                >
                                  <SelectTrigger
                                    id={`${channel.id}-${field.key}`}
                                  >
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectGroup>
                                      <SelectItem value="true">
                                        {copy.enable}
                                      </SelectItem>
                                      <SelectItem value="false">
                                        {copy.close}
                                      </SelectItem>
                                    </SelectGroup>
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Input
                                  id={`${channel.id}-${field.key}`}
                                  onChange={(event) =>
                                    updateChannelValue(
                                      channel.id,
                                      field.key,
                                      event.target.value,
                                    )
                                  }
                                  placeholder={
                                    secretSaved
                                      ? copy.savedSecret
                                      : fieldLabel(channel, field, locale)
                                  }
                                  type={inputTypeFor(field)}
                                  value={value}
                                />
                              )}
                            </Field>
                          );
                        })}
                        {runtime?.missingFields.length ? (
                          <Field>
                            <FieldLabel>{copy.missingFields}</FieldLabel>
                            <p className="text-muted-foreground text-xs">
                              {runtime.missingFields.join(", ")}
                            </p>
                          </Field>
                        ) : null}
                      </FieldGroup>
                    </CardContent>

                    <CardFooter className="justify-between gap-2 bg-transparent pt-4">
                      <div className="flex items-center gap-3">
                        <Button
                          disabled={pending}
                          onClick={() => persistSettings(settings, channel.id)}
                          size="xs"
                          type="button"
                        >
                          {pending ? copy.saving : copy.save}
                        </Button>
                        <Button
                          disabled={pending || !isRuntimeImplemented(runtime)}
                          onClick={() => testChannel(channel)}
                          size="xs"
                          title={
                            runtime && !isRuntimeImplemented(runtime)
                              ? copy.runtimeNotReady
                              : runtime && !runtime.ready
                                ? copy.readyMissingFields
                                : undefined
                          }
                          type="button"
                          variant="secondary"
                        >
                          <PlayIcon data-icon="inline-start" />
                          {copy.test}
                        </Button>
                        <Link
                          className="text-[0.78rem] text-muted-foreground transition-colors hover:text-foreground hover:underline"
                          href={channel.docsUrl}
                          rel={
                            isExternalUrl(channel.docsUrl)
                              ? "noreferrer"
                              : undefined
                          }
                          target={
                            isExternalUrl(channel.docsUrl)
                              ? "_blank"
                              : undefined
                          }
                        >
                          {copy.docs}
                        </Link>
                      </div>
                      <Button
                        disabled={pending}
                        onClick={() => setDeleteCandidate(channel)}
                        size="xs"
                        type="button"
                        variant="destructive"
                      >
                        <Trash2Icon data-icon="inline-start" />
                        {copy.delete}
                      </Button>
                    </CardFooter>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      )}

      {statusNotice ? (
        <Alert
          variant={statusNotice.tone === "error" ? "destructive" : "default"}
        >
          <AlertTitle>{statusNoticeTitle(copy, statusNotice.tone)}</AlertTitle>
          <AlertDescription>{statusNotice.message}</AlertDescription>
        </Alert>
      ) : null}

      <Dialog
        onOpenChange={(open) => {
          if (!open && !pending) {
            setDeleteCandidate(null);
          }
        }}
        open={Boolean(deleteCandidate)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{copy.deleteConfirm}</DialogTitle>
            <DialogDescription>
              {deleteCandidate
                ? `${copy.delete} ${channelLabel(deleteCandidate, locale)}. ${
                    copy.deleteDescription
                  }`
                : copy.deleteDescription}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              disabled={pending}
              onClick={() => setDeleteCandidate(null)}
              type="button"
              variant="outline"
            >
              {copy.cancel}
            </Button>
            <Button
              disabled={pending || !deleteCandidate}
              onClick={() => {
                if (deleteCandidate) {
                  removeChannel(deleteCandidate);
                }
              }}
              type="button"
              variant="destructive"
            >
              {pending ? copy.deleting : copy.deleteConfirmButton}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
