import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function createSchedule(page: Page) {
  const contacts = (await (await page.request.get(`${API_URL}/contacts`)).json()) as { id: string; name: string }[];
  const contact = contacts.find((c) => c.name === "Maple Ridge Developments") ?? contacts[0]!;
  const name = `Site security retainer ${randomUUID().slice(0, 4)}`;
  const res = await page.request.post(`${API_URL}/recurring-invoices`, {
    headers: { "Idempotency-Key": randomUUID() },
    data: {
      name,
      contactId: contact.id,
      currency: "USD",
      frequency: "monthly",
      dayRule: "last",
      startsOn: localToday(),
      dueDays: 14,
      mode: "issue_and_email",
      lines: [{ type: "item", name: "Security patrols", quantity: 1, unitPriceAmount: "80000" }],
    },
  });
  expect(res.ok(), `create: ${res.status()}`).toBe(true);
  return name;
}

test.describe("US-INV-22", () => {
  test("pause shows Paused with no next date, resume brings the next date back, edit saves, delete asks first", async ({ page, seededOrg: _ }) => {
    const name = await createSchedule(page);
    await page.goto("/invoices/recurring");
    const row = page.getByRole("row").filter({ hasText: name });
    await expect(row).toContainText("Monthly · last day");
    await expect(row).toContainText("$800.00");
    await expect(row).toContainText("Active");

    await row.getByRole("button", { name: `Actions for ${name}` }).click();
    await page.getByRole("menuitem", { name: "Pause" }).click();
    await expect(row).toContainText("Paused");
    await expect(row.getByRole("cell").nth(3)).toHaveText("—");

    await row.getByRole("button", { name: `Actions for ${name}` }).click();
    await page.getByRole("menuitem", { name: "Resume" }).click();
    await expect(row).toContainText("Active");
    await expect(row.getByRole("cell").nth(3)).toHaveText(/^[A-Z][a-z]{2} \d{1,2}, \d{4}$/);

    // Edit: only future invoices change.
    await row.getByRole("button", { name: `Actions for ${name}` }).click();
    await page.getByRole("menuitem", { name: "Edit" }).click();
    const dialog = page.getByRole("dialog", { name: "Edit recurring invoice" });
    await expect(dialog.getByText("Invoices it already created stay as they are.")).toBeVisible();
    await expect(dialog.getByText("Lines: Security patrols × 1 · $800.00")).toBeVisible();
    await dialog.getByRole("button", { name: "Edit lines" }).click();
    await dialog.locator("div", { hasText: /^Unit price/ }).getByRole("textbox").fill("950.00");
    await dialog.getByRole("button", { name: "Save schedule" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(row).toContainText("$950.00");

    await row.getByRole("button", { name: `Actions for ${name}` }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm.getByText("Delete this schedule?")).toBeVisible();
    await expect(confirm.getByText("Invoices it already created are kept.")).toBeVisible();
    await confirm.getByRole("button", { name: "Delete schedule" }).click();
    await expect(page.getByRole("row").filter({ hasText: name })).toHaveCount(0);
  });
});
