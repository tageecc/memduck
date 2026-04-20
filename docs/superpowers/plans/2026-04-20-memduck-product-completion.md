# Memduck Product Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade memduck from a strong MVP into an immediately open-sourceable product with semantic retrieval, compiled topic/review state, channel health signals, and a real `memduck init` / `memduck dev` CLI.

**Architecture:** Keep the existing single-app SQLite shape, but add a proper derived-data layer on top of it: embeddings + rerank retrieval for Ask, compiled topic/review tables for memory synthesis, and channel heartbeat records for status UX. Ship orchestration as a local CLI that bootstraps config and starts the web app, worker, and optional Telegram bot together.

**Tech Stack:** Next.js, SQLite (`better-sqlite3`), local file storage, provider-backed embeddings and reranking, Node child-process orchestration via a project CLI.

---

### File Map

**Retrieval**
- Modify: `src/lib/memduck/types.ts`
- Modify: `src/lib/memduck/contracts.ts`
- Modify: `src/lib/memduck/service.ts`
- Modify: `src/lib/storage/database.ts`
- Modify: `src/lib/providers/provider-runtime.ts`
- Modify: `src/lib/providers/openai-compatible-provider.ts`
- Modify: `src/lib/providers/anthropic-provider.ts`
- Modify: `src/lib/providers/gemini-provider.ts`
- Modify: `src/lib/providers/mock-provider-registry.ts`
- Test: `tests/retrieval-cli-and-compiler.test.ts`

**Compiled Knowledge**
- Modify: `src/lib/memduck/types.ts`
- Modify: `src/lib/memduck/service.ts`
- Modify: `src/lib/storage/database.ts`
- Modify: `app/review/page.tsx`
- Modify: `app/topics/page.tsx`
- Modify: `app/topics/[slug]/page.tsx`
- Test: `tests/retrieval-cli-and-compiler.test.ts`

**Channel Status**
- Modify: `src/lib/channels/extension.ts`
- Add: `app/api/channels/heartbeat/route.ts`
- Modify: `src/components/channel-center.tsx`
- Modify: `extension/src/popup.ts`
- Test: `tests/retrieval-cli-and-compiler.test.ts`

**CLI**
- Add: `scripts/cli.ts`
- Add: `scripts/worker.ts`
- Modify: `scripts/telegram.ts`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `.env.example`
- Test: `tests/retrieval-cli-and-compiler.test.ts`

### Task 1: Add Failing Retrieval and CLI Tests

**Files:**
- Modify: `tests/retrieval-cli-and-compiler.test.ts`

- [ ] **Step 1: Keep the failing tests as the contract**

The contract tests already exist and must stay red until the implementation lands:

```ts
expect(await service.retrieveCards({ query, limit: 2 })).toMatchObject({
  strategy: "embedding-rerank",
});

await service.compileKnowledge();
expect(service.listCompiledTopics()[0]?.summary).toBe("Memory retention topic summary");

service.recordChannelHeartbeat({ channel: "extension", metadata, occurredAt });
expect(getExtensionConnectionStatus(...).connected).toBe(true);

expect(parseCliArgs(["dev", "--with-telegram"])).toEqual({
  command: "dev",
  flags: { withTelegram: true },
});
```

- [ ] **Step 2: Run the focused test file to confirm red**

Run: `pnpm test tests/retrieval-cli-and-compiler.test.ts`
Expected: FAIL with missing `retrieveCards`, `compileKnowledge`, `recordChannelHeartbeat`, and `scripts/cli.ts`

### Task 2: Implement Embedding + Rerank Retrieval

**Files:**
- Modify: `src/lib/memduck/types.ts`
- Modify: `src/lib/providers/provider-runtime.ts`
- Modify: `src/lib/providers/openai-compatible-provider.ts`
- Modify: `src/lib/providers/anthropic-provider.ts`
- Modify: `src/lib/providers/gemini-provider.ts`
- Modify: `src/lib/providers/mock-provider-registry.ts`
- Modify: `src/lib/storage/database.ts`
- Modify: `src/lib/memduck/service.ts`
- Test: `tests/retrieval-cli-and-compiler.test.ts`

- [ ] **Step 1: Add retrieval types and provider embedding/rerank capabilities**

Add `embeddingModel`, retrieval result types, and provider methods:

```ts
export interface RetrievalItem {
  card: MemoryCard;
  rerankScore: number;
  semanticScore: number;
}

export interface RetrievalResult {
  items: RetrievalItem[];
  strategy: "embedding-rerank";
}
```

- [ ] **Step 2: Persist embeddings in SQLite**

Add a table like:

