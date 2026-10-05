# 05 · API

NestJS REST API in `apps/api`. OpenAPI document at `/api/docs` (Swagger UI) — `packages/sdk` is generated from it. This file is the contract: every route a story names must be here, with the same path. Auth routes (`/api/auth/*`) are Better Auth's own and are not listed route by route.

## Conventions

| Topic | Rule |
|---|---|
| Base | Routes below are relative to the API origin (behind Caddy at `/api`). JSON in and out |
| Auth | Web: Better Auth session cookie. Mobile: `Authorization: Bearer <session token>` ([D-016](12-decisions.md)). Public routes need neither |
| Organisation | Resolved from the session's active organisation; every query is scoped by `org_id`. A user with no active org gets 403 |
| Validation | Bodies are parsed with the Zod schemas in `@spine/shared`; failures return 400 with Zod `issues` |
| Money | `bigint` minor units serialised as **decimal strings** (`"51000"` = 510.00) to avoid precision loss; currency is a separate field |
| Dates | ISO 8601 strings; date-only fields as `YYYY-MM-DD` |
| Idempotency | Every mutating route requires `Idempotency-Key` (UUID). First call executes and stores the response; a replay with the same key returns the stored response; a concurrent duplicate gets 409 ([D-009](12-decisions.md)). Keys are scoped per user and per actual path; a route-introspection test enforces this on every non-GET route (US-OPS-08). The 2 public quote routes are protected by state checks instead |
| Files | Two-step: `POST /files` (multipart, ≤ 10 MB) returns `{ id }`; other endpoints reference the id ([D-053](12-decisions.md)) |
| Long work | PDFs and emails run on pg-boss queues; the request returns immediately with the document, and email status (`pending`/`sent`/`failed`) is a field on it. Failures retry; the Email queue view lists unresolved jobs |
| Pagination | List endpoints return arrays filtered server-side by query parameters (`search`, `status`, `contactId`, `includeArchived`…); tables page client-side at 10/25/50. Target scale is 10,000 records per list (NFR-PERF-01) |
| History | Most resources expose `GET /<resource>/:id/history` (audit entries newest first) |
| Naming | Plural nouns; actions on a record are `POST /<resource>/:id/<verb>` (`/send`, `/issue`, `/void`, `/approve`) |
| Rate limits | Public quote routes: 20 requests/minute/IP |
| Client version | The mobile app sends `X-Spine-Client-Version: X.Y.Z`; below `MOBILE_MIN_VERSION` the API answers 426 ([D-071](12-decisions.md)) |
| Currency | Single-currency: every document's currency is the organisation's currency, set by the server; clients show it read-only |

## Access levels

| Level | Meaning |
|---|---|
| Public | No session (customer quote link, invitation lookup, health) |
| Any member | Any active member of the organisation (Owner, Staff, Field) |
| roles: … | `@OrgRoles` — only these membership roles pass |
| `capability` | `@RequireCapability` — Owners always pass; Staff need a Team granting it; Field passes only for capabilities in Field's fixed sets |
| Service checks | Own/others capabilities (`*.edit_own`/`edit_others`/`delete_own`/`delete_others`) and workflow capabilities that depend on the record (e.g. `jobs.assign`, `quotes.accept_in_person`, `invoices.void`) are checked **inside the service** after the record is loaded ([D-018](12-decisions.md)). They are not visible on the route; the story names them |

## Errors

| Status | When | Body |
|---|---|---|
| 400 | Validation failed; business rule broken (e.g. "This quote's discount requires owner approval before it can be sent", "falls within a closed fiscal period", percentages ≠ 100) | `{ statusCode, message, error }` or Zod `issues` |
| 401 | No or expired session | `{ statusCode: 401 }` |
| 403 | Role, capability or ownership check failed; no active organisation | `{ statusCode: 403, message }` |
| 404 | Record not in this organisation | `{ statusCode: 404 }` |
| 409 | Idempotency key in flight; repeat quote conversion in `warn` mode (body lists existing jobs/invoices; retry with `confirm: true`); unique conflict | `{ statusCode: 409, message, existing? }` |
| 413 | Upload over 10 MB | |
| 426 | Mobile client older than the server's minimum (`X-Spine-Client-Version` header below `MOBILE_MIN_VERSION`); Phase 5 ([D-071](12-decisions.md)) | `{ statusCode: 426, error: "CLIENT_TOO_OLD" }` |
| 429 | Rate limit on public routes | |
| 500 | Unexpected; logged with a request id | `{ statusCode: 500, requestId }` |

Ownership checks run **before** status checks, so a non-owner gets 403 rather than 400 on a document they couldn't edit anyway.

## Events

Notifications emitted through `NotificationsService.notify` (in-app row; email and browser push when enabled): `quote_viewed`, `quote_accepted`, `quote_rejected`, `payment_received`, `payment_credit_applied`, `expense_approved`, `milestone_completed`, `milestone_invoiced`, `job_completed`, `variation_order_created`, `variation_order_accepted`, `variation_order_applied`, `invoice_void`, `meeting_invited`, `meeting_removed`, `meeting_cancelled`, `meeting_response_changed`, `meeting_starting_soon`. Queues: `quote-send-email`, `invoice-send-email`, `notify-email`, `meeting-starting-soon-poll`.

## Routes

Generated from the controllers' decorators (230 routes, class- and method-level `@OrgRoles` / `@RequireCapability`). "Any member" means no role guard on the route: Owner, Staff and Field all pass, and any narrower rule is a service check. Rows marked **No** under Idempotent are the gap tracked by [R-10](13-risks-open-questions.md) and fixed by US-OPS-08.

### Activities — `/activities`

| Method | Path | Access | Idempotent |
|---|---|---|---|
| GET | `/activities` | Any member | — |
| POST | `/activities` | roles: owner, staff; `activities.edit_own` | Yes |
| DELETE | `/activities/:id` | roles: owner, staff | Yes |
| GET | `/activities/:id` | Any member | — |
| PUT | `/activities/:id` | roles: owner, staff | Yes |
| POST | `/activities/:id/done` | roles: owner, staff | Yes |
| POST | `/activities/:id/undone` | roles: owner, staff | Yes |
| GET | `/activities/overdue` | Any member | — |

