import type { Capability } from "@spine/shared";

/**
 * US-MCP-05 (D-259) — what `list_records` and `get_record` can read, each
 * through its own API route (so the route's guards decide), with the web
 * page to link to. `capability` is the section a Staff member's Teams must
 * open for the type to be offered; Field gets only `field` types, as Field
 * reads in Spine (contacts, the catalogue, assigned jobs, own expenses).
 */
export interface RecordType {
  key: string;
  label: string;
  api: string;
  /** Web page for one record (`/quotes/<id>`), or the list page when records have no page of their own. */
  web: (id: string) => string;
  capability: Capability | null;
  field: boolean;
  /** Query filters the list route takes, passed straight through. */
  filters: readonly ("status" | "contactId" | "jobId" | "type" | "search")[];
}

const page = (base: string) => (id: string) => `${base}/${id}`;

export const RECORD_TYPES: readonly RecordType[] = [
  { key: "contact", label: "contact", api: "/contacts", web: page("/contacts"), capability: "contacts.open", field: true, filters: ["type", "search"] },
  { key: "lead", label: "lead", api: "/leads", web: () => "/leads", capability: "leads.open", field: false, filters: [] },
  { key: "quote", label: "quote", api: "/quotes", web: page("/quotes"), capability: "quotes.open", field: false, filters: ["status", "contactId"] },
  { key: "job", label: "job", api: "/jobs", web: page("/jobs"), capability: "jobs.open", field: true, filters: ["status", "contactId"] },
  { key: "invoice", label: "invoice", api: "/invoices", web: page("/invoices"), capability: "invoices.open", field: false, filters: ["status", "contactId"] },
  { key: "credit_note", label: "credit note", api: "/credit-notes", web: page("/credit-notes"), capability: "credit_notes.open", field: false, filters: ["contactId"] },
  { key: "payment", label: "payment", api: "/payments", web: page("/payments"), capability: "payments.open", field: false, filters: ["contactId"] },
  { key: "vendor_bill", label: "vendor bill", api: "/vendor-bills", web: page("/vendor-bills"), capability: "vendor_bills.open", field: false, filters: ["status", "contactId", "jobId"] },
  { key: "vendor_credit", label: "vendor credit", api: "/vendor-credits", web: page("/vendor-credits"), capability: "vendor_credits.open", field: false, filters: ["status", "contactId"] },
  { key: "vendor_payment", label: "vendor payment", api: "/vendor-payments", web: page("/vendor-payments"), capability: "vendor_payments.open", field: false, filters: ["contactId"] },
  { key: "expense", label: "expense", api: "/expenses", web: page("/expenses"), capability: null, field: true, filters: ["status", "jobId"] },
  { key: "catalog_item", label: "catalogue item", api: "/catalog-items", web: () => "/catalog", capability: "catalog.open", field: true, filters: [] },
] as const;

/** The types this person may read, by role and their Teams' sections. */
export function readableTypes(role: "owner" | "staff" | "field", capabilities: Record<string, boolean>): RecordType[] {
  if (role === "owner") return RECORD_TYPES.filter((t) => !t.capability || capabilities[t.capability] !== false);
  if (role === "field") return RECORD_TYPES.filter((t) => t.field && (t.key !== "job" || capabilities["jobs.open"]));
  return RECORD_TYPES.filter((t) => !t.capability || capabilities[t.capability]);
}
