"use client";

import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CopyIcon,
  PlayIcon,
  PlugIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useEffectEvent, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
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
import type { ChannelRuntimeReadiness } from "@/lib/channels/runtime-types";
import {
  errorMessageFromJson,
  readErrorMessage,
  readJsonObject,
} from "@/lib/http/response";
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

type VisibleChannelCatalogId = Exclude<ChannelCatalogId, "web">;

const channelLogoSources = {
  bluebubbles: "/channel-logos/bluebubbles.svg",
  discord: "/channel-logos/discord.svg",
  dingtalk: "/channel-logos/dingtalk.svg",
  extension: "/channel-logos/extension.svg",
  feishu: "/channel-logos/feishu.svg",
  googlechat: "/channel-logos/googlechat.svg",
  imessage: "/channel-logos/imessage.svg",
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
  enabled: boolean,
  connected?: ChannelConnectionStatus,
  runtime?: ChannelRuntimeReadiness,
) {
  if (!enabled) {
    return "未添加";
  }

  if (runtime && !runtime.ready) {
    return "待配置";
  }

  return connected ? "已连接" : "已配置";
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

export function ChannelCenter() {
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
  const [origin, setOrigin] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [deleteCandidate, setDeleteCandidate] =
    useState<ChannelCatalogEntry | null>(null);

  const loadChannelCenter = useEffectEvent(async () => {
    setStatusMessage(null);

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
      setStatusMessage(
        error instanceof Error ? error.message : "渠道加载失败。",
      );
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

  async function persistSettings(nextSettings: PublicChannelSettings) {
    setPending(true);
    setStatusMessage(null);
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
      setStatusMessage("已保存。");
      return payload;
    } catch (error) {
      const message = error instanceof Error ? error.message : "渠道保存失败。";
      setStatusMessage(message);
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
    setStatusMessage(null);
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
    setStatusMessage(null);

    try {
      await navigator.clipboard.writeText(value);
      setCopiedChannel(channelId);
      setStatusMessage("已复制。");
      window.setTimeout(() => setCopiedChannel(null), 1600);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setStatusMessage(message);
    }
  }

  async function testChannel(channel: ChannelCatalogEntry) {
    if (!settings) {
      return;
    }

    const payload = await persistSettings(settings);
    if (!payload) {
      return;
    }

    const readiness = payload.runtimeReadiness[channel.id];
    if (!readiness?.ready) {
      setStatusMessage(
        readiness?.missingFields.length
          ? `测试前请补全：${readiness.missingFields.join(", ")}。`
          : "测试前请先启用并保存渠道配置。",
      );
      return;
    }

    setPending(true);
    setStatusMessage(null);
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
      setStatusMessage(`${channel.label} 测试通过。`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "渠道测试失败。";
      setStatusMessage(message);
    } finally {
      setPending(false);
    }
  }

  if (!settings) {
    return (
      <section className="flex flex-1 flex-col gap-4 p-4">
        <div>
          <h1 className="text-lg font-medium">渠道</h1>
          <p className="text-muted-foreground text-sm">
            管理外部输入入口与连接状态
          </p>
        </div>
        {statusMessage ? (
          <Alert variant="destructive">
            <AlertDescription>{statusMessage}</AlertDescription>
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
  const availableChannels = visibleCatalog.filter(
    (channel) => !settings.channels[channel.id]?.enabled,
  );

  return (
    <section className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-medium">渠道</h1>
          <p className="text-muted-foreground text-sm">
            管理外部输入入口与连接状态
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              className="h-8 shrink-0 px-3 text-xs"
              size="sm"
              variant="outline"
            >
              <PlusIcon data-icon="inline-start" />
              添加渠道
              <ChevronDownIcon data-icon="inline-end" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel>选择渠道</DropdownMenuLabel>
            <DropdownMenuGroup>
              {availableChannels.length > 0 ? (
                availableChannels.map((channel) => (
                  <DropdownMenuItem
                    key={channel.id}
                    onSelect={() => addChannel(channel)}
                  >
                    <ChannelLogo channelId={channel.id} size="sm" />
                    {channel.label}
                  </DropdownMenuItem>
                ))
              ) : (
                <DropdownMenuItem disabled>全部已添加</DropdownMenuItem>
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
            <EmptyTitle>还没有渠道</EmptyTitle>
            <EmptyDescription>点击右上角添加一个输入入口。</EmptyDescription>
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
                        <CardTitle>{channel.label}</CardTitle>
                        <Badge
                          variant={statusVariant(
                            Boolean(setting?.enabled),
                            connected,
                            runtime,
                          )}
                        >
                          {statusLabel(
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
                              ? "原生运行时"
                              : runtime.status === "webhook-adapter"
                                ? "Webhook 接入"
                                : "运行时接入中"}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                    <CardAction className="flex items-center gap-1">
                      <Button
                        aria-label={open ? "收起渠道配置" : "展开渠道配置"}
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
                            接入地址
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
                              {copiedChannel === channel.id ? "已复制" : "复制"}
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
                                {field.label}
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
                                      <SelectItem value="true">启用</SelectItem>
                                      <SelectItem value="false">
                                        关闭
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
                                      ? "已保存；留空保持不变"
                                      : field.label
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
                            <FieldLabel>运行时缺少字段</FieldLabel>
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
                          onClick={() => persistSettings(settings)}
                          size="xs"
                          type="button"
                        >
                          {pending ? "保存中..." : "保存"}
                        </Button>
                        <Button
                          disabled={pending}
                          onClick={() => testChannel(channel)}
                          size="xs"
                          type="button"
                          variant="secondary"
                        >
                          <PlayIcon data-icon="inline-start" />
                          测试接入
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
                          官方文档
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
                        删除
                      </Button>
                    </CardFooter>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      )}

      {statusMessage ? (
        <Alert>
          <AlertDescription>{statusMessage}</AlertDescription>
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
            <DialogTitle>删除渠道配置？</DialogTitle>
            <DialogDescription>
              {deleteCandidate
                ? `删除 ${deleteCandidate.label} 后会关闭这个输入入口，并从渠道列表中移除。`
                : "删除后会关闭这个输入入口，并从渠道列表中移除。"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              disabled={pending}
              onClick={() => setDeleteCandidate(null)}
              type="button"
              variant="outline"
            >
              取消
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
              {pending ? "删除中..." : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
