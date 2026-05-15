# OpenClaw Channel and Model Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Bring memduck's channel and model configuration/runtime model in line with OpenClaw, covering all OpenClaw-style provider presets and all supported channel catalog entries, with native runtime work starting from Telegram, Slack, Discord, Feishu, WhatsApp, and Dingtalk.

**Architecture:** Keep catalog data separate from runtime adapters. Provider/model selection remains catalog-driven and expands compact user choices into internal capability settings. Channel runtime adapters register with a shared registry that exposes configuration requirements, startup diagnostics, and message-to-ingest conversion.

**Tech Stack:** Next.js API routes, React settings UI, SQLite-backed app settings, TypeScript runtime adapters, Vitest contract tests, existing `grammy` Telegram runtime, future SDK adapters for Slack/Discord/Feishu/WhatsApp/Dingtalk.

---

### Task 1: Channel Catalog Parity

**Files:**
- Modify: `src/lib/channels/catalog.ts`
- Modify: `scripts/generate-channel-logos.mjs`
- Test: `tests/contracts-and-channels.test.ts`

- [x] Add `dingtalk` to `channelCatalogIds` next to Feishu and WeChat.
- [x] Add a Dingtalk catalog entry with `appKey`, `appSecret`, `robotCode`, `webhookUrl`, `webhookSecret`, and `allowFrom` fields.
- [x] Add a Dingtalk logo entry so `/channels` can render it without a missing asset.
- [x] Extend the catalog contract test to assert the first priority runtime set: `telegram`, `slack`, `discord`, `feishu`, `whatsapp`, `dingtalk`.
- [x] Run `pnpm test tests/contracts-and-channels.test.ts` and confirm the new test fails before implementation, then passes after implementation.

### Task 2: Runtime Registry Contract

**Files:**
- Create: `src/lib/channels/runtime-registry.ts`
- Create: `src/lib/channels/runtime-types.ts`
- Test: `tests/channel-runtime-registry.test.ts`

- [x] Define `ChannelRuntimeId`, `ChannelRuntimeDescriptor`, `ChannelRuntimeStatus`, and `ChannelRuntimeAdapter`.
- [x] Implement `listChannelRuntimeDescriptors()`, `getChannelRuntimeDescriptor(id)`, and `getChannelRuntimeReadiness(settings)`.
- [x] Register descriptors for Telegram, Slack, Discord, Feishu, WhatsApp, and Dingtalk.
- [x] Mark Telegram as `native` and currently startable; mark the other five as `adapter-planned` until their SDK adapters land.
- [x] Run `pnpm test tests/channel-runtime-registry.test.ts` red/green.

### Task 3: Channel Diagnostics Integration

**Files:**
- Modify: `src/lib/memduck/service.ts`
- Modify: `app/api/settings/channels/route.ts`
- Test: `tests/provider-channel-conversation.test.ts`

- [x] Add runtime readiness to channel diagnostics without changing existing `RuntimeDiagnostics.channels` shape.
- [x] Include `runtimeStatus`, `runtimeMode`, and `missingFields` in channel center payloads.
- [x] Keep existing heartbeat behavior for browser extension and Telegram.
- [x] Run `pnpm test tests/provider-channel-conversation.test.ts`.

### Task 4: Provider Catalog Hardening

**Files:**
- Modify: `src/lib/providers/provider-presets.ts`
- Test: `tests/provider-presets.test.ts`

- [x] Audit OpenClaw-style provider presets already present in memduck.
- [x] Add explicit capability flags: `chat`, `embedding`, `vision`, `rerank`.
- [x] Make `buildProviderSettings` reject provider/model combinations that cannot support memduck's required embedding path unless the provider supplies a configured embedding model.
- [x] Run `pnpm test tests/provider-presets.test.ts`.

### Task 5: First Native Runtime Adapter Migration

**Files:**
- Modify: `scripts/telegram.ts`
- Create: `src/lib/channels/runtime-telegram.ts`
- Test: `tests/channel-runtime-registry.test.ts`

- [x] Move Telegram runtime config resolution behind the runtime adapter interface.
- [x] Keep `memduck --with-telegram` working.
- [x] Add a test proving Telegram reports ready only when enabled and token/base URL are present.
- [x] Run `pnpm test tests/channel-runtime-registry.test.ts tests/retrieval-cli-and-compiler.test.ts`.

### Task 6: Full Quality Gate

**Files:**
- No code files.

- [x] Run `pnpm check`.
- [x] Fix lint, typecheck, test, extension build, CLI build, and Next build failures before reporting completion.

