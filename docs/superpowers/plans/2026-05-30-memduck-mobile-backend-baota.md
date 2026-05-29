# memduck Mobile Backend and Baota Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first cloud-mobile backend slice for memduck and prepare a BaoTa/BT Panel deployment path for `https://memduck.talkape.net`.

**Architecture:** Add a first-party mobile API layer on top of the existing memduck service instead of forcing iOS to call web-oriented routes. Keep existing local web behavior working by preserving the current single-user runtime path, while adding authenticated mobile session primitives, an `ios` channel, capture APIs, and active conversation APIs. Deployment is a single-server BaoTa Node/PM2 deployment on port `3030`, managed through the BaoTa GUI with release/build steps handled by a webhook-safe script.

**Tech Stack:** Next.js 16 app routes, TypeScript, Zod, better-sqlite3, Vitest, pnpm, PM2, BaoTa Node project, Safari + Computer Use for panel deployment.

---

## Scope Boundary

This plan implements the backend and deployment foundation only. It does not scaffold the SwiftUI app, Share Extension, App Intents target, or App Store metadata. Those belong in the next plan after this backend is verified locally and deployed.

The backend remains compatible with existing local web use. Mobile auth gates only `/api/mobile/*` routes.

## File Map

- Modify `src/lib/channels/catalog.ts`: add the first-party `ios` channel.
- Modify `src/lib/channels/runtime-registry.ts`: mark `ios` as a native runtime channel.
- Modify `src/lib/memduck/contracts.ts`: add mobile auth, session, capture, and device schemas.
- Modify `src/lib/memduck/types.ts`: add mobile account/session/invite/device types.
- Modify `src/lib/storage/database.ts`: add mobile account/session/invite/device tables.
- Modify `src/lib/memduck/service.ts`: add mobile invite/session/account/device methods and mobile capture helpers.
- Create `src/lib/mobile/auth.ts`: bearer-token parsing and mobile route auth helper.
- Create `src/lib/mobile/apple.ts`: Apple identity-token parsing interface for the first backend slice.
- Create `src/lib/mobile/responses.ts`: shared mobile error helpers.
- Create `app/api/mobile/auth/apple/route.ts`: invite + Apple sign-in endpoint.
- Create `app/api/mobile/session/route.ts`: current mobile session endpoint.
- Create `app/api/mobile/conversations/active/route.ts`: active conversation endpoint.
- Create `app/api/mobile/conversations/new/route.ts`: explicit new conversation endpoint.
- Create `app/api/mobile/ask/route.ts`: mobile Ask endpoint.
- Create `app/api/mobile/captures/route.ts`: JSON mobile capture endpoint.
- Create `app/api/mobile/captures/multipart/route.ts`: image/file capture endpoint.
- Create `app/api/mobile/memory/recent/route.ts`: recent memory endpoint.
- Create `app/api/mobile/memory/[id]/route.ts`: memory detail endpoint.
- Create `app/api/mobile/devices/route.ts`: mobile device registration endpoint.
- Create `tests/mobile-auth.test.ts`: service-level mobile auth tests.
- Create `tests/mobile-api-routes.test.ts`: app-route mobile API tests.
- Modify `tests/contracts-and-channels.test.ts`: channel catalog and schema coverage.
- Create `ecosystem.config.cjs`: PM2 runtime config for BaoTa.
- Create `deploy.sh`: webhook-safe deploy script.
- Modify `.gitignore`: ignore `/deploy.log`.
- Create `docs/deploy/baota-mobile-backend.md`: Safari + BaoTa GUI deployment runbook.

## Task 1: Register iOS as a First-Party Channel

**Files:**
- Modify: `src/lib/channels/catalog.ts`
- Modify: `src/lib/channels/runtime-registry.ts`
- Modify: `src/lib/memduck/contracts.ts`
- Test: `tests/contracts-and-channels.test.ts`

- [ ] **Step 1: Write the failing catalog test**

Add this test inside the existing channel catalog describe block in `tests/contracts-and-channels.test.ts`:

```ts
it("treats ios as a first-party native channel", () => {
  expect(channelCatalogIds).toContain("ios");
  expect(sourceChannelSchema.safeParse("ios").success).toBe(true);
  expect(
    getChannelRuntimeReadiness({
      channels: {
        ios: {
          enabled: true,
          values: {},
        },
      },
      extension: {
        captureBaseUrl: "http://127.0.0.1:3000",
        enabled: false,
      },
      telegram: {
        baseUrl: "http://127.0.0.1:3000",
        botToken: "",
        botUsername: "",
        enabled: false,
      },
      web: {
        enabled: true,
      },
    }).ios,
  ).toMatchObject({
    enabled: true,
    ready: true,
    status: "native",
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm test tests/contracts-and-channels.test.ts -- --runInBand
```

