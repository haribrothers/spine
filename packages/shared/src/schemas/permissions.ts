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
  "expenses.submit",
  "expenses.approve",
  "purchases.manage",
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
  "expenses.submit": {
    label: "Submit expense",
    description: "Submit an expense for approval.",
  },
  "expenses.approve": {
    label: "Approve expense",
    description: "Approve a submitted expense.",
  },
  "purchases.manage": {
    label: "Record vendor bills, pay vendors",
    description: "Record vendor bills and record payments to vendors.",
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
  "expenses.submit": true,
  "expenses.approve": true,
  "purchases.manage": true,
  "jobs.update_milestones": true,
  "meetings.edit_own": true,
  "meetings.edit_others": true,
  "meetings.delete_own": true,
  "meetings.delete_others": true,
  "ledger.view": false,
};
