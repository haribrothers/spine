import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MoneyAccount, ReconciliationEntry } from "@spine/shared";

const state = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../lib/api-client", async (original) => ({ ...(await original<typeof import("../lib/api-client")>()), apiClient: { get: state.get, post: vi.fn() } }));

import { aiCreateLabel, orderEntries } from "../app/(app)/banking/reconcile-state";
import { MoneyInOutDialog } from "../app/(app)/banking/money-in-out-dialog";

const entry = (journalLineId: string, date: string, amount: string, what: string): ReconciliationEntry => ({ journalLineId, date, sourceType: "payment", sourceId: journalLineId, what, contact: null, reference: null, amount, statementLineId: null });
const entries = [entry("j-rao", "2026-10-02", "2360000", "Payment PAY-0036"), entry("j-ananya", "2026-10-07", "2360000", "Payment PAY-0040"), entry("j-other", "2026-10-07", "1000", "Money in")];
const line = { amount: "2360000", date: "2026-10-07" };

describe("US-AI-14 · AI's suggestion in the entries panel", () => {
  it("puts AI's suggested entry first, marked, before the same amount and the nearest dates", () => {
    expect(orderEntries(entries, line, "").map((x) => [x.entry.journalLineId, x.sameAmount, x.ai])).toEqual([
      ["j-ananya", true, false],
      ["j-rao", true, false],
      ["j-other", false, false],
    ]);
    expect(orderEntries(entries, line, "", ["j-rao", "j-ananya"]).map((x) => [x.entry.journalLineId, x.ai])).toEqual([
      ["j-rao", true],
      ["j-ananya", false],
      ["j-other", false],
    ]);
    // Without a selected line, nothing is ranked or marked.
    expect(orderEntries(entries, null, "", ["j-rao"]).every((x) => !x.ai)).toBe(true);
  });

  it("names what AI suggests creating", () => {
    expect(aiCreateLabel({ kind: "money", accountId: "a", accountName: "Bank charges", contactId: "c", contactName: "HDFC Bank", reason: "x" })).toBe("Bank charges · HDFC Bank");
    expect(aiCreateLabel({ kind: "payment", accountId: null, accountName: null, contactId: "c", contactName: "Maple Ridge", reason: "x" })).toBe("Customer payment · Maple Ridge");
    expect(aiCreateLabel({ kind: "vendor_payment", accountId: null, accountName: null, contactId: "c", contactName: "HDFC Bank", reason: "x" })).toBe("Vendor payment · HDFC Bank");
  });
});

describe("US-AI-14 · Create opens prefilled with AI's suggestion", () => {
  it("Other money out starts with the suggested category and contact, each marked Suggested by AI", async () => {
    state.get.mockImplementation(async (path: string) => {
      if (path === "/org/accounts") return { expense: [{ id: "acc-6900", code: "6900", name: "Bank charges", type: "expense" }, { id: "acc-6100", code: "6100", name: "Fuel", type: "expense" }] };
      if (path.startsWith("/contacts")) return [{ id: "c-hdfc", name: "HDFC Bank", archivedAt: null }];
      return [];
    });
    const bank = { id: "bank-1", name: "HDFC Current", accountId: "acc-1010", isDefault: true, archivedAt: null } as unknown as MoneyAccount;
    render(
      <MoneyInOutDialog
        direction="out"
        open
        onOpenChange={() => {}}
        accounts={[bank]}
        currency="INR"
        onRecorded={() => {}}
        prefill={{ amount: 59000n, date: "2026-10-12", moneyAccountId: "bank-1", moneyAccountName: "HDFC Current", reference: "SMS ALERT CHGS", description: "SMS ALERT CHGS", ai: { categoryAccountId: "acc-6900", contactId: "c-hdfc" } }}
      />,
    );
    await waitFor(() => expect(screen.getAllByTestId("ai-suggested")).toHaveLength(2));
  });
});
