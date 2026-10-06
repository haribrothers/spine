import { randomUUID } from "node:crypto";
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import {
  OPENING_DOCUMENT_HAS_ACTIVITY,
  OPENING_INVOICE_NUMBER_USED,
  dayBefore,
  type OpeningCustomerCredit,
  type OpeningImportResult,
  type OpeningInvoice,
  type OpeningInvoiceImportInput,
  type OpeningInvoiceInput,
} from "@spine/shared";
import { formatMessageDate, orgMoneySettings } from "../../common/money-format";
import { DATABASE } from "../../db/db.module";
import type { Database, Transaction } from "../../db/client";
import { contacts, invoices, jobs, payments } from "../../db/schema";
import { AuditLogService } from "../audit/audit-log.service";
import { LedgerService } from "../ledger/ledger.service";
import { OpeningBalancesService } from "./opening-balances.service";

type InvoiceRow = typeof invoices.$inferSelect;

/**
 * US-RPT-17 (D-137) — unpaid customer invoices and unused customer credit
 * brought in from the old system. An opening invoice is an issued invoice of
 * type `opening`: its old number, no lines or tax, total = amount due +
 * retention held (balance due excludes retention, like a progress invoice).
 * It posts P18; opening credit is a `payments` row with `is_opening` and no
 * money account, posting P19. All dated the day before the cutover date.
 */
