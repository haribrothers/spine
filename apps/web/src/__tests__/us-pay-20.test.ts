import { describe, expect, it } from "vitest";
import { paymentActivityText } from "../app/(app)/payments/payment-activity";

describe("US-PAY-20 · follow what happened to a payment", () => {
  const at = "2026-10-07T05:50:00.000Z";
  it("says what happened, naming the invoice and the reason", () => {
    expect(paymentActivityText({ at, type: "recorded", actorName: "Priya", amount: "20000000", detail: "cheque", account: "ICICI Collections" }, "USD").text).toBe("Recorded · $200,000.00 by cheque into ICICI Collections");
    expect(paymentActivityText({ at, type: "applied", actorName: "Priya", amount: "4200000", detail: "INV-0037", linkId: "i" }, "USD")).toEqual({ text: "Applied $42,000.00 to", link: "INV-0037" });
    expect(paymentActivityText({ at, type: "unapplied", actorName: "Priya", amount: "4200000", detail: "INV-0037", reason: "Wing C" }, "USD")).toEqual({ text: "Moved $42,000.00 off", link: "INV-0037", after: "Wing C" });
    expect(paymentActivityText({ at, type: "emailed", actorName: null, detail: "a@b.example" }, "USD").text).toBe("Receipt emailed to a@b.example");
    expect(paymentActivityText({ at, type: "refunded", actorName: null, amount: "590000", detail: "upi" }, "USD").text).toBe("Refunded · $5,900.00 · UPI");
  });
});
