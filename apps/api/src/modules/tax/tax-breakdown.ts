import { and, eq, gt, gte, inArray, isNull, lte, ne } from "drizzle-orm";
import type { SupplyClass, SupplyType, TaxComponent } from "@spine/shared";
import type { Database } from "../../db/client";
import { bankTransactions, creditNoteLines, creditNotes, expenses, invoiceLines, invoices, vendorBillLines, vendorBills, vendorCreditLines, vendorCredits } from "../../db/schema";
import { RateBook, type TaxedLine } from "./line-tax-components";

export type TaxSide = "sales" | "purchases";
export type TaxSource = "invoice" | "credit_note" | "vendor_bill" | "vendor_credit" | "expense" | "bank_transaction";

/** One taxed line from a document in the range, signed: credit notes and vendor credits are negative. */
export interface TaxBreakdownLine {
  side: TaxSide;
  source: TaxSource;
  rate: { key: string; name: string; percentage: number };
  /** Net of tax. */
  taxable: bigint;
  tax: bigint;
  /** Null on expenses and money out, which don't carry one. */
  supplyClass: SupplyClass | null;
  components: TaxComponent[];
}

interface Raw extends TaxedLine {
  side: TaxSide;
  source: TaxSource;
  sign: 1n | -1n;
  taxable: bigint;
  supplyClass: string | null;
  supplyType: SupplyType | null;
}

/**
 * US-RPT-37 (D-147) — every taxed line of the documents dated in the range,
 * both sides: invoices issued and credit notes (sales); bills recorded,
 * vendor credits, approved expenses and money out (purchases). Each
 * document's current state is read — a voided one drops out, and the
 * ledger's reversal shows as an adjustment where the totals are compared.
 */
export async function loadTaxBreakdown(db: Database, orgId: string, from: string, to: string): Promise<TaxBreakdownLine[]> {
  const start = new Date(from);
  const end = new Date(to);
  const endOfDay = new Date(`${to}T23:59:59.999Z`);
  const raw: Raw[] = [];

  const invoiceRows = await db
    .select({ line: invoiceLines, supplyType: invoices.supplyType })
    .from(invoiceLines)
    .innerJoin(invoices, eq(invoiceLines.invoiceId, invoices.id))
    // D-276: a retention release isn't a sale of its own; its retention was taxed on the progress invoices.
    .where(and(eq(invoices.orgId, orgId), eq(invoices.status, "issued"), ne(invoices.type, "retention_release"), eq(invoiceLines.type, "item"), gte(invoices.issueDate, start), lte(invoices.issueDate, end)));
  for (const { line, supplyType } of invoiceRows) raw.push({ ...line, side: "sales", source: "invoice", sign: 1n, taxable: line.lineSubtotalAmount, supplyType });

  const creditRows = await db
    .select({ line: creditNoteLines, supplyType: creditNotes.supplyType })
    .from(creditNoteLines)
    .innerJoin(creditNotes, eq(creditNoteLines.creditNoteId, creditNotes.id))
    .where(and(eq(creditNotes.orgId, orgId), eq(creditNotes.status, "issued"), eq(creditNoteLines.type, "item"), gte(creditNotes.issuedAt, start), lte(creditNotes.issuedAt, endOfDay)));
  for (const { line, supplyType } of creditRows) raw.push({ ...line, side: "sales", source: "credit_note", sign: -1n, taxable: line.lineSubtotalAmount, supplyType });

  const billRows = await db
    .select({ line: vendorBillLines, supplyType: vendorBills.supplyType })
    .from(vendorBillLines)
    .innerJoin(vendorBills, eq(vendorBillLines.billId, vendorBills.id))
    .where(and(eq(vendorBills.orgId, orgId), eq(vendorBills.status, "recorded"), eq(vendorBillLines.type, "item"), gte(vendorBills.date, start), lte(vendorBills.date, end)));
  for (const { line, supplyType } of billRows) raw.push({ ...line, side: "purchases", source: "vendor_bill", sign: 1n, taxable: line.lineSubtotalAmount, supplyType });

  const vendorCreditRows = await db
    .select({ line: vendorCreditLines, supplyType: vendorCredits.supplyType })
    .from(vendorCreditLines)
    .innerJoin(vendorCredits, eq(vendorCreditLines.vendorCreditId, vendorCredits.id))
    .where(
      and(
        eq(vendorCredits.orgId, orgId),
        inArray(vendorCredits.status, ["open", "used"]),
        eq(vendorCreditLines.type, "item"),
        gte(vendorCredits.date, start),
        lte(vendorCredits.date, end),
      ),
    );
  for (const { line, supplyType } of vendorCreditRows) raw.push({ ...line, side: "purchases", source: "vendor_credit", sign: -1n, taxable: line.lineSubtotalAmount, supplyType });

  const expenseRows = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.orgId, orgId), eq(expenses.status, "approved"), gt(expenses.taxAmount, 0n), gte(expenses.date, start), lte(expenses.date, end)));
  for (const e of expenseRows) {
    raw.push({ taxRateId: e.taxRateId, taxGroupId: null, taxRatePercentage: 0, lineTaxAmount: e.taxAmount, side: "purchases", source: "expense", sign: 1n, taxable: e.amount - e.taxAmount, supplyClass: null, supplyType: null });
  }

  const moneyOut = await db
    .select()
    .from(bankTransactions)
    .where(
      and(
        eq(bankTransactions.orgId, orgId),
        eq(bankTransactions.direction, "out"),
        isNull(bankTransactions.deletedAt),
        gt(bankTransactions.taxAmount, 0n),
        gte(bankTransactions.date, from),
        lte(bankTransactions.date, to),
      ),
    );
  for (const t of moneyOut) {
    raw.push({ taxRateId: t.taxRateId, taxGroupId: t.taxGroupId, taxRatePercentage: 0, lineTaxAmount: t.taxAmount, side: "purchases", source: "bank_transaction", sign: 1n, taxable: t.amount - t.taxAmount, supplyClass: null, supplyType: null });
  }

  const book = await RateBook.load(db, orgId, raw);
  return raw.map((r) => {
    const label = book.label(r);
    return {
      side: r.side,
      source: r.source,
      rate: { ...label, percentage: r.taxRatePercentage || book.ratesFor(r, r.supplyType).reduce((sum, x) => sum + x.rate, 0) },
      taxable: r.taxable * r.sign,
      tax: r.lineTaxAmount * r.sign,
      supplyClass: (r.supplyClass as SupplyClass | null) ?? null,
      components: book.components(r, r.supplyType).map((c) => ({ ...c, amount: c.amount * r.sign })),
    };
  });
}
