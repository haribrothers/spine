import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

test.describe("US-RPT-16", () => {
  test("enter opening balances on a cutover date; the difference shows as Opening Balance Adjustments", async ({ page }) => {
    await signUpNewOrg(page, { name: "Opening Owner", email: `e2e-rpt-16-${randomUUID()}@example.com`, password: "e2e-test-password-1" });

    await page.getByRole("button", { name: /Opening Owner/ }).last().click();
    await page.getByRole("menuitem", { name: "Settings" }).click();
    const settings = page.getByRole("dialog");
    await settings.getByTestId("settings-sections").getByRole("button", { name: "Opening balances" }).click();
    await expect(settings.getByTestId("settings-pane")).toContainText("Not started");
    await settings.getByRole("link", { name: "Bring in opening balances" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await expect(page.getByRole("heading", { name: "Opening balances" })).toBeVisible();
    await expect(page.getByText("Bring in what your business had on the day you start using Spine. Your old software's trial balance on that date has every figure you need.")).toBeVisible();
    const year = new Date().getFullYear();
    await expect(page.getByText(`Jan 1, ${year}`).first()).toBeVisible();
    await expect(page.getByText(`balances as of Dec 31, ${year - 1}`)).toBeVisible();

    const grid = page.getByTestId("opening-grid");
    const row = (name: string) => grid.getByTestId("opening-row").filter({ has: page.getByRole("cell", { name, exact: true }) });
    await expect(row("Accounts Receivable")).toContainText("From opening invoices · $0.00");
    await expect(row("Accounts Payable")).toContainText("From opening bills · $0.00");
    await expect(grid.getByRole("cell", { name: "Opening Balance Adjustments", exact: true })).toHaveCount(0);

    await page.getByRole("textbox", { name: "Bank Account debit" }).fill("21480.20");
    await page.getByRole("textbox", { name: "Fixed Assets debit" }).fill("36000");
    await page.getByRole("textbox", { name: "Accumulated Depreciation credit" }).fill("9600");
    await page.getByRole("textbox", { name: "Owner's Capital credit" }).fill("40000");
    await expect(page.getByTestId("opening-adjustment")).toContainText("$7,880.20");
    await expect(page.getByText("Opening Balance Adjustments $7,880.20 — your old books didn't balance, or a figure is missing. The difference sits in Opening Balance Adjustments until you fix it.")).toBeVisible();

    await page.getByRole("button", { name: "Save balances" }).click();
    await expect(page.getByText(`Saved. The Balance Sheet on Dec 31, ${year - 1} shows these balances.`)).toBeVisible();
    await page.reload();
    await expect(page.getByRole("textbox", { name: "Fixed Assets debit" })).toHaveValue("36000.00");
    await expect(page.getByText("Draft — not locked")).toBeVisible();

  });
});
