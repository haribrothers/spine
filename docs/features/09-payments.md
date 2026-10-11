# 09 · Payments & receivables

Money in: record a payment against one or more invoices with an oldest-first suggestion, hold any remainder as customer credit, send a receipt, and see who owes what and for how long. Allocation limits are enforced by the database.

**Screens:** `PaymentsList` (P1), `PaymentsEmpty` (P1), `NewPaymentDialog` (P1), `RecordPaymentDialog` (P1), `PaymentDrawer` (P2), `PaymentDetailRefined` (P2), `PaymentsListRefined` (P2), `RecordPaymentRefined` (P2), `PaymentUnapplyConfirm` (P2), `PaymentDrawerCredit` (P2), `PaymentDeleteConfirm` (P2), `ReceiptPdf` (P2), `EmailReceipt` (P2), `EmailPaymentReceivedOwner` (P3), `Receivables` (P1), `ReceivablesEmpty` (P1), `InvoiceDetail` (P1), `ContactStatementDialog` (P2), `StatementPdf` (P2), `CreditNoteDialogExcess` (P1), `CustomerRefundDialog` (P1), `ReceivablesByCustomer` (P2), `ReceivablesByInvoice` (P2), `ReceivablesRemindConfirm` (P2), `ReceivablesDark` (P2)
**Depends on:** 08 Invoicing, 03 Contacts, 14 Notifications, 12 Reports (aging derives from the ledger).

## Features

| ID | Feature | Priority | Phase | Screens |
|---|---|---|---|---|
| F-PAY-01 | Record and allocate payments | P1 | 2 | `RecordPaymentDialog`, `NewPaymentDialog`, `InvoiceDetail`, `PaymentsList`, `PaymentsEmpty`, `PaymentDrawer` |
| F-PAY-02 | Customer credit and deletion | P1 | 2 | `NewPaymentDialog`, `PaymentDrawerCredit`, `PaymentDeleteConfirm` |
| F-PAY-03 | Receipts and payment notices | P2 | 2 | `ReceiptPdf`, `EmailReceipt`, `PaymentDrawer`, `EmailPaymentReceivedOwner` |
| F-PAY-04 | Receivables and AR aging | P1 | 2 | `Receivables`, `ReceivablesEmpty` |
| F-PAY-05 | Own/others and workflow rights | P1 | 4 | `PaymentDrawer`, `PaymentsList` |
| F-PAY-06 | Customer statements | P2 | 7 | `ContactStatementDialog`, `StatementPdf` |
| F-PAY-07 | Refunds and credit from credit notes | P1 | 8 | `CreditNoteDialogExcess`, `CustomerRefundDialog`, `TeamPrivilegesBooks` |
| F-PAY-08 | Payments you can work from: a page per payment, a list that shows where the money went, search | P2 | Refinements | `PaymentDetailRefined`, `PaymentDetailCredit`, `PaymentsListRefined`, `PaymentsListRefinedDark`, `SearchPayments` |
| F-PAY-09 | Recording a payment by ticking what it pays, with a duplicate warning | P2 | Refinements | `RecordPaymentRefined`, `RecordPaymentDuplicate` |
| F-PAY-10 | Moving a payment off the wrong invoice | P2 | Refinements | `PaymentUnapplyConfirm` |
| F-PAY-11 | Receivables you can chase from: customer by customer, by age, acting from the row | P2 | Refinements | `ReceivablesByCustomer`, `ReceivablesByInvoice`, `ReceivablesRemindConfirm`, `ReceivablesDark` |

## User stories

### US-PAY-01 · Record a payment against an invoice
**Feature:** F-PAY-01 · **Priority:** P1 · **Phase:** 2 · **Screens:** `RecordPaymentDialog`, `InvoiceDetail`
**As** office staff, **I want** to record a payment from an invoice, **so that** its balance updates.

Legacy: S-06.1

**Acceptance criteria**
- **Given** an issued invoice with a balance, **when** I press "Record payment", **then** "Record a payment" opens with "Date", "Method" (Cash, Bank transfer, Cheque, Card, UPI, Other; default Bank transfer), "Reference" (helper "Cheque number, transaction ID, etc."), "Amount" and an allocation to this invoice.
- **Given** an amount of zero, **when** I confirm, **then** I see "Enter a payment amount greater than zero.".
- **Given** a valid payment, **when** I press "Record payment", **then** the invoice's balance drops, the payment gets a receipt number, and the invoice lists it under "Payments".
- **Given** it's recorded, **when** I check its journal entry (Reports › account drill-down), **then** Bank is debited and AR credited for the allocated amount.

**Implementation notes**
- API: `POST /payments` (`payments.edit_own`); posting P4.
- Data: `payments`, `payment_allocations` (DB trigger I4).

### US-PAY-02 · Split one payment across several invoices
**Feature:** F-PAY-01 · **Priority:** P1 · **Phase:** 2 · **Screens:** `NewPaymentDialog`
**As** office staff, **I want** to spread a lump sum over several invoices with an oldest-first suggestion, **so that** a settlement is recorded correctly and I usually just confirm.

Legacy: S-06.2, S-06.3

