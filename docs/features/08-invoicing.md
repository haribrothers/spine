# 08 · Invoicing & credit notes

Standard, advance (deposit), progress and retention-release invoices. Drafts are freely editable; issuing locks the invoice, gives it a permanent number and posts it to the ledger. Mistakes are fixed by voiding with a reason or issuing a credit note — never by editing. Invoices are emailed as PDFs and chased with one-click reminders.

**Screens:** `InvoicesList` (P1), `InvoicesEmpty` (P1), `InvoiceBuilder` (P1), `InvoiceBuilderAdvance` (P1), `InvoiceDetailDraft` (P1), `InvoiceDetail` (P1), `InvoiceDetailProgress` (P1), `InvoiceDetailVoid` (P2), `InvoiceVoidDialog` (P1), `InvoiceDeleteConfirm` (P2), `CreditNoteDialog` (P1), `CreditNotesList` (P2), `CreditNotesEmpty` (P2), `CreditNoteDrawer` (P2), `InvoicePdf` (P1), `ApplyCreditDialog` (P2), `SettingsBusiness` (P1), `SettingsReminders` (P1), `EmailReminder` (P1), `RecurringInvoiceDialog` (P2), `RecurringInvoicesList` (P2), `InvoicesBulkSelect` (P2), `InvoicePdfPaymentInstructions` (P2), `SettingsPaymentInstructions` (P2)
**Depends on:** 03 Contacts, 05 Catalogue, 11 Tax, 06 Quotes and 07 Jobs (other ways to create invoices), 09 Payments.

## Features

| ID | Feature | Priority | Phase | Screens |
|---|---|---|---|---|
| F-INV-01 | Draft, issue and void invoices | P1 | 2 | `InvoiceBuilder`, `InvoiceDetailDraft`, `InvoiceDetail`, `InvoicesList`, `InvoicesEmpty`, `InvoiceDeleteConfirm`, `InvoiceVoidDialog`, `InvoiceDetailVoid` |
| F-INV-02 | Advance (deposit) invoices | P1 | 2 | `InvoiceBuilderAdvance`, `ApplyCreditDialog` |
| F-INV-03 | Credit notes | P1 | 2 | `CreditNoteDialog`, `CreditNotesList`, `CreditNotesEmpty`, `CreditNoteDrawer` |
| F-INV-04 | Email and reminders | P1 | 2 | `InvoicePdf`, `InvoiceDetail`, `InvoicesList` |
| F-INV-05 | Own/others and workflow rights | P1 | 4 | `InvoicesList`, `InvoiceDetail` |
| F-INV-06 | Payment instructions on invoices | P2 | 6 | `InvoicePdf`, `SettingsBusiness` |
| F-INV-07 | Automatic payment reminders | P1 | 7 | `SettingsReminders`, `EmailReminder` |
| F-INV-08 | Recurring invoices | P2 | 7 | `RecurringInvoiceDialog`, `RecurringInvoicesList` |
| F-INV-09 | Bulk invoice actions | P2 | 7 | `InvoicesBulkSelect` |

## User stories

### US-INV-01 · Create an invoice from scratch
**Feature:** F-INV-01 · **Priority:** P1 · **Phase:** 2 · **Screens:** `InvoiceBuilder`
**As** office staff, **I want** to build an invoice directly, **so that** I can bill work that didn't start as a quote.

Legacy: S-05.1 (scratch path)

**Acceptance criteria**
- **Given** I press "New invoice", **when** the builder opens, **then** I see "Contact", "Currency", "Type" (Standard, Advance, Progress), "Issue date" (helper "Defaults to today if left blank when issued."), "Due date" (helper "Drives the overdue flag (S-05.9) once issued."), lines, "Notes" and "Terms & conditions".
- **Given** lines with quantity, price, discount and tax, **when** I edit them, **then** Subtotal, Tax and Total update immediately.
- **Given** no contact, **when** I press "Save as draft", **then** I see "Select a contact before saving.".
- **Given** a valid invoice, **when** I press "Save as draft", **then** it's saved as a draft with no number (the list shows "— (unissued draft)").

