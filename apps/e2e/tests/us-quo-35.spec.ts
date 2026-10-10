import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";
import { contact, quote } from "./quote-seed";

test.describe("US-QUO-35", () => {
  test("the totals and actions stay in view; leaving with changes asks; Save and send opens the send dialog", async ({ page }) => {
    await signUpNewOrg(page, { name: "Quote Owner", email: `e2e-quo-35-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const c = await contact(page, "Ananya Rao");
    const q = await quote(page, c.id, { title: "Bathroom refit", lines: Array.from({ length: 8 }, (_, i) => ({ name: `Line ${i + 1}`, price: "10000" })) });

    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`/quotes/${q.id}/edit`);
    const bar = page.getByTestId("quote-builder-bar");
    await expect(bar).toBeInViewport();
    await expect(bar.getByTestId("quote-total-total")).toHaveText("$800.00");
    await expect(page.getByTestId("quote-unsaved")).toHaveCount(0);
    // The empty Terms box keeps its placeholder inside it.
    const terms = page.getByText("Payment terms, validity, etc…");
    await terms.scrollIntoViewIfNeeded();
    const editorBox = (await page.getByText("Terms & conditions").locator("xpath=..").boundingBox())!;
    const placeholderBox = (await terms.boundingBox())!;
    expect(placeholderBox.y).toBeGreaterThan(editorBox.y);
    expect(placeholderBox.y).toBeLessThan(editorBox.y + editorBox.height);
    await expect(bar).toBeInViewport();

    await page.getByLabel("Title (optional)").fill("Bathroom refit — 2nd floor");
    await expect(page.getByTestId("quote-unsaved")).toHaveText("Unsaved changes");
    await bar.getByRole("button", { name: "Cancel" }).click();
    const leave = page.getByRole("alertdialog");
    await expect(leave).toContainText("Leave without saving?");
    await expect(leave).toContainText("Your changes to this quote will be lost.");
    await leave.getByRole("button", { name: "Keep editing" }).click();
    await page.getByRole("link", { name: "Contacts" }).first().click();
    await expect(leave).toBeVisible();
    await leave.getByRole("button", { name: "Keep editing" }).click();
    await expect(page).toHaveURL(new RegExp(`/quotes/${q.id}/edit`));
    // No "Loading" left over from the link that didn't navigate.
    await page.waitForTimeout(400);
    await expect(page.getByText("Loading", { exact: true })).toHaveCount(0);

    // Preview PDF shows the unsaved quote in a new tab and saves nothing.
    const [tab, preview] = await Promise.all([
      page.context().waitForEvent("page"),
      page.waitForResponse((r) => r.url().endsWith("/quotes/preview-pdf")),
      bar.getByRole("button", { name: "Preview PDF" }).click(),
    ]);
    expect(preview.status()).toBe(200);
    // Headless Chromium has no PDF viewer, so the new tab downloads the PDF it was sent to; a browser shows it.
    expect((await tab.waitForEvent("download")).url()).toMatch(/^blob:/);
    await tab.close();
    await expect(page.getByTestId("quote-unsaved")).toHaveText("Unsaved changes");
    await expect(page).toHaveURL(new RegExp(`/quotes/${q.id}/edit`));
    expect(((await (await page.request.get(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110"}/quotes/${q.id}`)).json()) as { title: string }).title).toBe("Bathroom refit");

    await bar.getByRole("button", { name: "Save and send" }).click();
    await expect(page).toHaveURL(new RegExp(`/quotes/${q.id}$`));
    await expect(page.getByRole("dialog", { name: "Send quote" })).toBeVisible();
    await expect(page.getByTestId("quote-title")).toHaveText("Bathroom refit — 2nd floor");
  });
});
