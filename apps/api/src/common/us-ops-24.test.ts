import { describe, expect, it } from "vitest";
import { formatMoneyForPdf } from "./money-format";

const plain = (s: string) => s.replace(/[\u00a0\u202f]/g, " ");

/** US-OPS-24 / D-123 — money on PDFs, which can only draw Windows-1252 characters. */
describe("US-OPS-24 · money on PDFs", () => {
  it("reads like everywhere else: symbol and thousands separators", () => {
    expect(formatMoneyForPdf(1202475n, "USD", "en-US")).toBe("$12,024.75");
    expect(plain(formatMoneyForPdf(1202475n, "EUR", "de-DE"))).toBe("12.024,75 €");
  });

  it("uses an en dash for the minus, which the PDF font has", () => {
    expect(formatMoneyForPdf(-433500n, "USD", "en-US")).toBe("–$4,335.00");
  });

  it("falls back to the currency code when the font has no symbol for it", () => {
    expect(plain(formatMoneyForPdf(12024750n, "INR", "en-IN"))).toBe("INR 1,20,247.50");
  });
});
