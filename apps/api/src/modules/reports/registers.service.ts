import { Inject, Injectable } from "@nestjs/common";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { CreditRegisterReport, CreditRegisterRow, PaymentRegisterReport, PaymentRegisterRow, RegisterAllocation } from "@spine/shared";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import {
  contacts,
  creditNoteAllocations,
  creditNotes,
  customerRefunds,
  invoices,
  moneyAccounts,
  paymentAllocations,
  payments,
  vendorBills,
  vendorCreditAllocations,
  vendorCredits,
  vendorPaymentAllocations,
  vendorPayments,
  vendorRefunds,
} from "../../db/schema";

const isoDay = (d: Date | string) => (d instanceof Date ? d.toISOString().slice(0, 10) : d);

function totals(rows: PaymentRegisterRow[]): PaymentRegisterReport["totals"] {
  const held = rows.filter((r) => BigInt(r.heldAsCredit) > 0n);
  return {
    count: rows.length,
    amount: rows.reduce((s, r) => s + BigInt(r.amount), 0n).toString(),
    heldAsCredit: held.reduce((s, r) => s + BigInt(r.heldAsCredit), 0n).toString(),
    heldCount: held.length,
  };
}

function creditTotals(rows: CreditRegisterRow[]): CreditRegisterReport["totals"] {
  const sum = (pick: (r: CreditRegisterRow) => string) => rows.reduce((s, r) => s + BigInt(pick(r)), 0n).toString();
  return { count: rows.length, total: sum((r) => r.total), applied: sum((r) => r.applied), refunded: sum((r) => r.refunded), held: sum((r) => r.held) };
}

