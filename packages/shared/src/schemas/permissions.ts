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
  "contacts.manage",
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
 * never list a capability that CAPABILITIES doesn't also define.
 */
export const CAPABILITY_LABELS: Record<Capability, { label: string; description: string }> = {
  "dashboard.view": {
    label: "View dashboard & reports",
    description: "Receivables and their own activity — P&L/balance sheet stay Owner-only regardless of this grant.",
  },
  "contacts.manage": {
    label: "Manage contacts & catalogue",
    description: "Create and edit contacts, leads, and catalogue items.",
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
  "contacts.manage": true,
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
