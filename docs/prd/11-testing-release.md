# 11 · Testing and release

## Test pyramid

| Layer | Tool | Where | What it must cover |
|---|---|---|---|
| Unit | Vitest | `packages/shared`, `apps/api/src/**/*.test.ts` | Money (rounding half-up at line level), tax engine, posting rules P1–P16 ([06](06-ledger-posting-rules.md)), numbering format, capability resolution |
| Component a11y | Vitest + jsdom + axe-core | `packages/ui/src/components/*.a11y.test.tsx` | Every `@spine/ui` component, WCAG 2.1 A+AA tags; coverage enforced by `check-a11y-coverage.mjs` |
| Native component | Jest (jest-expo) + RNTL | `packages/ui-native/src/**/*.test.tsx` | Props passed to `@expo/ui` bridges; NativeWind class pairs; regression tests from [native notes](../design/native-notes.md) |
| Integration | Vitest against real Postgres, a database copy per worker; files in parallel locally ([D-239](12-decisions.md)) | `apps/api/src/**/*.integration.test.ts` | One file per document lifecycle (quote, job, invoice, payment, credit note, vendor bill, expense); capability/ownership per module; idempotency replay; ledger integrity after every workflow |
| E2E | Playwright (real API + web, no mocks) | `apps/e2e/tests/` | Quote → invoice → payment smoke, dashboard, reports, public quote page, route smoke; worker-scoped `seededOrg` fixture |
| Mobile E2E | Maestro flows | `apps/mobile/e2e/` (Phase 5) | Sign in, Today, photo upload offline replay, expense capture, on-site acceptance |
| Manual | QA script | `docs/qa-script.md` | Every user-facing feature by area; regression checks for shared computations |

Story tests are named after the story id: `describe('US-INV-04', …)` or `us-inv-04.spec.ts`. This applies to new work; stories built before the rule keep their tick while their criteria pass ([D-076](12-decisions.md)).

### Testing the field app (Phase 5)

Phase 5 is done when the app works end to end in airplane mode and syncs with no duplicates. That is tested in four layers, most of it automated:

| Layer | Tool | What it proves |
|---|---|---|
| Outbox and cache | Jest (jest-expo) in `apps/mobile`, with a fake transport and an in-memory SQLite | Each outbox item keeps one `Idempotency-Key` across retries. A network error stays `waiting` and backs off. A lost response is retried and treated as sent. A 4xx goes to `failed` with the server's reason. A 426 stops sending and keeps the queue. Items send in order. The cache serves jobs and milestones when offline |
| Server replay | Vitest integration (`apps/api`) | Replaying the same key for a photo, expense or milestone completion returns the first result and creates nothing. A second completion returns `alreadyCompleted: true`. `reject-in-person` and `accept-in-person` need a live call. `X-Spine-Client-Version` under `MOBILE_MIN_VERSION` returns 426 |
| Flows on a simulator | Maestro (`apps/mobile/e2e/*.yaml`), iOS Simulator and Android emulator, against the local API with the seeded e2e org | Sign in, Today, a job, expense with a receipt, photos, mark complete, present and accept a quote. Offline replay: go offline, add 2 photos, an expense and a completion, check the waiting count, come back online, then check through the API (`runScript` with `http`) that each exists exactly once |
| Real phone | `docs/qa-script.md` | One iPhone and one Android phone in real airplane mode, plus a flaky-signal walk, before the Phase 5 PR |

Going offline on a simulator: on Android, Maestro toggles airplane mode on the emulator. The iOS Simulator can't, so the E2E build (`EXPO_PUBLIC_E2E=1`, never in a store build) has a hidden network override. It makes the transport fail the way no network does and makes NetInfo report offline. Maestro flows run locally (`pnpm --filter @spine/mobile test:e2e`, and `test:e2e:android` on an Android 15 emulator — see `docs/design/native-notes.md`) before the Phase 5 PR. CI runs the Jest and integration layers, since macOS runners for simulators aren't part of CI.

## CI

