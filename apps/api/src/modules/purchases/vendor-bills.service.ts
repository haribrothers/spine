import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { createVendorBillSchema, updateVendorBillSchema } from "@spine/shared";
import { computeDocumentLine, lineSupplyClass, supplyClassTaxError, type SupplyClass } from "@spine/shared";
import { and, eq, desc } from "drizzle-orm";
import type { z } from "zod";
import { DATABASE } from "../../db/db.module";
import type { Database, Transaction } from "../../db/client";
import { vendorBills, vendorBillLines, vendorCreditAllocations, vendorCredits, contacts, accounts } from "../../db/schema";
import { AuditLogService } from "../audit/audit-log.service";
import { requireOwnershipCapability } from "../../auth/capability.util";
import { LedgerService } from "../ledger/ledger.service";
import { TaxResolverService } from "../tax/tax-resolver.service";
import { attachmentCounts } from "../attachments/attachments.service";

export type CreateVendorBillInput = z.infer<typeof createVendorBillSchema>;
export type UpdateVendorBillInput = z.infer<typeof updateVendorBillSchema>;

export interface ComputedLine {
  sortOrder: number;
  type: "item" | "heading" | "text";
  catalogItemId: string | null;
  name: string;
  description: string | null;
  quantity: number;
  unitPriceAmount: bigint;
  unitPriceCurrency: string;
  accountId: string | null;
  taxRatePercentage: number;
  taxRateId: string | null;
  taxGroupId: string | null;
  isTaxInclusive: boolean;
  supplyClass: SupplyClass | null;
  lineSubtotalAmount: bigint;
  lineTaxAmount: bigint;
  lineTotalAmount: bigint;
}

interface ComputedTotals {
  lines: ComputedLine[];
  subtotalAmount: bigint;
  taxAmount: bigint;
  totalAmount: bigint;
}

/**
 * Server-side computation of every line and document total — the ONLY
 * place vendor bill totals are computed, mirroring computeQuoteTotals/
 * computeInvoiceTotals exactly (same "round once at line level, half up"
 * rule, same FEAT-08 taxRateId/taxGroupId-resolves-via-TaxResolverService
 * behaviour). No discount concept here — PRD's own vendor_bill_lines shape
 * has no discount field, unlike quote/invoice lines; a vendor's own
 * discount, if any, is reflected directly in the unit price.
 */
export async function computeBillTotals(
  orgId: string,
  currency: string,
  lines: CreateVendorBillInput["lines"],
  taxResolver: TaxResolverService,
): Promise<ComputedTotals> {
  let subtotalAmount = 0n;
  let taxAmount = 0n;
  let totalAmount = 0n;

  const computed: ComputedLine[] = await Promise.all(
    lines.map(async (line, index) => {
      if (line.type !== "item") {
        return {
          sortOrder: index,
          type: line.type,
          catalogItemId: line.catalogItemId ?? null,
          name: line.name,
          description: line.description ?? null,
          quantity: 0,
          unitPriceAmount: 0n,
          unitPriceCurrency: currency,
          accountId: null,
          taxRatePercentage: 0,
          taxRateId: null,
          taxGroupId: null,
          isTaxInclusive: false,
          supplyClass: null,
          lineSubtotalAmount: 0n,
          lineTaxAmount: 0n,
          lineTotalAmount: 0n,
        };
      }

      const resolved = line.taxRateId || line.taxGroupId
        ? await taxResolver.resolve(orgId, { taxRateId: line.taxRateId, taxGroupId: line.taxGroupId })
        : {
            rates: line.taxRatePercentage > 0 ? [{ id: "line", name: "Tax", percent: line.taxRatePercentage, isCompound: false }] : [],
            blendedPercentage: line.taxRatePercentage,
          };

      // US-TAX-11: an exempt or non-taxable line carries no tax.
      const supplyError = supplyClassTaxError(line.supplyClass, resolved.blendedPercentage);
      if (supplyError) throw new BadRequestException(supplyError);

      // US-TAX-07: exact decimal maths in @spine/shared, each figure rounded once.
      const computed = computeDocumentLine({
        quantity: line.quantity,
        unitPriceAmount: line.unitPriceAmount,
        currency,
        rates: resolved.rates,
        inclusive: line.isTaxInclusive,
      });
      const netAmount = computed.netAmount;
      const taxResult = computed.tax;

      subtotalAmount += netAmount;
      taxAmount += taxResult.taxAmount.amount;
      totalAmount += taxResult.total.amount;

      return {
        sortOrder: index,
        type: "item" as const,
        catalogItemId: line.catalogItemId ?? null,
        name: line.name,
        description: line.description ?? null,
        quantity: line.quantity,
        unitPriceAmount: line.unitPriceAmount,
        unitPriceCurrency: currency,
        accountId: line.accountId ?? null,
        taxRatePercentage: resolved.blendedPercentage,
        supplyClass: lineSupplyClass(resolved.blendedPercentage, line.supplyClass),
        taxRateId: line.taxRateId ?? null,
        taxGroupId: line.taxGroupId ?? null,
        isTaxInclusive: line.isTaxInclusive,
        lineSubtotalAmount: netAmount,
        lineTaxAmount: taxResult.taxAmount.amount,
        lineTotalAmount: taxResult.total.amount,
      };
    }),
  );

  return { lines: computed, subtotalAmount, taxAmount, totalAmount };
}

