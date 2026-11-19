# 12 · Accounting & reports

The books Spine keeps underneath: a seeded chart of accounts owners can extend, fiscal periods that can be closed, and the reports an owner and accountant need — Profit & Loss, Balance Sheet, Trial Balance, Tax Summary and job profitability — all derived from journal lines, all drillable to the source documents and exportable to CSV. From Phase 8 it also holds opening balances, adjusting journals, the accountant's reports (general ledger, day book, cash flow, comparisons, sales and purchase analysis), CSV, Excel, PDF and print on every report, a cash-basis P&L and read access for an accountant's Team; Phase 9 adds tax by type and the Tally export.

**Screens:** `ReportsPL` (P1), `ReportsEmpty` (P2), `ReportsBalanceSheet` (P1), `ReportsJobProfitability` (P1), `AccountDrilldownDialog` (P1), `SettingsAccounts` (P2), `AddAccountDialog` (P2), `TeamPrivileges` (P1), `ReportsTrialBalance` (P2), `ReportsTaxSummary` (P1), `DashboardOwner` (P1), `ReportsJobProfitabilityChart` (P1), `OpeningBalances` (P1), `OpeningBalancesDocuments` (P1), `OpeningBalancesReview` (P1), `ManualJournalDialog` (P1), `ManualJournalDetail` (P1), `ManualJournalsList` (P2), `ReportsCenter` (P1), `ReportsGeneralLedger` (P1), `ReportsDayBook` (P1), `ReportsCashFlow` (P1), `ReportsPLCompare` (P1), `ReportsSalesByCustomer` (P1), `ReportsExpensesByCategory` (P1), `ReportsPaymentsRegister` (P2), `ReportsCreditsRegister` (P2), `ReportExportMenu` (P1), `ReportPdf` (P1), `ReportsPLCashBasis` (P1), `TeamPrivilegesBooks` (P1), `ReportsTaxSummaryByType` (P1), `ReportsTallyExport` (P1), `TallyGroupMapping` (P2), `ReportsPLPhone` (P2), `ReportsPLPhoneFilters` (P2), `ReportsTrialBalancePhone` (P2)
**Depends on:** every posting module (06-ledger-posting-rules), 15 Team (report capabilities), 20 Banking (money accounts), 11 Tax (tax types, Phase 9).

## Features

| ID | Feature | Priority | Phase | Screens |
|---|---|---|---|---|
| F-RPT-01 | Profit & Loss and Balance Sheet | P1 | 4 | `ReportsPL`, `ReportsEmpty`, `ReportsBalanceSheet` |
| F-RPT-02 | Drill-down and CSV export | P1 | 4 | `AccountDrilldownDialog`, `ReportsPL` |
| F-RPT-03 | Job profitability | P1 | 4 | `ReportsJobProfitability`, `ReportsJobProfitabilityChart` |
| F-RPT-04 | Chart of accounts and period close | P2 | 4 | `SettingsAccounts`, `AddAccountDialog` |
| F-RPT-05 | Report access rights (accountant access in Phase 8) | P1 | 4 | `TeamPrivileges`, `AccountDrilldownDialog`, `TeamPrivilegesBooks` |
| F-RPT-06 | Ledger integrity monitoring | P1 | 6 | `DashboardOwner` |
| F-RPT-07 | Trial Balance and Tax Summary reports (tax by type in Phase 9) | P1 | 6 | `ReportsTrialBalance`, `ReportsTaxSummary`, `ReportsTaxSummaryByType` |
| F-RPT-08 | Opening balances | P1 | 8 | `OpeningBalances`, `OpeningBalancesDocuments`, `OpeningBalancesReview` |
| F-RPT-09 | Adjusting journals | P1 | 8 | `ManualJournalDialog`, `ManualJournalDetail`, `ManualJournalsList` |
| F-RPT-10 | Accountant's reports, the reports centre and one report layout | P1 | 8 | `ReportsCenter`, `ReportsGeneralLedger`, `ReportsDayBook`, `ReportsCashFlow`, `ReportsPLCompare`, `ReportsSalesByCustomer`, `ReportsExpensesByCategory`, `ReportsPaymentsRegister`, `ReportsCreditsRegister` |
| F-RPT-11 | Export and print every report | P1 | 8 | `ReportExportMenu`, `ReportPdf` |
| F-RPT-12 | Cash-basis profit and loss | P1 | 8 | `ReportsPLCashBasis` |
| F-RPT-13 | Export to Tally | P1 | 9 | `ReportsTallyExport`, `TallyGroupMapping` |
| F-RPT-14 | Reports on a phone: filters behind one line, statements as lists, tables only where the data is a grid (D-283) | P2 | 12 | `ReportsPLPhone`, `ReportsPLPhoneFilters`, `ReportsTrialBalancePhone` |

## User stories

### US-RPT-01 · See profit and loss for any period
**Feature:** F-RPT-01 · **Priority:** P1 · **Phase:** 4 · **Screens:** `ReportsPL`, `ReportsEmpty`
**As** an owner, **I want** a Profit & Loss for any date range, **so that** I know whether I'm making money.

Legacy: S-09.2

**Acceptance criteria**
- **Given** Reports ("Profit & Loss, Balance Sheet, and job profitability, derived from the ledger."; Trial Balance and Tax Summary join the subtitle with US-RPT-13/14 in Phase 6), **when** I open "Profit & Loss", **then** "From" and "To" default to the current financial year to date.
- **Given** a range with postings, **when** I press "Refresh", **then** I see "Income" lines by account with "Total income", "Expenses" lines with "Total expenses", and "Net profit".
- **Given** a range with no postings, **when** it loads, **then** I see "No income posted in this range." and "No expenses posted in this range.".
- **Given** a Staff or Field user, **when** they open the tab, **then** they see "Owner-only report." and no figures; the API returns 403.

**Implementation notes**
- API: `GET /reports/profit-and-loss?from=&to=` (roles: owner).
- Data: `journal_lines` grouped by income/expense account — never documents.

### US-RPT-02 · See what the business is worth on a date
**Feature:** F-RPT-01 · **Priority:** P1 · **Phase:** 4 · **Screens:** `ReportsBalanceSheet`
**As** an owner, **I want** a Balance Sheet as of a date, **so that** I know what the business owns and owes.

Legacy: S-09.3

