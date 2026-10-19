import { describe, expect, it } from "vitest";
import { addDays, daysFromTerms, decimalToMinor, matchByName, matchTax, normalizeName, type TaxOption } from "./matching";

/** US-AI-08 (D-170) — Spine's own matching of what AI read. */
describe("US-AI-08 · matching", () => {
  const vendors = [{ name: "Apex Building Materials Pvt Ltd" }, { name: "Ridgeline Equipment Rentals" }, { name: "Shree Hardware" }, { name: "Shree Hardware Mart" }];

  it("matches a vendor whatever the legal words and punctuation", () => {
    expect(normalizeName("M/s. Apex Building Materials Pvt. Ltd.")).toBe("apex building materials");
    expect(matchByName("APEX BUILDING MATERIALS PRIVATE LIMITED", vendors)?.name).toBe("Apex Building Materials Pvt Ltd");
    expect(matchByName("Ridgeline Equipment Rentals (Bengaluru)", vendors)?.name).toBe("Ridgeline Equipment Rentals");
  });

  it("matches nothing when two vendors could be the one, or none is", () => {
    expect(matchByName("Shree", vendors)).toBeNull();
    expect(matchByName("Shree Ganesh Hardware", vendors)).toBeNull();
    expect(matchByName("", vendors)).toBeNull();
  });

  it("turns an amount into minor units, rounding half-up once", () => {
    expect(decimalToMinor("1,80,540.00", "INR")).toBe(18_054_000n);
    expect(decimalToMinor(68.5, "INR")).toBe(6_850n);
    expect(decimalToMinor("₹ 410.005", "INR")).toBe(41_001n);
    expect(decimalToMinor("1,200", "JPY")).toBe(1_200n);
    expect(decimalToMinor("about 90", "INR")).toBeNull();
    expect(decimalToMinor(-5, "INR")).toBeNull();
  });

  const options: TaxOption[] = [
    { kind: "group", id: "gst18", percent: 18, scope: "intra" },
    { kind: "rate", id: "igst18", percent: 18, scope: "inter" },
    { kind: "group", id: "gst28", percent: 28, scope: "intra" },
    { kind: "rate", id: "vat20", percent: 20, scope: "any" },
  ];

  it("matches a tax rate by percentage for the supply type", () => {
    expect(matchTax(18, "intra", options)?.id).toBe("gst18");
    expect(matchTax(18, "inter", options)?.id).toBe("igst18");
    expect(matchTax(20, null, options)?.id).toBe("vat20");
    expect(matchTax(28, "inter", options)).toBeNull();
    expect(matchTax(0, "intra", options)).toBeNull();
    expect(matchTax(null, "intra", options)).toBeNull();
  });

  it("works out a due date from the payment terms", () => {
    expect(daysFromTerms("Payment due within 30 days")).toBe(30);
    expect(daysFromTerms("Terms: Net 45")).toBe(45);
    expect(daysFromTerms("Due on receipt")).toBe(0);
    expect(daysFromTerms("Thank you for your business")).toBeNull();
    expect(addDays("2026-10-14", 30)).toBe("2026-11-13");
  });
});
