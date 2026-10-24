# 02 · Architecture

## Context

```
                         ┌──────────────────────────────── one host (Docker Compose) ───────────────────────────────┐
  Owner / Staff ─ browser ─┐                                                                                          │
  Customer ── quote link ──┼──▶ Caddy (TLS) ──▶ web  (Next.js :3000) ──server-side fetch──▶ api (NestJS :4000) ──▶ PostgreSQL 16
  Field crew ── iOS/Android┘            └──────────────────────────────────────────────▶ api        │   (data + pg-boss jobs)
                                                                                                    ├──▶ files: local volume (default) or S3
                                                                                                    ├──▶ SMTP (email, optional)
                                                                                                    └──▶ Web Push (optional)
  Optional: Cloudflare Tunnel sidecar gives a NAT'd install a public URL for quote links.
```

## Components

| Component | Responsibility | Talks to |
|---|---|---|
| `apps/web` | Office app (Owner/Staff/Field), public quote page `/quote/[token]`, onboarding, sign-in | `apps/api` over HTTP with the session cookie |
| `apps/api` | All business rules, authorisation, ledger postings, PDFs, email, files, notifications, jobs | PostgreSQL, files volume or S3, SMTP, Web Push |
| `apps/mobile` | Field app: today's jobs, photos, expenses, milestones, on-site acceptance, offline outbox | `apps/api` with `Authorization: Bearer <session token>` |
| PostgreSQL | System of record, ledger constraints, pg-boss queues | — |
| File storage | Logos, receipts, job photos, issued PDFs, signatures — `local` driver (Docker volume `spine_files` on the API) by default, `s3` driver optionally | — |
| Caddy | TLS termination, routing `/` → web and `/api` → api | — |

**Dependency rule:** all business logic and every authorisation decision lives in `apps/api` services. `apps/web` and `apps/mobile` hide what a user can't do (UI convenience), but the API re-checks every request ([07-security](07-security.md)).

## Process model

| Process | Started by | Notes |
|---|---|---|
| `api` | `node dist/main.js` | One process. Runs HTTP and the pg-boss workers. Migrations run before start (forward-only) |
| `web` | `next start` | Stateless |
| Workers (inside `api`) | pg-boss | `quote-send-email`, `invoice-send-email`, `notify-email`, `meeting-starting-soon-poll` (every few minutes) |
| `db` | Postgres container | Volume `pgdata` |

## Request flow

1. **Web:** server components call the API server-side, forwarding the Better Auth session cookie; client components call it from the browser with credentials.
2. **Mobile:** the app stores the session token in secure storage and sends it as a Bearer header ([D-016](12-decisions.md)).
3. **Public quote page:** `GET/POST /public/quotes/:token` — no session; the token is unguessable, scoped to one quote and rate-limited ([D-032](12-decisions.md)).
4. Every request resolves the active organisation from the session, then: role guard (`@OrgRoles`) → capability guard (`@RequireCapability`) → service-layer ownership check (`requireOwnershipCapability`) → business rule → transaction.

## The ledger

```
Business event  ─▶  Domain service  ─▶  Posting rule  ─▶  Journal entry (balanced)  ─▶  journal_lines (+ contact_id, job_id)
(invoice issued)   (InvoicesService)    (LedgerService)    debits = credits (DB trigger)
```

- Journal entries are written **in the same transaction** as the document; either both land or neither does ([D-005](12-decisions.md)).
- An entry is immutable; corrections post a reversing entry (`reversed_by_id`).
- Every entry records `source_type` + `source_id` (`invoice`, `invoice_void`, `payment`, `payment_delete`, `payment_credit_applied`, `credit_note`, `expense`, `vendor_bill`, `vendor_bill_void`, `vendor_payment`, `vendor_payment_delete`; from Phase 8 also `opening_balance`, `opening_invoice`, `opening_customer_credit`, `opening_bill`, `opening_vendor_credit`, `manual_journal`, `manual_journal_reversal`, `bank_transfer`, `bank_transaction`, `customer_refund`, `vendor_credit`, `vendor_credit_void`, `vendor_refund`, `tax_payment`, `tax_refund`) so every report figure drills down to a document.
- A database trigger rejects an entry whose debits ≠ credits; a scheduled integrity check asserts the trial balance.
- Postings are dated at the moment of the business action (issue/record/approve time). A closed fiscal period rejects postings dated inside it ([D-030](12-decisions.md)).
- Owners may post adjusting journals (Phase 8), which never touch control accounts; opening balances post once at a cutover date and are then locked behind a closed period ([D-134](12-decisions.md), [D-137](12-decisions.md)).
- Every movement of money names a **money account** — a bank, cash or card ledger account ([D-140](12-decisions.md)); bank reconciliation marks journal lines on those accounts as reconciled and posts nothing itself ([D-158](12-decisions.md)).
- Cash-basis figures are computed when a report runs, from the accrual ledger and payment allocations; there is one ledger ([D-138](12-decisions.md)).
- The full posting table is [06-ledger-posting-rules](06-ledger-posting-rules.md).

