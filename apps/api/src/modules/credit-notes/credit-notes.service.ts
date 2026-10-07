import { QueueService } from "../queue/queue.service";
import { queueIssuedPdf } from "../pdf/issued-pdf.service";
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { applyPaymentCreditSchema, createCreditNoteSchema, updateCreditNoteSchema } from "@spine/shared";
import { computeDocumentLine, formatMoney, lineSupplyClass, supplyClassTaxError, type SupplyClass } from "@spine/shared";
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import type { z } from "zod";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { creditNotes, creditNoteAllocations, creditNoteLines, invoices, contacts, accounts } from "../../db/schema";
import { orgMoneySettings } from "../../common/money-format";
import { AuditLogService } from "../audit/audit-log.service";
import { NumberingService } from "../numbering/numbering.service";
import { LedgerService } from "../ledger/ledger.service";
import { requireOwnershipCapability } from "../../auth/capability.util";

type ApplyCreditInput = z.infer<typeof applyPaymentCreditSchema>;
export type CreateCreditNoteInput = z.infer<typeof createCreditNoteSchema>;
export type UpdateCreditNoteInput = z.infer<typeof updateCreditNoteSchema>;

interface ComputedLine {
  sortOrder: number;
  type: "item" | "heading" | "text";
  catalogItemId: string | null;
  name: string;
  description: string | null;
  quantity: number;
  unitPriceAmount: bigint;
  unitPriceCurrency: string;
  taxRatePercentage: number;
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
 * Server-side computation of every line and document total from raw line
 * input — mirrors computeInvoiceTotals in invoices.service.ts, minus
 * discount handling (a credit note corrects an already-net amount, it
 * doesn't re-apply a discount — see createCreditNoteSchema's own comment).
 * Duplicated rather than imported for the same reason invoices.ts's own
 * copy of quotes.ts's version is duplicated: independently owned per
 * document type so one's tax behaviour can't silently drift the other.
 */
function computeCreditNoteTotals(currency: string, lines: CreateCreditNoteInput["lines"]): ComputedTotals {
  let subtotalAmount = 0n;
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
        taxRatePercentage: 0,
        supplyClass: null,
        lineSubtotalAmount: 0n,
        lineTaxAmount: 0n,
        lineTotalAmount: 0n,
      };
    }

    // US-TAX-11: an exempt or non-taxable line carries no tax.
    const supplyError = supplyClassTaxError(line.supplyClass, line.taxRatePercentage);
    if (supplyError) throw new BadRequestException(supplyError);

    // US-TAX-07: exact decimal maths in @spine/shared, each figure rounded once.
    const computed = computeDocumentLine({
      quantity: line.quantity,
      unitPriceAmount: line.unitPriceAmount,
      currency,
      rates: line.taxRatePercentage > 0 ? [{ id: "line", name: "Tax", percent: line.taxRatePercentage, isCompound: false }] : [],
      inclusive: false,
    });
    const netAmount = computed.netAmount;
    const taxResult = computed.tax;

    subtotalAmount += netAmount;
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
      taxRatePercentage: line.taxRatePercentage,
      supplyClass: lineSupplyClass(line.taxRatePercentage, line.supplyClass),
      lineSubtotalAmount: netAmount,
      lineTaxAmount: taxResult.taxAmount.amount,
      lineTotalAmount: taxResult.total.amount,
    };
  });

  return { lines: computed, subtotalAmount, taxAmount, totalAmount };
}

/**
 * PRD F5 (S-05.6) — "issue a credit note against an invoice for a return
 * or correction, so I never edit an issued document." Draft CRUD + issue
 * (number allocation + immutability + §7.2 "Credit note issued" posting:
 * debit Revenue + Tax Payable, credit AR). No void — see credit-notes.ts
 * schema's own doc comment on why that's a deliberate scope boundary, not
 * a gap.
 */
