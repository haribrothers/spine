import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

test.describe("US-DASH-25", () => {
  test("Tax this period follows the return period and opens the Tax Summary for it", async ({ page }) => {
    await signUpNewOrg(page, { name: "Tax Owner", email: `e2e-dash-25-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const post = async <T>(path: string, data?: unknown) => (await (await page.request.post(`${API_URL}${path}`, { headers: { "Idempotency-Key": randomUUID() }, data })).json()) as T;
    const grouped = (await (await page.request.get(`${API_URL}/org/accounts`)).json()) as Record<string, { id: string; code: string }[]>;
    const code = (c: string) => Object.values(grouped).flat().find((a) => a.code === c)!.id;
    const bank = ((await (await page.request.get(`${API_URL}/money-accounts`)).json()) as { id: string; code: string }[]).find((a) => a.code === "1010")!;
    const rate = await post<{ id: string }>("/tax-rates", { name: "GST 18%", rate: 18 });
    await post("/bank-transactions", { moneyAccountId: bank.id, direction: "out", accountId: code("6900"), amount: "5900", taxRateId: rate.id, date: today() });

    await page.goto("/dashboard");
    const card = page.getByTestId("tax-period");
    await expect(card).toContainText("Input tax$9.00");
    const month = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
    await expect(card.getByTestId("tax-period-note")).toHaveText(`${month} · nothing paid yet`);

    // Settings › Tax › Return period → Quarterly.
    await page.goto("/dashboard?settings=tax");
    const pane = page.getByRole("dialog").getByTestId("settings-pane");
    await pane.getByRole("combobox", { name: "Return period" }).click();
    await page.getByRole("option", { name: "Quarterly" }).click();
    await page.keyboard.press("Escape");
    await page.goto("/dashboard");
    await expect(card.getByTestId("tax-period-note")).toContainText("–");

    await card.getByRole("link", { name: /^Tax for / }).click();
    await expect(page).toHaveURL(/\/reports\/tax-summary\?from=\d{4}-\d{2}-01&to=\d{4}-\d{2}-\d{2}$/);
    await expect(page.getByRole("heading", { name: "Tax Summary", level: 1 })).toBeVisible();
  });
});
