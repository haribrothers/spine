import type { Gstr1CreditNote, Gstr1Input, Gstr1Invoice } from "./gstr1-build";

export type Gstr1ProblemKind = "missing_gstin" | "missing_hsn" | "missing_place_of_supply" | "totals_mismatch";

/** Something the portal would reject or that doesn't add up, with where to fix it. */
export interface Gstr1Problem {
  kind: Gstr1ProblemKind;
  /** The contact, invoice or credit note to fix; null for the totals. A credit note's link opens its invoice, where it's shown. */
  recordId: string | null;
  label: string;
  href: string;
  /** The link's text: "Open contact", "Open invoice"… */
  action: string;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * US-TAX-17 — what to fix before uploading: registered customers with no
 * GSTIN, lines with no HSN/SAC, documents with no place of supply, and tax
 * in the file that doesn't equal the Tax Summary's tax collected.
 */
export function gstr1Problems(
  input: Pick<Gstr1Input, "invoices" | "creditNotes">,
  totals: { fileTax: bigint; taxSummaryTax: bigint; from: string; to: string },
  money: (paise: bigint) => string,
): Gstr1Problem[] {
  const problems: Gstr1Problem[] = [];
  // A credit note is opened from its invoice.
  const documents: { doc: Gstr1Invoice; invoiceId: string }[] = [
    ...input.invoices.map((doc) => ({ doc, invoiceId: doc.id })),
    ...input.creditNotes.map((doc: Gstr1CreditNote) => ({ doc, invoiceId: doc.original.id })),
  ];

  const missingGstin = new Map<string, string>();
  for (const { doc } of documents) {
    if ((doc.contact.gstTreatment === "registered" || doc.contact.gstTreatment === "sez") && !doc.contact.gstin) missingGstin.set(doc.contact.id, doc.contact.name);
  }
  for (const [id, name] of missingGstin) {
    problems.push({ kind: "missing_gstin", recordId: id, label: `Registered customer with no GSTIN — ${name}`, href: `/contacts/${id}`, action: "Open contact" });
  }

  const link = (invoiceId: string) => ({ href: `/invoices/${invoiceId}`, action: "Open invoice" });
  for (const { doc, invoiceId } of documents) {
    const lines = doc.lines.filter((l) => !l.hsnSac?.trim() && l.taxable !== 0n).length;
    if (lines > 0) problems.push({ kind: "missing_hsn", recordId: doc.id, label: `${plural(lines, "line", "lines")} with no HSN/SAC — ${doc.number}`, ...link(invoiceId) });
  }
  for (const { doc, invoiceId } of documents) {
    if (!doc.placeOfSupply) problems.push({ kind: "missing_place_of_supply", recordId: doc.id, label: `No place of supply — ${doc.number}`, ...link(invoiceId) });
  }

  if (totals.fileTax !== totals.taxSummaryTax) {
    problems.push({
      kind: "totals_mismatch",
      recordId: null,
      label: `Tax in the file (${money(totals.fileTax)}) doesn't match tax collected on the Tax Summary (${money(totals.taxSummaryTax)}) — check for invoices voided from earlier periods or entries without a document`,
      href: `/reports/tax-summary?from=${totals.from}&to=${totals.to}`,
      action: "Open Tax Summary",
    });
  }
  return problems;
}
