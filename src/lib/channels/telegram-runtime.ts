import type { ChannelSettings } from "../memduck/service";

export function resolveTelegramRuntimeConfig({
  env,
  settings,
}: {
  env: Record<string, string | undefined>;
  settings: ChannelSettings;
}) {
  const envBaseUrl = env.MEMDUCK_BASE_URL?.trim();
  const envToken = env.TELEGRAM_BOT_TOKEN?.trim();
  const channelBaseUrl = settings.telegram.baseUrl.trim();
  const channelToken = settings.telegram.botToken?.trim();

  return {
    baseUrl: envBaseUrl ? envBaseUrl : channelBaseUrl,
    token: envToken ? envToken : (channelToken ?? ""),
  };
}
