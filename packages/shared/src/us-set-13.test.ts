import { describe, expect, it } from "vitest";
import { describeHistoryEntry, fieldLabel } from "./history-format.ts";

const entry = (over: Partial<Parameters<typeof describeHistoryEntry>[0]>) => ({
  action: "updated",
  entityType: "contact",
  changes: null,
  actorName: "Sarah Mendes",
  ...over,
});

describe("US-SET-13 · history entries read as sentences", () => {
  it("a changed field reads as a sentence", () => {
    expect(describeHistoryEntry(entry({ changes: [{ field: "phone", from: "+1-555-0107", to: "+1-555-0177" }] }), "this contact", "contact")).toBe(
      "Sarah Mendes changed the phone from +1-555-0107 to +1-555-0177",
    );
  });

  it("set and cleared fields", () => {
    const text = describeHistoryEntry(
      entry({ changes: [{ field: "email", from: null, to: "a@b.example" }, { field: "taxId", from: "123", to: "" }] }),
      "this contact",
      "contact",
    );
    expect(text).toBe("Sarah Mendes set the email to a@b.example and cleared the tax id");
  });

  it("lists at most three changes, then 'and N more'", () => {
    const changes = ["name", "email", "phone", "website", "notes"].map((field) => ({ field, from: "a", to: "b" }));
    expect(describeHistoryEntry(entry({ changes }), "this contact", "contact")).toBe(
      "Sarah Mendes changed the name from a to b, changed the email from a to b, changed the phone from a to b and 2 more",
    );
  });

  it("names related records instead of 'undefined', and hides ids", () => {
    expect(
      describeHistoryEntry(entry({ action: "issued", entityType: "invoice", changes: [{ field: "status", from: "draft", to: "issued" }] }), "this contact", "contact"),
    ).toBe("Sarah Mendes issued an invoice");
    expect(
      describeHistoryEntry(
        entry({
          action: "milestone_invoiced",
          entityType: "milestone",
          changes: [
            { field: "status", from: "completed", to: "invoiced" },
            { field: "invoicedInvoiceId", from: null, to: "898e95dd-0866-4245-a160-3ca2d41cfbb6" },
          ],
        }),
        "this contact",
        "contact",
      ),
    ).toBe("Sarah Mendes invoiced a milestone");
    expect(describeHistoryEntry(entry({ action: "created", entityType: "credit_note", changes: [{ field: "totalAmount", from: null, to: 43700 }] }), "this contact", "contact")).toBe(
      "Sarah Mendes created a credit note",
    );
  });

  it("formats money and field names for people", () => {
    expect(describeHistoryEntry(entry({ entityType: "invoice", changes: [{ field: "totalAmount", from: 43700, to: 50000 }] }), "this invoice", "invoice")).toBe(
      "Sarah Mendes changed the total amount from 437.00 to 500.00",
    );
    expect(fieldLabel("voidReason")).toBe("void reason");
  });

  it("an unknown actor is 'Someone'", () => {
    expect(describeHistoryEntry(entry({ action: "archived", actorName: null }), "this contact", "contact")).toBe("Someone archived this contact");
  });
});
