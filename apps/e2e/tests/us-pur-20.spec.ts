import { randomUUID } from "node:crypto";
import { test, expect, logIn } from "./fixtures";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";
/** The demo seed's Staff user; the default Team grants `expenses.approve`. */
const DEMO_STAFF_USER = { email: "sarah.mendes.demo@example.com", password: "DemoPassword123!" };

test.describe("US-PUR-20", () => {
  test("a Staff approver can't approve their own expense, and is told why", async ({ seededOrg, browser }) => {
    void seededOrg;
    const context = await browser.newContext();
    const page = await context.newPage();
    await logIn(page, DEMO_STAFF_USER);

    const categories = (await (await page.request.get(`${API_URL}/expense-categories`)).json()) as { id: string }[];
    const created = await page.request.post(`${API_URL}/expenses`, {
      headers: { "Idempotency-Key": randomUUID() },
      data: { categoryId: categories[0]!.id, date: new Date().toISOString(), currency: "USD", amount: "12345", description: "Own expense" },
    });
    expect(created.ok()).toBe(true);

    await page.goto("/expenses");
    await page.getByRole("row").filter({ hasText: "123.45" }).first().getByRole("button").first().click();

    await expect(page.getByTestId("self-review-note")).toHaveText("Someone else needs to approve your own expense.");
    await expect(page.getByRole("button", { name: "Approve", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Reject", exact: true })).toHaveCount(0);
    await page.getByRole("dialog").getByRole("button", { name: "More actions" }).click();
    await expect(page.getByRole("menuitem", { name: "Delete expense" })).toBeVisible();
    await context.close();
  });
});