Expected: FAIL because `"ios"` is not in `channelCatalogIds`.

- [ ] **Step 3: Add `ios` to the catalog and native runtime set**

In `src/lib/channels/catalog.ts`, insert `"ios"` after `"extension"` in `channelCatalogIds`, then insert this catalog entry after Browser extension:

```ts
{
  category: "local",
  connectMode: "local",
  docsUrl: "/docs/mobile/ios",
  fields: [],
  id: "ios",
  label: "iOS app",
},
```

In `src/lib/channels/runtime-registry.ts`, change:

```ts
const nativeRuntimeIds = new Set<ChannelCatalogId>(["extension", "telegram"]);
```

to:

```ts
const nativeRuntimeIds = new Set<ChannelCatalogId>([
  "extension",
  "ios",
  "telegram",
]);
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
pnpm test tests/contracts-and-channels.test.ts -- --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/channels/catalog.ts src/lib/channels/runtime-registry.ts tests/contracts-and-channels.test.ts
git commit -m "feat: register ios channel"
```

## Task 2: Add Mobile Account, Invite, Session, and Device Storage

**Files:**
- Modify: `src/lib/storage/database.ts`
- Modify: `src/lib/memduck/types.ts`
- Modify: `src/lib/memduck/service.ts`
- Test: `tests/mobile-auth.test.ts`

- [ ] **Step 1: Write the failing service tests**

Create `tests/mobile-auth.test.ts`:

```ts
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
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
pnpm test tests/mobile-auth.test.ts
```

Expected: FAIL because `createMobileInvite`, `redeemMobileInviteWithApple`, `getMobileSession`, and `registerMobileDevice` do not exist.

- [ ] **Step 3: Add mobile types**

Append these interfaces to `src/lib/memduck/types.ts`:

```ts
export interface MobileAccount {
  appleSubject: string;
  createdAt: string;
  email?: string;
  id: string;
  updatedAt: string;
}

export interface MobileInvite {
  code: string;
  createdAt: string;
  id: string;
  maxRedemptions: number;
  redeemedCount: number;
  updatedAt: string;
}

export interface MobileSession {
  accessToken: string;
  accountId: string;
  createdAt: string;
  expiresAt: string;
  id: string;
  refreshToken: string;
}

export interface MobileDevice {
  accountId: string;
  appVersion?: string;
  createdAt: string;
  deviceName?: string;
  id: string;
  platform: "ios";
  pushToken?: string;
  updatedAt: string;
}
```

- [ ] **Step 4: Add SQLite tables**

In `src/lib/storage/database.ts`, inside `database.exec`, add:

```sql
CREATE TABLE IF NOT EXISTS mobile_accounts (
  id TEXT PRIMARY KEY,
  apple_subject TEXT NOT NULL UNIQUE,
  email TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS mobile_invites (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  max_redemptions INTEGER NOT NULL,
  redeemed_count INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS mobile_sessions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  access_token TEXT NOT NULL UNIQUE,
  refresh_token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(account_id) REFERENCES mobile_accounts(id)
);

CREATE TABLE IF NOT EXISTS mobile_devices (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  device_name TEXT,
  app_version TEXT,
  push_token TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(account_id) REFERENCES mobile_accounts(id)
);
```

- [ ] **Step 5: Add service methods**

In `src/lib/memduck/service.ts`, import the new types from `./types`, then add public methods near the existing settings/channel methods:

