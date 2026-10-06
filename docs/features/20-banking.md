# 20 · Banking

Where the business's money actually sits: bank, cash and card accounts, each a ledger account with a balance and a list of what went in and out; transfers between them; money in or out that no document covers (the owner putting money in, a loan, bank charges, interest); and reconciliation against an imported bank statement, so the books match the bank. Every payment, vendor payment, expense, refund and tax payment says which account it used ([D-140](../prd/12-decisions.md)). Live bank feeds stay out ([D-135](../prd/12-decisions.md)).

**Screens:** `BankingAccounts` (P1), `MoneyAccountDialog` (P1), `AccountRegister` (P1), `TransferDialog` (P1), `MoneyInOutDialog` (P1), `NewPaymentDialogAccount` (P1), `StatementImportDialog` (P1), `ReconcileAccount` (P1), `ReconcileCreateDrawer` (P1), `ReconciliationsHistory` (P2), `TeamPrivilegesBooks` (P1)
**Depends on:** 12 Reports (chart of accounts, period close), 09 Payments and 10 Purchases (the documents that move money), 15 Team (capabilities), 06-ledger-posting-rules (P22, P29).

## Features

| ID | Feature | Priority | Phase | Screens |
|---|---|---|---|---|
| F-BANK-01 | Bank, cash and card accounts | P1 | 8 | `BankingAccounts`, `MoneyAccountDialog`, `AccountRegister`, `NewPaymentDialogAccount` |
| F-BANK-02 | Transfers and other money in and out | P1 | 8 | `TransferDialog`, `MoneyInOutDialog` |
| F-BANK-03 | Bank reconciliation | P1 | 8 | `StatementImportDialog`, `ReconcileAccount`, `ReconcileCreateDrawer`, `ReconciliationsHistory` |
| F-BANK-04 | Banking rights | P1 | 8 | `TeamPrivilegesBooks` |

## User stories

### US-BANK-01 · Add my bank, cash and card accounts
**Feature:** F-BANK-01 · **Priority:** P1 · **Phase:** 8 · **Screens:** `BankingAccounts`, `MoneyAccountDialog`
**As** an owner, **I want** each of my bank accounts, cash boxes and business cards in Spine, **so that** money is recorded where it really is.

Decision: D-140

**Acceptance criteria**
- **Given** Banking (a new "Banking" item under Money in the sidebar), **when** it opens for the first time after the upgrade, **then** it lists "Bank Account" (1010, marked "Default") and "Cash in Hand" (1000) with their balances.
- **Given** "Add account", **when** the dialog opens, **then** it asks for "Type" ("Bank account", "Cash", "Credit card"), "Name" (placeholder "e.g. HDFC Current"), "Bank name" and "Last 4 digits" (bank and card only), and "Use as default for new payments".
- **Given** a valid bank or cash account, **when** I save, **then** a ledger account is created as an asset with the next free code from 1011 to 1099, and the account is listed with balance 0.00.
- **Given** a credit card, **when** I save, **then** its ledger account is a liability with the next free code from 2300 to 2399, and its balance shows what's owed on the card.
- **Given** the name is already used by another money account, **when** I save, **then** I see "You already have an account called <name>. Choose another name.".
- **Given** I tick "Use as default for new payments", **when** I save, **then** the previous default loses its "Default" badge.
- **Given** a Staff user, **when** they call the create route, **then** the API returns 403 — adding accounts is Owner-only, like the chart of accounts.

**Implementation notes**
- API: `GET /money-accounts` (`banking.view`, or any member for the picker list without balances), `POST /money-accounts`, `PUT /money-accounts/:id` (roles: owner).
- Data: `money_accounts` (new); migration creates rows for 1000 and 1010 in every organisation, 1010 as default.
- Opening balances for these accounts are entered in US-RPT-16, not here.

### US-BANK-02 · See every account's balance and what moved through it
**Feature:** F-BANK-01 · **Priority:** P1 · **Phase:** 8 · **Screens:** `BankingAccounts`, `AccountRegister`
**As** an owner, **I want** each account's balance and its transactions, **so that** I can compare Spine with my bank app at a glance.

