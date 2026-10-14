import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { contactIsDemo } from "../../common/demo";
import type { PossibleDuplicateVendorPayment, VendorPaymentActivityEntry, VendorPaymentsSummary, createVendorPaymentSchema } from "@spine/shared";
import { and, asc, desc, eq, gt, inArray, lt, or, sql } from "drizzle-orm";
import type { z } from "zod";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { auditLog, bankStatementLineMatches, journalLines, moneyAccounts, settings, user, vendorPayments, vendorPaymentAllocations, vendorBills, contacts } from "../../db/schema";
import { orgClock } from "../../common/org-clock";
import { MoneyAccountsService } from "../banking/money-accounts.service";
import { AuditLogService } from "../audit/audit-log.service";
import { requireOwnershipCapability } from "../../auth/capability.util";
import { NumberingService } from "../numbering/numbering.service";
import { LedgerService } from "../ledger/ledger.service";

export type CreateVendorPaymentInput = z.infer<typeof createVendorPaymentSchema>;

/**
 * PRD FEAT-07 (S-07.8) — records a payment to a vendor, allocated across
 * one or more of their bills, structurally mirroring PaymentsService
 * exactly (row-lock-free single-transaction create since there's no
 * concurrent-issue race to guard against here, allocation validated
 * app-side then DB-enforced via the trigger alongside this schema —
 * 0029_vendor_payment_allocation_limits.sql). Unlike the customer side,
 * `allocations` must sum to exactly `amount` — see
 * createVendorPaymentSchema's own doc comment on why there's no
 * vendor-credit concept in this phase.
 */
