# 10 · Purchases & expenses

Money out: bills from vendors (drafted, then recorded to post), payments to vendors allocated across bills, expenses submitted by anyone (including from the field) and approved before they post — including site labour entered as headcount × day rate — billable expenses passed on to customers, and a payables view of what's due. Phase 8 adds vendor credits (applied to bills or refunded) and recurring bills.

**Screens:** `VendorBillsList` (P1), `VendorBillsEmpty` (P1), `VendorBillBuilder` (P1), `VendorBillDetailDraft` (P1), `VendorBillDetail` (P1), `VendorBillVoidDialog` (P1), `VendorPaymentsList` (P1), `VendorPaymentsEmpty` (P2), `NewVendorPaymentDialog` (P1), `VendorPaymentDrawer` (P2), `ExpensesList` (P1), `ExpensesEmpty` (P1), `ExpenseDialog` (P1), `ExpenseDrawerSubmitted` (P1), `ExpenseApproveConfirm` (P1), `ExpenseRejectDialog` (P1), `ExpenseDrawerApproved` (P2), `ExpenseBillToCustomer` (P2), `EmailExpenseApproved` (P3), `Payables` (P1), `PayablesEmpty` (P1), `SettingsPurchases` (P2), `ExpenseCategoryDialog` (P2), `ExpensesBulkSelect` (P2), `ExpenseCategories` (P2), `ExpenseDrawerOwn` (P1), `ExpensesJobFilter` (P2), `ExpenseDialogLabour` (P1), `VendorCreditsList` (P1), `VendorCreditBuilder` (P1), `VendorCreditDetail` (P1), `ApplyVendorCreditDialog` (P1), `VendorRefundDialog` (P1), `RecurringBillDialog` (P2), `RecurringBillsList` (P2), `VendorBillPage` (P2), `VendorBillPayDialog` (P2), `VendorBillsListRefined` (P2), `VendorBillsListDark` (P2), `VendorBillDuplicateWarning` (P2), `VendorBillsBulkRecord` (P2)
**Depends on:** 03 Contacts (vendors), 07 Jobs (costing), 11 Tax, 08 Invoicing (billing expenses on), 17 Mobile (field submission).

## Features

| ID | Feature | Priority | Phase | Screens |
|---|---|---|---|---|
| F-PUR-01 | Vendor bills | P1 | 4 | `VendorBillBuilder`, `VendorBillDetailDraft`, `VendorBillDetail`, `VendorBillsList`, `VendorBillsEmpty`, `VendorBillVoidDialog` |
| F-PUR-02 | Vendor payments | P1 | 4 | `NewVendorPaymentDialog`, `VendorPaymentsList`, `VendorPaymentsEmpty`, `VendorPaymentDrawer` |
| F-PUR-03 | Expenses with approval | P1 | 4 | `ExpenseDialog`, `ExpensesList`, `ExpensesEmpty`, `ExpenseDrawerSubmitted`, `ExpenseApproveConfirm`, `ExpenseRejectDialog`, `EmailExpenseApproved` |
| F-PUR-04 | Billable expenses | P2 | 4 | `ExpenseDrawerApproved`, `ExpenseBillToCustomer` |
| F-PUR-05 | Payables and AP aging | P1 | 4 | `Payables`, `PayablesEmpty` |
| F-PUR-06 | Expense categories | P2 | 4 | `SettingsPurchases`, `ExpenseCategoryDialog` |
| F-PUR-07 | Own/others and workflow rights | P1 | 4 | `ExpensesList`, `VendorBillsList` |
| F-PUR-08 | Job filter and labour expenses | P1 | 7 | `ExpensesJobFilter`, `ExpenseDialogLabour` |
| F-PUR-09 | Vendor credits | P1 | 8 | `VendorCreditsList`, `VendorCreditBuilder`, `VendorCreditDetail`, `ApplyVendorCreditDialog`, `VendorRefundDialog`, `TeamPrivilegesBooks` |
| F-PUR-10 | Recurring bills | P2 | 8 | `RecurringBillDialog`, `RecurringBillsList` |
| F-PUR-11 | Vendor bills you can work from: a page per bill, paying from it, a list that shows money, safer entry | P2 | Refinements | `VendorBillPage`, `VendorBillPayDialog`, `VendorBillsListRefined`, `VendorBillsListDark`, `VendorBillDuplicateWarning`, `VendorBillsBulkRecord` |
| F-PUR-12 | Vendor credits you can work from: a page per credit, a list that shows money, entry like a bill, raised and used from the bill | P2 | Refinements | `VendorCreditPage`, `VendorCreditsListRefined`, `VendorCreditsListDark`, `VendorCreditsBulkRecord`, `VendorCreditBuilderRefined`, `VendorCreditReplaceLines`, `VendorBillRecordCredit`, `VendorCreditApplyRefined` |

## User stories

### US-PUR-01 · Enter a bill from a vendor
**Feature:** F-PUR-01 · **Priority:** P1 · **Phase:** 4 · **Screens:** `VendorBillBuilder`, `VendorBillDetailDraft`
**As** office staff, **I want** to enter a vendor's bill with lines, tax and due date, **so that** what we owe is visible.

Legacy: S-07.1, S-07.5

**Acceptance criteria**
- **Given** I press "New vendor bill", **when** the builder opens, **then** I see "Vendor", "Bill number" (helper "The vendor's own number — not system-generated.", placeholder "e.g. INV-1042"), "Job" (helper "Optional — flows into job costing once recorded."), "Currency", "Date", "Due date", lines and "Notes".
- **Given** no vendor, **when** I press "Save as draft", **then** I see "Select a vendor before saving.".
- **Given** no bill number, **when** I save, **then** I see "Enter the vendor's bill number before saving.".
- **Given** valid input, **when** I save, **then** a draft bill is created that posts nothing to the ledger.

**Implementation notes**
- API: `POST /vendor-bills` (`vendor_bills.edit_own`), `PUT /vendor-bills/:id` (draft only).
- UI: a new builder's button reads "Save as draft"; editing an existing draft reads "Save draft".
- Data: `vendor_bills` (`bill_number` is vendor text), `vendor_bill_lines` (expense account per line).

### US-PUR-02 · Record a bill so it posts to the books
**Feature:** F-PUR-01 · **Priority:** P1 · **Phase:** 4 · **Screens:** `VendorBillDetail`
**As** office staff, **I want** recording a bill to lock it and post it, **so that** payables and costs are right.

**Acceptance criteria**
- **Given** a draft bill, **when** I press "Record", **then** it becomes "Recorded", shows a "Vendor bill recorded" toast and can't be edited.
- **Given** it's recorded, **when** I check its journal entries (Reports › account drill-down), **then** expense lines and input tax are debited and Accounts Payable credited.
- **Given** a bill tagged to a job, **when** it's recorded, **then** the job's costing includes its net amount.
- **Given** recording fails, **when** the error returns, **then** I see "Could not record this vendor bill.".

