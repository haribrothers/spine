import { describe, expect, it } from "vitest";
import { filterRegisterRows, registerType, type MoneyAccount } from "@spine/shared";
import { bankLine, bankingQuery, bankingTotals, filterAccounts, parseBankingState } from "../app/(app)/banking/banking-list-state";
import { opensDrawer, parseRegisterState, rangeDates, registerQuery, sourceHref } from "../app/(app)/banking/register-state";
import { lineTab, orderEntries, searchLines } from "../app/(app)/banking/reconcile-state";
import { reconciliationSummary } from "../app/(app)/banking/reconciliation-report";

const account = (over: Partial<MoneyAccount>): MoneyAccount => ({
  id: "hdfc",
  accountId: "l1",
  code: "1010",
  kind: "bank",
  name: "HDFC Current",
  bankName: "HDFC Bank",
  last4: "4471",
  isDefault: true,
  archivedAt: null,
  balance: "84231050",
  lastReconciledOn: "2026-09-30",
  unreconciledCount: 14,
  ...over,
});
const accounts = [
  account({}),
  account({ id: "icici", name: "ICICI Operating", bankName: "ICICI Bank", last4: "2093", isDefault: false, balance: "21500000", lastReconciledOn: "2026-08-31", unreconciledCount: 6 }),
  account({ id: "petty", kind: "cash", name: "Petty cash", bankName: null, last4: null, isDefault: false, balance: "1245000", lastReconciledOn: null, unreconciledCount: 0 }),
  account({ id: "card", kind: "card", name: "Business card", last4: "4410", isDefault: false, balance: "3892000", unreconciledCount: 3 }),
  account({ id: "old", name: "Old SBI account", isDefault: false, archivedAt: "2026-05-01T00:00:00Z", unreconciledCount: 0 }),
];

describe("US-BANK-13 · see my accounts at a glance and act from them", () => {
  it("keeps the tab, type, card and search in the address", () => {
    const state = parseBankingState(new URLSearchParams("tab=archived&type=card&card=unreconciled&q=hdfc"));
    expect(state).toEqual({ tab: "archived", type: "card", unreconciled: true, q: "hdfc" });
    expect(bankingQuery(state)).toBe("tab=archived&type=card&card=unreconciled&q=hdfc");
    expect(bankingQuery(parseBankingState(new URLSearchParams("type=loans")))).toBe("");
  });

  it("filters by tab, type, the Not yet reconciled card and search", () => {
    const ids = (q: string) => filterAccounts(accounts, parseBankingState(new URLSearchParams(q))).map((a) => a.id);
    expect(ids("")).toEqual(["hdfc", "icici", "petty", "card"]);
    expect(ids("tab=archived")).toEqual(["old"]);
    expect(ids("type=card")).toEqual(["card"]);
    expect(ids("card=unreconciled")).toEqual(["hdfc", "icici", "card"]);
    expect(ids("q=2093")).toEqual(["icici"]);
  });

  it("adds up the cards over the active accounts, and names the bank line", () => {
    const totals = bankingTotals(accounts);
    expect(totals.cash).toBe(84231050n + 21500000n + 1245000n);
    expect(totals.cashLabel).toBe("3 accounts");
    expect(totals.owed).toBe(3892000n);
    expect(totals.unreconciled).toBe(23);
    expect(totals.unreconciledLabel).toBe("entries across 3 accounts");
    expect(totals.lastReconciled?.id).toBe("hdfc");
    expect(bankLine(accounts[0]!)).toBe("HDFC Bank · ••4471");
    expect(bankLine(accounts[2]!)).toBe("");
  });
});

