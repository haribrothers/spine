# Spine — Product Requirements Document

**Version:** 0.2 (draft)
**Status:** For review
**Working name:** *Spine* — placeholder. One find-and-replace changes it across repo, packages and Docker images.
**Proposed licence:** AGPL-3.0 (see §10.9 — open decision)

---

## 1. Overview

### 1.1 Problem

Small businesses run their money on a patchwork: contacts in WhatsApp, quotes in Excel, invoices in Word, and a shoebox of receipts handed to an accountant once a year. Nothing connects. The owner cannot answer three basic questions without a phone call and a calculator:

- Who owes me money, and for how long?
- Did this job actually make a profit?
- What did I earn and spend last quarter?

### 1.2 Why not the existing tools

| Tool | Why it doesn't fit |
|---|---|
| Zoho One | Per-user monthly cost that scales badly for a 5-person firm; each module is a separate app with its own learning curve |
| Odoo | Powerful and open source, but the mental model is ERP-shaped. Setup requires a consultant. Community edition drops the modules small businesses actually need |
| QuickBooks / Xero | Accounting-first. The owner has to think in accounting terms from minute one |
| Spreadsheets | Free and simple, but no audit trail, no linkage, no mobile, breaks at the first partial payment |

### 1.3 Vision

One self-hosted application that follows a small business's actual workflow — **enquiry → quote → job → invoice → payment → books** — where correct double-entry accounting happens invisibly underneath, and the owner never sees a debit or a credit unless they go looking.

### 1.4 Target users

Service and project-based small businesses with 1–20 people: construction and interiors, fabrication, electrical and plumbing contractors, AMC and maintenance firms, design studios, small manufacturers. The reference implementation is a facades and interiors contractor, so construction billing patterns are first-class in v1.

### 1.5 Non-goals for v1

Explicitly out of scope, and it matters that they stay out:

- Multi-tenant SaaS hosting — one instance serves one business
- Payroll, HR, attendance
- Inventory with stock valuation, warehouses, or manufacturing
- Marketing automation, email campaigns, lead scoring
- Country-specific statutory filing (GST returns, VAT returns, e-invoicing IRN)
- Customer self-service portal with accounts
- Multi-currency
- Bank feed / bank statement auto-import
- Native desktop app

Several of these are good v2 candidates. None are needed to make the product useful.

---

## 2. Personas & Roles

| Persona | Reality | Primary jobs |
|---|---|---|
| **Owner** | Runs the business, approves everything, is the person feeling the pain today | Sees pipeline, approves quotes and discounts, checks who owes money, reads P&L |
| **Office staff** | Admin/accounts person, may be part-time | Creates contacts, quotes and invoices, records payments and expenses, chases receivables |
| **Field crew** | On site, on a phone, often with poor signal | Captures site photos, submits expenses, marks milestones complete, gets a customer's signature on a quote |
| **Customer** | External, no account | Opens a link, reads the quote, accepts or rejects it |

### 2.1 Permission model

Four roles in v1, enforced server-side. Role is per-user, per-organisation.

| Capability | Owner | Staff | Field | Customer (link) |
|---|:---:|:---:|:---:|:---:|
| View dashboard & reports | ✅ | Partial | ❌ | ❌ |
| Manage contacts & catalogue | ✅ | ✅ | View | ❌ |
| Create/edit quotes | ✅ | ✅ | ❌ | ❌ |
| Approve quote above discount threshold | ✅ | ❌ | ❌ | ❌ |
| Create invoices, record payments | ✅ | ✅ | ❌ | ❌ |
| Submit expense | ✅ | ✅ | ✅ | ❌ |
| Approve expense | ✅ | ✅ | ❌ | ❌ |
| Upload site photos, update milestone status | ✅ | ✅ | ✅ | ❌ |
| View ledger / journals | ✅ | ❌ | ❌ | ❌ |
| Manage users, settings, tax rules | ✅ | ❌ | ❌ | ❌ |
| View & accept a specific quote | — | — | — | ✅ |

"Partial" for staff means: receivables and their own activity, not P&L or balance sheet. Owners can widen this per-user later; v1 keeps it fixed to avoid a permissions UI.

---

## 3. Product Principles

These are the tie-breakers when a design decision is contested.

1. **Accounting is an output, not an input.** The user records business events. The system derives the books. No user ever types a journal entry in v1.
2. **Simple by default, capable underneath.** Every screen opens in its simplest state. Advanced fields (retention %, tax overrides, account mapping) live behind a disclosure, not on the main form.
3. **No mandatory SaaS.** A stranger with Docker and no accounts anywhere must get a working system. Every external service is optional or swappable.
4. **One command to install, one command to back up.** If self-hosting is hard, the product has failed regardless of features.
5. **Nothing financial is ever deleted.** Corrections happen through reversals and credit notes, leaving an audit trail.
6. **Mobile is for the field, not for the office.** Resist parity. The phone does five things well.

---

## 4. Scope

### 4.1 In scope for v1

CRM & contacts · product/service catalogue · quotes with versioning and public acceptance · jobs with milestones · invoicing including progress billing, advances and retention · payments and allocation · credit notes · vendors, bills and expenses · configurable tax · hidden double-entry ledger · core reports · users and roles · audit log · mobile field companion with offline capture · Docker deployment · backup/restore.

### 4.2 Deferred

Bank reconciliation · recurring invoices · purchase orders · timesheets · inventory · statutory filing · customer portal · multi-currency · advanced permissions · plugin/extension API · public REST API for third parties.

---

## 5. Tech Stack

Recorded with rationale so contributors don't relitigate settled choices.

| Layer | Choice | Rationale |
|---|---|---|
| Web | Next.js (App Router), TypeScript | Server components reduce client bundle; a self-hosted app is often on modest hardware |
| Styling | Tailwind CSS v4 (`@theme`) | CSS-native theming, no config file, easy white-labelling for self-hosters |
| Components | Radix UI primitives + custom wrappers, assembled into an in-house `@spine/ui` library | Accessible by default, unstyled, no dependency on a component library's release cadence. Owning the library (not just a folder of one-off wrappers) is what makes theming and dark/light mode consistent across every screen instead of re-solved per component |
| Icons | Lucide | Consistent, tree-shakeable, MIT |
| Mobile | React Native via Expo | Managed workflow, OTA updates, single codebase for iOS + Android |
| API | NestJS, **REST + OpenAPI** | Two known clients, not a public API. OpenAPI generates typed SDKs for web and mobile for free. Avoids per-field authorisation and N+1 complexity of GraphQL |
| Database | PostgreSQL 16 | Non-negotiable for financial data — transactions, constraints, `numeric`, row-level locking |
| ORM | Drizzle | SQL-first, transparent migrations. An accounting schema needs migrations you can read |
| Auth | Better Auth | Self-hostable, TypeScript, Postgres-backed. Cookie sessions for web, JWT for mobile. No vendor |
| Jobs | pg-boss | Postgres-backed queue — no Redis container. Three services instead of four matters on an office PC |
| Files | S3 driver, MinIO default | Site photos and PDFs. Self-hosters get MinIO; anyone can point at S3/R2 |
| Email | Nodemailer (SMTP) with pluggable drivers; Resend as one driver | SMTP-first keeps the product dependency-free |
| PDF | React-PDF or Puppeteer-lite renderer | Quotes and invoices must produce identical PDFs on every install |
| Reverse proxy | Caddy | Automatic HTTPS with zero config |
| Remote access | Cloudflare Tunnel (optional) | Gives a local-server install a public URL for quote links without port forwarding |
| Monorepo | Turborepo + pnpm | Matches existing tooling preferences |
| Container | Docker Compose | Target is a single-host deploy, not Kubernetes |

