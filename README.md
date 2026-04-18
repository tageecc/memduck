# memduck

> A self-hosted personal memory engine

memduck digests links, copied text, and screenshots into reusable memory cards you can ask, revisit, and deepen over time. It is designed for single-user, self-hosted workflows and keeps the first version intentionally simple: one Next.js app, SQLite storage, a thin browser extension, and a Telegram bot that all speak the same API.

## Why it exists

Most tools help you save more. memduck is meant to help you understand first.

- Keep the raw source so you can always go back.
- Compress long external content into a card worth reopening.
- Group repeated material into topics instead of a flat inbox.
- Let Q&A and review reuse only what you have actually saved.

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

2. Copy environment defaults

```bash
cp .env.example .env.local
```

3. Start the app

```bash
pnpm dev
```

4. Open [http://127.0.0.1:3000](http://127.0.0.1:3000)

The app seeds a few example memory cards on first run and stores runtime data under `.memduck/runtime` by default.

## Optional entry points

### Browser extension

Build the unpacked extension:

```bash
pnpm extension:build
```

Then load `/Users/tagecc/Documents/workspace/memduck/extension/dist` as an unpacked Chrome extension. The popup lets you point at your local app URL and send either the current page or the selected text into `/api/ingest`.

### Telegram bot

Set `TELEGRAM_BOT_TOKEN` and run:

```bash
pnpm telegram:dev
```

The bot forwards links, text, and screenshots to the same local memduck API. Use `/ask <question>` for grounded Q&A and `/review` for the current review queue.

## API surface

- `POST /api/ingest`
- `GET /api/memory-cards`
- `GET /api/memory-cards/:id`
- `POST /api/ask`
- `POST /api/topics/:id/ask`
- `GET /api/review`
- `POST /api/signals`

## Docs

- Chinese PRD: [docs/prd.zh-CN.md](/Users/tagecc/Documents/workspace/memduck/docs/prd.zh-CN.md)
- Simplified MVP architecture: [docs/architecture.zh-CN.md](/Users/tagecc/Documents/workspace/memduck/docs/architecture.zh-CN.md)
