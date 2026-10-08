# 11 · Testing and release

## Test pyramid

| Layer | Tool | Where | What it must cover |
|---|---|---|---|
| Unit | Vitest | `packages/shared`, `apps/api/src/**/*.test.ts` | Money (rounding half-up at line level), tax engine, posting rules P1–P16 ([06](06-ledger-posting-rules.md)), numbering format, capability resolution |
| Component a11y | Vitest + jsdom + axe-core | `packages/ui/src/components/*.a11y.test.tsx` | Every `@spine/ui` component, WCAG 2.1 A+AA tags; coverage enforced by `check-a11y-coverage.mjs` |
| Native component | Jest (jest-expo) + RNTL | `packages/ui-native/src/**/*.test.tsx` | Props passed to `@expo/ui` bridges; NativeWind class pairs; regression tests from [native notes](../design/native-notes.md) |
| Integration | Vitest against real Postgres | `apps/api/src/**/*.integration.test.ts` | One file per document lifecycle (quote, job, invoice, payment, credit note, vendor bill, expense); capability/ownership per module; idempotency replay; ledger integrity after every workflow |
| E2E | Playwright (real API + web, no mocks) | `apps/e2e/tests/` | Quote → invoice → payment smoke, dashboard, reports, public quote page, route smoke; worker-scoped `seededOrg` fixture |
| Mobile E2E | Maestro flows | `apps/mobile/e2e/` (Phase 5) | Sign in, Today, photo upload offline replay, expense capture, on-site acceptance |
| Manual | QA script | `docs/qa-script.md` | Every user-facing feature by area; regression checks for shared computations |

Story tests are named after the story id: `describe('US-INV-04', …)` or `us-inv-04.spec.ts`. This applies to new work; stories built before the rule keep their tick while their criteria pass ([D-076](12-decisions.md)).

## CI

| Job | Trigger | Steps | Blocks merge |
|---|---|---|---|
| `test` ("Unit and integration") | PR into `main`, manual | Postgres + S3Mock services (S3Mock for the `s3` storage-driver tests) · install (frozen lockfile) → lint → typecheck → unit → migrate → integration (files run one at a time: they share one database) | Yes |
| `e2e` ("E2E") | after `test` passes; files use the `local` storage driver (no storage service) | Postgres + maildev services → Playwright browsers (cached) → production build → `@spine/e2e test` | Yes |
| `a11y-routes` | PR (Phase 11) | Playwright + axe on every route with demo data (US-OPS-17) | Yes |
| `restore-verify` | nightly and on `v*` tags (Phase 11) | install → seed → backup → clean install → restore → compare trial balance and file count (US-OPS-04) | Opens an issue on failure |
| `audit` | PR + release | `pnpm audit --prod` (NFR-SEC-04), secret scan | Yes |
| `site` (publish) | push to `main` touching `apps/site/**` or `apps/api/openapi.json` | build (link-checked) → deploy to GitHub Pages | — (main is already merged) |
| `release` | tag `v*` | build images → push to registry → attach `install.sh` + checksums → mobile EAS build | — |

## Branches and pull requests

- `main` is protected: no direct pushes, no force-pushes, no deletion; changes arrive only by pull request with both CI checks green ([D-101](12-decisions.md)).
- Each phase gets its own branch from `main`, named `phase-<n>-<short-name>` (e.g. `phase-6-fix-and-harden`). Stories are committed on that branch, one commit (or more) per story, with the story id in the message (`US-OPS-08: add idempotency to the remaining routes`).
- Run the checks locally while working (`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm --filter @spine/api test:integration`, `pnpm test:e2e`); CI does not run on branch pushes.
- When every story in the phase is done, open one pull request into `main`. Open it as a draft if you want to share it early — drafts don't run CI; "Ready for review" does.
- Each new push to the PR cancels the run in progress and starts a fresh one.

### Keeping within a private repo's Actions limits

