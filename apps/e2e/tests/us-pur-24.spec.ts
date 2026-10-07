import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

test.describe("US-PUR-24", () => {
  test("record a vendor credit against a bill, copying its lines", async ({ page }) => {
    await signUpNewOrg(page, { name: "Credit Buyer", email: `e2e-pur-24-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const post = async <T>(path: string, data?: unknown): Promise<T> => {
      const res = await page.request.post(`${API_URL}${path}`, { data, headers: { "Idempotency-Key": randomUUID() } });
      expect(res.ok(), await res.text()).toBe(true);
      return (await res.json()) as T;
    };
    const vendor = await post<{ id: string }>("/contacts", { type: "vendor", name: "Coastal Timber Supply" });
    const bill = await post<{ id: string }>("/vendor-bills", {
      contactId: vendor.id,
      billNumber: "88213",
      date: new Date().toISOString().slice(0, 10),
      currency: "USD",
      lines: [{ type: "item", name: "Treated pine 90×45", quantity: 20, unitPriceAmount: "1892" }],
    });
    await post(`/vendor-bills/${bill.id}/record`);

    await page.goto("/vendor-credits");
    await expect(page.getByText("No vendor credits yet")).toBeVisible();
    await page.getByRole("link", { name: "New vendor credit" }).click();
    await page.waitForURL("**/vendor-credits/new");
    await page.getByRole("combobox").filter({ hasText: "Select a vendor…" }).click();
    await page.getByRole("option", { name: "Coastal Timber Supply" }).click();
    await page.getByPlaceholder("e.g. CN-4471").fill("CN-4471");
    await page.getByRole("combobox", { name: "Against bill" }).click();
    await page.getByRole("option", { name: /^Bill 88213/ }).click();
    await expect(page.getByPlaceholder("Item name").first()).toHaveValue("Treated pine 90×45");
    await expect(page.getByText("$378.40").first()).toBeVisible();
    await page.getByRole("button", { name: "Save as draft" }).click();
    await page.waitForURL(/\/vendor-credits\/[0-9a-f-]{36}$/);

    await expect(page.getByRole("heading", { name: "Draft vendor credit" })).toBeVisible();
    await expect(page.getByText("their CN-4471")).toBeVisible();
    await page.getByRole("button", { name: "Record", exact: true }).click();
    await expect(page.getByRole("heading", { name: "VCR-0001" })).toBeVisible();
    await expect(page.getByTestId("credit-balance")).toHaveText("Open — $378.40 to use");
    await expect(page.getByRole("button", { name: "Edit", exact: true })).toHaveCount(0);

    await page.goto("/vendor-credits");
    const row = page.getByTestId("vendor-credits-table").getByRole("row", { name: /VCR-0001/ });
    await expect(row).toContainText("CN-4471");
    await expect(row).toContainText("Open");
    await expect(row).toContainText("$378.40");
  });
});
