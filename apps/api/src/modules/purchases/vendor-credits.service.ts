import { randomUUID } from "node:crypto";
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { formatMoney, type BulkResult, type createVendorCreditSchema, type PossibleDuplicateVendorCredit, type updateVendorCreditSchema, type VendorCreditActivityEntry } from "@spine/shared";
import { and, asc, count, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import type { z } from "zod";
import { requireOwnershipCapability } from "../../auth/capability.util";
import { DATABASE } from "../../db/db.module";
import type { Database, Transaction } from "../../db/client";
import { accounts, auditLog, contacts, jobs, moneyAccounts, user, vendorBills, vendorCreditAllocations, vendorCreditLines, vendorCredits, vendorRefunds } from "../../db/schema";
import { orgClock } from "../../common/org-clock";
import { MoneyAccountsService } from "../banking/money-accounts.service";
import { orgMoneySettings } from "../../common/money-format";
import { AuditLogService } from "../audit/audit-log.service";
import { LedgerService } from "../ledger/ledger.service";
import { NumberingService } from "../numbering/numbering.service";
import { TaxResolverService } from "../tax/tax-resolver.service";
import { PlaceOfSupplyService } from "../tax/place-of-supply.service";
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
    private readonly placeOfSupply: PlaceOfSupplyService,
    private readonly moneyAccounts: MoneyAccountsService,
  ) {}

  async list(orgId: string, options: { status?: string; contactId?: string }) {
    const rows = await this.db
      .select({ credit: vendorCredits, contactName: contacts.name, billNumber: vendorBills.billNumber, jobName: jobs.name })
      .from(vendorCredits)
      .leftJoin(contacts, eq(contacts.id, vendorCredits.contactId))
      .leftJoin(vendorBills, eq(vendorBills.id, vendorCredits.billId))
      .leftJoin(jobs, eq(jobs.id, vendorCredits.jobId))
      .where(
        and(
          eq(vendorCredits.orgId, orgId),
          options.contactId ? eq(vendorCredits.contactId, options.contactId) : undefined,
          options.status ? eq(vendorCredits.status, options.status as "draft" | "open" | "used" | "void") : undefined,
        ),
      )
      // US-PUR-38: newest by date first.
      .orderBy(desc(vendorCredits.date), desc(vendorCredits.createdAt));
    return rows.map((r) => ({ ...r.credit, contactName: r.contactName, billNumber: r.billNumber, jobName: r.jobName }));
  }

  async getOne(orgId: string, id: string) {
    const [row] = await this.db
      .select({ credit: vendorCredits, contactName: contacts.name, billNumber: vendorBills.billNumber, jobName: jobs.name })
      .from(vendorCredits)
      .leftJoin(contacts, eq(contacts.id, vendorCredits.contactId))
      .leftJoin(vendorBills, eq(vendorBills.id, vendorCredits.billId))
      .leftJoin(jobs, eq(jobs.id, vendorCredits.jobId))
      .where(and(eq(vendorCredits.orgId, orgId), eq(vendorCredits.id, id)));
    if (!row) throw new NotFoundException("Vendor credit not found");
    // US-PUR-37: each line names the account it credits.
    const lines = (
      await this.db
        .select({ line: vendorCreditLines, accountCode: accounts.code, accountName: accounts.name })
        .from(vendorCreditLines)
        .leftJoin(accounts, eq(accounts.id, vendorCreditLines.accountId))
        .where(eq(vendorCreditLines.vendorCreditId, id))
        .orderBy(vendorCreditLines.sortOrder)
    ).map((r) => ({ ...r.line, accountCode: r.accountCode, accountName: r.accountName }));
    const allocations = await this.db
      .select({ id: vendorCreditAllocations.id, billId: vendorCreditAllocations.billId, billNumber: vendorBills.billNumber, amount: vendorCreditAllocations.amount, createdAt: vendorCreditAllocations.createdAt })
      .from(vendorCreditAllocations)
      .innerJoin(vendorBills, eq(vendorBills.id, vendorCreditAllocations.billId))
      .where(eq(vendorCreditAllocations.vendorCreditId, id))
      .orderBy(asc(vendorCreditAllocations.createdAt), asc(vendorBills.date), asc(vendorBills.billNumber));
    const refunds = await this.db
      .select({ id: vendorRefunds.id, amount: vendorRefunds.amount, date: vendorRefunds.date, method: vendorRefunds.method, reference: vendorRefunds.reference, deletedAt: vendorRefunds.deletedAt, moneyAccountName: moneyAccounts.name })
      .from(vendorRefunds)
      .innerJoin(moneyAccounts, eq(moneyAccounts.id, vendorRefunds.moneyAccountId))
      .where(eq(vendorRefunds.vendorCreditId, id))
      .orderBy(asc(vendorRefunds.createdAt));
    return { ...row.credit, contactName: row.contactName, billNumber: row.billNumber, jobName: row.jobName, lines, allocations, refunds };
  }

  /**
   * US-PUR-37 (D-226) — what happened to the credit, newest first: created,
   * recorded (with the total), removed from a bill, refund deleted and
   * voided (with the reason) from the audit log; each application to a
   * bill and each refund from their own rows, with who made them.
   */
  async activity(orgId: string, id: string): Promise<VendorCreditActivityEntry[]> {
    const credit = await this.getOne(orgId, id);
    const iso = (d: Date | string) => new Date(d).toISOString();
    const entries: VendorCreditActivityEntry[] = [];
    const audit = await this.db
      .select({ action: auditLog.action, changes: auditLog.changes, at: auditLog.createdAt, actorName: user.name })
      .from(auditLog)
      .leftJoin(user, eq(auditLog.actorUserId, user.id))
      .where(and(eq(auditLog.orgId, orgId), eq(auditLog.entityType, "vendor_credit"), eq(auditLog.entityId, id)));
    for (const row of audit) {
      const changes = (Array.isArray(row.changes) ? row.changes : []) as { field: string; from: unknown; to: unknown }[];
      const change = (field: string) => changes.find((c) => c.field === field);
      const moved = () => {
        const c = change("balanceAmount");
        return c ? (BigInt(String(c.to)) - BigInt(String(c.from))).toString() : null;
      };
      const actor = row.actorName ?? null;
      if (row.action === "created") entries.push({ type: "created", at: iso(row.at), actorName: actor });
      else if (row.action === "recorded") entries.push({ type: "recorded", at: iso(row.at), actorName: actor, amount: credit.totalAmount.toString() });
      else if (row.action === "application_removed") {
        const bill = change("bill");
        entries.push({ type: "unapplied", at: iso(row.at), actorName: actor, amount: moved(), detail: typeof bill?.from === "string" ? bill.from : null });
      } else if (row.action === "refund_deleted") entries.push({ type: "refund_deleted", at: iso(row.at), actorName: actor, amount: moved() });
      else if (row.action === "voided") {
        const reason = change("voidReason")?.to;
        entries.push({ type: "voided", at: iso(row.at), actorName: actor, detail: typeof reason === "string" ? reason : credit.voidReason });
      }
    }
    const applied = await this.db
      .select({ amount: vendorCreditAllocations.amount, at: vendorCreditAllocations.createdAt, billId: vendorBills.id, billNumber: vendorBills.billNumber, actorName: user.name })
      .from(vendorCreditAllocations)
      .innerJoin(vendorBills, eq(vendorBills.id, vendorCreditAllocations.billId))
      .leftJoin(user, eq(vendorCreditAllocations.createdByUserId, user.id))
      .where(eq(vendorCreditAllocations.vendorCreditId, id));
    for (const a of applied) entries.push({ type: "applied", at: iso(a.at), actorName: a.actorName ?? null, amount: a.amount.toString(), detail: a.billNumber, linkId: a.billId });
    const refunds = await this.db
      .select({ amount: vendorRefunds.amount, at: vendorRefunds.createdAt, actorName: user.name })
      .from(vendorRefunds)
      .leftJoin(user, eq(vendorRefunds.createdByUserId, user.id))
      .where(eq(vendorRefunds.vendorCreditId, id));
    for (const r of refunds) entries.push({ type: "refunded", at: iso(r.at), actorName: r.actorName ?? null, amount: r.amount.toString() });
    return entries.sort((a, b) => b.at.localeCompare(a.at));
  }

  /**
   * US-PUR-39 — this vendor's credits (not void) with the same credit note
   * number, ignoring case and spaces: a warning before entering one twice;
   * the caller can still save.
   */
  async possibleDuplicates(orgId: string, query: { contactId: string; vendorReference: string; excludeId?: string }): Promise<PossibleDuplicateVendorCredit[]> {
    const wanted = query.vendorReference.replace(/\s+/g, "").toLowerCase();
    if (!wanted) return [];
    const rows = await this.db
      .select()
      .from(vendorCredits)
      .where(
        and(
          eq(vendorCredits.orgId, orgId),
          eq(vendorCredits.contactId, query.contactId),
          ne(vendorCredits.status, "void"),
          sql`lower(regexp_replace(coalesce(${vendorCredits.vendorReference}, ''), '[[:space:]]', '', 'g')) = ${wanted}`,
          query.excludeId ? ne(vendorCredits.id, query.excludeId) : undefined,
        ),
      )
      .orderBy(desc(vendorCredits.date))
      .limit(3);
    return rows.map((c) => ({
      id: c.id,
      number: c.number,
      vendorReference: c.vendorReference,
      date: new Date(c.date).toISOString().slice(0, 10),
      totalAmount: c.totalAmount.toString(),
      currency: c.currency,
      status: c.status,
    }));
  }

  /**
   * US-PUR-41 — records each draft in its own transaction (P11), so one
   * that can't be recorded doesn't stop the rest; the skipped ones say why.
   */
  async bulkRecord(orgId: string, ids: string[], actorUserId: string): Promise<BulkResult> {
    const done: string[] = [];
    const skipped: BulkResult["skipped"] = [];
    const rows = await this.db.select({ id: vendorCredits.id, number: vendorCredits.number, vendorReference: vendorCredits.vendorReference, status: vendorCredits.status }).from(vendorCredits).where(and(eq(vendorCredits.orgId, orgId), inArray(vendorCredits.id, [...new Set(ids)])));
    const byId = new Map(rows.map((r) => [r.id, r]));
    for (const id of [...new Set(ids)]) {
      const credit = byId.get(id);
      if (!credit) {
        skipped.push({ id, label: null, reason: "Not found." });
        continue;
      }
      const label = credit.number ?? credit.vendorReference;
      if (credit.status === "void") {
        skipped.push({ id, label, reason: "It's void." });
        continue;
      }
      if (credit.status !== "draft") {
        skipped.push({ id, label, reason: "It's already recorded." });
        continue;
      }
      try {
        await this.record(orgId, id, actorUserId);
        done.push(id);
      } catch (err) {
        skipped.push({ id, label, reason: err instanceof Error ? err.message : "It couldn't be recorded." });
      }
    }
    return { done, skipped };
  }

  async getHistory(orgId: string, id: string) {
    await this.getOne(orgId, id);
    return this.auditLog.listForEntity(orgId, "vendor_credit", id);
  }

  /** `isDemo` (US-ONB-30): a credit the demo loads; one a person records for a demo vendor stays theirs (D-191). */
  async create(orgId: string, actorUserId: string, input: CreateVendorCreditInput, isDemo = false) {
    await this.requireVendorAndBill(orgId, input.contactId, input.billId ?? null);
    const totals = await computeBillTotals(orgId, input.currency, input.lines, this.taxResolver);
    // US-TAX-13: the vendor's state, unless one is given.
    const supply = await this.placeOfSupply.resolve(orgId, input.contactId, input.placeOfSupply, "purchase");
    const created = await this.db.transaction(async (tx) => {
      const [credit] = await tx
        .insert(vendorCredits)
        .values({
          orgId,
          isDemo,
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
          placeOfSupply: supply.placeOfSupply, supplyType: supply.supplyType,
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
    // US-TAX-13: the vendor's state decides intra- or inter-state; a new vendor (or a draft from before GST) takes the vendor's.
    const supply = await this.placeOfSupply.resolve(
      orgId,
      input.contactId ?? existing.contactId,
      input.placeOfSupply !== undefined ? input.placeOfSupply : (input.contactId !== undefined && input.contactId !== existing.contactId) || existing.placeOfSupply === null ? undefined : existing.placeOfSupply,
      "purchase",
    );
    await this.db.transaction(async (tx) => {
      await tx
        .update(vendorCredits)
        .set({
          placeOfSupply: supply.placeOfSupply, supplyType: supply.supplyType,
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
      // US-TAX-13: the place of supply is snapshotted when recorded.
      const supply = await this.placeOfSupply.resolve(orgId, credit.contactId, credit.placeOfSupply ?? undefined, "purchase", tx);
      await tx.update(vendorCredits).set({ status: "open", number, entryId, recordedAt, balanceAmount: credit.totalAmount, updatedAt: recordedAt, ...supply }).where(eq(vendorCredits.id, id));
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
      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "application_removed",
        entityType: "vendor_credit",
        entityId: id,
        contactId: credit.contactId,
        changes: [
          { field: "balanceAmount", from: credit.balanceAmount.toString(), to: balance.toString() },
          { field: "bill", from: bill!.billNumber, to: null },
        ],
      });
    });
    return this.getOne(orgId, id);
  }

  /** US-PUR-26 — the vendor paid some of the credit back: P25 (Dr money account / Cr 2000 AP), and the balance drops. */
  async recordRefund(orgId: string, actorUserId: string, id: string, input: { amount: bigint; date: Date; moneyAccountId?: string | null; method: "cash" | "bank_transfer" | "cheque" | "card" | "upi" | "other"; reference?: string | null }) {
    await this.db.transaction(async (tx) => {
      const [credit] = await tx.select().from(vendorCredits).where(and(eq(vendorCredits.orgId, orgId), eq(vendorCredits.id, id))).for("update");
      if (!credit) throw new NotFoundException("Vendor credit not found");
      if (credit.status !== "open") throw new BadRequestException("Only an open vendor credit can be refunded.");
      if (input.amount > credit.balanceAmount) {
        const { locale } = await orgMoneySettings(this.db, orgId);
        throw new BadRequestException(`This credit has ${formatMoney(credit.balanceAmount, credit.currency, locale)} left to refund.`);
      }
      const moneyAccount = await this.moneyAccounts.resolveForPosting(tx, orgId, input.moneyAccountId);
      const refundId = randomUUID();
      const ap = await this.ledger.resolveSystemAccount(tx, orgId, "accountsPayable");
      const entryId = await this.ledger.postEntry(tx, {
        orgId,
        date: new Date(input.date).toISOString().slice(0, 10),
        narration: `Refund from vendor against ${credit.number}`,
        sourceType: "vendor_refund",
        sourceId: refundId,
        // US-ONB-30: a refund of a demo credit is demo money (its row isn't written yet).
        isDemo: credit.isDemo,
        lines: [
          { accountId: moneyAccount.accountId, debit: input.amount, credit: 0n, contactId: credit.contactId },
          { accountId: ap, debit: 0n, credit: input.amount, contactId: credit.contactId },
        ],
      });
      await tx.insert(vendorRefunds).values({ id: refundId, orgId, vendorCreditId: id, moneyAccountId: moneyAccount.id, amount: input.amount, date: input.date, method: input.method, reference: input.reference || null, entryId, createdByUserId: actorUserId, isDemo: credit.isDemo });
      const balance = credit.balanceAmount - input.amount;
      await tx.update(vendorCredits).set({ balanceAmount: balance, status: balance === 0n ? "used" : "open", updatedAt: new Date() }).where(eq(vendorCredits.id, id));
      await this.moneyAccounts.rememberLastUsed(tx, actorUserId, "refund", moneyAccount.id);
      await this.auditLog.record(tx, { orgId, actorUserId, action: "refunded", entityType: "vendor_credit", entityId: id, contactId: credit.contactId, changes: [{ field: "balanceAmount", from: credit.balanceAmount.toString(), to: balance.toString() }] });
    });
    return this.getOne(orgId, id);
  }

  /** US-PUR-26 — deleting a refund posts the reversal (dated today) and gives the credit its balance back. */
  async deleteRefund(orgId: string, actorUserId: string, refundId: string) {
    let creditId = "";
    await this.db.transaction(async (tx) => {
      const [refund] = await tx.select().from(vendorRefunds).where(and(eq(vendorRefunds.orgId, orgId), eq(vendorRefunds.id, refundId))).for("update");
      if (!refund) throw new NotFoundException("Refund not found");
      if (refund.deletedAt) throw new BadRequestException("This refund has already been deleted.");
      creditId = refund.vendorCreditId;
      const [credit] = await tx.select().from(vendorCredits).where(eq(vendorCredits.id, refund.vendorCreditId)).for("update");
      const reversalEntryId = await this.ledger.reverseEntry(tx, refund.entryId, { orgId, date: orgClock().date, narration: "Vendor refund deleted", sourceType: "vendor_refund_delete", sourceId: refundId });
      await tx.update(vendorRefunds).set({ deletedAt: new Date(), reversalEntryId, updatedAt: new Date() }).where(eq(vendorRefunds.id, refundId));
      const balance = credit!.balanceAmount + refund.amount;
      await tx.update(vendorCredits).set({ balanceAmount: balance, status: credit!.status === "void" ? "void" : "open", updatedAt: new Date() }).where(eq(vendorCredits.id, credit!.id));
      await this.auditLog.record(tx, { orgId, actorUserId, action: "refund_deleted", entityType: "vendor_credit", entityId: credit!.id, contactId: credit!.contactId, changes: [{ field: "balanceAmount", from: credit!.balanceAmount.toString(), to: balance.toString() }] });
    });
    return this.getOne(orgId, creditId);
  }

  /**
   * US-PUR-27 — voids a credit entered by mistake: posts P24's reversal
   * (dated today) and marks it "Void — <reason>". Only with nothing applied
   * or refunded; those are removed first.
   */
  async void(orgId: string, actorUserId: string, id: string, reason: string) {
    await this.db.transaction(async (tx) => {
      const [credit] = await tx.select().from(vendorCredits).where(and(eq(vendorCredits.orgId, orgId), eq(vendorCredits.id, id))).for("update");
      if (!credit) throw new NotFoundException("Vendor credit not found");
      if (credit.status === "draft") throw new BadRequestException("A draft can be deleted instead of voided.");
      if (credit.status === "void") throw new BadRequestException("This vendor credit is already void.");
      // US-RPT-18: an opening vendor credit is removed in Opening balances (while unlocked).
      if (credit.isOpening) throw new BadRequestException("An opening vendor credit can't be voided. Remove it in Settings › Opening balances.");
      const [[applied], [refunded]] = await Promise.all([
        tx.select({ n: count() }).from(vendorCreditAllocations).where(eq(vendorCreditAllocations.vendorCreditId, id)),
        tx.select({ n: count() }).from(vendorRefunds).where(and(eq(vendorRefunds.vendorCreditId, id), isNull(vendorRefunds.deletedAt))),
      ]);
      const n = Number(applied!.n) + Number(refunded!.n);
      if (n > 0) throw new BadRequestException(`Remove its ${n} applications and refunds first.`);
      const voidEntryId = await this.ledger.reverseEntry(tx, credit.entryId!, { orgId, date: orgClock().date, narration: `Vendor credit ${credit.number} voided: ${reason}`, sourceType: "vendor_credit_void", sourceId: id });
      await tx.update(vendorCredits).set({ status: "void", voidReason: reason, voidedAt: new Date(), voidEntryId, balanceAmount: 0n, updatedAt: new Date() }).where(eq(vendorCredits.id, id));
      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "voided",
        entityType: "vendor_credit",
        entityId: id,
        contactId: credit.contactId,
        changes: [
          { field: "status", from: credit.status, to: "void" },
          { field: "voidReason", from: null, to: reason },
        ],
      });
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
