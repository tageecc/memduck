import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createMemduckService } from "../src/lib/memduck/service";

const testRuntimeDir = path.join(process.cwd(), ".memduck/mobile-auth-test");

describe("mobile auth service", () => {
  beforeEach(async () => {
    await import("node:fs/promises").then((fs) =>
      fs.rm(testRuntimeDir, { force: true, recursive: true }),
    );
  });

  afterEach(async () => {
    await import("node:fs/promises").then((fs) =>
      fs.rm(testRuntimeDir, { force: true, recursive: true }),
    );
  });

  it("redeems an invite into an Apple-backed mobile account and session", () => {
    const service = createMemduckService({
      now: () => new Date("2026-05-30T10:00:00.000Z"),
      runtimeDir: testRuntimeDir,
    });

    const invite = service.createMobileInvite({
      code: "TESTFLIGHT-1",
      maxRedemptions: 1,
    });
    const session = service.redeemMobileInviteWithApple({
      appleEmail: "user@example.com",
      appleSubject: "apple-subject-1",
      inviteCode: invite.code,
    });

    expect(session.account.appleSubject).toBe("apple-subject-1");
    expect(session.account.email).toBe("user@example.com");
    expect(session.accessToken).toMatch(/^mdk_access_/);
    expect(session.refreshToken).toMatch(/^mdk_refresh_/);
    expect(service.getMobileSession(session.accessToken)?.account.id).toBe(
      session.account.id,
    );
  });

  it("rejects an invite after the redemption limit is reached", () => {
    const service = createMemduckService({
      runtimeDir: testRuntimeDir,
    });

    service.createMobileInvite({ code: "LIMITED", maxRedemptions: 1 });
    service.redeemMobileInviteWithApple({
      appleEmail: "first@example.com",
      appleSubject: "first",
      inviteCode: "LIMITED",
    });

    expect(() =>
      service.redeemMobileInviteWithApple({
        appleEmail: "second@example.com",
        appleSubject: "second",
        inviteCode: "LIMITED",
      }),
    ).toThrow("Invite code has already been used.");
  });

  it("registers a mobile device against an authenticated account", () => {
    const service = createMemduckService({
      runtimeDir: testRuntimeDir,
    });
    service.createMobileInvite({ code: "DEVICE", maxRedemptions: 1 });
    const session = service.redeemMobileInviteWithApple({
      appleEmail: "device@example.com",
      appleSubject: "device-subject",
      inviteCode: "DEVICE",
    });

    const device = service.registerMobileDevice({
      accountId: session.account.id,
      appVersion: "1.0.0",
      deviceName: "Tage iPhone",
      platform: "ios",
      pushToken: "push-token-1",
    });

    expect(device.accountId).toBe(session.account.id);
    expect(device.platform).toBe("ios");
    expect(device.pushToken).toBe("push-token-1");
  });

  it("reuses the active conversation until it is manually cleared", () => {
    const service = createMemduckService({
      runtimeDir: testRuntimeDir,
    });

    const first = service.recordConversationTurn({
      assistant: { content: "Saved from iOS." },
      user: { content: "Initial mobile capture" },
    });
    const second = service.recordConversationTurn({
      assistant: { content: "Saved from Telegram." },
      user: { content: "Follow-up channel capture" },
    });

    expect(service.getActiveConversationId()).toBe(first.conversation.id);
    expect(second.conversation.id).toBe(first.conversation.id);

    service.clearActiveConversation();

    const third = service.recordConversationTurn({
      assistant: { content: "Fresh answer." },
      user: { content: "Start a separate session" },
    });

    expect(third.conversation.id).not.toBe(first.conversation.id);
    expect(service.getActiveConversationId()).toBe(third.conversation.id);
  });
});
