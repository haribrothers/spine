import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";
import { expectNoAxeViolations } from "./axe";

async function openSearch(page: Page) {
  await page.getByRole("complementary").getByRole("button", { name: "Search", exact: true }).click();
  const palette = page.getByRole("dialog", { name: "Search" });
  await expect(palette).toBeVisible();
  return palette;
}

test.describe("US-OPS-39 to US-OPS-49", () => {
  test("search sits in the sidebar, remembers what was opened, and goes to actions, pages, settings and lists", async ({ page, seededOrg: _ }) => {
    await page.goto("/dashboard");
    // US-OPS-48: a Search… field under the logo, with its shortcut.
    const field = page.getByRole("complementary").getByRole("button", { name: "Search", exact: true });
    await expect(field).toContainText("Search…");
    await expect(field).toHaveAttribute("aria-keyshortcuts", "Meta+K Control+K");

    // US-OPS-45: an amount finds the invoice for it; US-OPS-47: the amount is bold.
    let palette = await openSearch(page);
    const box = palette.getByRole("combobox", { name: "Search" });
    await expect(box).toHaveAttribute("placeholder", "Search records, pages and settings");
    await box.fill("4,542.50");
    const invoice = palette.getByRole("option", { name: /DEMO-INV-0002/ });
    await expect(invoice).toBeVisible();
    await expect(invoice.locator("mark")).toHaveText("$4,542.50");
    await expectNoAxeViolations(page);
    // While the invoice's page loads (slowed here), search stays open with a spinner on the row.
    await page.route(/\/invoices\/[0-9a-f-]+\?_rsc=/, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    });
    await invoice.click();
    await expect(invoice.getByTestId("command-palette-pending")).toBeVisible();
    await expect(page).toHaveURL(/\/invoices\/[0-9a-f-]+$/);
    await expect(palette).toHaveCount(0);
    await page.unrouteAll();

    // US-OPS-39: it's under Recent next time, with the search it came from.
    palette = await openSearch(page);
    await expect(palette.getByText("Recent", { exact: true })).toBeVisible();
    await expect(palette.getByRole("option", { name: /DEMO-INV-0002/ }).first()).toBeVisible();
    await expect(palette.getByRole("option", { name: "4,542.50", exact: true })).toBeVisible();

    // US-OPS-42: an action opens its form.
    await palette.getByRole("combobox", { name: "Search" }).fill("new inv");
    await palette.getByRole("option", { name: /New invoice/ }).click();
    await expect(page).toHaveURL(/\/invoices\/new$/);

    // US-OPS-41: a setting opens Settings on its pane.
    palette = await openSearch(page);
    await palette.getByRole("combobox", { name: "Search" }).fill("invoice prefix");
    await palette.getByRole("option", { name: /Numbering/ }).click();
    await expect(page).toHaveURL(/settings=numbering/);
    await expect(page.getByRole("dialog", { name: /Settings/ })).toBeVisible();
    await page.keyboard.press("Escape");

    // US-OPS-43: a catalogue item opens on Catalogue.
    palette = await openSearch(page);
    await palette.getByRole("combobox", { name: "Search" }).fill("drywall");
    await palette.getByRole("option", { name: /Drywall installation/ }).first().click();
    await expect(page).toHaveURL(/\/catalog/);
    await expect(page.getByRole("dialog", { name: "Edit item" })).toBeVisible();
    await page.keyboard.press("Escape");

    // US-OPS-40: See all … matching opens the list with its search filled in.
    palette = await openSearch(page);
    await palette.getByRole("combobox", { name: "Search" }).fill("harborview");
    await palette.getByRole("option", { name: "See all invoices matching “harborview”" }).click();
    await expect(page).toHaveURL(/\/invoices\?q=harborview/);
    await expect(page.getByRole("searchbox").or(page.getByPlaceholder(/Search invoices/)).first()).toHaveValue("harborview");
  });

  test("chips narrow to an area; leads and meetings are found; Clear recent empties the list", async ({ page, seededOrg: _ }) => {
    await page.goto("/dashboard");
    const palette = await openSearch(page);
    const box = palette.getByRole("combobox", { name: "Search" });
    await box.fill("marina");
    const listbox = palette.getByRole("listbox");
    await expect(listbox.getByText("Leads", { exact: true })).toBeVisible();
    await expect(listbox.getByText("Meetings", { exact: true })).toBeVisible();

    // US-OPS-49: Tab reaches the chips; Billing leaves only billing groups.
    const chips = palette.getByRole("radiogroup", { name: "Search in" });
    await chips.getByRole("radio", { name: "Billing" }).click();
    await expect(chips.getByRole("radio", { name: "Billing" })).toHaveAttribute("aria-checked", "true");
    await expect(listbox.getByText("Leads", { exact: true })).toHaveCount(0);
    await expect(box).toHaveValue("marina");

    // US-OPS-39: open a contact, then Clear recent empties the list.
    await chips.getByRole("radio", { name: "All" }).click();
    await box.fill("harborview");
    await palette.getByRole("option", { name: /Harborview Construction Co\./ }).first().click();
    await expect(page).toHaveURL(/\/contacts\/[0-9a-f-]+$/);
    const again = await openSearch(page);
    await again.getByRole("option", { name: "Clear recent" }).click();
    await expect(again.getByText("Type a name, a number like INV-0010 or an amount like 2,389.50.")).toBeVisible();
    await expect(again.getByText("Recent", { exact: true })).toHaveCount(0);
  });
});
