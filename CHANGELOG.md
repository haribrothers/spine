# Changelog

Tracks what's been built and what's next, phase by phase per `docs/spine-prd.md` §12. Update this file as work lands — newest entry on top within each section. This is the progress log; `CLAUDE.md` is the architecture/rules reference.

## Status

**Current phase:** Phase 0 · Foundation — in progress. Monorepo scaffold, Docker Compose shape, and the money/tax core in `@spine/shared` are in place. No database, auth, or ledger persistence yet.

## Next up

- Postgres + Drizzle: schema and migrations for identity/org tables, `number_sequences`, `audit_log`, and the ledger core (`accounts`, `journal_entries`, `journal_lines`) with the debits-equal-credits constraint (§6.3, §7).
- Better Auth wiring (cookie sessions for web, JWT for mobile).
- `@spine/ui` primitive set (button, input, select, combobox, date picker, table, dialog, drawer, tabs, toast, form fields, money input — full list in §F0), theme tokens, dark/light mode, Storybook, a11y pass.
- First-run onboarding wizard shell (business profile, industry template, currency/FY, tax confirmation, CoA review, team invite) — skippable, settings stay editable later.
- CI pipeline.

## Completed

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
