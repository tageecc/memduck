# memduck iOS Cloud-Native Design

Date: 2026-05-30
Status: approved direction, pending implementation plan

## Objective

Build a Cloud-first native iOS app for memduck that can reach App Store quality and eventually compete on design merit. The app is not a web wrapper and not a generic AI chat client. It is the official iOS entrance to a personal memory platform: one active conversation shared across channels, native capture from the system share sheet, source-backed answers, and system integrations that make saving and recalling memory feel like part of iOS.

The first public-quality version targets iPhone first. iPad can use the same architecture with adaptive layout, but it is not the primary design target for the first implementation pass.

## Product Direction

Use the approved combination:

- **Spotlight Memory** for the main Ask surface: fast, search-like, direct.
- **Share Sheet Hero** for capture: save from Safari, Photos, Files, and other apps without friction.
- **Dynamic Island Capture** for background digest status where available.
- **Wallet Stack** for memory cards and threads: tactile, layered, source-backed.
- **System Actions** for Siri, Shortcuts, Spotlight, and widgets.

The result should feel native to iOS, with strong product personality coming from motion, system integration, source-backed memory cards, and very careful interaction design rather than decorative gradients or AI-themed visuals.

## UX Principles

1. **Open to intent, not navigation.**
   The first screen should answer: ask, save, or continue. Avoid dashboard clutter.

2. **One active conversation across channels.**
   Web, Telegram, iOS, and future channels all share the platform's active conversation unless the user explicitly starts a new one.

3. **Every answer has proof.**
   Citations and memory cards are not secondary metadata. They are part of the product promise.

4. **Capture must be faster than sending a message to yourself.**
   From share sheet to saved state should require the fewest possible decisions. Default depth is quick, with deep analysis available after save.

5. **Motion explains state.**
   Animations are functional: saving, digesting, source-linking, card expansion, conversation continuation. Avoid ornamental motion.

6. **AI should be invisible until useful.**
   Do not brand the interface with generic AI tropes. The app should feel like a memory instrument, not a chatbot skin.

## App Structure

### Tabs

Use a compact native tab bar with three destinations:

- **Ask**: primary screen, Spotlight-like input, active conversation, source-backed answers.
- **Memory**: Wallet-style stack of recent cards, threads, and sources.
- **Me**: account, invite status, provider/platform status, settings, privacy, export.

Do not add a separate Channels tab in iOS v1. iOS is itself a first-party channel. Platform channel management stays in the web app unless a mobile-only setting is required.

### Ask Screen

The Ask screen starts with a large native input surface, recent suggestions, and the active conversation. It should not look like a chat app at rest.

Core states:

- Empty active session: input first, small suggested prompts, recent saved items below.
- Active conversation: transcript appears only after intent is established.
- Streaming answer: answer appears with subtle progressive reveal; sources can appear before final text if retrieval is done.
- Source inspection: tapping a citation opens a native card sheet.
- New conversation: explicit top-level action; this clears active conversation only after confirmation if unsent input exists.

### Capture Flow

The iOS Share Extension is a first-class product surface.

Supported inputs:

- URL from Safari and other browsers.
- Selected text.
- Image or screenshot.
- File metadata where supported, with content handling deferred unless the platform API can safely ingest it.

Flow:

1. User shares content to memduck.
2. Extension shows a compact native sheet with title preview, optional note, and save depth.
3. Default action is **Save**.
4. Save button morphs into progress, then success.
5. If digest continues in the background, iOS app shows digest state through the main app and, where available, Live Activity/Dynamic Island.

Failure states must preserve user trust:

- Offline: queue locally and show queued state.
- Auth expired: save locally, prompt re-auth before upload.
- Provider timeout: save raw content and show "digest later" state.
- Unsupported content: explain what was saved and what was skipped.

### Memory Screen

The Memory tab uses a Wallet Stack metaphor:

- Cards are layered by thread, recency, and source relationship.
- Tapping a stack expands into cards and evidence.
- A memory card can show title, summary, source channel, date, key points, and citations.
- Source-backed answers can deep-link back into the exact card or source preview.

This screen should not become a dense database. Search and filters can exist, but the default experience is curated, recent, and tactile.

### System Integrations

First pass:

- Sign in with Apple.
- Share Extension.
- App Intents for:
  - Save clipboard or shared text.
  - Ask memduck.
  - Open active session.
- Spotlight indexing for recent memory cards and active session.
- Shortcuts phrases for saving and asking.

Later pass:

- Widgets for recent captures and active digest state.
- Live Activity/Dynamic Island for longer digest tasks.
- Siri follow-up support if the interaction model proves useful.

## Cloud Platform Requirements

The iOS app connects to a unified cloud memduck platform, not a local self-hosted instance.

Authentication:

- Invite code required during onboarding.
- Sign in with Apple is the primary identity provider.
- Invite acceptance binds Apple identity to a memduck cloud account.
- Sessions use short-lived access tokens and refresh tokens stored in Keychain.

Tenant model:

- Each user has isolated memory cards, sources, conversations, settings, and device registrations.
- Active conversation is per user, global across channels.
- Channel events include source channel and device metadata.

