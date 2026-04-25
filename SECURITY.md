# Security Policy

memduck is a local-first personal memory engine. Security reports should focus on vulnerabilities in the self-hosted runtime, browser extension, Telegram channel, provider configuration, or local data storage.

## Supported Versions

Security fixes are handled on `main` until the project starts publishing versioned releases.

## Reporting A Vulnerability

Please report security issues privately by emailing the repository owner or opening a private GitHub security advisory when available. Do not file public issues for secrets exposure, account takeover, local file disclosure, prompt injection that leaks stored memory, or provider credential handling bugs.

Include:

- The affected component.
- Reproduction steps.
- Expected impact.
- Any logs or request samples with secrets removed.

## Runtime Secrets

Do not commit `.env.local`, provider API keys, Telegram bot tokens, SQLite runtime files, uploaded images, or `.memduck/runtime` contents. The default runtime directory is local state and must stay outside source control.
