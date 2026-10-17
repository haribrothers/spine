import { z } from "zod";

/**
 * Staff-tier, Team-configurable capabilities (PRD §2.1). This is the single
 * source of truth imported by both the API's capability guard and the web
 * privilege-matrix UI — the UI must never render a capability the API
 * doesn't also enforce, and vice versa.
 *
 * "Manage users, teams, permissions, org settings, tax rules" is
 * deliberately NOT here — it's hard-coded Owner-only everywhere, never
 * Team-configurable.
 */
export const CAPABILITIES = [
  "reports.view_dashboard_summary",
  "reports.view_receivables",
  "reports.view_payables",
  "reports.view_job_profitability",
  // US-RPT-23, US-RPT-36 (D-136): the financial statements and analysis reports, read-only.
  "reports.view_financial_statements",
  "ledger.view",
  "banking.view",
  "banking.record",
  "banking.reconcile",
  // US-TEAM-30 (D-235): the section opens for the Team.
  "contacts.open",
  "contacts.edit_own",
  "contacts.edit_others",
  "contacts.delete_own",
  "contacts.delete_others",
  "contacts.manage_persons",
  "contacts.manage_addresses",
  // US-TEAM-30 (D-235): the section opens for the Team.
  "catalog.open",
  "catalog.edit_own",
  "catalog.edit_others",
  "catalog.delete_own",
  "catalog.delete_others",
  // US-TEAM-30 (D-235): the section opens for the Team.
  "leads.open",
  "leads.edit_own",
  "leads.edit_others",
  "leads.delete_own",
  "leads.delete_others",
  "activities.edit_own",
  "activities.edit_others",
  "activities.delete_own",
  "activities.delete_others",
  // US-TEAM-30 (D-235): the section opens for the Team.
  "quotes.open",
  "quotes.edit_own",
  "quotes.edit_others",
  "quotes.delete_own",
  "quotes.delete_others",
  "quotes.send",
  "quotes.revise",
  "quotes.approve_discount",
  "quotes.accept_in_person",
  // US-TEAM-30 (D-235): the section opens for the Team.
  "invoices.open",
  "invoices.edit_own",
  "invoices.edit_others",
  "invoices.delete_own",
  "invoices.delete_others",
  "invoices.issue",
  "invoices.void",
  "invoices.send",
  "invoices.send_reminder",
  "invoices.manage_recurring",
  // US-TEAM-30 (D-235): the section opens for the Team.
  "payments.open",
  "payments.edit_own",
  "payments.edit_others",
  "payments.delete_own",
  "payments.delete_others",
  "payments.apply_credit",
  "payments.send_receipt",
  "payments.refund",
  // US-TEAM-30 (D-235): the section opens for the Team.
  "credit_notes.open",
  "credit_notes.edit_own",
  "credit_notes.edit_others",
  "credit_notes.delete_own",
  "credit_notes.delete_others",
  "credit_notes.issue",
  // US-TEAM-30 (D-235): the section opens for the Team.
  "expenses.view_others",
  "expenses.edit_own",
  "expenses.edit_others",
  "expenses.delete_own",
  "expenses.delete_others",
  "expenses.approve",
  "expenses.reject",
  "expenses.mark_billed",
  "expenses.bill_to_customer",
  "expense_categories.edit_own",
  "expense_categories.edit_others",
  "expense_categories.delete_own",
  "expense_categories.delete_others",
  // US-TEAM-30 (D-235): the section opens for the Team.
  "vendor_bills.open",
  "vendor_bills.edit_own",
  "vendor_bills.edit_others",
  "vendor_bills.delete_own",
  "vendor_bills.delete_others",
  "vendor_bills.record",
  "vendor_bills.void",
  "vendor_bills.manage_recurring",
  // US-TEAM-30 (D-235): the section opens for the Team.
  "vendor_credits.open",
  "vendor_credits.edit_own",
  "vendor_credits.edit_others",
  "vendor_credits.delete_own",
  "vendor_credits.delete_others",
  "vendor_credits.record",
  "vendor_credits.apply",
  "vendor_credits.void",
  // US-TEAM-30 (D-235): the section opens for the Team.
  "vendor_payments.open",
  "vendor_payments.edit_own",
  "vendor_payments.edit_others",
  "vendor_payments.delete_own",
  "vendor_payments.delete_others",
  // US-TEAM-30 (D-235): the section opens for the Team.
  "jobs.open",
  "jobs.edit_own",
  "jobs.edit_others",
  "jobs.release_retention",
  "jobs.assign",
  "milestones.edit_own",
  "milestones.edit_others",
  "milestones.invoice",
  "job_notes.edit_own",
  "job_notes.edit_others",
  "job_photos.edit_own",
  "job_photos.edit_others",
  "variation_orders.edit_own",
  "variation_orders.edit_others",
  "variation_orders.apply",
  // US-TEAM-30 (D-235): the section opens for the Team.
  "meetings.open",
  "meetings.edit_own",
  "meetings.edit_others",
  "meetings.delete_own",
  "meetings.delete_others",
  // US-AI-05 (D-167): the AI assistant, hidden while it's off (US-SET-24).
  "ai.use",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

export const capabilitySchema = z.enum(CAPABILITIES);

/**
 * Human-facing copy for the matrix UI, keyed by capability id so it can
 * never list a capability that CAPABILITIES doesn't also define. `group`
 * is a UI-only grouping key (not enforced server-side, not read by
 * CapabilityGuard) — the privilege-matrix UI nests capabilities sharing a
 * `group` under one collapsible header with a "toggle all" switch, per
 * PRD §9 S-01.15/S-02.5's UI acceptance criteria. Capabilities with no
 * `group` render as their own top-level row, same as before this existed.
 */
export const CAPABILITY_LABELS: Record<Capability, { label: string; description: string; group?: string }> = {
  "reports.view_dashboard_summary": {
    label: "View dashboard summary",
    description: "The KPI row (cash position, receivables, overdue count, month revenue) — P&L/Balance Sheet stay Owner-only regardless of this grant.",
    group: "Reports & Ledger",
  },
  "reports.view_receivables": {
    label: "View receivables",
    description: "AR aging — who owes the org money and for how long.",
    group: "Reports & Ledger",
  },
  "reports.view_payables": {
    label: "View payables",
    description: "AP aging — what the org owes vendors and for how long.",
    group: "Reports & Ledger",
  },
  "reports.view_job_profitability": {
    label: "View job profitability",
    description: "Revenue, cost, and margin across every job.",
    group: "Reports & Ledger",
  },
  "reports.view_financial_statements": {
    label: "View financial statements",
    description: "Read Profit & Loss, Balance Sheet, Trial Balance, Cash Flow, Tax Summary and the sales and purchase reports. Grants nothing that writes.",
    group: "Reports & Ledger",
  },
  "ledger.view": {
    label: "View ledger / journals",
    description: "Drill into the journal entries behind a P&L/Balance Sheet figure. P&L, Balance Sheet, revenue trend, and tax summary themselves stay Owner-only regardless of this grant — this only covers the drill-down into raw journal entries.",
    group: "Reports & Ledger",
  },
  "banking.view": {
    label: "View bank balances and registers",
    description: "Banking: each bank, cash and card account's balance and what moved through it. Without it, payment forms still list the account names (no balances).",
    group: "Banking",
  },
  "banking.record": {
    label: "Record transfers and other money in or out",
    description: "Move money between accounts and record money in or out that no invoice, bill or payment covers.",
    group: "Banking",
  },
  "banking.reconcile": {
    label: "Reconcile accounts",
    description: "Import bank statements, match them to Spine's entries, and finish or undo reconciliations. Needs View bank balances and registers.",
    group: "Banking",
  },
  "contacts.open": {
    label: "Open Contacts",
    description: "See the Contacts section and every contact's page. Off: Contacts leaves the sidebar and its pages say there's no access; forms elsewhere still list contacts by name.",
    group: "Manage Contacts",
  },
  "contacts.edit_own": {
    label: "Create/edit own contacts",
    description:
      "Create new contacts, and edit ones this user created themselves. Viewing every contact in the org, including ones created by others, needs no capability at all — read is always unconditional.",
    group: "Manage Contacts",
  },
  "contacts.edit_others": {
    label: "Edit others' contacts",
    description: "Edit a contact that a different user created.",
    group: "Manage Contacts",
  },
  "contacts.delete_own": {
    label: "Archive/delete own contacts",
    description: "Archive, restore, or delete a contact this user created themselves.",
    group: "Manage Contacts",
  },
  "contacts.delete_others": {
    label: "Archive/delete others' contacts",
    description: "Archive, restore, or delete a contact that a different user created.",
    group: "Manage Contacts",
  },
  "contacts.manage_persons": {
    label: "Manage contact persons",
    description: "Add, edit or remove the people at a contact (name, title, email, phone), on any contact. They also need permission to edit the contact itself.",
    group: "Manage Contacts",
  },
  "contacts.manage_addresses": {
    label: "Manage contact addresses",
    description: "Add, edit or remove a contact's addresses, on any contact. They also need permission to edit the contact itself.",
    group: "Manage Contacts",
  },
  "catalog.open": {
    label: "Open Catalogue",
    description: "See the Catalogue section and its items and bundles. Off: it leaves the sidebar; quote, invoice and bill lines still pick items.",
    group: "Manage Catalogue",
  },
  "catalog.edit_own": {
    label: "Create/edit own catalogue",
    description:
      "Create new catalogue items, and edit ones this user created themselves. Viewing every catalogue item in the org, including ones created by others, needs no capability at all — read is always unconditional.",
    group: "Manage Catalogue",
  },
  "catalog.edit_others": {
    label: "Edit others' catalogue",
    description: "Edit a catalogue item that a different user created.",
    group: "Manage Catalogue",
  },
  "catalog.delete_own": {
    label: "Archive/delete own catalogue",
    description: "Archive, restore, or delete a catalogue item this user created themselves.",
    group: "Manage Catalogue",
  },
  "catalog.delete_others": {
    label: "Archive/delete others' catalogue",
    description: "Archive, restore, or delete a catalogue item that a different user created.",
    group: "Manage Catalogue",
  },
  "leads.open": {
    label: "Open Pipeline",
    description: "See the Pipeline board and its leads. Off: Pipeline leaves the sidebar and its pages say there's no access.",
    group: "Manage Leads",
  },
  "leads.edit_own": {
    label: "Create/edit own leads",
    description:
      "Create new leads, and edit ones this user created themselves. Viewing every lead in the org, including ones created by others, needs no capability at all — read is always unconditional. \"Own\" is based on who created the lead, not the lead's assigned pipeline owner — those can differ.",
    group: "Manage Leads",
  },
  "leads.edit_others": {
    label: "Edit others' leads",
    description: "Edit a lead that a different user created.",
    group: "Manage Leads",
  },
  "leads.delete_own": {
    label: "Delete own leads",
    description: "Delete a lead this user created themselves.",
    group: "Manage Leads",
  },
  "leads.delete_others": {
    label: "Delete others' leads",
    description: "Delete a lead that a different user created.",
    group: "Manage Leads",
  },
  "activities.edit_own": {
    label: "Create/edit own activities",
    description:
      "Log a new call/site visit/note/task, and edit or mark done/undone ones this user logged themselves. Viewing every activity in the org, including ones logged by others, needs no capability at all — read is always unconditional. \"Own\" is based on who logged the activity, not who it's assigned to — those can differ.",
    group: "Manage Activities",
  },
  "activities.edit_others": {
    label: "Edit others' activities",
    description: "Edit, or mark done/undone, an activity that a different user logged.",
    group: "Manage Activities",
  },
  "activities.delete_own": {
    label: "Delete own activities",
    description: "Delete an activity this user logged themselves.",
    group: "Manage Activities",
  },
  "activities.delete_others": {
    label: "Delete others' activities",
    description: "Delete an activity that a different user logged.",
    group: "Manage Activities",
  },
  "quotes.open": {
    label: "Open Quotes",
    description: "See the Quotes section and its quotes. Off: Quotes leaves the sidebar and its pages say there's no access; other pages name a quote without linking it.",
    group: "Manage Quotes",
  },
  "quotes.edit_own": {
    label: "Create/edit own quotes",
    description:
      "Create new quotes, and edit ones this user created themselves (only a draft quote can ever be edited — a sent quote is immutable regardless of this grant). Viewing every quote in the org, including ones created by others, needs no capability at all — read is always unconditional.",
    group: "Manage Quotes",
  },
  "quotes.edit_others": {
    label: "Edit others' quotes",
    description: "Edit a draft quote that a different user created.",
    group: "Manage Quotes",
  },
  "quotes.delete_own": {
    label: "Delete own quotes",
    description: "Delete a draft quote this user created themselves (only a draft is ever deletable).",
    group: "Manage Quotes",
  },
  "quotes.delete_others": {
    label: "Delete others' quotes",
    description: "Delete a draft quote that a different user created.",
    group: "Manage Quotes",
  },
  "quotes.send": {
    label: "Send a quote",
    description: "Send a draft quote: it gets its number and is emailed to the customer. Sending can't be undone, so it's separate from editing.",
    group: "Manage Quotes",
  },
  "quotes.revise": {
    label: "Revise a quote",
    description: "Create a new draft version of a sent quote.",
    group: "Manage Quotes",
  },
  "quotes.approve_discount": {
    label: "Approve quote above discount threshold",
    description: "Approve a quote whose discount exceeds the org's configured threshold.",
    group: "Manage Quotes",
  },
  "quotes.accept_in_person": {
    label: "Accept a quote in person",
    description: "Show a quote on a phone or tablet and record the customer's acceptance with their signature, on site.",
    group: "Manage Quotes",
  },
  "invoices.open": {
    label: "Open Invoices",
    description: "See the Invoices section and its invoices. Off: Invoices leaves the sidebar; recording a payment still lists the customer's invoices to allocate.",
    group: "Manage Invoices",
  },
  "invoices.edit_own": {
    label: "Create/edit own invoices",
    description:
      "Create a new invoice (including converting an accepted quote), and edit ones this user created themselves (only a draft can be edited). Viewing every invoice needs no capability at all — read is always unconditional.",
    group: "Manage Invoices",
  },
  "invoices.edit_others": {
    label: "Edit others' invoices",
    description: "Edit a draft invoice that a different user created.",
    group: "Manage Invoices",
  },
  "invoices.delete_own": {
    label: "Delete own invoices",
    description: "Delete a draft invoice this user created themselves.",
    group: "Manage Invoices",
  },
  "invoices.delete_others": {
    label: "Delete others' invoices",
    description: "Delete a draft invoice that a different user created.",
    group: "Manage Invoices",
  },
  "invoices.issue": {
    label: "Issue an invoice",
    description: "Issue a draft invoice: it gets its number and is posted to the books. Issuing can't be undone, so it's separate from editing.",
    group: "Manage Invoices",
  },
  "invoices.void": {
    label: "Void an invoice",
    description: "Reverse an issued invoice's journal entry with a required reason.",
    group: "Manage Invoices",
  },
  "invoices.send": {
    label: "Email an invoice",
    description: "Queue the invoice PDF to be emailed to its contact.",
    group: "Manage Invoices",
  },
  "invoices.send_reminder": {
    label: "Send a payment reminder",
    description: "Send a one-click payment reminder email for an overdue invoice.",
    group: "Manage Invoices",
  },
  "invoices.manage_recurring": {
    label: "Manage recurring invoices",
    description: "See, set up, change, pause and delete recurring invoices — schedules that create and can issue invoices automatically.",
    group: "Manage Invoices",
  },
  "payments.open": {
    label: "Open Payments",
    description: "See the Payments section and its payments. Off: Payments leaves the sidebar and its pages say there's no access.",
    group: "Manage Payments",
  },
  "payments.edit_own": {
    label: "Record own payments",
    description:
      "Record a new payment, optionally allocating it across invoices. There is no edit route for payments — this capability only gates creation. Viewing every payment needs no capability at all — read is always unconditional.",
    group: "Manage Payments",
  },
  "payments.edit_others": {
    label: "(Reserved — no others-editable action exists for payments yet)",
    description: "Payments have no update route at all today, so this capability currently has nothing to gate — kept for shape-consistency with every other resource in this pattern, in case an edit action is added later.",
    group: "Manage Payments",
  },
  "payments.delete_own": {
    label: "Delete own payments",
    description: "Delete a payment this user created themselves (only possible while it has zero allocation).",
    group: "Manage Payments",
  },
  "payments.delete_others": {
    label: "Delete others' payments",
    description: "Delete a payment that a different user created (only possible while it has zero allocation).",
    group: "Manage Payments",
  },
  "payments.apply_credit": {
    label: "Apply payment credit",
    description: "Apply an existing payment's sitting unallocated credit against one or more invoices — a workflow action, not an edit to the payment itself.",
    group: "Manage Payments",
  },
  "payments.send_receipt": {
    label: "Re-send a receipt",
    description: "Re-send a payment's receipt PDF to the paying contact on demand.",
    group: "Manage Payments",
  },
  "payments.refund": {
    label: "Refund customers",
    description: "Pay a customer back out of their credit — an unallocated payment or a credit note's excess. Money leaves the bank, so it's its own right.",
    group: "Manage Payments",
  },
  "credit_notes.open": {
    label: "Open Credit Notes",
    description: "See the Credit Notes section and its credit notes. Off: Credit Notes leaves the sidebar and its pages say there's no access.",
    group: "Manage Credit Notes",
  },
  "credit_notes.edit_own": {
    label: "Create/edit own credit notes",
    description:
      "Create a new credit note, and edit ones this user created themselves (only a draft can be edited). Viewing every credit note needs no capability at all — read is always unconditional.",
    group: "Manage Credit Notes",
  },
  "credit_notes.edit_others": {
    label: "Edit others' credit notes",
    description: "Edit a draft credit note that a different user created.",
    group: "Manage Credit Notes",
  },
  "credit_notes.delete_own": {
    label: "Delete own credit notes",
    description: "Delete a draft credit note this user created themselves.",
    group: "Manage Credit Notes",
  },
  "credit_notes.delete_others": {
    label: "Delete others' credit notes",
    description: "Delete a draft credit note that a different user created.",
    group: "Manage Credit Notes",
  },
  "credit_notes.issue": {
    label: "Issue a credit note",
    description: "Issue a draft credit note: it gets its number and is posted to the books. Issuing can't be undone, so it's separate from editing.",
    group: "Manage Credit Notes",
  },
  "expenses.view_others": {
    label: "See everyone's expenses",
    description: "See every expense in the business. Off: Expenses shows only their own, which they can always record and see.",
    group: "Manage Expenses",
  },
  "expenses.edit_own": {
    label: "Submit/edit own expenses",
    description:
      "Submit a new expense, and edit ones this user submitted themselves (only a submitted, not-yet-approved expense can be edited). Field users always have this for their own expenses, regardless of Team grants — Field is fixed/non-configurable and this preserves the pre-existing \"field can submit and edit their own expenses\" behavior. Viewing every expense in the org, including ones submitted by others, needs no capability at all — read is always unconditional.",
    group: "Manage Expenses",
  },
  "expenses.edit_others": {
    label: "Edit others' expenses",
    description: "Edit a submitted expense that a different user submitted. Staff/Owner only — Field has no path to another user's expense.",
    group: "Manage Expenses",
  },
  "expenses.delete_own": {
    label: "Delete own expenses",
    description: "Delete an expense they submitted, while it's still waiting for approval. Field crew can always do this for their own expenses.",
    group: "Manage Expenses",
  },
  "expenses.delete_others": {
    label: "Delete others' expenses",
    description: "Delete a submitted expense that a different user submitted.",
    group: "Manage Expenses",
  },
  "expenses.approve": {
    label: "Approve expense",
    description: "Approve a submitted expense — an approver acting on someone else's submission, not an ownership question, so this stays a single capability rather than own/others.",
    group: "Manage Expenses",
  },
  "expenses.reject": {
    label: "Reject expense",
    description: "Reject a submitted expense.",
    group: "Manage Expenses",
  },
  "expenses.mark_billed": {
    label: "Mark expense as billed",
    description: "Link an approved expense to an existing invoice line as billed.",
    group: "Manage Expenses",
  },
  "expenses.bill_to_customer": {
    label: "Bill expense to customer",
    description: "Create a new draft invoice for an approved expense's job contact and mark it billed in one action.",
    group: "Manage Expenses",
  },
  "expense_categories.edit_own": {
    label: "Create/edit own expense categories",
    description:
      "Create a new expense category, and edit ones this user created themselves. Viewing every category needs no capability at all — read is always unconditional.",
    group: "Manage Expense Categories",
  },
  "expense_categories.edit_others": {
    label: "Edit others' expense categories",
    description: "Edit an expense category that a different user created.",
    group: "Manage Expense Categories",
  },
  "expense_categories.delete_own": {
    label: "Archive/delete own expense categories",
    description: "Archive, restore, or delete an expense category this user created themselves.",
    group: "Manage Expense Categories",
  },
  "expense_categories.delete_others": {
    label: "Archive/delete others' expense categories",
    description: "Archive, restore, or delete an expense category that a different user created.",
    group: "Manage Expense Categories",
  },
  "vendor_bills.open": {
    label: "Open Vendor Bills",
    description: "See the Vendor Bills section and its bills. Off: it leaves the sidebar; paying a vendor still lists their bills to allocate.",
    group: "Manage Vendor Bills",
  },
  "vendor_bills.edit_own": {
    label: "Create/edit own vendor bills",
    description:
      "Create a new vendor bill, and edit ones this user created themselves (only a draft can be edited). Viewing every vendor bill needs no capability at all — read is always unconditional.",
    group: "Manage Vendor Bills",
  },
  "vendor_bills.edit_others": {
    label: "Edit others' vendor bills",
    description: "Edit a draft vendor bill that a different user created.",
    group: "Manage Vendor Bills",
  },
  "vendor_bills.delete_own": {
    label: "Delete own vendor bills",
    description: "Delete a draft vendor bill this user created themselves.",
    group: "Manage Vendor Bills",
  },
  "vendor_bills.delete_others": {
    label: "Delete others' vendor bills",
    description: "Delete a draft vendor bill that a different user created.",
    group: "Manage Vendor Bills",
  },
  "vendor_bills.record": {
    label: "Record a vendor bill",
    description: "Record a draft vendor bill in the books. This can't be undone, so it's separate from editing.",
    group: "Manage Vendor Bills",
  },
  "vendor_bills.void": {
    label: "Void a vendor bill",
    description: "Reverse a recorded vendor bill's journal entry.",
    group: "Manage Vendor Bills",
  },
  "vendor_bills.manage_recurring": {
    label: "Manage recurring bills",
    description: "See, set up, change, pause and delete recurring bills — schedules that create, and can record, vendor bills automatically.",
    group: "Manage Vendor Bills",
  },
  "vendor_credits.open": {
    label: "Open Vendor Credits",
    description: "See the Vendor Credits section and its credits. Off: Vendor Credits leaves the sidebar and its pages say there's no access.",
    group: "Vendor credits",
  },
  "vendor_credits.edit_own": {
    label: "Create/edit own vendor credits",
    description: "Create vendor credit drafts, and edit drafts this user created.",
    group: "Vendor credits",
  },
  "vendor_credits.edit_others": {
    label: "Edit others' vendor credits",
    description: "Edit a draft vendor credit someone else created.",
    group: "Vendor credits",
  },
  "vendor_credits.delete_own": {
    label: "Delete own draft vendor credits",
    description: "Delete a draft vendor credit this user created.",
    group: "Vendor credits",
  },
  "vendor_credits.delete_others": {
    label: "Delete others' draft vendor credits",
    description: "Delete a draft vendor credit someone else created.",
    group: "Vendor credits",
  },
  "vendor_credits.record": {
    label: "Record vendor credits",
    description: "Record a draft so it lowers what's owed to the vendor (posts to the ledger).",
    group: "Vendor credits",
  },
  "vendor_credits.apply": {
    label: "Apply and refund vendor credits",
    description: "Use a vendor credit against the vendor's bills, or record the refund they paid back.",
    group: "Vendor credits",
  },
  "vendor_credits.void": {
    label: "Void vendor credits",
    description: "Void a recorded vendor credit that has nothing applied or refunded.",
    group: "Vendor credits",
  },
  "vendor_payments.open": {
    label: "Open Vendor Payments",
    description: "See the Vendor Payments section and its payments. Off: Vendor Payments leaves the sidebar and its pages say there's no access.",
    group: "Manage Vendor Payments",
  },
  "vendor_payments.edit_own": {
    label: "Create own vendor payments",
    description:
      "Record a new payment to a vendor. There is no edit route for vendor payments — this capability only gates creation. Viewing every vendor payment needs no capability at all — read is always unconditional.",
    group: "Manage Vendor Payments",
  },
  "vendor_payments.edit_others": {
    label: "(Reserved — no others-editable action exists for vendor payments yet)",
    description: "Vendor payments have no update route at all today, so this capability currently has nothing to gate — kept for shape-consistency with every other resource in this pattern, in case an edit action is added later.",
    group: "Manage Vendor Payments",
  },
  "vendor_payments.delete_own": {
    label: "Delete own vendor payments",
    description: "Delete a vendor payment this user created themselves (only possible while it has zero allocation).",
    group: "Manage Vendor Payments",
  },
  "vendor_payments.delete_others": {
    label: "Delete others' vendor payments",
    description: "Delete a vendor payment that a different user created (only possible while it has zero allocation).",
    group: "Manage Vendor Payments",
  },
  "jobs.open": {
    label: "Open Jobs",
    description: "See the Jobs section and every job's page. Off: Jobs leaves the sidebar; expenses and bills still pick a job.",
    group: "Manage Jobs",
  },
  "jobs.edit_own": {
    label: "Create/edit own jobs",
    description:
      "Create a new job, and edit ones this user created themselves. Viewing every job in the org, including ones created by others, needs no capability at all — read is always unconditional. There is no delete action for jobs in v1.",
    group: "Manage Jobs",
  },
  "jobs.edit_others": {
    label: "Edit others' jobs",
    description: "Edit a job that a different user created.",
    group: "Manage Jobs",
  },
  "jobs.release_retention": {
    label: "Release retention",
    description: "Release a job's retention as a final invoice. This can't be undone, so it's separate from editing.",
    group: "Manage Jobs",
  },
  "jobs.assign": {
    label: "Assign crew to a job",
    description: "Add field crew to a job or take them off it. Crew see the jobs they're assigned to on their phone.",
    group: "Manage Jobs",
  },
  "milestones.edit_own": {
    label: "Define/edit own milestones",
    description: "Set up a job's milestones and mark them complete, where they set the milestones up. Field crew can always mark milestones complete.",
    group: "Manage Jobs",
  },
  "milestones.edit_others": {
    label: "Edit others' milestones",
    description: "Set up, change or complete milestones that someone else set up. Field crew can always mark milestones complete.",
    group: "Manage Jobs",
  },
  "milestones.invoice": {
    label: "Raise invoice from milestone",
    description: "Raise a progress invoice directly from a completed milestone — a billing action, not an edit.",
    group: "Manage Jobs",
  },
  "job_notes.edit_own": {
    label: "Add own job notes",
    description: "Add a note to a job. There is no edit/delete action for job notes in v1 — this only gates creating one.",
    group: "Manage Jobs",
  },
  "job_notes.edit_others": {
    label: "(Reserved — no others-editable action exists for job notes yet)",
    description: "Job notes have no update/delete route at all today, so this capability currently has nothing to gate — kept for shape-consistency with every other resource in this pattern, in case an edit action is added later.",
    group: "Manage Jobs",
  },
  "job_photos.edit_own": {
    label: "Add own job photos",
    description: "Attach a site photo to a job. There is no edit/delete action for job photos in v1 — this only gates adding one.",
    group: "Manage Jobs",
  },
  "job_photos.edit_others": {
    label: "(Reserved — no others-editable action exists for job photos yet)",
    description: "Job photos have no update/delete route at all today, so this capability currently has nothing to gate — kept for shape-consistency with every other resource in this pattern, in case an edit action is added later.",
    group: "Manage Jobs",
  },
  "variation_orders.edit_own": {
    label: "Create own variation orders",
    description: "Raise a variation order against a job. There is no edit/delete action for variation orders in v1 — this only gates creating one.",
    group: "Manage Jobs",
  },
  "variation_orders.edit_others": {
    label: "(Reserved — no others-editable action exists for variation orders yet)",
    description: "Variation orders have no update/delete route at all today, so this capability currently has nothing to gate — kept for shape-consistency with every other resource in this pattern, in case an edit action is added later.",
    group: "Manage Jobs",
  },
  "variation_orders.apply": {
    label: "Apply variation order",
    description: "Fold an accepted variation order's total into a job's contract value — a one-way billing action, not an edit.",
    group: "Manage Jobs",
  },
  "meetings.open": {
    label: "Open Meetings",
    description: "See the Meetings calendar and its meetings. Off: Meetings leaves the sidebar and its pages say there's no access.",
    group: "Manage Meetings",
  },
  "meetings.edit_own": {
    label: "Create/edit own meetings",
    description:
      "Create new meetings, and edit ones this user organizes themselves (invite attendees, change time/details). \"Own\" is based on who organizes the meeting. Whether a user can SEE a given meeting at all is a separate, unconditional check — that meeting's own visibility (private/org) and invite list, independent of this grant.",
    group: "Manage Meetings",
  },
  "meetings.edit_others": {
    label: "Edit others' meetings",
    description: "Edit a meeting that a different user organizes.",
    group: "Manage Meetings",
  },
  "meetings.delete_own": {
    label: "Delete own meetings",
    description: "Delete a meeting this user organizes themselves.",
    group: "Manage Meetings",
  },
  "meetings.delete_others": {
    label: "Delete others' meetings",
    description: "Delete a meeting that a different user organizes.",
    group: "Manage Meetings",
  },
  "ai.use": {
    label: "Use AI features",
    description:
      "Read bills and receipts, draft customer emails and quote lines, and get bank match suggestions — only where they can already work, and only the features switched on in Settings › AI assistant.",
    group: "AI assistant",
  },
};

/** Every fresh org seeds one team with this name and these grants. */
export const DEFAULT_TEAM_NAME = "General Staff";

export const DEFAULT_TEAM_GRANTS: Record<Capability, boolean> = {
  "contacts.open": true,
  "catalog.open": true,
  "leads.open": true,
  "quotes.open": true,
  "invoices.open": true,
  "payments.open": true,
  "credit_notes.open": true,
  "expenses.view_others": true,
  "vendor_bills.open": true,
  "vendor_credits.open": true,
  "vendor_payments.open": true,
  "jobs.open": true,
  "meetings.open": true,
  "reports.view_dashboard_summary": true,
  "reports.view_receivables": true,
  "reports.view_payables": true,
  "reports.view_job_profitability": true,
  "ledger.view": false,
  "reports.view_financial_statements": false,
  "banking.view": false,
  "banking.record": false,
  "banking.reconcile": false,
  "contacts.edit_own": true,
  "contacts.edit_others": true,
  "contacts.delete_own": true,
  "contacts.delete_others": true,
  "contacts.manage_persons": true,
  "contacts.manage_addresses": true,
  "catalog.edit_own": true,
  "catalog.edit_others": true,
  "catalog.delete_own": true,
  "catalog.delete_others": true,
  "leads.edit_own": true,
  "leads.edit_others": true,
  "leads.delete_own": true,
  "leads.delete_others": true,
  "activities.edit_own": true,
  "activities.edit_others": true,
  "activities.delete_own": true,
  "activities.delete_others": true,
  "quotes.edit_own": true,
  "quotes.edit_others": true,
  "quotes.delete_own": true,
  "quotes.delete_others": true,
  "quotes.send": true,
  "quotes.revise": true,
  "quotes.approve_discount": false,
  "quotes.accept_in_person": true,
  "invoices.edit_own": true,
  "invoices.edit_others": true,
  "invoices.delete_own": true,
  "invoices.delete_others": true,
  "invoices.issue": true,
  "invoices.void": true,
  "invoices.send": true,
  "invoices.send_reminder": true,
  "invoices.manage_recurring": true,
  "payments.edit_own": true,
  "payments.edit_others": true,
  "payments.delete_own": true,
  "payments.delete_others": true,
  "payments.apply_credit": true,
  "payments.send_receipt": true,
  "payments.refund": false,
  "credit_notes.edit_own": true,
  "credit_notes.edit_others": true,
  "credit_notes.delete_own": true,
  "credit_notes.delete_others": true,
  "credit_notes.issue": true,
  "expenses.edit_own": true,
  "expenses.edit_others": true,
  "expenses.delete_own": true,
  "expenses.delete_others": true,
  "expenses.approve": true,
  "expenses.reject": true,
  "expenses.mark_billed": true,
  "expenses.bill_to_customer": true,
  "expense_categories.edit_own": true,
  "expense_categories.edit_others": true,
  "expense_categories.delete_own": true,
  "expense_categories.delete_others": true,
  "vendor_bills.edit_own": true,
  "vendor_bills.edit_others": true,
  "vendor_bills.delete_own": true,
  "vendor_bills.delete_others": true,
  "vendor_bills.record": true,
  "vendor_bills.void": true,
  "vendor_bills.manage_recurring": true,
  "vendor_credits.edit_own": true,
  "vendor_credits.edit_others": true,
  "vendor_credits.delete_own": true,
  "vendor_credits.delete_others": true,
  "vendor_credits.record": true,
  "vendor_credits.apply": true,
  "vendor_credits.void": true,
  "vendor_payments.edit_own": true,
  "vendor_payments.edit_others": true,
  "vendor_payments.delete_own": true,
  "vendor_payments.delete_others": true,
  "jobs.edit_own": true,
  "jobs.edit_others": true,
  "jobs.release_retention": true,
  "jobs.assign": true,
  "milestones.edit_own": true,
  "milestones.edit_others": true,
  "milestones.invoice": true,
  "job_notes.edit_own": true,
  "job_notes.edit_others": true,
  "job_photos.edit_own": true,
  "job_photos.edit_others": true,
  "variation_orders.edit_own": true,
  "variation_orders.edit_others": true,
  "variation_orders.apply": true,
  "meetings.edit_own": true,
  "meetings.edit_others": true,
  "meetings.delete_own": true,
  "meetings.delete_others": true,
  // US-AI-05 (D-167): an Owner chooses who uses AI.
  "ai.use": false,
};

/**
 * Capabilities that only make sense with another one (US-BANK-12). Granting
 * the first grants what it needs; revoking a needed one revokes what
 * depends on it. Applied by the API when a Team's privileges are saved, so
 * the matrix and the guard never disagree.
 */
/** US-TEAM-30 (D-235) — the Open permission each section's actions need, by capability prefix. */
const OPEN_FOR_PREFIX: Record<string, { open: Capability; section: string }> = {
  contacts: { open: "contacts.open", section: "Contacts" },
  activities: { open: "contacts.open", section: "Contacts" },
  catalog: { open: "catalog.open", section: "Catalogue" },
  leads: { open: "leads.open", section: "Pipeline" },
  quotes: { open: "quotes.open", section: "Quotes" },
  invoices: { open: "invoices.open", section: "Invoices" },
  payments: { open: "payments.open", section: "Payments" },
  credit_notes: { open: "credit_notes.open", section: "Credit Notes" },
  vendor_bills: { open: "vendor_bills.open", section: "Vendor Bills" },
  vendor_credits: { open: "vendor_credits.open", section: "Vendor Credits" },
  vendor_payments: { open: "vendor_payments.open", section: "Vendor Payments" },
  jobs: { open: "jobs.open", section: "Jobs" },
  milestones: { open: "jobs.open", section: "Jobs" },
  job_notes: { open: "jobs.open", section: "Jobs" },
  job_photos: { open: "jobs.open", section: "Jobs" },
  variation_orders: { open: "jobs.open", section: "Jobs" },
  meetings: { open: "meetings.open", section: "Meetings" },
};

/** Expenses: a person's own are always theirs; acting on anyone else's needs to see them. */
const NEEDS_EVERYONES_EXPENSES: Capability[] = ["expenses.edit_others", "expenses.delete_others", "expenses.approve", "expenses.reject", "expenses.mark_billed", "expenses.bill_to_customer"];

/** The Open permission (or "See everyone's expenses") a capability needs, if any. */
function openRule(capability: Capability): { requires: Capability[]; reason: string } | undefined {
  if (NEEDS_EVERYONES_EXPENSES.includes(capability)) return { requires: ["expenses.view_others"], reason: "Acting on other people's expenses needs seeing everyone's." };
  const rule = OPEN_FOR_PREFIX[capability.split(".")[0]!];
  if (!rule || rule.open === capability) return undefined;
  return { requires: [rule.open], reason: `Working in ${rule.section} needs ${rule.section} open.` };
}

export const CAPABILITY_REQUIRES: Partial<Record<Capability, { requires: Capability[]; reason: string }>> = {
  "banking.reconcile": { requires: ["banking.view"], reason: "Reconciling needs to see the account." },
  ...Object.fromEntries(CAPABILITIES.map((c) => [c, openRule(c)]).filter(([, rule]) => rule)),
};

/** US-TEAM-32 — each section's Open permission and its label, in sidebar order. */
export const SECTION_OPEN_CAPABILITIES: { href: string; section: string; capability: Capability }[] = [
  { href: "/contacts", section: "Contacts", capability: "contacts.open" },
  { href: "/leads", section: "Pipeline", capability: "leads.open" },
  { href: "/meetings", section: "Meetings", capability: "meetings.open" },
  { href: "/catalog", section: "Catalogue", capability: "catalog.open" },
  { href: "/quotes", section: "Quotes", capability: "quotes.open" },
  { href: "/jobs", section: "Jobs", capability: "jobs.open" },
  { href: "/invoices", section: "Invoices", capability: "invoices.open" },
  { href: "/credit-notes", section: "Credit Notes", capability: "credit_notes.open" },
  { href: "/payments", section: "Payments", capability: "payments.open" },
  { href: "/vendor-bills", section: "Vendor Bills", capability: "vendor_bills.open" },
  { href: "/vendor-credits", section: "Vendor Credits", capability: "vendor_credits.open" },
  { href: "/expenses", section: "Expenses", capability: "expenses.view_others" },
  { href: "/vendor-payments", section: "Vendor Payments", capability: "vendor_payments.open" },
];

/** The privilege changes to save once implied ones are added (US-BANK-12). An explicit change in the same request wins. */
export function withImpliedPrivileges(changes: { capability: Capability; granted: boolean }[]): { capability: Capability; granted: boolean }[] {
  const result = new Map(changes.map((c) => [c.capability, c.granted]));
  const explicit = new Set(changes.map((c) => c.capability));
  for (const { capability, granted } of changes) {
    if (granted) {
      for (const needed of CAPABILITY_REQUIRES[capability]?.requires ?? []) if (!explicit.has(needed)) result.set(needed, true);
    } else {
      for (const [dependent, rule] of Object.entries(CAPABILITY_REQUIRES) as [Capability, { requires: Capability[] }][]) {
        if (rule.requires.includes(capability) && !explicit.has(dependent)) result.set(dependent, false);
      }
    }
  }
  return [...result.entries()].map(([capability, granted]) => ({ capability, granted }));
}

/**
 * US-TEAM-20 — how many permissions of each group someone has, in the
 * order the Team matrix lists them; ungrouped ones count under "Other".
 */
export function capabilityGroupCounts(capabilities: Partial<Record<string, boolean>>): { group: string; granted: number; total: number }[] {
  const groups = new Map<string, { granted: number; total: number }>();
  for (const capability of CAPABILITIES) {
    const group = CAPABILITY_LABELS[capability].group ?? "Other";
    const entry = groups.get(group) ?? { granted: 0, total: 0 };
    entry.total += 1;
    if (capabilities[capability] === true) entry.granted += 1;
    groups.set(group, entry);
  }
  return [...groups.entries()].map(([group, counts]) => ({ group, ...counts }));
}