**Implementation notes**
- API: `POST /vendor-bills/:id/record` (`vendor_bills.record`); posting P11.

### US-PUR-03 · Find vendor bills and see what's overdue
**Feature:** F-PUR-01 · **Priority:** P1 · **Phase:** 4 · **Screens:** `VendorBillsList`, `VendorBillsEmpty`
**As** office staff, **I want** a list of bills with status and due dates, **so that** nothing is paid late.

**Acceptance criteria**
- **Given** bills exist, **when** I open Vendor Bills, **then** I see "Total bills", "Draft", "Recorded" and "Overdue" and a table of bill number, vendor, status, due date, total and balance.
- **Given** a recorded bill past due with a balance, **when** it's listed, **then** it shows "Overdue".
- **Given** I filter by status or vendor ("All vendors"), **when** it applies, **then** only matching bills show.
- **Given** none exist, **when** I open the page, **then** I see "No vendor bills yet" and "Record a bill from a vendor — save it as a draft, then record it when it's ready to post to the ledger.".

**Implementation notes**
- API: `GET /vendor-bills?status=&contactId=`.

### US-PUR-04 · Void a recorded bill with a reason
**Feature:** F-PUR-01 · **Priority:** P1 · **Phase:** 4 · **Screens:** `VendorBillVoidDialog`
**As** office staff, **I want** to void a bill entered in error, **so that** payables are corrected with a trail.

**Acceptance criteria**
- **Given** a recorded bill with no payments, **when** I press "Void", **then** "Void this vendor bill?" asks for a required "Reason".
- **Given** no reason, **when** I confirm, **then** I see "A reason is required to void a vendor bill.".
- **Given** a reason, **when** I confirm, **then** the bill shows "Void", a reversing entry posts, and a "Vendor bill voided" toast shows.
- **Given** a bill with payments, **when** I try to void it, **then** it's refused.

**Implementation notes**
- API: `POST /vendor-bills/:id/void` (`vendor_bills.void`); posting P12.

### US-PUR-05 · Pay a vendor across several bills
**Feature:** F-PUR-02 · **Priority:** P1 · **Phase:** 4 · **Screens:** `NewVendorPaymentDialog`
**As** office staff, **I want** to record a payment to a vendor allocated across bills, **so that** payables clear correctly.

Legacy: S-07.8

**Acceptance criteria**
- **Given** Vendor Payments, **when** I press "Record payment", **then** "Record a vendor payment" asks for "Vendor", "Date", "Method", "Reference", "Amount" and an allocation suggested oldest-first.
- **Given** allocations that don't equal the amount, **when** I confirm, **then** I see "Allocations must sum to exactly the payment amount." with "Remaining to allocate".
- **Given** the vendor has no recorded bills, **when** I open the allocation, **then** I see "This vendor has no outstanding recorded bills.".
- **Given** a valid payment, **when** it saves, **then** each bill's balance drops and AP is debited, Bank credited.

**Implementation notes**
- API: `GET /vendor-payments/suggest-allocation`, `POST /vendor-payments` (`vendor_payments.edit_own`); posting P13; trigger I5.

### US-PUR-06 · See and delete vendor payments
**Feature:** F-PUR-02 · **Priority:** P2 · **Phase:** 4 · **Screens:** `VendorPaymentsList`, `VendorPaymentsEmpty`, `VendorPaymentDrawer`
**As** office staff, **I want** a list of vendor payments and to delete a wrong one, **so that** money out is accurate.

**Acceptance criteria**
- **Given** payments exist, **when** I open Vendor Payments, **then** I see "Total payments" and "Total paid" and a table of number, date, vendor, method and amount.
- **Given** I click a payment, **when** the drawer opens, **then** it shows its details and the bills it paid.
- **Given** I delete a payment, **when** I confirm, **then** a reversing entry posts and the bills' balances return.
- **Given** none exist, **when** I open the page, **then** I see "No vendor payments recorded yet".

**Implementation notes**
- API: `GET /vendor-payments`, `DELETE /vendor-payments/:id` (`vendor_payments.delete_*`); posting P14.
- Unlike customer payments (US-PAY-06), an allocated vendor payment can be deleted: nothing was sent to a third party ([D-080](../prd/12-decisions.md)).

### US-PUR-07 · Submit an expense with a receipt
**Feature:** F-PUR-03 · **Priority:** P1 · **Phase:** 4 · **Screens:** `ExpenseDialog`, `ExpensesList`, `ExpensesEmpty`
**As** any member, **I want** to submit an expense with a receipt photo, **so that** I'm reimbursed and the cost is tracked.

Legacy: S-07.2 (web)

**Acceptance criteria**
- **Given** Expenses, **when** I press "Submit expense", **then** "Submit an expense" says "A submitted expense doesn't post to the ledger until an owner or staff member approves it." and asks for "Category", "Job" (optional), "Date", "Currency", "Amount", "Tax rate", "Tax amount" (helper "Included in the amount above, not added on top."), "Paid by", "Description", "Billable to a customer" and a receipt. "Currency" is read-only and set to the organisation's currency (single-currency, non-goal).
- **Given** no category, **when** I save, **then** I see "Select a category before saving.".
- **Given** a zero amount, **when** I save, **then** I see "Enter an amount greater than zero.".
- **Given** I attach a receipt photo up to 10 MB, **when** it uploads, **then** it's linked; if it fails I see "Could not upload the receipt.".
- **Given** I save, **when** it succeeds, **then** "Expense submitted" shows and it's listed as "Submitted".

**Implementation notes**
- API: `POST /files`, `POST /expenses` (`expenses.edit_own`; Field always for own).
- Data: `expenses` (`submitted_by_user_id`, `receipt_file_id`, `paid_by`, `is_billable`).

### US-PUR-08 · Approve a submitted expense
**Feature:** F-PUR-03 · **Priority:** P1 · **Phase:** 4 · **Screens:** `ExpenseDrawerSubmitted`, `ExpenseApproveConfirm`, `EmailExpenseApproved`
**As** office staff, **I want** to approve expenses, **so that** there's a control before they count.

Legacy: S-07.4

**Acceptance criteria**
- **Given** a submitted expense, **when** I open it and press "Approve", **then** "Approve this expense?" offers an "Optional comment" field.
- **Given** I confirm, **when** it succeeds, **then** I see "Expense approved" / "It has been posted to the ledger." and it shows "Approved".
- **Given** it's approved, **when** I check its journal entry (Reports › account drill-down), **then** the category's expense account and input tax are debited and Bank credited.
- **Given** it's approved, **when** the submitter checks, **then** they're notified (in-app; email "Expense approved — <category>").

**Implementation notes**
- API: `POST /expenses/:id/approve` (`expenses.approve`); posting P15.