**Acceptance criteria**
- **Given** "Balance Sheet", **when** I choose "As of" and refresh, **then** I see "Assets", "Liabilities" and "Equity" by account with their totals and "Total liabilities + equity".
- **Given** any date, **when** it renders, **then** Total assets equals Total liabilities + equity.
- **Given** profit not yet closed into retained earnings, **when** it renders, **then** equity shows a line "Retained Earnings (current period)" (D-030).
- **Given** a Staff user, **when** they open it, **then** they see "Owner-only report.".

**Implementation notes**
- API: `GET /reports/balance-sheet?asOf=` (roles: owner).

### US-RPT-03 · Click a figure to see the entries behind it
**Feature:** F-RPT-02 · **Priority:** P1 · **Phase:** 4 · **Screens:** `AccountDrilldownDialog`
**As** an owner, **I want** to click any account in a report and see its journal entries and documents, **so that** I trust the number.

Legacy: S-09.4

**Acceptance criteria**
- **Given** a report, **when** I click an account, **then** a dialog titled "<code> — <account>" lists each entry in range with date, description, debit or credit and running balance.
- **Given** an entry from an invoice, payment, bill or expense, **when** I click it, **then** I open that document.
- **Given** an account with nothing in range, **when** the dialog opens, **then** I see "No journal entries posted to this account in range.".

**Implementation notes**
- API: `GET /reports/account-drilldown?accountId=&from=&to=` (Owner, or Staff with `ledger.view`).

### US-RPT-04 · Export any report to CSV
**Feature:** F-RPT-02 · **Priority:** P1 · **Phase:** 4 · **Screens:** `ReportsPL`
**As** an owner, **I want** every report as CSV, **so that** my accountant can work with it.

Legacy: S-09.7

**Acceptance criteria**
- **Given** P&L, Balance Sheet or job profitability, **when** I choose "Export CSV", **then** a file downloads named after the report and range.
- **Given** the CSV, **when** it opens, **then** it has one row per account (or job/invoice) with plain decimal amounts and the currency in its own column.
- **Given** the on-screen range, **when** I export, **then** the file covers exactly that range.

**Implementation notes**
- API: `GET /reports/{profit-and-loss|balance-sheet|job-profitability}/export.csv`. Receivables and payables exports exist in the API; their page buttons are US-PAY-10 and US-PUR-14 (Phase 6).

### US-RPT-05 · Compare profitability across all jobs
**Feature:** F-RPT-03 · **Priority:** P1 · **Phase:** 4 · **Screens:** `ReportsJobProfitability`
**As** an owner, **I want** revenue, cost and margin for every job in one table, **so that** I learn which work is worth taking.

Legacy: S-09.6

**Acceptance criteria**
- **Given** "Job Profitability", **when** it opens, **then** each job shows Job, Status, Contract value, Revenue, Cost, Margin and Margin %.
- **Given** a negative margin, **when** it's shown, **then** the figure is red with a minus sign (colour isn't the only signal).
- **Given** no jobs, **when** it opens, **then** I see "No jobs yet.".
- **Given** a Staff user with `reports.view_job_profitability`, **when** they open it, **then** they see it.

**Implementation notes**
- API: `GET /reports/job-profitability` (`reports.view_job_profitability`).

### US-RPT-06 · Export job profitability
**Feature:** F-RPT-03 · **Priority:** P2 · **Phase:** 4 · **Screens:** `ReportsJobProfitability`
**As** an owner, **I want** job profitability as CSV, **so that** I can review jobs offline.

**Acceptance criteria**
- **Given** the tab, **when** I choose "Export CSV", **then** a file with one row per job downloads.
- **Given** the file, **when** it opens, **then** margin % is a plain number with two decimals.
- **Given** no jobs, **when** I export, **then** the file has only the header row.

**Implementation notes**
- API: `GET /reports/job-profitability/export.csv`.

### US-RPT-07 · Close a fiscal period so nobody back-dates into it
**Feature:** F-RPT-04 · **Priority:** P2 · **Phase:** 4 · **Screens:** `SettingsAccounts`
**As** an owner, **I want** to close a period, **so that** filed figures stay filed.

Legacy: S-09.8

**Acceptance criteria**
- **Given** Settings › Chart of accounts › "Period close" ("Close a period so nobody can post a new journal entry dated inside it — filed figures stay filed."), **when** I set "Start" and "End" and press "Add period", **then** the period is listed as open.
- **Given** I press "Close" on it, **when** it closes, **then** any action that would post inside it (issue, record, approve, pay, void) is refused with "falls within a closed fiscal period".
- **Given** a Staff user, **when** they call the close route, **then** they get 403.

**Implementation notes**
- API: `GET/POST /org/fiscal-periods`, `POST /org/fiscal-periods/:id/close` (Owner). Must accept `Idempotency-Key` (US-OPS-08).
- Data: `fiscal_periods.is_closed`.

### US-RPT-08 · Reopen a closed period
**Feature:** F-RPT-04 · **Priority:** P3 · **Phase:** 4 · **Screens:** `SettingsAccounts`
**As** an owner, **I want** to reopen a period I closed by mistake, **so that** a correction can be posted.

**Acceptance criteria**
- **Given** a closed period, **when** I press "Reopen", **then** it's open again and postings inside it are allowed.
- **Given** a reopen, **when** it happens, **then** the audit log records who reopened it and when.
- **Given** overlapping periods, **when** I try to add one, **then** it's refused.

**Implementation notes**
- API: `POST /org/fiscal-periods/:id/reopen`.

### US-RPT-09 · Add my own account
**Feature:** F-RPT-04 · **Priority:** P2 · **Phase:** 4 · **Screens:** `AddAccountDialog`, `SettingsAccounts`
**As** an owner, **I want** to add an expense or income account, **so that** my categories match my business.

Legacy: S-09.9

**Acceptance criteria**
- **Given** Settings › Chart of accounts, **when** I press "Add account", **then** a dialog asks for "Code" (placeholder "e.g. 6950"), "Name" (placeholder "e.g. Software Subscriptions") and "Type".
- **Given** a code already in use, **when** I save, **then** I see "Could not create this account." with the reason.
- **Given** a valid account, **when** it saves, **then** it's listed in its group and available to catalogue items, expense categories and bill lines.

**Implementation notes**
- API: `POST /org/accounts` (Owner).

### US-RPT-10 · Grant each report to Teams separately
**Feature:** F-RPT-05 · **Priority:** P1 · **Phase:** 4 · **Screens:** `TeamPrivileges`
**As** an owner, **I want** dashboard summary, receivables, payables and job profitability as separate grants, **so that** a Team sees exactly what it needs.

