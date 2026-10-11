import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";
import { api, contact, quote, send } from "./quote-seed";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

test.describe("D-218", () => {
  test("a major action asks first: Go back changes nothing, the verb does it", async ({ page }) => {
    await signUpNewOrg(page, { name: "Owner", email: `e2e-d-218-${randomUUID()}@example.com`, password: "e2e-test-password-1" });

    // Recording a vendor bill posts to the books.
    const grouped = await api<Record<string, { id: string; code: string }[]>>(page, "GET", "/org/accounts");
    const expense = Object.values(grouped).flat().find((a) => a.code === "5000")!.id;
    const vendor = await api(page, "POST", "/contacts", { type: "vendor", name: "Coastal Timber Supply" });
    const today = new Date().toISOString().slice(0, 10);
    const bill = await api(page, "POST", "/vendor-bills", { contactId: vendor.id, billNumber: "CT-1001", date: today, dueDate: today, currency: "USD", lines: [{ type: "item", name: "Timber", quantity: 1, unitPriceAmount: "124000", accountId: expense }] });
    await page.goto(`/vendor-bills/${bill.id}`);
    await page.getByRole("button", { name: "Record", exact: true }).click();
    const ask = page.getByRole("alertdialog", { name: "Record this bill?" });
    await expect(ask.getByTestId("confirm-description")).toHaveText("Coastal Timber Supply's bill CT-1001 for $1,240.00 is posted to your books as owed. After that it can't be edited — only voided.");
    await ask.getByRole("button", { name: "Go back" }).click();
    await expect(ask).toHaveCount(0);
    expect(((await (await page.request.get(`${API_URL}/vendor-bills/${bill.id}`)).json()) as { status: string }).status).toBe("draft");
    await page.getByRole("button", { name: "Record", exact: true }).click();
    await ask.getByRole("button", { name: "Record bill" }).click();
    await expect(page.getByText("Vendor bill recorded").first()).toBeVisible();

    // Revising a sent quote, from its row's menu: Esc leaves it alone.
    const c = await contact(page, "Ananya Rao");
    const q = await quote(page, c.id, { title: "Bathroom refit" });
    const sent = await send(page, q.id);
    await page.goto("/quotes");
    await page.getByRole("button", { name: `Actions for ${sent.number}` }).click();
    await page.getByRole("menuitem", { name: "Revise" }).click();
    const revise = page.getByRole("alertdialog", { name: "Revise this quote?" });
    await expect(revise.getByTestId("confirm-description")).toContainText(`${sent.number} version 2 is made as a draft`);
    await page.keyboard.press("Escape");
    await expect(revise).toHaveCount(0);
    expect((await api<{ id: string }[]>(page, "GET", "/quotes")).length).toBe(1);
  });
});