describe("US-BANK-14 · work through an account's register", () => {
  it("keeps the range, type, show, search and page in the address", () => {
    const state = parseRegisterState(new URLSearchParams("range=custom&from=2026-09-01&to=2026-09-30&type=transfers&show=unreconciled&q=petty&page=2"));
    expect(state).toEqual({ range: "custom", from: "2026-09-01", to: "2026-09-30", type: "transfers", unreconciled: true, q: "petty", page: 2 });
    expect(registerQuery(state)).toBe("range=custom&from=2026-09-01&to=2026-09-30&type=transfers&show=unreconciled&q=petty&page=2");
    // This month is the default; a custom range without dates falls back to it.
    expect(registerQuery(parseRegisterState(new URLSearchParams("range=custom")))).toBe("");
    expect(parseRegisterState(new URLSearchParams("type=loans")).type).toBeNull();
  });

  it("works out each preset's dates", () => {
    const today = new Date(2026, 9, 12);
    const at = (range: string) => rangeDates(parseRegisterState(new URLSearchParams(`range=${range}`)), today);
    expect(at("this_month")).toEqual({ from: "2026-10-01", to: "2026-10-12" });
    expect(at("last_month")).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(at("this_quarter")).toEqual({ from: "2026-10-01", to: "2026-10-12" });
    expect(at("last_90")).toEqual({ from: "2026-07-15", to: "2026-10-12" });
    expect(at("this_year")).toEqual({ from: "2026-01-01", to: "2026-10-12" });
  });

  it("filters rows by type and search; money in and out and transfers open the drawer, documents their page", () => {
    const row = (sourceType: string, what: string, contact: string | null = null, reference: string | null = null) => ({ sourceType, what, contact: contact ? { id: "c", name: contact } : null, reference });
    const rows = [row("payment", "Payment PAY-0042", "Halcyon"), row("bank_transfer", "Transfer to Petty cash", null, "Petty cash top-up"), row("bank_transaction", "Money out — Bank charges"), row("tax_payment", "Tax payment")];
    expect(filterRegisterRows(rows, { type: "transfers" }).map((r) => r.what)).toEqual(["Transfer to Petty cash"]);
    expect(filterRegisterRows(rows, { type: "other" }).map((r) => r.what)).toEqual(["Tax payment"]);
    expect(filterRegisterRows(rows, { search: "halcyon" })).toHaveLength(1);
    expect(filterRegisterRows(rows, { search: "top-up" })).toHaveLength(1);
    expect(registerType("vendor_refund_delete")).toBe("vendor_payments");
    expect(opensDrawer("bank_transaction_delete")).toBe("bank_transaction");
    expect(opensDrawer("payment")).toBeNull();
    expect(sourceHref({ sourceType: "expense", sourceId: "e1" })).toBe("/expenses/e1");
    expect(sourceHref({ sourceType: "bank_transfer", sourceId: "t1" })).toBeNull();
  });
});

describe("US-BANK-16 · reconcile a long statement quickly", () => {
  const line = (id: string, status: "unmatched" | "matched" | "excluded", description: string, amount: string, date = "2026-10-10") => ({ id, status, description, reference: null as string | null, amount, date });

  it("puts each line under its tab and searches description, reference or amount", () => {
    expect(lineTab({ status: "unmatched" }, true)).toEqual(["todo", "suggested"]);
    expect(lineTab({ status: "unmatched" }, false)).toEqual(["todo"]);
    expect(lineTab({ status: "excluded" }, false)).toEqual(["excluded"]);
    const lines = [line("a", "unmatched", "NEFT CR HALCYON", "24000000"), line("b", "unmatched", "SMS ALERT CHGS", "-59000")];
    expect(searchLines(lines, "halcyon").map((l) => l.id)).toEqual(["a"]);
    expect(searchLines(lines, "590").map((l) => l.id)).toEqual(["b"]);
    expect(searchLines(lines, "")).toHaveLength(2);
  });

  it("puts entries of the same amount first, then the nearest dates", () => {
    const entry = (id: string, amount: string, date: string) => ({ journalLineId: id, date, sourceType: "payment", sourceId: id, what: id, contact: null, reference: null, amount, statementLineId: null });
    const entries = [entry("far", "100", "2026-09-01"), entry("near", "100", "2026-10-09"), entry("same", "24000000", "2026-10-02")];
    const ordered = orderEntries(entries, { amount: "24000000", date: "2026-10-10" }, "");
    expect(ordered.map((o) => [o.entry.journalLineId, o.sameAmount])).toEqual([
      ["same", true],
      ["near", false],
      ["far", false],
    ]);
    expect(orderEntries(entries, null, "near").map((o) => o.entry.journalLineId)).toEqual(["near"]);
  });
});

describe("US-BANK-17 · keep a reconciliation report", () => {
  it("splits what's outstanding into deposits and payments in the account's own sense", () => {
    const outstanding = [{ amount: "5650000" }, { amount: "-1240000" }] as never;
    expect(reconciliationSummary({ outstanding, moneyAccount: { id: "b", name: "HDFC Current", kind: "bank" } })).toEqual({ deposits: 5650000n, payments: 1240000n });
    // On a card, a debit is paying it off: the senses flip.
    expect(reconciliationSummary({ outstanding, moneyAccount: { id: "c", name: "Card", kind: "card" } })).toEqual({ deposits: 1240000n, payments: 5650000n });
  });
});
