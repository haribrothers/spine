# CLAUDE.md — Spine

Spine is a self-hosted business management app for small service and project businesses (enquiry → quote → job → invoice → payment → books) with double-entry accounting derived from business events. The full product spec is in `docs/`. This file is the short version of the rules; the docs are the detail.

## Before you start any task
1. Read `docs/README.md` once per session, then only the docs the task needs. Check `CHANGELOG.md` for what landed recently.
2. For a story: read the story in `docs/features/<module>.md`, its screens in `docs/design/screens.md` (look at the images in `docs/design/screens/`), and the contracts it names in `docs/prd/04-data-model.md` and `docs/prd/05-api.md` (including "Contract additions from the feature files").
3. For a phase: read `docs/prd/10-phases.md` for that phase and work through its stories in order. Phases 0–9 are built; check `docs/progress.md` for what's open.
4. Check `docs/prd/12-decisions.md` before choosing a library, a pattern or behaviour that isn't spelled out.
5. Touching auth, roles or any endpoint's authorization: read `docs/prd/07-security.md` first, including its appendix. Touching `packages/ui-native` or a native app: read `docs/design/native-notes.md` first.

## How to work
- Never commit to `main`. Each phase is a branch `phase-<n>-<short-name>` from `main`; commit each story there with its id in the message; open one PR into `main` when the phase's stories are done. CI runs only on that PR, so run lint, typecheck and tests locally before committing, and `pnpm verify` (everything CI runs, including E2E) before opening the PR or marking it ready.
- Work one story at a time. Say which story (e.g. `US-INV-05`) you're implementing.
- A story is done only when every acceptance criterion passes with an automated test named after the story id (`us-inv-05.spec.ts` or `describe('US-INV-05', …)`), plus the definition of done in `docs/prd/11-testing-release.md`.
- Tick the story in `docs/progress.md`, add a `CHANGELOG.md` entry and update `docs/qa-script.md` (new steps plus regression checks for every screen the change touches) in the same change.
- If you change a contract (API route, table, column, event, error code, capability, posting rule), update `docs/prd/05-api.md`, `04-data-model.md`, `07-security.md` or `06-ledger-posting-rules.md` in the same change.
- If a story, a screen and the architecture disagree: the story wins over the screen; the architecture and decisions win over the story. If it's still unclear, stop and ask; add the question to `docs/prd/13-risks-open-questions.md`.
- Controls that depend on a later phase are hidden behind flags in `packages/shared/src/feature-flags.ts` until that phase ships.
- User-facing help lives in the docs site (`apps/site/src/content/docs/guide/`), not in `docs/` (that's the spec). From Phase 11, when a story changes what people see, update its guide page in the same change.
- Don't build beyond the story. Non-goals in `docs/prd/00-overview.md` are out of scope (no multi-tenant SaaS, multi-org, payroll, inventory valuation, multi-currency, live bank feeds, filing returns). Work planned after 1.0 is in `docs/prd/16-roadmap.md` — don't build it early.

## Stack (don't substitute)
TypeScript strict · pnpm + Turborepo · Next.js 15 App Router + Tailwind 4 + `@spine/ui` (Radix) · NestJS 11 REST + OpenAPI · PostgreSQL 16 + Drizzle · Better Auth · pg-boss · files via `StorageDriver` (local volume; S3 optional) · @react-pdf · Expo SDK 57 + expo-router + `@spine/ui-native` (`@expo/ui`, NativeWind) · Vitest, Jest, Playwright, axe-core · Docker Compose + Caddy.

## Architecture rules
- The ledger is derived, never authored: domain service → posting rule (one module, `docs/prd/06-ledger-posting-rules.md`) → balanced journal entry, in the same transaction as the business document.
- Journal entries are immutable; corrections are reversing entries. The database enforces debits = credits.
- Money is `bigint` minor units + currency code; rounding once per line, half-up; tax per line.
- Issued documents snapshot their data, get a gapless permanent number under a row lock, and are never edited or deleted — only voided or credited.
- Every mutating endpoint accepts an `Idempotency-Key`.
- Files go through `StorageDriver` (`local` by default, `s3` optional); never read the files volume or bucket directly, and never serve a file without checking the owning record.
- Job costing and AR/AP aging come from filtering journal lines (`contact_id`, `job_id`) — never a parallel calculation. Retention posts to 1150 Retention Receivable.
- The app boots with only `DATABASE_URL`, `AUTH_SECRET`, `APP_URL`; SMTP or storage outages degrade, never crash.

## Security rules (never break)
- Authorization is checked server-side on every endpoint; never trust a client-supplied role. Ownership (own/others) checks run in the service layer, before status checks.
- Roles are Owner, Staff (Team grants, union) and Field (fixed, never Team-configurable). Managing users, Teams, settings and tax is Owner-only, always.
- Exactly one Primary Owner (partial unique index); it changes only by explicit transfer. Owner is never granted at invite time.
- The capability list the UI renders and the list the API enforces are the same list (`packages/shared/src/schemas/permissions.ts`); a capability gated in only one layer is a bug.
- Field users never reach financial reports or other people's money, on web or mobile.
- No secrets in the repo or logs; files are served only through authorised API routes; telemetry is off.

## UI rules
- Values come from `docs/design/tokens.json` via CSS variables in `packages/config` / `packages/ui` (native: `packages/ui-native/src/tokens`). No hex values or magic numbers in components.
- Use the design-system components (`docs/design/components/`). A component change ships with its doc page (`apps/design-system`, or `apps/showcase-native` for native) and its a11y test in the same change.
- Lucide icons only, per-icon imports on native; native themed classes always carry their `dark:` pair. Every menu action gets its icon from `lib/menu-icons.ts` (D-222); never add spacing around a menu icon. See `docs/prd/09-design-system.md`.
- Copy: sentence case, verbs on buttons, say what happens to people's data, errors say what to do next.
- A major action (issuing, recording, voiding, deleting, removing, emailing a customer, bulk changes) asks first with `useConfirm()` from `@spine/ui`; never one click from a menu (D-218). When it succeeds, `useToast()` (the app's one `ToastHost`) says what happened — call it before `router.push` and it shows on the next page (D-223).
- Every screen works in light and dark mode: colours only from tokens (web CSS variables, native `dark:` pairs or `useNativeColors()`), text on filled controls uses `on-primary`/`on-danger`. PDFs and emails stay light.
- Accessibility is required: WCAG 2.1 AA, keyboard, focus rings, 4.5:1 text contrast, reduce motion, no colour-only state, 44px touch targets on phone.

## Commands
`pnpm dev:infra:up` · `pnpm db:migrate:dev` · `pnpm db:seed:dev` · `pnpm dev` · `pnpm lint` · `pnpm typecheck` · `pnpm test` · `pnpm --filter @spine/api test:integration` · `pnpm test:e2e` · `pnpm verify` · `pnpm dev:mobile` · `pnpm create:native-app <name>`

## Where things are
`apps/api` NestJS · `apps/web` Next.js · `apps/mobile` field app · `apps/e2e` Playwright · `apps/design-system`, `apps/showcase-native` component docs · `packages/shared` money/tax/schemas · `packages/ui`, `packages/ui-native` · `packages/config` · `docs/` spec.
