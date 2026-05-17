export const channelCatalogIds = [
  "web",
  "extension",
  "bluebubbles",
  "discord",
  "dingtalk",
  "feishu",
  "googlechat",
  "imessage",
  "irc",
  "line",
  "matrix",
  "mattermost",
  "msteams",
  "nextcloud-talk",
  "nostr",
  "qqbot",
  "signal",
  "slack",
  "synology-chat",
  "telegram",
  "tlon",
  "twitch",
  "voice-call",
  "webchat",
  "wechat",
  "whatsapp",
  "yuanbao",
  "zalo",
  "zalouser",
] as const;

export type ChannelCatalogId = (typeof channelCatalogIds)[number];

export type ChannelFieldKind =
  | "boolean"
  | "number"
  | "password"
  | "text"
  | "url";

export type ChannelField = {
  defaultValue?: string;
  key: string;
  kind: ChannelFieldKind;
  label: string;
  required?: boolean;
  secret?: boolean;
};

export type ChannelCatalogEntry = {
  category: "built-in" | "external" | "local" | "plugin";
  connectMode:
    | "bot-token"
    | "cli"
    | "gateway-webhook"
    | "local"
    | "oauth"
    | "qr"
    | "webhook";
  docsUrl: string;
  fields: ChannelField[];
  id: ChannelCatalogId;
  label: string;
};

const openClawDocsBase = "https://docs.openclaw.ai";

