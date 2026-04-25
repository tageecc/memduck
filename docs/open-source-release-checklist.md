# memduck Open Source Release Checklist

## Product

- Setup flow can produce a first memory card in a few minutes.
- Web, extension, and Telegram all share the same ingestion contract.
- Ask returns answers grounded in saved memory with citations.
- Topics and review surfaces show compiled results, not only flat storage.
- Raw sources remain traceable from each memory card.

## Developer Experience

- npm package metadata is complete and `bin.memduck` points to `dist/cli.mjs`.
- `memduck init` creates home-based runtime scaffolding under `~/.memduck`.
- `memduck start` starts the production web runtime and compiler worker from the published package.
- `memduck dashboard` opens the configured local web UI.
- `pnpm memduck doctor` reports setup health clearly without mutating runtime state.
- `pnpm memduck dev` starts the web app and compiler worker.
- `pnpm memduck dev --with-telegram` starts the full local stack.
- `pnpm extension:build` produces a loadable unpacked extension.

## Repository

- README explains what memduck is in under 30 seconds.
- License, contributing guide, security policy, and code of conduct are present.
- CI verifies test, typecheck, lint, and build on push.
- Bug report and feature request templates are present.
- Chinese product docs and architecture docs are linked from the README.
- CLI commands are explicit: no-arg prints help, unknown flags fail, and Telegram starts only with `--with-telegram`.
- Runtime state stays out of source control: `.memduck/`, uploaded assets, and SQLite files are ignored.

## Final Check

- Run `pnpm check`
- Run `npm pack --dry-run`
- Confirm the repo remote and branch are the intended publish target
