import { describe, expect, it } from "vitest";

import { channelCatalog } from "../src/lib/channels/catalog";
import {
  getChannelRuntimeAdapter,
  getChannelRuntimeDescriptor,
  getChannelRuntimeReadiness,
  listChannelRuntimeDescriptors,
} from "../src/lib/channels/runtime-registry";
import { createMemduckService } from "../src/lib/memduck/service";

describe("channel runtime registry", () => {
  it("registers the first OpenClaw runtime wave", () => {
    expect(
      listChannelRuntimeDescriptors().map((runtime) => runtime.id),
    ).toEqual(
      expect.arrayContaining([
        "telegram",
        "slack",
        "discord",
        "feishu",
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

  it("registers an adapter for every runtime descriptor", () => {
    for (const descriptor of listChannelRuntimeDescriptors()) {
      expect(getChannelRuntimeAdapter(descriptor.id)).toMatchObject({
        id: descriptor.id,
      });
    }
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

  it("maps first-wave webhook text payloads into ingest envelopes", () => {
    const cases = [
      ["slack", { text: "Slack note" }],
      ["discord", { content: "Discord note" }],
      ["feishu", { message: { text: "Feishu note" } }],
      ["dingtalk", { text: { content: "Dingtalk note" } }],
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
