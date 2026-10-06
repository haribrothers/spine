import { toDecimalString } from "./money/index.ts";

/**
 * US-SET-13 (D-061) — one formatter for every History dialog, so each
 * entry reads as a sentence: "Sarah Mendes changed the phone from
 * +1-555-0107 to +1-555-0177". At most three changes are listed, then
 * "and N more".
 */
export interface HistoryFieldChange {
  field: string;
  from: unknown;
  to: unknown;
}

export interface HistoryEntryLike {
  action: string;
  entityType: string;
  changes: HistoryFieldChange[] | null;
  actorName: string | null;
}

export const MAX_CHANGES_LISTED = 3;

/** "an invoice", "a milestone" — how a related record is named on another record's history. */
const ENTITY_NAMES: Record<string, string> = {
  activity: "an activity",
  address: "an address",
  catalog_item: "a catalogue item",
  catalog_bundle: "a bundle",
  contact: "a contact",
  contact_person: "a contact person",
  credit_note: "a credit note",
  expense: "an expense",
  expense_category: "an expense category",
  invoice: "an invoice",
  job: "a job",
  job_note: "a job note",
  job_photo: "a job photo",
  lead: "a lead",
  lead_stage: "a pipeline stage",
  meeting: "a meeting",
  milestone: "a milestone",
  payment: "a payment",
  quote: "a quote",
  recurring_invoice: "a recurring invoice",
  tax_group: "a tax group",
  tax_rate: "a tax rate",
  vendor_bill: "a vendor bill",
  vendor_payment: "a vendor payment",
};

const ACTION_VERBS: Record<string, string> = {
  created: "created",
  updated: "updated",
  issued: "issued",
  voided: "voided",
  deleted: "deleted",
  archived: "archived",
  restored: "restored",
  paused: "paused",
  resumed: "resumed",
  removed: "removed",
  sent: "sent",
  revised: "revised",
  approved: "approved",
  approve: "approved",
  rejected: "rejected",
  recorded: "recorded",
  billed: "billed",
  assigned: "assigned",
  unassigned: "unassigned",
  email_queued: "emailed",
  reminder_queued: "sent a reminder for",
  accepted_in_person: "recorded in-person acceptance of",
  discount_approved: "approved the discount on",
  milestone_completed: "completed",
  milestone_invoiced: "invoiced",
  milestones_set: "set the milestones of",
  photo_added: "added a photo to",
  note_added: "added a note to",
  variation_order_created: "added a variation order to",
  variation_order_applied: "applied a variation order to",
  variation_applied: "applied a variation order to",
  "marked done": "marked done",
  "marked undone": "marked as not done",
};

/** Internal ids (another record's uuid) only add noise to a sentence. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isIdChange = (c: HistoryFieldChange) => UUID.test(String(c.from ?? "")) || UUID.test(String(c.to ?? ""));

/** "totalAmount" → "total amount", "voidReason" → "void reason". */
export function fieldLabel(field: string): string {
  return field
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase();
}

function valueText(field: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "empty";
  if (/Amount$|^amount$/.test(field) && /^-?\d+$/.test(String(value))) {
    return toDecimalString({ amount: BigInt(String(value)), currency: "USD" });
  }
  if (typeof value === "boolean") return value ? "yes" : "no";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value).replace(/_/g, " ");
  return text.length > 60 ? `${text.slice(0, 60)}…` : text;
}

function changePhrase(change: HistoryFieldChange): string {
  const label = fieldLabel(change.field);
  if (change.from === null || change.from === undefined || change.from === "") return `set the ${label} to ${valueText(change.field, change.to)}`;
  if (change.to === null || change.to === undefined || change.to === "") return `cleared the ${label}`;
  return `changed the ${label} from ${valueText(change.field, change.from)} to ${valueText(change.field, change.to)}`;
}

/** "a, b and c" */
function list(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * One sentence per entry. `ownEntityType` is the record whose History is
 * open; its own entries say `subjectLabel` ("this contact"), and entries
 * about related records name them ("issued an invoice").
 */
export function describeHistoryEntry(entry: HistoryEntryLike, subjectLabel: string, ownEntityType?: string): string {
  const actor = entry.actorName ?? "Someone";
  const own = !ownEntityType || entry.entityType === ownEntityType;
  const subject = own ? subjectLabel : (ENTITY_NAMES[entry.entityType] ?? `a ${fieldLabel(entry.entityType)}`);
  const changes = (entry.changes ?? []).filter((c) => !isIdChange(c));

  // US-INV-19: the reminder run has no actor.
  if (entry.action === "automatic_reminder_sent") return own ? "Automatic reminder sent" : `Automatic reminder sent for ${subject}`;

  // US-PAY-14: "Sarah Mendes sent a statement to ap@maple.example".
  if (entry.action === "statement_sent") {
    const to = changes.find((c) => c.field === "email")?.to;
    return `${actor} sent a statement${to ? ` to ${String(to)}` : ""}`;
  }

  // US-OPS-33: "Sarah Mendes attached coastal-timber-88213.pdf".
  if (entry.action === "attachment_added") {
    const name = changes.find((c) => c.field === "attachment")?.to;
    return `${actor} attached ${name ? String(name) : "a file"}${own ? "" : ` to ${subject}`}`;
  }

  // US-QUO-24: "Duplicated from QUO-0004 by Sarah Mendes".
  if (entry.action === "duplicated") {
    const from = changes.find((c) => c.field === "duplicatedFrom")?.to;
    return from ? `Duplicated from ${String(from)} by ${actor}` : `${actor} duplicated ${subject}`;
  }

  if (entry.action === "updated" && changes.length > 0) {
    const shown = changes.slice(0, MAX_CHANGES_LISTED).map(changePhrase);
    const more = changes.length - shown.length;
    const parts = more > 0 ? [...shown, `${more} more`] : shown;
    return own ? `${actor} ${list(parts)}` : `${actor} updated ${subject}: ${list(parts)}`;
  }

  const verb = ACTION_VERBS[entry.action] ?? entry.action.replace(/_/g, " ");
  const base = `${actor} ${verb} ${subject}`;
  const statusChange = changes.find((c) => c.field === "status");
  const others = changes.filter((c) => c !== statusChange);
  // A transition's status change is already said by its verb ("issued").
  if (!others.length || entry.action === "created" || entry.action === "deleted") return base;
  const shown = others.slice(0, MAX_CHANGES_LISTED).map(changePhrase);
  const more = others.length - shown.length;
  return `${base}: ${list(more > 0 ? [...shown, `${more} more`] : shown)}`;
}
