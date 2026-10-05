import { randomUUID } from "node:crypto";
import { test, expect } from "./fixtures";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

test.describe("US-DASH-12", () => {
  test("the dashboard greets me, counts what needs me, and lists one row per kind with its action", async ({ page, seededOrg: _ }) => {
    const rows = (await (await page.request.get(`${API_URL}/dashboard/attention`)).json()) as { kind: string }[];
    expect(rows.length, "the demo data leaves things open").toBeGreaterThan(0);

    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^Good (morning|afternoon|evening)(, \S+)?$/);
    await expect(page.getByText(new RegExp(`· ${rows.length} (thing needs|things need) you today`))).toBeVisible();

    const card = page.getByTestId("attention-card");
    await expect(card.getByRole("heading", { name: /Needs your attention/ })).toBeVisible();
    await expect(card.getByLabel(`${rows.length} items`)).toHaveText(String(rows.length));
    await expect(card.getByText("Cleared items disappear automatically")).toBeVisible();
    await expect(card.locator("li[data-kind]")).toHaveCount(rows.length);
    expect(await card.locator("li[data-kind]").evaluateAll((els) => els.map((e) => e.getAttribute("data-kind")))).toEqual(rows.map((r) => r.kind));
    if (rows.some((r) => r.kind === "invoices_overdue")) {
      await expect(card.locator('li[data-kind="invoices_overdue"]')).toContainText(/\d+ invoices? (is|are) overdue/);
    }
  });

  test("with nothing open it says you're all caught up", async ({ page }) => {
    await signUpNewOrg(page, { name: "Fresh Owner", email: `us-dash-12-${randomUUID()}@example.com`, password: "TestPassword123!" });
    await page.goto("/dashboard");
    const card = page.getByTestId("attention-card");
    await expect(card.getByText("You're all caught up")).toBeVisible();
    await expect(card.getByText("Overdue invoices, approvals, expiring quotes and bills due will show up here when they need you.")).toBeVisible();
    await expect(page.getByText(/nothing needs you right now/)).toBeVisible();
  });
});