### Catalogue — `/catalog-items`

| Method | Path | Access | Idempotent |
|---|---|---|---|
| GET | `/catalog-items` | Any member | — |
| POST | `/catalog-items` | roles: owner, staff; `catalog.edit_own` | Yes |
| DELETE | `/catalog-items/:id` | roles: owner, staff | Yes |
| GET | `/catalog-items/:id` | Any member | — |
| PUT | `/catalog-items/:id` | roles: owner, staff | Yes |
| POST | `/catalog-items/:id/archive` | roles: owner, staff | Yes |
| GET | `/catalog-items/:id/history` | Any member | — |
| POST | `/catalog-items/:id/restore` | roles: owner, staff | Yes |

### Contacts — `/contacts`

| Method | Path | Access | Idempotent |
|---|---|---|---|
| GET | `/contacts` | Any member | — |
| POST | `/contacts` | roles: owner, staff; `contacts.edit_own` | Yes |
| DELETE | `/contacts/:id` | roles: owner, staff | Yes |
| GET | `/contacts/:id` | Any member | — |
| PUT | `/contacts/:id` | roles: owner, staff | Yes |
| POST | `/contacts/:id/archive` | roles: owner, staff | Yes |
| GET | `/contacts/:id/history` | Any member | — |
| POST | `/contacts/:id/restore` | roles: owner, staff | Yes |
| POST | `/contacts/import` | roles: owner, staff; `contacts.edit_own` | Yes |

### Credit notes — `/credit-notes`

| Method | Path | Access | Idempotent |
|---|---|---|---|
| GET | `/credit-notes` | roles: owner, staff | — |
| POST | `/credit-notes` | roles: owner, staff; `credit_notes.edit_own` | Yes |
| DELETE | `/credit-notes/:id` | roles: owner, staff | Yes |
| GET | `/credit-notes/:id` | roles: owner, staff | — |
| PUT | `/credit-notes/:id` | roles: owner, staff | Yes |
| GET | `/credit-notes/:id/history` | roles: owner, staff | — |
| GET | `/credit-notes/:id/pdf` | roles: owner, staff — live for a draft, the stored PDF once issued (US-INV-17, D-116) | — |
| POST | `/credit-notes/:id/issue` | roles: owner, staff; `credit_notes.issue` | Yes |

### Dashboard — `/dashboard`

| Method | Path | Access | Idempotent |
|---|---|---|---|
| GET | `/dashboard/activity-feed` | Any member | — |
| GET | `/dashboard/checklist` | Any member; `{ visible: false }` unless Owner (US-ONB-12) | — |
| POST | `/dashboard/checklist/dismiss` | roles: owner (US-ONB-12) | Yes |

### Demo data — `/demo-data`

| Method | Path | Access | Idempotent |
|---|---|---|---|
| DELETE | `/demo-data` | roles: owner | Yes |
| POST | `/demo-data/seed` | roles: owner (US-OPS-20) | Yes |
| GET | `/demo-data/status` | Any member | — |

### Expense categories — `/expense-categories`

| Method | Path | Access | Idempotent |
|---|---|---|---|
| GET | `/expense-categories` | Any member | — |
| POST | `/expense-categories` | roles: owner, staff; `expense_categories.edit_own` | Yes |
| DELETE | `/expense-categories/:id` | roles: owner, staff | Yes |
| GET | `/expense-categories/:id` | Any member | — |
| PUT | `/expense-categories/:id` | roles: owner, staff | Yes |
| POST | `/expense-categories/:id/archive` | roles: owner, staff | Yes |
| GET | `/expense-categories/:id/history` | Any member | — |
| POST | `/expense-categories/:id/restore` | roles: owner, staff | Yes |

### Expenses — `/expenses`

| Method | Path | Access | Idempotent |
|---|---|---|---|
| GET | `/expenses` | roles: owner, staff, field — Field gets only their own (US-OPS-20) | — |
| POST | `/expenses` | roles: owner, staff, field; `expenses.edit_own` | Yes |
| DELETE | `/expenses/:id` | roles: owner, staff, field | Yes |
| GET | `/expenses/:id` | roles: owner, staff, field — Field only their own, else 404 (US-OPS-20) | — |
| PUT | `/expenses/:id` | roles: owner, staff, field | Yes |
| POST | `/expenses/:id/approve` | roles: owner, staff; `expenses.approve`; never your own unless Owner (US-PUR-20) | Yes |
| POST | `/expenses/:id/bill-to-customer` | roles: owner, staff; `expenses.bill_to_customer` | Yes |
| GET | `/expenses/:id/history` | roles: owner, staff, field — Field only their own, else 404 (US-OPS-20) | — |
| POST | `/expenses/:id/mark-billed` | roles: owner, staff; `expenses.mark_billed` | Yes |
| POST | `/expenses/:id/reject` | roles: owner, staff; `expenses.reject`; never your own unless Owner (US-PUR-20) | Yes |

### Files — `/files`

| Method | Path | Access | Idempotent |
|---|---|---|---|
| POST | `/files` | roles: owner, staff, field | Yes |
| GET | `/files/:id` | Readers of the owning record, else 404 (US-OPS-20, D-117) | — |

### Health — `/health`

| Method | Path | Access | Idempotent |
|---|---|---|---|
| GET | `/health` | Public | — |

### Invoices — `/invoices`

| Method | Path | Access | Idempotent |
|---|---|---|---|
| GET | `/invoices` | roles: owner, staff | — |
| POST | `/invoices` | roles: owner, staff; `invoices.edit_own` | Yes |
| DELETE | `/invoices/:id` | roles: owner, staff | Yes |
| GET | `/invoices/:id` | roles: owner, staff — also returns `paymentStatus`, and `job`, `milestone`, `retention { percent, heldOnJob }` for an invoice raised from a job (US-PAY-13, US-JOB-21) | — |
| PUT | `/invoices/:id` | roles: owner, staff | Yes |
| GET | `/invoices/:id/history` | roles: owner, staff | — |
| POST | `/invoices/:id/issue` | roles: owner, staff; `invoices.issue` | Yes |
| GET | `/invoices/:id/pdf` | roles: owner, staff | — |
| POST | `/invoices/:id/send-email` | roles: owner, staff; `invoices.send` | Yes |
| POST | `/invoices/:id/send-reminder` | roles: owner, staff; `invoices.send_reminder` | Yes |
| POST | `/invoices/:id/void` | roles: owner, staff; `invoices.void` | Yes |
| POST | `/invoices/from-quote/:quoteId` | roles: owner, staff; `invoices.edit_own` | Yes |

