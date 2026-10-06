import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { formatMoney, type createVendorCreditSchema, type updateVendorCreditSchema } from "@spine/shared";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { z } from "zod";
import { requireOwnershipCapability } from "../../auth/capability.util";
import { DATABASE } from "../../db/db.module";
import type { Database, Transaction } from "../../db/client";
import { accounts, contacts, vendorBills, vendorCreditAllocations, vendorCreditLines, vendorCredits } from "../../db/schema";
import { orgMoneySettings } from "../../common/money-format";
import { AuditLogService } from "../audit/audit-log.service";
import { LedgerService } from "../ledger/ledger.service";
import { NumberingService } from "../numbering/numbering.service";
import { TaxResolverService } from "../tax/tax-resolver.service";
import { computeBillTotals, type ComputedLine } from "./vendor-bills.service";

export type CreateVendorCreditInput = z.infer<typeof createVendorCreditSchema>;
export type UpdateVendorCreditInput = z.infer<typeof updateVendorCreditSchema>;

async function insertLines(tx: Transaction, vendorCreditId: string, lines: ComputedLine[]) {
  if (!lines.length) return;
  await tx.insert(vendorCreditLines).values(lines.map((line) => ({ vendorCreditId, ...line })));
}

/**
 * US-PUR-24 (D-141) — vendor credits: drafts edited like bills, then
 * recorded with a `VCR-` number and P24 (Dr 2000 AP / Cr each line's
 * account and 1200 Input Tax, contact- and job-tagged) in one
 * transaction. A recorded credit never changes; a mistake is voided.
 */
