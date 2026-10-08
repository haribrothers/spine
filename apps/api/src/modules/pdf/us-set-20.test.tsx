import { readFileSync } from "node:fs";
import path from "node:path";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import { pdfText } from "../../test-utils/pdf-text";
import { InvoicePdfDocument } from "./invoice-pdf.template";
import { PDF_COVERED_SCRIPTS } from "./pdf-fonts";

const FONTS = path.resolve(__dirname, "../../../assets/fonts");

/** The code points a TrueType font's cmap (formats 4 and 12) maps to a glyph. */
function coverage(file: string): (cp: number) => boolean {
  const data = readFileSync(path.join(FONTS, file));
  const tables = data.readUInt16BE(4);
  let cmap = 0;
  for (let i = 0; i < tables; i++) if (data.toString("latin1", 12 + 16 * i, 16 + 16 * i) === "cmap") cmap = data.readUInt32BE(20 + 16 * i);
  const ranges: [number, number][] = [];
  for (let i = 0; i < data.readUInt16BE(cmap + 2); i++) {
    const sub = cmap + data.readUInt32BE(cmap + 8 + 8 * i);
    const format = data.readUInt16BE(sub);
    if (format === 4) {
      const segs = data.readUInt16BE(sub + 6) / 2;
      for (let s = 0; s < segs; s++) ranges.push([data.readUInt16BE(sub + 16 + 2 * segs + 2 * s), data.readUInt16BE(sub + 14 + 2 * s)]);
    } else if (format === 12) {
      for (let g = 0; g < data.readUInt32BE(sub + 12); g++) ranges.push([data.readUInt32BE(sub + 16 + 12 * g), data.readUInt32BE(sub + 20 + 12 * g)]);
    }
  }
  return (cp) => ranges.some(([start, end]) => cp >= start && cp <= end && cp !== 0xffff);
}

const latin = coverage("NotoSans-Regular.ttf");
const devanagari = coverage("NotoSansDevanagari-Regular.ttf");
const printable = (text: string) => [...text].filter((c) => c.trim()).every((c) => latin(c.codePointAt(0)!) || devanagari(c.codePointAt(0)!));

/** Every string a react-pdf element tree would print, in order. */
function textOf(node: ReactNode): string[] {
  if (node === null || node === undefined || typeof node === "boolean") return [];
  if (typeof node === "string" || typeof node === "number") return [String(node)];
  if (Array.isArray(node)) return node.flatMap(textOf);
  if (isValidElement(node)) {
    const element = node as ReactElement<{ children?: ReactNode }>;
    if (typeof element.type === "function") return textOf((element.type as (p: unknown) => ReactNode)(element.props));
    return textOf(element.props.children);
  }
  return [];
}

const invoice = {
  id: "inv",
  number: "INV-0142",
  type: "standard",
  status: "issued",
  currency: "INR",
  issueDate: "2026-10-05",
  dueDate: "2026-10-20",
  issuedAt: new Date("2026-10-05T10:00:00Z"),
  createdAt: new Date("2026-10-05T10:00:00Z"),
  subtotalAmount: 24190000n,
  discountAmount: 0n,
  taxAmount: 0n,
  totalAmount: 24190000n,
  amountPaid: 0n,
  creditedAmount: 0n,
  retentionAmount: 0n,
  notes: null,
  termsAndConditions: null,
  paymentInstructions: null,
} as never;
const lines = [
  { id: "l1", type: "item", name: "मॉड्यूलर किचन", description: "Kitchen", quantity: 1, unitPriceAmount: 24190000n, lineTotalAmount: 24190000n, taxRatePercentage: 0 },
] as never;

/** US-SET-20 (D-151) — ₹, accented Latin, Greek, Cyrillic and Devanagari print on PDFs. */
describe("US-SET-20 · show every character on PDFs", () => {
  it("covers Latin, Greek, Cyrillic and Devanagari, and every currency symbol Spine offers", () => {
    expect(PDF_COVERED_SCRIPTS).toEqual(["Latin", "Greek", "Cyrillic", "Devanagari"]);
    expect(printable("Café Zürich Łódź")).toBe(true);
    expect(printable("Ελληνικά")).toBe(true);
    expect(printable("Русский")).toBe(true);
    expect(printable("राम कुमार शर्मा")).toBe(true);
    expect(printable("₹ $ € £ ¥ − –")).toBe(true);
  });

  it("documents the scripts it doesn't cover yet: they fall back and print as missing glyphs (v1.1)", () => {
    for (const uncovered of ["தமிழ்", "తెలుగు", "ಕನ್ನಡ", "বাংলা", "中文", "العربية"]) expect(printable(uncovered)).toBe(false);
  });

  it("an INR invoice prints ₹, not INR", () => {
    const text = textOf(InvoicePdfDocument({ invoice, lines, contactName: "राम कुमार शर्मा", contactEmail: null, business: { name: "Kaveri Interiors" }, locale: "en-IN" })).join(" ");
    expect(text).toContain("₹2,41,900.00");
    expect(text).not.toContain("INR");
    expect(text).toContain("राम कुमार शर्मा");
  });

  it("embeds Noto Sans and Noto Sans Devanagari in a rendered PDF with a Devanagari customer name", async () => {
    const buf = await renderToBuffer(InvoicePdfDocument({ invoice, lines, contactName: "राम कुमार शर्मा", contactEmail: null, business: { name: "Kaveri Interiors" }, locale: "en-IN" }));
    const pdf = buf.toString("latin1");
    const text = pdfText(buf);
    expect(text).toContain("₹2,41,900.00");
    expect(text).toContain("राम");
    expect(pdf).toMatch(/\/BaseFont \/[A-Z]{6}\+NotoSans-Regular/);
    expect(pdf).toMatch(/\/BaseFont \/[A-Z]{6}\+NotoSansDevanagari-Regular/);
    expect(pdf).not.toContain("Helvetica");
  });
});
