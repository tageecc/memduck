# Security Policy

## Supported versions

memduck is pre-1.0, so security support is focused on the latest `main` branch state and the most recent tagged release once public releases begin.

## Reporting a vulnerability

Please do not open public GitHub issues for security-sensitive problems.

Instead:

- describe the impact
- include reproduction steps
- include affected routes, providers, or channels
- include whether the issue exposes local files, saved memory, provider keys, or Telegram integration state

Until a dedicated security contact is published, use the repository's private reporting channel if available.

## Hardening guidance for self-hosters

- keep `.env.local` private
- rotate provider keys if you suspect leakage
- avoid exposing your local memduck instance to the public internet without an auth layer or trusted network boundary
- review Telegram bot permissions before enabling it on a shared machine