async function insertLines(tx: Transaction, billId: string, lines: ComputedLine[]) {
  if (!lines.length) return;
  await tx.insert(vendorBillLines).values(
    lines.map((line) => ({
      billId,
      sortOrder: line.sortOrder,
      type: line.type,
      catalogItemId: line.catalogItemId,
      name: line.name,
      description: line.description,
      quantity: line.quantity,
      unitPriceAmount: line.unitPriceAmount,
      unitPriceCurrency: line.unitPriceCurrency,
      accountId: line.accountId,
      taxRatePercentage: line.taxRatePercentage,
      taxRateId: line.taxRateId,
      taxGroupId: line.taxGroupId,
      isTaxInclusive: line.isTaxInclusive,
      supplyClass: line.supplyClass,
      lineSubtotalAmount: line.lineSubtotalAmount,
      lineTaxAmount: line.lineTaxAmount,
      lineTotalAmount: line.lineTotalAmount,
    })),
  );
}

/**
 * PRD FEAT-07 (S-07.1, S-07.5) — vendor bill CRUD, `record()` (the posting
 * action, §7.2 "Vendor bill recorded": debit Expense/COGS + Input Tax,
 * credit Accounts Payable), and `void()` with a reversing entry. Mirrors
 * InvoicesService's own create/issue/void shape almost exactly — see that
 * file's doc comments for the full transaction-boundary reasoning
 * (row-lock + status re-check + numbering + posting + audit log, all in
 * one transaction; vendor bill's own number is user-entered, never
 * allocated via NumberingService, per that module's own doc comment).
 */