```ts
createMobileInvite(input: {
  code: string;
  maxRedemptions: number;
}): MobileInvite {
  const now = this.now().toISOString();
  const invite: MobileInvite = {
    code: cleanText(input.code),
    createdAt: now,
    id: `mobile-invite-${globalThis.crypto.randomUUID()}`,
    maxRedemptions: input.maxRedemptions,
    redeemedCount: 0,
    updatedAt: now,
  };

  if (!invite.code) {
    throw new Error("Invite code is required.");
  }

  this.database
    .prepare(
      `INSERT INTO mobile_invites (
        id, code, max_redemptions, redeemed_count, created_at, updated_at
      ) VALUES (
        @id, @code, @maxRedemptions, @redeemedCount, @createdAt, @updatedAt
      )`,
    )
    .run(invite);

  return invite;
}

redeemMobileInviteWithApple(input: {
  appleEmail?: string;
  appleSubject: string;
  inviteCode: string;
}): { accessToken: string; account: MobileAccount; refreshToken: string } {
  const invite = this.database
    .prepare("SELECT * FROM mobile_invites WHERE code = ?")
    .get(cleanText(input.inviteCode)) as Record<string, unknown> | undefined;

  if (!invite) {
    throw new Error("Invite code is invalid.");
  }

  const redeemedCount = Number(invite.redeemed_count ?? 0);
  const maxRedemptions = Number(invite.max_redemptions ?? 0);
  if (redeemedCount >= maxRedemptions) {
    throw new Error("Invite code has already been used.");
  }

  const now = this.now().toISOString();
  const account = this.upsertMobileAccount({
    appleEmail: input.appleEmail,
    appleSubject: input.appleSubject,
    now,
  });
  this.database
    .prepare(
      `UPDATE mobile_invites
       SET redeemed_count = redeemed_count + 1, updated_at = ?
       WHERE code = ?`,
    )
    .run(now, cleanText(input.inviteCode));
  const session = this.createMobileSession(account.id, now);

  return {
    accessToken: session.accessToken,
    account,
    refreshToken: session.refreshToken,
  };
}

getMobileSession(accessToken: string): { account: MobileAccount; session: MobileSession } | null {
  const token = cleanText(accessToken);
  if (!token) {
    return null;
  }

  const row = this.database
    .prepare("SELECT * FROM mobile_sessions WHERE access_token = ?")
    .get(token) as Record<string, unknown> | undefined;
  if (!row || new Date(String(row.expires_at)).getTime() <= this.now().getTime()) {
    return null;
  }

  const account = this.getMobileAccount(String(row.account_id));
  return account
    ? {
        account,
        session: toMobileSession(row),
      }
    : null;
}

registerMobileDevice(input: {
  accountId: string;
  appVersion?: string;
  deviceName?: string;
  platform: "ios";
  pushToken?: string;
}): MobileDevice {
  const now = this.now().toISOString();
  const device: MobileDevice = {
    accountId: cleanText(input.accountId),
    appVersion: input.appVersion ? cleanText(input.appVersion) : undefined,
    createdAt: now,
    deviceName: input.deviceName ? cleanText(input.deviceName) : undefined,
    id: `mobile-device-${globalThis.crypto.randomUUID()}`,
    platform: "ios",
    pushToken: input.pushToken ? cleanText(input.pushToken) : undefined,
    updatedAt: now,
  };

  this.database
    .prepare(
      `INSERT INTO mobile_devices (
        id, account_id, platform, device_name, app_version, push_token, created_at, updated_at
      ) VALUES (
        @id, @accountId, @platform, @deviceName, @appVersion, @pushToken, @createdAt, @updatedAt
      )`,
    )
    .run(device);

  return device;
}
```

Add private helpers near existing private mapping helpers:

```ts
private upsertMobileAccount(input: {
  appleEmail?: string;
  appleSubject: string;
  now: string;
}): MobileAccount {
  const appleSubject = cleanText(input.appleSubject);
  if (!appleSubject) {
    throw new Error("Apple subject is required.");
  }

  const existing = this.database
    .prepare("SELECT * FROM mobile_accounts WHERE apple_subject = ?")
    .get(appleSubject) as Record<string, unknown> | undefined;

  if (existing) {
    this.database
      .prepare(
        `UPDATE mobile_accounts
         SET email = COALESCE(?, email), updated_at = ?
         WHERE apple_subject = ?`,
      )
      .run(input.appleEmail ? cleanText(input.appleEmail) : null, input.now, appleSubject);
    return this.getMobileAccount(String(existing.id)) as MobileAccount;
  }

  const account: MobileAccount = {
    appleSubject,
    createdAt: input.now,
    email: input.appleEmail ? cleanText(input.appleEmail) : undefined,
    id: `mobile-account-${globalThis.crypto.randomUUID()}`,
    updatedAt: input.now,
  };

  this.database
    .prepare(
      `INSERT INTO mobile_accounts (
        id, apple_subject, email, created_at, updated_at
      ) VALUES (
        @id, @appleSubject, @email, @createdAt, @updatedAt
      )`,
    )
    .run(account);

  return account;
}

private createMobileSession(accountId: string, now: string): MobileSession {
  const session: MobileSession = {
    accessToken: `mdk_access_${globalThis.crypto.randomUUID()}`,
    accountId,
    createdAt: now,
    expiresAt: new Date(this.now().getTime() + 1000 * 60 * 60 * 24 * 30).toISOString(),
    id: `mobile-session-${globalThis.crypto.randomUUID()}`,
    refreshToken: `mdk_refresh_${globalThis.crypto.randomUUID()}`,
  };

  this.database
    .prepare(
      `INSERT INTO mobile_sessions (
        id, account_id, access_token, refresh_token, expires_at, created_at
      ) VALUES (
        @id, @accountId, @accessToken, @refreshToken, @expiresAt, @createdAt
      )`,
    )
    .run(session);

  return session;
}

private getMobileAccount(accountId: string): MobileAccount | null {
  const row = this.database
    .prepare("SELECT * FROM mobile_accounts WHERE id = ?")
    .get(accountId) as Record<string, unknown> | undefined;
  return row ? toMobileAccount(row) : null;
}
```

