import { describe, expect, it } from "vitest";
import { DEFAULT_INVOICE_REMINDERS, invoiceRemindersSchema, reminderDays, REMINDER_OFFSET_OPTIONS } from "./schemas/reminders.ts";

/** US-INV-18 (D-091) — the reminder schedule. */
describe("US-INV-18 · reminder settings", () => {
  it("offers 3 days before, on the due date, 7 and 14 days after", () => {
    expect(REMINDER_OFFSET_OPTIONS.map((o) => o.label)).toEqual(["3 days before the due date", "On the due date", "7 days after the due date", "14 days after the due date"]);
  });

  it("is off by default, with the due date, +7 and +14 ticked at 9:00", () => {
    expect(DEFAULT_INVOICE_REMINDERS).toMatchObject({ enabled: false, offsets: [0, 7, 14], sendAt: "09:00" });
  });

  it("refuses turning reminders on with nothing ticked", () => {
    const result = invoiceRemindersSchema.safeParse({ ...DEFAULT_INVOICE_REMINDERS, enabled: true, offsets: [] });
    expect(result.error?.issues[0]?.message).toBe("Pick at least one reminder.");
    expect(invoiceRemindersSchema.safeParse({ ...DEFAULT_INVOICE_REMINDERS, enabled: false, offsets: [] }).success).toBe(true);
  });

  it("repeats every 14 days after the last offset, up to 3 more times", () => {
    expect(reminderDays({ offsets: [-3, 0, 7, 14], repeatEvery: 14, repeatMax: 3 })).toEqual([-3, 0, 7, 14, 28, 42, 56]);
    expect(reminderDays({ offsets: [0, 7], repeatEvery: null, repeatMax: null })).toEqual([0, 7]);
  });
});
