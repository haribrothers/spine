# 18 · Self-hosting & system states

What it takes for a stranger to run Spine for years: one-command install, backups that restore, upgrades that migrate safely, health checks and an update banner — plus the cross-cutting pieces every screen relies on: error and no-access pages, the phone-width web layout, and release readiness (strings, accessibility, security, licence). Most of this module is Phase 8 (packaging and 1.0); the cross-cutting fixes are Phase 6 and global search is Phase 7.

**Screens:** `UpgradeNotice` (P3), `NotFound` (P2), `NoAccess` (P2), `ServerError` (P2), `AppShellPhone` (P1), `AppShellPhoneNav` (P1), `MeetingScopeChoice` (P2), `ExpenseBillToCustomer` (P2), `SearchPalette` (P1), `DashboardOwnerRedesignDark` (P1), `InvoicesBulkSelectDark` (P1), `SettingsRemindersDark` (P1), `SearchPaletteDark` (P1)
**Depends on:** every module; [11-testing-release](../prd/11-testing-release.md); [08-non-functional](../prd/08-non-functional.md).

## Features

| ID | Feature | Priority | Phase | Screens |
|---|---|---|---|---|
| F-OPS-01 | Install and demo | P1 | 8 | — |
| F-OPS-02 | Backup, restore and upgrade | P1 | 8 | — |
| F-OPS-03 | Health, logs and update notice | P2 | 8 | `UpgradeNotice` |
| F-OPS-04 | Cross-cutting correctness and consistency | P1 | 6 | `MeetingScopeChoice`, `ExpenseBillToCustomer` |
| F-OPS-05 | System pages | P2 | 6 | `NotFound`, `NoAccess`, `ServerError` |
| F-OPS-06 | Web app at phone width | P1 | 8 | `AppShellPhone`, `AppShellPhoneNav` |
| F-OPS-07 | Release readiness | P1 | 8 | — |
| F-OPS-08 | Global search | P1 | 7 | `SearchPalette` |
| F-OPS-09 | File storage | P1 | 6 | `UpgradeNotice` |

## User stories

### US-OPS-01 · Install Spine with one command
**Feature:** F-OPS-01 · **Priority:** P1 · **Phase:** 8 · **Screens:** —
**As** a self-hoster, **I want** a single command that installs and starts Spine, **so that** I don't need help.

Legacy: S-10.7

**Acceptance criteria**
- **Given** a clean machine with Docker, **when** I run `./scripts/install.sh`, **then** it checks Docker and Compose versions, creates `.env` from `.env.example`, generates a random `AUTH_SECRET` of at least 32 bytes, asks for `APP_URL` (default `http://localhost`), and starts the `minimal` profile.
- **Given** the install finishes, **when** it prints its summary, **then** it shows "Spine is running at <APP_URL> — open it to create the first account." and the commands for logs, backup and upgrade.
- **Given** `.env` already exists, **when** I run the script again, **then** it doesn't overwrite it and just starts the services.
- **Given** a stopwatch from `git clone` to the first issued invoice on a machine with Docker, **when** a new user follows only the README, **then** it takes under 5 minutes (NFR-MNT-01).
- **Given** a missing prerequisite, **when** the script runs, **then** it exits non-zero with a message naming what to install.

**Implementation notes**
- New `scripts/install.sh` (POSIX shell, shellcheck-clean); Compose profiles `minimal` / `full`; storage defaults to the local disk driver with no extra container (US-OPS-27). The README warns that `docker compose down -v` deletes the files and database volumes, and recommends full-disk encryption on the host (D-106).

### US-OPS-02 · Start with demo data from an environment flag
**Feature:** F-OPS-01 · **Priority:** P2 · **Phase:** 8 · **Screens:** —
**As** an evaluator, **I want** `SEED_DEMO=true` to load the demo business on first start, **so that** I see Spine working without clicking through setup.

Legacy: S-10.10

**Acceptance criteria**
- **Given** `SEED_DEMO=true` and an empty database, **when** the API starts, **then** it loads the same demo business as "Just show me around (use defaults)" with no owner account and logs "Demo data loaded — the first person to sign up becomes its owner.".
- **Given** a demo-seeded instance with no users, **when** the first person signs up, **then** they become Primary Owner of the demo organisation and land on the dashboard with onboarding marked skipped ([D-086](../prd/12-decisions.md)).
- **Given** `SEED_DEMO=true` and existing data, **when** the API starts, **then** it does nothing and logs that demo seeding was skipped.
- **Given** `SEED_DEMO` unset, **when** the API starts, **then** no demo data is created.

**Implementation notes**
- Today `SEED_DEMO` is in `.env.example` but not read by any code.

### US-OPS-03 · Back up everything into one file
**Feature:** F-OPS-02 · **Priority:** P1 · **Phase:** 8 · **Screens:** —
**As** a self-hoster, **I want** one command that produces a single restorable archive, **so that** my data is safe.

