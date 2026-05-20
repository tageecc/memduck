<div align="center">

<img src="public/brand/memduck-logo.png" alt="memduck logo" width="96" />

# memduck

**Self-hosted AI memory workspace for links, text, screenshots, and chat channels**

[![License](https://img.shields.io/github/license/tageecc/memduck)](https://github.com/tageecc/memduck/blob/main/LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/tageecc/memduck)](https://github.com/tageecc/memduck/stargazers)
[![npm](https://img.shields.io/npm/v/memduck)](https://www.npmjs.com/package/memduck)

[Quick Start](#quick-start) · [Core Features](#core-features) · [How It Works](#how-it-works) · [Docs](#docs)

**English** | [简体中文](./README_zh.md)

</div>

---

## Screenshots

<div align="center">
  <img src="public/brand/memduck-hero-en.png" alt="memduck English product preview" width="100%" />
  <p><em>Ask your saved memory, capture from browser and chat channels, and bring your own model provider.</em></p>
</div>

---

## Why memduck

Useful context disappears across browser tabs, copied notes, screenshots, Telegram messages, and team chat. memduck turns that scattered material into a local memory workspace: save it once, ask it later, and trace answers back to the original source.

It is built for developers, researchers, builders, and local-first users who want AI-assisted recall without sending every note into another hosted knowledge app.

---

## Core Features

- **Memory Cards** — Save links, text, screenshots, and channel messages with source traceability.
- **Grounded Q&A** — Ask questions against saved material and get answers with citations.
- **Self-Hosted Runtime** — Run a local Next.js workspace with SQLite and file assets under your control.
- **Browser Capture** — Use the Manifest V3 extension to capture the current page or selected text.
- **Channel Center** — Configure Web, browser extension, Telegram, DingTalk, Slack, Discord, Feishu, WhatsApp, and more.
- **Model Provider Catalog** — Choose OpenAI, Anthropic, Gemini, Ollama, OpenAI-compatible profiles, and other provider presets.
- **Background Compilation** — Build topics, summaries, embeddings, review queues, and retrieval data outside the render path.

---

## Quick Start

### Install from npm

```bash
npm install -g memduck@latest
memduck
```

Run the web runtime together with Telegram:

```bash
memduck --with-telegram
```

The packaged runtime stores config and SQLite state under `~/.memduck` by default.

### Run from source

**Prerequisites**

- Node.js 24+
- [pnpm](https://pnpm.io)

```bash
git clone https://github.com/tageecc/memduck.git
cd memduck
pnpm install
pnpm memduck dev
```

Run the web app, worker, and Telegram bot together:

```bash
pnpm memduck dev --with-telegram
```

Open [http://127.0.0.1:3000/ask](http://127.0.0.1:3000/ask) to start using the workspace.

Before opening the browser, run a local readiness check:

```bash
pnpm memduck doctor
```

Set `MEMDUCK_HOME` if you want runtime data somewhere other than `~/.memduck/runtime`.

---

## Features

<details>
<summary><strong>Capture & Ingestion</strong></summary>

<br/>

- Save URLs, pasted text, screenshots, and chat/channel messages.
- Preserve raw source content so summaries and answers can point back to origin.
- Use the browser extension popup to send the current page or selected text to `/api/ingest`.
- Reuse the same ingestion API across native channels and webhook adapters.

</details>

<details>
<summary><strong>AI Memory Retrieval</strong></summary>

<br/>

- Embed ready cards when the active provider profile includes an embedding model.
- Chunk source text so citations can point to original spans.
- Perform semantic retrieval over stored cards, then rerank candidates before answering.
- Persist topic links with confidence and reasoning for explainable grouping.

</details>

<details>
<summary><strong>Channels</strong></summary>

<br/>

- Native local runtimes: Web, browser extension, Telegram.
- Webhook ingestion adapters: DingTalk, Slack, Discord, Feishu, WhatsApp.
- OpenClaw-style channel catalog for configuring and tracking broader channel options.
- Runtime diagnostics and heartbeat status inside `/channels`.

</details>

<details>
<summary><strong>Model Providers</strong></summary>

<br/>

- Built-in provider library modeled after OpenClaw-style provider catalogs.
- Configure OpenAI, Anthropic, Gemini, Ollama, OpenAI-compatible profiles, and other hosted/local providers.
- Activate one provider profile for the current runtime.
- Test provider readiness from the web UI before relying on retrieval or chat.

</details>

<details>
<summary><strong>Review & Knowledge Compilation</strong></summary>

<br/>

- Background worker compiles topic summaries and review buckets.
- Users can star, highlight, and queue cards for review.
- Memory weighting is visible through explicit signals rather than hidden ranking only.
- Topic and review data power retrieval and memory detail pages.

</details>

---

## How It Works

```text
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│ Browser / Chats  │────▶│  Ingestion API   │────▶│ SQLite + Assets  │
└──────────────────┘     └──────────────────┘     └──────────────────┘
          │                        │                        │
          ▼                        ▼                        ▼
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│ Channel Center   │     │ Compiler Worker  │────▶│ Embeddings/Topics│
└──────────────────┘     └──────────────────┘     └──────────────────┘
                                   │                        │
                                   ▼                        ▼
                         ┌──────────────────┐     ┌──────────────────┐
                         │    Ask Agent     │────▶│ Cited Answers    │
                         └──────────────────┘     └──────────────────┘
```

1. **Capture** — Browser extension, Telegram, DingTalk, Slack, Discord, Feishu, WhatsApp, and web inputs send content into the same local API.
2. **Normalize** — memduck stores raw source, generated card summaries, local assets, provider settings, and channel state.
3. **Compile** — The worker creates embeddings, topic links, topic summaries, and review buckets in the background.
4. **Ask** — The agent retrieves relevant memory, reranks candidates, and answers with citations to saved source material.

---

## Product Map

- `/ask` — Agent workspace for questions, links, text, screenshots, and memory creation.
- `/inbox` — Memory library for saved cards.
- `/memory/:id` — Memory detail view with signal actions and traceability.
- `/models` — Provider and model configuration.
- `/channels` — Web, extension, Telegram, DingTalk, Slack, Discord, Feishu, WhatsApp, and catalog channel configuration.
- `/setup` — Language and theme preferences.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Web App | Next.js 16, React 19, TypeScript |
| UI | Tailwind CSS, shadcn/ui, Radix UI, lucide-react |
| AI SDK | Vercel AI SDK, Streamdown |
| Storage | SQLite, better-sqlite3, local file assets |
| Channels | Manifest V3 extension, grammY Telegram bot, webhook adapters |
| Runtime | Node.js 24+, packaged CLI |
| Testing | Vitest, TypeScript, Biome |

---

## Browser Extension

Build the unpacked extension:

```bash
pnpm extension:build
```

Load `extension/dist` as an unpacked Chrome extension. The popup lets you set your local app URL and send the current page or selected text into `/api/ingest`.

---

## Telegram & Channel Adapters

Save the Telegram bot token in `/channels`, or set `TELEGRAM_BOT_TOKEN`, then run:

```bash
memduck --with-telegram
```

Telegram and the browser extension have native local runtimes. DingTalk, Slack, Discord, Feishu, and WhatsApp have webhook ingestion adapters.

---

## CLI

| Command | Description |
|---------|-------------|
| `memduck` | Create local runtime state, start the packaged web server and worker, then open the dashboard. |
| `memduck --with-telegram` | Start web, worker, and Telegram together. |
| `memduck doctor` | Verify local runtime, provider, and Telegram readiness. |
| `pnpm memduck dev` | Start Next.js plus the background compiler worker from source. |
| `pnpm memduck dev --with-telegram` | Start source web app, worker, and Telegram bot together. |
| `pnpm worker:dev` | Run only the knowledge compiler worker. |
| `pnpm check` | Run lint, typecheck, tests, extension build, CLI build, and production build. |

---

## Docs

- [Simplified Chinese README](README_zh.md)
- [Chinese PRD](docs/prd.zh-CN.md)
- [Simplified MVP architecture](docs/architecture.zh-CN.md)
- [Open source release checklist](docs/open-source-release-checklist.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [Code of conduct](CODE_OF_CONDUCT.md)
- [License](LICENSE)

---

## Support

If memduck is useful to you, starring the repository helps other self-hosted and local-first users find it.
