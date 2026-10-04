# 01 · Tech stack

Settled choices, recorded with rationale so they are not relitigated. Versions are the ranges in each `package.json` at the time of writing; the lockfile is the truth. Changing a row here needs a decision in [12-decisions](12-decisions.md).

## Shared

| Concern | Choice | Why |
|---|---|---|
| Language | TypeScript 5.7 (web, API, shared); TypeScript ~6.0 (Expo apps) | One language end to end |
| Runtime | Node ≥ 20 (22 in development) | LTS |
| Monorepo | pnpm 9.15 workspaces + Turborepo 2 | Fast installs, cached task graph |
| Validation | Zod 4 schemas in `@spine/shared`, used by API and clients | One contract for request bodies |
| Money and tax | `@spine/shared` money/tax engine: integer minor units (`bigint`) + currency code; half-up rounding per line | Financial correctness ([D-004](12-decisions.md)) |
| Icons | Lucide (`lucide-react`, `lucide-react-native` per-icon imports) | One icon set everywhere ([D-029](12-decisions.md)) |

## `apps/api` — the server

| Concern | Choice | Why |
|---|---|---|
| Framework | NestJS 11, REST + OpenAPI (`@nestjs/swagger`) | Two known clients, not a public API; typed SDK from OpenAPI ([D-002](12-decisions.md)) |
| Database | PostgreSQL 16 | Transactions, constraints, numeric, row locks — non-negotiable for financial data |
| ORM / migrations | Drizzle ORM 0.45 + drizzle-kit 0.31, SQL migrations in `apps/api/drizzle/` | Readable SQL migrations |
| Auth | Better Auth 1.6: email/password, `organization` plugin, `bearer()` plugin for mobile | Self-hostable, Postgres-backed ([D-016](12-decisions.md)) |
| Background jobs | pg-boss 12 (queues in Postgres) | No Redis container |
| Files | S3 API (`@aws-sdk/client-s3`); MinIO by default | Self-host MinIO or point at S3/R2 |
| Email | Nodemailer 9 over SMTP | No SaaS needed; queued with retry |
| PDF | `@react-pdf/renderer` 4 | Same output on every install |
| Browser push | `web-push` 3 (VAPID) | Optional; disabled without keys |
| Rate limiting | `@nestjs/throttler` 6 (in-memory) | Public quote endpoints |
| Tests | Vitest 2 (unit + integration against a real `spine_test` database) | |

## `apps/web` — the office app and public quote page

| Concern | Choice | Why |
|---|---|---|
| Framework | Next.js 15 (App Router), React 19 | Server components; modest hardware |
| Styling | Tailwind CSS 4 with CSS-variable tokens (`packages/config/tailwind-preset.css`) | Re-skin by overriding tokens |
| Components | `@spine/ui` (Radix primitives + `cva` + `tailwind-merge`), 78 components | Own the library ([D-008](12-decisions.md)) |
| Theme | `next-themes` (`data-theme`, light/dark/system) | |
| Charts | Recharts 3 via `@spine/ui` chart components | |
| Command palette | cmdk | |
| Docs | `apps/design-system` (Next.js docs app) | Living spec for `@spine/ui` |

## `apps/mobile` — the field app (Phase 5)

| Concern | Choice | Why |
|---|---|---|
| Framework | Expo SDK 57 (React Native 0.86, React 19.2) | One codebase, iOS + Android |
| Navigation | expo-router with `unstable-native-tabs` (real native tab bar) | Native-first ([D-022](12-decisions.md)); migrating from React Navigation is a Phase 5 story |
| Components | `@spine/ui-native`: `@expo/ui` (SwiftUI / Jetpack Compose) for controls; NativeWind 4 for layout components | Genuine native controls on both platforms |
| Animation | react-native-reanimated 4.5 + react-native-worklets | Required by `@expo/ui` |
| Secure storage | expo-secure-store (session token, theme) | |
| Offline store | Local SQLite cache + outbox queue ([02-architecture §Offline](02-architecture.md#offline-sync-mobile)) | |
| Tests | Jest 29 (`@spine/ui-native/jest-config-base`) | |
| Docs | `apps/showcase-native` (`@expo/ui` components), `apps/design-system-native` (NativeWind components) | [D-034](12-decisions.md) |

## Infrastructure

| Concern | Choice | Why |
|---|---|---|
| Container | Docker Compose, profiles `minimal` (db, api, web, caddy) and `full` (+ MinIO, Cloudflare tunnel) | Single-host deploy |
| Reverse proxy | Caddy 2 (automatic HTTPS) | Zero-config TLS |
| Remote access | Cloudflare Tunnel (optional) | Public quote links for installs behind NAT |
| CI | GitHub Actions: lint, typecheck, build, unit, migrations, integration; separate E2E job | |
| E2E | Playwright 1.49 (`apps/e2e`) against real API + web on a scratch database | |

## Configuration

One `.env`. Required: `DATABASE_URL`, `AUTH_SECRET`, `APP_URL`. Everything else is optional and degrades gracefully: `API_URL`, `NEXT_PUBLIC_API_URL`, `SMTP_*` (email queued, not sent), `S3_*` (attachments read-only), `CURRENCY`, `LOCALE`, `TZ`, `CLOUDFLARE_TUNNEL_TOKEN`, `SEED_DEMO`, `VAPID_*` (browser push hidden), `UPDATE_CHECK` (`off` disables the daily check, [D-055](12-decisions.md)) and `MOBILE_MIN_VERSION` (oldest field app the API accepts, [D-071](12-decisions.md)).
