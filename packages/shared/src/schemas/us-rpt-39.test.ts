import { describe, expect, it } from "vitest";
import { defaultTallyGroup, putTallyMappingSchema, TALLY_GROUPS } from "./tally.ts";

describe("US-RPT-39", () => {
  it("pre-maps each account by money-account kind, code and type", () => {
    const cases: [Parameters<typeof defaultTallyGroup>[0], string][] = [
      [{ code: "1010", type: "asset", moneyAccountKind: "bank" }, "Bank Accounts"],
      [{ code: "1020", type: "asset", moneyAccountKind: "cash" }, "Cash-in-Hand"],
      [{ code: "2050", type: "liability", moneyAccountKind: "card" }, "Bank OD A/c"],
      [{ code: "1000", type: "asset" }, "Cash-in-Hand"],
      [{ code: "1200", type: "asset" }, "Duties & Taxes"],
      [{ code: "2100", type: "liability" }, "Duties & Taxes"],
      [{ code: "1500", type: "asset" }, "Fixed Assets"],
      [{ code: "1150", type: "asset" }, "Current Assets"],
      [{ code: "2500", type: "liability" }, "Loans (Liability)"],
      [{ code: "2200", type: "liability" }, "Current Liabilities"],
      [{ code: "3000", type: "equity" }, "Capital Account"],
      [{ code: "3200", type: "equity" }, "Reserves & Surplus"],
      [{ code: "4100", type: "income" }, "Sales Accounts"],
      [{ code: "4800", type: "income" }, "Indirect Incomes"],
      [{ code: "5000", type: "expense" }, "Direct Expenses"],
      [{ code: "6000", type: "expense" }, "Indirect Expenses"],
    ];
    for (const [account, group] of cases) expect(defaultTallyGroup(account), account.code).toBe(group);
  });

  it("offers Tally's predefined groups, and refuses any other", () => {
    for (const group of ["Bank Accounts", "Cash-in-Hand", "Duties & Taxes", "Sales Accounts", "Direct Expenses", "Indirect Expenses", "Fixed Assets", "Capital Account", "Loans (Liability)", "Current Liabilities", "Current Assets"]) {
      expect(TALLY_GROUPS).toContain(group);
    }
    const bad = putTallyMappingSchema.safeParse({ mappings: [{ accountId: "7d0f1d8e-9c63-4ec4-8a43-0e5d0e5b3a6b", tallyGroup: "Sales" }] });
    expect(bad.success).toBe(false);
    expect(bad.error?.issues[0]?.message).toBe("Choose one of Tally's groups.");
  });
});
