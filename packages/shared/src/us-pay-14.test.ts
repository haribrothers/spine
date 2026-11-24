import { describe, expect, it } from "vitest";
import { describeHistoryEntry } from "./history-format.ts";
import { sendStatementSchema, STATEMENT_MODE_OPTIONS, STATEMENT_PERIOD_OPTIONS, statementPeriodRange } from "./schemas/statements.ts";

/** US-PAY-14 — the statement dialog's choices and checks. */
describe("US-PAY-14 · customer statements", () => {
  it("offers the periods and what to show", () => {
    expect(STATEMENT_PERIOD_OPTIONS.map((o) => o.label)).toEqual(["Last 30 days", "Last 90 days", "This year", "Custom"]);
    expect(STATEMENT_MODE_OPTIONS.map((o) => o.label)).toEqual(["Open invoices only", "All activity"]);
  });

  it("works out each period's dates, ending today", () => {
    expect(statementPeriodRange("last_30", "2026-10-04")).toEqual({ from: "2026-09-05", to: "2026-10-04" });
    expect(statementPeriodRange("last_90", "2026-10-04")).toEqual({ from: "2026-07-07", to: "2026-10-04" });
    expect(statementPeriodRange("this_year", "2026-10-04")).toEqual({ from: "2026-01-01", to: "2026-10-04" });
  });

  it("needs an address to send to and an end after the start", () => {
    const base = { from: "2026-07-06", to: "2026-10-04", mode: "all", email: "ap@example.com" };
    expect(sendStatementSchema.safeParse(base).success).toBe(true);
    expect(sendStatementSchema.safeParse({ ...base, email: "nope" }).error?.issues[0]?.message).toBe("Enter an email address to send the statement to.");
    expect(sendStatementSchema.safeParse({ ...base, from: "2026-10-05" }).error?.issues[0]?.message).toBe("Pick an end date after the start date.");
  });

  it("history says who sent it and to whom", () => {
    const entry = { action: "statement_sent", entityType: "contact", actorName: "Sarah Mendes", changes: [{ field: "email", from: null, to: "ap@example.com" }] };
    expect(describeHistoryEntry(entry, "this contact", "contact")).toBe("Sarah Mendes sent a statement to ap@example.com");
  });
});
