import { randomUUID } from "node:crypto";
import { test, expect } from "./fixtures";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";
type Row = { id: string; status: string; submittedByUserId: string; description: string | null };

test.describe("US-PUR-10", () => {
  test("edit a submitted expense from its page or row menu; it stays waiting; approved expenses have no Edit", async ({ page, seededOrg: _ }) => {
    const categories = (await (await page.request.get(`${API_URL}/expense-categories`)).json()) as { id: string }[];
    const res = await page.request.post(`${API_URL}/expenses`, {
      headers: { "Idempotency-Key": randomUUID() },
      data: { categoryId: categories[0]!.id, date: new Date().toISOString(), currency: "USD", amount: "12345", description: `Fuel ${randomUUID().slice(0, 6)}` },
    });
    expect(res.ok()).toBe(true);
    const mine = (await res.json()) as Row;

    // US-PUR-43: my own submitted expense opens on its page. An Owner may approve it, so Approve is primary and Edit is under "More".
    await page.goto(`/expenses/${mine.id}`);
    const actions = page.getByTestId("expense-actions");
    await expect(actions.getByRole("button", { name: "Approve", exact: true })).toBeVisible();
    await actions.getByRole("button", { name: "More" }).click();
    await page.getByRole("menuitem", { name: "Edit" }).click();
    const form = page.getByRole("dialog", { name: "Edit expense" });
    await expect(form).toContainText("Only a waiting or rejected expense can be edited — an approved expense has already posted to the ledger.");
    await form.getByRole("textbox", { name: "Amount", exact: true }).fill("150");
    await form.getByRole("textbox", { name: "Description" }).fill("Fuel and tolls");
    await form.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Expense updated").first()).toBeVisible();
    await expect(page.getByTestId("fig-amount")).toContainText("$150.00");
    await expect(page.getByTestId("expense-receipt")).toContainText("Fuel and tolls");
    await expect(page.getByTestId("expense-state")).toHaveText("Waiting for approval");
    await expect(page.getByTestId("expense-activity-entry").first()).toContainText("Edited");

    // The row menu offers Edit too.
    await page.goto("/expenses");
    await page.getByRole("row").filter({ hasText: "150.00" }).first().getByRole("button", { name: "Actions for Fuel and tolls" }).click();
    await page.getByRole("menuitem", { name: "Edit" }).click();
    await expect(page.getByRole("dialog", { name: "Edit expense" })).toBeVisible();
    await page.keyboard.press("Escape");

    const all = (await (await page.request.get(`${API_URL}/expenses`)).json()) as Row[];
    // A colleague's submitted expense: Approve and Reject show, Edit is under "More".
    const theirs = all.find((e) => e.status === "submitted" && e.submittedByUserId !== mine.submittedByUserId);
    if (theirs) {
      await page.goto(`/expenses/${theirs.id}`);
      await expect(actions.getByRole("button", { name: "Approve", exact: true })).toBeVisible();
      await actions.getByRole("button", { name: "More" }).click();
      await expect(page.getByRole("menuitem", { name: "Edit" })).toBeVisible();
      await page.keyboard.press("Escape");
    }
    // An approved expense: no Edit anywhere.
    const approved = all.find((e) => e.status === "approved")!;
    await page.goto(`/expenses/${approved.id}`);
    await expect(page.getByTestId("expense-state")).toHaveText(/Approved|Billed/);
    await expect(actions.getByRole("button", { name: "Edit", exact: true })).toHaveCount(0);
    await actions.getByRole("button", { name: "More" }).click();
    await expect(page.getByRole("menuitem", { name: "Edit" })).toHaveCount(0);
  });
});