Legacy: S-09.15

**Acceptance criteria**
- **Given** a Team's "Reports & Ledger" group, **when** I expand it, **then** it lists "View dashboard summary", "View receivables", "View payables", "View job profitability" and "View ledger / journals".
- **Given** I grant only receivables, **when** a member opens Payables, **then** they see the no-access page and the API returns 403.
- **Given** any grant, **when** a member opens P&L, Balance Sheet, Trial Balance or Tax Summary, **then** they're refused — those are Owner-only with no capability (Trial Balance and Tax Summary as Reports tabs ship in Phase 6, US-RPT-13/14).

**Implementation notes**
- Capabilities `reports.view_*`, `ledger.view` (07-security).

### US-RPT-11 · Let a Team drill into the ledger
**Feature:** F-RPT-05 · **Priority:** P2 · **Phase:** 4 · **Screens:** `AccountDrilldownDialog`
**As** an owner, **I want** to let a trusted Team see raw journal entries, **so that** my bookkeeper can investigate without seeing the P&L.

**Acceptance criteria**
- **Given** a Staff member with `ledger.view`, **when** they open an account drill-down from Receivables, **then** the entries load.
- **Given** a Staff member without it, **when** they request a drill-down, **then** they get 403.
- **Given** `ledger.view`, **when** the member opens P&L, **then** it's still Owner-only.

**Implementation notes**
- API: `GET /reports/account-drilldown` (`ledger.view`).

### US-RPT-12 · Warn me if the books ever stop balancing
**Feature:** F-RPT-06 · **Priority:** P1 · **Phase:** 6 · **Screens:** `DashboardOwner`
**As** an owner, **I want** a daily check that the trial balance balances, **so that** a silent accounting bug is caught immediately.

PRD §F9 acceptance highlight (not yet built)

**Acceptance criteria**
- **Given** the nightly integrity job runs, **when** total debits equal total credits, **then** nothing is shown.
- **Given** they differ, **when** the job finishes, **then** Owners see a banner "Your books are out of balance by <amount>. Contact the person who runs Spine." on the dashboard and get an in-app notification.
- **Given** the check fails, **when** it logs, **then** the log entry names the difference and the time of the last good check.
- **Given** the banner, **when** the next check passes, **then** the banner disappears.

**Implementation notes**
- Queue: new pg-boss schedule `ledger-integrity-check` (daily).
- Event: `ledger_out_of_balance`, Owners only (05 "Contract additions").
- Edge: the DB trigger makes imbalance near-impossible; this guards against data repair mistakes.

### US-RPT-13 · See a Trial Balance
**Feature:** F-RPT-07 · **Priority:** P2 · **Phase:** 6 · **Screens:** `ReportsTrialBalance`
**As** an owner or my accountant, **I want** every account's debit or credit balance with matching totals, **so that** I can prove the books balance.

Gap: G2 · Decision: D-065

**Acceptance criteria**
- **Given** Reports › "Trial Balance", **when** I choose "As of" and refresh, **then** I see Code, Account, Debit and Credit for every account with a balance, and a "Total" row.
- **Given** the totals match, **when** it renders, **then** a status line reads "Balanced — total debits equal total credits.".
- **Given** "Hide accounts with no balance" is unticked, **when** it renders, **then** zero-balance accounts are listed too.
- **Given** I click an account, **when** the drill-down opens, **then** it shows that account's entries (US-RPT-03).
- **Given** "Export CSV", **when** I choose it, **then** the trial balance downloads.

**Implementation notes**
- API: `GET /reports/trial-balance?asOf=` and `/export.csv` (roles: owner) — contract addition.

### US-RPT-14 · See tax collected and paid on Reports
**Feature:** F-RPT-07 · **Priority:** P1 · **Phase:** 6 · **Screens:** `ReportsTaxSummary`
**As** an owner, **I want** tax collected and paid for a period on the Reports page, **so that** filing is data entry, not an investigation.

Legacy: S-08.4 · Decision: D-057 · Findings: C13, C23

**Acceptance criteria**
- **Given** Reports › "Tax Summary", **when** I choose "From" and "To" and refresh, **then** I see "Tax collected" (on issued invoices, after credit notes), "Tax paid" (on recorded bills and approved expenses) and "Net payable".
- **Given** a breakdown table, **when** it renders, **then** it lists "Collected by rate" with taxable amount and tax per named rate or group, and an "Adjustments from credit notes and voided invoices" row when there are any.
- **Given** a footer, **when** it renders, **then** it reads "Spine produces the numbers for your return; it doesn't file it. Only owners can see this report.".
- **Given** Settings › Tax, **when** I open it, **then** the tax summary is no longer there.

**Implementation notes**
- API: existing `GET /org/tax/summary` (roles: owner); per-rate breakdown reads `invoice_lines` (D-031).

### US-RPT-15 · Compare contract, billed and cost across jobs
**Feature:** F-RPT-03 · **Priority:** P1 · **Phase:** 7 · **Screens:** `ReportsJobProfitabilityChart`
**As** an owner, **I want** a chart of each job's contract value, billed to date and cost, **so that** I see at a glance which jobs are under-billed or eating their margin.

Decision: D-127

**Acceptance criteria**
- **Given** "Job Profitability", **when** it opens, **then** a chart above the table shows three bars per job — "Contract value", "Billed to date" and "Cost" — for active and on-hold jobs, largest contract first, up to 10 jobs, with "Showing 10 of <n> jobs — the table lists them all." when there are more.
- **Given** a job with a budget, **when** its bars render, **then** a marker on its cost bar shows the budget, labelled in the tooltip ("Budget 32,000.00 · 78% used").
- **Given** I hover or focus a job, **when** the tooltip opens, **then** it shows contract value, billed to date and %, cost, budget used and margin.
- **Given** the table, **when** it renders, **then** it gains "Billed to date", "Billed %" and "Budget used" columns after "Contract value", and the CSV export (US-RPT-06) gains the same columns as plain numbers.
- **Given** a status filter ("Active", "On hold", "Completed", "All"), **when** I change it, **then** the chart and table follow it; the default is "Active and on hold".
- **Given** a screen reader, **when** it reaches the chart, **then** the chart is labelled "Contract, billed and cost by job" and points to the table as its text alternative.

