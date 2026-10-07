import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { and, eq, gte, inArray, isNotNull, lte, notInArray } from "drizzle-orm";
import type { SupplyClass, SupplyType } from "@spine/shared";
import { DATABASE } from "../../../db/db.module";
import type { Database } from "../../../db/client";
import { contacts, creditNoteLines, creditNotes, invoiceLines, invoices } from "../../../db/schema";
import { AuditLogService } from "../../audit/audit-log.service";
import { RateBook } from "../line-tax-components";
import { TaxProfileService } from "../tax-profile.service";
import { buildGstr1Tables, gstr1Json, tableFigures, type Gstr1Contact, type Gstr1Input, type Gstr1Line } from "./gstr1-build";
import { parseGstr1Period, type Gstr1Period } from "./period";

export const GSTR1_NOT_SET_UP = "Set up GST first: add your GSTIN and state in Settings › GST.";
export const GSTR1_FOOTER = "Spine prepares this file; it doesn't file your return. Check it, then upload it on the GST portal.";

/** Invoices that aren't supplies in GSTR-1: deposit requests (tax is charged on the final invoice) and opening balances. */
const NOT_SUPPLIES = ["advance", "opening"] as const;

const dateText = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

/**
 * US-TAX-16 (D-148) — GSTR-1 for a month or quarter: loads the period's
 * invoices and credit notes and hands them to the mapping in
 * `gstr1-build.ts`. Credit notes count in the period they were issued
 * (as in the Tax Summary), wherever their invoice was.
 */