/** US-RPT-30, US-RPT-31 — registers read from the documents themselves, newest first. */
@Injectable()
export class RegistersService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /** Every customer payment dated in the range (opening credits left out), with what it was allocated to. */
  async paymentsReceived(orgId: string, from: string, to: string, moneyAccountId?: string): Promise<PaymentRegisterReport> {
    const rows = await this.db
      .select({ payment: payments, contactName: contacts.name, accountName: moneyAccounts.name })
      .from(payments)
      .innerJoin(contacts, eq(contacts.id, payments.contactId))
      .leftJoin(moneyAccounts, eq(moneyAccounts.id, payments.moneyAccountId))
      .where(
        and(
          eq(payments.orgId, orgId),
          eq(payments.isOpening, false),
          sql`${payments.date} >= ${from}::date`,
          sql`${payments.date} <= ${to}::date`,
          moneyAccountId ? eq(payments.moneyAccountId, moneyAccountId) : undefined,
        ),
      )
      .orderBy(desc(payments.date), desc(payments.createdAt));
    const ids = rows.map((r) => r.payment.id);
    const allocations = ids.length
      ? await this.db
          .select({ paymentId: paymentAllocations.paymentId, invoiceId: invoices.id, number: invoices.number, type: invoices.type, amount: paymentAllocations.amount })
          .from(paymentAllocations)
          .innerJoin(invoices, eq(invoices.id, paymentAllocations.invoiceId))
          .where(inArray(paymentAllocations.paymentId, ids))
          .orderBy(asc(paymentAllocations.createdAt))
      : [];
    const result = rows.map(({ payment: p, contactName, accountName }): PaymentRegisterRow => {
      const own: RegisterAllocation[] = allocations
        .filter((a) => a.paymentId === p.id)
        .map((a) => ({ documentId: a.invoiceId, number: a.number, amount: a.amount.toString(), opening: a.type === "opening", href: `/invoices/${a.invoiceId}` }));
      const held = p.amount - p.allocatedAmount - p.refundedAmount;
      return {
        id: p.id,
        number: p.number,
        date: isoDay(p.date),
        contact: { id: p.contactId, name: contactName },
        method: p.method,
        moneyAccount: p.moneyAccountId && accountName ? { id: p.moneyAccountId, name: accountName } : null,
        amount: p.amount.toString(),
        allocations: own,
        heldAsCredit: (held > 0n ? held : 0n).toString(),
        refunded: p.refundedAmount.toString(),
        href: `/payments?id=${p.id}`,
      };
    });
    return { from, to, rows: result, totals: totals(result) };
  }

  /** Every vendor payment dated in the range, with the bills it paid. */
  async paymentsMade(orgId: string, from: string, to: string, moneyAccountId?: string): Promise<PaymentRegisterReport> {
    const rows = await this.db
      .select({ payment: vendorPayments, contactName: contacts.name, accountName: moneyAccounts.name })
      .from(vendorPayments)
      .innerJoin(contacts, eq(contacts.id, vendorPayments.contactId))
      .leftJoin(moneyAccounts, eq(moneyAccounts.id, vendorPayments.moneyAccountId))
      .where(
        and(
          eq(vendorPayments.orgId, orgId),
          sql`${vendorPayments.date} >= ${from}::date`,
          sql`${vendorPayments.date} <= ${to}::date`,
          moneyAccountId ? eq(vendorPayments.moneyAccountId, moneyAccountId) : undefined,
        ),
      )
      .orderBy(desc(vendorPayments.date), desc(vendorPayments.createdAt));
    const ids = rows.map((r) => r.payment.id);
    const allocations = ids.length
      ? await this.db
          .select({ paymentId: vendorPaymentAllocations.vendorPaymentId, billId: vendorBills.id, number: vendorBills.billNumber, opening: vendorBills.isOpening, amount: vendorPaymentAllocations.amount })
          .from(vendorPaymentAllocations)
          .innerJoin(vendorBills, eq(vendorBills.id, vendorPaymentAllocations.billId))
          .where(inArray(vendorPaymentAllocations.vendorPaymentId, ids))
          .orderBy(asc(vendorPaymentAllocations.createdAt))
      : [];
    const result = rows.map(({ payment: p, contactName, accountName }): PaymentRegisterRow => {
      const held = p.amount - p.allocatedAmount;
      return {
        id: p.id,
        number: p.number,
        date: isoDay(p.date),
        contact: { id: p.contactId, name: contactName },
        method: p.method,
        moneyAccount: p.moneyAccountId && accountName ? { id: p.moneyAccountId, name: accountName } : null,
        amount: p.amount.toString(),
        allocations: allocations
          .filter((a) => a.paymentId === p.id)
          .map((a) => ({ documentId: a.billId, number: a.number, amount: a.amount.toString(), opening: a.opening, href: `/vendor-bills/${a.billId}` })),
        heldAsCredit: (held > 0n ? held : 0n).toString(),
        refunded: "0",
        href: `/vendor-payments/${p.id}`,
      };
    });
    return { from, to, rows: result, totals: totals(result) };
  }

  /**
   * US-RPT-31 — every issued credit note dated in the range: the invoice it
   * credits, its total, how much was applied to invoices, refunded, and is
   * still held as credit. Newest first.
   */
  async customerCredits(orgId: string, from: string, to: string): Promise<CreditRegisterReport> {
    const dated = sql`coalesce(${creditNotes.date}, (${creditNotes.issuedAt})::date)`;
    const rows = await this.db
      .select({ note: creditNotes, contactName: contacts.name, invoiceNumber: invoices.number, invoiceType: invoices.type, date: sql<string>`(${dated})::text` })
      .from(creditNotes)
      .innerJoin(contacts, eq(contacts.id, creditNotes.contactId))
      .leftJoin(invoices, eq(invoices.id, creditNotes.invoiceId))
      .where(and(eq(creditNotes.orgId, orgId), eq(creditNotes.status, "issued"), sql`${dated} >= ${from}::date`, sql`${dated} <= ${to}::date`))
      .orderBy(desc(dated), desc(creditNotes.createdAt));
    const ids = rows.map((r) => r.note.id);
    const [applied, refunds] = ids.length
      ? await Promise.all([
          this.db
            .select({ creditNoteId: creditNoteAllocations.creditNoteId, invoiceId: invoices.id, number: invoices.number, type: invoices.type, amount: creditNoteAllocations.amount })
            .from(creditNoteAllocations)
            .innerJoin(invoices, eq(invoices.id, creditNoteAllocations.invoiceId))
            .where(inArray(creditNoteAllocations.creditNoteId, ids))
            .orderBy(asc(creditNoteAllocations.createdAt)),
          this.db
            .select({ creditNoteId: customerRefunds.sourceCreditNoteId, amount: customerRefunds.amount })
            .from(customerRefunds)
            .where(and(inArray(customerRefunds.sourceCreditNoteId, ids), isNull(customerRefunds.deletedAt))),
        ])
      : [[], []];
    const result = rows.map(({ note: n, contactName, invoiceNumber, invoiceType, date }): CreditRegisterRow => {
      const later = applied
        .filter((a) => a.creditNoteId === n.id)
        .map((a) => ({ documentId: a.invoiceId, number: a.number, amount: a.amount.toString(), opening: a.type === "opening", href: `/invoices/${a.invoiceId}` }));
      const refunded = refunds.filter((r) => r.creditNoteId === n.id).reduce((s, r) => s + r.amount, 0n);
      // Issuing reduces its own invoice first, without an allocation row: whatever isn't held, refunded or applied later went there.
      const toOwn = n.totalAmount - n.creditRemainingAmount - refunded - later.reduce((s, a) => s + BigInt(a.amount), 0n);
      const appliedTo = toOwn > 0n ? [{ documentId: n.invoiceId, number: invoiceNumber, amount: toOwn.toString(), opening: invoiceType === "opening", href: `/invoices/${n.invoiceId}` }, ...later] : later;
      return {
        id: n.id,
        number: n.number,
        reference: null,
        date,
        contact: { id: n.contactId, name: contactName },
        against: { id: n.invoiceId, number: invoiceNumber, href: `/invoices/${n.invoiceId}` },
        total: n.totalAmount.toString(),
        applied: appliedTo.reduce((s, a) => s + BigInt(a.amount), 0n).toString(),
        refunded: refunded.toString(),
        held: n.creditRemainingAmount.toString(),
        appliedTo,
        href: `/invoices/${n.invoiceId}`,
      };
    });
    return { from, to, rows: result, totals: creditTotals(result) };
  }

  /** US-RPT-31 — every recorded vendor credit dated in the range (void left out), the same for vendors and bills. */
  async vendorCredits(orgId: string, from: string, to: string): Promise<CreditRegisterReport> {
    const rows = await this.db
      .select({ credit: vendorCredits, contactName: contacts.name, billNumber: vendorBills.billNumber })
      .from(vendorCredits)
      .innerJoin(contacts, eq(contacts.id, vendorCredits.contactId))
      .leftJoin(vendorBills, eq(vendorBills.id, vendorCredits.billId))
      .where(and(eq(vendorCredits.orgId, orgId), inArray(vendorCredits.status, ["open", "used"]), sql`${vendorCredits.date} >= ${from}::date`, sql`${vendorCredits.date} <= ${to}::date`))
      .orderBy(desc(vendorCredits.date), desc(vendorCredits.createdAt));
    const ids = rows.map((r) => r.credit.id);
    const [applied, refunds] = ids.length
      ? await Promise.all([
          this.db
            .select({ creditId: vendorCreditAllocations.vendorCreditId, billId: vendorBills.id, number: vendorBills.billNumber, opening: vendorBills.isOpening, amount: vendorCreditAllocations.amount })
            .from(vendorCreditAllocations)
            .innerJoin(vendorBills, eq(vendorBills.id, vendorCreditAllocations.billId))
            .where(inArray(vendorCreditAllocations.vendorCreditId, ids))
            .orderBy(asc(vendorCreditAllocations.createdAt)),
          this.db
            .select({ creditId: vendorRefunds.vendorCreditId, amount: vendorRefunds.amount })
            .from(vendorRefunds)
            .where(and(inArray(vendorRefunds.vendorCreditId, ids), isNull(vendorRefunds.deletedAt))),
        ])
      : [[], []];
    const result = rows.map(({ credit: c, contactName, billNumber }): CreditRegisterRow => {
      const appliedTo = applied
        .filter((a) => a.creditId === c.id)
        .map((a) => ({ documentId: a.billId, number: a.number, amount: a.amount.toString(), opening: a.opening, href: `/vendor-bills/${a.billId}` }));
      return {
        id: c.id,
        number: c.number,
        reference: c.vendorReference,
        date: isoDay(c.date),
        contact: { id: c.contactId, name: contactName },
        against: c.billId ? { id: c.billId, number: billNumber, href: `/vendor-bills/${c.billId}` } : null,
        total: c.totalAmount.toString(),
        applied: appliedTo.reduce((s, a) => s + BigInt(a.amount), 0n).toString(),
        refunded: refunds.filter((r) => r.creditId === c.id).reduce((s, r) => s + r.amount, 0n).toString(),
        held: c.balanceAmount.toString(),
        appliedTo,
        href: `/vendor-credits/${c.id}`,
      };
    });
    return { from, to, rows: result, totals: creditTotals(result) };
  }
}
