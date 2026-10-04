import { describe, expect, it } from "vitest";
import { formatMoney } from "./format.ts";

/** Intl uses no-break spaces; the story writes plain ones. */
const plain = (s: string) => s.replace(/[\u00a0\u202f]/g, " ");

describe("US-OPS-24 · show money the same way everywhere", () => {
  it("$12,024.75 in USD / en-US", () => {
    expect(formatMoney(1202475n, "USD", "en-US")).toBe("$12,024.75");
    expect(formatMoney("1202475", "USD")).toBe("$12,024.75");
  });

  it("a negative amount has a true minus sign", () => {
    expect(formatMoney(-433500n, "USD", "en-US")).toBe("−$4,335.00");
  });

  it("follows the locale's grouping and decimal marks", () => {
    expect(formatMoney(12024750n, "INR", "en-IN")).toBe("₹1,20,247.50");
    expect(plain(formatMoney(1202475n, "EUR", "de-DE"))).toBe("12.024,75 €");
  });

  it("uses the currency's own decimals and keeps big amounts exact", () => {
    expect(formatMoney(12025n, "JPY", "en-US")).toBe("¥12,025");
    expect(formatMoney(900719925474099312n, "USD", "en-US")).toBe("$9,007,199,254,740,993.12");
  });

  it("falls back sensibly for a missing or unknown locale", () => {
    expect(formatMoney(0n, "USD", "")).toBe("$0.00");
    expect(formatMoney(100n, "USD", "not-a-locale-!!")).toBe("$1.00");
  });
});
