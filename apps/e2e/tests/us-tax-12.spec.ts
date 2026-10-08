import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";
// A Karnataka GSTIN with a valid check character, and one with a wrong one.
const GSTIN = "29AAACK0000A1ZK";
const WRONG = "29AAACK0000A1ZL";

test.describe("US-TAX-12", () => {
  test("GST details in the wizard and Settings › GST; a registered customer needs a valid GSTIN and gets its state from it", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("Name").fill("Anita");
    await page.getByLabel("Email").fill(`e2e-tax-12-${randomUUID()}@example.com`);
    await page.getByLabel("Password").fill("e2e-test-password-1");
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL("**/onboarding");
    await page.getByRole("button", { name: "Set up my business" }).click();
    await page.getByLabel(/^Business name/).fill("Kaveri Interiors");
    const country = page.getByRole("radiogroup", { name: "Tax country" });
    for (let i = 0; i < 6 && !(await country.isVisible()); i++) {
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await page.waitForTimeout(300);
    }
    await country.getByText("India (GST)", { exact: true }).click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();

    // The wizard's GST details: the GSTIN is checked, and its state fills in.
    await expect(page.getByText("Your GST registration. Spine uses your state to pick intra- or inter-state tax.")).toBeVisible();
    await page.getByLabel("GSTIN").fill(WRONG);
    await expect(page.getByText("This GSTIN isn't valid — check the 15 characters.")).toBeVisible();
    await page.getByLabel("GSTIN").fill(GSTIN);
    await expect(page.getByText("This GSTIN isn't valid — check the 15 characters.")).toHaveCount(0);
    await expect(page.getByRole("combobox", { name: "State" })).toHaveText("Karnataka (29)");
    await page.getByLabel("Legal name").fill("Kaveri Interiors Private Limited");
    await page.getByLabel("Trade name").fill("Kaveri Interiors");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.getByText("Your GST registration.")).toHaveCount(0);
    await page.getByRole("button", { name: "Skip to dashboard" }).click();
    await page.waitForURL("**/dashboard");

    // Settings › GST shows what was saved; a GSTIN from another state is refused.
    await page.goto("/dashboard?settings=gst");
    const pane = page.getByRole("dialog").getByTestId("settings-pane");
    await expect(pane.getByLabel("GSTIN")).toHaveValue(GSTIN);
    await expect(pane.getByLabel("Legal name")).toHaveValue("Kaveri Interiors Private Limited");
    await expect(pane.getByText("Spine prepares GST invoices and a GSTR-1 file to upload. It never files your return or connects to the GST portal.")).toBeVisible();
    await pane.getByRole("combobox", { name: "State" }).click();
    await page.getByRole("option", { name: "Tamil Nadu (33)" }).click();
    await expect(pane.getByText("This GSTIN belongs to Karnataka.")).toBeVisible();
    await page.keyboard.press("Escape");

    // A registered customer: GSTIN required and checked; state filled from it.
    await page.goto("/contacts?new=1");
    const drawer = page.getByRole("dialog");
    await drawer.getByLabel("Company name").or(drawer.getByLabel("Full name")).fill("Lakeview Homes LLP");
    await drawer.getByRole("combobox", { name: "GST treatment" }).click();
    for (const option of ["Registered business", "Unregistered business", "Consumer", "Overseas", "Special economic zone"]) await expect(page.getByRole("option", { name: option, exact: true })).toBeVisible();
    await page.getByRole("option", { name: "Registered business", exact: true }).click();
    await drawer.getByRole("button", { name: "Save contact" }).click();
    await expect(drawer.getByText("Enter the GSTIN — it's needed for a registered business or SEZ.")).toBeVisible();
    await drawer.getByLabel("GSTIN").fill(GSTIN);
    await expect(drawer.getByRole("combobox", { name: "State" })).toHaveText("Karnataka (29)");
    await expect(drawer.getByText("State filled from the GSTIN.")).toBeVisible();
    await drawer.getByRole("button", { name: "Save contact" }).click();
    await expect(page.getByRole("row", { name: /Lakeview Homes LLP/ })).toBeVisible();
    const list = (await (await page.request.get(`${API_URL}/contacts`)).json()) as { id: string; name: string; gstTreatment: string; taxId: string; stateCode: string }[];
    const saved = list.find((c) => c.name === "Lakeview Homes LLP")!;
    expect(saved).toMatchObject({ gstTreatment: "registered", taxId: GSTIN, stateCode: "29" });
    await page.goto(`/contacts/${saved.id}`);

    await expect(page.getByText("Registered business · Karnataka (29)")).toBeVisible();
    await expect(page.getByText(`GSTIN: ${GSTIN}`)).toBeVisible();

    // Each address has a state.
    await page.getByRole("tab", { name: "Addresses" }).click();
    await page.getByRole("button", { name: "Add address" }).click();
    const address = page.getByRole("dialog");
    await address.getByLabel("Address line").fill("4 Beach Road");
    await address.getByRole("combobox", { name: "State" }).click();
    await page.getByRole("option", { name: "Tamil Nadu (33)" }).click();
    await address.getByRole("button", { name: "Add" }).click();
    await expect(page.getByText(/4 Beach Road.*Tamil Nadu \(33\)/)).toBeVisible();
  });
});
