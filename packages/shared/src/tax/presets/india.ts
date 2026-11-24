import type { PresetGroup, PresetRate, TaxPreset } from "./types.ts";

/**
 * India's GST slabs, current at Phase 9 (the 22 September 2025 rates): 0,
 * 0.25, 3, 5, 18 and 40%. The 12% and 28% slabs are no longer used, so
 * they're created archived for documents that still need them.
 */
const SLABS = [0, 0.25, 3, 5, 12, 18, 28, 40];
const RETIRED = new Set([12, 28]);

const rates: PresetRate[] = [];
const groups: PresetGroup[] = [];
for (const slab of SLABS) {
  const half = slab / 2;
  const archived = RETIRED.has(slab) || undefined;
  rates.push(
    { name: `CGST ${half}%`, rate: half, taxType: "cgst", archived },
    { name: `SGST ${half}%`, rate: half, taxType: "sgst", archived },
    { name: `UTGST ${half}%`, rate: half, taxType: "utgst", archived: true },
    { name: `IGST ${slab}%`, rate: slab, taxType: "igst", archived },
  );
  groups.push({ name: `GST ${slab}%`, rates: [`CGST ${half}%`, `SGST ${half}%`], scope: "intra", archived });
  // Used instead of the SGST group by a business in a union territory without a legislature (US-TAX-12).
  groups.push({ name: `GST ${slab}% (UT)`, rates: [`CGST ${half}%`, `UTGST ${half}%`], scope: "intra", archived: true });
}

export const INDIA_PRESET: TaxPreset = {
  country: "IN",
  label: "India (GST)",
  description: "CGST, SGST, IGST and cess at the current slabs. GST details come next.",
  rates,
  groups,
};
