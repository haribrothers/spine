import { describe, expect, it } from "vitest";
import { describeHistoryEntry } from "./history-format.ts";
import { acceptQuoteInPersonSchema, rejectQuoteInPersonSchema } from "./schemas/quotes.ts";

describe("US-QUO-20 · the quote's history names how it was answered", () => {
  const entry = (action: string, actorName: string | null, changes: { field: string; from: unknown; to: unknown }[] = []) => ({ action, entityType: "quote", actorName, changes });

  it("an answer through the link is the customer's, online", () => {
    expect(describeHistoryEntry(entry("accepted", null, [{ field: "status", from: "sent", to: "accepted" }]), "this quote", "quote")).toBe("The customer accepted this quote online");
    expect(describeHistoryEntry(entry("rejected", null), "this quote", "quote")).toBe("The customer declined this quote online");
  });

  it("an on-site answer names who recorded it, the signer, and a decline's reason", () => {
    expect(describeHistoryEntry(entry("accepted_in_person", "Marcus Webb", [{ field: "status", from: "sent", to: "accepted" }, { field: "signedBy", from: null, to: "Alan Reyes" }]), "this quote", "quote")).toBe(
      "Marcus Webb recorded the customer's acceptance of this quote on site, signed by Alan Reyes",
    );
    expect(describeHistoryEntry(entry("rejected_in_person", "Marcus Webb", [{ field: "reason", from: null, to: "The timing doesn't work." }]), "this quote", "quote")).toBe(
      "Marcus Webb recorded the customer declining this quote on site — The timing doesn't work.",
    );
  });
});

describe("US-QUO-19 · an on-site acceptance needs the signer's name", () => {
  const signatureFileId = "4f0f8e6e-5b0e-4a49-9a4f-2a6f3d9b7c11";
  it("requires a name, trimmed", () => {
    expect(acceptQuoteInPersonSchema.safeParse({ signatureFileId }).success).toBe(false);
    expect(acceptQuoteInPersonSchema.safeParse({ signatureFileId, signerName: "  " }).success).toBe(false);
    expect(acceptQuoteInPersonSchema.parse({ signatureFileId, signerName: " Alan Reyes " }).signerName).toBe("Alan Reyes");
  });

  it("a decline's reason is optional (US-MOB-16)", () => {
    expect(rejectQuoteInPersonSchema.parse({})).toEqual({});
    expect(rejectQuoteInPersonSchema.parse({ comment: " Too dear " }).comment).toBe("Too dear");
  });
});
