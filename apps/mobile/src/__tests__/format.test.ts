import { dueChip, relativeTime, shortWhen, townFrom, money } from "../lib/format";

const THURSDAY = new Date(2026, 9, 8, 9, 41);

describe("field app formatting", () => {
  it("writes due chips the way the designs do", () => {
    expect(dueChip("2026-10-06", "en-GB", THURSDAY)).toEqual({ label: "2 days late", status: "overdue" });
    expect(dueChip("2026-10-07", "en-GB", THURSDAY)).toEqual({ label: "1 day late", status: "overdue" });
    expect(dueChip("2026-10-08", "en-GB", THURSDAY)).toEqual({ label: "Due today", status: "due-soon" });
    expect(dueChip("2026-10-09", "en-GB", THURSDAY)).toEqual({ label: "Due tomorrow", status: "due-soon" });
    expect(dueChip("2026-10-10T00:00:00.000Z", "en-GB", THURSDAY)).toEqual({ label: "Due Sat", status: "due-soon" });
    expect(dueChip("2026-11-03", "en-GB", THURSDAY)).toEqual({ label: "Due 3 Nov", status: "draft" });
    expect(shortWhen("2026-10-10", "en-GB", THURSDAY)).toBe("Sat");
  });

  it("finds the town in a site address", () => {
    expect(townFrom("48 Harbor Way, Portland, ME 04101")).toBe("Portland");
    expect(townFrom("220 Ridge Rd, Burlington, VT 05401")).toBe("Burlington");
    expect(townFrom("Baner Road, Pune 411045")).toBe("Pune");
    expect(townFrom("Outer Ring Road, Marathahalli, Bengaluru, Karnataka 560037")).toBe("Bengaluru");
    expect(townFrom("Baner Road, Pune, Maharashtra 411045")).toBe("Pune");
    expect(townFrom("12 High Street\nOxford\nOX1 4AA")).toBe("Oxford");
    expect(townFrom("Just a street")).toBeNull();
    expect(townFrom(null)).toBeNull();
  });

  it("says how long ago, long on iOS and compact on Android", () => {
    const tenMinutes = new Date(THURSDAY.getTime() - 10 * 60_000).toISOString();
    expect(relativeTime(tenMinutes, "en-GB", THURSDAY)).toBe("10 min ago");
    expect(relativeTime(tenMinutes, "en-GB", THURSDAY, true)).toBe("10m");
    expect(relativeTime(new Date(2026, 9, 7, 15).toISOString(), "en-GB", THURSDAY)).toBe("Yesterday");
    expect(relativeTime(new Date(2026, 9, 6, 15).toISOString(), "en-GB", THURSDAY)).toBe("Tue");
  });

  it("formats money in the business currency and locale, never with a trailing code", () => {
    expect(money("6420", { currency: "USD", locale: "en-US" })).toBe("$64.20");
    expect(money("125000", { currency: "INR", locale: "en-IN" })).toBe("₹1,250.00");
  });
});
