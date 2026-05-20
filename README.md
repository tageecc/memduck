# memduck

> A self-hosted personal memory engine

memduck digests links, copied text, and screenshots into reusable memory cards you can ask, revisit, and deepen over time. It is designed for single-user, self-hosted workflows and keeps the first version intentionally simple: one Next.js app, SQLite storage, local file assets, a thin browser extension, Telegram native runtime, and OpenClaw-style channel adapters that all speak the same API.

## Why it exists

Most tools help you save more. memduck is meant to help you understand first.

- Keep the raw source so you can always go back.
- Compress long external content into a card worth reopening.
- Group repeated material into topics instead of a flat inbox.
- Let Q&A and review reuse only what you have actually saved.
- Keep provider profiles, channel settings, and onboarding visible in the web UI.
- Use provider-backed embeddings plus reranking so the Agent feels like real memory retrieval instead of keyword search.
- Keep topic summaries and review buckets compiled in the background, not rebuilt only from heuristics at render time.
- Let users explicitly star, highlight, and queue cards for review so memory weighting is visible instead of implicit only.
- Show runtime diagnostics in the channel center so self-hosters can debug readiness in the browser, not only in the terminal.

## MVP stack

- `Next.js` for the web UI and API
- `SQLite` for local development storage
- `better-sqlite3` for a zero-setup embedded database
- `grammY` for the Telegram bot
- `Manifest V3` browser extension for low-friction capture
- OpenClaw-style provider and channel catalogs with built-in configuration UI

## Quick start

### npm install path

Install the published CLI package:

```bash
npm install -g memduck@latest
memduck
```

To run Telegram together with the web runtime:

```bash
memduck --with-telegram
```

The npm-style runtime stores config and SQLite state under `~/.memduck` by default.

### Source checkout path

Use this path when developing memduck itself from the GitHub repository.

1. Install dependencies

```bash
pnpm install
```

2. Start the local stack

```bash
pnpm memduck dev
```

To run the web app, worker, and Telegram bot together:

```bash
pnpm memduck dev --with-telegram
```