Legacy: S-10.8

**Acceptance criteria**
- **Given** a running install, **when** I run `./scripts/backup.sh`, **then** it writes `spine-backup-<YYYYMMDD-HHMMSS>.tar.gz` containing a `pg_dump` of the database, the files volume (or, with `STORAGE_DRIVER=s3`, a copy of the bucket) and a manifest with the Spine version and file checksums.
- **Given** the backup completes, **when** it exits, **then** it prints the archive path and size and exits 0; on any failure it exits non-zero and removes the partial file.
- **Given** the docs, **when** I read "Backups", **then** they include a cron example for a nightly backup and how to copy it off the machine.
- **Given** `--passphrase` (or `BACKUP_PASSPHRASE`), **when** the backup runs, **then** the archive is encrypted (AES-256) and restore asks for the passphrase.
- **Given** `BACKUP_REMOTE` is set to an S3/R2/B2 target, **when** the backup succeeds, **then** the encrypted archive is uploaded and remote copies are pruned to 7 daily and 4 weekly (D-105).
- **Given** the last successful backup is more than 2 days old, **when** an Owner opens any page, **then** a banner reads "Your last backup was <n> days ago. Run a backup to keep your data safe.".

**Implementation notes**
- New `scripts/backup.sh`; uploads via the S3 API (no extra tool); last-success time written to `settings.last_backup_at` (04 "Columns added").

### US-OPS-04 · Restore a backup into a clean install
**Feature:** F-OPS-02 · **Priority:** P1 · **Phase:** 8 · **Screens:** —
**As** a self-hoster, **I want** to restore a backup onto a fresh machine, **so that** I can recover from a dead server.

**Acceptance criteria**
- **Given** a clean install and a backup archive, **when** I run `./scripts/restore.sh <archive>`, **then** the database and files are restored and Spine starts with the same data.
- **Given** the archive is from a newer Spine version, **when** I restore, **then** it refuses with a message to upgrade first.
- **Given** the nightly CI run (and every release tag), **when** the restore job runs, **then** it backs up a seeded instance, restores into a clean one and checks the trial balance, file count and every file checksum match (NFR-REL-03).

**Implementation notes**
- New `scripts/restore.sh`; CI job "restore-verify".

### US-OPS-05 · Report health and readiness
**Feature:** F-OPS-03 · **Priority:** P2 · **Phase:** 8 · **Screens:** —
**As** a self-hoster, **I want** health and readiness endpoints, **so that** Docker and monitors know when Spine is really up.

**Acceptance criteria**
- **Given** the API process is running, **when** I call `GET /health`, **then** it returns 200 `{ "status": "ok" }`.
- **Given** the database and job queue are reachable, **when** I call `GET /health/ready`, **then** it returns 200; if either isn't, it returns 503 naming which.
- **Given** Docker Compose, **when** services start, **then** `web` waits for `api` readiness through a healthcheck.

**Implementation notes**
- API: `GET /health/ready` (contract addition).

### US-OPS-06 · Tell owners a new version is available
**Feature:** F-OPS-03 · **Priority:** P3 · **Phase:** 8 · **Screens:** `UpgradeNotice`
**As** an owner, **I want** to know when an update exists, **so that** I stay current.

Legacy: PRD F10 · Decision: D-055

**Acceptance criteria**
- **Given** a newer release exists, **when** an Owner opens the app, **then** a banner reads "Spine <new version> is available. You're on <current version>. Updating runs database migrations automatically and takes a backup first." with "What's new", "How to update" and a close button.
- **Given** I close the banner, **when** I reload, **then** it stays hidden until the next version.
- **Given** a Staff or Field user, **when** they open the app, **then** they never see it.
- **Given** `UPDATE_CHECK=off`, **when** the server runs, **then** it makes no outbound request and the banner never shows.
- **Given** the daily check, **when** it runs, **then** it sends no information about the instance.

**Implementation notes**
- API: `GET /org/update-status` (contract addition); `settings.update_check`.

### US-OPS-07 · Log every request with an id
**Feature:** F-OPS-03 · **Priority:** P2 · **Phase:** 8 · **Screens:** —
**As** a self-hoster, **I want** structured logs with a request id, **so that** I can trace an error a user reports.

**Acceptance criteria**
- **Given** any API request, **when** it's logged, **then** the line is JSON with timestamp, level, request id, method, path, status and duration.
- **Given** a 500 error, **when** the user sees the error page, **then** it shows the same request id (US-OPS-13).
- **Given** logs, **when** written, **then** they never contain passwords, tokens or full card/bank numbers.

**Implementation notes**
- Request-id middleware; `X-Request-Id` response header.

### US-OPS-08 · Make every mutating request safe to repeat
**Feature:** F-OPS-04 · **Priority:** P1 · **Phase:** 6 · **Screens:** —
**As** a developer, **I want** every non-GET route to accept an idempotency key, **so that** retries and double-clicks never repeat an action.

