import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";
import { api, contact } from "./quote-seed";
import { creditFirstLine, payInFull, taxedInvoice } from "./credit-note-seed";

test.describe("US-INV-39", () => {
  test("Activity tells the credit note's story, newest first", async ({ page }) => {
    await signUpNewOrg(page, { name: "Priya Raman", email: `e2e-inv-39-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const c = await contact(page, "Sahyadri Retail");
    const paid = await taxedInvoice(page, c.id);
    await payInFull(page, c.id, paid);
    const note = await creditFirstLine(page, paid.id, 5);
    await api(page, "POST", "/customer-refunds", { sourceCreditNoteId: note.id, amount: "10000", date: new Date().toISOString().slice(0, 10), method: "upi" });

    await page.goto(`/credit-notes/${note.id}`);
    const activity = page.getByTestId("credit-note-activity");
    const entries = activity.getByTestId("credit-note-activity-entry");
    await expect(entries.first()).toContainText("Refunded");
    await expect(entries.first()).toContainText("$100.00");
    await expect(entries.first()).toContainText("UPI");
    await expect(entries.last()).toContainText(`Issued against ${paid.number}`);
    await expect(entries.last()).toContainText("as credit");
    await expect(activity).toContainText("Priya Raman");
    await activity.getByRole("button", { name: "View history" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});
