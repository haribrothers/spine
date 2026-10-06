import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { createVendorPaymentSchema } from "@spine/shared";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { z } from "zod";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { vendorPayments, vendorPaymentAllocations, vendorBills, contacts } from "../../db/schema";
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

  async list(orgId: string, options: { contactId?: string }) {
    const conditions = [eq(vendorPayments.orgId, orgId)];
    if (options.contactId) conditions.push(eq(vendorPayments.contactId, options.contactId));

    const rows = await this.db
      .select({ payment: vendorPayments, contactName: contacts.name })
      .from(vendorPayments)
      .leftJoin(contacts, eq(vendorPayments.contactId, contacts.id))
      .where(and(...conditions))
      .orderBy(asc(vendorPayments.date));

    return rows.map((r) => ({ ...r.payment, contactName: r.contactName }));
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
      .select({ allocation: vendorPaymentAllocations, billNumber: vendorBills.billNumber, billTotal: vendorBills.totalAmount })
      .from(vendorPaymentAllocations)
      .leftJoin(vendorBills, eq(vendorPaymentAllocations.billId, vendorBills.id))
      .where(eq(vendorPaymentAllocations.vendorPaymentId, id));

    const refs = await this.moneyAccounts.refs(orgId, [row.payment.moneyAccountId]);
    return {
      ...row.payment,
      contactName: row.contactName,
      moneyAccount: row.payment.moneyAccountId ? (refs.get(row.payment.moneyAccountId) ?? null) : null,
      allocations: allocations.map((a) => ({ ...a.allocation, billNumber: a.billNumber, billTotal: a.billTotal })),
    };
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
      .map((bill) => ({ bill, balance: bill.totalAmount - bill.amountPaid }))
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
      const balance = bill.totalAmount - bill.amountPaid;
      if (allocation.amount > balance) {
        throw new BadRequestException(`Allocation of ${allocation.amount} exceeds vendor bill ${bill.billNumber}'s remaining balance of ${balance}`);
      }
    }

    const created = await this.db.transaction(async (tx) => {
      const moneyAccount = await this.moneyAccounts.resolveForPosting(tx, orgId, input.moneyAccountId);
      const number = await this.numbering.allocateNumber(tx, orgId, "vendor_payment");

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

  /** Only deletable if nothing has been allocated yet — mirrors PaymentsService.delete exactly. Since this schema requires full allocation at create time, in practice a vendor payment is only deletable before... it never has zero allocations. Kept for symmetry/defensive cleanup, same as the customer side. */
  async delete(orgId: string, id: string, actorUserId: string) {
    const [existing] = await this.db.select().from(vendorPayments).where(and(eq(vendorPayments.orgId, orgId), eq(vendorPayments.id, id)));
    if (!existing) {
      throw new NotFoundException("Vendor payment not found");
    }
    await requireOwnershipCapability(this.db, { orgId, userId: actorUserId }, existing.createdByUserId, {
      own: "vendor_payments.delete_own",
      others: "vendor_payments.delete_others",
    });
    if (existing.allocatedAmount > 0n) {
      throw new BadRequestException("Cannot delete a vendor payment that has been allocated to a bill");
    }

    await this.db.transaction(async (tx) => {
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

    return { id };
  }
}
