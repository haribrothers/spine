import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const notFound = (page: Page) => page.getByTestId("not-found");

test.describe("US-OPS-11 · show a helpful page for a missing page", () => {
  test("an unknown address and a record not in my organisation show the 404 page inside the app shell", async ({ page }) => {
    await signUpNewOrg(page, { name: "Priya Raman", email: `e2e-ops-11-${randomUUID()}@example.com`, password: "e2e-test-password-1" });

    await page.goto("/dashboard");
    await page.goto("/no-such-page/here");
    await expect(notFound(page)).toContainText("404");
    await expect(page.getByRole("heading", { name: "We can't find that page" })).toBeVisible();
    await expect(notFound(page)).toContainText("Financial documents are never deleted — if you followed a link to an invoice, check its number in Invoices.");
    // Inside the shell: the navigation is still there.
    await expect(page.getByRole("link", { name: "Invoices" }).first()).toBeVisible();

    await page.getByRole("button", { name: "Go back" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    for (const path of [`/invoices/${randomUUID()}`, "/invoices/not-an-invoice", `/contacts/${randomUUID()}`]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: "We can't find that page" })).toBeVisible();
    }
    await page.getByRole("link", { name: "Go to dashboard" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("signed out, an unknown address goes to the login page first", async ({ page }) => {
    await page.goto("/no-such-page");
    await expect(page).toHaveURL(/\/login\?next=%2Fno-such-page$/);
  });
});