| Rule | Saves |
|---|---|
| Runs on PRs into `main` and manual dispatch only | Every routine commit |
| A "Detect changes" job (`dorny/paths-filter`) skips both test jobs when only `docs/**`, `*.md`, `.vscode/**` or `LICENSE` changed; skipped required checks count as passed, so docs-only PRs still merge | Spec and docs-only PRs (~10 s instead of ~7 min) |
| Draft PRs skipped | Work-in-progress pushes |
| `concurrency` with `cancel-in-progress` | Superseded runs |
| E2E waits for `test` (`needs`) | E2E minutes when unit tests already fail |
| pnpm store, Turbo and Playwright browser caches | Install and rebuild time on re-runs |
| One production build (in E2E), timeouts of 35 minutes (unit and integration, raised from 25 in Phase 9 as the suite grew) and 30 (E2E) | Duplicate builds, runaway jobs |
| Failure-only Playwright report, kept 3 days | Artifact storage |

Phase 11 adds the nightly `restore-verify` job; keep it to one run a day, and consider moving it to weekly if the minutes budget is tight.

## Release artifacts

| Artifact | Built from | Where |
|---|---|---|
| `spine-api` and `spine-web` Docker images (amd64 + arm64) | `docker/Dockerfile.api`, `docker/Dockerfile.web` | Container registry, tagged `X.Y.Z` and `latest` |
| `docker-compose.yml`, `Caddyfile`, `.env.example` | repo root, `docker/` | Release assets |
| `install.sh`, `backup.sh`, `restore.sh` | `scripts/` | Release assets with SHA-256 checksums |
| iOS and Android builds | `apps/mobile` via EAS | App Store / Play Store ([15](15-mobile-release.md)) |
| Release notes | `CHANGELOG.md` | GitHub release |

## Versioning

- Semantic versioning for the whole product (one version for API, web and images). Mobile builds carry the same marketing version; build numbers increase per store upload.
- Database migrations are forward-only; an upgrade from any earlier 1.x release must succeed (NFR-MNT-02).
- The API rejects a mobile client older than the minimum supported version with `426 CLIENT_TOO_OLD` and the app shows "Update Spine to keep going".

## Definition of done (every story)

1. Every acceptance criterion has a passing automated test named after the story id (or a QA-script step where automation isn't possible, e.g. VoiceOver).
2. Lint, typecheck, unit, integration and E2E jobs pass.
3. Any contract change is reflected in [04](04-data-model.md) / [05](05-api.md) in the same change.
4. New capabilities are enforced in the service layer and reflected in the web UI ([07](07-security.md)).
5. New or changed UI uses design-system components and tokens, works in light and dark mode, and component changes ship with their doc page and a11y test (both themes).
6. `docs/qa-script.md` and `CHANGELOG.md` are updated; from Phase 11, the story's user-guide page in `apps/site` is added or updated ([D-113](12-decisions.md)); the story is ticked in [progress.md](../progress.md).

## Appendix — testing expectations moved verbatim from CLAUDE.md

## Testing expectations once code exists (PRD §10.11)

- Unit tests are mandatory for money, tax, and posting-rule modules — this is where silent financial bugs hide.
- Integration tests per document lifecycle (quote, invoice, payment, etc.).
- A ledger-integrity test asserting the trial balance stays balanced after every simulated workflow.
- E2E smoke test covering quote → invoice → payment — **built**, see `apps/e2e/` (Playwright, driving real `apps/api`+`apps/web` instances, no mocks). Now also covers Dashboard v2, Reports, the public quote page, and a broad route-smoke pass across every other page (29 tests total across 5 spec files) — see CHANGELOG's 2026-08-29 entries for the full breakdown. Run locally via `pnpm test:e2e` (or `pnpm test:e2e:ui` for Playwright's UI mode) from the repo root — needs `docker-compose.dev.yml`'s `db`/`maildev` services running, plus a one-time `createdb spine_e2e` (see `.env.e2e`'s own comment); runs automatically in CI as its own job. Extend `apps/e2e/tests/` for future coverage rather than starting a second E2E setup. Use `fixtures.ts`'s worker-scoped `seededOrg` fixture (one `POST /demo-data/seed` per spec file) for any new test needing non-empty data — a per-test-scoped seed was tried first and caused a real, confirmed-live pg-boss queue backlog that intermittently broke unrelated tests; don't reintroduce that pattern. A spec that loads or deletes demo data of its own (US-ONB-17, US-ONB-18) goes in the `demo-data` Playwright project, which runs after the rest: the demo Staff and Field logins follow the latest demo, and every other spec expects them in `seededOrg` (run one such spec alone with `--no-deps`).
- `docs/qa-script.md` is the human-run counterpart to the above — update it alongside a feature's automated tests, not instead of them. See the pointer near the top of this file.
