# 08 · Non-functional requirements

Each requirement is measurable and names the phase by which it must hold. "Verified by" says how CI or the QA script proves it.

## Performance

| ID | Requirement | Phase | Verified by |
|---|---|---|---|
| NFR-PERF-01 | List endpoints respond in < 300 ms (p95) with 10,000 records in the table, on a 4-core / 8 GB host | 8 | Load test against seeded 10k dataset |
| NFR-PERF-02 | A PDF (quote, invoice, receipt) renders in < 3 s | 2 | Integration test timing |
| NFR-PERF-03 | P&L, Balance Sheet and Trial Balance over 12 months at 50,000 journal lines return in < 2 s | 8 | Load test |
| NFR-PERF-04 | Mobile app cold start to Today with cached data < 3 s on a mid-range phone (2022 or newer) | 5 | Manual timing in QA script |
| NFR-PERF-06 | Global search returns in < 500 ms (p95) at target scale | 7 | Load test (US-OPS-22) |
| NFR-PERF-05 | Web dashboard first contentful paint < 2.5 s on a broadband connection | 8 | Lighthouse in CI |

## Reliability and data integrity

| ID | Requirement | Phase | Verified by |
|---|---|---|---|
| NFR-REL-01 | Financial writes are wrapped in one database transaction with their journal entry; no partial writes | 0 | Integration tests |
| NFR-REL-02 | The trial balance balances after every simulated workflow | 0 | `ledger-integrity` integration test |
| NFR-REL-03 | A backup restores into a clean install with identical trial balance and file count | 8 | CI restore-verify job (US-OPS-04) |
| NFR-REL-04 | If SMTP is down, documents still issue and email retries with back-off until sent or failed after 24 h | 1 | Integration test with SMTP stopped |
| NFR-REL-05 | If object storage is down, the app keeps working; attachment upload/download shows an error | 1 | Manual QA |
| NFR-REL-06 | Mobile outbox replays produce zero duplicates in a 100-item airplane-mode test | 5 | E2E on simulator |
| NFR-REL-07 | Every mutating endpoint is idempotent with `Idempotency-Key` | 6 | Route-introspection test (US-OPS-08) |

## Compatibility

| ID | Requirement | Phase | Verified by |
|---|---|---|---|
| NFR-COMP-01 | Web works in the current and previous major versions of Chrome, Edge, Firefox and Safari | 8 | Playwright projects |
| NFR-COMP-02 | Every web route is usable at 390×844 with no horizontal page scroll; public quote page and app shell are designed for it | 8 | Playwright at phone viewport |
| NFR-COMP-03 | Mobile app supports iOS 17+ and Android 10+ (API 29+) | 5 | Store build settings |
| NFR-COMP-04 | Self-hosting runs on any 64-bit Linux, macOS or Windows host with Docker 24+ and Compose v2 | 8 | Install test on clean VMs |
| NFR-COMP-05 | The app boots with only `DATABASE_URL`, `AUTH_SECRET`, `APP_URL` set | 0 | CI boot test |

## Accessibility

| ID | Requirement | Phase | Verified by |
|---|---|---|---|
| NFR-A11Y-01 | WCAG 2.1 AA for every `@spine/ui` component, in light and dark mode | 0 | axe-core tests + coverage script |
| NFR-A11Y-02 | Every web route passes axe-core AA with demo data | 8 | Playwright + axe (US-OPS-17) |
| NFR-A11Y-03 | Text contrast ≥ 4.5:1 (3:1 at 24px+); status never conveyed by colour alone | 0 | Token contrast check |
| NFR-A11Y-04 | All functionality is keyboard-operable with a visible focus ring | 0 | Keyboard walkthrough in QA script |
| NFR-A11Y-05 | Touch targets ≥ 44×44 on mobile and on the web phone layout | 5 | Snapshot measurement |
| NFR-A11Y-07 | Every web route and every native screen passes contrast checks in dark mode as well as light | 8 | axe in both themes (US-OPS-25, US-OPS-26) |
| NFR-A11Y-06 | Reduced-motion preferences are honoured on web and native | 8 | US-OPS-09 tests |

## Security

| ID | Requirement | Phase | Verified by |
|---|---|---|---|
| NFR-SEC-01 | Passwords hashed with Argon2id | 0 | Unit test |
| NFR-SEC-02 | Every endpoint checks role/capability server-side; Field can't reach financial endpoints | 0 | Capability integration tests |
| NFR-SEC-03 | Public quote and invitation routes are rate-limited (20/min/IP) and tokens are ≥ 128 bits random | 1 | Integration test |
| NFR-SEC-04 | `pnpm audit --prod` has no high or critical findings at release | 8 | CI step |
| NFR-SEC-05 | OWASP Top 10 review documented before 1.0 | 8 | `docs/security-review.md` (US-OPS-18) |
| NFR-SEC-06 | No secret is committed; files are served only through authorised API proxies | 0 | Secret scan in CI; integration test |

## Observability

| ID | Requirement | Phase | Verified by |
|---|---|---|---|
| NFR-OBS-01 | JSON logs with request id, method, path, status, duration; no secrets in logs | 8 | Log snapshot test (US-OPS-07) |
| NFR-OBS-02 | `/health` (liveness) and `/health/ready` (database + queue) | 8 | Integration test (US-OPS-05) |
| NFR-OBS-03 | Telemetry is off by default; the only outbound call is the optional daily update check | 8 | Code review + network test |
| NFR-OBS-04 | A daily ledger-integrity check warns Owners if the books stop balancing | 6 | US-RPT-12 test |

## Maintainability

| ID | Requirement | Phase | Verified by |
|---|---|---|---|
| NFR-MNT-01 | Clone → first issued invoice in < 5 minutes on a machine with Docker, using only the README | 8 | Timed install test |
| NFR-MNT-02 | Migrations are forward-only, idempotent and run automatically on boot after a pre-migration snapshot | 8 | Upgrade test from previous release |
| NFR-MNT-03 | User-facing strings live in `packages/shared/src/i18n/en/*.json` | 8 | Lint rule (US-OPS-16) |
| NFR-MNT-04 | Money, tax and posting-rule modules have unit tests; every document lifecycle has integration tests | 0 | Coverage report |
| NFR-MNT-05 | Every `@spine/ui` and `@spine/ui-native` component has a doc page/screen | 5 | Coverage scripts |

## Scale assumptions

Up to 20 users, 10,000 contacts and 50,000 documents a year per instance. Beyond that is out of scope by design (single-host, single-organisation).
