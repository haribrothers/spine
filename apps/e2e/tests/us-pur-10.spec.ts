import { randomUUID } from "node:crypto";
import { test, expect } from "./fixtures";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";
type Row = { id: string; status: string; submittedByUserId: string; description: string | null };

test.describe("US-PUR-10", () => {
  test("edit a submitted expense from its drawer or row menu; it stays Submitted; reviewed expenses have no Edit", async ({ page, seededOrg: _ }) => {
    const categories = (await (await page.request.get(`${API_URL}/expense-categories`)).json()) as { id: string }[];
    const res = await page.request.post(`${API_URL}/expenses`, {
      headers: { "Idempotency-Key": randomUUID() },
      data: { categoryId: categories[0]!.id, date: new Date().toISOString(), currency: "USD", amount: "12345", description: `Fuel ${randomUUID().slice(0, 6)}` },
    });
    expect(res.ok()).toBe(true);
    const mine = (await res.json()) as Row;

    // My own submitted expense. An Owner may approve it, so Approve and Reject show and Edit is under "More".
    await page.goto(`/expenses?id=${mine.id}`);
    const drawer = page.getByRole("dialog");
    await expect(drawer.getByRole("button", { name: "Approve", exact: true })).toBeVisible();
    await drawer.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: "Edit" }).click();
    const form = page.getByRole("dialog", { name: "Edit expense" });
    await expect(form).toContainText("Only a submitted expense can be edited — an approved expense has already posted to the ledger.");
    await form.getByRole("textbox", { name: "Amount", exact: true }).fill("150");
    await form.getByRole("textbox", { name: "Description" }).fill("Fuel and tolls");
    await form.getByRole("button", { name: "Save expense" }).click();
    await expect(page.getByText("Expense updated").first()).toBeVisible();
    await expect(drawer).toContainText("$150.00");
    await expect(drawer).toContainText("Fuel and tolls");
    await expect(drawer).toContainText("Submitted");
    // Focus is back in the drawer, and one Escape closes it even with the toast still showing.
    await expect(drawer.getByRole("button", { name: "More actions" })).toBeFocused();
    await expect(page.getByText("Expense updated").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer).toHaveCount(0);

    // The row menu offers Edit too.
    await page.getByRole("row").filter({ hasText: "150.00" }).first().getByRole("button", { name: "Actions for this expense" }).click();
    await page.getByRole("menuitem", { name: "Edit" }).click();
    await expect(page.getByRole("dialog", { name: "Edit expense" })).toBeVisible();
    await page.keyboard.press("Escape");

    const all = (await (await page.request.get(`${API_URL}/expenses`)).json()) as Row[];
    // A colleague's submitted expense: Approve and Reject show, Edit is under "More".
    const theirs = all.find((e) => e.status === "submitted" && e.submittedByUserId !== mine.submittedByUserId);
    if (theirs) {
      await page.goto(`/expenses?id=${theirs.id}`);
      await expect(drawer.getByRole("button", { name: "Approve", exact: true })).toBeVisible();
      await drawer.getByRole("button", { name: "More actions" }).click();
      await expect(page.getByRole("menuitem", { name: "Edit" })).toBeVisible();
      await page.keyboard.press("Escape");
    }
    // An approved expense: no Edit anywhere.
    const approved = all.find((e) => e.status === "approved")!;
    await page.goto(`/expenses?id=${approved.id}`);
    await expect(drawer).toContainText("Approved");
    await expect(drawer.getByRole("button", { name: "Edit", exact: true })).toHaveCount(0);
    await expect(drawer.getByRole("button", { name: "More actions" })).toHaveCount(0);
  });
});