@Injectable()
export class OpeningInvoicesService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly ledger: LedgerService,
    private readonly opening: OpeningBalancesService,
    private readonly auditLog: AuditLogService,
  ) {}

  async listInvoices(orgId: string): Promise<OpeningInvoice[]> {
    const rows = await this.db
      .select({ invoice: invoices, contactName: contacts.name, job: { id: jobs.id, name: jobs.name, number: jobs.number } })
      .from(invoices)
      .innerJoin(contacts, eq(contacts.id, invoices.contactId))
      .leftJoin(jobs, eq(jobs.id, invoices.jobId))
      .where(and(eq(invoices.orgId, orgId), eq(invoices.type, "opening")))
      .orderBy(asc(invoices.issueDate), asc(invoices.number));
    return rows.map((r) => this.toInvoice(r.invoice, r.contactName, r.job?.id ? r.job : null));
  }

  async createInvoice(orgId: string, actorUserId: string, input: OpeningInvoiceInput): Promise<OpeningInvoice> {
    const id = await this.db.transaction(async (tx) => {
      const row = await this.opening.ensureDraft(tx, orgId);
      return this.insertInvoice(tx, orgId, actorUserId, row.cutoverDate, input);
    });
    return (await this.listInvoices(orgId)).find((i) => i.id === id)!;
  }

  async updateInvoice(orgId: string, actorUserId: string, id: string, input: OpeningInvoiceInput): Promise<OpeningInvoice> {
    await this.db.transaction(async (tx) => {
      const row = await this.opening.ensureDraft(tx, orgId);
      const existing = await this.loadInvoice(tx, orgId, id);
      if (existing.amountPaid > 0n || existing.creditedAmount > 0n) throw new BadRequestException(OPENING_DOCUMENT_HAS_ACTIVITY);
      await this.validateInvoice(tx, orgId, row.cutoverDate, input, id);
      if (existing.journalEntryId) await this.ledger.reverseEntry(tx, existing.journalEntryId, { orgId, date: dayBefore(row.cutoverDate), narration: `Opening invoice ${existing.number} changed`, sourceType: "opening_invoice_repost", sourceId: id });
      const { currency } = await orgMoneySettings(this.db, orgId);
      await tx
        .update(invoices)
        .set({
          contactId: input.contactId,
          number: input.number,
          issueDate: new Date(`${input.invoiceDate}T00:00:00Z`),
          dueDate: new Date(`${input.dueDate}T00:00:00Z`),
          currency,
          subtotalAmount: input.amountDue + input.retentionHeld,
          totalAmount: input.amountDue + input.retentionHeld,
          retentionAmount: input.retentionHeld,
          jobId: input.jobId,
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, id));
      const entryId = await this.postP18(tx, orgId, row.cutoverDate, id, input);
      await tx.update(invoices).set({ journalEntryId: entryId }).where(eq(invoices.id, id));
      await this.auditLog.record(tx, { orgId, actorUserId, action: "updated", entityType: "invoice", entityId: id, contactId: input.contactId, changes: { opening: true, number: input.number, amountDue: input.amountDue.toString() } });
    });
    return (await this.listInvoices(orgId)).find((i) => i.id === id)!;
  }

  /** Removes an opening invoice entered by mistake: its entry is reversed and the invoice goes. Only while unlocked and unpaid. */
  async deleteInvoice(orgId: string, actorUserId: string, id: string): Promise<{ id: string }> {
    await this.db.transaction(async (tx) => {
      const row = await this.opening.ensureDraft(tx, orgId);
      const existing = await this.loadInvoice(tx, orgId, id);
      if (existing.amountPaid > 0n || existing.creditedAmount > 0n) throw new BadRequestException(OPENING_DOCUMENT_HAS_ACTIVITY);
      if (existing.journalEntryId) await this.ledger.reverseEntry(tx, existing.journalEntryId, { orgId, date: dayBefore(row.cutoverDate), narration: `Opening invoice ${existing.number} removed`, sourceType: "opening_invoice_repost", sourceId: id });
      await tx.update(invoices).set({ journalEntryId: null }).where(eq(invoices.id, id));
      await tx.delete(invoices).where(eq(invoices.id, id));
      await this.auditLog.record(tx, { orgId, actorUserId, action: "deleted", entityType: "invoice", entityId: id, contactId: existing.contactId, changes: { opening: true, number: existing.number } });
    });
    return { id };
  }

  /**
   * CSV import (rows already read and mapped in the browser). Customers are
   * matched by name, ignoring case; if any don't match, nothing is imported
   * until the person chooses "Create these customers" or fixes the file.
   * Readable rows import; the rest are listed with the reason.
   */
  async importInvoices(orgId: string, actorUserId: string, input: OpeningInvoiceImportInput): Promise<OpeningImportResult> {
    const known = await this.db.select({ id: contacts.id, name: contacts.name, type: contacts.type }).from(contacts).where(eq(contacts.orgId, orgId));
    const byName = new Map(known.filter((c) => c.type !== "vendor").map((c) => [c.name.trim().toLowerCase(), c.id]));
    const unmatched = [...new Set(input.rows.map((r) => r.customer.trim()).filter((n) => !byName.has(n.toLowerCase())))];
    if (unmatched.length && !input.createCustomers) return { imported: 0, failed: [], unmatched };
    const jobRows = await this.db.select({ id: jobs.id, name: jobs.name, number: jobs.number }).from(jobs).where(eq(jobs.orgId, orgId));
    const jobByKey = new Map<string, string>();
    for (const j of jobRows) {
      jobByKey.set(j.name.trim().toLowerCase(), j.id);
      if (j.number) jobByKey.set(j.number.trim().toLowerCase(), j.id);
    }

    return this.db.transaction(async (tx) => {
      const row = await this.opening.ensureDraft(tx, orgId);
      for (const name of unmatched) {
        const [created] = await tx.insert(contacts).values({ orgId, type: "customer", name, createdByUserId: actorUserId }).returning({ id: contacts.id });
        byName.set(name.toLowerCase(), created!.id);
      }
      const failed: OpeningImportResult["failed"] = [];
      let imported = 0;
      for (const r of input.rows) {
        const jobId = r.job ? (jobByKey.get(r.job.trim().toLowerCase()) ?? null) : null;
        if (r.job && !jobId) {
          failed.push({ row: r.row, reason: `No job called ${r.job}.` });
          continue;
        }
        const parsed = {
          contactId: byName.get(r.customer.trim().toLowerCase())!,
          number: r.number.trim(),
          invoiceDate: r.invoiceDate,
          dueDate: r.dueDate,
          amountDue: /^\d+$/.test(r.amountDue) ? BigInt(r.amountDue) : null,
          retentionHeld: r.retentionHeld && /^\d+$/.test(r.retentionHeld) ? BigInt(r.retentionHeld) : 0n,
          jobId,
        };
        if (!parsed.number) {
          failed.push({ row: r.row, reason: "There's no invoice number." });
          continue;
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed.invoiceDate) || !/^\d{4}-\d{2}-\d{2}$/.test(parsed.dueDate)) {
          failed.push({ row: r.row, reason: "Couldn't read the dates." });
          continue;
        }
        if (parsed.amountDue === null) {
          failed.push({ row: r.row, reason: "Couldn't read the amount due." });
          continue;
        }
        // Each row is its own savepoint, so one bad row doesn't undo the rest.
        try {
          await tx.transaction(async (sp) => {
            await this.insertInvoice(sp as unknown as Transaction, orgId, actorUserId, row.cutoverDate, parsed as OpeningInvoiceInput);
          });
          imported += 1;
        } catch (err) {
          failed.push({ row: r.row, reason: err instanceof Error ? err.message : "Couldn't import this row." });
        }
      }
      return { imported, failed, unmatched: [] };
    });
  }

  async listCredits(orgId: string): Promise<OpeningCustomerCredit[]> {
    const rows = await this.db
      .select({ payment: payments, contactName: contacts.name })
      .from(payments)
      .innerJoin(contacts, eq(contacts.id, payments.contactId))
      .where(and(eq(payments.orgId, orgId), eq(payments.isOpening, true)))
      .orderBy(asc(contacts.name));
    return rows.map((r) => ({
      id: r.payment.id,
      contactId: r.payment.contactId,
      contactName: r.contactName,
      amount: r.payment.amount.toString(),
      available: (r.payment.amount - r.payment.allocatedAmount - r.payment.refundedAmount).toString(),
    }));
  }

  /** P19: Dr 3900 / Cr 2200 for the customer — credit they can use against invoices or have refunded. */
  async createCredit(orgId: string, actorUserId: string, input: { contactId: string; amount: bigint }): Promise<OpeningCustomerCredit> {
    const id = await this.db.transaction(async (tx) => {
      const row = await this.opening.ensureDraft(tx, orgId);
      await this.requireCustomer(tx, orgId, input.contactId);
      const { currency } = await orgMoneySettings(this.db, orgId);
      const id = randomUUID();
      const [adjustments, advances] = await Promise.all([this.ledger.resolveSystemAccount(tx, orgId, "openingBalanceAdjustments"), this.ledger.resolveSystemAccount(tx, orgId, "customerAdvances")]);
      const entryId = await this.ledger.postEntry(tx, {
        orgId,
        date: dayBefore(row.cutoverDate),
        narration: "Opening customer credit",
        sourceType: "opening_customer_credit",
        sourceId: id,
        lines: [
          { accountId: adjustments, debit: input.amount, credit: 0n },
          { accountId: advances, debit: 0n, credit: input.amount, contactId: input.contactId },
        ],
      });
      await tx.insert(payments).values({
        id,
        orgId,
        contactId: input.contactId,
        date: new Date(`${dayBefore(row.cutoverDate)}T00:00:00Z`),
        method: "other",
        reference: "Opening balance",
        currency,
        amount: input.amount,
        isOpening: true,
        journalEntryId: entryId,
        createdByUserId: actorUserId,
      });
      await this.auditLog.record(tx, { orgId, actorUserId, action: "created", entityType: "payment", entityId: id, contactId: input.contactId, changes: { opening: true, amount: input.amount.toString() } });
      return id;
    });
    return (await this.listCredits(orgId)).find((c) => c.id === id)!;
  }

  async deleteCredit(orgId: string, actorUserId: string, id: string): Promise<{ id: string }> {
    await this.db.transaction(async (tx) => {
      const row = await this.opening.ensureDraft(tx, orgId);
      const [credit] = await tx.select().from(payments).where(and(eq(payments.orgId, orgId), eq(payments.id, id), eq(payments.isOpening, true))).for("update");
      if (!credit) throw new NotFoundException("Opening credit not found");
      if (credit.allocatedAmount > 0n || credit.refundedAmount > 0n) throw new BadRequestException(OPENING_DOCUMENT_HAS_ACTIVITY);
      if (credit.journalEntryId) await this.ledger.reverseEntry(tx, credit.journalEntryId, { orgId, date: dayBefore(row.cutoverDate), narration: "Opening customer credit removed", sourceType: "opening_customer_credit_repost", sourceId: id });
      await tx.update(payments).set({ journalEntryId: null }).where(eq(payments.id, id));
      await tx.delete(payments).where(eq(payments.id, id));
      await this.auditLog.record(tx, { orgId, actorUserId, action: "deleted", entityType: "payment", entityId: id, contactId: credit.contactId, changes: { opening: true, amount: credit.amount.toString() } });
    });
    return { id };
  }

  private async insertInvoice(tx: Transaction, orgId: string, actorUserId: string, cutoverDate: string, input: OpeningInvoiceInput): Promise<string> {
    await this.validateInvoice(tx, orgId, cutoverDate, input);
    const { currency } = await orgMoneySettings(this.db, orgId);
    const id = randomUUID();
    await tx.insert(invoices).values({
      id,
      orgId,
      contactId: input.contactId,
      number: input.number,
      status: "issued",
      type: "opening",
      jobId: input.jobId,
      issueDate: new Date(`${input.invoiceDate}T00:00:00Z`),
      dueDate: new Date(`${input.dueDate}T00:00:00Z`),
      currency,
      subtotalAmount: input.amountDue + input.retentionHeld,
      totalAmount: input.amountDue + input.retentionHeld,
      retentionAmount: input.retentionHeld,
      issuedAt: new Date(),
      createdByUserId: actorUserId,
    });
    const entryId = await this.postP18(tx, orgId, cutoverDate, id, input);
    await tx.update(invoices).set({ journalEntryId: entryId }).where(eq(invoices.id, id));
    await this.auditLog.record(tx, { orgId, actorUserId, action: "created", entityType: "invoice", entityId: id, contactId: input.contactId, changes: { opening: true, number: input.number, amountDue: input.amountDue.toString(), retentionHeld: input.retentionHeld.toString() } });
    return id;
  }

  /** P18: Dr 1100 (amount due) and 1150 (retention, tagged with its job), contact-tagged / Cr 3900. */
  private async postP18(tx: Transaction, orgId: string, cutoverDate: string, invoiceId: string, input: OpeningInvoiceInput): Promise<string> {
    const [ar, retention, adjustments] = await Promise.all([
      this.ledger.resolveSystemAccount(tx, orgId, "accountsReceivable"),
      this.ledger.resolveSystemAccount(tx, orgId, "retentionReceivable"),
      this.ledger.resolveSystemAccount(tx, orgId, "openingBalanceAdjustments"),
    ]);
    return this.ledger.postEntry(tx, {
      orgId,
      date: dayBefore(cutoverDate),
      narration: `Opening invoice ${input.number}`,
      sourceType: "opening_invoice",
      sourceId: invoiceId,
      lines: [
        { accountId: ar, debit: input.amountDue, credit: 0n, contactId: input.contactId },
        { accountId: retention, debit: input.retentionHeld, credit: 0n, contactId: input.contactId, jobId: input.jobId },
        { accountId: adjustments, debit: 0n, credit: input.amountDue + input.retentionHeld },
      ],
    });
  }

  private async validateInvoice(tx: Transaction, orgId: string, cutoverDate: string, input: OpeningInvoiceInput, exceptId?: string) {
    await this.requireCustomer(tx, orgId, input.contactId);
    if (input.invoiceDate >= cutoverDate) {
      const { locale } = await orgMoneySettings(this.db, orgId);
      throw new BadRequestException(`An opening invoice is dated before the cutover date (${formatMessageDate(cutoverDate, locale)}).`);
    }
    if (input.jobId) {
      const [job] = await tx.select({ id: jobs.id }).from(jobs).where(and(eq(jobs.orgId, orgId), eq(jobs.id, input.jobId)));
      if (!job) throw new BadRequestException("That job isn't in Spine.");
    }
    const [taken] = await tx
      .select({ id: invoices.id })
      .from(invoices)
      .where(and(eq(invoices.orgId, orgId), sql`lower(${invoices.number}) = lower(${input.number})`, exceptId ? ne(invoices.id, exceptId) : undefined))
      .limit(1);
    if (taken) throw new ConflictException(OPENING_INVOICE_NUMBER_USED(input.number));
  }

  private async requireCustomer(tx: Transaction, orgId: string, contactId: string) {
    const [contact] = await tx.select({ id: contacts.id, type: contacts.type }).from(contacts).where(and(eq(contacts.orgId, orgId), eq(contacts.id, contactId)));
    if (!contact || contact.type === "vendor") throw new BadRequestException("Choose one of your customers.");
  }

  private async loadInvoice(tx: Transaction, orgId: string, id: string): Promise<InvoiceRow> {
    const [row] = await tx.select().from(invoices).where(and(eq(invoices.orgId, orgId), eq(invoices.id, id), eq(invoices.type, "opening"))).for("update");
    if (!row) throw new NotFoundException("Opening invoice not found");
    return row;
  }

  private toInvoice(row: InvoiceRow, contactName: string, job: { id: string; name: string; number: string | null } | null): OpeningInvoice {
    const amountDue = row.totalAmount - row.retentionAmount;
    return {
      id: row.id,
      contactId: row.contactId,
      contactName,
      number: row.number ?? "",
      invoiceDate: row.issueDate ? row.issueDate.toISOString().slice(0, 10) : "",
      dueDate: row.dueDate ? row.dueDate.toISOString().slice(0, 10) : "",
      amountDue: amountDue.toString(),
      retentionHeld: row.retentionAmount.toString(),
      job,
      balanceDue: (amountDue - row.amountPaid - row.creditedAmount).toString(),
      hasActivity: row.amountPaid > 0n || row.creditedAmount > 0n,
    };
  }
}
