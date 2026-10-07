import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { createInvoiceSchema, updateInvoiceSchema } from "@spine/shared";
import { computeDocumentLine, lineSupplyClass, supplyClassTaxError, type SupplyClass, percentageOf, type BulkResult } from "@spine/shared";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { z } from "zod";
import { DATABASE } from "../../db/db.module";
import type { Database, Transaction } from "../../db/client";
import { invoices, invoiceLines, invoiceReminders, contacts, accounts, quotes, quoteLines, catalogItems, jobs, journalLines, milestones, settings } from "../../db/schema";
import { daysBetween, orgClock } from "../../common/org-clock";
import { AuditLogService } from "../audit/audit-log.service";
import { NumberingService } from "../numbering/numbering.service";
import { LedgerService } from "../ledger/ledger.service";
import { QueueService } from "../queue/queue.service";
import { queueIssuedPdf } from "../pdf/issued-pdf.service";
import { QuoteConversionGuardService } from "../org/quote-conversion-guard.service";
import { TaxResolverService } from "../tax/tax-resolver.service";
import { PlaceOfSupplyService } from "../tax/place-of-supply.service";
import { INVOICE_SEND_EMAIL_QUEUE } from "./invoice-email.worker";
import { requireOwnershipCapability } from "../../auth/capability.util";

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
  taxRateId: string | null;
  taxGroupId: string | null;
  isTaxInclusive: boolean;
  supplyClass: SupplyClass | null;
  hsnSac: string | null;
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

interface InvoiceLineTotalInput {
  type: "item" | "heading" | "text";
  catalogItemId?: string | null;
  name: string;
  description?: string | null;
  quantity?: number;
  unitPriceAmount?: bigint;
  unitPriceCurrency?: string;
  discountPercentage?: number;
  taxRatePercentage?: number;
  taxRateId?: string | null;
  taxGroupId?: string | null;
  isTaxInclusive?: boolean;
  supplyClass?: SupplyClass | null;
  hsnSac?: string | null;
}

/**
 * Server-side computation of every line and document total from raw line
 * input — mirrors computeQuoteTotals in quotes.service.ts exactly (same
 * discount-before-tax convention, same "round once at line level, half
 * up" rule, same zeroing of non-`item` lines, same FEAT-08 taxRateId/
 * taxGroupId-resolves-via-TaxResolverService-else-falls-back-to-flat-
 * percentage behaviour). Duplicated rather than imported from
 * quotes.service.ts since the two document types' line shapes are
 * structurally identical but independently owned per-module — a future
 * change to one document type's tax behaviour must not silently alter the
 * other.
 */
/**
 * US-PAY-13 (D-075) — a deposit request carries no tax: tax is charged on
 * the final invoice's own lines, which carry the full tax.
 */
function withoutTaxIfAdvance<T extends InvoiceLineTotalInput>(lines: readonly T[], type: string | undefined): T[] {
  if (type !== "advance") return [...lines];
  return lines.map((line) => ({ ...line, taxRatePercentage: 0, taxRateId: null, taxGroupId: null, isTaxInclusive: false }));
}

export async function computeInvoiceTotals(
  orgId: string,
  currency: string,
  lines: readonly InvoiceLineTotalInput[],
  taxResolver: TaxResolverService,
): Promise<ComputedTotals> {
  let subtotalAmount = 0n;
  let discountAmount = 0n;
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
          discountPercentage: 0,
          taxRatePercentage: 0,
          taxRateId: null,
          taxGroupId: null,
          isTaxInclusive: false,
          supplyClass: null,
          hsnSac: null,
          lineSubtotalAmount: 0n,
          lineTaxAmount: 0n,
          lineTotalAmount: 0n,
        };
      }

      const quantity = line.quantity ?? 0;
      const unitPriceAmount = line.unitPriceAmount ?? 0n;
      const discountPercentage = line.discountPercentage ?? 0;
      const taxRatePercentage = line.taxRatePercentage ?? 0;
      const isTaxInclusive = line.isTaxInclusive ?? false;

      const resolved = line.taxRateId || line.taxGroupId
        ? await taxResolver.resolve(orgId, { taxRateId: line.taxRateId, taxGroupId: line.taxGroupId })
        : {
            rates: taxRatePercentage > 0 ? [{ id: "line", name: "Tax", percent: taxRatePercentage, isCompound: false }] : [],
            blendedPercentage: taxRatePercentage,
          };

      // US-TAX-11: an exempt or non-taxable line carries no tax.
      const supplyError = supplyClassTaxError(line.supplyClass, resolved.blendedPercentage);
      if (supplyError) throw new BadRequestException(supplyError);

      // US-TAX-07: exact decimal maths in @spine/shared, each figure rounded once.
      const computed = computeDocumentLine({ quantity, unitPriceAmount, discountPercentage, currency, rates: resolved.rates, inclusive: isTaxInclusive });
      const { grossAmount, netAmount } = computed;
      const lineDiscountAmount = computed.discountAmount;
      const taxResult = computed.tax;

      subtotalAmount += grossAmount;
      discountAmount += lineDiscountAmount;
      taxAmount += taxResult.taxAmount.amount;
      totalAmount += taxResult.total.amount;

      return {
        sortOrder: index,
        type: "item" as const,
        catalogItemId: line.catalogItemId ?? null,
        name: line.name,
        description: line.description ?? null,
        quantity,
        unitPriceAmount,
        unitPriceCurrency: currency,
        discountPercentage,
        taxRatePercentage: resolved.blendedPercentage,
        supplyClass: lineSupplyClass(resolved.blendedPercentage, line.supplyClass ?? ("supplyClass" in resolved ? resolved.supplyClass : null)),
        hsnSac: line.hsnSac ?? null,
        taxRateId: line.taxRateId ?? null,
        taxGroupId: line.taxGroupId ?? null,
        isTaxInclusive,
        lineSubtotalAmount: netAmount,
        lineTaxAmount: taxResult.taxAmount.amount,
        lineTotalAmount: taxResult.total.amount,
      };
    }),
  );

  return { lines: computed, subtotalAmount, discountAmount, taxAmount, totalAmount };
}

