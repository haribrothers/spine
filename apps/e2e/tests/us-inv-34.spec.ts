import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";
import { contact } from "./quote-seed";
import { invoice } from "./invoice-seed";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

test.describe("US-INV-34", () => {
  test("the builder's bar stays in view; leaving with changes asks; Preview PDF saves nothing; Save and issue issues", async ({ page }) => {
    await signUpNewOrg(page, { name: "Invoice Owner", email: `e2e-inv-34-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const c = await contact(page, "Ananya Rao");
    const inv = await invoice(page, c.id, { notes: "First notes", lines: Array.from({ length: 8 }, (_, i) => ({ name: `Line ${i + 1}`, price: "10000" })) });

    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`/invoices/${inv.id}/edit`);
    const bar = page.getByTestId("invoice-builder-bar");
    await expect(bar).toBeInViewport();
    await expect(bar.getByTestId("invoice-total-total")).toHaveText("$800.00");
    await expect(page.getByTestId("invoice-unsaved")).toHaveCount(0);
    // Compact rows, as on quotes.
    await expect(page.getByRole("combobox", { name: "Item" })).toHaveCount(8);

    await page.getByRole("combobox", { name: "Item" }).first().fill("Line one, renamed");
    await expect(page.getByTestId("invoice-unsaved")).toHaveText("Unsaved changes");
    await bar.getByRole("button", { name: "Cancel" }).click();
    const leave = page.getByRole("alertdialog");
    await expect(leave).toContainText("Leave without saving?");
    await expect(leave).toContainText("Your changes to this invoice will be lost.");
    await leave.getByRole("button", { name: "Keep editing" }).click();
    await expect(page).toHaveURL(new RegExp(`/invoices/${inv.id}/edit`));

    const [tab, preview] = await Promise.all([
      page.context().waitForEvent("page"),
      page.waitForResponse((r) => r.url().endsWith("/invoices/preview-pdf")),
      bar.getByRole("button", { name: "Preview PDF" }).click(),
    ]);
    expect(preview.status()).toBe(200);
    expect((await tab.waitForEvent("download")).url()).toMatch(/^blob:/);
    await tab.close();
    await expect(page.getByTestId("invoice-unsaved")).toHaveText("Unsaved changes");
    const saved = (await (await page.request.get(`${API_URL}/invoices/${inv.id}`)).json()) as { lines: { name: string }[] };
    expect(saved.lines[0]!.name).toBe("Line 1");

    await bar.getByRole("button", { name: "Save and issue" }).click();
    await expect(page).toHaveURL(new RegExp(`/invoices/${inv.id}$`));
    // It's saved; issuing still asks first (D-217).
    await page.getByRole("alertdialog", { name: "Issue this invoice?" }).getByRole("button", { name: "Issue invoice" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^INV-/);
    await expect(page.getByTestId("invoice-lines")).toContainText("Line one, renamed");
  });
});
