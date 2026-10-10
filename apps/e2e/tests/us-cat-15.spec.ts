import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";
import { apiPost, seedCatalog } from "./catalog-seed";

test.describe("US-CAT-15", () => {
  test("the drawer is grouped and says where the item is used; deleting a used item says what it touches", async ({ page }) => {
    await signUpNewOrg(page, { name: "Catalogue Owner", email: `e2e-cat-15-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const { ids } = await seedCatalog(page, [
      { name: "Cement", price: "4100" },
      { name: "Tiling", price: "9500" },
    ]);
    const contact = (await (await apiPost(page, "/contacts", { type: "customer", name: "Ananya Rao" })).json()) as { id: string };
    await apiPost(page, "/quotes", { contactId: contact.id, currency: "USD", lines: [{ type: "item", catalogItemId: ids.Cement, name: "Cement", quantity: 1, unitPriceAmount: "4100" }] });

    await page.goto("/catalog");
    await page.getByRole("table").getByRole("button", { name: "Cement", exact: true }).click();
    const drawer = page.getByRole("dialog", { name: "Edit item" });
    await expect(drawer.getByTestId("catalog-usage")).toHaveText(/^Used on 1 quote · last quoted /);
    for (const heading of ["Details", "Price and tax", "Accounts"]) {
      await expect(drawer.getByRole("heading", { name: heading })).toBeVisible();
    }
    await expect(drawer.getByRole("button", { name: "Save item" })).toBeInViewport();
    await drawer.getByRole("button", { name: "Cancel" }).click();

    await page.getByRole("table").getByRole("button", { name: "Tiling", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Edit item" }).getByTestId("catalog-usage")).toHaveText("Not used on a quote or invoice yet.");
    await page.getByRole("dialog", { name: "Edit item" }).getByRole("button", { name: "Cancel" }).click();

    await page.getByRole("table").getByRole("row", { name: /Cement/ }).getByRole("button", { name: /^Actions for / }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await expect(page.getByRole("alertdialog")).toContainText("It's on 1 document (quotes and invoices), and they keep their own copy of the line.");
  });
});
