import { describe, expect, it } from "vitest";
import { DEFAULT_INVOICE_DUE_DAYS, documentLayoutSchema, dueDateFor, resolveDocumentLayout } from "@spine/shared";
import { DUE_PICKS, daysAfter, pickedDueDays } from "../app/(app)/invoices/due-terms";

const today = new Date(2026, 9, 10, 12);

describe("US-INV-33 · give every invoice a due date from my payment terms", () => {
  it("takes 0 to 365 days, 30 to start", () => {
    expect(DEFAULT_INVOICE_DUE_DAYS).toBe(30);
    expect(resolveDocumentLayout(null, "invoice").dueDays).toBe(30);
    expect(resolveDocumentLayout({ invoice: { dueDays: 0 } }, "invoice").dueDays).toBe(0);
    expect(documentLayoutSchema.safeParse({ invoice: { dueDays: 366 } }).success).toBe(false);
    expect(documentLayoutSchema.safeParse({ invoice: { dueDays: -1 } }).success).toBe(false);
  });

  it("dates an issued invoice its issue date plus the terms, across month ends", () => {
    expect(dueDateFor("2026-09-04", 30)).toBe("2026-10-04");
    expect(dueDateFor("2026-01-31", 30)).toBe("2026-03-02");
    expect(dueDateFor("2026-09-04", 0)).toBe("2026-09-04");
  });

  it("offers On receipt, +15, +30 and +60 days from the issue date, and shows which one is picked", () => {
    expect(DUE_PICKS).toEqual([0, 15, 30, 60]);
    expect(daysAfter(undefined, 30, today)).toEqual(new Date(2026, 10, 9));
    const issue = new Date(2026, 9, 1);
    expect(pickedDueDays(issue, new Date(2026, 9, 16), DUE_PICKS, today)).toBe(15);
    expect(pickedDueDays(undefined, new Date(2026, 9, 10, 18), DUE_PICKS, today)).toBe(0);
    expect(pickedDueDays(issue, new Date(2026, 9, 20), DUE_PICKS, today)).toBeNull();
    expect(pickedDueDays(issue, undefined, DUE_PICKS, today)).toBeNull();
  });
});