**Implementation notes**
- API: `POST /invoices` (`invoices.edit_own`).
- Data: `invoices`, `invoice_lines` (snapshot).
- UI: `invoice-builder.tsx`, `invoice-line-editor.tsx`.

### US-INV-02 · Edit a draft invoice freely
**Feature:** F-INV-01 · **Priority:** P1 · **Phase:** 2 · **Screens:** `InvoiceDetailDraft`
**As** office staff, **I want** to change a draft as often as I like, **so that** I can prepare it before committing.

Legacy: S-05.2

**Acceptance criteria**
- **Given** a draft, **when** I open it, **then** it shows "Draft invoice" with "Preview PDF", "Edit", "Issue Invoice" and "Delete draft".
- **Given** I press "Edit" and change lines, **when** I save, **then** the draft updates and nothing is posted to the ledger.
- **Given** a draft, **when** I view the ledger, **then** no entry exists for it.

**Implementation notes**
- API: `PUT /invoices/:id` (draft only).

### US-INV-03 · Issue an invoice to lock it and number it
**Feature:** F-INV-01 · **Priority:** P1 · **Phase:** 2 · **Screens:** `InvoiceDetail`
**As** office staff, **I want** issuing to lock the invoice and give it a permanent number, **so that** the record can be trusted.

Legacy: S-05.3

**Acceptance criteria**
- **Given** a draft, **when** I press "Issue Invoice", **then** it gets the next number in sequence and becomes "Issued".
- **Given** it was just issued, **when** the page updates, **then** an "Invoice issued" toast shows and the lines can no longer be edited.
- **Given** it's issued, **when** I check its journal entry (Reports › account drill-down), **then** one balanced entry exists: AR debited, revenue per line account and output tax credited.
- **Given** an issued invoice, **when** anyone tries to edit or delete it, **then** the API refuses.
- **Given** the issue date falls in a closed fiscal period, **when** I issue, **then** I see "Could not issue this invoice." explaining the period is closed.
- **Given** two invoices are issued at the same moment, **when** both succeed, **then** their numbers are consecutive with no gap or duplicate.

**Implementation notes**
- API: `POST /invoices/:id/issue` (`invoices.issue`); posting P1/P2; numbering under row lock (D-007).

### US-INV-04 · Find invoices and see which are overdue
**Feature:** F-INV-01 · **Priority:** P1 · **Phase:** 2 · **Screens:** `InvoicesList`, `InvoicesEmpty`
**As** an owner, **I want** overdue invoices flagged with days outstanding, **so that** chasing is obvious.

Legacy: S-05.9

**Acceptance criteria**
- **Given** invoices exist, **when** I open Invoices, **then** I see "Total invoices", "Draft", "Issued" and "Overdue" counters and a table of number, contact, status, due date, total and balance.
- **Given** an issued invoice past its due date with a balance, **when** it's listed, **then** it shows an "Overdue" chip and the due date in the due-date column.
- **Given** I filter by status or contact, **when** it applies, **then** only matching invoices show.
- **Given** none exist, **when** I open Invoices, **then** I see "No invoices yet" with "Build a multi-line invoice for a customer — save it as a draft, then issue when it's ready.".

**Implementation notes**
- API: `GET /invoices?status=&contactId=`.
- Edge: a void invoice's balance column shows "—", not its total (fixed by US-OPS-21).

### US-INV-05 · Delete a draft invoice
**Feature:** F-INV-01 · **Priority:** P2 · **Phase:** 2 · **Screens:** `InvoiceDeleteConfirm`
**As** office staff, **I want** to delete a draft I don't need, **so that** the list stays accurate.

**Acceptance criteria**
- **Given** a draft, **when** I choose delete, **then** "Delete this draft invoice?" asks me to confirm.
- **Given** I confirm, **when** it succeeds, **then** an "Invoice deleted" toast shows.
- **Given** an issued invoice, **when** I look for delete, **then** none is offered.

**Implementation notes**
- API: `DELETE /invoices/:id` (draft only).

### US-INV-06 · Void an issued invoice with a reason
**Feature:** F-INV-01 · **Priority:** P1 · **Phase:** 2 · **Screens:** `InvoiceVoidDialog`, `InvoiceDetailVoid`
**As** an owner, **I want** to void a wrong invoice with a reason, **so that** mistakes are reversible and traceable.

