import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./axe";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

test.describe("US-ONB-18", () => {
  test.describe("from the welcome screen", () => {
    test.use({ timezoneId: "Asia/Kolkata" });

    test("guesses India from the time zone and loads an Indian interior design business", async ({ page }) => {
      test.setTimeout(180_000);
      await page.goto("/signup");
      await page.getByLabel("Name").fill("Demo Owner");
      await page.getByLabel("Email").fill(`e2e-onb-18-${randomUUID()}@example.com`);
      await page.getByLabel(/^Password/).fill("e2e-test-password-1");
      await page.getByLabel(/^Confirm password/).fill("e2e-test-password-1");
      await page.getByRole("button", { name: "Create account" }).click();
      await page.waitForURL("**/onboarding");

      await page.getByRole("button", { name: "Just show me around (use defaults)" }).click();
      const dialog = page.getByRole("dialog", { name: "Explore a demo business" });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole("combobox", { name: "Country" })).toHaveText("India (GST)");
      await expect(dialog.getByRole("combobox", { name: "Industry" })).toHaveText("Construction / Contracting");
      await expect(dialog.getByText("You'll see Shilpa Buildcon.")).toBeVisible();
      await expect(dialog.getByText("Your tax country, currency and industry template change to the demo's.", { exact: false })).toBeVisible();
      // Let the dialog finish opening: mid-animation colours aren't what anyone reads.
      await dialog.evaluate((el) => Promise.all((el as unknown as { getAnimations(o: { subtree: boolean }): { finished: Promise<unknown> }[] }).getAnimations({ subtree: true }).map((a) => a.finished)));
      await expectNoAxeViolations(page);

      await dialog.getByRole("combobox", { name: "Industry" }).click();
      await page.getByRole("option", { name: "Interior design & fit-out" }).click();
      await expect(dialog.getByText("You'll see Tarang Interiors.")).toBeVisible();
      await dialog.getByRole("button", { name: "Load demo business" }).click();
      await page.waitForURL("**/dashboard", { timeout: 90_000 });

      await page.goto("/invoices");
      await expect(page.getByText(/₹/).first()).toBeVisible();
      await page.goto("/dashboard?settings=data");
      const pane = page.getByRole("dialog").getByTestId("settings-pane");
      await expect(pane.getByTestId("demo-loaded")).toHaveText("Tarang Interiors · India (GST) · Interior design & fit-out");
      await expect(pane.getByRole("button", { name: "Load demo data" })).toHaveCount(0);
    });
  });

  test("with records of its own, the business keeps its country and picks only the industry", async ({ page }) => {
    test.setTimeout(180_000);
    await signUpNewOrg(page, { name: "Own Owner", email: `e2e-onb-18b-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const post = async <T>(path: string, data?: unknown) => (await (await page.request.post(`${API_URL}${path}`, { headers: { "Idempotency-Key": randomUUID() }, data })).json()) as T;
    const contact = await post<{ id: string }>("/contacts", { type: "customer", isCompany: true, name: "Own customer" });
    const invoice = await post<{ id: string }>("/invoices", { contactId: contact.id, currency: "USD", lines: [{ type: "item", name: "Advice", quantity: 1, unitPriceAmount: "10000" }] });
    await post(`/invoices/${invoice.id}/issue`);

    await page.goto("/dashboard?settings=data");
    const pane = page.getByRole("dialog").getByTestId("settings-pane");
    await pane.getByRole("button", { name: "Load demo data" }).click();
    const dialog = page.getByRole("dialog", { name: "Explore a demo business" });
    await expect(dialog.getByRole("combobox", { name: "Country" })).toBeDisabled();
    await expect(dialog.getByRole("combobox", { name: "Country" })).toHaveText("United States (sales tax)");
    await expect(dialog.getByText("Demo data uses your business's country: United States (sales tax).")).toBeVisible();
    await dialog.getByRole("combobox", { name: "Industry" }).click();
    await page.getByRole("option", { name: "Trades (electrical, plumbing, HVAC)" }).click();
    await dialog.getByRole("button", { name: "Load demo business" }).click();
    await expect(pane.getByTestId("demo-loaded")).toHaveText("BrightLine Electric & Air · United States (sales tax) · Trades (electrical, plumbing, HVAC)", { timeout: 90_000 });
  });
});
