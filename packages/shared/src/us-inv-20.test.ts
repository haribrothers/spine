import { describe, expect, it } from "vitest";
import {
  createRecurringInvoiceSchema,
  describeRepeats,
  occurrenceAfter,
  occurrenceOnOrAfter,
  RECURRING_FREQUENCY_OPTIONS,
  RECURRING_MODE_OPTIONS,
  recurringDayOptions,
  scheduleFinished,
} from "./schemas/recurring-invoices.ts";

const valid = {
  name: "Monthly maintenance — Hotel lobby",
  contactId: "6f1c1d2e-8a8b-4c3d-9e0f-1a2b3c4d5e6f",
  currency: "USD",
  frequency: "monthly",
  dayRule: "1",
  startsOn: "2026-11-01",
  dueDays: 14,
  mode: "issue_and_email",
  lines: [{ name: "Monthly maintenance visit", quantity: 1, unitPriceAmount: "125000" }],
};

/** US-INV-20 (D-092) — the recurring invoice form and schedule maths. */
describe("US-INV-20 · recurring invoice schedule", () => {
  it("offers Weekly, Monthly, Every 3 months and Yearly, and the two 'When it runs' choices", () => {
    expect(RECURRING_FREQUENCY_OPTIONS.map((o) => o.label)).toEqual(["Weekly", "Monthly", "Every 3 months", "Yearly"]);
    expect(RECURRING_MODE_OPTIONS.map((o) => o.label)).toEqual(["Issue the invoice and email it to the customer", "Create a draft for me to review"]);
  });

  it("'On' is a weekday for weekly schedules, otherwise the 1st–28th or the last day", () => {
    expect(recurringDayOptions("weekly").map((o) => o.label)).toEqual(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]);
    const monthly = recurringDayOptions("monthly");
    expect(monthly[0]!.label).toBe("1st of the month");
    expect(monthly[21]!.label).toBe("22nd of the month");
    expect(monthly.at(-1)).toEqual({ value: "last", label: "Last day of the month" });
  });

  it("describes the schedule the way the list shows it", () => {
    expect(describeRepeats("monthly", "1")).toBe("Monthly · 1st");
    expect(describeRepeats("quarterly", "15")).toBe("Every 3 months · 15th");
    expect(describeRepeats("monthly", "last")).toBe("Monthly · last day");
    expect(describeRepeats("weekly", "1")).toBe("Weekly · Monday");
  });

  it("works out the first and following run dates", () => {
    expect(occurrenceOnOrAfter({ frequency: "monthly", dayRule: "1", startsOn: "2026-10-05" }, "2026-10-05")).toBe("2026-11-01");
    expect(occurrenceOnOrAfter({ frequency: "monthly", dayRule: "last", startsOn: "2026-02-01" }, "2026-02-01")).toBe("2026-02-28");
    expect(occurrenceAfter({ frequency: "monthly", dayRule: "last", startsOn: "2026-02-01" }, "2026-02-28")).toBe("2026-03-31");
    // Every 3 months counts from the start date's month.
    const quarterly = { frequency: "quarterly" as const, dayRule: "15", startsOn: "2026-10-01" };
    expect(occurrenceOnOrAfter(quarterly, "2026-10-01")).toBe("2026-10-15");
    expect(occurrenceAfter(quarterly, "2026-10-15")).toBe("2027-01-15");
    // Weekly: 2026-10-05 is a Monday.
    expect(occurrenceOnOrAfter({ frequency: "weekly", dayRule: "1", startsOn: "2026-10-05" }, "2026-10-05")).toBe("2026-10-05");
    expect(occurrenceAfter({ frequency: "weekly", dayRule: "5", startsOn: "2026-10-05" }, "2026-10-09")).toBe("2026-10-16");
    expect(occurrenceAfter({ frequency: "yearly", dayRule: "1", startsOn: "2026-11-01" }, "2026-11-01")).toBe("2027-11-01");
  });

  it("finishes on its end date or after its number of invoices", () => {
    expect(scheduleFinished("2027-01-01", { endsOn: "2026-12-31" }, 0)).toBe(true);
    expect(scheduleFinished("2026-12-01", { endsOn: "2026-12-31" }, 0)).toBe(false);
    expect(scheduleFinished("2026-12-01", { maxCount: 3 }, 3)).toBe(true);
    expect(scheduleFinished("2026-12-01", {}, 300)).toBe(false);
  });

  it("checks the form: a line, a valid day, an end date after the start", () => {
    expect(createRecurringInvoiceSchema.safeParse(valid).success).toBe(true);
    expect(createRecurringInvoiceSchema.safeParse({ ...valid, lines: [] }).error?.issues[0]?.message).toBe("Add at least one line.");
    expect(createRecurringInvoiceSchema.safeParse({ ...valid, dayRule: "31" }).error?.issues[0]?.message).toBe("Pick which day it runs on.");
    expect(createRecurringInvoiceSchema.safeParse({ ...valid, endsOn: "2026-10-01" }).error?.issues[0]?.message).toBe("Pick an end date after the start date.");
  });
});