**Acceptance criteria**
- **Given** Payments, **when** I press "Record payment" and choose a contact and amount, **then** the allocation is pre-filled oldest invoice first until the amount runs out.
- **Given** the allocation, **when** I change an amount or add an invoice with "Allocate to an invoice…", **then** totals update live.
- **Given** allocations exceed the payment, **when** I confirm, **then** I see "Total allocated cannot exceed the payment amount.".
- **Given** the contact has no open invoices, **when** I open the allocation, **then** I see "This contact has no outstanding issued invoices.".
- **Given** I record it, **when** it succeeds, **then** I see "Payment recorded" / "The payment has been saved and posted to the ledger.".

**Implementation notes**
- API: `GET /payments/suggest-allocation?contactId=&amount=`, `POST /payments`.

### US-PAY-03 · Record a part-payment and see what's left
**Feature:** F-PAY-01 · **Priority:** P1 · **Phase:** 2 · **Screens:** `InvoiceDetail`
**As** office staff, **I want** part-payments to reduce the balance correctly, **so that** instalments don't break anything.

Legacy: S-06.5

**Acceptance criteria**
- **Given** a 2,185.00 invoice, **when** I record 1,000.00 against it, **then** it shows Balance due 1,185.00 and stays open.
- **Given** a later payment of 1,185.00, **when** it's recorded, **then** the balance is 0.00 and the invoice reads as paid.
- **Given** an allocation larger than the remaining balance, **when** it's submitted, **then** the database rejects it.

**Implementation notes**
- "Paid" is computed from allocations, not a stored status.

### US-PAY-04 · Find payments and open one
**Feature:** F-PAY-01 · **Priority:** P1 · **Phase:** 2 · **Screens:** `PaymentsList`, `PaymentsEmpty`, `PaymentDrawer`
**As** office staff, **I want** a list of payments with their allocation, **so that** I can answer "did they pay?" fast.

**Acceptance criteria**
- **Given** payments exist, **when** I open Payments, **then** I see "Total payments" and "Unallocated credit" and a table of number, date, contact, method, amount and unallocated ("Fully allocated" when zero).
- **Given** I click a receipt number, **when** the drawer opens, **then** it shows Date, Method, Reference, Amount, Allocated, Unallocated, "Allocated to" invoices and notes.
- **Given** a contact filter with no matches, **when** it applies, **then** I see "No payments for this contact" / "Try clearing the contact filter.".
- **Given** none exist, **when** I open Payments, **then** I see "No payments recorded yet" and "Record a payment against one or more invoices, or hold it as unallocated customer credit.".

**Implementation notes**
- API: `GET /payments`, `GET /payments/:id`.
- Refined by US-PAY-19 and US-PAY-21 (D-221): the drawer gives way to the payment's page, and the list's cards and rows change.

### US-PAY-05 · Hold a payment as customer credit
**Feature:** F-PAY-02 · **Priority:** P1 · **Phase:** 2 · **Screens:** `NewPaymentDialog`, `PaymentDrawerCredit`
**As** office staff, **I want** to record money received before there's an invoice, **so that** deposits and overpayments are captured.

Legacy: S-06.4

**Acceptance criteria**
- **Given** I record a payment and leave part or all unallocated, **when** it saves, **then** the unallocated part shows in "Unallocated credit" and in the payment's "Unallocated".
- **Given** it's recorded, **when** I check its journal entries (Reports › account drill-down), **then** the unallocated part is credited to Customer Advances.
- **Given** a payment with credit, **when** I open its drawer, **then** "Apply credit" is offered (US-INV-08).

**Implementation notes**
- Posting P5.

### US-PAY-06 · Delete a payment recorded by mistake
**Feature:** F-PAY-02 · **Priority:** P2 · **Phase:** 2 · **Screens:** `PaymentDeleteConfirm`
**As** office staff, **I want** to delete a wrong payment before it's applied, **so that** the books stay right.

**Acceptance criteria**
- **Given** a payment with nothing allocated, **when** I press "Delete payment", **then** "Delete this payment?" asks me to confirm.
- **Given** I confirm, **when** it succeeds, **then** a reversing entry is posted and a "Payment deleted" toast shows.
- **Given** a payment with allocations, **when** I look for delete, **then** it isn't offered and the API refuses; a customer payment that was allocated or receipted is never deleted ([D-080](../prd/12-decisions.md)).

**Implementation notes**
- API: `DELETE /payments/:id` (`payments.delete_own`/`delete_others`); posting P7.

### US-PAY-07 · Give the customer a receipt
**Feature:** F-PAY-03 · **Priority:** P2 · **Phase:** 2 · **Screens:** `ReceiptPdf`, `EmailReceipt`, `PaymentDrawer`
**As** office staff, **I want** a receipt PDF and email, **so that** the customer has proof of payment.

Legacy: S-06.6

**Acceptance criteria**
- **Given** a payment, **when** I press "Download PDF", **then** a receipt shows the business details, "RECEIPT", number, received from, date, method, applied-to invoices and "Amount received".
- **Given** I press "Email receipt", **when** it sends, **then** I see "Receipt sent" and the customer gets "<Business> received your payment (<receipt number>)".
- **Given** a payment is recorded with the contact's email set, **when** it saves, **then** the receipt email is sent automatically once.
- **Given** sending fails, **when** the error returns, **then** I see "Could not email this receipt.".

