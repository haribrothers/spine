import { describe, expect, it } from "vitest";
import { latestVersions, quoteStats, winRateText } from "../app/(app)/quotes/quotes-list-state";
import { quote } from "./quote-fixtures";

const now = new Date(2026, 9, 10, 12);

describe("US-QUO-27 · see open, expiring and won quotes at a glance", () => {
  it("counts each quote once, as its newest version", () => {
    const v1 = quote({ id: "a1", rootQuoteId: "a", number: "QUO-1", status: "sent", version: 1, isSuperseded: true });
    const v2 = quote({ id: "a2", rootQuoteId: "a", number: "QUO-1", status: "sent", version: 2, validUntil: "2026-11-09" });
    expect(latestVersions([v1, v2]).map((q) => q.id)).toEqual(["a2"]);
    expect(quoteStats([v1, v2], "INR", now).open.count).toBe(1);
  });

  it("sums open and won values in the business's currency, notes other currencies, and counts quotes expiring within 7 days", () => {
    const quotes = [
      quote({ id: "a", status: "sent", validUntil: "2026-10-15", totalAmount: "200000" }),
      quote({ id: "b", status: "sent", validUntil: "2026-11-30", totalAmount: "50000", currency: "USD" }),
      quote({ id: "c", status: "sent", validUntil: "2026-10-01", isExpired: true }),
      quote({ id: "d", status: "accepted", respondedAt: "2026-10-03T10:00:00Z", totalAmount: "900000" }),
      quote({ id: "e", status: "accepted", respondedAt: "2026-09-20T10:00:00Z" }),
      quote({ id: "f", status: "rejected", respondedAt: "2026-09-25T10:00:00Z" }),
      quote({ id: "g", status: "draft" }),
    ];
    const stats = quoteStats(quotes, "INR", now);
    expect(stats.open).toEqual({ count: 2, amount: 200000n, otherCurrencies: true });
    expect(stats.expiring).toBe(1);
    expect(stats.won).toEqual({ count: 1, amount: 900000n, otherCurrencies: false });
    // Accepted 2 of 4 closed (2 accepted, 1 declined, 1 expired) in 90 days.
    expect(stats.winRate).toEqual({ won: 2, closed: 4 });
    expect(winRateText(stats.winRate)).toBe("50%");
    expect(winRateText({ won: 0, closed: 0 })).toBe("—");
  });
});