@Injectable()
export class VendorBillsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly auditLog: AuditLogService,
    private readonly ledger: LedgerService,
    private readonly taxResolver: TaxResolverService,
  ) {}

  async list(orgId: string, options: { status?: string; contactId?: string; jobId?: string }) {
    const conditions = [eq(vendorBills.orgId, orgId)];
    if (options.contactId) conditions.push(eq(vendorBills.contactId, options.contactId));
    if (options.jobId) conditions.push(eq(vendorBills.jobId, options.jobId));

    const rows = await this.db
      .select({ bill: vendorBills, contactName: contacts.name })
      .from(vendorBills)
      .leftJoin(contacts, eq(vendorBills.contactId, contacts.id))
      .where(and(...conditions))
      .orderBy(desc(vendorBills.createdAt));

    let result = rows.map((r) => ({
      ...r.bill,
      contactName: r.contactName,
      balanceDue: r.bill.totalAmount - r.bill.amountPaid - r.bill.creditedAmount,
    }));

    if (options.status) {
      result = result.filter((b) => b.status === options.status);
    }

    // US-OPS-33: the paperclip on the list.
    const counts = await attachmentCounts(this.db, orgId, "vendor_bill", result.map((b) => b.id));
    return result.map((b) => ({ ...b, attachmentCount: counts.get(b.id) ?? 0 }));
  }

  async getOne(orgId: string, id: string) {
    const [row] = await this.db
      .select({ bill: vendorBills, contactName: contacts.name })
      .from(vendorBills)
      .leftJoin(contacts, eq(vendorBills.contactId, contacts.id))
      .where(and(eq(vendorBills.orgId, orgId), eq(vendorBills.id, id)));
    if (!row) {
      throw new NotFoundException("Vendor bill not found");
    }

    const lines = await this.db
      .select()
      .from(vendorBillLines)
      .where(eq(vendorBillLines.billId, id))
      .orderBy(vendorBillLines.sortOrder);

    // US-PUR-25: the vendor credits used against this bill.
    const creditsApplied = await this.db
      .select({ id: vendorCreditAllocations.id, vendorCreditId: vendorCredits.id, number: vendorCredits.number, vendorReference: vendorCredits.vendorReference, amount: vendorCreditAllocations.amount })
      .from(vendorCreditAllocations)
      .innerJoin(vendorCredits, eq(vendorCredits.id, vendorCreditAllocations.vendorCreditId))
      .where(eq(vendorCreditAllocations.billId, id));

    return {
      ...row.bill,
      contactName: row.contactName,
      balanceDue: row.bill.totalAmount - row.bill.amountPaid - row.bill.creditedAmount,
      lines,
      creditsApplied,
    };
  }

  /** `GET /vendor-bills/:id/history` — confirms the bill exists (org-scoped) before delegating to AuditLogService, same pattern as InvoicesService.getHistory. */
  async getHistory(orgId: string, id: string) {
    await this.getOne(orgId, id);
    return this.auditLog.listForEntity(orgId, "vendor_bill", id);
  }

  /** `recurring` (US-PUR-30): the recurring bill and run date that created it — unique together, so a run never makes a second bill for one date. */
  async create(orgId: string, actorUserId: string, input: CreateVendorBillInput, isDemo = false, recurring?: { recurringBillId: string; recurringRunOn: string }) {
    const [contact] = await this.db.select().from(contacts).where(and(eq(contacts.orgId, orgId), eq(contacts.id, input.contactId)));
    if (!contact) {
      throw new BadRequestException("Contact not found");
    }

    const totals = await computeBillTotals(orgId, input.currency, input.lines, this.taxResolver);

    const created = await this.db.transaction(async (tx) => {
      const [bill] = await tx
        .insert(vendorBills)
        .values({
          orgId,
          contactId: input.contactId,
          jobId: input.jobId ?? null,
          status: "draft",
          billNumber: input.billNumber,
          date: input.date,
          dueDate: input.dueDate ?? null,
          currency: input.currency,
          subtotalAmount: totals.subtotalAmount,
          taxAmount: totals.taxAmount,
          totalAmount: totals.totalAmount,
          notes: input.notes ?? null,
          createdByUserId: actorUserId,
          isDemo,
          recurringBillId: recurring?.recurringBillId ?? null,
          recurringRunOn: recurring?.recurringRunOn ?? null,
        })
        .returning();

      await insertLines(tx, bill!.id, totals.lines);

      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "created",
        entityType: "vendor_bill",
        entityId: bill!.id,
        contactId: input.contactId,
        changes: [{ field: "status", from: null, to: "draft" }],
      });

      return bill;
    });

    return this.getOne(orgId, created!.id);
  }

  /** Updates a DRAFT bill in place. A recorded bill is immutable per CLAUDE.md — only void() may transition it further. Full-replace on lines, same convention as QuotesService/InvoicesService.update. */
  async update(orgId: string, id: string, actorUserId: string, input: UpdateVendorBillInput) {
    const [existing] = await this.db.select().from(vendorBills).where(and(eq(vendorBills.orgId, orgId), eq(vendorBills.id, id)));
    if (!existing) {
      throw new NotFoundException("Vendor bill not found");
    }
    await requireOwnershipCapability(this.db, { orgId, userId: actorUserId }, existing.createdByUserId, {
      own: "vendor_bills.edit_own",
      others: "vendor_bills.edit_others",
    });
    if (existing.status !== "draft") {
      throw new BadRequestException("Only a draft vendor bill can be edited");
    }

    const currency = input.currency ?? existing.currency;
    const totals = input.lines !== undefined ? await computeBillTotals(orgId, currency, input.lines, this.taxResolver) : null;

    const updated = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(vendorBills)
        .set({
          ...(input.contactId !== undefined ? { contactId: input.contactId } : {}),
          ...(input.jobId !== undefined ? { jobId: input.jobId } : {}),
          ...(input.billNumber !== undefined ? { billNumber: input.billNumber } : {}),
          ...(input.date !== undefined ? { date: input.date } : {}),
          ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
          ...(input.currency !== undefined ? { currency: input.currency } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          ...(totals
            ? { subtotalAmount: totals.subtotalAmount, taxAmount: totals.taxAmount, totalAmount: totals.totalAmount }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(vendorBills.id, id))
        .returning();

      if (input.lines !== undefined && totals) {
        await tx.delete(vendorBillLines).where(eq(vendorBillLines.billId, id));
        await insertLines(tx, id, totals.lines);
      }

      const { lines: _lines, ...scalarInput } = input;
      const changes = AuditLogService.diffFields(existing as unknown as Record<string, unknown>, scalarInput as Record<string, unknown>);
      if (changes.length) {
        await this.auditLog.record(tx, {
          orgId,
          actorUserId,
          action: "updated",
          entityType: "vendor_bill",
          entityId: id,
          contactId: row?.contactId ?? existing.contactId,
          changes,
        });
      }

      return row;
    });

    return this.getOne(orgId, updated!.id);
  }

  /**
   * §7.2 "Vendor bill recorded": debit Expense/COGS (per-line, grouped by
   * each line's own snapshotted `accountId`, falling back to the org's
   * default expense account — mirrors InvoicesService.issue's own
   * resolveRevenuePostingLines grouping, except no catalog-item lookup is
   * needed here since vendor_bill_lines already snapshots `accountId`
   * directly at add-time) + debit Input Tax Receivable, credit Accounts
   * Payable for the total.
   */
  async record(orgId: string, id: string, actorUserId: string, fallbackAccountId?: string) {
    const [preCheck] = await this.db.select().from(vendorBills).where(and(eq(vendorBills.orgId, orgId), eq(vendorBills.id, id)));
    if (!preCheck) {
      throw new NotFoundException("Vendor bill not found");
    }

    const resolvedFallbackAccountId = fallbackAccountId ?? (await this.resolveDefaultExpenseAccount(orgId));

    const result = await this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(vendorBills)
        .where(and(eq(vendorBills.orgId, orgId), eq(vendorBills.id, id)))
        .for("update");
      if (!existing) {
        throw new NotFoundException("Vendor bill not found");
      }
      if (existing.status !== "draft") {
        throw new BadRequestException("Only a draft vendor bill can be recorded");
      }
      if (existing.totalAmount <= 0n) {
        throw new BadRequestException("Cannot record a vendor bill with a zero or negative total");
      }

      const lines = await tx
        .select({ accountId: vendorBillLines.accountId, lineSubtotalAmount: vendorBillLines.lineSubtotalAmount })
        .from(vendorBillLines)
        .where(and(eq(vendorBillLines.billId, id), eq(vendorBillLines.type, "item")));

      const byAccount = new Map<string, bigint>();
      for (const line of lines) {
        if (line.lineSubtotalAmount === 0n) continue;
        const resolvedAccountId = line.accountId ?? resolvedFallbackAccountId;
        byAccount.set(resolvedAccountId, (byAccount.get(resolvedAccountId) ?? 0n) + line.lineSubtotalAmount);
      }

      const apAccountId = await this.ledger.resolveSystemAccount(tx, orgId, "accountsPayable");

      const postingLines: { accountId: string; debit: bigint; credit: bigint; contactId: string; jobId?: string | null }[] = [
        ...Array.from(byAccount.entries()).map(([accountId, amount]) => ({
          accountId,
          debit: amount,
          credit: 0n,
          contactId: existing.contactId,
          jobId: existing.jobId,
        })),
      ];

      if (existing.taxAmount > 0n) {
        const inputTaxAccountId = await this.ledger.resolveSystemAccount(tx, orgId, "inputTaxReceivable");
        postingLines.push({ accountId: inputTaxAccountId, debit: existing.taxAmount, credit: 0n, contactId: existing.contactId, jobId: existing.jobId });
      }

      postingLines.push({ accountId: apAccountId, debit: 0n, credit: existing.totalAmount, contactId: existing.contactId, jobId: existing.jobId });

      const recordedAt = new Date();
      const journalEntryId = await this.ledger.postEntry(tx, {
        orgId,
        date: new Date(existing.date).toISOString().slice(0, 10),
        narration: `Vendor bill ${existing.billNumber} recorded`,
        sourceType: "vendor_bill",
        sourceId: id,
        lines: postingLines,
      });

      const [row] = await tx
        .update(vendorBills)
        .set({ status: "recorded", recordedAt, journalEntryId, updatedAt: recordedAt })
        .where(eq(vendorBills.id, id))
        .returning();

      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "recorded",
        entityType: "vendor_bill",
        entityId: id,
        contactId: existing.contactId,
        changes: [{ field: "status", from: "draft", to: "recorded" }],
      });

      return row;
    });

    return this.getOne(orgId, result!.id);
  }

  /** Mirrors InvoicesService.void exactly — reversing entry, blocked if any payment has been allocated. */
  async void(orgId: string, id: string, actorUserId: string, reason: string) {
    const [preCheck] = await this.db.select().from(vendorBills).where(and(eq(vendorBills.orgId, orgId), eq(vendorBills.id, id)));
    if (!preCheck) {
      throw new NotFoundException("Vendor bill not found");
    }
    // US-RPT-18: an opening bill is removed in Opening balances (while unlocked).
    if (preCheck.isOpening) throw new BadRequestException("An opening bill can't be voided. Remove it in Settings › Opening balances.");

    const result = await this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(vendorBills)
        .where(and(eq(vendorBills.orgId, orgId), eq(vendorBills.id, id)))
        .for("update");
      if (!existing) {
        throw new NotFoundException("Vendor bill not found");
      }
      if (existing.status !== "recorded") {
        throw new BadRequestException("Only a recorded vendor bill can be voided");
      }
      if (existing.amountPaid > 0n) {
        throw new BadRequestException("Cannot void a vendor bill with payments allocated against it");
      }
      if (existing.creditedAmount > 0n) {
        throw new BadRequestException("Remove the vendor credits applied to this bill before voiding it.");
      }
      if (!existing.journalEntryId) {
        throw new BadRequestException("This vendor bill has no journal entry to reverse");
      }

      const voidedAt = new Date();
      const voidJournalEntryId = await this.ledger.reverseEntry(tx, existing.journalEntryId, {
        orgId,
        date: voidedAt.toISOString().slice(0, 10),
        narration: `Vendor bill ${existing.billNumber} voided: ${reason}`,
        sourceType: "vendor_bill_void",
        sourceId: id,
      });

      const [row] = await tx
        .update(vendorBills)
        .set({ status: "void", voidedAt, voidedByUserId: actorUserId, voidReason: reason, voidJournalEntryId, updatedAt: voidedAt })
        .where(eq(vendorBills.id, id))
        .returning();

      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "voided",
        entityType: "vendor_bill",
        entityId: id,
        contactId: existing.contactId,
        changes: [
          { field: "status", from: "recorded", to: "void" },
          { field: "voidReason", from: null, to: reason },
        ],
      });

      return row;
    });

    return this.getOne(orgId, result!.id);
  }

  /** A draft can be hard-deleted — nothing references it yet. A recorded/void bill can never be deleted, matching InvoicesService.delete's exact posture. */
  async delete(orgId: string, id: string, actorUserId: string) {
    const [existing] = await this.db.select().from(vendorBills).where(and(eq(vendorBills.orgId, orgId), eq(vendorBills.id, id)));
    if (!existing) {
      throw new NotFoundException("Vendor bill not found");
    }
    await requireOwnershipCapability(this.db, { orgId, userId: actorUserId }, existing.createdByUserId, {
      own: "vendor_bills.delete_own",
      others: "vendor_bills.delete_others",
    });
    if (existing.status !== "draft") {
      throw new BadRequestException("Only a draft vendor bill can be deleted");
    }

    await this.db.transaction(async (tx) => {
      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "deleted",
        entityType: "vendor_bill",
        entityId: id,
        contactId: existing.contactId,
        changes: [{ field: "status", from: existing.status, to: null }],
      });
      await tx.delete(vendorBillLines).where(eq(vendorBillLines.billId, id));
      await tx.delete(vendorBills).where(eq(vendorBills.id, id));
    });
    return { id };
  }

  /** Fallback expense account (code 6900, "Other Expenses") for a bill line with no resolved accountId — mirrors InvoicesService.resolveDefaultRevenueAccount's exact reasoning and error shape. */
  private async resolveDefaultExpenseAccount(orgId: string): Promise<string> {
    const [row] = await this.db
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.orgId, orgId), eq(accounts.code, "6900")));
    if (!row) {
      throw new BadRequestException(
        "No default expense account found (expected code 6900, 'Other Expenses'). Pass fallbackAccountId explicitly or restore this account.",
      );
    }
    return row.id;
  }
}
