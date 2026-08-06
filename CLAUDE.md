# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository state

This repository currently contains only the product requirements document at `docs/spine-prd.md`. No code, monorepo scaffold, or package manifests exist yet. There are no build/lint/test commands to run because nothing has been implemented. Everything below describes the **planned** architecture as specified in the PRD — treat it as the design to implement against, not a description of existing code. Re-check this file's accuracy against actual repo contents as the project grows, since it will drift out of date the moment code lands.

**Check `CHANGELOG.md` at the start of any work session.** It tracks what's actually been completed and what's next, phase by phase against PRD §12. This file (CLAUDE.md) covers architecture and rules; CHANGELOG.md covers progress state. Update CHANGELOG.md whenever a story or phase milestone lands.

## What Spine is

Spine is a self-hosted business management app for small service/project businesses (construction, fabrication, contractors, design studios). It follows the workflow **enquiry → quote → job → invoice → payment → books**, where double-entry accounting is derived automatically from business events rather than entered directly by users. Read `docs/spine-prd.md` in full before making architectural decisions — it is the single source of truth for scope, data model, and rationale.

## Core architectural rules (non-negotiable per PRD §6, §10.4)

These constraints protect financial correctness and should govern any implementation work in this repo:

- **Ledger is derived, never authored.** Every business event (invoice issued, payment received, etc.) flows through a domain service → a posting rule → a balanced journal entry. Users never type a journal entry. Posting rules live in one module (see §7.2 for the full debit/credit table).
- **Journal entries are immutable.** Corrections are reversing entries, never edits. A DB constraint enforces debits == credits per entry, in the same transaction as the business document it originates from.
- **Money is integer minor units (`bigint`) + currency code.** No floats. Rounding happens once, at line level, half-up. Tax is computed per line, not per document.
- **Documents snapshot their data.** Catalogue price/tax changes must never alter existing quotes/invoices — issued documents store a snapshot at time of issue.
- **Document numbers are gapless and permanent.** Allocated inside the issuing transaction via a row lock on a sequence table; drafts have no number; numbers never change once assigned.
- **Issued financial documents are never edited or deleted.** Only voided (with reversing entry) or credited.
- **Server-side authorization on every endpoint** — never trust a client-supplied role.
- **Idempotency keys on all mutating endpoints** (critical for the mobile offline outbox pattern, §6.6).

## Planned tech stack (PRD §5)

| Layer | Choice |
|---|---|
| Web | Next.js (App Router), TypeScript |
| Styling | Tailwind CSS v4 (`@theme`, CSS-native tokens) |
| Components | Radix UI primitives wrapped into an in-house `@spine/ui` library (own it, don't outsource theming) |
| Mobile | React Native via Expo (managed workflow) |
| API | NestJS, REST + OpenAPI (not GraphQL — two known clients, not a public API) |
| Database | PostgreSQL 16 |
| ORM | Drizzle (SQL-first, readable migrations) |
| Auth | Better Auth (cookie sessions for web, JWT for mobile) |
| Jobs | pg-boss (Postgres-backed queue, avoids a Redis container) |
| Files | S3-compatible driver, MinIO as the self-hosted default |
| Email | Nodemailer/SMTP first, pluggable drivers (Resend optional) |
| PDF | React-PDF or a Puppeteer-lite renderer — must be byte-identical across environments |
| Reverse proxy | Caddy (auto HTTPS) |
| Monorepo | Turborepo + pnpm |
| Container | Docker Compose (single-host, not Kubernetes) |

## Planned monorepo layout (PRD §6.7)

```
spine/
├─ apps/
│  ├─ api/        # NestJS — modules: auth, org, users, contacts, catalog,
│  │               #   quotes, jobs, invoices, payments, purchases,
│  │               #   expenses, ledger, reports, tax, numbering, files,
│  │               #   notifications, audit
│  ├─ web/        # Next.js
│  └─ mobile/     # Expo
├─ packages/
│  ├─ sdk/        # generated from OpenAPI
│  ├─ shared/     # money, tax engine, zod schemas, shared types
│  ├─ ui/         # @spine/ui — Radix + Tailwind component library, theme tokens, Storybook
│  └─ config/     # eslint, tsconfig, tailwind presets
├─ docker/        # Dockerfile.api, Dockerfile.web, Caddyfile
├─ docs/
├─ scripts/       # install.sh, backup.sh, restore.sh, seed.ts
├─ docker-compose.yml
└─ .env.example
```

## Key design decisions to preserve when implementing

- **Job costing without a parallel subsystem**: journal lines carry optional `contact_id` and `job_id`. AR aging and job profitability come from filtering the ledger, not from separate calculations — don't build a shadow costing system.
- **Retention** posts to a dedicated `Retention Receivable` account, distinct from AR, so aging reports aren't distorted by held retention.
- **Quote versioning** uses `parent_quote_id`; revising a sent quote creates a new version and supersedes the old one rather than mutating it.
- **Mobile offline model is intentionally partial** (§6.6): read-only cache (SQLite) for lists, write via an outbox queue with idempotency keys for photos/expenses/milestone updates. No offline creation of financial documents (quotes/invoices) — those require connectivity.
- **`@spine/ui` is built once in Phase 0**, not incrementally per feature — theme tokens as CSS custom properties, dark/light mode, docs in `apps/design-system` (a custom Next.js docs app, not Storybook), WCAG 2.1 AA per component, so later phases consume a finished library instead of inventing components mid-feature.
- **Every `@spine/ui` component change ships with its `apps/design-system` doc page in the same change.** Adding a new component or updating an existing one's API/behavior always includes creating or updating its page under `apps/design-system/src/app/components/<name>/page.tsx` (and its `apps/design-system/src/lib/nav.ts` entry for new components) — the design-system app is the living spec for the library, not an afterthought, and must never drift behind `packages/ui`'s actual exports.
- **First-run onboarding is not a gate.** The app must be fully usable if the wizard is skipped; onboarding settings (industry template, tax, numbering, etc.) must remain editable later from Settings.
- **Graceful degradation**: if SMTP is down, documents still issue and email queues for retry; if object storage is down, the app runs read-only for attachments rather than failing globally. The app must boot with only 3 required env vars (`DATABASE_URL`, `AUTH_SECRET`, `APP_URL`).

## Non-goals for v1 (PRD §1.5) — do not build these

Multi-tenant SaaS hosting, payroll/HR/attendance, inventory with stock valuation, marketing automation, country-specific statutory filing, customer self-service accounts, multi-currency, bank feed auto-import, native desktop app. If a task seems to require one of these, stop and confirm scope with the user rather than proceeding.

## Testing expectations once code exists (PRD §10.11)

- Unit tests are mandatory for money, tax, and posting-rule modules — this is where silent financial bugs hide.
- Integration tests per document lifecycle (quote, invoice, payment, etc.).
- A ledger-integrity test asserting the trial balance stays balanced after every simulated workflow.
- E2E smoke test covering quote → invoice → payment.
