import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ChannelSettings } from "../src/lib/memduck/types";

type MockService = {
  ask: ReturnType<typeof vi.fn>;
  askStream: ReturnType<typeof vi.fn>;
  deleteProviderProfile: ReturnType<typeof vi.fn>;
  getActiveProviderProfile: ReturnType<typeof vi.fn>;
  getChannelConnectionStatus: ReturnType<typeof vi.fn>;
  getChannelSettings: ReturnType<typeof vi.fn>;
  getReviewSections: ReturnType<typeof vi.fn>;
  getRuntimeDiagnostics: ReturnType<typeof vi.fn>;
  ingest: ReturnType<typeof vi.fn>;
  listProviderProfiles: ReturnType<typeof vi.fn>;
  mergeTopics: ReturnType<typeof vi.fn>;
  recordChannelHeartbeat: ReturnType<typeof vi.fn>;
  removeTopicLink: ReturnType<typeof vi.fn>;
  renameTopic: ReturnType<typeof vi.fn>;
  retrieveCards: ReturnType<typeof vi.fn>;
  saveChannelSettings: ReturnType<typeof vi.fn>;
  saveProviderProfile: ReturnType<typeof vi.fn>;
  setActiveProviderProfile: ReturnType<typeof vi.fn>;
  testProviderSettings: ReturnType<typeof vi.fn>;
};

const defaultChannelSettings: ChannelSettings = {
  channels: {
    extension: {
      enabled: true,
      values: {
        captureBaseUrl: "http://127.0.0.1:3000",
      },
    },
    telegram: {
      enabled: true,
      values: {
        baseUrl: "http://127.0.0.1:3000",
        botToken: "secret-token",
        botUsername: "@memduck_bot",
      },
    },
    web: {
      enabled: true,
      values: {},
    },
  },
  extension: {
    captureBaseUrl: "http://127.0.0.1:3000",
    enabled: true,
  },
  telegram: {
    baseUrl: "http://127.0.0.1:3000",
    botToken: "secret-token",
    botUsername: "@memduck_bot",
    enabled: true,
  },
  web: {
    enabled: true,
  },
};