Finding: C26 · Decision: D-009

**Acceptance criteria**
- **Given** any of the 14 routes without the interceptor today (`POST /org/fiscal-periods`, `POST /org/fiscal-periods/:id/close`, `POST /org/fiscal-periods/:id/reopen`, `PUT /users/me`, `PUT /users/me/password`, `PUT /users/me/preferences`, `PUT /users/me/dashboard-layout`, `PUT /users/me/meeting-reminder-lead-minutes`, `DELETE /org/teams/:id`, `PUT /jobs/:id`, `DELETE /jobs/:id/assignees/:userId`, `PUT /jobs/:id/milestones`, `POST /jobs/:id/notes`, `DELETE /notifications/push/subscribe`), **when** called twice with the same `Idempotency-Key`, **then** the second call returns the first response without repeating it.
- **Given** the test suite, **when** it runs, **then** a test fails if any non-GET controller route lacks the idempotency interceptor (public quote routes excepted and listed).
- **Given** a mutating call without the header, **when** it's sent, **then** it's rejected with 400.
- **Given** two users send the same key to the same endpoint, **when** both run, **then** both execute (keys are scoped per user).

**Implementation notes**
- Add `@UseInterceptors(IdempotencyInterceptor)`; route-introspection test.
- Data: `idempotency_keys` gains `user_id`; keys are unique per org + user + endpoint + key (04 invariant I12), so two devices can't collide.

### US-OPS-09 · Respect reduced-motion settings everywhere
**Feature:** F-OPS-04 · **Priority:** P2 · **Phase:** 8 · **Screens:** —
**As** a member sensitive to motion, **I want** Spine to stop animating when I ask my device for less motion, **so that** it's comfortable to use.

Finding: C25

**Acceptance criteria**
- **Given** `prefers-reduced-motion: reduce` in the browser, **when** dialogs, drawers, toasts and popovers open, **then** they appear without animated movement.
- **Given** Reduce Motion on iOS or Remove animations on Android, **when** the tab selection or gauge changes, **then** it updates instantly without a spring.
- **Given** reduced motion, **when** a state changes, **then** the final state is still clearly visible.

**Implementation notes**
- Collapse `--duration-*` in the Tailwind preset under the media query; check `AccessibilityInfo.isReduceMotionEnabled` in native springs ([motion.md](../design/motion.md)).

### US-OPS-10 · Style confirmations by what they do
**Feature:** F-OPS-04 · **Priority:** P2 · **Phase:** 6 · **Screens:** `MeetingScopeChoice`, `ExpenseBillToCustomer`
**As** a member, **I want** red buttons only for actions that delete or void, **so that** colour tells me when something is destructive.

Findings: C4, C15 · Decision: D-058

**Acceptance criteria**
- **Given** "Edit recurring event", **when** it renders, **then** "All events" is a primary blue button.
- **Given** "Bill this expense to the customer?", **when** it renders, **then** "Create invoice" is primary blue.
- **Given** a delete, void, deactivate or remove confirmation, **when** it renders, **then** its confirm button uses the danger style.
- **Given** `AlertDialogAction`, **when** used without a variant, **then** it defaults to primary.

**Implementation notes**
- `@spine/ui` `AlertDialog` default variant; audit every `AlertDialogAction`.

### US-OPS-11 · Show a helpful page for a missing page
**Feature:** F-OPS-05 · **Priority:** P2 · **Phase:** 8 · **Screens:** `NotFound`
**As** a member, **I want** a clear page when a link is wrong, **so that** I can get back to work.

Finding: G8

**Acceptance criteria**
- **Given** an unknown URL or a record that doesn't exist in my organisation, **when** I open it, **then** I see "404", "We can't find that page" and "The link may be wrong, or the record may have been deleted. Financial documents are never deleted — if you followed a link to an invoice, check its number in Invoices." inside the app shell.
- **Given** that page, **when** I press "Go to dashboard" or "Go back", **then** I'm taken there.
- **Given** I'm signed out, **when** I open an unknown URL, **then** I'm sent to the login page first.

**Implementation notes**
- Next.js `not-found.tsx` under `(app)`.

### US-OPS-12 · Explain why I can't open a page
**Feature:** F-OPS-05 · **Priority:** P2 · **Phase:** 6 · **Screens:** `NoAccess`
**As** a staff member, **I want** a clear page when I'm not allowed to see something, **so that** I know who to ask.

Finding: G8

**Acceptance criteria**
- **Given** I open a page my role or Team doesn't allow (e.g. Profit & Loss), **when** it loads, **then** I see "You don't have access to <page name>" and "Your account can't open this page. If you need it for your work, ask an owner — <owner names> — to change your team's permissions." with "Go to dashboard".
- **Given** that page, **when** it renders, **then** no data from the restricted page is loaded or shown.
- **Given** a 403 from the API during an action, **when** it returns, **then** a toast explains I don't have permission rather than a raw error.
- **Given** a page only Owners can ever open (P&L, Balance Sheet, Trial Balance, Tax Summary, Team, Audit log), **when** a Staff member opens it, **then** the text reads "<page name> is only available to owners." with no suggestion to change Team permissions.

