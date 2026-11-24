import { describe, expect, it } from "vitest";
import { calendarDate, shortDate, validityNote } from "../app/(app)/quotes/quotes-list-state";
import { quote } from "./quote-fixtures";

const now = new Date(2026, 9, 10, 12);

describe("US-QUO-29 · read a quote's progress in the list", () => {
  it("counts down the validity of a sent quote, says when it expired, or when it was answered", () => {
    expect(validityNote(quote({ status: "sent", validUntil: "2026-10-15" }), now, "en-GB")).toEqual({ text: "in 5 days", tone: "soon" });
    expect(validityNote(quote({ status: "sent", validUntil: "2026-10-10" }), now, "en-GB")).toEqual({ text: "today", tone: "soon" });
    expect(validityNote(quote({ status: "sent", validUntil: "2026-11-09" }), now, "en-GB")).toEqual({ text: "in 30 days", tone: "" });
    expect(validityNote(quote({ status: "sent", validUntil: "2026-10-04", isExpired: true }), now, "en-GB")).toEqual({ text: "Expired 6 days ago", tone: "gone" });
    expect(validityNote(quote({ status: "accepted", respondedAt: "2026-10-06T10:00:00Z" }), now, "en-GB").text).toBe("Accepted 6 Oct");
    expect(validityNote(quote({ status: "rejected", respondedAt: "2026-09-18T10:00:00Z" }), now, "en-GB").text).toBe("Declined 18 Sept");
    expect(validityNote(quote({ status: "draft" }), now).text).toBe("");
  });

  it("writes dates in the business's locale, with the year only when it isn't this year", () => {
    expect(shortDate("2026-10-12T09:00:00Z", now, "en-GB")).toBe("12 Oct");
    expect(shortDate("2026-10-12T09:00:00Z", now, "en-US")).toBe("Oct 12");
    expect(shortDate("2025-03-02T09:00:00Z", now, "en-GB")).toBe("2 Mar 2025");
    expect(calendarDate("2026-10-15", now, "en-GB")).toBe("15 Oct");
  });
});
