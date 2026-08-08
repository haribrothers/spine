import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { createInvoiceSchema, updateInvoiceSchema } from "@spine/shared";
import { computeLineTax, money, roundHalfUp } from "@spine/shared";
import { and, desc, eq } from "drizzle-orm";
import type { z } from "zod";
import { DATABASE } from "../../db/db.module";
import type { Database, Transaction } from "../../db/client";
import { invoices, invoiceLines, contacts, accounts } from "../../db/schema";
import { AuditLogService } from "../audit/audit-log.service";
import { NumberingService } from "../numbering/numbering.service";
import { LedgerService } from "../ledger/ledger.service";

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;

interface ComputedLine {
  sortOrder: number;
  type: "item" | "heading" | "text";
  catalogItemId: string | null;
  name: string;
  description: string | null;
  quantity: number;
  unitPriceAmount: bigint;
  unitPriceCurrency: string;
  discountPercentage: number;
  taxRatePercentage: number;
  lineSubtotalAmount: bigint;
  lineTaxAmount: bigint;
  lineTotalAmount: bigint;
}

interface ComputedTotals {
  lines: ComputedLine[];
  subtotalAmount: bigint;
  discountAmount: bigint;
  taxAmount: bigint;
  totalAmount: bigint;
}

/**
 * Server-side computation of every line and document total from raw line
 * input — mirrors computeQuoteTotals in quotes.service.ts exactly (same
 * discount-before-tax convention, same "round once at line level, half
 * up" rule, same zeroing of non-`item` lines). Duplicated rather than
 * imported from quotes.service.ts since the two document types' line
 * shapes are structurally identical but independently owned per-module —
 * a future change to one document type's tax behaviour (e.g. invoices
 * gaining tax-inclusive pricing before quotes do) must not silently alter
 * the other.
 */
function computeInvoiceTotals(currency: string, lines: CreateInvoiceInput["lines"]): ComputedTotals {
  let subtotalAmount = 0n;
  let discountAmount = 0n;
  let taxAmount = 0n;
  let totalAmount = 0n;

  const computed: ComputedLine[] = lines.map((line, index) => {
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
        discountPercentage: 0,
        taxRatePercentage: 0,
        lineSubtotalAmount: 0n,
        lineTaxAmount: 0n,
        lineTotalAmount: 0n,
      };
    }

    const grossAmount = roundHalfUp(line.quantity * Number(line.unitPriceAmount));
    const lineDiscountAmount = roundHalfUp(Number(grossAmount) * (line.discountPercentage / 100));
    const netAmount = grossAmount - lineDiscountAmount;

    const taxResult = computeLineTax(
      money(netAmount, currency),
      line.taxRatePercentage > 0
        ? [{ id: "line", name: "Tax", rate: line.taxRatePercentage / 100, isCompound: false }]
        : [],
      false,
    );

    subtotalAmount += grossAmount;
    discountAmount += lineDiscountAmount;
    taxAmount += taxResult.taxAmount.amount;
    totalAmount += taxResult.total.amount;

    return {
      sortOrder: index,
      type: "item",
      catalogItemId: line.catalogItemId ?? null,
      name: line.name,
      description: line.description ?? null,
      quantity: line.quantity,
      unitPriceAmount: line.unitPriceAmount,
      unitPriceCurrency: currency,
      discountPercentage: line.discountPercentage,
      taxRatePercentage: line.taxRatePercentage,
      lineSubtotalAmount: netAmount,
      lineTaxAmount: taxResult.taxAmount.amount,
      lineTotalAmount: taxResult.total.amount,
    };
  });

  return { lines: computed, subtotalAmount, discountAmount, taxAmount, totalAmount };
}

/**
 * PRD F5 Stage 1 (Phase 2 · Money In) — invoice CRUD, issue (with ledger
 * posting per §7.2 "Invoice issued") and void (with a reversing posting per
 * §7.2/CLAUDE.md). Advances, credit notes, quote/milestone conversion, and
 * reminders are later stages (see CHANGELOG). This service implements:
 * draft CRUD, issue (number allocation + immutability + journal posting),
 * and void (reason required + reversing entry).
 */
