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
  "leads.manage",
  "quotes.manage",
  "quotes.approve_discount",
  "invoices.manage",
  "expenses.submit",
  "expenses.approve",
  "purchases.manage",
  "jobs.update_milestones",
  "meetings.manage",
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
  "leads.manage": {
    label: "Manage leads & activities",
    description:
      "Create, edit, and delete leads and logged activities (calls, site visits, notes, tasks) against a contact or lead. Split out from the old single 'Manage contacts & catalogue' capability, which this replaces for leads/activities specifically — contacts and catalogue items themselves now use the own/others capabilities above instead.",
  },
  "quotes.manage": {
    label: "Create/edit quotes",
    description: "Create and edit quotes.",
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
  "meetings.manage": {
    label: "Create/invite/manage meetings",
    description:
      "Create, edit, delete meetings and invite attendees. Read access to a specific meeting is enforced independently of this grant, by that meeting's own visibility and invite list — this capability never widens who can see a meeting, only who can create/edit/delete one.",
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
  "leads.manage": true,
  "quotes.manage": true,
  "quotes.approve_discount": false,
  "invoices.manage": true,
  "expenses.submit": true,
  "expenses.approve": true,
  "purchases.manage": true,
  "jobs.update_milestones": true,
  "meetings.manage": true,
  "ledger.view": false,
};
