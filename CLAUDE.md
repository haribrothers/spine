# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository state

This repository currently contains only the product requirements document at `docs/spine-prd.md`. No code, monorepo scaffold, or package manifests exist yet. There are no build/lint/test commands to run because nothing has been implemented. Everything below describes the **planned** architecture as specified in the PRD — treat it as the design to implement against, not a description of existing code. Re-check this file's accuracy against actual repo contents as the project grows, since it will drift out of date the moment code lands.

**Check `CHANGELOG.md` at the start of any work session.** It tracks what's actually been completed and what's next, phase by phase against PRD §12. This file (CLAUDE.md) covers architecture and rules; CHANGELOG.md covers progress state. Update CHANGELOG.md whenever a story or phase milestone lands.

**Keep `docs/qa-script.md` in sync too.** It's the manual QA script covering every user-facing feature shipped so far, organized by area (not chronologically) so a human can run it end-to-end against a fresh org. Whenever a feature is completed and committed, add or update its section in that file in the same change — new steps for what the feature does, plus any regression checks for existing screens/computations it touches (e.g. a change to how an invoice's balance is computed needs a regression check on every screen that displays that balance). Don't wait for a dedicated "write QA docs" task — this is part of finishing the feature, the same way updating CHANGELOG.md is.

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
- **Onboarding never includes database/infra setup.** Provisioning Postgres and its credentials happens before the app ever serves a page — via `scripts/install.sh` and `.env` (`DATABASE_URL`), not an in-app step. The wizard begins only after sign-up (first user on a fresh instance becomes the **Primary Owner** automatically — see the permission model section below), and its step order is fixed: business profile → industry template → currency/locale/financial year → tax rates → numbering prefixes → chart-of-accounts confirmation → team invite. "Load demo data" is an alternative/supplement offered at step 1, not a separate flow. Every step must remain skippable and re-editable from Settings (§S-12.10), per the rule above.
- **Profile & Preferences is not the same surface as org Settings.** Every user, regardless of role, gets a personal page (name, email, password, avatar, preferences) reachable from the user menu — separate from the Owner-only organisation Settings dialog and separate from the Users/Teams/Permissions area. Don't fold personal account editing into either of those.
- **Graceful degradation**: if SMTP is down, documents still issue and email queues for retry; if object storage is down, the app runs read-only for attachments rather than failing globally. The app must boot with only 3 required env vars (`DATABASE_URL`, `AUTH_SECRET`, `APP_URL`).

## Permission model (PRD §2.1) — read before touching auth, roles, or any endpoint's authorization check

- **Roles**: `owner`, `staff`, `field` on `memberships`, plus the external customer link role. Owner and Field are fixed, non-configurable. Staff is subdivided by **Teams** — an org creates named Teams (`teams`), each with a configurable privilege matrix (`team_privileges`, one boolean row per Team per capability). A Staff user can belong to multiple Teams; effective access to a capability is the union across their Teams (most-permissive-wins, no explicit-deny in v1).
- **Primary Owner**: the first signup on a fresh instance. Exactly one per org, enforced by a partial unique index on `memberships.is_primary_owner`, not application logic alone. Cannot be demoted or removed by anyone but themselves, and only via an explicit transfer action — never a side effect of role editing. Signup is single-use: every account after the first is created by invite, never public registration.
- **Multiple Owners**: any Owner can promote a Staff user to Owner. All Owners have equal, unrestricted access — there is no per-owner content ownership or restriction in v1 (see "Deferred to v2" below). **Owner is never granted at invite time** — `POST /org/invitations` rejects `role: "owner"` outright (Better Auth's own `createInvitation` would otherwise allow it); the only path to Owner is `PUT /org/members/:id/promote` on an existing Staff member who has already accepted an invite and joined.
- **Field stays fixed on purpose**: never make Field Team-configurable — it exists specifically so an owner can't accidentally widen a mobile user's access to financial data (protects the "mobile hides all financial reports" rule, PRD §S-11.8).
- **"Manage users, teams, permissions, org settings, tax rules" is Owner-only, not Team-configurable, ever** — it's the one capability that could otherwise grant itself broader access.
- **Single source of truth**: the capability list the permissions UI renders and the list the API enforces per-endpoint must be the same list. If you add a new capability to the privilege matrix UI without a matching server-side check (or vice versa), that's a bug, not a follow-up.
- **Nav placement**: Users/Teams/Permissions management lives in its own top-level, Owner-only sidebar section with real routes — not inside the org Settings dialog. Settings stays for organisation configuration (branding, tax, numbering, business profile, etc.). See PRD §9 FEAT-10 S-10.18.
- **Whenever a new feature changes who-can-do-what** — adds a capability, a resource, or an action that should be gated — update the privilege matrix (the Team-configurable capability list) and this section of CLAUDE.md in the same change. A feature that's gated only in the UI, or only in one layer, is incomplete.
- **Deferred to v2, do not build**: multi-org (one owner account managing several separate organisations/instances) and cross-owner content ownership (restricting one Owner's access to another Owner's created records). See PRD §4.2 for why these are deferred and what would need to change to revisit them.
- **Invitation acceptance**: `POST /org/invitations` sends a real email (`sendInvitationEmail` wired in `auth.ts`, reusing `EmailService`) linking to `apps/web/src/app/accept-invite/[id]`, which calls Better Auth's own `getInvitation`/`acceptInvitation`/`rejectInvitation` client-side. Both of those **require an authenticated session matching the invited email** — Better Auth won't create an account inline, so an invitee without a session first goes through `/signup?inviteId=...&email=...` (email locked, pre-filled via the unauthenticated `GET /public/invitations/:id`) or `/login?next=/accept-invite/...`. There is still no automatic default-Team assignment on accept (the invited Staff user has zero Team memberships until an Owner assigns one from the Teams page) — if that's added later, it must be real application code run **after** `acceptInvitation` succeeds, **not** a `databaseHooks.member` hook: Better Auth 1.4.21's `databaseHooks` type (`BaseModelNames`) only covers `user`/`account`/`session`/`verification`, and the `organization` plugin's `member`/`invitation` writes aren't exposed through that hook surface (confirmed against `@better-auth/core`'s `type.d.mts` — re-check that type before re-attempting this, in case a future Better Auth upgrade changes it).

## Non-goals for v1 (PRD §1.5) — do not build these

Multi-tenant SaaS hosting (including one owner account managing multiple organisations — see the permission model section above), payroll/HR/attendance, inventory with stock valuation, marketing automation, country-specific statutory filing, customer self-service accounts, multi-currency, bank feed auto-import, native desktop app. If a task seems to require one of these, stop and confirm scope with the user rather than proceeding.

## Testing expectations once code exists (PRD §10.11)

- Unit tests are mandatory for money, tax, and posting-rule modules — this is where silent financial bugs hide.
- Integration tests per document lifecycle (quote, invoice, payment, etc.).
- A ledger-integrity test asserting the trial balance stays balanced after every simulated workflow.
- E2E smoke test covering quote → invoice → payment.
- `docs/qa-script.md` is the human-run counterpart to the above — update it alongside a feature's automated tests, not instead of them. See the pointer near the top of this file.