@Injectable()
export class InvoicesService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly auditLog: AuditLogService,
    private readonly numbering: NumberingService,
    private readonly ledger: LedgerService,
  ) {}

  async list(orgId: string, options: { status?: string; contactId?: string }) {
    const conditions = [eq(invoices.orgId, orgId)];
    if (options.contactId) conditions.push(eq(invoices.contactId, options.contactId));

    const rows = await this.db
      .select({ invoice: invoices, contactName: contacts.name })
      .from(invoices)
      .leftJoin(contacts, eq(invoices.contactId, contacts.id))
      .where(and(...conditions))
      .orderBy(desc(invoices.createdAt));

    let result = rows.map((r) => ({
      ...r.invoice,
      contactName: r.contactName,
      isOverdue: isOverdue(r.invoice),
      balanceDue: r.invoice.totalAmount - r.invoice.amountPaid,
    }));

    if (options.status) {
      result = result.filter((inv) => (options.status === "overdue" ? inv.isOverdue : inv.status === options.status));
    }

    return result;
  }

  async getOne(orgId: string, id: string) {
    const [row] = await this.db
      .select({ invoice: invoices, contactName: contacts.name })
      .from(invoices)
      .leftJoin(contacts, eq(invoices.contactId, contacts.id))
      .where(and(eq(invoices.orgId, orgId), eq(invoices.id, id)));
    if (!row) {
      throw new NotFoundException("Invoice not found");
    }

    const lines = await this.db
      .select()
      .from(invoiceLines)
      .where(eq(invoiceLines.invoiceId, id))
      .orderBy(invoiceLines.sortOrder);

    return {
      ...row.invoice,
      contactName: row.contactName,
      isOverdue: isOverdue(row.invoice),
      balanceDue: row.invoice.totalAmount - row.invoice.amountPaid,
      lines,
    };
  }

  /**
   * Creates a new draft, always unnumbered — see invoices.ts's schema
   * comment. `isDemo` mirrors QuotesService.create's own convention: never
   * client-settable, exists solely for a future DemoDataService hook to
   * reuse this same totals/audit-log logic instead of hand-inserting rows.
   */
  async create(orgId: string, actorUserId: string, input: CreateInvoiceInput, isDemo = false) {
    const [contact] = await this.db.select().from(contacts).where(and(eq(contacts.orgId, orgId), eq(contacts.id, input.contactId)));
    if (!contact) {
      throw new BadRequestException("Contact not found");
    }

    const totals = computeInvoiceTotals(input.currency, input.lines);

    const created = await this.db.transaction(async (tx) => {
      const [invoice] = await tx
        .insert(invoices)
        .values({
          orgId,
          contactId: input.contactId,
          status: "draft",
          type: input.type,
          currency: input.currency,
          issueDate: input.issueDate ?? null,
          dueDate: input.dueDate ?? null,
          subtotalAmount: totals.subtotalAmount,
          discountAmount: totals.discountAmount,
          taxAmount: totals.taxAmount,
          totalAmount: totals.totalAmount,
          notes: input.notes ?? null,
          termsAndConditions: input.termsAndConditions ?? null,
          createdByUserId: actorUserId,
          isDemo,
        })
        .returning();

      await insertLines(tx, invoice!.id, totals.lines);

      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "created",
        entityType: "invoice",
        entityId: invoice!.id,
        contactId: input.contactId,
        changes: [{ field: "status", from: null, to: "draft" }],
      });

      return invoice;
    });

    return this.getOne(orgId, created!.id);
  }

  /**
   * Updates a DRAFT invoice in place. An issued invoice is immutable per
   * CLAUDE.md — only void() may transition it further. Full-replace on
   * lines, same convention as QuotesService.update.
   */
  async update(orgId: string, id: string, actorUserId: string, input: UpdateInvoiceInput) {
    const [existing] = await this.db.select().from(invoices).where(and(eq(invoices.orgId, orgId), eq(invoices.id, id)));
    if (!existing) {
      throw new NotFoundException("Invoice not found");
    }
    if (existing.status !== "draft") {
      throw new BadRequestException("Only a draft invoice can be edited");
    }

    const currency = input.currency ?? existing.currency;
    const totals = input.lines !== undefined ? computeInvoiceTotals(currency, input.lines) : null;

    const updated = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(invoices)
        .set({
          ...(input.contactId !== undefined ? { contactId: input.contactId } : {}),
          ...(input.type !== undefined ? { type: input.type } : {}),
          ...(input.currency !== undefined ? { currency: input.currency } : {}),
          ...(input.issueDate !== undefined ? { issueDate: input.issueDate } : {}),
          ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          ...(input.termsAndConditions !== undefined ? { termsAndConditions: input.termsAndConditions } : {}),
          ...(totals
            ? {
                subtotalAmount: totals.subtotalAmount,
                discountAmount: totals.discountAmount,
                taxAmount: totals.taxAmount,
                totalAmount: totals.totalAmount,
              }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, id))
        .returning();

      if (input.lines !== undefined && totals) {
        await tx.delete(invoiceLines).where(eq(invoiceLines.invoiceId, id));
        await insertLines(tx, id, totals.lines);
      }

      const { lines: _lines, ...scalarInput } = input;
      const changes = AuditLogService.diffFields(existing as unknown as Record<string, unknown>, scalarInput as Record<string, unknown>);
      if (changes.length) {
        await this.auditLog.record(tx, {
          orgId,
          actorUserId,
          action: "updated",
          entityType: "invoice",
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
   * Issues the invoice: allocates its gapless number, flips draft -> issued,
   * and posts the "Invoice issued" journal entry per §7.2 (debit Accounts
   * Receivable, credit Revenue + Tax Payable) in the SAME transaction —
   * CLAUDE.md's "ledger is derived... in the same transaction as the
   * business document it originates from" is non-negotiable here: if the
   * posting fails, the whole issue must roll back, not leave an issued
   * invoice with no ledger trail.
   *
   * Revenue is posted to a single umbrella account for Stage 1 (catalogue
   * items' own `incomeAccountId` per-line breakdown, S-02.3, is a
   * documented future refinement — Stage 1 posts the invoice's blended
   * subtotal as one revenue line rather than one line per distinct income
   * account, since splitting by each line's own catalog-item income
   * account is real scope Quotes' own Stage 1 never had to solve either;
   * revisit once job costing/P&L reporting needs the finer split).
   * Discounts are NOT posted as their own "Discounts Given" contra-revenue
   * line in Stage 1 — `subtotalAmount` here is the post-discount net
   * (matching how `lineSubtotalAmount` is stored post-discount), so AR
   * simply nets to the discounted total; a gross/contra presentation is a
   * P&L-reporting-time concern for Phase 4, not required for the ledger to
   * balance correctly today.
   */
  async issue(orgId: string, id: string, actorUserId: string, revenueAccountId?: string) {
    const [preCheck] = await this.db.select().from(invoices).where(and(eq(invoices.orgId, orgId), eq(invoices.id, id)));
    if (!preCheck) {
      throw new NotFoundException("Invoice not found");
    }

    const resolvedRevenueAccountId = revenueAccountId ?? (await this.resolveDefaultRevenueAccount(orgId));

    const result = await this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(invoices)
        .where(and(eq(invoices.orgId, orgId), eq(invoices.id, id)))
        .for("update");
      if (!existing) {
        throw new NotFoundException("Invoice not found");
      }
      if (existing.status !== "draft") {
        throw new BadRequestException("Only a draft invoice can be issued");
      }
      if (existing.totalAmount <= 0n) {
        throw new BadRequestException("Cannot issue an invoice with a zero or negative total");
      }

      const number = await this.numbering.allocateNumber(tx, orgId, "invoice");
      const issuedAt = new Date();
      const issueDateStr = issuedAt.toISOString().slice(0, 10);

      const arAccountId = await this.ledger.resolveSystemAccount(tx, orgId, "accountsReceivable");
      const taxAccountId = await this.ledger.resolveSystemAccount(tx, orgId, "outputTaxPayable");

      const postingLines = [
        { accountId: arAccountId, debit: existing.totalAmount, credit: 0n, contactId: existing.contactId },
        { accountId: resolvedRevenueAccountId, debit: 0n, credit: existing.totalAmount - existing.taxAmount, contactId: existing.contactId },
      ];
      if (existing.taxAmount > 0n) {
        postingLines.push({ accountId: taxAccountId, debit: 0n, credit: existing.taxAmount, contactId: existing.contactId });
      }

      const journalEntryId = await this.ledger.postEntry(tx, {
        orgId,
        date: issueDateStr,
        narration: `Invoice ${number} issued`,
        sourceType: "invoice",
        sourceId: id,
        lines: postingLines,
      });

      const [row] = await tx
        .update(invoices)
        .set({
          status: "issued",
          number,
          issuedAt,
          issueDate: existing.issueDate ?? issuedAt,
          journalEntryId,
          updatedAt: issuedAt,
        })
        .where(eq(invoices.id, id))
        .returning();

      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "issued",
        entityType: "invoice",
        entityId: id,
        contactId: existing.contactId,
        changes: [{ field: "status", from: "draft", to: "issued" }],
      });

      return row;
    });

    return this.getOne(orgId, result!.id);
  }

  /**
   * `revenueAccountId` on `issue()` is optional — a caller (e.g. a future
   * "issue" dialog letting staff pick which income account to post to) can
   * pass one explicitly; if omitted, this resolves the seeded "Sales —
   * Services" account (code 4100, `DEFAULT_CHART_OF_ACCOUNTS`) as a
   * reasonable default so `POST /invoices/:id/issue` works out of the box
   * with no extra setup. NOT a `SYSTEM_ACCOUNT_CODES` entry — 4100 is a
   * normal, renamable/deletable account per the seed file, unlike AR/tax/
   * retention/advances — so this throws a clear, actionable error (not
   * LedgerService's generic "chart of accounts is corrupt" message) if an
   * org has renamed or removed it without picking a replacement.
   */
  private async resolveDefaultRevenueAccount(orgId: string): Promise<string> {
    const [row] = await this.db
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.orgId, orgId), eq(accounts.code, "4100")));
    if (!row) {
      throw new BadRequestException(
        "No revenue account found (expected code 4100, 'Sales — Services'). Pass revenueAccountId explicitly or restore this account.",
      );
    }
    return row.id;
  }

  /**
   * S-05.8 — voids an issued invoice with a required reason. Posts a
   * reversing entry mirroring the original "Invoice issued" posting
   * (LedgerService.reverseEntry) rather than editing or deleting it, per
   * CLAUDE.md's "corrections are reversing entries, never edits." Blocked
   * if any payment has been allocated (`amountPaid > 0`) — voiding a
   * partially/fully paid invoice would leave a payment allocated against a
   * document that no longer exists from the customer's perspective; Stage 1
   * has no payment-unwind flow, so this is a hard block rather than a
   * partial-reversal feature not yet asked for by any story.
   */
  async void(orgId: string, id: string, actorUserId: string, reason: string) {
    const [preCheck] = await this.db.select().from(invoices).where(and(eq(invoices.orgId, orgId), eq(invoices.id, id)));
    if (!preCheck) {
      throw new NotFoundException("Invoice not found");
    }

    const result = await this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(invoices)
        .where(and(eq(invoices.orgId, orgId), eq(invoices.id, id)))
        .for("update");
      if (!existing) {
        throw new NotFoundException("Invoice not found");
      }
      if (existing.status !== "issued") {
        throw new BadRequestException("Only an issued invoice can be voided");
      }
      if (existing.amountPaid > 0n) {
        throw new BadRequestException("Cannot void an invoice with payments allocated against it");
      }
      if (!existing.journalEntryId) {
        throw new BadRequestException("This invoice has no journal entry to reverse");
      }

      const voidedAt = new Date();
      const voidJournalEntryId = await this.ledger.reverseEntry(tx, existing.journalEntryId, {
        orgId,
        date: voidedAt.toISOString().slice(0, 10),
        narration: `Invoice ${existing.number} voided: ${reason}`,
        sourceType: "invoice_void",
        sourceId: id,
      });

      const [row] = await tx
        .update(invoices)
        .set({
          status: "void",
          voidedAt,
          voidedByUserId: actorUserId,
          voidReason: reason,
          voidJournalEntryId,
          updatedAt: voidedAt,
        })
        .where(eq(invoices.id, id))
        .returning();

      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "voided",
        entityType: "invoice",
        entityId: id,
        contactId: existing.contactId,
        changes: [
          { field: "status", from: "issued", to: "void" },
          { field: "voidReason", from: null, to: reason },
        ],
      });

      return row;
    });

    return this.getOne(orgId, result!.id);
  }

  /** A draft can be hard-deleted — nothing references it yet (no ledger, no PDF, no payments). An issued/void invoice can never be deleted, matching CLAUDE.md. */
  async delete(orgId: string, id: string, actorUserId: string) {
    const [existing] = await this.db.select().from(invoices).where(and(eq(invoices.orgId, orgId), eq(invoices.id, id)));
    if (!existing) {
      throw new NotFoundException("Invoice not found");
    }
    if (existing.status !== "draft") {
      throw new BadRequestException("Only a draft invoice can be deleted");
    }

    await this.db.transaction(async (tx) => {
      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "deleted",
        entityType: "invoice",
        entityId: id,
        contactId: existing.contactId,
        changes: [{ field: "status", from: existing.status, to: null }],
      });
      await tx.delete(invoiceLines).where(eq(invoiceLines.invoiceId, id));
      await tx.delete(invoices).where(eq(invoices.id, id));
    });
    return { id };
  }
}