| Job | Trigger | Steps | Blocks merge |
|---|---|---|---|
| `changes` ("Detect changes") | PR into `main` (not drafts), `v*` tag, manual | Decides what runs: docs-only changes run nothing; a change only to the home page, the docs site or how they publish (`apps/site`, `apps/docs` except `openapi.json`, `scripts/site`, `wrangler.jsonc`) runs `sites` alone; `docs/design/tokens.json` counts as app code, since every app reads it; integration runs when the API, shared packages, lockfile or workflow changed ([D-205](12-decisions.md)); E2E only on a `v*` tag or a manual run ([D-260](12-decisions.md)); a tag or manual run runs everything | — |
| `static` ("Lint, typecheck and unit") | any change to code outside the two sites | install (frozen lockfile) → lint → typecheck → unit (no services) | Through "Unit and integration" |
| `integration` ("Integration") | after `static`, when its paths changed | Postgres + S3Mock services (S3Mock for the `s3` storage-driver tests) · build shared packages → migrate → integration (one worker on its own copy of the migrated database; locally files run in parallel — [D-239](12-decisions.md)), stopping at five failing tests; a failure cancels the run | Through "Unit and integration" |
| `sites` ("Sites") | a change only to the sites (see `changes`) | install the two sites alone (as Cloudflare's build does) → `astro check` for both → `scripts/us-site-14.test.mjs` and `scripts/us-site-02.test.mjs` → `pnpm site:build` (link-checked); a change that also touches app code builds the sites in `static` instead | Through "Unit and integration" |
| `unit-and-integration` ("Unit and integration") | after `static`, `integration` and `sites` | Passes when `static` passed and `integration` passed or was skipped, or, for a sites-only change, when `sites` passed — the required check, keeping its name | Yes |
| `e2e` ("E2E") | `v*` tag or manual run, after `static`, alongside `integration`; skipped on PRs, which counts as passing ([D-260](12-decisions.md)); files use the `local` storage driver (no storage service) | Postgres + maildev services → Playwright browsers (cached) → production build (Next.js build cache kept between runs, [D-241](12-decisions.md)) → `pnpm site:build` (US-SITE-02's spec serves it) → `@spine/e2e test` (one worker, 60-minute limit), stopping after five failing specs; a failure cancels the run, and the report is kept when it fails or runs out of time | Before a release |
| `a11y-routes` | `v*` tag or manual run (Phase 12), like E2E ([D-260](12-decisions.md)); locally in `pnpm verify` | Playwright + axe on every route with demo data (US-OPS-17), at desktop width and in the `phone` project (390×844, touch), where each route is also checked for no sideways scroll, its main action on the first screen, no overlapping labels and 44px controls, in light and dark (US-OPS-62, NFR-COMP-02) | Before a release |
| `self-hosting` ("Self-hosting checks", `self-hosting.yml`): restore-verify | `v*` tags and manual runs (from `ci.yml`, before `release`), and nightly from `nightly.yml` once the repo is public ([D-262](12-decisions.md)) | build this commit's images → install from the release's files → sign up and seed the demo business → wait for issued PDFs → encrypted backup → wipe → install again with the same `.env` → restore (every file's checksum checked as it's written) → compare trial balance and file count (`scripts/ci/restore-verify.sh`, US-OPS-04) | Before a release |
| `audit` | PR + release | `pnpm audit --prod` (NFR-SEC-04), secret scan | Yes |
| Site publishing (Cloudflare Workers Builds, not a GitHub workflow, [D-274](12-decisions.md)) | push to `main` touching `apps/site/**`, `apps/docs/**` or `apps/api/openapi.json`; a preview for every branch | `pnpm site:build` (link-checked) → deploy the home page to `spine.h4loom.com` with the docs under `/docs/` ([D-273](12-decisions.md)) | — (main is already merged) |
| `self-hosting`: upgrade-verify | same run, after restore-verify, with the same images | install the previous release from its GitHub release and GHCR images → sign up at the address in its `.env`, seed the demo business, wait for issued PDFs → `upgrade.sh --version <this> --files <this commit's release files>` (backup, checked files, snapshot before migrations) → compare trial balance and file count; nothing to check before the first release (`scripts/ci/upgrade-verify.sh`, US-OPS-50, [D-264](12-decisions.md)) | Before a release |
| `release` | tag `v*`, after CI passes | build `ghcr.io/haribrothers/spine-api`, `spine-web` and `spine-proxy` (amd64 + arm64) → GitHub release with the scripts, Compose file and checksums; a `-beta.N` or `-rc.N` tag is a pre-release, never `latest` (US-OPS-51, [D-262](12-decisions.md)) → the field app: a beta's built on the Owner's Mac (`scripts/mobile/build-beta.sh`, D-271) and its APK attached to the release; from 1.0, store builds on GitHub's macOS runners (US-MOB-29) | — |

## Branches and pull requests

- `main` is protected: no direct pushes, no force-pushes, no deletion; changes arrive only by pull request with both CI checks green ([D-101](12-decisions.md)). "E2E" is skipped on pull requests and counts as passing ([D-260](12-decisions.md)).
- Each phase gets its own branch from `main`, named `phase-<n>-<short-name>` (e.g. `phase-6-fix-and-harden`). Stories are committed on that branch, one commit (or more) per story, with the story id in the message (`US-OPS-08: add idempotency to the remaining routes`).
- Run the checks locally while working (`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm --filter @spine/api test:integration`, `pnpm test:e2e`); CI does not run on branch pushes.
- Before a pull request is opened (or marked ready for review), `pnpm verify` runs everything CI runs, in CI's order, against the local Docker database: lint → typecheck → unit → integration → E2E. It creates and migrates `spine_test` and `spine_e2e` if they're missing, stops at the first failure, and `pnpm verify --from <step>` resumes there ([D-205](12-decisions.md)). CI should confirm a green branch, not discover failures. CI doesn't run E2E on pull requests, so this is the only E2E run before merging: open the PR from the commit `pnpm verify` passed on, and say in its description which commit that was and how many E2E tests passed ([D-260](12-decisions.md)).
- When every story in the phase is done and `pnpm verify` passes, open one pull request into `main`. Open it as a draft if you want to share it early — drafts don't run CI; "Ready for review" does.
- After a CI failure, fix it locally, then push (a new run) or use "Re-run failed jobs" for a flaky job — never "Re-run all jobs", which repeats the jobs that passed.
- Each new push to the PR cancels the run in progress and starts a fresh one.

### Keeping within a private repo's Actions limits

| Rule | Saves |
|---|---|
| Runs on PRs into `main`, `v*` tags and manual dispatch only | Every routine commit |
| E2E runs in CI only on a `v*` tag or a manual run; locally in `pnpm verify` before every PR ([D-260](12-decisions.md)) | 35–45 minutes of every PR run |
| A "Detect changes" job (`dorny/paths-filter`) skips both test jobs when only `docs/**`, `*.md`, `.vscode/**` or `LICENSE` changed; skipped required checks count as passed, so docs-only PRs still merge | Spec and docs-only PRs (~10 s instead of ~7 min) |
| A change only to the home page or docs site runs the `sites` job alone: no audit, no other packages' lint, typecheck or unit tests | Site and guide PRs (a few minutes instead of ~15) |
| Draft PRs skipped | Work-in-progress pushes |
| `concurrency` with `cancel-in-progress` | Superseded runs |
| E2E waits for `test` (`needs`) | E2E minutes when unit tests already fail |
| pnpm store, Turbo and Playwright browser caches | Install and rebuild time on re-runs |
| One production build (in E2E), timeouts of 15 minutes (lint, typecheck and unit), 30 (integration) and 60 (E2E, which runs only before a release) | Duplicate builds, runaway jobs |
| Playwright report only when E2E fails or runs out of time, kept 3 days | Artifact storage |

Phase 12 adds the nightly self-hosting checks (`nightly.yml`, once the repo is public); keep it to one run a day, and consider moving it to weekly if the minutes budget is tight.

## Release artifacts

| Artifact | Built from | Where |
|---|---|---|
| `spine-api`, `spine-web` and `spine-proxy` Docker images (amd64 + arm64) | `docker/Dockerfile.api`, `docker/Dockerfile.web`, `docker/Dockerfile.proxy` (Caddy with `docker/Caddyfile`, D-280) | Container registry, tagged `X.Y.Z` and `latest` |
| `docker-compose.yml`, `Caddyfile`, `.env.example`, `docker-compose.coolify.yml`, `docker-compose.panels.yml` | repo root, `docker/` (`docker/coolify/`, `docker/panels/`) | Release assets |
| `install.sh`, `backup.sh`, `restore.sh` | `scripts/` | Release assets with SHA-256 checksums |
| iOS and Android builds | `apps/mobile`: during the beta `scripts/mobile/build-beta.sh` on the Owner's Mac; from 1.0 GitHub's macOS runners (D-271) | TestFlight and the APK on the release (beta); App Store / Play Store (1.0, [15](15-mobile-release.md)) |
| Release notes | `CHANGELOG.md` | GitHub release |

## Versioning

- Semantic versioning for the whole product (one version for API, web and images). Mobile builds carry the same marketing version; build numbers increase per store upload.
- Database migrations are forward-only; an upgrade from any earlier 1.x release must succeed (NFR-MNT-02).
- The API rejects a mobile client older than the minimum supported version with `426 CLIENT_TOO_OLD` and the app shows "Update Spine to keep going".

## Definition of done (every story)

1. Every acceptance criterion has a passing automated test named after the story id (or a QA-script step where automation isn't possible, e.g. VoiceOver).
2. Lint, typecheck, unit, integration and E2E pass — E2E locally in `pnpm verify` before the PR, the rest in CI too ([D-260](12-decisions.md)).
3. Any contract change is reflected in [04](04-data-model.md) / [05](05-api.md) in the same change.
4. New capabilities are enforced in the service layer and reflected in the web UI ([07](07-security.md)).
5. New or changed UI uses design-system components and tokens, works in light and dark mode, and component changes ship with their doc page and a11y test (both themes).
6. `docs/qa-script.md` and `CHANGELOG.md` are updated; from Phase 12, the story's user-guide page in `apps/docs` is added or updated ([D-113](12-decisions.md)); the story is ticked in [progress.md](../progress.md).

## Appendix — testing expectations moved verbatim from CLAUDE.md

## Testing expectations once code exists (PRD §10.11)

- Unit tests are mandatory for money, tax, and posting-rule modules — this is where silent financial bugs hide.
- Integration tests per document lifecycle (quote, invoice, payment, etc.).
- A ledger-integrity test asserting the trial balance stays balanced after every simulated workflow.
- E2E smoke test covering quote → invoice → payment — **built**, see `apps/e2e/` (Playwright, driving real `apps/api`+`apps/web` instances, no mocks). Now also covers Dashboard v2, Reports, the public quote page, and a broad route-smoke pass across every other page (29 tests total across 5 spec files) — see CHANGELOG's 2026-08-29 entries for the full breakdown. Run locally via `pnpm test:e2e` (or `pnpm test:e2e:ui` for Playwright's UI mode) from the repo root — needs `docker-compose.dev.yml`'s `db`/`maildev` services running, plus a one-time `createdb spine_e2e` (see `.env.e2e`'s own comment); runs automatically in CI as its own job. Extend `apps/e2e/tests/` for future coverage rather than starting a second E2E setup. Use `fixtures.ts`'s worker-scoped `seededOrg` fixture (one `POST /demo-data/seed` per spec file) for any new test needing non-empty data — a per-test-scoped seed was tried first and caused a real, confirmed-live pg-boss queue backlog that intermittently broke unrelated tests; don't reintroduce that pattern. A spec that loads or deletes demo data of its own (US-ONB-17, US-ONB-18) goes in the `demo-data` Playwright project, which runs after the rest: the demo Staff and Field logins follow the latest demo, and every other spec expects them in `seededOrg` (run one such spec alone with `--no-deps`).
- `docs/qa-script.md` is the human-run counterpart to the above — update it alongside a feature's automated tests, not instead of them. See the pointer near the top of this file.
