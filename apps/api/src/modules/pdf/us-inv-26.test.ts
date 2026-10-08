import { describe, expect, it } from "vitest";
import { invoiceEmail } from "../email/email-templates";
import { upiQrFor } from "./upi-qr";

const profile = { name: "Kaveri Interiors", upiId: "kaveriinteriors@okhdfc", upiPayeeName: "Kaveri Interiors Pvt Ltd" };
const issued = { status: "issued", number: "INV-0142", currency: "INR", upiQrAmount: 24190000n, balanceDue: 24190000n };

describe("US-INV-26", () => {
  it("a UPI app opens the code with the payee, the amount and the invoice number as the note", () => {
    const uri = new URL(upiQrFor(issued, profile)!.uri);
    expect(uri.protocol).toBe("upi:");
    expect(uri.searchParams.get("pa")).toBe("kaveriinteriors@okhdfc");
    expect(uri.searchParams.get("pn")).toBe("Kaveri Interiors Pvt Ltd");
    expect(uri.searchParams.get("am")).toBe("241900.00");
    expect(uri.searchParams.get("cu")).toBe("INR");
    expect(uri.searchParams.get("tn")).toBe("INV-0142");
  });

  it("the payee defaults to the business name", () => {
    expect(new URL(upiQrFor(issued, { name: "Kaveri Interiors", upiId: "k@okhdfc" })!.uri).searchParams.get("pn")).toBe("Kaveri Interiors");
  });

  it("an issued invoice keeps the amount at issue; with none, or no UPI ID now, there's no code", () => {
    expect(upiQrFor({ ...issued, balanceDue: 100n }, profile)!.amount).toBe(24190000n);
    expect(upiQrFor({ ...issued, upiQrAmount: null }, profile)).toBeNull();
    expect(upiQrFor(issued, { name: "Kaveri Interiors" })).toBeNull();
  });

  it("a draft previews its balance due, unless the setting is off, it isn't in rupees or nothing is due", () => {
    const draft = { status: "draft", number: null, currency: "INR", upiQrAmount: null, balanceDue: 500000n };
    expect(upiQrFor(draft, profile)).toMatchObject({ amount: 500000n, note: "Draft invoice" });
    expect(upiQrFor(draft, { ...profile, showUpiQr: false })).toBeNull();
    expect(upiQrFor({ ...draft, currency: "USD" }, profile)).toBeNull();
    expect(upiQrFor({ ...draft, balanceDue: 0n }, profile)).toBeNull();
  });

  const reminder = (balanceDue: bigint, upiQrAmount: bigint | null) =>
    invoiceEmail({
      locale: "en-IN",
      businessName: "Kaveri Interiors",
      contactName: "Lakeview Homes",
      number: "INV-0142",
      currency: "INR",
      total: 24190000n,
      retention: 0n,
      balanceDue,
      dueDate: "2026-10-20",
      reminder: { daysOverdue: 3 },
      upiQrAmount,
    }).content;

  it("a reminder states the current balance and, when it differs from the QR code's, what clears it", () => {
    const partly = reminder(20000000n, 24190000n);
    expect(partly.facts).toContainEqual({ label: "Balance due", value: "₹2,00,000.00" });
    expect(partly.paragraphs).toContain("The QR code on the attached invoice is for ₹2,41,900.00; pay ₹2,00,000.00 to clear it.");
  });

  it("says nothing extra when the balance matches, there's no QR code, or it's not a reminder", () => {
    expect(reminder(24190000n, 24190000n).paragraphs.join(" ")).not.toContain("QR code");
    expect(reminder(20000000n, null).paragraphs.join(" ")).not.toContain("QR code");
    const first = invoiceEmail({ businessName: "K", contactName: "L", number: "INV-1", currency: "INR", total: 1n, retention: 0n, balanceDue: 1n, dueDate: null, upiQrAmount: 2n });
    expect(first.content.paragraphs.join(" ")).not.toContain("QR code");
  });
});
