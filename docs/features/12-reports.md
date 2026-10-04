# 12 · Accounting & reports

The books Spine keeps underneath: a seeded chart of accounts owners can extend, fiscal periods that can be closed, and the reports an owner and accountant need — Profit & Loss, Balance Sheet, Trial Balance, Tax Summary and job profitability — all derived from journal lines, all drillable to the source documents and exportable to CSV.

**Screens:** `ReportsPL` (P1), `ReportsEmpty` (P2), `ReportsBalanceSheet` (P1), `ReportsJobProfitability` (P1), `AccountDrilldownDialog` (P1), `SettingsAccounts` (P2), `AddAccountDialog` (P2), `TeamPrivileges` (P1), `ReportsTrialBalance` (P2), `ReportsTaxSummary` (P1), `DashboardOwner` (P1), `ReportsJobProfitabilityChart` (P1)
**Depends on:** every posting module (06-ledger-posting-rules), 15 Team (report capabilities).

## Features

| ID | Feature | Priority | Phase | Screens |
|---|---|---|---|---|
| F-RPT-01 | Profit & Loss and Balance Sheet | P1 | 4 | `ReportsPL`, `ReportsEmpty`, `ReportsBalanceSheet` |
| F-RPT-02 | Drill-down and CSV export | P1 | 4 | `AccountDrilldownDialog`, `ReportsPL` |
| F-RPT-03 | Job profitability | P1 | 4 | `ReportsJobProfitability`, `ReportsJobProfitabilityChart` |
| F-RPT-04 | Chart of accounts and period close | P2 | 4 | `SettingsAccounts`, `AddAccountDialog` |
| F-RPT-05 | Report access rights | P1 | 4 | `TeamPrivileges`, `AccountDrilldownDialog` |
| F-RPT-06 | Ledger integrity monitoring | P1 | 6 | `DashboardOwner` |
| F-RPT-07 | Trial Balance and Tax Summary reports | P1 | 6 | `ReportsTrialBalance`, `ReportsTaxSummary` |

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