**Implementation notes**
- Shared `NoAccess` component used by route guards and `apiClient`.

### US-OPS-13 · Recover from an unexpected error
**Feature:** F-OPS-05 · **Priority:** P2 · **Phase:** 8 · **Screens:** `ServerError`
**As** a member, **I want** a calm error page with a reference, **so that** I know my saved work is safe and how to report it.

Finding: G8

**Acceptance criteria**
- **Given** an unexpected error while loading a page, **when** it happens, **then** I see "Something went wrong on our side", "Spine couldn't finish loading this page. Nothing you entered was lost — anything you saved is still saved. Try again in a minute; if it keeps happening, send the error reference below to the person who runs your Spine server." and "Error reference: <request id>".
- **Given** "Try again", **when** I press it, **then** the page reloads.
- **Given** "Go to dashboard", **when** I press it, **then** I'm taken there.

**Implementation notes**
- Next.js `error.tsx`; request id from US-OPS-07.

### US-OPS-14 · Use the web app on a phone
**Feature:** F-OPS-06 · **Priority:** P1 · **Phase:** 8 · **Screens:** `AppShellPhone`, `AppShellPhoneNav`
**As** an owner checking something between jobs, **I want** the web app to work on my phone's browser, **so that** I can see if an invoice got paid.

Finding: C19 · Decision: D-066

**Acceptance criteria**
- **Given** a viewport under 768px, **when** any app page loads, **then** a top bar shows a menu button, the logo, notifications and my avatar, and the sidebar is hidden.
- **Given** I tap the menu button, **when** it opens, **then** the full navigation slides in from the left over a dimmed page, with a close button; tapping the dimmed area or a link closes it.
- **Given** the dashboard at 390px, **when** it renders, **then** key figures show two per row and charts one per row, with no horizontal page scroll.
- **Given** every interactive control at this width, **when** measured, **then** it's at least 44×44px.

**Implementation notes**
- `@spine/ui` `AppShell` responsive mode.

### US-OPS-15 · Keep wide tables usable on small screens
**Feature:** F-OPS-06 · **Priority:** P2 · **Phase:** 8 · **Screens:** `AppShellPhone`
**As** a member on a phone or small tablet, **I want** tables to scroll inside their own box, **so that** the page doesn't break.

**Acceptance criteria**
- **Given** any data table wider than the screen, **when** it renders under 768px, **then** it scrolls horizontally inside its card and the page itself doesn't scroll sideways.
- **Given** a dialog or drawer under 768px, **when** it opens, **then** it fills the screen width with a 16px gutter.
- **Given** a form under 768px, **when** it renders, **then** fields stack in one column.

**Implementation notes**
- Playwright checks at 390×844 for every route (NFR-COMP-02).

### US-OPS-16 · Move every user-facing string into translation files
**Feature:** F-OPS-07 · **Priority:** P2 · **Phase:** 8 · **Screens:** —
**As** a self-hoster in another country, **I want** strings externalised, **so that** a translation can be added without changing code.

PRD §10.8 · Decision: D-069

**Acceptance criteria**
- **Given** the web and mobile apps, **when** this story is done, **then** every user-facing string comes from `packages/shared/src/i18n/en/*.json`.
- **Given** a lint rule, **when** a component contains a hard-coded user-facing string, **then** CI fails.
- **Given** dates, numbers and money, **when** they render, **then** they use the organisation's locale.

**Implementation notes**
- English only ships in v1.

### US-OPS-17 · Pass an accessibility audit of every screen
**Feature:** F-OPS-07 · **Priority:** P1 · **Phase:** 8 · **Screens:** —
**As** a member who uses a keyboard or screen reader, **I want** every screen to meet WCAG 2.1 AA, **so that** I can use Spine fully.

PRD §10.8

**Acceptance criteria**
- **Given** each web route with demo data, **when** axe-core runs in Playwright, **then** it reports no AA violations.
- **Given** a keyboard-only walkthrough of quote → invoice → payment, **when** performed, **then** every step is reachable with a visible focus ring.
- **Given** VoiceOver (iOS) and TalkBack (Android), **when** the field app's main flows are used, **then** every control is announced with a label and role.

**Implementation notes**
- Extends `apps/e2e`; results recorded in `docs/qa-script.md`.

### US-OPS-18 · Complete a security review before 1.0
**Feature:** F-OPS-07 · **Priority:** P1 · **Phase:** 8 · **Screens:** —
**As** an owner trusting Spine with my books, **I want** a documented security review, **so that** obvious holes are closed before release.

