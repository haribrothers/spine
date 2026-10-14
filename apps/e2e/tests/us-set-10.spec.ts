import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";

async function openBranding(page: Page) {
  // US-SET-33: after a reload Settings is still open (it's in the address).
  if (!(await page.getByTestId("settings-dialog").isVisible())) {
    await page.getByRole("button", { name: /E2E Seeded Owner/ }).last().click();
    await page.getByRole("menuitem", { name: "Settings" }).click();
  }
  const dialog = page.getByRole("dialog");
  await dialog.getByTestId("settings-sections").getByRole("button", { name: "Branding" }).click();
  return dialog.getByTestId("settings-pane");
}

test.describe("US-SET-10", () => {
  test("document colour shows a contrast check, a too-light colour can't be saved, and the footer shows in the preview and stays saved", async ({ page, seededOrg: _ }) => {
    const pane = await openBranding(page);
    const colour = pane.getByLabel("Document colour", { exact: true });
    await expect(colour).toHaveValue("#2954E5");
    await expect(pane.getByText("✓ Readable on white (6.0:1, passes AA)")).toBeVisible();

    await colour.fill("#8FB3FF");
    await expect(pane.getByText("Too light to read on white (2.0:1). Pick a darker colour — documents need at least 4.5:1.")).toBeVisible();
    await expect(pane.getByRole("button", { name: "Save" })).toBeDisabled();

    await colour.fill("#0D6E6E");
    await expect(pane.getByText("✓ Readable on white (6.0:1, passes AA)")).toBeVisible();
    const footer = "Riverstone Builders · Licence 4471 · Payment due within 21 days.";
    await pane.getByLabel("Document footer").fill(footer);
    const preview = pane.getByRole("img", { name: "Preview" });
    await expect(preview.getByText(footer)).toBeVisible();
    await expect(preview.getByText("INVOICE")).toHaveCSS("color", "rgb(13, 110, 110)");
    await pane.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible();

    await page.reload();
    const again = await openBranding(page);
    await expect(again.getByLabel("Document colour", { exact: true })).toHaveValue("#0D6E6E");
    await expect(again.getByLabel("Document footer")).toHaveValue(footer);
  });
});