### 5.1 Stack changes from the original preference list

- **GraphQL dropped** in favour of REST + OpenAPI (see rationale above).
- **Resend demoted** from a stack component to an optional driver, because open-source self-hosters won't have a key.
- **Cloudflare demoted** to optional, for the same reason.
- **Better Auth, pg-boss, MinIO, Caddy and Drizzle added** — the original list had a gap where auth, background jobs, file storage and migrations should be.

---

## 6. Architecture

### 6.1 Topology

```
                    ┌──────────────┐
   Browser ────────▶│              │
                    │    Caddy     │──▶ web (Next.js :3000)
   Mobile  ────────▶│  (TLS, proxy)│──▶ api (NestJS :4000)
                    │              │
   Customer ───────▶│              │
   (quote link)     └──────────────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
        PostgreSQL       MinIO      SMTP (external)
        (data + jobs)   (files)
```

Optional: Cloudflare Tunnel sidecar for installs behind NAT.

### 6.2 Request flow

Web uses Next.js Server Components calling the API server-side with the session cookie forwarded. Mobile uses the generated SDK with a JWT. Public quote links hit an unauthenticated endpoint scoped by a signed, expiring token — no session, no account.

### 6.3 The ledger layer

The central architectural decision. Every business event flows through one path:

```
Business event  →  Domain service  →  Posting rule  →  Journal entry (balanced)
(invoice issued)   (InvoiceService)   (invoice.issued)   Dr AR / Cr Revenue / Cr Tax
```

Rules:

- Journal entries are written **in the same database transaction** as the business document. Either both land or neither does.
- A journal entry is immutable once written. Corrections post a reversing entry.
- Every journal entry references its source document (`source_type`, `source_id`) so any report figure can be traced back.
- A database constraint enforces that the sum of debits equals the sum of credits per entry.
- Posting rules live in one module. Adding a new document type means adding a rule, not scattering ledger code.

### 6.4 Money handling

- All monetary values stored as **integer minor units** (`bigint`) plus a currency code. No floats, ever.
- Rounding happens once, at line level, using half-up. Document totals are the sum of rounded lines, never a rounded sum.
- Tax computed per line, not per document.
- Quantities and percentages use `numeric`, not integers.

### 6.5 Document numbering

- Sequences are per-organisation, per-document-type, configurable prefix and padding (`INV-2026-0001`).
- Numbers are allocated inside the issuing transaction using a row lock on the sequence table, so they are gapless.
- Draft documents have no number. Numbers are assigned at issue and never change.

### 6.6 Offline model (mobile)

Deliberately not full bidirectional sync — that is a multi-month problem.

- **Read:** cached last-known lists (assigned jobs, contacts, catalogue) in SQLite, refreshed on connect.
- **Write:** an **outbox queue**. Photo uploads, expense submissions and milestone updates are queued locally with a client-generated UUID, then replayed on reconnect.
- **Idempotency:** every mutating endpoint accepts an `Idempotency-Key`. Replays are safe.
- **Conflict:** last-write-wins for status updates; appends (photos, expenses) never conflict.
- No offline quote or invoice creation. Financial documents require connectivity.

### 6.7 Monorepo layout

```
spine/
├─ apps/
│  ├─ api/                 # NestJS
│  │  └─ src/modules/      # auth, org, users, contacts, catalog,
│  │                       # quotes, jobs, invoices, payments,
│  │                       # purchases, expenses, ledger, reports,
│  │                       # tax, numbering, files, notifications, audit
│  ├─ web/                 # Next.js
│  └─ mobile/              # Expo
├─ packages/
│  ├─ sdk/                 # generated from OpenAPI
│  ├─ shared/              # money, tax engine, zod schemas, shared types
│  ├─ ui/                  # @spine/ui — Radix + Tailwind component
│  │                       # library: primitives, theme tokens,
│  │                       # dark/light mode, Storybook
│  └─ config/              # eslint, tsconfig, tailwind presets
├─ docker/
│  ├─ Dockerfile.api
│  ├─ Dockerfile.web
│  └─ Caddyfile
├─ docs/                   # install, upgrade, backup, contributing
├─ scripts/                # install.sh, backup.sh, restore.sh, seed.ts
├─ docker-compose.yml
├─ .env.example
└─ turbo.json
```

### 6.8 Configuration

Single `.env`. Required: `DATABASE_URL`, `AUTH_SECRET`, `APP_URL`. Optional with sane defaults: SMTP block, S3 block, `CURRENCY`, `LOCALE`, `TZ`, VAPID keypair (§S-10.12, browser push). The app must boot and be usable with only the three required variables — email, file upload, and browser push all degrade gracefully rather than crashing.

---

## 7. Data Model

Core entities. Every table carries `id (uuid)`, `org_id`, `created_at`, `updated_at`, `created_by`.

**Identity & org**
`organisations` · `users` · `memberships (user, org, role)` · `sessions` · `settings` · `number_sequences` · `audit_log`

**CRM**
`contacts (type: customer|vendor|both, name, is_company)` · `contact_persons` · `addresses` · `leads (stage, value, source, owner)` · `activities (call|meeting|note|task, due_at, done_at)`

**Catalogue**
`items (sku, name, type: goods|service, unit, default_price, tax_rate_id, income_account_id, expense_account_id)` · `units` · `price_lists` *(v2)*

**Tax**
`tax_rates (name, rate, is_compound, inclusive_default)` · `tax_groups` · `tax_group_rates`

**Sales**
`quotes (contact_id, job_id?, status, valid_until, version, parent_quote_id, public_token, subtotal, tax_total, total)` · `quote_lines` · `quote_events (sent|viewed|accepted|rejected, ip, at)`

**Jobs**
`jobs (contact_id, name, site_address, status, start_date, end_date, contract_value, retention_pct)` · `milestones (name, sequence, amount_type: fixed|percent, amount, status, due_date)` · `job_photos` · `job_notes`

**Billing**
`invoices (contact_id, job_id?, type: standard|progress|advance, status, issue_date, due_date, subtotal, tax_total, retention_amount, total, amount_paid)` · `invoice_lines` · `credit_notes` · `credit_note_lines` · `payments (contact_id, date, method, amount, reference)` · `payment_allocations (payment_id, invoice_id, amount)`

