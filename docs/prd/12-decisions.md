# 12 · Decisions

Every non-obvious choice, numbered and permanent. **Accepted** = decided by the owner. **Default** = chosen while writing the spec and not yet challenged; change it by adding a new decision that supersedes it (never edit the old row's meaning). Check here before choosing a library, a pattern or a behaviour that isn't spelled out in a story.

| ID | Decision | Status | Why / notes |
|---|---|---|---|
| D-001 | One instance serves one business (single organisation). No multi-tenant hosting, no multi-org owner accounts in v1 | Accepted | Keeps self-hosting simple; a second business runs a second instance (PRD §1.5, §4.2) |
| D-002 | API is REST + OpenAPI (NestJS), not GraphQL | Accepted | Two known clients; typed SDK for free; no per-field authorisation or N+1 complexity |
| D-003 | The ledger is derived, never authored: business event → domain service → posting rule → balanced journal entry, in one module | Accepted | Accounting is an output. See [06-ledger-posting-rules](06-ledger-posting-rules.md) |
| D-004 | Money is integer minor units (`bigint`) + currency code; rounding once, at line level, half-up; tax per line; quantities and percentages are `numeric` | Accepted | No floats; document totals are sums of rounded lines |
| D-005 | Journal entries are immutable and written in the same transaction as their source document; a DB constraint enforces debits = credits per entry; corrections are reversing entries | Accepted | Either both land or neither does |
| D-006 | Documents snapshot name, price and tax at the time of writing; catalogue changes never alter existing quotes or invoices | Accepted | |
| D-007 | Document numbers are gapless and permanent: allocated inside the issuing transaction with a row lock on `number_sequences`; drafts have no number | Accepted | |
| D-008 | `@spine/ui` is an in-house library on Radix + Tailwind, completed in Phase 0, documented in `apps/design-system` | Accepted | Own theming; later phases consume a finished set |
| D-009 | Every mutating endpoint accepts `Idempotency-Key`; replays return the first response | Accepted | Mobile outbox replays and double-clicks are safe |
| D-010 | Background work runs on pg-boss (Postgres); no Redis | Accepted | Three services instead of four on an office PC |
| D-011 | Job costing and AR aging come from filtering journal lines tagged with `contact_id` / `job_id`; no parallel costing subsystem | Accepted | One source of truth |
| D-012 | Retention posts to a dedicated Retention Receivable account (1150), separate from AR | Accepted | Aging isn't distorted by held retention |
| D-013 | Revising a sent quote creates a new version linked by `parent_quote_id` and supersedes the old one; the old one is never edited | Accepted | History of what was offered is preserved |
| D-014 | Mobile offline is partial: cached reads + an outbox for photos, expenses and milestone completions; no offline creation of quotes or invoices | Accepted | Full bidirectional sync is a multi-month problem |
| D-015 | The app boots with only `DATABASE_URL`, `AUTH_SECRET`, `APP_URL`; email, file storage and push degrade gracefully | Accepted | SMTP down → documents still issue, email queues; storage down → attachments read-only |
| D-016 | Auth is Better Auth: cookie sessions on web; on mobile the session token is sent as `Authorization: Bearer` via the `bearer()` plugin (not a minted JWT) | Accepted | Corrected during Phase 5 build (CHANGELOG 2026-08-30) |
| D-017 | Roles: Owner (one or more; exactly one Primary Owner, enforced by a partial unique index), Staff (subdivided by Teams with a privilege matrix, union of grants), Field (fixed), Customer (public link) | Accepted | See [07-security](07-security.md) |
| D-018 | Writes are split per resource into `edit_own` / `edit_others` / `delete_own` / `delete_others`, checked in the service layer against a stable creator field; workflow actions (send, issue, void, approve…) get their own capabilities; reads are unconditional for Owner and Staff | Accepted | A junior Team can maintain records without touching colleagues' |
| D-019 | Field is never Team-configurable; Field's fixed rights live in `FIELD_OWN_CAPABILITIES` (own records only) and `FIELD_ALWAYS_CAPABILITIES` (both branches, e.g. milestone completion, on-site acceptance) | Accepted | An owner can't accidentally widen a phone user's access to money |
| D-020 | Owner is never granted at invite time; the only path is promoting an existing Staff member | Accepted | |
| D-021 | Onboarding is never a gate: every step is skippable and editable later in Settings; it never includes database or infrastructure setup; step order is fixed (business profile → template → currency/locale → financial year → tax → numbering → chart of accounts → team) | Accepted | |
| D-022 | The mobile app is native-first: expo-router with native tabs and `@expo/ui` (SwiftUI / Jetpack Compose) controls; `apps/mobile` migrates off React Navigation + `FloatingTabBar` | Accepted | Owner confirmed 2026-10-04 |
| D-023 | Profile & Preferences (every user) is separate from organisation Settings (Owner-only dialog), which is separate from Users / Teams / Audit log (Owner-only routed pages) | Accepted | |
| D-024 | Meetings: managing (`meetings.*`) never widens who can read; read access = `visibility` (`private`/`org`) + invite list; Owners see all; recurring edits offer "This event" / "All events" only | Accepted | |
| D-025 | The dashboard is one page whose widget set adapts to role and capabilities; every widget is gated server-side by the same capability as its full report; the KPI row is pinned and not customisable | Accepted | |
| D-026 | Converting a quote more than once is allowed, guarded by the org setting "Repeat quote conversion" (`off` / `warn` / `block`, default `warn`) | Accepted | |
| D-027 | In-app, email and browser-push notifications share one trigger (`NotificationsService.notify`) and target either roles or specific users | Accepted | |
| D-028 | No external calendar sync (Google/Outlook) in v1 | Accepted | Self-hosted, no OAuth dependency |
| D-029 | Lucide is the only icon set; native imports one icon per subpath; native tab bars use SF Symbols / Material Symbols | Accepted | Barrel import tripled bundle size; icon fonts misaligned |
| D-030 | Closing a fiscal period blocks postings dated inside it; no closing journal entry is posted in v1; the Balance Sheet shows a computed "Retained Earnings (current period)" line | Default | Multi-period comparison isn't a v1 need |
| D-031 | Tax Summary's per-rate breakdown reads `invoice_lines` (which carry rate/group) rather than `journal_lines` | Default | The ledger holds one blended tax posting per document |
| D-032 | Public quote links: unguessable token, 30-day lifetime, 20 requests/minute/IP rate limit; accept/reject only while the quote is `sent` | Default | See [R-08](13-risks-open-questions.md) on tying lifetime to `validUntil` |
| D-033 | Every `@spine/ui` component ships with its `apps/design-system` page and an axe-core test in the same change; `check-a11y-coverage.mjs` fails the build otherwise | Accepted | |
| D-034 | `apps/showcase-native` documents `@expo/ui`-backed native components; `apps/design-system-native` documents NativeWind ones | Accepted | Resolves the 15 undocumented native components (finding C24) |
| D-035 | Stories use `US-<CODE>-NN` ids; each carries `Legacy: S-xx.yy` when it came from the original PRD | Accepted | |
| D-036 | Built screens in `docs/design/screens/` are screenshots of the running app with demo data; unbuilt screens are drawn on the design canvas | Accepted | |
| D-037 | The existing design system is reused and exported to `docs/design/`; `docs/DESIGN.md` front matter stays the authored token source; no copied reference bundle — `packages/ui` and `packages/ui-native` are the reference | Accepted | |
| D-038 | The spec lives in the repo (`docs/prd`, `docs/features`, `docs/design`); the original PRD moves to `docs/archive/spine-prd.md`; `CHANGELOG.md` and `docs/qa-script.md` stay | Accepted | |
| D-039 | `CLAUDE.md` is the short rule set (~60 lines); detailed lessons live in `docs/prd/07-security.md`, `docs/prd/09-design-system.md`, `docs/design/native-notes.md` and this file | Accepted | |
| D-040 | `docs/progress.md` ticks a story only when its behaviour is verified in the code or running app | Accepted | |
| D-041 | Phases 0–6 are kept as in the original PRD so CHANGELOG history lines up; Phase 6 is later split into 6–8 ([D-098](12-decisions.md)) | Accepted | |
| D-042 | 18 modules ([README](../README.md)); a 19th, Website and help, added by [D-108](12-decisions.md) | Accepted | |
| D-043 | v1 adds: configurable lead stages, theme presets + brand colours, org-wide audit log, password reset | Accepted | Gaps G1, G3/G4, G6, G7 |
| D-044 | Stories created from gaps and findings land in Phase 6, except mobile/native ones (Phase 5); new product features land in Phase 7 ([D-098](12-decisions.md)) | Accepted | |
| D-045 | Phone-width web layouts are specified for the public quote page and the app shell only | Accepted | Staff web is desktop-first; field crew use the app |
| D-046 | Outgoing emails and PDFs are documented as screens | Accepted | |
| D-047 | Field app tabs: Today, Jobs, Expenses, Profile; sync status is a header pill opening the Sync screen | Accepted | |
| D-048 | The field app shows no money except the user's own expenses and the quote being presented | Accepted | S-11.8 "mobile hides all financial reports" |
| D-049 | Mobile sign-in asks for the server address | Accepted | Self-hosted |
| D-050 | Accepting a quote on site requires connectivity | Accepted | Locks a price; must reach the office once |
| D-051 | Every mobile screen is designed for Android (Material 3) as well as iOS; on Android, Today has one floating "Add photos" action and expenses are logged from the Expenses tab | Accepted | |
| D-052 | Mobile "Forgot password?" opens the server's web reset page | Accepted | One reset flow |
| D-053 | Photos and receipts are compressed on the phone before queueing; the server rejects uploads over 10 MB | Accepted | |
| D-054 | On-site acceptance records the customer's typed name and drawn signature, the field user as witness, and the time | Accepted | |
| D-055 | Update check: once a day the server fetches the latest public release version, sending nothing about the instance; `UPDATE_CHECK=off` disables it; the banner shows to Owners only | Accepted | |
| D-056 | Password reset links are single-use and expire after 1 hour; resend after 60 s; the page never reveals whether an email has an account | Accepted | |
| D-057 | Tax Summary moves from Settings → Tax to a Reports tab, Owner-only like P&L | Accepted | Finding C13 |
| D-058 | Confirmation buttons are primary unless the action deletes, voids or removes; then `danger` | Default | Findings C4, C15 |
| D-059 | Promoting a Staff member to Owner asks for confirmation | Default | Finding C20 |
| D-060 | "Convert to job" / "Convert to invoice" act immediately without a confirmation; the repeat-conversion guard is the safety net | Default | Finding C12 |
| D-061 | Record history opens as a dialog in every module, including Contacts (whose always-visible tab is replaced) | Default | Finding C6 |
| D-062 | Lead stages are per-organisation: up to 12; Won and Lost are fixed, always last, renameable but not deletable; deleting a stage with leads asks where to move them | Default | Gap G1 |
| D-063 | Theme presets: Spine Blue (default), Harbour Teal, Plum, Graphite; one document colour for PDFs and emails; status colours are never themeable | Default | Gaps G3/G4 |
| D-064 | The org-wide audit log is an Owner-only page under Team, filterable by date, person, record type and action, exportable to CSV | Default | Gap G6 |
| D-065 | Trial Balance is a Reports tab, Owner-only like P&L and Balance Sheet | Default | Gap G2 |
| D-066 | Below 768px the web app shows a top bar and a slide-over navigation menu | Default | Finding C19 |
| D-067 | Every outgoing email uses one branded layout (logo, business name, document colour bar, footer) | Default | Findings C2, C9, C22 |
| D-068 | Controls for features that ship in a later phase are hidden behind flags in `packages/shared/src/feature-flags.ts` | Default | Template rule; file created in Phase 6 |
| D-069 | User-facing strings move to `packages/shared/src/i18n/en/*.json` in Phase 8 (i18n extraction, US-OPS-16); until then strings stay in the component | Default | NFR-MNT-03 |
| D-070 | ~~Help content for users lives in `apps/web/src/content/help/` and is opened by the in-app Help button~~ — superseded by [D-109](12-decisions.md) | Superseded | Keeps help out of the spec |
| D-071 | The mobile app sends `X-Spine-Client-Version`; the server answers `426 CLIENT_TOO_OLD` below its minimum and the app shows "Update Spine to keep going"; OTA updates use the `appVersion` runtime policy | Default | Keeps old field apps from writing against a changed API ([15](15-mobile-release.md)) |
| D-072 | Field reads through the API only the jobs they're assigned to, with contract value, retention, milestone amounts and costing removed; job costing requires `reports.view_job_profitability`; file reads are authorised by the owning record | Accepted | Owner, Stage 5 review; enforces D-048 on the server (US-JOB-19, US-OPS-20) |
| D-073 | A field user presents a job's variation-order quotes and its source quote while `sent`, and can record the customer's acceptance (with signature) or decline (with optional comment) through authenticated routes | Accepted | Owner, Stage 5 review |
| D-074 | An invoice with allocated payments can't be voided; the correction is a credit note. No un-allocate action in v1 | Accepted | Owner, Stage 5 review; no new posting paths |
| D-075 | A deposit payment can be allocated to its advance invoice; that portion posts Dr Bank / Cr 2200 Customer Advances (no AR), and tax is charged when the deposit is offset on the final invoice. Today the code refuses this allocation (US-PAY-13) | Accepted | Owner, Stage 5 review; accountant to confirm (Q-02) |
| D-076 | Stories built before story-id-named tests existed keep their tick when their criteria pass today; stories whose criteria fail are unticked or moved; story-id test naming applies to new work | Accepted | Owner, Stage 5 review |
| D-077 | Document numbers keep the `PREFIX-0001` pattern and never reset by year (closes Q-06) | Accepted | Owner, Stage 5 review; matches the code |
| D-078 | Expense categories are managed from Expenses › Categories by anyone with `expense_categories.*` (Owners always); they leave the Owner-only Settings dialog | Accepted | Owner, Stage 5 review (US-PUR-19) |
| D-079 | A job's milestone set is owned by the job's creator for own/others checks, never by whoever last replaced it | Accepted | Owner, Stage 5 review; consistent with D-018 (US-JOB-20) |
| D-080 | A customer payment that has allocations is never deleted (a receipt may have gone to the customer); an allocated vendor payment may be deleted, restoring the bills' balances with a reversing entry | Default | Explains the asymmetry between US-PAY-06 and US-PUR-06 |
| D-081 | On the phone, Today lists an assigned job only if it is active and has a pending milestone overdue or due within 7 days | Default | Makes US-MOB-03 testable |
| D-082 | The setup checklist is for Owners only and ignores demo rows | Default | US-ONB-10, US-ONB-12 |
| D-083 | Issued documents (sent quotes, issued invoices, credit notes, receipts) store their rendered PDF at issue and always serve that file; drafts render live | Accepted | Owner, Stage 6 (Q-10); US-INV-17 |
| D-084 | Anonymous pages (invite-only sign-up, forgot password) may show the business name and nothing about the server's configuration | Accepted | Owner, Stage 6 (Q-11) |
| D-085 | Staff can't approve or reject their own expense even with `expenses.approve`; Owners can | Accepted | Owner, Stage 6 (Q-12); US-PUR-20 |
| D-086 | `SEED_DEMO=true` seeds the demo business without an owner account; the first sign-up becomes its Primary Owner | Accepted | Owner, Stage 6 (Q-13); US-OPS-02 |
| D-087 | The dashboard is redesigned as option A, "action-first": a "Needs your attention" list with one-click actions and a "Today" column at the top, then KPI cards with trend and comparison, money in vs out, pipeline, aging, job profitability and a readable activity feed; Staff and Field get role-specific versions. Option B (numbers-first, period switch) was rejected | Accepted | Owner, 2026-10-04; screens `DashboardOwnerRedesign`, `DashboardStaffRedesign`, `DashboardFieldRedesign`, `DashboardCaughtUp` |
| D-088 | Attention kinds, in order: overdue invoices, expenses waiting for approval, discounts to approve, completed milestones not invoiced, quotes expiring within 7 days, bills due within 3 days; each kind is shown only to people with the capability to act; items disappear when resolved, with no manual dismiss | Default | US-DASH-12, US-DASH-13 |
| D-089 | Money is formatted everywhere by one shared `Intl.NumberFormat` helper using the organisation's currency and locale: currency symbol, thousands separators, two decimals, a true minus sign, tabular figures in the UI font | Default | Review: "12024.75 USD" was hard to read (US-OPS-24) |
| D-090 | A job created from a quote takes the quote's title; without one, the first line's item plus " — <customer>"; repeat conversions add " (2)", " (3)" | Default | US-JOB-23 |
| D-091 | Automatic reminders are off by default; when on, the default schedule is due date, +7 and +14 days at 9:00 AM organisation time; at most one reminder per invoice per day (manual or automatic); contacts can be paused | Default | US-INV-18, US-INV-19 |
| D-092 | Recurring invoices run daily at 6:00 AM organisation time, create at most one invoice per schedule per due date, snapshot prices at run time, and either issue + email or create a draft (chosen per schedule); a missed run catches up once; managed by the new Team-configurable capability `invoices.manage_recurring` | Default | US-INV-20–22 |
| D-093 | The daily digest is on by default for Owners (7:00 AM, Monday–Friday) and off for others; it is skipped on days with nothing to report and never includes money for Field users | Default | US-NTF-13, US-NTF-14 |
| D-094 | Data export is Owner-only, produces a ZIP of CSV (default) and/or JSON per table plus optional files, excludes secrets, and its link expires after 7 days | Default | US-SET-15, US-SET-16 |
| D-095 | Global search uses Postgres trigram indexes (no external service), returns up to 5 results per type, and applies each module's own read rules | Default | US-OPS-22 |
| D-096 | Duplicating a quote copies its lines' snapshot prices; bundles copy their stored lines into a document when added and never change existing documents | Default | US-QUO-24–26 |
| D-097 | Bulk actions (reminders, PDFs, expense approval) accept at most 100 records, act on the eligible ones, and report every skipped record with a reason | Default | US-INV-23, US-INV-24, US-PUR-21 |
| D-098 | The former Phase 6 is split into three: Phase 6 Fix and harden (findings, security, correctness, password reset), Phase 7 Product upgrades (dashboard redesign and the new features), Phase 8 Packaging and 1.0 (install, backup, upgrades, phone layout, i18n, accessibility audit, security review, release) | Accepted | Owner, 2026-10-04; release gates stay last |
| D-099 | Text on filled controls (primary and danger buttons, filled chips, avatars, badges) uses new `on-primary` / `on-danger` tokens: white in light mode, `#121110` in dark mode | Default | White on dark-mode primary `#6B8AFF` is 3.1:1, below WCAG AA (US-OPS-25) |
| D-100 | Every screen supports light and dark mode through tokens; drawn designs show light for every screen plus dark versions of representative screens; PDFs and customer emails are always light | Accepted | Owner, 2026-10-04 (US-OPS-26, US-MOB-19/20) |
| D-101 | Branch per phase (`phase-<n>-<name>`), one PR per phase into a protected `main`; CI runs only on PRs into `main` (and manual dispatch), with draft PRs and docs-only changes skipped, superseded runs cancelled, E2E gated on unit tests, and caches for pnpm, Turbo and Playwright | Accepted | Owner, 2026-10-04; private repo with an Actions-minutes budget |
| D-102 | Files are stored by a built-in `local` driver by default — a Docker volume (`spine_files`) on the API container, atomic writes, always served through the API's permission check; an `s3` driver remains for AWS S3, R2, B2 or a self-hosted S3 store (`STORAGE_DRIVER=local\|s3`). MinIO is dropped | Accepted | Owner, 2026-10-04; `minio/minio` free images withdrawn; closes Q-14 and R-13 |
| D-103 | The optional self-hosted S3 store in Compose is RustFS, pinned to a 1.0.x tag with a container memory limit; revisit the pin once its single-disk issues (#8121, #8015, #8271) are closed | Accepted | Owner, 2026-10-04 |
| D-104 | File safety: SHA-256 per file verified on read and weekly; issued files write-once; uploads type-checked from their bytes (JPEG, PNG, WebP, HEIC, PDF); photo GPS stripped; `nosniff` on every file response; paths built from ids only | Default | US-OPS-28, US-OPS-29 |
| D-105 | Backups: one archive (database + files), optionally encrypted with a passphrase and optionally uploaded off-site (S3/R2/B2) with 7 daily and 4 weekly copies; Owners see a banner when the last backup is more than 2 days old | Accepted | Owner, 2026-10-04 (US-OPS-03) |
| D-106 | Per-file encryption at rest is optional (`FILES_ENCRYPTION_KEY`) and off by default; the install guide recommends full-disk encryption on the host | Accepted | Owner, 2026-10-04; losing an app key would lose every file |
| D-107 | The file-storage stories ship in Phase 6 because fresh installs and dev setups can't pull MinIO today; the backup additions stay with US-OPS-03 in Phase 8 | Accepted | Owner, 2026-10-04 |
| D-108 | A website built with Astro + Starlight (`apps/site`) holds the home page, user guide, self-hosting guide, developer docs and generated API reference; English only for 1.0 with Starlight's i18n structure in place | Accepted | Owner, 2026-10-04 |
| D-109 | The site is the single source of user help (replaces D-070); the spec in `docs/` stays separate and is not published as-is | Accepted | Owner, 2026-10-04 |
| D-110 | Every install bundles the user guide and self-hosting guide for its version at `/help`, so the Help menu works offline; a link offers the public site | Accepted | Owner, 2026-10-04 |
| D-111 | Docs are versioned per minor release from 1.0 (`starlight-versions`) | Accepted | Owner, 2026-10-04 |
| D-112 | The site is public, hosted on GitHub Pages from the private repo, at `docs.[DOMAIN]` until Q-15 is answered; published by a workflow after merges that change it | Accepted | Owner, 2026-10-04 |
| D-113 | The site skeleton, home page, self-hosting guide, developer docs and in-app help ship in Phase 8; guide pages for features built in Phases 0–7 are written then, and from Phase 8 every user-facing story updates its guide page in the same change | Accepted | Owner, 2026-10-04 |
| D-114 | US-JOB-19 (Field reads only assigned jobs, no money) moves from Phase 5 to Phase 6, so every server-side access gap closes together with US-OPS-20 | Accepted | Owner, 2026-10-04 |