**Acceptance criteria**
- **Given** Banking, **when** it loads, **then** each account shows its type icon, name, bank and last four digits, "Balance in Spine", "Last reconciled <date>" (or "Never reconciled") and "Unreconciled: <n> entries".
- **Given** I open an account, **when** its register loads, **then** I see one row per entry on its ledger account — date, what it was (payment, vendor payment, expense, transfer, refund, tax payment, money in/out, journal, opening balance), the contact, a reference, "Money in", "Money out", a running balance, and a "Reconciled" tick.
- **Given** a row, **when** I click it, **then** the source document or entry opens.
- **Given** the register, **when** I filter by date range or "Unreconciled only", **then** the running balance still starts from the true balance before the range.
- **Given** a credit card account, **when** the register shows, **then** "Spent" and "Paid off" replace "Money out" and "Money in".
- **Given** an account with no entries, **when** it opens, **then** I see "Nothing has gone in or out of this account yet.".

**Implementation notes**
- API: `GET /money-accounts/:id/register?from=&to=&unreconciled=` (`banking.view`) reads `journal_lines` on the account (D-011).
- Totals match the Balance Sheet for the same date (tested).

### US-BANK-03 · Choose the account money went into or came out of
**Feature:** F-BANK-01 · **Priority:** P1 · **Phase:** 8 · **Screens:** `NewPaymentDialogAccount`
**As** office staff, **I want** to pick the account on every payment, **so that** each account's balance is right.

Decision: D-140

**Acceptance criteria**
- **Given** "Record payment", "New vendor payment", "Pay bill", an expense, a refund or a tax payment, **when** the form opens, **then** it has "Paid into" (money in) or "Paid from" (money out), listing active money accounts.
- **Given** I've used an account before on this kind of form, **when** the form opens, **then** that account is preselected; otherwise the organisation default is.
- **Given** an expense paid by card, **when** I choose the card account, **then** the expense credits the card's liability account instead of Bank (P15).
- **Given** a payment already recorded, **when** I open it, **then** its account shows read-only next to the method.
- **Given** a Field user submitting an expense on the phone, **when** it syncs, **then** it uses the organisation default; the approver can change the account before approving.

**Implementation notes**
- API: `bankAccountId` (already accepted by `POST /payments`, `POST /vendor-payments` and expense approval) becomes `moneyAccountId`, validated to be an active money account in the organisation; the last-used account per form is kept on the member (`user.last_money_accounts jsonb`).
- No new postings: P4, P5, P13, P15 already debit or credit "the chosen cash account".

### US-BANK-04 · Move money between my accounts
**Feature:** F-BANK-02 · **Priority:** P1 · **Phase:** 8 · **Screens:** `TransferDialog`
**As** an owner, **I want** to record a transfer, cash deposit or card payoff, **so that** both accounts show the right balance.

**Acceptance criteria**
- **Given** Banking › "Transfer", **when** the dialog opens, **then** it asks for "From", "To", "Amount", "Date" and "Reference".
- **Given** the same account in both fields, **when** I save, **then** I see "Choose two different accounts.".
- **Given** a valid transfer, **when** I save, **then** it posts Dr To / Cr From (P22), appears in both registers and the toast reads "Moved <amount> from <From> to <To>".
- **Given** a transfer that's not reconciled, **when** I delete it, **then** a reversing entry posts and both balances go back.
- **Given** a transfer dated in a closed period, **when** I save, **then** it's refused with "falls within a closed fiscal period".

**Implementation notes**
- API: `POST /bank-transfers`, `DELETE /bank-transfers/:id` (`banking.record`).
- Data: `bank_transfers` (new).

### US-BANK-05 · Record money in or out that has no invoice or bill
**Feature:** F-BANK-02 · **Priority:** P1 · **Phase:** 8 · **Screens:** `MoneyInOutDialog`
**As** an owner, **I want** to record owner contributions, drawings, loans, interest and bank charges, **so that** my bank balance is complete without a journal.

**Acceptance criteria**
- **Given** Banking › "Money in" or "Money out", **when** the dialog opens, **then** it asks for the money account, "Date", "Amount", "Category" (an account picker, with shortcuts "Owner's capital", "Owner's drawings", "Loan received", "Loan repayment", "Interest received", "Bank charges"), "Contact" (optional), "Tax" (optional, money out only) and "Description".
- **Given** I pick a control account (receivables, payables, tax, retention, customer advances, opening adjustments), **when** I search for it, **then** it isn't offered, with the hint "Use a payment, bill or tax payment for this.".
- **Given** a valid entry, **when** I save, **then** it posts P22 and shows in the register as "Money in — <category>" or "Money out — <category>".
- **Given** bank charges with 18% GST, **when** I save, **then** the tax part posts to 1200 Input Tax Receivable.
- **Given** an entry that isn't reconciled, **when** I delete it, **then** a reversing entry posts.

