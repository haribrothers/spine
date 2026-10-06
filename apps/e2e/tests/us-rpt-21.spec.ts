import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

test.describe("US-RPT-21", () => {
  test("reverse a journal with a reason; Reverse goes; Copy to new journal posts the lines again", async ({ page }) => {
    await signUpNewOrg(page, { name: "Reverse Owner", email: `e2e-rpt-21-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const grouped = (await (await page.request.get(`${API_URL}/org/accounts`)).json()) as Record<string, { id: string; code: string }[]>;
    const code = (c: string) => Object.values(grouped).flat().find((a) => a.code === c)!.id;
    const res = await page.request.post(`${API_URL}/manual-journals`, {
      headers: { "Idempotency-Key": randomUUID() },
      data: { date: "2026-09-30", reason: "Depreciation for September", lines: [{ accountId: code("6900"), description: "Plant — September", debit: "65000", credit: "0" }, { accountId: code("1500"), description: "Plant — September", debit: "0", credit: "65000" }] },
    });
    expect(res.ok()).toBe(true);
    const journal = (await res.json()) as { id: string };

    await page.goto(`/journals/${journal.id}`);
    await expect(page.getByRole("heading", { name: "JNL-0001" })).toBeVisible();
    await page.getByRole("button", { name: "Reverse", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Reverse JNL-0001" });
    await expect(dialog).toContainText("A reversing entry mirrors every line. The journal stays in the history as Reversed.");
    await expect(dialog.getByRole("button", { name: "Reverse journal" })).toBeDisabled();
    await dialog.getByRole("textbox", { name: "Reason" }).fill("Wrong account: should have been 1510");
    await dialog.getByRole("button", { name: "Reverse journal" }).click();

    await expect(page.getByText("Reversed", { exact: true })).toBeVisible();
    await expect(page.getByTestId("journal-reversal")).toContainText(/Reversed on .+ by Reverse Owner/);
    await expect(page.getByTestId("journal-reversal")).toContainText("Wrong account: should have been 1510");
    await expect(page.getByRole("button", { name: "Reverse", exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: "Copy to new journal" }).click();
    const copy = page.getByRole("dialog", { name: "New journal" });
    await expect(copy.getByRole("textbox", { name: "Reason" })).toHaveValue("Depreciation for September");
    await expect(copy.getByRole("combobox", { name: "Account, line 2" })).toHaveText(/1500 · Fixed Assets/);
    await copy.getByRole("combobox", { name: "Account, line 2" }).click();
    await page.keyboard.type("1510");
    await page.getByRole("option", { name: "1510 · Accumulated Depreciation" }).click();
    await copy.getByRole("button", { name: "Post journal" }).click();
    await expect(page.getByRole("heading", { name: "JNL-0002" })).toBeVisible();
    await expect(page.getByTestId("journal-detail-lines")).toContainText("1510 · Accumulated Depreciation");

    await page.goto("/journals");
    await expect(page.getByTestId("journals-table").getByRole("row").filter({ hasText: "JNL-0001" })).toContainText("Reversed");
  });
});