**Purchases**
`vendor_bills (contact_id, job_id?, bill_number, date, due_date, totals)` · `vendor_bill_lines` · `expenses (job_id?, category_id, amount, tax_amount, paid_by, status, receipt_file_id)` · `expense_categories` · `vendor_payments` · `vendor_payment_allocations`

**Ledger**
`accounts (code, name, type: asset|liability|equity|income|expense, parent_id, is_system)` · `journal_entries (date, narration, source_type, source_id, reversed_by_id)` · `journal_lines (entry_id, account_id, debit, credit, contact_id?, job_id?)` · `fiscal_periods (start, end, is_closed)`

**Files**
`files (key, mime, size, uploaded_by, entity_type, entity_id)`

### 7.1 Key relationships

- A **job** is optional on quotes, invoices, bills and expenses. When present it enables job costing — the single most valuable report for a contractor.
- **Journal lines** carry optional `contact_id` and `job_id`, which is what makes AR aging and job profitability derivable from the ledger rather than from a parallel calculation.
- **Quote versioning** uses `parent_quote_id`. Revising a sent quote creates v2 and supersedes v1 rather than editing it.

### 7.2 Posting rules

| Event | Debit | Credit |
|---|---|---|
| Invoice issued | Accounts Receivable | Revenue, Tax Payable |
| Invoice with retention | AR (net), Retention Receivable | Revenue, Tax Payable |
| Payment received | Bank/Cash | Accounts Receivable |
| Advance received | Bank/Cash | Customer Advances |
| Advance applied to invoice | Customer Advances | Accounts Receivable |
| Credit note issued | Revenue, Tax Payable | Accounts Receivable |
| Vendor bill recorded | Expense/COGS, Input Tax | Accounts Payable |
| Vendor paid | Accounts Payable | Bank/Cash |
| Expense paid directly | Expense | Bank/Cash |
| Retention released | Bank/Cash | Retention Receivable |

---

## 8. Functional Requirements

Grouped by module. `MUST` = v1 blocking, `SHOULD` = v1 target, `MAY` = opportunistic.

**F0 UI Component Library**
MUST provide a shared, themeable component library (`@spine/ui`) built on Radix UI primitives and Tailwind CSS, consumed by both web and (where applicable, via NativeWind or a shared token layer) mobile. MUST support light and dark mode with a user-level and organisation-level default, switchable at runtime with no page reload. MUST expose theming as CSS custom properties (colour, radius, spacing, typography scale) so a self-hoster can reskin the app by overriding tokens, not by editing component code. MUST ship the full set of components the product needs: button, input, select, combobox, date picker, textarea, checkbox, radio, switch, form field + validation message, table (sortable, paginated), data list, card, dialog/modal, drawer/sheet, dropdown menu, tabs, badge/status chip, avatar, tooltip, popover, toast/notification, breadcrumb, pagination, empty state, skeleton/loading state, stat/metric card, and a currency/money input that respects minor-unit precision. MUST document every component with usage examples (Storybook or equivalent) so contributors don't reverse-engineer props from source. SHOULD support a small set of pre-built theme presets in addition to the default, so branding (§S-10.4) is a preset swap plus a logo, not custom CSS. SHOULD respect OS-level dark/light preference on first load. MUST meet the WCAG 2.1 AA targets in §10.8 at the component level, so accessibility is inherited by every screen automatically rather than re-verified per feature.

**F1 Contacts & CRM**
MUST store companies and individuals, mark a contact as customer, vendor or both, hold multiple contact persons and addresses. MUST track leads through configurable stages with an estimated value. MUST log activities against a contact or lead. SHOULD show a unified timeline per contact (quotes, invoices, payments, activities). MAY import contacts from CSV.

**F2 Catalogue**
MUST store goods and services with unit, default price and default tax rate. MUST allow line-level price override on documents. SHOULD support a per-item default income and expense account. MAY support item categories.

**F3 Quotes**
MUST create multi-line quotes with per-line quantity, price, discount and tax. MUST render a branded PDF. MUST send by email with a public link. MUST support versioning with supersession. MUST record view/accept/reject events with timestamp. MUST convert an accepted quote to a job and/or invoice without re-entry. SHOULD support a discount threshold requiring owner approval. SHOULD support terms & conditions blocks. MAY support optional line items the customer can toggle.

**F4 Jobs & milestones**
MUST create a job from an accepted quote, carrying over lines. MUST define milestones as fixed amounts or percentages of contract value, validating that percentages total 100%. MUST track milestone status. MUST support a retention percentage held per invoice. MUST attach site photos and notes. SHOULD show job cost vs revenue vs margin in real time. SHOULD support variation orders as supplementary quotes linked to the job.

**F5 Invoicing**
MUST create standard invoices, and progress invoices against milestones. MUST support advance/deposit invoices and their later application. MUST compute and hold retention. MUST issue immutably with a gapless number. MUST support credit notes against an issued invoice. MUST render a branded PDF and email it. SHOULD support partial invoicing of a milestone. SHOULD show a payment link/instructions block. MAY support recurring invoices *(deferred)*.

**F6 Payments**
MUST record a payment against a contact and allocate it across one or more invoices. MUST support partial payment, overpayment held as credit, and unallocated advances. MUST support cash, bank transfer, cheque, card, UPI and "other" as methods. SHOULD auto-suggest allocation oldest-first. SHOULD generate a receipt PDF.

**F7 Purchases & expenses**
MUST record vendor bills with lines and tax. MUST record standalone expenses with category, optional job, and receipt attachment. MUST support an approval step for field-submitted expenses. MUST allocate vendor payments against bills. SHOULD support marking an expense as billable to a customer.

**F8 Tax**
MUST define named tax rates with a percentage. MUST support tax-inclusive and tax-exclusive pricing per document. MUST support tax groups (multiple rates on one line). MUST produce a tax summary report showing collected vs paid. SHOULD support zero-rated and exempt classifications. Explicitly no statutory filing integration in v1.

**F9 Accounting & reports**
MUST maintain a double-entry ledger with a seeded chart of accounts. MUST allow the owner to view journal entries and drill from any report figure to source document. MUST produce: Profit & Loss, Balance Sheet, Trial Balance, AR Aging, AP Aging, Tax Summary, Job Profitability. MUST allow date-range selection and CSV export. SHOULD support closing a fiscal period to block back-dated entries. SHOULD allow adding custom accounts. MAY support cash vs accrual toggle *(default accrual)*.

**F10 Platform**
MUST support user invitation, role assignment and deactivation. MUST write an audit log entry for every create, update, issue, void and delete on financial documents. MUST provide backup and restore scripts covering database and files. MUST support org branding (logo, colours, document footer). MUST provide seed/demo data toggled by env var. MUST provide an in-app notification centre — a persisted, per-user, org-scoped feed of business events (starting with quote viewed/accepted/rejected; any later module can add its own event types through the same mechanism) with read/unread state and a badge count, reachable from a bell icon in the app shell and opening as a side panel/drawer listing recent notifications newest-first. Notifications MUST be delivered to every user with visibility into the event per the existing permission model (§2.1), not owner-only — email notification (already built) stays owner-only per S-03.7's own wording, but the in-app feed is not restricted to owners, since a staff member with quote access has the same reason to see it. SHOULD let a user mark all as read. SHOULD provide health endpoints and structured logs. SHOULD provide an in-app upgrade notice. MAY provide anonymous, opt-in usage telemetry — off by default.

