import { randomUUID } from "node:crypto";
import { expect } from "@playwright/test";
import { test as seeded, logIn } from "./fixtures";
import { test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";
const DEMO_STAFF_USER = { email: "sarah.mendes.demo@example.com", password: "DemoPassword123!" };
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

test.describe("US-DASH-23", () => {
  test("Accounts lists each bank, cash and card account with its balance and reconciliation; a card's balance is owed; a name opens its register", async ({ page }) => {
    await signUpNewOrg(page, { name: "Accounts Owner", email: `e2e-dash-23-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const grouped = (await (await page.request.get(`${API_URL}/org/accounts`)).json()) as Record<string, { id: string; code: string }[]>;
    const code = (c: string) => Object.values(grouped).flat().find((a) => a.code === c)!.id;
    const card = (await (await page.request.post(`${API_URL}/money-accounts`, { headers: { "Idempotency-Key": randomUUID() }, data: { kind: "card", name: "Business Visa" } })).json()) as { id: string };
    await page.request.post(`${API_URL}/bank-transactions`, { headers: { "Idempotency-Key": randomUUID() }, data: { moneyAccountId: card.id, direction: "out", accountId: code("6300"), amount: "128460", date: today() } });

    await page.goto("/dashboard");
    const accounts = page.getByTestId("accounts-card");
    const visa = accounts.getByRole("listitem").filter({ hasText: "Business Visa" });
    await expect(visa).toContainText("$1,284.60 owed");
    await expect(visa).toContainText("Not reconciled");
    await expect(visa.getByRole("img", { name: "Card" })).toBeVisible();
    await expect(accounts.getByRole("img", { name: "Bank account" }).first()).toBeVisible();

    await visa.getByRole("link", { name: "Business Visa" }).click();
    await expect(page).toHaveURL(new RegExp(`/banking/${card.id}$`));
  });
});

seeded.describe("US-DASH-23 access", () => {
  seeded("a member without 'View banking' doesn't get the Accounts card", async ({ page, seededOrg: _, browser }) => {
    const teams = (await (await page.request.get(`${API_URL}/org/teams`)).json()) as { id: string; isDefault: boolean }[];
    await page.request.put(`${API_URL}/org/teams/${teams.find((t) => t.isDefault)!.id}/privileges`, { headers: { "Idempotency-Key": randomUUID() }, data: { privileges: [{ capability: "banking.view", granted: false }] } });
    const staff = await (await browser.newContext()).newPage();
    await logIn(staff, DEMO_STAFF_USER);
    await staff.goto("/dashboard");
    await expect(staff.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(staff.getByTestId("accounts-card")).toHaveCount(0);
    await staff.context().close();
  });
});