**Implementation notes**
- API: `GET /payments/:id/pdf`, `POST /payments/:id/send-receipt` (`payments.send_receipt`).

### US-PAY-08 · Tell the office when a payment arrives
**Feature:** F-PAY-03 · **Priority:** P3 · **Phase:** 2 · **Screens:** `EmailPaymentReceivedOwner`
**As** an owner, **I want** a notice when a payment is recorded, **so that** I know cash came in.

**Acceptance criteria**
- **Given** a payment is recorded, **when** it saves, **then** Owners get an email with subject "Payment received from <contact>" and body "<contact> paid <amount> (<receipt number>).", and an in-app notification "<contact> paid <amount>.".
- **Given** the notification, **when** I click it, **then** I open the payment.
- **Given** a payment is deleted, **when** it's reversed, **then** no "received" notice is sent again.

**Implementation notes**
- Notification type `payment_received`.

### US-PAY-09 · See who owes what and for how long
**Feature:** F-PAY-04 · **Priority:** P1 · **Phase:** 2 · **Screens:** `Receivables`, `ReceivablesEmpty`
**As** an owner, **I want** receivables grouped by age, **so that** I know who to chase.

Legacy: S-06.7, S-09.5 (AR half)

**Acceptance criteria**
- **Given** open invoices, **when** I open Receivables, **then** I see buckets Current, 1–30 days, 31–60 days, 61–90 days and 90+ days with totals, "Total outstanding", and a table of number, contact, due date, aging and balance.
- **Given** a bucket, **when** I click it, **then** the table filters to that bucket (built by US-PAY-29).
- **Given** held retention, **when** the report renders, **then** it's excluded from the buckets.
- **Given** nothing is owed, **when** I open the page, **then** I see "Nothing outstanding" / "Every issued invoice has been paid in full.".
- **Given** a Staff user without `reports.view_receivables`, **when** they open the page, **then** they see the no-access page.

**Implementation notes**
- API: `GET /reports/receivables` (from `journal_lines` on AR with `contact_id`).

### US-PAY-10 · Export receivables to CSV
**Feature:** F-PAY-04 · **Priority:** P2 · **Phase:** 6 · **Screens:** `Receivables`
**As** an owner, **I want** to download receivables as CSV, **so that** my accountant can work with them.

**Acceptance criteria**
- **Given** Receivables, **when** I choose "Export CSV", **then** a CSV downloads with one row per open invoice and its bucket.
- **Given** the CSV, **when** it opens, **then** amounts are plain decimals with the currency in its own column.
- **Given** a filter is applied, **when** I export, **then** the file matches what's on screen.

**Implementation notes**
- API: `GET /reports/receivables/export.csv` (built). The page button isn't, so this story moved to Phase 6.

### US-PAY-11 · Let a Team delete only payments it recorded
**Feature:** F-PAY-05 · **Priority:** P1 · **Phase:** 4 · **Screens:** `PaymentDrawer`
**As** an owner, **I want** deleting someone else's payment to need a deliberate grant, **so that** mistakes are contained.

Legacy: S-06.8

**Acceptance criteria**
- **Given** a member with `payments.delete_own` only, **when** they open a colleague's unallocated payment, **then** "Delete payment" is hidden and the API returns 403.
- **Given** a member without `payments.edit_own`, **when** they open Payments, **then** "Record payment" is hidden.
- **Given** `payments.edit_others`, **when** the matrix shows it, **then** it's marked reserved (no update route exists).

**Implementation notes**
- API: ownership check on `payments.created_by_user_id`.

### US-PAY-12 · Grant applying credit and sending receipts separately
**Feature:** F-PAY-05 · **Priority:** P1 · **Phase:** 4 · **Screens:** `PaymentsList`, `PaymentDrawer`
**As** an owner, **I want** applying credit and re-sending receipts as their own rights, **so that** I can tune who touches customer balances.

**Acceptance criteria**
- **Given** a member without `payments.apply_credit`, **when** they open a payment with credit, **then** "Apply credit" is hidden and the API returns 403.
- **Given** a member without `payments.send_receipt`, **when** they open a payment, **then** "Email receipt" is hidden.
- **Given** a member with both, **when** they act on a colleague's payment, **then** both actions work.

**Implementation notes**
- API: `@RequireCapability("payments.apply_credit")`, `("payments.send_receipt")`.

### US-PAY-13 · Allocate a deposit payment to its advance invoice
**Feature:** F-PAY-02 · **Priority:** P1 · **Phase:** 6 · **Screens:** `RecordPaymentDialog`, `NewPaymentDialog`, `PaymentDrawerCredit`
**As** office staff, **I want** to record a deposit against the advance invoice that requested it, **so that** the deposit request shows as paid and the money is still held as an advance.

Decision: D-075 · Review finding: Stage 5 #18

