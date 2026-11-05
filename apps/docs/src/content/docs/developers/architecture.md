---
title: Architecture
description: How Spine is put together, and the rules every change follows.
sidebar:
  order: 1
---

Spine is a TypeScript monorepo (pnpm and Turborepo). The full specification, written for the people and the AI coding agent building Spine, is in [`docs/`](https://github.com/haribrothers/spine/blob/main/docs/README.md); these pages are the short version for people.

## The pieces

| Folder | What it is |
|---|---|
| `apps/api` | The API: NestJS 11, REST with an OpenAPI document, PostgreSQL 16 through Drizzle, Better Auth for sign-in, pg-boss for background jobs |
| `apps/web` | The web app: Next.js 15 App Router, Tailwind 4 and `@spine/ui` |
| `apps/mobile` | The field app: Expo SDK 57, expo-router, `@spine/ui-native`, an offline read cache and a write outbox |
| `apps/e2e` | Playwright end-to-end tests with axe-core accessibility checks |
| `apps/docs`, `apps/site` | This documentation site and the home page (Astro and Starlight) |
| `apps/design-system`, `apps/showcase-native` | The component libraries' live docs |
| `packages/shared` | Money, tax and schemas shared by every app, and the English strings (`@spine/shared/i18n`) |
| `packages/ui`, `packages/ui-native` | The component libraries for web and phone, built from `docs/design/tokens.json` |

At runtime it's four containers: Postgres, the API, the web app and Caddy, which serves the web app at `/` and the API at `/api` on one address. Files go through a storage driver (a local volume by default, S3 optional), never straight to the disk.

## Rules every change follows

- **The ledger is derived, never typed in.** A business event — an invoice issued, a payment received — goes through its domain service and a posting rule to a balanced journal entry, in the same database transaction as the document. See [How the ledger works](../ledger/).
- **Journal entries are immutable.** Corrections are reversing entries. The database itself rejects edits and unbalanced entries.
- **Money is integer minor units plus a currency code.** Never floating point. Rounding happens once per line, half up; tax is per line.
- **Issued documents are permanent.** They snapshot their data, take a gapless number under a row lock, and are only ever voided or credited.
- **Every write takes an `Idempotency-Key`**, so a retried request can't post twice.
- **Authorisation is checked on the server, every time.** Roles are Owner, Staff (rights from Teams) and Field (fixed). The capability list the UI shows and the API enforces is the same list. Field users never see financial reports or other people's money.
- **It boots with three settings** (`DATABASE_URL`, `AUTH_SECRET`, `APP_URL`); email or storage outages degrade instead of crashing.

The complete rules, with their reasons, are in [`CLAUDE.md`](https://github.com/haribrothers/spine/blob/main/CLAUDE.md), [the architecture spec](https://github.com/haribrothers/spine/blob/main/docs/prd/02-architecture.md), [security](https://github.com/haribrothers/spine/blob/main/docs/prd/07-security.md) and [the decisions log](https://github.com/haribrothers/spine/blob/main/docs/prd/12-decisions.md).

## The component libraries

Web components and their live docs: `apps/design-system` (`pnpm --filter @spine/design-system dev`). Phone components: `apps/showcase-native`. Every component change ships with its doc page and its accessibility test.
