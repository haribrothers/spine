import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

test.describe("US-BANK-11", () => {
  test("see finished reconciliations; only the latest can be undone, which unreconciles its entries", async ({ page }) => {
    await signUpNewOrg(page, { name: "History Owner", email: `e2e-bank-11-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const call = async <T>(method: "post" | "put" | "get", path: string, data?: unknown): Promise<T> => {
      const res = await page.request[method](`${API_URL}${path}`, { data, headers: { "Idempotency-Key": randomUUID() } });
      expect(res.ok(), await res.text()).toBe(true);
      return (await res.json()) as T;
    };
    const bank = (await call<{ id: string; code: string }[]>("get", "/money-accounts")).find((a) => a.code === "1010")!;
    const grouped = await call<Record<string, { id: string; code: string }[]>>("get", "/org/accounts");
    const capital = Object.values(grouped).flat().find((a) => a.code === "3000")!.id;
    for (const [month, amount, closing] of [["2026-07", "100000", "100000"], ["2026-08", "50000", "150000"]] as const) {
      const entry = await call<{ id: string }>("post", "/bank-transactions", { moneyAccountId: bank.id, direction: "in", accountId: capital, amount, date: `${month}-10` });
      const imported = await page.request.post(`${API_URL}/money-accounts/${bank.id}/statement-imports`, {
        headers: { "Idempotency-Key": randomUUID() },
        multipart: {
          file: { name: `statement-${month}.csv`, mimeType: "text/csv", buffer: Buffer.from(`Date,Description,Amount\n${month}-10,CAPITAL ${month},${Number(amount) / 100}\n`) },
          mapping: JSON.stringify({ date: "Date", dateFormat: "YYYY-MM-DD", description: "Description", amountMode: "single", amount: "Amount" }),
        },
      });
      expect(imported.ok()).toBe(true);
      const view = await call<{ id: string; statementLines: { id: string }[]; entries: { sourceId: string; journalLineId: string }[] }>("post", "/bank-reconciliations", { moneyAccountId: bank.id, statementEndDate: `${month}-28`, statementClosingBalance: closing });
      await call("put", `/bank-reconciliations/${view.id}/matches`, { matches: [{ statementLineId: view.statementLines[0]!.id, journalLineIds: [view.entries.find((e) => e.sourceId === entry.id)!.journalLineId] }] });
      await call("post", `/bank-reconciliations/${view.id}/finish`);
    }

    await page.goto(`/banking/${bank.id}`);
    await page.getByRole("link", { name: "Reconciliations" }).click();
    await expect(page.getByRole("heading", { name: "Reconciliations" })).toBeVisible();
    await expect(page.getByText("Every finished reconciliation of Bank Account. Only the latest can be undone.")).toBeVisible();
    const rows = page.getByRole("row");
    await expect(rows.filter({ hasText: "Aug 28, 2026" })).toContainText("$1,500.00");
    await expect(rows.filter({ hasText: "Aug 28, 2026" })).toContainText("Latest");
    await expect(rows.filter({ hasText: "Aug 28, 2026" })).toContainText("History Owner");
    await expect(rows.filter({ hasText: "Jul 28, 2026" })).toContainText("Undo the later reconciliations first.");
    await expect(rows.filter({ hasText: "Jul 28, 2026" }).getByRole("button", { name: /Undo/ })).toHaveCount(0);

    await page.getByRole("button", { name: "Undo the reconciliation to Aug 28, 2026" }).click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm).toContainText("Undo this reconciliation?");
    await expect(confirm).toContainText("Statement to Aug 28, 2026 · 1 entries. Its entries go back to unreconciled; nothing is deleted.");
    await confirm.getByRole("button", { name: "Undo reconciliation" }).click();
    await expect(page.getByText("Reconciliation undone").first()).toBeVisible();
    await expect(rows.filter({ hasText: "Jul 28, 2026" })).toContainText("Latest");
    await expect(rows.filter({ hasText: "Aug 28, 2026" })).toHaveCount(0);

    // July's entry keeps its tick; August's lost it.
    const register = await call<{ rows: { date: string; reconciled: boolean }[] }>("get", `/money-accounts/${bank.id}/register?from=2026-07-01&to=2026-08-31`);
    expect(register.rows.map((r) => [r.date, r.reconciled])).toEqual([
      ["2026-07-10", true],
      ["2026-08-10", false],
    ]);
  });
});
