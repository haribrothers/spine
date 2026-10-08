# 01 · Tech stack

Settled choices, recorded with rationale so they are not relitigated. Versions are the ranges in each `package.json` at the time of writing; the lockfile is the truth. Changing a row here needs a decision in [12-decisions](12-decisions.md).

## Shared

| Concern | Choice | Why |
|---|---|---|
| Language | TypeScript 5.7 (web, API, shared); TypeScript ~6.0 (Expo apps) | One language end to end |
| Runtime | Node ≥ 20 in production images; Node 22 for development and CI (jsdom 30 needs ≥ 22.22.2) | LTS |
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
| Files | `StorageDriver` with two drivers: `local` (default — a Docker volume on the API container) and `s3` (`@aws-sdk/client-s3`, for AWS S3, R2, B2 or a self-hosted store) ([D-102](12-decisions.md)) | No extra container by default; MinIO dropped after its free images were withdrawn |
| Email | Nodemailer 9 over SMTP | No SaaS needed; queued with retry |
| PDF | `@react-pdf/renderer` 4, with bundled Noto Sans and Noto Sans Devanagari fonts from Phase 9 ([D-151](12-decisions.md)) | Same output on every install; ₹ and Indian names print |
| Spreadsheets | `exceljs` for `.xlsx` report, GSTR-1 review and export files (Phase 8, [D-144](12-decisions.md)); `papaparse` for CSV imports | MIT, CommonJS, streams large sheets |
| QR codes | `qrcode` for UPI QR codes on invoices (Phase 9, [D-150](12-decisions.md)) | MIT, no network |
| ZIP | `fflate` ([D-132](12-decisions.md)) — bulk PDFs, data export, Tally export | Small, dependency-free |
| AI (optional, Phase 9) | `AiDriver`: `openai-compatible` and `anthropic` drivers over `fetch` (no SDK dependency); `unpdf` (MIT) for PDF text before sending ([D-163](12-decisions.md), [D-170](12-decisions.md)) | Owner's own local or cloud model; nothing runs when AI is off |
| Browser push | `web-push` 3 (VAPID) | Optional; disabled without keys |
| Rate limiting | `@nestjs/throttler` 6 (in-memory) | Public quote endpoints |
| Tests | Vitest 2 (unit + integration against a real `spine_test` database) | |

## `apps/web` — the office app and public quote page

| Concern | Choice | Why |
|---|---|---|
| Framework | Next.js 15 (App Router), React 19 | Server components; modest hardware |
| Styling | Tailwind CSS 4 with CSS-variable tokens (`packages/config/tailwind-preset.css`) | Re-skin by overriding tokens |
| Components | `@spine/ui` (Radix primitives + `cva` + `tailwind-merge`), 79 components | Own the library ([D-008](12-decisions.md)) |
| Theme | `next-themes` (`data-theme`, light/dark/system) | |
| Charts | Recharts 3 via `@spine/ui` chart components | |
| Command palette | cmdk | |
| Docs | `apps/design-system` (Next.js docs app) | Living spec for `@spine/ui` |

## `apps/site` — website, user guide and developer docs (Phase 11)

| Concern | Choice | Why |
|---|---|---|
| Framework | Astro 5 + Starlight ([D-108](12-decisions.md)) | Static docs site with navigation, dark mode, accessible markup and i18n built in |
| Search | Pagefind (built into Starlight) | Runs in the browser, so it works in the offline bundled guide |
| API reference | `starlight-openapi`, from the API's OpenAPI document | Generated, so it never drifts from the code |
| Versions | `starlight-versions`, one per minor release from 1.0 ([D-111](12-decisions.md)) | Self-hosters on older versions read matching docs |
| Link checks | `starlight-links-validator` | Broken links fail the build |
| Hosting | GitHub Pages at `docs.[DOMAIN]` ([D-112](12-decisions.md), [Q-15](13-risks-open-questions.md)) | Free on the Pro plan; public site from the private repo |
| In-app copy | The user guide and self-hosting sections are bundled into the web image at `/help` ([D-110](12-decisions.md)) | Help works offline and matches the installed version |

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
| Container | Docker Compose, profiles `minimal` (db, api, web, caddy — attachments included) and `full` (+ Cloudflare tunnel); optional `rustfs` profile (`rustfs/rustfs:1.0.x`, memory-limited) for self-hosted S3 ([D-103](12-decisions.md)) | Single-host deploy |
| Reverse proxy | Caddy 2 (automatic HTTPS) | Zero-config TLS |
| Remote access | Cloudflare Tunnel (optional) | Public quote links for installs behind NAT |
| CI | GitHub Actions: lint, typecheck, build, unit, migrations, integration; separate E2E job | |
| E2E | Playwright 1.49 (`apps/e2e`) against real API + web on a scratch database | |

## Configuration

One `.env`. Required: `DATABASE_URL`, `AUTH_SECRET`, `APP_URL`. Everything else is optional and degrades gracefully: `API_URL`, `NEXT_PUBLIC_API_URL`, `SMTP_*` (email queued, not sent), `STORAGE_DRIVER` (`local` default or `s3`), `FILES_DIR` (default `/data/files`), `S3_*` (only for the `s3` driver; without them a switch to `s3` leaves uploads unavailable), `CURRENCY`, `LOCALE`, `TZ`, `CLOUDFLARE_TUNNEL_TOKEN`, `SEED_DEMO`, `VAPID_*` (browser push hidden), `UPDATE_CHECK` (`off` disables the daily check, [D-055](12-decisions.md)) and `MOBILE_MIN_VERSION` (oldest field app the API accepts, [D-071](12-decisions.md)).