Add top-level mapping helpers:

```ts
function toMobileAccount(row: Record<string, unknown>): MobileAccount {
  return {
    appleSubject: row.apple_subject as string,
    createdAt: row.created_at as string,
    email: (row.email as string | null) ?? undefined,
    id: row.id as string,
    updatedAt: row.updated_at as string,
  };
}

function toMobileSession(row: Record<string, unknown>): MobileSession {
  return {
    accessToken: row.access_token as string,
    accountId: row.account_id as string,
    createdAt: row.created_at as string,
    expiresAt: row.expires_at as string,
    id: row.id as string,
    refreshToken: row.refresh_token as string,
  };
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run:

```bash
pnpm test tests/mobile-auth.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/storage/database.ts src/lib/memduck/types.ts src/lib/memduck/service.ts tests/mobile-auth.test.ts
git commit -m "feat: add mobile auth storage"
```

## Task 3: Add Mobile Auth Route Helpers and Apple Sign-In Endpoint

**Files:**
- Create: `src/lib/mobile/apple.ts`
- Create: `src/lib/mobile/auth.ts`
- Create: `src/lib/mobile/responses.ts`
- Modify: `src/lib/memduck/contracts.ts`
- Create: `app/api/mobile/auth/apple/route.ts`
- Create: `app/api/mobile/session/route.ts`
- Test: `tests/mobile-api-routes.test.ts`

- [ ] **Step 1: Add route tests for invite + Apple sign-in**

Create `tests/mobile-api-routes.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockService = {
  getMobileSession: vi.fn(),
  redeemMobileInviteWithApple: vi.fn(),
};

vi.mock("../src/lib/memduck/runtime", () => ({
  getMemduckService: vi.fn(async () => mockService),
}));