### US-PUR-09 · Reject a submitted expense with a comment
**Feature:** F-PUR-03 · **Priority:** P1 · **Phase:** 4 · **Screens:** `ExpenseRejectDialog`
**As** office staff, **I want** to reject an expense with a reason, **so that** the submitter knows what to fix.

**Acceptance criteria**
- **Given** a submitted expense, **when** I press "Reject", **then** "Reject this expense?" requires "Rejection reason" (placeholder "Why is this being rejected?").
- **Given** no reason, **when** I confirm, **then** the reason field shows an error.
- **Given** a reason, **when** I confirm, **then** I see "Expense rejected" / "It has not been posted to the ledger." and the submitter sees the reason on their expense.

**Implementation notes**
- API: `POST /expenses/:id/reject` (`expenses.reject`); no posting.

### US-PUR-10 · Edit or delete my submitted expense
**Feature:** F-PUR-03 · **Priority:** P1 · **Phase:** 4 · **Screens:** `ExpenseDrawerSubmitted`
**As** a member, **I want** to fix or withdraw an expense before it's reviewed, **so that** mistakes don't reach the books.

**Acceptance criteria**
- **Given** my submitted expense, **when** I edit and save it, **then** it updates and stays "Submitted".
- **Given** an approved or rejected expense, **when** I try to edit it, **then** I see "Only a submitted expense can be edited — an approved expense has already posted to the ledger.".
- **Given** my submitted expense, **when** I delete it and confirm "Delete this expense?", **then** it's removed.

**Implementation notes**
- API: `PUT/DELETE /expenses/:id` (submitted only).

### US-PUR-11 · Bill an approved expense to the customer
**Feature:** F-PUR-04 · **Priority:** P2 · **Phase:** 4 · **Screens:** `ExpenseDrawerApproved`, `ExpenseBillToCustomer`
**As** office staff, **I want** to pass a billable expense on to the job's customer, **so that** reimbursable costs are recovered.

Legacy: S-07.6

**Acceptance criteria**
- **Given** an approved, billable expense tagged to a job, **when** I press "Bill to customer", **then** "Bill this expense to the customer?" says it creates a draft invoice for the job's customer for the full amount and marks it billed.
- **Given** I press "Create invoice", **when** it succeeds, **then** a draft invoice exists with the expense as a line and I'm taken to it; the expense shows "Billable: Yes — billed".
- **Given** an expense already billed, **when** I open it, **then** "Bill to customer" isn't offered.

**Implementation notes**
- API: `POST /expenses/:id/bill-to-customer` (`expenses.bill_to_customer`).
- Data: `expenses.billed_on_invoice_line_id`.
- The confirm button's colour (primary, not danger) is fixed by US-OPS-10.

### US-PUR-12 · Mark an expense billed without a new invoice
**Feature:** F-PUR-04 · **Priority:** P2 · **Phase:** 4 · **Screens:** `ExpenseDrawerApproved`
**As** office staff, **I want** to mark an expense billed when I added it to an invoice by hand, **so that** it isn't billed twice.

**Acceptance criteria**
- **Given** an approved billable expense, **when** I choose "Mark billed", **then** it shows billed without creating an invoice.
- **Given** a non-billable expense, **when** I open it, **then** neither billing action is offered.
- **Given** I lack `expenses.mark_billed`, **when** I open it, **then** "Mark billed" is hidden.

**Implementation notes**
- API: `POST /expenses/:id/mark-billed` (`expenses.mark_billed`).

### US-PUR-13 · See what we owe vendors and when
**Feature:** F-PUR-05 · **Priority:** P1 · **Phase:** 4 · **Screens:** `Payables`, `PayablesEmpty`
**As** an owner, **I want** payables with due dates in age buckets, **so that** I pay on time.

Legacy: S-07.7, S-09.5 (AP half)

**Acceptance criteria**
- **Given** recorded unpaid bills, **when** I open Payables, **then** I see Current, 1–30, 31–60, 61–90 and 90+ day buckets, "Total outstanding", and a table of bill, vendor, due date, aging and balance.
- **Given** nothing is owed, **when** I open it, **then** I see "Nothing outstanding" / "Every recorded vendor bill has been paid in full.".
- **Given** a Staff user without `reports.view_payables`, **when** they open it, **then** they see the no-access page.

**Implementation notes**
- API: `GET /reports/payables` (from `journal_lines` on AP).

### US-PUR-14 · Export payables to CSV
**Feature:** F-PUR-05 · **Priority:** P2 · **Phase:** 6 · **Screens:** `Payables`
**As** an owner, **I want** payables as CSV, **so that** I can plan payments in a spreadsheet.

**Acceptance criteria**
- **Given** Payables, **when** I choose "Export CSV", **then** a CSV downloads with one row per open bill and its bucket.
- **Given** the CSV, **when** it opens, **then** amounts are plain decimals with currency in its own column.
- **Given** no open bills, **when** I export, **then** the file has only the header row.

**Implementation notes**
- API: `GET /reports/payables/export.csv` (built). The page button isn't, so this story moved to Phase 6.

### US-PUR-15 · Manage expense categories
**Feature:** F-PUR-06 · **Priority:** P2 · **Phase:** 4 · **Screens:** `SettingsPurchases`, `ExpenseCategoryDialog`
**As** an owner or office staff, **I want** my own expense categories mapped to accounts, **so that** expenses post where I expect.

**Acceptance criteria**
- **Given** Settings › Purchases, **when** it opens, **then** it lists "Expense categories" with name and posting account and "+ Add category".
- **Given** "Add category", **when** I enter "Name" and choose "Default posting account" and press "Save", **then** it appears in the expense form's category list.
- **Given** a category used by expenses, **when** I archive it, **then** it disappears from the form but old expenses keep it.

**Implementation notes**
- API: `POST/PUT /expense-categories`, `/archive`, `/restore`, `DELETE`.
- Staff access to categories moves to Expenses › Categories in US-PUR-19 (Phase 6, [D-078](../prd/12-decisions.md)); today the pane lives in Owner-only Settings.

### US-PUR-16 · Delete an unused expense category
**Feature:** F-PUR-06 · **Priority:** P3 · **Phase:** 4 · **Screens:** `SettingsPurchases`
**As** an owner, **I want** to delete a category created by mistake, **so that** the list stays short.

**Acceptance criteria**
- **Given** a category no expense uses, **when** I delete it and confirm, **then** it's removed.
- **Given** a category in use, **when** I try to delete it, **then** I'm told to archive it instead.
- **Given** I lack the delete right for it, **when** I open its menu, **then** delete isn't offered.

**Implementation notes**
- API: `DELETE /expense-categories/:id` (`expense_categories.delete_*`).

### US-PUR-17 · Let a Team edit only its own purchases records
**Feature:** F-PUR-07 · **Priority:** P1 · **Phase:** 4 · **Screens:** `ExpensesList`, `VendorBillsList`
**As** an owner, **I want** own/others rights per purchases resource, **so that** juniors self-manage without touching colleagues' submissions.