### Jobs, milestones, photos, notes, crew, variation orders, costing — `/jobs`

| Method | Path | Access | Idempotent |
|---|---|---|---|
| GET | `/jobs` | Any member; Field only assigned jobs (else 404) and no money fields (US-JOB-19) | — |
| POST | `/jobs` | roles: owner, staff; `jobs.edit_own` | Yes |
| GET | `/jobs/:id` | Any member; Field only assigned jobs (else 404) and no money fields (US-JOB-19) | — |
| PUT | `/jobs/:id` | roles: owner, staff | No |
| GET | `/jobs/:id/assignees` | Any member; Field only assigned jobs (else 404) and no money fields (US-JOB-19) | — |
| POST | `/jobs/:id/assignees` | roles: owner, staff | Yes |
| DELETE | `/jobs/:id/assignees/:userId` | roles: owner, staff | No |
| GET | `/jobs/:id/costing` | roles: owner, staff; `reports.view_job_profitability` (US-JOB-19) | — |
| GET | `/jobs/:id/history` | Any member; Field only assigned jobs (else 404) and no money fields (US-JOB-19) | — |
| GET | `/jobs/:id/milestones` | Any member; Field only assigned jobs (else 404) and no money fields (US-JOB-19) | — |
| PUT | `/jobs/:id/milestones` | roles: owner, staff | No |
| POST | `/jobs/:id/milestones/:milestoneId/complete` | roles: owner, staff, field | Yes |
| GET | `/jobs/:id/milestones/:milestoneId/history` | Any member; Field only assigned jobs (else 404) and no money fields (US-JOB-19) | — |
| POST | `/jobs/:id/milestones/:milestoneId/invoice` | roles: owner, staff; `milestones.invoice` | Yes |
| GET | `/jobs/:id/notes` | Any member; Field only assigned jobs (else 404) and no money fields (US-JOB-19) | — |
| POST | `/jobs/:id/notes` | roles: owner, staff, field; `job_notes.edit_own` | No |
| GET | `/jobs/:id/notes/:noteId/history` | Any member; Field only assigned jobs (else 404) and no money fields (US-JOB-19) | — |
| GET | `/jobs/:id/photos` | Any member; Field only assigned jobs (else 404) and no money fields (US-JOB-19) | — |
| POST | `/jobs/:id/photos` | roles: owner, staff, field; `job_photos.edit_own` | Yes |
| GET | `/jobs/:id/photos/:photoId/history` | Any member; Field only assigned jobs (else 404) and no money fields (US-JOB-19) | — |
| POST | `/jobs/:id/release-retention` | roles: owner, staff; `jobs.release_retention` | Yes |
| GET | `/jobs/:id/variation-orders` | Any member; Field only assigned jobs (else 404) and no money fields (US-JOB-19) | — |
| POST | `/jobs/:id/variation-orders` | roles: owner, staff; `variation_orders.edit_own` | Yes |
| POST | `/jobs/:id/variation-orders/:variationOrderId/apply` | roles: owner, staff; `variation_orders.apply` | Yes |
| POST | `/jobs/from-quote/:quoteId` | roles: owner, staff; `jobs.edit_own` | Yes |
| GET | `/jobs/milestones/due` | roles: owner, staff, field — Field only milestones on assigned jobs (US-JOB-19) | — |

### Leads — `/leads`

| Method | Path | Access | Idempotent |
|---|---|---|---|
| GET | `/leads` | Any member | — |
| POST | `/leads` | roles: owner, staff; `leads.edit_own` | Yes |
| DELETE | `/leads/:id` | roles: owner, staff | Yes |
| GET | `/leads/:id` | Any member | — |
| PUT | `/leads/:id` | roles: owner, staff | Yes |
| GET | `/leads/summary-by-stage` | Any member | — |

### Meetings — `/meetings`

| Method | Path | Access | Idempotent |
|---|---|---|---|
| GET | `/meetings` | Any member | — |
| POST | `/meetings` | roles: owner, staff; `meetings.edit_own` | Yes |
| DELETE | `/meetings/:id` | roles: owner, staff | Yes |
| GET | `/meetings/:id` | Any member | — |
| PUT | `/meetings/:id` | roles: owner, staff | Yes |
| GET | `/meetings/:id/attendees` | Any member | — |
| POST | `/meetings/:id/respond` | roles: owner, staff, field | Yes |
| GET | `/meetings/upcoming` | Any member | — |

### Notifications and push — `/notifications`

| Method | Path | Access | Idempotent |
|---|---|---|---|
| GET | `/notifications` | Any member | — |
| POST | `/notifications/:id/read` | Any member | Yes |
| GET | `/notifications/push/public-key` | Any member | — |
| DELETE | `/notifications/push/subscribe` | Any member | No |
| POST | `/notifications/push/subscribe` | Any member | Yes |
| GET | `/notifications/push/subscriptions` | Any member | — |
| POST | `/notifications/read-all` | Any member | Yes |
| GET | `/notifications/unread-count` | Any member | — |

### Organisation, members, invitations, settings, onboarding, teams — `/org`

