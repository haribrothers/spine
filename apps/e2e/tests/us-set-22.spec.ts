import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { expectNoAxeViolations } from "./axe";
import { signUpNewOrg, waitForEmail } from "./helpers";

test.describe("US-SET-22", () => {
  test("preview an email, send a test to myself, and reset it to Spine's text", async ({ page }) => {
    const ownerEmail = `us-set-22-${randomUUID()}@example.com`;
    await signUpNewOrg(page, { name: "Owner", email: ownerEmail, password: "TestPassword123!" });
    await page.getByRole("button", { name: /Owner/ }).last().click();
    await page.getByRole("menuitem", { name: "Settings" }).click();
    const settings = page.getByRole("dialog");
    await settings.getByRole("button", { name: "Emails" }).click();
    await settings.getByTestId("email-template-list").getByRole("button", { name: /^Receipt/ }).click();

    const editor = settings.getByTestId("email-template-editor");
    await expect(editor.getByRole("button", { name: "Reset to default" })).toBeDisabled();
    await editor.getByLabel("Subject").fill("Thanks for paying {amount}");

    await editor.getByRole("button", { name: "Preview" }).click();
    const preview = page.getByRole("dialog").filter({ hasText: "Made with sample details" });
    await expect(preview.getByRole("heading", { name: /^Thanks for paying / })).toBeVisible();
    const frame = page.frameLocator('iframe[title="Preview of the receipt email"]');
    await expect(frame.getByText("RCP-0000").first()).toBeVisible();
    await preview.evaluate((el) => Promise.all((el as unknown as { getAnimations(o: { subtree: boolean }): { finished: Promise<unknown> }[] }).getAnimations({ subtree: true }).map((a) => a.finished)));
    await expectNoAxeViolations(page);
    await preview.getByRole("button", { name: "Close" }).click();
    await expect(preview).toHaveCount(0);

    await editor.getByRole("button", { name: "Send me a test" }).click();
    await expect(editor).toContainText(`Test sent to ${ownerEmail}. Only you get it.`);
    const testEmail = await waitForEmail((e) => e.to.some((t) => t.address === ownerEmail) && e.subject.startsWith("[Test] Thanks for paying"));
    expect(testEmail.subject).toMatch(/^\[Test\] Thanks for paying /);

    await settings.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Your changes have been saved.").first()).toBeVisible();
    await editor.getByRole("button", { name: "Reset to default" }).click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm.getByRole("heading", { name: "Reset the receipt email?" })).toBeVisible();
    await confirm.getByRole("button", { name: "Reset to default" }).click();
    await expect(editor.getByLabel("Subject")).toHaveValue("{business_name} sent you a receipt ({document_number})");
    // US-SET-33: the reload keeps Settings open on Emails.
    await page.reload();
    await expect(page).toHaveURL(/settings=emails/);
    await page.getByTestId("email-template-list").getByRole("button", { name: /^Receipt/ }).click();
    await expect(page.getByTestId("email-template-editor").getByLabel("Subject")).toHaveValue("{business_name} sent you a receipt ({document_number})");
  });
});