Legacy: S-07.9

**Acceptance criteria**
- **Given** a member with `expenses.edit_own` only, **when** they open a colleague's submitted expense, **then** edit is hidden and the API returns 403.
- **Given** a field user, **when** they edit or delete their own submitted expense, **then** it works; on anyone else's it's refused.
- **Given** a member with `vendor_bills.edit_own` only, **when** they open a colleague's draft bill, **then** they can't edit it.
- **Given** expense categories, vendor bills and vendor payments, **when** rights are set, **then** each group is enforced independently.

**Implementation notes**
- Ownership: `expenses.submitted_by_user_id`; `created_by_user_id` for the others.

### US-PUR-18 · Grant approving, rejecting, recording and voiding separately
**Feature:** F-PUR-07 · **Priority:** P1 · **Phase:** 4 · **Screens:** `ExpensesList`, `VendorBillsList`
**As** an owner, **I want** review actions as their own rights, **so that** I choose who has authority over others' submissions.

**Acceptance criteria**
- **Given** a member without `expenses.approve`, **when** they open a submitted expense, **then** "Approve" is hidden and the API returns 403.
- **Given** a member with `expenses.approve`, **when** they approve a colleague's expense, **then** it works even without `expenses.edit_others`.
- **Given** a member without `vendor_bills.void`, **when** they open a recorded bill, **then** "Void" is hidden.

**Implementation notes**
- API: `@RequireCapability` on approve, reject, record, void, mark-billed, bill-to-customer.

### US-PUR-19 · Manage expense categories from Expenses
**Feature:** F-PUR-06 · **Priority:** P2 · **Phase:** 6 · **Screens:** `ExpenseCategories`, `ExpenseCategoryDialog`, `ExpenseDialog`
**As** office staff with category rights, **I want** to manage expense categories without Settings, **so that** I'm not blocked by the Owner-only Settings dialog.

Decision: D-078 · Review finding: Stage 5 #19–#20

**Acceptance criteria**
- **Given** a member with `expense_categories.edit_own` or `edit_others` (or an Owner), **when** they open Expenses, **then** a "Categories" tab at `/expenses/categories` lists categories with name, posting account and "+ Add category".
- **Given** a member with neither capability, **when** they open Expenses, **then** the "Categories" tab is hidden and `/expenses/categories` shows the no-access page.
- **Given** Settings, **when** an Owner opens it, **then** "Purchases" is no longer a section.
- **Given** the expense form and Expenses page subtitle, **when** they render, **then** they read "Submit an expense for approval. Categories are managed from Expenses › Categories." for members who can manage categories, and "Submit an expense for approval." for everyone else.

**Implementation notes**
- API: unchanged (`/expense-categories` routes and their capabilities).
- UI: the new tab reuses the existing `SettingsPurchases` pane layout (no separate screen drawn); move it from `settings-dialog.tsx` to `apps/web/src/app/(app)/expenses/categories/page.tsx`; reuse `ExpenseCategoryDialog`.
- Security: remove "purchases" from the Owner-only Settings list in 07.

### US-PUR-20 · Stop staff approving their own expenses
**Feature:** F-PUR-07 · **Priority:** P1 · **Phase:** 6 · **Screens:** `ExpenseDrawerOwn`, `ExpenseApproveConfirm`
**As** an owner, **I want** a second person to approve every staff expense, **so that** nobody signs off their own spending.

Decision: D-085

**Acceptance criteria**
- **Given** a Staff member with `expenses.approve` opens their own submitted expense, **when** the drawer renders, **then** "Approve" is hidden and the drawer shows "Someone else needs to approve your own expense."; "Edit" and "Delete expense" stay available while it is "Submitted".
- **Given** the same member calls `POST /expenses/:id/approve` on their own expense, **when** it's sent, **then** the API returns 403.
- **Given** an Owner opens their own submitted expense, **when** they press "Approve", **then** it's approved as normal.
- **Given** a Staff member with `expenses.approve` opens a colleague's expense, **when** they approve it, **then** it works as in US-PUR-08.
- **Given** a Staff member, **when** they reject their own expense, **then** it's refused the same way (reject is a review action too).

**Implementation notes**
- API: `ExpensesService.approve/reject` compare `submitted_by_user_id` with the caller; Owners bypass.

### US-PUR-21 · Approve several expenses at once
**Feature:** F-PUR-07 · **Priority:** P2 · **Phase:** 7 · **Screens:** `ExpensesBulkSelect`
**As** office staff with approval rights, **I want** to approve a batch of expenses together, **so that** weekly approvals are quick.

Decision: D-097

**Acceptance criteria**
- **Given** the Expenses list, **when** I tick submitted expenses, **then** a bar shows "<n> selected · <amount>" with "Approve (<n>)", "Reject…" and "Clear".
- **Given** my own expense, **when** I try to tick it, **then** its checkbox is disabled and the page notes "Your own expenses can't be selected for approval — someone else approves them." (Staff; Owners may select their own, D-085).
- **Given** I press "Approve (2)", **when** it finishes, **then** each is approved and posted exactly as a single approval would be, and a toast reads "2 expenses approved".
- **Given** "Reject…", **when** I press it, **then** one dialog asks for a comment applied to every selected expense.
- **Given** I lack `expenses.approve`, **when** the list renders, **then** row checkboxes are hidden.

**Implementation notes**
- API: `POST /expenses/bulk/approve { ids }`, `POST /expenses/bulk/reject { ids, comment }` (contract additions, `expenses.approve`/`expenses.reject`, idempotent, max 100); each item posts its own journal entry (P15).

### US-PUR-22 · Filter bills and expenses by job
**Feature:** F-PUR-08 · **Priority:** P2 · **Phase:** 7 · **Screens:** `ExpensesJobFilter`, `JobCostingBudget`
**As** an owner, **I want** to list only the bills and expenses on one job, **so that** I can check what makes up its cost.

**Acceptance criteria**
- **Given** Vendor Bills or Expenses, **when** the filter bar renders, **then** it has a job filter ("All jobs", then each job as "<number> · <name>") beside the existing filters.
- **Given** I choose a job, **when** it applies, **then** only bills or expenses tagged to it show, the counters above the table count only those, and the URL keeps the filter (`?jobId=`) so it can be shared or reloaded.
- **Given** a job with nothing tagged, **when** I filter by it, **then** I see "No vendor bills on this job" or "No expenses on this job" with "Clear filter".
- **Given** a job's Costing tab, **when** I press "View bills and expenses" under "Cost", **then** Vendor Bills opens filtered to that job, with a link to the same filter on Expenses.
- **Given** a Field user, **when** they filter their own expenses by job, **then** only their own expenses on jobs they're assigned to are listed and offered.

**Implementation notes**
- API: `GET /vendor-bills?jobId=` and `GET /expenses?jobId=` (contract additions); existing read rules unchanged.
- UI: job options come from `GET /jobs` (Field: assigned jobs only, US-JOB-19).

