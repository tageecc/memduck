import type { ChannelSettings } from "../memduck/service";

export function resolveTelegramRuntimeConfig({
  env,
  settings,
}: {
  env: Record<string, string | undefined>;
  settings: ChannelSettings;
}) {
  return {
    baseUrl:
      env.MEMDUCK_BASE_URL ||
      env.MEMDUCK_API_BASE_URL ||
      settings.telegram.baseUrl,
    token: env.TELEGRAM_BOT_TOKEN || settings.telegram.botToken || "",
  };
}
