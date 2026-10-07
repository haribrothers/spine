import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

test.describe("US-ONB-17", () => {
  test("demo documents have their own numbers, and deleting the demo says which contact it kept", async ({ page }) => {
    test.setTimeout(180_000);
    await signUpNewOrg(page, { name: "Demo Owner", email: `e2e-onb-17-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const seeded = await page.request.post(`${API_URL}/demo-data/seed`, { headers: { "Idempotency-Key": randomUUID() }, timeout: 120_000 });
    expect(seeded.ok()).toBe(true);

    await page.goto("/invoices");
    await expect(page.getByText(/^DEMO-INV-\d{4}$/).first()).toBeVisible();
    await expect(page.getByText(/^INV-\d{4}$/)).toHaveCount(0);

    // A vendor credit of my own for a demo vendor keeps that vendor.
    const vendors = (await (await page.request.get(`${API_URL}/contacts?search=Apex`)).json()) as { id: string; name: string }[] | { items: { id: string; name: string }[] };
    const list = Array.isArray(vendors) ? vendors : vendors.items;
    const apex = list.find((c) => c.name === "Apex Timber Supply")!;
    const credit = await page.request.post(`${API_URL}/vendor-credits`, {
      headers: { "Idempotency-Key": randomUUID() },
      data: { contactId: apex.id, vendorReference: "CR-1", date: new Date().toISOString(), currency: "USD", lines: [] },
    });
    expect(credit.ok()).toBe(true);

    await page.goto("/dashboard?settings=data");
    const pane = page.getByRole("dialog").getByTestId("settings-pane");
    await pane.getByRole("button", { name: "Delete all demo data" }).click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm.getByText("and the entries they made in your books. Your own records stay.", { exact: false })).toBeVisible();
    await confirm.getByRole("button", { name: "Delete demo data" }).click();
    await expect(pane.getByRole("status").filter({ hasText: "Kept 1 demo contact that your own records use." })).toBeVisible({ timeout: 60_000 });
    await expect(pane.getByText("No demo data is currently loaded.")).toBeVisible();

    await page.goto("/invoices");
    await expect(page.getByText("No invoices yet", { exact: false }).or(page.getByText("Total invoices"))).toBeVisible();
    await expect(page.getByText(/^DEMO-INV-\d{4}$/)).toHaveCount(0);
  });
});