**Acceptance criteria**
- **Given** an issued advance invoice for 5,000.00, **when** I record a payment of 5,000.00 allocated to it, **then** it's accepted and the advance invoice shows "Paid".
- **Given** that payment, **when** its journal entry is checked, **then** it debits Bank 5,000.00 and credits 2200 Customer Advances 5,000.00, with no Accounts Receivable line.
- **Given** a part-payment of 2,000.00 on that advance invoice, **when** it's recorded, **then** the advance invoice shows "Partially paid" with 3,000.00 outstanding.
- **Given** a deposit paid this way, **when** I open the customer's credit, **then** 5,000.00 is available to apply to a later invoice (US-INV-08).
- **Given** the deposit is applied to the final invoice, **when** it posts, **then** it debits 2200 and credits AR (P6).
- **Given** the deposit invoice and the final invoice, **when** tax is computed, **then** the deposit carries no tax and the final invoice's lines carry the full tax.
- **Given** the oldest-first suggestion in "Record a payment", **when** the customer has an open advance invoice, **then** it's offered like any other open invoice.

**Implementation notes**
- API: `POST /payments` accepts allocations to `type = advance` invoices; `PaymentsService.create` posts allocated-to-advance amounts to `customerAdvances` instead of AR.
- Data: `payment_allocations` unchanged; the advance invoice's balance comes from its allocations.
- Ledger: new posting variant of P5 (06-ledger-posting-rules); flag for the accountant review (Q-02).

### US-PAY-14 · Send a customer a statement
**Feature:** F-PAY-06 · **Priority:** P2 · **Phase:** 7 · **Screens:** `ContactStatementDialog`
**As** office staff, **I want** to send a customer a statement of everything they owe, **so that** they can reconcile and pay in one go.

**Acceptance criteria**
- **Given** a customer's contact page, **when** I press "Send statement", **then** "Send a statement" opens with "Period" (Last 30 days, Last 90 days, This year, Custom), "Show" ("Open invoices only" or "All activity"), a summary, "To" and "Message".
- **Given** the summary, **when** it renders, **then** it shows "Opening balance (<date>)", "Invoiced", "Paid and credited" and "Balance due" for the period.
- **Given** I press "Send statement", **when** it succeeds, **then** the statement PDF is emailed to "To", a toast reads "Statement sent to <email>" and the contact's timeline records it.
- **Given** I press "Download PDF", **when** it finishes, **then** the same PDF downloads without emailing.
- **Given** a contact with no invoices, **when** I open the dialog, **then** "Send statement" is disabled with "No invoices for this customer yet.".
- **Given** I lack `reports.view_receivables`, **when** I open the contact, **then** "Send statement" isn't shown.

**Implementation notes**
- API: `GET /contacts/:id/statement?from=&to=&mode=open|all` (JSON summary), `GET /contacts/:id/statement.pdf`, `POST /contacts/:id/statement/send` (contract additions, `reports.view_receivables`, send is idempotent).
- Data: derived from `journal_lines` filtered by `contact_id` (D-011) plus invoice references; nothing stored except the email log.

### US-PAY-15 · Give customers a clear statement PDF
**Feature:** F-PAY-06 · **Priority:** P2 · **Phase:** 7 · **Screens:** `StatementPdf`
**As** a customer, **I want** a statement that shows each charge and payment with a running balance, **so that** I can match it to my records.

**Acceptance criteria**
- **Given** the PDF, **when** it renders, **then** the header shows the business, "STATEMENT", the period, "Statement for <customer>" with address, and "Balance due".
- **Given** the table, **when** it renders, **then** it has "Date", "Reference", "Type", "Charges", "Payments" and "Balance", starting with "Opening balance".
- **Given** the aging strip, **when** it renders, **then** it shows "Current", "1–30 days", "31–60 days", "61–90 days" and "90+ days" for what's still owed.
- **Given** payment instructions are set (US-INV-16), **when** the PDF renders, **then** a "How to pay" block appears at the bottom.
- **Given** "Open invoices only", **when** it renders, **then** paid invoices and their payments are left out and the opening balance is omitted.

**Implementation notes**
- PDF: `@react-pdf` template `StatementPdf`, same fonts and colours as invoices.

### US-PAY-16 · Keep a credit note's extra as customer credit
**Feature:** F-PAY-07 · **Priority:** P1 · **Phase:** 8 · **Screens:** `CreditNoteDialogExcess`
**As** office staff, **I want** to credit a paid invoice, **so that** a customer who paid for something we didn't deliver gets their money back or keeps it as credit.

Decision: D-142

**Acceptance criteria**
- **Given** a credit note for more than the invoice's balance (including a fully paid invoice), **when** the dialog totals it, **then** it reads "<balance> reduces what's owed on <invoice>; <excess> becomes credit for <customer>.".
- **Given** I issue it, **when** it posts, **then** P8 credits AR up to the balance and Customer Advances for the excess.
- **Given** the customer's credit, **when** I open "Apply credit" on another invoice, **then** credit from credit notes is offered alongside unallocated payments.
- **Given** the customer's statement, **when** it renders, **then** the credit shows as a credit line.

**Implementation notes**
- API: `POST /credit-notes` no longer refuses totals above the balance; responses gain `creditRemainingAmount`. New `POST /credit-notes/:id/apply-credit { allocations: [{ invoiceId, amount }] }` (`payments.apply_credit`) applies a credit note's remaining credit, posting P6 like `POST /payments/:id/apply-credit`.
- Data: `credit_notes.credit_remaining_amount bigint`.

