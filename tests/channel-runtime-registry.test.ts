import { describe, expect, it } from "vitest";

import { channelCatalog } from "../src/lib/channels/catalog";
import {
  getChannelRuntimeAdapter,
  getChannelRuntimeDescriptor,
  getChannelRuntimeReadiness,
  isChannelRuntimeAvailable,
  listChannelRuntimeDescriptors,
} from "../src/lib/channels/runtime-registry";
import { createMemduckService } from "../src/lib/memduck/service";

describe("channel runtime registry", () => {
  it("registers the OpenClaw webhook runtime wave", () => {
    expect(
      listChannelRuntimeDescriptors().map((runtime) => runtime.id),
    ).toEqual(
      expect.arrayContaining([
        "telegram",
        "slack",
        "discord",
        "feishu",
        "line",
        "msteams",
        "nextcloud-talk",
        "whatsapp",
        "dingtalk",
      ]),
    );
    expect(getChannelRuntimeDescriptor("dingtalk")).toMatchObject({
      docsUrl: "https://docs.openclaw.ai/channels/dingtalk",
      id: "dingtalk",
      mode: "gateway-webhook",
      status: "webhook-adapter",
    });
  });

  it("covers every selectable channel catalog entry", () => {
    const selectableChannelIds = channelCatalog
      .filter((channel) => channel.id !== "web")
      .map((channel) => channel.id);

    expect(
      listChannelRuntimeDescriptors().map((runtime) => runtime.id),
    ).toEqual(selectableChannelIds);
  });

  it("registers adapters only for available runtimes", () => {
    for (const descriptor of listChannelRuntimeDescriptors()) {
      if (
        descriptor.id === "telegram" ||
        descriptor.status === "webhook-adapter"
      ) {
        expect(getChannelRuntimeAdapter(descriptor.id)).toMatchObject({
          id: descriptor.id,
        });
      } else {
        expect(getChannelRuntimeAdapter(descriptor.id)).toBeUndefined();
      }
    }
  });

  it("does not treat planned channel runtimes as available", () => {
    expect(
      isChannelRuntimeAvailable({
        ready: true,
        status: "adapter-planned",
      }),
    ).toBe(false);
  });

  it("reports missing runtime fields from channel settings", () => {
    const service = createMemduckService({
      runtimeDir: ".memduck/channel-runtime-registry-test",
    });

    service.saveChannelSettings({
      channels: {
        dingtalk: {
          enabled: true,
          values: {
            appKey: "ding-app-key",
          },
        },
      },
    });

    expect(
      getChannelRuntimeReadiness(service.getChannelSettings()).dingtalk,
    ).toMatchObject({
      enabled: true,
      missingFields: ["appSecret", "robotCode"],
      ready: false,
      status: "webhook-adapter",
    });
  });

  it("resolves Telegram through the native runtime adapter", () => {
    const service = createMemduckService({
      runtimeDir: ".memduck/channel-runtime-registry-test",
    });
    service.saveChannelSettings({
      channels: {
        telegram: {
          enabled: true,
          values: {
            baseUrl: "http://127.0.0.1:3000",
            botToken: "saved-token",
          },
        },
      },
    });

    const adapter = getChannelRuntimeAdapter("telegram");

    expect(adapter?.readiness(service.getChannelSettings())).toMatchObject({
      enabled: true,
      ready: true,
      status: "native",
    });
    expect(
      adapter?.resolveConfig(service.getChannelSettings(), {
        TELEGRAM_BOT_TOKEN: "env-token",
      }),
    ).toEqual({
      baseUrl: "http://127.0.0.1:3000",
      token: "env-token",
    });
  });

  it("maps webhook text payloads into ingest envelopes", () => {
    const cases = [
      ["bluebubbles", { message: "BlueBubbles note" }],
      ["slack", { text: "Slack note" }],
      ["discord", { content: "Discord note" }],
      ["feishu", { message: { text: "Feishu note" } }],
      ["dingtalk", { text: { content: "Dingtalk note" } }],
      ["googlechat", { message: { text: "Google Chat note" } }],
      ["line", { events: [{ message: { text: "LINE note" } }] }],
      ["mattermost", { post: { message: "Mattermost note" } }],
      ["msteams", { body: { content: "Teams note" } }],
      ["nextcloud-talk", { message: "Nextcloud Talk note" }],
      ["synology-chat", { text: "Synology Chat note" }],
      ["yuanbao", { content: "Yuanbao note" }],
      ["zalo", { message: { text: "Zalo note" } }],
    ] as const;

    for (const [channelId, payload] of cases) {
      const adapter = getChannelRuntimeAdapter(channelId);
      expect(adapter?.parseWebhook?.(payload)).toMatchObject({
        kind: "text",
        requestedDepth: "quick",
        sourceChannel: channelId,
      });
    }
  });

  it("maps webhook URL payloads into URL ingest envelopes", () => {
    const cases = [
      ["slack", { text: "https://example.com/slack-note" }],
      ["discord", { content: "https://example.com/discord-note" }],
      ["feishu", { message: { text: "https://example.com/feishu-note" } }],
      ["dingtalk", { text: { content: "https://example.com/dingtalk-note" } }],
      [
        "line",
        { events: [{ message: { text: "https://example.com/line-note" } }] },
      ],
      ["msteams", { body: { content: "https://example.com/teams-note" } }],
      ["zalo", { message: { text: "https://example.com/zalo-note" } }],
    ] as const;

    for (const [channelId, payload] of cases) {
      const adapter = getChannelRuntimeAdapter(channelId);
      expect(adapter?.parseWebhook?.(payload)).toMatchObject({
        kind: "url",
        payload: { url: expect.stringContaining("https://example.com/") },
        requestedDepth: "quick",
        sourceChannel: channelId,
      });
    }
  });

  it("models WhatsApp as a QR session runtime", () => {
    const descriptor = getChannelRuntimeDescriptor("whatsapp");

    expect(descriptor).toMatchObject({
      id: "whatsapp",
      mode: "qr",
      requiredFields: ["sessionName"],
      status: "adapter-planned",
    });
  });
});
