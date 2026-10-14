import { QueueService } from "../queue/queue.service";
import { queueIssuedPdf } from "../pdf/issued-pdf.service";
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { applyPaymentCreditSchema, createCreditNoteSchema, updateCreditNoteSchema } from "@spine/shared";
import { computeDocumentLine, formatMoney, lineSupplyClass, supplyClassTaxError, type CreditNoteActivityEntry, type SupplyClass } from "@spine/shared";
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import type { z } from "zod";
import { DATABASE } from "../../db/db.module";
import type { Database, Transaction } from "../../db/client";
import { creditNotes, creditNoteAllocations, creditNoteLines, invoices, invoiceLines, contacts, accounts, auditLog, customerRefunds, user } from "../../db/schema";
import { RateBook } from "../tax/line-tax-components";
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
  hsnSac: string | null;
  /** US-INV-36 — the invoice line it credits, and that line's rate or group. */
  invoiceLineId: string | null;
  taxRateId: string | null;
  taxGroupId: string | null;
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
        hsnSac: null,
        invoiceLineId: null,
        taxRateId: null,
        taxGroupId: null,
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
      hsnSac: line.hsnSac ?? null,
      invoiceLineId: null,
      taxRateId: null,
      taxGroupId: null,
      lineSubtotalAmount: netAmount,
      lineTaxAmount: taxResult.taxAmount.amount,
      lineTotalAmount: taxResult.total.amount,
    };
  });

  return { lines: computed, subtotalAmount, taxAmount, totalAmount };
}


/** a × b ÷ c, rounded half up (all positive). */
function mulDivHalfUp(a: bigint, b: bigint, c: bigint): bigint {
  if (c === 0n) return 0n;
  return (a * b * 2n + c) / (2n * c);
}
/** A numeric(18,4) quantity as an integer number of ten-thousandths, so ratios stay exact. */
const scaled = (quantity: number) => BigInt(Math.round(quantity * 10_000));

/** US-INV-36 — an invoice item line, with what issued credit notes have already taken off it. */
export interface CreditableLine {
  invoiceLineId: string;
  position: number;
  name: string;
  description: string | null;
  catalogItemId: string | null;
  quantity: number;
  creditedQuantity: number;
  leftQuantity: number;
  /** The line's net price per unit (after any discount, before tax). */
  unitPriceAmount: bigint;
  taxRatePercentage: number;
  taxRateId: string | null;
  taxGroupId: string | null;
  supplyClass: SupplyClass | null;
  hsnSac: string | null;
  lineSubtotalAmount: bigint;
  lineTaxAmount: bigint;
  lineTotalAmount: bigint;
  leftSubtotalAmount: bigint;
  leftAmount: bigint;
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

