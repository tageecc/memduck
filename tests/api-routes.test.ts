import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type MockService = {
  getChannelConnectionStatus: ReturnType<typeof vi.fn>;
  getChannelSettings: ReturnType<typeof vi.fn>;
  getRuntimeDiagnostics: ReturnType<typeof vi.fn>;
  ingest: ReturnType<typeof vi.fn>;
  mergeTopics: ReturnType<typeof vi.fn>;
  removeTopicLink: ReturnType<typeof vi.fn>;
  renameTopic: ReturnType<typeof vi.fn>;
  retrieveCards: ReturnType<typeof vi.fn>;
  saveChannelSettings: ReturnType<typeof vi.fn>;
};

const mockService: MockService = {
  getChannelConnectionStatus: vi.fn(() => null),
  getChannelSettings: vi.fn(() => ({
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
  mergeTopics: vi.fn(() => ({
    createdAt: "2026-04-24T10:00:00.000Z",
    id: "topic-2",
    keywords: ["merged"],
    name: "Merged Topic",
    slug: "merged-topic",
  })),
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
};

const saveBuffer = vi.fn(() => ({
  fileName: "saved.png",
  mimeType: "image/png",
  objectKey: "uploads/saved.png",
}));

vi.mock("@/lib/memduck/runtime", () => ({
  getMemduckService: vi.fn(async () => mockService),
}));

vi.mock("@/lib/memduck/runtime-path", () => ({
  getRuntimeDir: vi.fn(() => "/tmp/memduck-test-runtime"),
}));

vi.mock("@/lib/storage/assets", () => ({
  createAssetStore: vi.fn(() => ({
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

  it("saves channel settings exactly as submitted instead of reviving an old Telegram token", async () => {
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
            botToken: "",
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

    expect(response.status).toBe(200);
    expect(mockService.saveChannelSettings).toHaveBeenCalledWith({
      extension: {
        captureBaseUrl: "http://127.0.0.1:3000",
        enabled: true,
      },
      telegram: {
        baseUrl: "http://127.0.0.1:3000",
        botToken: "",
        botUsername: "@memduck_bot",
        enabled: true,
      },
      web: {
        enabled: true,
      },
    });
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
});