PRD §10.3

**Acceptance criteria**
- **Given** the OWASP Top 10, **when** the review is done, **then** each item has a written finding and fix or acceptance in `docs/security-review.md`.
- **Given** CI, **when** it runs, **then** `pnpm audit --prod` fails the build on high or critical issues.
- **Given** the public quote and invitation routes, **when** tested, **then** tokens can't be enumerated and rate limits hold.

**Implementation notes**
- NFR-SEC-04, NFR-SEC-05.

### US-OPS-19 · Ship the README, licence and contributor guide
**Feature:** F-OPS-07 · **Priority:** P1 · **Phase:** 8 · **Screens:** —
**As** a stranger finding the repository, **I want** a README with screenshots, a licence and contribution rules, **so that** I can decide to use or help with Spine.

PRD §10.9

**Acceptance criteria**
- **Given** the repository root, **when** I open it, **then** I find `README.md` (what it is, screenshots, install in 5 minutes, backup, upgrade), `LICENSE` (as decided in Q-01), `CONTRIBUTING.md`, a code of conduct and issue templates.
- **Given** the release process, **when** I read `docs/release.md`, **then** it lists versioning, changelog and image publishing steps.
- **Given** a new user follows only the README on a clean machine, **when** they finish, **then** they issue their first invoice (Phase 8 exit criterion).

**Implementation notes**
- Licence is blocked on Q-01.

### US-OPS-20 · Close the read-access gaps found in review
**Feature:** F-OPS-04 · **Priority:** P1 · **Phase:** 6 · **Screens:** —
**As** an owner, **I want** every read route to follow the access rules in 07-security, **so that** data isn't exposed just because a page hides it.

Review findings: Stage 5 #9, #23, #29, #64 · Decision: D-072

**Acceptance criteria**
- **Given** a Staff or Field user, **when** they call `GET /org/invitations`, **then** the API returns 403.
- **Given** a Staff or Field user, **when** they call `POST /demo-data/seed` or `DELETE /demo-data`, **then** the API returns 403.
- **Given** a file attached to a record (receipt, photo, signature, logo, PDF), **when** a member requests `GET /files/:id`, **then** it's served only if they can read the owning record; otherwise 404.
- **Given** an allowed file request, **when** it's served, **then** the `local` driver streams it through the API, and the `s3` driver redirects to a signed URL that expires within 5 minutes — either way only after the record check (D-102).
- **Given** a Staff user without `reports.view_receivables`, **when** they call `GET /reports/invoices-due-this-week`, **then** the API returns 403 and the dashboard widget is left out.
- **Given** the integration suite, **when** it runs, **then** each of the above has a test that fails if the guard is removed.

**Implementation notes**
- API: `@OrgRoles(["owner"])` on `GET /org/invitations`, `POST /demo-data/seed`, `DELETE /demo-data`; `FilesService.get` resolves the owning record via `files.owner_type`/`owner_id` (04 "Columns added") and reuses that module's read check; `@RequireCapability("reports.view_receivables")` on invoices-due.
- 07-security "Files" row is updated to allow short signed URLs after authorisation.

### US-OPS-21 · Remove developer wording from the interface
**Feature:** F-OPS-04 · **Priority:** P3 · **Phase:** 6 · **Screens:** `QuoteBuilder`, `InvoiceBuilder`, `TeamPrivilegesExpanded`, `OnbInviteTeam`, `SettingsBusiness`, `QuoteDetailAccepted`, `InvoicesList`, `OnbFinancialYear`, `SettingsFiscalYear`
**As** a member, **I want** labels and helper text in plain language, **so that** the app doesn't read like a spec.

Review findings: Stage 5 #43, #46, #48, #49, #52

**Acceptance criteria**
- **Given** any helper text, **when** it renders, **then** it contains no legacy story ids such as "(S-03.11)", "(S-05.9)" or "(S-06.4)" — e.g. "Quote shows as expired after this date." and "Drives the overdue flag once issued.".
- **Given** a Team's privilege matrix, **when** a group is expanded, **then** each capability has a plain description with no capability keys ("edit_own"), phase numbers or "(mobile)" notes.
- **Given** an accepted quote, **when** its actions render, **then** the button reads "Convert to invoice" (sentence case).
- **Given** the onboarding Team step, **when** it renders, **then** the skip hint reads "You can invite people later from Team › Users.".
- **Given** Settings › Business profile, **when** it renders inside Settings, **then** no helper mentions "the next step".
- **Given** a void invoice in the Invoices list, **when** it renders, **then** its balance column shows "—", not the original total.
- **Given** the Financial year step in onboarding and Settings › Financial year, **when** they render, **then** no helper text mentions number sequences resetting (document numbers never reset, D-077).
- **Given** the test suite, **when** it runs, **then** a lint test fails if any string under `apps/web/src` matches `\(S-\d{2}\.\d+\)`.