**Implementation notes**
- API: `POST /bank-transactions`, `DELETE /bank-transactions/:id` (`banking.record`).
- Data: `bank_transactions` (new).

### US-BANK-06 · Archive an account I no longer use
**Feature:** F-BANK-01 · **Priority:** P2 · **Phase:** 8 · **Screens:** `BankingAccounts`
**As** an owner, **I want** to archive a closed bank account, **so that** it stops appearing in pickers but its history stays.

**Acceptance criteria**
- **Given** an account with a balance other than zero, **when** I choose "Archive", **then** I see "Move the <balance> out of this account before archiving it." and nothing changes.
- **Given** an account with a zero balance, **when** I archive it, **then** it leaves every picker and moves under "Archived accounts"; "Restore" brings it back.
- **Given** the default account, **when** I try to archive it, **then** I see "Choose another default account first.".

**Implementation notes**
- API: `POST /money-accounts/:id/archive`, `/restore` (roles: owner).

### US-BANK-07 · Import a bank statement
**Feature:** F-BANK-03 · **Priority:** P1 · **Phase:** 8 · **Screens:** `StatementImportDialog`
**As** a bookkeeper, **I want** to import my bank's CSV statement, **so that** I can check every line against Spine.

Decision: D-157

**Acceptance criteria**
- **Given** an account › "Reconcile" › "Import statement", **when** I choose a CSV file, **then** I see its first ten rows and, the first time, map "Date" (with its format), "Description", "Reference", and either "Amount" (money in positive) or "Money in" and "Money out", plus an optional "Balance".
- **Given** I've imported to this account before, **when** I choose a new file, **then** the saved mapping is applied and I can change it.
- **Given** rows that already exist for this account (same date, amount and description), **when** I import, **then** they're skipped and the summary reads "Imported <n> lines · skipped <m> already imported · <k> rows couldn't be read".
- **Given** a row with an unreadable date or amount, **when** I import, **then** it's listed with the reason and the rest import.
- **Given** a file over 5,000 rows or 2 MB, **when** I choose it, **then** I see "Split the statement into smaller files (up to 5,000 lines)."
- **Given** a file that isn't CSV, **when** I choose it, **then** I see "Export the statement from your bank as CSV, then import it here.".

**Implementation notes**
- API: `POST /money-accounts/:id/statement-imports` (multipart CSV, mapping) → summary; `GET /money-accounts/:id/statement-lines?status=` (`banking.reconcile`).
- Data: `bank_statement_imports`, `bank_statement_lines` (new); mapping in `money_accounts.statement_mapping`.
- Parsing: `papaparse` (already used by contact import).

### US-BANK-08 · Match statement lines to what's in Spine
**Feature:** F-BANK-03 · **Priority:** P1 · **Phase:** 8 · **Screens:** `ReconcileAccount`
**As** a bookkeeper, **I want** Spine to suggest matches, **so that** reconciling takes minutes, not hours.

Decision: D-158

**Acceptance criteria**
- **Given** "Reconcile <account>", **when** I enter "Statement end date" and "Closing balance on the statement", **then** the page shows statement lines on the left and unreconciled Spine entries on the right, up to that date.
- **Given** a statement line with one Spine entry of the same amount within 3 days, **when** the page loads, **then** it's shown as "Suggested match" with "Match" and "Not this one".
- **Given** a line I select, **when** I tick several Spine entries that add up to it, **then** "Match" becomes available; if they don't add up I see "Selected entries add up to <x>; the line is <y>.".
- **Given** matches, **when** I make them, **then** the header updates "Statement closing balance", "Cleared in Spine" and "Difference".
- **Given** a line that shouldn't be in the books (e.g. a bank reversal that cancels out), **when** I choose "Exclude", **then** it leaves the list and counts as matched with a note.
- **Given** I leave the page, **when** I come back, **then** my matches and exclusions are still there (saved as I go).

**Implementation notes**
- API: `POST /bank-reconciliations` (start: account, end date, closing balance), `PUT /bank-reconciliations/:id/matches` (`banking.reconcile`).
- Data: `bank_reconciliations` (new), `bank_statement_lines.status` and `bank_statement_line_matches` (line ↔ journal line).

