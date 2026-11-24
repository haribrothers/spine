import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";
import { accept, contact, linkToken, quote, send } from "./quote-seed";

test.describe("US-QUO-31", () => {
  test("the page leads with the number and one next step for the status; lines are a table; the customer link is copied", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await signUpNewOrg(page, { name: "Quote Owner", email: `e2e-quo-31-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const c = await contact(page, "Ananya Rao");
    const draft = await quote(page, c.id, { title: "Bathroom refit", validDays: 30, lines: [{ name: "Tiling", price: "95000", quantity: 2, description: "Vitrified tiles" }] });

    await page.goto(`/quotes/${draft.id}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Draft quote");
    await expect(page.getByTestId("quote-meta")).toContainText("Ananya Rao");
    await expect(page.getByTestId("quote-meta")).toContainText("in 30 days");
    const actions = page.getByTestId("quote-actions");
    await expect(actions.getByRole("button", { name: "Send quote" })).toBeVisible();
    await expect(actions.getByRole("link", { name: "Edit" })).toBeVisible();
    const lines = page.getByTestId("quote-lines");
    await expect(lines.getByRole("columnheader")).toHaveText(["Item", "Qty", "Rate", "Amount"]);
    await expect(lines.getByRole("row", { name: /Tiling/ })).toContainText("Vitrified tiles");
    await expect(page.getByTestId("quote-totals")).not.toContainText("Discount");
    await expect(page.getByText("Back to quotes")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Quotes" }).first()).toBeVisible();

    const sent = await send(page, draft.id);
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(sent.number);
    await actions.getByRole("button", { name: "Copy customer link" }).click();
    await expect(page.getByText("It works for 30 days, or until you revise the quote.", { exact: true })).toBeVisible();
    expect(await page.evaluate<string>("navigator.clipboard.readText()")).toMatch(/\/quote\/.+/);

    await accept(page, await linkToken(page, draft.id));
    await page.reload();
    await expect(actions.getByRole("button", { name: "Convert to invoice" })).toBeVisible();
    await expect(actions.getByRole("button", { name: "Copy customer link" })).toHaveCount(0);
  });
});
