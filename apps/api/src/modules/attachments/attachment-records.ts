import { and, eq } from "drizzle-orm";
import type { AttachmentEntityType, Capability } from "@spine/shared";
import { getMemberRole, hasCapability } from "../../auth/capability.util";
import type { Database } from "../../db/client";
import { bankTransactions, contacts, creditNotes, expenses, invoices, payments, quotes, vendorBills, vendorCredits, vendorPayments } from "../../db/schema";

/** What attachments need to know about the record they belong to. */
export interface AttachmentRecord {
  createdBy: string | null;
  /** Issued, sent, recorded or posted: its files can be removed only by an Owner, with a reason (D-156). */
  locked: boolean;
  contactId: string | null;
}

type Loader = (db: Database, orgId: string, id: string) => Promise<AttachmentRecord | null>;

const one = <T>(rows: T[]): T | null => rows[0] ?? null;

/**
 * One loader per record type that can hold attachments today. Refunds,
 * vendor credits and manual journals join when their stories ship; until
 * then a request for them finds no record (404).
 */
const LOADERS: Partial<Record<AttachmentEntityType, Loader>> = {
  quote: async (db, orgId, id) => {
    const row = one(await db.select({ createdBy: quotes.createdByUserId, status: quotes.status, contactId: quotes.contactId }).from(quotes).where(and(eq(quotes.orgId, orgId), eq(quotes.id, id))));
    return row && { createdBy: row.createdBy, locked: row.status !== "draft", contactId: row.contactId };
  },
  invoice: async (db, orgId, id) => {
    const row = one(await db.select({ createdBy: invoices.createdByUserId, status: invoices.status, contactId: invoices.contactId }).from(invoices).where(and(eq(invoices.orgId, orgId), eq(invoices.id, id))));
    return row && { createdBy: row.createdBy, locked: row.status !== "draft", contactId: row.contactId };
  },
  credit_note: async (db, orgId, id) => {
    const row = one(await db.select({ createdBy: creditNotes.createdByUserId, status: creditNotes.status, contactId: creditNotes.contactId }).from(creditNotes).where(and(eq(creditNotes.orgId, orgId), eq(creditNotes.id, id))));
    return row && { createdBy: row.createdBy, locked: row.status !== "draft", contactId: row.contactId };
  },
  payment: async (db, orgId, id) => {
    const row = one(await db.select({ createdBy: payments.createdByUserId, contactId: payments.contactId }).from(payments).where(and(eq(payments.orgId, orgId), eq(payments.id, id))));
    return row && { createdBy: row.createdBy, locked: true, contactId: row.contactId };
  },
  vendor_bill: async (db, orgId, id) => {
    const row = one(await db.select({ createdBy: vendorBills.createdByUserId, status: vendorBills.status, contactId: vendorBills.contactId }).from(vendorBills).where(and(eq(vendorBills.orgId, orgId), eq(vendorBills.id, id))));
    return row && { createdBy: row.createdBy, locked: row.status !== "draft", contactId: row.contactId };
  },
  vendor_credit: async (db, orgId, id) => {
    const row = one(await db.select({ createdBy: vendorCredits.createdByUserId, status: vendorCredits.status, contactId: vendorCredits.contactId }).from(vendorCredits).where(and(eq(vendorCredits.orgId, orgId), eq(vendorCredits.id, id))));
    return row && { createdBy: row.createdBy, locked: row.status !== "draft", contactId: row.contactId };
  },
  vendor_payment: async (db, orgId, id) => {
    const row = one(await db.select({ createdBy: vendorPayments.createdByUserId, contactId: vendorPayments.contactId }).from(vendorPayments).where(and(eq(vendorPayments.orgId, orgId), eq(vendorPayments.id, id))));
    return row && { createdBy: row.createdBy, locked: true, contactId: row.contactId };
  },
  expense: async (db, orgId, id) => {
    const row = one(await db.select({ createdBy: expenses.submittedByUserId, status: expenses.status }).from(expenses).where(and(eq(expenses.orgId, orgId), eq(expenses.id, id))));
    return row && { createdBy: row.createdBy, locked: row.status !== "submitted", contactId: null };
  },
  bank_transaction: async (db, orgId, id) => {
    const row = one(await db.select({ createdBy: bankTransactions.createdByUserId, contactId: bankTransactions.contactId }).from(bankTransactions).where(and(eq(bankTransactions.orgId, orgId), eq(bankTransactions.id, id))));
    return row && { createdBy: row.createdBy, locked: true, contactId: row.contactId };
  },
  contact: async (db, orgId, id) => {
    const row = one(await db.select({ createdBy: contacts.createdByUserId }).from(contacts).where(and(eq(contacts.orgId, orgId), eq(contacts.id, id))));
    return row && { createdBy: row.createdBy, locked: false, contactId: id };
  },
};

/** The capability that lets someone edit each kind of record (own/others pairs follow who created it). */
const EDIT_CAPABILITIES: Partial<Record<AttachmentEntityType, { own: Capability; others: Capability } | Capability>> = {
  quote: { own: "quotes.edit_own", others: "quotes.edit_others" },
  invoice: { own: "invoices.edit_own", others: "invoices.edit_others" },
  credit_note: { own: "credit_notes.edit_own", others: "credit_notes.edit_others" },
  payment: { own: "payments.edit_own", others: "payments.edit_others" },
  vendor_bill: { own: "vendor_bills.edit_own", others: "vendor_bills.edit_others" },
  vendor_credit: { own: "vendor_credits.edit_own", others: "vendor_credits.edit_others" },
  vendor_payment: { own: "vendor_payments.edit_own", others: "vendor_payments.edit_others" },
  expense: { own: "expenses.edit_own", others: "expenses.edit_others" },
  bank_transaction: "banking.record",
  contact: { own: "contacts.edit_own", others: "contacts.edit_others" },
};

export function loadAttachmentRecord(db: Database, orgId: string, type: AttachmentEntityType, id: string): Promise<AttachmentRecord | null> {
  const loader = LOADERS[type];
  return loader ? loader(db, orgId, id) : Promise.resolve(null);
}

export interface RecordAccess {
  role: string | null;
  canRead: boolean;
  canEdit: boolean;
}

/**
 * D-156 — whoever can open the record can open its files; whoever can edit
 * it can add them. Owners always; Staff read every record except a bank
 * entry without `banking.view`; Field only their own expenses (never money
 * documents, US-OPS-34).
 */
export async function recordAccess(db: Database, actor: { orgId: string; userId: string }, type: AttachmentEntityType, record: AttachmentRecord): Promise<RecordAccess> {
  const role = await getMemberRole(db, actor.orgId, actor.userId);
  if (role === "owner") return { role, canRead: true, canEdit: true };
  const ownExpense = type === "expense" && record.createdBy === actor.userId;
  if (role === "field") return { role, canRead: ownExpense, canEdit: ownExpense };
  if (role !== "staff") return { role, canRead: false, canEdit: false };

  const canRead = type === "bank_transaction" ? await hasCapability(db, actor, "banking.view") : true;
  const caps = EDIT_CAPABILITIES[type];
  const needed = !caps ? null : typeof caps === "string" ? caps : record.createdBy !== null && record.createdBy === actor.userId ? caps.own : caps.others;
  const canEdit = canRead && needed !== null && (await hasCapability(db, actor, needed));
  return { role, canRead, canEdit };
}
