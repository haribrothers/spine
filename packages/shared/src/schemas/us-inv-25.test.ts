import { describe, expect, it } from "vitest";
import { businessProfileSchema, UPI_ID_INVALID, UPI_ID_PATTERN, upiPaymentUri } from "./business-profile.ts";

describe("US-INV-25", () => {
  it("accepts a UPI ID like name@bank", () => {
    for (const id of ["riverstone@okhdfc", "kaveri.interiors@ybl", "9876543210@paytm"]) expect(UPI_ID_PATTERN.test(id)).toBe(true);
  });

  it("refuses one without an @ or with spaces, saying what to enter", () => {
    for (const id of ["riverstone", "river stone@okhdfc", "riverstone@ok hdfc", "@okhdfc", "riverstone@"]) {
      const parsed = businessProfileSchema.safeParse({ name: "Riverstone", upiId: id });
      expect(parsed.success, id).toBe(false);
      expect(parsed.error?.issues[0]?.message).toBe(UPI_ID_INVALID);
    }
    expect(UPI_ID_INVALID).toBe("Enter a UPI ID like name@bank.");
  });

  it("keeps the payee name and the QR switch alongside the UPI ID", () => {
    expect(businessProfileSchema.parse({ name: "Riverstone", upiId: "riverstone@okhdfc", upiPayeeName: "Riverstone Builders", showUpiQr: true })).toMatchObject({
      upiId: "riverstone@okhdfc",
      upiPayeeName: "Riverstone Builders",
      showUpiQr: true,
    });
  });

  it("builds the UPI payment link the QR code encodes (D-150)", () => {
    expect(upiPaymentUri({ upiId: "riverstone@okhdfc", payeeName: "Riverstone Builders", amount: 2419000n, note: "INV-0042" })).toBe(
      "upi://pay?pa=riverstone%40okhdfc&pn=Riverstone%20Builders&am=24190.00&cu=INR&tn=INV-0042",
    );
    expect(upiPaymentUri({ upiId: "a@b", payeeName: "A", amount: 5n, note: "X" })).toContain("am=0.05");
  });
});