/**
 * PRD F5 Stage 1 (Phase 2 · Money In) — invoice CRUD, issue (with ledger
 * posting per §7.2 "Invoice issued") and void (with a reversing posting per
 * §7.2/CLAUDE.md), and emailing the invoice as a PDF (S-05.7). Advances,
 * credit notes, quote/milestone conversion, and reminders are later stages
 * (see CHANGELOG). This service implements: draft CRUD, issue (number
 * allocation + immutability + journal posting), void (reason required +
 * reversing entry), and sendEmail (a deliberately separate action from
 * issue — see that method's own doc comment).
 */
@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly auditLog: AuditLogService,
    private readonly numbering: NumberingService,
    private readonly ledger: LedgerService,
    private readonly queue: QueueService,
    private readonly conversionGuard: QuoteConversionGuardService,
    private readonly taxResolver: TaxResolverService,
    private readonly placeOfSupply: PlaceOfSupplyService,
  ) {}

  async list(orgId: string, options: { status?: string; contactId?: string }) {
    const conditions = [eq(invoices.orgId, orgId)];
    if (options.contactId) conditions.push(eq(invoices.contactId, options.contactId));

    const rows = await this.db
      .select({
        invoice: invoices,
        contactName: contacts.name,
        // US-INV-23 — the last day it was reminded (organisation date), so the bulk bar can count only invoices not reminded today.
        lastReminderOn: sql<string | null>`(select max(${invoiceReminders.sentOn})::text from ${invoiceReminders} where ${invoiceReminders.invoiceId} = ${invoices.id})`,
      })
      .from(invoices)
      .leftJoin(contacts, eq(invoices.contactId, contacts.id))
      .where(and(...conditions))
      .orderBy(desc(invoices.createdAt));

    const today = orgClock().date;
    let result = rows.map((r) => ({
      ...r.invoice,
      contactName: r.contactName,
      lastReminderOn: r.lastReminderOn,
      remindedToday: r.lastReminderOn === today,
      isOverdue: isOverdue(r.invoice),
      paymentStatus: paymentStatus(r.invoice),
      balanceDue: r.invoice.totalAmount - r.invoice.retentionAmount - r.invoice.amountPaid - r.invoice.creditedAmount,
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
      paymentStatus: paymentStatus(row.invoice),
      balanceDue: row.invoice.totalAmount - row.invoice.retentionAmount - row.invoice.amountPaid - row.invoice.creditedAmount,
      ...(await this.jobDetails(orgId, row.invoice)),
      lines,
    };
  }

  /**
   * US-JOB-21 — for an invoice raised from a job: the job and milestone it
   * bills, the retention held on it (as a percentage of the net amount,
   * from the invoice's own figures so it never drifts if the job's rate
   * changes) and the retention held on the whole job so far, read from the
   * ledger (1150 Retention Receivable lines for the job, D-011).
   */
  private async jobDetails(orgId: string, invoice: typeof invoices.$inferSelect) {
    if (!invoice.jobId) return { job: null, milestone: null, retention: null };
    const [job] = await this.db.select({ id: jobs.id, name: jobs.name, number: jobs.number }).from(jobs).where(and(eq(jobs.orgId, orgId), eq(jobs.id, invoice.jobId)));
    const [milestone] = invoice.milestoneId
      ? await this.db
          .select({ id: milestones.id, name: milestones.name, amountType: milestones.amountType, amount: milestones.amount })
          .from(milestones)
          .where(eq(milestones.id, invoice.milestoneId))
      : [];

    let retention: { percent: string; heldOnJob: bigint } | null = null;
    if (invoice.retentionAmount > 0n) {
      const retentionAccountId = await this.ledger.resolveSystemAccount(this.db, orgId, "retentionReceivable");
      const [held] = await this.db
        .select({ balance: sql<string>`coalesce(sum(${journalLines.debit} - ${journalLines.credit}), 0)` })
        .from(journalLines)
        .where(and(eq(journalLines.accountId, retentionAccountId), eq(journalLines.jobId, invoice.jobId)));
      retention = { percent: percentageOf(invoice.retentionAmount, invoice.subtotalAmount - invoice.discountAmount), heldOnJob: BigInt(held?.balance ?? "0") };
    }

    return {
      job: job ? { id: job.id, name: job.name, number: job.number } : null,
      milestone: milestone
        ? { id: milestone.id, name: milestone.name, percent: milestone.amountType === "percent" ? milestone.amount : null }
        : null,
      retention,
    };
  }

  /** `GET /invoices/:id/history` — confirms the invoice exists (org-scoped) before delegating to AuditLogService, same pattern as ContactsService.getHistory. */
  async getHistory(orgId: string, id: string) {
    await this.getOne(orgId, id);
    return this.auditLog.listForEntity(orgId, "invoice", id);
  }

  /**
   * Creates a new draft, always unnumbered — see invoices.ts's schema
   * comment. `isDemo` mirrors QuotesService.create's own convention: never
   * client-settable, exists solely for a future DemoDataService hook to
   * reuse this same totals/audit-log logic instead of hand-inserting rows.
   */
  async create(
    orgId: string,
    actorUserId: string,
    input: CreateInvoiceInput,
    isDemo = false,
    sourceQuoteId?: string,
    /** US-INV-21 — set by the recurring run; unique per schedule and date. */
    recurring?: { recurringInvoiceId: string; recurringRunOn: string },
  ) {
    const [contact] = await this.db.select().from(contacts).where(and(eq(contacts.orgId, orgId), eq(contacts.id, input.contactId)));
    if (!contact) {
      throw new BadRequestException("Contact not found");
    }

    const totals = await computeInvoiceTotals(orgId, input.currency, withoutTaxIfAdvance(input.lines, input.type), this.taxResolver);
    // US-TAX-13: the place of supply given, else the contact's.
    const supply = await this.placeOfSupply.resolve(orgId, input.contactId, input.placeOfSupply, "sale");

    const created = await this.db.transaction(async (tx) => {
      const [invoice] = await tx
        .insert(invoices)
        .values({
          orgId,
          contactId: input.contactId,
          status: "draft",
          type: input.type,
          sourceQuoteId: sourceQuoteId ?? null,
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
          recurringInvoiceId: recurring?.recurringInvoiceId ?? null,
          recurringRunOn: recurring?.recurringRunOn ?? null,
          ...{ placeOfSupply: supply.placeOfSupply, supplyType: supply.supplyType },
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
   * S-03.10's invoice half — "convert an accepted quote into a job and its
   * first invoice." Only the invoice half (Jobs don't exist until Phase
   * 3). Reads the accepted quote's own snapshot (never re-reads catalog
   * items — quote_lines already snapshotted name/price/tax at the time
   * they were added, per CLAUDE.md's "documents snapshot their data")
   * and creates a DRAFT invoice from it via the same `create()` this
   * method delegates to — not a parallel insert path, so a converted
   * invoice gets identical validation/audit-log/totals-computation
   * behavior as one built from scratch. Only `quote.status === "accepted"`
   * is convertible — converting a draft/sent/rejected/expired quote makes
   * no sense (nothing to convert from, or the customer never agreed to
   * it). A quote can be converted more than once in principle — S-03.10's
   * wording doesn't ask for a one-shot restriction, and a legitimate case
   * exists (e.g. a first invoice covers only part of the quoted work, a
   * second later invoice covers the rest). The risk of an ACCIDENTAL
   * repeat conversion (re-clicking the button, silently doubling the
   * billed amount) is what `QuoteConversionGuardService.check` exists to
   * catch — an org-configurable warn/block preference, not a hardcoded
   * one-shot restriction. See that service's own doc comment.
   */
  async convertFromQuote(orgId: string, actorUserId: string, quoteId: string, confirm = false) {
    const [quote] = await this.db.select().from(quotes).where(and(eq(quotes.orgId, orgId), eq(quotes.id, quoteId)));
    if (!quote) {
      throw new NotFoundException("Quote not found");
    }
    if (quote.status !== "accepted") {
      throw new BadRequestException("Only an accepted quote can be converted to an invoice");
    }

    await this.conversionGuard.check(orgId, quoteId, confirm);

    const lines = await this.db.select().from(quoteLines).where(eq(quoteLines.quoteId, quoteId)).orderBy(quoteLines.sortOrder);

    const input: CreateInvoiceInput = {
      contactId: quote.contactId,
      type: "standard",
      currency: quote.currency,
      // US-TAX-13: the quote's place of supply carries over.
      placeOfSupply: quote.placeOfSupply ?? undefined,
      issueDate: null,
      dueDate: null,
      notes: quote.notes ?? null,
      termsAndConditions: quote.termsAndConditions ?? null,
      lines: lines.map((line) => ({
        type: line.type,
        catalogItemId: line.catalogItemId,
        name: line.name,
        description: line.description,
        quantity: line.quantity,
        unitPriceAmount: line.unitPriceAmount,
        unitPriceCurrency: line.unitPriceCurrency,
        discountPercentage: line.discountPercentage,
        taxRatePercentage: line.taxRatePercentage,
        taxRateId: line.taxRateId,
        taxGroupId: line.taxGroupId,
        isTaxInclusive: line.isTaxInclusive,
        supplyClass: line.supplyClass,
        hsnSac: line.hsnSac,
      })),
    };

    return this.create(orgId, actorUserId, input, false, quoteId);
  }

  /**
   * S-05.1's milestone path / S-04.5 — "raise a progress invoice directly
   * from a completed milestone." Called by MilestonesService.invoiceMilestone,
   * never directly from a controller (a milestone's own completion/
   * invoiced-state guards live there, not here — this method trusts its
   * caller the same way `create()` trusts a pre-validated `input`).
   *
   * Builds a single `item`-type line for the milestone's own
   * `resolvedAmount` (already a snapshot — see milestones.ts's own doc
   * comment on why this column exists) at the job's own tax rate default
   * of 0% (a milestone doesn't carry its own tax rate; construction
   * progress billing typically taxes the whole invoice at the org's
   * standard rate, applied here via `taxRatePercentage` if the caller
   * supplies one — defaulting to untaxed keeps this from silently
   * inventing a tax rate no one configured). `type: "progress"` marks
   * this as a milestone-driven invoice for reporting purposes, distinct
   * from a `standard` from-scratch invoice.
   */
  async createFromMilestone(
    orgId: string,
    actorUserId: string,
    input: {
      jobId: string;
      milestoneId: string;
      contactId: string;
      currency: string;
      name: string;
      amount: bigint;
      taxRatePercentage?: number;
      retentionAmount?: bigint;
    },
  ) {
    const [contact] = await this.db.select().from(contacts).where(and(eq(contacts.orgId, orgId), eq(contacts.id, input.contactId)));
    if (!contact) {
      throw new BadRequestException("Contact not found");
    }

    const totals = await computeInvoiceTotals(orgId, input.currency, [
      {
        type: "item",
        catalogItemId: null,
        name: input.name,
        description: null,
        quantity: 1,
        unitPriceAmount: input.amount,
        unitPriceCurrency: input.currency,
        discountPercentage: 0,
        taxRatePercentage: input.taxRatePercentage ?? 0,
      },
    ], this.taxResolver);

    const created = await this.db.transaction(async (tx) => {
      const [invoice] = await tx
        .insert(invoices)
        .values({
          orgId,
          contactId: input.contactId,
          status: "draft",
          type: "progress",
          jobId: input.jobId,
          milestoneId: input.milestoneId,
          currency: input.currency,
          subtotalAmount: totals.subtotalAmount,
          discountAmount: totals.discountAmount,
          taxAmount: totals.taxAmount,
          retentionAmount: input.retentionAmount ?? 0n,
          totalAmount: totals.totalAmount,
          createdByUserId: actorUserId,
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
        changes: [
          { field: "status", from: null, to: "draft" },
          { field: "milestoneId", from: null, to: input.milestoneId },
        ],
      });

      return invoice;
    });

    return this.getOne(orgId, created!.id);
  }

  /**
   * S-04.7 — "release retention as a final invoice when the defect period
   * ends." A retention-release invoice is a `standard`-type invoice for
   * exactly the job's outstanding retained amount (summed from every prior
   * `progress` invoice's `retentionAmount` issued against this job, minus
   * whatever's already been released) — its own posting is the mirror
   * image of the original hold: debit Retention Receivable is wrong here
   * (that's what issuing WITH retention does); releasing instead credits
   * Retention Receivable and debits AR, moving the held amount into the
   * normal collectible-balance pool exactly like `Retention released` in
   * §7.2 does for the cash side once it's actually paid.
   *
   * Concretely: this posts "debit Accounts Receivable, credit Retention
   * Receivable" for the release amount at issue time (the retained amount
   * becomes a real, collectible receivable) — separate from and prior to
   * `Payment received` (debit Bank/Cash, credit AR) once the customer
   * actually pays it, matching how every other invoice's AR-then-payment
   * two-step already works. No Revenue/Tax line: the revenue and tax for
   * this amount were already recognised on the original progress
   * invoice(s) that held it back — recognising it again here would double
   * -count revenue.
   */
  async releaseRetention(orgId: string, actorUserId: string, jobId: string) {
    const [job] = await this.db.select().from(jobs).where(and(eq(jobs.orgId, orgId), eq(jobs.id, jobId)));
    if (!job) {
      throw new NotFoundException("Job not found");
    }

    const heldInvoices = await this.db
      .select()
      .from(invoices)
      .where(and(eq(invoices.orgId, orgId), eq(invoices.jobId, jobId), eq(invoices.status, "issued")));

    const totalHeld = heldInvoices.reduce((sum, inv) => sum + inv.retentionAmount, 0n);
    const alreadyReleased = heldInvoices
      .filter((inv) => inv.type === "retention_release")
      .reduce((sum, inv) => sum + inv.totalAmount, 0n);
    const releasable = totalHeld - alreadyReleased;

    if (releasable <= 0n) {
      throw new BadRequestException("No retention is outstanding for this job");
    }

    const result = await this.db.transaction(async (tx) => {
      const number = await this.numbering.allocateNumber(tx, orgId, "invoice");
      const issuedAt = new Date();
      const issueDateStr = issuedAt.toISOString().slice(0, 10);

      const [invoice] = await tx
        .insert(invoices)
        .values({
          orgId,
          contactId: job.contactId,
          status: "issued",
          type: "retention_release",
          jobId,
          number,
          issueDate: issuedAt,
          issuedAt,
          currency: job.currency,
          subtotalAmount: releasable,
          totalAmount: releasable,
          notes: `Retention release for ${job.name}`,
          createdByUserId: actorUserId,
        })
        .returning();

      await tx.insert(invoiceLines).values({
        invoiceId: invoice!.id,
        sortOrder: 0,
        type: "item",
        name: `Retention release — ${job.name}`,
        quantity: 1,
        unitPriceAmount: releasable,
        unitPriceCurrency: job.currency,
        lineSubtotalAmount: releasable,
        lineTotalAmount: releasable,
      });

      const arAccountId = await this.ledger.resolveSystemAccount(tx, orgId, "accountsReceivable");
      const retentionAccountId = await this.ledger.resolveSystemAccount(tx, orgId, "retentionReceivable");

      const journalEntryId = await this.ledger.postEntry(tx, {
        orgId,
        date: issueDateStr,
        narration: `Invoice ${number} — retention released for job ${job.name}`,
        sourceType: "invoice",
        sourceId: invoice!.id,
        lines: [
          { accountId: arAccountId, debit: releasable, credit: 0n, contactId: job.contactId, jobId },
          { accountId: retentionAccountId, debit: 0n, credit: releasable, contactId: job.contactId, jobId },
        ],
      });

      await tx.update(invoices).set({ journalEntryId }).where(eq(invoices.id, invoice!.id));

      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "issued",
        entityType: "invoice",
        entityId: invoice!.id,
        contactId: job.contactId,
        changes: [{ field: "status", from: null, to: "issued" }],
      });

      return invoice;
    });

    await queueIssuedPdf(this.queue, orgId, "invoice", result!.id);
    return this.getOne(orgId, result!.id);
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
    await requireOwnershipCapability(this.db, { orgId, userId: actorUserId }, existing.createdByUserId, {
      own: "invoices.edit_own",
      others: "invoices.edit_others",
    });
    if (existing.status !== "draft") {
      throw new BadRequestException("Only a draft invoice can be edited");
    }

    const currency = input.currency ?? existing.currency;
    const type = input.type ?? existing.type;
    // Turning an invoice into an advance (deposit) one recomputes its lines without tax.
    const lines =
      input.lines ??
      (type === "advance" && existing.type !== "advance"
        ? (await this.db.select().from(invoiceLines).where(eq(invoiceLines.invoiceId, id)).orderBy(invoiceLines.sortOrder)).map((l) => ({ ...l, type: l.type }))
        : undefined);
    const totals = lines !== undefined ? await computeInvoiceTotals(orgId, currency, withoutTaxIfAdvance(lines, type), this.taxResolver) : null;
    // US-TAX-13: a new contact (or a draft saved before GST was set up) takes the contact's place of supply.
    const supply = await this.placeOfSupply.resolve(
      orgId,
      input.contactId ?? existing.contactId,
      input.placeOfSupply !== undefined ? input.placeOfSupply : (input.contactId !== undefined && input.contactId !== existing.contactId) || existing.placeOfSupply === null ? undefined : existing.placeOfSupply,
      "sale",
    );

    const updated = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(invoices)
        .set({
          ...{ placeOfSupply: supply.placeOfSupply, supplyType: supply.supplyType },
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

      if (totals) {
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
   * and — for a `standard`/`progress` invoice — posts the "Invoice issued"
   * journal entry per §7.2 (debit Accounts Receivable, credit Revenue +
   * Tax Payable) in the SAME transaction — CLAUDE.md's "ledger is
   * derived... in the same transaction as the business document it
   * originates from" is non-negotiable here: if the posting fails, the
   * whole issue must roll back, not leave an issued invoice with no
   * ledger trail.
   *
   * **S-05.4 — an `advance`-type invoice posts NOTHING on issue.** It's a
   * request for a deposit, not a claim on goods/services already owed —
   * nothing is actually owed until real work is invoiced, so debiting AR
   * here would misrepresent what's happened. §7.2's own "Advance
   * received" row (debit Bank/Cash, credit Customer Advances) is a
   * *payment*-received posting, not an invoice-issued one — it already
   * fires from `PaymentsService.create` the moment the customer's deposit
   * is actually recorded as a payment (S-06.4's unallocated-credit path),
   * and `PaymentsService.applyCredit` (S-05.5) already posts "Advance
   * applied to invoice" when that sitting credit is later applied to a
   * real invoice. So an advance invoice only needs to allocate a number
   * and render/email as a PDF asking for a deposit — the two ledger
   * postings it triggers over its lifecycle both already exist, on the
   * payment side, not here.
   *
   * Revenue (for `standard`/`progress` invoices) is split per catalog
   * item's own `incomeAccountId` (S-02.3), not posted as one blended
   * line — each `item`-type line's `lineSubtotalAmount` (post-discount,
   * pre-tax) is grouped by its resolved income account and posted as its
   * own credit line. A line falls back to `resolvedRevenueAccountId` (the
   * same default-to-4100 "Sales — Services" this method already resolved,
   * or the caller's own explicit `revenueAccountId` override) when it has
   * no `catalogItemId` (a free-form line never added from the catalogue)
   * or the referenced catalog item has no `incomeAccountId` set (S-02.3's
   * own field is optional per PRD F2 — "SHOULD", not "MUST" — so an org
   * that never bothered to set per-item income accounts still gets
   * exactly Stage 1's old single-blended-line behavior, just reached via
   * the fallback path rather than a separate code path).
   *
   * Discounts are NOT posted as their own "Discounts Given" contra-revenue
   * line — `lineSubtotalAmount` per line is already the post-discount net
   * (matching how the invoice's own `subtotalAmount` is post-discount), so
   * AR simply nets to the discounted total; a gross/contra presentation is
   * a P&L-reporting-time concern for Phase 4, not required for the ledger
   * to balance correctly today.
   *
   * **S-04.6 — retention.** When `retentionAmount > 0` (set at creation
   * time by `InvoicesService.createFromMilestone` off the job's
   * `retentionPct`), §7.2's "Invoice with retention" row applies: the AR
   * debit is split into two lines — `totalAmount - retentionAmount` to
   * Accounts Receivable (the actually-collectible net) and
   * `retentionAmount` to Retention Receivable (held back until S-04.7's
   * release) — rather than one full-total AR debit. Revenue and Tax are
   * unaffected by retention (the work is still fully recognised as
   * revenue now; only the cash collection is deferred), so those credit
   * lines are computed exactly the same as the non-retention path.
   *
   * Every posting line for a job-linked invoice (`existing.jobId` set)
   * also carries `jobId`, so job costing (S-04.8) can filter
   * `journal_lines` by job per CLAUDE.md's "job costing pulls from journal
   * lines tagged with job_id" rule — this is the only place invoice
   * issuance sets it, matching how `contactId` is already attached to
   * every line here.
   */
  async issue(orgId: string, id: string, actorUserId: string, revenueAccountId?: string) {
    const [preCheck] = await this.db.select().from(invoices).where(and(eq(invoices.orgId, orgId), eq(invoices.id, id)));
    if (!preCheck) {
      throw new NotFoundException("Invoice not found");
    }

    const isAdvance = preCheck.type === "advance";
    const resolvedRevenueAccountId = isAdvance ? null : (revenueAccountId ?? (await this.resolveDefaultRevenueAccount(orgId)));

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

      let journalEntryId: string | null = null;
      if (!isAdvance) {
        const arAccountId = await this.ledger.resolveSystemAccount(tx, orgId, "accountsReceivable");
        const taxAccountId = await this.ledger.resolveSystemAccount(tx, orgId, "outputTaxPayable");

        const revenueByAccount = await this.resolveRevenuePostingLines(tx, orgId, id, resolvedRevenueAccountId!);

        const postingLines: { accountId: string; debit: bigint; credit: bigint; contactId: string; jobId?: string | null }[] = [];

        if (existing.retentionAmount > 0n) {
          const retentionAccountId = await this.ledger.resolveSystemAccount(tx, orgId, "retentionReceivable");
          postingLines.push(
            {
              accountId: arAccountId,
              debit: existing.totalAmount - existing.retentionAmount,
              credit: 0n,
              contactId: existing.contactId,
              jobId: existing.jobId,
            },
            { accountId: retentionAccountId, debit: existing.retentionAmount, credit: 0n, contactId: existing.contactId, jobId: existing.jobId },
          );
        } else {
          postingLines.push({ accountId: arAccountId, debit: existing.totalAmount, credit: 0n, contactId: existing.contactId, jobId: existing.jobId });
        }

        postingLines.push(
          ...Array.from(revenueByAccount.entries()).map(([accountId, amount]) => ({
            accountId,
            debit: 0n,
            credit: amount,
            contactId: existing.contactId,
            jobId: existing.jobId,
          })),
        );
        if (existing.taxAmount > 0n) {
          postingLines.push({ accountId: taxAccountId, debit: 0n, credit: existing.taxAmount, contactId: existing.contactId, jobId: existing.jobId });
        }

        journalEntryId = await this.ledger.postEntry(tx, {
          orgId,
          date: issueDateStr,
          narration: `Invoice ${number} issued`,
          sourceType: "invoice",
          sourceId: id,
          lines: postingLines,
        });
      }

      // US-INV-15: the payment instructions as they are now, kept with the invoice.
      const [profile] = await tx
        .select({ value: settings.value })
        .from(settings)
        .where(and(eq(settings.orgId, orgId), eq(settings.key, "business_profile")));
      const paymentInstructions = (profile?.value as { paymentInstructions?: string } | undefined)?.paymentInstructions?.trim() || null;

      // US-JOB-29 (D-128): a progress invoice on a job gets the job's next claim number, under the job row lock.
      let progressClaimNo: number | null = null;
      if (existing.type === "progress" && existing.jobId) {
        await tx.select({ id: jobs.id }).from(jobs).where(eq(jobs.id, existing.jobId)).for("update");
        const [last] = await tx
          .select({ max: sql<number | null>`max(${invoices.progressClaimNo})` })
          .from(invoices)
          .where(eq(invoices.jobId, existing.jobId));
        progressClaimNo = Number(last?.max ?? 0) + 1;
      }

      const [row] = await tx
        .update(invoices)
        .set({
          status: "issued",
          number,
          issuedAt,
          // US-TAX-13: snapshotted at issue.
          ...(await this.placeOfSupply.resolve(orgId, existing.contactId, existing.placeOfSupply ?? undefined, "sale", tx)),
          issueDate: existing.issueDate ?? issuedAt,
          journalEntryId,
          paymentInstructions,
          progressClaimNo,
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

    await queueIssuedPdf(this.queue, orgId, "invoice", result!.id);
    return this.getOne(orgId, result!.id);
  }

  /**
   * S-05.7 — queues an `invoice-send-email` pg-boss job (InvoiceEmailWorker)
   * to render+persist the PDF and email it to the invoice's contact.
   * Deliberately a SEPARATE action from `issue()`, not auto-triggered by
   * it — unlike QuotesService.send (which issues and emails in one call),
   * the user explicitly asked for issuing and emailing an invoice to be
   * two distinct steps, so a business can issue without immediately
   * notifying the customer. Only an issued invoice can be emailed (a
   * draft has no permanent number/snapshot yet, matching quotes' own
   * "only send an issued document" posture).
   *
   * `emailStatus` is set to "pending" here, before enqueuing — same
   * "show 'sending…' immediately, not a blank state" reasoning as
   * QuotesService.send's own comment on the identical field. Enqueuing
   * itself is not awaited for completion and any enqueue-time failure is
   * logged and swallowed, not thrown — this action must not fail or block
   * on a transient queue issue once the caller has been told sending
   * started.
   */
  async sendEmail(orgId: string, id: string, actorUserId: string) {
    const [existing] = await this.db.select().from(invoices).where(and(eq(invoices.orgId, orgId), eq(invoices.id, id)));
    if (!existing) {
      throw new NotFoundException("Invoice not found");
    }
    if (existing.status !== "issued") {
      throw new BadRequestException("Only an issued invoice can be emailed");
    }

    await this.db.update(invoices).set({ emailStatus: "pending", updatedAt: new Date() }).where(eq(invoices.id, id));

    await this.auditLog.record(this.db, {
      orgId,
      actorUserId,
      action: "email_queued",
      entityType: "invoice",
      entityId: id,
      contactId: existing.contactId,
      changes: [{ field: "emailStatus", from: existing.emailStatus, to: "pending" }],
    });

    try {
      await this.queue.send(INVOICE_SEND_EMAIL_QUEUE, { orgId, invoiceId: id });
    } catch (err) {
      this.logger.error(`Failed to enqueue invoice-send-email job for invoice ${id}`, err instanceof Error ? err.stack : String(err));
    }

    return this.getOne(orgId, id);
  }

  /**
   * US-INV-23 (D-097) — reminds the customers of several invoices at once.
   * Eligible: issued, with a balance, not already reminded today (manual or
   * automatic), and a customer with an email address. Unlike the one-click
   * reminder it doesn't need the invoice to be overdue — the email says
   * "is due in N days" or "is due today" as fits. Every skipped invoice is
   * reported with the reason.
   */
  async bulkSendReminders(orgId: string, actorUserId: string, ids: string[]): Promise<BulkResult> {
    const unique = [...new Set(ids)];
    const today = orgClock().date;
    const rows = await this.db
      .select({ invoice: invoices, contactEmail: contacts.email })
      .from(invoices)
      .leftJoin(contacts, eq(invoices.contactId, contacts.id))
      .where(and(eq(invoices.orgId, orgId), inArray(invoices.id, unique)));
    const byId = new Map(rows.map((r) => [r.invoice.id, r]));
    const result: BulkResult = { done: [], skipped: [] };

    for (const id of unique) {
      const row = byId.get(id);
      const inv = row?.invoice;
      const skip = (reason: string) => result.skipped.push({ id, label: inv?.number ?? null, reason });
      if (!inv) {
        skip("Not found.");
        continue;
      }
      if (inv.status === "draft") {
        skip("It's a draft — issue it first.");
        continue;
      }
      if (inv.status === "void") {
        skip("It's void.");
        continue;
      }
      if (inv.totalAmount - inv.retentionAmount - inv.amountPaid - inv.creditedAmount <= 0n) {
        skip("Nothing is owed on it.");
        continue;
      }
      if (!row!.contactEmail) {
        skip("The customer has no email address.");
        continue;
      }
      const recorded = await this.db.transaction(async (tx) => {
        const [reminder] = await tx.insert(invoiceReminders).values({ orgId, invoiceId: id, sentOn: today, kind: "manual" }).onConflictDoNothing().returning({ id: invoiceReminders.id });
        if (!reminder) return false;
        await tx.update(invoices).set({ emailStatus: "pending", updatedAt: new Date() }).where(eq(invoices.id, id));
        await this.auditLog.record(tx, {
          orgId,
          actorUserId,
          action: "reminder_queued",
          entityType: "invoice",
          entityId: id,
          contactId: inv.contactId,
          changes: [{ field: "emailStatus", from: inv.emailStatus, to: "pending" }],
        });
        return true;
      });
      if (!recorded) {
        skip("Already reminded today.");
        continue;
      }
      const due = inv.dueDate ? new Date(inv.dueDate).toISOString().slice(0, 10) : null;
      try {
        await this.queue.send(INVOICE_SEND_EMAIL_QUEUE, { orgId, invoiceId: id, isReminder: true, ...(due ? { daysOverdue: daysBetween(due, today) } : {}) });
      } catch (err) {
        this.logger.error(`Failed to enqueue reminder job for invoice ${id}`, err instanceof Error ? err.stack : String(err));
      }
      result.done.push(id);
    }
    return result;
  }

  /**
   * S-05.10 — "send a payment reminder in one click." Reuses the exact
   * same queue/worker as `sendEmail` (same PDF attachment, same
   * `emailStatus` bookkeeping) with `isReminder: true`, which only changes
   * the subject/opening line (InvoiceEmailWorker.attemptSend's own
   * branch) — not a parallel mechanism, since a reminder IS an invoice
   * email, just reminder-flavored copy. Only callable on an invoice that
   * is actually overdue (per `isOverdue()`'s own definition: issued,
   * has a due date, has an outstanding balance, and that due date has
   * passed) — reminding someone about an invoice that isn't overdue yet
   * doesn't match S-05.10's own framing ("so following up isn't a
   * chore" implies there's something to follow up ON).
   */
  async sendReminder(orgId: string, id: string, actorUserId: string) {
    const [existing] = await this.db.select().from(invoices).where(and(eq(invoices.orgId, orgId), eq(invoices.id, id)));
    if (!existing) {
      throw new NotFoundException("Invoice not found");
    }
    if (!isOverdue(existing)) {
      throw new BadRequestException("A payment reminder can only be sent for an overdue invoice");
    }

    await this.db.update(invoices).set({ emailStatus: "pending", updatedAt: new Date() }).where(eq(invoices.id, id));
    // US-INV-19: a manual reminder counts as today's, so the automatic run skips this invoice today.
    await this.db.insert(invoiceReminders).values({ orgId, invoiceId: id, sentOn: orgClock().date, kind: "manual" }).onConflictDoNothing();

    await this.auditLog.record(this.db, {
      orgId,
      actorUserId,
      action: "reminder_queued",
      entityType: "invoice",
      entityId: id,
      contactId: existing.contactId,
      changes: [{ field: "emailStatus", from: existing.emailStatus, to: "pending" }],
    });

    try {
      await this.queue.send(INVOICE_SEND_EMAIL_QUEUE, { orgId, invoiceId: id, isReminder: true });
    } catch (err) {
      this.logger.error(`Failed to enqueue reminder job for invoice ${id}`, err instanceof Error ? err.stack : String(err));
    }

    return this.getOne(orgId, id);
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
   * S-02.3 — groups this invoice's `item`-type lines' `lineSubtotalAmount`
   * (post-discount, pre-tax net) by each line's resolved income account,
   * so `issue()` can post one credit line per distinct account instead of
   * one blended line. See `issue()`'s own doc comment for the fallback
   * rule (no catalog item, or catalog item has no `incomeAccountId` set)
   * — `fallbackAccountId` there.
   */
  private async resolveRevenuePostingLines(
    tx: Transaction,
    orgId: string,
    invoiceId: string,
    fallbackAccountId: string,
  ): Promise<Map<string, bigint>> {
    const lines = await tx
      .select({ catalogItemId: invoiceLines.catalogItemId, lineSubtotalAmount: invoiceLines.lineSubtotalAmount })
      .from(invoiceLines)
      .where(and(eq(invoiceLines.invoiceId, invoiceId), eq(invoiceLines.type, "item")));

    const catalogItemIds = [...new Set(lines.map((l) => l.catalogItemId).filter((id): id is string => id !== null))];
    const incomeAccountByCatalogItem = new Map<string, string | null>();
    if (catalogItemIds.length > 0) {
      const rows = await tx
        .select({ id: catalogItems.id, incomeAccountId: catalogItems.incomeAccountId })
        .from(catalogItems)
        .where(and(eq(catalogItems.orgId, orgId), inArray(catalogItems.id, catalogItemIds)));
      for (const row of rows) {
        incomeAccountByCatalogItem.set(row.id, row.incomeAccountId);
      }
    }

    const byAccount = new Map<string, bigint>();
    for (const line of lines) {
      if (line.lineSubtotalAmount === 0n) continue;
      const resolvedAccountId =
        (line.catalogItemId && incomeAccountByCatalogItem.get(line.catalogItemId)) || fallbackAccountId;
      byAccount.set(resolvedAccountId, (byAccount.get(resolvedAccountId) ?? 0n) + line.lineSubtotalAmount);
    }

    return byAccount;
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
    // US-RPT-17: an opening invoice is removed in Opening balances (while unlocked), or credited.
    if (preCheck.type === "opening") {
      throw new BadRequestException("An opening invoice can't be voided. Remove it in Opening balances, or issue a credit note.");
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
    await requireOwnershipCapability(this.db, { orgId, userId: actorUserId }, existing.createdByUserId, {
      own: "invoices.delete_own",
      others: "invoices.delete_others",
    });
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
      taxRateId: line.taxRateId,
      taxGroupId: line.taxGroupId,
      isTaxInclusive: line.isTaxInclusive,
      supplyClass: line.supplyClass,
      hsnSac: line.hsnSac,
      lineSubtotalAmount: line.lineSubtotalAmount,
      lineTaxAmount: line.lineTaxAmount,
      lineTotalAmount: line.lineTotalAmount,
    })),
  );
}

/** S-05.9 — computed, not stored, exactly like quotes.ts's isExpired. Only an `issued` invoice with an outstanding balance and a past due date is overdue. Balance accounts for payments, credit notes (S-05.6), and retention (S-04.6) — a fully credited invoice, or one whose only remaining balance is held-back retention not yet due for release, is no more overdue than a fully paid one. */
/**
 * US-PAY-13 — how much of an issued invoice has been paid: "paid" once
 * nothing is left to collect, "partially_paid" once something has been
 * paid. Works the same for advance (deposit) invoices.
 */
function paymentStatus(invoice: typeof invoices.$inferSelect): "unpaid" | "partially_paid" | "paid" {
  if (invoice.status !== "issued") return "unpaid";
  const balance = invoice.totalAmount - invoice.retentionAmount - invoice.amountPaid - invoice.creditedAmount;
  if (invoice.amountPaid > 0n && balance <= 0n) return "paid";
  return invoice.amountPaid > 0n ? "partially_paid" : "unpaid";
}

function isOverdue(invoice: typeof invoices.$inferSelect): boolean {
  if (invoice.status !== "issued" || !invoice.dueDate) return false;
  if (invoice.totalAmount - invoice.retentionAmount - invoice.amountPaid - invoice.creditedAmount <= 0n) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(invoice.dueDate);
  dueDate.setHours(0, 0, 0, 0);
  return dueDate < today;
}
