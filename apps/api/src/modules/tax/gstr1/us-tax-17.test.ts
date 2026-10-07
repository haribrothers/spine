import { describe, expect, it } from "vitest";
import type { Gstr1CreditNote, Gstr1Invoice } from "./gstr1-build";
import { gstr1Problems } from "./gstr1-problems";

const contact = { id: "c-1", name: "Lakeview Homes LLP", gstTreatment: "registered", gstin: "29AABFL0000B1ZA" };
const invoice: Gstr1Invoice = {
  id: "inv-1",
  number: "INV-0131",
  date: "2026-09-10",
  value: 118000n,
  contact,
  placeOfSupply: "29",
  supplyType: "intra",
  lines: [{ name: "Kitchen", hsnSac: "9403", quantity: 1, taxable: 100000n, tax: 18000n, supplyClass: "taxable", components: [] }],
};
const totals = { fileTax: 18000n, taxSummaryTax: 18000n, from: "2026-09-01", to: "2026-09-30" };
const money = (p: bigint) => `₹${p / 100n}`;

describe("US-TAX-17", () => {
  it("finds nothing when every customer, line and invoice is complete and the totals match", () => {
    expect(gstr1Problems({ invoices: [invoice], creditNotes: [] }, totals, money)).toEqual([]);
  });

  it("names one line in the singular, and a credit note's link opens its invoice", () => {
    const credit: Gstr1CreditNote = { ...invoice, id: "cn-1", number: "CN-0003", lines: [{ ...invoice.lines[0]!, hsnSac: " " }], original: invoice };
    expect(gstr1Problems({ invoices: [], creditNotes: [credit] }, { ...totals, fileTax: -18000n, taxSummaryTax: -18000n }, money)).toEqual([
      { kind: "missing_hsn", recordId: "cn-1", label: "1 line with no HSN/SAC — CN-0003", href: "/invoices/inv-1", action: "Open invoice" },
    ]);
  });

  it("lists a registered customer with no GSTIN once, however many invoices they have", () => {
    const bare = { ...contact, gstin: null };
    const problems = gstr1Problems({ invoices: [{ ...invoice, contact: bare }, { ...invoice, id: "inv-2", number: "INV-0132", contact: bare }], creditNotes: [] }, totals, money);
    expect(problems.filter((p) => p.kind === "missing_gstin")).toHaveLength(1);
  });

  it("says when the file's tax doesn't match the Tax Summary, with a link to it", () => {
    const [problem] = gstr1Problems({ invoices: [invoice], creditNotes: [] }, { ...totals, taxSummaryTax: 19800n }, money);
    expect(problem).toMatchObject({ kind: "totals_mismatch", recordId: null, href: "/reports/tax-summary?from=2026-09-01&to=2026-09-30", action: "Open Tax Summary" });
    expect(problem!.label).toContain("Tax in the file (₹180) doesn't match tax collected on the Tax Summary (₹198)");
  });
});
