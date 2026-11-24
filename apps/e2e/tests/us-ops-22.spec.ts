import { test, expect, logIn, DEMO_FIELD_USER } from "./fixtures";

test.describe("US-OPS-22", () => {
  test("⌘K / Ctrl+K or the search button opens search; results are grouped; a number comes first; nothing found says so", async ({ page, seededOrg: _, browser }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("main")).toBeVisible();
    await page.keyboard.press("ControlOrMeta+k");
    const palette = page.getByRole("dialog", { name: "Search" });
    await expect(palette).toBeVisible();
    const field = palette.getByRole("combobox", { name: "Search" });
    await expect(field).toBeFocused();
    // US-OPS-47 replaced the footer's list of what's searched.
    for (const text of ["↑↓ to move", "Enter to open", "Esc to close"]) await expect(palette.getByText(text)).toBeVisible();

    await field.fill("harbor");
    const listbox = palette.getByRole("listbox");
    await expect(listbox.getByText("Contacts", { exact: true })).toBeVisible();
    await expect(listbox.getByText("Contacts", { exact: true })).toHaveCSS("text-transform", "uppercase");
    await expect(listbox.getByText("Invoices", { exact: true })).toBeVisible();
    const contact = palette.getByRole("option", { name: /Harborview Construction Co\./ }).first();
    await expect(contact).toContainText("Contact");
    const groups = listbox.locator("[cmdk-group]");
    // Up to 5 results a group, plus its "See all … matching" row (US-OPS-40).
    for (let i = 0; i < (await groups.count()); i++) expect(await groups.nth(i).getByRole("option").filter({ hasNotText: /^See all / }).count()).toBeLessThanOrEqual(5);

    // A document number is the first result — an overdue invoice's, looked up (other tests add invoices to this org).
    const listed = (await (await page.request.get(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110"}/invoices`)).json()) as { number: string | null; isOverdue: boolean }[];
    const overdueNumber = listed.find((i) => i.isOverdue && i.number)!.number!;
    await field.fill(overdueNumber);
    await expect(palette.getByRole("option").first()).toContainText(overdueNumber);
    await expect(palette.getByRole("option").first()).toContainText("Overdue");

    await field.fill("zzqqxx");
    await expect(palette.getByText("No results for “zzqqxx”")).toBeVisible();

    // Opening a result goes to the record.
    await field.fill("Harborview");
    await palette.getByRole("option", { name: /Harborview Construction Co\./ }).first().click();
    await expect(page).toHaveURL(/\/contacts\/[0-9a-f-]+$/);
    await expect(palette).toHaveCount(0);

    // The sidebar's search field opens it too (US-OPS-48).
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Search" })).toBeVisible();

    // Field users never see records they can't read.
    const context = await browser.newContext();
    const fieldPage = await context.newPage();
    await logIn(fieldPage, DEMO_FIELD_USER);
    await fieldPage.goto("/dashboard");
    await fieldPage.keyboard.press("ControlOrMeta+k");
    const fieldPalette = fieldPage.getByRole("dialog", { name: "Search" });
    await fieldPalette.getByRole("combobox", { name: "Search" }).fill("INV-0002");
    await expect(fieldPalette.getByText("No results for “INV-0002”")).toBeVisible();
    await fieldPalette.getByRole("combobox", { name: "Search" }).fill("harbor");
    await expect(fieldPalette.getByText(/No results for|Jobs/).first()).toBeVisible();
    await expect(fieldPalette.getByRole("listbox").getByText("Contacts", { exact: true })).toHaveCount(0);
    await expect(fieldPalette.getByRole("listbox").getByText("Invoices", { exact: true })).toHaveCount(0);
    await context.close();
  });
});
