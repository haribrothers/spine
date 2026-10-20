import { describe, expect, it } from "vitest";
import { readableTypes } from "./record-types";
import { withFormattedMoney } from "./presenting";

const none: Record<string, boolean> = {};

describe("US-MCP-05 · what agents can read, and how amounts read", () => {
  it("Owners read every type whose module is on; Staff the sections their Teams open; Field contacts, catalogue, jobs and expenses", () => {
    expect(readableTypes("owner", none).map((t) => t.key)).toHaveLength(12);
    expect(readableTypes("owner", { "leads.open": false, "jobs.open": false }).map((t) => t.key)).not.toEqual(expect.arrayContaining(["lead", "job"]));
    expect(readableTypes("staff", { "quotes.open": true, "contacts.open": true }).map((t) => t.key)).toEqual(["contact", "quote", "expense"]);
    expect(readableTypes("field", { "jobs.open": true }).map((t) => t.key)).toEqual(["contact", "job", "expense", "catalog_item"]);
    expect(readableTypes("field", none).map((t) => t.key)).toEqual(["contact", "expense", "catalog_item"]);
  });

  it("adds a formatted copy of every amount next to its minor units, in the business's locale, leaving ids and text alone", () => {
    const out = withFormattedMoney({ currency: "USD", totalAmount: "125000", balanceAmount: "-500", contactId: "123", lines: [{ unitPriceAmount: "4800", name: "Deck" }], notes: "Pay 100" }, "en-US") as Record<string, unknown>;
    expect(out).toMatchObject({ totalAmount: "125000", totalAmountFormatted: "$1,250.00", balanceAmountFormatted: "−$5.00", notes: "Pay 100" });
    expect(out).not.toHaveProperty("contactIdFormatted");
    expect((out.lines as Record<string, unknown>[])[0]).toMatchObject({ unitPriceAmountFormatted: "$48.00" });
    expect(withFormattedMoney({ currency: "INR", amount: "7906000" }, "en-IN")).toMatchObject({ amountFormatted: "₹79,060.00" });
  });
});
