# memduck Open Source Release Checklist

## Product

- Setup flow can produce a first memory card in a few minutes.
- Web, extension, and Telegram all share the same ingestion contract.
- Ask returns answers grounded in saved memory with citations.
- Topics and review surfaces show compiled results, not only flat storage.
- Raw sources remain traceable from each memory card.

## Developer Experience

- `pnpm memduck init` creates local runtime scaffolding.
- `pnpm memduck doctor` reports setup health clearly.
- `pnpm memduck dev` starts the web app and compiler worker.
- `pnpm memduck dev --with-telegram` starts the full local stack.
- `pnpm extension:build` produces a loadable unpacked extension.

## Repository

- README explains what memduck is in under 30 seconds.
- License, contributing guide, security policy, and code of conduct are present.
- CI verifies test, typecheck, lint, and build on push.
- Bug report and feature request templates are present.
- Chinese product docs and architecture docs are linked from the README.

## Final Check

- Run `pnpm check`
- Confirm the repo remote and branch are the intended publish target
