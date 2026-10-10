import { describe, expect, it } from "vitest";
import { usageText } from "../app/(app)/catalog/catalog-item-drawer";

describe("US-CAT-15 · see where an item is used", () => {
  it("says how many quotes and invoices used it and when it was last quoted, or that it isn't used yet", () => {
    expect(usageText({ quotes: 0, invoices: 0, lastQuotedAt: null })).toBe("Not used on a quote or invoice yet.");
    expect(usageText({ quotes: 1, invoices: 0, lastQuotedAt: null })).toBe("Used on 1 quote");
    expect(usageText({ quotes: 0, invoices: 2, lastQuotedAt: null })).toBe("Used on 2 invoices");
    const text = usageText({ quotes: 4, invoices: 2, lastQuotedAt: "2026-10-03T10:00:00Z" });
    expect(text).toMatch(/^Used on 4 quotes and 2 invoices · last quoted /);
    expect(text).toContain("2026");
  });
});