| Method | Path | Access | Idempotent |
|---|---|---|---|
| GET | `/org/accounts` | Any member | — |
| POST | `/org/accounts` | roles: owner | Yes |
| PUT | `/org/accounts/:id` | roles: owner | Yes |
| GET | `/org/fiscal-periods` | roles: owner | — |
| POST | `/org/fiscal-periods` | roles: owner | No |
| POST | `/org/fiscal-periods/:id/close` | roles: owner | No |
| POST | `/org/fiscal-periods/:id/reopen` | roles: owner | No |
| GET | `/org/invitations` | roles: owner (US-OPS-20) | — |
| POST | `/org/invitations` | roles: owner | Yes |
| DELETE | `/org/invitations/:id` | roles: owner | Yes |
| POST | `/org/invitations/:id/resend` | roles: owner | Yes |
| GET | `/org/members` | Any member | — |
| PUT | `/org/members/:id/deactivate` | roles: owner | Yes |
| PUT | `/org/members/:id/demote` | roles: owner | Yes |
| PUT | `/org/members/:id/promote` | roles: owner | Yes |
| PUT | `/org/members/:id/reactivate` | roles: owner | Yes |
| GET | `/org/members/:id/teams` | roles: owner | — |
| GET | `/org/members/me` | Any member | — |
| GET | `/org/members/me/capabilities` | Any member | — |
| POST | `/org/members/transfer-primary-owner` | roles: owner | Yes |
| GET | `/org/numbering` | Any member | — |
| PUT | `/org/numbering/:documentType` | roles: owner | Yes |
| GET | `/org/settings` | Any member | — |
| GET | `/org/settings/:key` | Any member | — |
| PUT | `/org/settings/:key` | roles: owner | Yes |
| GET | `/org/tax/default-rate` | Any member | — |
| PUT | `/org/tax/default-rate` | roles: owner | Yes |
| GET | `/org/tax/prices-include-tax` | Any member | — |
| PUT | `/org/tax/prices-include-tax` | roles: owner | Yes |
| GET | `/org/tax/summary` | roles: owner | — |
| GET | `/org/tax/summary/export.csv` | roles: owner — rows by rate with taxable amount and tax, adjustments, total, tax paid, net payable (US-RPT-14) | — |
| GET | `/org/teams` | roles: owner | — |
| POST | `/org/teams` | roles: owner | Yes |
| DELETE | `/org/teams/:id` | roles: owner | No |
| GET | `/org/teams/:id` | roles: owner | — |
| PUT | `/org/teams/:id` | roles: owner | Yes |
| PUT | `/org/teams/:id/members` | roles: owner | Yes |
| PUT | `/org/teams/:id/privileges` | roles: owner | Yes |

### Payments — `/payments`

| Method | Path | Access | Idempotent |
|---|---|---|---|
| GET | `/payments` | roles: owner, staff | — |
| POST | `/payments` | roles: owner, staff; `payments.edit_own` | Yes |
| DELETE | `/payments/:id` | roles: owner, staff | Yes |
| GET | `/payments/:id` | roles: owner, staff | — |
| POST | `/payments/:id/apply-credit` | roles: owner, staff; `payments.apply_credit` | Yes |
| GET | `/payments/:id/history` | roles: owner, staff | — |
| GET | `/payments/:id/pdf` | roles: owner, staff | — |
| POST | `/payments/:id/send-receipt` | roles: owner, staff; `payments.send_receipt` | Yes |
| GET | `/payments/suggest-allocation` | roles: owner, staff | — |

### Public (no session) — `/public`

| Method | Path | Access | Idempotent |
|---|---|---|---|
| GET | `/public/invitations/:id` → 404 for an unknown id; `{ status: "pending", email, role, organizationName }` while usable; `{ status }` only (`expired`, `canceled`, `accepted`, `rejected`) otherwise (US-AUTH-11) | Public | — |
| GET | `/public/quotes/:token` → the quote; 410 `{ status: "expired", message, business: { name, address, email, phone, logoDataUri } }` for a link we issued that has expired, been revoked or replaced; 404 `{ status: "invalid" }` for a token that matches nothing (US-QUO-21) | Public | — |
| POST | `/public/quotes/:token/accept` | Public | No |
| POST | `/public/quotes/:token/reject` | Public | No |

### Quotes — `/quotes`

| Method | Path | Access | Idempotent |
|---|---|---|---|
| GET | `/quotes` | roles: owner, staff | — |
| POST | `/quotes` | roles: owner, staff; `quotes.edit_own` | Yes |
| DELETE | `/quotes/:id` | roles: owner, staff | Yes |
| GET | `/quotes/:id` | roles: owner, staff | — |
| PUT | `/quotes/:id` | roles: owner, staff | Yes |
| POST | `/quotes/:id/accept-in-person` | roles: owner, staff, field; `quotes.accept_in_person` | Yes |
| POST | `/quotes/:id/approve-discount` | roles: owner, staff; `quotes.approve_discount` | Yes |
| GET | `/quotes/:id/history` | roles: owner, staff | — |
| GET | `/quotes/:id/pdf` | roles: owner, staff | — |
| POST | `/quotes/:id/revise` | roles: owner, staff; `quotes.revise` | Yes |
| POST | `/quotes/:id/send` | roles: owner, staff; `quotes.send` | Yes |
| GET | `/quotes/email-queue` | roles: owner, staff | — |

### Reports and ledger — `/reports`

| Method | Path | Access | Idempotent |
|---|---|---|---|
| GET | `/reports/account-drilldown` | roles: owner, staff; `ledger.view` | — |
| GET | `/reports/balance-sheet` | roles: owner | — |
| GET | `/reports/balance-sheet/export.csv` | roles: owner | — |
| GET | `/reports/dashboard-summary` | roles: owner, staff; `reports.view_dashboard_summary` | — |
| GET | `/reports/invoices-due-this-week` | roles: owner, staff; `reports.view_receivables` (US-OPS-20) | — |
| GET | `/reports/job-profitability` | roles: owner, staff; `reports.view_job_profitability` | — |
| GET | `/reports/job-profitability/export.csv` | roles: owner, staff; `reports.view_job_profitability` | — |
| GET | `/reports/payables` | roles: owner, staff; `reports.view_payables` | — |
| GET | `/reports/payables/export.csv` | roles: owner, staff; `reports.view_payables` | — |
| GET | `/reports/profit-and-loss` | roles: owner | — |
| GET | `/reports/profit-and-loss/export.csv` | roles: owner | — |
| GET | `/reports/receivables` | roles: owner, staff; `reports.view_receivables` | — |
| GET | `/reports/receivables/export.csv` | roles: owner, staff; `reports.view_receivables` | — |
| GET | `/reports/revenue-trend` | roles: owner | — |

### Tax groups — `/tax-groups`

