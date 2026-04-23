# Contributing to memduck

memduck is opinionated on purpose: single-user, self-hosted, fast to start, and focused on turning external content into reusable memory. Contributions are welcome when they reinforce that shape.

## Before you start

- Read the product framing in [README.md](README.md) and [docs/prd.zh-CN.md](docs/prd.zh-CN.md).
- Prefer small, reviewable changes over broad refactors.
- Keep the first-run experience simple. New power should not add friction for a brand new user.

## Local workflow

1. Install dependencies

```bash
pnpm install
```

2. Initialize local config

```bash
pnpm memduck init
```

3. Run the product locally

```bash
pnpm memduck dev
```

Or, to run the full local stack including Telegram:

```bash
pnpm memduck dev --with-telegram
```

4. Check workspace health

```bash
pnpm memduck doctor
```

## What a good contribution looks like

- It preserves or improves the ingest → digest → memory → ask/review loop.
- It includes tests for new behavior.
- It updates docs when user-facing behavior changes.
- It avoids forcing Docker, cloud services, or enterprise assumptions into the default dev path.

## Quality gate

Run these before opening a PR:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

## Scope guidance

Good contribution areas:

- retrieval quality
- provider integrations
- channel reliability
- onboarding and first-run UX
- topic/review quality
- documentation and self-hosting clarity

Out of scope for casual drive-by changes:

- enterprise multi-tenant auth
- team collaboration layers
- unrelated design-system rewrites
- large framework migrations without product need

## PR notes

- Explain the user-facing impact, not just the implementation details.
- Call out follow-up work honestly if you had to leave anything intentionally incomplete.
- Prefer screenshots or short terminal examples when UI/CLI behavior changes.
