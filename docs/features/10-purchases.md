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
| F-PUR-13 | Expenses you can work from: a list that shows money, a page per expense with its receipt, faster entry, fixing a rejected one | P2 | Refinements | `ExpensesListRefined`, `ExpensesListDark`, `ExpensePage`, `ExpenseRejectedResubmit`, `ExpenseFormRefined` |
| F-PUR-14 | Expense categories that guide: a table with what each is used for, safe changes, and a hint and default tax rate in the expense form | P2 | Refinements | `ExpenseCategoriesRefined`, `ExpenseCategoriesDark`, `ExpenseCategoryDialogRefined`, `ExpenseCategoryNameTaken`, `ExpenseCategoryArchiveConfirm`, `ExpenseCategoryDeleteConfirm`, `ExpenseFormCategoryHint`, `ExpenseFormCategoryTax` |
| F-PUR-15 | Vendor payments you can work from: a page per payment, delete that works, a list that shows money, paying by ticking bills, remittance advice and search | P2 | Refinements | `VendorPaymentPage`, `VendorPaymentDeleteConfirm`, `VendorPaymentsListRefined`, `VendorPaymentsListDark`, `RecordVendorPaymentRefined`, `RecordVendorPaymentDuplicate`, `RemittanceEmailDialog`, `RemittanceAdvicePdf`, `SearchVendorPayments` |

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
- **Given** an approved expense, **when** I try to edit it, **then** I see "Only a waiting or rejected expense can be edited — an approved expense has already posted to the ledger.". A rejected one can be fixed and resubmitted (US-PUR-45, D-227).
- **Given** my submitted expense, **when** I delete it and confirm "Delete this expense?", **then** it's removed.

**Implementation notes**
- API: `PUT /expenses/:id` (submitted, or rejected to resubmit — US-PUR-45), `DELETE /expenses/:id` (submitted only).

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

### US-PUR-42 · See what's waiting and what it's cost at a glance
**Feature:** F-PUR-13 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `ExpensesListRefined`, `ExpensesListDark`
**As** an owner, **I want** the expenses list to show money and what's waiting on me, **so that** I approve, bill and fix expenses without hunting.

Decision: D-210, D-222, D-227

**Acceptance criteria**
- **Given** the list, **when** it shows, **then** the cards read "Waiting for approval" (amount and count — for a Staff approver, other people's only; an Owner, who may approve their own, sees all), "Approved this month" (amount and count), "Ready to bill" (approved, billable and not on an invoice yet) and "Rejected" (count); all but "Approved this month" filter the list when pressed, and pressing again clears. "Ready to bill" replaces the dashboard's banner (`?card=bill`; the old `?billable=unbilled` link still works).
- **Given** an expense row, **when** it shows, **then** it has the date in the business's format, the number once approved, the description over the category, the job, who submitted it, who paid (Company or Employee), the state in words — Waiting for approval, Approved, Billed or Rejected, never colour alone — and the amount; newest first by date.
- **Given** the list layout every refined list shares, **when** it shows, **then** the filters (state, category, submitted by — with "Me" first — and job) sit on the left of the filter bar with Updated, Refresh and Submit expense on the right, and search (number, description, category, job or person) with Columns below; filters, card, search, sort and page are kept in the address.
- **Given** a row's menu, **when** I open it, **then** it offers View, Edit (waiting or rejected, mine or with the right), Approve and Reject (waiting, not my own unless I'm an Owner), Bill to customer (ready to bill) and Delete (waiting), each with its icon and right, destructive last; Approve, Reject, Bill to customer and Delete ask first.

**Implementation notes**
- API: `GET /expenses` gains `submittedByName`, `jobName` and `billedInvoiceId`/`billedInvoiceNumber`, and sorts by date, newest first.
- UI: the cards and states come from the list; "Submitted by" options from the list's people.

### US-PUR-43 · Review an expense on its own page
**Feature:** F-PUR-13 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `ExpensePage`
**As** an approver, **I want** an expense's page to show the receipt next to what was claimed, **so that** I check it and move on in one place.

