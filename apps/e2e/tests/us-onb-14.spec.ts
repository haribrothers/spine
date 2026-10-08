import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

test.describe("US-ONB-14", () => {
  test("Generic starts with Jobs switched off and says so; Settings says the template leaves modules alone", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("Name").fill("Owner");
    await page.getByLabel("Email").fill(`us-onb-14-${randomUUID()}@example.com`);
    await page.getByLabel("Password").fill("TestPassword123!");
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL("**/onboarding");
    await page.getByRole("button", { name: "Set up my business" }).click();
    await page.getByLabel(/^Business name/).fill("Harbour Cleaning");
    await page.getByRole("button", { name: "Continue" }).click();

    await page.getByText("Construction / Contracting").click();
    await expect(page.getByTestId("template-modules-note")).toHaveCount(0);
    await page.getByText("Generic", { exact: true }).click();
    await expect(page.getByTestId("template-modules-note")).toHaveText("Jobs are switched off — turn them on in Settings › Modules if you need them.");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Skip to dashboard" }).click();
    await page.waitForURL("**/dashboard");

    const modules = await (await page.request.get(`${API_URL}/org/modules`)).json();
    expect(modules).toMatchObject({ jobsField: false, leadsMeetings: true, approvals: true, recurring: true });
    await expect(page.locator('a[aria-label="Jobs"]')).toHaveCount(0);

    await page.getByRole("button", { name: /Owner/ }).last().click();
    await page.getByRole("menuitem", { name: "Settings" }).click();
    await page.getByRole("dialog").getByTestId("settings-sections").getByRole("button", { name: "Industry template" }).click();
    await expect(page.getByRole("dialog").getByTestId("template-modules-note")).toHaveText("Modules stay as they are. Change them in Settings › Modules.");
  });
});