**F11 Mobile field companion**
MUST authenticate and scope to assigned jobs. MUST capture and upload site photos with job association, offline-queued. MUST submit expenses with a receipt photo, offline-queued. MUST update milestone status. MUST let a field user open a quote and capture on-screen customer acceptance. SHOULD show today's jobs and contact numbers with tap-to-call. SHOULD indicate pending-sync count clearly. MUST NOT allow invoice creation or ledger access.

**F12 First-Run Onboarding**
MUST walk a brand-new instance through a linear setup wizard on first login: business profile (name, logo, address, industry) → currency & locale → financial year start → tax rates → numbering prefixes → chart-of-accounts confirmation → invite team. MUST let the owner pick an **industry template** (Construction/Contracting, General Services, or Generic) that pre-selects sensible catalogue units, a default tax rate, and job-costing defaults — Construction also pre-enables milestones and retention, which stay hidden for a business that will never use them. MUST offer to load demo/sample data as an alternative or supplement to manual setup, so an evaluator can explore before committing real data. MUST show a persistent, dismissible setup checklist (e.g. "Add your first customer", "Create your first item", "Send your first quote") on the dashboard until core actions are completed, so the path from install to first real transaction is never a blank screen. MUST allow every wizard step to be revisited later from Settings — onboarding is not a one-time gate. SHOULD detect an empty instance and re-offer the checklist rather than showing empty-state screens with no next action. MUST NOT require the wizard to be completed before the app is usable — an owner can skip to a blank state at any step, since some businesses will migrate data by CSV import rather than by hand.

---

## 9. Features & User Stories

Stories are grouped by feature with acceptance highlights. Story IDs are stable references for the issue tracker.

### FEAT-00 · UI Component Library

| ID | Story |
|---|---|
| S-00.1 | As a developer, I want a shared component library with all core primitives (button, input, select, table, dialog, etc.), so every screen is consistent and I'm not rebuilding controls per feature |
| S-00.2 | As an owner, I want to switch between light and dark mode, so the app is comfortable in a bright office or a dim site cabin |
| S-00.3 | As an owner, I want my choice of light/dark to be remembered per device, so I don't reset it every session |
| S-00.4 | As a self-hoster, I want to change brand colours via a small set of theme tokens, so the app matches my company without forking component code |
| S-00.5 | As a self-hoster, I want to pick from a couple of built-in theme presets, so I get a decent look without designing one myself |
| S-00.6 | As a developer, I want each component documented with examples, so I can build new screens quickly and consistently |
| S-00.7 | As a user, I want every component to be keyboard-navigable and screen-reader friendly, so the app is usable regardless of ability |

*Acceptance highlights:* theme tokens are CSS custom properties, not hardcoded Tailwind classes scattered through components — changing a token must not require touching component source. Mode preference is stored client-side and, once auth exists, synced to the user record. Every component in the library has a Storybook entry before it's considered done, not added retroactively.

### FEAT-01 · Contacts & CRM

| ID | Story |
|---|---|
| S-01.1 | As staff, I want to add a customer with company name, contact persons and addresses, so I can quote them |
| S-01.2 | As staff, I want to mark a contact as both customer and vendor, so I don't duplicate records |
| S-01.3 | As an owner, I want to see every quote, invoice, payment and note for a contact on one timeline, so I know where we stand before a call |
| S-01.4 | As staff, I want to create a lead with an estimated value and stage, so the pipeline reflects reality |
| S-01.5 | As an owner, I want a pipeline board by stage with total value per stage, so I can forecast |
| S-01.6 | As staff, I want to log a call or site visit against a contact with a follow-up date, so nothing is forgotten |
| S-01.7 | As staff, I want a list of overdue follow-ups on my dashboard, so I act on them |
| S-01.8 | As an owner, I want to import contacts from CSV, so migrating from a spreadsheet takes minutes |

*Acceptance highlights:* duplicate detection warns on matching phone or email but does not block. Deleting a contact with financial documents is blocked; deactivation is offered instead.

### FEAT-02 · Catalogue

| ID | Story |
|---|---|
| S-02.1 | As staff, I want to save services and materials with a default price and unit, so quoting is fast |
| S-02.2 | As staff, I want to override price on a quote line without changing the catalogue, so I can negotiate |
| S-02.3 | As an owner, I want each item to map to an income account, so revenue reports break down meaningfully |
| S-02.4 | As staff, I want to add an item inline while building a quote, so I'm not interrupted |

*Acceptance highlights:* changing a catalogue price never alters existing documents. Documents store a snapshot of name, price and tax at the time of issue.

### FEAT-03 · Quotes

| ID | Story |
|---|---|
| S-03.1 | As staff, I want to build a multi-line quote with quantity, rate, discount and tax per line, so it reflects the real scope |
| S-03.2 | As staff, I want to add section headings and free-text lines, so a construction quote reads clearly |
| S-03.3 | As staff, I want to preview and download a branded PDF, so I can share it any way the customer prefers |
| S-03.4 | As staff, I want to email the quote with a secure link, so the customer can act without an account |
| S-03.5 | As a customer, I want to open a link and read the quote on my phone, so I don't need to download anything |
| S-03.6 | As a customer, I want to accept or reject with an optional comment, so my decision is recorded |
| S-03.7 | As an owner, I want to be notified the moment a quote is viewed or accepted, so I can follow up while it's warm |
| S-03.8 | As staff, I want to revise a sent quote into version 2, so the history of what was offered is preserved |
| S-03.9 | As an owner, I want quotes with discount above a threshold to require my approval, so margins are protected |
| S-03.10 | As staff, I want to convert an accepted quote into a job and its first invoice in one action, so nothing is retyped |
| S-03.11 | As staff, I want quotes to expire on a validity date and show as expired, so old prices aren't honoured by accident |
| S-03.12 | As a field user, I want to show the quote on my phone and capture the customer's acceptance on site, so we close on the spot |

*Acceptance highlights:* the public token is unguessable, scoped to one quote, and expires with the quote's validity date plus a grace period. Accepting a superseded version is blocked with an explanation. An accepted quote becomes read-only.

### FEAT-04 · Jobs & Milestones

