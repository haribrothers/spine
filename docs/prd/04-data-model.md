# 04 · Data model

PostgreSQL 16, Drizzle schema in `apps/api/src/db/schema/` (56 tables, 29 enums today; Phases 8–9 add the tables and columns listed under "Columns added by the feature files"). Migrations are SQL in `apps/api/drizzle/`, forward-only. The table reference below is generated from the schema; the prose sections are the rules it has to obey. If you change a table or column, update this file in the same change.

## Conventions

- Business tables carry `id uuid` (random), `org_id` (→ `organization`, every query is scoped by it), `created_at`, `updated_at`. Better Auth tables (`user`, `session`, `account`, `verification`, `organization`, `member`, `invitation`, `jwks`) use text ids.
- Money: `*_amount bigint` in minor units + a `currency` / `*_currency` text code ([D-004](12-decisions.md)). Quantities and percentages: `numeric` by decision; today several are `real` (rates, quantities, discount/tax percentages, retention, milestone amounts) until US-TAX-07 migrates them.
- Ownership: the stable creator column is `created_by_user_id` (`submitted_by_user_id` for expenses, `organizer_user_id` for meetings). It is set once and never reassigned ([D-018](12-decisions.md)). Reassignable people fields (`leads.owner_user_id`, `activities.assigned_to_user_id`) never decide edit rights.
- Demo data: `is_demo boolean` marks seeded rows so "Delete all demo data" removes exactly them.
- Soft states over deletes: master data is archived (`archived_at`); financial documents are never deleted once issued — only voided or credited.
- Settings are key/value rows in `settings` (`org_id`, `key`, `value jsonb`). Keys in use: `business_profile`, `industry_template`, `currency`, `default_tax_rate`, `prices_include_tax`, `discount_approval_threshold`, `quote_conversion_guard`, `dashboard_meetings_scope`, `meeting_reminder_lead_minutes`, `industry_template_seed` (US-ONB-13: what the Construction template last set up, `{ accounts, categories, kept }`), plus onboarding/checklist state.

## Invariants (enforced in the database unless noted)

| # | Invariant | Where |
|---|---|---|
| I1 | Exactly one `member` per organisation has `is_primary_owner = true` | Partial unique index `member_org_primary_owner_uidx` |
| I2 | Each journal entry balances (Σ debit = Σ credit) | Trigger (`0001_ledger_integrity_triggers.sql`) |
| I3 | Each journal line is one-sided | Check `journal_lines_one_sided` |
| I4 | Payment allocations never exceed the payment amount or the invoice balance | Trigger (`0020_payment_allocation_limits.sql`) |
| I5 | Vendor payment allocations never exceed the payment or the bill balance | Trigger (`0029_vendor_payment_allocation_limits.sql`) |
| I6 | Document numbers are unique per org and type and allocated under a row lock | `number_sequences` + service transaction |
| I7 | `(meeting_id, occurrence_date)` is unique in `meeting_occurrence_exceptions` | Unique constraint |
| I8 | Issued invoices, sent quotes, recorded vendor bills and issued credit notes are never updated except status/void fields | Service layer (tested) |
| I9 | Milestone percentages on a job total 100 before any write | Service layer (tested) |
| I10 | No journal posting dated inside a closed `fiscal_periods` row | Service layer (tested) |
| I11 | A quote, invoice or bill line stores its own name, price and tax (snapshot) | Columns on `*_lines` |
| I12 | An idempotency key is unique per org + user + endpoint + key, where endpoint is the method and actual path (not the route pattern); replays return the stored response (US-OPS-08) | `idempotency_keys` |
| I13 | Exactly one default money account per organisation; each money account owns exactly one ledger account | Partial unique index on `money_accounts (org_id) where is_default`; unique `account_id` (Phase 8) |
| I14 | Vendor credit allocations + vendor refunds ≤ the credit's total; an allocation ≤ the bill's balance; customer refunds ≤ the source's remaining credit | Trigger `check_vendor_credit_allocation_limits` (0086) and checks on `vendor_credits.balance_amount`, `vendor_bills`, `payments` and `credit_notes` (Phase 8) |
| I15 | Manual journal lines never use 1100, 1150, 1200, 2000, 2100, 2200 or 3900; opening balance lines never use 1100, 1150, 2000, 2200 or 3900 | Service layer (tested, D-134, D-137) |
| I16 | A journal line belongs to at most one reconciliation; a document whose entry has reconciled lines can't be voided or deleted | Unique match + service check (D-158) |
| I17 | Once opening balances are locked, nothing is posted dated before the cutover date except the opening entries themselves | The closed fiscal period created by the lock (I10) |

## Relationships worth knowing

- A **job** is optional on quotes, invoices, vendor bills and expenses; when present, postings carry `job_id` and job costing works.
- **Quote versions** link through `quotes.parent_quote_id`; `version` increments.
- **Variation orders** (`job_variation_orders`) wrap a quote linked to a job.
- **Crew** (`job_assignments`) decides which jobs a Field user sees on mobile.
- **Meeting** read access = `visibility` + `meeting_attendees`; attendee `user_id` is `ON DELETE SET NULL` so past rosters survive a member leaving.
- **Audit log** rows (`audit_log`) reference `entity_type` + `entity_id` (+ `contact_id` for contact timelines) and hold a `changes jsonb` diff.

## Columns added by the feature files

New schema the stories require. Each is created by the story named; until then it does not exist.

