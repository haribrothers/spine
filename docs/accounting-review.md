# Spine accounting review

For the accountant reviewing Spine's books during the beta ([D-265](prd/12-decisions.md), Q-02). Thank you for doing this. This pack explains how Spine keeps the books and suggests what to try. The last section is where your findings and sign-off go. Spine 1.0 isn't released until you've signed off.

## How Spine keeps the books

Spine is for small service and project businesses: trades, builders, agencies, consultancies. People don't enter journals for everyday work. They issue invoices, record payments, enter bills and approve expenses, and **each of those posts one balanced journal entry by itself**, in the same step as the document. The reports are read from those journal entries, never from the documents.

The rules Spine follows:

- **Accrual basis.** A cash-basis Profit & Loss is also available, worked out from the same entries and the payments.
- **Debits equal credits** on every entry; the database refuses anything else.
- **Nothing is edited or deleted once posted.** An issued invoice can't be changed. It's voided (an exact reversing entry) or credited (a credit note), and deletions of payments and the like post reversals dated the day they're made.
- **Money is exact.** Amounts are stored in the smallest unit (cents, paise). Tax is worked out per line and rounded once per line, half up.
- **Every entry is dated**, and nothing posts into a closed financial period.

## The accounts

Spine seeds this chart for every new business. The business can add accounts and rename the ones without ●. The ● accounts are Spine's own, and documents post to them automatically.

| Code | Account | Type |
|---|---|---|
| 1000 | Cash in Hand | Asset |
| 1010 | Bank Account (the default account money goes in and out of) | Asset |
| 1100 | Accounts Receivable ● | Asset |
| 1150 | Retention Receivable ● | Asset |
| 1200 | Input Tax Receivable ● | Asset |
| 1300 / 1500 / 1510 | Prepaid Expenses / Fixed Assets / Accumulated Depreciation | Asset |
| 2000 | Accounts Payable ● | Liability |
| 2100 | Output Tax Payable ● | Liability |
| 2200 | Customer Advances ● (deposits and credits held for customers) | Liability |
| 2300–2399 / 2400 / 2500 | Credit cards / Wages Payable / Loans Payable | Liability |
| 3000 / 3100 | Owner's Capital / Owner's Drawings | Equity |
| 3200 | Retained Earnings ● | Equity |
| 3900 | Opening Balance Adjustments ● | Equity |
| 4000 / 4100 | Sales — Goods / Sales — Services ● (the default income account) | Income |
| 4800 / 4900 | Interest Received / Discounts Given | Income |
| 5000–5500 | Materials, Subcontractors, Direct Labour (and, for builders, plant hire, fuel, site overheads) | Expense (cost of sales) |
| 6000–6900 | Rent, Utilities, Salaries, Travel, Professional Fees, Depreciation, Other | Expense |

## What each event posts

In the examples, tax is 10% and the business's money account is 1010 Bank.

