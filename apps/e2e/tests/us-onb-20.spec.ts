import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

test.describe("US-ONB-20", () => {
  test("the Template step lists seven templates; Professional services starts without jobs and sets up its categories", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("Name").fill("Owner");
    await page.getByLabel("Email").fill(`us-onb-20-${randomUUID()}@example.com`);
    await page.getByLabel("Password").fill("TestPassword123!");
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL("**/onboarding");
    await page.getByRole("button", { name: "Set up my business" }).click();
    await page.getByLabel(/^Business name/).fill("Mehta Rao Advisory");
    await page.getByRole("button", { name: "Continue" }).click();

    const radios = page.getByRole("radio");
    await expect(radios).toHaveCount(7);
    for (const label of [
      "Construction / Contracting",
      "Interior design & fit-out",
      "Trades (electrical, plumbing, HVAC)",
      "IT services & agency",
      "Professional services",
      "General Services",
      "Generic",
    ]) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(page.getByText("Call-outs, installations and maintenance contracts, with the field app for your crew.", { exact: false })).toBeVisible();

    await page.getByText("IT services & agency", { exact: true }).click();
    await expect(page.getByTestId("template-modules-note")).toHaveCount(0);
    await page.getByText("Professional services", { exact: true }).click();
    await expect(page.getByTestId("template-modules-note")).toHaveText("Jobs are switched off — turn them on in Settings › Modules if you need them.");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Skip to dashboard" }).click();
    await page.waitForURL("**/dashboard");

    expect(await (await page.request.get(`${API_URL}/org/modules`)).json()).toMatchObject({ jobsField: false });

    await page.goto("/expenses/categories");
    await expect(
      page.getByText(
        "Set up by the Professional services template: 6 new categories and accounts 5900 Research & Subscriptions and 6450 Professional Indemnity Insurance. These are ordinary categories — rename, remap or archive them like any other.",
      ),
    ).toBeVisible();
    for (const [name, account] of [
      ["Subscriptions & research", "5900"],
      ["Associates & subcontractors", "5100"],
      ["Professional fees", "6400"],
      ["Insurance", "6450"],
      ["Travel", "6300"],
      ["Office supplies", "6900"],
    ]) {
      await expect(page.getByText(name!, { exact: true }).locator("..")).toContainText(`${account} ·`);
    }
  });
});
