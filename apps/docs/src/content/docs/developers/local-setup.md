---
title: Local setup
description: Run Spine from source on your machine.
sidebar:
  order: 2
---

You need Node.js 22+, pnpm 9 (`corepack enable` gets the pinned version) and Docker.

```bash
git clone https://github.com/haribrothers/spine.git && cd spine
pnpm install
pnpm dev:infra:up        # Postgres and MailDev in Docker
cp .env.example .env     # the defaults work for local development
pnpm db:migrate:dev
pnpm db:seed:dev         # a demo organisation and its chart of accounts
pnpm dev                 # the API on :4000, the web app on :3000, the design system on :3100
```

MailDev shows every email Spine sends at `http://localhost:1080`.

## Everyday commands

| Command | What it does |
|---|---|
| `pnpm dev` | The API, the web app and the design system, with hot reload |
| `pnpm lint` / `pnpm typecheck` | Every package |
| `pnpm test` | Unit tests in every package |
| `pnpm --filter @spine/api test:integration` | API tests against Postgres (each file gets its own database) |
| `pnpm test:e2e` | Playwright end-to-end tests |
| `pnpm verify` | Everything, E2E included: run it before a pull request is marked ready |
| `pnpm dev:mobile` | The field app in Expo |

The README's [Local development setup](https://github.com/haribrothers/spine/blob/main/README.md#local-development-setup) has the details: the field app on a device, resetting the local database, and more.
