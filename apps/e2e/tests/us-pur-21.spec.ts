import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { test, expect, logIn } from "./fixtures";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";
/** The demo seed's Staff user, in the default Team. */
const DEMO_STAFF_USER = { email: "sarah.mendes.demo@example.com", password: "DemoPassword123!" };

/** A submitted expense with a unique amount, so its row is easy to find. */
async function submit(page: Page, cents: number) {
  const categories = (await (await page.request.get(`${API_URL}/expense-categories`)).json()) as { id: string; name: string }[];
  const res = await page.request.post(`${API_URL}/expenses`, {
    headers: { "Idempotency-Key": randomUUID() },
    data: { categoryId: categories[0]!.id, date: new Date().toISOString().slice(0, 10), currency: "USD", amount: String(cents), description: "Fuel" },
  });
  expect(res.ok(), `submit: ${res.status()}`).toBe(true);
  return { ...((await res.json()) as { id: string }), category: categories[0]!.name };
}

const dollars = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

async function setReviewGrants(page: Page, granted: boolean) {
  const teams = (await (await page.request.get(`${API_URL}/org/teams`)).json()) as { id: string; isDefault: boolean }[];
  const res = await page.request.put(`${API_URL}/org/teams/${teams.find((t) => t.isDefault)!.id}/privileges`, {
    headers: { "Idempotency-Key": randomUUID() },
    data: { privileges: ["expenses.approve", "expenses.reject"].map((capability) => ({ capability, granted })) },
  });
  expect(res.ok()).toBe(true);
}

test.describe("US-PUR-21", () => {
  test("ticking submitted expenses shows the bar; Approve (2) approves both, Reject… asks for one comment", async ({ page, seededOrg: _ }) => {
    const base = 1000 + Math.floor(Math.random() * 8000);
    const [a, b, c, d] = [base, base + 1, base + 2, base + 3].map((n) => n * 100 + 7);
    const made: { id: string; category: string }[] = [];
    for (const cents of [a!, b!, c!, d!]) made.push(await submit(page, cents));

    await page.goto("/expenses");
    const tick = (cents: number) => page.getByRole("checkbox", { name: `Select ${made[0]!.category} ${dollars(cents)}` }).check();
    await tick(a!);
    await tick(b!);
    const bar = page.getByRole("region", { name: "Selected expenses" });
    await expect(bar).toContainText("2 selected");
    await expect(bar).toContainText(dollars(a! + b!));
    await expect(bar.getByRole("button", { name: "Reject…" })).toBeVisible();
    await expect(bar.getByRole("button", { name: "Clear" })).toBeVisible();
    await bar.getByRole("button", { name: "Approve (2)" }).click();
    await expect(page.getByText("2 expenses approved").first()).toBeVisible();
    await expect(bar).toHaveCount(0);
    for (const id of [made[0]!.id, made[1]!.id]) {
      const row = (await (await page.request.get(`${API_URL}/expenses/${id}`)).json()) as { status: string };
      expect(row.status).toBe("approved");
    }

    await tick(c!);
    await tick(d!);
    await page.getByRole("region", { name: "Selected expenses" }).getByRole("button", { name: "Reject…" }).click();
    const dialog = page.getByRole("dialog", { name: "Reject 2 expenses?" });
    await dialog.getByRole("textbox", { name: "Comment" }).fill("Attach the receipt and resubmit.");
    await dialog.getByRole("button", { name: "Reject expenses" }).click();
    await expect(page.getByText("2 expenses rejected").first()).toBeVisible();
    const rejected = (await (await page.request.get(`${API_URL}/expenses/${made[2]!.id}`)).json()) as { status: string; reviewComment: string };
    expect(rejected).toMatchObject({ status: "rejected", reviewComment: "Attach the receipt and resubmit." });
  });

  test("Staff can't tick their own expenses, and without approval rights there are no tick boxes", async ({ page, seededOrg: _, browser }) => {
    await setReviewGrants(page, true);
    const context = await browser.newContext();
    const staff = await context.newPage();
    await logIn(staff, DEMO_STAFF_USER);
    const cents = (9000 + Math.floor(Math.random() * 900)) * 100 + 3;
    const own = await submit(staff, cents);
    await staff.goto("/expenses");
    await expect(staff.getByRole("checkbox", { name: `Select ${own.category} ${dollars(cents)}` })).toBeDisabled();
    await expect(staff.getByText("Your own expenses can't be selected for approval — someone else approves them.")).toBeVisible();

    await setReviewGrants(page, false);
    await staff.reload();
    await expect(staff.getByRole("heading", { name: "Expenses" }).first()).toBeVisible();
    await expect(staff.getByRole("checkbox", { name: /^Select / })).toHaveCount(0);
    await context.close();
    await setReviewGrants(page, true);
  });
});
