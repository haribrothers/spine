import { randomUUID } from "node:crypto";
import { test, expect, logIn } from "./fixtures";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";
const DEMO_STAFF_USER = { email: "sarah.mendes.demo@example.com", password: "DemoPassword123!" };
const RIGHTS = [
  "Create/edit own vendor credits",
  "Edit others' vendor credits",
  "Delete own draft vendor credits",
  "Delete others' draft vendor credits",
  "Record vendor credits",
  "Apply and refund vendor credits",
  "Void vendor credits",
];

test.describe("US-PUR-28", () => {
  test("'Vendor credits' rights are granted to General Staff; without 'Record' a draft shows no Record", async ({ page, seededOrg: _, browser }) => {
    await page.goto("/team/teams");
    await page.getByRole("link", { name: /General Staff/ }).click();
    await page.getByRole("tab", { name: "Privileges" }).click();
    await page.getByRole("button", { name: "Vendor credits" }).click();
    for (const name of RIGHTS) await expect(page.getByRole("switch", { name, exact: true })).toBeChecked();

    const post = async <T>(path: string, data?: unknown): Promise<T> => {
      const res = await page.request.post(`${API_URL}${path}`, { data, headers: { "Idempotency-Key": randomUUID() } });
      expect(res.ok(), await res.text()).toBe(true);
      return (await res.json()) as T;
    };
    const vendor = await post<{ id: string }>("/contacts", { type: "vendor", name: `Coastal Timber ${randomUUID().slice(0, 6)}` });
    const credit = await post<{ id: string }>("/vendor-credits", { contactId: vendor.id, vendorReference: "CN-9", date: "2026-10-03", currency: "USD", lines: [{ type: "item", name: "Returned", quantity: 1, unitPriceAmount: "1000" }] });

    const teams = (await (await page.request.get(`${API_URL}/org/teams`)).json()) as { id: string; isDefault: boolean }[];
    const generalStaff = teams.find((t) => t.isDefault)!;
    const setRecord = (granted: boolean) =>
      page.request.put(`${API_URL}/org/teams/${generalStaff.id}/privileges`, { headers: { "Idempotency-Key": randomUUID() }, data: { privileges: [{ capability: "vendor_credits.record", granted }] } });
    expect((await setRecord(false)).ok()).toBe(true);

    const context = await browser.newContext();
    const staff = await context.newPage();
    await logIn(staff, DEMO_STAFF_USER);
    await staff.goto(`/vendor-credits/${credit.id}`);
    await expect(staff.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
    await expect(staff.getByRole("button", { name: "Record", exact: true })).toHaveCount(0);
    await context.close();

    expect((await setRecord(true)).ok()).toBe(true);
  });
});
