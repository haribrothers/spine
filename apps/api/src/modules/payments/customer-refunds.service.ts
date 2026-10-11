import { randomUUID } from "node:crypto";
import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";
import { formatMoney, type CreateCustomerRefundInput, type CustomerRefund } from "@spine/shared";
import { orgClock } from "../../common/org-clock";
import { orgMoneySettings } from "../../common/money-format";
import { DATABASE } from "../../db/db.module";
import type { Database, Transaction } from "../../db/client";
import { contacts, creditNotes, customerRefunds, moneyAccounts, payments } from "../../db/schema";
import { AuditLogService } from "../audit/audit-log.service";
import { MoneyAccountsService } from "../banking/money-accounts.service";
import { loadEmailBrand } from "../email/email-brand";
import { renderEmail } from "../email/email-layout";
import { refundEmail } from "../email/email-templates";
import { EmailService } from "../email/email.service";
import { LedgerService } from "../ledger/ledger.service";

type RefundRow = typeof customerRefunds.$inferSelect;

/**
 * US-PAY-17 — paying a customer back out of their credit. Posts P23
 * (Dr 2200 Customer Advances / Cr the money account) and lowers the
 * source's credit, both under a lock on the source; deleting posts the
 * reversal (dated today) and gives the credit back.
 */
@Injectable()
export class CustomerRefundsService {
  private readonly logger = new Logger(CustomerRefundsService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly ledger: LedgerService,
    private readonly moneyAccounts: MoneyAccountsService,
    private readonly auditLog: AuditLogService,
    private readonly email: EmailService,
  ) {}

  async list(orgId: string, contactId?: string): Promise<CustomerRefund[]> {
    const rows = await this.db
      .select()
      .from(customerRefunds)
      .where(and(eq(customerRefunds.orgId, orgId), contactId ? eq(customerRefunds.contactId, contactId) : undefined))
      .orderBy(desc(customerRefunds.date), desc(customerRefunds.createdAt));
    return Promise.all(rows.map((r) => this.toResponse(r)));
  }

