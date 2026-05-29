import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockService = {
  ask: vi.fn(),
  getMobileSession: vi.fn(),
  ingest: vi.fn(),
  recordChannelHeartbeat: vi.fn(),
  redeemMobileInviteWithApple: vi.fn(),
};

vi.mock("@/lib/memduck/runtime", () => ({
  getMemduckService: vi.fn(async () => mockService),
}));

vi.mock("@/lib/mobile/apple", () => ({
  verifyAppleIdentityToken: vi.fn(async () => ({
    email: "user@example.com",
    subject: "apple-subject-1",
  })),
}));

describe("mobile API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("redeems an invite with an Apple identity token", async () => {
    mockService.redeemMobileInviteWithApple.mockReturnValueOnce({
      accessToken: "mdk_access_token",
      account: {
        appleSubject: "apple-subject-1",
        createdAt: "2026-05-30T10:00:00.000Z",
        email: "user@example.com",
        id: "mobile-account-1",
        updatedAt: "2026-05-30T10:00:00.000Z",
      },
      refreshToken: "mdk_refresh_token",
    });

    const { POST } = await import("../app/api/mobile/auth/apple/route");
    const response = await POST(
      new Request("http://localhost/api/mobile/auth/apple", {
        body: JSON.stringify({
          identityToken: "apple.jwt.token",
          inviteCode: "TESTFLIGHT-1",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      accessToken: "mdk_access_token",
      account: {
        id: "mobile-account-1",
      },
      refreshToken: "mdk_refresh_token",
    });
    expect(mockService.redeemMobileInviteWithApple).toHaveBeenCalledWith({
      appleEmail: "user@example.com",
      appleSubject: "apple-subject-1",
      inviteCode: "TESTFLIGHT-1",
    });
  });

  it("returns the current mobile session for a bearer token", async () => {
    mockService.getMobileSession.mockReturnValueOnce({
      account: {
        appleSubject: "apple-subject-1",
        createdAt: "2026-05-30T10:00:00.000Z",
        email: "user@example.com",
        id: "mobile-account-1",
        updatedAt: "2026-05-30T10:00:00.000Z",
      },
      session: {
        accessToken: "mdk_access_token",
        accountId: "mobile-account-1",
        createdAt: "2026-05-30T10:00:00.000Z",
        expiresAt: "2026-06-29T10:00:00.000Z",
        id: "mobile-session-1",
        refreshToken: "mdk_refresh_token",
      },
    });

    const { GET } = await import("../app/api/mobile/session/route");
    const response = await GET(
      new Request("http://localhost/api/mobile/session", {
        headers: { authorization: "Bearer mdk_access_token" },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      account: { id: "mobile-account-1" },
    });
  });

  it("captures mobile text through the ios channel", async () => {
    mockService.getMobileSession.mockReturnValueOnce({
      account: { id: "mobile-account-1" },
      session: { id: "mobile-session-1" },
    });
    mockService.ingest.mockResolvedValueOnce({
      memoryCard: {
        createdAt: "2026-05-30T10:00:00.000Z",
        deepSummary: "",
        evidence: [],
        id: "card-1",
        keyPoints: [],
        sequence: 1,
        sourceChannel: "ios",
        sourceItemId: "source-1",
        status: "quick_ready",
        summary: "Captured from iOS",
        title: "iOS capture",
        topicIds: [],
        updatedAt: "2026-05-30T10:00:00.000Z",
        worthSaving: true,
      },
      sourceItem: {
        createdAt: "2026-05-30T10:00:00.000Z",
        id: "source-1",
        kind: "text",
        sourceChannel: "ios",
      },
    });

    const { POST } = await import("../app/api/mobile/captures/route");
    const response = await POST(
      new Request("http://localhost/api/mobile/captures", {
        body: JSON.stringify({
          kind: "text",
          payload: { text: "Saved from iOS share extension." },
          requestedDepth: "quick",
          sourceContext: { pageTitle: "Share Extension" },
        }),
        headers: {
          authorization: "Bearer mdk_access_token",
          "content-type": "application/json",
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    expect(mockService.ingest).toHaveBeenCalledWith({
      kind: "text",
      payload: { text: "Saved from iOS share extension." },
      requestedDepth: "quick",
      sourceChannel: "ios",
      sourceContext: { pageTitle: "Share Extension" },
    });
    expect(mockService.recordChannelHeartbeat).toHaveBeenCalledWith({
      channel: "ios",
      metadata: { accountId: "mobile-account-1", ingress: "mobile" },
      occurredAt: expect.any(String),
    });
  });

  it("asks through the shared active conversation", async () => {
    mockService.getMobileSession.mockReturnValueOnce({
      account: { id: "mobile-account-1" },
      session: { id: "mobile-session-1" },
    });
    mockService.ask.mockResolvedValueOnce({
      answer: "Shared active answer",
      citations: [],
      conversationId: "conversation-1",
    });

    const { POST } = await import("../app/api/mobile/ask/route");
    const response = await POST(
      new Request("http://localhost/api/mobile/ask", {
        body: JSON.stringify({ question: "What changed?" }),
        headers: {
          authorization: "Bearer mdk_access_token",
          "content-type": "application/json",
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      answer: "Shared active answer",
      conversationId: "conversation-1",
    });
    expect(mockService.ask).toHaveBeenCalledWith({
      question: "What changed?",
    });
  });
});
