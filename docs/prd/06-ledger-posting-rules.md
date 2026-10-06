# 06 · Ledger posting rules

The accounting contract. Every business event below posts exactly one balanced journal entry (or none, where stated) in the same database transaction as the document ([D-003](12-decisions.md), [D-005](12-decisions.md)). The everyday workflow never needs a hand-typed journal entry; Owners may post adjusting journals (P21) for what no document covers ([D-134](12-decisions.md)). Every line carries `contact_id` where a contact is involved and `job_id` where the document is tagged to a job — that is what makes AR aging and job profitability derivable ([D-011](12-decisions.md)).

These rules are verified against the code in `apps/api/src/modules/{invoices,payments,credit-notes,purchases,ledger}`. Changing one needs a decision and an updated ledger-integrity test.

## System accounts

Resolved by code per organisation (`SYSTEM_ACCOUNT_CODES` in `ledger.service.ts`); seeded on first run, can't be renamed or deleted.

| Code | Account | Type |
|---|---|---|
| 1010 | Bank Account (the default money account for payments and expenses; from Phase 8 each money account is chosen per transaction, [D-140](12-decisions.md)) | Asset |
| 1100 | Accounts Receivable | Asset |
| 1150 | Retention Receivable | Asset |
| 1200 | Input Tax Receivable | Asset |
| 2000 | Accounts Payable | Liability |
| 2100 | Output Tax Payable | Liability |
| 2200 | Customer Advances | Liability |
| 3200 | Retained Earnings | Equity |
| 3900 | Opening Balance Adjustments (Phase 8, [D-137](12-decisions.md)) | Equity |
| 4100 | Sales — Services (default revenue when a line has no catalogue income account) | Income |