Decision: D-218, D-222, D-223, D-227

**Acceptance criteria**
- **Given** an expense, **when** I open it from the list, a link or search, **then** it opens at `/expenses/<id>` with the breadcrumb, the number (or "Expense" before approval) as the title and its state in words; under it the category, date, who submitted it, the job and who paid, dates in the business's format. Old `/expenses?id=` links open the page.
- **Given** the page, **when** it shows, **then** a strip reads Amount, Tax (with its rate), Paid from (not shown to Field) and Billable (with the invoice it's on, as a link, once billed); the description; the labour rows for a labour expense; the review comment when there is one.
- **Given** a receipt, **when** the page shows, **then** it's previewed beside the details — the photo, or the first page of a PDF — and opens full size; the receipt is listed first under Attachments, marked "Receipt", with the expense's other files.
- **Given** the Activity panel, **when** it renders, **then** it lists, newest first, submitted, edited, rejected (with the comment), resubmitted, approved (with the comment and account) and billed (with the invoice), each with who and when.
- **Given** a waiting expense and the right to review it, **when** the page shows, **then** Approve is the primary action and Reject beside it; approving asks first (with the account and an optional comment), and "Approve and next" approves and opens the next expense waiting for approval, oldest first, or says there are none left.
- **Given** an approved, billable expense not yet billed, **when** the page shows, **then** "Bill to customer" is the primary action (it asks first); the rest — Edit, View history, Delete — sit in "More" with their icons.

**Implementation notes**
- API: `GET /expenses/:id/activity` → `[{ type: submitted|edited|rejected|resubmitted|approved|billed, at, actorName, detail?, linkId? }]`, newest first, from the audit log and the billing invoice (the same access as `GET /expenses/:id`, so Field sees only their own).
- UI: `app/(app)/expenses/[id]/page.tsx` replaces the detail drawer; the dashboard, the account register and search link to it.

### US-PUR-44 · Submit an expense faster
**Feature:** F-PUR-13 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `ExpenseFormRefined`
**As** anyone who spends the business's money, **I want** submitting an expense to take seconds, **so that** receipts get in on the day.

Decision: D-218, D-227

**Acceptance criteria**
- **Given** the form, **when** it opens, **then** the currency is a picker set to the business's currency.
- **Given** a tax rate, **when** I choose it or change the amount, **then** the tax amount is worked out as included in the amount (rounded once, half-up), and I can still change it; it says "Worked out from <rate>" until I do.
- **Given** photos or PDFs, **when** I drop them on the form or choose them ("Add files", any number at once), **then** the first uploads as the receipt and shows a preview, with Replace and Remove, and the rest are listed under it and attached to the expense when it's saved; "Add files" adds more at any time. The files pane scrolls on its own, apart from the form.
- **Given** I've already submitted an expense with the same amount on the same day (not rejected), **when** I enter it again, **then** a warning names it with a link; I can still submit.
- **Given** the form, **when** I submit, **then** the button reads "Submit expense", and "Submit and add another" submits and opens a fresh form with the same date, currency, paid-by and job.

**Implementation notes**
- API: `GET /expenses/possible-duplicates?amount=&date=&excludeId=` → `[{ id, number, date, amount, currency, categoryName, status }]` — my own expenses only, not rejected.

### US-PUR-45 · Fix and resubmit a rejected expense
**Feature:** F-PUR-13 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `ExpenseRejectedResubmit`
**As** someone whose expense was rejected, **I want** to fix it and send it back, **so that** I don't enter it again from scratch.

Decision: D-227

**Acceptance criteria**
- **Given** a rejected expense of mine (or with the right to edit others'), **when** I open it, **then** the rejection comment is shown at the top and "Fix and resubmit" is the primary action.
- **Given** I change it and press "Resubmit", **when** it saves, **then** it's Waiting for approval again, the reviewer's fields are cleared, and Activity keeps the rejection with its comment and adds "Resubmitted".
- **Given** an approved expense, **when** I open it, **then** it still can't be edited.

**Implementation notes**
- API: `PUT /expenses/:id` on a rejected expense resubmits it (`expenses.edit_own`/`edit_others`, as for a waiting one): status back to `submitted`, `rejected_by_user_id`/`rejected_at`/`review_comment` cleared, audit `resubmitted`. Nothing posts.

### US-PUR-46 · See every expense category and how it's used
**Feature:** F-PUR-14 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `ExpenseCategoriesRefined`, `ExpenseCategoriesDark`
**As** an owner or office staff, **I want** to see each category with where it posts and how much it's used, **so that** I keep the list short and right.

Decision: D-210, D-222, D-228

**Acceptance criteria**
- **Given** Expenses › Categories, **when** it opens, **then** a table lists each category with its name over its "What it's for" line, the account it posts to ("6900 Other Expenses · default" when none is set), its default tax rate ("—" when none), how many expenses use it, what was approved in it this month (in the business's currency, by approval date, as on the expenses list) and its state in words — Active or Archived, never colour alone; Active first, then by name.
- **Given** a category posting to 5200 Direct Labour, **when** it shows, **then** it's tagged "Headcount × day rate".
- **Given** the list layout every refined list shares, **when** it shows, **then** the state filter (Active, Archived, All — Active by default) sits on the left of the filter bar with Updated, Refresh and "Add category" on the right, and the name search below; the filter and search are kept in the address.
- **Given** a category's expense count, **when** I press it, **then** the expenses list opens filtered to that category (`/expenses?category=<id>`).
- **Given** no categories, or none matching, **when** the table shows, **then** it says so with "Add category" or "Clear filters".
- **Given** a member who can't manage categories, **when** they open Expenses, **then** the tab stays hidden, as before (US-PUR-19).

**Implementation notes**
- API: `GET /expense-categories/usage` → `[{ categoryId, expenseCount, approvedThisMonth }]` (amount in minor units, business currency only) — roles owner, staff; Field 403. `GET /expense-categories` rows gain `description`, `defaultTaxRateId` and `defaultTaxRateName`.
- UI: `/expenses/categories` keeps the Expenses header and tabs; the table uses `DataTable` with the shared filter and search bars.

### US-PUR-47 · Add, change and remove categories safely
**Feature:** F-PUR-14 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `ExpenseCategoryDialogRefined`, `ExpenseCategoryNameTaken`, `ExpenseCategoryArchiveConfirm`, `ExpenseCategoryDeleteConfirm`
**As** an owner or office staff, **I want** changes to categories to ask first and say what happened, **so that** I don't break how expenses post by accident.

Decision: D-218, D-222, D-223, D-228

**Acceptance criteria**
- **Given** "Add category" or Edit, **when** the form opens, **then** it has Name, What it's for (optional, up to 120 characters, with a count), Posts to (expense accounts, "6900 Other Expenses · default" when left empty) and Default tax rate (active rates, or None); problems show under their field and the form stays open.
- **Given** a name another category already has — ignoring case and surrounding spaces, archived ones included — **when** I save, **then** it says "<Name> is already a category." and names whether it's archived, with Restore offered for an archived one.
- **Given** a category's account is changed, **when** the form shows, **then** it says expenses already approved stay in the old account and expenses approved from now on post to the new one.
- **Given** a row's menu, **when** I open it, **then** it offers Edit, View history, Archive (or Restore) and Delete, each with its icon and right, destructive last; Delete shows only when no expense uses the category, and otherwise the menu says "In use — archive it instead".
- **Given** Archive or Delete, **when** I choose it, **then** it asks first ("Archive Fuel & freight?" — it leaves the expense form, its expenses keep it and it can be restored; "Delete Client entertainment?" — removed for good, can't be undone) and, once done, a toast says what happened; Restore and saves toast too.

**Implementation notes**
- Data: unique index on `(org_id, lower(btrim(name)))`; migration `0116` renames existing duplicates "<name> (2)", "(3)"… (oldest keeps its name) before creating it.
- API: `POST/PUT /expense-categories` accept `description` (≤ 120) and `defaultTaxRateId` (an active rate of the business, else 400 "Choose an active tax rate."); a clashing name → 409 "<Name> is already a category." with `{ existingId, archived }`; names are trimmed.

### US-PUR-48 · Pick the right category when submitting
**Feature:** F-PUR-14 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `ExpenseFormCategoryHint`, `ExpenseFormCategoryTax`
**As** anyone who submits expenses, **I want** each category to say what it's for and fill in its usual tax, **so that** I choose right and don't look up the tax.

Decision: D-227, D-228

**Acceptance criteria**
- **Given** the expense form's category picker, **when** it opens, **then** each category shows its "What it's for" line under its name, and typing searches both.
- **Given** a category with a default tax rate, **when** I choose it on a new expense, **then** the tax rate is filled in and the tax worked out as included in the amount (US-PUR-44); I can change either, and choosing another category later doesn't overwrite a rate I chose myself.
- **Given** an expense I'm editing or fixing, **when** it opens, **then** its saved tax rate stays, whatever the category's default.
- **Given** Field, **when** they submit, **then** they see the hints and defaults, and never the category figures.

**Implementation notes**
- UI: `Combobox` options carry a description line; the form keeps `taxRateTouched` so a category's default never overwrites a person's choice.

### US-PUR-49 · See a vendor payment on its own page
**Feature:** F-PUR-15 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `VendorPaymentPage`
**As** office staff, **I want** a vendor payment to have its own page, **so that** I can see which bills it paid and other pages can link to it.

Decision: D-221, D-222, D-229

**Acceptance criteria**
- **Given** a vendor payment, **when** its page (`/vendor-payments/:id`) opens, **then** the title is its number, and under it the vendor (a link), the date in the business's format, the method, "Paid from <account>" and the reference.
- **Given** the page, **when** it shows, **then** the primary action is "Email remittance advice" (with the right to record vendor payments and an email address for the vendor), else "Download remittance advice"; More holds Download remittance advice, View history and Delete payment, each with its icon and right.
- **Given** the page, **when** it shows, **then** a strip reads Paid (the amount) and Bills paid ("RTE-3302", or "3 bills"), and "Paid to" lists each bill: the bill (a link), its total, what this payment put on it, what it still owes ("Paid" at zero) and its due date.
- **Given** the payment's Activity, **when** it shows, **then** it lists, newest first with who and when: "Recorded · ₹48,000.00 by bank transfer from HDFC Current", "Paid ₹40,000.00 on RTE-3302" (a link, one per bill) and "Remittance advice emailed to …"; attachments and notes show under Paid to.
- **Given** a bill's Payments, a bank register row, the dashboard, Activity elsewhere or an old `/vendor-payments?id=` link, **when** it names a vendor payment, **then** it opens this page.
- **Given** a Field user, **when** they could reach a vendor payment, **then** they can't (404).

**Implementation notes**
- API: `GET /vendor-payments/:id` gains `paidTo` (`[{ allocationId, billId, billNumber, billTotal, billBalance, dueDate, amount }]`) and `reconciled`; `GET /vendor-payments/:id/activity` → `[{ type: recorded|applied|remittance_emailed, at, actorName, amount?, detail?, linkId?, account? }]`, newest first, from the audit log, the allocations and the email log.
- UI: `vendor-payment-detail.tsx` replaces `vendor-payment-detail-drawer.tsx`; `?action=delete|email` opens that dialog (from the list's row menu).

### US-PUR-50 · Delete a wrong vendor payment
**Feature:** F-PUR-15 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `VendorPaymentDeleteConfirm`
**As** office staff, **I want** to delete a vendor payment recorded by mistake, **so that** the bills owe again and I can record it correctly.

Decision: D-080, D-218, D-223, D-229

**Acceptance criteria**
- **Given** a vendor payment (allocated or not) and the right to delete it, **when** I choose "Delete payment", **then** "Delete VPY-0012?" says it's removed for good, that RTE-3302 and RTE-3340 will owe ₹40,000.00 and ₹8,000.00 again, and that a reversing entry posts today; "Go back" does nothing.
- **Given** I confirm, **when** it saves, **then** P14 posts, each bill's paid amount drops and its balance returns, the list opens with "VPY-0012 deleted" in a toast, and the bills' Activity says the payment was deleted.
- **Given** a payment matched to a bank statement line, **when** I look at its page, **then** Delete is offered but the dialog says "VPY-0012 is matched to a bank statement line. Unmatch it in Banking first, then delete it." with a link to the account, and the API refuses with the same message.

**Implementation notes**
- API: `DELETE /vendor-payments/:id` no longer refuses an allocated payment: under locks on the payment and its bills it removes the allocations, lowers each bill's `amount_paid`, posts P14 and audits `deleted` on the payment and `payment_deleted` on each bill; a payment whose entry's bank lines are matched → 400 with the message above.

### US-PUR-51 · See money paid out at a glance
**Feature:** F-PUR-15 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `VendorPaymentsListRefined`, `VendorPaymentsListDark`
**As** an owner, **I want** the vendor payments list to show money and what each paid, **so that** I know what went out and find a payment fast.

Decision: D-210, D-222, D-229

**Acceptance criteria**
- **Given** the list, **when** it shows, **then** the cards read "Paid this month" (the total and how many), "Paid last month" and "To pay" (overdue bills' balance and how many; pressing it opens Vendor bills filtered to overdue), in the business's currency.
- **Given** a payment, **when** its row shows, **then** it has the number with the reference under it, the date in the business's format, the vendor, the method with the account under it, the amount and the bills paid ("RTE-3302", "RTE-3302, RTE-3340" or "3 bills"); newest first.
- **Given** the list layout every refined list shares, **when** it shows, **then** Vendor (only vendors with a payment), Method and a date range (All time — the default — This month, Last month, Last 90 days, This financial year) sit on the left of the filter bar with Updated, Refresh and "Record payment" on the right, and search (number, reference, vendor and bill numbers) with Columns below; everything is kept in the address, and Clear filters clears it.
- **Given** a row's menu, **when** I open it, **then** it offers View, Download remittance advice, Email remittance advice and Delete payment, each with its icon and right, destructive last; Email and Delete open the payment's page with that dialog, so nothing happens in one click (D-218).

**Implementation notes**
- API: `GET /vendor-payments` rows gain `moneyAccountName` and `paidTo` (`[{ billId, number }]`), newest first; `GET /vendor-payments/summary` → `{ paidThisMonth, paidThisMonthCount, paidLastMonth, toPay, toPayCount }` in the business's currency.

### US-PUR-52 · Pay a vendor by ticking bills
**Feature:** F-PUR-15 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `RecordVendorPaymentRefined`
**As** office staff, **I want** to tick the bills a payment covers, **so that** recording it takes one look at what we owe.

Decision: D-218, D-223, D-229

**Acceptance criteria**
- **Given** "Record payment" on the list, "Pay bill" on a bill or the dashboard, or a bank statement line, **when** the dialog opens, **then** it's the same dialog everywhere; from a bill, its vendor is chosen and the bill ticked for its balance.
- **Given** a vendor, **when** I choose them, **then** their recorded bills with a balance are listed oldest due first, each with its number, their bill reference, due date (or "12 days late"), balance and a tick box; "Pay all" ticks every bill; the payment's currency is the bills'.
- **Given** I tick bills, **when** I do, **then** the amount is their total and each line takes its balance; **given** I type an amount first, **then** it's spread oldest first and I can change any line (up to its balance).
- **Given** the amount and the ticked lines, **when** they don't match, **then** the line before the button says by how much ("₹2,000.00 more than the ticked bills — tick another or lower the amount") and Record stays off; when they match it reads "₹48,000.00 pays RTE-3302 in full and ₹8,000.00 of RTE-3340."
- **Given** I press "Record payment", **when** it asks "Record this payment?" with the same line and I confirm, **then** it saves and the toast reads "VPY-0012 recorded"; from the list the payment's page opens, from a bill the bill refreshes.
- **Given** the vendor has open credit, **when** the dialog shows, **then** "<Vendor> has ₹… of credit. Apply it first?" stays, as today (US-PUR-25).

**Implementation notes**
- UI: one `RecordVendorPaymentDialog` in `components/` replaces `vendor-payments/new-vendor-payment-dialog.tsx` (bank statement prefill keeps amount, date and account fixed, US-BANK-09). No new API.

### US-PUR-53 · Be warned before recording the same vendor payment twice
**Feature:** F-PUR-15 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `RecordVendorPaymentDuplicate`
**As** office staff, **I want** to be told when a vendor payment looks already recorded, **so that** we don't count the same money out twice.

Decision: D-229

**Acceptance criteria**
- **Given** a vendor, amount and date, **when** a payment to that vendor for the same amount within 3 days (or with the same reference) exists, **then** the dialog warns "This looks like VPY-0011 — ₹48,000.00 to Ridgeline Equipment Rentals on 9 Oct (Bank transfer · NEFT 4471)." with a link to open it.
- **Given** the warning, **when** I still record, **then** it records.

**Implementation notes**
- API: `GET /vendor-payments/possible-duplicates?contactId&amount&date&reference?` → `[{ id, number, date, amount, currency, method, reference }]`.

### US-PUR-54 · Send a vendor a remittance advice
**Feature:** F-PUR-15 · **Priority:** P3 · **Phase:** Refinements · **Screens:** `RemittanceEmailDialog`, `RemittanceAdvicePdf`
**As** office staff, **I want** to tell a vendor what we paid against which bills, **so that** they match our payment without calling.

Decision: D-218, D-229

**Acceptance criteria**
- **Given** a vendor payment, **when** I choose "Download remittance advice", **then** a PDF (`remittance-VPY-0012.pdf`) shows our business, the vendor, the payment's number, date, method, reference and amount, and each bill paid with their bill reference, our bill number, the bill's total and the amount paid — light, in the business's formats.
- **Given** the vendor has an email address and email is set up, **when** I choose "Email remittance advice", **then** a dialog shows To, Subject ("Remittance advice — VPY-0012 from <business>") and a message I can edit, with the PDF attached; "Send" asks nothing more (the dialog is the check), sends, toasts "Remittance advice sent to …" and adds it to Activity and the email log.
- **Given** no email address for the vendor, or email not set up, **when** the page shows, **then** Email isn't the primary action and its menu item says why ("Add an email address for <vendor>" / "Set up email sending first").

**Implementation notes**
- API: `GET /vendor-payments/:id/remittance.pdf`, `GET /vendor-payments/:id/remittance/draft` → `{ to, subject, body }`, `POST /vendor-payments/:id/remittance/send { to, subject, body }` (`vendor_payments.edit_own`/`edit_others`; Idempotency-Key). Generated when asked for, never stored or numbered (@react-pdf, like a statement); the email log records it (`entityType: vendor_payment`, kind `remittance`).

### US-PUR-55 · Find a vendor payment from search
**Feature:** F-PUR-15 · **Priority:** P3 · **Phase:** Refinements · **Screens:** `SearchVendorPayments`
**As** office staff, **I want** search to find vendor payments, **so that** "did we pay them?" is one search away.

Decision: D-229

**Acceptance criteria**
- **Given** ⌘K search, **when** I type a vendor payment's number, its reference or a vendor's name, **then** a Vendor payments group lists matches as "VPY-0012 · Ridgeline Equipment Rentals · ₹48,000.00 · 9 Oct", opening the payment's page.
- **Given** a Field user, **when** they search, **then** there's no Vendor payments group.

**Implementation notes**
- API: `GET /search` gains a `vendor_payments` group (Owner and Staff).