    const extras = await this.extras(orgId, rows.map((r) => r.creditNote));
    return rows.map((r) => ({ ...r.creditNote, contactName: r.contactName, invoiceNumber: r.invoiceNumber, ...extras.get(r.creditNote.id)! }));
  }

  /**
   * US-INV-38, US-INV-40 (D-219) — where each credit note's money went:
   * off its invoice (what was still owed when it was issued), applied to
   * other invoices, refunded (refunds not deleted), and what's left; when
   * it was last emailed, and its item lines' names for search.
   */
  private async extras(orgId: string, notes: (typeof creditNotes.$inferSelect)[]) {
    const ids = notes.map((n) => n.id);
    const out = new Map<string, { offInvoiceAmount: bigint; appliedAmount: bigint; refundedAmount: bigint; lastEmailedAt: Date | null; lineNames: string[] }>();
    if (ids.length === 0) return out;
    const [applied, refunded, emailed, names] = await Promise.all([
      this.db
        .select({ id: creditNoteAllocations.creditNoteId, total: sql<string>`sum(${creditNoteAllocations.amount})::text` })
        .from(creditNoteAllocations)
        .where(inArray(creditNoteAllocations.creditNoteId, ids))
        .groupBy(creditNoteAllocations.creditNoteId),
      this.db
        .select({ id: customerRefunds.sourceCreditNoteId, total: sql<string>`sum(${customerRefunds.amount})::text` })
        .from(customerRefunds)
        .where(and(inArray(customerRefunds.sourceCreditNoteId, ids), sql`${customerRefunds.deletedAt} is null`))
        .groupBy(customerRefunds.sourceCreditNoteId),
      this.db
        .select({ id: auditLog.entityId, last: sql<Date>`max(${auditLog.createdAt})` })
        .from(auditLog)
        .where(and(eq(auditLog.orgId, orgId), eq(auditLog.entityType, "credit_note"), eq(auditLog.action, "emailed"), inArray(auditLog.entityId, ids)))
        .groupBy(auditLog.entityId),
      this.db
        .select({ id: creditNoteLines.creditNoteId, name: creditNoteLines.name })
        .from(creditNoteLines)
        .where(and(inArray(creditNoteLines.creditNoteId, ids), eq(creditNoteLines.type, "item"))),
    ]);
    const sumOf = (rows: { id: string | null; total: string }[]) => new Map(rows.map((r) => [r.id, BigInt(r.total ?? "0")]));
    const appliedBy = sumOf(applied);
    const refundedBy = sumOf(refunded);
    const emailedBy = new Map(emailed.map((r) => [r.id, r.last ? new Date(r.last) : null]));
    for (const note of notes) {
      const appliedAmount = appliedBy.get(note.id) ?? 0n;
      const refundedAmount = refundedBy.get(note.id) ?? 0n;
      const offInvoiceAmount = note.status === "issued" ? note.totalAmount - note.creditRemainingAmount - appliedAmount - refundedAmount : 0n;
      out.set(note.id, {
        offInvoiceAmount: offInvoiceAmount > 0n ? offInvoiceAmount : 0n,
        appliedAmount,
        refundedAmount,
        lastEmailedAt: emailedBy.get(note.id) ?? null,
        lineNames: names.filter((n) => n.id === note.id).map((n) => n.name),
      });
    }
    return out;
  }

  /**
   * US-INV-36 (D-219) — an invoice's item lines and what's left to credit
   * on each: its total less what issued credit notes have taken off it
   * (`exceptNoteId` leaves one out, for the check at issue). Quantities
   * left follow the amount left, so a part credited by amount counts too.
   */
  async creditableLines(db: Database | Transaction, invoiceId: string, exceptNoteId?: string): Promise<CreditableLine[]> {
    const lines = await db.select().from(invoiceLines).where(eq(invoiceLines.invoiceId, invoiceId)).orderBy(invoiceLines.sortOrder);
    const credited = await db
      .select({
        invoiceLineId: creditNoteLines.invoiceLineId,
        subtotal: sql<string>`sum(${creditNoteLines.lineSubtotalAmount})::text`,
        total: sql<string>`sum(${creditNoteLines.lineTotalAmount})::text`,
      })
      .from(creditNoteLines)
      .innerJoin(creditNotes, eq(creditNoteLines.creditNoteId, creditNotes.id))
      .where(and(eq(creditNotes.invoiceId, invoiceId), eq(creditNotes.status, "issued"), ...(exceptNoteId ? [ne(creditNotes.id, exceptNoteId)] : [])))
      .groupBy(creditNoteLines.invoiceLineId);
    const by = new Map(credited.map((c) => [c.invoiceLineId, { subtotal: BigInt(c.subtotal ?? "0"), total: BigInt(c.total ?? "0") }]));
    return lines
      .filter((l) => l.type === "item")
      .map((l, i) => {
        const done = by.get(l.id) ?? { subtotal: 0n, total: 0n };
        const leftAmount = l.lineTotalAmount - done.total > 0n ? l.lineTotalAmount - done.total : 0n;
        const leftSubtotalAmount = l.lineSubtotalAmount - done.subtotal > 0n ? l.lineSubtotalAmount - done.subtotal : 0n;
        const quantity = Number(l.quantity);
        const leftQuantity = l.lineTotalAmount > 0n ? Number(mulDivHalfUp(scaled(quantity), leftAmount, l.lineTotalAmount)) / 10_000 : 0;
        return {
          invoiceLineId: l.id,
          position: i + 1,
          name: l.name,
          description: l.description,
          catalogItemId: l.catalogItemId,
          quantity,
          creditedQuantity: Math.round((quantity - leftQuantity) * 10_000) / 10_000,
          leftQuantity,
          unitPriceAmount: quantity > 0 ? mulDivHalfUp(l.lineSubtotalAmount, 10_000n, scaled(quantity)) : 0n,
          taxRatePercentage: Number(l.taxRatePercentage),
          taxRateId: l.taxRateId,
          taxGroupId: l.taxGroupId,
          supplyClass: l.supplyClass,
          hsnSac: l.hsnSac,
          lineSubtotalAmount: l.lineSubtotalAmount,
          lineTaxAmount: l.lineTaxAmount,
          lineTotalAmount: l.lineTotalAmount,
          leftSubtotalAmount,
          leftAmount,
        };
      });
  }

  /** `GET /credit-notes/creditable?invoiceId=` (US-INV-36) — for the issue dialog. */
  async creditable(orgId: string, invoiceId: string) {
    const invoice = await this.creditableInvoice(orgId, invoiceId);
    const lines = await this.creditableLines(this.db, invoiceId);
    const already = await this.creditedOn(this.db, invoiceId);
    const leftToCredit = invoice.totalAmount - already;
    return {
      invoiceId,
      invoiceNumber: invoice.number,
      currency: invoice.currency,
      balanceDue: invoice.totalAmount - invoice.retentionAmount - invoice.amountPaid - invoice.creditedAmount,
      leftToCredit: leftToCredit > 0n ? leftToCredit : 0n,
      lines,
    };
  }

  /** What issued credit notes add up to on an invoice. */
  private async creditedOn(db: Database | Transaction, invoiceId: string, exceptNoteId?: string): Promise<bigint> {
    const [row] = await db
      .select({ total: sql<string>`coalesce(sum(${creditNotes.totalAmount}), 0)::text` })
      .from(creditNotes)
      .where(and(eq(creditNotes.invoiceId, invoiceId), eq(creditNotes.status, "issued"), ...(exceptNoteId ? [ne(creditNotes.id, exceptNoteId)] : [])));
    return BigInt(row?.total ?? "0");
  }

  /** The invoice a credit note may correct: issued, not a deposit. */
  private async creditableInvoice(orgId: string, invoiceId: string) {
    const [invoice] = await this.db.select().from(invoices).where(and(eq(invoices.orgId, orgId), eq(invoices.id, invoiceId)));
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
    return invoice;
  }

  /**
   * US-INV-36 (D-219) — the credit note's lines and totals. A line with
   * `invoiceLineId` is worked out from that invoice line's own figures —
   * `quantity` of it, or `creditAmount` (tax included) — so a discount, a
   * tax-inclusive price or a compound group credits exactly as it was
   * invoiced, rounding half up once per line; crediting all that's left
   * takes exactly what's left. Other lines are computed as before. Refuses
   * more than a line, or the invoice, has left to credit.
   */
  private async buildLines(orgId: string, invoice: typeof invoices.$inferSelect, input: CreateCreditNoteInput["lines"], exceptNoteId?: string): Promise<ComputedTotals> {
    const linked = input.some((l) => l.invoiceLineId);
    const creditable = linked ? await this.creditableLines(this.db, invoice.id, exceptNoteId) : [];
    const byId = new Map(creditable.map((l) => [l.invoiceLineId, l]));
    const { locale } = await orgMoneySettings(this.db, orgId);
    const money = (v: bigint) => formatMoney(v, invoice.currency, locale);
    const free = computeCreditNoteTotals(invoice.currency, input.map((l) => (l.invoiceLineId ? { ...l, type: "text" as const } : l)));
    let subtotalAmount = 0n;
    let taxAmount = 0n;
    let totalAmount = 0n;
    const lines: ComputedLine[] = input.map((line, index) => {
      if (!line.invoiceLineId) {
        const computed = free.lines[index]!;
        subtotalAmount += computed.lineSubtotalAmount;
        taxAmount += computed.lineTaxAmount;
        totalAmount += computed.lineTotalAmount;
        return computed;
      }
      const source = byId.get(line.invoiceLineId);
      if (!source) throw new BadRequestException("Credit lines must come from this invoice's item lines.");
      let quantity: number;
      let sub: bigint;
      let tax: bigint;
      let unitPriceAmount: bigint;
      if (line.creditAmount) {
        const part = line.creditAmount;
        if (part > source.leftAmount) throw new BadRequestException(`Line ${source.position} has ${money(source.leftAmount)} left to credit.`);
        sub = part === source.leftAmount ? source.leftSubtotalAmount : mulDivHalfUp(part, source.lineSubtotalAmount, source.lineTotalAmount);
        tax = part - sub;
        quantity = 1;
        unitPriceAmount = sub;
      } else {
        quantity = line.quantity;
        if (!(quantity > 0)) throw new BadRequestException(`Choose how many of line ${source.position} to credit.`);
        const q = scaled(quantity);
        const left = scaled(source.leftQuantity);
        if (q > left) throw new BadRequestException(`Line ${source.position} has ${source.leftQuantity} left to credit.`);
        const all = scaled(source.quantity);
        if (q === left) {
          sub = source.leftSubtotalAmount;
          tax = source.leftAmount - source.leftSubtotalAmount;
        } else {
          sub = mulDivHalfUp(source.lineSubtotalAmount, q, all);
          tax = mulDivHalfUp(source.lineTaxAmount, q, all);
        }
        unitPriceAmount = source.unitPriceAmount;
      }
      subtotalAmount += sub;
      taxAmount += tax;
      totalAmount += sub + tax;
      return {
        sortOrder: index,
        type: "item",
        catalogItemId: source.catalogItemId,
        name: source.name,
        description: line.creditAmount ? null : source.description,
        quantity,
        unitPriceAmount,
        unitPriceCurrency: invoice.currency,
        taxRatePercentage: source.taxRatePercentage,
        supplyClass: source.supplyClass,
        hsnSac: source.hsnSac,
        invoiceLineId: source.invoiceLineId,
        taxRateId: source.taxRateId,
        taxGroupId: source.taxGroupId,
        lineSubtotalAmount: sub,
        lineTaxAmount: tax,
        lineTotalAmount: sub + tax,
      };
    });
    const already = await this.creditedOn(this.db, invoice.id, exceptNoteId);
    const left = invoice.totalAmount - already;
    if (totalAmount > left) throw new BadRequestException(`You can credit up to ${money(left > 0n ? left : 0n)} on this invoice.`);
    return { lines, subtotalAmount, taxAmount, totalAmount };
  }

  /**
   * `POST /credit-notes/preview` (US-INV-36) — the totals, the tax by name
   * and how much would come off the invoice versus become customer credit,
   * for the body of `POST /credit-notes`. Writes nothing.
   */
  async preview(orgId: string, input: CreateCreditNoteInput) {
    const invoice = await this.creditableInvoice(orgId, input.invoiceId);
    const totals = await this.buildLines(orgId, invoice, input.lines);
    const book = await RateBook.load(this.db, orgId, totals.lines);
    const balance = invoice.totalAmount - invoice.retentionAmount - invoice.amountPaid - invoice.creditedAmount;
    const owedPart = totals.totalAmount < balance ? totals.totalAmount : balance > 0n ? balance : 0n;
    return {
      subtotalAmount: totals.subtotalAmount,
      taxAmount: totals.taxAmount,
      totalAmount: totals.totalAmount,
      taxLines: book.taxLines(totals.lines.filter((l) => l.type === "item"), invoice.supplyType),
      owedPart,
      creditPart: totals.totalAmount - owedPart,
      lines: totals.lines.map((l) => ({ invoiceLineId: l.invoiceLineId, lineSubtotalAmount: l.lineSubtotalAmount, lineTaxAmount: l.lineTaxAmount, lineTotalAmount: l.lineTotalAmount })),
    };
  }

  /**
   * `GET /credit-notes/:id/activity` (US-INV-39) — the credit note's story,
   * newest first: issued (what came off the invoice and what became
   * credit), emailed, credit applied to invoices, refunds and refunds
   * deleted, with who.
   */
  async activity(orgId: string, id: string): Promise<CreditNoteActivityEntry[]> {
    const note = await this.getOne(orgId, id);
    const iso = (d: Date | string) => new Date(d).toISOString();
    const entries: CreditNoteActivityEntry[] = [];
    const audit = await this.db
      .select({ action: auditLog.action, changes: auditLog.changes, at: auditLog.createdAt, actorName: user.name })
      .from(auditLog)
      .leftJoin(user, eq(auditLog.actorUserId, user.id))
      .where(and(eq(auditLog.orgId, orgId), eq(auditLog.entityType, "credit_note"), eq(auditLog.entityId, id), inArray(auditLog.action, ["issued", "emailed"])));
    const excess = note.totalAmount - note.offInvoiceAmount;
    for (const row of audit) {
      if (row.action === "issued") {
        entries.push({ at: iso(row.at), type: "issued", actorName: row.actorName ?? null, detail: note.invoiceNumber, linkId: note.invoiceId, amount: note.offInvoiceAmount.toString(), creditPart: excess > 0n ? excess.toString() : null });
      } else {
        const to = (row.changes as { to?: string } | null)?.to ?? null;
        entries.push({ at: iso(row.at), type: "emailed", actorName: row.actorName ?? null, detail: to });
      }
    }
    const applied = await this.db
      .select({ invoiceId: creditNoteAllocations.invoiceId, number: invoices.number, amount: creditNoteAllocations.amount, at: creditNoteAllocations.createdAt, actorName: user.name })
      .from(creditNoteAllocations)
      .innerJoin(invoices, eq(creditNoteAllocations.invoiceId, invoices.id))
      .leftJoin(user, eq(creditNoteAllocations.createdByUserId, user.id))
      .where(eq(creditNoteAllocations.creditNoteId, id));
    for (const a of applied) entries.push({ at: iso(a.at), type: "applied", actorName: a.actorName ?? null, detail: a.number, linkId: a.invoiceId, amount: a.amount.toString() });
    const refunds = await this.db
      .select({ id: customerRefunds.id, amount: customerRefunds.amount, method: customerRefunds.method, at: customerRefunds.createdAt, deletedAt: customerRefunds.deletedAt, actorName: user.name })
      .from(customerRefunds)
      .leftJoin(user, eq(customerRefunds.createdByUserId, user.id))
      .where(eq(customerRefunds.sourceCreditNoteId, id));
    for (const r of refunds) {
      entries.push({ at: iso(r.at), type: "refunded", actorName: r.actorName ?? null, detail: r.method, linkId: r.id, amount: r.amount.toString() });
      if (r.deletedAt) entries.push({ at: iso(r.deletedAt), type: "refund_deleted", actorName: null, detail: r.method, linkId: r.id, amount: r.amount.toString() });
    }
    return entries.sort((a, b) => b.at.localeCompare(a.at));
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

    // US-INV-38: the tax by name, where the money went, and what was applied where.
    const [extras, book, allocations] = await Promise.all([
      this.extras(orgId, [row.creditNote]),
      RateBook.load(this.db, orgId, lines),
      this.db
        .select({ invoiceId: creditNoteAllocations.invoiceId, invoiceNumber: invoices.number, amount: creditNoteAllocations.amount, at: creditNoteAllocations.createdAt })
        .from(creditNoteAllocations)
        .innerJoin(invoices, eq(creditNoteAllocations.invoiceId, invoices.id))
        .where(eq(creditNoteAllocations.creditNoteId, id))
        .orderBy(creditNoteAllocations.createdAt),
    ]);
    return {
      ...row.creditNote,
      contactName: row.contactName,
      invoiceNumber: row.invoiceNumber,
      ...extras.get(id)!,
      taxLines: book.taxLines(
        lines.filter((l) => l.type === "item").map((l) => ({ ...l, taxRatePercentage: Number(l.taxRatePercentage) })),
        row.creditNote.supplyType,
      ),
      allocations,
      lines,
    };
  }

  /** `GET /credit-notes/:id/history` — same pattern as InvoicesService.getHistory. */
  async getHistory(orgId: string, id: string) {
    await this.getOne(orgId, id);
    return this.auditLog.listForEntity(orgId, "credit_note", id);
  }

  /** Creates a new draft, always unnumbered — see credit-notes.ts's schema comment. The target invoice must be `issued` — a credit note against a draft or void invoice makes no sense (nothing has posted to AR yet, or the posting was already reversed). */
  async create(orgId: string, actorUserId: string, input: CreateCreditNoteInput, isDemo = false) {
    const invoice = await this.creditableInvoice(orgId, input.invoiceId);

    // US-TAX-13: a credit note corrects its invoice, so it has the invoice's place of supply.
    if (input.placeOfSupply && input.placeOfSupply !== invoice.placeOfSupply) {
      throw new BadRequestException("A credit note has its invoice's place of supply. Change the invoice instead.");
    }
    const totals = await this.buildLines(orgId, invoice, input.lines);

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

    let totals: ComputedTotals | null = null;
    if (input.lines !== undefined) {
      const [invoice] = await this.db.select().from(invoices).where(eq(invoices.id, existing.invoiceId));
      totals = await this.buildLines(orgId, invoice!, input.lines, id);
    }

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
  async issue(orgId: string, id: string, actorUserId: string, revenueAccountId?: string, on?: Date) {
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
      // US-INV-36: no invoice line credited beyond what it was invoiced (another credit note may have been issued since this one was drafted).
      const noteLines = await tx.select().from(creditNoteLines).where(eq(creditNoteLines.creditNoteId, id));
      if (noteLines.some((l) => l.invoiceLineId)) {
        const left = new Map((await this.creditableLines(tx, invoice.id, id)).map((l) => [l.invoiceLineId, l]));
        for (const l of noteLines) {
          const source = l.invoiceLineId ? left.get(l.invoiceLineId) : undefined;
          if (source && l.lineTotalAmount > source.leftAmount) {
            const { locale } = await orgMoneySettings(this.db, orgId);
            throw new BadRequestException(`Line ${source.position} has ${formatMoney(source.leftAmount, invoice.currency, locale)} left to credit.`);
          }
        }
      }
      if (existing.totalAmount > creditable) {
        const { currency, locale } = await orgMoneySettings(this.db, orgId);
        throw new BadRequestException(`You can credit up to ${formatMoney(creditable > 0n ? creditable : 0n, invoice.currency || currency, locale)} on this invoice.`);
      }
      // D-142: AR takes what's still owed; the rest is the customer's credit.
      const balance = invoice.totalAmount - invoice.retentionAmount - invoice.amountPaid - invoice.creditedAmount;
      const toAr = existing.totalAmount < balance ? existing.totalAmount : balance > 0n ? balance : 0n;
      const excess = existing.totalAmount - toAr;

      const number = await this.numbering.allocateNumber(tx, orgId, "credit_note", { demo: existing.isDemo });
      // `on` is for the demo seeder only (US-ONB-29): the document and its posting share that day, as when it was issued then.
      const issuedAt = on ?? new Date();
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
  async applyCredit(orgId: string, actorUserId: string, id: string, input: ApplyCreditInput, on?: Date) {
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
        date: on ?? new Date(),
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
        await tx.insert(creditNoteAllocations).values({ orgId, creditNoteId: note.id, invoiceId: invoice.id, amount: allocation.amount, entryId, createdByUserId: actorUserId, ...(on ? { createdAt: on } : {}) });
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