vi.mock("../src/lib/mobile/apple", () => ({
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
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
pnpm test tests/mobile-api-routes.test.ts
```

Expected: FAIL because the mobile routes and helpers do not exist.

- [ ] **Step 3: Add mobile contract schemas**

Append to `src/lib/memduck/contracts.ts`:

```ts
export const mobileAppleAuthSchema = z.object({
  identityToken: z.string().trim().min(1),
  inviteCode: z.string().trim().min(1),
});

export const mobileDeviceSchema = z.object({
  appVersion: z.string().trim().min(1).optional(),
  deviceName: z.string().trim().min(1).optional(),
  platform: z.literal("ios"),
  pushToken: z.string().trim().min(1).optional(),
});
```

- [ ] **Step 4: Add Apple verifier and auth helpers**

Create `src/lib/mobile/apple.ts`:

```ts
export interface VerifiedAppleIdentity {
  email?: string;
  subject: string;
}

export async function verifyAppleIdentityToken(
  identityToken: string,
): Promise<VerifiedAppleIdentity> {
  const parts = identityToken.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid Apple identity token.");
  }

  const payload = JSON.parse(
    Buffer.from(parts[1] ?? "", "base64url").toString("utf8"),
  ) as { email?: string; sub?: string };

  if (!payload.sub) {
    throw new Error("Apple identity token is missing a subject.");
  }

  return {
    email: payload.email,
    subject: payload.sub,
  };
}
```

Create `src/lib/mobile/auth.ts`:

```ts
import { getMemduckService } from "@/lib/memduck/runtime";

export function readBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export async function requireMobileSession(request: Request) {
  const token = readBearerToken(request);
  if (!token) {
    return null;
  }

  const service = await getMemduckService();
  return service.getMobileSession(token);
}
```

Create `src/lib/mobile/responses.ts`:

```ts
import { NextResponse } from "next/server";

export function mobileUnauthorized() {
  return NextResponse.json(
    { error: "Mobile authentication is required." },
    { status: 401 },
  );
}

export function mobileBadRequest(error: string, issues?: unknown) {
  return NextResponse.json({ error, issues }, { status: 400 });
}
```

- [ ] **Step 5: Add auth and session routes**

Create `app/api/mobile/auth/apple/route.ts`:

```ts
import { NextResponse } from "next/server";

import { readJsonRequest } from "@/lib/http/json-request";
import { mobileAppleAuthSchema } from "@/lib/memduck/contracts";
import { getMemduckService } from "@/lib/memduck/runtime";
import { verifyAppleIdentityToken } from "@/lib/mobile/apple";
import { mobileBadRequest } from "@/lib/mobile/responses";

export async function POST(request: Request) {
  const json = await readJsonRequest(request);
  if (!json.ok) {
    return json.response;
  }

  const parsed = mobileAppleAuthSchema.safeParse(json.body);
  if (!parsed.success) {
    return mobileBadRequest("Invalid mobile Apple auth request.", parsed.error.flatten());
  }

  try {
    const apple = await verifyAppleIdentityToken(parsed.data.identityToken);
    const service = await getMemduckService();
    const session = service.redeemMobileInviteWithApple({
      appleEmail: apple.email,
      appleSubject: apple.subject,
      inviteCode: parsed.data.inviteCode,
    });

    return NextResponse.json(session);
  } catch (error) {
    return mobileBadRequest(
      error instanceof Error ? error.message : "Mobile sign-in failed.",
    );
  }
}
```

Create `app/api/mobile/session/route.ts`:

```ts
import { NextResponse } from "next/server";

import { requireMobileSession } from "@/lib/mobile/auth";
import { mobileUnauthorized } from "@/lib/mobile/responses";

export async function GET(request: Request) {
  const session = await requireMobileSession(request);
  if (!session) {
    return mobileUnauthorized();
  }

  return NextResponse.json(session);
}
```

- [ ] **Step 6: Run tests**

Run:

```bash
pnpm test tests/mobile-api-routes.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/mobile src/lib/memduck/contracts.ts app/api/mobile/auth/apple/route.ts app/api/mobile/session/route.ts tests/mobile-api-routes.test.ts
git commit -m "feat: add mobile apple auth api"
```

## Task 4: Add Mobile Ask, Conversation, Capture, Memory, and Device Routes

**Files:**
- Create: `app/api/mobile/conversations/active/route.ts`
- Create: `app/api/mobile/conversations/new/route.ts`
- Create: `app/api/mobile/ask/route.ts`
- Create: `app/api/mobile/captures/route.ts`
- Create: `app/api/mobile/captures/multipart/route.ts`
- Create: `app/api/mobile/memory/recent/route.ts`
- Create: `app/api/mobile/memory/[id]/route.ts`
- Create: `app/api/mobile/devices/route.ts`
- Modify: `tests/mobile-api-routes.test.ts`

- [ ] **Step 1: Add route tests**

Append to `tests/mobile-api-routes.test.ts`:

```ts
it("captures mobile text through the ios channel", async () => {
  mockService.getMobileSession.mockReturnValueOnce({
    account: { id: "mobile-account-1" },
    session: { id: "mobile-session-1" },
  });
  mockService.ingest = vi.fn(async () => ({
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
  }));
  mockService.recordChannelHeartbeat = vi.fn();

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
  mockService.ask = vi.fn(async () => ({
    answer: "Shared active answer",
    citations: [],
    conversationId: "conversation-1",
  }));

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
  expect(mockService.ask).toHaveBeenCalledWith({ question: "What changed?" });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
pnpm test tests/mobile-api-routes.test.ts
```

Expected: FAIL because the mobile capture and ask routes do not exist.

- [ ] **Step 3: Add mobile Ask route**

Create `app/api/mobile/ask/route.ts`:

```ts
import { NextResponse } from "next/server";

import { readJsonRequest } from "@/lib/http/json-request";
import { askRequestSchema } from "@/lib/memduck/contracts";
import { getMemduckService } from "@/lib/memduck/runtime";
import { requireMobileSession } from "@/lib/mobile/auth";
import { mobileBadRequest, mobileUnauthorized } from "@/lib/mobile/responses";

export async function POST(request: Request) {
  const session = await requireMobileSession(request);
  if (!session) {
    return mobileUnauthorized();
  }

  const json = await readJsonRequest(request);
  if (!json.ok) {
    return json.response;
  }

  const parsed = askRequestSchema.safeParse(json.body);
  if (!parsed.success) {
    return mobileBadRequest("Invalid mobile ask request.", parsed.error.flatten());
  }

  const service = await getMemduckService();
  return NextResponse.json(await service.ask(parsed.data));
}
```

- [ ] **Step 4: Add mobile capture route**

Create `app/api/mobile/captures/route.ts`:

```ts
import { NextResponse } from "next/server";

import { readJsonRequest } from "@/lib/http/json-request";
import { inputEnvelopeSchema } from "@/lib/memduck/contracts";
import { getMemduckService } from "@/lib/memduck/runtime";
import type { InputEnvelope } from "@/lib/memduck/service";
import { requireMobileSession } from "@/lib/mobile/auth";
import { mobileBadRequest, mobileUnauthorized } from "@/lib/mobile/responses";

export async function POST(request: Request) {
  const session = await requireMobileSession(request);
  if (!session) {
    return mobileUnauthorized();
  }

  const json = await readJsonRequest(request);
  if (!json.ok) {
    return json.response;
  }

  const body = json.body as Omit<InputEnvelope, "sourceChannel">;
  const parsed = inputEnvelopeSchema.safeParse({
    ...body,
    sourceChannel: "ios",
  });
  if (!parsed.success) {
    return mobileBadRequest("Invalid mobile capture.", parsed.error.flatten());
  }

  const service = await getMemduckService();
  service.recordChannelHeartbeat({
    channel: "ios",
    metadata: { accountId: session.account.id, ingress: "mobile" },
    occurredAt: new Date().toISOString(),
  });
  return NextResponse.json(await service.ingest(parsed.data));
}
```

- [ ] **Step 5: Add active and new conversation routes**

Create `app/api/mobile/conversations/active/route.ts`:

```ts
import { NextResponse } from "next/server";

import { getMemduckService } from "@/lib/memduck/runtime";
import { requireMobileSession } from "@/lib/mobile/auth";
import { mobileUnauthorized } from "@/lib/mobile/responses";

export async function GET(request: Request) {
  const session = await requireMobileSession(request);
  if (!session) {
    return mobileUnauthorized();
  }

  const service = await getMemduckService();
  const activeConversationId = service.getActiveConversationId();
  return NextResponse.json({
    activeConversationId,
    conversation: activeConversationId
      ? service.getConversationThread(activeConversationId)
      : null,
  });
}
```

Create `app/api/mobile/conversations/new/route.ts`:

```ts
import { NextResponse } from "next/server";

import { getMemduckService } from "@/lib/memduck/runtime";
import { requireMobileSession } from "@/lib/mobile/auth";
import { mobileUnauthorized } from "@/lib/mobile/responses";

export async function POST(request: Request) {
  const session = await requireMobileSession(request);
  if (!session) {
    return mobileUnauthorized();
  }

  const service = await getMemduckService();
  service.clearActiveConversation();
  return NextResponse.json({ activeConversationId: null });
}
```

- [ ] **Step 6: Add memory and device routes**

Create `app/api/mobile/memory/recent/route.ts`:

```ts
import { NextResponse } from "next/server";

import { getMemduckService } from "@/lib/memduck/runtime";
import { requireMobileSession } from "@/lib/mobile/auth";
import { mobileUnauthorized } from "@/lib/mobile/responses";

export async function GET(request: Request) {
  const session = await requireMobileSession(request);
  if (!session) {
    return mobileUnauthorized();
  }

  const service = await getMemduckService();
  return NextResponse.json({
    memoryCards: service.listMemoryCards().slice(0, 30),
  });
}
```

Create `app/api/mobile/memory/[id]/route.ts`:

```ts
import { NextResponse } from "next/server";

import { getMemduckService } from "@/lib/memduck/runtime";
import { requireMobileSession } from "@/lib/mobile/auth";
import { mobileUnauthorized } from "@/lib/mobile/responses";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requireMobileSession(request);
  if (!session) {
    return mobileUnauthorized();
  }

  const { id } = await context.params;
  const service = await getMemduckService();
  const memoryCard = service.getMemoryCard(id);
  if (!memoryCard) {
    return NextResponse.json({ error: "Memory card not found." }, { status: 404 });
  }

  return NextResponse.json({
    memoryCard,
    sourceChunks: service.listSourceChunks(memoryCard.sourceItemId),
  });
}
```

Create `app/api/mobile/devices/route.ts`:

```ts
import { NextResponse } from "next/server";

import { readJsonRequest } from "@/lib/http/json-request";
import { mobileDeviceSchema } from "@/lib/memduck/contracts";
import { getMemduckService } from "@/lib/memduck/runtime";
import { requireMobileSession } from "@/lib/mobile/auth";
import { mobileBadRequest, mobileUnauthorized } from "@/lib/mobile/responses";

export async function POST(request: Request) {
  const session = await requireMobileSession(request);
  if (!session) {
    return mobileUnauthorized();
  }

  const json = await readJsonRequest(request);
  if (!json.ok) {
    return json.response;
  }

  const parsed = mobileDeviceSchema.safeParse(json.body);
  if (!parsed.success) {
    return mobileBadRequest("Invalid mobile device.", parsed.error.flatten());
  }

  const service = await getMemduckService();
  return NextResponse.json(
    service.registerMobileDevice({
      accountId: session.account.id,
      ...parsed.data,
    }),
  );
}
```

- [ ] **Step 7: Add multipart capture route**

Create `app/api/mobile/captures/multipart/route.ts` by adapting `app/api/ingest/route.ts` multipart handling, with these fixed differences:

```ts
const sourceChannel = "ios";
```

and the same auth gate:

```ts
const session = await requireMobileSession(request);
if (!session) {
  return mobileUnauthorized();
}
```

The route must save uploaded images through `createAssetStore(getRuntimeDir())`, build an `image` envelope with `sourceChannel: "ios"`, record an `ios` channel heartbeat with `accountId` and `ingress: "mobile-multipart"`, then call `service.ingest(parsed.data)`.

- [ ] **Step 8: Run targeted mobile tests**

Run:

```bash
pnpm test tests/mobile-api-routes.test.ts
```

Expected: PASS.

- [ ] **Step 9: Run broader API tests**

Run:

```bash
pnpm test tests/api-routes.test.ts tests/contracts-and-channels.test.ts tests/mobile-api-routes.test.ts
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add app/api/mobile tests/mobile-api-routes.test.ts
git commit -m "feat: add mobile backend routes"
```

## Task 5: Add BaoTa PM2 Deployment Files

**Files:**
- Create: `ecosystem.config.cjs`
- Create: `deploy.sh`
- Modify: `.gitignore`
- Create: `docs/deploy/baota-mobile-backend.md`

- [ ] **Step 1: Add PM2 config**

Create `ecosystem.config.cjs`:

```js
module.exports = {
  apps: [
    {
      name: "memduck",
      cwd: "/www/wwwroot/memduck",
      script: "node_modules/next/dist/bin/next",
      args: "start -H 127.0.0.1 -p 3030",
      exec_mode: "fork",
      instances: 1,
      watch: false,
      autorestart: true,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: "3030",
        MEMDUCK_BASE_URL: "https://memduck.talkape.net",
        MEMDUCK_RUNTIME_DIR: "/www/wwwroot/memduck/.memduck/runtime",
      },
      env_production: {
        NODE_ENV: "production",
        PORT: "3030",
        MEMDUCK_BASE_URL: "https://memduck.talkape.net",
        MEMDUCK_RUNTIME_DIR: "/www/wwwroot/memduck/.memduck/runtime",
      },
    },
  ],
};
```

- [ ] **Step 2: Add deploy script**

Create `deploy.sh`:

```bash
#!/bin/bash
set -Eeuo pipefail

PROJECT_DIR="/www/wwwroot/memduck"
BRANCH="main"
APP_NAME="memduck"
PM2_CONFIG="$PROJECT_DIR/ecosystem.config.cjs"
LOG_FILE="$PROJECT_DIR/deploy.log"
NODE_BIN_DIR="/www/server/nodejs/v24.0.0/bin"

mkdir -p "$(dirname "$LOG_FILE")"
exec >>"$LOG_FILE" 2>&1

echo "==== $(date -Is) deploy start ===="
export PATH="$NODE_BIN_DIR:/www/server/panel/pyenv/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

cd "$PROJECT_DIR"

echo "git=$(command -v git || true)"
echo "node=$(command -v node || true)"
echo "pnpm=$(command -v pnpm || true)"
echo "pm2=$(command -v pm2 || true)"

test -f package.json
test -f pnpm-lock.yaml

git fetch origin "$BRANCH"
git checkout -f "$BRANCH"
git reset --hard "origin/$BRANCH"
git clean -fd \
  -e .env \
  -e .env.local \
  -e .env.production \
  -e .memduck/ \
  -e deploy.log \
  -e .well-known/ \
  -e .htaccess

if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  pm2 stop "$APP_NAME"
fi

pnpm install --frozen-lockfile
pnpm build
test -f "$PROJECT_DIR/.next/BUILD_ID"

pm2 startOrReload "$PM2_CONFIG" --env production
pm2 save

echo "==== $(date -Is) deploy complete ===="
```

Then make it executable:

```bash
chmod +x deploy.sh
```

- [ ] **Step 3: Ignore deploy log**

Add to `.gitignore`:

```gitignore
/deploy.log
```

- [ ] **Step 4: Add BaoTa GUI runbook**

Create `docs/deploy/baota-mobile-backend.md`:

```md
# BaoTa Deployment Runbook for memduck Mobile Backend

## Target

- Panel: https://bt.talkape.net:4646/site/node
- Domain: https://memduck.talkape.net
- Project path: /www/wwwroot/memduck
- Internal port: 3030
- PM2 app name: memduck
- Runtime data: /www/wwwroot/memduck/.memduck/runtime

## GUI-first setup

1. Open the BaoTa panel in Safari.
2. Go to Node Project.
3. Create or edit the memduck Node project.
4. Set project path to `/www/wwwroot/memduck`.
5. Set run mode to PM2.
6. Set the internal port to `3030`.
7. Set the public domain to `memduck.talkape.net`.
8. Configure SSL for `memduck.talkape.net`.
9. Configure the webhook command:

```bash
bash /www/wwwroot/memduck/deploy.sh
```

## First manual deploy

Run the webhook once from the BaoTa GUI. If the GUI cannot run it, use SSH only for this narrow release command:

```bash
ssh baota-talkape 'bash /www/wwwroot/memduck/deploy.sh'
```

## Verification

Open:

- `https://memduck.talkape.net/api/setup-state`
- `https://memduck.talkape.net/channels`

Expected:

- The site responds over HTTPS.
- The Node project is visible in BaoTa.
- PM2 app `memduck` is online.
- Runtime data is under `/www/wwwroot/memduck/.memduck/runtime`.
```

- [ ] **Step 5: Run deployment file checks**

Run:

```bash
node -e "require('./ecosystem.config.cjs'); console.log('pm2 config ok')"
bash -n deploy.sh
git diff --check
```

Expected:

- `pm2 config ok`
- `bash -n deploy.sh` exits `0`
- `git diff --check` exits `0`

- [ ] **Step 6: Commit**

```bash
git add ecosystem.config.cjs deploy.sh .gitignore docs/deploy/baota-mobile-backend.md
git commit -m "chore: add baota deployment config"
```

## Task 6: Verify Backend Locally Before BaoTa Deployment

**Files:**
- No new files.

- [ ] **Step 1: Run focused tests**

```bash
pnpm test tests/mobile-auth.test.ts tests/mobile-api-routes.test.ts tests/contracts-and-channels.test.ts
```

Expected: all listed test files pass.

- [ ] **Step 2: Run full project validation**

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Expected: all commands exit `0`.

- [ ] **Step 3: Commit any verification-only fixes**

If code changes were required during verification:

```bash
git add <changed-files>
git commit -m "fix: stabilize mobile backend validation"
```

If no fixes were required, do not create an empty commit.

## Task 7: Deploy Through BaoTa with Safari + Computer Use

**Files:**
- No repository file changes expected.

- [ ] **Step 1: Open BaoTa in Safari**

Use Computer Use to open Safari at:

```text
https://bt.talkape.net:4646/site/node
```

Expected: BaoTa Node Project page is visible.

- [ ] **Step 2: Create or update the Node project in BaoTa GUI**

Set:

```text
Project name: memduck
Project path: /www/wwwroot/memduck
Internal port: 3030
Run mode: PM2
Domain: memduck.talkape.net
Webhook command: bash /www/wwwroot/memduck/deploy.sh
```

Expected: BaoTa displays a Node project for memduck.

- [ ] **Step 3: Trigger deploy from BaoTa GUI**

Run the configured webhook or BaoTa deployment action.

Expected: `deploy.sh` completes and PM2 app `memduck` is online.

- [ ] **Step 4: Verify public backend**

Open in Safari:

```text
https://memduck.talkape.net/api/setup-state
https://memduck.talkape.net/channels
```

Expected:

- Both URLs return successful responses.
- `/channels` loads the web UI.
- BaoTa Node Project status remains running.

- [ ] **Step 5: Use SSH only for narrow diagnostics if needed**

If BaoTa GUI shows a failed deploy, run read-only diagnostics:

```bash
ssh baota-talkape 'tail -n 120 /www/wwwroot/memduck/deploy.log; pm2 status memduck || true'
```

Expected: output identifies the failing command. Do not edit BaoTa-owned Nginx, website, SSL, firewall, or service configuration from SSH.

## Self-Review

- Spec coverage: this plan covers iOS channel registration, mobile auth primitives, mobile API facade, shared active conversation API, iOS capture, recent memory, device registration, BaoTa deployment config, and Safari + Computer Use deployment. SwiftUI app implementation, Share Extension implementation, App Intents implementation, widgets, and App Store metadata are intentionally outside this backend deployment plan.
- Placeholder scan: no incomplete path references remain.
- Type consistency: mobile account/session/invite/device names match the schemas, routes, and tests in this plan.