@Injectable()
export class Gstr1Service {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly taxProfile: TaxProfileService,
    private readonly audit: AuditLogService,
  ) {}

  async input(orgId: string, period: Gstr1Period): Promise<Gstr1Input> {
    const profile = await this.taxProfile.get(orgId);
    if (profile.country !== "IN" || !profile.registrationNumber || !profile.stateCode) throw new BadRequestException(GSTR1_NOT_SET_UP);
    const stateCode = profile.stateCode;
    const start = new Date(period.from);
    const end = new Date(period.to);
    const endOfDay = new Date(`${period.to}T23:59:59.999Z`);

    const invoiceRows = await this.db
      .select()
      .from(invoices)
      .where(and(eq(invoices.orgId, orgId), inArray(invoices.status, ["issued", "void"]), isNotNull(invoices.number), notInArray(invoices.type, [...NOT_SUPPLIES]), gte(invoices.issueDate, start), lte(invoices.issueDate, end)));
    const noteRows = await this.db
      .select()
      .from(creditNotes)
      .where(and(eq(creditNotes.orgId, orgId), eq(creditNotes.status, "issued"), gte(creditNotes.issuedAt, start), lte(creditNotes.issuedAt, endOfDay)));
    const originalIds = [...new Set(noteRows.map((n) => n.invoiceId))].filter((id) => !invoiceRows.some((i) => i.id === id));
    const originals = originalIds.length ? await this.db.select().from(invoices).where(and(eq(invoices.orgId, orgId), inArray(invoices.id, originalIds))) : [];
    const allInvoices = [...invoiceRows, ...originals];

    const invoiceLineRows = allInvoices.length
      ? await this.db
          .select()
          .from(invoiceLines)
          .where(and(inArray(invoiceLines.invoiceId, allInvoices.map((i) => i.id)), eq(invoiceLines.type, "item")))
          .orderBy(invoiceLines.sortOrder)
      : [];
    const noteLineRows = noteRows.length
      ? await this.db
          .select()
          .from(creditNoteLines)
          .where(and(inArray(creditNoteLines.creditNoteId, noteRows.map((n) => n.id)), eq(creditNoteLines.type, "item")))
          .orderBy(creditNoteLines.sortOrder)
      : [];
    const contactIds = [...new Set([...allInvoices.map((i) => i.contactId), ...noteRows.map((n) => n.contactId)])];
    const contactRows = contactIds.length ? await this.db.select().from(contacts).where(and(eq(contacts.orgId, orgId), inArray(contacts.id, contactIds))) : [];
    const contactOf = (id: string): Gstr1Contact => {
      const c = contactRows.find((r) => r.id === id);
      return { id, name: c?.name ?? "Deleted contact", gstTreatment: c?.gstTreatment ?? null, gstin: c?.taxId?.trim() || null };
    };

    const book = await RateBook.load(this.db, orgId, invoiceLineRows);
    // A document from before GST was set up has no supply type: within the business's state it's intra-state.
    const supplyTypeOf = (doc: { supplyType: SupplyType | null; placeOfSupply: string | null }): SupplyType =>
      doc.supplyType ?? (doc.placeOfSupply && doc.placeOfSupply !== stateCode ? (doc.placeOfSupply === "96" ? "export" : "inter") : "intra");
    const lineOf = (
      line: { name: string; hsnSac: string | null; quantity: number | string; lineSubtotalAmount: bigint; lineTaxAmount: bigint; supplyClass: string | null; taxRatePercentage: number; taxRateId?: string | null; taxGroupId?: string | null },
      supplyType: SupplyType,
    ): Gstr1Line => ({
      name: line.name,
      hsnSac: line.hsnSac,
      quantity: Number(line.quantity),
      taxable: line.lineSubtotalAmount,
      tax: line.lineTaxAmount,
      supplyClass: (line.supplyClass as SupplyClass | null) ?? null,
      components: book.components(line, supplyType),
    });
    const invoiceOf = (row: typeof invoices.$inferSelect) => {
      const supplyType = supplyTypeOf(row);
      return {
        id: row.id,
        number: row.number ?? "",
        date: dateText(row.issueDate),
        value: row.totalAmount,
        contact: contactOf(row.contactId),
        placeOfSupply: row.placeOfSupply,
        supplyType,
        lines: invoiceLineRows.filter((l) => l.invoiceId === row.id).map((l) => lineOf(l, supplyType)),
      };
    };

    return {
      gstin: profile.registrationNumber,
      stateCode,
      fp: period.fp,
      exportUnderLut: profile.exportUnderLut === true,
      invoices: invoiceRows.filter((i) => i.status === "issued").map(invoiceOf),
      creditNotes: noteRows.map((note) => {
        const original = allInvoices.find((i) => i.id === note.invoiceId);
        const supplyType = supplyTypeOf(note);
        return {
          id: note.id,
          number: note.number ?? "",
          date: dateText(note.date ?? note.issuedAt),
          value: note.totalAmount,
          contact: contactOf(note.contactId),
          placeOfSupply: note.placeOfSupply,
          supplyType,
          lines: noteLineRows.filter((l) => l.creditNoteId === note.id).map((l) => lineOf(l, supplyType)),
          original: original ? invoiceOf(original) : { number: "", date: "", value: 0n, contact: contactOf(note.contactId), placeOfSupply: null, supplyType, lines: [] },
        };
      }),
      issued: [
        ...invoiceRows.map((i) => ({ kind: "invoice" as const, number: i.number!, voided: i.status === "void" })),
        ...noteRows.filter((n) => n.number).map((n) => ({ kind: "credit_note" as const, number: n.number!, voided: false })),
      ],
    };
  }

  /** What the page shows: counts and values per table, and the documents issued. */
  async summary(orgId: string, periodParam: unknown) {
    const period = parseGstr1Period(periodParam);
    const input = await this.input(orgId, period);
    const tables = buildGstr1Tables(input);
    const figures = tableFigures(tables);
    const asText = (f: { count: number; taxableValue: bigint; tax: bigint }) => ({ count: f.count, taxableValue: f.taxableValue.toString(), tax: f.tax.toString() });
    return {
      period,
      gstin: input.gstin,
      schemaVersion: gstr1Json(input, tables).version,
      tables: {
        b2b: asText(figures.b2b),
        b2cl: asText(figures.b2cl),
        b2cs: asText(figures.b2cs),
        cdnr: asText(figures.cdnr),
        cdnur: asText(figures.cdnur),
        exp: asText(figures.exp),
        nil: asText(figures.nil),
        hsn: asText(figures.hsn),
        docs: tables.docs,
      },
      totals: { documents: input.issued.length, taxableValue: figures.totalTaxable.toString(), tax: figures.totalTax.toString() },
      footer: GSTR1_FOOTER,
    };
  }

  /** The JSON file, named for the GSTIN and period; downloading it is audited. */
  async json(orgId: string, actorUserId: string, periodParam: unknown): Promise<{ filename: string; body: string }> {
    const period = parseGstr1Period(periodParam);
    const input = await this.input(orgId, period);
    const json = gstr1Json(input, buildGstr1Tables(input));
    await this.audit.record(this.db, { orgId, actorUserId, action: "downloaded", entityType: "gstr1_export", entityId: orgId, contactId: null, changes: { period: period.label, format: "JSON" } });
    return { filename: `GSTR1_${input.gstin}_${period.fp}.json`, body: JSON.stringify(json, null, 2) };
  }
}
