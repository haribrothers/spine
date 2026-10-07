import { describe, expect, it } from "vitest";
import { POS_OTHER_COUNTRIES, itemTaxFor, placeOfSupplyFor, placeOfSupplyLabel, supplyTypeFor, switchLineTaxes } from "./place-of-supply.ts";

const ITEM = { id: "kitchen", defaultTaxRateId: null, defaultTaxGroupId: "gst18", interTaxRateId: "igst18", interTaxGroupId: null };
const NO_INTER = { id: "survey", defaultTaxRateId: "gst5-rate", defaultTaxGroupId: null };

describe("US-TAX-13 · pick intra- or inter-state GST automatically", () => {
  describe("supply type", () => {
    it("is intra-state in my state, inter-state in another, an export overseas, and inter-state for an SEZ", () => {
      expect(supplyTypeFor({ businessState: "29", placeOfSupply: "29" })).toBe("intra");
      expect(supplyTypeFor({ businessState: "29", placeOfSupply: "33" })).toBe("inter");
      expect(supplyTypeFor({ businessState: "29", placeOfSupply: POS_OTHER_COUNTRIES })).toBe("export");
      expect(supplyTypeFor({ businessState: "29", placeOfSupply: "29", treatment: "overseas" })).toBe("export");
      expect(supplyTypeFor({ businessState: "29", placeOfSupply: "29", treatment: "sez" })).toBe("inter");
    });

    it("for a bill, compares the vendor's state with mine; an overseas vendor is inter-state", () => {
      expect(supplyTypeFor({ businessState: "29", placeOfSupply: "29", direction: "purchase" })).toBe("intra");
      expect(supplyTypeFor({ businessState: "29", placeOfSupply: "27", direction: "purchase" })).toBe("inter");
      expect(supplyTypeFor({ businessState: "29", placeOfSupply: POS_OTHER_COUNTRIES, direction: "purchase" })).toBe("inter");
    });

    it("is null without GST registration or a place of supply", () => {
      expect(supplyTypeFor({ businessState: null, placeOfSupply: "29" })).toBeNull();
      expect(supplyTypeFor({ businessState: "29", placeOfSupply: null })).toBeNull();
    });
  });

  describe("place of supply", () => {
    it("comes from the site or shipping address, else billing, else the contact's state", () => {
      const addresses = [
        { type: "billing", stateCode: "29" },
        { type: "shipping", stateCode: "27" },
        { type: "site", stateCode: "33" },
      ];
      expect(placeOfSupplyFor({ addresses })).toEqual({ code: "33", source: "site" });
      expect(placeOfSupplyFor({ addresses: addresses.slice(0, 2) })).toEqual({ code: "27", source: "shipping" });
      expect(placeOfSupplyFor({ addresses: addresses.slice(0, 1) })).toEqual({ code: "29", source: "billing" });
      expect(placeOfSupplyFor({ stateCode: "07", addresses: [{ type: "site", stateCode: null }] })).toEqual({ code: "07", source: "contact" });
      expect(placeOfSupplyFor({})).toBeNull();
    });

    it("is Other countries for an overseas customer", () => {
      expect(placeOfSupplyFor({ gstTreatment: "overseas", stateCode: "29" })).toEqual({ code: "96", source: "overseas" });
      expect(placeOfSupplyLabel("96")).toBe("Other countries (96)");
      expect(placeOfSupplyLabel("33")).toBe("Tamil Nadu (33)");
    });
  });

  it("an item brings its intra-state tax in my state and its inter-state tax elsewhere", () => {
    expect(itemTaxFor(ITEM, "intra")).toEqual({ taxRateId: null, taxGroupId: "gst18" });
    expect(itemTaxFor(ITEM, "inter")).toEqual({ taxRateId: "igst18", taxGroupId: null });
    expect(itemTaxFor(ITEM, "export")).toEqual({ taxRateId: "igst18", taxGroupId: null });
    expect(itemTaxFor(ITEM, null)).toEqual({ taxRateId: null, taxGroupId: "gst18" });
    // Without an inter-state tax, the item's default is used everywhere.
    expect(itemTaxFor(NO_INTER, "inter")).toEqual({ taxRateId: "gst5-rate", taxGroupId: null });
  });

  describe("changing the place of supply on a draft", () => {
    const line = (key: string, catalogItemId: string | null, taxRateId: string | null, taxGroupId: string | null, type = "item") => ({ key, type, catalogItemId, taxRateId, taxGroupId });
    const lines = [
      line("a", "kitchen", null, "gst18"),
      line("b", "kitchen", "gst5-rate", null), // changed by hand
      line("c", null, "cgst9", null), // a one-off line with tax
      line("d", null, null, null), // a one-off line without tax
      line("h", null, null, null, "heading"),
    ];

    it("switches lines still on their item's tax and flags lines changed by hand", () => {
      const result = switchLineTaxes(lines, [ITEM], "intra", "inter");
      expect(result.lines.find((l) => l.key === "a")).toMatchObject({ taxRateId: "igst18", taxGroupId: null });
      expect(result.lines.find((l) => l.key === "b")).toMatchObject({ taxRateId: "gst5-rate", taxGroupId: null });
      expect(result.switched).toBe(1);
      expect(result.flagged).toEqual(["b", "c"]);
    });

    it("switches back, and does nothing when the place of supply stays on the same side", () => {
      const there = switchLineTaxes(lines, [ITEM], "intra", "inter").lines;
      expect(switchLineTaxes(there, [ITEM], "inter", "intra").lines.find((l) => l.key === "a")).toMatchObject({ taxRateId: null, taxGroupId: "gst18" });
      expect(switchLineTaxes(lines, [ITEM], "inter", "export")).toEqual({ lines, switched: 0, flagged: [] });
    });
  });
});
