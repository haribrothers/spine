import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";
import { contact, linkToken } from "./quote-seed";

test.describe("US-QUO-30", () => {
  test("a quote's title shows in the list, on its page and on the customer's page", async ({ page }) => {
    await signUpNewOrg(page, { name: "Quote Owner", email: `e2e-quo-30-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    await contact(page, "Ananya Rao");

    await page.goto("/quotes/new");
    await page.getByLabel("Title (optional)").fill("Bathroom refit — 2nd floor");
    await page.getByRole("combobox", { name: "Contact" }).click();
    await page.getByRole("option", { name: "Ananya Rao" }).click();
    await page.getByRole("combobox", { name: "Item" }).fill("Tiling");
    await page.getByLabel("Unit price").fill("950.00");
    await page.getByRole("button", { name: "Save as draft" }).click();
    await expect(page.getByTestId("quote-title")).toHaveText("Bathroom refit — 2nd floor");
    const id = page.url().split("/quotes/")[1]!.split(/[?#]/)[0]!;

    await page.goto("/quotes");
    await expect(page.getByRole("row", { name: /Draft/ })).toContainText("Bathroom refit — 2nd floor");

    await page.goto(`/quotes/${id}`);
    await page.getByRole("button", { name: "Send quote" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Send quote" }).click();
    await expect(page.getByRole("button", { name: "Copy customer link" })).toBeVisible();
    await page.goto(`/quote/${encodeURIComponent(await linkToken(page, id))}`);
    await expect(page.getByTestId("public-quote-title")).toHaveText("Bathroom refit — 2nd floor");
  });
});
