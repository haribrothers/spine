# 14 · Glossary

## Business and accounting terms

| Term | Meaning |
|---|---|
| Accrual accounting | Revenue and expenses are recorded when earned or incurred, not when cash moves. Spine's only basis in v1 |
| Advance / deposit | Money taken before work starts. A liability (2200 Customer Advances) until offset against a later invoice |
| Aging | How long invoices or bills have been outstanding, in buckets: current, 1–30, 31–60, 61–90, 90+ days |
| AP (accounts payable) | What the business owes vendors |
| AR (accounts receivable) | What customers owe the business |
| Balance Sheet | Assets, liabilities and equity on one date |
| Billed to date | What has been invoiced on a job so far, tax included and before retention, less credit notes; compared with the contract value (D-127) |
| Chart of accounts | The list of accounts every journal line is posted to |
| Cost budget | What a job is expected to cost; a target shown against actual cost, never posted (D-125) |
| Credit note | A document reducing what a customer owes; used instead of editing an issued invoice |
| Debit / credit | The two sides of every entry. Debits increase assets and expenses; credits increase liabilities, equity and income |
| Double-entry | Every transaction touches at least two accounts and debits equal credits |
| Fiscal period | A date range that can be closed so nothing is posted into it |
| Journal entry | One balanced financial event made of two or more journal lines; immutable once posted |
| Milestone | A billing stage of a job, as a percentage or fixed amount |
| P&L (profit and loss) | Income minus expenses over a period |
| Posting rule | The code that turns a business event into a journal entry ([06](06-ledger-posting-rules.md)) |
| Progress billing | Invoicing part of a contract as milestones complete |
| Progress claim | One progress invoice on a job, numbered per job at issue ("Progress claim 3"); called an RA (running account) bill in India (D-128) |
| Labour expense | Site labour entered as workers per trade × day rate and saved as one expense on a job; not payroll or attendance (D-126) |
| Retention | A percentage of each progress invoice held back by the customer until the defects period ends; posted to 1150 Retention Receivable |
| Reversal | A mirror-image journal entry that cancels an earlier one, keeping history |
| Tax group | Several tax rates applied together on one line (e.g. split state and central tax) |
| Tax-inclusive pricing | Entered prices already contain tax |
| Trial Balance | All accounts with their debit and credit totals, proving they're equal |
| Variation order | An approved change to agreed scope, priced separately and applied to the job |
| Void | Cancelling an issued document with a reversing entry, without deleting it |

## Product terms

| Term | Meaning |
|---|---|
| Owner | Role with full access; can manage users, Teams, settings and tax. There can be several |
| Primary Owner | The first account on an instance; exactly one; changes only by explicit transfer |
| Staff | Office role whose access is the union of its Teams' grants |
| Field | Fixed mobile-first role for crews; never configurable by Teams |
| Team | A named group of Staff with a privilege matrix |
| Capability | One permission in the privilege matrix, e.g. `quotes.edit_own` |
| Own / others | A capability split by whether the record was created by the current user |
| Document number | The gapless, permanent number given at issue (e.g. `INV-0042`); drafts have none |
| Snapshot | The copy of line prices and tax stored on a document's lines, plus the PDF stored at issue that freezes addresses and branding (D-083) |
| Idempotency key | A client-generated key sent with every mutation so a retry never repeats the write |
| Outbox | The phone's queue of writes made offline, replayed in order when online |
| Public quote link | The tokenised, sign-in-free page where a customer views, accepts or declines a quote |
| Bundle | A saved group of catalogue lines added to a quote or invoice in one step |
| Statement | A per-customer PDF listing invoices, payments and credits over a period with a running balance |
| Recurring invoice | A schedule that creates an invoice automatically, e.g. monthly maintenance |
| Daily digest | The morning email summarising what needs you and what happened yesterday |
| Needs your attention | The dashboard list of things waiting on you, each with a one-click action |
| Storage driver | How Spine stores files: `local` (a Docker volume on the API, default) or `s3` (any S3-compatible store) |
| Bundled guide | The copy of the user guide served by each Spine install at `/help`, matching its version and working offline |
| Demo data | A seeded sample business (Riverstone Builders) for exploring the app |
| Industry template | Onboarding choice that sets defaults, e.g. Construction turns on milestones and retention |

## Default chart of accounts

Seeded for every new organisation (`apps/api/src/db/seed/chart-of-accounts.ts`). System accounts (marked ●) can't be deleted or renamed; other accounts can be renamed, and new ones added (US-RPT-09).

| Code | Account | Type |
|---|---|---|
| 1000 | Cash in Hand | Asset |
| 1010 | Bank Account | Asset |
| 1100 | Accounts Receivable ● | Asset |
| 1150 | Retention Receivable ● | Asset |
| 1200 | Input Tax Receivable ● | Asset |
| 1300 | Prepaid Expenses | Asset |
| 1500 | Fixed Assets | Asset |
| 1510 | Accumulated Depreciation | Asset (contra) |
| 2000 | Accounts Payable ● | Liability |
| 2100 | Output Tax Payable ● | Liability |
| 2200 | Customer Advances ● | Liability |
| 2400 | Wages Payable | Liability |
| 2500 | Loans Payable | Liability |
| 3000 | Owner's Capital | Equity |
| 3100 | Owner's Drawings | Equity |
| 3200 | Retained Earnings ● | Equity |
| 4000 | Sales — Goods | Income |
| 4100 | Sales — Services | Income |
| 4900 | Discounts Given | Income (contra) |
| 5000 | Cost of Materials | Expense |
| 5100 | Subcontractor Costs | Expense |
| 5200 | Direct Labour | Expense |
| 5300 | Plant & Equipment Hire (Construction template only, US-ONB-13) | Expense |
| 5400 | Fuel & Freight (Construction template only) | Expense |
| 5500 | Site Overheads & Permits (Construction template only) | Expense |
| 6000 | Rent | Expense |
| 6100 | Utilities | Expense |
| 6200 | Salaries | Expense |
| 6300 | Travel & Vehicle | Expense |
| 6400 | Professional Fees | Expense |
| 6500 | Depreciation | Expense |
| 6900 | Other Expenses | Expense |
