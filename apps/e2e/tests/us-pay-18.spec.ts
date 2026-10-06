import { randomUUID } from "node:crypto";
import { test, expect, logIn } from "./fixtures";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";
const DEMO_STAFF_USER = { email: "sarah.mendes.demo@example.com", password: "DemoPassword123!" };

test.describe("US-PAY-18", () => {
  test("'Refund customers' is off for General Staff, so they see no Refund", async ({ page, seededOrg }) => {
    void seededOrg;
    const contacts = (await (await page.request.get(`${API_URL}/contacts?type=customer`)).json()) as { id: string }[];
    const res = await page.request.post(`${API_URL}/payments`, {
      data: { contactId: contacts[0]!.id, date: new Date().toISOString().slice(0, 10), method: "cash", currency: "USD", amount: "25000" },
      headers: { "Idempotency-Key": randomUUID() },
    });
    const payment = (await res.json()) as { id: string };

    await page.goto("/team/teams");
    await page.getByRole("link", { name: /General Staff/ }).click();
    await page.getByRole("tab", { name: "Privileges" }).click();
    await page.getByRole("button", { name: "Manage Payments" }).click();
    await expect(page.getByRole("switch", { name: "Refund customers" })).not.toBeChecked();

    // The Owner sees Refund on the payment.
    await page.goto(`/payments?id=${payment.id}`);
    await expect(page.getByRole("dialog").getByRole("button", { name: "Refund", exact: true })).toBeVisible();

    await page.goto("about:blank");
    await page.context().clearCookies();
    await logIn(page, DEMO_STAFF_USER);
    await page.goto(`/payments?id=${payment.id}`);
    await expect(page.getByRole("dialog").getByRole("button", { name: "Apply credit" })).toBeVisible();
    await expect(page.getByRole("dialog").getByRole("button", { name: "Refund", exact: true })).toHaveCount(0);
  });
});