export const channelCatalog: ChannelCatalogEntry[] = [
  {
    category: "local",
    connectMode: "local",
    docsUrl: "/ask",
    fields: [],
    id: "web",
    label: "Web",
  },
  {
    category: "local",
    connectMode: "local",
    docsUrl: "https://github.com/tageecc/memduck#browser-extension",
    fields: [
      {
        defaultValue: "http://127.0.0.1:3000",
        key: "captureBaseUrl",
        kind: "url",
        label: "服务地址",
        required: true,
      },
    ],
    id: "extension",
    label: "Browser extension",
  },
  {
    category: "built-in",
    connectMode: "gateway-webhook",
    docsUrl: `${openClawDocsBase}/channels/dingtalk`,
    fields: [
      { key: "appKey", kind: "text", label: "App key", required: true },
      {
        key: "appSecret",
        kind: "password",
        label: "App secret",
        required: true,
        secret: true,
      },
      { key: "robotCode", kind: "text", label: "Robot code", required: true },
      { key: "webhookUrl", kind: "url", label: "Webhook URL" },
      {
        key: "webhookSecret",
        kind: "password",
        label: "Webhook secret",
        secret: true,
      },
      { key: "allowFrom", kind: "text", label: "Allowed sender IDs" },
    ],
    id: "dingtalk",
    label: "DingTalk / 钉钉",
  },
  {
    category: "built-in",
    connectMode: "webhook",
    docsUrl: `${openClawDocsBase}/channels/bluebubbles`,
    fields: [
      { key: "serverUrl", kind: "url", label: "Server URL", required: true },
      {
        key: "password",
        kind: "password",
        label: "Password",
        required: true,
        secret: true,
      },
      {
        defaultValue: "/bluebubbles-webhook",
        key: "webhookPath",
        kind: "text",
        label: "Webhook path",
      },
    ],
    id: "bluebubbles",
    label: "BlueBubbles",
  },
  {
    category: "built-in",
    connectMode: "bot-token",
    docsUrl: `${openClawDocsBase}/channels/discord`,
    fields: [
      {
        key: "token",
        kind: "password",
        label: "Bot token",
        required: true,
        secret: true,
      },
      { key: "guildId", kind: "text", label: "Server ID" },
      { key: "channelId", kind: "text", label: "Channel ID" },
    ],
    id: "discord",
    label: "Discord",
  },
  {
    category: "built-in",
    connectMode: "gateway-webhook",
    docsUrl: `${openClawDocsBase}/channels/feishu`,
    fields: [
      { key: "appId", kind: "text", label: "App ID", required: true },
      {
        key: "appSecret",
        kind: "password",
        label: "App Secret",
        required: true,
        secret: true,
      },
      {
        defaultValue: "/feishu/events",
        key: "webhookPath",
        kind: "text",
        label: "Webhook path",
      },
    ],
    id: "feishu",
    label: "Feishu / Lark",
  },
  {
    category: "built-in",
    connectMode: "gateway-webhook",
    docsUrl: `${openClawDocsBase}/channels/googlechat`,
    fields: [
      {
        key: "serviceAccountFile",
        kind: "text",
        label: "Service account file",
        required: true,
      },
      {
        defaultValue: "/googlechat",
        key: "webhookPath",
        kind: "text",
        label: "Webhook path",
      },
    ],
    id: "googlechat",
    label: "Google Chat",
  },
  {
    category: "external",
    connectMode: "cli",
    docsUrl: `${openClawDocsBase}/channels/imessage`,
    fields: [
      { defaultValue: "imsg", key: "cliPath", kind: "text", label: "CLI path" },
      { key: "remoteHost", kind: "text", label: "Remote host" },
    ],
    id: "imessage",
    label: "iMessage",
  },
  {
    category: "built-in",
    connectMode: "local",
    docsUrl: `${openClawDocsBase}/channels/irc`,
    fields: [
      { key: "host", kind: "text", label: "Host", required: true },
      { defaultValue: "6697", key: "port", kind: "number", label: "Port" },
      { key: "nick", kind: "text", label: "Nick", required: true },
      { key: "channels", kind: "text", label: "Channels" },
      { defaultValue: "true", key: "tls", kind: "boolean", label: "TLS" },
    ],
    id: "irc",
    label: "IRC",
  },
  {
    category: "built-in",
    connectMode: "gateway-webhook",
    docsUrl: `${openClawDocsBase}/channels/line`,
    fields: [
      {
        key: "channelAccessToken",
        kind: "password",
        label: "Channel access token",
        required: true,
        secret: true,
      },
      {
        key: "channelSecret",
        kind: "password",
        label: "Channel secret",
        required: true,
        secret: true,
      },
      {
        defaultValue: "/line/webhook",
        key: "webhookPath",
        kind: "text",
        label: "Webhook path",
      },
    ],
    id: "line",
    label: "LINE",
  },
  {
    category: "built-in",
    connectMode: "local",
    docsUrl: `${openClawDocsBase}/channels/matrix`,
    fields: [
      { key: "homeserver", kind: "url", label: "Homeserver", required: true },
      { key: "userId", kind: "text", label: "User ID" },
      {
        key: "accessToken",
        kind: "password",
        label: "Access token",
        secret: true,
      },
      {
        key: "password",
        kind: "password",
        label: "Password",
        secret: true,
      },
    ],
    id: "matrix",
    label: "Matrix",
  },
  {
    category: "built-in",
    connectMode: "local",
    docsUrl: `${openClawDocsBase}/channels/mattermost`,
    fields: [
      { key: "serverUrl", kind: "url", label: "Server URL", required: true },
      {
        key: "token",
        kind: "password",
        label: "Bot token",
        required: true,
        secret: true,
      },
      { key: "team", kind: "text", label: "Team" },
    ],
    id: "mattermost",
    label: "Mattermost",
  },
  {
    category: "built-in",
    connectMode: "gateway-webhook",
    docsUrl: `${openClawDocsBase}/channels/msteams`,
    fields: [
      { key: "appId", kind: "text", label: "App ID", required: true },
      {
        key: "appPassword",
        kind: "password",
        label: "App password",
        required: true,
        secret: true,
      },
      { key: "tenantId", kind: "text", label: "Tenant ID" },
      {
        defaultValue: "/api/messages",
        key: "webhookPath",
        kind: "text",
        label: "Webhook path",
      },
    ],
    id: "msteams",
    label: "Microsoft Teams",
  },
  {
    category: "built-in",
    connectMode: "webhook",
    docsUrl: `${openClawDocsBase}/channels/nextcloud-talk`,
    fields: [
      { key: "baseUrl", kind: "url", label: "Base URL", required: true },
      {
        key: "botSecret",
        kind: "password",
        label: "Bot secret",
        required: true,
        secret: true,
      },
      {
        defaultValue: "/nextcloud-talk-webhook",
        key: "webhookPath",
        kind: "text",
        label: "Webhook path",
      },
    ],
    id: "nextcloud-talk",
    label: "Nextcloud Talk",
  },
  {
    category: "built-in",
    connectMode: "local",
    docsUrl: `${openClawDocsBase}/channels/nostr`,
    fields: [
      {
        key: "privateKey",
        kind: "password",
        label: "Private key",
        required: true,
        secret: true,
      },
      { key: "relays", kind: "text", label: "Relays" },
    ],
    id: "nostr",
    label: "Nostr",
  },
  {
    category: "built-in",
    connectMode: "bot-token",
    docsUrl: `${openClawDocsBase}/channels/qqbot`,
    fields: [
      { key: "appId", kind: "text", label: "App ID", required: true },
      {
        key: "clientSecret",
        kind: "password",
        label: "Client secret",
        required: true,
        secret: true,
      },
    ],
    id: "qqbot",
    label: "QQ Bot",
  },
  {
    category: "built-in",
    connectMode: "cli",
    docsUrl: `${openClawDocsBase}/channels/signal`,
    fields: [
      { key: "account", kind: "text", label: "Phone number", required: true },
      {
        defaultValue: "signal-cli",
        key: "cliPath",
        kind: "text",
        label: "CLI path",
      },
    ],
    id: "signal",
    label: "Signal",
  },
  {
    category: "built-in",
    connectMode: "oauth",
    docsUrl: `${openClawDocsBase}/channels/slack`,
    fields: [
      {
        key: "botToken",
        kind: "password",
        label: "Bot token",
        required: true,
        secret: true,
      },
      {
        key: "appToken",
        kind: "password",
        label: "App token",
        secret: true,
      },
      {
        key: "signingSecret",
        kind: "password",
        label: "Signing secret",
        secret: true,
      },
    ],
    id: "slack",
    label: "Slack",
  },
  {
    category: "built-in",
    connectMode: "webhook",
    docsUrl: `${openClawDocsBase}/channels/synology-chat`,
    fields: [
      { key: "incomingWebhookUrl", kind: "url", label: "Incoming webhook URL" },
      {
        key: "token",
        kind: "password",
        label: "Outgoing webhook token",
        required: true,
        secret: true,
      },
      {
        defaultValue: "/synology-chat",
        key: "webhookPath",
        kind: "text",
        label: "Webhook path",
      },
    ],
    id: "synology-chat",
    label: "Synology Chat",
  },
  {
    category: "built-in",
    connectMode: "bot-token",
    docsUrl: `${openClawDocsBase}/channels/telegram`,
    fields: [
      {
        defaultValue: "http://127.0.0.1:3000",
        key: "baseUrl",
        kind: "url",
        label: "服务地址",
        required: true,
      },
      {
        key: "botToken",
        kind: "password",
        label: "Bot token",
        required: true,
        secret: true,
      },
      { key: "botUsername", kind: "text", label: "Bot username" },
    ],
    id: "telegram",
    label: "Telegram",
  },
  {
    category: "built-in",
    connectMode: "local",
    docsUrl: `${openClawDocsBase}/channels/tlon`,
    fields: [
      { key: "ship", kind: "text", label: "Ship", required: true },
      { key: "code", kind: "password", label: "Code", secret: true },
    ],
    id: "tlon",
    label: "Tlon",
  },
  {
    category: "built-in",
    connectMode: "local",
    docsUrl: `${openClawDocsBase}/channels/twitch`,
    fields: [
      { key: "username", kind: "text", label: "Bot username", required: true },
      {
        key: "accessToken",
        kind: "password",
        label: "Access token",
        required: true,
        secret: true,
      },
      { key: "clientId", kind: "text", label: "Client ID" },
      { key: "channel", kind: "text", label: "Channel", required: true },
    ],
    id: "twitch",
    label: "Twitch",
  },
  {
    category: "plugin",
    connectMode: "webhook",
    docsUrl: `${openClawDocsBase}/plugins/voice-call`,
    fields: [
      {
        defaultValue: "twilio",
        key: "provider",
        kind: "text",
        label: "Provider",
        required: true,
      },
      { key: "publicUrl", kind: "url", label: "Public webhook URL" },
      { key: "fromNumber", kind: "text", label: "From number" },
      { key: "toNumber", kind: "text", label: "To number" },
      { key: "twilioAccountSid", kind: "text", label: "Twilio account SID" },
      {
        key: "twilioAuthToken",
        kind: "password",
        label: "Twilio auth token",
        secret: true,
      },
      {
        key: "telnyxApiKey",
        kind: "password",
        label: "Telnyx API key",
        secret: true,
      },
      {
        key: "telnyxConnectionId",
        kind: "text",
        label: "Telnyx connection ID",
      },
      { key: "plivoAuthId", kind: "text", label: "Plivo auth ID" },
      {
        key: "plivoAuthToken",
        kind: "password",
        label: "Plivo auth token",
        secret: true,
      },
    ],
    id: "voice-call",
    label: "Voice Call",
  },
  {
    category: "local",
    connectMode: "local",
    docsUrl: `${openClawDocsBase}/web/webchat`,
    fields: [],
    id: "webchat",
    label: "WebChat",
  },
  {
    category: "plugin",
    connectMode: "qr",
    docsUrl: `${openClawDocsBase}/channels/wechat`,
    fields: [],
    id: "wechat",
    label: "WeChat",
  },
  {
    category: "plugin",
    connectMode: "qr",
    docsUrl: `${openClawDocsBase}/channels/whatsapp`,
    fields: [
      {
        defaultValue: "default",
        key: "sessionName",
        kind: "text",
        label: "Session name",
        required: true,
      },
      { key: "authDir", kind: "text", label: "Auth directory" },
      { key: "account", kind: "text", label: "Account" },
      { key: "allowFrom", kind: "text", label: "Allowed sender IDs" },
      { key: "groups", kind: "text", label: "Allowed groups" },
    ],
    id: "whatsapp",
    label: "WhatsApp",
  },
  {
    category: "built-in",
    connectMode: "gateway-webhook",
    docsUrl: `${openClawDocsBase}/channels/yuanbao`,
    fields: [
      { key: "appKey", kind: "text", label: "App Key", required: true },
      {
        key: "appSecret",
        kind: "password",
        label: "App Secret",
        required: true,
        secret: true,
      },
      {
        defaultValue: "open",
        key: "dmPolicy",
        kind: "text",
        label: "DM policy",
      },
      {
        defaultValue: "true",
        key: "requireMention",
        kind: "boolean",
        label: "Require mention",
      },
    ],
    id: "yuanbao",
    label: "Yuanbao",
  },
  {
    category: "built-in",
    connectMode: "bot-token",
    docsUrl: `${openClawDocsBase}/channels/zalo`,
    fields: [
      {
        key: "botToken",
        kind: "password",
        label: "Bot token",
        required: true,
        secret: true,
      },
      { key: "webhookUrl", kind: "url", label: "Webhook URL" },
      {
        key: "webhookSecret",
        kind: "password",
        label: "Webhook secret",
        secret: true,
      },
    ],
    id: "zalo",
    label: "Zalo",
  },
  {
    category: "built-in",
    connectMode: "qr",
    docsUrl: `${openClawDocsBase}/channels/zalouser`,
    fields: [],
    id: "zalouser",
    label: "Zalo Personal",
  },
];

export function getChannelCatalogEntry(channelId: ChannelCatalogId) {
  const entry = channelCatalog.find((channel) => channel.id === channelId);

  if (!entry) {
    throw new Error(`Unsupported channel id: ${channelId}`);
  }

  return entry;
}

export function getChannelFieldDefaults(channelId: ChannelCatalogId) {
  const entry = getChannelCatalogEntry(channelId);

  return Object.fromEntries(
    entry.fields.map((field) => [field.key, field.defaultValue ?? ""]),
  );
}

export function isChannelCatalogId(value: string): value is ChannelCatalogId {
  return channelCatalogIds.includes(value as ChannelCatalogId);
}