**Implementation notes**
- API: `GET /reports/job-profitability?status=` rows gain `billedToDate`, `billedPct`, `costBudget`, `budgetUsedPct`; `export.csv` gains the same columns. Same capability (`reports.view_job_profitability`).
- Figures are the same as the job's Costing tab (US-JOB-25, US-JOB-27): one service computes both, from `journal_lines` (D-011).
- UI: grouped `BarChart` with series colours from chart tokens; bars carry value labels on focus, and the legend names each series in text.


### US-RPT-16 · Set a cutover date and enter opening account balances
**Feature:** F-RPT-08 · **Priority:** P1 · **Phase:** 8 · **Screens:** `OpeningBalances`
**As** an owner moving from other software, **I want** to enter what every account held on the day I start using Spine, **so that** my Balance Sheet is right from day one.

Decision: D-137 · Closes: Q-03

**Acceptance criteria**
- **Given** Settings › Opening balances ("Bring in what your business had on the day you start using Spine. Your old software's trial balance on that date has every figure you need."), **when** I open it for the first time, **then** it asks for "Cutover date" (default: the start of the current financial year).
- **Given** a cutover date, **when** the accounts grid shows, **then** each account has "Debit" and "Credit" columns, grouped by type; Accounts Receivable, Retention Receivable, Accounts Payable and Customer Advances are read-only and show "From opening invoices" / "From opening bills" with their totals (US-RPT-17, US-RPT-18).
- **Given** debits and credits that don't match, **when** I save, **then** the difference is shown as "Opening Balance Adjustments <amount>" and saving is still allowed ("Your old books didn't balance, or a figure is missing. The difference sits in Opening Balance Adjustments until you fix it.").
- **Given** I save, **when** it posts, **then** one entry dated the day before the cutover date posts P17, and the Balance Sheet on that date shows the entered balances.
- **Given** documents already exist dated before the cutover date, **when** I choose that date, **then** I see "<n> documents are dated before the cutover date. Pick a date on or before <earliest>, or move those documents." and can't save.
- **Given** a Staff user, **when** they call the route, **then** the API returns 403.

**Implementation notes**
- API: `GET/PUT /opening-balances` (roles: owner); PUT replaces the account lines and re-posts P17 (reverse + post) while unlocked.
- Data: `opening_balances` (one row per org: `cutover_date`, `status` draft/locked, `entry_id`), `opening_balance_lines` (account, debit, credit); system account 3900 seeded by migration.

### US-RPT-17 · Bring in unpaid customer invoices, retention and credit
**Feature:** F-RPT-08 · **Priority:** P1 · **Phase:** 8 · **Screens:** `OpeningBalancesDocuments`
**As** an owner, **I want** each unpaid invoice from my old system in Spine, **so that** aging, reminders and statements work from day one.

Decision: D-137

**Acceptance criteria**
- **Given** Opening balances › "Customer invoices", **when** I press "Add invoice", **then** I enter "Customer", "Invoice number", "Invoice date", "Due date", "Amount due", and optionally "Retention held" with its "Job".
- **Given** "Import from CSV", **when** I map columns (customer name, number, dates, amount due, retention), **then** each row is checked and customers are matched by name; unmatched names are listed with "Create these customers" or "Fix the file".
- **Given** a number already used by another invoice, **when** I save, **then** I see "Invoice <number> already exists. Use the number from your old system exactly once.".
- **Given** a saved opening invoice, **when** it posts, **then** P18 debits AR (and Retention Receivable for retention, tagged with the job) and credits Opening Balance Adjustments, dated the day before the cutover date.
- **Given** an opening invoice, **when** I open Invoices, **then** it's listed with an "Opening balance" badge, ages by its due date, can be paid, reminded and credited, and has no PDF (its attachments can hold the original, US-OPS-33).
- **Given** Opening balances › "Customer credit", **when** I enter a customer and an amount, **then** P19 posts and the amount shows as credit the customer can use or be refunded.
- **Given** retention held on a job, **when** the job's retention is released (US-JOB-08), **then** the opening retention is included.

**Implementation notes**
- API: `GET/POST/PUT/DELETE /opening-balances/invoices`, `POST /opening-balances/invoices/import`, `GET/POST/DELETE /opening-balances/customer-credits` (roles: owner).
- Data: `invoices.type` gains `opening`; `invoices.retention_held_amount` used for the opening retention; opening customer credit is a `payments` row with `is_opening = true` and no money account.
- After the opening balances are locked, opening documents can't be added, changed or deleted.

### US-RPT-18 · Bring in unpaid vendor bills and vendor credits
**Feature:** F-RPT-08 · **Priority:** P1 · **Phase:** 8 · **Screens:** `OpeningBalancesDocuments`
**As** an owner, **I want** each unpaid bill from my old system in Spine, **so that** I can pay them here and see what I owe.

**Acceptance criteria**
- **Given** Opening balances › "Vendor bills", **when** I press "Add bill" or "Import from CSV", **then** I enter or map "Vendor", "Bill number", "Bill date", "Due date" and "Amount due".
- **Given** a saved opening bill, **when** it posts, **then** P20 credits AP for the vendor and debits Opening Balance Adjustments.
- **Given** an opening bill, **when** I open Bills, **then** it's listed with an "Opening balance" badge, ages on Payables and can be paid with a vendor payment.
- **Given** Opening balances › "Vendor credits", **when** I enter a vendor and an amount, **then** P20 debits AP and the credit can be applied to bills or refunded (US-PUR-25, US-PUR-26).

**Implementation notes**
- API: `GET/POST/PUT/DELETE /opening-balances/bills`, `POST /opening-balances/bills/import`, `GET/POST/DELETE /opening-balances/vendor-credits` (roles: owner).
- Data: `vendor_bills.is_opening`, `vendor_credits.is_opening`.

### US-RPT-19 · Check and lock my opening balances
**Feature:** F-RPT-08 · **Priority:** P1 · **Phase:** 8 · **Screens:** `OpeningBalancesReview`
**As** an owner, **I want** to check the totals against my old trial balance and lock them, **so that** nobody changes the starting point later.

**Acceptance criteria**
- **Given** Opening balances › "Review", **when** it opens, **then** I see a trial balance on the day before the cutover date, the totals of opening invoices, bills and credits, and "Opening Balance Adjustments <amount>" highlighted when it isn't zero.
- **Given** a balance in Opening Balance Adjustments, **when** I press "Lock opening balances", **then** I'm warned "Opening Balance Adjustments still holds <amount>. Lock anyway?" and can go back.
- **Given** I lock, **when** it completes, **then** a closed fiscal period ending the day before the cutover date is created, the screens become read-only, and the setup card shows done.
- **Given** locked opening balances, **when** an Owner chooses "Unlock" and confirms, **then** the period reopens (US-RPT-08) and editing is allowed again; both are audited.

