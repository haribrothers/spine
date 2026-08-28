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
  "dashboard.view",
  "contacts.edit_own",
  "contacts.edit_others",
  "contacts.delete_own",
  "contacts.delete_others",
  "catalog.edit_own",
  "catalog.edit_others",
  "catalog.delete_own",
  "catalog.delete_others",
  "leads.edit_own",
  "leads.edit_others",
  "leads.delete_own",
  "leads.delete_others",
  "activities.edit_own",
  "activities.edit_others",
  "activities.delete_own",
  "activities.delete_others",
  "quotes.edit_own",
  "quotes.edit_others",
  "quotes.delete_own",
  "quotes.delete_others",
  "quotes.send",
  "quotes.revise",
  "quotes.approve_discount",
  "invoices.manage",
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
  "vendor_bills.edit_own",
  "vendor_bills.edit_others",
  "vendor_bills.delete_own",
  "vendor_bills.delete_others",
  "vendor_bills.record",
  "vendor_bills.void",
  "vendor_payments.edit_own",
  "vendor_payments.edit_others",
  "vendor_payments.delete_own",
  "vendor_payments.delete_others",
  "jobs.update_milestones",
  "meetings.edit_own",
  "meetings.edit_others",
  "meetings.delete_own",
  "meetings.delete_others",
  "ledger.view",
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
  "dashboard.view": {
    label: "View dashboard & reports",
    description: "Receivables and their own activity — P&L/balance sheet stay Owner-only regardless of this grant.",
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
    description: "Issue a draft quote (allocates its number and emails it to the contact) — a one-way transition, not an edit, so it's gated separately from edit_own/edit_others.",
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
  },
  "invoices.manage": {
    label: "Create invoices, record payments",
    description: "Issue invoices and record payments.",
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
    description: "Delete a submitted expense this user submitted themselves. Field users always have this for their own expenses, same as edit_own.",
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
    description: "Post a draft vendor bill to the ledger — a one-way transition, not an edit, so it's gated separately from edit_own/edit_others.",
    group: "Manage Vendor Bills",
  },
  "vendor_bills.void": {
    label: "Void a vendor bill",
    description: "Reverse a recorded vendor bill's journal entry.",
    group: "Manage Vendor Bills",
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
  "jobs.update_milestones": {
    label: "Upload site photos, update milestone status",
    description: "Attach job photos/notes and update milestone status.",
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
  "ledger.view": {
    label: "View ledger / journals",
    description: "View journal entries and drill into source documents.",
  },
};

/** Every fresh org seeds one team with this name and these grants. */
export const DEFAULT_TEAM_NAME = "General Staff";

export const DEFAULT_TEAM_GRANTS: Record<Capability, boolean> = {
  "dashboard.view": true,
  "contacts.edit_own": true,
  "contacts.edit_others": true,
  "contacts.delete_own": true,
  "contacts.delete_others": true,
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
  "invoices.manage": true,
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
  "vendor_payments.edit_own": true,
  "vendor_payments.edit_others": true,
  "vendor_payments.delete_own": true,
  "vendor_payments.delete_others": true,
  "jobs.update_milestones": true,
  "meetings.edit_own": true,
  "meetings.edit_others": true,
  "meetings.delete_own": true,
  "meetings.delete_others": true,
  "ledger.view": false,
};
