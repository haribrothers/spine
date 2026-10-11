import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";
import { contact } from "./quote-seed";
import { creditFirstLine, payInFull, taxedInvoice } from "./credit-note-seed";

test.describe("US-INV-40", () => {
  test("the cards show what was credited and the credit to use; rows say where each credit went; the menu opens the step", async ({ page }) => {
    await signUpNewOrg(page, { name: "Credit Owner", email: `e2e-inv-40-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const c = await contact(page, "Sahyadri Retail");
    const owed = await taxedInvoice(page, c.id);
    const off = await creditFirstLine(page, owed.id, 2, "Two bays not built");
    const paid = await taxedInvoice(page, c.id);
    await payInFull(page, c.id, paid);
    const kept = await creditFirstLine(page, paid.id, 10, "Canopy reduced");

    await page.goto("/credit-notes");
    const stats = page.getByTestId("credit-note-stats");
    await expect(stats).toContainText("Credited this month");
    await expect(stats).toContainText("2 credit notes");
    await expect(stats).toContainText("$462.00");
    const row = (n: string) => page.getByRole("row").filter({ has: page.getByRole("link", { name: n }) });
    await expect(row(off.number).getByTestId("where-it-went")).toHaveText(`Off ${owed.number}`);
    await expect(row(kept.number).getByTestId("where-it-went")).toHaveText("$462.00 left");
    await expect(row(kept.number)).toContainText("Canopy reduced");

    await stats.getByRole("button", { name: /^Show credit notes with credit left/ }).click();
    await expect(page).toHaveURL(/card=left/);
    await expect(row(off.number)).toHaveCount(0);

    await row(kept.number).getByRole("button", { name: `Actions for ${kept.number}` }).click();
    await page.getByRole("menuitem", { name: "Refund" }).click();
    await expect(page).toHaveURL(new RegExp(`/credit-notes/${kept.id}$`));
    await expect(page.getByRole("dialog")).toContainText("Refund");
  });
});