**Implementation notes**
- API: `POST /opening-balances/lock`, `POST /opening-balances/unlock` (roles: owner).

### US-RPT-20 · Post an adjusting journal
**Feature:** F-RPT-09 · **Priority:** P1 · **Phase:** 8 · **Screens:** `ManualJournalDialog`
**As** an owner, **I want** to post a journal for depreciation, accruals and other adjustments, **so that** my accountant's year-end entries live in Spine.

Decision: D-134

**Acceptance criteria**
- **Given** Accounting › Journals › "New journal", **when** the dialog opens, **then** it asks for "Date", "Reason" (required, placeholder "e.g. Depreciation for March") and lines of "Account", "Description", "Debit", "Credit" and optional "Job".
- **Given** the lines, **when** I type, **then** the footer shows total debits, total credits and "Out by <amount>" until they match.
- **Given** a control account (Accounts Receivable, Retention Receivable, Input Tax, Accounts Payable, Output Tax, Customer Advances, Opening Balance Adjustments), **when** I search for it, **then** it isn't offered ("Use invoices, bills, payments or Record tax payment to change this account.").
- **Given** a balanced journal, **when** I press "Post journal", **then** it gets the next number (`JNL-0001`), posts P21 and appears in every report with source "Journal".
- **Given** a date inside a closed period, **when** I post, **then** it's refused with "falls within a closed fiscal period".
- **Given** a Staff user, even with `ledger.view`, **when** they call the route, **then** the API returns 403.

**Implementation notes**
- API: `POST /manual-journals` (roles: owner); numbering type `journal`.
- Data: `manual_journals`, `manual_journal_lines` (new). Journals are never edited (D-005).

### US-RPT-21 · Reverse a journal posted by mistake
**Feature:** F-RPT-09 · **Priority:** P1 · **Phase:** 8 · **Screens:** `ManualJournalDetail`
**As** an owner, **I want** to reverse a wrong journal, **so that** the books are corrected and the history stays.

**Acceptance criteria**
- **Given** a posted journal, **when** I choose "Reverse" and enter a reason and a date (default today), **then** a reversing entry mirrors every line (P21) and the journal shows "Reversed on <date> — <reason>".
- **Given** a reversed journal, **when** I open it, **then** "Reverse" is gone and "Copy to new journal" opens a draft with the same lines to post correctly.
- **Given** a journal line on a money account that's reconciled, **when** I reverse it, **then** I see the reconciliation message from US-BANK-10.

**Implementation notes**
- API: `POST /manual-journals/:id/reverse` (roles: owner).

### US-RPT-22 · See every manual journal
**Feature:** F-RPT-09 · **Priority:** P2 · **Phase:** 8 · **Screens:** `ManualJournalsList`
**As** an owner or my accountant, **I want** a list of journals, **so that** I can review every adjustment.

**Acceptance criteria**
- **Given** Accounting › Journals, **when** it opens, **then** each journal shows number, date, reason, total, status ("Posted", "Reversed") and who posted it, newest first.
- **Given** a member with `ledger.view`, **when** they open the list, **then** they can read it but see no "New journal" or "Reverse".
- **Given** no journals, **when** it opens, **then** I see "No journals yet. Most businesses only need one for year-end adjustments.".

**Implementation notes**
- API: `GET /manual-journals`, `GET /manual-journals/:id` (Owner, or `ledger.view`).

### US-RPT-23 · Find every report in one place
**Feature:** F-RPT-10 · **Priority:** P1 · **Phase:** 8 · **Screens:** `ReportsCenter`
**As** an owner, **I want** one page listing every report I can open, **so that** I don't hunt through tabs.

**Acceptance criteria**
- **Given** Reports, **when** it opens, **then** reports are grouped: "Business overview" (Profit & Loss, Balance Sheet, Cash Flow, Trial Balance), "Sales" (Sales by customer, Sales by item), "Receivables" (Receivables, Payments received, Credit notes and refunds), "Purchases" (Payables, Expenses by category, Purchases by vendor, Payments made, Vendor credits), "Tax" (Tax Summary, GSTR-1 when India GST is on), "Jobs" (Job profitability), "Accountant" (General ledger, Day book, Journals, Export to Tally).
- **Given** a report I can't open, **when** the page renders, **then** it isn't listed.
- **Given** the star next to a report, **when** I press it, **then** the report joins "Favourites" at the top for me on every device.
- **Given** the search box, **when** I type "ledger", **then** only matching reports show.

**Implementation notes**
- Favourites in the member's dashboard layout settings (US-DASH-11). Existing report tabs become pages under `/reports/<slug>`.

### US-RPT-24 · See the general ledger
**Feature:** F-RPT-10 · **Priority:** P1 · **Phase:** 8 · **Screens:** `ReportsGeneralLedger`
**As** my accountant, **I want** every account's opening balance, entries and closing balance for a period, **so that** I can audit the books.

**Acceptance criteria**
- **Given** "General ledger" with "From" and "To", **when** I refresh, **then** each account with activity shows "Opening balance", one row per entry (date, source and number, contact, job, description, debit, credit, running balance) and "Closing balance".
- **Given** "Accounts", **when** I pick some, **then** only those show; "Hide accounts with no activity" is on by default.
- **Given** a row, **when** I click it, **then** its document opens.
- **Given** a Staff user without `ledger.view`, **when** they open it, **then** they see the no-access page and the API returns 403.

**Implementation notes**
- API: `GET /reports/general-ledger?from=&to=&accountIds=` (Owner, or `ledger.view`); paged by account for large periods.

### US-RPT-25 · See the day book
**Feature:** F-RPT-10 · **Priority:** P1 · **Phase:** 8 · **Screens:** `ReportsDayBook`
**As** my accountant, **I want** every journal entry in date order, **so that** I can check what was posted each day.

**Acceptance criteria**
- **Given** "Day book" with a date range (default today), **when** it loads, **then** each entry shows date, number, source ("Invoice INV-0042", "Payment RCT-0012", "Journal JNL-0003"…), narration and its lines with account, debit and credit.
- **Given** "Source", **when** I filter to one kind, **then** only those entries show.
- **Given** an entry, **when** I click it, **then** its document opens.

**Implementation notes**
- API: `GET /reports/day-book?from=&to=&sourceType=` (Owner, or `ledger.view`).

