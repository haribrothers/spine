import { randomUUID } from "node:crypto";
import { test, expect, logIn } from "./fixtures";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";
const DEMO_STAFF_USER = { email: "sarah.mendes.demo@example.com", password: "DemoPassword123!" };

test.describe("US-SET-16", () => {
  test("an export's link works only for Owners, and preparing and downloading show in the audit log", async ({ page, seededOrg: _, browser }) => {
    const created = await page.request.post(`${API_URL}/org/exports`, { headers: { "Idempotency-Key": randomUUID() }, data: { formats: ["csv"], includeFiles: false } });
    expect(created.status()).toBe(201);
    const { id } = (await created.json()) as { id: string };
    await expect
      .poll(async () => ((await (await page.request.get(`${API_URL}/org/exports`)).json()) as { export: { status: string } }).export.status, { timeout: 60_000 })
      .toBe("ready");
    const link = `${API_URL}/org/exports/${id}/download`;
    expect((await page.request.get(link)).status()).toBe(200);

    // Staff and signed-out visitors get 404.
    const staffContext = await browser.newContext();
    const staffPage = await staffContext.newPage();
    await logIn(staffPage, DEMO_STAFF_USER);
    expect((await staffPage.request.get(link)).status()).toBe(404);
    await staffContext.close();
    const anonymous = await browser.newContext();
    expect((await anonymous.request.get(link)).status()).toBe(404);
    await anonymous.close();

    // Both actions are in the audit log, with the person.
    await page.goto("/team/audit-log");
    await page.getByRole("combobox", { name: "Record type" }).click();
    await page.getByRole("option", { name: "Data export" }).click();
    const rows = page.getByTestId("audit-table").locator("tbody tr");
    await expect(rows.filter({ hasText: "Prepared" }).filter({ hasText: "E2E Seeded Owner" }).first()).toBeVisible();
    await expect(rows.filter({ hasText: "Downloaded" }).filter({ hasText: "E2E Seeded Owner" }).first()).toBeVisible();
  });
});