| Table / key | Change | Story |
|---|---|---|
| `lead_stages` (new) | `id`, `org_id`, `name`, `kind` enum `lead_stage_kind` (`open`,`won`,`lost`), `sort_order`, `color` (a design-token category name — slate, blue, teal, amber, purple, pink, green, red — never hex), timestamps; index (`org_id`, `sort_order`). Seeded with New / Qualified / Proposal / Won / Lost for every organisation (migration `0063`, sign-up, and `LeadStagesService.ensureSeeded` for orgs made any other way); max 12 per org; exactly one `won` and one `lost`, always last (service + `putLeadStagesSchema`) | US-CRM-19 |
| `leads` | `stage_id uuid not null → lead_stages (restrict)` replaces the `lead_stage` enum column: migration `0063` maps new/qualified/proposal/won/lost to the seeded stages at the same position, `0064` makes it not null and drops the old column and enum; index (`org_id`, `stage_id`) | US-CRM-19 |
| `settings` key `branding` | `{ themePreset: "spine-blue"\|"harbour-teal"\|"plum"\|"graphite", documentColor: "#RRGGBB", documentFooter: text }` | US-SET-09, US-SET-10 |
| `quotes` | `signature_file_id uuid → files` and `accepted_signer_name text` (on-site acceptance stores what it captured) | US-QUO-19 |
| `settings` key `update_check` | `{ latestVersion, checkedAt }` written by the daily check | US-OPS-06 |
| `organization.name` | Kept in sync with `business_profile.name`: `SettingsService.set` renames the organisation in the same transaction whenever a non-empty business name is saved; migration `0062` copied it for existing installs | US-TEAM-15 |
| Better Auth `verification` | Used for password-reset tokens (no new table) | US-AUTH-09, US-AUTH-10 |
| `idempotency_keys` | `user_id text → user`; unique index becomes (`org_id`, `user_id`, `endpoint`, `key`) | US-OPS-08 |
| `quotes`, `invoices`, `credit_notes`, `payments` | `issued_pdf_file_id uuid → files` (the PDF stored at send/issue; on quotes and invoices it replaces the old `pdf_file_id`, whose values migration `0053` copied over before `0054` dropped it) | US-INV-17 |
| `settings` key `business_profile` | gains `paymentInstructions` (text) | US-INV-15 |
| `invoices.payment_instructions` | text, nullable — the payment instructions copied at issue; the PDF and every later email use this copy. Null on drafts and when none were set (migration `0059`) | US-INV-15 |
| `settings` key `business_profile` | gains `email` and `phone` (text), shown on the expired-quote-link page | US-QUO-21 |
| `audit_log` | `entity_id` changes from `uuid` to `text` (member/user ids are text); entity type `user` for role and access changes (`role_changed`, `deactivated`, `reactivated`, `primary_owner_transferred`; entity id = the member's user id; `changes` `[{ field: role\|status\|primaryOwner, from, to }]`); new index `audit_log_org_created_idx (org_id, created_at)` — migration `0074_audit_log_entity_text` | US-SET-11 |
| `ledger_integrity_checks` (new) | `org_id` PK → organization, `checked_at`, `difference bigint` (debits − credits), `last_balanced_at` — the latest daily check, one row per org | US-RPT-12 |
| `files` | No owner columns: the record a file belongs to is found from the columns and settings that point at it (D-117) | US-OPS-20 |
| `jobs` | `number text` (unique per org, index `jobs_org_number_unique`), allocated from the `job` number sequence in the creating transaction; migration `0061` numbered existing jobs in creation order. Nullable only for rows written outside `JobsService` | US-JOB-22 |
| `catalog_bundles` (new) | `id`, `org_id`, `name`, `description`, `currency` (offered on documents in that currency), `total_amount bigint` (sum of the line totals when saved, for the picker), `created_by_user_id` (own/others), `archived_at`, timestamps (migration `0065`) | US-QUO-25 |
| `catalog_bundle_lines` (new) | `id`, `bundle_id` → bundles (cascade), `sort_order`, `type` enum `catalog_bundle_line_type` (item/heading/text), `catalog_item_id?` (provenance, set null), `name`, `description`, `quantity numeric(18,4)`, `unit_price_amount bigint`, `discount_percentage`, `tax_rate_percentage`, `tax_rate_id?`, `tax_group_id?`, `is_tax_inclusive` — a snapshot of the quote line it was saved from (D-096) | US-QUO-25 |
| `settings` key `invoice_reminders` | `{ enabled, offsets: int[], repeatEvery?, repeatMax?, sendAt }` | US-INV-18 |
| `contacts` | `reminders_paused boolean not null default false` (migration `0066`) | US-INV-19 |
| `invoice_reminders` (new) | `id`, `org_id`, `invoice_id` → invoices (cascade), `sent_on date` (organisation date), `sent_at`, `kind` enum `invoice_reminder_kind` (`auto`/`manual`); unique (`invoice_id`, `sent_on`) — at most one reminder per invoice per day, automatic or manual (migration `0066`) | US-INV-19 |
| `settings` key `invoice_reminders_last_run` | `{ date }` — the organisation date the reminder run last completed, so a day runs once | US-INV-19 |
| `recurring_invoices` (new) | `id`, `org_id`, `name`, `contact_id` → contacts (cascade), `currency`, `frequency` enum `recurring_frequency` (`weekly`/`monthly`/`quarterly`/`yearly`), `day_rule` (ISO weekday `1`–`7` for weekly; otherwise day of month `1`–`28` or `last`; monthly/quarterly/yearly count months from `starts_on`), `starts_on date`, `ends_on date?`, `max_count?`, `created_count int default 0`, `due_days`, `mode` enum `recurring_mode` (`issue_and_email`/`draft`), `status` enum `recurring_status` (`active`/`paused`/`finished`), `next_run_on date?` (null while paused or finished), `total_amount bigint` (the lines' total when saved, for the list), `created_by_user_id`, timestamps (migration `0067`) | US-INV-20 |
| `recurring_invoice_lines` (new) | same shape as `catalog_bundle_lines` (`type` uses `invoice_line_type`), keyed by `recurring_invoice_id` → recurring_invoices (cascade) | US-INV-20 |
| `invoices` | `recurring_invoice_id uuid?` → recurring_invoices (set null), `recurring_run_on date?` (the schedule date it was created for); unique (`recurring_invoice_id`, `recurring_run_on`) `invoices_recurring_run_uidx` (migration `0068`) | US-INV-21 |
| `user` | `digest_enabled boolean` (null = role default: on for Owners, D-093), `digest_time time` (default `07:00`, organisation time), `digest_days text` (`weekdays` default \| `daily`), `digest_last_sent_on date` (organisation date of the last run that sent or skipped, so a member gets at most one digest a day) — migration `0073_user_daily_digest` | US-NTF-13 |
| `data_exports` (new) | `id`, `org_id`, `requested_by_user_id`, `formats jsonb` (`["csv"]`, `["json"]` or both), `include_files`, `status` (`preparing` → `ready` \| `failed`; `expired` once deleted after 7 days), `file_id?` (→ files, set null; the ZIP is never served by `/files/:id`), `size_bytes?`, `error?`, `expires_at`, timestamps — migration `0075_data_exports` | US-SET-15 |
| Search indexes | `pg_trgm` extension and GIN `gin_trgm_ops` indexes on `contacts.name`, `quotes.number`, `invoices.number`, `jobs.name`, `jobs.number`, `vendor_bills.bill_number`, `expenses.number` — migration `0076_search_trigram` (hand-written: `CREATE EXTENSION IF NOT EXISTS pg_trgm`) | US-OPS-22 |
| `files` | `storage_driver text not null default 'local'` (`local`/`s3`), `checksum_sha256 text` (backfilled by the first `file-integrity-check` run), `integrity_problem text` (`damaged`/`missing`, null when intact), `integrity_checked_at timestamptz`; index `(org_id, integrity_problem)` | US-OPS-27, US-OPS-28 |
| `settings` key `last_backup_at` | ISO timestamp of the last successful `backup.sh` run | US-OPS-03 |
| `jobs` | `cost_budget_amount bigint` (nullable; a target, never posted; migration `0069`). Omitted from Field responses with the other money fields (`JOB_MONEY_FIELDS`), including job history | US-JOB-24 |
| `jobs` | `percent_complete numeric(5,2)` (nullable, 0–100; migration `0070`). Not money: Field responses keep it | US-JOB-28 |
| `invoices` | `progress_claim_no integer` (nullable; progress invoices only, set at issue as the job's max + 1 under the job row lock, never reused); unique (`job_id`, `progress_claim_no`) `invoices_job_progress_claim_uidx` (migration `0071`) | US-JOB-29 |
| `expenses` | `entry_mode text not null default 'amount'` (`amount`/`labour`) | US-PUR-23 |
| `expense_labour_lines` (new) | `id`, `org_id`, `expense_id` → expenses (cascade), `sort_order`, `trade text`, `headcount integer` (> 0), `day_rate_amount bigint` (> 0), `line_amount bigint` (= headcount × day rate); max 20 per expense; the expense `amount` is their sum. No worker names or hours (D-126). Migration `0072` | US-PUR-23 |
| `accounts`, `expense_categories` | Rows seeded when the Construction template is chosen: accounts 5300 Plant & Equipment Hire, 5400 Fuel & Freight, 5500 Site Overheads & Permits; six expense categories mapped to 5000–5500. Existing codes and names are kept, never duplicated (D-129) | US-ONB-13 |
| Rate and quantity columns | `tax_rates.rate`, `quote_lines`/`invoice_lines`/`credit_note_lines`/`vendor_bill_lines` `.quantity`, `.discount_percentage`, `.tax_rate_percentage`, `catalog_items.default_tax_rate_percentage`, `jobs.retention_pct`, `milestones.amount`: `real` → `numeric(18,4)` | US-TAX-07 |
| `money_accounts` (new) | `id`, `org_id`, `account_id` (→ accounts, unique), `kind` enum `money_account_kind` (`bank`/`cash`/`card`), `name` (unique per org among active), `bank_name?`, `last4?`, `is_default boolean` (exactly one per org, partial unique index), `statement_mapping jsonb?` (D-157), `archived_at`, timestamps. Migration `0077` creates rows for 1000 (cash) and 1010 (bank, default) in every organisation (an organisation without 1010 gets its lowest-coded money account as default), and sign-up seeds the same two (D-140). Name uniqueness is case-insensitive (`money_accounts_active_name_uidx` on `lower(name)` where not archived) | US-BANK-01 |
| `accounts` | System account **3900 Opening Balance Adjustments** (equity) seeded by migration; new bank/cash accounts use codes 1011–1099, card accounts 2300–2399 (liability) | US-BANK-01, US-RPT-16 |
| `user` | `last_money_accounts jsonb` (`{ payment, vendor_payment, expense, refund, tax_payment, money_in_out: money_account_id }`) | US-BANK-03 |
| `payments`, `vendor_payments`, `expenses` | `money_account_id uuid → money_accounts` (restrict; migration `0078` backfills it from the money account on each posted entry, then the organisation default for anything unposted; the services always set it on new rows, so it's nullable only for opening customer credit) | US-BANK-03 |
| `bank_transfers` (new) | `id`, `org_id`, `from_money_account_id`, `to_money_account_id` (different: check `bank_transfers_different_accounts`), `amount bigint > 0` (check), `date`, `reference?`, `entry_id → journal_entries`, `reversal_entry_id?`, `created_by_user_id`, `deleted_at?`, timestamps; index (`org_id`, `date`). Migration `0079`. Its references are NO ACTION so deleting an organisation still cascades | US-BANK-04 |
| `bank_transactions` (new) | `id`, `org_id`, `money_account_id`, `direction` enum `bank_transaction_direction` (`in`/`out`), `account_id` (the category; never a control account or a money account — service check), `contact_id?`, `amount bigint > 0` (what moved through the account; tax included on money out), `tax_rate_id?`/`tax_group_id?`, `tax_amount bigint default 0` (`>= 0` and `< amount`), `date`, `description?`, `entry_id`, `reversal_entry_id?`, `created_by_user_id`, `deleted_at?`, timestamps; index (`org_id`, `date`). Migration `0080`, which also adds account 4800 Interest Received (D-174) | US-BANK-05 |
| `bank_statement_imports` (new) | `id`, `org_id`, `money_account_id`, `file_name`, `imported_count`, `skipped_count`, `failed_rows jsonb`, `imported_by_user_id`, `created_at` (the CSV file itself isn't stored). Migration `0089` | US-BANK-07 |
| `bank_statement_lines` (new) | `id`, `org_id`, `money_account_id`, `import_id`, `date`, `description`, `reference?`, `amount bigint` (signed in the account's own sense: money in or a card payment > 0, like a debit), `running_balance bigint?`, `dedupe_key` (unique per account: date + amount + normalised description), `row_number` (its row in the file, for same-day order; migration `0090`), `status` enum `statement_line_status` (`unmatched`/`matched`/`excluded`), `exclude_note?`, `reconciliation_id?` | US-BANK-07, US-BANK-08 |
| `bank_statement_line_matches` (new) | `id`, `statement_line_id` → bank_statement_lines (cascade), `journal_line_id` → journal_lines (no action: journal lines are never deleted), `reconciliation_id` → bank_reconciliations (cascade), `created_at`; unique (`journal_line_id`) — undo deletes a reconciliation's matches. Migration `0091` | US-BANK-08 |
| `bank_reconciliations` (new) | `id`, `org_id`, `money_account_id`, `statement_end_date`, `statement_closing_balance bigint` (in the account's own sense: what a card owes), `status` enum `reconciliation_status` (`in_progress`/`finished`/`undone`), `opening_balance bigint?` and `brought_forward_before date?` (fixed on finish, D-176), `started_by_user_id`, `finished_by_user_id?`, `finished_at?`, `undone_by_user_id?`, `undone_at?`, timestamps; at most one `in_progress` per account (partial unique index). `bank_statement_lines.reconciliation_id` → it. Migration `0091` | US-BANK-08–US-BANK-11 |
| `journal_lines` | `reconciliation_id uuid? → bank_reconciliations` (set when a finished reconciliation matched it; cleared on undo) | US-BANK-10 |
| `opening_balances` (new) | `org_id` PK, `cutover_date`, `status` (`draft`/`locked`), `entry_id?` (the current P17 entry), `locked_at?`, `locked_by_user_id?`, `fiscal_period_id?` (the closed period created by locking) | US-RPT-16, US-RPT-19 |
| `opening_balance_lines` (new) | `org_id`, `account_id` (never 1100, 1150, 2000, 2200, 3900), `debit bigint`, `credit bigint` (one-sided) | US-RPT-16 |
| `invoices` | `type` enum gains `opening` (no lines, no tax, no PDF; `number` is the old system's number, unique with all invoices); `retention_held_amount` used for opening retention | US-RPT-17 |
| `payments` | `is_opening boolean default false` (opening customer credit: no money account, posts P19) | US-RPT-17 |
| `vendor_bills` | `is_opening boolean default false` (no lines; posts P20); `recurring_bill_id?` → recurring_bills (set null), `recurring_run_on date?`, unique (`recurring_bill_id`, `recurring_run_on`) | US-RPT-18, US-PUR-30 |
| `manual_journals` (new) | `id`, `org_id`, `number` (`JNL-0001`, numbering type `journal`), `date`, `reason`, `status` (`posted`/`reversed`), `entry_id`, `reversal_entry_id?`, `reversal_reason?`, `reversed_at?`, `created_by_user_id`, timestamps | US-RPT-20, US-RPT-21 |
| `manual_journal_lines` (new) | `id`, `journal_id` (cascade), `sort_order`, `account_id` (never a control account, D-134), `description?`, `debit bigint`, `credit bigint` (one-sided), `job_id?` | US-RPT-20 |
| `credit_notes` | `credit_remaining_amount bigint default 0` (the excess over the invoice's balance held as customer credit, D-142); check `>= 0`. Migration `0083` | US-PAY-16 |
| `credit_note_allocations` (new) | `id`, `org_id`, `credit_note_id → credit_notes`, `invoice_id → invoices`, `amount bigint > 0`, `entry_id → journal_entries` (the P6 entry), `created_by_user_id`, `created_at`; spare credit applied to another invoice, under a lock on the credit note (US-PAY-16). Migration `0083` | US-PAY-16 |
| `customer_refunds` (new) | `id`, `org_id`, `contact_id`, `source_payment_id?` xor `source_credit_note_id?` (check), `money_account_id`, `amount bigint > 0`, `date`, `method` (`payment_method`), `reference?`, `entry_id`, `reversal_entry_id?`, `created_by_user_id`, `deleted_at?`, timestamps. Refunds stay within the source's credit by checks on the source rather than a trigger: `payments.refunded_amount` with `allocated_amount + refunded_amount <= amount`, and `credit_notes.credit_remaining_amount >= 0`. Migration `0084` (also backfills `payments.refund`, off) | US-PAY-17 |
| `payments` | `refunded_amount bigint default 0` (US-PAY-17); checks `refunded_amount >= 0` and `allocated_amount + refunded_amount <= amount` | US-PAY-17 |
| `vendor_credits` (new) | `id`, `org_id`, `number?` (`VCR-0001` at record, numbering type `vendor_credit`), `vendor_reference?`, `contact_id`, `bill_id?` (against bill, set null), `job_id?`, `date`, `status` enum `vendor_credit_status` (`draft`/`open`/`used`/`void`), `currency`, totals (`subtotal_amount`, `tax_amount`, `total_amount`, `balance_amount` — check `0 <= balance <= total`), `is_opening boolean`, `notes?`, `recorded_at?`, `void_reason?`, `voided_at?`, `entry_id?`, `void_entry_id?`, `created_by_user_id`, timestamps. Migration `0085` (with the `vendor_credits.*` backfill) | US-PUR-24, US-RPT-18 |
| `vendor_credit_lines` (new) | same shape as `vendor_bill_lines`, keyed by `vendor_credit_id` (cascade) | US-PUR-24 |
| `vendor_credit_allocations` (new) | `id`, `org_id`, `vendor_credit_id`, `bill_id`, `amount bigint > 0`, `created_by_user_id`, `created_at`; deferred trigger `check_vendor_credit_allocation_limits`: Σ allocations (+ refunds from US-PUR-26) ≤ credit total, and a bill's payments + credits ≤ its total (0029's vendor-payment trigger now counts credits too). Migration `0086` | US-PUR-25 |
| `vendor_bills` | `credited_amount bigint default 0` (vendor credits applied); check `amount_paid + credited_amount <= total_amount`. Migration `0086` | US-PUR-25 |
| `vendor_refunds` (new) | `id`, `org_id`, `vendor_credit_id`, `money_account_id`, `amount bigint > 0`, `date`, `method` (`vendor_payment_method`), `reference?`, `entry_id`, `reversal_entry_id?`, `created_by_user_id`, `deleted_at?`, timestamps; the deferred trigger (0087) keeps a credit's applications plus live refunds within it. Migration `0087` | US-PUR-26 |
| `recurring_bills` (new), `recurring_bill_lines` (new) | Same shape as `recurring_invoices` / `recurring_invoice_lines` with `contact_id` a vendor and `mode` enum `recurring_bill_mode` (`record`/`draft`) | US-PUR-29 |
| `tax_payments` (new) | `id`, `org_id`, `kind` (`payment`/`refund`), `period_from?`, `period_to?` (payments only, required for them, from ≤ to), `input_tax_used bigint` default 0 (payments only), `amount bigint` (≥ 0; amount + input tax used > 0; > 0 for a refund), `money_account_id?` (required when `amount` > 0), `date`, `reference?`, `entry_id`, `reversal_entry_id?`, `created_by_user_id`, `deleted_at?`; index (`org_id`, `date`). Migration `0088` | US-TAX-08 |
| `attachments` (new) | `id`, `org_id`, `entity_type` enum `attachment_entity` (`quote`, `invoice`, `credit_note`, `payment`, `customer_refund`, `vendor_bill`, `vendor_credit`, `vendor_payment`, `expense`, `manual_journal`, `bank_transaction`, `contact`), `entity_id uuid`, `file_id? → files` (set null when a removed attachment's stored file is deleted, migration `0082`), `created_by_user_id`, `created_at`, `removed_at?`, `removed_by_user_id?`, `removal_reason?`; at most 10 live rows per record (service check, under an advisory lock per record); a file is live on at most one record; index (`org_id`, `entity_type`, `entity_id`) and (`file_id`). Migration `0081` | US-OPS-33–US-OPS-35 |
| `settings` key `tax_profile` | `{ country: "IN"\|"GB"\|"AU"\|"NZ"\|"AE"\|"SA"\|"other", registrationNumber?, legalName?, tradeName?, stateCode?, registeredOn?, returnPeriod: "monthly"\|"quarterly", defaultIntraTax?, defaultInterTax? }` | US-TAX-09, US-TAX-12, US-DASH-25 |
| `tax_rates` | `tax_type` enum `tax_type` (`cgst`, `sgst`, `utgst`, `igst`, `cess`, `vat`, `gst`, `sales_tax`, `other`; existing rows → `other`) | US-TAX-10 |
| `tax_groups` | `scope` (`intra`/`inter`/`any`, default `any`) | US-TAX-10 |
| `catalog_items` | `supply_class` enum `supply_class` (`taxable`/`zero_rated`/`exempt`/`non_taxable`), `hsn_sac text?`, `inter_tax_rate_id?`, `inter_tax_group_id?` (the existing default tax becomes the intra-state tax) | US-TAX-11, US-TAX-13, US-TAX-14 |
| `quote_lines`, `invoice_lines`, `credit_note_lines`, `vendor_bill_lines`, `vendor_credit_lines`, `recurring_*_lines`, `catalog_bundle_lines` | `supply_class` and `hsn_sac` (snapshots) | US-TAX-11, US-TAX-14 |
| `contacts` | `gst_treatment` enum (`registered`, `unregistered`, `consumer`, `overseas`, `sez`; null outside India); `tax_id` holds the GSTIN | US-TAX-12 |
| `addresses` | `state_code text?` (two-digit GST state code in India; free region code elsewhere) | US-TAX-12 |
| `quotes`, `invoices`, `credit_notes`, `vendor_bills`, `vendor_credits` | `place_of_supply text?` (state code), `supply_type` (`intra`/`inter`/`export`, null without GST) — snapshotted at issue/record | US-TAX-13 |
| `invoices` | `upi_qr_amount bigint?` (the amount encoded in the issued PDF's UPI QR) | US-INV-26 |
| `settings` key `business_profile` | gains `upiId`, `upiPayeeName`, `showUpiQr` | US-INV-25 |
| `settings` key `tally_mapping` | `{ [accountId]: tallyGroupName }` | US-RPT-39 |
| `settings` key `document_layout` | `{ [docType: quote\|invoice\|credit_note\|receipt\|statement]: { paperSize, columns: { quantity, discount, hsnSac, lineTax }, title, terms, notes, signature, amountInWords, taxSummary, upiQr } , signatureFileId? }` | US-SET-17–US-SET-19 |
| `settings` key `email_templates` | `{ [type: quote\|invoice\|reminder\|receipt\|credit_note\|statement]: { subject, body } }` (absent = Spine's default) | US-SET-21 |
| `settings` key `modules` | `{ leadsMeetings, jobsField, approvals, recurring }` booleans, all true when absent; `modules_changed_at` per module for the "missed dates" message | US-SET-23 |
| `settings` key `setup_hidden` | `string[]` of setup-card keys marked "not needed" | US-ONB-15 |
| Member dashboard layout | gains `reportFavourites: string[]` and `profitBasis: "accrual"\|"cash"` | US-RPT-23, US-DASH-26 |
| `settings` key `ai` | `{ enabled, driver: "none"\|"openai-compatible"\|"anthropic", baseUrl?, model?, apiKeyEncrypted?, apiKeyHint?, supportsImages?, features: { readDocuments, draftEmails, draftQuoteLines, bankSuggestions }, monthlyTokenBudget?, acknowledgedAt?, acknowledgedByUserId? }` — the key is never returned by the API | US-AI-01–US-AI-04 |
| `ai_requests` (new) | `id`, `org_id`, `user_id`, `feature` (`read_document`/`draft_email`/`draft_quote_lines`/`bank_suggestions`), `entity_type?`, `entity_id?`, `provider`, `model`, `input_tokens`, `output_tokens`, `duration_ms`, `outcome` (`ok`/`error`/`timeout`/`budget`/`rate_limited`), `error_code?`, `created_at`; index (`org_id`, `created_at`). No prompt or reply text | US-AI-04, US-AI-06 |
| `vendor_bills`, `expenses`, `quotes` | `ai_assisted boolean not null default false` (saved after AI filled fields) | US-AI-08, US-AI-09, US-AI-13 |
| `bank_statement_line_matches` | `suggested_by` (`rules`/`ai`/`person`, default `person`) | US-AI-14 |

Mobile-only, on the device (not in Postgres): `cache_*` tables (jobs, milestones, contacts, expenses, fetched_at) and `outbox` (`id` = idempotency key, `kind`, `payload`, `file_uri`, `status`, `attempts`, `last_error`, `created_at`) in the app's SQLite database ([02-architecture §Offline sync](02-architecture.md#offline-sync-mobile)).

## Table reference

### Identity, organisation and access

#### `user`

`id` text (PK) · `name` text (not null) · `email` text (not null) · `email_verified` boolean (not null, default false) · `image` text · `created_at` timestamp (not null, default now) · `updated_at` timestamp (not null, default now) · `theme_preference` text (not null, default "system") · `dashboard_layout` jsonb · `meeting_reminder_lead_minutes` integer

#### `session`

`id` text (PK) · `expires_at` timestamp (not null) · `token` text (not null) · `created_at` timestamp (not null, default now) · `updated_at` timestamp (not null) · `ip_address` text · `user_agent` text · `user_id` text (not null, → user (cascade)) · `active_organization_id` text

#### `account`

`id` text (PK) · `account_id` text (not null) · `provider_id` text (not null) · `user_id` text (not null, → user (cascade)) · `access_token` text · `refresh_token` text · `id_token` text · `access_token_expires_at` timestamp · `refresh_token_expires_at` timestamp · `scope` text · `password` text · `created_at` timestamp (not null, default now) · `updated_at` timestamp (not null)

#### `verification`

`id` text (PK) · `identifier` text (not null) · `value` text (not null) · `expires_at` timestamp (not null) · `created_at` timestamp (not null, default now) · `updated_at` timestamp (not null, default now)

#### `jwks`

`id` text (PK) · `public_key` text (not null) · `private_key` text (not null) · `created_at` timestamp (not null) · `expires_at` timestamp

#### `organization`

`id` text (PK) · `name` text (not null) · `slug` text (not null) · `logo` text · `created_at` timestamp (not null) · `metadata` text

#### `member`

`id` text (PK) · `organization_id` text (not null, → organization (cascade)) · `user_id` text (not null, → user (cascade)) · `role` text (not null, default "member") · `created_at` timestamp (not null) · `is_active` boolean (not null, default true) · `deactivated_at` timestamp · `is_primary_owner` boolean (not null, default false) · `is_demo` boolean (not null, default false)

#### `invitation`

`id` text (PK) · `organization_id` text (not null, → organization (cascade)) · `email` text (not null) · `role` text · `status` text (not null, default "pending") · `expires_at` timestamp (not null) · `created_at` timestamp (not null, default now) · `inviter_id` text (not null, → user (cascade))

#### `teams`

PRD §2.1/§7 — Teams subdivide the Staff tier with a configurable privilege matrix (team_privileges). Owner and Field stay fixed, non-configurable roles on `member.role` and never touch these tables.

`id` uuid (PK, default random) · `org_id` text (not null, → organization (cascade)) · `name` text (not null) · `is_default` boolean (not null, default false) · `created_at` timestamp (not null, default now) · `updated_at` timestamp (not null, default now)

#### `team_memberships`

`id` uuid (PK, default random) · `team_id` uuid (not null, → teams (cascade)) · `member_id` text (not null, → member (cascade)) · `created_at` timestamp (not null, default now)

#### `team_privileges`

`id` uuid (PK, default random) · `team_id` uuid (not null, → teams (cascade)) · `capability` text (not null) · `granted` boolean (not null, default false)

#### `settings`

Identity/org/session/membership tables (organization, user, session, member, invitation) are owned by Better Auth — see src/auth/auth.ts and the generated schema in ./auth.ts. This file holds the org-scoped app settings that Better Auth has no opinion about.

`id` uuid (PK, default random) · `org_id` text (not null, → organization (cascade)) · `key` text (not null) · `value` jsonb (not null) · `updated_at` timestamp (not null, default now)

#### `push_subscriptions`

PRD S-10.12 (added 2026-08-08) — one row per browser/device push subscription, the Web Push API's `PushSubscription.toJSON()` shape (`endpoint` + a `keys.p256dh`/`keys.auth` pair) persisted so `NotificationsService.notify()` can call `web-push`'s `sendNotification` for every subscription belonging to a matched…

`id` uuid (PK, default random) · `org_id` text (not null, → organization (cascade)) · `user_id` text (not null, → user (cascade)) · `endpoint` text (not null) · `p256dh` text (not null) · `auth` text (not null) · `created_at` timestamp (not null, default now)

### Platform

#### `number_sequences`

One row per (org, document type). Allocating the next number requires a row lock (`SELECT ... FOR UPDATE`) inside the issuing transaction so numbers stay gapless — see §6.5. Drafts never touch this table.

`id` uuid (PK, default random) · `org_id` text (not null, → organization (cascade)) · `document_type` text (not null) · `prefix` text (not null) · `padding` integer (not null, default 4) · `year_token` text · `next_value` integer (not null, default 1) · `updated_at` timestamp (not null, default now)

#### `audit_log`

One entry per create/update/issue/void/delete on any financial document, per §10.4/S-10.6. Written alongside the mutation, never edited afterward. First real write instrumentation lands scoped to Contacts (see apps/api/src/modules/audit/audit-log.service.ts) — `entityType` is one of…

`id` uuid (PK, default random) · `org_id` text (not null, → organization (cascade)) · `actor_user_id` text (→ user (set null)) · `action` text (not null) · `entity_type` text (not null) · `entity_id` text (not null; uuid of the record, or a user id for `user`) · `contact_id` uuid (→ contacts (cascade)) · `changes` jsonb · `created_at` timestamp (not null, default now)

#### `idempotency_keys`

Backs the `Idempotency-Key` header required on mutating endpoints per CLAUDE.md/§10.4/§6.6 (critical for the mobile offline outbox, but applied here to the onboarding wizard's write endpoints too, as the first module with real mutating routes). This is the first place in the codebase this pattern is established —…

`id` uuid (PK, default random) · `org_id` text (not null, → organization (cascade)) · `endpoint` text (not null) · `key` text (not null) · `response_body` jsonb · `response_status` text (not null) · `created_at` timestamp (not null, default now)

#### `files`

A generic, org-scoped uploaded-file record — the storage key (inside the driver named by `storage_driver`, US-OPS-27) plus enough metadata to serve and label it. Deliberately NOT a polymorphic `attachableType`/`attachableId` association: nothing in this codebase uses that pattern (checked `journal_lines.contact_id`/`job_id`, both plain nullable FKs to a single…

`id` uuid (PK, default random) · `org_id` text (not null, → organization (cascade)) · `key` text (not null) · `original_filename` text (not null) · `mime_type` text (not null) · `size_bytes` bigint (not null) · `uploaded_by_user_id` text (→ user (set null)) · `created_at` timestamp (not null, default now)

#### `notifications`

PRD S-10.11 (added 2026-08-08 at the user's explicit request — see CHANGELOG for the scope discussion) — the persisted, in-app-visible half of a notification. `NotificationsService.notify()` (built in Quotes Stage 3, S-03.7) already queues an email per recipient; this table is the second, additive delivery channel for…

`id` uuid (PK, default random) · `org_id` text (not null, → organization (cascade)) · `recipient_user_id` text (not null, → user (cascade)) · `type` text (not null) · `message` text (not null) · `link` text · `read_at` timestamp · `created_at` timestamp (not null, default now)

### CRM

#### `contacts`

Customer, vendor, or both — per PRD F1 ("MUST ... mark a contact as customer, vendor or both"). Modeled as a fixed enum rather than two booleans since exactly these three states are meaningful and a pg enum matches the existing `accountTypeEnum` pattern in ./ledger.ts. / export const contactTypeEnum =…

`id` uuid (PK, default random) · `org_id` text (not null, → organization (cascade)) · `type` enum(contactType) (not null) · `is_company` boolean (not null, default false) · `name` text (not null) · `email` text · `phone` text · `notes` text · `tax_id` text · `website` text · `logo_file_id` uuid (→ files (set null)) · `is_demo` boolean (not null, default false) · `created_by_user_id` text (→ user (set null)) · `archived_at` timestamp · `created_at` timestamp (not null, default now) · `updated_at` timestamp (not null, default now)

#### `contact_persons`

Customer, vendor, or both — per PRD F1 ("MUST ... mark a contact as customer, vendor or both"). Modeled as a fixed enum rather than two booleans since exactly these three states are meaningful and a pg enum matches the existing `accountTypeEnum` pattern in ./ledger.ts. / export const contactTypeEnum =…

`id` uuid (PK, default random) · `contact_id` uuid (not null, → contacts (cascade)) · `name` text (not null) · `title` text · `email` text · `phone` text · `is_primary` boolean (not null, default false) · `logo_file_id` uuid (→ files (set null)) · `created_at` timestamp (not null, default now) · `updated_at` timestamp (not null, default now)

#### `addresses`

Customer, vendor, or both — per PRD F1 ("MUST ... mark a contact as customer, vendor or both"). Modeled as a fixed enum rather than two booleans since exactly these three states are meaningful and a pg enum matches the existing `accountTypeEnum` pattern in ./ledger.ts. / export const contactTypeEnum =…

`id` uuid (PK, default random) · `contact_id` uuid (not null, → contacts (cascade)) · `type` enum(addressType) (not null, default "billing") · `line1` text (not null) · `line2` text · `city` text · `state` text · `postal_code` text · `country` text · `is_primary` boolean (not null, default false) · `created_at` timestamp (not null, default now) · `updated_at` timestamp (not null, default now)

#### `leads`

Customer, vendor, or both — per PRD F1 ("MUST ... mark a contact as customer, vendor or both"). Modeled as a fixed enum rather than two booleans since exactly these three states are meaningful and a pg enum matches the existing `accountTypeEnum` pattern in ./ledger.ts. / export const contactTypeEnum =…

`id` uuid (PK, default random) · `org_id` text (not null, → organization (cascade)) · `contact_id` uuid (not null, → contacts (cascade)) · `stage` enum(leadStage) (not null, default "new") · `value_amount` bigint (not null, default sql`0`) · `value_currency` text (not null) · `source` text · `owner_user_id` text (→ user (set null)) · `created_by_user_id` text (→ user (set null)) · `title` text · `created_at` timestamp (not null, default now) · `updated_at` timestamp (not null, default now)

#### `activities`

Customer, vendor, or both — per PRD F1 ("MUST ... mark a contact as customer, vendor or both"). Modeled as a fixed enum rather than two booleans since exactly these three states are meaningful and a pg enum matches the existing `accountTypeEnum` pattern in ./ledger.ts. / export const contactTypeEnum =…

`id` uuid (PK, default random) · `org_id` text (not null, → organization (cascade)) · `contact_id` uuid (→ contacts (cascade)) · `lead_id` uuid (→ leads (cascade)) · `type` enum(activityType) (not null) · `notes` text · `due_at` timestamp · `done_at` timestamp · `assigned_to_user_id` text (→ user (set null)) · `created_by_user_id` text (→ user (set null)) · `created_at` timestamp (not null, default now) · `updated_at` timestamp (not null, default now)

#### `meetings`

Mirrors @spine/ui's CALENDAR_EVENT_COLORS (packages/ui/src/lib/calendar-utils.ts) — kept in sync manually since the web app's Calendar component owns that list and the API has no dependency on @spine/ui. / export const meetingColorEnum = pgEnum("meeting_color", [ "blue", "green", "amber", "red", "purple", "teal",…

`id` uuid (PK, default random) · `org_id` text (not null, → organization (cascade)) · `contact_id` uuid (→ contacts (set null)) · `title` text (not null) · `start_at` timestamp (not null) · `end_at` timestamp (not null) · `all_day` boolean (not null, default false) · `color` enum(meetingColor) (not null, default "blue") · `description` text · `location` text · `recurrence` jsonb · `organizer_user_id` text (→ user (set null)) · `visibility` enum(meetingVisibility) (not null, default "private") · `is_demo` boolean (not null, default false) · `created_at` timestamp (not null, default now) · `updated_at` timestamp (not null, default now)

#### `meeting_attendees`

Mirrors @spine/ui's CALENDAR_EVENT_COLORS (packages/ui/src/lib/calendar-utils.ts) — kept in sync manually since the web app's Calendar component owns that list and the API has no dependency on @spine/ui. / export const meetingColorEnum = pgEnum("meeting_color", [ "blue", "green", "amber", "red", "purple", "teal",…

`id` uuid (PK, default random) · `meeting_id` uuid (not null, → meetings (cascade)) · `user_id` text (→ user (set null)) · `status` enum(meetingAttendeeStatus) (not null, default "invited") · `invited_at` timestamp (not null, default now) · `responded_at` timestamp · `reminded_at` timestamp · `reminded_for_occurrence_start` timestamp

#### `meeting_occurrence_exceptions`

Mirrors @spine/ui's CALENDAR_EVENT_COLORS (packages/ui/src/lib/calendar-utils.ts) — kept in sync manually since the web app's Calendar component owns that list and the API has no dependency on @spine/ui. / export const meetingColorEnum = pgEnum("meeting_color", [ "blue", "green", "amber", "red", "purple", "teal",…

`id` uuid (PK, default random) · `meeting_id` uuid (not null, → meetings (cascade)) · `occurrence_date` timestamp (not null) · `status` enum(meetingOccurrenceExceptionStatus) (not null) · `start_at` timestamp · `end_at` timestamp · `title` text · `location` text · `description` text · `created_at` timestamp (not null, default now) · `updated_at` timestamp (not null, default now)

### Catalogue and tax

#### `catalog_items`

PRD F2 — goods/services with a unit, default price and default tax rate, so a future quote/invoice line can prefill from an item and then override (S-02.1/S-02.2). Org-scoped, following contacts.ts's own pattern exactly. Soft-delete via nullable `archivedAt`, not hard delete — same rationale as contacts.ts: once…

`id` uuid (PK, default random) · `org_id` text (not null, → organization (cascade)) · `name` text (not null) · `description` text · `unit` text (not null) · `category` text · `default_price_amount` bigint (not null, default sql`0`) · `default_price_currency` text (not null) · `default_tax_rate_percentage` real (not null, default 0) · `default_tax_rate_id` uuid (→ taxRates (set null)) · `default_tax_group_id` uuid (→ taxGroups (set null)) · `income_account_id` uuid (→ accounts (restrict)) · `expense_account_id` uuid (→ accounts (restrict)) · `is_demo` boolean (not null, default false) · `created_by_user_id` text (→ user (set null)) · `archived_at` timestamp · `created_at` timestamp (not null, default now) · `updated_at` timestamp (not null, default now)

#### `tax_rates`

PRD FEAT-08 — a named, org-defined tax rate (S-08.1), e.g. "GST" at 15% or "State Tax" at 6.5%. Replaces the earlier Phase 0/1 placeholder (a single `default_tax_rate` row in the generic `settings` table, still read by `tax.controller.ts` for onboarding) now that a real table exists. `rate` is a plain decimal…

`id` uuid (PK, default random) · `org_id` text (not null, → organization (cascade)) · `name` text (not null) · `rate` real (not null) · `is_compound` boolean (not null, default false) · `archived_at` timestamp · `created_at` timestamp (not null, default now) · `updated_at` timestamp (not null, default now)

#### `tax_groups`

PRD FEAT-08 — a named, org-defined tax rate (S-08.1), e.g. "GST" at 15% or "State Tax" at 6.5%. Replaces the earlier Phase 0/1 placeholder (a single `default_tax_rate` row in the generic `settings` table, still read by `tax.controller.ts` for onboarding) now that a real table exists. `rate` is a plain decimal…

`id` uuid (PK, default random) · `org_id` text (not null, → organization (cascade)) · `name` text (not null) · `archived_at` timestamp · `created_at` timestamp (not null, default now) · `updated_at` timestamp (not null, default now)

#### `tax_group_rates`

`id` uuid (PK, default random) · `tax_group_id` uuid (not null, → taxGroups (cascade)) · `tax_rate_id` uuid (not null, → taxRates (restrict))

### Sales

#### `quotes`

PRD F3 — quotes with multi-line pricing and versioning (S-03.1, S-03.8). Stage 1 scope: data model + core CRUD + line items + versioning only — no PDF, email, public link, view/accept/reject event tracking, or owner notifications (those are Stage 2/3, see CHANGELOG). Org-scoped, following contacts.ts/catalog.ts's own…

`id` uuid (PK, default random) · `org_id` text (not null, → organization (cascade)) · `contact_id` uuid (not null, → contacts (restrict)) · `number` text · `status` enum(quoteStatus) (not null, default "draft") · `parent_quote_id` uuid · `version` integer (not null, default 1) · `valid_until` date · `currency` text (not null) · `subtotal_amount` bigint (not null, default sql`0`) · `discount_amount` bigint (not null, default sql`0`) · `tax_amount` bigint (not null, default sql`0`) · `total_amount` bigint (not null, default sql`0`) · `discount_requires_approval` boolean (not null, default false) · `approved_by_user_id` text (→ user (set null)) · `approved_at` timestamp · `notes` text · `terms_and_conditions` text · `created_by_user_id` text (→ user (set null)) · `sent_at` timestamp · `responded_at` timestamp · `response_comment` text · `acceptance_method` enum(quoteAcceptanceMethod) · `accepted_by_user_id` text (→ user (set null)) · `pdf_file_id` uuid (→ files (set null)) · `email_status` enum(quoteEmailStatus) · `email_error` text · `email_sent_at` timestamp · `is_demo` boolean (not null, default false) · `created_at` timestamp (not null, default now) · `updated_at` timestamp (not null, default now)

#### `quote_lines`

PRD F3 — quotes with multi-line pricing and versioning (S-03.1, S-03.8). Stage 1 scope: data model + core CRUD + line items + versioning only — no PDF, email, public link, view/accept/reject event tracking, or owner notifications (those are Stage 2/3, see CHANGELOG). Org-scoped, following contacts.ts/catalog.ts's own…

`id` uuid (PK, default random) · `quote_id` uuid (not null, → quotes (cascade)) · `sort_order` integer (not null, default 0) · `type` enum(quoteLineType) (not null, default "item") · `catalog_item_id` uuid (→ catalogItems (set null)) · `name` text (not null) · `description` text · `quantity` real (not null, default 0) · `unit_price_amount` bigint (not null, default sql`0`) · `unit_price_currency` text (not null) · `discount_percentage` real (not null, default 0) · `tax_rate_percentage` real (not null, default 0) · `tax_rate_id` uuid (→ taxRates (set null)) · `tax_group_id` uuid (→ taxGroups (set null)) · `is_tax_inclusive` boolean (not null, default false) · `line_subtotal_amount` bigint (not null, default sql`0`) · `line_tax_amount` bigint (not null, default sql`0`) · `line_total_amount` bigint (not null, default sql`0`) · `created_at` timestamp (not null, default now) · `updated_at` timestamp (not null, default now)

#### `quote_events`

PRD F3 — quotes with multi-line pricing and versioning (S-03.1, S-03.8). Stage 1 scope: data model + core CRUD + line items + versioning only — no PDF, email, public link, view/accept/reject event tracking, or owner notifications (those are Stage 2/3, see CHANGELOG). Org-scoped, following contacts.ts/catalog.ts's own…

`id` uuid (PK, default random) · `quote_id` uuid (not null, → quotes (cascade)) · `org_id` text (not null, → organization (cascade)) · `type` enum(quoteEventType) (not null) · `comment` text · `ip_address` text · `user_agent` text · `created_at` timestamp (not null, default now)

#### `quote_public_tokens`

PRD F3 — quotes with multi-line pricing and versioning (S-03.1, S-03.8). Stage 1 scope: data model + core CRUD + line items + versioning only — no PDF, email, public link, view/accept/reject event tracking, or owner notifications (those are Stage 2/3, see CHANGELOG). Org-scoped, following contacts.ts/catalog.ts's own…

`id` uuid (PK, default random) · `nonce` text (not null) · `quote_id` uuid (not null, → quotes (cascade)) · `org_id` text (not null, → organization (cascade)) · `expires_at` timestamp (not null) · `revoked_at` timestamp · `created_at` timestamp (not null, default now)

### Jobs

#### `jobs`

`id` uuid (PK, default random) · `org_id` text (not null, → organization (cascade)) · `contact_id` uuid (not null, → contacts (restrict)) · `source_quote_id` uuid (→ quotes (set null)) · `name` text (not null) · `site_address` text · `status` enum(jobStatus) (not null, default "active") · `start_date` date · `end_date` date · `currency` text (not null) · `contract_value_amount` bigint (not null, default sql`0`) · `retention_pct` real (not null, default 0) · `notes` text · `created_by_user_id` text (→ user (set null)) · `is_demo` boolean (not null, default false) · `created_at` timestamp (not null, default now) · `updated_at` timestamp (not null, default now)

#### `milestones`

`id` uuid (PK, default random) · `job_id` uuid (not null, → jobs (cascade)) · `org_id` text (not null, → organization (cascade)) · `name` text (not null) · `sequence` integer (not null, default 0) · `amount_type` enum(milestoneAmountType) (not null, default "percent") · `amount` real (not null, default 0) · `resolved_amount` bigint (not null, default sql`0`) · `status` enum(milestoneStatus) (not null, default "pending") · `due_date` date · `created_by_user_id` text (→ user (set null)) · `completed_by_user_id` text (→ user (set null)) · `completed_at` timestamp · `completion_notes` text · `invoiced_invoice_id` uuid · `created_at` timestamp (not null, default now) · `updated_at` timestamp (not null, default now)

#### `job_photos`

PRD F4 (Phase 3 · Jobs & Construction Billing) — a job created from an accepted quote (S-04.1), carrying the contract value over as a real snapshot rather than a live reference back to the quote (per CLAUDE.md's "documents snapshot their data" — a job must not silently change value if its source quote were ever…

`id` uuid (PK, default random) · `job_id` uuid (not null, → jobs (cascade)) · `org_id` text (not null, → organization (cascade)) · `milestone_id` uuid (→ milestones (set null)) · `file_id` uuid (not null, → files (cascade)) · `caption` text · `uploaded_by_user_id` text (→ user (set null)) · `created_by_user_id` text (→ user (set null)) · `created_at` timestamp (not null, default now)

#### `job_notes`

PRD F4 (Phase 3 · Jobs & Construction Billing) — a job created from an accepted quote (S-04.1), carrying the contract value over as a real snapshot rather than a live reference back to the quote (per CLAUDE.md's "documents snapshot their data" — a job must not silently change value if its source quote were ever…

`id` uuid (PK, default random) · `job_id` uuid (not null, → jobs (cascade)) · `org_id` text (not null, → organization (cascade)) · `body` text (not null) · `created_by_user_id` text (→ user (set null)) · `created_at` timestamp (not null, default now)

#### `job_variation_orders`

PRD F4 (Phase 3 · Jobs & Construction Billing) — a job created from an accepted quote (S-04.1), carrying the contract value over as a real snapshot rather than a live reference back to the quote (per CLAUDE.md's "documents snapshot their data" — a job must not silently change value if its source quote were ever…

`id` uuid (PK, default random) · `job_id` uuid (not null, → jobs (cascade)) · `quote_id` uuid (not null, → quotes (cascade)) · `org_id` text (not null, → organization (cascade)) · `applied_at` timestamp · `created_by_user_id` text (→ user (set null)) · `created_at` timestamp (not null, default now)

#### `job_assignments`

PRD F4 (Phase 3 · Jobs & Construction Billing) — a job created from an accepted quote (S-04.1), carrying the contract value over as a real snapshot rather than a live reference back to the quote (per CLAUDE.md's "documents snapshot their data" — a job must not silently change value if its source quote were ever…

`id` uuid (PK, default random) · `job_id` uuid (not null, → jobs (cascade)) · `user_id` text (not null, → user (cascade)) · `org_id` text (not null, → organization (cascade)) · `assigned_at` timestamp (not null, default now)

### Billing

#### `invoices`

PRD F5 — Invoicing (Phase 2 · Money In). Stage 1 scope: standard invoice CRUD, issue/void with ledger postings, PDF. Advances, credit notes, and milestone/progress invoicing are later stages (see CHANGELOG) — this enum and table are shaped so those slot in without a rework: `type` already distinguishes…

`id` uuid (PK, default random) · `org_id` text (not null, → organization (cascade)) · `contact_id` uuid (not null, → contacts (restrict)) · `number` text · `status` enum(invoiceStatus) (not null, default "draft") · `type` enum(invoiceType) (not null, default "standard") · `source_quote_id` uuid (→ quotes (set null)) · `job_id` uuid (→ jobs (set null)) · `milestone_id` uuid (→ milestones (set null)) · `issue_date` date · `due_date` date · `currency` text (not null) · `subtotal_amount` bigint (not null, default sql`0`) · `discount_amount` bigint (not null, default sql`0`) · `tax_amount` bigint (not null, default sql`0`) · `retention_amount` bigint (not null, default sql`0`) · `total_amount` bigint (not null, default sql`0`) · `amount_paid` bigint (not null, default sql`0`) · `credited_amount` bigint (not null, default sql`0`) · `notes` text · `terms_and_conditions` text · `created_by_user_id` text (→ user (set null)) · `issued_at` timestamp · `voided_at` timestamp · `voided_by_user_id` text (→ user (set null)) · `void_reason` text · `journal_entry_id` uuid (→ journalEntries (set null)) · `void_journal_entry_id` uuid (→ journalEntries (set null)) · `pdf_file_id` uuid (→ files (set null)) · `email_status` enum(invoiceEmailStatus) · `email_error` text · `email_sent_at` timestamp · `is_demo` boolean (not null, default false) · `created_at` timestamp (not null, default now) · `updated_at` timestamp (not null, default now)

#### `invoice_lines`

PRD F5 — Invoicing (Phase 2 · Money In). Stage 1 scope: standard invoice CRUD, issue/void with ledger postings, PDF. Advances, credit notes, and milestone/progress invoicing are later stages (see CHANGELOG) — this enum and table are shaped so those slot in without a rework: `type` already distinguishes…

`id` uuid (PK, default random) · `invoice_id` uuid (not null, → invoices (cascade)) · `sort_order` integer (not null, default 0) · `type` enum(invoiceLineType) (not null, default "item") · `catalog_item_id` uuid (→ catalogItems (set null)) · `name` text (not null) · `description` text · `quantity` real (not null, default 0) · `unit_price_amount` bigint (not null, default sql`0`) · `unit_price_currency` text (not null) · `discount_percentage` real (not null, default 0) · `tax_rate_percentage` real (not null, default 0) · `tax_rate_id` uuid (→ taxRates (set null)) · `tax_group_id` uuid (→ taxGroups (set null)) · `is_tax_inclusive` boolean (not null, default false) · `line_subtotal_amount` bigint (not null, default sql`0`) · `line_tax_amount` bigint (not null, default sql`0`) · `line_total_amount` bigint (not null, default sql`0`) · `created_at` timestamp (not null, default now) · `updated_at` timestamp (not null, default now)

#### `credit_notes`

PRD F5 (S-05.6) — "issue a credit note against an invoice for a return or correction, so I never edit an issued document." Structurally the simplest of the three document types (quotes/invoices/credit notes) — `draft -> issued` only, no void (there is no PRD story asking to undo a credit note; a mistaken one is simply…

`id` uuid (PK, default random) · `org_id` text (not null, → organization (cascade)) · `invoice_id` uuid (not null, → invoices (restrict)) · `contact_id` uuid (not null, → contacts (restrict)) · `number` text · `status` enum(creditNoteStatus) (not null, default "draft") · `reason` text · `date` date · `currency` text (not null) · `subtotal_amount` bigint (not null, default sql`0`) · `tax_amount` bigint (not null, default sql`0`) · `total_amount` bigint (not null, default sql`0`) · `created_by_user_id` text (→ user (set null)) · `issued_at` timestamp · `journal_entry_id` uuid (→ journalEntries (set null)) · `is_demo` boolean (not null, default false) · `created_at` timestamp (not null, default now) · `updated_at` timestamp (not null, default now)

#### `credit_note_lines`

PRD F5 (S-05.6) — "issue a credit note against an invoice for a return or correction, so I never edit an issued document." Structurally the simplest of the three document types (quotes/invoices/credit notes) — `draft -> issued` only, no void (there is no PRD story asking to undo a credit note; a mistaken one is simply…

`id` uuid (PK, default random) · `credit_note_id` uuid (not null, → creditNotes (cascade)) · `sort_order` integer (not null, default 0) · `type` enum(creditNoteLineType) (not null, default "item") · `catalog_item_id` uuid (→ catalogItems (set null)) · `name` text (not null) · `description` text · `quantity` real (not null, default 0) · `unit_price_amount` bigint (not null, default sql`0`) · `unit_price_currency` text (not null) · `tax_rate_percentage` real (not null, default 0) · `line_subtotal_amount` bigint (not null, default sql`0`) · `line_tax_amount` bigint (not null, default sql`0`) · `line_total_amount` bigint (not null, default sql`0`) · `created_at` timestamp (not null, default now) · `updated_at` timestamp (not null, default now)

#### `payments`

PRD F6 (S-06.1's own wording: "cash, bank transfer, cheque, card, UPI and 'other'"). */ export const paymentMethodEnum = pgEnum("payment_method", ["cash", "bank_transfer", "cheque", "card", "upi", "other"]); /** PRD F6 — Payments (Phase 2 · Money In). A payment is recorded against a CONTACT, not directly against an…

`id` uuid (PK, default random) · `org_id` text (not null, → organization (cascade)) · `contact_id` uuid (not null, → contacts (restrict)) · `number` text · `date` date (not null) · `method` enum(paymentMethod) (not null) · `reference` text · `currency` text (not null) · `amount` bigint (not null) · `allocated_amount` bigint (not null, default sql`0`) · `notes` text · `created_by_user_id` text (→ user (set null)) · `journal_entry_id` uuid (→ journalEntries (set null)) · `is_demo` boolean (not null, default false) · `created_at` timestamp (not null, default now) · `updated_at` timestamp (not null, default now)

#### `payment_allocations`

PRD F6 (S-06.1's own wording: "cash, bank transfer, cheque, card, UPI and 'other'"). */ export const paymentMethodEnum = pgEnum("payment_method", ["cash", "bank_transfer", "cheque", "card", "upi", "other"]); /** PRD F6 — Payments (Phase 2 · Money In). A payment is recorded against a CONTACT, not directly against an…

`id` uuid (PK, default random) · `org_id` text (not null, → organization (cascade)) · `payment_id` uuid (not null, → payments (cascade)) · `invoice_id` uuid (not null, → invoices (restrict)) · `amount` bigint (not null) · `created_at` timestamp (not null, default now)

### Purchases

#### `vendor_bills`

`id` uuid (PK, default random) · `org_id` text (not null, → organization (cascade)) · `contact_id` uuid (not null, → contacts (restrict)) · `job_id` uuid (→ jobs (restrict)) · `status` enum(vendorBillStatus) (not null, default "draft") · `bill_number` text (not null) · `date` date (not null) · `due_date` date · `currency` text (not null) · `subtotal_amount` bigint (not null, default sql`0`) · `tax_amount` bigint (not null, default sql`0`) · `total_amount` bigint (not null, default sql`0`) · `amount_paid` bigint (not null, default sql`0`) · `notes` text · `created_by_user_id` text (→ user (set null)) · `recorded_at` timestamp · `voided_at` timestamp · `voided_by_user_id` text (→ user (set null)) · `void_reason` text · `journal_entry_id` uuid (→ journalEntries (set null)) · `void_journal_entry_id` uuid (→ journalEntries (set null)) · `is_demo` boolean (not null, default false) · `created_at` timestamp (not null, default now) · `updated_at` timestamp (not null, default now)

#### `vendor_bill_lines`

PRD FEAT-07 (Phase 4 · Money Out & Books, Stage 2) — a vendor bill with lines, tax and a due date (S-07.1). Structurally mirrors `invoices`/ `invoice_lines` (snapshot-on-write lines, draft-is-mutable/recorded-is- immutable, same tax-rate/group FK + blended percentage shape from FEAT-08) with one deliberate difference:…

`id` uuid (PK, default random) · `bill_id` uuid (not null, → vendorBills (cascade)) · `sort_order` integer (not null, default 0) · `type` enum(vendorBillLineType) (not null, default "item") · `catalog_item_id` uuid (→ catalogItems (set null)) · `name` text (not null) · `description` text · `quantity` real (not null, default 0) · `unit_price_amount` bigint (not null, default sql`0`) · `unit_price_currency` text (not null) · `account_id` uuid (→ accounts (restrict)) · `tax_rate_percentage` real (not null, default 0) · `tax_rate_id` uuid (→ taxRates (set null)) · `tax_group_id` uuid (→ taxGroups (set null)) · `is_tax_inclusive` boolean (not null, default false) · `line_subtotal_amount` bigint (not null, default sql`0`) · `line_tax_amount` bigint (not null, default sql`0`) · `line_total_amount` bigint (not null, default sql`0`) · `created_at` timestamp (not null, default now) · `updated_at` timestamp (not null, default now)

#### `vendor_payments`

PRD FEAT-07 (Phase 4 · Money Out & Books, Stage 2) — a vendor bill with lines, tax and a due date (S-07.1). Structurally mirrors `invoices`/ `invoice_lines` (snapshot-on-write lines, draft-is-mutable/recorded-is- immutable, same tax-rate/group FK + blended percentage shape from FEAT-08) with one deliberate difference:…

`id` uuid (PK, default random) · `org_id` text (not null, → organization (cascade)) · `contact_id` uuid (not null, → contacts (restrict)) · `number` text · `date` date (not null) · `method` enum(vendorPaymentMethod) (not null) · `reference` text · `currency` text (not null) · `amount` bigint (not null) · `allocated_amount` bigint (not null, default sql`0`) · `notes` text · `created_by_user_id` text (→ user (set null)) · `journal_entry_id` uuid (→ journalEntries (set null)) · `is_demo` boolean (not null, default false) · `created_at` timestamp (not null, default now) · `updated_at` timestamp (not null, default now)

#### `vendor_payment_allocations`

PRD FEAT-07 (Phase 4 · Money Out & Books, Stage 2) — a vendor bill with lines, tax and a due date (S-07.1). Structurally mirrors `invoices`/ `invoice_lines` (snapshot-on-write lines, draft-is-mutable/recorded-is- immutable, same tax-rate/group FK + blended percentage shape from FEAT-08) with one deliberate difference:…

`id` uuid (PK, default random) · `org_id` text (not null, → organization (cascade)) · `vendor_payment_id` uuid (not null, → vendorPayments (cascade)) · `bill_id` uuid (not null, → vendorBills (restrict)) · `amount` bigint (not null) · `created_at` timestamp (not null, default now)

#### `expense_categories`

PRD FEAT-07 (Phase 4 · Money Out & Books, Stage 2) — a vendor bill with lines, tax and a due date (S-07.1). Structurally mirrors `invoices`/ `invoice_lines` (snapshot-on-write lines, draft-is-mutable/recorded-is- immutable, same tax-rate/group FK + blended percentage shape from FEAT-08) with one deliberate difference:…

`id` uuid (PK, default random) · `org_id` text (not null, → organization (cascade)) · `name` text (not null) · `account_id` uuid (→ accounts (restrict)) · `created_by_user_id` text (→ user (set null)) · `archived_at` timestamp · `created_at` timestamp (not null, default now) · `updated_at` timestamp (not null, default now)

#### `expenses`

`id` uuid (PK, default random) · `org_id` text (not null, → organization (cascade)) · `number` text · `category_id` uuid (not null, → expenseCategories (restrict)) · `job_id` uuid (→ jobs (restrict)) · `date` date (not null) · `currency` text (not null) · `amount` bigint (not null) · `tax_amount` bigint (not null, default sql`0`) · `tax_rate_id` uuid (→ taxRates (set null)) · `description` text · `paid_by` enum(expensePaidBy) (not null, default "company") · `receipt_file_id` uuid (→ files (set null)) · `status` enum(expenseStatus) (not null, default "submitted") · `submitted_by_user_id` text (→ user (set null)) · `approved_by_user_id` text (→ user (set null)) · `approved_at` timestamp · `rejected_by_user_id` text (→ user (set null)) · `rejected_at` timestamp · `review_comment` text · `is_billable` boolean (not null, default false) · `billed_on_invoice_line_id` uuid (→ invoiceLines (set null)) · `journal_entry_id` uuid (→ journalEntries (set null)) · `is_demo` boolean (not null, default false) · `created_at` timestamp (not null, default now) · `updated_at` timestamp (not null, default now)

### Ledger

#### `accounts`

`id` uuid (PK, default random) · `org_id` text (not null, → organization (cascade)) · `code` text (not null) · `name` text (not null) · `type` enum(accountType) (not null) · `parent_id` uuid · `is_system` boolean (not null, default false) · `created_at` timestamp (not null, default now) · `updated_at` timestamp (not null, default now)

#### `journal_entries`

System accounts (AR, AP, tax, retention, advances, retained earnings) cannot be deleted, per §14.2. */ isSystem: boolean("is_system").notNull().default(false), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true…

`id` uuid (PK, default random) · `org_id` text (not null, → organization (cascade)) · `date` date (not null) · `narration` text · `source_type` text (not null) · `source_id` uuid (not null) · `reversed_by_id` uuid · `total_debits` bigint (not null, default sql`0`) · `total_credits` bigint (not null, default sql`0`) · `created_at` timestamp (not null, default now)

#### `journal_lines`

`id` uuid (PK, default random) · `entry_id` uuid (not null, → journalEntries (cascade)) · `account_id` uuid (not null, → accounts (restrict)) · `debit` bigint (not null, default sql`0`) · `credit` bigint (not null, default sql`0`) · `contact_id` uuid (→ contacts (restrict)) · `job_id` uuid (→ jobs (restrict))

#### `fiscal_periods`

`id` uuid (PK, default random) · `org_id` text (not null, → organization (cascade)) · `start_date` date (not null) · `end_date` date (not null) · `is_closed` boolean (not null, default false)

### Enums

| Enum | Values |
|---|---|
| `account_type` | `asset`, `liability`, `equity`, `income`, `expense` |
| `activity_type` | `call`, `meeting`, `note`, `task` |
| `address_type` | `billing`, `shipping`, `site`, `other` |
| `contact_type` | `customer`, `vendor`, `both` |
| `credit_note_line_type` | `item`, `heading`, `text` |
| `credit_note_status` | `draft`, `issued` |
| `expense_paid_by` | `company`, `employee` |
| `expense_status` | `submitted`, `approved`, `rejected` |
| `invoice_email_status` | `pending`, `sent`, `failed` |
| `invoice_line_type` | `item`, `heading`, `text` |
| `invoice_status` | `draft`, `issued`, `void` |
| `invoice_type` | `standard`, `advance`, `progress`, `retention_release` |
| `job_status` | `active`, `on_hold`, `completed`, `cancelled` |
| `lead_stage` | `new`, `qualified`, `proposal`, `won`, `lost` |
| `meeting_attendee_status` | `invited`, `accepted`, `declined`, `tentative` |
| `meeting_color` | `blue`, `green`, `amber`, `red`, `purple`, `teal`, `pink`, `slate` |
| `meeting_occurrence_exception_status` | `modified`, `cancelled` |
| `meeting_visibility` | `private`, `org` |
| `milestone_amount_type` | `fixed`, `percent` |
| `milestone_status` | `pending`, `completed`, `invoiced` |
| `payment_method` | `cash`, `bank_transfer`, `cheque`, `card`, `upi`, `other` |
| `quote_acceptance_method` | `public_link`, `in_person` |
| `quote_email_status` | `pending`, `sent`, `failed` |
| `quote_event_type` | `viewed`, `accepted`, `rejected` |
| `quote_line_type` | `item`, `heading`, `text` |
| `quote_status` | `draft`, `sent`, `accepted`, `rejected` |
| `vendor_bill_line_type` | `item`, `heading`, `text` |
| `vendor_bill_status` | `draft`, `recorded`, `void` |
| `vendor_payment_method` | `cash`, `bank_transfer`, `cheque`, `card`, `upi`, `other` |