  async create(orgId: string, actorUserId: string, input: CreateCustomerRefundInput): Promise<CustomerRefund> {
    const id = randomUUID();
    const row = await this.db.transaction(async (tx) => {
      const source = await this.lockSource(tx, orgId, input);
      if (input.amount > source.available) {
        const { locale } = await orgMoneySettings(this.db, orgId);
        throw new BadRequestException(`You can refund up to ${formatMoney(source.available, source.currency, locale)} from this ${source.kind === "payment" ? "payment" : "credit note"}.`);
      }
      const moneyAccount = await this.moneyAccounts.resolveForPosting(tx, orgId, input.moneyAccountId);
      const advances = await this.ledger.resolveSystemAccount(tx, orgId, "customerAdvances");
      // US-ONB-29 (D-219): a refund of a demo credit note's credit is demo money — the credit only exists in the demo.
      const isDemo = source.kind === "credit_note" ? ((await tx.select({ isDemo: creditNotes.isDemo }).from(creditNotes).where(eq(creditNotes.id, source.id)))[0]?.isDemo ?? false) : false;
      const entryId = await this.ledger.postEntry(tx, {
        orgId,
        isDemo,
        date: input.date,
        narration: `Refund to customer from ${source.label}`,
        sourceType: "customer_refund",
        sourceId: id,
        lines: [
          { accountId: advances, debit: input.amount, credit: 0n, contactId: source.contactId },
          { accountId: moneyAccount.accountId, debit: 0n, credit: input.amount, contactId: source.contactId },
        ],
      });
      await this.adjustSource(tx, source.kind, source.id, -input.amount);
      const [created] = await tx
        .insert(customerRefunds)
        .values({
          id,
          orgId,
          contactId: source.contactId,
          sourcePaymentId: source.kind === "payment" ? source.id : null,
          sourceCreditNoteId: source.kind === "credit_note" ? source.id : null,
          moneyAccountId: moneyAccount.id,
          amount: input.amount,
          date: input.date,
          method: input.method,
          reference: input.reference || null,
          entryId,
          createdByUserId: actorUserId,
        })
        .returning();
      await this.moneyAccounts.rememberLastUsed(tx, actorUserId, "refund", moneyAccount.id);
      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "refunded",
        entityType: source.kind,
        entityId: source.id,
        contactId: source.contactId,
        changes: [{ field: "refundedAmount", from: null, to: input.amount.toString() }],
      });
      return created!;
    });

    const refund = await this.toResponse(row);
    return input.sendConfirmation ? { ...refund, confirmation: await this.sendConfirmation(orgId, row, refund) } : refund;
  }

  async remove(orgId: string, id: string, actorUserId: string): Promise<{ id: string }> {
    await this.db.transaction(async (tx) => {
      const [existing] = await tx.select().from(customerRefunds).where(and(eq(customerRefunds.orgId, orgId), eq(customerRefunds.id, id))).for("update");
      if (!existing) throw new NotFoundException("Refund not found");
      if (existing.deletedAt) throw new BadRequestException("This refund has already been deleted.");
      const kind = existing.sourcePaymentId ? "payment" : "credit_note";
      const sourceId = (existing.sourcePaymentId ?? existing.sourceCreditNoteId)!;
      // Lock the source before giving the credit back.
      if (kind === "payment") await tx.select({ id: payments.id }).from(payments).where(eq(payments.id, sourceId)).for("update");
      else await tx.select({ id: creditNotes.id }).from(creditNotes).where(eq(creditNotes.id, sourceId)).for("update");
      const reversalEntryId = await this.ledger.reverseEntry(tx, existing.entryId, { orgId, date: orgClock().date, narration: "Refund deleted", sourceType: "customer_refund_delete", sourceId: id });
      await this.adjustSource(tx, kind, sourceId, existing.amount);
      await tx.update(customerRefunds).set({ deletedAt: new Date(), reversalEntryId, updatedAt: new Date() }).where(eq(customerRefunds.id, id));
      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "refund_deleted",
        entityType: kind,
        entityId: sourceId,
        contactId: existing.contactId,
        changes: [{ field: "refundedAmount", from: existing.amount.toString(), to: null }],
      });
    });
    return { id };
  }

  /** The source, locked, with the credit left on it. */
  private async lockSource(tx: Transaction, orgId: string, input: CreateCustomerRefundInput) {
    if (input.sourcePaymentId) {
      const [payment] = await tx.select().from(payments).where(and(eq(payments.orgId, orgId), eq(payments.id, input.sourcePaymentId))).for("update");
      if (!payment) throw new NotFoundException("Payment not found");
      return {
        kind: "payment" as const,
        id: payment.id,
        contactId: payment.contactId,
        currency: payment.currency,
        label: `payment ${payment.number ?? ""}`.trim(),
        available: payment.amount - payment.allocatedAmount - payment.refundedAmount,
      };
    }
    const [note] = await tx.select().from(creditNotes).where(and(eq(creditNotes.orgId, orgId), eq(creditNotes.id, input.sourceCreditNoteId!))).for("update");
    if (!note) throw new NotFoundException("Credit note not found");
    if (note.status !== "issued") throw new BadRequestException("Only an issued credit note has credit to refund.");
    return { kind: "credit_note" as const, id: note.id, contactId: note.contactId, currency: note.currency, label: `credit note ${note.number ?? ""}`.trim(), available: note.creditRemainingAmount };
  }

  /** `delta` < 0 takes credit away (a refund); > 0 gives it back (a deleted refund). */
  private async adjustSource(tx: Transaction, kind: "payment" | "credit_note", id: string, delta: bigint) {
    if (kind === "payment") {
      const [p] = await tx.select({ refunded: payments.refundedAmount }).from(payments).where(eq(payments.id, id));
      await tx.update(payments).set({ refundedAmount: p!.refunded - delta, updatedAt: new Date() }).where(eq(payments.id, id));
    } else {
      const [n] = await tx.select({ remaining: creditNotes.creditRemainingAmount }).from(creditNotes).where(eq(creditNotes.id, id));
      await tx.update(creditNotes).set({ creditRemainingAmount: n!.remaining + delta, updatedAt: new Date() }).where(eq(creditNotes.id, id));
    }
  }

  /** Email outages never undo a refund: the result says whether it went. */
  private async sendConfirmation(orgId: string, row: RefundRow, refund: CustomerRefund): Promise<{ sent: boolean; reason?: string }> {
    const [contact] = await this.db.select({ email: contacts.email, name: contacts.name }).from(contacts).where(eq(contacts.id, row.contactId));
    if (!contact?.email) return { sent: false, reason: "This customer has no email address, so no confirmation was sent." };
    if (!this.email.isConfigured()) return { sent: false, reason: "Email isn't set up, so no confirmation was sent." };
    try {
      const brand = await loadEmailBrand(this.db, orgId);
      const template = refundEmail({ businessName: brand.name, locale: brand.locale, contactName: contact.name, amount: row.amount, currency: refund.currency, date: row.date, reference: row.reference });
      const email = renderEmail(brand, template.content);
      await this.email.send({ to: contact.email, fromName: brand.name, subject: template.subject, text: email.text, html: email.html, attachments: email.attachments });
      return { sent: true };
    } catch (err) {
      this.logger.warn(`Refund confirmation for ${row.id} failed: ${(err as Error).message}`);
      return { sent: false, reason: "The confirmation email couldn't be sent. The refund is saved." };
    }
  }

  private async toResponse(row: RefundRow): Promise<CustomerRefund> {
    const [contact] = await this.db.select({ name: contacts.name }).from(contacts).where(eq(contacts.id, row.contactId));
    const [account] = await this.db.select({ id: moneyAccounts.id, name: moneyAccounts.name }).from(moneyAccounts).where(eq(moneyAccounts.id, row.moneyAccountId));
    let source: CustomerRefund["source"];
    let currency = "USD";
    if (row.sourcePaymentId) {
      const [p] = await this.db.select({ number: payments.number, currency: payments.currency }).from(payments).where(eq(payments.id, row.sourcePaymentId));
      source = { kind: "payment", id: row.sourcePaymentId, number: p?.number ?? null };
      currency = p?.currency ?? currency;
    } else {
      const [n] = await this.db.select({ number: creditNotes.number, currency: creditNotes.currency }).from(creditNotes).where(eq(creditNotes.id, row.sourceCreditNoteId!));
      source = { kind: "credit_note", id: row.sourceCreditNoteId!, number: n?.number ?? null };
      currency = n?.currency ?? currency;
    }
    return {
      id: row.id,
      contactId: row.contactId,
      contactName: contact?.name ?? "",
      source,
      moneyAccount: account!,
      amount: row.amount.toString(),
      currency,
      date: row.date,
      method: row.method,
      reference: row.reference,
      deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    };
  }
}
