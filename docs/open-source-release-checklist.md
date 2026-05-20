# memduck Open Source Release Checklist

## Product

- Setup flow can produce a first memory card in a few minutes.
- Web, extension, Telegram, and webhook adapters all share the same ingestion contract.
- Channel catalog includes the OpenClaw-style channel set, including DingTalk, with runtime readiness clearly marked as native, webhook adapter, or planned adapter.
- Ask returns answers grounded in saved memory with citations.
- Topics and review surfaces show compiled results, not only flat storage.
- Raw sources remain traceable from each memory card.

## Developer Experience

- npm package metadata is complete and `bin.memduck` points to `dist/cli.mjs`.
- `memduck` creates home-based runtime scaffolding when needed, starts the packaged web runtime and compiler worker, then opens the local web UI.
- `memduck --with-telegram` starts web, worker, and Telegram together.
- `memduck doctor` reports setup health clearly without mutating runtime state.
- `pnpm memduck dev` starts the web app and compiler worker.
- `pnpm memduck dev --with-telegram` starts the full local stack.
- `pnpm extension:build` produces a loadable unpacked extension.

## Repository

- README explains what memduck is in under 30 seconds.
- License, contributing guide, security policy, and code of conduct are present.
- CI verifies test, typecheck, lint, and build on push.
- Bug report and feature request templates are present.
- Chinese product docs and architecture docs are linked from the README.
- CLI commands are explicit: bare `memduck` launches the product, unknown flags fail, and Telegram starts only with `--with-telegram`.
- Runtime state stays out of source control: `.memduck/`, uploaded assets, and SQLite files are ignored.

## Final Check

- Run `pnpm check`
- Run `npm pack --dry-run`
- Confirm tarball contents are intentional: built Next.js app, CLI bundles, extension files, docs, public logos, and no runtime SQLite/assets/secrets.
- Confirm the repo remote and branch are the intended publish target
