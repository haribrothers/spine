import { test, expect } from "./fixtures";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

test.describe("US-QUO-25", () => {
  test("Save lines as a bundle needs a name, saves with a toast, and the bundle is listed under Catalogue › Bundles", async ({ page, seededOrg: _ }) => {
    const quotes = (await (await page.request.get(`${API_URL}/quotes`)).json()) as { id: string; status: string; number: string | null }[];
    const quote = quotes.find((q) => q.status === "sent" && q.number)!;
    await page.goto(`/quotes/${quote.id}`);
    await page.getByRole("button", { name: "More" }).click();
    await page.getByRole("menuitem", { name: "Save lines as a bundle…" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Bundles appear in the item picker on quotes and invoices and add all their lines at once. Prices are copied when you add them.")).toBeVisible();
    await dialog.getByRole("button", { name: "Save bundle" }).click();
    await expect(dialog.getByText("Give the bundle a name.")).toBeVisible();

    await dialog.getByLabel("Bundle name").fill("Kitchen package — standard");
    await dialog.getByLabel("Description").fill("Everything we quote for a standard kitchen.");
    await dialog.getByRole("button", { name: "Save bundle" }).click();
    await expect(page.getByText("Bundle saved").first()).toBeVisible();

    await page.goto("/catalog?tab=bundles");
    await expect(page.getByRole("tab", { name: "Bundles", selected: true })).toBeVisible();
    await expect(page.getByText("Kitchen package — standard")).toBeVisible();
    await expect(page.getByText("Everything we quote for a standard kitchen.")).toBeVisible();
  });
});