### US-RPT-26 · See where cash came from and where it went
**Feature:** F-RPT-10 · **Priority:** P1 · **Phase:** 8 · **Screens:** `ReportsCashFlow`
**As** an owner, **I want** a cash flow statement, **so that** I understand why my bank balance changed when I made a profit.

**Acceptance criteria**
- **Given** "Cash Flow" with "From" and "To", **when** I refresh, **then** I see "Cash at start", "Operating activities" (net profit adjusted for changes in receivables, payables, tax and advances), "Investing activities" (fixed assets), "Financing activities" (capital, drawings, loans), "Net change" and "Cash at end".
- **Given** the report, **when** it renders, **then** "Cash at end" equals the total of every bank and cash account on the "To" date — card accounts are liabilities, not cash (checked; a mismatch logs an error).
- **Given** a line, **when** I click it, **then** the drill-down lists the accounts behind it.

**Implementation notes**
- API: `GET /reports/cash-flow?from=&to=` (`reports.view_financial_statements`). Indirect method from `journal_lines`; account-to-section mapping by account type and code range, documented in [14-glossary](../prd/14-glossary.md).

### US-RPT-27 · Compare profit and loss across periods
**Feature:** F-RPT-10 · **Priority:** P1 · **Phase:** 8 · **Screens:** `ReportsPLCompare`
**As** an owner, **I want** this period beside last period, last year or each month, **so that** I see trends.

**Acceptance criteria**
- **Given** Profit & Loss, **when** I choose "Compare with" → "Previous period", "Same period last year" or "Each month", **then** columns are added for each and, for the first two, "Change" and "Change %".
- **Given** "Each month" over a year, **when** it renders, **then** there's one column per month plus "Total".
- **Given** a change, **when** it shows, **then** it carries an arrow and a sign, not colour alone.
- **Given** the Balance Sheet, **when** I choose "Compare with" → "Previous year end", **then** it shows both dates side by side.

**Implementation notes**
- API: `GET /reports/profit-and-loss?compare=previous|last_year|monthly`, `GET /reports/balance-sheet?compareAsOf=` (`reports.view_financial_statements`).

### US-RPT-28 · See sales by customer and by item
**Feature:** F-RPT-10 · **Priority:** P1 · **Phase:** 8 · **Screens:** `ReportsSalesByCustomer`
**As** an owner, **I want** to know who buys the most and what sells, **so that** I focus on what pays.

**Acceptance criteria**
- **Given** "Sales by customer" with a range, **when** it loads, **then** each customer shows invoice count, sales before tax, tax, total and % of sales, largest first, net of credit notes.
- **Given** "Sales by item", **when** it loads, **then** each catalogue item (and "Items not from the catalogue") shows quantity, sales before tax and average price.
- **Given** a row, **when** I click it, **then** the list of its invoices opens.

**Implementation notes**
- API: `GET /reports/sales-by-customer`, `GET /reports/sales-by-item` (`reports.view_financial_statements`). Customer totals from income `journal_lines` by `contact_id`; item quantities read invoice lines (D-031 exception, stated on the page).

### US-RPT-29 · See expenses by category and purchases by vendor
**Feature:** F-RPT-10 · **Priority:** P1 · **Phase:** 8 · **Screens:** `ReportsExpensesByCategory`
**As** an owner, **I want** to see where money goes, **so that** I can cut costs.

**Acceptance criteria**
- **Given** "Expenses by category" with a range, **when** it loads, **then** each expense account shows the amount, % of total and a bar, largest first, from bills, expenses, journals and money out.
- **Given** "Purchases by vendor", **when** it loads, **then** each vendor shows bill count, amount before tax, tax and total, net of vendor credits.
- **Given** a row, **when** I click it, **then** the account drill-down or the vendor's bills open.

**Implementation notes**
- API: `GET /reports/expenses-by-category`, `GET /reports/purchases-by-vendor` (`reports.view_financial_statements`).

### US-RPT-30 · See payments received and made in a period
**Feature:** F-RPT-10 · **Priority:** P2 · **Phase:** 8 · **Screens:** `ReportsPaymentsRegister`
**As** a bookkeeper, **I want** a register of money received and paid, **so that** I can check deposits and cheques.

**Acceptance criteria**
- **Given** "Payments received", **when** it loads, **then** each payment shows date, number, customer, method, money account, amount and what it was allocated to.
- **Given** "Payments made", **when** it loads, **then** each vendor payment shows the same for vendors and bills.
- **Given** the account filter, **when** I pick one money account, **then** only its payments show.

**Implementation notes**
- API: `GET /reports/payments-received` (`reports.view_receivables`), `GET /reports/payments-made` (`reports.view_payables`).

### US-RPT-31 · See credit notes, vendor credits and refunds in a period
**Feature:** F-RPT-10 · **Priority:** P2 · **Phase:** 8 · **Screens:** `ReportsCreditsRegister`
**As** a bookkeeper, **I want** every credit and refund in one list, **so that** nothing is given back twice.

**Acceptance criteria**
- **Given** "Credit notes and refunds", **when** it loads, **then** each credit note shows date, number, customer, invoice, amount, how much was applied, refunded or is still held.
- **Given** "Vendor credits", **when** it loads, **then** each vendor credit shows the same for vendors and bills.

**Implementation notes**
- API: `GET /reports/customer-credits` (`reports.view_receivables`), `GET /reports/vendor-credits` (`reports.view_payables`).

### US-RPT-32 · Export every report to CSV and Excel
**Feature:** F-RPT-11 · **Priority:** P1 · **Phase:** 8 · **Screens:** `ReportExportMenu`
**As** my accountant, **I want** any report in Excel, **so that** I can work with the numbers.

Decision: D-144

**Acceptance criteria**
- **Given** any report, **when** I open "Export", **then** it offers "CSV", "Excel (.xlsx)", "PDF" and "Print".
- **Given** Excel, **when** the file opens, **then** amounts are numbers (not text) with two decimals, headings are bold, the first row is frozen, and the business name, report name and range are in the first rows.
- **Given** CSV, **when** it opens, **then** amounts are plain decimals with the currency in its own column (as US-RPT-04).
- **Given** the on-screen filters and comparison columns, **when** I export, **then** the file has exactly what's on screen.
- **Given** the Tax Summary, **when** I export, **then** CSV and Excel work too (it had no export before).

**Implementation notes**
- API: every report route accepts `format=csv|xlsx|pdf` (`/export.csv` routes stay as aliases). `exceljs` in the API.