| ID | Story |
|---|---|
| S-04.1 | As an owner, I want a job created from an accepted quote with the contract value carried over, so the job starts with real numbers |
| S-04.2 | As an owner, I want to define billing milestones as percentages or fixed amounts, so I can bill in stages |
| S-04.3 | As an owner, I want the system to stop me if my milestone percentages don't total 100%, so I don't under-bill |
| S-04.4 | As a field user, I want to mark a milestone as complete with photos, so office staff can raise the invoice |
| S-04.5 | As staff, I want to raise a progress invoice directly from a completed milestone, so billing follows the work |
| S-04.6 | As an owner, I want a retention percentage held automatically on each invoice, so I don't have to calculate it |
| S-04.7 | As an owner, I want to release retention as a final invoice when the defect period ends, so I actually collect it |
| S-04.8 | As an owner, I want to see cost, revenue and margin for a job as it runs, so I know if it's going wrong before it's finished |
| S-04.9 | As staff, I want to raise a variation order as a supplementary quote linked to the job, so scope changes are tracked and billed |
| S-04.10 | As a field user, I want to upload site photos tagged to a job, so there's a record of progress and condition |

*Acceptance highlights:* retention posts to a separate Retention Receivable account, not AR, so aging reports aren't distorted. Job costing pulls from journal lines tagged with `job_id`, which means expenses, bills and labour all count without a parallel subsystem.

### FEAT-05 · Invoicing

| ID | Story |
|---|---|
| S-05.1 | As staff, I want to create an invoice from scratch, from a quote, or from a milestone, so all three real paths are covered |
| S-05.2 | As staff, I want to save an invoice as a draft and edit it freely, so I can prepare it before committing |
| S-05.3 | As staff, I want issuing an invoice to lock it and assign a permanent number, so the record is trustworthy |
| S-05.4 | As staff, I want to raise an advance/deposit invoice before work starts, so we're funded |
| S-05.5 | As staff, I want a later invoice to automatically offset the advance already received, so the customer isn't double-charged |
| S-05.6 | As staff, I want to issue a credit note against an invoice for a return or correction, so I never edit an issued document |
| S-05.7 | As staff, I want to email the invoice as a PDF with payment instructions, so payment is easy |
| S-05.8 | As an owner, I want to void an invoice with a reason, so mistakes are reversible and traceable |
| S-05.9 | As an owner, I want overdue invoices flagged with days outstanding, so chasing is obvious |
| S-05.10 | As staff, I want to send a payment reminder in one click, so following up isn't a chore |

*Acceptance highlights:* an issued invoice can never be edited or deleted — only voided or credited. Voiding posts a reversing journal entry. The PDF is generated from the same snapshot data, so a reprint years later is byte-identical.

### FEAT-06 · Payments

| ID | Story |
|---|---|
| S-06.1 | As staff, I want to record a payment against an invoice, so the balance updates |
| S-06.2 | As staff, I want to split one payment across several invoices, so a lump-sum settlement is recorded correctly |
| S-06.3 | As staff, I want the system to suggest oldest-first allocation, so I usually just confirm |
| S-06.4 | As staff, I want to record a payment with no invoice yet, held as customer credit, so advances are captured |
| S-06.5 | As staff, I want to record a partial payment and see the remaining balance, so part-payments don't break anything |
| S-06.6 | As staff, I want to generate a receipt PDF, so the customer has proof |
| S-06.7 | As an owner, I want a receivables view showing who owes what and for how long, so I know who to chase |

*Acceptance highlights:* allocations can never exceed either the payment amount or the invoice balance — enforced at the database level, not just the UI.

### FEAT-07 · Purchases & Expenses

| ID | Story |
|---|---|
| S-07.1 | As staff, I want to record a vendor bill with lines, tax and due date, so payables are visible |
| S-07.2 | As a field user, I want to photograph a receipt and submit an expense from site, so it isn't lost |
| S-07.3 | As a field user, I want to submit an expense with no signal and have it upload later, so bad connectivity isn't a blocker |
| S-07.4 | As staff, I want to approve or reject submitted expenses with a comment, so there's a control |
| S-07.5 | As staff, I want to tag an expense or bill to a job, so job costing is accurate |
| S-07.6 | As staff, I want to mark an expense as billable and pull it into a customer invoice, so reimbursables are recovered |
| S-07.7 | As an owner, I want a payables view with due dates, so I pay on time |
| S-07.8 | As staff, I want to record a payment to a vendor allocated across bills, so payables clear correctly |

*Acceptance highlights:* an unapproved expense does not post to the ledger. Approval is the posting trigger.

### FEAT-08 · Tax

| ID | Story |
|---|---|
| S-08.1 | As an owner, I want to define my own named tax rates, so the product works in my country |
| S-08.2 | As an owner, I want to set whether my prices include or exclude tax, so quotes match how I actually sell |
| S-08.3 | As an owner, I want to combine multiple rates into a group on one line, so split taxes work |
| S-08.4 | As an owner, I want a report of tax collected and tax paid for a period, so filing is a data-entry job, not an investigation |
| S-08.5 | As staff, I want tax to default from the item but be overridable per line, so exceptions are possible |

### FEAT-09 · Accounting & Reports

| ID | Story |
|---|---|
| S-09.1 | As an owner, I want a chart of accounts pre-populated on first run, so I never have to design one |
| S-09.2 | As an owner, I want a Profit & Loss for any date range, so I know if I'm making money |
| S-09.3 | As an owner, I want a Balance Sheet, so I know what the business is worth |
| S-09.4 | As an owner, I want to click any figure in a report and see the documents behind it, so I trust the number |
| S-09.5 | As an owner, I want AR and AP aging in 0-30/31-60/61-90/90+ buckets, so cash flow is visible |
| S-09.6 | As an owner, I want job profitability across all jobs, so I learn which work is worth taking |
| S-09.7 | As an owner, I want to export any report to CSV, so my accountant can work with it |
| S-09.8 | As an owner, I want to close a period so nobody back-dates entries into it, so filed figures stay filed |
| S-09.9 | As an owner, I want to add a custom expense account, so my categories match my business |
| S-09.10 | As an owner, I want a dashboard with cash position, receivables, overdue count and month revenue, so one screen tells me how things stand |

*Acceptance highlights:* the trial balance must always balance; a scheduled integrity check asserts this and surfaces a system warning if it ever fails. No report is computed from documents directly — all financial reporting derives from journal lines, giving one source of truth.

### FEAT-10 · Platform & Administration

| ID | Story |
|---|---|
| S-10.1 | As an owner, I want core business settings (currency, financial year, tax) editable from Settings independent of the onboarding wizard, so I can change them later without re-running setup — *see FEAT-12 for the first-run wizard itself* |
| S-10.2 | As an owner, I want to invite users by email and assign a role, so my team can work |
| S-10.3 | As an owner, I want to deactivate a user without deleting their history, so records stay intact |
| S-10.4 | As an owner, I want my logo and colours on documents, so quotes look professional |
| S-10.5 | As an owner, I want to configure numbering prefixes and starting numbers, so I can continue my existing series |
| S-10.6 | As an owner, I want an audit log of who changed what, so I can investigate discrepancies |
| S-10.7 | As a self-hoster, I want a single command to install, so I don't need help |
| S-10.8 | As a self-hoster, I want a backup command producing one restorable archive, so my data is safe |
| S-10.9 | As a self-hoster, I want upgrades to run migrations automatically and safely, so I'm not afraid to update |
| S-10.10 | As an evaluator, I want to load demo data with one flag, so I can see the product working before committing |
| S-10.11 | As an owner or staff member, I want an in-app panel of recent notifications (quote viewed/accepted/rejected today, and whatever future events other modules add), with unread tracking, so I don't have to rely on email alone to notice something needs my attention |
| S-10.12 | As an owner or staff member, I want a native browser/OS notification when something needs my attention, even if Spine isn't the tab I'm looking at or isn't open at all, so I don't have to keep the app in view to notice |

