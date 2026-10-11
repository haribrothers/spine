/**
 * US-SET-11/12 (D-064) — the organisation audit log: one row per change to
 * a record, newest first, Owner-only. The server resolves each record's
 * label and link; this file decides how actions, types and changes read.
 */

/** Record types as the log names them. Unknown types fall back to a readable form of the key. */
export const AUDIT_ENTITY_LABELS: Record<string, string> = {
  contact: "Contact",
  contact_person: "Contact person",
  address: "Address",
  lead: "Lead",
  lead_stage: "Pipeline stage",
  activity: "Activity",
  meeting: "Meeting",
  catalog_item: "Catalogue item",
  catalog_bundle: "Bundle",
  quote: "Quote",
  quote_line: "Quote line",
  invoice: "Invoice",
  invoice_line: "Invoice line",
  credit_note: "Credit note",
  payment: "Payment",
  job: "Job",
  milestone: "Milestone",
  job_note: "Job note",
  job_photo: "Job photo",
  tax_rate: "Tax rate",
  tax_group: "Tax group",
  vendor_bill: "Vendor bill",
  vendor_bill_line: "Vendor bill line",
  expense_category: "Expense category",
  expense: "Expense",
  vendor_payment: "Vendor payment",
  recurring_invoice: "Recurring invoice",
  recurring_bill: "Recurring bill",
  user: "User",
  data_export: "Data export",
  money_account: "Money account",
  bank_transfer: "Transfer",
  bank_transaction: "Money in or out",
  vendor_credit: "Vendor credit",
  tax_payment: "Tax payment",
  bank_reconciliation: "Reconciliation",
  opening_balances: "Opening balances",
  manual_journal: "Journal",
  gstr1_export: "GSTR-1 file",
  tally_export: "Tally export",
  modules: "Modules",
  email: "Email",
};

function sentenceCase(key: string): string {
  const words = key.replace(/_/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function auditEntityLabel(entityType: string): string {
  return AUDIT_ENTITY_LABELS[entityType] ?? sentenceCase(entityType);
}

/** "accepted_in_person" → "Accepted in person"; "approve" → "Approved". */
export function auditActionLabel(action: string): string {
  const special: Record<string, string> = { approve: "Approved", role_changed: "Role changed", primary_owner_transferred: "Primary owner transferred" };
  return special[action] ?? sentenceCase(action);
}

/** The chip's tone: good outcomes green, undone or refused red, money moving blue, the rest neutral. Text always says it too. */
export function auditActionTone(action: string): "positive" | "negative" | "info" | "neutral" {
  if (/^(approved?|accepted|accepted_in_person|completed|milestone_completed|reactivated|restored|paid)$/.test(action)) return "positive";
  if (/^(voided|rejected|deleted|deactivated|archived|declined)$/.test(action)) return "negative";
  if (/^(issued|sent|recorded|billed|milestone_invoiced|prepared|downloaded)$/.test(action)) return "info";
  return "neutral";
}

export interface AuditLogEntry {
  id: string;
  createdAt: string;
  actor: { userId: string; name: string; email: string } | null;
  action: string;
  entityType: string;
  entityId: string;
  /** "QUO-0004", "Sarah Mendes", "Backfill & inspection sign-off"; null when the record is gone. */
  recordLabel: string | null;
  /** Where the record opens in the app, if it has a page. */
  link: string | null;
  changes: unknown;
}

export interface AuditLogPage {
  entries: AuditLogEntry[];
  total: number;
  /** The first entry's position (0-based) — "1–50 of 1,284 entries". */
  offset: number;
  limit: number;
  /** For the filters: who appears in the log, and which record types and actions. */
  facets: { people: { userId: string; name: string }[]; entityTypes: string[]; actions: string[] };
}

/** The page size of the org audit log. */
export const AUDIT_PAGE_SIZE = 50;

function show(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function isFieldChange(value: unknown): value is { field: string; from: unknown; to: unknown } {
  return typeof value === "object" && value !== null && "field" in value && "from" in value && "to" in value;
}

/**
 * The "Details" column: "Phone: +1-555-0107 → +1-555-0177", "Owner → Staff"
 * for a role change, or the first few recorded values. Empty when nothing
 * was recorded.
 */
export function auditDetails(entry: Pick<AuditLogEntry, "action" | "changes">, max = 2): string {
  const changes = entry.changes;
  if (Array.isArray(changes)) {
    const fields = changes.filter(isFieldChange);
    const value = (field: string, v: unknown) => (field === "status" && typeof v === "string" ? sentenceCase(v) : show(v));
    const step = (c: { field: string; from: unknown; to: unknown }) => (c.from === null || c.from === undefined ? value(c.field, c.to) : `${value(c.field, c.from)} → ${value(c.field, c.to)}`);
    if (fields.length === 1 && ["role", "status", "primaryOwner"].includes(fields[0]!.field)) return step(fields[0]!);
    const parts = fields.slice(0, max).map((c) => `${sentenceCase(c.field.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase())}: ${step(c)}`);
    if (fields.length > max) parts.push(`and ${fields.length - max} more`);
    return parts.join(" · ");
  }
  if (changes && typeof changes === "object") {
    return Object.entries(changes as Record<string, unknown>)
      .filter(([, v]) => v !== null && v !== undefined && typeof v !== "object")
      .slice(0, max + 1)
      .map(([k, v]) => `${sentenceCase(k.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase())}: ${show(v)}`)
      .join(" · ");
  }
  return "";
}
