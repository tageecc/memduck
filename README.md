# memduck

> A self-hosted personal memory engine

memduck digests links, copied text, and screenshots into reusable memory cards you can ask, revisit, and deepen over time. It is designed for single-user, self-hosted workflows and keeps the first version intentionally simple: one Next.js app, SQLite storage, local file assets, a thin browser extension, and a Telegram bot that all speak the same API.

## Why it exists

Most tools help you save more. memduck is meant to help you understand first.

- Keep the raw source so you can always go back.
- Compress long external content into a card worth reopening.
- Group repeated material into topics instead of a flat inbox.
- Let Q&A and review reuse only what you have actually saved.
- Keep provider profiles, channel settings, and onboarding visible in the web UI.
- Use provider-backed embeddings plus reranking so Ask feels like real memory retrieval instead of keyword search.
- Keep topic summaries and review buckets compiled in the background, not rebuilt only from heuristics at render time.
- Let users explicitly star, highlight, and queue cards for review so memory weighting is visible instead of implicit only.
- Show runtime diagnostics in the channel center so self-hosters can debug readiness in the browser, not only in the terminal.

## MVP stack

- `Next.js` for the web UI and API
- `SQLite` for local development storage
- `better-sqlite3` for a zero-setup embedded database
- `grammY` for the Telegram bot
- `Manifest V3` browser extension for low-friction capture

## Quick start

1. Install dependencies

```bash
pnpm install
```

2. Initialize the local workspace

```bash
pnpm memduck init
```

This creates `.env.local` from `.env.example` when needed and prepares the local runtime directory.

3. Start the local stack

```bash
pnpm memduck dev
```

To run the web app, worker, and Telegram bot together:

```bash
pnpm memduck dev --with-telegram
```

4. Open [http://127.0.0.1:3000/setup](http://127.0.0.1:3000/setup)

The setup flow now walks you through:

- building a provider library with OpenAI, Anthropic, Gemini, Ollama, or OpenAI-compatible profiles
- activating one provider profile for the current runtime
- selecting embedding and rerank models so Ask uses semantic retrieval
- creating the first real memory card
- opening the channel center for Telegram and extension defaults

If you want a quick health check before opening the browser:

```bash
pnpm memduck doctor
```

Runtime data is stored under `.memduck/runtime` by default.

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

### Telegram bot

Either save the Telegram bot token in the web UI under `/channels`, or set `TELEGRAM_BOT_TOKEN`, then run:

```bash
pnpm telegram:dev
```

The bot forwards links, text, and screenshots to the same local memduck API. Use `/ask <question>` for grounded Q&A and `/review` for the current review queue.

When the bot is running, it also sends heartbeats so the channel center can show whether Telegram has checked in recently.

## Product shape

- `/setup`: visual onboarding, provider library, first-memory flow
- `/channels`: channel center for Telegram, extension, and web runtime defaults
- `/memory/:id`: memory detail view with explicit signal actions and traceability
- `/topics`: topic overview with compiled summaries, repeated points, conflict points, and next questions
- `/ask`: persisted multi-turn threads grounded in semantic retrieval over your saved memory
- `/review`: compiled review buckets for today, high-value material, and theme momentum

## Retrieval, grounding, and compilation

- Ready cards are embedded and stored locally in SQLite when the active provider profile includes an embedding model.
- Source text is chunked and embedded so Ask citations can point to original source spans, not only memory-card summaries.
- Ask embeds the incoming query, performs semantic retrieval over stored cards, then reranks the top candidates before answering.
- Topic links are model-resolved and persisted with confidence and reasoning, so topic pages can explain why cards belong together.
- The worker compiles topic summaries and review buckets in the background so the web UI is reading a persisted memory view rather than rebuilding everything ad hoc.

## API surface

- `POST /api/channels/heartbeat`
- `POST /api/ingest`
- `GET /api/conversations`
- `GET /api/conversations/:id`
- `GET /api/memory-cards`
- `GET /api/memory-cards/:id`
- `POST /api/ask`
- `POST /api/topics/:id/ask`
- `GET /api/review`
- `GET /api/settings/channels`
- `POST /api/settings/channels`
- `GET /api/settings/providers`
- `POST /api/settings/providers`
- `POST /api/settings/providers/activate`
- `POST /api/signals`

## CLI

- `pnpm memduck init`: scaffold `.env.local` and runtime directories
- `pnpm memduck doctor`: verify local runtime, provider, and Telegram readiness
- `pnpm memduck dev`: start Next.js plus the background compiler worker
- `pnpm memduck dev --with-telegram`: start the web app, worker, and Telegram bot together
- `pnpm worker:dev`: run only the knowledge compiler worker
- `pnpm check`: run lint, typecheck, tests, extension build, and production build

If you type an unknown command, memduck now prints CLI usage instead of silently starting the dev server.

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
