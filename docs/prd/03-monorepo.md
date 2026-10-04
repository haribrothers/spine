# 03 · Monorepo

pnpm workspaces + Turborepo. Every package is TypeScript.

## Tree

```
spine/
├─ apps/
│  ├─ api/                    NestJS API
│  │  ├─ drizzle/             SQL migrations (generated + hand-authored backfills)
│  │  └─ src/
│  │     ├─ auth/             Better Auth setup, guards (@OrgRoles, @RequireCapability), capability.util.ts
│  │     ├─ common/           idempotency interceptor, errors, pagination
│  │     ├─ db/               Drizzle schema (56 tables), seed, reset
│  │     ├─ health/           GET /health
│  │     └─ modules/          audit, catalog, contacts, credit-notes, dashboard, demo-data, email, files,
│  │                          invoices, jobs, ledger, notifications, numbering, org, payments, pdf,
│  │                          purchases, queue, quotes, reports, tax, teams, users
│  ├─ web/                    Next.js office app + public quote page + onboarding
│  ├─ mobile/                 Expo field app (Phase 5)
│  ├─ e2e/                    Playwright suite against real api + web
│  ├─ design-system/          Docs app for @spine/ui
│  ├─ design-system-native/   Docs app for NativeWind @spine/ui-native components
│  └─ showcase-native/        Docs app for @expo/ui @spine/ui-native components (expo-router)
├─ packages/
│  ├─ shared/                 money + tax engine, Zod schemas, capability list, shared types
│  ├─ ui/                     @spine/ui (78 web components)
│  ├─ ui-native/              @spine/ui-native (native components, tokens, tailwind preset, navigation, jest base)
│  ├─ sdk/                    API client generated from OpenAPI
│  └─ config/                 eslint, tsconfig, tailwind preset (CSS tokens)
├─ docker/                    Dockerfile.api, Dockerfile.web, Caddyfile
├─ scripts/                   seed.ts, create-native-app.mjs (install.sh, backup.sh, restore.sh: Phase 8)
├─ docs/                      this spec, design, QA script
├─ docker-compose.yml         production (profiles minimal/full)
├─ docker-compose.dev.yml     local infra: Postgres, MailDev (files use the local driver; optional rustfs profile)
└─ turbo.json
```

## Dependency rules

1. `apps/*` may depend on `packages/*`; `packages/*` never depend on `apps/*`.
2. `packages/shared` depends on nothing internal; both API and clients use its Zod schemas and capability list, so the permission UI and the enforcement layer can't drift.
3. `apps/web` never imports from `apps/api`; it talks HTTP.
4. `packages/ui` has no data fetching and no business rules. `packages/ui-native` likewise.
5. New native apps are created with `node scripts/create-native-app.mjs <name>`, never by hand ([native notes](../design/native-notes.md)).
6. Money and tax maths happen only in `packages/shared` (money/tax engine); the API never recomputes totals differently from it.

## Root scripts

| Command | Does |
|---|---|
| `pnpm dev` | API + web + design-system in watch mode (not the Expo apps) |
| `pnpm dev:infra:up` / `:down` / `:reset` | Local Postgres and MailDev (add `--profile rustfs` to test the S3 driver) |
| `pnpm db:migrate:dev` / `db:seed:dev` / `db:reset:dev` | Migrations, seed, reset the dev database |
| `pnpm build` / `lint` / `typecheck` / `test` | Turborepo across all packages |
| `pnpm test:e2e` (`:ui`) | Playwright suite (needs `spine_e2e` database) |
| `pnpm dev:mobile` / `dev:ios` / `dev:android` | Field app |
| `pnpm dev:ui-native`, `dev:showcase-native` | Native doc apps |
| `pnpm create:native-app <name>` | Scaffold a native app wired to `@spine/ui-native` |

## Pipeline (CI)

Runs on pull requests into `main` only (and on demand), never on every push; docs-only PRs skip the test jobs — see [11-testing-release](11-testing-release.md#branches-and-pull-requests) for the branch workflow and the minute-saving rules.

| Job | Steps |
|---|---|
| `test` · "Unit and integration" | install → lint → typecheck → unit tests (Turbo-cached) → run migrations → integration tests (real Postgres) |
| `e2e` · "E2E" | runs after `test` passes · install → Playwright browsers (cached) → production build of API + web → E2E suite on a scratch database |

Release, restore verification and mobile builds are added in Phase 8 ([11-testing-release](11-testing-release.md)).