const mockService: MockService = {
  ask: vi.fn(async () => ({
    answer: "stored answer",
    citations: [],
    conversationId: "conversation-1",
  })),
  askStream: vi.fn(async function* () {
    yield {
      citations: [],
      conversationId: "conversation-1",
    };
    yield { token: "streamed answer" };
    yield { done: true };
  }),
  deleteProviderProfile: vi.fn(),
  getActiveProviderProfile: vi.fn(() => ({
    answerModel: "gpt-answer",
    apiKey: "sk-test",
    baseUrl: "https://api.example.com/v1",
    createdAt: "2026-04-24T10:00:00.000Z",
    embeddingModel: "text-embedding-3-small",
    id: "provider-1",
    kind: "openai-compatible",
    model: "gpt-answer",
    name: "Provider 1",
    providerId: "openai-compatible",
    rerankModel: "gpt-rerank",
    summarizeModel: "gpt-summary",
    updatedAt: "2026-04-24T10:00:00.000Z",
    visionModel: "gpt-vision",
  })),
  getChannelConnectionStatus: vi.fn(() => null),
  getChannelSettings: vi.fn(() => defaultChannelSettings),
  getReviewSections: vi.fn(() => ({
    staleHighValue: [],
    themeMomentum: [],
    today: [],
  })),
  getRuntimeDiagnostics: vi.fn(() => ({
    channels: {
      extension: {
        configured: true,
        connected: false,
        enabled: true,
        label: "Waiting",
        lastHeartbeatAt: null,
      },
      telegram: {
        configured: true,
        connected: false,
        enabled: true,
        label: "Waiting",
        lastHeartbeatAt: null,
      },
      web: {
        configured: true,
        connected: true,
        enabled: true,
        label: "Available",
        lastHeartbeatAt: null,
      },
    },
    features: {
      embeddings: true,
      rerank: true,
      vision: true,
    },
    provider: null,
    setup: {
      hasAnyMemories: false,
      needsOnboarding: false,
      providerConfigured: true,
      providerKind: "openai-compatible",
    },
    stats: {
      compiledTopics: 0,
      conversations: 0,
      memoryCards: 0,
      reviewCompiled: false,
      topics: 0,
    },
  })),
  ingest: vi.fn(async () => ({
    memoryCard: {
      createdAt: "2026-04-24T10:00:00.000Z",
      deepSummary: "summary",
      evidence: ["evidence"],
      id: "card-1",
      keyPoints: ["point"],
      sequence: 1,
      sourceChannel: "web",
      sourceItemId: "source-1",
      status: "deep_ready",
      summary: "summary",
      title: "title",
      topicIds: ["topic-1"],
      updatedAt: "2026-04-24T10:00:00.000Z",
      worthSaving: true,
    },
    sourceItem: {
      createdAt: "2026-04-24T10:00:00.000Z",
      id: "source-1",
      kind: "image",
      sourceChannel: "web",
    },
  })),
  listProviderProfiles: vi.fn(() => []),
  mergeTopics: vi.fn(() => ({
    createdAt: "2026-04-24T10:00:00.000Z",
    id: "topic-2",
    keywords: ["merged"],
    name: "Merged Topic",
    slug: "merged-topic",
  })),
  recordChannelHeartbeat: vi.fn(),
  removeTopicLink: vi.fn(() => ({
    createdAt: "2026-04-24T10:00:00.000Z",
    deepSummary: "summary",
    evidence: ["evidence"],
    id: "card-1",
    keyPoints: ["point"],
    sequence: 1,
    sourceChannel: "web",
    sourceItemId: "source-1",
    status: "deep_ready",
    summary: "summary",
    title: "title",
    topicIds: [],
    updatedAt: "2026-04-24T10:00:00.000Z",
    worthSaving: true,
  })),
  renameTopic: vi.fn(() => ({
    createdAt: "2026-04-24T10:00:00.000Z",
    id: "topic-1",
    keywords: ["renamed"],
    name: "Renamed Topic",
    slug: "renamed-topic",
  })),
  retrieveCards: vi.fn(async () => ({
    items: [],
    strategy: "embedding-rerank",
  })),
  saveChannelSettings: vi.fn(),
  saveProviderProfile: vi.fn((profile) => profile),
  setActiveProviderProfile: vi.fn(),
  testProviderSettings: vi.fn(() =>
    Promise.resolve("**Raw provider response must stay internal.**"),
  ),
};

const saveBuffer = vi.fn(() => ({
  fileName: "saved.png",
  mimeType: "image/png",
  objectKey: "uploads/saved.png",
}));
const readAsBuffer = vi.fn(() => Buffer.from("image-bytes"));

vi.mock("@/lib/memduck/runtime", () => ({
  getMemduckService: vi.fn(async () => mockService),
}));

vi.mock("@/lib/memduck/runtime-path", () => ({
  getRuntimeDir: vi.fn(() => "/tmp/memduck-test-runtime"),
}));

vi.mock("@/lib/storage/assets", () => ({
  createAssetStore: vi.fn(() => ({
    readAsBuffer,
    saveBuffer,
  })),
}));