*Acceptance highlights (S-10.11):* a bell icon in the app shell shows an unread count; opening it slides in a right-side panel/drawer listing notifications newest-first, each with a type, a human-readable message, a timestamp, and (where applicable) a link to the source record (e.g. the quote). Marking one as read (by opening it, or via a "mark all read" action) persists — the unread count must survive a page reload and a different device/session for the same user. Delivery is org- and permission-scoped: a notification about a quote is visible to every user who could see that quote per §2.1, not just the owner. This is additive to email notification (S-03.7 and any future email-notify story) — the two channels share the same trigger point (`NotificationsService.notify`-equivalent) but are independent; a user with no email access to check still sees the in-app panel, and email keeps working even if a user never opens the panel.

*Acceptance highlights (S-10.12):* uses the W3C Push API + a service worker, not a foreground-only `Notification()` popup — it must fire even when the Spine tab is backgrounded, minimized, or closed entirely (as long as the browser process is running), which is the whole point relative to S-10.11's in-tab badge. A user opts in explicitly (browser permission prompt triggered by an explicit in-app action, never on page load unprompted) and can revoke from Settings; a user who never opts in keeps getting the S-10.11 in-app panel and email unaffected — this is a third, independent delivery channel layered onto the same `NotificationsService.notify()` trigger point as S-10.11/S-03.7, not a replacement. Multiple devices/browsers per user are supported (each is its own push subscription; revoking one doesn't affect others). Clicking a delivered notification focuses/opens the app to the relevant record's link. Per §6.8's "boot with only 3 required env vars" rule, push is optional-with-graceful-degradation: no VAPID keys configured means the push channel is silently disabled (subscribe UI hidden or shows "not configured"), not a boot failure or error toast — self-hosters who don't want this capability don't have to set it up. Self-hoster docs cover generating a VAPID keypair for `.env`.

### FEAT-11 · Mobile Field Companion

| ID | Story |
|---|---|
| S-11.1 | As a field user, I want to log in once and stay logged in, so I'm not typing passwords on site |
| S-11.2 | As a field user, I want today's assigned jobs on the home screen with addresses and tap-to-call contacts, so I can just go |
| S-11.3 | As a field user, I want to capture photos against a job even with no signal, so I never lose evidence |
| S-11.4 | As a field user, I want to see how many items are waiting to sync, so I know when I'm safe |
| S-11.5 | As a field user, I want to submit an expense with a receipt photo, so I'm reimbursed |
| S-11.6 | As a field user, I want to mark a milestone complete, so billing can proceed |
| S-11.7 | As a field user, I want to present a quote and capture acceptance on site, so deals close faster |
| S-11.8 | As an owner, I want the mobile app to hide all financial reports, so sensitive data isn't on every phone |

*Acceptance highlights:* the app must be usable end-to-end in airplane mode for its four offline capabilities, with clear queued-state indication and automatic replay.

### FEAT-12 · First-Run Onboarding

| ID | Story |
|---|---|
| S-12.1 | As a new owner, I want a step-by-step wizard when I first log in, so I know exactly what to configure before I start using the app |
| S-12.2 | As a new owner, I want to enter my business name, logo, address and industry in one short step, so branding is set from day one |
| S-12.3 | As a new owner, I want to pick an industry template (Construction, General Services, or Generic), so the app pre-configures itself for how I actually work instead of showing me everything at once |
| S-12.4 | As a new owner, I want my currency, locale and financial year start set during onboarding, so every document and report uses the right defaults immediately |
| S-12.5 | As a new owner, I want to review and confirm my tax rates during setup, so my very first quote is priced correctly |
| S-12.6 | As a new owner, I want to see the chart of accounts that will be used, with the option to accept the default or tweak it, so I understand what I'm getting without having to know accounting |
| S-12.7 | As a new owner, I want to invite my team as the last onboarding step, so everyone can start working the same day |
| S-12.8 | As an evaluator, I want the option to load demo data instead of setting up manually, so I can explore the product in two minutes |
| S-12.9 | As a new owner, I want a checklist on my dashboard — first customer, first item, first quote — until I've done them, so I'm never staring at an empty screen wondering what to do next |
| S-12.10 | As an owner, I want to revisit and change any onboarding setting later from Settings, so an early decision isn't permanent |
| S-12.11 | As a new owner, I want the option to skip the wizard entirely and start from a blank instance, so I can migrate my existing data by import instead |

*Acceptance highlights:* the industry template only pre-sets defaults and visibility (e.g. Construction surfaces milestones/retention by default) — it never restricts what a business can later turn on or off, so picking the "wrong" template isn't a dead end. Skipping the wizard leaves the instance fully functional with system defaults, not a broken state. The checklist re-appears if the underlying condition becomes true again (e.g. all customers deleted), rather than tracking a one-time "seen it" flag.

---

## 10. Non-Functional Requirements

**10.1 Performance.** Target hardware is a 4-core / 8 GB machine. List views paginate at 50 and respond within 300 ms at 10,000 records. PDF generation under 3 seconds. Reports over a 12-month range under 2 seconds at 50,000 journal lines. Mobile cold start under 3 seconds.

**10.2 Scale assumptions.** Up to 20 users, 10,000 contacts, 50,000 documents/year per instance. Beyond that is out of scope by design.

**10.3 Security.** Argon2id password hashing. Server-side authorisation on every endpoint — never trust the client role. Signed, expiring, single-purpose tokens for public quote links, with rate limiting. All file access proxied and authorised; no public bucket. Secrets from environment only, never committed. Dependency scanning in CI. OWASP Top 10 addressed in a documented review before 1.0.

**10.4 Data integrity.** Financial writes wrapped in database transactions. Balanced-entry constraint enforced in the schema. Foreign keys on. Soft delete for masters, never for financial documents. Idempotency keys on all mutating endpoints.

**10.5 Backup & restore.** `scripts/backup.sh` produces a single timestamped archive containing a `pg_dump` and the file store. `scripts/restore.sh` restores it into a clean instance. Documented cron example. Restore must be verified in CI on every release — an untested backup is not a backup.

**10.6 Upgrade path.** Semantic versioning. Migrations run automatically on boot, forward-only, and are idempotent. Every release documents breaking changes. A pre-migration database snapshot is taken automatically. Skipping minor versions must be safe.

**10.7 Availability.** Single-node, no HA requirement. Graceful degradation: if SMTP is down, documents still issue and email queues for retry. If object storage is down, the app runs read-only for attachments rather than erroring globally.