@Injectable()
export class VendorCreditsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly auditLog: AuditLogService,
    private readonly ledger: LedgerService,
    private readonly numbering: NumberingService,
    private readonly taxResolver: TaxResolverService,
  ) {}

  async list(orgId: string, options: { status?: string; contactId?: string }) {
    const rows = await this.db
      .select({ credit: vendorCredits, contactName: contacts.name })
      .from(vendorCredits)
      .leftJoin(contacts, eq(contacts.id, vendorCredits.contactId))
      .where(
        and(
          eq(vendorCredits.orgId, orgId),
          options.contactId ? eq(vendorCredits.contactId, options.contactId) : undefined,
          options.status ? eq(vendorCredits.status, options.status as "draft" | "open" | "used" | "void") : undefined,
        ),
      )
      .orderBy(desc(vendorCredits.createdAt));
    return rows.map((r) => ({ ...r.credit, contactName: r.contactName }));
  }

  async getOne(orgId: string, id: string) {
    const [row] = await this.db
      .select({ credit: vendorCredits, contactName: contacts.name, billNumber: vendorBills.billNumber })
      .from(vendorCredits)
      .leftJoin(contacts, eq(contacts.id, vendorCredits.contactId))
      .leftJoin(vendorBills, eq(vendorBills.id, vendorCredits.billId))
      .where(and(eq(vendorCredits.orgId, orgId), eq(vendorCredits.id, id)));
    if (!row) throw new NotFoundException("Vendor credit not found");
    const lines = await this.db.select().from(vendorCreditLines).where(eq(vendorCreditLines.vendorCreditId, id)).orderBy(vendorCreditLines.sortOrder);
    const allocations = await this.db
      .select({ id: vendorCreditAllocations.id, billId: vendorCreditAllocations.billId, billNumber: vendorBills.billNumber, amount: vendorCreditAllocations.amount, createdAt: vendorCreditAllocations.createdAt })
      .from(vendorCreditAllocations)
      .innerJoin(vendorBills, eq(vendorBills.id, vendorCreditAllocations.billId))
      .where(eq(vendorCreditAllocations.vendorCreditId, id))
      .orderBy(asc(vendorCreditAllocations.createdAt), asc(vendorBills.date), asc(vendorBills.billNumber));
    return { ...row.credit, contactName: row.contactName, billNumber: row.billNumber, lines, allocations };
  }

  async getHistory(orgId: string, id: string) {
    await this.getOne(orgId, id);
    return this.auditLog.listForEntity(orgId, "vendor_credit", id);
  }

  async create(orgId: string, actorUserId: string, input: CreateVendorCreditInput) {
    await this.requireVendorAndBill(orgId, input.contactId, input.billId ?? null);
    const totals = await computeBillTotals(orgId, input.currency, input.lines, this.taxResolver);
    const created = await this.db.transaction(async (tx) => {
      const [credit] = await tx
        .insert(vendorCredits)
        .values({
          orgId,
          contactId: input.contactId,
          vendorReference: input.vendorReference,
          billId: input.billId ?? null,
          jobId: input.jobId ?? null,
          date: input.date,
          currency: input.currency,
          subtotalAmount: totals.subtotalAmount,
          taxAmount: totals.taxAmount,
          totalAmount: totals.totalAmount,
          balanceAmount: totals.totalAmount,
          notes: input.notes ?? null,
          createdByUserId: actorUserId,
        })
        .returning();
      await insertLines(tx, credit!.id, totals.lines);
      await this.auditLog.record(tx, { orgId, actorUserId, action: "created", entityType: "vendor_credit", entityId: credit!.id, contactId: input.contactId, changes: [{ field: "status", from: null, to: "draft" }] });
      return credit!;
    });
    return this.getOne(orgId, created.id);
  }

  async update(orgId: string, id: string, actorUserId: string, input: UpdateVendorCreditInput) {
    const existing = await this.load(orgId, id);
    await requireOwnershipCapability(this.db, { orgId, userId: actorUserId }, existing.createdByUserId, { own: "vendor_credits.edit_own", others: "vendor_credits.edit_others" });
    if (existing.status !== "draft") throw new BadRequestException("A recorded vendor credit can't be edited. Void it and record a new one.");
    await this.requireVendorAndBill(orgId, input.contactId ?? existing.contactId, input.billId !== undefined ? input.billId : existing.billId);
    const currency = input.currency ?? existing.currency;
    const totals = input.lines !== undefined ? await computeBillTotals(orgId, currency, input.lines, this.taxResolver) : null;
    await this.db.transaction(async (tx) => {
      await tx
        .update(vendorCredits)
        .set({
          ...(input.contactId !== undefined ? { contactId: input.contactId } : {}),
          ...(input.vendorReference !== undefined ? { vendorReference: input.vendorReference } : {}),
          ...(input.billId !== undefined ? { billId: input.billId } : {}),
          ...(input.jobId !== undefined ? { jobId: input.jobId } : {}),
          ...(input.date !== undefined ? { date: input.date } : {}),
          ...(input.currency !== undefined ? { currency: input.currency } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          ...(totals ? { subtotalAmount: totals.subtotalAmount, taxAmount: totals.taxAmount, totalAmount: totals.totalAmount, balanceAmount: totals.totalAmount } : {}),
          updatedAt: new Date(),
        })
        .where(eq(vendorCredits.id, id));
      if (totals) {
        await tx.delete(vendorCreditLines).where(eq(vendorCreditLines.vendorCreditId, id));
        await insertLines(tx, id, totals.lines);
      }
      const { lines: _lines, ...scalars } = input;
      const changes = AuditLogService.diffFields(existing as unknown as Record<string, unknown>, scalars as Record<string, unknown>);
      if (changes.length) await this.auditLog.record(tx, { orgId, actorUserId, action: "updated", entityType: "vendor_credit", entityId: id, contactId: existing.contactId, changes });
    });
    return this.getOne(orgId, id);
  }

  async delete(orgId: string, id: string, actorUserId: string) {
    const existing = await this.load(orgId, id);
    await requireOwnershipCapability(this.db, { orgId, userId: actorUserId }, existing.createdByUserId, { own: "vendor_credits.delete_own", others: "vendor_credits.delete_others" });
    if (existing.status !== "draft") throw new BadRequestException("Only a draft vendor credit can be deleted. Void a recorded one instead.");
    await this.db.transaction(async (tx) => {
      await this.auditLog.record(tx, { orgId, actorUserId, action: "deleted", entityType: "vendor_credit", entityId: id, contactId: existing.contactId, changes: [{ field: "status", from: "draft", to: null }] });
      await tx.delete(vendorCredits).where(eq(vendorCredits.id, id));
    });
    return { id };
  }

  /** Numbers the credit `VCR-…` and posts P24, in one transaction under a lock on the credit. */
  async record(orgId: string, id: string, actorUserId: string) {
    await this.db.transaction(async (tx) => {
      const [credit] = await tx.select().from(vendorCredits).where(and(eq(vendorCredits.orgId, orgId), eq(vendorCredits.id, id))).for("update");
      if (!credit) throw new NotFoundException("Vendor credit not found");
      if (credit.status !== "draft") throw new BadRequestException("Only a draft vendor credit can be recorded.");
      if (credit.totalAmount <= 0n) throw new BadRequestException("Add a line with an amount before recording this credit.");

      const lines = await tx
        .select({ accountId: vendorCreditLines.accountId, subtotal: vendorCreditLines.lineSubtotalAmount })
        .from(vendorCreditLines)
        .where(and(eq(vendorCreditLines.vendorCreditId, id), eq(vendorCreditLines.type, "item")));
      const fallback = await this.defaultExpenseAccount(tx, orgId);
      const byAccount = new Map<string, bigint>();
      for (const line of lines) {
        if (line.subtotal === 0n) continue;
        const accountId = line.accountId ?? fallback;
        byAccount.set(accountId, (byAccount.get(accountId) ?? 0n) + line.subtotal);
      }
      const tag = { contactId: credit.contactId, jobId: credit.jobId };
      const ap = await this.ledger.resolveSystemAccount(tx, orgId, "accountsPayable");
      const postingLines = [
        { accountId: ap, debit: credit.totalAmount, credit: 0n, ...tag },
        ...[...byAccount.entries()].map(([accountId, amount]) => ({ accountId, debit: 0n, credit: amount, ...tag })),
      ];
      if (credit.taxAmount > 0n) postingLines.push({ accountId: await this.ledger.resolveSystemAccount(tx, orgId, "inputTaxReceivable"), debit: 0n, credit: credit.taxAmount, ...tag });

      const number = await this.numbering.allocateNumber(tx, orgId, "vendor_credit");
      const entryId = await this.ledger.postEntry(tx, {
        orgId,
        date: new Date(credit.date).toISOString().slice(0, 10),
        narration: `Vendor credit ${number} recorded`,
        sourceType: "vendor_credit",
        sourceId: id,
        lines: postingLines,
      });
      const recordedAt = new Date();
      await tx.update(vendorCredits).set({ status: "open", number, entryId, recordedAt, balanceAmount: credit.totalAmount, updatedAt: recordedAt }).where(eq(vendorCredits.id, id));
      await this.auditLog.record(tx, { orgId, actorUserId, action: "recorded", entityType: "vendor_credit", entityId: id, contactId: credit.contactId, changes: [{ field: "status", from: "draft", to: "open" }] });
    });
    return this.getOne(orgId, id);
  }

  /**
   * US-PUR-25 (P24a) — uses the credit against the vendor's recorded bills.
   * Nothing posts: the credit and the bills already sit in 2000 AP. Each
   * bill's `creditedAmount` and the credit's balance move under locks, and
   * a trigger keeps both within their totals.
   */
  async apply(orgId: string, actorUserId: string, id: string, allocations: { billId: string; amount: bigint }[]) {
    await this.db.transaction(async (tx) => {
      const [credit] = await tx.select().from(vendorCredits).where(and(eq(vendorCredits.orgId, orgId), eq(vendorCredits.id, id))).for("update");
      if (!credit) throw new NotFoundException("Vendor credit not found");
      if (credit.status !== "open") throw new BadRequestException("Only an open vendor credit can be applied.");
      const { locale } = await orgMoneySettings(this.db, orgId);
      const money = (amount: bigint) => formatMoney(amount > 0n ? amount : 0n, credit.currency, locale);
      const total = allocations.reduce((sum, a) => sum + a.amount, 0n);
      if (total > credit.balanceAmount) throw new BadRequestException(`This credit has ${money(credit.balanceAmount)} left to apply.`);

      const bills = await tx.select().from(vendorBills).where(and(eq(vendorBills.orgId, orgId), inArray(vendorBills.id, allocations.map((a) => a.billId)))).for("update");
      const byId = new Map(bills.map((b) => [b.id, b]));
      for (const a of allocations) {
        const bill = byId.get(a.billId);
        if (!bill || bill.contactId !== credit.contactId || bill.status !== "recorded") throw new BadRequestException("Apply this credit only to the vendor's recorded bills.");
        const balance = bill.totalAmount - bill.amountPaid - bill.creditedAmount;
        if (a.amount > balance) throw new BadRequestException(`You can apply up to ${money(balance)} to this bill.`);
      }
      for (const a of allocations) {
        const bill = byId.get(a.billId)!;
        await tx.insert(vendorCreditAllocations).values({ orgId, vendorCreditId: id, billId: a.billId, amount: a.amount, createdByUserId: actorUserId });
        await tx.update(vendorBills).set({ creditedAmount: bill.creditedAmount + a.amount, updatedAt: new Date() }).where(eq(vendorBills.id, a.billId));
        await this.auditLog.record(tx, { orgId, actorUserId, action: "credit_applied", entityType: "vendor_bill", entityId: a.billId, contactId: credit.contactId, changes: [{ field: "creditedAmount", from: bill.creditedAmount.toString(), to: (bill.creditedAmount + a.amount).toString() }] });
      }
      const balance = credit.balanceAmount - total;
      await tx.update(vendorCredits).set({ balanceAmount: balance, status: balance === 0n ? "used" : "open", updatedAt: new Date() }).where(eq(vendorCredits.id, id));
      await this.auditLog.record(tx, { orgId, actorUserId, action: "applied", entityType: "vendor_credit", entityId: id, contactId: credit.contactId, changes: [{ field: "balanceAmount", from: credit.balanceAmount.toString(), to: balance.toString() }] });
    });
    return this.getOne(orgId, id);
  }

  /** US-PUR-25 — undoes one application: the bill's balance and the credit's come back. */
  async removeAllocation(orgId: string, actorUserId: string, id: string, allocationId: string) {
    await this.db.transaction(async (tx) => {
      const [credit] = await tx.select().from(vendorCredits).where(and(eq(vendorCredits.orgId, orgId), eq(vendorCredits.id, id))).for("update");
      if (!credit) throw new NotFoundException("Vendor credit not found");
      const [allocation] = await tx.select().from(vendorCreditAllocations).where(and(eq(vendorCreditAllocations.id, allocationId), eq(vendorCreditAllocations.vendorCreditId, id)));
      if (!allocation) throw new NotFoundException("That application isn't on this credit.");
      const [bill] = await tx.select().from(vendorBills).where(eq(vendorBills.id, allocation.billId)).for("update");
      await tx.delete(vendorCreditAllocations).where(eq(vendorCreditAllocations.id, allocationId));
      await tx.update(vendorBills).set({ creditedAmount: bill!.creditedAmount - allocation.amount, updatedAt: new Date() }).where(eq(vendorBills.id, bill!.id));
      const balance = credit.balanceAmount + allocation.amount;
      await tx.update(vendorCredits).set({ balanceAmount: balance, status: "open", updatedAt: new Date() }).where(eq(vendorCredits.id, id));
      await this.auditLog.record(tx, { orgId, actorUserId, action: "application_removed", entityType: "vendor_credit", entityId: id, contactId: credit.contactId, changes: [{ field: "balanceAmount", from: credit.balanceAmount.toString(), to: balance.toString() }] });
    });
    return this.getOne(orgId, id);
  }

  private async load(orgId: string, id: string) {
    const [row] = await this.db.select().from(vendorCredits).where(and(eq(vendorCredits.orgId, orgId), eq(vendorCredits.id, id)));
    if (!row) throw new NotFoundException("Vendor credit not found");
    return row;
  }

  /** The vendor must be this organisation's; "against bill" must be one of that vendor's recorded bills. */
  private async requireVendorAndBill(orgId: string, contactId: string, billId: string | null) {
    const [contact] = await this.db.select({ id: contacts.id }).from(contacts).where(and(eq(contacts.orgId, orgId), eq(contacts.id, contactId)));
    if (!contact) throw new BadRequestException("Contact not found");
    if (!billId) return;
    const [bill] = await this.db.select().from(vendorBills).where(and(eq(vendorBills.orgId, orgId), eq(vendorBills.id, billId)));
    if (!bill || bill.contactId !== contactId || bill.status !== "recorded") throw new BadRequestException("Choose one of this vendor's recorded bills.");
  }

  private async defaultExpenseAccount(tx: Transaction, orgId: string): Promise<string> {
    const [row] = await tx.select({ id: accounts.id }).from(accounts).where(and(eq(accounts.orgId, orgId), eq(accounts.code, "6900")));
    if (!row) throw new BadRequestException("Choose an account on each line — the default 6900 Other Expenses is missing.");
    return row.id;
  }
}