| Method | Path | Access | Idempotent |
|---|---|---|---|
| GET | `/tax-groups` | Any member | — |
| POST | `/tax-groups` | roles: owner | Yes |
| DELETE | `/tax-groups/:id` | roles: owner | Yes |
| GET | `/tax-groups/:id` | Any member | — |
| PUT | `/tax-groups/:id` | roles: owner | Yes |
| POST | `/tax-groups/:id/archive` | roles: owner | Yes |
| POST | `/tax-groups/:id/restore` | roles: owner | Yes |

### Tax rates — `/tax-rates`

| Method | Path | Access | Idempotent |
|---|---|---|---|
| GET | `/tax-rates` | Any member | — |
| POST | `/tax-rates` | roles: owner | Yes |
| DELETE | `/tax-rates/:id` | roles: owner | Yes |
| GET | `/tax-rates/:id` | Any member | — |
| PUT | `/tax-rates/:id` | roles: owner | Yes |
| POST | `/tax-rates/:id/archive` | roles: owner | Yes |
| POST | `/tax-rates/:id/restore` | roles: owner | Yes |

### Users (current user, profile) — `/users`

| Method | Path | Access | Idempotent |
|---|---|---|---|
| GET | `/users/me` | Any member | — |
| PUT | `/users/me` | Any member | No |
| GET | `/users/me/dashboard-layout` | Any member | — |
| PUT | `/users/me/dashboard-layout` | Any member | No |
| PUT | `/users/me/meeting-reminder-lead-minutes` | Any member | No |
| PUT | `/users/me/password` | Any member | No |
| PUT | `/users/me/preferences` | Any member | No |

### Vendor bills — `/vendor-bills`

| Method | Path | Access | Idempotent |
|---|---|---|---|
| GET | `/vendor-bills` | roles: owner, staff | — |
| POST | `/vendor-bills` | roles: owner, staff; `vendor_bills.edit_own` | Yes |
| DELETE | `/vendor-bills/:id` | roles: owner, staff | Yes |
| GET | `/vendor-bills/:id` | roles: owner, staff | — |
| PUT | `/vendor-bills/:id` | roles: owner, staff | Yes |
| GET | `/vendor-bills/:id/history` | roles: owner, staff | — |
| POST | `/vendor-bills/:id/record` | roles: owner, staff; `vendor_bills.record` | Yes |
| POST | `/vendor-bills/:id/void` | roles: owner, staff; `vendor_bills.void` | Yes |

### Vendor payments — `/vendor-payments`

| Method | Path | Access | Idempotent |
|---|---|---|---|
| GET | `/vendor-payments` | roles: owner, staff | — |
| POST | `/vendor-payments` | roles: owner, staff; `vendor_payments.edit_own` | Yes |
| DELETE | `/vendor-payments/:id` | roles: owner, staff | Yes |
| GET | `/vendor-payments/:id` | roles: owner, staff | — |
| GET | `/vendor-payments/:id/history` | roles: owner, staff | — |
| GET | `/vendor-payments/suggest-allocation` | roles: owner, staff | — |

## Contract additions from the feature files

Routes the stories add. Each is created by the story named.

