import type { ChannelSettings, InputEnvelope } from "../memduck/types";
import type { ChannelCatalogId } from "./catalog";
import type { ChannelRuntimeAdapter } from "./runtime-adapter";
import type { ChannelRuntimeDescriptor } from "./runtime-types";

type TextExtractor = (payload: unknown) => string;
const urlPattern = /^https?:\/\/\S+$/i;

function readPath(payload: unknown, path: string[]): unknown {
  let current = payload;
  for (const key of path) {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function textAt(...paths: string[][]): TextExtractor {
  return (payload) => {
    for (const path of paths) {
      const value = readPath(payload, path);
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
    return "";
  };
}

export function createWebhookRuntimeAdapter(input: {
  descriptor: ChannelRuntimeDescriptor;
  extractText?: TextExtractor;
}): ChannelRuntimeAdapter<Record<string, string>> {
  return {
    descriptor: input.descriptor,
    id: input.descriptor.id,
    parseWebhook(payload: unknown): InputEnvelope | null {
      const text = (input.extractText ?? textAt(["text"], ["content"]))(
        payload,
      );

      if (!text) {
        return null;
      }

      if (urlPattern.test(text)) {
        return {
          kind: "url",
          payload: { url: text },
          requestedDepth: "quick",
          sourceChannel: input.descriptor.id,
        };
      }

      return {
        kind: "text",
        payload: { text },
        requestedDepth: "quick",
        sourceChannel: input.descriptor.id,
      };
    },
    readiness(settings: ChannelSettings) {
      const setting = settings.channels[input.descriptor.id];
      const enabled = Boolean(setting?.enabled);
      const missingFields = input.descriptor.requiredFields.filter(
        (field) => !setting?.values[field]?.trim(),
      );

      return {
        ...input.descriptor,
        enabled,
        missingFields,
        ready: enabled && missingFields.length === 0,
      };
    },
    resolveConfig(settings: ChannelSettings) {
      return settings.channels[input.descriptor.id]?.values ?? {};
    },
  };
}

export const webhookTextExtractors: Partial<
  Record<ChannelCatalogId, TextExtractor>
> = {
  dingtalk: textAt(["text", "content"], ["content"], ["text"]),
  discord: textAt(["content"], ["text"]),
  feishu: textAt(["message", "text"], ["event", "message", "text"], ["text"]),
  slack: textAt(["text"], ["event", "text"]),
};
