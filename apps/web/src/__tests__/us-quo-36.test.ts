import { describe, expect, it } from "vitest";
import { DEFAULT_QUOTE_VALID_DAYS, documentLayoutSchema, resolveDocumentLayout } from "@spine/shared";
import { daysFromToday, pickedDays } from "../app/(app)/quotes/quote-builder";

describe("US-QUO-36 · start a quote valid for my usual number of days", () => {
  it("defaults to 30 days, and reads the business's setting (1 to 365)", () => {
    expect(DEFAULT_QUOTE_VALID_DAYS).toBe(30);
    expect(resolveDocumentLayout(null, "quote").validDays).toBe(30);
    expect(resolveDocumentLayout({ quote: { validDays: 45 } }, "quote").validDays).toBe(45);
    expect(documentLayoutSchema.safeParse({ quote: { validDays: 0 } }).success).toBe(false);
    expect(documentLayoutSchema.safeParse({ quote: { validDays: 366 } }).success).toBe(false);
    expect(documentLayoutSchema.safeParse({ quote: { validDays: 60 } }).success).toBe(true);
  });

  it("adds days to today, and knows which quick pick a date is", () => {
    const today = new Date(2026, 9, 10, 15);
    expect(daysFromToday(30, today)).toEqual(new Date(2026, 10, 9));
    expect(pickedDays(new Date(2026, 9, 25, 9), [15, 30, 60], today)).toBe(15);
    expect(pickedDays(new Date(2026, 9, 26), [15, 30, 60], today)).toBeNull();
    expect(pickedDays(undefined, [15, 30, 60], today)).toBeNull();
  });
});
