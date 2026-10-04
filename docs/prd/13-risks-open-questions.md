# 13 · Risks and open questions

## Risks

| ID | Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|---|
| R-01 | Accounting correctness bugs found after real use | Severe: destroys trust | Medium | Ledger-integrity test after every workflow (NFR-REL-02); daily integrity check (US-RPT-12); accountant review of [06](06-ledger-posting-rules.md) before 1.0 (Q-02) |
| R-02 | Scope creep toward a general ERP | Never ships | Medium | Non-goals in [00-overview](00-overview.md) are binding; new ideas go to a v2 backlog |
| R-03 | Self-hosting is too hard for the target user | Nobody adopts it | Medium | Phase 8 install script, 5-minute target (NFR-MNT-01), install test on a clean machine with a non-technical person watching |
| R-04 | Offline sync duplicates or loses data | Field users stop trusting the app | Medium | Idempotency keys on every mutation, append-only offline operations, no offline financial documents ([D-050](12-decisions.md)), NFR-REL-06 test |
| R-05 | Solo maintainer burnout | Abandonment | Medium | Boring architecture, public early releases, contributor docs (US-OPS-19) |
| R-06 | Tax model too generic for any one country's filing | Users still need an accountant to file | High | Accepted: v1 produces the numbers, not the filing; country packs are a v2 extension point |
| R-07 | PDF output differs across environments | Documents look wrong | Low | Pinned renderer and bundled fonts; PDF snapshot tests |
| R-08 | Public quote links live 30 days regardless of the quote's `validUntil` | A customer can accept a quote shown as expired | Medium | Decide whether acceptance is refused after `validUntil` ([D-032](12-decisions.md)); until then the page shows "Expired" but accepts |
| R-09 | Mobile migration to expo-router destabilises the field app | Phase 5 slips | Medium | Migration is its own story (US-MOB-19); `apps/showcase-native` already proves the pattern |
| R-10 | 14 authenticated mutating routes have no idempotency (finding C26, recounted in review) | Duplicate writes on retry | Medium | US-OPS-08 adds the interceptor, per-user key scope and a route-introspection test (NFR-REL-07) |
| R-12 | Field data exposure through the API (jobs, costing, files) before US-JOB-19 / US-OPS-20 ship | A phone or a curious member reads money or other crews' files | Medium | Ship US-JOB-19 before the field app is released; US-OPS-20 before 1.0 |
| R-13 | ~~The default file store image `minio/minio` is no longer pullable from Docker Hub (found 2026-10-04 when CI tried to pull it), so `docker-compose.yml` and `docker-compose.dev.yml` fail on a fresh machine~~ — resolved by [D-102](12-decisions.md): local disk by default, MinIO dropped | New installs and new developers can't start Spine | High | Decide a replacement (Q-14) before Phase 8; CI already uses `adobe/s3mock` for E2E |
| R-14 | Files and the database live on one host, so a dead disk loses both unless a backup left the machine | Data loss for the business | Medium | Off-site encrypted backups (D-105), stale-backup banner, checksum checks (D-104), restore verified in CI (US-OPS-04); cloud S3 for owners who want provider redundancy |
| R-11 | Store review rejects the field app (server-address sign-in, no demo account) | Mobile release delayed | Medium | Provide a hosted demo server and reviewer notes ([15](15-mobile-release.md)) |

## Open questions

| ID | Question | Options | Needed before | Owner |
|---|---|---|---|---|
| Q-01 | Licence | AGPL-3.0 · MIT | Phase 8 (US-OPS-19) | Product owner |
| Q-02 | Is a practising accountant available to review the chart of accounts and posting rules? | Yes, name · No, accept risk R-01 | Phase 8 release | Product owner |
| Q-03 | Does the reference business migrate historical data or start clean from a cutover date? | Opening balances only · Import open invoices and bills · Start clean | Phase 6 | Product owner |
| Q-04 | Is accrual-only accounting acceptable for v1, or is a cash-basis report needed? | Accrual only · Add cash-basis P&L | Phase 6 | Product owner + accountant |
| Q-05 | Should expenses paid personally by an employee credit an "Employee reimbursements payable" account instead of Bank? | Keep Bank · Add the account and a reimburse action | Phase 6 | Accountant |
| Q-06 | ~~Default document number pattern~~ — closed by [D-077](12-decisions.md): keep `QUO-0001`, no yearly reset | — | — | — |
| Q-07 | Should mobile builds be published to the public stores or distributed privately (TestFlight / internal track / APK)? | Public stores · Private distribution | Phase 5 release | Product owner |
| Q-08 | Two-factor authentication in v1? | No (v2) · TOTP for Owners · TOTP for everyone | Phase 6 | Product owner |
| Q-09 | Should tax rates carry a classification (standard, zero-rated, exempt) so the Tax Summary reports them separately? | No, 0% rate is enough · Add classification | Phase 6 | Product owner + accountant |
| Q-10 | ~~Should issued documents snapshot the customer address, logo/branding and payment instructions, or store the rendered PDF at issue?~~ — closed by [D-083](12-decisions.md): store the issue-time PDF | — | — | — |
| Q-11 | ~~What may anonymous visitors see on the invite-only and forgot-password pages (business name, "email may not be set up" hint)?~~ — closed by [D-084](12-decisions.md): business name only, no configuration hints | — | — | — |
| Q-12 | ~~May a member with `expenses.approve` approve their own expense?~~ — closed by [D-085](12-decisions.md): no self-approval for Staff; Owners may | — | — | — |
| Q-13 | ~~With `SEED_DEMO=true`, how does someone sign in to the demo organisation?~~ — closed by [D-086](12-decisions.md): the first sign-up adopts the demo organisation | — | — | — |
| Q-14 | ~~Which S3-compatible store replaces `minio/minio` as the self-hosted default in `docker-compose.yml` and `docker-compose.dev.yml`?~~ — closed by [D-102](12-decisions.md) and [D-103](12-decisions.md): local disk by default, optional pinned RustFS | — | — | — |
| Q-15 | What domain will the website and docs use (`[DOMAIN]`, `docs.[DOMAIN]`)? | Buy a domain · Use `haribrothers.github.io/spine` at launch | Phase 8 (US-SITE-14) | Product owner |

## Design follow-ups

- Screens drawn on the canvas (not yet built) are marked "Drawn" in [screens.md](../design/screens.md); replace each with a capture when its story ships.
- `TextField`'s placeholder colour is not dark-mode aware on native ([native notes](../design/native-notes.md)); fix with `useColorScheme()` when reported or during US-OPS-17.
- The Android Today screen's single floating action ([D-051](12-decisions.md)) needs a usability check with a field user.