@Injectable()
export class CreditNotesService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly auditLog: AuditLogService,
    private readonly numbering: NumberingService,
    private readonly ledger: LedgerService,
    private readonly queue: QueueService,
  ) {}

  async list(orgId: string, options: { invoiceId?: string; contactId?: string }) {
    const conditions = [eq(creditNotes.orgId, orgId)];
    if (options.invoiceId) conditions.push(eq(creditNotes.invoiceId, options.invoiceId));
    if (options.contactId) conditions.push(eq(creditNotes.contactId, options.contactId));

    const rows = await this.db
      .select({ creditNote: creditNotes, contactName: contacts.name, invoiceNumber: invoices.number })
      .from(creditNotes)
      .leftJoin(contacts, eq(creditNotes.contactId, contacts.id))
      .leftJoin(invoices, eq(creditNotes.invoiceId, invoices.id))
      .where(and(...conditions))
      .orderBy(desc(creditNotes.createdAt));

    return rows.map((r) => ({ ...r.creditNote, contactName: r.contactName, invoiceNumber: r.invoiceNumber }));
  }

  async getOne(orgId: string, id: string) {
    const [row] = await this.db
      .select({ creditNote: creditNotes, contactName: contacts.name, invoiceNumber: invoices.number })
      .from(creditNotes)
      .leftJoin(contacts, eq(creditNotes.contactId, contacts.id))
      .leftJoin(invoices, eq(creditNotes.invoiceId, invoices.id))
      .where(and(eq(creditNotes.orgId, orgId), eq(creditNotes.id, id)));
    if (!row) {
      throw new NotFoundException("Credit note not found");
    }

    const lines = await this.db
      .select()
      .from(creditNoteLines)
      .where(eq(creditNoteLines.creditNoteId, id))
      .orderBy(creditNoteLines.sortOrder);

    return { ...row.creditNote, contactName: row.contactName, invoiceNumber: row.invoiceNumber, lines };
  }

  /** `GET /credit-notes/:id/history` — same pattern as InvoicesService.getHistory. */
  async getHistory(orgId: string, id: string) {
    await this.getOne(orgId, id);
    return this.auditLog.listForEntity(orgId, "credit_note", id);
  }

  /** Creates a new draft, always unnumbered — see credit-notes.ts's schema comment. The target invoice must be `issued` — a credit note against a draft or void invoice makes no sense (nothing has posted to AR yet, or the posting was already reversed). */
  async create(orgId: string, actorUserId: string, input: CreateCreditNoteInput, isDemo = false) {
    const [invoice] = await this.db.select().from(invoices).where(and(eq(invoices.orgId, orgId), eq(invoices.id, input.invoiceId)));
    if (!invoice) {
      throw new BadRequestException("Invoice not found");
    }
    if (invoice.status !== "issued") {
      throw new BadRequestException("Credit notes can only be issued against an issued invoice");
    }
    if (invoice.type === "advance") {
      throw new BadRequestException(
        "Credit notes can't be issued against an advance/deposit invoice — it never posted to Accounts Receivable, so there's no revenue/AR posting to reverse (see InvoicesService.issue's own comment).",
      );
    }

    // US-TAX-13: a credit note corrects its invoice, so it has the invoice's place of supply.
    if (input.placeOfSupply && input.placeOfSupply !== invoice.placeOfSupply) {
      throw new BadRequestException("A credit note has its invoice's place of supply. Change the invoice instead.");
    }
    const totals = computeCreditNoteTotals(invoice.currency, input.lines);

    const created = await this.db.transaction(async (tx) => {
      const [creditNote] = await tx
        .insert(creditNotes)
        .values({
          orgId,
          invoiceId: input.invoiceId,
          contactId: invoice.contactId,
          reason: input.reason ?? null,
          currency: invoice.currency,
          subtotalAmount: totals.subtotalAmount,
          taxAmount: totals.taxAmount,
          totalAmount: totals.totalAmount,
          createdByUserId: actorUserId,
          isDemo,
          placeOfSupply: invoice.placeOfSupply,
          supplyType: invoice.supplyType,
        })
        .returning();

      if (totals.lines.length > 0) {
        await tx.insert(creditNoteLines).values(totals.lines.map((line) => ({ ...line, creditNoteId: creditNote!.id })));
      }

      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "created",
        entityType: "credit_note",
        entityId: creditNote!.id,
        contactId: invoice.contactId,
        changes: [{ field: "totalAmount", from: null, to: totals.totalAmount.toString() }],
      });

      return creditNote;
    });

    return this.getOne(orgId, created!.id);
  }

  /** A draft-only update — see updateCreditNoteSchema's own comment. Full-replace on `lines`, same convention as invoices/quotes. */
  async update(orgId: string, id: string, actorUserId: string, input: UpdateCreditNoteInput) {
    const [existing] = await this.db.select().from(creditNotes).where(and(eq(creditNotes.orgId, orgId), eq(creditNotes.id, id)));
    if (!existing) {
      throw new NotFoundException("Credit note not found");
    }
    await requireOwnershipCapability(this.db, { orgId, userId: actorUserId }, existing.createdByUserId, {
      own: "credit_notes.edit_own",
      others: "credit_notes.edit_others",
    });
    if (existing.status !== "draft") {
      throw new BadRequestException("Only a draft credit note can be edited");
    }

    const totals = input.lines !== undefined ? computeCreditNoteTotals(existing.currency, input.lines) : null;

    await this.db.transaction(async (tx) => {
      await tx
        .update(creditNotes)
        .set({
          reason: input.reason !== undefined ? input.reason : existing.reason,
          ...(totals
            ? { subtotalAmount: totals.subtotalAmount, taxAmount: totals.taxAmount, totalAmount: totals.totalAmount }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(creditNotes.id, id));

      if (totals) {
        await tx.delete(creditNoteLines).where(eq(creditNoteLines.creditNoteId, id));
        if (totals.lines.length > 0) {
          await tx.insert(creditNoteLines).values(totals.lines.map((line) => ({ ...line, creditNoteId: id })));
        }
      }

      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "updated",
        entityType: "credit_note",
        entityId: id,
        contactId: existing.contactId,
        changes: [],
      });
    });

    return this.getOne(orgId, id);
  }

  /**
   * S-05.6 — allocates the gapless number, flips to issued, posts the
   * §7.2 "Credit note issued" entry (debit Revenue + Tax Payable, credit
   * AR — the mirror image of "Invoice issued"), and reduces the source
   * invoice's `creditedAmount` so `balanceDue` reflects the correction
   * immediately. US-PAY-16 (D-142): a credit beyond what's left to pay —
   * a fully paid invoice included — credits AR only up to that balance and
   * holds the rest in 2200 Customer Advances as `creditRemainingAmount`,
   * to apply to another invoice or refund. All the credit notes on one
   * invoice can't add up to more than the invoice itself.
   *
   * `revenueAccountId` mirrors InvoicesService.issue's own optional
   * override, same default-to-4100 fallback — see that method's identical
   * reasoning on `resolveDefaultRevenueAccount`.
   */
  async issue(orgId: string, id: string, actorUserId: string, revenueAccountId?: string) {
    const [preCheck] = await this.db.select().from(creditNotes).where(and(eq(creditNotes.orgId, orgId), eq(creditNotes.id, id)));
    if (!preCheck) {
      throw new NotFoundException("Credit note not found");
    }

    const resolvedRevenueAccountId = revenueAccountId ?? (await this.resolveDefaultRevenueAccount(orgId));

    const result = await this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(creditNotes)
        .where(and(eq(creditNotes.orgId, orgId), eq(creditNotes.id, id)))
        .for("update");
      if (!existing) {
        throw new NotFoundException("Credit note not found");
      }
      if (existing.status !== "draft") {
        throw new BadRequestException("Only a draft credit note can be issued");
      }
      if (existing.totalAmount <= 0n) {
        throw new BadRequestException("Cannot issue a credit note with a zero or negative total");
      }

      const [invoice] = await tx
        .select()
        .from(invoices)
        .where(and(eq(invoices.orgId, orgId), eq(invoices.id, existing.invoiceId)))
        .for("update");
      if (!invoice) {
        throw new NotFoundException("Source invoice not found");
      }
      const [already] = await tx
        .select({ total: sql<string>`coalesce(sum(${creditNotes.totalAmount}), 0)` })
        .from(creditNotes)
        .where(and(eq(creditNotes.invoiceId, invoice.id), eq(creditNotes.status, "issued"), ne(creditNotes.id, id)));
      const creditable = invoice.totalAmount - BigInt(already!.total);
      if (existing.totalAmount > creditable) {
        const { currency, locale } = await orgMoneySettings(this.db, orgId);
        throw new BadRequestException(`You can credit up to ${formatMoney(creditable > 0n ? creditable : 0n, invoice.currency || currency, locale)} on this invoice.`);
      }
      // D-142: AR takes what's still owed; the rest is the customer's credit.
      const balance = invoice.totalAmount - invoice.retentionAmount - invoice.amountPaid - invoice.creditedAmount;
      const toAr = existing.totalAmount < balance ? existing.totalAmount : balance > 0n ? balance : 0n;
      const excess = existing.totalAmount - toAr;

      const number = await this.numbering.allocateNumber(tx, orgId, "credit_note");
      const issuedAt = new Date();
      const dateStr = issuedAt.toISOString().slice(0, 10);

      const arAccountId = await this.ledger.resolveSystemAccount(tx, orgId, "accountsReceivable");
      const taxAccountId = await this.ledger.resolveSystemAccount(tx, orgId, "outputTaxPayable");

      // US-JOB-27 (D-127): tagged with the invoice's job, so the job's revenue and billed to date drop by the credit.
      const jobId = invoice.jobId;
      const postingLines = [
        { accountId: resolvedRevenueAccountId, debit: existing.totalAmount - existing.taxAmount, credit: 0n, contactId: existing.contactId, jobId },
        { accountId: arAccountId, debit: 0n, credit: toAr, contactId: existing.contactId, jobId },
      ];
      if (excess > 0n) {
        const advancesAccountId = await this.ledger.resolveSystemAccount(tx, orgId, "customerAdvances");
        postingLines.push({ accountId: advancesAccountId, debit: 0n, credit: excess, contactId: existing.contactId, jobId });
      }
      if (existing.taxAmount > 0n) {
        postingLines.push({ accountId: taxAccountId, debit: existing.taxAmount, credit: 0n, contactId: existing.contactId, jobId });
      }

      const journalEntryId = await this.ledger.postEntry(tx, {
        orgId,
        date: dateStr,
        narration: `Credit note ${number} issued`,
        sourceType: "credit_note",
        sourceId: id,
        lines: postingLines,
      });

      const [row] = await tx
        .update(creditNotes)
        .set({ status: "issued", number, date: existing.date ?? issuedAt, issuedAt, journalEntryId, creditRemainingAmount: excess, updatedAt: issuedAt })
        .where(eq(creditNotes.id, id))
        .returning();

      await tx
        .update(invoices)
        .set({ creditedAmount: invoice.creditedAmount + toAr, updatedAt: issuedAt })
        .where(eq(invoices.id, invoice.id));

      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "issued",
        entityType: "credit_note",
        entityId: id,
        contactId: existing.contactId,
        changes: [{ field: "status", from: "draft", to: "issued" }],
      });

      return row;
    });

    await queueIssuedPdf(this.queue, orgId, "credit_note", result!.id);
    return this.getOne(orgId, result!.id);
  }

  /**
   * US-PAY-16 — applies a credit note's spare credit to the same customer's
   * other invoices: posts P6 (Dr 2200 / Cr 1100), raises each invoice's
   * `creditedAmount`, and lowers `creditRemainingAmount`, all under a lock
   * on the credit note so two applications can't spend the same credit.
   */
  async applyCredit(orgId: string, actorUserId: string, id: string, input: ApplyCreditInput) {
    const total = input.allocations.reduce((sum, a) => sum + a.amount, 0n);
    await this.db.transaction(async (tx) => {
      const [note] = await tx.select().from(creditNotes).where(and(eq(creditNotes.orgId, orgId), eq(creditNotes.id, id))).for("update");
      if (!note) throw new NotFoundException("Credit note not found");
      if (note.status !== "issued") throw new BadRequestException("Only an issued credit note has credit to apply.");
      if (total > note.creditRemainingAmount) {
        const { currency, locale } = await orgMoneySettings(this.db, orgId);
        throw new BadRequestException(`This credit note has ${formatMoney(note.creditRemainingAmount, note.currency || currency, locale)} of credit to apply.`);
      }
      const rows = await tx
        .select()
        .from(invoices)
        .where(and(eq(invoices.orgId, orgId), inArray(invoices.id, input.allocations.map((a) => a.invoiceId))))
        .for("update");
      const byId = new Map(rows.map((r) => [r.id, r]));
      for (const allocation of input.allocations) {
        const invoice = byId.get(allocation.invoiceId);
        if (!invoice || invoice.contactId !== note.contactId) throw new BadRequestException("Credit can only be applied to this customer's invoices.");
        if (invoice.status !== "issued" || invoice.type === "advance") throw new BadRequestException(`Credit can't be applied to ${invoice.number ?? "this invoice"}: it isn't an issued invoice with a balance.`);
        const balance = invoice.totalAmount - invoice.retentionAmount - invoice.amountPaid - invoice.creditedAmount;
        if (allocation.amount > balance) {
          const { locale } = await orgMoneySettings(this.db, orgId);
          throw new BadRequestException(`You can apply up to ${formatMoney(balance > 0n ? balance : 0n, invoice.currency, locale)} to ${invoice.number ?? "this invoice"}.`);
        }
      }

      const [advances, ar] = [await this.ledger.resolveSystemAccount(tx, orgId, "customerAdvances"), await this.ledger.resolveSystemAccount(tx, orgId, "accountsReceivable")];
      const entryId = await this.ledger.postEntry(tx, {
        orgId,
        date: new Date(),
        narration: `Credit from credit note ${note.number} applied`,
        sourceType: "credit_note_credit_applied",
        sourceId: note.id,
        lines: input.allocations.flatMap((a) => {
          const jobId = byId.get(a.invoiceId)!.jobId;
          return [
            { accountId: advances, debit: a.amount, credit: 0n, contactId: note.contactId, jobId },
            { accountId: ar, debit: 0n, credit: a.amount, contactId: note.contactId, jobId },
          ];
        }),
      });
      for (const allocation of input.allocations) {
        const invoice = byId.get(allocation.invoiceId)!;
        await tx.insert(creditNoteAllocations).values({ orgId, creditNoteId: note.id, invoiceId: invoice.id, amount: allocation.amount, entryId, createdByUserId: actorUserId });
        await tx.update(invoices).set({ creditedAmount: invoice.creditedAmount + allocation.amount, updatedAt: new Date() }).where(eq(invoices.id, invoice.id));
      }
      await tx.update(creditNotes).set({ creditRemainingAmount: note.creditRemainingAmount - total, updatedAt: new Date() }).where(eq(creditNotes.id, note.id));
      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "credit_applied",
        entityType: "credit_note",
        entityId: note.id,
        contactId: note.contactId,
        changes: [{ field: "creditRemainingAmount", from: note.creditRemainingAmount.toString(), to: (note.creditRemainingAmount - total).toString() }],
      });
    });
    return this.getOne(orgId, id);
  }

  /** Only a draft is ever hard-deletable — an issued credit note is a permanent financial record, same posture as invoices/quotes. */
  async delete(orgId: string, id: string, actorUserId: string) {
    const [existing] = await this.db.select().from(creditNotes).where(and(eq(creditNotes.orgId, orgId), eq(creditNotes.id, id)));
    if (!existing) {
      throw new NotFoundException("Credit note not found");
    }
    await requireOwnershipCapability(this.db, { orgId, userId: actorUserId }, existing.createdByUserId, {
      own: "credit_notes.delete_own",
      others: "credit_notes.delete_others",
    });
    if (existing.status !== "draft") {
      throw new BadRequestException("Only a draft credit note can be deleted");
    }

    await this.db.transaction(async (tx) => {
      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "deleted",
        entityType: "credit_note",
        entityId: id,
        contactId: existing.contactId,
        changes: [{ field: "totalAmount", from: existing.totalAmount.toString(), to: null }],
      });
      await tx.delete(creditNotes).where(eq(creditNotes.id, id));
    });

    return { id };
  }

  /** Same reasoning as InvoicesService.resolveDefaultRevenueAccount — see that method's own doc comment. */
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
}