async function insertLines(tx: Transaction, invoiceId: string, lines: ComputedLine[]) {
  if (!lines.length) return;
  await tx.insert(invoiceLines).values(
    lines.map((line) => ({
      invoiceId,
      sortOrder: line.sortOrder,
      type: line.type,
      catalogItemId: line.catalogItemId,
      name: line.name,
      description: line.description,
      quantity: line.quantity,
      unitPriceAmount: line.unitPriceAmount,
      unitPriceCurrency: line.unitPriceCurrency,
      discountPercentage: line.discountPercentage,
      taxRatePercentage: line.taxRatePercentage,
      lineSubtotalAmount: line.lineSubtotalAmount,
      lineTaxAmount: line.lineTaxAmount,
      lineTotalAmount: line.lineTotalAmount,
    })),
  );
}

/** S-05.9 — computed, not stored, exactly like quotes.ts's isExpired. Only an `issued` invoice with an outstanding balance and a past due date is overdue. */
function isOverdue(invoice: typeof invoices.$inferSelect): boolean {
  if (invoice.status !== "issued" || !invoice.dueDate) return false;
  if (invoice.totalAmount - invoice.amountPaid <= 0n) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(invoice.dueDate);
  dueDate.setHours(0, 0, 0, 0);
  return dueDate < today;
}