**10.8 Internationalisation & accessibility.** All UI strings externalised from day one, English shipped. Locale-aware dates and number formatting. Configurable currency symbol and decimal places. WCAG 2.1 AA target: keyboard navigable, visible focus, 4.5:1 contrast, screen-reader labels — largely inherited from Radix primitives but verified, not assumed.

**10.9 Licensing & governance.** Proposed **AGPL-3.0**: anyone can self-host and modify, but a company offering it as a hosted service must publish their changes. MIT would maximise adoption and permit closed commercial forks. This is an open decision. Also needs: `CONTRIBUTING.md`, a code of conduct, issue templates, and a documented release process.

**10.10 Observability.** Structured JSON logs with request IDs. `/health` and `/ready` endpoints. Optional anonymous telemetry, off by default, documented in plain language, one env var to disable.

**10.11 Testing.** Unit tests mandatory for the money, tax and posting-rule modules — these are where silent financial bugs live. Integration tests for each document lifecycle. A ledger-integrity test asserting the trial balance after every simulated workflow. E2E smoke test covering quote → invoice → payment.

---

## 11. App Scaffold

### 11.1 Docker Compose (shape)

```yaml
services:
  db:      postgres:16-alpine      # volume: pgdata
  minio:   minio/minio             # volume: files      (optional profile)
  api:     spine/api               # depends_on: db
  web:     spine/web               # depends_on: api
  caddy:   caddy:2                 # ports 80/443
  tunnel:  cloudflare/cloudflared  # optional profile
```

Two Compose profiles: `minimal` (db + api + web + caddy, local disk for files) and `full` (adds MinIO and tunnel).

### 11.2 Install experience

```bash
git clone https://github.com/<org>/spine && cd spine
cp .env.example .env      # edit 3 required values
docker compose up -d
# → http://localhost, first-run wizard
```

Target: under five minutes from clone to first quote on a machine that already has Docker.

### 11.3 Seed data

`SEED_DEMO=true` loads a fictional contracting business: 12 contacts, 20 catalogue items, 3 jobs at different stages, quotes in every status, invoices with partial payments and retention, expenses, and six months of ledger history — enough that every report renders with meaningful data on first open.

---

## 12. Phases & Deliverables

Estimates assume one experienced developer working part-time; halve them for full-time.

### Phase 0 · Foundation *(5 weeks)*
Monorepo, Docker Compose, Postgres, Drizzle migrations, Better Auth, organisation setup wizard, users & roles, numbering sequences, audit log, ledger core with chart of accounts seed, shared money & tax packages, CI pipeline — **plus the `@spine/ui` component library**: full primitive set (button, input, select, combobox, date picker, table, dialog, drawer, tabs, toast, form fields, money input, and the rest of §F0), theme tokens, dark/light mode with persistence, at least two presets, Storybook documentation, and an accessibility pass per component. Also delivers the **first-run onboarding wizard shell** — business profile, industry template picker, currency/financial year, tax rate confirmation, chart-of-accounts review, and team invite — since every dependency it touches (org, tax, numbering, ledger, users) is built in this phase.

Building the library here rather than per-feature costs roughly two extra weeks up front, but every later phase draws from a finished, documented set instead of inventing components mid-feature — Phase 1 alone needs a dozen of them for quotes. It also means theming and dark mode apply everywhere from the first screen, rather than getting bolted on after the fact.

**Stories:** S-00.1 → S-00.7 · S-09.1 · S-10.1 · S-10.2 · S-10.3 · S-10.5 · S-10.6 · S-12.1 · S-12.2 · S-12.4 → S-12.7 · S-12.10 · S-12.11
**Exit:** a user can install via Docker, sign up, complete the onboarding wizard end-to-end (or skip it), invite a colleague, and switch the app between light and dark mode. The ledger accepts a manually triggered balanced entry and rejects an unbalanced one. Every component in §F0 is in Storybook with light/dark and theme-preset variants.

**Exit demo (scripted, ~5 min, run for stakeholders before Phase 1 starts):**
1. `git clone` → `docker compose up -d` on a clean machine, timed
2. Sign up as owner, land in the onboarding wizard
3. Set business profile + logo, pick the Construction industry template
4. Confirm currency, financial year, tax rate, chart of accounts — accept defaults
5. Invite a second user, assign them the Staff role
6. Toggle dark mode; toggle back — confirm it persists after a refresh
7. Open Storybook, show 5–6 components in both theme presets
8. Open a database client, manually insert one balanced journal entry and one deliberately unbalanced one — show the constraint rejecting the second

Nothing in this script is customer-facing, so it's not a substitute for Phase 1 — it's proof that five weeks produced a real, working foundation rather than five weeks of scaffolding nobody can see. Worth recording as a short screen capture; it's also the natural seed for the eventual README demo.

### Phase 1 · Sales Spine *(4 weeks)*
Contacts, leads, activities, catalogue, quotes with lines and versioning, PDF rendering, email sending, public quote link with accept/reject, quote events, the in-app notification centre (bell icon + side panel, starting with quote view/accept/reject events), and the **dashboard setup checklist** (first customer / item / quote) now that those actions exist.
**Stories:** S-01.1 → S-01.8 · S-02.1 → S-02.4 · S-03.1 → S-03.9 · S-03.11 · S-10.4 · S-10.11 · S-10.12 · S-12.9
**Exit:** staff can quote a customer, the customer accepts by link, the owner is notified by email, and any user with quote visibility sees it in the in-app notification panel. First screenshot-worthy milestone.

### Phase 2 · Money In *(3 weeks)*
Invoices (draft → issue → void), credit notes, payments with multi-invoice allocation, advances, receipts, journal postings for all of the above, AR aging, receivables dashboard.
**Stories:** S-05.1 *(scratch + from-quote paths)* · S-05.2 → S-05.10 · S-06.1 → S-06.7 · S-03.10 *(quote → invoice half)* · S-09.5 *(AR half)*
**Exit:** quote → invoice → partial payment → balance, with a correct trial balance at every step.

### Phase 3 · Jobs & Construction Billing *(4 weeks)*
Jobs from quotes, milestones with validation, progress invoicing, advance application, retention hold and release, variation orders, site photos and notes, job dashboard. Also wires up the **Construction industry template's** effect from onboarding — milestones and retention become visible by default only for businesses that picked it.
**Stories:** S-04.1 → S-04.3 · S-04.4 *(web only; mobile in Phase 5)* · S-04.5 → S-04.7 · S-04.8 *(revenue side only until Phase 4 supplies costs)* · S-04.9 · S-04.10 *(web upload)* · S-03.10 *(quote → job half, completes the story)* · S-05.1 *(milestone path, completes the story)* · S-12.3 *(completes the story)*
**Exit:** a full contract lifecycle — advance, three progress bills, retention held, retention released — reconciles to the correct final position.

