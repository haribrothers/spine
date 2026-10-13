import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const fmt = (d: Date) => d.toLocaleDateString("en-US");

test.describe("US-QUO-36", () => {
  test("Settings › Documents sets how long new quotes are valid; the builder starts there and offers quick picks", async ({ page }) => {
    await signUpNewOrg(page, { name: "Quote Owner", email: `e2e-quo-36-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const plus = (days: number) => {
      const d = new Date();
      d.setDate(d.getDate() + days);
      return fmt(d);
    };

    await page.goto("/quotes/new");
    await expect(page.getByRole("group", { name: "Valid for" }).getByRole("button", { name: "+30 days" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText(plus(30))).toBeVisible();

    await page.goto("/dashboard?settings=documents");
    const pane = page.getByRole("dialog").getByTestId("settings-pane");
    await pane.getByRole("tab", { name: "Quotes" }).click();
    await expect(pane.getByLabel("Quotes valid for")).toHaveValue("30");
    await pane.getByLabel("Quotes valid for").fill("45");
    await pane.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible();
    await page.keyboard.press("Escape");

    await page.goto("/quotes/new");
    await expect(page.getByText(plus(45))).toBeVisible();
    await page.getByRole("button", { name: "+15 days" }).click();
    await expect(page.getByText(plus(15))).toBeVisible();
    await expect(page.getByRole("button", { name: "+15 days" })).toHaveAttribute("aria-pressed", "true");
  });
});