### Task 7: All-Channel Runtime Descriptor Coverage

**Files:**
- Modify: `src/lib/channels/runtime-registry.ts`
- Modify: `src/lib/channels/runtime-types.ts`
- Test: `tests/channel-runtime-registry.test.ts`

- [x] Add a runtime descriptor for every non-web channel in `channelCatalog`.
- [x] Keep `extension` as `native`, `telegram` as `native`, first-wave channels as `adapter-planned`, and other OpenClaw catalog channels as `adapter-planned`.
- [x] Add readiness tests that compare `listChannelRuntimeDescriptors().map(id)` with all visible channel catalog ids.
- [x] Run `pnpm test tests/channel-runtime-registry.test.ts`.

### Task 8: Runtime Adapter Interface and Telegram Adapter

**Files:**
- Create: `src/lib/channels/runtime-adapter.ts`
- Create: `src/lib/channels/runtime-telegram.ts`
- Modify: `src/lib/channels/runtime-registry.ts`
- Modify: `scripts/telegram.ts`
- Test: `tests/channel-runtime-registry.test.ts`
- Test: `tests/retrieval-cli-and-compiler.test.ts`

- [x] Define `ChannelRuntimeAdapter` with `id`, `descriptor`, `resolveConfig`, and `readiness` methods.
- [x] Implement `createTelegramRuntimeAdapter()` using existing `resolveTelegramRuntimeConfig`.
- [x] Keep CLI behavior for `memduck --with-telegram`.
- [x] Run `pnpm test tests/channel-runtime-registry.test.ts tests/retrieval-cli-and-compiler.test.ts`.

### Task 9: First-Wave Webhook Adapter Skeletons

**Files:**
- Create: `src/lib/channels/runtime-slack.ts`
- Create: `src/lib/channels/runtime-discord.ts`
- Create: `src/lib/channels/runtime-feishu.ts`
- Create: `src/lib/channels/runtime-dingtalk.ts`
- Modify: `src/lib/channels/runtime-registry.ts`
- Test: `tests/channel-runtime-registry.test.ts`

- [x] Add runtime adapters that validate configured token/secret fields and expose startup readiness.
- [x] Do not import heavy SDK packages until their concrete runtimes are implemented.
- [x] Ensure every adapter can map a simple text webhook payload into a memduck text ingest envelope.
- [x] Run `pnpm test tests/channel-runtime-registry.test.ts`.

### Task 10: WhatsApp Runtime Skeleton

**Files:**
- Create: `src/lib/channels/runtime-whatsapp.ts`
- Modify: `src/lib/channels/catalog.ts`
- Modify: `src/lib/channels/runtime-registry.ts`
- Test: `tests/channel-runtime-registry.test.ts`

- [x] Model WhatsApp as a QR/session runtime with credential readiness, matching OpenClaw's Baileys-style setup flow.
- [x] Add fields for `sessionName`, `allowFrom`, and `groups`.
- [x] Expose readiness as configured when enabled, while runtime status remains `adapter-planned` until Baileys is added.
- [x] Run `pnpm test tests/channel-runtime-registry.test.ts`.

### Task 11: Provider Capability Matrix

**Files:**
- Modify: `src/lib/providers/provider-presets.ts`
- Modify: `src/components/provider-center.tsx`
- Test: `tests/provider-presets.test.ts`
- Test: `tests/api-routes.test.ts`

- [x] Add capability metadata to every provider: chat, embedding, vision, rerank.
- [x] Show capability hints in the model picker.
- [x] Preserve custom provider support.
- [x] Reject provider saves when no embedding model is available for memduck retrieval.
- [x] Run `pnpm test tests/provider-presets.test.ts tests/api-routes.test.ts`.

### Task 12: Channel Center Runtime Controls

**Files:**
- Modify: `src/components/channel-center.tsx`
- Modify: `app/api/settings/channels/route.ts`
- Test: `tests/api-routes.test.ts`

- [x] Surface runtime mode, adapter status, missing fields, and docs link for every channel.
- [x] Keep secret masking and blank-secret preservation.
- [x] Add first-wave badges for Telegram, Slack, Discord, Feishu, WhatsApp, and Dingtalk.
- [x] Run `pnpm test tests/api-routes.test.ts`.

### Task 13: Full Verification Loop

**Files:**
- No code files.

- [x] Run `pnpm check`.
- [x] Continue fixing failures until lint, typecheck, tests, extension build, CLI build, and Next production build all pass.