@Injectable()
export class VendorPaymentsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly auditLog: AuditLogService,
    private readonly numbering: NumberingService,
    private readonly ledger: LedgerService,
    private readonly moneyAccounts: MoneyAccountsService,
  ) {}

  /** US-PUR-51 (D-229) — newest first, each with the account it was paid from and the bills it paid. */
  async list(orgId: string, options: { contactId?: string }) {
    const conditions = [eq(vendorPayments.orgId, orgId)];
    if (options.contactId) conditions.push(eq(vendorPayments.contactId, options.contactId));

    const rows = await this.db
      .select({ payment: vendorPayments, contactName: contacts.name, moneyAccountName: moneyAccounts.name })
      .from(vendorPayments)
      .leftJoin(contacts, eq(vendorPayments.contactId, contacts.id))
      .leftJoin(moneyAccounts, eq(vendorPayments.moneyAccountId, moneyAccounts.id))
      .where(and(...conditions))
      .orderBy(desc(vendorPayments.date), desc(vendorPayments.createdAt));
    const ids = rows.map((r) => r.payment.id);
    const paid = ids.length
      ? await this.db
          .select({ paymentId: vendorPaymentAllocations.vendorPaymentId, billId: vendorBills.id, number: vendorBills.billNumber, dueDate: vendorBills.dueDate })
          .from(vendorPaymentAllocations)
          .innerJoin(vendorBills, eq(vendorPaymentAllocations.billId, vendorBills.id))
          .where(inArray(vendorPaymentAllocations.vendorPaymentId, ids))
          .orderBy(asc(vendorBills.dueDate), asc(vendorBills.billNumber))
      : [];
    const byPayment = new Map<string, { billId: string; number: string }[]>();
    for (const p of paid) byPayment.set(p.paymentId, [...(byPayment.get(p.paymentId) ?? []), { billId: p.billId, number: p.number }]);
    return rows.map((r) => ({ ...r.payment, contactName: r.contactName, moneyAccountName: r.moneyAccountName, paidTo: byPayment.get(r.payment.id) ?? [] }));
  }

  /** Every vendor payment with at least one allocation against `billId` — mirrors PaymentsService.listForInvoice exactly. */
  async listForBill(orgId: string, billId: string) {
    const rows = await this.db
      .select({ payment: vendorPayments, contactName: contacts.name, allocatedToThisBill: vendorPaymentAllocations.amount })
      .from(vendorPaymentAllocations)
      .innerJoin(vendorPayments, eq(vendorPaymentAllocations.vendorPaymentId, vendorPayments.id))
      .leftJoin(contacts, eq(vendorPayments.contactId, contacts.id))
      .where(and(eq(vendorPayments.orgId, orgId), eq(vendorPaymentAllocations.billId, billId)))
      .orderBy(asc(vendorPayments.date));

    return rows.map((r) => ({ ...r.payment, contactName: r.contactName, allocatedToThisBill: r.allocatedToThisBill }));
  }

  async getOne(orgId: string, id: string) {
    const [row] = await this.db
      .select({ payment: vendorPayments, contactName: contacts.name })
      .from(vendorPayments)
      .leftJoin(contacts, eq(vendorPayments.contactId, contacts.id))
      .where(and(eq(vendorPayments.orgId, orgId), eq(vendorPayments.id, id)));
    if (!row) {
      throw new NotFoundException("Vendor payment not found");
    }

    const allocations = await this.db
      .select({ allocation: vendorPaymentAllocations, bill: vendorBills })
      .from(vendorPaymentAllocations)
      .innerJoin(vendorBills, eq(vendorPaymentAllocations.billId, vendorBills.id))
      .where(eq(vendorPaymentAllocations.vendorPaymentId, id))
      .orderBy(asc(vendorBills.dueDate), asc(vendorBills.billNumber));

    const refs = await this.moneyAccounts.refs(orgId, [row.payment.moneyAccountId]);
    const day = (d: Date | string | null) => (d ? (typeof d === "string" ? d : d.toISOString()).slice(0, 10) : null);
    return {
      ...row.payment,
      contactName: row.contactName,
      moneyAccount: row.payment.moneyAccountId ? (refs.get(row.payment.moneyAccountId) ?? null) : null,
      allocations: allocations.map((a) => ({ ...a.allocation, billNumber: a.bill.billNumber, billTotal: a.bill.totalAmount })),
      // US-PUR-49: each bill it paid, what it put there and what the bill still owes.
      paidTo: allocations.map((a) => ({
        allocationId: a.allocation.id,
        billId: a.bill.id,
        billNumber: a.bill.billNumber,
        billDate: day(a.bill.date),
        billTotal: a.bill.totalAmount.toString(),
        billBalance: (a.bill.totalAmount - a.bill.amountPaid - a.bill.creditedAmount).toString(),
        dueDate: day(a.bill.dueDate),
        amount: a.allocation.amount.toString(),
      })),
      // US-PUR-50: a payment matched to a bank statement line can't be deleted until it's unmatched.
      reconciled: await this.isReconciled(row.payment.journalEntryId),
    };
  }

  private async isReconciled(journalEntryId: string | null): Promise<boolean> {
    if (!journalEntryId) return false;
    const [match] = await this.db
      .select({ id: bankStatementLineMatches.id })
      .from(bankStatementLineMatches)
      .innerJoin(journalLines, eq(bankStatementLineMatches.journalLineId, journalLines.id))
      .where(eq(journalLines.entryId, journalEntryId))
      .limit(1);
    return Boolean(match);
  }

  /** US-PUR-49 — the payment's story: recorded, each bill it paid, remittance advice emailed; newest first. */
  async activity(orgId: string, id: string): Promise<VendorPaymentActivityEntry[]> {
    const payment = await this.getOne(orgId, id);
    const iso = (d: Date | string) => new Date(d).toISOString();
    const audit = await this.db
      .select({ action: auditLog.action, changes: auditLog.changes, at: auditLog.createdAt, actorName: user.name })
      .from(auditLog)
      .leftJoin(user, eq(auditLog.actorUserId, user.id))
      .where(and(eq(auditLog.orgId, orgId), eq(auditLog.entityType, "vendor_payment"), eq(auditLog.entityId, id)));
    const entries: VendorPaymentActivityEntry[] = [];
    const recordedBy = audit.find((a) => a.action === "created")?.actorName ?? null;
    const recordedAt = audit.find((a) => a.action === "created")?.at ?? payment.createdAt;
    entries.push({ type: "recorded", at: iso(recordedAt), actorName: recordedBy, amount: payment.amount.toString(), account: payment.moneyAccount?.name ?? null, method: payment.method });
    for (const a of payment.paidTo) {
      const created = payment.allocations.find((x) => x.id === a.allocationId)?.createdAt ?? payment.createdAt;
      entries.push({ type: "applied", at: iso(created), actorName: recordedBy, amount: a.amount, detail: a.billNumber, linkId: a.billId });
    }
    for (const row of audit.filter((a) => a.action === "remittance_sent")) {
      const changes = (Array.isArray(row.changes) ? row.changes : []) as { field: string; to: unknown }[];
      const to = changes.find((c) => c.field === "email")?.to;
      entries.push({ type: "remittance_emailed", at: iso(row.at), actorName: row.actorName ?? null, detail: typeof to === "string" ? to : null });
    }
    // Same moment: what it paid reads above "Recorded".
    const rank = { remittance_emailed: 0, applied: 1, recorded: 2 } as const;
    return entries.sort((a, b) => b.at.localeCompare(a.at) || rank[a.type] - rank[b.type]);
  }

  /** US-PUR-51 — the list's cards, in the business's currency: paid this month and last (by payment date), and overdue bills still to pay. */
  async summary(orgId: string): Promise<VendorPaymentsSummary> {
    const [currencyRow] = await this.db.select({ value: settings.value }).from(settings).where(and(eq(settings.orgId, orgId), eq(settings.key, "currency")));
    const currency = (currencyRow?.value as { code?: string } | undefined)?.code ?? "USD";
    const today = orgClock().date;
    const thisMonth = `${today.slice(0, 7)}-01`;
    const [y, m] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))];
    const lastMonth = `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, "0")}-01`;
    const [paid] = await this.db
      .select({
        thisMonth: sql<string>`coalesce(sum(${vendorPayments.amount}) filter (where ${vendorPayments.date} >= ${thisMonth}::date), 0)::text`,
        thisMonthCount: sql<number>`(count(*) filter (where ${vendorPayments.date} >= ${thisMonth}::date))::int`,
        lastMonth: sql<string>`coalesce(sum(${vendorPayments.amount}) filter (where ${vendorPayments.date} >= ${lastMonth}::date and ${vendorPayments.date} < ${thisMonth}::date), 0)::text`,
        lastMonthCount: sql<number>`(count(*) filter (where ${vendorPayments.date} >= ${lastMonth}::date and ${vendorPayments.date} < ${thisMonth}::date))::int`,
      })
      .from(vendorPayments)
      .where(and(eq(vendorPayments.orgId, orgId), eq(vendorPayments.currency, currency)));
    const [owed] = await this.db
      .select({
        toPay: sql<string>`coalesce(sum(${vendorBills.totalAmount} - ${vendorBills.amountPaid} - ${vendorBills.creditedAmount}), 0)::text`,
        toPayCount: sql<number>`count(*)::int`,
      })
      .from(vendorBills)
      .where(
        and(
          eq(vendorBills.orgId, orgId),
          eq(vendorBills.status, "recorded"),
          eq(vendorBills.currency, currency),
          lt(vendorBills.dueDate, sql`${today}::date`),
          gt(sql`${vendorBills.totalAmount} - ${vendorBills.amountPaid} - ${vendorBills.creditedAmount}`, 0n),
        ),
      );
    return {
      currency,
      paidThisMonth: paid?.thisMonth ?? "0",
      paidThisMonthCount: Number(paid?.thisMonthCount ?? 0),
      paidLastMonth: paid?.lastMonth ?? "0",
      paidLastMonthCount: Number(paid?.lastMonthCount ?? 0),
      toPay: owed?.toPay ?? "0",
      toPayCount: Number(owed?.toPayCount ?? 0),
    };
  }

  /** US-PUR-53 — the vendor's payments of the same amount within 3 days, or with the same reference. A warning only. */
  async possibleDuplicates(orgId: string, query: { contactId: string; amount: bigint; date: string; reference?: string | null }): Promise<PossibleDuplicateVendorPayment[]> {
    const ref = query.reference?.trim();
    const rows = await this.db
      .select()
      .from(vendorPayments)
      .where(
        and(
          eq(vendorPayments.orgId, orgId),
          eq(vendorPayments.contactId, query.contactId),
          or(
            and(eq(vendorPayments.amount, query.amount), sql`${vendorPayments.date} between (${query.date}::date - 3) and (${query.date}::date + 3)`),
            ref ? sql`lower(trim(${vendorPayments.reference})) = ${ref.toLowerCase()}` : undefined,
          ),
        ),
      )
      .orderBy(desc(vendorPayments.date))
      .limit(3);
    return rows.map((p) => ({
      id: p.id,
      number: p.number,
      date: typeof p.date === "string" ? p.date : new Date(p.date).toISOString().slice(0, 10),
      amount: p.amount.toString(),
      currency: p.currency,
      method: p.method,
      reference: p.reference,
    }));
  }

  /** `GET /vendor-payments/:id/history` — confirms the payment exists (org-scoped) before delegating to AuditLogService, same pattern as InvoicesService.getHistory. */
  async getHistory(orgId: string, id: string) {
    await this.getOne(orgId, id);
    return this.auditLog.listForEntity(orgId, "vendor_payment", id);
  }

  /** S-07.7's own "due dates" half — oldest dueDate first, mirrors PaymentsService.suggestAllocation exactly. */
  async suggestAllocation(orgId: string, contactId: string, amount: bigint) {
    const outstanding = await this.db
      .select()
      .from(vendorBills)
      .where(and(eq(vendorBills.orgId, orgId), eq(vendorBills.contactId, contactId), eq(vendorBills.status, "recorded")));

    const withBalance = outstanding
      .map((bill) => ({ bill, balance: bill.totalAmount - bill.amountPaid - bill.creditedAmount }))
      .filter((row) => row.balance > 0n)
      .sort((a, b) => {
        if (!a.bill.dueDate && !b.bill.dueDate) return a.bill.createdAt.getTime() - b.bill.createdAt.getTime();
        if (!a.bill.dueDate) return 1;
        if (!b.bill.dueDate) return -1;
        return new Date(a.bill.dueDate).getTime() - new Date(b.bill.dueDate).getTime();
      });

    let remaining = amount;
    const suggestions: { billId: string; billNumber: string; amount: bigint }[] = [];
    for (const { bill, balance } of withBalance) {
      if (remaining <= 0n) break;
      const allocate = remaining < balance ? remaining : balance;
      suggestions.push({ billId: bill.id, billNumber: bill.billNumber, amount: allocate });
      remaining -= allocate;
    }

    return { allocations: suggestions, unallocatedAmount: remaining };
  }

  /** §7.2 "Vendor paid" (P13): debit Accounts Payable, credit the chosen money account (US-BANK-03; the organisation's default when omitted) for the full amount — allocations must sum to exactly `amount` (see createVendorPaymentSchema's own comment), so this is always one clean two-line entry, no split like the customer side's advance-handling. */
  async create(orgId: string, actorUserId: string, input: CreateVendorPaymentInput, isDemo = false) {
    const [contact] = await this.db.select().from(contacts).where(and(eq(contacts.orgId, orgId), eq(contacts.id, input.contactId)));
    if (!contact) {
      throw new BadRequestException("Contact not found");
    }

    const totalAllocated = input.allocations.reduce((sum, a) => sum + a.amount, 0n);
    if (totalAllocated !== input.amount) {
      throw new BadRequestException("Allocations must sum to exactly the payment amount");
    }

    const billIds = input.allocations.map((a) => a.billId);
    const billRows = await this.db.select().from(vendorBills).where(and(eq(vendorBills.orgId, orgId), inArray(vendorBills.id, billIds)));
    const billById = new Map(billRows.map((row) => [row.id, row]));

    for (const allocation of input.allocations) {
      const bill = billById.get(allocation.billId);
      if (!bill) {
        throw new BadRequestException(`Vendor bill ${allocation.billId} not found`);
      }
      if (bill.status !== "recorded") {
        throw new BadRequestException(`Vendor bill ${bill.billNumber} is not recorded and cannot receive a payment`);
      }
      const balance = bill.totalAmount - bill.amountPaid - bill.creditedAmount;
      if (allocation.amount > balance) {
        throw new BadRequestException(`Allocation of ${allocation.amount} exceeds vendor bill ${bill.billNumber}'s remaining balance of ${balance}`);
      }
    }

    const created = await this.db.transaction(async (tx) => {
      const moneyAccount = await this.moneyAccounts.resolveForPosting(tx, orgId, input.moneyAccountId);
      // US-ONB-17: a payment to a demo vendor is demo too, in the demo series.
      const demo = isDemo || (await contactIsDemo(tx, input.contactId));
      const number = await this.numbering.allocateNumber(tx, orgId, "vendor_payment", { demo });

      const [payment] = await tx
        .insert(vendorPayments)
        .values({
          orgId,
          contactId: input.contactId,
          number,
          date: input.date,
          method: input.method,
          reference: input.reference ?? null,
          moneyAccountId: moneyAccount.id,
          currency: input.currency,
          amount: input.amount,
          createdByUserId: actorUserId,
          isDemo,
        })
        .returning();
      if (!isDemo) await this.moneyAccounts.rememberLastUsed(tx, actorUserId, "vendor_payment", moneyAccount.id);

      for (const allocation of input.allocations) {
        await tx.insert(vendorPaymentAllocations).values({
          orgId,
          vendorPaymentId: payment!.id,
          billId: allocation.billId,
          amount: allocation.amount,
        });
        const bill = billById.get(allocation.billId)!;
        await tx.update(vendorBills).set({ amountPaid: bill.amountPaid + allocation.amount, updatedAt: new Date() }).where(eq(vendorBills.id, allocation.billId));
      }

      const apAccountId = await this.ledger.resolveSystemAccount(tx, orgId, "accountsPayable");

      const journalEntryId = await this.ledger.postEntry(tx, {
        orgId,
        date: input.date,
        narration: `Vendor payment ${number} recorded`,
        sourceType: "vendor_payment",
        sourceId: payment!.id,
        lines: [
          { accountId: apAccountId, debit: input.amount, credit: 0n, contactId: input.contactId },
          { accountId: moneyAccount.accountId, debit: 0n, credit: input.amount, contactId: input.contactId },
        ],
      });

      await tx.update(vendorPayments).set({ journalEntryId }).where(eq(vendorPayments.id, payment!.id));

      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "created",
        entityType: "vendor_payment",
        entityId: payment!.id,
        contactId: input.contactId,
        changes: [{ field: "amount", from: null, to: input.amount.toString() }],
      });

      return payment;
    });

    return this.getOne(orgId, created!.id);
  }

  /**
   * US-PUR-50 (D-080, D-229) — deletes a vendor payment, allocated or not:
   * under locks on the payment and its bills the allocations go, each
   * bill's paid amount drops (it owes again), P14 reverses the payment's
   * entry, and the payment and each bill record it. A payment matched to a
   * bank statement line is refused until it's unmatched in Banking.
   */
  async delete(orgId: string, id: string, actorUserId: string) {
    const [existing] = await this.db.select().from(vendorPayments).where(and(eq(vendorPayments.orgId, orgId), eq(vendorPayments.id, id)));
    if (!existing) {
      throw new NotFoundException("Vendor payment not found");
    }
    await requireOwnershipCapability(this.db, { orgId, userId: actorUserId }, existing.createdByUserId, {
      own: "vendor_payments.delete_own",
      others: "vendor_payments.delete_others",
    });
    if (await this.isReconciled(existing.journalEntryId)) {
      throw new BadRequestException(`${existing.number ?? "This payment"} is matched to a bank statement line. Unmatch it in Banking first, then delete it.`);
    }

    await this.db.transaction(async (tx) => {
      await tx.select({ id: vendorPayments.id }).from(vendorPayments).where(eq(vendorPayments.id, id)).for("update");
      const allocations = await tx.select().from(vendorPaymentAllocations).where(eq(vendorPaymentAllocations.vendorPaymentId, id));
      const billIds = [...new Set(allocations.map((a) => a.billId))];
      const bills = billIds.length ? await tx.select().from(vendorBills).where(inArray(vendorBills.id, billIds)).for("update") : [];
      const billById = new Map(bills.map((b) => [b.id, b]));

      await tx.delete(vendorPaymentAllocations).where(eq(vendorPaymentAllocations.vendorPaymentId, id));
      for (const allocation of allocations) {
        const bill = billById.get(allocation.billId)!;
        const amountPaid = bill.amountPaid - allocation.amount;
        bill.amountPaid = amountPaid;
        await tx.update(vendorBills).set({ amountPaid, updatedAt: new Date() }).where(eq(vendorBills.id, bill.id));
        // The bill's Activity keeps the payment and says it was deleted.
        await this.auditLog.record(tx, {
          orgId,
          actorUserId,
          action: "payment_deleted",
          entityType: "vendor_bill",
          entityId: bill.id,
          contactId: existing.contactId,
          changes: [
            { field: "payment", from: existing.number, to: null },
            { field: "amount", from: allocation.amount.toString(), to: null },
            { field: "paidAt", from: allocation.createdAt.toISOString(), to: null },
          ],
        });
      }

      if (existing.journalEntryId) {
        await this.ledger.reverseEntry(tx, existing.journalEntryId, {
          orgId,
          date: new Date(),
          narration: `Vendor payment ${existing.number} deleted`,
          sourceType: "vendor_payment_delete",
          sourceId: id,
        });
      }

      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "deleted",
        entityType: "vendor_payment",
        entityId: id,
        contactId: existing.contactId,
        changes: [{ field: "amount", from: existing.amount.toString(), to: null }],
      });

      await tx.delete(vendorPayments).where(eq(vendorPayments.id, id));
    });

    return { id, number: existing.number };
  }
}
