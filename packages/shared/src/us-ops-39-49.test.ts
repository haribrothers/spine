import { describe, expect, it } from "vitest";
import { SEARCH_GROUPS, SEARCH_SCOPES, parseSearchAmount, parseSearchTypes, recordRecentSchema } from "./schemas/search.ts";

describe("US-OPS-45", () => {
  it("reads amounts in the business's number format", () => {
    expect(parseSearchAmount("2,389.50", "en-US", "USD")).toBe(238950n);
    expect(parseSearchAmount("2389.5", "en-US", "USD")).toBe(238950n);
    expect(parseSearchAmount("$2,389.50", "en-US", "USD")).toBe(238950n);
    expect(parseSearchAmount("USD 2389", "en-US", "USD")).toBe(238900n);
    expect(parseSearchAmount("2,389", "en-US", "USD")).toBe(238900n);
    expect(parseSearchAmount("₹1,20,247.50", "en-IN", "INR")).toBe(12024750n);
    expect(parseSearchAmount("Rs. 1,250", "en-IN", "INR")).toBe(125000n);
    expect(parseSearchAmount("2.389,50 €", "de-DE", "EUR")).toBe(238950n);
    expect(parseSearchAmount("1500", "ja-JP", "JPY")).toBe(1500n);
  });

  it("doesn't read document numbers, words or malformed numbers as amounts", () => {
    for (const q of ["INV-0010", "QU-12", "inv 10", "har", "12.345", "2,38,9.1.2", "1.5", "2389.50abc"]) {
      expect(parseSearchAmount(q, "en-US", q === "1.5" ? "JPY" : "USD"), q).toBeNull();
    }
  });
});

describe("US-OPS-49", () => {
  it("narrows to the sidebar's areas, which cover every group once", () => {
    expect(Object.values(SEARCH_SCOPES).flat().sort()).toEqual([...SEARCH_GROUPS].sort());
    expect(parseSearchTypes("invoices,credit_notes,payments")).toEqual(["invoices", "credit_notes", "payments"]);
    expect(parseSearchTypes("")).toEqual([]);
    expect(parseSearchTypes("invoices,widgets")).toBeNull();
  });
});

describe("US-OPS-39", () => {
  it("records an opened record or the search it came from", () => {
    expect(recordRecentSchema.safeParse({ type: "invoices", id: "3f0b4a8e-6a7c-4b2e-9a51-5c2f1f6f2d11" }).success).toBe(true);
    expect(recordRecentSchema.safeParse({ query: "bluewater" }).success).toBe(true);
    expect(recordRecentSchema.safeParse({ type: "widgets", id: "3f0b4a8e-6a7c-4b2e-9a51-5c2f1f6f2d11" }).success).toBe(false);
    expect(recordRecentSchema.safeParse({}).success).toBe(false);
  });
});