### US-PAY-17 · Refund a customer
**Feature:** F-PAY-07 · **Priority:** P1 · **Phase:** 8 · **Screens:** `CustomerRefundDialog`
**As** office staff, **I want** to pay back a customer's credit or overpayment, **so that** their account is settled and the bank shows the money out.

**Acceptance criteria**
- **Given** a customer with credit (an unallocated payment or a credit note's excess), **when** I choose "Refund" on the payment, the credit note or the contact, **then** I enter "Amount" (up to the credit), "Date", "Paid from", "Method" and "Reference".
- **Given** I save, **when** it posts, **then** P23 debits Customer Advances and credits the money account, the credit drops, and the toast reads "Refunded <amount> to <customer>".
- **Given** "Send refund confirmation", **when** I tick it, **then** the customer gets a receipt-style email "We've refunded <amount>".
- **Given** a refund that isn't reconciled, **when** I delete it, **then** a reversing entry posts and the credit comes back.
- **Given** the customer's statement, **when** it renders, **then** the refund appears as a debit line.

**Implementation notes**
- API: `POST /customer-refunds`, `GET /customer-refunds?contactId=`, `DELETE /customer-refunds/:id` (`payments.refund`).
- Data: `customer_refunds` (new; source `payment_id` or `credit_note_id`, money account, amount, method, reference, entry_id); trigger keeps refunds ≤ the source's remaining credit.

### US-PAY-18 · Let a Team refund customers
**Feature:** F-PAY-07 · **Priority:** P2 · **Phase:** 8 · **Screens:** `TeamPrivilegesBooks`
**As** an owner, **I want** refunds as their own right, **so that** only trusted people send money back.

**Acceptance criteria**
- **Given** a Team's "Payments" group, **when** I expand it, **then** it lists "Refund customers" (`payments.refund`), off for General Staff by default.
- **Given** a member without it, **when** they open a payment with credit, **then** "Refund" is hidden and the API returns 403.

**Implementation notes**
- Capability `payments.refund` (General Staff default ✗) with migration.

### US-PAY-19 · See a payment at a glance, with one next step
**Feature:** F-PAY-08 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `PaymentDetailRefined`, `PaymentDetailCredit`
**As** office staff, **I want** a payment to have its own page, **so that** I can see what it paid and act on it, and other pages can link to it.

Decision: D-221

**Acceptance criteria**
- **Given** a payment, **when** its page (`/payments/:id`) opens, **then** the title is its receipt number with its state — "Fully applied" (green), "Credit left" (amber) or "Refunded" (all its credit paid back) — and under it the customer (a link), the date, the method, "Paid into <account>" and the reference.
- **Given** the page, **when** it shows, **then** one primary button offers the next step: "Apply credit" while credit is left (with the right to apply credit), else "Email receipt" (with the right to send receipts), else "Download PDF"; Refund (while credit is left), Email receipt, Download PDF, Delete payment (only when nothing is applied or refunded, with the right) and View history sit beside it or under More.
- **Given** the page, **when** it shows, **then** a strip reads Received, Applied (to INV-0041, or "To 3 invoices"), Refunded (when any) and Credit left.
- **Given** "Applied to", **when** it shows, **then** each invoice is a row: the invoice (a link), its total, what this payment put on it, what it still owes ("Paid" at zero) and when it was applied.
- **Given** refunds, attachments and notes, **when** the payment has them, **then** they show under "Applied to".
- **Given** the "Payment received" notification, a ledger drill-down, a bank register row, an invoice's Payments and Activity, the email log or an old `/payments?id=` link, **when** it names a payment, **then** it opens this page.
- **Given** a Field user, **when** they could reach a payment, **then** they can't (404).

**Implementation notes**
- UI: `payment-detail.tsx` replaces `payment-detail-drawer.tsx`; `?action=apply|refund|email|delete` opens that dialog (from the list's row menu). `/payments?id=<id>` redirects to `/payments/<id>`.
- API: `GET /payments/:id` gains `refundedAmount`, `moneyAccount` and `appliedTo` (`[{ allocationId, invoiceId, invoiceNumber, invoiceTotal, invoiceBalance, invoiceType, amount, at }]`).

### US-PAY-20 · Follow what happened to a payment
**Feature:** F-PAY-08 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `PaymentDetailRefined`
**As** an owner, **I want** a payment's story in one place, **so that** I know where the money went and whether the customer got a receipt.

Decision: D-221

**Acceptance criteria**
- **Given** a payment, **when** its Activity shows, **then** it lists, newest first with who and when: "Recorded · ₹50,000.00 by UPI into HDFC Current", "Applied ₹30,000.00 to INV-0041" (a link; one per invoice, as recorded or applied later), "Receipt emailed to …", "Moved ₹12,000.00 off INV-0039 · <reason>", "Refunded ₹5,900.00 · Bank transfer" and "Refund deleted".
- **Given** more than six entries, **when** the panel shows, **then** "Show N earlier" reveals the rest; "View history" keeps the field-level changes.

**Implementation notes**
- API: `GET /payments/:id/activity` → `PaymentActivityEntry[]` `{ type: recorded|applied|unapplied|emailed|refunded|refund_deleted, at, actorName, amount?, detail?, linkId?, account?, reason? }`, from the audit log, the allocations, refunds and the email log (receipts sent). An allocation moved off (US-PAY-26) keeps its "Applied" line: the `unapplied` audit entry records when it was applied.

### US-PAY-21 · See money received at a glance
**Feature:** F-PAY-08 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `PaymentsListRefined`
**As** office staff, **I want** the payments list to show money and where it went, **so that** I know what came in and what's still to apply.

Decision: D-221

**Acceptance criteria**
- **Given** the list, **when** it shows, **then** the cards read "Received this month" (the total and how many, "Received since 1 Oct"), "Credit to use" (credit left on payments and for how many customers; pressing it filters the list) and "Refunded this month" (refunds of payment credit).
- **Given** a payment, **when** its row shows, **then** it has the receipt number with the reference under it, the date in the business's format, the customer, the method with the account under it, the amount, "Applied to" ("INV-0041", "INV-0041, INV-0042", "3 invoices" or "Not applied") and the credit left (amber) or "—".
- **Given** no sort chosen, **when** the list shows, **then** the newest payment is first.
- **Given** a row's menu, **when** I open it, **then** it offers View, Apply credit and Refund (while credit is left), Email receipt, Download PDF and Delete payment (nothing applied or refunded) — each only with the right to do it; Apply, Refund, Email and Delete open the payment's page with that dialog, so nothing happens in one click (D-218).

**Implementation notes**
- API: `GET /payments` rows gain `refundedAmount`, `moneyAccountName` and `appliedTo` (`[{ invoiceId, number }]`), newest first.

### US-PAY-22 · Search, filter and come back to the same payments list
**Feature:** F-PAY-08 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `PaymentsListRefined`, `PaymentsListRefinedDark`
**As** office staff, **I want** the list to keep my search and filters, **so that** I can open a payment and come back to the same list.

Decision: D-210, D-221

**Acceptance criteria**
- **Given** the toolbar, **when** it shows, **then** it has Contact (only contacts with a payment), Method and a date range (All time — the default — This month, Last month, Last 90 days, This financial year), "Updated … ago", Refresh and "Record payment", with search on its own row beside Columns.
- **Given** a search, filter, card, sort or page, **when** I set it, **then** the address keeps it (for example `/payments?method=upi&range=this_month&q=halcyon`), so Back and bookmarks return to the same list; "Clear filters" clears them; Refresh reloads in place, and coming back after 30 seconds away refreshes quietly.
- **Given** a search, **when** I type, **then** it matches the receipt number, the reference, the customer and the invoices it was applied to.

**Implementation notes**
- UI: `payments-list-state.ts` (parse/query/filter, as `credit-notes-list-state.ts`).

### US-PAY-23 · Record a payment by ticking what it pays
**Feature:** F-PAY-09 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `RecordPaymentRefined`
**As** office staff, **I want** to tick the invoices a payment covers, **so that** recording it takes one look at what the customer owes.

Decision: D-218, D-221

**Acceptance criteria**
- **Given** "Record payment" on the payments list, an invoice or a bank statement line, **when** the dialog opens, **then** it's the same dialog everywhere; from an invoice, its customer is chosen and the invoice is ticked with its balance.
- **Given** a customer, **when** I choose them, **then** their open invoices are listed oldest due first, each with its number, due date (or "12 days late"), balance and a tick box; a deposit (advance) invoice says "Deposit".
- **Given** I tick invoices before typing an amount, **when** I tick, **then** the amount is their total and each line takes its balance; "Pay all" ticks every invoice.
- **Given** I type an amount first, **when** I do, **then** it's spread oldest first over the invoices, ticking them, and I can change any line (up to its balance).
- **Given** the amount is more than the ticked lines, **when** the dialog totals it, **then** it reads "<applied> goes on <n> invoices; <rest> becomes credit for <customer>." before the button; the payment's currency is the customer's.
- **Given** the customer has an email address and email is set up, **when** the dialog shows, **then** "Email a receipt to <address>" is on; turned off, nothing is sent.
- **Given** I press "Record payment", **when** it saves, **then** the toast reads "RCP-0029 recorded" and the payment's page (from the list) or the invoice (from an invoice) shows it; the totals shown before the button are the confirmation (D-218).
- **Given** a bank statement line (US-BANK-09), **when** the dialog opens from it, **then** the amount, date and account stay fixed as today.

**Implementation notes**
- UI: one `RecordPaymentDialog` in `components/` replaces `payments/new-payment-dialog.tsx` and `invoices/record-payment-dialog.tsx`. The receipt switch shows only when the customer has an email address; if email isn't set up the receipt isn't sent (D-015) and the email log says so (US-SET-27).
- API: `POST /payments` gains `sendReceipt?: boolean` (omitted: sent when the customer has an email, as before).

### US-PAY-24 · Be warned before recording the same payment twice
**Feature:** F-PAY-09 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `RecordPaymentDuplicate`
**As** office staff, **I want** to be told when a payment looks already recorded, **so that** the same money isn't counted twice.

Decision: D-221

**Acceptance criteria**
- **Given** a customer, amount and date, **when** a payment from that customer for the same amount within 3 days (or with the same reference) exists, **then** the dialog warns "This looks like RCP-0028 — ₹45,000.00 from Halcyon Tech Parks on 9 Oct (UPI · 4471)." with a link to open it.
- **Given** the warning, **when** I still press "Record payment", **then** it records (two real payments of the same amount happen).

**Implementation notes**
- API: `GET /payments/possible-duplicates?contactId&amount&date&reference` → `[{ id, number, date, amount, currency, method, reference }]`.

### US-PAY-25 · Find a payment from search
**Feature:** F-PAY-08 · **Priority:** P3 · **Phase:** Refinements · **Screens:** `SearchPayments`
**As** office staff, **I want** search to find payments, **so that** "did they pay?" is one search away.

Decision: D-221

**Acceptance criteria**
- **Given** ⌘K search, **when** I type a receipt number, a reference or a customer's name, **then** a Payments group lists matches as "RCP-0028 · Halcyon Tech Parks · ₹45,000.00 · 9 Oct", opening the payment's page.
- **Given** a Field user, **when** they search, **then** there's no Payments group.

**Implementation notes**
- API: `GET /search` gains a `payments` group (Owner and Staff).

### US-PAY-26 · Move a payment off the wrong invoice
**Feature:** F-PAY-10 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `PaymentUnapplyConfirm`
**As** office staff, **I want** to take money off an invoice it was put on by mistake, **so that** I can apply it to the right one without deleting the payment.

Decision: D-080, D-218, D-221

**Acceptance criteria**
- **Given** a payment applied to an invoice, **when** I choose "Move off INV-0039" on its "Applied to" row (or "Move off this invoice" on the invoice's Payments row), **then** "Move ₹12,000.00 off INV-0039?" says INV-0039 will owe it again and the money becomes credit for <customer> to apply or refund, with an optional reason; "Go back" does nothing.
- **Given** I confirm, **when** it saves, **then** P30 posts (dated today), the invoice's paid amount drops and its balance rises, the payment's credit left rises by the same amount, the toast reads "₹12,000.00 is now credit for <customer>", and "Apply credit" is offered.
- **Given** an allocation to a deposit (advance) invoice or a void invoice, **when** I look for "Move off", **then** it isn't offered and the API refuses with what to do instead. A reconciled payment can be moved off: the money in the bank doesn't change.
- **Given** a payment moved off an invoice, **when** its receipt PDF renders, **then** it lists only what's still applied; the receipt already emailed isn't changed.
- **Given** a member without "Apply credit", **when** they open the payment, **then** "Move off" is hidden and the API returns 403.

**Implementation notes**
- API: `POST /payments/:id/allocations/:allocationId/unapply { reason? }` (`payments.apply_credit`; Idempotency-Key) → the payment. Under locks on the payment and the invoice: the allocation row is removed, `payments.allocated_amount` and `invoices.amount_paid` drop, P30 posts (`payment_unapply`); audited `unapplied` on the payment and the invoice with the amount and reason.

### US-PAY-27 · See who owes me most, customer by customer
**Feature:** F-PAY-11 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `ReceivablesByCustomer`, `ReceivablesDark`
**As** an owner, **I want** Receivables to add up what each customer owes, **so that** I know who to call first.

Decision: D-224

**Acceptance criteria**
- **Given** open invoices, **when** I open Receivables, **then** tabs "By customer" and "By invoice" sit under the header (as Catalogue's Items and Bundles) and "By customer" is open; below them, as on every list, come the cards, the age bar, the filter bar (the age on the left; "Updated", Refresh and Export on the right) and the search bar (search on the left, Columns on the right). The tab is kept in the address; the dashboard's links still open the page.
- **Given** "By customer", **when** it shows, **then** each customer who owes has one row: the customer (opening the contact), how many open invoices ("3 invoices"), the oldest ("45 days late", or "Not due yet"), the overdue amount, the total owed, credit to use (unapplied payments and credit notes; "—" when none) and when they were last sent a reminder ("3 Oct", or "Never").
- **Given** no sort chosen, **when** the list shows, **then** the most overdue money comes first, then the most owed; a totals row adds up overdue, owed and credit.
- **Given** a customer row, **when** I expand it, **then** their open invoices show under it, oldest due first — number, due date, how late, balance — each opening the invoice.
- **Given** search, **when** I type, **then** "By customer" matches the customer's name and "By invoice" the number or customer.
- **Given** Export, **when** I use it on either tab, **then** it downloads the invoices on screen, one row each (US-PAY-10).

**Implementation notes**
- API: `GET /reports/receivables` gains `customers` — `[{ contactId, name, email, invoiceCount, overdueAmount, totalOutstanding, oldestDaysOverdue, credit, lastReminderOn }]`, credit from unallocated payments (`amount − allocated − refunded`) and issued credit notes' `creditRemaining` for that customer. Same totals as the buckets (retention excluded).
- `@spine/ui` `Table`/`DataTable` gain `renderExpanded(row)` — a chevron button (`aria-expanded`) in the first cell and a full-width row under it; its doc page and a11y test change with it.

### US-PAY-28 · Chase a customer without leaving Receivables
**Feature:** F-PAY-11 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `ReceivablesByInvoice`, `ReceivablesRemindConfirm`
**As** office staff, **I want** to remind, record a payment or send a statement from Receivables, **so that** chasing doesn't mean hunting for each invoice.

Decision: D-218, D-223, D-224

**Acceptance criteria**
- **Given** an invoice row's menu, **when** I open it, **then** it offers Record payment (the "Record a payment" dialog for that customer with this invoice ticked), Apply credit (while the customer has credit), Send reminder (the reminder dialog, which asks first), Download PDF and Open invoice — each only with the right to do it; Send reminder says why when it can't be sent ("Already reminded today.", "The customer has no email address.").
- **Given** a customer row's menu, **when** I open it, **then** it offers Send statement (the statement dialog), Record payment (the dialog with the customer chosen) and Open contact, each only with the right to do it.
- **Given** invoices ticked on "By invoice", **when** I choose "Send reminders (n)", **then** "Send n payment reminders?" asks first and names the ones skipped and why; confirming sends them, the toast reads "n reminders sent" and the selection clears.
- **Given** any of these finishes, **when** it does, **then** the page refreshes in place, the toast says what happened (D-223) and a failure shows above the list.

**Implementation notes**
- Reuses `RecordPaymentDialog`, `ApplyCustomerCreditDialog`, the invoice's reminder dialog (`POST /invoices/:id/send-reminder`), `StatementDialog` and `POST /invoices/bulk/send-reminders` (US-INV-23). Rights: `payments.edit_own`, `payments.apply_credit`, `invoices.send_reminder`, `reports.view_receivables` (statement).

### US-PAY-29 · Filter receivables by age
**Feature:** F-PAY-11 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `ReceivablesByInvoice`
**As** an owner, **I want** to press an age to see what's in it, **so that** I can work through the oldest money first.

Decision: D-180, D-224

**Acceptance criteria**
- **Given** the cards, **when** I press Current, Overdue or 90+ days, **then** both tabs show only that age (Overdue: every overdue age); pressing it again shows all; the chosen card is outlined and announced as pressed.
- **Given** the age bar, **when** I press an age (or reach it with Tab and press Enter), **then** the list shows that age.
- **Given** the age filter in the filter bar, **when** I open it, **then** it offers All ages, Overdue, Current, 1–30 days, 31–60 days, 61–90 days and 90+ days; the age is kept in the address (`?age=31-60`; the dashboard's `?overdue=1` still opens Overdue). It replaces the report-style "Show" row.
- **Given** an age with nothing in it, **when** it's chosen, **then** the list says "Nothing 31–60 days late." with "Show all".
- **Given** an age is chosen, **when** I export, **then** the file has only that age.
- **Given** the cards and bar, **when** an age is chosen, **then** they still show every age — only the list narrows.

**Implementation notes**
- `AgingSummary` gains an optional `age`/`onAgeChange`; Payables doesn't pass them and is unchanged. `SegmentedBar` gains optional `onSegmentClick` and `selectedKey` (its doc page and a11y test change with it).
- API: `GET /reports/receivables/export.csv` accepts `age=current|overdue|0-30|31-60|61-90|90+`.

### US-PAY-30 · Read a receivable at a glance
**Feature:** F-PAY-11 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `ReceivablesByInvoice`
**As** office staff, **I want** each invoice to say how late it is and when the customer was last reminded, **so that** I don't open it to find out.

Decision: D-224

**Acceptance criteria**
- **Given** "By invoice", **when** a row shows, **then** it has the number (with the job under it, and "Deposit" for a deposit invoice), the customer (opening the contact), the due date in the business's format with "Last reminded 3 Oct" under it, how late in words ("12 days late", "Due in 5 days", "No due date") beside its coloured age, and the balance due.
- **Given** Columns, **when** I open it, **then** Issued, Invoice total and Paid so far can be shown; they're hidden at first.
- **Given** no sort chosen, **when** the list shows, **then** the most days late comes first, as today.

**Implementation notes**
- API: `GET /reports/receivables` invoice rows gain `issueDate`, `type`, `paidAmount` (paid and credited), `jobId`, `jobName`, `lastReminderOn`, `remindedToday` and `contactHasEmail`.

### US-PAY-31 · Trust what Receivables counts
**Feature:** F-PAY-11 · **Priority:** P2 · **Phase:** Refinements · **Screens:** `ReceivablesByCustomer`
**As** an owner, **I want** Receivables to say what it counts and how fresh it is, **so that** I can rely on the number.

Decision: D-210, D-224

**Acceptance criteria**
- **Given** the page, **when** it opens, **then** the description reads "What customers owe you, by how late it is · as of 11 Oct 2026".
- **Given** retention held on jobs, **when** the page shows, **then** a note under the age bar reads "₹2,40,000.00 retention held on 3 jobs isn't counted here — it's owed once you release it on the job." with "See jobs".
- **Given** the filter bar, **when** it shows, **then** it has "Updated just now" and Refresh beside Export; the page also refreshes after 30 seconds away.
- **Given** a tab, search, sort, page or age, **when** I open an invoice and go Back, **then** the page comes back the same.

**Implementation notes**
- API: `GET /reports/receivables` gains `retention: { held, jobCount }` from `journal_lines` on 1150 (as `GET /dashboard/retention`).
