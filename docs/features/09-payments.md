# 09 · Payments & receivables

Money in: record a payment against one or more invoices with an oldest-first suggestion, hold any remainder as customer credit, send a receipt, and see who owes what and for how long. Allocation limits are enforced by the database.

**Screens:** `PaymentsList` (P1), `PaymentsEmpty` (P1), `NewPaymentDialog` (P1), `RecordPaymentDialog` (P1), `PaymentDrawer` (P2), `PaymentDrawerCredit` (P2), `PaymentDeleteConfirm` (P2), `ReceiptPdf` (P2), `EmailReceipt` (P2), `EmailPaymentReceivedOwner` (P3), `Receivables` (P1), `ReceivablesEmpty` (P1), `InvoiceDetail` (P1), `ContactStatementDialog` (P2), `StatementPdf` (P2), `CreditNoteDialogExcess` (P1), `CustomerRefundDialog` (P1)
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
- **Given** a bucket, **when** I click it, **then** the table filters to that bucket.
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
