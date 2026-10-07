/**
 * US-TAX-10 — what kind of tax a rate is, so reports and GSTR-1 can split
 * CGST, SGST and IGST. Rates from before Phase 9 are `other`.
 */
export const TAX_TYPES = ["cgst", "sgst", "utgst", "igst", "cess", "vat", "gst", "sales_tax", "other"] as const;
export type TaxType = (typeof TAX_TYPES)[number];

export const TAX_TYPE_LABELS: Record<TaxType, string> = {
  cgst: "CGST",
  sgst: "SGST",
  utgst: "UTGST",
  igst: "IGST",
  cess: "Cess",
  vat: "VAT",
  gst: "GST",
  sales_tax: "Sales tax",
  other: "Other",
};

/** US-TAX-10 — the "Tax type" choices: India's GST components, or the general kinds elsewhere. */
export const INDIA_TAX_TYPES: readonly TaxType[] = ["cgst", "sgst", "utgst", "igst", "cess"];
export const GENERAL_TAX_TYPES: readonly TaxType[] = ["vat", "gst", "sales_tax", "other"];

/** Which state a group applies to: within the business's state, across states, or either. */
export const TAX_GROUP_SCOPES = ["intra", "inter", "any"] as const;
export type TaxGroupScope = (typeof TAX_GROUP_SCOPES)[number];

export const GST_GROUP_MIX_MESSAGE = "A GST group is CGST + SGST (or UTGST) at the same rate, optionally with cess.";

/**
 * US-TAX-10 — an Indian GST group is CGST with SGST or UTGST at the same
 * rate (plus optional cess), or a single IGST rate (plus optional cess).
 * Returns the scope the mix implies, or `null` when it isn't a GST mix.
 */
export function gstGroupScope(rates: readonly { taxType: TaxType; rate: number | string }[]): Exclude<TaxGroupScope, "any"> | null {
  const of = (type: TaxType) => rates.filter((r) => r.taxType === type);
  const known = of("cgst").length + of("sgst").length + of("utgst").length + of("igst").length + of("cess").length;
  if (known !== rates.length || of("cess").length > 1) return null;
  const [cgst, sgst, utgst, igst] = [of("cgst"), of("sgst"), of("utgst"), of("igst")];
  if (igst.length === 1 && cgst.length === 0 && sgst.length === 0 && utgst.length === 0) return "inter";
  const state = [...sgst, ...utgst];
  if (igst.length === 0 && cgst.length === 1 && state.length === 1 && Number(cgst[0]!.rate) === Number(state[0]!.rate)) return "intra";
  return null;
}