### US-BANK-09 · Create what's missing from a statement line
**Feature:** F-BANK-03 · **Priority:** P1 · **Phase:** 8 · **Screens:** `ReconcileCreateDrawer`
**As** a bookkeeper, **I want** to record a missing entry straight from the statement line, **so that** I don't lose my place.

**Acceptance criteria**
- **Given** an unmatched money-in line, **when** I choose "Create", **then** I can record it as a "Customer payment" (opens the payment form prefilled with amount, date and account), a "Transfer from another account" or "Other money in".
- **Given** an unmatched money-out line, **when** I choose "Create", **then** I can record it as a "Vendor payment", an "Expense", a "Transfer to another account", "Other money out" or a "Tax payment".
- **Given** I save the new entry, **when** the drawer closes, **then** the line is matched to it automatically.
- **Given** I lack the capability for the document (e.g. `payments.edit_own`), **when** the options show, **then** that option is missing.

**Implementation notes**
- No new routes: the drawer calls the normal create routes with the statement line id, and the match is saved after the entry posts.

### US-BANK-10 · Finish a reconciliation when it balances
**Feature:** F-BANK-03 · **Priority:** P1 · **Phase:** 8 · **Screens:** `ReconcileAccount`
**As** a bookkeeper, **I want** to finish when Spine agrees with the bank, **so that** the account is proven up to that date.

**Acceptance criteria**
- **Given** a difference of 0.00, **when** I press "Finish reconciliation", **then** the reconciliation is saved, its entries show the "Reconciled" tick, and the account shows "Last reconciled <end date>".
- **Given** a difference other than zero, **when** the page renders, **then** "Finish reconciliation" is disabled and the footer reads "Difference <amount> — match or create entries until it's zero.".
- **Given** a reconciled entry, **when** someone tries to void or delete its document, **then** they see "This entry is part of a finished reconciliation of <account> to <date>. Undo that reconciliation first." (API 400).
- **Given** a reconciliation is finished, **when** the audit log is read, **then** it records who finished it and the closing balance.

**Implementation notes**
- API: `POST /bank-reconciliations/:id/finish` (`banking.reconcile`); void/delete services check `journal_lines.reconciliation_id` (invariant 10).

### US-BANK-11 · Review or undo a reconciliation
**Feature:** F-BANK-03 · **Priority:** P2 · **Phase:** 8 · **Screens:** `ReconciliationsHistory`
**As** an owner, **I want** to see past reconciliations and undo the last one, **so that** a mistake can be fixed.

**Acceptance criteria**
- **Given** an account › "Reconciliations", **when** it opens, **then** each finished reconciliation shows end date, closing balance, entries matched, who finished it and when.
- **Given** the most recent one, **when** I press "Undo" and confirm ("Undo this reconciliation? Its entries go back to unreconciled; nothing is deleted."), **then** its entries lose the tick and the statement lines go back to unmatched.
- **Given** an older reconciliation, **when** I look for "Undo", **then** it isn't offered ("Undo the later reconciliations first.").
- **Given** a Staff user without `banking.reconcile`, **when** they call undo, **then** the API returns 403.

**Implementation notes**
- API: `GET /money-accounts/:id/reconciliations`, `POST /bank-reconciliations/:id/undo` (`banking.reconcile`; audited).

### US-BANK-12 · Let a Team see balances, record money and reconcile
**Feature:** F-BANK-04 · **Priority:** P1 · **Phase:** 8 · **Screens:** `TeamPrivilegesBooks`
**As** an owner, **I want** banking rights in the privilege matrix, **so that** my bookkeeper can reconcile without being an owner.

**Acceptance criteria**
- **Given** a Team's privileges, **when** I expand "Banking", **then** it lists "View bank balances and registers" (`banking.view`), "Record transfers and other money in or out" (`banking.record`) and "Reconcile accounts" (`banking.reconcile`), all off for General Staff by default.
- **Given** a member without `banking.view`, **when** they open Banking, **then** they see the no-access page and the API returns 403; the account pickers on payment forms still work (names only, no balances).
- **Given** `banking.reconcile` without `banking.view`, **when** the grant is saved, **then** `banking.view` is ticked too ("Reconciling needs to see the account.").
- **Given** a Field user, **when** they call any banking route, **then** they get 403.

**Implementation notes**
- Capabilities added to `CAPABILITIES`, `CAPABILITY_LABELS`, `DEFAULT_TEAM_GRANTS` (all ✗) with a migration; enforced in API and UI together ([07-security](../prd/07-security.md)).
