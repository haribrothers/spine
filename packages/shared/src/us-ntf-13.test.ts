import { describe, expect, it } from "vitest";
import { digestDue, digestEnabledFor, digestFooter, digestSubject, digestTimeLabel, notificationPreferencesSchema } from "./schemas/digest.ts";

describe("US-NTF-13 · the daily digest's timing and wording", () => {
  // Monday 5 October 2026.
  const pref = { enabled: true, time: "07:00", days: "weekdays", lastSentOn: null as string | null };

  it("is due from 'Send at' on a chosen day, once", () => {
    expect(digestDue(pref, "2026-10-05", "06:45")).toBe(false);
    expect(digestDue(pref, "2026-10-05", "07:00")).toBe(true);
    expect(digestDue(pref, "2026-10-05", "09:30")).toBe(true);
    expect(digestDue(pref, "2026-10-05", "10:00")).toBe(false); // too late after a long outage: skip the day
    expect(digestDue({ ...pref, lastSentOn: "2026-10-05" }, "2026-10-05", "07:15")).toBe(false);
    expect(digestDue({ ...pref, enabled: false }, "2026-10-05", "07:15")).toBe(false);
  });

  it("skips weekends for Monday to Friday, not for every day", () => {
    expect(digestDue(pref, "2026-10-04", "07:15")).toBe(false); // Sunday
    expect(digestDue({ ...pref, days: "daily" }, "2026-10-04", "07:15")).toBe(true);
  });

  it("is on by default for Owners only (D-093)", () => {
    expect(digestEnabledFor("owner", null)).toBe(true);
    expect(digestEnabledFor("staff", null)).toBe(false);
    expect(digestEnabledFor("field", undefined)).toBe(false);
    expect(digestEnabledFor("owner", false)).toBe(false);
    expect(digestEnabledFor("staff", true)).toBe(true);
  });

  it("writes the subject and footer", () => {
    expect(digestSubject(6, "2026-10-04")).toBe("Your Spine day: 6 things need you · Sun 4 Oct");
    expect(digestSubject(1, "2026-10-05")).toBe("Your Spine day: 1 thing needs you · Mon 5 Oct");
    expect(digestFooter("owner", "Riverstone Builders")).toBe(
      "You get this daily digest because you're an owner of Riverstone Builders. Turn it off or change the time in Profile › Notifications.",
    );
    expect(digestFooter("field", "Riverstone Builders")).toContain("you're a member of Riverstone Builders");
  });

  it("accepts times on the quarter hour", () => {
    expect(notificationPreferencesSchema.safeParse({ digestEnabled: true, digestTime: "06:30", digestDays: "weekdays" }).success).toBe(true);
    expect(notificationPreferencesSchema.safeParse({ digestEnabled: true, digestTime: "06:31", digestDays: "weekdays" }).success).toBe(false);
    expect(notificationPreferencesSchema.safeParse({ digestEnabled: true, digestTime: "07:00", digestDays: "weekends" }).success).toBe(false);
    expect(digestTimeLabel("06:30")).toBe("6:30 AM");
    expect(digestTimeLabel("13:15")).toBe("1:15 PM");
  });
});