### US-RPT-33 · Download any report as a PDF
**Feature:** F-RPT-11 · **Priority:** P1 · **Phase:** 8 · **Screens:** `ReportPdf`
**As** an owner, **I want** a clean PDF of any report, **so that** I can send it to my bank or accountant.

**Acceptance criteria**
- **Given** "PDF", **when** it downloads, **then** it has the logo, business name, report name, range or date, basis (accrual or cash), page numbers and "Prepared <date>" in the footer.
- **Given** a report with more than five amount columns, **when** it renders, **then** the page is landscape.
- **Given** dark mode on screen, **when** the PDF renders, **then** it's light (D-100).

**Implementation notes**
- `@react-pdf` templates per report family (statement, table, ledger); fonts per D-151 from Phase 9 (Helvetica until then).

### US-RPT-34 · Print any report
**Feature:** F-RPT-11 · **Priority:** P2 · **Phase:** 8 · **Screens:** `ReportExportMenu`
**As** an owner, **I want** to print a report straight from the browser, **so that** I can take it to a meeting.

**Acceptance criteria**
- **Given** "Print", **when** the browser's print dialog opens, **then** the sidebar, toolbars and buttons are hidden and the report fills the page with its title, range and the business name.
- **Given** a long table, **when** it prints, **then** column headings repeat on every page and rows aren't split.

**Implementation notes**
- A print stylesheet in `packages/ui`; no server work.

### US-RPT-35 · See profit and loss on a cash basis
**Feature:** F-RPT-12 · **Priority:** P1 · **Phase:** 8 · **Screens:** `ReportsPLCashBasis`
**As** an owner, **I want** to see profit as money actually received and paid, **so that** I know what cash the business made.

Decision: D-138 · Closes: Q-04

**Acceptance criteria**
- **Given** Profit & Loss, **when** I switch "Basis" from "Accrual" to "Cash", **then** income counts only what customers have paid in the range and expenses only what was paid, split across accounts in proportion to each invoice's or bill's lines.
- **Given** a half-paid invoice of 1,000.00 for services, **when** the range covers the payment, **then** cash-basis income shows 500.00 under Sales — Services (before tax).
- **Given** payments against opening invoices, **when** the cash basis renders, **then** they aren't income and a note says "Payments on invoices from before <cutover date> aren't counted — that income was in your old books.".
- **Given** the cash basis, **when** it renders, **then** the subtitle reads "Cash basis" and exports carry it.
- **Given** the Balance Sheet, Trial Balance or Tax Summary, **when** I look for a basis switch, **then** there isn't one.

**Implementation notes**
- API: `GET /reports/profit-and-loss?basis=cash` (`reports.view_financial_statements`); computed from payment and vendor-payment allocations joined to the document's income/expense lines; no postings.

### US-RPT-36 · Let my accountant's Team see the financial statements
**Feature:** F-RPT-05 · **Priority:** P1 · **Phase:** 8 · **Screens:** `TeamPrivilegesBooks`
**As** an owner, **I want** to give my accountant read access to the statements without making them an owner, **so that** they can do their job and nothing else.

Decision: D-136

**Acceptance criteria**
- **Given** a Team's "Reports & Ledger" group, **when** I expand it, **then** it adds "View financial statements" (P&L, Balance Sheet, Trial Balance, Cash Flow, Tax Summary, sales and purchase analysis, GSTR-1 and Tally exports), off by default.
- **Given** a member with it, **when** they open those reports, **then** they load and export; the API answers 200 instead of 403.
- **Given** a member with it, **when** they try to post a journal, edit opening balances, close a period or change Settings, **then** they're refused.
- **Given** a member without it, **when** they open P&L, **then** they see the no-access page ("Owner-only report." becomes "You don't have access to financial statements. Ask an owner.").
- **Given** a Field user, **when** any of these routes is called, **then** it's 403, whatever their Teams.

**Implementation notes**
- Capability `reports.view_financial_statements`; P&L, Balance Sheet, Trial Balance, Tax Summary and revenue trend routes change from `roles: owner` to `@RequireCapability` (Owners always pass). [07-security](../prd/07-security.md) "Owner-only" list updated.

### US-RPT-40 · See every report laid out the same way
**Feature:** F-RPT-10 · **Priority:** P2 · **Phase:** 8 · **Screens:** `ReportsPL`, `ReportsGeneralLedger`, `ReportsSalesByCustomer`, `Receivables`
**As** an owner, **I want** every report to put its filters, figures, chart, table and Export in the same places, **so that** I don't relearn each one.

Decision: D-180

