# Changelog

Tracks what's been built and what's next, phase by phase per `docs/spine-prd.md` §12. Update this file as work lands — newest entry on top within each section. This is the progress log; `CLAUDE.md` is the architecture/rules reference.

## Status

**Current phase:** Phase 0 · Foundation — in progress. Monorepo scaffold, Docker Compose shape, the money/tax core in `@spine/shared`, the full Postgres/Drizzle schema with a working, DB-enforced ledger, a documented local dev workflow, and a project README are in place. No auth yet.

## Next up

- Better Auth wiring (cookie sessions for web, JWT for mobile).
- `@spine/ui` primitive set (button, input, select, combobox, date picker, table, dialog, drawer, tabs, toast, form fields, money input — full list in §F0), theme tokens, dark/light mode, Storybook, a11y pass.
- First-run onboarding wizard shell (business profile, industry template, currency/FY, tax confirmation, CoA review, team invite) — skippable, settings stay editable later.
- NestJS services/controllers on top of the schema (org, users, contacts, etc. — module stubs already exist).
- CI pipeline (should run `test:integration` against a Postgres service container).

## Completed

### 2026-08-05 — Dev infra compose, README, and `.env` loading for DB scripts
- `docker-compose.dev.yml`: a separate, infra-only Compose file (Postgres + MinIO, `spine-dev` project name, distinct named volumes) for contributors running `apps/api`/`apps/web` natively via `pnpm dev` — kept apart from `docker-compose.yml`, which is the production stack that builds and runs `api`/`web` as containers behind Caddy. New root scripts: `dev:infra:up`, `dev:infra:down`, `dev:infra:reset`, `dev:infra:logs`, `db:migrate:dev`, `db:seed:dev`.
- Reverted the loopback port mapping added to `docker-compose.yml`'s `db` service in the previous session — that belongs on the dev-only file, not the production one.
- `apps/api`'s `dev`/`start`/`db:*`/`test:integration` scripts now load `../../.env` via `dotenv-cli`, so `pnpm db:migrate:dev`/`db:seed:dev`/`pnpm dev` pick up the repo-root `.env` without each script needing `DATABASE_URL` exported manually.
- `.env.development.example` — a dev-specific env template (`localhost` hostnames for Postgres/MinIO) distinct from `.env.example` (Docker network hostnames, for the production stack).
- `README.md` — project overview, tech stack, repo layout, and a from-scratch local dev setup (clone → install → `dev:infra:up` → copy env → migrate → seed → `pnpm dev`), plus the separate production/self-hosting path and the non-negotiable architecture rules.
- Verified the full README setup sequence end-to-end against freshly created containers: `dev:infra:reset` → `db:migrate:dev` → `db:seed:dev` → `pnpm dev` (API `/health` and web both responding).
- Deleted the old dev Postgres container/volume from the previous session and rebuilt from scratch under the new dev compose file.
- Phase: Phase 0 · Foundation

### 2026-08-05 — Postgres + Drizzle: identity/org schema and DB-enforced ledger core
- Drizzle schema for identity & org (`organisations`, `users`, `memberships` with a 4-role enum, `sessions`, `settings`), `number_sequences` (§6.5 gapless numbering), and `audit_log` (§10.4).
- Ledger core (`accounts`, `journal_entries`, `journal_lines`, `fiscal_periods`) per §7 — `journal_lines` carries optional `contact_id`/`job_id` so AR aging and job profitability can be derived from the ledger rather than a parallel calculation, per §7.1.
- The debits-equal-credits invariant (§6.3) is enforced by Postgres itself, not application code: a `DEFERRABLE INITIALLY DEFERRED` constraint trigger validates each entry's balance at COMMIT (a plain `CHECK` doesn't work here — it fires after each single-row line insert, rejecting an entry before its offsetting line lands). Separate triggers make `journal_entries`/`journal_lines` immutable after insert (only `reversed_by_id` may be set once, per the reversing-entry correction model) and reject any UPDATE/DELETE otherwise.
- Chart-of-accounts seed (`apps/api/src/db/seed/`, invoked via `scripts/seed.ts`) matching §14.2 exactly, including which accounts are system-protected (AR, AP, tax, retention, advances, retained earnings).
- Verified directly against Postgres via `docker compose`: balanced entries commit, unbalanced entries are rejected at commit with a clear error, and edits/deletes on committed entries/lines are rejected. Same invariants covered by an automated integration suite (`apps/api/src/db/ledger-integrity.integration.test.ts`, run via `pnpm test:integration`, kept separate from the unit `test` script so CI without a DB still passes).
- `docker-compose.yml`'s `db` service now publishes `127.0.0.1:5432` (loopback-only) so migrations/seed/`db:studio` are reachable from the host without exposing Postgres to the network.
- Stories: S-09.1 (seeded chart of accounts); ledger/numbering/audit schema underpins most of Phase 1+ but isn't itself a numbered story
- Phase: Phase 0 · Foundation

### 2026-08-05 — Monorepo scaffold + money/tax core
- Turborepo + pnpm workspace: `apps/api` (NestJS, all 18 module stubs from §6.7 wired into `AppModule`, `/health` endpoint verified booting), `apps/web` (Next.js App Router, Tailwind v4 via `@spine/config`'s CSS-native preset), `packages/shared` (money as integer minor units + currency, half-up per-line tax engine, base zod schemas), `packages/ui` (placeholder, primitives not yet built), `packages/config` (shared eslint/tsconfig/tailwind).
- `docker-compose.yml` with `minimal` (db/api/web/caddy) and `full` (+minio/tunnel) profiles per §11.1, plus `docker/Dockerfile.api`, `docker/Dockerfile.web`, `docker/Caddyfile`.
- `.env.example` with the 3 required vars (`DATABASE_URL`, `AUTH_SECRET`, `APP_URL`) and optional SMTP/S3/locale blocks that degrade gracefully per §6.8.
- Verified: `pnpm install`, and `turbo run build lint typecheck test` all pass clean across every package; the built API boots and all modules initialize.
- Stories: partial S-00.1 (scaffold only — no DB/auth/CI yet)
- Phase: Phase 0 · Foundation

<!--
Entry format when adding completed work:

### 2026-08-05 — Short title
- What shipped, in a sentence or two.
- Stories closed: S-00.1, S-00.2 (reference PRD §9 IDs)
- Phase: Phase 0 · Foundation
-->