| Event | Debit | Credit | Example |
|---|---|---|---|
| **Invoice issued** | 1100 Receivable (total) | Income per line (the item's account, or 4100), 2100 Output Tax | A 1,000 + 100 tax invoice: Dr 1100 1,100 · Cr 4100 1,000 · Cr 2100 100 |
| **Progress invoice with retention** (retention is a percentage of the claim before tax) | 1100 (total − retention), 1150 Retention Receivable | Income, 2100 Output Tax | A 10,000 claim + 1,000 tax, 5% retention held: Dr 1100 10,500 · Dr 1150 500 · Cr income 10,000 · Cr 2100 1,000 |
| **Retention released** | 1100 Receivable | 1150 Retention Receivable | Dr 1100 500 · Cr 1150 500 |
| **Deposit invoice issued** | *Nothing*: asking for a deposit isn't a claim | | |
| **Payment received** | The money account | 1100 (the part applied to invoices), 2200 Customer Advances (any part not applied) | 1,500 received against the 1,100 invoice: Dr 1010 1,500 · Cr 1100 1,100 · Cr 2200 400 |
| **Payment for a deposit invoice** | The money account | 2200 Customer Advances | |
| **Credit held applied to an invoice** | 2200 Customer Advances | 1100 Receivable | |
| **Credit note** | Income (net), 2100 Output Tax | 1100 (up to the invoice's balance), 2200 (any excess) | |
| **Invoice voided** | The exact reverse of its issue entry | | Only before payments are applied; otherwise a credit note |
| **Refund to a customer** | 2200 Customer Advances | The money account | |
| **Vendor bill recorded** | Expense or cost account per line, 1200 Input Tax | 2000 Payable (total) | A 500 + 50 materials bill: Dr 5000 500 · Dr 1200 50 · Cr 2000 550 |
| **Vendor bill voided** | The exact reverse | | |
| **Vendor paid** | 2000 Payable | The money account | |
| **Vendor credit / refund from a vendor** | 2000 Payable / the money account | Expense and 1200 (credit) / 2000 (refund) | |
| **Expense approved** (receipts entered by staff; submitted or rejected ones post nothing) | The category's account (net), 1200 Input Tax | The money account, or the card's 23xx account | A 42 + 4.20 fuel receipt: Dr 6300 42 · Dr 1200 4.20 · Cr 1010 46.20 |
| **Transfer / other money in or out** | The receiving account / the account it's for | The sending account / the money account | |
| **Tax payment / tax refund** | 2100 Output Tax (payment) / the money account (refund) | The money account / 1200 Input Tax | |
| **Opening balances** (the day a business starts on Spine) | Each account's debit balance | Each account's credit balance; any difference to 3900 | Open customer invoices, credits and vendor bills post against 3900 |
| **Manual journal** | As entered | As entered | Never to 1100, 1150, 1200, 2000, 2100, 2200 or 3900, which only documents move |
| **Bank reconciliation** | *Nothing*: it marks entries as matched | | |

The full technical list is in [06-ledger-posting-rules.md](prd/06-ledger-posting-rules.md).

Some decisions you may want to question:

- **Retention doesn't reduce tax.** Tax is charged on the full progress claim, and retention is held back from the total.
- **Deposits carry no tax** until the final invoice.
- **Expenses an employee paid personally** currently credit the money account chosen when they're approved. An "employee reimbursements payable" account is planned for 1.1, and your view on it is welcome.
- **Job costing:** a job's costs and profit are read from entries tagged with the job, never worked out separately.

## What to try

Sign in to the beta (the address and your account come in your invitation email). For each item, check the document, then the entry it posted (Reports › General ledger, or the document's own entries), then the reports.

1. **Setting up:** the business's country, tax rates, financial year and opening balances (Settings › Money & tax). Do the opening Balance Sheet and Trial Balance agree with what you entered?
2. **Sales:** an invoice with mixed tax rates; a progress invoice with retention, then the retention released; a deposit invoice, its payment, then the final invoice the deposit is set against.
3. **Getting paid:** a part payment; an overpayment (where does the extra sit?); one payment across two invoices; a refund of a credit.
4. **Corrections:** void an unpaid invoice; credit a paid one, in part and in full; delete a payment. Check the reversals and their dates.
5. **Buying:** a vendor bill against a job, its payment, a vendor credit; an expense entered on the phone, approved, and billed on to the customer.
6. **Tax:** the Tax Summary for a period against your own working, then record the tax payment. In India: GSTR-1 (Reports › GSTR-1).
7. **Banking:** import a bank statement (CSV) and reconcile it.
8. **The reports:** Profit & Loss (accrual and cash), Balance Sheet, Trial Balance, Cash Flow, General ledger, Day book, Receivables and Payables ageing, Job profitability. Do they tie to each other, and to the entries?
9. **Closing a period:** close a month or the year so nobody back-dates into it. Does anything still post into the closed period, and does reopening it work as you'd expect?
10. **Exports:** the Tally export (if you use Tally) and the full data export.

The demo business (Settings › Data › Demo data) gives you a few months of work to look through straight away. "Delete all demo data" removes only the demo.

## Findings

Write each finding below, or send it to the person who invited you. Each one becomes a fix in the next beta, which is then re-checked here.

| # | What you found | Where (page, document, report) | Your recommendation | Status |
|---|---|---|---|---|
| 1 | | | | |

## Sign-off

- [ ] The chart of accounts suits the businesses Spine is for.
- [ ] Each event above posts what it should.
- [ ] The reports agree with each other and with the entries.
- [ ] Every finding is fixed, or accepted with a note.

Reviewed by: ______________________ (name, qualification)

Version reviewed: Spine ______________ (Settings › About Spine)

Date: ______________

Notes:
