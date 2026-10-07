import { randomUUID } from "node:crypto";
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import {
  OPENING_BILL_NUMBER_USED,
  OPENING_DOCUMENT_HAS_ACTIVITY,
  dayBefore,
  type OpeningBill,
  type OpeningBillImportInput,
  type OpeningBillInput,
  type OpeningImportResult,
  type OpeningVendorCredit,
} from "@spine/shared";
import { formatMessageDate, orgMoneySettings } from "../../common/money-format";
import { DATABASE } from "../../db/db.module";
import type { Database, Transaction } from "../../db/client";
import { contacts, vendorBills, vendorCredits, vendorRefunds } from "../../db/schema";
import { AuditLogService } from "../audit/audit-log.service";
import { LedgerService } from "../ledger/ledger.service";
import { NumberingService } from "../numbering/numbering.service";
import { OpeningBalancesService } from "./opening-balances.service";

type BillRow = typeof vendorBills.$inferSelect;

/**
 * US-RPT-18 (D-137) — unpaid vendor bills and unused vendor credits brought
 * in from the old system. An opening bill is a recorded bill with
 * `is_opening`, the vendor's number and no lines; an opening vendor credit
 * is an open vendor credit with `is_opening` and a VCR number. Both post
 * P20 against 3900, dated the day before the cutover date, and are paid,
 * applied and refunded like any other.
 */
@Injectable()
export class OpeningBillsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly ledger: LedgerService,
    private readonly numbering: NumberingService,
    private readonly opening: OpeningBalancesService,
    private readonly auditLog: AuditLogService,
  ) {}

  async listBills(orgId: string): Promise<OpeningBill[]> {
    const rows = await this.db
      .select({ bill: vendorBills, contactName: contacts.name })
      .from(vendorBills)
      .innerJoin(contacts, eq(contacts.id, vendorBills.contactId))
      .where(and(eq(vendorBills.orgId, orgId), eq(vendorBills.isOpening, true)))
      .orderBy(asc(vendorBills.date), asc(vendorBills.billNumber));
    return rows.map((r) => this.toBill(r.bill, r.contactName));
  }

  async createBill(orgId: string, actorUserId: string, input: OpeningBillInput): Promise<OpeningBill> {
    const id = await this.db.transaction(async (tx) => {
      const row = await this.opening.ensureDraft(tx, orgId);
      return this.insertBill(tx, orgId, actorUserId, row.cutoverDate, input);
    });
    return (await this.listBills(orgId)).find((b) => b.id === id)!;
  }

  async updateBill(orgId: string, actorUserId: string, id: string, input: OpeningBillInput): Promise<OpeningBill> {
    await this.db.transaction(async (tx) => {
      const row = await this.opening.ensureDraft(tx, orgId);
      const existing = await this.loadBill(tx, orgId, id);
      if (existing.amountPaid > 0n || existing.creditedAmount > 0n) throw new BadRequestException(OPENING_DOCUMENT_HAS_ACTIVITY);
      await this.validateBill(tx, orgId, row.cutoverDate, input, id);
      if (existing.journalEntryId) await this.ledger.reverseEntry(tx, existing.journalEntryId, { orgId, date: dayBefore(row.cutoverDate), narration: `Opening bill ${existing.billNumber} changed`, sourceType: "opening_bill_repost", sourceId: id });
      await tx
        .update(vendorBills)
        .set({
          contactId: input.contactId,
          billNumber: input.billNumber,
          date: new Date(`${input.billDate}T00:00:00Z`),
          dueDate: new Date(`${input.dueDate}T00:00:00Z`),
          subtotalAmount: input.amountDue,
          totalAmount: input.amountDue,
          updatedAt: new Date(),
        })
        .where(eq(vendorBills.id, id));
      const entryId = await this.postBill(tx, orgId, row.cutoverDate, id, input);
      await tx.update(vendorBills).set({ journalEntryId: entryId }).where(eq(vendorBills.id, id));
      await this.auditLog.record(tx, { orgId, actorUserId, action: "updated", entityType: "vendor_bill", entityId: id, contactId: input.contactId, changes: { opening: true, billNumber: input.billNumber, amountDue: input.amountDue.toString() } });
    });
    return (await this.listBills(orgId)).find((b) => b.id === id)!;
  }

  async deleteBill(orgId: string, actorUserId: string, id: string): Promise<{ id: string }> {
    await this.db.transaction(async (tx) => {
      const row = await this.opening.ensureDraft(tx, orgId);
      const existing = await this.loadBill(tx, orgId, id);
      if (existing.amountPaid > 0n || existing.creditedAmount > 0n) throw new BadRequestException(OPENING_DOCUMENT_HAS_ACTIVITY);
      if (existing.journalEntryId) await this.ledger.reverseEntry(tx, existing.journalEntryId, { orgId, date: dayBefore(row.cutoverDate), narration: `Opening bill ${existing.billNumber} removed`, sourceType: "opening_bill_repost", sourceId: id });
      await tx.update(vendorBills).set({ journalEntryId: null }).where(eq(vendorBills.id, id));
      await tx.delete(vendorBills).where(eq(vendorBills.id, id));
      await this.auditLog.record(tx, { orgId, actorUserId, action: "deleted", entityType: "vendor_bill", entityId: id, contactId: existing.contactId, changes: { opening: true, billNumber: existing.billNumber } });
    });
    return { id };
  }

  /** CSV import, rows read in the browser; vendors matched by name, ignoring case (US-RPT-18, as US-RPT-17). */
  async importBills(orgId: string, actorUserId: string, input: OpeningBillImportInput): Promise<OpeningImportResult> {
    const known = await this.db.select({ id: contacts.id, name: contacts.name, type: contacts.type }).from(contacts).where(eq(contacts.orgId, orgId));
    const byName = new Map(known.filter((c) => c.type !== "customer").map((c) => [c.name.trim().toLowerCase(), c.id]));
    const unmatched = [...new Set(input.rows.map((r) => r.vendor.trim()).filter((n) => !byName.has(n.toLowerCase())))];
    if (unmatched.length && !input.createVendors) return { imported: 0, failed: [], unmatched };

    return this.db.transaction(async (tx) => {
      const row = await this.opening.ensureDraft(tx, orgId);
      for (const name of unmatched) {
        const [created] = await tx.insert(contacts).values({ orgId, type: "vendor", name, createdByUserId: actorUserId }).returning({ id: contacts.id });
        byName.set(name.toLowerCase(), created!.id);
      }
      const failed: OpeningImportResult["failed"] = [];
      let imported = 0;
      for (const r of input.rows) {
        if (!r.number) {
          failed.push({ row: r.row, reason: "There's no bill number." });
          continue;
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(r.billDate) || !/^\d{4}-\d{2}-\d{2}$/.test(r.dueDate)) {
          failed.push({ row: r.row, reason: "Couldn't read the dates." });
          continue;
        }
        if (!/^\d+$/.test(r.amountDue) || BigInt(r.amountDue) === 0n) {
          failed.push({ row: r.row, reason: "Couldn't read the amount due." });
          continue;
        }
        const input: OpeningBillInput = { contactId: byName.get(r.vendor.trim().toLowerCase())!, billNumber: r.number, billDate: r.billDate, dueDate: r.dueDate, amountDue: BigInt(r.amountDue) };
        try {
          await tx.transaction(async (sp) => {
            await this.insertBill(sp as unknown as Transaction, orgId, actorUserId, row.cutoverDate, input);
          });
          imported += 1;
        } catch (err) {
          failed.push({ row: r.row, reason: err instanceof Error ? err.message : "Couldn't import this row." });
        }
      }
      return { imported, failed, unmatched: [] };
    });
  }

  async listCredits(orgId: string): Promise<OpeningVendorCredit[]> {
    const rows = await this.db
      .select({ credit: vendorCredits, contactName: contacts.name })
      .from(vendorCredits)
      .innerJoin(contacts, eq(contacts.id, vendorCredits.contactId))
      .where(and(eq(vendorCredits.orgId, orgId), eq(vendorCredits.isOpening, true)))
      .orderBy(asc(contacts.name));
    return rows.map((r) => ({
      id: r.credit.id,
      contactId: r.credit.contactId,
      contactName: r.contactName,
      number: r.credit.number,
      vendorReference: r.credit.vendorReference,
      amount: r.credit.totalAmount.toString(),
      available: r.credit.balanceAmount.toString(),
    }));
  }

  /** P20 (credit): Dr 2000 AP for the vendor / Cr 3900. An open vendor credit, numbered VCR, to apply to bills or have refunded. */
  async createCredit(orgId: string, actorUserId: string, input: { contactId: string; amount: bigint; vendorReference: string | null }): Promise<OpeningVendorCredit> {
    const id = await this.db.transaction(async (tx) => {
      const row = await this.opening.ensureDraft(tx, orgId);
      await this.requireVendor(tx, orgId, input.contactId);
      const { currency } = await orgMoneySettings(this.db, orgId);
      const id = randomUUID();
      const [ap, adjustments] = await Promise.all([this.ledger.resolveSystemAccount(tx, orgId, "accountsPayable"), this.ledger.resolveSystemAccount(tx, orgId, "openingBalanceAdjustments")]);
      const entryId = await this.ledger.postEntry(tx, {
        orgId,
        date: dayBefore(row.cutoverDate),
        narration: "Opening vendor credit",
        sourceType: "opening_vendor_credit",
        sourceId: id,
        lines: [
          { accountId: ap, debit: input.amount, credit: 0n, contactId: input.contactId },
          { accountId: adjustments, debit: 0n, credit: input.amount },
        ],
      });
      const number = await this.numbering.allocateNumber(tx, orgId, "vendor_credit");
      await tx.insert(vendorCredits).values({
        id,
        orgId,
        number,
        vendorReference: input.vendorReference ?? "Opening balance",
        contactId: input.contactId,
        date: new Date(`${dayBefore(row.cutoverDate)}T00:00:00Z`),
        status: "open",
        currency,
        subtotalAmount: input.amount,
        totalAmount: input.amount,
        balanceAmount: input.amount,
        isOpening: true,
        recordedAt: new Date(),
        entryId,
        createdByUserId: actorUserId,
      });
      await this.auditLog.record(tx, { orgId, actorUserId, action: "created", entityType: "vendor_credit", entityId: id, contactId: input.contactId, changes: { opening: true, number, amount: input.amount.toString() } });
      return id;
    });
    return (await this.listCredits(orgId)).find((c) => c.id === id)!;
  }

  async deleteCredit(orgId: string, actorUserId: string, id: string): Promise<{ id: string }> {
    await this.db.transaction(async (tx) => {
      const row = await this.opening.ensureDraft(tx, orgId);
      const [credit] = await tx.select().from(vendorCredits).where(and(eq(vendorCredits.orgId, orgId), eq(vendorCredits.id, id), eq(vendorCredits.isOpening, true))).for("update");
      if (!credit) throw new NotFoundException("Opening vendor credit not found");
      const [refund] = await tx.select({ id: vendorRefunds.id }).from(vendorRefunds).where(eq(vendorRefunds.vendorCreditId, id)).limit(1);
      if (credit.balanceAmount !== credit.totalAmount || refund) throw new BadRequestException(OPENING_DOCUMENT_HAS_ACTIVITY);
      if (credit.entryId) await this.ledger.reverseEntry(tx, credit.entryId, { orgId, date: dayBefore(row.cutoverDate), narration: "Opening vendor credit removed", sourceType: "opening_vendor_credit_repost", sourceId: id });
      await tx.update(vendorCredits).set({ entryId: null }).where(eq(vendorCredits.id, id));
      await tx.delete(vendorCredits).where(eq(vendorCredits.id, id));
      await this.auditLog.record(tx, { orgId, actorUserId, action: "deleted", entityType: "vendor_credit", entityId: id, contactId: credit.contactId, changes: { opening: true, number: credit.number } });
    });
    return { id };
  }

  private async insertBill(tx: Transaction, orgId: string, actorUserId: string, cutoverDate: string, input: OpeningBillInput): Promise<string> {
    await this.validateBill(tx, orgId, cutoverDate, input);
    const { currency } = await orgMoneySettings(this.db, orgId);
    const id = randomUUID();
    await tx.insert(vendorBills).values({
      id,
      orgId,
      contactId: input.contactId,
      status: "recorded",
      billNumber: input.billNumber,
      date: new Date(`${input.billDate}T00:00:00Z`),
      dueDate: new Date(`${input.dueDate}T00:00:00Z`),
      currency,
      subtotalAmount: input.amountDue,
      totalAmount: input.amountDue,
      isOpening: true,
      createdByUserId: actorUserId,
    });
    const entryId = await this.postBill(tx, orgId, cutoverDate, id, input);
    await tx.update(vendorBills).set({ journalEntryId: entryId }).where(eq(vendorBills.id, id));
    await this.auditLog.record(tx, { orgId, actorUserId, action: "created", entityType: "vendor_bill", entityId: id, contactId: input.contactId, changes: { opening: true, billNumber: input.billNumber, amountDue: input.amountDue.toString() } });
    return id;
  }

  /** P20 (bill): Dr 3900 / Cr 2000 AP for the vendor. */
  private async postBill(tx: Transaction, orgId: string, cutoverDate: string, billId: string, input: OpeningBillInput): Promise<string> {
    const [ap, adjustments] = await Promise.all([this.ledger.resolveSystemAccount(tx, orgId, "accountsPayable"), this.ledger.resolveSystemAccount(tx, orgId, "openingBalanceAdjustments")]);
    return this.ledger.postEntry(tx, {
      orgId,
      date: dayBefore(cutoverDate),
      narration: `Opening bill ${input.billNumber}`,
      sourceType: "opening_bill",
      sourceId: billId,
      lines: [
        { accountId: adjustments, debit: input.amountDue, credit: 0n },
        { accountId: ap, debit: 0n, credit: input.amountDue, contactId: input.contactId },
      ],
    });
  }

  private async validateBill(tx: Transaction, orgId: string, cutoverDate: string, input: OpeningBillInput, exceptId?: string) {
    const vendor = await this.requireVendor(tx, orgId, input.contactId);
    if (input.billDate >= cutoverDate) {
      const { locale } = await orgMoneySettings(this.db, orgId);
      throw new BadRequestException(`An opening bill is dated before the cutover date (${formatMessageDate(cutoverDate, locale)}).`);
    }
    const [taken] = await tx
      .select({ id: vendorBills.id })
      .from(vendorBills)
      .where(and(eq(vendorBills.orgId, orgId), eq(vendorBills.contactId, input.contactId), sql`lower(${vendorBills.billNumber}) = lower(${input.billNumber})`, ne(vendorBills.status, "void"), exceptId ? ne(vendorBills.id, exceptId) : undefined))
      .limit(1);
    if (taken) throw new ConflictException(OPENING_BILL_NUMBER_USED(input.billNumber, vendor.name));
  }

  private async requireVendor(tx: Transaction, orgId: string, contactId: string) {
    const [contact] = await tx.select({ id: contacts.id, name: contacts.name, type: contacts.type }).from(contacts).where(and(eq(contacts.orgId, orgId), eq(contacts.id, contactId)));
    if (!contact || contact.type === "customer") throw new BadRequestException("Choose one of your vendors.");
    return contact;
  }

  private async loadBill(tx: Transaction, orgId: string, id: string): Promise<BillRow> {
    const [row] = await tx.select().from(vendorBills).where(and(eq(vendorBills.orgId, orgId), eq(vendorBills.id, id), eq(vendorBills.isOpening, true))).for("update");
    if (!row) throw new NotFoundException("Opening bill not found");
    return row;
  }

  private toBill(row: BillRow, contactName: string): OpeningBill {
    return {
      id: row.id,
      contactId: row.contactId,
      contactName,
      billNumber: row.billNumber,
      billDate: row.date.toISOString().slice(0, 10),
      dueDate: row.dueDate ? row.dueDate.toISOString().slice(0, 10) : "",
      amountDue: row.totalAmount.toString(),
      balanceDue: (row.totalAmount - row.amountPaid - row.creditedAmount).toString(),
      hasActivity: row.amountPaid > 0n || row.creditedAmount > 0n,
    };
  }
}