The full default chart is in [14-glossary §Default chart of accounts](14-glossary.md#default-chart-of-accounts).

## Postings

| # | Event | `source_type` | Debit | Credit |
|---|---|---|---|---|
| P1 | Standard or progress invoice issued, no retention | `invoice` | 1100 AR (total) | Revenue per line's catalogue income account (fallback 4100), 2100 Output Tax |
| P2 | Progress invoice issued with retention | `invoice` | 1100 AR (total − retention), 1150 Retention Receivable (retention) | Revenue per line, 2100 Output Tax |
| P3 | Advance (deposit) invoice issued | — | *Nothing posted* — a request for a deposit is not a claim; the deposit posts when paid (P5) | |
| P4 | Payment received, allocated to invoices | `payment` | The chosen money account (amount; the organisation default when none is chosen, US-BANK-03) | 1100 AR (allocated) |
| P5 | Payment received, part or all unallocated (deposit / overpayment) | `payment` | The chosen money account (amount) | 1100 AR (allocated part), 2200 Customer Advances (unallocated part) |
| P5a | Payment allocated to an advance invoice (US-PAY-13, Phase 6, [D-075](12-decisions.md)) | `payment` | The chosen money account | 2200 Customer Advances (no AR line); the advance invoice's balance drops; tax is charged when the deposit is offset on the final invoice |
| P6 | Sitting credit applied to an invoice | `payment_credit_applied` | 2200 Customer Advances | 1100 AR |
| P7 | Unallocated payment deleted | `payment_delete` | Reverses P4/P5 | |
| P8 | Credit note issued against an invoice | `credit_note` | Revenue (net), 2100 Output Tax | 1100 AR (up to the invoice's balance), 2200 Customer Advances (any excess, from Phase 8, [D-142](12-decisions.md)) — every line tagged with the invoice's `job_id` when it has one (US-JOB-27), so job revenue and billed to date drop by the credit |
| P9 | Invoice voided (with reason) | `invoice_void` | Reverses P1/P2 exactly | |
| P10 | Retention released (raises a `retention_release` invoice) | `invoice` | 1100 AR | 1150 Retention Receivable |
| P11 | Vendor bill recorded | `vendor_bill` | Expense/COGS per line account, 1200 Input Tax | 2000 AP (total) |
| P12 | Vendor bill voided | `vendor_bill_void` | Reverses P11 | |
| P13 | Vendor payment recorded | `vendor_payment` | 2000 AP | The chosen money account (US-BANK-03) |
| P14 | Vendor payment deleted | `vendor_payment_delete` | Reverses P13 | |
| P15 | Expense approved (submitted and rejected expenses post nothing) | `expense` | Category's expense account (net), 1200 Input Tax | The money account the approver confirmed (total) — a card's liability account when paid by card (US-BANK-03) |
| P16 | Approved expense billed to the customer | — | Nothing on billing itself; the draft invoice it creates posts P1 when issued | |
| P17 | Opening balances locked or saved (US-RPT-16, [D-137](12-decisions.md)) | `opening_balance` | Each account's debit balance on the cutover date | Each account's credit balance; the difference to 3900 Opening Balance Adjustments. Never 1100, 1150, 2000 or 2200. Dated the day before the cutover date; re-posted (reversed and posted again) while the opening balances are unlocked |
| P18 | Opening customer invoice (US-RPT-17) | `opening_invoice` | 1100 AR (amount due), 1150 Retention Receivable (retention held, tagged with its job) — contact-tagged | 3900 Opening Balance Adjustments |
| P19 | Opening customer credit (US-RPT-17) | `opening_customer_credit` | 3900 | 2200 Customer Advances (contact-tagged) |
| P20 | Opening vendor bill / opening vendor credit (US-RPT-18) | `opening_bill` / `opening_vendor_credit` | Bill: 3900 · Credit: 2000 AP | Bill: 2000 AP · Credit: 3900 (contact-tagged) |
| P21 | Manual journal posted (US-RPT-20, [D-134](12-decisions.md)) / reversed (US-RPT-21) | `manual_journal` / `manual_journal_reversal` | Lines as entered (optionally tagged with a job); never 1100, 1150, 1200, 2000, 2100, 2200 or 3900 · Reversal: mirrors the journal exactly | |
| P22 | Transfer between money accounts (US-BANK-04) / other money in or out (US-BANK-05) | `bank_transfer` / `bank_transaction` | Transfer: destination account · Money in: the money account · Money out: the chosen account (and 1200 Input Tax when a rate is picked) | Transfer: source account · Money in: the chosen account (income, equity, liability or asset that isn't a control account) · Money out: the money account |
| P23 | Customer refund (US-PAY-17) | `customer_refund` | 2200 Customer Advances (contact-tagged) | The money account |
| P24 | Vendor credit recorded (US-PUR-24, [D-141](12-decisions.md)) / voided (US-PUR-27) | `vendor_credit` / `vendor_credit_void` | 2000 AP (total, contact-tagged) · Void: reverses P24 | Expense/COGS per line account (net, job-tagged when the line has a job), 1200 Input Tax |
| P24a | Vendor credit applied to a bill (US-PUR-25) | — | *Nothing posted* — credit and bill both sit in 2000 AP for the vendor; an allocation row moves the open amounts | |
| P25 | Refund received from a vendor (US-PUR-26) | `vendor_refund` | The money account | 2000 AP (contact-tagged) |
| P26 | Tax payment recorded (US-TAX-08, [D-143](12-decisions.md)) | `tax_payment` | 2100 Output Tax Payable (paid + input tax used) | 1200 Input Tax Receivable (input tax used), the money account (paid) |
| P27 | Tax refund received (US-TAX-08) | `tax_refund` | The money account | 1200 Input Tax Receivable |
| P28 | Recurring bill run (US-PUR-30) | — | Nothing new: a recorded bill posts P11; a draft posts nothing until recorded | |
| P29 | Bank reconciliation (US-BANK-07–US-BANK-11) | — | Nothing: matching marks journal lines reconciled. Entries created from a statement line post by their own rule (P4, P13, P15, P22, P23, P25, P26) | |

## Invariants (tested)

1. Sum of debits = sum of credits for every entry (DB trigger; unbalanced inserts are rejected).
2. Each journal line is one-sided: exactly one of debit/credit is non-zero (`journal_lines_one_sided` check).
3. The trial balance balances after every simulated workflow (`ledger-integrity` integration test).
4. No posting is dated inside a closed fiscal period.
5. An issued invoice's reversal (P9) mirrors its original lines exactly, including job and contact tags.
6. Allocations never exceed the payment amount or the invoice balance (DB trigger), for customer and vendor payments alike.
7. Reports (P&L, Balance Sheet, Trial Balance, Cash Flow, general ledger, day book, AR/AP aging, job profitability, sales and purchase analysis) read `journal_lines`, never documents. Tax Summary's per-rate breakdown, GSTR-1 and the Tally export read document lines for rate, HSN/SAC and place of supply ([D-031](12-decisions.md), [D-148](12-decisions.md), [D-149](12-decisions.md)); their totals must equal the ledger's tax accounts for the same period (tested).
8. Manual journals never touch 1100, 1150, 1200, 2000, 2100, 2200 or 3900 (service check and test, [D-134](12-decisions.md)).
9. Vendor credit allocations plus vendor refunds never exceed the credit; customer refunds never exceed the customer's credit (DB triggers, like invariant 6).
10. A journal line matched in a finished reconciliation belongs to no other reconciliation, and its source document can't be voided or deleted until that reconciliation is undone ([D-158](12-decisions.md)).
11. Cash-basis figures are computed at report time from the accrual ledger and payment allocations; nothing is posted twice ([D-138](12-decisions.md)).

## Open points

- The ledger is accrual. A cash-basis P&L and dashboard profit are derived at report time ([D-138](12-decisions.md), closes [Q-04](13-risks-open-questions.md)).
- A practising accountant has not yet reviewed this table ([Q-02](13-risks-open-questions.md), [R-01](13-risks-open-questions.md)). P17–P27 are new in Phase 8 and need that review before they're built.
- An invoice with allocated payments can't be voided (P9 is refused); the correction is a credit note ([D-074](12-decisions.md)).
- Expenses paid by an employee still credit the chosen money account (P15); an "employee reimbursements payable" account is planned for v1.1 ([Q-05](13-risks-open-questions.md), [16-roadmap](16-roadmap.md)).
- Labour entered as headcount × day rate (US-PUR-23) is an ordinary expense: it posts P15 to its category's account (5200 Direct Labour by default) with the job's `job_id`. No new posting.
- Job budgets (US-JOB-24) and percent complete (US-JOB-28) never post. Billed to date (US-JOB-27) is read from `invoice` and `credit_note` lines on 1100 and 1150 tagged to the job, excluding retention-release entries ([D-127](12-decisions.md)).
- Retention never reduces the taxable value: tax is charged on the full progress claim and retention is held from the total (P2, [D-130](12-decisions.md)).