3. Open [http://127.0.0.1:3000/models](http://127.0.0.1:3000/models)

The setup flow now walks you through:

- building a provider library from the bundled OpenClaw-style provider catalog, including OpenAI, Anthropic, Gemini, Ollama, OpenAI-compatible profiles, and additional hosted/local providers
- activating one provider profile for the current runtime
- creating the first real memory card from the main dashboard
- opening `/channels` when you want to connect Telegram, the browser extension, DingTalk, Slack, Discord, Feishu, WhatsApp, or another catalog channel

If you want a quick health check before opening the browser:

```bash
pnpm memduck doctor
```

Runtime data is stored under `~/.memduck/runtime` by default. Set `MEMDUCK_HOME` if you want a different home directory.

## Optional entry points

### Browser extension

Build the unpacked extension:

```bash
pnpm extension:build
```

Then load `extension/dist` as an unpacked Chrome extension. The popup lets you point at your local app URL and send either the current page or the selected text into `/api/ingest`.

The popup also:

- pings memduck on open
- syncs the extension base URL from the channel center when possible
- reports extension heartbeat status back to `/channels`

### Telegram bot and channel adapters

Either save the Telegram bot token in the web UI under `/channels`, or set `TELEGRAM_BOT_TOKEN`, then run:

```bash
memduck --with-telegram
```

The bot forwards links, text, and screenshots to the same local memduck API. Use `/ask <question>` for grounded Q&A and `/review` for the current review queue.

When the bot is running, it also sends heartbeats so the channel center can show whether Telegram has checked in recently.

`/channels` also includes the broader OpenClaw-style catalog. Telegram and the browser extension have native local runtimes. Slack, Discord, Feishu, WhatsApp, and DingTalk have webhook ingestion adapters. Other catalog entries can be configured and tracked in the channel center while their full native adapters are planned.

## Product shape

- `/`: redirects to the Agent workspace
- `/inbox`: memory library for saved cards
- `/ask`: Agent chat for questions, links, text, screenshots, and memory creation
- `/models`: provider and model configuration
- `/channels`: Web, browser extension, Telegram, DingTalk, Slack, Discord, Feishu, WhatsApp, and other catalog channel configuration
- `/setup`: language and theme preferences
- `/memory/:id`: memory detail view with explicit signal actions and traceability

Topic and review data still power retrieval and memory detail pages, but they are not top-level product surfaces in the default UI.

## Retrieval, grounding, and compilation

- Ready cards are embedded and stored locally in SQLite when the active provider profile includes an embedding model.
- Source text is chunked and embedded so Agent citations can point to original source spans, not only memory-card summaries.
- The Agent embeds the incoming query, performs semantic retrieval over stored cards, then reranks the top candidates before answering.
- Topic links are model-resolved and persisted with confidence and reasoning, so topic pages can explain why cards belong together.
- The worker compiles topic summaries and review buckets in the background so the web UI is reading a persisted memory view rather than rebuilding everything ad hoc.

## API surface

- `POST /api/channels/heartbeat`
- `POST /api/ingest`
- `GET /api/setup-state`
- `GET /api/conversations`
- `GET /api/conversations/:id`
- `GET /api/memory-cards`
- `GET /api/memory-cards/:id`
- `POST /api/memory-cards/:id/analyze`
- `POST /api/ask`
- `POST /api/ask/stream`
- `GET /api/assets/:objectKey`
- `POST /api/search`
- `POST /api/topics/:id/ask`
- `PATCH /api/topics/:id`
- `POST /api/topics/:id/merge`
- `DELETE /api/topics/:id/links`
- `POST /api/topics/compile`
- `GET /api/review`
- `GET /api/settings/channels`
- `POST /api/settings/channels`
- `GET /api/settings/providers`
- `POST /api/settings/providers`
- `DELETE /api/settings/providers`
- `POST /api/settings/providers/activate`
- `POST /api/settings/provider/test`
- `POST /api/settings/ui`
- `POST /api/signals`

## CLI

- `memduck`: create local runtime state if needed, start the packaged web server and worker, then open the dashboard
- `memduck --with-telegram`: start web, worker, and Telegram together; Telegram is never started implicitly
- `memduck doctor`: verify local runtime, provider, and Telegram readiness without mutating state
- `pnpm memduck dev`: start Next.js plus the background compiler worker from a source checkout
- `pnpm memduck dev --with-telegram`: start the source web app, worker, and Telegram bot together
- `pnpm worker:dev`: run only the knowledge compiler worker
- `pnpm check`: run lint, typecheck, tests, extension build, and production build

If you type an unknown command or flag, memduck prints CLI usage and exits non-zero instead of guessing what you meant.

## Publishing

Before publishing a new npm version:

```bash
pnpm check
npm publish
```

The package `prepack` script builds the CLI entrypoints and Next.js production app so the published `memduck` binary points at `dist/cli.mjs` instead of TypeScript source.

Run `npm pack --dry-run` before publishing to inspect the actual tarball. The package intentionally includes the built Next.js app, CLI bundles, public logos, extension source, and extension build output so `npm install -g memduck` can launch without a separate source build.

## Quality gate

Before publishing, tagging, or opening a substantial change, run:

```bash
pnpm check
```

This is the same gate used by CI. It verifies lint, TypeScript, Vitest, the browser extension build, and the Next.js production build.

## Docs

- Chinese PRD: [docs/prd.zh-CN.md](docs/prd.zh-CN.md)
- Simplified MVP architecture: [docs/architecture.zh-CN.md](docs/architecture.zh-CN.md)
- Open source release checklist: [docs/open-source-release-checklist.md](docs/open-source-release-checklist.md)
- Contributing: [CONTRIBUTING.md](CONTRIBUTING.md)
- Security policy: [SECURITY.md](SECURITY.md)
- Code of conduct: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- License: [LICENSE](LICENSE)
