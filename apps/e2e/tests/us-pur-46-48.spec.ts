import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { signUpNewOrg } from "./helpers";
import { api, isoDays } from "./quote-seed";

const toasts = (page: Page) => page.locator('[data-testid="toast"]');

async function setUp(page: Page, tag: string) {
  await signUpNewOrg(page, { name: "Priya Raman", email: `e2e-cat-${tag}-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
  const grouped = await api<Record<string, { id: string; code: string; name: string }[]>>(page, "GET", "/org/accounts");
  const account = (code: string) => Object.values(grouped).flat().find((a) => a.code === code)!;
  return { account };
}

test.describe("US-PUR-46, US-PUR-47", () => {
  test("the table shows where each category posts and how it's used; changes ask first, catch a taken name and toast", async ({ page }) => {
    const { account } = await setUp(page, "46");
    const fuel = await api<{ id: string }>(page, "POST", "/expense-categories", { name: "Fuel & freight", description: "Diesel, petrol, tolls and getting materials to site", accountId: account("6900").id });
    await api(page, "POST", "/expense-categories", { name: "Client entertainment", description: "Meals and gifts for clients" });
    const expense = await api<{ id: string }>(page, "POST", "/expenses", { categoryId: fuel.id, date: isoDays(0), currency: "USD", amount: "4850", taxAmount: "0", paidBy: "company" });
    await api(page, "POST", `/expenses/${expense.id}/approve`, { comment: null });

    await page.goto("/expenses/categories");
    const fuelRow = page.getByRole("row").filter({ has: page.getByText("Fuel & freight", { exact: true }) });
    await expect(fuelRow).toContainText("Diesel, petrol, tolls and getting materials to site");
    await expect(fuelRow).toContainText("6900 Other Expenses");
    await expect(fuelRow).toContainText("$48.50");
    await expect(fuelRow.getByTestId("category-state")).toHaveText("Active");
    const unusedRow = page.getByRole("row").filter({ has: page.getByText("Client entertainment", { exact: true }) });
    await expect(unusedRow).toContainText("6900 Other Expenses · default");

    // In use: Delete says to archive instead. Archive asks first, then toasts.
    await page.getByRole("button", { name: "Actions for Fuel & freight" }).click();
    await expect(page.getByRole("menuitem", { name: /In use — archive it instead/ })).toBeDisabled();
    await page.getByRole("menuitem", { name: "Archive", exact: true }).click();
    const archive = page.getByRole("alertdialog", { name: "Archive Fuel & freight?" }).or(page.getByRole("dialog", { name: "Archive Fuel & freight?" }));
    await expect(archive).toContainText("Its 1 expense keeps it");
    await archive.getByRole("button", { name: "Archive category" }).click();
    await expect(toasts(page).filter({ hasText: "Fuel & freight archived" })).toBeVisible();
    await expect(fuelRow).toHaveCount(0);
    await page.getByRole("combobox", { name: "Filter by state" }).click();
    await page.getByRole("option", { name: "Archived" }).click();
    await expect(page).toHaveURL(/state=archived/);
    await expect(fuelRow.getByTestId("category-state")).toHaveText("Archived");

    // A taken name — ignoring case and spaces, archived too — is caught, with Restore.
    await page.getByRole("button", { name: "Add category" }).click();
    const form = page.getByRole("dialog", { name: "Add category" });
    await form.getByRole("textbox", { name: "Name" }).fill(" fuel & FREIGHT ");
    await form.getByRole("button", { name: "Add category" }).click();
    await expect(form).toContainText("Fuel & freight is already a category — it's archived.");
    await form.getByRole("button", { name: "Restore it" }).click();
    await expect(toasts(page).filter({ hasText: "Fuel & freight restored" })).toBeVisible();

    // Changing the account says what happens to approved expenses.
    await page.getByRole("combobox", { name: "Filter by state" }).click();
    await page.getByRole("option", { name: "Active" }).click();
    await page.getByRole("button", { name: "Actions for Fuel & freight" }).click();
    await page.getByRole("menuitem", { name: "Edit" }).click();
    const edit = page.getByRole("dialog", { name: "Edit category" });
    await edit.getByRole("combobox", { name: "Posts to" }).click();
    await page.getByRole("option", { name: /^6300 / }).click();
    await expect(edit.getByTestId("category-account-note")).toContainText("Expenses already approved stay in 6900 Other Expenses. Expenses approved from now on post to 6300");
    await edit.getByRole("button", { name: "Save changes" }).click();
    await expect(toasts(page).filter({ hasText: "Fuel & freight saved" })).toBeVisible();
    await expect(fuelRow).toContainText("6300 ");

    // Unused: Delete asks first.
    await page.getByRole("button", { name: "Actions for Client entertainment" }).click();
    await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
    await page.getByRole("button", { name: "Delete category" }).click();
    await expect(toasts(page).filter({ hasText: "Client entertainment deleted" })).toBeVisible();
    await expect(unusedRow).toHaveCount(0);

    // The count opens the expenses list filtered to the category.
    await fuelRow.getByRole("link", { name: "1 expense in Fuel & freight" }).click();
    await page.waitForURL(new RegExp(`/expenses\\?category=${fuel.id}`));
    await expect(page.getByTestId("expenses-table").getByRole("row")).toHaveCount(2);
  });
});

test.describe("US-PUR-48", () => {
  test("the category picker says what each is for, and a category's usual rate fills in until another is chosen", async ({ page }) => {
    await setUp(page, "48");
    const rate = await api<{ id: string }>(page, "POST", "/tax-rates", { name: "GST 18%", rate: 18 });
    await api(page, "POST", "/expense-categories", { name: "Materials", description: "Cement, steel, sand — anything that goes into the build", defaultTaxRateId: rate.id });
    await api(page, "POST", "/expense-categories", { name: "Fuel & freight", description: "Diesel, petrol, tolls and getting materials to site" });

    await page.goto("/expenses");
    await page.getByRole("button", { name: "Submit expense" }).first().click();
    const form = page.getByRole("dialog", { name: "Submit an expense" });
    await form.locator("div", { hasText: /^Category/ }).getByRole("combobox").first().click();
    await expect(page.getByRole("option", { name: /Materials/ })).toContainText("Cement, steel, sand — anything that goes into the build");
    // Searching looks at what it's for too.
    await page.getByPlaceholder("Search…").fill("petrol");
    await expect(page.getByRole("option")).toHaveCount(1);
    await expect(page.getByRole("option")).toContainText("Fuel & freight");
    await page.getByPlaceholder("Search…").fill("");
    await page.getByRole("option", { name: /Materials/ }).click();
    await expect(form).toContainText("Cement, steel, sand — anything that goes into the build");

    await expect(form.locator("div", { hasText: /^Tax rate/ }).getByRole("combobox").first()).toHaveText(/GST 18%/);
    await expect(form).toContainText("Materials’ usual rate — change it if this receipt differs.");
    await form.getByRole("textbox", { name: "Amount", exact: true }).fill("129.80");
    await expect(form.getByRole("textbox", { name: "Tax amount" })).toHaveValue("19.80");

    // Another category without a default takes the filled-in rate away again.
    await form.locator("div", { hasText: /^Category/ }).getByRole("combobox").first().click();
    await page.getByRole("option", { name: /Fuel & freight/ }).click();
    await expect(form.locator("div", { hasText: /^Tax rate/ }).getByRole("combobox").first()).toHaveText(/No tax/);
  });
});