Required backend additions:

- `ios` channel catalog entry and runtime readiness.
- Cloud account and invite tables.
- Apple identity verification.
- Device registration for push and Live Activity support.
- iOS-friendly API facade for Ask, capture, active conversation, memory cards, and source previews.
- Server-side queue for digest jobs so Share Extension does not need to wait on model latency.

The iOS app should not expose provider keys. Cloud provider execution stays server-side.

## API Shape

Keep the existing channel logic as the conceptual model, but use a first-party mobile API layer for better UX.

Initial endpoints:

- `POST /api/mobile/auth/apple`
- `POST /api/mobile/invites/redeem`
- `GET /api/mobile/session`
- `GET /api/mobile/conversations/active`
- `POST /api/mobile/conversations/new`
- `POST /api/mobile/ask`
- `POST /api/mobile/captures`
- `POST /api/mobile/captures/multipart`
- `GET /api/mobile/captures/{id}`
- `GET /api/mobile/memory/recent`
- `GET /api/mobile/memory/{id}`
- `POST /api/mobile/devices`

The mobile API can internally call or share service logic with existing `ingest`, `ask`, conversations, and channel heartbeat code. It should not force the app to assemble web-oriented payloads for common tasks.

## Native App Architecture

Use SwiftUI.

Minimum target:

- iOS 17 for first implementation unless App Store strategy requires older support.
- iOS 26 Liquid Glass enhancements are progressive only and must have fallbacks.

Core modules:

- `MemduckApp`: app entry, dependency graph, scene routing.
- `AuthFeature`: invite and Apple sign-in.
- `AskFeature`: active conversation, streaming answer, source sheets.
- `CaptureFeature`: share extension handoff, upload queue, digest state.
- `MemoryFeature`: Wallet Stack cards, source previews, search.
- `SystemActions`: App Intents, Shortcuts, Spotlight handoff.
- `Networking`: typed API client, auth refresh, upload.
- `Persistence`: small local cache, queued captures, Keychain token storage.

State:

- Use SwiftUI Observation where available.
- Keep view state local.
- Keep API clients and auth/session services injected through environment.
- Keep share extension and main app state coordinated through an App Group container.

## Visual Design

Base visual language:

- Native iOS surfaces first.
- System typography first.
- SF Symbols for actions.
- Minimal color palette: system background, label colors, one restrained brand accent.
- Avoid generic AI gradients, glowing blobs, chatbot mascot visuals, and web dashboard cards.

Signature moments:

- Spotlight-like Ask field that expands into conversation.
- Share sheet save button morphs into progress and success.
- Memory cards expand like a Wallet stack.
- Sources highlight with a subtle sweep when an answer references them.
- Digest tasks show clear status without blocking capture.

Motion:

- Use spring animations for stack expansion and control morphing.
- Use short haptic feedback for save, source open, card expansion, and task completion.
- Respect Reduce Motion.
- Keep animations under user control; never delay task completion for animation.

## Onboarding

Flow:

1. Welcome screen explains private memory in one sentence.
2. Enter invite code.
3. Continue with Apple.
4. Permissions primer for notifications and share extension, only when needed.
5. Land in Ask with a short suggested first action.

Do not ask for provider keys, local server URLs, or channel configuration in iOS v1.

## App Store Readiness

Required before submission:

- Apple sign-in implemented according to platform guidelines.
- Privacy policy and account deletion path.
- Clear explanation of uploaded content and AI processing.
- Invite-gated access that does not confuse App Review.
- No hidden web-only dependency for primary flows.
- Robust offline/error states.
- Accessibility audit: Dynamic Type, VoiceOver labels, Reduce Motion, sufficient contrast.
- TestFlight build with realistic cloud environment.

## Testing

Server:

- Unit tests for invite redemption, Apple identity binding, active conversation, mobile capture, and channel attribution.
- Contract tests for mobile API payloads.
- Regression tests that active conversation remains global per user, not per channel.

iOS:

- Unit tests for API client, auth state, queued captures, and routing.
- UI tests for onboarding, ask, share extension, card expansion, and re-auth.
- Manual checks on small and large iPhones.
- Accessibility checks with Dynamic Type, VoiceOver, Reduce Motion, and dark mode.

End-to-end:

- Share Safari URL -> queued/uploaded -> memory card appears -> Ask cites it.
- Ask in iOS -> follow up in web/Telegram -> same active conversation.
- New conversation in iOS -> web/Telegram follow the new active conversation.
- Provider timeout -> raw save -> later digest.

## Out of Scope for First Implementation

- Self-hosted local server connection.
- Android app.
- Full iPad redesign.
- Public paid plans and billing.
- User-managed provider keys in iOS.
- Full channel center in iOS.
- Offline semantic search.

## References

- Apple Human Interface Guidelines: https://developer.apple.com/design/human-interface-guidelines/
- Sign in with Apple HIG: https://developer.apple.com/design/human-interface-guidelines/sign-in-with-apple
- Apple accessibility guidance: https://developer.apple.com/design/human-interface-guidelines/accessibility
- Apple Design Awards context: https://developer.apple.com/design/awards/