```sql
CREATE TABLE IF NOT EXISTS card_embeddings (
  card_id TEXT PRIMARY KEY,
  embedding_json TEXT NOT NULL,
  source_text TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

- [ ] **Step 3: Generate embeddings during ingest**

When a ready memory card is created:

```ts
await this.upsertCardEmbedding(card.id, sourceText);
```

- [ ] **Step 4: Implement `retrieveCards()`**

Compute semantic similarity against stored vectors, keep the top candidates, then rerank them:

```ts
const candidates = this.rankByCosineSimilarity(queryEmbedding, storedEmbeddings);
const reranked = await this.getProvider().rerank(query, candidates.slice(0, 8));
return { items: reranked, strategy: "embedding-rerank" };
```

- [ ] **Step 5: Make Ask use `retrieveCards()`**

Replace the current keyword-only retrieval with:

```ts
const retrieval = await this.retrieveCards({ filters: request.filters, limit: 3, query: retrievalQuestion });
const cards = retrieval.items.map((item) => item.card);
```

- [ ] **Step 6: Run the focused retrieval test**

Run: `pnpm test tests/retrieval-cli-and-compiler.test.ts -t "uses stored embeddings and reranking"`
Expected: PASS

### Task 3: Implement Compiled Topic and Review State

**Files:**
- Modify: `src/lib/memduck/types.ts`
- Modify: `src/lib/storage/database.ts`
- Modify: `src/lib/memduck/service.ts`
- Modify: `app/review/page.tsx`
- Modify: `app/topics/page.tsx`
- Modify: `app/topics/[slug]/page.tsx`
- Test: `tests/retrieval-cli-and-compiler.test.ts`

- [ ] **Step 1: Add compiled tables and types**

Persist compiled data instead of deriving it only from heuristics:

```sql
CREATE TABLE IF NOT EXISTS compiled_topics (
  topic_id TEXT PRIMARY KEY,
  summary TEXT NOT NULL,
  repeated_points_json TEXT NOT NULL,
  conflict_points_json TEXT NOT NULL,
  next_questions_json TEXT NOT NULL,
  card_ids_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS compiled_review (
  singleton_key TEXT PRIMARY KEY,
  today_json TEXT NOT NULL,
  stale_high_value_json TEXT NOT NULL,
  theme_momentum_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

- [ ] **Step 2: Implement `compileKnowledge()`**

Compile topic summaries and review buckets with the provider:

```ts
await this.compileTopicSummaries();
await this.compileReviewBuckets();
```

- [ ] **Step 3: Read compiled state in UI**

The topic pages and review page should prefer compiled data:

```ts
const compiledTopics = service.listCompiledTopics();
const review = service.getCompiledReviewBuckets();
```

- [ ] **Step 4: Re-run the compiler test**

Run: `pnpm test tests/retrieval-cli-and-compiler.test.ts -t "compiles topic and review state"`
Expected: PASS

### Task 4: Add Channel Heartbeats and Extension Status

**Files:**
- Modify: `src/lib/memduck/types.ts`
- Modify: `src/lib/storage/database.ts`
- Modify: `src/lib/memduck/service.ts`
- Modify: `src/lib/channels/extension.ts`
- Add: `app/api/channels/heartbeat/route.ts`
- Modify: `src/components/channel-center.tsx`
- Modify: `extension/src/popup.ts`
- Test: `tests/retrieval-cli-and-compiler.test.ts`

- [ ] **Step 1: Persist channel heartbeats**

Add a table:

```sql
CREATE TABLE IF NOT EXISTS channel_heartbeats (
  id TEXT PRIMARY KEY,
  channel TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  occurred_at TEXT NOT NULL
);
```

- [ ] **Step 2: Implement service methods**

Add:

```ts
recordChannelHeartbeat(...)
getChannelConnectionStatus(channel)
```

- [ ] **Step 3: Add extension-friendly status helper**

Expose:

```ts
export function getExtensionConnectionStatus(heartbeat, now) {
  return { connected, label, staleMinutes };
}
```

- [ ] **Step 4: Wire extension popup and channel center**

The popup should ping the heartbeat API and show connectivity; the channel center should show the latest extension contact.

- [ ] **Step 5: Run the focused status test**

Run: `pnpm test tests/retrieval-cli-and-compiler.test.ts -t "reports extension connection status"`
Expected: PASS

### Task 5: Build `memduck init` and `memduck dev`

**Files:**
- Add: `scripts/cli.ts`
- Add: `scripts/worker.ts`
- Modify: `scripts/telegram.ts`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `.env.example`
- Test: `tests/retrieval-cli-and-compiler.test.ts`

- [ ] **Step 1: Add CLI argument parsing**

Implement:

```ts
export function parseCliArgs(argv: string[]) {
  // returns { command, flags }
}
```

- [ ] **Step 2: Add `scaffoldInitFiles()`**

Create `.env.local` and runtime folders if missing:

```ts
await writeFile(join(cwd, ".env.local"), defaultEnv);
await mkdir(runtimeDir, { recursive: true });
```

- [ ] **Step 3: Add `memduck dev` orchestration**

Spawn:

```ts
next dev
tsx scripts/worker.ts
tsx scripts/telegram.ts   // only when --with-telegram or configured token exists
```

- [ ] **Step 4: Expose the CLI from `package.json`**

Add:

```json
"bin": {
  "memduck": "./scripts/cli.ts"
},
"scripts": {
  "memduck": "tsx scripts/cli.ts"
}
```

- [ ] **Step 5: Run the CLI-focused test**

Run: `pnpm test tests/retrieval-cli-and-compiler.test.ts -t "supports memduck init and memduck dev CLI commands"`
Expected: PASS

### Task 6: Full Verification and Release Notes

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document the new product shape**

README must explain:
- semantic retrieval
- compiled topics/review
- extension status and channel center
- `pnpm memduck init`
- `pnpm memduck dev --with-telegram`

- [ ] **Step 2: Run full verification**

Run:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Expected: all pass

- [ ] **Step 3: Commit**

```bash
git add README.md app src scripts tests package.json pnpm-lock.yaml .env.example
git commit -m "feat: ship semantic retrieval and memduck cli"
```
