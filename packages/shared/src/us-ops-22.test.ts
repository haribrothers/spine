import { describe, expect, it } from "vitest";
import { isNumberMatch, parseDocumentNumber } from "./schemas/search.ts";

describe("US-OPS-22 · document numbers in search", () => {
  it("reads a number however it's typed", () => {
    expect(parseDocumentNumber("QUO-4")).toEqual({ prefix: "QUO", value: 4 });
    expect(parseDocumentNumber("inv 0010")).toEqual({ prefix: "INV", value: 10 });
    expect(parseDocumentNumber("INV0010")).toEqual({ prefix: "INV", value: 10 });
    expect(parseDocumentNumber("harbor")).toBeNull();
    expect(parseDocumentNumber("2231")).toBeNull();
  });

  it("matches the stored number", () => {
    expect(isNumberMatch("QUO-0004", "QUO-4")).toBe(true);
    expect(isNumberMatch("INV-0010", "inv-0010")).toBe(true);
    expect(isNumberMatch("INV-0010", "INV-0001")).toBe(false);
    expect(isNumberMatch("QUO-0004", "INV-4")).toBe(false);
    expect(isNumberMatch("BILL-2231", "bill-2231")).toBe(true);
    expect(isNumberMatch("2231", "2231")).toBe(true);
    expect(isNumberMatch(null, "QUO-4")).toBe(false);
  });
});