### US-PUR-23 · Enter site labour as headcount × day rate
**Feature:** F-PUR-08 · **Priority:** P1 · **Phase:** 7 · **Screens:** `ExpenseDialogLabour`
**As** a site supervisor or office staff, **I want** to enter a day's labour as workers per trade times their day rate, **so that** labour cost reaches the job without working the total out by hand.

Decision: D-126

**Acceptance criteria**
- **Given** "Submit an expense", **when** it opens, **then** an "Enter as" switch offers "Amount" (today's form, the default) and "Headcount × day rate".
- **Given** "Headcount × day rate", **when** I choose it, **then** the "Amount" field is replaced by rows of "Trade" (placeholder "e.g. Mason"), "Workers" and "Day rate" with each row's total, "+ Add trade" and a running "Total for the day", and "Job" becomes required ("Labour is always for a job — choose one.").
- **Given** 4 masons at 950.00, 3 carpenters at 900.00 and 8 helpers at 650.00, **when** I look at the total, **then** it reads 11,700.00 and saving stores the expense amount as 11,700.00.
- **Given** a trade I've used before, **when** I type it, **then** it's suggested and its last day rate is filled in, which I can change.
- **Given** a row with no trade, zero workers or a zero day rate, **when** I save, **then** I see "Every row needs a trade, at least one worker and a day rate." and nothing saves.
- **Given** an organisation with a category posting to 5200 Direct Labour, **when** I switch to "Headcount × day rate", **then** that category is preselected; I can choose another.
- **Given** the expense is approved, **when** it posts, **then** it posts like any expense (P15) to the category's account, tagged to the job, and the expense drawer lists each row ("4 Mason × 950.00 = 3,800.00").
- **Given** the form, **when** it renders, **then** it never asks for workers' names, attendance or hours.

**Implementation notes**
- API: `POST/PUT /expenses` accept `entryMode: "amount"|"labour"` and, for labour, `labourLines: [{ trade, headcount, dayRateAmount }]` (max 20); the server computes each line and the expense `amount` and refuses a client-sent amount that disagrees. `GET /expenses/labour-trades?q=` → `[{ trade, lastDayRateAmount }]` from the organisation's previous labour lines (readers of expenses).
- Data: `expenses.entry_mode text not null default 'amount'`; new `expense_labour_lines` (`id`, `org_id`, `expense_id` → expenses cascade, `sort_order`, `trade`, `headcount integer`, `day_rate_amount bigint`, `line_amount bigint`).
- Money: each line is headcount × day rate in minor units (no rounding needed); the expense amount is the sum.
- Mobile: the phone expense form (US-MOB-13) keeps the amount form in this phase; the labour form on the phone is a later story.


### US-PUR-24 · Record a credit from a vendor
**Feature:** F-PUR-09 · **Priority:** P1 · **Phase:** 8 · **Screens:** `VendorCreditBuilder`, `VendorCreditsList`
**As** office staff, **I want** to record a vendor's credit note for returned goods or an overcharge, **so that** what we owe goes down without voiding the bill.

Decision: D-141

**Acceptance criteria**
- **Given** Purchases › "Vendor credits" › "New vendor credit", **when** the form opens, **then** it asks for "Vendor", "Vendor's credit note number", "Date", optional "Against bill" and lines like a bill (account, description, quantity, price, tax, job).
- **Given** "Against bill", **when** I choose a bill, **then** its lines can be copied in and edited down.
- **Given** a draft, **when** I press "Record", **then** it gets the next `VCR-` number, posts P24 (Dr AP, Cr each line's account and input tax, job-tagged lines lower that job's cost) and shows "Open — <amount> to use".
- **Given** a recorded credit, **when** I open it, **then** it can't be edited; mistakes are voided (US-PUR-27).
- **Given** the list, **when** it loads, **then** each credit shows number, vendor's number, vendor, date, amount, balance and status ("Draft", "Open", "Used", "Void").

**Implementation notes**
- API: `GET/POST /vendor-credits`, `GET/PUT/DELETE /vendor-credits/:id` (draft only), `POST /vendor-credits/:id/record` (`vendor_credits.*`, own/others in the service).
- Data: `vendor_credits`, `vendor_credit_lines` (new; lines shaped like `vendor_bill_lines`); numbering type `vendor_credit`.

### US-PUR-25 · Apply a vendor credit to bills
**Feature:** F-PUR-09 · **Priority:** P1 · **Phase:** 8 · **Screens:** `ApplyVendorCreditDialog`
**As** office staff, **I want** to use a vendor credit against their open bills, **so that** I pay only what's really owed.

**Acceptance criteria**
- **Given** an open vendor credit, **when** I press "Apply to bills", **then** I see the vendor's open bills, oldest first, with "Amount to apply" boxes prefilled oldest-first.
- **Given** amounts above the credit's balance or a bill's balance, **when** I save, **then** I see "You can apply up to <amount> to this bill." and nothing saves.
- **Given** a valid allocation, **when** I save, **then** the bills' balances drop, nothing posts (P24a), and the credit's balance drops; at zero it shows "Used".
- **Given** a bill, **when** I open it, **then** "Credits applied" lists each vendor credit and amount.
- **Given** "Pay bill" for a vendor with open credit, **when** the dialog opens, **then** it shows "<Vendor> has <amount> of credit. Apply it first?" with a link.

**Implementation notes**
- API: `POST /vendor-credits/:id/apply { allocations: [{ billId, amount }] }` (`vendor_credits.apply`); `DELETE /vendor-credits/:id/allocations/:allocationId` undoes one.
- Data: `vendor_credit_allocations` (new); trigger keeps allocations + refunds ≤ credit and ≤ bill balance (invariant 9).

### US-PUR-26 · Record a refund from a vendor
**Feature:** F-PUR-09 · **Priority:** P1 · **Phase:** 8 · **Screens:** `VendorRefundDialog`
**As** office staff, **I want** to record money a vendor paid back, **so that** the credit closes and the bank shows the money.

**Acceptance criteria**
- **Given** an open vendor credit, **when** I choose "Record refund", **then** I enter "Amount" (up to the balance), "Date", "Paid into" (money account), "Method" and "Reference".
- **Given** I save, **when** it posts, **then** P25 debits the money account and credits AP, and the credit's balance drops.
- **Given** a refund that isn't reconciled, **when** I delete it, **then** a reversing entry posts and the balance returns.

**Implementation notes**
- API: `POST /vendor-credits/:id/refunds`, `DELETE /vendor-refunds/:id` (`vendor_credits.apply`).
- Data: `vendor_refunds` (new).

### US-PUR-27 · Void a vendor credit
**Feature:** F-PUR-09 · **Priority:** P2 · **Phase:** 8 · **Screens:** `VendorCreditDetail`
**As** office staff, **I want** to void a credit entered by mistake, **so that** AP is right again.

**Acceptance criteria**
- **Given** a credit with nothing applied or refunded, **when** I choose "Void" and give a reason, **then** P24's reversal posts and the credit shows "Void — <reason>".
- **Given** a credit with allocations or refunds, **when** I try to void it, **then** I see "Remove its <n> applications and refunds first." and nothing changes.

**Implementation notes**
- API: `POST /vendor-credits/:id/void { reason }` (`vendor_credits.void`).

### US-PUR-28 · Let a Team manage vendor credits
**Feature:** F-PUR-09 · **Priority:** P1 · **Phase:** 8 · **Screens:** `TeamPrivilegesBooks`
**As** an owner, **I want** vendor credit rights like bill rights, **so that** I decide who reduces what we owe.

**Acceptance criteria**
- **Given** a Team's privileges, **when** I expand "Vendor credits", **then** I see edit own/others, delete own/others (drafts), "Record", "Apply and refund" and "Void", granted to General Staff by default.
- **Given** a member without `vendor_credits.record`, **when** they open a draft, **then** "Record" is hidden and the API returns 403.
- **Given** a Field user, **when** they call any vendor credit route, **then** they get 403.

**Implementation notes**
- Capabilities `vendor_credits.edit_own`, `…edit_others`, `…delete_own`, `…delete_others`, `vendor_credits.record`, `vendor_credits.apply`, `vendor_credits.void` with a backfill migration matching each Team's `vendor_bills.*` grants.

### US-PUR-29 · Set up a recurring bill
**Feature:** F-PUR-10 · **Priority:** P2 · **Phase:** 8 · **Screens:** `RecurringBillDialog`, `RecurringBillsList`
**As** office staff, **I want** rent, subscriptions and retainers entered automatically, **so that** I never forget a bill.

Decision: D-159

**Acceptance criteria**
- **Given** Bills › "Recurring bills" › "New recurring bill", **when** the dialog opens, **then** it asks for "Name", "Vendor", lines, "Repeat" (weekly, monthly, quarterly, yearly) and the day, "Starts on", "Ends" (never, on a date, after n bills), "Due" (days after the bill date), "Paid from" for reference, and "When it runs": "Record the bill" or "Save as a draft for me to check".
- **Given** "Make recurring" on an existing bill, **when** I choose it, **then** the dialog opens with its vendor and lines.
- **Given** the list, **when** it loads, **then** each schedule shows name, vendor, frequency, next date, amount and status ("Active", "Paused", "Finished").

**Implementation notes**
- API: `GET/POST /recurring-bills`, `GET/PUT/DELETE /recurring-bills/:id` (`vendor_bills.manage_recurring`).
- Data: `recurring_bills`, `recurring_bill_lines` (same shape as `recurring_invoices` and its lines).

### US-PUR-30 · Create recurring bills automatically
**Feature:** F-PUR-10 · **Priority:** P2 · **Phase:** 8 · **Screens:** `RecurringBillsList`
**As** an owner, **I want** each bill created on its day exactly once, **so that** payables are complete without double entries.

**Acceptance criteria**
- **Given** an active schedule whose next date is today, **when** the 6:00 AM run happens, **then** one bill is created with today's date, the schedule's lines and due date, and "Created by Recurring bill <name>".
- **Given** "Record the bill", **when** it's created, **then** it posts P11 at once; with "Save as a draft", Owners get "Recurring bill ready to review: <name>".
- **Given** the server was down on the day, **when** it starts again, **then** missed dates are created once each, in order.
- **Given** the end condition is met, **when** the last bill is created, **then** the schedule shows "Finished".

**Implementation notes**
- Queue `recurring-bill-run` (same pattern as `recurring-invoice-run`); unique (`recurring_bill_id`, `recurring_run_on`) on `vendor_bills`.

### US-PUR-31 · Pause, edit or stop a recurring bill
**Feature:** F-PUR-10 · **Priority:** P2 · **Phase:** 8 · **Screens:** `RecurringBillsList`
**As** office staff, **I want** to change or stop a schedule, **so that** it matches the contract.

**Acceptance criteria**
- **Given** an active schedule, **when** I press "Pause", **then** no bills are created until "Resume", which sets the next date to the next future occurrence.
- **Given** I edit lines or amounts, **when** I save, **then** bills already created are unchanged.
- **Given** "Delete", **when** I confirm ("Delete this schedule? Bills it already created are kept."), **then** the schedule goes and its bills stay.

**Implementation notes**
- API: `POST /recurring-bills/:id/pause`, `/resume`.

### US-PUR-32 · See a bill at a glance, with one next step
**Feature:** F-PUR-11 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `VendorBillPage`
**As** office staff, **I want** a bill's page to say where it stands and what to do next, **so that** I don't piece it together.

Decision: D-218, D-222, D-223, D-225

**Acceptance criteria**
- **Given** a bill, **when** its page opens, **then** the breadcrumb and title are its number, its state shows in words — Draft, Unpaid, Partly paid, Paid, Overdue or Void — and under the title: the vendor (opening the contact), the bill date, the due date with how late ("12 days late", "Due in 5 days"), the job and the place of supply, dates in the business's format.
- **Given** the bill's state, **when** the page shows, **then** there's one primary action — Record bill for a draft, Pay bill while money is owed — and the rest (Edit and Delete draft, Make recurring, Duplicate, Void, View history) sit in "More" with their icons; destructive ones last.
- **Given** a recorded bill, **when** the page shows, **then** a strip reads Total, Paid, Credits applied and Balance due; a void bill's balance shows "—" with the reason it was voided.
- **Given** the Activity panel, **when** it renders, **then** it lists, newest first, created, recorded, each payment (amount, payment number) and credit applied (amount, credit number), and voided (with the reason), each with who and when.
- **Given** Record bill, Delete draft or Void, **when** I choose it, **then** it asks first (D-218) and the toast says what happened (D-223).

**Implementation notes**
- API: `GET /vendor-bills/:id/activity` → `[{ type: created|recorded|paid|credit_applied|voided, at, actorName, amount?, detail?, linkId? }]` from the audit log, `vendor_payment_allocations` and vendor credit allocations (the same access as `GET /vendor-bills/:id`).
- UI: `vendor-bill-detail.tsx` rebuilt on the payment page's layout (D-221).

### US-PUR-33 · Pay a bill from its page
**Feature:** F-PUR-11 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `VendorBillPayDialog`
**As** office staff, **I want** to pay a bill, or put the vendor's credit against it, without leaving it, **so that** paying takes one step.

Decision: D-218, D-223, D-225

**Acceptance criteria**
- **Given** a recorded bill with a balance, **when** I press "Pay bill", **then** the vendor payment dialog opens on this vendor with this bill ticked for its balance; recording the payment refreshes the page and the toast names the payment.
- **Given** the vendor has open credit, **when** the bill's page shows, **then** "Apply credit" is offered; it opens a dialog listing the vendor's credits, oldest first, filled up to the bill's balance; confirming applies them and says how much now counts against the bill.
- **Given** the bill's payments, **when** they're listed, **then** each opens that payment (`/vendor-payments?id=`), with its date in the business's format.
- **Given** a member without the right to pay or apply credit, **when** they open the bill, **then** those actions aren't offered.

**Implementation notes**
- UI: `NewVendorPaymentDialog` gains `initialBillId` (that bill ticked); a new apply dialog calls `POST /vendor-credits/:id/apply` once per credit used. No new API.

### US-PUR-34 · See what we owe vendors at a glance
**Feature:** F-PUR-11 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `VendorBillsListRefined`, `VendorBillsListDark`
**As** an owner, **I want** the bills list to show money and what's due, **so that** I know what to pay next.

Decision: D-210, D-222, D-225

**Acceptance criteria**
- **Given** the list, **when** it shows, **then** the cards read "To pay" (the balance on recorded bills, how many bills), "Overdue" (amount and count), "Due in 7 days" (amount and count) and "Drafts to record" (count and total); Overdue, Due in 7 days and Drafts filter the list when pressed, and pressing again clears.
- **Given** a bill row, **when** it shows, **then** it has the bill number, the vendor (opening the contact), the bill date, the due date with how late in words, the job, the state in words (as on the page), the total and the balance — "—" for a void bill.
- **Given** no sort chosen, **when** the list shows, **then** the newest bill comes first.
- **Given** the list layout every refined list shares, **when** it shows, **then** the filters (status, vendor, job) sit on the left of the filter bar with Updated, Refresh, Recurring bills and New vendor bill on the right, and search (bill number, vendor or job) with Columns below; filters, card, search, sort and page are kept in the address.
- **Given** a row's menu, **when** I open it, **then** it offers View, Edit and Record (draft), Pay bill (balance owed), Duplicate, Void (recorded) and Delete (draft), each with its icon and right, destructive last; Record, Void and Delete ask first.

**Implementation notes**
- UI only: the list, the cards and the state come from `GET /vendor-bills`; the job's name from the job filter's options.

### US-PUR-35 · Enter a bill faster, without entering it twice
**Feature:** F-PUR-11 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `VendorBillDuplicateWarning`
**As** office staff, **I want** help entering bills and a warning before I enter the same one again, **so that** we never pay a bill twice.

Decision: D-218, D-225

**Acceptance criteria**
- **Given** a vendor and a bill number, **when** this vendor already has a bill (not void) with the same number, ignoring case and spaces, **then** a warning names it with its date and amount and a link; I can still save.
- **Given** I choose a vendor on a new bill, **when** the due date is empty, **then** it's suggested from that vendor's last bill (the same number of days after the bill date), saying so.
- **Given** the builder, **when** I press "Save and record", **then** it asks "Record this bill?" (as Record does) and, on yes, saves the draft and records it; the bill's page opens with its toast.
- **Given** "Duplicate" on a bill, **when** I choose it, **then** a new bill opens with the same vendor, job, currency, place of supply and lines, today's date and an empty bill number.
- **Given** the new or edit bill page, **when** it opens, **then** it works like the invoice and quote builders: the header fields in one card (Vendor, Bill number, Job, Currency; Bill date, Due date with On receipt / +15 / +30 / +60, Place of supply), compact line rows (Item, Qty, Rate, Tax, Account, Amount, with the description and HSN/SAC under each) moved by drag, the row menu or Alt + ↑/↓, notes and attachments below the lines, and a bar that stays at the bottom with Subtotal, tax and Total, "Unsaved changes", Cancel, Save draft and Save and record.
- **Given** the bill's lines, **when** I add one, **then** it's an item line — a bill isn't printed, so there's no Add heading or Add text line.
- **Given** unsaved changes, **when** I leave the page, **then** "Leave without saving?" asks first, as on invoices.

**Implementation notes**
- API: `GET /vendor-bills/possible-duplicates?contactId=&billNumber=&excludeId=` → `[{ id, billNumber, date, totalAmount, currency, status }]` (the same access as `GET /vendor-bills`).
- UI: `/vendor-bills/new?from=<id>` prefills from that bill. The builder reuses the invoice builder's pieces — `QuoteLineEditor` (with an Account column in place of Disc. % and no heading or text lines), `DocumentBuilderBar`, `useUnsavedGuard` with `LeaveWithoutSavingDialog`, and the due picks from `invoices/due-terms.ts`.

### US-PUR-36 · Record several draft bills at once
**Feature:** F-PUR-11 · **Priority:** P3 · **Phase:** Refinements · **Screens:** `VendorBillsBulkRecord`
**As** office staff, **I want** to record checked drafts together, **so that** a month's bills post in one go.

Decision: D-218, D-223, D-225

**Acceptance criteria**
- **Given** draft bills ticked, **when** I choose "Record (n)", **then** "Record n bills?" asks first with their total and says they can't be edited afterwards; confirming records them, the toast says how many, and any that couldn't be recorded are named with why.
- **Given** non-draft bills among those ticked, **when** the bar shows, **then** Record counts only the drafts.
- **Given** a member without the right to record, **when** they tick bills, **then** Record isn't offered.

**Implementation notes**
- API: `POST /vendor-bills/bulk/record { ids }` (1–100) → `BulkResult` `{ done, skipped: [{ id, label, reason }] }` (`vendor_bills.record`; Idempotency-Key); each bill records in its own transaction (P11), reasons "It's already recorded.", "It's void.", "Not found." or the record's own error.

### US-PUR-37 · See where a vendor credit stands, with one next step
**Feature:** F-PUR-12 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `VendorCreditPage`
**As** office staff, **I want** a vendor credit's page to say how much is left and what to do with it, **so that** no credit sits unused.

Decision: D-218, D-222, D-223, D-226

**Acceptance criteria**
- **Given** a credit, **when** its page opens, **then** the breadcrumb and title are its number ("Draft vendor credit" before it's recorded), its state shows in words — Draft, Open, Partly used, Used or Void — and under the title: the vendor (opening the contact), their credit note number, the date, the bill it's against (opening it), the job and the place of supply, dates in the business's format.
- **Given** the credit's state, **when** the page shows, **then** there's one primary action — Record credit for a draft, Apply to bills while credit is left — with Record refund beside it while credit is left, and the rest (Edit and Delete draft, View history, Void credit) in "More" with their icons, destructive last.
- **Given** a recorded credit, **when** the page shows, **then** a strip reads Total, Applied to bills, Refunded and Left to use; a void credit's Left to use shows "—" with the reason it was voided.
- **Given** the lines, **when** they show, **then** each has its quantity, price, tax, account and HSN/SAC, with the subtotal, tax and total below.
- **Given** the credit has been applied or refunded, **when** the page shows, **then** "Applied to bills" lists each bill (opening it), its date and the amount, and "Refunds" each refund's date, method, money account, reference and amount; each can be removed or deleted, asking first.
- **Given** the Activity panel, **when** it renders, **then** it lists, newest first, created, recorded, each application (amount, bill), removal from a bill, refund, refund deleted and voided (with the reason), each with who and when.
- **Given** Record credit, Delete draft, Void, Apply, Record refund, Remove from a bill or Delete refund, **when** I choose it, **then** a major one asks first (D-218) and every one says what happened in a toast (D-223).

**Implementation notes**
- API: `GET /vendor-credits/:id/activity` → `[{ type: created|recorded|applied|unapplied|refunded|refund_deleted|voided, at, actorName, amount?, detail?, linkId? }]`, newest first, from the audit log, `vendor_credit_allocations` and `vendor_refunds` (the same access as `GET /vendor-credits/:id`); `GET /vendor-credits/:id` gains `jobName`.
- UI: `vendor-credit-detail.tsx` rebuilt on the bill page's layout (D-225). "Partly used" is worked out from the balance and the total, never stored; the API's status stays `draft|open|used|void`.

### US-PUR-38 · See what credit vendors owe us at a glance
**Feature:** F-PUR-12 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `VendorCreditsListRefined`, `VendorCreditsListDark`
**As** an owner, **I want** the credits list to show money and old unused credit, **so that** I use it or ask for a refund.

Decision: D-210, D-222, D-226

**Acceptance criteria**
- **Given** the list, **when** it shows, **then** the cards read "Credit to use" (left to use on open and partly used credits, in the business's currency, and how many), "Drafts to record" (count and total), "Partly used" (amount left and count) and "Unused 60+ days" (open credit dated 60 or more days ago, amount and count); the last three filter the list when pressed, and pressing again clears.
- **Given** a credit row, **when** it shows, **then** it has the number, the vendor's credit note number, the vendor (opening the contact), the date, the bill it's against, the job, the state in words (as on the page), the total and Left to use — "—" for a void credit.
- **Given** no sort chosen, **when** the list shows, **then** the newest credit by date comes first.
- **Given** the list layout every refined list shares, **when** it shows, **then** the title is "Vendor credits", the filters (status, vendor, job) sit on the left of the filter bar with Updated, Refresh and New vendor credit on the right, and search (number, vendor's number, vendor or bill) with Columns below; filters, card, search, sort and page are kept in the address.
- **Given** a row's menu, **when** I open it, **then** it offers View, Edit and Record (draft), Apply to bills and Record refund (credit left), Void (recorded) and Delete (draft), each with its icon and right, destructive last; Record, Void and Delete ask first.

**Implementation notes**
- API: `GET /vendor-credits` gains `billNumber` and `jobName`, and sorts by date, newest first.
- UI: the cards and the state come from the list.

### US-PUR-39 · Enter a vendor credit like a bill
**Feature:** F-PUR-12 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `VendorCreditBuilderRefined`, `VendorCreditReplaceLines`
**As** office staff, **I want** entering a credit to work like entering a bill, **so that** I don't learn two forms or enter one twice.

Decision: D-218, D-223, D-225, D-226

**Acceptance criteria**
- **Given** the new or edit credit page, **when** it opens, **then** it works like the bill builder: the header fields in one card (Vendor, Vendor's credit note number, Against bill, Currency; Date, Job, Place of supply), compact item rows (Item, Qty, Rate, Tax, Account, Amount, with the description and HSN/SAC under each, no headings or text lines), notes and attachments below the lines, and a bar that stays at the bottom with Subtotal, tax and Total credit, "Unsaved changes", Cancel, Save draft and Save and record.
- **Given** unsaved changes, **when** I leave the page, **then** "Leave without saving?" asks first.
- **Given** a vendor and a credit note number, **when** this vendor already has a credit (not void) with the same number, ignoring case and spaces, **then** a warning names it with its date and amount and a link; I can still save.
- **Given** I've entered lines, **when** I choose a bill under "Against bill", **then** it asks "Replace your lines with bill <number>'s?" before copying them; with no lines entered it copies them straight away.
- **Given** "Save and record", **when** I press it, **then** it asks "Record this vendor credit?" (as Record does) and, on yes, saves the draft and records it; the credit's page opens with its toast.

**Implementation notes**
- API: `GET /vendor-credits/possible-duplicates?contactId=&vendorReference=&excludeId=` → `[{ id, number, vendorReference, date, totalAmount, currency, status }]` (the same access as `GET /vendor-credits`).
- UI: the builder reuses the bill builder's `VendorBillLines`, `DocumentBuilderBar` and `useUnsavedGuard`.

### US-PUR-40 · Raise and use a credit from its bill
**Feature:** F-PUR-12 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `VendorBillRecordCredit`, `VendorCreditApplyRefined`
**As** office staff, **I want** to start a credit from the bill it's for and use it there first, **so that** a return comes off the right bill.

Decision: D-222, D-223, D-226

**Acceptance criteria**
- **Given** a recorded bill, **when** I open its "More" menu, **then** "Record vendor credit" opens a new credit with the vendor, the bill under "Against bill", its currency, job and place of supply, and its lines copied to edit down.
- **Given** "Apply to bills" on a credit raised against a bill, **when** the dialog opens, **then** that bill comes first, marked "Against this credit", and is filled first; the vendor's other open bills follow, oldest first.
- **Given** the apply dialog, **when** it shows, **then** each bill has its date, due date with how late and balance, and the dialog reads "Applying <amount> · <amount> left" as I change the amounts.
- **Given** I apply the credit, **when** it's done, **then** the toast says how much went to how many bills.

**Implementation notes**
- UI: `/vendor-credits/new?billId=<id>` prefills from that bill; the "Record vendor credit" item uses D-222's `issueCreditNote` icon (FileMinus). No new API.

### US-PUR-41 · Record several draft credits at once
**Feature:** F-PUR-12 · **Priority:** P3 · **Phase:** Refinements · **Screens:** `VendorCreditsBulkRecord`
**As** office staff, **I want** to record checked draft credits together, **so that** a month's credit notes post in one go.

Decision: D-218, D-223, D-226

**Acceptance criteria**
- **Given** draft credits ticked, **when** I choose "Record (n)", **then** "Record n vendor credits?" asks first with their total and says they can't be edited afterwards; confirming records them, the toast says how many, and any that couldn't be recorded are named with why.
- **Given** non-draft credits among those ticked, **when** the bar shows, **then** Record counts only the drafts.
- **Given** a member without the right to record, **when** they tick credits, **then** Record isn't offered.

**Implementation notes**
- API: `POST /vendor-credits/bulk/record { ids }` (1–100) → `BulkResult` `{ done, skipped: [{ id, label, reason }] }` (`vendor_credits.record`; Idempotency-Key); each credit records in its own transaction (P11), reasons "It's already recorded.", "It's void.", "Not found." or the record's own error.