## Document numbering

`number_sequences` holds one row per organisation and document type (quote, invoice, credit note, receipt, expense, vendor payment, job — jobs get their number with US-JOB-22; vendor credit `VCR-` and journal `JNL-` from Phase 8). Opening invoices keep their old system's numbers. Issuing locks the row (`SELECT … FOR UPDATE`), takes the next value and writes the document in the same transaction, so numbers are gapless and never reused. Drafts have no number. Prefix and padding are configurable (Settings › Numbering). Vendor bills keep the vendor's own number.

## State machines

### Quote

```
draft ──send (quotes.send)──▶ sent ──customer accepts (link) / field accepts in person──▶ accepted (read-only)
  │                            ├──customer declines──▶ rejected
  │                            ├──revise (quotes.revise)──▶ new draft version (parent_quote_id); old one superseded
  └─delete (draft only)        └──validUntil passes──▶ shown as expired (informational)
discount ≥ threshold (default 20%) → sending is blocked until an Owner (or quotes.approve_discount) approves
accepted ──convert──▶ job and/or invoice (repeat conversion guarded, D-026)
```

### Invoice

```
draft ──issue (invoices.issue): number allocated, lines snapshotted, journal posted──▶ issued
issued ──payments allocated──▶ (balance → 0 = paid; computed, not a status)
issued ──void with reason (invoices.void): reversing entry──▶ void
issued ──credit note issued──▶ balance reduced
types: standard · advance (credit held as Customer Advances) · progress (from a milestone) · retention_release
```

### Payment

Record against a contact → allocate across open invoices (oldest-first suggestion) → any remainder is unallocated customer credit → later "Apply credit" allocates it. A DB trigger stops allocations exceeding either the payment or the invoice balance. Deleting is allowed only while unallocated and posts a reversing entry.

### Job and milestones

```
quote accepted ──convert──▶ job (active) ── on_hold / completed / cancelled
milestones (fixed or % of contract, % must total 100) : pending ──mark complete (office or field)──▶ completed ──raise invoice──▶ invoiced
retention % held on each progress invoice → Retention Receivable; "Release retention" raises a retention_release invoice
variation order = a linked quote; when accepted, "Apply to job" adds its total to the contract value
```

### Expense

`submitted` (by anyone, including Field, offline-capable) → `approved` (posts Dr Expense / Cr Bank — P15; an employee-reimbursements account is planned for v1.1 (Q-05); the money account is chosen at approval from Phase 8; can then be billed to the customer as a draft invoice) or `rejected` (comment required; no posting).

### Vendor bill

`draft` → `recorded` (posts Dr Expense/COGS + Input Tax / Cr AP) → paid via vendor payments (allocated across bills) and vendor credits (Phase 8) · `recorded` → `void` (reversing entry).

### Vendor credit (Phase 8)

`draft` → `open` (recorded: posts P24) → `used` (allocations to bills and vendor refunds reach the total) · `open` with nothing applied → `void` (reversing entry).

### Bank reconciliation (Phase 8)

Statement lines import as `unmatched` → `matched` (to one or more journal lines on the account) or `excluded` (with a note). A reconciliation is `in_progress` → `finished` (difference zero; matched lines locked) → `undone` (latest only; lines unlocked).

### Opening balances (Phase 8)

`draft` (editable; P17–P20 re-post on change) → `locked` (closed fiscal period up to the day before the cutover date) → `draft` again only by an Owner's audited unlock.

### Meeting

Visibility `private` (organiser + invitees) or `org` (everyone). Invitees respond invited → accepted / declined / tentative. Recurring meetings store a rule; single-occurrence edits/cancellations are `meeting_occurrence_exceptions`. A poll job sends "starting soon" reminders to the organiser and accepted/tentative attendees at each person's lead time ([D-024](12-decisions.md)).

## Authentication summary

| Client | Mechanism |
|---|---|
| Web | Better Auth email/password; HTTP-only session cookie |
| Mobile | Same sign-in; session token kept in secure storage and sent as `Authorization: Bearer` |
| Customer | Public quote token in the URL; no session |
| Sign-up | Open only until the first user exists (that user becomes Primary Owner); afterwards accounts come only from invitations |
| Password reset | Email link, single-use, 1 hour ([D-056](12-decisions.md)) — Phase 6 |

Details and the capability matrix: [07-security](07-security.md).

## Modules (Phase 9)

Four optional groups — Leads & meetings, Jobs & field, Approvals, Recurring documents — can be switched off per business ([D-154](12-decisions.md)). One map in `packages/shared/src/modules.ts` lists each module's routes, capabilities, navigation items, widgets, search types, notification types and queues. The API's `ModuleGuard` refuses a switched-off module's routes with 403 `MODULE_OFF` before capability checks; the web reads the same map to hide everything; queues skip a switched-off module's work. Switching off never deletes data or Team grants. These are runtime settings, unlike the build-time phase flags in `feature-flags.ts` ([D-068](12-decisions.md)).

## AI assistant (Phase 9)

Optional and off by default ([D-162](12-decisions.md)). `AiService` in the API calls one configured `AiDriver` — `none`, `openai-compatible` (local Ollama/vLLM/LM Studio or any compatible cloud endpoint) or `anthropic` — with the Owner's own endpoint and key ([D-163](12-decisions.md)). Each feature is a small read-only route that gathers what it needs through the module's own services with the caller's permissions, redacts it ([D-165](12-decisions.md)), asks the model for a fixed JSON shape, validates every field and returns a suggestion the web or mobile form pre-fills ([D-166](12-decisions.md)). AI never writes: the person saves through the normal route. Totals and tax are computed by `@spine/shared`, never taken from the model. Every request is metered and logged in `ai_requests` ([D-168](12-decisions.md), [D-169](12-decisions.md)); with the AI module off, nothing in this path runs.

## Background jobs and events

| Queue / event | Trigger | Effect |
|---|---|---|
| `quote-send-email` | Quote sent | Render PDF, email the customer with the public link; retried on SMTP failure; recorded in the email log (D-220) |
| `invoice-send-email` | Invoice emailed / reminder | Render PDF, email with balance due |
| `notify-email` | Any notification with an email channel | Email to the targeted users |
| `email-log-cleanup` | Daily | Deletes email log rows older than 180 days (D-220); every email, queued or sent straight away, is recorded in `email_log` by `EmailService` |
| `meeting-starting-soon-poll` | Every few minutes | Sends `meeting_starting_soon` to each attendee once per occurrence |
| `recurring-bill-run` | Every 15 minutes, from 6:00 AM organisation time (Phase 8) | Creates due recurring bills, recorded or as drafts ([D-159](12-decisions.md)) |
| Notification types | `quote_viewed`, `quote_accepted`, `quote_rejected`, `payment_received`, `payment_credit_applied`, `expense_approved`, `expense_rejected`, `crew_assigned`, `crew_removed`, `milestone_completed`, `milestone_invoiced`, `job_completed`, `variation_order_created`, `variation_order_accepted`, `variation_order_applied`, `invoice_void`, `meeting_invited`, `meeting_removed`, `meeting_cancelled`, `meeting_response_changed`, `meeting_starting_soon` | In-app notification row + optional email + optional browser push |

## Offline sync (mobile)

- **Read cache:** the app stores the last-fetched assigned jobs, their milestones, contacts and the user's expenses in a local SQLite database and shows them when offline, labelled with the time they were fetched.
- **Outbox:** photo uploads, expense submissions and milestone completions are written to a local outbox (SQLite, with compressed copies of their photos in the app's documents folder) with a client-generated UUID used as the `Idempotency-Key`; each request an item makes uses a key derived from it and the photo (`<id>:file:<photo>`, `<id>:photo:<photo>`, the photo being its kept file's unique name — per photo, not per position, so a retake or a removed photo never reuses another's key, D-251), and what's done is saved after every step, so a retry resumes and never duplicates ([D-009](12-decisions.md)). Items send oldest first when queued, when the device reconnects or returns to the foreground, and on "Try sending now". Network errors, 5xx, 408, 409 (still in progress) and 429 retry with back-off (5 s doubling to 5 minutes) and stay "Waiting"; any other 4xx marks the item failed with "Didn't send: <reason>" and "Fix"; 401/403 `ACCESS_REMOVED`/426 pause sending and keep the items. The outbox belongs to one person on one server: signing out or losing access deletes it (after the warning), an expired session keeps it, and someone else signing in on the phone never sends it.
- **Files:** photos and receipts are compressed on the phone, uploaded with `POST /files`, then referenced by id ([D-053](12-decisions.md)). One exception to "through the outbox": a receipt the person asks AI to read is uploaded at once (online only) so AI can read it; its id goes on the photo, and the queued expense sends that id instead of uploading the photo again ([D-251](12-decisions.md)). AI is never asked from the outbox.
- **Conflicts:** appends (photos, expenses, notes) never conflict. Milestone completion is first-write-wins: a later completion of an already-completed milestone returns 200 with `alreadyCompleted: true`, changes nothing and is recorded in history (US-MOB-15). Accept/decline of a quote needs connectivity and is refused once the quote isn't `sent` ([D-050](12-decisions.md)).
- **Not offline:** quote acceptance, anything that issues a financial document, sign-in ([D-050](12-decisions.md)) and reading a receipt with AI (D-251).

## File storage

Files go through one `StorageDriver` interface in `apps/api/src/modules/files` ([D-102](12-decisions.md)); no other code reads the volume or bucket directly.

| | `local` (default) | `s3` (optional) |
|---|---|---|
| Where | `/data/files/<org-id>/<prefix>/<file-id>` in the `spine_files` Docker volume mounted on the API container | Any S3-compatible store: AWS S3, Cloudflare R2, Backblaze B2, or the optional `rustfs` Compose profile |
| Write | Temp file → `fsync` → atomic rename; SHA-256 stored in `files.checksum_sha256` | `PutObject`; same checksum |
| Read | API checks the owning record, then streams with `ETag` and range support; links that must work without a session are API-signed (HMAC with `AUTH_SECRET`, ≤ 5 minutes) | API checks the owning record, then redirects to a presigned URL (≤ 5 minutes) |
| Backup | `backup.sh` archives the volume with the database dump | `backup.sh` copies the bucket |
| When unavailable | Disk full → that upload fails with a clear error; everything else keeps working | Store unreachable → uploads and downloads show an error; the app keeps working |

Safety rules ([D-104](12-decisions.md)): issued files are write-once; uploads are type-checked from their bytes and GPS data is stripped from photos; files are served with `nosniff`; a weekly job verifies every checksum. Optional per-file encryption with `FILES_ENCRYPTION_KEY` is off by default ([D-106](12-decisions.md)). The host is a single point of failure, so off-site backups are what protect the data ([D-105](12-decisions.md), [R-14](13-risks-open-questions.md)).

## Help and documentation

The public site is two Astro projects: `apps/site`, the home page at `h4loom.com`, and `apps/docs` (Starlight), the user guide, self-hosting guide, developer docs and the generated API reference at `docs.h4loom.com` ([D-108](12-decisions.md), [D-270](12-decisions.md)). It is the only place user help is written ([D-109](12-decisions.md)).

- **Bundled guide:** the web image's build copies the user guide and self-hosting sections for that release into `/help`, served as static files by the web app — no login, no outside requests, search included ([D-110](12-decisions.md)).
- **Help button:** the sidebar's Help (?) menu maps the current route to its guide page (`apps/web/src/lib/help-links.ts`) and opens `/help/...` on the same server; "Online docs ↗" opens the public site at the matching version.
- **Publishing:** Cloudflare Pages builds and deploys each project after merges to `main` that change its folder (for the docs, also the OpenAPI document), with a preview address for every branch ([D-270](12-decisions.md)).

## Updates

Behind Caddy, one address serves everything: `/api/auth/*` goes to the API unchanged (Better Auth's own path), the rest of `/api/*` to the API without the `/api` prefix, `/.well-known/oauth-*` to the API, and everything else to the web app. The web image is built with `NEXT_PUBLIC_API_URL=/api`, so one image serves any domain (US-OPS-01, US-OPS-51).


Migrations run automatically on boot (built in US-OPS-01, under a Postgres advisory lock so one instance migrates), forward-only and idempotent, after an automatic pre-migration database snapshot (US-OPS-50). Semantic versioning; every release notes breaking changes. Once a day the server checks the latest public release and shows Owners an update banner unless disabled ([D-055](12-decisions.md)). Mobile builds ship through the stores; JavaScript-only fixes may ship over the air ([15-mobile-release](15-mobile-release.md)).

## Appendix — rules moved verbatim from CLAUDE.md

These were the original CLAUDE.md's architecture rules and design decisions (D-039). The decisions table ([12-decisions](12-decisions.md)) is the authority; this text keeps the reasoning.

## Core architectural rules (non-negotiable per PRD §6, §10.4)

These constraints protect financial correctness and should govern any implementation work in this repo:

- **Ledger is derived, never authored.** Every business event (invoice issued, payment received, etc.) flows through a domain service → a posting rule → a balanced journal entry. Users never type a journal entry. Posting rules live in one module (see §7.2 for the full debit/credit table).
- **Journal entries are immutable.** Corrections are reversing entries, never edits. The one exception is demo data: "Delete all demo data" deletes the entries flagged `is_demo` with it ([D-191](12-decisions.md)). A DB constraint enforces debits == credits per entry, in the same transaction as the business document it originates from.
- **Money is integer minor units (`bigint`) + currency code.** No floats. Rounding happens once, at line level, half-up. Tax is computed per line, not per document.
- **Documents snapshot their data.** Catalogue price/tax changes must never alter existing quotes/invoices — issued documents store a snapshot at time of issue.
- **Document numbers are gapless and permanent.** Allocated inside the issuing transaction via a row lock on a sequence table; drafts have no number; numbers never change once assigned.
- **Issued financial documents are never edited or deleted.** Only voided (with reversing entry) or credited.
- **Server-side authorization on every endpoint** — never trust a client-supplied role.
- **Idempotency keys on all mutating endpoints** (critical for the mobile offline outbox pattern, §6.6).
## Key design decisions to preserve when implementing

- **Job costing without a parallel subsystem**: journal lines carry optional `contact_id` and `job_id`. AR aging and job profitability come from filtering the ledger, not from separate calculations — don't build a shadow costing system.
- **Retention** posts to a dedicated `Retention Receivable` account, distinct from AR, so aging reports aren't distorted by held retention.
- **Quote versioning** uses `parent_quote_id`; revising a sent quote creates a new version and supersedes the old one rather than mutating it.
- **Mobile offline model is intentionally partial** (§6.6): read-only cache (SQLite) for lists, write via an outbox queue with idempotency keys for photos/expenses/milestone updates. No offline creation of financial documents (quotes/invoices) — those require connectivity.
- **First-run onboarding is not a gate.** The app must be fully usable if the wizard is skipped; onboarding settings (industry template, tax, numbering, etc.) must remain editable later from Settings.
- **Onboarding never includes database/infra setup.** Provisioning Postgres and its credentials happens before the app ever serves a page — via `scripts/install.sh` and `.env` (`DATABASE_URL`), not an in-app step. The wizard begins only after sign-up (first user on a fresh instance becomes the **Primary Owner** automatically — see the permission model section below), and its step order is fixed: business profile → industry template → currency/locale/financial year → tax rates → numbering prefixes → chart-of-accounts confirmation → team invite. "Load demo data" is an alternative/supplement offered at step 1, not a separate flow. Every step must remain skippable and re-editable from Settings (§S-12.10), per the rule above.
- **Profile & Preferences is not the same surface as org Settings.** Every user, regardless of role, gets a personal page (name, email, password, avatar, preferences) reachable from the user menu — separate from the Owner-only organisation Settings dialog and separate from the Users/Teams/Permissions area. Don't fold personal account editing into either of those.
- **Graceful degradation**: if SMTP is down, documents still issue and email queues for retry; if object storage is down, the app runs read-only for attachments rather than failing globally. The app must boot with only 3 required env vars (`DATABASE_URL`, `AUTH_SECRET`, `APP_URL`).