### Phase 4 · Money Out & Books *(3 weeks)*
Vendors, bills, expenses with approval, billable expenses, vendor payments, AP aging, tax configuration UI, P&L, Balance Sheet, Trial Balance, Tax Summary, Job Profitability, drill-down, CSV export, period close.
**Stories:** S-07.1 · S-07.2 *(web submission; mobile capture in Phase 5)* · S-07.4 → S-07.8 · S-08.1 → S-08.5 · S-09.2 → S-09.4 · S-09.5 *(AP half, completes the story)* · S-09.6 → S-09.10 · S-04.8 *(completes with cost data)*
**Exit:** a full quarter of simulated trading produces a P&L and Balance Sheet an accountant would accept.

### Phase 5 · Mobile Field Companion *(4 weeks)*
Expo app, auth, assigned-jobs home, offline SQLite cache, outbox queue with idempotent replay, photo capture, expense submission, milestone updates, on-site quote acceptance, sync indicator.
**Stories:** S-11.1 → S-11.8 · S-03.12 · S-04.4 *(mobile, completes the story)* · S-04.10 *(mobile capture, completes the story)* · S-07.2 *(mobile, completes the story)* · S-07.3
**Exit:** the app is used end-to-end in airplane mode and syncs cleanly on reconnect, with no duplicates.

### Phase 6 · Packaging & 1.0 *(2 weeks)*
Install script, backup/restore with CI-verified restore, upgrade docs, demo seed, branding settings, i18n extraction, accessibility pass, security review, README, screenshots, licence, contributing guide, v1.0 release.
**Stories:** S-10.7 → S-10.10 · S-12.8
**Exit:** a stranger installs from a clean machine using only the README and issues their first invoice.

**Total: ~23 weeks part-time.** Phases 1–2 alone (9 weeks, including the extended foundation) already produce a system that replaces spreadsheet quoting and invoicing for the reference business — worth deploying before the rest exists.

---

## 13. Risks & Open Questions

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| R1 | Accounting correctness bugs found after real use | Severe — destroys trust irrecoverably | Ledger integrity tests from Phase 0; have a practising accountant review posting rules before Phase 4 ships |
| R2 | Scope creep toward "Odoo but ours" | Project never ships | Non-goals in §1.5 are contractual. Anything not listed in §4.1 goes to a v2 backlog, not into v1 |
| R3 | Self-hosting proves too hard for the target user | Nobody adopts it | Phase 6 is not optional. Test install on a clean machine with a non-technical person watching |
| R4 | Offline sync produces duplicates or lost data | Field users stop trusting the app | Idempotency keys and append-only offline operations; no offline financial documents |
| R5 | Solo maintainer burnout on an open-source project | Abandonment | Ship Phase 1–2 publicly early to attract contributors; keep the architecture boring |
| R6 | Tax model too generic for any specific country | Users can't actually file | Accept it — v1 produces the numbers, not the filing. Country packs are a v2 extension point |
| R7 | PDF rendering differences across environments | Documents look wrong for some users | Pin the renderer, snapshot-test PDF output in CI |

**Open questions**

1. Product name — needed before repo creation.
2. Licence — AGPL-3.0 vs MIT.
3. Should Phase 5 (mobile) move before Phase 4 (books), given the field crew is a named v1 persona and books can lag?
4. Is a practising accountant available to review the chart of accounts and posting rules? This materially de-risks R1.
5. Cash vs accrual — is accrual-only acceptable for v1?
6. Does the reference business need to migrate historical data, or does it start clean from a cutover date?

---

## 14. Appendix

### 14.1 Glossary

**Accrual accounting** — revenue and expenses recorded when earned or incurred, not when cash moves. The default here.
**Advance / Deposit** — money taken before work starts. A liability until the work is delivered.
**Aging** — how long invoices have been outstanding, bucketed by days.
**AP (Accounts Payable)** — what you owe suppliers.
**AR (Accounts Receivable)** — what customers owe you.
**Balance Sheet** — assets, liabilities and equity at a single point in time.
**Chart of Accounts** — the list of buckets every transaction is sorted into.
**Credit Note** — a document reducing what a customer owes, used instead of editing an issued invoice.
**Debit / Credit** — the two sides of every entry. Debits increase assets and expenses; credits increase liabilities, equity and income.
**Double-entry** — every transaction touches at least two accounts, and debits always equal credits.
**Journal Entry** — one balanced financial event, made of two or more journal lines.
**P&L (Profit & Loss)** — income minus expenses over a period.
**Progress Billing** — invoicing a portion of a contract as work reaches defined stages.
**Retention** — a percentage of each construction invoice withheld by the customer until the defect liability period ends. Common in construction; frequently unbilled and forgotten, which is exactly why the system should track it.
**Reversal** — a mirror-image journal entry that cancels an earlier one, preserving history.
**Tax-inclusive pricing** — the displayed price already contains tax.
**Trial Balance** — a list of all accounts proving total debits equal total credits.
**Variation Order** — an approved change to an agreed scope, priced separately.
**Void** — cancelling an issued document without deleting it.

### 14.2 Default Chart of Accounts

| Code | Account | Type |
|---|---|---|
| 1000 | Cash in Hand | Asset |
| 1010 | Bank Account | Asset |
| 1100 | Accounts Receivable | Asset |
| 1150 | Retention Receivable | Asset |
| 1200 | Input Tax Receivable | Asset |
| 1300 | Prepaid Expenses | Asset |
| 1500 | Fixed Assets | Asset |
| 1510 | Accumulated Depreciation | Asset (contra) |
| 2000 | Accounts Payable | Liability |
| 2100 | Output Tax Payable | Liability |
| 2200 | Customer Advances | Liability |
| 2400 | Wages Payable | Liability |
| 2500 | Loans Payable | Liability |
| 3000 | Owner's Capital | Equity |
| 3100 | Owner's Drawings | Equity |
| 3200 | Retained Earnings | Equity |
| 4000 | Sales — Goods | Income |
| 4100 | Sales — Services | Income |
| 4900 | Discounts Given | Income (contra) |
| 5000 | Cost of Materials | Expense |
| 5100 | Subcontractor Costs | Expense |
| 5200 | Direct Labour | Expense |
| 6000 | Rent | Expense |
| 6100 | Utilities | Expense |
| 6200 | Salaries | Expense |
| 6300 | Travel & Vehicle | Expense |
| 6400 | Professional Fees | Expense |
| 6500 | Depreciation | Expense |
| 6900 | Other Expenses | Expense |

System accounts (AR, AP, tax, retention, advances, retained earnings) cannot be deleted by the user. Everything else can be renamed or extended.

### 14.3 Numbering Defaults

| Document | Default pattern |
|---|---|
| Quote | `QUO-{YYYY}-{0000}` |
| Invoice | `INV-{YYYY}-{0000}` |
| Credit Note | `CRN-{YYYY}-{0000}` |
| Receipt | `RCP-{YYYY}-{0000}` |
| Vendor Bill | *user-entered* (the vendor's number) |
| Expense | `EXP-{YYYY}-{0000}` |
| Job | `JOB-{YYYY}-{000}` |

All patterns configurable. Sequences reset annually by default, on the configured financial-year start.