**Implementation notes**
- Capability descriptions live in `CAPABILITY_LABELS` (`packages/shared/src/schemas/permissions.ts`).
- Stories quoting the old helper text (US-QUO-01, US-INV-01) are updated when this ships.

### US-OPS-22 · Search everything from anywhere
**Feature:** F-OPS-08 · **Priority:** P1 · **Phase:** 7 · **Screens:** `SearchPalette`
**As** any member, **I want** one search box for contacts, quotes, invoices, jobs, bills and expenses, **so that** I can jump to a record without knowing which page it's on.

Decision: D-095

**Acceptance criteria**
- **Given** any page, **when** I press Cmd+K (Mac) or Ctrl+K, or click the search button in the top bar, **then** the search palette opens with focus in the field.
- **Given** I type 2 or more characters, **when** results return, **then** they're grouped as "CONTACTS", "QUOTES", "JOBS", "INVOICES", "VENDOR BILLS" and "EXPENSES", up to 5 per group, each with a second line and a status on the right.
- **Given** a number like "INV-0010" or "QUO-4", **when** I type it, **then** the matching document is the first result.
- **Given** a record I can't read (e.g. invoices for a Field user), **when** results are built, **then** it never appears.
- **Given** no matches, **when** results return, **then** I see "No results for “<query>”".
- **Given** the footer, **when** it renders, **then** it reads "↑↓ to move", "Enter to open" and "Searches contacts, quotes, invoices, jobs, bills and expenses".

**Implementation notes**
- API: `GET /search?q=&limit=5` (contract addition, any member, results filtered by the same read rules as each module) → p95 under 500 ms at target scale (NFR-PERF-06).
- Data: Postgres `pg_trgm` indexes on names and numbers (04 "Columns added"); no external search service.

### US-OPS-23 · Use search with the keyboard and a screen reader
**Feature:** F-OPS-08 · **Priority:** P2 · **Phase:** 7 · **Screens:** `SearchPalette`
**As** a keyboard or screen-reader user, **I want** search to be fully operable without a mouse, **so that** I can find records as fast as anyone.

**Acceptance criteria**
- **Given** the palette, **when** it opens, **then** it's announced as a dialog named "Search" and the field as a combobox controlling a listbox.
- **Given** results, **when** I press the down and up arrows, **then** the highlight moves and the active option is announced.
- **Given** an option is highlighted, **when** I press Enter, **then** that record opens and the palette closes.
- **Given** the palette, **when** I press Escape, **then** it closes and focus returns to where it was.
- **Given** reduced motion, **when** it opens, **then** it appears without a scale animation (US-OPS-09).

**Implementation notes**
- UI: `@spine/ui` `CommandPalette` (new component, built on `cmdk`), with doc page and a11y test (D-033).

### US-OPS-24 · Show money the same way everywhere
**Feature:** F-OPS-04 · **Priority:** P1 · **Phase:** 6 · **Screens:** `DashboardOwnerRedesign`, `InvoicesBulkSelect`, `InvoicePdfPaymentInstructions`
**As** any member, **I want** amounts formatted consistently with thousands separators and the currency symbol, **so that** figures are easy to read and compare.

Decision: D-089

**Acceptance criteria**
- **Given** an amount of 12024.75 in an organisation using USD and en-US, **when** it's shown anywhere (lists, details, dashboard, PDFs, emails), **then** it reads "$12,024.75".
- **Given** a negative amount, **when** it's shown, **then** it reads "−$4,335.00" with a minus sign, and in red only where the screen marks losses.
- **Given** a locale such as en-IN or de-DE, **when** amounts render, **then** grouping and decimal marks follow that locale (e.g. "₹1,20,247.50", "12.024,75 €").
- **Given** a numeric column in a table, **when** it renders, **then** amounts are right-aligned with tabular figures in the normal UI font (no monospace).
- **Given** the test suite, **when** it runs, **then** a lint rule fails on any component that formats money by string concatenation (e.g. `${amount} USD`) instead of the shared formatter.

**Implementation notes**
- `packages/shared` `formatMoney(minor, currency, locale)` built on `Intl.NumberFormat`; used by web, PDFs, emails and mobile.

### US-OPS-25 · Keep text readable on coloured controls in dark mode
**Feature:** F-OPS-04 · **Priority:** P1 · **Phase:** 6 · **Screens:** `DashboardOwnerRedesignDark`, `SearchPaletteDark`
**As** a member who uses dark mode, **I want** button and badge text to stay readable, **so that** I can work comfortably at night.

Decision: D-099