describe("API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("rejects multipart image ingest when requestedDepth is outside the shared contract", async () => {
    const { POST } = await import("../app/api/ingest/route");
    const formData = new FormData();
    formData.set(
      "file",
      new File([Buffer.from("image-bytes")], "capture.png", {
        type: "image/png",
      }),
    );
    formData.set("requestedDepth", "instant");
    formData.set("sourceChannel", "web");

    const response = await POST(
      new Request("http://localhost/api/ingest", {
        body: formData,
        method: "POST",
      }),
    );

    expect(response.status).toBe(400);
    expect(mockService.ingest).not.toHaveBeenCalled();
  });

  it("rejects multipart image ingest before storing assets when sourceContext is invalid", async () => {
    const { POST } = await import("../app/api/ingest/route");
    const formData = new FormData();
    formData.set(
      "file",
      new File([Buffer.from("image-bytes")], "capture.png", {
        type: "image/png",
      }),
    );
    formData.set("requestedDepth", "quick");
    formData.set("sourceChannel", "web");
    formData.set("caption", "   ");

    const response = await POST(
      new Request("http://localhost/api/ingest", {
        body: formData,
        method: "POST",
      }),
    );

    expect(response.status).toBe(400);
    expect(saveBuffer).not.toHaveBeenCalled();
    expect(mockService.ingest).not.toHaveBeenCalled();
  });

  it("accepts multipart image ingest and forwards the saved asset envelope", async () => {
    const { POST } = await import("../app/api/ingest/route");
    const formData = new FormData();
    formData.set(
      "file",
      new File([Buffer.from("image-bytes")], "capture.png", {
        type: "image/png",
      }),
    );
    formData.set("requestedDepth", "deep");
    formData.set("sourceChannel", "web");
    formData.set("caption", "Diagram from the browser");

    const response = await POST(
      new Request("http://localhost/api/ingest", {
        body: formData,
        method: "POST",
      }),
    );
    const payload = (await response.json()) as {
      memoryCard?: { id: string };
    };

    expect(response.status).toBe(200);
    expect(payload.memoryCard?.id).toBe("card-1");
    expect(saveBuffer).toHaveBeenCalledWith(
      expect.objectContaining({
        fileName: "capture.png",
        mimeType: "image/png",
        prefix: "uploads",
      }),
    );
    const savedCall = saveBuffer.mock.calls.at(-1) as
      | [{ bytes: Buffer }]
      | undefined;
    expect(savedCall?.[0].bytes.toString("utf8")).toBe("image-bytes");
    expect(mockService.ingest).toHaveBeenCalledWith({
      kind: "image",
      payload: {
        fileName: "saved.png",
        mimeType: "image/png",
        objectKey: "uploads/saved.png",
      },
      requestedDepth: "deep",
      sourceChannel: "web",
      sourceContext: {
        caption: "Diagram from the browser",
      },
    });
  });

  it("serves stored image assets by object key without exposing runtime paths", async () => {
    const { GET } = await import("../app/api/assets/[...objectKey]/route");

    const response = await GET(new Request("http://localhost/api/assets"), {
      params: Promise.resolve({ objectKey: ["uploads", "saved.png"] }),
    });
    const payload = Buffer.from(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe("private, max-age=3600");
    expect(payload.toString("utf8")).toBe("image-bytes");
    expect(readAsBuffer).toHaveBeenCalledWith("uploads/saved.png");
  });

  it("rejects stored asset requests with unsafe object key segments", async () => {
    const { GET } = await import("../app/api/assets/[...objectKey]/route");

    const response = await GET(new Request("http://localhost/api/assets"), {
      params: Promise.resolve({ objectKey: ["uploads", "..", "secret.png"] }),
    });

    expect(response.status).toBe(400);
    expect(readAsBuffer).not.toHaveBeenCalled();
  });

  it("returns an actionable image ingest error when the vision provider rejects dimensions", async () => {
    mockService.ingest.mockRejectedValueOnce(
      new Error(
        "<400> InternalError.Algo.InvalidParameter: The image length and width do not meet the model restrictions. [height:1 or width:1 must be larger than 10]",
      ),
    );
    const { POST } = await import("../app/api/ingest/route");
    const formData = new FormData();
    formData.set(
      "file",
      new File([Buffer.from("image-bytes")], "capture.png", {
        type: "image/png",
      }),
    );
    formData.set("requestedDepth", "quick");
    formData.set("sourceChannel", "web");

    const response = await POST(
      new Request("http://localhost/api/ingest", {
        body: formData,
        method: "POST",
      }),
    );
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(502);
    expect(payload.error).toBe(
      "图片尺寸太小，请换一张宽高都大于 10px 的图片。",
    );
  });

  it("rejects malformed JSON bodies before touching route services", async () => {
    const [
      { POST: askPost },
      { POST: providerActivatePost },
      { POST: uiPost },
    ] = await Promise.all([
      import("../app/api/ask/route"),
      import("../app/api/settings/providers/activate/route"),
      import("../app/api/settings/ui/route"),
    ]);

    const askResponse = await askPost(
      new Request("http://localhost/api/ask", {
        body: "{",
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      }),
    );
    const providerResponse = await providerActivatePost(
      new Request("http://localhost/api/settings/providers/activate", {
        body: "{",
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      }),
    );
    const uiResponse = await uiPost(
      new Request("http://localhost/api/settings/ui", {
        body: "{",
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      }),
    );

    expect(askResponse.status).toBe(400);
    expect(providerResponse.status).toBe(400);
    expect(uiResponse.status).toBe(400);
    expect(mockService.setActiveProviderProfile).not.toHaveBeenCalled();
  });

  it("serializes ask stream failures as recoverable SSE errors", async () => {
    mockService.askStream.mockImplementationOnce(async function* () {
      yield {
        citations: [],
        conversationId: "conversation-1",
      };
      throw new Error("provider unavailable");
    });
    const { POST } = await import("../app/api/ask/stream/route");

    const response = await POST(
      new Request("http://localhost/api/ask/stream", {
        body: JSON.stringify({
          question: "What do I know about memory?",
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      }),
    );
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(text).toContain('"conversationId":"conversation-1"');
    expect(text).toContain('"error":"Agent 暂时无法回答，请稍后重试。"');
    expect(text).toContain('"done":true');
  });

  it("serializes non-streaming ask failures as recoverable JSON errors", async () => {
    mockService.ask.mockRejectedValueOnce(new Error("provider unavailable"));
    const { POST } = await import("../app/api/ask/route");

    const response = await POST(
      new Request("http://localhost/api/ask", {
        body: JSON.stringify({
          question: "What do I know about memory?",
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      }),
    );
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(502);
    expect(payload.error).toBe("Agent 暂时无法回答，请稍后重试。");
  });

  it("serializes topic-scoped ask failures as recoverable JSON errors", async () => {
    mockService.ask.mockRejectedValueOnce(new Error("provider unavailable"));
    const { POST } = await import("../app/api/topics/[id]/ask/route");

    const response = await POST(
      new Request("http://localhost/api/topics/topic-1/ask", {
        body: JSON.stringify({
          question: "What should I ask about this topic?",
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      }),
      { params: Promise.resolve({ id: "topic-1" }) },
    );
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(502);
    expect(payload.error).toBe("Agent 暂时无法回答，请稍后重试。");
  });

  it("rejects multipart image ingest when required envelope fields are missing", async () => {
    const { POST } = await import("../app/api/ingest/route");
    const formData = new FormData();
    formData.set(
      "file",
      new File([Buffer.from("image-bytes")], "capture.png", {
        type: "image/png",
      }),
    );

    const response = await POST(
      new Request("http://localhost/api/ingest", {
        body: formData,
        method: "POST",
      }),
    );

    expect(response.status).toBe(400);
    expect(saveBuffer).not.toHaveBeenCalled();
    expect(mockService.ingest).not.toHaveBeenCalled();
  });

  it("rejects heartbeat payloads outside the channel heartbeat contract", async () => {
    const { POST } = await import("../app/api/channels/heartbeat/route");

    const response = await POST(
      new Request("http://localhost/api/channels/heartbeat", {
        body: JSON.stringify({
          channel: "web",
          metadata: {
            version: "0.1.0",
          },
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(400);
    expect(mockService.recordChannelHeartbeat).not.toHaveBeenCalled();
  });

  it("rejects secret-backed channel ingest without channel authentication", async () => {
    const { POST } = await import("../app/api/channels/[channel]/ingest/route");

    const response = await POST(
      new Request("http://localhost/api/channels/telegram/ingest", {
        body: JSON.stringify({
          kind: "text",
          payload: {
            text: "save this memory",
          },
          requestedDepth: "quick",
          sourceChannel: "telegram",
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      }),
      { params: Promise.resolve({ channel: "telegram" }) },
    );

    expect(response.status).toBe(401);
    expect(mockService.ingest).not.toHaveBeenCalled();
  });

  it("accepts channel ingest only when path and envelope channel match", async () => {
    const { POST } = await import("../app/api/channels/[channel]/ingest/route");

    const response = await POST(
      new Request("http://localhost/api/channels/telegram/ingest", {
        body: JSON.stringify({
          kind: "text",
          payload: {
            text: "save this memory",
          },
          requestedDepth: "quick",
          sourceChannel: "telegram",
        }),
        headers: {
          authorization: "Bearer secret-token",
          "content-type": "application/json",
        },
        method: "POST",
      }),
      { params: Promise.resolve({ channel: "telegram" }) },
    );

    expect(response.status).toBe(200);
    expect(mockService.recordChannelHeartbeat).toHaveBeenCalledWith({
      channel: "telegram",
      metadata: {
        ingress: "channel",
      },
      occurredAt: expect.any(String),
    });
    expect(mockService.ingest).toHaveBeenCalledWith({
      kind: "text",
      payload: {
        text: "save this memory",
      },
      requestedDepth: "quick",
      sourceChannel: "telegram",
    });
  });

  it("accepts native webhook payloads through channel runtime adapters", async () => {
    const { POST } = await import("../app/api/channels/[channel]/ingest/route");

    mockService.getChannelSettings.mockReturnValueOnce({
      ...defaultChannelSettings,
      channels: {
        ...defaultChannelSettings.channels,
        dingtalk: {
          enabled: true,
          values: {
            appKey: "ding-key",
            appSecret: "ding-secret",
            robotCode: "ding-robot",
          },
        },
      },
    });

    const response = await POST(
      new Request("http://localhost/api/channels/dingtalk/ingest", {
        body: JSON.stringify({
          text: {
            content: "Dingtalk native note",
          },
        }),
        headers: {
          authorization: "Bearer ding-secret",
          "content-type": "application/json",
        },
        method: "POST",
      }),
      { params: Promise.resolve({ channel: "dingtalk" }) },
    );

    expect(response.status).toBe(200);
    expect(mockService.ingest).toHaveBeenCalledWith({
      kind: "text",
      payload: {
        text: "Dingtalk native note",
      },
      requestedDepth: "quick",
      sourceChannel: "dingtalk",
    });
  });

  it("rejects channel ingest when the path channel is not the envelope channel", async () => {
    const { POST } = await import("../app/api/channels/[channel]/ingest/route");

    const response = await POST(
      new Request("http://localhost/api/channels/slack/ingest", {
        body: JSON.stringify({
          kind: "text",
          payload: {
            text: "save this memory",
          },
          requestedDepth: "quick",
          sourceChannel: "telegram",
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      }),
      { params: Promise.resolve({ channel: "slack" }) },
    );

    expect(response.status).toBe(400);
    expect(mockService.ingest).not.toHaveBeenCalled();
  });

  it("preserves a saved channel secret when the public form leaves it blank", async () => {
    const { POST } = await import("../app/api/settings/channels/route");

    const response = await POST(
      new Request("http://localhost/api/settings/channels", {
        body: JSON.stringify({
          channels: {
            telegram: {
              enabled: true,
              values: {
                baseUrl: "http://127.0.0.1:3000",
                botToken: "",
                botUsername: "@memduck_bot",
              },
            },
          },
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    expect(mockService.saveChannelSettings).toHaveBeenCalledWith({
      channels: {
        telegram: {
          enabled: true,
          values: {
            baseUrl: "http://127.0.0.1:3000",
            botUsername: "@memduck_bot",
          },
        },
      },
    });
  });

  it("requires channel saves to include an explicit Telegram token field", async () => {
    const { POST } = await import("../app/api/settings/channels/route");

    const response = await POST(
      new Request("http://localhost/api/settings/channels", {
        body: JSON.stringify({
          extension: {
            captureBaseUrl: "http://127.0.0.1:3000",
            enabled: true,
          },
          telegram: {
            baseUrl: "http://127.0.0.1:3000",
            botUsername: "@memduck_bot",
            enabled: true,
          },
          web: {
            enabled: true,
          },
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(400);
    expect(mockService.saveChannelSettings).not.toHaveBeenCalled();
  });

  it("rejects provider profile saves when makeActive is not boolean", async () => {
    const { POST } = await import("../app/api/settings/providers/route");

    const response = await POST(
      new Request("http://localhost/api/settings/providers", {
        body: JSON.stringify({
          apiKey: "sk-test",
          makeActive: "yes",
          model: "gpt-4.1",
          name: "OpenAI Main",
          providerId: "openai",
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(400);
    expect(mockService.saveProviderProfile).not.toHaveBeenCalled();
  });

  it("accepts compact provider profile saves and expands capability models server-side", async () => {
    const { POST } = await import("../app/api/settings/providers/route");

    const response = await POST(
      new Request("http://localhost/api/settings/providers", {
        body: JSON.stringify({
          apiKey: "sk-test",
          makeActive: true,
          model: "gpt-4.1",
          name: "OpenAI Main",
          providerId: "openai",
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    expect(mockService.saveProviderProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        answerModel: "gpt-4.1",
        apiKey: "sk-test",
        baseUrl: "https://api.openai.com/v1",
        embeddingModel: "text-embedding-3-small",
        kind: "openai",
        model: "gpt-4.1",
        name: "OpenAI Main",
        providerId: "openai",
        rerankModel: "gpt-4.1",
        summarizeModel: "gpt-4.1",
        visionModel: "gpt-4.1",
      }),
      { makeActive: true },
    );
  });

  it("returns a contract error when a provider cannot support memory retrieval", async () => {
    const { POST } = await import("../app/api/settings/providers/route");

    const response = await POST(
      new Request("http://localhost/api/settings/providers", {
        body: JSON.stringify({
          apiKey: "sk-test",
          baseUrl: "https://speech.example.com/v1",
          model: "azure-speech",
          name: "Speech Provider",
          providerId: "azure-speech",
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      }),
    );
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(payload.error).toContain(
      "does not provide an embedding model for memduck retrieval",
    );
    expect(mockService.saveProviderProfile).not.toHaveBeenCalled();
  });

  it("preserves saved provider API keys when editing an existing profile", async () => {
    mockService.listProviderProfiles.mockReturnValueOnce([
      {
        answerModel: "gpt-4.1",
        apiKey: "sk-saved",
        baseUrl: "https://api.openai.com/v1",
        createdAt: "2026-04-24T10:00:00.000Z",
        embeddingModel: "text-embedding-3-small",
        id: "provider-1",
        kind: "openai",
        model: "gpt-4.1",
        name: "OpenAI Main",
        providerId: "openai",
        rerankModel: "gpt-4.1",
        summarizeModel: "gpt-4.1",
        updatedAt: "2026-04-24T10:00:00.000Z",
        visionModel: "gpt-4.1",
      },
    ]);
    const { POST } = await import("../app/api/settings/providers/route");

    const response = await POST(
      new Request("http://localhost/api/settings/providers", {
        body: JSON.stringify({
          apiKey: "",
          id: "provider-1",
          model: "gpt-4.1-mini",
          name: "OpenAI Main",
          providerId: "openai",
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    expect(mockService.saveProviderProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: "sk-saved",
        id: "provider-1",
        model: "gpt-4.1-mini",
        providerId: "openai",
      }),
      { makeActive: true },
    );
  });

  it("rejects capability-specific model fields at the provider API boundary", async () => {
    const { POST } = await import("../app/api/settings/providers/route");

    const response = await POST(
      new Request("http://localhost/api/settings/providers", {
        body: JSON.stringify({
          answerModel: "gpt-answer",
          apiKey: "sk-test",
          model: "gpt-4.1",
          name: "OpenAI Main",
          providerId: "openai",
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(400);
    expect(mockService.saveProviderProfile).not.toHaveBeenCalled();
  });

  it("tests compact provider settings through the same provider catalog expansion", async () => {
    const { POST } = await import("../app/api/settings/provider/test/route");

    const response = await POST(
      new Request("http://localhost/api/settings/provider/test", {
        body: JSON.stringify({
          apiKey: "sk-test",
          model: "gpt-4.1",
          providerId: "openai",
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      message: "Provider connection verified.",
      ok: true,
    });
    expect(mockService.testProviderSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        answerModel: "gpt-4.1",
        baseUrl: "https://api.openai.com/v1",
        embeddingModel: "text-embedding-3-small",
        kind: "openai",
        model: "gpt-4.1",
        providerId: "openai",
      }),
    );
  });

  it("tests saved provider profiles without requiring the secret to round-trip through the UI", async () => {
    mockService.listProviderProfiles.mockReturnValueOnce([
      {
        answerModel: "gpt-4.1",
        apiKey: "sk-saved",
        baseUrl: "https://api.openai.com/v1",
        createdAt: "2026-04-24T10:00:00.000Z",
        embeddingModel: "text-embedding-3-small",
        id: "provider-1",
        kind: "openai",
        model: "gpt-4.1",
        name: "OpenAI Main",
        providerId: "openai",
        rerankModel: "gpt-4.1",
        summarizeModel: "gpt-4.1",
        updatedAt: "2026-04-24T10:00:00.000Z",
        visionModel: "gpt-4.1",
      },
    ]);
    const { POST } = await import("../app/api/settings/provider/test/route");

    const response = await POST(
      new Request("http://localhost/api/settings/provider/test", {
        body: JSON.stringify({
          apiKey: "",
          id: "provider-1",
          model: "gpt-4.1",
          providerId: "openai",
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    expect(mockService.testProviderSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: "sk-saved",
        model: "gpt-4.1",
        providerId: "openai",
      }),
    );
  });

  it("exposes search as a dedicated retrieval API contract", async () => {
    const { POST } = await import("../app/api/search/route");

    const response = await POST(
      new Request("http://localhost/api/search", {
        body: JSON.stringify({
          limit: 3,
          query: "retrieval practice",
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    expect(mockService.retrieveCards).toHaveBeenCalledWith({
      filters: undefined,
      limit: 3,
      query: "retrieval practice",
    });
  });

  it("serializes search retrieval failures as recoverable JSON errors", async () => {
    mockService.retrieveCards.mockRejectedValueOnce(
      new Error("embedding provider unavailable"),
    );
    const { POST } = await import("../app/api/search/route");

    const response = await POST(
      new Request("http://localhost/api/search", {
        body: JSON.stringify({
          limit: 3,
          query: "retrieval practice",
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      }),
    );
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(502);
    expect(payload.error).toBe("搜索暂时不可用，请稍后重试。");
  });

  it("returns the service review contract instead of reading compiled settings directly", async () => {
    const { GET } = await import("../app/api/review/route");

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      staleHighValue: [],
      themeMomentum: [],
      today: [],
    });
    expect(mockService.getReviewSections).toHaveBeenCalled();
  });

  it("exposes strict topic management API contracts", async () => {
    const [{ PATCH }, mergeRoute, linksRoute] = await Promise.all([
      import("../app/api/topics/[id]/route"),
      import("../app/api/topics/[id]/merge/route"),
      import("../app/api/topics/[id]/links/route"),
    ]);

    const params = Promise.resolve({ id: "topic-1" });
    const renameResponse = await PATCH(
      new Request("http://localhost/api/topics/topic-1", {
        body: JSON.stringify({
          keywords: ["renamed"],
          name: "Renamed Topic",
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "PATCH",
      }),
      { params },
    );
    const mergeResponse = await mergeRoute.POST(
      new Request("http://localhost/api/topics/topic-1/merge", {
        body: JSON.stringify({
          targetTopicId: "topic-2",
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      }),
      { params },
    );
    const unlinkResponse = await linksRoute.DELETE(
      new Request("http://localhost/api/topics/topic-1/links", {
        body: JSON.stringify({
          cardId: "card-1",
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "DELETE",
      }),
      { params },
    );

    expect(renameResponse.status).toBe(200);
    expect(mergeResponse.status).toBe(200);
    expect(unlinkResponse.status).toBe(200);
    expect(mockService.renameTopic).toHaveBeenCalledWith("topic-1", {
      keywords: ["renamed"],
      name: "Renamed Topic",
    });
    expect(mockService.mergeTopics).toHaveBeenCalledWith({
      sourceTopicId: "topic-1",
      targetTopicId: "topic-2",
    });
    expect(mockService.removeTopicLink).toHaveBeenCalledWith({
      cardId: "card-1",
      topicId: "topic-1",
    });
  });

  it("returns a contract error instead of throwing when provider activation is unknown", async () => {
    mockService.setActiveProviderProfile.mockImplementationOnce(() => {
      throw new Error("Unknown provider profile: missing-provider");
    });
    const { POST } = await import(
      "../app/api/settings/providers/activate/route"
    );

    const response = await POST(
      new Request("http://localhost/api/settings/providers/activate", {
        body: JSON.stringify({
          id: "missing-provider",
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(400);
  });

  it("returns a contract error instead of succeeding when provider deletion is unknown", async () => {
    mockService.deleteProviderProfile.mockImplementationOnce(() => {
      throw new Error("Unknown provider profile: missing-provider");
    });
    const { DELETE } = await import("../app/api/settings/providers/route");

    const response = await DELETE(
      new Request("http://localhost/api/settings/providers", {
        body: JSON.stringify({
          id: "missing-provider",
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "DELETE",
      }),
    );

    expect(response.status).toBe(400);
  });
});
