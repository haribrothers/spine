import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

test.describe("US-SET-18", () => {
  test("a document's title, default terms and notes; new quotes start with them; GST keeps its title", async ({ page }) => {
    await signUpNewOrg(page, { name: "Terms Owner", email: `e2e-set-18-${randomUUID()}@example.com`, password: "e2e-test-password-1" });

    await page.goto("/dashboard?settings=documents");
    const pane = page.getByRole("dialog").getByTestId("settings-pane");
    await pane.getByRole("tab", { name: "Quotes" }).click();
    await pane.getByLabel("Title").fill("Quotation");
    await pane.getByLabel("Default terms").fill("Valid for 30 days.");
    await pane.getByLabel("Default notes").fill("Prices include delivery.");

    // Terms over 2,000 characters are refused.
    await pane.getByLabel("Default terms").fill("x".repeat(2001));
    await expect(pane.getByText("Keep terms under 2,000 characters.").first()).toBeVisible();
    await pane.getByLabel("Default terms").fill("Valid for 30 days.");
    await pane.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible();
    await page.keyboard.press("Escape");

    // A new quote starts with the defaults; they can be changed on the quote.
    await page.goto("/quotes/new");
    await expect(page.getByText("Valid for 30 days.")).toBeVisible();
    await expect(page.getByText("Prices include delivery.")).toBeVisible();

    // With GST on, an invoice's title is GST's.
    await page.request.put(`${API_URL}/org/tax/profile`, { headers: { "Idempotency-Key": randomUUID() }, data: { country: "IN" } });
    await page.request.put(`${API_URL}/org/tax/profile`, { headers: { "Idempotency-Key": randomUUID() }, data: { registrationNumber: "29AAACK0000A1ZK", stateCode: "29", legalName: "Kaveri" } });
    await page.goto("/dashboard?settings=documents");
    await expect(pane.getByLabel("Title")).toHaveValue("Tax Invoice");
    await expect(pane.getByLabel("Title")).toBeDisabled();
    await expect(pane.getByText("Set by your GST settings")).toBeVisible();
  });
});
