import type { ChannelSettings } from "../memduck/types";
import { type ChannelCatalogId, channelCatalog } from "./catalog";
import type { ChannelRuntimeAdapter } from "./runtime-adapter";
import { createTelegramRuntimeAdapter } from "./runtime-telegram";
import type {
  ChannelRuntimeDescriptor,
  ChannelRuntimeReadiness,
} from "./runtime-types";
import {
  createWebhookRuntimeAdapter,
  webhookTextExtractors,
} from "./runtime-webhook";

const nativeRuntimeIds = new Set<ChannelCatalogId>(["extension", "telegram"]);
const webhookRuntimeIds = new Set<ChannelCatalogId>(
  Object.keys(webhookTextExtractors) as ChannelCatalogId[],
);

const runtimeDescriptors = channelCatalog
  .filter((channel) => channel.id !== "web")
  .map((channel) => ({
    docsUrl: channel.docsUrl,
    id: channel.id,
    mode: channel.connectMode,
    requiredFields: channel.fields
      .filter((field) => field.required)
      .map((field) => field.key),
    status: nativeRuntimeIds.has(channel.id)
      ? "native"
      : webhookRuntimeIds.has(channel.id)
        ? "webhook-adapter"
        : "adapter-planned",
  })) satisfies ChannelRuntimeDescriptor[];

const runtimeDescriptorMap = new Map<
  ChannelCatalogId,
  ChannelRuntimeDescriptor
>(runtimeDescriptors.map((descriptor) => [descriptor.id, descriptor]));
const runtimeAdapters = [
  createTelegramRuntimeAdapter(),
  ...runtimeDescriptors
    .filter((descriptor) => descriptor.status === "webhook-adapter")
    .map((descriptor) =>
      createWebhookRuntimeAdapter({
        descriptor,
        extractText: webhookTextExtractors[descriptor.id],
      }),
    ),
];
const runtimeAdapterMap = new Map<ChannelCatalogId, ChannelRuntimeAdapter>(
  runtimeAdapters.map((adapter) => [adapter.id, adapter]),
);

export function listChannelRuntimeDescriptors(): ChannelRuntimeDescriptor[] {
  return runtimeDescriptors.map((descriptor) => ({
    ...descriptor,
    requiredFields: [...descriptor.requiredFields],
  }));
}

export function getChannelRuntimeDescriptor(
  id: ChannelCatalogId,
): ChannelRuntimeDescriptor | undefined {
  const descriptor = runtimeDescriptorMap.get(id);

  return descriptor
    ? {
        ...descriptor,
        requiredFields: [...descriptor.requiredFields],
      }
    : undefined;
}

export function getChannelRuntimeAdapter(
  id: ChannelCatalogId,
): ChannelRuntimeAdapter | undefined {
  return runtimeAdapterMap.get(id);
}

export function isChannelRuntimeAvailable(
  readiness: Pick<ChannelRuntimeReadiness, "ready" | "status"> | undefined,
) {
  return (
    Boolean(readiness?.ready) &&
    (readiness?.status === "native" || readiness?.status === "webhook-adapter")
  );
}

export function getChannelRuntimeReadiness(
  settings: ChannelSettings,
): Partial<Record<ChannelCatalogId, ChannelRuntimeReadiness>> {
  return Object.fromEntries(
    runtimeDescriptors.map((descriptor) => {
      const setting = settings.channels[descriptor.id];
      const enabled = Boolean(setting?.enabled);
      const missingFields = descriptor.requiredFields.filter(
        (field) => !setting?.values[field]?.trim(),
      );

      return [
        descriptor.id,
        {
          ...descriptor,
          enabled,
          missingFields,
          ready: enabled && missingFields.length === 0,
          requiredFields: [...descriptor.requiredFields],
        },
      ];
    }),
  );
}