**Acceptance criteria**
- **Given** any report (statements, analysis, registers, ledger, Job profitability, Receivables, Payables), **when** it opens, **then** it shows, in order: the header (breadcrumb, title, and a description followed by the range it covers and any comparison or basis, e.g. "Income less expenses · Jan 1 – Oct 6, 2026 · Accrual basis"); tabs where reports are siblings; a toolbar of labelled 40px filters on the left and Export (CSV, Excel, PDF, Print), then any primary action, on the right; one row of three or four KPI cards; a chart where it adds something; the table; one muted footnote.
- **Given** a filter, **when** I change it, **then** the report reloads straight away — there's no Refresh — with a spinner in the toolbar while it does.
- **Given** Profit & Loss, Balance Sheet, Trial Balance or Cash Flow, **when** it opens, **then** tabs switch between the four; General ledger and Day book share tabs too.
- **Given** a statement (P&L, Balance Sheet, Cash Flow, Tax Summary, a ledger account), **when** it renders, **then** it's one table with the list tables' heading row and type size, uppercase section headings, bold subtotals and the total on a shaded footer row; a list report (Trial Balance, Job profitability, sales, purchases, registers) has search, Columns, a totals row and a pager.
- **Given** Profit & Loss, **when** the range is 24 months or fewer, **then** a chart shows income and expenses for each month; the cards are Total income, Total expenses, Net profit and Net margin.
- **Given** Receivables or Payables, **when** they open, **then** the cards are Total outstanding, Current, Overdue and 90+ days, a bar splits what's owed across all five ages with each age's amount and share, and "Show" picks all outstanding or overdue only (the dashboard's "Overdue" opens it on overdue only). Since D-224, Receivables keeps the cards and bar but uses the list layout — an age filter in the filter bar instead of "Show" (US-PAY-29).
- **Given** the Trial Balance, **when** it balances, **then** the Difference card reads $0.00 "✓ balanced" and the footnote says so; when it doesn't, a red alert says by how much.

**Implementation notes**
- `@spine/ui`: `ReportToolbar`, `ReportFilter`, `ReportFilterCheckbox`, `StatementTable`, `SegmentedBar`; `Table`/`DataTable` gain `footer`. Web: `reports/report-kit.tsx` (`useReport`, `RangeFilters`, `ReportKpis`, `ReportChart`, `ReportFootnote`).
- API: `GET /reports/general-ledger` gains `totals { lines, debit, credit }` across every listed account, for the KPI cards.

### US-RPT-37 · See tax collected and paid by rate and tax type
**Feature:** F-RPT-07 · **Priority:** P1 · **Phase:** 9 · **Screens:** `ReportsTaxSummaryByType`
**As** an owner, **I want** the Tax Summary to show both sides by rate, tax type and supply class, **so that** my return is copy-and-paste.

Decision: D-147

**Acceptance criteria**
- **Given** Tax Summary, **when** it renders, **then** "Collected by rate" is joined by "Paid by rate" (bills, expenses, money out with tax, less vendor credits), each with taxable amount and tax.
- **Given** tax types on rates, **when** it renders, **then** a "By tax type" table shows CGST, SGST/UTGST, IGST and cess (or VAT/GST) collected, paid and net.
- **Given** supply classes, **when** it renders, **then** zero-rated, exempt and non-taxable sales and purchases are listed with their values.
- **Given** tax payments recorded in the range (US-TAX-08), **when** it renders, **then** "Paid to the tax authority" and "Still to pay" show below "Net payable".
- **Given** the figures, **when** they're compared with the ledger, **then** total collected equals 2100's credits and total paid equals 1200's debits for the range (tested).

**Implementation notes**
- API: `GET /org/tax/summary` gains `paidByRate`, `byTaxType`, `bySupplyClass`, `payments` (`reports.view_financial_statements`).

### US-RPT-38 · Export my books for Tally
**Feature:** F-RPT-13 · **Priority:** P1 · **Phase:** 9 · **Screens:** `ReportsTallyExport`
**As** an owner whose accountant uses TallyPrime, **I want** a file they can import, **so that** they don't retype my books.

Decision: D-149

**Acceptance criteria**
- **Given** Reports › "Export to Tally", **when** I choose "From", "To" and press "Export", **then** a ZIP downloads with `masters.xml` and `vouchers.xml` and a `README.txt` saying how to import them (Gateway of Tally › Import › Masters, then Transactions).
- **Given** masters, **when** they're read, **then** every account used in the range is a ledger under its mapped group, customers are under Sundry Debtors and vendors under Sundry Creditors with address, state and GSTIN.
- **Given** vouchers, **when** they're read, **then** invoices are Sales, bills Purchase, customer payments Receipt, vendor payments and refunds Payment, transfers Contra, journals and opening balances Journal, credit notes Credit Note and vendor credits Debit Note — each balanced, with bill-wise references to the invoice or bill number.
- **Given** an import into TallyPrime 6.x or 7.x and Tally.ERP 9, **when** the accountant runs it, **then** it imports without errors (tested with sample files kept in the repo).
- **Given** an account not yet mapped, **when** I export, **then** it uses the default for its type and the README lists the defaults used.

**Implementation notes**
- API: `GET /exports/tally?from=&to=` → `application/zip` (`reports.view_financial_statements`), built with `fflate` (D-132).

### US-RPT-39 · Map my accounts to Tally groups
**Feature:** F-RPT-13 · **Priority:** P2 · **Phase:** 9 · **Screens:** `TallyGroupMapping`
**As** my accountant, **I want** to choose the Tally group for each account, **so that** the import lands where I expect.

**Acceptance criteria**
- **Given** "Export to Tally" › "Account mapping", **when** it opens, **then** each account shows its Spine type and a "Tally group" picker of Tally's predefined groups (e.g. Bank Accounts, Cash-in-Hand, Duties & Taxes, Sales Accounts, Direct Expenses, Indirect Expenses, Fixed Assets, Capital Account, Loans (Liability), Current Liabilities, Current Assets).
- **Given** defaults, **when** it opens the first time, **then** each account is pre-mapped by type and code (bank accounts → Bank Accounts, 1000 → Cash-in-Hand, 2100 and 1200 → Duties & Taxes, 4xxx → Sales Accounts, 5xxx → Direct Expenses, 6xxx → Indirect Expenses…).
- **Given** I change a mapping, **when** I save, **then** later exports use it.

**Implementation notes**
- API: `GET/PUT /exports/tally/mapping` (roles: owner). Data: `settings` key `tally_mapping`.

### US-RPT-41 · Read reports on my phone
**Feature:** F-RPT-14 · **Priority:** P2 · **Phase:** 12 · **Screens:** `ReportsPLPhone`, `ReportsPLPhoneFilters`, `ReportsTrialBalancePhone`
**As** an owner checking how the month went, **I want** reports that read on my phone, **so that** I don't need a laptop to see my profit.

Decision: D-283

**Acceptance criteria**
- **Given** a report under 768px, **when** it opens, **then** the filters are one line under the title saying what's chosen ("Jan 1 – Nov 18, 2026 · Accrual · No comparison"), which opens a Filters sheet with every filter; Export is under the top bar's ⋯; sibling reports' tabs are one row that scrolls sideways.
- **Given** the report's cards, **when** they show, **then** they're chips in a row that scrolls sideways (US-OPS-57), and a chart is the screen's width with its legend under it.
- **Given** a statement (Profit & Loss, Balance Sheet, Cash Flow, Tax Summary), **when** it renders, **then** it's an indented list: section headings, each account with its amount on the right, bold subtotals and the total last; tapping an account opens its drill-down; with a comparison, each amount has the other period's under it in muted text.
- **Given** a list report (sales, purchases, registers, receivables by invoice, job profitability), **when** it renders, **then** it uses the phone rows (US-OPS-56).
- **Given** a report whose data is a grid (Trial balance, GSTR-1, a comparison of three or more periods, aging by age), **when** it renders, **then** it stays a table whose first column stays put while the others scroll sideways inside their box, and the page itself never scrolls sideways.
- **Given** the Reports page, **when** it opens, **then** its reports are list rows grouped as on the desktop.

**Implementation notes**
- `StatementTable` renders the indented list under 768px; `ReportToolbar` renders the summary line and a `BottomSheet`; `Table` gains a sticky first column for the grids.
- Supersedes US-RPT-40's toolbar and table layout under 768px only.
