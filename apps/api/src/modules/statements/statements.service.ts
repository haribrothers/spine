import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Statement, StatementAging, StatementQuery, StatementRow } from "@spine/shared";
import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { addresses, contacts, creditNotes, invoices, journalEntries, journalLines, paymentAllocations, payments, settings } from "../../db/schema";
import { daysBetween, orgClock } from "../../common/org-clock";
import { LedgerService } from "../ledger/ledger.service";

const TYPE_LABELS: Record<string, string> = {
  invoice: "Invoice",
  invoice_void: "Invoice voided",
  payment: "Payment",
  payment_delete: "Payment removed",
  payment_credit_applied: "Credit applied",
  credit_note: "Credit note",
};

function isoDate(value: Date | string | null): string {
  if (!value) return "";
  return typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}

function addressLine(a: typeof addresses.$inferSelect | undefined): string | null {
  if (!a) return null;
  const cityLine = [a.city, [a.state, a.postalCode].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return [a.line1, a.line2, cityLine].filter(Boolean).join(", ") || null;
}

/**
 * US-PAY-14/15 — a customer's statement for a period. "All activity" reads
 * the customer's Accounts Receivable journal lines (D-011): the balance
 * before the period, then every invoice, payment, credit and void in it
 * with a running balance. "Open invoices only" lists the invoices still
 * owing with the payments and credits against them, and no opening
 * balance. The aging strip buckets what's still owed by days past due.
 * Nothing is stored.
 */
@Injectable()
export class StatementsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly ledger: LedgerService,
  ) {}

  async build(orgId: string, contactId: string, query: StatementQuery): Promise<Statement> {
    const [contact] = await this.db.select().from(contacts).where(and(eq(contacts.orgId, orgId), eq(contacts.id, contactId)));
    if (!contact) throw new NotFoundException("Contact not found");
    const contactAddresses = await this.db.select().from(addresses).where(eq(addresses.contactId, contactId));
    const address = contactAddresses.find((a) => a.type === "billing" && a.isPrimary) ?? contactAddresses.find((a) => a.type === "billing") ?? contactAddresses[0];

    const contactInvoices = await this.db
      .select()
      .from(invoices)
      .where(and(eq(invoices.orgId, orgId), eq(invoices.contactId, contactId), inArray(invoices.status, ["issued", "void"])))
      .orderBy(asc(invoices.issueDate), asc(invoices.createdAt));
    const currency = contactInvoices[0]?.currency ?? (await this.orgCurrency(orgId));

    const arAccountId = await this.ledger.resolveSystemAccount(this.db, orgId, "accountsReceivable");
    const entries = await this.db
      .select({
        entryId: journalEntries.id,
        date: journalEntries.date,
        sourceType: journalEntries.sourceType,
        sourceId: journalEntries.sourceId,
        debit: sql<string>`sum(${journalLines.debit})`,
        credit: sql<string>`sum(${journalLines.credit})`,
      })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
      .where(and(eq(journalEntries.orgId, orgId), eq(journalLines.accountId, arAccountId), eq(journalLines.contactId, contactId), lte(journalEntries.date, query.to)))
      .groupBy(journalEntries.id, journalEntries.date, journalEntries.sourceType, journalEntries.sourceId, journalEntries.createdAt)
      .orderBy(asc(journalEntries.date), asc(journalEntries.createdAt));

    let opening = 0n;
    let invoiced = 0n;
    let paidAndCredited = 0n;
    const inPeriod: typeof entries = [];
    for (const e of entries) {
      const date = isoDate(e.date);
      const net = BigInt(e.debit) - BigInt(e.credit);
      if (date < query.from) opening += net;
      else {
        inPeriod.push(e);
        invoiced += BigInt(e.debit);
        paidAndCredited += BigInt(e.credit);
      }
    }
    const closing = opening + invoiced - paidAndCredited;

    const open = contactInvoices.filter((i) => i.status === "issued" && i.totalAmount - i.retentionAmount - i.amountPaid - i.creditedAmount > 0n && isoDate(i.issueDate) <= query.to);
    const rows = query.mode === "open" ? await this.openRows(orgId, open) : await this.activityRows(orgId, inPeriod, opening);
    const balanceDue = query.mode === "open" ? open.reduce((sum, i) => sum + (i.totalAmount - i.retentionAmount - i.amountPaid - i.creditedAmount), 0n) : closing;

    return {
      contactId,
      contactName: contact.name,
      contactEmail: contact.email,
      contactAddress: addressLine(address),
      currency,
      from: query.from,
      to: query.to,
      mode: query.mode,
      openingBalance: opening.toString(),
      invoiced: invoiced.toString(),
      paidAndCredited: paidAndCredited.toString(),
      balanceDue: balanceDue.toString(),
      rows,
      aging: this.aging(open),
      hasInvoices: contactInvoices.length > 0,
    };
  }

  /** Every AR movement in the period, with a running balance from the opening balance. */
  private async activityRows(orgId: string, entries: { date: string | Date; sourceType: string; sourceId: string; debit: string; credit: string }[], opening: bigint): Promise<StatementRow[]> {
    const ids = (types: string[]) => entries.filter((e) => types.includes(e.sourceType)).map((e) => e.sourceId);
    const invoiceIds = ids(["invoice", "invoice_void"]);
    const paymentIds = ids(["payment", "payment_delete", "payment_credit_applied"]);
    const creditNoteIds = ids(["credit_note"]);
    const numbers = new Map<string, string | null>();
    if (invoiceIds.length) for (const r of await this.db.select({ id: invoices.id, number: invoices.number }).from(invoices).where(and(eq(invoices.orgId, orgId), inArray(invoices.id, invoiceIds)))) numbers.set(r.id, r.number);
    if (paymentIds.length) for (const r of await this.db.select({ id: payments.id, number: payments.number }).from(payments).where(and(eq(payments.orgId, orgId), inArray(payments.id, paymentIds)))) numbers.set(r.id, r.number);
    if (creditNoteIds.length) for (const r of await this.db.select({ id: creditNotes.id, number: creditNotes.number }).from(creditNotes).where(and(eq(creditNotes.orgId, orgId), inArray(creditNotes.id, creditNoteIds)))) numbers.set(r.id, r.number);

    let balance = opening;
    return entries.map((e) => {
      const charges = BigInt(e.debit);
      const paid = BigInt(e.credit);
      balance += charges - paid;
      return {
        date: isoDate(e.date),
        reference: numbers.get(e.sourceId) ?? null,
        type: TYPE_LABELS[e.sourceType] ?? "Adjustment",
        charges: charges.toString(),
        payments: paid.toString(),
        balance: balance.toString(),
      };
    });
  }

  /** Each invoice still owing, followed by the payments and credits against it. */
  private async openRows(orgId: string, open: (typeof invoices.$inferSelect)[]): Promise<StatementRow[]> {
    if (!open.length) return [];
    const ids = open.map((i) => i.id);
    const allocations = await this.db
      .select({ invoiceId: paymentAllocations.invoiceId, amount: paymentAllocations.amount, number: payments.number, date: payments.date })
      .from(paymentAllocations)
      .innerJoin(payments, eq(paymentAllocations.paymentId, payments.id))
      .where(inArray(paymentAllocations.invoiceId, ids));
    const credits = await this.db
      .select({ invoiceId: creditNotes.invoiceId, amount: creditNotes.totalAmount, number: creditNotes.number, date: creditNotes.date })
      .from(creditNotes)
      .where(and(eq(creditNotes.orgId, orgId), inArray(creditNotes.invoiceId, ids), eq(creditNotes.status, "issued")));

    let balance = 0n;
    const rows: StatementRow[] = [];
    const push = (date: string, reference: string | null, type: string, charges: bigint, paid: bigint) => {
      balance += charges - paid;
      rows.push({ date, reference, type, charges: charges.toString(), payments: paid.toString(), balance: balance.toString() });
    };
    for (const inv of open) {
      push(isoDate(inv.issueDate), inv.number, "Invoice", inv.totalAmount - inv.retentionAmount, 0n);
      const against = [
        ...allocations.filter((a) => a.invoiceId === inv.id).map((a) => ({ date: isoDate(a.date), number: a.number, type: "Payment", amount: a.amount })),
        ...credits.filter((c) => c.invoiceId === inv.id).map((c) => ({ date: isoDate(c.date), number: c.number, type: "Credit note", amount: c.amount })),
      ].sort((a, b) => a.date.localeCompare(b.date));
      for (const a of against) push(a.date, a.number, a.type, 0n, a.amount);
    }
    return rows;
  }

  /** What's still owed, by days past due today: Current, 1–30, 31–60, 61–90, 90+. */
  private aging(open: (typeof invoices.$inferSelect)[]): StatementAging {
    const today = orgClock().date;
    const buckets = { current: 0n, "1-30": 0n, "31-60": 0n, "61-90": 0n, "90+": 0n };
    for (const inv of open) {
      const owed = inv.totalAmount - inv.retentionAmount - inv.amountPaid - inv.creditedAmount;
      const days = inv.dueDate ? daysBetween(isoDate(inv.dueDate), today) : 0;
      const bucket = days <= 0 ? "current" : days <= 30 ? "1-30" : days <= 60 ? "31-60" : days <= 90 ? "61-90" : "90+";
      buckets[bucket] += owed;
    }
    return {
      current: buckets.current.toString(),
      "1-30": buckets["1-30"].toString(),
      "31-60": buckets["31-60"].toString(),
      "61-90": buckets["61-90"].toString(),
      "90+": buckets["90+"].toString(),
    };
  }

  private async orgCurrency(orgId: string): Promise<string> {
    const [row] = await this.db.select({ value: settings.value }).from(settings).where(and(eq(settings.orgId, orgId), eq(settings.key, "currency")));
    return (row?.value as { code?: string } | undefined)?.code ?? "USD";
  }
}
