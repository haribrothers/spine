import { describe, expect, it } from "vitest";
import { CONSTRUCTION_ACCOUNTS, CONSTRUCTION_CATEGORIES, CONSTRUCTION_TEMPLATE_NOTE, templateSeedNote } from "./schemas/industry-template.ts";

/** US-ONB-13 (D-129) — what the Construction template sets up, and the note it leaves. */
describe("US-ONB-13 · construction cost categories", () => {
  it("adds 5300, 5400 and 5500 and six categories on 5000–5500", () => {
    expect(CONSTRUCTION_ACCOUNTS.map((a) => `${a.code} ${a.name}`)).toEqual(["5300 Plant & Equipment Hire", "5400 Fuel & Freight", "5500 Site Overheads & Permits"]);
    expect(CONSTRUCTION_CATEGORIES.map((c) => `${c.name} (${c.accountCode})`)).toEqual([
      "Materials (5000)",
      "Subcontractors (5100)",
      "Site labour (5200)",
      "Plant & equipment hire (5300)",
      "Fuel & freight (5400)",
      "Site overheads & permits (5500)",
    ]);
    expect(CONSTRUCTION_TEMPLATE_NOTE).toBe("Sets up cost categories for materials, labour, subcontractors, plant hire, fuel and freight, and site overheads.");
  });

  it("writes the note shown on Expenses › Categories", () => {
    expect(
      templateSeedNote({
        accounts: ["5300 · Plant & Equipment Hire", "5400 · Fuel & Freight", "5500 · Site Overheads & Permits"],
        categories: ["Subcontractors", "Site labour", "Plant & equipment hire", "Fuel & freight", "Site overheads & permits"],
        kept: ["Kept your existing category “Materials”"],
      }),
    ).toBe(
      "Set up by the Construction / Contracting template: 5 new categories and accounts 5300 Plant & Equipment Hire, 5400 Fuel & Freight and 5500 Site Overheads & Permits. Kept your existing category “Materials”. These are ordinary categories — rename, remap or archive them like any other.",
    );
    expect(templateSeedNote({ accounts: [], categories: [], kept: [] })).toBeNull();
  });
});