**Acceptance criteria**
- **Given** dark mode, **when** a primary button renders (e.g. "+ New", "Send", "Record payment"), **then** its label uses `on-primary` (`#121110`) on `primary` (`#6B8AFF`), at least 4.5:1 — not white (3.1:1 today).
- **Given** dark mode, **when** a danger button, filled status chip, avatar or notification badge renders, **then** its text uses the matching `on-*` token and meets 4.5:1.
- **Given** light mode, **when** the same controls render, **then** they keep white text on the light-mode fills.
- **Given** the token contrast test, **when** it runs, **then** it fails if any `on-*`/fill pair is below 4.5:1 in either mode.
- **Given** a native text field in dark mode, **when** it's empty, **then** its placeholder uses `on-surface-muted` for the current mode (`#93907F`), not the fixed light value `#726C5A` (3.4:1 on the dark surface).

**Implementation notes**
- Tokens: add `on-primary`, `on-danger` (light `#FFFFFF`, dark `#121110`) to `docs/DESIGN.md` front matter → `packages/config/tailwind-preset.css` and `packages/ui-native/src/tokens`; replace `text-white` on filled variants in `@spine/ui` (`button.tsx`, `badge.tsx`, `avatar.tsx` and others found by grep).
- Native: `text-field.tsx` resolves `placeholderTextColor` via `useNativeColors()` (the gap noted in native-notes).
- Tests: axe-core component tests run in both `data-theme="light"` and `"dark"`.

### US-OPS-26 · Use every new screen in dark mode
**Feature:** F-OPS-04 · **Priority:** P1 · **Phase:** 7 · **Screens:** `DashboardOwnerRedesignDark`, `InvoicesBulkSelectDark`, `SettingsRemindersDark`, `SearchPaletteDark`
**As** a member who uses dark mode, **I want** the new dashboard, search, bulk actions and settings to look right in dark mode, **so that** new features never break my theme.

Decision: D-100

**Acceptance criteria**
- **Given** dark mode, **when** any Phase 7 screen renders, **then** every colour comes from a token with a dark value (no hex in components), matching the dark designs on the canvas.
- **Given** the dashboard in dark mode, **when** charts, sparklines, aging bars and status chips render, **then** they use the dark status tokens (`paid` `#4ADE94`, `due-soon` `#F2B23D`, `overdue` `#F17B72`, `primary` `#6B8AFF`) and money-out bars use `border-strong`.
- **Given** dark mode, **when** the sidebar renders, **then** the logo switches to the light wordmark (`spine-logo-horizontal-light.png`).
- **Given** dialogs, menus, the search palette and drawers in dark mode, **when** they open, **then** they use `surface` on a darkened overlay and stay distinguishable from the page (`background`).
- **Given** PDFs and customer emails, **when** they're produced, **then** they're always light, whatever the viewer's theme.
- **Given** the E2E suite, **when** it runs, **then** each Phase 7 screen has a light and a dark screenshot test, and axe passes in both.

**Implementation notes**
- Web: `next-themes` `data-theme` (US-AUTH-07); Native: `dark:` pairs and `useNativeColors()` per [native notes](../design/native-notes.md).

### US-OPS-27 · Store files on local disk by default
**Feature:** F-OPS-09 · **Priority:** P1 · **Phase:** 6 · **Screens:** —
**As** a self-hoster, **I want** attachments to work with no extra storage service, **so that** Spine installs and runs without MinIO or any S3 setup.

Decision: D-102

**Acceptance criteria**
- **Given** a fresh install with no storage settings, **when** a member uploads a receipt, photo, signature or logo, **then** it's saved under the API container's files volume (`/data/files`) and opens again from `GET /files/:id`.
- **Given** `STORAGE_DRIVER=s3` with `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY` and `S3_SECRET_KEY`, **when** files are uploaded, **then** they go to that S3-compatible store instead and every file feature behaves the same.
- **Given** the API crashes or loses power mid-upload, **when** it restarts, **then** no partial file is ever served; the upload simply failed (NFR-REL-08).
- **Given** a file read with the `local` driver, **when** it's allowed, **then** the API streams it with its type, size, `ETag` and range support; a link that must work without a session is an API-signed URL (file id, expiry, HMAC with `AUTH_SECRET`) valid for at most 5 minutes.
- **Given** the `minimal` Compose profile, **when** it runs, **then** attachments work fully (no read-only mode).
- **Given** `docker-compose.yml` and `docker-compose.dev.yml`, **when** this story ships, **then** neither references `minio/minio`; both mount a named `spine_files` volume on the API, and an optional `rustfs` profile runs `rustfs/rustfs:1.0.x` with a memory limit for owners who want self-hosted S3 (D-103).
- **Given** the test suite, **when** it runs, **then** the same storage scenarios pass against both drivers (`local` on a temp folder, `s3` against S3Mock in CI).

**Implementation notes**
- `StorageDriver` interface (`save`, `openReadStream`, `delete`, `exists`) in `apps/api/src/modules/files`; `local` and `s3` implementations; `FilesService` selects by `STORAGE_DRIVER` (default `local`).
- Writes: temp file → `fsync` → atomic rename into `/data/files/<org-id>/<2-char prefix>/<file-id>`; paths come only from ids, never from uploaded names.
- Data: `files.storage_driver` (04 "Columns added"). `.env.example` / `.env.e2e` gain `STORAGE_DRIVER=local`; `S3_*` become optional and commented. CI E2E switches to `local`.
- The API container runs as a non-root user that owns `/data/files`.

