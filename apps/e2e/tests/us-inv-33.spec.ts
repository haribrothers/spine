import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";
import { api, contact } from "./quote-seed";
import { invoice, issue } from "./invoice-seed";

test.describe("US-INV-33", () => {
  test("invoices are due on my terms: the setting, the builder's picks, and issuing without a date", async ({ page }) => {
    await signUpNewOrg(page, { name: "Invoice Owner", email: `e2e-inv-33-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const c = await contact(page, "Ananya Rao");

    await page.goto("/dashboard?settings=documents");
    const pane = page.getByRole("dialog").getByTestId("settings-pane");
    await pane.getByRole("tab", { name: "Invoices" }).click();
    await expect(pane.getByLabel("Invoices due in")).toHaveValue("30");
    await pane.getByLabel("Invoices due in").fill("15");
    await pane.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible();
    await page.keyboard.press("Escape");

    await page.goto("/invoices/new");
    const picks = page.getByRole("group", { name: "Due in" });
    await expect(picks.getByRole("button", { name: "+15 days" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Your terms: due 15 days after issue (Settings › Documents).")).toBeVisible();
    await picks.getByRole("button", { name: "On receipt" }).click();
    await expect(picks.getByRole("button", { name: "On receipt" })).toHaveAttribute("aria-pressed", "true");
    await expect(picks.getByRole("button", { name: "+15 days" })).toHaveAttribute("aria-pressed", "false");

    // Issued without a due date: due its issue date plus the terms.
    const draft = await invoice(page, c.id, { issueDays: -3 });
    const issued = await issue(page, draft.id);
    const expected = new Date(`${issued.issueDate!.slice(0, 10)}T00:00:00Z`);
    expected.setUTCDate(expected.getUTCDate() + 15);
    expect(issued.dueDate?.slice(0, 10)).toBe(expected.toISOString().slice(0, 10));
    await api(page, "PUT", "/org/settings/document_layout", { value: {} });
  });
});