| Module | Method | Path | Access | Story |
|---|---|---|---|---|
| AUTH | POST | `/api/auth/request-password-reset` (Better Auth) | Public | US-AUTH-09 |
| AUTH | POST | `/api/auth/reset-password` (Better Auth) | Public (token) | US-AUTH-10 |
| SET | PUT | `/org/settings/business_profile` validates the profile with `businessProfileSchema` (`@spine/shared`): `paymentInstructions` over 600 characters → 400 "Keep this under 600 characters."; other fields are kept as sent | roles: owner | US-INV-16 |
| JOB | — | Job responses (`GET /jobs`, `GET /jobs/:id`, `POST /jobs`, `POST /jobs/from-quote/:quoteId`) gain `number`; an invoice's `job` gains `number`; the repeat-conversion 409's `existing.jobs[]` gains `number` | as the route | US-JOB-22 |
| RPT | GET | `/reports/receivables/export.csv?search=` and `/reports/payables/export.csv?search=` — amounts are plain decimals ("1234.50") with the currency in its own column; `search` keeps rows whose number or contact contains it, ignoring case (the page table's search) | as the JSON report | US-PAY-10, US-PUR-14 |
| OPS | — | `GET /public/quotes/:token` gains `locale` (the business's money locale). Rate limits count per session for signed-in requests and per IP for `@Public` routes (D-124) | — | US-OPS-24 |
| AUTH | GET | `/public/signup-status` → `{ open: boolean, businessName? }` | Public | US-AUTH-08 |
| AUTH | GET | `/public/password-reset/:token` → `{ email }`; 404 when the link is unknown, used or expired. Doesn't consume the token | Public (token) | US-AUTH-10 |
| AUTH | GET | `/public/forgot-password` → 302 to `APP_URL/forgot-password` (the phone app's "Forgot password?") | Public | US-AUTH-09 |
| CRM | GET/PUT | `/org/lead-stages` → `[{ id, name, kind, color, sortOrder, leadCount }]` in board order. PUT `{ stages: [{ id?, name, kind, color? }], moves?: [{ fromStageId, toStageId }] }` replaces the ordered set (`putLeadStagesSchema`): 400 "Up to 12 stages.", "Keep exactly one Won and one Lost stage.", "Won and Lost stay last, with at least one open stage before them.", "Every stage needs a name.", "Give each stage a different name."; Won/Lost can be renamed but not deleted or changed in kind; a deleted stage that still has leads needs a move. Each added, renamed, moved or deleted stage is audited (`lead_stage`) | GET any member; PUT Owner | US-CRM-19, US-CRM-20 |
| CRM | — | Lead responses (`GET /leads`, `GET /leads/:id`, `GET /contacts/:id/leads`, create, update) carry `stageId`, `stageName` and `stageKind` instead of `stage`; create/update take `stageId` (another organisation's stage → 400 "Choose one of your pipeline stages."; omitted on create → the first open stage); `GET /leads?stageId=`; `GET /leads/summary-by-stage` → `[{ stageId, name, kind, color, count, totalValue }]` per stage in board order | as the route | US-CRM-19 |
| QUO | — | `POST /quotes/:id/accept-in-person` gains `signerName` (required) and stores `signatureFileId` | `quotes.accept_in_person` | US-QUO-19 |
| RPT | GET | `/reports/trial-balance?asOf=&includeZero=` and `/reports/trial-balance/export.csv` (lines: accountId, code, name, debit, credit; totalDebit, totalCredit, balanced) | roles: owner | US-RPT-13 |
| RPT | — | Existing `GET /org/tax/summary` (roles: owner) is now shown on Reports instead of Settings; no route change | roles: owner | US-RPT-14 |
| SET | GET/PUT | `/org/settings/branding` (generic settings route, new key). PUT validates with `brandingSchema` (`@spine/shared`): `themePreset` outside `spine-blue`/`harbour-teal`/`plum`/`graphite` → 400 "Choose one of the listed themes."; `documentColor` not `#RRGGBB` → 400 "Enter a colour as # and six hex digits, e.g. #2954E5.", below 4.5:1 on white → 400 "Too light to read on white (<ratio>). Pick a darker colour — documents need at least 4.5:1."; `documentFooter` over 300 characters → 400 "Keep the footer under 300 characters."; other fields are kept as sent. New and draft quote, invoice, credit-note and receipt PDFs and every customer email use the colour and footer; issued documents keep their stored PDF (US-INV-17) | GET any member; PUT Owner | US-SET-09, US-SET-10 |
| SET | GET | `/org/audit-log?from=&to=&userId=&entityType=&action=&cursor=` and `/org/audit-log.csv` | roles: owner | US-SET-11, US-SET-12 |
| OPS | GET | `/health/ready` (database and queue reachable) | Public | US-OPS-05 |
| OPS | GET | `/org/update-status` → `{ current, latest?, checkedAt? }` | roles: owner | US-OPS-06 |
| MOB | GET | `/jobs?assignedToMe=true` (exists) — documented as the mobile home feed | Any member | US-MOB-03 |
| MOB | GET | `/expenses?mine=true` (exists) — documented as the mobile expenses feed | Any member | US-MOB-12 |
| JOB | — | `GET /jobs`, `GET /jobs/:id`, `/jobs/:id/milestones`, `/photos`, `/notes`, `GET /jobs/milestones/due`: Field is forced to assigned jobs (404 otherwise) and money fields are omitted | Any member (service-scoped) | US-JOB-19 |
| JOB | — | `GET /jobs/:id/costing` gains `@RequireCapability("reports.view_job_profitability")` | `reports.view_job_profitability` | US-JOB-19 |
| JOB | GET | `/jobs/:id/quotes` → quotes to present (variation-order quotes on the job and the job's source quote, while `sent`) | Any member; Field only on assigned jobs | US-MOB-05, US-MOB-16 |
| QUO | — | `GET /quotes/:id` readable by Field for quotes returned by `/jobs/:id/quotes` on an assigned job | Field (service-scoped) | US-MOB-16 |
| QUO | POST | `/quotes/:id/reject-in-person` `{ comment? }` → status `rejected`, `acceptance_method: "in_person"`, notifies `quote_rejected` | `quotes.accept_in_person` | US-MOB-16 |
| JOB | — | `POST /jobs/:id/milestones/:milestoneId/complete` on an already-completed milestone returns 200 `{ alreadyCompleted: true }` and changes nothing | `milestones.edit_*` (Field always) | US-MOB-15 |
| JOB | — | `PUT /jobs/:id/milestones` ownership is the job's creator | `milestones.edit_own`/`edit_others` | US-JOB-20 |
| PAY | — | `POST /payments` accepts allocations to advance invoices; that portion posts Dr Bank / Cr 2200 | `payments.edit_own` | US-PAY-13 |
| OPS | — | `GET /org/invitations`, `POST /demo-data/seed`, `DELETE /demo-data` become `@OrgRoles(["owner"])` | roles: owner | US-OPS-20 |
| OPS | — | `GET /files/:id` authorises against the owning record (404 otherwise); signed URLs expire within 5 minutes | Readers of the owning record | US-OPS-20 |
| OPS | — | `GET /reports/invoices-due-this-week` gains `@RequireCapability("reports.view_receivables")` | `reports.view_receivables` | US-OPS-20 |
| OPS | — | The 14 non-idempotent mutating routes gain `IdempotencyInterceptor`; keys scoped per user | as today | US-OPS-08 |
| DASH | — | `GET /dashboard/checklist` returns `{ visible: false }` to Staff and Field | Any member | US-ONB-12 |
| DASH | GET | `/dashboard/attention` → `{ kind, count, first }[]`, capability-filtered | Any member | US-DASH-12 |
| DASH | GET | `/dashboard/kpis` → `{ key, value, previous, series[] }[]` for the KPIs the caller may see | Any member (per-KPI capability) | US-DASH-14 |
| DASH | GET | `/reports/money-in-out?months=3\|6\|12` | `reports.view_dashboard_summary` | US-DASH-15 |
| DASH | — | `GET /activities/overdue` gains `includeToday=true`; `GET /dashboard/activity` gains `actor` and `groupCount` | as today | US-DASH-16, US-DASH-19 |
| QUO | POST | `/quotes/:id/duplicate` → the new draft: same contact, lines (their snapshot prices and tax), notes and terms; no number, `parentQuoteId` null, version 1, valid until today plus the original's validity period (30 days when it had none); audited as `duplicated` with `duplicatedFrom` | `quotes.edit_own` | US-QUO-24 |
| QUO | POST | `/quotes/:id/resend` ("Email again") → queues the quote email again with a fresh public link (earlier links keep working); `emailStatus` back to `pending`; only `sent` quotes (else 400 "Only a sent quote can be emailed again.") | `quotes.send` | US-QUO-24 |
| CAT | GET/POST | `/catalog-bundles` (`?includeArchived=true`, `?currency=`) → bundles with their lines; POST `{ name, description?, sourceQuoteId }` copies the quote's lines (400 "Give the bundle a name.", "This quote has no item lines to save as a bundle."); GET/PUT/DELETE `/catalog-bundles/:id` (PUT renames/re-describes only); POST `/catalog-bundles/:id/archive`, `/restore`. Audited as `catalog_bundle` | GET any member; create `catalog.edit_own`; rename `catalog.edit_own`/`edit_others`; archive/restore/delete `catalog.delete_own`/`delete_others` (by creator) | US-QUO-25, US-QUO-26 |
| INV | GET/PUT | `/org/settings/invoice_reminders` (generic settings route, new key). PUT validates with `invoiceRemindersSchema`: on with no day ticked → 400 "Pick at least one reminder."; `sendAt` is `HH:MM` | GET any member; PUT Owner | US-INV-18 |
| INV | GET | `/invoice-reminders/preview` → `{ subject, html, sample }`: the reminder email the most overdue unpaid invoice would get today (logo inlined), or a sample when nothing is overdue | roles: owner | US-INV-18 |
| INV | — | `PUT /contacts/:id` accepts `remindersPaused` (boolean; contacts return it) | `contacts.edit_*` | US-INV-19 |
| INV | — | Queue `invoice-reminder-run` fires every 15 minutes; per organisation with reminders on, once the organisation time passes "Send at" and the day hasn't run, it records one `invoice_reminders` row (`auto`) per issued invoice with a balance whose due date is a scheduled number of days away (contacts with `remindersPaused` skipped; an invoice already reminded that day skipped), audits `automatic_reminder_sent` (no actor) and queues `invoice-send-email` with `{ isReminder: true, daysOverdue }`. `POST /invoices/:id/send-reminder` records a `manual` row for the day | System | US-INV-19 |
| INV | GET/POST | `/recurring-invoices`; GET/PUT `/recurring-invoices/:id` (US-INV-20); DELETE `/recurring-invoices/:id` (invoices it created are kept, their `recurring_invoice_id` cleared), POST `/recurring-invoices/:id/pause` (`active` only, else 400 "Only an active schedule can be paused."; clears `nextRunOn`), `/resume` (`paused` only, else 400 "Only a paused schedule can be resumed."; `nextRunOn` = the next occurrence after today, missed dates not back-filled, or `finished` if its end has passed) (US-INV-22). PUT replaces the schedule and lines; invoices already created don't change. Body validated by `createRecurringInvoiceSchema` (`name`, `contactId`, `currency`, `frequency`, `dayRule`, `startsOn`, `endsOn?`, `maxCount?`, `dueDays`, `mode`, `lines` — at least one item line). 400 "Pick today or a later start date." (organisation time; an edit may keep a start date already passed), "Pick an end date after the start date.", "Add at least one line.", "This schedule ends before its next invoice. Pick a later end date.". Responses carry `contactName`, `status`, `nextRunOn`, `createdCount`, `totalAmount` and the lines. Every route, reads included, needs the capability | `invoices.manage_recurring` (Owner, or Staff whose Team grants it; never Field) | US-INV-20–22 |
| INV | — | Queue `recurring-invoice-run` fires every 15 minutes and, from 6:00 AM organisation time, runs every `active` schedule whose `next_run_on` ≤ today: creates one invoice from its lines (tax resolved then; issue date today, due `due_days` later) through `InvoicesService.create` with (`recurring_invoice_id`, `recurring_run_on` = the schedule date) — a unique-index clash means it already exists. `issue_and_email` then issues (number, ledger posting) and emails it like a manual issue; `draft` notifies Owners (`recurring_invoice_draft`). The schedule then moves to the next date after today (a missed run catches up once, nothing is back-filled), `created_count` is recounted, and it becomes `finished` (`next_run_on` null) once `ends_on` or `max_count` is reached. Actor: the schedule's creator, else the Primary Owner | System | US-INV-21 |
| INV | POST | `/invoices/bulk/send-reminders { ids }` (1–100 uuids, else 400 "Select 100 or fewer invoices."; `bulkInvoiceIdsSchema`) → `BulkResult` `{ done: id[], skipped: [{ id, label (number), reason }] }`. Eligible: issued, balance > 0, not reminded today, customer has an email (overdue not required). Reasons: "It's a draft — issue it first.", "It's void.", "Nothing is owed on it.", "Already reminded today.", "The customer has no email address.", "Not found.". Each one sent records a `manual` `invoice_reminders` row and audits `reminder_queued`. `GET /invoices` rows gain `lastReminderOn` and `remindedToday` | `invoices.send_reminder` | US-INV-23 |
| INV | POST | `/invoices/bulk/pdf { ids }` (1–100, else 400 "Select 100 or fewer invoices.") → 200 `application/zip`, `Content-Disposition: attachment; filename="invoices-<date>.zip"` (organisation date), one `<number>.pdf` per invoice — the stored PDF (US-INV-17), stored first if needed. Drafts (and unknown ids) are skipped and listed in the `X-Spine-Skipped` header (URI-encoded JSON of `BulkResult.skipped`, exposed to the browser). Only drafts → 400 "None of these invoices has a PDF yet — drafts are skipped. Issue them first." A read: no Idempotency-Key replay | Owner, Staff (reads are open, like `GET /invoices/:id/pdf`) | US-INV-24 |
| PAY | GET | `/contacts/:id/statement?from=&to=&mode=open\|all` → `Statement` (`statementQuerySchema`: `YYYY-MM-DD` dates, `from` ≤ `to`): `openingBalance` (the customer's 1100 AR lines before `from`), `invoiced` / `paidAndCredited` (AR debits / credits in the period), `balanceDue` (AR at `to`; open mode: the open invoices' balances), `rows` (`date`, `reference`, `type`, `charges`, `payments`, running `balance` — all activity: one row per AR journal entry; open mode: each open invoice then the payments and credit notes against it), `aging`, `hasInvoices`. `/contacts/:id/statement.pdf` (same query) → `attachment; filename="statement-<customer>-<to>.pdf"`. POST `/contacts/:id/statement/send { from, to, mode, email, message? }` (`sendStatementSchema`, idempotent) → `{ sentTo }`: emails the PDF, logs a done `note` activity "Statement sent to <email> for <period>. Balance due <amount>." and audits `statement_sent` on the contact. 400 "No invoices for this customer yet."; 503 "Email isn't set up yet…" when SMTP isn't configured. Money paid on account that isn't allocated sits outside AR, so it doesn't appear | `reports.view_receivables` (Owner, or Staff by Team; never Field) | US-PAY-14, US-PAY-15 |
| PUR | POST | `/expenses/bulk/approve { ids }`, `/expenses/bulk/reject { ids, comment }` | `expenses.approve` / `expenses.reject` | US-PUR-21 |
| NTF | PUT | `/users/me/notification-preferences { digestEnabled, digestTime, digestDays }` | Self | US-NTF-14 |
| SET | POST/GET | `/org/exports`; GET `/org/exports/:id/download` | roles: owner | US-SET-15, US-SET-16 |
| OPS | GET | `/search?q=&limit=5` | Any member (results filtered by each module's read rules) | US-OPS-22 |
| JOB | — | `PUT /jobs/:id` accepts `costBudgetAmount` (minor units, nullable, ≥ 0; else 400 "Enter a budget of zero or more.") and `percentComplete` (0–100, nullable; else 400 "Enter a percentage from 0 to 100."); `GET /jobs`, `GET /jobs/:id` return both (Field: no `costBudgetAmount`) | `jobs.edit_own`/`edit_others` to change | US-JOB-24, US-JOB-28 |
| JOB | — | `GET /jobs/:id/costing` gains `budget { amount, spent, remaining, usedPct, state: none\|ok\|near\|over }`, `byCategory [{ accountId, code, name, amount, sharePct }]` and `billing { contractValue, billedToDate, billedPct, leftToBill, percentComplete, gapPts }`, all from `journal_lines` | `reports.view_job_profitability` | US-JOB-25–28 |
| JOB | GET | `/jobs?include=costing` adds `billedPct`, `budgetUsedPct`, `budgetState` per job, only for callers with the capability (omitted otherwise, never 403) | Any member; fields need `reports.view_job_profitability` | US-JOB-25, US-JOB-27 |
| JOB | — | Invoice responses and the issued PDF gain `progressClaimNo` (progress invoices, set at issue) | as the route | US-JOB-29 |
| DASH | — | `GET /dashboard/attention` gains kind `job_over_budget` | `reports.view_job_profitability` | US-JOB-25 |
| DASH | GET | `/dashboard/retention` → `{ total, jobCount, jobs: [{ id, number, name, held }] }` from `journal_lines` on 1150 | `reports.view_receivables` | US-DASH-20 |
| PUR | — | `GET /vendor-bills?jobId=` and `GET /expenses?jobId=` | as the list route | US-PUR-22 |
| PUR | — | `POST/PUT /expenses` accept `entryMode: amount\|labour` and `labourLines [{ trade, headcount, dayRateAmount }]` (1–20; the server computes `amount`; a mismatching client amount → 400; labour without `jobId` → 400 "Labour is always for a job — choose one.") | `expenses.edit_own` (Field always for own) | US-PUR-23 |
| PUR | GET | `/expenses/labour-trades?q=` → `[{ trade, lastDayRateAmount }]` | Readers of expenses | US-PUR-23 |
| ONB | — | `PUT /org/settings/industry_template` with `construction` seeds accounts and expense categories in the same transaction; response gains `seeded { accounts, categories, kept }` | roles: owner | US-ONB-13 |
| RPT | — | `GET /reports/job-profitability?status=` rows and `export.csv` gain `billedToDate`, `billedPct`, `costBudget`, `budgetUsedPct` | `reports.view_job_profitability` | US-RPT-15 |

| OPS | — | `GET /files/:id`: `local` driver streams (with `ETag`, range); `s3` driver redirects to a presigned URL; session-less links use `?sig=&exp=` signed with `AUTH_SECRET` (≤ 5 min); damaged or missing file → 409 "This file is damaged. Restore it from your latest backup." (streamed files are verified on every read; presigned `s3` files are verified by the weekly check and refused once flagged) | Readers of the owning record | US-OPS-27, US-OPS-28 |
| OPS | GET | `/files/integrity` → `{ problemCount, message, files: [{ id, problem, label }] }` — files whose last check failed, labelled by the record they belong to | roles: owner | US-OPS-28 |
| OPS | — | `POST /files`: 415 for disallowed types; GPS EXIF stripped; disk full → 507 "There's no space left to store this file. Ask an owner to free up space." | as today | US-OPS-29, US-OPS-31 |
| OPS | — | `GET /health/ready` adds `storage: { driver, usedPercent }` (`usedPercent` null for `s3`; measured with `statfs` at most every 15 minutes). Built with this field only; the database and queue checks arrive with US-OPS-05 | Public | US-OPS-31 |
| SITE | GET | `/help/*` on the **web** app (not the API): the bundled user guide and self-hosting guide for the installed version, static files | Public (no login) | US-SITE-12 |
| SITE | — | The API's OpenAPI document is exported to `apps/api/openapi.json` at build time for the site's API reference | — | US-SITE-10 |
### Events added by the feature files

| Type | Recipients | Text | Story |
|---|---|---|---|
| `ledger_out_of_balance` | Owners | "Your books are out of balance by <amount>." | US-RPT-12 |
| `quote_accepted` (in person) | Readers of quotes | "Quote <number> was accepted in person." (exists) | US-MOB-17 |
| `quote_rejected` (in person) | Readers of quotes | "Quote <number> was declined in person." | US-MOB-16 |
| `recurring_invoice_draft` | Owners | "Recurring invoice ready to review: <name>" | US-INV-21 |
| `files_damaged` | Owners | "<n> stored files are damaged or missing — restore from your latest backup." | US-OPS-28 |
| `data_export_ready` | The Owner who asked | Email "Your Spine data export is ready" linking to Settings › Data export | US-SET-15 |

Queues added: `file-integrity-check` (weekly), `invoice-reminder-run` (every 15 min, runs each organisation's day once after "Send at"), `recurring-invoice-run` (every 15 min, from 6:00 AM organisation time), `daily-digest` (every 15 min), `data-export`, `store-issued-pdf`.

`GET /quotes/:id/pdf`, `/invoices/:id/pdf`, `/credit-notes/:id/pdf` and `/payments/:id/pdf` render live for a draft and, once the document is sent or issued, always serve the PDF stored at that moment (stored by `store-issued-pdf`, or on the first download for documents issued before US-INV-17). Email jobs attach the same stored file.
