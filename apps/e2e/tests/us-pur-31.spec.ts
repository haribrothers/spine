import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

test.describe("US-PUR-31", () => {
  test("Pause, Resume and Delete a recurring bill from its row menu", async ({ page }) => {
    await signUpNewOrg(page, { name: "Schedule Owner", email: `e2e-pur-31-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const post = async <T>(path: string, data?: unknown) => (await (await page.request.post(`${API_URL}${path}`, { headers: { "Idempotency-Key": randomUUID() }, data })).json()) as T;
    const grouped = (await (await page.request.get(`${API_URL}/org/accounts`)).json()) as Record<string, { id: string; code: string }[]>;
    const code = (c: string) => Object.values(grouped).flat().find((a) => a.code === c)!.id;
    const vendor = await post<{ id: string }>("/contacts", { type: "vendor", name: "Harbourside Properties" });
    await post("/recurring-bills", {
      name: "Office rent",
      contactId: vendor.id,
      currency: "USD",
      frequency: "monthly",
      dayRule: "last",
      startsOn: today(),
      dueDays: 7,
      mode: "record",
      lines: [{ type: "item", name: "Rent", quantity: 1, unitPriceAmount: "240000", accountId: code("6000") }],
    });

    await page.goto("/vendor-bills/recurring");
    const row = page.getByTestId("recurring-bills-table").getByRole("row", { name: /Office rent/ });
    await expect(row).toContainText("Active");

    await row.getByRole("button", { name: "Actions for Office rent" }).click();
    await page.getByRole("menuitem", { name: "Pause" }).click();
    await expect(row).toContainText("Paused");
    await expect(page.getByText("Office rent won't create bills until you resume it.").first()).toBeVisible();

    await row.getByRole("button", { name: "Actions for Office rent" }).click();
    await page.getByRole("menuitem", { name: "Resume" }).click();
    await expect(row).toContainText("Active");

    await row.getByRole("button", { name: "Actions for Office rent" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    const confirm = page.getByRole("alertdialog", { name: "Delete this schedule?" });
    await expect(confirm).toContainText("Bills it already created are kept.");
    await confirm.getByRole("button", { name: "Delete schedule" }).click();
    await expect(page.getByText("No recurring bills yet")).toBeVisible();
  });
});
