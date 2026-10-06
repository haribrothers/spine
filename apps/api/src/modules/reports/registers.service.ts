import { Inject, Injectable } from "@nestjs/common";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { PaymentRegisterReport, PaymentRegisterRow, RegisterAllocation } from "@spine/shared";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { contacts, invoices, moneyAccounts, paymentAllocations, payments, vendorBills, vendorPaymentAllocations, vendorPayments } from "../../db/schema";

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
        href: `/vendor-payments?id=${p.id}`,
      };
    });
    return { from, to, rows: result, totals: totals(result) };
  }
}