### US-OPS-28 · Prove stored files are intact
**Feature:** F-OPS-09 · **Priority:** P1 · **Phase:** 6 · **Screens:** —
**As** an owner, **I want** Spine to detect a damaged or missing file, **so that** I find out before I need that receipt or signed quote.

Decision: D-104

**Acceptance criteria**
- **Given** a file is uploaded, **when** it's saved, **then** its SHA-256 checksum is stored with the file record.
- **Given** a file is served, **when** its checksum no longer matches, **then** the API returns 409 with "This file is damaged. Restore it from your latest backup." and logs the file id.
- **Given** the weekly integrity job runs, **when** every file matches, **then** nothing is shown.
- **Given** the job finds a damaged or missing file, **when** it finishes, **then** Owners see "<n> stored files are damaged or missing — restore from your latest backup." on the dashboard and get an in-app notification listing the records affected.
- **Given** an issued PDF (US-INV-17), **when** anyone tries to replace it, **then** the write is refused; issued files are write-once.

**Implementation notes**
- Data: `files.checksum_sha256` (04 "Columns added"); backfilled for existing files by a one-off job.
- Queue: `file-integrity-check` (weekly, pg-boss); event `files_damaged` (Owners).

### US-OPS-29 · Accept only safe uploads
**Feature:** F-OPS-09 · **Priority:** P1 · **Phase:** 6 · **Screens:** —
**As** an owner, **I want** uploads checked and served safely, **so that** a file can't attack someone's browser or leak where a photo was taken.

Decision: D-104

**Acceptance criteria**
- **Given** an upload, **when** its real content type (from the file's bytes, not its name) isn't JPEG, PNG, WebP, HEIC or PDF, **then** it's refused with 415 and "This file type isn't supported. Upload a photo or a PDF.".
- **Given** a photo with location data, **when** it's saved, **then** GPS EXIF fields are removed and orientation is kept.
- **Given** any file is served, **when** the response is sent, **then** it carries `X-Content-Type-Options: nosniff`, the stored content type, and `Content-Disposition: attachment` for everything except images and PDFs shown inline.
- **Given** an uploaded file name like `../../etc/passwd.pdf`, **when** it's stored, **then** it's kept only as a display label and never used in a path.

**Implementation notes**
- Type sniffing with `file-type`; EXIF stripping with `sharp` for images; limits stay at 10 MB (D-053).

### US-OPS-30 · Move existing files off MinIO
**Feature:** F-OPS-09 · **Priority:** P2 · **Phase:** 6 · **Screens:** —
**As** someone already running Spine with MinIO, **I want** a safe way to switch to local storage, **so that** I keep every file when upgrading.

Decision: D-102

**Acceptance criteria**
- **Given** an install with `S3_*` set and files in the bucket, **when** I run `pnpm --filter @spine/api files:migrate --from s3 --to local`, **then** every file referenced in the database is copied into the files volume, its checksum is verified, and a summary prints copied, skipped and failed counts.
- **Given** a file fails to copy, **when** the command finishes, **then** it exits non-zero, lists the failures and leaves the bucket untouched.
- **Given** the migration succeeded, **when** I set `STORAGE_DRIVER=local` and restart, **then** every attachment opens as before.
- **Given** an owner who doesn't want to migrate, **when** they set `STORAGE_DRIVER=s3` and keep their MinIO running, **then** Spine works unchanged (documented in the upgrade notes).

**Implementation notes**
- Idempotent: re-running skips files already present with a matching checksum; `files.storage_driver` updated per row.

### US-OPS-31 · Warn before the disk fills up
**Feature:** F-OPS-09 · **Priority:** P2 · **Phase:** 6 · **Screens:** `UpgradeNotice`
**As** an owner, **I want** a warning before storage runs out, **so that** uploads don't suddenly fail on site.

**Acceptance criteria**
- **Given** the files volume is more than 85% full, **when** an Owner opens any page, **then** a banner in the same style as the update notice reads "Storage is <n>% full. Free up space or add disk before uploads stop working.".
- **Given** the volume is full, **when** someone uploads, **then** the upload fails with "There's no space left to store this file. Ask an owner to free up space." and nothing else breaks.
- **Given** Staff or Field users, **when** the volume is nearly full, **then** they don't see the banner (only the upload error when it happens).
- **Given** `/health/ready`, **when** it reports, **then** it includes `storage: { driver, usedPercent }` for the `local` driver.

**Implementation notes**
- Check with `statfs` on `/data/files` every 15 minutes; the banner reuses the `UpgradeNotice` component pattern.
