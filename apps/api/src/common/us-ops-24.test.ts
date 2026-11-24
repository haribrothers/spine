import { describe, expect, it } from "vitest";
import { MINUS_SIGN } from "@spine/shared";
import { formatMoneyForPdf } from "./money-format";

const plain = (s: string) => s.replace(/[\u00a0\u202f]/g, " ");

/** US-OPS-24 — money on PDFs reads like everywhere else; since D-151 the PDF fonts have every symbol and the true minus (US-SET-20). */
describe("US-OPS-24 · money on PDFs", () => {
  it("reads like everywhere else: symbol and thousands separators", () => {
    expect(formatMoneyForPdf(1202475n, "USD", "en-US")).toBe("$12,024.75");
    expect(plain(formatMoneyForPdf(1202475n, "EUR", "de-DE"))).toBe("12.024,75 €");
  });

  it("uses a true minus sign", () => {
    expect(formatMoneyForPdf(-433500n, "USD", "en-US")).toBe(`${MINUS_SIGN}$4,335.00`);
  });

  it("prints ₹ for rupees, with Indian grouping", () => {
    expect(plain(formatMoneyForPdf(12024750n, "INR", "en-IN"))).toBe("₹1,20,247.50");
  });
});
