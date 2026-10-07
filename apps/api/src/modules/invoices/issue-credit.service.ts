import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, gt, sql } from "drizzle-orm";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { creditNotes, invoices, payments } from "../../db/schema";
import { CreditNotesService } from "../credit-notes/credit-notes.service";
import { PaymentsService } from "../payments/payments.service";

/**
 * D-187 — when an invoice is issued with "Apply credit first", the
 * customer's credit (unallocated payments such as a deposit, then credit
 * notes with credit left, oldest first) goes against it up to its balance,
 * through the same routes as "Apply credit" (US-PAY-16, posting P6), so its
 * UPI QR code asks for what's really due (US-INV-26).
 */
@Injectable()
export class IssueCreditService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly payments: PaymentsService,
    private readonly creditNotes: CreditNotesService,
  ) {}

  /** The customer's credit in the invoice's currency, oldest first. */
  async available(orgId: string, contactId: string, currency: string) {
    const fromPayments = await this.db
      .select({ id: payments.id, date: payments.date, createdAt: payments.createdAt, amount: sql<string>`${payments.amount} - ${payments.allocatedAmount} - ${payments.refundedAmount}` })
      .from(payments)
      .where(and(eq(payments.orgId, orgId), eq(payments.contactId, contactId), eq(payments.currency, currency), sql`${payments.amount} - ${payments.allocatedAmount} - ${payments.refundedAmount} > 0`))
      .orderBy(asc(payments.date), asc(payments.createdAt));
    const fromNotes = await this.db
      .select({ id: creditNotes.id, date: creditNotes.date, createdAt: creditNotes.createdAt, amount: creditNotes.creditRemainingAmount })
      .from(creditNotes)
      .where(and(eq(creditNotes.orgId, orgId), eq(creditNotes.contactId, contactId), eq(creditNotes.currency, currency), eq(creditNotes.status, "issued"), gt(creditNotes.creditRemainingAmount, 0n)))
      .orderBy(asc(creditNotes.date), asc(creditNotes.createdAt));
    const time = (d: Date | null, created: Date) => (d ?? created).getTime();
    return [
      ...fromPayments.map((p) => ({ kind: "payment" as const, id: p.id, at: time(p.date, p.createdAt), amount: BigInt(p.amount) })),
      ...fromNotes.map((n) => ({ kind: "credit_note" as const, id: n.id, at: time(n.date, n.createdAt), amount: n.amount })),
    ].sort((a, b) => a.at - b.at);
  }

  /** Applies the credit to an issued invoice up to its balance; returns how much was applied. */
  async apply(orgId: string, actorUserId: string, invoiceId: string): Promise<bigint> {
    const [invoice] = await this.db.select().from(invoices).where(and(eq(invoices.orgId, orgId), eq(invoices.id, invoiceId)));
    // A deposit request never posts to Accounts Receivable, so credit can't go against it.
    if (!invoice || invoice.status !== "issued" || invoice.type === "advance") return 0n;
    let balance = invoice.totalAmount - invoice.retentionAmount - invoice.amountPaid - invoice.creditedAmount;
    let applied = 0n;
    for (const source of await this.available(orgId, invoice.contactId, invoice.currency)) {
      if (balance <= 0n) break;
      const amount = source.amount < balance ? source.amount : balance;
      const input = { allocations: [{ invoiceId, amount }] };
      if (source.kind === "payment") await this.payments.applyCredit(orgId, actorUserId, source.id, input);
      else await this.creditNotes.applyCredit(orgId, actorUserId, source.id, input);
      balance -= amount;
      applied += amount;
    }
    return applied;
  }
}
