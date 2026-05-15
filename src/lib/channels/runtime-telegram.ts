import type { ChannelSettings } from "../memduck/types";
import type { ChannelRuntimeAdapter } from "./runtime-adapter";
import type { ChannelRuntimeDescriptor } from "./runtime-types";
import { resolveTelegramRuntimeConfig } from "./telegram-runtime";

export interface TelegramRuntimeConfig {
  baseUrl: string;
  token: string;
}

export const telegramRuntimeDescriptor: ChannelRuntimeDescriptor = {
  docsUrl: "https://docs.openclaw.ai/channels/telegram",
  id: "telegram",
  mode: "bot-token",
  requiredFields: ["baseUrl", "botToken"],
  status: "native",
};

export function createTelegramRuntimeAdapter(): ChannelRuntimeAdapter<TelegramRuntimeConfig> {
  return {
    descriptor: telegramRuntimeDescriptor,
    id: "telegram",
    readiness(settings) {
      const config = resolveTelegramRuntimeConfig({ env: {}, settings });
      const enabled = Boolean(settings.channels.telegram?.enabled);
      const missingFields = [
        config.baseUrl.trim() ? "" : "baseUrl",
        config.token.trim() ? "" : "botToken",
      ].filter(Boolean);

      return {
        ...telegramRuntimeDescriptor,
        enabled,
        missingFields,
        ready: enabled && missingFields.length === 0,
      };
    },
    resolveConfig(
      settings: ChannelSettings,
      env: Record<string, string | undefined>,
    ) {
      return resolveTelegramRuntimeConfig({ env, settings });
    },
  };
}