Legacy: S-05.8

**Acceptance criteria**
- **Given** an issued invoice with no payments, **when** I press "Void", **then** "Void this invoice?" asks for a required "Reason".
- **Given** I leave the reason empty, **when** I confirm, **then** I see "A reason is required to void an invoice.".
- **Given** I give a reason and confirm, **when** it succeeds, **then** the invoice shows "Void" with the reason and date, and a reversing ledger entry is posted.
- **Given** a void invoice, **when** I view it, **then** it keeps its number and lines; nothing is deleted.
- **Given** an invoice with allocated payments, **when** I try to void it, **then** it's refused with "Cannot void an invoice with payments allocated against it"; the remedy is a credit note (US-INV-09, [D-074](../prd/12-decisions.md)).

**Implementation notes**
- API: `POST /invoices/:id/void` (`invoices.void`); posting P9.

### US-INV-07 · Raise an advance (deposit) invoice
**Feature:** F-INV-02 · **Priority:** P1 · **Phase:** 2 · **Screens:** `InvoiceBuilderAdvance`
**As** office staff, **I want** to request a deposit before work starts, **so that** we're funded.

Legacy: S-05.4

**Acceptance criteria**
- **Given** the builder, **when** I choose Type "Advance", **then** the invoice is marked "Deposit".
- **Given** an advance invoice is issued, **when** I check its journal entries (Reports › account drill-down), **then** nothing is posted (a request for a deposit isn't revenue).
- **Given** the customer pays the deposit, **when** I record it as an unallocated payment, **then** the money is held as customer credit (Customer Advances); allocating a payment directly to an advance invoice is refused with "…Record the deposit as an unallocated payment instead" until US-PAY-13 ships.

**Implementation notes**
- Posting P3 (none) and P5 on payment. Allocating the payment to the advance invoice is US-PAY-13 (Phase 6, [D-075](../prd/12-decisions.md)).

### US-INV-08 · Offset a deposit against a later invoice
**Feature:** F-INV-02 · **Priority:** P1 · **Phase:** 2 · **Screens:** `ApplyCreditDialog`
**As** office staff, **I want** a deposit already paid to reduce a later invoice, **so that** the customer isn't charged twice.

Legacy: S-05.5

**Acceptance criteria**
- **Given** a customer with sitting credit and an issued invoice, **when** I choose "Apply credit" on the payment, **then** I can allocate the credit to that invoice up to the smaller of the credit and the balance.
- **Given** I apply it, **when** it succeeds, **then** the invoice balance drops and Customer Advances decreases by the same amount.
- **Given** I try to apply more than available, **when** I confirm, **then** it's refused.

**Implementation notes**
- API: `POST /payments/:id/apply-credit` (`payments.apply_credit`); posting P6.

### US-INV-09 · Issue a credit note against an invoice
**Feature:** F-INV-03 · **Priority:** P1 · **Phase:** 2 · **Screens:** `CreditNoteDialog`, `InvoiceDetail`
**As** office staff, **I want** to credit part of an issued invoice, **so that** I correct it without editing the original.

Legacy: S-05.6

**Acceptance criteria**
- **Given** an issued invoice with a balance, **when** I press "Issue credit note", **then** "Issue a credit note" says "Reduces what's owed on this invoice without editing the issued document." with "Description", "Reason" (helper "Shown to the customer on the credit note.") and "Amount" (helper "Up to this invoice's remaining balance.").
- **Given** an amount of zero, **when** I confirm, **then** I see "Enter a credit amount greater than zero.".
- **Given** an amount above the balance, **when** I confirm, **then** I see "Credit amount cannot exceed the invoice's remaining balance.".
- **Given** a valid amount, **when** I press "Issue credit note", **then** it gets a credit-note number, the invoice's balance drops, and the invoice lists it under "Credit notes".

**Implementation notes**
- API: `POST /credit-notes`, `POST /credit-notes/:id/issue` (`credit_notes.issue`); posting P8.

### US-INV-10 · See all credit notes
**Feature:** F-INV-03 · **Priority:** P2 · **Phase:** 2 · **Screens:** `CreditNotesList`, `CreditNotesEmpty`, `CreditNoteDrawer`
**As** office staff, **I want** a list of every credit note, **so that** I can find one without opening each invoice.

**Acceptance criteria**
- **Given** credit notes exist, **when** I open Credit Notes, **then** I see "Total credit notes" and "Total credited (issued)" and a table of number, status, date, contact, invoice and total.
- **Given** I click a number, **when** the drawer opens, **then** it shows the reason, lines, total and a link to the invoice.
- **Given** none exist, **when** I open the page, **then** I see "No credit notes yet" and "Issue one from an invoice's own detail page when you need to correct or refund part of it.".

**Implementation notes**
- API: `GET /credit-notes`, `GET /credit-notes/:id`.

### US-INV-11 · Email an invoice as a PDF
**Feature:** F-INV-04 · **Priority:** P1 · **Phase:** 2 · **Screens:** `InvoicePdf`, `InvoiceDetail`
**As** office staff, **I want** to email the invoice as a PDF, **so that** the customer can pay easily.

Legacy: S-05.7

**Acceptance criteria**
- **Given** an issued invoice, **when** I press "Email invoice", **then** I see "Emailing invoice" and the email is queued to the contact with the PDF attached.
- **Given** the PDF, **when** it renders, **then** it shows the business details, "INVOICE", number, billed-to, issue and due dates, lines, Subtotal, Tax, Total, any credits, and "Balance due".
- **Given** a reprint years later, **when** it's generated, **then** it's byte-identical to the original.
- **Given** SMTP is down, **when** I email, **then** it queues and retries and the invoice shows its email status.

**Implementation notes**
- API: `POST /invoices/:id/send-email` (`invoices.send`), `GET /invoices/:id/pdf`; queue `invoice-send-email`.

### US-INV-12 · Send a payment reminder in one click
**Feature:** F-INV-04 · **Priority:** P1 · **Phase:** 2 · **Screens:** `InvoicesList`, `InvoiceDetail`
**As** office staff, **I want** to send a reminder for an unpaid invoice in one click, **so that** chasing isn't a chore.

Legacy: S-05.10

**Acceptance criteria**
- **Given** an issued invoice with a balance, **when** I press "Send reminder", **then** I see "Reminder queued" and the contact gets an email with the balance due and the PDF.
- **Given** the invoice is fully paid, **when** I view it, **then** "Send reminder" isn't offered.
- **Given** sending fails, **when** the error returns, **then** I see "Could not send reminder".

**Implementation notes**
- API: `POST /invoices/:id/send-reminder` (`invoices.send_reminder`).

### US-INV-13 · Let a Team edit only its own invoices and credit notes
**Feature:** F-INV-05 · **Priority:** P1 · **Phase:** 4 · **Screens:** `InvoicesList`, `InvoiceDetail`
**As** an owner, **I want** own/others rights on draft invoices and credit notes, **so that** changing someone else's document needs a deliberate grant.

Legacy: S-05.11

**Acceptance criteria**
- **Given** a member with `invoices.edit_own` only, **when** they open a colleague's draft, **then** "Edit" is hidden and `PUT` returns 403.
- **Given** a non-owner of an issued invoice, **when** they try to delete it, **then** they get 403 before the status check.
- **Given** credit notes, **when** the same rules apply with `credit_notes.*`, **then** they're enforced independently of invoice rights.

**Implementation notes**
- API: ownership checks in `InvoicesService` / `CreditNotesService`.

### US-INV-14 · Grant issuing, voiding, emailing and reminders separately
**Feature:** F-INV-05 · **Priority:** P1 · **Phase:** 4 · **Screens:** `InvoiceDetail`
**As** an owner, **I want** each invoice workflow action as its own right, **so that** a Team can issue invoices without being able to void them.

**Acceptance criteria**
- **Given** a member without `invoices.void`, **when** they open an issued invoice, **then** "Void" is hidden and the API returns 403.
- **Given** a member with `invoices.issue` but not `invoices.edit_others`, **when** they open a colleague's draft, **then** they can issue it but not edit it.
- **Given** a member without `invoices.send_reminder`, **when** they view the list, **then** reminder actions are hidden.

**Implementation notes**
- API: `@RequireCapability` on issue, void, send-email, send-reminder.

### US-INV-15 · Print payment instructions on invoices
**Feature:** F-INV-06 · **Priority:** P2 · **Phase:** 6 · **Screens:** `InvoicePdfPaymentInstructions`
**As** an owner, **I want** my bank details and payment terms on every invoice, **so that** customers know how to pay.

Gap: G5 (PRD F5 "SHOULD show a payment link/instructions block")

**Acceptance criteria**
- **Given** payment instructions are set, **when** an invoice PDF renders, **then** a "How to pay" block shows them under the totals.
- **Given** the invoice email, **when** it's sent, **then** the same instructions appear in a "How to pay" box above the closing note (invoice emails have no button, [D-121](../prd/12-decisions.md)).
- **Given** no instructions are set, **when** an invoice renders, **then** no empty block appears.

**Implementation notes**
- Data: `settings.business_profile.paymentInstructions` (text).
- Edge: later edits to the setting don't change issued invoices, because the PDF is stored at issue (US-INV-17, [D-083](../prd/12-decisions.md)).

### US-INV-16 · Set payment instructions in Settings
**Feature:** F-INV-06 · **Priority:** P2 · **Phase:** 6 · **Screens:** `SettingsPaymentInstructions`
**As** an owner, **I want** to enter my payment instructions once, **so that** every invoice uses them.

**Acceptance criteria**
- **Given** Settings › "Payment instructions", **when** it opens, **then** it reads "Printed under the totals on every invoice and in invoice emails, so customers know how to pay." with a "How customers can pay" field (helper "Up to 600 characters. Leave empty to hide the block.").
- **Given** I enter instructions and press "Save", **when** it saves, **then** the next issued invoice shows them.
- **Given** more than 600 characters, **when** I save, **then** the field shows "Keep this under 600 characters.".
- **Given** the pane, **when** it renders, **then** it notes "Issued invoices keep the instructions they were issued with — changing this only affects invoices issued from now on.".

**Implementation notes**
- API: `PUT /org/settings/business_profile`.

### US-INV-17 · Keep the exact PDF that was issued
**Feature:** F-INV-06 · **Priority:** P1 · **Phase:** 6 · **Screens:** `InvoicePdf`, `QuotePdf`, `ReceiptPdf`
**As** an owner, **I want** every issued document's PDF stored at the moment it's issued, **so that** a reprint years later is identical to what the customer received.

Decision: D-083 · Review finding: Stage 5 #32

**Acceptance criteria**
- **Given** a quote is sent, or an invoice, credit note or receipt is issued, **when** the transaction commits, **then** its PDF is rendered once and stored as a file linked to the document.
- **Given** the customer's address, the logo, branding or payment instructions change afterwards, **when** anyone downloads that document's PDF, **then** they get the stored file, byte-identical to the original.
- **Given** a draft, **when** I preview or download its PDF, **then** it renders live from current data and nothing is stored.
- **Given** an issued document from before this story, **when** its PDF is first requested, **then** it's rendered, stored and served from then on.
- **Given** object storage is down at issue time, **when** the document issues, **then** issuing still succeeds and storing the PDF is retried by a queue job until it succeeds.

**Implementation notes**
- Data: `issued_pdf_file_id uuid → files` on `quotes`, `invoices`, `credit_notes`, `payments` (04 "Columns added").
- Queue: `store-issued-pdf` (pg-boss) renders and stores after commit; the email jobs attach the stored file.
- Supersedes the per-field snapshot idea for addresses and branding; line prices and tax are still snapshotted on the lines (D-006).
- Credit notes had no PDF before this story; one is added in the invoice PDF's layout (D-116).

### US-INV-18 · Turn on automatic payment reminders
**Feature:** F-INV-07 · **Priority:** P1 · **Phase:** 7 · **Screens:** `SettingsReminders`
**As** an owner, **I want** Spine to remind customers about unpaid invoices on a schedule, **so that** I get paid without chasing.

Decision: D-091

**Acceptance criteria**
- **Given** Settings › "Automatic reminders", **when** it opens, **then** I see "Send reminders automatically" (off by default), a "Schedule" with "3 days before the due date", "On the due date", "7 days after the due date", "14 days after the due date" and "Every 14 days after that, up to 3 more times", and "Send at".
- **Given** I turn it on with no schedule ticked, **when** I press "Save", **then** I see "Pick at least one reminder.".
- **Given** I press "Preview email", **when** it opens, **then** I see the reminder email for the most overdue invoice (or a sample).
- **Given** a Staff or Field user, **when** they call `PUT /org/settings/invoice_reminders`, **then** it returns 403.

**Implementation notes**
- API: `GET/PUT /org/settings/invoice_reminders` (generic settings route, new key, Owner).
- Data: `settings.invoice_reminders` `{ enabled, offsets: [-3,0,7,14], repeatEvery?: 14, repeatMax?: 3, sendAt: "09:00" }` (04 "Columns added").

### US-INV-19 · Send reminders on schedule without double-sending
**Feature:** F-INV-07 · **Priority:** P1 · **Phase:** 7 · **Screens:** `EmailReminder`
**As** a customer with an unpaid invoice, **I want** a clear reminder at sensible times, **so that** I can pay on time.

Decision: D-091

**Acceptance criteria**
- **Given** reminders are on and an issued invoice with a balance hits a scheduled offset, **when** the daily job runs at "Send at" time, **then** one reminder email is sent to the invoice's contact.
- **Given** the reminder email, **when** it arrives, **then** its subject reads "Reminder: invoice <number> is <n> days overdue" (or "is due today" / "is due in <n> days"), and it shows the invoice, due date, balance due, "View invoice" and the payment instructions.
- **Given** an invoice already got a reminder today (automatic or manual), **when** the job runs, **then** no second reminder is sent.
- **Given** an invoice is paid, voided or fully credited, **when** the job runs, **then** nothing is sent.
- **Given** a contact with "Pause automatic reminders" on, **when** the job runs, **then** their invoices are skipped.
- **Given** the server was off at send time, **when** it starts, **then** that day's reminders are sent once, not repeated for each missed day.
- **Given** a reminder is sent, **when** I open the invoice history, **then** it shows "Automatic reminder sent".

**Implementation notes**
- Queue: `invoice-reminder-run` (pg-boss schedule, daily, org timezone).
- Data: `invoice_reminders` (`invoice_id`, `sent_at`, `kind` auto/manual); `contacts.reminders_paused` (04 "Columns added").
- API: `PUT /contacts/:id` accepts `remindersPaused` (`contacts.edit_*`).

### US-INV-20 · Set up a recurring invoice
**Feature:** F-INV-08 · **Priority:** P2 · **Phase:** 7 · **Screens:** `RecurringInvoiceDialog`
**As** an owner with maintenance contracts, **I want** an invoice that repeats on a schedule, **so that** I don't recreate it every month.

Decision: D-092

**Acceptance criteria**
- **Given** Invoices › "Recurring invoices" › "+ New recurring invoice", **when** the dialog opens, **then** it asks for "Name", "Customer", "Repeats" (Weekly, Monthly, Every 3 months, Yearly), "On", "Starts", "Ends" (Never, On a date, After <n> invoices), "Payment due" and the lines.
- **Given** "When it runs", **when** I choose, **then** the options are "Issue the invoice and email it to the customer" and "Create a draft for me to review".
- **Given** a start date in the past, **when** I press "Save schedule", **then** I see "Pick today or a later start date.".
- **Given** a valid schedule, **when** it saves, **then** it's listed with "Active" and its next invoice date.
- **Given** I lack `invoices.manage_recurring`, **when** I open Invoices, **then** "Recurring invoices" isn't shown and the API returns 403.

**Implementation notes**
- API: `GET/POST /recurring-invoices`, `PUT/DELETE /recurring-invoices/:id` (contract additions, new Team-configurable capability `invoices.manage_recurring`).
- Data: `recurring_invoices`, `recurring_invoice_lines` (04 "Columns added").

### US-INV-21 · Create recurring invoices automatically
**Feature:** F-INV-08 · **Priority:** P2 · **Phase:** 7 · **Screens:** `RecurringInvoicesList`
**As** an owner, **I want** each recurring invoice to appear on time, **so that** retainers bill themselves.

Decision: D-092

**Acceptance criteria**
- **Given** an active schedule whose next date is today, **when** the 6:00 AM job runs, **then** one invoice is created from its lines (prices and tax snapshotted then) and the next date advances.
- **Given** "Issue the invoice and email it", **when** it's created, **then** it's issued with the next number, posted to the ledger and emailed to the customer like a manual issue.
- **Given** "Create a draft", **when** it's created, **then** Owners get a notification "Recurring invoice ready to review: <name>".
- **Given** the job ran late or twice, **when** it checks, **then** no schedule produces more than one invoice per due date.
- **Given** an end condition is reached, **when** the last invoice is created, **then** the schedule shows "Finished".

**Implementation notes**
- Queue: `recurring-invoice-run` (daily, 6:00 AM org time); uniqueness on (`recurring_invoice_id`, `run_date`).
- Posting: the same as a manual issue (P1); numbering under row lock (D-007).

### US-INV-22 · Pause, edit or stop a recurring invoice
**Feature:** F-INV-08 · **Priority:** P2 · **Phase:** 7 · **Screens:** `RecurringInvoicesList`
**As** an owner, **I want** to pause or change a schedule, **so that** it follows the contract.

**Acceptance criteria**
- **Given** the list, **when** it renders, **then** each schedule shows name, customer, repeats, next invoice, amount, status ("Active", "Paused", "Finished") and when it runs.
- **Given** I pause a schedule, **when** its date passes, **then** nothing is created and the next date shows "—".
- **Given** I resume it, **when** it saves, **then** the next date is the next future occurrence (missed ones aren't back-filled).
- **Given** I edit lines or amount, **when** it saves, **then** only future invoices change; invoices already created are untouched.
- **Given** I delete a schedule, **when** I confirm "Delete this schedule? Invoices it already created are kept.", **then** it's removed.

**Implementation notes**
- API: `POST /recurring-invoices/:id/pause`, `/resume` (contract additions).

### US-INV-23 · Send reminders for several invoices at once
**Feature:** F-INV-09 · **Priority:** P2 · **Phase:** 7 · **Screens:** `InvoicesBulkSelect`
**As** office staff, **I want** to select overdue invoices and remind all their customers in one go, **so that** month-end chasing takes a minute.

Decision: D-097

**Acceptance criteria**
- **Given** the Invoices list, **when** I tick rows, **then** a bar shows "<n> selected · <amount> outstanding" with "Send reminders (<m>)", "Download PDFs" and "Clear".
- **Given** a selection where only some invoices are eligible (issued, with a balance, not reminded today), **when** the bar renders, **then** the button counts only eligible ones.
- **Given** I press "Send reminders (3)", **when** it finishes, **then** a toast reads "3 reminders sent" and lists any skipped with the reason.
- **Given** I lack `invoices.send_reminder`, **when** I select rows, **then** "Send reminders" isn't shown.

**Implementation notes**
- API: `POST /invoices/bulk/send-reminders { ids }` (contract addition, idempotent, max 100 ids) → `{ sent: [], skipped: [{ id, reason }] }`.

### US-INV-24 · Download several invoice PDFs at once
**Feature:** F-INV-09 · **Priority:** P3 · **Phase:** 7 · **Screens:** `InvoicesBulkSelect`
**As** an owner, **I want** to download the PDFs of selected invoices together, **so that** I can send them to my accountant.

**Acceptance criteria**
- **Given** a selection, **when** I press "Download PDFs", **then** one ZIP downloads named "invoices-<date>.zip" containing each invoice's stored PDF (US-INV-17).
- **Given** a draft in the selection, **when** the ZIP is built, **then** the draft is skipped and the toast says so.
- **Given** more than 100 invoices, **when** I press it, **then** I see "Select 100 or fewer invoices.".

**Implementation notes**
- API: `POST /invoices/bulk/pdf { ids }` → ZIP stream (contract addition).
