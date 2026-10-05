# 06 · Ledger posting rules

The accounting contract. Every business event below posts exactly one balanced journal entry (or none, where stated) in the same database transaction as the document ([D-003](12-decisions.md), [D-005](12-decisions.md)). Users never type a journal entry. Every line carries `contact_id` where a contact is involved and `job_id` where the document is tagged to a job — that is what makes AR aging and job profitability derivable ([D-011](12-decisions.md)).

These rules are verified against the code in `apps/api/src/modules/{invoices,payments,credit-notes,purchases,ledger}`. Changing one needs a decision and an updated ledger-integrity test.

## System accounts

Resolved by code per organisation (`SYSTEM_ACCOUNT_CODES` in `ledger.service.ts`); seeded on first run, can't be renamed or deleted.

| Code | Account | Type |
|---|---|---|
| 1010 | Bank Account (default cash account for payments and expenses) | Asset |
| 1100 | Accounts Receivable | Asset |
| 1150 | Retention Receivable | Asset |
| 1200 | Input Tax Receivable | Asset |
| 2000 | Accounts Payable | Liability |
| 2100 | Output Tax Payable | Liability |
| 2200 | Customer Advances | Liability |
| 3200 | Retained Earnings | Equity |
| 4100 | Sales — Services (default revenue when a line has no catalogue income account) | Income |

The full default chart is in [14-glossary §Default chart of accounts](14-glossary.md#default-chart-of-accounts).

## Postings

| # | Event | `source_type` | Debit | Credit |
|---|---|---|---|---|
| P1 | Standard or progress invoice issued, no retention | `invoice` | 1100 AR (total) | Revenue per line's catalogue income account (fallback 4100), 2100 Output Tax |
| P2 | Progress invoice issued with retention | `invoice` | 1100 AR (total − retention), 1150 Retention Receivable (retention) | Revenue per line, 2100 Output Tax |
| P3 | Advance (deposit) invoice issued | — | *Nothing posted* — a request for a deposit is not a claim; the deposit posts when paid (P5) | |
| P4 | Payment received, allocated to invoices | `payment` | 1010 Bank (amount) | 1100 AR (allocated) |
| P5 | Payment received, part or all unallocated (deposit / overpayment) | `payment` | 1010 Bank (amount) | 1100 AR (allocated part), 2200 Customer Advances (unallocated part) |
| P5a | Payment allocated to an advance invoice (US-PAY-13, Phase 6, [D-075](12-decisions.md)) | `payment` | 1010 Bank | 2200 Customer Advances (no AR line); the advance invoice's balance drops; tax is charged when the deposit is offset on the final invoice |
| P6 | Sitting credit applied to an invoice | `payment_credit_applied` | 2200 Customer Advances | 1100 AR |
| P7 | Unallocated payment deleted | `payment_delete` | Reverses P4/P5 | |
| P8 | Credit note issued against an invoice | `credit_note` | Revenue (net), 2100 Output Tax | 1100 AR (total) — every line tagged with the invoice's `job_id` when it has one (US-JOB-27), so job revenue and billed to date drop by the credit |
| P9 | Invoice voided (with reason) | `invoice_void` | Reverses P1/P2 exactly | |
| P10 | Retention released (raises a `retention_release` invoice) | `invoice` | 1100 AR | 1150 Retention Receivable |
| P11 | Vendor bill recorded | `vendor_bill` | Expense/COGS per line account, 1200 Input Tax | 2000 AP (total) |
| P12 | Vendor bill voided | `vendor_bill_void` | Reverses P11 | |
| P13 | Vendor payment recorded | `vendor_payment` | 2000 AP | 1010 Bank (or the chosen cash account) |
| P14 | Vendor payment deleted | `vendor_payment_delete` | Reverses P13 | |
| P15 | Expense approved (submitted and rejected expenses post nothing) | `expense` | Category's expense account (net), 1200 Input Tax | 1010 Bank (total) |
| P16 | Approved expense billed to the customer | — | Nothing on billing itself; the draft invoice it creates posts P1 when issued | |

## Invariants (tested)

1. Sum of debits = sum of credits for every entry (DB trigger; unbalanced inserts are rejected).
2. Each journal line is one-sided: exactly one of debit/credit is non-zero (`journal_lines_one_sided` check).
3. The trial balance balances after every simulated workflow (`ledger-integrity` integration test).
4. No posting is dated inside a closed fiscal period.
5. An issued invoice's reversal (P9) mirrors its original lines exactly, including job and contact tags.
6. Allocations never exceed the payment amount or the invoice balance (DB trigger), for customer and vendor payments alike.
7. Reports (P&L, Balance Sheet, Trial Balance, AR/AP aging, job profitability) read `journal_lines`, never documents. Tax Summary's per-rate breakdown is the one exception ([D-031](12-decisions.md)).

## Open points

- Accrual-only accounting in v1 is assumed ([Q-04](13-risks-open-questions.md)).
- A practising accountant has not yet reviewed this table ([Q-02](13-risks-open-questions.md), [R-01](13-risks-open-questions.md)).
- An invoice with allocated payments can't be voided (P9 is refused); the correction is a credit note ([D-074](12-decisions.md)).
- Expenses paid by an employee still credit Bank (P15); an "employee reimbursements payable" account is not modelled ([Q-05](13-risks-open-questions.md)).
- Labour entered as headcount × day rate (US-PUR-23) is an ordinary expense: it posts P15 to its category's account (5200 Direct Labour by default) with the job's `job_id`. No new posting.
- Job budgets (US-JOB-24) and percent complete (US-JOB-28) never post. Billed to date (US-JOB-27) is read from `invoice` and `credit_note` lines on 1100 and 1150 tagged to the job, excluding retention-release entries ([D-127](12-decisions.md)).
- Retention never reduces the taxable value: tax is charged on the full progress claim and retention is held from the total (P2, [D-130](12-decisions.md)).
